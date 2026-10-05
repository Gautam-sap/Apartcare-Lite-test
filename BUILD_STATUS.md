# ApartCare Lite V6.5.14 — Build Status

Version: 6.5.14 — Production Stabilization

Validated in this build workspace:
- Python syntax: PASS (`python -m py_compile backend/app/main.py backend/main.py api/index.py`)
- JSON syntax: PASS (`package.json`, `vercel.json`)
- Tenant-read audit: PASS — all property GET endpoints require an authenticated ApartCare token and resolve tenant scope from the session.
- Tenant-write hardening: PASS — resident, payment, expense, watchman, maintenance and apartment-photo writes force the authenticated tenant namespace.
- Per Unit Price: rounds upward to the next whole value (57.39 -> 58).
- Apartment photo: controlled display size with Update/Remove support.
- First-login password change and password-reset/welcome-email framework included.
- Report branding and print-water-report layout included.

The final Next.js production build must still be run on the Windows development machine or Vercel because this workspace could not complete the npm package installation required for the native Next.js build worker.

Windows validation:
```bat
npm install
npm run build
```

Mandatory regression test after build:
1. Create Account A with unique Settings / Opening Balance values.
2. Create Account B with different values.
3. Log into A, then log out and log into B.
4. Verify Settings, Dashboard, Maintenance, Payments, Expenses, Utilities and Reports contain only B data.
5. Attempt Account B token + Account A tenant/apartment ID on property APIs; expected HTTP 403.
6. Verify photo upload/update/remove is tenant-scoped.
7. Verify first-login password change and password-reset email.
8. Verify All Flats Monthly Report print contains only Water Summary + Water Detail table with both apartment and app branding.
