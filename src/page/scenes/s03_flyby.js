import * as THREE from 'three';
import * as C from '../common.js';

// Heliocentric orbit sim (1 AU = 10 units). Hyperbola: r = q(1+e)/(1+e cos θ)
const Q = 1.36, E = 6.14, PHI_P = 195;     // perihelion distance (AU), eccentricity, perihelion longitude (deg)
const DAY_TABLE = [[0, 0], [8, 55], [17, 108], [23, 120], [28, 131], [37, 171], [45, 198], [50, 212]];  // scene t -> day since Jul 1 2025
const THETA_TABLE = [[0, -80], [60, -70], [92, -55], [110, -30], [120, 0], [131, 26], [150, 43], [171, 52], [215, 66]]; // day -> true anomaly (deg)
const lin = (x, tab) => { for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [a, b] = [tab[i - 1], tab[i]]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return tab[tab.length - 1][1]; };
const cometAt = (theta) => { const th = C.rad(theta); const r = Q * (1 + E) / (1 + E * Math.cos(th)) * 10; const lon = C.rad(PHI_P - theta); return new THREE.Vector3(r * Math.cos(lon), 0, -r * Math.sin(lon)); };
const planetAt = (R, lon0, period, day) => { const l = C.rad(lon0 + 360 * day / period); return new THREE.Vector3(R * Math.cos(l), 0, -R * Math.sin(l)); };
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const dateStr = (day) => { const d = new Date(Date.UTC(2025, 6, 1) + day * 86400000); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };

export function build(ctx) {
  const scene = new THREE.Scene();
  scene.add(C.makeSpaceBackdrop(ctx, 3, { tilt: 0.5 }));
  const cam = new THREE.PerspectiveCamera(42, ctx.aspect, 0.1, 3000);

  const sun = C.makeSun(ctx, 1.5); scene.add(sun);
  scene.add(new THREE.AmbientLight(0x223355, 0.6));
  const sl = new THREE.PointLight(0xfff0dd, 600, 0, 1.6); scene.add(sl);

  const planets = [
    { n: 'Mercury', R: 3.9, lon: 80, P: 88, size: 0.22, col: 0xb0a090 }, { n: 'Venus', R: 7.2, lon: 220, P: 224.7, size: 0.38, col: 0xe6c88a },
    { n: 'Earth', R: 10, lon: 279, P: 365.25, size: 0.42, col: 0x4a8cff }, { n: 'Mars', R: 15.2, lon: 190, P: 687, size: 0.3, col: 0xd9694a },
  ];
  for (const p of planets) {
    scene.add(C.ringLine(p.R, { color: 0x7fb4ff, opacity: p.n === 'Earth' ? 0.4 : 0.2 }));
    p.mesh = new THREE.Mesh(new THREE.SphereGeometry(p.size, 24, 16), new THREE.MeshStandardMaterial({ color: p.col, roughness: 0.8, emissive: p.col, emissiveIntensity: 0.18 }));
    p.glow = C.makeGlow(p.col, p.size * 6, 0.5); p.mesh.add(p.glow); scene.add(p.mesh);
  }
  const earth = planets[2], mars = planets[3];

  // full comet path (faint) + travelled trail
  const full = []; for (let th = -78; th <= 72; th += 1.5) full.push(cometAt(th));
  scene.add(C.lineFromPoints(full, { color: 0x6fb0ff, opacity: 0.18 }));
  const trailGeo = new THREE.BufferGeometry(); const trailPts = new Float32Array(300 * 3); trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPts, 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffb36b, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })); trail.frustumCulled = false; scene.add(trail);

  const comet = C.makeComet(ctx, { R: 0.35, tail: 0.5, seed: 31, dustCount: 5000, ionCount: 2500 });
  const cometRoot = new THREE.Group(); cometRoot.add(comet.group); scene.add(cometRoot);
  const mark = (pos, col) => { const m = C.makeGlow(col, 1.6, 1.6); m.position.copy(pos); scene.add(m); return m; };
  const periPos = cometAt(0), closePos = cometAt(52);
  const periMark = mark(periPos, 0xffb36b), closeMark = mark(closePos, 0x7fe0ff);
  // earth<->comet line at closest approach
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const eLine = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: 0x7fe0ff, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); eLine.frustumCulled = false; scene.add(eLine);

  let curDay = 0, curTheta = -80; const cometPos = new THREE.Vector3(), earthPos = new THREE.Vector3();
  const cues = [
    { kind: 'title', at: 0.5, dur: 6.5, pos: 'tl', kicker: 'The route', text: 'Through our\nneighborhood', sub: 'Top-down view of the inner solar system' },
    { kind: 'chip', at: 0.5, dur: 49, pos: 'tr', text: (t) => `DATE  ${dateStr(lin(t, DAY_TABLE))}` },
    { kind: 'label', at: 0.3, dur: 49, anchor: () => sun.position, text: 'Sun', color: '#ffc27a', dy: -6, dx: 16 },
    { kind: 'label', at: 3, dur: 46, anchor: () => earth.mesh.position, text: 'Earth', color: '#6fb0ff', dx: 8, dy: -4 },
    { kind: 'label', at: 3, dur: 46, anchor: () => mars.mesh.position, text: 'Mars', color: '#ff8a6a', dx: 8, dy: -4 },
    { kind: 'label', at: 6, dur: 43, anchor: () => cometPos, text: '3I/ATLAS', color: '#9fe8ff', dx: 14, dy: -22 },
    { kind: 'label', at: 17.5, dur: 9, anchor: () => periPos, text: 'Perihelion · Oct 29, 2025', sub: '≈ 203 million km from the Sun — inside Mars’s orbit', color: '#ffb36b', dx: 16, dy: 12 },
    { kind: 'chip', at: 17.5, dur: 6, pos: 'bl', text: 'Closest to the Sun · ~1.36 AU', tone: 'warn' },
    { kind: 'label', at: 31.5, dur: 15, anchor: () => closePos, text: 'Closest to Earth · Dec 19', sub: '≈ 270 million km — no threat', color: '#7fe0ff', dx: 16, dy: 12 },
    { kind: 'stat', at: 33.5, dur: 9.5, pos: 'cr', from: 0, to: 270, countAt: 33.8, countDur: 2.2, suffix: ' M km', kicker: 'Distance to Earth', label: 'a safe 1.8 AU (about 700× the Moon’s distance)' },
    { kind: 'chip', at: 43.5, dur: 6, pos: 'bc', text: 'Watched by Webb · Hubble · Juice · Lucy · Mars orbiters', tone: 'ok' },
    { kind: 'source', at: 2, dur: 47, pos: 'src', text: 'Orbit schematic · distances from NASA/JPL data reported by USA Today, Smithsonian, Gemini' },
  ];

  const cp = new THREE.Vector3(), look = new THREE.Vector3(), sunDirTmp = new THREE.Vector3();
  return {
    scene, camera: cam, cues, bloom: { strength: 0.8, radius: 0.6, threshold: 0.8 }, exposure: 1.05,
    update(t) {
      curDay = lin(t, DAY_TABLE); curTheta = lin(curDay, THETA_TABLE);
      for (const p of planets) p.mesh.position.copy(planetAt(p.R, p.lon, p.P, curDay));
      cometPos.copy(cometAt(curTheta)); cometRoot.position.copy(cometPos);
      sunDirTmp.copy(cometPos).normalize(); comet.group.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), sunDirTmp);
      const r = cometPos.length() / 10; comet.set({ activity: C.clamp(1.7 / r, 0.35, 1.3) * 0.9 });
      comet.nucleus.rotation.y = t;
      // trail
      const n = 300; let c = 0; for (let i = 0; i < n; i++) { const th = C.lerp(-80, curTheta, i / (n - 1)); const p = cometAt(th); trailPts[c++] = p.x; trailPts[c++] = p.y; trailPts[c++] = p.z; }
      trailGeo.attributes.position.needsUpdate = true;
      periMark.visible = t > 15; periMark.material.opacity = 1; closeMark.visible = t > 30;
      earthPos.copy(earth.mesh.position);
      const showLine = curDay >= 171 - 2;
      eLine.visible = showLine; if (showLine) { eLine.geometry.setFromPoints([earthPos, cometPos]); eLine.computeLineDistances(); }
      // camera
      const dist = C.fitDist(C.kf(t, [[0, 84], [10, 70], [17, 46], [26, 46], [34, 52], [50, 58]]), ctx.aspect);
      const tilt = C.rad(C.kf(t, [[0, 58], [17, 44], [34, 52], [50, 60]])); const az = C.rad(C.kf(t, [[0, -30], [20, -10], [36, 8], [50, 20]]));
      const tgt = new THREE.Vector3(C.kf(t, [[0, 0], [17, -2], [34, -3], [50, 0]]), 0, C.kf(t, [[0, 0], [17, 4], [34, 4], [50, 0]]));
      cp.set(Math.sin(az) * Math.cos(tilt), Math.sin(tilt), Math.cos(az) * Math.cos(tilt)).multiplyScalar(dist).add(tgt);
      cam.position.copy(cp); cam.lookAt(tgt);
    },
  };
}
