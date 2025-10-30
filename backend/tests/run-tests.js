const http = require('http');
const app = require('../index');

const server = app.listen(0, async () => {
  const port = server.address().port;
  const base = `http://localhost:${port}`;
  console.log('Running minimal tests against', base);

  try {
    // Register and login to obtain a JWT for authenticated operations
    const token = await getAuthToken(base);

    await testGetProducts(base);
    const created = await testCreateProduct(base, token);
    await testGetProduct(base, created.id);
    await testUpdateProduct(base, created.id, token);
    await testDeleteProduct(base, created.id, token);
    await testPresign(base, token);
    console.log('All tests passed');
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});

function request(method, path, data, headers) {
  const url = new URL(path);
  const options = {
    method,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {})
  };
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function getAuthToken(base) {
  // Try register (ignore conflict), then login
  const payload = { username: 'testuser', password: 'pass123', name: 'Test User' };
  await request('POST', `${base}/api/auth/register`, payload).catch(() => ({}));
  const res = await request('POST', `${base}/api/auth/login`, { username: payload.username, password: payload.password });
  if (res.statusCode !== 200 || !res.body || !res.body.token) throw new Error('Login failed');
  console.log('Auth OK');
  return res.body.token;
}

async function testGetProducts(base) {
  const res = await request('GET', `${base}/api/products`);
  if (res.statusCode !== 200 || !Array.isArray(res.body)) throw new Error('GET /api/products failed');
  console.log('GET /api/products OK');
}

async function testCreateProduct(base, token) {
  const payload = { name: 'Teste', price: 12.5, description: 'Produto de teste' };
  const res = await request('POST', `${base}/api/products`, payload, { Authorization: `Bearer ${token}` });
  if (res.statusCode !== 201 || !res.body || !res.body.id) throw new Error('POST /api/products failed');
  console.log('POST /api/products OK');
  return res.body;
}

async function testGetProduct(base, id) {
  const res = await request('GET', `${base}/api/products/${id}`);
  if (res.statusCode !== 200 || res.body.id !== id) throw new Error('GET /api/products/:id failed');
  console.log('GET /api/products/:id OK');
}

async function testUpdateProduct(base, id, token) {
  const res = await request('PUT', `${base}/api/products/${id}`, { price: 99.9 }, { Authorization: `Bearer ${token}` });
  if (res.statusCode !== 200 || res.body.price !== 99.9) throw new Error('PUT /api/products/:id failed');
  console.log('PUT /api/products/:id OK');
}

async function testDeleteProduct(base, id, token) {
  const res = await request('DELETE', `${base}/api/products/${id}`, null, { Authorization: `Bearer ${token}` });
  if (res.statusCode !== 204) throw new Error('DELETE /api/products/:id failed');
  console.log('DELETE /api/products/:id OK');
}

async function testPresign(base, token) {
  const payload = { fileName: 'test.jpg', contentType: 'image/jpeg', size: 1024 };
  const res = await request('POST', `${base}/api/uploads/presign`, payload, { Authorization: `Bearer ${token}` });
  if (res.statusCode !== 200 || !res.body || !res.body.uploadUrl || !res.body.objectUrl) {
    throw new Error('POST /api/uploads/presign failed');
  }
  console.log('POST /api/uploads/presign OK');
}
