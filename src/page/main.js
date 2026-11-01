import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UI, Captions } from './ui.js';
import { makeCtxUniforms, smooth } from './common.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 1920, H = +q.get('h') || 1080;
document.documentElement.style.fontSize = (16 * Math.min(W, H) / 1080) + 'px';
if (H > W) document.body.classList.add('portrait');

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const U = makeCtxUniforms(H);

const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: H > 1500 ? 2 : 4 });
const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(W, H);
const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.8, 0.6, 0.85);
const finalPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.55 }, uRes: { value: new THREE.Vector2(W, H) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime,uVig; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))+uTime*7.1)*43758.5453); }
    void main(){ vec2 c=vUv-0.5; float r=dot(c,c);
      vec2 off=c*r*0.006; vec3 col=vec3(texture2D(tDiffuse,vUv+off).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-off).b);
      col*=1.0-uVig*smoothstep(0.12,0.62,r*1.6);
      float n=(h(vUv*uRes)+h(vUv*uRes+7.3)-1.0); col+=n*(1.6/255.0); gl_FragColor=vec4(col,1.0); }`,
});
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(finalPass);

const ui = new UI(document.getElementById('ui'), W, H);
const caps = new Captions(document.getElementById('caps'));
const fadeEl = document.getElementById('fade');
let S = null, opts = null;

window.__init = async (o) => {
  opts = o;
  const mod = await import(`./scenes/${o.scene}.js`);
  const ctx = { THREE, renderer, W, H, aspect: W / H, portrait: H > W, U };
  S = mod.build(ctx);
  S.camera.aspect = W / H; S.camera.updateProjectionMatrix();
  renderPass.scene = S.scene; renderPass.camera = S.camera;
  const b = S.bloom || {}; bloom.strength = b.strength ?? 0.8; bloom.radius = b.radius ?? 0.6; bloom.threshold = b.threshold ?? 0.85;
  renderer.toneMappingExposure = S.exposure ?? 1;
  finalPass.uniforms.uVig.value = S.vignette ?? 0.55;
  ui.setCues(S.cues || []); caps.set(o.captions || []);
  document.fonts && await document.fonts.ready;
  return { ok: true };
};

window.__frame = (t, g) => {
  U.uTime.value = t; finalPass.uniforms.uTime.value = (t * 29.97) % 1.0;
  S.update(t); S.camera.updateMatrixWorld();
  composer.render();
  ui.update(t, S.camera); caps.update(g);
  const d = 0.45; let f = 1;
  if (opts.fadeIn) f = Math.min(f, smooth((t - opts.t0) / d));
  if (opts.fadeOut) f = Math.min(f, smooth((opts.t1 - t) / d));
  for (const dp of (S.dips || [])) { const k = 1 - Math.abs((t - dp.at) / (dp.dur / 2)); if (k > 0) f = Math.min(f, 1 - smooth(k)); }
  fadeEl.style.opacity = String(1 - f);
  return true;
};
window.__ready = true;
