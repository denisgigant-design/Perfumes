import {
 ACESFilmicToneMapping, AmbientLight, Box3, Color, GLTFLoader,
 Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera,
 PlaneGeometry, PMREMGenerator, RoomEnvironment, Scene, SpotLight,
 SRGBColorSpace, Vector3, WebGLRenderer
} from './three-showroom.js';
// Original GLB volumes are rendered as authored: no stacked shader overlays.

// Coordinate system is the supplied original scene image, NOT a newly made card or screenshot.
// All presentation elements live inside the ONE world and transform together.
const ITEMS = [
 {key:'ambre',name:'Ambre Doré',fruit:'Joy',desc:'Golden amber, soft woods and a warm lingering signature.',price:80,file:'ambre-dore.glb',fallback:'tight-ambre-dore.png',color:'#eea869',liquid:'#c57a21',glass:'#d8a76a',deep:'#bd773b',m:[211,596,258,210,116,607],p:[270,683,252,218,185,697]},
 {key:'rose',name:'Rose Lune',fruit:'Love',desc:'Velvet rose petals, soft musk and luminous evening air.',price:75,file:'rose-lune-smoked.glb',fallback:'tight-rose-lune-smoked.png',color:'#df7098',liquid:'#b23859',glass:'#c5889c',deep:'#b86b83',m:[491,595,242,209,115,606],p:[582,683,235,227,185,697]},
 {key:'galet',name:'Galet',fruit:'Kindness',desc:'A vivid green accord of mineral freshness and living leaves.',price:95,file:'galet-crystal.glb',fallback:'tight-galet-smoked.png',color:'#8ecf67',liquid:'#49822e',glass:'#a4d88e',deep:'#779f4b',m:[775,594,247,210,117,606],p:[159,1196,226,215,743,1208]},
 {key:'bleu',name:'Sillage Bleu',fruit:'Peace',desc:'Deep cobalt glass with crystalline marine and mineral notes.',price:60,file:'sillage-bleu.glb',fallback:'tight-sillage-bleu-glass.png',color:'#4f90f9',liquid:'#155bf3',glass:'#71b4fa',deep:'#3068c9',m:[1067,595,285,209,114,606],p:[438,1197,289,210,742,1209]},
 {key:'photo',name:'Bleu Royal',fruit:'Faithfulness',desc:'The blue-and-gold photographic presentation — a luminous modern signature.',price:60,file:null,fallback:'bleu-royal-photo.png',color:'#417cf4',liquid:'#205ced',glass:'#427dec',deep:'#3768c1',m:[1343,595,379,212,115,606],p:[713,1197,379,214,742,1209]}
];
const D={w:1536,h:864,water:696}, M={w:864,h:1536,water:1273};
const $=s=>document.querySelector(s);
const el={surround:$('#surround'),world:$('#world'),viewport:$('#viewport'),image:$('#background'),glows:$('#nicheColors'),water:$('#waterSurface'),fallbacks:$('#fallbacks'),hotspots:$('#hotspots'),three:$('#threeMount'),welcome:$('#welcome'),caption:$('#caption'),back:$('#back'),hint:$('#scrollHint'),status:$('#positionStatus')};
const mql=matchMedia('(max-width:720px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const hexRgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const mobile=()=>mql.matches, metrics=()=>mobile()?M:D;
const niche=p=>{let v=mobile()?p.p:p.m;return {cx:v[0],bottom:v[1],height:v[2],width:v[3],top:v[4],low:v[5]}};
const ease=t=>t*t*(3-2*t);
const state={lastWheel:0,lastTouch:0,shot:{cx:768,cy:432,zoom:1},target:{cx:768,cy:432,zoom:1},progress:0,selected:null,three:null,waterLast:0,imagesReady:false};

// A checkpoint is always inside the SAME background. Scroll progresses through all five,
// and clicking a product jumps the scroll checkpoint then flies the continuous camera there.
function viewAt(i){
 const f=metrics(),idx=clamp(Math.round(i),0,5);
 if(idx===0)return {cx:f.w/2,cy:f.h/2,zoom:1};
 const n=niche(ITEMS[idx-1]);
 // Slightly wider selected shots: entire recessed niche stays visible, with rock around it.
 const zoom=mobile()?2.06:1.56;
 const cy=(n.top+n.low)*.5+(mobile() && idx>=3?90:0);
 if(mobile()){
   const vw=innerWidth,vh=innerHeight,base=Math.min(vw/f.w,vh/f.h);
   const halfX=vw/(2*base*zoom),halfY=vh/(2*base*zoom);
   return {cx:clamp(n.cx,halfX,f.w-halfX),cy:clamp(cy,halfY,f.h-halfY),zoom};
 }
 return {cx:n.cx,cy,zoom};
}
function shotAt(progress){return viewAt(clamp(Math.round(progress),0,5))}
function readScroll(){
 if(mobile())return;
 const idx=clamp(Math.round(scrollY/Math.max(1,innerHeight)),0,5);
 if(idx!==state.progress){state.progress=idx;state.target=shotAt(idx);setSelected(idx?ITEMS[idx-1]:null,idx)}
}
function goTo(index){
 const idx=clamp(Math.round(index),0,5);
 if(!mobile())window.scrollTo({top:idx*innerHeight,behavior:'instant'});
 state.progress=idx;state.target=shotAt(idx);
 setSelected(idx?ITEMS[idx-1]:null,idx);
}
function paintWorld(now){const f=metrics(),rect=el.viewport.getBoundingClientRect();const scaleBase=Math.min(rect.width/f.w,rect.height/f.h);
 const t=reduced.matches?1:.10;
 for(const key of ['cx','cy','zoom'])state.shot[key]=lerp(state.shot[key],state.target[key],t);
 const scale=scaleBase*state.shot.zoom;const horizontal=rect.width*.5, vertical=rect.height*(mobile()? .445 : .465);
 const x=horizontal-state.shot.cx*scale,y=vertical-state.shot.cy*scale;
 el.world.style.transform=`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${scale.toFixed(5)})`;
 state.three?.frame(now);
 if(now-state.waterLast>46){drawWater(now);state.waterLast=now}
 requestAnimationFrame(paintWorld);
}
function setSelected(item,idx){if(state.selected===item?.key)return;
 const was=state.selected;
 state.selected=item?.key||null;
 if(item?.file && was!==item.key){state.three?.spin(item.key)};
 el.viewport.classList.toggle('is-focused',!!item);
 el.welcome.classList.toggle('hidden',!!item);el.caption.classList.toggle('visible',!!item);el.caption.setAttribute('aria-hidden',String(!item));el.back.classList.toggle('visible',!!item);el.hint.classList.toggle('fade',!!item);el.status.textContent=idx?`${String(idx).padStart(2,'0')} — 05`:'01 — 05';
 if(item){$('#stepNumber').textContent=String(idx).padStart(2,'0')+' / 05';$('#itemName').textContent=item.name;$('#itemDesc').textContent=item.desc;$('#price').textContent='€'+item.price;$('#fruitCaption').textContent='Fruit of the Spirit · '+item.fruit;document.documentElement.style.setProperty('--selected-rgb',hexRgb(item.color).join(','));}else{document.documentElement.style.setProperty('--selected-rgb','175,169,159')}
 for(const n of el.glows.children)n.classList.toggle('active',n.dataset.key===state.selected);
 for(const n of el.fallbacks.children)n.classList.toggle('active',n.dataset.key===state.selected);
 for(const n of el.hotspots.children)n.setAttribute('aria-current',String(n.dataset.key===state.selected));
}

function buildWorld(){const f=metrics();el.world.style.width=f.w+'px';el.world.style.height=f.h+'px';el.image.onload=()=>{state.imagesReady=true;state.waterLast=0};el.image.src=mobile()?'scene-mobile.png':'scene-desktop.png';el.surround.src=mobile()?'surround-mobile.jpg':'surround-desktop.jpg';if(el.image.complete && el.image.naturalWidth)state.imagesReady=true;
 el.glows.replaceChildren();el.fallbacks.replaceChildren();el.hotspots.replaceChildren();
 for(let i=0;i<ITEMS.length;i++){const p=ITEMS[i],n=niche(p);
  const glow=document.createElement('div');glow.className='niche-light';glow.dataset.key=p.key;
  Object.entries({'--x':n.cx+'px','--y':n.top+'px','--w':n.width+'px','--h':(n.low-n.top)+'px','--tint':`rgba(${hexRgb(p.color).join(',')},.70)`}).forEach(([k,v])=>glow.style.setProperty(k,v));el.glows.append(glow);
  const bottle=document.createElement('img');bottle.className='bottle-img'+(p.file?'':' photo-bottle');bottle.dataset.key=p.key;bottle.src=p.fallback;bottle.alt='';bottle.draggable=false;bottle.loading='eager';
  const visualWidth=p.key==='photo'?n.height*.76:p.key==='bleu'?n.height*.58:n.height*.76;
  Object.entries({'--x':n.cx+'px','--bottom':(f.h-n.bottom)+'px','--h':n.height+'px','--w':Math.min(n.width*.90,visualWidth)+'px','--glow':p.color}).forEach(([k,v])=>bottle.style.setProperty(k,v));el.fallbacks.append(bottle);
  const hit=document.createElement('button');hit.type='button';hit.className='niche-hit';hit.dataset.key=p.key;hit.dataset.name=p.name;hit.setAttribute('aria-label',`View ${p.name} and its price`);
  Object.entries({'--x':n.cx+'px','--y':n.top+'px','--w':n.width+'px','--h':(n.low-n.top)+'px'}).forEach(([k,v])=>hit.style.setProperty(k,v));
  let gesture=null,dragged=false;
  hit.addEventListener('pointerdown',e=>{gesture={x:e.clientX,y:e.clientY,t:e.timeStamp};dragged=false;});
  hit.addEventListener('pointermove',e=>{
   if(!gesture||!p.file||state.selected!==p.key)return;
   const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
   if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.25){
     dragged=true;state.three?.rotateBy(p.key,dx*.011);
     gesture={x:e.clientX,y:e.clientY,t:e.timeStamp};
   }
  });
  hit.addEventListener('pointerup',()=>{gesture=null;});
  hit.addEventListener('pointercancel',()=>{gesture=null;});
  hit.addEventListener('click',e=>{if(dragged){dragged=false;e.preventDefault();return;}const again=state.selected===p.key;goTo(i+1);if(again&&p.file)state.three?.spin(p.key)});
  el.hotspots.append(hit);
  // Use the user's original rock image alone; no synthetic sawtooth borders.
 }
 el.water.width=f.w;el.water.height=f.h-f.water;el.water.style.left='0px';el.water.style.top=f.water+'px';el.water.style.width=f.w+'px';el.water.style.height=(f.h-f.water)+'px';
 state.shot=shotAt(state.progress);state.target=shotAt(state.progress);const oldSelection=state.selected;state.selected=null;setSelected(oldSelection?ITEMS.find(p=>p.key===oldSelection):null,Math.round(state.progress));state.three?.resize();
}
function drawWater(now){if(!state.imagesReady||!el.image.complete||!el.image.naturalWidth)return;
 const f=metrics(),canvas=el.water,ctx=canvas.getContext('2d',{alpha:true});const seconds=reduced.matches?0:now*.001;
 ctx.clearRect(0,0,canvas.width,canvas.height);
 for(let y=0;y<canvas.height;y+=4){const slice=Math.min(4,canvas.height-y);
   const dx=(Math.sin(seconds*.90+y*.046)*.77+Math.sin(seconds*.44+y*.022)*.55)*(y/canvas.height*.48+.24);
   ctx.drawImage(el.image,0,f.water+y,f.w,slice,dx,y,f.w,slice);
 }
 ctx.save();ctx.globalCompositeOperation='screen';
 for(let i=0;i<ITEMS.length;i++){const p=ITEMS[i],n=niche(p),active=state.selected===p.key;
  const pulse=1+.06*Math.sin(seconds*1.7+i);
  const g=ctx.createRadialGradient(n.cx,13,2,n.cx,55,n.width*.83);
  const [r,gr,b]=hexRgb(p.color);g.addColorStop(0,`rgba(${r},${gr},${b},${active?.22:.105})`);g.addColorStop(.65,`rgba(${r},${gr},${b},${active?.064:.03})`);g.addColorStop(1,`rgba(${r},${gr},${b},0)`);
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
 try{renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false});renderer.setClearColor(0,0);renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=.96;renderer.transmissionResolutionScale=1;renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile()?1.5:1.7));el.three.appendChild(renderer.domElement)}
 catch(error){console.warn('WebGL unavailable; restored bottle image fallbacks active',error);return null}
 const scene=new Scene(),camera=new PerspectiveCamera(32,1,.05,70);camera.position.z=12;
 scene.environmentIntensity=1.03;scene.add(new AmbientLight('#b8c3d2',.34));
 // The photograph is a DOM layer that always remains visible behind the
 // transparent WebGL bottle canvas. Never draw another rectangular wall plane
 // inside WebGL: that opaque plane caused the black screen on mobile.

 let pmrem;try{const room=new RoomEnvironment();studioPanels(room);pmrem=new PMREMGenerator(renderer);const env=pmrem.fromScene(room,.011);scene.environment=env.texture;pmrem.dispose();room.dispose()}catch(err){console.warn('Studio reflections unavailable',err)}
 const s={models:new Map(),spins:new Map(),manualYaw:new Map(),loaded:new Set(),width:0,height:0,renderer,scene,camera};
 const loader=new GLTFLoader();
 const parameters={
  ambre:{absorption:'#bf773a',liquid:'#ad5917',distance:.98},
  rose:{absorption:'#aa6178',liquid:'#a33b60',distance:.92},
  galet:{absorption:'#559d55',liquid:'#408d2c',distance:.88},
  bleu:{absorption:'#3479dc',liquid:'#1554be',distance:1.04}
 };
 const sizeF=()=>2*Math.tan(32*Math.PI/360)*12;
 function resize(){const {w,h}=metrics();if(w!==s.width||h!==s.height){s.width=w;s.height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}const f=metrics(),worldH=sizeF(),worldW=worldH*camera.aspect;
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
  
  const product={liquid:mats.liquid,fluidMotion:new Vector3(),fluidLight:{value:.72}};
  root.traverse(mesh=>{if(!mesh.isMesh)return;
   const mat=mesh.material,name=(mat?.name||'').toLowerCase();
   if(name.includes('eau de parfum')){
      // Preserve the beautiful saturated liquid authored in the original GLB.
      // Avoid a second copy of the liquid on the glass as a shader/overlay.
      mesh.visible=true;
      mat.transmission=Math.min(mat.transmission||0,.35);mat.ior=1.37;mat.thickness=.11;
      mat.roughness=.095;mat.clearcoat=.28;mat.clearcoatRoughness=.12;
      mat.attenuationColor=new Color(mats.liquid);
      mat.attenuationDistance=.38;mat.envMapIntensity=.95;
      mat.depthWrite=true;mat.side=0;
   }else if(name.includes('crystal') && !name.includes('cap')){
      // Keep ORIGINAL coloured glass, do not bleach it with whitish RGB overrides.
      mat.transmission=Math.min(mat.transmission||.88,.86);mat.thickness=.055;mat.ior=1.47;
      mat.attenuationColor=new Color(mats.absorption);
      mat.attenuationDistance=mats.distance;
      mat.roughness=.052;mat.clearcoat=.34;mat.clearcoatRoughness=.07;
      mat.envMapIntensity=1.18;mat.side=0;
   }else if(name.includes('clear')&&name.includes('cap')){
      mat.transmission=.97;mat.thickness=.04;mat.ior=1.49;
      mat.roughness=.045;mat.clearcoat=.36;mat.envMapIntensity=1.22;
   }else if(name.includes('label')||name.includes('print')){
      if(mat.map){mat.map.colorSpace=SRGBColorSpace;mat.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy())}
      mat.roughness=.76;mat.metalness=0;mat.envMapIntensity=.3;
   }else if(name.includes('atomizer tube')){
      mat.transmission=0;mat.roughness=.3;
   }else if(name.includes('gold')||name.includes('metal')||name.includes('collar')||name.includes('platinum')||name.includes('lacquer')){
      mat.metalness=Math.max(.56,mat.metalness||0);mat.roughness=.18;
      mat.envMapIntensity=1.25;
   }else if(name.includes('pearl')){
      mat.roughness=.25;mat.envMapIntensity=.95;
   }
  });
  body.add(root);pivot.add(body);scene.add(pivot);
  const light=new SpotLight('#f9f5ec',13,0,Math.PI*.20,.58,1.4);const rim=new SpotLight(p.color,11,0,Math.PI*.29,.64,1.5);const white=new SpotLight('#f4f6ff',2.5,0,Math.PI*.23,.71,1.3);scene.add(light,light.target,rim,rim.target,white,white.target);
  s.models.set(p.key,{pivot,body,originalHeight:height,light,rim,white,product});s.loaded.add(p.key);resize();if(state.selected===p.key&&!reduced.matches)s.spins.set(p.key,performance.now());
  el.fallbacks.querySelector(`[data-key="${p.key}"]`)?.classList.add('webgl-ready');el.glows.querySelector(`[data-key="${p.key}"]`)?.classList.add('webgl-lit');
 }catch(err){console.warn('Original GLB unavailable; retaining bottle image',p.key,err)}}
 function frame(now){if(document.hidden)return;resize();for(const p of ITEMS){const model=s.models.get(p.key);if(!model)continue;
  const selected=state.selected===p.key,other=state.selected&&state.selected!==p.key;
  const emphasis=selected?1.5:other?.85:1;
  model.light.intensity=lerp(model.light.intensity,9.0*(selected?1.52:other?.70:1),.09);model.rim.intensity=lerp(model.rim.intensity,11*(selected?1.65:other?.65:1),.085);model.white.intensity=lerp(model.white.intensity,2.3*(selected?1.34:other?.8:1),.09);
  let angle=0;const started=s.spins.get(p.key);if(started!==undefined){const t=clamp((now-started)/1670,0,1);angle=2*Math.PI*ease(t);if(t>=1)s.spins.delete(p.key)}
  model.pivot.rotation.set(0,angle+(s.manualYaw.get(p.key)||0)+(reduced.matches?0:Math.sin(now*.00039+p.price)*.011),0);
  model.product.fluidMotion.z=now*.001;model.product.fluidLight.value=selected?1.12:.72;
 }
 renderer.render(scene,camera);
 }
 function spin(key){if(key==='photo'||!s.loaded.has(key)||reduced.matches||s.spins.has(key))return;s.spins.set(key,performance.now())}
 window.addEventListener('resize',resize);mql.addEventListener('change',resize);
 s.frame=frame;s.resize=resize;s.spin=spin;s.rotateBy=(key,delta)=>s.manualYaw.set(key,(s.manualYaw.get(key)||0)+delta);
 resize();Promise.allSettled(ITEMS.filter(p=>p.file).map(load)).then(()=>{console.info('ATELIER restored four original 3D models')});return s;
}

function onResize(){
 const previous=state.progress;buildWorld();
 state.progress=mobile()?previous:clamp(Math.round(scrollY/Math.max(1,innerHeight)),0,5);
 state.target=shotAt(state.progress);state.shot=state.target;
}
for(let i=0;i<6;i++){const block=document.createElement('div');block.className='scroll-stop';block.style.height='100vh';$('#scrollTrack').append(block)}
window.addEventListener('scroll',readScroll,{passive:true});
// One wheel gesture = one distinct product checkpoint, no intermediate stops.
window.addEventListener('wheel',e=>{
 if(mobile() || !$('#basketOverlay').hidden || Math.abs(e.deltaY)<3)return;
 e.preventDefault();const now=performance.now();
 if(now-state.lastWheel<600)return;
 state.lastWheel=now;
 goTo(clamp(state.progress+(e.deltaY>0?1:-1),0,5));
},{passive:false});
let touchOrigin=null;
window.addEventListener('touchstart',e=>{if(mobile())return;if(e.touches.length===1)touchOrigin={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
window.addEventListener('touchend',e=>{
 if(mobile())return;
 if(!touchOrigin || !$('#basketOverlay').hidden)return;
 const dy=(e.changedTouches[0]?.clientY||touchOrigin.y)-touchOrigin.y;
 const dx=(e.changedTouches[0]?.clientX||touchOrigin.x)-touchOrigin.x;
 touchOrigin=null;
 if(Math.abs(dy)<45||Math.abs(dy)<Math.abs(dx)*1.2)return;
 const now=performance.now();if(now-state.lastTouch<450)return;state.lastTouch=now;
 goTo(clamp(state.progress+(dy<0?1:-1),0,5));
},{passive:true});
window.addEventListener('resize',onResize);
mql.addEventListener('change',onResize);
if(mobile())window.scrollTo(0,0);
renderBasket();buildWorld();readScroll();requestAnimationFrame(paintWorld);
createWebGL().then(v=>state.three=v).catch(err=>console.warn('3D fallback remains available',err));
