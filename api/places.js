// api/places.js
// Endpoint proxy per Google Places API (Text Search)
// Riceve: { query: string, lat?: number, lng?: number, language?: 'it'|'en', token: string }
// Restituisce: { results: [{ name, address, lat, lng }] }
// language: localizza nome/indirizzo dei risultati (default 'it' se assente/non riconosciuta)

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, lat, lng, language, token } = req.body || {};

    // Stesso token di autenticazione già usato per /api/chat
    if (!token || token !== process.env.APP_SECRET_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Missing query' });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server misconfigured: missing GOOGLE_PLACES_API_KEY' });
    }

    // Costruisce URL Text Search
    const params = new URLSearchParams({
      query: query.trim(),
      key: apiKey,
    });

    // Localizza nome/indirizzo dei risultati nella lingua dell'app (default 'it' se non specificata
    // o non riconosciuta — evita risultati anglicizzati tipo "Turin" invece di "Torino")
    const safeLanguage = (language === 'it' || language === 'en') ? language : 'it';
    params.set('language', safeLanguage);

    // Se abbiamo coordinate di contesto (es. tappa), usiamo location+radius
    // per dare priorità ai risultati vicini, senza escludere il resto.
    if (typeof lat === 'number' && typeof lng === 'number') {
      params.set('location', `${lat},${lng}`);
      params.set('radius', '50000'); // 50 km, coerente con la logica già usata in app
    }

    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`;

    const googleRes = await fetch(url);
    const data = await googleRes.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places error:', data.status, data.error_message);
      return res.status(502).json({ error: 'Places API error', detail: data.status });
    }

    const results = (data.results || []).slice(0, 8).map(place => ({
      name: place.name || '',
      address: place.formatted_address || '',
      lat: place.geometry?.location?.lat ?? null,
      lng: place.geometry?.location?.lng ?? null,
    })).filter(r => r.lat !== null && r.lng !== null);

    return res.status(200).json({ results });
  } catch (err) {
    console.error('places.js error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
