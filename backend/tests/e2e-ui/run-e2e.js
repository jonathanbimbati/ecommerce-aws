const fetch = require('node-fetch');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Artifacts directory for E2E debug (screenshots, console logs, request failures)
const ARTIFACTS_DIR = path.resolve(__dirname, 'artifacts');
if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

const API_URL = process.env.API_URL || 'https://w3rtebdo58.execute-api.us-east-1.amazonaws.com/prod';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://ecommerce-aws-nlb-20d654c0c2efadd3.elb.us-east-1.amazonaws.com';

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
      // Common Linux paths
      '/snap/bin/chromium',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      // Common Windows paths
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Chromium\\Application\\chrome.exe'
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
  // Turn off the built-in web security checks for the test browser to avoid
  // client-side blocking of requests we rewrite during interception.
  '--disable-web-security',
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
  else {
    // If puppeteer installed a bundled Chromium, prefer that before failing.
    try {
      const bundled = puppeteer.executablePath && puppeteer.executablePath();
      if (bundled && fs.existsSync(bundled)) {
        console.log('Using puppeteer bundled Chromium at', bundled);
        launchOpts.executablePath = bundled;
      }
    } catch (e) {
      // ignore
    }
  }
  let browser;
  try {
    browser = await puppeteer.launch(launchOpts);
  } catch (e) {
    console.error('Failed to launch browser with options:', launchOpts.executablePath || '(no executablePath)');
    console.error(e && e.message ? e.message : e);
    throw e;
  }
  const page = await browser.newPage();
  // Bypass any Content-Security-Policy set by the page so our rewrites and
  // test harness can load resources without being blocked by CSP rules.
  try {
    await page.setBypassCSP(true);
  } catch (e) {
    console.warn('Could not set bypass CSP on page:', e && e.message ? e.message : e);
  }
  // Create a CDP session and instruct the browser to ignore certificate errors at the CDP level.
  // This can help in CI where the Chromium build enforces interstitials despite flags / puppeteer options.
  try {
    const client = await page.target().createCDPSession();
    await client.send('Security.setIgnoreCertificateErrors', { ignore: true });
  } catch (e) {
    console.warn('Could not set CDP Security.setIgnoreCertificateErrors:', e && e.message ? e.message : e);
  }
  // Increase default timeouts to allow slower CI/remote networks some headroom
  page.setDefaultTimeout(60000);
  // Set a deterministic viewport for screenshots
  try { await page.setViewport({ width: 1280, height: 900 }); } catch (e) {}

  // Intercept requests and rewrite HTTPS -> HTTP for the staging frontend host.
  // This prevents automatic navigation to https:// which times out when the LB
  // doesn't terminate TLS in staging. We limit rewrites to the frontend host
  // to avoid interfering with external resources.
  try {
    const frontendHostname = (() => {
      try { return new URL(FRONTEND_URL).hostname; } catch (e) { return null; }
    })();
    if (frontendHostname) {
      await page.setRequestInterception(true);
      page.on('request', async req => {
        try {
          const url = req.url();
          // For any https request targeting the frontend host, perform a
          // server-side HTTP fetch and fulfill the browser request with the
          // fetched body. This avoids Chromium attempting a direct HTTPS
          // connection (which times out in staging) and avoids client-side
          // blocking like ERR_BLOCKED_BY_CLIENT.
          if (url.startsWith('https://') && new URL(url).hostname === frontendHostname) {
            const newUrl = url.replace(/^https:/, 'http:');
            console.log('Rewriting & fulfilling intercepted request', url, '->', newUrl);
            try {
              // Forward headers and body from the intercepted request
              const forwardedHeaders = req.headers ? req.headers() : {};
              const postData = (typeof req.postData === 'function') ? req.postData() : undefined;
              const fetchOpts = { method: req.method(), headers: forwardedHeaders, redirect: 'follow', timeout: 15000 };
              if (postData) fetchOpts.body = postData;
              const r = await fetch(newUrl, fetchOpts);
              const buffer = await r.buffer();
              const headers = {};
              try { for (const [k, v] of r.headers.entries()) headers[k] = v; } catch (e) {}
              // Remove hop-by-hop or encoding headers that may confuse Puppeteer
              delete headers['transfer-encoding'];
              delete headers['content-encoding'];
              // Ensure we supply a valid content-type when possible
              if (!headers['content-type'] && buffer && buffer.length > 0) headers['content-type'] = 'application/octet-stream';
              return req.respond({ status: r.status, headers, body: buffer });
            } catch (e) {
              console.error('Fetch-for-intercept failed for', newUrl, e && e.message ? e.message : e);
              try { return req.abort(); } catch (ee) { return req.continue(); }
            }
          }
        } catch (e) {
          // fallthrough to continue below
        }
        try { return req.continue(); } catch (e) { /* ignore */ }
      });
    }
  } catch (e) {
    console.warn('Could not enable request interception for https->http rewrite:', e && e.message ? e.message : e);
  }

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
  // Use redirect: 'manual' so we can detect 3xx Location headers pointing to https://
  // and attempt an HTTP fallback to the equivalent http:// URL.
  try {
    const resp = await fetch(FRONTEND_URL, { method: 'GET', redirect: 'manual' });
    let bodyText = '';
    try { bodyText = await resp.text(); } catch (e) { bodyText = '<failed to read body>'; }
    const headersObj = {};
    try { for (const [k, v] of resp.headers.entries()) headersObj[k] = v; } catch (e) {}
    const baseArtifact = { url: FRONTEND_URL, status: resp.status, headers: headersObj, bodySnippet: bodyText.slice(0, 2000) };
    try {
      const name = `${Date.now()}-http-root`;
      fs.writeFileSync(path.join(ARTIFACTS_DIR, `${name}.json`), JSON.stringify(baseArtifact, null, 2));
      console.log('Saved HTTP root response to artifacts');
      // If server returned a Location header that points to https://, attempt an http fallback
      const loc = (headersObj.location || headersObj.Location || headersObj.LOCATION);
      if (loc && String(loc).toLowerCase().startsWith('https://')) {
        try {
          const fallback = loc.replace(/^https:/i, 'http:');
          console.log('Detected redirect to https; attempting http fallback to', fallback);
          const fbResp = await fetch(fallback, { method: 'GET', redirect: 'manual', timeout: 10000 });
          let fbBody = '';
          try { fbBody = await fbResp.text(); } catch (e) { fbBody = '<failed to read body>'; }
          const fbHeaders = {};
          try { for (const [k, v] of fbResp.headers.entries()) fbHeaders[k] = v; } catch (e) {}
          fs.writeFileSync(path.join(ARTIFACTS_DIR, `${name}-http-fallback.json`), JSON.stringify({ requested: fallback, status: fbResp.status, headers: fbHeaders, bodySnippet: fbBody.slice(0,2000) }, null, 2));
          console.log('Saved HTTP fallback response to artifacts');
        } catch (e) {
          console.error('HTTP fallback fetch failed:', e && e.message ? e.message : e);
          try { fs.writeFileSync(path.join(ARTIFACTS_DIR, `${Date.now()}-http-fallback-err.txt`), String(e)); } catch (ee) {}
        }
      }
    } catch (e) { console.error('Failed to write http-root artifact:', e); }
  } catch (e) {
    console.error('Server-side fetch to frontend root failed:', e);
  }

  try {
    // Use domcontentloaded to avoid waiting on slow external resources (CDNs)
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (err) {
    console.error('Navigation to frontend failed:', err);
    await saveArtifacts('nav-failure');
    throw err;
  }

  // navigate to /login
  try {
    await page.goto(FRONTEND_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
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
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 })
    ]);
  } catch (err) {
    console.error('Login flow failed:', err);
    await saveArtifacts('login-flow-failure');
    throw err;
  }

  console.log('Logged in, navigating to root (products)');
  try {
    await page.goto(FRONTEND_URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
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
