// Render one segment (a scene or a chunk of one) to an H.264 mp4 by stepping the Three.js page frame by frame.
//   node render/render-segment.mjs --seg '<json>' --out out [--cues build/audio/cues.long.json] [--captions 1]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { openPage } from './lib.mjs';

const a = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith('--') ? [...acc, [v.slice(2), arr[i + 1]]] : acc), []));
const seg = JSON.parse(a.seg || process.env.SEG);
const outDir = a.out || 'out'; fs.mkdirSync(outDir, { recursive: true });
const final = path.join(outDir, `${seg.name}.mp4`), tmp = path.join(outDir, `${seg.name}.partial.mp4`);
const burn = (a.captions ?? (seg.format === 'short' ? '1' : '0')) === '1';
let cues = [];
if (burn && a.cues && fs.existsSync(a.cues)) {
  const dur = seg.frames / seg.fps;
  cues = JSON.parse(fs.readFileSync(a.cues, 'utf8')).filter((c) => c.end > seg.outStart - 0.2 && c.start < seg.outStart + dur + 0.2);
}
const crf = a.crf || (seg.w >= 3000 ? '17' : '16');
console.log(`[segment ${seg.name}] scene=${seg.scene} ${seg.w}x${seg.h}@${seg.fps} frames=${seg.frames} t=${seg.t0}..${seg.t1} captions=${burn ? cues.length : 'off'}`);

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(seg.fps), '-c:v', 'mjpeg', '-i', '-',
  '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p', '-c:v', 'libx264', '-preset', a.preset || 'veryfast', '-crf', crf, '-profile:v', 'high',
  '-r', String(seg.fps), '-g', String(seg.fps * 2), '-bf', '2', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-movflags', '+faststart', '-an', '-f', 'mp4', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
const ffDone = new Promise((res, rej) => { ff.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))); ff.on('error', rej); });

const { page, close } = await openPage(seg.w, seg.h);
try {
  await page.evaluate((o) => window.__init(o), { scene: seg.scene, t0: seg.t0, t1: seg.t1, fadeIn: seg.fadeIn, fadeOut: seg.fadeOut, captions: cues });
  const t0 = Date.now();
  for (let i = 0; i < seg.frames; i++) {
    const t = seg.t0 + i / seg.fps, g = seg.outStart + i / seg.fps;
    await page.evaluate((t, g) => window.__frame(t, g), t, g);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92, optimizeForSpeed: true });
    if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
    if (i % 60 === 0 || i === seg.frames - 1) { const el = (Date.now() - t0) / 1000; console.log(`  frame ${i + 1}/${seg.frames}  ${(el / (i + 1)).toFixed(2)} s/frame  eta ${(el / (i + 1) * (seg.frames - i - 1) / 60).toFixed(1)} min`); }
  }
  ff.stdin.end(); await ffDone; fs.renameSync(tmp, final);
  console.log(`[segment ${seg.name}] done -> ${final} (${(fs.statSync(final).size / 1e6).toFixed(1)} MB)`);
} catch (e) { console.error(e); try { ff.kill(); } catch {} process.exitCode = 1; } finally { await close(); }
