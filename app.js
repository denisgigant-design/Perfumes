import {ACESFilmicToneMapping, AmbientLight, Box3, Color, GLTFLoader, Group, MeshStandardMaterial, PerspectiveCamera, PMREMGenerator, RoomEnvironment, Scene, SpotLight, SRGBColorSpace, Vector3, WebGLRenderer} from './three-showroom.js';

// The two supplied images are used unchanged. Coordinates are image pixels so
// every bottle remains aligned with its actual shelf at any screen width.
// The fifth product is intentionally image-only: never create a mesh or rotate its PNG.
// The photo-only fifth bottle uses a €60 *demo* price until a separate price is supplied.
const ITEMS=[
  {key:'ambre',name:'Ambre Doré',desc:'A warm signature of amber, soft woods and golden light.',family:'AMBER · WOODS',price:80,short:'Amber · soft woods',model:'ambre-dore.glb',img:'tight-ambre-dore.png',hex:'#f3ab74',rgb:[243,171,116],d:{cx:211,bottom:597,h:259,top:116,w:211},m:{cx:270,bottom:686,h:254,top:186,w:217},cropD:[90,82,350,665],cropM:[117,139,422,746]},
  {key:'rose',name:'Rose Lune',desc:'An intimate veil of rose petals, gentle musk and twilight.',family:'FLORAL · MUSK',price:75,short:'Rose · gentle musk',model:'rose-lune-smoked.glb',img:'tight-rose-lune-smoked.png',hex:'#ed8baa',rgb:[237,139,170],d:{cx:491,bottom:597,h:227,top:117,w:207},m:{cx:582,bottom:685,h:231,top:185,w:236},cropD:[373,80,633,666],cropM:[421,141,746,748]},
  {key:'galet',name:'Galet',desc:'A quiet green freshness, luminous leaves and mineral air.',family:'GREEN · FRESH',price:95,short:'Green · mineral',model:'galet-crystal.glb',img:'tight-galet-smoked.png',hex:'#a4d99b',rgb:[164,217,155],d:{cx:775,bottom:595,h:252,top:119,w:206},m:{cx:159,bottom:1198,h:226,top:744,w:212},cropD:[646,79,906,667],cropM:[5,705,309,1267]},
  {key:'bleu',name:'Sillage Bleu',desc:'Cool mineral notes, blue glass and an oceanic finish.',family:'AQUATIC · MINERAL',price:60,short:'Cool · oceanic',model:'sillage-bleu.glb',img:'tight-sillage-bleu-glass.png',hex:'#6b9cf5',rgb:[107,156,245],d:{cx:1057,bottom:596,h:284,top:117,w:206},m:{cx:438,bottom:1201,h:257,top:743,w:207},cropD:[931,79,1191,666],cropM:[288,705,585,1267]},
  {key:'photo',name:'Bleu Royal',desc:'Deep blue glass, golden metalwork and a luminous modern signature.',family:'BLUE · GOLD',price:60,short:'Cobalt · gold',model:null,photo:true,img:'bleu-royal-photo.png',hex:'#427ef9',rgb:[66,126,249],d:{cx:1343,bottom:597,h:288,top:117,w:209},m:{cx:712,bottom:1199,h:265,top:744,w:213},cropD:[1214,78,1480,667],cropM:[574,705,860,1268]}
];
const $=s=>document.querySelector(s);
const stage=$('#stage'),fallbacks=$('#bottleFallbacks'),glows=$('#nicheGlows'),water=$('#waterGlows'),targets=$('#nicheTargets'),overlay=$('#productOverlay'),focusArt=$('#focusArt');
const mobileMedia=matchMedia('(max-width:720px)');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const clean=new Map();
let active=null,renderEngine=null,lastTouch=0;
let bag={};try{bag=JSON.parse(localStorage.getItem('atelier-basket-v2')||'{}')||{}}catch{}
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const placeStyle=(el,styles)=>{for(const [k,v] of Object.entries(styles))el.style.setProperty(k,v)};
const getLayout=()=>mobileMedia.matches?{w:864,h:1536,key:'m'}:{w:1536,h:864,key:'d'};
function coord(p){return p[getLayout().key]}
function saveBag(){try{localStorage.setItem('atelier-basket-v2',JSON.stringify(bag))}catch{}}
function redrawBag(){const count=ITEMS.reduce((n,p)=>n+(Number(bag[p.key])||0),0);$('#bagCount').textContent=count;
  const rows=ITEMS.filter(p=>Number(bag[p.key])>0);
  $('#basketLines').innerHTML=rows.length?rows.map(p=>`<div class="basket-row"><img src="${p.img}" alt=""><div><h3>${p.name}</h3><p>€${p.price} · Quantity ${bag[p.key]}</p></div><button data-remove="${p.key}" type="button" aria-label="Remove one ${p.name}">−</button></div>`).join(''):'<p class="basket-empty">Your basket is empty.</p>';
  $('#basketTotal').textContent='€'+rows.reduce((n,p)=>n+p.price*bag[p.key],0);
  $('#basketLines').querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{bag[b.dataset.remove]=Math.max(0,(bag[b.dataset.remove]||0)-1);saveBag();redrawBag()}));
}

// Even when a mobile compositor targets the photographic layer rather than
// its transparent hotspot, tapping inside a rock niche selects that bottle.
stage.addEventListener('click',e=>{
  if(e.target.closest?.('.niche-target'))return;
  const r=stage.getBoundingClientRect();if(!r.width||!r.height)return;
  const l=getLayout(),x=(e.clientX-r.left)/r.width*l.w,y=(e.clientY-r.top)/r.height*l.h;
  const hit=ITEMS.find(p=>{const a=p[l.key];return x>=a.cx-a.w/2&&x<=a.cx+a.w/2&&y>=a.top&&y<=a.bottom});
  if(hit)openProduct(hit.key);
});

function showBag(){redrawBag();$('#basketOverlay').hidden=false;document.body.classList.add('modal-open');$('#closeBasket').focus()}
function hideBag(){$('#basketOverlay').hidden=true;if(overlay.hidden)document.body.classList.remove('modal-open')}
$('#bagOpen').addEventListener('click',showBag);$('#closeBasket').addEventListener('click',hideBag);$('#basketDim').addEventListener('click',hideBag);
$('#home').addEventListener('click',()=>{closeProduct();hideBag();scrollTo({top:0,behavior:reduced.matches?'instant':'smooth'})});
function itemGlow(p){return `rgba(${p.rgb.join(',')},.56)`}
function layout(){const {w,h}=getLayout();glows.replaceChildren();water.replaceChildren();fallbacks.replaceChildren();targets.replaceChildren();
  for(const p of ITEMS){const a=coord(p);const x=a.cx/w*100;const gi=document.createElement('span');gi.className='niche-glow';gi.dataset.key=p.key;placeStyle(gi,{'--x':x+'%','--y':(a.top/h*100)+'%','--w':((a.w+46)/w*100)+'%','--h':((a.bottom-a.top)/h*100)+'%','--glow-soft':itemGlow(p)});glows.append(gi);
    const note=document.createElement('span');note.className='product-subtitle';note.textContent=p.short||'';placeStyle(note,{'--x':x+'%','--y':((a.bottom+Math.max(10,h*.009))/h*100)+'%','--w':((a.w+35)/w*100)+'%'});glows.append(note);
    const wg=document.createElement('span');wg.className='water-glow';wg.dataset.key=p.key;placeStyle(wg,{'--x':x+'%','--y':((mobileMedia.matches?1242:695)/h*100)+'%','--w':((a.w+100)/w*100)+'%','--h':((mobileMedia.matches?265:165)/h*100)+'%','--glow-soft':itemGlow(p)});water.append(wg);
    const img=document.createElement('img');img.src=''+p.img;img.alt='';img.className='bottle-img';img.dataset.key=p.key;img.loading='eager';if(p.photo)img.classList.add('is-photo');const bottleWidth=a.h*(p.key==='bleu'||p.photo?.47:.66);placeStyle(img,{'--x':x+'%','--bottom':((h-a.bottom)/h*100)+'%','--height':(a.h/h*100)+'%','--width':(bottleWidth/w*100)+'%','--halo':itemGlow(p)});fallbacks.append(img);
    if(!mobileMedia.matches){const reflection=document.createElement('img');reflection.src=''+p.img;reflection.className='bottle-reflection';reflection.alt='';reflection.loading='lazy';placeStyle(reflection,{'--x':x+'%','--top':(714/h*100)+'%','--height':(a.h*.65/h*100)+'%','--width':(bottleWidth/w*100)+'%'});fallbacks.append(reflection)}
    const button=document.createElement('button');button.className='niche-target';button.dataset.title=p.name;button.type='button';button.ariaLabel='Explore '+p.name;placeStyle(button,{'--x':x+'%','--y':a.top/h*100+'%','--w':a.w/w*100+'%','--h':(a.bottom-a.top)/h*100+'%'});button.addEventListener('pointerenter',()=>emphasis(p.key));button.addEventListener('pointerleave',()=>emphasis(active?.key||null));button.addEventListener('focus',()=>emphasis(p.key));button.addEventListener('click',()=>openProduct(p.key));targets.append(button);
  }
  emphasis(active?.key||null);
  renderEngine?.reposition();
}
function emphasis(key){for(const el of document.querySelectorAll('.niche-glow,.water-glow,.bottle-img'))el.classList.toggle('is-active',el.dataset.key===key)}
function openProduct(key){const p=ITEMS.find(p=>p.key===key);if(!p)return;active=p;emphasis(key);
  $('#focusName').textContent=p.name;$('#focusDescription').textContent=p.desc;$('#focusFamily').textContent=p.family;$('#focusPrice').textContent='€'+p.price;
  $('#focusBackground').src=`focus-${key}-desktop.jpg`;$('#focusMobileSource').srcset=`focus-${key}-mobile.jpg`;
  $('#focusBackground').alt=p.name+' in its illuminated basalt alcove';$('#focusBottleFallback').src=''+p.img;
  focusArt.classList.toggle('is-photo',!!p.photo);
  $('#presentationNote').textContent=p.photo?'STATIC IMAGE PRESENTATION':'INTERACTIVE 3D PRESENTATION';
  const crop=mobileMedia.matches?p.cropM:p.cropD,a=coord(p);const width=crop[2]-crop[0],height=crop[3]-crop[1];
  const relX=(a.cx-crop[0])/width*100,relBottom=(crop[3]-a.bottom)/height*100,relHeight=a.h/height*100;
  placeStyle(focusArt,{'--focushalo':`rgba(${p.rgb.join(',')},.52)`,'--fx':relX+'%','--fb':relBottom+'%','--fh':relHeight+'%','--focus-pointer':`rgba(${p.rgb.join(',')},.3)`});
  $('#focusBottleFallback').classList.remove('is-webgl');$('#focusBottleFallback').style.animation='none';void $('#focusBottleFallback').offsetWidth;$('#focusBottleFallback').style.animation='';
  overlay.hidden=false;document.body.classList.add('modal-open');emphasis(key);renderEngine?.focus(p);$('#closeFocus').focus();
}
function closeProduct(){overlay.hidden=true;active=null;emphasis(null);renderEngine?.unfocus();if($('#basketOverlay').hidden)document.body.classList.remove('modal-open')}
$('#closeFocus').addEventListener('click',closeProduct);$('#overlayDim').addEventListener('click',closeProduct);
$('#addToBasket').addEventListener('click',()=>{if(!active)return;bag[active.key]=(Number(bag[active.key])||0)+1;saveBag();showBag()});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#basketOverlay').hidden)hideBag();else if(!overlay.hidden)closeProduct()}});

// The wandering light tracks a physical pointer, with a small smooth inertia.
const lights=[{el:stage,overlay:$('#pointerLight'),x:.50,y:.42,targetX:.50,targetY:.42,opacity:0,rgba:'rgba(255,222,190,.26)'},{el:focusArt,overlay:$('#focusPointerLight'),x:.50,y:.38,targetX:.50,targetY:.38,opacity:0,rgba:'rgba(255,222,190,.28)'}];
function movePointer(e,light){const r=light.el.getBoundingClientRect();if(!r.width||!r.height)return;light.targetX=clamp((e.clientX-r.left)/r.width,0,1);light.targetY=clamp((e.clientY-r.top)/r.height,0,1);light.opacity=1;
  if(light.el===stage){const l=getLayout();const nearest=ITEMS.reduce((best,p)=>{const a=p[l.key];const dx=light.targetX-a.cx/l.w,dy=(light.targetY-(a.top+a.bottom)/2/l.h)*.6;const dist=dx*dx+dy*dy;return !best||dist<best.dist?{p,dist}:best},null).p;light.rgba=`rgba(${nearest.rgb.join(',')},.38)`;renderEngine?.pointer(light.targetX,light.targetY,false)}
  else{if(active)light.rgba=`rgba(${active.rgb.join(',')},.42)`;renderEngine?.pointer(light.targetX,light.targetY,true)}
}
for(const light of lights){light.el.addEventListener('pointermove',e=>movePointer(e,light),{passive:true});light.el.addEventListener('pointerdown',e=>{movePointer(e,light);if(e.pointerType==='touch')lastTouch=Date.now()},{passive:true});light.el.addEventListener('pointerup',e=>{if(e.pointerType==='touch'){lastTouch=Date.now();setTimeout(()=>{if(Date.now()-lastTouch>=600)light.opacity=.10},700)}},{passive:true});light.el.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch')light.opacity=.1},{passive:true})}
function animatePointer(){for(const light of lights){light.x+=(light.targetX-light.x)*.18;light.y+=(light.targetY-light.y)*.18;light.overlay.style.setProperty('--px',light.x*100+'%');light.overlay.style.setProperty('--py',light.y*100+'%');light.overlay.style.setProperty('--pcolor',light.rgba);light.overlay.style.setProperty('--pop',String(light.opacity))}requestAnimationFrame(animatePointer)}
requestAnimationFrame(animatePointer);

// Independent transparent WebGL layer: the supplied photography remains the scene.
async function initWebGL(){let galleryRenderer,focusRenderer;
  try{galleryRenderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});galleryRenderer.setClearColor(0x000000,0);galleryRenderer.outputColorSpace=SRGBColorSpace;galleryRenderer.toneMapping=ACESFilmicToneMapping;galleryRenderer.toneMappingExposure=1.27;galleryRenderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));$('#stage3d').appendChild(galleryRenderer.domElement);
    focusRenderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'default'});focusRenderer.setClearColor(0x000000,0);focusRenderer.outputColorSpace=SRGBColorSpace;focusRenderer.toneMapping=ACESFilmicToneMapping;focusRenderer.toneMappingExposure=1.27;focusRenderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));$('#focus3d').appendChild(focusRenderer.domElement);
  }catch(err){console.info('3D unavailable; transparent perfume imagery stays active.',err);galleryRenderer?.dispose();focusRenderer?.dispose();return}
  const scene=new Scene(),focusScene=new Scene();
  const camera=new PerspectiveCamera(32,1,.03,70),focusCamera=new PerspectiveCamera(32,1,.03,70);
  camera.position.z=12;focusCamera.position.z=12;const WORLD_H=2*Math.tan(32/2*Math.PI/180)*12;
  for(const s of [scene,focusScene])s.add(new AmbientLight('#f9f2ed',1.68));
  const sourceLight=new SpotLight('#fff6ec',115,0,Math.PI/4,.7,1.3);sourceLight.position.set(-3,7,6);sourceLight.target.position.set(0,-.5,0);scene.add(sourceLight,sourceLight.target);
  const sideLight=new SpotLight('#b0c0ee',66,0,Math.PI/3,.78,1.1);sideLight.position.set(5,1,7);sideLight.target.position.set(0,0,0);scene.add(sideLight,sideLight.target);
  const focusLight=new SpotLight('#ffebd9',125,0,Math.PI/3,.65,1);focusLight.position.set(-2,5,5);focusLight.target.position.set(0,0,0);focusScene.add(focusLight,focusLight.target);
  const pointerSpot=new SpotLight('#fff1da',75,0,Math.PI/4,.75,1);pointerSpot.position.set(0,1,3);pointerSpot.target.position.set(0,0,0);scene.add(pointerSpot,pointerSpot.target);
  const focusPointerSpot=new SpotLight('#fff1da',80,0,Math.PI/3,.78,1);focusPointerSpot.position.set(0,1,3.5);focusPointerSpot.target.position.set(0,0,0);focusScene.add(focusPointerSpot,focusPointerSpot.target);
  try{const pmrem=new PMREMGenerator(galleryRenderer);const env=pmrem.fromScene(new RoomEnvironment()).texture;scene.environment=env;focusScene.environment=env;pmrem.dispose()}catch(err){console.warn('Studio reflections unavailable',err)}
  const loader=new GLTFLoader(),models=new Map(),pivots=new Map();let focusPivot=null,focusCurrent=null,spinStarted=0;let stageSize=[0,0],focusSize=[0,0];const loadOne=async p=>{
    if(p.photo||!p.model)return;
    try{const gltf=await loader.loadAsync(''+p.model);const root=gltf.scene;const box=new Box3().setFromObject(root),size=new Vector3();box.getSize(size);const center=box.getCenter(new Vector3());root.position.set(-center.x,-box.min.y,-center.z);const unit=new Group();unit.add(root);models.set(p.key,{unit,height:size.y});
      const group=new Group();const model=unit.clone(true);group.add(model);pivots.set(p.key,{group,model});scene.add(group);reposition();
      const fallback=$(`.bottle-img[data-key="${p.key}"]`);fallback?.classList.add('is-webgl');if(active?.key===p.key)showFocus(p);
    }catch(err){console.warn('Unable to display '+p.name+' as 3D; showing supplied PNG.',err)}
  };
  function xyz(nx,ny){const widthWorld=WORLD_H*camera.aspect;return [(nx-.5)*widthWorld,(.5-ny)*WORLD_H]}
  function resizeRenderer(renderer,cam,host,memory){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return false;if(memory[0]!==w||memory[1]!==h){renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();memory[0]=w;memory[1]=h}return true}
  function reposition(){const {w,h,key}=getLayout();if(!resizeRenderer(galleryRenderer,camera,$('#stage3d'),stageSize))return;for(const p of ITEMS){const item=pivots.get(p.key);if(!item)continue;const a=p[key];const world=xyz(a.cx/w,a.bottom/h);item.group.position.set(world[0],world[1],0);const scl=(a.h/h*WORLD_H)/models.get(p.key).height;item.model.scale.setScalar(scl)}}
  function showFocus(p){if(focusPivot){focusScene.remove(focusPivot);focusPivot=null}focusCurrent=null;
    if(!p||p.photo)return;const m=models.get(p.key);if(!m)return;
    focusPivot=new Group();const model=m.unit.clone(true);focusPivot.add(model);focusScene.add(focusPivot);focusCurrent={p,model};spinStarted=performance.now();$('#focusBottleFallback').classList.add('is-webgl');placeFocus()}
  function placeFocus(){if(!focusCurrent||overlay.hidden)return;const host=$('#focus3d');if(!resizeRenderer(focusRenderer,focusCamera,host,focusSize))return;const p=focusCurrent.p,crop=mobileMedia.matches?p.cropM:p.cropD,a=coord(p);const cw=crop[2]-crop[0],ch=crop[3]-crop[1];const nx=(a.cx-crop[0])/cw,ny=(a.bottom-crop[1])/ch;const widthWorld=WORLD_H*focusCamera.aspect;focusPivot.position.set((nx-.5)*widthWorld,(.5-ny)*WORLD_H,0);const height=(a.h/ch)*WORLD_H;focusCurrent.model.scale.setScalar(height/models.get(p.key).height);focusLight.color.set(p.hex);focusLight.intensity=150;focusPointerSpot.color.set(p.hex)}
  function pointer(x,y,isFocus){const light=isFocus?focusPointerSpot:pointerSpot;const cam=isFocus?focusCamera:camera;const ww=WORLD_H*cam.aspect;light.position.set((x-.5)*ww, (.5-y)*WORLD_H,3.8);light.target.position.set((x-.5)*ww,(.5-y)*WORLD_H,0);light.intensity=isFocus?90:53}
  let prior=0;function tick(now){requestAnimationFrame(tick);if(document.hidden)return;resizeRenderer(galleryRenderer,camera,$('#stage3d'),stageSize);if(!prior||now-prior>14){prior=now;for(const [key,entry]of pivots){const idx=ITEMS.findIndex(p=>p.key===key);entry.group.rotation.y=reduced.matches?0:Math.sin(now*.00042+idx)*.022;entry.group.position.y+=0}
      galleryRenderer.render(scene,camera);
      if(!overlay.hidden){placeFocus();if(focusPivot){const t=clamp((now-spinStarted)/1550,0,1);const eased=1-Math.pow(1-t,3);focusPivot.rotation.y=reduced.matches?0:Math.PI*2*eased;focusPivot.position.y+=(reduced.matches?0:Math.sin(t*Math.PI)*.006);focusRenderer.render(focusScene,focusCamera)}}}}
  renderEngine={reposition,focus:showFocus,unfocus:()=>{focusCurrent=null;if(focusPivot){focusScene.remove(focusPivot);focusPivot=null}},pointer};
  reposition();requestAnimationFrame(tick);
  await Promise.allSettled(ITEMS.filter(p=>!p.photo&&p.model).map(loadOne));
}
layout();redrawBag();mobileMedia.addEventListener('change',()=>{layout();if(active)openProduct(active.key)});window.addEventListener('resize',()=>renderEngine?.reposition());
initWebGL().catch(err=>console.warn('Three.js fallback enabled',err));
