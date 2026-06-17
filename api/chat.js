// ============================================================
//  travel-proxy/api/chat.js
//  Proxy sicuro per Anthropic API — deploy su Vercel
// ============================================================
//
//  Variabili d'ambiente da impostare su Vercel Dashboard:
//    ANTHROPIC_API_KEY   → sk-ant-...
//    APP_SECRET_TOKEN    → una stringa casuale lunga (vedi sotto)
//
//  Come generare APP_SECRET_TOKEN (esegui nel terminale):
//    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// ============================================================

export default async function handler(req, res) {

  // ── 1. Solo POST ────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── 2. Verifica token segreto ───────────────────────────────
  const authHeader = req.headers['x-app-token'];
  if (!authHeader || authHeader !== process.env.APP_SECRET_TOKEN) {
    console.warn('[proxy] Richiesta rifiutata: token mancante o errato');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── 3. Valida il body ───────────────────────────────────────
  const { model, max_tokens, messages, system } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Campo "messages" mancante o vuoto' });
  }

  if (max_tokens && max_tokens > 4096) {
    return res.status(400).json({ error: 'max_tokens non può superare 4096' });
  }

  // ── 4. Chiamata ad Anthropic ────────────────────────────────
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

  // ── 5. Gestione errori Anthropic ────────────────────────────
  if (!anthropicResponse.ok) {
    const errBody = await anthropicResponse.json().catch(() => ({}));
    console.error('[proxy] Errore Anthropic:', anthropicResponse.status, errBody);

    const clientMessage = anthropicResponse.status === 429
      ? 'Troppe richieste, riprova tra qualche secondo'
      : 'Errore del servizio AI, riprova più tardi';

    return res.status(anthropicResponse.status).json({ error: clientMessage });
  }

  // ── 6. Risposta ok → passa al client ───────────────────────
  const data = await anthropicResponse.json();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');

  return res.status(200).json(data);
}
