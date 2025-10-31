// Trigger a product INSERT via API Gateway to drive DynamoDB Stream
// Usage: node trigger-insert.js https://<api-id>.execute-api.<region>.amazonaws.com/Prod

const fetch = require('node-fetch');

async function main() {
  const base = process.argv[2];
  if (!base) {
    console.error('Usage: node trigger-insert.js <ApiBaseEndpoint>');
    process.exit(2);
  }
  const username = 'streamfix_' + Math.floor(Math.random() * 1e9);
  const password = 'Pass123!';

  async function post(path, body, headers={}) {
    const res = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    });
    const txt = await res.text();
    let parsed = txt;
    try { parsed = JSON.parse(txt); } catch {}
    return { status: res.status, body: parsed };
  }

  console.log('Registering', username);
  await post('/api/auth/register', { username, password, name: 'Stream Fix User' });

  console.log('Logging in');
  const login = await post('/api/auth/login', { username, password });
  if (!login.body || !login.body.token) {
    console.error('Login failed', login);
    process.exit(1);
  }
  const token = login.body.token;

  console.log('Creating product');
  const created = await post('/api/products', { name: 'Fix Stream Product', price: 12.34, description: 'trigger stream' }, { Authorization: `Bearer ${token}` });
  console.log('Create status', created.status, created.body);

  if (created.status !== 201 || !created.body || !created.body.id) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
