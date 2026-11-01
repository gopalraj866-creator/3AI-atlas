import * as THREE from 'three';
import * as C from '../common.js';

const C_GOLD = 0xd9a62e;

function hexMirrors() {
  const g = new THREE.Group(); const s = 0.62;
  const geo = new THREE.CylinderGeometry(s * 0.97, s * 0.97, 0.12, 6); geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: C_GOLD, metalness: 1, roughness: 0.2 });
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) {
    const d = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)); if (d < 1 || d > 2) continue;
    const m = new THREE.Mesh(geo, mat); m.position.set(s * Math.sqrt(3) * (q + r / 2) * 1.0, s * 1.5 * r, 0); g.add(m);
  }
  // back plate + struts + secondary
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0x2a2d36, metalness: 0.6, roughness: 0.5 })); plate.rotation.x = Math.PI / 2; plate.position.z = -0.14; g.add(plate);
  const sm = new THREE.MeshStandardMaterial({ color: 0x555a66, metalness: 0.8, roughness: 0.4 });
  const tip = new THREE.Vector3(0, 0, 6.2);
  for (const a of [Math.PI / 2, Math.PI / 2 + 2.094, Math.PI / 2 + 4.188]) {
    const base = new THREE.Vector3(Math.cos(a) * 3.2, Math.sin(a) * 3.2, 0); const dir = tip.clone().sub(base); const len = dir.length();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 8), sm); c.position.copy(base).addScaledVector(dir, 0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); g.add(c);
  }
  const sec = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), new THREE.MeshStandardMaterial({ color: C_GOLD, metalness: 1, roughness: 0.25 })); sec.position.copy(tip); g.add(sec);
  // sunshield: 5 stacked kites behind the mirror
  for (let i = 0; i < 5; i++) {
    const sh = new THREE.Shape(); sh.moveTo(-7.2, 0); sh.lineTo(0, 4.4); sh.lineTo(7.2, 0); sh.lineTo(0, -4.4); sh.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xb8b4d8 : 0xe0ddf2, metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
    m.position.set(0, -0.3, -2.2 - i * 0.28); m.scale.setScalar(1 - i * 0.025); g.add(m);
  }
  return g;
}

function molecule(withD) {
  const g = new THREE.Group();
  const mO = new THREE.MeshStandardMaterial({ color: 0xff4d4d, roughness: 0.35, metalness: 0.1, emissive: 0x551111, emissiveIntensity: 0.6 });
  const mH = new THREE.MeshStandardMaterial({ color: 0xf2f6ff, roughness: 0.35, emissive: 0x334455, emissiveIntensity: 0.5 });
  const mD = new THREE.MeshStandardMaterial({ color: 0x41d9ff, roughness: 0.3, emissive: 0x0a5a70, emissiveIntensity: 0.9 });
  const O = new THREE.Mesh(new THREE.SphereGeometry(0.9, 40, 28), mO); g.add(O);
  const a = C.rad(52.25), L = 1.7;
  const hs = [new THREE.Vector3(Math.sin(a) * L, -Math.cos(a) * L, 0), new THREE.Vector3(-Math.sin(a) * L, -Math.cos(a) * L, 0)];
  hs.forEach((p, i) => {
    const isD = withD && i === 1; const m = new THREE.Mesh(new THREE.SphereGeometry(isD ? 0.66 : 0.52, 32, 24), isD ? mD : mH); m.position.copy(p); g.add(m);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, L, 12), new THREE.MeshStandardMaterial({ color: 0xaab4c8, roughness: 0.5 })); b.position.copy(p).multiplyScalar(0.5); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize()); g.add(b);
  });
  return g;
}

function spectrumPlane(ctx) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: ctx.U.uTime, uReveal: { value: 0 } }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: /* glsl */`
      uniform float uTime,uReveal; varying vec2 vUv;
      vec3 ramp(float x){ return clamp(vec3(abs(x*6.0-3.0)-1.0, 2.0-abs(x*6.0-2.0), 2.0-abs(x*6.0-4.0)),0.,1.); }
      float line(float x,float c,float w){ float d=(x-c)/w; return exp(-d*d); }
      void main(){ float x=vUv.x, y=vUv.y; vec3 base=ramp(0.9-x*0.85)*0.9;
        float absn=0.0; absn+=0.9*line(x,.12,.004)+0.6*line(x,.2,.006)+0.8*line(x,.31,.004)+0.5*line(x,.37,.008)+0.9*line(x,.5,.005)+0.7*line(x,.58,.004)+0.8*line(x,.66,.007)+0.6*line(x,.8,.005)+0.9*line(x,.9,.004);
        float em=1.2*line(x,.44,.012)+1.0*line(x,.73,.01); float fade=smoothstep(0.0,0.12,y)*smoothstep(1.0,0.88,y);
        vec3 col=base*(1.0-absn)+vec3(1.0,0.95,0.8)*em*2.0; float scan=smoothstep(uReveal,uReveal-0.02,x);
        col*=0.25+0.95*scan; col+=vec3(0.6,0.9,1.4)*smoothstep(0.015,0.0,abs(x-uReveal))*step(uReveal,0.999)*step(0.001,uReveal);
        float grid=0.07*step(0.96,fract(x*20.0))+0.05*step(0.94,fract(y*6.0)); col+=vec3(0.4,0.7,1.0)*grid;
        gl_FragColor=vec4(col*fade,0.92*fade); }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 4.2), mat); m.userData.mat = mat;
  const frame = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-8, -2.1, 0], [8, -2.1, 0], [8, 2.1, 0], [-8, 2.1, 0]].map((a) => new THREE.Vector3(...a))), new THREE.LineBasicMaterial({ color: 0x7fd7ff, transparent: true, opacity: 0.7 }));
  m.add(frame); return m;
}

function bar(col, w = 1.3) {
  const geo = new THREE.BoxGeometry(w, 1, w); geo.translate(0, 0.5, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.3, emissive: col, emissiveIntensity: 0.35 })); m.scale.y = 0.001; return m;
}

export function build(ctx) {
  const scene = new THREE.Scene();
  scene.add(C.makeSpaceBackdrop(ctx, 5, { tilt: 0.8 }));
  scene.environment = C.makeEnv(ctx.renderer); scene.environmentIntensity = 0.55;
  const cam = new THREE.PerspectiveCamera(42, ctx.aspect, 0.1, 3000);
  const L = new THREE.DirectionalLight(0xffffff, 2.2); L.position.set(8, 10, 12); scene.add(L);
  scene.add(new THREE.AmbientLight(0x334466, 0.8));

  const webb = hexMirrors(); const webbRoot = new THREE.Group(); webbRoot.add(webb); webbRoot.scale.setScalar(1.0); scene.add(webbRoot);
  webbRoot.rotation.set(-0.15, 0.55, 0);
  const comet = C.makeComet(ctx, { R: 0.5, tail: 0.5, seed: 8, dustCount: 5000, ionCount: 2500 }); comet.group.position.set(11, 7, -14); comet.group.rotation.z = 0.5; scene.add(comet.group);
  const beam = C.lineFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(11, 7, -14)], { color: 0x7fd7ff, opacity: 0.45 }); scene.add(beam);

  const spec = spectrumPlane(ctx); spec.position.set(20, 0, 0); scene.add(spec);

  const h2o = molecule(false), hdo = molecule(true); h2o.position.set(38, 1.8, 0); hdo.position.set(44.5, 1.8, 0); scene.add(h2o, hdo);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.06, 64), new THREE.MeshStandardMaterial({ color: 0x0b1424, metalness: 0.5, roughness: 0.6, transparent: true, opacity: 0.8 })); base.position.set(48, -2.9, 0); base.scale.set(2.4, 1, 1.0); scene.add(base);
  const bD0 = bar(0x6fb0ff), bD1 = bar(0xffa24a); bD0.position.set(52.2, -2.9, 0); bD1.position.set(55.2, -2.9, 0); scene.add(bD0, bD1);
  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.06, 64), base.material); base2.position.set(80, -2.2, 0); base2.scale.set(1.5, 1, 1.0); scene.add(base2);
  const bC = [bar(0x6fb0ff, 1.7), bar(0xffa24a, 1.7), bar(0xff6a5a, 1.7)]; [75.2, 80, 84.8].forEach((x, i) => { bC[i].position.set(x, -2.2, 0); scene.add(bC[i]); });
  const bcH = [1.9 * 1.6, 3.0 * 1.6, 3.4 * 1.6];

  const cues = [
    { kind: 'title', at: 0.8, dur: 7, pos: 'tl', kicker: 'December 2025 · NIRSpec', text: 'JAMES WEBB\nSPACE TELESCOPE', sub: 'Pointing at an interstellar comet' },
    { kind: 'label', at: 2.5, dur: 7, anchor: () => comet.group.position, text: '3I/ATLAS', color: '#9fe8ff', dx: 12, dy: -6 },
    { kind: 'title', at: 12.8, dur: 6.8, pos: 'tl', kicker: 'Chemical fingerprint', text: 'Reading the\nspectrum', sub: 'Every molecule leaves lines at its own wavelengths' },
    { kind: 'source', at: 12.8, dur: 22, pos: 'src', text: 'Cordiner et al., Nature (June 22, 2026) · NASA/ESA/CSA/STScI' },
    { kind: 'label', at: 14.5, dur: 5, anchor: () => spec.localToWorld(new THREE.Vector3(-1.2, 2.4, 0)), text: 'H₂O · CO₂ · CO · HDO …', color: '#ffd9a0', dx: -40, dy: -24 },
    { kind: 'label', at: 22.0, dur: 14, anchor: () => h2o.localToWorld(new THREE.Vector3(0, 3.0, 0)), text: 'H₂O', sub: 'ordinary water', color: '#f2f6ff', dx: -30, dy: -20 },
    { kind: 'label', at: 22.4, dur: 14, anchor: () => hdo.localToWorld(new THREE.Vector3(0, 3.0, 0)), text: 'HDO', sub: '“heavy water” · deuterium', color: '#41d9ff', dx: -30, dy: -20 },
    { kind: 'stat', at: 22.0, dur: 21.5, pos: 'tl', from: 1, to: 30, countAt: 22.8, countDur: 3, suffix: '×', hot: true, kicker: 'Deuterium vs. solar-system comets', label: 'about 30 times more heavy hydrogen' },
    { kind: 'chip', at: 35.8, dur: 8, pos: 'bl', text: 'Survives only if kept deeply frozen · never warmed', tone: 'ok' },
    { kind: 'label', at: 25, dur: 17, anchor: () => bD0.localToWorld(new THREE.Vector3(0, 1.6, 0)), text: 'Solar System', sub: '≈1×', color: '#6fb0ff', dx: -30, dy: -10 },
    { kind: 'label', at: 27, dur: 15, anchor: () => bD1.localToWorld(new THREE.Vector3(0, 30 * 0.2 + 0.4, 0)), text: '3I/ATLAS', sub: '≈30×', color: '#ffa24a', dx: 12, dy: -6 },
    { kind: 'title', at: 44.4, dur: 14, pos: 'tl', kicker: 'Second clue · carbon', text: 'Far less\ncarbon-13', sub: 'Higher ¹²C/¹³C ratio = less of the heavy isotope' },
    { kind: 'label', at: 46.5, dur: 12, anchor: () => bC[0].localToWorld(new THREE.Vector3(0, bcH[0] + 0.6, 0)), text: 'Solar System comets', sub: 'below ~100', color: '#6fb0ff', dx: -60, dy: -10 },
    { kind: 'label', at: 47.5, dur: 11, anchor: () => bC[1].localToWorld(new THREE.Vector3(0, bcH[1] + 0.6, 0)), text: '3I/ATLAS · CO', sub: 'above ~150', color: '#ffa24a', dx: -50, dy: -10 },
    { kind: 'label', at: 48.5, dur: 10, anchor: () => bC[2].localToWorld(new THREE.Vector3(0, bcH[2] + 0.6, 0)), text: '3I/ATLAS · CO₂', sub: '≈170', color: '#ff6a5a', dx: -10, dy: -10 },
  ];

  const cp = new THREE.Vector3(), tg = new THREE.Vector3();
  return {
    scene, camera: cam, cues, bloom: { strength: 0.55, radius: 0.5, threshold: 0.9 }, exposure: 1.0,
    update(t) {
      comet.set({ activity: 0.9 }); comet.group.rotation.y = 0;
      webbRoot.rotation.y = 0.55 + Math.sin(t * 0.25) * 0.15;
      spec.userData.mat.uniforms.uReveal.value = C.smooth((t - 13.5) / 6.5);
      h2o.rotation.set(0.3, t * 0.7, 0.1); hdo.rotation.set(0.3, t * 0.7 + 1, 0.1);
      const gD = C.smooth((t - 24) / 3.0); bD0.scale.y = 0.001 + gD * 0.2 * 1; bD1.scale.y = 0.001 + gD * 30 * 0.2;
      bC.forEach((b, i) => { b.scale.y = 0.001 + C.smooth((t - 45.5 - i * 0.7) / 2.2) * bcH[i]; });
      // camera rig
      const A = C.fitDist(1, ctx.aspect);
      const az = t * 0.1;
      const key = [[0, [0, 0, 0], [Math.sin(az) * 13 + 3, 3, 15 * A]], [10, [0, 0, 0], [Math.sin(az) * 13 + 3, 3, 15 * A]], [13.5, [20, 0, 0], [20, 1.2, 14 * A]], [20, [20, 0, 0], [21, 1, 13 * A]],
        [24, [47, 0, 0], [47, 3, 24 * A]], [37.5, [47, 0, 0], [47, 3, 24 * A]], [42.5, [80, 0, 0], [80, 3, 17 * A]], [60, [80, 0.5, 0], [80, 3.5, 16 * A]]];
      let i = 1; while (i < key.length - 1 && t > key[i][0]) i++;
      const a = key[i - 1], b = key[i]; const k = C.smoother((t - a[0]) / (b[0] - a[0]));
      tg.set(...a[1]).lerp(new THREE.Vector3(...b[1]), k); cp.set(...a[2]).lerp(new THREE.Vector3(...b[2]), k);
      cam.position.copy(cp); cam.lookAt(tg);
    },
  };
}
