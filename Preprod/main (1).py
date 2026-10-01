
from typing import Literal
from uuid import uuid4
from datetime import date, datetime, timedelta
from math import ceil
from fastapi import FastAPI, HTTPException, Header, UploadFile, File, Form, Body, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from pathlib import Path
import json
import io
from openpyxl import load_workbook
import base64
import hashlib
import secrets
import os
import re
import tempfile
import smtplib
import threading
import contextvars
import psycopg
try:
    from psycopg_pool import ConnectionPool
except Exception:
    ConnectionPool = None
try:
    from vercel.blob import BlobClient, AsyncBlobClient
except Exception:
    BlobClient = None
    AsyncBlobClient = None
from email.message import EmailMessage
from pydantic import BaseModel, Field, model_validator

app = FastAPI(title="ApartCare2 API", version="6.5.13")


@app.middleware("http")
async def strip_public_api_prefix(request: Request, call_next):
    """Vercel Services preserves /api in the rewritten request path.

    The application keeps its existing route definitions (/health, /account/*,
    /platform/*, etc.). Strip only the public /api prefix before FastAPI route
    matching so existing business routes remain unchanged.
    """
    path = request.scope.get("path", "")
    if path == "/api" or path.startswith("/api/"):
        request.scope["path"] = path[4:] or "/"
    return await call_next(request)


# V6.5.13 CORE FUNCTIONALITY FIX 9 — Vercel filesystem boundary.
#
# Vercel Services runs Python from /var/task. That directory is READ-ONLY.
# The previous fixes still allowed the fallback branch to use __file__.parent
# when Vercel did not expose the expected environment flag, which caused:
#   OSError: [Errno 30] Read-only file system: '/var/task/app/templates'
#
# Detect the deployed filesystem itself as well as the normal Vercel flags.
# Only /tmp is writable at runtime. Templates are application assets and are
# never created with mkdir(). If a bundled templates directory exists, it is
# served read-only from the deployment package.
_SOURCE_DIR = Path(__file__).resolve().parent
_IS_DEPLOYED_READONLY = str(_SOURCE_DIR).startswith("/var/task")
IS_VERCEL = bool(
    os.getenv("VERCEL")
    or os.getenv("VERCEL_ENV")
    or os.getenv("NOW_REGION")
    or _IS_DEPLOYED_READONLY
)

if IS_VERCEL:
    RUNTIME_DIR = Path(tempfile.gettempdir()) / "apartcare"
    UPLOAD_DIR = RUNTIME_DIR / "uploads"
    # Templates, when bundled, are read-only application assets.
    TEMPLATE_DIR = _SOURCE_DIR / "templates"
else:
    RUNTIME_DIR = Path(os.getenv("APARTCARE_RUNTIME_DIR", str(_SOURCE_DIR)))
    UPLOAD_DIR = Path(os.getenv("APARTCARE_UPLOAD_DIR", str(RUNTIME_DIR / "uploads")))
    TEMPLATE_DIR = Path(os.getenv("APARTCARE_TEMPLATE_DIR", str(RUNTIME_DIR / "templates")))

# Only these directories are runtime-writable. Never mkdir TEMPLATE_DIR.
RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Do not let a missing optional templates folder prevent the whole FastAPI
# application from importing. The import-template endpoint will report a
# normal 404 until the corresponding workbook is bundled.
if TEMPLATE_DIR.is_dir():
    app.mount("/templates", StaticFiles(directory=str(TEMPLATE_DIR)), name="templates")



class TenantScopedModel(BaseModel):
    """Canonical tenant boundary for every apartment-owned operational record.

    ``tenant_id`` is the authoritative namespace. ``apartment_id`` is retained
    as a backwards-compatible alias used by older UI code and is always kept in
    sync with tenant_id. A record can never carry two different tenant values.
    """
    tenant_id: str = ""
    apartment_id: str = "demo-apartment"

    @model_validator(mode="before")
    @classmethod
    def _sync_tenant_namespace(cls, value):
        if not isinstance(value, dict):
            return value
        data = dict(value)
        t = str(data.get("tenant_id") or "").strip()
        a = str(data.get("apartment_id") or "").strip()
        # Legacy/demo placeholder is not a real tenant once a tenant_id exists.
        if t and a and t != a and a != "demo-apartment":
            raise ValueError("tenant_id and apartment_id must refer to the same apartment account")
        canonical = t or a or "demo-apartment"
        data["tenant_id"] = canonical
        data["apartment_id"] = canonical
        return data

class ResidentInput(TenantScopedModel):
    flat_no: str = Field(min_length=1, max_length=30)
    owner_name: str = Field(min_length=1, max_length=100)
    resident_name: str = Field(min_length=1, max_length=100)
    resident_type: Literal["Owner", "Tenant"] = "Owner"
    mobile_no: str = Field(min_length=5, max_length=30)
    email: str = ""
    status: Literal["Active", "Inactive"] = "Active"
    remarks: str = ""

class Resident(ResidentInput):
    id: str
    version: int = Field(default=1, ge=1)

class FlatHistory(TenantScopedModel):
    id: str
    flat_no: str
    owner_name: str
    resident_name: str
    resident_type: Literal["Owner", "Tenant"]
    mobile_no: str
    email: str = ""
    status: Literal["Active", "Inactive"] = "Active"
    remarks: str = ""
    effective_from: str = Field(default_factory=lambda: date.today().isoformat())
    effective_to: str | None = None
    change_reason: str = ""
    version: int = Field(default=1, ge=1)

class ChargeSettings(TenantScopedModel):
    account_id: str = ""
    account_mobile: str = ""
    apartment_name: str = "ApartCare Lite"
    address: str = ""
    city: str = ""
    pin_code: str = ""
    state: str = ""
    country: str = "India"
    language: str = "English"
    no_of_flats: int = Field(default=0, ge=0)
    no_of_flats_editable: bool = True
    common_maintenance: float = Field(default=750, ge=0)
    cca: float = Field(default=500, ge=0)
    watchman_salary: float = Field(default=0, ge=0)
    watchman_salary_locked: bool = False
    apartment_photo_name: str = ""
    apartment_photo_path: str = ""

class ChargeHistory(TenantScopedModel):
    id: str
    effective_month: str = Field(pattern=r"^\d{4}-\d{2}$")
    common_maintenance: float = Field(default=0, ge=0)
    cca: float = Field(default=0, ge=0)
    version: int = Field(default=1, ge=1)
    action: str = "Saved"
    changed_at: str
    changed_by: str = "system"

class WatchmanInput(TenantScopedModel):
    name: str = Field(min_length=1, max_length=100)
    mobile_no: str = Field(min_length=5, max_length=30)
    start_date: str
    end_date: str | None = None
    salary: float = Field(default=0, ge=0)
    locked: bool = False
    remarks: str = ""

class Watchman(WatchmanInput):
    id: str
    deleted: bool = False
    deleted_at: str | None = None
    deleted_reason: str = ""

class UtilityCategoryInput(TenantScopedModel):
    name: str = Field(min_length=1, max_length=60)

class UtilityCategory(TenantScopedModel):
    id: str
    name: str
    active: bool = True
    created_at: str
    updated_at: str
    created_by: str = "system"

class UtilityCategoryHistory(TenantScopedModel):
    id: str
    category_id: str
    action: str
    name: str
    changed_at: str
    changed_by: str = "system"

class UtilityContactInput(TenantScopedModel):
    category: str = Field(min_length=1, max_length=60)
    name: str = Field(min_length=1, max_length=100)
    mobile_no: str = Field(min_length=7, max_length=30)
    remarks: str = ""

class UtilityContact(UtilityContactInput):
    id: str
    created_at: str
    updated_at: str
    deleted: bool = False

class UtilityContactHistory(TenantScopedModel):
    id: str
    utility_contact_id: str
    action: Literal["Created", "Updated", "Deleted"]
    category: str
    name: str
    mobile_no: str
    remarks: str = ""
    changed_at: str
    changed_by: str = "system"

class OpeningBalanceInput(TenantScopedModel):
    go_live_month: str = Field(pattern=r"^\d{4}-\d{2}$")
    opening_balance: float
    locked: bool = False

class OpeningBalance(OpeningBalanceInput):
    id: str
    saved_at: str

class OpeningBalanceHistory(TenantScopedModel):
    id: str
    go_live_month: str
    opening_balance: float
    action: str
    changed_at: str
    justification: str = ""
    changed_by: str = "system"

class MaintenanceGenerateInput(TenantScopedModel):
    month_key: str = Field(pattern=r"^\d{4}-\d{2}$")
    maintenance: float = Field(default=0, ge=0)
    cca: float = Field(default=0, ge=0)
    diesel: float = Field(default=0, ge=0)
    other_charges: float = Field(default=0, ge=0)
    water_mode: Literal["Meter", "No Meter"] = "Meter"
    include_maintenance: bool = True
    include_cca: bool = True
    include_diesel: bool = True
    include_municipal_water: bool = True
    tanker_count: int = Field(default=0, ge=0)
    tanker_price: float = Field(default=0, ge=0)
    tanker_amount: float = Field(default=0, ge=0)
    municipal_bill: float = Field(default=0, ge=0)

class MaintenanceUpdate(BaseModel):
    maintenance: float = Field(default=0, ge=0)
    cca: float = Field(default=0, ge=0)
    diesel: float = Field(default=0, ge=0)
    other_charges: float = Field(default=0, ge=0)
    current_reading: float = Field(default=0, ge=0)
    remarks: str = ""

class MaintenanceRow(TenantScopedModel):
    id: str
    month_key: str
    flat_no: str
    owner_name: str
    resident_name: str
    resident_type: Literal["Owner", "Tenant"]
    maintenance: float
    cca: float
    diesel: float
    other_charges: float
    previous_reading: float
    current_reading: float
    water_units: float
    water_rate: float
    water_amount: float
    total: float
    rounded_total: int
    remarks: str = ""
    resident_version: int = Field(default=1, ge=1)

class MonthWaterHeader(TenantScopedModel):
    month_key: str
    water_mode: Literal["Meter", "No Meter"]
    include_maintenance: bool = True
    include_cca: bool = True
    include_diesel: bool = True
    include_municipal_water: bool = True
    tanker_count: int = 0
    tanker_price: float = 0
    tanker_amount: float
    municipal_bill: float
    total_water_cost: float
    water_rate: float
    flats_count: int
    total_units: float
    configured_no_of_flats: int = 0


class PaymentInput(TenantScopedModel):
    month_key: str = Field(pattern=r"^\d{4}-\d{2}$")
    flat_no: str
    paid_amount: float = Field(ge=0)
    payment_mode: Literal["Cash", "UPI", "Bank Transfer", "Cheque", "Other"] = "Cash"
    reference: str = ""
    payment_date: str = Field(default_factory=lambda: date.today().isoformat())
    remarks: str = ""

class PaymentMonthLockInput(TenantScopedModel):
    month_key: str = Field(pattern=r"^\d{4}-\d{2}$")
    justification: str = Field(min_length=3, max_length=500)

class Payment(TenantScopedModel):
    id: str
    month_key: str
    flat_no: str
    owner_name: str
    resident_name: str
    previous_balance: float
    current_month_total: float
    amount_due: float
    paid_amount: float
    pending_balance: float
    payment_mode: str
    reference: str
    payment_date: str
    remarks: str = ""


class ExpenseInput(TenantScopedModel):
    month_key: str = Field(pattern=r"^\d{4}-\d{2}$")
    expense_date: str = Field(default_factory=lambda: date.today().isoformat())
    category: Literal["Watchman Salary", "Electricity", "Water", "Diesel", "Repairs & Maintenance", "Cleaning", "Security", "CCA", "Other"] = "Other"
    description: str = Field(min_length=1, max_length=200)
    amount: float = Field(gt=0)
    payment_mode: Literal["Cash", "UPI", "Bank Transfer", "Cheque", "Other"] = "Cash"
    reference: str = ""
    remarks: str = ""
    receipt_name: str = ""
    receipt_data_url: str = ""

class Expense(ExpenseInput):
    id: str
    bill_original_name: str = ""
    bill_path: str = ""
    source: Literal["Manual", "Settings"] = "Manual"
    deleted: bool = False
    deleted_at: str | None = None
    deleted_reason: str = ""
    locked: bool = False
    locked_at: str | None = None
    lock_reason: str = ""

class ExpenseDeletionHistory(TenantScopedModel):
    id: str
    expense_id: str
    month_key: str
    expense_date: str
    category: str
    description: str
    amount: float
    payment_mode: str = "Cash"
    reference: str = ""
    remarks: str = ""
    source: str = "Manual"
    deleted_at: str
    justification: str
    deleted_by_username: str = ""

class ExpenseSummary(BaseModel):
    month_key: str
    total_expenses: float
    expense_count: int
    by_category: dict[str, float]


class ApartmentPhotoInput(TenantScopedModel):
    photo_name: str = Field(min_length=1, max_length=160)
    photo_data_url: str = Field(min_length=10)

class ApartmentAccountCreateInput(BaseModel):
    apartment_name: str = Field(min_length=2, max_length=120)
    address: str = Field(min_length=2, max_length=240)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=80)
    pin_code: str = Field(min_length=3, max_length=20)
    country: str = Field(min_length=2, max_length=80)
    language: str = Field(default="English", min_length=2, max_length=40)
    data_start_month: str = Field(default="", pattern=r"^(?:\d{4}-\d{2})?$")
    admin_name: str = Field(min_length=1, max_length=100)
    admin_username: str = Field(default="", max_length=80)
    admin_email: str = Field(min_length=5, max_length=120)
    admin_mobile: str = Field(min_length=7, max_length=20)
    password: str = Field(min_length=8, max_length=128)

class AuthLoginResponse(BaseModel):
    user: "AdminUser"
    token: str
    account: dict | None = None

class AdminUserInput(BaseModel):
    username: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9_.-]+$")
    full_name: str = Field(min_length=1, max_length=100)
    email: str = Field(default="", max_length=120)
    mobile_no: str = Field(default="", max_length=20)
    role: Literal["Super Admin", "Admin", "Viewer", "Supervisor"] = "Viewer"
    password: str = Field(min_length=8, max_length=128)

class AdminUserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    role: Literal["Super Admin", "Admin", "Viewer", "Supervisor"] | None = None
    active: bool | None = None
    locked: bool | None = None
    reason: str | None = None

class AdminLoginInput(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=128)

class PasswordResetInput(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)
    force_change: bool = True

class ChangePasswordInput(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)

class PasswordResetRequestInput(BaseModel):
    account_id: str = Field(min_length=5, max_length=40)
    email_or_username: str = Field(min_length=1, max_length=120)

class PasswordResetConfirmInput(BaseModel):
    token: str = Field(min_length=12, max_length=200)
    new_password: str = Field(min_length=8, max_length=128)

class AdminUser(BaseModel):
    id: str
    username: str
    full_name: str
    email: str = ""
    mobile_no: str = ""
    role: Literal["Super Admin", "Admin", "Viewer", "Supervisor"]
    active: bool = True
    locked: bool = False
    force_password_change: bool = False
    tenant_id: str = ""
    created_at: str
    updated_at: str

class LoginAttempt(BaseModel):
    id: str
    username: str
    user_id: str | None = None
    tenant_id: str = ""
    status: Literal["Success", "Failed", "Blocked"]
    event: str = "Login"
    at: str
    reason: str = ""

class SessionTimeoutRule(BaseModel):
    enabled: bool = True
    minutes: int = Field(default=30, ge=1, le=1440)

class SessionTimeoutSettings(BaseModel):
    super_admin: SessionTimeoutRule = Field(default_factory=lambda: SessionTimeoutRule(minutes=30))
    admin: SessionTimeoutRule = Field(default_factory=lambda: SessionTimeoutRule(minutes=20))
    viewer: SessionTimeoutRule = Field(default_factory=lambda: SessionTimeoutRule(minutes=15))

# Apartment-level operational defaults. These are the FastAPI equivalent of
# ApartCare's Operational Settings and are used when generating a new month.
charge_settings: dict[str, ChargeSettings] = {
    "demo-apartment": ChargeSettings()
}
charge_history: list[ChargeHistory] = []

payments: list[Payment] = []
expenses: list[Expense] = []
expense_lock_events: list[dict] = []
expense_deletion_history: list[dict] = []
payment_month_locks: dict[tuple[str, str], dict] = {}
payment_lock_events: list[dict] = []
admin_users: list[AdminUser] = []
admin_passwords: dict[str, str] = {}
login_history: list[LoginAttempt] = []
session_timeout_settings = SessionTimeoutSettings()
auth_sessions: dict[str, str] = {}  # opaque token -> user id; persisted for local-app restart continuity
failed_login_counts: dict[str, int] = {}
password_reset_tokens: dict[str, dict] = {}
watchmen: list[Watchman] = []
watchman_history: list[dict] = []
utility_categories: list[UtilityCategory] = []
utility_category_history: list[UtilityCategoryHistory] = []
utility_contacts: list[UtilityContact] = []
utility_contact_history: list[UtilityContactHistory] = []
opening_balances: dict[str, OpeningBalance] = {}
opening_balance_history: list[OpeningBalanceHistory] = []

residents: list[Resident] = []
flat_history: list[FlatHistory] = []

maintenance_rows: list[MaintenanceRow] = []
water_headers: dict[tuple[str, str], MonthWaterHeader] = {}

def month_key_valid(month_key: str) -> bool:
    try:
        year, month = map(int, month_key.split("-"))
        return 1 <= month <= 12 and year >= 2000
    except Exception:
        return False

def active_residents(apartment_id: str) -> list[Resident]:
    return sorted(
        [r for r in residents if r.apartment_id == apartment_id and r.status == "Active"],
        key=lambda r: r.flat_no.lower()
    )

def previous_month_key(month_key: str) -> str:
    year, month = map(int, month_key.split("-"))
    if month == 1:
        return f"{year-1}-12"
    return f"{year}-{month-1:02d}"

def previous_current_reading(apartment_id: str, flat_no: str, month_key: str) -> float:
    prior = [
        r for r in maintenance_rows
        if r.apartment_id == apartment_id and r.flat_no == flat_no and r.month_key < month_key
    ]
    if not prior:
        return 0.0
    return float(sorted(prior, key=lambda x: x.month_key)[-1].current_reading or 0)

def effective_charge_defaults(apartment_id: str, month_key: str) -> tuple[float,float,str|None]:
    """Return the latest saved charge version effective for MM/YYYY.

    Transactional maintenance rows remain immutable historical facts; this history
    only determines the defaults offered when a new month is generated.
    """
    candidates=[h for h in charge_history if h.apartment_id==apartment_id and h.effective_month<=month_key]
    if candidates:
        latest=max(candidates,key=lambda h:(h.effective_month,h.version,h.changed_at,h.id))
        return float(latest.common_maintenance),float(latest.cca),latest.effective_month
    settings=charge_settings.get(apartment_id,ChargeSettings(apartment_id=apartment_id))
    return float(settings.common_maintenance),float(settings.cca),None

def recalculate_month(apartment_id: str, month_key: str) -> None:
    key = (apartment_id, month_key)
    header = water_headers.get(key)
    rows = [r for r in maintenance_rows if r.apartment_id == apartment_id and r.month_key == month_key]
    if not header or not rows:
        return

    # Tanker amount is always derived from count × price. Municipal bill is optional.
    header.tanker_amount = round(float(header.tanker_count) * float(header.tanker_price), 2)
    municipal_component = float(header.municipal_bill) if header.include_municipal_water else 0.0
    total_cost = round(float(header.tanker_amount) + municipal_component, 2)
    mode = header.water_mode

    if mode == "No Meter":
        configured_flats = int(charge_settings.get(apartment_id, ChargeSettings(apartment_id=apartment_id)).no_of_flats or 0)
        divisor = configured_flats if configured_flats > 0 else len(rows)
        rate = round(total_cost / divisor, 2) if divisor > 0 else 0.0
        total_units = 0.0
        for r in rows:
            r.water_units = 0.0
            r.water_rate = float(rate)
            r.water_amount = round(float(rate), 2)
    else:
        for r in rows:
            r.water_units = max(0.0, round(float(r.current_reading) - float(r.previous_reading), 2))
        total_units = round(sum(r.water_units for r in rows), 2)
        rate = round(total_cost / total_units, 4) if total_units > 0 else 0.0
        for r in rows:
            r.water_rate = float(rate)
            r.water_amount = round(r.water_units * float(rate), 2)

    for r in rows:
        maintenance_component = float(r.maintenance) if header.include_maintenance else 0.0
        cca_component = float(r.cca) if header.include_cca else 0.0
        diesel_component = float(r.diesel) if header.include_diesel else 0.0
        r.total = round(maintenance_component + cca_component + diesel_component + float(r.other_charges) + float(r.water_amount), 2)
        r.rounded_total = round(r.total)

    header.total_water_cost = total_cost
    header.water_rate = float(rate)
    header.flats_count = len(rows)
    header.configured_no_of_flats = int(charge_settings.get(apartment_id, ChargeSettings(apartment_id=apartment_id)).no_of_flats or 0)
    header.total_units = float(total_units)

def get_month_rows(apartment_id: str, month_key: str) -> list[MaintenanceRow]:
    return sorted(
        [r for r in maintenance_rows if r.apartment_id == apartment_id and r.month_key == month_key],
        key=lambda r: r.flat_no.lower()
    )

@app.get("/health")
def health():
    persistent = bool(DATABASE_URL)
    if not persistent:
        return {
            "status": "ok",
            "version": "6.5.13",
            "storage": "local",
            "database": "not_configured",
            "production_ready": False,
        }
    try:
        pool = _get_db_pool()
        if pool is not None:
            with pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.fetchone()
        else:
            conn = psycopg.connect(DATABASE_URL, connect_timeout=3, sslmode='require')
            conn.close()
        return {
            "status": "ok",
            "version": "6.5.13",
            "storage": "postgres",
            "database": "connected",
            "production_ready": True,
        }
    except Exception as exc:
        return JSONResponse(status_code=503, content={
            "status": "degraded",
            "version": "6.5.13",
            "storage": "postgres",
            "database": "unavailable",
            "production_ready": False,
            "error": f"{type(exc).__name__}: {exc}",
        })

# ---------- Residents ----------
def resident_history_for_flat(apartment_id: str, flat_no: str) -> list[FlatHistory]:
    return sorted([h for h in flat_history if h.apartment_id==apartment_id and h.flat_no.lower()==flat_no.lower()],key=lambda h:(h.version,h.effective_from,h.id))

def resident_version_for_month(apartment_id: str, flat_no: str, month_key: str|None=None) -> int:
    hist=resident_history_for_flat(apartment_id,flat_no)
    if not hist: return 1
    if not month_key: return max(h.version for h in hist)
    candidates=[h for h in hist if h.effective_from and h.effective_from[:7] <= month_key]
    return max(candidates,key=lambda h:(h.version,h.effective_from)).version if candidates else min(hist,key=lambda h:(h.version,h.effective_from)).version

@app.get("/residents", response_model=list[Resident])
def list_residents(apartment_id: str="demo-apartment"):
    return sorted([r for r in residents if r.apartment_id==apartment_id],key=lambda r:r.flat_no.lower())

@app.get("/residents/{resident_id}/history", response_model=list[FlatHistory])
def resident_record_history(resident_id: str, apartment_id: str = "demo-apartment", x_apartcare_token: str | None = Header(default=None)):
    actor = _current_actor(x_apartcare_token)
    resolved = _resolved_actor_tenant(x_apartcare_token, apartment_id)
    resident=next((r for r in residents if r.id==resident_id and r.apartment_id==resolved),None)
    if not resident: raise HTTPException(status_code=404,detail="Resident not found")
    return resident_history_for_flat(resident.apartment_id,resident.flat_no)

@app.post("/residents", response_model=Resident, status_code=201)
def create_resident(data: ResidentInput, x_apartcare_token: str | None = Header(default=None)):
    _require_write_role(x_apartcare_token)
    if any(r.apartment_id==data.apartment_id and r.flat_no.lower()==data.flat_no.lower() for r in residents):
        raise HTTPException(status_code=409,detail="A resident record already exists for this Flat No. Edit the existing record to create a new version.")
    resident=Resident(id=str(uuid4()),version=1,**data.model_dump()); residents.append(resident)
    flat_history.append(FlatHistory(id=str(uuid4()),apartment_id=data.apartment_id,flat_no=data.flat_no,owner_name=data.owner_name,resident_name=data.resident_name,resident_type=data.resident_type,mobile_no=data.mobile_no,email=data.email,status=data.status,remarks=data.remarks,effective_from=date.today().isoformat(),effective_to=None,version=1,change_reason="Initial resident record"))
    return resident

@app.put("/residents/{resident_id}", response_model=Resident)
def update_resident(resident_id: str,data: ResidentInput, x_apartcare_token: str | None = Header(default=None)):
    actor = _require_write_role(x_apartcare_token)
    tenant_id = _actor_apartment_id(actor)
    for index,resident in enumerate(residents):
        if resident.id==resident_id and resident.apartment_id==tenant_id:
            if data.flat_no.lower()!=resident.flat_no.lower() and any(r.apartment_id==resident.apartment_id and r.flat_no.lower()==data.flat_no.lower() for r in residents if r.id!=resident_id):
                raise HTTPException(status_code=409,detail="The destination Flat No already has a resident record.")
            history=resident_history_for_flat(resident.apartment_id,resident.flat_no); next_version=max([h.version for h in history],default=getattr(resident,'version',1))+1; now=date.today().isoformat()
            for h in reversed(history):
                if h.effective_to is None: h.effective_to=now; break
            updated=Resident(id=resident_id,version=next_version,**data.model_dump()); residents[index]=updated
            flat_history.append(FlatHistory(id=str(uuid4()),apartment_id=data.apartment_id,flat_no=data.flat_no,owner_name=data.owner_name,resident_name=data.resident_name,resident_type=data.resident_type,mobile_no=data.mobile_no,email=data.email,status=data.status,remarks=data.remarks,effective_from=now,effective_to=None,version=next_version,change_reason=f"Resident record updated to V{next_version}"))
            current_month=date.today().strftime('%Y-%m')
            for row in maintenance_rows:
                if row.apartment_id==resident.apartment_id and row.flat_no.lower()==resident.flat_no.lower() and row.month_key>=current_month:
                    row.owner_name=updated.owner_name; row.resident_name=updated.resident_name; row.resident_type=updated.resident_type; row.resident_version=next_version
            return updated
    raise HTTPException(status_code=404,detail="Resident not found")

@app.delete("/residents/{resident_id}")
def delete_resident(resident_id: str, x_apartcare_token: str | None = Header(default=None)):
    _require_write_role(x_apartcare_token)
    raise HTTPException(status_code=405,detail="Resident deletion is disabled. Edit the resident and review the retained version history instead.")

# ---------- Expenses / Fund Management ----------
def canonical_expense_month(expense_date: str) -> str:
    """Derive the accounting month from the actual expense date.

    The UI month selector is only a filter. Persisting a separate, user-selected
    month can misclassify an expense when the entered date belongs to another month.
    """
    try:
        parsed = date.fromisoformat(str(expense_date))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Expense date must be YYYY-MM-DD")
    return parsed.strftime("%Y-%m")

def save_expense_receipt(expense_id: str, receipt_name: str, receipt_data_url: str) -> tuple[str, str]:
    if not receipt_name or not receipt_data_url:
        return "", ""
    try:
        encoded = receipt_data_url.split(",", 1)[1] if "," in receipt_data_url else receipt_data_url
        raw = base64.b64decode(encoded)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid bill/receipt file data.")
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Bill/receipt file must be 10 MB or smaller.")
    suffix = Path(receipt_name).suffix.lower()[:12]
    safe_name = f"expense_{expense_id}{suffix or '.bin'}"
    if os.getenv('BLOB_READ_WRITE_TOKEN') and BlobClient is not None:
        try:
            client = BlobClient()
            client.put(f"apartcare/expenses/{safe_name}", raw, access="private", overwrite=True)
            return receipt_name, f"/uploads/{safe_name}"
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Unable to store receipt in production storage: {exc}")
    target = UPLOAD_DIR / safe_name
    target.write_bytes(raw)
    return receipt_name, f"/uploads/{safe_name}"

def current_accounting_month() -> str:
    return date.today().strftime("%Y-%m")

def _watchman_lock_time(watchman_id: str) -> str:
    events = [h.get("at", "") for h in watchman_history if h.get("watchman_id") == watchman_id and h.get("action") == "Locked"]
    return events[-1] if events else ""

def _locked_watchman_versions(apartment_id: str) -> list[Watchman]:
    return [w for w in watchmen if w.apartment_id == apartment_id and not w.deleted and w.locked]

def _watchman_version_for_month(apartment_id: str, month_key: str) -> Watchman | None:
    """Return the latest locked Watchman version applicable to an accounting month.

    Start/end dates define the effective period; lock status makes the version
    authoritative. If several locked versions overlap, the latest start date wins,
    with the most recently locked record breaking a tie.
    """
    versions = _locked_watchman_versions(apartment_id)
    if not versions:
        return None
    applicable = []
    for w in versions:
        start_month = str(w.start_date)[:7]
        end_month = str(w.end_date)[:7] if w.end_date else None
        if start_month <= month_key and (not end_month or end_month >= month_key):
            applicable.append(w)
    if not applicable:
        return None
    return sorted(applicable, key=lambda w: (str(w.start_date), _watchman_lock_time(w.id), w.id))[-1]

def watchman_salary_for_month(apartment_id: str, month_key: str) -> tuple[float, Watchman | None]:
    """Resolve salary from the latest locked Watchman version.

    Legacy properties that have no locked Watchman records continue to use the
    existing Settings salary. Once any locked Watchman version exists, an
    uncovered month deliberately returns zero rather than silently inheriting a
    newer Settings salary.
    """
    versions = _locked_watchman_versions(apartment_id)
    if versions:
        selected = _watchman_version_for_month(apartment_id, month_key)
        return (round(float(selected.salary), 2), selected) if selected else (0.0, None)
    settings = charge_settings.get(apartment_id, ChargeSettings(apartment_id=apartment_id))
    return round(float(settings.watchman_salary), 2), None

def expense_is_countable(e: Expense) -> bool:
    # Soft-deleted expenses are excluded from all financial totals. A locked expense
    # is still a real financial transaction; locking freezes edits but does not remove it.
    # V6.4.39 also excludes legacy Settings-generated Watchman salary projections
    # beyond the current accounting month. They are invalid future projections, not
    # actual expenses. Manual future-dated expenses remain countable.
    if e.deleted:
        return False
    if e.source == "Settings" and e.category == "Watchman Salary" and e.month_key > current_accounting_month():
        return False
    return True

def ensure_watchman_expense(apartment_id: str, month_key: str) -> Expense | None:
    if not month_key_valid(month_key):
        return None
    # Never create a financial transaction merely because a future month is viewed.
    if month_key > current_accounting_month():
        return next((e for e in expenses if e.apartment_id == apartment_id and e.month_key == month_key and e.category == "Watchman Salary" and e.source == "Settings"), None)

    amount, version = watchman_salary_for_month(apartment_id, month_key)
    if amount <= 0:
        return None
    existing_any = next((e for e in expenses if e.apartment_id == apartment_id and e.month_key == month_key and e.category == "Watchman Salary" and e.source == "Settings"), None)
    version_label = f"{version.name} V{version.id[:8]}" if version else "Settings"
    if existing_any:
        # Preserve deleted/locked audit decisions; do not silently resurrect them.
        # An active Settings-generated row may be reconciled to the authoritative
        # locked Watchman version for that month.
        if expense_is_countable(existing_any) and not existing_any.locked:
            existing_any.amount = amount
            existing_any.description = f"Monthly Watchman Salary ({version_label})"
            existing_any.remarks = f"Auto-created from locked Watchman version{(' ' + version.id[:8]) if version else ' / Settings'}"
        return existing_any
    expense = Expense(id=str(uuid4()), apartment_id=apartment_id, month_key=month_key, expense_date=f"{month_key}-01", category="Watchman Salary", description=f"Monthly Watchman Salary ({version_label})", amount=amount, payment_mode="Cash", reference="", remarks=f"Auto-created from locked Watchman version{(' ' + version.id[:8]) if version else ' / Settings'}", source="Settings")
    expenses.append(expense)
    return expense

def get_month_expenses(apartment_id: str, month_key: str, include_deleted: bool = False) -> list[Expense]:
    ensure_watchman_expense(apartment_id, month_key)
    rows = [e for e in expenses if e.apartment_id == apartment_id and e.month_key == month_key]
    if include_deleted:
        return sorted(rows, key=lambda e: (e.expense_date, e.category, e.id), reverse=True)
    return sorted([e for e in rows if expense_is_countable(e)], key=lambda e: (e.expense_date, e.category, e.id), reverse=True)

def month_expense_total(apartment_id: str, month_key: str) -> float:
    ensure_watchman_expense(apartment_id, month_key)
    return round(sum(e.amount for e in expenses if e.apartment_id == apartment_id and e.month_key == month_key and expense_is_countable(e)), 2)

def expense_summary_data(apartment_id: str, month_key: str) -> dict:
    rows = get_month_expenses(apartment_id, month_key)
    by_category: dict[str, float] = {}
    for row in rows:
        by_category[row.category] = round(by_category.get(row.category, 0.0) + row.amount, 2)
    return {
        "month_key": month_key,
        "total_expenses": round(sum(r.amount for r in rows), 2),
        "expense_count": len(rows),
        "by_category": by_category
    }

# ---------- Payments ----------
def month_rows_for_flat(apartment_id: str, flat_no: str, month_key: str):
    return [r for r in maintenance_rows if r.apartment_id == apartment_id and r.flat_no == flat_no and r.month_key == month_key]

def normalize_payments() -> int:
    """Enforce ApartCare's one cumulative payment record per flat/month.

    The Payments screen edits a cumulative monthly paid amount, not a transaction
    ledger. Older builds could append the same flat/month more than once (for
    example after repeated Save/POST calls), which then inflated Dashboard and
    Reports. Keep the latest stored record for each apartment/month/flat key.
    Returns the number of removed duplicate rows.
    """
    global payments
    seen: dict[tuple[str, str, str], Payment] = {}
    order: list[tuple[str, str, str]] = []
    removed = 0
    for p in payments:
        key = (p.apartment_id, p.flat_no.strip().casefold(), p.month_key)
        if key in seen:
            removed += 1
            # Latest record wins; this matches the PUT correction semantics.
            seen[key] = p
        else:
            seen[key] = p
            order.append(key)
    if removed:
        payments[:] = [seen[k] for k in order]
    return removed


def previous_pending_balance(apartment_id: str, flat_no: str, month_key: str) -> float:
    """Canonical arrears before the selected month.

    Earlier bills are summed once and all earlier payments are deducted once.
    This avoids duplicate carry-forward when a flat has several partial payments.
    """
    earlier_bills = [
        r.rounded_total for r in maintenance_rows
        if r.apartment_id == apartment_id and r.flat_no == flat_no and r.month_key < month_key
    ]
    earlier_paid = [
        p.paid_amount for p in payments
        if p.apartment_id == apartment_id and p.flat_no == flat_no and p.month_key < month_key
    ]
    return max(0.0, round(sum(earlier_bills) - sum(earlier_paid), 2))

def current_month_paid(apartment_id: str, flat_no: str, month_key: str) -> float:
    return round(sum(
        p.paid_amount for p in payments
        if p.apartment_id == apartment_id and p.flat_no == flat_no and p.month_key == month_key
    ), 2)

def payment_for_month(apartment_id: str, flat_no: str, month_key: str):
    return [p for p in payments if p.apartment_id == apartment_id and p.flat_no == flat_no and p.month_key == month_key]

def payment_month_lock(apartment_id: str, month_key: str):
    return payment_month_locks.get((apartment_id, month_key))

def ensure_payment_month_editable(apartment_id: str, month_key: str):
    lock = payment_month_lock(apartment_id, month_key)
    if lock and lock.get("locked"):
        raise HTTPException(status_code=409, detail=f"{month_key} is globally locked. Monthly Maintenance, Payments and Expenses are frozen. An Admin must unlock the month before financial changes are allowed.")

def ensure_global_month_editable(apartment_id: str, month_key: str):
    """Global financial month lock used by Maintenance and Expenses as well as Payments."""
    ensure_payment_month_editable(apartment_id, month_key)

@app.get("/payments/lock-status")
def payment_lock_status(month_key: str, apartment_id: str = "demo-apartment"):
    if not month_key_valid(month_key):
        raise HTTPException(status_code=400, detail="Month must be YYYY-MM")
    lock = payment_month_lock(apartment_id, month_key)
    return {"apartment_id": apartment_id, "month_key": month_key, "locked": bool(lock and lock.get("locked")), "lock": lock}

@app.get("/payments/lock-history")
def payment_lock_history(month_key: str|None = None, apartment_id: str = "demo-apartment"):
    rows=[h for h in payment_lock_events if h.get("apartment_id")==apartment_id and (not month_key or h.get("month_key")==month_key)]
    return sorted(rows,key=lambda h:h.get("at", ""),reverse=True)

@app.post("/payments/lock")
def lock_payment_month(data: PaymentMonthLockInput, x_apartcare_token: str|None = Header(default=None)):
    actor=_require_role(x_apartcare_token,{"Admin"})
    if not month_key_valid(data.month_key):
        raise HTTPException(status_code=400, detail="Month must be YYYY-MM")
    key=(data.apartment_id,data.month_key)
    existing=payment_month_locks.get(key)
    if existing and existing.get("locked"):
        raise HTTPException(status_code=409, detail=f"Payment collection for {data.month_key} is already locked.")
    now=datetime.now().isoformat(timespec="seconds")
    lock={"apartment_id":data.apartment_id,"month_key":data.month_key,"locked":True,"locked_at":now,"locked_by_user_id":actor.id,"locked_by_username":actor.username,"lock_justification":data.justification.strip()}
    payment_month_locks[key]=lock
    payment_lock_events.append({"id":str(uuid4()),**lock,"action":"Locked","at":now,"by_user_id":actor.id,"by_username":actor.username,"justification":data.justification.strip()})
    _save_state()
    return lock

@app.post("/payments/unlock")
def unlock_payment_month(data: PaymentMonthLockInput, x_apartcare_token: str|None = Header(default=None)):
    actor=_require_role(x_apartcare_token,{"Admin"})
    if not month_key_valid(data.month_key):
        raise HTTPException(status_code=400, detail="Month must be YYYY-MM")
    key=(data.apartment_id,data.month_key); existing=payment_month_locks.get(key)
    if not existing or not existing.get("locked"):
        raise HTTPException(status_code=409, detail=f"Payment collection for {data.month_key} is already unlocked.")
    now=datetime.now().isoformat(timespec="seconds")
    existing["locked"]=False; existing["unlocked_at"]=now; existing["unlocked_by_user_id"]=actor.id; existing["unlocked_by_username"]=actor.username; existing["unlock_justification"]=data.justification.strip()
    payment_lock_events.append({"id":str(uuid4()),"apartment_id":data.apartment_id,"month_key":data.month_key,"locked":False,"action":"Unlocked","at":now,"by_user_id":actor.id,"by_username":actor.username,"justification":data.justification.strip()})
    _save_state()
    return existing

@app.get("/payments", response_model=list[Payment])
def list_payments(month_key: str, apartment_id: str = "demo-apartment"):
    if not month_key_valid(month_key):
        raise HTTPException(status_code=400, detail="Month must be YYYY-MM")
    rows = get_month_rows(apartment_id, month_key)
    result = []
    for row in rows:
        previous = previous_pending_balance(apartment_id, row.flat_no, month_key)
        current_paid = current_month_paid(apartment_id, row.flat_no, month_key)
        amount_due = round(previous + row.rounded_total, 2)
        pending = max(0.0, round(amount_due - current_paid, 2))
        latest = next(
            (p for p in reversed(payments)
             if p.apartment_id == apartment_id and p.flat_no == row.flat_no and p.month_key == month_key),
            None
        )
        result.append(Payment(
            id=latest.id if latest else f"preview-{row.id}",
            apartment_id=apartment_id,
            month_key=month_key,
            flat_no=row.flat_no,
            owner_name=row.owner_name,
            resident_name=row.resident_name,
            previous_balance=previous,
            current_month_total=row.rounded_total,
            amount_due=amount_due,
            paid_amount=current_paid,
            pending_balance=pending,
            payment_mode=latest.payment_mode if latest else "Cash",
            reference=latest.reference if latest else "",
            payment_date=latest.payment_date if latest else date.today().isoformat(),
            remarks=latest.remarks if latest else ""
        ))
    return sorted(result, key=lambda p: p.flat_no.lower())

@app.post("/payments", response_model=Payment)
def record_payment(data: PaymentInput, x_apartcare_token: str | None = Header(default=None)):
    _require_write_role(x_apartcare_token)
    ensure_payment_month_editable(data.apartment_id, data.month_key)
    rows = month_rows_for_flat(data.apartment_id, data.flat_no, data.month_key)
    if not rows:
        raise HTTPException(status_code=400, detail="Generate monthly maintenance for this flat and month before recording payment.")
    row = rows[0]
    normalize_payments()
    previous = previous_pending_balance(data.apartment_id, data.flat_no, data.month_key)
    total_due = round(previous + row.rounded_total, 2)
    # POST is also treated as a cumulative monthly save. The submitted amount
    # replaces the existing monthly value, so validate against total due rather
    # than subtracting the value that is about to be replaced.
    if data.paid_amount > total_due + 0.0001:
        raise HTTPException(status_code=400, detail=f"Paid amount cannot exceed Amount Due of {total_due}.")
    pending = max(0.0, round(total_due - data.paid_amount, 2))
    amount_due = total_due
    payment = Payment(
        id=str(uuid4()),
        apartment_id=data.apartment_id,
        month_key=data.month_key,
        flat_no=row.flat_no,
        owner_name=row.owner_name,
        resident_name=row.resident_name,
        previous_balance=previous,
        current_month_total=row.rounded_total,
        amount_due=amount_due,
        paid_amount=data.paid_amount,
        pending_balance=pending,
        payment_mode=data.payment_mode,
        reference=data.reference,
        payment_date=data.payment_date,
        remarks=data.remarks
    )
    # Payment storage is cumulative: one record per flat/month. Repeated saves
    # must replace the prior record instead of creating duplicate collection rows.
    normalize_payments()
    global payments
    payments[:] = [
        p for p in payments
        if not (p.apartment_id == data.apartment_id
                and p.flat_no.strip().casefold() == data.flat_no.strip().casefold()
                and p.month_key == data.month_key)
    ]
    payments.append(payment)
    return payment

@app.put("/payments", response_model=Payment)
def save_or_correct_payment(data: PaymentInput, x_apartcare_token: str | None = Header(default=None)):
    _require_write_role(x_apartcare_token)
    ensure_payment_month_editable(data.apartment_id, data.month_key)
    """Save the cumulative paid amount for a flat/month.

    Unlike the original append-only POST endpoint, this endpoint supports
    corrections. If a user previously saved ₹1,250 and later changes it to
    ₹1,200/Pending, the stored month total becomes ₹1,200 rather than adding
    another transaction.
    """
    rows = month_rows_for_flat(data.apartment_id, data.flat_no, data.month_key)
    if not rows:
        raise HTTPException(status_code=400, detail="Generate monthly maintenance for this flat and month before saving payment.")

    row = rows[0]
    previous = previous_pending_balance(data.apartment_id, data.flat_no, data.month_key)
    total_due = round(previous + row.rounded_total, 2)

    if data.paid_amount > total_due + 0.0001:
        raise HTTPException(status_code=400, detail=f"Paid amount cannot exceed Amount Due of {total_due}.")

    # Replace all current-month payment rows for this flat with one corrected
    # cumulative record. This makes Recalculate/Refresh deterministic.
    global payments
    payments = [
        p for p in payments
        if not (
            p.apartment_id == data.apartment_id
            and p.flat_no == data.flat_no
            and p.month_key == data.month_key
        )
    ]

    pending = max(0.0, round(total_due - data.paid_amount, 2))
    payment = Payment(
        id=str(uuid4()),
        apartment_id=data.apartment_id,
        month_key=data.month_key,
        flat_no=row.flat_no,
        owner_name=row.owner_name,
        resident_name=row.resident_name,
        previous_balance=previous,
        current_month_total=row.rounded_total,
        amount_due=total_due,
        paid_amount=round(data.paid_amount, 2),
        pending_balance=pending,
        payment_mode=data.payment_mode,
        reference=data.reference,
        payment_date=data.payment_date,
        remarks=data.remarks
    )

    # Keep a zero-value record too, so a deliberate Pending/₹0 save preserves
    # the user's current status and metadata.
    payments.append(payment)
    return payment

@app.get("/payments/summary")
def payments_summary(month_key: str, apartment_id: str = "demo-apartment"):
    normalize_payments()
    rows = get_month_rows(apartment_id, month_key)
    current_total = round(sum(r.rounded_total for r in rows), 2)
    previous_due = round(sum(previous_pending_balance(apartment_id, r.flat_no, month_key) for r in rows), 2)
    current_paid = round(sum(current_month_paid(apartment_id, r.flat_no, month_key) for r in rows), 2)
    due = round(previous_due + current_total, 2)
    pending = max(0.0, round(due - current_paid, 2))
    return {
        "month_key": month_key,
        "total_maintenance": current_total,
        "previous_balance": previous_due,
        "total_due": due,
        "total_collected": current_paid,
        "total_pending": pending,
        "payment_count": sum(1 for p in payments if p.apartment_id == apartment_id and p.month_key == month_key)
    }

@app.get("/dashboard/kpis")
def dashboard_kpis(month_key: str | None = None, year: str | None = None, period: str = "Monthly", apartment_id: str = "demo-apartment"):
    normalize_payments()
    # Dashboard supports both month and year selections. Always calculate from
    # the selected period; never retain a previous period's values.
    if period == "Yearly":
        if not year or not (len(year) == 4 and year.isdigit()):
            raise HTTPException(status_code=400, detail="Year must be YYYY")
        start_month = f"{year}-01"
        end_month = f"{year}-12"
        current_rows = [r for r in maintenance_rows if r.apartment_id == apartment_id and r.month_key.startswith(f"{year}-")]
        current_payments = [p for p in payments if p.apartment_id == apartment_id and p.month_key.startswith(f"{year}-")]
        current_expenses = [e for e in expenses if e.apartment_id == apartment_id and e.month_key.startswith(f"{year}-") and expense_is_countable(e)]
        current_maintenance = round(sum(r.rounded_total for r in current_rows), 2)
        total_collected = round(sum(p.paid_amount for p in current_payments), 2)
        total_expenses = round(sum(e.amount for e in current_expenses), 2)
        period_rows, _, _ = _financial_period_values(apartment_id, year)
        active_rows = [r for r in period_rows if not r["is_before_go_live"]]
        previous_closing = round(active_rows[0]["opening_balance"], 2) if active_rows else 0.0
        current_balance = round(total_collected - total_expenses, 2)
        total_available = round(previous_closing + current_balance, 2)
        return {"previous_month_closing": previous_closing, "total_maintenance": current_maintenance, "total_collected": total_collected, "total_expenses": total_expenses, "current_balance": current_balance, "total_available_amount": total_available}

    if not month_key or not month_key_valid(month_key):
        raise HTTPException(status_code=400, detail="Month must be YYYY-MM")
    # Reconcile the Settings-driven recurring expense before monthly dashboard calculations.
    ensure_watchman_expense(apartment_id, month_key)
    rows = get_month_rows(apartment_id, month_key)
    current_maintenance = round(sum(r.rounded_total for r in rows), 2)
    total_collected = round(sum(
        p.paid_amount for p in payments
        if p.apartment_id == apartment_id and p.month_key == month_key
    ), 2)

    # Canonical rolling cash-flow: Settings Opening Balance is seeded once in
    # Go-Live month; subsequent months inherit the immediately preceding closing.
    position = _financial_month_values(apartment_id, month_key)
    previous_closing = round(position["opening_balance"], 2)
    total_expenses = round(position["expenses"], 2)
    current_balance = round(position["difference"], 2)
    total_available = round(position["closing_balance"], 2)
    return {
        "previous_month_closing": previous_closing,
        "total_maintenance": current_maintenance,
        "total_collected": total_collected,
        "total_expenses": total_expenses,
        "current_balance": current_balance,
        "total_available_amount": total_available,
        "go_live_month": position["go_live_month"]
    }


# ---------- Expenses / Fund Management ----------
@app.get("/expenses", response_model=list[Expense])
def list_expenses(month_key: str, apartment_id: str = "demo-apartment"):
    if not month_key_valid(month_key):
        raise HTTPException(status_code=400, detail="Month must be YYYY-MM")
    # Keep deleted rows visible in the register for audit. They are excluded from
    # every financial total by expense_is_countable(), and the UI disables actions.
    return [e for e in expenses if e.apartment_id==apartment_id and e.month_key==month_key]

@app.get("/expenses/summary", response_model=ExpenseSummary)
def expenses_summary(month_key: str, apartment_id: str = "demo-apartment"):
    if not month_key_valid(month_key):
        raise HTTPException(status_code=400, detail="Month must be YYYY-MM")
    return ExpenseSummary(**expense_summary_data(apartment_id, month_key))

@app.post("/expenses", response_model=Expense, status_code=201)
def create_expense(data: ExpenseInput, x_apartcare_token: str | None = Header(default=None)):
    _require_write_role(x_apartcare_token)
    # A Payment month lock is the global financial freeze.
    ensure_global_month_editable(data.apartment_id, canonical_expense_month(data.expense_date))
    # Data-integrity rule: expense month always comes from the actual expense date.
    # Never trust a stale UI filter month supplied by the client.
    canonical_month = canonical_expense_month(data.expense_date)
    expense_id = str(uuid4())
    payload = data.model_dump()
    payload["month_key"] = canonical_month
    receipt_name = payload.pop("receipt_name", "")
    receipt_data_url = payload.pop("receipt_data_url", "")
    bill_name, bill_path = save_expense_receipt(expense_id, receipt_name, receipt_data_url)
    expense = Expense(id=expense_id, source="Manual", bill_original_name=bill_name, bill_path=bill_path, **payload)
    expenses.append(expense)
    _save_state()
    return expense

@app.put("/expenses/{expense_id}", response_model=Expense)
def update_expense(expense_id: str, data: ExpenseInput, x_apartcare_token: str | None = Header(default=None)):
    actor = _require_write_role(x_apartcare_token)
    tenant_id = _actor_apartment_id(actor)
    for index, expense in enumerate(expenses):
        if expense.id == expense_id and expense.apartment_id == tenant_id and not expense.deleted:
            ensure_global_month_editable(expense.apartment_id, expense.month_key)
            if expense.locked: raise HTTPException(status_code=409, detail="Expense is locked. An Admin must unlock it before editing.")
            payload = data.model_dump()
            # Keep month classification aligned with the edited expense date.
            payload["month_key"] = canonical_expense_month(data.expense_date)
            receipt_name = payload.pop("receipt_name", "")
            receipt_data_url = payload.pop("receipt_data_url", "")
            bill_name, bill_path = (expense.bill_original_name, expense.bill_path)
            if receipt_name and receipt_data_url:
                bill_name, bill_path = save_expense_receipt(expense_id, receipt_name, receipt_data_url)
            updated = Expense(id=expense_id, source=expense.source, deleted=False, deleted_at=expense.deleted_at, deleted_reason=expense.deleted_reason, bill_original_name=bill_name, bill_path=bill_path, **payload)
            expenses[index] = updated
            _save_state()
            return updated
    raise HTTPException(status_code=404, detail="Expense not found")

@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: str, reason: str = "", x_apartcare_token: str | None = Header(default=None)):
    actor = _require_role(x_apartcare_token, {"Admin"})
    tenant_id = _actor_apartment_id(actor)
    reason = " ".join(str(reason or "").strip().split())
    if len(reason) < 5:
        raise HTTPException(status_code=422, detail="Delete justification is mandatory (minimum 5 characters).")
    for expense in expenses:
        if expense.id != expense_id or expense.apartment_id != tenant_id:
            continue
        if expense.deleted:
            raise HTTPException(status_code=409, detail="Expense is already soft deleted.")
        if expense.locked:
            raise HTTPException(status_code=409, detail="Locked expense cannot be deleted. An Admin must unlock it first.")
        ensure_global_month_editable(expense.apartment_id, expense.month_key)
        now = datetime.now().isoformat(timespec="seconds")
        expense.deleted = True
        expense.deleted_at = now
        expense.deleted_reason = reason
        snapshot = expense.model_dump()
        event = {"id": str(uuid4()), "expense_id": expense.id, "apartment_id": expense.apartment_id, "month_key": expense.month_key, "expense": snapshot, "deleted_at": now, "justification": reason, "deleted_by_user_id": actor.id, "deleted_by_username": actor.username}
        expense_deletion_history.append(event)
        _audit(actor.username, "Success", "Expense Soft Deleted", f"{expense.category}; {expense.month_key}; {reason}", actor.id)
        _save_state()
        return {"deleted": True, "soft_delete": True, "expense_id": expense.id, "deleted_at": now, "justification": reason, "history_id": event["id"]}
    raise HTTPException(status_code=404, detail="Expense not found")

@app.get("/expenses/history", response_model=list[ExpenseDeletionHistory])
def expense_history(month_key: str | None = None, apartment_id: str = "demo-apartment"):
    rows = []
    seen = set()
    changed = False
    for h in expense_deletion_history:
        e = dict(h.get("expense", {}))
        expense_id = h.get("expense_id", e.get("id", ""))
        if not expense_id or expense_id in seen:
            continue
        if h.get("apartment_id", e.get("apartment_id", apartment_id)) != apartment_id:
            continue
        if month_key is not None and h.get("month_key", e.get("month_key", "")) != month_key:
            continue
        seen.add(expense_id)
        rows.append(ExpenseDeletionHistory(id=h.get("id", str(uuid4())), expense_id=expense_id, apartment_id=h.get("apartment_id", e.get("apartment_id", apartment_id)), month_key=h.get("month_key", e.get("month_key", "")), expense_date=e.get("expense_date", ""), category=e.get("category", ""), description=e.get("description", ""), amount=float(e.get("amount", 0)), payment_mode=e.get("payment_mode", "Cash"), reference=e.get("reference", ""), remarks=e.get("remarks", ""), source=e.get("source", "Manual"), deleted_at=h.get("deleted_at") or e.get("deleted_at") or "", justification=h.get("justification") or e.get("deleted_reason") or "", deleted_by_username=h.get("deleted_by_username", "")))
    for e in expenses:
        if not e.deleted or e.id in seen or e.apartment_id != apartment_id or (month_key is not None and e.month_key != month_key):
            continue
        event = {"id": str(uuid4()), "expense_id": e.id, "apartment_id": e.apartment_id, "month_key": e.month_key, "expense": e.model_dump(), "deleted_at": e.deleted_at or datetime.now().isoformat(timespec="seconds"), "justification": e.deleted_reason or "Legacy soft delete", "deleted_by_user_id": "", "deleted_by_username": ""}
        expense_deletion_history.append(event); changed = True; seen.add(e.id)
        rows.append(ExpenseDeletionHistory(id=event["id"], expense_id=e.id, apartment_id=e.apartment_id, month_key=e.month_key, expense_date=e.expense_date, category=e.category, description=e.description, amount=e.amount, payment_mode=e.payment_mode, reference=e.reference, remarks=e.remarks, source=e.source, deleted_at=event["deleted_at"], justification=event["justification"], deleted_by_username=""))
    if changed: _save_state()
    return sorted(rows, key=lambda e: (e.deleted_at, e.expense_date), reverse=True)

# Legacy endpoint retained for compatibility; monthly expense creation is automatic.
@app.post("/expenses/generate-watchman", response_model=Expense | None)
def generate_watchman_expense(month_key: str, apartment_id: str = "demo-apartment", x_apartcare_token: str | None = Header(default=None)):
    _require_write_role(x_apartcare_token)
    return ensure_watchman_expense(apartment_id, month_key)

@app.get("/expenses/lock-history")
def expense_lock_history(month_key: str|None=None, category: str="", apartment_id: str="demo-apartment"):
    return sorted([h for h in expense_lock_events if h.get("apartment_id")==apartment_id and (not month_key or h.get("month_key")==month_key) and (not category or h.get("category")==category)], key=lambda h:h.get("at",""), reverse=True)

@app.post("/expenses/{expense_id}/lock", response_model=Expense)
def lock_expense(expense_id: str, locked: bool=True, reason: str="", x_apartcare_token: str|None=Header(default=None)):
    actor=_require_role(x_apartcare_token,{"Admin"}); tenant_id=_actor_apartment_id(actor); reason=reason.strip()
    if not reason: raise HTTPException(status_code=400,detail="Justification is mandatory for both lock and unlock actions.")
    for expense in expenses:
        if expense.id==expense_id and expense.apartment_id==tenant_id:
            ensure_global_month_editable(expense.apartment_id, expense.month_key)
            if expense.deleted: raise HTTPException(status_code=409,detail="Deleted expense cannot be locked or unlocked.")
            if locked and expense.locked: raise HTTPException(status_code=409,detail="Expense is already locked.")
            if not locked and not expense.locked: raise HTTPException(status_code=409,detail="Expense is already unlocked.")
            now=datetime.now().isoformat(timespec="seconds"); action="Locked" if locked else "Unlocked"
            expense.locked=locked; expense.locked_at=now if locked else None; expense.lock_reason=reason if locked else ""
            expense_lock_events.append({"id":str(uuid4()),"expense_id":expense.id,"apartment_id":expense.apartment_id,"month_key":expense.month_key,"category":expense.category,"description":expense.description,"amount":expense.amount,"action":action,"justification":reason,"at":now,"by_user_id":actor.id,"by_username":actor.username})
            _audit(actor.username,"Success",f"Expense {action}",f"{expense.category}; {expense.month_key}; {reason}",actor.id)
            _save_state()
            return expense
    raise HTTPException(status_code=404,detail="Expense not found")

# ---------- Settings / Operational Defaults ----------
@app.get("/settings/charges", response_model=ChargeSettings)
def get_charge_settings(apartment_id: str = "demo-apartment"):
    return charge_settings.get(apartment_id, ChargeSettings(apartment_id=apartment_id))

@app.get("/settings/charges/effective")
def get_effective_charge_settings(month_key: str, apartment_id: str = "demo-apartment"):
    if not month_key_valid(month_key):
        raise HTTPException(status_code=400, detail="Month must be YYYY-MM")
    maint,cca,effective=effective_charge_defaults(apartment_id,month_key)
    return {"tenant_id":apartment_id,"apartment_id":apartment_id,"month_key":month_key,"common_maintenance":maint,"cca":cca,"effective_month":effective}

@app.get("/settings/charge-history", response_model=list[ChargeHistory])
def get_charge_history(apartment_id: str = "demo-apartment"):
    return sorted([h for h in charge_history if h.apartment_id==apartment_id], key=lambda h:(h.effective_month,h.version,h.changed_at), reverse=True)

@app.put("/settings/charges", response_model=ChargeSettings)
def save_charge_settings(data: ChargeSettings, effective_month: str = "", x_apartcare_token: str | None = Header(default=None)):
    actor=_require_role(x_apartcare_token,{"Admin"})
    apartment_id=_actor_apartment_id(actor)
    data.apartment_id=apartment_id; data.tenant_id=apartment_id
    if effective_month and not month_key_valid(effective_month):
        raise HTTPException(status_code=400, detail="Effective Month must be YYYY-MM")
    effective_month=effective_month or date.today().strftime("%Y-%m")
    existing = charge_settings.get(apartment_id)
    if existing and not data.apartment_photo_path:
        data.apartment_photo_name = existing.apartment_photo_name
        data.apartment_photo_path = existing.apartment_photo_path
    charge_settings[apartment_id] = data
    versions=[h.version for h in charge_history if h.apartment_id==apartment_id and h.effective_month==effective_month]
    now=datetime.now().isoformat(timespec="microseconds")
    charge_history.append(ChargeHistory(id=str(uuid4()),tenant_id=apartment_id,apartment_id=apartment_id,effective_month=effective_month,common_maintenance=data.common_maintenance,cca=data.cca,version=max(versions,default=0)+1,action="Saved",changed_at=now,changed_by=actor.username))
    ensure_watchman_expense(apartment_id, date.today().strftime("%Y-%m"))
    _save_state()
    return data

@app.post("/settings/apartment-photo", response_model=ChargeSettings)
def save_apartment_photo(data: ApartmentPhotoInput, x_apartcare_token: str | None = Header(default=None)):
    _require_role(x_apartcare_token,{"Admin"})
    try:
        encoded = data.photo_data_url.split(",", 1)[1] if "," in data.photo_data_url else data.photo_data_url
        raw = base64.b64decode(encoded)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid apartment profile photo.")
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Apartment profile photo must be 5 MB or smaller.")
    suffix = Path(data.photo_name).suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(status_code=400, detail="Use JPG, PNG or WEBP for the apartment profile photo.")
    safe_name = f"apartment_{data.apartment_id}{suffix}"
    if os.getenv('BLOB_READ_WRITE_TOKEN') and BlobClient is not None:
        try:
            client = BlobClient()
            client.put(f"apartcare/apartments/{safe_name}", raw, access="private", overwrite=True)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Unable to store apartment logo in production storage: {exc}")
    else:
        target = UPLOAD_DIR / safe_name
        target.write_bytes(raw)
    settings = charge_settings.get(data.apartment_id, ChargeSettings(apartment_id=data.apartment_id))
    settings.apartment_photo_name = data.photo_name
    settings.apartment_photo_path = f"/uploads/{safe_name}"
    charge_settings[data.apartment_id] = settings
    return settings

@app.get("/uploads/{filename}")
async def serve_uploaded_file(filename: str):
    """Serve tenant-uploaded files from Vercel Blob in production, or local disk in development."""
    safe_name = Path(filename).name
    if safe_name != filename or not safe_name:
        raise HTTPException(status_code=400, detail="Invalid file name.")
    if os.getenv('BLOB_READ_WRITE_TOKEN') and AsyncBlobClient is not None:
        try:
            client = AsyncBlobClient()
            prefix = "apartcare/expenses/" if safe_name.startswith("expense_") else "apartcare/apartments/"
            result = await client.get(prefix + safe_name, access="private")
            if result is None or result.status_code != 200:
                raise HTTPException(status_code=404, detail="Uploaded file not found.")
            media_type = result.blob.content_type or "application/octet-stream"
            return StreamingResponse(result.stream, media_type=media_type, headers={"Content-Disposition": result.blob.content_disposition or "inline"})
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=404, detail=f"Uploaded file is unavailable: {exc}")
    target = UPLOAD_DIR / safe_name
    if not target.exists():
        raise HTTPException(status_code=404, detail="Uploaded file not found.")
    return FileResponse(target)

# ---------- Settings: Watchman and Go-Live ----------
@app.get("/settings/watchmen", response_model=list[Watchman])
def list_watchmen(apartment_id: str = "demo-apartment", include_deleted: bool = False):
    return [w for w in watchmen if w.apartment_id == apartment_id and (include_deleted or not w.deleted)]

@app.post("/settings/watchmen", response_model=Watchman, status_code=201)
def create_watchman(data: WatchmanInput, x_apartcare_token: str | None = Header(default=None)):
    _require_write_role(x_apartcare_token)
    row = Watchman(id=str(uuid4()), **data.model_dump())
    watchmen.append(row)
    watchman_history.append({"watchman_id": row.id, "action": "Created", "at": datetime.now().isoformat(timespec="seconds"), "data": row.model_dump()})
    _save_state()
    return row

@app.put("/settings/watchmen/{watchman_id}", response_model=Watchman)
def update_watchman(watchman_id: str, data: WatchmanInput, x_apartcare_token: str | None = Header(default=None)):
    actor = _require_write_role(x_apartcare_token)
    tenant_id = _actor_apartment_id(actor)
    for i,w in enumerate(watchmen):
        if w.id == watchman_id and w.apartment_id == tenant_id and not w.deleted:
            if w.locked:
                raise HTTPException(status_code=409, detail="Watchman record is locked. Unlock before changing details.")
            updated = Watchman(id=w.id, deleted=w.deleted, deleted_at=w.deleted_at, deleted_reason=w.deleted_reason, **data.model_dump())
            watchmen[i]=updated
            watchman_history.append({"watchman_id": w.id, "action": "Updated", "at": datetime.now().isoformat(timespec="seconds"), "data": updated.model_dump()})
            _save_state()
            return updated
    raise HTTPException(status_code=404, detail="Watchman not found")

@app.post("/settings/watchmen/{watchman_id}/lock", response_model=Watchman)
def lock_watchman(watchman_id: str, locked: bool = True, reason: str = "", x_apartcare_token: str | None = Header(default=None)):
    actor = _require_role(x_apartcare_token,{"Admin"})
    tenant_id = _actor_apartment_id(actor)
    reason=" ".join(str(reason or "").strip().split())
    if len(reason) < 3:
        raise HTTPException(status_code=422, detail="Lock/unlock justification is mandatory (minimum 3 characters).")
    for w in watchmen:
        if w.id == watchman_id and w.apartment_id == tenant_id and not w.deleted:
            w.locked = locked
            watchman_history.append({"watchman_id": w.id, "action": "Locked" if locked else "Unlocked", "at": datetime.now().isoformat(timespec="seconds"), "justification": reason, "changed_by": actor.username, "data": w.model_dump()})
            _save_state()
            return w
    raise HTTPException(status_code=404, detail="Watchman not found")

@app.delete("/settings/watchmen/{watchman_id}")
def soft_delete_watchman(watchman_id: str, reason: str = "Soft deleted by user", x_apartcare_token: str | None = Header(default=None)):
    actor = _require_role(x_apartcare_token,{"Admin"})
    tenant_id = _actor_apartment_id(actor)
    for w in watchmen:
        if w.id == watchman_id and w.apartment_id == tenant_id and not w.deleted:
            w.deleted=True; w.deleted_at=datetime.now().isoformat(timespec="seconds"); w.deleted_reason=reason
            watchman_history.append({"watchman_id": w.id, "action": "Soft Deleted", "at": w.deleted_at, "data": w.model_dump()})
            _save_state()
            return {"deleted": True, "soft_delete": True}
    raise HTTPException(status_code=404, detail="Watchman not found")

@app.get("/settings/watchmen/history")
def get_watchman_history(apartment_id: str = "demo-apartment"):
    ids={w.id for w in watchmen if w.apartment_id==apartment_id}
    return [h for h in watchman_history if h["watchman_id"] in ids]

DEFAULT_UTILITY_CATEGORIES = ["Plumber", "Electrician", "Carpenter", "Police", "Power FOC", "Others"]

def _ensure_utility_categories():
    if utility_categories:
        return
    now=datetime.now().isoformat(timespec="seconds")
    for name in DEFAULT_UTILITY_CATEGORIES:
        row=UtilityCategory(id=f"UTC-{uuid4()}", apartment_id="demo-apartment", name=name, active=True, created_at=now, updated_at=now, created_by="system")
        utility_categories.append(row)

def _active_utility_category_names(apartment_id="demo-apartment"):
    _ensure_utility_categories()
    return {c.name.casefold(): c.name for c in utility_categories if c.apartment_id==apartment_id and c.active}

def _utility_actor(x_apartcare_token: str | None) -> AdminUser:
    return _current_actor(x_apartcare_token)

def _actor_apartment_id(actor: AdminUser) -> str:
    # tenant_id is the canonical apartment namespace. Fail closed rather than
    # silently falling back to another property's legacy/demo namespace.
    tenant = str(getattr(actor, "tenant_id", "") or "").strip()
    if not tenant:
        raise HTTPException(status_code=403, detail="Authenticated user has no tenant_id.")
    return tenant

def _require_utility_edit_role(x_apartcare_token: str | None) -> AdminUser:
    """Utilities are fully editable by property Admin and Viewer; Platform Owner audit/support is read-only."""
    if _is_platform_support_token(x_apartcare_token):
        raise HTTPException(status_code=403, detail="Platform Owner Audit/Support access is read-only.")
    user = _current_actor(x_apartcare_token)
    role = str(user.role or '').strip().casefold()
    if role not in {"admin", "viewer"}:
        raise HTTPException(status_code=403, detail="Utilities are editable only by Admin or Viewer.")
    return user

@app.get("/utilities/categories", response_model=list[UtilityCategory])
def get_utility_categories(x_apartcare_token: str | None = Header(default=None)):
    actor=_utility_actor(x_apartcare_token)
    apartment_id=_actor_apartment_id(actor)
    _ensure_utility_categories()
    return sorted([c for c in utility_categories if c.apartment_id==apartment_id], key=lambda x:(not x.active, x.name.lower()))

@app.post("/utilities/categories", response_model=UtilityCategory, status_code=201)
def create_utility_category(data: UtilityCategoryInput, x_apartcare_token: str | None = Header(default=None)):
    actor=_require_utility_edit_role(x_apartcare_token)
    apartment_id=_actor_apartment_id(actor)
    _ensure_utility_categories()
    name=" ".join(data.name.strip().split())
    if not name: raise HTTPException(status_code=422, detail="Category name is required.")
    existing=next((c for c in utility_categories if c.apartment_id==apartment_id and c.name.casefold()==name.casefold()),None)
    if existing:
        if not existing.active and str(actor.role or "").strip().casefold()=="admin":
            existing.active=True; existing.updated_at=datetime.now().isoformat(timespec="seconds")
            utility_category_history.append(UtilityCategoryHistory(id=str(uuid4()),category_id=existing.id,apartment_id=existing.apartment_id,action="Reactivated",name=existing.name,changed_at=existing.updated_at,changed_by=actor.username))
            _save_state(); return existing
        raise HTTPException(status_code=409, detail="Utility category already exists.")
    now=datetime.now().isoformat(timespec="seconds")
    row=UtilityCategory(id=f"UTC-{uuid4()}",apartment_id=apartment_id,name=name,active=True,created_at=now,updated_at=now,created_by=actor.username)
    utility_categories.append(row)
    utility_category_history.append(UtilityCategoryHistory(id=str(uuid4()),category_id=row.id,apartment_id=row.apartment_id,action="Created",name=row.name,changed_at=now,changed_by=actor.username))
    _save_state(); return row

@app.put("/utilities/categories/{category_id}", response_model=UtilityCategory)
def update_utility_category(category_id: str, data: UtilityCategoryInput, x_apartcare_token: str | None = Header(default=None)):
    actor=_require_utility_edit_role(x_apartcare_token)
    _ensure_utility_categories()
    row=next((c for c in utility_categories if c.id==category_id and c.apartment_id==_actor_apartment_id(actor)),None)
    if not row: raise HTTPException(status_code=404, detail="Utility category not found.")
    name=" ".join(data.name.strip().split())
    if not name: raise HTTPException(status_code=422, detail="Category name is required.")
    dup=next((c for c in utility_categories if c.id!=category_id and c.apartment_id==row.apartment_id and c.name.casefold()==name.casefold()),None)
    if dup: raise HTTPException(status_code=409, detail="Utility category already exists.")
    old=row.name; row.name=name; row.updated_at=datetime.now().isoformat(timespec="seconds")
    utility_category_history.append(UtilityCategoryHistory(id=str(uuid4()),category_id=row.id,apartment_id=row.apartment_id,action="Updated",name=f"{old} -> {name}",changed_at=row.updated_at,changed_by=actor.username))
    _save_state(); return row

@app.post("/utilities/categories/{category_id}/deactivate", response_model=UtilityCategory)
def deactivate_utility_category(category_id: str, x_apartcare_token: str | None = Header(default=None)):
    actor=_require_utility_edit_role(x_apartcare_token)
    row=next((c for c in utility_categories if c.id==category_id and c.apartment_id==_actor_apartment_id(actor)),None)
    if not row: raise HTTPException(status_code=404, detail="Utility category not found.")
    row.active=False; row.updated_at=datetime.now().isoformat(timespec="seconds")
    utility_category_history.append(UtilityCategoryHistory(id=str(uuid4()),category_id=row.id,apartment_id=row.apartment_id,action="Deactivated",name=row.name,changed_at=row.updated_at,changed_by=actor.username))
    _save_state(); return row

@app.get("/utilities/categories/history", response_model=list[UtilityCategoryHistory])
def get_utility_category_history(x_apartcare_token: str | None = Header(default=None)):
    _utility_actor(x_apartcare_token); _ensure_utility_categories(); return sorted(utility_category_history,key=lambda x:x.changed_at,reverse=True)

@app.get("/utilities/contacts", response_model=list[UtilityContact])
def get_utility_contacts(x_apartcare_token: str | None = Header(default=None)):
    actor=_utility_actor(x_apartcare_token)
    apartment_id=_actor_apartment_id(actor)
    return sorted([x for x in utility_contacts if x.apartment_id==apartment_id and not x.deleted], key=lambda x:(x.category.lower(), x.name.lower()))

@app.post("/utilities/contacts", response_model=UtilityContact, status_code=201)
def create_utility_contact(data: UtilityContactInput, x_apartcare_token: str | None = Header(default=None)):
    actor=_require_utility_edit_role(x_apartcare_token)
    apartment_id=_actor_apartment_id(actor)
    allowed=_active_utility_category_names(apartment_id)
    if data.category.casefold() not in allowed: raise HTTPException(status_code=422, detail="Select an active Utility category.")
    data.category=allowed[data.category.casefold()]
    now=datetime.now().isoformat(timespec="seconds")
    mobile="".join(ch for ch in data.mobile_no.strip() if ch.isdigit() or ch=="+")
    if len([c for c in mobile if c.isdigit()]) < 7:
        raise HTTPException(status_code=422, detail="Enter a valid mobile number.")
    row=UtilityContact(id=f"UTL-{uuid4()}", apartment_id=apartment_id, category=data.category, name=data.name.strip(), mobile_no=mobile, remarks=data.remarks.strip(), created_at=now, updated_at=now)
    utility_contacts.append(row)
    utility_contact_history.append(UtilityContactHistory(id=str(uuid4()),utility_contact_id=row.id,apartment_id=row.apartment_id,action="Created",category=row.category,name=row.name,mobile_no=row.mobile_no,remarks=row.remarks,changed_at=now,changed_by=actor.username))
    _save_state()
    return row

@app.put("/utilities/contacts/{contact_id}", response_model=UtilityContact)
def update_utility_contact(contact_id: str, data: UtilityContactInput, x_apartcare_token: str | None = Header(default=None)):
    actor=_require_utility_edit_role(x_apartcare_token)
    apartment_id=_actor_apartment_id(actor)
    allowed=_active_utility_category_names(apartment_id)
    if data.category.casefold() not in allowed: raise HTTPException(status_code=422, detail="Select an active Utility category.")
    data.category=allowed[data.category.casefold()]
    row=next((x for x in utility_contacts if x.id==contact_id and x.apartment_id==apartment_id and not x.deleted),None)
    if not row: raise HTTPException(status_code=404, detail="Utility contact not found.")
    mobile="".join(ch for ch in data.mobile_no.strip() if ch.isdigit() or ch=="+")
    if len([c for c in mobile if c.isdigit()]) < 7: raise HTTPException(status_code=422, detail="Enter a valid mobile number.")
    row.category=data.category; row.name=data.name.strip(); row.mobile_no=mobile; row.remarks=data.remarks.strip(); row.updated_at=datetime.now().isoformat(timespec="seconds")
    utility_contact_history.append(UtilityContactHistory(id=str(uuid4()),utility_contact_id=row.id,apartment_id=row.apartment_id,action="Updated",category=row.category,name=row.name,mobile_no=row.mobile_no,remarks=row.remarks,changed_at=row.updated_at,changed_by=actor.username))
    _save_state(); return row

@app.delete("/utilities/contacts/{contact_id}")
def delete_utility_contact(contact_id: str, x_apartcare_token: str | None = Header(default=None)):
    # Utilities are fully editable by Admin and Viewer.
    actor=_require_utility_edit_role(x_apartcare_token)
    apartment_id=_actor_apartment_id(actor)
    row=next((x for x in utility_contacts if x.id==contact_id and x.apartment_id==apartment_id and not x.deleted),None)
    if not row: raise HTTPException(status_code=404, detail="Utility contact not found.")
    now=datetime.now().isoformat(timespec="seconds"); row.deleted=True; row.updated_at=now
    utility_contact_history.append(UtilityContactHistory(id=str(uuid4()),utility_contact_id=row.id,apartment_id=row.apartment_id,action="Deleted",category=row.category,name=row.name,mobile_no=row.mobile_no,remarks=row.remarks,changed_at=now,changed_by=actor.username))
    _save_state(); return {"message":"Utility contact deleted. History retained."}

@app.get("/utilities/contacts/history", response_model=list[UtilityContactHistory])
def get_utility_contact_history(x_apartcare_token: str | None = Header(default=None)):
    actor=_utility_actor(x_apartcare_token)
    apartment_id=_actor_apartment_id(actor)
    return sorted([x for x in utility_contact_history if x.apartment_id==apartment_id], key=lambda x:x.changed_at, reverse=True)


def _latest_locked_opening(apartment_id: str):
    """Return the latest locked Go-Live baseline. Never use an unlocked/editing version."""
    candidates = [
        h for h in opening_balance_history
        if h.apartment_id == apartment_id and h.action == "Locked"
    ]
    if candidates:
        # History is append-only; the last Locked record is the authoritative
        # latest version. Do not rely on second-level timestamps, because two
        # successive saves/locks can legitimately occur within the same second.
        latest = candidates[-1]
        return latest.go_live_month, float(latest.opening_balance)
    row = opening_balances.get(apartment_id)
    if row and row.locked:
        return row.go_live_month, float(row.opening_balance)
    return None, 0.0


def _effective_operational_start_month(apartment_id: str) -> str:
    """Return the tenant operational start month only from the latest locked
    Go-Live Opening Balance. An unlocked/new tenant has no artificial minimum.
    """
    candidates = [
        h for h in opening_balance_history
        if h.apartment_id == apartment_id and h.action == "Locked"
    ]
    if candidates:
        return candidates[-1].go_live_month
    row = opening_balances.get(apartment_id)
    if row and row.locked:
        return row.go_live_month
    return ""

def _account_payload(account) -> dict:
    """Return an account payload with the effective operational start month.

    The persisted legacy data_start_month field is retained for compatibility,
    but the active operational restriction is authoritative from the locked
    Opening Balance time dimension.
    """
    payload = account.model_dump()
    payload["data_start_month"] = _effective_operational_start_month(account.tenant_id)
    return payload

def _financial_month_values(apartment_id: str, month_key: str):
    """Canonical apartment cash-flow calculation used by Dashboard and Reports.

    The Settings Opening Balance is seeded once in the Go-Live month. Every later
    month starts from the immediately preceding month's closing balance. Activity
    before the configured Go-Live month is excluded from the rolling baseline.
    """
    if not month_key_valid(month_key):
        raise HTTPException(status_code=400, detail="Month must be YYYY-MM")
    go_live_month, opening = _latest_locked_opening(apartment_id)
    if not go_live_month:
        return {"month_key": month_key, "go_live_month": None, "opening_balance": 0.0,
                "collected": 0.0, "expenses": 0.0, "difference": 0.0, "closing_balance": 0.0,
                "is_before_go_live": True}
    if month_key < go_live_month:
        return {"month_key": month_key, "go_live_month": go_live_month, "opening_balance": 0.0,
                "collected": 0.0, "expenses": 0.0, "difference": 0.0, "closing_balance": 0.0,
                "is_before_go_live": True}

    start_y, start_m = map(int, go_live_month.split("-"))
    target_y, target_m = map(int, month_key.split("-"))
    months = []
    y, m = start_y, start_m
    while (y, m) <= (target_y, target_m):
        months.append(f"{y:04d}-{m:02d}")
        m += 1
        if m == 13:
            y += 1; m = 1

    balance = float(opening)
    first = True
    for key in months:
        ensure_watchman_expense(apartment_id, key)
        collected = round(sum(p.paid_amount for p in payments
                              if p.apartment_id == apartment_id and p.month_key == key), 2)
        expenses_total = round(sum(e.amount for e in expenses
                                   if e.apartment_id == apartment_id and e.month_key == key and expense_is_countable(e)), 2)
        net = round(collected - expenses_total, 2)
        month_opening = balance
        balance = round(balance + net, 2)
        if key == month_key:
            return {"month_key": key, "go_live_month": go_live_month,
                    "opening_balance": round(month_opening, 2), "collected": collected,
                    "expenses": expenses_total, "difference": net,
                    "closing_balance": round(balance, 2), "is_before_go_live": False}
        first = False
    return {"month_key": month_key, "go_live_month": go_live_month, "opening_balance": round(balance, 2),
            "collected": 0.0, "expenses": 0.0, "difference": 0.0, "closing_balance": round(balance, 2),
            "is_before_go_live": False}


def _financial_period_values(apartment_id: str, year: str):
    """Return canonical rolling balances for all 12 months of a year."""
    if not (len(year) == 4 and year.isdigit()):
        raise HTTPException(status_code=400, detail="Year must be YYYY")
    rows = [_financial_month_values(apartment_id, f"{year}-{m:02d}") for m in range(1, 13)]
    active = [r for r in rows if not r["is_before_go_live"]]
    total_collected = round(sum(r["collected"] for r in active), 2)
    total_expenses = round(sum(r["expenses"] for r in active), 2)
    return rows, total_collected, total_expenses

@app.get("/settings/opening-balance", response_model=OpeningBalance | None)
def get_opening_balance(apartment_id: str = "demo-apartment"):
    return opening_balances.get(apartment_id)

@app.post("/settings/opening-balance", response_model=OpeningBalance)
def save_opening_balance(data: OpeningBalanceInput, x_apartcare_token: str | None = Header(default=None)):
    actor = _require_role(x_apartcare_token,{"Admin"})
    apartment_id = _actor_apartment_id(actor)
    if not month_key_valid(data.go_live_month):
        raise HTTPException(status_code=400, detail="Go-Live Month must be YYYY-MM")
    existing=opening_balances.get(apartment_id)
    if existing and existing.locked:
        raise HTTPException(status_code=409, detail="Go-Live Opening Balance is locked and cannot be changed.")
    row=OpeningBalance(id=existing.id if existing else str(uuid4()), apartment_id=apartment_id, go_live_month=data.go_live_month, opening_balance=data.opening_balance, locked=False, saved_at=datetime.now().isoformat(timespec="seconds"))
    opening_balances[apartment_id]=row
    opening_balance_history.append(OpeningBalanceHistory(id=str(uuid4()), apartment_id=apartment_id, go_live_month=row.go_live_month, opening_balance=row.opening_balance, action="Created" if not existing else "Updated", changed_at=row.saved_at, changed_by=actor.username))
    _save_state(); return row

@app.post("/settings/opening-balance/unlock", response_model=OpeningBalance)
def unlock_opening_balance(justification: str = Body(..., embed=True), x_apartcare_token: str | None = Header(default=None)):
    actor=_require_role(x_apartcare_token,{"Admin"})
    apartment_id = _actor_apartment_id(actor)
    justification=" ".join(str(justification or "").strip().split())
    if len(justification) < 5: raise HTTPException(status_code=422, detail="Unlock justification is mandatory (minimum 5 characters).")
    row=opening_balances.get(apartment_id)
    if not row: raise HTTPException(status_code=404, detail="Go-Live Opening Balance is not configured.")
    if not row.locked: return row
    row.locked=False
    changed_at=datetime.now().isoformat(timespec="seconds")
    opening_balance_history.append(OpeningBalanceHistory(id=str(uuid4()),apartment_id=row.apartment_id,go_live_month=row.go_live_month,opening_balance=row.opening_balance,action="Unlocked for Admin Edit",changed_at=changed_at,justification=justification,changed_by=actor.username))
    _audit(actor.username,"Success","Go-Live Opening Balance Unlock",f"Unlocked {row.go_live_month}; {row.opening_balance}; {justification}",actor.id)
    _save_state(); return row

@app.post("/settings/opening-balance/lock", response_model=OpeningBalance)
def lock_opening_balance(justification: str = Body(..., embed=True), x_apartcare_token: str | None = Header(default=None)):
    actor=_require_role(x_apartcare_token,{"Admin"})
    apartment_id = _actor_apartment_id(actor)
    justification=" ".join(str(justification or "").strip().split())
    if len(justification) < 5: raise HTTPException(status_code=422, detail="Lock justification is mandatory (minimum 5 characters).")
    row=opening_balances.get(apartment_id)
    if not row: raise HTTPException(status_code=404, detail="Save Go-Live Opening Balance first")
    row.locked=True
    changed_at=datetime.now().isoformat(timespec="microseconds")
    opening_balance_history.append(OpeningBalanceHistory(id=str(uuid4()), apartment_id=apartment_id, go_live_month=row.go_live_month, opening_balance=row.opening_balance, action="Locked", changed_at=changed_at, justification=justification, changed_by=actor.username))
    _audit(actor.username,"Success","Go-Live Opening Balance Lock",f"Locked {row.go_live_month}; {row.opening_balance}; {justification}",actor.id)
    _save_state(); return row

@app.get("/settings/opening-balance/history", response_model=list[OpeningBalanceHistory])
def get_opening_balance_history(apartment_id: str = "demo-apartment"):
    return [h for h in opening_balance_history if h.apartment_id==apartment_id]

# ---------- Yearly Expense Reporting ----------
@app.get("/expenses/yearly-summary")
def yearly_expense_summary(year: str, apartment_id: str = "demo-apartment"):
    if not (len(year) == 4 and year.isdigit()):
        raise HTTPException(status_code=400, detail="Year must be YYYY")
    months = [f"{year}-{i:02d}" for i in range(1, 13)]
    rows = [e for e in expenses if e.apartment_id == apartment_id and e.month_key.startswith(f"{year}-") and expense_is_countable(e)]
    categories = sorted({e.category for e in rows})
    monthly = []
    matrix = {c: {m: 0.0 for m in months} for c in categories}
    for m in months:
        mr = [e for e in rows if e.month_key == m]
        monthly.append({"month_key": m, "month": m[-2:], "total_expenses": round(sum(e.amount for e in mr), 2), "status": "Open"})
        for e in mr:
            matrix[e.category][m] = round(matrix[e.category][m] + e.amount, 2)
    matrix_rows = []
    for c in categories:
        values = [round(matrix[c][m], 2) for m in months]
        matrix_rows.append({"category": c, "months": values, "total": round(sum(values), 2)})
    return {
        "year": year,
        "year_total_expenses": round(sum(e.amount for e in rows), 2),
        "active_categories": len(categories),
        "months_with_expenses": sum(1 for r in monthly if r["total_expenses"] > 0),
        "monthly": monthly,
        "matrix": matrix_rows,
        "category_totals": [{"category": c, "amount": round(sum(e.amount for e in rows if e.category == c), 2)} for c in categories],
    }

@app.get("/expenses/yearly-details")
def yearly_expense_details(year: str, category: str = "", apartment_id: str = "demo-apartment"):
    if not (len(year) == 4 and year.isdigit()):
        raise HTTPException(status_code=400, detail="Year must be YYYY")
    rows = [e for e in expenses if e.apartment_id == apartment_id and e.month_key.startswith(f"{year}-") and expense_is_countable(e)]
    if category:
        rows = [e for e in rows if e.category == category]
    rows.sort(key=lambda e: (e.expense_date, e.category, e.description))
    return [e.model_dump() for e in rows]

# ---------- Reports ----------
@app.get("/reports/all-flats-monthly")
def all_flats_monthly_report(month_key: str, apartment_id: str = "demo-apartment"):
    rows = get_month_rows(apartment_id, month_key)
    return {"month_key": month_key, "rows": [r.model_dump() for r in rows], "totals": {"maintenance": round(sum(r.maintenance for r in rows),2), "cca": round(sum(r.cca for r in rows),2), "diesel": round(sum(r.diesel for r in rows),2), "water_units": round(sum(r.water_units for r in rows),2), "water": round(sum(r.water_amount for r in rows),2), "total": round(sum(r.rounded_total for r in rows),2)}}

@app.get("/reports/yearly-collection-expenses")
def yearly_collection_expenses(year: str, apartment_id: str = "demo-apartment"):
    normalize_payments()
    rows, total_collected, total_expenses = _financial_period_values(apartment_id, year)
    active_rows = [r for r in rows if not r["is_before_go_live"]]
    opening_at_period_start = round(active_rows[0]["opening_balance"], 2) if active_rows else 0.0
    closing_at_period_end = round(active_rows[-1]["closing_balance"], 2) if active_rows else 0.0
    return {
        "year": year,
        "go_live_month": active_rows[0]["go_live_month"] if active_rows else None,
        "opening_balance": opening_at_period_start,
        "rows": rows,
        "total_collected": total_collected,
        "total_expenses": total_expenses,
        "difference": round(total_collected-total_expenses,2),
        "closing_balance": closing_at_period_end
    }

@app.get("/reports/flats")
def report_flats(apartment_id: str = "demo-apartment"):
    # Reports must include flats that exist in current residents as well as historical
    # maintenance/payment data. This prevents the report drop-down from becoming empty
    # when a resident was moved/deactivated but the flat still has financial history.
    flats = {r.flat_no for r in residents if r.apartment_id == apartment_id}
    flats |= {h.flat_no for h in flat_history if h.apartment_id == apartment_id}
    flats |= {r.flat_no for r in maintenance_rows if r.apartment_id == apartment_id}
    flats |= {p.flat_no for p in payments if p.apartment_id == apartment_id}
    return sorted(x for x in flats if x)

@app.get("/reports/flat-statement")
def flat_statement(flat_no: str, apartment_id: str = "demo-apartment"):
    normalize_payments()
    resident_hist=[h.model_dump() for h in flat_history if h.apartment_id==apartment_id and h.flat_no==flat_no]
    bills=[{"month_key":r.month_key,"type":"Maintenance","amount":r.rounded_total,"description":"Monthly maintenance bill"} for r in maintenance_rows if r.apartment_id==apartment_id and r.flat_no==flat_no]
    pays=[{"month_key":p.month_key,"type":"Payment","amount":p.paid_amount,"description":f"Payment via {p.payment_mode}","reference":p.reference,"date":p.payment_date} for p in payments if p.apartment_id==apartment_id and p.flat_no==flat_no]
    ledger=sorted(bills+pays,key=lambda x:(x["month_key"], x["type"]))
    current = next((r for r in residents if r.apartment_id == apartment_id and r.flat_no == flat_no), None)
    latest = resident_hist[-1] if resident_hist else {}
    return {"flat_no":flat_no,"owner_name": (current.owner_name if current else latest.get("owner_name", "")),"resident_name": (current.resident_name if current else latest.get("resident_name", "")),"resident_history":resident_hist,"ledger":ledger}

@app.get("/reports/individual-maintenance")
def individual_maintenance_report(flat_no: str, apartment_id: str = "demo-apartment"):
    rows = [r for r in maintenance_rows if r.apartment_id == apartment_id and r.flat_no == flat_no]
    rows.sort(key=lambda r: r.month_key)
    return [r.model_dump() for r in rows]

@app.get("/reports/yearly-maintenance")
def yearly_maintenance_report(year: str, apartment_id: str = "demo-apartment"):
    if not (len(year) == 4 and year.isdigit()):
        raise HTTPException(status_code=400, detail="Year must be YYYY")
    rows = [r for r in maintenance_rows if r.apartment_id == apartment_id and r.month_key.startswith(f"{year}-")]
    rows.sort(key=lambda r: (r.month_key, r.flat_no))
    monthly = []
    for m in [f"{year}-{i:02d}" for i in range(1,13)]:
        mr=[r for r in rows if r.month_key==m]
        monthly.append({"month_key":m,"flats_count":len(mr),"total_maintenance":round(sum(r.rounded_total for r in mr),2)})
    return {"year":year,"monthly":monthly,"year_total":round(sum(r["total_maintenance"] for r in monthly),2)}


# ---------- Embedded Import Templates ----------
RESIDENT_TEMPLATE_NAME="ApartCare_Resident_Master_Import_Template.xlsx"
HISTORICAL_TEMPLATE_NAME="ApartCare_Historical_Monthly_Data_Import_Template.xlsx"

@app.get('/import/templates')
def list_import_templates():
    return {"version":"6.4.48","templates":[{"key":"resident-master","name":RESIDENT_TEMPLATE_NAME,"url":f"/templates/{RESIDENT_TEMPLATE_NAME}"},{"key":"historical-monthly","name":HISTORICAL_TEMPLATE_NAME,"url":f"/templates/{HISTORICAL_TEMPLATE_NAME}"}]}

@app.get('/import/templates/{template_key}')
def download_import_template(template_key: str):
    mapping={"resident-master":RESIDENT_TEMPLATE_NAME,"historical-monthly":HISTORICAL_TEMPLATE_NAME}; name=mapping.get(template_key)
    if not name: raise HTTPException(status_code=404,detail="Unknown import template.")
    path=TEMPLATE_DIR/name
    if not path.exists(): raise HTTPException(status_code=404,detail="Embedded template is not available in this application build.")
    return FileResponse(path,filename=name,media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

# ---------- Data Import ----------
def _clean_cell(v):
    return '' if v is None else str(v).strip()

def _num(v, field, row_no):
    try:
        return float(v or 0)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Row {row_no}: {field} must be numeric")

@app.post('/import/residents')
async def import_residents_excel(file: UploadFile = File(...), apartment_id: str = 'demo-apartment', x_apartcare_token: str | None = Header(default=None)):
    actor = _require_write_role(x_apartcare_token)
    if actor.tenant_id and apartment_id != actor.tenant_id:
        raise HTTPException(status_code=403, detail="Import target apartment does not match the logged-in account.")
    if not (file.filename or '').lower().endswith('.xlsx'):
        raise HTTPException(status_code=400, detail='Please upload an .xlsx Resident Master template.')
    wb=load_workbook(io.BytesIO(await file.read()), data_only=True)
    ws=wb[wb.sheetnames[0]]
    headers=[_clean_cell(c.value) for c in next(ws.iter_rows(min_row=1,max_row=1))]
    required=['Flat No*','Owner Name*','Resident Name*','Resident Type*','Mobile No*','Status*']
    if any(h not in headers for h in required):
        raise HTTPException(status_code=400, detail='Resident template headers do not match the ApartCare Resident Master template.')
    idx={h:i for i,h in enumerate(headers)}; added=updated=skipped=invalid=0; seen=set(); errors=[]
    for row_no,row in enumerate(ws.iter_rows(min_row=2,values_only=True),start=2):
        if not any(v not in (None,'') for v in row): continue
        flat=_clean_cell(row[idx['Flat No*']])
        owner=_clean_cell(row[idx['Owner Name*']]); resident=_clean_cell(row[idx['Resident Name*']])
        typ=_clean_cell(row[idx['Resident Type*']]); mobile=_clean_cell(row[idx['Mobile No*']]); status=_clean_cell(row[idx['Status*']])
        email=_clean_cell(row[idx.get('Email',-1)]) if 'Email' in idx else ''
        remarks=_clean_cell(row[idx.get('Remarks',-1)]) if 'Remarks' in idx else ''
        key=flat.lower()
        if not flat or not owner or not resident or typ not in ('Owner','Tenant') or not mobile or status not in ('Active','Inactive'):
            invalid+=1; errors.append(f'Row {row_no}: required fields or Resident Type/Status are invalid'); continue
        if key in seen:
            skipped+=1; continue
        seen.add(key)
        existing=next((r for r in residents if r.apartment_id==apartment_id and r.flat_no.lower()==key),None)
        if existing:
            skipped+=1; continue
        r=Resident(id=str(uuid4()), apartment_id=apartment_id, flat_no=flat, owner_name=owner, resident_name=resident, resident_type=typ, mobile_no=mobile, email=email, status=status, remarks=remarks)
        residents.append(r); added+=1
        flat_history.append(FlatHistory(id=str(uuid4()), apartment_id=apartment_id, flat_no=flat, owner_name=owner, resident_name=resident, resident_type=typ, mobile_no=mobile, email=email, status=status, remarks=remarks, change_reason='Excel import'))
    return {'added':added,'updated':updated,'skipped':skipped,'invalid':invalid,'errors':errors[:20]}

@app.post('/import/monthly-maintenance')
async def import_monthly_maintenance_excel(file: UploadFile = File(...), apartment_id: str = 'demo-apartment', historical: bool = Form(False), x_apartcare_token: str | None = Header(default=None)):
    actor = _require_write_role(x_apartcare_token)
    if actor.tenant_id and apartment_id != actor.tenant_id:
        raise HTTPException(status_code=403, detail="Import target apartment does not match the logged-in account.")
    if not (file.filename or '').lower().endswith('.xlsx'):
        raise HTTPException(status_code=400, detail='Please upload the embedded ApartCare Historical Monthly Data template (.xlsx).')
    wb=load_workbook(io.BytesIO(await file.read()), data_only=True); ws=wb[wb.sheetnames[0]]
    headers=[_clean_cell(c.value) for c in next(ws.iter_rows(min_row=1,max_row=1))]
    expected=['Month* (YYYY-MM)','Flat No*','Resident Name*','Owner/Tenant','Country Code','Mobile','Email','Maintenance','CCA','Diesel','Other Charges','Previous Reading','Current Reading','Water Units','Water Amount','Total','Opening Balance','Rounded Total','Paid Amount','Paid Date (YYYY-MM-DD)','Payment Mode','Reference','Remarks']
    if headers[:len(expected)] != expected:
        raise HTTPException(status_code=400,detail='Historical Monthly Data headers do not match the embedded ApartCare template for this application version.')
    idx={h:i for i,h in enumerate(headers)}; added=skipped=invalid=payments_created=0; errors=[]; imported_months=set(); seen=set()
    def val(row,name,default=''):
        return row[idx[name]] if name in idx and idx[name]<len(row) else default
    for row_no,row in enumerate(ws.iter_rows(min_row=2,values_only=True),start=2):
        if not any(v not in (None,'') for v in row): continue
        mk=_clean_cell(val(row,'Month* (YYYY-MM)')); flat=_clean_cell(val(row,'Flat No*')); key=(mk,flat.lower())
        if not month_key_valid(mk) or not flat:
            invalid+=1; errors.append(f'Row {row_no}: invalid Month or Flat No'); continue
        if payment_month_lock(apartment_id, mk) and payment_month_lock(apartment_id, mk).get('locked'):
            raise HTTPException(status_code=409, detail=f'{mk} is globally locked. Unlock the month as Admin before importing historical maintenance/payment entries.')
        if key in seen or any(r.apartment_id==apartment_id and r.month_key==mk and r.flat_no.lower()==flat.lower() for r in maintenance_rows):
            skipped+=1; continue
        seen.add(key)
        try:
            resident_name=_clean_cell(val(row,'Resident Name*')); typ=_clean_cell(val(row,'Owner/Tenant')) or 'Owner'
            if not resident_name or typ not in ('Owner','Tenant'): raise ValueError('Resident Name and Owner/Tenant are required and valid')
            maint=_num(val(row,'Maintenance',0),'Maintenance',row_no); cca=_num(val(row,'CCA',0),'CCA',row_no); diesel=_num(val(row,'Diesel',0),'Diesel',row_no); other=_num(val(row,'Other Charges',0),'Other Charges',row_no)
            prev=_num(val(row,'Previous Reading',0),'Previous Reading',row_no); curr=_num(val(row,'Current Reading',prev),'Current Reading',row_no); units=_num(val(row,'Water Units',max(curr-prev,0)),'Water Units',row_no); water=_num(val(row,'Water Amount',0),'Water Amount',row_no)
            opening=_num(val(row,'Opening Balance',0),'Opening Balance',row_no); paid=_num(val(row,'Paid Amount',0),'Paid Amount',row_no)
            if min(maint,cca,diesel,other,prev,curr,units,water,opening,paid)<0 or curr<prev: raise ValueError('negative amount or Current Reading below Previous Reading')
            if paid>0:
                mode=_clean_cell(val(row,'Payment Mode','Cash')) or 'Cash'
                if mode not in ('Cash','UPI','Bank Transfer','Cheque','Other'): raise ValueError('Payment Mode must be Cash, UPI, Bank Transfer, Cheque or Other')
                paid_date=_clean_cell(val(row,'Paid Date (YYYY-MM-DD)',date.today().isoformat())) or date.today().isoformat(); date.fromisoformat(paid_date)
        except Exception as e:
            invalid+=1; errors.append(f'Row {row_no}: {e}'); continue
        total=round(maint+cca+diesel+other+water,2)
        rv=resident_version_for_month(apartment_id,flat,mk)
        existing_res=next((r for r in residents if r.apartment_id==apartment_id and r.flat_no.lower()==flat.lower()),None)
        if not existing_res:
            mobile=_clean_cell(val(row,'Mobile','Imported')) or 'Imported'; email=_clean_cell(val(row,'Email',''))
            r=Resident(id=str(uuid4()),version=1,apartment_id=apartment_id,flat_no=flat,owner_name=flat,resident_name=resident_name,resident_type=typ,mobile_no=mobile,email=email,status='Active',remarks='Created from historical maintenance import')
            residents.append(r)
            flat_history.append(FlatHistory(id=str(uuid4()),apartment_id=apartment_id,flat_no=flat,owner_name=flat,resident_name=resident_name,resident_type=typ,mobile_no=mobile,email=email,status='Active',remarks=r.remarks,effective_from=f'{mk}-01',version=1,change_reason='Historical maintenance import'))
            rv=1
        maintenance_rows.append(MaintenanceRow(id=str(uuid4()),apartment_id=apartment_id,month_key=mk,flat_no=flat,owner_name=existing_res.owner_name if existing_res else flat,resident_name=resident_name,resident_type=typ,maintenance=maint,cca=cca,diesel=diesel,other_charges=other,previous_reading=prev,current_reading=curr,water_units=units,water_rate=round(water/units,4) if units else 0,water_amount=water,total=total,rounded_total=round(total),remarks=_clean_cell(val(row,'Remarks')),resident_version=rv))
        if historical and paid>0:
            payments[:]=[p for p in payments if not (p.apartment_id==apartment_id and p.flat_no==flat and p.month_key==mk)]
            previous=previous_pending_balance(apartment_id,flat,mk); due=round(previous+total,2)
            if paid>due+0.0001:
                invalid+=1; errors.append(f'Row {row_no}: Paid Amount cannot exceed Amount Due of {due}'); maintenance_rows.pop(); continue
            payments.append(Payment(id=str(uuid4()),apartment_id=apartment_id,month_key=mk,flat_no=flat,owner_name=existing_res.owner_name if existing_res else flat,resident_name=resident_name,previous_balance=previous,current_month_total=total,amount_due=due,paid_amount=paid,pending_balance=max(0,round(due-paid,2)),payment_mode=mode,payment_date=paid_date,reference=_clean_cell(val(row,'Reference','')),remarks=_clean_cell(val(row,'Remarks','')))); payments_created+=1
        imported_months.add(mk); added+=1
    for mk in imported_months:
        rows=get_month_rows(apartment_id,mk); total_units=round(sum(r.water_units for r in rows),2); total_water=round(sum(r.water_amount for r in rows),2)
        water_headers[(apartment_id,mk)]=MonthWaterHeader(apartment_id=apartment_id,month_key=mk,water_mode='Meter',include_maintenance=True,include_cca=True,include_diesel=True,include_municipal_water=True,tanker_count=0,tanker_price=0,tanker_amount=0,municipal_bill=total_water,total_water_cost=total_water,water_rate=round(total_water/total_units,4) if total_units else 0,flats_count=len(rows),total_units=total_units)
    if imported_months:
        _save_state()
    return {'added':added,'skipped':skipped,'invalid':invalid,'payments_created':payments_created,'historical':historical,'months':sorted(imported_months),'errors':errors[:20]}

# ---------- Monthly Maintenance ----------
@app.get("/maintenance", response_model=list[MaintenanceRow])
def list_maintenance(month_key: str, apartment_id: str = "demo-apartment"):
    if not month_key_valid(month_key):
        raise HTTPException(status_code=400, detail="Month must be YYYY-MM")
    return get_month_rows(apartment_id, month_key)

@app.get("/maintenance/water-header", response_model=MonthWaterHeader | None)
def get_water_header(month_key: str, apartment_id: str = "demo-apartment"):
    return water_headers.get((apartment_id, month_key))

@app.post("/maintenance/generate", response_model=list[MaintenanceRow])
def generate_maintenance(data: MaintenanceGenerateInput, x_apartcare_token: str | None = Header(default=None)):
    _require_write_role(x_apartcare_token)
    if not month_key_valid(data.month_key):
        raise HTTPException(status_code=400, detail="Month must be YYYY-MM")
    ensure_global_month_editable(data.apartment_id, data.month_key)
    existing = get_month_rows(data.apartment_id, data.month_key)
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Maintenance records already exist for this month. Load and edit them instead of generating duplicates."
        )
    active = active_residents(data.apartment_id)
    if not active:
        raise HTTPException(status_code=400, detail="No active residents/flats found. Add residents first.")

    configured_flats = int(charge_settings.get(data.apartment_id, ChargeSettings(apartment_id=data.apartment_id)).no_of_flats or 0)
    diesel_divisor = len(active)
    diesel_per_flat = round(float(data.diesel) / diesel_divisor, 2) if diesel_divisor > 0 else 0.0

    for resident in active:
        previous = previous_current_reading(data.apartment_id, resident.flat_no, data.month_key)
        maintenance_rows.append(MaintenanceRow(
            id=str(uuid4()),
            apartment_id=data.apartment_id,
            month_key=data.month_key,
            flat_no=resident.flat_no,
            owner_name=resident.owner_name,
            resident_name=resident.resident_name,
            resident_type=resident.resident_type,
            maintenance=data.maintenance,
            cca=data.cca,
            diesel=diesel_per_flat,
            other_charges=data.other_charges,
            previous_reading=previous,
            current_reading=previous,
            water_units=0,
            water_rate=0,
            water_amount=0,
            total=0,
            rounded_total=0,
            remarks="",
            resident_version=getattr(resident,"version",1)
        ))

    water_headers[(data.apartment_id, data.month_key)] = MonthWaterHeader(
        apartment_id=data.apartment_id,
        month_key=data.month_key,
        water_mode=data.water_mode,
        include_maintenance=data.include_maintenance,
        include_cca=data.include_cca,
        include_diesel=data.include_diesel,
        include_municipal_water=data.include_municipal_water,
        tanker_count=data.tanker_count,
        tanker_price=data.tanker_price,
        tanker_amount=data.tanker_amount,
        municipal_bill=data.municipal_bill,
        total_water_cost=0,
        water_rate=0,
        flats_count=len(active),
        total_units=0
    )
    recalculate_month(data.apartment_id, data.month_key)
    _save_state()
    return get_month_rows(data.apartment_id, data.month_key)

@app.put("/maintenance/{maintenance_id}", response_model=MaintenanceRow)
def update_maintenance(maintenance_id: str, data: MaintenanceUpdate, x_apartcare_token: str | None = Header(default=None)):
    actor = _require_write_role(x_apartcare_token)
    tenant_id = _actor_apartment_id(actor)
    for row in maintenance_rows:
        if row.id == maintenance_id and row.apartment_id == tenant_id:
            ensure_global_month_editable(row.apartment_id, row.month_key)
            row.maintenance = data.maintenance
            row.cca = data.cca
            row.diesel = data.diesel
            row.other_charges = data.other_charges
            row.current_reading = data.current_reading
            row.remarks = data.remarks
            recalculate_month(row.apartment_id, row.month_key)
            _save_state()
            return row
    raise HTTPException(status_code=404, detail="Maintenance record not found")

@app.put("/maintenance/water-header/{month_key}", response_model=MonthWaterHeader)
def update_water_header(month_key: str, data: MaintenanceGenerateInput, x_apartcare_token: str | None = Header(default=None)):
    _require_write_role(x_apartcare_token)
    ensure_global_month_editable(data.apartment_id, month_key)
    key = (data.apartment_id, month_key)
    header = water_headers.get(key)
    if not header:
        raise HTTPException(status_code=404, detail="Generate monthly maintenance first")
    header.water_mode = data.water_mode
    header.include_maintenance = data.include_maintenance
    header.include_cca = data.include_cca
    header.include_diesel = data.include_diesel
    header.include_municipal_water = data.include_municipal_water
    header.tanker_count = data.tanker_count
    header.tanker_price = data.tanker_price
    header.tanker_amount = data.tanker_amount
    header.municipal_bill = data.municipal_bill
    rows = get_month_rows(data.apartment_id, month_key)
    configured_flats = int(charge_settings.get(data.apartment_id, ChargeSettings(apartment_id=data.apartment_id)).no_of_flats or 0)
    diesel_divisor = len(rows)
    diesel_per_flat = round(float(data.diesel) / diesel_divisor, 2) if diesel_divisor > 0 else 0.0
    for row in rows:
        row.diesel = diesel_per_flat
    recalculate_month(data.apartment_id, month_key)
    _save_state()
    return header

@app.get("/maintenance/summary")
def maintenance_summary(month_key: str, apartment_id: str = "demo-apartment"):
    rows = get_month_rows(apartment_id, month_key)
    header = water_headers.get((apartment_id, month_key))
    return {
        "month_key": month_key,
        "flats_count": len(rows),
        "common_maintenance_total": round(sum(r.maintenance for r in rows), 2),
        "maintenance_total": round(sum(r.rounded_total for r in rows), 2),
        "cca_total": round(sum(r.cca for r in rows), 2),
        "diesel_total": round(sum(r.diesel for r in rows), 2),
        "other_total": round(sum(r.other_charges for r in rows), 2),
        "water_total": round(sum(r.water_amount for r in rows), 2),
        "grand_total": round(sum(r.rounded_total for r in rows), 2),
        "water_header": header,
    }

# ---------- Administration / Authentication ----------
def _user_tenant_id(user_id: str | None) -> str:
    if not user_id:
        return ""
    user = next((u for u in admin_users if u.id == user_id), None)
    if user and getattr(user, "tenant_id", ""):
        return str(user.tenant_id)
    for tid, users in tenant_users.items():
        if any(u.id == user_id for u in users):
            return str(tid)
    return ""

def _audit(username: str, status: str, event: str, reason: str = "", user_id: str | None = None, tenant_id: str | None = None):
    resolved_tenant = str(tenant_id or _user_tenant_id(user_id) or "")
    login_history.append(LoginAttempt(id=str(uuid4()), username=username, user_id=user_id, tenant_id=resolved_tenant, status=status, event=event, at=datetime.now().isoformat(timespec="seconds"), reason=reason))

def _password_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

COUNTRY_CODE_MAP={"India":"IN","United States":"US","United Kingdom":"GB","Canada":"CA","Australia":"AU","Singapore":"SG","United Arab Emirates":"AE"}
STATE_CODE_MAP={"Andhra Pradesh":"AP","Karnataka":"KA","Tamil Nadu":"TN","Telangana":"TS","Maharashtra":"MH","Delhi":"DL","West Bengal":"WB","Kerala":"KL","Odisha":"OD","Gujarat":"GJ","Rajasthan":"RJ","Punjab":"PB","Haryana":"HR","Bihar":"BR","Jharkhand":"JH","Chhattisgarh":"CG","Goa":"GA","Assam":"AS"}

def _code(value,mapping,fallback="XX"):
    raw=(value or "").strip()
    if raw in mapping:return mapping[raw]
    cleaned="".join(ch for ch in raw.upper() if ch.isalnum())
    return cleaned[:2] or fallback

def _account_id_for(country: str,state: str)->str:
    day=date.today().strftime("%Y%m%d"); prefix=f"{_code(country,COUNTRY_CODE_MAP)}-{_code(state,STATE_CODE_MAP)}-ACL-{day}-"; used=[]
    local=getattr(charge_settings.get("demo-apartment",ChargeSettings()),"account_id","")
    for value in [local]+[a.account_id for a in tenant_accounts.values()]:
        if value.startswith(prefix):
            try: used.append(int(value.rsplit("-",1)[-1]))
            except ValueError: pass
    return f"{prefix}{max(used,default=0)+1:06d}"

def _account_id_for_local(country="India",state="Telangana"):
    existing=getattr(charge_settings.get("demo-apartment",ChargeSettings()),"account_id","")
    if existing and re.fullmatch(r"[A-Z]{2}-[A-Z]{2}-ACL-\d{8}-\d{6}",existing): return existing
    return _account_id_for(country,state)

def _send_welcome_email(account_id: str, apartment_name: str, admin_name: str, admin_username: str, receiver: str):
    sender=os.getenv("APARTCARE_SMTP_SENDER", os.getenv("APARTCARE_SMTP_EMAIL", "apartcarelite@gmail.com"))
    app_password=os.getenv("APARTCARE_SMTP_APP_PASSWORD", "")
    subject="Welcome to ApartCare Lite – Your Property Account Is Ready!"
    body=f"""Dear {admin_name},

Welcome to ApartCare Lite! We are delighted to have {apartment_name} join the ApartCare family.

Your property account has been created successfully.

Property Name: {apartment_name}
Account Number: {account_id}
Administrator: {admin_name}
Administrator User ID: {admin_username}
Registered Email: {receiver}

How to login:
1. Enter your Account Number
2. Enter your registered Email / User ID
3. Enter your password

For your security, your password is not included in this email.

Your daily partner in property care.
Helping you run your building beautifully.

Warm regards,
ApartCare Lite Team
"""
    if not app_password:
        return False, "Email not sent: configure APARTCARE_SMTP_APP_PASSWORD to enable Gmail delivery."
    try:
        msg=EmailMessage(); msg["Subject"]=subject; msg["From"]=f"ApartCare Lite <{sender}>"; msg["To"]=receiver; msg.set_content(body)
        with smtplib.SMTP_SSL("smtp.gmail.com",465,timeout=20) as server:
            server.login(sender,app_password); server.send_message(msg)
        return True, "Welcome email sent successfully."
    except Exception as exc:
        return False, f"Email delivery failed: {str(exc)}"

def _send_property_user_welcome_email(account_id: str, apartment_name: str, full_name: str, username: str, role: str, receiver: str) -> tuple[bool,str]:
    sender=os.getenv("APARTCARE_SMTP_SENDER", os.getenv("APARTCARE_SMTP_EMAIL", "apartcarelite@gmail.com"))
    smtp_host=os.getenv("APARTCARE_SMTP_HOST", "smtp.gmail.com")
    smtp_port=int(os.getenv("APARTCARE_SMTP_PORT", "587"))
    app_password=os.getenv("APARTCARE_SMTP_APP_PASSWORD", "")
    if not app_password:
        return False, "Email not sent: configure APARTCARE_SMTP_APP_PASSWORD to enable delivery."
    msg=EmailMessage()
    msg["Subject"]=f"Welcome to ApartCare Lite – {apartment_name} User Account"
    msg["From"]=f"ApartCare Lite <{sender}>"
    msg["To"]=receiver
    msg.set_content(f"""Dear {full_name},

A property user account has been created for you in ApartCare Lite.

Apartment: {apartment_name}
Account Number: {account_id}
User ID: {username}
Role: {role}
Registered Email: {receiver}

Use the Account Number and your User ID / registered email to sign in.
For security, your password is not included in this email. You will be required to change the temporary password at first login.

Your daily partner in property care.
Helping you run your building beautifully.

Warm regards,
ApartCare Lite Team
""")
    try:
        with smtplib.SMTP(smtp_host,smtp_port,timeout=15) as server:
            server.starttls(); server.login(sender,app_password); server.send_message(msg)
        return True, "User welcome email sent successfully."
    except Exception as exc:
        return False, f"User email delivery failed: {exc}"

def _send_platform_welcome_email(receiver: str, full_name: str, username: str) -> tuple[bool,str]:
    sender=os.getenv("APARTCARE_SMTP_SENDER", os.getenv("APARTCARE_SMTP_EMAIL", "apartcarelite@gmail.com"))
    smtp_host=os.getenv("APARTCARE_SMTP_HOST", "smtp.gmail.com")
    smtp_port=int(os.getenv("APARTCARE_SMTP_PORT", "587"))
    app_password=os.getenv("APARTCARE_SMTP_APP_PASSWORD", "")
    if not app_password:
        return False, "Email is not configured. Set APARTCARE_SMTP_APP_PASSWORD to enable Platform Owner email delivery."
    msg=EmailMessage()
    msg["Subject"]="Welcome to ApartCare Lite Platform — Account Created"
    msg["From"]=f"ApartCare Lite <{sender}>"
    msg["To"]=receiver
    msg.set_content(f"""Dear {full_name},

Your ApartCare Lite Platform Owner account has been created successfully.

Platform User ID: {username}
Registered Recovery Email: {receiver}

You can use this registered email address for Platform Owner password recovery.
For security, your password is not included in this email.

Warm regards,
ApartCare Lite Team
Your daily partner in property care.
Helping you run your building beautifully.
""")
    try:
        with smtplib.SMTP(smtp_host,smtp_port,timeout=15) as server:
            server.starttls(); server.login(sender,app_password); server.send_message(msg)
        return True, "Platform Owner welcome email sent successfully."
    except Exception as exc:
        return False, f"Platform Owner email delivery failed: {exc}"

def _send_password_reset_email(receiver: str, full_name: str, account_id: str, reset_token: str) -> tuple[bool,str]:
    sender=os.getenv("APARTCARE_SMTP_SENDER", "apartcarelite@gmail.com")
    smtp_host=os.getenv("APARTCARE_SMTP_HOST", "smtp.gmail.com")
    smtp_port=int(os.getenv("APARTCARE_SMTP_PORT", "587"))
    app_password=os.getenv("APARTCARE_SMTP_APP_PASSWORD", "")
    if not app_password:
        return False, "Email is not configured. Set APARTCARE_SMTP_APP_PASSWORD to send reset emails."
    msg=EmailMessage()
    msg["Subject"]="ApartCare Lite — Password Reset Request"
    msg["From"]=sender
    msg["To"]=receiver
    msg.set_content(f"""Hello {full_name},

We received a password reset request for your ApartCare Lite property account.

Account ID: {account_id}
Reset Code: {reset_token}

Use this code in the ApartCare Lite password reset screen to create a new password. This code expires in 30 minutes and can be used only once.

If you did not request this reset, please ignore this email.

Warm regards,
ApartCare Lite
Your daily partner in property care.
Helping you run your building beautifully.
""")
    try:
        with smtplib.SMTP(smtp_host,smtp_port,timeout=15) as server:
            server.starttls(); server.login(sender,app_password); server.send_message(msg)
        return True, "Password reset email sent."
    except Exception as exc:
        return False, f"Unable to send reset email: {exc}"

def _current_actor(token: str | None) -> AdminUser:
    # Platform Owner audit/support sessions are intentionally read-only and
    # exist only in memory. They never become property credentials.
    if token and token in platform_support_sessions:
        return platform_support_sessions[token][1]
    if not token or token not in auth_sessions:
        raise HTTPException(status_code=401, detail="Login session is required.")
    uid = auth_sessions[token]
    user = next((u for u in admin_users if u.id == uid), None)
    if user is None:
        for _tid, _users in tenant_users.items():
            user = next((u for u in _users if u.id == uid), None)
            if user is not None:
                break
    if not user or not user.active or user.locked:
        auth_sessions.pop(token, None)
        raise HTTPException(status_code=403, detail="Your account is not allowed to perform this action.")
    return user

def _is_platform_support_token(token: str | None) -> bool:
    return bool(token and token in platform_support_sessions)

def _require_role(token: str | None, allowed: set[str]) -> AdminUser:
    user = _current_actor(token)
    if user.role not in allowed:
        raise HTTPException(status_code=403, detail="You do not have permission for this Administration action.")
    return user


def _resolved_actor_tenant(token: str | None, requested_apartment_id: str = "demo-apartment") -> str:
    """Resolve property namespace from the authenticated session.

    For multi-apartment sessions, tenant_id is authoritative. A browser-supplied
    apartment_id may only be the same tenant (or the legacy demo placeholder).
    """
    if token and (token in auth_sessions or token in platform_support_sessions):
        actor = _current_actor(token)
        tenant = str(getattr(actor, "tenant_id", "") or "").strip()
        if not tenant:
            raise HTTPException(status_code=403, detail="Authenticated user has no tenant_id.")
        requested = str(requested_apartment_id or tenant)
        if tenant != "demo-apartment" and requested not in {"", "demo-apartment", tenant}:
            raise HTTPException(status_code=403, detail="Apartment context does not match the logged-in account.")
        return tenant
    return str(requested_apartment_id or "demo-apartment")


def _require_write_role(token: str | None) -> AdminUser:
    """Property Viewer is strictly read-only; Platform Owner audit/support is also read-only."""
    if _is_platform_support_token(token):
        raise HTTPException(status_code=403, detail="Platform Owner Audit/Support access is read-only.")
    user = _current_actor(token)
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Viewer access is read-only. An Administrator is required to change property data.")
    return user

@app.get("/admin/auth/session")
def admin_session(x_apartcare_token: str | None = Header(default=None)):
    """Return the authenticated property session user. Used by the frontend to validate
    a persisted local session after a browser/backend restart before rendering controls."""
    user = _current_actor(x_apartcare_token)
    return {"user": user.model_dump(), "authenticated": True}

@app.get("/account/status")
def account_status():
    # Bootstrap-only endpoint. Never return one apartment's operational settings
    # before authentication; doing so can make a second tenant appear to own the
    # previous tenant's profile.
    return {
        "initialized": bool(tenant_accounts),
        "tenant_count": len(tenant_accounts),
        "apartment": None,
    }

@app.post("/account/create", status_code=201)
def create_apartment_account(data: ApartmentAccountCreateInput, background_tasks: BackgroundTasks):
    """Self-service multi-apartment creation.

    Existing legacy demo data is preserved. Each new property gets its own tenant
    namespace, account number, administrator and settings record. No Platform
    Owner session is required.
    """
    global tenant_accounts, tenant_users, tenant_passwords, admin_users, admin_passwords
    email=data.admin_email.strip().lower()
    mobile=''.join(ch for ch in data.admin_mobile.strip() if ch.isdigit() or ch=='+')
    if '@' not in email or '.' not in email.rsplit('@',1)[-1]:
        raise HTTPException(status_code=422, detail="Enter a valid Administrator Email address.")
    if len([c for c in mobile if c.isdigit()]) < 7:
        raise HTTPException(status_code=422, detail="Enter a valid Administrator Mobile Number.")
    username=(data.admin_username.strip() or email)
    if any(a.apartment_name.casefold()==data.apartment_name.strip().casefold() and
           a.city.casefold()==data.city.strip().casefold() for a in tenant_accounts.values()):
        raise HTTPException(status_code=409, detail="An apartment with the same name and city already exists.")
    # User IDs are scoped to the apartment account. The Account Number is the
    # tenant selector at login, so the same Admin/Viewer User ID may legitimately
    # exist in multiple independent apartment accounts.
    tid=str(uuid4())
    now=datetime.now().isoformat(timespec="seconds")
    account_id=_account_id_for(data.country, data.state)
    account=TenantAccount(
        tenant_id=tid, account_id=account_id,
        apartment_name=data.apartment_name.strip(), address=data.address.strip(),
        city=data.city.strip(), state=data.state.strip(), pin_code=data.pin_code.strip(),
        country=data.country.strip(), language=data.language.strip(),
        data_start_month="",
        valid_from=date.today().isoformat(),
        valid_to=(date.today()+timedelta(days=365)).isoformat(),
        status="Active", created_at=now, account_mobile=mobile, account_email=email
    )
    admin=AdminUser(
        id=str(uuid4()), username=username, full_name=data.admin_name.strip(),
        email=email, mobile_no=mobile, role="Admin", created_at=now, updated_at=now,
        tenant_id=tid, force_password_change=True
    )
    tenant_accounts[tid]=account
    tenant_users[tid]=[admin]
    _create_subscription_for_tenant(tid, now, admin.username)
    tenant_passwords[admin.id]=_password_hash(data.password)
    _record_account_validity_history(account, "Created", admin.username, "Apartment account created")

    # Keep the legacy actor registry compatible with the existing application
    # session layer, while tenant_id identifies the property namespace.
    admin_users.append(admin)
    admin_passwords[admin.id]=_password_hash(data.password)

    charge_settings[tid]=ChargeSettings(
        apartment_id=tid, account_id=account_id, account_mobile=mobile,
        apartment_name=account.apartment_name, address=account.address,
        city=account.city, pin_code=account.pin_code, state=account.state,
        country=account.country, language=account.language
    )
    # Seed utility categories for the new apartment only.
    for category_name in DEFAULT_UTILITY_CATEGORIES:
        utility_categories.append(UtilityCategory(
            id=f"UTC-{uuid4()}", apartment_id=tid, name=category_name,
            active=True, created_at=now, updated_at=now, created_by="system"
        ))
    # Do not block account creation on SMTP/network latency. The account is persisted
    # first and the welcome email is sent after the response is ready.
    background_tasks.add_task(_send_welcome_email, account.account_id, account.apartment_name, admin.full_name, admin.username, email)
    _audit(admin.username,"Success","Apartment Account Created",f"{account.account_id}; welcome email queued",admin.id)
    _save_state()
    return {"user":admin,"token":"","account":_account_payload(account),"email_sent":None,"email_message":"Welcome email queued for delivery."}


@app.post("/admin/auth/login", response_model=AuthLoginResponse)
def admin_login(data: AdminLoginInput, account_id: str = ""):
    supplied_account=account_id.strip()
    # New multi-apartment accounts are authenticated by their own tenant record.
    tenant_account=next((a for a in tenant_accounts.values() if a.account_id.casefold()==supplied_account.casefold()),None) if supplied_account else None
    if tenant_account:
        if tenant_account.status!="Active" or tenant_account.valid_from>date.today().isoformat() or tenant_account.valid_to<date.today().isoformat():
            raise HTTPException(status_code=403, detail="Property account is not currently active.")
        supplied_username=data.username.strip().casefold()
        user=next((u for u in tenant_users.get(tenant_account.tenant_id,[]) if u.username.casefold()==supplied_username or (u.email and u.email.casefold()==supplied_username)),None)
        if not user or user.locked or not user.active or tenant_passwords.get(user.id)!=_password_hash(data.password):
            raise HTTPException(status_code=401, detail="Invalid User ID or password.")
        user.tenant_id = tenant_account.tenant_id
        # FIX 12: a normal account-created password is immediately usable.
        # Only an explicit password reset (which updates updated_at) can force a change.
        if user.force_password_change and user.created_at == user.updated_at:
            user.force_password_change=False
        failed_key=f"{tenant_account.tenant_id}:{user.username.casefold()}"
        if tenant_passwords.get(user.id)!=_password_hash(data.password):
            failed_login_counts[failed_key]=failed_login_counts.get(failed_key,0)+1
            _audit(user.username,"Failed","Login",f"Invalid password; Tenant {tenant_account.account_id}",user.id,tenant_account.tenant_id)
            if failed_login_counts[failed_key] >= 5:
                user.locked=True; user.updated_at=datetime.now().isoformat(timespec="seconds")
                _audit(user.username,"Blocked","Account Locked",f"Five consecutive failed login attempts; Tenant {tenant_account.account_id}",user.id,tenant_account.tenant_id)
                raise HTTPException(status_code=403, detail="Account locked after repeated failed login attempts. Contact an Administrator.")
            raise HTTPException(status_code=401, detail="Invalid User ID or password.")
        failed_login_counts.pop(failed_key,None)
        token=secrets.token_urlsafe(32); auth_sessions[token]=user.id; tenant_sessions[token]=(tenant_account.tenant_id,user.id)
        _audit(user.username,"Success","Login",f"Tenant {tenant_account.account_id}",user.id,tenant_account.tenant_id)
        return {"user":user,"token":token,"account":_account_payload(tenant_account)}
    settings=charge_settings.get("demo-apartment", ChargeSettings())
    expected=getattr(settings,"account_id", "")
    if expected and supplied_account.upper()!=expected.upper():
        raise HTTPException(status_code=401, detail="Invalid Account ID or credentials.")
    # Accept the current stored username/email plus the legacy PRKNM_* aliases
    # used by earlier local test builds. This keeps existing state data intact.
    supplied_username = data.username.strip()
    normalized_username = supplied_username.casefold()
    username_candidates = {normalized_username}
    if normalized_username.startswith("prknm_") and len(normalized_username) > 6:
        username_candidates.add(normalized_username[6:])
    else:
        username_candidates.add(f"prknm_{normalized_username}")
    user = next((u for u in admin_users if u.username.casefold() in username_candidates or (u.email and u.email.casefold() == normalized_username)), None)
    if not user:
        _audit(data.username, "Failed", "Login", "Unknown user")
        raise HTTPException(status_code=401, detail="Invalid User ID or password")
    if not user.active:
        _audit(user.username, "Blocked", "Login", "User is deactivated", user.id)
        raise HTTPException(status_code=403, detail="User is deactivated")
    if user.locked:
        _audit(user.username, "Blocked", "Login", "User is locked", user.id)
        raise HTTPException(status_code=403, detail="User is locked")
    if admin_passwords.get(user.id) != _password_hash(data.password):
        key=user.username.lower(); failed_login_counts[key]=failed_login_counts.get(key,0)+1
        _audit(user.username, "Failed", "Login", "Invalid password", user.id)
        if failed_login_counts[key] >= 5:
            user.locked=True; user.updated_at=datetime.now().isoformat(timespec="seconds")
            _audit(user.username, "Blocked", "Account Locked", "Five consecutive failed login attempts", user.id)
            raise HTTPException(status_code=403, detail="Account locked after repeated failed login attempts. Contact an Administrator.")
        raise HTTPException(status_code=401, detail="Invalid User ID or password")
    failed_login_counts.pop(user.username.lower(), None)
    # FIX 12: legacy users created before the policy fix must not be forced to
    # change their original password merely because the record was persisted.
    if user.force_password_change and user.created_at == user.updated_at:
        user.force_password_change=False
    token = secrets.token_urlsafe(32); auth_sessions[token] = user.id
    _audit(user.username, "Success", "Login", user_id=user.id)
    return AuthLoginResponse(user=user, token=token, account={"tenant_id":"demo-apartment","account_id":getattr(settings,"account_id",""),"apartment_name":settings.apartment_name})

@app.post("/admin/auth/request-password-reset")
def request_password_reset(data: PasswordResetRequestInput):
    # Password recovery is tenant-scoped. The Account Number selects the tenant
    # before email/User ID lookup, so identical User IDs across apartments never
    # share a reset namespace.
    generic={"message":"If the account details match our records, a password reset email has been sent."}
    account_id=data.account_id.strip()
    tenant_account=next((a for a in tenant_accounts.values() if a.account_id.casefold()==account_id.casefold()),None)
    if tenant_account:
        key=data.email_or_username.strip().casefold()
        user=next((u for u in tenant_users.get(tenant_account.tenant_id,[]) if (u.email and u.email.casefold()==key) or u.username.casefold()==key),None)
        if not user or not user.email:
            return generic
        token=secrets.token_urlsafe(24)
        password_reset_tokens[token]={"user_id":user.id,"tenant_id":tenant_account.tenant_id,"account_id":tenant_account.account_id,"expires_at":(datetime.now()+timedelta(minutes=30)).isoformat(),"used":False}
        sent,msg=_send_password_reset_email(user.email,user.full_name,tenant_account.account_id,token)
        if not sent:
            password_reset_tokens.pop(token,None)
            raise HTTPException(status_code=503, detail=msg)
        _audit(user.username,"Success","Password Reset Requested",f"Reset email sent; Tenant {tenant_account.account_id}",user.id,tenant_account.tenant_id)
        _save_state()
        return generic

    # Legacy/demo recovery path retained only for pre-multitenant local data.
    settings=charge_settings.get("demo-apartment", ChargeSettings())
    expected=getattr(settings,"account_id","")
    if not expected or account_id.upper()!=expected.upper():
        return generic
    key=data.email_or_username.strip().lower()
    user=next((u for u in admin_users if getattr(u,"tenant_id","")=="demo-apartment" and ((u.email and u.email.lower()==key) or u.username.lower()==key)),None)
    if not user or not user.email:
        return generic
    token=secrets.token_urlsafe(24)
    password_reset_tokens[token]={"user_id":user.id,"tenant_id":"demo-apartment","account_id":expected,"expires_at":(datetime.now()+timedelta(minutes=30)).isoformat(),"used":False}
    sent,msg=_send_password_reset_email(user.email,user.full_name,expected,token)
    if not sent:
        password_reset_tokens.pop(token,None)
        raise HTTPException(status_code=503, detail=msg)
    _audit(user.username,"Success","Password Reset Requested","Reset email sent",user.id,"demo-apartment")
    _save_state()
    return generic

@app.post("/admin/auth/confirm-password-reset")
def confirm_password_reset(data: PasswordResetConfirmInput):
    record=password_reset_tokens.get(data.token)
    if not record or record.get("used"):
        raise HTTPException(status_code=400, detail="Invalid or already used reset code.")
    if datetime.fromisoformat(record["expires_at"]) < datetime.now():
        password_reset_tokens.pop(data.token,None)
        raise HTTPException(status_code=400, detail="This reset code has expired. Please request a new password reset.")
    tenant_id=str(record.get("tenant_id") or "")
    if tenant_id and tenant_id != "demo-apartment" and tenant_id not in tenant_accounts:
        raise HTTPException(status_code=404, detail="Property account not found.")
    if tenant_id and tenant_id != "demo-apartment":
        user=next((u for u in tenant_users.get(tenant_id,[]) if u.id==record["user_id"] and u.tenant_id==tenant_id),None)
    else:
        user=next((u for u in admin_users if u.id==record["user_id"] and getattr(u,"tenant_id","")=="demo-apartment"),None)
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")
    new_hash=_password_hash(data.new_password)
    admin_passwords[user.id]=new_hash
    if user.tenant_id:
        tenant_passwords[user.id]=new_hash
    user.locked=False; user.active=True; user.force_password_change=False
    user.updated_at=datetime.now().isoformat(timespec="seconds")
    record["used"]=True
    failed_login_counts.pop(f"{user.tenant_id}:{user.username.casefold()}",None)
    failed_login_counts.pop(user.username.lower(),None)
    _audit(user.username,"Success","Password Reset Completed","Password reset through registered email",user.id,user.tenant_id)
    _save_state()
    return {"message":"Password reset successful. You can now log in."}

@app.post("/admin/auth/change-password", response_model=AdminUser)
def change_own_password(data: ChangePasswordInput, x_apartcare_token: str | None = Header(default=None)):
    user = _current_actor(x_apartcare_token)
    # This endpoint is intentionally available to Viewer/Admin/Supervisor only for changing their own password.
    # It must not be routed through the property write-role restriction.
    if len(data.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")
    new_hash = _password_hash(data.new_password)
    admin_passwords[user.id] = new_hash
    if user.tenant_id:
        tenant_passwords[user.id] = new_hash
    user.force_password_change = False
    user.updated_at = datetime.now().isoformat(timespec="seconds")
    _audit(user.username, "Success", "Password Changed", "First-time/own password changed", user.id)
    _save_state()
    return user

@app.post("/admin/auth/logout")
def admin_logout(x_apartcare_token: str | None = Header(default=None)):
    if x_apartcare_token:
        auth_sessions.pop(x_apartcare_token, None)
        tenant_sessions.pop(x_apartcare_token, None)
    return {"logged_out": True}

@app.get("/admin/users", response_model=list[AdminUser])
def list_admin_users(x_apartcare_token: str | None = Header(default=None)):
    actor=_require_role(x_apartcare_token, {"Admin"})
    tenant_id=getattr(actor,"tenant_id","")
    rows=list(tenant_users.get(tenant_id, [])) if tenant_id else [u for u in admin_users if not getattr(u,"tenant_id","")]
    return sorted(rows, key=lambda u: (u.role != "Admin", u.username.lower()))

@app.get("/admin/session-timeouts", response_model=SessionTimeoutSettings)
def get_session_timeouts():
    return session_timeout_settings

@app.put("/admin/session-timeouts", response_model=SessionTimeoutSettings)
def update_session_timeouts(data: SessionTimeoutSettings, x_apartcare_token: str | None = Header(default=None)):
    actor = _require_role(x_apartcare_token, {"Admin"})
    global session_timeout_settings
    session_timeout_settings = data
    _audit(actor.username, "Success", "Session Timeout Updated", user_id=actor.id)
    return session_timeout_settings

@app.post("/admin/users", response_model=AdminUser, status_code=201)
def create_admin_user(data: AdminUserInput, background_tasks: BackgroundTasks, x_apartcare_token: str | None = Header(default=None)):
    actor = _require_role(x_apartcare_token, {"Admin"})
    tenant_id=getattr(actor,"tenant_id","")
    scoped_users=[u for u in admin_users if getattr(u,"tenant_id","")==tenant_id]
    if any(u.username.lower() == data.username.lower() for u in scoped_users):
        _audit(actor.username, "Failed", "User Create", f"Duplicate User ID attempted: {data.username.strip()}", actor.id, tenant_id)
        raise HTTPException(status_code=409, detail="User ID already exists. Duplicate User IDs are not allowed.")
    if data.role not in {"Viewer", "Supervisor"}:
        raise HTTPException(status_code=403, detail="Apartment Admin can create Viewer or Supervisor accounts. Super Admin is a platform-only role.")
    email=data.email.strip().lower()
    mobile="".join(ch for ch in data.mobile_no.strip() if ch.isdigit() or ch=="+")
    if email and ("@" not in email or "." not in email.rsplit("@",1)[-1]):
        raise HTTPException(status_code=422, detail="Enter a valid Email Address.")
    if mobile and len([c for c in mobile if c.isdigit()]) < 7:
        raise HTTPException(status_code=422, detail="Enter a valid Mobile Number.")
    now = datetime.now().isoformat(timespec="seconds")
    user = AdminUser(id=str(uuid4()), username=data.username.strip(), full_name=data.full_name.strip(), email=email, mobile_no=mobile, role=data.role, created_at=now, updated_at=now, force_password_change=False, tenant_id=tenant_id)
    admin_users.append(user); admin_passwords[user.id] = _password_hash(data.password)
    if tenant_id:
        tenant_users.setdefault(tenant_id, []).append(user)
        tenant_passwords[user.id] = _password_hash(data.password)
    account=tenant_accounts.get(tenant_id)
    account_id=account.account_id if account else ""
    apartment_name=account.apartment_name if account else "ApartCare Lite"
    background_tasks.add_task(_send_property_user_welcome_email, account_id, apartment_name, user.full_name, user.username, user.role, email)
    _audit(actor.username, "Success", "User Created", f"Created {data.role}: {user.username}; welcome email queued", actor.id, tenant_id)
    _save_state()
    return user

@app.put("/admin/users/{user_id}", response_model=AdminUser)
def update_admin_user(user_id: str, data: AdminUserUpdate, x_apartcare_token: str | None = Header(default=None)):
    actor = _require_role(x_apartcare_token, {"Admin"})
    tenant_id=getattr(actor,"tenant_id","")
    target = next((u for u in admin_users if u.id == user_id and getattr(u,"tenant_id","")==tenant_id), None)
    if not target: raise HTTPException(status_code=404, detail="User not found")
    if actor.id == target.id and (data.active is False or data.locked is True):
        raise HTTPException(status_code=400, detail="You cannot deactivate or lock your own active session.")
    if target.role not in {"Viewer", "Supervisor"}:
        raise HTTPException(status_code=403, detail="Admin can manage Viewer or Supervisor accounts only.")
    if data.role is not None:
        if data.role not in {"Viewer", "Supervisor"}:
            raise HTTPException(status_code=403, detail="Apartment users cannot be assigned Admin or Super Admin through Administration.")
        target.role = data.role
    if data.full_name is not None: target.full_name = data.full_name.strip()
    if data.active is not None: target.active = data.active
    if data.locked is not None:
        reason=" ".join(str(data.reason or "").strip().split())
        if len(reason) < 3:
            raise HTTPException(status_code=422, detail="Lock/unlock justification is mandatory (minimum 3 characters).")
        target.locked = data.locked
        _audit(actor.username, "Success", "User Locked" if data.locked else "User Unlocked", f"{target.username}; {reason}", actor.id, tenant_id)
    target.updated_at = datetime.now().isoformat(timespec="seconds")
    if data.locked is None:
        _audit(actor.username, "Success", "User Updated", f"Updated {target.username}", actor.id, tenant_id)
    return target

@app.post("/admin/users/{user_id}/reset-password", response_model=AdminUser)
def reset_admin_password(user_id: str, data: PasswordResetInput, x_apartcare_token: str | None = Header(default=None)):
    actor = _require_role(x_apartcare_token, {"Admin"})
    tenant_id=getattr(actor,"tenant_id","")
    target = next((u for u in admin_users if u.id == user_id and getattr(u,"tenant_id","")==tenant_id), None)
    if not target: raise HTTPException(status_code=404, detail="User not found")
    if target.role not in {"Viewer", "Supervisor"}:
        raise HTTPException(status_code=403, detail="Admin can reset Viewer or Supervisor passwords only.")
    # Universal password policy: any Administrator-initiated reset creates a
    # temporary password. The target MUST change it at the next login,
    # regardless of the caller-supplied force_change flag.
    new_hash = _password_hash(data.new_password)
    admin_passwords[target.id] = new_hash
    if target.tenant_id:
        tenant_passwords[target.id] = new_hash
    target.force_password_change = True
    failed_login_counts.pop(f"{target.tenant_id}:{target.username.casefold()}",None)
    failed_login_counts.pop(target.username.lower(),None)
    target.updated_at = datetime.now().isoformat(timespec="seconds")
    _audit(actor.username, "Success", "Password Reset", f"Reset password for {target.username}", actor.id)
    return target

def _tenant_history_rows(actor: AdminUser, username: str = "") -> list[LoginAttempt]:
    tenant_id = getattr(actor, "tenant_id", "") or ""
    key = username.strip().lower()
    rows = [h for h in login_history if h.tenant_id == tenant_id]
    if key and key != "all":
        rows = [h for h in rows if h.username.lower() == key]
    return sorted(rows, key=lambda x: x.at, reverse=True)

@app.get("/admin/login-history", response_model=list[LoginAttempt])
def get_login_history(x_apartcare_token: str | None = Header(default=None)):
    actor = _require_role(x_apartcare_token, {"Admin"})
    return _tenant_history_rows(actor)

@app.get("/admin/history", response_model=list[LoginAttempt])
def get_administration_history(username: str = "", x_apartcare_token: str | None = Header(default=None)):
    actor = _require_role(x_apartcare_token, {"Admin"})
    return _tenant_history_rows(actor, username)

@app.get("/admin/history/download")
def download_administration_history(username: str = "", x_apartcare_token: str | None = Header(default=None)):
    actor = _require_role(x_apartcare_token, {"Admin"})
    import csv
    from io import StringIO
    rows = _tenant_history_rows(actor, username)
    out=StringIO(); w=csv.writer(out); w.writerow(["Date / Time","User ID","Event","Status","Reason"])
    for h in rows: w.writerow([h.at,h.username,h.event,h.status,h.reason or ""])
    filename="ApartCare_Login_Administration_History" + ("_All_Users" if not key or key=="all" else "_"+re.sub(r"[^A-Za-z0-9_.-]+","_",username.strip())) + ".csv"
    return StreamingResponse(iter([out.getvalue().encode("utf-8-sig")]),media_type="text/csv; charset=utf-8",headers={"Content-Disposition":f'attachment; filename="{filename}"'})



# ==================== APARTCARE V6.0 PLATFORM LAYER ====================
# The legacy operational APIs remain intact for regression compatibility.
# New platform endpoints provide the multi-tenant foundation without trusting
# a browser-supplied tenant context for privileged operations.
class TenantAccount(BaseModel):
    tenant_id: str
    account_id: str
    apartment_name: str
    address: str
    city: str
    state: str
    pin_code: str
    country: str = "India"
    language: str = "English"
    property_type: str = "Apartment"
    valid_from: str
    valid_to: str
    status: Literal["Active", "Suspended", "Deactivated", "Expired"] = "Active"
    created_at: str
    account_mobile: str = ""
    account_email: str = ""
    # First operational month for this tenant. Existing tenants default to their
    # account creation month during migration; new tenants choose it at creation.
    data_start_month: str = ""
    users: list[AdminUser] = Field(default_factory=list)

class TenantAccountValidityHistory(BaseModel):
    id: str
    tenant_id: str
    account_id: str
    valid_from: str
    valid_to: str
    status: str
    action: str
    changed_at: str
    changed_by: str
    reason: str = ""

class PlatformBootstrapInput(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=5, max_length=120)
    username: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=128)

class PlatformTenantCreateInput(BaseModel):
    apartment_name: str = Field(min_length=2, max_length=120)
    address: str = Field(min_length=2, max_length=240)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=80)
    pin_code: str = Field(min_length=3, max_length=20)
    country: str = "India"
    language: str = "English"
    data_start_month: str = Field(default="", pattern=r"^(?:\d{4}-\d{2})?$", description="Derived from locked Opening Balance; blank means unrestricted")
    valid_from: str = Field(default_factory=lambda: date.today().isoformat())
    valid_to: str = Field(default_factory=lambda: (date.today()+timedelta(days=365)).isoformat())
    status: Literal["Active", "Suspended", "Deactivated"] = "Active"
    admin_name: str = Field(min_length=1, max_length=100)
    admin_username: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9_.-]+$")
    admin_email: str = Field(default="", max_length=120)
    admin_mobile: str = Field(default="", max_length=30)
    password: str = Field(min_length=8, max_length=128)

class TenantStatusUpdate(BaseModel):
    status: Literal["Active", "Suspended", "Deactivated"]
    valid_from: str | None = None
    valid_to: str | None = None
    reason: str = Field(default="", max_length=240)


class SubscriptionSettings(BaseModel):
    trial_enabled: bool = False
    default_trial_value: int = Field(default=30, ge=1, le=3650)
    default_trial_unit: Literal["Days", "Months"] = "Days"
    default_grace_value: int = Field(default=7, ge=0, le=365)
    default_grace_unit: Literal["Days", "Months"] = "Days"
    allow_trial_extension: bool = True
    max_trial_extension_value: int = Field(default=90, ge=1, le=3650)
    max_trial_extension_unit: Literal["Days", "Months"] = "Days"
    allow_complimentary: bool = True
    auto_convert_to_paid: bool = False
    reminder_days: list[int] = Field(default_factory=lambda: [7, 3, 1])
    default_plan_id: str = ""
    updated_at: str = ""
    updated_by: str = "system"

class SubscriptionPlan(BaseModel):
    id: str
    code: str
    name: str
    description: str = ""
    monthly_price: float = Field(default=0, ge=0)
    annual_price: float = Field(default=0, ge=0)
    currency: str = "INR"
    active: bool = True
    features: dict[str, bool] = Field(default_factory=dict)
    created_at: str
    updated_at: str

class Subscription(BaseModel):
    id: str
    tenant_id: str
    subscription_type: Literal["TRIAL", "PAID", "COMPLIMENTARY", "LEGACY"] = "TRIAL"
    plan_id: str = ""
    status: Literal["TRIAL", "ACTIVE", "GRACE", "PAST_DUE", "RESTRICTED", "SUSPENDED", "CANCELLED", "EXPIRED"] = "TRIAL"
    payment_status: Literal["NOT_REQUIRED", "PENDING", "PAID", "FAILED", "REFUNDED"] = "NOT_REQUIRED"
    trial_start_date: str | None = None
    trial_end_date: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    grace_start_date: str | None = None
    grace_end_date: str | None = None
    auto_renew: bool = False
    gateway: str = ""
    gateway_customer_id: str = ""
    gateway_subscription_id: str = ""
    created_at: str
    updated_at: str
    created_by: str = "system"
    last_reason: str = ""

class SubscriptionHistory(BaseModel):
    id: str
    tenant_id: str
    subscription_id: str
    changed_at: str
    changed_by: str
    action: str
    old_type: str = ""
    new_type: str = ""
    old_status: str = ""
    new_status: str = ""
    old_plan_id: str = ""
    new_plan_id: str = ""
    old_trial_end: str | None = None
    new_trial_end: str | None = None
    reason: str = ""

class SubscriptionEvent(BaseModel):
    id: str
    tenant_id: str
    subscription_id: str = ""
    gateway_event_id: str
    event_type: str
    event_time: str
    received_at: str
    processed_at: str = ""
    status: Literal["Processed", "Ignored", "Failed"] = "Processed"
    payload_hash: str = ""
    detail: str = ""

class SubscriptionPayment(BaseModel):
    id: str
    tenant_id: str
    subscription_id: str
    gateway: str = ""
    gateway_payment_id: str = ""
    gateway_order_id: str = ""
    amount: float = Field(default=0, ge=0)
    currency: str = "INR"
    status: Literal["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "REFUNDED"] = "PENDING"
    payment_date: str = ""
    failure_reason: str = ""
    created_at: str
    updated_at: str

class SubscriptionSettingsUpdate(BaseModel):
    trial_enabled: bool | None = None
    default_trial_value: int | None = Field(default=None, ge=1, le=3650)
    default_trial_unit: Literal["Days", "Months"] | None = None
    default_grace_value: int | None = Field(default=None, ge=0, le=365)
    default_grace_unit: Literal["Days", "Months"] | None = None
    allow_trial_extension: bool | None = None
    max_trial_extension_value: int | None = Field(default=None, ge=1, le=3650)
    max_trial_extension_unit: Literal["Days", "Months"] | None = None
    allow_complimentary: bool | None = None
    auto_convert_to_paid: bool | None = None
    reminder_days: list[int] | None = None
    default_plan_id: str | None = None

class SubscriptionPlanInput(BaseModel):
    code: str = Field(min_length=2, max_length=30, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(min_length=2, max_length=80)
    description: str = ""
    monthly_price: float = Field(default=0, ge=0)
    annual_price: float = Field(default=0, ge=0)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    active: bool = True
    features: dict[str, bool] = Field(default_factory=dict)

class SubscriptionPlanUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    monthly_price: float | None = Field(default=None, ge=0)
    annual_price: float | None = Field(default=None, ge=0)
    active: bool | None = None
    features: dict[str, bool] | None = None

class SubscriptionTrialExtensionInput(BaseModel):
    value: int = Field(ge=1, le=3650)
    unit: Literal["Days", "Months"] = "Days"
    reason: str = Field(min_length=3, max_length=240)

class ComplimentarySubscriptionInput(BaseModel):
    valid_to: str | None = None
    reason: str = Field(min_length=3, max_length=240)

platform_owner: AdminUser | None = None
platform_owner_password: str = ""
tenant_accounts: dict[str, TenantAccount] = {}
tenant_users: dict[str, list[AdminUser]] = {}
tenant_passwords: dict[str, str] = {}
platform_sessions: dict[str, str] = {}
tenant_sessions: dict[str, tuple[str,str]] = {}
# Ephemeral, read-only Platform Owner audit/support sessions. Never persisted.
platform_support_sessions: dict[str, tuple[str, AdminUser]] = {}
platform_audit: list[dict] = []
tenant_account_validity_history: list[TenantAccountValidityHistory] = []
platform_password_policy_initialized: bool = False
subscription_settings = SubscriptionSettings()
subscription_plans: dict[str, SubscriptionPlan] = {}
subscriptions: dict[str, Subscription] = {}
subscription_history: list[SubscriptionHistory] = []
subscription_events: list[SubscriptionEvent] = []
subscription_payments: list[SubscriptionPayment] = []

def _add_period(start_iso: str, value: int, unit: str) -> str:
    d = date.fromisoformat(start_iso[:10])
    if unit == "Days":
        return (d + timedelta(days=value)).isoformat()
    # Calendar-month arithmetic: preserve end-of-month semantics.
    month = d.month - 1 + value
    year = d.year + month // 12
    month = month % 12 + 1
    import calendar
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day).isoformat()

def _default_plan_seed() -> None:
    global subscription_plans
    if subscription_plans:
        return
    now = datetime.now().isoformat(timespec="seconds")
    feature_all = {
        "Residents": True, "Monthly Maintenance": True, "Payments": True,
        "Expenses": True, "Utilities": True, "Reports": True,
        "Data Import": True, "Advanced Reports": True, "Multiple Admins": True,
        "Advanced Audit": True, "WhatsApp Sharing": True
    }
    seeds = [
        ("STARTER", "Starter", 499.0, 4990.0, {**feature_all, "Advanced Reports": False, "Multiple Admins": False, "Advanced Audit": False}),
        ("STANDARD", "Standard", 799.0, 7990.0, {**feature_all, "Advanced Reports": True, "Multiple Admins": True, "Advanced Audit": False}),
        ("PRO", "Professional", 1299.0, 12990.0, feature_all),
    ]
    for code, name, monthly, annual, features in seeds:
        pid = str(uuid4())
        subscription_plans[pid] = SubscriptionPlan(id=pid, code=code, name=name, description=f"ApartCare {name} plan", monthly_price=monthly, annual_price=annual, features=features, created_at=now, updated_at=now)
    if not subscription_settings.default_plan_id:
        subscription_settings.default_plan_id = next(iter(subscription_plans))

def _subscription_for_tenant(tenant_id: str) -> Subscription | None:
    return next((x for x in subscriptions.values() if x.tenant_id == tenant_id), None)

def _record_subscription_history(sub: Subscription, actor: str, action: str, reason: str = "", old: Subscription | None = None) -> None:
    old = old or sub.model_copy()
    subscription_history.append(SubscriptionHistory(
        id=str(uuid4()), tenant_id=sub.tenant_id, subscription_id=sub.id, changed_at=datetime.now().isoformat(timespec="seconds"),
        changed_by=actor, action=action, old_type=old.subscription_type, new_type=sub.subscription_type,
        old_status=old.status, new_status=sub.status, old_plan_id=old.plan_id, new_plan_id=sub.plan_id,
        old_trial_end=old.trial_end_date, new_trial_end=sub.trial_end_date, reason=reason
    ))

def _create_subscription_for_tenant(tenant_id: str, created_at: str, actor: str = "system") -> Subscription:
    existing = _subscription_for_tenant(tenant_id)
    if existing:
        return existing
    created_date = created_at[:10]
    now = datetime.now().isoformat(timespec="seconds")
    default_plan_id = subscription_settings.default_plan_id or next(iter(subscription_plans), "")
    if subscription_settings.trial_enabled:
        end = _add_period(created_date, subscription_settings.default_trial_value, subscription_settings.default_trial_unit)
        sub = Subscription(id=str(uuid4()), tenant_id=tenant_id, subscription_type="TRIAL", plan_id=default_plan_id, status="TRIAL", payment_status="NOT_REQUIRED", trial_start_date=created_date, trial_end_date=end, created_at=now, updated_at=now, created_by=actor, last_reason="Trial explicitly enabled by Product Owner policy")
    else:
        sub = Subscription(id=str(uuid4()), tenant_id=tenant_id, subscription_type="PAID", plan_id=default_plan_id, status="PAST_DUE", payment_status="PENDING", start_date=created_date, created_at=now, updated_at=now, created_by=actor, last_reason="Default plan assigned from Product Owner subscription policy; payment pending")
    subscriptions[sub.id] = sub
    _record_subscription_history(sub, actor, "Created", sub.last_reason, old=Subscription(id=str(uuid4()), tenant_id=tenant_id, created_at=now, updated_at=now))
    return sub

def _migrate_legacy_subscriptions() -> int:
    changed = 0
    now = datetime.now().isoformat(timespec="seconds")
    for account in tenant_accounts.values():
        if _subscription_for_tenant(account.tenant_id):
            continue
        sub = Subscription(id=str(uuid4()), tenant_id=account.tenant_id, subscription_type="LEGACY", status="ACTIVE", payment_status="NOT_REQUIRED", start_date=account.created_at[:10], created_at=now, updated_at=now, created_by="migration", last_reason="Existing V6.4.x apartment migrated without changing access")
        subscriptions[sub.id] = sub
        _record_subscription_history(sub, "migration", "Migrated", sub.last_reason, old=Subscription(id=str(uuid4()), tenant_id=account.tenant_id, created_at=now, updated_at=now))
        changed += 1
    return changed

def _refresh_subscription_status(sub: Subscription) -> Subscription:
    today = date.today().isoformat()
    if sub.subscription_type == "COMPLIMENTARY":
        if sub.end_date and sub.end_date < today:
            sub.status = "EXPIRED"
        else:
            sub.status = "ACTIVE"
        return sub
    if sub.subscription_type == "LEGACY":
        sub.status = "ACTIVE"
        return sub
    if sub.status == "CANCELLED":
        return sub
    if sub.subscription_type == "TRIAL":
        if sub.trial_end_date and today <= sub.trial_end_date:
            sub.status = "TRIAL"
        else:
            if not sub.grace_end_date:
                gs = sub.trial_end_date or today
                sub.grace_start_date = gs
                sub.grace_end_date = _add_period(gs, subscription_settings.default_grace_value, subscription_settings.default_grace_unit)
            if today <= (sub.grace_end_date or ""):
                sub.status = "GRACE"
            else:
                sub.status = "RESTRICTED"
        return sub
    if sub.subscription_type == "PAID":
        if sub.payment_status == "PAID":
            sub.status = "ACTIVE"
        elif sub.grace_end_date and today <= sub.grace_end_date:
            sub.status = "PAST_DUE"
        else:
            sub.status = "RESTRICTED"
    return sub

def _subscription_access_allowed(tenant_id: str) -> bool:
    sub = _subscription_for_tenant(tenant_id)
    if not sub:
        return True
    before = sub.status
    _refresh_subscription_status(sub)
    if sub.status != before:
        sub.updated_at = datetime.now().isoformat(timespec="seconds")
        _save_state()
    return sub.status in {"TRIAL", "ACTIVE", "GRACE", "PAST_DUE"}

def _subscription_summary(sub: Subscription | None) -> dict:
    if not sub:
        return {"status":"ACTIVE","subscription_type":"LEGACY","days_remaining":None,"plan":None}
    _refresh_subscription_status(sub)
    plan = subscription_plans.get(sub.plan_id) if sub.plan_id else None
    end = sub.trial_end_date if sub.subscription_type == "TRIAL" else sub.end_date
    days = None
    if end:
        try: days = max(0, (date.fromisoformat(end[:10]) - date.today()).days)
        except Exception: days = None
    return {"status":sub.status,"subscription_type":sub.subscription_type,"payment_status":sub.payment_status,"trial_end_date":sub.trial_end_date,"grace_end_date":sub.grace_end_date,"end_date":sub.end_date,"days_remaining":days,"plan":plan.model_dump() if plan else None}

def _razorpay_enabled() -> bool:
    return os.getenv("RAZORPAY_ENABLED", "false").lower() in {"1","true","yes","on"} and bool(os.getenv("RAZORPAY_KEY_ID")) and bool(os.getenv("RAZORPAY_KEY_SECRET"))

def _razorpay_signature_valid(raw_body: bytes, signature: str) -> bool:
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    if not secret or not signature:
        return False
    expected = hashlib.sha256()
    import hmac
    digest = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)

def _account_id_for_today(country="India",state="Telangana"):
    return _account_id_for(country,state)

def _platform_actor(token: str | None) -> AdminUser:
    if not token or token not in platform_sessions or platform_owner is None:
        raise HTTPException(status_code=401, detail="Product Owner session is required.")
    return platform_owner

def _record_account_validity_history(account: TenantAccount, action: str, changed_by: str, reason: str = "") -> None:
    tenant_account_validity_history.append(TenantAccountValidityHistory(
        id=str(uuid4()), tenant_id=account.tenant_id, account_id=account.account_id,
        valid_from=account.valid_from, valid_to=account.valid_to, status=account.status,
        action=action, changed_at=datetime.now().isoformat(timespec="seconds"),
        changed_by=changed_by, reason=reason.strip()
    ))

def _tenant_actor(token: str | None) -> tuple[AdminUser,TenantAccount]:
    """Resolve an authenticated property/support session to one tenant.

    Platform Owner Audit/Support sessions are ephemeral and read-only, but they
    must still be able to use every property *read* API through the same tenant
    namespace as an apartment user.  Previously this helper accepted only
    ``tenant_sessions``; any endpoint using it would therefore return 401 during
    Platform Owner Audit/Support even though the support token was valid.
    """
    if token and token in platform_support_sessions:
        tenant_id, support_user = platform_support_sessions[token]
        account=tenant_accounts.get(tenant_id)
        if not account:
            raise HTTPException(status_code=403, detail="Property account is unavailable.")
        user=support_user
    elif token and token in tenant_sessions:
        tenant_id, user_id=tenant_sessions[token]
        account=tenant_accounts.get(tenant_id)
        if not account:
            raise HTTPException(status_code=403, detail="Property account is unavailable.")
        user=next((u for u in tenant_users.get(tenant_id,[]) if u.id==user_id),None)
        if not user or not user.active or user.locked:
            raise HTTPException(status_code=403, detail="User account is not allowed to access this property.")
    else:
        raise HTTPException(status_code=401, detail="Tenant login session is required.")

    today=date.today().isoformat()
    effective_status="Expired" if account.valid_to < today else account.status
    if effective_status != "Active":
        raise HTTPException(status_code=403, detail=f"Property account is {effective_status.lower()}.")
    return user,account

@app.get('/subscription')
def tenant_subscription(x_apartcare_token: str | None = Header(default=None)):
    _, account = _tenant_actor(x_apartcare_token)
    sub = _subscription_for_tenant(account.tenant_id)
    return {"subscription": sub.model_dump() if sub else None, "summary": _subscription_summary(sub)}

@app.get('/platform/subscription/settings')
def platform_subscription_settings(x_auth_token: str | None = Header(default=None)):
    _platform_actor(x_auth_token)
    return subscription_settings

@app.put('/platform/subscription/settings')
def platform_update_subscription_settings(data: SubscriptionSettingsUpdate, x_auth_token: str | None = Header(default=None)):
    actor = _platform_actor(x_auth_token)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(subscription_settings, k, v)
    if subscription_settings.default_plan_id and subscription_settings.default_plan_id not in subscription_plans:
        raise HTTPException(status_code=422, detail="Default subscription plan does not exist.")
    subscription_settings.updated_at = datetime.now().isoformat(timespec="seconds")
    subscription_settings.updated_by = actor.username
    platform_audit.append({"at":subscription_settings.updated_at,"event":"Subscription Settings Updated","actor":actor.username,"detail":"Trial, grace and billing policy updated"})
    _save_state()
    return subscription_settings

@app.get('/platform/subscription/plans', response_model=list[SubscriptionPlan])
def platform_subscription_plans(x_auth_token: str | None = Header(default=None)):
    _platform_actor(x_auth_token)
    return sorted(subscription_plans.values(), key=lambda x:(not x.active, x.monthly_price, x.name.lower()))

@app.post('/platform/subscription/plans', response_model=SubscriptionPlan, status_code=201)
def platform_create_subscription_plan(data: SubscriptionPlanInput, x_auth_token: str | None = Header(default=None)):
    actor = _platform_actor(x_auth_token)
    if any(p.code.casefold() == data.code.casefold() for p in subscription_plans.values()):
        raise HTTPException(status_code=409, detail="Subscription Plan Code already exists.")
    now = datetime.now().isoformat(timespec="seconds")
    plan = SubscriptionPlan(id=str(uuid4()), **data.model_dump(), created_at=now, updated_at=now)
    subscription_plans[plan.id] = plan
    platform_audit.append({"at":now,"event":"Subscription Plan Created","actor":actor.username,"detail":plan.code})
    _save_state(); return plan

@app.patch('/platform/subscription/plans/{plan_id}', response_model=SubscriptionPlan)
def platform_update_subscription_plan(plan_id: str, data: SubscriptionPlanUpdate, x_auth_token: str | None = Header(default=None)):
    actor = _platform_actor(x_auth_token); plan = subscription_plans.get(plan_id)
    if not plan: raise HTTPException(status_code=404, detail="Subscription plan not found.")
    for k,v in data.model_dump(exclude_none=True).items(): setattr(plan,k,v)
    plan.updated_at = datetime.now().isoformat(timespec="seconds")
    platform_audit.append({"at":plan.updated_at,"event":"Subscription Plan Updated","actor":actor.username,"detail":plan.code})
    _save_state(); return plan

@app.get('/platform/subscriptions')
def platform_subscriptions(x_auth_token: str | None = Header(default=None)):
    _platform_actor(x_auth_token)
    rows=[]
    for sub in subscriptions.values():
        _refresh_subscription_status(sub)
        account=tenant_accounts.get(sub.tenant_id)
        rows.append({"subscription":sub.model_dump(),"summary":_subscription_summary(sub),"account":account.model_dump() if account else None})
    return sorted(rows,key=lambda x:(x["summary"].get("status", ""), (x["account"] or {}).get("apartment_name", "").lower()))

@app.get('/platform/accounts/{tenant_id}/subscription')
def platform_account_subscription(tenant_id: str, x_auth_token: str | None = Header(default=None)):
    _platform_actor(x_auth_token)
    account=tenant_accounts.get(tenant_id)
    if not account: raise HTTPException(status_code=404, detail="Property account not found.")
    sub=_subscription_for_tenant(tenant_id)
    return {"account":account.model_dump(),"subscription":sub.model_dump() if sub else None,"summary":_subscription_summary(sub),"history":[h.model_dump() for h in sorted([x for x in subscription_history if x.tenant_id==tenant_id],key=lambda x:x.changed_at,reverse=True)]}

@app.post('/platform/accounts/{tenant_id}/subscription/trial-extension')
def platform_extend_trial(tenant_id: str, data: SubscriptionTrialExtensionInput, x_auth_token: str | None = Header(default=None)):
    actor=_platform_actor(x_auth_token); account=tenant_accounts.get(tenant_id); sub=_subscription_for_tenant(tenant_id)
    if not account: raise HTTPException(status_code=404, detail="Property account not found.")
    if not sub: raise HTTPException(status_code=404, detail="Subscription not found.")
    if not subscription_settings.allow_trial_extension: raise HTTPException(status_code=403, detail="Trial extension is disabled by Product Owner policy.")
    if sub.subscription_type != "TRIAL": raise HTTPException(status_code=409, detail="Only Trial subscriptions can be extended.")
    max_days = data.value if data.unit=="Days" else data.value*31
    configured_max = subscription_settings.max_trial_extension_value if subscription_settings.max_trial_extension_unit=="Days" else subscription_settings.max_trial_extension_value*31
    if max_days > configured_max: raise HTTPException(status_code=422, detail="Trial extension exceeds the Product Owner maximum.")
    old=sub.model_copy(); base=sub.trial_end_date or date.today().isoformat(); sub.trial_end_date=_add_period(base,data.value,data.unit); sub.grace_start_date=None; sub.grace_end_date=None; sub.status="TRIAL"; sub.last_reason=data.reason; sub.updated_at=datetime.now().isoformat(timespec="seconds")
    _record_subscription_history(sub,actor.username,"Trial Extended",data.reason,old=old)
    platform_audit.append({"at":sub.updated_at,"event":"Trial Extended","actor":actor.username,"detail":f"{account.account_id}; {data.value} {data.unit}; {data.reason}"})
    _save_state(); return {"subscription":sub,"summary":_subscription_summary(sub)}

@app.post('/platform/accounts/{tenant_id}/subscription/complimentary')
def platform_make_complimentary(tenant_id: str, data: ComplimentarySubscriptionInput, x_auth_token: str | None = Header(default=None)):
    actor=_platform_actor(x_auth_token); account=tenant_accounts.get(tenant_id); sub=_subscription_for_tenant(tenant_id)
    if not account: raise HTTPException(status_code=404, detail="Property account not found.")
    if not sub: raise HTTPException(status_code=404, detail="Subscription not found.")
    if not subscription_settings.allow_complimentary: raise HTTPException(status_code=403, detail="Complimentary subscriptions are disabled by Product Owner policy.")
    if data.valid_to and data.valid_to < date.today().isoformat(): raise HTTPException(status_code=422, detail="Complimentary validity date cannot be in the past.")
    old=sub.model_copy(); sub.subscription_type="COMPLIMENTARY"; sub.status="ACTIVE"; sub.payment_status="NOT_REQUIRED"; sub.end_date=data.valid_to; sub.last_reason=data.reason; sub.updated_at=datetime.now().isoformat(timespec="seconds")
    _record_subscription_history(sub,actor.username,"Complimentary Granted",data.reason,old=old)
    platform_audit.append({"at":sub.updated_at,"event":"Complimentary Subscription Granted","actor":actor.username,"detail":f"{account.account_id}; valid_to={data.valid_to or 'No expiry'}; {data.reason}"})
    _save_state(); return {"subscription":sub,"summary":_subscription_summary(sub)}

@app.post('/platform/accounts/{tenant_id}/subscription/assign-plan/{plan_id}')
def platform_assign_plan(tenant_id: str, plan_id: str, x_auth_token: str | None = Header(default=None)):
    actor=_platform_actor(x_auth_token); account=tenant_accounts.get(tenant_id); sub=_subscription_for_tenant(tenant_id); plan=subscription_plans.get(plan_id)
    if not account: raise HTTPException(status_code=404, detail="Property account not found.")
    if not sub: raise HTTPException(status_code=404, detail="Subscription not found.")
    if not plan or not plan.active: raise HTTPException(status_code=404, detail="Active subscription plan not found.")
    old=sub.model_copy(); sub.plan_id=plan.id; sub.subscription_type="PAID"; sub.status="PAST_DUE"; sub.payment_status="PENDING"; sub.start_date=sub.start_date or date.today().isoformat(); sub.last_reason=f"Plan assigned by Product Owner: {plan.name}"; sub.updated_at=datetime.now().isoformat(timespec="seconds")
    _record_subscription_history(sub,actor.username,"Plan Assigned",sub.last_reason,old=old); platform_audit.append({"at":sub.updated_at,"event":"Subscription Plan Assigned","actor":actor.username,"detail":f"{account.account_id}; {plan.name}"}); _save_state()
    return {"subscription":sub,"summary":_subscription_summary(sub)}

@app.post('/platform/accounts/{tenant_id}/subscription/cancel')
def platform_cancel_subscription(tenant_id: str, reason: str = Body(default="", embed=True), x_auth_token: str | None = Header(default=None)):
    actor=_platform_actor(x_auth_token); sub=_subscription_for_tenant(tenant_id); account=tenant_accounts.get(tenant_id)
    if not account or not sub: raise HTTPException(status_code=404, detail="Subscription not found.")
    old=sub.model_copy(); sub.status="CANCELLED"; sub.last_reason=reason or "Subscription cancelled by Product Owner"; sub.updated_at=datetime.now().isoformat(timespec="seconds")
    _record_subscription_history(sub,actor.username,"Cancelled",sub.last_reason,old=old); platform_audit.append({"at":sub.updated_at,"event":"Subscription Cancelled","actor":actor.username,"detail":f"{account.account_id}; {sub.last_reason}"}); _save_state(); return {"subscription":sub,"summary":_subscription_summary(sub)}

@app.post('/subscription/checkout')
def subscription_checkout(x_apartcare_token: str | None = Header(default=None)):
    _, account = _tenant_actor(x_apartcare_token); sub=_subscription_for_tenant(account.tenant_id)
    if not sub: raise HTTPException(status_code=404, detail="Subscription not found.")
    plan=subscription_plans.get(sub.plan_id) if sub.plan_id else (subscription_plans.get(subscription_settings.default_plan_id) if subscription_settings.default_plan_id else None)
    if not plan: raise HTTPException(status_code=409, detail="No subscription plan is assigned. Contact Product Owner.")
    if not _razorpay_enabled():
        raise HTTPException(status_code=503, detail="Razorpay Test Mode is not configured yet. Set RAZORPAY_ENABLED=true, RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the backend; never store the API secret in browser or source code.")
    # V6.5.0 deliberately returns a secure integration hand-off rather than inventing a checkout.
    return {"gateway":"Razorpay","mode":"test" if os.getenv("RAZORPAY_KEY_ID","").startswith("rzp_test_") else "live","key_id":os.getenv("RAZORPAY_KEY_ID"),"tenant_id":account.tenant_id,"account_id":account.account_id,"plan":plan.model_dump(),"message":"Razorpay integration is ready for server-side subscription provisioning. Configure test credentials before enabling checkout."}

@app.post('/webhooks/razorpay')
async def razorpay_webhook(request: Request):
    raw=await request.body(); signature=request.headers.get("X-Razorpay-Signature","")
    if not _razorpay_signature_valid(raw,signature): raise HTTPException(status_code=401, detail="Invalid Razorpay webhook signature.")
    try: payload=json.loads(raw.decode("utf-8"))
    except Exception: raise HTTPException(status_code=400, detail="Invalid webhook JSON.")
    event_id=str(payload.get("id") or payload.get("event_id") or hashlib.sha256(raw).hexdigest())
    if any(e.gateway_event_id==event_id for e in subscription_events): return {"status":"duplicate_ignored"}
    event_type=str(payload.get("event") or "unknown")
    entity=((payload.get("payload") or {}).get("subscription") or {}).get("entity") or {}
    gateway_sub=str(entity.get("id") or "")
    sub=next((x for x in subscriptions.values() if x.gateway_subscription_id and x.gateway_subscription_id==gateway_sub),None)
    tenant_id=sub.tenant_id if sub else ""
    event=SubscriptionEvent(id=str(uuid4()),tenant_id=tenant_id,subscription_id=sub.id if sub else "",gateway_event_id=event_id,event_type=event_type,event_time=datetime.now().isoformat(timespec="seconds"),received_at=datetime.now().isoformat(timespec="seconds"),payload_hash=hashlib.sha256(raw).hexdigest())
    if not sub:
        event.status="Ignored"; event.detail="No ApartCare subscription matched the Razorpay subscription ID."; subscription_events.append(event); _save_state(); return {"status":"ignored"}
    old=sub.model_copy()
    if event_type=="subscription.activated": sub.status="ACTIVE"; sub.payment_status="PAID"; sub.subscription_type="PAID"
    elif event_type in {"subscription.pending","payment.failed"}: sub.status="PAST_DUE"; sub.payment_status="FAILED"
    elif event_type=="subscription.halted": sub.status="RESTRICTED"; sub.payment_status="FAILED"
    elif event_type in {"payment.captured","invoice.paid"}: sub.status="ACTIVE"; sub.payment_status="PAID"
    elif event_type in {"payment.refunded","refund.processed"}: sub.payment_status="REFUNDED"
    else: event.status="Ignored"
    sub.updated_at=datetime.now().isoformat(timespec="seconds"); event.processed_at=sub.updated_at; event.detail="Webhook applied" if event.status=="Processed" else "Event type not mapped"
    subscription_events.append(event)
    if event.status=="Processed": _record_subscription_history(sub,"razorpay","Gateway Event",event_type,old=old)
    _save_state(); return {"status":"processed" if event.status=="Processed" else "ignored"}

@app.get('/platform/status')
def platform_status():
    return {"initialized": platform_owner is not None, "version":"6.5.13", "tenant_count":len(tenant_accounts), "subscription_count":len(subscriptions)}

@app.post('/platform/bootstrap')
def platform_bootstrap(data: PlatformBootstrapInput, background_tasks: BackgroundTasks):
    global platform_owner, platform_owner_password, platform_password_policy_initialized
    if platform_owner is not None:
        raise HTTPException(status_code=409, detail="Product Owner is already configured.")
    now=datetime.now().isoformat(timespec='seconds')
    platform_owner=AdminUser(id=str(uuid4()),username=data.username.strip(),full_name=data.full_name.strip(),email=data.email.strip().lower(),role="Super Admin",created_at=now,updated_at=now,force_password_change=False)
    platform_owner_password=_password_hash(data.password)
    platform_password_policy_initialized=True
    token=secrets.token_urlsafe(32); platform_sessions[token]=platform_owner.id
    # Never make Platform Owner creation wait for SMTP. Persistence is the core
    # operation; email delivery is optional and runs after the response is prepared.
    email_configured=bool(os.getenv('APARTCARE_SMTP_APP_PASSWORD'))
    email_message=("Platform Owner created. Welcome email queued for delivery." if email_configured
                   else "Platform Owner created. Email is not configured; set APARTCARE_SMTP_APP_PASSWORD to enable delivery.")
    if email_configured:
        background_tasks.add_task(_send_platform_welcome_email, platform_owner.email, platform_owner.full_name, platform_owner.username)
    platform_audit.append({"at":now,"event":"Platform Initialized","actor":platform_owner.username,"detail":email_message})
    _save_state()
    return {"user":platform_owner,"token":token,"display_role":"Product Owner","force_password_change":False,"email_sent":None,"email_message":email_message}

@app.post('/platform/login')
def platform_login(data: AdminLoginInput):
    if platform_owner is None or data.username.lower()!=platform_owner.username.lower() or _password_hash(data.password)!=platform_owner_password:
        raise HTTPException(status_code=401, detail="Invalid Product Owner credentials.")
    # FIX 12: normal Platform Owner creation never requires a password change.
    # Preserve the forced flag only when it came from an explicit reset.
    if platform_owner.force_password_change and platform_owner.created_at == platform_owner.updated_at:
        platform_owner.force_password_change=False
    token=secrets.token_urlsafe(32); platform_sessions[token]=platform_owner.id
    platform_audit.append({"at":datetime.now().isoformat(timespec='seconds'),"event":"Product Owner Login","actor":platform_owner.username,"detail":"Success"})
    _save_state()
    return {"user":platform_owner,"token":token,"display_role":"Product Owner","force_password_change":bool(platform_owner.force_password_change)}

@app.post('/platform/logout')
def platform_logout(x_auth_token: str | None = Header(default=None)):
    """Invalidate only the current Platform Owner token. Platform credentials
    are never persisted in browser storage and the token cannot be reused after logout."""
    if x_auth_token:
        actor_id=platform_sessions.pop(x_auth_token, None)
        if actor_id and platform_owner:
            platform_audit.append({"at":datetime.now().isoformat(timespec='seconds'),"event":"Product Owner Logout","actor":platform_owner.username,"detail":"Success"})
    return {"logged_out":True}

@app.post('/platform/auth/change-password', response_model=AdminUser)
def platform_change_own_password(data: ChangePasswordInput, x_auth_token: str | None = Header(default=None)):
    global platform_owner_password, platform_password_policy_initialized
    actor=_platform_actor(x_auth_token)
    platform_owner_password=_password_hash(data.new_password)
    actor.force_password_change=False
    platform_password_policy_initialized=True
    actor.updated_at=datetime.now().isoformat(timespec="seconds")
    platform_audit.append({"at":actor.updated_at,"event":"Platform Password Changed","actor":actor.username,"detail":"Platform Owner password changed"})
    _save_state()
    return actor

@app.get('/platform/accounts', response_model=list[TenantAccount])
def platform_accounts(x_auth_token: str | None = Header(default=None)):
    _platform_actor(x_auth_token)
    today=date.today().isoformat()
    result=[]
    for a in tenant_accounts.values():
        if a.valid_to < today and a.status=="Active":
            a.status="Expired"
        users=sorted(tenant_users.get(a.tenant_id, []), key=lambda u:(u.role!="Admin",u.username.lower()))
        payload=_account_payload(a)
        payload["users"] = users
        result.append(TenantAccount(**payload))
    return sorted(result,key=lambda a:a.created_at, reverse=True)

@app.post('/platform/accounts/{tenant_id}/support-session')
def platform_support_session(tenant_id: str, x_auth_token: str | None = Header(default=None)):
    """Start an ephemeral read-only audit/support session for one apartment.
    The Platform Owner does not receive or reuse the apartment Admin password."""
    actor=_platform_actor(x_auth_token)
    account=tenant_accounts.get(tenant_id)
    if not account:
        raise HTTPException(status_code=404, detail="Property account not found.")
    user=next((u for u in tenant_users.get(tenant_id,[]) if u.role=="Admin"), None)
    if user is None:
        raise HTTPException(status_code=404, detail="No Administrator exists for this property account.")
    support_user=AdminUser(id=f"support-{uuid4()}",username=f"PLATFORM_AUDIT_{account.account_id}",full_name=f"Platform Owner — {account.apartment_name}",email=actor.email,mobile_no=actor.mobile_no,role="Viewer",active=True,locked=False,tenant_id=tenant_id,created_at=datetime.now().isoformat(timespec="seconds"),updated_at=datetime.now().isoformat(timespec="seconds"))
    token=secrets.token_urlsafe(32)
    platform_support_sessions[token]=(tenant_id,support_user)
    platform_audit.append({"at":datetime.now().isoformat(timespec="seconds"),"event":"Apartment Audit/Support Session Started","actor":actor.username,"detail":f"{account.account_id} ({account.apartment_name}); read-only"})
    _save_state()
    return {"token":token,"user":support_user,"account":account.model_dump(),"users":[u.model_dump() for u in sorted(tenant_users.get(tenant_id,[]), key=lambda u:(u.role!="Admin",u.username.lower()))],"mode":"Audit/Support (Read Only)"}

@app.post('/platform/support-session/logout')
def platform_support_session_logout(x_auth_token: str | None = Header(default=None)):
    session=platform_support_sessions.pop(x_auth_token or "",None)
    return {"logged_out":True,"tenant_id":session[0] if session else None}

@app.post('/platform/accounts', response_model=TenantAccount, status_code=201)
def platform_create_account(data: PlatformTenantCreateInput, x_auth_token: str | None = Header(default=None)):
    _platform_actor(x_auth_token)
    if any(a.apartment_name.lower()==data.apartment_name.strip().lower() and a.city.lower()==data.city.strip().lower() for a in tenant_accounts.values()):
        raise HTTPException(status_code=409, detail="A property account with the same name and city already exists.")
    # User IDs are tenant-scoped, not globally scoped. Account Number + User ID
    # identifies the login namespace for an apartment.
    try:
        if data.valid_from > data.valid_to: raise ValueError
    except Exception: raise HTTPException(status_code=422, detail="Validity To must be on or after Validity From.")
    now=datetime.now().isoformat(timespec='seconds'); tid=str(uuid4())
    admin_mobile=''.join(ch for ch in data.admin_mobile.strip() if ch.isdigit() or ch=='+')
    if admin_mobile and len([c for c in admin_mobile if c.isdigit()]) < 7:
        raise HTTPException(status_code=422, detail="Enter a valid Administrator Mobile Number.")
    admin_email=data.admin_email.strip().lower()
    if admin_email and ('@' not in admin_email or '.' not in admin_email.rsplit('@',1)[-1]):
        raise HTTPException(status_code=422, detail="Enter a valid Administrator Email address.")
    account=TenantAccount(tenant_id=tid,account_id=_account_id_for(data.country,data.state),apartment_name=data.apartment_name.strip(),address=data.address.strip(),city=data.city.strip(),state=data.state.strip(),pin_code=data.pin_code.strip(),country=data.country.strip(),language=data.language.strip(),data_start_month="",valid_from=data.valid_from,valid_to=data.valid_to,status=data.status,created_at=now,account_mobile=admin_mobile,account_email=admin_email)
    tenant_accounts[tid]=account
    _record_account_validity_history(account, "Created", platform_owner.username if platform_owner else "system", "Apartment account created by Platform Owner")
    # Universal password policy: every newly created property user starts with
    # a temporary password and must change it on first login.
    admin=AdminUser(id=str(uuid4()),username=data.admin_username.strip(),full_name=data.admin_name.strip(),email=admin_email,mobile_no=admin_mobile,role="Admin",created_at=now,updated_at=now,tenant_id=tid,force_password_change=False)
    tenant_users[tid]=[admin]; tenant_passwords[admin.id]=_password_hash(data.password)
    _create_subscription_for_tenant(tid, now, platform_owner.username if platform_owner else "system")
    # Seed the standard utility directory inside the new tenant namespace.
    for category_name in DEFAULT_UTILITY_CATEGORIES:
        utility_categories.append(UtilityCategory(id=f"UTC-{uuid4()}",apartment_id=tid,name=category_name,active=True,created_at=now,updated_at=now,created_by="system"))
    platform_audit.append({"at":now,"event":"Property Account Created","actor":platform_owner.username if platform_owner else "system","detail":account.account_id})
    _save_state()
    return account

@app.patch('/platform/accounts/{tenant_id}', response_model=TenantAccount)
def platform_update_account(tenant_id: str, data: TenantStatusUpdate, x_auth_token: str | None = Header(default=None)):
    actor=_platform_actor(x_auth_token); account=tenant_accounts.get(tenant_id)
    if not account: raise HTTPException(status_code=404, detail="Property account not found.")
    old=(account.status, account.valid_from, account.valid_to)
    new_status=data.status
    new_from=data.valid_from if data.valid_from is not None else account.valid_from
    new_to=data.valid_to if data.valid_to is not None else account.valid_to
    if new_from>new_to: raise HTTPException(status_code=422, detail="Validity To must be on or after Validity From.")
    account.status=new_status; account.valid_from=new_from; account.valid_to=new_to
    changed=old != (account.status, account.valid_from, account.valid_to)
    if changed:
        _record_account_validity_history(account, "Updated", actor.username, data.reason or "Account validity/status updated")
        platform_audit.append({"at":datetime.now().isoformat(timespec='seconds'),"event":"Account Updated","actor":actor.username,"detail":f"{account.account_id}: {data.status}; {data.reason}"})
        _save_state()
    return account

@app.post('/platform/accounts/{tenant_id}/lock', response_model=TenantAccount)
def platform_lock_account(tenant_id: str, reason: str = Body(default="", embed=True), x_auth_token: str | None = Header(default=None)):
    actor=_platform_actor(x_auth_token); account=tenant_accounts.get(tenant_id)
    if not account: raise HTTPException(status_code=404, detail="Property account not found.")
    reason=" ".join(str(reason or "").strip().split())
    if len(reason) < 3: raise HTTPException(status_code=422, detail="Lock justification is mandatory (minimum 3 characters).")
    if account.status == "Suspended": return account
    account.status="Suspended"
    _record_account_validity_history(account, "Locked", actor.username, reason)
    platform_audit.append({"at":datetime.now().isoformat(timespec='seconds'),"event":"Account Locked","actor":actor.username,"detail":f"{account.account_id}; {reason}"})
    _save_state(); return account

@app.post('/platform/accounts/{tenant_id}/unlock', response_model=TenantAccount)
def platform_unlock_account(tenant_id: str, reason: str = Body(default="", embed=True), x_auth_token: str | None = Header(default=None)):
    actor=_platform_actor(x_auth_token); account=tenant_accounts.get(tenant_id)
    if not account: raise HTTPException(status_code=404, detail="Property account not found.")
    reason=" ".join(str(reason or "").strip().split())
    if len(reason) < 3: raise HTTPException(status_code=422, detail="Unlock justification is mandatory (minimum 3 characters).")
    if account.valid_to < date.today().isoformat():
        raise HTTPException(status_code=409, detail="Account validity has expired. Extend the validity period before unlocking.")
    if account.status == "Active": return account
    account.status="Active"
    _record_account_validity_history(account, "Unlocked", actor.username, reason)
    platform_audit.append({"at":datetime.now().isoformat(timespec='seconds'),"event":"Account Unlocked","actor":actor.username,"detail":f"{account.account_id}; {reason}"})
    _save_state(); return account

@app.get('/platform/accounts/{tenant_id}/validity-history', response_model=list[TenantAccountValidityHistory])
def platform_account_validity_history(tenant_id: str, x_auth_token: str | None = Header(default=None)):
    _platform_actor(x_auth_token)
    if tenant_id not in tenant_accounts: raise HTTPException(status_code=404, detail="Property account not found.")
    return sorted([h for h in tenant_account_validity_history if h.tenant_id==tenant_id], key=lambda h:h.changed_at, reverse=True)


def _purge_tenant_data(tenant_id: str) -> dict:
    """Remove one apartment tenant and every tenant-scoped operational record.

    This is intentionally platform-only. It does not delete the Platform Owner.
    The operation is used for virgin-system testing and explicit tenant retirement.
    """
    global charge_settings, payments, payment_month_locks, payment_lock_events
    global expenses, expense_lock_events, expense_deletion_history, admin_users, admin_passwords
    global login_history, watchmen, watchman_history, utility_categories, utility_category_history
    global utility_contacts, utility_contact_history, opening_balances, opening_balance_history
    global residents, flat_history, maintenance_rows, water_headers, tenant_accounts, tenant_users, tenant_passwords, auth_sessions

    account = tenant_accounts.get(tenant_id)
    if not account:
        raise HTTPException(status_code=404, detail="Property account not found.")

    user_ids = {u.id for u in tenant_users.get(tenant_id, [])}
    user_ids.update(u.id for u in admin_users if getattr(u, "tenant_id", "") == tenant_id)

    counts = {
        "users": len(user_ids),
        "residents": sum(1 for x in residents if x.apartment_id == tenant_id),
        "maintenance": sum(1 for x in maintenance_rows if x.apartment_id == tenant_id),
        "payments": sum(1 for x in payments if x.apartment_id == tenant_id),
        "expenses": sum(1 for x in expenses if x.apartment_id == tenant_id),
        "utilities": sum(1 for x in utility_contacts if x.apartment_id == tenant_id),
        "utility_categories": sum(1 for x in utility_categories if x.apartment_id == tenant_id),
        "watchmen": sum(1 for x in watchmen if x.apartment_id == tenant_id),
    }

    charge_settings.pop(tenant_id, None)
    payments[:] = [x for x in payments if x.apartment_id != tenant_id]
    payment_month_locks = {k:v for k,v in payment_month_locks.items() if k[0] != tenant_id}
    payment_lock_events[:] = [x for x in payment_lock_events if x.get("apartment_id") != tenant_id]
    expenses[:] = [x for x in expenses if x.apartment_id != tenant_id]
    expense_lock_events[:] = [x for x in expense_lock_events if x.get("apartment_id") != tenant_id]
    expense_deletion_history[:] = [x for x in expense_deletion_history if x.get("apartment_id") != tenant_id]
    admin_users[:] = [u for u in admin_users if getattr(u, "tenant_id", "") != tenant_id]
    admin_passwords = {k:v for k,v in admin_passwords.items() if k not in user_ids}
    login_history[:] = [x for x in login_history if getattr(x, "tenant_id", "") != tenant_id and x.user_id not in user_ids]
    watchmen[:] = [x for x in watchmen if x.apartment_id != tenant_id]
    watchman_history[:] = [x for x in watchman_history if x.get("apartment_id") != tenant_id]
    utility_categories[:] = [x for x in utility_categories if x.apartment_id != tenant_id]
    utility_category_history[:] = [x for x in utility_category_history if x.apartment_id != tenant_id]
    utility_contacts[:] = [x for x in utility_contacts if x.apartment_id != tenant_id]
    utility_contact_history[:] = [x for x in utility_contact_history if x.apartment_id != tenant_id]
    opening_balances.pop(tenant_id, None)
    opening_balance_history[:] = [x for x in opening_balance_history if x.apartment_id != tenant_id]
    residents[:] = [x for x in residents if x.apartment_id != tenant_id]
    flat_history[:] = [x for x in flat_history if x.apartment_id != tenant_id]
    maintenance_rows[:] = [x for x in maintenance_rows if x.apartment_id != tenant_id]
    water_headers = {k:v for k,v in water_headers.items() if k[0] != tenant_id}
    tenant_passwords = {k:v for k,v in tenant_passwords.items() if k not in user_ids}
    tenant_users.pop(tenant_id, None)
    tenant_accounts.pop(tenant_id, None)
    auth_sessions = {token:uid for token,uid in auth_sessions.items() if uid not in user_ids}
    return counts


@app.delete('/platform/accounts/{tenant_id}')
def platform_delete_account(tenant_id: str, x_auth_token: str | None = Header(default=None)):
    # Destructive tenant deletion is intentionally disabled in V6.4.48. Account
    # lifecycle is a time dimension and must be represented by lock/unlock + history.
    _platform_actor(x_auth_token)
    if tenant_id not in tenant_accounts: raise HTTPException(status_code=404, detail="Property account not found.")
    raise HTTPException(status_code=410, detail="Permanent Apartment Account deletion is disabled. Use Lock/Unlock and retain the validity history.")

@app.post('/tenant/login')
def tenant_login(data: AdminLoginInput, account_id: str):
    account=next((a for a in tenant_accounts.values() if a.account_id.upper()==account_id.upper()),None)
    if not account: raise HTTPException(status_code=401, detail="Invalid Account ID or credentials.")
    if account.status!="Active" or account.valid_from>date.today().isoformat() or account.valid_to<date.today().isoformat():
        raise HTTPException(status_code=403, detail="Property account is not currently active.")
    user=next((u for u in tenant_users.get(account.tenant_id,[]) if u.username.lower()==data.username.lower()),None)
    if not user or user.locked or not user.active or tenant_passwords.get(user.id)!=_password_hash(data.password):
        raise HTTPException(status_code=401, detail="Invalid User ID or password.")
    user.tenant_id=account.tenant_id
    token=secrets.token_urlsafe(32); tenant_sessions[token]=(account.tenant_id,user.id); auth_sessions[token]=user.id
    return {"user":user,"token":token,"account":account}


class PlatformPasswordResetRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=5, max_length=120)

@app.post('/platform/request-password-reset')
def platform_request_password_reset(data: PlatformPasswordResetRequest):
    if platform_owner is None: raise HTTPException(status_code=404, detail="Platform Owner is not configured.")
    if data.username.strip().lower()!=platform_owner.username.lower() or data.email.strip().lower()!=platform_owner.email.lower():
        raise HTTPException(status_code=404, detail="Platform Owner User ID and recovery email do not match.")
    token=secrets.token_urlsafe(24)
    password_reset_tokens[token]={"user_id":platform_owner.id,"account_id":"PLATFORM","expires_at":(datetime.now()+timedelta(minutes=30)).isoformat(),"used":False,"scope":"platform"}
    sent,msg=_send_password_reset_email(platform_owner.email,platform_owner.full_name,"PLATFORM",token)
    if not sent: password_reset_tokens.pop(token,None); raise HTTPException(status_code=503, detail=msg)
    platform_audit.append({"at":datetime.now().isoformat(timespec='seconds'),"event":"Platform Password Reset Requested","actor":platform_owner.username,"detail":"Reset email sent"})
    _save_state(); return {"message":msg}

@app.post('/platform/confirm-password-reset')
def platform_confirm_password_reset(data: PasswordResetConfirmInput):
    global platform_owner_password, platform_password_policy_initialized
    if platform_owner is None: raise HTTPException(status_code=404, detail="Platform Owner is not configured.")
    record=password_reset_tokens.get(data.token)
    if not record or record.get("scope")!="platform" or record.get("used") or datetime.fromisoformat(record["expires_at"])<datetime.now() or record.get("user_id")!=platform_owner.id:
        raise HTTPException(status_code=400, detail="Reset code is invalid, expired, or already used.")
    platform_owner_password=_password_hash(data.new_password); platform_password_policy_initialized=True; record["used"]=True
    platform_audit.append({"at":datetime.now().isoformat(timespec='seconds'),"event":"Platform Password Reset","actor":platform_owner.username,"detail":"Password reset completed"})
    _save_state(); return {"message":"Platform Owner password reset successfully."}

@app.get('/platform/accounts/{tenant_id}/users')
def platform_account_users(tenant_id: str, x_auth_token: str | None = Header(default=None)):
    _platform_actor(x_auth_token)
    account=tenant_accounts.get(tenant_id)
    if not account: raise HTTPException(status_code=404, detail="Property account not found.")
    users=sorted(tenant_users.get(tenant_id, []), key=lambda u:(u.role!="Admin",u.username.lower()))
    return {"account":account.model_dump(),"users":[u.model_dump() for u in users]}

@app.post('/platform/accounts/{tenant_id}/users/{user_id}/unlock', response_model=AdminUser)
def platform_unlock_property_user(tenant_id: str, user_id: str, x_auth_token: str | None = Header(default=None)):
    actor=_platform_actor(x_auth_token)
    account=tenant_accounts.get(tenant_id)
    if not account: raise HTTPException(status_code=404, detail="Property account not found.")
    user=next((u for u in tenant_users.get(tenant_id,[]) if u.id==user_id),None)
    if not user: raise HTTPException(status_code=404, detail="User not found in selected property account.")
    user.locked=False; user.active=True; user.updated_at=datetime.now().isoformat(timespec='seconds')
    failed_login_counts.pop(f"{tenant_id}:{user.username.lower()}",None); failed_login_counts.pop(user.username.lower(),None)
    _audit(actor.username,"Success","Platform Unlock",f"{account.account_id}; unlocked {user.username}",user.id,tenant_id)
    _save_state(); return user

@app.post('/platform/accounts/{tenant_id}/users/{user_id}/reset-password', response_model=AdminUser)
def platform_reset_property_user_password(tenant_id: str, user_id: str, data: PasswordResetInput, x_auth_token: str | None = Header(default=None)):
    actor=_platform_actor(x_auth_token)
    account=tenant_accounts.get(tenant_id)
    if not account: raise HTTPException(status_code=404, detail="Property account not found.")
    user=next((u for u in tenant_users.get(tenant_id,[]) if u.id==user_id),None)
    if not user: raise HTTPException(status_code=404, detail="User not found in selected property account.")
    new_hash=_password_hash(data.new_password)
    admin_passwords[user.id]=new_hash
    tenant_passwords[user.id]=new_hash
    user.force_password_change=True; user.locked=False; user.active=True; user.updated_at=datetime.now().isoformat(timespec='seconds')
    failed_login_counts.pop(f"{tenant_id}:{user.username.lower()}",None); failed_login_counts.pop(user.username.lower(),None)
    _audit(actor.username,"Success","Platform Password Reset",f"{account.account_id}; reset {user.username}",user.id,tenant_id)
    _save_state(); return user

def _platform_history_rows() -> list[dict]:
    rows=[]
    for h in login_history:
        account=tenant_accounts.get(h.tenant_id) if h.tenant_id else None
        rows.append({**h.model_dump(),"scope":"Tenant","account_id":account.account_id if account else "","apartment_name":account.apartment_name if account else ""})
    for event in platform_audit:
        rows.append({"id":f"platform-{event.get('at','')}-{event.get('event','')}","username":event.get('actor',''),"user_id":None,"tenant_id":"","status":"Success","event":event.get('event','Platform Event'),"at":event.get('at',''),"reason":event.get('detail',''),"scope":"Platform","account_id":"","apartment_name":"Platform"})
    return rows

def _history_matches(row: dict, q: str = "", account_id: str = "", user_id: str = "", event_type: str = "", from_date: str = "", to_date: str = "") -> bool:
    d=str(row.get("at", ""))[:10]
    if from_date and d < from_date: return False
    if to_date and d > to_date: return False
    if account_id and str(row.get("account_id","")).casefold()!=account_id.strip().casefold(): return False
    if user_id and str(row.get("username","")).casefold()!=user_id.strip().casefold(): return False
    if event_type and str(row.get("event","")).casefold()!=event_type.strip().casefold(): return False
    if q:
        text=" ".join(str(row.get(k,"")) for k in ("account_id","apartment_name","username","event","status","reason")).casefold()
        if q.strip().casefold() not in text: return False
    return True

@app.get('/platform/login-history')
def platform_login_history(x_auth_token: str | None = Header(default=None), q: str = "", account_id: str = "", user_id: str = "", event_type: str = "", from_date: str = "", to_date: str = ""):
    _platform_actor(x_auth_token)
    rows=[r for r in _platform_history_rows() if _history_matches(r,q,account_id,user_id,event_type,from_date,to_date)]
    return sorted(rows,key=lambda x:x.get('at',''),reverse=True)

@app.get('/platform/login-history/download')
def platform_login_history_download(x_auth_token: str | None = Header(default=None), q: str = "", account_id: str = "", user_id: str = "", event_type: str = "", from_date: str = "", to_date: str = ""):
    _platform_actor(x_auth_token)
    rows=[r for r in _platform_history_rows() if _history_matches(r,q,account_id,user_id,event_type,from_date,to_date)]
    output=io.StringIO(); writer=__import__('csv').writer(output)
    writer.writerow(["Date / Time","Account Number","Apartment","User ID","Event","Status","Reason / Details"])
    for r in sorted(rows,key=lambda x:x.get('at',''),reverse=True):
        writer.writerow([r.get('at',''),r.get('account_id',''),r.get('apartment_name',''),r.get('username',''),r.get('event',''),r.get('status',''),r.get('reason','')])
    return StreamingResponse(iter([output.getvalue().encode('utf-8-sig')]),media_type='text/csv; charset=utf-8',headers={'Content-Disposition':'attachment; filename="ApartCare_Global_Login_Audit_History.csv"'})

@app.delete('/platform/login-history')
def platform_login_history_purge(x_auth_token: str | None = Header(default=None), q: str = "", account_id: str = "", user_id: str = "", event_type: str = "", from_date: str = "", to_date: str = ""):
    actor=_platform_actor(x_auth_token)
    if not any([q.strip(),account_id.strip(),user_id.strip(),event_type.strip(),from_date.strip(),to_date.strip()]):
        raise HTTPException(status_code=422,detail="At least one filter criterion is required before deleting audit history.")
    if from_date and to_date and from_date>to_date:
        raise HTTPException(status_code=422,detail="From Date cannot be after To Date.")
    before_login=len(login_history); before_platform=len(platform_audit)
    tenant_ids={a.tenant_id for a in tenant_accounts.values() if account_id and a.account_id.casefold()==account_id.strip().casefold()}
    def keep_login(h: LoginAttempt):
        row=next((r for r in _platform_history_rows() if r.get('id')==h.id),None)
        return not (row and _history_matches(row,q,account_id,user_id,event_type,from_date,to_date))
    login_history[:]=[h for h in login_history if keep_login(h)]
    # Platform audit entries are only eligible when no tenant-specific Account/User filter is supplied.
    if account_id or user_id:
        platform_removed=0
    else:
        retained=[]
        for event in platform_audit:
            row={"account_id":"","apartment_name":"Platform","username":event.get('actor',''),"event":event.get('event','Platform Event'),"status":"Success","at":event.get('at',''),"reason":event.get('detail','')}
            if _history_matches(row,q,account_id,user_id,event_type,from_date,to_date):
                continue
            retained.append(event)
        platform_removed=before_platform-len(retained); platform_audit[:]=retained
    removed=(before_login-len(login_history))+platform_removed
    now=datetime.now().isoformat(timespec='seconds')
    platform_audit.append({"at":now,"event":"Audit History Purged","actor":actor.username,"detail":json.dumps({"removed":removed,"q":q,"account_id":account_id,"user_id":user_id,"event_type":event_type,"from_date":from_date,"to_date":to_date},ensure_ascii=False)})
    _save_state()
    return {"removed":removed,"criteria":{"q":q,"account_id":account_id,"user_id":user_id,"event_type":event_type,"from_date":from_date,"to_date":to_date},"purge_recorded":True}

# ---------- Durable local storage (testing and day-to-day development) ----------
STATE_FILE = Path(os.getenv('APARTCARE_STATE_FILE', str(RUNTIME_DIR / 'apartcare_state.json')))
DATABASE_URL = os.getenv('DATABASE_URL') or os.getenv('POSTGRES_URL') or os.getenv('POSTGRES_URL_NON_POOLING')
DB_STATE_TABLE = 'apartcare_state'
_DB_POOL = None
_DB_TABLE_READY = False
_DB_POOL_LOCK = threading.Lock()
_LOCAL_DB_VERSION = 0
_STATE_SAVED_THIS_REQUEST = contextvars.ContextVar('apartcare_state_saved_this_request', default=False)

def _get_db_pool():
    global _DB_POOL
    if not DATABASE_URL:
        return None
    if _DB_POOL is not None:
        return _DB_POOL
    if ConnectionPool is None:
        # Safe fallback for environments where psycopg-pool was not packaged.
        return None
    with _DB_POOL_LOCK:
        if _DB_POOL is None:
            _DB_POOL = ConnectionPool(
                conninfo=DATABASE_URL,
                min_size=0,
                max_size=2,
                timeout=4,
                kwargs={'connect_timeout': 3, 'sslmode': 'require'},
            )
    return _DB_POOL

def _db_connect():
    if not DATABASE_URL:
        return None
    pool = _get_db_pool()
    if pool is not None:
        return pool.connection()
    return psycopg.connect(DATABASE_URL, connect_timeout=3, sslmode='require')

def _ensure_db_state_table():
    global _DB_TABLE_READY
    if _DB_TABLE_READY or not DATABASE_URL:
        return
    pool = _get_db_pool()
    if pool is None:
        conn = psycopg.connect(DATABASE_URL, connect_timeout=3, sslmode='require')
        try:
            with conn:
                with conn.cursor() as cur:
                    cur.execute(f"CREATE TABLE IF NOT EXISTS {DB_STATE_TABLE} (id SMALLINT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), version BIGINT NOT NULL DEFAULT 1)")
            _DB_TABLE_READY = True
        finally:
            conn.close()
        return
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"CREATE TABLE IF NOT EXISTS {DB_STATE_TABLE} (id SMALLINT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), version BIGINT NOT NULL DEFAULT 1)")
        conn.commit()
    _DB_TABLE_READY = True

def _db_load_state():
    global _LOCAL_DB_VERSION
    _ensure_db_state_table()
    pool = _get_db_pool()
    if pool is not None:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(f"SELECT payload, version FROM {DB_STATE_TABLE} WHERE id=1")
                row = cur.fetchone()
                _LOCAL_DB_VERSION = int(row[1] or 0) if row else 0
                return row[0] if row else None
    conn = psycopg.connect(DATABASE_URL, connect_timeout=3, sslmode='require') if DATABASE_URL else None
    if conn is None:
        return None
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(f"SELECT payload, version FROM {DB_STATE_TABLE} WHERE id=1")
                row = cur.fetchone()
                _LOCAL_DB_VERSION = int(row[1] or 0) if row else 0
                return row[0] if row else None
    finally:
        conn.close()

def _db_state_version():
    if not DATABASE_URL:
        return 0
    _ensure_db_state_table()
    pool = _get_db_pool()
    if pool is not None:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(f"SELECT version FROM {DB_STATE_TABLE} WHERE id=1")
                row = cur.fetchone()
                return int(row[0] or 0) if row else 0
    conn = psycopg.connect(DATABASE_URL, connect_timeout=3, sslmode='require')
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(f"SELECT version FROM {DB_STATE_TABLE} WHERE id=1")
                row = cur.fetchone()
                return int(row[0] or 0) if row else 0
    finally:
        conn.close()

def _refresh_state_if_changed():
    global _LOCAL_DB_VERSION
    if not DATABASE_URL:
        return
    current_version = _db_state_version()
    if current_version != _LOCAL_DB_VERSION:
        _load_state()

def _db_save_state(data):
    global _LOCAL_DB_VERSION
    _ensure_db_state_table()
    pool = _get_db_pool()
    payload = json.dumps(data, ensure_ascii=False)
    sql = f"INSERT INTO {DB_STATE_TABLE}(id,payload,updated_at,version) VALUES(1,%s,NOW(),1) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload, updated_at=NOW(), version={DB_STATE_TABLE}.version+1 RETURNING version"
    if pool is not None:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (payload,))
                row = cur.fetchone()
            conn.commit()
        _LOCAL_DB_VERSION = int(row[0] or 0) if row else _LOCAL_DB_VERSION
        _STATE_SAVED_THIS_REQUEST.set(True)
        return True
    conn = psycopg.connect(DATABASE_URL, connect_timeout=3, sslmode='require') if DATABASE_URL else None
    if conn is None:
        return False
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql, (payload,))
                row = cur.fetchone()
        _LOCAL_DB_VERSION = int(row[0] or 0) if row else _LOCAL_DB_VERSION
        _STATE_SAVED_THIS_REQUEST.set(True)
        return True
    finally:
        conn.close()

def _repair_future_watchman_projections() -> int:
    """Soft-delete invalid future Settings-generated Watchman projections.

    Older builds materialized salary into every viewed future month. V6.4.39 keeps
    those rows for audit but removes them from all calculations and marks them as
    deleted with a system justification.
    """
    changed = 0
    current = current_accounting_month()
    existing_history = {h.get("expense_id") for h in expense_deletion_history}
    for e in expenses:
        if e.source == "Settings" and e.category == "Watchman Salary" and e.month_key > current and not e.deleted:
            e.deleted = True
            e.deleted_at = datetime.now().isoformat(timespec="seconds")
            e.deleted_reason = "System cleanup: future Watchman salary projection is not an actual expense until that month is reached."
            if e.id not in existing_history:
                expense_deletion_history.append({
                    "id": str(uuid4()), "expense_id": e.id, "apartment_id": e.apartment_id,
                    "month_key": e.month_key, "expense_date": e.expense_date, "category": e.category,
                    "description": e.description, "amount": e.amount, "payment_mode": e.payment_mode,
                    "reference": e.reference, "remarks": e.remarks, "source": e.source,
                    "deleted_at": e.deleted_at, "justification": e.deleted_reason,
                    "deleted_by_username": "system"
                })
            changed += 1
    return changed

def _dump_models(items): return [x.model_dump() if hasattr(x,'model_dump') else x for x in items]
def _save_state():
    data={
        'charge_settings':{k:v.model_dump() for k,v in charge_settings.items()}, 'charge_history':_dump_models(charge_history), 'payments':_dump_models(payments), 'payment_month_locks':{f'{k[0]}|||{k[1]}':v for k,v in payment_month_locks.items()}, 'payment_lock_history':payment_lock_events, 'expenses':_dump_models(expenses), 'expense_lock_history':expense_lock_events, 'expense_deletion_history':expense_deletion_history,
        'admin_users':_dump_models(admin_users),'admin_passwords':admin_passwords,'login_history':_dump_models(login_history),
        'watchmen':_dump_models(watchmen),'watchman_history':watchman_history,'utility_categories':_dump_models(utility_categories),'utility_category_history':_dump_models(utility_category_history),'utility_contacts':_dump_models(utility_contacts),'utility_contact_history':_dump_models(utility_contact_history),'opening_balances':{k:v.model_dump() for k,v in opening_balances.items()},
        'opening_balance_history':_dump_models(opening_balance_history),'residents':_dump_models(residents),'flat_history':_dump_models(flat_history),
        'maintenance_rows':_dump_models(maintenance_rows),'water_headers':{f'{k[0]}|||{k[1]}':v.model_dump() for k,v in water_headers.items()},
        'platform_owner':platform_owner.model_dump() if platform_owner else None,'platform_owner_password':platform_owner_password,'platform_password_policy_initialized':platform_password_policy_initialized,
        'tenant_accounts':{k:v.model_dump() for k,v in tenant_accounts.items()},'tenant_account_validity_history':_dump_models(tenant_account_validity_history),'tenant_users':{k:_dump_models(v) for k,v in tenant_users.items()},'tenant_passwords':tenant_passwords,'platform_audit':platform_audit,
        'subscription_settings':subscription_settings.model_dump(),'subscription_plans':{k:v.model_dump() for k,v in subscription_plans.items()},'subscriptions':{k:v.model_dump() for k,v in subscriptions.items()},'subscription_history':_dump_models(subscription_history),'subscription_events':_dump_models(subscription_events),'subscription_payments':_dump_models(subscription_payments),
        'auth_sessions':dict(auth_sessions),
        'session_timeout_settings':session_timeout_settings.model_dump()
    }
    if DATABASE_URL:
        _db_save_state(data)
    else:
        STATE_FILE.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')

def _load_state():
    global charge_settings,charge_history,payments,payment_month_locks,payment_lock_events,expenses,expense_lock_events,expense_deletion_history,admin_users,admin_passwords,login_history,watchmen,watchman_history,utility_categories,utility_category_history,utility_contacts,utility_contact_history,opening_balances,opening_balance_history,residents,flat_history,maintenance_rows,water_headers,platform_owner,platform_owner_password,platform_password_policy_initialized,tenant_accounts,tenant_account_validity_history,tenant_users,tenant_passwords,platform_audit,session_timeout_settings,auth_sessions,subscription_settings,subscription_plans,subscriptions,subscription_history,subscription_events,subscription_payments
    try:
        d = _db_load_state() if DATABASE_URL else (json.loads(STATE_FILE.read_text(encoding='utf-8')) if STATE_FILE.exists() else None)
        if d is None:
            return
        charge_settings={k:ChargeSettings(**v) for k,v in d.get('charge_settings',{}).items()} or charge_settings
        charge_history=[ChargeHistory(**x) for x in d.get('charge_history',[])]
        payments=[Payment(**x) for x in d.get('payments',[])]; payment_month_locks={tuple(k.split('|||',1)):v for k,v in d.get('payment_month_locks',{}).items()}; payment_lock_events=d.get('payment_lock_history',[]); expenses=[Expense(**x) for x in d.get('expenses',[])]; expense_lock_events=d.get('expense_lock_history',[]); expense_deletion_history=d.get('expense_deletion_history',[])
        if not expense_deletion_history:
            expense_deletion_history=[e.model_dump() for e in expenses if e.deleted]
        duplicate_payments_removed = normalize_payments()
        admin_users=[AdminUser(**x) for x in d.get('admin_users',[])]; admin_passwords=d.get('admin_passwords',{})
        login_history=[LoginAttempt(**{**x, 'tenant_id': x.get('tenant_id') or _user_tenant_id(x.get('user_id'))}) for x in d.get('login_history',[])]; watchmen=[Watchman(**x) for x in d.get('watchmen',[])]; watchman_history=d.get('watchman_history',[]); utility_categories=[UtilityCategory(**x) for x in d.get('utility_categories',[])]; utility_category_history=[UtilityCategoryHistory(**x) for x in d.get('utility_category_history',[])]; _ensure_utility_categories(); utility_contacts=[UtilityContact(**x) for x in d.get('utility_contacts',[])]; utility_contact_history=[UtilityContactHistory(**x) for x in d.get('utility_contact_history',[])]
        opening_balances={k:OpeningBalance(**v) for k,v in d.get('opening_balances',{}).items()}; opening_balance_history=[OpeningBalanceHistory(**x) for x in d.get('opening_balance_history',[])]
        residents=[Resident(**x) for x in d.get('residents',[])]; flat_history=[FlatHistory(**x) for x in d.get('flat_history',[])]
        maintenance_rows=[MaintenanceRow(**x) for x in d.get('maintenance_rows',[])]; water_headers={tuple(k.split('|||',1)):MonthWaterHeader(**v) for k,v in d.get('water_headers',{}).items()}
        po=d.get('platform_owner'); platform_owner=AdminUser(**po) if po else None; platform_owner_password=d.get('platform_owner_password','')
        policy_present='platform_password_policy_initialized' in d
        platform_password_policy_initialized=bool(d.get('platform_password_policy_initialized',False))
        # FIX 11: normal account creation/login does not force a password change.
        # Clear only the Fix-10 initial-password flag (created_at == updated_at).
        # Explicit password resets update updated_at and therefore remain forced.
        if platform_owner and platform_owner.force_password_change and platform_owner.created_at == platform_owner.updated_at:
            platform_owner.force_password_change=False
            platform_password_policy_initialized=True
        for _tid, _users in tenant_users.items():
            for _u in _users:
                if _u.force_password_change and _u.created_at == _u.updated_at:
                    _u.force_password_change=False
        tenant_accounts={k:TenantAccount(**v) for k,v in d.get('tenant_accounts',{}).items()}
        # Backfill the new per-tenant operational start month without altering
        # historical transactional data or tenant identifiers.
        for _account in tenant_accounts.values():
            locked_month=_effective_operational_start_month(_account.tenant_id)
            _account.data_start_month=locked_month
        tenant_account_validity_history=[TenantAccountValidityHistory(**x) for x in d.get('tenant_account_validity_history',[])]; tenant_users={k:[AdminUser(**u) for u in v] for k,v in d.get('tenant_users',{}).items()}; tenant_passwords=d.get('tenant_passwords',{}); platform_audit=d.get('platform_audit',[]); auth_sessions=dict(d.get('auth_sessions',{}))
        # FIX 12: clear only the legacy first-login flag on persisted users.
        # Explicit password resets change updated_at and therefore remain forced.
        for _users in tenant_users.values():
            for _u in _users:
                if _u.force_password_change and _u.created_at == _u.updated_at:
                    _u.force_password_change=False
        subscription_settings=SubscriptionSettings(**d.get('subscription_settings',{}));
        # A legacy Fix-10 state may have trial_enabled=True with updated_by=system.
        # Treat that as the old implicit default, not an explicit Product Owner choice.
        if subscription_settings.updated_by in ('','system') and not subscription_settings.updated_at:
            subscription_settings.trial_enabled=False
        subscription_plans={k:SubscriptionPlan(**v) for k,v in d.get('subscription_plans',{}).items()}; subscriptions={k:Subscription(**v) for k,v in d.get('subscriptions',{}).items()}; subscription_history=[SubscriptionHistory(**x) for x in d.get('subscription_history',[])]; subscription_events=[SubscriptionEvent(**x) for x in d.get('subscription_events',[])]; subscription_payments=[SubscriptionPayment(**x) for x in d.get('subscription_payments',[])]
        _default_plan_seed()
        _migrate_legacy_subscriptions()
        # Correct the legacy Telangana account code typo (TE -> TS) without
        # changing the tenant UUID. Existing login/account references continue to
        # resolve against the migrated account number.
        for _tid, _account in tenant_accounts.items():
            if _account.country.casefold()=="india" and _account.state.casefold()=="telangana" and "-TE-" in _account.account_id.upper():
                _account.account_id=_account.account_id.upper().replace("-TE-","-TS-",1)
                if _tid in charge_settings:
                    charge_settings[_tid].account_id=_account.account_id
        if not tenant_account_validity_history:
            for _account in tenant_accounts.values():
                tenant_account_validity_history.append(TenantAccountValidityHistory(
                    id=str(uuid4()), tenant_id=_account.tenant_id, account_id=_account.account_id,
                    valid_from=_account.valid_from, valid_to=_account.valid_to, status=_account.status,
                    action="Migrated Baseline", changed_at=_account.created_at, changed_by="system",
                    reason="Initial validity baseline migrated to V6.4.48 history."))
        if d.get('session_timeout_settings'): session_timeout_settings=SessionTimeoutSettings(**d['session_timeout_settings'])
        future_watchman_repairs = _repair_future_watchman_projections()
        if duplicate_payments_removed or future_watchman_repairs or (platform_owner is not None and not platform_password_policy_initialized):
            print(f'ApartCare state repair: removed {duplicate_payments_removed} duplicate payment record(s); soft-deleted {future_watchman_repairs} future Watchman projection(s).')
        # IMPORTANT: do not persist during module import on Vercel.
        # A database write here can make every API invocation fail before the
        # requested endpoint is reached. Mutating endpoints persist explicitly.
    except Exception as e: print('ApartCare state load warning:',e)

# IMPORTANT: Never load Postgres state during module import on Vercel.
# Vercel must be able to initialize the function before any database network call.
# Production state is loaded by load_persistent_state_before_request middleware.
if not os.getenv("VERCEL"):
    _load_state()
    _default_plan_seed()
    _migrate_legacy_subscriptions()
    _save_state()
else:
    _default_plan_seed()
    _migrate_legacy_subscriptions()

@app.middleware("http")
async def enforce_property_tenant_context(request, call_next):
    """Make authenticated tenant_id the single source of truth for property APIs.

    Property users may only read/write their own apartment namespace. Query-string
    apartment_id values are validated/normalized and JSON body apartment_id values
    are validated/normalized. Platform endpoints and account/login bootstrap APIs
    are intentionally outside this property middleware.
    """
    path = request.url.path
    # Browser CORS preflight requests do not carry the property session token.
    # They must be allowed through before tenant authentication is evaluated.
    # Otherwise every protected POST/PUT/PATCH/DELETE endpoint can fail at the
    # OPTIONS stage with 401, producing the frontend's misleading "Failed to fetch".
    if request.method == "OPTIONS":
        return await call_next(request)
    if os.getenv("VERCEL") and not DATABASE_URL and request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.url.path != "/health":
        return JSONResponse(status_code=503, content={"detail": "Production persistence is not configured. Connect a Postgres DATABASE_URL before creating or changing client data."})
    excluded = (
        "/health", "/account/", "/platform/", "/tenant/login",
        "/admin/auth/login", "/admin/auth/request-password-reset", "/admin/auth/confirm-password-reset",
        "/import/templates", "/webhooks/", "/templates/", "/uploads/"
    )
    if path.startswith("/templates/") or path.startswith("/uploads/") or any(path.startswith(prefix) for prefix in excluded):
        return await call_next(request)
    if path.startswith("/health") or path.startswith("/account/") or path.startswith("/platform/") or path.startswith("/tenant/login") or path.startswith("/admin/auth/") or path.startswith("/import/templates") or path.startswith("/webhooks/"):
        return await call_next(request)
        return await call_next(request)

    token = request.headers.get("x-apartcare-token")
    if not token:
        # Property data endpoints require an authenticated property/support session.
        return JSONResponse(status_code=401, content={"detail": "Login session is required."})
    try:
        actor = _current_actor(token)
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    tenant = str(getattr(actor, "tenant_id", "") or "").strip()
    if not tenant:
        return JSONResponse(status_code=403, content={"detail": "Authenticated user has no tenant_id."})
    # A tenant_id is not sufficient by itself: the tenant account must still exist
    # and be operational. This prevents stale sessions from crossing into a deleted
    # or re-created apartment namespace.
    if tenant != "demo-apartment":
        account = tenant_accounts.get(tenant)
        if not account:
            return JSONResponse(status_code=403, content={"detail": "Apartment account is unavailable."})
        today = date.today().isoformat()
        effective_status = "Expired" if account.valid_to < today else account.status
        if effective_status != "Active":
            return JSONResponse(status_code=403, content={"detail": f"Property account is {effective_status.lower()}."})
        # Subscription lifecycle is separate from Account validity. Expired/restricted
        # subscriptions can still access login, subscription and billing endpoints,
        # but operational APIs are blocked until payment/reactivation.
        sub_path_allowed = path.startswith("/subscription")
        if not sub_path_allowed and not _subscription_access_allowed(tenant):
            return JSONResponse(status_code=402, content={"detail": "ApartCare subscription is restricted. Open Subscription & Billing to restore service."})
        tenant_users_for_account = tenant_users.get(tenant, [])
        if _is_platform_support_token(token):
            support_tenant = platform_support_sessions.get(token, ("", None))[0]
            if support_tenant != tenant or actor.tenant_id != tenant:
                return JSONResponse(status_code=403, content={"detail": "Audit/Support tenant context is invalid."})
        elif not any(u.id == actor.id and u.tenant_id == tenant for u in tenant_users_for_account):
            return JSONResponse(status_code=403, content={"detail": "User is not a member of the authenticated apartment account."})

    # Query parameters: normalize omitted/legacy demo apartment to the authenticated tenant.
    from urllib.parse import parse_qsl, urlencode
    pairs = parse_qsl(request.url.query, keep_blank_values=True)
    found_apartment = False
    found_tenant = False
    normalized = []
    for k, v in pairs:
        if k in {"apartment_id", "tenant_id"}:
            if k == "apartment_id": found_apartment = True
            if k == "tenant_id": found_tenant = True
            if v not in ("", "demo-apartment", tenant):
                return JSONResponse(status_code=403, content={"detail": "Tenant context does not match the logged-in account."})
            normalized.append((k, tenant))
        else:
            normalized.append((k, v))
    if not found_apartment:
        normalized.append(("apartment_id", tenant))
    if not found_tenant:
        normalized.append(("tenant_id", tenant))
    request.scope["query_string"] = urlencode(normalized, doseq=True).encode()

    # JSON write bodies: make tenant_id authoritative even if the browser carries stale state.
    content_type = request.headers.get("content-type", "").lower()
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and "application/json" in content_type:
        try:
            raw = await request.body()
            if raw:
                payload = json.loads(raw)
                if isinstance(payload, dict):
                    supplied_a = str(payload.get("apartment_id") or "").strip()
                    supplied_t = str(payload.get("tenant_id") or "").strip()
                    for supplied in (supplied_a, supplied_t):
                        if supplied and supplied not in ("demo-apartment", tenant):
                            return JSONResponse(status_code=403, content={"detail": "Tenant context does not match the logged-in account."})
                    if supplied_a and supplied_t and supplied_a not in ("demo-apartment", supplied_t) and supplied_t not in ("demo-apartment", supplied_a):
                        return JSONResponse(status_code=403, content={"detail": "tenant_id and apartment_id do not match."})
                    payload["tenant_id"] = tenant
                    payload["apartment_id"] = tenant
                    rebuilt = json.dumps(payload).encode()
                    request._body = rebuilt
                    async def receive():
                        return {"type": "http.request", "body": rebuilt, "more_body": False}
                    request._receive = receive
        except json.JSONDecodeError:
            pass

    return await call_next(request)

@app.middleware('http')
async def load_persistent_state_before_request(request, call_next):
    # FIX 11: do not reload the entire JSONB state blob on every request.
    # Perform a lightweight version check and reload only when another Vercel
    # instance has committed a newer state version. This keeps cloud latency
    # low while preserving cross-instance tenant/account consistency.
    if DATABASE_URL:
        try:
            _refresh_state_if_changed()
        except Exception as e:
            print('ApartCare persistent state refresh warning:', e)
    return await call_next(request)

@app.middleware('http')
async def persist_state_after_mutation(request, call_next):
    _STATE_SAVED_THIS_REQUEST.set(False)
    response=await call_next(request)
    if request.method in {'POST','PUT','PATCH','DELETE'} and response.status_code<400 and not _STATE_SAVED_THIS_REQUEST.get():
        try: _save_state()
        except Exception as e: print('ApartCare state save warning:',e)
    return response


# CORS must wrap the tenant/auth middleware so 401/403 responses still expose
# the CORS headers to the browser. This prevents misleading "Failed to fetch"
# errors when an authenticated property request has an expired/missing token.
_cors_origins = [o.strip() for o in os.getenv(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3000,http://127.0.0.1:3000,https://www.apartcarelite.com,https://apartcarelite.com'
).split(',') if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
