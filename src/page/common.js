// Shared 3D building blocks: stars, comet, sun, galaxy, earth, warp streaks, helpers.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const smoother = (x) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
export const rad = (d) => d * Math.PI / 180;
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function gauss(r) { return Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(6.283185307 * r()); }

// keyframes: keys = [[t, v], ...]; v number or array. smoothstep between keys.
export function kf(t, keys, ease = smooth) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      const k = ease((t - t0) / (t1 - t0));
      if (Array.isArray(v0)) return v0.map((x, j) => lerp(x, v1[j], k));
      return lerp(v0, v1, k);
    }
  }
  return keys[keys.length - 1][1];
}
export const fitDist = (d, aspect) => (aspect < 1 ? d * (1 + (1 - aspect) * 1.2) : d);

export const GLSL_NOISE = /* glsl */`
float hash(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
              mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.02; a*=.5;} return s; }
`;

export function makeCtxUniforms(H) { return { uTime: { value: 0 }, uPx: { value: H / 1080 } }; }

export function makeEnv(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  return tex;
}

/* ---------- sprites / glow ---------- */
let _glowTex;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,.6)'); gr.addColorStop(0.35, 'rgba(255,255,255,.16)');
  gr.addColorStop(0.7, 'rgba(255,255,255,.035)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  _glowTex = new THREE.CanvasTexture(c); _glowTex.colorSpace = THREE.SRGBColorSpace; return _glowTex;
}
export function makeGlow(color = 0xffffff, size = 5, intensity = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  m.color = new THREE.Color(color).multiplyScalar(intensity);
  const s = new THREE.Sprite(m); s.scale.set(size, size, 1); return s;
}

/* ---------- stars ---------- */
export function starMaterial(ctx, { twinkle = 1, sizeMul = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: ctx.U.uTime, uPx: ctx.U.uPx, uTw: { value: twinkle }, uMul: { value: sizeMul } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSize; attribute vec3 aColor; attribute float aPhase;
      uniform float uTime,uPx,uTw,uMul; varying vec3 vC;
      void main(){ float tw=1.0-uTw*0.25+uTw*0.25*sin(uTime*(0.7+aPhase*1.6)+aPhase*50.0);
        vC=aColor*tw; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.0,aSize*uPx*uMul); }`,
    fragmentShader: /* glsl */`
      varying vec3 vC; void main(){ float d=length(gl_PointCoord-0.5)*2.0; float a=smoothstep(1.0,0.0,d); a*=a; gl_FragColor=vec4(vC*a,a); }`,
  });
}
export function makeStars(ctx, { count = 5000, radius = 600, seed = 1, size = 3.2, bright = 1.0 } = {}) {
  const r = rng(seed); const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sz = new Float32Array(count), ph = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = r() * 2 - 1, th = r() * 6.2831853, s = Math.sqrt(1 - u * u);
    pos.set([radius * s * Math.cos(th), radius * u, radius * s * Math.sin(th)], i * 3);
    const m = Math.pow(r(), 7); const temp = r();
    const c = [lerp(0.68, 1.0, temp), lerp(0.8, 0.86, temp), lerp(1.0, 0.7, temp)];
    const b = (0.25 + 0.75 * r() * r()) * (1 + m * 2.5) * bright;
    col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    sz[i] = 1.4 + m * size * 2.2 + r() * 0.8; ph[i] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1)); g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const p = new THREE.Points(g, starMaterial(ctx)); p.frustumCulled = false; return p;
}

// faint Milky Way band + nebula haze as points concentrated around a tilted great circle
export function makeMilkyWay(ctx, { count = 14000, radius = 580, seed = 3, tilt = 0.9, width = 0.16, tint = [0.55, 0.62, 0.9], bright = 0.5 } = {}) {
  const r = rng(seed); const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sz = new Float32Array(count), ph = new Float32Array(count);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, 0.4, 0.2));
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const th = r() * 6.2831853; const lat = gauss(r) * width * (0.5 + r());
    v.set(Math.cos(lat) * Math.cos(th), Math.sin(lat), Math.cos(lat) * Math.sin(th)).applyQuaternion(q).multiplyScalar(radius);
    pos.set([v.x, v.y, v.z], i * 3);
    const dust = 0.35 + 0.65 * Math.abs(Math.sin(th * 3.0 + lat * 9.0));
    const b = bright * dust * (0.25 + 0.75 * r());
    const warm = r() * 0.4;
    col.set([(tint[0] + warm) * b, (tint[1] + warm * 0.4) * b, tint[2] * b], i * 3);
    sz[i] = 2.0 + r() * 3.5; ph[i] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1)); g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const p = new THREE.Points(g, starMaterial(ctx, { twinkle: 0 })); p.frustumCulled = false; return p;
}

// soft nebula haze: big tinted glow sprites scattered along the Milky-Way band
export function makeNebula(ctx, { seed = 9, count = 26, radius = 520, tilt = 0.9, strength = 1 } = {}) {
  const r = rng(seed); const g = new THREE.Group();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, 0.4, 0.2)); const v = new THREE.Vector3();
  const tints = [0x3a5cff, 0x7a3cff, 0x1fa8c9, 0xff5a8a, 0x3a7aff];
  for (let i = 0; i < count; i++) {
    const th = r() * 6.2831853, lat = gauss(r) * 0.18;
    v.set(Math.cos(lat) * Math.cos(th), Math.sin(lat), Math.cos(lat) * Math.sin(th)).applyQuaternion(q).multiplyScalar(radius);
    const s = makeGlow(tints[Math.floor(r() * tints.length)], 160 + r() * 260, (0.035 + r() * 0.07) * strength);
    s.position.copy(v); g.add(s);
  }
  return g;
}
export function makeSpaceBackdrop(ctx, seed = 1, { milky = true, tilt = 0.9, nebula = 1 } = {}) {
  const g = new THREE.Group();
  g.add(makeStars(ctx, { count: 6500, seed }));
  if (milky) { g.add(makeMilkyWay(ctx, { tilt, seed: seed + 11, bright: 0.8 })); if (nebula) g.add(makeNebula(ctx, { seed: seed + 3, tilt, strength: nebula })); }
  return g;
}

// smooth tail built from many camera-facing glow sprites (looks right from any angle)
export function makeTailGlow(ctx, { len = 60, width = 10, color = [1, 0.85, 0.6], intensity = 0.4, power = 1.6, count = 90, bend = 0, wobble = 0.25, seed = 1 } = {}) {
  const grp = new THREE.Group(); const r = rng(seed); const items = [];
  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) / count;
    const s = makeGlow(0xffffff, 1, 1); grp.add(s);
    items.push({ s, u, ph: r() * 6.28, off: (r() - 0.5) });
  }
  const st = { color: new THREE.Color(...color), k: intensity };
  grp.userData.set = (k, col) => { st.k = k; if (col) st.color.setRGB(...col); };
  grp.userData.update = (t) => {
    for (const it of items) {
      const u = it.u; const size = width * (0.7 + 2.0 * Math.sqrt(u));
      it.s.position.set(u * len, Math.sin(u * 7 - t * 0.7 + it.ph) * wobble * width * u + it.off * width * 0.25 * u, bend * u * u * len + Math.cos(u * 5 - t * 0.5 + it.ph) * wobble * width * 0.6 * u);
      it.s.scale.set(size, size, 1);
      const f = Math.pow(1 - u, power) * (0.6 + 0.4 * Math.sin(t * 1.3 + it.ph * 3)) * (count > 0 ? 24 / count : 1);
      it.s.material.color.copy(st.color).multiplyScalar(st.k * f);
    }
  };
  grp.userData.update(0);
  return grp;
}

/* ---------- particle stream (comet tails, jets, dust) ---------- */
export function makeStream(ctx, o) {
  const { count = 4000, dir = [1, 0, 0], len = 20, spread = 0.2, bend = [0, 0, 0], size = 3, rate = 0.12, c1 = [1, 1, 1], c2 = [0.2, 0.3, 0.5], r0 = 0, active = 1, seed = 1, origin = [0, 0, 0], alpha = 1 } = o;
  const r = rng(seed); const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count * 4; i++) seeds[i] = r();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: ctx.U.uTime, uPx: ctx.U.uPx, uLen: { value: len }, uSpread: { value: spread }, uBend: { value: new THREE.Vector3(...bend) },
      uSize: { value: size }, uRate: { value: rate }, uC1: { value: new THREE.Color(...c1) }, uC2: { value: new THREE.Color(...c2) },
      uDir: { value: new THREE.Vector3(...dir).normalize() }, uR0: { value: r0 }, uActive: { value: active }, uOrigin: { value: new THREE.Vector3(...origin) }, uAlpha: { value: alpha },
    },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec4 aSeed; uniform float uTime,uPx,uLen,uSpread,uSize,uRate,uR0,uActive,uAlpha; uniform vec3 uBend,uDir,uOrigin,uC1,uC2;
      varying float vA; varying vec3 vC;
      void main(){
        float age=fract(aSeed.x+uTime*uRate*(0.55+0.9*aSeed.y)); float d=age*uLen;
        vec3 dir=normalize(uDir); vec3 up=abs(dir.y)<0.99?vec3(0.,1.,0.):vec3(1.,0.,0.);
        vec3 t1=normalize(cross(dir,up)); vec3 t2=cross(dir,t1);
        float ang=aSeed.z*6.2831853; float rr=sqrt(aSeed.w)*(uSpread*d+uR0*0.35);
        vec3 p=uOrigin+dir*(d+uR0)+(t1*cos(ang)+t2*sin(ang))*rr+uBend*age*age*uLen;
        vA=pow(1.0-age,1.6)*uActive*uAlpha*(0.35+0.65*aSeed.y); vC=mix(uC1,uC2,age);
        vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.0,uSize*uPx*(0.35+(1.0-age)*0.9)); }`,
    fragmentShader: /* glsl */`
      varying float vA; varying vec3 vC; void main(){ float d=length(gl_PointCoord-0.5)*2.0; float a=smoothstep(1.0,0.0,d); a*=a*vA; gl_FragColor=vec4(vC*a,a); }`,
  });
  const p = new THREE.Points(g, mat); p.frustumCulled = false; p.userData.mat = mat; return p;
}

/* ---------- comet ---------- */
export function makeComet(ctx, { R = 1, tail = 1, seed = 7, dustCount = 16000, ionCount = 6000 } = {}) {
  const group = new THREE.Group();
  let geo = new THREE.IcosahedronGeometry(R, 5); geo.deleteAttribute('normal'); geo.deleteAttribute('uv'); geo = mergeVertices(geo, 1e-4); const p = geo.attributes.position; const cols = new Float32Array(p.count * 3); const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + 0.17 * Math.sin(v.x * 2.1 + 1.3) * Math.sin(v.y * 1.7 + 0.4) * Math.sin(v.z * 2.3 + 2.2) + 0.05 * Math.sin(v.x * 5 + v.y * 4 + v.z * 6);
    v.multiplyScalar(n); v.x *= 1.3; v.y *= 0.85; p.setXYZ(i, v.x, v.y, v.z);
    const sh = 0.55 + 0.45 * Math.sin(v.x * 9 + v.y * 4) * Math.sin(v.z * 7); cols.set([0.3 * sh, 0.25 * sh, 0.21 * sh], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
  const nucleus = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  group.add(nucleus);
  const coma1 = makeGlow(0xaaf0d0, R * 16, 0.55), coma2 = makeGlow(0xffffff, R * 5.5, 1.1); group.add(coma1, coma2);
  const dust = makeStream(ctx, { count: dustCount, dir: [1, 0, 0], len: R * 60 * tail, spread: 0.2, bend: [0, -0.02, 0.09], size: 3.2, rate: 0.045, c1: [1.0, 0.92, 0.78], c2: [0.55, 0.42, 0.34], r0: R * 0.9, seed });
  const ion = makeStream(ctx, { count: ionCount, dir: [1, 0, 0], len: R * 90 * tail, spread: 0.035, size: 2.4, rate: 0.12, c1: [0.62, 0.86, 1.3], c2: [0.18, 0.36, 1.0], r0: R * 0.5, seed: seed + 5 });
  const dustGlow = makeTailGlow(ctx, { len: R * 62 * tail, width: R * 11, color: [1.0, 0.82, 0.58], intensity: 0.22, power: 1.4, bend: 0.14, wobble: 0.2, seed: 2, count: 110 });
  const ionGlow = makeTailGlow(ctx, { len: R * 100 * tail, width: R * 3.0, color: [0.35, 0.65, 1.3], intensity: 0.5, power: 1.0, wobble: 0.35, seed: 7, count: 150 });
  group.add(dustGlow, ionGlow, dust, ion);
  const jets = [];
  const api = {
    group, nucleus, dust, ion, dustGlow, ionGlow, coma1, coma2, jets, R,
    addJet(dirArr, { len = 9, count = 1600, spread = 0.18, size = 2.6, color = [0.9, 0.95, 1.2], seed: s = 3 } = {}) {
      const d = new THREE.Vector3(...dirArr).normalize();
      const j = makeStream(ctx, { count, dir: d.toArray(), len: R * len, spread, size, rate: 0.16, c1: color, c2: [0.2, 0.3, 0.6], r0: R * 0.85, seed: s, active: 0 });
      group.add(j); jets.push({ points: j, dir: d, len: R * len }); return jets[jets.length - 1];
    },
    // activity 0..1 (tail strength), blue 0..1 (colour shift)
    set({ activity = 1, blue = 0, coma = 1 } = {}) {
      dust.userData.mat.uniforms.uAlpha.value = 0.55 * activity; ion.userData.mat.uniforms.uAlpha.value = 0.7 * activity * (0.6 + 0.8 * blue);
      dustGlow.userData.set(0.22 * activity * (1 - 0.4 * blue)); ionGlow.userData.set(0.5 * activity * (0.6 + 0.9 * blue), [lerp(0.35, 0.3, blue), lerp(0.65, 0.7, blue), lerp(1.2, 1.5, blue)]);
      dustGlow.userData.update(ctx.U.uTime.value); ionGlow.userData.update(ctx.U.uTime.value);
      const c = new THREE.Color().setRGB(lerp(0.65, 0.45, blue), lerp(0.95, 0.8, blue), lerp(0.8, 1.3, blue));
      coma1.material.color.copy(c).multiplyScalar(0.55 * activity * coma); coma1.scale.setScalar(R * 16 * (0.5 + 0.5 * activity) * coma);
      coma2.material.color.setRGB(1, lerp(1, 1.0, blue), lerp(1, 1.4, blue)).multiplyScalar(1.1 * (0.4 + 0.6 * activity) * coma);
    },
  };
  api.set({});
  return api;
}

/* ---------- sun ---------- */
export function makeSun(ctx, r = 3) {
  const g = new THREE.Group();
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: ctx.U.uTime },
    vertexShader: 'varying vec3 vP; varying vec3 vN; void main(){ vP=position; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: GLSL_NOISE + /* glsl */`
      uniform float uTime; varying vec3 vP; varying vec3 vN;
      void main(){ float n=fbm(vP*1.6+vec3(0.,uTime*0.05,0.)); float n2=fbm(vP*5.0-vec3(uTime*0.08));
        vec3 col=mix(vec3(2.4,0.75,0.12),vec3(4.2,3.1,1.3),smoothstep(0.25,0.8,n+n2*0.25)); float limb=pow(max(dot(vN,vec3(0.,0.,1.)),0.),0.45); col*=0.55+0.7*limb; gl_FragColor=vec4(col,1.0); }`,
  });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), m));
  g.add(makeGlow(0xffb25a, r * 7, 1.1), makeGlow(0xffe2b0, r * 3.2, 1.0));
  return g;
}

/* ---------- galaxy ---------- */
export function makeGalaxy(ctx, { R = 40, count = 60000, arms = 2, twist = 5.2, seed = 5, thick = 0.07, size = 2.4, warmCore = 1, clumpy = 0 } = {}) {
  const r = rng(seed); const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sz = new Float32Array(count), ph = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let x, y, z, c;
    if (i < count * 0.18) { // bulge
      const rr = Math.abs(gauss(r)) * R * 0.11; const u = r() * 2 - 1, th = r() * 6.28; const s = Math.sqrt(1 - u * u);
      x = rr * s * Math.cos(th); y = rr * u * 0.7; z = rr * s * Math.sin(th); c = [1.0, 0.78 * warmCore + 0.2, 0.45 + 0.3 * (1 - warmCore)];
    } else {
      const t = Math.pow(r(), 0.75); const rr = t * R; const arm = i % arms; const a = t * twist + arm * (6.2831853 / arms) + gauss(r) * (0.22 + 0.12 * (1 - t));
      const jx = clumpy ? Math.sin(a * 9 + rr) * clumpy : 0;
      x = Math.cos(a) * rr + jx; z = Math.sin(a) * rr; y = gauss(r) * R * thick * (1 - 0.7 * t);
      const k = t; c = [lerp(1.0, 0.45, k), lerp(0.75, 0.68, k), lerp(0.5, 1.15, k)];
    }
    const b = 0.35 + 0.8 * r() * r();
    pos.set([x, y, z], i * 3); col.set([c[0] * b, c[1] * b, c[2] * b], i * 3); sz[i] = size * (0.5 + r() * 1.3); ph[i] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1)); g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const grp = new THREE.Group(); const pts = new THREE.Points(g, starMaterial(ctx, { twinkle: 0 })); pts.frustumCulled = false; grp.add(pts);
  grp.add(makeGlow(0xffd6a0, R * 0.9, 0.5)); return grp;
}

/* ---------- earth ---------- */
export function makeEarth(ctx, { R = 5, sunDir = new THREE.Vector3(-1, 0.3, 0.6) } = {}) {
  const g = new THREE.Group();
  const U = { uTime: ctx.U.uTime, uSun: { value: sunDir.clone().normalize() } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: 'varying vec3 vP; varying vec3 vWN; varying vec3 vWP; void main(){ vP=position; vWN=normalize(mat3(modelMatrix)*normal); vWP=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: GLSL_NOISE + /* glsl */`
      uniform vec3 uSun; uniform float uTime; varying vec3 vP; varying vec3 vWN; varying vec3 vWP;
      void main(){ vec3 p=normalize(vP); float h=fbm(p*2.6+3.0)+0.35*fbm(p*7.0); float land=smoothstep(0.55,0.58,h);
        vec3 ocean=mix(vec3(0.01,0.05,0.16),vec3(0.03,0.17,0.38),smoothstep(0.35,0.55,h));
        float lat=abs(p.y); vec3 lc=mix(vec3(0.16,0.28,0.1),vec3(0.42,0.34,0.2),smoothstep(0.55,0.75,fbm(p*4.0)+0.2*(1.0-lat)));
        lc=mix(lc,vec3(0.9),smoothstep(0.78,0.92,lat)); vec3 alb=mix(ocean,lc,land);
        float cl=smoothstep(0.52,0.78,fbm(p*3.4+vec3(uTime*0.01,0.,0.)+9.0)); alb=mix(alb,vec3(1.0),cl*0.85);
        vec3 N=normalize(vWN); float d=dot(N,normalize(uSun)); float day=smoothstep(-0.08,0.25,d);
        vec3 V=normalize(cameraPosition-vWP); vec3 H=normalize(normalize(uSun)+V); float spec=pow(max(dot(N,H),0.),90.)*(1.0-land)*(1.0-cl)*0.9;
        float fres=pow(1.0-max(dot(N,V),0.),3.0);
        vec3 col=alb*(0.015+day*1.35)+spec*vec3(1.,.95,.85)+vec3(0.15,0.4,1.0)*fres*(0.15+day*0.9);
        float city=smoothstep(0.7,0.9,vnoise(p*60.0))*land*(1.0-smoothstep(-0.05,0.1,d))*(1.0-cl); col+=vec3(1.0,0.62,0.25)*city*0.9; gl_FragColor=vec4(col,1.0); }`,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), mat); g.add(body);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.045, 64, 48), new THREE.ShaderMaterial({
    uniforms: { uSun: U.uSun }, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vWN; varying vec3 vWP; void main(){ vWN=normalize(mat3(modelMatrix)*normal); vWP=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 uSun; varying vec3 vWN; varying vec3 vWP; void main(){ vec3 V=normalize(cameraPosition-vWP); float f=pow(max(dot(-vWN,V),0.),2.2); float d=smoothstep(-0.3,0.4,dot(normalize(-vWN),normalize(uSun))); gl_FragColor=vec4(vec3(0.25,0.55,1.4)*f*(0.25+d),f*0.9); }',
  }));
  g.add(atmo); g.userData.body = body; g.userData.U = U; return g;
}

/* ---------- gas giant w/ bands ---------- */
export function makeGasGiant(ctx, { R = 2, sunDir = new THREE.Vector3(1, 0.2, 0.5), colors = [[0.82, 0.58, 0.36], [0.55, 0.32, 0.2], [0.93, 0.78, 0.55]] } = {}) {
  const g = new THREE.Group();
  const U = { uTime: ctx.U.uTime, uSun: { value: sunDir.clone().normalize() } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: 'varying vec3 vP; varying vec3 vWN; varying vec3 vWP; void main(){ vP=position; vWN=normalize(mat3(modelMatrix)*normal); vWP=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: GLSL_NOISE + /* glsl */`
      uniform vec3 uSun; uniform float uTime; varying vec3 vP; varying vec3 vWN; varying vec3 vWP;
      void main(){ vec3 p=normalize(vP); float lat=p.y; float lon=atan(p.z,p.x);
        float w=fbm(vec3(lon*1.5+uTime*0.03,lat*9.0,0.))*0.9; float b=sin((lat+w*0.18)*26.0)*0.5+0.5; b=0.55*b+0.45*fbm(vec3(lon*3.+uTime*0.05,lat*22.0,3.));
        vec3 c1=vec3(${colors[0].join(',')}), c2=vec3(${colors[1].join(',')}), c3=vec3(${colors[2].join(',')});
        vec3 alb=mix(mix(c2,c1,smoothstep(0.2,0.6,b)),c3,smoothstep(0.62,0.9,b));
        vec3 N=normalize(vWN); float d=dot(N,normalize(uSun)); float day=smoothstep(-0.12,0.35,d); vec3 V=normalize(cameraPosition-vWP);
        float fres=pow(1.0-max(dot(N,V),0.),2.5); vec3 col=alb*(0.02+day*0.7)+vec3(0.5,0.65,1.0)*fres*0.28*(0.2+day); gl_FragColor=vec4(col,1.0); }`,
  });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), mat)); g.userData.U = U; return g;
}

/* ---------- warp streaks ---------- */
export function makeWarp(ctx, { count = 1800, spread = 60, depth = 400, speed = 60, streak = 8, color = [0.7, 0.85, 1.2], seed = 4, hole = 2 } = {}) {
  const r = rng(seed); const pos = new Float32Array(count * 2 * 3), end = new Float32Array(count * 2), br = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const a = r() * 6.28, rr = hole + Math.pow(r(), 0.7) * spread; const x = Math.cos(a) * rr, y = Math.sin(a) * rr, z = r() * depth; const b = 0.3 + 0.7 * r();
    for (let k = 0; k < 2; k++) { pos.set([x, y, z], (i * 2 + k) * 3); end[i * 2 + k] = k; br[i * 2 + k] = b; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1)); g.setAttribute('aB', new THREE.BufferAttribute(br, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uDist: { value: 0 }, uStreak: { value: streak }, uDepth: { value: depth }, uColor: { value: new THREE.Color(...color) }, uFade: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aEnd; attribute float aB; uniform float uDist,uStreak,uDepth; varying float vA;
      void main(){ float z=mod(position.z+uDist,uDepth)-uDepth; vec3 p=vec3(position.xy,z-aEnd*uStreak);
        vA=aB*(1.0-aEnd*0.9)*smoothstep(-uDepth,-uDepth*0.8,z)*smoothstep(0.0,-6.0,z); gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: 'uniform vec3 uColor; uniform float uFade; varying float vA; void main(){ gl_FragColor=vec4(uColor*vA*uFade,vA*uFade); }',
  });
  const l = new THREE.LineSegments(g, mat); l.frustumCulled = false; l.userData.mat = mat; return l;
}

/* ---------- misc ---------- */
export function ringLine(radius, { seg = 192, color = 0x5fa8ff, opacity = 0.35, y = 0 } = {}) {
  const pts = []; for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius)); }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
}
export function lineFromPoints(pts, { color = 0xffffff, opacity = 1 } = {}) {
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
}
