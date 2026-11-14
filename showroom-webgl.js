import {makeWater} from './water.js?v=2';
import {addLiquidRefraction, bindLiquidCamera} from './glass-volume.js';
import {
  ACESFilmicToneMapping, AmbientLight, Box3, CanvasTexture, Color, DoubleSide, GLTFLoader,
  Group, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera,
  PlaneGeometry, PMREMGenerator, RoomEnvironment, Scene, SpotLight, SRGBColorSpace, Vector3, WebGLRenderer
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
  {key: 'galet', file: 'galet-crystal.glb', x: -.35, y: -.53, z: 3.1, height: 2.61,
    tone: '#b6dc78', glass: '#f1f8e9', absorption: '#abb68a', liquid: '#6a763e',
    distance: 1.18, thickness: .012, rest: -.12, shape: [1.1, .95, 2.0]},
  {key: 'rose', file: 'rose-lune-smoked.glb', x: -3.4, y: -.06, z: -.2, height: 2.61,
    tone: '#e28ca2', glass: '#eee2e5', absorption: '#aa7e89', liquid: '#87515f',
    distance: 1.16, thickness: .016, rest: .11, shape: [1.02, .89, 2.65]},
  {key: 'bleu', file: 'sillage-bleu.glb', x: 3.05, y: .04, z: -3.1, height: 3.14,
    tone: '#709ff2', glass: '#e4edf6', absorption: '#839ebc', liquid: '#435776',
    distance: 1.15, thickness: .011, rest: -.15, shape: [.94, 1.13, 2.4]},
  {key: 'ambre', file: 'ambre-dore.glb', x: .46, y: .59, z: -8.3, height: 2.75,
    tone: '#ffc068', glass: '#fff1d4', absorption: '#d9b26b', liquid: '#b48544',
    distance: 1.32, thickness: .014, rest: .11, shape: [1.0, 1.04, 3.05]}
];
const angle = Math.tan(MathUtils.degToRad(camera.fov / 2));
const pointerStates = new Map();
const lightingPointer = {x: 0, y: 0, targetX: 0, targetY: 0};
const manualTurn = {x: 0, y: 0};
const projected = new Vector3();
const worldPoint = new Vector3();
const hoverGap = .31;
const flightOrder = ['galet', 'rose', 'bleu', 'ambre'];
let renderer, studioReflection, modalBottle, modalProduct, water;
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
  const url = new URL(product.file, import.meta.url);
  url.searchParams.set('v', '2');
  const {scene: model} = await loader.loadAsync(url.href);
  const bottle = new Group();
  bottle.add(model);
  const bounds = new Box3().setFromObject(bottle);
  const liquidBounds = new Box3();
  const scale = product.height / (bounds.max.y - bounds.min.y);
  const center = bounds.getCenter(new Vector3());
  product.fluidMotion = new Vector3();
  product.fluidLight = {value: .56};
  bottle.traverse(mesh => {
    if (mesh.isMesh && /eau de parfum/i.test(mesh.material.name)) liquidBounds.expandByObject(mesh);
  });
  bottle.traverse(mesh => {
    if (!mesh.isMesh) return;
    const material = mesh.material;
    if (/eau de parfum/i.test(material.name)) {
      // The authored mesh defines the fill level and footprint. Its optical volume is evaluated in the glass pass.
      mesh.visible = false;
    } else if (/clear.*cap crystal/i.test(material.name)) {
      material.color.set(product.key === 'bleu' ? '#eff7ff' : '#fff8e8');
      material.attenuationColor = new Color(product.key === 'bleu' ? '#e2f0ff' : '#fff0d5');
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
      material.transmission = .986;
      material.thickness = product.thickness;
      material.ior = 1.47;
      material.roughness = .057;
      material.clearcoat = .16;
      material.clearcoatRoughness = .063;
      material.envMapIntensity = 1.07;
      material.side = DoubleSide;
      if (!liquidBounds.isEmpty()) addLiquidRefraction(mesh, liquidBounds, product);
    } else if (/(print|label)/i.test(material.name) && material.map) {
      material.map.anisotropy = Math.min(12, renderer.capabilities.getMaxAnisotropy());
      material.map.colorSpace = SRGBColorSpace;
      material.roughness = .89;
      material.metalness = 0;
      material.envMapIntensity = .28;
      material.emissiveMap = material.map;
      material.emissive.set('#fff7ed');
      material.emissiveIntensity = .24;
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

  bottle.position.copy(center).multiplyScalar(-scale);
  bottle.scale.setScalar(scale);
  bindLiquidCamera(bottle);

  const group = new Group();
  group.position.set(product.x, product.y, product.z);
  const pivot = new Group();
  pivot.position.y = product.height / 2 + hoverGap;
  pivot.add(bottle);
  const radius = product.key === 'galet' ? 1.32 : 1.17;
  const pedestal = plinth(radius, product.y + 1.28, product.shape);
  group.add(pedestal, pivot);
  product.shadow = pedestal.children[1];
  product.overhead = addSpot(group, {
    color: '#fff5e8', intensity: 112, position: [.34, 5.9, .52], look: [0, .32, 0], spread: .31
  });
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

function viewAround({x, y, z}, radius, yaw, elevation, amount = 0) {
  return {
    x: x + Math.sin(yaw) * radius, y: y + elevation, z: z + Math.cos(yaw) * radius,
    aimX: x, aimY: y, aimZ: z, focus: amount
  };
}

function galleryFrame(aspect) {
  const narrow = aspect < .82;
  const radius = Math.max(14.3, (narrow ? 4.25 : 4.12) / (angle * aspect));
  return viewAround({x: .03, y: 1.10, z: -.84}, radius, .072, radius * .28);
}

function productFrame(product, aspect, yaw, focus) {
  const narrow = aspect < .88;
  const radius = Math.max(product.height / (2 * angle * (narrow ? .37 : .43)),
    1.18 / (angle * aspect));
  return viewAround({x: product.x, y: product.y + product.height * .30, z: product.z},
    radius, yaw, radius * .29, focus);
}

function flyThrough(aspect, progress) {
  const angles = [.15, -.36, .37, -.27];
  const shots = [galleryFrame(aspect), ...flightOrder.map((key, index) =>
    productFrame(products.find(product => product.key === key), aspect, angles[index], .26))];
  const scaled = MathUtils.clamp(progress, 0, 1) * (shots.length - 1);
  const index = Math.min(shots.length - 2, Math.floor(scaled));
  const t = scaled - index;
  const from = shots[index];
  const to = shots[index + 1];
  const prior = shots[Math.max(0, index - 1)];
  const following = shots[Math.min(shots.length - 1, index + 2)];
  // A cubic Hermite curve keeps the camera velocity continuous at each checkpoint.
  return Object.fromEntries(Object.keys(from).map(key => {
    const m0 = (to[key] - prior[key]) * .33;
    const m1 = (following[key] - from[key]) * .33;
    const u = t * t;
    return [key, (2 * u * t - 3 * u + 1) * from[key] + (u * t - 2 * u + t) * m0
      + (-2 * u * t + 3 * u) * to[key] + (u * t - u) * m1];
  }));
}

function frame() {
  const selected = products.find(product => product.key === stage.dataset.state);
  if (selected) return productFrame(selected, camera.aspect, .22, 1);
  const progress = Number(stage.dataset.progress || 0);
  return reducedMotion.matches ? galleryFrame(camera.aspect) : flyThrough(camera.aspect, progress);
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
  const pixelBudget = compact ? 1_300_000 : 2_500_000;
  const ratio = Math.min(devicePixelRatio || 1, compact ? 2.05 : 1.85, Math.sqrt(pixelBudget / (width * height)));
  renderer.setPixelRatio(ratio);
  renderer.setSize(width, height, false);
}

function updateHits() {
  camera.updateMatrixWorld();
  for (const product of products) {
    if (!product.button) continue;
    worldPoint.copy(product.pivot.position).add(product.group.position);
    const distance = camera.position.distanceTo(worldPoint);
    projected.copy(worldPoint).project(camera);
    product.button.style.left = ((projected.x + 1) * 50) + '%';
    product.button.style.top = ((1 - projected.y) * 50) + '%';
    const halfWidth = product.key === 'bleu' ? .66 : .93;
    const hitWidth = Math.min(camera.aspect < .82 ? width * .31 : 245,
      width * halfWidth / (distance * angle * camera.aspect));
    product.button.style.width = hitWidth + 'px';
    product.button.style.height = (height * (product.height + .18) / (2 * angle * distance)) + 'px';
    product.button.style.zIndex = String(Math.max(0, Math.round(105 - distance * 3)));
    product.button.hidden = Math.abs(projected.x) > 1.18 || Math.abs(projected.y) > 1.18 || projected.z > 1;
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
    inspection.rotation.set(manualTurn.x + demo * .43, manualTurn.y + demo, -demo * .21);
    modalProduct.fluidMotion.set(inspection.rotation.z * .84, -inspection.rotation.x * .84,
      reducedMotion.matches ? 0 : time / 1000);
    modalProduct.fluidLight.value = .95;
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
  for (const key of Object.keys(shot)) {
    shot[key] = reducedMotion.matches ? next[key] : MathUtils.damp(shot[key], next[key], 6.5, dt);
  }
  camera.position.set(shot.x, shot.y, shot.z);
  camera.lookAt(shot.aimX, shot.aimY, shot.aimZ);
  const seconds = time / 1000;
  const reach = reducedMotion.matches ? 0 : 1;
  lightingPointer.x = MathUtils.damp(lightingPointer.x, lightingPointer.targetX * reach, 3.8, dt);
  lightingPointer.y = MathUtils.damp(lightingPointer.y, lightingPointer.targetY * reach, 3.8, dt);
  for (const [index, product] of products.entries()) {
    const selected = current === product.key;
    const lit = selected || current === 'gallery' && stage.dataset.checkpoint === product.key;
    const emphasis = lit ? MathUtils.clamp(shot.focus, 0, 1) : 0;
    const phase = seconds * (.73 + index * .095) + index * 1.72;
    const still = reducedMotion.matches || (selected && pointerStates.size > 0);
    const orbitX = still ? 0 : Math.sin(phase) * .15;
    const orbitY = still ? 0 : Math.sin(phase * .91 + .85) * .12;
    const orbitZ = still ? 0 : Math.cos(phase) * .11;
    const turn = product.rest + spinAngle(product, time)
      + (still ? 0 : Math.sin(phase * .76) * .23) + (selected ? manualTurn.y : 0);
    const pitch = (selected ? manualTurn.x : 0) + (still ? 0 : Math.sin(phase * .87 + .8) * .094);
    const roll = still ? 0 : Math.cos(phase * .82) * .058;
    product.pivot.position.set(orbitX, product.height / 2 + hoverGap + orbitY, orbitZ);
    product.pivot.rotation.set(pitch, turn, roll);
    product.fluidMotion.x = MathUtils.damp(product.fluidMotion.x, roll * .84, 5.2, dt);
    product.fluidMotion.y = MathUtils.damp(product.fluidMotion.y, -pitch * .84, 5.2, dt);
    product.fluidMotion.z = reducedMotion.matches ? 0 : seconds;
    product.fluidLight.value = .48 + emphasis * .75;
    product.shadow.position.x = orbitX + lightingPointer.x * -.06;
    product.shadow.position.z = orbitZ + .06;
    const contactScale = 1.03 + orbitY * .45;
    product.shadow.scale.set(product.shape[0] * contactScale, product.shape[1] * contactScale, 1);
    product.shadow.material.opacity = .72 - orbitY * 1.05;
    const otherFocus = current !== 'gallery' && !selected ? shot.focus : 0;
    const secondary = 1 - otherFocus * .81;
    product.keyLight.intensity = (109 + emphasis * 160) * secondary;
    product.overhead.intensity = (142 + emphasis * 174) * secondary;
    product.overhead.target.position.x = orbitX + lightingPointer.x * .2;
    product.keyLight.position.x = -.95 + lightingPointer.x * .95;
    product.keyLight.position.z = 2.8 + lightingPointer.y * .36;
    product.rimLight.intensity = (46 + emphasis * 92) * secondary;
    product.edgeLight.intensity = (22 + emphasis * 23) * secondary;
    product.refraction.rotation.z = turn * .91;
    product.refraction.position.x = Math.sin(turn) * .15 + lightingPointer.x * .085;
    product.refraction.position.z = .26 + Math.cos(turn * 2) * .08;
    product.refraction.material.opacity = (.51 + emphasis * .29) * secondary * (.88 + .12 * Math.cos(turn * 2));
    if (water) {
      const {pools, poolColors} = water.material.uniforms;
      pools.value[index].set(product.x + lightingPointer.x * .22,
        product.z + lightingPointer.y * .16, (.87 + emphasis * 2.15) * secondary);
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
  modalProduct = product;
  inspection.add(modalBottle);
  bindLiquidCamera(modalBottle);
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
  modalProduct = null;
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
    renderer.transmissionResolutionScale = innerWidth <= 700 ? .72 : .88;
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
