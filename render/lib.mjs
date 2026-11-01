// Shared helpers: static file server + headless Chrome (software WebGL) page opener.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

export function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(ROOT, u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

export function chromePath() {
  const c = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  for (const p of c) if (fs.existsSync(p)) return p;
  throw new Error('Chrome not found. Set CHROME_PATH.');
}

export async function openPage(w, h) {
  const { srv, port } = await startServer();
  const browser = await puppeteer.launch({
    executablePath: chromePath(), headless: true, protocolTimeout: 600000,
    defaultViewport: { width: w, height: h, deviceScaleFactor: 1 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      '--enable-webgl', '--hide-scrollbars', '--force-color-profile=srgb', '--disable-dev-shm-usage', '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding', '--mute-audio', `--window-size=${w},${h}`],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') console.error(`[console.${t}]`, m.text()); });
  await page.goto(`http://127.0.0.1:${port}/src/page/index.html?w=${w}&h=${h}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  return { page, browser, srv, close: async () => { await browser.close(); srv.close(); } };
}
