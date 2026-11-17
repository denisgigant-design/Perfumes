import {makeWater} from './water.js?v=night-focus-1';
import {addLiquidRefraction, bindLiquidCamera} from './glass-volume.js?v=dark-stone-1';
import {
  ACESFilmicToneMapping, AmbientLight, Box3, BoxGeometry, CanvasTexture, Color, DoubleSide, GLTFLoader,
  Group, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera,
  PlaneGeometry, PMREMGenerator, Reflector, RoomEnvironment, Scene, SpotLight, SRGBColorSpace, Vector3, WebGLRenderer
} from './three-showroom.js?v=2';

const compactLayout = innerWidth < 680;
const stage = document.querySelector('#stage');
const mount = document.querySelector('#showroom3d');
const dragArea = document.querySelector('#product-drag');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const scene = new Scene();
const camera = new PerspectiveCamera(34, 1, .07, 65);
// One continuous wall of raw black rock. Desktop = four narrow vertical niches;
// portrait phones = two rows so the display remains legible without horizontal scrolling.
const BAY = compactLayout ? { width: 2.75, height: 4.53, columns: 2, step: 3.30, top: 5.20, bottom: -5.22, floor: -5.75, left: -1.65 }
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
  const x = compactLayout ? (i%2===0 ? -1.65 : 1.65) : (-5.07 + i*3.38);
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
let renderer, studioReflection, water, shelves;
let width = 0, height = 0, previousTime = 0;
let presented = false;
let shot = null, lastProduct = 'gallery';
const spinDuration = 1750;
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
const inspectionWhite = new Color('#fff8ef');

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
let rockMap, rockHeightMap, stoneRoughnessMap;
let stoneSample;
async function loadStoneTexture() {
  const image = new Image();
  image.src = new URL('basalt-cleft.jpg', import.meta.url).href;
  await image.decode();
  const texture = new CanvasTexture(image);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = 1000;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d', {willReadFrequently:true});
  ctx.drawImage(image,0,0,256,256);
  stoneSample = ctx.getImageData(0,0,256,256).data;
  rockHeightMap = texture.clone();
  rockHeightMap.colorSpace = '';
  const roughness = ctx.getImageData(0,0,256,256);
  for(let i=0;i<roughness.data.length;i+=4){
    const value=210+Math.round(roughness.data[i]*.15);
    roughness.data[i]=roughness.data[i+1]=roughness.data[i+2]=value;
  }
  ctx.putImageData(roughness,0,0);
  stoneRoughnessMap = new CanvasTexture(canvas);
  stoneRoughnessMap.wrapS=stoneRoughnessMap.wrapT=1000;
  return texture;
}

function beamTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  // Optical haze has a feathered falloff. The stone itself receives the real light.
  const pixels=context.createImageData(256,256);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const t=y/255;
    const halfWidth=18+t*116;
    const lateral=Math.exp(-Math.pow((x-128)/halfWidth,2)*3.0);
    const vertical=Math.pow(1-t,1.8)*Math.min(1,t*18);
    const at=(y*256+x)*4;
    pixels.data[at]=pixels.data[at+1]=pixels.data[at+2]=255;
    pixels.data[at+3]=Math.round(255*lateral*vertical);
  }
  context.putImageData(pixels,0,0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const lightBeamMap = beamTexture();

const satinMap = satinBump();

// Cleft stone lies inside precisely cut recesses. World-space UVs continue over
// adjacent architectural pieces and the displacement fades out at their edges.
function createWall() {
  const wall=new Group();
  const outside = new MeshStandardMaterial({color:'#73777e',map:rockMap,
    metalness:.04,roughness:.94,roughnessMap:stoneRoughnessMap,
    bumpMap:rockHeightMap,bumpScale:.16,envMapIntensity:.34,
    emissive:'#7a8089',emissiveMap:rockMap,emissiveIntensity:.006});
  const inner=outside.clone(); inner.color.set('#999ca2');
  const floorStone=inner.clone(); floorStone.roughness=.78; floorStone.bumpScale=.035;
  const dark=new MeshStandardMaterial({color:'#101114',metalness:.7,roughness:.32});
  function rock(size,pos,mat=outside,amount=.008,seed=1){
    const sx=Math.max(1,Math.min(64,Math.ceil(size[0]*9)));
    const sy=Math.max(1,Math.min(96,Math.ceil(size[1]*12)));
    const sz=Math.max(1,Math.min(32,Math.ceil(size[2]*9)));
    const g=new BoxGeometry(...size,sx,sy,sz);
    const a=g.attributes.position, normals=g.attributes.normal, uv=g.attributes.uv;
    for(let i=0;i<a.count;i++){
      const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
      const nx=normals.getX(i),ny=normals.getY(i),nz=normals.getZ(i);
      const faceX=Math.abs(nx)>.5,faceY=Math.abs(ny)>.5;
      const worldX=x+pos[0],worldY=y+pos[1],worldZ=z+pos[2];
      const scale=5.3;
      const u=(faceX?worldZ:worldX)/scale;
      const v=(faceY?worldZ:worldY)/scale;
      uv.setXY(i,u,v);
      const tx=Math.floor(((u%1+1)%1)*255),ty=Math.floor(((v%1+1)%1)*255);
      const sample=stoneSample[(ty*256+tx)*4]/255-.30;
      const edgeA=faceX?Math.min(size[2]/2-Math.abs(z),size[1]/2-Math.abs(y)):
        faceY?Math.min(size[0]/2-Math.abs(x),size[2]/2-Math.abs(z)):
        Math.min(size[0]/2-Math.abs(x),size[1]/2-Math.abs(y));
      const fade=MathUtils.smoothstep(edgeA,0,.12);
      const relief=sample*amount*fade;
      a.setXYZ(i,x+nx*relief,y+ny*relief,z+nz*relief);
    }
    g.computeVertexNormals();
    if(Array.isArray(mat)){
      // Keep all exterior faces in one draw call and the lit reveal in a second.
      const unique=[...new Set(mat)];
      const ordered=new g.index.array.constructor(g.index.count);
      const groups=[...g.groups];let offset=0;
      g.clearGroups();
      for(const [materialIndex,material] of unique.entries()){
        const start=offset;
        for(const group of groups)if(mat[group.materialIndex]===material){
          ordered.set(g.index.array.subarray(group.start,group.start+group.count),offset);
          offset+=group.count;
        }
        g.addGroup(start,offset-start,materialIndex);
      }
      g.index.array.set(ordered);mat=unique;
    }
    const mesh=new Mesh(g,mat);mesh.position.set(...pos);wall.add(mesh);return mesh;
  }
  const w=BAY.width,step=BAY.step,cols=BAY.columns;
  const xs=compactLayout?[-1.65,1.65]:products.map(p=>p.x);
  const leftEdge=xs[0]-w/2,rightEdge=xs[xs.length-1]+w/2;
  const totalWidth=rightEdge-leftEdge+1.25;
  const base=compactLayout?-5.15:-2.56;
  const eachBottom=compactLayout?[-4.63,.30]:[-2.14];
  for(let row=0;row<eachBottom.length;row++){
    const bottom=eachBottom[row],ceiling=bottom+BAY.height;
    for(let c=0;c<=cols;c++){
      const x=c===0?leftEdge-.4:c===cols?rightEdge+.4:(xs[c-1]+xs[c])/2;
      const bw=c===0||c===cols?.8:step-w;
      rock([bw,BAY.height+.48,3.06],[x,bottom+BAY.height/2,-.27],outside,.025);
    }
    rock([totalWidth,.57,3.06],[(leftEdge+rightEdge)/2,ceiling+.23,-.25],outside,.015);
    rock([totalWidth,.49,3.08],[(leftEdge+rightEdge)/2,bottom-.24,-.26],outside,.015);
  }
  const highestCeiling=Math.max(...products.map(p=>p.y+BAY.height));
  const surroundBottom=base-.48,surroundTop=highestCeiling+.50;
  rock([72,60,3.06],[0,surroundTop+30,-.25],outside,.015);
  const sideWidth=40-totalWidth/2;
  for(const dir of [-1,1])rock([sideWidth,surroundTop-surroundBottom,3.06],
    [dir*(totalWidth/2+sideWidth/2-.10),(surroundTop+surroundBottom)/2,-.25],outside,.015);
  const bayLights=new Map();
  // One inspection light serves the selected recess. Keeping it in the light
  // set at zero intensity avoids recompiling every glass material on selection.
  const inspection=addSpot(wall,{color:'#fff8ef',intensity:0,
    position:[0,0,.50],look:[0,0,-1.28],spread:.61});
  inspection.penumbra=.94;
  wall.userData.inspection=inspection;
  for(const product of products){
    const cx=product.x,bottom=product.y,topY=bottom+BAY.height;
    const tintedSides=inner.clone();
    tintedSides.emissive.set(product.tone);
    const tintedFloor=floorStone.clone();
    const backWall=rock([w+.16,BAY.height+.14,.14],[cx,bottom+BAY.height/2,-2.10],inner,.04);
    rock([w+.12,.15,3.32],[cx,bottom-.075,-.37],
      [outside,outside,tintedFloor,outside,outside,outside],.006);
    rock([w+.12,.19,3.32],[cx,topY+.04,-.37],
      [outside,outside,outside,inner,outside,outside],.006);
    const sideOffset=w/2+.06;
    for(const dir of [-1,1]){
      rock([.12,BAY.height+.10,3.32],[cx+dir*sideOffset,bottom+BAY.height/2,-.37],
        [dir<0?tintedSides:outside,dir>0?tintedSides:outside,outside,outside,outside,outside],.009);
    }
    // The recessed LED aperture, soft haze and actual wall wash share the fragrance hue.
    rock([.74,.06,.34],[cx,topY-.28,.66],dark,0);
    const luminousColor=new Color(product.tone).lerp(new Color('#ffffff'),.22);
    const lightSource=new Mesh(new PlaneGeometry(.62,.19),new MeshBasicMaterial({
      color:luminousColor,transparent:true,opacity:.96,toneMapped:false,side:DoubleSide}));
    lightSource.position.set(cx,topY-.315,.72);lightSource.rotation.x=-Math.PI/2;wall.add(lightSource);
    const visibleDiffuser=new Mesh(new PlaneGeometry(.62,.026),lightSource.material);
    visibleDiffuser.position.set(cx,topY-.288,.835);wall.add(visibleDiffuser);
    const halo=new Mesh(new PlaneGeometry(1.15,.60),new MeshBasicMaterial({
      map:refractionMap,color:product.tone,transparent:true,opacity:.64,
      blending:additiveBlending,depthWrite:false,toneMapped:false,side:DoubleSide}));
    halo.position.set(cx,topY-.32,.72);halo.rotation.x=-Math.PI/2;wall.add(halo);
    const beam=new Mesh(new PlaneGeometry(w*.90,BAY.height-.3),new MeshBasicMaterial({
      map:lightBeamMap,color:product.tone,transparent:true,opacity:.018,
      blending:additiveBlending,depthWrite:false,toneMapped:false,side:DoubleSide}));
    beam.position.y=-(BAY.height-.3)/2;
    const beamPivot=new Group();beamPivot.position.set(cx,topY-.32,.66);
    beamPivot.add(beam);wall.add(beamPivot);
    const overhead=addSpot(wall,{color:product.tone,intensity:150,
      position:[cx,topY-.33,.66],look:[cx,bottom+1.10,-2.10],spread:.70});
    overhead.penumbra=.95;
    const front=addSpot(wall,{color:'#fff5eb',intensity:105,
      position:[cx-.80,bottom+2.8,2.8],look:[cx,bottom+1.28,-.72],spread:.52});
    const spill=addSpot(wall,{color:new Color(product.tone).lerp(new Color('#ffffff'),.28),intensity:70,
      position:[cx,topY-.34,-1.10],look:[cx,topY-.65,-2.10],spread:1.17});
    spill.penumbra=.95;
    // Continuous wall-side transmission extends over the entire stone reveal.
    const caustics=[-1,1].map(dir=>{
      const patch=new Mesh(new PlaneGeometry(3.24,BAY.height-.20),new MeshBasicMaterial({
        map:refractionMap,color:product.tone,transparent:true,opacity:.17,
        blending:additiveBlending,depthWrite:false,toneMapped:false}));
      patch.position.set(cx+dir*(sideOffset-.08),bottom+BAY.height*.5,-.37);
      patch.rotation.y=dir<0?Math.PI/2:-Math.PI/2;wall.add(patch);return patch;
    });
    bayLights.set(product.key,{overhead,front,spill,caustics,lightSource,halo,beam,beamPivot,
      baseEmitterColor:luminousColor.clone(),
      tintedSides,tintedFloor,backWall});
  }
  rock([totalWidth,.16,3.1],[(leftEdge+rightEdge)/2,base-.19,-.20],floorStone,.006);
  wall.userData.lights=bayLights;scene.add(wall);return wall;
}

function addSpot(parent, {color, intensity, position, look, spread = .56}) {
  const light = new SpotLight(color, intensity, 0, spread, .74, 2);
  light.position.set(...position);
  light.target.position.set(...look);
  parent.add(light, light.target);
  return light;
}

// The blue cap's 32 identical-material flutes share one draw call.
function mergeCapFlutes(model) {
  const flutes = [];
  model.updateMatrixWorld(true);
  model.traverse(mesh => {
    if (mesh.isMesh && /^Fine cap flute/.test(mesh.name)) flutes.push(mesh);
  });
  if (flutes.length < 2) return;
  const parts = flutes.map(mesh => {
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    return geometry.applyMatrix4(mesh.matrixWorld);
  });
  const merged = parts[0].clone();
  merged.clearGroups();
  for (const [name, attribute] of Object.entries(merged.attributes)) {
    const length = parts.reduce((total, part) => total + part.attributes[name].array.length, 0);
    const values = new attribute.array.constructor(length);
    let offset = 0;
    for (const part of parts) {
      values.set(part.attributes[name].array, offset);
      offset += part.attributes[name].array.length;
    }
    merged.setAttribute(name, new attribute.constructor(values, attribute.itemSize, attribute.normalized));
  }
  merged.computeBoundingSphere();
  const cap = new Mesh(merged, flutes[0].material);
  cap.name = 'Merged cap flutes';
  for (const mesh of flutes) mesh.removeFromParent();
  for (const geometry of parts) geometry.dispose();
  model.add(cap);
}

async function loadBottle(product, loader) {
  const url = new URL(product.file, import.meta.url);
  url.searchParams.set('v', 'dark-stone-1');
  const {scene: model} = await loader.loadAsync(url.href);
  mergeCapFlutes(model);
  const bottle = new Group();
  bottle.add(model);
  const bounds = new Box3().setFromObject(bottle);
  const liquidBounds = new Box3();
  const scale = product.height / (bounds.max.y - bounds.min.y);
  const center = bounds.getCenter(new Vector3());
  product.footprint = {width: (bounds.max.x - bounds.min.x) * scale, depth: (bounds.max.z - bounds.min.z) * scale};
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
      // Keep printed ink legible and equally exposed under every product spotlight.
      mesh.material = new MeshBasicMaterial({
        name: material.name, map: material.map, color: '#fffef9', toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
      });
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
  product.refraction=addRefraction(group,product.tone,radius);
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
  const radius=compactLayout?Math.max(23.5,7.0/(2*angle*aspect))
    :Math.max(16.5,15.0/(2*angle*aspect));
  const aimY = compactLayout ? -.55 : .22 - radius * 2 * angle * .14;
  const cameraY = compactLayout ? .95 : 1.65;
  return viewAround({x:0,y:aimY,z:-.60},radius,0,cameraY-aimY);
}

function productFrame(product,aspect,yaw=0,focus=1){
  // The whole selected recess, including its rough sides and roof, stays visible.
  // Previous zoom cropped the shelf edges and felt too close.
  const radius=aspect<.80?Math.max(12.6,BAY.width/(2*angle*aspect)*1.22):12.2;
  const aimY=product.y+BAY.height*.40;
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
  if (selected) return productFrame(selected, camera.aspect, 0, 1);
  const progress = Number(stage.dataset.progress || 0);
  return reducedMotion.matches ? galleryFrame(camera.aspect) : flyThrough(camera.aspect, progress);
}

function spin(key) {
  const product = products.find(item => item.key === key);
  if (!product || reducedMotion.matches) return;
  if (product.spin && performance.now() - product.spin.started < spinDuration) return;
  product.spin = {started: performance.now() + 400};
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
  const container = mount;
  const nextWidth = container.clientWidth;
  const nextHeight = container.clientHeight;
  if (!nextWidth || !nextHeight || (width === nextWidth && height === nextHeight)) return;
  width = nextWidth;
  height = nextHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  const compact = width <= 700;
  const pixelBudget = compact ? 2_000_000 : 3_000_000;
  const ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(pixelBudget / (width * height)));
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
    const buttonCenterX = (projected.x + 1) * width / 2;
    const buttonCenterY = (1 - projected.y) * height / 2;
    const hitHeight = height * (product.height + .18) / (2 * angle * distance);
    const captionDrop = compactLayout && product.y > 0 ? .16 : .37;
    worldPoint.set(product.x,product.y-captionDrop,1.32).project(camera);
    product.button.style.setProperty('--caption-left',
      ((worldPoint.x+1)*width/2-buttonCenterX+hitWidth/2)+'px');
    product.button.style.setProperty('--caption-top',
      ((1-worldPoint.y)*height/2-buttonCenterY+hitHeight/2)+'px');
    if (stage.dataset.state === product.key) {
      dragArea.style.setProperty('--drag-left', ((projected.x + 1) * 50) + '%');
      dragArea.style.setProperty('--drag-top', ((1 - projected.y) * 50) + '%');
      dragArea.style.setProperty('--drag-width', Math.max(hitWidth * 1.45, width * .32) + 'px');
      dragArea.style.setProperty('--drag-height', height * (product.height + .35) / (2 * angle * distance) + 'px');
    }
  }
}

function render(time) {
  if (document.hidden) return;
  if (stage.getBoundingClientRect().bottom <= 0) return;
  if (previousTime && time - previousTime < 27 && stage.dataset.state === 'gallery') return;
  resize();
  const dt = previousTime ? Math.min((time - previousTime) / 1000, .20) : .016;
  previousTime = time;
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
  const selectedProduct=products.find(product=>current===product.key);
  const inspection=shelves?.userData.inspection;
  if(inspection){
    inspection.intensity=selectedProduct?MathUtils.clamp(shot.focus,0,1)*180:0;
    inspection.userData.selected=selectedProduct?.key??null;
    if(selectedProduct){
      inspection.position.set(selectedProduct.x,selectedProduct.y+BAY.height-.33,.50);
      inspection.target.position.set(selectedProduct.x+lightingPointer.x*.18,
        selectedProduct.y+1.12,-1.28+lightingPointer.y*.10);
    }
  }
  for (const [index, product] of products.entries()) {
    const selected = current === product.key;
    product.group.visible = current === 'gallery' || selected;
    const emphasis = selected ? MathUtils.clamp(shot.focus, 0, 1) : 0;
    const orbitX = 0;
    const orbitZ = 0;
    const turn = spinAngle(product, time) + (selected ? manualTurn.y : 0);
    const pitch = selected ? manualTurn.x : 0;
    const roll = 0;
    const rotatedDepth = product.footprint.width * Math.abs(Math.sin(turn))
      + product.footprint.depth * Math.abs(Math.cos(turn));
    const orbitY = Math.max(0, (Math.cos(pitch) - 1) * product.height / 2
      + Math.abs(Math.sin(pitch)) * rotatedDepth / 2);
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
    const niche = shelves?.userData.lights.get(product.key);
    if (niche) {
      niche.overhead.intensity=(125+emphasis*30)*secondary;
      niche.front.intensity=(105+emphasis*25)*secondary;
      niche.spill.intensity=(14+emphasis*9)*secondary;
      niche.overhead.target.position.x=product.x+lightingPointer.x*.30;
      niche.overhead.target.position.z=-2.10+lightingPointer.y*.10;
      niche.front.target.position.x=product.x+lightingPointer.x*.10;
      niche.spill.target.position.x=product.x+Math.sin(turn)*.25+lightingPointer.x*.22;
      niche.spill.target.position.y=product.y+BAY.height-.65+lightingPointer.y*.12;
      niche.beamPivot.rotation.z=-lightingPointer.x*.065;
      niche.beamPivot.rotation.x=lightingPointer.y*.035;
      niche.beam.material.opacity=(.018+emphasis*.014)*secondary;
      niche.halo.material.opacity=(.65+emphasis*.25)*secondary;
      for (const [side, patch] of niche.caustics.entries()) {
        patch.material.opacity=(.17+emphasis*.12)*secondary;
        patch.position.y=product.y+BAY.height*.5+lightingPointer.y*.03;
      }
      niche.tintedSides.emissiveIntensity=(.065+emphasis*.065)*secondary;
      niche.lightSource.material.opacity=.90+emphasis*.10;
      niche.lightSource.material.color.copy(niche.baseEmitterColor).lerp(inspectionWhite,emphasis);
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
  updateHits();
  renderer.render(scene, camera);
  if (!presented) {
    presented = true;
    document.documentElement.classList.add('glb-live');
    window.dispatchEvent(new Event('perfume-ready'));
    if (stage.dataset.state !== 'gallery') spin(stage.dataset.state);
  }
}

function controls(element) {
  let ignoreReturnClick=false;
  function returnToCollection(){
    for(const product of products)product.spin=null;
    window.dispatchEvent(new Event('perfume-collection-request'));
  }
  // The compatibility click can be retargeted to a gallery bottle after the
  // drag surface disappears. Consume that one click before it can reopen it.
  for(const type of ['pointerdown','keydown'])stage.addEventListener(type,()=>{
    ignoreReturnClick=false;
  },{capture:true});
  stage.addEventListener('click',event=>{
    if(ignoreReturnClick){
      ignoreReturnClick=false;
      event.preventDefault();event.stopImmediatePropagation();
    }
  },{capture:true});
  element.addEventListener('pointerdown', event => {
    const product = products.find(item => item.key === stage.dataset.state);
    if (!product || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    product.spin = null;
    pointerStates.set(event.pointerId, {x:event.clientX,y:event.clientY,
      startX:event.clientX,startY:event.clientY,key:product.key,moved:false});
    if(pointerStates.size>1)for(const gesture of pointerStates.values())gesture.moved=true;
    element.setPointerCapture(event.pointerId);
  });
  element.addEventListener('pointermove', event => {
    const previous = pointerStates.get(event.pointerId);
    if (!previous) return;
    event.preventDefault();
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    previous.moved ||= Math.hypot(event.clientX-previous.startX,event.clientY-previous.startY)>8;
    previous.x=event.clientX;previous.y=event.clientY;
    if(!previous.moved)return;
    manualTurn.y += dx * .012;
    manualTurn.x = MathUtils.clamp(manualTurn.x + dy * .004, -.24, .24);
  });
  function release(event) {
    const gesture=pointerStates.get(event.pointerId);
    pointerStates.delete(event.pointerId);
    if(event.type==='pointerup' && gesture && !gesture.moved && stage.dataset.state===gesture.key){
      ignoreReturnClick=true;
      returnToCollection();
    }
  }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    element.addEventListener(event, release);
  }
  element.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){
      event.preventDefault();event.stopPropagation();
      returnToCollection();
    }
  });
  element.addEventListener('wheel', event => {
    const product = products.find(item => item.key === stage.dataset.state);
    if (!product) return;
    event.preventDefault();
    product.spin = null;
    for(const gesture of pointerStates.values())gesture.moved=true;
    manualTurn.y += (event.deltaX + event.deltaY) * .006;
  }, {passive: false});
}

function fallback(error) {
  console.warn('3D showroom switched to image previews.', error);
  document.documentElement.classList.remove('glb-live');
  window.dispatchEvent(new Event('perfume-ready'));
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
  const rect = (stage.dataset.state === 'gallery' ? stage : dragArea).getBoundingClientRect();
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
    renderer.debug.onShaderError = () => { throw new Error('The 3D material could not compile.'); };
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = .98;
    renderer.transmissionResolutionScale = innerWidth <= 700 ? .85 : 1;
    const studio = new RoomEnvironment();
    reflectionPanels(studio);
    const pmrem = new PMREMGenerator(renderer);
    studioReflection = pmrem.fromScene(studio, .016);
    pmrem.dispose();
    studio.dispose();
    scene.environment = studioReflection.texture;
    scene.environmentIntensity = .55;
    scene.add(new AmbientLight('#dde0e5', .12));
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
    controls(dragArea);
    mount.appendChild(renderer.domElement);
    stage.addEventListener('pointermove', trackLighting, {passive: true});
    stage.addEventListener('pointerdown', trackLighting, {passive: true});
    stage.addEventListener('pointerup', releaseLighting);
    stage.addEventListener('pointerleave', centerLighting);
    stage.addEventListener('pointercancel', centerLighting);
    window.Perfume3D = {spin};
    renderer.setAnimationLoop(time => {
      try {
        render(time);
      } catch (error) {
        fallback(error);
      }
    });
  } catch (error) {
    fallback(error);
  }
}

start();
