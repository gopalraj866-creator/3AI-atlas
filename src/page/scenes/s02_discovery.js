import * as THREE from 'three';
import * as C from '../common.js';

export function build(ctx) {
  const scene = new THREE.Scene();
  scene.add(C.makeSpaceBackdrop(ctx, 2, { tilt: 1.1 }));
  const cam = new THREE.PerspectiveCamera(50, ctx.aspect, 0.1, 3000);
  const warp = C.makeWarp(ctx, { count: 1400, spread: 70, depth: 420, streak: 6, color: [0.55, 0.75, 1.2], hole: 6 });
  scene.add(warp);

  const comet = C.makeComet(ctx, { R: 1.6, tail: 1.1, seed: 21 });
  scene.add(comet.group);
  const L = new THREE.DirectionalLight(0xfff0dd, 3.4); L.position.set(-1, 0.3, 0.6); scene.add(L);
  scene.add(new THREE.AmbientLight(0x1a2a50, 0.8));

  // detection reticle (HUD ring) as a screen-space-ish ring around the comet
  const ring = C.ringLine(7, { color: 0x7fd7ff, opacity: 0.55 }); ring.rotation.x = Math.PI / 2; comet.group.add(ring);
  const ring2 = C.ringLine(9.5, { color: 0x7fd7ff, opacity: 0.25, seg: 6 }); ring2.rotation.x = Math.PI / 2; comet.group.add(ring2);

  const cues = [
    { kind: 'title', at: 0.6, dur: 6.4, pos: 'tl', kicker: 'July 2025 · Río Hurtado, Chile', text: 'A faint dot\nmoving too fast', sub: 'ATLAS survey telescope (NASA-funded)' },
    { kind: 'chip', at: 9.2, dur: 5.6, pos: 'bl', text: 'Orbit: hyperbolic (e > 1)' },
    { kind: 'chip', at: 11.4, dur: 4.4, pos: 'br', text: 'Unbound · will never return', tone: 'warn' },
    { kind: 'title', at: 17.4, dur: 3, pos: 'tc', kicker: 'Interstellar objects confirmed', text: 'ONLY THREE', fin: 0.5 },
    { kind: 'list', at: 19.0, dur: 14, pos: 'cl', head: 'The interstellar club', stagger: 2.6, items: [{ text: '1I/ʻOumuamua — 2017' }, { text: '2I/Borisov — 2019' }, { text: '3I/ATLAS — 2025' }] },
    { kind: 'stat', at: 31.0, dur: 9.5, pos: 'cr', from: 0, to: 137000, countAt: 31.4, countDur: 3.2, suffix: ' mph', kicker: 'Speed', label: '≈ 221,000 km/h', hot: true },
    { kind: 'stat', at: 41.5, dur: 8, pos: 'cr', kicker: 'Estimated nucleus', from: 0, to: 5.6, dec: 1, countAt: 41.8, countDur: 2.4, suffix: ' km', label: 'between ~0.4 and ~5.6 km wide — biggest of the three' },
    { kind: 'source', at: 2, dur: 46, pos: 'src', text: 'Source: Smithsonian · Michigan State Univ. · NASA' },
  ];

  const cp = new THREE.Vector3(), look = new THREE.Vector3();
  return {
    scene, camera: cam, cues, bloom: { strength: 0.8, radius: 0.7, threshold: 0.8 },
    update(t) {
      const speed = C.kf(t, [[0, 16], [20, 55], [31, 160], [42, 70], [50, 30]]);
      // integrate distance analytically (piecewise) – approximate with smooth function of t
      warp.userData.mat.uniforms.uDist.value = t * 30 + Math.pow(t / 50, 3) * 900;
      warp.userData.mat.uniforms.uStreak.value = 3 + speed * 0.09;
      const k = C.smooth(t / 50);
      comet.group.position.set(C.lerp(18, 5, k) , C.lerp(-1.5, 0.5, k), C.lerp(-80, -14, C.smoother(t / 40)));
      comet.group.rotation.set(0, -0.22, 0); comet.nucleus.rotation.set(t * 0.1, t * 0.3, 0);
      comet.set({ activity: 0.85 + 0.15 * Math.sin(t * 0.5) });
      ring.visible = ring2.visible = t < 17; const rs = 1 + 0.06 * Math.sin(t * 2.2); ring.scale.setScalar(rs); ring2.rotation.z = t * 0.4;
      cam.position.set(Math.sin(t * 0.12) * 2.2, 0.5 + Math.sin(t * 0.09) * 0.8, C.fitDist(14, ctx.aspect));
      look.copy(comet.group.position).multiplyScalar(0.7); look.z = Math.min(look.z * 0.6, -6); cam.lookAt(look);
    },
  };
}
