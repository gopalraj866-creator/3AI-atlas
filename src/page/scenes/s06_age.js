import * as THREE from 'three';
import * as C from '../common.js';

const X = (gyr) => gyr * 10; // x position for Gyr after the Big Bang
const V0 = (x) => new THREE.Vector3(x, 0, 0);
export function build(ctx) {
  const scene = new THREE.Scene();
  scene.add(C.makeSpaceBackdrop(ctx, 6, { tilt: 0.6 }));
  const cam = new THREE.PerspectiveCamera(46, ctx.aspect, 0.1, 3000);
  scene.add(new THREE.AmbientLight(0x445577, 1.0)); const dl = new THREE.DirectionalLight(0xffffff, 2); dl.position.set(1, 1, 1); scene.add(dl);

  // timeline axis + ticks
  const axis = C.lineFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(X(13.8), 0, 0)], { color: 0x7fd7ff, opacity: 0.8 }); scene.add(axis);
  const tk = []; for (let g = 0; g <= 13; g++) tk.push(new THREE.Vector3(X(g), 0, 0), new THREE.Vector3(X(g), g % 5 === 0 ? 1.6 : 0.8, 0));
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tk), new THREE.LineBasicMaterial({ color: 0x7fd7ff, transparent: true, opacity: 0.6 })));

  // Big Bang flash
  const bb = C.makeGlow(0xffffff, 18, 2.2); scene.add(bb); const bb2 = C.makeGlow(0x8fc0ff, 50, 0.7); scene.add(bb2);
  // cosmic noon band + young galaxies
  const band = C.makeGlow(0xff9a3c, 1, 0); band.scale.set(X(2.0) * 1.35, 9, 1); band.position.set((X(1.8) + X(3.8)) / 2, 1.5, 0); scene.add(band);
  const bandLine = C.lineFromPoints([V0(X(1.8)), V0(X(3.8))], { color: 0xffb36b, opacity: 1 }); bandLine.position.y = 1.8; scene.add(bandLine);
  const young = C.makeGalaxy(ctx, { R: 9, count: 14000, arms: 3, twist: 3, seed: 61, thick: 0.18, size: 2.2, warmCore: 0.2, clumpy: 1.2 }); young.position.set(X(2.8), 8, -6); young.rotation.x = 0.9; scene.add(young);
  const young2 = C.makeGalaxy(ctx, { R: 6, count: 8000, arms: 2, twist: 3, seed: 62, thick: 0.2, size: 2.0, warmCore: 0.3, clumpy: 0.8 }); young2.position.set(X(2.2), -7, 6); young2.rotation.set(0.5, 0, 0.6); scene.add(young2);
  // our galaxy + Sun
  const mw = C.makeGalaxy(ctx, { R: 16, count: 30000, seed: 63 }); mw.position.set(X(9.2), 9, -4); mw.rotation.x = 0.8; scene.add(mw);
  const sunMark = C.makeGlow(0xffd08a, 7, 1.6); sunMark.position.set(X(9.2), 0, 0); scene.add(sunMark);
  const earth = C.makeEarth(ctx, { R: 2.6, sunDir: new THREE.Vector3(-1, 0.3, 0.6) }); earth.position.set(X(13.8), 0, 0); scene.add(earth);

  // comet path
  const path = (u) => new THREE.Vector3(C.lerp(X(2.8), X(13.5), u), 5.5 * Math.sin(u * Math.PI) * (1 - u) + 1.2, Math.sin(u * 8) * 2.2);
  const pp = []; for (let i = 0; i <= 160; i++) pp.push(path(i / 160));
  scene.add(C.lineFromPoints(pp, { color: 0xffb36b, opacity: 0.25 }));
  const trailGeo = new THREE.BufferGeometry(); const tp = new Float32Array(161 * 3); trailGeo.setAttribute('position', new THREE.BufferAttribute(tp, 3)); trailGeo.setDrawRange(0, 0);
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending })); trail.frustumCulled = false; scene.add(trail);
  const comet = C.makeComet(ctx, { R: 0.6, tail: 0.7, seed: 66, dustCount: 6000, ionCount: 3000 }); const cometRoot = new THREE.Group(); comet.group.rotation.y = Math.PI; cometRoot.add(comet.group); scene.add(cometRoot);
  comet.set({ activity: 1 });

  const V = (g, y = 0, z = 0) => new THREE.Vector3(X(g), y, z);
  const cues = [
    { kind: 'title', at: 0.5, dur: 4, pos: 'tl', kicker: 'Putting the clues together', text: 'HOW OLD?' },
    { kind: 'label', at: 2.5, dur: 6, anchor: () => V(0, 3), text: 'Big Bang', sub: '13.8 billion years ago', color: '#ffffff', dx: 12 },
    { kind: 'title', at: 6.2, dur: 18.5, pos: 'tl', kicker: '3I/ATLAS formed', text: '10–12 BILLION\nYEARS AGO', sub: 'During “cosmic noon” — star formation at its peak' },
    { kind: 'label', at: 6.5, dur: 18, anchor: () => V(2.8, 13), text: 'Cosmic noon', sub: '~2–4 billion years after the Big Bang', color: '#ffb36b', dx: 10 },
    { kind: 'label', at: 17.2, dur: 11, anchor: () => V(9.2, 2), text: 'Sun & planets form', sub: '≈ 4.6 billion years ago', color: '#ffd08a', dx: 10 },
    { kind: 'stat', at: 17.4, dur: 12, pos: 'cr', from: 0, to: 4.6, dec: 1, countAt: 17.6, countDur: 2, suffix: ' bn yrs', kicker: 'Our solar system', label: 'The comet may be more than 2× older' },
    { kind: 'chip', at: 26.2, dur: 8, pos: 'bl', text: 'Universe: 13.8 billion years old' },
    { kind: 'label', at: 35, dur: 6, anchor: () => V(9.2, 11), text: 'Born before its own star?', sub: 'suggested by an April 2026 study', color: '#9fe8ff', dx: 10 },
    { kind: 'label', at: 50.5, dur: 8, anchor: () => V(13.8, 4), text: 'Today', color: '#6fb0ff', dx: 10 },
    { kind: 'chip', at: 42, dur: 9, pos: 'bc', text: 'Older than anything formed in our solar system', tone: 'ok' },
    { kind: 'source', at: 3, dur: 54, pos: 'src', text: 'Cordiner et al., Nature (June 22, 2026) · Smithsonian · EarthSky · ESA/Webb' },
  ];

  const cp = new THREE.Vector3(), tg = new THREE.Vector3(); const A = C.fitDist(1, ctx.aspect);
  const key = [[0, [0, 0, 0], [-7, 3, 15 * A]], [4, [0, 0, 0], [8, 5, 20 * A]], [6, [18, 4, 0], [20, 8, 30 * A]], [16, [28, 6, 0], [33, 10, 34 * A]], [24, [60, 2, 0], [70, 22, 92 * A]], [34, [75, 4, 0], [76, 20, 100 * A]],
    [40, [92, 4, 0], [94, 9, 36 * A]], [50, [124, 2, 0], [122, 6, 40 * A]], [60, [138, 0, 0], [140, 4, 20 * A]]];
  return {
    scene, camera: cam, cues, bloom: { strength: 0.85, radius: 0.7, threshold: 0.75 }, exposure: 1.0,
    update(t) {
      const u = C.smooth((t - 6) / 46); const p = path(u); cometRoot.position.copy(p);
      const n = Math.floor(u * 160); for (let i = 0; i <= n; i++) { const q = path(i / 160); tp[i * 3] = q.x; tp[i * 3 + 1] = q.y; tp[i * 3 + 2] = q.z; } trailGeo.setDrawRange(0, n + 1); trailGeo.attributes.position.needsUpdate = true;
      comet.nucleus.rotation.y = t; earth.rotation.y = t * 0.1; young.rotation.y = t * 0.05; mw.rotation.y = t * 0.03;
      band.material.color.setRGB(1, 0.6, 0.24).multiplyScalar(0.55 * C.smooth((t - 6) / 2) * C.smooth((30 - t) / 3)); bandLine.visible = t > 6 && t < 31;
      bb.material.color.setRGB(1, 1, 1).multiplyScalar(2.2 * (0.6 + 0.4 * Math.sin(t * 1.3)));
      let i = 1; while (i < key.length - 1 && t > key[i][0]) i++; const a = key[i - 1], b = key[i]; const k = C.smoother((t - a[0]) / (b[0] - a[0]));
      tg.set(...a[1]).lerp(new THREE.Vector3(...b[1]), k); cp.set(...a[2]).lerp(new THREE.Vector3(...b[2]), k); cam.position.copy(cp); cam.lookAt(tg);
    },
  };
}
