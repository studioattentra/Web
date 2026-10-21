/* =========================================================
   Scenes — WebGL backdrops built on Three.js
   One shared fragment shader, several looks:
     hero   · flowing silk dunes, horizon water, light beam, dust
     water  · rippled surface used behind the service cards
     silk   · soft folds behind the statistics band
     office · glass panels and dusk glow for the about image
     smoke  · slow vapour for the call-to-action panel
   ========================================================= */

import * as THREE from '../vendor/three.module.min.js';

const PALETTE = {
  teal: new THREE.Color('#004B49'),
  sage: new THREE.Color('#B7C7A3'),
  ivory: new THREE.Color('#F6F5EF'),
  charcoal: new THREE.Color('#1F2523'),
};

const VARIANTS = { hero: 0, water: 1, silk: 2, office: 3, smoke: 4 };

const VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */`
  precision highp float;

  uniform float uTime;
  uniform vec2  uRes;
  uniform vec2  uMouse;
  uniform float uSeed;
  uniform float uVariant;
  uniform float uIntensity;
  uniform vec3  uTeal;
  uniform vec3  uSage;
  uniform vec3  uIvory;
  uniform vec3  uCharcoal;

  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
  }

  /* Flowing silk: slow domain-warped folds with soft specular crests */
  vec3 silk(vec2 uv, float t, float scale, out float ridge, out float height) {
    float aspect = uRes.x / uRes.y;
    vec2 p = uv * vec2(aspect, 1.0) * scale + uSeed;

    vec2 q = vec2(fbm(p * 0.6 + t * 0.03), fbm(p * 0.6 + vec2(5.2, 1.3) - t * 0.025));
    vec2 r = vec2(
      fbm(p * 0.8 + 2.0 * q + vec2(1.7, 9.2) + 0.05 * t),
      fbm(p * 0.8 + 2.0 * q + vec2(8.3, 2.8) - 0.04 * t)
    );
    float f = fbm(p + 2.5 * r);
    height = f;

    // broad satin folds sweeping diagonally
    float wave  = 0.5 + 0.5 * sin((p.x * 0.55 - p.y * 1.15) * 3.0 + f * 9.0 + r.y * 4.0 + t * 0.12);
    float wave2 = 0.5 + 0.5 * sin((p.x * 1.1 + p.y * 0.4) * 2.0 - f * 6.0 + r.x * 3.0 - t * 0.08);
    float crest = pow(wave, 7.0) * 0.8 + pow(wave2, 10.0) * 0.4;
    ridge = crest;

    float shade = smoothstep(0.12, 0.92, f);
    vec3 col = mix(uCharcoal * 0.55, uTeal * 1.3, shade);
    col = mix(col, uTeal * 2.3, pow(shade, 1.6) * (0.35 + 0.65 * wave));
    col += mix(uSage, uIvory, 0.35) * crest * 0.6 * (0.35 + 0.65 * shade);

    // fine thread texture
    float thread = 0.5 + 0.5 * sin((f + r.x * 0.4) * 46.0 + t * 0.2);
    col += uSage * pow(thread, 10.0) * 0.07;
    return col;
  }

  vec3 render(vec2 uv, float t) {
    float aspect = uRes.x / uRes.y;
    vec3 col = vec3(0.0);
    float ridge, height;

    /* --------------------------------------------------------- hero */
    if (uVariant < 0.5) {
      float yh = 0.32;                                    // horizon
      float bx = 0.615 + uMouse.x * 0.01;                 // beam x

      vec2 puv = uv + uMouse * vec2(0.018, 0.012);

      if (uv.y > yh) {
        vec2 suv = vec2(puv.x, (puv.y - yh) / (1.0 - yh));
        col = silk(suv * vec2(1.0, 0.9), t, 1.0, ridge, height);
        float sky = smoothstep(0.35, 1.0, suv.y);
        col *= mix(1.0, 0.45, sky);                        // darken toward the top
      } else {
        // reflection in still water with slow ripples
        float d = (yh - uv.y);
        float ripple = sin(uv.y * 160.0 + t * 1.4 + fbm(uv * 6.0 + t * 0.2) * 6.0) * 0.004;
        float ripple2 = fbm(vec2(uv.x * 9.0, uv.y * 40.0 - t * 0.5)) - 0.5;
        vec2 ruv = vec2(puv.x + ripple + ripple2 * 0.012 * d, yh + d * 1.15);
        vec2 suv = vec2(ruv.x, (ruv.y - yh) / (1.0 - yh));
        col = silk(suv * vec2(1.0, 0.9), t, 1.0, ridge, height);
        col *= mix(1.0, 0.6, smoothstep(0.0, 0.05, d));          // soft edge into the water
        col = mix(col, uCharcoal * 0.5, smoothstep(0.0, 0.32, d) * 0.45);
        // glint streak under the beam
        float glint = exp(-abs(uv.x - bx) * aspect * 7.0) * exp(-d * 9.0);
        glint *= 0.55 + 0.45 * noise(vec2(uv.x * 90.0, uv.y * 30.0 - t * 2.0));
        col += mix(uSage, uIvory, 0.6) * glint * 0.9;
        float shimmer = pow(max(0.0, ripple2 + 0.5), 6.0) * exp(-d * 5.0) * 0.25;
        col += uIvory * shimmer;
      }

      // horizon haze
      float haze = exp(-abs(uv.y - yh) * 28.0);
      col += uTeal * 1.6 * haze * 0.35;

      // volumetric beam
      float shaft = exp(-pow((uv.x - bx) * aspect * 44.0, 2.0));
      float glow  = exp(-pow((uv.x - bx) * aspect * 5.5, 2.0)) * 0.22;
      float wide  = exp(-pow((uv.x - bx) * aspect * 1.8, 2.0)) * 0.08;
      float vmask = smoothstep(yh - 0.08, yh + 0.25, uv.y) * (1.0 - smoothstep(0.75, 1.05, uv.y));
      float flicker = 0.78 + 0.22 * fbm(vec2(uv.y * 3.0 - t * 0.6, t * 0.2));
      vec3 beamCol = mix(uIvory, uSage, 0.35);
      col += beamCol * (shaft * 0.9 + glow + wide) * vmask * flicker;
      // light spilling onto the water below the beam
      col += beamCol * exp(-pow((uv.x - bx) * aspect * 3.0, 2.0)) * exp(-(yh - uv.y) * 10.0) * step(uv.y, yh) * 0.18;

      // drifting mist
      float mist = fbm(vec2(uv.x * 2.4 - t * 0.05, uv.y * 3.0 + t * 0.02));
      col += uTeal * 1.4 * mist * 0.12;

      // keep the copy on the left legible
      col *= mix(0.5, 1.0, smoothstep(0.0, 0.6, uv.x));
      float vig = 1.0 - 0.55 * pow(length((uv - vec2(0.55, 0.5)) * vec2(1.25, 1.6)), 2.2);
      col *= clamp(vig, 0.0, 1.0);
    }

    /* -------------------------------------------------------- water */
    else if (uVariant < 1.5) {
      float yh = 0.72;
      if (uv.y > yh) {
        vec2 suv = vec2(uv.x, (uv.y - yh) / (1.0 - yh));
        col = silk(suv, t, 1.2, ridge, height) * 0.5;
      } else {
        float d = (yh - uv.y);
        float ripple = fbm(vec2(uv.x * 7.0, uv.y * 36.0 - t * 0.45)) - 0.5;
        vec2 ruv = vec2(uv.x + ripple * 0.02 * d, yh + d * 1.05);
        vec2 suv = vec2(ruv.x, (ruv.y - yh) / (1.0 - yh));
        col = silk(suv, t, 1.2, ridge, height) * 0.5;
        col += uIvory * pow(max(0.0, ripple + 0.5), 7.0) * exp(-d * 2.5) * 0.3;
        col += uTeal * 1.5 * exp(-d * 4.0) * 0.2;
        col = mix(col, uCharcoal * 0.4, smoothstep(0.0, 0.7, d) * 0.6);
      }
      col += uTeal * 1.6 * exp(-abs(uv.y - yh) * 30.0) * 0.3;
      col *= 1.0 - 0.5 * pow(length((uv - 0.5) * vec2(1.3, 1.0)), 2.0);
    }

    /* --------------------------------------------------------- silk */
    else if (uVariant < 2.5) {
      col = silk(uv * vec2(1.0, 1.4), t * 0.8, 1.0, ridge, height) * 0.7;
      col *= 1.0 - 0.55 * pow(length((uv - 0.5) * vec2(1.4, 1.0)), 2.0);
    }

    /* ------------------------------------------------------- office */
    else if (uVariant < 3.5) {
      vec3 base = silk(uv * vec2(0.7, 1.0), t * 0.35, 1.3, ridge, height) * 0.55;
      // dusk glow band behind glass
      float band = exp(-pow((uv.y - 0.52) * 4.5, 2.0));
      vec3 warm = mix(uIvory, uSage, 0.5);
      base += warm * band * 0.28 * (0.6 + 0.4 * fbm(vec2(uv.x * 3.0 + t * 0.05, uv.y * 2.0)));
      // glass panels
      float panels = step(0.94, fract(uv.x * 7.0 + 0.3));
      float mull  = step(0.985, fract(uv.y * 5.0));
      base *= 1.0 - panels * 0.6 - mull * 0.4;
      // skyline silhouettes
      float sky = fbm(vec2(uv.x * 12.0 + uSeed, 1.0));
      float skyline = step(uv.y, 0.36 + sky * 0.14) * step(0.25, uv.y);
      base = mix(base, uCharcoal * 0.35, skyline * 0.8);
      // floor reflection
      float floorMask = smoothstep(0.26, 0.0, uv.y);
      base = mix(base, base * 0.5 + warm * band * 0.1, floorMask);
      // interior light shaft on the left
      float shaft = exp(-pow((uv.x - 0.12) * 60.0, 2.0)) * (0.7 + 0.3 * sin(t * 0.8));
      base += uIvory * shaft * 0.7;
      col = base;
      col *= 1.0 - 0.6 * pow(length((uv - vec2(0.5, 0.5)) * vec2(1.2, 1.2)), 2.4);
    }

    /* -------------------------------------------------------- smoke */
    else if (uVariant < 4.5) {
      float aspect2 = uRes.x / uRes.y;
      vec2 p = uv * vec2(aspect2, 1.0) * 1.1 + uSeed;
      vec2 q = vec2(fbm(p + t * 0.04), fbm(p + vec2(3.1, 7.7) - t * 0.03));
      vec2 r = vec2(fbm(p + 2.6 * q + t * 0.05), fbm(p + 2.6 * q + vec2(4.0, 2.0)));
      float f = fbm(p + 2.4 * r);
      float wisp = pow(smoothstep(0.35, 0.8, f), 1.8);
      col = mix(uCharcoal * 0.35, uTeal * 1.1, smoothstep(0.2, 0.7, f));
      col += mix(uSage, uIvory, 0.4) * wisp * 0.45 * (0.5 + 0.5 * r.y);
      col *= 1.0 - 0.45 * pow(length((uv - 0.5) * vec2(1.1, 1.3)), 2.0);
    }

    /* -------------------------------------------------------- still */
    else {
      float aspect2 = uRes.x / uRes.y;
      vec2 p = uv * vec2(aspect2, 1.0) * 1.4 + uSeed;
      vec2 q = vec2(fbm(p), fbm(p + vec2(3.1, 7.7)));
      vec2 r = vec2(fbm(p + 2.8 * q), fbm(p + 2.8 * q + vec2(4.0, 2.0)));
      float f = fbm(p + 2.6 * r);
      float wisp = pow(smoothstep(0.4, 0.85, f), 2.0);
      col = mix(uCharcoal * 0.4, uTeal * 1.2, smoothstep(0.15, 0.75, f));
      col += mix(uSage, uIvory, 0.5) * wisp * 0.5;
      // light from one corner
      vec2 lp = vec2(0.2 + 0.6 * fract(uSeed * 0.37), 0.8);
      col += uIvory * exp(-length((uv - lp) * vec2(1.4, 1.0)) * 3.0) * 0.18;
      col *= 1.0 - 0.5 * pow(length((uv - 0.5) * vec2(1.1, 1.2)), 2.0);
    }

    // film-like grain
    float g = hash(uv * uRes + fract(t)) - 0.5;
    col += g * 0.025;

    return col * uIntensity;
  }

  void main() {
    vec3 col = render(vUv, uTime);
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ---------------------------------------------------------- dust */
const DUST_VERTEX = /* glsl */`
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float t = uTime * 0.08 + aPhase;
    p.y = mod(p.y + t * 0.25, 2.2) - 1.1;
    p.x += sin(t * 1.3 + aPhase * 7.0) * 0.03;
    vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 0.9 + aPhase * 12.0));
    gl_Position = vec4(p.xy, 0.0, 1.0);
    gl_PointSize = aSize * uPixelRatio;
  }
`;

const DUST_FRAGMENT = /* glsl */`
  precision mediump float;
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vAlpha;
    gl_FragColor = vec4(uColor, a * 0.55);
  }
`;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = window.matchMedia('(max-width: 820px)').matches;

function makeUniforms(variant, seed, intensity) {
  return {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uSeed: { value: seed },
    uVariant: { value: variant },
    uIntensity: { value: intensity },
    uTeal: { value: PALETTE.teal },
    uSage: { value: PALETTE.sage },
    uIvory: { value: PALETTE.ivory },
    uCharcoal: { value: PALETTE.charcoal },
  };
}

function makeQuad(uniforms) {
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, depthTest: false, depthWrite: false });
  return new THREE.Mesh(geo, mat);
}

/* ---------------------------------------------------- live scene */
class LiveScene {
  constructor(canvas, { variant, seed = 0, intensity = 1, dpr = 1, dust = false, mouse = false }) {
    this.canvas = canvas;
    this.dpr = Math.min(window.devicePixelRatio || 1, dpr);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.dpr);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.uniforms = makeUniforms(variant, seed, intensity);
    this.scene.add(makeQuad(this.uniforms));
    this.clock = new THREE.Clock();
    this.visible = true;
    this.running = false;
    this.mouseTarget = new THREE.Vector2();
    this.mouseCurrent = new THREE.Vector2();

    if (dust) this.addDust();
    if (mouse) this.bindMouse();

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement || canvas);

    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible) this.start(); else this.stop();
    }, { rootMargin: '120px' });
    this.io.observe(canvas);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop(); else if (this.visible) this.start();
    });
  }

  addDust() {
    const count = isSmall ? 90 : 220;
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * 2 - 1;
      pos[i * 3 + 1] = Math.random() * 2.2 - 1.1;
      pos[i * 3 + 2] = 0;
      size[i] = 1 + Math.pow(Math.random(), 3) * 3.2;
      phase[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.dustUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: this.dpr },
      uColor: { value: PALETTE.ivory },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.dustUniforms,
      vertexShader: DUST_VERTEX,
      fragmentShader: DUST_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.scene.add(new THREE.Points(geo, mat));
  }

  bindMouse() {
    window.addEventListener('pointermove', (e) => {
      this.mouseTarget.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    }, { passive: true });
  }

  resize() {
    const parent = this.canvas.parentElement || this.canvas;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    this.renderer.setSize(w, h, false);
    this.uniforms.uRes.value.set(w * this.dpr, h * this.dpr);
    if (!this.running) this.render();
  }

  render() {
    const t = this.clock.getElapsedTime();
    this.uniforms.uTime.value = prefersReducedMotion ? 0 : t;
    this.mouseCurrent.lerp(this.mouseTarget, 0.04);
    this.uniforms.uMouse.value.copy(this.mouseCurrent);
    if (this.dustUniforms) this.dustUniforms.uTime.value = t;
    this.renderer.render(this.scene, this.camera);
  }

  loop = () => {
    if (!this.running) return;
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  start() {
    if (this.running || prefersReducedMotion) { if (prefersReducedMotion) this.render(); return; }
    this.running = true;
    this.clock.start();
    this.loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}

/* ------------------------------------------------------ bootstrap */
function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) { return false; }
}

function init() {
  if (!supportsWebGL()) {
    document.documentElement.classList.add('no-webgl');
    return;
  }

  const hero = document.getElementById('heroCanvas');
  if (hero) {
    const scene = new LiveScene(hero, {
      variant: VARIANTS.hero,
      seed: 3.7,
      intensity: 1,
      dpr: isSmall ? 1 : 1.35,
      dust: true,
      mouse: true,
    });
    scene.start();
    requestAnimationFrame(() => hero.classList.add('is-ready'));
  }

  const config = {
    water:  { variant: VARIANTS.water,  seed: 8.1,  intensity: 1,    dpr: 0.75 },
    silk:   { variant: VARIANTS.silk,   seed: 12.4, intensity: 0.95, dpr: 0.75 },
    office: { variant: VARIANTS.office, seed: 2.2,  intensity: 1,    dpr: 0.9 },
    smoke:  { variant: VARIANTS.smoke,  seed: 21.9, intensity: 1,    dpr: 0.75 },
  };

  document.querySelectorAll('canvas[data-scene]').forEach((canvas) => {
    const key = canvas.dataset.scene;
    const opts = config[key];
    if (!opts) return;
    new LiveScene(canvas, opts);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
