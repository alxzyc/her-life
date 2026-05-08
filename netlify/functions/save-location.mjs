import { getStore } from '@netlify/blobs';

const store = getStore('locations');

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' }
    });
  }

  try {
    const payload = await req.json();
    const { userEmail = 'anon', userName = 'Usuária', latitude, longitude, source = 'app', timestamp = Date.now() } = payload || {};

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return new Response(JSON.stringify({ error: 'latitude/longitude inválidos' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    const key = userEmail.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
    const current = (await store.get(key, { type: 'json' })) || { userEmail, userName, updates: [] };

    current.userName = userName;
    current.userEmail = userEmail;
    current.updates = [
      {
        latitude,
        longitude,
        source,
        timestamp
      },
      ...(current.updates || [])
    ].slice(0, 200);

    await store.setJSON(key, current);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Erro ao salvar localização', details: String(err?.message || err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
};
