const fetch = require('node-fetch');

async function run() {
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  const base = `http://localhost:${port}`;

  console.log('Using base URL:', base);

  console.log('Registering test user...');
  const reg = await fetch(base + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'pass123', name: 'Test User' })
  });
  console.log('Register status:', reg.status);

  console.log('Logging in...');
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'pass123' })
  });
  const loginJson = await login.json();
  console.log('Login status:', login.status, 'token present:', Boolean(loginJson && loginJson.token));
  const token = loginJson.token;
  if (!token) throw new Error('No token received');

  console.log('Creating a new product with token...');
  const create = await fetch(base + '/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Produto Teste', price: 12.5, description: 'Criado por smoke-local' })
  });
  const createText = await create.text();
  console.log('Create product status:', create.status, createText);

  console.log('Requesting S3 presign (uploads)...');
  const presign = await fetch(base + '/api/uploads/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fileName: 'test.jpg', contentType: 'image/jpeg', size: 1024 })
  });
  const presignJson = await presign.json().catch(() => ({}));
  console.log('Presign status:', presign.status, presignJson && (presignJson.objectUrl || presignJson.error));
}

run().catch(err => { console.error('Smoke-local failed', err); process.exit(1); });
