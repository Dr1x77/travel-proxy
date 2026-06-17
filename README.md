# Travel Proxy — Vercel

Proxy sicuro per chiamate Anthropic API dalla app mobile.

## Setup in 5 minuti

### 1. Genera il token segreto
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copia l'output — è il tuo APP_SECRET_TOKEN.

### 2. Deploy su Vercel
```bash
npm i -g vercel
vercel login
vercel deploy
```

### 3. Imposta le variabili d'ambiente su Vercel Dashboard
- Vai su vercel.com → tuo progetto → Settings → Environment Variables
- Aggiungi: ANTHROPIC_API_KEY = sk-ant-...
- Aggiungi: APP_SECRET_TOKEN = (il token generato al passo 1)

### 4. Aggiorna l'app React Native
```javascript
// Sostituisci l'URL in App.tsx:
const PROXY_URL = 'https://travel-proxy.vercel.app/api/chat';
const APP_SECRET_TOKEN = 'il-tuo-token-qui'; // salvalo in .env dell'app

const response = await fetch(PROXY_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-app-token': APP_SECRET_TOKEN,
  },
  body: JSON.stringify({ messages, system, max_tokens: 1000 }),
});
```

## Sicurezza implementata
- Token segreto su ogni richiesta (x-app-token header)
- API key Anthropic mai esposta al client
- Limite max_tokens per evitare abusi
- Errori Anthropic oscurati al client
- Solo metodo POST accettato
