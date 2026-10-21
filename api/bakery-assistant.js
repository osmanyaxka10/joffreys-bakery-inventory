const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ivqygskesdrretwgouea.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_f4Jv-1y826TQkpRbVYAeEg_91xKWGSx';
const MODEL = process.env.OPENAI_MODEL || 'gpt-6-astra';

function reply(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').setHeader('Cache-Control', 'no-store').json(body);
}
function safeText(value, max = 1800) { return typeof value === 'string' ? value.slice(0, max) : ''; }

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(res, 405, { error: 'Use POST for assistant requests.' });
  }
  if (!process.env.OPENAI_API_KEY) return reply(res, 503, { error: 'AI is not configured yet. Add OPENAI_API_KEY to the Vercel Preview environment, then redeploy this branch.' });
  const authorization = String(req.headers.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return reply(res, 401, { error: 'Sign in to use the bakery assistant.' });

  try {
    const userResponse = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + match[1] }
    });
    if (!userResponse.ok) return reply(res, 401, { error: 'Your session is invalid or expired. Please sign in again.' });
    const user = await userResponse.json();
    if (!user?.id) return reply(res, 401, { error: 'Could not verify your signed-in account.' });

    const accountUrl = SUPABASE_URL + '/rest/v1/app_users?auth_user_id=eq.' + encodeURIComponent(user.id) + '&select=is_active&limit=1';
    const accountResponse = await fetch(accountUrl, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + match[1] }
    });
    if (!accountResponse.ok) return reply(res, 403, { error: 'Could not verify bakery account permissions. Please contact the inventory administrator.' });
    const accounts = await accountResponse.json();
    if (!Array.isArray(accounts) || !accounts.some(account => account.is_active === true)) {
      return reply(res, 403, { error: 'Your bakery inventory account is not active.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const message = safeText(body.message).trim();
    if (!message) return reply(res, 400, { error: 'Enter a question for the assistant.' });
    if (message.length > 1800) return reply(res, 413, { error: 'Keep each question under 1,800 characters.' });
    const context = body.context && typeof body.context === 'object' ? JSON.stringify(body.context).slice(0, 14000) : '{}';
    const history = Array.isArray(body.history) ? body.history.slice(-8).filter(item => item && ['user','assistant'].includes(item.role)).map(item => ({ role: item.role, content: safeText(item.content, 1200) })) : [];
    const input = [
      { role: 'user', content: 'CURRENT READ-ONLY INVENTORY SNAPSHOT (may be incomplete; do not assume missing data is zero):\n' + context + '\n\nCURRENT QUESTION:\n' + message },
      ...history
    ];
    // The newest question must be last in chronological order.
    const orderedInput = history.length ? [...history, input[0]] : input;
    const modelResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
      body: JSON.stringify({
        model: MODEL,
        instructions: 'You are the read-only bakery operations assistant for Joffreys Bakery Jeddah. Help staff understand stock, expiry/FEFO, low stock, replenishment, supplier follow-up, inventory data quality and operational priorities. Use only the supplied snapshot for live quantities and dates. Be concise, structured and practical. Clearly distinguish known facts from recommendations and missing information. Never invent product quantities, dates, suppliers, demand or transfers. Do not claim you queried the database. Never create, approve, post, modify or delete any inventory transaction; this application exposes no transaction tools. Recommend that users verify in the inventory app before acting. Preserve the Warehouse versus Jeddah Shops distinction. All quantity units are PCS unless the snapshot says otherwise.',
        input: orderedInput,
        max_output_tokens: 650,
        store: false
      })
    });
    const result = await modelResponse.json().catch(() => ({}));
    if (!modelResponse.ok) {
      const messageFromApi = result?.error?.message || 'The AI provider rejected the request.';
      console.error('Bakery assistant provider error:', modelResponse.status, messageFromApi);
      return reply(res, modelResponse.status === 429 ? 429 : 502, { error: modelResponse.status === 429 ? 'The AI service is busy or its usage limit was reached. Try again later.' : 'The AI service could not answer. Check the OPENAI_API_KEY, model access and project billing.' });
    }
    const answer = result.output_text || (result.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n').trim();
    if (!answer) return reply(res, 502, { error: 'The AI service returned no text. Please try again.' });
    return reply(res, 200, { answer, model: result.model || MODEL });
  } catch (error) {
    console.error('Bakery assistant request failed:', error?.message || error);
    return reply(res, 500, { error: 'The assistant could not complete the request. Please try again.' });
  }
};
