const fetch = require('node-fetch');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Artifacts directory for E2E debug (screenshots, console logs, request failures)
const ARTIFACTS_DIR = path.resolve(__dirname, 'artifacts');
if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

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
  const launchOpts = {
    headless: 'new',
    // Ask Puppeteer to ignore HTTPS certificate errors at the API level too.
    // This is more reliable than relying on Chromium CLI flags alone when
    // puppeteer-core launches an externally provided Chromium binary.
    ignoreHTTPSErrors: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors',
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
      '--disable-popup-blocking',
      '--disable-dev-shm-usage',
      '--no-default-browser-check',
      '--disable-features=TranslateUI,OptimizationHints,IsolateOrigins,site-per-process',
      '--disable-background-networking',
      '--disable-translate',
      '--disable-client-side-phishing-detection',
      // Aggressive flags to try to bypass Safe Browsing / interstitials in CI
      '--safebrowsing-disable-auto-update',
      '--safebrowsing-disable-download-protection',
      '--disable-features=SafeBrowsing,WebSecurity,BlockInsecurePrivateNetworkRequests',
      '--disable-component-update',
      '--disable-client-side-phishing-detection',
      '--disable-sync',
      '--disable-default-apps',
      '--disable-infobars',
      '--disable-notifications',
      '--enable-automation'
    ]
  };
  if (exe) launchOpts.executablePath = exe;
  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  // Set a deterministic viewport for screenshots
  try { await page.setViewport({ width: 1280, height: 900 }); } catch (e) {}

  // Debug collectors
  const consoleMsgs = [];
  const requestFails = [];
  page.on('console', msg => {
    try {
      consoleMsgs.push({ type: msg.type(), text: msg.text(), args: msg.args().map(a => a.toString()) });
    } catch (e) { consoleMsgs.push({ type: 'error', text: String(msg) }); }
  });
  page.on('requestfailed', req => {
    const info = { url: req.url(), method: req.method(), failure: req.failure(), resourceType: req.resourceType() };
    requestFails.push(info);
    console.error('Request failed:', info.url, info.failure && info.failure.errorText);
  });

  // Also collect all requests and responses to help diagnose blocked requests
  const allRequests = [];
  page.on('request', req => {
    try { allRequests.push({ url: req.url(), method: req.method(), resourceType: req.resourceType(), headers: req.headers() }); } catch (e) {}
  });
  const allResponses = [];
  page.on('response', async res => {
    try {
      allResponses.push({ url: res.url(), status: res.status(), headers: res.headers() });
    } catch (e) {}
  });

  async function saveArtifacts(tag) {
    const prefix = path.join(ARTIFACTS_DIR, `${Date.now()}-${tag}`);
    try { fs.writeFileSync(prefix + '-console.json', JSON.stringify(consoleMsgs, null, 2)); } catch(e){}
    try { fs.writeFileSync(prefix + '-requests-failed.json', JSON.stringify(requestFails, null, 2)); } catch(e){}
    try { fs.writeFileSync(prefix + '-requests-all.json', JSON.stringify(allRequests, null, 2)); } catch(e){}
    try { fs.writeFileSync(prefix + '-responses-all.json', JSON.stringify(allResponses, null, 2)); } catch(e){}
    try { await page.screenshot({ path: prefix + '-screenshot.png', fullPage: true }); } catch(e){}
    // Try to save page HTML as fallback
    try { const html = await page.content(); fs.writeFileSync(prefix + '-page.html', html); } catch(e){}
  }

  console.log('Opening frontend URL:', FRONTEND_URL);
  // Do a server-side fetch of the frontend root and save the response to artifacts.
  // This helps diagnose cases where the browser blocks navigation but the server is reachable via plain HTTP.
  try {
    const resp = await fetch(FRONTEND_URL, { method: 'GET' });
    let bodyText = '';
    try { bodyText = await resp.text(); } catch (e) { bodyText = '<failed to read body>'; }
    const headersObj = {};
    try { for (const [k, v] of resp.headers.entries()) headersObj[k] = v; } catch (e) {}
    try {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, `${Date.now()}-http-root.json`), JSON.stringify({ url: FRONTEND_URL, status: resp.status, headers: headersObj, bodySnippet: bodyText.slice(0, 2000) }, null, 2));
      console.log('Saved HTTP root response to artifacts');
    } catch (e) { console.error('Failed to write http-root artifact:', e); }
  } catch (e) {
    console.error('Server-side fetch to frontend root failed:', e);
  }

  try {
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2' });
  } catch (err) {
    console.error('Navigation to frontend failed:', err);
    await saveArtifacts('nav-failure');
    throw err;
  }

  // navigate to /login
  try {
    await page.goto(FRONTEND_URL + '/login', { waitUntil: 'networkidle2' });
  } catch (err) {
    console.error('Navigation to /login failed:', err);
    await saveArtifacts('login-nav-failure');
    throw err;
  }

  // Fill login form
  await page.type('input[name="username"]', TEST_USER.username);
  await page.type('input[name="password"]', TEST_USER.password);
  try {
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);
  } catch (err) {
    console.error('Login flow failed:', err);
    await saveArtifacts('login-flow-failure');
    throw err;
  }

  console.log('Logged in, navigating to root (products)');
  try {
    await page.goto(FRONTEND_URL + '/', { waitUntil: 'networkidle2' });
  } catch (err) {
    console.error('Navigation to root failed:', err);
    await saveArtifacts('root-nav-failure');
    throw err;
  }

  // Create a new product via the form on the right
  const name = 'E2E Product ' + Date.now();
  await page.type('input[placeholder="Nome"]', name);
  await page.type('input[placeholder="Preço"]', '12.34');
  await page.type('textarea[placeholder="Descrição"]', 'Created by E2E');
  await page.click('button.btn-success');
  console.log('Waiting for product to appear in the table...');
  try {
    await page.waitForFunction((nm) => {
      return Array.from(document.querySelectorAll('table tbody tr td')).some(td => td.innerText.includes(nm));
    }, { timeout: 15000 }, name);
  } catch (err) {
    console.error('Waiting for created product failed:', err);
    await saveArtifacts('wait-for-product-failure');
    throw err;
  }

  // Click Edit on the product row (find the button by traversing rows)
  const rows = await page.$$('table tbody tr');
  let targetRow = null;
  for (const row of rows) {
    const text = await row.$eval('td', td => td.innerText);
    if (text.includes(name)) { targetRow = row; break; }
  }
  if (!targetRow) {
    await saveArtifacts('no-product-row');
    throw new Error('Created product row not found');
  }

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
      try {
        await page.waitForFunction((nm) => {
          return !Array.from(document.querySelectorAll('table tbody tr td')).some(td => td.innerText.includes(nm));
        }, { timeout: 15000 }, name);
      } catch (err) {
        console.error('Waiting for product removal failed:', err);
        await saveArtifacts('remove-wait-failure');
        throw err;
      }
      break;
    }
  }

  console.log('Product removed, E2E completed');
  try { await saveArtifacts('success'); } catch(e){}
  await browser.close();
}

runE2E().then(() => { console.log('E2E success'); process.exit(0); }).catch(err => { console.error('E2E failed:', err); process.exit(1); });
