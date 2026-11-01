import * as THREE from 'three';
import * as C from '../common.js';

export function build(ctx) {
  const scene = new THREE.Scene();
  scene.add(C.makeSpaceBackdrop(ctx, 11, { tilt: 0.8 }));
  const cam = new THREE.PerspectiveCamera(40, ctx.aspect, 0.1, 3000);
  const port = ctx.aspect < 1;
  const sunDir = new THREE.Vector3(1, 0.25, 0.55);
  const earth = C.makeEarth(ctx, { R: 6, sunDir }); earth.position.set(port ? 0 : -6, port ? -6 : -7.5, 0); scene.add(earth);
  const comet = C.makeComet(ctx, { R: 0.5, tail: 1.0, seed: 111 }); comet.group.rotation.y = Math.PI; scene.add(comet.group);
  const L = new THREE.DirectionalLight(0xfff0dd, 3); L.position.copy(sunDir); scene.add(L); scene.add(new THREE.AmbientLight(0x223355, 0.5));
  const sunGlow = C.makeGlow(0xffd9a0, 140, 1.4); sunGlow.position.set(260, 70, -120); scene.add(sunGlow);
  const cues = [
    { kind: 'title', at: 0.5, dur: 8.4, pos: 'tl', kicker: 'Deep space report', text: 'TWO MYSTERIES.\nONE UNIVERSE.' },
    { kind: 'chip', at: 4.2, dur: 6.3, pos: 'bl', text: '3I/ATLAS · 10–12 billion years old' },
    { kind: 'chip', at: 5.4, dur: 5.2, pos: 'br', text: 'Beta Pictoris b · radio from 63 ly', tone: 'ok' },
    { kind: 'title', at: 10.3, dur: 9.4, pos: 'lc', text: 'WHICH BLEW YOUR\nMIND MORE?', sub: 'Tell me in the comments ↓' },
    { kind: 'chip', at: 11.8, dur: 8, pos: 'bc', text: 'Subscribe · Follow for more space science', tone: 'ok' },
    { kind: 'source', at: 2, dur: 17.5, pos: 'src', text: 'Sources: NASA/ESA/CSA/STScI · Nature · arXiv · CNN · Science News · Smithsonian · EarthSky' },
  ];
  return {
    scene, camera: cam, cues, bloom: { strength: 0.8, radius: 0.7, threshold: 0.8 },
    update(t) {
      earth.rotation.y = t * 0.03;
      const k = C.smooth(t / 20); comet.group.position.set(C.lerp(10, 26, k), C.lerp(5, 12, k), C.lerp(-14, -50, k)); comet.set({ activity: 0.9 - 0.5 * k });
      cam.position.set(port ? 0 : -1, port ? 1 : -1.5, C.fitDist(26, ctx.aspect) - t * 0.15); cam.lookAt(port ? 0 : 2, port ? 2 : 0, 0);
    },
  };
}
