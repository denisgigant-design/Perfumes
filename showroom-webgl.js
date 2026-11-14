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

const stone = makeTexture(512, 512, (ctx, w, h) => {
  let seed = 23;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Layer broad mineral clusters, smaller grains and fine pits.
  function noise(size) {
    const grid = Array.from({length: size * size}, random);
    return (x, y) => {
      const u = x * size, v = y * size;
      const ix = Math.floor(u), iy = Math.floor(v);
      const sx = MathUtils.smoothstep(u - ix, 0, 1);
      const sy = MathUtils.smoothstep(v - iy, 0, 1);
      const sample = (a, b) => grid[(b % size) * size + a % size];
      return MathUtils.lerp(
        MathUtils.lerp(sample(ix, iy), sample(ix + 1, iy), sx),
        MathUtils.lerp(sample(ix, iy + 1), sample(ix + 1, iy + 1), sx), sy
      );
    };
  }
  const [clusters, chips, crystals, pits] = [7, 29, 111, 260].map(noise);
  const texture = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const chip = chips(u, v);
      const crystal = crystals(u, v);
      const mica = Math.max(0, (crystal - .66) * 2.9);
      const grain = 28 + clusters(u, v) * 47 + chip * 36
        + mica * (54 + chip * 44) + (pits(u, v) - .5) * 36
        - (crystal < .19 ? 15 : 0);
      const i = (y * w + x) * 4;
      texture.data[i] = grain * 1.025;
      texture.data[i + 1] = grain;
      texture.data[i + 2] = grain * .973;
      texture.data[i + 3] = 255;
    }
  }
  ctx.putImageData(texture, 0, 0);
});
const relief = stone.clone();
relief.colorSpace = '';
relief.needsUpdate = true;

const contact = makeTexture(128, 128, (ctx, w) => {
  const gradient = ctx.createRadialGradient(w / 2, w / 2, 4, w / 2, w / 2, w / 2);
  gradient.addColorStop(0, 'rgba(0,0,0,.90)');
  gradient.addColorStop(.42, 'rgba(0,0,0,.56)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, w);
});

const stoneMaterial = (color, roughness, bumpScale) => new MeshStandardMaterial({
  color, map: stone, roughness, bumpMap: relief, bumpScale
});
const mineral = stoneMaterial('#b8adaa', .91, .15);
const inside = stoneMaterial('#d9ccc0', .88, .13);
const casing = stoneMaterial('#aca19a', .92, .17);
const polishedStone = stoneMaterial('#c5b8ab', .48, .06);
const ledge = stoneMaterial('#b6a89f', .69, .095);
const lampHousing = new MeshStandardMaterial({color: '#1b1713', roughness: .62});

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
  {key: 'galet', file: 'galet-tripo.glb', x: 1.60, tone: '#f3f1da', height: 2.77, yaw: -Math.PI / 2}
];

// A continuous granite face around both openings. All face pieces share a
// world-aligned texture so the joins read as one wall.
function stoneUV(mesh, originX = 0) {
  const positions = mesh.geometry.attributes.position;
  const uv = mesh.geometry.attributes.uv;
  for (let i = 0; i < positions.count; i++) {
    uv.setXY(i, (positions.getX(i) + mesh.position.x + originX) / 12 + .5,
      (positions.getY(i) + mesh.position.y) / 6 + .5);
  }
  uv.needsUpdate = true;
}
function facade(parent, dimensions, position) {
  const panel = box(parent, casing, dimensions, position);
  stoneUV(panel);
  return panel;
}
facade(cabinet, [3.25, 5.2, .36], [-4.487, 0, .15]);
facade(cabinet, [3.25, 5.2, .36], [4.487, 0, .15]);
box(cabinet, casing, [24, 5.2, .36], [-18.06, 0, .15]);
box(cabinet, casing, [24, 5.2, .36], [18.06, 0, .15]);
facade(cabinet, [12.2, .46, .36], [0, 2.77, .15]);
facade(cabinet, [12.2, .59, .36], [0, -2.835, .15]);
facade(cabinet, [.676, 5.2, .36], [0, 0, .15]);
box(cabinet, mineral, [60, .18, 26], [0, -3.17, 4]);

// The chiseled bevel joins the granite face to the deeper, more polished cut.
function addCarvedEdge(group, product) {
  const seamX = bayWidth / 2 + .012;
  for (const sign of [-1, 1]) {
    for (const vertical of [true, false]) {
      const geometry = new PlaneGeometry(1, 1, 1, 26);
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const inner = positions.getX(i) > 0;
        const t = positions.getY(i);
        const roughness = Math.sin(t * 60) * .014 + Math.sin(t * 139) * .008;
        const x = vertical ? sign * (inner ? 1.142 + roughness : seamX)
          : t * (inner ? 2.292 : seamX * 2);
        const y = vertical ? t * (inner ? 4.72 : 5.10)
          : sign * (inner ? 2.36 + roughness : 2.55);
        positions.setXYZ(i, x, y, inner ? -.20 + roughness : .331);
      }
      geometry.computeVertexNormals();
      const face = new Mesh(geometry, carvedStone);
      stoneUV(face, product.x);
      group.add(face);
    }
  }
}
const carvedStone = casing.clone();
carvedStone.side = DoubleSide;

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
  addCarvedEdge(group, product);

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

  const light = new SpotLight(product.tone, 44, 7.3, .78, .63, 2);
  light.position.set(0, 2.20, -.42);
  light.target.position.set(0, -1.7, -1.55);
  const fill = new SpotLight(lampWhite, 0, 6, .60, .68, 2);
  fill.position.set(.83, 1.78, -.29);
  fill.target.position.set(0, -1.1, -1.30);
  group.add(light, light.target, fill, fill.target);
  const bulb = new MeshBasicMaterial({color: product.tone, toneMapped: false});
  box(group, lampHousing, [1.6, .055, .31], [0, 2.415, -.55]);
  box(group, bulb, [1.45, .015, .075], [0, 2.381, -.61]);
  // A front stone lip conceals the fixture; the light washes down the niche.
  box(group, casing, [2.31, .18, .39], [0, 2.34, -.28]);
  const bloomMat = new MeshBasicMaterial({
    map: lampHalo, color: product.tone, transparent: true, depthWrite: false, toneMapped: false
  });
  const lampBloom = new Mesh(new PlaneGeometry(1.09, .38), bloomMat);
  lampBloom.position.set(0, 2.235, -.522);
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
  const cover = box(cabinet, coverMat, [bayWidth + .025, 5.1, .02], [product.x, 0, .342]);
  stoneUV(cover);
  cover.visible = false;

  const anchor = new Group();
  anchor.position.set(0, shelfY + .012, -1.24);
  group.add(anchor);
  Object.assign(product, {group, anchor, light, fill, glowMat, bulb, bloomMat, sides, cover});
}

products.forEach(addBay);

async function loadBottle(product, loader) {
  const {scene: model} = await loader.loadAsync(new URL(product.file, import.meta.url).href);
  model.rotation.y = product.yaw ?? 0;
  const bottle = new Group();
  bottle.add(model);
  const bounds = new Box3().setFromObject(bottle);
  const scale = product.height / (bounds.max.y - bounds.min.y);
  const center = bounds.getCenter(new Vector3());
  const horizontalScale = product.key === 'galet' ? scale : scale * .87;
  bottle.position.set(-center.x * horizontalScale, -bounds.min.y * scale, -center.z * scale);
  bottle.scale.set(horizontalScale, scale, scale);
  product.anchor.add(bottle);
  product.bottle = bottle;
  // Give the liquid a readable body in the dark room while the glass remains transmissive.
  bottle.traverse(mesh => {
    if (!mesh.isMesh) return;
    const material = mesh.material;
    if (product.key === 'galet') {
      material.envMapIntensity = 1.15;
      material.normalScale.setScalar(.73);
    }
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
const shot = {x: 0, y: 0, z: 14.4, rose: 0, galet: 0};
const angle = Math.tan(MathUtils.degToRad(camera.fov / 2));

function frameTarget() {
  const selected = products.find(p => p.key === stage.dataset.state);
  const aspect = Math.max(.2, mount.clientWidth / Math.max(1, mount.clientHeight));
  const mobile = matchMedia('(max-width: 660px)').matches;
  const compact = mount.clientHeight < 700;
  const galleryDistance = Math.max(14.0, 3.55 / (angle * aspect * (mobile ? .86 : .73)));
  if (!selected) {
    const y = mobile ? (.43 * 2 - 1) * galleryDistance * angle : 0;
    return {x: 0, y, z: galleryDistance, rose: 0, galet: 0};
  }
  const bottleFraction = mobile ? (compact ? .28 : .32) : .42;
  const distanceForHeight = selected.height / (2 * angle * bottleFraction) - 1.24;
  const distanceForWidth = 1.14 / (angle * aspect * .93) - .55;
  const z = Math.max(distanceForHeight, distanceForWidth);
  const frameY = mobile ? .33 : .34;
  return {
    x: selected.x,
    y: shelfY + selected.height / 2 + (frameY * 2 - 1) * (z + 1.24) * angle,
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
    const distance = zoom * Math.max(1, .61 / closeupCamera.aspect);
    closeupCamera.position.set(0, .04, distance);
    closeupCamera.lookAt(0, 0, 0);
    renderer.render(closeup, closeupCamera);
    return;
  }
  if (settled) return;
  const elapsed = reducedMotion.matches ? 1 : MathUtils.clamp((time - startedAt) / 1050, 0, 1);
  const eased = elapsed < .5 ? 4 * elapsed ** 3 : 1 - (-2 * elapsed + 2) ** 3 / 2;
  for (const key of Object.keys(shot)) shot[key] = MathUtils.lerp(checkpoint[key], destination[key], eased);
  camera.position.set(shot.x, shot.y, shot.z);
  const activeLight = shot.rose + shot.galet;
  for (const product of products) {
    const emphasis = shot[product.key];
    const fade = Math.max(0, activeLight - emphasis);
    const power = 1 - fade;
    product.light.intensity = (44 + emphasis * 118) * power;
    product.fill.intensity = emphasis * (product.key === 'galet' ? 38 : 20) * power;
    product.glowMat.opacity = (.30 + emphasis * .23) * power;
    product.bloomMat.opacity = (.40 + emphasis * .32) * power;
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
  modalBottle.position.y -= product.height / 2;
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
    scene.add(new AmbientLight('#e8ded6', .42));
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
