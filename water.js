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
      float a = sin(dot(p, vec2(4.6, 7.2)) + clock * 1.34);
      float b = sin(dot(p, vec2(-8.1, 3.7)) - clock * 1.24 + a * 0.5);
      float c = sin(dot(p, vec2(12.8, 8.2)) + clock * 1.98);
      vec2 ripple = vec2(a + c * 0.16, b + c * 0.24);
      vec3 eye = normalize(cameraPosition - vSurface);
      float grazing = pow(1.0 - clamp(eye.y, 0.0, 1.0), 3.0);
      vec2 uv = vUv.xy / vUv.w + ripple * (0.0105 + grazing * 0.006);
      vec2 edge = min(uv, 1.0 - uv);
      float valid = smoothstep(0.0, 0.076, min(edge.x, edge.y));
      vec3 mirrored = texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb * valid;
      vec3 glints = vec3(0.0);
      float slope = smoothstep(0.56, 0.97, a * b * 0.66 + c * 0.24);
      for (int i = 0; i < 4; ++i) {
        vec2 q = p - pools[i].xy;
        float drop = exp(-dot(q, q) * 0.28);
        float shine = pow(max(0.0, 0.5 + 0.5 * sin(14.0 * length(q) - clock * 1.6 + b)), 4.0);
        glints += poolColors[i] * drop * pools[i].z * (0.014 + 0.075 * shine * slope);
      }
      float fade = 1.0 - smoothstep(8.0, 21.0, length(p));
      vec3 surface = vec3(0.0018, 0.0028, 0.0041) + glints;
      surface += mirrored * (0.39 + 0.42 * grazing);
      gl_FragColor = vec4(surface * fade, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `
};

export function makeWater(renderer, compact) {
  const size = compact ? 288 : 640;
  const surface = new Reflector(new PlaneGeometry(44, 44), {
    textureWidth: size, textureHeight: size, multisample: 0, clipBias: 0.002, shader: waterShader
  });
  // UnsignedByteType keeps the reflection framebuffer available on mobile GPUs without float colour targets.
  if (compact || !renderer.extensions.has('EXT_color_buffer_float')) {
    surface.getRenderTarget().texture.type = 1009;
  }
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = -1.28;
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
