// Beta Pictoris b stage: banded gas giant, dipole field lines with particles, aurora curtains, radio wave shells.
import * as THREE from 'three';
import * as C from './common.js';

export function makeExoplanet(ctx, { R = 3, tilt = 0.35 } = {}) {
  const group = new THREE.Group();
  const planet = C.makeGasGiant(ctx, { R, sunDir: new THREE.Vector3(1, 0.25, 0.4) }); group.add(planet);
  const mag = new THREE.Group(); mag.rotation.z = tilt; group.add(mag);

  // dipole field lines
  const lines = []; const mat = new THREE.LineBasicMaterial({ color: 0x57c8ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const L of [1.9, 2.5, 3.2, 4.1, 5.3]) for (let k = 0; k < 8; k++) {
    const phi = k / 8 * Math.PI * 2 + L; const th0 = Math.asin(Math.sqrt(1 / L)) + 0.02; const pts = [];
    for (let i = 0; i <= 60; i++) { const th = th0 + (Math.PI - 2 * th0) * i / 60; const r = L * R * Math.sin(th) ** 2; pts.push(new THREE.Vector3(r * Math.sin(th) * Math.cos(phi), r * Math.cos(th), r * Math.sin(th) * Math.sin(phi))); }
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat); mag.add(ln); lines.push(pts);
  }
  // particles gliding along lines (speed ∝ time)
  const nP = lines.length * 3; const pg = new THREE.BufferGeometry(); const ppos = new Float32Array(nP * 3); pg.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  const pm = new THREE.PointsMaterial({ size: R * 0.14, map: C.glowTexture(), color: new THREE.Color(1.4, 2.2, 2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const parts = new THREE.Points(pg, pm); parts.frustumCulled = false; mag.add(parts);

  // aurora curtains
  const auroraMat = new THREE.ShaderMaterial({
    uniforms: { uTime: ctx.U.uTime, uI: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; varying vec3 vP; void main(){ vUv=uv; vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: C.GLSL_NOISE + /* glsl */`
      uniform float uTime,uI; varying vec2 vUv; varying vec3 vP;
      void main(){ float a=atan(vP.z,vP.x); float rip=0.5+0.5*sin(a*14.0+uTime*1.6+fbm(vec3(a*3.0,uTime*0.3,0.))*6.0); float cur=pow(rip,1.5)*(0.55+0.45*fbm(vec3(a*6.0,vUv.y*3.0,uTime*0.5)));
        float v=vUv.y; float prof=smoothstep(0.0,0.12,v)*pow(1.0-v,1.3); vec3 col=mix(vec3(0.15,1.0,0.55),vec3(0.8,0.2,1.0),smoothstep(0.35,1.0,v));
        float al=cur*prof*uI; gl_FragColor=vec4(col*al*2.2,al); }`,
  });
  const cur = (y, flip) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.5, R * 0.34, R * 0.55, 128, 1, true), auroraMat); m.position.y = y; if (flip) m.rotation.x = Math.PI; return m; };
  mag.add(cur(R * 0.93, false), cur(-R * 0.93, true));

  // radio shells
  const shellMat = (i) => new THREE.ShaderMaterial({
    uniforms: { uO: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform float uO; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.0-abs(dot(vN,vV)),2.6); gl_FragColor=vec4(vec3(0.3,0.75,1.5)*f*uO,f*uO); }',
  });
  const shells = [0, 1, 2, 3].map((i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 56, 36), shellMat(i)); group.add(m); return m; });

  return {
    group, planet, mag, R,
    update(t, { aurora = 0, shellsOn = 0, fieldOn = 1, spin = 0.25 } = {}) {
      planet.rotation.y = t * spin; auroraMat.uniforms.uI.value = aurora; mat.opacity = 0.22 * fieldOn; pm.opacity = fieldOn;
      const pa = pg.attributes.position;
      for (let i = 0; i < nP; i++) { const ln = lines[Math.floor(i / 3)]; const s = ((t * (0.07 + 0.01 * (i % 5)) + i * 0.37) % 1 + 1) % 1; const idx = Math.min(59, Math.floor(s * 60)); const p = ln[idx]; pa.setXYZ(i, p.x, p.y, p.z); }
      pa.needsUpdate = true;
      shells.forEach((m, i) => { const k = (((t / 4.2) + i / 4) % 1 + 1) % 1; const r = R * (1.15 + k * 12); m.scale.setScalar(r); m.material.uniforms.uO.value = shellsOn * (1 - k) * Math.min(1, k * 6) * 0.9; m.visible = shellsOn > 0.01; });
    },
  };
}
