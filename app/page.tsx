
'use client';

import { useEffect, useRef, useState } from 'react';

type Tab = 'Dashboard' | 'Residents' | 'Monthly Maintenance' | 'Payments' | 'Expenses' | 'Utilities' | 'Reports' | 'Settings' | 'Administration' | 'Data Import' | 'Subscription & Billing';
type Period = 'Monthly' | 'Yearly';
type Resident = {
  id:string; tenant_id:string; apartment_id:string; flat_no:string; owner_name:string; resident_name:string;
  resident_type:'Owner'|'Tenant'; mobile_no:string; email:string;
  status:'Active'|'Inactive'; remarks:string; version?:number;
};
type MaintenanceRow = {
  id:string; tenant_id:string; apartment_id:string; month_key:string; flat_no:string; owner_name:string;
  resident_name:string; resident_type:'Owner'|'Tenant'; maintenance:number; cca:number;
  diesel:number; other_charges:number; previous_reading:number; current_reading:number;
  water_units:number; water_rate:number; water_amount:number; total:number;
  rounded_total:number; remarks:string; resident_version?:number;
};
type WaterHeader = {
  tenant_id:string; apartment_id:string; month_key:string; water_mode:'Meter'|'No Meter';
  tanker_count:number; tanker_price:number; tanker_amount:number; municipal_bill:number; total_water_cost:number;
  water_rate:number; flats_count:number; total_units:number;
};
type Payment = {
  id:string; tenant_id:string; apartment_id:string; month_key:string; flat_no:string; owner_name:string; resident_name:string;
  previous_balance:number; current_month_total:number; amount_due:number; paid_amount:number;
  pending_balance:number; payment_mode:string; reference:string; payment_date:string; remarks:string;
};
type PaymentSummary = {month_key:string;total_maintenance:number;previous_balance:number;total_due:number;total_collected:number;total_pending:number;payment_count:number};
type DashboardKpis = {previous_month_closing:number;total_maintenance:number;total_collected:number;total_expenses:number;current_balance:number;total_available_amount:number};
type ChargeSettings = { tenant_id:string; apartment_id:string; account_id?:string; account_mobile?:string; apartment_name:string; address:string; city:string; pin_code:string; state:string; country:string; language:string; no_of_flats:number; no_of_flats_editable:boolean; common_maintenance:number; cca:number; watchman_salary:number; watchman_salary_locked:boolean; apartment_photo_name:string; apartment_photo_path:string; apartment_photo_data_url?:string; };
type Watchman = {id:string; tenant_id:string; apartment_id:string; name:string; mobile_no:string; start_date:string; end_date:string|null; salary:number; locked:boolean; remarks:string; deleted:boolean; deleted_at:string|null; deleted_reason:string;};
type OpeningBalance = {id:string; tenant_id:string; apartment_id:string; go_live_month:string; opening_balance:number; locked:boolean; saved_at:string;};
type OpeningHistory = {id:string; tenant_id:string; apartment_id:string; go_live_month:string; opening_balance:number; action:string; changed_at:string; justification?:string; changed_by?:string;};
type FlatStatement = {flat_no:string; owner_name?:string; resident_name?:string; resident_history:any[]; ledger:any[]};
type UtilityCategory = {id:string;tenant_id:string;apartment_id:string;name:string;active:boolean;created_at:string;updated_at:string;created_by:string};
type UtilityContact = {id:string;tenant_id:string;apartment_id:string;category:string;name:string;mobile_no:string;remarks:string;created_at:string;updated_at:string};
type ExpenseCategory = 'Watchman Salary'|'Electricity'|'Water'|'Diesel'|'Repairs & Maintenance'|'Cleaning'|'Security'|'CCA'|'Other';
type Expense = {
  id:string; tenant_id:string; apartment_id:string; month_key:string; expense_date:string;
  category:ExpenseCategory; description:string; amount:number;
  payment_mode:string; reference:string; remarks:string; source:'Manual'|'Settings'; bill_path?:string; bill_original_name?:string; locked?:boolean; deleted?:boolean;
};
type AdminUser={id:string;username:string;full_name:string;email?:string;mobile_no?:string;role:'Admin'|'Viewer'|'Supervisor'|'Caretaker'|'Super Admin';active:boolean;locked:boolean;force_password_change:boolean;created_at:string;updated_at:string;tenant_id?:string;language_preference?:'English'|'Telugu'|'Hindi'|'Tamil'|'Kannada'};
type TenantAccount={tenant_id:string;account_id:string;apartment_name:string;address:string;city:string;state:string;pin_code:string;country:string;language:string;property_type?:string;valid_from:string;valid_to:string;status:string;created_at:string};
type SessionRule={enabled:boolean;minutes:number};
type SessionTimeoutSettings={super_admin:SessionRule;admin:SessionRule;viewer:SessionRule;caretaker:SessionRule};
type LoginAttempt={id:string;username:string;user_id?:string;status:string;event:string;at:string;reason:string};
type ExpenseSummary = {month_key:string;total_expenses:number;expense_count:number;by_category:Record<string,number>};
type Summary = {
  month_key:string; flats_count:number; maintenance_total:number;common_maintenance_total?:number; cca_total:number;
  diesel_total:number; other_total:number; water_total:number; grand_total:number;
  water_header:WaterHeader|null;
};

const API=(process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/,'');
const money=(n:number)=>`₹ ${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:2})}`;
const nowLocal=new Date();
const monthNow=`${nowLocal.getFullYear()}-${String(nowLocal.getMonth()+1).padStart(2,'0')}`;
const todayCompact=`${nowLocal.getFullYear()}${String(nowLocal.getMonth()+1).padStart(2,'0')}${String(nowLocal.getDate()).padStart(2,'0')}`;
const accountExample=`IN-TS-ACL-${todayCompact}-000001`;
const stateCodeMap:Record<string,string>={'Andhra Pradesh':'AP',Karnataka:'KA','Tamil Nadu':'TN',Telangana:'TS',Maharashtra:'MH',Delhi:'DL','West Bengal':'WB',Kerala:'KL',Odisha:'OD',Gujarat:'GJ',Rajasthan:'RJ',Punjab:'PB',Haryana:'HR',Bihar:'BR',Jharkhand:'JH',Chhattisgarh:'CG',Goa:'GA',Assam:'AS'};
const COUNTRY_OPTIONS=['India','United States','United Kingdom','United Arab Emirates','Australia','Canada','Other'];
const STATE_OPTIONS=['Andhra Pradesh','Karnataka','Tamil Nadu','Telangana','Maharashtra','Delhi','West Bengal','Kerala','Odisha','Gujarat','Rajasthan','Punjab','Haryana','Bihar','Jharkhand','Chhattisgarh','Goa','Assam','Other'];
const CITY_OPTIONS=['Hyderabad','Bengaluru','Chennai','Mumbai','Pune','Delhi','Kolkata','Vijayawada','Visakhapatnam','Warangal','Other'];
const formatDate=(value:any)=>{const raw=String(value??'').trim();if(!raw)return '—';const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}/${m[2]}/${m[1]}`:raw;};
const formatDateTime=(value:any)=>{const raw=String(value??'').trim();if(!raw)return '—';const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);return m?`${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`:formatDate(raw);};
const displayDateInput=(value:string)=>{const raw=String(value||'').trim();const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:raw;};
const parseDisplayDate=(value:string)=>{const raw=String(value||'').trim();if(!raw)return '';const d=raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);if(d){const dd=d[1].padStart(2,'0'),mm=d[2].padStart(2,'0'),yyyy=d[3];return `${yyyy}-${mm}-${dd}`;}return raw;};
const formatMonthKey=(value:any)=>{const raw=String(value??'').trim();const m=raw.match(/^(\d{4})-(\d{2})$/);return m?`${m[2]}/${m[1]}`:raw||'—';};
const countryCodeMap:Record<string,string>={India:'IN','United States':'US','United Kingdom':'GB','United Arab Emirates':'AE',Australia:'AU',Canada:'CA'};
const accountDisplay=(raw:string,country:string,state:string)=>{const value=String(raw||'');if(/^[A-Z]{2}-[A-Z]{2}-ACL-\d{8}-\d{6}$/i.test(value))return value.toUpperCase();const m=value.match(/^(?:ACC-)?(\d{8})-(\d{4,6})$/);if(!m)return value;const cc=countryCodeMap[country]||String(country||'XX').replace(/[^A-Za-z]/g,'').slice(0,2).toUpperCase()||'XX';const sc=stateCodeMap[state]||String(state||'XX').replace(/[^A-Za-z]/g,'').slice(0,2).toUpperCase()||'XX';return `${cc}-${sc}-ACL-${m[1]}-${m[2].padStart(6,'0')}`;};
const accountApiValue=(display:string)=>String(display||'').trim().toUpperCase();
const normalizedRole=(u:AdminUser|null)=>String(u?.role||'').trim().toLowerCase();
const isViewer=(u:AdminUser|null)=>normalizedRole(u)==='viewer';
const isCaretaker=(u:AdminUser|null)=>normalizedRole(u)==='caretaker';
const canEditUtilities=(u:AdminUser|null)=>u?.role==='Admin' || u?.role==='Viewer';
const canManageUtilities=(u:AdminUser|null,sessionReady=true)=>Boolean(u) && sessionReady && ['admin','viewer'].includes(normalizedRole(u));
const isAdmin=(u:AdminUser|null)=>normalizedRole(u)==='admin';

const escapeHtml=(value:any)=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const loadBrandLogoDataUrl=async()=>{
  try{const r=await fetch('/apartcare-lite-logo.png',{cache:'force-cache'});if(!r.ok)return '';const blob=await r.blob();return await new Promise<string>(resolve=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result||''));fr.onerror=()=>resolve('');fr.readAsDataURL(blob);});}catch{return '';}
};
const downloadExcelTable=async(title:string, headers:string[], rows:any[][], fileName:string)=>{
  const logo=await loadBrandLogoDataUrl();
  const brand=`<table style="width:100%;border-collapse:collapse;margin-bottom:12px"><tr><td style="width:58%;vertical-align:middle;border:0"><b style="font-size:16px;color:#243447">${escapeHtml(title)}</b><br><span style="color:#64748b">Apartment Report</span></td><td style="width:42%;text-align:right;vertical-align:middle;border:0">${logo?`<img src="${logo}" style="width:54px;height:38px;object-fit:contain;vertical-align:middle;margin-right:8px"/>`:''}<b style="color:#243447">ApartCare Lite</b><br><span style="font-size:11px;color:#64748b">Your daily partner in property care.<br><i>Helping you run your building beautifully.</i><br><b>GKMA Solutions</b></span></td></tr></table>`;
  const html=`<html><head><meta charset="UTF-8"></head><body>${brand}<table border="1" style="border-collapse:collapse;width:100%"><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody></table><div style="margin-top:12px;text-align:right;color:#64748b;font-size:10px">ApartCare Lite • GKMA Solutions</div></body></html>`;
  const blob=new Blob(['\ufeff'+html],{type:'application/vnd.ms-excel;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fileName.endsWith('.xls')?fileName:`${fileName}.xls`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
const tableScreenshotBlob=async(title:string, headers:string[], rows:any[][]):Promise<Blob>=>{
  const cols=Math.max(1,headers.length);const cellW=Math.max(150,Math.floor(1500/cols));const width=cols*cellW+80;const rowH=42;const height=Math.max(250,185+(rows.length+1)*rowH);
  const canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;const ctx=canvas.getContext('2d')!;ctx.scale(2,2);
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);ctx.fillStyle='#243447';ctx.font='700 24px Arial';ctx.fillText(title,40,42);ctx.font='13px Arial';ctx.fillStyle='#64748b';ctx.fillText('ApartCare Report',40,66);ctx.fillText('Your daily partner in property care.  •  GKMA Solutions',40,86);
  try{const r=await fetch('/apartcare-lite-logo.png',{cache:'force-cache'});if(r.ok){const ib=await r.blob();const src=URL.createObjectURL(ib);const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();im.onload=()=>{URL.revokeObjectURL(src);resolve(im)};im.onerror=reject;im.src=src;});ctx.drawImage(img,width-125,22,82,58);}}catch{}
  const y0=105;ctx.fillStyle='#eaf0f6';ctx.fillRect(40,y0,width-80,rowH);ctx.strokeStyle='#cbd5e1';ctx.lineWidth=1;
  const drawRow=(values:any[],y:number,bold=false)=>{for(let i=0;i<cols;i++){const x=40+i*cellW;ctx.strokeRect(x,y,cellW,rowH);ctx.fillStyle='#243447';ctx.font=`${bold?'700':'400'} 13px Arial`;const text=String(values[i]??'');ctx.save();ctx.beginPath();ctx.rect(x+8,y+4,cellW-16,rowH-8);ctx.clip();ctx.fillText(text,x+8,y+26);ctx.restore();}};
  drawRow(headers,y0,true);rows.forEach((r,i)=>{if(i%2===1){ctx.fillStyle='#f8fafc';ctx.fillRect(40,y0+rowH*(i+1),width-80,rowH);}drawRow(r,y0+rowH*(i+1));});ctx.fillStyle='#64748b';ctx.font='11px Arial';ctx.fillText('ApartCare Lite  •  GKMA Solutions',40,height-16);
  return await new Promise(resolve=>canvas.toBlob(b=>resolve(b!), 'image/png'));
};
const shareReportViaWhatsApp=async(title:string, message:string, blob?:Blob, filename='ApartCare_Report.png')=>{
  const nav:any=navigator;
  try{ if(blob && nav.canShare && nav.canShare({files:[new File([blob],filename,{type:blob.type||'image/png'})]})){ await nav.share({title,text:message,files:[new File([blob],filename,{type:blob.type||'image/png'})]}); return; } }catch(e){ /* user cancellation falls back below */ }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${title}\n${message}`)}`,'_blank','noopener,noreferrer');
};

const emptyResident={
  flat_no:'',owner_name:'',resident_name:'',resident_type:'Owner' as 'Owner'|'Tenant',
  mobile_no:'',email:'',status:'Active' as 'Active'|'Inactive',remarks:''
};


function DonutChart({
  title,
  primaryLabel,
  primaryValue,
  secondaryLabel,
  secondaryValue,
  centerLabel,
  centerValue,
  accent = '#2563eb'
}:{
  title:string;
  primaryLabel:string;
  primaryValue:number;
  secondaryLabel:string;
  secondaryValue:number;
  centerLabel:string;
  centerValue:string;
  accent?:string;
}){
  const total = Math.max(0, primaryValue + secondaryValue);
  const pct = total > 0 ? Math.round((primaryValue / total) * 100) : 0;
  const deg = total > 0 ? Math.round((primaryValue / total) * 360) : 0;
  const gradient = `conic-gradient(${accent} 0deg ${deg}deg, #e5e7eb ${deg}deg 360deg)`;
  return (
    <section className="donut-panel">
      <h2>{title}</h2>
      <div className="donut-content">
        <div className="donut-legend">
          <div><span className="legend-dot primary" style={{background:accent}}></span><b>{primaryLabel}</b><strong>{money(primaryValue)}</strong></div>
          <div><span className="legend-dot secondary"></span><b>{secondaryLabel}</b><strong>{money(secondaryValue)}</strong></div>
        </div>
        <div className="donut" style={{background:gradient}}>
          <div className="donut-hole">
            <strong>{centerValue}</strong>
            <span>{centerLabel}</span>
          </div>
        </div>
      </div>
      <div className="donut-foot">{pct}% {centerLabel}</div>
    </section>
  );
}


function MultiDonutChart({title,segments,centerTop,centerBottom}:{title:string;segments:{label:string;value:number;color:string}[];centerTop:string;centerBottom:string}){
  const clean=segments.map(s=>({...s,value:Math.max(0,Number(s.value)||0)}));
  const total=clean.reduce((a,s)=>a+s.value,0);
  let cursor=0;
  const stops=clean.map(s=>{const start=total?cursor/total*360:0; cursor+=s.value; const end=total?cursor/total*360:0; return `${s.color} ${start}deg ${end}deg`;});
  const background=total>0?`conic-gradient(${stops.join(', ')})`:'#e5e7eb';
  return <section className="donut-panel premium-donut-panel"><h2>{title}</h2><div className="premium-donut-row"><div className="premium-donut-chart" style={{background}}><div className="premium-hole"><strong>{centerTop}</strong><span>{centerBottom}</span></div></div><div className="premium-legend">{clean.map(s=>{const pct=total?Math.round(s.value/total*100):0;return <div key={s.label}><span style={{background:s.color}}></span><b>{s.label}</b><small>{pct}%</small></div>})}</div></div></section>
}


function MonthlyBarChart({rows}:{rows:any[]}){
  const max=Math.max(1,...rows.flatMap(r=>[Number(r.collected||0),Number(r.expenses||0)]));
  return <section className="report-chart-card"><div className="chart-head"><div><h3>Collection vs Expenses by Month</h3><p>Monthly financial comparison for the selected year.</p></div><div className="chart-key"><span><i className="key collected"></i>Collection</span><span><i className="key expenses"></i>Expenses</span></div></div><div className="bar-chart">{rows.map((r:any)=>{const c=Math.max(0,Number(r.collected||0));const e=Math.max(0,Number(r.expenses||0));return <div className="bar-group" key={r.month_key}><div className="bar-values"><span>{money(c)}</span><span>{money(e)}</span></div><div className="bars"><div className="bar collected" style={{height:`${Math.max(2,c/max*100)}%`}} title={`Collection ${money(c)}`}></div><div className="bar expenses" style={{height:`${Math.max(2,e/max*100)}%`}} title={`Expenses ${money(e)}`}></div></div><b>{String(r.month_key).slice(-2)}</b></div>})}</div></section>
}

function BalanceTrendChart({rows}:{rows:any[]}){
  const values=rows.map(r=>Number(r.closing_balance||0)); const max=Math.max(1,...values); const min=Math.min(0,...values); const range=Math.max(1,max-min);
  const points=rows.map((r:any,i:number)=>`${rows.length>1?(i/(rows.length-1))*96+2:50},${96-((Number(r.closing_balance||0)-min)/range)*86}`).join(' ');
  return <section className="report-chart-card"><div className="chart-head"><div><h3>Closing Balance Trend</h3><p>How the apartment's financial position moved month by month.</p></div></div><div className="balance-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="balanceFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#3b68b8" stopOpacity=".28"/><stop offset="100%" stopColor="#3b68b8" stopOpacity=".02"/></linearGradient></defs><line x1="2" y1="96" x2="98" y2="96" className="chart-axis"/><polyline fill="none" points={points} className="balance-line"/>{rows.map((r:any,i:number)=>{const x=rows.length>1?(i/(rows.length-1))*96+2:50;const y=96-((Number(r.closing_balance||0)-min)/range)*86;return <circle key={r.month_key} cx={x} cy={y} r="1.5" className="balance-point"/>})}</svg><div className="trend-labels compact">{rows.map((r:any)=><span key={r.month_key}>{String(r.month_key).slice(-2)}<b>{money(r.closing_balance)}</b></span>)}</div></div></section>
}

function ReportExpenseDonut({rows}:{rows:any[]}){
  const total=rows.reduce((a,r)=>a+Math.max(0,Number(r.expenses||0)),0); const colors=['#2563a6','#7fb3d5','#d99b28','#7c5ab5','#4f9b6f','#d46a6a','#4c8f8c','#9a7b4f','#315f96','#b47712','#2e7d4e','#7b5ea7']; let cursor=0;
  const stops=rows.map((r,i)=>{const v=Math.max(0,Number(r.expenses||0));const st=total?cursor/total*360:0;cursor+=v;const en=total?cursor/total*360:0;return `${colors[i%colors.length]} ${st}deg ${en}deg`;});
  return <section className="report-chart-card report-expense-donut"><div className="chart-head"><div><h3>Monthly Expense Share</h3><p>Expense distribution across the year.</p></div></div><div className="report-donut-wrap"><div className="report-donut" style={{background:total?`conic-gradient(${stops.join(',')})`:'#e5e7eb'}}><div><b>{money(total)}</b><span>Total Expenses</span></div></div><div className="report-month-legend">{rows.map((r:any,i:number)=>{const v=Number(r.expenses||0);if(v<=0)return null;return <div key={r.month_key}><i style={{background:colors[i%colors.length]}}></i><span>{r.month_key}</span><b>{total?Math.round(v/total*100):0}%</b></div>})}</div></div></section>
}

const newApartmentAccountForm=()=>({apartment_name:'',address:'',city:'',state:'',pin_code:'',country:'India',language:'English',data_start_month:'',admin_name:'',admin_username:'',admin_email:'',admin_mobile:'',password:'',confirm_password:''});

export default function Home(){
  const [tab,setTab]=useState<Tab>('Dashboard');
  const [authChecked,setAuthChecked]=useState(false);
  const [accountInitialized,setAccountInitialized]=useState(false);
  const [authMode,setAuthMode]=useState<'login'|'create'|'forgot'|'reset'|'platform'>('login');
  const [currentUser,setCurrentUser]=useState<AdminUser|null>(null);
  const [authToken,setAuthToken]=useState('');
  const [loginForm,setLoginForm]=useState({account_id:'',username:'',password:''});
  const [rememberLogin,setRememberLogin]=useState(false);
  const [loginError,setLoginError]=useState('');
  const [loginAccountChoices,setLoginAccountChoices]=useState<any[]>([]);
  const [showPassword,setShowPassword]=useState(false);
  const [showForgotPassword,setShowForgotPassword]=useState(false);
  const [forgotForm,setForgotForm]=useState({account_id:'',email_or_username:''});
  const [resetForm,setResetForm]=useState({token:'',new_password:'',confirm_password:''});
  const [platformInitialized,setPlatformInitialized]=useState(false);
  const [platformUser,setPlatformUser]=useState<any|null>(null);
  const [platformMustChangePassword,setPlatformMustChangePassword]=useState(false);
  const [platformChangeForm,setPlatformChangeForm]=useState({new_password:'',confirm_password:''});
  const [platformChangeMessage,setPlatformChangeMessage]=useState('');
  const [platformToken,setPlatformToken]=useState('');
  const [platformAuthFormKey,setPlatformAuthFormKey]=useState(0);
  const [utilityEditReady,setUtilityEditReady]=useState(false);
  const [platformLogin,setPlatformLogin]=useState({username:'',password:''});
  const [platformBootstrap,setPlatformBootstrap]=useState({full_name:'Product Owner',username:'',email:'',password:''});
  const [platformAuthView,setPlatformAuthView]=useState<'login'|'forgot'|'reset'>('login');
  const [platformBusy,setPlatformBusy]=useState(false);
  const [platformLoginError,setPlatformLoginError]=useState('');
  const [planCreating,setPlanCreating]=useState(false);
  const [platformSubscriptionHistoryTenantId,setPlatformSubscriptionHistoryTenantId]=useState('');
  const [platformSubscriptionHistory,setPlatformSubscriptionHistory]=useState<any[]>([]);
  const platformActionLocks=useRef<Set<string>>(new Set());
  const [platformBusyKeys,setPlatformBusyKeys]=useState<Set<string>>(new Set());
  const isPlatformBusy=(key:string)=>platformBusyKeys.has(key);
  const runPlatformAction=async(key:string,action:()=>Promise<void>|void)=>{
    if(platformActionLocks.current.has(key)) return;
    platformActionLocks.current.add(key);
    setPlatformBusyKeys(prev=>new Set(prev).add(key));
    try{ await action(); } finally { platformActionLocks.current.delete(key); setPlatformBusyKeys(prev=>{const next=new Set(prev);next.delete(key);return next;}); }
  };
  const [accountBusy,setAccountBusy]=useState(false);
  const [platformForgot,setPlatformForgot]=useState({username:'',email:''});
  const [platformReset,setPlatformReset]=useState({token:'',new_password:'',confirm_password:''});
  const [historicalImport,setHistoricalImport]=useState(false);
  const [platformProperty,setPlatformProperty]=useState<any|null>(null);
  const [platformRecoveryProperty,setPlatformRecoveryProperty]=useState<any|null>(null);
  const [platformRecoveryTenantId,setPlatformRecoveryTenantId]=useState('');
  const [platformRecoveryAccountSearch,setPlatformRecoveryAccountSearch]=useState('');
  const [platformRecoveryUserSearch,setPlatformRecoveryUserSearch]=useState('');
  const [platformAccounts,setPlatformAccounts]=useState<any[]>([]);
  const [platformLoginHistory,setPlatformLoginHistory]=useState<any[]>([]);
  const [platformAuditSearch,setPlatformAuditSearch]=useState('');
  const [platformAuditAccount,setPlatformAuditAccount]=useState('');
  const [platformAuditUser,setPlatformAuditUser]=useState('');
  const [platformAuditEvent,setPlatformAuditEvent]=useState('');
  const [platformAuditFrom,setPlatformAuditFrom]=useState('');
  const [platformAuditTo,setPlatformAuditTo]=useState('');
  const [platformSupportMode,setPlatformSupportMode]=useState(false);
  const [platformSupportAccount,setPlatformSupportAccount]=useState<any|null>(null);
  const [platformMessage,setPlatformMessage]=useState('');
  const [platformConsoleTab,setPlatformConsoleTab]=useState<'accounts'|'billing'|'audit'|'recovery'>('accounts');
  const [platformAccountSearch,setPlatformAccountSearch]=useState('');
  const [platformSubscriptionSettings,setPlatformSubscriptionSettings]=useState<any|null>(null);
  const [platformPlans,setPlatformPlans]=useState<any[]>([]);
  const [platformSubscriptions,setPlatformSubscriptions]=useState<any[]>([]);
  const [platformSubscriptionSearch,setPlatformSubscriptionSearch]=useState('');
  const [platformSubscriptionMessage,setPlatformSubscriptionMessage]=useState('');
  const [newPlanForm,setNewPlanForm]=useState({code:'',name:'',description:'',monthly_price:'',annual_price:'',trial_enabled:false,trial_value:'',trial_unit:'Days'});
  const [platformSelectedPlanByTenant,setPlatformSelectedPlanByTenant]=useState<Record<string,string>>({});
  const [utilityCategoryEditorOpen,setUtilityCategoryEditorOpen]=useState(false);
  const [tenantSubscription,setTenantSubscription]=useState<any|null>(null);
  const [tenantSubscriptionMessage,setTenantSubscriptionMessage]=useState('');
  const [platformValidityHistory,setPlatformValidityHistory]=useState<any[]>([]);
  const [platformHistoryTenantId,setPlatformHistoryTenantId]=useState('');
  const [showCreatePassword,setShowCreatePassword]=useState(false);
  const [showConfirmPassword,setShowConfirmPassword]=useState(false);
  const [showAdminPassword,setShowAdminPassword]=useState(false);
  const [mustChangePassword,setMustChangePassword]=useState(false);
  const [changePasswordForm,setChangePasswordForm]=useState({new_password:'',confirm_password:''});
  const [changePasswordMessage,setChangePasswordMessage]=useState('');
  const [changePasswordLoading,setChangePasswordLoading]=useState(false);
  const [accountForm,setAccountForm]=useState(newApartmentAccountForm);
  const [accountId,setAccountId]=useState('');
  const [period,setPeriod]=useState<Period>('Monthly');
  const [month,setMonth]=useState(monthNow);
  // Module-local periods: changing Expenses must not leave Payments showing stale data (and vice versa).
  const [paymentMonth,setPaymentMonth]=useState(monthNow);
  const [expenseMonth,setExpenseMonth]=useState(monthNow);
  const [year,setYear]=useState('2026');

  const [residents,setResidents]=useState<Resident[]>([]);
  const [resLoaded,setResLoaded]=useState(false);
  const [residentLoading,setResidentLoading]=useState(false);
  const [residentMessage,setResidentMessage]=useState('');
  const [query,setQuery]=useState('');
  const [residentForm,setResidentForm]=useState(emptyResident);
  const [editingResidentId,setEditingResidentId]=useState<string|null>(null);
  const [residentHistory,setResidentHistory]=useState<any[]>([]);
  const [residentHistoryId,setResidentHistoryId]=useState<string|null>(null);

  const [maintenanceRows,setMaintenanceRows]=useState<MaintenanceRow[]>([]);
  const [maintenanceLoaded,setMaintenanceLoaded]=useState(false);
  const [maintenanceLoading,setMaintenanceLoading]=useState(false);
  const [maintenanceMessage,setMaintenanceMessage]=useState('');
  const [summary,setSummary]=useState<Summary|null>(null);
  const [payments,setPayments]=useState<Payment[]>([]);
  const [paymentSummary,setPaymentSummary]=useState<PaymentSummary|null>(null);
  const [paymentLoading,setPaymentLoading]=useState(false);
  const [paymentMessage,setPaymentMessage]=useState('');
  const [paymentMonthLocked,setPaymentMonthLocked]=useState(false);
  const [paymentLock,setPaymentLock]=useState<any|null>(null);
  const [paymentLockHistory,setPaymentLockHistory]=useState<any[]>([]);
  const [maintenanceMonthLocked,setMaintenanceMonthLocked]=useState(false);
  const [expenseMonthLocked,setExpenseMonthLocked]=useState(false);
  const [selectedMaintenanceIds,setSelectedMaintenanceIds]=useState<string[]>([]);
  const [selectedPaymentFlats,setSelectedPaymentFlats]=useState<string[]>([]);
  const [importType,setImportType]=useState<'residents'|'maintenance'>('residents');
  const [importFile,setImportFile]=useState<File|null>(null);
  const importFileInputRef=useRef<HTMLInputElement|null>(null);
  const [importErrors,setImportErrors]=useState<string[]>([]);
  const [importLoading,setImportLoading]=useState(false);
  const [importMessage,setImportMessage]=useState('');
  const [paymentForms,setPaymentForms]=useState<Record<string,{paid_amount:number,payment_mode:string,reference:string,payment_date:string,remarks:string,status:'Paid'|'Pending'}>>({});
  const [dashboardKpis,setDashboardKpis]=useState<DashboardKpis|null>(null);
  const [waterHeader,setWaterHeader]=useState<WaterHeader|null>(null);
  const [chargeForm,setChargeForm]=useState({
    maintenance:750,cca:500,diesel:0,other_charges:0,
    include_maintenance:true,include_cca:true,include_diesel:true,include_municipal_water:true,
    water_mode:'Meter' as 'Meter'|'No Meter',tanker_count:0,tanker_price:0,tanker_amount:0,municipal_bill:0
  });
  const [activeApartmentId,setActiveApartmentId]=useState('demo-apartment');
  const [tenantDataStartMonth,setTenantDataStartMonth]=useState('');
  // Authenticated tenant is authoritative; do not let a previous/demo tenant leak into a new session.
  const resolvedApartmentId=()=>String(currentUser?.tenant_id || activeApartmentId || 'demo-apartment');
  const rememberScope=String(loginForm.account_id||activeApartmentId||'unknown').trim().toUpperCase() || 'unknown';
  const apartmentQuery=()=>{const tid=encodeURIComponent(resolvedApartmentId());return `tenant_id=${tid}&apartment_id=${tid}`;};
  const [activeLanguage,setActiveLanguage]=useState<'English'|'Telugu'|'Hindi'|'Tamil'|'Kannada'>('English');
  const [languageSaving,setLanguageSaving]=useState(false);
  const [languageMessage,setLanguageMessage]=useState('');
  const [settingsForm,setSettingsForm]=useState<ChargeSettings>({
    tenant_id:activeApartmentId,apartment_id:activeApartmentId,apartment_name:'ApartCare Lite',address:'',city:'',pin_code:'',state:'',country:'India',language:'English',no_of_flats:0,no_of_flats_editable:true,common_maintenance:750,cca:500,
    watchman_salary:0,watchman_salary_locked:false,apartment_photo_name:'',apartment_photo_path:'',apartment_photo_data_url:''
  });
  const [settingsLoading,setSettingsLoading]=useState(false);
  const [settingsEffectiveMonth,setSettingsEffectiveMonth]=useState(new Date().toISOString().slice(0,7));
  const [chargeHistory,setChargeHistory]=useState<any[]>([]);
  const [settingsMessage,setSettingsMessage]=useState('');
  const [watchmen,setWatchmen]=useState<Watchman[]>([]);
  const [utilityContacts,setUtilityContacts]=useState<UtilityContact[]>([]);
  const [utilityCategories,setUtilityCategories]=useState<UtilityCategory[]>([]);
  const [utilityCategoryName,setUtilityCategoryName]=useState('');
  const [editingUtilityCategoryId,setEditingUtilityCategoryId]=useState<string|null>(null);
  const [utilityForm,setUtilityForm]=useState<{category:string;name:string;mobile_no:string;remarks:string}>({category:'Plumber',name:'',mobile_no:'',remarks:''});
  const [editingUtilityId,setEditingUtilityId]=useState<string|null>(null);
  const [utilityMessage,setUtilityMessage]=useState('');
  const [watchmanHistory,setWatchmanHistory]=useState<any[]>([]);
  const [watchmanForm,setWatchmanForm]=useState({name:'',mobile_no:'',start_date:new Date().toISOString().slice(0,10),end_date:'',salary:0,locked:false,remarks:''});
  const [editingWatchmanId,setEditingWatchmanId]=useState<string|null>(null);
  const [openingBalance,setOpeningBalance]=useState<OpeningBalance|null>(null);
  const [openingHistory,setOpeningHistory]=useState<OpeningHistory[]>([]);
  const [openingForm,setOpeningForm]=useState({go_live_month:month,opening_balance:0,locked:false});
  const [openingEditMode,setOpeningEditMode]=useState(false);
  const [unlockJustification,setUnlockJustification]=useState('');
  const [showUnlockDialog,setShowUnlockDialog]=useState(false);
  const [justificationDialog,setJustificationDialog]=useState<{open:boolean;title:string;description:string;action:string;targetId?:string;locked?:boolean;context?:string;value:string;minLength:number}>({open:false,title:'',description:'',action:'',value:'',minLength:3});
  const [adminUsers,setAdminUsers]=useState<AdminUser[]>([]);
  const [loginHistory,setLoginHistory]=useState<LoginAttempt[]>([]);
  const [adminHistoryUser,setAdminHistoryUser]=useState('all');
  const [adminMessage,setAdminMessage]=useState('');
  const [emailTestLoading,setEmailTestLoading]=useState(false);
  const [adminForm,setAdminForm]=useState({username:'',full_name:'',email:'',mobile_no:'',role:'Viewer' as 'Viewer'|'Supervisor'|'Caretaker',password:''});
  const [sessionTimeouts,setSessionTimeouts]=useState<SessionTimeoutSettings>({super_admin:{enabled:false,minutes:30},admin:{enabled:true,minutes:20},viewer:{enabled:true,minutes:15},caretaker:{enabled:true,minutes:15}});
  const [reportFlats,setReportFlats]=useState<string[]>([]);
  const [reportFlat,setReportFlat]=useState('');
  const [flatStatement,setFlatStatement]=useState<FlatStatement|null>(null);
  const [individualMaintenance,setIndividualMaintenance]=useState<MaintenanceRow[]>([]);
  const [reportYear,setReportYear]=useState('2026');
  const [yearlyMaintenance,setYearlyMaintenance]=useState<any|null>(null);
  const [expenses,setExpenses]=useState<Expense[]>([]);
  const [expenseSummary,setExpenseSummary]=useState<ExpenseSummary|null>(null);
  const [expensePaymentSummary,setExpensePaymentSummary]=useState<PaymentSummary|null>(null);
  const [expenseHistory,setExpenseHistory]=useState<any[]>([]);
  const [expenseLockHistory,setExpenseLockHistory]=useState<any[]>([]);
  const [expenseLoading,setExpenseLoading]=useState(false);
  const [expenseMessage,setExpenseMessage]=useState('');
  const [editingExpenseId,setEditingExpenseId]=useState<string|null>(null);
  const [expenseYear,setExpenseYear]=useState('2026');
  const [expensePeriod,setExpensePeriod]=useState<'Monthly'|'Yearly'>('Monthly');
  const [reportTab,setReportTab]=useState<'All Flats Monthly Report'|'Yearly Collection vs Expenses'|'Individual Flat Statement'>('All Flats Monthly Report');
  const [reportMonth,setReportMonth]=useState(month);
  useEffect(()=>{
    (async()=>{
      try{
        const raw=window.localStorage.getItem('apartcare_session');
        let saved:any=null;
        try{saved=raw?JSON.parse(raw):null;}catch{}
        const sessionPromise=saved?.user?.id&&saved?.token
          ? fetch(`${API}/api/admin/auth/session`,{headers:{'X-ApartCare-Token':String(saved.token)}})
          : Promise.resolve(null);
        const [accountResponse,platformResponse,sr]=await Promise.all([
          fetch(`${API}/api/account/status`),
          fetch(`${API}/api/platform/status`),
          sessionPromise
        ]);
        const [status,ps,session]=await Promise.all([
          accountResponse.ok?accountResponse.json():Promise.resolve({initialized:false}),
          platformResponse.ok?platformResponse.json():Promise.resolve({initialized:false}),
          sr?.ok?sr.json():Promise.resolve(null)
        ]);
        setAccountInitialized(!!status.initialized);
        setPlatformInitialized(!!ps.initialized);
        try{
          const remembered=JSON.parse(window.localStorage.getItem('apartcare_login_identity')||'null');
          if(remembered?.account_id || remembered?.username){
            setLoginForm(prev=>({...prev,account_id:String(remembered.account_id||''),username:String(remembered.username||'')}));
            setRememberLogin(true);
          }
        }catch{}
        if(session?.user?.id){
          setCurrentUser(session.user);setAuthToken(String(saved.token));
          if(session.user?.tenant_id) setActiveApartmentId(String(session.user.tenant_id));
          if(session.user.role==='Supervisor')setTab('Monthly Maintenance');else setTab('Dashboard');
        }else if(saved){
          window.localStorage.removeItem('apartcare_session');
        }
        if(status?.apartment?.apartment_name){
          setSettingsForm(prev=>({...prev,...status.apartment}));
          if(status.apartment.account_id)setAccountId(status.apartment.account_id);
        }
      }finally{setAuthChecked(true);}
    })();
  },[]);
  const saveSession=(user:AdminUser,token:string)=>{
    window.localStorage.setItem('apartcare_session',JSON.stringify({user,token}));
    if(user?.tenant_id) setActiveApartmentId(String(user.tenant_id));
    setCurrentUser(user);setAuthToken(token);setLoginForm({account_id:'',username:'',password:''});setMustChangePassword(Boolean(user.force_password_change));setTab(['Supervisor','Caretaker'].includes(user.role)?'Monthly Maintenance':'Dashboard');
  };
  const getSessionToken=()=>{
    // Always prefer the current React auth token, then fall back to the persisted
    // property session. Never use Platform Owner credentials/session here.
    if(authToken)return String(authToken);
    try{const stored=JSON.parse(window.localStorage.getItem('apartcare_session')||'null');if(stored?.token)return String(stored.token);}catch{}
    return '';
  };
  const propertyFetch=async(input:RequestInfo|URL,init:RequestInit={})=>{
    const token=getSessionToken();
    const headers=new Headers(init.headers||{});
    if(token) headers.set('X-ApartCare-Token',token);
    return fetch(input,{...init,headers});
  };
  const resetPlatformAuthState=()=>{
    // Platform Owner credentials/tokens are intentionally memory-only. Every
    // entry into the Platform Owner area starts from a clean login screen.
    setPlatformUser(null);setPlatformToken('');setPlatformProperty(null);setPlatformAccounts([]);setPlatformSupportMode(false);setPlatformSupportAccount(null);
    // Platform Owner credentials are never persisted. Clear every in-memory
    // credential and remount the login form so browser autofill cannot reuse
    // the previous React input instance after logout/navigation.
    setPlatformLogin({username:'',password:''});
    setPlatformBootstrap(prev=>({...prev,username:'',password:''}));
    setPlatformMessage('');setPlatformMustChangePassword(false);setPlatformAccountSearch('');setPlatformRecoveryProperty(null);setPlatformRecoveryTenantId('');setPlatformRecoveryAccountSearch('');setPlatformRecoveryUserSearch('');setPlatformLoginHistory([]);setPlatformValidityHistory([]);setPlatformHistoryTenantId('');setPlatformPlans([]);setPlatformSubscriptions([]);setShowUnlockDialog(false);setOpeningEditMode(false);setUnlockJustification('');
    setPlatformChangeForm({new_password:'',confirm_password:''});
    setPlatformChangeMessage('');setPlatformForgot({username:'',email:''});
    setPlatformReset({token:'',new_password:'',confirm_password:''});
    setPlatformAuthView('login');
    setPlatformAuthFormKey(k=>k+1);
  };
  const getValidatedPropertyToken=async()=>{
    // Protected backend routes validate the session on every request. Avoid an
    // extra /admin/auth/session round-trip before each Settings/Payments action;
    // this was adding several seconds on a cold/remote backend.
    const token=getSessionToken();
    if(token && currentUser?.tenant_id)return token;
    return '';
  };
  useEffect(()=>{
    if(authMode!=='platform' && (platformUser || platformToken || platformForgot.username || platformLogin.username || platformLogin.password || platformBootstrap.password)){
      resetPlatformAuthState();
    }
  },[authMode]);
  const handleSessionExpired=(message='Your login session has expired. Please log in again.')=>{
    window.localStorage.removeItem('apartcare_session');
    clearTenantClientState();
    setAuthToken(''); setCurrentUser(null); setUtilityEditReady(false); setLoginError(message); setUtilityMessage(''); setAuthMode('login');
  };
  useEffect(()=>{
    if(!currentUser)return;
    if(currentUser.role==='Viewer' && !['Dashboard','Payments','Expenses','Utilities','Reports'].includes(tab)) setTab('Dashboard');
    if(['Supervisor','Caretaker'].includes(currentUser.role) && !['Monthly Maintenance','Payments','Expenses'].includes(tab)) setTab('Monthly Maintenance');
  },[currentUser,tab]);

  // Synchronize the active property namespace with the authenticated user.
  // This fixes stale demo/previous-tenant context after Viewer/Admin login or refresh.
  useEffect(()=>{
    if(currentUser?.tenant_id && activeApartmentId!==currentUser.tenant_id){
      setActiveApartmentId(String(currentUser.tenant_id));
    }
  },[currentUser?.tenant_id,activeApartmentId]);
  useEffect(()=>{
    if(currentUser?.tenant_id){
      const lang=(currentUser.language_preference||'English') as 'English'|'Telugu'|'Hindi'|'Tamil'|'Kannada';
      setActiveLanguage(['English','Telugu','Hindi','Tamil','Kannada'].includes(lang)?lang:'English');
      void loadUserLanguagePreference(currentUser);
    }else{
      setActiveLanguage('English');
    }
  },[currentUser?.id,currentUser?.tenant_id]);
  useEffect(()=>{
    if(!tenantDataStartMonth)return;
    if(month < tenantDataStartMonth) setMonth(tenantDataStartMonth);
    if(paymentMonth < tenantDataStartMonth) setPaymentMonth(tenantDataStartMonth);
    if(expenseMonth < tenantDataStartMonth) setExpenseMonth(tenantDataStartMonth);
    if(reportMonth < tenantDataStartMonth) setReportMonth(tenantDataStartMonth);
    if(individualReportMonth < tenantDataStartMonth) setIndividualReportMonth(tenantDataStartMonth);
    if(openingForm.go_live_month < tenantDataStartMonth) setOpeningForm(v=>({...v,go_live_month:tenantDataStartMonth}));
  },[tenantDataStartMonth]);
  useEffect(()=>{
    if(currentUser?.tenant_id){
      const tid=String(currentUser.tenant_id);
      setSettingsForm({tenant_id:tid,apartment_id:tid,account_id:'',account_mobile:'',apartment_name:'',address:'',city:'',pin_code:'',state:'',country:'India',language:'English',no_of_flats:0,no_of_flats_editable:true,common_maintenance:0,cca:0,watchman_salary:0,watchman_salary_locked:false,apartment_photo_name:'',apartment_photo_path:'',apartment_photo_data_url:''});
      setTenantDataStartMonth('');
      setOpeningBalance(null);setOpeningHistory([]);setOpeningEditMode(false);setShowUnlockDialog(false);setUnlockJustification('');
      // Bootstrap tenant-owned header/settings immediately after login so the
      // apartment address is never dependent on navigating to Settings.
      void Promise.all([loadSettings(),loadOpeningBalance()]);
    }
  },[currentUser?.tenant_id]);

  useEffect(()=>{
    const lang=String(activeLanguage||'English');
    const fontMap:Record<string,string>={
      English:'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
      Telugu:'"Noto Sans Telugu", "Nirmala UI", "Gautami", sans-serif',
      Hindi:'"Noto Sans Devanagari", "Nirmala UI", "Mangal", sans-serif',
      Tamil:'"Noto Sans Tamil", "Nirmala UI", "Latha", sans-serif',
      Kannada:'"Noto Sans Kannada", "Nirmala UI", "Tunga", sans-serif'
    };
    const langCode:Record<string,string>={English:'en-IN',Telugu:'te-IN',Hindi:'hi-IN',Tamil:'ta-IN',Kannada:'kn-IN'};
    document.documentElement.style.setProperty('--ac-font',fontMap[lang]||fontMap.English);
    document.documentElement.lang=langCode[lang]||'en-IN';
    document.documentElement.dataset.apartcareLanguage=lang;
  },[activeLanguage]);

  const loginToApartCare=async(e:React.FormEvent)=>{
    e.preventDefault();setLoginError('');setLoginAccountChoices([]);
    const apiAccountId=accountApiValue(loginForm.account_id.trim());
    const url=`${API}/api/admin/auth/login?account_id=${encodeURIComponent(apiAccountId)}`;
    try{
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:loginForm.username.trim(),password:loginForm.password})});
      if(!r.ok){
        const d=await r.json().catch(()=>null);
        if(r.status===409 && Array.isArray(d?.detail?.accounts)){
          setLoginAccountChoices(d.detail.accounts);
          setLoginError('More than one apartment matches these login details. Select the apartment you want to enter.');
        }else{
          setLoginError(typeof d?.detail==='string'?d.detail:'Login failed.');
        }
        return;
      }
      const d=await r.json();if(d.account?.account_id){setAccountId(d.account.account_id); if(d.account?.tenant_id)setActiveApartmentId(d.account.tenant_id);setTenantDataStartMonth(d.account?.data_start_month||'');}
      if(rememberLogin){
        try{
          window.localStorage.setItem('apartcare_login_identity',JSON.stringify({
            account_id:loginForm.account_id.trim().toUpperCase(),
            username:loginForm.username.trim()
          }));
          // Standard policy: application storage contains only Account Number and User ID.
          // Passwords are never written by ApartCare; users may use the browser's own
          // password manager independently.
        }catch{}
      }else{
        window.localStorage.removeItem('apartcare_login_identity');
      }
      if(d.account?.tenant_id)setActiveApartmentId(String(d.account.tenant_id));
      saveSession(d.user,d.token);
    }catch(err:any){
      setLoginError('Unable to connect to the ApartCare server. Please make sure the backend is running on port 8000.');
    }
  };
  const requestPasswordReset=async(e:React.FormEvent)=>{
    e.preventDefault();setLoginError('');
    const r=await fetch(`${API}/api/admin/auth/request-password-reset`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(forgotForm)});
    const d=await r.json().catch(()=>null);
    if(!r.ok){setLoginError(d?.detail||'Unable to send password reset email.');return;}
    setLoginError(d?.message||'If the account details match our records, a password reset email has been sent.');
    setAuthMode('reset');
  };
  const confirmPasswordReset=async(e:React.FormEvent)=>{
    e.preventDefault();setLoginError('');
    if(resetForm.new_password!==resetForm.confirm_password){setLoginError('Passwords do not match.');return;}
    const r=await fetch(`${API}/api/admin/auth/confirm-password-reset`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:resetForm.token,new_password:resetForm.new_password})});
    const d=await r.json().catch(()=>null);
    if(!r.ok){setLoginError(d?.detail||'Unable to reset password.');return;}
    setLoginError('Password reset successful. Please log in.');setAuthMode('login');setResetForm({token:'',new_password:'',confirm_password:''});
  };
  const requestPlatformPasswordReset=async(e:React.FormEvent)=>{e.preventDefault();setPlatformMessage('');const r=await fetch(`${API}/api/platform/request-password-reset`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(platformForgot)});const d=await r.json().catch(()=>null);if(!r.ok){setPlatformMessage(d?.detail||'Unable to send reset email.');return;}setPlatformMessage(d?.message||'Reset email sent.');setPlatformAuthView('reset');};
  const changePlatformPassword=async(e:React.FormEvent)=>{e.preventDefault();setPlatformChangeMessage('');if(platformChangeForm.new_password!==platformChangeForm.confirm_password){setPlatformChangeMessage('Passwords do not match.');return;}if(platformChangeForm.new_password.length<8){setPlatformChangeMessage('Password must be at least 8 characters.');return;}if(!platformToken){setPlatformChangeMessage('Platform session is unavailable. Please sign in again.');return;}const r=await fetch(`${API}/api/platform/auth/change-password`,{method:'POST',headers:{'Content-Type':'application/json','X-Auth-Token':platformToken},body:JSON.stringify({new_password:platformChangeForm.new_password})});const d=await r.json().catch(()=>null);if(!r.ok){setPlatformChangeMessage(d?.detail||'Unable to change Platform Owner password.');return;}setPlatformUser(d);setPlatformMustChangePassword(false);setPlatformChangeForm({new_password:'',confirm_password:''});setPlatformChangeMessage('Password changed successfully.');};
  const confirmPlatformPasswordReset=async(e:React.FormEvent)=>{e.preventDefault();setPlatformMessage('');if(platformReset.new_password!==platformReset.confirm_password){setPlatformMessage('Passwords do not match.');return;}const r=await fetch(`${API}/api/platform/confirm-password-reset`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:platformReset.token,new_password:platformReset.new_password})});const d=await r.json().catch(()=>null);if(!r.ok){setPlatformMessage(d?.detail||'Unable to reset Platform Owner password.');return;}setPlatformMessage(d?.message||'Password reset successful.');setPlatformAuthView('login');setPlatformReset({token:'',new_password:'',confirm_password:''});};
  const loadPlatformProperty=async(token:string,tenantId:string)=>{
    if(!tenantId){setPlatformProperty(null);return;}
    const r=await fetch(`${API}/api/platform/accounts/${encodeURIComponent(tenantId)}/users`,{headers:{'X-Auth-Token':token}});
    const d=await r.json().catch(()=>null);
    if(r.ok)setPlatformProperty({...d.account,users:d.users||[]});
    else {setPlatformProperty(null);setPlatformMessage(d?.detail||'Unable to load selected property users.');}
  };
  const loadPlatformRecoveryProperty=async(token:string,tenantId:string)=>{
    if(!tenantId){setPlatformRecoveryProperty(null);return;}
    await runPlatformAction(`recovery-users:${tenantId}`,async()=>{
      if(tenantId==='ALL'){
        const allUsers=(platformAccounts||[]).flatMap((a:any)=>(a.users||[]).map((u:any)=>({...u,_tenant_id:a.tenant_id,_account_id:a.account_id,_apartment_name:a.apartment_name})));
        setPlatformRecoveryProperty({tenant_id:'ALL',account_id:'ALL',apartment_name:'All Apartment Accounts',status:'Active',users:allUsers});
        setPlatformRecoveryTenantId('ALL');
        return;
      }
      const r=await fetch(`${API}/api/platform/accounts/${encodeURIComponent(tenantId)}/users`,{headers:{'X-Auth-Token':token}});
      const d=await r.json().catch(()=>null);
      if(r.ok){
        setPlatformRecoveryProperty({...d.account,users:d.users||[]});
        setPlatformRecoveryTenantId(tenantId);
      }else{
        setPlatformRecoveryProperty(null);
        setPlatformMessage(d?.detail||'Unable to load selected tenant users.');
      }
    });
  };
  const loadPlatformAccounts=async(token:string)=>{
    await runPlatformAction('platform-accounts-load',async()=>{
      const r=await fetch(`${API}/api/platform/accounts`,{headers:{'X-Auth-Token':token}});
      const d=await r.json().catch(()=>null);
      if(!r.ok){setPlatformMessage(d?.detail||'Unable to load Apartment Accounts.');return;}
      const accounts=Array.isArray(d)?d:[];
      setPlatformAccounts(accounts);
      if(accounts.length && !platformRecoveryTenantId){
        setPlatformRecoveryTenantId(accounts[0].tenant_id);
        void loadPlatformRecoveryProperty(token,accounts[0].tenant_id);
      }
    });
  };
  const platformAuditQuery=()=>{const q=new URLSearchParams();if(platformAuditSearch.trim())q.set('q',platformAuditSearch.trim());if(platformAuditAccount.trim())q.set('account_id',platformAuditAccount.trim());if(platformAuditUser.trim())q.set('user_id',platformAuditUser.trim());if(platformAuditEvent)q.set('event_type',platformAuditEvent);if(platformAuditFrom)q.set('from_date',platformAuditFrom);if(platformAuditTo)q.set('to_date',platformAuditTo);return q.toString();};
  const loadPlatformLoginHistory=async(token:string)=>{
    await runPlatformAction('platform-audit-load',async()=>{
      const qs=platformAuditQuery();
      const r=await fetch(`${API}/api/platform/login-history${qs?`?${qs}`:''}`,{headers:{'X-Auth-Token':token}});
      const d=await r.json().catch(()=>null);
      if(!r.ok){setPlatformMessage(d?.detail||'Unable to load global Login & Audit History.');return;}
      setPlatformLoginHistory(Array.isArray(d)?d:[]);
    });
  };
  const downloadPlatformAuditHistory=async()=>{const qs=platformAuditQuery();const r=await fetch(`${API}/api/platform/login-history/download${qs?`?${qs}`:''}`,{headers:{'X-Auth-Token':platformToken}});if(!r.ok){const d=await r.json().catch(()=>null);setPlatformMessage(d?.detail||'Unable to download audit history.');return;}const blob=await r.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ApartCare_Global_Login_Audit_History.csv';a.click();URL.revokeObjectURL(url);};
  const purgePlatformAuditHistory=async()=>{const qs=platformAuditQuery();if(!qs){setPlatformMessage('Enter at least one filter criterion before deleting audit history.');return;}if(!window.confirm(`Delete ONLY matching audit records?\n\nAccount: ${platformAuditAccount||'Any'}\nUser: ${platformAuditUser||'Any'}\nEvent: ${platformAuditEvent||'Any'}\nFrom: ${platformAuditFrom||'Any'}\nTo: ${platformAuditTo||'Any'}\nSearch: ${platformAuditSearch||'Any'}\n\nThe purge action itself will remain in the audit trail.`))return;const r=await fetch(`${API}/api/platform/login-history?${qs}`,{method:'DELETE',headers:{'X-Auth-Token':platformToken}});const d=await r.json().catch(()=>null);if(!r.ok){setPlatformMessage(d?.detail||'Unable to delete audit history.');return;}setPlatformMessage(`${d.removed||0} matching audit records deleted. The purge action was retained.`);await loadPlatformLoginHistory(platformToken);};
  const loadPlatformSubscriptions=async(token:string)=>{
    await runPlatformAction('platform-subscriptions-load',async()=>{
      const [sr,pr,rr]=await Promise.all([
        fetch(`${API}/api/platform/subscription/settings`,{headers:{'X-Auth-Token':token}}),
        fetch(`${API}/api/platform/subscription/plans`,{headers:{'X-Auth-Token':token}}),
        fetch(`${API}/api/platform/subscriptions`,{headers:{'X-Auth-Token':token}})
      ]);
      const sd=await sr.json().catch(()=>null),pd=await pr.json().catch(()=>null),rd=await rr.json().catch(()=>null);
      if(!sr.ok||!pr.ok||!rr.ok){setPlatformSubscriptionMessage(sd?.detail||pd?.detail||rd?.detail||'Unable to load Subscription & Billing.');return;}
      setPlatformSubscriptionSettings(sd);setPlatformPlans(Array.isArray(pd)?pd:[]);setPlatformSubscriptions(Array.isArray(rd)?rd:[]);
    });
  };
  const savePlatformSubscriptionSettings=async()=>{
    if(!platformToken||!platformSubscriptionSettings)return;
    const payload={...platformSubscriptionSettings, reminder_days:platformSubscriptionSettings.reminder_days||[7,3,1]};
    delete payload.updated_at;delete payload.updated_by;
    const r=await fetch(`${API}/api/platform/subscription/settings`,{method:'PUT',headers:{'Content-Type':'application/json','X-Auth-Token':platformToken},body:JSON.stringify(payload)});
    const d=await r.json().catch(()=>null);
    if(!r.ok){setPlatformSubscriptionMessage(d?.detail||'Unable to save subscription settings.');return;}
    setPlatformSubscriptionSettings(d);setPlatformSubscriptionMessage('Subscription policy saved. The selected default plan applies to new accounts; Trial is optional and never assigned unless enabled.');await loadPlatformSubscriptions(platformToken);
  };
  const createPlatformPlan=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(planCreating) return;
    if(!platformToken){setPlatformSubscriptionMessage('Product Owner session is required.');return;}
    if(!newPlanForm.code.trim()||!newPlanForm.name.trim()){setPlatformSubscriptionMessage('Plan Code and Plan Name are required.');return;}
    if(newPlanForm.trial_enabled && Number(newPlanForm.trial_value||0)<1){setPlatformSubscriptionMessage('Enter a Trial Duration of at least 1.');return;}
    setPlanCreating(true); setPlatformSubscriptionMessage('');
    try{
      const payload={code:newPlanForm.code.trim().toUpperCase(),name:newPlanForm.name.trim(),description:newPlanForm.description.trim(),monthly_price:Number(newPlanForm.monthly_price||0),annual_price:Number(newPlanForm.annual_price||0),currency:'INR',active:true,trial_enabled:Boolean(newPlanForm.trial_enabled),trial_value:newPlanForm.trial_enabled?Number(newPlanForm.trial_value||0):0,trial_unit:newPlanForm.trial_unit,features:{Residents:true,'Monthly Maintenance':true,Payments:true,Expenses:true,Utilities:true,Reports:true,'Data Import':true,'WhatsApp Sharing':true}};
      const r=await fetch(`${API}/api/platform/subscription/plans`,{method:'POST',headers:{'Content-Type':'application/json','X-Auth-Token':platformToken},body:JSON.stringify(payload)});
      const d=await r.json().catch(()=>null);
      if(!r.ok){setPlatformSubscriptionMessage(d?.detail||`Unable to create plan (HTTP ${r.status}).`);return;}
      setPlatformPlans(prev=>[d,...prev.filter((x:any)=>x.id!==d.id)]);
      setNewPlanForm({code:'',name:'',description:'',monthly_price:'',annual_price:'',trial_enabled:false,trial_value:'',trial_unit:'Days'});
      setPlatformSubscriptionMessage(`${d.name} plan created successfully${d.trial_enabled?' as a '+d.trial_value+' '+d.trial_unit+' Trial Plan':''}. It is now available for assignment to every apartment account.`);
      setNewPlanForm({code:'',name:'',description:'',monthly_price:'',annual_price:'',trial_enabled:false,trial_value:'',trial_unit:'Days'});
      await loadPlatformSubscriptions(platformToken);
    }catch(err:any){
      setPlatformSubscriptionMessage(err?.message||'Unable to create plan.');
    }finally{setPlanCreating(false);}
  };
  const loadPlatformSubscriptionHistory=async(token:string,tenantId:string)=>{
    if(!token||!tenantId)return;
    await runPlatformAction(`subscription-history:${tenantId}`,async()=>{
      const r=await fetch(`${API}/api/platform/accounts/${encodeURIComponent(tenantId)}/subscription`,{headers:{'X-Auth-Token':token}});
      const d=await r.json().catch(()=>null);
      if(!r.ok){setPlatformSubscriptionMessage(d?.detail||'Unable to load subscription history.');return;}
      setPlatformSubscriptionHistory(Array.isArray(d?.history)?d.history:[]);
      setPlatformSubscriptionHistoryTenantId(tenantId);
    });
  };
  const updatePlanPrice=async(plan:any,field:'monthly_price'|'annual_price',value:string)=>{
    const r=await fetch(`${API}/api/platform/subscription/plans/${encodeURIComponent(plan.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json','X-Auth-Token':platformToken},body:JSON.stringify({[field]:Number(value||0)})});
    const d=await r.json().catch(()=>null);if(!r.ok){setPlatformSubscriptionMessage(d?.detail||'Unable to update plan.');return;}setPlatformPlans(prev=>prev.map(x=>x.id===plan.id?d:x));
  };
  const platformExtendTrialFromSubscription=async(row:any)=>{
    await runPlatformAction(`trial-extension:${row.account.tenant_id}`,async()=>{
      const value=window.prompt('Extend trial by how many Days?', '30');if(!value)return;
      const reason=window.prompt('Reason for trial extension?','Customer evaluation extension');if(!reason)return;
      const r=await fetch(`${API}/api/platform/accounts/${encodeURIComponent(row.account.tenant_id)}/subscription/trial-extension`,{method:'POST',headers:{'Content-Type':'application/json','X-Auth-Token':platformToken},body:JSON.stringify({value:Number(value),unit:'Days',reason})});
      const d=await r.json().catch(()=>null);if(!r.ok){setPlatformSubscriptionMessage(d?.detail||'Unable to extend trial.');return;}
      setPlatformSubscriptionMessage(`Trial extended for ${row.account.account_id}.`);
      await loadPlatformSubscriptions(platformToken);
    });
  };
  const platformGrantComplimentary=async(row:any)=>{
    await runPlatformAction(`complimentary:${row.account.tenant_id}`,async()=>{
      const valid=window.prompt('Complimentary validity end date (DD/MM/YYYY), or leave blank for no expiry.','');if(valid===null)return;
      let iso:string|undefined=undefined;
      if(valid.trim()){const p=valid.trim().split('/');iso=p.length===3?`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`:valid.trim();}
      const reason=window.prompt('Reason for complimentary access?','Partner / demo account');if(!reason)return;
      const r=await fetch(`${API}/api/platform/accounts/${encodeURIComponent(row.account.tenant_id)}/subscription/complimentary`,{method:'POST',headers:{'Content-Type':'application/json','X-Auth-Token':platformToken},body:JSON.stringify({valid_to:iso||null,reason})});
      const d=await r.json().catch(()=>null);if(!r.ok){setPlatformSubscriptionMessage(d?.detail||'Unable to grant complimentary access.');return;}
      setPlatformSubscriptionMessage(`Complimentary access granted for ${row.account.account_id}.`);
      await loadPlatformSubscriptions(platformToken);
    });
  };
  const platformAssignPlan=async(row:any,planId:string)=>{
    if(!planId){setPlatformSubscriptionMessage('Select a plan before assigning it.');return;}
    await runPlatformAction(`platform-assign-plan:${row.account.tenant_id}`,async()=>{
      const r=await fetch(`${API}/api/platform/accounts/${encodeURIComponent(row.account.tenant_id)}/subscription/assign-plan/${encodeURIComponent(planId)}`,{method:'POST',headers:{'X-Auth-Token':platformToken}});
      const d=await r.json().catch(()=>null);
      if(!r.ok){setPlatformSubscriptionMessage(d?.detail||'Unable to assign plan.');return;}
      setPlatformSubscriptionMessage(d.summary?.subscription_type==='TRIAL'?`${d.summary?.plan?.name||'Trial Plan'} assigned to ${row.account.account_id}. Trial is active through ${d.summary?.trial_end_date?formatDate(d.summary.trial_end_date):'the configured end date'}.`:`${d.summary?.plan?.name||'Plan'} assigned to ${row.account.account_id}. Payment remains pending until the gateway confirms it.`);
      setPlatformSelectedPlanByTenant(prev=>({...prev,[row.account.tenant_id]:planId}));
      await loadPlatformSubscriptions(platformToken);
      await loadPlatformSubscriptionHistory(platformToken,row.account.tenant_id);
    });
  };
  const loadTenantSubscription=async(token:string)=>{
    if(!token)return;const r=await fetch(`${API}/api/subscription`,{headers:{'X-ApartCare-Token':token}});const d=await r.json().catch(()=>null);if(r.ok){setTenantSubscription(d);setTenantSubscriptionMessage('');}else{setTenantSubscriptionMessage(d?.detail||'Unable to load subscription status.');}
  };
  const startSubscriptionCheckout=async()=>{
    if(!authToken)return;setTenantSubscriptionMessage('');const r=await fetch(`${API}/api/subscription/checkout`,{method:'POST',headers:{'X-ApartCare-Token':authToken}});const d=await r.json().catch(()=>null);if(!r.ok){setTenantSubscriptionMessage(d?.detail||'Unable to start subscription checkout.');return;}setTenantSubscriptionMessage(d?.message||'Subscription checkout is ready.');
  };
  const startPlatformSupport=async(tenantId:string)=>{
    if(!platformToken)return;
    await runPlatformAction(`support-session:${tenantId}`,async()=>{
      setPlatformMessage('');
      const r=await fetch(`${API}/api/platform/accounts/${encodeURIComponent(tenantId)}/support-session`,{method:'POST',headers:{'X-Auth-Token':platformToken}});
      const d=await r.json().catch(()=>null);
      if(!r.ok){setPlatformMessage(d?.detail||'Unable to start Audit/Support access.');return;}
      window.localStorage.removeItem('apartcare_session');
      setPlatformSupportMode(true);setPlatformSupportAccount(d.account||null);setPlatformProperty({...d.account,users:d.users||[]});
      setCurrentUser(d.user);setAuthToken(d.token);setActiveApartmentId(String(d.account?.tenant_id||tenantId));setAccountId(d.account?.account_id||'');setTenantDataStartMonth(d.account?.data_start_month||'');
      setMustChangePassword(false);setLoginError('');setTab('Dashboard');
      window.scrollTo({top:0,left:0,behavior:'instant' as ScrollBehavior});
    });
  };
  const exitPlatformSupport=async()=>{
    try{if(authToken)await fetch(`${API}/api/platform/support-session/logout`,{method:'POST',headers:{'X-ApartCare-Token':authToken}});}catch{}
    setPlatformSupportMode(false);setPlatformSupportAccount(null);setPlatformProperty(null);setCurrentUser(null);setAuthToken('');setAccountId('');setUtilityEditReady(false);setLoginError('');setAuthMode('platform');
  };
  const platformSignIn=async(e?:React.FormEvent)=>{
    e?.preventDefault();
    if(platformBusy)return;
    setPlatformMessage('');setPlatformLoginError('');
    const preferredEndpoint=platformInitialized?'/api/platform/login':'/api/platform/bootstrap';
    const preferredPayload=platformInitialized?platformLogin:platformBootstrap;
    if(!preferredPayload.username?.trim() || !preferredPayload.password){
      setPlatformLoginError('Enter your Platform Owner User ID / Recovery Email and password.');
      return;
    }
    if(!platformInitialized && (!(platformBootstrap as any).full_name?.trim() || !(platformBootstrap as any).email?.trim())){
      setPlatformLoginError('Enter Full Name and Recovery Email to create the Platform Owner.');
      return;
    }
    setPlatformBusy(true);
    try{
      let r=await fetch(`${API}${preferredEndpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(preferredPayload)});
      let d=await r.json().catch(()=>null);
      // Recover from an unavailable/stale platform-status response by trying the alternate supported endpoint.
      if(!r.ok && !platformInitialized){
        r=await fetch(`${API}/api/platform/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:platformBootstrap.username,password:platformBootstrap.password})});
        d=await r.json().catch(()=>null);
      }
      if(!r.ok){setPlatformLoginError(d?.detail||`Platform sign-in failed (HTTP ${r.status}).`);return;}
      if(!d?.user || !d?.token){setPlatformLoginError('Platform sign-in returned an incomplete response. Please restart the backend and try again.');return;}
      setPlatformInitialized(true);
      setPlatformUser(d.user);
      setPlatformToken(d.token);
      setPlatformMustChangePassword(Boolean(d.user?.force_password_change || d.force_password_change));
      setPlatformChangeMessage('');
      if(d.email_message) setPlatformMessage(d.email_message);
      setPlatformProperty(null);
      // Show the Platform Owner console immediately after authentication.
      // Account/audit/subscription data can hydrate in parallel without making
      // the login response wait for every secondary API request/cold start.
      // Load only the account workspace during sign-in. Billing, audit and
      // recovery hydrate when their tabs are opened, keeping Platform Owner
      // login responsive instead of firing several database requests at once.
      void loadPlatformAccounts(d.token);
    }catch(err:any){
      setPlatformLoginError(`Unable to contact the ApartCare backend. Please confirm the backend is running on ${API}. ${err?.message||''}`.trim());
    }finally{
      setPlatformBusy(false);
    }
  };
  const platformUnlock=async(userId:string,tenantIdOverride?:string)=>{
    const tenantId=tenantIdOverride||platformProperty?.tenant_id||platformRecoveryProperty?.tenant_id;
    if(!tenantId){setPlatformMessage('Select an Apartment Account before managing its users.');return;}
    const r=await fetch(`${API}/api/platform/accounts/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/unlock`,{method:'POST',headers:{'X-Auth-Token':platformToken}});
    const d=await r.json().catch(()=>null);
    if(!r.ok){setPlatformMessage(d?.detail||'Unable to unlock user.');return;}
    setPlatformMessage(`Unlocked ${d.username}.`);
    await loadPlatformRecoveryProperty(platformToken,tenantId);
    await loadPlatformLoginHistory(platformToken);
    if(platformProperty?.tenant_id===tenantId) await loadPlatformProperty(platformToken,tenantId);
  };
  const platformResetUser=async(userId:string,tenantIdOverride?:string)=>{
    const tenantId=tenantIdOverride||platformProperty?.tenant_id||platformRecoveryProperty?.tenant_id;
    if(!tenantId){setPlatformMessage('Select an Apartment Account before managing its users.');return;}
    const selectedProperty=platformRecoveryProperty?.tenant_id===tenantId?platformRecoveryProperty:platformProperty;
    const target=selectedProperty?.users?.find((u:any)=>u.id===userId);
    const targetLabel=target?.username||'selected user';
    const pwd=window.prompt(`Enter a temporary password for ${targetLabel} (minimum 8 characters):`);
    if(!pwd)return;
    if(pwd.length<8){setPlatformMessage('Temporary password must be at least 8 characters.');return;}
    const r=await fetch(`${API}/api/platform/accounts/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/reset-password`,{method:'POST',headers:{'Content-Type':'application/json','X-Auth-Token':platformToken},body:JSON.stringify({new_password:pwd,force_change:true})});
    const d=await r.json().catch(()=>null);
    if(!r.ok){setPlatformMessage(d?.detail||'Unable to reset password.');return;}
    setPlatformMessage(`Password reset for ${d.username}. The user must change it at next login.`);
    await loadPlatformRecoveryProperty(platformToken,tenantId);
    await loadPlatformLoginHistory(platformToken);
    if(platformProperty?.tenant_id===tenantId) await loadPlatformProperty(platformToken,tenantId);
  };
  const platformExtendAccount=async(account:any)=>{
    await runPlatformAction(`extend-account:${account.tenant_id}`,async()=>{
      const current=account.valid_to||'';
      const next=window.prompt(`Enter the new Account End Validity date (DD/MM/YYYY). Current end: ${formatDate(current)}`, formatDate(current));
      if(!next)return;
      const parts=next.trim().split('/');
      const value=parts.length===3?`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`:next.trim();
      if(!/^\d{4}-\d{2}-\d{2}$/.test(value)){setPlatformMessage('Invalid validity date. Use DD/MM/YYYY.');return;}
      if(value<=current){setPlatformMessage(`New validity end date must be after ${formatDate(current)}.`);return;}
      const r=await fetch(`${API}/api/platform/accounts/${account.tenant_id}`,{method:'PATCH',headers:{'Content-Type':'application/json','X-Auth-Token':platformToken},body:JSON.stringify({status:account.status==='Expired'?'Active':account.status,valid_to:value,reason:`Account validity extended by Platform Owner from ${formatDate(current)} to ${formatDate(value)}.`})});
      const d=await r.json().catch(()=>null);if(!r.ok){setPlatformMessage(d?.detail||'Unable to extend account validity.');return;}
      setPlatformMessage(`Account ${d.account_id} validity extended to ${formatDate(d.valid_to)}. New history entry recorded.`);
      await loadPlatformAccounts(platformToken);
      if(platformHistoryTenantId===account.tenant_id) await loadPlatformValidityHistory(platformToken,account.tenant_id);
    });
  };
  const platformLockAccount=async(account:any)=>{openJustificationDialog({title:`Lock Apartment Account — ${account.account_id}`,description:'The apartment and its users will be prevented from signing in until the account is unlocked. The reason is retained in validity history.',action:'platform-account',targetId:account.tenant_id,locked:true,minLength:3});};
  const platformUnlockAccount=async(account:any)=>{openJustificationDialog({title:`Unlock Apartment Account — ${account.account_id}`,description:'Unlocking restores tenant access subject to the current validity period. The reason is retained in validity history.',action:'platform-account',targetId:account.tenant_id,locked:false,minLength:3});};
  const loadPlatformValidityHistory=async(token:string,tenantId:string)=>{
    if(!token||!tenantId)return;
    await runPlatformAction(`validity-history:${tenantId}`,async()=>{
      const r=await fetch(`${API}/api/platform/accounts/${encodeURIComponent(tenantId)}/validity-history`,{headers:{'X-Auth-Token':token}});
      const d=await r.json().catch(()=>null);
      if(!r.ok){setPlatformMessage(d?.detail||'Unable to load account validity history.');return;}
      setPlatformValidityHistory(Array.isArray(d)?d:[]);
      setPlatformHistoryTenantId(tenantId);
    });
  };
  useEffect(()=>{
    if(!platformUser||!platformToken)return;
    if(platformConsoleTab==='accounts') void loadPlatformAccounts(platformToken);
    if(platformConsoleTab==='billing') void loadPlatformSubscriptions(platformToken);
    if(platformConsoleTab==='audit') void loadPlatformLoginHistory(platformToken);
    if(platformConsoleTab==='recovery'){
      void loadPlatformAccounts(platformToken);
      if(platformRecoveryTenantId) void loadPlatformRecoveryProperty(platformToken,platformRecoveryTenantId);
    }
  },[platformConsoleTab,platformUser,platformToken]);

  const platformDeleteAccount=async(account:any)=>{
    setPlatformMessage('Permanent Apartment Account deletion is disabled in V6.4.48. Use Lock / Unlock so the account and its time history remain auditable.');
  };

  const platformLogout=async()=>{
    const token=platformToken;
    try{
      if(token) await fetch(`${API}/api/platform/logout`,{method:'POST',headers:{'X-Auth-Token':token}}).catch(()=>{});
    }finally{
      setPlatformAccounts([]);setPlatformSupportMode(false);setPlatformSupportAccount(null);setPlatformProperty(null);setPlatformRecoveryProperty(null);setPlatformRecoveryTenantId('');setPlatformConsoleTab('accounts');
      resetPlatformAuthState();
      setAuthMode('login');
      setLoginError('');
    }
  };
  const createApartmentAccount=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(accountBusy)return;
    setLoginError('');
    if(accountForm.password!==accountForm.confirm_password){setLoginError('Password and Confirm Password do not match.');return;}
    const {confirm_password,data_start_month,...payload}=accountForm;
    setAccountBusy(true);
    try{
      const r=await fetch(`${API}/api/account/create`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const d=await r.json().catch(()=>null);
      if(!r.ok){setLoginError(d?.detail||`Unable to create Apartment Account (HTTP ${r.status}).`);return;}
      const account=d?.account || d;
      if(!account?.account_id){setLoginError('Apartment Account creation returned an incomplete response. Please check the backend logs.');return;}
      clearTenantClientState();
      setAccountId(account.account_id);
      setActiveApartmentId(account.tenant_id||'demo-apartment');
      setTenantDataStartMonth(account.data_start_month||'');
      setAccountInitialized(true);
      setSettingsForm(prev=>({...prev,tenant_id:account.tenant_id||prev.tenant_id,apartment_id:account.tenant_id||prev.apartment_id,account_id:account.account_id,account_mobile:accountForm.admin_mobile,apartment_name:accountForm.apartment_name,address:accountForm.address,city:accountForm.city,state:accountForm.state,pin_code:accountForm.pin_code,country:accountForm.country,language:accountForm.language}));
      setLoginForm({account_id:account.account_id,username:accountForm.admin_username||accountForm.admin_email,password:''});
      setAccountForm(newApartmentAccountForm());
      setAuthMode('login');
      setLoginError(`Apartment created successfully. Account Number: ${account.account_id}. ${d?.email_message||''}`.trim());
    }catch(err:any){
      setLoginError(`Unable to contact the ApartCare backend. Please confirm the backend is running. ${err?.message||''}`.trim());
    }finally{
      setAccountBusy(false);
    }
  };
  const clearTenantClientState=()=>{
    setActiveApartmentId('');setAccountId('');setTenantDataStartMonth('');setTenantSubscription(null);setTenantSubscriptionMessage('');
    setSettingsForm({tenant_id:'',apartment_id:'',account_id:'',account_mobile:'',apartment_name:'',address:'',city:'',pin_code:'',state:'',country:'India',language:'English',no_of_flats:0,no_of_flats_editable:true,common_maintenance:0,cca:0,watchman_salary:0,watchman_salary_locked:false,apartment_photo_name:'',apartment_photo_path:'',apartment_photo_data_url:''});
    setResidents([]);setMaintenanceRows([]);setSummary(null);setPayments([]);setPaymentSummary(null);setDashboardKpis(null);setWaterHeader(null);setWatchmen([]);setUtilityContacts([]);setUtilityCategories([]);setWatchmanHistory([]);setOpeningBalance(null);setOpeningHistory([]);
    setExpenses([]);setExpenseSummary(null);setExpensePaymentSummary(null);setExpenseHistory([]);setExpenseLockHistory([]);setAllFlatsReport(null);setYearlyCollectionReport(null);setYearlyExpense(null);setFlatStatement(null);setIndividualMaintenance([]);setReportFlats([]);setLoginHistory([]);setAdminUsers([]);setResidentHistory([]);setPaymentLockHistory([]);setPaymentLock(null);setPaymentForms({});setSelectedMaintenanceIds([]);setSelectedPaymentFlats([]);setEditingResidentId(null);setEditingExpenseId(null);setEditingWatchmanId(null);setEditingUtilityId(null);
    setSettingsMessage('');setUtilityMessage('');setExpenseMessage('');setPaymentMessage('');setResidentMessage('');setMaintenanceMessage('');setReportMessage('');setAdminMessage('');
  };
  const logoutApartCare=()=>{const token=authToken; if(token){void fetch(`${API}/api/admin/auth/logout`,{method:'POST',headers:{'X-ApartCare-Token':token},keepalive:true}).catch(()=>{});} window.localStorage.removeItem('apartcare_session');clearTenantClientState();setMustChangePassword(false);setCurrentUser(null);setAuthToken('');setUtilityEditReady(false);setLoginError('');try{const remembered=JSON.parse(window.localStorage.getItem('apartcare_login_identity')||'null');if(remembered?.account_id||remembered?.username){setLoginForm({account_id:String(remembered.account_id||''),username:String(remembered.username||''),password:''});setRememberLogin(true);}else{setLoginForm({account_id:'',username:'',password:''});setRememberLogin(false);}}catch{setLoginForm({account_id:'',username:'',password:''});}setAuthMode('login');};
  const previousTenantRef=useRef('');
  const resetTenantDisplayState=()=>{
    setSettingsForm({tenant_id:'',apartment_id:'',account_id:'',account_mobile:'',apartment_name:'',address:'',city:'',pin_code:'',state:'',country:'India',language:'English',no_of_flats:0,no_of_flats_editable:true,common_maintenance:0,cca:0,watchman_salary:0,watchman_salary_locked:false,apartment_photo_name:'',apartment_photo_path:'',apartment_photo_data_url:''});
    setOpeningBalance(null);setOpeningHistory([]);setResidents([]);setMaintenanceRows([]);setPayments([]);setPaymentSummary(null);setDashboardKpis(null);setSummary(null);setWaterHeader(null);setExpenses([]);setExpenseSummary(null);setExpensePaymentSummary(null);setExpenseHistory([]);setExpenseLockHistory([]);setAllFlatsReport(null);setYearlyCollectionReport(null);setYearlyExpense(null);setFlatStatement(null);setIndividualMaintenance([]);setReportFlats([]);setWatchmen([]);setWatchmanHistory([]);setUtilityContacts([]);setUtilityCategories([]);setPaymentForms({});setSelectedPaymentFlats([]);setSelectedMaintenanceIds([]);setOpeningEditMode(false);
  };
  useEffect(()=>{
    const raw=typeof window!=='undefined'?window.localStorage.getItem('apartcare_session'):null;
    if(!raw)return;
    let session:any; try{session=JSON.parse(raw);}catch{return;}
    const sessionRole=String(session?.user?.role||session?.role||'Viewer');
    const roleKey=(sessionRole==='Super Admin'||sessionRole==='Platform Owner')?'super_admin':sessionRole==='Admin'?'admin':sessionRole==='Caretaker'?'caretaker':'viewer';
    let lastActivity=Date.now();
    const touch=()=>{lastActivity=Date.now();};
    const events=['mousemove','mousedown','keydown','scroll','touchstart','click'];
    events.forEach(ev=>window.addEventListener(ev,touch,{passive:true}));
    const timer=window.setInterval(()=>{
      const rule=sessionTimeouts[roleKey];
      if(rule?.enabled && Date.now()-lastActivity>=rule.minutes*60*1000){
        window.localStorage.removeItem('apartcare_session');
        window.alert('Your session has expired due to inactivity. Please log in again.');
        window.location.reload();
      }
    },10000);
    return()=>{events.forEach(ev=>window.removeEventListener(ev,touch));window.clearInterval(timer);};
  },[sessionTimeouts]);

  const [allFlatsReport,setAllFlatsReport]=useState<any|null>(null);
  const [yearlyCollectionReport,setYearlyCollectionReport]=useState<any|null>(null);
  const [yearlyExpense,setYearlyExpense]=useState<any|null>(null);
  const [reportMessage,setReportMessage]=useState('');
  const [individualReportPeriod,setIndividualReportPeriod]=useState<'Monthly'|'Yearly'>('Monthly');
  const [individualReportMonth,setIndividualReportMonth]=useState(month);
  const [individualReportYear,setIndividualReportYear]=useState('2026');
  const [selectedExpenseCategory,setSelectedExpenseCategory]=useState('');
  const [yearlyExpenseDetails,setYearlyExpenseDetails]=useState<any[]>([]);
  const emptyExpense={expense_date:`${expenseMonth}-01`,category:'Other' as ExpenseCategory,description:'',amount:0,payment_mode:'Cash',reference:'',remarks:'',receipt_name:'',receipt_data_url:''};
  const [expenseForm,setExpenseForm]=useState(emptyExpense);


  const loadResidents=async()=>{
    setResidentLoading(true); setResidentMessage('');
    try{
      const response=await propertyFetch(`${API}/api/residents?${apartmentQuery()}`);
      if(!response.ok) throw new Error('Unable to load residents');
      setResidents(await response.json()); setResLoaded(true);
    }catch{
      setResidentMessage('Backend is not reachable. Start FastAPI on port 8000 and try again.');
    }finally{setResidentLoading(false);}
  };

  const openResidents=()=>{setTab('Residents'); if(!resLoaded) loadResidents();};

  const saveResident=async(e:React.FormEvent)=>{
    e.preventDefault(); setResidentMessage('');
    try{
      const response=await fetch(
        editingResidentId?`${API}/api/residents/${editingResidentId}`:`${API}/api/residents?${apartmentQuery()}`,
        {method:editingResidentId?'PUT':'POST',headers:{'Content-Type':'application/json','X-ApartCare-Token':authToken},
         body:JSON.stringify({...residentForm,tenant_id:resolvedApartmentId(),apartment_id:resolvedApartmentId()})}
      );
      if(!response.ok){const d=await response.json().catch(()=>null); throw new Error(d?.detail||'Unable to save resident');}
      setResidentForm(emptyResident); setEditingResidentId(null);
      setResidentMessage(editingResidentId?'Resident updated successfully.':'Resident added successfully.');
      await loadResidents();
    }catch(error){setResidentMessage(error instanceof Error?error.message:'Unable to save resident');}
  };

  const editResident=(r:Resident)=>{
    setEditingResidentId(r.id);
    setResidentForm({flat_no:r.flat_no,owner_name:r.owner_name,resident_name:r.resident_name,
      resident_type:r.resident_type,mobile_no:r.mobile_no,email:r.email,status:r.status,
      remarks:r.remarks});
    window.scrollTo({top:0,behavior:'smooth'});
  };
  const loadResidentHistory=async(id:string)=>{try{const r=await propertyFetch(`${API}/api/residents/${id}/history?${apartmentQuery()}`);if(!r.ok)throw new Error('Unable to load resident history');setResidentHistory(await r.json());setResidentHistoryId(id);}catch(e:any){setResidentMessage(e?.message||'Unable to load resident history.');}};


  const loadUserLanguagePreference=async(userOverride?:AdminUser|null)=>{
    const user=userOverride||currentUser;
    if(!user?.tenant_id)return;
    const fallback=(user.language_preference||'English') as 'English'|'Telugu'|'Hindi'|'Tamil'|'Kannada';
    setActiveLanguage(fallback);
    try{
      const r=await propertyFetch(`${API}/api/admin/me/language`);
      if(!r.ok)return;
      const d=await r.json();
      const lang=(d?.language||fallback) as 'English'|'Telugu'|'Hindi'|'Tamil'|'Kannada';
      setActiveLanguage(['English','Telugu','Hindi','Tamil','Kannada'].includes(lang)?lang:'English');
      setCurrentUser(prev=>prev?{...prev,language_preference:lang}:prev);
    }catch{}
  };

  const saveUserLanguagePreference=async(language:'English'|'Telugu'|'Hindi'|'Tamil'|'Kannada')=>{
    if(!currentUser?.tenant_id)return;
    setLanguageSaving(true); setLanguageMessage('');
    try{
      const r=await propertyFetch(`${API}/api/admin/me/language`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({language})});
      if(!r.ok){const d=await r.json().catch(()=>null);throw new Error(d?.detail||'Unable to save language preference.');}
      const saved=await r.json() as AdminUser;
      setActiveLanguage(language); setCurrentUser(saved);
      try{const stored=JSON.parse(window.localStorage.getItem('apartcare_session')||'null');if(stored){window.localStorage.setItem('apartcare_session',JSON.stringify({...stored,user:saved}));}}catch{}
      setLanguageMessage(`Language preference saved as ${language}.`);
      window.setTimeout(()=>setLanguageMessage(''),2500);
    }catch(error){setLanguageMessage(error instanceof Error?error.message:'Unable to save language preference.');}
    finally{setLanguageSaving(false);}
  };

  const loadSettings=async()=>{
    setSettingsLoading(true);
    try{
      const r=await propertyFetch(`${API}/api/settings/charges?${apartmentQuery()}`);
      if(!r.ok) throw new Error('Unable to load operational settings');
      const data=await r.json() as ChargeSettings;
      const expectedTenant=String(currentUser?.tenant_id||'');
      if(expectedTenant && String(data.tenant_id||data.apartment_id||'')!==expectedTenant){ throw new Error('Tenant context mismatch. Settings from another apartment were rejected. Please log out and sign in again.'); }
      setSettingsForm(data);
      setSettingsEffectiveMonth((data as any).effective_month || new Date().toISOString().slice(0,7));
      try{const hr=await propertyFetch(`${API}/api/settings/charge-history?${apartmentQuery()}`); if(hr.ok) setChargeHistory(await hr.json());}catch{}
      return data;
    }catch(error){
      setSettingsMessage(error instanceof Error?error.message:'Unable to load operational settings.');
      return null;
    }finally{setSettingsLoading(false);}
  };

  const saveSettings=async(e:React.FormEvent)=>{
    e.preventDefault(); setSettingsMessage(''); setSettingsLoading(true);
    try{
      const token=getSessionToken();
      if(!token){setSettingsMessage('Login session is required. Please log in again.');return;}
      const r=await fetch(`${API}/api/settings/charges?${apartmentQuery()}&effective_month=${encodeURIComponent(settingsEffectiveMonth)}`,{
        method:'PUT',headers:{'Content-Type':'application/json','X-ApartCare-Token':token},
        body:JSON.stringify(settingsForm)
      });
      if(!r.ok){const d=await r.json().catch(()=>null);throw new Error(d?.detail||'Unable to save settings');}
      const saved=await r.json() as ChargeSettings;
      setSettingsForm(saved);
      const hr=await propertyFetch(`${API}/api/settings/charge-history?${apartmentQuery()}`); if(hr.ok) setChargeHistory(await hr.json());
      setSettingsMessage(`Operational settings saved for ${formatMonthKey(settingsEffectiveMonth)}. Historical months remain unchanged.`);
    }catch(error){setSettingsMessage(error instanceof Error?error.message:'Unable to save settings.');}
    finally{setSettingsLoading(false);}
  };

  const loadWatchmen=async()=>{
    const token=getSessionToken();
    const headers: HeadersInit = token ? {'X-ApartCare-Token': token} : {};
    const [rows,hist]=await Promise.all([fetch(`${API}/api/settings/watchmen?${apartmentQuery()}`,{headers}),fetch(`${API}/api/settings/watchmen/history?${apartmentQuery()}`,{headers})]);
    if(rows.ok) setWatchmen(await rows.json());
    if(hist.ok) setWatchmanHistory(await hist.json());
  };
  const loadOpeningBalance=async()=>{
    const token=await getValidatedPropertyToken();
    if(!token){setSettingsMessage('Login session is required. Please log in again.');return;}
    const headers={'X-ApartCare-Token':token};
    const [row,hist]=await Promise.all([
      fetch(`${API}/api/settings/opening-balance?${apartmentQuery()}`,{headers}),
      fetch(`${API}/api/settings/opening-balance/history?${apartmentQuery()}`,{headers})
    ]);
    if(row.status===401 || hist.status===401){handleSessionExpired('Your login session has expired. Please log in again.');return;}
    if(row.ok){const data=await row.json(); setOpeningBalance(data); if(data) setOpeningForm({go_live_month:data.go_live_month,opening_balance:data.opening_balance,locked:data.locked});}
    if(hist.ok){const history=await hist.json(); setOpeningHistory(history); const locked=[...history].filter((h:any)=>h.action==='Locked'); setTenantDataStartMonth(locked.length?locked[locked.length-1].go_live_month:'');}
  };
  const loadUtilityContacts=async()=>{
    try{
      const token=await getValidatedPropertyToken();
      if(!token){setUtilityEditReady(false);throw new Error('Login session is required. Please log in again.');}
      setUtilityEditReady(Boolean(currentUser || token));
      const [cr,rr]=await Promise.all([
        fetch(`${API}/api/utilities/categories`,{headers:{'X-ApartCare-Token':token}}),
        fetch(`${API}/api/utilities/contacts`,{headers:{'X-ApartCare-Token':token}})
      ]);
      const cd=await cr.json().catch(()=>[]); const rd=await rr.json().catch(()=>[]);
      if(cr.status===401 || rr.status===401){handleSessionExpired('Your login session has expired. Please log in again.');return;}
      if(!cr.ok) throw new Error(cd?.detail||'Unable to load utility categories.');
      if(!rr.ok) throw new Error(rd?.detail||'Unable to load utility contacts.');
      setUtilityCategories(cd); setUtilityContacts(rd); await loadWatchmen();
      if(!utilityForm.category && cd?.length) setUtilityForm({...utilityForm,category:cd.find((x:any)=>x.active)?.name||cd[0].name});
    }catch(e:any){setUtilityEditReady(false);setUtilityCategories([]);setUtilityContacts([]);setUtilityMessage(e?.message||'Unable to load utility data.');}
  };
  const saveUtilityCategory=async()=>{
    const token=await getValidatedPropertyToken();
    if(!token){setUtilityMessage('Login session is required. Please log in again.');return;}
    const name=utilityCategoryName.trim();
    if(name.length<2){setUtilityMessage('Category name must contain at least 2 characters.');return;}
    const url=editingUtilityCategoryId?`${API}/api/utilities/categories/${editingUtilityCategoryId}`:`${API}/api/utilities/categories`;
    const method=editingUtilityCategoryId?'PUT':'POST';
    try{
      const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-ApartCare-Token':token},body:JSON.stringify({tenant_id:resolvedApartmentId(),apartment_id:resolvedApartmentId(),name})});
      const d=await r.json().catch(()=>null); if(r.status===401){handleSessionExpired('Your login session has expired. Please log in again.');return;} if(!r.ok) throw new Error(d?.detail||'Unable to save utility category.');
      setUtilityCategoryName('');setEditingUtilityCategoryId(null);setUtilityCategoryEditorOpen(false);setUtilityMessage(editingUtilityCategoryId?'Utility category updated successfully.':'Utility category added successfully.');await loadUtilityContacts();
    }catch(e:any){setUtilityMessage(e?.message||'Unable to save utility category.');}
  };
  const deactivateUtilityCategory=async(id:string)=>{
    const token=await getValidatedPropertyToken(); if(!token){setUtilityMessage('Login session is required. Please log in again.');return;}
    if(!window.confirm('Deactivate this utility category? Existing historical contacts will remain.'))return;
    try{const r=await fetch(`${API}/api/utilities/categories/${id}/deactivate`,{method:'POST',headers:{'X-ApartCare-Token':token}});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.detail||'Unable to deactivate category.');setUtilityMessage('Utility category deactivated.');await loadUtilityContacts();}catch(e:any){setUtilityMessage(e?.message||'Unable to deactivate category.');}
  };
  const saveUtilityContact=async(e:React.FormEvent)=>{
    e.preventDefault();setUtilityMessage('');
    const token=await getValidatedPropertyToken();
    if(!token){setUtilityMessage('Login session is required. Please log in again.');return;}
    if(!utilityForm.category){setUtilityMessage('Select a category.');return;}
    if(!utilityForm.name.trim()||!utilityForm.mobile_no.trim()){setUtilityMessage('Name and Mobile Number are required.');return;}
    const url=editingUtilityId?`${API}/api/utilities/contacts/${editingUtilityId}`:`${API}/api/utilities/contacts`;
    const method=editingUtilityId?'PUT':'POST';
    try{
      const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-ApartCare-Token':token},body:JSON.stringify({tenant_id:resolvedApartmentId(),apartment_id:resolvedApartmentId(),category:utilityForm.category,name:utilityForm.name.trim(),mobile_no:utilityForm.mobile_no.trim(),remarks:utilityForm.remarks.trim()})});
      const d=await r.json().catch(()=>null); if(r.status===401){handleSessionExpired('Your login session has expired. Please log in again.');return;} if(!r.ok)throw new Error(d?.detail||'Unable to save utility contact.');
      setEditingUtilityId(null);setUtilityForm({category:utilityCategories.find(x=>x.active)?.name||'Plumber',name:'',mobile_no:'',remarks:''});
      setUtilityMessage(editingUtilityId?'Utility contact updated successfully.':'Utility contact added successfully.');await loadUtilityContacts();
    }catch(e:any){setUtilityMessage(e?.message||'Unable to save utility contact.');}
  };
  const editUtilityContact=(x:UtilityContact)=>{setEditingUtilityId(x.id);setUtilityForm({category:x.category,name:x.name,mobile_no:x.mobile_no,remarks:x.remarks});setUtilityMessage('Editing selected utility contact.');};
  const deleteUtilityContact=async(id:string)=>{const token=await getValidatedPropertyToken();if(!token){setUtilityMessage('Login session is required. Please log in again.');return;}if(!window.confirm('Delete this utility contact? History will be retained.'))return;try{const r=await fetch(`${API}/api/utilities/contacts/${id}`,{method:'DELETE',headers:{'X-ApartCare-Token':token}});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.detail||'Unable to delete utility contact.');setUtilityMessage(d?.message||'Utility contact deleted.');await loadUtilityContacts();}catch(e:any){setUtilityMessage(e?.message||'Unable to delete utility contact.');}};
  const openJustificationDialog=(cfg:Partial<typeof justificationDialog> & {title:string;description:string;action:string;targetId?:string;locked?:boolean;context?:string;minLength?:number})=>setJustificationDialog({open:true,title:cfg.title,description:cfg.description,action:cfg.action,targetId:cfg.targetId,locked:cfg.locked,context:cfg.context,value:'',minLength:cfg.minLength||3});
  const closeJustificationDialog=()=>setJustificationDialog(x=>({...x,open:false,value:''}));
  const confirmJustificationDialog=async()=>{
    const reason=justificationDialog.value.trim();
    if(reason.length<justificationDialog.minLength){setSettingsMessage(`Justification is mandatory (minimum ${justificationDialog.minLength} characters).`);setPaymentMessage(`Justification is mandatory (minimum ${justificationDialog.minLength} characters).`);setExpenseMessage(`Justification is mandatory (minimum ${justificationDialog.minLength} characters).`);return;}
    const action=justificationDialog.action, target=justificationDialog.targetId||'';
    try{
      if(action==='watchman'){
        const token=getSessionToken(); if(!token) throw new Error('Login session is required. Please log in again.');
        const r=await fetch(`${API}/api/settings/watchmen/${target}/lock?locked=${justificationDialog.locked}&reason=${encodeURIComponent(reason)}`,{method:'POST',headers:{'X-ApartCare-Token':token}});
        const d=await r.json().catch(()=>null); if(!r.ok) throw new Error(d?.detail||'Unable to change Watchman lock status.');
        setSettingsMessage(justificationDialog.locked?'Watchman record locked. Justification recorded in history.':'Watchman record unlocked. Justification recorded in history.'); await loadWatchmen();
      } else if(action==='payment'){
        const token=await getValidatedPropertyToken(); if(!token) throw new Error('Login session is required. Please log in again.');
        const endpoint=justificationDialog.locked?'lock':'unlock';
        const r=await fetch(`${API}/api/payments/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json','X-ApartCare-Token':token},body:JSON.stringify({tenant_id:resolvedApartmentId(),apartment_id:resolvedApartmentId(),month_key:paymentMonth,justification:reason})});
        const d=await r.json().catch(()=>null); if(!r.ok) throw new Error(d?.detail||`Unable to ${endpoint} payment month.`);
        setPaymentMonthLocked(Boolean(justificationDialog.locked));setPaymentLock(d);setPaymentMessage(`${paymentMonth} ${justificationDialog.locked?'locked':'unlocked'}. Justification recorded in audit history.`);await loadPaymentLock();
      } else if(action==='expense'){
        const r=await fetch(`${API}/api/expenses/${target}/lock?locked=${justificationDialog.locked}&reason=${encodeURIComponent(reason)}`,{method:'POST',headers:{'X-ApartCare-Token':authToken}});
        const d=await r.json().catch(()=>null); if(!r.ok) throw new Error(d?.detail||'Unable to change expense lock status.');
        setExpenseMessage(justificationDialog.locked?'Expense locked successfully. Justification recorded in history.':'Expense unlocked successfully. Justification recorded in history.');await loadExpenses();await loadYearlyExpenses(expenseYear);await loadDashboardKpis();
      } else if(action==='opening-lock'){
        const token=await getValidatedPropertyToken(); if(!token) throw new Error('Login session is required. Please log in again.');
        const r=await fetch(`${API}/api/settings/opening-balance/lock?${apartmentQuery()}`,{method:'POST',headers:{'Content-Type':'application/json','X-ApartCare-Token':token},body:JSON.stringify({justification:reason})});
        const d=await r.json().catch(()=>null); if(!r.ok) throw new Error(d?.detail||'Unable to lock Go-Live Opening Balance.');
        setOpeningEditMode(false);setSettingsMessage('Go-Live Opening Balance locked. Justification recorded in Version History.');await loadOpeningBalance();await loadDashboardKpis();
      } else if(action==='admin-user'){
        const r=await fetch(`${API}/api/admin/users/${target}`,{method:'PUT',headers:{'Content-Type':'application/json','X-ApartCare-Token':authToken},body:JSON.stringify({locked:justificationDialog.locked,reason})});
        const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.detail||'Unable to change user lock status.');setAdminMessage(`${d.username} ${justificationDialog.locked?'locked':'unlocked'}. Justification recorded in history.`);await loadAdmin();
      } else if(action==='platform-account'){
        const endpoint=justificationDialog.locked?'lock':'unlock';
        const r=await fetch(`${API}/api/platform/accounts/${encodeURIComponent(target)}/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json','X-Auth-Token':platformToken},body:JSON.stringify({reason})});
        const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.detail||`Unable to ${endpoint} account.`);setPlatformMessage(`Account ${d.account_id} ${justificationDialog.locked?'locked':'unlocked'}. Justification recorded in history.`);await loadPlatformAccounts(platformToken);if(platformHistoryTenantId===target)await loadPlatformValidityHistory(platformToken,target);
      }
      closeJustificationDialog();
    }catch(err:any){setSettingsMessage(err?.message||'Unable to complete lock action.');setPaymentMessage(err?.message||'Unable to complete lock action.');setExpenseMessage(err?.message||'Unable to complete lock action.');setAdminMessage(err?.message||'Unable to complete lock action.');setPlatformMessage(err?.message||'Unable to complete lock action.');}
  };

  const utilityWatchman=watchmen.find(w=>!w.deleted && (!w.end_date || w.end_date>=new Date().toISOString().slice(0,10))) || watchmen.find(w=>!w.deleted);

  const saveWatchman=async(e:React.FormEvent)=>{
    e.preventDefault(); setSettingsMessage('');
    const token=getSessionToken();
    if(!token){setSettingsMessage('Login session is required. Please log in again.');return;}
    const url=editingWatchmanId?`${API}/api/settings/watchmen/${editingWatchmanId}`:`${API}/api/settings/watchmen?${apartmentQuery()}`;
    const method=editingWatchmanId?'PUT':'POST';
    try{
      const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-ApartCare-Token':token},body:JSON.stringify({...watchmanForm,tenant_id:resolvedApartmentId(),apartment_id:resolvedApartmentId(),end_date:watchmanForm.end_date||null})});
      const d=await r.json().catch(()=>null);
      if(!r.ok){setSettingsMessage(d?.detail||`Unable to save Watchman (HTTP ${r.status}).`);return;}
      setSettingsMessage(editingWatchmanId?'Watchman details updated and history maintained.':'Watchman details saved and history maintained.');
      setEditingWatchmanId(null); setWatchmanForm({name:'',mobile_no:'',start_date:new Date().toISOString().slice(0,10),end_date:'',salary:0,locked:false,remarks:''});
      await loadWatchmen();
    }catch(error){setSettingsMessage(error instanceof Error?error.message:'Unable to save Watchman.');}
  };
  const editWatchman=(w:Watchman)=>{setEditingWatchmanId(w.id);setWatchmanForm({name:w.name,mobile_no:w.mobile_no,start_date:w.start_date,end_date:w.end_date||'',salary:w.salary,locked:w.locked,remarks:w.remarks});};
  const toggleWatchmanLock=async(id:string,locked:boolean)=>{if(!currentUser||currentUser.role!=='Admin'){setSettingsMessage('Only an Admin can lock or unlock Watchman records.');return;}openJustificationDialog({title:locked?'Lock Watchman Record':'Unlock Watchman Record',description:locked?'Locking freezes this Watchman version. The justification will be retained in Watchman History.':'Unlocking permits controlled correction. The justification will be retained in Watchman History.',action:'watchman',targetId:id,locked,minLength:3});};
  const deleteWatchman=async(id:string)=>{if(!window.confirm('Soft delete this Watchman record? History will be retained.'))return;const token=getSessionToken();if(!token){setSettingsMessage('Login session is required. Please log in again.');return;}const r=await fetch(`${API}/api/settings/watchmen/${id}`,{method:'DELETE',headers:{'X-ApartCare-Token':token}});if(!r.ok){const d=await r.json().catch(()=>null);setSettingsMessage(d?.detail||'Unable to delete Watchman.');return;}await loadWatchmen();};
  const saveOpening=async(e:React.FormEvent)=>{e.preventDefault();if(currentUser?.role!=='Admin'){setSettingsMessage('Only an Admin can change the Go-Live Opening Balance.');return;}const token=await getValidatedPropertyToken();if(!token){setSettingsMessage('Login session is required. Please log in again.');return;}const payload={...openingForm,tenant_id:resolvedApartmentId(),apartment_id:resolvedApartmentId(),opening_balance:Number(openingForm.opening_balance||0)};const r=await fetch(`${API}/api/settings/opening-balance?${apartmentQuery()}`,{method:'POST',headers:{'Content-Type':'application/json','X-ApartCare-Token':token},body:JSON.stringify(payload)});const d=await r.json().catch(()=>null);if(!r.ok){setSettingsMessage(d?.detail||'Unable to save Go-Live Opening Balance.');return;}setOpeningEditMode(false);setSettingsMessage('Go-Live Opening Balance saved. A new version was recorded in history. Lock it again to make this the active calculation baseline.');await loadOpeningBalance();await loadDashboardKpis();};
  const lockOpening=async()=>{if(currentUser?.role!=='Admin'){setSettingsMessage('Only an Admin can lock the Go-Live Opening Balance.');return;}openJustificationDialog({title:'Lock Go-Live Opening Balance',description:'This makes the current Go-Live Month + Opening Balance the active financial baseline. The justification will be retained in Version History.',action:'opening-lock',locked:true,minLength:5});};
  const unlockOpening=async()=>{if(!currentUser || currentUser.role!=='Admin'){setSettingsMessage('Only an Admin can unlock the Go-Live Opening Balance.');return;}setUnlockJustification('');setShowUnlockDialog(true);};
  const confirmUnlockOpening=async()=>{const reason=unlockJustification.trim();if(reason.length<5){setSettingsMessage('Unlock justification is mandatory (minimum 5 characters).');return;}const token=await getValidatedPropertyToken();if(!token){setSettingsMessage('Login session is required. Please log in again.');return;}const r=await fetch(`${API}/api/settings/opening-balance/unlock?${apartmentQuery()}`,{method:'POST',headers:{'Content-Type':'application/json','X-ApartCare-Token':token},body:JSON.stringify({justification:reason})});const d=await r.json().catch(()=>null);if(!r.ok){setSettingsMessage(d?.detail||'Unable to unlock Go-Live Opening Balance.');return;}setShowUnlockDialog(false);setOpeningEditMode(true);setSettingsMessage('Admin Unlock enabled. Justification recorded in Version History. The previous locked version remains the active baseline until the new version is saved and locked.');await loadOpeningBalance();};
  const loadReportFlats=async()=>{
    setReportMessage('');
    try{
      const r=await propertyFetch(`${API}/api/reports/flats?${apartmentQuery()}`);
      if(!r.ok) throw new Error('Unable to load flats for Reports.');
      const rows=await r.json();
      setReportFlats(rows);
      const selected=reportFlat||rows[0]||'';
      setReportFlat(selected);
      if(selected){ await Promise.all([loadFlatStatement(selected),loadIndividualMaintenance(selected)]); }
      else setReportMessage('No flats with resident or financial history are available.');
    }catch(error){setReportMessage(error instanceof Error?error.message:'Unable to load report.');}
  };
  const loadFlatStatement=async(flat:string)=>{
    if(!flat){setFlatStatement(null);return;}
    const r=await propertyFetch(`${API}/api/reports/flat-statement?${apartmentQuery()}&flat_no=${encodeURIComponent(flat)}`);
    if(r.ok) setFlatStatement(await r.json()); else setReportMessage('Unable to load the flat statement.');
  };
  const loadIndividualMaintenance=async(flat:string)=>{
    if(!flat){setIndividualMaintenance([]);return;}
    try{
      // Maintenance is the source for charge breakup. Payment rows are fetched month-by-month
      // from the same Payments API used by the Payments module, so the Individual Flat Report
      // cannot show a stale or independently calculated payment status.
      const r=await propertyFetch(`${API}/api/reports/individual-maintenance?${apartmentQuery()}&flat_no=${encodeURIComponent(flat)}`);
      if(!r.ok) throw new Error('Unable to load individual flat maintenance.');
      const maintenanceRows:any[]=await r.json();
      const months=[...new Set(maintenanceRows.map((x:any)=>String(x.month_key||'')).filter(Boolean))];
      const paymentPairs=await Promise.all(months.map(async(month_key)=>{
        try{
          const pr=await propertyFetch(`${API}/api/payments?${apartmentQuery()}&month_key=${encodeURIComponent(month_key)}`);
          if(!pr.ok) return [month_key,null] as const;
          const rows:any[]=await pr.json();
          const payment=rows.find((x:any)=>String(x.flat_no)===String(flat))||null;
          return [month_key,payment] as const;
        }catch{return [month_key,null] as const;}
      }));
      const paymentByMonth=new Map(paymentPairs);
      setIndividualMaintenance(maintenanceRows.map((row:any)=>({...row,__payment:paymentByMonth.get(String(row.month_key||''))||null})) as any);
    }catch(error){setReportMessage(error instanceof Error?error.message:'Unable to load individual flat maintenance.');}
  };
  const loadYearlyMaintenance=async(y:string)=>{const r=await propertyFetch(`${API}/api/reports/yearly-maintenance?${apartmentQuery()}&year=${encodeURIComponent(y)}`);if(r.ok)setYearlyMaintenance(await r.json());};
  const loadAllFlatsReport=async(m:string)=>{
    try{
      const [reportRes,paymentRes,residentRes,waterRes,kpiRes]=await Promise.all([
        propertyFetch(`${API}/api/reports/all-flats-monthly?${apartmentQuery()}&month_key=${encodeURIComponent(m)}`),
        propertyFetch(`${API}/api/payments?${apartmentQuery()}&month_key=${encodeURIComponent(m)}`),
        propertyFetch(`${API}/api/residents?${apartmentQuery()}`),
        propertyFetch(`${API}/api/maintenance/water-header?${apartmentQuery()}&month_key=${encodeURIComponent(m)}`),
        propertyFetch(`${API}/api/dashboard/kpis?${apartmentQuery()}&period=Monthly&month_key=${encodeURIComponent(m)}`)
      ]);
      if(!reportRes.ok) return;
      const report=await reportRes.json();
      const paymentRows:Payment[]=paymentRes.ok?await paymentRes.json():[];
      const residentRows:Resident[]=residentRes.ok?await residentRes.json():[];
      const paymentByFlat=new Map(paymentRows.map(x=>[String(x.flat_no),x]));
      const residentByFlat=new Map(residentRows.map(x=>[String(x.flat_no),x]));
      const rows=(report.rows||[]).map((r:MaintenanceRow)=>{
        const pay=paymentByFlat.get(String(r.flat_no));
        const resident=residentByFlat.get(String(r.flat_no));
        const due=Number(pay?.amount_due ?? r.rounded_total ?? 0);
        const paid=Number(pay?.paid_amount ?? 0);
        const pending=Math.max(0,Number(pay?.pending_balance ?? due-paid));
        return {...r,mobile_no:resident?.mobile_no||'',display_name:r.resident_name||r.owner_name||resident?.resident_name||resident?.owner_name||'',paid,pending};
      });
      const totals={
        ...(report.totals||{}),
        paid:rows.reduce((a:number,r:any)=>a+Number(r.paid||0),0),
        pending:rows.reduce((a:number,r:any)=>a+Number(r.pending||0),0),
        water:rows.reduce((a:number,r:any)=>a+Number(r.water_amount||0),0),
        total:rows.reduce((a:number,r:any)=>a+Number(r.rounded_total||0),0),
        maintenance:rows.reduce((a:number,r:any)=>a+Number(r.maintenance||0),0),
        cca:rows.reduce((a:number,r:any)=>a+Number(r.cca||0),0),
        water_units:rows.reduce((a:number,r:any)=>a+Number(r.water_units||0),0)
      };
      setAllFlatsReport({...report,rows,totals,water_header:waterRes.ok?await waterRes.json():null,kpis:kpiRes.ok?await kpiRes.json():null});
    }catch{ setReportMessage('Unable to load the All Flats Monthly Report.'); }
  };
  const loadYearlyCollectionReport=async(y:string)=>{const r=await propertyFetch(`${API}/api/reports/yearly-collection-expenses?${apartmentQuery()}&year=${encodeURIComponent(y)}`);if(r.ok)setYearlyCollectionReport(await r.json());};

  const applySettingsToNewMonth=async(targetMonth=month)=>{
    try{
      const r=await propertyFetch(`${API}/api/settings/charges/effective?${apartmentQuery()}&month_key=${encodeURIComponent(targetMonth)}`);
      if(!r.ok) throw new Error('Unable to load effective monthly defaults');
      const d=await r.json();
      setChargeForm(form=>({...form,maintenance:Number(d.common_maintenance||0),cca:Number(d.cca||0),diesel:0}));
    }catch{
      const s=await loadSettings();
      if(s) setChargeForm(form=>({...form,maintenance:Number(s.common_maintenance||0),cca:Number(s.cca||0),diesel:0}));
    }
  };

  const loadGlobalMonthLock=async(m:string,setter:(v:boolean)=>void)=>{
    try{const r=await propertyFetch(`${API}/api/payments/lock-status?${apartmentQuery()}&month_key=${encodeURIComponent(m)}`); if(r.ok){const d=await r.json();setter(Boolean(d.locked));}else setter(false);}catch{setter(false);}
  };

  const loadMaintenance=async(showMessage=true)=>{
    setMaintenanceLoading(true); if(showMessage) setMaintenanceMessage('');
    try{
      const [rowsRes,summaryRes,headerRes]=await Promise.all([
        propertyFetch(`${API}/api/maintenance?${apartmentQuery()}&month_key=${month}`),
        propertyFetch(`${API}/api/maintenance/summary?${apartmentQuery()}&month_key=${month}`),
        propertyFetch(`${API}/api/maintenance/water-header?${apartmentQuery()}&month_key=${month}`)
      ]);
      if(!rowsRes.ok) throw new Error('Unable to load maintenance');
      const rows=await rowsRes.json();
      setMaintenanceRows(rows); setMaintenanceLoaded(true);
      if(summaryRes.ok) setSummary(await summaryRes.json());
      if(headerRes.ok) {
        const h=await headerRes.json();
        setWaterHeader(h);
        if(h) setChargeForm({
          maintenance: rows[0]?.maintenance ?? chargeForm.maintenance,
          cca: rows[0]?.cca ?? chargeForm.cca,
          diesel: rows[0]?.diesel ?? chargeForm.diesel,
          other_charges: rows[0]?.other_charges ?? chargeForm.other_charges,
          include_maintenance:h.include_maintenance ?? true, include_cca:h.include_cca ?? true, include_diesel:h.include_diesel ?? true, include_municipal_water:h.include_municipal_water ?? true,
          water_mode:h.water_mode, tanker_count:h.tanker_count ?? 0, tanker_price:h.tanker_price ?? 0, tanker_amount:h.tanker_amount, municipal_bill:h.municipal_bill
        });
      }
    }catch(error){
      setMaintenanceMessage(error instanceof Error?error.message:'Unable to load maintenance.');
    }finally{setMaintenanceLoading(false);}
  };

  const openMaintenance=()=>{setTab('Monthly Maintenance'); setMaintenanceLoaded(false); loadMaintenance(false); loadGlobalMonthLock(month,setMaintenanceMonthLocked); applySettingsToNewMonth();};

  useEffect(()=>{
    if(tab==='Monthly Maintenance'){ loadMaintenance(false); loadGlobalMonthLock(month,setMaintenanceMonthLocked); applySettingsToNewMonth(month); }
  },[month]);

  const generateMaintenance=async()=>{
    setMaintenanceMessage('');
    setMaintenanceLoading(true);
    try{
      const response=await fetch(`${API}/api/maintenance/generate`,{
        method:'POST',headers:{'Content-Type':'application/json','X-ApartCare-Token':authToken},
        body:JSON.stringify({tenant_id:resolvedApartmentId(),apartment_id:resolvedApartmentId(),month_key:month,...chargeForm})
      });
      if(!response.ok){const d=await response.json().catch(()=>null);throw new Error(d?.detail||'Unable to generate maintenance');}
      setMaintenanceMessage(`Monthly maintenance generated successfully for ${month}.`);
      await loadMaintenance(false);
    }catch(error){setMaintenanceMessage(error instanceof Error?error.message:'Unable to generate maintenance.');}
    finally{setMaintenanceLoading(false);}
  };

  const updateWaterHeader=async()=>{
    if(!waterHeader) return;
    setMaintenanceLoading(true); setMaintenanceMessage('');
    try{
      const response=await fetch(`${API}/api/maintenance/water-header/${month}`,{
        method:'PUT',headers:{'Content-Type':'application/json','X-ApartCare-Token':authToken},
        body:JSON.stringify({tenant_id:resolvedApartmentId(),apartment_id:resolvedApartmentId(),month_key:month,...chargeForm})
      });
      if(!response.ok){const d=await response.json().catch(()=>null);throw new Error(d?.detail||'Unable to update water header');}
      setMaintenanceMessage('Monthly water setup updated and all water amounts recalculated.');
      await loadMaintenance(false);
    }catch(error){setMaintenanceMessage(error instanceof Error?error.message:'Unable to update water setup.');}
    finally{setMaintenanceLoading(false);}
  };

  const updateRow=async(row:MaintenanceRow)=>{
    setMaintenanceLoading(true); setMaintenanceMessage('');
    try{
      const response=await fetch(`${API}/api/maintenance/${row.id}`,{
        method:'PUT',headers:{'Content-Type':'application/json','X-ApartCare-Token':authToken},
        body:JSON.stringify({
          maintenance:row.maintenance,cca:row.cca,diesel:row.diesel,
          other_charges:row.other_charges,current_reading:row.current_reading,
          remarks:row.remarks
        })
      });
      if(!response.ok){const d=await response.json().catch(()=>null);throw new Error(d?.detail||'Unable to save flat');}
      setMaintenanceMessage(`Flat ${row.flat_no} saved. Water and totals recalculated.`);
      await loadMaintenance(false);
    }catch(error){setMaintenanceMessage(error instanceof Error?error.message:'Unable to save flat.');}
    finally{setMaintenanceLoading(false);}
  };

  const setRowField=(id:string,key:keyof MaintenanceRow,value:string)=>{
    setMaintenanceRows(rows=>rows.map(r=>r.id===id?{...r,[key]:['maintenance','cca','diesel','other_charges','current_reading'].includes(key)?Number(value):value}:r));
  };


  const resetExpenseForm=()=>{
    setExpenseForm({expense_date:`${expenseMonth}-01`,category:'Other',description:'',amount:0,payment_mode:'Cash',reference:'',remarks:'',receipt_name:'',receipt_data_url:''});
    setEditingExpenseId(null);
  };

  const loadYearlyExpenses=async(y:string)=>{
    try{
      const r=await propertyFetch(`${API}/api/expenses/yearly-summary?${apartmentQuery()}&year=${encodeURIComponent(y)}`);
      if(!r.ok) throw new Error('Unable to load yearly expense report');
      setYearlyExpense(await r.json());
    }catch(error){ setExpenseMessage(error instanceof Error?error.message:'Unable to load yearly expense report.'); }
  };

  const loadYearlyExpenseDetails=async(y:string, category:string)=>{
    try{
      const url=`${API}/api/expenses/yearly-details?${apartmentQuery()}&year=${encodeURIComponent(y)}${category?`&category=${encodeURIComponent(category)}`:''}`;
      const r=await propertyFetch(url);
      if(!r.ok) throw new Error('Unable to load category expenses');
      setYearlyExpenseDetails(await r.json());
    }catch(error){ setExpenseMessage(error instanceof Error?error.message:'Unable to load category expenses.'); }
  };

  const loadExpenses=async(showMessage=false, targetMonth=expenseMonth)=>{
    loadGlobalMonthLock(targetMonth,setExpenseMonthLocked);
    setExpenseLoading(true);
    try{
      const [rowsRes,summaryRes,paymentRes]=await Promise.all([
        propertyFetch(`${API}/api/expenses?${apartmentQuery()}&month_key=${encodeURIComponent(targetMonth)}`),
        propertyFetch(`${API}/api/expenses/summary?${apartmentQuery()}&month_key=${encodeURIComponent(targetMonth)}`),
        propertyFetch(`${API}/api/payments/summary?${apartmentQuery()}&month_key=${encodeURIComponent(targetMonth)}`)
      ]);
      if(!rowsRes.ok || !summaryRes.ok) throw new Error('Unable to load expenses');
      setExpenses(await rowsRes.json());
      setExpenseSummary(await summaryRes.json());
      if(paymentRes.ok) setExpensePaymentSummary(await paymentRes.json()); else setExpensePaymentSummary(null);
      const historyRes=await propertyFetch(`${API}/api/expenses/history?${apartmentQuery()}&month_key=${encodeURIComponent(targetMonth)}`);
      if(historyRes.ok) setExpenseHistory(await historyRes.json());
      const lockHistoryRes=await propertyFetch(`${API}/api/expenses/lock-history?${apartmentQuery()}&month_key=${encodeURIComponent(targetMonth)}`);
      if(lockHistoryRes.ok) setExpenseLockHistory(await lockHistoryRes.json());
      if(showMessage) setExpenseMessage('Expenses refreshed successfully.');
    }catch(error){
      setExpenseMessage(error instanceof Error?error.message:'Unable to load expenses.');
    }finally{setExpenseLoading(false);}
  };

  const saveExpense=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(Number(expenseForm.amount)<=0){setExpenseMessage('Enter an expense amount greater than ₹0.');return;}
    setExpenseLoading(true); setExpenseMessage('');
    try{
      const url=editingExpenseId?`${API}/api/expenses/${editingExpenseId}`:`${API}/api/expenses`;
      const method=editingExpenseId?'PUT':'POST';
      const expenseMonthKey=String(expenseForm.expense_date||'').slice(0,7);
      if(!/^\d{4}-\d{2}$/.test(expenseMonthKey)){setExpenseMessage('Select a valid expense date.');return;}
      const token=authToken||(()=>{try{return JSON.parse(window.localStorage.getItem('apartcare_session')||'null')?.token||'';}catch{return '';}})();
      if(!token){setExpenseMessage('Login session is required. Please log in again.');return;}
      const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-ApartCare-Token':token},
        body:JSON.stringify({...expenseForm,amount:Number(expenseForm.amount),month_key:expenseMonthKey,tenant_id:resolvedApartmentId(),apartment_id:resolvedApartmentId()})});
      if(!r.ok){const d=await r.json().catch(()=>null);throw new Error(d?.detail||'Unable to save expense');}
      setExpenseMessage(editingExpenseId?'Expense updated successfully.':'Expense saved successfully.');
      const savedMonth=String(expenseForm.expense_date).slice(0,7);
      if(savedMonth && savedMonth!==expenseMonth) setExpenseMonth(savedMonth);
      setEditingExpenseId(null);
      setExpenseForm({expense_date:`${savedMonth || expenseMonth}-01`,category:'Other',description:'',amount:0,payment_mode:'Cash',reference:'',remarks:'',receipt_name:'',receipt_data_url:''});
      await loadExpenses(false,savedMonth || expenseMonth);
      await loadYearlyExpenses(expenseYear);
      await loadDashboardKpis();
    }catch(error){setExpenseMessage(error instanceof Error?error.message:'Unable to save expense.');}
    finally{setExpenseLoading(false);}
  };

  const editExpense=(x:Expense)=>{
    setEditingExpenseId(x.id);
    setExpenseForm({expense_date:x.expense_date,category:x.category,description:x.description,amount:x.amount,payment_mode:x.payment_mode,reference:x.reference,remarks:x.remarks,receipt_name:'',receipt_data_url:''});
    window.scrollTo({top:0,behavior:'smooth'});
  };

  const deleteExpense=async(id:string)=>{
    const reason=window.prompt('Enter mandatory justification for deleting this expense:')||'';
    if(reason.trim().length<5){setExpenseMessage('Delete justification is mandatory (minimum 5 characters).');return;}
    const token=getSessionToken();
    if(!token){setExpenseMessage('Login session is required. Please log in again.');return;}
    setExpenseLoading(true);
    try{
      const r=await fetch(`${API}/api/expenses/${id}?reason=${encodeURIComponent(reason.trim())}`,{method:'DELETE',headers:{'X-ApartCare-Token':token}});
      const d=await r.json().catch(()=>null);
      if(!r.ok) throw new Error(d?.detail||`Unable to soft delete expense (HTTP ${r.status}).`);
      setExpenses(prev=>prev.map(x=>x.id===id?{...x,deleted:true,deleted_at:d?.deleted_at||new Date().toISOString(),deleted_reason:reason.trim()}:x));
      const deleted=expenses.find(x=>x.id===id);
      if(deleted) setExpenseHistory(prev=>[{id:d?.history_id||`local-${id}`,expense_id:id,apartment_id:deleted.apartment_id,month_key:deleted.month_key,expense_date:deleted.expense_date,category:deleted.category,description:deleted.description,amount:deleted.amount,payment_mode:deleted.payment_mode,reference:deleted.reference,remarks:deleted.remarks,source:deleted.source,deleted_at:d?.deleted_at||new Date().toISOString(),justification:reason.trim(),deleted_by_username:currentUser?.username||'Admin'},...prev.filter((h:any)=>h.expense_id!==id)]);
      setExpenseMessage('Expense soft deleted successfully. It is excluded from all financial calculations and retained in Deletion History.');
      await loadExpenses(false,expenseMonth); await loadYearlyExpenses(expenseYear); await loadDashboardKpis();
    }catch(error){setExpenseMessage(error instanceof Error?error.message:'Unable to soft delete expense.');}
    finally{setExpenseLoading(false);}
  };


  const loadPaymentLock=async()=>{
    try{
      const [statusRes,historyRes]=await Promise.all([
        propertyFetch(`${API}/api/payments/lock-status?${apartmentQuery()}&month_key=${encodeURIComponent(paymentMonth)}`),
        propertyFetch(`${API}/api/payments/lock-history?${apartmentQuery()}&month_key=${encodeURIComponent(paymentMonth)}`)
      ]);
      if(statusRes.ok){const d=await statusRes.json();setPaymentMonthLocked(Boolean(d.locked));setPaymentLock(d.lock||null);}
      if(historyRes.ok)setPaymentLockHistory(await historyRes.json());
    }catch{setPaymentMonthLocked(false);setPaymentLock(null);setPaymentLockHistory([]);}
  };
  const lockPaymentMonth=async()=>{if(currentUser?.role!=='Admin'){setPaymentMessage('Only Admin can lock the payment month.');return;}openJustificationDialog({title:`Lock Payment Collection — ${paymentMonth}`,description:`This is a global financial lock. Monthly Maintenance, Payments and Expenses for ${paymentMonth} will be frozen. The justification is retained for audit.`,action:'payment',locked:true,minLength:3});};
  const unlockPaymentMonth=async()=>{if(currentUser?.role!=='Admin'){setPaymentMessage('Only Admin can unlock a locked payment month.');return;}openJustificationDialog({title:`Unlock Payment Collection — ${paymentMonth}`,description:`Admin correction for ${paymentMonth}. The justification is mandatory and retained in audit history.`,action:'payment',locked:false,minLength:3});};

  const loadPayments=async(showMessage=true)=>{
    setPaymentLoading(true); if(showMessage) setPaymentMessage('');
    try{
      const [p,s]=await Promise.all([
        propertyFetch(`${API}/api/payments?${apartmentQuery()}&month_key=${encodeURIComponent(paymentMonth)}`),
        propertyFetch(`${API}/api/payments/summary?${apartmentQuery()}&month_key=${encodeURIComponent(paymentMonth)}`)
      ]);
      if(!p.ok) throw new Error('Unable to load payments. Generate monthly maintenance first.');
      const rows:Payment[]=await p.json();
      setPayments(rows);
      setPaymentForms(Object.fromEntries(rows.map(r=>[r.flat_no,{
        paid_amount:r.paid_amount,
        payment_mode:r.payment_mode||'Cash',
        reference:r.reference||'',
        payment_date:r.payment_date||new Date().toISOString().slice(0,10),
        remarks:r.remarks||'',
        status:r.pending_balance<=0.0001?'Paid':'Pending'
      }])));
      if(s.ok) setPaymentSummary(await s.json());
    }catch(error){setPaymentMessage(error instanceof Error?error.message:'Unable to load payments.');}
    finally{setPaymentLoading(false);}
  };

  const recalculatePayments=async()=>{
    setPaymentLoading(true);
    setPaymentMessage('Recalculating payment balances and refreshing Dashboard KPIs...');
    try{
      await loadPayments(false);
      await loadDashboardKpis();
      setPaymentMessage('Recalculation complete. Payment KPIs, pending balances and Dashboard integration are refreshed.');
    }catch{
      setPaymentMessage('Unable to refresh calculations.');
    }finally{
      setPaymentLoading(false);
    }
  };

  const loadDashboardKpis=async()=>{
    try{
      const q=period==='Yearly'?`period=Yearly&year=${encodeURIComponent(year)}`:`period=Monthly&month_key=${encodeURIComponent(month)}`;
      const r=await propertyFetch(`${API}/api/dashboard/kpis?${apartmentQuery()}&${q}`);
      if(r.ok) setDashboardKpis(await r.json());
    }catch{}
  };

  useEffect(()=>{ if(tab==='Dashboard'){ loadDashboardKpis(); loadExpenses(false,month); } },[tab,month,year,period]);
  const toggleExpenseLock=async(id:string,locked:boolean)=>{if(!currentUser || currentUser.role!=='Admin'){setExpenseMessage('Only an Admin can lock or unlock an expense.');return;}openJustificationDialog({title:locked?'Lock Expense':'Unlock Expense',description:locked?'Locking freezes this expense. The justification will be retained in Expense Lock History.':'Unlocking permits controlled correction. The justification will be retained in Expense Lock History.',action:'expense',targetId:id,locked,minLength:3});};
  const downloadAdminHistory=async()=>{
    if(currentUser?.role!=='Admin'){setAdminMessage('Only Admin can download Administration History.');return;}
    try{
      const qs=adminHistoryUser&&adminHistoryUser!=='all'?`?username=${encodeURIComponent(adminHistoryUser)}`:'';
      const r=await fetch(`${API}/api/admin/history/download${qs}`,{headers:{'X-ApartCare-Token':authToken}});
      if(!r.ok){const d=await r.json().catch(()=>null);throw new Error(d?.detail||`Download failed (HTTP ${r.status})`);}
      const blob=await r.blob(); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=adminHistoryUser&&adminHistoryUser!=='all'?`ApartCare_${adminHistoryUser}_History.csv`:'ApartCare_All_Users_History.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }catch(e:any){setAdminMessage(e?.message||'Unable to download history.');}
  };

  const loadAdmin=async(userFilter=adminHistoryUser)=>{const headers={'X-ApartCare-Token':authToken};const qs=userFilter&&userFilter!=='all'?`?username=${encodeURIComponent(userFilter)}`:'';const [u,h,t]=await Promise.all([fetch(`${API}/api/admin/users`,{headers}),fetch(`${API}/api/admin/history${qs}`,{headers}),fetch(`${API}/api/admin/session-timeouts`,{headers})]);if(u.ok)setAdminUsers(await u.json());if(h.ok)setLoginHistory(await h.json());if(t.ok)setSessionTimeouts(await t.json());};
  const saveSessionTimeouts=async()=>{const r=await fetch(`${API}/api/admin/session-timeouts`,{method:'PUT',headers:{'Content-Type':'application/json','X-ApartCare-Token':authToken},body:JSON.stringify(sessionTimeouts)});if(!r.ok){const d=await r.json().catch(()=>null);setAdminMessage(d?.detail||'Unable to save session timeout settings.');return;}setAdminMessage('Session timeout settings saved successfully.');};
  const sendTestEmail=async()=>{
    if(emailTestLoading)return;
    setEmailTestLoading(true);setAdminMessage('Sending test email…');
    try{
      const token=await getValidatedPropertyToken();
      if(!token)throw new Error('Login session is required. Please log in again.');
      const r=await fetch(`${API}/api/admin/email/test`,{method:'POST',headers:{'X-ApartCare-Token':token}});
      const d=await r.json().catch(()=>null);
      if(!r.ok)throw new Error(d?.detail||'Unable to send test email.');
      setAdminMessage(d?.message||'Test email sent successfully. Check Inbox and Spam/Junk.');
    }catch(e:any){setAdminMessage(e?.message||'Unable to send test email.');}
    finally{setEmailTestLoading(false);}
  };

  const saveAdminUser=async(e:React.FormEvent)=>{e.preventDefault();setAdminMessage('');const r=await fetch(`${API}/api/admin/users`,{method:'POST',headers:{'Content-Type':'application/json','X-ApartCare-Token':authToken},body:JSON.stringify(adminForm)});if(!r.ok){const d=await r.json().catch(()=>null);setAdminMessage(d?.detail||'Unable to create user.');return;}setAdminMessage('User created successfully. A welcome email has been queued for the registered email address.');setAdminForm({username:'',full_name:'',email:'',mobile_no:'',role:'Viewer',password:''});await loadAdmin();};
  const updateAdminUser=async(id:string,patch:any)=>{const r=await fetch(`${API}/api/admin/users/${id}`,{method:'PUT',headers:{'Content-Type':'application/json','X-ApartCare-Token':authToken},body:JSON.stringify(patch)});if(!r.ok){const d=await r.json().catch(()=>null);setAdminMessage(d?.detail||'Unable to update user.');return;}await loadAdmin();};
  const resetAdminPassword=async(id:string)=>{const p=window.prompt('Enter new password (minimum 8 characters):');if(!p)return;const r=await fetch(`${API}/api/admin/users/${id}/reset-password`,{method:'POST',headers:{'Content-Type':'application/json','X-ApartCare-Token':authToken},body:JSON.stringify({new_password:p,force_change:true})});if(!r.ok){const d=await r.json().catch(()=>null);setAdminMessage(d?.detail||'Unable to reset password.');return;}setAdminMessage('Temporary password set. The user must change it at next login.');await loadAdmin();};
  const resizeApartmentPhoto=async(file:File):Promise<{dataUrl:string,name:string}>=>{
    const source=await new Promise<HTMLImageElement>((resolve,reject)=>{const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Unable to read the selected image.'))};img.src=url;});
    const maxW=1200,maxH=800; const scale=Math.min(1,maxW/source.naturalWidth,maxH/source.naturalHeight);
    const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(source.naturalWidth*scale)); canvas.height=Math.max(1,Math.round(source.naturalHeight*scale));
    const ctx=canvas.getContext('2d'); if(!ctx)throw new Error('Unable to prepare the selected image.'); ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);
    const dataUrl=canvas.toDataURL('image/jpeg',0.82); return {dataUrl,name:file.name.replace(/\.[^.]+$/i,'')+'.jpg'};
  };
  const uploadApartmentPhoto=async(file:File)=>{
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setSettingsMessage('Use JPG, PNG or WEBP for the apartment profile photo.');return;}
    if(file.size>10*1024*1024){setSettingsMessage('Apartment profile photo must be 10 MB or smaller.');return;}
    setSettingsLoading(true);setSettingsMessage('Optimizing and uploading apartment profile photo…');
    try{
      const optimized=await resizeApartmentPhoto(file); const token=await getValidatedPropertyToken();
      if(!token)throw new Error('Login session is required. Please log in again.');
      const r=await fetch(`${API}/api/settings/apartment-photo`,{method:'POST',headers:{'Content-Type':'application/json','X-ApartCare-Token':token},body:JSON.stringify({tenant_id:resolvedApartmentId(),apartment_id:resolvedApartmentId(),photo_name:optimized.name,photo_data_url:optimized.dataUrl})});
      const d=await r.json().catch(()=>null); if(!r.ok)throw new Error(d?.detail||`Unable to upload photo (HTTP ${r.status}).`);
      setSettingsForm(d);setSettingsMessage('Apartment profile photo updated successfully.');
    }catch(e:any){setSettingsMessage(e?.message||'Unable to upload photo.');} finally{setSettingsLoading(false);}
  };
  const removeApartmentPhoto=async()=>{
    if(!window.confirm('Remove the apartment profile photo?'))return; setSettingsLoading(true);setSettingsMessage('Removing apartment profile photo…');
    try{const token=await getValidatedPropertyToken();if(!token)throw new Error('Login session is required. Please log in again.');const r=await fetch(`${API}/api/settings/apartment-photo?apartment_id=${encodeURIComponent(resolvedApartmentId())}`,{method:'DELETE',headers:{'X-ApartCare-Token':token}});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.detail||'Unable to remove apartment photo.');setSettingsForm(d);setSettingsMessage('Apartment profile photo removed.');}catch(e:any){setSettingsMessage(e?.message||'Unable to remove apartment photo.');}finally{setSettingsLoading(false);}
  };

  useEffect(()=>{ if(tab==='Payments'){ loadPayments(false); loadPaymentLock(); } },[tab,paymentMonth]);
  useEffect(()=>{ if(tab==='Expenses'){ resetExpenseForm(); loadExpenses(false,expenseMonth); loadYearlyExpenses(expenseYear); } },[tab,expenseMonth]);
  useEffect(()=>{ if(tab==='Expenses') loadYearlyExpenses(expenseYear); },[expenseYear]);
  useEffect(()=>{ if(tab==='Expenses' && selectedExpenseCategory) loadYearlyExpenseDetails(expenseYear,selectedExpenseCategory); },[expenseYear,selectedExpenseCategory,tab]);

  // Once the authenticated tenant id is available, refresh the visible module
  // from that tenant. This also handles persisted-session restoration.
  useEffect(()=>{
    const tenant=String(currentUser?.tenant_id||'');
    if(!tenant || activeApartmentId!==tenant) return;
    if(previousTenantRef.current && previousTenantRef.current!==tenant){
      // Never let Account A's React state remain visible while Account B is loading.
      resetTenantDisplayState();
    }
    previousTenantRef.current=tenant;
    if(tab==='Dashboard'){ loadDashboardKpis(); loadExpenses(false,month); }
    else if(tab==='Payments'){ loadPayments(false); loadPaymentLock(); }
    else if(tab==='Expenses'){ loadExpenses(false,expenseMonth); loadYearlyExpenses(expenseYear); }
    else if(tab==='Utilities'){ loadUtilityContacts(); }
    else if(tab==='Reports'){ loadReportFlats(); loadOpeningBalance(); }
    else if(tab==='Monthly Maintenance'){ loadMaintenance(false); loadGlobalMonthLock(month,setMaintenanceMonthLocked); }
    else if(tab==='Settings'){ loadSettings(); loadWatchmen(); loadOpeningBalance(); }
  },[activeApartmentId,currentUser?.tenant_id]);

  const recordPayment=async(p:Payment)=>{
    if(paymentMonthLocked){setPaymentMessage(`Payment collection for ${paymentMonth} is locked. Only Admin can unlock it before changes are allowed.`);return;}
    const f=paymentForms[p.flat_no];
    if(!f){setPaymentMessage(`Enter payment details for Flat ${p.flat_no}.`);return;}

    const desiredPaid=Number(f.paid_amount||0);
    if(desiredPaid<0 || desiredPaid>Number(p.amount_due||0)+0.0001){
      setPaymentMessage(`Paid Amount must be between ₹0 and ${money(p.amount_due)} for Flat ${p.flat_no}.`);
      return;
    }

    setPaymentLoading(true); setPaymentMessage('');
    try{
      // PUT saves the cumulative paid amount and also supports corrections.
      // Example: previously Paid ₹1,250 -> change to Pending ₹1,200 -> Save.
      // The backend replaces the old month amount with ₹1,200.
      const r=await fetch(`${API}/api/payments`,{method:'PUT',headers:{'Content-Type':'application/json','X-ApartCare-Token':authToken},
        body:JSON.stringify({tenant_id:resolvedApartmentId(),apartment_id:resolvedApartmentId(),month_key:paymentMonth,flat_no:p.flat_no,
          paid_amount:desiredPaid,payment_mode:f.payment_mode,reference:f.reference,
          payment_date:f.payment_date,remarks:f.remarks})});
      if(!r.ok){const d=await r.json().catch(()=>null);throw new Error(d?.detail||'Unable to save payment correction');}

      const saved:Payment=await r.json();
      const pending=Math.max(0,Number(saved.amount_due)-Number(saved.paid_amount));
      setPaymentMessage(
        pending<=0.0001
          ? `Payment saved. Flat ${p.flat_no} is fully Paid.`
          : `Payment saved. Paid Amount: ${money(saved.paid_amount)} | Pending Amount: ${money(pending)}`
      );

      // Refresh dependent views in parallel so a single-flat save does not wait on sequential API calls.
      await Promise.all([loadPayments(false),loadDashboardKpis()]);
    }catch(error){setPaymentMessage(error instanceof Error?error.message:'Unable to save payment.');}
    finally{setPaymentLoading(false);}
  };

  const saveSelectedPayments=async()=>{
    if(paymentMonthLocked){setPaymentMessage(`Payment collection for ${paymentMonth} is locked. Only Admin can unlock it before changes are allowed.`);return;}
    const targets=payments.filter(p=>selectedPaymentFlats.includes(p.flat_no));
    if(!targets.length){setPaymentMessage('Select at least one payment row, or use Select All.');return;}
    setPaymentLoading(true); setPaymentMessage('Saving selected payments…');
    try{
      const payload=targets.map(p=>{
        const f=paymentForms[p.flat_no];
        if(!f) throw new Error(`Enter payment details for Flat ${p.flat_no}.`);
        const paid=Number(f.paid_amount||0);
        if(paid<0 || paid>Number(p.amount_due||0)+0.0001) throw new Error(`Invalid Paid Amount for Flat ${p.flat_no}`);
        return {tenant_id:resolvedApartmentId(),apartment_id:resolvedApartmentId(),month_key:paymentMonth,flat_no:p.flat_no,paid_amount:paid,payment_mode:f.payment_mode,reference:f.reference,payment_date:f.payment_date,remarks:f.remarks};
      });
      const r=await fetch(`${API}/api/payments/bulk`,{method:'PUT',headers:{'Content-Type':'application/json','X-ApartCare-Token':authToken},body:JSON.stringify({tenant_id:resolvedApartmentId(),apartment_id:resolvedApartmentId(),payments:payload})});
      const d=await r.json().catch(()=>null);
      if(!r.ok)throw new Error(d?.detail||'Unable to save selected payments.');
      await Promise.all([loadPayments(false),loadDashboardKpis()]);
      setSelectedPaymentFlats([]);
      setPaymentMessage(`${Number(d?.saved||targets.length)} payment record(s) saved successfully.`);
    }catch(error){setPaymentMessage(error instanceof Error?error.message:'Unable to save selected payments.');}
    finally{setPaymentLoading(false);}
  };

  const updatePaymentForm=(flat:string,key:string,value:string)=>{
    setPaymentForms(forms=>({...forms,[flat]:{...forms[flat],[key]:key==='paid_amount'?Number(value):value} as any}));
  };

  const updatePaymentStatus=(p:Payment,status:'Paid'|'Pending')=>{
    setPaymentForms(forms=>{
      const existing=forms[p.flat_no]||{
        paid_amount:p.paid_amount||0,payment_mode:'Cash',reference:'',
        payment_date:new Date().toISOString().slice(0,10),remarks:'',status:'Pending' as 'Pending'
      };
      return {
        ...forms,
        [p.flat_no]:{
          ...existing,
          status,
          // Paid means the cumulative Paid Amount equals the full Amount Due.
          // Pending never clears the Paid Amount entered by the user.
          paid_amount:status==='Paid'?p.amount_due:existing.paid_amount
        }
      };
    });
  };


  const changePassword=async(e?:React.FormEvent)=>{
    if(e) e.preventDefault();
    if(changePasswordLoading)return;
    setChangePasswordMessage('');
    const token=authToken||(()=>{try{return JSON.parse(window.localStorage.getItem('apartcare_session')||'null')?.token||'';}catch{return '';}})();
    if(!token){setChangePasswordMessage('Your login session has expired. Please log in again.');return;}
    const nextPassword=String(changePasswordForm.new_password||'');
    const confirmPassword=String(changePasswordForm.confirm_password||'');
    if(!nextPassword || !confirmPassword){setChangePasswordMessage('Enter and confirm your new password.');return;}
    if(nextPassword!==confirmPassword){setChangePasswordMessage('Passwords do not match.');return;}
    if(nextPassword.length<8){setChangePasswordMessage('Password must be at least 8 characters.');return;}
    setChangePasswordLoading(true);
    try{
      const controller=new AbortController();
      const timeout=window.setTimeout(()=>controller.abort(),10000);
      let response:Response;
      try{
        response=await fetch(`${API}/api/admin/auth/change-password`,{
          method:'POST',
          headers:{'Content-Type':'application/json','X-ApartCare-Token':token,'Cache-Control':'no-cache'},
          body:JSON.stringify({new_password:nextPassword}),
          signal:controller.signal,
          cache:'no-store'
        });
      }finally{window.clearTimeout(timeout);}
      const text=await response.text();
      let data:any=null;try{data=text?JSON.parse(text):null;}catch{}
      if(!response.ok){setChangePasswordMessage(data?.detail||`Unable to change password (HTTP ${response.status}).`);return;}
      const nextUser=data?.id?{...data,force_password_change:false}:currentUser?{...currentUser,force_password_change:false}:null;
      if(nextUser){setCurrentUser(nextUser);window.localStorage.setItem('apartcare_session',JSON.stringify({user:nextUser,token}));try{const hint=JSON.parse(window.localStorage.getItem(`apartcare_login_hint:${String(rememberScope||'unknown')}`)||'null');if(hint?.username){window.localStorage.setItem(`apartcare_login_hint:${String(rememberScope||'unknown')}`,JSON.stringify({...hint,password_changed_at:new Date().toISOString()}));}}catch{}}
      setMustChangePassword(false);
      setChangePasswordForm({new_password:'',confirm_password:''});
      setChangePasswordMessage('Password updated successfully.');
      // Viewer lands on Dashboard; Supervisor retains Monthly Maintenance.
      if(nextUser?.role==='Viewer')setTab('Dashboard');
      else if(['Supervisor','Caretaker'].includes(nextUser?.role))setTab('Monthly Maintenance');
    }catch(error:any){
      setChangePasswordMessage(error?.name==='AbortError'?'Password update timed out. Please verify the ApartCare backend is running and try again.':`Unable to update password. ${error?.message||'Please try again.'}`);
    }finally{setChangePasswordLoading(false);}
  };

  const saveSelectedMaintenance=async()=>{
    const targets=maintenanceRows.filter(r=>selectedMaintenanceIds.includes(r.id));
    if(!targets.length){setMaintenanceMessage('Select at least one flat, or use Select All.');return;}
    setMaintenanceLoading(true); setMaintenanceMessage('Saving selected maintenance rows...');
    try{ for(const r of targets){
      const resp=await fetch(`${API}/api/maintenance/${r.id}`,{method:'PUT',headers:{'Content-Type':'application/json','X-ApartCare-Token':authToken},body:JSON.stringify({maintenance:Number(r.maintenance||0),cca:Number(r.cca||0),diesel:Number(r.diesel||0),other_charges:Number(r.other_charges||0),current_reading:Number(r.current_reading||0),remarks:r.remarks||''})});
      if(!resp.ok){const d=await resp.json().catch(()=>null);throw new Error(d?.detail||`Unable to save Flat ${r.flat_no}`);}
    } await loadMaintenance(false); await loadDashboardKpis(); setMaintenanceMessage(`${targets.length} maintenance row(s) saved successfully.`);
    }catch(error){setMaintenanceMessage(error instanceof Error?error.message:'Unable to save selected maintenance rows.');}
    finally{setMaintenanceLoading(false);}
  };

  const resetImportFileInput=()=>{
    setImportFile(null);
    if(importFileInputRef.current) importFileInputRef.current.value='';
  };

  const uploadImportFile=async()=>{
    if(!importFile){setImportMessage('Choose the ApartCare Excel template first.');setImportErrors([]);return;}
    setImportLoading(true); setImportMessage('Importing and validating data...'); setImportErrors([]);
    try{
      const fd=new FormData();fd.append('file',importFile);
      if(importType==='maintenance')fd.append('historical',historicalImport?'true':'false');
      const endpoint=importType==='residents'?'/api/import/residents':'/api/import/monthly-maintenance';
      const importUrl=`${API}${endpoint}?${apartmentQuery()}`;
      const r=await fetch(importUrl,{method:'POST',headers:{'X-ApartCare-Token':authToken},body:fd});
      const d=await r.json().catch(()=>null);
      if(!r.ok){
        const detail=Array.isArray(d?.errors)?d.errors:[];
        setImportErrors(detail);
        throw new Error(d?.detail||'Import failed');
      }
      const errors=Array.isArray(d?.errors)?d.errors.map((x:any)=>String(x)):[];
      setImportErrors(errors);
      const summary=`Import complete: ${d.added||0} added, ${d.skipped||0} duplicates skipped, ${d.invalid||0} invalid.${d.historical?` ${d.payments_created||0} historical payments automatically marked Paid.`:''} ${d.months?.length?`Months: ${d.months.join(', ')}`:''}`;
      setImportMessage(errors.length?`${summary} See the validation details below.`:summary);
      resetImportFileInput();
      if(importType==='residents'){await loadResidents();}
      else{
        const importedMonths=Array.isArray(d?.months)?d.months.filter((m:any)=>/^\d{4}-\d{2}$/.test(String(m))):[];
        const latestImportedMonth=importedMonths.length?String(importedMonths.sort().at(-1)):'';
        if(latestImportedMonth){setMonth(latestImportedMonth);setPaymentMonth(latestImportedMonth);setExpenseMonth(latestImportedMonth);setReportMonth(latestImportedMonth);setIndividualReportMonth(latestImportedMonth);setYear(latestImportedMonth.slice(0,4));setReportYear(latestImportedMonth.slice(0,4));setExpenseYear(latestImportedMonth.slice(0,4));}
        await Promise.all([loadMaintenance(false),loadPayments(false),loadDashboardKpis()]);
      }
    }catch(error){
      setImportMessage(error instanceof Error?error.message:'Import failed.');
      resetImportFileInput();
    }finally{setImportLoading(false);}
  };

  const filteredResidents=residents.filter(r=>{
    const v=query.toLowerCase();
    return !v || [r.flat_no,r.owner_name,r.resident_name,r.mobile_no].some(x=>x.toLowerCase().includes(v));
  });

  // Individual Flat Statement: keep the same financial layout used in the Streamlit report.
  // The ledger is preferred for payment/balance values; maintenance remains the source of charge breakup.
  const allIndividualMaintenance = [...individualMaintenance].sort((a,b)=>String(a.month_key).localeCompare(String(b.month_key)));
  const ledgerRows = Array.isArray(flatStatement?.ledger) ? flatStatement!.ledger : [];
  const ledgerByMonth = new Map<string,any>();
  ledgerRows.forEach((r:any)=>{
    const key=String(r.month_key ?? r.month ?? r.Month ?? '');
    if(key) ledgerByMonth.set(key,r);
  });
  const numberOf=(...values:any[])=>{
    for(const v of values){const n=Number(v); if(Number.isFinite(n)) return n;}
    return 0;
  };
  let runningFlatBalance=0;
  const individualStatementAllRows = allIndividualMaintenance.map((r:any)=>{
    const ledger=ledgerByMonth.get(r.month_key)||{};
    // __payment is populated from /api/payments for the exact month and flat.
    // This is intentionally the primary source for Paid/Pending because it is the
    // canonical cross-module payment record.
    const payment=(r as any).__payment||{};
    const totalDue=numberOf(payment.current_month_total,r.rounded_total,r.total_due,r.total);
    const previousBalance=numberOf(payment.previous_balance,ledger.previous_balance,ledger.previousBalance,ledger.prev_balance,ledger.opening_balance,runningFlatBalance);
    const paid=numberOf(payment.paid_amount,payment.paid,ledger.paid,ledger.paid_amount,ledger.payment_amount,ledger.current_paid,r.paid,0);
    const currentPending=numberOf(payment.pending_balance,ledger.current_pending,ledger.currentPending,ledger.pending_amount,ledger.pending,Math.max(0,totalDue-paid));
    // Payment module's pending balance is the current-month pending. Closing ledger
    // balance is previous balance plus current pending and must not determine status.
    const balance=numberOf(payment.balance,payment.closing_balance,ledger.balance,ledger.Balance,ledger.closing_balance,previousBalance+currentPending);
    const status=currentPending<=0.005?'Paid':'Pending';
    runningFlatBalance=balance;
    return {
      month_key:r.month_key,
      maintenance:numberOf(r.maintenance,r.mtce),
      cca:numberOf(r.cca),
      diesel:numberOf(r.diesel),
      water:numberOf(r.water_amount,r.water_bill),
      total_due:totalDue,
      previous_balance:previousBalance,
      paid,
      current_pending:currentPending,
      balance,
      status
    };
  });
  const individualStatementRows = individualReportPeriod==='Monthly'
    ? individualStatementAllRows.filter(r=>r.month_key===individualReportMonth)
    : individualStatementAllRows.filter(r=>r.month_key.startsWith(`${individualReportYear}-`));
  const individualStatementTotals = individualStatementRows.reduce((a,r)=>({
    maintenance:a.maintenance+r.maintenance, cca:a.cca+r.cca, diesel:a.diesel+r.diesel, water:a.water+r.water,
    total_due:a.total_due+r.total_due, previous_balance:a.previous_balance+r.previous_balance, paid:a.paid+r.paid,
    current_pending:a.current_pending+r.current_pending, balance:r.balance
  }),{maintenance:0,cca:0,diesel:0,water:0,total_due:0,previous_balance:0,paid:0,current_pending:0,balance:0});
  const filteredIndividualMaintenance = allIndividualMaintenance.filter(r=>individualStatementRows.some(x=>x.month_key===r.month_key));
  const individualTotals = filteredIndividualMaintenance.reduce((a,r)=>({maintenance:a.maintenance+Number(r.maintenance||0),cca:a.cca+Number(r.cca||0),diesel:a.diesel+Number(r.diesel||0),water_units:a.water_units+Number(r.water_units||0),water:a.water+Number(r.water_amount||0),total:a.total+Number(r.rounded_total||0)}),{maintenance:0,cca:0,diesel:0,water_units:0,water:0,total:0});

  const printReport=(kind:'all'|'yearly'|'individual')=>{const classes=['apartcare-print-water-only','apartcare-print-standard','apartcare-print-yearly','apartcare-print-individual'];document.body.classList.remove(...classes);const cls=kind==='all'?'apartcare-print-water-only':kind==='yearly'?'apartcare-print-yearly':'apartcare-print-individual';document.body.classList.add(cls);const cleanup=()=>document.body.classList.remove(...classes);window.addEventListener('afterprint',cleanup,{once:true});window.requestAnimationFrame(()=>window.setTimeout(()=>{window.print();window.setTimeout(cleanup,1200);},30));};
  const exportReport=async(kind:'all'|'yearly'|'individual', mode:'excel'|'screenshot'|'whatsapp')=>{
    let title='ApartCare Report'; let headers:string[]=[]; let rows:any[][]=[];
    if(kind==='all'){
      title=`${settingsForm.apartment_name || 'Apartment'} — Maintenance - ${reportMonth}`;
      headers=['Flat No','Name','Mobile','Mtce','CCA','Water Amount','Rounded Total','Paid','Balance'];
      rows=(allFlatsReport?.rows||[]).map((r:any)=>[r.flat_no,r.display_name||r.resident_name||r.owner_name,r.mobile_no||'',money(r.maintenance),money(r.cca),money(r.water_amount),money(r.rounded_total),money(r.paid),money(r.pending)]);
      if(allFlatsReport?.totals) rows.push(['TOTAL','','',money(allFlatsReport.totals.maintenance),money(allFlatsReport.totals.cca),money(allFlatsReport.totals.water),money(allFlatsReport.totals.total),money(allFlatsReport.totals.paid),money(allFlatsReport.totals.pending)]);
    } else if(kind==='yearly'){
      title=`${settingsForm.apartment_name || 'Apartment'} — Yearly Collection vs Expenses - ${reportYear}`;
      const sourceRows=(yearlyCollectionReport?.rows||[]).map((r:any)=>({...r}));
      // V6.4.14: yearly exports consume the same canonical rolling-balance rows
      // returned by the backend. Do not recalculate opening/closing independently in UI.
      const normalized=sourceRows.map((r:any)=>({
        ...r,
        collected:Number(r.collected||0),
        expenses:Number(r.expenses||0),
        difference:Number.isFinite(Number(r.difference))?Number(r.difference):Number(r.collected||0)-Number(r.expenses||0),
        opening_balance:Number(r.opening_balance||0),
        closing_balance:Number(r.closing_balance||0)
      }));
      headers=['Month','Opening Balance','Collected','Expenses','Net Change','Closing Balance'];
      rows=normalized.map((r:any)=>[r.month_key,money(r.opening_balance),money(r.collected),money(r.expenses),money(r.difference),money(r.closing_balance)]);
      if(normalized.length){
        const totalCollected=normalized.reduce((a:number,r:any)=>a+r.collected,0);
        const totalExpenses=normalized.reduce((a:number,r:any)=>a+r.expenses,0);
        const net=totalCollected-totalExpenses;
        rows.push(['Year Total / Closing',money(normalized[0].opening_balance),money(totalCollected),money(totalExpenses),money(net),money(normalized[normalized.length-1].closing_balance)]);
      }
    } else {
      const period=individualReportPeriod==='Monthly'?individualReportMonth:individualReportYear;
      title=`${settingsForm.apartment_name || 'Apartment'} — ${reportFlat} Statement - ${period}`;
      headers=['Month','Maintenance','CCA','Diesel','Water','Total Due','Previous Balance','Paid','Current Pending','Balance','Status'];
      rows=individualStatementRows.map((r:any)=>[r.month_key,money(r.maintenance),money(r.cca),money(r.diesel),money(r.water),money(r.total_due),money(r.previous_balance),money(r.paid),money(r.current_pending),money(r.balance),r.status]);
      rows.push(['TOTAL',money(individualStatementTotals.maintenance),money(individualStatementTotals.cca),money(individualStatementTotals.diesel),money(individualStatementTotals.water),money(individualStatementTotals.total_due),money(individualStatementTotals.previous_balance),money(individualStatementTotals.paid),money(individualStatementTotals.current_pending),money(individualStatementTotals.balance),'']);
    }
    if(mode==='excel') { await downloadExcelTable(title,headers,rows,`${title.replace(/[^a-z0-9]+/gi,'_')}.xls`); return; }
    tableScreenshotBlob(title,headers,rows).then(blob=>{
      if(mode==='screenshot'){ const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${title.replace(/[^a-z0-9]+/gi,'_')}.png`; a.click(); URL.revokeObjectURL(url); }
      else shareReportViaWhatsApp(title,'Please find the selected ApartCare report attached.',blob,`${title.replace(/[^a-z0-9]+/gi,'_')}.png`);
    });
  };
  const ReportActions=({kind}:{kind:'all'|'yearly'|'individual'})=><div className="report-actions"><button type="button" className="secondary" onClick={()=>exportReport(kind,'excel')}>📥 Download Excel</button><button type="button" className="secondary" onClick={()=>exportReport(kind,'screenshot')}>🖼 Download Image</button><button type="button" className="secondary" onClick={()=>printReport(kind)}>🖨 Print Report</button><button type="button" onClick={()=>exportReport(kind,'whatsapp')}>📱 Share via WhatsApp</button></div>;

  const dashboardCards = dashboardKpis ? [
    ['Prev Month Closing',money(dashboardKpis.previous_month_closing)],
    ['Total Maintenance',money(dashboardKpis.total_maintenance)],
    ['Total Collected',money(dashboardKpis.total_collected)],
    ['Total Expenses',money(dashboardKpis.total_expenses)],
    ['Current Balance',money(dashboardKpis.current_balance)],
    ['Total Available Amt',money(dashboardKpis.total_available_amount)]
  ] : [
    ['Prev Month Closing','₹ 0'],['Total Maintenance','₹ 0'],['Total Collected','₹ 0'],
    ['Total Expenses','₹ 0'],['Current Balance','₹ 0'],['Total Available Amt','₹ 0']
  ];

  if(!authChecked)return <div className="auth-shell"><section className="auth-card"><h1>Loading ApartCare…</h1></section></div>;
  if(!accountInitialized || !currentUser){
    const showCreate=!accountInitialized || authMode==='create';
    const eye=(open:boolean)=>open?'🙈':'👁️';
    if(authMode==='platform'){
      return <div className="auth-shell platform-owner-auth-shell"><section className="auth-card platform-card platform-owner-console">
        <style>{`
      :root{--ink:#334155;--blue:#3b68b8;--panel:#ffffff;--line:#d9e1ea}
      .user-language-preference{display:flex;flex-direction:column;gap:5px;margin:9px 0 8px;padding:9px 10px;border:1px solid rgba(255,255,255,.10);border-radius:10px;background:rgba(255,255,255,.045)}.user-language-preference label{font-size:10px!important;font-weight:800!important;color:#cbd8e8!important;text-transform:uppercase;letter-spacing:.04em}.user-language-preference select{width:100%;min-height:34px;padding:6px 8px;border:1px solid #9fb5cc;border-radius:8px;background:#fff;color:#20364f;font-size:12px;font-weight:700;box-sizing:border-box}.user-language-preference select:disabled{opacity:.7}.user-language-message{font-size:10px!important;color:#bfe9d0!important;line-height:1.25}.shell{background:linear-gradient(135deg,#f6f8fc,#eef3f8);min-height:100vh;color:var(--ink);display:grid;grid-template-columns:minmax(260px,290px) minmax(0,1fr);width:100%;min-width:0;overflow-x:hidden}.main{background:transparent;min-width:0;width:100%;max-width:none;overflow-x:hidden}.sidebar{min-width:0;width:100%;box-sizing:border-box;position:sticky;top:0;height:100vh;overflow-y:auto;z-index:20}      .platform-owner-auth-shell .auth-card{width:min(1040px,calc(100vw - 48px))!important;max-width:1040px!important}
      /* V6.5.6 — Platform Owner branding follows the same ApartCare Lite design system.
         The logo is allowed only inside explicitly constrained branding containers. */
      .platform-owner-auth-shell input[type="checkbox"],.platform-owner-auth-shell input[type="radio"]{width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;max-width:16px!important;max-height:16px!important;appearance:auto!important;-webkit-appearance:auto!important;accent-color:#2563eb!important;box-shadow:none!important;padding:0!important;margin:0!important}
      .platform-owner-auth-shell .platform-brand-icon{width:48px!important;height:48px!important;display:grid!important;place-items:center!important;flex:0 0 48px!important;border-radius:12px!important;background:linear-gradient(135deg,#eaf3ff,#eefaf8)!important;border:1px solid #d8e6f3!important;font-size:25px!important}
      .platform-owner-auth-shell .po-logo{width:86px!important;height:58px!important;display:flex!important;align-items:center!important;justify-content:center!important;flex:0 0 86px!important;border-radius:12px!important;background:#fff!important;border:1px solid #dbe6f2!important;overflow:hidden!important;padding:3px!important;box-shadow:0 4px 12px rgba(15,23,42,.06)!important}
      .platform-owner-auth-shell .po-logo img{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important}
      .platform-owner-auth-shell .po-brand-image{display:block!important;width:76px!important;height:76px!important;max-width:76px!important;max-height:76px!important;object-fit:contain!important;border-radius:16px!important;background:#fff!important;border:1px solid #dbe6f2!important;padding:5px!important;box-shadow:0 5px 14px rgba(15,23,42,.08)!important;flex:0 0 76px!important}
      .platform-owner-auth-shell .password-modal-brand img{display:block!important}
      .platform-owner-auth-shell .password-modal-brand{display:flex!important;align-items:center!important;gap:14px!important;padding:0 0 18px!important;margin-bottom:20px!important;border-bottom:1px solid #e2e8f0!important}
      .platform-owner-auth-shell .password-modal-brand-copy{display:flex!important;flex-direction:column!important;gap:3px!important}
      .platform-owner-auth-shell .password-modal-brand-copy strong{font-size:20px!important;line-height:1.2!important;color:#172b4d!important}
      .platform-owner-auth-shell .password-modal-brand-copy span{font-size:13px!important;font-weight:700!important;color:#315f96!important}
      .platform-owner-auth-shell .password-modal-brand-copy em{font-size:12px!important;color:#0f8a5f!important;font-style:italic!important;font-weight:700!important}

      .platform-owner-auth-shell{min-height:100vh!important;padding:28px!important;background:linear-gradient(135deg,#0f2742 0%,#173b60 42%,#eef4fb 42%,#f6f9fd 100%)!important;align-items:flex-start!important}
      /* V6.5.13 ALIGNMENT FIX 5 — prevent platform auth horizontal overflow at desktop widths.
         The auth card width must include its padding; the viewport must never be wider than the page. */
      html,body{width:100%!important;max-width:100%!important;margin:0!important;padding:0!important;overflow-x:hidden!important}
      .platform-owner-auth-shell{width:100%!important;max-width:100%!important;box-sizing:border-box!important;overflow-x:hidden!important}
      .platform-owner-auth-shell .auth-card,.platform-owner-auth-shell .platform-owner-console{box-sizing:border-box!important;width:100%!important;max-width:1040px!important;min-width:0!important}
      .platform-owner-auth-shell .auth-brand{display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:flex-start!important;gap:20px!important;width:100%!important;min-width:0!important;box-sizing:border-box!important;padding:0 0 22px!important;margin:0 0 22px!important;border-bottom:1px solid #dbe4ef!important}
      .platform-owner-auth-shell .auth-logo{width:108px!important;height:76px!important;display:flex!important;align-items:center!important;justify-content:center!important;flex:0 0 108px!important;border-radius:14px!important;background:#fff!important;border:1px solid #dbe4ef!important;overflow:hidden!important;box-shadow:0 6px 18px rgba(23,43,77,.08)!important;padding:4px!important}
      .platform-owner-auth-shell .auth-logo img{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important}
      .platform-owner-auth-shell .auth-brand-copy{min-width:0!important;display:flex!important;flex-direction:column!important;gap:3px!important}
      .platform-owner-auth-shell .auth-brand-copy h1{margin:0 0 3px!important;font-size:32px!important;line-height:1.1!important;color:#172b4d!important;font-weight:850!important;letter-spacing:-.03em!important}
      .platform-owner-auth-shell .auth-brand-copy p{margin:0!important;font-size:16px!important;color:#315f96!important;font-weight:750!important}
      .platform-owner-auth-shell .auth-brand-copy em{margin:0!important;font-style:normal!important;color:#0f8a5f!important;font-weight:650!important}
      .platform-owner-auth-shell .auth-brand>div:last-child{min-width:0!important}
      .platform-owner-auth-shell .auth-brand h1,.platform-owner-auth-shell .auth-brand p,.platform-owner-auth-shell .auth-brand em{overflow-wrap:anywhere!important}
      .platform-owner-auth-shell .auth-form{box-sizing:border-box!important;width:100%!important;min-width:0!important}
      .platform-owner-auth-shell .auth-form .password-field{box-sizing:border-box!important;min-width:0!important;width:100%!important}
      .platform-owner-auth-shell .auth-form .password-toggle{height:46px!important;min-height:46px!important;max-height:46px!important;display:flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;border:1px solid #c8d7e7!important;border-radius:11px!important;background:#edf4ff!important;color:#172b4d!important;font-size:18px!important;line-height:1!important;padding:0!important;cursor:pointer!important;box-shadow:0 2px 6px rgba(23,43,77,.06)!important}
      .platform-owner-auth-shell .auth-form .password-toggle:hover{background:#e2edff!important;border-color:#9dbbe8!important}
      @media(max-width:1200px){.dashboard-kpis{grid-template-columns:repeat(3,minmax(0,1fr))!important}}@media(max-width:700px){.dashboard-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:460px){.dashboard-kpis{grid-template-columns:1fr!important}}@media(max-width:760px){.platform-owner-auth-shell{padding:14px!important}.platform-owner-auth-shell .auth-card{width:100%!important;max-width:none!important}.platform-owner-auth-shell .auth-brand{gap:14px!important}.platform-owner-auth-shell .auth-form{padding:16px!important}}.platform-owner-auth-shell .platform-owner-console{margin:0 auto!important;overflow:hidden!important;border:1px solid #d5e2ef!important;border-radius:24px!important;background:rgba(255,255,255,.96)!important;box-shadow:0 24px 60px rgba(15,39,66,.22)!important}.platform-owner-auth-shell .platform-auth-heading{display:flex;align-items:center;gap:16px;margin:-28px -28px 24px;padding:22px 28px;background:linear-gradient(135deg,#102b4d,#1f4d78);color:#fff;border-bottom:4px solid #4e86d9}.platform-owner-auth-shell .platform-auth-heading img{width:64px;height:64px;object-fit:contain;background:#fff;border-radius:16px;padding:6px}.platform-owner-auth-shell .platform-auth-heading h2{margin:0;color:#fff!important;font-size:1.65rem!important}.platform-owner-auth-shell .platform-auth-heading p{margin:3px 0 0;color:#dbeafe;font-size:.9rem}.platform-owner-auth-shell .auth-form{padding:20px!important;border:1px solid #d8e3ee!important;border-radius:18px!important;background:linear-gradient(145deg,#fbfdff,#f4f8fc)!important;box-shadow:0 12px 28px rgba(38,56,78,.07)!important}.platform-owner-auth-shell .auth-form label{gap:7px!important;color:#334e6f!important;font-weight:800!important}.platform-owner-auth-shell .auth-form input{min-height:46px!important;border:1px solid #c8d7e7!important;border-radius:11px!important;background:#fff!important;box-shadow:inset 0 1px 2px rgba(15,23,42,.03)!important}.platform-owner-auth-shell .auth-form input:focus{border-color:#4e86d9!important;box-shadow:0 0 0 3px rgba(78,134,217,.14)!important;outline:none!important}.platform-owner-auth-shell .auth-primary-button{min-height:44px!important}.platform-owner-auth-shell .auth-secondary-button,.platform-owner-auth-shell .auth-back-button{margin-top:10px!important}
      .platform-owner-auth-shell .auth-form{max-width:880px!important;margin:0 auto!important;grid-template-columns:minmax(0,1fr) minmax(280px,360px)!important;gap:18px!important}
      .platform-owner-auth-shell .auth-form input{max-width:100%!important;box-sizing:border-box!important}
      .platform-owner-auth-shell .auth-form .form-actions{grid-column:1/-1!important}
      .platform-owner-auth-shell .auth-form .password-field{display:grid!important;grid-template-columns:minmax(0,1fr) 48px!important;gap:8px!important}
      .platform-owner-auth-shell .auth-form .password-toggle{min-width:48px!important;width:48px!important}
      .platform-owner-auth-shell .po-top-header{min-height:82px!important;height:auto!important;padding:10px 28px!important}
      .platform-owner-auth-shell .po-brand-block{gap:13px!important;min-width:0!important}
      .platform-owner-auth-shell .po-brand-line{gap:8px!important;align-items:center!important}
      .platform-owner-auth-shell .po-brand-line>span:first-child{font-size:18px!important;font-weight:850!important;color:#172b4d!important}
      .platform-owner-auth-shell .po-console-label{font-size:12px!important;color:#315f96!important;font-weight:700!important;margin-top:3px!important}
      .platform-owner-auth-shell .po-console-tagline{font-size:11px!important;color:#0f8a5f!important;font-style:italic!important;font-weight:700!important;margin-top:2px!important}
      .platform-owner-auth-shell .password-modal-branded{width:min(650px,calc(100vw - 32px))!important;max-height:calc(100vh - 32px)!important;overflow:auto!important;padding:28px!important;background:linear-gradient(180deg,#fff 0%,#f8fbff 100%)!important;border:1px solid #d7e2f0!important;border-radius:22px!important;box-shadow:0 28px 80px rgba(15,23,42,.30)!important}
      .platform-owner-auth-shell .password-modal-branded h2{font-size:29px!important;line-height:1.18!important;margin:0 0 10px!important;color:#172b4d!important;letter-spacing:-.35px!important}
      .platform-owner-auth-shell .password-modal-branded>p{margin:0 0 22px!important;color:#64748b!important;font-size:15px!important;line-height:1.65!important}
      .platform-owner-auth-shell .password-modal-branded form{display:flex!important;flex-direction:column!important;gap:18px!important}
      .platform-owner-auth-shell .password-modal-branded form>label{display:flex!important;flex-direction:column!important;gap:8px!important;color:#334155!important;font-size:14px!important;font-weight:800!important}
      .platform-owner-auth-shell .password-modal-branded .password-field{display:grid!important;grid-template-columns:minmax(0,1fr) 48px!important;gap:8px!important}
      .platform-owner-auth-shell .password-modal-branded .password-field input{width:100%!important;min-height:48px!important;box-sizing:border-box!important;border:1px solid #cbd8e8!important;border-radius:12px!important;background:#fff!important;padding:11px 14px!important;font-size:16px!important}
      .platform-owner-auth-shell .password-modal-branded .password-toggle{min-height:48px!important;width:48px!important;border:1px solid #cbd8e8!important;border-radius:12px!important;background:#edf4ff!important;padding:0!important}
      .platform-owner-auth-shell .remember-login{display:inline-flex!important;align-items:center!important;gap:8px!important;min-height:24px!important}
      .platform-owner-auth-shell .remember-login input[type="checkbox"],
      .platform-owner-auth-shell input[type="checkbox"],
      .platform-owner-auth-shell input[type="radio"]{width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;max-width:16px!important;max-height:16px!important;padding:0!important;margin:0!important;flex:0 0 16px!important;box-sizing:border-box!important;appearance:auto!important;-webkit-appearance:auto!important}
      @media(max-width:760px){.platform-owner-auth-shell .auth-card{width:calc(100vw - 28px)!important}.platform-owner-auth-shell .auth-form{grid-template-columns:1fr!important}}
      .platform-console-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 18px;padding:7px;background:linear-gradient(135deg,#f8fbff,#eef4fa);border:1px solid #d7e2ee;border-radius:18px;box-shadow:0 8px 22px rgba(36,64,96,.08);position:sticky;top:8px;z-index:15}.platform-console-tabs button{position:relative;display:grid;grid-template-columns:34px 1fr;grid-template-rows:auto auto;column-gap:9px;align-items:center;text-align:left;min-height:72px;padding:11px 14px!important;border:1px solid transparent!important;border-radius:13px!important;background:transparent!important;color:#52637a!important;box-shadow:none!important;transform:none!important}.platform-console-tabs button:first-letter{font-size:1.2rem}.platform-console-tabs button span{font-weight:850;font-size:.91rem;color:#334e6f;line-height:1.2}.platform-console-tabs button small{grid-column:2;color:#8090a5;font-size:.72rem;margin-top:2px}.platform-console-tabs button.active{background:linear-gradient(135deg,#2563eb,#3b82f6)!important;color:#fff!important;border-color:#1d4ed8!important;box-shadow:0 8px 18px rgba(37,99,235,.25)!important}.platform-console-tabs button.active span,.platform-console-tabs button.active small{color:#fff}.platform-console-tabs button:hover:not(.active){background:#fff!important;border-color:#cbd9e8!important;box-shadow:0 5px 12px rgba(36,64,96,.08)!important}.platform-console-tabs button:focus-visible{outline:3px solid rgba(59,130,246,.25);outline-offset:2px}.platform-property{padding:24px!important}.platform-property>h2{font-size:1.42rem;color:#1f3b5d;margin:0 0 5px}.platform-property>.subtitle{margin:0 0 18px;color:#71829a}.platform-account-toolbar{display:grid;grid-template-columns:minmax(280px,1fr) auto;align-items:end;gap:12px;flex-wrap:wrap;margin:18px 0;padding:15px;border:1px solid #dbe5ef;border-radius:15px;background:linear-gradient(135deg,#fbfdff,#f5f8fc)}.platform-account-toolbar label,.audit-filter-grid label,.subscription-settings-form label{font-weight:750;color:#425773;font-size:.82rem}.platform-account-toolbar input,.platform-account-toolbar select,.audit-filter-grid input,.audit-filter-grid select,.subscription-settings-form input,.subscription-settings-form select,.subscription-plan-card input,.subscription-new-plan input,.subscription-table-toolbar input,.subscription-table select{margin-top:6px;min-height:42px;border:1px solid #c9d5e3!important;border-radius:10px!important;background:#fff!important;padding:9px 11px!important;box-shadow:inset 0 1px 2px rgba(15,23,42,.03),0 1px 2px rgba(15,23,42,.03)!important;font-size:.9rem;color:#253b55}.platform-account-toolbar input:focus,.audit-filter-grid input:focus,.audit-filter-grid select:focus,.subscription-settings-form input:focus,.subscription-settings-form select:focus,.subscription-plan-card input:focus,.subscription-new-plan input:focus,.subscription-table-toolbar input:focus,.subscription-table select:focus{outline:none;border-color:#5b8def!important;box-shadow:0 0 0 3px rgba(59,130,246,.12)!important}.platform-account-toolbar button,.audit-toolbar button,.subscription-settings-form button,.subscription-new-plan button{min-height:42px;padding:9px 15px!important}.platform-accounts-table thead th,.subscription-table thead th,.audit-history-console table thead th{font-size:.72rem;text-transform:uppercase;letter-spacing:.045em;color:#51657d;background:linear-gradient(180deg,#f7fafd,#eef3f8);padding:12px 10px}.platform-accounts-table tbody td,.subscription-table tbody td,.audit-history-console table tbody td{padding:12px 10px;border-bottom:1px solid #e8eef5}.platform-accounts-table tbody tr:hover,.subscription-table tbody tr:hover,.audit-history-console table tbody tr:hover{background:#f8fbff}.platform-logout-row{justify-content:flex-end;margin-top:18px;padding-top:16px;border-top:1px solid #dce5ee}.platform-console-tabs + .platform-property{animation:platformTabIn .22s ease}@keyframes platformTabIn{from{opacity:.65;transform:translateY(3px)}to{opacity:1;transform:none}}
.platform-support-banner{grid-column:1/-1;display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:10px 18px;background:#102b4d;color:#fff;border-bottom:3px solid #4e86d9;position:sticky;top:0;z-index:50}.platform-account-toolbar{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin:14px 0}.platform-account-toolbar label{flex:1;min-width:280px}.platform-account-toolbar input{width:100%;margin-top:6px}.platform-validity-history{margin-top:18px;padding-top:14px;border-top:1px solid #d9e1ea}.platform-validity-history .section-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.platform-accounts-table td small{display:block;color:#748196;margin-top:3px}.platform-account-actions{min-width:260px}.platform-account-actions button{margin:3px}.platform-accounts-table .validity-badge{display:inline-block;margin-top:5px}.platform-support-banner b{font-size:.86rem}
      .audit-history-console{overflow:hidden}.audit-filter-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:16px;border:1px solid #dbe5ef;border-radius:15px;background:linear-gradient(145deg,#fbfdff,#f4f8fc)}.audit-filter-grid label{display:flex;flex-direction:column;gap:6px}.audit-filter-grid label.wide{grid-column:span 2}.audit-toolbar{display:flex;gap:9px;flex-wrap:wrap;margin:12px 0}.audit-toolbar .danger{background:linear-gradient(135deg,#b42318,#d64545)!important;color:#fff!important;border-color:#b42318!important}.audit-safety-note{padding:11px 13px;border-left:4px solid #d99b28;background:#fff9ed;color:#6b5a34;border-radius:8px;margin-bottom:12px;font-size:.86rem}.audit-count-badge{padding:7px 11px;border-radius:999px;background:#eef4fb;color:#315f96;font-weight:800;font-size:.78rem}@media(max-width:1000px){.audit-filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.audit-filter-grid label.wide{grid-column:span 2}}@media(max-width:650px){.audit-filter-grid{grid-template-columns:1fr}.audit-filter-grid label.wide{grid-column:auto}.audit-toolbar button{width:100%}}.platform-console-badge{display:inline-flex;align-items:center;padding:7px 11px;border-radius:999px;background:#edf4ff;color:#315f96;font-weight:800;font-size:.78rem;border:1px solid #d3e2f7}.subscription-policy-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}.subscription-policy-card{padding:16px;border:1px solid #dbe5ef;border-radius:14px;background:linear-gradient(145deg,#fff,#f7faff);box-shadow:0 8px 18px rgba(38,56,78,.06)}.subscription-policy-card span,.subscription-policy-card small{display:block;color:#718096}.subscription-policy-card strong{display:block;font-size:1.18rem;color:#27466f;margin:5px 0}.subscription-settings-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:16px;border:1px solid #dbe5ef;border-radius:14px;background:#fbfdff}.subscription-settings-form label{display:flex;flex-direction:column;gap:6px}.subscription-settings-form button{align-self:end}.subscription-plan-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.subscription-plan-card{padding:16px;border:1px solid #dbe5ef;border-radius:15px;background:#fff;box-shadow:0 8px 20px rgba(38,56,78,.07)}.subscription-plan-card .plan-top{display:flex;justify-content:space-between;align-items:center}.subscription-plan-card .plan-top span{font-weight:850;font-size:1.1rem}.subscription-plan-card .plan-top b{font-size:.7rem;color:#237a50}.subscription-plan-card label{display:flex;align-items:center;justify-content:space-between;margin-top:9px}.subscription-plan-card input{width:120px}.subscription-plan-card small{display:block;margin-top:12px;color:#667085;line-height:1.45}.subscription-new-plan{display:grid;grid-template-columns:1fr 1fr 1.5fr 1fr 1fr auto;gap:8px;margin:14px 0;padding:12px;border:1px dashed #b9c9dc;border-radius:13px;background:#f8fbff}.subscription-table-toolbar{display:flex;gap:10px;align-items:center;margin:14px 0}.subscription-table-toolbar input{flex:1}.subscription-table td small{display:block;color:#748196;margin-top:3px}.subscription-actions{display:flex;gap:5px;flex-wrap:wrap;min-width:190px}.subscription-type,.subscription-status{display:inline-flex;padding:5px 9px;border-radius:999px;font-weight:800;font-size:.75rem}.subscription-type{background:#edf4fb;color:#315f96}.subscription-type.type-trial{background:#edf8f6;color:#237a50}.subscription-type.type-complimentary{background:#fff7e8;color:#9a6208}.subscription-status{background:#edf4fb;color:#315f96}.subscription-status.status-trial{background:#edf8f6;color:#237a50}.subscription-status.status-grace,.subscription-status.status-past_due{background:#fff7e8;color:#9a6208}.subscription-status.status-restricted,.subscription-status.status-expired,.subscription-status.status-cancelled{background:#fff0f0;color:#a33a3a}.tenant-subscription-panel{max-width:1100px}.subscription-hero-card{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:24px;border-radius:18px;background:linear-gradient(135deg,#eef5ff,#f7fbff);border:1px solid #d5e2f2}.subscription-hero-card .eyebrow{font-size:.74rem;font-weight:850;color:#6680a0;letter-spacing:.08em}.subscription-hero-card h2{margin:6px 0;font-size:1.8rem}.subscription-detail-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}.subscription-detail-grid>div{padding:15px;border:1px solid #dbe5ef;border-radius:13px;background:#fff}.subscription-detail-grid span,.subscription-detail-grid b{display:block}.subscription-detail-grid span{font-size:.8rem;color:#718096}.subscription-detail-grid b{margin-top:5px}.tenant-plan-card{display:flex;justify-content:space-between;align-items:center;padding:18px;border:1px solid #dbe5ef;border-radius:15px;background:#fff}.tenant-plan-card>div:last-child b{font-size:1.5rem;color:#315f96}.tenant-plan-card small{color:#718096;margin-left:4px}@media(max-width:1050px){.subscription-policy-grid,.subscription-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.subscription-settings-form{grid-template-columns:repeat(2,minmax(0,1fr))}.subscription-plan-grid{grid-template-columns:1fr 1fr}.subscription-new-plan{grid-template-columns:1fr 1fr 1fr}}@media(max-width:700px){.subscription-policy-grid,.subscription-detail-grid,.subscription-settings-form,.subscription-plan-grid,.subscription-new-plan{grid-template-columns:1fr}.subscription-table-toolbar{flex-direction:column;align-items:stretch}.subscription-hero-card,.tenant-plan-card{align-items:flex-start;flex-direction:column}}.platform-support-banner span{font-weight:700;color:#dbeafe}.platform-support-banner small{opacity:.9}.platform-support-banner button{margin-left:auto!important;background:#fff!important;color:#1e3a5f!important;border:1px solid #cbd5e1!important;min-height:36px!important;padding:7px 12px!important}@media(max-width:900px){.platform-console-tabs{grid-template-columns:repeat(2,minmax(0,1fr));position:relative;top:0}.platform-account-toolbar{grid-template-columns:1fr}.platform-property{padding:18px!important}}@media(max-width:560px){.platform-console-tabs{grid-template-columns:1fr}.platform-console-tabs button{min-height:58px}.platform-console-tabs button small{display:none}}@media(max-width:900px){.shell{grid-template-columns:1fr}.sidebar{position:relative;height:auto}.platform-support-banner{position:relative}.platform-support-banner button{margin-left:0!important}}
      .main label:has(input[required])::before,.main label:has(select[required])::before,.main label:has(textarea[required])::before,.auth-card label:has(input[required])::before,.auth-card label:has(select[required])::before{content:'*';color:#c62828;font-weight:900;margin-right:4px}
      input[type="checkbox"]{width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;max-width:16px!important;max-height:16px!important;flex:0 0 16px!important;accent-color:#2f6fed!important;margin:0!important;padding:0!important;vertical-align:middle!important;box-sizing:border-box!important;}.checkbox-inline,.remember-login{display:inline-flex!important;align-items:center!important;gap:8px!important}
      .panel,.form-panel,.table-panel,.period-panel,.water-box{border:1px solid var(--line);box-shadow:0 10px 26px rgba(51,65,85,.06);border-radius:16px;background:rgba(255,255,255,.92)}
      button,.button-link{border-radius:10px!important;transition:transform .18s ease,box-shadow .18s ease,filter .18s ease!important;box-shadow:0 5px 14px rgba(59,104,184,.14)} button:hover:not(:disabled),.button-link:hover{transform:translateY(-2px);filter:brightness(1.03);box-shadow:0 9px 20px rgba(59,104,184,.20)}
      .sidebar button{border-radius:10px!important;margin:3px 6px;width:calc(100% - 12px);text-align:left}.sidebar button.active{background:linear-gradient(90deg,#3d67b4,#527bc8)!important;color:#fff;box-shadow:0 8px 18px rgba(26,53,104,.35)}
      .premium-kpis{gap:20px}.dashboard-kpis{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:14px!important;align-items:stretch!important}.dashboard-kpis .kpi-card{min-width:0!important}.kpi-card{position:relative;overflow:hidden;min-height:128px;border-left:5px solid var(--accent);background:linear-gradient(135deg,var(--soft),#fff)!important;box-shadow:0 10px 24px rgba(51,65,85,.10)}.kpi-card .value{font-size:2.05rem;font-weight:800;color:#344054;position:relative;z-index:2}.kpi-card .label{position:relative;z-index:2;font-weight:700}.kpi-glow{position:absolute;width:110px;height:110px;border-radius:50%;right:-35px;bottom:-45px;background:var(--accent);opacity:.10}.kpi-1{--accent:#6b4e9b;--soft:#f3effa}.kpi-2{--accent:#19726a;--soft:#edf8f6}.kpi-3{--accent:#315f96;--soft:#eef4fb}.kpi-4{--accent:#b47712;--soft:#fff7e8}.kpi-5{--accent:#2e7d4e;--soft:#eef9f1}.kpi-6{--accent:#7b5ea7;--soft:#f5f1fb}
      .two-donuts{grid-template-columns:repeat(2,minmax(0,1fr));gap:26px}.premium-donut-panel{min-height:470px;padding:26px}.premium-donut-panel h2{margin:0 0 16px}.premium-donut-row{display:flex;align-items:center;justify-content:center;gap:38px;min-height:380px}.premium-donut-chart{width:330px;height:330px;border-radius:50%;position:relative;box-shadow:inset 0 0 0 1px rgba(255,255,255,.6)}.premium-hole{position:absolute;inset:88px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-shadow:0 2px 18px rgba(15,23,42,.08)}.premium-hole strong{font-size:1.35rem}.premium-hole span{font-size:.85rem;color:#64748b;margin-top:5px}.premium-legend{display:grid;gap:13px;min-width:170px}.premium-legend div{display:grid;grid-template-columns:14px 1fr auto;align-items:center;gap:9px}.premium-legend span{width:14px;height:14px;border-radius:3px}.premium-legend b{font-weight:600}.premium-legend small{color:#64748b;font-weight:700}
      .auth-widget,.auth-card,.platform-card{box-shadow:0 14px 34px rgba(51,65,85,.12)}
      /* V6.2.1 — Global ApartCare action-button standard: primary actions match Login */
      .main button:not(.secondary):not(.danger):not(.password-toggle):not(.eye-toggle):not(.category-chips button):not(.report-tabs button){
        background:linear-gradient(135deg,#2f6fed,#2859c7)!important;color:#fff!important;border:1px solid #285dcc!important;
        min-height:40px!important;padding:9px 15px!important;border-radius:10px!important;font-weight:800!important;font-family:inherit!important;
        line-height:1.15!important;box-shadow:0 7px 16px rgba(47,111,237,.20)!important;cursor:pointer!important;
      }
      .main button:not(.secondary):not(.danger):not(.password-toggle):not(.eye-toggle):not(.category-chips button):not(.report-tabs button):hover:not(:disabled){transform:translateY(-1px)!important;filter:brightness(1.02)!important}
      .main button.secondary{background:#fff!important;color:#315f96!important;border:1px solid #c9d7e8!important;min-height:40px!important;padding:9px 15px!important;border-radius:10px!important;font-weight:800!important;box-shadow:0 4px 10px rgba(51,65,85,.08)!important}
      .main button.danger{background:linear-gradient(135deg,#dc4b4b,#c93d3d)!important;color:#fff!important;border:1px solid #c83b3b!important;min-height:40px!important;padding:9px 15px!important;border-radius:10px!important;font-weight:800!important;box-shadow:0 7px 16px rgba(201,61,61,.18)!important}
      .main button:disabled{opacity:.62!important;box-shadow:none!important;transform:none!important}

      /* V6.1.9 — Uniform professional action buttons and authentication navigation */
      .auth-primary-button,.auth-secondary-button,.auth-back-button{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;min-height:40px!important;padding:9px 15px!important;border-radius:10px!important;font-weight:800!important;font-family:inherit!important;line-height:1.15!important;cursor:pointer!important;transition:transform .16s ease,box-shadow .16s ease,filter .16s ease,background .16s ease!important}
      .auth-primary-button{background:linear-gradient(135deg,#2f6fed,#2859c7)!important;color:#fff!important;border:1px solid #285dcc!important;box-shadow:0 7px 16px rgba(47,111,237,.20)!important}.password-update-button{pointer-events:auto!important;opacity:1!important;position:relative;z-index:20!important;user-select:none!important}
      .auth-secondary-button{background:#fff!important;color:#315f96!important;border:1px solid #c9d7e8!important;box-shadow:0 4px 10px rgba(51,65,85,.08)!important}
      .auth-back-button{background:#f7f9fc!important;color:#526174!important;border:1px solid #c9d7e8!important;box-shadow:0 4px 10px rgba(51,65,85,.06)!important}
      .auth-primary-button:hover,.auth-secondary-button:hover,.auth-back-button:hover{transform:translateY(-1px)!important;filter:brightness(1.02)!important}
      .auth-navigation{display:flex;align-items:center;gap:10px;margin-top:12px}
      .auth-card>.auth-links{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:10px!important}
      .auth-card>.auth-links>*{margin:0!important}
      .auth-card .link-button{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:40px!important;padding:9px 15px!important;border-radius:10px!important;background:#fff!important;color:#315f96!important;border:1px solid #c9d7e8!important;font-weight:800!important;font-family:inherit!important;line-height:1.15!important;box-shadow:0 4px 10px rgba(51,65,85,.08)!important;cursor:pointer!important}
      .auth-card .link-button:hover{transform:translateY(-1px)!important;background:#f7faff!important}
      .main button:not(.password-toggle):not(.eye-toggle){font-family:inherit!important;font-weight:750!important;letter-spacing:.005em}
      .auth-card .form-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.auth-card .form-actions button{margin:0!important}
      .auth-card input[type="checkbox"]{width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;accent-color:#2f6fed;box-shadow:none!important;padding:0!important}
      .auth-card .remember-login{display:flex;align-items:center;gap:8px}.auth-card .remember-login span{line-height:1.35}
      .auth-card .platform-link{margin:0!important}.auth-card .auth-back-button{font-size:.9rem}.auth-card button:disabled{cursor:not-allowed;transform:none!important;filter:none!important;opacity:.65}
.report-tabs button,.category-chips button{padding:10px 14px}.report-tabs button.active,.category-chips button.active{background:linear-gradient(135deg,#3b68b8,#5c84cf);color:#fff}

      .report-hero{padding:24px 0 10px}.report-hero h2{font-size:1.7rem;margin:0 0 6px}.report-hero p{margin:0;color:#64748b}.report-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px;margin:18px 0 22px}.report-kpi{border:1px solid var(--line);border-top:5px solid var(--accent);background:linear-gradient(145deg,var(--soft),#fff);border-radius:16px;padding:18px;min-height:112px;box-shadow:0 10px 24px rgba(51,65,85,.07)}.report-kpi span{display:block;font-size:.82rem;color:#64748b;margin-bottom:14px}.report-kpi b{font-size:1.55rem;color:#344054}.report-kpi.positive b{color:#247148}.report-kpi.negative b{color:#b42318}.report-kpi.open{--accent:#6b4e9b;--soft:#f3effa}.report-kpi.collected{--accent:#315f96;--soft:#eef4fb}.report-kpi.expenses{--accent:#b47712;--soft:#fff7e8}.report-kpi.diff{--accent:#2e7d4e;--soft:#eef9f1}.report-kpi.closing{--accent:#7b5ea7;--soft:#f5f1fb}.report-analytics{display:grid;grid-template-columns:1.25fr 1fr;gap:20px;margin:18px 0}.report-analytics-single{grid-template-columns:1fr}.report-chart-card{border:1px solid var(--line);border-radius:18px;background:#fff;padding:20px;box-shadow:0 10px 24px rgba(51,65,85,.06)}.chart-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.chart-head h3{margin:0 0 5px}.chart-head p{margin:0;color:#64748b;font-size:.88rem}.chart-key{display:flex;gap:12px;font-size:.82rem}.chart-key span{display:flex;align-items:center;gap:5px}.key{width:11px;height:11px;border-radius:3px;display:inline-block}.key.collected{background:#4f79a8}.key.expenses{background:#e2a124}.bar-chart{height:280px;display:flex;align-items:flex-end;gap:8px;padding:28px 4px 0;border-bottom:1px solid #d8e1eb}.bar-group{height:100%;flex:1;min-width:28px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:7px}.bar-values{height:32px;display:flex;flex-direction:column;align-items:center;font-size:.65rem;color:#64748b;white-space:nowrap}.bars{height:205px;display:flex;align-items:flex-end;gap:4px}.bar{width:13px;min-height:4px;border-radius:6px 6px 2px 2px}.bar.collected{background:#4f79a8}.bar.expenses{background:#e2a124}.bar-group>b{font-size:.72rem;color:#64748b}.balance-chart{height:280px;padding-top:18px}.balance-chart svg{height:210px;width:100%;overflow:visible}.chart-axis{stroke:#cbd5e1;stroke-width:.7}.balance-line{stroke:#3b68b8;stroke-width:2.2;vector-effect:non-scaling-stroke}.balance-point{fill:#3b68b8;stroke:#fff;stroke-width:.8}.trend-labels.compact{grid-template-columns:repeat(6,1fr);font-size:.68rem}.report-expense-donut{grid-column:1/-1}.report-donut-wrap{display:flex;align-items:center;justify-content:center;gap:34px;padding:18px 0}.report-donut{width:230px;height:230px;border-radius:50%;position:relative}.report-donut>div{position:absolute;inset:58px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.report-donut b{font-size:1.05rem}.report-donut span{font-size:.72rem;color:#64748b;margin-top:5px}.report-month-legend{display:grid;grid-template-columns:repeat(2,minmax(170px,1fr));gap:9px}.report-month-legend div{display:grid;grid-template-columns:12px 1fr auto;gap:8px;align-items:center;font-size:.82rem}.report-month-legend i{width:12px;height:12px;border-radius:3px}.report-financial-table tfoot{background:#eef4fb}.report-financial-table .positive{color:#247148}.report-financial-table .negative{color:#b42318}.report-financial-table td,.report-financial-table th{text-align:right}.report-financial-table td:first-child,.report-financial-table th:first-child{text-align:left}.individual-history-table{margin-top:14px}.individual-history-table tfoot{background:#dfe7f1}.individual-history-table th,.individual-history-table td{white-space:nowrap}.individual-history-kpis{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;width:100%;gap:18px;margin-top:18px}.individual-history-kpis .kpi-card{padding:18px}.individual-history-kpis .kpi-card span{display:block;font-size:.88rem;color:#64748b;margin-bottom:10px}.individual-history-kpis .kpi-card strong{font-size:2rem;color:#344054}.individual-history-kpis .accent-blue{--accent:#315f96;--soft:#eef4fb}.individual-history-kpis .accent-green{--accent:#2e7d4e;--soft:#eef9f1}.individual-history-kpis .accent-amber{--accent:#b47712;--soft:#fff7e8}.status-paid,.status-pending{display:inline-flex;align-items:center;border-radius:999px;padding:4px 10px;font-size:.8rem;font-weight:800}.status-paid{background:#e9f7ef;color:#247148}.status-pending{background:#fff4e5;color:#a85f00}@media(max-width:760px){.individual-history-kpis{grid-template-columns:1fr!important}}@media(max-width:1150px){.report-kpis{grid-template-columns:repeat(3,1fr)}.report-analytics{grid-template-columns:1fr}.report-expense-donut{grid-column:auto}}@media(max-width:700px){.report-kpis{grid-template-columns:1fr 1fr}.report-month-legend{grid-template-columns:1fr}.report-donut-wrap{flex-direction:column}.bar-values{display:none}}
      /* V6.1.3 professional KPI and expense analytics visual system */
      :root{--business-ink:#27364a;--business-muted:#64748b;--business-blue:#2f6fb0;--business-teal:#17806f;--business-amber:#c68112;--business-purple:#7657a7;--business-green:#277b4c}
      body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;letter-spacing:.01em}.main h1,.main h2,.main h3{color:#334155;letter-spacing:.015em}.main h1{font-weight:800}.main h2{font-weight:750}.label{color:#526174;font-weight:700;letter-spacing:.02em}.value{font-weight:800;color:#27364a}
      .expense-kpis,.summary-grid{gap:18px}.expense-kpis .card,.summary-grid .card,.kpi-grid .card{position:relative;overflow:hidden;min-height:118px;border:1px solid #d7e0ea;border-radius:16px;background:linear-gradient(145deg,#fff,#f5f8fc)!important;box-shadow:0 10px 24px rgba(40,56,76,.08);padding:18px 20px}.expense-kpis .card:after,.summary-grid .card:after,.kpi-grid .card:after{position:absolute;right:16px;top:13px;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-size:20px;background:rgba(47,111,176,.10);box-shadow:inset 0 0 0 1px rgba(47,111,176,.08)}
      .expense-kpis .card:nth-child(1):after,.summary-grid .card:nth-child(1):after,.kpi-grid .card:nth-child(1):after{content:'💰'}.expense-kpis .card:nth-child(2):after,.summary-grid .card:nth-child(2):after,.kpi-grid .card:nth-child(2):after{content:'📋';background:rgba(23,128,111,.10)}.expense-kpis .card:nth-child(3):after,.summary-grid .card:nth-child(3):after,.kpi-grid .card:nth-child(3):after{content:'📅';background:rgba(198,129,18,.12)}.expense-kpis .card:nth-child(4):after,.summary-grid .card:nth-child(4):after,.kpi-grid .card:nth-child(4):after{content:'📊';background:rgba(118,87,167,.10)}.expense-kpis .card:nth-child(5):after,.summary-grid .card:nth-child(5):after,.kpi-grid .card:nth-child(5):after{content:'🏦';background:rgba(39,123,76,.10)}
      .expense-kpis .value,.summary-grid .value,.kpi-grid .value{font-size:2rem!important;line-height:1.15}.expense-kpis .label,.summary-grid .label,.kpi-grid .label{padding-right:52px;font-size:.86rem}
      .kpi-card:before,.report-kpi:after{position:absolute;right:16px;top:14px;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-size:18px;background:rgba(255,255,255,.62);box-shadow:0 5px 14px rgba(51,65,85,.07)}.kpi-card:before{content:'📊';z-index:2}.kpi-1:before{content:'🏦'}.kpi-2:before{content:'🧾'}.kpi-3:before{content:'💳'}.kpi-4:before{content:'💸'}.kpi-5:before{content:'📈'}.kpi-6:before{content:'💰'}
      .report-kpi{position:relative;overflow:hidden}.report-kpi.open:after{content:'🏦'}.report-kpi.collected:after{content:'💳'}.report-kpi.expenses:after{content:'💸'}.report-kpi.diff:after{content:'📈'}.report-kpi.closing:after{content:'💰'}
      .expense-trend-card{border:1px solid #d9e3ee;border-radius:18px;background:linear-gradient(180deg,#fff,#f8fbfe);box-shadow:0 14px 32px rgba(42,58,79,.08);padding:20px 22px 16px;margin:12px 0 24px}.expense-trend-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:16px}.trend-title{font-size:1.05rem;font-weight:800;color:#27364a}.chart-caption{color:#718096;font-size:.86rem;margin-top:4px}.trend-total{font-size:1.35rem;font-weight:850;color:#2f6fb0;text-align:right}.trend-total small{display:block;font-size:.72rem;font-weight:700;color:#718096;margin-top:3px}.expense-chart-frame{height:330px;display:grid;grid-template-columns:72px 1fr;gap:10px}.expense-y-scale{display:flex;flex-direction:column;justify-content:space-between;padding:4px 0 28px;color:#728096;font-size:.74rem;text-align:right}.expense-svg-wrap{position:relative;min-width:0;padding-bottom:28px}.expense-svg-wrap svg{width:100%;height:100%;display:block;overflow:visible}.expense-grid-line{stroke:#dfe7f0;stroke-width:.55}.expense-trend-line{stroke:#2f6fb0;stroke-width:1.05;vector-effect:non-scaling-stroke;filter:drop-shadow(0 3px 3px rgba(47,111,176,.15))}.expense-trend-point{fill:#2f6fb0;stroke:#fff;stroke-width:.65;vector-effect:non-scaling-stroke}.expense-months{position:absolute;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(12,1fr);font-size:.72rem;color:#6b7788;text-align:center}.expense-trend-card:hover .expense-trend-point{fill:#17806f}
      @media(max-width:760px){.expense-chart-frame{height:260px;grid-template-columns:48px 1fr}.expense-y-scale{font-size:.64rem}.expense-months{font-size:.62rem}.expense-trend-head{align-items:flex-start}.trend-total{font-size:1.05rem}}
      @media(max-width:1000px){.two-donuts{grid-template-columns:1fr}.premium-donut-row{flex-direction:column}.premium-donut-chart{width:280px;height:280px}.premium-hole{inset:74px}}
      /* V6.1.4 — Compact, consistent KPI cards across every ApartCare module */
      .kpis,.premium-kpis,.summary-grid,.expense-kpis,.report-kpis,.individual-history-kpis{align-items:stretch}
      .kpis,.premium-kpis{gap:14px}
      .kpi-card,.summary-grid .card,.expense-kpis .card,.kpi-grid .card,.report-kpi{
        min-height:96px!important;height:96px;box-sizing:border-box;border-radius:14px!important;
        padding:14px 16px!important;box-shadow:0 7px 18px rgba(40,56,76,.08)!important
      }
      .kpi-card{border-left-width:4px!important}
      .summary-grid .card,.expense-kpis .card,.kpi-grid .card{border-top:4px solid rgba(47,111,176,.48)}
      .summary-grid .card:nth-child(2),.expense-kpis .card:nth-child(2),.kpi-grid .card:nth-child(2){border-top-color:rgba(23,128,111,.58)}
      .summary-grid .card:nth-child(3),.expense-kpis .card:nth-child(3),.kpi-grid .card:nth-child(3){border-top-color:rgba(198,129,18,.62)}
      .summary-grid .card:nth-child(4),.expense-kpis .card:nth-child(4),.kpi-grid .card:nth-child(4){border-top-color:rgba(118,87,167,.60)}
      .summary-grid .card:nth-child(5),.expense-kpis .card:nth-child(5),.kpi-grid .card:nth-child(5){border-top-color:rgba(39,123,76,.62)}
      .kpi-card .label,.summary-grid .label,.expense-kpis .label,.kpi-grid .label,.report-kpi span,.individual-history-kpis .kpi-card span{
        font-size:.78rem!important;line-height:1.2!important;font-weight:700!important;color:#5c6878!important;
        margin-bottom:7px!important;padding-right:42px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis
      }
      .kpi-card .value,.summary-grid .value,.expense-kpis .value,.kpi-grid .value{
        font-size:1.55rem!important;line-height:1.08!important;font-weight:850!important;color:#2e3b4e!important
      }
      .individual-history-kpis .kpi-card strong{font-size:1.55rem!important;line-height:1.08!important;font-weight:850!important}
      .report-kpi b{font-size:1.55rem!important;line-height:1.08!important;display:block;padding-right:42px}
      .kpi-card:before,.report-kpi:after{width:32px!important;height:32px!important;right:12px!important;top:12px!important;border-radius:10px!important;font-size:16px!important}
      .expense-kpis .card:after,.summary-grid .card:after,.kpi-grid .card:after{width:32px!important;height:32px!important;right:12px!important;top:11px!important;border-radius:10px!important;font-size:16px!important}
      .kpi-glow{width:82px!important;height:82px!important;right:-28px!important;bottom:-38px!important}
      .report-kpis{gap:12px!important;margin:14px 0 18px!important}
      .report-kpi{min-height:96px!important}
      .individual-history-kpis{gap:12px!important;margin-top:14px!important}
      .individual-history-kpis .kpi-card{padding:14px 16px!important}
      .summary-grid,.expense-kpis{gap:12px!important}
      .expense-kpis .card,.summary-grid .card,.kpi-grid .card{min-height:96px!important}
      .water-summary-grid .card{height:96px!important}
      @media(min-width:1150px){.kpis.premium-kpis{grid-auto-rows:96px}.summary-grid,.expense-kpis{grid-auto-rows:96px}}
      @media(max-width:900px){.kpi-card,.summary-grid .card,.expense-kpis .card,.kpi-grid .card,.report-kpi{height:auto;min-height:92px!important}.kpi-card .label,.summary-grid .label,.expense-kpis .label,.kpi-grid .label,.report-kpi span{white-space:normal}.report-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
      @media(max-width:560px){.report-kpis{grid-template-columns:1fr!important}.kpi-card .value,.summary-grid .value,.expense-kpis .value,.kpi-grid .value,.report-kpi b,.individual-history-kpis .kpi-card strong{font-size:1.38rem!important}}

      /* V6.1.5 — Professional Expense workspace and consistent business buttons */
      .main button:not(.secondary):not(.password-toggle):not(.category-chips button):not(.report-tabs button){
        background:linear-gradient(135deg,#315f96,#4d78bd)!important;color:#fff!important;border:1px solid #315f96!important;font-weight:800!important;letter-spacing:.01em
      }
      .main button.secondary{background:linear-gradient(180deg,#fff,#f3f6fa)!important;color:#334155!important;border:1px solid #cbd7e5!important;font-weight:750!important}
      .main button:disabled{opacity:.62!important;box-shadow:none!important;transform:none!important}
      .professional-expense-form{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px 20px!important;padding:20px!important;border:1px solid #dbe4ee;border-radius:18px;background:linear-gradient(145deg,#fff,#f7faff)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.8)}
      .professional-expense-form label{position:relative;display:flex!important;flex-direction:column;gap:8px;font-weight:750!important;color:#445468!important;min-width:0;padding-top:2px}
      .professional-expense-form label:before{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;margin-bottom:1px;background:#eef4fb;font-size:14px;box-shadow:inset 0 0 0 1px rgba(49,95,150,.08)}
      .professional-expense-form label:nth-child(1):before{content:'📅'}.professional-expense-form label:nth-child(2):before{content:'🏷️';background:#edf8f6}.professional-expense-form label:nth-child(3):before{content:'💰';background:#fff7e8}.professional-expense-form label:nth-child(4):before{content:'💳';background:#f4f0fb}.professional-expense-form label:nth-child(5):before{content:'📝';background:#eef4fb}.professional-expense-form label:nth-child(6):before{content:'🔖';background:#edf8f6}.professional-expense-form label:nth-child(7):before{content:'💬';background:#fff7e8}.professional-expense-form label:nth-child(8):before{content:'📎';background:#f4f0fb}
      .professional-expense-form input,.professional-expense-form select{width:100%;box-sizing:border-box;min-height:46px!important;border:1px solid #cfd9e5!important;border-radius:11px!important;background:#fff!important;padding:10px 12px!important;font-size:.95rem!important;color:#334155!important;box-shadow:0 4px 12px rgba(51,65,85,.04)}
      .professional-expense-form input:focus,.professional-expense-form select:focus{outline:none;border-color:#4d78bd!important;box-shadow:0 0 0 3px rgba(77,120,189,.12)!important}
      .professional-expense-form input[type="file"]{min-height:72px!important;padding:12px!important;border-style:dashed!important;background:linear-gradient(180deg,#fbfdff,#f4f8fc)!important}
      .professional-expense-form label.wide{grid-column:span 2}.professional-expense-form .form-actions{grid-column:1/-1;display:flex;justify-content:flex-start;gap:12px;padding-top:6px;border-top:1px solid #e2e8f0;margin-top:4px}.professional-expense-form .form-actions button{min-height:46px;padding:0 22px!important;border-radius:12px!important}
      .expense-form + .message{margin-top:14px}.expense-period-options{display:inline-flex!important;align-items:center;gap:8px;padding:7px;border:1px solid #d8e2ec;border-radius:13px;background:#fff;box-shadow:0 6px 16px rgba(51,65,85,.05);margin-bottom:16px}.expense-period-options .radio{padding:8px 14px;border-radius:9px;font-weight:750;color:#526174;transition:.18s ease}.expense-period-options .radio:has(input:checked){background:#edf4fc;color:#315f96}.expense-period-options input{accent-color:#315f96}
      .expense-kpis .card:nth-child(1){background:linear-gradient(145deg,#fff,#fff7e8)!important}.expense-kpis .card:nth-child(2){background:linear-gradient(145deg,#fff,#edf8f6)!important}.expense-kpis .card:nth-child(3){background:linear-gradient(145deg,#fff,#eef4fb)!important}.expense-kpis .card:nth-child(4){background:linear-gradient(145deg,#fff,#f4f0fb)!important}.panel .section-title-row h2{font-size:1.35rem}
      @media(max-width:1050px){.professional-expense-form{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:650px){.professional-expense-form{grid-template-columns:1fr!important;padding:14px!important}.professional-expense-form label.wide{grid-column:auto}.professional-expense-form .form-actions{grid-column:auto}.professional-expense-form .form-actions button{width:100%}}

      /* V6.1.6 — Standardized professional workspace across all modules */
      .main{padding-bottom:42px}.page-title-row,.section-title-row,.month-heading{position:relative}
      .main h1{font-size:2rem!important;line-height:1.15}.main h2{font-size:1.32rem!important}.subtitle{color:#6b7788!important;font-weight:500!important}
      .panel,.form-panel,.table-panel{background:linear-gradient(180deg,#ffffff 0%,#fbfcfe 100%)!important;border-color:#d6e0eb!important}
      .main input,.main select,.main textarea{border:1px solid #cbd7e5!important;border-radius:10px!important;background:#fff!important;color:#334155!important;min-height:40px;transition:border-color .18s ease,box-shadow .18s ease,background .18s ease}
      .main input:focus,.main select:focus,.main textarea:focus{border-color:#3b68b8!important;box-shadow:0 0 0 3px rgba(59,104,184,.12)!important;outline:none!important}
      .main label{color:#4b5a6d;font-weight:700}.main table{border-radius:14px;overflow:hidden}.main table thead th{background:linear-gradient(180deg,#eef3f8,#e5ecf4)!important;color:#344054!important;font-weight:800!important}.main table tbody tr:nth-child(even){background:rgba(244,247,251,.7)}.main table tbody tr:hover{background:#eef5fc!important}
      .main .formula,.main .help-text{padding:10px 13px;border-left:3px solid #5b7fba;background:#f6f9fd;border-radius:8px;color:#64748b}
      .main button{min-height:38px;padding:8px 14px!important}.main .form-actions button{min-height:44px}.lock-note{display:inline-flex;align-items:center;padding:7px 10px;border-radius:9px;background:#f2f4f7;color:#667085;font-size:.82rem;font-weight:700}
      .attachment-field{padding:14px!important;border:1px dashed #b9c9dc;border-radius:13px;background:linear-gradient(145deg,#fbfdff,#f3f7fc)}.attachment-selected{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;padding:9px 10px;border-radius:9px;background:#edf7f2;color:#246b48}.attachment-remove{white-space:nowrap!important;min-height:34px!important;padding:6px 10px!important}
      .expense-kpis,.summary-grid,.kpi-grid{align-items:stretch}.expense-kpis .card,.summary-grid .card,.kpi-grid .card{border:1px solid #d7e1ec!important;box-shadow:0 8px 20px rgba(38,56,78,.08)!important}.expense-kpis .card:hover,.summary-grid .card:hover,.kpi-grid .card:hover,.kpi-card:hover,.report-kpi:hover{transform:translateY(-2px);box-shadow:0 14px 28px rgba(38,56,78,.12)!important}
      @media(max-width:700px){.attachment-selected{align-items:flex-start;flex-direction:column}.attachment-remove{width:100%}.main h1{font-size:1.65rem!important}}

      /* V6.1.7 — unified compact controls, month selectors and safe login remember UX */
      .main input[type=checkbox],.main input[type=radio],.auth-card input[type=checkbox],.auth-card input[type=radio]{width:16px!important;height:16px!important;min-height:16px!important;max-width:16px!important;max-height:16px!important;accent-color:#2563eb;box-shadow:none!important;border-radius:3px!important;vertical-align:middle!important}
.main input[type="checkbox"],.main input[type="radio"],.checkbox-label input[type="checkbox"],.checkbox-inline input[type="checkbox"],.remember-login input[type="checkbox"]{width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;max-width:16px!important;max-height:16px!important;inline-size:16px!important;block-size:16px!important;flex:0 0 16px!important;transform:none!important;zoom:1!important;scale:1!important;appearance:auto!important;-webkit-appearance:auto!important;padding:0!important;margin:0!important;box-sizing:border-box!important;border-radius:3px!important;vertical-align:middle!important}
      .checkbox-label,.checkbox-inline,.remember-login{display:inline-flex!important;align-items:center!important;gap:8px!important;min-height:24px!important}.remember-login{margin-top:2px;color:#475467;font-weight:700}.remember-login input{flex:0 0 16px}
      .remember-note{font-size:.76rem;color:#7a8696;background:#f7f9fc;border-left:3px solid #c7d4e5;padding:8px 10px;border-radius:7px;margin-top:-4px}
      .standard-month-field{display:flex!important;flex-direction:column!important;gap:7px!important;color:#4b5a6d!important;font-weight:700!important}.standard-month-field input[type=month],.month-selector input[type=month],.selector-row input[type=month]{min-width:188px!important;width:188px!important;height:50px!important;min-height:50px!important;padding:0 14px!important;border:1px solid #cbd7e5!important;border-radius:13px!important;background:#fff!important;font-size:1rem!important;color:#475467!important;box-shadow:0 3px 10px rgba(38,56,78,.04)!important}.standard-month-field input[type=month]:focus,.month-selector input[type=month]:focus,.selector-row input[type=month]:focus{border-color:#3b68b8!important;box-shadow:0 0 0 3px rgba(59,104,184,.10)!important}
      .selector-row{display:flex;flex-direction:column;align-items:flex-start;gap:7px}.month-selector{display:flex;flex-direction:column;align-items:flex-start;gap:7px}.inline-month{display:flex;align-items:flex-start!important;gap:8px!important}.inline-month span{font-weight:700;color:#4b5a6d;padding-top:14px}
      .account-id-preview{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 14px;border:1px solid #d7e1ec;border-radius:11px;background:#f7faff;color:#475467}.account-id-preview b{color:#315f96;font-size:1.02rem}
      .kpi-card,.report-kpi,.expense-kpis .card,.summary-grid .card{min-height:112px}.kpi-card .value,.report-kpi b{letter-spacing:-.02em}
      @media(max-width:700px){.standard-month-field input[type=month],.month-selector input[type=month],.selector-row input[type=month]{width:100%!important;min-width:0!important}.inline-month{width:100%}}

      .professional-upload{display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:12px;padding:14px 16px!important;border:1px solid #d4deea!important;border-radius:13px!important;background:linear-gradient(145deg,#fbfdff,#f4f7fb)!important}.upload-widget-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:10px;background:#eaf2fb;font-size:1.1rem}.upload-widget-copy{display:flex;flex-direction:column;gap:4px}.upload-widget-copy b{color:#344054}.upload-widget-copy small{color:#7a8696}.upload-button{display:inline-flex!important;align-items:center;justify-content:center;min-height:38px!important;padding:8px 14px!important;border-radius:9px!important;background:#eef4fb!important;color:#315f96!important;border:1px solid #c8d7e8!important;font-weight:800!important;cursor:pointer!important}.upload-button input[type=file]{display:none!important}.professional-upload .apartment-profile-photo{grid-column:1/-1;max-width:180px;max-height:100px;object-fit:cover;border-radius:10px;border:1px solid #d4deea}.admin-unlock{border-color:#d5a35b!important;color:#8a5a08!important;background:#fff8e8!important}
      .main input[type=number]{font-variant-numeric:tabular-nums}.main input[type=checkbox],.main input[type=radio]{appearance:auto!important;-webkit-appearance:auto!important}

      /* V6.1.8 — polished authentication navigation and controlled Go-Live versioning */
      .auth-card{position:relative}.auth-links{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:10px!important;margin-top:18px!important}.auth-secondary-link,.auth-create-link,.platform-link{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:40px!important;padding:8px 14px!important;border:1px solid #d3deeb!important;border-radius:10px!important;background:#fff!important;color:#315f96!important;font-weight:800!important;text-decoration:none!important}.auth-create-link{background:linear-gradient(135deg,#eef5ff,#f7fbff)!important;border-color:#b9cee7!important}.platform-link{background:linear-gradient(135deg,#f5f1fb,#fbf9ff)!important;color:#654a91!important;border-color:#d5c8e8!important}.auth-back-button{display:inline-flex!important;align-items:center!important;justify-content:center!important;margin-top:12px!important;min-height:38px!important;padding:8px 13px!important;border:1px solid #d3deeb!important;border-radius:10px!important;background:#f7f9fc!important;color:#526174!important;font-weight:750!important;box-shadow:none!important}.auth-back-button:hover{background:#eef4fb!important;color:#315f96!important;transform:none!important;box-shadow:none!important}.golive-panel{padding:22px!important}.golive-panel .section-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}.lock-badge{display:inline-flex;align-items:center;white-space:nowrap;padding:8px 12px;border-radius:999px;font-size:.82rem;font-weight:800}.lock-badge.is-locked{background:#edf7f0;color:#247148;border:1px solid #cbe7d4}.lock-badge.is-open{background:#fff7e8;color:#8a5a08;border:1px solid #efd49c}.golive-current{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:16px 0}.golive-current>div{padding:13px 15px;border:1px solid #dce4ed;border-radius:12px;background:linear-gradient(145deg,#fbfdff,#f4f7fb)}.golive-current span{display:block;color:#7a8696;font-size:.76rem;font-weight:700;margin-bottom:5px}.golive-current b{font-size:1.05rem;color:#344054}.golive-form{margin-top:8px}.golive-history-head{display:flex;justify-content:space-between;align-items:center;margin-top:22px}.golive-history-head h3{margin:0}.golive-history-head span{font-size:.78rem;color:#7a8696}.golive-history{display:grid;gap:7px}.golive-history>div{display:grid;grid-template-columns:180px 1fr 110px 130px;gap:12px;align-items:center;padding:10px 12px;border:1px solid #e0e6ed;border-radius:9px;background:#fbfcfe;font-size:.84rem}.golive-history>div b{color:#315f96}.golive-history>div strong{text-align:right;color:#344054}@media(max-width:760px){.golive-panel .section-title-row,.golive-history-head{flex-direction:column}.golive-current{grid-template-columns:1fr}.golive-history>div{grid-template-columns:1fr;gap:4px}.golive-history>div strong{text-align:left}.auth-links{flex-direction:column;align-items:stretch!important}.auth-links>*{width:100%!important}.auth-back-button{width:100%!important}}

      .utility-panel{padding:22px}.utility-category-editor{display:flex;gap:10px;align-items:center;margin:14px 0}.utility-category-editor input{flex:1}.utility-category-list{display:grid;gap:8px;margin-bottom:18px}.utility-category-row{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:10px 12px;border:1px solid #d9e1ea;border-radius:10px;background:#f8fafc}.utility-category-row.inactive{opacity:.65}.utility-category-row>span:first-child{font-weight:700}.utility-category-row>span:nth-child(2){font-size:.82rem;color:#64748b}.utility-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.utility-form label{display:grid;gap:8px;font-weight:600;color:#475569}.utility-form .form-actions{grid-column:1/-1}.utility-form input:disabled,.utility-form select:disabled{opacity:.8;cursor:not-allowed;background:#eef2f7}.utility-contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.utility-contact-card,.utility-watchman-card{display:flex;align-items:center;gap:14px;border:1px solid #d9e1ea;border-radius:14px;padding:16px;background:linear-gradient(135deg,#fff,#f8fafc);box-shadow:0 7px 18px rgba(51,65,85,.06)}.utility-icon,.utility-card-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#eef4fb;font-size:1.45rem;flex:0 0 auto}.utility-card-body{flex:1;min-width:0}.utility-category{font-size:.78rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#64748b}.utility-contact-card h3{margin:3px 0 5px;color:#26364d}.utility-mobile{font-weight:700;color:#315f96}.utility-contact-card p{margin:6px 0 0;color:#64748b;font-size:.9rem}.utility-watchman-card{margin-bottom:16px;background:linear-gradient(135deg,#eef9f1,#fff);border-left:4px solid #2e7d4e}.utility-watchman-card div:nth-child(2){display:grid;gap:3px}.utility-watchman-card span{font-weight:700}.utility-watchman-card small{color:#64748b}.utility-contact-card .actions{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}.utility-panel .empty-state{padding:24px 0}@media(max-width:900px){.utility-form,.utility-contact-grid{grid-template-columns:1fr}}
      .history-toolbar{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:12px 0 16px}.history-toolbar label{display:grid;gap:8px;font-weight:700;color:#475569}.history-toolbar select{min-width:280px}@media(max-width:900px){.history-toolbar{flex-direction:column;align-items:stretch}.history-toolbar select{min-width:0;width:100%}} .template-card{cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}.template-card:hover{transform:translateY(-2px);box-shadow:0 10px 22px rgba(51,65,85,.10)}.template-card-active{border:2px solid #3b68b8!important;box-shadow:0 10px 24px rgba(59,104,184,.14)!important}.template-card .button-link{margin-top:8px}

      /* V6.5.1 tenant lifecycle + compact workspace refinements */
      .operational-start-note{display:block;margin:2px 0 4px;padding:10px 12px;border-left:3px solid #4b78b8;border-radius:8px;background:#f5f8fc;color:#5f6f84;font-size:.88rem;line-height:1.45}
      .audit-results-scroll{max-height:420px!important;overflow:auto!important;border:1px solid #dbe4ef!important;border-radius:12px!important}
      .audit-results-scroll table{min-width:980px!important}
      .po-user-pill span:last-child>b{font-weight:850!important;color:#172b4d!important}
      .po-user-pill span:last-child small{font-weight:850!important}
      .po-security-pill{font-weight:750!important}
      .platform-owner-console .panel{margin-bottom:16px!important}
      .platform-owner-console .audit-history-console{min-height:0!important}
      .main input[type="checkbox"],.auth-card input[type="checkbox"],.main input[type="radio"],.auth-card input[type="radio"]{width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;max-width:16px!important;max-height:16px!important}
      .main .checkbox-label,.main .checkbox-inline,.auth-card .remember-login{gap:8px!important;align-items:center!important}

      /* V6.5.1 Platform Owner visual layer — design reference only; no API/data behavior changes. */
      .platform-owner-auth-shell{align-items:flex-start!important;justify-content:flex-start!important;padding:0!important;background:#f8fafc!important;min-height:100vh!important}
      .platform-owner-console{width:100%!important;max-width:1440px!important;margin:0 auto!important;padding:0!important;background:#f8fafc!important;border:0!important;border-radius:0!important;box-shadow:none!important;color:#0f172a!important}
      .platform-owner-console *{box-sizing:border-box}
      .po-top-header{height:76px;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;z-index:40;box-shadow:0 1px 8px rgba(15,23,42,.04)}
      .po-brand-block,.po-brand-line,.po-user-meta,.po-user-pill{display:flex;align-items:center}
      .po-brand-block{gap:12px}.po-logo{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;box-shadow:0 6px 16px rgba(37,99,235,.22)}
      .po-brand-line{gap:8px}.po-brand-line>span:first-child{font-size:18px;font-weight:800;letter-spacing:-.02em;color:#0f172a}.po-version-badge{font-size:11px!important;font-weight:700!important;padding:3px 8px;border-radius:999px;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0}.po-console-label{font-size:11px;color:#64748b;font-weight:600;margin-top:2px}
      .po-user-meta{gap:16px}.po-security-pill{display:flex;align-items:center;gap:7px;padding:7px 11px;border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:9px;font-size:11px;font-weight:600}.po-user-pill{gap:9px;border-left:1px solid #e2e8f0;padding-left:16px}.po-user-pill span:last-child>b{display:block;font-size:12px;color:#334155}.po-user-pill span:last-child small{display:block;font-size:10px;color:#059669;font-weight:700;margin-top:2px}.po-avatar{width:34px;height:34px;border-radius:50%;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;box-shadow:0 0 0 3px #dbeafe}
      .po-page-header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:28px 28px 20px;background:#f8fafc}.po-page-header h1{margin:0!important;font-size:24px!important;line-height:1.15!important;color:#0f172a!important;letter-spacing:-.025em}.po-page-header p{margin:7px 0 0!important;color:#64748b!important;font-size:13px!important;max-width:760px}.po-header-status{padding:8px 12px;border-radius:999px;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;font-size:11px;font-weight:800;white-space:nowrap}
      .po-system-banner{margin:0 28px 18px;padding:12px 14px;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;display:flex;align-items:center;gap:10px;color:#166534;font-size:12px;font-weight:600}.po-banner-icon{width:25px;height:25px;border-radius:8px;background:#d1fae5;color:#047857;display:flex;align-items:center;justify-content:center;font-weight:900}.po-system-banner button{margin-left:auto!important;background:transparent!important;color:#047857!important;border:0!important;box-shadow:none!important;min-height:28px!important;padding:4px 8px!important;font-size:11px!important}
      .platform-console-tabs{display:flex!important;grid-template-columns:none!important;gap:2px!important;margin:0 28px!important;padding:0!important;background:transparent!important;border:0!important;border-bottom:1px solid #e2e8f0!important;border-radius:0!important;box-shadow:none!important;position:relative!important;top:auto!important;z-index:10!important;overflow-x:auto}
      .platform-console-tabs button{flex:0 0 auto!important;display:flex!important;align-items:center!important;gap:10px!important;min-height:66px!important;padding:10px 18px!important;border:0!important;border-bottom:2px solid transparent!important;border-radius:9px 9px 0 0!important;background:transparent!important;color:#64748b!important;box-shadow:none!important;transform:none!important;text-align:left!important;white-space:nowrap}.platform-console-tabs button span{font-weight:700!important;font-size:13px!important;color:#475569!important}.platform-console-tabs button small{display:block!important;color:#94a3b8!important;font-size:10px!important;margin-top:2px!important}.platform-console-tabs button.active{background:#eff6ff!important;border-bottom-color:#2563eb!important;color:#2563eb!important;box-shadow:none!important}.platform-console-tabs button.active span,.platform-console-tabs button.active small{color:#1d4ed8!important}.platform-console-tabs button:hover:not(.active){background:#f8fafc!important;color:#334155!important;border-color:transparent!important;box-shadow:none!important}
      .platform-property{margin:22px 28px 28px!important;padding:22px!important;background:#fff!important;border:1px solid #e2e8f0!important;border-radius:12px!important;box-shadow:0 4px 14px rgba(15,23,42,.045)!important}.platform-property>h2{font-size:18px!important;color:#0f172a!important;margin:0 0 5px!important}.platform-property>.subtitle{color:#64748b!important;font-size:12px!important;margin:0 0 18px!important}
      .platform-account-toolbar{display:grid!important;grid-template-columns:minmax(320px,1fr) auto!important;gap:12px!important;align-items:end!important;margin:18px 0!important;padding:16px!important;background:#f8fafc!important;border:1px solid #e2e8f0!important;border-radius:10px!important}.platform-account-toolbar label,.audit-filter-grid label,.subscription-settings-form label{font-size:11px!important;font-weight:700!important;color:#334155!important;letter-spacing:.01em}.platform-account-toolbar input,.platform-account-toolbar select,.audit-filter-grid input,.audit-filter-grid select,.subscription-settings-form input,.subscription-settings-form select,.subscription-plan-card input,.subscription-new-plan input,.subscription-table-toolbar input,.subscription-table select{margin-top:6px!important;min-height:40px!important;border:1px solid #cbd5e1!important;border-radius:8px!important;background:#fff!important;padding:8px 11px!important;box-shadow:0 1px 2px rgba(15,23,42,.03)!important;color:#1e293b!important;font-size:12px!important}.platform-account-toolbar input:focus,.audit-filter-grid input:focus,.audit-filter-grid select:focus,.subscription-settings-form input:focus,.subscription-settings-form select:focus{border-color:#60a5fa!important;box-shadow:0 0 0 3px rgba(59,130,246,.10)!important}
      .platform-accounts-table,.audit-history-console table,.subscription-table{border-collapse:separate!important;border-spacing:0!important}.platform-accounts-table thead th,.subscription-table thead th,.audit-history-console table thead th{background:#f8fafc!important;color:#475569!important;font-size:10px!important;letter-spacing:.045em!important;padding:11px 10px!important;border-bottom:1px solid #e2e8f0!important}.platform-accounts-table tbody td,.subscription-table tbody td,.audit-history-console table tbody td{padding:12px 10px!important;border-bottom:1px solid #eef2f7!important;font-size:12px!important;color:#334155!important}.platform-accounts-table tbody tr:hover,.subscription-table tbody tr:hover,.audit-history-console table tbody tr:hover{background:#f8fbff!important}.platform-accounts-table td small,.subscription-table td small{color:#94a3b8!important;font-size:10px!important}.platform-account-actions{min-width:260px!important}.platform-account-actions button{margin:2px!important;font-size:10px!important;min-height:32px!important;padding:6px 9px!important}
      .subscription-console{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important}.subscription-console>.section-title-row{margin:22px 28px 16px!important;padding:20px!important;background:#fff;border:1px solid #e2e8f0;border-radius:12px}.subscription-console .subscription-policy-grid,.subscription-console .subscription-settings-form,.subscription-console .subscription-plan-grid,.subscription-console .subscription-table-toolbar,.subscription-console .table-scroll{margin-left:28px!important;margin-right:28px!important}.subscription-policy-card{background:#fff!important;border:1px solid #e2e8f0!important;border-radius:11px!important;box-shadow:0 3px 12px rgba(15,23,42,.04)!important}.subscription-plan-card{background:#fff!important;border:1px solid #e2e8f0!important;border-radius:11px!important;box-shadow:0 3px 12px rgba(15,23,42,.04)!important}.subscription-plan-card:first-child{border:2px solid #3b82f6!important;background:linear-gradient(180deg,#f8fbff,#fff)!important}.subscription-settings-form{background:#f8fafc!important;border:1px solid #e2e8f0!important;border-radius:11px!important}.subscription-new-plan{background:#f8fafc!important;border:1px dashed #cbd5e1!important;border-radius:10px!important}.subscription-console .section-title-row h2{font-size:18px!important;color:#0f172a!important}.subscription-console .section-title-row .subtitle{font-size:12px!important;color:#64748b!important}
      .audit-history-console{margin-top:22px!important}.audit-filter-grid{background:#f8fafc!important;border:1px solid #e2e8f0!important;border-radius:10px!important}.audit-toolbar{gap:8px!important}.audit-safety-note{border-left:3px solid #f59e0b!important;background:#fffbeb!important;color:#92400e!important;font-size:11px!important}.audit-count-badge{background:#eff6ff!important;color:#1d4ed8!important;border:1px solid #dbeafe!important}
      .platform-owner-console button.secondary{background:#fff!important;color:#334155!important;border:1px solid #cbd5e1!important;box-shadow:0 1px 2px rgba(15,23,42,.04)!important}.platform-owner-console button.secondary:hover{background:#f8fafc!important;border-color:#94a3b8!important}.platform-owner-console button.danger{box-shadow:none!important}.platform-logout-row{margin:0 28px 28px!important}
      @media(max-width:900px){.po-top-header{padding:0 16px}.po-security-pill{display:none}.po-page-header{padding:22px 16px 16px}.po-system-banner{margin-left:16px;margin-right:16px}.platform-console-tabs{margin-left:16px!important;margin-right:16px!important}.platform-property{margin-left:16px!important;margin-right:16px!important}.subscription-console>.section-title-row,.subscription-console .subscription-policy-grid,.subscription-console .subscription-settings-form,.subscription-console .subscription-plan-grid,.subscription-console .subscription-table-toolbar,.subscription-console .table-scroll{margin-left:16px!important;margin-right:16px!important}.platform-account-toolbar{grid-template-columns:1fr!important}}
      @media(max-width:600px){.po-top-header{height:68px}.po-console-label,.po-version-badge{display:none}.po-page-header{align-items:flex-start;flex-direction:column}.po-page-header h1{font-size:21px!important}.po-header-status{align-self:flex-start}.po-user-pill span:last-child{display:none}.platform-console-tabs button{min-height:60px!important;padding:8px 12px!important}.platform-console-tabs button small{display:none!important}.platform-property{padding:16px!important}.platform-account-actions{min-width:0!important}.platform-account-actions button{width:auto!important}}
/* V6.5.13 UI ALIGNMENT HARDENING — final global layout normalization
   Prevent label/control overlap and keep every module form aligned consistently. */
.platform-owner-auth-shell .auth-form{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  align-items:start!important;
  gap:18px 20px!important;
  width:100%!important;
  max-width:880px!important;
  margin:0 auto!important;
  padding:22px!important;
  box-sizing:border-box!important;
}
.platform-owner-auth-shell .auth-form>label{
  display:flex!important;
  flex-direction:column!important;
  align-items:stretch!important;
  justify-content:flex-start!important;
  width:100%!important;
  min-width:0!important;
  margin:0!important;
  padding:0!important;
  box-sizing:border-box!important;
  gap:7px!important;
}
.platform-owner-auth-shell .auth-form>label>input,
.platform-owner-auth-shell .auth-form>label>select,
.platform-owner-auth-shell .auth-form>label>textarea{
  display:block!important;
  width:100%!important;
  min-width:0!important;
  max-width:none!important;
  box-sizing:border-box!important;
  margin:0!important;
}
.platform-owner-auth-shell .auth-form .password-field{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) 48px!important;
  align-items:stretch!important;
  width:100%!important;
  min-width:0!important;
  gap:8px!important;
}
.platform-owner-auth-shell .auth-form .password-field input{
  grid-column:1!important;
  width:100%!important;
  min-width:0!important;
}
.platform-owner-auth-shell .auth-form .password-field .password-toggle{
  grid-column:2!important;
  width:48px!important;
  min-width:48px!important;
  margin:0!important;
}
.platform-owner-auth-shell .auth-form .form-actions{
  grid-column:1/-1!important;
  display:flex!important;
  align-items:center!important;
  justify-content:flex-start!important;
  flex-wrap:wrap!important;
  gap:10px!important;
  width:100%!important;
  margin:0!important;
  padding:4px 0 0!important;
}
/* All application forms use the same label-over-control structure. */
.main .resident-form,
.main .utility-form,
.main .golive-form{
  align-items:start!important;
}
.main .resident-form>label,
.main .utility-form>label,
.main .golive-form>label{
  display:flex!important;
  flex-direction:column!important;
  align-items:stretch!important;
  justify-content:flex-start!important;
  min-width:0!important;
  width:100%!important;
  margin:0!important;
  box-sizing:border-box!important;
  gap:7px!important;
}
.main .resident-form>label>input,
.main .resident-form>label>select,
.main .resident-form>label>textarea,
.main .utility-form>label>input,
.main .utility-form>label>select,
.main .utility-form>label>textarea,
.main .golive-form>label>input,
.main .golive-form>label>select,
.main .golive-form>label>textarea{
  width:100%!important;
  min-width:0!important;
  max-width:none!important;
  box-sizing:border-box!important;
  margin:0!important;
}
.main .resident-form .password-field,
.main .utility-form .password-field,
.main .golive-form .password-field{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) 48px!important;
  align-items:stretch!important;
  width:100%!important;
  min-width:0!important;
  gap:8px!important;
}
.main .resident-form .password-field input,
.main .utility-form .password-field input,
.main .golive-form .password-field input{grid-column:1!important;min-width:0!important;width:100%!important}
.main .resident-form .password-field .password-toggle,
.main .utility-form .password-field .password-toggle,
.main .golive-form .password-field .password-toggle{grid-column:2!important;width:48px!important;min-width:48px!important;margin:0!important}
.main .resident-form .form-actions,
.main .utility-form .form-actions,
.main .golive-form .form-actions{
  grid-column:1/-1!important;
  width:100%!important;
}
@media(max-width:760px){
  .platform-owner-auth-shell .auth-form{grid-template-columns:1fr!important;gap:16px!important;padding:18px!important}
  .platform-owner-auth-shell .auth-form .form-actions{grid-column:1!important}
}
/* V6.5.13 UI ALIGNMENT FIX 4 — password/help rows and client-trial polish */
.platform-owner-auth-shell .auth-form .password-form-field{align-self:start!important}
.platform-owner-auth-shell .auth-form .password-form-field .field-label{display:block!important;line-height:1.25!important;min-height:20px!important}
.platform-owner-auth-shell .auth-form .password-form-field .password-help,
.platform-owner-auth-shell .auth-form .password-form-field .password-help-spacer{display:block!important;grid-column:auto!important;line-height:1.5!important;min-height:48px!important;margin:0!important}
.platform-owner-auth-shell .auth-form .password-form-field .password-help-spacer{visibility:hidden!important;user-select:none!important}
.platform-owner-auth-shell .auth-form .password-form-field .password-field{margin-top:0!important}
.platform-owner-auth-shell .auth-form .password-form-field .password-toggle{align-self:stretch!important;height:auto!important}
/* Keep paired two-column fields visually balanced when one field has helper copy. */
.auth-form .password-form-field{align-self:start!important}
@media(max-width:760px){
  .platform-owner-auth-shell .auth-form .password-form-field .password-help,
  .platform-owner-auth-shell .auth-form .password-form-field .password-help-spacer{min-height:0!important}
  .platform-owner-auth-shell .auth-form .confirm-password-field .password-help-spacer{display:none!important}
}
/* Global trial-quality form normalization: no control may overflow its grid cell. */
.main .resident-form,.main .utility-form,.main .golive-form,.main .professional-expense-form,.main .subscription-settings-form,.main .audit-filter-grid{box-sizing:border-box!important}
.main .resident-form>label,.main .utility-form>label,.main .golive-form>label,.main .professional-expense-form>label{min-width:0!important;box-sizing:border-box!important}
.main .resident-form input,.main .resident-form select,.main .resident-form textarea,.main .utility-form input,.main .utility-form select,.main .utility-form textarea,.main .golive-form input,.main .golive-form select,.main .golive-form textarea,.main .professional-expense-form input,.main .professional-expense-form select,.main .professional-expense-form textarea{max-width:100%!important;min-width:0!important;box-sizing:border-box!important}
.main .table-scroll{max-width:100%!important;overflow-x:auto!important}
.main table{max-width:100%!important}
.main button{box-sizing:border-box!important}
/* ApartCare UI 1.0 — uniform visual system for every module */
:root{
  --ac-primary:#2563eb;
  --ac-primary-2:#1d4ed8;
  --ac-teal:#0f9f9a;
  --ac-ink:#172b4d;
  --ac-text:#334155;
  --ac-muted:#64748b;
  --ac-soft:#f5f8fc;
  --ac-soft-blue:#eff6ff;
  --ac-border:#dbe4ef;
  --ac-border-strong:#c8d5e5;
  --ac-success:#0f8a5f;
  --ac-warning:#b7791f;
  --ac-danger:#c2413b;
  --ac-radius:14px;
  --ac-shadow:0 8px 24px rgba(23,43,77,.07);
  --ac-shadow-hover:0 12px 30px rgba(23,43,77,.11);
  --ac-font:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
}

*{box-sizing:border-box}
body{font-family:var(--ac-font);color:var(--ac-text);background:#f4f7fb}
button,input,select,textarea{font-family:inherit}
button{cursor:pointer}

/* Global application canvas */
.shell{background:linear-gradient(145deg,#f4f7fb 0%,#eef4f9 100%)!important;color:var(--ac-text)!important}
.main{background:transparent!important}

/* Sidebar / navigation */
.sidebar{background:#fff!important;border-right:1px solid var(--ac-border)!important;box-shadow:4px 0 18px rgba(23,43,77,.035)!important}
.sidebar .side-brand{padding:20px 18px!important;border-bottom:1px solid var(--ac-border)!important}
.sidebar nav{padding:12px!important}
.sidebar nav button,.sidebar nav a{border-radius:10px!important;margin:3px 0!important;transition:all .16s ease!important}
.sidebar nav button:hover,.sidebar nav a:hover{background:#f2f6fc!important;color:var(--ac-primary)!important}
.sidebar nav button.active,.sidebar nav a.active{background:linear-gradient(135deg,#eff6ff,#e8f1ff)!important;color:var(--ac-primary-2)!important;border-left:3px solid var(--ac-primary)!important}

/* Apartment identity header */
.identity-header{background:rgba(255,255,255,.96)!important;border-bottom:1px solid var(--ac-border)!important;box-shadow:0 2px 12px rgba(23,43,77,.035)!important;padding:18px 28px!important}
.apartment-brand,.app-brand{min-width:0}
.identity-header .identity-photo{width:105px!important;height:124px!important;min-width:105px!important;min-height:124px!important;max-width:105px!important;max-height:124px!important;object-fit:cover!important;border-radius:10px!important;border:1px solid #d7e1eb!important;display:block!important}
.apartment-brand h2,.app-brand h2{color:var(--ac-ink)!important;font-weight:750!important;letter-spacing:-.02em}
.apartment-brand p,.app-brand p,.app-brand em{color:var(--ac-muted)!important}
.building-icon,.logo-mark{border-radius:12px!important;background:linear-gradient(135deg,#eaf3ff,#eefaf8)!important;border:1px solid #dce8f5!important}
.header-divider{height:8px!important;background:linear-gradient(90deg,#2563eb 0%,#0f9f9a 100%)!important;opacity:.9}

/* Page headers */
.main>h1,.page-title-row h1{color:var(--ac-ink)!important;font-weight:780!important;letter-spacing:-.025em!important}
.page-title-row{padding:20px 0 14px!important;margin:0!important;border-bottom:0!important}
.page-title-row .subtitle,.section-title-row .subtitle{color:var(--ac-muted)!important;line-height:1.55!important}
.section-title-row{margin-bottom:16px!important}

/* Common cards/panels */
.panel,.form-panel,.table-panel,.period-panel,.water-box,.utility-panel,.report-workspace,.individual-statement-panel,.import-panel,.golive-panel,.tenant-subscription-panel{
  background:#fff!important;border:1px solid var(--ac-border)!important;border-radius:var(--ac-radius)!important;box-shadow:var(--ac-shadow)!important;
}
.panel:hover,.form-panel:hover,.table-panel:hover{box-shadow:0 10px 28px rgba(23,43,77,.085)!important}
.panel h2,.form-panel h2,.table-panel h2{color:var(--ac-ink)!important;font-weight:730!important}
.panel h3,.form-panel h3,.table-panel h3{color:#243b5a!important;font-weight:700!important}
.help-text,.hint,.field-hint{color:#718096!important;line-height:1.5!important}

/* Uniform form controls */
.main input:not([type="checkbox"]):not([type="radio"]),
.main select,
.main textarea{
  width:100%;min-height:42px;padding:9px 12px!important;border:1px solid var(--ac-border-strong)!important;border-radius:10px!important;background:#fff!important;color:#1e293b!important;font-size:13px!important;line-height:1.35!important;box-shadow:0 1px 2px rgba(23,43,77,.035)!important;transition:border-color .16s ease,box-shadow .16s ease,background .16s ease!important;
}
.main textarea{min-height:94px;resize:vertical}
.main input::placeholder,.main textarea::placeholder{color:#9aa7b8!important}
.main input:not([type="checkbox"]):not([type="radio"]):focus,.main select:focus,.main textarea:focus{outline:none!important;border-color:#6b9cf6!important;box-shadow:0 0 0 3px rgba(37,99,235,.11)!important}
.main input:disabled,.main select:disabled,.main textarea:disabled{background:#f1f5f9!important;color:#94a3b8!important;cursor:not-allowed!important}
.main label{color:#334155;font-weight:650;font-size:12px;line-height:1.35}
.main label>input,.main label>select,.main label>textarea{margin-top:7px}

/* Dates — same presentation everywhere */
.main input[type="date"],.main input[type="month"]{min-height:42px}

/* Buttons */
.main button:not(.password-toggle){min-height:40px;padding:9px 15px!important;border:1px solid #cbd7e6!important;border-radius:10px!important;background:linear-gradient(180deg,#fff,#f7f9fc)!important;color:#334e6f!important;font-size:12px!important;font-weight:750!important;box-shadow:0 2px 5px rgba(23,43,77,.045)!important;transition:transform .15s ease,box-shadow .15s ease,background .15s ease,border-color .15s ease!important}
.main button:not(.password-toggle):hover{transform:translateY(-1px);box-shadow:0 6px 14px rgba(23,43,77,.09)!important;border-color:#aebed1!important;background:#fff!important}
.main button:not(.password-toggle):active{transform:translateY(0)}
.main button.auth-primary-button,.main button:not(.secondary):not(.danger):not(.button-link):not(.upload-button):not(.password-toggle):not(.auth-secondary-button):not(.auth-back-button){background:linear-gradient(135deg,var(--ac-primary),var(--ac-primary-2))!important;color:#fff!important;border-color:var(--ac-primary-2)!important;box-shadow:0 7px 16px rgba(37,99,235,.18)!important}
.main button.secondary,.main button.auth-secondary-button,.main button.auth-back-button{background:#fff!important;color:#36516f!important;border-color:#cbd7e6!important}
.main button.danger{background:linear-gradient(135deg,#c2413b,#a8322e)!important;color:#fff!important;border-color:#a8322e!important}
.main button:disabled{opacity:.55!important;cursor:not-allowed!important;transform:none!important;box-shadow:none!important}
.form-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px!important}

/* Tables */
.table-scroll,.table-wrap{border:1px solid var(--ac-border)!important;border-radius:12px!important;background:#fff!important;overflow:auto!important;box-shadow:0 3px 12px rgba(23,43,77,.035)!important}
.main table{width:100%;border-collapse:separate!important;border-spacing:0!important;font-size:12px!important}
.main table thead th{position:sticky;top:0;z-index:2;background:#f4f7fb!important;color:#52657e!important;text-transform:uppercase!important;letter-spacing:.045em!important;font-size:10px!important;font-weight:800!important;padding:11px 12px!important;border-bottom:1px solid var(--ac-border)!important;white-space:nowrap}
.main table tbody td{padding:12px!important;color:#334155!important;border-bottom:1px solid #edf1f6!important;vertical-align:middle!important}
.main table tbody tr:nth-child(even){background:#fbfcfe!important}
.main table tbody tr:hover{background:#f2f7ff!important}
.main table tbody tr:last-child td{border-bottom:0!important}
.main table td small{display:block;color:#8a98aa;margin-top:3px}
.empty,.empty-state{color:#8492a5!important;text-align:center!important;padding:28px!important}

/* KPI cards */
.kpis,.summary-grid,.report-kpis,.expense-kpis{gap:14px!important}
.card,.kpi-card,.report-kpi{border:1px solid var(--ac-border)!important;border-radius:14px!important;background:#fff!important;box-shadow:var(--ac-shadow)!important}
.card:hover,.kpi-card:hover,.report-kpi:hover{transform:translateY(-2px);box-shadow:var(--ac-shadow-hover)!important}
.kpi-card .label,.report-kpi span{color:#6b7c92!important;font-weight:700!important;font-size:11px!important}
.kpi-card .value,.report-kpi b{color:var(--ac-ink)!important;font-weight:800!important}

/* Filters, selectors and toolbars */
.period-panel,.table-toolbar,.history-toolbar,.report-controls,.report-actions,.import-actions,.platform-account-toolbar,.subscription-table-toolbar{border:1px solid var(--ac-border)!important;border-radius:12px!important;background:#f8fafc!important;padding:14px!important}
.selector-row,.period-options{gap:10px!important}
.period-options .radio,.checkbox-label,.checkbox-inline{border:1px solid var(--ac-border)!important;border-radius:9px!important;background:#fff!important;padding:8px 11px!important;color:#52657e!important}
.period-options .radio.selected{background:var(--ac-soft-blue)!important;border-color:#b9d2fb!important;color:var(--ac-primary-2)!important}

/* Module tabs / segmented controls */
.report-tabs,.category-chips{display:flex!important;gap:7px!important;flex-wrap:wrap!important;padding:5px!important;background:#f1f5f9!important;border:1px solid var(--ac-border)!important;border-radius:12px!important}
.report-tabs button,.category-chips button{min-height:38px!important;border:1px solid transparent!important;border-radius:9px!important;background:transparent!important;color:#64748b!important;box-shadow:none!important}
.report-tabs button.active,.category-chips button.active{background:linear-gradient(135deg,var(--ac-primary),#3b82f6)!important;color:#fff!important;border-color:var(--ac-primary)!important;box-shadow:0 5px 12px rgba(37,99,235,.18)!important}

/* Charts */
.donut-panel,.report-chart-card{background:#fff!important;border:1px solid var(--ac-border)!important;border-radius:14px!important;box-shadow:var(--ac-shadow)!important}
.chart-head h3,.donut-panel h2{color:var(--ac-ink)!important}
.chart-head p,.donut-foot{color:var(--ac-muted)!important}

/* Utility / resident / expense cards */
.utility-category,.utility-contact-card,.utility-watchman-card,.utility-form,.resident-form,.professional-expense-form,.maintenance-setup-grid{border:1px solid var(--ac-border)!important;border-radius:12px!important;background:#fff!important;box-shadow:0 4px 14px rgba(23,43,77,.045)!important}
.utility-category:hover,.utility-contact-card:hover,.utility-watchman-card:hover{box-shadow:var(--ac-shadow)!important;transform:translateY(-1px)}

/* Messages and badges */
.message{border-radius:10px!important;border:1px solid #bfdbfe!important;background:#eff6ff!important;color:#1e40af!important;padding:11px 13px!important}
.tag,.validity-badge,.lock-badge,.platform-console-badge,.audit-count-badge,.subscription-type,.subscription-status{font-weight:800!important;border-radius:999px!important}

/* Modal consistency */
.modal-backdrop{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;min-height:100dvh!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:20px!important;box-sizing:border-box!important;background:rgba(15,23,42,.56)!important;backdrop-filter:blur(3px)!important;z-index:99999!important;overflow:auto!important}.modal-backdrop .password-modal{position:relative!important;z-index:100000!important;max-width:min(680px,calc(100vw - 32px))!important;max-height:calc(100vh - 32px)!important;overflow:auto!important}
.password-modal{border:1px solid var(--ac-border)!important;border-radius:18px!important;background:#fff!important;box-shadow:0 24px 60px rgba(15,23,42,.2)!important}
.password-modal h2{color:var(--ac-ink)!important}
.password-modal textarea{min-height:110px!important}

/* Platform Owner — premium business console */
.platform-owner-console{background:#f7f9fc!important}
.po-top-header{background:#fff!important;border-bottom:1px solid var(--ac-border)!important}
.po-brand-line span:first-child{color:var(--ac-ink)!important;font-weight:850!important}
.po-console-label{color:#64748b!important}
.po-version-badge{background:#eff6ff!important;color:#1d4ed8!important;border:1px solid #dbeafe!important}
.po-user-pill{border:1px solid var(--ac-border)!important;background:#fff!important;box-shadow:0 2px 7px rgba(23,43,77,.05)!important}
.po-page-header{background:linear-gradient(135deg,#f8fbff,#f3f8fc)!important;border-bottom:1px solid var(--ac-border)!important}
.po-page-header h1{font-size:27px!important;color:var(--ac-ink)!important;font-weight:820!important}
.po-header-status{background:#ecfdf5!important;color:#047857!important;border-color:#bbf7d0!important}
.po-system-banner{background:#ecfdf5!important;border-color:#bbf7d0!important;color:#166534!important}

/* Platform tabs — identical visual language across all top-level tabs */
.platform-console-tabs{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:8px!important;padding:6px!important;margin:0 28px!important;background:#eef3f8!important;border:1px solid var(--ac-border)!important;border-radius:14px!important;box-shadow:0 4px 12px rgba(23,43,77,.05)!important;overflow:visible!important}
.platform-console-tabs button{min-height:68px!important;display:grid!important;grid-template-columns:34px 1fr!important;grid-template-rows:auto auto!important;align-items:center!important;text-align:left!important;padding:10px 13px!important;border:1px solid transparent!important;border-radius:10px!important;background:transparent!important;color:#52657e!important;box-shadow:none!important;white-space:normal!important}
.platform-console-tabs button span{font-size:13px!important;font-weight:800!important;color:#334e6f!important;line-height:1.2!important}
.platform-console-tabs button small{font-size:10px!important;color:#8090a5!important;margin-top:2px!important}
.platform-console-tabs button.active{background:linear-gradient(135deg,#2563eb,#3b82f6)!important;border-color:#1d4ed8!important;box-shadow:0 7px 16px rgba(37,99,235,.2)!important;color:#fff!important}
.platform-console-tabs button.active span,.platform-console-tabs button.active small{color:#fff!important}
.platform-console-tabs button:hover:not(.active){background:#fff!important;border-color:#cbd9e8!important;box-shadow:0 4px 10px rgba(23,43,77,.06)!important}

.platform-property{background:#fff!important;border:1px solid var(--ac-border)!important;border-radius:16px!important;box-shadow:var(--ac-shadow)!important}
.platform-property>h2{color:var(--ac-ink)!important}
.platform-property>.subtitle{color:var(--ac-muted)!important}
.platform-account-toolbar,.audit-filter-grid,.subscription-settings-form{background:#f8fafc!important;border:1px solid var(--ac-border)!important;border-radius:12px!important}
.subscription-policy-card,.subscription-plan-card,.subscription-detail-grid>div{background:#fff!important;border:1px solid var(--ac-border)!important;border-radius:13px!important;box-shadow:0 4px 14px rgba(23,43,77,.045)!important}
.subscription-plan-card:hover,.subscription-policy-card:hover{box-shadow:var(--ac-shadow)!important;transform:translateY(-2px)}
.subscription-plan-card:first-child{border-top:3px solid #3b82f6!important}
.subscription-plan-card:nth-child(2){border-top:3px solid #0f9f9a!important}
.subscription-plan-card:nth-child(3){border-top:3px solid #7c5ab5!important}

/* Keep controls in platform console aligned and never concatenate */
.subscription-settings-form{grid-template-columns:repeat(4,minmax(160px,1fr))!important;align-items:end!important}
.subscription-settings-form label{display:flex!important;flex-direction:column!important;gap:7px!important;min-width:0!important}
.subscription-settings-form input,.subscription-settings-form select{margin-top:0!important}
.subscription-new-plan{align-items:end!important;background:#f8fafc!important;border:1px dashed #c5d2e1!important;border-radius:12px!important}
.subscription-new-plan input{margin-top:0!important}
.subscription-plan-card label{gap:10px!important;align-items:center!important}
.subscription-plan-card input{margin-top:0!important}

/* Consistent search and audit */
.audit-filter-grid{align-items:end!important}
.audit-filter-grid label{font-size:11px!important;color:#334e6f!important}
.audit-toolbar{display:flex!important;align-items:center!important;gap:8px!important}
.audit-safety-note{background:#fffbeb!important;border-left:3px solid #f59e0b!important;color:#92400e!important}

/* Responsive */
@media(max-width:1100px){
  .subscription-settings-form{grid-template-columns:repeat(2,minmax(160px,1fr))!important}
  .platform-console-tabs{grid-template-columns:repeat(2,minmax(0,1fr))!important}
}
@media(max-width:760px){
  .identity-header{padding:14px 16px!important;flex-direction:column!important;align-items:flex-start!important;gap:12px!important}
  .page-title-row{padding-top:16px!important}
  .platform-console-tabs{grid-template-columns:1fr!important;margin:0 16px!important}
  .platform-console-tabs button{min-height:58px!important}
  .subscription-settings-form{grid-template-columns:1fr!important}
  .subscription-plan-grid,.subscription-policy-grid,.subscription-detail-grid{grid-template-columns:1fr!important}
  .main .form-actions button{width:auto!important}
}

      /* Final platform visual guard: branding images are constrained to their own containers. */
      .platform-owner-auth-shell .platform-owner-console .po-logo img{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important}
      .platform-owner-auth-shell .platform-auth-heading img{display:block!important;width:76px!important;height:76px!important;max-width:76px!important;max-height:76px!important;object-fit:contain!important;border-radius:16px!important;background:#fff!important;padding:5px!important;border:1px solid #dbe6f2!important}
      .platform-owner-auth-shell .platform-recovery-panel{padding:26px!important;background:#fff!important;border:1px solid #dbe4ef!important;border-top:4px solid #3f6fa8!important;border-radius:18px!important;box-shadow:0 10px 28px rgba(23,43,77,.07)!important}
      .platform-owner-auth-shell .recovery-page-hero{display:flex!important;align-items:center!important;gap:15px!important;margin:-2px -2px 18px!important;padding:16px 18px!important;border:1px solid #dbe5ef!important;border-radius:14px!important;background:linear-gradient(135deg,#f7faff,#eef5fb)!important}
      .platform-owner-auth-shell .recovery-page-hero .ac-page-icon{width:48px!important;height:48px!important;flex:0 0 48px!important;display:grid!important;place-items:center!important;border-radius:13px!important;background:#eaf3ff!important;border:1px solid #cfe0ff!important;font-size:23px!important}
      .platform-owner-auth-shell .recovery-page-hero .ac-page-copy{min-width:0!important;flex:1!important}
      .platform-owner-auth-shell .recovery-page-hero .ac-eyebrow{font-size:10px!important;letter-spacing:.09em!important;font-weight:850!important;color:#47709d!important;margin-bottom:2px!important}
      .platform-owner-auth-shell .recovery-page-hero h2{margin:0!important;color:#172b4d!important;font-size:1.45rem!important;line-height:1.2!important}
      .platform-owner-auth-shell .recovery-page-hero p{margin:5px 0 0!important;color:#667b96!important;font-size:.86rem!important;line-height:1.45!important;font-weight:600!important}
      .platform-owner-auth-shell .recovery-page-hero .platform-recovery-badge{flex:0 0 auto!important}
      .platform-owner-auth-shell .platform-recovery-toolbar{display:grid!important;grid-template-columns:minmax(280px,1.2fr) minmax(300px,1fr) auto!important;align-items:end!important;gap:12px!important;margin:0 0 16px!important;padding:14px!important;border:1px solid #dbe5ef!important;border-radius:14px!important;background:#f8fbff!important}
      .platform-owner-auth-shell .platform-recovery-toolbar label{display:grid!important;gap:6px!important;font-weight:800!important;color:#425773!important;font-size:.8rem!important}
      .platform-owner-auth-shell .platform-recovery-toolbar input,.platform-owner-auth-shell .platform-recovery-toolbar select{width:100%!important;min-width:0!important;min-height:40px!important;height:40px!important;border:1px solid #c9d5e3!important;border-radius:10px!important;background:#fff!important;padding:8px 10px!important;color:#263b57!important;box-sizing:border-box!important;font-size:.9rem!important;box-shadow:inset 0 1px 2px rgba(15,23,42,.03)!important}
      .platform-owner-auth-shell .platform-recovery-toolbar input:focus,.platform-owner-auth-shell .platform-recovery-toolbar select:focus{outline:none!important;border-color:#5b8def!important;box-shadow:0 0 0 3px rgba(59,130,246,.12)!important}
      .platform-owner-auth-shell .platform-recovery-toolbar button{min-height:40px!important;height:40px!important;white-space:nowrap!important}
      .platform-owner-auth-shell .platform-recovery-summary{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;margin:0 0 14px!important}
      .platform-owner-auth-shell .platform-recovery-summary>div{padding:12px 14px!important;border:1px solid #dbe5ef!important;border-radius:12px!important;background:#f8fbff!important}
      .platform-owner-auth-shell .platform-recovery-summary span{display:block!important;color:#71829a!important;font-size:.72rem!important;font-weight:700!important;margin-bottom:3px!important}
      .platform-owner-auth-shell .platform-recovery-summary b{display:block!important;color:#1f3b5d!important;font-size:.9rem!important}
      .platform-owner-auth-shell .platform-recovery-note{margin:0 0 14px!important;padding:11px 13px!important;border-left:4px solid #3b82f6!important;background:#f1f7ff!important;color:#38577c!important;border-radius:8px!important;font-size:.82rem!important;line-height:1.45!important}
      .platform-owner-auth-shell .platform-recovery-user-toolbar{display:grid!important;grid-template-columns:minmax(280px,1fr) auto!important;align-items:end!important;gap:10px!important;margin:0 0 12px!important;padding:12px 14px!important;border:1px solid #dbe5ef!important;border-radius:13px!important;background:#f8fbff!important}
      .platform-owner-auth-shell .platform-recovery-user-toolbar label{display:grid!important;gap:6px!important;font-weight:750!important;color:#425773!important;font-size:.82rem!important}
      .platform-owner-auth-shell .platform-recovery-user-toolbar input{width:100%!important;min-height:40px!important;height:40px!important;border:1px solid #c9d5e3!important;border-radius:10px!important;background:#fff!important;padding:8px 10px!important;color:#263b57!important;box-sizing:border-box!important}
      @media(max-width:900px){.platform-owner-auth-shell .platform-recovery-toolbar{grid-template-columns:1fr 1fr!important}.platform-owner-auth-shell .platform-recovery-toolbar button{grid-column:1/-1!important;width:max-content!important}.platform-owner-auth-shell .platform-recovery-summary{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
      @media(max-width:600px){.platform-owner-auth-shell .platform-recovery-panel{padding:16px!important}.platform-owner-auth-shell .recovery-page-hero{align-items:flex-start!important;flex-wrap:wrap!important}.platform-owner-auth-shell .platform-recovery-toolbar{grid-template-columns:1fr!important}.platform-owner-auth-shell .platform-recovery-toolbar button{grid-column:auto!important;width:100%!important}.platform-owner-auth-shell .platform-recovery-summary{grid-template-columns:1fr!important}.platform-owner-auth-shell .platform-recovery-user-toolbar{grid-template-columns:1fr!important}}
`}</style>
        {!platformUser&&<div className="auth-brand"><div className="auth-logo"><img src="/apartcare-lite-logo.png" alt="ApartCare Lite"/></div><div className="auth-brand-copy"><h1>ApartCare Lite Platform</h1><p>Product Owner Administration</p><em>Tenant recovery, account oversight and controlled security actions.</em></div></div>}
        {platformUser?<>
      {platformMustChangePassword&&<div className="modal-backdrop"><section className="password-modal password-modal-branded"><div className="password-modal-brand"><img className="po-brand-image" src="/apartcare-lite-logo.png" alt="ApartCare Lite"/><div className="password-modal-brand-copy"><strong>ApartCare Lite</strong><span>Your daily partner in property care.</span><em>Helping you run your building beautifully.</em></div></div><div className="modal-icon">🔐</div><h2>Change your Platform Owner password</h2><p>For security, the Platform Owner must set a new password before continuing. This requirement remains active until the password is changed.</p>{platformChangeMessage&&<div className="message">{platformChangeMessage}</div>}<form onSubmit={changePlatformPassword}><label>New Password<div className="password-field"><input required minLength={8} type={showPassword?'text':'password'} value={platformChangeForm.new_password} onChange={e=>setPlatformChangeForm({...platformChangeForm,new_password:e.target.value})}/><button type="button" className="password-toggle" onClick={()=>setShowPassword(!showPassword)}>{showPassword?'🙈':'👁️'}</button></div></label><label>Confirm New Password<div className="password-field"><input required minLength={8} type={showConfirmPassword?'text':'password'} value={platformChangeForm.confirm_password} onChange={e=>setPlatformChangeForm({...platformChangeForm,confirm_password:e.target.value})}/><button type="button" className="password-toggle" onClick={()=>setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword?'🙈':'👁️'}</button></div></label><div className="form-actions"><button type="submit" className="auth-primary-button" disabled={platformBusy}>{platformBusy?'Updating Password…':'Update Password & Continue'}</button></div></form></section></div>}
          <header className="po-top-header">
            <div className="po-brand-block">
              <div className="po-logo"><img src="/apartcare-lite-logo.png" alt="ApartCare Lite"/></div>
              <div>
                <div className="po-brand-line"><span>ApartCare Lite Platform</span></div>
                <div className="po-console-label">Product Owner Administration</div>
                <div className="po-console-tagline">Tenant recovery, account oversight and controlled security actions.</div>
              </div>
            </div>
            <div className="po-user-meta">
              <div className="po-security-pill">⚠ <span>Super Admin privilege reserved for Platform Owner</span></div>
              <div className="po-user-pill"><span className="po-avatar">{String(platformUser.full_name||'PO').slice(0,2).toUpperCase()}</span><span><b>{platformUser.full_name}</b><small>● Super Admin Access</small></span></div>
            </div>
          </header>
          <div className="po-page-header">
            <div><h1>Platform Administration</h1><p>Manage apartment tenants, subscriptions, access history and controlled recovery from one secure console.</p></div>
            <div className="po-header-status">● Secure Platform Session</div>
          </div>
          {platformMessage&&<div className="po-system-banner"><span className="po-banner-icon">✓</span><span>{platformMessage}</span><button type="button" onClick={()=>setPlatformMessage('')}>Dismiss</button></div>}
          <div className="platform-console-tabs" role="tablist" aria-label="Platform Owner Console">
            <button type="button" className={platformConsoleTab==='accounts'?'active':''} onClick={()=>setPlatformConsoleTab('accounts')} role="tab" aria-selected={platformConsoleTab==='accounts'}>🏢 <span>Apartment Accounts</span><small>Tenants & validity</small></button>
            <button type="button" className={platformConsoleTab==='billing'?'active':''} onClick={()=>setPlatformConsoleTab('billing')} role="tab" aria-selected={platformConsoleTab==='billing'}>💳 <span>Subscription & Billing</span><small>Plans & trials</small></button>
            <button type="button" className={platformConsoleTab==='audit'?'active':''} onClick={()=>setPlatformConsoleTab('audit')} role="tab" aria-selected={platformConsoleTab==='audit'}>🔐 <span>Global Login & Audit</span><small>History & controls</small></button>
            <button type="button" className={platformConsoleTab==='recovery'?'active':''} onClick={()=>setPlatformConsoleTab('recovery')} role="tab" aria-selected={platformConsoleTab==='recovery'}>👤 <span>User Recovery</span><small>Tenant-scoped support</small></button>
          </div>
          {platformConsoleTab==='accounts' && <section className="panel platform-property"><h2>Apartment Accounts</h2><p className="subtitle">Every apartment is an independent tenant account with its own validity period, registered contact details and operational data.</p><div className="platform-account-toolbar"><label>Search Apartment Accounts<input value={platformAccountSearch} onChange={e=>setPlatformAccountSearch(e.target.value)} placeholder="Account Number / Mobile / Admin User ID / Apartment"/></label><button type="button" className="secondary" onClick={()=>{setPlatformAccountSearch('');loadPlatformAccounts(platformToken);}}>↻ Refresh</button></div><div className="table-scroll business-grid"><table className="platform-accounts-table"><thead><tr><th>Account Number</th><th>Apartment</th><th>Administrator / Users</th><th>Registered Email</th><th>Mobile</th><th>Validity</th><th>Data Start</th><th>Status</th><th>Actions</th></tr></thead><tbody>{platformAccounts.length===0?<tr><td colSpan={9} className="empty">No Apartment Accounts created yet.</td></tr>:platformAccounts.filter((a:any)=>{const q=platformAccountSearch.trim().toLowerCase();if(!q)return true;const users=a.users||[];const admin=users.find((u:any)=>u.role==='Admin')||users[0];return [a.account_id,a.apartment_name,a.city,a.state,a.country,a.account_mobile,a.account_email,admin?.username,admin?.full_name,admin?.mobile_no,admin?.email].some((v:any)=>String(v||'').toLowerCase().includes(q));}).map((a:any)=>{const users=a.users||[]; const admin=users.find((u:any)=>u.role==='Admin')||users[0]; const daysLeft=a.valid_to?Math.ceil((new Date(a.valid_to+'T23:59:59').getTime()-Date.now())/86400000):0; const validityClass=daysLeft<0?'expired':daysLeft<=30?'expiring':''; const locked=a.status==='Suspended'; return <tr key={a.tenant_id}><td><b>{a.account_id}</b><small className="platform-tenant-id">Tenant: {a.tenant_id.slice(0,8)}…</small></td><td><b>{a.apartment_name}</b><small>{[a.city,a.state,a.country].filter(Boolean).join(', ')}</small></td><td>{admin?<><b>{admin.username}</b><small>{admin.full_name} · {users.length} user{users.length===1?'':'s'}</small></>:<span>—</span>}</td><td>{a.account_email||admin?.email||'—'}</td><td>{a.account_mobile||admin?.mobile_no||'—'}</td><td><b>{formatDate(a.valid_from)}</b><small>to {formatDate(a.valid_to)}</small><span className={`validity-badge ${validityClass}`}>{daysLeft<0?'Expired':daysLeft<=30?`${Math.max(0,daysLeft)} days left`:'Valid'}</span></td><td><b>{a.data_start_month?formatMonthKey(a.data_start_month):'Not locked'}</b><small>{a.data_start_month?'Opening Balance baseline':'No month restriction'}</small></td><td><span className={`account-status status-${String(a.status||'').toLowerCase()}`}>{a.status}</span></td><td className="platform-account-actions"><button type="button" className="secondary" onClick={()=>platformExtendAccount(a)}>📅 Extend</button>{locked?<button type="button" className="secondary" onClick={()=>platformUnlockAccount(a)}>🔓 Unlock</button>:<button type="button" className="secondary" onClick={()=>platformLockAccount(a)}>🔒 Lock</button>}<button type="button" className="secondary" onClick={()=>{startPlatformSupport(a.tenant_id);loadPlatformValidityHistory(platformToken,a.tenant_id);}}>🔎 Audit / Support</button><button type="button" className="secondary" onClick={()=>loadPlatformValidityHistory(platformToken,a.tenant_id)}>🕘 Validity History</button></td></tr>})}</tbody></table></div>{platformHistoryTenantId&&<div className="platform-validity-history"><div className="section-title-row"><div><h3>Validity / Account Status History</h3><p className="help-text">Time-dimension history for the selected apartment account.</p></div><button type="button" className="secondary" onClick={()=>{setPlatformHistoryTenantId('');setPlatformValidityHistory([])}}>Close</button></div><div className="table-scroll business-grid"><table><thead><tr><th>Date / Time</th><th>Action</th><th>Valid From</th><th>Valid To</th><th>Status</th><th>Changed By</th><th>Reason</th></tr></thead><tbody>{platformValidityHistory.length===0?<tr><td colSpan={7} className="empty">No history found.</td></tr>:platformValidityHistory.map((h:any)=><tr key={h.id}><td>{formatDateTime(h.changed_at)}</td><td><b>{h.action}</b></td><td>{formatDate(h.valid_from)}</td><td>{formatDate(h.valid_to)}</td><td>{h.status}</td><td>{h.changed_by}</td><td>{h.reason||'—'}</td></tr>)}</tbody></table></div></div>}</section>}
          {platformConsoleTab==='billing' && <section className="panel platform-property subscription-console">
            <div className="section-title-row"><div><h2>💳 Subscription & Billing</h2><p className="subtitle">Product Owner controls Trial, Free/Complimentary access, plans, grace periods and tenant subscription lifecycle. Existing apartment data is not modified by subscription changes.</p></div></div>
            {platformSubscriptionMessage&&<div className="message subscription-message">{platformSubscriptionMessage}</div>}
            {platformSubscriptionSettings&&<>
              <div className="subscription-policy-grid">
                <div className="subscription-policy-card"><span>Free / Trial</span><strong>{platformSubscriptionSettings.trial_enabled?'Enabled':'Disabled'}</strong><small>Optional — only when explicitly enabled by the Product Owner</small></div>
                <div className="subscription-policy-card"><span>Default Trial</span><strong>{platformSubscriptionSettings.default_trial_value} {platformSubscriptionSettings.default_trial_unit}</strong><small>Starts from Account Creation Date</small></div>
                <div className="subscription-policy-card"><span>Grace Period</span><strong>{platformSubscriptionSettings.default_grace_value} {platformSubscriptionSettings.default_grace_unit}</strong><small>After trial expiry / payment issue</small></div>
                <div className="subscription-policy-card"><span>Complimentary</span><strong>{platformSubscriptionSettings.allow_complimentary?'Allowed':'Disabled'}</strong><small>Product Owner controlled</small></div>
              </div>
              <div className="subscription-settings-form">
                <label className="checkbox-inline"><input type="checkbox" checked={Boolean(platformSubscriptionSettings.trial_enabled)} onChange={e=>setPlatformSubscriptionSettings({...platformSubscriptionSettings,trial_enabled:e.target.checked})}/> Enable Trial for new accounts (optional)</label><label>Default Plan for New Accounts<select value={platformSubscriptionSettings.default_plan_id||''} onChange={e=>setPlatformSubscriptionSettings({...platformSubscriptionSettings,default_plan_id:e.target.value})}><option value="">Select Default Plan</option>{platformPlans.filter((p:any)=>p.active).map((p:any)=><option key={p.id} value={p.id}>{p.name}{p.trial_enabled?` — Trial ${p.trial_value} ${p.trial_unit}`:` — ₹${Number(p.monthly_price).toLocaleString('en-IN')}/mo`}</option>)}</select><small className="help-text">New accounts inherit this plan unless the Product Owner assigns another plan.</small></label>
                <label>Trial Duration<input type="number" min="1" value={platformSubscriptionSettings.default_trial_value===0?'':platformSubscriptionSettings.default_trial_value} onChange={e=>setPlatformSubscriptionSettings({...platformSubscriptionSettings,default_trial_value:e.target.value===''?0:Number(e.target.value)})}/></label>
                <label>Unit<select value={platformSubscriptionSettings.default_trial_unit} onChange={e=>setPlatformSubscriptionSettings({...platformSubscriptionSettings,default_trial_unit:e.target.value})}><option>Days</option><option>Months</option></select></label>
                <label>Grace Period<input type="number" min="0" value={platformSubscriptionSettings.default_grace_value===0?'':platformSubscriptionSettings.default_grace_value} onChange={e=>setPlatformSubscriptionSettings({...platformSubscriptionSettings,default_grace_value:e.target.value===''?0:Number(e.target.value)})}/></label>
                <label>Grace Unit<select value={platformSubscriptionSettings.default_grace_unit} onChange={e=>setPlatformSubscriptionSettings({...platformSubscriptionSettings,default_grace_unit:e.target.value})}><option>Days</option><option>Months</option></select></label>
                <label>Maximum Trial Extension<input type="number" min="1" value={platformSubscriptionSettings.max_trial_extension_value===0?'':platformSubscriptionSettings.max_trial_extension_value} onChange={e=>setPlatformSubscriptionSettings({...platformSubscriptionSettings,max_trial_extension_value:e.target.value===''?0:Number(e.target.value)})}/></label>
                <label>Extension Unit<select value={platformSubscriptionSettings.max_trial_extension_unit} onChange={e=>setPlatformSubscriptionSettings({...platformSubscriptionSettings,max_trial_extension_unit:e.target.value})}><option>Days</option><option>Months</option></select></label>
                <label className="checkbox-inline"><input type="checkbox" checked={Boolean(platformSubscriptionSettings.allow_trial_extension)} onChange={e=>setPlatformSubscriptionSettings({...platformSubscriptionSettings,allow_trial_extension:e.target.checked})}/> Allow Trial Extension</label>
                <label className="checkbox-inline"><input type="checkbox" checked={Boolean(platformSubscriptionSettings.allow_complimentary)} onChange={e=>setPlatformSubscriptionSettings({...platformSubscriptionSettings,allow_complimentary:e.target.checked})}/> Allow Complimentary Accounts</label>
                <button type="button" onClick={savePlatformSubscriptionSettings}>💾 Save Subscription Policy</button>
              </div>
            </>}
            <div className="subscription-plan-header"><div><h3>Plans</h3><p className="help-text">Prices are Product Owner controlled. Gateway charging remains server-side and tenant-isolated.</p></div></div>
            <div className="subscription-plan-grid">{platformPlans.map(plan=><article className="subscription-plan-card" key={plan.id}><div className="plan-top"><span>{plan.name}</span><b>{plan.active?'ACTIVE':'INACTIVE'}</b></div><p>{plan.description}</p><label>Monthly ₹<input type="number" min="0" value={plan.monthly_price} onChange={e=>setPlatformPlans(prev=>prev.map((x:any)=>x.id===plan.id?{...x,monthly_price:Number(e.target.value||0)}:x))} onBlur={e=>updatePlanPrice({...plan,monthly_price:Number(e.target.value||0)},'monthly_price',e.target.value)}/></label><label>Annual ₹<input type="number" min="0" value={plan.annual_price} onChange={e=>setPlatformPlans(prev=>prev.map((x:any)=>x.id===plan.id?{...x,annual_price:Number(e.target.value||0)}:x))} onBlur={e=>updatePlanPrice({...plan,annual_price:Number(e.target.value||0)},'annual_price',e.target.value)}/></label><small>{Object.entries(plan.features||{}).filter(([,v])=>v).map(([k])=>k).join(' • ')}</small></article>)}</div>
            <form className="subscription-new-plan" onSubmit={createPlatformPlan}><h3>Create New Plan</h3><input placeholder="Plan Code" value={newPlanForm.code} onChange={e=>setNewPlanForm({...newPlanForm,code:e.target.value.toUpperCase()})}/><input placeholder="Plan Name" value={newPlanForm.name} onChange={e=>setNewPlanForm({...newPlanForm,name:e.target.value})}/><input placeholder="Description" value={newPlanForm.description} onChange={e=>setNewPlanForm({...newPlanForm,description:e.target.value})}/><input type="number" min="0" placeholder="Monthly ₹" value={newPlanForm.monthly_price} onChange={e=>setNewPlanForm({...newPlanForm,monthly_price:e.target.value})}/><input type="number" min="0" placeholder="Annual ₹" value={newPlanForm.annual_price} onChange={e=>setNewPlanForm({...newPlanForm,annual_price:e.target.value})}/><label className="trial-plan-toggle"><input type="checkbox" checked={newPlanForm.trial_enabled} onChange={e=>setNewPlanForm({...newPlanForm,trial_enabled:e.target.checked})}/> Trial Plan</label><input className="trial-duration-input" type="number" min="1" placeholder="Trial duration" value={newPlanForm.trial_value} disabled={!newPlanForm.trial_enabled} onChange={e=>setNewPlanForm({...newPlanForm,trial_value:e.target.value})}/><select className="trial-unit-select" value={newPlanForm.trial_unit} disabled={!newPlanForm.trial_enabled} onChange={e=>setNewPlanForm({...newPlanForm,trial_unit:e.target.value})}><option>Days</option><option>Months</option><option>Years</option></select><button type="submit" disabled={planCreating}>{planCreating?'Creating…':'＋ Create Plan'}</button><small className="trial-plan-help">Enable Trial Plan to create a Product Owner controlled duration. Assigning this plan to an account starts the configured trial immediately.</small></form>
            <div className="subscription-table-toolbar"><input value={platformSubscriptionSearch} onChange={e=>setPlatformSubscriptionSearch(e.target.value)} placeholder="Search Account / Apartment / Plan / Status"/><button type="button" className="secondary" onClick={()=>loadPlatformSubscriptions(platformToken)}>↻ Refresh</button></div>
            <div className="table-scroll business-grid"><table className="subscription-table"><thead><tr><th>Account</th><th>Apartment</th><th>Type</th><th>Plan</th><th>Status</th><th>Payment</th><th>Trial / Validity</th><th>Actions</th></tr></thead><tbody>{platformSubscriptions.filter((row:any)=>{const q=platformSubscriptionSearch.trim().toLowerCase();if(!q)return true;const a=row.account||{},s=row.subscription||{},sum=row.summary||{};return [a.account_id,a.apartment_name,a.account_mobile,s.subscription_type,s.status,sum.plan?.name].some((v:any)=>String(v||'').toLowerCase().includes(q));}).map((row:any)=><tr key={row.subscription.id}><td><b>{row.account.account_id}</b></td><td>{row.account.apartment_name}<small>{row.account.city}, {row.account.state}</small></td><td><span className={`subscription-type type-${String(row.subscription.subscription_type).toLowerCase()}`}>{row.subscription.subscription_type}</span></td><td><div className="subscription-plan-assignment"><select value={platformSelectedPlanByTenant[row.account.tenant_id] ?? row.subscription.plan_id ?? ''} onChange={e=>setPlatformSelectedPlanByTenant(prev=>({...prev,[row.account.tenant_id]:e.target.value}))}><option value="">Select Plan</option>{platformPlans.filter((p:any)=>p.active).map((p:any)=><option key={p.id} value={p.id}>{p.name}{p.trial_enabled?` — Trial ${p.trial_value} ${p.trial_unit}`:` — ₹${Number(p.monthly_price).toLocaleString('en-IN')}/mo`}</option>)}</select><button type="button" className="secondary assign-plan-button" disabled={!((platformSelectedPlanByTenant[row.account.tenant_id] ?? row.subscription.plan_id)||'')||isPlatformBusy(`platform-assign-plan:${row.account.tenant_id}`)} onClick={()=>platformAssignPlan(row,platformSelectedPlanByTenant[row.account.tenant_id] ?? row.subscription.plan_id ?? '')}>{isPlatformBusy(`platform-assign-plan:${row.account.tenant_id}`)?'Assigning…':'Assign'}</button></div></td><td><span className={`subscription-status status-${String(row.summary.status).toLowerCase()}`}>{row.summary.status}</span>{row.summary.days_remaining!==null&&<small>{row.summary.days_remaining} days</small>}</td><td>{row.summary.payment_status}</td><td>{row.subscription.trial_end_date?<>Trial: {formatDate(row.subscription.trial_end_date)}<small>{row.subscription.grace_end_date?`Grace: ${formatDate(row.subscription.grace_end_date)}`:''}</small></>:row.subscription.end_date?`Valid to ${formatDate(row.subscription.end_date)}`:'—'}</td><td className="subscription-actions">{row.subscription.subscription_type==='TRIAL'&&<button type="button" className="secondary" onClick={()=>platformExtendTrialFromSubscription(row)}>＋ Extend Trial</button>}<button type="button" className="secondary" onClick={()=>loadPlatformSubscriptionHistory(platformToken,row.account.tenant_id)}>🕘 History</button><button type="button" className="secondary" onClick={()=>platformGrantComplimentary(row)}>🎁 Complimentary</button></td></tr>)}</tbody></table></div>
            {platformSubscriptionHistoryTenantId&&<div className="platform-subscription-history">
              <div className="section-title-row"><div><h3>Subscription History</h3><p className="help-text">Every plan, trial, complimentary-access and lifecycle change for the selected apartment account is retained here.</p></div><button type="button" className="secondary" onClick={()=>{setPlatformSubscriptionHistoryTenantId('');setPlatformSubscriptionHistory([])}}>Close</button></div>
              <div className="table-scroll business-grid"><table><thead><tr><th>Date / Time</th><th>Action</th><th>Previous Plan</th><th>New Plan</th><th>Previous Status</th><th>New Status</th><th>Trial / Validity</th><th>Changed By</th><th>Reason</th></tr></thead><tbody>{platformSubscriptionHistory.length===0?<tr><td colSpan={9} className="empty">No subscription history found.</td></tr>:platformSubscriptionHistory.map((h:any)=><tr key={h.id}><td>{formatDateTime(h.changed_at)}</td><td><b>{h.action}</b></td><td>{platformPlans.find((p:any)=>p.id===h.old_plan_id)?.name||'—'}</td><td>{platformPlans.find((p:any)=>p.id===h.new_plan_id)?.name||'—'}</td><td>{h.old_status||'—'}</td><td>{h.new_status||'—'}</td><td>{h.new_trial_end?formatDate(h.new_trial_end):'—'}</td><td>{h.changed_by||'—'}</td><td>{h.reason||'—'}</td></tr>)}</tbody></table></div>
            </div>}
          </section>}

          {platformConsoleTab==='audit' && <section className="panel platform-property audit-history-console"><div className="section-title-row"><div><h2>🔐 Global Login & Audit History</h2><p className="subtitle">Search, filter, download or delete only records matching the entered criteria. Account and User filters are tenant-aware.</p></div><span className="audit-count-badge">{platformLoginHistory.length} shown</span></div><div className="audit-filter-grid"><label className="wide">🔎 Search<input value={platformAuditSearch} onChange={e=>setPlatformAuditSearch(e.target.value)} placeholder="Account / Apartment / User / Event / Details"/></label><label>Account Number<input value={platformAuditAccount} onChange={e=>setPlatformAuditAccount(e.target.value)} placeholder="IN-TS-ACL-..."/></label><label>User ID<input value={platformAuditUser} onChange={e=>setPlatformAuditUser(e.target.value)} placeholder="User ID"/></label><label>Event<select value={platformAuditEvent} onChange={e=>setPlatformAuditEvent(e.target.value)}><option value="">All Events</option><option>Login</option><option>Logout</option><option>Failed Login</option><option>Password Changed</option><option>Password Reset</option><option>Apartment Account Created</option><option>Audit History Purged</option></select></label><label>From Date<input type="date" lang="en-GB" value={platformAuditFrom} onChange={e=>setPlatformAuditFrom(e.target.value)}/></label><label>To Date<input type="date" lang="en-GB" value={platformAuditTo} onChange={e=>setPlatformAuditTo(e.target.value)}/></label></div><div className="audit-toolbar"><button type="button" onClick={()=>loadPlatformLoginHistory(platformToken)}>🔎 Apply Filters</button><button type="button" className="secondary" onClick={()=>{setPlatformAuditSearch('');setPlatformAuditAccount('');setPlatformAuditUser('');setPlatformAuditEvent('');setPlatformAuditFrom('');setPlatformAuditTo('');setTimeout(()=>loadPlatformLoginHistory(platformToken),0)}}>↻ Reset</button><button type="button" className="secondary" onClick={downloadPlatformAuditHistory}>⬇ Download CSV</button><button type="button" className="danger" onClick={purgePlatformAuditHistory}>🗑 Delete Matching Records</button></div><div className="audit-safety-note">⚠️ Delete uses <b>AND criteria</b>: every populated filter must match. A blank field means “Any”. The purge event itself is retained.</div><div className="table-scroll business-grid audit-results-scroll"><table><thead><tr><th>Date / Time</th><th>Account Number</th><th>Apartment</th><th>User ID</th><th>Event</th><th>Status</th><th>Reason / Details</th></tr></thead><tbody>{platformLoginHistory.length===0?<tr><td colSpan={7} className="empty">No records match the selected criteria.</td></tr>:platformLoginHistory.map((h:any,idx:number)=><tr key={`${h.id||'h'}-${idx}`}><td>{formatDateTime(h.at)}</td><td>{h.account_id||'Platform'}</td><td>{h.apartment_name||'Platform'}</td><td>{h.username||'—'}</td><td><b>{h.event||'—'}</b></td><td>{h.status||'—'}</td><td>{h.reason||'—'}</td></tr>)}</tbody></table></div></section>}
          {platformConsoleTab==='recovery' && <section className="panel platform-property platform-recovery-panel">
            <div className="ac-page-hero recovery-page-hero">
              <div className="ac-page-icon" aria-hidden="true">🔐</div>
              <div className="ac-page-copy">
                <div className="ac-eyebrow">SECURE PLATFORM SUPPORT</div>
                <h2>Tenant &amp; Admin Password Recovery</h2>
                <p>Recover passwords for users belonging to a selected Apartment Account. Recovery remains tenant-scoped and every reset is recorded in Global Login &amp; Audit History.</p>
              </div>
              <span className="platform-recovery-badge">Super Admin</span>
            </div>
            <div className="platform-recovery-toolbar">
              <label>🔎 Search Apartment Account
                <input value={platformRecoveryAccountSearch} onChange={e=>setPlatformRecoveryAccountSearch(e.target.value)} placeholder="Account Number / Apartment / Admin / Mobile" />
              </label>
              <label>Select Apartment Account
                <select value={platformRecoveryTenantId} onChange={e=>loadPlatformRecoveryProperty(platformToken,e.target.value)}>
                  <option value="">Select Apartment Account</option><option value="ALL">All Apartment Accounts</option>
                  {platformAccounts.filter((a:any)=>{const q=platformRecoveryAccountSearch.trim().toLowerCase();if(!q)return true;const users=a.users||[];const admin=users.find((u:any)=>u.role==='Admin')||users[0];return [a.account_id,a.apartment_name,a.city,a.state,a.country,a.account_mobile,a.account_email,admin?.username,admin?.full_name,admin?.mobile_no,admin?.email].some((v:any)=>String(v||'').toLowerCase().includes(q));}).map((a:any)=><option key={a.tenant_id} value={a.tenant_id}>{a.account_id} — {a.apartment_name}</option>)}
                </select>
              </label>
              <button type="button" className="secondary recovery-refresh-button" onClick={()=>platformRecoveryTenantId&&loadPlatformRecoveryProperty(platformToken,platformRecoveryTenantId)}>↻ Refresh Users</button>
            </div>
            {platformRecoveryProperty?<>
              <div className="platform-recovery-summary"><div><span>Account</span><b>{platformRecoveryProperty.account_id}</b></div><div><span>Apartment</span><b>{platformRecoveryProperty.apartment_name}</b></div><div><span>Status</span><b>{platformRecoveryProperty.status}</b></div><div><span>Users</span><b>{(platformRecoveryProperty.users||[]).length}</b></div></div>
              <div className="platform-recovery-note">Resetting a password creates a temporary password and forces the selected user to change it at next login. Platform Owner can reset Admin, Viewer, Caretaker and Supervisor users within the selected tenant; <b>All</b> lists users across all tenant accounts for controlled support. The action is recorded in Global Login &amp; Audit History.</div>
              <div className="platform-recovery-user-toolbar">
                <label>Search Tenant Users
                  <input value={platformRecoveryUserSearch} onChange={e=>setPlatformRecoveryUserSearch(e.target.value)} placeholder="User ID / Name / Email / Mobile / Role" />
                </label>
                <button type="button" className="secondary" onClick={()=>setPlatformRecoveryUserSearch('')}>Clear Search</button>
              </div>
              <div className="platform-recovery-user-grid">{(()=>{const q=platformRecoveryUserSearch.trim().toLowerCase();const users=(platformRecoveryProperty.users||[]).filter((u:any)=>!q||[u.username,u.full_name,u.role,u.email,u.mobile_no,u.active?'Active':'Inactive',u.locked?'Locked':'Open'].some((v:any)=>String(v||'').toLowerCase().includes(q)));return users.length===0?<div className="platform-recovery-empty">{q?'No matching tenant users found.':'No users available for this apartment.'}</div>:users.map((u:any)=>{const tid=platformRecoveryProperty.tenant_id==='ALL'?u._tenant_id:platformRecoveryProperty.tenant_id;const hist=(platformLoginHistory||[]).filter((h:any)=>String(h.username||'').toLowerCase()===String(u.username||'').toLowerCase() && (!tid || !h.tenant_id || h.tenant_id===tid));const last=hist[0];const initials=String(u.full_name||u.username||'U').trim().split(/\s+/).slice(0,2).map((x:string)=>x[0]).join('').toUpperCase();return <article className="platform-user-card" key={`${u.id}-${tid||'all'}`}><div className="platform-user-card-top"><div className="platform-user-avatar">{initials||'U'}</div><div className="platform-user-identity"><div className="platform-user-name">{u.full_name||'Unnamed User'}</div><div className="platform-user-id">{u.username}</div></div><span className={`platform-role-badge role-${String(u.role||'user').toLowerCase()}`}>{u.role}</span></div><div className="platform-user-meta"><div><span>Apartment</span><b>{platformRecoveryProperty.tenant_id==='ALL'?(u._apartment_name||'—'):(platformRecoveryProperty.apartment_name||'—')}</b></div><div><span>Email</span><b>{u.email||'—'}</b></div><div><span>Mobile</span><b>{u.mobile_no||'—'}</b></div><div><span>Status</span><b className={u.locked?'user-status-locked':u.active?'user-status-active':'user-status-inactive'}>{u.locked?'Locked':u.active?'Active':'Inactive'}</b></div></div><div className="platform-user-card-footer"><div className="platform-user-activity"><span>Last Activity</span><b>{last?formatDateTime(last.at):'No history'}</b><small>{hist.length} audit event{hist.length===1?'':'s'}</small></div><div className="platform-user-actions"><button type="button" className="secondary" onClick={()=>platformResetUser(u.id,tid)}>🔑 Reset Password</button>{u.locked&&<button type="button" className="secondary" onClick={()=>platformUnlock(u.id,tid)}>🔓 Unlock / Activate</button>}</div></div></article>})})()}</div>
            </>:<div className="empty">Select an Apartment Account above. The selected tenant's Admins and users will be shown here for controlled password recovery.</div>}
          </section>}
          <div className="form-actions platform-logout-row"><button type="button" className="auth-secondary-button" onClick={platformLogout}>🔒 Logout Platform Owner</button></div>
        </>:<>
          {platformAuthView==='forgot'?<><h2>Forgot Platform Password</h2><p className="subtitle">Enter your Platform Owner User ID and registered recovery email. A one-time reset code will be emailed to you.</p><form className="resident-form auth-form" onSubmit={requestPlatformPasswordReset}><label>Platform User ID<input required value={platformForgot.username} onChange={e=>setPlatformForgot({...platformForgot,username:e.target.value})}/></label><label>Registered Recovery Email<input required type="email" value={platformForgot.email} onChange={e=>setPlatformForgot({...platformForgot,email:e.target.value})}/></label><div className="form-actions"><button type="submit" className="auth-primary-button">📧 Send Platform Reset Email</button></div></form><button type="button" className="auth-back-button" onClick={()=>{resetPlatformAuthState();setPlatformLoginError('');setAuthMode('platform')}}>← Back to Platform Owner Login</button></>:platformAuthView==='reset'?<><h2>Reset Platform Password</h2><p className="subtitle">Enter the one-time code received by email and create a new Platform Owner password.</p><form className="resident-form auth-form" onSubmit={confirmPlatformPasswordReset}><label>Reset Code<input required value={platformReset.token} onChange={e=>setPlatformReset({...platformReset,token:e.target.value})}/></label><label>New Password<div className="password-field"><input required minLength={8} type={showPassword?'text':'password'} value={platformReset.new_password} onChange={e=>setPlatformReset({...platformReset,new_password:e.target.value})}/><button type="button" className="password-toggle eye-toggle" onClick={()=>setShowPassword(!showPassword)}>{eye(showPassword)}</button></div></label><label>Confirm Initial Password<div className="password-field"><input required minLength={8} type={showConfirmPassword?'text':'password'} value={platformReset.confirm_password} onChange={e=>setPlatformReset({...platformReset,confirm_password:e.target.value})}/><button type="button" className="password-toggle eye-toggle" onClick={()=>setShowConfirmPassword(!showConfirmPassword)}>{eye(showConfirmPassword)}</button></div></label><div className="form-actions"><button type="submit" className="auth-primary-button">🔐 Reset Platform Password</button></div></form><div className="auth-navigation"><button type="button" className="auth-back-button" onClick={()=>{resetPlatformAuthState();setPlatformLoginError('');setAuthMode('platform')}}>← Back to Platform Owner Login</button></div></>:<><div className="platform-auth-heading"><div className="platform-brand-icon" aria-hidden="true">🛡️</div><div><h2>{platformInitialized?'Platform Owner Login':'Set Up Platform Owner'}</h2><p>Secure Product Owner access and controlled platform administration.</p></div></div><form key={platformAuthFormKey} autoComplete="off" className="resident-form auth-form" onSubmit={platformSignIn}>{!platformInitialized&&<label>Full Name<input required value={platformBootstrap.full_name} onChange={e=>setPlatformBootstrap({...platformBootstrap,full_name:e.target.value})}/></label>}{!platformInitialized&&<label>Recovery Email<input required type="email" value={platformBootstrap.email} onChange={e=>setPlatformBootstrap({...platformBootstrap,email:e.target.value})}/></label>}<label>{platformInitialized?'Platform Owner User ID / Recovery Email':'Platform Owner User ID'}<input autoComplete="off" autoCapitalize="none" readOnly name={`platform-owner-user-id-${platformAuthFormKey}`} onFocus={e=>e.currentTarget.removeAttribute('readonly')} required value={platformInitialized?platformLogin.username:platformBootstrap.username} onChange={e=>platformInitialized?setPlatformLogin({...platformLogin,username:e.target.value}):setPlatformBootstrap({...platformBootstrap,username:e.target.value})}/></label><label>Password<div className="password-field"><input autoComplete="new-password" readOnly name={`platform-owner-password-${platformAuthFormKey}`} onFocus={e=>e.currentTarget.removeAttribute('readonly')} required minLength={8} type={showPassword?'text':'password'} value={platformInitialized?platformLogin.password:platformBootstrap.password} onChange={e=>platformInitialized?setPlatformLogin({...platformLogin,password:e.target.value}):setPlatformBootstrap({...platformBootstrap,password:e.target.value})}/><button type="button" className="password-toggle eye-toggle" aria-label="Show or hide password" onClick={()=>setShowPassword(!showPassword)}>{eye(showPassword)}</button></div></label><div className="form-actions auth-login-actions"><button type="submit" className="auth-primary-button" disabled={platformBusy}>{platformBusy?'⏳ Signing in…':(platformInitialized?'🛡️ Sign in as Platform Owner':'🛡️ Create Platform Owner')}</button>{platformLoginError&&<div className="login-inline-feedback platform-login-feedback" role="alert"><span>⚠</span><span>{platformLoginError}</span></div>}</div></form>{platformInitialized&&<button type="button" className="auth-secondary-button" onClick={()=>setPlatformAuthView('forgot')}>🔑 Forgot Platform Password</button>}<button type="button" className="auth-secondary-button platform-return-button" onClick={()=>{resetPlatformAuthState();setPlatformLoginError('');setAuthMode('login');setLoginError('')}}>← Back to Property Login</button></>}
      </>}
      <div className="auth-links">{accountInitialized && <button type="button" className="auth-secondary-button" onClick={()=>{if(!showCreate)setAccountForm(newApartmentAccountForm());setAuthMode(showCreate?'login':'create');setLoginError('')}}>{showCreate?'← Already have an account? Login':'＋ Create New Apartment Account'}</button>}<button type="button" className="auth-secondary-button platform-link" onClick={()=>{resetPlatformAuthState();setPlatformLoginError('');setAuthMode('platform');setLoginError('')}}>🛡️ Platform Owner Access</button></div>
    </section></div>;
  }

    return <div className="auth-shell"><section className="auth-card">
      <style>{`
        .auth-shell{min-height:100vh!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:28px!important;background:radial-gradient(circle at 15% 10%,rgba(15,159,154,.18),transparent 28%),linear-gradient(135deg,#172033 0%,#1e293b 52%,#20364b 100%)!important;color:#334155!important;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif!important}
        .auth-card{width:min(1040px,100%)!important;max-width:1040px!important;padding:34px!important;border:1px solid rgba(255,255,255,.55)!important;border-radius:24px!important;background:rgba(255,255,255,.97)!important;box-shadow:0 28px 80px rgba(0,0,0,.28)!important;backdrop-filter:blur(12px)!important}
        .auth-brand{display:flex!important;align-items:center!important;gap:24px!important;padding:0 0 24px!important;border-bottom:1px solid #dbe4ef!important;margin-bottom:24px!important}
        .auth-logo{width:150px!important;height:105px!important;display:flex!important;align-items:center!important;justify-content:center!important;background:#fff!important;border-radius:18px!important;border:1px solid #dbe4ef!important;overflow:hidden!important;box-shadow:0 8px 22px rgba(23,43,77,.08)!important;flex:0 0 auto!important}
        .auth-logo img{width:138px!important;height:94px!important;object-fit:contain!important}
        .auth-brand h1{font-size:32px!important;line-height:1.1!important;color:#172b4d!important;margin:0 0 8px!important;font-weight:850!important;letter-spacing:-.03em!important}
        .auth-brand p{font-size:16px!important;color:#315f96!important;font-weight:750!important;margin:0 0 4px!important}.auth-brand em{font-style:normal!important;color:#0f8a5f!important;font-weight:650!important}
        .auth-widgets{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:14px!important;margin:0 0 24px!important}.auth-widget{padding:16px!important;border:1px solid #dbe4ef!important;border-radius:14px!important;background:linear-gradient(145deg,#fff,#f5f8fc)!important;box-shadow:0 7px 18px rgba(23,43,77,.06)!important}.auth-widget span{font-size:20px!important}.auth-widget b{display:block!important;margin:7px 0 4px!important;color:#172b4d!important}.auth-widget small{color:#64748b!important;line-height:1.4!important}
        .auth-form{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:16px!important;padding:20px!important;background:#f8fafc!important;border:1px solid #dbe4ef!important;border-radius:16px!important}.auth-form h3,.auth-form .form-actions,.auth-form .field-hint{grid-column:1/-1!important}.auth-form label{display:flex!important;flex-direction:column!important;gap:7px!important;color:#334155!important;font-weight:750!important}.auth-form input,.auth-form select{width:100%!important;max-width:100%!important;min-width:0!important;min-height:44px!important;box-sizing:border-box!important;border:1px solid #c8d5e5!important;border-radius:10px!important;background:#fff!important;padding:10px 12px!important;color:#172b4d!important}.auth-form>label{min-width:0!important;box-sizing:border-box!important}.auth-form .password-field{min-width:0!important}.auth-form .password-field input{min-width:0!important;box-sizing:border-box!important}.auth-form input:focus,.auth-form select:focus{outline:none!important;border-color:#2563eb!important;box-shadow:0 0 0 3px rgba(37,99,235,.12)!important}
        /* V6.5.13 ALIGNMENT FIX 5 — password fields stay on one row with a proper eye button. */
        .auth-card .auth-form .password-field{display:grid!important;grid-template-columns:minmax(0,1fr) 44px!important;align-items:stretch!important;gap:8px!important;width:100%!important;min-width:0!important;box-sizing:border-box!important}
        .auth-card .auth-form .password-field input{grid-column:1!important;width:100%!important;min-width:0!important;max-width:none!important}
        .auth-card .auth-form .password-field .password-toggle{grid-column:2!important;width:44px!important;min-width:44px!important;height:44px!important;min-height:44px!important;max-height:44px!important;display:flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;border:1px solid #c8d5e5!important;border-radius:10px!important;background:#edf4ff!important;color:#172b4d!important;font-size:17px!important;line-height:1!important;padding:0!important;margin:0!important;cursor:pointer!important;box-shadow:0 2px 6px rgba(23,43,77,.06)!important}
        .auth-card .auth-form .password-field .password-toggle:hover{background:#e2edff!important;border-color:#9dbbe8!important}
        .auth-card .auth-form .password-form-field .password-help,.auth-card .auth-form .password-form-field .password-help-spacer{display:block!important;line-height:1.45!important;min-height:0!important;margin:0!important}
        .auth-card .auth-form .password-form-field .password-field{margin-top:0!important}
        .auth-card{box-sizing:border-box!important;min-width:0!important}
        @media(max-width:760px){.auth-card .auth-form{grid-template-columns:1fr!important}.auth-card .auth-form .password-field{grid-template-columns:minmax(0,1fr) 44px!important}}
        /* V6.5.11: Remember control is intentionally NOT an input checkbox. */
        .auth-card .remember-login{display:inline-flex!important;align-items:center!important;gap:8px!important;min-height:24px!important;color:#334155!important;font-weight:700!important}
        .auth-card .remember-toggle{appearance:none!important;-webkit-appearance:none!important;width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;max-width:16px!important;max-height:16px!important;box-sizing:border-box!important;flex:0 0 16px!important;margin:0!important;padding:0!important;border:1px solid #9aabc0!important;border-radius:4px!important;background:#fff!important;box-shadow:none!important;display:inline-grid!important;place-items:center!important;cursor:pointer!important;line-height:1!important} .remember-login .remember-toggle,.platform-owner-auth-shell .remember-toggle{width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;max-width:16px!important;max-height:16px!important;inline-size:16px!important;block-size:16px!important;flex:0 0 16px!important;padding:0!important;margin:0!important;border:1px solid #9aabc0!important;box-sizing:border-box!important;appearance:none!important;-webkit-appearance:none!important;transform:none!important}
        .remember-toggle.is-checked{background:#2563eb!important;border-color:#2563eb!important}
        .remember-toggle-mark{display:none!important;color:#fff!important;font-size:11px!important;font-weight:900!important;line-height:1!important}
        .remember-toggle.is-checked .remember-toggle-mark{display:block!important}
        .remember-toggle:focus-visible{outline:2px solid rgba(37,99,235,.28)!important;outline-offset:2px!important}
        .auth-card .remember-login>span{line-height:1.35!important}
        .auth-primary-button{background:linear-gradient(135deg,#2563eb,#0f9f9a)!important;color:#fff!important;border:0!important;border-radius:11px!important;min-height:44px!important;padding:10px 18px!important;font-weight:800!important;box-shadow:0 8px 18px rgba(37,99,235,.22)!important}.auth-secondary-button,.auth-back-button{background:#fff!important;color:#315f96!important;border:1px solid #c8d5e5!important;border-radius:10px!important;min-height:40px!important;padding:8px 14px!important;font-weight:750!important}.account-id-preview{padding:13px 15px!important;border:1px solid #bfdbfe!important;border-radius:12px!important;background:#eff6ff!important;color:#1d4ed8!important;font-weight:750!important;margin-bottom:14px!important}
        @media(max-width:760px){.auth-shell{padding:14px!important}.auth-card{padding:20px!important;border-radius:18px!important}.auth-brand{align-items:flex-start!important;flex-direction:column!important}.auth-widgets,.auth-form{grid-template-columns:1fr!important}.auth-logo{width:130px!important;height:92px!important}.auth-logo img{width:120px!important;height:84px!important}.auth-brand h1{font-size:26px!important}}
      
      /* V6.5.13 CORE FUNCTIONALITY FIX 15 — Platform Owner branding alignment */
      .platform-owner-auth-shell .auth-brand{
        display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:flex-start!important;
        gap:18px!important;width:100%!important;box-sizing:border-box!important;text-align:left!important;
      }
      .platform-owner-auth-shell .auth-brand .auth-logo{
        flex:0 0 88px!important;width:88px!important;height:68px!important;display:flex!important;align-items:center!important;justify-content:center!important;
        margin:0!important;border-radius:14px!important;overflow:hidden!important;background:#fff!important;border:1px solid #dbe5ef!important;padding:4px!important;
      }
      .platform-owner-auth-shell .auth-brand .auth-logo img{width:100%!important;height:100%!important;object-fit:contain!important;display:block!important}
      .platform-owner-auth-shell .auth-brand-copy{display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:center!important;min-width:0!important}
      .platform-owner-auth-shell .auth-brand-copy h1{margin:0!important;line-height:1.12!important}
      .platform-owner-auth-shell .auth-brand-copy p{margin:5px 0 0!important}
      .platform-owner-auth-shell .auth-brand-copy em{display:block!important;margin:5px 0 0!important}
      @media(max-width:600px){
        .platform-owner-auth-shell .auth-brand{gap:12px!important}
        .platform-owner-auth-shell .auth-brand .auth-logo{flex-basis:72px!important;width:72px!important;height:56px!important}
        .platform-owner-auth-shell .auth-brand-copy h1{font-size:22px!important}
      }
`}</style>
      <div className="auth-brand"><div className="auth-logo"><img src="/apartcare-lite-logo.png" alt="ApartCare Lite"/></div><div><h1>ApartCare Lite</h1><p>Your daily partner in property care.</p><em>Helping you run your building beautifully.</em></div></div><div className="auth-widgets"><div className="auth-widget"><span>🏢</span><b>Property Operations</b><small>Maintenance, payments and residents in one place</small></div><div className="auth-widget"><span>📊</span><b>Financial Clarity</b><small>Connected dashboard, expenses and reports</small></div><div className="auth-widget"><span>🔐</span><b>Secure Roles</b><small>Admin and Viewer access with controlled sessions</small></div></div>
      {loginError&&<div className="message">{loginError}</div>}
      {showCreate ? <>
        <h2>Create Apartment Account</h2><div className="account-id-preview">Account Number will be generated automatically after validation.<span className="field-hint">Country Code – State Code – ACL – Date – Sequence</span></div><p className="subtitle">Admin and Viewer access is created inside the property. Platform Super Admin remains exclusive to the Product Owner.</p>
        <form className="resident-form auth-form" onSubmit={createApartmentAccount}><h3>Apartment Profile</h3><label>Apartment Name<input required value={accountForm.apartment_name} onChange={e=>setAccountForm({...accountForm,apartment_name:e.target.value})}/></label><label>Address<input required value={accountForm.address} onChange={e=>setAccountForm({...accountForm,address:e.target.value})}/></label><label>City<select required value={accountForm.city} onChange={e=>setAccountForm({...accountForm,city:e.target.value})}><option value="">Select City</option>{CITY_OPTIONS.map(x=><option key={x}>{x}</option>)}</select></label><label>State<select required value={accountForm.state} onChange={e=>setAccountForm({...accountForm,state:e.target.value})}><option value="">Select State</option>{STATE_OPTIONS.map(x=><option key={x}>{x}</option>)}</select></label><label>PIN Code<input required value={accountForm.pin_code} onChange={e=>setAccountForm({...accountForm,pin_code:e.target.value})}/></label><label>Country<select required value={accountForm.country} onChange={e=>setAccountForm({...accountForm,country:e.target.value})}>{COUNTRY_OPTIONS.map(x=><option key={x}>{x}</option>)}</select></label><label>Language<select value={accountForm.language} onChange={e=>setAccountForm({...accountForm,language:e.target.value})}><option>English</option><option>Hindi</option><option>Telugu</option></select></label><div className="field-hint operational-start-note">Operational data month selection is derived from the tenant's locked Go-Live Opening Balance. Until an Opening Balance is locked, all MM/YYYY periods remain available.</div><h3>Property Administrator</h3><label>Administrator Name<input required value={accountForm.admin_name} onChange={e=>setAccountForm({...accountForm,admin_name:e.target.value})}/></label><label>Administrator Email<span className="field-hint">Mandatory — welcome email and Account ID are sent here.</span><input required type="email" value={accountForm.admin_email} onChange={e=>setAccountForm({...accountForm,admin_email:e.target.value})}/></label><label>Administrator Mobile Number<input required inputMode="tel" value={accountForm.admin_mobile} onChange={e=>setAccountForm({...accountForm,admin_mobile:e.target.value})}/></label><label>Administrator User ID<input value={accountForm.admin_username} onChange={e=>setAccountForm({...accountForm,admin_username:e.target.value})}/></label><label className="password-form-field initial-password-field"><span className="field-label">Initial Password</span><span className="field-hint password-help">This is the Administrator login password. A password change is required only after an explicit password reset.</span><div className="password-field"><input required minLength={8} type={showCreatePassword?'text':'password'} value={accountForm.password} onChange={e=>setAccountForm({...accountForm,password:e.target.value})}/><button type="button" className="password-toggle eye-toggle" onClick={()=>setShowCreatePassword(!showCreatePassword)}>{eye(showCreatePassword)}</button></div></label><label className="password-form-field confirm-password-field"><span className="field-label">Confirm Password</span><span className="field-hint password-help-spacer" aria-hidden="true">&nbsp;</span><div className="password-field"><input required minLength={8} type={showConfirmPassword?'text':'password'} value={accountForm.confirm_password} onChange={e=>setAccountForm({...accountForm,confirm_password:e.target.value})}/><button type="button" className="password-toggle eye-toggle" onClick={()=>setShowConfirmPassword(!showConfirmPassword)}>{eye(showConfirmPassword)}</button></div></label><div className="form-actions"><button type="submit" className="auth-primary-button" disabled={accountBusy}>{accountBusy?'⏳ Creating Apartment Account…':'🏢 Create Apartment Account'}</button></div></form><div className="auth-navigation"><button type="button" className="auth-back-button" onClick={()=>{setAuthMode('login');setLoginError('')}}>← Back to Login</button></div>
      </> : authMode==='forgot' ? <><h2>Forgot Password</h2><p className="subtitle">Enter the property Account ID and the registered Administrator Email or User ID. A secure reset code will be sent only to the registered email address.</p><form className="resident-form auth-form" onSubmit={requestPasswordReset}><label>Account ID<input required placeholder={accountExample} value={forgotForm.account_id} onChange={e=>setForgotForm({...forgotForm,account_id:e.target.value.toUpperCase()})}/></label><label>Registered Email / User ID<input required value={forgotForm.email_or_username} onChange={e=>setForgotForm({...forgotForm,email_or_username:e.target.value})}/></label><div className="form-actions"><button type="submit" className="auth-primary-button">📧 Send Password Reset Email</button></div></form><div className="auth-navigation"><button type="button" className="auth-back-button" onClick={()=>{setAuthMode('login');setLoginError('')}}>← Back to Login</button></div></> : authMode==='reset' ? <><h2>Reset Password</h2><p className="subtitle">Check your registered email for the one-time reset code. The code expires after 30 minutes.</p><form className="resident-form auth-form" onSubmit={confirmPasswordReset}><label>Reset Code<input required value={resetForm.token} onChange={e=>setResetForm({...resetForm,token:e.target.value})}/></label><label>New Password<div className="password-field"><input required minLength={8} type={showForgotPassword?'text':'password'} value={resetForm.new_password} onChange={e=>setResetForm({...resetForm,new_password:e.target.value})}/><button type="button" className="password-toggle eye-toggle" onClick={()=>setShowForgotPassword(!showForgotPassword)}>{eye(showForgotPassword)}</button></div></label><label>Confirm Password<div className="password-field"><input required minLength={8} type={showConfirmPassword?'text':'password'} value={resetForm.confirm_password} onChange={e=>setResetForm({...resetForm,confirm_password:e.target.value})}/><button type="button" className="password-toggle eye-toggle" onClick={()=>setShowConfirmPassword(!showConfirmPassword)}>{eye(showConfirmPassword)}</button></div></label><div className="form-actions"><button type="submit" className="auth-primary-button">🔐 Reset Password</button></div></form><button type="button" className="auth-back-button" onClick={()=>{setAuthMode('login');setLoginError('')}}>← Back to Login</button></> : <><h2>Login to Your Property</h2><p className="subtitle">Sign in securely with your Account ID, registered Email / User ID and password. Apartment access uses Admin, Viewer, Caretaker and Supervisor roles.</p><form className="resident-form auth-form" onSubmit={loginToApartCare}><label>Apartment Account Number<span className="field-hint">Optional. Leave blank if you do not remember the Account Number.</span><input placeholder={accountExample} value={loginForm.account_id} onChange={e=>setLoginForm({...loginForm,account_id:e.target.value.toUpperCase()})}/></label><label>User ID / Email / Mobile Number<span className="field-hint">Use any one registered identifier.</span><input required value={loginForm.username} onChange={e=>setLoginForm({...loginForm,username:e.target.value})}/></label><label>Password<div className="password-field"><input required type={showPassword?'text':'password'} value={loginForm.password} onChange={e=>setLoginForm({...loginForm,password:e.target.value})}/><button type="button" className="password-toggle eye-toggle" aria-label="Show or hide password" onClick={()=>setShowPassword(!showPassword)}>{eye(showPassword)}</button></div></label><div className="remember-login" role="group" aria-label="Remember Account Number and User on this device"><button type="button" className={`remember-toggle ${rememberLogin?'is-checked':''}`} role="switch" aria-checked={rememberLogin} aria-label="Remember Account Number and User on this device" onClick={()=>{const next=!rememberLogin;setRememberLogin(next);if(!next)window.localStorage.removeItem('apartcare_login_identity')}}><span className="remember-toggle-mark" aria-hidden="true">✓</span></button><span>Remember Account Number & User on this device</span></div><div className="remember-note">Your browser may securely remember the password using its password manager. ApartCare does not store your password in application storage.</div><div className="form-actions auth-login-actions"><button type="submit" className="auth-primary-button">🔐 Login</button>{loginError&&<div className="login-inline-feedback" role="alert"><span>⚠</span><span>{loginError}</span></div>}</div>{loginAccountChoices.length>0&&<div className="login-account-choice" role="dialog" aria-label="Select apartment account"><h3>Select Apartment Account</h3><p>Your User ID, Email or Mobile is registered in more than one apartment. Choose the apartment you want to access.</p><div className="login-account-choice-list">{loginAccountChoices.map((a:any)=><button key={a.tenant_id} type="button" className="login-account-choice-card" onClick={()=>{setLoginForm(prev=>({...prev,account_id:String(a.account_id||'')}));setLoginAccountChoices([]);setLoginError('');setTimeout(()=>document.querySelector<HTMLButtonElement>('.auth-login-actions .auth-primary-button')?.click(),0);}}><strong>{a.apartment_name||'Apartment'}</strong><span>{a.account_id}</span><small>{[a.city,a.state].filter(Boolean).join(', ')}</small></button>)}</div></div>}</form><button type="button" className="auth-secondary-button" onClick={()=>{setAuthMode('forgot');setLoginError('')}}>🔑 Forgot Password</button></>}
      <div className="auth-links">{accountInitialized && <button type="button" className="auth-secondary-button" onClick={()=>{setAuthMode(showCreate?'login':'create');setLoginError('')}}>{showCreate?'← Already have an account? Login':'＋ Create New Apartment Account'}</button>}<button type="button" className="auth-secondary-button platform-link" onClick={()=>{resetPlatformAuthState();setPlatformLoginError('');setAuthMode('platform');setLoginError('')}}>🛡️ Platform Owner Access</button></div>
    </section></div>;
  }

  return <div className={`shell ${['Viewer','Supervisor','Caretaker'].includes(currentUser.role)?'viewer-mode':''}`}>
    {platformSupportMode&&<div className="platform-support-banner"><b>🔎 PLATFORM OWNER AUDIT / SUPPORT SESSION</b><span>{platformSupportAccount?.account_id} · {platformSupportAccount?.apartment_name}</span><small>Read-only session. Property changes are blocked.</small><button type="button" onClick={exitPlatformSupport}>Exit Audit / Support</button></div>}
    <aside className="sidebar">
      <div className="side-brand"><img src="/apartcare-lite-logo.png" alt="ApartCare Lite" className="app-logo-sidebar"/><div className="side-brand-copy"><strong>ApartCare Lite</strong><span>Your daily partner in property care.</span><small>GKMA Solutions</small></div></div>
      <div className="tag">Helping you run your building beautifully.</div>
      <div className="user-session"><b>{currentUser.full_name}</b><span>{currentUser.role}</span>{accountId ? <div className="user-account-context"><small>{accountDisplay(accountId,settingsForm.country,settingsForm.state)}</small><div className="user-language-preference"><label htmlFor="user-language-select">My Language</label><select id="user-language-select" value={activeLanguage} disabled={languageSaving} onChange={e=>saveUserLanguagePreference(String(e.target.value) as any)}><option value="English">English</option><option value="Telugu">తెలుగు — Telugu</option><option value="Hindi">हिन्दी — Hindi</option><option value="Tamil">தமிழ் — Tamil</option><option value="Kannada">ಕನ್ನಡ — Kannada</option></select>{languageMessage&&<small className="user-language-message">{languageMessage}</small>}</div></div> : null}<button type="button" className="secondary" onClick={logoutApartCare}>Logout</button></div>
      <nav className="nav">
        {(currentUser.role==='Admin'||currentUser.role==='Viewer') && <button className={tab==='Dashboard'?'active':''} onClick={()=>setTab('Dashboard')}>Dashboard</button>}
        {currentUser.role==='Admin' && <button className={tab==='Residents'?'active':''} onClick={openResidents}>Residents</button>}
        {currentUser.role==='Admin'||['Supervisor','Caretaker'].includes(currentUser.role) ? <button className={tab==='Monthly Maintenance'?'active':''} onClick={openMaintenance}>Monthly Maintenance</button> : null}
        {(['Admin','Viewer','Caretaker'].includes(currentUser.role)) ? <button className={tab==='Payments'?'active':''} onClick={()=>setTab('Payments')}>Payments</button> : null}
        {(['Admin','Viewer','Caretaker'].includes(currentUser.role)) && <button className={tab==='Expenses'?'active':''} onClick={()=>setTab('Expenses')}>Expenses</button>}
        {currentUser.role==='Admin' && <button className={tab==='Data Import'?'active':''} onClick={()=>setTab('Data Import')}>Data Import</button>}
        {(['Admin','Viewer','Supervisor','Caretaker'].includes(currentUser.role)) && <button className={tab==='Utilities'?'active':''} onClick={()=>{setTab('Utilities');loadUtilityContacts();}}>🧰 Utilities</button>}
        {(currentUser.role==='Admin'||currentUser.role==='Viewer') && <button className={tab==='Reports'?'active':''} onClick={()=>{setTab('Reports');loadReportFlats();loadOpeningBalance();}}>Reports</button>}
        {currentUser.role==='Admin' && <button className={tab==='Settings'?'active':''} onClick={()=>{setTab('Settings');loadSettings();loadWatchmen();loadOpeningBalance()}}>Settings</button>}
        {currentUser.role==='Admin' && <button className={tab==='Administration'?'active':''} onClick={()=>{setTab('Administration');loadAdmin()}}>Administration</button>}
        {currentUser.role==='Admin' && <button className={tab==='Subscription & Billing'?'active':''} onClick={()=>{setTab('Subscription & Billing');loadTenantSubscription(authToken)}}>💳 Subscription & Billing</button>}
      </nav>
    </aside>

      {mustChangePassword&&<div className="modal-backdrop"><section className="password-modal password-modal-branded"><div className="password-modal-brand"><img src="/apartcare-lite-logo.png" alt="ApartCare Lite"/><div><strong>ApartCare Lite</strong><span>Your daily partner in property care.</span></div></div><div className="modal-icon">🔐</div><h2>Change your password</h2><p>For security, newly created users and users whose password was reset must set a new password before using ApartCare.</p>{changePasswordMessage&&<div className="message">{changePasswordMessage}</div>}<form onSubmit={changePassword} noValidate autoComplete="off"><label>New Password<div className="password-field"><input required minLength={8} autoComplete="new-password" type={showPassword?'text':'password'} value={changePasswordForm.new_password} onChange={e=>setChangePasswordForm({...changePasswordForm,new_password:e.target.value})}/><button type="button" className="password-toggle" onClick={()=>setShowPassword(!showPassword)}>{showPassword?'🙈':'👁️'}</button></div></label><label>Confirm New Password<div className="password-field"><input required minLength={8} autoComplete="new-password" type={showConfirmPassword?'text':'password'} value={changePasswordForm.confirm_password} onChange={e=>setChangePasswordForm({...changePasswordForm,confirm_password:e.target.value})}/><button type="button" className="password-toggle" onClick={()=>setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword?'🙈':'👁️'}</button></div></label><div className="form-actions"><button type="submit" className="auth-primary-button password-update-button" aria-busy={changePasswordLoading}>{changePasswordLoading?'Updating Password…':'Update Password & Continue'}</button></div></form></section></div>}
      {showUnlockDialog&&currentUser?.role==='Admin'&&<div className="modal-backdrop"><section className="password-modal"><div className="modal-icon">🔓</div><h2>Unlock Go-Live Opening Balance</h2><p>The current locked version remains the active financial baseline until the corrected version is saved and locked.</p><label>Justification *<textarea required minLength={5} rows={4} value={unlockJustification} onChange={e=>setUnlockJustification(e.target.value)} placeholder="Enter the reason for this financial correction"/></label>{settingsMessage&&<div className="message">{settingsMessage}</div>}<div className="form-actions"><button type="button" className="secondary" onClick={()=>setShowUnlockDialog(false)}>Cancel</button><button type="button" className="auth-primary-button" onClick={confirmUnlockOpening}>Confirm Unlock</button></div></section></div>}
      {justificationDialog.open&&<div className="modal-backdrop justification-backdrop"><section className="password-modal lock-justification-modal"><div className="modal-icon">🔒</div><h2>{justificationDialog.title}</h2><p>{justificationDialog.description}</p><label>Justification *<textarea autoFocus required minLength={justificationDialog.minLength} rows={5} value={justificationDialog.value} onChange={e=>setJustificationDialog(x=>({...x,value:e.target.value}))} placeholder="Enter the reason for this lock or unlock action"/></label><div className="field-hint">This justification will be retained in the relevant history/audit record.</div><div className="form-actions"><button type="button" className="secondary" onClick={closeJustificationDialog}>Cancel</button><button type="button" className="auth-primary-button" onClick={confirmJustificationDialog}>{justificationDialog.locked?'🔒 Confirm Lock':'🔓 Confirm Unlock'}</button></div></section></div>}
    <main className="main">
      <style>{`
      :root{--ink:#334155;--blue:#3b68b8;--panel:#ffffff;--line:#d9e1ea}
      .shell{background:linear-gradient(135deg,#f6f8fc,#eef3f8);min-height:100vh;color:var(--ink);display:grid;grid-template-columns:minmax(260px,290px) minmax(0,1fr);width:100%;min-width:0;overflow-x:hidden}.main{background:transparent;min-width:0;width:100%;max-width:none;overflow-x:hidden}.sidebar{min-width:0;width:100%;box-sizing:border-box;position:sticky;top:0;height:100vh;overflow-y:auto;z-index:20}      .platform-console-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 18px;padding:7px;background:linear-gradient(135deg,#f8fbff,#eef4fa);border:1px solid #d7e2ee;border-radius:18px;box-shadow:0 8px 22px rgba(36,64,96,.08);position:sticky;top:8px;z-index:15}.platform-console-tabs button{position:relative;display:grid;grid-template-columns:34px 1fr;grid-template-rows:auto auto;column-gap:9px;align-items:center;text-align:left;min-height:72px;padding:11px 14px!important;border:1px solid transparent!important;border-radius:13px!important;background:transparent!important;color:#52637a!important;box-shadow:none!important;transform:none!important}.platform-console-tabs button:first-letter{font-size:1.2rem}.platform-console-tabs button span{font-weight:850;font-size:.91rem;color:#334e6f;line-height:1.2}.platform-console-tabs button small{grid-column:2;color:#8090a5;font-size:.72rem;margin-top:2px}.platform-console-tabs button.active{background:linear-gradient(135deg,#2563eb,#3b82f6)!important;color:#fff!important;border-color:#1d4ed8!important;box-shadow:0 8px 18px rgba(37,99,235,.25)!important}.platform-console-tabs button.active span,.platform-console-tabs button.active small{color:#fff}.platform-console-tabs button:hover:not(.active){background:#fff!important;border-color:#cbd9e8!important;box-shadow:0 5px 12px rgba(36,64,96,.08)!important}.platform-console-tabs button:focus-visible{outline:3px solid rgba(59,130,246,.25);outline-offset:2px}.platform-property{padding:24px!important}.platform-property>h2{font-size:1.42rem;color:#1f3b5d;margin:0 0 5px}.platform-property>.subtitle{margin:0 0 18px;color:#71829a}.platform-account-toolbar{display:grid;grid-template-columns:minmax(280px,1fr) auto;align-items:end;gap:12px;flex-wrap:wrap;margin:18px 0;padding:15px;border:1px solid #dbe5ef;border-radius:15px;background:linear-gradient(135deg,#fbfdff,#f5f8fc)}.platform-account-toolbar label,.audit-filter-grid label,.subscription-settings-form label{font-weight:750;color:#425773;font-size:.82rem}.platform-account-toolbar input,.platform-account-toolbar select,.audit-filter-grid input,.audit-filter-grid select,.subscription-settings-form input,.subscription-settings-form select,.subscription-plan-card input,.subscription-new-plan input,.subscription-table-toolbar input,.subscription-table select{margin-top:6px;min-height:42px;border:1px solid #c9d5e3!important;border-radius:10px!important;background:#fff!important;padding:9px 11px!important;box-shadow:inset 0 1px 2px rgba(15,23,42,.03),0 1px 2px rgba(15,23,42,.03)!important;font-size:.9rem;color:#253b55}.platform-account-toolbar input:focus,.audit-filter-grid input:focus,.audit-filter-grid select:focus,.subscription-settings-form input:focus,.subscription-settings-form select:focus,.subscription-plan-card input:focus,.subscription-new-plan input:focus,.subscription-table-toolbar input:focus,.subscription-table select:focus{outline:none;border-color:#5b8def!important;box-shadow:0 0 0 3px rgba(59,130,246,.12)!important}.platform-account-toolbar button,.audit-toolbar button,.subscription-settings-form button,.subscription-new-plan button{min-height:42px;padding:9px 15px!important}.platform-accounts-table thead th,.subscription-table thead th,.audit-history-console table thead th{font-size:.72rem;text-transform:uppercase;letter-spacing:.045em;color:#51657d;background:linear-gradient(180deg,#f7fafd,#eef3f8);padding:12px 10px}.platform-accounts-table tbody td,.subscription-table tbody td,.audit-history-console table tbody td{padding:12px 10px;border-bottom:1px solid #e8eef5}.platform-accounts-table tbody tr:hover,.subscription-table tbody tr:hover,.audit-history-console table tbody tr:hover{background:#f8fbff}.platform-logout-row{justify-content:flex-end;margin-top:18px;padding-top:16px;border-top:1px solid #dce5ee}.platform-console-tabs + .platform-property{animation:platformTabIn .22s ease}@keyframes platformTabIn{from{opacity:.65;transform:translateY(3px)}to{opacity:1;transform:none}}
.platform-support-banner{grid-column:1/-1;display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:10px 18px;background:#102b4d;color:#fff;border-bottom:3px solid #4e86d9;position:sticky;top:0;z-index:50}.platform-account-toolbar{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin:14px 0}.platform-account-toolbar label{flex:1;min-width:280px}.platform-account-toolbar input{width:100%;margin-top:6px}.platform-validity-history{margin-top:18px;padding-top:14px;border-top:1px solid #d9e1ea}.platform-validity-history .section-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.platform-accounts-table td small{display:block;color:#748196;margin-top:3px}.platform-account-actions{min-width:260px}.platform-account-actions button{margin:3px}.platform-accounts-table .validity-badge{display:inline-block;margin-top:5px}.platform-support-banner b{font-size:.86rem}
      .audit-history-console{overflow:hidden}.audit-filter-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:16px;border:1px solid #dbe5ef;border-radius:15px;background:linear-gradient(145deg,#fbfdff,#f4f8fc)}.audit-filter-grid label{display:flex;flex-direction:column;gap:6px}.audit-filter-grid label.wide{grid-column:span 2}.audit-toolbar{display:flex;gap:9px;flex-wrap:wrap;margin:12px 0}.audit-toolbar .danger{background:linear-gradient(135deg,#b42318,#d64545)!important;color:#fff!important;border-color:#b42318!important}.audit-safety-note{padding:11px 13px;border-left:4px solid #d99b28;background:#fff9ed;color:#6b5a34;border-radius:8px;margin-bottom:12px;font-size:.86rem}.audit-count-badge{padding:7px 11px;border-radius:999px;background:#eef4fb;color:#315f96;font-weight:800;font-size:.78rem}@media(max-width:1000px){.audit-filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.audit-filter-grid label.wide{grid-column:span 2}}@media(max-width:650px){.audit-filter-grid{grid-template-columns:1fr}.audit-filter-grid label.wide{grid-column:auto}.audit-toolbar button{width:100%}}.platform-console-badge{display:inline-flex;align-items:center;padding:7px 11px;border-radius:999px;background:#edf4ff;color:#315f96;font-weight:800;font-size:.78rem;border:1px solid #d3e2f7}.subscription-policy-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}.subscription-policy-card{padding:16px;border:1px solid #dbe5ef;border-radius:14px;background:linear-gradient(145deg,#fff,#f7faff);box-shadow:0 8px 18px rgba(38,56,78,.06)}.subscription-policy-card span,.subscription-policy-card small{display:block;color:#718096}.subscription-policy-card strong{display:block;font-size:1.18rem;color:#27466f;margin:5px 0}.subscription-settings-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:16px;border:1px solid #dbe5ef;border-radius:14px;background:#fbfdff}.subscription-settings-form label{display:flex;flex-direction:column;gap:6px}.subscription-settings-form button{align-self:end}.subscription-plan-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.subscription-plan-card{padding:16px;border:1px solid #dbe5ef;border-radius:15px;background:#fff;box-shadow:0 8px 20px rgba(38,56,78,.07)}.subscription-plan-card .plan-top{display:flex;justify-content:space-between;align-items:center}.subscription-plan-card .plan-top span{font-weight:850;font-size:1.1rem}.subscription-plan-card .plan-top b{font-size:.7rem;color:#237a50}.subscription-plan-card label{display:flex;align-items:center;justify-content:space-between;margin-top:9px}.subscription-plan-card input{width:120px}.subscription-plan-card small{display:block;margin-top:12px;color:#667085;line-height:1.45}.subscription-new-plan{display:grid;grid-template-columns:1fr 1fr 1.5fr 1fr 1fr auto;gap:8px;margin:14px 0;padding:12px;border:1px dashed #b9c9dc;border-radius:13px;background:#f8fbff}.subscription-table-toolbar{display:flex;gap:10px;align-items:center;margin:14px 0}.subscription-table-toolbar input{flex:1}.subscription-table td small{display:block;color:#748196;margin-top:3px}.subscription-actions{display:flex;gap:5px;flex-wrap:wrap;min-width:190px}.subscription-type,.subscription-status{display:inline-flex;padding:5px 9px;border-radius:999px;font-weight:800;font-size:.75rem}.subscription-type{background:#edf4fb;color:#315f96}.subscription-type.type-trial{background:#edf8f6;color:#237a50}.subscription-type.type-complimentary{background:#fff7e8;color:#9a6208}.subscription-status{background:#edf4fb;color:#315f96}.subscription-status.status-trial{background:#edf8f6;color:#237a50}.subscription-status.status-grace,.subscription-status.status-past_due{background:#fff7e8;color:#9a6208}.subscription-status.status-restricted,.subscription-status.status-expired,.subscription-status.status-cancelled{background:#fff0f0;color:#a33a3a}.tenant-subscription-panel{max-width:1100px}.subscription-hero-card{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:24px;border-radius:18px;background:linear-gradient(135deg,#eef5ff,#f7fbff);border:1px solid #d5e2f2}.subscription-hero-card .eyebrow{font-size:.74rem;font-weight:850;color:#6680a0;letter-spacing:.08em}.subscription-hero-card h2{margin:6px 0;font-size:1.8rem}.subscription-detail-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}.subscription-detail-grid>div{padding:15px;border:1px solid #dbe5ef;border-radius:13px;background:#fff}.subscription-detail-grid span,.subscription-detail-grid b{display:block}.subscription-detail-grid span{font-size:.8rem;color:#718096}.subscription-detail-grid b{margin-top:5px}.tenant-plan-card{display:flex;justify-content:space-between;align-items:center;padding:18px;border:1px solid #dbe5ef;border-radius:15px;background:#fff}.tenant-plan-card>div:last-child b{font-size:1.5rem;color:#315f96}.tenant-plan-card small{color:#718096;margin-left:4px}@media(max-width:1050px){.subscription-policy-grid,.subscription-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.subscription-settings-form{grid-template-columns:repeat(2,minmax(0,1fr))}.subscription-plan-grid{grid-template-columns:1fr 1fr}.subscription-new-plan{grid-template-columns:1fr 1fr 1fr}}@media(max-width:700px){.subscription-policy-grid,.subscription-detail-grid,.subscription-settings-form,.subscription-plan-grid,.subscription-new-plan{grid-template-columns:1fr}.subscription-table-toolbar{flex-direction:column;align-items:stretch}.subscription-hero-card,.tenant-plan-card{align-items:flex-start;flex-direction:column}}.platform-support-banner span{font-weight:700;color:#dbeafe}.platform-support-banner small{opacity:.9}.platform-support-banner button{margin-left:auto!important;background:#fff!important;color:#1e3a5f!important;border:1px solid #cbd5e1!important;min-height:36px!important;padding:7px 12px!important}@media(max-width:900px){.platform-console-tabs{grid-template-columns:repeat(2,minmax(0,1fr));position:relative;top:0}.platform-account-toolbar{grid-template-columns:1fr}.platform-property{padding:18px!important}}@media(max-width:560px){.platform-console-tabs{grid-template-columns:1fr}.platform-console-tabs button{min-height:58px}.platform-console-tabs button small{display:none}}@media(max-width:900px){.shell{grid-template-columns:1fr}.sidebar{position:relative;height:auto}.platform-support-banner{position:relative}.platform-support-banner button{margin-left:0!important}}
      input[type="checkbox"]{width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;max-width:16px!important;max-height:16px!important;flex:0 0 16px!important;accent-color:#2f6fed!important;margin:0!important;padding:0!important;vertical-align:middle!important;box-sizing:border-box!important;}.checkbox-inline,.remember-login{display:inline-flex!important;align-items:center!important;gap:8px!important}
      .panel,.form-panel,.table-panel,.period-panel,.water-box{border:1px solid var(--line);box-shadow:0 10px 26px rgba(51,65,85,.06);border-radius:16px;background:rgba(255,255,255,.92)}
      button,.button-link{border-radius:10px!important;transition:transform .18s ease,box-shadow .18s ease,filter .18s ease!important;box-shadow:0 5px 14px rgba(59,104,184,.14)} button:hover:not(:disabled),.button-link:hover{transform:translateY(-2px);filter:brightness(1.03);box-shadow:0 9px 20px rgba(59,104,184,.20)}
      .sidebar button{border-radius:10px!important;margin:3px 6px;width:calc(100% - 12px);text-align:left}.sidebar button.active{background:linear-gradient(90deg,#3d67b4,#527bc8)!important;color:#fff;box-shadow:0 8px 18px rgba(26,53,104,.35)}
      .premium-kpis{gap:20px}.dashboard-kpis{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:14px!important;align-items:stretch!important}.dashboard-kpis .kpi-card{min-width:0!important}.kpi-card{position:relative;overflow:hidden;min-height:128px;border-left:5px solid var(--accent);background:linear-gradient(135deg,var(--soft),#fff)!important;box-shadow:0 10px 24px rgba(51,65,85,.10)}.kpi-card .value{font-size:2.05rem;font-weight:800;color:#344054;position:relative;z-index:2}.kpi-card .label{position:relative;z-index:2;font-weight:700}.kpi-glow{position:absolute;width:110px;height:110px;border-radius:50%;right:-35px;bottom:-45px;background:var(--accent);opacity:.10}.kpi-1{--accent:#6b4e9b;--soft:#f3effa}.kpi-2{--accent:#19726a;--soft:#edf8f6}.kpi-3{--accent:#315f96;--soft:#eef4fb}.kpi-4{--accent:#b47712;--soft:#fff7e8}.kpi-5{--accent:#2e7d4e;--soft:#eef9f1}.kpi-6{--accent:#7b5ea7;--soft:#f5f1fb}
      .two-donuts{grid-template-columns:repeat(2,minmax(0,1fr));gap:26px}.premium-donut-panel{min-height:470px;padding:26px}.premium-donut-panel h2{margin:0 0 16px}.premium-donut-row{display:flex;align-items:center;justify-content:center;gap:38px;min-height:380px}.premium-donut-chart{width:330px;height:330px;border-radius:50%;position:relative;box-shadow:inset 0 0 0 1px rgba(255,255,255,.6)}.premium-hole{position:absolute;inset:88px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-shadow:0 2px 18px rgba(15,23,42,.08)}.premium-hole strong{font-size:1.35rem}.premium-hole span{font-size:.85rem;color:#64748b;margin-top:5px}.premium-legend{display:grid;gap:13px;min-width:170px}.premium-legend div{display:grid;grid-template-columns:14px 1fr auto;align-items:center;gap:9px}.premium-legend span{width:14px;height:14px;border-radius:3px}.premium-legend b{font-weight:600}.premium-legend small{color:#64748b;font-weight:700}
      .auth-widget,.auth-card,.platform-card{box-shadow:0 14px 34px rgba(51,65,85,.12)}
      /* V6.2.1 — Global ApartCare action-button standard: primary actions match Login */
      .main button:not(.secondary):not(.danger):not(.password-toggle):not(.eye-toggle):not(.category-chips button):not(.report-tabs button){
        background:linear-gradient(135deg,#2f6fed,#2859c7)!important;color:#fff!important;border:1px solid #285dcc!important;
        min-height:40px!important;padding:9px 15px!important;border-radius:10px!important;font-weight:800!important;font-family:inherit!important;
        line-height:1.15!important;box-shadow:0 7px 16px rgba(47,111,237,.20)!important;cursor:pointer!important;
      }
      .main button:not(.secondary):not(.danger):not(.password-toggle):not(.eye-toggle):not(.category-chips button):not(.report-tabs button):hover:not(:disabled){transform:translateY(-1px)!important;filter:brightness(1.02)!important}
      .main button.secondary{background:#fff!important;color:#315f96!important;border:1px solid #c9d7e8!important;min-height:40px!important;padding:9px 15px!important;border-radius:10px!important;font-weight:800!important;box-shadow:0 4px 10px rgba(51,65,85,.08)!important}
      .main button.danger{background:linear-gradient(135deg,#dc4b4b,#c93d3d)!important;color:#fff!important;border:1px solid #c83b3b!important;min-height:40px!important;padding:9px 15px!important;border-radius:10px!important;font-weight:800!important;box-shadow:0 7px 16px rgba(201,61,61,.18)!important}
      .main button:disabled{opacity:.62!important;box-shadow:none!important;transform:none!important}

      /* V6.1.9 — Uniform professional action buttons and authentication navigation */
      .auth-primary-button,.auth-secondary-button,.auth-back-button{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;min-height:40px!important;padding:9px 15px!important;border-radius:10px!important;font-weight:800!important;font-family:inherit!important;line-height:1.15!important;cursor:pointer!important;transition:transform .16s ease,box-shadow .16s ease,filter .16s ease,background .16s ease!important}
      .auth-primary-button{background:linear-gradient(135deg,#2f6fed,#2859c7)!important;color:#fff!important;border:1px solid #285dcc!important;box-shadow:0 7px 16px rgba(47,111,237,.20)!important}.password-update-button{pointer-events:auto!important;opacity:1!important;position:relative;z-index:20!important;user-select:none!important}
      .auth-secondary-button{background:#fff!important;color:#315f96!important;border:1px solid #c9d7e8!important;box-shadow:0 4px 10px rgba(51,65,85,.08)!important}
      .auth-back-button{background:#f7f9fc!important;color:#526174!important;border:1px solid #c9d7e8!important;box-shadow:0 4px 10px rgba(51,65,85,.06)!important}
      .auth-primary-button:hover,.auth-secondary-button:hover,.auth-back-button:hover{transform:translateY(-1px)!important;filter:brightness(1.02)!important}
      .auth-navigation{display:flex;align-items:center;gap:10px;margin-top:12px}
      .auth-card>.auth-links{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:10px!important}
      .auth-card>.auth-links>*{margin:0!important}
      .auth-card .link-button{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:40px!important;padding:9px 15px!important;border-radius:10px!important;background:#fff!important;color:#315f96!important;border:1px solid #c9d7e8!important;font-weight:800!important;font-family:inherit!important;line-height:1.15!important;box-shadow:0 4px 10px rgba(51,65,85,.08)!important;cursor:pointer!important}
      .auth-card .link-button:hover{transform:translateY(-1px)!important;background:#f7faff!important}
      .main button:not(.password-toggle):not(.eye-toggle){font-family:inherit!important;font-weight:750!important;letter-spacing:.005em}
      .auth-card .form-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.auth-card .form-actions button{margin:0!important}
      .auth-card input[type="checkbox"]{width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;accent-color:#2f6fed;box-shadow:none!important;padding:0!important}
      .auth-card .remember-login{display:flex;align-items:center;gap:8px}.auth-card .remember-login span{line-height:1.35}
      .auth-card .platform-link{margin:0!important}.auth-card .auth-back-button{font-size:.9rem}.auth-card button:disabled{cursor:not-allowed;transform:none!important;filter:none!important;opacity:.65}
.report-tabs button,.category-chips button{padding:10px 14px}.report-tabs button.active,.category-chips button.active{background:linear-gradient(135deg,#3b68b8,#5c84cf);color:#fff}

      .report-hero{padding:24px 0 10px}.report-hero h2{font-size:1.7rem;margin:0 0 6px}.report-hero p{margin:0;color:#64748b}.report-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px;margin:18px 0 22px}.report-kpi{border:1px solid var(--line);border-top:5px solid var(--accent);background:linear-gradient(145deg,var(--soft),#fff);border-radius:16px;padding:18px;min-height:112px;box-shadow:0 10px 24px rgba(51,65,85,.07)}.report-kpi span{display:block;font-size:.82rem;color:#64748b;margin-bottom:14px}.report-kpi b{font-size:1.55rem;color:#344054}.report-kpi.positive b{color:#247148}.report-kpi.negative b{color:#b42318}.report-kpi.open{--accent:#6b4e9b;--soft:#f3effa}.report-kpi.collected{--accent:#315f96;--soft:#eef4fb}.report-kpi.expenses{--accent:#b47712;--soft:#fff7e8}.report-kpi.diff{--accent:#2e7d4e;--soft:#eef9f1}.report-kpi.closing{--accent:#7b5ea7;--soft:#f5f1fb}.report-analytics{display:grid;grid-template-columns:1.25fr 1fr;gap:20px;margin:18px 0}.report-analytics-single{grid-template-columns:1fr}.report-chart-card{border:1px solid var(--line);border-radius:18px;background:#fff;padding:20px;box-shadow:0 10px 24px rgba(51,65,85,.06)}.chart-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.chart-head h3{margin:0 0 5px}.chart-head p{margin:0;color:#64748b;font-size:.88rem}.chart-key{display:flex;gap:12px;font-size:.82rem}.chart-key span{display:flex;align-items:center;gap:5px}.key{width:11px;height:11px;border-radius:3px;display:inline-block}.key.collected{background:#4f79a8}.key.expenses{background:#e2a124}.bar-chart{height:280px;display:flex;align-items:flex-end;gap:8px;padding:28px 4px 0;border-bottom:1px solid #d8e1eb}.bar-group{height:100%;flex:1;min-width:28px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:7px}.bar-values{height:32px;display:flex;flex-direction:column;align-items:center;font-size:.65rem;color:#64748b;white-space:nowrap}.bars{height:205px;display:flex;align-items:flex-end;gap:4px}.bar{width:13px;min-height:4px;border-radius:6px 6px 2px 2px}.bar.collected{background:#4f79a8}.bar.expenses{background:#e2a124}.bar-group>b{font-size:.72rem;color:#64748b}.balance-chart{height:280px;padding-top:18px}.balance-chart svg{height:210px;width:100%;overflow:visible}.chart-axis{stroke:#cbd5e1;stroke-width:.7}.balance-line{stroke:#3b68b8;stroke-width:2.2;vector-effect:non-scaling-stroke}.balance-point{fill:#3b68b8;stroke:#fff;stroke-width:.8}.trend-labels.compact{grid-template-columns:repeat(6,1fr);font-size:.68rem}.report-expense-donut{grid-column:1/-1}.report-donut-wrap{display:flex;align-items:center;justify-content:center;gap:34px;padding:18px 0}.report-donut{width:230px;height:230px;border-radius:50%;position:relative}.report-donut>div{position:absolute;inset:58px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.report-donut b{font-size:1.05rem}.report-donut span{font-size:.72rem;color:#64748b;margin-top:5px}.report-month-legend{display:grid;grid-template-columns:repeat(2,minmax(170px,1fr));gap:9px}.report-month-legend div{display:grid;grid-template-columns:12px 1fr auto;gap:8px;align-items:center;font-size:.82rem}.report-month-legend i{width:12px;height:12px;border-radius:3px}.report-financial-table tfoot{background:#eef4fb}.report-financial-table .positive{color:#247148}.report-financial-table .negative{color:#b42318}.report-financial-table td,.report-financial-table th{text-align:right}.report-financial-table td:first-child,.report-financial-table th:first-child{text-align:left}.individual-history-table{margin-top:14px}.individual-history-table tfoot{background:#dfe7f1}.individual-history-table th,.individual-history-table td{white-space:nowrap}.individual-history-kpis{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;width:100%;gap:18px;margin-top:18px}.individual-history-kpis .kpi-card{padding:18px}.individual-history-kpis .kpi-card span{display:block;font-size:.88rem;color:#64748b;margin-bottom:10px}.individual-history-kpis .kpi-card strong{font-size:2rem;color:#344054}.individual-history-kpis .accent-blue{--accent:#315f96;--soft:#eef4fb}.individual-history-kpis .accent-green{--accent:#2e7d4e;--soft:#eef9f1}.individual-history-kpis .accent-amber{--accent:#b47712;--soft:#fff7e8}.status-paid,.status-pending{display:inline-flex;align-items:center;border-radius:999px;padding:4px 10px;font-size:.8rem;font-weight:800}.status-paid{background:#e9f7ef;color:#247148}.status-pending{background:#fff4e5;color:#a85f00}@media(max-width:760px){.individual-history-kpis{grid-template-columns:1fr!important}}@media(max-width:1150px){.report-kpis{grid-template-columns:repeat(3,1fr)}.report-analytics{grid-template-columns:1fr}.report-expense-donut{grid-column:auto}}@media(max-width:700px){.report-kpis{grid-template-columns:1fr 1fr}.report-month-legend{grid-template-columns:1fr}.report-donut-wrap{flex-direction:column}.bar-values{display:none}}
      /* V6.1.3 professional KPI and expense analytics visual system */
      :root{--business-ink:#27364a;--business-muted:#64748b;--business-blue:#2f6fb0;--business-teal:#17806f;--business-amber:#c68112;--business-purple:#7657a7;--business-green:#277b4c}
      body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;letter-spacing:.01em}.main h1,.main h2,.main h3{color:#334155;letter-spacing:.015em}.main h1{font-weight:800}.main h2{font-weight:750}.label{color:#526174;font-weight:700;letter-spacing:.02em}.value{font-weight:800;color:#27364a}
      .expense-kpis,.summary-grid{gap:18px}.expense-kpis .card,.summary-grid .card,.kpi-grid .card{position:relative;overflow:hidden;min-height:118px;border:1px solid #d7e0ea;border-radius:16px;background:linear-gradient(145deg,#fff,#f5f8fc)!important;box-shadow:0 10px 24px rgba(40,56,76,.08);padding:18px 20px}.expense-kpis .card:after,.summary-grid .card:after,.kpi-grid .card:after{position:absolute;right:16px;top:13px;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-size:20px;background:rgba(47,111,176,.10);box-shadow:inset 0 0 0 1px rgba(47,111,176,.08)}
      .expense-kpis .card:nth-child(1):after,.summary-grid .card:nth-child(1):after,.kpi-grid .card:nth-child(1):after{content:'💰'}.expense-kpis .card:nth-child(2):after,.summary-grid .card:nth-child(2):after,.kpi-grid .card:nth-child(2):after{content:'📋';background:rgba(23,128,111,.10)}.expense-kpis .card:nth-child(3):after,.summary-grid .card:nth-child(3):after,.kpi-grid .card:nth-child(3):after{content:'📅';background:rgba(198,129,18,.12)}.expense-kpis .card:nth-child(4):after,.summary-grid .card:nth-child(4):after,.kpi-grid .card:nth-child(4):after{content:'📊';background:rgba(118,87,167,.10)}.expense-kpis .card:nth-child(5):after,.summary-grid .card:nth-child(5):after,.kpi-grid .card:nth-child(5):after{content:'🏦';background:rgba(39,123,76,.10)}
      .expense-kpis .value,.summary-grid .value,.kpi-grid .value{font-size:2rem!important;line-height:1.15}.expense-kpis .label,.summary-grid .label,.kpi-grid .label{padding-right:52px;font-size:.86rem}
      .kpi-card:before,.report-kpi:after{position:absolute;right:16px;top:14px;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-size:18px;background:rgba(255,255,255,.62);box-shadow:0 5px 14px rgba(51,65,85,.07)}.kpi-card:before{content:'📊';z-index:2}.kpi-1:before{content:'🏦'}.kpi-2:before{content:'🧾'}.kpi-3:before{content:'💳'}.kpi-4:before{content:'💸'}.kpi-5:before{content:'📈'}.kpi-6:before{content:'💰'}
      .report-kpi{position:relative;overflow:hidden}.report-kpi.open:after{content:'🏦'}.report-kpi.collected:after{content:'💳'}.report-kpi.expenses:after{content:'💸'}.report-kpi.diff:after{content:'📈'}.report-kpi.closing:after{content:'💰'}
      .expense-trend-card{border:1px solid #d9e3ee;border-radius:18px;background:linear-gradient(180deg,#fff,#f8fbfe);box-shadow:0 14px 32px rgba(42,58,79,.08);padding:20px 22px 16px;margin:12px 0 24px}.expense-trend-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:16px}.trend-title{font-size:1.05rem;font-weight:800;color:#27364a}.chart-caption{color:#718096;font-size:.86rem;margin-top:4px}.trend-total{font-size:1.35rem;font-weight:850;color:#2f6fb0;text-align:right}.trend-total small{display:block;font-size:.72rem;font-weight:700;color:#718096;margin-top:3px}.expense-chart-frame{height:330px;display:grid;grid-template-columns:72px 1fr;gap:10px}.expense-y-scale{display:flex;flex-direction:column;justify-content:space-between;padding:4px 0 28px;color:#728096;font-size:.74rem;text-align:right}.expense-svg-wrap{position:relative;min-width:0;padding-bottom:28px}.expense-svg-wrap svg{width:100%;height:100%;display:block;overflow:visible}.expense-grid-line{stroke:#dfe7f0;stroke-width:.55}.expense-trend-line{stroke:#2f6fb0;stroke-width:1.05;vector-effect:non-scaling-stroke;filter:drop-shadow(0 3px 3px rgba(47,111,176,.15))}.expense-trend-point{fill:#2f6fb0;stroke:#fff;stroke-width:.65;vector-effect:non-scaling-stroke}.expense-months{position:absolute;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(12,1fr);font-size:.72rem;color:#6b7788;text-align:center}.expense-trend-card:hover .expense-trend-point{fill:#17806f}
      @media(max-width:760px){.expense-chart-frame{height:260px;grid-template-columns:48px 1fr}.expense-y-scale{font-size:.64rem}.expense-months{font-size:.62rem}.expense-trend-head{align-items:flex-start}.trend-total{font-size:1.05rem}}
      @media(max-width:1000px){.two-donuts{grid-template-columns:1fr}.premium-donut-row{flex-direction:column}.premium-donut-chart{width:280px;height:280px}.premium-hole{inset:74px}}
      /* V6.1.4 — Compact, consistent KPI cards across every ApartCare module */
      .kpis,.premium-kpis,.summary-grid,.expense-kpis,.report-kpis,.individual-history-kpis{align-items:stretch}
      .kpis,.premium-kpis{gap:14px}
      .kpi-card,.summary-grid .card,.expense-kpis .card,.kpi-grid .card,.report-kpi{
        min-height:96px!important;height:96px;box-sizing:border-box;border-radius:14px!important;
        padding:14px 16px!important;box-shadow:0 7px 18px rgba(40,56,76,.08)!important
      }
      .kpi-card{border-left-width:4px!important}
      .summary-grid .card,.expense-kpis .card,.kpi-grid .card{border-top:4px solid rgba(47,111,176,.48)}
      .summary-grid .card:nth-child(2),.expense-kpis .card:nth-child(2),.kpi-grid .card:nth-child(2){border-top-color:rgba(23,128,111,.58)}
      .summary-grid .card:nth-child(3),.expense-kpis .card:nth-child(3),.kpi-grid .card:nth-child(3){border-top-color:rgba(198,129,18,.62)}
      .summary-grid .card:nth-child(4),.expense-kpis .card:nth-child(4),.kpi-grid .card:nth-child(4){border-top-color:rgba(118,87,167,.60)}
      .summary-grid .card:nth-child(5),.expense-kpis .card:nth-child(5),.kpi-grid .card:nth-child(5){border-top-color:rgba(39,123,76,.62)}
      .kpi-card .label,.summary-grid .label,.expense-kpis .label,.kpi-grid .label,.report-kpi span,.individual-history-kpis .kpi-card span{
        font-size:.78rem!important;line-height:1.2!important;font-weight:700!important;color:#5c6878!important;
        margin-bottom:7px!important;padding-right:42px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis
      }
      .kpi-card .value,.summary-grid .value,.expense-kpis .value,.kpi-grid .value{
        font-size:1.55rem!important;line-height:1.08!important;font-weight:850!important;color:#2e3b4e!important
      }
      .individual-history-kpis .kpi-card strong{font-size:1.55rem!important;line-height:1.08!important;font-weight:850!important}
      .report-kpi b{font-size:1.55rem!important;line-height:1.08!important;display:block;padding-right:42px}
      .kpi-card:before,.report-kpi:after{width:32px!important;height:32px!important;right:12px!important;top:12px!important;border-radius:10px!important;font-size:16px!important}
      .expense-kpis .card:after,.summary-grid .card:after,.kpi-grid .card:after{width:32px!important;height:32px!important;right:12px!important;top:11px!important;border-radius:10px!important;font-size:16px!important}
      .kpi-glow{width:82px!important;height:82px!important;right:-28px!important;bottom:-38px!important}
      .report-kpis{gap:12px!important;margin:14px 0 18px!important}
      .report-kpi{min-height:96px!important}
      .individual-history-kpis{gap:12px!important;margin-top:14px!important}
      .individual-history-kpis .kpi-card{padding:14px 16px!important}
      .summary-grid,.expense-kpis{gap:12px!important}
      .expense-kpis .card,.summary-grid .card,.kpi-grid .card{min-height:96px!important}
      .water-summary-grid .card{height:96px!important}
      @media(min-width:1150px){.kpis.premium-kpis{grid-auto-rows:96px}.summary-grid,.expense-kpis{grid-auto-rows:96px}}
      @media(max-width:900px){.kpi-card,.summary-grid .card,.expense-kpis .card,.kpi-grid .card,.report-kpi{height:auto;min-height:92px!important}.kpi-card .label,.summary-grid .label,.expense-kpis .label,.kpi-grid .label,.report-kpi span{white-space:normal}.report-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
      @media(max-width:560px){.report-kpis{grid-template-columns:1fr!important}.kpi-card .value,.summary-grid .value,.expense-kpis .value,.kpi-grid .value,.report-kpi b,.individual-history-kpis .kpi-card strong{font-size:1.38rem!important}}

      /* V6.1.5 — Professional Expense workspace and consistent business buttons */
      .main button:not(.secondary):not(.password-toggle):not(.category-chips button):not(.report-tabs button){
        background:linear-gradient(135deg,#315f96,#4d78bd)!important;color:#fff!important;border:1px solid #315f96!important;font-weight:800!important;letter-spacing:.01em
      }
      .main button.secondary{background:linear-gradient(180deg,#fff,#f3f6fa)!important;color:#334155!important;border:1px solid #cbd7e5!important;font-weight:750!important}
      .main button:disabled{opacity:.62!important;box-shadow:none!important;transform:none!important}
      .professional-expense-form{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px 20px!important;padding:20px!important;border:1px solid #dbe4ee;border-radius:18px;background:linear-gradient(145deg,#fff,#f7faff)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.8)}
      .professional-expense-form label{position:relative;display:flex!important;flex-direction:column;gap:8px;font-weight:750!important;color:#445468!important;min-width:0;padding-top:2px}
      .professional-expense-form label:before{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;margin-bottom:1px;background:#eef4fb;font-size:14px;box-shadow:inset 0 0 0 1px rgba(49,95,150,.08)}
      .professional-expense-form label:nth-child(1):before{content:'📅'}.professional-expense-form label:nth-child(2):before{content:'🏷️';background:#edf8f6}.professional-expense-form label:nth-child(3):before{content:'💰';background:#fff7e8}.professional-expense-form label:nth-child(4):before{content:'💳';background:#f4f0fb}.professional-expense-form label:nth-child(5):before{content:'📝';background:#eef4fb}.professional-expense-form label:nth-child(6):before{content:'🔖';background:#edf8f6}.professional-expense-form label:nth-child(7):before{content:'💬';background:#fff7e8}.professional-expense-form label:nth-child(8):before{content:'📎';background:#f4f0fb}
      .professional-expense-form input,.professional-expense-form select{width:100%;box-sizing:border-box;min-height:46px!important;border:1px solid #cfd9e5!important;border-radius:11px!important;background:#fff!important;padding:10px 12px!important;font-size:.95rem!important;color:#334155!important;box-shadow:0 4px 12px rgba(51,65,85,.04)}
      .professional-expense-form input:focus,.professional-expense-form select:focus{outline:none;border-color:#4d78bd!important;box-shadow:0 0 0 3px rgba(77,120,189,.12)!important}
      .professional-expense-form input[type="file"]{min-height:72px!important;padding:12px!important;border-style:dashed!important;background:linear-gradient(180deg,#fbfdff,#f4f8fc)!important}
      .professional-expense-form label.wide{grid-column:span 2}.professional-expense-form .form-actions{grid-column:1/-1;display:flex;justify-content:flex-start;gap:12px;padding-top:6px;border-top:1px solid #e2e8f0;margin-top:4px}.professional-expense-form .form-actions button{min-height:46px;padding:0 22px!important;border-radius:12px!important}
      .expense-form + .message{margin-top:14px}.expense-period-options{display:inline-flex!important;align-items:center;gap:8px;padding:7px;border:1px solid #d8e2ec;border-radius:13px;background:#fff;box-shadow:0 6px 16px rgba(51,65,85,.05);margin-bottom:16px}.expense-period-options .radio{padding:8px 14px;border-radius:9px;font-weight:750;color:#526174;transition:.18s ease}.expense-period-options .radio:has(input:checked){background:#edf4fc;color:#315f96}.expense-period-options input{accent-color:#315f96}
      .expense-kpis .card:nth-child(1){background:linear-gradient(145deg,#fff,#fff7e8)!important}.expense-kpis .card:nth-child(2){background:linear-gradient(145deg,#fff,#edf8f6)!important}.expense-kpis .card:nth-child(3){background:linear-gradient(145deg,#fff,#eef4fb)!important}.expense-kpis .card:nth-child(4){background:linear-gradient(145deg,#fff,#f4f0fb)!important}.panel .section-title-row h2{font-size:1.35rem}
      @media(max-width:1050px){.professional-expense-form{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:650px){.professional-expense-form{grid-template-columns:1fr!important;padding:14px!important}.professional-expense-form label.wide{grid-column:auto}.professional-expense-form .form-actions{grid-column:auto}.professional-expense-form .form-actions button{width:100%}}

      /* V6.1.6 — Standardized professional workspace across all modules */
      .main{padding-bottom:42px}.page-title-row,.section-title-row,.month-heading{position:relative}
      .main h1{font-size:2rem!important;line-height:1.15}.main h2{font-size:1.32rem!important}.subtitle{color:#6b7788!important;font-weight:500!important}
      .panel,.form-panel,.table-panel{background:linear-gradient(180deg,#ffffff 0%,#fbfcfe 100%)!important;border-color:#d6e0eb!important}
      .main input,.main select,.main textarea{border:1px solid #cbd7e5!important;border-radius:10px!important;background:#fff!important;color:#334155!important;min-height:40px;transition:border-color .18s ease,box-shadow .18s ease,background .18s ease}
      .main input:focus,.main select:focus,.main textarea:focus{border-color:#3b68b8!important;box-shadow:0 0 0 3px rgba(59,104,184,.12)!important;outline:none!important}
      .main label{color:#4b5a6d;font-weight:700}.main table{border-radius:14px;overflow:hidden}.main table thead th{background:linear-gradient(180deg,#eef3f8,#e5ecf4)!important;color:#344054!important;font-weight:800!important}.main table tbody tr:nth-child(even){background:rgba(244,247,251,.7)}.main table tbody tr:hover{background:#eef5fc!important}
      .main .formula,.main .help-text{padding:10px 13px;border-left:3px solid #5b7fba;background:#f6f9fd;border-radius:8px;color:#64748b}
      .main button{min-height:38px;padding:8px 14px!important}.main .form-actions button{min-height:44px}.lock-note{display:inline-flex;align-items:center;padding:7px 10px;border-radius:9px;background:#f2f4f7;color:#667085;font-size:.82rem;font-weight:700}
      .attachment-field{padding:14px!important;border:1px dashed #b9c9dc;border-radius:13px;background:linear-gradient(145deg,#fbfdff,#f3f7fc)}.attachment-selected{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;padding:9px 10px;border-radius:9px;background:#edf7f2;color:#246b48}.attachment-remove{white-space:nowrap!important;min-height:34px!important;padding:6px 10px!important}
      .expense-kpis,.summary-grid,.kpi-grid{align-items:stretch}.expense-kpis .card,.summary-grid .card,.kpi-grid .card{border:1px solid #d7e1ec!important;box-shadow:0 8px 20px rgba(38,56,78,.08)!important}.expense-kpis .card:hover,.summary-grid .card:hover,.kpi-grid .card:hover,.kpi-card:hover,.report-kpi:hover{transform:translateY(-2px);box-shadow:0 14px 28px rgba(38,56,78,.12)!important}
      @media(max-width:700px){.attachment-selected{align-items:flex-start;flex-direction:column}.attachment-remove{width:100%}.main h1{font-size:1.65rem!important}}

      /* V6.1.7 — unified compact controls, month selectors and safe login remember UX */
      .main input[type=checkbox],.main input[type=radio],.auth-card input[type=checkbox],.auth-card input[type=radio]{width:16px!important;height:16px!important;min-height:16px!important;max-width:16px!important;max-height:16px!important;accent-color:#2563eb;box-shadow:none!important;border-radius:3px!important;vertical-align:middle!important}
.main input[type="checkbox"],.main input[type="radio"],.checkbox-label input[type="checkbox"],.checkbox-inline input[type="checkbox"],.remember-login input[type="checkbox"]{width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;max-width:16px!important;max-height:16px!important;inline-size:16px!important;block-size:16px!important;flex:0 0 16px!important;transform:none!important;zoom:1!important;scale:1!important;appearance:auto!important;-webkit-appearance:auto!important;padding:0!important;margin:0!important;box-sizing:border-box!important;border-radius:3px!important;vertical-align:middle!important}
      .checkbox-label,.checkbox-inline,.remember-login{display:inline-flex!important;align-items:center!important;gap:8px!important;min-height:24px!important}.remember-login{margin-top:2px;color:#475467;font-weight:700}.remember-login input{flex:0 0 16px}
      .remember-note{font-size:.76rem;color:#7a8696;background:#f7f9fc;border-left:3px solid #c7d4e5;padding:8px 10px;border-radius:7px;margin-top:-4px}
      .standard-month-field{display:flex!important;flex-direction:column!important;gap:7px!important;color:#4b5a6d!important;font-weight:700!important}.standard-month-field input[type=month],.month-selector input[type=month],.selector-row input[type=month]{min-width:188px!important;width:188px!important;height:50px!important;min-height:50px!important;padding:0 14px!important;border:1px solid #cbd7e5!important;border-radius:13px!important;background:#fff!important;font-size:1rem!important;color:#475467!important;box-shadow:0 3px 10px rgba(38,56,78,.04)!important}.standard-month-field input[type=month]:focus,.month-selector input[type=month]:focus,.selector-row input[type=month]:focus{border-color:#3b68b8!important;box-shadow:0 0 0 3px rgba(59,104,184,.10)!important}
      .selector-row{display:flex;flex-direction:column;align-items:flex-start;gap:7px}.month-selector{display:flex;flex-direction:column;align-items:flex-start;gap:7px}.inline-month{display:flex;align-items:flex-start!important;gap:8px!important}.inline-month span{font-weight:700;color:#4b5a6d;padding-top:14px}
      .account-id-preview{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 14px;border:1px solid #d7e1ec;border-radius:11px;background:#f7faff;color:#475467}.account-id-preview b{color:#315f96;font-size:1.02rem}
      .kpi-card,.report-kpi,.expense-kpis .card,.summary-grid .card{min-height:112px}.kpi-card .value,.report-kpi b{letter-spacing:-.02em}
      @media(max-width:700px){.standard-month-field input[type=month],.month-selector input[type=month],.selector-row input[type=month]{width:100%!important;min-width:0!important}.inline-month{width:100%}}

      .professional-upload{display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:12px;padding:14px 16px!important;border:1px solid #d4deea!important;border-radius:13px!important;background:linear-gradient(145deg,#fbfdff,#f4f7fb)!important}.upload-widget-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:10px;background:#eaf2fb;font-size:1.1rem}.upload-widget-copy{display:flex;flex-direction:column;gap:4px}.upload-widget-copy b{color:#344054}.upload-widget-copy small{color:#7a8696}.upload-button{display:inline-flex!important;align-items:center;justify-content:center;min-height:38px!important;padding:8px 14px!important;border-radius:9px!important;background:#eef4fb!important;color:#315f96!important;border:1px solid #c8d7e8!important;font-weight:800!important;cursor:pointer!important}.upload-button input[type=file]{display:none!important}.professional-upload .apartment-profile-photo{grid-column:1/-1;max-width:180px;max-height:100px;object-fit:cover;border-radius:10px;border:1px solid #d4deea}.admin-unlock{border-color:#d5a35b!important;color:#8a5a08!important;background:#fff8e8!important}
      .main input[type=number]{font-variant-numeric:tabular-nums}.main input[type=checkbox],.main input[type=radio]{appearance:auto!important;-webkit-appearance:auto!important}

      /* V6.1.8 — polished authentication navigation and controlled Go-Live versioning */
      .auth-card{position:relative}.auth-links{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:10px!important;margin-top:18px!important}.auth-secondary-link,.auth-create-link,.platform-link{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:40px!important;padding:8px 14px!important;border:1px solid #d3deeb!important;border-radius:10px!important;background:#fff!important;color:#315f96!important;font-weight:800!important;text-decoration:none!important}.auth-create-link{background:linear-gradient(135deg,#eef5ff,#f7fbff)!important;border-color:#b9cee7!important}.platform-link{background:linear-gradient(135deg,#f5f1fb,#fbf9ff)!important;color:#654a91!important;border-color:#d5c8e8!important}.auth-back-button{display:inline-flex!important;align-items:center!important;justify-content:center!important;margin-top:12px!important;min-height:38px!important;padding:8px 13px!important;border:1px solid #d3deeb!important;border-radius:10px!important;background:#f7f9fc!important;color:#526174!important;font-weight:750!important;box-shadow:none!important}.auth-back-button:hover{background:#eef4fb!important;color:#315f96!important;transform:none!important;box-shadow:none!important}.golive-panel{padding:22px!important}.golive-panel .section-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}.lock-badge{display:inline-flex;align-items:center;white-space:nowrap;padding:8px 12px;border-radius:999px;font-size:.82rem;font-weight:800}.lock-badge.is-locked{background:#edf7f0;color:#247148;border:1px solid #cbe7d4}.lock-badge.is-open{background:#fff7e8;color:#8a5a08;border:1px solid #efd49c}.golive-current{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:16px 0}.golive-current>div{padding:13px 15px;border:1px solid #dce4ed;border-radius:12px;background:linear-gradient(145deg,#fbfdff,#f4f7fb)}.golive-current span{display:block;color:#7a8696;font-size:.76rem;font-weight:700;margin-bottom:5px}.golive-current b{font-size:1.05rem;color:#344054}.golive-form{margin-top:8px}.golive-history-head{display:flex;justify-content:space-between;align-items:center;margin-top:22px}.golive-history-head h3{margin:0}.golive-history-head span{font-size:.78rem;color:#7a8696}.golive-history{display:grid;gap:7px}.golive-history>div{display:grid;grid-template-columns:180px 1fr 110px 130px;gap:12px;align-items:center;padding:10px 12px;border:1px solid #e0e6ed;border-radius:9px;background:#fbfcfe;font-size:.84rem}.golive-history>div b{color:#315f96}.golive-history>div strong{text-align:right;color:#344054}@media(max-width:760px){.golive-panel .section-title-row,.golive-history-head{flex-direction:column}.golive-current{grid-template-columns:1fr}.golive-history>div{grid-template-columns:1fr;gap:4px}.golive-history>div strong{text-align:left}.auth-links{flex-direction:column;align-items:stretch!important}.auth-links>*{width:100%!important}.auth-back-button{width:100%!important}}


      /* V6.5.13 — maintenance amount fields must remain readable. */
      .maintenance-table{min-width:1500px!important}
      .maintenance-table th:nth-child(5),.maintenance-table th:nth-child(6),.maintenance-table th:nth-child(7),.maintenance-table th:nth-child(8),
      .maintenance-table td:nth-child(5),.maintenance-table td:nth-child(6),.maintenance-table td:nth-child(7),.maintenance-table td:nth-child(8){min-width:120px!important;width:120px!important}
      .maintenance-table td input[type="number"]{width:112px!important;min-width:112px!important;box-sizing:border-box!important}
      .import-panel .card{min-width:0!important;overflow:hidden!important}
      .import-panel .card .help-text,.import-panel .card .value,.import-panel .card .label{overflow-wrap:anywhere!important;word-break:normal!important}
      .platform-recovery-all-badge{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:999px;background:#eef4ff;color:#315f96;border:1px solid #c8d7e8;font-weight:800;font-size:.78rem}
      .utility-panel{padding:22px}.utility-category-editor{display:flex;gap:10px;align-items:center;margin:14px 0}.utility-category-editor input{flex:1}.utility-category-list{display:grid;gap:8px;margin-bottom:18px}.utility-category-row{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:10px 12px;border:1px solid #d9e1ea;border-radius:10px;background:#f8fafc}.utility-category-row.inactive{opacity:.65}.utility-category-row>span:first-child{font-weight:700}.utility-category-row>span:nth-child(2){font-size:.82rem;color:#64748b}.utility-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.utility-form label{display:grid;gap:8px;font-weight:600;color:#475569}.utility-form .form-actions{grid-column:1/-1}.utility-form input:disabled,.utility-form select:disabled{opacity:.8;cursor:not-allowed;background:#eef2f7}.utility-contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.utility-contact-card,.utility-watchman-card{display:flex;align-items:center;gap:14px;border:1px solid #d9e1ea;border-radius:14px;padding:16px;background:linear-gradient(135deg,#fff,#f8fafc);box-shadow:0 7px 18px rgba(51,65,85,.06)}.utility-icon,.utility-card-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#eef4fb;font-size:1.45rem;flex:0 0 auto}.utility-card-body{flex:1;min-width:0}.utility-category{font-size:.78rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#64748b}.utility-contact-card h3{margin:3px 0 5px;color:#26364d}.utility-mobile{font-weight:700;color:#315f96}.utility-contact-card p{margin:6px 0 0;color:#64748b;font-size:.9rem}.utility-watchman-card{margin-bottom:16px;background:linear-gradient(135deg,#eef9f1,#fff);border-left:4px solid #2e7d4e}.utility-watchman-card div:nth-child(2){display:grid;gap:3px}.utility-watchman-card span{font-weight:700}.utility-watchman-card small{color:#64748b}.utility-contact-card .actions{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}.utility-panel .empty-state{padding:24px 0}@media(max-width:900px){.utility-form,.utility-contact-grid{grid-template-columns:1fr}}
      .history-toolbar{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:12px 0 16px}.history-toolbar label{display:grid;gap:8px;font-weight:700;color:#475569}.history-toolbar select{min-width:280px}@media(max-width:900px){.history-toolbar{flex-direction:column;align-items:stretch}.history-toolbar select{min-width:0;width:100%}} .template-card{cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}.template-card:hover{transform:translateY(-2px);box-shadow:0 10px 22px rgba(51,65,85,.10)}.template-card-active{border:2px solid #3b68b8!important;box-shadow:0 10px 24px rgba(59,104,184,.14)!important}.template-card .button-link{margin-top:8px}

      /* V6.5.1 Platform Owner visual layer — design reference only; no API/data behavior changes. */
      .platform-owner-auth-shell{align-items:flex-start!important;justify-content:flex-start!important;padding:0!important;background:#f8fafc!important;min-height:100vh!important}
      .platform-owner-console{width:100%!important;max-width:1440px!important;margin:0 auto!important;padding:0!important;background:#f8fafc!important;border:0!important;border-radius:0!important;box-shadow:none!important;color:#0f172a!important}
      .platform-owner-console *{box-sizing:border-box}
      .po-top-header{height:76px;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;z-index:40;box-shadow:0 1px 8px rgba(15,23,42,.04)}
      .po-brand-block,.po-brand-line,.po-user-meta,.po-user-pill{display:flex;align-items:center}
      .po-brand-block{gap:12px}.po-logo{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;box-shadow:0 6px 16px rgba(37,99,235,.22)}
      .po-brand-line{gap:8px}.po-brand-line>span:first-child{font-size:18px;font-weight:800;letter-spacing:-.02em;color:#0f172a}.po-version-badge{font-size:11px!important;font-weight:700!important;padding:3px 8px;border-radius:999px;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0}.po-console-label{font-size:11px;color:#64748b;font-weight:600;margin-top:2px}
      .po-user-meta{gap:16px}.po-security-pill{display:flex;align-items:center;gap:7px;padding:7px 11px;border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:9px;font-size:11px;font-weight:600}.po-user-pill{gap:9px;border-left:1px solid #e2e8f0;padding-left:16px}.po-user-pill span:last-child>b{display:block;font-size:12px;color:#334155}.po-user-pill span:last-child small{display:block;font-size:10px;color:#059669;font-weight:700;margin-top:2px}.po-avatar{width:34px;height:34px;border-radius:50%;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;box-shadow:0 0 0 3px #dbeafe}
      .po-page-header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:28px 28px 20px;background:#f8fafc}.po-page-header h1{margin:0!important;font-size:24px!important;line-height:1.15!important;color:#0f172a!important;letter-spacing:-.025em}.po-page-header p{margin:7px 0 0!important;color:#64748b!important;font-size:13px!important;max-width:760px}.po-header-status{padding:8px 12px;border-radius:999px;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;font-size:11px;font-weight:800;white-space:nowrap}
      .po-system-banner{margin:0 28px 18px;padding:12px 14px;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;display:flex;align-items:center;gap:10px;color:#166534;font-size:12px;font-weight:600}.po-banner-icon{width:25px;height:25px;border-radius:8px;background:#d1fae5;color:#047857;display:flex;align-items:center;justify-content:center;font-weight:900}.po-system-banner button{margin-left:auto!important;background:transparent!important;color:#047857!important;border:0!important;box-shadow:none!important;min-height:28px!important;padding:4px 8px!important;font-size:11px!important}
      .platform-console-tabs{display:flex!important;grid-template-columns:none!important;gap:2px!important;margin:0 28px!important;padding:0!important;background:transparent!important;border:0!important;border-bottom:1px solid #e2e8f0!important;border-radius:0!important;box-shadow:none!important;position:relative!important;top:auto!important;z-index:10!important;overflow-x:auto}
      .platform-console-tabs button{flex:0 0 auto!important;display:flex!important;align-items:center!important;gap:10px!important;min-height:66px!important;padding:10px 18px!important;border:0!important;border-bottom:2px solid transparent!important;border-radius:9px 9px 0 0!important;background:transparent!important;color:#64748b!important;box-shadow:none!important;transform:none!important;text-align:left!important;white-space:nowrap}.platform-console-tabs button span{font-weight:700!important;font-size:13px!important;color:#475569!important}.platform-console-tabs button small{display:block!important;color:#94a3b8!important;font-size:10px!important;margin-top:2px!important}.platform-console-tabs button.active{background:#eff6ff!important;border-bottom-color:#2563eb!important;color:#2563eb!important;box-shadow:none!important}.platform-console-tabs button.active span,.platform-console-tabs button.active small{color:#1d4ed8!important}.platform-console-tabs button:hover:not(.active){background:#f8fafc!important;color:#334155!important;border-color:transparent!important;box-shadow:none!important}
      .platform-property{margin:22px 28px 28px!important;padding:22px!important;background:#fff!important;border:1px solid #e2e8f0!important;border-radius:12px!important;box-shadow:0 4px 14px rgba(15,23,42,.045)!important}.platform-property>h2{font-size:18px!important;color:#0f172a!important;margin:0 0 5px!important}.platform-property>.subtitle{color:#64748b!important;font-size:12px!important;margin:0 0 18px!important}
      .platform-account-toolbar{display:grid!important;grid-template-columns:minmax(320px,1fr) auto!important;gap:12px!important;align-items:end!important;margin:18px 0!important;padding:16px!important;background:#f8fafc!important;border:1px solid #e2e8f0!important;border-radius:10px!important}.platform-account-toolbar label,.audit-filter-grid label,.subscription-settings-form label{font-size:11px!important;font-weight:700!important;color:#334155!important;letter-spacing:.01em}.platform-account-toolbar input,.platform-account-toolbar select,.audit-filter-grid input,.audit-filter-grid select,.subscription-settings-form input,.subscription-settings-form select,.subscription-plan-card input,.subscription-new-plan input,.subscription-table-toolbar input,.subscription-table select{margin-top:6px!important;min-height:40px!important;border:1px solid #cbd5e1!important;border-radius:8px!important;background:#fff!important;padding:8px 11px!important;box-shadow:0 1px 2px rgba(15,23,42,.03)!important;color:#1e293b!important;font-size:12px!important}.platform-account-toolbar input:focus,.audit-filter-grid input:focus,.audit-filter-grid select:focus,.subscription-settings-form input:focus,.subscription-settings-form select:focus{border-color:#60a5fa!important;box-shadow:0 0 0 3px rgba(59,130,246,.10)!important}
      .platform-accounts-table,.audit-history-console table,.subscription-table{border-collapse:separate!important;border-spacing:0!important}.platform-accounts-table thead th,.subscription-table thead th,.audit-history-console table thead th{background:#f8fafc!important;color:#475569!important;font-size:10px!important;letter-spacing:.045em!important;padding:11px 10px!important;border-bottom:1px solid #e2e8f0!important}.platform-accounts-table tbody td,.subscription-table tbody td,.audit-history-console table tbody td{padding:12px 10px!important;border-bottom:1px solid #eef2f7!important;font-size:12px!important;color:#334155!important}.platform-accounts-table tbody tr:hover,.subscription-table tbody tr:hover,.audit-history-console table tbody tr:hover{background:#f8fbff!important}.platform-accounts-table td small,.subscription-table td small{color:#94a3b8!important;font-size:10px!important}.platform-account-actions{min-width:260px!important}.platform-account-actions button{margin:2px!important;font-size:10px!important;min-height:32px!important;padding:6px 9px!important}
      .subscription-console{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important}.subscription-console>.section-title-row{margin:22px 28px 16px!important;padding:20px!important;background:#fff;border:1px solid #e2e8f0;border-radius:12px}.subscription-console .subscription-policy-grid,.subscription-console .subscription-settings-form,.subscription-console .subscription-plan-grid,.subscription-console .subscription-table-toolbar,.subscription-console .table-scroll{margin-left:28px!important;margin-right:28px!important}.subscription-policy-card{background:#fff!important;border:1px solid #e2e8f0!important;border-radius:11px!important;box-shadow:0 3px 12px rgba(15,23,42,.04)!important}.subscription-plan-card{background:#fff!important;border:1px solid #e2e8f0!important;border-radius:11px!important;box-shadow:0 3px 12px rgba(15,23,42,.04)!important}.subscription-plan-card:first-child{border:2px solid #3b82f6!important;background:linear-gradient(180deg,#f8fbff,#fff)!important}.subscription-settings-form{background:#f8fafc!important;border:1px solid #e2e8f0!important;border-radius:11px!important}.subscription-new-plan{background:#f8fafc!important;border:1px dashed #cbd5e1!important;border-radius:10px!important}.subscription-console .section-title-row h2{font-size:18px!important;color:#0f172a!important}.subscription-console .section-title-row .subtitle{font-size:12px!important;color:#64748b!important}
      .audit-history-console{margin-top:22px!important}.audit-filter-grid{background:#f8fafc!important;border:1px solid #e2e8f0!important;border-radius:10px!important}.audit-toolbar{gap:8px!important}.audit-safety-note{border-left:3px solid #f59e0b!important;background:#fffbeb!important;color:#92400e!important;font-size:11px!important}.audit-count-badge{background:#eff6ff!important;color:#1d4ed8!important;border:1px solid #dbeafe!important}
      .platform-owner-console button.secondary{background:#fff!important;color:#334155!important;border:1px solid #cbd5e1!important;box-shadow:0 1px 2px rgba(15,23,42,.04)!important}.platform-owner-console button.secondary:hover{background:#f8fafc!important;border-color:#94a3b8!important}.platform-owner-console button.danger{box-shadow:none!important}.platform-logout-row{margin:0 28px 28px!important}
      @media(max-width:900px){.po-top-header{padding:0 16px}.po-security-pill{display:none}.po-page-header{padding:22px 16px 16px}.po-system-banner{margin-left:16px;margin-right:16px}.platform-console-tabs{margin-left:16px!important;margin-right:16px!important}.platform-property{margin-left:16px!important;margin-right:16px!important}.subscription-console>.section-title-row,.subscription-console .subscription-policy-grid,.subscription-console .subscription-settings-form,.subscription-console .subscription-plan-grid,.subscription-console .subscription-table-toolbar,.subscription-console .table-scroll{margin-left:16px!important;margin-right:16px!important}.platform-account-toolbar{grid-template-columns:1fr!important}}
      @media(max-width:600px){.po-top-header{height:68px}.po-console-label,.po-version-badge{display:none}.po-page-header{align-items:flex-start;flex-direction:column}.po-page-header h1{font-size:21px!important}.po-header-status{align-self:flex-start}.po-user-pill span:last-child{display:none}.platform-console-tabs button{min-height:60px!important;padding:8px 12px!important}.platform-console-tabs button small{display:none!important}.platform-property{padding:16px!important}.platform-account-actions{min-width:0!important}.platform-account-actions button{width:auto!important}}
/* ApartCare UI 1.0 — uniform visual system for every module */
:root{
  --ac-primary:#2563eb;
  --ac-primary-2:#1d4ed8;
  --ac-teal:#0f9f9a;
  --ac-ink:#172b4d;
  --ac-text:#334155;
  --ac-muted:#64748b;
  --ac-soft:#f5f8fc;
  --ac-soft-blue:#eff6ff;
  --ac-border:#dbe4ef;
  --ac-border-strong:#c8d5e5;
  --ac-success:#0f8a5f;
  --ac-warning:#b7791f;
  --ac-danger:#c2413b;
  --ac-radius:14px;
  --ac-shadow:0 8px 24px rgba(23,43,77,.07);
  --ac-shadow-hover:0 12px 30px rgba(23,43,77,.11);
  --ac-font:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
}

*{box-sizing:border-box}
body{font-family:var(--ac-font);color:var(--ac-text);background:#f4f7fb}
button,input,select,textarea{font-family:inherit}
button{cursor:pointer}

/* Global application canvas */
.shell{background:linear-gradient(145deg,#f4f7fb 0%,#eef4f9 100%)!important;color:var(--ac-text)!important}
.main{background:transparent!important}

/* Sidebar / navigation */
.sidebar{background:#fff!important;border-right:1px solid var(--ac-border)!important;box-shadow:4px 0 18px rgba(23,43,77,.035)!important}
.sidebar .side-brand{padding:20px 18px!important;border-bottom:1px solid var(--ac-border)!important}
.sidebar nav{padding:12px!important}
.sidebar nav button,.sidebar nav a{border-radius:10px!important;margin:3px 0!important;transition:all .16s ease!important}
.sidebar nav button:hover,.sidebar nav a:hover{background:#f2f6fc!important;color:var(--ac-primary)!important}
.sidebar nav button.active,.sidebar nav a.active{background:linear-gradient(135deg,#eff6ff,#e8f1ff)!important;color:var(--ac-primary-2)!important;border-left:3px solid var(--ac-primary)!important}

/* Apartment identity header */
.identity-header{background:rgba(255,255,255,.96)!important;border-bottom:1px solid var(--ac-border)!important;box-shadow:0 2px 12px rgba(23,43,77,.035)!important;padding:18px 28px!important}
.apartment-brand,.app-brand{min-width:0}
.identity-header .identity-photo{width:105px!important;height:124px!important;min-width:105px!important;min-height:124px!important;max-width:105px!important;max-height:124px!important;object-fit:cover!important;border-radius:10px!important;border:1px solid #d7e1eb!important;display:block!important}
.apartment-brand h2,.app-brand h2{color:var(--ac-ink)!important;font-weight:750!important;letter-spacing:-.02em}
.apartment-brand p,.app-brand p,.app-brand em{color:var(--ac-muted)!important}
.building-icon,.logo-mark{border-radius:12px!important;background:linear-gradient(135deg,#eaf3ff,#eefaf8)!important;border:1px solid #dce8f5!important}
.header-divider{height:8px!important;background:linear-gradient(90deg,#2563eb 0%,#0f9f9a 100%)!important;opacity:.9}

/* Page headers */
.main>h1,.page-title-row h1{color:var(--ac-ink)!important;font-weight:780!important;letter-spacing:-.025em!important}
.page-title-row{padding:20px 0 14px!important;margin:0!important;border-bottom:0!important}
.page-title-row .subtitle,.section-title-row .subtitle{color:var(--ac-muted)!important;line-height:1.55!important}
.section-title-row{margin-bottom:16px!important}

/* Common cards/panels */
.panel,.form-panel,.table-panel,.period-panel,.water-box,.utility-panel,.report-workspace,.individual-statement-panel,.import-panel,.golive-panel,.tenant-subscription-panel{
  background:#fff!important;border:1px solid var(--ac-border)!important;border-radius:var(--ac-radius)!important;box-shadow:var(--ac-shadow)!important;
}
.panel:hover,.form-panel:hover,.table-panel:hover{box-shadow:0 10px 28px rgba(23,43,77,.085)!important}
.panel h2,.form-panel h2,.table-panel h2{color:var(--ac-ink)!important;font-weight:730!important}
.panel h3,.form-panel h3,.table-panel h3{color:#243b5a!important;font-weight:700!important}
.help-text,.hint,.field-hint{color:#718096!important;line-height:1.5!important}

/* Uniform form controls */
.main input:not([type="checkbox"]):not([type="radio"]),
.main select,
.main textarea{
  width:100%;min-height:42px;padding:9px 12px!important;border:1px solid var(--ac-border-strong)!important;border-radius:10px!important;background:#fff!important;color:#1e293b!important;font-size:13px!important;line-height:1.35!important;box-shadow:0 1px 2px rgba(23,43,77,.035)!important;transition:border-color .16s ease,box-shadow .16s ease,background .16s ease!important;
}
.main textarea{min-height:94px;resize:vertical}
.main input::placeholder,.main textarea::placeholder{color:#9aa7b8!important}
.main input:not([type="checkbox"]):not([type="radio"]):focus,.main select:focus,.main textarea:focus{outline:none!important;border-color:#6b9cf6!important;box-shadow:0 0 0 3px rgba(37,99,235,.11)!important}
.main input:disabled,.main select:disabled,.main textarea:disabled{background:#f1f5f9!important;color:#94a3b8!important;cursor:not-allowed!important}
.main label{color:#334155;font-weight:650;font-size:12px;line-height:1.35}
.main label>input,.main label>select,.main label>textarea{margin-top:7px}

/* Dates — same presentation everywhere */
.main input[type="date"],.main input[type="month"]{min-height:42px}

/* Buttons */
.main button:not(.password-toggle){min-height:40px;padding:9px 15px!important;border:1px solid #cbd7e6!important;border-radius:10px!important;background:linear-gradient(180deg,#fff,#f7f9fc)!important;color:#334e6f!important;font-size:12px!important;font-weight:750!important;box-shadow:0 2px 5px rgba(23,43,77,.045)!important;transition:transform .15s ease,box-shadow .15s ease,background .15s ease,border-color .15s ease!important}
.main button:not(.password-toggle):hover{transform:translateY(-1px);box-shadow:0 6px 14px rgba(23,43,77,.09)!important;border-color:#aebed1!important;background:#fff!important}
.main button:not(.password-toggle):active{transform:translateY(0)}
.main button.auth-primary-button,.main button:not(.secondary):not(.danger):not(.button-link):not(.upload-button):not(.password-toggle):not(.auth-secondary-button):not(.auth-back-button){background:linear-gradient(135deg,var(--ac-primary),var(--ac-primary-2))!important;color:#fff!important;border-color:var(--ac-primary-2)!important;box-shadow:0 7px 16px rgba(37,99,235,.18)!important}
.main button.secondary,.main button.auth-secondary-button,.main button.auth-back-button{background:#fff!important;color:#36516f!important;border-color:#cbd7e6!important}
.main button.danger{background:linear-gradient(135deg,#c2413b,#a8322e)!important;color:#fff!important;border-color:#a8322e!important}
.main button:disabled{opacity:.55!important;cursor:not-allowed!important;transform:none!important;box-shadow:none!important}
.form-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px!important}

/* Tables */
.table-scroll,.table-wrap{border:1px solid var(--ac-border)!important;border-radius:12px!important;background:#fff!important;overflow:auto!important;box-shadow:0 3px 12px rgba(23,43,77,.035)!important}
.main table{width:100%;border-collapse:separate!important;border-spacing:0!important;font-size:12px!important}
.main table thead th{position:sticky;top:0;z-index:2;background:#f4f7fb!important;color:#52657e!important;text-transform:uppercase!important;letter-spacing:.045em!important;font-size:10px!important;font-weight:800!important;padding:11px 12px!important;border-bottom:1px solid var(--ac-border)!important;white-space:nowrap}
.main table tbody td{padding:12px!important;color:#334155!important;border-bottom:1px solid #edf1f6!important;vertical-align:middle!important}
.main table tbody tr:nth-child(even){background:#fbfcfe!important}
.main table tbody tr:hover{background:#f2f7ff!important}
.main table tbody tr:last-child td{border-bottom:0!important}
.main table td small{display:block;color:#8a98aa;margin-top:3px}
.empty,.empty-state{color:#8492a5!important;text-align:center!important;padding:28px!important}

/* KPI cards */
.kpis,.summary-grid,.report-kpis,.expense-kpis{gap:14px!important}
.card,.kpi-card,.report-kpi{border:1px solid var(--ac-border)!important;border-radius:14px!important;background:#fff!important;box-shadow:var(--ac-shadow)!important}
.card:hover,.kpi-card:hover,.report-kpi:hover{transform:translateY(-2px);box-shadow:var(--ac-shadow-hover)!important}
.kpi-card .label,.report-kpi span{color:#6b7c92!important;font-weight:700!important;font-size:11px!important}
.kpi-card .value,.report-kpi b{color:var(--ac-ink)!important;font-weight:800!important}

/* Filters, selectors and toolbars */
.period-panel,.table-toolbar,.history-toolbar,.report-controls,.report-actions,.import-actions,.platform-account-toolbar,.subscription-table-toolbar{border:1px solid var(--ac-border)!important;border-radius:12px!important;background:#f8fafc!important;padding:14px!important}
.selector-row,.period-options{gap:10px!important}
.period-options .radio,.checkbox-label,.checkbox-inline{border:1px solid var(--ac-border)!important;border-radius:9px!important;background:#fff!important;padding:8px 11px!important;color:#52657e!important}
.period-options .radio.selected{background:var(--ac-soft-blue)!important;border-color:#b9d2fb!important;color:var(--ac-primary-2)!important}

/* Module tabs / segmented controls */
.report-tabs,.category-chips{display:flex!important;gap:7px!important;flex-wrap:wrap!important;padding:5px!important;background:#f1f5f9!important;border:1px solid var(--ac-border)!important;border-radius:12px!important}
.report-tabs button,.category-chips button{min-height:38px!important;border:1px solid transparent!important;border-radius:9px!important;background:transparent!important;color:#64748b!important;box-shadow:none!important}
.report-tabs button.active,.category-chips button.active{background:linear-gradient(135deg,var(--ac-primary),#3b82f6)!important;color:#fff!important;border-color:var(--ac-primary)!important;box-shadow:0 5px 12px rgba(37,99,235,.18)!important}

/* Charts */
.donut-panel,.report-chart-card{background:#fff!important;border:1px solid var(--ac-border)!important;border-radius:14px!important;box-shadow:var(--ac-shadow)!important}
.chart-head h3,.donut-panel h2{color:var(--ac-ink)!important}
.chart-head p,.donut-foot{color:var(--ac-muted)!important}

/* Utility / resident / expense cards */
.utility-category,.utility-contact-card,.utility-watchman-card,.utility-form,.resident-form,.professional-expense-form,.maintenance-setup-grid{border:1px solid var(--ac-border)!important;border-radius:12px!important;background:#fff!important;box-shadow:0 4px 14px rgba(23,43,77,.045)!important}
.utility-category:hover,.utility-contact-card:hover,.utility-watchman-card:hover{box-shadow:var(--ac-shadow)!important;transform:translateY(-1px)}

/* Messages and badges */
.message{border-radius:10px!important;border:1px solid #bfdbfe!important;background:#eff6ff!important;color:#1e40af!important;padding:11px 13px!important}
.tag,.validity-badge,.lock-badge,.platform-console-badge,.audit-count-badge,.subscription-type,.subscription-status{font-weight:800!important;border-radius:999px!important}

/* Modal consistency */
.modal-backdrop{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;min-height:100dvh!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:20px!important;box-sizing:border-box!important;background:rgba(15,23,42,.56)!important;backdrop-filter:blur(3px)!important;z-index:99999!important;overflow:auto!important}.modal-backdrop .password-modal{position:relative!important;z-index:100000!important;max-width:min(680px,calc(100vw - 32px))!important;max-height:calc(100vh - 32px)!important;overflow:auto!important}
.password-modal{border:1px solid var(--ac-border)!important;border-radius:18px!important;background:#fff!important;box-shadow:0 24px 60px rgba(15,23,42,.2)!important}
.password-modal h2{color:var(--ac-ink)!important}
.password-modal textarea{min-height:110px!important}

/* Platform Owner — premium business console */
.platform-owner-console{background:#f7f9fc!important}
.po-top-header{background:#fff!important;border-bottom:1px solid var(--ac-border)!important}
.po-brand-line span:first-child{color:var(--ac-ink)!important;font-weight:850!important}
.po-console-label{color:#64748b!important}
.po-version-badge{background:#eff6ff!important;color:#1d4ed8!important;border:1px solid #dbeafe!important}
.po-user-pill{border:1px solid var(--ac-border)!important;background:#fff!important;box-shadow:0 2px 7px rgba(23,43,77,.05)!important}
.po-page-header{background:linear-gradient(135deg,#f8fbff,#f3f8fc)!important;border-bottom:1px solid var(--ac-border)!important}
.po-page-header h1{font-size:27px!important;color:var(--ac-ink)!important;font-weight:820!important}
.po-header-status{background:#ecfdf5!important;color:#047857!important;border-color:#bbf7d0!important}
.po-system-banner{background:#ecfdf5!important;border-color:#bbf7d0!important;color:#166534!important}

/* Platform tabs — identical visual language across all top-level tabs */
.platform-console-tabs{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:8px!important;padding:6px!important;margin:0 28px!important;background:#eef3f8!important;border:1px solid var(--ac-border)!important;border-radius:14px!important;box-shadow:0 4px 12px rgba(23,43,77,.05)!important;overflow:visible!important}
.platform-console-tabs button{min-height:68px!important;display:grid!important;grid-template-columns:34px 1fr!important;grid-template-rows:auto auto!important;align-items:center!important;text-align:left!important;padding:10px 13px!important;border:1px solid transparent!important;border-radius:10px!important;background:transparent!important;color:#52657e!important;box-shadow:none!important;white-space:normal!important}
.platform-console-tabs button span{font-size:13px!important;font-weight:800!important;color:#334e6f!important;line-height:1.2!important}
.platform-console-tabs button small{font-size:10px!important;color:#8090a5!important;margin-top:2px!important}
.platform-console-tabs button.active{background:linear-gradient(135deg,#2563eb,#3b82f6)!important;border-color:#1d4ed8!important;box-shadow:0 7px 16px rgba(37,99,235,.2)!important;color:#fff!important}
.platform-console-tabs button.active span,.platform-console-tabs button.active small{color:#fff!important}
.platform-console-tabs button:hover:not(.active){background:#fff!important;border-color:#cbd9e8!important;box-shadow:0 4px 10px rgba(23,43,77,.06)!important}

.platform-property{background:#fff!important;border:1px solid var(--ac-border)!important;border-radius:16px!important;box-shadow:var(--ac-shadow)!important}
.platform-property>h2{color:var(--ac-ink)!important}
.platform-property>.subtitle{color:var(--ac-muted)!important}
.platform-account-toolbar,.audit-filter-grid,.subscription-settings-form{background:#f8fafc!important;border:1px solid var(--ac-border)!important;border-radius:12px!important}
.subscription-policy-card,.subscription-plan-card,.subscription-detail-grid>div{background:#fff!important;border:1px solid var(--ac-border)!important;border-radius:13px!important;box-shadow:0 4px 14px rgba(23,43,77,.045)!important}
.subscription-plan-card:hover,.subscription-policy-card:hover{box-shadow:var(--ac-shadow)!important;transform:translateY(-2px)}
.subscription-plan-card:first-child{border-top:3px solid #3b82f6!important}
.subscription-plan-card:nth-child(2){border-top:3px solid #0f9f9a!important}
.subscription-plan-card:nth-child(3){border-top:3px solid #7c5ab5!important}

/* Keep controls in platform console aligned and never concatenate */
.subscription-settings-form{grid-template-columns:repeat(4,minmax(160px,1fr))!important;align-items:end!important}
.subscription-settings-form label{display:flex!important;flex-direction:column!important;gap:7px!important;min-width:0!important}
.subscription-settings-form input,.subscription-settings-form select{margin-top:0!important}
.subscription-new-plan{align-items:end!important;background:#f8fafc!important;border:1px dashed #c5d2e1!important;border-radius:12px!important}
.subscription-new-plan input{margin-top:0!important}
.subscription-plan-card label{gap:10px!important;align-items:center!important}
.subscription-plan-card input{margin-top:0!important}

/* Consistent search and audit */
.audit-filter-grid{align-items:end!important}
.audit-filter-grid label{font-size:11px!important;color:#334e6f!important}
.audit-toolbar{display:flex!important;align-items:center!important;gap:8px!important}
.audit-safety-note{background:#fffbeb!important;border-left:3px solid #f59e0b!important;color:#92400e!important}

/* Responsive */
@media(max-width:1100px){
  .subscription-settings-form{grid-template-columns:repeat(2,minmax(160px,1fr))!important}
  .platform-console-tabs{grid-template-columns:repeat(2,minmax(0,1fr))!important}
}
@media(max-width:760px){
  .identity-header{padding:14px 16px!important;flex-direction:column!important;align-items:flex-start!important;gap:12px!important}
  .page-title-row{padding-top:16px!important}
  .platform-console-tabs{grid-template-columns:1fr!important;margin:0 16px!important}
  .platform-console-tabs button{min-height:58px!important}
  .subscription-settings-form{grid-template-columns:1fr!important}
  .subscription-plan-grid,.subscription-policy-grid,.subscription-detail-grid{grid-template-columns:1fr!important}
  .main .form-actions button{width:auto!important}
}

      /* V6.5.1.1 — ApartCare unified dark-shell / light-surface design */
      .shell{background:#172033!important;color:#334155!important;grid-template-columns:260px minmax(0,1fr)!important}
      .sidebar{background:linear-gradient(180deg,#172033 0%,#1e293b 58%,#20364b 100%)!important;border-right:1px solid rgba(255,255,255,.08)!important;box-shadow:10px 0 28px rgba(0,0,0,.16)!important;color:#eaf1f8!important;padding:0 12px!important}
      .sidebar .side-brand{display:flex!important;align-items:center!important;gap:11px!important;padding:18px 10px 14px!important;border-bottom:1px solid rgba(255,255,255,.09)!important}.app-logo-sidebar{width:76px!important;height:50px!important;object-fit:contain!important;background:#fff!important;border-radius:11px!important;padding:4px!important;flex:0 0 auto!important}.side-brand-copy{display:flex!important;flex-direction:column!important;gap:2px!important;min-width:0!important}.side-brand-copy strong{color:#fff!important;font-size:15px!important;font-weight:850!important}.side-brand-copy span{color:#a9bdd0!important;font-size:9px!important;line-height:1.25!important}
      .sidebar .tag{margin:12px 6px!important;padding:9px 10px!important;background:rgba(15,159,154,.10)!important;border:1px solid rgba(15,159,154,.22)!important;border-radius:10px!important;color:#b9d8d6!important;font-size:10px!important;line-height:1.35!important}.sidebar .user-session{margin:10px 6px 12px!important;padding:12px!important;background:rgba(255,255,255,.06)!important;border:1px solid rgba(255,255,255,.10)!important;border-radius:12px!important;color:#dce7f1!important}.sidebar .user-session b{display:block!important;color:#fff!important}.sidebar .user-session span{display:block!important;color:#9fb4c9!important;font-size:11px!important;margin-top:2px!important}.sidebar .user-session small{display:block!important;color:#7fd0bc!important;font-size:9px!important;margin-top:4px!important}.sidebar .user-session button{width:100%!important;margin:10px 0 0!important;background:#fff!important;color:#1e293b!important;border:0!important;box-shadow:none!important}
      .sidebar nav{padding:4px 0 16px!important}.sidebar nav button{width:100%!important;margin:4px 0!important;min-height:46px!important;padding:10px 13px!important;border:1px solid transparent!important;border-radius:11px!important;background:transparent!important;color:#b7c6d6!important;font-weight:750!important;font-size:13px!important;box-shadow:none!important;text-align:left!important;transition:all .16s ease!important}.sidebar nav button:hover{background:rgba(255,255,255,.08)!important;color:#fff!important;transform:none!important}.sidebar nav button.active{background:linear-gradient(90deg,#eaf3ff,#dfeeff)!important;color:#1d4ed8!important;border-left:3px solid #3b82f6!important;box-shadow:0 8px 20px rgba(0,0,0,.18)!important}.sidebar nav button.active:after{content:'';display:block;height:3px;background:linear-gradient(90deg,#3b82f6,#0f9f9a);border-radius:3px;margin-top:5px;opacity:.85}
      .main{background:linear-gradient(145deg,#f5f8fc 0%,#eef3f8 100%)!important;min-height:100vh!important;padding-bottom:44px!important}.identity-header{background:rgba(255,255,255,.96)!important}.main>h1,.page-title-row h1{color:#172b4d!important}.panel,.form-panel,.table-panel,.period-panel,.water-box,.utility-panel,.report-workspace,.individual-statement-panel,.import-panel,.golive-panel,.tenant-subscription-panel{background:#fff!important;border-color:#dbe4ef!important;box-shadow:0 10px 28px rgba(23,43,77,.07)!important}.main input:not([type=checkbox]):not([type=radio]),.main select,.main textarea{background:#fff!important;color:#172b4d!important;border-color:#c8d5e5!important}.main input:focus,.main select:focus,.main textarea:focus{border-color:#2563eb!important;box-shadow:0 0 0 3px rgba(37,99,235,.12)!important}.main button:not(.secondary):not(.password-toggle):not(.category-chips button):not(.report-tabs button){background:linear-gradient(135deg,#2563eb,#315f96)!important;border-color:#2563eb!important;color:#fff!important}.main button.secondary{background:#fff!important;color:#334155!important;border-color:#c8d5e5!important}.main table thead th{background:#eaf0f6!important;color:#263b55!important}.main table tbody tr:hover{background:#eff6ff!important}
      .po-logo img{width:100%!important;height:100%!important;object-fit:contain!important;border-radius:10px!important;background:#fff!important;padding:3px!important}.po-logo{background:#fff!important;border:1px solid #dbeafe!important;padding:2px!important}
      @media(max-width:900px){.shell{grid-template-columns:1fr!important}.sidebar{position:relative!important;height:auto!important;padding:0 10px!important}.sidebar nav{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px!important}.sidebar nav button{margin:0!important}.main{min-height:auto!important}}

      /* V6.5.1.2 — refined ApartCare shell, branding consistency, compact responsive layout */
      .shell{grid-template-columns:248px minmax(0,1fr)!important;background:#172033!important}
      .sidebar{background:linear-gradient(180deg,#121b2b 0%,#18243a 58%,#1f3548 100%)!important;padding:0 10px!important}
      .sidebar .side-brand{padding:16px 8px 13px!important;gap:10px!important}
      .app-logo-sidebar{width:70px!important;height:48px!important;border-radius:10px!important;padding:3px!important}
      .side-brand-copy strong{font-size:14px!important;letter-spacing:-.01em!important}
      .side-brand-copy span{font-size:9px!important;color:#b7c7d8!important}
      .sidebar .tag{margin:10px 4px!important;padding:8px 9px!important;border-radius:9px!important;background:rgba(15,159,154,.11)!important;color:#c3dcd9!important}
      .sidebar .user-session{margin:8px 4px 10px!important;padding:10px!important;border-radius:10px!important}
      .sidebar nav{padding:2px 0 12px!important}
      .sidebar nav button{min-height:42px!important;margin:3px 0!important;padding:8px 11px!important;border-radius:10px!important;font-size:12.5px!important;color:#b9c8d8!important}
      .sidebar nav button.active{background:linear-gradient(135deg,#edf5ff,#dfeeff)!important;color:#174ea6!important;border-left:3px solid #4f8df7!important;box-shadow:0 6px 16px rgba(0,0,0,.20)!important}
      .main{padding-bottom:28px!important}
      .identity-header{padding:14px 22px!important;min-height:88px!important}
      .app-brand{gap:10px!important}
      .logo-mark{width:62px!important;height:52px!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;background:#fff!important;border:1px solid #dbe4ef!important}
      .logo-mark img{width:100%!important;height:100%!important;object-fit:contain!important;padding:2px!important}
      .app-brand h2{font-size:1.18rem!important;color:#172b4d!important}
      .app-brand p,.app-brand em{color:#30445e!important;font-style:normal!important}
      .app-brand em{font-weight:650!important}
      .data-start-badge{display:none!important}
      .apartment-brand > div > p:not(.account-context){color:#334155!important;font-weight:550!important}
      .app-brand p,.app-brand em{color:#334155!important}
      .app-brand em{font-style:italic!important;font-weight:650!important}
      .import-panel{padding:18px!important}
      .import-panel > h2{margin-bottom:8px!important}
      .import-panel > .help-text{margin:6px 0 12px!important;line-height:1.4!important}
      .import-panel .summary-grid{grid-template-columns:repeat(2,minmax(260px,380px))!important;gap:12px!important;margin-top:10px!important}
      .import-panel .summary-grid .card{min-height:108px!important;padding:14px 16px!important;border-radius:14px!important}
      .import-panel .summary-grid .card .value{font-size:1.22rem!important}
      .import-panel .summary-grid .card .help-text{font-size:.78rem!important;margin:5px 0 8px!important;line-height:1.35!important}
      .import-panel .summary-grid .card .button-link{min-height:36px!important;padding:7px 11px!important}
      .import-template-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:16px!important;width:100%!important}
      .import-template-grid .card{min-width:0!important;min-height:140px!important;height:auto!important;overflow:visible!important;padding:16px 18px!important}
      .import-template-grid .card .label,.import-template-grid .card .value,.import-template-grid .card .help-text{white-space:normal!important;overflow:visible!important;text-overflow:clip!important}
      .import-template-grid .card .help-text{min-height:38px!important}
      .selected-import-file{margin-top:8px;padding:7px 10px;border-radius:9px;background:#f1f6fb;color:#52657a;font-size:.8rem}
      .import-error-panel{margin-top:12px;padding:14px 16px;border:1px solid #f0c4c4;border-left:4px solid #d9534f;border-radius:12px;background:#fff8f8;color:#5d2525}
      .import-error-panel h3{margin:0 0 8px!important;font-size:.95rem;color:#8b2525}
      .import-error-panel ol{margin:0;padding-left:22px}.import-error-panel li{margin:4px 0;line-height:1.4}
      .company-brand{display:block!important;margin-top:2px!important;font-size:.7rem!important;font-weight:800!important;letter-spacing:.04em!important;color:#315f96!important}
      .side-brand-copy small{display:block;color:#91b7d8;font-size:9px;font-weight:800;letter-spacing:.03em;margin-top:1px}
      .import-panel + .import-panel{margin-top:12px!important}
      .main input[type=checkbox],.main input[type=radio],.auth-card input[type=checkbox],.auth-card input[type=radio]{width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;max-width:16px!important;max-height:16px!important;padding:0!important;appearance:auto!important;-webkit-appearance:auto!important}
      @media(max-width:760px){.import-panel .summary-grid,.import-template-grid{grid-template-columns:1fr!important}.import-template-grid .card{min-height:0!important}}
      .page-title-row{padding:14px 0 10px!important}
      .panel{border-radius:14px!important}
      .main table thead th{padding:9px 9px!important}
      .main table tbody td{padding:9px 9px!important}
      .main input:not([type=checkbox]):not([type=radio]),.main select,.main textarea{min-height:40px!important;padding:8px 10px!important}
      .main .form-actions{gap:8px!important}
      @media(max-width:900px){
        .shell{grid-template-columns:1fr!important}
        .sidebar{position:relative!important;height:auto!important;padding:0 8px!important}
        .sidebar nav{grid-template-columns:repeat(2,minmax(0,1fr))!important;display:grid!important;gap:4px!important}
        .sidebar nav button{min-height:40px!important}
        .identity-header{padding:12px 16px!important}
      }
      @media(max-width:560px){
        .sidebar nav{grid-template-columns:1fr!important}
        .sidebar .side-brand{align-items:flex-start!important}
        .app-logo-sidebar{width:62px!important;height:44px!important}
        .identity-header{display:flex!important;flex-direction:column!important;gap:10px!important}
        .identity-header .app-brand{width:100%!important}
        .logo-mark{width:54px!important;height:46px!important}
        .main{padding-left:10px!important;padding-right:10px!important}
        .panel{border-radius:12px!important}
      }


      .password-modal-branded{width:min(560px,calc(100vw - 32px))!important;max-height:calc(100vh - 32px)!important;overflow:auto!important;padding:28px!important;background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)!important;border:1px solid #d7e2f0!important;border-radius:22px!important;box-shadow:0 28px 80px rgba(15,23,42,.30)!important;color:#172b4d!important}
.password-modal-branded .password-modal-brand{display:flex!important;align-items:center!important;gap:13px!important;padding:0 0 18px!important;margin-bottom:20px!important;border-bottom:1px solid #e2e8f0!important}
.password-modal-branded .password-modal-brand img{width:58px!important;height:58px!important;object-fit:contain!important;border-radius:14px!important;background:#fff!important;border:1px solid #dbe6f2!important;padding:5px!important;box-shadow:0 5px 14px rgba(15,23,42,.08)!important}
.password-modal-branded .password-modal-brand div{display:flex!important;flex-direction:column!important;gap:2px!important}
.password-modal-branded .password-modal-brand strong{font-size:18px!important;line-height:1.2!important;color:#172b4d!important}
.password-modal-branded .password-modal-brand span{font-size:12px!important;font-weight:650!important;color:#334155!important}
.password-modal-branded .modal-icon{width:48px!important;height:48px!important;display:flex!important;align-items:center!important;justify-content:center!important;border-radius:14px!important;background:#eaf2ff!important;border:1px solid #cfe0ff!important;font-size:23px!important;margin:0 0 12px!important}
.password-modal-branded h2{font-size:29px!important;line-height:1.18!important;margin:0 0 10px!important;color:#172b4d!important;letter-spacing:-.35px!important}
.password-modal-branded>p{margin:0 0 22px!important;color:#64748b!important;font-size:15px!important;line-height:1.65!important}
.password-modal-branded form{display:flex!important;flex-direction:column!important;gap:18px!important}
.password-modal-branded form>label{display:flex!important;flex-direction:column!important;gap:8px!important;color:#334155!important;font-size:14px!important;font-weight:800!important}
.password-modal-branded .password-field{display:grid!important;grid-template-columns:minmax(0,1fr) 48px!important;gap:8px!important;align-items:stretch!important}
.password-modal-branded .password-field input{width:100%!important;min-height:48px!important;box-sizing:border-box!important;border:1px solid #cbd8e8!important;border-radius:12px!important;background:#fff!important;color:#172b4d!important;padding:11px 14px!important;font-size:16px!important;outline:none!important;box-shadow:inset 0 1px 2px rgba(15,23,42,.03)!important}
.password-modal-branded .password-field input:focus{border-color:#3b82f6!important;box-shadow:0 0 0 4px rgba(59,130,246,.12)!important}
.password-modal-branded .password-toggle{min-height:48px!important;width:48px!important;border:1px solid #cbd8e8!important;border-radius:12px!important;background:#edf4ff!important;color:#172b4d!important;display:flex!important;align-items:center!important;justify-content:center!important;cursor:pointer!important;font-size:18px!important;padding:0!important}
.password-modal-branded .password-toggle:hover{background:#e2edff!important;border-color:#9dbbe8!important}
.password-modal-branded .form-actions{margin-top:2px!important;display:flex!important;justify-content:flex-start!important}
.password-modal-branded .password-update-button{min-height:48px!important;border-radius:12px!important;padding:12px 20px!important;font-size:15px!important}
.password-modal-branded .message{margin:0!important;border-radius:11px!important}

/* V6.5.3 — single checkbox standard, matching Monthly Maintenance controls.
   Keep checkboxes independent from the large text-input sizing rules. */
input[type="checkbox"]{
  width:16px!important;height:16px!important;
  min-width:16px!important;min-height:16px!important;
  max-width:16px!important;max-height:16px!important;
  inline-size:16px!important;block-size:16px!important;
  flex:0 0 16px!important;box-sizing:border-box!important;
  margin:0!important;padding:0!important;
  border:0!important;border-radius:3px!important;
  appearance:auto!important;-webkit-appearance:auto!important;
  accent-color:#2563eb!important;
  transform:none!important;
  vertical-align:middle!important;
}
.checkbox-inline,.checkbox-label,.remember-login{
  display:inline-flex!important;align-items:center!important;
  gap:8px!important;min-height:24px!important;
}
.checkbox-inline input[type="checkbox"],.checkbox-label input[type="checkbox"],.remember-login input[type="checkbox"]{
  width:16px!important;height:16px!important;min-width:16px!important;max-width:16px!important;
  flex:0 0 16px!important;margin:0!important;padding:0!important;
}

/* V6.5.13 — single authoritative checkbox size.
   Do not scale the visual control below its 16px size. */
input[type="checkbox"]{
  width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;
  max-width:16px!important;max-height:16px!important;inline-size:16px!important;block-size:16px!important;
  flex:0 0 16px!important;box-sizing:border-box!important;padding:0!important;margin:0!important;
  appearance:auto!important;-webkit-appearance:auto!important;accent-color:#2563eb!important;
  transform:none!important;transform-origin:center!important;box-shadow:none!important;border-radius:3px!important;
  vertical-align:middle!important;
}
.checkbox-inline input[type="checkbox"],.checkbox-label input[type="checkbox"],.remember-login input[type="checkbox"],
.platform-owner-auth-shell input[type="checkbox"]{
  width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;
  max-width:16px!important;max-height:16px!important;flex:0 0 16px!important;
  transform:none!important;margin:0!important;padding:0!important;
}
.platform-owner-auth-shell .auth-back-button.platform-return-button{
  display:inline-flex!important;align-items:center!important;justify-content:center!important;
  min-height:40px!important;padding:9px 15px!important;margin:10px 0 0!important;
  border:1px solid #cbd7e6!important;border-radius:10px!important;background:#f7f9fc!important;
  color:#36516f!important;font-weight:800!important;box-shadow:0 4px 10px rgba(51,65,85,.06)!important;
}
.platform-owner-auth-shell .auth-back-button.platform-return-button:hover{
  background:#eef4fb!important;color:#315f96!important;transform:translateY(-1px)!important;
}
.platform-recovery-user-toolbar{display:grid;grid-template-columns:minmax(280px,1fr) auto;align-items:end;gap:10px;margin:0 0 12px;padding:12px 14px;border:1px solid #dbe5ef;border-radius:13px;background:#f8fbff}
.platform-recovery-user-toolbar label{display:grid;gap:6px;font-weight:750;color:#425773;font-size:.82rem}
.platform-recovery-user-toolbar input{width:100%;min-height:40px;border:1px solid #c9d5e3!important;border-radius:10px!important;background:#fff!important;padding:8px 10px!important;color:#263b57!important;box-sizing:border-box!important}
.recovery-refresh-button{align-self:end;white-space:nowrap}
@media(max-width:700px){.platform-recovery-user-toolbar{grid-template-columns:1fr}.recovery-refresh-button{width:100%}}

/* V6.5.3 — Platform Owner audit log is a compact secondary workspace,
   not the dominant page area. The table scrolls internally. */
.platform-property.audit-history-console{padding:20px!important}
.audit-history-console .section-title-row{margin-bottom:12px!important}
.audit-history-console .section-title-row .subtitle{margin:3px 0 0!important;line-height:1.4!important}
.audit-history-console .audit-filter-grid{gap:9px!important;padding:12px!important}
.audit-history-console .audit-toolbar{margin:9px 0!important}
.audit-history-console .audit-safety-note{margin-bottom:9px!important;padding:8px 11px!important}
.audit-history-console .audit-results-scroll{
  max-height:250px!important;overflow:auto!important;
  border-radius:10px!important;
}
.audit-history-console .audit-results-scroll table{font-size:11px!important}
.audit-history-console .audit-results-scroll table thead th{padding:8px 9px!important;font-size:9px!important}
.audit-history-console .audit-results-scroll table tbody td{padding:8px 9px!important;font-size:11px!important;line-height:1.3!important}
.audit-history-console .audit-results-scroll table tbody td small{font-size:10px!important}
@media(max-width:760px){
  .audit-history-console .audit-results-scroll{max-height:320px!important}
}
@media(max-width:640px){.password-modal-branded{padding:21px!important;border-radius:18px!important}.password-modal-branded h2{font-size:24px!important}.password-modal-branded .password-modal-brand img{width:50px!important;height:50px!important}}

      /* V6.5.7 — standalone Platform Owner tenant/admin password recovery */
      .platform-recovery-panel .section-title-row{align-items:flex-start!important}
      .platform-recovery-badge{display:inline-flex;align-items:center;padding:7px 11px;border-radius:999px;background:#eef4ff;color:#2457a6;border:1px solid #cfe0ff;font-size:.72rem;font-weight:850;white-space:nowrap}
      .platform-recovery-toolbar{display:grid;grid-template-columns:minmax(320px,1fr) auto;align-items:end;gap:12px;margin:18px 0;padding:15px;border:1px solid #dbe5ef;border-radius:15px;background:linear-gradient(135deg,#fbfdff,#f5f8fc)}
      .platform-recovery-toolbar label{display:grid;gap:6px;font-weight:750;color:#425773;font-size:.82rem}
      .platform-recovery-toolbar select{width:100%;min-height:42px;border:1px solid #c9d5e3!important;border-radius:10px!important;background:#fff!important;padding:9px 11px!important;color:#263b57!important}
      .platform-recovery-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 14px}
      .platform-recovery-summary>div{padding:12px 14px;border:1px solid #dbe5ef;border-radius:12px;background:#f8fbff}
      .platform-recovery-summary span{display:block;color:#71829a;font-size:.72rem;font-weight:700;margin-bottom:3px}
      .platform-recovery-summary b{display:block;color:#1f3b5d;font-size:.9rem}
      .platform-recovery-note{margin:0 0 14px;padding:11px 13px;border-left:4px solid #3b82f6;background:#eff6ff;color:#38577c;border-radius:8px;font-size:.82rem;line-height:1.45}
      .platform-recovery-panel .business-grid table{min-width:920px}
      .platform-recovery-panel .business-grid td:last-child{white-space:nowrap}
      .platform-recovery-panel .business-grid td:last-child button{margin:2px}
      @media(max-width:900px){.platform-recovery-toolbar{grid-template-columns:1fr}.platform-recovery-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:600px){.platform-recovery-summary{grid-template-columns:1fr}.platform-recovery-badge{align-self:flex-start}}

      /* V6.5.13: legacy 14px/custom checkbox overrides removed. All checkboxes use the shared 16px rule. */
      .platform-owner-auth-shell .platform-recovery-panel{padding:26px!important;background:#fff!important;border:1px solid #dbe4ef!important;border-top:4px solid #3f6fa8!important;border-radius:18px!important;box-shadow:0 10px 28px rgba(23,43,77,.07)!important}
      .platform-owner-auth-shell .recovery-page-hero{display:flex!important;align-items:center!important;gap:15px!important;margin:-2px -2px 18px!important;padding:16px 18px!important;border:1px solid #dbe5ef!important;border-radius:14px!important;background:linear-gradient(135deg,#f7faff,#eef5fb)!important}
      .platform-owner-auth-shell .recovery-page-hero .ac-page-icon{width:48px!important;height:48px!important;flex:0 0 48px!important;display:grid!important;place-items:center!important;border-radius:13px!important;background:#eaf3ff!important;border:1px solid #cfe0ff!important;font-size:23px!important}
      .platform-owner-auth-shell .recovery-page-hero .ac-page-copy{min-width:0!important;flex:1!important}
      .platform-owner-auth-shell .recovery-page-hero .ac-eyebrow{font-size:10px!important;letter-spacing:.09em!important;font-weight:850!important;color:#47709d!important;margin-bottom:2px!important}
      .platform-owner-auth-shell .recovery-page-hero h2{margin:0!important;color:#172b4d!important;font-size:1.45rem!important;line-height:1.2!important}
      .platform-owner-auth-shell .recovery-page-hero p{margin:5px 0 0!important;color:#667b96!important;font-size:.86rem!important;line-height:1.45!important;font-weight:600!important}
      .platform-owner-auth-shell .recovery-page-hero .platform-recovery-badge{flex:0 0 auto!important}
      .platform-owner-auth-shell .platform-recovery-toolbar{display:grid!important;grid-template-columns:minmax(280px,1.2fr) minmax(300px,1fr) auto!important;align-items:end!important;gap:12px!important;margin:0 0 16px!important;padding:14px!important;border:1px solid #dbe5ef!important;border-radius:14px!important;background:#f8fbff!important}
      .platform-owner-auth-shell .platform-recovery-toolbar label{display:grid!important;gap:6px!important;font-weight:800!important;color:#425773!important;font-size:.8rem!important}
      .platform-owner-auth-shell .platform-recovery-toolbar input,.platform-owner-auth-shell .platform-recovery-toolbar select{min-height:40px!important;height:40px!important;border:1px solid #c9d5e3!important;border-radius:10px!important;background:#fff!important;padding:8px 10px!important;color:#263b57!important;box-sizing:border-box!important}
      .platform-owner-auth-shell .platform-recovery-toolbar button{min-height:40px!important;height:40px!important;white-space:nowrap!important}
      .platform-owner-auth-shell .platform-recovery-summary{margin:0 0 14px!important}
      .platform-owner-auth-shell .platform-recovery-note{background:#f1f7ff!important;border-left-color:#3b82f6!important}
      .platform-owner-auth-shell .platform-recovery-user-toolbar{background:#f8fbff!important}
      @media(max-width:900px){.platform-owner-auth-shell .platform-recovery-toolbar{grid-template-columns:1fr 1fr}.platform-owner-auth-shell .platform-recovery-toolbar button{grid-column:1/-1;width:max-content}}
      @media(max-width:600px){.platform-owner-auth-shell .platform-recovery-panel{padding:16px!important}.platform-owner-auth-shell .recovery-page-hero{align-items:flex-start!important;flex-wrap:wrap!important}.platform-owner-auth-shell .platform-recovery-toolbar{grid-template-columns:1fr!important}.platform-owner-auth-shell .platform-recovery-toolbar button{grid-column:auto!important;width:100%!important}}

      /* V6.5.17 — production polish: local login errors + professional Platform Owner recovery directory */
      .auth-login-actions{display:flex!important;align-items:center!important;gap:12px!important;flex-wrap:wrap!important}
      .login-inline-feedback{display:inline-flex!important;align-items:center!important;gap:7px!important;min-height:42px!important;max-width:min(520px,100%)!important;padding:9px 12px!important;border:1px solid #fecaca!important;border-left:4px solid #dc2626!important;border-radius:10px!important;background:#fff5f5!important;color:#991b1b!important;font-size:12px!important;font-weight:750!important;line-height:1.35!important;box-sizing:border-box!important}
      .login-inline-feedback>span:first-child{font-size:15px!important;flex:0 0 auto!important}.platform-login-feedback{border-color:#fed7aa!important;border-left-color:#ea580c!important;background:#fff7ed!important;color:#9a3412!important}
      .platform-recovery-user-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px!important;margin-top:4px!important}
      .platform-user-card{min-width:0!important;border:1px solid #dbe5ef!important;border-radius:16px!important;background:linear-gradient(145deg,#fff,#f8fbff)!important;box-shadow:0 7px 20px rgba(24,55,88,.07)!important;overflow:hidden!important;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease!important}.platform-user-card:hover{transform:translateY(-1px)!important;box-shadow:0 12px 26px rgba(24,55,88,.11)!important;border-color:#c5d7eb!important}
      .platform-user-card-top{display:flex!important;align-items:center!important;gap:11px!important;padding:14px 15px!important;border-bottom:1px solid #e8eef5!important;background:linear-gradient(135deg,#f8fbff,#eef5fc)!important}.platform-user-avatar{width:42px!important;height:42px!important;flex:0 0 42px!important;border-radius:12px!important;display:grid!important;place-items:center!important;background:linear-gradient(135deg,#2563eb,#3b82f6)!important;color:#fff!important;font-weight:900!important;font-size:13px!important;box-shadow:0 5px 12px rgba(37,99,235,.22)!important}.platform-user-identity{min-width:0!important;flex:1!important}.platform-user-name{font-size:14px!important;font-weight:850!important;color:#172b4d!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.platform-user-id{margin-top:2px!important;font-size:11px!important;font-weight:750!important;color:#71829a!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      .platform-role-badge{display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:5px 8px!important;border-radius:999px!important;border:1px solid #d7e3f0!important;background:#fff!important;color:#38577c!important;font-size:10px!important;font-weight:850!important;white-space:nowrap!important}.platform-role-badge.role-admin{background:#eef6ff!important;color:#1d4ed8!important;border-color:#cfe0ff!important}.platform-role-badge.role-viewer{background:#f0fdf4!important;color:#15803d!important;border-color:#ccefd6!important}.platform-role-badge.role-caretaker{background:#fff7ed!important;color:#c2410c!important;border-color:#fed7aa!important}.platform-role-badge.role-supervisor{background:#faf5ff!important;color:#7e22ce!important;border-color:#e9d5ff!important}
      .platform-user-meta{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px 16px!important;padding:13px 15px!important}.platform-user-meta>div{min-width:0!important}.platform-user-meta span,.platform-user-activity span{display:block!important;color:#8191a6!important;font-size:9px!important;font-weight:800!important;text-transform:uppercase!important;letter-spacing:.055em!important;margin-bottom:3px!important}.platform-user-meta b{display:block!important;color:#334e6f!important;font-size:11px!important;font-weight:750!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.user-status-active{color:#15803d!important}.user-status-inactive{color:#64748b!important}.user-status-locked{color:#b91c1c!important}
      .platform-user-card-footer{display:flex!important;align-items:flex-end!important;justify-content:space-between!important;gap:12px!important;padding:12px 15px!important;border-top:1px solid #e8eef5!important;background:#fbfdff!important}.platform-user-activity{min-width:0!important}.platform-user-activity b{display:block!important;color:#334e6f!important;font-size:10px!important;font-weight:800!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.platform-user-activity small{display:block!important;margin-top:3px!important;color:#94a3b8!important;font-size:9px!important}.platform-user-actions{display:flex!important;justify-content:flex-end!important;gap:6px!important;flex-wrap:wrap!important}.platform-user-actions button{margin:0!important;min-height:32px!important;padding:6px 9px!important;font-size:10px!important;white-space:nowrap!important}.platform-recovery-empty{grid-column:1/-1!important;padding:28px!important;text-align:center!important;border:1px dashed #cbd8e7!important;border-radius:14px!important;background:#f8fbff!important;color:#64748b!important;font-weight:700!important}
      @media(max-width:900px){.platform-recovery-user-grid{grid-template-columns:1fr!important}}@media(max-width:640px){.auth-login-actions{align-items:stretch!important;flex-direction:column!important}.login-inline-feedback{width:100%!important;max-width:none!important}.platform-user-meta{grid-template-columns:1fr!important}.platform-user-card-footer{align-items:stretch!important;flex-direction:column!important}.platform-user-actions{justify-content:flex-start!important}.platform-user-actions button{flex:1 1 auto!important}}
      /* V6.5.13 — final checkbox size is controlled by the authoritative 16px rule. */
      /* Keep a consistent 16x16 control matching the established Monthly Maintenance UI. */
      input[type="checkbox"]{
        appearance:auto!important;-webkit-appearance:auto!important;
        width:16px!important;height:16px!important;
        min-width:16px!important;min-height:16px!important;
        max-width:16px!important;max-height:16px!important;
        inline-size:16px!important;block-size:16px!important;
        flex:0 0 16px!important;
        margin:0!important;padding:0!important;
        transform:none!important;
        border:0!important;border-radius:3px!important;
        box-shadow:none!important;
        accent-color:#2563eb!important;
        vertical-align:middle!important;
        box-sizing:border-box!important;
      }
      .checkbox-inline input[type="checkbox"],.checkbox-label input[type="checkbox"]{
        width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;
        max-width:16px!important;max-height:16px!important;flex:0 0 16px!important;
        transform:none!important;margin:0!important;padding:0!important;
      }

      /* V6.5.13 CORE FUNCTIONALITY FIX 14 — cloud layout hardening.
         Keep module identity/title/action areas horizontal on desktop. Forms and
         dense data-entry fields remain intentionally vertical for usability. */
      .page-title-row,.section-title-row{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:18px!important;width:100%!important;box-sizing:border-box!important}
      .page-title-row>div:first-child,.section-title-row>div:first-child{min-width:0!important;flex:1 1 auto!important}
      .page-title-row>button,.page-title-row>label,.section-title-row>button,.section-title-row>.audit-count-badge{flex:0 0 auto!important}
      .page-title-row h1,.page-title-row h2,.page-title-row p,.section-title-row h2,.section-title-row h3,.section-title-row p{margin-top:0!important}
      .module-header,.module-brand-row,.module-identity-row{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:18px!important;flex-wrap:nowrap!important;width:100%!important}
      .module-header>*:first-child,.module-brand-row>*:first-child,.module-identity-row>*:first-child{min-width:0!important;flex:1 1 auto!important}
      .module-header>*:last-child,.module-brand-row>*:last-child,.module-identity-row>*:last-child{flex:0 0 auto!important}

      /* V6.5.13 CORE FUNCTIONALITY FIX 13 — deterministic cloud layout. */
      .identity-header{
        display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:space-between!important;
        gap:28px!important;flex-wrap:nowrap!important;width:100%!important;box-sizing:border-box!important;
      }
      .identity-header .apartment-brand{
        display:flex!important;flex:1 1 auto!important;min-width:0!important;align-items:center!important;gap:14px!important;
      }
      .identity-header .apartment-brand>div:last-child{min-width:0!important;display:block!important}
      .identity-header .apartment-brand h2,.identity-header .apartment-brand p{margin-top:0!important;margin-bottom:4px!important}
      .identity-header .app-brand{
        display:flex!important;flex:0 0 auto!important;align-items:center!important;gap:12px!important;min-width:300px!important;
        justify-content:flex-end!important;white-space:nowrap!important;
      }
      .identity-header .app-brand>div:last-child{min-width:0!important;display:flex!important;flex-direction:column!important;gap:2px!important}
      .identity-header .app-brand h2,.identity-header .app-brand p,.identity-header .app-brand em{margin:0!important}

      /* .two-donuts had column sizing without an explicit grid display, so the
         browser stacked the two dashboard charts vertically. */
      .two-donuts{
        display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:24px!important;
        align-items:stretch!important;width:100%!important;
      }
      .two-donuts>.donut-panel,.two-donuts>.premium-donut-panel{min-width:0!important;width:100%!important;box-sizing:border-box!important}
      @media(max-width:900px){
        .identity-header{gap:18px!important;padding:14px 18px!important}
        .identity-header .app-brand{min-width:270px!important}
        .two-donuts{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px!important}
      }
      @media(max-width:680px){
        .platform-owner-auth-shell .auth-brand{align-items:flex-start!important;gap:12px!important}
        .platform-owner-auth-shell .auth-logo{width:82px!important;height:60px!important;flex-basis:82px!important}
        .platform-owner-auth-shell .auth-brand-copy h1{font-size:24px!important}
        .page-title-row,.section-title-row{align-items:flex-start!important;flex-direction:column!important;gap:10px!important}
        .page-title-row>button,.page-title-row>label,.section-title-row>button,.section-title-row>.audit-count-badge{align-self:flex-start!important}
        .identity-header{gap:10px!important;padding:12px 14px!important}
        .identity-header .apartment-brand{gap:9px!important}
        .identity-header .app-brand{min-width:245px!important;gap:8px!important}
        .identity-header .logo-mark{width:50px!important;height:42px!important;flex:0 0 50px!important}
        .identity-header .app-brand h2{font-size:1rem!important}
        .identity-header .app-brand p,.identity-header .app-brand em{font-size:.72rem!important;line-height:1.2!important}
        .identity-header .apartment-brand h2{font-size:1.05rem!important}
        .identity-header .apartment-brand p{font-size:.72rem!important;line-height:1.2!important}
        .two-donuts{grid-template-columns:1fr!important}
      }
            /* V6.5.13 CORE FUNCTIONALITY FIX 15 — final application workspace layout system.
         Desktop forms use compact multi-column grids; controls remain stacked inside each field.
         Mobile intentionally collapses to one column for usability. */
      .main .form-panel,.main .panel,.main .table-panel,.main .water-box{box-sizing:border-box!important}
      .main .resident-form{
        display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:16px 18px!important;padding:18px!important;align-items:start!important;
      }
      .main .resident-form>label{
        display:flex!important;flex-direction:column!important;gap:6px!important;width:100%!important;min-width:0!important;
        align-self:start!important;color:#334e6f!important;font-weight:750!important;line-height:1.25!important;
      }
      .main .resident-form>label.full{grid-column:1/-1!important}
      .main .resident-form>label>input,.main .resident-form>label>select,.main .resident-form>label>textarea{
        width:100%!important;min-width:0!important;max-width:100%!important;box-sizing:border-box!important;
        min-height:42px!important;height:auto!important;margin:0!important;
      }
      .main .resident-form>label>textarea{min-height:82px!important;resize:vertical!important}
      .main .resident-form .form-actions{grid-column:1/-1!important;display:flex!important;align-items:center!important;gap:10px!important;margin-top:2px!important;padding-top:12px!important;border-top:1px solid #e6edf5!important}

      /* Monthly Maintenance — compact four-column setup and water calculation. */
      .main .maintenance-setup-grid{
        display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:14px 16px!important;
        padding:16px!important;align-items:start!important;
      }
      .main .maintenance-setup-grid>label{
        display:flex!important;flex-direction:column!important;gap:6px!important;min-width:0!important;
        color:#334e6f!important;font-weight:750!important;line-height:1.25!important;
      }
      .main .maintenance-setup-grid>label input,.main .maintenance-setup-grid>label select{
        width:100%!important;min-width:0!important;box-sizing:border-box!important;min-height:42px!important;
      }
      .main .maintenance-setup-grid>label:has(input[type="checkbox"]){
        position:relative!important;padding-top:0!important;
      }
      .main .maintenance-setup-grid>label input[type="checkbox"]{
        width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;
        margin:0 7px 0 0!important;vertical-align:middle!important;align-self:flex-start!important;
      }
      .main .maintenance-setup-grid>label input[type="checkbox"] + *{min-width:0}
      .main .water-box{padding:16px!important;margin-top:14px!important}
      .main .water-box>h3{margin:0 0 12px!important}
      .main .water-box .maintenance-setup-grid{border:0!important;box-shadow:none!important;padding:0!important;background:transparent!important}

      /* Month toolbars: title, month selector and actions share one compact row. */
      .main .month-heading{
        display:flex!important;align-items:center!important;justify-content:space-between!important;gap:18px!important;
        flex-wrap:wrap!important;width:100%!important;margin:0!important;padding:0 0 12px!important;
      }
      .main .month-heading>h2{margin:0!important;flex:1 1 auto!important;min-width:220px!important}
      .main .month-selector{display:flex!important;align-items:center!important;gap:8px!important;flex:0 0 auto!important}
      .main .month-selector label{display:inline-flex!important;align-items:center!important;gap:8px!important;margin:0!important;font-weight:750!important;color:#52657e!important;white-space:nowrap!important}
      .main .month-selector input{width:160px!important;min-width:160px!important;min-height:42px!important}
      .main .payment-period>.page-title-row{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;flex-wrap:wrap!important}
      .main .payment-period>.page-title-row .help-text{flex:1 1 520px!important}
      .main .payment-period>.page-title-row .form-actions{flex:0 0 auto!important;margin:0!important;padding:0!important;border:0!important}

      /* Payment summary and Expense summary — horizontal KPI cards. */
      .main .summary-grid,.main .expense-kpis,.main .kpi-grid{
        display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:14px!important;width:100%!important;
      }
      .main .expense-kpis{grid-template-columns:repeat(4,minmax(0,1fr))!important}
      .main .summary-grid>.card,.main .expense-kpis>.card,.main .kpi-grid>.kpi-card{min-width:0!important;width:100%!important}
      .main .expense-kpis>.card{min-height:104px!important}

      /* Expense entry — compact professional four-column layout. */
      .main .professional-expense-form{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:14px 16px!important;padding:18px!important;align-items:start!important}
      .main .professional-expense-form label{min-width:0!important;width:100%!important}
      .main .professional-expense-form label.wide{grid-column:span 2!important}
      .main .professional-expense-form .form-actions{grid-column:1/-1!important;display:flex!important;align-items:center!important;gap:10px!important}

      /* Reports — controls sized to the actual data type instead of full workspace width. */
      .main .report-controls{
        display:flex!important;align-items:flex-end!important;gap:12px!important;flex-wrap:wrap!important;
        width:100%!important;box-sizing:border-box!important;
      }
      .main .report-controls>label{display:flex!important;flex-direction:column!important;gap:6px!important;flex:0 0 auto!important;width:auto!important;min-width:0!important;color:#334e6f!important;font-weight:750!important}
      .main .report-controls>label select{width:220px!important;min-width:220px!important;max-width:280px!important;min-height:42px!important}
      .main .report-controls>label input[type="month"]{width:160px!important;min-width:160px!important}
      .main .report-controls>label select[value="2024"],.main .report-controls>label select[value="2025"],.main .report-controls>label select[value="2026"],.main .report-controls>label select[value="2027"]{width:120px!important;min-width:120px!important}
      .main .period-options{display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:wrap!important;width:max-content!important;max-width:100%!important}
      .main .period-options>label:not(.radio){display:inline-flex!important;align-items:center!important;gap:7px!important;width:auto!important;min-width:0!important}
      .main .period-options>label:not(.radio) select{width:120px!important;min-width:120px!important}
      .main .period-options>label:not(.radio) input[type="month"]{width:160px!important;min-width:160px!important}
      .main .report-tabs{display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:wrap!important}
      .main .report-tabs button{white-space:nowrap!important}

      /* Dashboard — always horizontal on normal desktop widths. */
      .main .dashboard-kpis{display:grid!important;grid-template-columns:repeat(6,minmax(125px,1fr))!important;gap:14px!important;width:100%!important;align-items:stretch!important}
      .main .dashboard-kpis>.kpi-card{min-width:0!important;width:100%!important}
      .main .two-donuts{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:20px!important;width:100%!important}

      /* Module headers remain horizontal; only mobile intentionally stacks them. */
      .main .page-title-row,.main .section-title-row{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;flex-wrap:wrap!important}
      .main .page-title-row>div:first-child,.main .section-title-row>div:first-child{min-width:0!important;flex:1 1 auto!important}
      .main .page-title-row>button,.main .section-title-row>button{flex:0 0 auto!important}

      /* Settings / Administration / Utilities / Go-Live inherit the same compact grid. */
      .main .utility-form{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:14px 16px!important;padding:16px!important}
      .main .utility-form .form-actions{grid-column:1/-1!important}
      .main .history-toolbar{display:flex!important;align-items:flex-end!important;justify-content:space-between!important;gap:14px!important;flex-wrap:wrap!important}
      .main .history-toolbar select{width:260px!important;min-width:260px!important}

      @media(max-width:1250px){
        .main .dashboard-kpis{grid-template-columns:repeat(3,minmax(0,1fr))!important}
        .main .resident-form,.main .maintenance-setup-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        .main .professional-expense-form{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        .main .utility-form{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        .main .expense-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      }
      @media(max-width:800px){
        .main .dashboard-kpis,.main .summary-grid,.main .expense-kpis,.main .kpi-grid,.main .two-donuts,.main .resident-form,.main .maintenance-setup-grid,.main .professional-expense-form,.main .utility-form{grid-template-columns:1fr!important}
        .main .resident-form>label.full,.main .professional-expense-form label.wide{grid-column:auto!important}
        .main .month-heading{align-items:flex-start!important;flex-direction:column!important}
        .main .month-selector{width:100%!important}.main .month-selector input{width:100%!important;min-width:0!important}
        .main .report-controls{align-items:stretch!important;flex-direction:column!important}.main .report-controls>label,.main .report-controls>label select,.main .report-controls>label input[type="month"]{width:100%!important;max-width:none!important;min-width:0!important}
        .main .period-options{width:100%!important}
        .main .history-toolbar select{width:100%!important;min-width:0!important}
      }

      /* V6.5.13 CLEAN UI BUILD 2 — professional workspace frame, compact KPIs and true circular donuts. */
      .main{padding-left:24px!important;padding-right:24px!important;padding-bottom:36px!important;box-sizing:border-box!important}
      .main>.identity-header,.main>.header-divider{margin-left:-24px!important;margin-right:-24px!important}
      .main>.identity-header{padding-left:28px!important;padding-right:28px!important}
      .main>.header-divider{width:auto!important}
      .main>.panel,.main>.form-panel,.main>.table-panel,.main>.period-panel,.main>.water-box,.main>.utility-panel,.main>.report-workspace,.main>.individual-statement-panel,.main>.import-panel,.main>.golive-panel,.main>.tenant-subscription-panel{margin-left:0!important;margin-right:0!important}
      .main .kpi-card,.main .expense-kpis>.card,.main .summary-grid>.card,.main .report-kpi{min-height:96px!important;padding:14px 16px!important;border-radius:14px!important}
      .main .kpi-card .value,.main .expense-kpis .value{font-size:1.55rem!important}
      .main .kpi-card .label,.main .expense-kpis .label{font-size:.82rem!important;line-height:1.25!important}
      .main .dashboard-kpis{gap:12px!important;grid-template-columns:repeat(6,minmax(0,1fr))!important}
      .main .dashboard-kpis>.kpi-card{min-height:96px!important}
      .main .premium-donut-panel{min-height:390px!important;padding:22px!important}
      .main .premium-donut-row{min-height:300px!important;gap:28px!important}
      .main .premium-donut-chart{width:230px!important;height:230px!important;min-width:230px!important;min-height:230px!important;max-width:230px!important;max-height:230px!important;aspect-ratio:1/1!important;flex:0 0 230px!important;border-radius:50%!important}
      .main .premium-hole{inset:62px!important}
      .main .premium-hole strong{font-size:1.15rem!important}
      .main .premium-legend{min-width:150px!important;gap:10px!important}
      .main .premium-legend div{grid-template-columns:12px 1fr auto!important;gap:7px!important}

      /* Platform Owner: one clean brand row; remove the duplicate logo from the secondary header. */
      .po-top-header{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:18px!important;padding:12px 0!important}
      .po-top-header .po-brand-block{display:none!important}
      .po-top-header .po-user-meta{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:12px!important;flex-wrap:nowrap!important}
      .po-security-pill,.po-user-pill{white-space:nowrap!important}
      .po-page-header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:20px!important;flex-wrap:nowrap!important}
      .po-page-header>div:first-child{min-width:0!important;flex:1 1 auto!important}
      .po-page-header .po-header-status{flex:0 0 auto!important}
      .platform-owner-auth-shell .auth-brand{display:flex!important;flex-direction:row!important;align-items:center!important;gap:18px!important}
      .platform-owner-auth-shell .auth-brand-copy{min-width:0!important;display:grid!important;grid-template-columns:auto auto auto!important;align-items:baseline!important;column-gap:14px!important;row-gap:2px!important}
      .platform-owner-auth-shell .auth-brand-copy h1{grid-column:1/-1!important;margin:0!important}
      .platform-owner-auth-shell .auth-brand-copy p,.platform-owner-auth-shell .auth-brand-copy em{margin:0!important}

      /* Platform Owner final header: one logo, one horizontal brand row, one user/security row. */
      .platform-owner-auth-shell .po-top-header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:22px!important;padding:12px 28px!important;min-height:82px!important;height:auto!important}
      .platform-owner-auth-shell .po-brand-block{display:flex!important;align-items:center!important;gap:14px!important;min-width:0!important;flex:1 1 auto!important}
      .platform-owner-auth-shell .po-logo{width:76px!important;height:58px!important;flex:0 0 76px!important;background:#fff!important;border:1px solid #dbe6f2!important;border-radius:14px!important;padding:4px!important;box-shadow:0 4px 12px rgba(15,23,42,.06)!important}
      .platform-owner-auth-shell .po-brand-line span{font-size:24px!important;font-weight:850!important;color:#172b4d!important;line-height:1.1!important}
      .platform-owner-auth-shell .po-console-label{font-size:14px!important;font-weight:800!important;color:#315f96!important;margin-top:3px!important}
      .platform-owner-auth-shell .po-console-tagline{font-size:12px!important;font-weight:700!important;color:#0f8a5f!important;font-style:italic!important;margin-top:2px!important}
      .platform-owner-auth-shell .po-user-meta{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:12px!important;flex:0 0 auto!important}
      .platform-owner-auth-shell .subscription-new-plan h3{grid-column:1/-1!important;white-space:nowrap!important}
      .platform-owner-auth-shell .platform-subscription-history{margin:14px 0 0!important;padding:14px!important;background:#f8fbff!important;border:1px solid #dbe5ef!important;border-radius:12px!important}
      .platform-owner-auth-shell .platform-subscription-history .section-title-row{margin:0 0 10px!important;padding:0!important;background:transparent!important;border:0!important}
      .platform-owner-auth-shell button:disabled{opacity:.58!important;cursor:wait!important;pointer-events:none!important}
      @media(max-width:900px){
        .platform-owner-auth-shell .po-top-header{padding:10px 16px!important}
        .platform-owner-auth-shell .po-user-meta{gap:8px!important}
        .platform-owner-auth-shell .po-brand-line span{font-size:20px!important}
      }
      @media(max-width:600px){
        .platform-owner-auth-shell .po-top-header{align-items:flex-start!important}
        .platform-owner-auth-shell .po-brand-block{gap:9px!important}
        .platform-owner-auth-shell .po-logo{width:58px!important;height:46px!important;flex-basis:58px!important}
        .platform-owner-auth-shell .po-brand-line span{font-size:17px!important}
        .platform-owner-auth-shell .po-console-label{font-size:12px!important}
        .platform-owner-auth-shell .po-console-tagline{font-size:10px!important}
      }

      /* Product Owner plan builder — trial duration is part of the plan, not a hidden global default. */
      .subscription-new-plan{display:grid!important;grid-template-columns:1fr 1.15fr 1.8fr 1fr 1fr auto 120px 125px auto!important;gap:10px!important;align-items:end!important}
      .subscription-new-plan h3{grid-column:1/-1!important;margin:0 0 2px!important}
      .subscription-new-plan input,.subscription-new-plan select{width:100%!important;min-width:0!important;box-sizing:border-box!important}
      .subscription-new-plan .trial-plan-toggle{display:inline-flex!important;align-items:center!important;gap:7px!important;min-height:42px!important;white-space:nowrap!important;font-weight:800!important;color:#334e6f!important}
      .subscription-new-plan .trial-plan-toggle input{width:16px!important;height:16px!important;min-width:16px!important}
      .subscription-new-plan .trial-plan-help{grid-column:1/-1!important;color:#64748b!important;font-size:.78rem!important;margin-top:0!important}
      .subscription-new-plan input:disabled,.subscription-new-plan select:disabled{background:#f1f5f9!important;color:#94a3b8!important}
      @media(max-width:1250px){.main .dashboard-kpis{grid-template-columns:repeat(3,minmax(0,1fr))!important}.subscription-new-plan{grid-template-columns:repeat(4,minmax(0,1fr))!important}.subscription-new-plan h3,.subscription-new-plan .trial-plan-help{grid-column:1/-1!important}}
      @media(max-width:800px){.main{padding-left:12px!important;padding-right:12px!important}.main>.identity-header,.main>.header-divider{margin-left:-12px!important;margin-right:-12px!important}.main>.identity-header{padding-left:16px!important;padding-right:16px!important}.main .dashboard-kpis{grid-template-columns:1fr 1fr!important}.main .premium-donut-chart{width:210px!important;height:210px!important;min-width:210px!important;min-height:210px!important;max-width:210px!important;max-height:210px!important;flex-basis:210px!important}.subscription-new-plan{grid-template-columns:1fr 1fr!important}.subscription-new-plan h3,.subscription-new-plan .trial-plan-help{grid-column:1/-1!important}.subscription-new-plan button{grid-column:1/-1!important}}
      @media(max-width:520px){.main .dashboard-kpis{grid-template-columns:1fr!important}.subscription-new-plan{grid-template-columns:1fr!important}.subscription-new-plan h3,.subscription-new-plan .trial-plan-help,.subscription-new-plan button{grid-column:auto!important}.platform-owner-auth-shell .auth-brand-copy{display:block!important}.platform-owner-auth-shell .auth-brand-copy p,.platform-owner-auth-shell .auth-brand-copy em{display:block!important;margin-top:4px!important}}
      /* V6.5.13 CLEAN UI BUILD 4 — explicit assignment, utility editor, workspace and action consistency */
      .platform-owner-auth-shell .po-top-header .po-brand-block{display:none!important}
      .platform-owner-auth-shell .po-top-header{justify-content:flex-end!important}
      .platform-owner-auth-shell .platform-owner-console button{min-height:38px!important;border-radius:9px!important;font-weight:750!important;transition:transform .14s ease,box-shadow .14s ease,background .14s ease!important}
      .platform-owner-auth-shell .platform-owner-console button:active{transform:translateY(1px)!important}
      .platform-owner-auth-shell .platform-owner-console button:disabled{opacity:.58!important;cursor:not-allowed!important;transform:none!important}
      .shell .main{min-height:100vh!important}
      .sidebar{min-height:100vh!important}
      .sidebar .user-session button{min-height:38px!important;border-radius:9px!important;font-weight:750!important}
      .sidebar nav{min-height:calc(100vh - 190px)!important}
      .platform-owner-auth-shell .po-top-header{justify-content:flex-end!important;min-height:68px!important}
      .platform-owner-auth-shell .po-page-header{padding-top:18px!important;padding-bottom:16px!important}
      .platform-owner-auth-shell .subscription-plan-assignment{display:flex!important;align-items:center!important;gap:7px!important;min-width:245px!important}
      .platform-owner-auth-shell .subscription-plan-assignment select{flex:1 1 auto!important;min-width:145px!important}
      .platform-owner-auth-shell .assign-plan-button{min-width:72px!important;white-space:nowrap!important}
      .platform-owner-auth-shell .subscription-actions button{min-height:36px!important;padding:7px 11px!important}
      .sidebar{min-height:100vh!important;height:100vh!important;overflow-y:auto!important;overflow-x:hidden!important;scrollbar-width:thin!important}
      .sidebar nav{padding-top:8px!important;padding-bottom:20px!important}
      .sidebar nav button{min-height:48px!important;margin:4px 0!important;padding:11px 13px!important}
      .sidebar .user-session button.secondary{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;min-height:40px!important;border-radius:10px!important;background:#fff!important;color:#26364d!important;border:1px solid #cbd7e5!important;font-weight:800!important;box-shadow:0 3px 9px rgba(15,23,42,.12)!important}
      .sidebar .user-session button.secondary:hover{background:#eef5ff!important;border-color:#8fb2e8!important;transform:translateY(-1px)!important}
      .utility-category-editor{display:grid!important;grid-template-columns:minmax(220px,1fr) auto auto!important;gap:10px!important;align-items:center!important;padding:12px!important;background:#f8fbff!important;border:1px solid #dbe5ef!important;border-radius:12px!important}
      .utility-category-editor input{min-width:0!important}
      @media(max-width:700px){.platform-owner-auth-shell .subscription-plan-assignment{min-width:0!important;flex-direction:column!important;align-items:stretch!important}.platform-owner-auth-shell .subscription-plan-assignment select,.platform-owner-auth-shell .assign-plan-button{width:100%!important}.utility-category-editor{grid-template-columns:1fr!important}.sidebar nav button{min-height:44px!important}}
      .login-account-choice{margin-top:14px;padding:16px;border:1px solid #cbd8e8;border-radius:14px;background:#f8fbff}.login-account-choice h3{margin:0 0 5px;color:#173b69}.login-account-choice p{margin:0 0 12px;color:#64748b}.login-account-choice-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.login-account-choice-card{display:grid!important;gap:3px!important;text-align:left!important;padding:12px!important;border:1px solid #c8d5e5!important;border-radius:12px!important;background:#fff!important;color:#172b4d!important}.login-account-choice-card:hover{border-color:#2563eb!important;box-shadow:0 5px 14px rgba(37,99,235,.12)}.login-account-choice-card span{font-weight:800;color:#2563eb}.login-account-choice-card small{color:#64748b}.utility-contact-card .actions{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:7px!important;min-width:100px}.utility-call-badge{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:7px 12px;border-radius:999px;background:#e9f8ef;color:#166534!important;border:1px solid #9ed7b2;text-decoration:none;font-weight:800;font-size:.84rem;white-space:nowrap}.utility-call-badge:hover{background:#d9f2e2}.utility-contact-card .actions button{width:100%!important}.remember-login{display:flex!important;align-items:center!important;gap:8px!important}.remember-toggle{width:18px!important;height:18px!important;min-width:18px!important;max-width:18px!important;padding:0!important;transform:none!important;zoom:1!important}.remember-toggle-mark{font-size:12px!important;line-height:16px!important}@media(max-width:700px){.login-account-choice-list{grid-template-columns:1fr}}
      .professional-upload{display:flex!important;align-items:center!important;gap:14px!important;flex-wrap:wrap!important}.apartment-photo-preview-wrap{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #dbe5ef;border-radius:12px;background:#f8fbff}.apartment-photo-preview-wrap span{font-size:.72rem;color:#64748b;font-weight:700}.apartment-profile-photo{width:105px!important;height:124px!important;object-fit:cover!important;border-radius:10px!important;border:1px solid #d7e1eb!important;display:block!important;box-shadow:0 4px 12px rgba(15,23,42,.08)}.photo-action-button{min-height:36px!important}.print-report-header{display:none}.screen-only-financial{display:block}.print-apartment-brand,.print-app-brand{display:flex;align-items:center;gap:12px}.print-apartment-brand>div:last-child,.print-app-brand>div:last-child{display:flex;flex-direction:column;gap:2px}.print-apartment-logo{width:72px;height:58px;display:grid;place-items:center;overflow:hidden;border:1px solid #dbe5ef;border-radius:9px;background:#fff}.print-apartment-logo img{width:100%;height:100%;object-fit:cover}.print-app-brand img{width:62px;height:48px;object-fit:contain}.print-apartment-brand strong,.print-app-brand strong{font-size:14px;color:#1f3550}.print-apartment-brand span,.print-app-brand span,.print-app-brand em,.print-app-brand small{font-size:9px;color:#64748b}.print-app-brand small{font-weight:800;color:#315f96;margin-top:2px}
      .payment-table{min-width:1420px!important}.payment-table th:nth-child(10),.payment-table td:nth-child(10){min-width:92px!important;width:92px!important}.payment-table th:nth-child(11),.payment-table td:nth-child(11){min-width:112px!important;width:112px!important}.payment-table th:nth-child(10),.payment-table th:nth-child(11){white-space:nowrap!important}.expense-register-table th:nth-child(5),.expense-register-table td:nth-child(5){min-width:96px!important;width:96px!important;white-space:nowrap!important}.expense-register-table th:nth-child(9),.expense-register-table td:nth-child(9){min-width:92px!important;width:92px!important;white-space:nowrap!important}.admin-email-test-card{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px 18px;margin:14px 0 22px;border:1px solid #dbe5ef;border-radius:14px;background:linear-gradient(135deg,#f8fbff,#eef5ff)}.admin-email-test-card h2{margin:0 0 4px!important}.admin-email-test-card .subtitle{margin:0!important}.print-only-direct{display:none!important}.direct-print-header{display:flex;justify-content:space-between;gap:20px;padding:0 0 10px;border-bottom:1.5px solid #cbd5e1}.direct-print-header>div{display:flex;flex-direction:column;gap:2px}.direct-print-header>div:last-child{text-align:right}.direct-print-header strong{font-size:14px;color:#1f3550}.direct-print-header span,.direct-print-header small{font-size:9px;color:#64748b}.direct-print-header small{font-weight:800;color:#315f96}.direct-print-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin:0 0 10px}.direct-print-kpis>div{border:1px solid #cbd5e1;border-radius:6px;padding:7px;background:#f8fafc;min-width:0}.direct-print-kpis span{display:block;font-size:7pt;color:#64748b;margin-bottom:3px}.direct-print-kpis b{display:block;font-size:9pt;color:#243447}.direct-print-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.5pt}.direct-print-table th,.direct-print-table td{border:1px solid #cbd5e1;padding:4px 5px;line-height:1.2;word-break:break-word}.direct-print-table th{background:#eaf0f6;color:#263b55;font-weight:800}.direct-print-table tbody tr:nth-child(even){background:#f8fafc}.direct-print-table tfoot{background:#eef4fb;font-weight:800}.print-sheet-individual{page:apartcare-individual!important}.direct-print-individual-table{font-size:6.8pt}.direct-print-individual-table th,.direct-print-individual-table td{padding:3px 3.5px}.direct-print-individual-kpis{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:10px}.direct-print-water{margin:0 0 8px}.direct-print-water h2{margin:4px 0 5px}.direct-print-water-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.direct-print-water-grid>div{border:1px solid #cbd5e1;border-radius:6px;padding:6px;background:#f8fafc}.direct-print-water-grid span{display:block;font-size:7pt;color:#64748b;margin-bottom:3px}.direct-print-water-grid b{font-size:8.5pt}.print-only-direct h1{font-size:15pt;margin:9px 0 8px;color:#172b4d}.print-only-direct h2{font-size:11pt;margin:7px 0 5px;color:#173d6b}
      .print-only-report-sheet{display:none!important}
      @media print{
        @page{size:A4 portrait;margin:10mm}
        @page apartcare-individual{size:A4 landscape;margin:10mm}
        html,body{height:auto!important;min-height:0!important;overflow:visible!important}
        body.apartcare-print-water-only .shell .main>*,body.apartcare-print-yearly .shell .main>*,body.apartcare-print-individual .shell .main>*{box-sizing:border-box}
        body.apartcare-print-water-only .shell .main>style,body.apartcare-print-yearly .shell .main>style,body.apartcare-print-individual .shell .main>style{display:none!important}
        body.apartcare-print-yearly .shell .sidebar,body.apartcare-print-yearly .shell .identity-header,body.apartcare-print-yearly .shell .header-divider,body.apartcare-print-individual .shell .sidebar,body.apartcare-print-individual .shell .identity-header,body.apartcare-print-individual .shell .header-divider{display:none!important}
        body.apartcare-print-yearly .shell .main> :not(.print-only-direct),body.apartcare-print-individual .shell .main> :not(.print-only-direct){display:none!important}
        body.apartcare-print-yearly .shell .main .print-sheet-yearly,body.apartcare-print-individual .shell .main .print-sheet-individual{display:block!important;color:#172b4d!important;background:#fff!important;width:100%!important;min-height:0!important;height:auto!important;overflow:visible!important}
        body.apartcare-print-yearly .shell,body.apartcare-print-individual .shell{display:block!important;background:#fff!important;min-height:0!important}
        body.apartcare-print-yearly .shell .main,body.apartcare-print-individual .shell .main{display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;background:#fff!important;min-height:0!important;overflow:visible!important}
        body.apartcare-print-water-only{background:#fff!important}
        body.apartcare-print-water-only .shell{display:block!important;background:#fff!important;min-height:0!important}
        body.apartcare-print-water-only .shell .sidebar,
        body.apartcare-print-water-only .shell .identity-header,
        body.apartcare-print-water-only .shell .header-divider{display:none!important}
        body.apartcare-print-water-only .shell .main{display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;background:#fff!important;min-height:0!important}
        body.apartcare-print-water-only .shell .main> :not(.print-only-direct){display:none!important}
        body.apartcare-print-water-only .shell .main .print-sheet-all{display:block!important;color:#172b4d!important;background:#fff!important;width:100%!important;min-height:0!important;height:auto!important;overflow:visible!important}
        body.apartcare-print-water-only .shell .main .print-only-report-sheet{display:none!important}
        .print-only-report-sheet .print-sheet-header{display:flex!important;justify-content:space-between!important;align-items:flex-start!important;gap:20px!important;padding:0 0 10px!important;border-bottom:1.5px solid #cbd5e1!important}
        .print-only-report-sheet .print-apartment-brand,.print-only-report-sheet .print-app-brand{display:flex!important;align-items:center!important;gap:9px!important}
        .print-only-report-sheet .print-apartment-brand{max-width:56%!important}
        .print-only-report-sheet .print-app-brand{max-width:40%!important;margin-left:auto!important}
        .print-only-report-sheet .print-apartment-logo{width:52px!important;height:60px!important;display:grid!important;place-items:center!important;overflow:hidden!important;border:1px solid #dbe5ef!important;border-radius:6px!important;background:#fff!important;flex:0 0 52px!important}
        .print-only-report-sheet .print-apartment-logo img{width:100%!important;height:100%!important;object-fit:cover!important}
        .print-only-report-sheet .print-app-brand img{width:48px!important;height:38px!important;object-fit:contain!important}
        .print-only-report-sheet .print-apartment-brand strong,.print-only-report-sheet .print-app-brand strong{font-size:10pt!important;color:#1f3550!important}
        .print-only-report-sheet .print-apartment-brand span,.print-only-report-sheet .print-app-brand span,.print-only-report-sheet .print-app-brand em,.print-only-report-sheet .print-app-brand small{display:block!important;font-size:7pt!important;line-height:1.25!important;color:#64748b!important}
        .print-only-report-sheet .print-app-brand small{font-weight:800!important;color:#315f96!important}
        .print-only-report-sheet h1{font-size:15pt!important;margin:9px 0 8px!important;color:#172b4d!important}
        .print-sheet-kpis{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:6px!important;margin:0 0 9px!important}
        .print-sheet-kpis>div,.print-water-kpis>div{border:1px solid #cbd5e1!important;border-radius:6px!important;padding:6px!important;background:#f8fafc!important;min-width:0!important}
        .print-sheet-kpis span,.print-water-kpis span{display:block!important;font-size:6.5pt!important;color:#64748b!important;margin-bottom:3px!important}
        .print-sheet-kpis b,.print-water-kpis b{display:block!important;font-size:9pt!important;color:#243447!important}
        .print-sheet-water{margin:0 0 8px!important}
        .print-sheet-water h2{font-size:11pt!important;margin:4px 0 5px!important;color:#173d6b!important}
        .print-water-kpis{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important}
        .print-sheet-water p{font-size:6.5pt!important;color:#64748b!important;margin:4px 0 6px!important}
        .print-detail-table{width:100%!important;table-layout:fixed!important;border-collapse:collapse!important;font-size:7pt!important}
        .print-detail-table th,.print-detail-table td{border:1px solid #cbd5e1!important;padding:3.5px 4px!important;line-height:1.2!important;word-break:break-word!important;overflow-wrap:anywhere!important}
        .print-detail-table th{background:#eaf0f6!important;color:#263b55!important;font-weight:800!important}
        .print-detail-table tbody tr:nth-child(even){background:#f8fafc!important}
        .print-detail-table tfoot{background:#eef4fb!important;font-weight:800!important}
        .print-detail-table th:nth-child(1),.print-detail-table td:nth-child(1){width:7%}.print-detail-table th:nth-child(2),.print-detail-table td:nth-child(2){width:14%}.print-detail-table th:nth-child(3),.print-detail-table td:nth-child(3){width:12%}.print-detail-table th:nth-child(4),.print-detail-table td:nth-child(4){width:9%}.print-detail-table th:nth-child(5),.print-detail-table td:nth-child(5){width:8%}.print-detail-table th:nth-child(6),.print-detail-table td:nth-child(6){width:12%}.print-detail-table th:nth-child(7),.print-detail-table td:nth-child(7){width:13%}.print-detail-table th:nth-child(8),.print-detail-table td:nth-child(8){width:10%}.print-detail-table th:nth-child(9),.print-detail-table td:nth-child(9){width:10%}
        .table-scroll{overflow:visible!important;max-width:none!important}
        .direct-print-table{page-break-inside:auto!important}.direct-print-table tr{page-break-inside:avoid!important;page-break-after:auto!important}.direct-print-table thead{display:table-header-group!important}.direct-print-table tfoot{display:table-row-group!important}
      }
      
      `}
</style>
      <header className="identity-header">
        <section className="apartment-brand">
          {(settingsForm.apartment_photo_path||settingsForm.apartment_photo_data_url)?<img src={settingsForm.apartment_photo_data_url||`${API}${settingsForm.apartment_photo_path}`} alt="Apartment profile" className="identity-photo"/>:<div className="building-icon">🏢</div>}
          <div><h2>{settingsForm.apartment_name||'Apartment'}</h2>{accountId&&<p className="account-context">Account: <b>{accountDisplay(accountId,settingsForm.country,settingsForm.state)}</b></p>}<p>{settingsForm.address||'Apartment address not set'}</p><p>{[settingsForm.city,settingsForm.state,settingsForm.pin_code,settingsForm.country].filter(Boolean).join(', ')}</p></div>
        </section>
        <section className="app-brand">
          <div className="logo-mark"><img src="/apartcare-lite-logo.png" alt="ApartCare Lite"/></div>
          <div><h2>ApartCare Lite</h2><p>Your daily partner in property care.</p><em>Helping you run your building beautifully.</em><small className="company-brand">GKMA Solutions</small></div>
        </section>
      </header>
      <div className="header-divider"/>

      <div className="print-only-direct print-sheet-all">
        {allFlatsReport&&(()=>{const k=allFlatsReport.kpis||{};const collected=Number(k.total_collected??allFlatsReport.totals?.paid??0);const expenses=Number(k.total_expenses??0);const prev=Number(k.previous_month_closing??0);const diff=collected-expenses;const current=prev+diff;return <><div className="direct-print-header"><div><strong>{settingsForm.apartment_name||'Apartment'}</strong><span>{settingsForm.address||''}</span><span>{[settingsForm.city,settingsForm.state,settingsForm.pin_code,settingsForm.country].filter(Boolean).join(', ')}</span></div><div><strong>ApartCare Lite</strong><span>Your daily partner in property care.</span><small>GKMA Solutions</small></div></div><h1>{settingsForm.apartment_name||'Apartment'} — Maintenance - {reportMonth}</h1><div className="direct-print-kpis"><div><span>Previous Closing</span><b>{money(prev)}</b></div><div><span>Total Collected</span><b>{money(collected)}</b></div><div><span>Month Expenses</span><b>{money(expenses)}</b></div><div><span>Current Diff</span><b>{diff>=0?'+':''}{money(diff)}</b></div><div><span>Current Balance</span><b>{current>=0?'+':''}{money(current)}</b></div></div>{allFlatsReport.water_header&&<div className="direct-print-water"><h2>Water Summary</h2><div className="direct-print-water-grid"><div><span>{allFlatsReport.water_header.water_mode==='Meter'?'Total Water Consumption':'No. of Flats'}</span><b>{allFlatsReport.water_header.water_mode==='Meter'?`${Number(allFlatsReport.water_header.total_units||0).toFixed(2)} Units`:Number(allFlatsReport.water_header.flats_count||0)}</b></div><div><span>{allFlatsReport.water_header.water_mode==='Meter'?'Water Per Unit / Flat':'Water Per Flat'}</span><b>{money(allFlatsReport.water_header.water_rate||0)}</b></div><div><span>Total Water Cost</span><b>{money(allFlatsReport.water_header.total_water_cost||allFlatsReport.totals?.water||0)}</b></div></div></div>}<table className="direct-print-table"><thead><tr><th>Flat No</th><th>Name</th><th>Mobile</th><th>Mtce</th><th>CCA</th><th>Water Amount</th><th>Rounded Total</th><th>Paid</th><th>Balance</th></tr></thead><tbody>{allFlatsReport.rows.length===0?<tr><td colSpan={9}>No maintenance records found for {reportMonth}.</td></tr>:allFlatsReport.rows.map((r:any)=><tr key={r.id}><td>{r.flat_no}</td><td>{r.display_name||r.resident_name||r.owner_name}</td><td>{r.mobile_no||'—'}</td><td>{money(r.maintenance)}</td><td>{money(r.cca)}</td><td>{money(r.water_amount)}</td><td><b>{money(r.rounded_total)}</b></td><td>{money(r.paid)}</td><td>{money(r.pending)}</td></tr>)}</tbody><tfoot><tr><th>TOTAL</th><th></th><th></th><th>{money(allFlatsReport.totals.maintenance)}</th><th>{money(allFlatsReport.totals.cca)}</th><th>{money(allFlatsReport.totals.water)}</th><th>{money(allFlatsReport.totals.total)}</th><th>{money(allFlatsReport.totals.paid)}</th><th>{money(allFlatsReport.totals.pending)}</th></tr></tfoot></table></>})()}
      </div>

      <div className="print-only-direct print-sheet-yearly">
        {yearlyCollectionReport&&(()=>{const rows=(yearlyCollectionReport.rows||[]).map((r:any)=>({...r,collected:Number(r.collected||0),expenses:Number(r.expenses||0),difference:Number.isFinite(Number(r.difference))?Number(r.difference):Number(r.collected||0)-Number(r.expenses||0),opening_balance:Number(r.opening_balance||0),closing_balance:Number(r.closing_balance||0)})).sort((a:any,b:any)=>String(a.month_key).localeCompare(String(b.month_key)));const opening=Number(yearlyCollectionReport.opening_balance??rows.find((r:any)=>!r.is_before_go_live)?.opening_balance??0);const collected=rows.reduce((a:number,r:any)=>a+r.collected,0);const expenses=rows.reduce((a:number,r:any)=>a+r.expenses,0);const net=collected-expenses;const closing=rows.length?rows[rows.length-1].closing_balance:opening+net;return <><div className="direct-print-header"><div><strong>{settingsForm.apartment_name||'Apartment'}</strong><span>{settingsForm.address||''}</span><span>{[settingsForm.city,settingsForm.state,settingsForm.pin_code,settingsForm.country].filter(Boolean).join(', ')}</span></div><div><strong>ApartCare Lite</strong><span>Your daily partner in property care.</span><small>GKMA Solutions</small></div></div><h1>{settingsForm.apartment_name||'Apartment'} — Collection vs Expenses - {reportYear}</h1><div className="direct-print-kpis"><div><span>Previous Month / Year Opening</span><b>{money(opening)}</b></div><div><span>Total Collected</span><b>{money(collected)}</b></div><div><span>Total Expenses</span><b>{money(expenses)}</b></div><div><span>Current Year Difference</span><b>{net>=0?'+':''}{money(net)}</b></div><div><span>Current Closing Balance</span><b>{closing>=0?'+':''}{money(closing)}</b></div></div><h2>Monthly Financial Movement</h2><table className="direct-print-table"><thead><tr><th>Month</th><th>Opening Balance</th><th>Collection</th><th>Expenses</th><th>Net Change</th><th>Closing Balance</th></tr></thead><tbody>{rows.map((r:any)=><tr key={r.month_key}><td>{r.month_key}</td><td>{r.opening_balance>=0?'+':''}{money(r.opening_balance)}</td><td>{money(r.collected)}</td><td>{money(r.expenses)}</td><td>{r.difference>=0?'+':''}{money(r.difference)}</td><td>{r.closing_balance>=0?'+':''}{money(r.closing_balance)}</td></tr>)}</tbody><tfoot><tr><th>Year Total / Closing</th><th>{money(opening)}</th><th>{money(collected)}</th><th>{money(expenses)}</th><th>{net>=0?'+':''}{money(net)}</th><th>{closing>=0?'+':''}{money(closing)}</th></tr></tfoot></table></>})()}
      </div>

      <div className="print-only-direct print-sheet-individual">
        {flatStatement&&individualStatementRows.length>0&&<><div className="direct-print-header"><div><strong>{settingsForm.apartment_name||'Apartment'}</strong><span>{settingsForm.address||''}</span><span>{[settingsForm.city,settingsForm.state,settingsForm.pin_code,settingsForm.country].filter(Boolean).join(', ')}</span></div><div><strong>ApartCare Lite</strong><span>Your daily partner in property care.</span><small>GKMA Solutions</small></div></div><h1>{settingsForm.apartment_name||'Apartment'} — Flat {flatStatement.flat_no||reportFlat} Statement - {individualReportPeriod==='Monthly'?individualReportMonth:individualReportYear}</h1><p><b>Owner:</b> {flatStatement.owner_name||'—'} &nbsp; <b>Resident:</b> {flatStatement.resident_name||'—'}</p><table className="direct-print-table direct-print-individual-table"><thead><tr><th>Month</th><th>Maintenance</th><th>CCA</th><th>Diesel</th><th>Water</th><th>Total Due</th><th>Previous Balance</th><th>Paid</th><th>Current Pending</th><th>Balance</th><th>Status</th></tr></thead><tbody>{individualStatementRows.map((r:any)=><tr key={r.month_key}><td>{r.month_key}</td><td>{money(r.maintenance)}</td><td>{money(r.cca)}</td><td>{money(r.diesel)}</td><td>{money(r.water)}</td><td><b>{money(r.total_due)}</b></td><td>{money(r.previous_balance)}</td><td>{money(r.paid)}</td><td>{money(r.current_pending)}</td><td><b>{money(r.balance)}</b></td><td>{r.status}</td></tr>)}</tbody><tfoot><tr><th>TOTAL</th><th>{money(individualStatementTotals.maintenance)}</th><th>{money(individualStatementTotals.cca)}</th><th>{money(individualStatementTotals.diesel)}</th><th>{money(individualStatementTotals.water)}</th><th>{money(individualStatementTotals.total_due)}</th><th>{money(individualStatementTotals.previous_balance)}</th><th>{money(individualStatementTotals.paid)}</th><th>{money(individualStatementTotals.current_pending)}</th><th>{money(individualStatementTotals.balance)}</th><th></th></tr></tfoot></table><div className="direct-print-kpis direct-print-individual-kpis"><div><span>{individualReportPeriod==='Yearly'?'Year Total Due':'Month Total Due'}</span><b>{money(individualStatementTotals.total_due)}</b></div><div><span>{individualReportPeriod==='Yearly'?'Year Total Paid':'Month Total Paid'}</span><b>{money(individualStatementTotals.paid)}</b></div><div><span>{individualReportPeriod==='Yearly'?'Current Pending in Year':'Current Pending in Month'}</span><b>{money(individualStatementTotals.current_pending)}</b></div></div></> }
      </div>

      {tab==='Dashboard' && <>
        <h1>Dashboard</h1>
        <section className="period-panel">
          <div className="period-title">Dashboard Period</div>
          <div className="period-options">
            <label className={period==='Monthly'?'radio selected':'radio'}><input type="radio" checked={period==='Monthly'} onChange={()=>setPeriod('Monthly')}/>Monthly</label>
            <label className={period==='Yearly'?'radio selected':'radio'}><input type="radio" checked={period==='Yearly'} onChange={()=>setPeriod('Yearly')}/>Yearly</label>
          </div>
          {period==='Monthly'?<div className="selector-row"><label>Month</label><input type="month" lang="en-GB" min={tenantDataStartMonth} value={month} onChange={e=>setMonth(e.target.value)}/></div>:
          <div className="selector-row"><label>Year</label><select value={year} onChange={e=>setYear(e.target.value)}><option>2024</option><option>2025</option><option>2026</option><option>2027</option></select></div>}
        </section>

        <div className="dashboard-for">Dashboard for: {period==='Monthly'?month:year}</div>

        <section className="kpis premium-kpis dashboard-kpis">
          {dashboardCards.map(([label,value],index)=>
            <div className={`card kpi-card kpi-${index+1}`} key={label}>
              <div className="label">{label}</div>
              <div className="value">{value}</div>
              <div className="kpi-glow"></div>
            </div>
          )}
        </section>

        <p className="formula">Current Balance = Total Collected − Total Expenses &nbsp;|&nbsp; Total Available Amt = Previous Month Closing + Current Balance</p>

        <section className="donut-grid two-donuts">
          <MultiDonutChart
            title="Financial Summary"
            centerTop={money((dashboardKpis?.total_collected||0) - (dashboardKpis?.total_expenses||0))}
            centerBottom="Current Balance"
            segments={(() => { const collected=Number(dashboardKpis?.total_collected||0); const expenses=Number(dashboardKpis?.total_expenses||0); const balance=collected-expenses; return [
              {label:'Collected',value:collected,color:'#4f79a8'},
              {label:'Expenses',value:expenses,color:'#e2a124'},
              ...(balance<0?[{label:'Current Balance Deficit',value:Math.abs(balance),color:'#c0392b'}]:[{label:'Current Balance',value:balance,color:'#2e8b57'}])
            ]; })()}
          />
          <MultiDonutChart
            title="Expenses by Category"
            centerTop={money(dashboardKpis?.total_expenses||0)}
            centerBottom="Total Expenses"
            segments={(() => {
              const entries=Object.entries(expenseSummary?.by_category||{}).filter(([,v])=>Number(v)>0);
              const colors=['#2563a6','#7fb3d5','#d99b28','#7c5ab5','#4f9b6f','#d46a6a','#4c8f8c','#9a7b4f'];
              return entries.length?entries.map(([label,value],i)=>({label,value:Number(value)||0,color:colors[i%colors.length]})):[{label:'No Expenses',value:1,color:'#cbd5e1'}];
            })()}
          />
        </section>

      </>}

      {tab==='Residents' && <>
        <div className="page-title-row"><div><h1>Residents</h1><p className="subtitle">Manage apartment residents, flat details and owner/tenant information.</p></div><button className="secondary" onClick={loadResidents}>{residentLoading?'Loading...':'Refresh'}</button></div>
        <section className="form-panel">
          <h2>{editingResidentId?'Edit Resident':'Add Resident'}</h2>
          <form onSubmit={saveResident} className="resident-form">
            <label>Flat No. <span className="hint">Alpha-numeric allowed</span><input required type="text" inputMode="text" pattern="[A-Za-z0-9\-\/ ]+" title="Use letters, numbers, spaces or - / only" placeholder="A-101, 2B, G-01" value={residentForm.flat_no} onChange={e=>setResidentForm({...residentForm,flat_no:e.target.value})}/></label>
            <label>Owner Name<input required value={residentForm.owner_name} onChange={e=>setResidentForm({...residentForm,owner_name:e.target.value})}/></label>
            <label>Resident Name<input required value={residentForm.resident_name} onChange={e=>setResidentForm({...residentForm,resident_name:e.target.value})}/></label>
            <label>Resident Type<select value={residentForm.resident_type} onChange={e=>setResidentForm({...residentForm,resident_type:e.target.value as 'Owner'|'Tenant'})}><option>Owner</option><option>Tenant</option></select></label>
            <label>Mobile No.<input required value={residentForm.mobile_no} onChange={e=>setResidentForm({...residentForm,mobile_no:e.target.value})}/></label>
            <label>Email<input type="email" value={residentForm.email} onChange={e=>setResidentForm({...residentForm,email:e.target.value})}/></label>
            <label>Status<select value={residentForm.status} onChange={e=>setResidentForm({...residentForm,status:e.target.value as 'Active'|'Inactive'})}><option>Active</option><option>Inactive</option></select></label>
            <label className="full">Remarks<textarea value={residentForm.remarks} onChange={e=>setResidentForm({...residentForm,remarks:e.target.value})}/></label>
            <div className="form-actions"><button type="submit">{editingResidentId?'Update Resident':'Add Resident'}</button>{editingResidentId&&<button type="button" className="secondary" onClick={()=>{setEditingResidentId(null);setResidentForm(emptyResident)}}>Cancel</button>}</div>
          </form>
          {residentMessage&&<div className="message">{residentMessage}</div>}
        </section>
        <section className="table-panel">
          <div className="table-toolbar"><h2>Resident List</h2><input placeholder="Search flat, owner, resident or mobile..." value={query} onChange={e=>setQuery(e.target.value)}/></div>
          {!resLoaded&&<div className="empty-state">Open the Residents menu to load data.</div>}
          {resLoaded&&<div className="table-wrap"><table><thead><tr><th>Flat</th><th>Owner Name</th><th>Resident Name</th><th>Version</th><th>Type</th><th>Mobile</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{filteredResidents.length===0?<tr><td colSpan={9} className="empty-state">No residents found.</td></tr>:filteredResidents.map(r=><tr key={r.id}><td>{r.flat_no}</td><td>{r.owner_name}</td><td>{r.resident_name}</td><td><b>V{r.version||1}</b></td><td>{r.resident_type}</td><td>{r.mobile_no}</td><td>{r.email||'—'}</td><td><span className={r.status==='Active'?'badge active-badge':'badge'}>{r.status}</span></td><td className="actions"><button onClick={()=>editResident(r)}>Edit</button><button type="button" className="secondary" onClick={()=>loadResidentHistory(r.id)}>History</button></td></tr>)}</tbody></table></div>}
        </section>
      </>}


      {residentHistoryId && <section className="panel"><div className="page-title-row"><div><h2>Resident Record History</h2><p className="subtitle">Each edit creates a new version. Historical maintenance keeps the version that existed for that month; current/future maintenance uses the latest version.</p></div><button type="button" className="secondary" onClick={()=>{setResidentHistoryId(null);setResidentHistory([])}}>Close History</button></div><div className="table-scroll business-grid"><table><thead><tr><th>Version</th><th>Effective From</th><th>Effective To</th><th>Owner</th><th>Resident</th><th>Type</th><th>Status</th><th>Change</th></tr></thead><tbody>{residentHistory.map((h:any)=><tr key={h.id}><td><b>V{h.version}</b></td><td>{formatDate(h.effective_from)}</td><td>{h.effective_to?formatDate(h.effective_to):'Current'}</td><td>{h.owner_name}</td><td>{h.resident_name}</td><td>{h.resident_type}</td><td>{h.status}</td><td>{h.change_reason||'—'}</td></tr>)}</tbody></table></div></section>}

      {tab==='Payments' && <>
        <div className="page-title-row"><div><h1>Payments</h1><p className="subtitle">Mark each flat as Paid or Pending. You can correct a previously saved payment; Pending Amount is always Amount Due − Paid Amount.</p></div><button className="secondary" onClick={recalculatePayments}>{paymentLoading?'Refreshing...':'Recalculate & Refresh'}</button></div>

        <section className="form-panel payment-period">
          <div className="month-heading"><h2>Payment Month</h2><div className="month-selector"><label>Month</label><input type="month" lang="en-GB" min={tenantDataStartMonth} value={paymentMonth} onChange={e=>setPaymentMonth(e.target.value)} /></div></div>
          <div className="page-title-row" style={{marginTop:12}}>
            <p className="help-text" style={{margin:0}}>Amount Due = Previous Pending Balance + Current Month Rounded Total. Pending Amount = Amount Due − Paid Amount.</p>
            <div className="form-actions">
              {currentUser.role==='Admin' && (!paymentMonthLocked ? <button type="button" className="secondary" onClick={lockPaymentMonth} disabled={paymentLoading}>🔒 Lock {paymentMonth}</button> : <button type="button" className="secondary" onClick={unlockPaymentMonth} disabled={paymentLoading}>🔓 Unlock {paymentMonth}</button>)}
              <button type="button" className="secondary" onClick={loadPaymentLock}>View Lock History</button>
            </div>
          </div>
          {paymentMonthLocked && <div className="message" style={{marginTop:12}}>🔒 <b>{paymentMonth} is GLOBALLY LOCKED.</b> Monthly Maintenance, Payments and Expenses are frozen. Reports remain accessible. Only Admin can unlock with mandatory justification. Locked history is retained for audit.</div>}
          {paymentLockHistory.length>0 && <div className="table-wrap" style={{marginTop:12}}><table><thead><tr><th>Action</th><th>Date/Time</th><th>User</th><th>Justification</th></tr></thead><tbody>{paymentLockHistory.map((h:any)=><tr key={h.id}><td><b>{h.action}</b></td><td>{formatDateTime(h.at)}</td><td>{h.by_username||'—'}</td><td>{h.justification||'—'}</td></tr>)}</tbody></table></div>}
        </section>

        {paymentSummary&&<section className="summary-grid">
          <div className="card"><div className="label">Previous Balance</div><div className="value">{money(paymentSummary.previous_balance)}</div></div>
          <div className="card"><div className="label">Total Collected</div><div className="value">{money(paymentSummary.total_collected)}</div></div>
          <div className="card"><div className="label">Total Pending</div><div className="value">{money(paymentSummary.total_pending)}</div></div>
        </section>}

        {paymentMessage&&<div className="message">{paymentMessage}</div>}
        <section className="table-panel">
          <h2>Flat-wise Payment Collection</h2>
          {payments.length===0?<div className="empty-state">No payment records available for {paymentMonth}. Generate Monthly Maintenance first.</div>:
          <div className="table-wrap"><table className="payment-table"><thead><tr>
            <th><input disabled={isViewer(currentUser)||paymentMonthLocked} type="checkbox" checked={payments.length>0&&selectedPaymentFlats.length===payments.length} onChange={e=>setSelectedPaymentFlats(e.target.checked?payments.map(x=>x.flat_no):[])}/> Select All</th><th>Flat</th><th>Owner</th><th>Resident</th><th>Prev Balance</th><th>Current Bill</th><th>Amount Due</th><th>Paid Amount</th><th>Pending</th><th>Status</th><th>Mode</th><th>Reference</th><th>Date</th><th>Save</th>
          </tr></thead><tbody>{payments.map(p=>{
            const f=paymentForms[p.flat_no]||{
              paid_amount:p.paid_amount||0,
              payment_mode:p.payment_mode||'Cash',
              reference:p.reference||'',
              payment_date:p.payment_date||new Date().toISOString().slice(0,10),
              remarks:p.remarks||'',
              status:p.pending_balance<=0.0001?'Paid' as 'Paid':'Pending' as 'Pending'
            };
            return <tr key={p.flat_no}>
              <td><input disabled={isViewer(currentUser)||paymentMonthLocked} type="checkbox" checked={selectedPaymentFlats.includes(p.flat_no)} onChange={e=>setSelectedPaymentFlats(xs=>e.target.checked?[...xs,p.flat_no]:xs.filter(x=>x!==p.flat_no))}/></td><td>{p.flat_no}</td><td>{p.owner_name}</td><td>{p.resident_name}</td>
              <td>{money(p.previous_balance)}</td><td>{money(p.current_month_total)}</td><td><strong>{money(p.amount_due)}</strong></td>
              <td><input type="number" min="0" max={p.amount_due} value={f.paid_amount===0?'':f.paid_amount} onChange={e=>updatePaymentForm(p.flat_no,'paid_amount',e.target.value)} disabled={isViewer(currentUser)||paymentMonthLocked}/></td>
              <td>{money(Math.max(0,Number(p.amount_due)-Number(f.paid_amount||0)))}</td>
              <td><select value={f.status} onChange={e=>updatePaymentStatus(p,e.target.value as 'Paid'|'Pending')} disabled={isViewer(currentUser)||paymentMonthLocked}><option value="Paid">Paid</option><option value="Pending">Pending</option></select></td>
              <td><select value={f.payment_mode} onChange={e=>updatePaymentForm(p.flat_no,'payment_mode',e.target.value)} disabled={isViewer(currentUser)||paymentMonthLocked}><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option><option>Other</option></select></td>
              <td><input value={f.reference} placeholder="Ref / Txn ID" onChange={e=>updatePaymentForm(p.flat_no,'reference',e.target.value)} disabled={isViewer(currentUser)||paymentMonthLocked}/></td>
              <td><input type="date" lang="en-GB" value={f.payment_date} onChange={e=>updatePaymentForm(p.flat_no,'payment_date',e.target.value)} disabled={isViewer(currentUser)||paymentMonthLocked}/></td>
              <td><button type="button" onClick={()=>recordPayment(p)} disabled={isViewer(currentUser)||paymentLoading||paymentMonthLocked}>Save</button></td>
            </tr>;
          })}</tbody></table><div className="form-actions table-actions"><button type="button" onClick={saveSelectedPayments} disabled={isViewer(currentUser)||paymentLoading||paymentMonthLocked||selectedPaymentFlats.length===0}>{paymentLoading?'Saving...':`Save Selected (${selectedPaymentFlats.length})`}</button></div></div>}
        </section>
      </>}


      {tab==='Expenses' && <>
        <div className="page-title-row"><div><h1>Expenses & Fund Management</h1><p className="subtitle">Record apartment operating expenses and review monthly or yearly financial views.</p></div><button className="secondary" onClick={()=>{loadExpenses(true);loadDashboardKpis();}}>{expenseLoading?'Refreshing...':'Recalculate & Refresh'}</button></div>
        <div className="period-options expense-period-options"><label className="radio"><input type="radio" checked={expensePeriod==='Monthly'} onChange={()=>setExpensePeriod('Monthly')}/> Monthly</label><label className="radio"><input type="radio" checked={expensePeriod==='Yearly'} onChange={()=>setExpensePeriod('Yearly')}/> Yearly</label></div>
        {expensePeriod==='Monthly' && <>
          <section className="panel"><div className="section-title-row"><h2>Expense Month</h2><label className="inline-month standard-month-field"><span>Month</span><input type="month" lang="en-GB" min={tenantDataStartMonth} value={expenseMonth} onChange={e=>setExpenseMonth(e.target.value)}/></label></div><div className="expense-kpis"><div className="card"><div className="label">Total Expenses</div><div className="value">{money(expenseSummary?.total_expenses||0)}</div></div><div className="card"><div className="label">Expense Entries</div><div className="value">{expenseSummary?.expense_count||0}</div></div><div className="card"><div className="label">Current Month Collected</div><div className="value">{money(expensePaymentSummary?.total_collected||0)}</div></div><div className="card"><div className="label">Current Balance</div><div className="value">{money((expensePaymentSummary?.total_collected||0)-(expenseSummary?.total_expenses||0))}</div></div></div><p className="formula">Current Balance = Total Collected − Total Expenses &nbsp;|&nbsp; Total Available Amount = Previous Month Closing + Current Balance</p></section>
          <section className="panel"><div className="section-title-row"><div><h2>{editingExpenseId?'Edit Expense':'Add Expense'}</h2><p className="subtitle">Manual expenses and version-controlled Watchman Salary are managed here.</p></div></div><form className="expense-form professional-expense-form" onSubmit={saveExpense}>
            <label>Date<input type="date" lang="en-GB" required disabled={isViewer(currentUser)||expenseMonthLocked} value={expenseForm.expense_date} onChange={e=>setExpenseForm({...expenseForm,expense_date:e.target.value})}/></label><label>Category<select disabled={isViewer(currentUser)||expenseMonthLocked} value={expenseForm.category} onChange={e=>setExpenseForm({...expenseForm,category:e.target.value as ExpenseCategory})}>{(['Watchman Salary','Electricity','Water','Diesel','Repairs & Maintenance','Cleaning','Security','CCA','Other'] as ExpenseCategory[]).map(x=><option key={x}>{x}</option>)}</select></label><label>Amount<input disabled={isViewer(currentUser)||expenseMonthLocked} type="number" min="0" step="0.01" required value={expenseForm.amount===0?'':expenseForm.amount} onChange={e=>setExpenseForm({...expenseForm,amount:e.target.value===''?0:Number(e.target.value)})}/></label><label>Payment Mode<select disabled={isViewer(currentUser)||expenseMonthLocked} value={expenseForm.payment_mode} onChange={e=>setExpenseForm({...expenseForm,payment_mode:e.target.value})}>{['Cash','UPI','Bank Transfer','Cheque','Other'].map(x=><option key={x}>{x}</option>)}</select></label>
            <label className="wide">Description<input required disabled={isViewer(currentUser)||expenseMonthLocked} placeholder="Expense description" value={expenseForm.description} onChange={e=>setExpenseForm({...expenseForm,description:e.target.value})}/></label><label>Reference<input disabled={isViewer(currentUser)||expenseMonthLocked} placeholder="Bill / Txn ID" value={expenseForm.reference} onChange={e=>setExpenseForm({...expenseForm,reference:e.target.value})}/></label><label className="wide">Remarks<input disabled={isViewer(currentUser)||expenseMonthLocked} placeholder="Optional remarks" value={expenseForm.remarks} onChange={e=>setExpenseForm({...expenseForm,remarks:e.target.value})}/></label>
            <label className="wide attachment-field">Upload Bill / Receipt (Optional)<input type="file" accept="image/*,.pdf" disabled={isViewer(currentUser)||expenseMonthLocked} onChange={e=>{const file=e.target.files?.[0];if(!file){return;}const reader=new FileReader();reader.onload=()=>setExpenseForm({...expenseForm,receipt_name:file.name,receipt_data_url:String(reader.result||'')});reader.readAsDataURL(file);}}/>{expenseForm.receipt_name&&<div className="attachment-selected"><small>📎 {expenseForm.receipt_name}</small><button type="button" className="attachment-remove secondary" disabled={isViewer(currentUser)||expenseMonthLocked} onClick={()=>setExpenseForm({...expenseForm,receipt_name:'',receipt_data_url:''})}>🗑 Remove Attachment</button></div>}</label>
            <div className="form-actions"><button type="submit" disabled={isViewer(currentUser)||expenseLoading||expenseMonthLocked}>{expenseLoading?'Saving...':editingExpenseId?'Update Expense':'Save Expense'}</button>{editingExpenseId&&<button type="button" className="secondary" onClick={resetExpenseForm}>Cancel</button>}</div></form>{expenseMonthLocked&&<div className="message">🔒 {expenseMonth} is globally locked. Expenses are frozen until an Admin unlocks the month. Reports remain available.</div>}{expenseMessage&&<div className="message">{expenseMessage}</div>}</section>
          <section className="panel"><h2>Expense Register</h2>{expenses.length===0?<p className="empty">No expenses recorded for {expenseMonth}.</p>:<div className="table-scroll business-grid"><table className="expense-register-table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Bill / Receipt</th><th>Source</th><th>Status</th><th>Actions</th></tr></thead><tbody>{expenses.map(x=><tr key={x.id}><td>{formatDate(x.expense_date)}</td><td>{x.category}</td><td>{x.description}</td><td><b>{money(x.amount)}</b></td><td>{x.payment_mode}</td><td>{x.reference||'—'}</td><td>{x.bill_path?<a href={`${API}${x.bill_path}`} target="_blank" rel="noreferrer">View</a>:'—'}</td><td>{x.source}</td><td>{x.deleted?'🗑️ Deleted':x.locked?'🔒 Locked':'Active'}</td><td className="actions"><button onClick={()=>editExpense(x)} disabled={isViewer(currentUser)||x.locked||x.deleted||expenseMonthLocked}>✏️ Edit</button>{currentUser.role==='Admin'&&<><button className="secondary" onClick={()=>toggleExpenseLock(x.id,!x.locked)} disabled={expenseMonthLocked||x.deleted}>{x.locked?'🔓 Unlock':'🔒 Lock'}</button><button className="danger" onClick={()=>deleteExpense(x.id)} disabled={expenseMonthLocked||x.deleted||expenseLoading}>{x.deleted?'🗑 Deleted':'🗑 Soft Delete'}</button></>}{currentUser.role!=='Admin'&&<span className="lock-note">{x.deleted?'🗑️ Deleted':x.locked?'🔒 Locked':'Admin controls lock/delete'}</span>}</td></tr>)}</tbody></table></div>}</section>
          <section className="panel"><h2>🔐 Expense Lock History</h2><p className="help-text">Lock/unlock history is retained for audit. Locked expenses remain visible here and in the register and continue to be included in financial calculations. Only soft-deleted expenses are excluded from totals and KPIs.</p>{expenseLockHistory.length===0?<p className="empty">No lock/unlock history for {expenseMonth}.</p>:<div className="table-scroll business-grid"><table><thead><tr><th>At</th><th>Category</th><th>Description</th><th>Amount</th><th>Action</th><th>Justification</th><th>By</th></tr></thead><tbody>{expenseLockHistory.map((h:any)=><tr key={h.id}><td>{formatDateTime(h.at)}</td><td>{h.category}</td><td>{h.description}</td><td>{money(Number(h.amount||0))}</td><td><b>{h.action}</b></td><td>{h.justification}</td><td>{h.by_username}</td></tr>)}</tbody></table></div>}</section>
          <section className="panel"><h2>🗑 Expense Deletion History</h2><p className="help-text">Soft-deleted expenses are retained for audit and are excluded from all financial calculations.</p>{expenseHistory.length===0?<p className="empty">No deleted expenses for {expenseMonth}.</p>:<div className="table-scroll business-grid"><table><thead><tr><th>Deleted At</th><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Justification</th><th>Deleted By</th></tr></thead><tbody>{expenseHistory.map((x:any)=><tr key={x.id}><td>{formatDateTime(x.deleted_at)}</td><td>{formatDate(x.expense_date)}</td><td>{x.category}</td><td>{x.description}</td><td>{money(Number(x.amount||0))}</td><td>{x.justification||x.deleted_reason||'—'}</td><td>{(x as any).deleted_by_username||'Admin'}</td></tr>)}</tbody></table></div>}</section>
          <section className="panel"><h2>Category Summary</h2>{Object.keys(expenseSummary?.by_category||{}).length===0?<p className="empty">No category totals yet.</p>:<div className="category-summary">{Object.entries(expenseSummary?.by_category||{}).map(([category,amount])=><div className="mini-card" key={category}><span>{category}</span><b>{money(Number(amount))}</b></div>)}</div>}</section>
        </>}
        {expensePeriod==='Yearly' && <section className="panel"><div className="page-title-row"><div><h2>Yearly Expense Report</h2><p className="subtitle">Year-wise expense summary and category-wise expenses.</p></div><label>Year<select value={expenseYear} onChange={e=>{setExpenseYear(e.target.value);setSelectedExpenseCategory('');setYearlyExpenseDetails([]);}}><option>2024</option><option>2025</option><option>2026</option><option>2027</option></select></label></div>{yearlyExpense&&<><div className="summary-grid"><div className="card"><div className="label">Year Total Expenses</div><div className="value">{money(yearlyExpense.year_total_expenses)}</div></div><div className="card"><div className="label">Active Categories</div><div className="value">{yearlyExpense.active_categories}</div></div><div className="card"><div className="label">Months with Expenses</div><div className="value">{yearlyExpense.months_with_expenses}</div></div></div><h3>{settingsForm.apartment_name || 'Apartment'} — Yearly Expenses - {expenseYear}</h3><h3>Monthly Expense Summary</h3><div className="table-scroll business-grid"><table><thead><tr><th>Month</th><th>Month Key</th><th>Total Expenses</th><th>Status</th></tr></thead><tbody>{yearlyExpense.monthly.map((r:any)=><tr key={r.month_key}><td>{new Date(`${r.month_key}-01T00:00:00`).toLocaleString('en-IN',{month:'short'})}</td><td>{formatMonthKey(r.month_key)}</td><td>{money(r.total_expenses)}</td><td>{r.status}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Total</th><th>{money(yearlyExpense.year_total_expenses)}</th><th>—</th></tr></tfoot></table></div><h3>Category-wise Expenses</h3><div className="category-chips">{(yearlyExpense.category_totals||[]).map((c:any)=><button type="button" key={c.category} className={selectedExpenseCategory===c.category?'active':''} onClick={()=>{setSelectedExpenseCategory(c.category);loadYearlyExpenseDetails(expenseYear,c.category);}}>{c.category} — {money(c.amount)}</button>)}</div>{selectedExpenseCategory&&<div className="table-scroll business-grid category-detail"><h3>{selectedExpenseCategory} — Expense Details</h3><table><thead><tr><th>Date</th><th>Month</th><th>Description</th><th>Payment Mode</th><th>Amount</th></tr></thead><tbody>{yearlyExpenseDetails.length===0?<tr><td colSpan={5} className="empty">No expenses found for this category.</td></tr>:yearlyExpenseDetails.map((e:any)=><tr key={e.id}><td>{formatDate(e.expense_date)}</td><td>{e.month_key}</td><td>{e.description}</td><td>{e.payment_mode}</td><td>{money(e.amount)}</td></tr>)}</tbody><tfoot>{yearlyExpenseDetails.length>0&&<tr><th colSpan={4}>Total</th><th>{money(yearlyExpenseDetails.reduce((a:number,e:any)=>a+Number(e.amount||0),0))}</th></tr>}</tfoot></table></div>}<h3>Monthly × Category Matrix</h3><div className="table-scroll business-grid"><table><thead><tr><th>Category</th>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m=><th key={m}>{m}</th>)}<th>Total</th></tr></thead><tbody>{yearlyExpense.matrix.length===0?<tr><td colSpan={14} className="empty">No expenses recorded for {expenseYear}.</td></tr>:yearlyExpense.matrix.map((r:any)=><tr key={r.category}><td>{r.category}</td>{r.months.map((v:number,i:number)=><td key={i}>{money(v)}</td>)}<td><b>{money(r.total)}</b></td></tr>)}</tbody></table></div></>}</section>}
      </>}

      {tab==='Utilities' && <>
        <div className="page-title-row"><div><h1>Utilities</h1><p className="subtitle">Shared apartment service contacts. Admin and Viewer can add and edit contacts and categories. Delete/deactivate actions remain Admin-only; Watchman remains managed from Settings.</p></div><button type="button" className="secondary" onClick={loadUtilityContacts}>↻ Refresh</button></div>
        {utilityMessage&&<div className="message">{utilityMessage}</div>}
        <section className="panel utility-panel utility-category-compact"><div className="section-title-row"><div><h2>Utility Categories</h2><p className="help-text">Use <b>Add Category</b> only when a new service category is required. Category history remains maintained by the system.</p></div><button type="button" className="secondary" disabled={!canEditUtilities(currentUser)} onClick={()=>{setEditingUtilityCategoryId(null);setUtilityCategoryName('');setUtilityCategoryEditorOpen(true);setUtilityMessage('Enter a new Utility Category below.')}}>＋ Add Category</button></div>
          {(utilityCategoryEditorOpen||editingUtilityCategoryId)&&<div className="utility-category-editor"><input value={utilityCategoryName} onChange={e=>setUtilityCategoryName(e.target.value)} placeholder="Category name, e.g. Painter"/><button type="button" disabled={!canEditUtilities(currentUser)} onClick={saveUtilityCategory}>{editingUtilityCategoryId?'💾 Update Category':'＋ Save Category'}</button><button type="button" className="secondary" onClick={()=>{setEditingUtilityCategoryId(null);setUtilityCategoryName('');setUtilityCategoryEditorOpen(false);}}>Cancel</button></div>}
        </section>
        <section className="panel utility-panel"><div className="section-title-row"><div><h2>{editingUtilityId?'Edit Utility Contact':'Add Utility Contact'}</h2><p className="help-text">Keep important service numbers available to residents and management.</p></div></div>
          <form onSubmit={saveUtilityContact} className="utility-form">
            <label>Category<select value={utilityForm.category} onChange={e=>setUtilityForm({...utilityForm,category:e.target.value})}>{utilityCategories.filter(c=>c.active).map(c=><option key={c.id}>{c.name}</option>)}</select></label>
            <label>Mobile No.<input required value={utilityForm.mobile_no} onChange={e=>setUtilityForm({...utilityForm,mobile_no:e.target.value})} placeholder="Mobile number"/></label>
            <label>Name<input required value={utilityForm.name} onChange={e=>setUtilityForm({...utilityForm,name:e.target.value})} placeholder="Contact name"/></label>
            <label>Remarks<input value={utilityForm.remarks} onChange={e=>setUtilityForm({...utilityForm,remarks:e.target.value})} placeholder="Optional remarks"/></label>
            <div className="form-actions">{editingUtilityId&&<button type="button" className="secondary" onClick={()=>{setEditingUtilityId(null);setUtilityForm({category:utilityCategories.find(x=>x.active)?.name||'Plumber',name:'',mobile_no:'',remarks:''});setUtilityMessage('Edit cancelled.');}}>Cancel</button>}<button type="submit" disabled={!canEditUtilities(currentUser)}>{editingUtilityId?'💾 Update Contact':'＋ Add Utility Contact'}</button></div>
          </form>
        </section>
        <section className="panel utility-panel"><div className="section-title-row"><div><h2>Service Contacts</h2><p className="help-text">Multiple contacts are supported for every service category. Watchman is frozen from Settings.</p></div></div>
          {utilityWatchman&&<div className="utility-watchman-card"><div className="utility-icon">👮</div><div><b>Watchman</b><span>{utilityWatchman.name}</span><small>{utilityWatchman.mobile_no} • 🔒 From Settings</small></div></div>}
          {utilityContacts.length===0?<div className="empty-state">No utility contacts added yet. Add your first service contact above.</div>:<div className="utility-contact-grid">{utilityContacts.map(x=><article className="utility-contact-card" key={x.id}><div className="utility-card-icon">{x.category==='Plumber'?'🔧':x.category==='Electrician'?'⚡':x.category==='Carpenter'?'🪚':x.category==='Police'?'👮':x.category==='Power FOC'?'💡':'🧰'}</div><div className="utility-card-body"><div className="utility-category">{x.category}</div><h3>{x.name}</h3><div className="utility-mobile">📞 {x.mobile_no}</div>{x.remarks&&<p>{x.remarks}</p>}</div><div className="actions"><a className="utility-call-badge" href={`tel:${String(x.mobile_no||'').replace(/[^0-9+]/g,'')}`} aria-label={`Call ${x.name} at ${x.mobile_no}`}>📞 Call</a><button type="button" className="secondary" disabled={!canEditUtilities(currentUser)} onClick={()=>editUtilityContact(x)}>✏️ Edit</button><button type="button" className="danger" onClick={()=>deleteUtilityContact(x.id)} disabled={!isAdmin(currentUser)}>🗑 Delete</button></div></article>)}</div>}
        </section>
      </>}

      {tab==='Reports' && <>
        <div className="page-title-row"><div><h1>Reports</h1><p className="subtitle">Monthly, yearly and individual-flat reports in one standard ApartCare report workspace.</p></div></div>
        <div className="report-tabs">
          {(['All Flats Monthly Report','Yearly Collection vs Expenses','Individual Flat Statement'] as const).map(t=><button key={t} className={reportTab===t?'active':''} onClick={()=>{setReportTab(t); if(t==='All Flats Monthly Report') loadAllFlatsReport(reportMonth); if(t==='Yearly Collection vs Expenses') loadYearlyCollectionReport(reportYear); if(t==='Individual Flat Statement') loadReportFlats();}}>{t}</button>)}
        </div>
        {reportTab==='All Flats Monthly Report' && <section className="panel report-workspace">
          <div className="report-controls"><label>Month<input type="month" lang="en-GB" min={tenantDataStartMonth} value={reportMonth} onChange={e=>{const m=e.target.value;setReportMonth(m);loadAllFlatsReport(m);}}/></label><button onClick={()=>loadAllFlatsReport(reportMonth)}>Load Report</button></div>
          {allFlatsReport&&(()=>{const k=allFlatsReport.kpis||{};const collected=Number(k.total_collected??allFlatsReport.totals?.paid??0);const expenses=Number(k.total_expenses??0);const prev=Number(k.previous_month_closing??0);const diff=collected-expenses;const current=prev+diff;const h=allFlatsReport.water_header;return <div className="print-only-report-sheet">
            <div className="print-sheet-header"><div className="print-apartment-brand"><div className="print-apartment-logo">{(settingsForm.apartment_photo_path||settingsForm.apartment_photo_data_url)?<img src={settingsForm.apartment_photo_data_url||`${API}${settingsForm.apartment_photo_path}`} alt="Apartment logo"/>:<span>🏢</span>}</div><div><strong>{settingsForm.apartment_name||'Apartment'}</strong><span>{settingsForm.address||''}</span><span>{[settingsForm.city,settingsForm.state,settingsForm.pin_code,settingsForm.country].filter(Boolean).join(', ')}</span></div></div><div className="print-app-brand"><img src="/apartcare-lite-logo.png" alt="ApartCare Lite"/><div><strong>ApartCare Lite</strong><span>Your daily partner in property care.</span><em>Helping you run your building beautifully.</em><small>GKMA Solutions</small></div></div></div>
            <h1>{settingsForm.apartment_name||'Apartment'} — Maintenance - {reportMonth}</h1>
            <div className="print-sheet-kpis"><div><span>Previous Closing</span><b>{money(prev)}</b></div><div><span>Total Collected</span><b>{money(collected)}</b></div><div><span>Month Expenses</span><b>{money(expenses)}</b></div><div><span>Current Diff</span><b>{diff>=0?'+':''}{money(diff)}</b></div><div><span>Current Balance</span><b>{current>=0?'+':''}{money(current)}</b></div></div>
            {h&&<section className="print-sheet-water"><h2>💧 Water Summary</h2><div className="print-water-kpis"><div><span>{h.water_mode==='Meter'?'Total Water Consumption':'No. of Flats'}</span><b>{h.water_mode==='Meter'?`${Number(h.total_units||0).toFixed(2)} Units`:Number(h.flats_count||0)}</b></div><div><span>{h.water_mode==='Meter'?'Water Per Unit / Flat':'Water Per Flat'}</span><b>{money(h.water_rate||0)}</b></div><div><span>Total Water Cost</span><b>{money(h.total_water_cost||allFlatsReport.totals?.water||0)}</b></div></div><p>{h.water_mode==='Meter'?`Water Calculation: ${Number(h.total_water_cost||0).toFixed(2)} ÷ ${Number(h.total_units||0).toFixed(2)} Units = ${money(h.water_rate||0)} per Unit`:`No Meter Calculation: Total Water Cost ÷ ${Number(h.flats_count||0)} Flats = ${money(h.water_rate||0)} per Flat`}</p></section>}
            <table className="print-detail-table"><thead><tr><th>Flat No</th><th>Name</th><th>Mobile</th><th>Mtce</th><th>CCA</th><th>Water Amount</th><th>Rounded Total</th><th>Paid</th><th>Balance</th></tr></thead><tbody>{allFlatsReport.rows.length===0?<tr><td colSpan={9}>No maintenance records found for {reportMonth}.</td></tr>:allFlatsReport.rows.map((r:any)=><tr key={r.id}><td>{r.flat_no}</td><td>{r.display_name||r.resident_name||r.owner_name}</td><td>{r.mobile_no||'—'}</td><td>{money(r.maintenance)}</td><td>{money(r.cca)}</td><td>{money(r.water_amount)}</td><td><b>{money(r.rounded_total)}</b></td><td>{money(r.paid)}</td><td>{money(r.pending)}</td></tr>)}</tbody><tfoot><tr><th>TOTAL</th><th></th><th></th><th>{money(allFlatsReport.totals.maintenance)}</th><th>{money(allFlatsReport.totals.cca)}</th><th>{money(allFlatsReport.totals.water)}</th><th>{money(allFlatsReport.totals.total)}</th><th>{money(allFlatsReport.totals.paid)}</th><th>{money(allFlatsReport.totals.pending)}</th></tr></tfoot></table>
          </div>})()}
          <div className="print-water-report print-report-header"><div className="print-apartment-brand"><div className="print-apartment-logo">{(settingsForm.apartment_photo_path||settingsForm.apartment_photo_data_url)?<img src={settingsForm.apartment_photo_data_url||`${API}${settingsForm.apartment_photo_path}`} alt="Apartment logo"/>:<span>🏢</span>}</div><div><strong>{settingsForm.apartment_name||'Apartment'}</strong><span>{settingsForm.address||''}</span><span>{[settingsForm.city,settingsForm.state,settingsForm.pin_code,settingsForm.country].filter(Boolean).join(', ')}</span></div></div><div className="print-app-brand"><img src="/apartcare-lite-logo.png" alt="ApartCare Lite"/><div><strong>ApartCare Lite</strong><span>Your daily partner in property care.</span><em>Helping you run your building beautifully.</em><small>GKMA Solutions</small></div></div></div><h2 className="screen-report-title">{settingsForm.apartment_name || 'Apartment'} — Maintenance - {reportMonth}</h2>{allFlatsReport&&<ReportActions kind="all"/>}
          {!allFlatsReport?<p className="empty">Select a month and load the report.</p>:<>
            {(()=>{const k=allFlatsReport.kpis||{};const collected=Number(k.total_collected??allFlatsReport.totals?.paid??0);const expenses=Number(k.total_expenses??0);const prev=Number(k.previous_month_closing??0);const diff=collected-expenses;const current=prev+diff;return <><div className="screen-only-financial"><h2 className="report-section-title">💰 Selected Month Financial Position</h2><div className="report-kpis selected-month-kpis"><div className="report-kpi open"><span>Previous Month Closing Balance</span><b>{money(prev)}</b></div><div className="report-kpi collected"><span>Total Collected</span><b>{money(collected)}</b></div><div className="report-kpi expenses"><span>Month Expenses</span><b>{money(expenses)}</b></div><div className={`report-kpi diff ${diff>=0?'positive':'negative'}`}><span>Current Month Diff</span><b>{diff>=0?'+':''}{money(diff)}</b></div><div className={`report-kpi ${current>=0?'positive':'negative'}`}><span>Current Month Balance</span><b>{current>=0?'+':''}{money(current)}</b></div></div></div></>})()}
            {allFlatsReport.water_header&&(()=>{const h=allFlatsReport.water_header;const meter=h.water_mode==='Meter';return <section className="water-summary report-water-summary print-water-report"><h2>💧 Water Summary</h2><div className="summary-grid water-summary-grid"><div className="card"><div className="label">{meter?'Total Water Consumption':'No. of Flats'}</div><div className="value">{meter?`${Number(h.total_units||0).toFixed(2)} Units`:Number(h.flats_count||0)}</div></div><div className="card"><div className="label">{meter?'Water Per Unit / Flat':'Water Per Flat'}</div><div className="value">{money(h.water_rate||0)}</div></div><div className="card"><div className="label">Total Water Cost</div><div className="value">{money(h.total_water_cost||allFlatsReport.totals?.water||0)}</div></div></div><p className="help-text">{meter?`Water Calculation: ${Number(h.total_water_cost||0).toFixed(2)} ÷ ${Number(h.total_units||0).toFixed(2)} Units = ${money(h.water_rate||0)} per Unit`:`No Meter Calculation: Total Water Cost ÷ ${Number(h.flats_count||0)} Flats = ${money(h.water_rate||0)} per Flat`}</p><p className="help-text">Each Flat Water Amount is calculated according to the selected Water Mode. Payment, Paid and Balance values are read from the Payments module for the same month.</p></section>})()}
            <div className="table-scroll business-grid print-water-report"><table><thead><tr><th>Flat No</th><th>Name</th><th>Mobile</th><th>Mtce</th><th>CCA</th><th>Water Amount</th><th>Rounded Total</th><th>Paid</th><th>Balance</th></tr></thead><tbody>{allFlatsReport.rows.length===0?<tr><td colSpan={9} className="empty">No maintenance records found for {reportMonth}.</td></tr>:allFlatsReport.rows.map((r:any)=><tr key={r.id}><td>{r.flat_no}</td><td>{r.display_name||r.resident_name||r.owner_name}</td><td>{r.mobile_no||'—'}</td><td>{money(r.maintenance)}</td><td>{money(r.cca)}</td><td>{money(r.water_amount)}</td><td><b>{money(r.rounded_total)}</b></td><td>{money(r.paid)}</td><td>{money(r.pending)}</td></tr>)}</tbody><tfoot><tr><th>TOTAL</th><th></th><th></th><th>{money(allFlatsReport.totals.maintenance)}</th><th>{money(allFlatsReport.totals.cca)}</th><th>{money(allFlatsReport.totals.water)}</th><th>{money(allFlatsReport.totals.total)}</th><th>{money(allFlatsReport.totals.paid)}</th><th>{money(allFlatsReport.totals.pending)}</th></tr></tfoot></table></div>
          </>}
        </section>}
        {reportTab==='Yearly Collection vs Expenses' && <section className="panel report-workspace">
          <div className="report-controls"><label>Year<select value={reportYear} onChange={e=>setReportYear(e.target.value)}><option>2024</option><option>2025</option><option>2026</option><option>2027</option></select></label><button onClick={async()=>{await loadOpeningBalance();await loadYearlyCollectionReport(reportYear);}}>📊 Generate Yearly Report</button></div>
          {!yearlyCollectionReport?<p className="empty">Select a year and generate the financial report.</p>:<>
            {(()=>{
              // V6.4.14: Dashboard/Reports must not have competing balance formulas.
              // The backend is the single source of truth for monthly opening/closing balances.
              const rows=(yearlyCollectionReport.rows||[]).map((r:any)=>({...r,
                collected:Number(r.collected||0), expenses:Number(r.expenses||0),
                difference:Number.isFinite(Number(r.difference))?Number(r.difference):Number(r.collected||0)-Number(r.expenses||0),
                opening_balance:Number(r.opening_balance||0), closing_balance:Number(r.closing_balance||0)
              })).sort((a:any,b:any)=>String(a.month_key).localeCompare(String(b.month_key)));
              const explicitOpening=Number(yearlyCollectionReport.opening_balance ?? rows.find((r:any)=>!r.is_before_go_live)?.opening_balance ?? 0);
              const totalCollected=rows.reduce((a:number,r:any)=>a+r.collected,0);
              const totalExpenses=rows.reduce((a:number,r:any)=>a+r.expenses,0);
              const net=totalCollected-totalExpenses;
              const closing=rows.length?rows[rows.length-1].closing_balance:explicitOpening+net;
              return <>
                <div className="report-hero"><h2>{settingsForm.apartment_name || 'Apartment'} — Collection vs Expenses - {reportYear}</h2><p>Executive financial position, monthly movement and visual analysis.</p></div>
                <div className="report-kpis"><div className="report-kpi open"><span>Previous Month / Year Opening</span><b>{money(explicitOpening)}</b></div><div className="report-kpi collected"><span>Total Collected</span><b>{money(totalCollected)}</b></div><div className="report-kpi expenses"><span>Total Expenses</span><b>{money(totalExpenses)}</b></div><div className={`report-kpi diff ${net>=0?'positive':'negative'}`}><span>Current Year Difference</span><b>{net>=0?'+':''}{money(net)}</b></div><div className="report-kpi closing"><span>Current Closing Balance</span><b>{closing>=0?'+':''}{money(closing)}</b></div></div>
                <ReportActions kind="yearly"/>
                <div className="report-analytics report-analytics-single"><MonthlyBarChart rows={rows}/></div>
                <h3>Monthly Financial Movement</h3><div className="table-scroll business-grid report-financial-table"><table><thead><tr><th>Month</th><th>Opening Balance</th><th>Collection</th><th>Expenses</th><th>Net Change</th><th>Closing Balance</th></tr></thead><tbody>{rows.map((r:any)=><tr key={r.month_key}><td>{r.month_key}</td><td>{r.opening_balance>=0?'+':''}{money(r.opening_balance)}</td><td>{money(r.collected)}</td><td>{money(r.expenses)}</td><td className={r.difference>=0?'positive':'negative'}><b>{r.difference>=0?'+':''}{money(r.difference)}</b></td><td>{r.closing_balance>=0?'+':''}{money(r.closing_balance)}</td></tr>)}</tbody><tfoot><tr><th>Year Total / Closing</th><th>{money(explicitOpening)}</th><th>{money(totalCollected)}</th><th>{money(totalExpenses)}</th><th className={net>=0?'positive':'negative'}>{net>=0?'+':''}{money(net)}</th><th>{closing>=0?'+':''}{money(closing)}</th></tr></tfoot></table></div>
              </>
            })()}
          </>}
        </section>}
        {reportTab==='Individual Flat Statement' && <>
          <section className="panel"><h2>Individual Flat Statement</h2><div className="report-controls"><label>Flat Number<select value={reportFlat} onChange={async e=>{const flat=e.target.value;setReportFlat(flat);setReportMessage('');await Promise.all([loadFlatStatement(flat),loadIndividualMaintenance(flat)]);}}><option value="">Select Flat</option>{reportFlats.map(flt=><option key={flt}>{flt}</option>)}</select></label><button onClick={async()=>{setReportMessage('');await Promise.all([loadFlatStatement(reportFlat),loadIndividualMaintenance(reportFlat)]);}}>Load Report</button></div><div className="period-options"><label className="radio"><input type="radio" checked={individualReportPeriod==='Monthly'} onChange={()=>setIndividualReportPeriod('Monthly')}/> Monthly</label><label className="radio"><input type="radio" checked={individualReportPeriod==='Yearly'} onChange={()=>setIndividualReportPeriod('Yearly')}/> Yearly</label>{individualReportPeriod==='Monthly'?<label>Month<input type="month" lang="en-GB" min={tenantDataStartMonth} value={individualReportMonth} onChange={e=>setIndividualReportMonth(e.target.value)}/></label>:<label>Year<select value={individualReportYear} onChange={e=>setIndividualReportYear(e.target.value)}><option>2024</option><option>2025</option><option>2026</option><option>2027</option></select></label>}</div>
            {reportMessage&&<div className="message">{reportMessage}</div>}
            {!flatStatement?<p className="empty">Select a Flat and load the report.</p>:<div className="business-grid"><h3>{settingsForm.apartment_name || 'Apartment'} — {flatStatement.flat_no || reportFlat} Statement - {individualReportPeriod==='Monthly'?individualReportMonth:individualReportYear}</h3><p><b>Owner:</b> {flatStatement.owner_name||'—'} &nbsp; <b>Resident:</b> {flatStatement.resident_name||'—'}</p><h3>Occupancy History</h3><div className="history-list">{Array.isArray(flatStatement.resident_history) && flatStatement.resident_history.length>0 ? flatStatement.resident_history.map((h:any,i:number)=><div key={i}>{formatDate(h.effective_from)} — {h.effective_to?formatDate(h.effective_to):'Current'}: <b>{h.resident_name}</b> ({h.resident_type})</div>) : <p className="empty">No occupancy history found for this flat.</p>}</div></div>}
          </section>
          <section className="panel individual-statement-panel">
            <div className="page-title-row"><div><h2>Individual Flat Statement</h2><p className="subtitle">Complete monthly history for Flat {reportFlat || flatStatement?.flat_no || '—'} — {individualReportPeriod==='Monthly'?individualReportMonth:individualReportYear}. Balances include carry-forward from prior months.</p></div></div>
            {flatStatement&&individualStatementRows.length>0&&<ReportActions kind="individual"/>}
            {individualStatementRows.length===0?<p className="empty">No maintenance or payment history found for the selected period.</p>:<>
              <div className="table-scroll business-grid individual-history-table"><table><thead><tr><th>Month</th><th>Maintenance</th><th>CCA</th><th>Diesel</th><th>Water</th><th>Total Due</th><th>Previous Balance</th><th>Paid</th><th>Current Pending</th><th>Balance</th><th>Status</th></tr></thead><tbody>{individualStatementRows.map((r:any)=><tr key={r.month_key}><td>{r.month_key}</td><td>{money(r.maintenance)}</td><td>{money(r.cca)}</td><td>{money(r.diesel)}</td><td>{money(r.water)}</td><td><b>{money(r.total_due)}</b></td><td>{money(r.previous_balance)}</td><td>{money(r.paid)}</td><td>{money(r.current_pending)}</td><td><b>{money(r.balance)}</b></td><td><span className={String(r.status).toLowerCase()==='paid'?'status-paid':'status-pending'}>{r.status}</span></td></tr>)}</tbody><tfoot><tr><th>TOTAL</th><th>{money(individualStatementTotals.maintenance)}</th><th>{money(individualStatementTotals.cca)}</th><th>{money(individualStatementTotals.diesel)}</th><th>{money(individualStatementTotals.water)}</th><th>{money(individualStatementTotals.total_due)}</th><th>{money(individualStatementTotals.previous_balance)}</th><th>{money(individualStatementTotals.paid)}</th><th>{money(individualStatementTotals.current_pending)}</th><th>{money(individualStatementTotals.balance)}</th><th></th></tr></tfoot></table></div>
              <div className="kpi-grid individual-history-kpis"><div className="kpi-card accent-blue"><span>{individualReportPeriod==='Yearly'?'Year Total Due':'Month Total Due'}</span><strong>{money(individualStatementTotals.total_due)}</strong></div><div className="kpi-card accent-green"><span>{individualReportPeriod==='Yearly'?'Year Total Paid':'Month Total Paid'}</span><strong>{money(individualStatementTotals.paid)}</strong></div><div className="kpi-card accent-amber"><span>{individualReportPeriod==='Yearly'?'Current Pending in Year':'Current Pending in Month'}</span><strong>{money(individualStatementTotals.current_pending)}</strong></div></div>
            </>}
          </section>
        </>}
      </>}

      {tab==='Subscription & Billing' && <section className="panel tenant-subscription-panel">
        <div className="page-title-row"><div><h1>Subscription & Billing</h1><p className="subtitle">Your ApartCare service subscription is separate from your apartment's resident maintenance payments.</p></div></div>
        {tenantSubscriptionMessage&&<div className="message">{tenantSubscriptionMessage}</div>}
        {tenantSubscription?.summary&&<>
          <div className="subscription-hero-card"><div><span className="eyebrow">CURRENT SERVICE</span><h2>{tenantSubscription.summary.subscription_type==='TRIAL'?'Free Trial':tenantSubscription.summary.subscription_type==='COMPLIMENTARY'?'Complimentary Access':tenantSubscription.summary.plan?.name||'Subscription'}</h2><p>{tenantSubscription.summary.status==='TRIAL'?`Trial active — ${tenantSubscription.summary.days_remaining??0} days remaining.`:tenantSubscription.summary.status==='GRACE'?`Grace period active — ${tenantSubscription.summary.days_remaining??0} days remaining.`:tenantSubscription.summary.status==='ACTIVE'?'Your ApartCare subscription is active.':'Subscription action is required to continue full access.'}</p></div><span className={`subscription-status status-${String(tenantSubscription.summary.status).toLowerCase()}`}>{tenantSubscription.summary.status}</span></div>
          <div className="subscription-detail-grid"><div><span>Account</span><b>{accountId}</b></div><div><span>Payment Status</span><b>{tenantSubscription.summary.payment_status||'NOT_REQUIRED'}</b></div><div><span>Trial End</span><b>{tenantSubscription.summary.trial_end_date?formatDate(tenantSubscription.summary.trial_end_date):'—'}</b></div><div><span>Grace End</span><b>{tenantSubscription.summary.grace_end_date?formatDate(tenantSubscription.summary.grace_end_date):'—'}</b></div></div>
          {tenantSubscription.summary.plan&&<div className="tenant-plan-card"><div><h3>{tenantSubscription.summary.plan.name}</h3><p>{tenantSubscription.summary.plan.description}</p></div><div><b>₹{Number(tenantSubscription.summary.plan.monthly_price||0).toLocaleString('en-IN')}</b><small>/ month</small></div></div>}
          {(tenantSubscription.summary.status==='TRIAL'||tenantSubscription.summary.status==='GRACE'||tenantSubscription.summary.status==='PAST_DUE'||tenantSubscription.summary.status==='RESTRICTED')&&<div className="form-actions"><button type="button" onClick={startSubscriptionCheckout}>💳 Continue to Subscription</button><button type="button" className="secondary" onClick={()=>loadTenantSubscription(authToken)}>↻ Refresh Status</button></div>}
        </>}
      </section>}

      {tab==='Administration' && <section className="panel"><div className="page-title-row"><div><h1>Administration</h1><p className="subtitle">Manage Admin, Viewer, Caretaker and Supervisor access for this property. Caretaker access is limited to Monthly Maintenance, Payments and Expenses. Platform Super Admin is reserved for the Product Owner and is not available inside an apartment account.</p></div></div>{adminMessage&&<div className="message">{adminMessage}</div>}<section className="admin-email-test-card"><div><h2>Mail Testing</h2><p className="subtitle">Send a test message to the logged-in Administrator's registered email address. Configure the ApartCare SMTP App Password in the backend environment first.</p></div><button type="button" className="secondary" onClick={sendTestEmail} disabled={emailTestLoading}>{emailTestLoading?'Sending…':'📧 Send Test Email'}</button></section><h2>Session Timeout by Role</h2><p className="subtitle">If enabled, an idle user is automatically logged out after the configured number of minutes. Unchecking a role freezes its minutes input and disables automatic timeout for that role.</p><div className="table-scroll business-grid"><table><thead><tr><th>Role</th><th>Enable Session Timeout</th><th>Idle Timeout (Minutes)</th></tr></thead><tbody>{([['Admin','admin'],['Viewer','viewer']] as const).map(([label,key])=>{const rule=sessionTimeouts[key];return <tr key={key}><td><b>{label}</b></td><td><label className="checkbox-inline"><input type="checkbox" checked={rule.enabled} onChange={e=>setSessionTimeouts({...sessionTimeouts,[key]:{...rule,enabled:e.target.checked}})}/> Enable</label></td><td><input type="number" min={1} max={1440} disabled={!rule.enabled} value={rule.minutes===0?'':rule.minutes} onChange={e=>setSessionTimeouts({...sessionTimeouts,[key]:{...rule,minutes:Math.max(1,Math.min(1440,Number(e.target.value)||1))}})}/></td></tr>})}</tbody></table></div><div className="form-actions"><button type="button" onClick={saveSessionTimeouts}>Save Session Timeout Settings</button></div><h2>Create Property User</h2><form className="resident-form" onSubmit={saveAdminUser}><label>Full Name<input required value={adminForm.full_name} onChange={e=>setAdminForm({...adminForm,full_name:e.target.value})}/></label><label>User ID<input required pattern="[A-Za-z0-9_.-]+" value={adminForm.username} onChange={e=>setAdminForm({...adminForm,username:e.target.value})}/></label><label>Email Address<input required type="email" value={adminForm.email} onChange={e=>setAdminForm({...adminForm,email:e.target.value})}/></label><label>Mobile Number<input required inputMode="tel" value={adminForm.mobile_no} onChange={e=>setAdminForm({...adminForm,mobile_no:e.target.value})}/></label><label>Role<select value={adminForm.role} onChange={e=>setAdminForm({...adminForm,role:e.target.value as any})}><option>Viewer</option><option>Caretaker</option><option>Supervisor</option></select></label><label>Password<div className="password-field"><input required minLength={8} type={showAdminPassword?'text':'password'} value={adminForm.password} onChange={e=>setAdminForm({...adminForm,password:e.target.value})}/><button type="button" className="password-toggle" onClick={()=>setShowAdminPassword(!showAdminPassword)}>{showAdminPassword?'🙈':'👁️'}</button></div></label><div className="form-actions"><button type="submit">Create User</button></div></form><h2>User Management</h2><div className="table-scroll business-grid"><table><thead><tr><th>User ID</th><th>Name</th><th>Role</th><th>Active</th><th>Locked</th><th>Reset Password</th></tr></thead><tbody>{adminUsers.map(u=><tr key={u.id}><td>{u.username}</td><td>{u.full_name}</td><td>{u.role}</td><td><button type="button" className="secondary" onClick={()=>updateAdminUser(u.id,{active:!u.active})}>{u.active?'Deactivate':'Activate'}</button></td><td><button type="button" className="secondary" onClick={()=>openJustificationDialog({title:u.locked?'Unlock Property User':'Lock Property User',description:u.locked?'Unlocking permits the selected user to sign in again. The justification is retained in Administration History.':'Locking prevents the selected user from signing in. The justification is retained in Administration History.',action:'admin-user',targetId:u.id,locked:!u.locked,minLength:3})}>{u.locked?'Unlock':'Lock'}</button></td><td><button type="button" className="secondary" onClick={()=>resetAdminPassword(u.id)}>Reset Password</button></td></tr>)}</tbody></table></div><h2>Login & Administration History</h2><div className="history-toolbar"><label>View User History<select value={adminHistoryUser} onChange={e=>{setAdminHistoryUser(e.target.value);loadAdmin(e.target.value)}}><option value="all">All Users</option>{adminUsers.map(u=><option key={u.id} value={u.username}>{u.username} — {u.role}</option>)}</select></label><div className="form-actions"><button type="button" className="secondary" onClick={downloadAdminHistory}>⬇ Download Selected History</button></div></div><div className="table-scroll business-grid"><table><thead><tr><th>Date / Time</th><th>User ID</th><th>Event</th><th>Status</th><th>Reason</th></tr></thead><tbody>{loginHistory.length===0?<tr><td colSpan={5} className="empty">No login or administration events recorded yet.</td></tr>:loginHistory.map(h=><tr key={h.id}><td>{formatDateTime(h.at)}</td><td>{h.username}</td><td>{h.event}</td><td>{h.status}</td><td>{h.reason||'—'}</td></tr>)}</tbody></table></div></section>}

      {tab==='Settings' && <>
        <div className="page-title-row"><div><h1>Settings</h1><p className="subtitle">Operational defaults used when generating a new month, aligned with ApartCare.</p></div></div>
        <section className="form-panel">
          <h2>Default Monthly Charges</h2>
          <p className="help-text">These values are copied into a new month. Changing Settings does not alter already generated maintenance records.</p>
          <form onSubmit={saveSettings} className="resident-form">
            <div className="apartment-photo-settings professional-upload"><div className="upload-widget-icon">🖼️</div><div className="upload-widget-copy"><b>Apartment Profile Photo</b><small>JPG, PNG or WEBP • optimized automatically</small></div>{(settingsForm.apartment_photo_path||settingsForm.apartment_photo_data_url)?<><div className="apartment-photo-preview-wrap"><img src={settingsForm.apartment_photo_data_url||`${API}${settingsForm.apartment_photo_path}`} alt="Apartment profile" className="apartment-profile-photo"/><span>Profile photo</span></div><button type="button" className="secondary photo-action-button" onClick={removeApartmentPhoto} disabled={settingsLoading}>Remove</button></>:null}<label className="upload-button">{settingsForm.apartment_photo_path||settingsForm.apartment_photo_data_url?'Update Photo':'Choose Photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)uploadApartmentPhoto(file)}}/></label></div>
            <label>Apartment Name
              <input value={settingsForm.apartment_name} onChange={e=>setSettingsForm({...settingsForm,apartment_name:e.target.value})}/>
            </label>
            <label>Address<input value={settingsForm.address} onChange={e=>setSettingsForm({...settingsForm,address:e.target.value})}/></label>
            <label>City<select value={settingsForm.city} onChange={e=>setSettingsForm({...settingsForm,city:e.target.value})}><option value="">Select City</option>{CITY_OPTIONS.map(x=><option key={x}>{x}</option>)}</select></label>
            <label>Pin Code<input value={settingsForm.pin_code} onChange={e=>setSettingsForm({...settingsForm,pin_code:e.target.value})} maxLength={10}/></label>
            <label>State<select value={settingsForm.state} onChange={e=>setSettingsForm({...settingsForm,state:e.target.value})}><option value="">Select State</option>{STATE_OPTIONS.map(x=><option key={x}>{x}</option>)}</select></label>
            <label>Country<select value={settingsForm.country} onChange={e=>setSettingsForm({...settingsForm,country:e.target.value})}>{COUNTRY_OPTIONS.map(x=><option key={x}>{x}</option>)}</select></label>
            <label>Default Tenant Language<select value={settingsForm.language} onChange={e=>setSettingsForm({...settingsForm,language:e.target.value})}>{['English','Telugu','Hindi','Tamil','Kannada'].map(x=><option key={x}>{x}</option>)}</select><span className="hint">Fallback for newly created users. Each user can choose a different language from My Language.</span></label>
            <label>No. of Flats
              <input type="number" min="0" disabled={!settingsForm.no_of_flats_editable} value={settingsForm.no_of_flats===0?'':settingsForm.no_of_flats}
                onChange={e=>setSettingsForm({...settingsForm,no_of_flats:Number(e.target.value)})}/>
              <span className="hint">Used for No Meter equal water split.</span>
            </label>
            <label className="checkbox-label"><input type="checkbox" checked={settingsForm.no_of_flats_editable} onChange={e=>setSettingsForm({...settingsForm,no_of_flats_editable:e.target.checked})}/>Allow editing No. of Flats (uncheck to freeze)</label>
            <label>Default Charges Effective Month
              <input type="month" value={settingsEffectiveMonth} min={tenantDataStartMonth||undefined}
                onChange={e=>setSettingsEffectiveMonth(e.target.value)}/>
              <span className="hint">The latest saved version for this MM/YYYY is used as the default when Monthly Maintenance is generated. Locked historical months retain their transaction values.</span>
            </label>
            <label>Common Maintenance (Maint) / Flat
              <input type="number" min="0" placeholder="Enter amount" value={settingsForm.common_maintenance===0?'':settingsForm.common_maintenance}
                onChange={e=>setSettingsForm({...settingsForm,common_maintenance:e.target.value===''?0:Number(e.target.value)})}/>
            </label>
            <label>CCA / Flat
              <input type="number" min="0" placeholder="Enter amount" value={settingsForm.cca===0?'':settingsForm.cca}
                onChange={e=>setSettingsForm({...settingsForm,cca:e.target.value===''?0:Number(e.target.value)})}/>
            </label>
            <label>Watchman Salary
              <input type="number" min="0" disabled={settingsForm.watchman_salary_locked} value={settingsForm.watchman_salary===0?'':settingsForm.watchman_salary}
                onChange={e=>setSettingsForm({...settingsForm,watchman_salary:e.target.value===''?0:Number(e.target.value)})}/>
            </label>
            <label className="full checkbox-label">
              <input type="checkbox" checked={settingsForm.watchman_salary_locked}
                onChange={e=>setSettingsForm({...settingsForm,watchman_salary_locked:e.target.checked})}/>
              Freeze Watchman Salary
            </label>
            <div className="form-actions"><button type="submit" disabled={settingsLoading}>{settingsLoading?'Saving...':'Save Operational Settings'}</button></div>
          </form>
          <div className="water-box">
            <strong>Watchman Salary behavior</strong>
            <p className="help-text">Watchman Salary is an apartment operational expense and is not added to flat maintenance. A salary is posted only for the current or completed month; future months are never pre-created. Once a Watchman version is locked, that locked version controls the salary from its Start Month through its End Month. If a new Watchman/salary is locked with a later Start Month, that version applies from that month onward.</p>
          </div>
          {settingsMessage&&<div className="message">{settingsMessage}</div>}
        </section>
        <section className="panel"><h2>Watchman Details</h2><p className="help-text">Maintain Name, Mobile Number, Start Date and End Date. Lock prevents editing; Soft Delete preserves complete history.</p>
          <form onSubmit={saveWatchman} className="resident-form"><label>Name<input required value={watchmanForm.name} onChange={e=>setWatchmanForm({...watchmanForm,name:e.target.value})}/></label><label>Mobile Number<input required value={watchmanForm.mobile_no} onChange={e=>setWatchmanForm({...watchmanForm,mobile_no:e.target.value})}/></label><label>Monthly Salary<input type="number" min="0" value={watchmanForm.salary===0?'':watchmanForm.salary} onChange={e=>setWatchmanForm({...watchmanForm,salary:e.target.value===''?0:Number(e.target.value)})}/></label><label>Start Date<input type="text" inputMode="numeric" placeholder="DD/MM/YYYY" pattern="\d{2}/\d{2}/\d{4}" required value={displayDateInput(watchmanForm.start_date)} onChange={e=>setWatchmanForm({...watchmanForm,start_date:parseDisplayDate(e.target.value)})}/></label><label>End Date<input type="text" inputMode="numeric" placeholder="DD/MM/YYYY" pattern="\d{2}/\d{2}/\d{4}" value={displayDateInput(watchmanForm.end_date||'')} onChange={e=>setWatchmanForm({...watchmanForm,end_date:parseDisplayDate(e.target.value)})}/></label><label>Remarks<input value={watchmanForm.remarks} onChange={e=>setWatchmanForm({...watchmanForm,remarks:e.target.value})}/></label><div className="form-actions"><button type="submit">{editingWatchmanId?'Update Watchman':'Save Watchman'}</button></div></form>
          <div className="table-scroll"><table><thead><tr><th>Name</th><th>Mobile</th><th>Start</th><th>End</th><th>Salary</th><th>Locked</th><th>Actions</th></tr></thead><tbody>{watchmen.map(w=><tr key={w.id}><td>{w.name}</td><td>{w.mobile_no}</td><td>{formatDate(w.start_date)}</td><td>{w.end_date?formatDate(w.end_date):'—'}</td><td>{money(w.salary)}</td><td>{w.locked?'Yes':'No'}</td><td className="actions"><button onClick={()=>editWatchman(w)} disabled={w.locked}>Edit</button><button className="secondary" onClick={()=>toggleWatchmanLock(w.id,!w.locked)}>{w.locked?'Unlock':'Lock'}</button><button className="danger" onClick={()=>deleteWatchman(w.id)}>Soft Delete</button></td></tr>)}</tbody></table></div>
          <h3>Watchman History</h3><div className="history-list">{watchmanHistory.map((h:any,i:number)=><div key={i}><span>{formatDateTime(h.at)}</span> — <b>{h.action}</b>{h.changed_by&&<span> · By: {h.changed_by}</span>}{h.justification&&<span> · Justification: {h.justification}</span>}</div>)}</div>
        </section>
        <section className="panel golive-panel"><div className="section-title-row"><div><h2>🔐 Go-Live Opening Balance</h2><p className="help-text">The <b>latest locked version</b> of the Go-Live Month and Opening Balance is the financial baseline used by Dashboard and Reports. Admin Unlock permits a controlled correction; the previous locked version remains in history.</p></div><span className={`lock-badge ${openingBalance?.locked?'is-locked':'is-open'}`}>{openingBalance?.locked?'🔒 Locked':'🟢 Open for editing'}</span></div>{(()=>{const lockedVersions=[...(openingHistory||[])].filter((h:any)=>h.action==='Locked');const latestLocked=lockedVersions.length?lockedVersions[lockedVersions.length-1]:undefined;return <div className="golive-current"><div><span>Current Go-Live Month</span><b>{latestLocked?.go_live_month||openingBalance?.go_live_month||'Not set'}</b></div><div><span>Current Locked Opening</span><b>{money(Number(latestLocked?.opening_balance ?? (openingBalance?.locked?openingBalance?.opening_balance:0)))}</b></div><div><span>Calculation Status</span><b>{latestLocked?'Latest locked version':'Awaiting lock'}</b></div></div>})()}<form onSubmit={saveOpening} className="resident-form golive-form"><label>Go-Live Month<input type="month" required disabled={!!openingBalance?.locked&&!openingEditMode} value={openingForm.go_live_month} onChange={e=>setOpeningForm({...openingForm,go_live_month:e.target.value})}/></label><label>Opening Balance<input type="number" step="0.01" min="0" disabled={!!openingBalance?.locked&&!openingEditMode} placeholder="Enter opening balance" value={openingForm.opening_balance===0?'':openingForm.opening_balance} onChange={e=>setOpeningForm({...openingForm,opening_balance:e.target.value===''?0:Number(e.target.value)})}/></label><div className="form-actions"><button type="submit" disabled={!!openingBalance?.locked&&!openingEditMode}>💾 Save New Version</button>{openingBalance&&!openingBalance.locked&&<button type="button" className="secondary" onClick={lockOpening}>🔒 Lock & Make Active</button>}{openingBalance?.locked&&currentUser.role==='Admin'&&<button type="button" className="secondary admin-unlock" onClick={unlockOpening}>🔓 Admin Unlock & Edit</button>}{openingEditMode&&<button type="button" className="secondary" onClick={()=>{setOpeningEditMode(false);loadOpeningBalance();setSettingsMessage('Changes cancelled. The latest locked version remains active.');}}>Cancel</button>}</div></form><div className="golive-history-head"><h3>Version History</h3><span>Newest records are retained for audit</span></div><div className="history-list golive-history">{openingHistory.length===0?<div className="empty">No Go-Live history yet.</div>:openingHistory.map((h:any,i:number)=><div key={h.id||i}><span>{formatDateTime(h.changed_at)}</span><b>{h.action}</b><span>{h.go_live_month}</span><strong>{money(h.opening_balance)}</strong><span title={h.justification||''}>{h.justification||'—'}</span></div>)}</div></section>
      </>}


      {tab==='Data Import' && <>
        <div className="page-title-row"><div><h1>Data Import</h1><p className="subtitle">Import validated Excel data for testing or historical migration. Templates are embedded in this ApartCare build and are updated with application patches.</p></div></div>
        <section className="panel import-panel">
          <h2>📥 Download Templates</h2>
          <p className="help-text">Always download the templates from this section before preparing an import. The column definitions match the validation rules in this application version.</p>
          <div className="summary-grid import-template-grid">
            <div className="card"><div className="label">Master Residency</div><div className="value" style={{fontSize:'1rem'}}>Resident Master</div><p className="help-text">Flat, owner/resident, resident type, mobile, email and status.</p><a className="secondary button-link" href="/templates/ApartCare_Resident_Master_Import_Template.xlsx" download>⬇ Download Resident Master</a></div>
            <div className="card historical-template-card"><div className="label">Historical Monthly Data</div><div className="value" style={{fontSize:'1rem'}}>Historical Maintenance</div><p className="help-text">Updated monthly fields including Opening Balance, Paid Amount, Paid Date, Payment Mode, Reference and Remarks.</p><a className="secondary button-link" href="/templates/ApartCare_Historical_Monthly_Data_Import_Template.xlsx" download>⬇ Download Historical Template</a></div>
          </div>
        </section>
        <section className="panel import-panel"><div className="report-tabs"><button className={importType==='residents'?'active':''} onClick={()=>setImportType('residents')}>Resident Master</button><button className={importType==='maintenance'?'active':''} onClick={()=>setImportType('maintenance')}>Monthly Maintenance</button></div>
        <h2>{importType==='residents'?'Resident Master Import':'Monthly Maintenance Import'}</h2><p className="help-text">Use the matching embedded ApartCare template without changing the required column headers.</p>{importType==='maintenance'&&<label className="checkbox-inline historical-import"><input type="checkbox" checked={historicalImport} onChange={e=>setHistoricalImport(e.target.checked)}/> <b>Historical Data</b><span> — import historical monthly maintenance and payment details from the updated template.</span></label>}
        <div className="import-actions"><a className="secondary button-link" href={importType==='residents'?'/templates/ApartCare_Resident_Master_Import_Template.xlsx':'/templates/ApartCare_Historical_Monthly_Data_Import_Template.xlsx'} download>⬇ Download Matching Template</a><input ref={importFileInputRef} type="file" accept=".xlsx" onChange={e=>{setImportFile(e.target.files?.[0]||null);setImportErrors([]);setImportMessage('')}}/><button type="button" onClick={uploadImportFile} disabled={isViewer(currentUser)||importLoading}>{importLoading?'Importing...':'Validate & Import'}</button></div>
        {importFile&&<div className="selected-import-file">Selected file: <b>{importFile.name}</b></div>}
        {importMessage&&<div className="message import-result-message">{importMessage}</div>}
        {importErrors.length>0&&<div className="import-error-panel"><h3>Validation Errors — Correct these rows and upload again</h3><ol>{importErrors.map((err,i)=><li key={`${i}-${err}`}>{err}</li>)}</ol></div>}
        </section>
      </>}


      {tab==='Monthly Maintenance' && <>
        <div className="page-title-row"><div><h1>Monthly Maintenance</h1><p className="subtitle">Generate one maintenance record per active flat. Common Maintenance and CCA default from Settings. Diesel is entered as the total monthly Diesel amount and automatically divided by the configured number of flats; meter readings carry forward from the latest prior month.</p></div><button className="secondary" onClick={()=>loadMaintenance()}>{maintenanceLoading?'Loading...':'Refresh'}</button></div>
        {maintenanceMonthLocked&&<div className="message">🔒 {month} is globally locked. Monthly Maintenance is frozen. Reports remain available.</div>}

        <section className="form-panel">
          <div className="month-heading"><h2>Monthly Setup</h2><div className="month-selector"><label>Month</label><input type="month" lang="en-GB" min={tenantDataStartMonth} value={month} onChange={e=>setMonth(e.target.value)}/></div></div>
          <div className="maintenance-setup-grid">
            <label><input type="checkbox" disabled={maintenanceMonthLocked} checked={chargeForm.include_maintenance} onChange={e=>setChargeForm({...chargeForm,include_maintenance:e.target.checked})}/> Common Maintenance (Maint) / Flat<input type="number" min="0" disabled={isViewer(currentUser)||maintenanceMonthLocked||!chargeForm.include_maintenance} value={chargeForm.maintenance===0?'':chargeForm.maintenance} onChange={e=>setChargeForm({...chargeForm,maintenance:Number(e.target.value)})}/></label>
            <label><input type="checkbox" disabled={maintenanceMonthLocked} checked={chargeForm.include_cca} onChange={e=>setChargeForm({...chargeForm,include_cca:e.target.checked})}/> CCA / Flat<input type="number" min="0" disabled={isViewer(currentUser)||maintenanceMonthLocked||!chargeForm.include_cca} value={chargeForm.cca===0?'':chargeForm.cca} onChange={e=>setChargeForm({...chargeForm,cca:Number(e.target.value)})}/></label>
            <label><input type="checkbox" disabled={maintenanceMonthLocked} checked={chargeForm.include_diesel} onChange={e=>setChargeForm({...chargeForm,include_diesel:e.target.checked})}/> Total Diesel Amount (auto divided by flats)<input type="number" min="0" disabled={isViewer(currentUser)||maintenanceMonthLocked||!chargeForm.include_diesel} value={chargeForm.diesel===0?'':chargeForm.diesel} onChange={e=>setChargeForm({...chargeForm,diesel:e.target.value===''?0:Number(e.target.value)})}/></label>
            <label>Other Charges / Flat<input disabled={isViewer(currentUser)||maintenanceMonthLocked} type="number" min="0" value={chargeForm.other_charges===0?'':chargeForm.other_charges} onChange={e=>setChargeForm({...chargeForm,other_charges:e.target.value===''?0:Number(e.target.value)})}/></label>
          </div>

          <div className="water-box">
            <h3>Water Calculation</h3>
            <div className="maintenance-setup-grid">
              <label>Water Mode<select disabled={isViewer(currentUser)||maintenanceMonthLocked} value={chargeForm.water_mode} onChange={e=>setChargeForm({...chargeForm,water_mode:e.target.value as 'Meter'|'No Meter'})}><option>Meter</option><option>No Meter</option></select></label>
              <label>No. of Tankers<input disabled={isViewer(currentUser)||maintenanceMonthLocked} type="number" min="0" step="1" value={chargeForm.tanker_count===0?'':chargeForm.tanker_count} onChange={e=>setChargeForm({...chargeForm,tanker_count:e.target.value===''?0:Number(e.target.value)})}/></label>
              <label>Tanker Price<input disabled={isViewer(currentUser)||maintenanceMonthLocked} type="number" min="0" value={chargeForm.tanker_price===0?'':chargeForm.tanker_price} onChange={e=>setChargeForm({...chargeForm,tanker_price:e.target.value===''?0:Number(e.target.value)})}/></label>
              <label>{chargeForm.water_mode==='No Meter'?'Water Amount / Flat':'Per Unit Price'}<input readOnly value={chargeForm.water_mode==='No Meter' ? ((chargeForm.tanker_count*chargeForm.tanker_price + (chargeForm.include_municipal_water?chargeForm.municipal_bill:0))/Math.max(settingsForm.no_of_flats||waterHeader?.flats_count||0,1)) : (waterHeader?.total_units && waterHeader.total_units>0 ? Math.ceil((chargeForm.tanker_count*chargeForm.tanker_price + (chargeForm.include_municipal_water?chargeForm.municipal_bill:0))/waterHeader.total_units) : 0)}/></label>
              <label>Total Tanker Amount<input readOnly value={chargeForm.tanker_count*chargeForm.tanker_price}/></label>
              <label><input type="checkbox" disabled={maintenanceMonthLocked} checked={chargeForm.include_municipal_water} onChange={e=>setChargeForm({...chargeForm,include_municipal_water:e.target.checked})}/> Municipal Water Bill<input type="number" min="0" disabled={isViewer(currentUser)||maintenanceMonthLocked||!chargeForm.include_municipal_water} value={chargeForm.municipal_bill===0?'':chargeForm.municipal_bill} onChange={e=>setChargeForm({...chargeForm,municipal_bill:e.target.value===''?0:Number(e.target.value)})}/></label>
              <label>{chargeForm.water_mode==='No Meter'?'No. of Flats':'Total No. of Units'}<input readOnly value={chargeForm.water_mode==='No Meter' ? (settingsForm.no_of_flats||waterHeader?.flats_count||0) : (waterHeader?.total_units ?? 0)}/></label>
            </div>
            <p className="help-text">Meter: Total No. of Units = Sum of Individual Flats Water Consumption; Water Amount = Individual Flat Units × Per Unit Price. No Meter: Water Amount / Flat = (Total Tanker Amount + selected Municipal Water Bill) ÷ No. of Flats. Total Tanker Amount = No. of Tankers × Tanker Price.</p>
          </div>

          <div className="form-actions">
            {!maintenanceRows.length ? <button type="button" onClick={generateMaintenance} disabled={isViewer(currentUser)||maintenanceLoading||maintenanceMonthLocked}>Generate Monthly Maintenance</button> :
            <button type="button" onClick={updateWaterHeader} disabled={isViewer(currentUser)||maintenanceLoading||maintenanceMonthLocked}>Update Water Setup & Recalculate</button>}
          </div>
          {maintenanceMessage&&<div className="message">{maintenanceMessage}</div>}
        </section>

        {summary&&maintenanceRows.length>0&&<section className="summary-grid">
          <div className="card"><div className="label">Active Flats</div><div className="value">{summary.flats_count}</div></div>
          <div className="card"><div className="label">Total Water</div><div className="value">{money(summary.water_total)}</div></div>
          <div className="card"><div className="label">Total Maintenance</div><div className="value">{money(summary.maintenance_total)}</div></div>
        </section>}

        {waterHeader&&maintenanceRows.length>0&&<section className="water-summary">
          <strong>{waterHeader.water_mode} Water Summary:</strong> {waterHeader.tanker_count} Tankers × {money(waterHeader.tanker_price)} = {money(waterHeader.tanker_amount)} Total Tanker Amount. Total Units {waterHeader.total_units.toFixed(2)}. Per Unit Price {money(waterHeader.water_rate)}. Total Water Cost {money(waterHeader.total_water_cost)}.
        </section>}

        <section className="table-panel">
          <h2>Flat-wise Maintenance</h2>
          {!maintenanceLoaded&&<div className="empty-state">Loading monthly records...</div>}
          {maintenanceLoaded&&maintenanceRows.length===0&&<div className="empty-state">No records for {month}. Enter charges and click Generate Monthly Maintenance.</div>}
          {maintenanceRows.length>0&&<div className="table-wrap"><table className="maintenance-table"><thead><tr>
            <th>Flat</th><th>Owner</th><th>Resident</th><th>Version</th><th>Common Maint</th><th>CCA</th><th>Diesel</th><th>Other</th>
            <th><input disabled={isViewer(currentUser)||maintenanceMonthLocked} type="checkbox" checked={maintenanceRows.length>0&&selectedMaintenanceIds.length===maintenanceRows.length} onChange={e=>setSelectedMaintenanceIds(e.target.checked?maintenanceRows.map(x=>x.id):[])}/> Select All</th><th>Prev Reading</th><th>Current Reading</th><th>Units</th><th>Water</th><th>Total</th><th>Rounded</th>
          </tr></thead><tbody>
          {maintenanceRows.map(r=><tr key={r.id}>
            <td>{r.flat_no}</td><td>{r.owner_name}</td><td>{r.resident_name}</td><td><b>V{r.resident_version||1}</b></td>
            <td><input type="number" min="0" value={r.maintenance===0?'':r.maintenance} onChange={e=>setRowField(r.id,'maintenance',e.target.value)} disabled={isViewer(currentUser)||maintenanceMonthLocked}/></td>
            <td><input type="number" min="0" value={r.cca===0?'':r.cca} onChange={e=>setRowField(r.id,'cca',e.target.value)} disabled={isViewer(currentUser)||maintenanceMonthLocked}/></td>
            <td><input type="number" min="0" value={r.diesel===0?'':r.diesel} onChange={e=>setRowField(r.id,'diesel',e.target.value)} disabled={isViewer(currentUser)||maintenanceMonthLocked}/></td>
            <td><input type="number" min="0" value={r.other_charges===0?'':r.other_charges} onChange={e=>setRowField(r.id,'other_charges',e.target.value)} disabled={isViewer(currentUser)||maintenanceMonthLocked}/></td>
            <td><input type="checkbox" checked={selectedMaintenanceIds.includes(r.id)} onChange={e=>setSelectedMaintenanceIds(ids=>e.target.checked?[...ids,r.id]:ids.filter(id=>id!==r.id))}/></td>
            <td>{r.previous_reading}</td>
            <td>{waterHeader?.water_mode==='Meter'?<input type="number" min={r.previous_reading} value={r.current_reading===0?'':r.current_reading} onChange={e=>setRowField(r.id,'current_reading',e.target.value)} disabled={isViewer(currentUser)||maintenanceMonthLocked}/>:<span>Not Required</span>}</td>
            <td>{r.water_units.toFixed(2)}</td><td>{money(r.water_amount)}</td><td>{money(r.total)}</td><td><strong>{money(r.rounded_total)}</strong></td>
          </tr>)}
          </tbody></table><div className="form-actions table-actions"><button type="button" onClick={saveSelectedMaintenance} disabled={isViewer(currentUser)||maintenanceLoading||maintenanceMonthLocked||selectedMaintenanceIds.length===0}>{maintenanceLoading?'Saving...':`Save Selected (${selectedMaintenanceIds.length})`}</button></div></div>}
        </section>
      </>}
    </main>
  </div>;
}
