// Quick smoke test against the frontend's /api proxy to debug 502/401 without Puppeteer.
// Usage:
//   FRONTEND_URL=http://your-frontend-lb-host node backend/tests/smoke-proxy.js
// Optional envs:
//   E2E_USER_PREFIX, E2E_USER_PASSWORD

const fetch = require('node-fetch');

function genUsername() {
  const base = process.env.E2E_USER_PREFIX || 'smoke';
  const runId = process.env.GITHUB_RUN_ID || String(Math.floor(Date.now() / 1000));
  return `${base}-${runId}`;
}

async function main() {
  const FRONTEND_URL = process.env.FRONTEND_URL;
  if (!FRONTEND_URL) {
    console.error('FRONTEND_URL not set. Example: set FRONTEND_URL=http://<lb-hostname>');
    process.exit(2);
  }

  const user = {
    username: genUsername(),
    password: process.env.E2E_USER_PASSWORD || 'smoke123',
    name: 'Smoke User'
  };

  async function jsonOrText(res) {
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) {
      try { return await res.json(); } catch { /* fallthrough */ }
    }
    try { return await res.text(); } catch { return '<no body>'; }
  }

  // Root reachability
  console.log(`[1/5] GET ${FRONTEND_URL}`);
  try {
    const r = await fetch(FRONTEND_URL, { redirect: 'manual' });
    console.log('  -> status', r.status, 'location', r.headers.get('location'));
  } catch (e) {
    console.error('  X root fetch failed:', e.message || e);
  }

  // Proxy reachability
  console.log(`[2/5] GET ${FRONTEND_URL}/api/products`);
  try {
    const r = await fetch(FRONTEND_URL + '/api/products');
    const body = await jsonOrText(r);
    console.log('  -> status', r.status, 'items?', Array.isArray(body) ? body.length : typeof body);
  } catch (e) {
    console.error('  X products fetch failed:', e.message || e);
  }

  // Register via proxy
  console.log(`[3/5] POST ${FRONTEND_URL}/api/auth/register`);
  let token;
  try {
    const r = await fetch(FRONTEND_URL + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, password: user.password, name: user.name })
    });
    const body = await jsonOrText(r);
    console.log('  -> status', r.status, 'body', body);
    if (r.status === 200 || r.status === 201 || r.status === 409) {
      // try login next
    } else {
      console.error('  X register failed, stopping');
      process.exit(1);
    }
  } catch (e) {
    console.error('  X register error:', e.message || e);
    process.exit(1);
  }

  // Login via proxy
  console.log(`[4/5] POST ${FRONTEND_URL}/api/auth/login`);
  try {
    const r = await fetch(FRONTEND_URL + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, password: user.password })
    });
    const body = await jsonOrText(r);
    console.log('  -> status', r.status, 'body', body);
    if (r.ok && body && body.token) token = body.token;
    if (!token) {
      console.error('  X no token from login');
      process.exit(1);
    }
  } catch (e) {
    console.error('  X login error:', e.message || e);
    process.exit(1);
  }

  // Authenticated product create via proxy
  console.log(`[5/5] POST ${FRONTEND_URL}/api/products (auth)`);
  try {
    const r = await fetch(FRONTEND_URL + '/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Smoke Via Proxy', price: 9.99, description: 'from smoke-proxy' })
    });
    const body = await jsonOrText(r);
    console.log('  -> status', r.status, 'body', body);
    if (!r.ok) process.exit(1);
  } catch (e) {
    console.error('  X create product error:', e.message || e);
    process.exit(1);
  }

  console.log('Smoke proxy OK');
}

main().catch(err => { console.error('Smoke proxy failed:', err); process.exit(1); });
