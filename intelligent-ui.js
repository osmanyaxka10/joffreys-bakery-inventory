const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const number = value => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const money = value => 'SAR ' + Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let mounted = false;
let chatHistory = [];
let activeFilter = 'all';

function installStyles() {
  if (document.getElementById('joffreys-intelligence-style')) return;
  const style = document.createElement('style');
  style.id = 'joffreys-intelligence-style';
  style.textContent = `
    .ji-wrap{display:grid;gap:14px;margin-bottom:16px;color:var(--text)}
    .ji-hero{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(240px,.65fr);gap:14px}
    .ji-card{background:var(--panel,#fff);border:1px solid var(--line);border-radius:12px;padding:16px;min-width:0;box-shadow:0 1px 3px rgba(15,23,42,.025)}
    .ji-kicker{font-size:10px;letter-spacing:.09em;text-transform:uppercase;font-weight:850;color:var(--muted)}
    .ji-title{font-size:17px;font-weight:850;letter-spacing:-.02em;margin:5px 0 6px}
    .ji-copy{font-size:12px;line-height:1.55;color:var(--muted);margin:0}
    .ji-live{display:inline-flex;align-items:center;gap:6px;border:1px solid #bbf7d0;background:#f0fdf4;color:#166534;border-radius:99px;padding:5px 9px;font-size:10px;font-weight:800;white-space:nowrap}
    .ji-live:before{content:'';width:6px;height:6px;border-radius:50%;background:#16a34a}
    .ji-header{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .ji-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:16px}
    .ji-metric{border:1px solid var(--line);background:var(--panel-soft,#f8fafc);border-radius:9px;padding:11px;min-width:0}
    .ji-metric strong{display:block;font-size:23px;letter-spacing:-.04em;line-height:1.1;margin:6px 0}
    .ji-metric span{font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase}
    .ji-metric small{display:block;color:var(--muted);font-size:10px;line-height:1.4}
    .ji-spark{display:flex;align-items:flex-end;gap:5px;height:92px;margin:18px 0 9px;padding:0 4px}
    .ji-spark-col{display:flex;flex:1;min-width:0;height:100%;align-items:center;justify-content:flex-end;flex-direction:column;gap:5px}
    .ji-spark-bar{width:min(24px,72%);min-height:2px;border-radius:5px 5px 2px 2px;background:#2563eb}
    .ji-spark-col span{font-size:9px;color:var(--muted);white-space:nowrap}
    .ji-legend{display:flex;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:10px}
    .ji-legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px}
    .ji-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:13px}
    .ji-chip{border:1px solid var(--line-strong);border-radius:99px;background:#fff;color:var(--text);padding:8px 11px;font-size:11px;font-weight:750}
    .ji-chip:hover{background:#f1f5f9;border-color:#94a3b8}
    .ji-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.88fr);gap:14px;align-items:start}
    .ji-section-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 12px;font-size:13px}
    .ji-filter{display:flex;gap:5px;flex-wrap:wrap}
    .ji-filter button{border:1px solid var(--line);background:#fff;color:var(--muted);border-radius:7px;padding:6px 8px;font-size:10px;font-weight:750}
    .ji-filter button[aria-pressed="true"]{background:#111827;color:#fff;border-color:#111827}
    .ji-risk-list{display:grid;gap:7px}
    .ji-risk-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:9px}
    .ji-risk-name{font-size:11px;font-weight:800;line-height:1.4;overflow-wrap:anywhere}
    .ji-risk-meta{font-size:10px;color:var(--muted);margin-top:4px}
    .ji-pill{display:inline-flex;align-items:center;border-radius:99px;padding:5px 8px;font-size:10px;font-weight:850;white-space:nowrap}
    .ji-pill.red{background:#fee2e2;color:#991b1b}.ji-pill.amber{background:#fef3c7;color:#92400e}.ji-pill.blue{background:#dbeafe;color:#1d4ed8}
    .ji-empty{padding:22px 10px;text-align:center;font-size:11px;color:var(--muted)}
    .ji-chat{display:flex;flex-direction:column;min-height:360px}
    .ji-chat-top{display:flex;align-items:center;gap:10px;margin-bottom:12px}
    .ji-orb{width:36px;height:36px;flex:none;border-radius:11px;background:linear-gradient(145deg,#111827,#334155);display:grid;place-items:center;color:white;font-size:17px}
    .ji-chat-top strong{display:block;font-size:13px}.ji-chat-top small{font-size:10px;color:var(--muted)}
    .ji-chat-log{display:flex;flex-direction:column;gap:10px;overflow:auto;max-height:310px;min-height:150px;padding:4px 2px 12px}
    .ji-msg{max-width:94%;padding:10px 12px;border-radius:11px;font-size:11px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
    .ji-msg.assistant{align-self:flex-start;background:#f1f5f9;border:1px solid #e2e8f0;color:#1e293b}
    .ji-msg.user{align-self:flex-end;background:#111827;color:#fff}
    .ji-chat-form{display:flex;gap:7px;margin-top:auto;padding-top:10px;border-top:1px solid var(--line)}
    .ji-chat-form textarea{min-width:0;flex:1;resize:vertical;min-height:42px;max-height:120px;border:1px solid var(--line-strong);border-radius:9px;padding:10px;font:inherit;font-size:11px;outline:none;background:#fff;color:var(--text)}
    .ji-chat-form textarea:focus{border-color:#64748b;box-shadow:0 0 0 3px rgba(71,85,105,.09)}
    .ji-send{border:1px solid #111827;background:#111827;color:#fff;border-radius:9px;padding:0 13px;font-size:11px;font-weight:800;min-width:66px}
    .ji-send:disabled{opacity:.5;cursor:wait}
    .ji-disclaimer{font-size:9px;color:var(--muted);line-height:1.5;margin-top:9px}
    .ji-status{font-size:10px;color:var(--muted);min-height:14px;margin-top:7px}
    .ji-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:9px;color:var(--muted)}
    @media(max-width:1050px){.ji-hero,.ji-body{grid-template-columns:1fr}.ji-chat{min-height:320px}}
    @media(max-width:620px){.ji-card{padding:12px}.ji-metrics{gap:6px}.ji-metric{padding:9px}.ji-metric strong{font-size:20px}.ji-header{align-items:flex-start}.ji-spark{height:78px}.ji-chat-log{max-height:250px}.ji-chat-form{align-items:stretch}.ji-send{padding:0 10px}}
  `;
  document.head.appendChild(style);
}

function buildSnapshot(state) {
  const positions = Array.isArray(state.positions) ? state.positions : [];
  const warehouse = positions.filter(row => String(row.branch_name || '').toLowerCase() === 'warehouse');
  const positive = warehouse.filter(row => Number(row.available_quantity || 0) > 0);
  const low = warehouse.filter(row => /low stock/i.test(row.stock_status || '')).sort((a,b) => Number(a.available_quantity || 0) - Number(b.available_quantity || 0));
  const out = warehouse.filter(row => /out of stock/i.test(row.stock_status || ''));
  const expiry = (Array.isArray(state.expiry) ? state.expiry : []).filter(row => Number(row.remaining_quantity || 0) > 0);
  const expirySoon = expiry.filter(row => row.expiry_date && Number(row.days_until_expiry) >= 0 && Number(row.days_until_expiry) <= 7);
  const expired = expiry.filter(row => row.expiry_date && Number(row.days_until_expiry) < 0);
  const noDate = expiry.filter(row => !row.expiry_date);
  const value = warehouse.reduce((sum,row)=>sum+Number(row.stock_value||0),0);
  const sumQty = rows => rows.reduce((sum,row)=>sum+Number(row.available_quantity ?? row.remaining_quantity ?? 0),0);
  return {
    capturedAt: new Date().toISOString(),
    locationScope: 'Bakery Warehouse only for stock metrics; expiry rows are the existing expiry view used by the app.',
    summary: {
      warehouseUnits: sumQty(warehouse),
      warehouseStockValueSAR: Number(value.toFixed(2)),
      warehouseActiveSKUs: positive.length,
      lowStockItems: low.length,
      outOfStockItems: out.length,
      expiringWithin7DaysBatches: expirySoon.length,
      expiringWithin7DaysUnits: sumQty(expirySoon),
      expiredBatchesWithRemainingStock: expired.length,
      expiredUnits: sumQty(expired),
      batchesMissingExpiry: noDate.length,
      unitsMissingExpiry: sumQty(noDate)
    },
    lowStock: low.slice(0, 40).map(row => ({product:row.product_name, sku:row.product_code, availablePCS:Number(row.available_quantity||0), reorderLevel:row.reorder_level ?? row.minimum_stock ?? row.low_stock_alert ?? null, supplier:row.supplier_name || null, status:row.stock_status || 'Low Stock'})),
    outOfStock: out.slice(0, 30).map(row => ({product:row.product_name,sku:row.product_code,supplier:row.supplier_name||null})),
    expiryRisk: [...expired,...expirySoon].slice(0, 50).map(row => ({product:row.product_name,sku:row.product_code,location:row.branch_name,remainingPCS:Number(row.remaining_quantity||0),expiryDate:row.expiry_date||null,daysUntilExpiry:row.days_until_expiry==null?null:Number(row.days_until_expiry),status:row.expiry_status||null,supplier:row.supplier_name||null})),
    dataQuality: { expiryRows: expiry.length, batchesMissingExpiry: noDate.length, sourceWarnings: Array.isArray(state.dataWarnings) ? state.dataWarnings.slice(0,8) : [] }
  };
}

function makeRiskRows(snapshot) {
  const rows = [];
  (snapshot.expiryRisk || []).forEach(row => rows.push({
    name: row.product || 'Unnamed product',
    meta: (row.daysUntilExpiry < 0 ? 'Expired' : 'Expiry ' + (row.expiryDate || 'unknown')) + ' · ' + number(row.remainingPCS) + ' PCS',
    status: row.daysUntilExpiry < 0 ? 'Expired' : row.daysUntilExpiry <= 3 ? '≤ 3 days' : '4–7 days',
    type: row.daysUntilExpiry < 0 ? 'red' : row.daysUntilExpiry <= 3 ? 'red' : 'amber',
    units: row.remainingPCS,
    days: row.daysUntilExpiry
  }));
  (snapshot.lowStock || []).slice(0,12).forEach(row => rows.push({
    name: row.product || 'Unnamed product',
    meta: 'Warehouse low stock · ' + number(row.availablePCS) + ' PCS available',
    status: 'Low stock',
    type: 'blue',
    units: row.availablePCS,
    days: 999
  }));
  return rows.sort((a,b) => a.days - b.days);
}

function appendMessage(log, role, text) {
  const bubble = document.createElement('div');
  bubble.className = 'ji-msg ' + (role === 'user' ? 'user' : 'assistant');
  bubble.textContent = text;
  log.appendChild(bubble);
  log.scrollTop = log.scrollHeight;
  return bubble;
}

export function mountIntelligentDashboard({ state, supabase, content }) {
  if (!content || !state || state.currentPage !== 'dashboard') return;
  installStyles();
  let root = document.getElementById('joffreys-intelligent-dashboard');
  if (!root) {
    root = document.createElement('section');
    root.id = 'joffreys-intelligent-dashboard';
    root.className = 'ji-wrap';
  }
  const snapshot = buildSnapshot(state);
  const positions = Array.isArray(state.positions) ? state.positions : [];
  const warehouse = positions.filter(row => String(row.branch_name || '').toLowerCase() === 'warehouse');
  const low = warehouse.filter(row => /low stock/i.test(row.stock_status || ''));
  const out = warehouse.filter(row => /out of stock/i.test(row.stock_status || ''));
  const expiry = snapshot.expiryRisk || [];
  const trendRows = (Array.isArray(state.cache?.dashboardTrend) ? state.cache.dashboardTrend : []).slice(-14);
  const maxTrend = Math.max(1, ...trendRows.map(row => Math.max(Number(row.inValue||0),Number(row.outValue||0))));
  const trend = trendRows.length ? trendRows.map(row => ({label:row.label, inValue:Number(row.inValue||0),outValue:Number(row.outValue||0)})) : [];

  root.innerHTML = `
    <div class="ji-hero">
      <section class="ji-card">
        <div class="ji-header"><div><div class="ji-kicker">Joffreys · Intelligent operations</div><div class="ji-title">Your bakery, at a glance</div><p class="ji-copy">An interactive read-only view of live inventory, expiry risk and stock priorities. Recommendations never post transactions.</p></div><span class="ji-live">Live data</span></div>
        <div class="ji-metrics">
          <div class="ji-metric"><span>Warehouse stock</span><strong>${number(snapshot.summary.warehouseUnits)}</strong><small>PCS on hand</small></div>
          <div class="ji-metric"><span>Low / out of stock</span><strong>${number(snapshot.summary.lowStockItems + snapshot.summary.outOfStockItems)}</strong><small>${number(snapshot.summary.lowStockItems)} low · ${number(snapshot.summary.outOfStockItems)} out</small></div>
          <div class="ji-metric"><span>Expiry attention</span><strong>${number(snapshot.summary.expiredUnits + snapshot.summary.expiringWithin7DaysUnits)}</strong><small>PCS expired or expiring within 7 days</small></div>
        </div>
        <div class="ji-footer"><span>Stock value: <strong>${money(snapshot.summary.warehouseStockValueSAR)}</strong></span><span>Snapshot: ${new Date(snapshot.capturedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div>
      </section>
      <section class="ji-card">
        <div class="ji-kicker">Fast actions</div><div class="ji-title">What needs attention?</div><p class="ji-copy">Choose a question to start a data-aware conversation with the bakery assistant.</p>
        <div class="ji-actions">
          <button class="ji-chip" type="button" data-ji-prompt="Summarize the most important inventory risks in Bakery Warehouse from the current snapshot. Rank actions by urgency and explain your reasoning.">✦ Daily priorities</button>
          <button class="ji-chip" type="button" data-ji-prompt="Which products are expired or expiring within 7 days? Group by urgency and recommend safe operational next steps.">◷ Expiry risk</button>
          <button class="ji-chip" type="button" data-ji-prompt="Review the low-stock and out-of-stock items and suggest a transfer or supplier-order review list. Do not invent demand or quantities.">↗ Replenishment</button>
          <button class="ji-chip" type="button" data-ji-prompt="Explain the current stock health and any data-quality warnings in plain language.">◎ Stock health</button>
        </div>
      </section>
    </div>
    <div class="ji-body">
      <section class="ji-card">
        <div class="ji-section-title"><span>Priority watchlist</span><span class="ji-kicker">${number((snapshot.expiryRisk||[]).length + low.length + out.length)} flagged records</span></div>
        <div class="ji-filter" role="group" aria-label="Filter priority watchlist">
          <button type="button" data-ji-filter="all" aria-pressed="true">All</button>
          <button type="button" data-ji-filter="expiry" aria-pressed="false">Expiry</button>
          <button type="button" data-ji-filter="low" aria-pressed="false">Low stock</button>
          <button type="button" data-ji-filter="out" aria-pressed="false">Out of stock</button>
        </div>
        <div class="ji-risk-list" data-ji-risk-list style="margin-top:10px"></div>
        <div class="ji-footer"><span>Warehouse metrics are filtered to the physical Warehouse location.</span><button type="button" class="ji-chip" data-ji-prompt="Help me audit products with missing expiry dates. Explain what to verify before correcting any records.">Review missing expiry dates</button></div>
      </section>
      <section class="ji-card ji-chat">
        <div class="ji-chat-top"><div class="ji-orb">✦</div><div><strong>Bakery AI Assistant</strong><small>GPT-powered · Read-only · No automatic posting</small></div></div>
        <div class="ji-chat-log" data-ji-chat-log aria-live="polite"><div class="ji-msg assistant">Assalamu alaikum! I can help review warehouse stock, expiry risks, replenishment and inventory data quality. I only recommend actions — I never post receiving, transfers, waste or adjustments.</div></div>
        <form class="ji-chat-form" data-ji-chat-form><textarea data-ji-input rows="2" maxlength="1800" aria-label="Ask the bakery assistant" placeholder="Ask: What should I check first today?"></textarea><button class="ji-send" type="submit">Ask AI ↗</button></form>
        <div class="ji-status" data-ji-status role="status"></div>
        <div class="ji-disclaimer">AI suggestions are advisory. Verify stock, expiry dates, supplier details and branch rules in the inventory system before acting. Your signed-in session is required; no inventory write actions are exposed to the assistant.</div>
      </section>
    </div>
  `;

  const periodBar = content.querySelector('.period-bar');
  if (periodBar) periodBar.insertAdjacentElement('afterend', root);
  else content.prepend(root);

  const riskList = root.querySelector('[data-ji-risk-list]');
  const riskRows = makeRiskRows(snapshot);
  function paintRiskList() {
    root.querySelectorAll('[data-ji-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.jiFilter === activeFilter)));
    const rows = riskRows.filter(row => activeFilter === 'all' || (activeFilter === 'expiry' && /Expired|Expiry/.test(row.meta)) || (activeFilter === 'low' && row.status === 'Low stock') || (activeFilter === 'out' && row.status === 'Out of stock'));
    riskList.innerHTML = rows.length ? rows.slice(0,16).map(row => `<div class="ji-risk-row"><div><div class="ji-risk-name">${esc(row.name)}</div><div class="ji-risk-meta">${esc(row.meta)}</div></div><span class="ji-pill ${row.type}">${esc(row.status)}</span></div>`).join('') : '<div class="ji-empty">No records in this category from the current data snapshot.</div>';
  }
  root.querySelectorAll('[data-ji-filter]').forEach(button => button.addEventListener('click', () => { activeFilter = button.dataset.jiFilter; paintRiskList(); }));
  paintRiskList();

  const log = root.querySelector('[data-ji-chat-log]');
  const form = root.querySelector('[data-ji-chat-form]');
  const input = root.querySelector('[data-ji-input]');
  const status = root.querySelector('[data-ji-status]');
  const send = async prompt => {
    const message = String(prompt || '').trim();
    if (!message || form.dataset.busy === 'true') return;
    form.dataset.busy = 'true'; input.value = ''; input.disabled = true; form.querySelector('button').disabled = true; status.textContent = 'Checking the signed-in session…';
    appendMessage(log, 'user', message);
    const pending = appendMessage(log, 'assistant', 'Reviewing the current inventory snapshot…');
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const token = data?.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again to use the assistant.');
      const context = buildSnapshot(state);
      const response = await fetch('/api/bakery-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ message, history: chatHistory.slice(-8), context })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Assistant request failed (' + response.status + ').');
      const answer = String(payload.answer || '').trim();
      if (!answer) throw new Error('The assistant returned an empty answer. Please try again.');
      pending.textContent = answer;
      chatHistory.push({ role: 'user', content: message }, { role: 'assistant', content: answer });
      chatHistory = chatHistory.slice(-8);
      status.textContent = 'Answer based on the snapshot shown above. No inventory changes were made.';
    } catch (error) {
      pending.textContent = 'I could not complete that request. ' + (error?.message || String(error));
      status.textContent = 'Check the API configuration and your connection, then try again.';
    } finally {
      form.dataset.busy = 'false'; input.disabled = false; form.querySelector('button').disabled = false; input.focus();
    }
  };
  form.addEventListener('submit', event => { event.preventDefault(); send(input.value); });
  root.querySelectorAll('[data-ji-prompt]').forEach(button => button.addEventListener('click', () => send(button.dataset.jiPrompt)));
  mounted = true;
}
