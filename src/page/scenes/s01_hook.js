import * as THREE from 'three';
import * as C from '../common.js';

export function build(ctx) {
  const scene = new THREE.Scene();
  scene.add(C.makeSpaceBackdrop(ctx, 1, { tilt: 0.7 }));
  const cam = new THREE.PerspectiveCamera(46, ctx.aspect, 0.1, 3000);

  const comet = C.makeComet(ctx, { R: 1, tail: 1.5, seed: 11 });
  scene.add(comet.group);
  const sunGlow = C.makeGlow(0xffd9a0, 120, 1.3); sunGlow.position.set(-300, 70, -360); scene.add(sunGlow);
  const L = new THREE.DirectionalLight(0xfff0dd, 3.4); L.position.set(-1, 0.25, 0.45); scene.add(L);
  scene.add(new THREE.AmbientLight(0x1a2a50, 0.7));

  // second, far-away blue point: Beta Pictoris (foreshadowing)
  const bp = C.makeGlow(0x9fc4ff, 22, 1.0); bp.position.set(120, 40, -420); scene.add(bp);

  const cues = [
    { kind: 'title', at: 0.5, dur: 3.4, pos: 'lc', kicker: 'Deep space report', text: 'TWO COSMIC MYSTERIES', sub: 'One ancient comet. One strange radio signal.' },
    { kind: 'stat', at: 3.7, dur: 7.2, pos: 'cl', from: 0, to: 10000000000, countAt: 3.9, countDur: 2.6, kicker: '3I/ATLAS · interstellar comet', label: 'years old?', hot: true },
    { kind: 'stat', at: 11.6, dur: 6.4, pos: 'cr', from: 0, to: 63, countAt: 11.8, countDur: 2.0, kicker: 'Radio signal · Beta Pictoris b', label: 'light-years away' },
    { kind: 'title', at: 18.4, dur: 6.6, pos: 'lc', text: 'IS IT ALIENS?', sub: 'The real answer is even stranger.' },
    { kind: 'chip', at: 25, dur: 4.4, pos: 'bc', text: 'Stay for the science ↓' },
  ];

  const camPos = new THREE.Vector3(), look = new THREE.Vector3();
  return {
    scene, camera: cam, cues, bloom: { strength: 0.85, radius: 0.7, threshold: 0.8 }, exposure: 1.0,
    update(t) {
      const k = C.smooth(t / 30);
      comet.group.position.set(C.lerp(40, -6, k), C.lerp(6, -0.6, k), C.lerp(-70, -9, k));
      comet.group.rotation.set(0, C.lerp(0.25, -0.15, k), 0); comet.nucleus.rotation.set(t * 0.12, t * 0.35, t * 0.05);
      comet.set({ activity: 0.85 + 0.15 * Math.sin(t * 0.7) });
      camPos.set(Math.sin(t * 0.08) * 1.6, 0.8 + Math.sin(t * 0.05) * 0.5, C.fitDist(10, ctx.aspect) - t * 0.06);
      cam.position.copy(camPos);
      look.copy(comet.group.position).multiplyScalar(0.55); look.x += 6; look.z = Math.min(look.z, -4);
      cam.lookAt(look); cam.rotation.z += Math.sin(t * 0.09) * 0.02;
    },
  };
}
