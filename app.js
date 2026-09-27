import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ivqygskesdrretwgouea.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_f4Jv-1y826TQkpRbVYAeEg_91xKWGSx';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
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
  ['dashboard','▦','Dashboard'],
  ['stock','▤','Stock'],
  ['movements','≋','Movements'],
  ['receiving','↓','Receiving'],
  ['transfers','⇄','Transfers'],
  ['adjustments','±','Adjustments'],
  ['waste','♲','Waste'],
  ['expiry','◷','Expiry'],
  ['reports','▥','Reports'],
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
  products:['Products','Real Supabase product master']
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
function sum(rows,key){return (rows||[]).reduce((a,r)=>a+Number(r[key]||0),0);}
function distinctCount(rows,key){return new Set((rows||[]).map(r=>r[key]).filter(v=>v!==null&&v!==undefined)).size;}
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
  const [p,allp,s,b,pos,exp] = await Promise.all([
    supabase.from('products').select('id,ref_no,product_code,name,category,category_id,unit,unit_price,unit_cost,low_stock_alert,reorder_level,minimum_stock,maximum_stock,is_active,supplier_id').eq('is_active',true).order('name'),
    supabase.from('products').select('id,ref_no,product_code,name,category,category_id,unit,unit_price,unit_cost,low_stock_alert,reorder_level,minimum_stock,maximum_stock,is_active,supplier_id').order('name'),
    supabase.from('suppliers').select('*').order('name'),
    supabase.from('branches').select('*').order('name'),
    supabase.from('v_stock_positions').select('*'),
    supabase.from('v_expiry_alerts').select('*')
  ]);
  for(const q of [p,allp,s,b,pos,exp])if(q.error)throw q.error;
  state.products=p.data||[];state.allProducts=allp.data||[];state.suppliers=s.data||[];state.branches=(b.data||[]).filter(x=>x.is_active);state.positions=pos.data||[];state.expiry=exp.data||[];
  state.warehouse=state.branches.find(x=>String(x.name).toLowerCase()==='warehouse')||null;
}

async function loadAppUser(){
  const {data,error}=await supabase.from('app_users').select('id,name,email,role,branch_id,is_active').eq('auth_user_id',state.session.user.id).maybeSingle();
  if(error)throw error;if(!data||!data.is_active)throw new Error('Your inventory account is not active');state.appUser=data;
  $('#userCard').innerHTML=`<strong>${esc(data.name)}</strong><span>${esc(data.role)}</span><small>${esc(data.email||state.session.user.email||'')}</small>`;
}

function renderNav(){
  $('#nav').innerHTML=navItems.map(([id,ico,label])=>`<button data-page="${id}" class="${state.currentPage===id?'active':''}"><span class="ico">${ico}</span><span>${label}</span></button>`).join('');
  $$('#nav button').forEach(b=>b.onclick=()=>go(b.dataset.page));
}

async function go(page,throwOnError=false){
  state.currentPage=page;renderNav();$('#sidebar').classList.remove('open');
  const meta=pageMeta[page]||['Inventory',''];$('#pageTitle').textContent=meta[0];$('#pageSubtitle').textContent=meta[1];setLoading();
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
  return `<div class="chart-card"><div class="chart-title">${esc(title)}</div><div class="hbars">${items.length?items.map(x=>{const v=Number(x.value||0);const pct=max&&v>0?v/max*100:0;const zero=v<=0?' zero':'';return `<div class="hbar-row" title="${esc(x.label)}: ${esc(formatter(x.value))}"><div class="hbar-label"><span>${esc(x.label)}</span><strong>${formatter(x.value)}</strong></div><div class="hbar-track"><div class="hbar-fill${zero}" style="width:${pct}%;background:${x.color||color}"></div></div></div>`;}).join(''):'<div class="empty">No data in selected period</div>'}</div></div>`;
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
  const w=window.open('','_blank','noopener,noreferrer');if(!w)return toast('Allow pop-ups to print','error');
  w.document.write(`<!doctype html><html><head><title>${esc(title)}</title><style>body{font-family:Arial;padding:20px;color:#111}h1{font-size:20px}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#eee}@media print{body{padding:0}}</style></head><body><h1>${esc(title)}</h1><p>Generated ${dateTimeFmt(new Date().toISOString())}</p><table><thead><tr>${columns.map(c=>`<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(c=>`<td>${esc(rawExportValue(r[c.key],c))}</td>`).join('')}</tr>`).join('')}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
}

function renderDataTable(host,rows,columns,opt={}){
  const el=typeof host==='string'?$(host):host;const pageSize=opt.pageSize||50;const filters=opt.filters||[];let page=1,sortKey=opt.sortKey||'',sortDir=opt.sortDir||'asc';
  const filterValues=Object.fromEntries(filters.map(f=>[f.key,[...new Set(rows.map(r=>r[f.key]).filter(v=>v!==null&&v!==undefined&&v!==''))].sort()]));
  el.innerHTML=`<div class="table-card"><div class="table-toolbar"><div class="table-filter"><input data-search placeholder="Search SKU, product, reference…">${filters.map(f=>`<select data-filter="${esc(f.key)}"><option value="">All ${esc(f.label)}</option>${filterValues[f.key].map(v=>`<option value="${esc(v)}">${esc(f.type==='location'?locationName(v):v)}</option>`).join('')}</select>`).join('')}</div><div class="table-actions"><button class="btn small-btn" data-csv>CSV</button><button class="btn small-btn" data-xls>Excel</button><button class="btn small-btn" data-print>Print</button></div></div><div class="table-meta"><span data-count></span><div class="pager"><button class="btn small-btn" data-prev>‹</button><span data-page></span><button class="btn small-btn" data-next>›</button></div></div><div class="table-wrap"><table class="data-table"><thead><tr>${columns.map(c=>`<th data-sort="${esc(c.key)}" class="${c.align==='right'?'num':''}">${esc(c.label)} <span class="sortmark"></span></th>`).join('')}</tr></thead><tbody></tbody></table></div></div>`;
  const tbody=$('tbody',el),search=$('[data-search]',el),count=$('[data-count]',el),pageLabel=$('[data-page]',el);
  const getFiltered=()=>{const q=(search.value||'').trim().toLowerCase();const active=Object.fromEntries($$('[data-filter]',el).map(s=>[s.dataset.filter,s.value]));let out=rows.filter(r=>(!q||columns.some(c=>String(rawExportValue(r[c.key],c)).toLowerCase().includes(q)))&&Object.entries(active).every(([k,v])=>!v||String(r[k]??'')===v));if(sortKey){const col=columns.find(c=>c.key===sortKey);out=[...out].sort((a,b)=>{const av=a[sortKey],bv=b[sortKey];let d;if(['money','qty'].includes(col?.type))d=Number(av||0)-Number(bv||0);else d=String(av??'').localeCompare(String(bv??''),undefined,{numeric:true});return sortDir==='asc'?d:-d;});}return out;};
  const draw=()=>{const filtered=getFiltered();const pages=Math.max(1,Math.ceil(filtered.length/pageSize));if(page>pages)page=pages;const slice=filtered.slice((page-1)*pageSize,page*pageSize);count.textContent=`${filtered.length} rows`;pageLabel.textContent=`Page ${page} / ${pages}`;tbody.innerHTML=slice.length?slice.map(r=>`<tr>${columns.map(c=>{const cc={...c,_row:r};return `<td class="${c.align==='right'?'num':''}">${tableCell(r[c.key],cc)}</td>`;}).join('')}</tr>`).join(''):`<tr><td colspan="${columns.length}" class="empty">No records found</td></tr>`;$('[data-prev]',el).disabled=page<=1;$('[data-next]',el).disabled=page>=pages;$$('th[data-sort]',el).forEach(th=>{const mark=$('.sortmark',th);mark.textContent=th.dataset.sort===sortKey?(sortDir==='asc'?'▲':'▼'):'';});};
  search.oninput=()=>{page=1;draw();};$$('[data-filter]',el).forEach(s=>s.onchange=()=>{page=1;draw();});$('[data-prev]',el).onclick=()=>{page--;draw();};$('[data-next]',el).onclick=()=>{page++;draw();};$$('th[data-sort]',el).forEach(th=>th.onclick=()=>{const k=th.dataset.sort;if(sortKey===k)sortDir=sortDir==='asc'?'desc':'asc';else{sortKey=k;sortDir='asc';}draw();});
  $('[data-csv]',el).onclick=()=>exportRowsCsv(getFiltered(),columns,opt.filename||'joffreys-report');$('[data-xls]',el).onclick=()=>exportRowsExcel(getFiltered(),columns,opt.filename||'joffreys-report');$('[data-print]',el).onclick=()=>printRows(getFiltered(),columns,opt.title||'Joffrey’s Bakery Report');draw();
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

function dualTrendChart(title,items,inLabel='Qty In',outLabel='Qty Out'){
  const max=Math.max(0,...items.flatMap(x=>[Number(x.inValue||0),Number(x.outValue||0)]));
  if(!items.length||max<=0)return `<div class="chart-card"><div class="chart-title">${esc(title)}</div><div class="dual-legend"><span><i style="background:${COLORS.receiving}"></i>${esc(inLabel)}</span><span><i style="background:${COLORS.waste}"></i>${esc(outLabel)}</span></div><div class="empty chart-empty">No activity in selected period</div></div>`;
  const mid=max/2;
  const bars=items.map(x=>{const iv=Number(x.inValue||0),ov=Number(x.outValue||0),ih=iv>0?iv/max*100:0,oh=ov>0?ov/max*100:0;return `<div class="dual-col" title="${esc(x.label)} · ${esc(inLabel)} ${qty(iv)} · ${esc(outLabel)} ${qty(ov)}"><div class="dual-values"><span>${qty(iv)}</span><span>${qty(ov)}</span></div><div class="dual-bars"><div class="dual-bar${iv<=0?' zero':''}" style="height:${ih}%;background:${COLORS.receiving}"></div><div class="dual-bar${ov<=0?' zero':''}" style="height:${oh}%;background:${COLORS.waste}"></div></div><div class="dual-label">${esc(x.label)}</div></div>`;}).join('');
  return `<div class="chart-card"><div class="chart-title">${esc(title)}</div><div class="dual-legend"><span><i style="background:${COLORS.receiving}"></i>${esc(inLabel)}</span><span><i style="background:${COLORS.waste}"></i>${esc(outLabel)}</span></div><div class="trend-scaled"><div class="trend-yaxis"><span>${qty(max)}</span><span>${qty(mid)}</span><span>0</span></div><div class="dual-trend">${bars}</div></div></div>`;
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

const pages = {
  async dashboard(){
    ensureDashboardProStyles();
    const {from,to}=periodRange();
    const [rr,tr,wr,mr] = await Promise.all([
      supabase.from('v_daily_receiving_report').select('date,receiving_id,supplier_name,quantity,total_cost').gte('date',from).lte('date',to).order('date',{ascending:true}),
      supabase.from('v_daily_transfer_report').select('date,transfer_id,to_branch,quantity,total_value').gte('date',from).lte('date',to).order('date',{ascending:true}),
      supabase.from('v_waste_report').select('id,waste_date,quantity,waste_value').gte('waste_date',from).lte('waste_date',to).order('waste_date',{ascending:true}),
      supabase.from('v_stock_movement_ledger').select('transaction_date,transaction_key,quantity_in,quantity_out,movement_value').gte('transaction_date',from).lte('transaction_date',to).order('transaction_date',{ascending:true}).limit(5000)
    ]);
    for(const q of [rr,tr,wr,mr])if(q.error)throw q.error;
    const receiving=rr.data||[],transfers=tr.data||[],waste=wr.data||[],movements=mr.data||[];
    const wh=state.positions.filter(x=>x.branch_name==='Warehouse');
    const shops=state.positions.filter(x=>x.branch_name!=='Warehouse');
    const whUnits=sum(wh,'available_quantity'),whValue=sum(wh,'stock_value'),whSku=distinctCount(wh.filter(x=>Number(x.available_quantity)>0),'product_id');
    const shopUnits=sum(shops,'available_quantity'),shopValue=sum(shops,'stock_value'),shopSku=distinctCount(shops.filter(x=>Number(x.available_quantity)>0),'product_id');
    const totalValue=whValue+shopValue;
    const lowWh=wh.filter(x=>x.stock_status==='Low Stock').sort((a,b)=>Number(a.available_quantity)-Number(b.available_quantity));
    const outWh=wh.filter(x=>x.stock_status==='Out of Stock').sort((a,b)=>String(a.product_name).localeCompare(String(b.product_name)));
    const recvUnits=sum(receiving,'quantity'),recvValue=sum(receiving,'total_cost'),recvTxn=distinctCount(receiving,'receiving_id');
    const trUnits=sum(transfers,'quantity'),trValue=sum(transfers,'total_value'),trTxn=distinctCount(transfers,'transfer_id');
    const wasteUnits=sum(waste,'quantity'),wasteValue=sum(waste,'waste_value'),wasteTxn=distinctCount(waste,'id');
    const movementTxn=distinctCount(movements,'transaction_key');
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
    const topValue=[...productTotals].filter(x=>x.value>0).sort((a,b)=>b.value-a.value).slice(0,10).map(x=>({label:x.product_name,value:x.value}));
    const topQty=[...productTotals].filter(x=>x.quantity>0).sort((a,b)=>b.quantity-a.quantity).slice(0,10).map(x=>({label:x.product_name,value:x.quantity}));
    const catUnits=groupSum(state.positions,'category_name','available_quantity').sort((a,b)=>b.value-a.value);
    const catValue=groupSum(state.positions,'category_name','stock_value').sort((a,b)=>b.value-a.value);
    const supplierValue=groupSum(state.positions,'supplier_name','stock_value').sort((a,b)=>b.value-a.value);
    const supplierRecv=groupSum(receiving,'supplier_name','total_cost').sort((a,b)=>b.value-a.value);
    const branchTr=groupSum(transfers,'to_branch','quantity').sort((a,b)=>b.value-a.value).map(x=>({...x,label:locationName(x.label)}));
    const recvTrend=aggregateTrend(receiving,'date','quantity',from,to);
    const wasteTrend=aggregateTrend(waste,'waste_date','quantity',from,to);

    const movementMap=new Map();
    for(const r of movements){const d=String(r.transaction_date||'').slice(0,10);if(!d)continue;if(!movementMap.has(d))movementMap.set(d,{date:d,inValue:0,outValue:0});const x=movementMap.get(d);x.inValue+=Number(r.quantity_in||0);x.outValue+=Number(r.quantity_out||0);}
    const long=rangeDays(from,to)>62;
    let movementTrend=[...movementMap.values()].sort((a,b)=>a.date.localeCompare(b.date));
    if(long){const mm=new Map();for(const r of movementTrend){const k=monthKey(r.date);if(!mm.has(k))mm.set(k,{label:`${k.slice(5,7)}/${k.slice(0,4)}`,inValue:0,outValue:0});const x=mm.get(k);x.inValue+=r.inValue;x.outValue+=r.outValue;}movementTrend=[...mm.values()];}
    else movementTrend=movementTrend.map(x=>({label:dateFmt(x.date),inValue:x.inValue,outValue:x.outValue}));

    const expiryRisk=[
      {label:'Missing Expiry',value:missingExpiryBatches,color:COLORS.neutral},
      {label:'Expired',value:liveExpiry.filter(x=>x.expiry_date&&Number(x.days_until_expiry)<0).length,color:COLORS.waste},
      {label:'0–3 Days',value:liveExpiry.filter(x=>x.expiry_date&&Number(x.days_until_expiry)>=0&&Number(x.days_until_expiry)<=3).length,color:COLORS.out},
      {label:'4–7 Days',value:liveExpiry.filter(x=>x.expiry_date&&Number(x.days_until_expiry)>=4&&Number(x.days_until_expiry)<=7).length,color:COLORS.low},
      {label:'8–14 Days',value:liveExpiry.filter(x=>x.expiry_date&&Number(x.days_until_expiry)>=8&&Number(x.days_until_expiry)<=14).length,color:COLORS.low},
      {label:'Safe >14 Days',value:liveExpiry.filter(x=>x.expiry_date&&Number(x.days_until_expiry)>14).length,color:COLORS.healthy}
    ].filter(x=>x.value>0);

    content.innerHTML=`${dashboardFilterHtml()}
      <div class="quick-actions"><button class="btn primary" id="quickReceive">＋ Receive</button><button class="btn" id="quickTransfer">⇄ Transfer</button><button class="btn" id="quickAdjust">± Adjustment</button><button class="btn" id="quickWaste">♲ Waste</button></div>
      <div class="dash-pro-kpis">
        ${kpi('Bakery Warehouse Stock',qty(whUnits),`${money(whValue)} · ${whSku} available SKUs`,'good')}
        ${kpi('Total Inventory Value',money(totalValue),'All active physical locations','neutral')}
        ${kpi('Jeddah Shops Stock',qty(shopUnits),`${money(shopValue)} · ${shopSku} available SKUs`)}
        ${kpi('Receiving in Selected Period',qty(recvUnits),`${recvTxn} receipts · ${money(recvValue)}`,'blue')}
        ${kpi('Transferred to Jeddah Shops',qty(trUnits),`${trTxn} transfers · ${money(trValue)}`,'purple')}
        ${kpi('Low Stock Alerts',qty(lowWh.length),'Bakery Warehouse thresholds','warn')}
        ${kpi('Out of Stock',qty(outWh.length),'Bakery Warehouse products','bad')}
        ${kpi('Missing Expiry',qty(missingExpiryBatches),`${qty(missingExpiryUnits)} units affected`,'bad')}
        ${kpi('Expiring ≤7 Days',qty(expSoon),'Live dated batches','warn')}
        ${kpi('Waste in Selected Period',qty(wasteUnits),`${wasteTxn} records · ${money(wasteValue)}`,'bad')}
      </div>
      ${dashboardAttentionHtml(lowWh,outWh,missingExpiryBatches,missingExpiryUnits)}
      <div class="dash-section-head"><h3>Stock & Valuation</h3><span>Live positions across active physical locations</span></div>
      <div class="chart-grid">${donutChart('Bakery Warehouse Stock Health',health)}${compareChart('Bakery Warehouse vs Jeddah Shops',[{label:'Bakery Warehouse',value:whUnits,color:COLORS.neutral},{label:'Jeddah Shops',value:shopUnits,color:COLORS.transfer}])}</div>
      <div class="chart-grid">${barChart('Stock Units by Category',catUnits,COLORS.neutral,qty)}${barChart('Stock Value by Category',catValue,COLORS.neutral,money)}</div>
      <div class="chart-grid">${barChart('Stock Value by Supplier',supplierValue,COLORS.neutral,money)}${barChart('Top 10 Products by Stock Value',topValue,COLORS.neutral,money)}</div>
      <div class="chart-grid">${barChart('Top 10 Products by Quantity',topQty,COLORS.neutral,qty)}${barChart('Expiry Risk — Live Batches',expiryRisk,COLORS.low,qty)}</div>
      <div class="dash-section-head"><h3>Selected Period Activity</h3><span>${dateFmt(from)} — ${dateFmt(to)} · ${movementTxn} source transactions</span></div>
      <div class="chart-grid">${trendChart('Receiving Trend — Units',recvTrend,COLORS.receiving,qty)}${dualTrendChart('Inventory Movement Trend',movementTrend,'Qty In','Qty Out')}</div>
      <div class="chart-grid">${barChart('Supplier Receiving Value',supplierRecv,COLORS.receiving,money)}${barChart('Transfer Destination — Units',branchTr,COLORS.transfer,qty)}</div>
      <div class="chart-grid">${trendChart('Waste Trend — Units',wasteTrend,COLORS.waste,qty)}${compareChart('Receiving vs Transfers — Units',[{label:'Receiving',value:recvUnits,color:COLORS.receiving},{label:'Transfers',value:trUnits,color:COLORS.transfer}])}</div>`;

    $('#dashPreset').value=state.dashboardPreset;
    $('#dashPreset').onchange=e=>{state.dashboardPreset=e.target.value;$('#dashCustom').classList.toggle('hidden',e.target.value!=='custom');if(e.target.value!=='custom')go('dashboard');};
    if($('#dashApply'))$('#dashApply').onclick=()=>{const f=$('#dashFrom').value,t=$('#dashTo').value;if(!f||!t||f>t)return toast('Choose a valid custom date range','error');state.dashboardCustom={from:f,to:t};state.dashboardPreset='custom';go('dashboard');};
    $('#quickReceive').onclick=openReceiving;$('#quickTransfer').onclick=openTransfer;$('#quickAdjust').onclick=openAdjustment;$('#quickWaste').onclick=openWaste;
    $$('[data-attention-page]').forEach(b=>b.onclick=()=>go(b.dataset.attentionPage));
  },

  async stock(){
    const rows=state.positions.map(r=>({...r,location_display:locationName(r.branch_name)}));
    content.innerHTML=`<div id="stockTable"></div>`;
    renderDataTable('#stockTable',rows,[
      {key:'product_code',label:'SKU / Reference'},{key:'product_name',label:'Product'},{key:'category_name',label:'Category'},{key:'supplier_name',label:'Supplier'},
      {key:'branch_name',label:'Location',type:'location'},{key:'available_quantity',label:'Available Quantity',type:'qty',align:'right'},{key:'unit',label:'Unit'},
      {key:'reorder_threshold',label:'Reorder Threshold',type:'qty',align:'right'},{key:'stock_status',label:'Stock Scale / Status',type:'badge'},
      {key:'unit_cost',label:'Unit Cost',type:'money',align:'right'},{key:'stock_value',label:'Stock Value',type:'money',align:'right'},{key:'expiry_status',label:'Expiry Status',type:'badge'}
    ],{filters:[{key:'category_name',label:'Category'},{key:'supplier_name',label:'Supplier'},{key:'branch_name',label:'Location',type:'location'},{key:'stock_status',label:'Status'}],filename:'joffreys-current-stock',title:'Joffrey’s Bakery Current Stock',pageSize:50,sortKey:'product_name'});
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

  async receiving(){
    const {data,error}=await supabase.from('v_daily_receiving_report').select('*').order('date',{ascending:false}).order('created_at',{ascending:false}).limit(5000);if(error)throw error;
    const rows=data||[], groups=groupTransactionDates(rows,'receiving');
    content.innerHTML=`<div class="page-actions"><button class="btn primary" id="newReceiving" ${canPost()?'':'disabled'}>＋ New Receiving</button></div>
      <div class="info-banner">Receiving is grouped by <b>Receiving Date</b>. Click a date to see every receiving transaction and all products received that day. Each date can be printed or saved as PDF.</div>
      <div id="receivingDateList"></div>`;
    $('#newReceiving').onclick=openReceiving;
    renderTransactionDateList('#receivingDateList',groups,'receiving');
  },

  async transfers(){
    const {data,error}=await supabase.from('v_daily_transfer_report').select('*').order('date',{ascending:false}).order('created_at',{ascending:false}).limit(5000);if(error)throw error;
    const rows=data||[], groups=groupTransactionDates(rows,'transfer');
    content.innerHTML=`<div class="page-actions"><button class="btn primary" id="newTransfer" ${canPost()?'':'disabled'}>⇄ New Transfer</button></div>
      <div class="info-banner">Transfers are grouped by <b>Transfer Date</b>. Click a date to see every transfer transaction and all products transferred that day. Each date can be printed or saved as PDF.</div>
      <div id="transferDateList"></div>`;
    $('#newTransfer').onclick=openTransfer;
    renderTransactionDateList('#transferDateList',groups,'transfer');
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
    <div class="table-toolbar"><div><strong>${esc(label)} by Date</strong><div class="muted small">One row per operational date · click View to open the complete daily document</div></div></div>
    <div class="table-wrap"><table class="data-table"><thead><tr>
      <th>Date</th><th>Transactions</th><th>Lines</th><th>Units</th><th>Value</th><th>${partyLabel}</th><th>Action</th>
    </tr></thead><tbody>
      ${groups.map(g=>`<tr>
        <td><strong>${esc(dateFmt(g.date))}</strong></td>
        <td>${qty(g.transactions.size)}</td><td>${qty(g.rows.length)}</td><td>${qty(g.units)}</td><td>${money(g.value)}</td>
        <td>${esc([...g.parties].join(', ')||'—')}</td>
        <td><button class="btn small-btn primary" data-view-date="${esc(g.date)}">View ${esc(label)}</button></td>
      </tr>`).join('')}
    </tbody></table></div>
  </div>`;
  $('[data-view-date]',el).forEach(btn=>btn.onclick=()=>{
    const group=groups.find(g=>g.date===btn.dataset.viewDate);
    if(group)openTransactionDateDetail(kind,group);
  });
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
      <button class="btn primary" id="printDailyTransaction">Print / Save PDF</button>
      <button class="btn" id="exportDailyTransaction">Excel</button>
      <button class="btn" id="closeDailyTransaction">Close</button>
    </div>
    <div id="dailyTransactionTable"></div>
  </div>`,'wide');
  renderDataTable('#dailyTransactionTable',rows,columns,{
    filters:receiving?[{key:'supplier_name',label:'Supplier'},{key:'reference_no',label:'Reference'}]:[{key:'to_branch',label:'Destination',type:'location'},{key:'reference_no',label:'Reference'}],
    filename:`joffreys-${kind}-${group.date}`,title:`Joffrey’s Bakery ${title}`,pageSize:100
  });
  $('#printDailyTransaction').onclick=()=>printRows(rows,columns,`Joffrey’s Bakery ${title}`);
  $('#exportDailyTransaction').onclick=()=>exportRowsExcel(rows,columns,`joffreys-${kind}-${group.date}`);
  $('#closeDailyTransaction').onclick=closeModal;
}

function productOptions(supplierId=null){return state.products.filter(p=>!supplierId||Number(p.supplier_id)===Number(supplierId)).map(p=>`<option value="${p.id}">${esc(p.product_code||p.ref_no)} — ${esc(p.name)}</option>`).join('');}
function supplierOptions(){return state.suppliers.filter(s=>s.is_active).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');}
function branchOptions(excludeWarehouse=false){return state.branches.filter(b=>!excludeWarehouse||b.id!==state.warehouse?.id).map(b=>`<option value="${b.id}">${esc(locationName(b.name))}</option>`).join('');}
function openModal(title,subtitle,body,size='normal'){$('#modalTitle').textContent=title;$('#modalSubtitle').textContent=subtitle||'';modalBody.innerHTML=body;modal.className=`modal ${size}`;modal.showModal();}
function closeModal(){if(modal.open)modal.close();modalBody.innerHTML='';modal.className='modal';}

function receivingLineHtml(supplierId=null){return `<div class="erp-line" data-line><label class="pick"><input type="checkbox" class="line-check"><span></span></label><label class="product-cell">Product<select class="li-product" required><option value="">${supplierId?'Select product':'Select supplier first'}</option>${supplierId?productOptions(supplierId):''}</select><small class="li-meta">Category · Unit</small></label><label>Qty<input class="li-qty" type="number" min="0.01" step="0.01" required></label><label>Unit Cost<input class="li-cost" type="number" min="0" step="0.01" required></label><label>Line Value<input class="li-value" readonly></label><label>Expiry<input class="li-expiry" type="date" required></label><label>Batch<input class="li-batch" placeholder="Optional"></label><label class="notes-cell">Notes<input class="li-note" placeholder="Optional"></label><button type="button" class="line-remove" title="Remove">✕</button></div>`;}
function transferLineHtml(){return `<div class="erp-line transfer-line" data-line><label class="pick"><input type="checkbox" class="line-check"><span></span></label><label class="product-cell">Product<select class="li-product" required><option value="">Select product</option>${productOptions()}</select><small class="li-meta">Category · Unit</small></label><label>Available<input class="li-available" readonly></label><label>Qty to Transfer<input class="li-qty" type="number" min="0.01" step="0.01" required></label><label>Unit Cost<input class="li-cost" readonly></label><label>Total Value<input class="li-value" readonly></label><label class="notes-cell">Notes<input class="li-note" placeholder="Optional"></label><button type="button" class="line-remove" title="Remove">✕</button></div>`;}

function bindReceivingLines(container){
  $$('[data-line]',container).forEach(row=>{if(row.dataset.bound)return;row.dataset.bound='1';const sel=$('.li-product',row),q=$('.li-qty',row),cost=$('.li-cost',row),value=$('.li-value',row),meta=$('.li-meta',row);$('.line-remove',row).onclick=()=>{if($$('[data-line]',container).length>1)row.remove();};const calc=()=>value.value=money(Number(q.value||0)*Number(cost.value||0));sel.onchange=()=>{const p=state.products.find(x=>String(x.id)===sel.value);if(p){cost.value=Number(p.unit_cost||0).toFixed(2);meta.textContent=`${p.category||'Uncategorized'} · ${p.unit||'PCS'}`;}calc();};q.oninput=calc;cost.oninput=calc;});
}
function syncReceivingSupplier(container,supplierId){
  $$('[data-line]',container).forEach(row=>{const sel=$('.li-product',row);const current=Number(sel.value||0);const allowed=state.products.some(p=>p.id===current&&Number(p.supplier_id)===Number(supplierId));sel.innerHTML=`<option value="">${supplierId?'Select product':'Select supplier first'}</option>${supplierId?productOptions(supplierId):''}`;if(allowed)sel.value=String(current);else{sel.value='';$('.li-cost',row).value='';$('.li-value',row).value='';$('.li-meta',row).textContent='Category · Unit';}});
}
function syncReceivingExpiryMin(container,receivedDate){
  $$('.li-expiry',container).forEach(input=>{input.min=receivedDate||INVENTORY_START_DATE;if(input.value&&receivedDate&&input.value<receivedDate)input.value='';});
}
function bindTransferLines(container,stockMap){
  $$('[data-line]',container).forEach(row=>{if(row.dataset.bound)return;row.dataset.bound='1';const sel=$('.li-product',row),q=$('.li-qty',row),cost=$('.li-cost',row),value=$('.li-value',row),available=$('.li-available',row),meta=$('.li-meta',row);$('.line-remove',row).onclick=()=>{if($$('[data-line]',container).length>1)row.remove();};const calc=()=>value.value=money(Number(q.value||0)*Number(cost.value||0));sel.onchange=()=>{const p=state.products.find(x=>String(x.id)===sel.value),pos=stockMap.get(Number(sel.value));if(p){cost.value=Number(p.unit_cost||0).toFixed(2);meta.textContent=`${p.category||'Uncategorized'} · ${p.unit||'PCS'}`;}available.value=qty(pos?.available_quantity||0);calc();};q.oninput=calc;});
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
  openModal('New Receiving','Supplier receiving posts only to Bakery Warehouse. Expiry is required for every line.',`<form id="receiveForm"><div class="form-grid grid-3-form"><label>Receiving Reference<input id="rRef" required placeholder="e.g. REC-260826-01"></label><label>Receiving Date<input id="rDate" type="date" required min="${INVENTORY_START_DATE}" max="${isoToday()}" value="${isoToday()}"></label><label>Supplier<select id="rSupplier" required><option value="">Select supplier</option>${supplierOptions()}</select></label><label>Invoice Number<input id="rInvoice" placeholder="Optional invoice number"></label><label>Receiving Location<input value="Bakery Warehouse" readonly></label><label class="span-3">Notes<textarea id="rNotes" placeholder="Optional receiving notes"></textarea></label></div><div class="info-banner">Choose the supplier first. Only products assigned to that supplier will be available. Expiry is mandatory.</div><div class="line-toolbar"><button id="rAdd" type="button" class="btn">＋ Add Product</button><button id="rDelete" type="button" class="btn">Delete Selected</button><button id="rCalc" type="button" class="btn">Calculate</button></div><div class="line-scroll"><div id="receiveLines" class="erp-lines">${receivingLineHtml()}</div></div><div class="form-actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn" data-save data-action="new">Save & New</button><button type="submit" class="btn primary" data-save data-action="save">Save</button></div></form>`,'wide');
  const form=$('#receiveForm'),lines=$('#receiveLines');bindReceivingLines(lines);syncReceivingExpiryMin(lines,$('#rDate').value);
  $('#rSupplier').onchange=()=>syncReceivingSupplier(lines,Number($('#rSupplier').value)||null);
  $('#rDate').onchange=()=>syncReceivingExpiryMin(lines,$('#rDate').value);
  $('#rAdd').onclick=()=>{const sid=Number($('#rSupplier').value)||null;lines.insertAdjacentHTML('beforeend',receivingLineHtml(sid));bindReceivingLines(lines);syncReceivingExpiryMin(lines,$('#rDate').value);};
  $('#rDelete').onclick=()=>{$$('.line-check:checked',lines).forEach(c=>{if($$('[data-line]',lines).length>1)c.closest('[data-line]').remove();});};$('#rCalc').onclick=()=>calculateReceiving(lines);$('[data-cancel]',form).onclick=closeModal;
  form.onsubmit=e=>{e.preventDefault();const action=e.submitter?.dataset.action||'save';saveLocked(form,action,async()=>{const supplierId=Number($('#rSupplier').value);if(!supplierId)throw new Error('Supplier is required');const rows=$$('[data-line]',lines);validateUniqueProducts(rows);const items=rows.map(row=>({product_id:Number($('.li-product',row).value),quantity:Number($('.li-qty',row).value),unit_cost:Number($('.li-cost',row).value),expiry_date:$('.li-expiry',row).value||null,batch_no:$('.li-batch',row).value.trim()||null,notes:$('.li-note',row).value.trim()||null}));if(items.some(x=>!x.product_id||x.quantity<=0||x.unit_cost<0||!x.expiry_date))throw new Error('Product, quantity, cost and expiry are required on every receiving line');if(items.some(x=>Number(state.products.find(p=>p.id===x.product_id)?.supplier_id)!==supplierId))throw new Error('One or more products do not belong to the selected supplier');const {data,error}=await supabase.rpc('post_receiving',{p_received_date:$('#rDate').value,p_reference_no:$('#rRef').value.trim(),p_invoice_no:$('#rInvoice').value.trim()||null,p_supplier_id:supplierId,p_branch_id:state.warehouse.id,p_items:items,p_notes:$('#rNotes').value.trim()||null,p_posting_key:postingKey});if(error)throw error;await afterTransactionSaved('receiving',`Receiving ${data.reference_no||'#'+data.id} saved${data.duplicate?' (already posted)':''}`,action,openReceiving);});};
}

function openTransfer(){
  if(!canPost())return toast('Your role cannot post transfers','error');if(!state.warehouse)return toast('Bakery Warehouse is not configured','error');const postingKey=newPostingKey();const whRows=state.positions.filter(x=>x.branch_id===state.warehouse.id);const stockMap=new Map(whRows.map(x=>[x.product_id,x]));
  openModal('New Transfer','FEFO transfer from Bakery Warehouse to one active physical branch.',`<form id="transferForm"><div class="form-grid grid-3-form"><label>Transfer Reference<input id="tRef" required placeholder="e.g. TRF-260826-01"></label><label>Date<input id="tDate" type="date" required min="${INVENTORY_START_DATE}" max="${isoToday()}" value="${isoToday()}"></label><label>From Location<input value="Bakery Warehouse" readonly></label><label>To Location<select id="tTo" required><option value="">Select destination</option>${branchOptions(true)}</select></label><label class="span-2">Notes<textarea id="tNotes" placeholder="Optional transfer notes"></textarea></label></div><div class="line-toolbar"><button id="tAdd" type="button" class="btn">＋ Add Product</button><button id="tDelete" type="button" class="btn">Delete Selected</button><button id="tCalc" type="button" class="btn">Calculate</button></div><div class="line-scroll"><div id="transferLines" class="erp-lines">${transferLineHtml()}</div></div><div class="form-actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn" data-save data-action="new">Save & New</button><button type="submit" class="btn primary" data-save data-action="save">Save</button></div></form>`,'wide');
  const form=$('#transferForm'),lines=$('#transferLines');bindTransferLines(lines,stockMap);$('#tAdd').onclick=()=>{lines.insertAdjacentHTML('beforeend',transferLineHtml());bindTransferLines(lines,stockMap);};$('#tDelete').onclick=()=>{$$('.line-check:checked',lines).forEach(c=>{if($$('[data-line]',lines).length>1)c.closest('[data-line]').remove();});};$('#tCalc').onclick=()=>calculateTransfer(lines);$('[data-cancel]',form).onclick=closeModal;
  form.onsubmit=e=>{e.preventDefault();const action=e.submitter?.dataset.action||'save';saveLocked(form,action,async()=>{const rows=$$('[data-line]',lines);validateUniqueProducts(rows);const items=rows.map(row=>{const product_id=Number($('.li-product',row).value),quantity=Number($('.li-qty',row).value),available=Number(stockMap.get(product_id)?.available_quantity||0);if(quantity>available)throw new Error(`Insufficient stock for ${state.products.find(p=>p.id===product_id)?.name||'product'}: available ${qty(available)}`);return {product_id,quantity,notes:$('.li-note',row).value.trim()||null};});if(items.some(x=>!x.product_id||x.quantity<=0))throw new Error('Invalid transfer line quantity');const {data,error}=await supabase.rpc('post_transfer',{p_transfer_date:$('#tDate').value,p_reference_no:$('#tRef').value.trim(),p_to_branch_id:Number($('#tTo').value),p_items:items,p_notes:$('#tNotes').value.trim()||null,p_posting_key:postingKey});if(error)throw error;await afterTransactionSaved('transfers',`Transfer ${data.reference_no||'#'+data.id} saved${data.duplicate?' (already posted)':''}`,action,openTransfer);});};
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
  const r=periodRange('this_month');content.innerHTML=`<div class="report-controls"><label>Report<select id="reportType"><option value="current_stock">Current Stock Report</option><option value="valuation">Stock Valuation Report</option><option value="daily_receiving">Daily Receiving Report</option><option value="daily_transfer">Daily Transfer Report</option><option value="daily_movement">Daily Movement Report</option><option value="daily_waste">Daily Waste Report</option><option value="monthly_receiving">Monthly Receiving Summary</option><option value="monthly_transfer">Monthly Transfer Summary</option><option value="monthly_movement">Monthly Movement Summary</option><option value="monthly_waste">Monthly Waste Summary</option><option value="warehouse_shops">Bakery Warehouse vs Jeddah Shops</option><option value="supplier_summary">Supplier Summary</option><option value="category_summary">Category Summary</option><option value="low_stock">Low Stock Report</option><option value="out_stock">Out of Stock Report</option><option value="expiry">Expiry Report</option><option value="product_history">Product Movement History</option><option value="branch_transfer">Branch Transfer Summary</option><option value="adjustment">Stock Adjustment Report</option></select></label><label id="reportProductWrap" class="hidden">Product<select id="reportProduct"><option value="">Select product</option>${productOptions()}</select></label><label>From<input id="reportFrom" type="date" min="${INVENTORY_START_DATE}" max="${isoToday()}" value="${r.from}"></label><label>To<input id="reportTo" type="date" min="${INVENTORY_START_DATE}" max="${isoToday()}" value="${r.to}"></label><button id="runReport" class="btn primary">Run Report</button></div><div id="reportResult" class="report-result"><div class="panel empty">Choose a report and click Run Report.</div></div>`;
  const sync=()=>$('#reportProductWrap').classList.toggle('hidden',$('#reportType').value!=='product_history');$('#reportType').onchange=sync;sync();$('#runReport').onclick=runReport;
}
function reportDateGroups(rows,dateKey){
  const map=new Map();
  for(const row of rows||[]){const d=String(row[dateKey]||'').slice(0,10);if(!d)continue;if(!map.has(d))map.set(d,[]);map.get(d).push(row);}
  return [...map.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([date,rows])=>({date,rows}));
}
async function runReport(){
  const type=$('#reportType').value,from=$('#reportFrom').value,to=$('#reportTo').value;if(from&&to&&from>to)return toast('Invalid report date range','error');const host=$('#reportResult');host.innerHTML='<div class="panel loading">Running report…</div>';
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

$('#modalClose').onclick=closeModal;modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');$('#refreshBtn').onclick=async()=>{try{await requireData(true);await go(state.currentPage);}catch(e){fail(e,'Refresh failed');}};$('#logoutBtn').onclick=async()=>{await supabase.auth.signOut();};
$('#loginForm').onsubmit=async e=>{e.preventDefault();const btn=e.submitter,old=btn.textContent;btn.disabled=true;btn.textContent='Signing in…';try{assertOnline();const {error}=await supabase.auth.signInWithPassword({email:$('#loginEmail').value.trim(),password:$('#loginPassword').value});if(error)throw error;}catch(err){fail(err,'Sign in failed');}finally{btn.disabled=false;btn.textContent=old;}};
$('#resetPasswordBtn').onclick=async()=>{const email=$('#loginEmail').value.trim();if(!email)return toast('Enter your email first','error');try{assertOnline();const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}${location.pathname}`});if(error)throw error;toast('Password reset email sent','success');}catch(e){fail(e,'Password reset failed');}};
$('#recoveryForm').onsubmit=async e=>{e.preventDefault();const p=$('#newPassword').value,c=$('#confirmPassword').value;if(p.length<8)return toast('Use at least 8 characters','error');if(p!==c)return toast('Passwords do not match','error');const btn=e.submitter,old=btn.textContent;btn.disabled=true;btn.textContent='Updating…';try{assertOnline();const {error}=await supabase.auth.updateUser({password:p});if(error)throw error;toast('Password updated. Sign in with your new password.','success');recoveryMode=false;await supabase.auth.signOut();showLogin();}catch(err){fail(err,'Password update failed');}finally{btn.disabled=false;btn.textContent=old;}};
function showLogin(){recoveryMode=false;$('#loginForm').classList.remove('hidden');$('#resetPasswordBtn').classList.remove('hidden');$('#recoveryForm').classList.add('hidden');}
function showRecovery(){recoveryMode=true;authView.classList.remove('hidden');appView.classList.add('hidden');$('#loginForm').classList.add('hidden');$('#resetPasswordBtn').classList.add('hidden');$('#recoveryForm').classList.remove('hidden');$('#newPassword').focus();}

async function boot(session){
  const seq=++bootSequence;state.session=session;
  if(!session){if(!recoveryMode)showLogin();authView.classList.remove('hidden');appView.classList.add('hidden');state.appUser=null;return;}
  if(recoveryMode){showRecovery();return;}
  authView.classList.add('hidden');appView.classList.remove('hidden');
  try{await loadAppUser();if(seq!==bootSequence)return;await requireData(true);if(seq!==bootSequence)return;renderNav();await go(state.currentPage);}catch(e){if(seq===bootSequence)fail(e,'Could not load account');}
}
window.addEventListener('online',()=>{updateNetworkStatus();toast('Connection restored','success');});
window.addEventListener('offline',()=>{updateNetworkStatus();toast('You are offline. Do not submit transactions.','error');});
updateNetworkStatus();

supabase.auth.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY'){state.session=session;showRecovery();return;}
  if(event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')return;
  if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='USER_UPDATED')boot(session);
});
const {data:{session},error:sessionError}=await supabase.auth.getSession();if(sessionError)fail(sessionError,'Session check failed');await boot(session);
