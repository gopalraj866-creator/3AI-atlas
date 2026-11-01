import * as THREE from 'three';
import * as C from '../common.js';

const OFF = 400; // stage B (radio telescope) lives at x = 400

function dishes(ctx) {
  const g = new THREE.Group(); const N = 64;
  const geo = new THREE.SphereGeometry(1.7, 32, 10, 0, Math.PI * 2, Math.PI - 0.8, 0.8); geo.translate(0, 1.7, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide });
  const im = new THREE.InstancedMesh(geo, mat, N);
  const ped = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 1.5, 10), new THREE.MeshStandardMaterial({ color: 0x8a909a, metalness: 0.5, roughness: 0.5 }), N);
  const feed = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6), new THREE.MeshStandardMaterial({ color: 0x777c86 }), N);
  const pos = [];
  for (let i = 0; i < N; i++) { const r = Math.pow(i + 0.5, 0.58) * 4.1 * (i > 50 ? 1.6 : 1); const a = i * 2.39996; pos.push([Math.cos(a) * r, Math.sin(a) * r]); }
  g.add(im, ped, feed); g.userData = { im, ped, feed, pos };
  const d = new THREE.Object3D();
  g.userData.setTilt = (tx, tz, t) => {
    pos.forEach(([x, z], i) => {
      const jit = Math.sin(t * 0.4 + i) * 0.015;
      d.position.set(x, 1.5, z); d.rotation.set(tx + jit, 0, tz); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
      d.position.set(x, 0.75, z); d.rotation.set(0, 0, 0); d.updateMatrix(); ped.setMatrixAt(i, d.matrix);
      d.position.set(x + Math.sin(tz) * -1.6 * 0.8 * 1, 1.5 + 1.7 + 0.5, z + Math.sin(tx) * 1.6 * 0.8); d.rotation.set(tx, 0, tz); d.updateMatrix(); feed.setMatrixAt(i, d.matrix);
    });
    im.instanceMatrix.needsUpdate = ped.instanceMatrix.needsUpdate = feed.instanceMatrix.needsUpdate = true;
  };
  return g;
}

function waterfall(ctx) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: ctx.U.uTime, uOn: { value: 0 } }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: C.GLSL_NOISE + /* glsl */`
      uniform float uTime,uOn; varying vec2 vUv;
      vec3 plasma(float x){ return clamp(vec3(1.5*x+0.05, 1.2*x*x*x+0.02, 2.0*sin(x*3.14159)*0.7*(1.0-x)+0.25*x),0.,1.5); }
      void main(){ float x=vUv.x, y=vUv.y; float s=0.0;
        for(int k=0;k<6;k++){ float tb=0.1+float(k)*0.155; float c=tb+0.07*(1.0-y)*(1.0-y); float d=(x-c)/0.012; float band=smoothstep(0.1,0.25,y)*smoothstep(0.97,0.8,y)*(0.55+0.45*sin(y*40.0+float(k)));
          s+=exp(-d*d)*band; }
        float n=vnoise(vec3(x*80.0,y*60.0,uTime*0.5)); float base=0.08+0.1*n; float vis=smoothstep(uOn*1.05,uOn*0.95,x);
        float v=(base+s*1.1); vec3 col=plasma(clamp(v,0.,1.)); col*=0.35+0.9*vis; col*=step(0.0,uOn);
        float grid=0.12*(step(0.985,fract(x*10.0))+step(0.975,fract(y*8.0))); col+=vec3(0.4,0.7,1.0)*grid;
        float edge=step(0.995,max(abs(x-0.5),abs(y-0.5))*2.0); col+=vec3(0.5,0.9,1.0)*edge; gl_FragColor=vec4(col,0.94); }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(24, 13.5), mat); m.userData.mat = mat; return m;
}

export function build(ctx) {
  const scene = new THREE.Scene();
  const bg = C.makeSpaceBackdrop(ctx, 8, { tilt: 0.7 }); scene.add(bg);
  scene.environment = C.makeEnv(ctx.renderer); scene.environmentIntensity = 0.35;
  const cam = new THREE.PerspectiveCamera(45, ctx.aspect, 0.1, 3000);

  /* ---- stage A: Beta Pictoris system ---- */
  const sys = new THREE.Group(); scene.add(sys);
  const star = new THREE.Mesh(new THREE.SphereGeometry(1.7, 48, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.8, 2.2) })); sys.add(star);
  sys.add(C.makeGlow(0xcfe0ff, 11, 1.1), C.makeGlow(0x8fb0ff, 26, 0.35));
  const r = C.rng(3); const nD = 16000; const dp = new Float32Array(nD * 3), dc = new Float32Array(nD * 3), ds = new Float32Array(nD), dph = new Float32Array(nD);
  for (let i = 0; i < nD; i++) { const rr = 5 + Math.pow(r(), 1.5) * 50; const a = r() * 6.283; dp.set([Math.cos(a) * rr, C.gauss(r) * (0.18 + rr * 0.022), Math.sin(a) * rr], i * 3); const b = 0.45 * (1 - rr / 70); dc.set([b * 0.9, b * 0.95, b * 1.15], i * 3); ds[i] = 1.6 + r() * 1.6; dph[i] = r(); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('aColor', new THREE.BufferAttribute(dc, 3)); dg.setAttribute('aSize', new THREE.BufferAttribute(ds, 1)); dg.setAttribute('aPhase', new THREE.BufferAttribute(dph, 1));
  const disk = new THREE.Points(dg, C.starMaterial(ctx, { twinkle: 0 })); disk.frustumCulled = false; disk.rotation.z = 0.06; sys.add(disk);
  const orbits = [[6, 0.35, 0x9ab0c8, 'c'], [9.5, 0.45, 0xb8a890, 'd'], [15, 1.15, 0xd9a566, 'b']];
  const pl = orbits.map(([R0, size, col], i) => {
    sys.add(C.ringLine(R0, { color: 0x7fb4ff, opacity: i === 2 ? 0.45 : 0.2 }));
    const m = i === 2 ? C.makeGasGiant(ctx, { R: size, sunDir: new THREE.Vector3(-1, 0, 0) }) : new THREE.Mesh(new THREE.SphereGeometry(size, 24, 16), new THREE.MeshBasicMaterial({ color: col }));
    sys.add(m); return { m, R0, w: [0.9, 0.6, 0.42][i], a0: [1, 3, 0.2][i] };
  });
  const planetB = pl[2]; const pbPos = new THREE.Vector3(); const bGlow = C.makeGlow(0xffc080, 4.5, 0.6); planetB.m.add(bGlow);
  const hl = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.45, 96), new THREE.MeshBasicMaterial({ color: 0x7fffd0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); sys.add(hl);
  const pulses = [0, 1, 2].map(() => new THREE.Mesh(new THREE.RingGeometry(0.98, 1.0, 96), new THREE.MeshBasicMaterial({ color: 0x7fd7ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))); pulses.forEach((p) => sys.add(p));
  const sysL = new THREE.DirectionalLight(0xffffff, 0.5); scene.add(sysL);

  /* ---- stage B: MeerKAT ---- */
  const B = new THREE.Group(); B.position.set(OFF, 0, 0); scene.add(B);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(500, 64), new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 1 })); ground.rotation.x = -Math.PI / 2; B.add(ground);
  const dg2 = dishes(ctx); B.add(dg2);
  const moon = new THREE.DirectionalLight(0x9fb4ff, 1.8); moon.position.set(OFF - 30, 40, 30); scene.add(moon); scene.add(new THREE.HemisphereLight(0x23304f, 0x0c0a08, 0.9));
  const wf = waterfall(ctx); wf.position.set(OFF - 10, 14, 4); wf.rotation.y = 0.35; scene.add(wf);
  const horizon = C.makeGlow(0x2a4a7a, 700, 0.25); horizon.position.set(OFF, 6, -300); scene.add(horizon);

  const sysAnchor = (x, y, z) => () => new THREE.Vector3(x, y, z);
  const cues = [
    { kind: 'title', at: 0.5, dur: 6.5, pos: 'tl', kicker: 'Preprint posted Sept 15, 2026 · arXiv', text: 'RADIO WAVES\nFROM A PLANET', sub: 'A first for exoplanet science' },
    { kind: 'label', at: 7, dur: 13, anchor: () => star.position.clone().add(new THREE.Vector3(0, 2.2, 0)), text: 'Beta Pictoris', sub: 'young star · 1.75× the Sun', color: '#cfe0ff', dx: 10, dy: -10 },
    { kind: 'label', at: 11.6, dur: 9, anchor: () => pbPos, text: 'Beta Pictoris b', sub: 'gas giant · ~10–12 Jupiter masses', color: '#ffc080', dx: 16, dy: -12 },
    { kind: 'stat', at: 14.2, dur: 10.3, pos: 'cr', from: 0, to: 63, countAt: 14.4, countDur: 1.6, kicker: 'Distance', label: 'light-years from Earth' },
    { kind: 'chip', at: 21.6, dur: 9.5, pos: 'bl', text: 'MeerKAT · 64 dishes · South Africa', tone: 'ok' },
    { kind: 'chip', at: 29.5, dur: 10, pos: 'bc', text: 'Repeating bursts · multiple frequencies' },
    { kind: 'label', at: 30.5, dur: 8.5, anchor: () => wf.localToWorld(new THREE.Vector3(0, -7.6, 0)), text: 'Time →', color: '#7fd7ff', dx: -20, dy: 10 },
    { kind: 'label', at: 30.5, dur: 8.5, anchor: () => wf.localToWorld(new THREE.Vector3(-12.6, 0, 0)), text: 'Frequency ↑', color: '#7fd7ff', dx: -110, dy: 0 },
    { kind: 'label', at: 41.5, dur: 12, anchor: () => pbPos, text: 'SOURCE: the planet', sub: 'traced to Beta Pictoris b itself', color: '#7fffd0', dx: 22, dy: -14 },
    { kind: 'label', at: 42.5, dur: 11, anchor: () => star.position.clone().add(new THREE.Vector3(0, 2.2, 0)), text: 'Not the star', color: '#ff9a7a', dx: 10, dy: -10 },
    { kind: 'title', at: 51, dur: 8.2, pos: 'lc', text: 'FIRST DIRECT RADIO\nDETECTION FROM\nAN EXOPLANET', fin: 0.7 },
    { kind: 'source', at: 3, dur: 55, pos: 'src', text: 'arXiv preprint (Sept 15, 2026) · CNN · Science News · ScienceAlert · RNZ' },
  ];
  const dips = [{ at: 20.8, dur: 1.2 }, { at: 40.2, dur: 1.4 }];
  const cp = new THREE.Vector3(), tg = new THREE.Vector3(); const A = C.fitDist(1, ctx.aspect);

  return {
    scene, camera: cam, cues, dips, bloom: { strength: 0.8, radius: 0.7, threshold: 0.82 }, exposure: 1.0,
    update(t) {
      const inB = t >= 20.8 && t < 40.2;
      sys.visible = !inB; B.visible = inB; wf.visible = inB; moon.visible = inB; horizon.visible = inB; ground.visible = inB; sysL.visible = !inB;
      pl.forEach((p) => { const a = p.a0 + t * p.w * 0.5; p.m.position.set(Math.cos(a) * p.R0, 0, Math.sin(a) * p.R0); });
      pbPos.copy(planetB.m.position).applyMatrix4(sys.matrixWorld); planetB.m.rotation.y = t * 0.4;
      disk.rotation.y = t * 0.01;
      const hlk = C.smooth((t - 41) / 1.5) * C.smooth((56 - t) / 1.5); hl.material.opacity = 0.9 * hlk; hl.position.copy(planetB.m.position); hl.quaternion.copy(cam.quaternion);
      pulses.forEach((p, i) => { const k = (((t / 2.4) + i / 3) % 1); p.position.copy(planetB.m.position); p.quaternion.copy(cam.quaternion); p.scale.setScalar(2 + k * 9); p.material.opacity = hlk * (1 - k) * 0.7; });
      bg.position.copy(cam.position);
      if (!inB) {
        const az = t * 0.025 + (t > 40 ? 0 : 0); const d = (t < 40 ? C.kf(t, [[0, 62], [20, 34]]) : C.kf(t, [[40, 40], [60, 20]])) * A;
        const focus = t > 40 ? planetB.m.position.clone().multiplyScalar(0.6) : new THREE.Vector3(0, 0, 0);
        tg.copy(focus); cp.set(Math.sin(az + 0.6) * d, d * 0.2, Math.cos(az + 0.6) * d).add(focus);
      } else {
        const k = (t - 20.8) / 19.4; dg2.userData.setTilt(-0.55 + Math.sin(t * 0.2) * 0.02, 0.35, t);
        wf.userData.mat.uniforms.uOn.value = C.smooth((t - 29.5) / 7) * 1.02;
        const f = C.smoother((t - 28) / 4);
        cp.set(OFF + C.lerp(30, 6, f), C.lerp(6, 11, f), C.lerp(34, 30, f) * A); tg.set(OFF + C.lerp(0, -9, f), C.lerp(6, 12, f), C.lerp(0, 2, f));
        cp.x += Math.sin(t * 0.15) * 2;
      }
      cam.position.copy(cp); cam.lookAt(tg);
    },
  };
}
