import {
  ACESFilmicToneMapping, AmbientLight, Box3, CanvasTexture, DoubleSide, GLTFLoader,
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
  {key: 'galet', file: 'galet-crystal.glb', x: .03, y: -.52, z: 1.35, height: 2.7, tone: '#a8ef55', rest: -.13},
  {key: 'rose', file: 'rose-lune.glb', x: -2.03, y: .20, z: -1.4, height: 2.60, tone: '#ff6b9f', rest: .18},
  {key: 'bleu', file: 'sillage-bleu.glb', x: 2.19, y: .05, z: -2.65, height: 3.18, tone: '#4e81ff', rest: -.17}
];
const angle = Math.tan(MathUtils.degToRad(camera.fov / 2));
const pointerStates = new Map();
const manualTurn = {x: 0, y: 0};
const projected = new Vector3();
let renderer, studioReflection, modalBottle;
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

function plinth(radius, height) {
  const profile = [
    [.001, 0], [radius - .025, 0], [radius, -.025],
    [radius * .96, -height + .024], [radius * .94, -height], [.001, -height]
  ];
  const segments = 96;
  const geometry = new PlaneGeometry(1, 1, segments, profile.length - 1);
  const vertices = geometry.attributes.position;
  for (let row = 0; row < profile.length; row++) {
    const [r, y] = profile[row];
    for (let col = 0; col <= segments; col++) {
      const theta = col / segments * Math.PI * 2;
      vertices.setXYZ(row * (segments + 1) + col, r * Math.cos(theta), y, -r * Math.sin(theta));
    }
  }
  geometry.computeVertexNormals();
  geometry.clearGroups();
  const stride = segments * 6;
  geometry.addGroup(0, stride, 0);
  geometry.addGroup(stride, stride, 1);
  geometry.addGroup(stride * 2, stride * 3, 0);
  const base = new Mesh(geometry, [
    new MeshStandardMaterial({color: '#36302e', metalness: .63, roughness: .33}),
    new MeshStandardMaterial({color: '#b49b7a', metalness: .78, roughness: .26})
  ]);
  const shadow = new Mesh(new PlaneGeometry(radius * 1.9, radius * 1.7),
    new MeshBasicMaterial({map: shadowMap, transparent: true, depthWrite: false}));
  shadow.rotateX(-Math.PI / 2);
  shadow.position.y = .006;
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
  const xScale = product.key === 'rose' ? scale * .87 : scale;
  bottle.position.set(-center.x * xScale, -center.y * scale, -center.z * scale);
  bottle.scale.set(xScale, scale, scale);
  bottle.traverse(mesh => {
    if (!mesh.isMesh) return;
    const material = mesh.material;
    if (/eau de parfum/.test(material.name)) {
      if (product.key === 'rose') {
        material.color.set('#ee478e');
        material.transmission = 0;
        material.roughness = .24;
      }
      material.emissive.copy(material.color);
      material.emissiveIntensity = .18;
    }
    if (/crystal/i.test(material.name)) {
      if (product.key === 'rose') material.color.set('#ffb2ce');
      material.envMapIntensity = 1.36;
      material.side = DoubleSide;
    }
  });

  const group = new Group();
  group.position.set(product.x, product.y, product.z);
  const pivot = new Group();
  pivot.position.y = product.height / 2 + .035;
  pivot.add(bottle);
  const radius = product.key === 'galet' ? 1.32 : 1.17;
  group.add(plinth(radius, product.key === 'galet' ? .25 : .20), pivot);
  product.refraction = addRefraction(group, product.tone, radius);
  product.keyLight = addSpot(group, {
    color: '#fff3e9', intensity: 74, position: [-.95, 5.65, 2.8], look: [0, .98, 0]
  });
  product.rimLight = addSpot(group, {
    color: product.tone, intensity: 50, position: [1.15, 4.3, -1.9], look: [0, 1.2, 0]
  });
  scene.add(group);
  Object.assign(product, {group, pivot, bottle});
}

function galleryFrame(aspect) {
  return {
    x: .03, y: aspect < .9 ? .38 : .58,
    z: Math.max(10.9, 2.91 / (angle * aspect)),
    galet: 0, rose: 0, bleu: 0
  };
}

function closeFrame(product, aspect) {
  const narrow = aspect < .9;
  const distance = Math.max(product.height / (2 * angle * (narrow ? .39 : .43)),
    1.37 / (angle * aspect));
  return {
    x: product.x, y: product.y + product.height / 2 - (narrow ? .37 : .28) * distance * angle,
    z: product.z + distance,
    galet: Number(product.key === 'galet'), rose: Number(product.key === 'rose'),
    bleu: Number(product.key === 'bleu')
  };
}

function frame() {
  const aspect = camera.aspect;
  const progress = Number(stage.dataset.progress || 0);
  const frames = [galleryFrame(aspect), ...products.map(product => closeFrame(product, aspect))];
  const index = progress < .36 ? 0 : progress < .67 ? 1 : 2;
  const ranges = [[.035,.28],[.38,.60],[.68,.91]];
  const weight = MathUtils.smoothstep(progress, ...ranges[index]);
  return Object.fromEntries(Object.keys(frames[index]).map(key =>
    [key, MathUtils.lerp(frames[index][key], frames[index + 1][key], weight)]));
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
  renderer.setSize(width, height, false);
}

function updateHits() {
  camera.updateMatrixWorld();
  for (const product of products) {
    if (!product.button) continue;
    projected.set(product.x, product.y + product.height * .48, product.z).project(camera);
    const distance = camera.position.z - product.z;
    product.button.style.left = ((projected.x + 1) * 50) + '%';
    product.button.style.top = ((1 - projected.y) * 50) + '%';
    const halfWidth = product.key === 'bleu' ? .66 : .95;
    const hitWidth = Math.min(camera.aspect < .82 ? width * .32 : 245,
      width * halfWidth / (distance * angle * camera.aspect));
    product.button.style.width = hitWidth + 'px';
    product.button.style.height = (height * (product.height + .55) / (2 * angle * distance)) + 'px';
  }
}

function render(time) {
  if (document.hidden) return;
  if (!modalBottle && stage.getBoundingClientRect().bottom <= 0) return;
  if (previousTime && time - previousTime < 28 && stage.dataset.state === 'gallery') return;
  resize();
  const dt = previousTime ? Math.min((time - previousTime) / 1000, .05) : .016;
  previousTime = time;
  if (modalBottle) {
    const t = (time - openedAt) / 1000;
    const demo = pointerStates.size || reducedMotion.matches ? 0 : Math.sin(t * 2.1) * .14;
    inspection.rotation.set(manualTurn.x, manualTurn.y + demo, 0);
    const distance = zoom * Math.max(1, .62 / closeupCamera.aspect);
    closeupCamera.position.set(0, .06, distance);
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
    shot[key] = reducedMotion.matches ? next[key] : MathUtils.damp(shot[key], next[key], 6.0, dt);
  }
  camera.position.set(shot.x, shot.y, shot.z);
  const strongest = Math.max(shot.rose, shot.galet, shot.bleu);
  const seconds = time / 1000;
  for (const [index, product] of products.entries()) {
    const emphasis = shot[product.key];
    const selected = current === product.key;
    const phase = seconds * (.73 + index * .095) + index * 1.72;
    const still = reducedMotion.matches || (selected && pointerStates.size > 0);
    const idleYaw = still ? 0 : Math.sin(phase) * .19;
    const idleRock = still ? 0 : Math.sin(phase * .91 + .8) * .018;
    const turn = product.rest + spinAngle(product, time) + idleYaw + (selected ? manualTurn.y : 0);
    product.pivot.rotation.set((selected ? manualTurn.x : 0) + idleRock, turn, idleRock * .68);
    const otherFocus = Math.max(0, strongest - emphasis);
    const direction = product.x < shot.x ? -1 : 1;
    product.group.position.x = product.x + direction * otherFocus * 1.9;
    product.group.position.y = product.y - otherFocus * .32;
    const secondary = 1 - otherFocus * .78;
    product.keyLight.intensity = (75 + emphasis * 59) * secondary;
    product.rimLight.intensity = (55 + emphasis * 48) * secondary;
    product.refraction.rotation.z = turn * .91;
    product.refraction.position.x = Math.sin(turn) * .15;
    product.refraction.position.z = .26 + Math.cos(turn * 2) * .08;
    product.refraction.material.opacity = (.66 + emphasis * .2) * secondary * (.88 + .12 * Math.cos(turn * 2));
  }
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
  renderer?.setAnimationLoop(null);
  renderer?.domElement.remove();
  studioReflection?.dispose();
  renderer?.dispose();
  delete window.Perfume3D;
}

async function start() {
  try {
    renderer = new WebGLRenderer({alpha: true, antialias: true, powerPreference: 'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth <= 660 ? 1.25 : 1.5));
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.21;
    renderer.transmissionResolutionScale = .65;
    const studio = new RoomEnvironment();
    const pmrem = new PMREMGenerator(renderer);
    studioReflection = pmrem.fromScene(studio, .035);
    pmrem.dispose();
    studio.dispose();
    scene.environment = closeup.environment = studioReflection.texture;
    scene.environmentIntensity = .72;
    closeup.environmentIntensity = 1.05;
    scene.add(new AmbientLight('#e9e0d5', .72));
    closeup.add(new AmbientLight('#fff1dc', .88));
    addSpot(closeup, {color: '#fff4e7', intensity: 70, position: [3, 4, 4], look: [0, 0, 0]});
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
    document.documentElement.classList.add('glb-live');
    window.Perfume3D = {open, stop, spin};
    renderer.setAnimationLoop(render);
  } catch (error) {
    fallback(error);
  }
}

start();
