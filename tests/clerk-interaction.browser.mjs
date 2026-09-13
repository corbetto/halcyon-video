// Run with: node tests/clerk-interaction.browser.mjs
// Real Chromium input against the shipped dialog; no fake DOM or request server.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';

const server = await createServer({
  configFile: false,
  server: { host: '127.0.0.1', port: 1468, strictPort: true },
  plugins: [{
    name: 'clerk-test-page',
    configureServer(server) {
      server.middlewares.use('/clerk-test', (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Clerk interaction test</title><button id="return">Return focus</button>');
      });
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await puppeteer.launch({
    headless: true, args: ['--no-sandbox'],
    env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=/dev/null' },
    defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:1468/clerk-test');
  await page.evaluate(async () => {
    const { ClerkInteraction } = await import('/src/clerk-interaction.ts');
    const movie = (id, genres = ['Drama']) => ({
      id, title: id, genres, year: 2000, duration: '', rating: '', overview: '', director: '', actors: [], localPath: '',
    });
    window.movies = [movie('First pick'), movie('Second pick'), movie('Comedy pick', ['Comedy'])];
    window.requests = 0;
    window.searches = 0;
    window.shown = null;
    window.suggestion = { movie: { ...movie('Request pick'), discovery: true }, reason: 'A drama to consider.' };
    window.chat = new ClerkInteraction({
      isAvailable: () => true, getMovies: () => window.movies,
      onShowMovie: m => { window.shown = m.id; return true; },
      onSearch: () => window.searches++,
      onRequest: () => { window.requests++; return new Promise(resolve => { window.resolveRequest = resolve; }); },
    });
    document.querySelector('#return').focus();
    window.chat.openAtCounter();
    window.leaked = 0;
    window.addEventListener('keydown', () => window.leaked++);
  });
  const click = async (label) => {
    const found = await page.evaluate(label => {
      const el = [...document.querySelectorAll('.clerk-option')].find(b => b.textContent.includes(label));
      if (!el) return false;
      el.click(); return true;
    }, label);
    assert.ok(found, 'Missing option: ' + label);
  };
  const speech = () => page.$eval('.clerk-speech', el => el.textContent);
  await page.keyboard.press('2');
  assert.match(await speech(), /First pick/);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('c');
  assert.equal(await page.evaluate(() => window.leaked), 0, 'modal leaked store keys');
  await click('Something else?');
  assert.match(await speech(), /Second pick/);
  await click('Something else?');
  assert.match(await speech(), /Comedy pick/);
  await click('Something else?');
  assert.match(await speech(), /been through this selection/);
  await click('Try a different genre');
  await click('Comedy');
  assert.match(await speech(), /Comedy pick/);
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.shown), 'Comedy pick');
  assert.equal(await page.evaluate(() => window.chat.isChatting()), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'return');

  await page.evaluate(() => window.chat.openAtCounter());
  await click('Just browsing');
  assert.equal(await page.evaluate(() => window.chat.isChatting()), false);
  await page.evaluate(() => { window.chat.setNear(true); });
  await page.tap('.clerk-prompt');
  assert.equal(await page.evaluate(() => window.chat.isChatting()), true, 'touch cannot open chat');
  await click('Looking for something specific');
  assert.equal(await page.evaluate(() => window.searches), 1);

  // Repeated confirmation cannot create duplicate orders. A completion after
  // close/reopen must be remembered without replacing the newer conversation.
  await page.evaluate(() => window.chat.openForClasp([], 'Drama', [window.suggestion]));
  await click('Request this title');
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.requests), 1);
  await page.evaluate(() => window.chat.openAtCounter());
  const greeting = await speech();
  await page.evaluate(() => window.resolveRequest(true));
  assert.equal(await speech(), greeting);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.chat.openForClasp([], 'Drama', [{ ...window.suggestion, requested: false }]));
  assert.match(await speech(), /already|request is already/i);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.clerk-option')].some(b => b.textContent.includes('Request this title'))), false);

  // Failure retains a real retry and a second attempt is a new single request.
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    window.failed = { ...window.suggestion, movie: { ...window.suggestion.movie, id: 'retry', title: 'Retry pick' }, requested: false };
    window.chat.openForClasp([], 'Drama', [window.failed]);
  });
  await click('Request this title');
  await page.evaluate(() => window.resolveRequest(false));
  assert.match(await speech(), /couldn't confirm/);
  await click('Try the request again');
  assert.equal(await page.evaluate(() => window.requests), 3);
  await page.evaluate(() => window.resolveRequest(true));
  assert.match(await speech(), /request for "Retry pick" is in/i);

  // All options stay reachable at phone widths, including short landscape.
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewport({ ...size, isMobile: true, hasTouch: true });
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      window.movies = Array.from({ length: 12 }, (_, i) => ({
        ...window.movies[0], id: String(i), genres: ['Genre ' + i],
      }));
      window.chat.openAtCounter();
    });
    await click('Help me choose a genre');
    for (let i = 0; i < 9; i++) await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.querySelector('.clerk-dialog').getAnimations().length === 0);
    const geometry = await page.evaluate(() => {
      const dialog = document.querySelector('.clerk-dialog');
      const rect = dialog.getBoundingClientRect();
      const focused = document.activeElement.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        focusedTop: focused.top, focusedBottom: focused.bottom,
        width: innerWidth, height: innerHeight,
        font: parseFloat(getComputedStyle(document.activeElement).fontSize),
        touch: [...document.querySelectorAll('.clerk-option')].every(el => el.getBoundingClientRect().height >= 44) };
    });
    assert.ok(geometry.left >= 0 && geometry.right <= geometry.width && geometry.top >= 0 && geometry.bottom <= geometry.height, JSON.stringify(geometry));
    assert.ok(geometry.focusedTop >= geometry.top && geometry.focusedBottom <= geometry.bottom, JSON.stringify(geometry));
    assert.ok(geometry.font >= 15 && geometry.touch, JSON.stringify(geometry));
  }
  assert.deepEqual(errors, []);
  console.log('PASS: recommendations, genre choices, exhaustion, title inspection, touch, keyboard isolation, focus, request deduplication, stale responses, retry, and phone containment');
} finally {
  await browser?.close();
  await server.close();
}
