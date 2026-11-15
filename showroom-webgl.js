import {makeWater} from './water.js?v=2';
import {addLiquidRefraction, bindLiquidCamera} from './glass-volume.js';
import {
  ACESFilmicToneMapping, AmbientLight, Box3, BoxGeometry, CanvasTexture, Color, DoubleSide, GLTFLoader,
  Group, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera,
  PlaneGeometry, PMREMGenerator, Reflector, RoomEnvironment, Scene, SpotLight, SRGBColorSpace, Vector3, WebGLRenderer
} from './three-showroom.js?v=2';

const compactLayout = innerWidth < 680;
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

// The four GLBs sit inside physically modelled niches, rather than floating on platforms.
// x/y are the centres of the shelf floors; the z-axis is negative inside the wall.
const products = [
  {key: 'galet', file: 'galet-crystal.glb', x: -3.18, y: .44, z: -.62, height: 2.61,
    tone: '#b6dc78', glass: '#f1f8e9', absorption: '#abb68a', liquid: '#59662f',
    distance: 1.18, thickness: .012, rest: -.10, shape: [1.1, .95, 2.0]},
  {key: 'rose', file: 'rose-lune-smoked.glb', x: 3.18, y: .44, z: -.62, height: 2.61,
    tone: '#e28ca2', glass: '#eee2e5', absorption: '#aa7e89', liquid: '#7e3b50',
    distance: 1.16, thickness: .016, rest: .08, shape: [1.02, .89, 2.65]},
  {key: 'bleu', file: 'sillage-bleu.glb', x: -3.18, y: -4.25, z: -.62, height: 3.14,
    tone: '#709ff2', glass: '#e4edf6', absorption: '#839ebc', liquid: '#354966',
    distance: 1.15, thickness: .011, rest: -.12, shape: [.94, 1.13, 2.4]},
  {key: 'ambre', file: 'ambre-dore.glb', x: 3.18, y: -4.25, z: -.62, height: 2.75,
    tone: '#ffc068', glass: '#fff1d4', absorption: '#d9b26b', liquid: '#986422',
    distance: 1.32, thickness: .014, rest: .08, shape: [1.0, 1.04, 3.05]}
];

const angle = Math.tan(MathUtils.degToRad(camera.fov / 2));
const pointerStates = new Map();
const lightingPointer = {x: 0, y: 0, targetX: 0, targetY: 0};
const manualTurn = {x: 0, y: 0};
const projected = new Vector3();
const worldPoint = new Vector3();
const hoverGap = .045;
const flightOrder = ['galet', 'rose', 'bleu', 'ambre'];
let renderer, studioReflection, modalBottle, modalProduct, water, shelves;
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

// Black stone recesses are assembled from real geometry: thick exterior piers,
// deep top/bottom reveals, a back wall, reflective inner side panels and floor slabs.
// No 2D image, no freestanding display plinths.
function createWall() {
  const wall = new Group();
  const masonry = new MeshStandardMaterial({
    color:'#16191b', metalness:.27, roughness:.61, bumpMap:satinMap, bumpScale:.055
  });
  const reveal = new MeshStandardMaterial({
    color:'#34383b', metalness:.68, roughness:.22, bumpMap:satinMap, bumpScale:.011,
    envMapIntensity:1.32
  });
  const onyx = new MeshStandardMaterial({
    color:'#101315', metalness:.46, roughness:.34, bumpMap:satinMap, bumpScale:.018
  });
  const silver = new MeshStandardMaterial({
    color:'#a8a4a0', metalness:.92, roughness:.21, envMapIntensity:1.23
  });
  const insetGold = new MeshStandardMaterial({
    color:'#a3947e', metalness:.78, roughness:.29
  });
  function block(material, size, at, group=wall) {
    const mesh = new Mesh(new BoxGeometry(...size),material);
    mesh.position.set(...at);
    group.add(mesh);
    return mesh;
  }
  // Entire structural body, behind the four carved voids.
  block(masonry, [14.15, 11.45, .62], [0, .05, -2.65]);
  // Outer stone piers, solid middle column, and horizontal transoms.
  for (const x of [-6.77, 0, 6.77]) {
    block(masonry, [x===0 ? .72 : .67, 11.35, 3.55], [x, .05, -.55]);
  }
  for (const [y, thickness] of [[5.38,.75], [.05,.50], [-5.29,.72]]) {
    block(masonry, [14.15, thickness, 3.55], [0,y,-.55]);
  }
  block(onyx, [14.3, .38, 4.0], [0, -5.58, -.55]);
  const bayLights = new Map();
  for (const product of products) {
    const cx=product.x, bottom=product.y, centerY=bottom+2.22;
    const bay = new Group(); wall.add(bay);
    // The back wall is deep, so the niche has true parallax as the camera moves.
    block(onyx, [5.75,4.36,.12],[cx,centerY,-2.25],bay);
    block(reveal, [5.74,.12,3.20],[cx,bottom-.10,-.60],bay); // bottom ledge
    block(reveal, [5.74,.09,3.20],[cx,bottom+4.48,-.60],bay); // ceiling
    const sides=[], mirrors=[];
    for (const dir of [-1,1]) {
      const side=block(reveal,[.085,4.39,3.22],[cx+dir*2.84,centerY,-.60],bay);
      sides.push(side);
      // Actual planar mirror renders are enabled only for the selected niche.
      // Gallery uses the inexpensive polished-metal finish for four visible bays.
      const mirror=new Reflector(new PlaneGeometry(3.05,4.20),{
        textureWidth:compactLayout?256:448,textureHeight:compactLayout?256:448,
        clipBias:.004,color:0x414040,multisample:0
      });
      mirror.position.set(cx+dir*2.79,centerY,-.64);
      mirror.rotation.y=dir<0?Math.PI/2:-Math.PI/2;
      const renderMirror=mirror.onBeforeRender.bind(mirror);
      mirror.onBeforeRender=(activeRenderer,activeScene,activeCamera,...args)=>{
        if(activeRenderer.getRenderTarget())return; // prevent recursive multi-mirror passes
        renderMirror(activeRenderer,activeScene,activeCamera,...args);
      };
      mirror.visible=false;
      bay.add(mirror);
      mirrors.push(mirror);
      // Two fine metal rails catch the spotlight on the depth of each jamb.
      block(silver,[.021,4.38,.038],[cx+dir*2.76,centerY,.94],bay);
    }
    const fixtures=[];
    for (const xOffset of [-1.52,1.52]) {
      const fixture=block(silver,[.76,.035,.20], [cx+xOffset,bottom+4.38,.34],bay);
      const lamp=block(new MeshBasicMaterial({color:'#fff0dc',toneMapped:false}),
        [.64,.025,.12],[cx+xOffset,bottom+4.348,.36],bay);
      fixtures.push(lamp);
    }
    // Two raking beams plus the wider key make polished bottle glass light up.
    const left=addSpot(bay,{color:'#fff0e2',intensity:67,
      position:[cx-1.50,bottom+4.30,.36],look:[cx,bottom+1.16,-.60],spread:.40});
    const right=addSpot(bay,{color:'#fff9e9',intensity:67,
      position:[cx+1.50,bottom+4.30,.36],look:[cx,bottom+1.16,-.60],spread:.40});
    const bounce=addSpot(bay,{color:product.tone,intensity:19,
      position:[cx,bottom+1.30,-1.7],look:[cx,bottom+1.25,-.4],spread:.62});
    bayLights.set(product.key,{left,right,bounce,fixtures,sides,mirrors});
  }
  // Fine polished trim makes the edge of each niche readable on mobile.
  for(const x of [-6.39,-.36,.36,6.39])
    block(insetGold,[.028,10.0,.034],[x,.06,1.20]);
  wall.userData.lights=bayLights;
  if(compactLayout) wall.scale.x=.64;
  scene.add(wall);
  return wall;
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
  const shadow = new Mesh(new PlaneGeometry(radius*1.70,radius*1.65),
    new MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,opacity:.78}));
  shadow.rotateX(-Math.PI/2);
  shadow.position.y=.012;
  group.add(pivot,shadow);
  product.shadow=shadow;
  product.overhead=addSpot(group,{
    color:'#fff2e2',intensity:52,position:[.22,3.89,.38],look:[0,1.18,0],spread:.53
  });
  product.refraction=addRefraction(group,product.tone,radius);
  product.keyLight=addSpot(group,{
    color:'#fff6eb',intensity:29,position:[-1.65,3.55,1.46],look:[0,1.13,0]
  });
  product.rimLight=addSpot(group,{
    color:product.tone,intensity:16,position:[1.68,2.40,-1.14],look:[0,1.16,0]
  });
  product.edgeLight=addSpot(group,{
    color:'#fff8f0',intensity:11,position:[-1.6,1.85,-1.18],look:[0,1.1,0],spread:.40
  });
  scene.add(group);
  Object.assign(product,{group,pivot,bottle});
}


function viewAround({x, y, z}, radius, yaw, elevation, amount = 0) {
  return {
    x: x + Math.sin(yaw) * radius, y: y + elevation, z: z + Math.cos(yaw) * radius,
    aimX: x, aimY: y, aimZ: z, focus: amount
  };
}

function galleryFrame(aspect) {
  const minWidth=compactLayout?10.05:14.95;
  const radius=Math.max(23.2,minWidth/(2*angle*aspect));
  return viewAround({x:0,y:-.08,z:-.30},radius,0,.55);
}

function productFrame(product, aspect, yaw=0, focus=1) {
  // Mobile focuses on the bottle in its recess while leaving product copy below.
  // Desktop retains both reflective side walls in frame.
  const narrow=aspect<.80;
  const radius=narrow?8.6:Math.max(8.35,5.68/(2*angle*aspect)*.79);
  const origin={x:product.x,y:product.y+.92,z:product.z-.12};
  return viewAround(origin,radius,yaw*.26,narrow?.44:.83,focus);
}


function flyThrough(aspect, progress) {
  const shots=[galleryFrame(aspect),...flightOrder.map(key=>
    productFrame(products.find(p=>p.key===key),aspect,0,.34))];
  const p=MathUtils.clamp(progress,0,1)*4;
  const index=Math.min(3,Math.floor(p));
  const t=MathUtils.smoothstep(p-index,0,1);
  const from=shots[index], to=shots[index+1];
  return Object.fromEntries(Object.keys(from).map(key=>[
    key,MathUtils.lerp(from[key],to[key],t)
  ]));
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
    const orbitX = 0;
    const orbitY = 0;
    const orbitZ = 0;
    const turn = product.rest + spinAngle(product, time)
      + (still ? 0 : Math.sin(phase * .76) * .035) + (selected ? manualTurn.y : 0);
    const pitch = (selected ? manualTurn.x : 0) + (still ? 0 : Math.sin(phase * .87 + .8) * .012);
    const roll = still ? 0 : Math.cos(phase * .82) * .013;
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
    product.keyLight.intensity = (38 + emphasis * 112) * secondary;
    product.overhead.intensity = (67 + emphasis * 180) * secondary;
    product.overhead.target.position.x = orbitX + lightingPointer.x * .2;
    product.keyLight.position.x = -1.65 + lightingPointer.x * .32;
    product.keyLight.position.z = 1.46 + lightingPointer.y * .23;
    product.rimLight.intensity = (31 + emphasis * 68) * secondary;
    product.edgeLight.intensity = (16 + emphasis * 28) * secondary;
    const niche = shelves?.userData.lights.get(product.key);
    if (niche) {
      niche.left.intensity=(64+emphasis*174)*secondary;
      niche.right.intensity=(64+emphasis*174)*secondary;
      niche.bounce.intensity=(17+emphasis*70)*secondary;
      for(const mirror of niche.mirrors) mirror.visible=selected;
      for(const lamp of niche.fixtures) lamp.material.color.setScalar(.76+emphasis*1.2);
    }
    product.refraction.rotation.z = turn * .91;
    product.refraction.position.x = Math.sin(turn) * .15 + lightingPointer.x * .085;
    product.refraction.position.z = .26 + Math.cos(turn * 2) * .08;
    product.refraction.material.opacity = (.51 + emphasis * .29) * secondary * (.88 + .12 * Math.cos(turn * 2));
    if (water) {
      const {pools, poolColors} = water.material.uniforms;
      pools.value[index].set(product.x + lightingPointer.x * .22,
        2.8 + lightingPointer.y * .16, (.66 + emphasis * 1.25) * secondary);
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
    shelves=createWall();
    if(compactLayout) for(const product of products) product.x*=.64;
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
