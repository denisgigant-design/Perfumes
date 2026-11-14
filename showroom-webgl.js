/* ATELIER — a dependency-free glTF/GLB WebGL2 renderer.
   Actual mesh vertices, metallic and glass materials, and baked-in label textures
   are read from the included .glb files. Nothing is a 2D billboard in WebGL mode. */
(async function () {
  'use strict';
  const stage=document.getElementById('stage');
  const viewer=document.getElementById('viewerShade');
  const viewerMount=document.getElementById('three-canvas');
  if(!stage || !viewerMount) return;
  const canvas=document.createElement('canvas');
  canvas.id='live-three';canvas.setAttribute('aria-label','Live 3D perfume models');
  stage.appendChild(canvas);
  let gl;
  try {gl=canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});}
  catch(e){}
  if(!gl){canvas.remove();document.querySelectorAll('.glb-indicator').forEach(el=>el.textContent='IMAGE PREVIEW · 3D UNAVAILABLE');return;}
  const vert=`#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPosition;
  layout(location=1) in vec3 aNormal;
  layout(location=2) in vec2 aUV;
  uniform mat4 uVP,uModel;
  uniform vec3 uCenter;
  out vec3 vNormal,vWorld;
  out vec2 vUV;
  void main(){
    vec4 w=uModel*vec4(aPosition-uCenter,1.);
    gl_Position=uVP*w;
    vWorld=w.xyz;
    vNormal=normalize(mat3(uModel)*aNormal);
    vUV=aUV;
  }`;
  const frag=`#version 300 es
  precision highp float;
  in vec3 vNormal,vWorld;
  in vec2 vUV;
  uniform vec4 uColor;
  uniform vec3 uAccent;
  uniform sampler2D uTexture;
  uniform int uUseTex,uRole;
  uniform float uMetal,uRough,uOpacity;
  out vec4 finalColor;
  void main(){
    vec3 N=normalize(vNormal);
    vec3 V=normalize(vec3(0.,0.,14.)-vWorld);
    if(!gl_FrontFacing) N=-N;
    vec3 L=normalize(vec3(-.55,.87,1.6));
    vec3 L2=normalize(vec3(.95,.12,1.15));
    float d=max(dot(N,L),0.);
    float d2=max(dot(N,L2),0.);
    float fres=pow(1.-clamp(abs(dot(N,V)),0.,1.),2.5);
    vec3 H=normalize(L+V),H2=normalize(L2+V);
    float gloss=mix(32.,230.,1.-uRough);
    float sp=pow(max(dot(N,H),0.),gloss);
    float sp2=pow(max(dot(N,H2),0.),gloss*.65);
    float stripe=pow(max(dot(N,normalize(vec3(-.85,.18,.75))),0.),24.);
    vec4 t=uUseTex==1?texture(uTexture,vUV):vec4(1.);
    vec3 c=uColor.rgb*t.rgb;
    float a=uColor.a*t.a*uOpacity;
    vec3 light=c*(.24+.70*d+.33*d2)+vec3(1.,.94,.87)*sp*2.5+uAccent*sp2*1.3;
    if(uRole==2){
      // Layered translucent glass: colored body, bright contours, moving studio highlights.
      vec3 irid=uAccent*mix(.14,.28,fres);
      light=c*(.28+.25*d)+irid + vec3(.82,.91,.94)*(fres*.78+sp*2.15+stripe*.28);
      a=clamp((.21+.62*fres+.16*sp)*uOpacity,.09,.92);
    } else if(uRole==1){
      light=c*(.62+.70*d)+uAccent*.13+vec3(.9,.96,.8)*(sp*.5+fres*.20);
      a=.90*uOpacity;
    } else if(uRole==3){
      light=mix(c,c*(.93+.21*d),.16)+vec3(1.)*sp*.10;
      a=t.a*uOpacity;
    } else if(uRole==4){
      light=c*(.43+.55*d)+vec3(1.,.96,.83)*(sp*.88+sp2*.25)+uAccent*fres*.13;
    } else {
      light=c*(.20+.48*d+.22*d2)+vec3(1.,.94,.81)*sp*(1.2+uMetal*2.5)+uAccent*sp2*.7+vec3(.85)*fres*.2;
    }
    finalColor=vec4(max(light,vec3(0.)),a);
  }`;
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  let program;
  try{program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vert));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,frag));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));}
  catch(e){console.warn('WebGL shaders unavailable',e);canvas.remove();document.querySelectorAll('.glb-indicator').forEach(el=>el.textContent='IMAGE PREVIEW · 3D UNAVAILABLE');return;}
  gl.useProgram(program);
  const U={};['uVP','uModel','uCenter','uColor','uAccent','uTexture','uUseTex','uRole','uMetal','uRough','uOpacity'].forEach(k=>U[k]=gl.getUniformLocation(program,k));
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.CULL_FACE);
  const white=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,white);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  const models={};
  function parseGlb(buf){
    const view=new DataView(buf);if(view.getUint32(0,true)!==0x46546c67)throw Error('Invalid GLB');
    let off=12,json=null,bin=null;
    while(off<buf.byteLength){const length=view.getUint32(off,true),type=view.getUint32(off+4,true);const chunk=buf.slice(off+8,off+8+length);if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(chunk));if(type===0x004e4942)bin=chunk;off+=length+8;}
    if(!json||!bin)throw Error('Incomplete GLB');return {json,bin};
  }
  function componentBytes(t){return {5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[t]||4;}
  function readAccessor(j,bin,id){
    const a=j.accessors[id],b=j.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];
    const byteOffset=(b.byteOffset||0)+(a.byteOffset||0);
    const stride=b.byteStride||n*componentBytes(a.componentType);
    const v=new DataView(bin),out=[];
    for(let i=0;i<a.count;i++)for(let k=0;k<n;k++){
      const q=byteOffset+i*stride+k*componentBytes(a.componentType);
      out.push(a.componentType===5126?v.getFloat32(q,true):a.componentType===5125?v.getUint32(q,true):a.componentType===5123?v.getUint16(q,true):v.getUint8(q));
    }
    return out;
  }
  function normals(points,indices){
    const ns=new Float32Array(points.length);
    for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
      const ux=points[b]-points[a],uy=points[b+1]-points[a+1],uz=points[b+2]-points[a+2];
      const vx=points[c]-points[a],vy=points[c+1]-points[a+1],vz=points[c+2]-points[a+2];
      const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      for(const p of [a,b,c]){ns[p]+=nx;ns[p+1]+=ny;ns[p+2]+=nz;}
    }
    for(let i=0;i<ns.length;i+=3){const r=Math.hypot(ns[i],ns[i+1],ns[i+2])||1;ns[i]/=r;ns[i+1]/=r;ns[i+2]/=r;}return ns;
  }
  function buffer(data,location,size){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0);}
  async function loadModel(key){
    const response=await fetch('assets/'+(key==='rose'?'rose-lune':'galet')+'.glb');if(!response.ok)throw Error('GLB fetch: '+response.status);
    const {json:j,bin}=parseGlb(await response.arrayBuffer());
    const textures=[];
    for(const image of (j.images||[])){
      const b=j.bufferViews[image.bufferView],bytes=bin.slice(b.byteOffset||0,(b.byteOffset||0)+b.byteLength);
      const blob=new Blob([bytes],{type:image.mimeType||'image/png'});
      const bitmap=await createImageBitmap(blob);
      const tx=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tx);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.generateMipmap(gl.TEXTURE_2D);
      bitmap.close();textures.push(tx);
    }
    const primitives=[];let mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];
    for(const mesh of j.meshes)for(const p of mesh.primitives){
      const points=readAccessor(j,bin,p.attributes.POSITION),indices=readAccessor(j,bin,p.indices);
      const nn=readAccessorOptional(p.attributes.NORMAL,()=>normals(points,indices),j,bin);
      const uv=readAccessorOptional(p.attributes.TEXCOORD_0,()=>new Float32Array(points.length/3*2),j,bin);
      for(let i=0;i<points.length;i+=3)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],points[i+k]);mx[k]=Math.max(mx[k],points[i+k]);}
      const vao=gl.createVertexArray();gl.bindVertexArray(vao);buffer(new Float32Array(points),0,3);buffer(new Float32Array(nn),1,3);buffer(new Float32Array(uv),2,2);
      const element=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,element);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);gl.bindVertexArray(null);
      const material=j.materials[p.material]||{},m=material.pbrMetallicRoughness||{},name=material.name||mesh.name||'';
      const role=name.includes('glass')?2:name.includes('liquid')?1:name.includes('label')?3:name.includes('cap_pearl')||name.includes('cap_lower')?4:0;
      const texIdx=m.baseColorTexture?.index;const tex=texIdx===undefined?null:textures[j.textures[texIdx].source];
      primitives.push({vao,count:indices.length,role,tex,color:m.baseColorFactor||[1,1,1,1],metal:m.metallicFactor||0,rough:m.roughnessFactor||.2,name});
    }
    primitives.sort((a,b)=>({0:0,4:0,1:1,2:2,3:3}[a.role])-({0:0,4:0,1:1,2:2,3:3}[b.role]));
    const mid=mn.map((n,i)=>(n+mx[i])/2),height=mx[1]-mn[1];
    return {primitives,mid,height,x:0,y:0,scale:0,opacity:0,angle:0,tilt:0,key};
  }
  function readAccessorOptional(index,defaultFn,j,bin){return index===undefined?defaultFn():readAccessor(j,bin,index);}
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function perspective(fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
  function viewProjection(aspect){let p=perspective(33*Math.PI/180,aspect,.1,100);const m=Array.from(p);for(let i=0;i<4;i++)p[i*4+3]=m[i*4+3];p[12]=-14*m[8];p[13]=-14*m[9];p[14]=m[14]-14*m[10];p[15]=m[15]-14*m[11];return p;}
  function modelMatrix(obj){const c=Math.cos(obj.angle),s=Math.sin(obj.angle),cx=Math.cos(obj.tilt),sx=Math.sin(obj.tilt),v=obj.scale;
    return new Float32Array([v*c,0,-v*s,0, v*s*sx,v*cx,v*c*sx,0, v*s*cx,-v*sx,v*c*cx,0,obj.x,obj.y,0,1]);
  }
  function draw(model,accent){
    const mm=modelMatrix(model);
    gl.uniformMatrix4fv(U.uModel,false,mm);gl.uniform3fv(U.uCenter,new Float32Array(model.mid));gl.uniform3fv(U.uAccent,new Float32Array(accent));gl.uniform1f(U.uOpacity,model.opacity);
    for(const m of model.primitives){
      if(m.role===1||m.role===2){gl.depthMask(false);}else{gl.depthMask(true);}
      gl.uniform4fv(U.uColor,new Float32Array(m.color));gl.uniform1i(U.uRole,m.role);gl.uniform1f(U.uMetal,m.metal);gl.uniform1f(U.uRough,m.rough);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,m.tex||white);gl.uniform1i(U.uTexture,0);gl.uniform1i(U.uUseTex,m.tex?1:0);
      gl.bindVertexArray(m.vao);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0);
    }
    gl.bindVertexArray(null);gl.depthMask(true);
  }
  let state='gallery',modal=false,modalKey='rose',drag=false,lastX=0,lastY=0,spin={rose:0,galet:0},tilt={rose:0,galet:0};
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function rectPoint(el,fx=.5,fy=.52){const r=el.getBoundingClientRect(),s=(modal?viewerMount:stage).getBoundingClientRect();return [(r.left-s.left+r.width*fx)/s.width,(r.top-s.top+r.height*fy)/s.height];}
  function render(time){
    if(!gl || !models.rose || !models.galet) return;
    const pr=clamp(devicePixelRatio||1,1,window.innerWidth<700?1.4:1.8);
    const w=Math.max(1,Math.floor(canvas.clientWidth*pr)),h=Math.max(1,Math.floor(canvas.clientHeight*pr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);gl.uniformMatrix4fv(U.uVP,false,viewProjection(w/h));
    const worldH=2*14*Math.tan(33*Math.PI/360),worldW=worldH*w/h;
    const mobile=innerWidth<660;
    for(const k of ['rose','galet']){
      const m=models[k];let xy,px,visible,angle=0,base;
      if(modal){xy=[.5,.5];visible=k===modalKey?1:0;base=mobile?6.4:6.4;angle=spin[k];}
      else if(state==='gallery'){
        xy=rectPoint(document.querySelector('.gallery-bay.'+k));visible=1;base=mobile?2.88:3.75;angle=spin[k]*.25+(k==='galet'?.12:-.13);
      }else{
        xy=rectPoint(document.querySelector('.detail-frame'),.50,.50);
        visible=k===state?1:0;base=mobile?4.5:5.75;angle=spin[k]*.3+(k==='galet'?.065:-.075);
      }
      px=(xy[0]-.5)*worldW;const py=(.5-xy[1])*worldH;
      const scale=base/m.height;
      const f=reduce?.28:.075;
      if(!m.scale){m.x=px;m.y=py;m.scale=scale;m.opacity=visible;m.angle=angle;}
      else{m.x+=(px-m.x)*f;m.y+=(py-m.y)*f;m.scale+=(scale-m.scale)*f;m.opacity+=(visible-m.opacity)*f;m.angle+=(angle-m.angle)*f;m.tilt+=(tilt[k]-m.tilt)*f;}
      if(!reduce && !modal && visible) m.angle+=Math.sin(time*.0002+(k==='rose'?0:1))*.00015;
    }
    // Draw only visible objects. Depth clears between bottles so translucent glass
    // on the departing model never falsely occludes the arriving model.
    for(const k of ['rose','galet']){const m=models[k];if(m.opacity>.015){gl.clear(gl.DEPTH_BUFFER_BIT);draw(m,k==='rose'?[1,.63,.77]:[.48,1,.75]);}}
    requestAnimationFrame(render);
  }
  function setState(newState){state=newState||stage.dataset.state||'gallery';}
  window.addEventListener('perfume-scene-change',e=>setState(e.detail.state));
  function open(which){modal=true;modalKey=which==='galet'?'galet':'rose';viewerMount.appendChild(canvas);canvas.classList.add('inspecting');return Promise.resolve(true);}
  function stop(){modal=false;canvas.classList.remove('inspecting');stage.appendChild(canvas);return true;}
  canvas.addEventListener('pointerdown',e=>{if(!modal)return;drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag||!modal)return;spin[modalKey]+=((e.clientX-lastX)*.009);tilt[modalKey]=clamp(tilt[modalKey]+(e.clientY-lastY)*.003,-.35,.35);lastX=e.clientX;lastY=e.clientY;});
  canvas.addEventListener('pointerup',()=>drag=false);canvas.addEventListener('pointercancel',()=>drag=false);
  window.Perfume3D={open,stop};
  try{
    const loaded=await Promise.all([loadModel('rose'),loadModel('galet')]);
    models.rose=loaded[0];models.galet=loaded[1];setState(stage.dataset.state);document.documentElement.classList.add('glb-live');
    document.querySelectorAll('.glb-indicator').forEach(el=>el.textContent='REAL-TIME GLB · WEBGL');
    requestAnimationFrame(render);
  }catch(e){console.warn('3D model loading failed; restoring image fallback',e);canvas.remove();document.querySelectorAll('.glb-indicator').forEach(el=>el.textContent='IMAGE PREVIEW · 3D UNAVAILABLE');}
})();
