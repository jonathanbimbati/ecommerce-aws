const fetch = require('node-fetch');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'https://w3rtebdo58.execute-api.us-east-1.amazonaws.com/prod';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://a09c4d3270e0d46b880b671b9586f27e-1552508925.us-east-1.elb.amazonaws.com';

const TEST_USER = { username: 'testUI', password: 'testUI', name: 'Test UI' };

async function registerUser() {
  console.log('Registering user via frontend backend proxy...');
  const res = await fetch(FRONTEND_URL + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TEST_USER.username, password: TEST_USER.password, name: TEST_USER.name })
  });
  if (res.status === 201 || res.status === 200) {
    console.log('User registered (or already exists)');
    return true;
  }
  if (res.status === 409) {
    console.log('User already exists, continuing');
    return true;
  }
  const txt = await res.text();
  console.error('Failed to register user:', res.status, txt);
  return false;
}

async function runE2E() {
  const ok = await registerUser();
  if (!ok) throw new Error('Could not create UI user');

  console.log('Launching browser...');
  // Resolve an executable path for Chromium/Chrome. Prefer the env var, then common system locations.
  function findChrome() {
    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (envPath && fs.existsSync(envPath)) return envPath;
    const candidates = [
      '/snap/bin/chromium',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome'
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  const exe = findChrome();
  if (!exe) console.warn('No system Chrome/Chromium executable found; Puppeteer may fail to launch');
  const launchOpts = { headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] };
  if (exe) launchOpts.executablePath = exe;
  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  console.log('Opening frontend URL:', FRONTEND_URL);
  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2' });

  // navigate to /login
  await page.goto(FRONTEND_URL + '/login', { waitUntil: 'networkidle2' });

  // Fill login form
  await page.type('input[name="username"]', TEST_USER.username);
  await page.type('input[name="password"]', TEST_USER.password);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' })
  ]);

  console.log('Logged in, navigating to root (products)');
  await page.goto(FRONTEND_URL + '/', { waitUntil: 'networkidle2' });

  // Create a new product via the form on the right
  const name = 'E2E Product ' + Date.now();
  await page.type('input[placeholder="Nome"]', name);
  await page.type('input[placeholder="Preço"]', '12.34');
  await page.type('textarea[placeholder="Descrição"]', 'Created by E2E');
  await page.click('button.btn-success');
  console.log('Waiting for product to appear in the table...');
  await page.waitForFunction((nm) => {
    return Array.from(document.querySelectorAll('table tbody tr td')).some(td => td.innerText.includes(nm));
  }, { timeout: 15000 }, name);

  // Click Edit on the product row (find the button by traversing rows)
  const rows = await page.$$('table tbody tr');
  let targetRow = null;
  for (const row of rows) {
    const text = await row.$eval('td', td => td.innerText);
    if (text.includes(name)) { targetRow = row; break; }
  }
  if (!targetRow) throw new Error('Created product row not found');

  // Click Edit
  const editBtn = await targetRow.$('button.btn-primary');
  await editBtn.click();
  await page.waitForSelector('input[placeholder="Nome"]');

  // Change price and save
  const priceInput = await page.$('input[placeholder="Preço"]');
  await priceInput.click({ clickCount: 3 });
  await priceInput.type('19.9');
  await page.click('button.btn-success');
  console.log('Waiting for product update to be reflected...');
  // wait briefly for table to update
  await page.waitForTimeout(1000);
  console.log('Product updated, now removing it via UI');
  // Find the row again and click Remove
  const rows2 = await page.$$('table tbody tr');
  for (const row of rows2) {
    const text = await row.$eval('td', td => td.innerText);
    if (text.includes(name)) {
      const delBtn = await row.$('button.btn-danger');
      await delBtn.click();
      console.log('Waiting for product to be removed from the table...');
      await page.waitForFunction((nm) => {
        return !Array.from(document.querySelectorAll('table tbody tr td')).some(td => td.innerText.includes(nm));
      }, { timeout: 15000 }, name);
      break;
    }
  }

  console.log('Product removed, E2E completed');
  await browser.close();
}

runE2E().then(() => { console.log('E2E success'); process.exit(0); }).catch(err => { console.error('E2E failed:', err); process.exit(1); });
