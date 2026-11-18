// Planta SINÚ 9 en 3D · escena del simulador (copia de 9 - MODELO 3D SINU 9/fuente/escena.js del 26-oct-2026,
// sin el recorrido ni el operador; la interfaz la pone el simulador y maneja la escena con window.__escena).
// Cada equipo se arma con piezas a escala y se fusiona en una sola malla por material.
// 
(function(){
"use strict";
const $=id=>document.getElementById(id);
const V3=THREE.Vector3, UP=new V3(0,1,0), PI=Math.PI;
const narrow=()=>matchMedia("(max-width:820px)").matches;
const mobile=narrow()||/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const SEG=mobile?20:32, SEGS=mobile?8:12;

// =====================================================================
// Render, cielo y luz
// =====================================================================
const canvas=$("c");
const renderer=new THREE.WebGLRenderer({canvas,antialias:!mobile,powerPreference:"high-performance"});
let pixelRatio=Math.min(devicePixelRatio||1,mobile?1.6:2);
renderer.setPixelRatio(pixelRatio);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.95;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=mobile?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate=false;

const scene=new THREE.Scene();
const CENTER=new V3(37,0,0);
scene.fog=new THREE.Fog(new THREE.Color("#dbe3e8"),150,420);
const skyU={top:{value:new V3(.47,.64,.82)},hor:{value:new V3(.86,.89,.91)},bot:{value:new V3(.60,.58,.52)}};
const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:skyU,
  vertexShader:"varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
  fragmentShader:"uniform vec3 top,hor,bot;varying vec3 vD;void main(){float h=vD.y;vec3 c=h>0.?mix(hor,top,pow(min(h*1.5,1.),.75)):mix(hor,bot,pow(min(-h*5.,1.),.5));gl_FragColor=vec4(c,1.);}"});
const sky=new THREE.Mesh(new THREE.SphereGeometry(800,32,16),skyMat); sky.position.copy(CENTER); sky.renderOrder=-1; scene.add(sky);
{ // reflejos suaves del cielo en el metal
  const pm=new THREE.PMREMGenerator(renderer), env=new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(10,32,16),skyMat));
  scene.environment=pm.fromScene(env,.03).texture; pm.dispose();
}
scene.add(new THREE.HemisphereLight("#eaf2fa","#80735c",.45));
const sun=new THREE.DirectionalLight("#fff0da",3.4);
sun.position.set(CENTER.x-40,64,CENTER.z+46); sun.target.position.copy(CENTER);
sun.castShadow=true; sun.shadow.mapSize.set(mobile?2048:4096,mobile?2048:4096);
Object.assign(sun.shadow.camera,{left:-66,right:66,top:52,bottom:-52,near:5,far:220});
sun.shadow.bias=-.0009; sun.shadow.normalBias=.06;
scene.add(sun,sun.target);

// =====================================================================
// Texturas hechas en un canvas (nada se descarga)
// =====================================================================
function canvasTex(w,h,draw,rep){
  const c=document.createElement("canvas"); c.width=w; c.height=h; const x=c.getContext("2d"); draw(x,w,h);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy()); if(rep) t.repeat.set(rep[0],rep[1]); return t;
}
let seed=7; const rnd=()=>{seed=(seed*16807)%2147483647; return (seed-1)/2147483646};
const gravel=(base,spread)=>canvasTex(256,256,(x,w,h)=>{x.fillStyle=base;x.fillRect(0,0,w,h);
  for(let i=0;i<5200;i++){const v=(rnd()-.5)*spread; x.fillStyle=`rgba(${v>0?255:0},${v>0?250:0},${v>0?240:0},${Math.abs(v)})`;
    const s=rnd()*2.4+.6; x.fillRect(rnd()*w,rnd()*h,s,s)}});
const TX={
  ground:gravel("#a29c8b",.22), pad:gravel("#b9b4a6",.2),
  grate:canvasTex(64,64,(x,w,h)=>{x.clearRect(0,0,w,h);x.fillStyle="#4b5157";for(let i=0;i<w;i+=8)x.fillRect(i,0,2,h);for(let j=0;j<h;j+=16)x.fillRect(0,j,w,2)}),
  louver:canvasTex(16,64,(x,w,h)=>{for(let j=0;j<h;j+=8){const g=x.createLinearGradient(0,j,0,j+8);g.addColorStop(0,"#262b30");g.addColorStop(.6,"#59616a");g.addColorStop(1,"#1d2125");x.fillStyle=g;x.fillRect(0,j,w,8)}},[1,3]),
  core:canvasTex(64,8,(x,w,h)=>{x.fillStyle="#3a4148";x.fillRect(0,0,w,h);x.fillStyle="#6c757d";for(let i=0;i<w;i+=3)x.fillRect(i,0,1,h)},[6,40]),
  ribs:canvasTex(64,4,(x,w,h)=>{const g=x.createLinearGradient(0,0,w,0);[0,.25,.5,.75,1].forEach((s,i)=>g.addColorStop(s,i%2?"#cfd4d8":"#f2f4f5"));x.fillStyle=g;x.fillRect(0,0,w,h)},[14,1]),
  fence:canvasTex(32,32,(x,w,h)=>{x.clearRect(0,0,w,h);x.strokeStyle="#9aa3a9";x.lineWidth=1.6;x.beginPath();x.moveTo(0,0);x.lineTo(w,h);x.moveTo(w,0);x.lineTo(0,h);x.stroke()}),
  sock:canvasTex(64,8,(x,w,h)=>{for(let i=0;i<5;i++){x.fillStyle=i%2?"#f4f4f4":"#ff6a13";x.fillRect(i*w/5,0,w/5,h)}}),
};
TX.ground.repeat.set(160,160); TX.pad.repeat.set(40,24);

// =====================================================================
// Materiales
// =====================================================================
const std=(c,r=.55,m=.2,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:r,metalness:m,envMapIntensity:.22},o));
const M={
  vessel:std("#d7dbde",.48,.15), white:std("#eceef0",.46,.1), steel:std("#58616a",.6,.45), dark:std("#2c3136",.65,.35),
  black:std("#1b1e22",.5,.5), galv:std("#a8b0b6",.38,.8), yellow:std("#e2a91c",.5,.1), cat:std("#efb100",.4,.15),
  blue:std("#2b5ba8",.42,.25), green:std("#2f8a4d",.48,.15), red:std("#b3302a",.48,.15), orange:std("#d8772a",.5,.12),
  concrete:std("#c2bdb2",.95,0), concrete2:std("#aaa59a",.95,0), rust:std("#4f4339",.8,.35), insul:std("#c9cdd1",.3,.85),
  ariel:std("#4a5968",.48,.35), panel:std("#c4c9cd",.55,.2), teal:std("#2f5f50",.5,.2), container:std("#e3e6e8",.6,.15),
  cqsn:std("#c9752b",.65,.15), bodega:std("#4b6a86",.6,.15), glass:std("#7fd3e6",.08,.2), win:std("#36586f",.12,.7),
  skin:std("#b98260",.7,0), vest:std("#ff7a12",.6,0), pants:std("#243452",.85,0), hat:std("#f6f6f2",.38,.05),
  refl:std("#e4e8eb",.28,.55,{emissive:"#585d62"}),
  rubber:std("#151617",.9,0), tree:std("#3f6b33",.9,0), tree2:std("#56803f",.9,0), trunk:std("#5b4636",.95,0),
  grate:std("#6b737a",.6,.6,{map:TX.grate,alphaTest:.5,side:THREE.DoubleSide}),
  louver:std("#ffffff",.6,.3,{map:TX.louver}), core:std("#ffffff",.6,.4,{map:TX.core}),
  ribs:std("#ffffff",.55,.15,{map:TX.ribs}),
  fence:std("#b5bcc1",.5,.7,{map:TX.fence,alphaTest:.45,side:THREE.DoubleSide}),
  shroud:std("#5f6870",.55,.4,{side:THREE.DoubleSide}), sock:std("#ffffff",.8,0,{map:TX.sock,side:THREE.DoubleSide}),
};
M.grate.userData.noShadow=M.fence.userData.noShadow=true;

// =====================================================================
// Geometrías base y piezas
// =====================================================================
const GEO={};
const gCyl=(s,open)=>GEO["c"+s+(open?"o":"")]||(GEO["c"+s+(open?"o":"")]=new THREE.CylinderGeometry(1,1,1,s,1,!!open));
const gCone=(s,k)=>GEO["k"+s+k]||(GEO["k"+s+k]=new THREE.CylinderGeometry(k,1,1,s,1,true));
const gBox=()=>GEO.b||(GEO.b=new THREE.BoxGeometry(1,1,1));
const gHead=s=>GEO["h"+s]||(GEO["h"+s]=new THREE.SphereGeometry(1,s,Math.max(5,s/3|0),0,PI*2,0,PI/2));
const gSph=s=>GEO["s"+s]||(GEO["s"+s]=new THREE.SphereGeometry(1,s,Math.max(5,s/2|0)));
const gTor=(R,t,arc,ts)=>{const k=`t${R.toFixed(3)}_${t.toFixed(3)}_${arc.toFixed(2)}_${ts}`;
  return GEO[k]||(GEO[k]=new THREE.TorusGeometry(R,t,6,ts||Math.max(10,Math.ceil(arc/(PI*2)*(mobile?24:40))),arc))};
function gProfile(kind,h,w){const k=kind+h+"_"+w; if(GEO[k]) return GEO[k];
  const s=new THREE.Shape(), tf=Math.max(.012,h*.08), tw=Math.max(.008,w*.06);
  if(kind==="I"){s.moveTo(-w/2,-h/2);s.lineTo(w/2,-h/2);s.lineTo(w/2,-h/2+tf);s.lineTo(tw/2,-h/2+tf);s.lineTo(tw/2,h/2-tf);s.lineTo(w/2,h/2-tf);
    s.lineTo(w/2,h/2);s.lineTo(-w/2,h/2);s.lineTo(-w/2,h/2-tf);s.lineTo(-tw/2,h/2-tf);s.lineTo(-tw/2,-h/2+tf);s.lineTo(-w/2,-h/2+tf);s.closePath()}
  else {s.moveTo(-w/2,-h/2);s.lineTo(w/2,-h/2);s.lineTo(w/2,-h/2+tf);s.lineTo(-w/2+tw,-h/2+tf);s.lineTo(-w/2+tw,h/2-tf);s.lineTo(w/2,h/2-tf);
    s.lineTo(w/2,h/2);s.lineTo(-w/2,h/2);s.closePath()}
  const g=new THREE.ExtrudeGeometry(s,{depth:1,bevelEnabled:false}); g.translate(0,0,-.5); return GEO[k]=g}

const AX={x:[0,0,-PI/2],y:[0,0,0],z:[PI/2,0,0]};
const HD={"+y":[0,0,0],"-y":[PI,0,0],"+x":[0,0,-PI/2],"-x":[0,0,PI/2],"+z":[PI/2,0,0],"-z":[-PI/2,0,0]};
const TAX={z:[0,0,0],y:[PI/2,0,0],x:[0,PI/2,0]};
const DIR={"+x":[1,0,0],"-x":[-1,0,0],"+y":[0,1,0],"-y":[0,-1,0],"+z":[0,0,1],"-z":[0,0,-1]};
function mesh(G,geo,mat,x,y,z,rot,sc){const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); if(rot) m.rotation.set(rot[0],rot[1],rot[2]); if(sc) m.scale.set(sc[0],sc[1],sc[2]); G.add(m); return m}
const cyl=(G,mat,r,len,x,y,z,axis="y",seg=SEG,open)=>mesh(G,gCyl(seg,open),mat,x,y,z,AX[axis],[r,len,r]);
const box=(G,mat,sx,sy,sz,x,y,z,ry=0,rx=0,rz=0)=>mesh(G,gBox(),mat,x,y,z,[rx,ry,rz],[sx,sy,sz]);
const head=(G,mat,r,x,y,z,dir,k=.5,seg=SEG)=>mesh(G,gHead(seg),mat,x,y,z,HD[dir],[r,r*k,r]);
const sph=(G,mat,r,x,y,z,seg=SEGS)=>mesh(G,gSph(seg),mat,x,y,z,null,[r,r,r]);
const torus=(G,mat,R,t,x,y,z,axis="y",arc=PI*2,rotAdd=0)=>{const m=mesh(G,gTor(R,t,arc),mat,x,y,z,TAX[axis]); if(rotAdd) m.rotateZ(rotAdd); return m};
function between(G,mat,a,b,r,seg=8){const d=new V3(b[0]-a[0],b[1]-a[1],b[2]-a[2]), L=d.length();
  const m=mesh(G,gCyl(seg),mat,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,null,[r,L,r]); m.quaternion.setFromUnitVectors(UP,d.normalize()); return m}
function beam(G,a,b,h=.2,w=.2,mat=M.steel,kind="I",roll=0){const d=new V3(b[0]-a[0],b[1]-a[1],b[2]-a[2]), L=d.length();
  const m=mesh(G,gProfile(kind,h,w),mat,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,null,[1,1,L]);
  m.quaternion.setFromUnitVectors(new V3(0,0,1),d.normalize()); if(roll) m.rotateZ(roll); return m}
const pad=(G,x,z,sx,sz,h=.15,mat=M.concrete)=>box(G,mat,sx,h,sz,x,h/2,z);

// Recipientes
function vesselH(G,mat,r,L,x,y,z,axis="x"){cyl(G,mat,r,L,x,y,z,axis);
  const p=s=>axis==="x"?[x+s,y,z]:[x,y,z+s];
  head(G,mat,r,...p(L/2),"+"+axis); head(G,mat,r,...p(-L/2),"-"+axis);
  torus(G,M.panel,r+.002,.006,...p(L/2),axis); torus(G,M.panel,r+.002,.006,...p(-L/2),axis)}
function vesselV(G,mat,r,L,x,y0,z,seams=[]){cyl(G,mat,r,L,x,y0+L/2,z);head(G,mat,r,x,y0+L,z,"+y");head(G,mat,r,x,y0,z,"-y");
  [0,L,...seams].forEach(s=>torus(G,M.panel,r+.002,.006,x,y0+s,z,"y"))}
function flange(G,r,x,y,z,axis,th=.045,mat=M.dark,bolts=0){cyl(G,mat,r,th,x,y,z,axis,SEGS*2);
  if(bolts&&!mobile){const n=bolts; for(let i=0;i<n;i++){const a=i/n*PI*2, R=r*.86, c=Math.cos(a)*R, s=Math.sin(a)*R;
    const p=axis==="x"?[x,y+c,z+s]:axis==="y"?[x+c,y,z+s]:[x+c,y+s,z]; cyl(G,M.black,.012,th+.05,...p,axis,6)}}}
function noz(G,x,y,z,dir,len,r,mat=M.vessel,fl=true){const d=DIR[dir], ax=dir[1];
  cyl(G,mat,r,len,x+d[0]*len/2,y+d[1]*len/2,z+d[2]*len/2,ax,SEGS);
  if(fl) flange(G,r*1.75+.015,x+d[0]*(len-.02),y+d[1]*(len-.02),z+d[2]*(len-.02),ax,.04)}
function legs(G,r,top,n=4,lr=.05,x=0,z=0,a0=PI/4){for(let i=0;i<n;i++){const a=a0+i/n*PI*2, lx=x+Math.cos(a)*r*.82, lz=z+Math.sin(a)*r*.82;
  cyl(G,M.steel,lr,top-.15,lx,(top+.15)/2,lz,"y",SEGS); box(G,M.steel,.2,.02,.2,lx,.16,lz)}}
// Válvulas e instrumentos (s = radio de la tubería)
function gate(G,x,y,z,axis="x",s=.06,mat=M.blue){cyl(G,mat,s*1.35,s*3,x,y,z,axis,SEGS);
  const fl=axis==="x"?[[x-s*1.6,y,z],[x+s*1.6,y,z]]:axis==="z"?[[x,y,z-s*1.6],[x,y,z+s*1.6]]:[[x,y-s*1.6,z],[x,y+s*1.6,z]];
  fl.forEach(p=>flange(G,s*1.9,...p,axis,s*.5));
  cyl(G,mat,s*.8,s*2.4,x,y+s*1.9,z,"y",SEGS); cyl(G,M.galv,s*.14,s*1.6,x,y+s*3.6,z,"y",6);
  torus(G,mat,s*1.5,s*.16,x,y+s*4.2,z,"y")}
function ctrlValve(G,x,y,z,axis="x",s=.06){cyl(G,M.steel,s*1.45,s*3,x,y,z,axis,SEGS); sph(G,M.steel,s*1.55,x,y,z);
  const fl=axis==="x"?[[x-s*1.6,y,z],[x+s*1.6,y,z]]:[[x,y,z-s*1.6],[x,y,z+s*1.6]]; fl.forEach(p=>flange(G,s*1.9,...p,axis,s*.5));
  box(G,M.galv,s*.3,s*2.6,s*1.6,x,y+s*2.9,z); cyl(G,M.galv,s*.18,s*2.6,x,y+s*2.9,z,"y",6);
  cyl(G,M.green,s*2.7,s*.5,x,y+s*4.6,z,"y",SEGS); head(G,M.green,s*2.7,x,y+s*4.85,z,"+y",.32,SEGS); head(G,M.green,s*2.7,x,y+s*4.35,z,"-y",.25,SEGS)}
function psv(G,x,y,z,s=.04,out="+x"){flange(G,s*2,x,y,z,"y",s*.6); cyl(G,M.blue,s*1.3,s*2.4,x,y+s*1.4,z,"y",SEGS);
  noz(G,x,y+s*1.4,z,out,s*2.2,s*1.1,M.blue); cyl(G,M.blue,s*.9,s*3.6,x,y+s*4.3,z,"y",SEGS); cyl(G,M.blue,s*.5,s*.8,x,y+s*6.4,z,"y",8)}
function gauge(G,x,y,z,face="+z"){const d=DIR[face]; cyl(G,M.galv,.008,.08,x+d[0]*.04,y-.05,z+d[2]*.04,"y",6);
  cyl(G,M.white,.045,.025,x+d[0]*.05,y,z+d[2]*.05,face[1],12); torus(G,M.black,.046,.006,x+d[0]*.064,y,z+d[2]*.064,face[1])}
function levelGlass(G,x,z,y0,y1,nx,nz){const o=.16, gx=x+nx*o, gz=z+nz*o;
  [y0,y1].forEach(y=>{between(G,M.galv,[x,y,z],[gx,y,gz],.012,6); sph(G,M.blue,.022,x+nx*.08,y,z+nz*.08,6)});
  cyl(G,M.glass,.016,y1-y0,gx,(y0+y1)/2,gz,"y",8); box(G,M.galv,.03,y1-y0+.05,.03,gx+nz*.04,(y0+y1)/2,gz-nx*.04)}
function ladder(G,x,z,y0,y1,ry=0,cage=true){const L=new THREE.Group(); L.position.set(x,0,z); L.rotation.y=ry; G.add(L);
  [-.21,.21].forEach(px=>cyl(L,M.yellow,.018,y1-y0,px,(y0+y1)/2,0,"y",6));
  for(let y=y0+.3;y<y1-.05;y+=.3) cyl(L,M.galv,.011,.42,0,y,0,"x",5);
  if(cage&&y1-y0>3){for(let y=y0+2.3;y<=y1+.05;y+=.75) torus(L,M.yellow,.36,.012,0,y,.34,"y",PI*1.1,-PI*.05);
    [.12,.37,.63,.88].forEach(f=>cyl(L,M.yellow,.01,y1-y0-2.3,Math.cos(f*PI)*.36,(y0+2.3+y1)/2,.34+Math.sin(f*PI)*.36,"y",4))}
  return L}
function rail(G,pts,y,mat=M.yellow){for(let i=0;i<pts.length-1;i++){const a=pts[i], b=pts[i+1], L=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const n=Math.max(1,Math.round(L/1.6)); for(let k=0;k<=n;k++){if(k===0&&i>0) continue; const t=k/n; cyl(G,mat,.022,1.07,a[0]+(b[0]-a[0])*t,y+.535,a[1]+(b[1]-a[1])*t,"y",6)}
    between(G,mat,[a[0],y+1.07,a[1]],[b[0],y+1.07,b[1]],.022,6); between(G,mat,[a[0],y+.55,a[1]],[b[0],y+.55,b[1]],.016,6)}}
function grating(G,x,y,z,sx,sz,frame=true){box(G,M.grate,sx,.03,sz,x,y,z);
  if(frame){box(G,M.steel,sx,.1,.06,x,y-.03,z-sz/2);box(G,M.steel,sx,.1,.06,x,y-.03,z+sz/2);box(G,M.steel,.06,.1,sz,x-sx/2,y-.03,z);box(G,M.steel,.06,.1,sz,x+sx/2,y-.03,z)}}
// Ventilador: aro y rejilla quietos; las aspas giran (no se fusionan)
const spinners=[];
function fan(G,x,y,z,R,axis="y",speed=7){const O=new THREE.Group(); O.position.set(x,y,z); O.rotation.set(...AX[axis]); G.add(O);
  cyl(O,M.shroud,R*1.05,.32,0,0,0,"y",SEG,true); torus(O,M.dark,R*1.05,.025,0,.16,0,"y");
  [.35,.7,1].forEach(k=>torus(O,M.black,R*k,.007,0,.17,0,"y"));
  for(let i=0;i<8;i++){const a=i/8*PI*2; between(O,M.black,[0,.17,0],[Math.cos(a)*R,.17,Math.sin(a)*R],.006,4)}
  const B=new THREE.Group(); B.userData.spin=speed; O.add(B); B.userData.dyn=true; spinners.push(B);
  cyl(B,M.dark,R*.13,.14,0,0,0,"y",12);
  for(let i=0;i<5;i++){const a=i/5*PI*2; const bl=box(B,M.galv,R*.82,.012,R*.24,Math.cos(a)*R*.5,0,Math.sin(a)*R*.5,-a); bl.rotateX(.32)}
  return O}
function person(G,x,z,ry=0,vest=M.vest){const P=new THREE.Group(); P.position.set(x,0,z); P.rotation.y=ry; G.add(P);
  [-.1,.1].forEach(px=>{cyl(P,M.pants,.075,.82,px,.41,0,"y",8); box(P,M.rubber,.12,.07,.24,px,.035,.04)});
  cyl(P,vest,.19,.62,0,1.13,0,"y",10); torus(P,M.white,.192,.012,0,1.0,0,"y"); torus(P,M.white,.192,.012,0,1.22,0,"y");
  [-.25,.25].forEach(px=>{const a=cyl(P,vest,.055,.58,px,1.12,.02,"y",8); a.rotation.z=px>0?-.12:.12});
  sph(P,M.skin,.11,0,1.58,0,10); head(P,M.hat,.135,0,1.63,0,"+y",.85,12); cyl(P,M.hat,.17,.015,0,1.63,.01,"y",14);
  return P}
function extintor(G,x,z){cyl(G,M.red,.085,.5,x,.4,z,"y",10); head(G,M.red,.085,x,.65,z,"+y",.6,10); box(G,M.black,.06,.06,.08,x,.73,z+.03);
  box(G,M.galv,.05,1.1,.05,x,.55,z-.13); box(G,M.white,.3,.2,.01,x,1.25,z-.12)}

// =====================================================================
// Tubos con codos de verdad (para las líneas de proceso y la tubería de los patines)
// =====================================================================
function fillet(pts,r){const P=pts.map(p=>new V3(p[0],p[1],p[2])), out=[P[0]];
  for(let i=1;i<P.length-1;i++){const A=P[i-1],C=P[i],B=P[i+1], la=C.distanceTo(A), lb=B.distanceTo(C);
    if(la<1e-4||lb<1e-4){out.push(C);continue}
    const a=C.clone().sub(A).normalize(), b=B.clone().sub(C).normalize(), cs=THREE.MathUtils.clamp(a.dot(b),-1,1), th=Math.acos(cs);
    if(th<.02){out.push(C);continue}
    const R0=Math.max(r*3,.07); let t=Math.min(R0*Math.tan(th/2),.45*la,.45*lb); const R=t/Math.tan(th/2);
    const S=C.clone().addScaledVector(a,-t), n1=b.clone().addScaledVector(a,-cs).normalize(), O=S.clone().addScaledVector(n1,R);
    const K=Math.max(3,Math.ceil(th/(PI/2)*(mobile?5:8)));
    for(let k=0;k<=K;k++){const f=th*k/K; out.push(O.clone().addScaledVector(n1,-R*Math.cos(f)).addScaledVector(a,R*Math.sin(f)))}}
  out.push(P[P.length-1]); return out.filter((p,i)=>i===0||p.distanceToSquared(out[i-1])>1e-10)}
function tubeGeo(pts,r,rs,uLen){const n=pts.length, T=[], N=[], Bn=[];
  for(let i=0;i<n;i++){const t=new V3(); if(i>0) t.add(pts[i].clone().sub(pts[i-1]).normalize()); if(i<n-1) t.add(pts[i+1].clone().sub(pts[i]).normalize()); T.push(t.normalize())}
  N[0]=new V3().crossVectors(T[0],Math.abs(T[0].y)<.9?UP:new V3(1,0,0)).normalize(); Bn[0]=new V3().crossVectors(T[0],N[0]);
  for(let i=1;i<n;i++){const v=new V3().crossVectors(T[i-1],T[i]), Ni=N[i-1].clone();
    if(v.lengthSq()>1e-12){Ni.applyAxisAngle(v.normalize(),Math.acos(THREE.MathUtils.clamp(T[i-1].dot(T[i]),-1,1)))} N[i]=Ni; Bn[i]=new V3().crossVectors(T[i],Ni)}
  const pos=new Float32Array(n*(rs+1)*3), nor=new Float32Array(n*(rs+1)*3), uv=new Float32Array(n*(rs+1)*2), idx=[]; let s=0, k=0;
  for(let i=0;i<n;i++){if(i>0) s+=pts[i].distanceTo(pts[i-1]);
    for(let j=0;j<=rs;j++){const a=j/rs*PI*2, c=Math.cos(a), si=Math.sin(a);
      const nx=N[i].x*c+Bn[i].x*si, ny=N[i].y*c+Bn[i].y*si, nz=N[i].z*c+Bn[i].z*si;
      pos[k*3]=pts[i].x+nx*r; pos[k*3+1]=pts[i].y+ny*r; pos[k*3+2]=pts[i].z+nz*r; nor[k*3]=nx; nor[k*3+1]=ny; nor[k*3+2]=nz;
      uv[k*2]=s/uLen; uv[k*2+1]=j/rs; k++}}
  for(let i=0;i<n-1;i++) for(let j=0;j<rs;j++){const a=i*(rs+1)+j, b=a+rs+1; idx.push(a,a+1,b, b,a+1,b+1)}
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(pos,3)); g.setAttribute("normal",new THREE.BufferAttribute(nor,3));
  g.setAttribute("uv",new THREE.BufferAttribute(uv,2)); g.setIndex(idx); return g}
function run(G,mat,pts,r,ends=true){const f=fillet(pts,r); mesh(G,tubeGeo(f,r,mobile?8:12,1),mat,0,0,0);
  if(ends) [[f[0],f[1]],[f[f.length-1],f[f.length-2]]].forEach(([p,q])=>{const d=p.clone().sub(q).normalize();
    const m=mesh(G,gCyl(SEGS*2),M.dark,p.x-d.x*.025,p.y-d.y*.025,p.z-d.z*.025,null,[r*1.8+.012,.04,r*1.8+.012]); m.quaternion.setFromUnitVectors(UP,d)}); return f}

// =====================================================================
// Fusión: todas las piezas de un equipo quedan en una malla por material
// =====================================================================
function mergeGeos(list){let nv=0, ni=0; list.forEach(g=>{nv+=g.attributes.position.count; ni+=g.index?g.index.count:g.attributes.position.count});
  const pos=new Float32Array(nv*3), nor=new Float32Array(nv*3), uv=new Float32Array(nv*2), I=nv>65535?new Uint32Array(ni):new Uint16Array(ni);
  let vo=0, io=0;
  list.forEach(g=>{const n=g.attributes.position.count; pos.set(g.attributes.position.array,vo*3);
    if(!g.attributes.normal) g.computeVertexNormals(); nor.set(g.attributes.normal.array,vo*3);
    if(g.attributes.uv) uv.set(g.attributes.uv.array,vo*2);
    if(g.index){const a=g.index.array; for(let i=0;i<a.length;i++) I[io+i]=a[i]+vo; io+=a.length} else {for(let i=0;i<n;i++) I[io+i]=vo+i; io+=n}
    vo+=n});
  const out=new THREE.BufferGeometry(); out.setAttribute("position",new THREE.BufferAttribute(pos,3)); out.setAttribute("normal",new THREE.BufferAttribute(nor,3));
  out.setAttribute("uv",new THREE.BufferAttribute(uv,2)); out.setIndex(new THREE.BufferAttribute(I,1)); out.computeBoundingSphere(); out.computeBoundingBox(); return out}
function bake(G,userData,parent){G.updateMatrixWorld(true); const buckets=new Map(), dyn=[];
  (function walk(o){o.children.slice().forEach(c=>{if(c.userData.dyn){dyn.push(c);return} if(c.isMesh){const g=c.geometry.clone().applyMatrix4(c.matrixWorld);
      if(g.index===null&&!g.attributes.uv) g.setAttribute("uv",new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
      (buckets.get(c.material)||buckets.set(c.material,[]).get(c.material)).push(g)} walk(c)})})(G);
  const out=new THREE.Group(); out.userData=userData||{}; const meshes=[];
  buckets.forEach((list,mat)=>{const m=new THREE.Mesh(mergeGeos(list),mat); m.castShadow=!mat.userData.noShadow; m.receiveShadow=true;
    m.userData=out.userData; out.add(m); meshes.push(m); list.forEach(g=>g.dispose())});
  (parent||scene).add(out); dyn.forEach(d=>out.attach(d)); return {group:out,meshes}}

// =====================================================================
// Equipos
// =====================================================================
const P=PLANT, BUILD={};
const posts=[]; // [x, z, medio ancho]: columnas y postes que el operador no puede atravesar
const at=(G,e,dx=0,dz=0)=>{G.position.set(e.focus[0]+dx,0,e.focus[2]+dz)};

BUILD["V-101"]=(G,e)=>{at(G,e); const r=.457,L=3.048,y0=.85;
  pad(G,0,0,1.7,1.7); legs(G,r,y0+.1,4,.055); vesselV(G,M.white,r,L,0,y0,0,[1.2,2.4]);
  noz(G,-r,1.0,0,"-x",.32,.076); noz(G,0,y0+L+r*.48,0,"+y",.3,.076); noz(G,0,y0-r*.48,0,"-y",.12,.03,M.white,false);
  psv(G,.22,y0+L+.2,.12,.035,"+z"); levelGlass(G,0,r,y0+.25,y0+1.3,0,1); gauge(G,-.2,y0+2.7,r-.05,"+z"); gauge(G,.3,y0+1.6,-r+.1,"-z");
  ctrlValve(G,0,.42,.5,"z",.03); box(G,M.galv,.16,.1,.005,.0,y0+1.9,r+.004)};
function meter(G,len,r,runPipe,scanner=[.9,.55]){ // patín de medición Daniel + Scanner 2000 (eje x)
  if(runPipe) cyl(G,M.panel,r,len,0,0,0,"x",SEGS*2);
  [-len/2+.05,len/2-.05,-.32,.32].forEach(x=>flange(G,r*1.8+.02,x,0,0,"x",.05,M.dark,8));
  box(G,M.dark,.42,.36,.34,0,0,0); box(G,M.dark,.32,.26,.3,0,.31,0); [-.08,.08].forEach(x=>cyl(G,M.galv,.025,.46,x,.31,0,"z",8));
  box(G,M.dark,.12,.08,.12,0,.48,0); flange(G,r*1.8+.02,-len/2+.7,0,0,"x",.05); cyl(G,M.galv,.012,.18,.5,r+.06,0,"y",6);
  const [sx,sz]=scanner; cyl(G,M.galv,.03,1.35,sx,-.35+.0,sz,"y",8);
  box(G,M.white,.16,.24,.12,sx,.45,sz+.04); box(G,M.black,.11,.08,.005,sx,.5,sz+.1); box(G,M.galv,.3,.02,.24,sx,.62,sz+.05);
  between(G,M.galv,[0,.2,.12],[sx,.38,sz],.006,4)}
BUILD["FTIQ-101"]=(G,e)=>{G.position.set(8.5,1.0,-6); meter(G,4,.076,false,[1.1,.5]);
  [-1.4,1.4].forEach(x=>box(G,M.concrete,.3,.92,.5,x,-.54,0))};
BUILD["FT-SECO"]=(G,e)=>{G.position.set(24,1.0,-5); meter(G,3.6,.076,true,[1.0,.5]); [-1.2,1.2].forEach(x=>box(G,M.concrete,.3,.92,.5,x,-.54,0))};
BUILD["FT-VENTA"]=(G,e)=>{G.position.set(70,1.0,-9); meter(G,4,.076,true,[1.0,.55]); [-1.4,1.4].forEach(x=>box(G,M.concrete,.3,.92,.5,x,-.54,0))};
BUILD["FTIQ-103"]=(G,e)=>{G.position.set(69.2,2.0,22); meter(G,2.2,.076,false,[.6,.5]); box(G,M.steel,.12,1.92,.12,-.9,-1.04,0); box(G,M.steel,.12,1.92,.12,.9,-1.04,0)};

function tower(G,e){at(G,e); const r=.305,L=7.62,y0=.95, top=y0+L;
  box(G,M.concrete,1.7,.32,1.7,0,.16,0); cyl(G,M.dark,.4,.04,0,.34,0,"y",SEG); cyl(G,M.white,r,y0-.36,0,(y0+.36)/2,0,"y",SEG);
  for(let i=0;i<4;i++){const a=i*PI/2+PI/4; box(G,M.dark,.02,.18,.12,Math.cos(a)*.36,.44,Math.sin(a)*.36,-a)}
  box(G,M.dark,.24,.3,.06,0,.6,-r+.01);
  vesselV(G,M.white,r,L,0,y0,0,[1.5,2.44,4.88]);
  noz(G,-r,1.8,0,"-x",.18,.051); noz(G,0,top+r*.48,0,"+y",.3,.076); noz(G,r,8.2,0,"+x",.14,.03); noz(G,r,2.6,0,"+x",.14,.03);
  noz(G,0,y0-r*.48,0,"-y",.1,.02,M.white,false);
  levelGlass(G,0,-r,1.15,2.1,0,-1); levelGlass(G,0,-r,2.8,3.7,0,-1);
  ctrlValve(G,.42,1.1,-.42,"x",.025); ctrlValve(G,.42,2.85,-.42,"x",.025);
  psv(G,.16,top+.24,.12,.035,"+x"); gauge(G,-.22,2.2,-r+.08,"-z"); gauge(G,-.22,7.9,-r+.08,"-z"); gauge(G,.0,5.0,-r,"-z");
  // escalera con guarda y plataforma de arriba
  const yp=top-.32; ladder(G,0,r+.2,.32,yp+1.07,0,true);
  const pl=new THREE.Group(); pl.position.y=yp; G.add(pl);
  const ring=new THREE.Mesh(new THREE.RingGeometry(r+.04,1.05,SEG,1,0,PI*1.15),M.grate); ring.rotation.x=PI/2; ring.rotation.z=-PI*.075; pl.add(ring);
  torus(pl,M.yellow,1.05,.022,0,1.07,0,"y",PI*1.15,-PI*.075); torus(pl,M.yellow,1.05,.016,0,.55,0,"y",PI*1.15,-PI*.075);
  for(let i=0;i<=6;i++){const a=-PI*.075+i/6*PI*1.15; cyl(pl,M.yellow,.022,1.07,Math.cos(a)*1.05,.535,Math.sin(a)*1.05,"y",6)}
  for(let i=0;i<3;i++){const a=PI*(.15+i*.35); between(pl,M.steel,[Math.cos(a)*r,-.5,Math.sin(a)*r],[Math.cos(a)*1.0,-.02,Math.sin(a)*1.0],.03,6);
    between(pl,M.steel,[Math.cos(a)*r,-.03,Math.sin(a)*r],[Math.cos(a)*1.0,-.03,Math.sin(a)*1.0],.03,6)}}
BUILD["TC-201"]=tower; BUILD["TC-202"]=tower;

BUILD["GRU-210"]=(G,e)=>{at(G,e); const zr=-.35, yc=1.25, R=.45;
  box(G,M.concrete,7.1,.15,2.9,0,.075,0);
  beam(G,[-3.3,.3,-1.12],[3.3,.3,-1.12],.3,.1,M.steel,"C",PI); beam(G,[-3.3,.3,1.12],[3.3,.3,1.12],.3,.1,M.steel,"C");
  for(let x=-3.2;x<=3.25;x+=1.07) beam(G,[x,.28,-1.1],[x,.28,1.1],.2,.1);
  [-3.38,3.38].forEach(x=>cyl(G,M.steel,.11,2.42,x,.2,0,"z",16)); box(G,M.dark,4.9,.01,2.2,-.85,.4,0);
  grating(G,2.75,.4,0,1.1,2.24);
  // rehervidor con la brida grande del tubo de fuego
  cyl(G,M.white,R,3.3,-1.25,yc,zr,"x"); head(G,M.white,R,.4,yc,zr,"+x"); torus(G,M.panel,R+.002,.006,.4,yc,zr,"x");
  flange(G,.62,-2.95,yc,zr,"x",.1,M.dark,28); cyl(G,M.white,.5,.07,-3.03,yc,zr,"x");
  [-2.3,-.1].forEach(x=>{box(G,M.steel,.22,yc-.42,.75,x,(yc-R+.4)/2+.15,zr)});
  [-1.9,-1.2,-.5].forEach((x,i)=>{noz(G,x,yc,zr+R,"+z",.1,.025,M.white,false); gauge(G,x,yc,zr+R+.1,"+z")});
  // quemador
  cyl(G,M.steel,.3,.55,-3.35,yc-.12,zr,"x"); cyl(G,M.dark,.34,.05,-3.64,yc-.12,zr,"x"); box(G,M.panel,.3,.25,.22,-3.35,yc+.3,zr);
  run(G,M.panel,[[-3.8,1.7,.4],[-3.8,1.7,0],[-3.5,1.7,0],[-3.5,yc+.2,0],[-3.5,yc+.05,zr+.2]],.02,false); ctrlValve(G,-3.8,1.7,.2,"z",.02);
  // chimenea y columna de destilación
  cyl(G,M.black,.17,3.33-yc-R+.05,-2.6,(3.33+yc+R-.05)/2,zr,"y",SEG); flange(G,.23,-2.6,yc+R+.02,zr,"y",.05); flange(G,.21,-2.6,2.4,zr,"y",.04);
  cyl(G,M.black,.2,.06,-2.6,3.33,zr,"y",SEG); for(let i=0;i<4;i++){const a=i*PI/2; between(G,M.black,[-2.6+Math.cos(a)*.17,3.3,zr+Math.sin(a)*.17],[-2.6+Math.cos(a)*.17,3.5,zr+Math.sin(a)*.17],.012,4)}
  cone(G,M.black,.3,.08,.18,-2.6,3.6,zr);
  cyl(G,M.white,.17,4.0-(yc+R)+.05,-1.85,(4.0+yc+R-.05)/2,zr,"y",SEG); head(G,M.white,.17,-1.85,4.0,zr,"+y");
  flange(G,.23,-1.85,yc+R+.02,zr,"y",.05); flange(G,.22,-1.85,3.0,zr,"y",.05,M.dark,12); flange(G,.22,-1.85,3.1,zr,"y",.05,M.dark,12);
  run(G,M.panel,[[-1.85,4.08,zr],[-1.85,4.35,zr],[-1.6,4.35,zr],[-1.6,4.1,zr]],.025);
  // separador de gas de bombas MBD-1300 sobre su estructura, con el serpentín
  [[-.55,-.9],[-.55,.2],[1.55,-.9],[1.55,.2]].forEach(([x,z])=>beam(G,[x,.3,z],[x,2.05,z],.15,.15));
  [-.9,.2].forEach(z=>beam(G,[-.6,2.0,z],[1.6,2.0,z],.15,.12)); [-.55,1.55].forEach(x=>beam(G,[x,2.0,-.95],[x,2.0,.25],.15,.12));
  vesselH(G,M.white,.305,1.22,.5,2.4,zr); [-.0,1.0].forEach(x=>box(G,M.steel,.15,.18,.5,x,2.15,zr));
  flange(G,.36,1.26,2.4,zr,"x",.06,M.dark,16); for(let i=0;i<4;i++) torus(G,M.galv,.28-i*.06,.012,1.3,2.4,zr,"x");
  levelGlass(G,.4,zr-.3,2.25,2.6,0,-1); psv(G,.8,2.7,zr,.03,"+z"); noz(G,.1,2.7,zr,"+y",.12,.025);
  // equipos pequeños del lado de las torres
  box(G,M.panel,.6,1.0,.3,-2.4,.95,.85); box(G,M.dark,.5,.8,.01,-2.4,.95,1.0);
  [-1.3,-.65].forEach(x=>{box(G,M.steel,.5,.06,.3,x,.43,.8); [-.13,.13].forEach(dx=>cyl(G,M.galv,.075,.28,x+dx*1.2,.6,.8,"x",12)); box(G,M.blue,.16,.2,.18,x,.6,.8); cyl(G,M.galv,.02,.3,x,.85,.8,"y",6)});
  box(G,M.steel,.12,.62,.5,-.1,.75,.78); box(G,M.steel,.12,.62,.5,.32,.75,.78); box(G,M.galv,.3,.54,.44,.11,.75,.78);
  [-.12,.3].forEach(y=>cyl(G,M.galv,.015,.55,.11,.75+y*.0+(y<0?-.24:.24),.78,"x",6));
  legs(G,.14,.75,3,.02,.85,.8); vesselV(G,M.white,.14,.5,.85,.75,.8); psv(G,.85,1.38,.8,.02,"+z");
  [1.45,1.85].forEach((x,i)=>{cyl(G,M.white,.13+i*.03,.75,x,.83,.8,"y",SEGS*2); flange(G,.17+i*.03,x,1.22,.8,"y",.05,M.dark,8)});
  run(G,M.panel,[[-3.1,.5,1.0],[2.1,.5,1.0]],.02,false); run(G,M.panel,[[-3.1,.62,-1.0],[2.1,.62,-1.0]],.02,false);
  run(G,M.panel,[[.11,1.06,.78],[.11,1.6,.78],[.11,1.6,zr],[.11,1.96,zr]],.02,false);
  run(G,M.panel,[[.85,1.4,.8],[.85,1.9,.8],[-.2,1.9,.8],[-.2,1.9,.2]],.015,false);
  extintor(G,3.0,1.25)};
function cone(G,mat,r0,r1,h,x,y,z){mesh(G,gCone(SEGS*2,r1/r0),mat,x,y,z,null,[r0,h,r0])}

BUILD["SK-300"]=(G,e)=>{at(G,e); const X=3.6, Z=1.15, top=2.15;
  box(G,M.concrete,7.7,.15,2.8,0,.075,0);
  [-Z,Z].forEach(z=>beam(G,[-X,.27,z],[X,.27,z],.24,.12)); for(let x=-X;x<=X+.01;x+=1.2) beam(G,[x,.27,-Z],[x,.27,Z],.2,.1);
  box(G,M.dark,1.6,.01,2.2,2.75,.4,0);
  [-X,-1.2,1.2,X].forEach(x=>[-Z,Z].forEach(z=>beam(G,[x,.39,z],[x,top,z],.18,.18)));
  [-Z,Z].forEach(z=>{beam(G,[-X,top-.075,z],[X,top-.075,z],.15,.12); beam(G,[-X,1.25,z],[X,1.25,z],.12,.1)});
  [-X,-1.2,1.2,X].forEach(x=>beam(G,[x,top-.075,-Z],[x,top-.075,Z],.15,.12));
  [-X,X].forEach(x=>{beam(G,[x,.4,-Z],[x,top-.15,Z],.1,.08); beam(G,[x,.4,Z],[x,top-.15,-Z],.1,.08)});
  [-.6,0].forEach((x,i)=>beam(G,[x*0+(-X+.6+i*1.2),.4,-Z],[(-X+.6+i*1.2)+.6,top-.15,-Z],.08,.08));
  extintor(G,-X-.2,Z+.25)};
function dpipe(G,e,noz4){G.position.set(e.focus[0],0,e.focus[2]); const y=2.45, r=.162, L=6.1;
  cyl(G,M.panel,r,L,0,y,0,"x",SEG); head(G,M.panel,r,L/2,y,0,"+x"); head(G,M.panel,r,-L/2,y,0,"-x");
  [-2.45,2.45].forEach(x=>[-.055,.055].forEach(d=>flange(G,.29,x+d,y,0,"x",.09,M.black,16)));
  [-1.2,1.2].forEach(x=>{box(G,M.steel,.14,.16,.36,x,2.2,0); box(G,M.steel,.24,.02,.42,x,2.29,0)});
  noz4.forEach(([x,up,rr])=>noz(G,x,y+(up?r:-r),0,up?"+y":"-y",.2,rr,M.panel));
  [-1.6,.4].forEach(x=>{noz(G,x,y+r,0,"+y",.06,.012,M.panel,false); gauge(G,x,y+r+.12,0,"+z")})}
BUILD["E-301"]=(G,e)=>dpipe(G,e,[[-2.75,1,.1],[-2.0,1,.076],[1.9,0,.076],[2.75,0,.1]]);
BUILD["E-302"]=(G,e)=>dpipe(G,e,[[2.2,1,.05],[2.75,1,.1],[-2.75,0,.1],[-2.1,0,.05]]);
BUILD["V-310"]=(G,e)=>{at(G,e); const r=.381, L=2.44, y=1.04;
  vesselH(G,M.white,r,L,0,y,0,"x"); [-.8,.8].forEach(x=>{box(G,M.steel,.18,y-.42,.6,x,(y-.42)/2+.4,0)});
  flange(G,.24,-L/2-r*.5-.02,y,0,"x",.06,M.dark,12);
  noz(G,-.9,y+r,0,"+y",.04,.076,M.white); noz(G,.9,y+r,0,"+y",.04,.076,M.white); noz(G,.4,y-r,0,"-y",.1,.03,M.white); noz(G,-.4,y-r,0,"-y",.1,.03,M.white);
  psv(G,-.15,y+r+.02,.12,.035,"-z"); psv(G,.25,y+r+.02,.12,.035,"-z"); run(G,M.orange,[[-.15,y+r+.27,.04],[-.15,y+r+.27,-.4],[-.15,1.95,-.4],[1.6,1.95,-.4]],.02,false);
  levelGlass(G,-.2,r,y-.25,y+.25,0,1); levelGlass(G,.55,r,y-.3,y+.05,0,1);
  [-.6,.95].forEach(x=>{cyl(G,M.galv,.05,.6,x,y-.05,r+.25,"y",10); box(G,M.green,.16,.16,.12,x,y+.33,r+.25); between(G,M.galv,[x,y+.1,r],[x,y+.1,r+.22],.015,6)});
  ctrlValve(G,.4,.55,-.1,"z",.025); ctrlValve(G,-.4,.55,.15,"z",.025); gauge(G,1.0,y+.3,r,"+z");
  run(G,M.red,[[-.4,y-r-.1,0],[-.4,.55,0],[-.4,.55,1.0]],.02,false)};
BUILD["TK-1000"]=(G,e)=>{at(G,e); box(G,M.white,.8,.95,.8,0,.85,0);
  [[-.4,-.4],[.4,-.4],[-.4,.4],[.4,.4]].forEach(([x,z])=>box(G,M.steel,.05,1.0,.05,x,.85,z));
  [.42,1.3].forEach(y=>{box(G,M.steel,.84,.05,.05,0,y,-.4);box(G,M.steel,.84,.05,.05,0,y,.4);box(G,M.steel,.05,.05,.84,-.4,y,0);box(G,M.steel,.05,.05,.84,.4,y,0)});
  cyl(G,M.white,.13,.06,.15,1.35,.1,"y",16); flange(G,.16,.15,1.38,.1,"y",.03,M.dark,8); levelGlass(G,.4,-.2,.55,1.15,1,0)};
BUILD["P-301/302"]=(G,e)=>{at(G,e); [-.48,.48].forEach(z=>{box(G,M.steel,.7,.06,.3,0,.43,z);
  const mt=cyl(G,M.red,.11,.36,.12,.6,z,"x",16); for(let i=0;i<5;i++) torus(G,M.red,.112,.008,.0+i*.06,.6,z,"x");
  cyl(G,M.dark,.1,.06,.33,.6,z,"x",16); box(G,M.yellow,.12,.12,.16,-.12,.6,z); cyl(G,M.steel,.12,.1,-.25,.6,z,"x",16);
  noz(G,-.25,.72,z,"+y",.14,.025,M.steel); noz(G,-.3,.6,z,"-x",.12,.03,M.steel)});
  run(G,M.steel,[[-.4,.6,-.48],[-.4,.5,-.48],[-.4,.5,.48],[-.4,.6,.48]],.025,false)};
BUILD["UE-101"]=(G,e)=>{at(G,e); const W=2.6,H=2.2,D=3.0;
  box(G,M.concrete,W+.4,.15,D+.4,0,.075,0); box(G,M.dark,W,.2,D,0,.25,0);
  box(G,M.panel,W,.75,D,0,.72,0); box(G,M.core,W-.06,H-.95,D+.01,0,.35+.75+(H-.95)/2,0); box(G,M.panel,W,.08,D,0,H+.33,0);
  [-W/2,W/2].forEach(x=>[-D/2,0,D/2].forEach(z=>box(G,M.panel,.06,H-.95,.06,x,.35+.75+(H-.95)/2,z)));
  box(G,M.panel,W,.06,D,0,1.1,0);
  [[-.62,-.72],[.62,-.72],[-.62,.72],[.62,.72]].forEach(([x,z])=>fan(G,x,H+.5,z,.55,"y",9));
  box(G,M.panel,.06,1.1,1.4,-W/2-.03,.95,.5); box(G,M.dark,.01,.9,.01,-W/2-.07,.95,.5); box(G,M.galv,.02,.06,.12,-W/2-.07,1.0,.2);
  noz(G,-W/2,.5,0,"-x",.18,.05,M.panel); noz(G,-W/2,1.3,-.9,"-x",.18,.05,M.panel)};

BUILD["PCV-400"]=(G,e)=>{G.position.set(0,0,0); pad(G,47.25,-3,3.2,1.6,.12);
  ctrlValve(G,47.25,1.0,-3,"x",.1); gate(G,46.5,1.0,-3,"x",.1); gate(G,48.0,1.0,-3,"x",.1);
  run(G,M.panel,[[46.25,1.0,-3],[46.25,1.0,-3.6],[48.25,1.0,-3.6],[48.25,1.0,-3]],.05,false); gate(G,47.25,1.0,-3.6,"x",.05,M.blue);
  [46.25,48.25].forEach(x=>{box(G,M.steel,.12,.85,.12,x,.5,-3.3); box(G,M.steel,.12,.08,.9,x,.88,-3.3)});
  psv(G,48.62,2.6,-3,.05,"+x"); gauge(G,46.0,1.35,-3.1,"+z"); gauge(G,48.5,1.35,-3.1,"+z")};
BUILD["FT-COMB + PCV"]=(G,e)=>{G.position.set(51.1,1.0,-6.5); const L=3.2;
  cyl(G,M.panel,.038,L,0,0,0,"x",12); [-1.3,1.3].forEach(x=>box(G,M.concrete,.25,.92,.4,x,-.54,0));
  // regulador tipo resorte (420 → 150 psig)
  cyl(G,M.steel,.07,.22,-1.1,0,0,"x",12); cyl(G,M.dark,.04,.18,-1.1,.15,0,"y",8); cyl(G,M.blue,.16,.08,-1.1,.27,0,"y",16);
  cyl(G,M.blue,.06,.3,-1.1,.46,0,"y",10); gate(G,-1.5,0,0,"x",.038); gate(G,-.6,0,0,"x",.038);
  meter(G,0,.038,false,[.9,.5]); psv(G,1.3,.04,0,.025,"+z"); gauge(G,-.85,.12,0,"+z")};
BUILD["V-601"]=(G,e)=>{at(G,e); const r=.305,L=4.267,y0=.65, top=y0+L;
  box(G,M.concrete,1.4,.2,1.4,0,.1,0); cyl(G,M.dark,.38,.03,0,.215,0,"y",SEG); cyl(G,M.white,r,y0-.23,0,(y0+.23)/2,0,"y",SEG);
  vesselV(G,M.white,r,L,0,y0,0,[1.4,2.8]);
  noz(G,-r,1.0,0,"-x",.25,.038); noz(G,0,top+r*.48,0,"+y",.32,.038); psv(G,.18,top+.22,.08,.03,"+x");
  levelGlass(G,0,r,y0+.2,y0+1.2,0,1); gauge(G,-.2,top-.4,r-.06,"+z"); ctrlValve(G,0,.42,-.5,"z",.025);
  ladder(G,-r-.2,0,.2,top+.4,-PI/2,true); grating(G,-.7,top-.45,0,.8,1.0); rail(G,[[-.3,-.5],[-1.1,-.5],[-1.1,.5],[-.3,.5]],top-.45)};
BUILD["V-801"]=(G,e)=>{at(G,e); const r=.3, y0=.45; pad(G,0,0,1.0,1.0,.12); legs(G,r,y0+.1,3,.04,0,0,PI/2);
  vesselV(G,M.white,r,1.8,0,y0,0); psv(G,.12,y0+1.8+.13,.0,.025,"+x"); gauge(G,0,y0+1.2,r,"+z"); noz(G,0,y0-.14,0,"-y",.15,.015,M.white,false)};
BUILD["V-105"]=(G,e)=>{at(G,e); const r=.35, y0=.4; pad(G,0,0,1.1,1.1,.12); legs(G,r,y0+.1,3,.04,0,0,PI/2);
  vesselV(G,M.white,r,2.0,0,y0,0); psv(G,.14,y0+2.0+.15,0,.025,"+x"); gauge(G,0,y0+1.3,r,"+z"); noz(G,-r,y0+.4,0,"-x",.15,.025)};

BUILD["C-401"]=(G,e)=>{G.position.set(60.5,0,-11); const D=.75;
  box(G,M.concrete,12,.3,4.3,0,.15,0);
  [-1.75,1.75].forEach(z=>beam(G,[-5.7,.53,z],[5.7,.53,z],.45,.2)); for(let x=-5.6;x<=5.7;x+=1.4) beam(G,[x,.53,-1.7],[x,.53,1.7],.4,.15);
  box(G,M.dark,11.4,.02,3.6,0,D-.01,0);
  // aeroenfriador con ventilador (lado oeste)
  const cx=-4.9;
  [[-5.65,-1.75],[-5.65,1.75],[-4.1,-1.75],[-4.1,1.75]].forEach(([x,z])=>beam(G,[x,D,z],[x,4.4,z],.2,.2));
  box(G,M.core,.35,3.2,3.3,-4.25,2.55,0); box(G,M.panel,.5,.25,3.5,-4.25,.95,0); box(G,M.panel,.5,.25,3.5,-4.25,4.15,0);
  [-1.72,1.72].forEach(z=>box(G,M.panel,.5,3.6,.12,-4.25,2.55,z)); box(G,M.panel,1.55,.06,3.5,-4.9,4.36,0);
  [-1.7,1.7].forEach(z=>box(G,M.panel,1.4,3.5,.04,-4.9,2.6,z));
  box(G,M.dark,.04,3.3,3.3,-5.55,2.55,0); fan(G,-5.62,2.55,0,1.42,"x",5);
  cyl(G,M.panel,.2,1.3,-4.6,4.62,0,"z",16); between(G,M.galv,[-5.4,2.55,0],[-3.75,1.6,0],.05,8); box(G,M.yellow,.5,.7,.4,-3.95,1.6,0);
  // motor Caterpillar G3516 (V16)
  const ex=-2.25, yc=1.5;
  box(G,M.dark,2.9,.35,1.0,ex,D+.25,0); box(G,M.cat,3.1,.72,1.25,ex,yc,0);
  [-1,1].forEach(s=>{const b=box(G,M.cat,3.0,.58,.62,ex,yc+.62,s*.42); b.rotation.x=-s*.55;
    for(let i=0;i<8;i++){const vc=box(G,M.dark,.26,.1,.38,ex-1.3+i*.37,yc+.95,s*.6); vc.rotation.x=-s*.55}
    cyl(G,M.insul,.11,2.9,ex,yc+.42,s*.98,"x",12); for(let i=0;i<8;i++) between(G,M.insul,[ex-1.3+i*.37,yc+.62,s*.78],[ex-1.3+i*.37,yc+.46,s*.95],.05,6)});
  cyl(G,M.cat,.13,2.8,ex,yc+.95,0,"x",12); box(G,M.cat,.5,.32,.8,ex-1.25,yc+1.15,0);
  [-1,1].forEach(s=>{torus(G,M.insul,.17,.09,ex-1.6,yc+1.3,s*.45,"z"); cyl(G,M.insul,.15,.24,ex-1.6,yc+1.3,s*.45,"z",14);
    cyl(G,M.panel,.21,.75,ex-.5,yc+1.42,s*.48,"x",16); head(G,M.panel,.21,ex-.12,yc+1.42,s*.48,"+x",.4,16); run(G,M.panel,[[ex-.88,yc+1.42,s*.48],[ex-1.4,yc+1.42,s*.48],[ex-1.45,yc+1.32,s*.45]],.09,false)});
  cyl(G,M.dark,.3,.1,ex-1.6,yc-.1,0,"x",20); box(G,M.cat,.25,.3,.2,ex+.6,yc-.1,-.78); cyl(G,M.dark,.08,.35,ex+.9,yc-.25,-.72,"x",10);
  cyl(G,M.cat,.72,.38,-.55,yc+.05,0,"x",SEG); cyl(G,M.orange,.42,.5,-.1,yc+.05,0,"x",SEG);
  // compresor Ariel JGE/4: dos etapas, cuatro cilindros opuestos
  const yk=1.55;
  box(G,M.ariel,2.0,1.25,1.25,1.25,D+.6,0); box(G,M.ariel,1.7,.12,1.0,1.25,D+1.29,0); cyl(G,M.dark,.07,.3,.6,D+1.45,.3,"y",10); cyl(G,M.panel,.08,.32,2.3,D+.7,-.45,"y",10);
  [.7,1.75].forEach(x=>[-1,1].forEach(s=>{const first=s<0, rc=first?.33:.23;
    box(G,M.ariel,.48,.48,.52,x,yk,s*.88); flange(G,.3,x,yk,s*1.15,"z",.06,M.dark);
    cyl(G,M.panel,rc,.58,x,yk,s*1.45,"z",SEG); flange(G,rc+.05,x,yk,s*1.76,"z",.07,M.dark,12);
    [-.18,.18].forEach(dx=>{cyl(G,M.dark,.07,.09,x+dx*rc*3,yk+rc+.03,s*1.45,"y",10); cyl(G,M.dark,.07,.09,x+dx*rc*3,yk-rc-.03,s*1.45,"y",10)})}));
  [-1,1].forEach(s=>{const first=s<0; vesselH(G,M.panel,first?.3:.22,1.75,1.22,first?2.45:2.25,s*1.45,"x");
    [.7,1.75].forEach(x=>{cyl(G,M.panel,.08,.28,x,yk+(first?.6:.44),s*1.45,"y",12); cyl(G,M.panel,.07,.28,x,yk-(first?.48:.38),s*1.45,"y",12)});
    vesselH(G,M.panel,.19,1.75,1.22,first?.98:1.03,s*1.45,"x")});
  // scrubbers de succión de 1ª y 2ª etapa
  [[1.1,.42,"1"],[-1.1,.32,"2"]].forEach(([z,r])=>{const y0=1.05, L=2.0; legs(G,r,y0+.08,3,.04,4.4,z,PI/6);
    vesselV(G,M.white,r,L,4.4,y0,z,[1.0]); levelGlass(G,4.4,z+(z>0?r:-r),y0+.15,y0+.8,0,z>0?1:-1);
    ctrlValve(G,4.75,.95,z,"x",.025); psv(G,4.5,y0+L+r*.4,z,.03,"+x"); noz(G,4.4,y0+L+r*.46,z,"+y",.1,.06)});
  noz(G,3.98,2.6,1.1,"-x",.05,.076,M.white); noz(G,4.08,2.4,-1.1,"-x",.05,.06,M.white);
  // tubería del paquete: scrubbers, botellas y aeroenfriador
  run(G,M.panel,[[4.4,3.35,1.1],[4.4,3.7,1.1],[3.2,3.7,1.1],[3.2,3.7,-1.45],[3.2,2.45,-1.45],[2.38,2.45,-1.45]],.07);
  run(G,M.panel,[[2.3,.98,-1.45],[2.9,.98,-1.45],[2.9,3.3,-1.45],[2.9,3.3,-1.66],[-3.95,3.3,-1.66]],.07);
  run(G,M.panel,[[-3.95,3.62,-1.3],[3.7,3.62,-1.3],[3.7,2.4,-1.3],[3.7,2.4,-1.1],[4.03,2.4,-1.1]],.06);
  run(G,M.panel,[[4.4,3.22,-1.1],[4.4,3.95,-1.1],[2.75,3.95,-1.1],[2.75,3.95,1.45],[2.75,2.25,1.45],[2.3,2.25,1.45]],.06);
  run(G,M.panel,[[2.3,1.03,1.45],[3.0,1.03,1.45],[3.0,3.3,1.45],[3.0,3.3,1.66],[-3.95,3.3,1.66]],.06);
  run(G,M.panel,[[-3.95,3.0,1.25],[5.2,3.0,1.25],[5.2,1.6,1.25],[5.2,1.6,-.6],[5.72,1.6,-.6]],.06);
  [-1.4,3.45].forEach(x=>{[-1.85,1.85].forEach(z=>beam(G,[x,D,z],[x,3.85,z],.15,.15)); beam(G,[x,3.2,-1.85],[x,3.2,1.85],.12,.1)});
  // escape: silenciador y chimenea
  [-3.2,-1.2].forEach(x=>{[-.65,.65].forEach(z=>beam(G,[x,2.6,z],[x,3.98,z],.1,.1)); beam(G,[x,3.95,-.7],[x,3.95,.7],.1,.1)});
  vesselH(G,M.rust,.42,2.6,-2.2,4.4,0,"x"); run(G,M.insul,[[ex-1.6,yc+1.4,0],[ex-1.6,yc+2.0,0],[-3.4,yc+2.0,0],[-3.4,3.98,0]],.13,false);
  cyl(G,M.rust,.2,1.2,-.95,5.3,0,"y",16); cyl(G,M.rust,.24,.05,-.95,5.9,0,"y",16);
  // tablero de control y gas combustible
  box(G,M.panel,.9,1.3,.35,-2.6,1.45,-1.6); box(G,M.dark,.7,.9,.01,-2.6,1.55,-1.78); box(G,M.galv,1.1,.04,.6,-2.6,2.18,-1.55);
  [-3.0,-2.2].forEach(x=>box(G,M.steel,.06,1.3,.06,x,1.1,-1.42));
  run(G,M.panel,[[-2.5,2.2,1.55],[-2.5,1.6,1.55],[-2.5,1.6,.9]],.025,false); ctrlValve(G,-2.5,1.9,1.55,"z",.02); gauge(G,-2.35,1.75,1.55,"+x");
  cyl(G,M.white,.25,.8,-.9,D+.42,1.45,"y",16);
  extintor(G,-5.9,2.1); extintor(G,5.9,-2.1)};

function container(G,L,H,W,mat,doors,opts={}){ // contenedor con costillas, puertas y base
  box(G,M.dark,L,.18,W,0,.09,0); box(G,mat,L,H-.25,W,0,.18+(H-.25)/2,0); box(G,mat,L+.04,.08,W+.04,0,H-.03,0);
  [-W/2,W/2].forEach(z=>box(G,M.ribs,L-.12,H-.42,.02,0,.18+(H-.25)/2,z+(z<0?-.012:.012)));
  [[-L/2,-W/2],[L/2,-W/2],[-L/2,W/2],[L/2,W/2]].forEach(([x,z])=>box(G,M.steel,.1,H,.1,x,H/2,z));
  doors.forEach(([x,z,w,face])=>{const n=face==="-z"?-1:1; box(G,M.dark,w,2.0,.02,x,1.18,z+n*(W/2+.012)); box(G,mat,w-.06,1.94,.02,x,1.18,z+n*(W/2+.02));
    box(G,M.galv,.03,.18,.04,x+w/2-.12,1.15,z+n*(W/2+.04))});
  (opts.ac||[]).forEach(([x,face])=>{const n=face==="-z"?-1:1; box(G,M.white,.8,.55,.3,x,1.9,n*(W/2+.17)); fanFace(G,x,1.9,n*(W/2+.33),.2,n)});
  (opts.win||[]).forEach(([x,face])=>{const n=face==="-z"?-1:1; box(G,M.win,1.0,.8,.02,x,1.55,n*(W/2+.02)); box(G,M.panel,1.08,.06,.05,x,1.13,n*(W/2+.03))});
  if(opts.stairs) opts.stairs.forEach(([x,face])=>{const n=face==="-z"?-1:1; for(let i=0;i<2;i++) box(G,M.galv,1.0,.04,.3,x,.11+i*.15,n*(W/2+.15+(1-i)*.28))})}
function fanFace(G,x,y,z,R,n,axis="z"){cyl(G,M.dark,R,.02,x,y,z,axis,16);
  for(let k=1;k<=3;k++) torus(G,M.galv,R*k/3,.006,x,y+(axis==="y"?.012:0),z+(axis==="z"?n*.012:0),axis)}
BUILD["G-101"]=(G,e)=>{G.position.set(20,0,10); const L=6,H=2.6,W=2.4;
  box(G,M.concrete,L+.6,.15,W+.6,0,.075,0); const C=new THREE.Group(); C.position.y=.15; G.add(C);
  container(C,L,H,W,M.container,[[-1.6,0,1.0,"-z"],[.4,0,1.0,"-z"],[-1.6,0,1.0,"+z"]]);
  box(C,M.louver,.02,1.8,W-.4,L/2+.012,1.3,0); [[-.6,"-z"],[1.6,"-z"],[.4,"+z"]].forEach(([x,f])=>box(C,M.louver,.9,.6,.02,x,2.05,(f==="-z"?-1:1)*(W/2+.014)));
  [-1.8,-.4].forEach(x=>box(C,M.steel,.1,.4,.9,x,H+.2,0)); vesselH(C,M.rust,.3,1.8,-1.1,H+.65,0,"x");
  cyl(C,M.rust,.15,1.3,-2.15,H+1.1,0,"y",14); cyl(C,M.rust,.19,.05,-2.15,H+1.78,0,"y",14); between(C,M.rust,[-1.95,H+.65,0],[-2.15,H+.65,0],.12,10);
  box(C,M.panel,.8,.4,.8,1.8,H+.2,.5); fanFace(C,1.8,H+.41,.5,.3,1,"y");
  run(G,M.panel,[[2,1.4,-1.25],[2,1.4,-1.6],[2.5,1.4,-1.6]],.025,false); ctrlValve(G,2.25,1.4,-1.6,"x",.02);
  extintor(G,-3.4,-1.4)};
BUILD["G-102"]=(G,e)=>{G.position.set(28,0,10); const L=4,W=1.6;
  box(G,M.concrete,L+.6,.15,W+.6,0,.075,0); box(G,M.dark,L,.4,W,0,.35,0);
  box(G,M.teal,L-.1,1.45,W-.05,0,1.28,0); box(G,M.teal,L-.18,.08,W-.13,0,2.04,0);
  [-1,1].forEach(s=>{[-.9,.4].forEach(x=>{box(G,M.dark,1.0,1.15,.02,x,1.25,s*(W/2-.01)); box(G,M.galv,.03,.14,.04,x+.38,1.25,s*(W/2+.01))});
    box(G,M.louver,.6,.5,.02,1.45,1.55,s*(W/2-.01))});
  box(G,M.louver,.02,1.1,1.2,L/2-.04,1.3,0); box(G,M.louver,.02,.9,1.2,-L/2+.04,1.25,0);
  [[-1.6,-.6],[1.6,-.6],[-1.6,.6],[1.6,.6]].forEach(([x,z])=>torus(G,M.galv,.05,.012,x,2.12,z,"x"));
  cyl(G,M.rust,.07,.6,-1.4,2.3,.2,"y",10); box(G,M.win,.3,.22,.01,-1.2,1.55,-W/2-.01); extintor(G,2.4,-1.0)};
BUILD["CCM-101"]=(G,e)=>{G.position.set(12,0,13); const L=12,H=2.6,W=2.4;
  box(G,M.concrete,L+.6,.15,W+.6,0,.075,0); const C=new THREE.Group(); C.position.y=.15; G.add(C);
  container(C,L,H,W,M.container,[[-3.5,0,1.0,"-z"],[3.5,0,1.0,"-z"]],{ac:[[-1,"-z"],[1.2,"-z"]],stairs:[[-3.5,"-z"],[3.5,"-z"]]});
  box(C,M.yellow,.6,.04,.3,-L/2+.6,H+.0,-.7); for(let x=-5;x<=5;x+=2.5) box(C,M.panel,.3,.25,.3,x,H+.12,.6);
  [5.5].forEach(x=>{box(G,M.galv,.5,.08,2.8,x+.2,3.0,-2.6); box(G,M.steel,.08,3.0,.08,x+.2,1.5,-3.9)});
  extintor(G,-L/2-.4,-1.2)};
BUILD["CQSN-101"]=(G,e)=>{at(G,e); box(G,M.concrete,6.8,.15,3.2,0,.075,0); box(G,M.concrete2,6.8,.3,.12,0,.3,1.55); box(G,M.concrete2,6.8,.3,.12,0,.3,-1.55);
  const C=new THREE.Group(); C.position.y=.15; G.add(C); container(C,6.06,2.59,2.44,M.cqsn,[]);
  box(C,M.dark,.02,2.2,2.3,3.04,1.2,0); [-.55,.55].forEach(z=>{box(C,M.cqsn,.03,2.15,1.1,3.05,1.2,z); [-.35,.35].forEach(dz=>box(C,M.galv,.04,2.0,.03,3.08,1.2,z+dz))});
  for(let i=0;i<3;i++){cyl(G,M.blue,.29,.88,3.9,.6,-.6+i*.62,"y",16); torus(G,M.blue,.292,.015,3.9,.45,-.6+i*.62,"y"); torus(G,M.blue,.292,.015,3.9,.8,-.6+i*.62,"y")}
  box(G,M.orange,1.2,.12,1.9,3.9,.16,0)};
BUILD["OF-101"]=(G,e)=>{G.position.set(4.5,0,19.5); box(G,M.concrete,6.6,.15,3.0,0,.075,0); const C=new THREE.Group(); C.position.y=.15; G.add(C);
  container(C,6,2.6,2.4,M.white,[[1.8,0,.9,"-z"]],{ac:[[2.6,"+z"]],win:[[-1.8,"-z"],[-.2,"-z"],[-1.2,"+z"]],stairs:[[1.8,"-z"]]});
  box(C,M.panel,6.4,.06,3.0,0,2.68,0)};
BUILD["SDT-1"]=(G,e)=>{G.position.set(12.5,0,19.5); box(G,M.concrete,6.6,.15,3.0,0,.075,0); const C=new THREE.Group(); C.position.y=.15; G.add(C);
  container(C,6,2.6,2.4,M.bodega,[[-1.5,0,1.6,"-z"]],{stairs:[[-1.5,"-z"]]})};
BUILD["CONDUMAX"]=(G,e)=>{at(G,e); const W=1.5,H=2.3,D=1.2;
  box(G,M.concrete,2.6,.15,2.0,0,.075,0); box(G,M.white,W,H,D,0,.15+H/2,0);
  const roof=box(G,M.panel,W+.5,.06,D+.6,0,H+.28,0,0,.08); roof.rotation.x=.08;
  box(G,M.dark,.8,1.9,.02,0,1.12,D/2+.01); box(G,M.galv,.03,.16,.04,.3,1.1,D/2+.03); box(G,M.louver,.4,.3,.02,0,2.05,D/2+.012);
  box(G,M.panel,.7,.8,.06,.1,1.1,-D/2-.03); for(let i=0;i<4;i++) cyl(G,M.galv,.006,.6,-.15+i*.12,1.1,-D/2-.07,"y",4);
  box(G,M.dark,.18,.14,.08,.25,1.35,-D/2-.08); cyl(G,M.galv,.08,.3,0,H+.45,0,"y",10);
  [-.9,-1.2].forEach(x=>{cyl(G,M.white,.11,1.25,x,.78,.3,"y",12); head(G,M.white,.11,x,1.4,.3,"+y",.6,12); cyl(G,M.galv,.03,.12,x,1.5,.3,"y",6)});
  box(G,M.galv,.6,.05,.05,-1.05,1.1,.18)};
function airComp(G,e,dx){at(G,e,dx); const L=1.6,H=1.25,W=1.0;
  box(G,M.concrete,L+.4,.12,W+.4,0,.06,0); box(G,M.dark,L,.12,W,0,.18,0); box(G,M.panel,L,H-.3,W,0,.24+(H-.3)/2,0); box(G,M.dark,L,.12,W,0,H+.0,0);
  box(G,M.louver,.6,.5,.02,.35,.7,-W/2-.01); box(G,M.louver,.6,.5,.02,.35,.7,W/2+.01); box(G,M.louver,.02,.6,.7,L/2+.01,.75,0);
  box(G,M.dark,.3,.22,.02,-.5,.95,W/2+.01); box(G,M.glass,.18,.1,.005,-.5,.98,W/2+.025); box(G,M.orange,L,.04,.01,0,1.06,W/2+.01);
  noz(G,L/2,1.0,.25,"+x",.2,.025,M.galv)}
BUILD["C-403"]=(G,e)=>airComp(G,e,0); BUILD["C-404"]=(G,e)=>airComp(G,e,0);
BUILD["TK-101"]=(G,e)=>{at(G,e); const r=1.2,L=2.4,y=1.62; // 2,4 m entre costuras + cabezales 2:1 ≈ 14,5 m³ ≈ 3.800 gal
  box(G,M.concrete,5.6,.12,4.6,0,.06,0); [[0,-2.25,5.6,.2],[0,2.25,5.6,.2]].forEach(([x,z,sx,sz])=>box(G,M.concrete2,sx,.7,sz,x,.35,z));
  [-2.7,2.7].forEach(x=>box(G,M.concrete2,.2,.7,4.3,x,.35,0));
  [-.7,.7].forEach(x=>box(G,M.concrete,.4,.55,2.0,x,.4,0)); vesselH(G,M.white,r,L,0,y,0,"x");
  cyl(G,M.white,.3,.15,.6,y+r+.05,0,"y",SEG); flange(G,.36,.6,y+r+.13,0,"y",.05,M.dark,16);
  cyl(G,M.galv,.06,.5,-.5,y+r+.2,0,"y",10); cyl(G,M.steel,.12,.18,-.5,y+r+.5,0,"y",12); head(G,M.steel,.12,-.5,y+r+.59,0,"+y",.6,12);
  ladder(G,-1.0,-r-.35,.7,y+r+1.07,PI,false); grating(G,-.7,y+r-.02,-.55,1.0,.9,false); rail(G,[[-1.2,-.95],[-.2,-.95],[-.2,-.1]],y+r-.02);
  run(G,M.panel,[[1.2,.55,0],[2.45,.55,0],[2.45,.55,-1.5],[3.2,.55,-1.5]],.04); gate(G,2.9,.55,-1.5,"x",.04); levelGlass(G,-L/2-.4,0,y-.6,y+.6,-1,0)};
BUILD["V-501"]=(G,e)=>{at(G,e); const r=.6,L=3.0,y=1.0+.15;
  pad(G,0,0,4.4,1.8); [-.9,.9].forEach(x=>box(G,M.concrete,.35,y-r,1.1,x,(y-r)/2+.15,0)); vesselH(G,M.white,r,L,0,y,0,"x");
  noz(G,-1.0,y+r,0,"+y",.05,.076,M.white); noz(G,1.0,y+r,0,"+y",.05,.076,M.white); levelGlass(G,.3,r,y-.4,y+.1,0,1);
  noz(G,0,y-r,0,"-y",.15,.03,M.white,false); gate(G,0,.32,.4,"z",.03); gauge(G,-.6,y+.3,r,"+z")};
BUILD["F-901"]=(G,e)=>{G.position.set(72,0,22); const H=15;
  box(G,M.concrete,2.2,.45,2.2,0,.225,0); cyl(G,M.dark,.42,.05,0,.47,0,"y",SEG);
  for(let i=0;i<4;i++){const a=i*PI/2; box(G,M.steel,.03,.5,.28,Math.cos(a)*.3,.75,Math.sin(a)*.3,-a)}
  cyl(G,M.galv,.2,H-.5,0,(H-.5)/2+.5,0,"y",SEG); [5,10].forEach(y=>flange(G,.3,0,y,0,"y",.07,M.dark,12));
  cyl(G,M.insul,.3,1.0,0,H+.5,0,"y",SEG); cone(G,M.insul,.42,.3,.25,0,H+1.12,0); cyl(G,M.dark,.31,.06,0,H,0,"y",SEG);
  between(G,M.galv,[.26,.6,0],[.26,H+.8,0],.018,6); box(G,M.panel,.5,.8,.3,1.3,1.1,0); box(G,M.steel,.08,1.1,.08,1.3,.55,0);
  noz(G,-.2,2.0,0,"-x",.1,.076,M.galv);
  [90,210,330].forEach(d=>{const a=d*PI/180, ax=Math.cos(a)*9, az=Math.sin(a)*9; between(G,M.black,[0,10,0],[ax,.35,az],.009,4); box(G,M.concrete,.7,.35,.7,ax,.17,az)});
  // llama (no se fusiona: se mueve)
  const F=new THREE.Group(); F.userData.dyn=true; F.position.set(0,H+1.2,0); G.add(F); flames.push(F);
  [[2.4,5.0,0],[1.6,3.4,.35],[1.2,2.4,-.3]].forEach(([w,h,o],i)=>{const s=new THREE.Sprite(i?flameMat:flameCore); s.scale.set(w,h,1); s.position.set(o*.5,h*.45,0); s.userData.b=[w,h,o]; F.add(s)})};
const flames=[];
let flameCore;
const flameMat=new THREE.SpriteMaterial({map:canvasTex(64,128,(x,w,h)=>{const g=x.createRadialGradient(w/2,h*.78,2,w/2,h*.6,h*.55);
  g.addColorStop(0,"rgba(255,250,220,1)");g.addColorStop(.25,"rgba(255,205,90,.95)");g.addColorStop(.55,"rgba(255,120,30,.6)");g.addColorStop(1,"rgba(255,80,0,0)");
  x.fillStyle=g;x.beginPath();x.ellipse(w/2,h*.6,w*.48,h*.52,0,0,PI*2);x.fill()}),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,toneMapped:false});
flameCore=new THREE.SpriteMaterial({map:flameMat.map,depthWrite:false,transparent:true,toneMapped:false,color:"#ffd27a"});

BUILD["RACK"]=(G,e)=>{G.position.set(0,0,0);
  for(let x=2;x<=68;x+=6){[-4,-1].forEach(z=>{box(G,M.concrete,.6,.3,.6,x,.15,z); beam(G,[x,.3,z],[x,5.15,z],.2,.2); posts.push([x,z,.3])});
    [3.85,5.0].forEach(y=>beam(G,[x,y,-4.1],[x,y,-.9],.15,.15));
    [-4,-1].forEach(z=>beam(G,[x,3.3,z],[x+(x<68?.6:-.6),3.85,z],.08,.08))}
  [-4,-1].forEach(z=>[3.85,5.0].forEach(y=>beam(G,[2,y,z],[68,y,z],.12,.1)));
  [14,38,56].forEach(x=>[-4,-1].forEach(z=>{beam(G,[x,.35,z],[x+6,3.8,z],.08,.08); beam(G,[x+6,.35,z],[x,3.8,z],.08,.08);
    for(let k=.5;k<6;k+=.5) posts.push([x+k,z,.1])}))}; // las diagonales cierran ese vano

// Respaldo: equipos sin modelo propio usan las piezas del JSON
function fromParts(G,e){e.parts.forEach(p=>{const mat=std(p.c);
  if(p.t==="box") box(G,mat,p.s[0],p.s[1],p.s[2],p.p[0],p.p[1],p.p[2]);
  else if(p.t==="cyl") cyl(G,mat,p.r,p.h,p.p[0],p.p[1],p.p[2],p.axis||"y");
  else if(p.t==="ell") head(G,mat,p.r,p.p[0],p.p[1],p.p[2],p.axis,p.k)})}

// =====================================================================
// Construcción de la escena
// =====================================================================
const groups={}, pickables=[], eqBoxes=[];
P.equipment.forEach(e=>{const G=new THREE.Group(); (BUILD[e.tag]||fromParts)(G,e);
  const {group,meshes}=bake(G,{eq:e}); groups[e.tag]=group;
  if(e.tag!=="RACK") meshes.forEach(m=>pickables.push(m));
  if(e.tag!=="RACK"){const b=new THREE.Box3().setFromObject(group); b.expandByScalar(.25); b.eq=e; eqBoxes.push(b)}
  if(!e.focus) e.focus=new THREE.Box3().setFromObject(group).getCenter(new V3()).toArray()});

// ---- tuberías de proceso: cuerpo + flechas de flujo que avanzan ----
const flowTex=canvasTex(128,32,(x,w,h)=>{x.clearRect(0,0,w,h); x.fillStyle="#fff";
  [0,h/2].forEach(o=>{x.beginPath();x.moveTo(w*.18,o);x.lineTo(w*.5,o+h/4);x.lineTo(w*.18,o+h/2);x.lineTo(w*.36,o+h/2);x.lineTo(w*.68,o+h/4);x.lineTo(w*.36,o);x.closePath();x.fill()})});
flowTex.colorSpace=THREE.NoColorSpace;
const flowFast=flowTex.clone(); flowFast.needsUpdate=true;
const streamGroups={}, pipeMats={}, flowMats={}, flowTexs={}, pipeSegs=[];
const REAL="#8f979e";
Object.entries(P.streams).forEach(([k,s])=>{pipeMats[k]=std(s.color,.42,.25); flowTexs[k]=flowTex.clone(); flowTexs[k].needsUpdate=true; flowMats[k]=new THREE.MeshBasicMaterial({map:flowTexs[k],color:new THREE.Color(s.color).lerp(new THREE.Color("#ffffff"),.35),
  transparent:true,depthWrite:false,toneMapped:false,opacity:.95}); flowMats[k].userData.noShadow=true});
{const body={}, flow={};
  P.pipes.forEach(pp=>{const r=Math.max(pp.d/2,.016), f=fillet(pp.pts,r);
    (body[pp.stream]||(body[pp.stream]=[])).push(tubeGeo(f,r,mobile?10:14,1));
    (flow[pp.stream]||(flow[pp.stream]=[])).push(tubeGeo(f,r*1.18+.006,8,.9));
    for(let i=0;i<pp.pts.length-1;i++) pipeSegs.push({a:pp.pts[i],b:pp.pts[i+1],r});
    [[f[0],f[1]],[f[f.length-1],f[f.length-2]]].forEach(([p,q])=>{const d=p.clone().sub(q).normalize(), g=gCyl(SEGS*2).clone();
      const m=new THREE.Matrix4().compose(p.clone().addScaledVector(d,-.03),new THREE.Quaternion().setFromUnitVectors(UP,d),new V3(r*1.8+.015,.05,r*1.8+.015));
      (body[pp.stream]).push(g.applyMatrix4(m))})});
  Object.keys(body).forEach(k=>{const g=new THREE.Group(); scene.add(g); streamGroups[k]=g;
    const mb=new THREE.Mesh(mergeGeos(body[k]),pipeMats[k]); mb.castShadow=mb.receiveShadow=true; g.add(mb);
    const mf=new THREE.Mesh(mergeGeos(flow[k]),flowMats[k]); mf.renderOrder=2; mf.userData.flow=true; g.add(mf)});
}

// ---- soportes de tubería, zapatas en el rack y durmientes ----
{const S=new THREE.Group(), inRack=(x,z)=>x>1.6&&x<68.4&&z>-4.2&&z<-.8, inEq=(x,y,z)=>eqBoxes.some(b=>x>b.min.x&&x<b.max.x&&z>b.min.z&&z<b.max.z&&y<b.max.y+.6);
  pipeSegs.forEach(({a,b,r})=>{const dy=Math.abs(a[1]-b[1]), L=Math.hypot(b[0]-a[0],b[2]-a[2]); if(dy>.01||L<1) return; const y=a[1];
    const alongX=Math.abs(b[0]-a[0])>Math.abs(b[2]-a[2]);
    if(inRack(a[0],a[2])&&inRack(b[0],b[2])&&alongX){const x0=Math.min(a[0],b[0]), x1=Math.max(a[0],b[0]);
      for(let x=2;x<=68;x+=6){if(x<=x0+.05||x>=x1-.05) continue; const tier=y-r>=5.07?5.075:y-r>=3.92?3.925:null; if(tier===null) continue;
        const gap=y-r-tier; if(gap>.004) box(S,M.steel,.12,gap,.14,x,tier+gap/2,a[2])} return}
    if(L<2.5) return;
    for(let s=1.2;s<L-.8;s+=3.6){const t=s/L, x=a[0]+(b[0]-a[0])*t, z=a[2]+(b[2]-a[2])*t; if(inRack(x,z)||inEq(x,y,z)) continue;
      if(y<.7){box(S,M.concrete,alongX?.25:.6,Math.max(.05,y-r),alongX?.6:.25,x,(y-r)/2,z); continue}
      if(y>6) continue;
      box(S,M.concrete,.4,.2,.4,x,.1,z); box(S,M.steel,.12,y-r-.2,.12,x,(y-r+.2)/2,z); posts.push([x,z,.2]); box(S,M.steel,alongX?.12:.6,.08,alongX?.6:.12,x,y-r-.04,z)}});
  bake(S,{})}

// ---- entorno: terreno, patio, cerca, postes, árboles, personas ----
{const ground=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),std("#ffffff",1,0,{map:TX.ground})); ground.rotation.x=-PI/2; ground.position.set(CENTER.x,-.01,CENTER.z); ground.receiveShadow=true; scene.add(ground);
  const padM=new THREE.Mesh(new THREE.PlaneGeometry(88,54),std("#ffffff",1,0,{map:TX.pad})); padM.rotation.x=-PI/2; padM.position.set(37,.005,1); padM.receiveShadow=true; scene.add(padM);
  const road=new THREE.Mesh(new THREE.PlaneGeometry(7,90),std("#8d8a83",1,0)); road.rotation.x=-PI/2; road.position.set(3,.008,72); road.receiveShadow=true; scene.add(road);
  const E=new THREE.Group(), x0=-7, x1=81, z0=-26, z1=28, H=2.2;
  const side=(a,b)=>{const L=Math.hypot(b[0]-a[0],b[1]-a[1]); const g=new THREE.PlaneGeometry(L,H); const uv=g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*L/.5,uv.getY(i)*H/.5);
    const m=new THREE.Mesh(g,M.fence); m.position.set((a[0]+b[0])/2,H/2,(a[1]+b[1])/2); m.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]); E.add(m);
    const n=Math.round(L/3); for(let i=0;i<=n;i++) cyl(E,M.galv,.04,H+.15,a[0]+(b[0]-a[0])*i/n,(H+.15)/2,a[1]+(b[1]-a[1])*i/n,"y",8);
    between(E,M.galv,[a[0],H,a[1]],[b[0],H,b[1]],.03,6)};
  side([x0,z0],[x1,z0]); side([x1,z0],[x1,z1]); side([x1,z1],[7,z1]); side([-1,z1],[x0,z1]); side([x0,z1],[x0,z0]);
  [[x0,z0],[x1,z0],[x1,z1],[x0,z1],[37,z0],[37,z1],[x0,0],[x1,0]].forEach(([x,z])=>{const ix=x<37?1:-1, iz=z<1?1:-1;
    box(E,M.concrete,.5,.3,.5,x+ix*.6,.15,z+iz*.6); cyl(E,M.galv,.08,9,x+ix*.6,4.5,z+iz*.6,"y",10);
    between(E,M.galv,[x+ix*.6,8.9,z+iz*.6],[x+ix*1.6,9.1,z+iz*1.4],.04,6); box(E,M.panel,.6,.14,.3,x+ix*1.7,9.05,z+iz*1.5)});
  // manga de viento junto a la tea
  cyl(E,M.galv,.05,6,77,3,16,"y",8);
  const sock=new THREE.Group(); sock.position.set(77,5.9,16); sock.userData.dyn=true; E.add(sock); spinners.push(Object.assign(sock,{userData:{dyn:true,sway:1}}));
  mesh(sock,gCone(16,.45),M.sock,.8,0,0,[0,0,-PI/2],[.32,1.6,.32]);
  // árboles alrededor (sabana del Sinú)
  seed=11; const nT=mobile?26:48;
  for(let i=0;i<nT;i++){let x,z; do{x=-40+rnd()*155; z=-60+rnd()*125}while(x>x0-6&&x<x1+6&&z>z0-6&&z<z1+6||(x>-2&&x<8&&z>z1));
    const s=.8+rnd()*.9; cyl(E,M.trunk,.18*s,2.4*s,x,1.2*s,z,"y",6);
    sph(E,rnd()>.5?M.tree:M.tree2,1.6*s,x,2.9*s,z,8); sph(E,M.tree,1.2*s,x+.8*s,3.4*s,z-.4*s,7); sph(E,M.tree2,1.1*s,x-.7*s,3.6*s,z+.5*s,7)}
  bake(E,{});
  const W=new THREE.Group();
  [[59.2,-8.4,PI*.9],[19.6,-8.0,-PI*.6],[15.2,11.1,PI],[33.2,-7.4,PI*.15,M.blue],[47.0,-1.9,PI*1.2]].forEach(([x,z,ry,v])=>{person(W,x,z,ry,v); posts.push([x,z,.22])});
  [[25.8,-6.0],[44.2,9.2],[11.5,-7.6]].forEach(([x,z])=>{extintor(W,x,z); posts.push([x,z,.15])});
  bake(W,{})}

// =====================================================================
// Etiquetas, selección, cámara y paneles
// =====================================================================
const labels=[];
function makeLabel(text){const s=2, cv=document.createElement("canvas"); cv.width=320*s; cv.height=86*s; const x=cv.getContext("2d"); x.scale(s,s);
  x.font="800 30px system-ui,Segoe UI,Arial"; const w=Math.min(300,x.measureText(text).width+30);
  x.fillStyle="rgba(14,22,30,.9)"; x.beginPath(); x.roundRect(160-w/2,8,w,44,22); x.fill(); x.strokeStyle="rgba(240,173,46,.9)"; x.lineWidth=2; x.stroke();
  x.fillStyle="#f6b739"; x.textAlign="center"; x.textBaseline="middle"; x.fillText(text,160,31);
  x.fillStyle="rgba(14,22,30,.9)"; x.beginPath(); x.moveTo(153,51); x.lineTo(167,51); x.lineTo(160,62); x.fill();
  const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true,sizeAttenuation:false,toneMapped:false}));
  const k=mobile?.032:.04; sp.scale.set(k*3.72,k,1); sp.renderOrder=10; return sp}
P.equipment.forEach(e=>{if(e.tag==="RACK") return; const b=new THREE.Box3().setFromObject(groups[e.tag]);
  const sp=makeLabel(e.tag); sp.position.set(e.focus[0],b.max.y+.9,e.focus[2]); sp.userData.eq=e; scene.add(sp); labels.push(sp)});
let lblOn=!mobile; labels.forEach(l=>l.visible=lblOn);

// =====================================================================
// Cámara, selección y estado de los equipos (lo maneja el simulador)
// =====================================================================
const camera=new THREE.PerspectiveCamera(42,1,.1,2000);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true; controls.dampingFactor=.08; controls.maxPolarAngle=PI*.48; controls.minDistance=2.5; controls.maxDistance=230; controls.zoomToCursor=true;
const HOME=()=>narrow()?{pos:new V3(37,105,92),tgt:new V3(37,0,-1)}:{pos:new V3(36,66,78),tgt:new V3(38,0,-2)};
camera.position.copy(HOME().pos); controls.target.copy(HOME().tgt);

const ray=new THREE.Raycaster(), mouse=new THREE.Vector2();
const ringGeo=new THREE.RingGeometry(.92,1,64);
const halo=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:"#ffffff",transparent:true,opacity:.9,depthWrite:false,toneMapped:false}));
halo.rotation.x=-PI/2; halo.visible=false; halo.renderOrder=3; scene.add(halo);
let selected=null;
const footprint=tag=>{const b=new THREE.Box3().setFromObject(groups[tag]), c=b.getCenter(new V3()), sz=b.getSize(new V3());
  return {c,r:Math.min(7,Math.max(1.2,Math.hypot(sz.x,sz.z)/2+.5)),top:b.max.y}};
function select(tag){selected=tag&&groups[tag]?tag:null; halo.visible=!!selected;
  if(selected){const f=footprint(selected); halo.position.set(f.c.x,.05,f.c.z); halo.scale.setScalar(f.r*1.08)}}

// tinte por estado: verde = bien, ámbar = cerca del límite, rojo = falla, gris = fuera de servicio
const TINT={ok:null,aviso:["#ffb000",.1],falla:["#ff2a1a",.16],apagado:"gris"};
const tintCache=new Map(), estados={}, rings={};
const ringMat={aviso:new THREE.MeshBasicMaterial({color:"#ffb000",transparent:true,opacity:.8,depthWrite:false,toneMapped:false}),
  falla:new THREE.MeshBasicMaterial({color:"#ff3b2f",transparent:true,opacity:.9,depthWrite:false,toneMapped:false})};
function tinted(mat,est){const k=mat.uuid+est; let m=tintCache.get(k); if(m) return m; m=mat.clone();
  if(est==="apagado"){const c=m.color.clone(), g=c.r*.3+c.g*.59+c.b*.11; m.color.setRGB(g*.8,g*.8,g*.82)}
  else {m.emissive=new THREE.Color(TINT[est][0]); m.emissiveIntensity=TINT[est][1]}
  tintCache.set(k,m); return m}
function setEstado(tag,est){const G=groups[tag]; if(!G||estados[tag]===est) return; estados[tag]=est;
  G.children.forEach(m=>{if(!m.isMesh) return; if(!m.userData.base) m.userData.base=m.material; m.material=est==="ok"||!est?m.userData.base:tinted(m.userData.base,est)});
  if(rings[tag]){scene.remove(rings[tag]); delete rings[tag]}
  if(est==="falla"||est==="aviso"){const f=footprint(tag), r=new THREE.Mesh(ringGeo,ringMat[est]); r.rotation.x=-PI/2; r.position.set(f.c.x,.04,f.c.z);
    r.userData.r=f.r; r.renderOrder=3; scene.add(r); rings[tag]=r}}

// ---- corrientes: velocidad del flujo según el caudal y color por proceso o por temperatura ----
const flowSpeed={}; Object.keys(flowTexs).forEach(k=>flowSpeed[k]=1.1);
let colorMode="proceso", streamState={};
const tempColor=t=>{ // azul frío → cian → verde → ámbar → rojo caliente (°F)
  const stops=[[20,"#2d6cdf"],[50,"#26b5d9"],[85,"#3fb56b"],[130,"#f2b233"],[230,"#e4572e"]];
  if(t<=stops[0][0]) return new THREE.Color(stops[0][1]); if(t>=stops[4][0]) return new THREE.Color(stops[4][1]);
  let i=0; while(stops[i+1][0]<t) i++; const k=(t-stops[i][0])/(stops[i+1][0]-stops[i][0]);
  return new THREE.Color(stops[i][1]).lerp(new THREE.Color(stops[i+1][1]),k)};
function paintStreams(){Object.entries(pipeMats).forEach(([k,m])=>{const st=streamState[k];
  const c=colorMode==="temperatura"&&st?tempColor(st.T):new THREE.Color(P.streams[k].color);
  m.color.copy(c); if(flowMats[k]) flowMats[k].color.copy(c.clone().lerp(new THREE.Color("#ffffff"),.35));
  const on=!st||st.activo; if(flowMats[k]) flowMats[k].opacity=on?.95:0;
  if(!on){m.color.lerp(new THREE.Color("#8f979e"),.75)}})}
function setStreams(s){streamState=s||{}; Object.entries(streamState).forEach(([k,v])=>{flowSpeed[k]=v.activo?THREE.MathUtils.clamp(.35+v.rel*.9,.2,3.2):0}); paintStreams()}
function setColorMode(m){colorMode=m; paintStreams()}
let flowOn=true;
function setFlow(on){flowOn=on; Object.values(streamGroups).forEach(g=>g.children.forEach(m=>{if(m.userData.flow) m.visible=on}))}
function setLabels(on){lblOn=on; labels.forEach(l=>l.visible=on)}
function showStream(k,on){if(streamGroups[k]) streamGroups[k].visible=on}

// ---- vuelos de cámara ----
let anim=null;
const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
function flyTo(tgt,dist,dx,dy,dz,ms=1500){const t=new V3(...tgt), d=new V3(dx??1,dy??.8,dz??1.3).normalize().multiplyScalar(dist);
  anim={t0:performance.now(),ms,p0:camera.position.clone(),q0:controls.target.clone(),p1:t.clone().add(d),q1:t}}
function boxSize(tag){return new THREE.Box3().setFromObject(groups[tag]).getSize(new V3()).length()}
function flyEq(tag,dist){const e=P.equipment.find(x=>x.tag===tag); if(!e||!groups[tag]) return; const n=e.focus[2]<-3;
  flyTo(e.focus,(dist||Math.max(12,boxSize(tag)*1.9))*(narrow()?1.4:1),n?.75:1,.8,n?-1.15:1.3)}
function flyMany(tags,k=1){const b=new THREE.Box3(); tags.forEach(t=>{if(groups[t]) b.expandByObject(groups[t])}); if(b.isEmpty()) return;
  const c=b.getCenter(new V3()), s=b.getSize(new V3()).length(); flyTo([c.x,Math.min(c.y,3),c.z],Math.max(18,s*1.45*k)*(narrow()?1.35:1),1,.95,1.25)}
function home(){const h=HOME(); anim={t0:performance.now(),ms:1500,p0:camera.position.clone(),q0:controls.target.clone(),p1:h.pos.clone(),q1:h.tgt.clone()}}

// ---- clic sobre un equipo ----
let onPick=()=>{}, downPos=null;
canvas.addEventListener("pointerdown",ev=>{downPos=[ev.clientX,ev.clientY]; anim=null});
canvas.addEventListener("pointerup",ev=>{if(!downPos||Math.hypot(ev.clientX-downPos[0],ev.clientY-downPos[1])>6) return;
  const r=canvas.getBoundingClientRect(); mouse.set((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1);
  ray.setFromCamera(mouse,camera); const hit=ray.intersectObjects([...pickables,...(lblOn?labels:[])],false)[0];
  onPick(hit?hit.object.userData.eq.tag:null)});

// ---- anclas: posición en pantalla de cada equipo para las etiquetas con valores ----
const anchorPos={}; P.equipment.forEach(e=>{if(groups[e.tag]){const f=footprint(e.tag); anchorPos[e.tag]=new V3(e.focus[0],f.top+.4,e.focus[2])}});
const tmp=new V3();
function project(tag){const p=anchorPos[tag]; if(!p) return null; tmp.copy(p).project(camera);
  const r=canvas.getBoundingClientRect(); return {x:(tmp.x*.5+.5)*r.width+r.left,y:(-tmp.y*.5+.5)*r.height+r.top,vis:tmp.z<1&&tmp.z>-1,d:camera.position.distanceTo(p)}}

// =====================================================================
// Encuadre: el centro de la vista queda en el hueco que dejan los paneles
// =====================================================================
let insets={left:0,right:0,top:0,bottom:0};
function resize(){const w=innerWidth,h=innerHeight; renderer.setSize(w,h,false);
  const cx=(insets.left+(w-insets.right))/2-w/2, cy=(insets.top+(h-insets.bottom))/2-h/2, sx=Math.round(cx), sy=Math.round(cy);
  const fw=w+2*Math.abs(sx), fh=h+2*Math.abs(sy);
  camera.fov=narrow()?(w<h?58:48):42; camera.aspect=fw/fh;
  camera.setViewOffset(fw,fh,sx<0?2*-sx:0,sy<0?2*-sy:0,w,h); camera.updateProjectionMatrix()}
function setInsets(i){insets=Object.assign(insets,i); resize()}
addEventListener("resize",resize); resize();
renderer.shadowMap.needsUpdate=true;

let last=performance.now(), acc=0, frames=0, onFrame=()=>{};
function loop(now){const dt=Math.min(.05,(now-last)/1000); last=now;
  if(anim){const k=Math.min(1,(now-anim.t0)/anim.ms), e=ease(k); camera.position.lerpVectors(anim.p0,anim.p1,e); controls.target.lerpVectors(anim.q0,anim.q1,e); if(k>=1) anim=null}
  controls.update();
  if(flowOn) Object.entries(flowTexs).forEach(([k,t])=>{t.offset.x-=dt*(flowSpeed[k]??1.1)});
  spinners.forEach(b=>{if(b.userData.sway) b.rotation.y=.35+Math.sin(now*.0006)*.25; else b.rotateY(dt*b.userData.spin)});
  flames.forEach(F=>F.children.forEach((s,i)=>{const [w,h,o]=s.userData.b, f=1+.13*Math.sin(now*.011+i*2.1)+.07*Math.sin(now*.027+i);
    s.scale.set(w*(1+.06*Math.sin(now*.017+i)),h*f,1); s.position.x=o*.5+Math.sin(now*.003+i)*.12}));
  if(halo.visible) halo.material.opacity=.5+.4*Math.sin(now*.005);
  const pulse=(now%1600)/1600;
  Object.values(rings).forEach(r=>{r.scale.setScalar(r.userData.r*(1+pulse*.45)); r.material.opacity=(1-pulse)*.85});
  renderer.render(scene,camera); onFrame();
  acc+=dt; frames++; if(acc>2){const fps=frames/acc; acc=0; frames=0;
    if(fps<38&&pixelRatio>1){pixelRatio=Math.max(1,pixelRatio-.25); renderer.setPixelRatio(pixelRatio); resize()}}
  requestAnimationFrame(loop)}
requestAnimationFrame(t=>{last=t; loop(t)});

window.__escena={scene,camera,controls,renderer,groups,
  select,setEstado,setStreams,setColorMode,setFlow,setLabels,showStream,flyTo,flyEq,flyMany,home,project,setInsets,
  set onPick(f){onPick=f}, set onFrame(f){onFrame=f}, tempColor:t=>"#"+tempColor(t).getHexString(),
  info:()=>renderer.info.render};
// la escena ya está armada: la interfaz puede arrancar aunque la pestaña esté en segundo plano (sin cuadros)
setTimeout(()=>window.dispatchEvent(new Event("escena-lista")),0);
})();
