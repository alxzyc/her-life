import { getStore } from '@netlify/blobs';

const store = getStore('locations');

export default async (req) => {
  const email = new URL(req.url).searchParams.get('email');
  if (!email) {
    return new Response(JSON.stringify({ error: 'Informe ?email=' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const key = email.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
  const data = (await store.get(key, { type: 'json' })) || { userEmail: email, updates: [] };

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
};
