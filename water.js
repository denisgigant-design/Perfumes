import {Color, PlaneGeometry, Reflector, Vector3} from './three-showroom.js?v=2';

const source = Reflector.ReflectorShader;
const waterShader = {
  name: 'Midnight water',
  uniforms: {
    ...source.uniforms,
    clock: {value: 0},
    pools: {value: Array.from({length: 4}, () => new Vector3())},
    poolColors: {value: Array.from({length: 4}, () => new Color())}
  },
  vertexShader: source.vertexShader
    .replace('varying vec4 vUv;', 'varying vec4 vUv; varying vec3 vSurface;')
    .replace('vUv = textureMatrix', 'vSurface = (modelMatrix * vec4(position, 1.0)).xyz;\n vUv = textureMatrix'),
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float clock;
    uniform vec3 pools[4];
    uniform vec3 poolColors[4];
    varying vec4 vUv;
    varying vec3 vSurface;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec2 p = vSurface.xz;
      float a = sin(dot(p, vec2(2.4, 7.8)) + clock * 2.2);
      float b = sin(dot(p, vec2(-5.1, 6.7)) - clock * 1.48 + a * 0.72);
      float c = sin(dot(p, vec2(8.9, 13.2)) + clock * 2.87);
      vec2 ripple = vec2(a * 0.6 + c * 0.22, b + c * 0.37);
      vec3 eye = normalize(cameraPosition - vSurface);
      float grazing = pow(1.0 - clamp(eye.y, 0.0, 1.0), 3.0);
      vec2 uv = vUv.xy / vUv.w + ripple * (0.0095 + grazing * 0.007);
      vec2 edge = min(uv, 1.0 - uv);
      float valid = smoothstep(0.0, 0.076, min(edge.x, edge.y));
      vec3 mirrored = texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb * valid;
      vec3 glints = vec3(0.0);
      float slope = smoothstep(0.56, 0.97, a * b * 0.66 + c * 0.24);
      for (int i = 0; i < 4; ++i) {
        vec2 q = p - pools[i].xy;
        vec2 streak = vec2(q.x * 0.62, q.y * 0.92);
        float drop = exp(-dot(streak, streak) * 0.24);
        float shine = pow(max(0.0, 0.5 + 0.5 * sin(14.0 * length(q) - clock * 1.6 + b)), 4.0);
        glints += poolColors[i] * drop * pools[i].z * (0.019 + 0.128 * shine * slope);
      }
      float fade = 1.0 - smoothstep(14.0, 34.0, length(p));
      vec3 surface = vec3(0.0018, 0.0028, 0.0041) + glints;
      surface += mirrored * (0.78 + 0.18 * grazing);
      gl_FragColor = vec4(surface * fade, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `
};

export function makeWater(renderer, compact) {
  const size = compact ? 336 : 768;
  const surface = new Reflector(new PlaneGeometry(72, 62), {
    textureWidth: size, textureHeight: size, multisample: 0, clipBias: 0.002, shader: waterShader
  });
  // UnsignedByteType keeps the reflection framebuffer available on mobile GPUs without float colour targets.
  if (compact || !renderer.extensions.has('EXT_color_buffer_float')) {
    surface.getRenderTarget().texture.type = 1009;
  }
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = -5.79;
  const renderReflection = surface.onBeforeRender.bind(surface);
  let last = -Infinity;
  surface.onBeforeRender = (activeRenderer, scene, camera, ...rest) => {
    if (activeRenderer.getRenderTarget()) return;
    const now = performance.now();
    if (now - last < (compact ? 47 : 27)) return;
    last = now;
    renderReflection(activeRenderer, scene, camera, ...rest);
  };
  return surface;
}
