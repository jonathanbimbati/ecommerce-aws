// Remote smoke test for deployed API Gateway + Lambda
// Usage: set environment variables API_URL and ID_TOKEN, then run: node run-remote-tests.js

const API = process.env.API_URL;
const TOKEN = process.env.ID_TOKEN;

if (!API) {
  console.error('API_URL is required');
  process.exit(2);
}
if (!TOKEN) {
  console.error('ID_TOKEN is required');
  process.exit(2);
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${TOKEN}`
};

async function req(method, path, body) {
  const url = API + path;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let parsed = text;
  try { parsed = text ? JSON.parse(text) : null; } catch (e) { /* keep raw */ }
  return { status: res.status, body: parsed };
}

async function run() {
  console.log('Running remote smoke tests against', API);

  console.log('- GET /api/products');
  let r = await req('GET', '/api/products');
  console.log('  ', r.status, Array.isArray(r.body) ? `items=${r.body.length}` : r.body);
  if (r.status !== 200) throw new Error('GET /api/products failed');

  console.log('- POST /api/products');
  const payload = { name: 'Teste remoto', price: 9.99, description: 'Criado pelos smoke tests' };
  r = await req('POST', '/api/products', payload);
  console.log('  ', r.status, r.body);
  if (r.status !== 201 || !r.body || !r.body.id) throw new Error('POST failed');
  const id = r.body.id;

  console.log('- GET /api/products/' + id);
  r = await req('GET', '/api/products/' + id);
  console.log('  ', r.status, r.body);
  if (r.status !== 200) throw new Error('GET by id failed');

  console.log('- PUT /api/products/' + id);
  r = await req('PUT', '/api/products/' + id, { price: 19.9 });
  console.log('  ', r.status, r.body);
  if (r.status !== 200 || (r.body && r.body.price !== 19.9)) throw new Error('PUT failed');

  console.log('- DELETE /api/products/' + id);
  r = await req('DELETE', '/api/products/' + id);
  console.log('  ', r.status);
  if (r.status !== 204) throw new Error('DELETE failed');

  console.log('Remote smoke tests completed successfully');
}

run().catch(err => {
  console.error('Smoke tests failed:', err.message || err);
  process.exit(1);
});
