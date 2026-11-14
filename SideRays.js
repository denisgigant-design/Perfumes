// Side Rays shader adapted from React Bits (David Haz). See LICENSE-react-bits.txt.
const PIXEL_BUDGET = 520_000;
const TAU = Math.PI * 2;

const ORIGINS = {
  'top-right': { flipX: 0, flipY: 0, side: 0 },
  'top-left': { flipX: 1, flipY: 0, side: 0 },
  'bottom-right': { flipX: 0, flipY: 1, side: 0 },
  'bottom-left': { flipX: 1, flipY: 1, side: 0 },
  right: { flipX: 0, flipY: 0, side: 1 },
  left: { flipX: 1, flipY: 0, side: 1 }
};

const VERTEX = `#version 300 es
const vec2 corners[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  gl_Position = vec4(corners[gl_VertexID], 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uBlend;
uniform float uIntensity;
uniform float uSpread;
uniform float uDensity;
uniform float uSharpness;
uniform float uFalloff;
uniform float uGlow;
uniform float uSaturation;
uniform float uDust;
uniform float uOpacity;
uniform float uReveal;
uniform float uLight;
uniform vec3 uFrame;
uniform float uAim;
uniform vec3 uFocus;
uniform float uSway;
out vec4 fragColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

float shafts(float u, float t, float seed, float aa) {
  float sway = (0.4 * sin(t * 0.31 + seed) + 0.24 * sin(t * 0.17 + seed * 2.3)) * uSway;
  float n = 0.7 * noise(vec2(u + sway + seed, t * 0.3)) + 0.3 * noise(vec2(u * 2.4 + sway * 1.5 + seed * 1.7, t * 0.45 + 3.0));
  float width = mix(0.5, 0.1, uSharpness);
  float s = mix(smoothstep(0.5 - width, 0.5 + width, n), 0.5, aa);
  return mix(0.05, 1.0, s);
}

float motes(vec2 p, float cell, float t, float seed) {
  p += vec2(t * 0.021, -t * 0.013) + seed * 7.31;
  vec2 grid = p / cell;
  vec2 id = floor(grid);
  vec2 f = grid - id;
  float h = hash(id + seed);
  if (h > 0.5) return 0.0;
  vec2 center = 0.25 + 0.5 * vec2(hash(id + 1.7 + seed), hash(id + 3.1 + seed));
  center += 0.1 * vec2(sin(t * 0.7 + h * 31.0), cos(t * 0.6 + h * 23.0));
  float size = mix(0.035, 0.09, hash(id + 5.3 + seed));
  float edge = length(fwidth(grid)) * 0.7;
  float twinkle = 0.55 + 0.45 * sin(t * 1.9 + h * 41.0);
  return (1.0 - smoothstep(size - edge, size + edge, length(f - center))) * twinkle;
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 q = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  if (uFrame.x > 0.5) q.x = -q.x;
  if (uFrame.y > 0.5) q.y = -q.y;
  vec2 source = uFrame.z > 0.5 ? vec2(aspect * 0.5 + 0.42, 0.3) : vec2(aspect * 0.5 + 0.1, 0.62);
  float heading = (uFrame.z > 0.5 ? 3.42 : -2.48) + uAim + 0.035 * sin(uTime * 0.21) * uSway;
  vec2 v = q - source;
  float r = length(v);
  float angle = mod(atan(v.y, v.x) - heading + 3.14159265, 6.28318531) - 3.14159265;
  float t = uTime;
  float u = angle * uDensity;
  float aa = smoothstep(0.12, 0.45, fwidth(u));
  float offset = uSpread * 0.22;
  float fanA = exp(-pow((angle + offset) / uSpread, 2.0) * 1.4);
  float fanB = exp(-pow((angle - offset) / (uSpread * 1.15), 2.0) * 1.4);
  float focus = 1.0 + uFocus.z * exp(-pow((angle - uFocus.x) / uFocus.y, 2.0));
  float lightA = fanA * shafts(u, t, 0.0, aa) * focus;
  float lightB = fanB * shafts(u * 0.83, t * 0.6, 17.0, aa) * focus;
  float reach = 1.0 / (1.0 + pow(r / 0.4, uFalloff));
  vec3 glowColor = mix(uColorA, uColorB, uBlend);
  vec3 light = (uColorA * lightA * (1.0 - uBlend) + uColorB * lightB * uBlend) * 2.0 * reach;
  light += glowColor * uGlow * exp(-pow(r / 0.4, 2.0));
  if (uDust > 0.0) {
    float sparkle = motes(q, 0.06, t, 0.0) + 0.7 * motes(q, 0.038, t * 0.8, 9.0);
    light += mix(glowColor, vec3(1.0), 0.6) * sparkle * (lightA + lightB) * reach * uDust * 2.5;
  }
  light *= uIntensity * (1.0 - smoothstep(uReveal * 2.6 - 0.45, uReveal * 2.6, r)) * smoothstep(0.0, 0.35, uReveal);
  float gray = dot(light, vec3(0.2126, 0.7152, 0.0722));
  light = max(mix(vec3(gray), light, uSaturation), 0.0);
  float peak = max(light.r, max(light.g, light.b));
  float grain = (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  if (uLight > 0.5) {
    vec3 ink = pow(light / max(peak, 1e-4), vec3(2.0)) * 0.75;
    float alpha = clamp(pow(1.0 - exp(-peak * 2.6), 2.5) * 0.9 * uOpacity + grain, 0.0, 1.0);
    fragColor = vec4(pow(ink, vec3(1.0 / 2.2)) * alpha, alpha);
    return;
  }
  float mapped = 1.0 - exp(-peak);
  vec3 tone = light * (mapped / max(peak, 1e-4));
  tone = mix(tone, vec3(mapped), smoothstep(0.7, 1.0, mapped) * 0.55);
  vec3 shown = clamp(tone * uOpacity, 0.0, 1.0);
  float alpha = max(shown.r, max(shown.g, shown.b));
  vec3 color = clamp(shown * alpha + grain, 0.0, 1.0);
  fragColor = vec4(min(color, vec3(alpha)), alpha);
}`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const wrapAngle = angle => ((((angle + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

const parseColor = value => {
  const text = String(value || '').trim();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const full = hex[1].length === 3 ? hex[1].replace(/./g, digit => digit + digit) : hex[1];
    return [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16) / 255);
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map(channel => clamp(parseFloat(channel) / 255, 0, 1));
  return [1, 1, 1];
};

const geometryFor = (frame, aspect) => ({
  source: frame.side ? [aspect * 0.5 + 0.42, 0.3] : [aspect * 0.5 + 0.1, 0.62],
  heading: frame.side ? 3.42 : -2.48
});

const compile = (gl, type, source) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const link = gl => {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = vertex && fragment ? gl.createProgram() : null;
  if (!vertex || !fragment || !program) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let index = 0; index < count; index++) {
    const info = gl.getActiveUniform(program, index);
    if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
};

const themes = {
  gallery: ['#ddba8f', '#94a9ca', .59],
  galet: ['#e7c487', '#b6dc78', .66],
  rose: ['#ebbaa0', '#e28ca2', .70],
  bleu: ['#c0d5f8', '#709ff2', .76],
  ambre: ['#ffe0a7', '#ffc068', .67]
};

export function mountSideRays(canvas) {
  const stage = canvas.parentElement;
  const gl = canvas.getContext('webgl2', {
    alpha: true, premultipliedAlpha: true, antialias: false, depth: false,
    stencil: false, powerPreference: 'low-power'
  });
  if (!gl) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const origin = ORIGINS['top-right'];
  const pointer = {x: .5, y: .5, inside: false};
  const colorA = parseColor(themes.gallery[0]);
  const colorB = parseColor(themes.gallery[1]);
  let state, targetA = colorA.slice(), targetB = colorB.slice(), blend = .64, targetBlend = blend;
  let gpu, vao, raf = 0, last = 0, time = 9.2, aim = 0, focus = 0;
  let visible = true, dirty = true, lost = false;
  const frameInterval = 1000 / 30;

  function init() {
    gpu = link(gl);
    if (!gpu) return false;
    vao = gl.createVertexArray();
    if (!vao) {
      gl.deleteProgram(gpu.program);
      gpu = null;
      return false;
    }
    return true;
  }

  function schedule() {
    if (!gpu || lost || !visible || document.hidden || raf) return;
    raf = requestAnimationFrame(draw);
  }

  function draw(now) {
    raf = 0;
    if (!visible || document.hidden || lost) return;
    if (!dirty && last && now - last < frameInterval - 2) {
      schedule();
      return;
    }
    const dt = last ? clamp((now - last) / 1000, 0, .05) : .016;
    last = now;
    const still = reduced.matches;
    if (dirty) {
      const w = Math.max(canvas.clientWidth, 1);
      const h = Math.max(canvas.clientHeight, 1);
      const scale = Math.min(1, devicePixelRatio || 1, Math.sqrt(PIXEL_BUDGET / (w * h)));
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      dirty = false;
    }
    const selected = stage.dataset.state === 'gallery' ? stage.dataset.checkpoint ?? 'gallery' : stage.dataset.state;
    if (state !== selected) {
      state = selected;
      const theme = themes[state] ?? themes.gallery;
      targetA = parseColor(theme[0]);
      targetB = parseColor(theme[1]);
      targetBlend = theme[2];
    }

    const ease = still ? 1 : 1 - Math.exp(-dt * 4.2);
    for (let i = 0; i < 3; i++) {
      colorA[i] += (targetA[i] - colorA[i]) * ease;
      colorB[i] += (targetB[i] - colorB[i]) * ease;
    }
    blend += (targetBlend - blend) * ease;
    const aspect = canvas.width / canvas.height;
    const {source, heading} = geometryFor(origin, aspect);
    const tracking = pointer.inside && !still;
    const pointed = tracking ? wrapAngle(Math.atan2(.5 - pointer.y - source[1],
      (pointer.x - .5) * aspect - source[0]) - heading) : 0;
    const perspective = Number(stage.dataset.progress || 0);
    const tilt = (perspective - .5) * .12;
    const targetAim = tracking ? clamp(pointed - tilt, -.5, .5) * .66 : 0;
    aim += (targetAim - aim) * ease;
    focus += ((tracking ? .45 : 0) - focus) * ease;
    if (!still) time += dt * .64;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(gpu.program);
    gl.bindVertexArray(vao);
    const u = gpu.uniforms;
    gl.uniform2f(u.uResolution, canvas.width, canvas.height);
    gl.uniform1f(u.uTime, time);
    gl.uniform3f(u.uColorA, ...colorA);
    gl.uniform3f(u.uColorB, ...colorB);
    gl.uniform1f(u.uBlend, blend);
    gl.uniform1f(u.uIntensity, stage.dataset.state === 'gallery' ? 1.08 : 1.51);
    gl.uniform1f(u.uSpread, .51);
    gl.uniform1f(u.uDensity, 5.8);
    gl.uniform1f(u.uSharpness, .58);
    gl.uniform1f(u.uFalloff, 1.38);
    gl.uniform1f(u.uGlow, .65);
    gl.uniform1f(u.uSaturation, .91);
    gl.uniform1f(u.uDust, 0);
    gl.uniform1f(u.uOpacity, .99);
    gl.uniform1f(u.uReveal, 1);
    gl.uniform1f(u.uLight, 0);
    gl.uniform3f(u.uFrame, origin.flipX, origin.flipY, origin.side);
    gl.uniform1f(u.uAim, tilt + aim);
    gl.uniform3f(u.uFocus, clamp(pointed - aim - tilt, -.73, .73), .18, focus);
    gl.uniform1f(u.uSway, still ? 0 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!still) schedule();
  }

  function resize() {
    dirty = true;
    schedule();
  }
  function move(event) {
    if (reduced.matches) return;
    const bounds = stage.getBoundingClientRect();
    pointer.x = (event.clientX - bounds.left) / Math.max(bounds.width, 1);
    pointer.y = (event.clientY - bounds.top) / Math.max(bounds.height, 1);
    pointer.inside = pointer.x >= 0 && pointer.x <= 1 && pointer.y >= 0 && pointer.y <= 1;
    schedule();
  }
  function leave() {
    pointer.inside = false;
    schedule();
  }
  function release(event) {
    if (event.pointerType !== 'mouse') leave();
  }

  if (!init()) return;
  const dimensions = new ResizeObserver(resize);
  dimensions.observe(stage);
  const viewport = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  });
  viewport.observe(stage);
  stage.addEventListener('pointermove', move, {passive: true});
  stage.addEventListener('pointerdown', move, {passive: true});
  stage.addEventListener('pointerleave', leave);
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', leave);
  window.addEventListener('perfume-progress', schedule);
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', resize);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(raf);
    raf = 0;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = !init();
    resize();
  });
  schedule();
}

const canvas = document.querySelector('#side-rays');
if (canvas) mountSideRays(canvas);
