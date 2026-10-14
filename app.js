import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://ivqygskesdrretwgouea.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_f4Jv-1y826TQkpRbVYAeEg_91xKWGSx';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
const content = $('#content');
const authView = $('#authView');
const appView = $('#appView');
const modal = $('#modal');
const modalBody = $('#modalBody');

const state = {
  session: null,
  appUser: null,
  currentPage: 'dashboard',
  products: [],
  allProducts: [],
  suppliers: [],
  branches: [],
  warehouse: null,
  positions: [],
  expiry: [],
  cache: {},
  dashboardPreset: 'this_month',
  dashboardCustom: null
};

const navItems = [
  ['__g','','Overview'],
  ['dashboard','▦','Dashboard'],
  ['__g','','Operations'],
  ['receiving','↓','Receiving'],
  ['transfers','⇄','Transfers'],
  ['sheet','▤','Transfer Sheet'],
  ['replenishment','⚡','Replenishment'],
  ['__g','','Inventory'],
  ['stock','▤','Stock'],
  ['movements','≋','Movements'],
  ['variance','±','Variance'],
  ['compare','⇋','Compare Sheet'],
  ['counts','✎','Closing Counts'],
  ['adjustments','±','Adjustments'],
  ['waste','♲','Waste'],
  ['expiry','◷','Expiry'],
  ['__g','','Insights'],
  ['reports','▥','Reports'],
  ['history','◔','Daily History'],
  ['__g','','Master Data'],
  ['suppliers','♟','Suppliers'],
  ['products','□','Products']
];

const pageMeta = {
  dashboard:['Dashboard','Live management view from Supabase'],
  stock:['Stock','Current stock positions by product and location'],
  movements:['Movements','Read-only inventory audit ledger'],
  receiving:['Receiving','Multi-line supplier receiving'],
  transfers:['Transfers','Bakery Warehouse to active destination branches'],
  adjustments:['Adjustments','Controlled corrections and physical counts'],
  waste:['Waste','Expired, damaged and unsellable inventory'],
  expiry:['Expiry','Batch expiry risk and FEFO visibility'],
  reports:['Reports','Daily, monthly and management reporting'],
  suppliers:['Suppliers','Supplier activity using real data'],
  products:['Products','Real Supabase product master'],
  counts:['Closing Counts','Verified 30/09/2026 closing stock per location'],
  sheet:['Transfer Sheet','Type the daily sheet quantities — checked against Warehouse stock'],
  compare:['Compare Sheet','Closing stock, received, transferred and available — per item'],
  variance:['Variance','Counted stock against the system: over (+) and short (−) by product'],
  scan:['Scan Invoice','Read a supplier invoice photo and draft the receiving automatically'],
  replenishment:['Replenishment','Automatic transfer and supplier-order suggestions from real usage'],
  history:['Daily History','Automatic nightly stock snapshots and value trend']
};

const COLORS = {
  healthy:'#15803d', low:'#d97706', out:'#ea580c', receiving:'#2563eb', transfer:'#4f46e5', waste:'#dc2626', neutral:'#475569', safe:'#16a34a'
};

const INVENTORY_START_DATE = '2026-08-22';
let bootSequence = 0;
let recoveryMode = location.hash.includes('type=recovery') || new URLSearchParams(location.search).get('type')==='recovery';

function esc(v=''){return String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function num(v,d=0){const n=Number(v||0);return n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});}
function qty(v){const n=Number(v||0);return num(n,Number.isInteger(n)?0:2);}
function money(v){return `SAR ${num(v,2)}`;}
function isoToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function isoDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function dateFmt(v){if(!v)return '—';const s=String(v).slice(0,10);const [y,m,d]=s.split('-');return y&&m&&d?`${d}/${m}/${y}`:esc(v);}
function dateTimeFmt(v){if(!v)return '—';const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
function locationName(name){return String(name||'')==='Warehouse'?'Bakery Warehouse':String(name||'');}
function displayMovement(v){return String(v||'').replaceAll('_',' ');}
function rowsOf(data){
  return Array.isArray(data) ? data : (data == null ? [] : [data]);
}
function resultRows(result,label){
  if(!result) return [];
  if(result.error) throw new Error(label+': '+(result.error.message||result.error));
  return rowsOf(result.data);
}
function safeResultRows(result,label,warnings){
  if(!result) return [];
  if(result.status==='rejected'){warnings.push(label+': '+(result.reason?.message||result.reason||'request failed'));return [];}
  if(result.value?.error){warnings.push(label+': '+(result.value.error.message||result.value.error));return [];}
  return rowsOf(result.value?.data);
}
function sum(rows,key){
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  return list.reduce((a,r)=>a+Number(r[key]||0),0);
}
function distinctCount(rows,key){
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  return new Set(list.map(r=>r[key]).filter(v=>v!==null&&v!==undefined)).size;
}
function groupSum(rows,key,valueKey){const m=new Map();for(const r of rows||[]){const k=r[key]??'Unspecified';m.set(k,(m.get(k)||0)+Number(r[valueKey]||0));}return [...m.entries()].map(([label,value])=>({label,value}));}
function toast(msg,type=''){const t=$('#toast');t.textContent=msg;t.className=`toast show ${type}`;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.className='toast',4200);}
function setLoading(msg='Loading…'){content.innerHTML=`<div class="panel loading">${esc(msg)}</div>`;}
function fail(error,context='Request failed'){console.error(error);toast(`${context}: ${error?.message||error}`,'error');}
function updateNetworkStatus(){
  const el=$('#networkStatus');if(!el)return;
  const online=navigator.onLine;
  el.textContent=online?'Online':'Offline — changes cannot be saved';
  el.className=`network-status ${online?'online':'offline'}`;
}
function assertOnline(){if(!navigator.onLine)throw new Error('You are offline. Reconnect before saving.');}

function ensureRuntimePatchUi(){
  if(!$('#networkStatus')){const n=document.createElement('div');n.id='networkStatus';n.className='network-status';n.setAttribute('aria-live','polite');n.textContent='Checking connection…';document.body.appendChild(n);}
  if(!$('#recoveryForm')){
    const card=$('.auth-card');if(card){const f=document.createElement('form');f.id='recoveryForm';f.className='stack hidden';f.innerHTML='<p class="small muted">Set a new password for your account.</p><label>New Password<input id="newPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="At least 8 characters"></label><label>Confirm Password<input id="confirmPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="Repeat new password"></label><button class="btn primary wide" type="submit">Update password</button>';card.insertBefore(f,card.lastElementChild);}
  }
  if(!$('#runtimePatchStyles')){const s=document.createElement('style');s.id='runtimePatchStyles';s.textContent=`
    .kpi-grid-7{grid-template-columns:repeat(7,minmax(0,1fr))}
    .report-controls{grid-template-columns:minmax(240px,1.7fr) minmax(220px,1.5fr) minmax(140px,1fr) minmax(140px,1fr) auto}
    .network-status{position:fixed;top:8px;right:10px;z-index:110;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:800;box-shadow:0 4px 14px rgba(15,23,42,.12)}
    .expiry-required{color:#b45309!important}.expiry-required input{border-color:#d97706!important}.network-status.online{background:#ecfdf3;color:#166534;border:1px solid #bbf7d0}.network-status.offline{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
    @media(max-width:1350px){.kpi-grid-7{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:900px){.kpi-grid-7{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:620px){.kpi-grid-7{grid-template-columns:1fr 1fr}.line-scroll{overflow:visible;border:0;background:transparent}.erp-lines{min-width:0;display:grid;gap:10px}.erp-line,.erp-line.transfer-line{grid-template-columns:1fr 1fr;gap:9px;padding:12px;border:1px solid var(--line);border-radius:10px;background:#fff;align-items:end}.erp-line .pick{grid-column:1}.erp-line .product-cell,.erp-line .notes-cell{grid-column:1/-1}.erp-line .line-remove{grid-column:2;justify-self:end}.erp-line label{font-size:11px}.erp-line input,.erp-line select{padding:10px}.line-toolbar .btn{flex:1;min-width:110px}.network-status{top:auto;bottom:8px;right:8px}}
    @media(max-width:420px){.kpi-grid-7{grid-template-columns:1fr 1fr}}
  `;document.head.appendChild(s);}
}
ensureRuntimePatchUi();
function newPostingKey(){return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;}
function statusBadge(s){const x=String(s||'—');const l=x.toLowerCase();let c='neutral';if(l.includes('healthy')||l==='safe'||l==='ok')c='good';else if(l.includes('low')||l.includes('within 7')||l.includes('within 14'))c='warn';else if(l.includes('out')||l.includes('expired')||l.includes('today')||l.includes('within 3'))c='bad';return `<span class="badge ${c}">${esc(x)}</span>`;}
function activeRole(){return String(state.appUser?.role||'').toLowerCase();}
function canPost(){return ['admin','bakery incharge','warehouse staff'].includes(activeRole());}
function canCorrectExpiry(){return ['admin','bakery incharge'].includes(activeRole());}

function periodRange(preset=state.dashboardPreset, custom=state.dashboardCustom){
  const now=new Date(); now.setHours(0,0,0,0);
  let from=new Date(now),to=new Date(now);
  if(preset==='yesterday'){from.setDate(from.getDate()-1);to=new Date(from);}
  else if(preset==='this_week'){const day=(now.getDay()+6)%7;from.setDate(now.getDate()-day);}
  else if(preset==='last_7'){from.setDate(now.getDate()-6);}
  else if(preset==='this_month'){from=new Date(now.getFullYear(),now.getMonth(),1);}
  else if(preset==='last_month'){from=new Date(now.getFullYear(),now.getMonth()-1,1);to=new Date(now.getFullYear(),now.getMonth(),0);}
  else if(preset==='custom'&&custom?.from&&custom?.to){return {from:custom.from,to:custom.to};}
  return {from:isoDate(from),to:isoDate(to)};
}
function rangeDays(from,to){return Math.max(1,Math.round((new Date(to)-new Date(from))/864e5)+1);}
function monthKey(v){return String(v||'').slice(0,7);}
function aggregateTrend(rows,dateKey,valueKey,from,to){
  const long=rangeDays(from,to)>62;const m=new Map();
  for(const r of rows||[]){const k=long?monthKey(r[dateKey]):String(r[dateKey]||'').slice(0,10);m.set(k,(m.get(k)||0)+Number(r[valueKey]||0));}
  return [...m.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([label,value])=>({label:long?`${label.slice(5,7)}/${label.slice(0,4)}`:dateFmt(label),value}));
}

async function requireData(force=false){
  if(!force&&state.products.length&&state.branches.length&&state.suppliers.length&&state.positions.length)return;
  const results=await Promise.allSettled([
    supabase.from('products').select('id,ref_no,product_code,name,category,category_id,unit,unit_price,unit_cost,low_stock_alert,reorder_level,minimum_stock,maximum_stock,is_active,supplier_id').eq('is_active',true).order('name'),
    supabase.from('products').select('id,ref_no,product_code,name,category,category_id,unit,unit_price,unit_cost,low_stock_alert,reorder_level,minimum_stock,maximum_stock,is_active,supplier_id').order('name'),
    supabase.from('suppliers').select('*').order('name'),
    supabase.from('branches').select('*').order('name'),
    supabase.from('v_stock_positions').select('*'),
    supabase.from('v_expiry_alerts').select('*')
  ]);
  const warnings=[];
  const labels=['Active products','All products','Suppliers','Branches','Stock positions','Expiry alerts'];
  const values=results.map((r,i)=>safeResultRows(r,labels[i],warnings));
  state.products=values[0];state.allProducts=values[1];state.suppliers=values[2];state.branches=values[3].filter(x=>x.is_active);state.positions=values[4];state.expiry=(values[5]||[]).filter(x=>Number(x.branch_id)===1);
  state.warehouse=state.branches.find(x=>String(x.name).toLowerCase()==='warehouse')||null;
  await loadClosingCounts();
  state.dataWarnings=warnings;
  if(warnings.length)console.warn('Some dashboard data sources could not be loaded:',warnings);
}

async function loadAppUser(){
  const {data,error}=await supabase.from('app_users').select('id,name,email,role,branch_id,is_active').eq('auth_user_id',state.session.user.id).maybeSingle();
  if(error)throw error;if(!data||!data.is_active)throw new Error('Your inventory account is not active');state.appUser=data;
  $('#userCard').innerHTML=`<strong>${esc(data.name)}</strong><span>${esc(data.role)}</span><small>${esc(data.email||state.session.user.email||'')}</small>`;
}

function renderNav(){
  const navList = Array.isArray(navItems) ? navItems : navItems ? [navItems] : [];
  $('#nav').innerHTML=navList.map(([id,ico,label,href])=>id==='__g'?`<div class="nav-group">${label}</div>`:`<button data-page="${id}" data-href="${href||''}" class="${state.currentPage===id?'active':''}"><span class="ico">${ico}</span><span>${label}</span></button>`).join('');
  const navButtonsValue = Array.from(document.querySelectorAll('#nav button'));
  const navButtons = Array.isArray(navButtonsValue) ? navButtonsValue : navButtonsValue ? [navButtonsValue] : [];
  navButtons.forEach(b=>b.onclick=()=>{if(b.dataset.href){window.location.href=b.dataset.href;return;}go(b.dataset.page);});
}

async function go(page,throwOnError=false){
  state.currentPage=page;renderNav();$('#sidebar').classList.remove('open');
  const meta=pageMeta[page]||['Inventory',''];$('#pageTitle').textContent=meta[0];$('#pageSubtitle').textContent=meta[1];paintCrumb(page);paintHealth();setLoading();
  try{await requireData();await pages[page]();return true;}catch(e){if(throwOnError)throw e;fail(e);content.innerHTML=`<div class="panel"><h3>Unable to load ${esc(meta[0])}</h3><p class="muted">${esc(e.message)}</p></div>`;return false;}
}

function kpi(label,value,hint,cls=''){return `<div class="kpi-card ${cls}"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${value??'—'}</div><div class="kpi-hint">${esc(hint||'')}</div></div>`;}
function miniMetric(label,value){return `<div class="mini-metric"><span>${esc(label)}</span><strong>${value}</strong></div>`;}

function donutChart(title,items){
  const total=items.reduce((a,x)=>a+Number(x.value||0),0);if(total<=0)return `<div class="chart-card"><div class="chart-title">${esc(title)}</div><div class="empty">No data</div></div>`;let cursor=0;const stops=[];
  for(const item of items){const start=cursor;cursor+=Number(item.value||0)/total*360;stops.push(`${item.color} ${start}deg ${cursor}deg`);}
  return `<div class="chart-card"><div class="chart-title">${esc(title)}</div><div class="donut-wrap"><div class="donut" style="background:conic-gradient(${stops.join(',')})"><div class="donut-hole"><strong>${qty(total)}</strong><span>positions</span></div></div><div class="chart-legend">${items.map(x=>`<div><i style="background:${x.color}"></i><span>${esc(x.label)}</span><strong>${qty(x.value)}</strong></div>`).join('')}</div></div></div>`;
}
function barChart(title,items,color=COLORS.neutral,formatter=qty){
  const max=Math.max(0,...items.map(x=>Number(x.value||0)));
  return `<div class="chart-card"><div class="chart-title">${esc(title)}</div><div class="hbars">${items.length?items.map(x=>{const v=Number(x.value||0);const pct=max&&v>0?v/max*100:0;const zero=v<=0?' zero':'';return `<div class="hbar-row" title="${esc(x.label)}: ${esc(formatter(x.value))}"><div class="hbar-label"><span>${esc(x.label)}${x.warn?' <b class="var-badge" title="Closing count differs from system stock">±</b>':''}</span><strong>${formatter(x.value)}</strong></div><div class="hbar-track"><div class="hbar-fill${zero}" style="width:${pct}%;background:${x.color||color}"></div></div></div>`;}).join(''):'<div class="empty">No data in selected period</div>'}</div></div>`;
}
function trendChart(title,items,color=COLORS.receiving,formatter=qty){
  const max=Math.max(0,...items.map(x=>Number(x.value||0)));
  if(!items.length||max<=0)return `<div class="chart-card"><div class="chart-title">${esc(title)}</div><div class="empty chart-empty">No activity in selected period</div></div>`;
  const mid=max/2;
  const bars=items.map(x=>{const v=Number(x.value||0);const h=v>0?v/max*100:0;const zero=v<=0?' zero':'';return `<div class="trend-col" title="${esc(x.label)}: ${esc(formatter(x.value))}"><strong>${formatter(x.value)}</strong><div class="trend-bar-wrap"><div class="trend-bar${zero}" style="height:${h}%;background:${x.color||color}"></div></div><span>${esc(x.label)}</span></div>`;}).join('');
  return `<div class="chart-card"><div class="chart-title">${esc(title)}</div><div class="trend-scaled"><div class="trend-yaxis"><span>${formatter(max)}</span><span>${formatter(mid)}</span><span>${formatter(0)}</span></div><div class="trend-chart">${bars}</div></div></div>`;
}
function compareChart(title,items){return barChart(title,items,COLORS.neutral,qty);}

function tableCell(v,col){
  if(col.render)return col.render(v,col._row);
  if(col.type==='money')return money(v);if(col.type==='qty')return qty(v);if(col.type==='date')return dateFmt(v);if(col.type==='datetime')return dateTimeFmt(v);if(col.type==='badge')return statusBadge(v);if(col.type==='movement')return esc(displayMovement(v));if(col.type==='location')return esc(locationName(v));
  return esc(v??'—');
}
function exportRowsCsv(rows,columns,filename){
  const q=v=>`"${String(v??'').replaceAll('"','""')}"`;const lines=[columns.map(c=>q(c.label)).join(',')];
  for(const r of rows)lines.push(columns.map(c=>q(rawExportValue(r[c.key],c))).join(','));downloadBlob(lines.join('\n'),'text/csv;charset=utf-8',`${filename}.csv`);
}
function rawExportValue(v,c){if(c.type==='date')return dateFmt(v);if(c.type==='datetime')return dateTimeFmt(v);if(c.type==='money')return Number(v||0).toFixed(2);if(c.type==='location')return locationName(v);if(c.type==='movement')return displayMovement(v);return v??'';}
function exportRowsExcel(rows,columns,filename){
  const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table><tr>${columns.map(c=>`<th>${esc(c.label)}</th>`).join('')}</tr>${rows.map(r=>`<tr>${columns.map(c=>`<td>${esc(rawExportValue(r[c.key],c))}</td>`).join('')}</tr>`).join('')}</table></body></html>`;downloadBlob(html,'application/vnd.ms-excel',`${filename}.xls`);
}
function downloadBlob(text,type,name){const blob=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function printRows(rows,columns,title){
  const w=window.open('','_blank');if(!w)return toast('Allow pop-ups to print','error');
  w.document.write(`<!doctype html><html><head><title>${esc(title)}</title><style>body{font-family:Arial;padding:20px;color:#111}h1{font-size:20px}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#eee}@media print{body{padding:0}}</style></head><body><h1>${esc(title)}</h1><p>Generated ${dateTimeFmt(new Date().toISOString())}</p><table><thead><tr>${columns.map(c=>`<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(c=>`<td>${esc(rawExportValue(r[c.key],c))}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`);w.document.close();setTimeout(()=>{try{w.focus();w.print();}catch(e){}},400);
}

function printInvoices(kind,rows,dateStr){
  const receiving=kind==='receiving';
  const w=window.open('','_blank');if(!w)return toast('Allow pop-ups to print','error');
  const groups=new Map();
  rows.forEach(r=>{const k=r.reference_no||r.receiving_id||r.transfer_id||'-';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);});
  const pages=[...groups.entries()].map(([ref,lines])=>{
    const f=lines[0];
    const totalQty=lines.reduce((t,l)=>t+Number(l.quantity||0),0);
    const totalVal=lines.reduce((t,l)=>t+Number(receiving?l.total_cost:l.total_value||0),0);
    const meta=receiving
      ?`<div><b>Supplier:</b> ${esc(f.supplier_name||'-')}</div><div><b>Supplier Invoice No:</b> ${esc(f.invoice_no||'-')}</div><div><b>Received at:</b> ${esc(locationName(f.branch_name)||f.branch_name||'-')}</div>`
      :`<div><b>From:</b> ${esc(locationName(f.from_branch)||f.from_branch||'-')}</div><div><b>To:</b> ${esc(locationName(f.to_branch)||f.to_branch||'-')}</div>`;
    const body=lines.map((l,i)=>`<tr><td class="c">${i+1}</td><td>${esc(l.product_code||'')}</td><td>${esc(l.product_name||'')}</td><td class="c">${esc(l.unit||'')}</td><td class="r">${qty(l.quantity)}</td>${receiving?`<td>${esc(l.batch_no||'')}</td><td class="c">${l.expiry_date?esc(dateFmt(l.expiry_date)):''}</td>`:''}<td class="r">${Number(l.unit_cost||0).toFixed(2)}</td><td class="r">${Number(receiving?l.total_cost:l.total_value||0).toFixed(2)}</td></tr>`).join('');
    return `<section class="inv"><header><div><h1>JOFFREY’S BAKERY</h1><div class="sub">${receiving?'RECEIVING INVOICE':'TRANSFER INVOICE'}</div></div><div class="ref"><div><b>Ref:</b> ${esc(ref)}</div><div><b>Date:</b> ${esc(dateFmt(f.date))}</div></div></header>
    <div class="meta">${meta}<div><b>Prepared by:</b> ${esc(f.performed_by||'-')}</div></div>
    <table><thead><tr><th>#</th><th>SKU</th><th>Product</th><th>Unit</th><th>Qty</th>${receiving?'<th>Batch</th><th>Expiry</th>':''}<th>Unit Cost</th><th>Value (SAR)</th></tr></thead><tbody>${body}</tbody>
    <tfoot><tr><td colspan="4" class="r"><b>Total</b></td><td class="r"><b>${qty(totalQty)}</b></td>${receiving?'<td></td><td></td>':''}<td></td><td class="r"><b>${totalVal.toFixed(2)}</b></td></tr></tfoot></table>
    ${(f.receiving_notes||f.transfer_notes)?`<p class="notes"><b>Notes:</b> ${esc(f.receiving_notes||f.transfer_notes)}</p>`:''}
    <div class="sign"><div>${receiving?'Received by':'Issued by'}: ______________________</div><div>${receiving?'Checked by':'Received by'}: ______________________</div><div>Signature / Date: ______________________</div></div></section>`;
  }).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${receiving?'Receiving':'Transfer'} Invoices ${esc(dateFmt(dateStr))}</title><style>
@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:12px}
.inv{page-break-after:always;break-after:page;padding:0}.inv:last-child{page-break-after:auto;break-after:auto}
header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:10px}
h1{margin:0;font-size:22px;letter-spacing:1px}.sub{font-size:14px;font-weight:bold;margin-top:4px}.ref{text-align:right;line-height:1.6}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-bottom:10px;line-height:1.6}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #888;padding:5px 6px;text-align:left;vertical-align:top}th{background:#eee}
.r{text-align:right}.c{text-align:center}tfoot td{background:#f5f5f5}thead{display:table-header-group}tr{page-break-inside:avoid}
.notes{margin-top:10px}.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:40px;font-size:11px}
</style></head><body>${pages||'<p>No transactions on this date.</p>'}</body></html>`);
  w.document.close();setTimeout(()=>{try{w.focus();w.print();}catch(e){}},500);
}

function renderDataTable(host,rows,columns,opt={}){
  const el=typeof host==='string'?$(host):host;const pageSize=opt.pageSize||50;const filters=opt.filters||[];let page=1,sortKey=opt.sortKey||'',sortDir=opt.sortDir||'asc';
  const storeKey='grid_'+(opt.filename||opt.title||'table');let saved={};try{saved=JSON.parse(localStorage.getItem(storeKey)||'{}')||{};}catch(e){}
  const hidden=new Set((saved.hidden||[]).filter(k=>columns.some(c=>c.key===k)));let dense=!!saved.dense,colFilterOn=false;const colFilter={};
  const persist=()=>{try{localStorage.setItem(storeKey,JSON.stringify({hidden:[...hidden],dense}));}catch(e){}};
  const visible=()=>{const v=columns.filter(c=>!hidden.has(c.key));return v.length?v:columns;};
  const filterValues=Object.fromEntries(filters.map(f=>[f.key,[...new Set(rows.map(r=>r[f.key]).filter(v=>v!==null&&v!==undefined&&v!==''))].sort()]));
  const hasTotals=opt.totals!==false&&columns.some(c=>['qty','money'].includes(c.type));
  const totalable=c=>['qty','money'].includes(c.type)&&!c.noTotal&&!/(unit_?(cost|price)|^cost$|price|threshold|reorder|alert|avg|average|rate|days)/i.test(c.key);
  el.innerHTML=`<div class="table-card"><div class="table-toolbar"><div class="table-filter"><input data-search placeholder="Search SKU, product, reference…">${filters.map(f=>`<select data-filter="${esc(f.key)}"><option value="">All ${esc(f.label)}</option>${filterValues[f.key].map(v=>`<option value="${esc(v)}">${esc(f.type==='location'?locationName(v):v)}</option>`).join('')}</select>`).join('')}</div><div class="table-actions"><div class="grid-menu"><button class="btn small-btn" data-cols>Columns ▾</button><div class="grid-pop hidden" data-colpop><div class="grid-pop-title">Show columns</div>${columns.map(c=>`<label><input type="checkbox" data-colchk="${esc(c.key)}" ${hidden.has(c.key)?'':'checked'}> ${esc(c.label)}</label>`).join('')}<button class="btn small-btn" data-colreset>Reset</button></div></div><button class="btn small-btn" data-cfbtn title="Filter each column">Filter row</button><button class="btn small-btn" data-dense title="Row density">Density</button><button class="btn small-btn" data-csv>CSV</button><button class="btn small-btn" data-xls>Excel</button><button class="btn small-btn" data-print>Print</button></div></div><div class="table-meta"><span data-count></span><div class="pager"><button class="btn small-btn" data-prev>‹</button><span data-page></span><button class="btn small-btn" data-next>›</button></div></div><div class="table-wrap"><table class="data-table ${dense?'dense':''}"><thead></thead><tbody></tbody><tfoot></tfoot></table></div></div>`;
  if(opt.defaults)$$('[data-filter]',el).forEach(sel=>{const d=opt.defaults[sel.dataset.filter];if(d!==undefined&&[...sel.options].some(o=>o.value===d))sel.value=d;});
  const table=$('table',el),thead=$('thead',el),tbody=$('tbody',el),tfoot=$('tfoot',el),search=$('[data-search]',el),count=$('[data-count]',el),pageLabel=$('[data-page]',el);
  const drawHead=()=>{const cols=visible();thead.innerHTML=`<tr>${cols.map(c=>`<th data-sort="${esc(c.key)}" class="${c.align==='right'?'num':''}">${esc(c.label)} <span class="sortmark"></span></th>`).join('')}</tr>${colFilterOn?`<tr class="filter-row">${cols.map(c=>`<th class="${c.align==='right'?'num':''}"><input data-cf="${esc(c.key)}" placeholder="filter" value="${esc(colFilter[c.key]||'')}"></th>`).join('')}</tr>`:''}`;
    $$('input[data-cf]',thead).forEach(i=>{i.oninput=()=>{colFilter[i.dataset.cf]=i.value.trim().toLowerCase();page=1;draw();};i.onclick=e=>e.stopPropagation();});};
  const getFiltered=()=>{const q=(search.value||'').trim().toLowerCase();const active=Object.fromEntries($$('[data-filter]',el).map(s=>[s.dataset.filter,s.value]));const cf=Object.entries(colFilter).filter(([,v])=>v);
    let out=rows.filter(r=>(!q||columns.some(c=>String(rawExportValue(r[c.key],c)).toLowerCase().includes(q)))&&Object.entries(active).every(([k,v])=>!v||String(r[k]??'')===v)&&cf.every(([k,v])=>{const col=columns.find(c=>c.key===k);return String(rawExportValue(r[k],col||{})).toLowerCase().includes(v);}));
    if(sortKey){const col=columns.find(c=>c.key===sortKey);out=[...out].sort((a,b)=>{const av=a[sortKey],bv=b[sortKey];let d;if(['money','qty'].includes(col?.type))d=Number(av||0)-Number(bv||0);else d=String(av??'').localeCompare(String(bv??''),undefined,{numeric:true});return sortDir==='asc'?d:-d;});}return out;};
  const draw=()=>{const cols=visible();const filtered=getFiltered();const pages=Math.max(1,Math.ceil(filtered.length/pageSize));if(page>pages)page=pages;const slice=filtered.slice((page-1)*pageSize,page*pageSize);count.textContent=`${filtered.length} rows`;pageLabel.textContent=`Page ${page} / ${pages}`;
    tbody.innerHTML=slice.length?slice.map(r=>`<tr${opt.onRow?` class="clickable" data-rk="${esc(String(r[opt.rowKey]))}"`:''}>${cols.map(c=>{const cc={...c,_row:r};return `<td class="${c.align==='right'?'num':''}">${tableCell(r[c.key],cc)}</td>`;}).join('')}</tr>`).join(''):`<tr><td colspan="${cols.length}" class="empty">No records found</td></tr>`;
    if(hasTotals&&filtered.length&&cols.some(totalable)){let labelDone=false;tfoot.innerHTML=`<tr class="grid-total">${cols.map(c=>{if(totalable(c)){const s=filtered.reduce((a,r)=>a+Number(r[c.key]||0),0);return `<td class="num">${c.type==='money'?money(s):qty(s)}</td>`;}if(!labelDone){labelDone=true;return `<td>Total · ${filtered.length} rows</td>`;}return '<td></td>';}).join('')}</tr>`;}else tfoot.innerHTML='';
    $('[data-prev]',el).disabled=page<=1;$('[data-next]',el).disabled=page>=pages;$$('th[data-sort]',el).forEach(th=>{const mark=$('.sortmark',th);mark.textContent=th.dataset.sort===sortKey?(sortDir==='asc'?'▲':'▼'):'';});};
  search.oninput=()=>{page=1;draw();};$$('[data-filter]',el).forEach(s=>s.onchange=()=>{page=1;draw();});$('[data-prev]',el).onclick=()=>{page--;draw();};$('[data-next]',el).onclick=()=>{page++;draw();};
  if(opt.onRow)tbody.onclick=e=>{const tr=e.target.closest('tr[data-rk]');if(!tr)return;const row=rows.find(x=>String(x[opt.rowKey])===tr.dataset.rk);if(row)opt.onRow(row);};
  thead.onclick=e=>{const th=e.target.closest('th[data-sort]');if(!th)return;const k=th.dataset.sort;if(sortKey===k)sortDir=sortDir==='asc'?'desc':'asc';else{sortKey=k;sortDir='asc';}draw();};
  const pop=$('[data-colpop]',el);$('[data-cols]',el).onclick=e=>{e.stopPropagation();$$('.grid-pop').forEach(p=>{if(p!==pop)p.classList.add('hidden');});pop.classList.toggle('hidden');};pop.onclick=e=>e.stopPropagation();
  $$('[data-colchk]',el).forEach(c=>c.onchange=()=>{if(c.checked)hidden.delete(c.dataset.colchk);else{if(columns.length-hidden.size<=1){c.checked=true;return;}hidden.add(c.dataset.colchk);}persist();drawHead();draw();});
  $('[data-colreset]',el).onclick=()=>{hidden.clear();$$('[data-colchk]',el).forEach(c=>c.checked=true);persist();drawHead();draw();};
  $('[data-cfbtn]',el).onclick=()=>{colFilterOn=!colFilterOn;if(!colFilterOn)Object.keys(colFilter).forEach(k=>delete colFilter[k]);$('[data-cfbtn]',el).classList.toggle('on',colFilterOn);drawHead();draw();};
  $('[data-dense]',el).onclick=()=>{dense=!dense;table.classList.toggle('dense',dense);persist();};
  if(!window.__gridPopBound){window.__gridPopBound=true;document.addEventListener('click',()=>$$('.grid-pop').forEach(p=>p.classList.add('hidden')));}
  const exportCols=()=>visible();
  $('[data-csv]',el).onclick=()=>exportRowsCsv(getFiltered(),exportCols(),opt.filename||'joffreys-report');$('[data-xls]',el).onclick=()=>exportRowsExcel(getFiltered(),exportCols(),opt.filename||'joffreys-report');$('[data-print]',el).onclick=()=>printRows(getFiltered(),exportCols(),opt.title||'Joffrey’s Bakery Report');drawHead();draw();
}

function dashboardFilterHtml(){const range=periodRange();return `<div class="period-bar"><div class="period-select"><label>Period<select id="dashPreset"><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="this_week">This Week</option><option value="last_7">Last 7 Days</option><option value="this_month">This Month</option><option value="last_month">Last Month</option><option value="custom">Custom Range</option></select></label><div id="dashCustom" class="custom-range ${state.dashboardPreset==='custom'?'':'hidden'}"><label>From<input id="dashFrom" type="date" value="${esc(range.from)}"></label><label>To<input id="dashTo" type="date" value="${esc(range.to)}"></label><button id="dashApply" class="btn">Apply</button></div></div><div class="period-caption">${dateFmt(range.from)} — ${dateFmt(range.to)}</div></div>`;}


function ensureDashboardProStyles(){
  if($('#dashboardProStyles'))return;
  const s=document.createElement('style');s.id='dashboardProStyles';s.textContent=`
    .dash-pro-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:14px}
    .dash-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:18px 0 9px}.dash-section-head h3{margin:0;font-size:15px}.dash-section-head span{font-size:11px;color:var(--muted)}
    .kpi-card.blue{border-left:4px solid var(--receiving);background:linear-gradient(90deg,#eff6ff,#fff 36%)}
    .kpi-card.purple{border-left:4px solid var(--transfer);background:linear-gradient(90deg,#eef2ff,#fff 36%)}
    .kpi-card.neutral{border-left:4px solid var(--neutral)}
    .attention-panel{background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:14px}
    .attention-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line);background:#fff}.attention-head strong{font-size:13px}.attention-head span{font-size:11px;color:var(--muted)}
    .attention-list{display:grid}.attention-row{display:grid;grid-template-columns:10px minmax(180px,1.6fr) minmax(180px,1fr) auto;gap:10px;align-items:center;padding:10px 14px;border-bottom:1px solid #eef2f7;font-size:11px}.attention-row:last-child{border-bottom:0}.attention-dot{width:8px;height:8px;border-radius:50%}.attention-title{font-weight:760;color:#1e293b;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.attention-meta{color:var(--muted);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.attention-empty{padding:20px;text-align:center;color:var(--muted);font-size:12px}
    .dual-trend{height:215px;display:flex;gap:7px;align-items:stretch;overflow-x:auto;padding:4px 2px 0}.dual-col{min-width:52px;flex:1;display:grid;grid-template-rows:28px 1fr 34px;align-items:end;text-align:center;color:var(--muted);font-size:9px}.dual-values{display:flex;justify-content:center;gap:5px;font-size:9px;color:#475569}.dual-bars{height:100%;min-height:100px;border-bottom:1px solid #cbd5e1;display:flex;align-items:flex-end;justify-content:center;gap:4px}.dual-bar{width:min(16px,34%);border-radius:4px 4px 0 0;min-height:0}.dual-label{padding-top:6px;line-height:1.15;white-space:normal;overflow:hidden}.dual-legend{display:flex;gap:14px;align-items:center;margin:-4px 0 10px;font-size:10px;color:var(--muted)}.dual-legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px}
    .chart-note{font-size:10px;color:var(--muted);margin:-8px 0 10px}
    .hbar-fill.zero{min-width:0!important;width:0!important}.trend-bar.zero,.dual-bar.zero{min-height:0!important;height:0!important}
    .trend-scaled{display:grid;grid-template-columns:42px minmax(0,1fr);gap:6px;align-items:stretch}.trend-yaxis{height:215px;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;padding:31px 0 31px;color:var(--muted);font-size:9px;font-variant-numeric:tabular-nums}.chart-empty{min-height:190px;display:grid;place-items:center}
    @media(max-width:620px){.trend-scaled{grid-template-columns:36px minmax(0,1fr)}.trend-yaxis{font-size:8px}.chart-empty{min-height:155px}}
    @media(max-width:1350px){.dash-pro-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:900px){.dash-pro-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.attention-row{grid-template-columns:10px minmax(0,1fr) auto}.attention-meta{grid-column:2/4;white-space:normal}}
    @media(max-width:620px){.dash-pro-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.dash-section-head{align-items:flex-start;flex-direction:column;gap:3px}.attention-row{grid-template-columns:10px minmax(0,1fr);gap:7px}.attention-meta{grid-column:2}.attention-row .btn{grid-column:2;justify-self:start}.dual-col{min-width:48px}}
    @media(max-width:390px){.dash-pro-kpis{grid-template-columns:1fr 1fr}.kpi-label{font-size:9px}.kpi-value{font-size:17px}}
  `;document.head.appendChild(s);
}

function dualTrendChart(title,items,inLabel='Qty In',outLabel='Qty Out',outColor=COLORS.waste){
  const max=Math.max(0,...items.flatMap(x=>[Number(x.inValue||0),Number(x.outValue||0)]));
  if(!items.length||max<=0)return `<div class="chart-card"><div class="chart-title">${esc(title)}</div><div class="dual-legend"><span><i style="background:${COLORS.receiving}"></i>${esc(inLabel)}</span><span><i style="background:${outColor}"></i>${esc(outLabel)}</span></div><div class="empty chart-empty">No activity in selected period</div></div>`;
  const mid=max/2;
  const bars=items.map(x=>{const iv=Number(x.inValue||0),ov=Number(x.outValue||0),ih=iv>0?iv/max*100:0,oh=ov>0?ov/max*100:0;return `<div class="dual-col" title="${esc(x.label)} · ${esc(inLabel)} ${qty(iv)} · ${esc(outLabel)} ${qty(ov)}"><div class="dual-values"><span>${qty(iv)}</span><span>${qty(ov)}</span></div><div class="dual-bars"><div class="dual-bar${iv<=0?' zero':''}" style="height:${ih}%;background:${COLORS.receiving}"></div><div class="dual-bar${ov<=0?' zero':''}" style="height:${oh}%;background:${outColor}"></div></div><div class="dual-label">${esc(x.label)}</div></div>`;}).join('');
  return `<div class="chart-card"><div class="chart-title">${esc(title)}</div><div class="dual-legend"><span><i style="background:${COLORS.receiving}"></i>${esc(inLabel)}</span><span><i style="background:${outColor}"></i>${esc(outLabel)}</span></div><div class="trend-scaled"><div class="trend-yaxis"><span>${qty(max)}</span><span>${qty(mid)}</span><span>0</span></div><div class="dual-trend">${bars}</div></div></div>`;
}

function aggregateProductPositions(rows){
  const m=new Map();
  for(const r of rows||[]){
    const key=r.product_id;
    if(!m.has(key))m.set(key,{product_id:key,product_name:r.product_name,product_code:r.product_code,category_name:r.category_name,supplier_name:r.supplier_name,quantity:0,value:0});
    const x=m.get(key);x.quantity+=Number(r.available_quantity||0);x.value+=Number(r.stock_value||0);
  }
  return [...m.values()];
}

function dashboardAttentionHtml(lowRows,outRows,missingBatches,missingUnits){
  const rows=[];
  for(const r of lowRows)rows.push({color:COLORS.low,title:`${r.product_name} (${r.product_code})`,meta:`${qty(r.available_quantity)} PCS · reorder ${qty(r.reorder_threshold)} · ${r.supplier_name||'—'}`,page:'stock',action:'Open Stock'});
  for(const r of outRows)rows.push({color:COLORS.out,title:`${r.product_name} (${r.product_code})`,meta:`Out of stock · reorder ${qty(r.reorder_threshold)} · ${r.supplier_name||'—'}`,page:'stock',action:'Open Stock'});
  if(missingBatches>0)rows.push({color:COLORS.out,title:`${qty(missingBatches)} live batches missing expiry`,meta:`${qty(missingUnits)} units affected · enter only real label dates`,page:'expiry',action:'Open Expiry'});
  return `<div class="attention-panel"><div class="attention-head"><strong>Operations Attention</strong><span>${rows.length} items requiring review</span></div>${rows.length?`<div class="attention-list">${rows.map(r=>`<div class="attention-row"><i class="attention-dot" style="background:${r.color}"></i><div class="attention-title">${esc(r.title)}</div><div class="attention-meta">${esc(r.meta)}</div><button class="btn small-btn" data-attention-page="${r.page}">${esc(r.action)}</button></div>`).join('')}</div>`:'<div class="attention-empty">No attention items in current stock.</div>'}</div>`;
}

const AUDIT_BASELINE_DATE='2026-09-30';
const AUDIT_OPENING_STOCK={
  'english dates cake':45,'english lemon cake':55,'tiramisu':30,'carrot cake':10,'carrot cheesecake':10,'sacher cake':40,
  'blueberry cheese cake':36,'lotus cheese cake':24,'croissant chocolate':26,'croissant plain':28,'croissant white cheese':90,'croissant cheese yellow':90,
  'cookies chocolate':297,'cookies vanilla':545,'muffin chocolate':38,'muffin blueberry':13,'halloumi pesto baguette':31,'fajita wrap':163,
  'turkey cheese baguette':48,'fajita small':95,'turkey cheese small':25,'tuna small':25,'halloumi small':15,
  'ranch club':30,'caesar club':30,'3 cheese club':30,'lotus pudding':5,'kunafa pudding':5,'cookies pudding':5,'chocolate pudding':5,
  'ice cream chocolate':15
};
async function loadClosingCounts(){
  state.closing={};state.closingByName=null;
  try{
    const {data,error}=await supabase.from('closing_counts').select('branch_id,product_id,quantity').eq('count_date',AUDIT_BASELINE_DATE).limit(5000);
    if(error)throw error;
    for(const r of data||[]){(state.closing[r.branch_id]||(state.closing[r.branch_id]={}))[r.product_id]=Number(r.quantity);}
    const wh=state.warehouse?.id;const names=new Map((state.allProducts||[]).map(p=>[Number(p.id),p.name]));
    if(wh&&state.closing[wh]){state.closingByName={};for(const [pid,q] of Object.entries(state.closing[wh])){const n=names.get(Number(pid));if(n)state.closingByName[String(n).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()]=q;}}
  }catch(e){console.warn('Closing counts not loaded',e);}
}
function closingFor(branchId,productId,productName){
  const b=state.closing?.[branchId];
  if(b&&Object.prototype.hasOwnProperty.call(b,productId))return b[productId];
  if(b&&Object.keys(b).length)return null;           // this location has counts, this product was not counted
  return branchId===state.warehouse?.id?auditBaseline(productName):null;
}
function auditBaseline(productName){
  const key=String(productName||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  // Once verified closing counts exist in Supabase, they are the source of truth.
  // Never silently substitute an older hardcoded value for a product not counted.
  if(state.closingByName){
    if(Object.prototype.hasOwnProperty.call(state.closingByName,key))return state.closingByName[key];
    return null;
  }
  // Legacy fallback is used only when no persisted closing-count set is available.
  if(Object.prototype.hasOwnProperty.call(AUDIT_OPENING_STOCK,key))return AUDIT_OPENING_STOCK[key];
  const aliases={'turkey and cheese baguette':'turkey cheese baguette','three cheese club':'3 cheese club','blueberry cheesecake':'blueberry cheese cake','lotus cheesecake':'lotus cheese cake','3 cheese club sandwich':'3 cheese club','caesar chicken club sandwich':'caesar club','chicken ranch club sandwich':'ranch club','chicken fajita sandwich small':'fajita small','chicken fajita wrap':'fajita wrap','halloumi sandwich small':'halloumi small','tuna sandwich small':'tuna small','turkey cheese sandwich small':'turkey cheese small'};
  const alias=aliases[key];return alias&&Object.prototype.hasOwnProperty.call(AUDIT_OPENING_STOCK,alias)?AUDIT_OPENING_STOCK[alias]:null;
}
async function loadAuditDifferenceRows(toDate=isoToday()){
  const from=AUDIT_BASELINE_DATE;
  const [rr,tr,wr,ar]=await Promise.all([
    supabase.from('v_daily_receiving_report').select('date,branch_id,product_id,product_code,product_name,quantity').eq('branch_id',1).gte('date',from).lte('date',toDate),
    supabase.from('v_daily_transfer_report').select('date,from_branch_id,to_branch_id,product_id,product_code,product_name,quantity').or('from_branch_id.eq.1,to_branch_id.eq.1').gte('date',from).lte('date',toDate),
    supabase.from('waste').select('waste_date,product_id,quantity').eq('branch_id',1).eq('status','COMPLETED').gte('waste_date',from).lte('waste_date',toDate),
    supabase.from('adjustments').select('adjustment_date,product_id,quantity_change').eq('branch_id',1).gte('adjustment_date',from).lte('adjustment_date',toDate)
  ]);
  for(const r of [rr,tr,wr,ar])if(r.error)throw r.error;
  const products=new Map();
  const add=(id,name,code)=>{if(!products.has(Number(id)))products.set(Number(id),{product_id:Number(id),product_name:name||'Unknown product',product_code:code||'—',received:0,transferred:0,waste:0,adjustments:0});else{const p=products.get(Number(id));if(!p.product_code||p.product_code==='—')p.product_code=code||'—';}};
  for(const p of state.positions.filter(x=>x.branch_name==='Warehouse'))add(p.product_id,p.product_name,p.product_code);
  for(const r of rr.data||[]){add(r.product_id,r.product_name,r.product_code);products.get(Number(r.product_id)).received+=Number(r.quantity||0);}
  for(const r of tr.data||[]){add(r.product_id,r.product_name,r.product_code);const p=products.get(Number(r.product_id));if(Number(r.from_branch_id)===1)p.transferred+=Number(r.quantity||0);if(Number(r.to_branch_id)===1)p.transferred-=Number(r.quantity||0);}
  for(const r of wr.data||[]){if(products.has(Number(r.product_id)))products.get(Number(r.product_id)).waste+=Number(r.quantity||0);}
  for(const r of ar.data||[]){if(products.has(Number(r.product_id)))products.get(Number(r.product_id)).adjustments+=Number(r.quantity_change||0);}
  return [...products.values()].map(p=>{
    const opening=auditBaseline(p.product_name);
    const actual=Number(state.positions.find(x=>x.branch_name==='Warehouse'&&Number(x.product_id)===p.product_id)?.available_quantity||0);
    const difference=p.received-p.transferred;
    const expected=opening===null?null:opening+p.received-p.transferred-p.waste+p.adjustments;
    return {...p,opening,audit_difference:difference,expected,actual,variance:expected===null?null:actual-expected};
  }).sort((a,b)=>a.product_name.localeCompare(b.product_name));
}

const countsState={branch:null};
async function loadCompareRows(from,to,branchId=1){
  const base=AUDIT_BASELINE_DATE;
  const [rr,tr,wr,ar]=await Promise.all([
    supabase.from('v_daily_receiving_report').select('date,product_id,product_code,product_name,quantity').eq('branch_id',branchId).gte('date',base).lte('date',to).limit(20000),
    supabase.from('v_daily_transfer_report').select('date,from_branch_id,to_branch_id,product_id,product_code,product_name,quantity').or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`).gte('date',base).lte('date',to).limit(20000),
    supabase.from('waste').select('waste_date,product_id,quantity').eq('branch_id',branchId).eq('status','COMPLETED').gte('waste_date',base).lte('waste_date',to).limit(20000),
    supabase.from('adjustments').select('adjustment_date,product_id,quantity_change').eq('branch_id',branchId).gte('adjustment_date',base).lte('adjustment_date',to).limit(20000)
  ]);
  for(const r of [rr,tr,wr,ar])if(r.error)throw r.error;
  const m=new Map();
  const get=(id,name,code)=>{id=Number(id);if(!m.has(id))m.set(id,{product_id:id,branch_id:branchId,product_name:name||'Unknown',product_code:code||'—',pre:0,received:0,transferred:0,waste:0,adjustments:0});const p=m.get(id);if(name&&p.product_name==='Unknown')p.product_name=name;if(code&&p.product_code==='—')p.product_code=code;return p;};
  const here=state.positions.filter(x=>Number(x.branch_id)===Number(branchId));
  for(const p of here)get(p.product_id,p.product_name,p.product_code);
  // before From a movement shifts the opening, otherwise it is a period movement
  const add=(p,f,d,v)=>{if(String(d).slice(0,10)<from)p.pre+=(f==='received'||f==='adjustments'?v:-v);else p[f]+=v;};
  for(const r of rr.data||[])add(get(r.product_id,r.product_name,r.product_code),'received',r.date,Number(r.quantity||0));
  for(const r of tr.data||[]){const p=get(r.product_id,r.product_name,r.product_code),q=Number(r.quantity||0);
    if(Number(r.from_branch_id)===Number(branchId))add(p,'transferred',r.date,q);
    if(Number(r.to_branch_id)===Number(branchId))add(p,'received',r.date,q);}
  for(const r of wr.data||[])if(m.has(Number(r.product_id)))add(m.get(Number(r.product_id)),'waste',r.waste_date,Number(r.quantity||0));
  for(const r of ar.data||[])if(m.has(Number(r.product_id)))add(m.get(Number(r.product_id)),'adjustments',r.adjustment_date,Number(r.quantity_change||0));
  return [...m.values()].map(p=>{
    const b=closingFor(Number(branchId),p.product_id,p.product_name);
    const closing=b===null?null:b+p.pre;
    const available=closing===null?null:closing+p.received-p.transferred-p.waste+p.adjustments;
    const current=here.find(x=>Number(x.product_id)===p.product_id);
    const system=current?Number(current.available_quantity||0):null;
    return {...p,closing,available,system,diff:system===null||available===null?null:system-available,nobase:b===null};
  }).filter(r=>r.closing!==null&&Math.abs(r.closing)>0||r.received||r.transferred||r.waste||r.adjustments||r.system!==null).sort((a,b)=>a.product_name.localeCompare(b.product_name));
}
async function showProductHistory(r){
  const BR=Number(r.branch_id||1);openModal(`${r.product_name} — history`,`${locationName((state.branches.find(x=>Number(x.id)===BR)||{}).name||'')} · ${r.product_code||''}`,`<div class="panel loading">Loading history…</div>`,'wide');
  try{
    const id=r.product_id,base=AUDIT_BASELINE_DATE;
    const [rr,tr,wr,ar]=await Promise.all([
      supabase.from('v_daily_receiving_report').select('date,reference_no,invoice_no,quantity,created_at').eq('branch_id',BR).eq('product_id',id).gte('date',base).limit(5000),
      supabase.from('v_daily_transfer_report').select('date,reference_no,from_branch_id,to_branch_id,quantity,created_at').eq('product_id',id).or(`from_branch_id.eq.${BR},to_branch_id.eq.${BR}`).gte('date',base).limit(5000),
      supabase.from('waste').select('waste_date,quantity,created_at').eq('branch_id',BR).eq('product_id',id).eq('status','COMPLETED').gte('waste_date',base).limit(5000),
      supabase.from('adjustments').select('adjustment_date,quantity_change,created_at').eq('branch_id',BR).eq('product_id',id).gte('adjustment_date',base).limit(5000)
    ]);
    for(const x of [rr,tr,wr,ar])if(x.error)throw x.error;
    const ev=[];const b=closingFor(BR,id,r.product_name);
    ev.push({date:base,ord:0,type:'Closing 30/09',ref:'',delta:b===null?0:b});
    for(const x of rr.data||[])ev.push({date:String(x.date).slice(0,10),ord:1,type:'Received',ref:x.invoice_no||x.reference_no||'',delta:Number(x.quantity||0),at:x.created_at});
    for(const x of tr.data||[]){const out=Number(x.from_branch_id)===BR;ev.push({date:String(x.date).slice(0,10),ord:2,type:out?'Transferred out':'Transferred in',ref:x.reference_no||'',delta:out?-Number(x.quantity||0):Number(x.quantity||0),at:x.created_at});}
    for(const x of wr.data||[])ev.push({date:String(x.waste_date).slice(0,10),ord:3,type:'Waste',ref:'',delta:-Number(x.quantity||0),at:x.created_at});
    for(const x of ar.data||[])ev.push({date:String(x.adjustment_date).slice(0,10),ord:4,type:'Adjustment',ref:'',delta:Number(x.quantity_change||0),at:x.created_at});
    ev.sort((a,c)=>a.date.localeCompare(c.date)||a.ord-c.ord||String(a.at||'').localeCompare(String(c.at||'')));
    let bal=0;const rows=ev.map((e,i)=>{bal+=e.delta;return {n:i+1,date:e.date,type:e.type,ref:e.ref,in_qty:e.delta>0?e.delta:0,out_qty:e.delta<0?-e.delta:0,balance:bal};});
    const sys=Number(state.positions.find(x=>Number(x.branch_id)===BR&&Number(x.product_id)===Number(id))?.available_quantity||0);
    modalBody.innerHTML=`<div class="kpi-grid kpi-grid-3">${kpi('Calculated stock',qty(bal),'Closing + received − transferred − waste ± adjustments')}${kpi('System stock',qty(sys),'Current system stock')}${kpi('Difference',(sys-bal>0?'+':'')+qty(sys-bal),Math.abs(sys-bal)<0.00001?'Matches':'Needs review')}</div><div id="phTable"></div>`;
    renderDataTable('#phTable',rows,[{key:'n',label:'#',align:'right',noTotal:true},{key:'date',label:'Date',type:'date'},{key:'type',label:'Type'},{key:'ref',label:'Reference'},{key:'in_qty',label:'In',type:'qty',align:'right'},{key:'out_qty',label:'Out',type:'qty',align:'right'},{key:'balance',label:'Balance',type:'qty',align:'right',noTotal:true}],{filename:`joffreys-history-${r.product_code||id}`,title:`${r.product_name} history`,pageSize:200,sortKey:'n',sortDir:'asc'});
  }catch(e){modalBody.innerHTML=`<div class="panel empty">History could not load: ${esc(e?.message||String(e))}</div>`;}
}

function openExpiryQuick(kind){
  const live=(state.expiry||[]).filter(x=>Number(x.remaining_quantity)>0&&x.expiry_date);
  const rows=live.filter(x=>kind==='expired'?Number(x.days_until_expiry)<0:Number(x.days_until_expiry)>=0&&Number(x.days_until_expiry)<=3).map(x=>({...x}));
  const units=rows.reduce((a,x)=>a+Number(x.remaining_quantity||0),0);
  openModal(kind==='expired'?'Expired batches':'Expiring within 3 days',`${qty(units)} units in ${rows.length} batches — record waste for what cannot be sold`,`<div class="page-actions"><button class="btn primary" id="eqWaste" ${canPost()?'':'disabled'}>♲ Record Waste</button><button class="btn" id="eqPage">Open full Expiry page</button></div><div id="eqTable"></div>`,'wide');
  $('#eqWaste').onclick=()=>{closeModal();openWaste();};$('#eqPage').onclick=()=>{closeModal();go('expiry');};
  renderDataTable('#eqTable',rows,[{key:'product_name',label:'Product'},{key:'branch_name',label:'Location',type:'location'},{key:'batch_no',label:'Batch'},{key:'remaining_quantity',label:'Qty',type:'qty',align:'right'},{key:'expiry_date',label:'Expiry',type:'date'},{key:'days_until_expiry',label:'Days',type:'qty',align:'right',noTotal:true}],{filename:`joffreys-expiry-${kind}`,title:kind==='expired'?'Expired batches':'Expiring within 3 days',pageSize:50,sortKey:'expiry_date'});
}
async function printDailyReport(){
  const day=isoToday();
  try{
    const [rr,tr]=await Promise.all([
      supabase.from('v_daily_receiving_report').select('*').eq('date',day).limit(5000),
      supabase.from('v_daily_transfer_report').select('*').eq('date',day).limit(5000)
    ]);
    if(rr.error)throw rr.error;if(tr.error)throw tr.error;
    const R=groupDocs(rr.data||[],'receiving'),T=groupDocs(tr.data||[],'transfer');
    const wh=state.positions.filter(x=>x.branch_name==='Warehouse'),sh=state.positions.filter(x=>x.branch_name!=='Warehouse');
    const sumq=(a,k)=>a.reduce((t,x)=>t+Number(x[k]||0),0);
    const live=(state.expiry||[]).filter(x=>Number(x.remaining_quantity)>0&&x.expiry_date);
    const expired=live.filter(x=>Number(x.days_until_expiry)<0),soon=live.filter(x=>Number(x.days_until_expiry)>=0&&Number(x.days_until_expiry)<=3);
    const low=wh.filter(x=>x.stock_status==='Low Stock'),out=wh.filter(x=>x.stock_status==='Out of Stock');
    const tbl=(head,body)=>`<table><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body||`<tr><td colspan="${head.length}" style="color:#666">None</td></tr>`}</tbody></table>`;
    const docRows=(a,k)=>a.map(d=>`<tr><td>${esc(d.ref)}</td><td>${esc(locationName(d.from))} → ${esc(locationName(d.to))}</td><td class="n">${d.line_count}</td><td class="n">${qty(d.qty)}</td><td class="n">${money(d.value)}</td></tr>`).join('');
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Daily Report ${esc(dateFmt(day))}</title><style>@page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;color:#111;font-size:11px}h1{font-size:20px;margin:0}h2{font-size:13px;margin:16px 0 6px;border-bottom:2px solid #111;padding-bottom:3px}.k{display:flex;gap:10px;margin:12px 0}.k div{flex:1;border:1px solid #bbb;border-radius:6px;padding:8px}.k span{display:block;color:#555;font-size:10px}.k strong{font-size:16px}table{border-collapse:collapse;width:100%;margin-bottom:6px}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left}th{background:#eee}td.n{text-align:right}</style></head><body>
<h1>Joffrey’s Bakery Jeddah — Daily Report</h1><div>${esc(dateFmt(day))} · printed ${esc(dateTimeFmt(new Date().toISOString()))}</div>
<div class="k"><div><span>Warehouse stock</span><strong>${qty(sumq(wh,'available_quantity'))}</strong></div><div><span>Shops stock</span><strong>${qty(sumq(sh,'available_quantity'))}</strong></div><div><span>Inventory value</span><strong>${money(sumq(state.positions,'stock_value'))}</strong></div><div><span>Received today</span><strong>${qty(sumq(R,'qty'))}</strong></div><div><span>Transferred today</span><strong>${qty(sumq(T,'qty'))}</strong></div></div>
<h2>Receiving today (${R.length})</h2>${tbl(['Document','Supplier → Location','Lines','Qty','Value'],docRows(R))}
<h2>Transfers today (${T.length})</h2>${tbl(['Document','From → To','Lines','Qty','Value'],docRows(T))}
<h2>Expiry</h2>${tbl(['Item','Units'],`<tr><td>Expired</td><td class="n">${qty(sumq(expired,'remaining_quantity'))}</td></tr><tr><td>Expiring within 3 days</td><td class="n">${qty(sumq(soon,'remaining_quantity'))}</td></tr>`)}
<h2>Warehouse stock alerts</h2>${tbl(['Product','Status','Available'],[...out,...low].map(x=>`<tr><td>${esc(x.product_name)}</td><td>${esc(x.stock_status)}</td><td class="n">${qty(x.available_quantity)}</td></tr>`).join(''))}
</body></html>`;
    const w=window.open('','_blank');if(!w)return toast('Allow pop-ups to print','error');
    w.document.write(html);w.document.close();setTimeout(()=>{try{w.focus();w.print();}catch(e){}},400);
  }catch(e){fail(e,'Report failed');}
}
function auditDifferencePanel(id,title='Quick Find — Audit Difference',toDate=isoToday()){
  return `<section class="panel audit-quick-panel"><div class="dash-section-head"><h3>${esc(title)}</h3><span>Bakery Warehouse · 30/09/2026 — ${esc(dateFmt(toDate))}</span></div><div class="audit-quick-controls"><label>Quick find product<input id="${id}Search" type="search" placeholder="Type product name or SKU…"></label><button id="${id}Refresh" class="btn">Refresh audit</button></div><p class="muted small" id="${id}Note">Loading real receiving, transfer, waste, adjustment and current-stock records…</p><div id="${id}Table" class="table-wrap"><div class="panel loading">Loading audit data…</div></div></section>`;
}
async function wireAuditDifferencePanel(id,toDate=isoToday()){
  const search=$('#'+id+'Search'),host=$('#'+id+'Table'),note=$('#'+id+'Note'),refresh=$('#'+id+'Refresh');
  if(!search||!host||!note||!refresh)return;
  let rows=[];
  const draw=()=>{
    const q=search.value.trim().toLowerCase();
    const found=rows.filter(r=>!q||[r.product_name,r.product_code].some(v=>String(v||'').toLowerCase().includes(q)));
    const cols=[['product_code','SKU'],['product_name','Product'],['opening','Opening'],['received','Received'],['transferred','Transferred'],['audit_difference','Received − transferred'],['expected','Expected stock'],['actual','Actual stock'],['variance','Variance']];
    host.innerHTML=`<table class="data-table"><thead><tr>${cols.map(c=>`<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${found.length?found.map(r=>`<tr>${cols.map(([k])=>{const v=r[k];let s=v===null?'Baseline missing':qty(v);if(k==='product_name')s=esc(v);if(k==='product_code')s=esc(v);if(k==='variance'&&v!==null)s=(v>0?'+':'')+qty(v);return `<td class="${['opening','received','transferred','audit_difference','expected','actual','variance'].includes(k)?'num':''} ${k==='variance'&&v!==null&&Math.abs(v)>0.00001?'audit-variance':''}">${s}</td>`;}).join('')}</tr>`).join(''):`<tr><td colspan="${cols.length}" class="empty">No matching products.</td></tr>`}</tbody></table>`;
    note.textContent=`${found.length} products · received minus transferred is shown separately from stock variance. “Baseline missing” means the 30/09 opening count is not recorded in the app's verified baseline list.`;
  };
  const load=async()=>{refresh.disabled=true;note.textContent='Refreshing live Supabase records…';try{rows=await loadAuditDifferenceRows(toDate);draw();}catch(e){host.innerHTML=`<div class="panel empty">Audit could not load: ${esc(e?.message||String(e))}</div>`;note.textContent='Check access to receiving, transfer, waste and adjustment records.';}finally{refresh.disabled=false;}};
  search.oninput=draw;refresh.onclick=load;await load();
}
const WHOLE_CAKE_PIECES=10;
async function fileToBase64(file,maxSide=1800){
  const bmp=await createImageBitmap(file);const sc=Math.min(1,maxSide/Math.max(bmp.width,bmp.height));
  const c=document.createElement('canvas');c.width=Math.round(bmp.width*sc);c.height=Math.round(bmp.height*sc);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',0.85).split(',')[1];
}
async function scanInvoiceFlow(){
  const f=$('#scanFile').files[0];const out=$('#scanOut');if(!f)return toast('Choose an invoice photo first','error');
  out.innerHTML='<p class="muted">Reading invoice…</p>';
  try{
    const image=await fileToBase64(f);
    const {data:prods}=await supabase.from('products').select('id,product_code,name,unit_cost').eq('is_active',true);
    const {data,error}=await supabase.functions.invoke('scan-invoice',{body:{image,products:(prods||[]).map(p=>({id:p.id,code:p.product_code,name:p.name}))}});
    if(error)throw error;if(data?.error)throw new Error(data.error);
    renderScanReview(data,prods||[]);
  }catch(e){out.innerHTML=`<p class="error-text">Could not read the invoice: ${esc(e.message||e)}</p>`;}
}
function renderScanReview(d,prods){
  const out=$('#scanOut');const date=d.date||new Date().toISOString().slice(0,10);
  const addDays=(ds,n)=>{const x=new Date(ds+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
  const lines=(d.lines||[]).map(l=>{const p=prods.find(p=>p.id===l.product_id);const whole=/^j-/i.test(l.invoice_code||'');const muffin=/muffin/i.test(p?.name||'');
    return {product_id:l.product_id,name:p?.name||'⚠ not matched',invoice_name:l.invoice_name,qty:whole?Number(l.quantity)*WHOLE_CAKE_PIECES:Number(l.quantity),cost:whole?Number(l.unit_price)/WHOLE_CAKE_PIECES:Number(l.unit_price),expiry:addDays(date,muffin?60:6),whole};});
  out.innerHTML=`<div class="form-grid"><label>Invoice No<input id="scInv" value="${esc(d.invoice_no||'')}"></label><label>Date<input id="scDate" type="date" value="${esc(date)}"></label></div>
    <div class="table-card"><table class="data-table"><thead><tr><th>Invoice item</th><th>Matched product</th><th>Qty</th><th>Unit cost</th><th>Expiry</th></tr></thead><tbody>${lines.map((l,i)=>`<tr data-i="${i}"><td>${esc(l.invoice_name||'')}${l.whole?' <span class="pill">whole cake ×'+WHOLE_CAKE_PIECES+'</span>':''}</td><td>${esc(l.name)}</td><td><input class="sc-qty" type="number" step="any" value="${l.qty}"></td><td><input class="sc-cost" type="number" step="any" value="${l.cost}"></td><td><input class="sc-exp" type="date" value="${l.expiry}"></td></tr>`).join('')}</tbody></table></div>
    <p class="small muted">Supplier: Devon · Location: Bakery Warehouse. Invoice total read: ${money(d.total_before_vat)} (before VAT). Check it equals the sum below.</p>
    <p id="scSum" class="small"></p><button class="btn primary" id="scPost">Confirm &amp; post receiving</button>`;
  const sum=()=>{let t=0;$$('tr[data-i]',out).forEach(r=>t+=Number($('.sc-qty',r).value||0)*Number($('.sc-cost',r).value||0));$('#scSum').textContent='Receiving value: '+money(t);};
  out.addEventListener('input',sum);sum();
  $('#scPost').onclick=async()=>{
    const items=$$('tr[data-i]',out).map(r=>{const l=lines[+r.dataset.i];return {product_id:l.product_id,quantity:Number($('.sc-qty',r).value),unit_cost:Number($('.sc-cost',r).value),expiry_date:$('.sc-exp',r).value};});
    if(items.some(i=>!i.product_id))return toast('Some lines are not matched to a product','error');
    const inv=$('#scInv').value.trim();if(!inv)return toast('Invoice number is required','error');
    const {data:wh}=await supabase.from('branches').select('id').eq('name','Warehouse').single();
    const {data:sup}=await supabase.from('suppliers').select('id').eq('name','Devon').single();
    const {error}=await supabase.rpc('post_receiving',{p_received_date:$('#scDate').value,p_reference_no:inv,p_invoice_no:inv,p_supplier_id:sup.id,p_branch_id:wh.id,p_items:items,p_notes:'Devon invoice '+inv,p_posting_key:crypto.randomUUID()});
    if(error)return toast(error.message,'error');toast('Receiving posted');go('receiving');
  };
}

function dashSwitch(cur){
  return `<div class="seg"><button class="${cur==='overview'?'on':''}" data-dv="overview">Overview</button><button class="${cur==='retool'?'on':''}" data-dv="retool">Retool view</button></div>`;
}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.seg [data-dv]');if(!b)return;state.dashView=b.dataset.dv;try{localStorage.setItem('dashView',state.dashView);}catch(_){}go('dashboard');});
try{state.dashView=localStorage.getItem('dashView')||'overview';}catch(_){state.dashView='overview';}

async function dashboardRetool(){
  const today=isoToday();const from0='2026-09-30';
  state.rt=state.rt||{from:from0,to:today,loc:'all',tab:'stock'};const rt=state.rt;rt.to=today>rt.to?rt.to:rt.to;
  const whId=(state.branches.find(b=>b.name==='Warehouse')||{}).id||1;
  const [rcv,trf,varR,snapR]=await Promise.all([
    supabase.from('v_daily_receiving_report').select('*').gte('date',rt.from).lte('date',rt.to).order('date',{ascending:false}).limit(5000),
    supabase.from('v_daily_transfer_report').select('*').gte('date',rt.from).lte('date',rt.to).order('date',{ascending:false}).limit(5000),
    supabase.rpc('variance_report',{p_branch_id:whId}),
    supabase.from('daily_stock_snapshots').select('snapshot_date,value').order('snapshot_date',{ascending:false}).limit(20000)
  ]);
  const R=rcv.data||[],T=trf.data||[];
  const pos=state.positions.filter(p=>rt.loc==='all'||String(p.branch_id)===rt.loc).map(r=>({...r,location_display:locationName(r.branch_name)}));
  const exp=state.expiry.filter(x=>Number(x.remaining_quantity)>0&&(rt.loc==='all'||String(x.branch_id)===rt.loc)).map(r=>({...r,branch_display:locationName(r.branch_name)}));
  const vrows=(varR.data||[]).map(r=>{const o=auditBaseline(r.product_name);const v=o===null?null:Number(r.system_qty)-(o+Number(r.received)+Number(r.transfer_in)+Number(r.transfer_out)+Number(r.waste)+Number(r.adjustments));return {...r,verified_opening:o,audit_variance:v};});
  const expired=exp.filter(x=>x.expiry_date&&Number(x.days_until_expiry)<0);
  const snapBy=new Map();(snapR.data||[]).forEach(r=>snapBy.set(r.snapshot_date,(snapBy.get(r.snapshot_date)||0)+Number(r.value||0)));
  const spark=[...snapBy.entries()].sort((a,b)=>a[0]<b[0]?-1:1).slice(-14).map(x=>x[1]);
  const sparkSvg=(a)=>{if(a.length<2)return '';const mx=Math.max(...a),mn=Math.min(...a),w=90,h=26;const pts=a.map((v,i)=>`${(i/(a.length-1)*w).toFixed(1)},${(h-(mx===mn?h/2:(v-mn)/(mx-mn)*(h-4))-2).toFixed(1)}`).join(' ');return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polyline fill="none" stroke="currentColor" stroke-width="2" points="${pts}"/></svg>`;};
  const stat=(l,v,sub,extra='')=>`<div class="rt-stat"><div class="rt-stat-l">${esc(l)}</div><div class="rt-stat-v">${v}</div><div class="rt-stat-s">${esc(sub)}</div>${extra}</div>`;
  const audN=vrows.filter(r=>r.audit_variance!==null&&r.audit_variance!==0).length,audNet=vrows.reduce((a,r)=>a+(r.audit_variance||0),0);
  content.innerHTML=`${dashSwitch('retool')}
    <div class="rt-filters"><label>From<input type="date" id="rtFrom" value="${rt.from}"></label><label>To<input type="date" id="rtTo" value="${rt.to}" max="${today}"></label><label>Location<select id="rtLoc"><option value="all">All locations</option>${state.branches.filter(b=>b.is_active!==false).map(b=>`<option value="${b.id}" ${String(b.id)===rt.loc?'selected':''}>${esc(locationName(b.name))}</option>`).join('')}</select></label><button class="btn" id="rtApply">Apply</button></div>
    <div class="rt-stats">
      ${stat('Inventory value',money(sum(pos,'stock_value')),`${qty(sum(pos,'available_quantity'))} units`,sparkSvg(spark))}
      ${stat('Receipts in range',qty(distinctCount(R,'receiving_id')),`${qty(sum(R,'quantity'))} units · ${money(sum(R,'total_cost'))}`)}
      ${stat('Transfers in range',qty(distinctCount(T,'transfer_id')),`${qty(sum(T,'quantity'))} units · ${money(sum(T,'total_value'))}`)}
      ${stat('Expired units',`<span class="${expired.length?'var-neg':''}">${qty(sum(expired,'remaining_quantity'))}</span>`,`${expired.length} batches`)}
      ${stat('Audit variance (WH)',`<span class="${audNet>0?'var-pos':audNet<0?'var-neg':''}">${audNet>0?'+':audNet<0?'−':''}${qty(Math.abs(audNet))}</span>`,`${audN} products differ`)}
    </div>
    <div class="rt-tabs">${[['stock','Stock',pos.length],['expiry','Expiry',exp.length],['receiving','Receiving',R.length],['transfers','Transfers',T.length],['variance','Variance (WH)',vrows.length]].map(([k,l,n])=>`<button data-tab="${k}" class="${rt.tab===k?'on':''}">${l} <span>${n}</span></button>`).join('')}</div>
    <div id="rtBody"></div>`;
  const body='#rtBody';
  const tabs={
    stock:()=>renderDataTable(body,pos,[{key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},{key:'category_name',label:'Category'},{key:'location_display',label:'Location'},{key:'available_quantity',label:'Qty',type:'qty',align:'right'},{key:'stock_status',label:'Status',type:'badge'},{key:'unit_cost',label:'Unit cost',type:'money',align:'right'},{key:'stock_value',label:'Value',type:'money',align:'right'},{key:'expiry_status',label:'Expiry',type:'badge'}],{filters:[{key:'category_name',label:'Category'},{key:'stock_status',label:'Status'}],filename:'rt-stock',title:'Stock',pageSize:25,sortKey:'product_name'}),
    expiry:()=>renderDataTable(body,exp,[{key:'product_name',label:'Product'},{key:'batch_no',label:'Batch'},{key:'branch_display',label:'Location'},{key:'remaining_quantity',label:'Qty',type:'qty',align:'right'},{key:'expiry_date',label:'Expiry',type:'date'},{key:'days_until_expiry',label:'Days left',type:'qty',align:'right'},{key:'expiry_status',label:'Status',type:'badge'}],{filters:[{key:'expiry_status',label:'Status'}],filename:'rt-expiry',title:'Expiry',pageSize:25,sortKey:'expiry_date'}),
    receiving:()=>renderDataTable(body,R,[{key:'date',label:'Date',type:'date'},{key:'reference_no',label:'Reference'},{key:'supplier_name',label:'Supplier'},{key:'product_name',label:'Product'},{key:'quantity',label:'Qty',type:'qty',align:'right'},{key:'unit_cost',label:'Unit cost',type:'money',align:'right'},{key:'total_cost',label:'Value',type:'money',align:'right'},{key:'expiry_date',label:'Expiry',type:'date'}],{filters:[{key:'supplier_name',label:'Supplier'},{key:'reference_no',label:'Reference'}],filename:'rt-receiving',title:'Receiving',pageSize:25}),
    transfers:()=>renderDataTable(body,T,[{key:'date',label:'Date',type:'date'},{key:'reference_no',label:'Reference'},{key:'from_branch',label:'From',type:'location'},{key:'to_branch',label:'To',type:'location'},{key:'product_name',label:'Product'},{key:'quantity',label:'Qty',type:'qty',align:'right'},{key:'total_value',label:'Value',type:'money',align:'right'}],{filters:[{key:'to_branch',label:'To',type:'location'}],filename:'rt-transfers',title:'Transfers',pageSize:25}),
    variance:()=>renderDataTable(body,vrows,[{key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},{key:'verified_opening',label:'Verified 30/09',type:'qty',align:'right'},{key:'opening',label:'Opening (system)',type:'qty',align:'right'},{key:'received',label:'Received',type:'qty',align:'right'},{key:'transfer_out',label:'Transferred',type:'qty',align:'right'},{key:'system_qty',label:'System',type:'qty',align:'right'},{key:'audit_variance',label:'Audit variance',type:'qty',align:'right'}],{filename:'rt-variance',title:'Variance',pageSize:25,sortKey:'audit_variance',sortDir:'desc'})
  };
  tabs[rt.tab]();
  $$('.rt-tabs [data-tab]').forEach(b=>b.onclick=()=>{rt.tab=b.dataset.tab;$$('.rt-tabs button').forEach(x=>x.classList.toggle('on',x===b));tabs[rt.tab]();});
  $('#rtApply').onclick=()=>{rt.from=$('#rtFrom').value||from0;rt.to=$('#rtTo').value||today;rt.loc=$('#rtLoc').value;dashboardRetool();};
}

/* ---------- Oracle-style document lists (Receiving / Transfers): list -> click -> document detail -> print ---------- */
const DOC_PRESETS=[['today','Today'],['yesterday','Yesterday'],['this_week','This Week'],['last_7','Last 7 Days'],['this_month','Current Month'],['last_month','Last Month'],['custom','Custom']];
const docState={receiving:{preset:'this_month',from:'',to:'',doc:'',a:'',b:'',tab:'docs'},transfer:{preset:'this_month',from:'',to:'',doc:'',a:'',b:'',tab:'docs'}};
function docView(kind){return kind==='receiving'?'v_daily_receiving_report':'v_daily_transfer_report';}
async function loadDocRows(kind){
  const st=docState[kind];const r=st.preset==='custom'?{from:st.from,to:st.to}:periodRange(st.preset);
  if(!r.from||!r.to)throw new Error('Choose From and To dates');if(r.from>r.to)throw new Error('From date is after To date');
  const {data,error}=await supabase.from(docView(kind)).select('*').gte('date',r.from).lte('date',r.to).order('date',{ascending:false}).order('created_at',{ascending:false}).limit(5000);
  if(error)throw error;return data||[];
}
function groupDocs(rows,kind){
  const m=new Map();
  for(const r of rows){
    const id=kind==='receiving'?r.receiving_id:r.transfer_id;const k=id??`${r.reference_no}|${r.date}`;
    if(!m.has(k))m.set(k,{key:String(k),ref:r.reference_no||String(id||'-'),invoice_no:r.invoice_no||'',date:r.date,status:kind==='receiving'?'Received':'Delivered',
      from:kind==='receiving'?(r.supplier_name||'—'):(r.from_branch||'—'),to:kind==='receiving'?(r.branch_name||'—'):(r.to_branch||'—'),
      created_by:r.performed_by||'—',created_at:r.created_at,notes:(kind==='receiving'?r.receiving_notes:r.transfer_notes)||'',lines:[],line_count:0,qty:0,value:0});
    const d=m.get(k);d.lines.push(r);d.line_count++;d.qty+=Number(r.quantity||0);d.value+=Number(kind==='receiving'?r.total_cost:r.total_value||0);
  }
  return [...m.values()].sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
}
function docColumns(kind){
  return [
    {key:'ref',label:'Document',render:(v,r)=>`<a class="doc-link">${esc(v)}</a>${kind==='receiving'&&r.invoice_no&&r.invoice_no!==v?` <span class="muted">(${esc(r.invoice_no)})</span>`:''}`},
    {key:'status',label:'Status',render:v=>`<span class="doc-status">${esc(v)}</span>`},
    {key:'from',label:kind==='receiving'?'Supplier':'From Location',render:v=>esc(locationName(v))},
    {key:'to',label:kind==='receiving'?'Received At':'To Location',render:v=>esc(locationName(v))},
    {key:'date',label:kind==='receiving'?'Received Date':'Delivery Date',type:'date'},
    {key:'line_count',label:'Lines',type:'qty',align:'right'},
    {key:'qty',label:'Total Qty',type:'qty',align:'right'},
    {key:'value',label:'Value',type:'money',align:'right'},
    {key:'created_by',label:'Created By'},
    {key:'created_at',label:'Changed At',type:'datetime'}
  ];
}
function docLineColumns(kind){
  const base=[{key:'no',label:'#',align:'right',noTotal:true},{key:'product_code',label:'Article / SKU'},{key:'product_name',label:'Article'},{key:'unit',label:'Unit'},{key:'quantity',label:'Qty',type:'qty',align:'right'}];
  if(kind==='receiving')base.push({key:'batch_no',label:'Batch'},{key:'expiry_date',label:'Expiry',type:'date'});
  base.push({key:'unit_cost',label:'Unit Cost',type:'money',align:'right'},{key:kind==='receiving'?'total_cost':'total_value',label:'Value',type:'money',align:'right'});
  return base;
}
function groupByDay(docs){
  const m=new Map();
  for(const d of docs){const k=String(d.date).slice(0,10);if(!m.has(k))m.set(k,{date:k,docs:[],documents:0,line_count:0,qty:0,value:0,parties:new Set()});
    const g=m.get(k);g.docs.push(d);g.documents++;g.line_count+=d.line_count;g.qty+=d.qty;g.value+=d.value;g.parties.add(locationName(d.from===undefined?'':d.from));}
  return [...m.values()].map(g=>({...g,key:g.date,parties:[...g.parties].filter(Boolean).join(', ')||'—'})).sort((a,b)=>b.date.localeCompare(a.date));
}
function dayColumns(kind){
  const isR=kind==='receiving';
  return [
    {key:'date',type:'date',label:isR?'Received Date':'Delivery Date',render:(v)=>`<a class="doc-link">${esc(dateFmt(v))}</a>`},
    {key:'documents',label:'Documents',type:'qty',align:'right'},
    {key:'line_count',label:'Lines',type:'qty',align:'right'},
    {key:'qty',label:'Total Qty',type:'qty',align:'right'},
    {key:'value',label:'Value',type:'money',align:'right'},
    {key:'parties',label:isR?'Supplier(s)':'From'}
  ];
}
async function paintNextTransfer(){
  const host=document.createElement('div');host.className='panel next-xfer';host.id='nextXfer';
  const bar=$('#docBody');if(!bar)return;bar.before(host);
  try{
    const {data:last,error:e1}=await supabase.from('v_daily_receiving_report').select('date').eq('branch_id',1).order('date',{ascending:false}).limit(1);
    if(e1)throw e1;const d=last?.[0]?.date;
    if(!d){host.remove();return;}
    let sent='';try{const {data:t}=await supabase.from('transfers').select('transfer_date').eq('from_branch_id',1).order('transfer_date',{ascending:false}).limit(1);const td=t?.[0]?.transfer_date;if(td)sent=td>d?`Last transfer ${dateFmt(td)} — already sent`:`Last transfer ${dateFmt(td)} — not sent yet`;}catch{}
    const {data:rows,error:e2}=await supabase.from('v_daily_receiving_report').select('product_id,product_name,quantity').eq('branch_id',1).eq('date',d).limit(2000);
    if(e2)throw e2;
    const by=new Map();(rows||[]).forEach(r=>{const o=by.get(r.product_id)||{name:r.product_name,qty:0};o.qty+=Number(r.quantity)||0;by.set(r.product_id,o);});
    const wh=new Map((state.positions||[]).filter(p=>Number(p.branch_id)===1).map(p=>[Number(p.product_id),Number(p.quantity??p.stock??0)]));
    const list=[...by.entries()].map(([id,o])=>({name:o.name,recv:o.qty,stock:wh.get(Number(id))??0})).sort((a,b)=>a.name.localeCompare(b.name));
    host.innerHTML=`<div class="next-head"><strong>Ready to transfer next</strong><span>Received ${esc(dateFmt(d))} · ${list.length} items · ${qty(list.reduce((a,x)=>a+x.recv,0))} pcs${sent?` · ${esc(sent)}`:''}</span><button class="doc-bar-btn" id="nxCopy">Copy</button><button class="doc-bar-btn" id="nxPrint">Print</button></div>
    <div class="next-grid">${list.map(x=>`<div class="next-row${x.stock<=0?' zero':''}"><span>${esc(x.name)}</span><b>${qty(x.recv)}</b><i title="Warehouse stock now">${qty(x.stock)} in stock</i></div>`).join('')}</div>`;
    $('#nxCopy').onclick=async()=>{const t=`Received ${dateFmt(d)}\n`+list.map(x=>`${x.name}: ${qty(x.recv)}`).join('\n');try{await navigator.clipboard.writeText(t);toast('Copied');}catch{toast('Copy not allowed on this device','error');}};
    $('#nxPrint').onclick=()=>printRows(list,[{key:'name',label:'Item'},{key:'recv',label:'Received'},{key:'stock',label:'Warehouse stock'}],`Ready to transfer — received ${dateFmt(d)}`);
  }catch(e){host.remove();}
}
function docsPage(kind){
  const st=docState[kind],isR=kind==='receiving',title=isR?'Receiving':'Transfers';
  const range=()=>st.preset==='custom'?{from:st.from,to:st.to}:periodRange(st.preset);
  const locs=(state.branches||[]).map(b=>b.name),sups=(state.suppliers||[]).map(s=>s.name);
  const opts=(arr,sel,all,loc=true)=>`<option value="">${all}</option>${arr.map(n=>`<option value="${esc(n)}" ${n===sel?'selected':''}>${esc(loc?locationName(n):n)}</option>`).join('')}`;
  const r0=range();
  content.innerHTML=`<div class="page-actions"><button class="btn primary" id="docNew" ${canPost()?'':'disabled'}>${isR?'＋ New Receiving':'⇄ New Transfer'}</button></div>
  <div id="docBody"></div>`;
  $('#docNew').onclick=isR?openReceiving:openTransfer;
  if(!isR)paintNextTransfer();
  const body=$('#docBody');
  body.innerHTML=`<div class="doc-bar"><span class="doc-bar-title">${title} by Date</span><button class="doc-bar-btn" id="docHide">Hide Filter</button><button class="doc-bar-btn" id="docRefresh">Refresh</button><button class="doc-bar-btn" id="docXls">Export to Excel</button><button class="doc-bar-btn" id="docPrintList">Print List</button></div>
  <div class="doc-filter" id="docFilter">
    <label>Time Period<select id="dfPreset">${DOC_PRESETS.map(([v,l])=>`<option value="${v}" ${v===st.preset?'selected':''}>${l}</option>`).join('')}</select></label>
    <label>From<input type="date" id="dfFrom" value="${esc(r0.from)}"></label><label>To<input type="date" id="dfTo" value="${esc(r0.to)}"></label>
    ${isR?`<label>Supplier<select id="dfA">${opts(sups,st.a,'All suppliers',false)}</select></label><label>Received At<select id="dfB">${opts(locs,st.b,'All locations')}</select></label>`
         :`<label>From Location<select id="dfA">${opts(locs,st.a,'All locations')}</select></label><label>To Location<select id="dfB">${opts(locs,st.b,'All locations')}</select></label>`}
    <label>Document<input id="dfDoc" placeholder="Reference / invoice no" value="${esc(st.doc)}"></label>
    <button class="btn primary" id="dfApply">Apply</button>
  </div>
  <div id="docList"></div>`;
  let all=[],days=[];
  const filtered=()=>{const q=st.doc.trim().toLowerCase();return all.filter(d=>(!st.a||d.from===st.a)&&(!st.b||d.to===st.b)&&(!q||`${d.ref} ${d.invoice_no}`.toLowerCase().includes(q)));};
  const dayView=(g)=>{
    const docs=g.docs;const back=()=>dayView(g);
    content.innerHTML=`<div class="doc-bar"><span class="doc-bar-title">${title} — ${esc(dateFmt(g.date))}</span><button class="doc-bar-btn" id="dvBack">◂ All Dates</button><button class="doc-bar-btn" id="dvPrint">Print Day (A4)</button><button class="doc-bar-btn" id="dvXls">Export to Excel</button></div>
    <div class="doc-head panel"><div><span>Date</span><strong>${esc(dateFmt(g.date))}</strong></div><div><span>Documents</span><strong>${qty(g.documents)}</strong></div><div><span>Lines</span><strong>${qty(g.line_count)}</strong></div><div><span>Total Qty</span><strong>${qty(g.qty)}</strong></div><div><span>Value</span><strong>${money(g.value)}</strong></div></div>
    <div id="dvList"></div>`;
    $('#dvBack').onclick=()=>docsPage(kind);
    const lines=docs.flatMap(d=>d.lines);
    $('#dvPrint').onclick=()=>printInvoices(kind,lines,g.date);
    $('#dvXls').onclick=()=>exportRowsExcel(docs,docColumns(kind).map(c=>({...c,render:undefined})),`joffreys-${kind}-${g.date}`);
    renderDataTable('#dvList',docs,docColumns(kind),{rowKey:'key',onRow:d=>showDoc(kind,d,back),filename:`joffreys-${kind}-${g.date}`,title:`Joffrey’s Bakery ${title} ${dateFmt(g.date)}`,pageSize:100,sortKey:'created_at',sortDir:'asc'});
    window.scrollTo?.(0,0);
  };
  const draw=()=>{
    days=groupByDay(filtered());
    renderDataTable('#docList',days,dayColumns(kind),{rowKey:'key',onRow:g=>dayView(g),filename:`joffreys-${kind}-by-date`,title:`Joffrey’s Bakery ${title} by Date`,pageSize:100,sortKey:'date',sortDir:'desc'});
  };
  const reload=async()=>{try{all=groupDocs(await loadDocRows(kind),kind);draw();}catch(e){fail(e,'Load failed');}};
  const readFilters=()=>{st.preset=$('#dfPreset').value;st.from=$('#dfFrom').value;st.to=$('#dfTo').value;st.a=$('#dfA').value;st.b=$('#dfB').value;st.doc=$('#dfDoc').value;};
  $('#dfPreset').onchange=()=>{const p=$('#dfPreset').value;if(p!=='custom'){const r=periodRange(p);$('#dfFrom').value=r.from;$('#dfTo').value=r.to;}};
  ['dfFrom','dfTo'].forEach(id=>$('#'+id).onchange=()=>{$('#dfPreset').value='custom';});
  $('#dfApply').onclick=async()=>{readFilters();await reload();};
  $('#docRefresh').onclick=async()=>{readFilters();await reload();};
  $('#docHide').onclick=()=>{const f=$('#docFilter');f.classList.toggle('hidden');$('#docHide').textContent=f.classList.contains('hidden')?'Show Filter':'Hide Filter';};
  $('#docXls').onclick=()=>exportRowsExcel(days,dayColumns(kind).map(c=>({...c,render:undefined,key:c.key})),`joffreys-${kind}-by-date-${isoToday()}`);
  $('#docPrintList').onclick=()=>printRows(days,dayColumns(kind).map(c=>({...c,render:undefined})),`Joffrey’s Bakery ${title} by Date`);
  reload();
}
function showDoc(kind,d,back){
  const isR=kind==='receiving';const lines=d.lines.map((l,i)=>({...l,no:i+1}));
  content.innerHTML=`<div class="doc-bar"><span class="doc-bar-title">${isR?'Receiving':'Transfer'}</span><button class="doc-bar-btn" id="ddBack">◂ Overview</button><button class="doc-bar-btn" id="ddPrint">Print</button><button class="doc-bar-btn" id="ddXls">Export to Excel</button></div>
  <div class="doc-head panel">
    <div><span>${isR?'Receiving':'Transfer'}</span><strong>${esc(d.ref)}</strong></div>
    <div><span>Status</span><strong><i class="doc-status">${esc(d.status)}</i></strong></div>
    <div><span>${isR?'Received Date':'Delivery Date'}</span><strong>${esc(dateFmt(d.date))}</strong></div>
    <div><span>${isR?'Supplier':'From Location'}</span><strong>${esc(locationName(d.from))}</strong></div>
    <div><span>${isR?'Received At':'To Location'}</span><strong>${esc(locationName(d.to))}</strong></div>
    ${isR?`<div><span>Supplier Invoice No</span><strong>${esc(d.invoice_no||'—')}</strong></div>`:''}
    <div><span>Created By</span><strong>${esc(d.created_by)}</strong></div>
    <div><span>Changed At</span><strong>${esc(dateTimeFmt(d.created_at))}</strong></div>
    <div class="wide"><span>Information</span><strong>${esc(d.notes||'—')}</strong></div>
  </div>
  <div id="docLines"></div>`;
  $('#ddBack').onclick=back;
  $('#ddPrint').onclick=()=>printInvoices(kind,d.lines,d.date);
  const cols=docLineColumns(kind);
  $('#ddXls').onclick=()=>exportRowsExcel(lines,cols,`joffreys-${kind}-${d.ref}`);
  renderDataTable('#docLines',lines,cols,{filename:`joffreys-${kind}-${d.ref}`,title:`${isR?'Receiving':'Transfer'} ${d.ref}`,pageSize:500});
  window.scrollTo?.(0,0);
}

const pages = {
  async dashboard(){
    ensureDashboardProStyles();
    if(state.dashView==='retool')return dashboardRetool();
    const from='2026-09-30';
    const to=isoToday();
    const dashboardResults=await Promise.allSettled([
      supabase.from('v_daily_receiving_report').select('date,receiving_id,supplier_name,quantity,total_cost').gte('date',from).lte('date',to).order('date',{ascending:true}),
      supabase.from('v_daily_transfer_report').select('date,transfer_id,to_branch,quantity,total_value').gte('date',from).lte('date',to).order('date',{ascending:true})
    ]);
    const dashboardWarnings=[];
    const receiving=safeResultRows(dashboardResults[0],'Receiving report',dashboardWarnings);
    const transfers=safeResultRows(dashboardResults[1],'Transfer report',dashboardWarnings);

    const wh=state.positions.filter(x=>x.branch_name==='Warehouse');
    const shops=state.positions.filter(x=>x.branch_name!=='Warehouse');
    const whUnits=sum(wh,'available_quantity'),whValue=sum(wh,'stock_value'),whSku=distinctCount(wh.filter(x=>Number(x.available_quantity)>0),'product_id');
    const shopUnits=sum(shops,'available_quantity'),shopValue=sum(shops,'stock_value'),shopSku=distinctCount(shops.filter(x=>Number(x.available_quantity)>0),'product_id');
    const totalValue=whValue+shopValue;
    const lowWh=wh.filter(x=>x.stock_status==='Low Stock').sort((a,b)=>Number(a.available_quantity)-Number(b.available_quantity));
    const outWh=wh.filter(x=>x.stock_status==='Out of Stock').sort((a,b)=>String(a.product_name).localeCompare(String(b.product_name)));
    const recvUnits=sum(receiving,'quantity'),recvValue=sum(receiving,'total_cost'),recvTxn=distinctCount(receiving,'receiving_id');
    const trUnits=sum(transfers,'quantity'),trValue=sum(transfers,'total_value'),trTxn=distinctCount(transfers,'transfer_id');
    const liveExpiry=state.expiry.filter(x=>Number(x.remaining_quantity)>0);
    const missingExpiry=liveExpiry.filter(x=>!x.expiry_date);
    const missingExpiryBatches=missingExpiry.length,missingExpiryUnits=sum(missingExpiry,'remaining_quantity');
    const expSoon=liveExpiry.filter(x=>x.expiry_date&&Number(x.days_until_expiry)>=0&&Number(x.days_until_expiry)<=7).length;

    const health=[
      {label:'Healthy',value:wh.filter(x=>x.stock_status==='Healthy').length,color:COLORS.healthy},
      {label:'Low Stock',value:lowWh.length,color:COLORS.low},
      {label:'Out of Stock',value:outWh.length,color:COLORS.out}
    ];
    const productTotals=aggregateProductPositions(state.positions);
    const topValue=[...productTotals].filter(x=>x.value>0).sort((a,b)=>b.value-a.value).slice(0,10).map(x=>({label:x.product_name,value:x.value,product_id:x.product_id}));
    const topQty=[...productTotals].filter(x=>x.quantity>0).sort((a,b)=>b.quantity-a.quantity).slice(0,10).map(x=>({label:x.product_name,value:x.quantity,product_id:x.product_id}));

    const dailyMap=new Map();
    for(const r of receiving){const d=String(r.date||'').slice(0,10);if(!d)continue;if(!dailyMap.has(d))dailyMap.set(d,{label:dateFmt(d),inValue:0,outValue:0});dailyMap.get(d).inValue+=Number(r.quantity||0);}
    for(const r of transfers){const d=String(r.date||'').slice(0,10);if(!d)continue;if(!dailyMap.has(d))dailyMap.set(d,{label:dateFmt(d),inValue:0,outValue:0});dailyMap.get(d).outValue+=Number(r.quantity||0);}
    const activityTrend=[...dailyMap.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,x])=>x);

    const [repR,varR,snapR]=await Promise.allSettled([
      supabase.rpc('replenishment_suggestions'),
      supabase.rpc('variance_report',{p_branch_id:(state.branches.find(b=>b.name==='Warehouse')||{}).id||1}),
      supabase.from('daily_stock_snapshots').select('snapshot_date,quantity,value').order('snapshot_date',{ascending:false}).limit(20000)
    ]);
    const rep=(repR.status==='fulfilled'&&!repR.value.error?repR.value.data:[])||[];
    const trSug=rep.filter(r=>Number(r.suggested_transfer)>0),orderSug=[...new Set(rep.filter(r=>Number(r.suggested_order)>0).map(r=>r.product_id))];
    const varRows=(varR.status==='fulfilled'&&!varR.value.error?varR.value.data:[])||[];
    const audVars=varRows.map(r=>{const o=auditBaseline(r.product_name);return o===null?0:Number(r.system_qty)-(o+Number(r.received)+Number(r.transfer_in)+Number(r.transfer_out)+Number(r.waste)+Number(r.adjustments));}).filter(v=>v!==0);
    const varIds=new Set(varRows.filter(r=>{const o=auditBaseline(r.product_name);return o!==null&&Number(r.system_qty)-(o+Number(r.received)+Number(r.transfer_in)+Number(r.transfer_out)+Number(r.waste)+Number(r.adjustments))!==0;}).map(r=>Number(r.product_id)));
    for(const x of [...topValue,...topQty])x.warn=varIds.has(Number(x.product_id));
    const audNet=audVars.reduce((a,b)=>a+b,0);
    const snapBy=new Map();((snapR.status==='fulfilled'&&!snapR.value.error?snapR.value.data:[])||[]).forEach(r=>{const o=snapBy.get(r.snapshot_date)||{date:r.snapshot_date,units:0,value:0};o.units+=Number(r.quantity||0);o.value+=Number(r.value||0);snapBy.set(r.snapshot_date,o);});
    const snaps=[...snapBy.values()].sort((a,b)=>a.date<b.date?-1:1).slice(-14);
    const prevVal=snaps.length>1?snaps[snaps.length-2].value:null;
    const dVal=prevVal===null?null:totalValue-prevVal;
    const expired=liveExpiry.filter(x=>x.expiry_date&&Number(x.days_until_expiry)<0),exp3=liveExpiry.filter(x=>x.expiry_date&&Number(x.days_until_expiry)>=0&&Number(x.days_until_expiry)<=3);
    const expiredUnits=sum(expired,'remaining_quantity'),exp3Units=sum(exp3,'remaining_quantity');
    const exp7=liveExpiry.filter(x=>x.expiry_date&&Number(x.days_until_expiry)>3&&Number(x.days_until_expiry)<=7),expLater=liveExpiry.filter(x=>x.expiry_date&&Number(x.days_until_expiry)>7);
    const expiryRisk=[{label:'Expired',value:sum(expired,'remaining_quantity'),color:COLORS.waste},{label:'≤ 3 days',value:exp3Units,color:COLORS.out},{label:'4–7 days',value:sum(exp7,'remaining_quantity'),color:COLORS.low},{label:'> 7 days',value:sum(expLater,'remaining_quantity'),color:COLORS.healthy},{label:'No expiry',value:missingExpiryUnits,color:COLORS.neutral}];
    const todayStr=isoToday();const tRecv=receiving.filter(r=>String(r.date).slice(0,10)===todayStr),tTr=transfers.filter(r=>String(r.date).slice(0,10)===todayStr);
    const actions=[
      expired.length&&{lvl:3,ico:'⛔',t:`${qty(expiredUnits)} expired units`,m:`${expired.length} batches past expiry — record waste`,go:'expiry',exp:'expired',b:'Review'},
      exp3.length&&{lvl:2,ico:'⏳',t:`${qty(exp3Units)} units expire within 3 days`,m:`${exp3.length} batches`,go:'expiry',exp:'soon',b:'Open batches'},
      outWh.length&&{lvl:2,ico:'📉',t:`${outWh.length} products out of stock`,m:'Bakery Warehouse',go:'stock',b:'View'},
      lowWh.length&&{lvl:1,ico:'⚠',t:`${lowWh.length} products low in stock`,m:'Bakery Warehouse thresholds',go:'stock',b:'View'},
      missingExpiryBatches&&{lvl:2,ico:'📅',t:`${missingExpiryBatches} batches missing expiry`,m:`${qty(missingExpiryUnits)} units — update real dates`,go:'expiry',b:'Fix'},
      audVars.length&&{lvl:2,ico:'±',t:`${audVars.length} products with audit variance`,m:`Net ${audNet>0?'+':audNet<0?'−':''}${qty(Math.abs(audNet))} units vs verified 30/09`,go:'variance',b:'Check'},
      trSug.length&&{lvl:1,ico:'⇄',t:`${trSug.length} suggested transfers`,m:`${qty(trSug.reduce((a,r)=>a+Number(r.suggested_transfer),0))} units to send to branches`,go:'replenishment',b:'Open'},
      orderSug.length&&{lvl:1,ico:'🛒',t:`${orderSug.length} products to order`,m:'Warehouse below 3 days of cover',go:'replenishment',b:'Open'}
    ].filter(Boolean).sort((a,b)=>b.lvl-a.lvl);
    const deltaTxt=dVal===null?'':`<span class="delta ${dVal>=0?'up':'down'}">${dVal>=0?'▲':'▼'} ${money(Math.abs(dVal))} vs last night</span>`;
    const hr=new Date().getHours();const greet=hr<12?'Good morning':hr<18?'Good afternoon':'Good evening';
    content.innerHTML=`
      ${dashSwitch('overview')}
      <div class="dash-hero"><div><h2>${greet}, ${esc((state.appUser?.name||'').split(' ')[0]||'team')}</h2><p>${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · Joffrey’s Bakery Jeddah</p></div>
        <div class="dash-hero-stats"><div><span>Inventory value</span><strong>${money(totalValue)}</strong>${deltaTxt}</div><div><span>Today in</span><strong>${qty(sum(tRecv,'quantity'))}</strong><small>${distinctCount(tRecv,'receiving_id')} receipts</small></div><div><span>Today out</span><strong>${qty(sum(tTr,'quantity'))}</strong><small>${distinctCount(tTr,'transfer_id')} transfers</small></div></div></div>
      <div class="dash-section-head"><h3>Action center</h3><span>${actions.length?actions.length+' item(s) need attention':'All clear'}</span></div>
      <div class="action-grid">${actions.length?actions.map(a=>`<button class="action-card lvl${a.lvl}" data-go="${a.go}"${a.exp?` data-exp="${a.exp}"`:''}><span class="action-ico">${a.ico}</span><span class="action-body"><strong>${esc(a.t)}</strong><small>${esc(a.m)}</small></span><span class="action-btn">${a.b} ›</span></button>`).join(''):'<div class="action-card lvl0"><span class="action-ico">✓</span><span class="action-body"><strong>Everything is in order</strong><small>No expiry, stock or variance issues right now</small></span></div>'}</div>
      <div class="dash-section-head"><h3>Stock position</h3><span>Live from Supabase</span></div>
      <div class="dash-pro-kpis">
        ${kpi('Bakery Warehouse',qty(whUnits),`${money(whValue)} · ${whSku} SKUs`,'good')}
        ${kpi('Jeddah Shops',qty(shopUnits),`${money(shopValue)} · ${shopSku} SKUs`)}
        ${kpi('Receiving since 30/09',qty(recvUnits),`${recvTxn} receipts · ${money(recvValue)}`,'blue')}
        ${kpi('Transfers since 30/09',qty(trUnits),`${trTxn} transfers · ${money(trValue)}`,'purple')}
        ${kpi('Expiring ≤ 7 days',qty(exp3.length+exp7.length),`${qty(exp3Units+sum(exp7,'remaining_quantity'))} units`,'warn')}
      </div>
      <div class="chart-grid">${snaps.length>1?trendChart('Inventory value — last nights (SAR)',snaps.map(d=>({label:dateFmt(d.date),value:d.value})),COLORS.receiving,v=>num(v,0)):`<div class="chart-card"><div class="chart-title">Inventory value trend</div><div class="empty chart-empty">Builds up automatically — one point per night</div></div>`}${donutChart('Expiry risk (units)',expiryRisk)}</div>
      <div class="chart-grid">${donutChart('Bakery Warehouse stock health',health)}${compareChart('Bakery Warehouse vs Jeddah Shops',[{label:'Bakery Warehouse',value:whUnits,color:COLORS.neutral},{label:'Jeddah Shops',value:shopUnits,color:COLORS.transfer}])}</div>
      <div class="dash-section-head"><h3>Activity</h3><span>30/09/2026 — ${dateFmt(to)} · daily units</span></div>
      ${dualTrendChart('Receiving vs Transfer — Daily Units',activityTrend,'Receiving','Transfer','#dc2626')}
      <div class="chart-grid">${barChart('Top 10 products by stock value',topValue,COLORS.neutral,money)}${barChart('Top 10 products by quantity',topQty,COLORS.neutral,qty)}</div>
    `;
    $$('.action-card[data-go]').forEach(b=>b.onclick=()=>b.dataset.exp?openExpiryQuick(b.dataset.exp):go(b.dataset.go));
    const warnings=[...(state.dataWarnings||[]),...dashboardWarnings];
    if(warnings.length)toast('Dashboard loaded with limited data: '+warnings.join(' | '),'error');
  },

  async stock(){
    const rows=state.positions.map(r=>({...r,location_display:locationName(r.branch_name)}));
    content.innerHTML=`<div id="stockTable"></div>`;
    renderDataTable('#stockTable',rows,[
      {key:'product_code',label:'SKU / Reference'},{key:'product_name',label:'Product'},{key:'category_name',label:'Category'},{key:'supplier_name',label:'Supplier'},
      {key:'branch_name',label:'Location',type:'location'},{key:'available_quantity',label:'Available Quantity',type:'qty',align:'right'},{key:'unit',label:'Unit'},
      {key:'reorder_threshold',label:'Reorder Threshold',type:'qty',align:'right'},{key:'stock_status',label:'Stock Scale / Status',type:'badge'},
      {key:'unit_cost',label:'Unit Cost',type:'money',align:'right'},{key:'stock_value',label:'Stock Value',type:'money',align:'right'},{key:'expiry_status',label:'Expiry Status',type:'badge'}
    ],{filters:[{key:'category_name',label:'Category'},{key:'supplier_name',label:'Supplier'},{key:'branch_name',label:'Location',type:'location'},{key:'stock_status',label:'Status'}],filename:'joffreys-current-stock',title:'Joffrey’s Bakery Current Stock',pageSize:50,sortKey:'product_name',defaults:{branch_name:'Warehouse'}});
  },

  async movements(){
    content.innerHTML=`<div class="period-inline"><label>From<input id="mFrom" type="date"></label><label>To<input id="mTo" type="date"></label><button id="mApply" class="btn">Apply Date Filter</button><button id="mClear" class="btn ghost">Latest 1,000</button></div><div class="info-banner">Transaction Date is the operational date. Posted At preserves the actual audit timestamp.</div><div id="movementTable"></div>`;
    const render=(rows)=>renderDataTable('#movementTable',rows,[
      {key:'transaction_date',label:'Transaction Date',type:'date'},{key:'created_at',label:'Posted At',type:'datetime'},{key:'movement_type',label:'Movement Type',type:'movement'},{key:'reference_no',label:'Reference'},
      {key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},{key:'branch_name',label:'Location',type:'location'},{key:'from_branch',label:'From',type:'location'},{key:'to_branch',label:'To',type:'location'},
      {key:'quantity_in',label:'Quantity In',type:'qty',align:'right'},{key:'quantity_out',label:'Quantity Out',type:'qty',align:'right'},{key:'running_balance',label:'Resulting Balance',type:'qty',align:'right'},
      {key:'unit_cost',label:'Unit Cost',type:'money',align:'right'},{key:'movement_value',label:'Value',type:'money',align:'right'},{key:'performed_by',label:'Performed By'},{key:'notes',label:'Notes'}
    ],{filters:[{key:'movement_type',label:'Movement Type'},{key:'branch_name',label:'Branch',type:'location'},{key:'product_name',label:'Product'}],filename:'joffreys-movement-ledger',title:'Joffrey’s Bakery Movement Ledger',pageSize:75});
    const fetchRows=async(from='',to='')=>{let q=supabase.from('v_stock_movement_ledger').select('*');if(from)q=q.gte('transaction_date',from);if(to)q=q.lte('transaction_date',to);const {data,error}=await q.order('transaction_date',{ascending:false}).order('created_at',{ascending:false}).limit(5000);if(error)throw error;return data||[];};
    const latest=await fetchRows();render(latest.slice(0,1000));
    $('#mApply').onclick=async()=>{const f=$('#mFrom').value,t=$('#mTo').value;if(f&&t&&f>t)return toast('Invalid date range','error');try{const rows=await fetchRows(f,t);render(rows);}catch(e){fail(e,'Movement filter failed');}};
    $('#mClear').onclick=()=>{$('#mFrom').value='';$('#mTo').value='';render(latest.slice(0,1000));};
  },

  async receiving(){docsPage('receiving');},

  async transfers(){docsPage('transfer');},
  async sheet(){
    const wh=(state.positions||[]).filter(x=>Number(x.branch_id)===Number(state.warehouse?.id)).map(x=>({id:Number(x.product_id),name:x.product_name,code:x.product_code,stock:Number(x.available_quantity||0)})).sort((a,b)=>a.name.localeCompare(b.name));
    const dests=(state.branches||[]).filter(b=>Number(b.id)!==Number(state.warehouse?.id));
    const jed=dests.find(b=>/jeddah/i.test(b.name)&&!/airport|shs/i.test(b.name))||dests[0];
    const d0=isoToday(),ymd=d0.replace(/-/g,'');
    content.innerHTML=`<div class="panel sheet-panel"><div class="sheet-top">
      <label>Date<input type="date" id="shDate" value="${esc(d0)}"></label>
      <label>To<select id="shTo">${dests.map(b=>`<option value="${b.id}" ${jed&&b.id===jed.id?'selected':''}>${esc(locationName(b.name))}</option>`).join('')}</select></label>
      <label>Reference<input id="shRef" value="TR-${ymd}-01"></label>
      <label class="sh-search">Find<input id="shFind" placeholder="Search item" autocomplete="off"></label></div>
      <div class="sheet-list" id="shList">${wh.map(r=>`<div class="sh-row${r.stock<=0?' empty':''}" data-id="${r.id}" data-name="${esc(r.name.toLowerCase())}" data-stock="${r.stock}"><span class="sh-name">${esc(r.name)}</span><i class="sh-stock">${qty(r.stock)}</i><input class="sh-qty" type="number" inputmode="numeric" min="0" step="1" ${r.stock<=0?'disabled placeholder="—"':'placeholder="0"'}></div>`).join('')}</div>
      <div class="sheet-bar"><div id="shSum">0 lines · 0 pcs</div><button class="btn primary" id="shSave" ${canPost()?'':'disabled'}>Record transfer</button></div></div>`;
    const rows=()=>$$('.sh-row',content);
    const read=()=>rows().map(r=>({row:r,id:Number(r.dataset.id),name:r.querySelector('.sh-name').textContent,stock:Number(r.dataset.stock),q:Number(r.querySelector('.sh-qty').value||0)})).filter(x=>x.q>0);
    const sum=()=>{const l=read();let bad=0;rows().forEach(r=>{const q=Number(r.querySelector('.sh-qty').value||0),over=q>Number(r.dataset.stock);r.classList.toggle('over',over);});l.forEach(x=>{if(x.q>x.stock)bad++;});$('#shSum').innerHTML=`${l.length} lines · ${qty(l.reduce((a,x)=>a+x.q,0))} pcs${bad?` · <b class="sh-bad">${bad} over stock</b>`:''}`;return bad;};
    content.addEventListener('input',e=>{if(e.target.classList?.contains('sh-qty'))sum();});
    const setRef=async()=>{const dt=$('#shDate').value,base='TR-'+dt.replace(/-/g,'')+'-';$('#shRef').value=base+'01';try{const {data}=await supabase.from('transfers').select('reference_no').like('reference_no',base+'%');const used=(data||[]).map(r=>Number(String(r.reference_no).slice(base.length))).filter(Number.isFinite);const n=(used.length?Math.max(...used):0)+1;$('#shRef').value=base+String(n).padStart(2,'0');}catch{}};
    $('#shDate').onchange=setRef;setRef();
    $('#shFind').oninput=()=>{const q=$('#shFind').value.trim().toLowerCase();rows().forEach(r=>r.classList.toggle('hidden',!!q&&!r.dataset.name.includes(q)));};
    $('#shSave').onclick=async()=>{
      const btn=$('#shSave');const l=read();
      if(!l.length)return toast('Enter at least one quantity','error');
      if(sum())return toast('Some lines are above Warehouse stock — fix the red rows','error');
      const date=$('#shDate').value,ref=$('#shRef').value.trim();if(!date||!ref)return toast('Date and reference are required','error');
      if(!confirm(`Record transfer ${ref}\n${date} · ${l.length} lines · ${l.reduce((a,x)=>a+x.q,0)} pcs\nWarehouse → ${$('#shTo').selectedOptions[0].textContent}`))return;
      try{assertOnline();}catch(e){return fail(e,'Could not save');}
      btn.disabled=true;btn.textContent='Saving…';
      try{
        const {data,error}=await supabase.rpc('post_transfer',{p_transfer_date:date,p_reference_no:ref,p_to_branch_id:Number($('#shTo').value),p_items:l.map(x=>({product_id:x.id,quantity:x.q,notes:null})),p_notes:`Transfer ${dateFmt(date)} - Warehouse to ${locationName($('#shTo').selectedOptions[0].textContent)}`,p_posting_key:newPostingKey()});
        if(error)throw error;
        toast(`Transfer ${data?.reference_no||ref} saved`,'success');
        try{await requireData(true);}catch(e){console.error(e);}
        go('transfers',true);
      }catch(e){fail(e,'Could not save');btn.disabled=false;btn.textContent='Record transfer';}
    };
  },


  async adjustments(){
    const {data,error}=await supabase.from('v_adjustment_report').select('*').order('created_at',{ascending:false}).limit(3000);if(error)throw error;
    content.innerHTML=`<div class="page-actions"><button class="btn primary" id="newAdjustment" ${canPost()?'':'disabled'}>± New Adjustment</button></div><div id="adjustTable"></div>`;$('#newAdjustment').onclick=openAdjustment;
    renderDataTable('#adjustTable',data||[],[
      {key:'adjustment_date',label:'Date',type:'date'},{key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},{key:'branch_name',label:'Location',type:'location'},
      {key:'quantity_in',label:'Adjustment +',type:'qty',align:'right'},{key:'quantity_out',label:'Adjustment -',type:'qty',align:'right'},{key:'unit_cost',label:'Unit Cost',type:'money',align:'right'},{key:'adjustment_value',label:'Value',type:'money',align:'right'},
      {key:'reason',label:'Reason'},{key:'performed_by',label:'Performed By'},{key:'notes',label:'Notes'}
    ],{filters:[{key:'branch_name',label:'Location',type:'location'},{key:'reason',label:'Reason'}],filename:'joffreys-adjustments',title:'Joffrey’s Bakery Adjustment Report',pageSize:50});
  },

  async waste(){
    const {data,error}=await supabase.from('v_waste_report').select('*').order('created_at',{ascending:false}).limit(3000);if(error)throw error;
    content.innerHTML=`<div class="page-actions"><button class="btn primary" id="newWaste" ${canPost()?'':'disabled'}>♲ Record Waste</button></div><div id="wasteTable"></div>`;$('#newWaste').onclick=openWaste;
    renderDataTable('#wasteTable',data||[],[
      {key:'waste_date',label:'Date',type:'date'},{key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},{key:'branch_name',label:'Location',type:'location'},
      {key:'quantity',label:'Quantity',type:'qty',align:'right'},{key:'unit_cost',label:'Unit Cost',type:'money',align:'right'},{key:'waste_value',label:'Waste Value',type:'money',align:'right'},
      {key:'reason',label:'Reason'},{key:'expiry_date',label:'Expiry Date',type:'date'},{key:'performed_by',label:'Performed By'},{key:'notes',label:'Notes'}
    ],{filters:[{key:'branch_name',label:'Location',type:'location'},{key:'reason',label:'Reason'}],filename:'joffreys-waste',title:'Joffrey’s Bakery Waste Report',pageSize:50});
  },

  async expiry(){
    const rows=state.expiry.map(x=>({...x,branch_display:locationName(x.branch_name)}));const counts={};for(const r of rows)counts[r.expiry_status]=(counts[r.expiry_status]||0)+1;
    const {data:auditData,error:auditError}=await supabase.from('v_batch_expiry_audit').select('*').order('changed_at',{ascending:false}).limit(200);if(auditError)throw auditError;
    content.innerHTML=`<div class="page-actions"><button class="btn primary" id="correctBatchExpiry" ${canCorrectExpiry()?'':'disabled'}>◷ Update Batch Expiry</button></div><div class="kpi-grid kpi-grid-7">${kpi('Missing Expiry',qty(counts['No Expiry Date']||0),'Enter real dates from physical labels','bad')}${kpi('Expired',qty(counts['Expired']||0),'Immediate action','bad')}${kpi('Expires Today',qty(counts['Expires Today']||0),'Critical','bad')}${kpi('Within 3 Days',qty(counts['Within 3 Days']||0),'High risk','warn')}${kpi('Within 7 Days',qty(counts['Within 7 Days']||0),'Plan movement','warn')}${kpi('Within 14 Days',qty(counts['Within 14 Days']||0),'Monitor','warn')}${kpi('Safe',qty(counts['Safe']||counts['OK']||0),'Beyond 14 days','good')}</div><div class="info-banner">Existing stock without expiry remains visible as Missing Expiry. Use Update Batch Expiry only after checking the real physical label; quantity is never changed by this action.</div><div id="expiryTable" style="margin-top:16px"></div><div class="section-title"><h3>Expiry Correction Audit</h3><span>Latest 200 changes</span></div><div id="expiryAuditTable"></div>`;
    $('#correctBatchExpiry').onclick=openBatchExpiryCorrection;
    renderDataTable('#expiryTable',rows,[
      {key:'product_name',label:'Product'},{key:'product_code',label:'SKU'},{key:'batch_no',label:'Batch'},{key:'branch_name',label:'Location',type:'location'},{key:'remaining_quantity',label:'Quantity Remaining',type:'qty',align:'right'},
      {key:'received_date',label:'Received Date',type:'date'},{key:'expiry_date',label:'Expiry Date',type:'date'},{key:'days_until_expiry',label:'Days Remaining',type:'qty',align:'right'},{key:'supplier_name',label:'Supplier'},{key:'expiry_status',label:'Status',type:'badge'}
    ],{filters:[{key:'expiry_status',label:'Expiry Status'},{key:'branch_name',label:'Location',type:'location'},{key:'supplier_name',label:'Supplier'}],filename:'joffreys-expiry',title:'Joffrey’s Bakery Expiry / FEFO Report',pageSize:50,sortKey:'expiry_date'});
    renderDataTable('#expiryAuditTable',auditData||[],[
      {key:'changed_at',label:'Changed At',type:'datetime'},{key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},{key:'branch_name',label:'Location',type:'location'},{key:'batch_id',label:'Batch ID'},
      {key:'old_expiry_date',label:'Old Expiry',type:'date'},{key:'new_expiry_date',label:'New Expiry',type:'date'},{key:'old_batch_no',label:'Old Batch'},{key:'new_batch_no',label:'New Batch'},{key:'changed_by_name',label:'Changed By'},{key:'reason',label:'Reason'}
    ],{filters:[{key:'branch_name',label:'Location',type:'location'},{key:'changed_by_name',label:'Changed By'}],filename:'joffreys-expiry-corrections',title:'Joffrey’s Bakery Expiry Correction Audit',pageSize:25});
  },

  async compare(){
    const to0=isoToday();let from='2026-10-01',to=to0;
    const locs=(state.branches||[]).filter(b=>b.is_active!==false);
    const whId=state.warehouse?.id||locs[0]?.id;
    content.innerHTML=`<div class="doc-filter" id="cmpFilter"><label>Location<select id="cmpLoc">${locs.map(b=>`<option value="${b.id}" ${Number(b.id)===Number(whId)?'selected':''}>${esc(locationName(b.name))}</option>`).join('')}</select></label><label>From<input type="date" id="cmpFrom" value="${from}" min="${AUDIT_BASELINE_DATE}"></label><label>To<input type="date" id="cmpTo" value="${to}"></label><label>Find product<input id="cmpQ" type="search" placeholder="Name or SKU"></label><label class="small"><span>Show</span><select id="cmpOnly"><option value="all">All items</option><option value="diff">Differences only</option></select></label><button class="btn primary" id="cmpGo">Apply</button></div>
    <div class="info-banner"><b>Closing</b> = verified 30/09 count plus everything before the From date. <b>Available</b> = Closing + Received − Transferred − Waste ± Adjustments. <b>Difference</b> = system stock − Available (should be 0). <b>Tap an item</b> to see its full history. <span class="muted small">App version 20261013-1</span></div><div id="cmpNote"></div><div id="cmpTable"></div>`;
    let rows=[];
    const cols=[{key:'product_code',label:'SKU'},{key:'product_name',label:'Product',render:(v,r)=>esc(v)+(r.nobase?' <span class="muted small" title="No 30/09 count entered — closing taken as 0">*</span>':'')},
      {key:'closing',label:'Closing Stock',type:'qty',align:'right'},{key:'received',label:'Received',type:'qty',align:'right'},{key:'transferred',label:'Transferred',type:'qty',align:'right'},
      {key:'waste',label:'Waste',type:'qty',align:'right'},{key:'adjustments',label:'Adjust.',type:'qty',align:'right'},{key:'available',label:'Available Stock',type:'qty',align:'right'},
      {key:'system',label:'System Stock',type:'qty',align:'right'},{key:'diff',label:'Difference',type:'qty',align:'right',render:v=>Math.abs(v)>0.00001?`<b class="audit-variance">${v>0?'+':''}${qty(v)}</b>`:'0'}];
    const draw=()=>{const q=$('#cmpQ').value.trim().toLowerCase();const only=$('#cmpOnly').value==='diff';const f=rows.filter(r=>(!q||`${r.product_name} ${r.product_code}`.toLowerCase().includes(q))&&(!only||Math.abs(r.diff)>0.00001));
      const locName=locationName((locs.find(b=>String(b.id)===$('#cmpLoc').value)||{}).name||'');
      renderDataTable('#cmpTable',f,cols,{filename:`joffreys-compare-${locName}`.replace(/\s+/g,'-'),title:`Joffrey’s Bakery Compare Sheet · ${locName} · ${dateFmt(from)} – ${dateFmt(to)}`,pageSize:200,sortKey:'product_name',sortDir:'asc',rowKey:'product_id',onRow:showProductHistory});};
    const load=async()=>{from=$('#cmpFrom').value||from;to=$('#cmpTo').value||to;if(from<AUDIT_BASELINE_DATE)from=AUDIT_BASELINE_DATE;if(from>to)return toast('From date is after To date','error');
      const br=Number($('#cmpLoc').value);
      const has=state.closing&&state.closing[br]&&Object.keys(state.closing[br]).length;
      $('#cmpNote').innerHTML=has||br===state.warehouse?.id?'':`<div class="info-banner health-bar"><strong>No 30/09 closing count for this location yet.</strong> Closing is shown as 0. <button class="btn small-btn" id="cmpEnter">Enter counts</button></div>`;
      $('#cmpEnter')&&($('#cmpEnter').onclick=()=>{countsState.branch=br;go('counts');});
      try{rows=await loadCompareRows(from,to,br);draw();}catch(e){fail(e,'Load failed');}};
    $('#cmpGo').onclick=load;$('#cmpLoc').onchange=load;$('#cmpQ').oninput=draw;$('#cmpOnly').onchange=draw;await load();
  },
  async counts(){
    const locs=(state.branches||[]).filter(b=>b.is_active!==false);
    const canEdit=activeRole()==='admin';
    if(!countsState.branch)countsState.branch=Number(state.warehouse?.id||locs[0]?.id);
    content.innerHTML=`<div class="doc-filter"><label>Location<select id="ccLoc">${locs.map(b=>`<option value="${b.id}" ${Number(b.id)===Number(countsState.branch)?'selected':''}>${esc(locationName(b.name))}</option>`).join('')}</select></label><label>Count date<input value="${esc(dateFmt(AUDIT_BASELINE_DATE))}" disabled></label><label>Find product<input id="ccQ" type="search" placeholder="Name or SKU"></label><button class="btn primary" id="ccSave" ${canEdit?'':'disabled'}>Save counts</button></div>
    <div class="info-banner">The closing stock you counted on 30/09/2026. The Compare Sheet starts from these numbers. Leave a box empty if the item was not counted.${canEdit?'':' Only an admin can change counts.'}</div><div id="ccTable" class="table-card"></div>`;
    const pend={};
    const draw=()=>{
      const br=Number($('#ccLoc').value);countsState.branch=br;const q=$('#ccQ').value.trim().toLowerCase();const cur={...(state.closing?.[br]||{}),...(pend[br]||{})};
      const prods=(state.products||[]).filter(p=>!q||`${p.name} ${p.product_code}`.toLowerCase().includes(q)).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
      $('#ccTable').innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>SKU</th><th>Product</th><th class="num">Closing count 30/09</th></tr></thead><tbody>${prods.map(p=>`<tr><td>${esc(p.product_code||'')}</td><td>${esc(p.name)}</td><td class="num"><input type="number" min="0" step="1" inputmode="decimal" data-cc="${p.id}" value="${Object.prototype.hasOwnProperty.call(cur,p.id)?cur[p.id]:''}" style="width:96px;text-align:right" ${canEdit?'':'disabled'}></td></tr>`).join('')||'<tr><td colspan="3" class="empty">No products</td></tr>'}</tbody></table></div>`;
      $$('#ccTable input[data-cc]').forEach(i=>i.oninput=()=>{(pend[br]||(pend[br]={}))[i.dataset.cc]=i.value===''?undefined:Number(i.value);});
    };
    $('#ccLoc').onchange=draw;$('#ccQ').oninput=draw;
    const collect=()=>{const br=Number($('#ccLoc').value);return Object.entries(pend[br]||{}).filter(([,v])=>v!==undefined&&!Number.isNaN(v)).map(([k,v])=>({product_id:Number(k),quantity:v}));};
    $('#ccSave').onclick=async()=>{
      const br=Number($('#ccLoc').value);const items=collect();if(!items.length)return toast('No changes to save','error');
      $('#ccSave').disabled=true;
      try{const {error}=await supabase.rpc('set_closing_counts',{p_count_date:AUDIT_BASELINE_DATE,p_branch_id:br,p_items:items});if(error)throw error;
        await loadClosingCounts();pend[br]={};toast(`Saved ${items.length} counts`,'success');draw();}
      catch(e){fail(e,'Save failed');}finally{$('#ccSave').disabled=false;}
    };
    draw();
  },
  async variance(){
    const physical=state.branches.filter(b=>b.is_active!==false);
    const wh=physical.find(b=>b.name==='Warehouse')||physical[0];
    content.innerHTML=`<div class="report-controls"><label>Location<select id="vBranch"><option value="${wh.id}" selected>Bakery Warehouse</option></select></label><label>Show<select id="vFilter"><option value="all">All products</option><option value="audit">Audit variances only</option><option value="var">Count variances only</option><option value="uncounted">Not counted yet</option></select></label><label>Search<input id="vSearch" placeholder="Product or SKU"></label><button class="btn" id="vExcel">Excel</button></div>
      <div id="vKpis"></div><div id="vExp" class="info-banner hidden"></div><div class="table-card"><div class="table-wrap"><table class="data-table" id="vTable"></table></div></div>
      <div class="page-actions" style="margin-top:12px"><span class="muted small">Type what you physically counted. Variance = Counted − System. Blank = not counted.</span><label class="small">Expiry for added stock <input type="date" id="vExpiry" value="${new Date(Date.now()+6*864e5).toISOString().slice(0,10)}"></label><button class="btn primary" id="vPost" ${canPost()?'':'disabled'}>Post count adjustments</button></div>`;
    let rows=[];const key=()=>`variance_${$('#vBranch').value}_${isoToday()}`;
    let counts={};const saveCounts=()=>{try{localStorage.setItem(key(),JSON.stringify(counts));}catch(e){}};
    const load=async()=>{
      const {data,error}=await supabase.rpc('variance_report',{p_branch_id:Number($('#vBranch').value)});if(error)return toast(error.message,'error');
      rows=data||[];try{counts=JSON.parse(localStorage.getItem(key())||'{}');}catch(e){counts={};}draw();
    };
    const auditOpen=r=>auditBaseline(r.product_name);
    const auditVar=r=>{const o=auditOpen(r);return o===null?null:Number(r.system_qty)-(o+Number(r.received)+Number(r.transfer_in)+Number(r.transfer_out)+Number(r.waste)+Number(r.adjustments));};
    const calc=r=>{const c=counts[r.product_id];const has=c!==undefined&&c!=='';const v=has?Number(c)-Number(r.system_qty):null;return {has,v,val:has?v*Number(r.unit_cost||0):0};};
    const vcell=v=>v===null?'<span class="muted">—</span>':v===0?'<span class="var-zero">0</span>':v>0?`<span class="var-pos">+${qty(v)}</span>`:`<span class="var-neg">−${qty(Math.abs(v))}</span>`;
    const summary=()=>{
      let over=0,short=0,overV=0,shortV=0,counted=0;
      rows.forEach(r=>{const c=calc(r);if(c.has){counted++;if(c.v>0){over+=c.v;overV+=c.val;}else if(c.v<0){short+=-c.v;shortV+=-c.val;}}});
      const av=rows.map(auditVar).filter(x=>x!==null),avPos=av.filter(x=>x>0).reduce((a,b)=>a+b,0),avNeg=av.filter(x=>x<0).reduce((a,b)=>a+b,0),avN=av.filter(x=>x!==0).length;
      $('#vKpis').innerHTML=`<div class="kpi-grid kpi-grid-5">${kpi('Audit variance vs 30/09 verified',(avPos+avNeg>0?'+':avPos+avNeg<0?'−':'')+qty(Math.abs(avPos+avNeg)),`${avN} product(s) differ · +${qty(avPos)} / −${qty(Math.abs(avNeg))}`,avN?'out':'healthy')}${kpi('Counted',`${counted} / ${rows.length}`,'Products with a count','blue')}${kpi('Over (+)',`+${qty(over)}`,'+ '+money(overV),'healthy')}${kpi('Short (−)',`−${qty(short)}`,'− '+money(shortV),'out')}${kpi('Net units',(over-short>0?'+':over-short<0?'−':'')+qty(Math.abs(over-short)),'Over minus short','neutral')}${kpi('Net value',(overV-shortV<0?'− ':overV-shortV>0?'+ ':'')+money(Math.abs(overV-shortV)),'At average cost','purple')}</div>`;
      const diffs=rows.filter(r=>{const c=calc(r);return c.has&&c.v!==0;});
      $('#vPost').textContent=`Post count adjustments (${diffs.length})`;$('#vPost').disabled=!canPost()||!diffs.length;
    };
    const draw=()=>{
      const f=$('#vFilter').value,q=$('#vSearch').value.trim().toLowerCase();
      summary();
      const vis=rows.filter(r=>{const c=calc(r);if(f==='audit'&&!(auditVar(r)!==null&&auditVar(r)!==0))return false;if(f==='var'&&!(c.has&&c.v!==0))return false;if(f==='uncounted'&&c.has)return false;if(q&&!(`${r.product_name} ${r.product_code}`.toLowerCase().includes(q)))return false;return true;});
      $('#vTable').innerHTML=`<thead><tr><th>SKU</th><th>Product</th><th class="r">Audit variance</th><th class="r">Verified opening 30/09</th><th class="r">Opening (system)</th><th class="r">Received</th><th class="r">Transf. in</th><th class="r">Transf. out</th><th class="r">Waste</th><th class="r">Adjust.</th><th class="r">Expected</th><th class="r">System</th><th class="r">Counted</th><th class="r">Variance</th><th class="r">Value</th></tr></thead><tbody>${vis.map(r=>{const c=calc(r);return `<tr><td>${esc(r.product_code)}</td><td>${esc(r.product_name)}</td><td class="r">${vcell(auditVar(r))}</td><td class="r">${auditOpen(r)===null?'<span class="muted">—</span>':qty(auditOpen(r))}</td><td class="r">${qty(r.opening)}</td><td class="r">${qty(r.received)}</td><td class="r">${qty(r.transfer_in)}</td><td class="r">${qty(r.transfer_out)}</td><td class="r">${qty(r.waste)}</td><td class="r">${qty(r.adjustments)}</td><td class="r">${qty(r.expected)}</td><td class="r"><b>${qty(r.system_qty)}</b></td><td class="r"><input class="v-count" data-pid="${r.product_id}" type="number" min="0" step="any" value="${counts[r.product_id]??''}"></td><td class="r v-var">${vcell(c.v)}</td><td class="r v-val">${c.has&&c.v!==0?(c.val>0?'+':'−')+money(Math.abs(c.val)):'—'}</td></tr>`;}).join('')||'<tr><td colspan="15" class="empty">No products</td></tr>'}</tbody>`;
      $$('.v-count').forEach(inp=>inp.oninput=()=>{const id=Number(inp.dataset.pid);if(inp.value==='')delete counts[id];else counts[id]=inp.value;saveCounts();
        const r=rows.find(x=>x.product_id===id),c=calc(r),tr=inp.closest('tr');$('.v-var',tr).innerHTML=vcell(c.v);$('.v-val',tr).textContent=c.has&&c.v!==0?(c.val>0?'+':'−')+money(Math.abs(c.val)):'—';summary();});
      const exp=rows.filter(r=>Number(r.expected)!==Number(r.system_qty));
      $('#vExp').classList.toggle('hidden',!exp.length);if(exp.length)$('#vExp').textContent=`${exp.length} product(s) have a ledger total that differs from system stock — investigate: ${exp.slice(0,5).map(r=>r.product_name).join(', ')}`;
    };
    $('#vBranch').onchange=load;$('#vFilter').onchange=draw;$('#vSearch').oninput=draw;
    $('#vExcel').onclick=()=>{const out=rows.map(r=>{const c=calc(r);return {...r,counted:c.has?Number(counts[r.product_id]):'',variance:c.has?c.v:'',value:c.has?c.val:''};});exportRowsExcel(out,[{key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},{key:'opening',label:'Opening'},{key:'received',label:'Received'},{key:'transfer_in',label:'Transfer In'},{key:'transfer_out',label:'Transfer Out'},{key:'waste',label:'Waste'},{key:'adjustments',label:'Adjustments'},{key:'expected',label:'Expected'},{key:'system_qty',label:'System'},{key:'counted',label:'Counted'},{key:'variance',label:'Variance (+/-)'},{key:'value',label:'Variance Value'}],`joffreys-variance-${isoToday()}`);};
    $('#vPost').onclick=async()=>{
      const diffs=rows.filter(r=>{const c=calc(r);return c.has&&c.v!==0;});const exp=$('#vExpiry').value;
      if(diffs.some(r=>calc(r).v>0)&&!exp)return toast('Set an expiry date for added stock','error');
      if(!confirm(`Post ${diffs.length} physical-count adjustment(s)? This changes stock.`))return;
      $('#vPost').disabled=true;let ok=0;const errs=[];
      for(const r of diffs){const {error}=await supabase.rpc('post_adjustment_v2',{p_adjustment_date:isoToday(),p_product_id:r.product_id,p_branch_id:Number($('#vBranch').value),p_mode:'PHYSICAL_COUNT',p_quantity:Number(counts[r.product_id]),p_reason:'Physical count',p_expiry_date:calc(r).v>0?exp:null,p_batch_no:null,p_notes:'Posted from Variance page',p_posting_key:crypto.randomUUID()});if(error)errs.push(`${r.product_name}: ${error.message}`);else{ok++;delete counts[r.product_id];}}
      saveCounts();await requireData(true);await load();
      toast(errs.length?`${ok} posted, ${errs.length} failed: ${errs[0]}`:`${ok} adjustment(s) posted`,errs.length?'error':undefined);
    };
    await load();
  },

  async replenishment(){
    const {data,error}=await supabase.rpc('replenishment_suggestions');if(error)throw error;
    const rows=(data||[]).map(r=>({...r,branch_label:locationName(r.branch_name)}));
    const tr=rows.filter(r=>Number(r.suggested_transfer)>0), od=[...new Map(rows.filter(r=>Number(r.suggested_order)>0).map(r=>[r.product_id,r])).values()];
    content.innerHTML=`<div class="kpi-grid kpi-grid-3">${kpi('Transfers to send',qty(tr.length),'Products below 2 days of branch cover','blue')}${kpi('Units to transfer',qty(tr.reduce((a,r)=>a+Number(r.suggested_transfer),0)),'Warehouse to branch','purple')}${kpi('Products to order',qty(od.length),'Warehouse below 3 days of cover','neutral')}</div>
      <div class="info-banner">Suggestions use the last 14 days of warehouse-to-branch transfers as daily demand. Branch target = 2 days of cover, warehouse target = 3 days of cover. They update automatically as stock changes.</div>
      <div class="dash-section-head"><h3>Suggested transfers</h3><span>Warehouse to branch</span></div><div id="repTransfer"></div>
      <div class="dash-section-head"><h3>Suggested supplier order</h3><span>Warehouse stock vs demand</span></div><div id="repOrder"></div>`;
    renderDataTable('#repTransfer',tr,[{key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},{key:'branch_label',label:'To'},{key:'branch_stock',label:'Branch Stock',type:'qty',align:'right'},{key:'warehouse_stock',label:'Warehouse Stock',type:'qty',align:'right'},{key:'avg_daily_demand',label:'Avg / Day',type:'qty',align:'right'},{key:'suggested_transfer',label:'Suggested Qty',type:'qty',align:'right'}],{filename:'joffreys-suggested-transfers',title:'Joffrey’s Bakery Suggested Transfers',pageSize:100});
    renderDataTable('#repOrder',od,[{key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},{key:'warehouse_stock',label:'Warehouse Stock',type:'qty',align:'right'},{key:'warehouse_avg_daily',label:'Avg / Day',type:'qty',align:'right'},{key:'suggested_order',label:'Suggested Order',type:'qty',align:'right'}],{filename:'joffreys-suggested-order',title:'Joffrey’s Bakery Suggested Supplier Order',pageSize:100});
  },

  async history(){
    const {data,error}=await supabase.from('daily_stock_snapshots').select('snapshot_date,branch_id,quantity,value').order('snapshot_date',{ascending:false}).limit(20000);if(error)throw error;
    const by=new Map();(data||[]).forEach(r=>{const o=by.get(r.snapshot_date)||{date:r.snapshot_date,units:0,value:0};o.units+=Number(r.quantity||0);o.value+=Number(r.value||0);by.set(r.snapshot_date,o);});
    const days=[...by.values()].sort((a,b)=>a.date<b.date?1:-1);
    const last=[...days].slice(0,14).reverse();
    content.innerHTML=`<div class="info-banner">A full stock snapshot is saved automatically every night at 23:55 (Riyadh). No action needed.</div>
      <div class="chart-grid">${trendChart('Inventory value by day (SAR)',last.map(d=>({label:dateFmt(d.date),value:d.value})),COLORS.receiving,v=>num(v,0))}${trendChart('Units in stock by day',last.map(d=>({label:dateFmt(d.date),value:d.units})),COLORS.transfer)}</div>
      <div class="dash-section-head"><h3>Snapshots</h3><span>${days.length} day(s)</span></div><div id="histTable"></div>`;
    renderDataTable('#histTable',days,[{key:'date',label:'Date',type:'date'},{key:'units',label:'Units',type:'qty',align:'right'},{key:'value',label:'Value',type:'money',align:'right'}],{filename:'joffreys-daily-history',title:'Joffrey’s Bakery Daily History',pageSize:60});
  },

  async scan(){
    content.innerHTML=`<div class="panel scan-panel"><h3>Scan a supplier invoice</h3><p class="muted">Take or choose a photo of the Devon invoice. The app reads every line, matches your products and drafts the receiving. You review and confirm before anything is saved.</p>
      <input id="scanFile" type="file" accept="image/*" capture="environment" /> <button class="btn primary" id="scanBtn" ${canPost()?'':'disabled'}>Read invoice</button><div id="scanOut" class="scan-out"></div></div>`;
    $('#scanBtn').onclick=scanInvoiceFlow;
  },
  async reports(){renderReportsShell();},

  async suppliers(){
    const {data,error}=await supabase.from('v_supplier_summary_report').select('*').order('supplier_name');if(error)throw error;
    content.innerHTML=`<div id="supplierTable"></div>`;renderDataTable('#supplierTable',data||[],[
      {key:'supplier_name',label:'Supplier'},{key:'is_active',label:'Status',render:v=>statusBadge(v?'Active':'Inactive')},{key:'active_products',label:'Active Products',type:'qty',align:'right'},
      {key:'contact_name',label:'Contact'},{key:'phone',label:'Phone'},{key:'email',label:'Email'},{key:'total_received_units',label:'Total Received',type:'qty',align:'right'},
      {key:'total_receiving_value',label:'Receiving Value',type:'money',align:'right'},{key:'latest_receiving_date',label:'Latest Receiving',type:'date'}
    ],{filters:[{key:'is_active',label:'Status'}],filename:'joffreys-suppliers',title:'Joffrey’s Bakery Supplier Summary',pageSize:50});
  },

  async products(){
    const supplierMap=Object.fromEntries(state.suppliers.map(x=>[x.id,x.name]));
    const rows=state.allProducts.map(p=>({...p,supplier_name:supplierMap[p.supplier_id]||'—',reorder_threshold:Math.max(Number(p.low_stock_alert||0),Number(p.reorder_level||0),Number(p.minimum_stock||0))}));
    content.innerHTML=`<div class="info-banner">Product IDs and SKUs are protected by history. This page is read-only; use deactivation rather than deletion for master-data changes.</div><div id="productTable"></div>`;
    renderDataTable('#productTable',rows,[
      {key:'product_code',label:'SKU'},{key:'name',label:'Product Name'},{key:'category',label:'Category'},{key:'supplier_name',label:'Supplier'},{key:'unit',label:'Unit'},
      {key:'unit_price',label:'Selling Price',type:'money',align:'right'},{key:'unit_cost',label:'Unit Cost',type:'money',align:'right'},{key:'reorder_threshold',label:'Reorder Threshold',type:'qty',align:'right'},
      {key:'is_active',label:'Status',render:v=>statusBadge(v?'Active':'Inactive')}
    ],{filters:[{key:'supplier_name',label:'Supplier'},{key:'category',label:'Category'},{key:'is_active',label:'Status'}],filename:'joffreys-products',title:'Joffrey’s Bakery Product Master',pageSize:50});
  }
};

function groupTransactionDates(rows,kind){
  const byDate=new Map();
  const txnKey=kind==='receiving'?'receiving_id':'transfer_id';
  const valueKey=kind==='receiving'?'total_cost':'total_value';
  const partyKey=kind==='receiving'?'supplier_name':'to_branch';
  for(const r of rows||[]){
    const date=String(r.date||'').slice(0,10)||'';
    if(!date)continue;
    if(!byDate.has(date))byDate.set(date,{date,rows:[],transactions:new Set(),units:0,value:0,parties:new Set()});
    const g=byDate.get(date);
    g.rows.push(r);
    g.transactions.add(r[txnKey]??r.reference_no??r.id);
    g.units+=Number(r.quantity||0);
    g.value+=Number(r[valueKey]||0);
    if(r[partyKey])g.parties.add(kind==='transfer'?locationName(r[partyKey]):r[partyKey]);
  }
  return [...byDate.values()].sort((a,b)=>b.date.localeCompare(a.date));
}

function renderTransactionDateList(host,groups,kind){
  const el=$(host);
  const label=kind==='receiving'?'Receiving':'Transfer';
  const partyLabel=kind==='receiving'?'Supplier(s)':'Destination(s)';
  if(!groups.length){el.innerHTML='<div class="panel empty">No transactions found.</div>';return;}
  el.innerHTML=`<div class="table-card">
    <div class="table-toolbar"><div><strong>${esc(label)} by Date</strong><div class="muted small">Click any date row or the View button to open the complete daily document.</div></div></div>
    <div class="table-wrap"><table class="data-table transaction-date-table"><thead><tr>
      <th>Date</th><th>Transactions</th><th>Lines</th><th>Units</th><th>Value</th><th>${partyLabel}</th><th>Action</th>
    </tr></thead><tbody>
      ${groups.map(g=>`<tr class="transaction-date-row" data-view-date="${esc(g.date)}" tabindex="0" role="button" aria-label="Open ${esc(label)} for ${esc(dateFmt(g.date))}">
        <td><strong>${esc(dateFmt(g.date))}</strong></td>
        <td>${qty(g.transactions.size)}</td><td>${qty(g.rows.length)}</td><td>${qty(g.units)}</td><td>${money(g.value)}</td>
        <td>${esc([...g.parties].join(', ')||'—')}</td>
        <td><button type="button" class="btn small-btn primary" data-view-date-button="${esc(g.date)}">View ${esc(label)}</button></td>
      </tr>`).join('')}
    </tbody></table></div>
  </div>`;
  const openDate=(date)=>{
    const group=groups.find(g=>g.date===date);
    if(group)openTransactionDateDetail(kind,group);
  };
  el.onclick=(event)=>{
    const button=event.target.closest('[data-view-date-button]');
    const row=event.target.closest('[data-view-date]');
    if(button){event.stopPropagation();openDate(button.dataset.viewDateButton);return;}
    if(row)openDate(row.dataset.viewDate);
  };
  el.onkeydown=(event)=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    const row=event.target.closest('[data-view-date]');
    if(row){event.preventDefault();openDate(row.dataset.viewDate);}
  };
}

function openTransactionDateDetail(kind,group){
  const receiving=kind==='receiving';
  const title=`${receiving?'Receiving':'Transfer'} — ${dateFmt(group.date)}`;
  const columns=receiving?[
    {key:'date',label:'Date',type:'date'},{key:'reference_no',label:'Receiving Reference'},{key:'invoice_no',label:'Invoice Number'},
    {key:'supplier_name',label:'Supplier'},{key:'branch_name',label:'Location',type:'location'},{key:'product_code',label:'SKU'},
    {key:'product_name',label:'Product'},{key:'category_name',label:'Category'},{key:'unit',label:'Unit'},
    {key:'quantity',label:'Qty',type:'qty',align:'right'},{key:'unit_cost',label:'Unit Cost',type:'money',align:'right'},
    {key:'total_cost',label:'Value',type:'money',align:'right'},{key:'expiry_date',label:'Expiry',type:'date'},
    {key:'batch_no',label:'Batch'},{key:'performed_by',label:'Performed By'}
  ]:[
    {key:'date',label:'Date',type:'date'},{key:'reference_no',label:'Transfer Reference'},{key:'from_branch',label:'From',type:'location'},
    {key:'to_branch',label:'To',type:'location'},{key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},
    {key:'category_name',label:'Category'},{key:'unit',label:'Unit'},{key:'quantity',label:'Qty',type:'qty',align:'right'},
    {key:'unit_cost',label:'Unit Cost',type:'money',align:'right'},{key:'total_value',label:'Value',type:'money',align:'right'},
    {key:'performed_by',label:'Performed By'}
  ];
  const rows=group.rows;
  const subtitle=receiving
    ? 'All supplier receiving lines posted on this operational date.'
    : 'All warehouse-to-branch transfer lines posted on this operational date.';
  openModal(title,subtitle,`<div class="daily-document">
    <div class="kpi-grid kpi-grid-3">
      ${kpi('Transactions',qty(group.transactions.size),receiving?'Receiving documents':'Transfer documents')}
      ${kpi('Total Units',qty(group.units),'All lines')}
      ${kpi('Total Value',money(group.value),receiving?'Receiving cost':'Transferred stock value')}
    </div>
    <div class="page-actions">
      <button class="btn primary" id="printDailyTransaction">Print Invoices (A4)</button>
      <button class="btn" id="exportDailyTransaction">Excel</button>
      <button class="btn" id="closeDailyTransaction">Close</button>
    </div>
    <div id="dailyTransactionTable"></div>
  </div>`,'wide');
  renderDataTable('#dailyTransactionTable',rows,columns,{
    filters:receiving?[{key:'supplier_name',label:'Supplier'},{key:'reference_no',label:'Reference'}]:[{key:'to_branch',label:'Destination',type:'location'},{key:'reference_no',label:'Reference'}],
    filename:`joffreys-${kind}-${group.date}`,title:`Joffrey’s Bakery ${title}`,pageSize:100
  });
  $('#printDailyTransaction').onclick=()=>printInvoices(kind,rows,group.date);
  $('#exportDailyTransaction').onclick=()=>exportRowsExcel(rows,columns,`joffreys-${kind}-${group.date}`);
  $('#closeDailyTransaction').onclick=closeModal;
}

function productOptions(supplierId=null){return state.products.filter(p=>!supplierId||Number(p.supplier_id)===Number(supplierId)).map(p=>`<option value="${p.id}">${esc(p.product_code||p.ref_no)} — ${esc(p.name)}</option>`).join('');}
function supplierOptions(){return state.suppliers.filter(s=>s.is_active).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');}
function branchOptions(excludeWarehouse=false){return state.branches.filter(b=>!excludeWarehouse||b.id!==state.warehouse?.id).map(b=>`<option value="${b.id}">${esc(locationName(b.name))}</option>`).join('');}
function openModal(title,subtitle,body,size='normal'){$('#modalTitle').textContent=title;$('#modalSubtitle').textContent=subtitle||'';modalBody.innerHTML=body;modal.className=`modal ${size}`;modal.showModal();}
function closeModal(){if(modal.open)modal.close();modalBody.innerHTML='';modal.className='modal';}

function receivingLineHeader(){return `<div class="erp-line-header receiving-head"><span></span><span>SKU</span><span>Product</span><span>Qty</span><span>Unit Cost</span><span>Expiry Date</span><span>Batch No.</span><span>Line Value</span><span></span></div>`;}
function transferLineHeader(){return `<div class="erp-line-header transfer-head"><span></span><span>SKU</span><span>Product</span><span>Available</span><span>Qty</span><span>Unit Cost</span><span>Value</span><span></span></div>`;}
function receivingLineHtml(supplierId=null){return `<div class="erp-line receiving-line" data-line><label class="pick"><input type="checkbox" class="line-check"></label><label><input class="li-sku" readonly placeholder="—"></label><label class="product-cell"><select class="li-product" required><option value="">${supplierId?'Select product':'Select supplier first'}</option>${supplierId?productOptions(supplierId):''}</select><small class="li-meta">Category · Unit</small></label><label><input class="li-qty" type="number" min="0.01" step="0.01" required></label><label><input class="li-cost" type="number" min="0" step="0.01" required></label><label><input class="li-expiry" type="date" required></label><label><input class="li-batch" placeholder="Optional"></label><label><input class="li-value" readonly></label><button type="button" class="line-remove" title="Remove">✕</button></div>`;}
function transferLineHtml(){return `<div class="erp-line transfer-line" data-line><label class="pick"><input type="checkbox" class="line-check"></label><label><input class="li-sku" readonly placeholder="—"></label><label class="product-cell"><select class="li-product" required><option value="">Select product</option>${productOptions()}</select><small class="li-meta">Category · Unit</small></label><label><input class="li-available" readonly></label><label><input class="li-qty" type="number" min="0.01" step="0.01" required></label><label><input class="li-cost" readonly></label><label><input class="li-value" readonly></label><button type="button" class="line-remove" title="Remove">✕</button></div>`;}

function bindReceivingLines(container){
  $$('[data-line]',container).forEach(row=>{if(row.dataset.bound)return;row.dataset.bound='1';const sel=$('.li-product',row),q=$('.li-qty',row),cost=$('.li-cost',row),value=$('.li-value',row),sku=$('.li-sku',row),meta=$('.li-meta',row);$('.line-remove',row).onclick=()=>{if($$('[data-line]',container).length>1)row.remove();};const calc=()=>value.value=money(Number(q.value||0)*Number(cost.value||0));sel.onchange=()=>{const p=state.products.find(x=>String(x.id)===sel.value);if(p){sku.value=p.ref||p.sku||p.code||'';cost.value=Number(p.unit_cost||0).toFixed(2);meta.textContent=`${p.category||'Uncategorized'} · ${p.unit||'PCS'}`;}calc();};q.oninput=calc;cost.oninput=calc;});
}
function syncReceivingSupplier(container,supplierId){
  $$('[data-line]',container).forEach(row=>{const sel=$('.li-product',row);const current=Number(sel.value||0);const allowed=state.products.some(p=>p.id===current&&Number(p.supplier_id)===Number(supplierId));sel.innerHTML=`<option value="">${supplierId?'Select product':'Select supplier first'}</option>${supplierId?productOptions(supplierId):''}`;if(allowed)sel.value=String(current);else{sel.value='';$('.li-cost',row).value='';$('.li-value',row).value='';$('.li-meta',row).textContent='Category · Unit';}});
}
function syncReceivingExpiryMin(container,receivedDate){
  $$('.li-expiry',container).forEach(input=>{input.min=receivedDate||INVENTORY_START_DATE;if(input.value&&receivedDate&&input.value<receivedDate)input.value='';});
}
function bindTransferLines(container,stockMap){
  $$('[data-line]',container).forEach(row=>{if(row.dataset.bound)return;row.dataset.bound='1';const sel=$('.li-product',row),q=$('.li-qty',row),cost=$('.li-cost',row),value=$('.li-value',row),available=$('.li-available',row),sku=$('.li-sku',row),meta=$('.li-meta',row);$('.line-remove',row).onclick=()=>{if($$('[data-line]',container).length>1)row.remove();};const calc=()=>value.value=money(Number(q.value||0)*Number(cost.value||0));sel.onchange=()=>{const p=state.products.find(x=>String(x.id)===sel.value),pos=stockMap.get(Number(sel.value));if(p){sku.value=p.ref||p.sku||p.code||'';cost.value=Number(p.unit_cost||0).toFixed(2);meta.textContent=`${p.category||'Uncategorized'} · ${p.unit||'PCS'}`;}available.value=qty(pos?.available_quantity||0);calc();};q.oninput=calc;});
}
function validateUniqueProducts(rows){const ids=rows.map(r=>Number($('.li-product',r)?.value)).filter(Boolean);if(new Set(ids).size!==ids.length)throw new Error('Duplicate product line');}
function calculateReceiving(container){for(const row of $$('[data-line]',container)){const q=Number($('.li-qty',row).value||0),c=Number($('.li-cost',row).value||0);$('.li-value',row).value=money(q*c);}}
function calculateTransfer(container){for(const row of $$('[data-line]',container)){const q=Number($('.li-qty',row).value||0),c=Number($('.li-cost',row).value||0);$('.li-value',row).value=money(q*c);}}

async function saveLocked(form,action,handler){
  if(form.dataset.saving==='1')return;try{assertOnline();}catch(e){return fail(e,'Could not save');}
  form.dataset.saving='1';const buttons=$$('[data-save]',form);const originals=buttons.map(b=>b.textContent);buttons.forEach(b=>{b.disabled=true;b.textContent='Saving…';});
  try{await handler(action);}catch(e){fail(e,'Could not save');}finally{form.dataset.saving='0';buttons.forEach((b,i)=>{b.disabled=false;b.textContent=originals[i];});}
}
async function afterTransactionSaved(page,message,action,newFn){
  toast(message,'success');closeModal();
  try{await requireData(true);if(action==='new'){newFn();return;}await go(page,true);}catch(e){console.error(e);toast('Transaction saved, but refresh failed. Do not save it again.','warn');}
}

function openReceiving(){
  if(!canPost())return toast('Your role cannot post receiving','error');if(!state.warehouse)return toast('Bakery Warehouse is not configured','error');const postingKey=newPostingKey();
  openModal('Receiving Transaction','Oracle-style receiving document. Receiving posts only to Bakery Warehouse; expiry is required for every line.',`<form id="receiveForm" class="oracle-txn-form"><div class="oracle-doc-bar"><div><b>RECEIVING</b><span>Inventory Receiving Transaction</span></div><div class="oracle-status">ENTER / REVIEW</div></div><div class="form-grid grid-3-form oracle-header-grid"><label>Reference No.<input id="rRef" required placeholder="e.g. RC2609-00001"></label><label>Receiving Date<input id="rDate" type="date" required min="${INVENTORY_START_DATE}" max="${isoToday()}" value="${isoToday()}"></label><label>Supplier<select id="rSupplier" required><option value="">Select supplier</option>${supplierOptions()}</select></label><label>Invoice No.<input id="rInvoice" placeholder="Supplier invoice number"></label><label>Receiving Location<input value="Bakery Warehouse" readonly></label><label>Transaction Type<input value="Standard Receiving" readonly></label><label class="span-3">Notes<textarea id="rNotes" placeholder="Optional receiving notes"></textarea></label></div><div class="info-banner oracle-note">Select the supplier first. Products are filtered to that supplier. Every receiving line requires quantity, unit cost and the real expiry date.</div><div class="line-toolbar oracle-toolbar"><button id="rAdd" type="button" class="btn">＋ Add Line</button><button id="rDelete" type="button" class="btn">Delete Selected</button><button id="rCalc" type="button" class="btn">Recalculate</button></div><div class="line-scroll oracle-line-scroll">${receivingLineHeader()}<div id="receiveLines" class="erp-lines">${receivingLineHtml()}</div></div><div class="oracle-total-bar"><span>Total Quantity: <b id="receiveTotalQty">0</b></span><span>Total Amount: SAR <b id="receiveTotalValue">0.00</b></span></div><div class="form-actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn" data-save data-action="new">Save & New</button><button type="submit" class="btn primary" data-save data-action="save">Save</button></div></form>`,'wide');
  const form=$('#receiveForm'),lines=$('#receiveLines');bindReceivingLines(lines);syncReceivingExpiryMin(lines,$('#rDate').value);const updateReceiveTotals=()=>{let q=0,v=0;$$('[data-line]',lines).forEach(row=>{q+=Number($('.li-qty',row)?.value||0);v+=Number($('.li-value',row)?.value||0);});$('#receiveTotalQty').textContent=qty(q);$('#receiveTotalValue').textContent=money(v);};lines.addEventListener('input',updateReceiveTotals);updateReceiveTotals();
  $('#rSupplier').onchange=()=>syncReceivingSupplier(lines,Number($('#rSupplier').value)||null);
  $('#rDate').onchange=()=>syncReceivingExpiryMin(lines,$('#rDate').value);
  $('#rAdd').onclick=()=>{const sid=Number($('#rSupplier').value)||null;lines.insertAdjacentHTML('beforeend',receivingLineHtml(sid));bindReceivingLines(lines);syncReceivingExpiryMin(lines,$('#rDate').value);updateReceiveTotals();};
  $('#rDelete').onclick=()=>{$$('.line-check:checked',lines).forEach(c=>{if($$('[data-line]',lines).length>1)c.closest('[data-line]').remove();});updateReceiveTotals();};$('#rCalc').onclick=()=>{calculateReceiving(lines);updateReceiveTotals();};$('[data-cancel]',form).onclick=closeModal;
  form.onsubmit=e=>{e.preventDefault();const action=e.submitter?.dataset.action||'save';saveLocked(form,action,async()=>{const supplierId=Number($('#rSupplier').value);if(!supplierId)throw new Error('Supplier is required');const rows=$$('[data-line]',lines);validateUniqueProducts(rows);const items=rows.map(row=>({product_id:Number($('.li-product',row).value),quantity:Number($('.li-qty',row).value),unit_cost:Number($('.li-cost',row).value),expiry_date:$('.li-expiry',row).value||null,batch_no:$('.li-batch',row).value.trim()||null,notes:null}));if(items.some(x=>!x.product_id||x.quantity<=0||x.unit_cost<0||!x.expiry_date))throw new Error('Product, quantity, cost and expiry are required on every receiving line');if(items.some(x=>Number(state.products.find(p=>p.id===x.product_id)?.supplier_id)!==supplierId))throw new Error('One or more products do not belong to the selected supplier');const {data,error}=await supabase.rpc('post_receiving',{p_received_date:$('#rDate').value,p_reference_no:$('#rRef').value.trim(),p_invoice_no:$('#rInvoice').value.trim()||null,p_supplier_id:supplierId,p_branch_id:state.warehouse.id,p_items:items,p_notes:$('#rNotes').value.trim()||null,p_posting_key:postingKey});if(error)throw error;await afterTransactionSaved('receiving',`Receiving ${data.reference_no||'#'+data.id} saved${data.duplicate?' (already posted)':''}`,action,openReceiving);});};
}

function openTransfer(){
  if(!canPost())return toast('Your role cannot post transfers','error');if(!state.warehouse)return toast('Bakery Warehouse is not configured','error');const postingKey=newPostingKey();const whRows=state.positions.filter(x=>x.branch_id===state.warehouse.id);const stockMap=new Map(whRows.map(x=>[x.product_id,x]));
  openModal('Transfer Transaction','Oracle-style inventory transfer. Source is fixed to Bakery Warehouse and destination must be an active branch.',`<form id="transferForm" class="oracle-txn-form"><div class="oracle-doc-bar"><div><b>INVENTORY TRANSFER</b><span>Branch / Cost Center Transfer</span></div><div class="oracle-status">ENTER / REVIEW</div></div><div class="form-grid grid-3-form oracle-header-grid"><label>Transfer Reference<input id="tRef" required placeholder="e.g. TR2609-00040"></label><label>Transfer Date<input id="tDate" type="date" required min="${INVENTORY_START_DATE}" max="${isoToday()}" value="${isoToday()}"></label><label>From Cost Center<input value="BAKERY JEDDAH" readonly></label><label>To Cost Center<select id="tTo" required><option value="">Select destination</option>${branchOptions(true)}</select></label><label>Document Type<input value="Internal Inventory Transfer" readonly></label><label>Status<input value="Draft / Review" readonly></label><label class="span-3">Notes<textarea id="tNotes" placeholder="Optional transfer notes"></textarea></label></div><div class="line-toolbar oracle-toolbar"><button id="tAdd" type="button" class="btn">＋ Add Line</button><button id="tDelete" type="button" class="btn">Delete Selected</button><button id="tCalc" type="button" class="btn">Recalculate</button></div><div class="line-scroll oracle-line-scroll">${transferLineHeader()}<div id="transferLines" class="erp-lines">${transferLineHtml()}</div></div><div class="oracle-total-bar"><span>Total Quantity: <b id="transferTotalQty">0</b></span><span>Total Value: SAR <b id="transferTotalValue">0.00</b></span></div><div class="form-actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn" data-save data-action="new">Save & New</button><button type="submit" class="btn primary" data-save data-action="save">Save</button></div></form>`,'wide');
  const form=$('#transferForm'),lines=$('#transferLines');bindTransferLines(lines,stockMap);const updateTransferTotals=()=>{let q=0,v=0;$$('[data-line]',lines).forEach(row=>{q+=Number($('.li-qty',row)?.value||0);v+=Number($('.li-value',row)?.value||0);});$('#transferTotalQty').textContent=qty(q);$('#transferTotalValue').textContent=money(v);};lines.addEventListener('input',updateTransferTotals);updateTransferTotals();$('#tAdd').onclick=()=>{lines.insertAdjacentHTML('beforeend',transferLineHtml());bindTransferLines(lines,stockMap);updateTransferTotals();};$('#tDelete').onclick=()=>{$$('.line-check:checked',lines).forEach(c=>{if($$('[data-line]',lines).length>1)c.closest('[data-line]').remove();});updateTransferTotals();};$('#tCalc').onclick=()=>{calculateTransfer(lines);updateTransferTotals();};$('[data-cancel]',form).onclick=closeModal;
  form.onsubmit=e=>{e.preventDefault();const action=e.submitter?.dataset.action||'save';saveLocked(form,action,async()=>{const rows=$$('[data-line]',lines);validateUniqueProducts(rows);const items=rows.map(row=>{const product_id=Number($('.li-product',row).value),quantity=Number($('.li-qty',row).value),available=Number(stockMap.get(product_id)?.available_quantity||0);if(quantity>available)throw new Error(`Insufficient stock for ${state.products.find(p=>p.id===product_id)?.name||'product'}: available ${qty(available)}`);return {product_id,quantity,notes:null};});if(items.some(x=>!x.product_id||x.quantity<=0))throw new Error('Invalid transfer line quantity');const {data,error}=await supabase.rpc('post_transfer',{p_transfer_date:$('#tDate').value,p_reference_no:$('#tRef').value.trim(),p_to_branch_id:Number($('#tTo').value),p_items:items,p_notes:$('#tNotes').value.trim()||null,p_posting_key:postingKey});if(error)throw error;await afterTransactionSaved('transfers',`Transfer ${data.reference_no||'#'+data.id} saved${data.duplicate?' (already posted)':''}`,action,openTransfer);});};
}

function openAdjustment(){
  if(!canPost())return toast('Your role cannot post adjustments','error');const postingKey=newPostingKey();
  openModal('New Adjustment','If the adjustment adds physical stock, enter the real expiry date from the product label.',`<form id="adjustForm"><div class="form-grid"><label>Date<input id="aDate" type="date" required min="${INVENTORY_START_DATE}" max="${isoToday()}" value="${isoToday()}"></label><label>Location<select id="aBranch" required>${branchOptions()}</select></label><label class="full">Product<select id="aProduct" required><option value="">Select product</option>${productOptions()}</select></label><label>Current System Quantity<input id="aCurrent" readonly></label><label>Mode<select id="aMode"><option value="DELTA">Quantity Adjustment (+/-)</option><option value="PHYSICAL_COUNT">Physical Count</option></select></label><label id="aQtyLabel">Adjustment Quantity (+/-)<input id="aQty" type="number" step="0.01" required></label><label>Reason<select id="aReason" required><option>Physical Count</option><option>Damage</option><option>System Correction</option><option>Other</option></select></label><label id="aExpiryWrap">Expiry for Added Stock<input id="aExpiry" type="date"></label><label>Batch for Added Stock<input id="aBatch" placeholder="Optional"></label><label class="full">Notes<textarea id="aNotes"></textarea></label></div><div class="form-actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn" data-save data-action="new">Save & New</button><button type="submit" class="btn primary" data-save data-action="save">Save</button></div></form>`);
  const form=$('#adjustForm');$('[data-cancel]',form).onclick=closeModal;
  const currentQty=()=>{const p=Number($('#aProduct').value),b=Number($('#aBranch').value),pos=state.positions.find(x=>x.product_id===p&&x.branch_id===b);return Number(pos?.available_quantity||0);};
  const expectedDiff=()=>{const mode=$('#aMode').value,q=Number($('#aQty').value||0),cur=currentQty();return mode==='PHYSICAL_COUNT'?q-cur:q;};
  const syncExpiryRequirement=()=>{const needs=expectedDiff()>0;$('#aExpiry').required=needs;$('#aExpiryWrap').classList.toggle('expiry-required',needs);};
  const refreshCurrent=()=>{$('#aCurrent').value=qty(currentQty());syncExpiryRequirement();};
  $('#aProduct').onchange=refreshCurrent;$('#aBranch').onchange=refreshCurrent;$('#aQty').oninput=syncExpiryRequirement;$('#aMode').onchange=()=>{$('#aQtyLabel').firstChild.textContent=$('#aMode').value==='PHYSICAL_COUNT'?'Physical Count':'Adjustment Quantity (+/-)';syncExpiryRequirement();};
  form.onsubmit=e=>{e.preventDefault();const action=e.submitter?.dataset.action||'save';saveLocked(form,action,async()=>{const mode=$('#aMode').value,q=Number($('#aQty').value),expiry=$('#aExpiry').value||null;if(mode==='DELTA'&&q===0)throw new Error('Adjustment quantity cannot be zero');if(mode==='PHYSICAL_COUNT'&&q<0)throw new Error('Physical count cannot be negative');if(expectedDiff()>0&&!expiry)throw new Error('Expiry date is required when the adjustment adds stock');const {data,error}=await supabase.rpc('post_adjustment_v2',{p_adjustment_date:$('#aDate').value,p_product_id:Number($('#aProduct').value),p_branch_id:Number($('#aBranch').value),p_mode:mode,p_quantity:q,p_reason:$('#aReason').value,p_expiry_date:expiry,p_batch_no:$('#aBatch').value.trim()||null,p_notes:$('#aNotes').value.trim()||null,p_posting_key:postingKey});if(error)throw error;await afterTransactionSaved('adjustments',`Adjustment #${data.id} saved · difference ${qty(data.difference)}`,action,openAdjustment);});};
}

async function openWaste(){
  if(!canPost())return toast('Your role cannot post waste','error');const postingKey=newPostingKey();
  openModal('Record Waste','Waste reduces available stock and consumes batches using FEFO.',`<form id="wasteForm"><div class="form-grid"><label>Date<input id="wDate" type="date" required min="${INVENTORY_START_DATE}" max="${isoToday()}" value="${isoToday()}"></label><label>Location<select id="wBranch" required>${branchOptions()}</select></label><label class="full">Product<select id="wProduct" required><option value="">Select product</option>${productOptions()}</select></label><label>Available Quantity<input id="wAvailable" readonly></label><label>Quantity<input id="wQty" type="number" min="0.01" step="0.01" required></label><label>Reason<select id="wReason" required><option>Expired</option><option>Damaged</option><option>Quality Issue</option><option>Production Waste</option><option>Returned/Unsellable</option><option>Other</option></select></label><label>Batch / Expiry<select id="wBatch"><option value="">FEFO automatically</option></select></label><label class="full">Notes<textarea id="wNotes"></textarea></label></div><div class="form-actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn" data-save data-action="new">Save & New</button><button type="submit" class="btn primary" data-save data-action="save">Save</button></div></form>`);
  const form=$('#wasteForm');$('[data-cancel]',form).onclick=closeModal;const refresh=()=>{const p=Number($('#wProduct').value),b=Number($('#wBranch').value),pos=state.positions.find(x=>x.product_id===p&&x.branch_id===b);$('#wAvailable').value=qty(pos?.available_quantity||0);const batches=state.expiry.filter(x=>x.product_id===p&&x.branch_id===b).sort((a,c)=>String(a.expiry_date||'9999').localeCompare(String(c.expiry_date||'9999')));$('#wBatch').innerHTML='<option value="">FEFO automatically</option>'+batches.map(x=>`<option value="${esc(x.expiry_date||'')}|${esc(x.batch_no||'')}">${esc(x.batch_no||'No batch')} · ${dateFmt(x.expiry_date)} · ${qty(x.remaining_quantity)} PCS</option>`).join('');};$('#wProduct').onchange=refresh;$('#wBranch').onchange=refresh;
  form.onsubmit=e=>{e.preventDefault();const action=e.submitter?.dataset.action||'save';saveLocked(form,action,async()=>{const p=Number($('#wProduct').value),b=Number($('#wBranch').value),q=Number($('#wQty').value),available=Number(state.positions.find(x=>x.product_id===p&&x.branch_id===b)?.available_quantity||0);if(q<=0)throw new Error('Invalid quantity');if(q>available)throw new Error(`Waste quantity exceeds available stock (${qty(available)})`);const expiry=$('#wBatch').value?$('#wBatch').value.split('|')[0]||null:null;const {data,error}=await supabase.rpc('post_waste',{p_waste_date:$('#wDate').value,p_product_id:p,p_branch_id:b,p_quantity:q,p_reason:$('#wReason').value,p_expiry_date:expiry,p_notes:$('#wNotes').value.trim()||null,p_posting_key:postingKey});if(error)throw error;await afterTransactionSaved('waste',`Waste #${data.id} saved`,action,openWaste);});};
}

function openBatchExpiryCorrection(){
  if(!canCorrectExpiry())return toast('Only Admin or Bakery Incharge can correct batch expiry','error');
  const live=[...state.expiry].sort((a,b)=>{const am=a.expiry_date?1:0,bm=b.expiry_date?1:0;return am-bm||String(a.product_name).localeCompare(String(b.product_name));});
  if(!live.length)return toast('No live batches available','error');const postingKey=newPostingKey();
  const opts=live.map(x=>`<option value="${x.batch_id}">${esc(x.product_code)} — ${esc(x.product_name)} · ${esc(locationName(x.branch_name))} · ${x.expiry_date?dateFmt(x.expiry_date):'MISSING EXPIRY'} · ${qty(x.remaining_quantity)} PCS</option>`).join('');
  openModal('Update Batch Expiry','Use only the real expiry date printed on the physical product. Stock quantity will not change.',`<form id="expiryFixForm"><div class="form-grid"><label class="full">Live Batch<select id="efBatch" required><option value="">Select batch</option>${opts}</select></label><label>Real Expiry Date<input id="efExpiry" type="date" required></label><label>Batch Number<input id="efBatchNo" placeholder="Optional"></label><label class="full">Reason<input id="efReason" required value="Physical label verification"></label></div><div class="form-actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn" data-save data-action="new">Save & New</button><button type="submit" class="btn primary" data-save data-action="save">Save</button></div></form>`);
  const form=$('#expiryFixForm');$('[data-cancel]',form).onclick=closeModal;
  form.onsubmit=e=>{e.preventDefault();const action=e.submitter?.dataset.action||'save';saveLocked(form,action,async()=>{const {data,error}=await supabase.rpc('correct_batch_expiry',{p_batch_id:Number($('#efBatch').value),p_expiry_date:$('#efExpiry').value,p_batch_no:$('#efBatchNo').value.trim()||null,p_reason:$('#efReason').value.trim(),p_posting_key:postingKey});if(error)throw error;await afterTransactionSaved('expiry',`Batch #${data.batch_id} expiry updated`,action,openBatchExpiryCorrection);});};
}

function renderReportsShell(){
  const r=periodRange('this_month');content.innerHTML=`<div class="report-controls"><label>Report<select id="reportType"><option value="current_stock">Current Stock Report</option><option value="valuation">Stock Valuation Report</option><option value="daily_receiving">Daily Receiving Report</option><option value="daily_transfer">Daily Transfer Report</option><option value="daily_movement">Daily Movement Report</option><option value="daily_waste">Daily Waste Report</option><option value="monthly_receiving">Monthly Receiving Summary</option><option value="monthly_transfer">Monthly Transfer Summary</option><option value="monthly_movement">Monthly Movement Summary</option><option value="monthly_waste">Monthly Waste Summary</option><option value="warehouse_shops">Bakery Warehouse vs Jeddah Shops</option><option value="supplier_summary">Supplier Summary</option><option value="category_summary">Category Summary</option><option value="low_stock">Low Stock Report</option><option value="out_stock">Out of Stock Report</option><option value="expiry">Expiry Report</option><option value="product_history">Product Movement History</option><option value="branch_transfer">Branch Transfer Summary</option><option value="adjustment">Stock Adjustment Report</option><option value="audit_difference">Quick Find — Audit Difference</option></select></label><label id="reportProductWrap" class="hidden">Product<select id="reportProduct"><option value="">Select product</option>${productOptions()}</select></label><label>From<input id="reportFrom" type="date" min="${INVENTORY_START_DATE}" max="${isoToday()}" value="${r.from}"></label><label>To<input id="reportTo" type="date" min="${INVENTORY_START_DATE}" max="${isoToday()}" value="${r.to}"></label><button id="runReport" class="btn primary">Run Report</button></div><div id="reportResult" class="report-result"><div class="panel empty">Choose a report and click Run Report.</div></div>`;
  const sync=()=>$('#reportProductWrap').classList.toggle('hidden',$('#reportType').value!=='product_history');$('#reportType').onchange=sync;sync();$('#runReport').onclick=runReport;
}
function reportDateGroups(rows,dateKey){
  const map=new Map();
  for(const row of rows||[]){const d=String(row[dateKey]||'').slice(0,10);if(!d)continue;if(!map.has(d))map.set(d,[]);map.get(d).push(row);}
  return [...map.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([date,rows])=>({date,rows}));
}
async function runReport(){
  const type=$('#reportType').value,from=$('#reportFrom').value,to=$('#reportTo').value;if(from&&to&&from>to)return toast('Invalid report date range','error');const host=$('#reportResult');
  if(type==='audit_difference'){host.innerHTML=auditDifferencePanel('reportAudit','Quick Find — Audit Difference',to);await wireAuditDifferencePanel('reportAudit',to);return;}
  host.innerHTML='<div class="panel loading">Running report…</div>';
  try{
    const result=await reportDefinition(type,from,to);
    let html=`<div class="report-head"><h3>${esc(result.title)}</h3><span>${from&&to?`${dateFmt(from)} — ${dateFmt(to)}`:'Current data'}</span></div>${result.summary||''}`;
    if(result.groupedByDate){
      html+=`<div class="info-banner"><b>${esc(result.groupLabel||'Transactions')}</b> are separated by operational date. Open a date to see every transaction line recorded on that date.</div>`;
      result.groupedByDate.forEach((g,i)=>{html+=`<section class="report-section date-report-card"><h4>${esc(dateFmt(g.date))} <span class="muted small">· ${qty(g.rows.length)} lines</span></h4><div id="reportDateSection${i}"></div></section>`;});
      host.innerHTML=html;
      result.groupedByDate.forEach((g,i)=>renderDataTable(`#reportDateSection${i}`,g.rows,result.columns,{filters:result.filters||[],filename:`joffreys-${type}-${g.date}`,title:`${result.title} — ${dateFmt(g.date)}`,pageSize:result.pageSize||100}));
      return;
    }
    html+=result.sections.map((s,i)=>`<section class="report-section"><h4>${esc(s.title||result.title)}</h4><div id="reportSection${i}"></div></section>`).join('');host.innerHTML=html;result.sections.forEach((s,i)=>renderDataTable(`#reportSection${i}`,s.rows,s.columns,{filters:s.filters||[],filename:s.filename||`joffreys-${type}-${i+1}`,title:s.title||result.title,pageSize:s.pageSize||50}));
  }catch(e){fail(e,'Report failed');host.innerHTML=`<div class="panel"><p>${esc(e.message)}</p></div>`;}
}
function monthAggregate(rows,dateKey,txnKey,qtyKey,valueKey){const m=new Map();for(const r of rows){const k=monthKey(r[dateKey]);if(!m.has(k))m.set(k,{month:k,txn:new Set(),lines:0,units:0,value:0});const x=m.get(k);x.txn.add(r[txnKey]??r.id);x.lines++;x.units+=Number(r[qtyKey]||0);x.value+=Number(r[valueKey]||0);}return [...m.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(x=>({month:x.month,transactions:x.txn.size,line_count:x.lines,units:x.units,value:x.value}));}
async function reportDefinition(type,from,to){
  const cols={stock:[{key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},{key:'category_name',label:'Category'},{key:'supplier_name',label:'Supplier'},{key:'branch_name',label:'Location',type:'location'},{key:'available_quantity',label:'Quantity',type:'qty',align:'right'},{key:'unit_cost',label:'Unit Cost',type:'money',align:'right'},{key:'stock_value',label:'Value',type:'money',align:'right'},{key:'stock_status',label:'Status',type:'badge'}]};
  if(type==='current_stock')return {title:'Current Stock Report',sections:[{rows:state.positions,columns:cols.stock,filters:[{key:'branch_name',label:'Location',type:'location'},{key:'category_name',label:'Category'},{key:'supplier_name',label:'Supplier'}]}]};
  if(type==='valuation')return {title:'Stock Valuation Report',summary:`<div class="kpi-grid kpi-grid-3">${kpi('Total Units',qty(sum(state.positions,'available_quantity')),'All active locations')}${kpi('Inventory Value',money(sum(state.positions,'stock_value')),'At product unit cost')}${kpi('Active Positions',qty(state.positions.filter(x=>Number(x.available_quantity)>0).length),'Product/location positions')}</div>`,sections:[{rows:state.positions,columns:cols.stock,filters:[{key:'branch_name',label:'Location',type:'location'},{key:'category_name',label:'Category'}]}]};
  if(type==='daily_receiving'||type==='monthly_receiving'){const {data,error}=await supabase.from('v_daily_receiving_report').select('*').gte('date',from).lte('date',to);if(error)throw error;const rows=data||[];const detailCols=[{key:'date',label:'Date',type:'date'},{key:'reference_no',label:'Reference'},{key:'invoice_no',label:'Invoice'},{key:'supplier_name',label:'Supplier'},{key:'branch_name',label:'Location',type:'location'},{key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},{key:'quantity',label:'Qty',type:'qty',align:'right'},{key:'unit_cost',label:'Cost',type:'money',align:'right'},{key:'total_cost',label:'Value',type:'money',align:'right'}];if(type==='daily_receiving')return {title:'Daily Receiving Report',groupLabel:'Receiving Transactions',groupedByDate:reportDateGroups(rows,'date'),columns:detailCols,filters:[{key:'supplier_name',label:'Supplier'},{key:'branch_name',label:'Location',type:'location'}]};const months=monthAggregate(rows,'date','receiving_id','quantity','total_cost'),suppliers=groupTotals(rows,'supplier_name','quantity','total_cost'),products=groupTotals(rows,'product_name','quantity','total_cost');return {title:'Monthly Receiving Summary',sections:[{title:'Monthly Totals',rows:months,columns:monthlyCols()},{title:'Supplier Totals',rows:suppliers,columns:groupCols('Supplier')},{title:'Product Totals',rows:products,columns:groupCols('Product')} ]};}
  if(type==='daily_transfer'||type==='monthly_transfer'||type==='branch_transfer'){const {data,error}=await supabase.from('v_daily_transfer_report').select('*').gte('date',from).lte('date',to);if(error)throw error;const rows=data||[];const detailCols=[{key:'date',label:'Date',type:'date'},{key:'reference_no',label:'Reference'},{key:'from_branch',label:'From',type:'location'},{key:'to_branch',label:'To',type:'location'},{key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},{key:'quantity',label:'Qty',type:'qty',align:'right'},{key:'unit_cost',label:'Cost',type:'money',align:'right'},{key:'total_value',label:'Value',type:'money',align:'right'}];if(type==='daily_transfer')return {title:'Daily Transfer Report',groupLabel:'Transfer Transactions',groupedByDate:reportDateGroups(rows,'date'),columns:detailCols,filters:[{key:'to_branch',label:'Destination',type:'location'}]};if(type==='branch_transfer'){const x=groupTotals(rows,'to_branch','quantity','total_value').map(r=>({...r,group:locationName(r.group)}));return {title:'Branch Transfer Summary',sections:[{rows:x,columns:groupCols('Destination Branch')} ]};}const months=monthAggregate(rows,'date','transfer_id','quantity','total_value'),branches=groupTotals(rows,'to_branch','quantity','total_value').map(r=>({...r,group:locationName(r.group)})),products=groupTotals(rows,'product_name','quantity','total_value');return {title:'Monthly Transfer Summary',sections:[{title:'Monthly Totals',rows:months,columns:monthlyCols()},{title:'Destination Branch Totals',rows:branches,columns:groupCols('Destination Branch')},{title:'Product Totals',rows:products,columns:groupCols('Product')} ]};}
  if(type==='daily_movement'||type==='monthly_movement'||type==='product_history'){let q=supabase.from('v_stock_movement_ledger').select('*').gte('transaction_date',from).lte('transaction_date',to);if(type==='product_history'){const productId=Number($('#reportProduct')?.value||0);if(!productId)throw new Error('Select a product for Product Movement History');q=q.eq('product_id',productId);}const {data,error}=await q.order('transaction_date').order('created_at');if(error)throw error;const rows=data||[];const detail=[{key:'transaction_date',label:'Transaction Date',type:'date'},{key:'created_at',label:'Posted At',type:'datetime'},{key:'movement_type',label:'Type',type:'movement'},{key:'reference_no',label:'Reference'},{key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},{key:'branch_name',label:'Location',type:'location'},{key:'quantity_in',label:'In',type:'qty',align:'right'},{key:'quantity_out',label:'Out',type:'qty',align:'right'},{key:'running_balance',label:'Balance',type:'qty',align:'right'},{key:'movement_value',label:'Value',type:'money',align:'right'}];if(type==='daily_movement'||type==='product_history')return {title:type==='product_history'?'Product Movement History':'Daily Movement Report',sections:[{rows,columns:detail,filters:[{key:'movement_type',label:'Movement Type'},{key:'branch_name',label:'Location',type:'location'}]}]};const normalized=rows.map(r=>({...r,move_date:String(r.transaction_date||'').slice(0,10),abs_qty:Number(r.quantity_in||0)+Number(r.quantity_out||0)}));const months=monthAggregate(normalized,'move_date','transaction_key','abs_qty','movement_value'),types=groupTotals(normalized,'movement_type','abs_qty','movement_value');return {title:'Monthly Movement Summary',sections:[{title:'Monthly Totals',rows:months,columns:monthlyCols()},{title:'Movement Type Totals',rows:types,columns:groupCols('Movement Type')} ]};}
  if(type==='daily_waste'||type==='monthly_waste'){const {data,error}=await supabase.from('v_waste_report').select('*').gte('waste_date',from).lte('waste_date',to);if(error)throw error;const rows=data||[];const detail=[{key:'waste_date',label:'Date',type:'date'},{key:'branch_name',label:'Location',type:'location'},{key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},{key:'quantity',label:'Qty',type:'qty',align:'right'},{key:'waste_value',label:'Value',type:'money',align:'right'},{key:'reason',label:'Reason'}];if(type==='daily_waste')return {title:'Daily Waste Report',sections:[{rows,columns:detail,filters:[{key:'reason',label:'Reason'},{key:'branch_name',label:'Location',type:'location'}]}]};const months=monthAggregate(rows,'waste_date','id','quantity','waste_value'),reasons=groupTotals(rows,'reason','quantity','waste_value'),products=groupTotals(rows,'product_name','quantity','waste_value');return {title:'Monthly Waste Summary',sections:[{title:'Monthly Totals',rows:months,columns:monthlyCols()},{title:'Reason Totals',rows:reasons,columns:groupCols('Reason')},{title:'Product Totals',rows:products,columns:groupCols('Product')} ]};}
  if(type==='warehouse_shops'){const wh=state.positions.filter(x=>x.branch_name==='Warehouse'),shops=state.positions.filter(x=>x.branch_name!=='Warehouse');const rows=[{group:'Bakery Warehouse',units:sum(wh,'available_quantity'),value:sum(wh,'stock_value'),skus:distinctCount(wh.filter(x=>Number(x.available_quantity)>0),'product_id')},{group:'Jeddah Shops',units:sum(shops,'available_quantity'),value:sum(shops,'stock_value'),skus:distinctCount(shops.filter(x=>Number(x.available_quantity)>0),'product_id')}];return {title:'Bakery Warehouse vs Jeddah Shops',sections:[{rows,columns:[{key:'group',label:'Group'},{key:'units',label:'Units',type:'qty',align:'right'},{key:'skus',label:'Available SKUs',type:'qty',align:'right'},{key:'value',label:'Inventory Value',type:'money',align:'right'}]}]};}
  if(type==='supplier_summary'){const {data,error}=await supabase.from('v_supplier_summary_report').select('*');if(error)throw error;return {title:'Supplier Summary',sections:[{rows:data||[],columns:[{key:'supplier_name',label:'Supplier'},{key:'active_products',label:'Products',type:'qty',align:'right'},{key:'total_received_units',label:'Received Units',type:'qty',align:'right'},{key:'total_receiving_value',label:'Receiving Value',type:'money',align:'right'},{key:'latest_receiving_date',label:'Latest Receiving',type:'date'}]}]};}
  if(type==='category_summary'){const u=groupSum(state.positions,'category_name','available_quantity'),v=Object.fromEntries(groupSum(state.positions,'category_name','stock_value').map(x=>[x.label,x.value]));const rows=u.map(x=>({category:x.label,units:x.value,value:v[x.label]||0}));return {title:'Category Summary',sections:[{rows,columns:[{key:'category',label:'Category'},{key:'units',label:'Units',type:'qty',align:'right'},{key:'value',label:'Value',type:'money',align:'right'}]}]};}
  if(type==='low_stock'||type==='out_stock'){const rows=state.positions.filter(x=>x.branch_name==='Warehouse'&&x.stock_status===(type==='low_stock'?'Low Stock':'Out of Stock'));return {title:type==='low_stock'?'Low Stock Report':'Out of Stock Report',sections:[{rows,columns:cols.stock,filters:[{key:'category_name',label:'Category'},{key:'supplier_name',label:'Supplier'}]}]};}
  if(type==='expiry')return {title:'Expiry Report',sections:[{rows:state.expiry,columns:[{key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},{key:'batch_no',label:'Batch'},{key:'branch_name',label:'Location',type:'location'},{key:'remaining_quantity',label:'Qty',type:'qty',align:'right'},{key:'expiry_date',label:'Expiry',type:'date'},{key:'days_until_expiry',label:'Days',type:'qty',align:'right'},{key:'supplier_name',label:'Supplier'},{key:'expiry_status',label:'Status',type:'badge'}],filters:[{key:'expiry_status',label:'Status'},{key:'branch_name',label:'Location',type:'location'}]}]};
  if(type==='adjustment'){const {data,error}=await supabase.from('v_adjustment_report').select('*').gte('adjustment_date',from).lte('adjustment_date',to);if(error)throw error;return {title:'Stock Adjustment Report',sections:[{rows:data||[],columns:[{key:'adjustment_date',label:'Date',type:'date'},{key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},{key:'branch_name',label:'Location',type:'location'},{key:'quantity_change',label:'Difference',type:'qty',align:'right'},{key:'adjustment_value',label:'Value',type:'money',align:'right'},{key:'reason',label:'Reason'},{key:'performed_by',label:'By'}]}]};}
  throw new Error('Unknown report type');
}
function groupTotals(rows,key,qtyKey,valueKey){const m=new Map();for(const r of rows){const k=r[key]??'Unspecified';if(!m.has(k))m.set(k,{group:k,line_count:0,units:0,value:0,transactions:new Set()});const x=m.get(k);x.line_count++;x.units+=Number(r[qtyKey]||0);x.value+=Number(r[valueKey]||0);x.transactions.add(r.transaction_key??r.receiving_id??r.transfer_id??r.id);}return [...m.values()].sort((a,b)=>b.value-a.value).map(x=>({group:x.group,transactions:x.transactions.size,line_count:x.line_count,units:x.units,value:x.value}));}
function monthlyCols(){return [{key:'month',label:'Month'},{key:'transactions',label:'Transactions',type:'qty',align:'right'},{key:'line_count',label:'Lines',type:'qty',align:'right'},{key:'units',label:'Units',type:'qty',align:'right'},{key:'value',label:'Value',type:'money',align:'right'}];}
function groupCols(label){return [{key:'group',label},{key:'transactions',label:'Transactions',type:'qty',align:'right'},{key:'line_count',label:'Lines',type:'qty',align:'right'},{key:'units',label:'Units',type:'qty',align:'right'},{key:'value',label:'Value',type:'money',align:'right'}];}

$('#quickRecv').onclick=()=>{if(!canPost())return toast('Your role cannot post receiving','error');openReceiving();};
$('#quickTr').onclick=()=>{if(!canPost())return toast('Your role cannot post transfers','error');openTransfer();};
$('#printDaily').onclick=()=>printDailyReport();
(()=>{const sb=$('#sidebar');const bd=document.createElement('div');bd.id='sidebarBackdrop';bd.className='sidebar-backdrop';document.body.appendChild(bd);
  const sync=()=>bd.classList.toggle('show',sb.classList.contains('open'));new MutationObserver(sync).observe(sb,{attributes:true,attributeFilter:['class']});
  const close=()=>sb.classList.remove('open');bd.addEventListener('click',close);
  document.addEventListener('click',e=>{if(!sb.classList.contains('open'))return;if(e.target.closest('#sidebar,#menuBtn'))return;close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  sb.addEventListener('click',e=>{if(e.target.closest('[data-page],button,a'))setTimeout(close,0);});})();
$('#modalClose').onclick=closeModal;modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');$('#refreshBtn').onclick=async()=>{try{await requireData(true);await go(state.currentPage);}catch(e){fail(e,'Refresh failed');}};$('#logoutBtn').onclick=async()=>{await supabase.auth.signOut();};

/* ---------- Quick search / command palette (Ctrl+K) and breadcrumbs ---------- */
function crumbFor(page){let grp='';for(const [id,,label] of navItems){if(id==='__g'){grp=label;continue;}if(id===page)return grp;}return '';}

async function paintHealth(){
  try{
    const {data,error}=await supabase.from('v_stock_integrity').select('*');
    let el=$('#healthBar');
    if(error||!data||!data.length){el?.remove();return;}
    if(!el){el=document.createElement('div');el.id='healthBar';el.className='info-banner health-bar';content.parentNode.insertBefore(el,content);}
    const items=new Set(data.map(r=>r.product_name)).size;
    el.innerHTML=`<strong>⚠ Data check:</strong> ${qty(data.length)} stock rows (${qty(items)} products) do not match the movement history or expiry batches. <button class="btn small-btn" id="healthView">View</button>`;
    $('#healthView').onclick=()=>{
      openModal('Data check','Stock quantity compared with movement history and expiry batches (all three should be equal)',`<div id="healthTable"></div>`,'wide');
      renderDataTable('#healthTable',data.map(r=>({...r,branch_name:locationName(r.branch_name)})),[{key:'product_code',label:'SKU'},{key:'product_name',label:'Product'},{key:'branch_name',label:'Location'},{key:'stock_qty',label:'Stock',type:'qty',align:'right',noTotal:true},{key:'ledger_qty',label:'Movement History',type:'qty',align:'right',noTotal:true},{key:'batch_qty',label:'Expiry Batches',type:'qty',align:'right',noTotal:true},{key:'stock_vs_ledger',label:'Stock − History',type:'qty',align:'right'},{key:'stock_vs_batches',label:'Stock − Batches',type:'qty',align:'right'}],{filename:'joffreys-data-check',title:'Joffrey’s Bakery Data Check',pageSize:100});
    };
  }catch(e){}
}
function paintCrumb(page){const c=$('#crumb');if(!c)return;const meta=pageMeta[page]||['Inventory',''];const g=crumbFor(page);c.innerHTML=`<span>Joffrey’s</span>${g?`<i>›</i><span>${esc(g)}</span>`:''}<i>›</i><strong>${esc(meta[0])}</strong>`;}
let paletteIdx=0,paletteItems=[];
function paletteSources(q){
  q=(q||'').trim().toLowerCase();const out=[];
  for(const [id,ico,label] of navItems){if(id==='__g')continue;if(!q||label.toLowerCase().includes(q))out.push({kind:'Page',label,hint:crumbFor(id),ico,run:()=>go(id)});}
  const acts=[['New receiving','receiving','Receiving'],['New transfer','transfers','Transfers'],['Record waste','waste','Waste'],['Stock adjustment','adjustments','Adjustments'],['Count variance (Warehouse)','variance','Variance']];
  for(const [label,id,hint] of acts){if(q&&label.toLowerCase().includes(q)&&!out.some(o=>o.label===label))out.push({kind:'Action',label,hint,ico:'＋',run:()=>go(id)});}
  if(q.length>=2){const m=new Map();for(const r of state.positions||[]){const k=r.product_id;if(!m.has(k))m.set(k,{name:r.product_name,code:r.product_code,qty:0});m.get(k).qty+=Number(r.available_quantity||0);}
    let n=0;for(const p of m.values()){if(`${p.name} ${p.code}`.toLowerCase().includes(q)){out.push({kind:'Product',label:p.name,hint:`${p.code||''} · ${qty(p.qty)} in stock`,ico:'□',run:async()=>{await go('stock');const si=document.querySelector('#content [data-search]');if(si){si.value=p.name;si.dispatchEvent(new Event('input'));}}});if(++n>=12)break;}}}
  return out.slice(0,30);
}
function paintPalette(){
  const q=$('#cmdkInput').value;paletteItems=paletteSources(q);if(paletteIdx>=paletteItems.length)paletteIdx=Math.max(0,paletteItems.length-1);
  $('#cmdkList').innerHTML=paletteItems.length?paletteItems.map((it,i)=>`<button type="button" class="cmdk-item ${i===paletteIdx?'sel':''}" data-i="${i}"><span class="cmdk-ico">${it.ico}</span><span class="cmdk-label">${esc(it.label)}</span><span class="cmdk-hint">${esc(it.hint||'')}</span><span class="cmdk-kind">${it.kind}</span></button>`).join(''):'<div class="cmdk-empty">No results</div>';
  $$('.cmdk-item').forEach(b=>b.onclick=()=>runPalette(Number(b.dataset.i)));
  const sel=$('.cmdk-item.sel');if(sel&&sel.scrollIntoView)sel.scrollIntoView({block:'nearest'});
}
function runPalette(i){const it=paletteItems[i];if(!it)return;closePalette();Promise.resolve(it.run()).catch(e=>fail(e));}
function openPalette(){const o=$('#cmdk');if(!o||$('#appView').classList.contains('hidden'))return;o.classList.remove('hidden');paletteIdx=0;$('#cmdkInput').value='';paintPalette();setTimeout(()=>$('#cmdkInput').focus(),0);}
function closePalette(){const o=$('#cmdk');if(o)o.classList.add('hidden');}
(function bindPalette(){
  const btn=$('#searchBtn');if(btn)btn.onclick=openPalette;
  const o=$('#cmdk');if(o)o.addEventListener('click',e=>{if(e.target===o)closePalette();});
  const inp=$('#cmdkInput');if(inp){inp.oninput=()=>{paletteIdx=0;paintPalette();};inp.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();paletteIdx=Math.min(paletteItems.length-1,paletteIdx+1);paintPalette();}else if(e.key==='ArrowUp'){e.preventDefault();paletteIdx=Math.max(0,paletteIdx-1);paintPalette();}else if(e.key==='Enter'){e.preventDefault();runPalette(paletteIdx);}else if(e.key==='Escape'){closePalette();}};}
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette();}else if(e.key==='Escape'){closePalette();}});
})();
$('#loginForm').onsubmit=async e=>{e.preventDefault();const btn=e.submitter||$('#loginForm button[type="submit"]'),old=btn.textContent;btn.disabled=true;btn.textContent='Signing in…';const status=$('#loginStatus');if(status){status.textContent='Checking your email and password…';status.classList.remove('hidden');}try{assertOnline();const email=$('#loginEmail').value.trim();const password=$('#loginPassword').value;if(!email||!password)throw new Error('Enter your email and password.');const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;if(!data?.session)throw new Error('Sign-in returned no session. Please try again.');await boot(data.session);if(!state.session||!state.appUser)throw new Error('Sign-in succeeded, but your bakery account could not be loaded. Check that the account is active, then try again.');}catch(err){if(status){status.textContent=err?.message||String(err);status.classList.remove('hidden');}fail(err,'Sign in failed');}finally{btn.disabled=false;btn.textContent=old;}};
$('#resetPasswordBtn').onclick=async()=>{const email=$('#loginEmail').value.trim();const status=$('#loginStatus');const btn=$('#resetPasswordBtn');if(!email){if(status){status.textContent='Enter your account email above, then tap Send password reset email.';status.classList.remove('hidden');}$('#loginEmail').focus();return;}const old=btn.textContent;btn.disabled=true;btn.textContent='Sending reset email…';if(status){status.textContent='Requesting a password reset email…';status.classList.remove('hidden');}try{assertOnline();const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}${location.pathname}`});if(error)throw error;if(status){status.textContent='Supabase accepted the reset request. Check your inbox and spam folder; if no email arrives, the email provider/settings need checking.';status.classList.remove('hidden');}toast('Password reset request submitted','success');}catch(e){const message=e?.message||String(e);if(status){status.textContent='Password reset failed: '+message;status.classList.remove('hidden');}fail(e,'Password reset failed');}finally{btn.disabled=false;btn.textContent=old;}};
$('#recoveryForm').onsubmit=async e=>{e.preventDefault();const p=$('#newPassword').value,c=$('#confirmPassword').value;if(p.length<8)return toast('Use at least 8 characters','error');if(p!==c)return toast('Passwords do not match','error');const btn=e.submitter,old=btn.textContent;btn.disabled=true;btn.textContent='Updating…';try{assertOnline();const {error}=await supabase.auth.updateUser({password:p});if(error)throw error;toast('Password updated. Sign in with your new password.','success');recoveryMode=false;await supabase.auth.signOut();showLogin();}catch(err){fail(err,'Password update failed');}finally{btn.disabled=false;btn.textContent=old;}};
function showLogin(){recoveryMode=false;$('#loginForm').classList.remove('hidden');$('#resetPasswordBtn').classList.remove('hidden');$('#recoveryForm').classList.add('hidden');}
function showRecovery(){recoveryMode=true;authView.classList.remove('hidden');appView.classList.add('hidden');$('#loginForm').classList.add('hidden');$('#resetPasswordBtn').classList.add('hidden');$('#recoveryForm').classList.remove('hidden');$('#newPassword').focus();}

async function boot(session){
  const seq=++bootSequence;state.session=session;
  if(!session){state.appUser=null;if(!recoveryMode)showLogin();authView.classList.remove('hidden');appView.classList.add('hidden');return;}
  if(recoveryMode){showRecovery();return;}
  // Keep the sign-in screen available until the account and its data are confirmed.
  authView.classList.remove('hidden');appView.classList.add('hidden');
  const status=$('#loginStatus');
  try{
    await loadAppUser();if(seq!==bootSequence)return;
    await requireData(true);if(seq!==bootSequence)return;
    authView.classList.add('hidden');appView.classList.remove('hidden');
    renderNav();await go(state.currentPage);
  }catch(e){
    if(seq!==bootSequence)return;
    state.appUser=null;
    authView.classList.remove('hidden');appView.classList.add('hidden');
    if(status){status.textContent='Could not finish loading your bakery account: '+(e?.message||String(e));status.classList.remove('hidden');}
    fail(e,'Could not load account');
  }
}
window.addEventListener('online',()=>{updateNetworkStatus();toast('Connection restored','success');});
window.addEventListener('offline',()=>{updateNetworkStatus();toast('You are offline. Do not submit transactions.','error');});
updateNetworkStatus();

supabase.auth.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY'){state.session=session;showRecovery();return;}
  if(event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')return;
  if(event==='SIGNED_OUT'||event==='USER_UPDATED')boot(session);
});
const {data:{session},error:sessionError}=await supabase.auth.getSession();if(sessionError)fail(sessionError,'Session check failed');await boot(session);
