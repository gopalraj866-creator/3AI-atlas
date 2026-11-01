// Builds the render matrix.  node render/plan.mjs --format long|short|both --quality 1080p|4k|both [--fps 30] [--chunk 30]
// Prints JSON {include:[segments], groups:[{group,format,quality,w,h}]} and (in CI) writes matrix outputs to $GITHUB_OUTPUT.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';

export const QUALITY = { '1080p': [1920, 1080], '4k': [3840, 2160], shorts: [1080, 1920] };

export function plan({ format = 'both', quality = 'both', fps = 30, chunk = 0, preview = false } = {}) {
  const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/script.json'), 'utf8'));
  const include = [], groups = [];
  const wantLong = format === 'long' || format === 'both', wantShort = format === 'short' || format === 'both';
  const jobs = [];
  if (wantLong) for (const q of quality === 'both' ? ['1080p', '4k'] : [quality]) if (QUALITY[q] && q !== 'shorts') jobs.push({ fmt: 'long', q });
  if (wantShort) jobs.push({ fmt: 'short', q: 'shorts' });
  for (const { fmt, q } of jobs) {
    let [w, h] = QUALITY[q]; if (preview) { [w, h] = h > w ? [540, 960] : [960, 540]; }
    const chunkS = chunk || (q === '4k' ? 8 : 20); const group = `${fmt}-${q}`; groups.push({ group, format: fmt, quality: q, w, h });
    let idx = 0, outStart = 0;
    for (const b of script.formats[fmt].blocks) {
      const frames = Math.round((b.t1 - b.t0) * fps), n = Math.max(1, Math.ceil(frames / (chunkS * fps)));
      let f0 = 0;
      for (let c = 0; c < n; c++) {
        const f1 = Math.round(frames * (c + 1) / n), len = f1 - f0;
        include.push({ group, format: fmt, quality: q, idx: idx++, id: `${b.id}${n > 1 ? '_' + (c + 1) : ''}`, scene: b.scene, w, h, fps, frames: len,
          t0: +(b.t0 + f0 / fps).toFixed(5), t1: +(b.t0 + f1 / fps).toFixed(5), outStart: +(outStart + f0 / fps).toFixed(5),
          fadeIn: c === 0, fadeOut: c === n - 1, name: `${group}__${String(idx - 1).padStart(3, '0')}` });
        f0 = f1;
      }
      outStart += frames / fps;
    }
  }
  return { include, groups };
}

if (process.argv[1] && process.argv[1].endsWith('plan.mjs')) {
  const a = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith('--') ? [...acc, [v.slice(2), arr[i + 1]]] : acc), []));
  const p = plan({ format: a.format || 'both', quality: a.quality || 'both', fps: +(a.fps || 30), chunk: +(a.chunk || 0), preview: a.preview === 'true' });
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify({ include: p.include })}\ngroups=${JSON.stringify({ include: p.groups })}\n`);
  }
  console.log(JSON.stringify({ segments: p.include.length, groups: p.groups, total_frames: p.include.reduce((s, x) => s + x.frames, 0) }, null, 1));
  if (a.dump) fs.writeFileSync(a.dump, JSON.stringify(p, null, 1));
}
