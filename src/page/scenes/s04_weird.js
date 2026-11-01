import * as THREE from 'three';
import * as C from '../common.js';

export function build(ctx) {
  const scene = new THREE.Scene();
  scene.add(C.makeSpaceBackdrop(ctx, 4, { tilt: 0.4 }));
  const cam = new THREE.PerspectiveCamera(45, ctx.aspect, 0.1, 3000);
  const R = 2;
  const comet = C.makeComet(ctx, { R, tail: 0.9, seed: 41 });
  scene.add(comet.group);
  const L = new THREE.DirectionalLight(0xfff0dd, 3.2); L.position.set(-1, 0.25, 0.5); scene.add(L);
  scene.add(new THREE.AmbientLight(0x1a2a50, 0.8));
  scene.add(C.makeGlow(0xffdfae, 150, 1.0)); scene.children[scene.children.length - 1].position.set(-320, 40, -80);

  const dirs = [[-1, 0.35, 0.2], [-0.8, -0.4, 0.5], [0.2, 1, 0.1], [0.3, -1, 0.2], [-0.3, 0.2, 1], [0.6, 0.3, -1], [-1, -0.1, -0.5]];
  const jets = dirs.map((d, i) => comet.addJet(d, { len: 12, count: 4200, spread: 0.14, size: 5.2, color: [1.8, 1.9, 2.6], seed: 50 + i }));
  const tOn = (i) => 8.5 + i * 1.6;

  // halo: billboard ring + soft glow
  const halo = new THREE.Mesh(new THREE.RingGeometry(25.4, 26, 160), new THREE.MeshBasicMaterial({ color: 0x7fd7ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(halo);
  const haloGlow = C.makeGlow(0x6fb0ff, 52, 0.0); scene.add(haloGlow);

  const tip = (i) => { const v = new THREE.Vector3(...dirs[i]).normalize().multiplyScalar(R * 9); return () => comet.group.localToWorld(v.clone()); };
  const cues = [
    { kind: 'title', at: 0.5, dur: 6.2, pos: 'tl', kicker: 'After perihelion · Nov 2025', text: 'THEN IT GOT\nWEIRD' },
    { kind: 'chip', at: 3.6, dur: 9.5, pos: 'bl', text: 'Brightened sharply  ↑   ·   turned bluer', tone: 'warn' },
    ...jets.map((_, i) => ({ kind: 'label', at: tOn(i) + 0.5, dur: 14.8, anchor: tip(i), text: `Jet ${i + 1}`, sub: [0, 6].includes(i) ? 'sunward · anti-tail' : '', color: [0, 6].includes(i) ? '#ffb36b' : '#9fe8ff', dx: 10, dy: -8 })),
    { kind: 'stat', at: 16.6, dur: 12.6, pos: 'cr', from: 0, to: 7, countAt: 16.8, countDur: 1.2, suffix: '+', kicker: 'Seen Nov 8–9, 2025', label: 'distinct jets of gas and dust, in many directions' },
    { kind: 'chip', at: 20.5, dur: 7.2, pos: 'bl', text: 'Small push beyond gravity · common for outgassing', tone: 'warn' },
    { kind: 'title', at: 28.4, dur: 6.2, pos: 'tl', kicker: 'A theory makes headlines', text: 'Artificial\nthrusters?', sub: 'Avi Loeb (Harvard): a hypothesis — not a finding' },
    { kind: 'label', at: 31.5, dur: 12.5, anchor: () => { const r = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion); return halo.position.clone().addScaledVector(r, 26); }, text: 'Halo ≈ 500,000 km wide', color: '#7fd7ff', dx: 10, dy: 0 },
    { kind: 'list', at: 35.2, dur: 11.2, pos: 'cr', head: 'What NASA says', stagger: 2.5, items: [{ text: 'No unexplained slowdown' }, { text: 'No change of orbit' }, { text: 'Right where gravity predicts' }] },
    { kind: 'title', at: 46.8, dur: 8.5, pos: 'lc', text: 'WEIRD COMET.\nNOT A SPACESHIP.', fin: 0.7 },
    { kind: 'source', at: 3, dur: 52, pos: 'src', text: 'Imaging: ICQ Comet Observations, British Astronomical Assoc. · Reports: Sci.News, Live Science, NASA' },
  ];

  const cp = new THREE.Vector3();
  return {
    scene, camera: cam, cues, bloom: { strength: 0.9, radius: 0.7, threshold: 0.78 }, exposure: 1.0,
    update(t) {
      const blue = C.smooth((t - 3.5) / 10);
      comet.set({ activity: C.kf(t, [[0, 0.5], [12, 1.0]]), blue, coma: 0.5 });
      comet.nucleus.rotation.set(0.2, t * 0.12, 0.1);
      jets.forEach((j, i) => { j.points.userData.mat.uniforms.uActive.value = C.smooth((t - tOn(i)) / 0.9) * (0.8 + 0.2 * Math.sin(t * 2 + i)); });
      const dist = C.fitDist(C.kf(t, [[0, 46], [8, 36], [16, 30], [28, 32], [33, 80], [44, 82], [50, 34], [60, 30]]), ctx.aspect);
      const az = C.rad(C.kf(t, [[0, 25], [30, -35], [60, 10]])); const el = C.rad(C.kf(t, [[0, 12], [30, 22], [60, 8]]));
      cp.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist);
      cam.position.copy(cp); cam.lookAt(0, 0, 0);
      halo.quaternion.copy(cam.quaternion);
      const h = C.smooth((t - 31) / 2) * C.smooth((45 - t) / 2); halo.material.opacity = 0.55 * h; haloGlow.material.color.setRGB(0.15, 0.3, 0.6).multiplyScalar(h * 0.8);
    },
  };
}
