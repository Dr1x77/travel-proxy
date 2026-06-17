// ============================================================
//  PATCH per App.tsx — sostituisci la chiamata Anthropic
//  con il proxy Vercel
// ============================================================

// ── Costanti da mettere in cima ad App.tsx ──────────────────
// (sostituiscono la API key hardcoded)

const PROXY_URL = 'https://IL-TUO-PROGETTO.vercel.app/api/chat';

// ⚠️  Questo token va messo in un file .env del progetto RN,
//     NON scritto direttamente qui nel codice.
//     Con Expo: usa app.config.js + process.env.APP_SECRET_TOKEN
//     Con RN bare: usa react-native-config
const APP_SECRET_TOKEN = process.env.APP_SECRET_TOKEN || '';

// ── Funzione helper — sostituisce la chiamata fetch diretta ──

async function callAI(messages, systemPrompt = '', maxTokens = 1000) {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-token': APP_SECRET_TOKEN,   // token segreto, non API key
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Errore ${response.status}`);
  }

  const data = await response.json();
  // Restituisce il testo direttamente, come faceva prima
  return data.content?.[0]?.text || '';
}

// ── Esempio d'uso nell'app (stesso pattern di prima) ─────────

// Prima (da rimuovere):
// const res = await fetch('https://api.anthropic.com/v1/messages', {
//   headers: { 'x-api-key': 'sk-ant-XXXXX', ... }
// })

// Dopo:
// const testo = await callAI(
//   [{ role: 'user', content: 'Genera itinerario per Roma' }],
//   'Sei un esperto di viaggi.',
//   1500
// );
