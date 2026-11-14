import {
  ACESFilmicToneMapping, AmbientLight, Box3, BoxGeometry, CanvasTexture, Color,
  DoubleSide, Group, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene, SpotLight, SRGBColorSpace,
  Vector3, WebGLRenderer, GLTFLoader, RoomEnvironment, Reflector
} from './three-showroom.js?v=2';

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
const polishedStone = new MeshStandardMaterial({
  map: stone, color: '#c5b9c9', metalness: .22, roughness: .32
});
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
const wallReflectors = [];
const lampWhite = new Color('#fff4ed');
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

// Sample the neighbouring surfaces through a mirrored camera, then blend the
// blurred highlights into the stone instead of replacing its texture.
function addSideReflection(group, sign) {
  const wall = new Reflector(new PlaneGeometry(depth - .10, bayHeight - .17), {
    color: 0x8e7f91, clipBias: .003, textureWidth: 384, textureHeight: 384, multisample: 0
  });
  wall.rotation.y = -sign * Math.PI / 2;
  wall.position.set(sign * (bayWidth / 2 - .102), -.02, centerZ - .015);
  wall.material.transparent = true;
  wall.material.depthWrite = false;
  wall.material.uniforms.strength = {value: 0};
  wall.material.fragmentShader = wall.material.fragmentShader
    .replace('uniform vec3 color;', 'uniform vec3 color; uniform float strength;')
    .replace('vec4 base = texture2DProj( tDiffuse, vUv );', `
      vec2 uv = vUv.xy / vUv.w;
      vec2 spread = vec2(.009, .006);
      vec4 base = texture2D(tDiffuse, uv) * .34
        + (texture2D(tDiffuse, uv + spread) + texture2D(tDiffuse, uv - spread)
        + texture2D(tDiffuse, uv + spread * vec2(1., -1.))
        + texture2D(tDiffuse, uv + spread * vec2(-1., 1.))) * .165;
      float highlight = max(max(base.r, base.g), base.b);
    `)
    .replace('blendOverlay( base.rgb, color ), 1.0',
      'blendOverlay( base.rgb, color ), strength * smoothstep(.014, .43, highlight)');

  const renderReflection = wall.onBeforeRender.bind(wall);
  wall.onBeforeRender = (renderer, scene, activeCamera) => {
    if (activeCamera !== camera || renderer.getRenderTarget()) return;
    const others = wallReflectors.filter(panel => panel !== wall && panel.visible);
    for (const panel of others) panel.visible = false;
    try {
      renderReflection(renderer, scene, activeCamera);
    } finally {
      for (const panel of others) panel.visible = true;
    }
  };
  wall.visible = false;
  wallReflectors.push(wall);
  group.add(wall);
  return wall;
}

const lampHalo = makeTexture(256, 128, (ctx, width, height) => {
  ctx.translate(width / 2, height / 2);
  ctx.scale(width / 2, height / 2);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, 'rgba(255,255,255,.74)');
  gradient.addColorStop(.45, 'rgba(255,255,255,.29)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(-1, -1, 2, 2);
});

function addBay(product) {
  const group = new Group();
  group.position.x = product.x;
  cabinet.add(group);
  box(group, inside, [bayWidth, bayHeight, .15], [0, 0, backZ]);
  box(group, polishedStone, [.20, bayHeight, depth], [-bayWidth / 2, 0, centerZ]);
  box(group, polishedStone, [.20, bayHeight, depth], [bayWidth / 2, 0, centerZ]);
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

  const light = new SpotLight(product.tone, 31, 7.3, .78, .63, 2);
  light.position.set(0, 2.20, -.42);
  light.target.position.set(0, -1.7, -1.55);
  group.add(light, light.target);
  const bulb = new MeshBasicMaterial({color: product.tone, toneMapped: false});
  box(group, trim, [.94, .095, .42], [0, 2.289, -.41]);
  box(group, bulb, [.75, .046, .28], [0, 2.224, -.41]);
  const bloomMat = new MeshBasicMaterial({
    map: lampHalo, color: product.tone, transparent: true, depthWrite: false, toneMapped: false
  });
  const lampBloom = new Mesh(new PlaneGeometry(1.09, .38), bloomMat);
  lampBloom.position.set(0, 2.216, -.239);
  group.add(lampBloom);
  const sides = [-1, 1].map(sign => addSideReflection(group, sign));
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
  Object.assign(product, {group, anchor, light, glowMat, bulb, bloomMat, sides, cover});
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
let renderer, modalBottle, inspected = false, reflectiveWalls = false, zoom = 6.7;
const pointers = new Map();
let width = 0, height = 0, needsRender = true, settled = false;
let startedAt = 0, checkpoint, destination;
const shot = {x: 0, y: 0, z: 14.4, shift: 0, rose: 0, galet: 0};
const angle = Math.tan(MathUtils.degToRad(camera.fov / 2));

function frameTarget() {
  const selected = products.find(p => p.key === stage.dataset.state);
  const aspect = Math.max(.2, mount.clientWidth / Math.max(1, mount.clientHeight));
  const mobile = matchMedia('(max-width: 660px)').matches;
  const compact = mount.clientHeight < 700;
  const focusHeight = mobile ? (compact ? .65 : .71) : 1.08;
  const distanceForHeight = bayHeight / (2 * angle * focusHeight) + backZ + .95;
  const distanceForWidth = 1.13 / (angle * aspect * (mobile ? .87 : .70)) - .62;
  const galleryDistance = Math.max(14.0, 3.55 / (angle * aspect * (mobile ? .86 : .73)));
  const z = selected ? Math.max(distanceForHeight, distanceForWidth) : galleryDistance;
  const frameY = mobile ? (selected ? .31 : .43) : (selected ? .36 : .50);
  return {
    x: selected?.x ?? 0,
    y: (frameY * 2 - 1) * z * angle,
    z,
    shift: selected && !mobile ? -.32 : 0,
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
  const elapsed = reducedMotion.matches ? 1 : MathUtils.clamp((time - startedAt) / 1050, 0, 1);
  const eased = elapsed < .5 ? 4 * elapsed ** 3 : 1 - (-2 * elapsed + 2) ** 3 / 2;
  for (const key of Object.keys(shot)) shot[key] = MathUtils.lerp(checkpoint[key], destination[key], eased);
  camera.position.set(shot.x, shot.y, shot.z);
  camera.filmOffset = shot.shift * angle * camera.aspect * camera.getFilmWidth();
  camera.updateProjectionMatrix();
  const activeLight = shot.rose + shot.galet;
  for (const product of products) {
    const emphasis = shot[product.key];
    const fade = Math.max(0, activeLight - emphasis);
    const power = 1 - fade;
    product.light.intensity = (33 + emphasis * 119) * power;
    product.glowMat.opacity = (.34 + emphasis * .30) * power;
    product.bloomMat.opacity = (.65 + emphasis * .35) * power;
    product.bulb.color.set(product.tone).lerp(lampWhite, .36 + emphasis * .55);
    product.bulb.color.multiplyScalar((.88 + emphasis * .38) * power);
    for (const side of product.sides) {
      side.visible = reflectiveWalls && emphasis > .13 && fade < .45;
      side.material.uniforms.strength.value = emphasis * .64;
    }
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
    reflectiveWalls = renderer.extensions.has('EXT_color_buffer_float');
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
