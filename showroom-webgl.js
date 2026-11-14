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
  {key: 'rose', file: 'rose-lune.glb', x: -1.63, y: .37, z: -1.45, height: 2.46, tone: '#ffc0c9'},
  {key: 'galet', file: 'galet-tripo.glb', x: 1.21, y: -.36, z: .90, height: 2.76, tone: '#f4ffdc', yaw: -Math.PI / 2}
];
const angle = Math.tan(MathUtils.degToRad(camera.fov / 2));
const pointerStates = new Map();
const manualTurn = {x: 0, y: 0};
const target = new Vector3();
const projected = new Vector3();
let renderer, studioReflection, modalBottle;
let width = 0, height = 0, zoom = 6.7, previousTime = 0, openedAt = 0;
let shot = null, focusTime = 0, lastProduct = 'gallery', needsRender = true;

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
  model.rotation.y = product.yaw ?? 0;
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
    if (product.key === 'galet') {
      material.envMapIntensity = 1.36;
      material.normalScale?.setScalar(.73);
    }
    if (/eau de parfum/.test(material.name)) {
      material.emissive.copy(material.color);
      material.emissiveIntensity = .23;
    }
    if (/crystal/.test(material.name)) {
      material.envMapIntensity = 1.4;
      material.side = DoubleSide;
    }
  });

  const group = new Group();
  group.position.set(product.x, product.y, product.z);
  const pivot = new Group();
  pivot.position.y = product.height / 2 + .035;
  pivot.add(bottle);
  group.add(plinth(product.key === 'galet' ? 1.30 : 1.19, product.key === 'galet' ? .25 : .20), pivot);
  product.keyLight = addSpot(group, {
    color: '#fff0d7', intensity: 48, position: [-2, 4.3, 3.25], look: [0, 1.05, 0]
  });
  product.rimLight = addSpot(group, {
    color: product.tone, intensity: 48, position: [1.6, 3.6, -2.1], look: [0, 1.2, 0]
  });
  scene.add(group);
  Object.assign(product, {group, pivot, bottle});
}

function galleryFrame(aspect) {
  const narrow = aspect < .9;
  return {x: narrow ? -.13 : .02, y: narrow ? .44 : .58, z: Math.max(9.6, 2.62 / (angle * aspect)), rose: 0, galet: 0};
}

function closeFrame(product, aspect) {
  const narrow = aspect < .9;
  const distance = Math.max(product.height / (2 * angle * (narrow ? .40 : .43)), 1.22 / (angle * aspect));
  return {
    x: product.x,
    y: product.y + product.height / 2 - (narrow ? .32 : .23) * distance * angle,
    z: product.z + distance,
    rose: Number(product.key === 'rose'),
    galet: Number(product.key === 'galet')
  };
}

function frame() {
  const aspect = camera.aspect;
  const progress = Number(stage.dataset.progress || 0);
  const gallery = galleryFrame(aspect);
  const galet = closeFrame(products[1], aspect);
  const rose = closeFrame(products[0], aspect);
  const first = progress < .48;
  const from = first ? gallery : galet;
  const to = first ? galet : rose;
  const weight = first ? MathUtils.smoothstep(progress, .065, .37)
    : MathUtils.smoothstep(progress, .51, .80);
  return Object.fromEntries(Object.keys(from).map(key => [key, MathUtils.lerp(from[key], to[key], weight)]));
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
  needsRender = true;
}

function updateHits() {
  camera.updateMatrixWorld();
  for (const product of products) {
    if (!product.button) continue;
    projected.set(product.x, product.y + product.height * .48, product.z).project(camera);
    const distance = camera.position.z - product.z;
    product.button.style.left = ((projected.x + 1) * 50) + '%';
    product.button.style.top = ((1 - projected.y) * 50) + '%';
    product.button.style.width = (width * 1.18 / (distance * angle * camera.aspect)) + 'px';
    product.button.style.height = (height * (product.height + .55) / (2 * angle * distance)) + 'px';
  }
}

function render(time) {
  resize();
  const dt = previousTime ? Math.min((time - previousTime) / 1000, .05) : .016;
  previousTime = time;
  if (modalBottle) {
    const t = (time - openedAt) / 1000;
    if (!needsRender && (reducedMotion.matches || t > 4)) return;
    needsRender = false;
    const demo = pointerStates.size || reducedMotion.matches ? 0 : Math.sin(t * 2.4) * Math.max(0, 1 - t / 4) * .32;
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
    focusTime = time;
    lastProduct = current;
  }
  if (!needsRender) return;
  const next = frame();
  shot ??= {...next};
  let moving = false;
  for (const key of Object.keys(shot)) {
    const c = MathUtils.damp(shot[key], next[key], 8, dt);
    moving ||= Math.abs(next[key] - c) > .001;
    shot[key] = reducedMotion.matches ? next[key] : c;
  }
  camera.position.set(shot.x, shot.y, shot.z);
  const elapsed = (time - focusTime) / 1000;
  const motion = current !== 'gallery' && !reducedMotion.matches && elapsed < 7;
  for (const product of products) {
    const emphasis = shot[product.key];
    const selected = current === product.key;
    const entry = reducedMotion.matches ? 0 : Math.sin(emphasis * Math.PI) * .31;
    const drift = selected && motion && pointerStates.size === 0 ? Math.sin(elapsed * 1.85) * .13 * Math.min(1, (7 - elapsed) / 1.5) : 0;
    product.pivot.rotation.set(selected ? manualTurn.x : 0,
      (selected ? manualTurn.y : 0) + entry + drift + (product.key === 'galet' ? -.07 : .08),
      selected && motion && pointerStates.size === 0 ? Math.sin(elapsed * 1.9) * .025 : 0);
    const otherFocus = Math.max(0, Math.max(shot.rose, shot.galet) - emphasis);
    product.group.position.x = product.x + Math.sign(product.x) * (otherFocus * 1.36);
    const secondary = 1 - otherFocus * .83;
    product.keyLight.intensity = (43 + emphasis * 50) * secondary;
    product.rimLight.intensity = (47 + emphasis * 62) * secondary;
  }
  if (current === 'gallery') updateHits();
  renderer.render(scene, camera);
  needsRender = moving || motion;
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
  needsRender = true;
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
  needsRender = true;
  mount.appendChild(renderer.domElement);
}

function controls(element, modal) {
  element.addEventListener('pointerdown', event => {
    if (!modal && stage.dataset.state === 'gallery') return;
    pointerStates.set(event.pointerId, {x: event.clientX, y: event.clientY});
    element.setPointerCapture(event.pointerId);
  });
  element.addEventListener('pointermove', event => {
    const previous = pointerStates.get(event.pointerId);
    if (!previous) return;
    const current = {x: event.clientX, y: event.clientY};
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
    needsRender = true;
  });
  function release(event) {
    pointerStates.delete(event.pointerId);
    needsRender = true;
  }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    element.addEventListener(event, release);
  }
  if (modal) element.addEventListener('wheel', event => {
    event.preventDefault();
    zoom = MathUtils.clamp(zoom + event.deltaY * .004, 5, 10);
    needsRender = true;
  }, {passive: false});
}

function wake() { needsRender = true; }

function fallback(error) {
  console.warn('3D showroom switched to image previews.', error);
  document.documentElement.classList.remove('glb-live');
  if (modalBottle) document.querySelector('#viewerFallback').hidden = false;
  stop();
  window.removeEventListener('perfume-scene-change', wake);
  window.removeEventListener('perfume-progress', wake);
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
    window.addEventListener('perfume-scene-change', wake);
    window.addEventListener('perfume-progress', wake);
    window.Perfume3D = {open, stop};
    renderer.setAnimationLoop(render);
  } catch (error) {
    fallback(error);
  }
}

start();
