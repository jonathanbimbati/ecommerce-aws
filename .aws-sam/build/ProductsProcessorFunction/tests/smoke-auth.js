import fetch from 'node-fetch';

async function run() {
  const base = 'http://localhost:3000';

  console.log('Registering test user...');
  const reg = await fetch(base + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'pass123', name: 'Test User' })
  });
  const regBody = await reg.text();
  console.log('Register response:', reg.status, regBody);

  console.log('Logging in...');
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'pass123' })
  });
  const loginJson = await login.json();
  console.log('Login response:', login.status, loginJson);
  const token = loginJson.token;
  if (!token) return console.error('No token received; aborting');

  console.log('Creating a new product with token...');
  const create = await fetch(base + '/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Produto Teste', price: 12.5, description: 'Criado por smoke test' })
  });
  const createBody = await create.text();
  console.log('Create product response:', create.status, createBody);
}

run().catch(err => { console.error('Smoke test failed', err); process.exit(1); });
