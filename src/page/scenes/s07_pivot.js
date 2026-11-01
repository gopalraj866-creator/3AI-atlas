import * as THREE from 'three';
import * as C from '../common.js';

const speedAt = (t) => C.kf(t, [[0, 6], [4, 30], [12, 300], [17, 60], [20, 4]]);
export function build(ctx) {
  const scene = new THREE.Scene();
  const bg = C.makeSpaceBackdrop(ctx, 7, { tilt: 1.3 }); scene.add(bg);
  const cam = new THREE.PerspectiveCamera(60, ctx.aspect, 0.1, 3000);
  const warp = C.makeWarp(ctx, { count: 2600, spread: 90, depth: 500, streak: 10, color: [0.6, 0.8, 1.3], hole: 4, seed: 9 }); scene.add(warp);
  const star = C.makeGlow(0xcfe0ff, 6, 2.5); star.position.set(0, 0, -300); scene.add(star);
  const halo = C.makeGlow(0x7fa8ff, 20, 0.8); halo.position.copy(star.position); scene.add(halo);
  const comet = C.makeComet(ctx, { R: 0.7, tail: 1.4, seed: 71, dustCount: 8000, ionCount: 3500 }); comet.group.position.set(4, 1.5, -22); comet.group.rotation.y = -0.3; scene.add(comet.group);
  const L = new THREE.DirectionalLight(0xfff0dd, 3); L.position.set(-1, 0.2, 0.5); scene.add(L); scene.add(new THREE.AmbientLight(0x223355, 0.7));
  const cues = [
    { kind: 'chip', at: 0.5, dur: 5, pos: 'tl', text: '3I/ATLAS — outbound · never to return', tone: 'warn' },
    { kind: 'title', at: 6.2, dur: 7, pos: 'lc', kicker: 'Meanwhile…', text: 'A DIFFERENT\nMYSTERY' },
    { kind: 'stat', at: 12.6, dur: 7, pos: 'cr', from: 0, to: 63, countAt: 12.8, countDur: 4, kicker: 'Beta Pictoris b', label: 'light-years away', hot: false },
  ];
  let dist = 0, lastT = 0;
  return {
    scene, camera: cam, cues, bloom: { strength: 1.0, radius: 0.8, threshold: 0.7 },
    update(t) {
      dist = 0; for (let s = 0; s < t; s += 0.05) dist += speedAt(s) * 0.05;
      warp.userData.mat.uniforms.uDist.value = dist; warp.userData.mat.uniforms.uStreak.value = 2 + speedAt(t) * 0.07;
      warp.userData.mat.uniforms.uFade.value = C.smooth((t - 1) / 3) * (1 - C.smooth((t - 16.5) / 3) * 0.85);
      comet.group.position.set(C.lerp(4, 40, C.smooth(t / 6)), C.lerp(1.5, 8, C.smooth(t / 6)), C.lerp(-22, -90, C.smooth(t / 6))); comet.set({ activity: 1 - C.smooth((t - 4) / 2) });
      comet.group.visible = t < 7;
      const k = C.smoother((t - 11) / 9); star.scale.setScalar(C.lerp(6, 60, k)); halo.scale.setScalar(C.lerp(20, 190, k)); star.position.z = C.lerp(-300, -80, k); halo.position.z = star.position.z;
      cam.position.set(0, 0, 0); cam.lookAt(0, 0, -1); cam.rotation.z = Math.sin(t * 0.3) * 0.03;
    },
  };
}
