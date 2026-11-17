import {makeWater} from './water.js?v=dark-stone-1';
import {addLiquidRefraction, bindLiquidCamera} from './glass-volume.js?v=dark-stone-1';
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

// One continuous wall of raw black rock. Desktop = four narrow vertical niches;
// portrait phones = two rows so the display remains legible without horizontal scrolling.
const compactLayoutAlreadyMeasured = compactLayout;
const BAY = compactLayout ? { width: 3.74, height: 4.53, columns: 2, step: 4.26, top: 5.20, bottom: -5.22, floor: -5.75, left: -2.13 }
  : { width: 2.82, height: 4.72, columns: 4, step: 3.38, top: 3.47, bottom: -2.35, floor: -2.93, left: -5.07 };
const entries = [
  {key:'galet', file:'galet-crystal.glb', height:2.58,
    tone:'#21db75', glass:'#d8f8e1', absorption:'#56ba78', liquid:'#079c41', distance:1.18, thickness:.012, rest:-.10, shape:[1.1,.95,2.0]},
  {key:'rose', file:'rose-lune-smoked.glb', height:2.57,
    tone:'#ff408c', glass:'#ffe0ed', absorption:'#d45b8a', liquid:'#c91862', distance:1.16, thickness:.016, rest:.08, shape:[1.02,.89,2.65]},
  {key:'bleu', file:'sillage-bleu.glb', height:2.93,
    tone:'#3475ff', glass:'#d8e7ff', absorption:'#5184d4', liquid:'#1c4ada', distance:1.15, thickness:.011, rest:-.12, shape:[.94,1.13,2.4]},
  {key:'ambre', file:'ambre-dore.glb', height:2.71,
    tone:'#ffb12d', glass:'#fff0c7', absorption:'#e6a437', liquid:'#e68a0e', distance:1.32, thickness:.014, rest:.08, shape:[1.0,1.04,3.05]}
];
const products = entries.map((d,i)=>{
  const x = compactLayout ? (i%2===0 ? -2.13 : 2.13) : (-5.07 + i*3.38);
  const y = compactLayout ? (i<2 ? .30 : -4.63) : -2.14;
  return {...d, x, y, z:-.74};
});

const angle = Math.tan(MathUtils.degToRad(camera.fov / 2));
const pointerStates = new Map();
const lightingPointer = {x: 0, y: 0, targetX: 0, targetY: 0};
const manualTurn = {x: 0, y: 0};
const projected = new Vector3();
const worldPoint = new Vector3();
const hoverGap = .016;
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
  const canvas = document.createElement('canvas'); canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'); const tex=ctx.createImageData(128,128);
  let state=37;
  for(let i=0;i<tex.data.length;i+=4){state=(Math.imul(state,1664525)+1013904223)>>>0;
    const v=105+(state>>>27);tex.data[i]=tex.data[i+1]=tex.data[i+2]=v;tex.data[i+3]=255;}
  ctx.putImageData(tex,0,0);return new CanvasTexture(canvas);
}

// The generated basalt photograph supplies real fractured stone detail on every 3D face.
let rockMap;
async function loadStoneTexture() {
  const image = new Image();
  image.src = new URL('basalt-stone.jpg', import.meta.url).href;
  await image.decode();
  const texture = new CanvasTexture(image);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = 1000;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
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

// Rough volumetric stone architecture. Each aperture is an actual hole between
// irregular piers, not a flat overlay. Back, side and roof faces catch coloured light.
function createWall() {
  const wall=new Group();
  const outside=new MeshStandardMaterial({color:'#65696b',map:rockMap,metalness:.04,
    roughness:.91,bumpMap:rockMap,bumpScale:.16});
  const inner=new MeshStandardMaterial({color:'#777d80',map:rockMap,metalness:.08,
    roughness:.84,bumpMap:rockMap,bumpScale:.12});
  const sideStone=new MeshStandardMaterial({color:'#8a9093',map:rockMap,metalness:.18,
    roughness:.50,bumpMap:rockMap,bumpScale:.08,envMapIntensity:.65});
  const floorStone=new MeshStandardMaterial({color:'#858b8d',map:rockMap,metalness:.16,
    roughness:.43,bumpMap:rockMap,bumpScale:.06});
  const dark=new MeshStandardMaterial({color:'#151618',roughness:.82});
  function rock(size,pos,mat=outside,amount=.058,seed=1){
    const g=new BoxGeometry(size[0],size[1],size[2],5,20,4);
    const a=g.attributes.position;
    const normals=g.attributes.normal;
    const uv=g.attributes.uv;
    for(let i=0;i<a.count;i++){
      const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
      // World-sized texture coordinates keep long piers from stretching the stone grain.
      const faceX = Math.abs(normals.getX(i)) > .5;
      const faceY = Math.abs(normals.getY(i)) > .5;
      uv.setXY(i, (faceX ? z : x) / 2.1, (faceY ? z : y) / 2.1);
      // The exposed rock lips wander irregularly as if chiselled from fractured stone.
      const n=Math.sin(y*3.67+seed*1.4+x*4.2)*.52+
        Math.sin(y*11.45+x*3.1+seed*2.1)*.24+
        Math.sin(y*20.2+z*2.8+seed)*.16;
      const m=Math.sin(x*6.7+seed+y*2.2)*.63+
        Math.sin(x*14.3+y*6.2+seed*4.7)*.27;
      a.setXYZ(i,x+amount*n,y+amount*.65*m,z+amount*.4*Math.sin(x*8.6+y*7.3+seed));
    }
    g.computeVertexNormals();
    const mesh=new Mesh(g,mat);mesh.position.set(...pos);wall.add(mesh);return mesh;
  }
  const w=BAY.width,step=BAY.step,cols=BAY.columns;
  const xs=compactLayout?[-2.13,2.13]:products.map(p=>p.x);
  const openingBottoms=compactLayout?[-4.63,.30]:[-2.14];
  const leftEdge=xs[0]-w/2, rightEdge=xs[xs.length-1]+w/2;
  // Solid black-rock rear mass, recessed >2m behind the display line.
  const totalWidth=rightEdge-leftEdge+1.25;
  const top=compactLayout?5.65:3.28, base=compactLayout?-5.15:-2.56;
  rock([totalWidth,top-base+1.0,.80],[(leftEdge+rightEdge)/2,(top+base)/2,-2.62],inner,.075,19);
  // A continuous rock surround with broken silhouette, not individual square boxes.
  const exterior=compactLayout?[leftEdge-.36,rightEdge+.36]:[leftEdge-.42,rightEdge+.42];
  const eachBottom=compactLayout?[-4.63,.30]:[-2.14];
  for(let row=0;row<(compactLayout?2:1);row++){
    const bottom=eachBottom[row], ceiling=bottom+BAY.height;
    for(let c=0;c<=cols;c++){
      const x=c===0?leftEdge-.40:c===cols?rightEdge+.40:(xs[c-1]+xs[c])/2;
      const bw=c===0||c===cols?.80:step-w+.10;
      rock([bw,BAY.height+.48,3.06],[x,bottom+BAY.height/2,-.27],outside,.13,11+c+row*9);
    }
    rock([totalWidth,.57,3.06],[(leftEdge+rightEdge)/2,ceiling+.23,-.25],outside,.10,29+row);
    rock([totalWidth,.49,3.08],[(leftEdge+rightEdge)/2,bottom-.24,-.26],outside,.11,34+row);
  }
  if(compactLayout){
    rock([totalWidth,.35,3.12],[(leftEdge+rightEdge)/2,-.06,-.25],outside,.12,57);
  }
  const bayLights=new Map();
  for(let i=0;i<products.length;i++){
    const product=products[i],cx=product.x,bottom=product.y,topY=bottom+BAY.height;
    // True cavity planes two metres behind the front face.
    rock([w-.05,BAY.height-.10,.14],[cx,bottom+BAY.height/2,-2.10],inner,.07,60+i);
    rock([w-.03,.15,2.63],[cx,bottom-.035,-.70],floorStone,.015,72+i);
    rock([w-.03,.19,2.58],[cx,topY+.005,-.70],inner,.032,83+i);
    const sideOffset=w/2-.01;
    for(const dir of [-1,1])rock([.12,BAY.height-.10,2.63],
      [cx+dir*sideOffset,bottom+BAY.height/2,-.76],sideStone,.025,93+i*3+dir);
    // Recessed round-ish downlight, one per niche like the reference image.
    rock([.54,.035,.34],[cx,topY-.075,.10],dark,.003,99+i);
    const lightSource=new Mesh(new PlaneGeometry(.42,.18),new MeshBasicMaterial({
      color:'#ffe9ce',transparent:true,opacity:.82,toneMapped:false,side:DoubleSide}));
    lightSource.position.set(cx,topY-.09,.21);lightSource.rotation.x=-Math.PI/2;wall.add(lightSource);
    const overhead=addSpot(wall,{color:'#ffe4d0',intensity:105,
      position:[cx,topY-.095,.10],look:[cx,bottom+.88,-.80],spread:.42});
    const spill=addSpot(wall,{color:product.tone,intensity:31,
      position:[cx,bottom+1.50,-.93],look:[cx,bottom+1.28,-2.10],spread:.84});
    const sideLights = [-1, 1].map(direction => addSpot(wall, {
      color: product.tone, intensity: 25,
      position: [cx + direction * .25, bottom + .90, -.65],
      look: [cx + direction * sideOffset, bottom + 1.25, -.90], spread: .72
    }));
    // Transmitted pools follow the bottle and illuminate the shelf and both inner sides.
    const caustics = [-1, 1].map(direction => {
      const patch = new Mesh(new PlaneGeometry(2.35, 2.50), new MeshBasicMaterial({
        map: refractionMap, color: product.tone, transparent: true, opacity: .31,
        blending: additiveBlending, depthWrite: false, toneMapped: false
      }));
      patch.position.set(cx + direction * (sideOffset - .08), bottom + 1.18, -.71);
      patch.rotation.y = direction < 0 ? Math.PI / 2 : -Math.PI / 2;
      wall.add(patch);
      return patch;
    });
    bayLights.set(product.key,{overhead,spill,sideLights,caustics,lightSource});
  }
  // A barely perceptible stone lip touches the dark mirror-like water at the foot.
  rock([totalWidth,.23,3.1],[(leftEdge+rightEdge)/2,base-.19,-.20],outside,.08,108);
  wall.userData.lights=bayLights;
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
  url.searchParams.set('v', 'dark-stone-1');
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
      material.roughness = .028;
      material.envMapIntensity = 1.55;
    } else if (/crystal/i.test(material.name)) {
      material.color.set(product.glass);
      material.attenuationColor = new Color(product.absorption);
      material.attenuationDistance = product.distance;
      material.transmission = .986;
      material.thickness = product.thickness;
      material.ior = 1.47;
      material.roughness = .033;
      material.clearcoat = .70;
      material.clearcoatRoughness = .025;
      material.envMapIntensity = 1.40;
      material.side = DoubleSide;
      if (!liquidBounds.isEmpty()) addLiquidRefraction(mesh, liquidBounds, product);
    } else if (/(print|label)/i.test(material.name) && material.map) {
      material.map.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
      material.map.colorSpace = SRGBColorSpace;
      material.roughness = .72;
      material.metalness = 0;
      material.envMapIntensity = .28;
      material.emissiveMap = material.map;
      material.emissive.set('#fff7ed');
      material.emissiveIntensity = .16;
    } else if (/atomizer tube/i.test(material.name)) {
      // Leave a muted highlight on the dip tube in the solid pass refracted by the shell.
      material.transmission = 0;
      material.color.set('#64605d');
      material.roughness = .31;
    } else if (/pearl|lacquer|cap/i.test(material.name)) {
      material.bumpMap = satinMap;
      material.bumpScale = .00013;
      material.envMapIntensity = .83;
      if(product.key==='galet' && /cap|pearl/i.test(material.name)){
        material.color.set('#f4f1e9'); material.roughness=.26; material.metalness=.14;
      }
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
  const radius = product.key === 'galet' ? 1.13 : 1.05;
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
  // Preserve the complete rock wall and a strip of nearly still reflection below.
  const radius=compactLayout?Math.max(29.6,10.05/(2*angle*aspect))
    :Math.max(16.5,15.0/(2*angle*aspect));
  return viewAround({x:0,y:compactLayout?-.08:-.38,z:-.60},radius,0,.25);
}

function productFrame(product,aspect,yaw=0,focus=1){
  // The whole selected recess, including its rough sides and roof, stays visible.
  // Previous zoom cropped the shelf edges and felt too close.
  const radius=aspect<.80?Math.max(14.9,BAY.width/(2*angle*aspect)*1.22):11.3;
  const aimY=product.y+BAY.height*.49;
  return viewAround({x:product.x,y:aimY,z:-.72},radius, yaw*.13,.21,focus);
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
      + (still ? 0 : Math.sin(phase * .76) * .018) + (selected ? manualTurn.y : 0);
    const pitch = (selected ? manualTurn.x : 0) + (still ? 0 : Math.sin(phase * .87 + .8) * .012);
    const roll = still ? 0 : Math.cos(phase * .82) * .006;
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
      niche.overhead.intensity=(88+emphasis*104)*secondary;
      niche.spill.intensity=(32+emphasis*54)*secondary;
      for (const sideLight of niche.sideLights) sideLight.intensity=(27+emphasis*43)*secondary;
      for (const [side, patch] of niche.caustics.entries()) {
        patch.material.opacity=(.27+emphasis*.24)*secondary;
        patch.position.y=product.y+1.18+Math.sin(turn+side)*.035;
      }
      niche.lightSource.material.opacity=.72+emphasis*.20;
    }
    product.refraction.rotation.z = turn * .91;
    product.refraction.position.x = Math.sin(turn) * .15 + lightingPointer.x * .085;
    product.refraction.position.z = .26 + Math.cos(turn * 2) * .08;
    product.refraction.material.opacity = (.51 + emphasis * .29) * secondary * (.88 + .12 * Math.cos(turn * 2));
    if (water) {
      const {pools, poolColors} = water.material.uniforms;
      pools.value[index].set(product.x + lightingPointer.x * .12,
        1.0 + lightingPointer.y * .07, (.42 + emphasis * .62) * secondary);
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
    renderer.toneMappingExposure = .98;
    renderer.transmissionResolutionScale = innerWidth <= 700 ? .72 : .88;
    const studio = new RoomEnvironment();
    reflectionPanels(studio);
    const pmrem = new PMREMGenerator(renderer);
    studioReflection = pmrem.fromScene(studio, .016);
    pmrem.dispose();
    studio.dispose();
    scene.environment = closeup.environment = studioReflection.texture;
    scene.environmentIntensity = .55;
    closeup.environmentIntensity = 1.17;
    scene.add(new AmbientLight('#dde0e5', .12));
    closeup.add(new AmbientLight('#f3eefa', .32));
    addSpot(closeup, {color: '#fff4e7', intensity: 70, position: [3, 4, 4], look: [0, 0, 0]});
    rockMap = await loadStoneTexture();
    shelves=createWall();

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
