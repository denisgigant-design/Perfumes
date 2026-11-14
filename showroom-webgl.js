import {makeWater} from './water.js?v=1';
import {
  ACESFilmicToneMapping, AmbientLight, Box3, CanvasTexture, Color, DoubleSide, GLTFLoader,
  Group, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera,
  PlaneGeometry, PMREMGenerator, RoomEnvironment, Scene, SpotLight, Vector3, WebGLRenderer
} from './three-showroom.js?v=2';

const stage = document.querySelector('#stage');
const mount = document.querySelector('#showroom3d');
const inspector = document.querySelector('#three-canvas');
const dragArea = document.querySelector('#product-drag');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const scene = new Scene();
const camera = new PerspectiveCamera(34, 1, .07, 65);
const closeup = new Scene();
const closeupCamera = new PerspectiveCamera(34, 1, .07, 35);
const inspection = new Group();
closeup.add(inspection);

const products = [
  {key: 'galet', file: 'galet-crystal.glb', x: -.16, y: -.53, z: 1.90, height: 2.61,
    tone: '#b6dc78', glass: '#e1e7d1', absorption: '#738445', liquid: '#6a763e',
    distance: .71, thickness: .014, rest: -.12, shape: [1.1, .95, 2.0]},
  {key: 'rose', file: 'rose-lune-smoked.glb', x: -2.24, y: -.03, z: .15, height: 2.61,
    tone: '#e28ca2', glass: '#c8aab3', absorption: '#774052', liquid: '#87515f',
    distance: .66, thickness: .021, rest: .11, shape: [1.02, .89, 2.65]},
  {key: 'bleu', file: 'sillage-bleu.glb', x: 2.17, y: -.04, z: .40, height: 3.14,
    tone: '#709ff2', glass: '#c2cfe4', absorption: '#415e87', liquid: '#435776',
    distance: .70, thickness: .014, rest: -.15, shape: [.94, 1.13, 2.4]},
  {key: 'ambre', file: 'ambre-dore.glb', x: .39, y: .56, z: -2.14, height: 2.75,
    tone: '#ffc068', glass: '#f1cd95', absorption: '#bb772d', liquid: '#b48544',
    distance: 1.03, thickness: .019, rest: .11, shape: [1.0, 1.04, 3.05]}
];
const angle = Math.tan(MathUtils.degToRad(camera.fov / 2));
const pointerStates = new Map();
const lightingPointer = {x: 0, y: 0, targetX: 0, targetY: 0};
const manualTurn = {x: 0, y: 0};
const projected = new Vector3();
const worldPoint = new Vector3();
const fullTurn = Math.PI * 2;
let renderer, studioReflection, modalBottle, water;
let width = 0, height = 0, zoom = 6.7, previousTime = 0, openedAt = 0;
let shot = null, lastProduct = 'gallery';
let dragDistance = 0;
const spinDuration = 1480;
const additiveBlending = 2; // Three.js AdditiveBlending, omitted from the local bundle exports.

function contactTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const falloff = ctx.createRadialGradient(64, 64, 1, 64, 64, 64);
  falloff.addColorStop(0, 'rgba(0,0,0,.8)');
  falloff.addColorStop(.5, 'rgba(0,0,0,.47)');
  falloff.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = falloff;
  ctx.fillRect(0, 0, 128, 128);
  return new CanvasTexture(canvas);
}

const shadowMap = contactTexture();

function refractionTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.translate(96, 96);
  for (let i = 0; i < 3; i++) {
    const halo = ctx.createRadialGradient(-12 + i * 12, 5 - i * 8, 1, 0, 0, 93);
    halo.addColorStop(0, 'rgba(255,255,255,.45)');
    halo.addColorStop(.42, 'rgba(255,255,255,.16)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(-96, -96, 192, 192);
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,' + (.05 + (i % 3) * .024) + ')';
    ctx.lineWidth = 1.2 + (i % 4) * .65;
    ctx.ellipse(i * 5 - 18, i * 3 - 8, 30 + i * 5, 14 + i * 5, -.5 + i * .21, .1, Math.PI * 1.54);
    ctx.stroke();
  }
  return new CanvasTexture(canvas);
}

const refractionMap = refractionTexture();

function addRefraction(group, color, radius) {
  const groundLight = new Mesh(new PlaneGeometry(radius * 1.98, radius * 1.91),
    new MeshBasicMaterial({
      map: refractionMap, color, opacity: .72, transparent: true,
      blending: additiveBlending, depthWrite: false, toneMapped: false
    }));
  groundLight.rotateX(-Math.PI / 2);
  groundLight.position.set(0, .014, .13);
  groundLight.renderOrder = 2;
  group.add(groundLight);
  return groundLight;
}

function satinBump() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const texture = ctx.createImageData(128, 128);
  let state = 37;
  for (let i = 0; i < texture.data.length; i += 4) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const grain = 111 + (state >>> 27);
    texture.data[i] = texture.data[i + 1] = texture.data[i + 2] = grain;
    texture.data[i + 3] = 255;
  }
  ctx.putImageData(texture, 0, 0);
  return new CanvasTexture(canvas);
}

const satinMap = satinBump();

function plinth(radius, height, [scaleX, scaleZ, exponent]) {
  const profile = [
    [.001, 0], [radius - .06, 0], [radius - .026, -.016], [radius, -.055],
    [radius, -.097], [radius * .973, -.13], [radius * .939, -height * .34],
    [radius * .89, -height * .84], [radius * .87, -height],
    [radius * .81, -height - .017], [.001, -height - .017]
  ];
  const segments = 96;
  const geometry = new PlaneGeometry(1, 1, segments, profile.length - 1);
  const vertices = geometry.attributes.position;
  for (let row = 0; row < profile.length; row++) {
    const [r, y] = profile[row];
    for (let col = 0; col <= segments; col++) {
      const theta = col / segments * Math.PI * 2;
      const index = row * (segments + 1) + col;
      const u = Math.cos(theta);
      const v = Math.sin(theta);
      const x = r * Math.sign(u) * Math.pow(Math.abs(u), 2 / exponent) * scaleX;
      const z = -r * Math.sign(v) * Math.pow(Math.abs(v), 2 / exponent) * scaleZ;
      vertices.setXYZ(index, x, y, z);
      geometry.attributes.uv.setXY(index, x / (radius * 2) + .5, z / (radius * 2) + .5);
    }
  }
  geometry.computeVertexNormals();
  geometry.clearGroups();
  const stride = segments * 6;
  geometry.addGroup(0, stride * 2, 0);
  geometry.addGroup(stride * 2, stride * 2, 1);
  geometry.addGroup(stride * 4, stride * 6, 2);
  const base = new Mesh(geometry, [
    new MeshStandardMaterial({color: '#39373a', metalness: .39, roughness: .34,
      bumpMap: satinMap, bumpScale: .032}),
    new MeshStandardMaterial({color: '#c6ad90', metalness: .77, roughness: .235}),
    new MeshStandardMaterial({color: '#1e2227', metalness: .48, roughness: .38,
      bumpMap: satinMap, bumpScale: .028})
  ]);
  const shadow = new Mesh(new PlaneGeometry(radius * 1.9, radius * 1.7),
    new MeshBasicMaterial({map: shadowMap, transparent: true, depthWrite: false}));
  shadow.rotateX(-Math.PI / 2);
  shadow.position.y = .006;
  shadow.scale.set(scaleX, scaleZ, 1);
  const platform = new Group();
  platform.add(base, shadow);
  return platform;
}

function addSpot(parent, {color, intensity, position, look, spread = .56}) {
  const light = new SpotLight(color, intensity, 0, spread, .74, 2);
  light.position.set(...position);
  light.target.position.set(...look);
  parent.add(light, light.target);
  return light;
}

async function loadBottle(product, loader) {
  const {scene: model} = await loader.loadAsync(new URL(product.file, import.meta.url).href);
  const bottle = new Group();
  bottle.add(model);
  const bounds = new Box3().setFromObject(bottle);
  const scale = product.height / (bounds.max.y - bounds.min.y);
  const center = bounds.getCenter(new Vector3());
  bottle.position.copy(center).multiplyScalar(-scale);
  bottle.scale.setScalar(scale);
  bottle.traverse(mesh => {
    if (!mesh.isMesh) return;
    const material = mesh.material;
    if (/eau de parfum/i.test(material.name)) {
      // Keep the inner mesh in the opaque transmission pass so the glass can refract it.
      mesh.geometry.computeBoundingBox();
      const surface = mesh.geometry.boundingBox;
      material.color.set(product.liquid);
      material.transmission = 0;
      material.roughness = .15;
      material.metalness = 0;
      material.emissive.copy(material.color);
      material.emissiveIntensity = 0;
      material.clearcoat = .23;
      material.clearcoatRoughness = .12;
      material.onBeforeCompile = shader => {
        shader.uniforms.liquidBottom = {value: surface.min.y};
        shader.uniforms.liquidDepth = {value: Math.max(surface.max.y - surface.min.y, 1e-5)};
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying float bottleHeight;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nbottleHeight = position.y;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float bottleHeight; uniform float liquidBottom; uniform float liquidDepth;')
          .replace('#include <color_fragment>', `#include <color_fragment>
            float fill = clamp((bottleHeight - liquidBottom) / liquidDepth, 0.0, 1.0);
            float meniscus = smoothstep(0.97, 0.996, fill);
            diffuseColor.rgb *= mix(0.68, 1.04, smoothstep(0.02, 0.92, fill));
            diffuseColor.rgb *= 1.0 - 0.09 * meniscus;
          `);
      };
    } else if (/clear cap crystal/i.test(material.name)) {
      material.color.set('#fff8e8');
      material.attenuationColor = new Color('#fff0d5');
      material.attenuationDistance = 2.2;
      material.transmission = .988;
      material.thickness = .022;
      material.ior = 1.49;
      material.roughness = .050;
      material.envMapIntensity = 1.25;
    } else if (/crystal/i.test(material.name)) {
      material.color.set(product.glass);
      material.attenuationColor = new Color(product.absorption);
      material.attenuationDistance = product.distance;
      material.transmission = .962;
      material.thickness = product.thickness;
      material.ior = 1.47;
      material.roughness = .10;
      material.clearcoat = .16;
      material.clearcoatRoughness = .063;
      material.envMapIntensity = 1.07;
      material.side = DoubleSide;
    } else if (/atomizer tube/i.test(material.name)) {
      // Leave a muted highlight on the dip tube in the solid pass refracted by the shell.
      material.transmission = 0;
      material.color.set('#64605d');
      material.roughness = .31;
    } else if (/pearl|lacquer|cap/i.test(material.name)) {
      material.bumpMap = satinMap;
      material.bumpScale = .00013;
      material.envMapIntensity = .83;
    }
  });

  const group = new Group();
  group.position.set(product.x, product.y, product.z);
  const pivot = new Group();
  pivot.position.y = product.height / 2 + .035;
  pivot.add(bottle);
  const radius = product.key === 'galet' ? 1.32 : 1.17;
  group.add(plinth(radius, product.y + 1.28, product.shape), pivot);
  product.refraction = addRefraction(group, product.tone, radius);
  product.keyLight = addSpot(group, {
    color: '#fff3e9', intensity: 74, position: [-.95, 5.65, 2.8], look: [0, .98, 0]
  });
  product.rimLight = addSpot(group, {
    color: product.tone, intensity: 50, position: [1.15, 4.3, -1.9], look: [0, 1.2, 0]
  });
  product.edgeLight = addSpot(group, {
    color: '#fff2e8', intensity: 18, position: [-1.65, 1.90, -2.45], look: [0, 1.08, 0], spread: .34
  });
  scene.add(group);
  Object.assign(product, {group, pivot, bottle});
}

function galleryFrame(aspect, progress) {
  const narrow = aspect < .82;
  const radius = Math.max(10.7, (narrow ? 3.72 : 3.45) / (angle * aspect));
  return {
    yaw: .12 - (reducedMotion.matches ? 0 : progress * fullTurn),
    radius, elevation: radius * (narrow ? .33 : .39),
    aimX: .03, aimY: narrow ? .82 : .86, aimZ: .06, focus: 0
  };
}

function closeFrame(product, aspect) {
  const narrow = aspect < .90;
  const radius = Math.max(product.height / (2 * angle * (narrow ? .38 : .42)),
    1.36 / (angle * aspect));
  return {
    yaw: .24, radius, elevation: radius * .34,
    aimX: product.x, aimY: product.y + product.height * .20,
    aimZ: product.z, focus: 1
  };
}

function frame() {
  const selected = products.find(product => product.key === stage.dataset.state);
  const progress = Number(stage.dataset.progress || 0);
  return selected ? closeFrame(selected, camera.aspect) : galleryFrame(camera.aspect, progress);
}

function spin(key) {
  const product = products.find(item => item.key === key);
  if (!product || reducedMotion.matches) return;
  if (product.spin && performance.now() - product.spin.started < spinDuration) return;
  product.spin = {started: performance.now()};
}

function spinAngle(product, time) {
  if (!product.spin) return 0;
  const t = MathUtils.clamp((time - product.spin.started) / spinDuration, 0, 1);
  if (t >= 1) {
    product.spin = null;
    return 0;
  }
  return MathUtils.smoothstep(t, 0, 1) * Math.PI * 2;
}

function resize() {
  const container = modalBottle ? inspector : mount;
  const nextWidth = container.clientWidth;
  const nextHeight = container.clientHeight;
  if (!nextWidth || !nextHeight || (width === nextWidth && height === nextHeight)) return;
  width = nextWidth;
  height = nextHeight;
  const active = modalBottle ? closeupCamera : camera;
  active.aspect = width / height;
  active.updateProjectionMatrix();
  const compact = width <= 700;
  const pixelBudget = compact ? 1_050_000 : 2_150_000;
  const ratio = Math.min(devicePixelRatio || 1, compact ? 1.65 : 1.75, Math.sqrt(pixelBudget / (width * height)));
  renderer.setPixelRatio(ratio);
  renderer.setSize(width, height, false);
}

function updateHits() {
  camera.updateMatrixWorld();
  for (const product of products) {
    if (!product.button) continue;
    worldPoint.set(product.x, product.y + product.height * .5, product.z);
    const distance = camera.position.distanceTo(worldPoint);
    projected.copy(worldPoint).project(camera);
    product.button.style.left = ((projected.x + 1) * 50) + '%';
    product.button.style.top = ((1 - projected.y) * 50) + '%';
    const halfWidth = product.key === 'bleu' ? .66 : .93;
    const hitWidth = Math.min(camera.aspect < .82 ? width * .31 : 245,
      width * halfWidth / (distance * angle * camera.aspect));
    product.button.style.width = hitWidth + 'px';
    product.button.style.height = (height * (product.height + .18) / (2 * angle * distance)) + 'px';
    product.button.style.zIndex = String(Math.max(0, Math.round(95 - distance * 3)));
  }
}

function render(time) {
  if (document.hidden) return;
  if (!modalBottle && stage.getBoundingClientRect().bottom <= 0) return;
  if (previousTime && time - previousTime < 27 && stage.dataset.state === 'gallery') return;
  resize();
  const dt = previousTime ? Math.min((time - previousTime) / 1000, .05) : .016;
  previousTime = time;
  if (modalBottle) {
    const t = (time - openedAt) / 1000;
    const demo = pointerStates.size || reducedMotion.matches ? 0 : Math.sin(t * 2.1) * .14;
    inspection.rotation.set(manualTurn.x, manualTurn.y + demo, 0);
    const distance = zoom * Math.max(1, .62 / closeupCamera.aspect);
    closeupCamera.position.set(.32, distance * .26, distance);
    closeupCamera.lookAt(0, 0, 0);
    renderer.render(closeup, closeupCamera);
    return;
  }

  const current = stage.dataset.state;
  if (current !== lastProduct) {
    manualTurn.x = manualTurn.y = 0;
    pointerStates.clear();
    lastProduct = current;
  }
  const next = frame();
  shot ??= {...next};
  const yawDelta = MathUtils.euclideanModulo(next.yaw - shot.yaw + Math.PI, fullTurn) - Math.PI;
  next.yaw = shot.yaw + yawDelta;
  for (const key of Object.keys(shot)) {
    shot[key] = reducedMotion.matches ? next[key] : MathUtils.damp(shot[key], next[key], 6.5, dt);
  }
  camera.position.set(shot.aimX + Math.sin(shot.yaw) * shot.radius, shot.aimY + shot.elevation,
    shot.aimZ + Math.cos(shot.yaw) * shot.radius);
  camera.lookAt(shot.aimX, shot.aimY, shot.aimZ);
  const seconds = time / 1000;
  const reach = reducedMotion.matches ? 0 : 1;
  lightingPointer.x = MathUtils.damp(lightingPointer.x, lightingPointer.targetX * reach, 3.8, dt);
  lightingPointer.y = MathUtils.damp(lightingPointer.y, lightingPointer.targetY * reach, 3.8, dt);
  for (const [index, product] of products.entries()) {
    const selected = current === product.key;
    const emphasis = selected ? shot.focus : 0;
    const phase = seconds * (.73 + index * .095) + index * 1.72;
    const still = reducedMotion.matches || (selected && pointerStates.size > 0);
    const idleYaw = still ? 0 : Math.sin(phase) * .19;
    const idleRock = still ? 0 : Math.sin(phase * .91 + .8) * .018;
    const turn = product.rest + spinAngle(product, time) + idleYaw + (selected ? manualTurn.y : 0);
    product.pivot.rotation.set((selected ? manualTurn.x : 0) + idleRock, turn, idleRock * .68);
    const otherFocus = selected ? 0 : shot.focus;
    const secondary = 1 - otherFocus * .84;
    product.keyLight.intensity = (105 + emphasis * 105) * secondary;
    product.keyLight.position.x = -.95 + lightingPointer.x * .95;
    product.keyLight.position.z = 2.8 + lightingPointer.y * .36;
    product.rimLight.intensity = (38 + emphasis * 72) * secondary;
    product.edgeLight.intensity = (22 + emphasis * 23) * secondary;
    product.refraction.rotation.z = turn * .91;
    product.refraction.position.x = Math.sin(turn) * .15 + lightingPointer.x * .085;
    product.refraction.position.z = .26 + Math.cos(turn * 2) * .08;
    product.refraction.material.opacity = (.51 + emphasis * .29) * secondary * (.88 + .12 * Math.cos(turn * 2));
    if (water) {
      const {pools, poolColors} = water.material.uniforms;
      pools.value[index].set(product.x + lightingPointer.x * .22,
        product.z + lightingPointer.y * .16, (.62 + emphasis * 1.72) * secondary);
      poolColors.value[index].set(product.tone);
    }
  }
  if (water) water.material.uniforms.clock.value = reducedMotion.matches ? 0 : seconds;
  if (current === 'gallery') updateHits();
  renderer.render(scene, camera);
}

function open(key) {
  const product = products.find(item => item.key === key);
  if (!product?.bottle) return Promise.reject(new Error('Bottle unavailable'));
  modalBottle = product.bottle.clone();
  inspection.add(modalBottle);
  manualTurn.x = manualTurn.y = 0;
  zoom = 6.7;
  openedAt = performance.now();
  width = 0;
  inspector.appendChild(renderer.domElement);
  return Promise.resolve();
}

function stop() {
  if (!modalBottle) return;
  inspection.remove(modalBottle);
  modalBottle = null;
  manualTurn.x = manualTurn.y = 0;
  pointerStates.clear();
  width = 0;
  mount.appendChild(renderer.domElement);
}

function controls(element, modal) {
  element.addEventListener('pointerdown', event => {
    if (!modal && stage.dataset.state === 'gallery') return;
    if (pointerStates.size === 0) dragDistance = 0;
    pointerStates.set(event.pointerId, {x: event.clientX, y: event.clientY});
    element.setPointerCapture(event.pointerId);
  });
  element.addEventListener('pointermove', event => {
    const previous = pointerStates.get(event.pointerId);
    if (!previous) return;
    const current = {x: event.clientX, y: event.clientY};
    dragDistance += Math.hypot(current.x - previous.x, current.y - previous.y);
    if (modal && pointerStates.size === 2) {
      const other = [...pointerStates.values()].find(point => point !== previous);
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(current.x - other.x, current.y - other.y);
      zoom = MathUtils.clamp(zoom + (before - after) * .018, 5, 10);
    } else {
      manualTurn.y += (current.x - previous.x) * .014;
      manualTurn.x = MathUtils.clamp(manualTurn.x + (current.y - previous.y) * .006, -.46, .46);
    }
    pointerStates.set(event.pointerId, current);
    });
  function release(event) {
    const active = pointerStates.delete(event.pointerId);
    if (!modal && active && event.type === 'pointerup' && dragDistance < 7) spin(stage.dataset.state);
    }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    element.addEventListener(event, release);
  }
  if (modal) element.addEventListener('wheel', event => {
    event.preventDefault();
    zoom = MathUtils.clamp(zoom + event.deltaY * .004, 5, 10);
    }, {passive: false});
}

function fallback(error) {
  console.warn('3D showroom switched to image previews.', error);
  document.documentElement.classList.remove('glb-live');
  if (modalBottle) document.querySelector('#viewerFallback').hidden = false;
  stop();
  stage.removeEventListener('pointermove', trackLighting);
  stage.removeEventListener('pointerdown', trackLighting);
  stage.removeEventListener('pointerup', releaseLighting);
  stage.removeEventListener('pointerleave', centerLighting);
  stage.removeEventListener('pointercancel', centerLighting);
  renderer?.setAnimationLoop(null);
  renderer?.domElement.remove();
  studioReflection?.dispose();
  water?.dispose();
  renderer?.dispose();
  delete window.Perfume3D;
}

function reflectionPanels(environment) {
  const panels = [
    {size: [1.45, 5.1], position: [-4.6, 1.4, 2.5], color: '#fff4e9', energy: 2.7},
    {size: [.71, 4.1], position: [4.2, .65, 2.35], color: '#f2f4ff', energy: 2.2},
    {size: [3.2, 1.0], position: [.25, 4.25, .6], color: '#fff5ec', energy: 2.75}
  ];
  for (const {size, position, color, energy} of panels) {
    const light = new Mesh(new PlaneGeometry(...size),
      new MeshBasicMaterial({color: new Color(color).multiplyScalar(energy), toneMapped: false}));
    light.position.set(...position);
    light.lookAt(0, 0, 0);
    environment.add(light);
  }
}

function trackLighting(event) {
  const rect = stage.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  lightingPointer.targetX = MathUtils.clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1);
  lightingPointer.targetY = MathUtils.clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1);
}

function centerLighting() {
  lightingPointer.targetX = lightingPointer.targetY = 0;
}

function releaseLighting(event) {
  if (event.pointerType !== 'mouse') centerLighting();
}

async function start() {
  try {
    renderer = new WebGLRenderer({alpha: true, antialias: true, powerPreference: 'high-performance'});
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.07;
    renderer.transmissionResolutionScale = innerWidth <= 700 ? .63 : .82;
    const studio = new RoomEnvironment();
    reflectionPanels(studio);
    const pmrem = new PMREMGenerator(renderer);
    studioReflection = pmrem.fromScene(studio, .016);
    pmrem.dispose();
    studio.dispose();
    scene.environment = closeup.environment = studioReflection.texture;
    scene.environmentIntensity = .67;
    closeup.environmentIntensity = 1.17;
    scene.add(new AmbientLight('#ebedf8', .26));
    closeup.add(new AmbientLight('#f3eefa', .32));
    addSpot(closeup, {color: '#fff4e7', intensity: 70, position: [3, 4, 4], look: [0, 0, 0]});
    water = makeWater(renderer, innerWidth <= 700);
    scene.add(water);
    const loader = new GLTFLoader();
    await Promise.all(products.map(product => loadBottle(product, loader)));
    for (const product of products) product.button = document.querySelector('.gallery-bay.' + product.key);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      fallback(event);
    }, {once: true});
    controls(renderer.domElement, true);
    controls(dragArea, false);
    mount.appendChild(renderer.domElement);
    stage.addEventListener('pointermove', trackLighting, {passive: true});
    stage.addEventListener('pointerdown', trackLighting, {passive: true});
    stage.addEventListener('pointerup', releaseLighting);
    stage.addEventListener('pointerleave', centerLighting);
    stage.addEventListener('pointercancel', centerLighting);
    document.documentElement.classList.add('glb-live');
    window.Perfume3D = {open, stop, spin};
    renderer.setAnimationLoop(render);
  } catch (error) {
    fallback(error);
  }
}

start();
