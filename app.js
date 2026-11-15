import {
 ACESFilmicToneMapping, AmbientLight, Box3, CanvasTexture, Color, DoubleSide, GLTFLoader,
 Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera,
 PlaneGeometry, PMREMGenerator, RoomEnvironment, Scene, SpotLight,
 SRGBColorSpace, Vector3, WebGLRenderer
} from './three-showroom.js';
import {addLiquidRefraction,bindLiquidCamera} from './glass-volume.js';

// Coordinate system is the supplied original scene image, NOT a newly made card or screenshot.
// All presentation elements live inside the ONE world and transform together.
const ITEMS = [
 {key:'ambre',name:'Ambre Doré',desc:'Golden amber, soft woods and a warm lingering signature.',price:80,file:'ambre-dore.glb',fallback:'tight-ambre-dore.png',color:'#eea869',liquid:'#c57a21',glass:'#d8a76a',deep:'#bd773b',m:[211,596,291,210,116,607],p:[270,683,274,218,185,697]},
 {key:'rose',name:'Rose Lune',desc:'Velvet rose petals, soft musk and luminous evening air.',price:75,file:'rose-lune-smoked.glb',fallback:'tight-rose-lune-smoked.png',color:'#df7098',liquid:'#b23859',glass:'#c5889c',deep:'#b86b83',m:[491,595,270,209,115,606],p:[582,683,262,227,185,697]},
 {key:'galet',name:'Galet',desc:'A vivid green accord of mineral freshness and living leaves.',price:95,file:'galet-crystal.glb',fallback:'tight-galet-smoked.png',color:'#8ecf67',liquid:'#49822e',glass:'#a4d88e',deep:'#779f4b',m:[775,594,288,210,117,606],p:[159,1196,270,215,743,1208]},
 {key:'bleu',name:'Sillage Bleu',desc:'Deep cobalt glass with crystalline marine and mineral notes.',price:60,file:'sillage-bleu.glb',fallback:'tight-sillage-bleu-glass.png',color:'#4f90f9',liquid:'#155bf3',glass:'#71b4fa',deep:'#3068c9',m:[1057,595,345,209,114,606],p:[438,1197,334,210,742,1209]},
 {key:'photo',name:'Bleu Royal',desc:'The blue-and-gold photographic presentation — a luminous modern signature.',price:60,file:null,fallback:'bleu-royal-photo.png',color:'#417cf4',liquid:'#205ced',glass:'#427dec',deep:'#3768c1',m:[1343,595,341,212,115,606],p:[713,1197,342,214,742,1209]}
];
const D={w:1536,h:864,water:696}, M={w:864,h:1536,water:1273};
const $=s=>document.querySelector(s);
const el={world:$('#world'),viewport:$('#viewport'),image:$('#background'),glows:$('#nicheColors'),water:$('#waterSurface'),edges:$('#rockEdges'),fallbacks:$('#fallbacks'),hotspots:$('#hotspots'),three:$('#threeMount'),welcome:$('#welcome'),caption:$('#caption'),back:$('#back'),hint:$('#scrollHint'),status:$('#positionStatus')};
const mql=matchMedia('(max-width:720px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const hexRgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const mobile=()=>mql.matches, metrics=()=>mobile()?M:D;
const niche=p=>{let v=mobile()?p.p:p.m;return {cx:v[0],bottom:v[1],height:v[2],width:v[3],top:v[4],low:v[5]}};
const ease=t=>t*t*(3-2*t);
const state={shot:{cx:768,cy:432,zoom:1},target:{cx:768,cy:432,zoom:1},progress:0,selected:null,three:null,waterLast:0,imagesReady:false};

// A checkpoint is always inside the SAME background. Scroll progresses through all five,
// and clicking a product jumps the scroll checkpoint then flies the continuous camera there.
function viewAt(i){const f=metrics(),index=clamp(i,0,5);if(index===0)return {cx:f.w/2,cy:f.h/2,zoom:1};const n=niche(ITEMS[index-1]);return {cx:n.cx,cy:(n.top+n.low)*.5,zoom:mobile()?2.28:1.58}}
function shotAt(progress){const a=clamp(Math.floor(progress),0,5),b=Math.min(5,a+1),t=ease(progress-a);const x=viewAt(a),y=viewAt(b);return {cx:lerp(x.cx,y.cx,t),cy:lerp(x.cy,y.cy,t),zoom:lerp(x.zoom,y.zoom,t)}}
function readScroll(){state.progress=clamp(scrollY/Math.max(1,innerHeight),0,5);state.target=shotAt(state.progress);const idx=clamp(Math.round(state.progress),0,5);const item=idx>0?ITEMS[idx-1]:null;setSelected(item,idx)}
function goTo(index){const y=index*innerHeight;window.scrollTo({top:y,behavior:'instant'});state.progress=index;state.target=shotAt(index);setSelected(index?ITEMS[index-1]:null,index)}
function paintWorld(now){const f=metrics(),rect=el.viewport.getBoundingClientRect();const scaleBase=Math.min(rect.width/f.w,rect.height/f.h);
 const t=reduced.matches?1:Math.min(.165,1-Math.exp(-.012*16.8));
 for(const key of ['cx','cy','zoom'])state.shot[key]=lerp(state.shot[key],state.target[key],t);
 const scale=scaleBase*state.shot.zoom;const horizontal=rect.width*.5, vertical=rect.height*(mobile()? .445 : .465);
 const x=horizontal-state.shot.cx*scale,y=vertical-state.shot.cy*scale;
 el.world.style.transform=`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${scale.toFixed(5)})`;
 state.three?.frame(now);
 if(now-state.waterLast>38){drawWater(now);state.waterLast=now}
 requestAnimationFrame(paintWorld);
}
function setSelected(item,idx){if(state.selected===item?.key)return;state.selected=item?.key||null;
 el.welcome.classList.toggle('hidden',!!item);el.caption.classList.toggle('visible',!!item);el.caption.setAttribute('aria-hidden',String(!item));el.back.classList.toggle('visible',!!item);el.hint.classList.toggle('fade',!!item);el.status.textContent=idx?`${String(idx).padStart(2,'0')} — 05`:'01 — 05';
 if(item){$('#stepNumber').textContent=String(idx).padStart(2,'0')+' / 05';$('#itemName').textContent=item.name;$('#itemDesc').textContent=item.desc;$('#price').textContent='€'+item.price}
 for(const n of el.glows.children)n.classList.toggle('active',n.dataset.key===state.selected);
 for(const n of el.fallbacks.children)n.classList.toggle('active',n.dataset.key===state.selected);
 for(const n of el.hotspots.children)n.setAttribute('aria-current',String(n.dataset.key===state.selected));
}

// The supplied rough-rock images remain intact. Add only tiny dark, broken edge
// silhouettes on the straight niche lips; there is no second fake wall image.
function brokenEdge(svg,side,x,top,bottom,seed){
 // Sparse chips rather than periodic sawteeth: the photographic stone remains visible.
 let s=seed;const rand=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296};
 const inset=side==='left'?1:-1;
 for(let j=0;j<16;j++){
  const y=top+rand()*(bottom-top-34),length=9+rand()*30,depth=2+rand()*6;
  const d=`M ${x} ${y.toFixed(1)} L ${(x+inset*depth*.32).toFixed(1)} ${(y+length*.21).toFixed(1)} L ${(x+inset*depth).toFixed(1)} ${(y+length*.46).toFixed(1)} L ${(x+inset*depth*.68).toFixed(1)} ${(y+length*.77).toFixed(1)} L ${x} ${(y+length).toFixed(1)} Z`;
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);path.setAttribute('fill','#07090a');path.setAttribute('fill-opacity',String(.45+rand()*.25));svg.append(path)
 }
}
function buildWorld(){const f=metrics();el.world.style.width=f.w+'px';el.world.style.height=f.h+'px';el.image.onload=()=>{state.imagesReady=true;state.waterLast=0;state.three?.updateBackground?.()};el.image.src=mobile()?'scene-mobile.png':'scene-desktop.png';if(el.image.complete && el.image.naturalWidth)state.imagesReady=true;
 el.glows.replaceChildren();el.fallbacks.replaceChildren();el.hotspots.replaceChildren();el.edges.replaceChildren();el.edges.setAttribute('viewBox',`0 0 ${f.w} ${f.h}`);el.edges.setAttribute('width',f.w);el.edges.setAttribute('height',f.h);
 for(let i=0;i<ITEMS.length;i++){const p=ITEMS[i],n=niche(p);
  const glow=document.createElement('div');glow.className='niche-light';glow.dataset.key=p.key;
  Object.entries({'--x':n.cx+'px','--y':n.top+'px','--w':n.width+'px','--h':(n.low-n.top)+'px','--tint':`rgba(${hexRgb(p.color).join(',')},.70)`}).forEach(([k,v])=>glow.style.setProperty(k,v));el.glows.append(glow);
  const bottle=document.createElement('img');bottle.className='bottle-img'+(p.file?'':' photo-bottle');bottle.dataset.key=p.key;bottle.src=p.fallback;bottle.alt='';bottle.draggable=false;bottle.loading='eager';
  const visualWidth=p.key==='photo'?n.height*.60:p.key==='bleu'?n.height*.61:n.height*.83;
  Object.entries({'--x':n.cx+'px','--bottom':(f.h-n.bottom)+'px','--h':n.height+'px','--w':Math.min(n.width*.90,visualWidth)+'px','--glow':p.color}).forEach(([k,v])=>bottle.style.setProperty(k,v));el.fallbacks.append(bottle);
  const hit=document.createElement('button');hit.type='button';hit.className='niche-hit';hit.dataset.key=p.key;hit.dataset.name=p.name;hit.setAttribute('aria-label',`View ${p.name} and its price`);
  Object.entries({'--x':n.cx+'px','--y':n.top+'px','--w':n.width+'px','--h':(n.low-n.top)+'px'}).forEach(([k,v])=>hit.style.setProperty(k,v));
  hit.addEventListener('click',()=>{goTo(i+1);state.three?.spin(p.key)});el.hotspots.append(hit);
  brokenEdge(el.edges,'left',n.cx-n.width/2+2,n.top+2,n.low-8,i+23);
  brokenEdge(el.edges,'right',n.cx+n.width/2-2,n.top+2,n.low-8,i+37);
 }
 el.water.width=f.w;el.water.height=f.h-f.water;el.water.style.left='0px';el.water.style.top=f.water+'px';el.water.style.width=f.w+'px';el.water.style.height=(f.h-f.water)+'px';
 state.shot=shotAt(state.progress);state.target=shotAt(state.progress);const oldSelection=state.selected;state.selected=null;setSelected(oldSelection?ITEMS.find(p=>p.key===oldSelection):null,Math.round(state.progress));state.three?.resize();
}
function drawWater(now){if(!state.imagesReady||!el.image.complete||!el.image.naturalWidth)return;
 const f=metrics(),canvas=el.water,ctx=canvas.getContext('2d',{alpha:true});const seconds=reduced.matches?0:now*.001;
 ctx.clearRect(0,0,canvas.width,canvas.height);
 for(let y=0;y<canvas.height;y+=4){const slice=Math.min(4,canvas.height-y);
   const dx=(Math.sin(seconds*1.03+y*.085)*.64+Math.sin(seconds*.54+y*.029)*.55)*(y/canvas.height*.65+.38);
   ctx.drawImage(el.image,0,f.water+y,f.w,slice,dx,y,f.w,slice);
 }
 ctx.save();ctx.globalCompositeOperation='screen';
 for(let i=0;i<ITEMS.length;i++){const p=ITEMS[i],n=niche(p),active=state.selected===p.key;
  const pulse=1+.09*Math.sin(seconds*1.7+i);
  const g=ctx.createRadialGradient(n.cx,12,2,n.cx,45,n.width*.70);
  const [r,gr,b]=hexRgb(p.color);g.addColorStop(0,`rgba(${r},${gr},${b},${active?.18:.09})`);g.addColorStop(.65,`rgba(${r},${gr},${b},${active?.048:.025})`);g.addColorStop(1,`rgba(${r},${gr},${b},0)`);
  ctx.fillStyle=g;ctx.fillRect(n.cx-n.width,0,n.width*2,canvas.height);
  ctx.strokeStyle=`rgba(${r},${gr},${b},${active?.13:.06})`;ctx.lineWidth=1.2;
  for(let j=0;j<3;j++){const yy=48+j*36+Math.sin(seconds*1.1+i+j)*5;ctx.beginPath();ctx.ellipse(n.cx,yy,n.width*(.22+.11*j)*pulse,3.5+j*.9,0,Math.PI*.12,Math.PI*.86);ctx.stroke()}
 }
 ctx.restore();
}

let basket={};try{basket=JSON.parse(localStorage.getItem('atelier-restored-basket')||'{}')||{}}catch{};
function saveBasket(){try{localStorage.setItem('atelier-restored-basket',JSON.stringify(basket))}catch{}}
function renderBasket(){const rows=ITEMS.filter(p=>basket[p.key]>0),count=rows.reduce((acc,p)=>acc+basket[p.key],0);$('#basketCount').textContent=count;
 $('#basketLines').innerHTML=rows.length?rows.map(p=>`<div class="basket-line"><img src="${p.fallback}" alt=""><div class="name"><strong>${p.name}</strong><span>€${p.price} · Quantity ${basket[p.key]}</span></div><button type="button" aria-label="Remove one ${p.name}" data-remove="${p.key}">−</button></div>`).join(''):'<p class="basket-empty">Your basket is empty.</p>';
 $('#basketTotal').textContent='€'+rows.reduce((acc,p)=>acc+p.price*basket[p.key],0);
 for(const b of $('#basketLines').querySelectorAll('[data-remove]'))b.onclick=()=>{basket[b.dataset.remove]=Math.max(0,Number(basket[b.dataset.remove]||0)-1);saveBasket();renderBasket()};
}
function openBasket(){renderBasket();$('#basketOverlay').hidden=false;$('#basketClose').focus()}
function closeBasket(){$('#basketOverlay').hidden=true}
$('#basketOpen').onclick=openBasket;$('#basketClose').onclick=closeBasket;$('#basketShade').onclick=closeBasket;
$('#home').onclick=()=>goTo(0);$('#back').onclick=()=>goTo(0);
$('#addBasket').onclick=()=>{const item=ITEMS.find(p=>p.key===state.selected);if(!item)return;basket[item.key]=(basket[item.key]||0)+1;saveBasket();openBasket()};
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#basketOverlay').hidden)closeBasket();else goTo(0)}if(!$('#basketOverlay').hidden)return;if(e.key==='ArrowRight')goTo(Math.min(5,Math.round(state.progress)+1));if(e.key==='ArrowLeft')goTo(Math.max(0,Math.round(state.progress)-1))});

function studioPanels(environment){for(const [w,h,x,y,z,c] of [[2.2,5.2,-3,1.2,2.3,'#fff8e9'],[1.5,4.2,3.8,1.7,2,'#e1f0ff'],[4.4,1.2,0,3.7,2,'#fff8e9']]){const mesh=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({color:c,toneMapped:false}));mesh.position.set(x,y,z);mesh.lookAt(0,0,0);environment.add(mesh)}}

// Restore the original coloured GLBs.  Critically, do NOT substitute a screenshot
// when zooming: this SINGLE WebGL canvas moves with the carved-rock environment.
async function createWebGL(){let renderer;
 try{renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false});renderer.setClearColor(0,0);renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;renderer.transmissionResolutionScale=mobile()?.76:.92;renderer.setPixelRatio(1);el.three.appendChild(renderer.domElement)}
 catch(error){console.warn('WebGL unavailable; restored bottle image fallbacks active',error);return null}
 const scene=new Scene(),camera=new PerspectiveCamera(32,1,.05,70);camera.position.z=12;
 scene.environmentIntensity=.86;scene.add(new AmbientLight('#e9e9ef',.28));
 // The actual supplied rock image is rendered on a full-frustum plane BEHIND
 // the original GLBs. Physical glass can thus transmit/refract the rock texture.
 // It is not a separate photo-based product scene; the camera remains continuous.
 const bgTex=new CanvasTexture(el.image);bgTex.colorSpace=SRGBColorSpace;
 const bgPlane=new Mesh(new PlaneGeometry(1,1),new MeshBasicMaterial({map:bgTex,toneMapped:false,depthWrite:false}));
 bgPlane.position.z=-3.5;bgPlane.renderOrder=-100;scene.add(bgPlane);
 function updateBackground(){if(!el.image.complete||!el.image.naturalWidth)return;
   bgTex.image=el.image;bgTex.needsUpdate=true;
   const visibleHeight=2*Math.tan(camera.fov*Math.PI/360)*(camera.position.z-bgPlane.position.z);
   bgPlane.scale.set(visibleHeight*camera.aspect,visibleHeight,1);
 }

 let pmrem;try{const room=new RoomEnvironment();studioPanels(room);pmrem=new PMREMGenerator(renderer);const env=pmrem.fromScene(room,.011);scene.environment=env.texture;pmrem.dispose();room.dispose()}catch(err){console.warn('Studio reflections unavailable',err)}
 const s={models:new Map(),spins:new Map(),loaded:new Set(),width:0,height:0,renderer,scene,camera};
 const loader=new GLTFLoader();
 const parameters={ambre:{glass:'#e9b568',absorption:'#b87836',liquid:'#b9741a',distance:1.3,thickness:.064},rose:{glass:'#dca7ba',absorption:'#a94c74',liquid:'#9d234c',distance:1.22,thickness:.067},galet:{glass:'#d4e8ad',absorption:'#80ac5b',liquid:'#457b25',distance:1.12,thickness:.061},bleu:{glass:'#8ec5fc',absorption:'#2366d9',liquid:'#1952dc',distance:1.08,thickness:.062}};
 const sizeF=()=>2*Math.tan(32*Math.PI/360)*12;
 function resize(){const {w,h}=metrics();if(w!==s.width||h!==s.height){s.width=w;s.height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();updateBackground()}const f=metrics(),worldH=sizeF(),worldW=worldH*camera.aspect;
  for(const p of ITEMS){const val=s.models.get(p.key);if(!val)continue;const n=niche(p),height=n.height/f.h*worldH,baseX=(n.cx/f.w-.5)*worldW,baseY=(.5-n.bottom/f.h)*worldH;const scale=height/val.originalHeight;
   val.pivot.position.set(baseX,baseY+height/2,.15);val.body.position.set(0,-height/2,0);val.body.scale.setScalar(scale);
   val.light.position.set(baseX+.3,baseY+height+1.2,2);val.light.target.position.set(baseX,baseY+height*.53,.15);
   val.rim.position.set(baseX+height*.49,baseY+height*.68,-1.4);val.rim.target.position.set(baseX,baseY+height*.45,.2);
   val.white.position.set(baseX-height*.4,baseY+height*1.12,2.8);val.white.target.position.set(baseX,baseY+height*.54,0);
  }
 }
 async function load(p){if(!p.file)return;try{
  const gltf=await loader.loadAsync(p.file),root=gltf.scene,bbox=new Box3().setFromObject(root),origin=bbox.getCenter(new Vector3()),height=bbox.max.y-bbox.min.y;
  const mats=parameters[p.key],body=new Group(),pivot=new Group();
  root.position.set(-origin.x,-bbox.min.y,-origin.z);
  const liquidBounds=new Box3();root.traverse(mesh=>{if(mesh.isMesh&&/eau de parfum/i.test(mesh.material?.name||''))liquidBounds.expandByObject(mesh)});
  const product={liquid:mats.liquid,fluidMotion:new Vector3(),fluidLight:{value:.82}};
  root.traverse(mesh=>{if(!mesh.isMesh)return;const mat=mesh.material,name=(mat.name||'').toLowerCase();
    if(name.includes('eau de parfum')){
      // Preserve the actual deep coloured liquid rather than replacing it with a flat PNG.
      mat.color.set(mats.liquid);mat.transmission=.43;mat.roughness=.08;mat.clearcoat=.28;mat.clearcoatRoughness=.09;mat.envMapIntensity=1.0;
    } else if(name.includes('crystal')&&!name.includes('cap')){
      // Keep the original glass geometry, thick optical edges and strong liquid colour.
      mat.color.set(mats.glass);mat.attenuationColor=new Color(mats.absorption);mat.attenuationDistance=mats.distance;
      mat.transmission=.965;mat.thickness=mats.thickness;mat.ior=1.49;mat.roughness=.038;mat.envMapIntensity=1.35;
      mat.clearcoat=.22;mat.clearcoatRoughness=.039;mat.side=DoubleSide;
      // Liquid is a real volume in the supplied GLB; avoid hiding the fill mesh.
    } else if(name.includes('clear')&&name.includes('cap')){mat.color.set('#f4f9ff');mat.transmission=.94;mat.roughness=.055;mat.ior=1.49}
    else if(p.key==='galet'&&(name.includes('pearl')||name.includes('cap'))){mat.color.set('#f9f6eb');mat.metalness=.11;mat.roughness=.22;mat.envMapIntensity=1.15}
    else if(name.includes('label')||name.includes('print')){mat.roughness=.83;mat.metalness=0;mat.envMapIntensity=.2;if(mat.map)mat.map.colorSpace=SRGBColorSpace}
  });
  body.add(root);pivot.add(body);scene.add(pivot);
  const light=new SpotLight('#fff3ea',17,0,Math.PI*.30,.67,1.3);const rim=new SpotLight(p.color,15,0,Math.PI*.38,.71,1.1);const white=new SpotLight('#fdf4ee',10,0,Math.PI*.36,.65,1.2);scene.add(light,light.target,rim,rim.target,white,white.target);
  s.models.set(p.key,{pivot,body,originalHeight:height,light,rim,white,product});s.loaded.add(p.key);resize();
  el.fallbacks.querySelector(`[data-key="${p.key}"]`)?.classList.add('webgl-ready');
 }catch(err){console.warn('Original GLB unavailable; retaining bottle image',p.key,err)}}
 function frame(now){if(document.hidden)return;resize();for(const p of ITEMS){const model=s.models.get(p.key);if(!model)continue;
  const selected=state.selected===p.key,other=state.selected&&state.selected!==p.key;
  const emphasis=selected?2.4:other?.86:1;
  model.light.intensity=lerp(model.light.intensity, (13+(!other?8:0))*emphasis,.075);model.rim.intensity=lerp(model.rim.intensity,12*emphasis,.08);model.white.intensity=lerp(model.white.intensity,8*emphasis,.08);
  let angle=0;const started=s.spins.get(p.key);if(started!==undefined){const t=clamp((now-started)/1670,0,1);angle=2*Math.PI*ease(t);if(t>=1)s.spins.delete(p.key)}
  model.pivot.rotation.set(0,angle+(reduced.matches?0:Math.sin(now*.00039+p.price)*.018),0);
  model.product.fluidMotion.z=now*.001;model.product.fluidLight.value=selected?1.12:.72;
 }
 renderer.render(scene,camera);
 }
 function spin(key){if(key==='photo'||!s.loaded.has(key)||reduced.matches)return;s.spins.set(key,performance.now())}
 window.addEventListener('resize',resize);mql.addEventListener('change',resize);
 s.frame=frame;s.resize=resize;s.spin=spin;s.updateBackground=updateBackground;
 resize();Promise.allSettled(ITEMS.filter(p=>p.file).map(load)).then(()=>{console.info('ATELIER restored four original 3D models')});return s;
}

function onResize(){const previous=state.progress;buildWorld();state.progress=clamp(scrollY/Math.max(1,innerHeight),0,5);state.target=shotAt(state.progress);state.shot=state.target;}
for(let i=0;i<6;i++){const block=document.createElement('div');block.className='scroll-stop';block.style.height='100vh';$('#scrollTrack').append(block)}
window.addEventListener('scroll',readScroll,{passive:true});window.addEventListener('resize',onResize);
mql.addEventListener('change',onResize);
renderBasket();buildWorld();readScroll();requestAnimationFrame(paintWorld);
createWebGL().then(v=>state.three=v).catch(err=>console.warn('3D fallback remains available',err));
