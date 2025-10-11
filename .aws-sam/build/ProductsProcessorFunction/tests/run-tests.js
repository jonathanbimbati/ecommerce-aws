import { request as _request } from 'http';
import { listen } from '../index';

const server = listen(0, async () => {
  const port = server.address().port;
  const base = `http://localhost:${port}`;
  console.log('Running minimal tests against', base);

  try {
    await testGetProducts(base);
    const created = await testCreateProduct(base);
    await testGetProduct(base, created.id);
    await testUpdateProduct(base, created.id);
    await testDeleteProduct(base, created.id);
    console.log('All tests passed');
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});

function request(method, path, data) {
  const url = new URL(path);
  const options = {
    method,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  return new Promise((resolve, reject) => {
    const req = _request(options, res => {
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

async function testGetProducts(base) {
  const res = await request('GET', `${base}/api/products`);
  if (res.statusCode !== 200 || !Array.isArray(res.body)) throw new Error('GET /api/products failed');
  console.log('GET /api/products OK');
}

async function testCreateProduct(base) {
  const payload = { name: 'Teste', price: 12.5, description: 'Produto de teste' };
  const res = await request('POST', `${base}/api/products`, payload);
  if (res.statusCode !== 201 || !res.body || !res.body.id) throw new Error('POST /api/products failed');
  console.log('POST /api/products OK');
  return res.body;
}

async function testGetProduct(base, id) {
  const res = await request('GET', `${base}/api/products/${id}`);
  if (res.statusCode !== 200 || res.body.id !== id) throw new Error('GET /api/products/:id failed');
  console.log('GET /api/products/:id OK');
}

async function testUpdateProduct(base, id) {
  const res = await request('PUT', `${base}/api/products/${id}`, { price: 99.9 });
  if (res.statusCode !== 200 || res.body.price !== 99.9) throw new Error('PUT /api/products/:id failed');
  console.log('PUT /api/products/:id OK');
}

async function testDeleteProduct(base, id) {
  const res = await request('DELETE', `${base}/api/products/${id}`);
  if (res.statusCode !== 204) throw new Error('DELETE /api/products/:id failed');
  console.log('DELETE /api/products/:id OK');
}
