// Render still frames of a scene for design review:  node render/still.mjs --scene s01_hook --times 3,10 --w 1280 --h 720 --out /tmp/x
import fs from 'node:fs';
import path from 'node:path';
import { openPage } from './lib.mjs';

const a = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith('--') ? [...acc, [v.slice(2), arr[i + 1]]] : acc), []));
const w = +(a.w || 1280), h = +(a.h || 720);
const times = (a.times || '5').split(',').map(Number);
const out = a.out || '.';
fs.mkdirSync(out, { recursive: true });
const { page, close } = await openPage(w, h);
await page.evaluate((o) => window.__init(o), { scene: a.scene, t0: 0, t1: 9999, fadeIn: false, fadeOut: false, captions: a.cap ? [{ start: 0, end: 9999, text: a.cap }] : [] });
for (const t of times) {
  const t0 = Date.now();
  await page.evaluate((t) => window.__frame(t, t), t);
  const buf = await page.screenshot({ type: 'jpeg', quality: 90 });
  const f = path.join(out, `${a.scene}_${String(t).replace('.', '_')}.jpg`);
  fs.writeFileSync(f, buf); console.log(f, Date.now() - t0, 'ms');
}
await close();
