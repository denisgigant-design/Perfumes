import {
  ACESFilmicToneMapping, AmbientLight, Box3, BoxGeometry, CanvasTexture, Color,
  DoubleSide, Group, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene, SpotLight, SRGBColorSpace,
  Vector3, WebGLRenderer, GLTFLoader, RoomEnvironment
} from './three-showroom.js';

const stage = document.querySelector('#stage');
const mount = document.querySelector('#showroom3d');
const inspector = document.querySelector('#three-canvas');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const scene = new Scene();
const camera = new PerspectiveCamera(34, 1, 0.07, 65);
const cabinet = new Group();
scene.add(cabinet);
scene.background = new Color('#08070a');

function makeTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const stone = makeTexture(384, 512, (ctx, w, h) => {
  let seed = 23;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const texture = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const swirl = Math.sin(y * .034 + x * .025 + 2 * Math.sin(y * .027 - x * .018));
      const grain = 47 + random() * 15 + 7 * swirl + 5 * Math.sin(x * .083 + y * .019);
      const i = (y * w + x) * 4;
      texture.data.set([grain, grain * .96, grain * 1.06, 255], i);
    }
  }
  ctx.putImageData(texture, 0, 0);
  for (let j = 0; j < 58; j++) {
    const x = random() * w;
    const y = random() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 18, y - 35, x + 65, y - 100, x + 145, y - 125);
    ctx.lineWidth = .25 + random() * .9;
    ctx.strokeStyle = j % 3 ? 'rgba(186,179,197,.075)' : 'rgba(10,8,14,.26)';
    ctx.stroke();
  }
});

const contact = makeTexture(128, 128, (ctx, w) => {
  const gradient = ctx.createRadialGradient(w / 2, w / 2, 4, w / 2, w / 2, w / 2);
  gradient.addColorStop(0, 'rgba(0,0,0,.90)');
  gradient.addColorStop(.42, 'rgba(0,0,0,.56)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, w);
});

const mineral = new MeshStandardMaterial({map: stone, color: '#aaa2ad', roughness: .87});
const inside = new MeshStandardMaterial({map: stone, color: '#d6cbd4', roughness: .79});
const casing = new MeshStandardMaterial({map: stone, color: '#504952', metalness: .19, roughness: .5});
const trim = new MeshStandardMaterial({color: '#282225', metalness: .57, roughness: .37});
const ledge = new MeshStandardMaterial({map: stone, color: '#8c8187', metalness: .15, roughness: .55});

function box(parent, material, dimensions, position) {
  const mesh = new Mesh(new BoxGeometry(...dimensions), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

const bayHeight = 4.92;
const bayWidth = 2.50;
const shelfY = -2.46;
const backZ = -2.52;
const frontZ = .02;
const centerZ = (backZ + frontZ) / 2;
const depth = frontZ - backZ;
const products = [
  {key: 'rose', file: 'rose-lune.glb', x: -1.60, tone: '#ffb0ce', height: 2.79},
  {key: 'galet', file: 'galet.glb', x: 1.60, tone: '#e6f8d3', height: 2.77}
];

box(cabinet, casing, [27, 5.2, .36], [-16.45, 0, .15]);
box(cabinet, casing, [27, 5.2, .36], [16.45, 0, .15]);
box(cabinet, casing, [40, .50, .62], [0, 2.72, .17]);
box(cabinet, casing, [40, .56, .72], [0, -2.74, .22]);
box(cabinet, casing, [.68, 5.2, .46], [0, 0, .11]);
box(cabinet, trim, [40, .016, .06], [0, -2.50, .61]);
box(cabinet, mineral, [60, .18, 26], [0, -3.08, 4]);

function addBay(product) {
  const group = new Group();
  group.position.x = product.x;
  cabinet.add(group);
  box(group, inside, [bayWidth, bayHeight, .15], [0, 0, backZ]);
  box(group, mineral, [.20, bayHeight, depth], [-bayWidth / 2, 0, centerZ]);
  box(group, mineral, [.20, bayHeight, depth], [bayWidth / 2, 0, centerZ]);
  box(group, mineral, [bayWidth, .16, depth], [0, bayHeight / 2, centerZ]);
  box(group, ledge, [bayWidth, .16, depth], [0, shelfY - .08, centerZ]);
  for (const sign of [-1, 1]) {
    box(group, trim, [.025, bayHeight, .075], [sign * (bayWidth / 2 - .103), 0, -.015]);
  }

  const glow = makeTexture(256, 512, (ctx, w, h) => {
    ctx.save();
    ctx.translate(w * .5, h * .25);
    ctx.scale(w * .43, h * .68);
    const wash = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    wash.addColorStop(0, 'rgba(255,255,255,.89)');
    wash.addColorStop(.27, 'rgba(255,255,255,.49)');
    wash.addColorStop(.62, 'rgba(255,255,255,.18)');
    wash.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(-1.2, -.45, 2.4, 1.5);
    ctx.restore();
  });
  const glowMat = new MeshBasicMaterial({
    map: glow, color: product.tone, opacity: .26, transparent: true,
    depthWrite: false, toneMapped: false
  });
  const wallGlow = new Mesh(new PlaneGeometry(2.27, 4.8), glowMat);
  wallGlow.position.set(0, 0, backZ + .082);
  group.add(wallGlow);

  const light = new SpotLight(product.tone, 21, 9, .61, .77, 2);
  light.position.set(0, 2.28, -.65);
  light.target.position.set(0, -1.9, -1.50);
  group.add(light, light.target);
  const bulb = new MeshBasicMaterial({color: product.tone, toneMapped: false});
  box(group, trim, [.72, .065, .26], [0, 2.32, -.65]);
  box(group, bulb, [.52, .026, .16], [0, 2.274, -.65]);
  const shadow = new Mesh(
    new PlaneGeometry(2.12, 1.39),
    new MeshBasicMaterial({map: contact, transparent: true, depthWrite: false})
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, shelfY + .008, -1.16);
  group.add(shadow);

  // Blend the neighbouring opening into the front wall for a single-shelf close-up.
  const coverMat = casing.clone();
  coverMat.transparent = true;
  coverMat.depthWrite = false;
  const cover = box(cabinet, coverMat, [bayWidth + .04, bayHeight, .02], [product.x, 0, .31]);
  cover.visible = false;

  const anchor = new Group();
  anchor.position.set(0, shelfY + .012, -1.24);
  group.add(anchor);
  Object.assign(product, {group, anchor, light, glowMat, bulb, cover});
}

products.forEach(addBay);

function galetLabel() {
  const map = makeTexture(512, 256, (ctx, width, height) => {
    const paper = ctx.createLinearGradient(0, 0, width, height);
    paper.addColorStop(0, '#fff1cb');
    paper.addColorStop(1, '#c9b48b');
    ctx.fillStyle = paper;
    ctx.fillRect(2, 2, width - 4, height - 4);
    ctx.strokeStyle = '#9a7950';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, width - 24, height - 24);
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 20, width - 40, height - 40);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#30261c';
    ctx.font = '20px Georgia';
    ctx.fillText('A T E L I E R', 256, 62);
    ctx.font = '63px Georgia';
    ctx.fillText('G A L E T', 256, 149);
    ctx.font = '17px Georgia';
    ctx.fillText('E X T R A I T  D E  P A R F U M', 256, 208);
  });
  const label = new Mesh(new PlaneGeometry(.039, .0195),
    new MeshStandardMaterial({map, roughness: .73, metalness: .02}));
  label.position.set(0, .0355, .02425);
  label.renderOrder = 8;
  return label;
}

async function loadBottle(product, loader) {
  const {scene: bottle} = await loader.loadAsync(new URL(product.file, import.meta.url).href);
  if (product.key === 'galet') bottle.add(galetLabel());
  const bounds = new Box3().setFromObject(bottle);
  const scale = product.height / (bounds.max.y - bounds.min.y);
  const center = bounds.getCenter(new Vector3());
  bottle.position.set(-center.x * scale * .87, -bounds.min.y * scale, -center.z * scale);
  bottle.scale.set(scale * .87, scale, scale);
  product.anchor.add(bottle);
  product.bottle = bottle;
  // Give the liquid a readable body in the dark room while the glass remains transmissive.
  bottle.traverse(mesh => {
    if (!mesh.isMesh) return;
    const material = mesh.material;
    if (/eau de parfum/.test(material.name)) {
      material.emissive.copy(material.color);
      material.emissiveIntensity = product.key === 'rose' ? .22 : .20;
      material.envMapIntensity = 1.20;
    }
    if (/crystal/.test(material.name)) {
      material.envMapIntensity = 1.33;
      material.side = DoubleSide;
    }
  });
}

const closeup = new Scene();
closeup.background = new Color('#121119');
const closeupCamera = new PerspectiveCamera(34, 1, .07, 35);
const inspection = new Group();
closeup.add(inspection);
let renderer, modalBottle, inspected = false, zoom = 6.7;
const pointers = new Map();
let width = 0, height = 0, needsRender = true, settled = false;
let startedAt = 0, checkpoint, destination;
const shot = {x: 0, y: 0, z: 13.7, rose: 0, galet: 0};
const angle = Math.tan(MathUtils.degToRad(camera.fov / 2));

function frameTarget() {
  const selected = products.find(p => p.key === stage.dataset.state);
  const aspect = Math.max(.2, mount.clientWidth / Math.max(1, mount.clientHeight));
  const mobile = matchMedia('(max-width: 660px)').matches;
  const compact = mount.clientHeight < 700;
  const focusHeight = mobile ? (compact ? .48 : .54) : .86;
  const closeDistance = Math.max(bayHeight / (2 * angle * focusHeight) + backZ + 1.08,
    1.6 / (angle * aspect * (mobile ? .91 : .72)) - 1.24);
  const galleryDistance = Math.max(mobile ? 8.9 : 11.6, 3.45 / (angle * aspect * (mobile ? .94 : .78)));
  const z = selected ? closeDistance : galleryDistance;
  const halfWidth = z * angle * aspect;
  const halfHeight = z * angle;
  const frameY = mobile ? (selected ? .34 : .42) : (selected ? .51 : .49);
  return {
    x: (selected?.x ?? 0) - halfWidth * (selected && !mobile ? .29 : 0),
    y: -.02 + (frameY * 2 - 1) * halfHeight,
    z,
    rose: selected?.key === 'rose' ? 1 : 0,
    galet: selected?.key === 'galet' ? 1 : 0
  };
}

function moveCamera() {
  checkpoint = {...shot};
  destination = frameTarget();
  startedAt = performance.now();
  settled = false;
}

function resize() {
  const container = inspected ? inspector : mount;
  const nextWidth = container.clientWidth;
  const nextHeight = container.clientHeight;
  if (!nextWidth || !nextHeight || (width === nextWidth && height === nextHeight)) return;
  width = nextWidth;
  height = nextHeight;
  const active = inspected ? closeupCamera : camera;
  active.aspect = width / height;
  active.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  needsRender = true;
  if (!inspected) moveCamera();
}

function render(time) {
  resize();
  if (inspected) {
    if (!needsRender) return;
    needsRender = false;
    closeupCamera.position.set(0, 1.47, zoom);
    closeupCamera.lookAt(0, 1.43, 0);
    renderer.render(closeup, closeupCamera);
    return;
  }
  if (settled) return;
  const elapsed = reducedMotion.matches ? 1 : Math.min(1, (time - startedAt) / 1120);
  const eased = elapsed < .5 ? 4 * elapsed ** 3 : 1 - (-2 * elapsed + 2) ** 3 / 2;
  for (const key of Object.keys(shot)) shot[key] = MathUtils.lerp(checkpoint[key], destination[key], eased);
  camera.position.set(shot.x, shot.y, shot.z);
  const activeLight = shot.rose + shot.galet;
  for (const product of products) {
    const emphasis = shot[product.key];
    const fade = Math.max(0, activeLight - emphasis);
    product.light.intensity = (24 + emphasis * 44) * (1 - fade * .96);
    product.glowMat.opacity = (.30 + emphasis * .34) * (1 - fade * .985);
    product.bulb.color.set(product.tone).multiplyScalar(1 - fade * .94);
    product.anchor.visible = fade < .83;
    product.group.visible = fade < .996;
    product.cover.visible = fade > .001;
    product.cover.material.opacity = fade;
    product.cover.material.depthWrite = fade > .996;
  }
  renderer.render(scene, camera);
  settled = elapsed === 1;
}

function open(key) {
  const product = products.find(item => item.key === key);
  if (!product?.bottle) return Promise.reject(new Error('Bottle unavailable'));
  modalBottle = product.bottle.clone();
  inspection.add(modalBottle);
  inspection.rotation.set(0, 0, 0);
  zoom = 6.7;
  inspected = true;
  width = 0;
  inspector.appendChild(renderer.domElement);
  return Promise.resolve();
}

function stop() {
  if (!inspected) return;
  inspected = false;
  inspection.remove(modalBottle);
  modalBottle = null;
  pointers.clear();
  width = 0;
  mount.appendChild(renderer.domElement);
}

function controls(canvas) {
  canvas.addEventListener('pointerdown', event => {
    if (!inspected) return;
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const current = {x: event.clientX, y: event.clientY};
    if (pointers.size === 1) {
      inspection.rotation.y += (current.x - previous.x) * .012;
      inspection.rotation.x = MathUtils.clamp(
        inspection.rotation.x + (current.y - previous.y) * .007, -.50, .50);
    } else if (pointers.size === 2) {
      const other = [...pointers.values()].find(point => point !== previous);
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(current.x - other.x, current.y - other.y);
      zoom = MathUtils.clamp(zoom + (before - after) * .018, 5.0, 10);
    }
    pointers.set(event.pointerId, current);
    needsRender = true;
  });
  const clearPointer = event => pointers.delete(event.pointerId);
  canvas.addEventListener('pointerup', clearPointer);
  canvas.addEventListener('pointercancel', clearPointer);
  canvas.addEventListener('lostpointercapture', clearPointer);
  canvas.addEventListener('wheel', event => {
    if (!inspected) return;
    event.preventDefault();
    zoom = MathUtils.clamp(zoom + event.deltaY * .004, 5.0, 10);
    needsRender = true;
  }, {passive: false});
}

function fallback(error) {
  console.warn('3D showroom switched to image previews.', error);
  document.documentElement.classList.remove('glb-live');
  if (inspected) document.querySelector('#viewerFallback').hidden = false;
  stop();
  renderer?.setAnimationLoop(null);
  renderer?.domElement.remove();
  renderer?.dispose();
  delete window.Perfume3D;
}

async function start() {
  try {
    renderer = new WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth <= 660 ? 1.25 : 1.5));
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.33;
    renderer.transmissionResolutionScale = .65;
    const studio = new RoomEnvironment();
    const pmrem = new PMREMGenerator(renderer);
    const environment = pmrem.fromScene(studio, .04);
    pmrem.dispose();
    studio.dispose();
    scene.environment = closeup.environment = environment.texture;
    scene.environmentIntensity = .36;
    closeup.environmentIntensity = 1.0;
    scene.add(new AmbientLight('#c5bed3', .22));
    closeup.add(new AmbientLight('#fff4ed', .95));
    await Promise.all(products.map(product => loadBottle(product, new GLTFLoader())));
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      fallback(event);
    }, {once: true});
    controls(renderer.domElement);
    mount.appendChild(renderer.domElement);
    moveCamera();
    Object.assign(shot, destination);
    document.documentElement.classList.add('glb-live');
    window.addEventListener('perfume-scene-change', moveCamera);
    window.Perfume3D = {open, stop};
    renderer.setAnimationLoop(render);
  } catch (error) {
    fallback(error);
  }
}

start();
