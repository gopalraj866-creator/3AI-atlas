import * as THREE from 'three';
import * as C from '../common.js';
import { makeExoplanet } from '../exo.js';

export function build(ctx) {
  const scene = new THREE.Scene();
  scene.add(C.makeSpaceBackdrop(ctx, 10, { tilt: 1.0 }));
  const cam = new THREE.PerspectiveCamera(42, ctx.aspect, 0.1, 3000);
  const exo = makeExoplanet(ctx, { R: 3.4, tilt: 0.3 }); exo.group.position.set(ctx.aspect < 1 ? 0 : 6, ctx.aspect < 1 ? 6 : 0, 0); scene.add(exo.group);
  scene.add(new THREE.AmbientLight(0x223355, 0.6));
  const star = C.makeGlow(0xcfe0ff, 90, 1.8); star.position.set(180, 40, 80); scene.add(star);
  const cues = [
    { kind: 'chip', at: 0.5, dur: 6, pos: 'tl', text: 'Radio signal ≠ alien message', tone: 'warn' },
    { kind: 'title', at: 6.8, dur: 6.5, pos: 'tl', kicker: 'Edo Berger · Harvard', text: 'NOT INTELLIGENT\nLIFE', sub: 'Evidence of a colossal magnetic field' },
    { kind: 'list', at: 8.2, dur: 13.2, pos: ctx.aspect < 1 ? 'bc' : 'cl', head: 'Why it’s natural', stagger: 1.7, items: [{ text: 'Repeating bursts traced to the planet' }, { text: 'Frequencies need an extreme magnetic field' }, { text: 'Same physics as Jupiter’s auroras' }] },
    { kind: 'stat', at: 14.5, dur: 6.5, pos: 'tr', from: 0, to: 200, countAt: 14.7, countDur: 1.8, prefix: '≥ ', suffix: '×', hot: true, label: 'Jupiter’s magnetic field' },
    { kind: 'chip', at: 21.8, dur: 8, pos: 'bl', text: '1977 · “Wow!” signal · Big Ear · ~72 s · never repeated' },
    { kind: 'chip', at: 24.6, dur: 5.3, pos: 'br', text: '2015 · RATAN-600 · star 94 ly away · likely interference', tone: 'warn' },
    { kind: 'source', at: 3, dur: 26, pos: 'src', text: 'CNN · Science News · Smithsonian · Dartmouth · ABC7' },
  ];
  const cp = new THREE.Vector3(); const A = C.fitDist(1, ctx.aspect);
  return {
    scene, camera: cam, cues, bloom: { strength: 0.45, radius: 0.7, threshold: 0.85 },
    update(t) {
      exo.update(t, { aurora: 1.0, shellsOn: 0.7, fieldOn: 0.8 });
      const az = C.rad(-40 + t * 3.5); const d = C.kf(t, [[0, 30], [30, 22]]) * A;
      cp.set(Math.sin(az) * 0.95, 0.22, Math.cos(az) * 0.95).multiplyScalar(d).add(exo.group.position);
      cam.position.copy(cp); cam.lookAt(exo.group.position.x * (ctx.aspect < 1 ? 0 : 0.6), exo.group.position.y * 0.6, 0);
    },
  };
}
