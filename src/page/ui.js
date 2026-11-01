// Declarative HUD / overlay system. Everything is a pure function of time t, so frames are deterministic.
import * as THREE from 'three';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const fmtNum = (v, c) => {
  const dec = c.dec || 0;
  const s = Number(v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (c.prefix || '') + s + (c.suffix || '');
};

export class UI {
  constructor(root, W, H) {
    this.root = root; this.W = W; this.H = H; this.items = []; this._v = new THREE.Vector3();
  }
  clear() { this.root.innerHTML = ''; this.items = []; }

  // cue = {kind:'title'|'stat'|'chip'|'label'|'list'|'source', at, dur, pos, ...}
  setCues(cues) {
    this.clear();
    for (const c of cues) {
      const el = document.createElement('div');
      el.className = 'cue ' + ({ title: 'title', stat: 'stat', chip: 'chip' + (c.tone ? ' ' + c.tone : ''), label: 'lbl', list: 'list', source: 'source' }[c.kind] || '');
      if (c.pos) el.dataset.pos = c.pos;
      if (c.color) el.style.setProperty('--c', c.color);
      if (c.width) el.style.width = c.width;
      let html = '';
      if (c.kind === 'title') {
        if (c.kicker) html += `<div class="kicker">${c.kicker}</div>`;
        html += `<div class="h">${c.text || ''}</div>`;
        if (c.sub) html += `<div class="sub">${c.sub}</div>`;
      } else if (c.kind === 'stat') {
        if (c.kicker) html += `<div class="kicker">${c.kicker}</div>`;
        html += `<div class="num ${c.hot ? 'hot' : ''}"></div>`;
        if (c.label) html += `<div class="label">${c.label}</div>`;
      } else if (c.kind === 'list') {
        if (c.head) html += `<div class="hd">${c.head}</div>`;
        for (const it of c.items) html += `<div class="it ${it.bad ? 'bad' : ''}"><b>${it.bad ? '✕' : '✓'}</b><span>${it.text}</span></div>`;
      } else if (c.kind === 'label') {
        html = `${c.text}${c.sub ? `<small>${c.sub}</small>` : ''}`;
      } else {
        html = c.text || '';
      }
      el.innerHTML = html;
      this.root.appendChild(el);
      this.items.push({ c, el, num: el.querySelector('.num'), its: [...el.querySelectorAll('.it')], textFn: typeof c.text === 'function' });
    }
  }

  update(t, camera) {
    const { W, H } = this;
    for (const it of this.items) {
      const c = it.c, el = it.el;
      const fin = c.fin ?? 0.55, fout = c.fout ?? 0.55;
      const dur = c.dur ?? 4;
      const a = ease((t - c.at) / fin) * ease((c.at + dur - t) / fout);
      if (a <= 0.001) { el.style.opacity = 0; continue; }
      el.style.opacity = a * (c.kind === 'source' ? 0.7 : 1);
      if (c.kind === 'label') {
        let p = c.anchor;
        if (typeof p === 'function') p = p(t);
        if (p && p.isObject3D) { p.getWorldPosition(this._v); } else if (p) { this._v.copy(p); }
        this._v.project(camera);
        const vis = this._v.z < 1 && this._v.z > -1;
        el.style.opacity = vis ? a : 0;
        const x = (this._v.x * 0.5 + 0.5) * W + (c.dx || 0) * (H / 1080);
        const y = (-this._v.y * 0.5 + 0.5) * H + (c.dy || 0) * (H / 1080);
        el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      } else {
        el.style.translate = `0 ${((1 - a) * 1.1).toFixed(3)}rem`;
      }
      if (it.num) {
        const k = ease((t - (c.countAt ?? c.at)) / (c.countDur ?? 2.5));
        const v = (c.from ?? 0) + ((c.to ?? 0) - (c.from ?? 0)) * k;
        it.num.textContent = fmtNum(v, c);
      }
      if (it.textFn) el.textContent = c.text(t);
      if (it.its.length) {
        const gap = c.stagger ?? 1.1;
        it.its.forEach((n, i) => {
          const k = ease((t - (c.at + 0.4 + i * gap)) / 0.5);
          n.style.opacity = k; n.style.translate = `${((1 - k) * -1.2).toFixed(2)}rem 0`;
        });
      }
    }
  }
}

export class Captions {
  constructor(el) { this.el = el.querySelector('.cap'); this.cues = []; }
  set(cues) { this.cues = cues || []; }
  update(g) {
    const c = this.cues.find((q) => g >= q.start - 0.05 && g < q.end + 0.1);
    if (!c) { this.el.style.opacity = 0; return; }
    if (this.el.dataset.k !== String(c.start)) { this.el.textContent = c.text.replace(/\n/g, ' '); this.el.dataset.k = String(c.start); }
    const a = ease((g - c.start + 0.05) / 0.12) * ease((c.end + 0.1 - g) / 0.12);
    this.el.style.opacity = a;
  }
}
