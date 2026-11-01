import * as THREE from 'three';
import * as C from '../common.js';
import { makeExoplanet } from '../exo.js';

export function build(ctx) {
  const scene = new THREE.Scene();
  scene.add(C.makeSpaceBackdrop(ctx, 9, { tilt: 0.5 }));
  const cam = new THREE.PerspectiveCamera(42, ctx.aspect, 0.1, 3000);
  const exo = makeExoplanet(ctx, { R: 3, tilt: 0.38 }); scene.add(exo.group);
  scene.add(new THREE.AmbientLight(0x223355, 0.6));
  const star = C.makeGlow(0xcfe0ff, 90, 1.8); star.position.set(180, 40, 80); scene.add(star);
  const au = (y) => () => exo.mag.localToWorld(new THREE.Vector3(0.6, y, 0.3));
  const cues = [
    { kind: 'title', at: 0.4, dur: 3.5, pos: 'tl', kicker: 'Beta Pictoris b', text: 'WHAT IS MAKING\nTHE SIGNAL?' },
    { kind: 'title', at: 4.0, dur: 5.2, pos: 'tl', text: 'AURORAS', sub: 'Like Earth’s northern lights — on a monstrous scale' },
    { kind: 'label', at: 5.2, dur: 11, anchor: au(3.2), text: 'Aurora', sub: 'charged particles + magnetic field', color: '#6dffb4', dx: 14, dy: -10 },
    { kind: 'label', at: 9.6, dur: 8, anchor: () => exo.mag.localToWorld(new THREE.Vector3(8.2, 1.5, 0)), text: 'Magnetic field lines', color: '#57c8ff', dx: 12 },
    { kind: 'label', at: 12, dur: 8, anchor: () => exo.group.localToWorld(new THREE.Vector3(7, -5, 3)), text: 'Radio emission', sub: 'electron cyclotron maser (ECMI)', color: '#9fe8ff', dx: 12 },
    { kind: 'stat', at: 17.2, dur: 11, pos: 'cr', from: 0, to: 200, countAt: 17.4, countDur: 2.2, prefix: '≥ ', suffix: '×', hot: true, kicker: 'Magnetic field strength', label: 'stronger than Jupiter’s' },
    { kind: 'chip', at: 25.2, dur: 10, pos: 'bl', text: '> 1,000 gauss   vs   Earth ≈ 0.5 gauss' },
    { kind: 'chip', at: 28.8, dur: 9.5, pos: 'br', text: 'Spins once every 8–9 hours', tone: 'ok' },
    { kind: 'source', at: 3, dur: 36, pos: 'src', text: 'Berger et al. (Harvard) · Callingham (UvA) · Science News · ScienceAlert · CNN' },
  ];
  const cp = new THREE.Vector3(); const A = C.fitDist(1, ctx.aspect);
  return {
    scene, camera: cam, cues, bloom: { strength: 0.45, radius: 0.7, threshold: 0.85 }, exposure: 1.0,
    update(t) {
      exo.update(t, { aurora: C.smooth((t - 3) / 3) * 1.0, shellsOn: C.smooth((t - 11) / 3), fieldOn: C.smooth((t - 8) / 3) });
      const d = C.kf(t, [[0, 36], [8, 24], [17, 30], [30, 22], [40, 26]]) * A; const az = C.rad(C.kf(t, [[0, 30], [20, -20], [40, -60]])); const el = C.rad(C.kf(t, [[0, 10], [20, 18], [40, 8]]));
      cp.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(d);
      cam.position.copy(cp); cam.lookAt(0, 0, 0);
    },
  };
}
