// ============================================================
//  travel-proxy/api/chat.js  — con rate limit
// ============================================================

// Mappa in memoria: ip → { count, resetTime }
const rateLimit = new Map();

export default async function handler(req, res) {

  // ── 1. Solo POST ──────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── 2. Rate limit: max 20 richieste/ora per IP ────────────
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  const now = Date.now();
  const entry = rateLimit.get(ip) || { count: 0, resetTime: now + 3600000 };

  if (now > entry.resetTime) {
    entry.count = 0;
    entry.resetTime = now + 3600000;
  }
  entry.count++;
  rateLimit.set(ip, entry);

  if (entry.count > 20) {
    return res.status(429).json({ error: 'Troppe richieste, riprova più tardi' });
  }

  // ── 3. Verifica token segreto ─────────────────────────────
  const authHeader = req.headers['x-app-token'];
  if (!authHeader || authHeader !== process.env.APP_SECRET_TOKEN) {
    console.warn('[proxy] Richiesta rifiutata: token mancante o errato');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── 4. Valida il body ─────────────────────────────────────
  const { model, max_tokens, messages, system } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Campo "messages" mancante o vuoto' });
  }

  if (max_tokens && max_tokens > 4096) {
    return res.status(400).json({ error: 'max_tokens non può superare 4096' });
  }

  // ── 5. Chiamata ad Anthropic ──────────────────────────────
  let anthropicResponse;
  try {
    anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-6',
        max_tokens: max_tokens || 1000,
        ...(system ? { system } : {}),
        messages,
      }),
    });
  } catch (networkError) {
    console.error('[proxy] Errore di rete verso Anthropic:', networkError);
    return res.status(502).json({ error: 'Impossibile raggiungere Anthropic' });
  }

  // ── 6. Gestione errori Anthropic ──────────────────────────
  if (!anthropicResponse.ok) {
    const errBody = await anthropicResponse.json().catch(() => ({}));
    console.error('[proxy] Errore Anthropic:', anthropicResponse.status, errBody);

    const clientMessage = anthropicResponse.status === 429
      ? 'Troppe richieste, riprova tra qualche secondo'
      : 'Errore del servizio AI, riprova più tardi';

    return res.status(anthropicResponse.status).json({ error: clientMessage });
  }

  // ── 7. Risposta ok ────────────────────────────────────────
  const data = await anthropicResponse.json();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');

  return res.status(200).json(data);
}
