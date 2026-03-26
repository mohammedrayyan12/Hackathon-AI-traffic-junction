
// ═══════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════
const ROAD_LEN = 40;   // from center to far spawn point
const LANE_W   = 9;    // total road width (2 lanes)
const INTER    = 5.0;  // stop-line distance from center
const YELLOW_DUR = 2.8; // seconds of yellow before green switches

const ROADS = [
  { name:'Road 1', hex:'#38bdf8', dot:'#0ea5e9', dir:'north' },
  { name:'Road 2', hex:'#22d55a', dot:'#16a34a', dir:'east'  },
  { name:'Road 3', hex:'#a78bfa', dot:'#7c3aed', dir:'south' },
  { name:'Road 4', hex:'#fb923c', dot:'#ea580c', dir:'west'  },
];

// stopC moved to INTER+4.0 so vehicles halt BEFORE the zebra crossing (zebra is at INTER+2.2)
const STOP_DIST = INTER + 4.0;
const ROAD_CFG = {
  north:{ axis:'z', dir: 1, spawnC:-(ROAD_LEN), stopC:-(STOP_DIST), exitC: ROAD_LEN, laneOff: LANE_W*0.23 },
  south:{ axis:'z', dir:-1, spawnC: ROAD_LEN,   stopC:  STOP_DIST,  exitC:-(ROAD_LEN),laneOff:-LANE_W*0.23 },
  east: { axis:'x', dir:-1, spawnC: ROAD_LEN,   stopC:  STOP_DIST,  exitC:-(ROAD_LEN),laneOff: LANE_W*0.23 },
  west: { axis:'x', dir: 1, spawnC:-(ROAD_LEN), stopC:-(STOP_DIST), exitC: ROAD_LEN, laneOff:-LANE_W*0.23 },
};

// Zebra crossing centres (vehicles cross from -side to +side)
const ZEBRA = {
  north:{ cx:0,       cz:-(INTER+2.2), walkAxis:'x' },
  south:{ cx:0,       cz:  INTER+2.2,  walkAxis:'x' },
  east: { cx:  INTER+2.2, cz:0,        walkAxis:'z' },
  west: { cx:-(INTER+2.2),cz:0,        walkAxis:'z' },
};

const VTYPES = [
  { key:'car',       icon:'🚗', label:'Car',       pcuW:1.0, w:2.0,h:0.6, l:3.8, isAmbu:false, isPed:false },
  { key:'motorcycle',icon:'🏍️',label:'Bike',      pcuW:0.5, w:0.8,h:0.85,l:2.2, isAmbu:false, isPed:false },
  { key:'bus',       icon:'🚌', label:'Bus',        pcuW:2.5, w:2.4,h:1.6, l:7.5, isAmbu:false, isPed:false },
  { key:'bicycle',   icon:'🚲', label:'Bicycle',    pcuW:0.3, w:0.6,h:0.95,l:1.8, isAmbu:false, isPed:false },
  { key:'ambulance', icon:'🚑', label:'Ambulance',  pcuW:999, w:2.1,h:1.2, l:4.8, isAmbu:true,  isPed:false },
  { key:'pedestrian',icon:'🚶', label:'Pedestrian', pcuW:0.1, w:0.5,h:1.7, l:0.5, isAmbu:false, isPed:true  },
];

// ═══════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════
let paused      = false;
let simTime     = 0;
let passedTotal = 0;

let vehicleCounts = {}; // [roadName][vtKey] = integer (waiting queue)
ROADS.forEach(r=>{ vehicleCounts[r.name]={}; VTYPES.forEach(v=>vehicleCounts[r.name][v.key]=0); });

let vehicles   = [];
let signalState= {}; ROADS.forEach(r=>signalState[r.name]='red');
let manualOverride = {};
let roadPCU    = {}; ROADS.forEach(r=>roadPCU[r.name]=0);

// Cycle state
let cycleTimer    = 0;
let inYellow      = false;
let yellowTimer   = 0;
let yellowToRoad  = null;
let cycleDurations= {}; ROADS.forEach(r=>cycleDurations[r.name]=15);

let uploadedFiles = {};
let ortSession    = null;

// ═══════════════════════════════════════════════════
//  THREE.JS SETUP
// ═══════════════════════════════════════════════════
const canvas   = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x070b11);

const scene  = new THREE.Scene();
scene.fog    = new THREE.FogExp2(0x070b11, 0.011);
const camera = new THREE.PerspectiveCamera(52,1,0.1,600);

// Lights
scene.add(new THREE.AmbientLight(0x1a2844, 2.8));
const sun = new THREE.DirectionalLight(0xfff5e0,1.0);
sun.position.set(12,35,18); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.near=1; sun.shadow.camera.far=120;
sun.shadow.camera.left=-45; sun.shadow.camera.right=45;
sun.shadow.camera.top=45;   sun.shadow.camera.bottom=-45;
scene.add(sun);
//
const fillLight = new THREE.DirectionalLight(0x2244aa, 0.35);
fillLight.position.set(-8, 10, -8);
scene.add(fillLight);
//

// ═══════════════════════════════════════════════════
//  WORLD BUILD
// ═══════════════════════════════════════════════════
function addMesh(geo,mat,pos,rot,shadow){
  const m=new THREE.Mesh(geo,mat);
  m.position.set(...pos);
  if(rot){m.rotation.x=rot[0];m.rotation.y=rot[1];m.rotation.z=rot[2];}
  if(shadow){m.castShadow=true;m.receiveShadow=true;}
  scene.add(m); return m;
}

function buildWorld(){
  const asphalt = new THREE.MeshLambertMaterial({color:0x131820});
  const asphaltI= new THREE.MeshLambertMaterial({color:0x0c1016});
  const sidewalk= new THREE.MeshLambertMaterial({color:0x182030});
  const marking = new THREE.MeshLambertMaterial({color:0xffffff,opacity:0.5,transparent:true});
  const stopM   = new THREE.MeshLambertMaterial({color:0xffffff,opacity:0.85,transparent:true});
  const zebraM  = new THREE.MeshLambertMaterial({color:0xe0e0e0,opacity:0.45,transparent:true});

  // Ground
  addMesh(new THREE.PlaneGeometry(250,250),new THREE.MeshLambertMaterial({color:0x07100a}),
    [0,-0.06,0],[-Math.PI/2,0,0],true);

  // Road surfaces — make them long enough for ROAD_LEN
  const RL = ROAD_LEN*2 + LANE_W;
  addMesh(new THREE.BoxGeometry(RL,0.16,LANE_W), asphalt, [0,0,0], null, true); // E-W
  addMesh(new THREE.BoxGeometry(LANE_W,0.16,RL), asphalt, [0,0,0], null, true); // N-S
  addMesh(new THREE.BoxGeometry(LANE_W+0.2,0.17,LANE_W+0.2), asphaltI, [0,0.005,0], null, true); // intersection

  // Sidewalk blocks at corners — pushed FAR from road centre
  const swCentre = LANE_W/2 + 11;
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{
    const px=sx*swCentre, pz=sz*swCentre;
    addMesh(new THREE.BoxGeometry(20,0.2,20), sidewalk, [px,0,pz], null, true);
    // Kerb strip along road edge
    addMesh(new THREE.BoxGeometry(20,0.06,0.35),new THREE.MeshLambertMaterial({color:0x2a3a55}),
      [px,0.14,sz*(LANE_W/2+0.02)]);
    addMesh(new THREE.BoxGeometry(0.35,0.06,20),new THREE.MeshLambertMaterial({color:0x2a3a55}),
      [sx*(LANE_W/2+0.02),0.14,pz]);

    // Buildings: placed at corner
    const setback = LANE_W/2 + 14 + Math.random()*4;
    const bh  = 5+Math.random()*8;
    const bw  = 7+Math.random()*4;
    const bd  = 7+Math.random()*4;
    const bx  = sx*(setback + bw/2);
    const bz  = sz*(setback + bd/2);
    addMesh(new THREE.BoxGeometry(bw,bh,bd),
      new THREE.MeshLambertMaterial({color:0x0d1520}), [bx,bh/2,bz], null, true);
    // Roof
    addMesh(new THREE.BoxGeometry(bw+0.15,0.25,bd+0.15),
      new THREE.MeshLambertMaterial({color:0x0f1c2a}), [bx,bh+0.12,bz]);
    // Window glow
    if(bh>6){
      addMesh(new THREE.BoxGeometry(bw*0.65,bh*0.45,0.06),
        new THREE.MeshBasicMaterial({color:0x1a3055,opacity:0.6,transparent:true}),
        [bx,bh*0.5,bz-bd/2-0.02]);
    }
  });

  // Lane dashes — skip gap at intersection (±INTER)
  function armDashes(isH, armSign){
    const start=INTER+1.2, end=ROAD_LEN-1.5, total=end-start;
    const n=Math.floor(total/3.8);
    for(let i=0;i<n;i++){
      const t = start+(i+0.5)*(total/n);
      const p = armSign*t;
      if(isH) addMesh(new THREE.BoxGeometry(1.9,0.02,0.14),marking,[p,0.1,0]);
      else     addMesh(new THREE.BoxGeometry(0.14,0.02,1.9),marking,[0,0.1,p]);
    }
  }
  armDashes(true,1); armDashes(true,-1);
  armDashes(false,1); armDashes(false,-1);

  // Stop lines — one per road arm
  const stopOff=INTER+0.12;
  addMesh(new THREE.BoxGeometry(LANE_W,0.02,0.2),stopM,[0,0.1,-stopOff]);
  addMesh(new THREE.BoxGeometry(LANE_W,0.02,0.2),stopM,[0,0.1, stopOff]);
  addMesh(new THREE.BoxGeometry(0.2,0.02,LANE_W),stopM,[-stopOff,0.1,0]);
  addMesh(new THREE.BoxGeometry(0.2,0.02,LANE_W),stopM,[ stopOff,0.1,0]);

  // Zebra crossings — between stop line and kerb
  const zc=INTER+2.2;
  function zebra(cx,cz,isH){
    for(let i=-3;i<=3;i++){
      const g=isH?new THREE.BoxGeometry(0.72,0.02,LANE_W*0.42):new THREE.BoxGeometry(LANE_W*0.42,0.02,0.72);
      addMesh(g,zebraM,isH?[cx+i*0.98,0.085,cz]:[cx,0.085,cz+i*0.98]);
    }
  }
  zebra(0,-zc,true); zebra(0,zc,true);
  zebra(-zc,0,false); zebra(zc,0,false);

  // Corner streetlights on sidewalk
  const lOff=LANE_W/2+1.5;
  [[-lOff,-lOff],[lOff,-lOff],[-lOff,lOff],[lOff,lOff]].forEach(([lx,lz])=>{
    addMesh(new THREE.CylinderGeometry(0.09,0.11,5,8),new THREE.MeshLambertMaterial({color:0x1e2a3a}),[lx,2.5,lz]);
    addMesh(new THREE.SphereGeometry(0.25,8,8),new THREE.MeshBasicMaterial({color:0xfff0a0}),[lx,5.4,lz]);
    const pl=new THREE.PointLight(0xfff0a0,0.6,18);
    pl.position.set(lx,5.2,lz); scene.add(pl);
  });
}

// ═══════════════════════════════════════════════════
//  SIGNALS
// ═══════════════════════════════════════════════════
const signalGroups = {};
const SIG_POS = {
  // 'Road 1':{ x: LANE_W*0.5+0.6, z:-(INTER+1.0), ry:0           },
  // 'Road 2':{ x:  INTER+1.0,     z: LANE_W*0.5+0.6, ry:-Math.PI/2},
  // 'Road 3':{ x:-(LANE_W*0.5+0.6),z: INTER+1.0,  ry: Math.PI    },
  // 'Road 4':{ x:-(INTER+1.0),    z:-(LANE_W*0.5+0.6),ry:Math.PI/2},
  'Road 1':{ x:-(LANE_W*0.5+0.6),z: INTER+1.0,  ry: Math.PI    },
  'Road 2':{ x:-(INTER+1.0),    z:-(LANE_W*0.5+0.6),ry:Math.PI/2}, 
  'Road 3':{ x: LANE_W*0.5+0.6, z:-(INTER+1.0), ry:0           }, 
  'Road 4':{ x:  INTER+1.0,     z: LANE_W*0.5+0.6, ry:-Math.PI/2},
};

function buildSignals(){
  ROADS.forEach(road=>{
    const pos=SIG_POS[road.name];
    const g=new THREE.Group();
    const pMat=new THREE.MeshLambertMaterial({color:0x1c2838});

    // Pole
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.13,5,8),pMat);
    pole.position.y=2.5; pole.castShadow=true; g.add(pole);
    // Arm
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,2.2,6),pMat);
    arm.rotation.z=Math.PI/2; arm.position.set(-1.1,5,0); g.add(arm);
    // Housing
    const hous=new THREE.Mesh(new THREE.BoxGeometry(0.58,1.65,0.42),
      new THREE.MeshLambertMaterial({color:0x070b0f}));
    hous.position.set(-2.0,4.2,0); g.add(hous);
    // Top visor
    const visor=new THREE.Mesh(new THREE.BoxGeometry(0.64,0.14,0.58),
      new THREE.MeshLambertMaterial({color:0x0a0e14}));
    visor.position.set(-2.0,5.04,0.1); g.add(visor);

    // Bulbs: [red, yellow, green] top to bottom
    const bulbYs=[4.62,4.2,3.78];
    const onCols=[0xff2020,0xffcc00,0x20ee55];
    const offCols=[0x3a0606,0x282200,0x062206];
    const lights=[];
    bulbYs.forEach((by,i)=>{
      const mat=new THREE.MeshBasicMaterial({color:offCols[i]});
      const b=new THREE.Mesh(new THREE.SphereGeometry(0.19,12,12),mat);
      b.position.set(-2.0,by,0.22); g.add(b);
      const rMat=new THREE.MeshBasicMaterial({color:onCols[i],opacity:0,transparent:true});
      const ring=new THREE.Mesh(new THREE.TorusGeometry(0.23,0.04,8,24),rMat);
      ring.position.set(-2.0,by,0.22); ring.rotation.x=Math.PI/2; g.add(ring);
      lights.push({mat,rMat,onCol:onCols[i],offCol:offCols[i]});
    });

    g.position.set(pos.x,0,pos.z);
    g.rotation.y=pos.ry;
    scene.add(g);
    signalGroups[road.name]={red:lights[0],yellow:lights[1],green:lights[2]};
  });
}

function setSignal(roadName,state){
  signalState[roadName]=state;
  const sg=signalGroups[roadName];
  if(!sg) return;
  const order=['red','yellow','green'];
  order.forEach((k,i)=>{
    const l=sg[k];
    const on=(k===state);
    l.mat.color.setHex(on?l.onCol:l.offCol);
    l.rMat.opacity=on?0.6:0;
  });
  updateSigCard(roadName,state);
}

// ═══════════════════════════════════════════════════
//  VEHICLE FACTORY
// ═══════════════════════════════════════════════════
const V_COLS={
  car:      [0x1e3a8a,0xb91c1c,0xfbbf24,0x166534,0x6b21a8,0xd1d5db,0x0369a1,0x92400e],
  motorcycle:[0x111827,0x292524,0x1e1b4b,0x4a1d1d,0x083344],
  bus:      [0xca8a04,0xdc2626,0x1d4ed8,0x166534,0x7c3aed],
  bicycle:  [0xd97706,0x7c3aed,0xdb2777,0x0369a1],
  ambulance:[0xffffff],
  pedestrian:[0xf472b6,0x60a5fa,0x34d399,0xfb923c,0xa78bfa,0xfdba74],
};
function rndC(k){const a=V_COLS[k];return a[Math.floor(Math.random()*a.length)];}

function mkMesh(geo,mat,pos=[0,0,0]){
  const m=new THREE.Mesh(geo,mat);
  m.position.set(...pos);
  return m;
}

function buildVehicleMesh(vtKey, roadDir){
  const vt=VTYPES.find(v=>v.key===vtKey);
  const col=rndC(vtKey);
  const g=new THREE.Group();

  if(vtKey==='pedestrian'){
    const mat=new THREE.MeshLambertMaterial({color:col});
    const body=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.24,1.1,8),mat);
    body.position.y=0.55; body.castShadow=true; g.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.24,8,8),mat);
    head.position.y=1.38; g.add(head);
    [-1,1].forEach(s=>{
      const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.65,6),mat);
      arm.rotation.z=s*0.55; arm.position.set(s*0.32,0.78,0); g.add(arm);
    });
  } else {
    const bMat=new THREE.MeshLambertMaterial({color:col});
    const body=new THREE.Mesh(new THREE.BoxGeometry(vt.w,vt.h*0.65,vt.l),bMat);
    body.position.y=vt.h*0.37; body.castShadow=true; g.add(body);

    if(vtKey==='car'){
      const cabMat=new THREE.MeshLambertMaterial({color:0x0f172a});
      const cab=mkMesh(new THREE.BoxGeometry(vt.w*0.82,vt.h*0.5,vt.l*0.52),cabMat,[0,vt.h*0.69,-0.12]);
      cab.castShadow=true; g.add(cab);
      g.add(mkMesh(new THREE.BoxGeometry(vt.w*0.8,vt.h*0.42,0.06),
        new THREE.MeshLambertMaterial({color:0x7dd3fc,opacity:0.4,transparent:true}),
        [0,vt.h*0.69,vt.l*0.52/2-0.12]));
      addWheels(g,vt,0.26,0.18);
    } else if(vtKey==='bus'||vtKey==='ambulance'){
      // Windows
      g.add(mkMesh(new THREE.BoxGeometry(0.06,vt.h*0.28,vt.l*0.72),
        new THREE.MeshLambertMaterial({color:0x7dd3fc,opacity:0.32,transparent:true}),
        [vt.w/2+0.02,vt.h*0.56,0]));
      if(vtKey==='ambulance'){
        // Red cross
        g.add(mkMesh(new THREE.BoxGeometry(0.07,vt.h*0.3,vt.h*0.1),
          new THREE.MeshBasicMaterial({color:0xff2020}), [vt.w/2+0.02,vt.h*0.58,0]));
        g.add(mkMesh(new THREE.BoxGeometry(0.07,vt.h*0.1,vt.h*0.3),
          new THREE.MeshBasicMaterial({color:0xff2020}), [vt.w/2+0.02,vt.h*0.58,0]));
        // Siren
        g.add(mkMesh(new THREE.BoxGeometry(0.5,0.18,0.22),
          new THREE.MeshBasicMaterial({color:0x0088ff}), [0,vt.h+0.08,0]));
      }
      addWheels(g,vt,0.4,0.22);
    } else if(vtKey==='motorcycle'){
      const wMat=new THREE.MeshLambertMaterial({color:0x111111});
      [-vt.l/2+0.12,vt.l/2-0.12].forEach(wz=>{
        g.add(mkMesh(new THREE.TorusGeometry(0.35,0.1,8,16),wMat,[0,0.35,wz]));
      });
      g.add(mkMesh(new THREE.BoxGeometry(0.85,0.07,0.12),bMat,[0,vt.h*0.82,-vt.l*0.38]));
    } else if(vtKey==='bicycle'){
      const wMat=new THREE.MeshLambertMaterial({color:0x374151});
      [-vt.l/2+0.1,vt.l/2-0.1].forEach(wz=>{
        g.add(mkMesh(new THREE.TorusGeometry(0.28,0.055,6,14),wMat,[0,0.28,wz]));
      });
    }

    // Headlights & taillights
    const hlm=new THREE.MeshBasicMaterial({color:0xfff8e0,opacity:0.9,transparent:true});
    const tlm=new THREE.MeshBasicMaterial({color:0xff2020,opacity:0.85,transparent:true});
    const hw=Math.min(0.38,vt.w*0.22);
    [-hw,hw].forEach(hx=>{
      g.add(mkMesh(new THREE.BoxGeometry(0.24,0.13,0.06),hlm,[hx,vt.h*0.4,-vt.l/2-0.02]));
      g.add(mkMesh(new THREE.BoxGeometry(0.2,0.11,0.06),tlm,[hx,vt.h*0.4, vt.l/2+0.02]));
    });
  }

  const rot={north:0,south:Math.PI,east:-Math.PI/2,west:Math.PI/2};
  g.rotation.y=rot[roadDir]||0;
  return g;
}

function addWheels(g,vt,r,hw){
  const wm=new THREE.MeshLambertMaterial({color:0x111111});
  [[vt.w/2+0.06,-vt.l*0.3],[vt.w/2+0.06,vt.l*0.3],[-vt.w/2-0.06,-vt.l*0.3],[-vt.w/2-0.06,vt.l*0.3]]
  .forEach(([wx,wz])=>{
    const w=new THREE.Mesh(new THREE.CylinderGeometry(r,r,hw,10),wm);
    w.rotation.z=Math.PI/2; w.position.set(wx,r,wz); g.add(w);
  });
}

// ═══════════════════════════════════════════════════
//  SPAWN & SIMULATE VEHICLES
// ═══════════════════════════════════════════════════
function spawnVehicle(roadName, vtKey){
  const road=ROADS.find(r=>r.name===roadName);
  if(!road) return;
  const cfg=ROAD_CFG[road.dir];
  const vt=VTYPES.find(v=>v.key===vtKey);
  const mesh=buildVehicleMesh(vtKey,road.dir);

  if(vt.isPed){
    // Pedestrian: spawn at edge of road, walk perpendicular across zebra
    const zb=ZEBRA[road.dir];
    const walkAxis=zb.walkAxis; // 'x' or 'z'
    const pedDir=1; // will walk in +axis direction
    const lateral=(Math.random()-0.5)*LANE_W*0.35;
    let sx=zb.cx, sz=zb.cz;
    if(walkAxis==='x'){ sx=-(LANE_W/2+0.6); sz+=lateral; }
    else              { sz=-(LANE_W/2+0.6); sx+=lateral; }
    mesh.position.set(sx,0,sz);
    scene.add(mesh);
    vehicles.push({
      mesh,roadName,vtKey,
      isPed:true, walkAxis, pedDir,
      exitCoord: LANE_W/2+0.6,
      speed:1.1+Math.random()*0.5,
      crossedSignal:false,
      cleared:false, removing:false, removeTimer:0, dead:false
    });
    return;
  }

  // Queue stagger: space out vehicles behind each other
  const queued=vehicles.filter(v=>v.roadName===roadName&&!v.removing&&!v.dead&&!v.isPed).length;
  const stagger=queued*(cfg.dir<0?4.8:-4.8);

  const lateral=cfg.laneOff+(Math.random()-0.5)*0.5;
  let sx,sz;
  if(cfg.axis==='z'){ sx=lateral; sz=cfg.spawnC+stagger; }
  else               { sx=cfg.spawnC+stagger; sz=lateral; }

  mesh.position.set(sx,0,sz);
  scene.add(mesh);
  vehicles.push({
    mesh,roadName,vtKey,
    isPed:false, isAmbu:vt.isAmbu,
    axis:cfg.axis, dir:cfg.dir,
    stopLine:cfg.stopC, exitCoord:cfg.exitC,
    speed:4.0+Math.random()*1.6,
    crossedSignal:false,
    cleared:false, removing:false, removeTimer:0, dead:false
  });
}

function updateVehicles(dt){
  // Check if any pedestrian is actively crossing
  const activePed = vehicles.some(v => v.isPed && !v.removing && !v.dead);
  if(activePed){
    // Force all non-green signals to red (keep in sync)
    ROADS.forEach(r=>{ if(signalState[r.name]==='green') setSignal(r.name,'red'); });
    document.getElementById('active-road-label').textContent='🚶 PED PRIORITY — ALL RED';
  }

  vehicles.forEach(v=>{
    if(v.dead) return;
    if(v.removing){ v.removeTimer+=dt; if(v.removeTimer>0.5){scene.remove(v.mesh);v.dead=true;} return; }

    if(v.isPed){ updatePed(v,dt); return; }

    const pastStopLine=(v.dir===1)?((v.axis==='z'?v.mesh.position.z:v.mesh.position.x)>v.stopLine):((v.axis==='z'?v.mesh.position.z:v.mesh.position.x)<v.stopLine);
    const green=signalState[v.roadName]==='green'||v.isAmbu||pastStopLine;
    // const green=signalState[v.roadName]==='green'||v.isAmbu;
    const pos=v.mesh.position;
    const cur=(v.axis==='z')?pos.z:pos.x;
    const ahead=distAhead(v);
    const MIN_GAP=5.2;

    if(!green){
      const dStop=(v.stopLine-cur)*v.dir;
      if(dStop<=1.25||ahead<MIN_GAP) return;
      const slow=dStop<6?Math.max(0.03,dStop/6):1;
      moveV(v,dt,Math.min(slow,ahead<10?ahead/10:1));
    } else {
      if(ahead<MIN_GAP){ moveV(v,dt,Math.max(0.04,(ahead-1.8)/MIN_GAP)); }
      else              { moveV(v,dt,1); }
    }

    // Decrement PCU after vehicle clears the opposite zebra crossing
    const newCur=(v.axis==='z')?pos.z:pos.x;
    if(!v.crossedSignal){
      const oppositeZebra=(INTER+2.2)*v.dir;  // +7.2 for dir=+1, -7.2 for dir=-1
      const pastZebra=(v.dir===1)?newCur>oppositeZebra:newCur<oppositeZebra;
      if(pastZebra){
        v.crossedSignal=true;
        if(vehicleCounts[v.roadName][v.vtKey]>0){
          vehicleCounts[v.roadName][v.vtKey]--;
          refreshCounts(); recalcPCU(); renderResults();
        }
        passedTotal++;
        document.getElementById('passed-count').textContent=passedTotal;
      }
    }

    // Reached far end of opposite arm?
    const pastExit=(v.dir===1)?newCur>=v.exitCoord:newCur<=v.exitCoord;
    if(pastExit&&!v.removing){ v.cleared=true; v.removing=true; }
  });
  vehicles=vehicles.filter(v=>!v.dead);
}

function moveV(v,dt,f=1){
  const s=v.speed*dt*f;
  if(v.axis==='z') v.mesh.position.z+=v.dir*s;
  else             v.mesh.position.x+=v.dir*s;
}

function distAhead(v){
  const cur=(v.axis==='z')?v.mesh.position.z:v.mesh.position.x;
  let min=9999;
  vehicles.forEach(o=>{
    if(o===v||o.roadName!==v.roadName||o.removing||o.dead||o.isPed) return;
    const oc=(o.axis==='z')?o.mesh.position.z:o.mesh.position.x;
    const d=(oc-cur)*v.dir;
    if(d>0&&d<min) min=d;
  });
  return min;
}

function updatePed(v,dt){
  const spd=v.speed*dt;
  if(v.walkAxis==='x') v.mesh.position.x+=v.pedDir*spd;
  else                 v.mesh.position.z+=v.pedDir*spd;

  const cur=(v.walkAxis==='x')?v.mesh.position.x:v.mesh.position.z;
  if(!v.crossedSignal&&cur>=(v.exitCoord-1.0)){
    v.crossedSignal=true;
    if(vehicleCounts[v.roadName]['pedestrian']>0){
      vehicleCounts[v.roadName]['pedestrian']--;
      refreshCounts(); recalcPCU(); renderResults();
    }
    passedTotal++;
    document.getElementById('passed-count').textContent=passedTotal;
  }
  if(cur>=v.exitCoord||cur<=-v.exitCoord) v.removing=true;
}

// ═══════════════════════════════════════════════════
//  SIGNAL LOGIC (all front-end, mirrors backend.txt)
// ═══════════════════════════════════════════════════
function calcPCU(roadName){
  const c=vehicleCounts[roadName];
  let pcu=0;
  VTYPES.forEach(vt=>{
    if(vt.isPed) return;
    pcu+=(c[vt.key]||0)*vt.pcuW;
  });
  pcu+=(c['pedestrian']||0)*0.1;
  return Math.round(pcu*100)/100;
}

function recalcPCU(){
  ROADS.forEach(r=>roadPCU[r.name]=calcPCU(r.name));
}

// Track which ambulance road was last green for alternation
let lastAmbuGreen = null;

function decideGreen(){
  // Manual override wins
  const mo=Object.entries(manualOverride).find(([,v])=>v==='green');
  if(mo) return mo[0];

  // Pedestrian HIGHEST priority — even beats ambulance
  // If ANY pedestrian is actively on the road (in vehicles array), all roads go red
  const activePed = vehicles.some(v => v.isPed && !v.removing && !v.dead);
  if(activePed) return null; // null → all yellow/red handled below

  // Ambulance priority — if multiple, pick the one closest to intersection
  const ambuRoads = ROADS.filter(r => (vehicleCounts[r.name]['ambulance']||0) > 0);
  if(ambuRoads.length > 0){
    if(ambuRoads.length === 1) return ambuRoads[0].name;
    // Multiple ambulances: find closest ambulance to stop line per road
    let bestRoad = null, bestDist = Infinity;
    ambuRoads.forEach(r => {
      const cfg = ROAD_CFG[r.dir || ROADS.find(rd=>rd.name===r.name).dir];
      const ambuVehicles = vehicles.filter(v => v.roadName===r.name && v.vtKey==='ambulance' && !v.dead && !v.removing);
      if(ambuVehicles.length === 0){ return; }
      const closest = ambuVehicles.reduce((best, v) => {
        const cur = (v.axis==='z') ? v.mesh.position.z : v.mesh.position.x;
        const d = Math.abs(cur - v.stopLine);
        return d < best.d ? {d, v} : best;
      }, {d: Infinity, v: null});
      if(closest.d < bestDist){
        // Don't give same road green twice in a row if another ambulance is waiting
        if(ambuRoads.length > 1 && lastAmbuGreen === r.name) return;
        bestDist = closest.d; bestRoad = r.name;
      }
    });
    if(!bestRoad) bestRoad = ambuRoads.find(r => r.name !== lastAmbuGreen)?.name || ambuRoads[0].name;
    lastAmbuGreen = bestRoad;
    return bestRoad;
  }

  // All empty → null (all yellow)
  const total=ROADS.reduce((s,r)=>s+roadPCU[r.name],0);
  if(total===0) return null;
  // Highest PCU
  let best=null,bestP=-1;
  ROADS.forEach(r=>{ if(roadPCU[r.name]>bestP){bestP=roadPCU[r.name];best=r.name;} });
  return best;
}

function currentGreen(){ return ROADS.find(r=>signalState[r.name]==='green')?.name||null; }

function calcDurations(){
  const total=ROADS.reduce((s,r)=>s+roadPCU[r.name],0)||1;
  // Real-time: max green = 30s, min = 5s, scaled by share of traffic
  const CYCLE=60;
  ROADS.forEach(r=>{
    cycleDurations[r.name]=Math.max(5,Math.round((roadPCU[r.name]/total)*CYCLE));
  });
}

function doSwitchGreen(roadName){
  const activePed = vehicles.some(v => v.isPed && !v.removing && !v.dead);
  if(!roadName){
    if(activePed){
      ROADS.forEach(r=>setSignal(r.name,'red'));
      document.getElementById('active-road-label').textContent='🚶 PED PRIORITY — ALL RED';
    } else {
      ROADS.forEach(r=>setSignal(r.name,'yellow'));
      document.getElementById('active-road-label').textContent='ALL CLEAR';
    }
    return;
  }
  ROADS.forEach(r=>setSignal(r.name,r.name===roadName?'green':'red'));
  document.getElementById('active-road-label').textContent='🟢 '+roadName;
  cycleTimer=cycleDurations[roadName]||15;
  renderResults();
}

function tickCycle(dt){
  if(inYellow){
    yellowTimer-=dt;
    document.getElementById('cycle-timer').textContent='⚡ '+Math.ceil(Math.max(0,yellowTimer))+'s';
    if(yellowTimer<=0){ inYellow=false; doSwitchGreen(yellowToRoad); }
    return;
  }

  // If current green road's PCU dropped to 0, expire immediately
  const cur = currentGreen();
  if(cur && roadPCU[cur] === 0){
    cycleTimer = 0;
  }

  cycleTimer-=dt;
  document.getElementById('cycle-timer').textContent=Math.ceil(Math.max(0,cycleTimer))+'s';

  if(cycleTimer<=0){
    recalcPCU(); calcDurations();
    const desired=decideGreen();

    if(desired===null){
      const activePed = vehicles.some(v => v.isPed && !v.removing && !v.dead);
      if(activePed){
        ROADS.forEach(r=>setSignal(r.name,'red'));
        document.getElementById('active-road-label').textContent='🚶 PED PRIORITY — ALL RED';
        cycleTimer=2; return;
      }
      ROADS.forEach(r=>setSignal(r.name,'yellow'));
      document.getElementById('active-road-label').textContent='ALL CLEAR — YELLOW';
      cycleTimer=4; return;
    }
    if(desired===cur){
      // Same road still best — extend only if PCU > 0, else switch
      if(roadPCU[cur] > 0){
        cycleTimer=cycleDurations[desired]||10; return;
      }
    }

    // Transition via yellow
    if(cur){ setSignal(cur,'yellow'); }
    inYellow=true; yellowTimer=YELLOW_DUR; yellowToRoad=desired;
    // Keep other roads red during yellow
    ROADS.forEach(r=>{ if(r.name!==cur) setSignal(r.name,'red'); });
  }
}

function runAnalysis(){
  recalcPCU(); calcDurations(); cycleTimer=0;
  vehicles.forEach(v=>{
    if(!v.isPed && v.crossedSignal && !v.cleared && !v.removing){
      v.crossedSignal = false;
    }
  });
  renderResults();
}

// ═══════════════════════════════════════════════════
//  CAMERA
// ═══════════════════════════════════════════════════
let mouseDown=false,lastMouse={x:0,y:0};
let camTheta=0.85,camPhi=0.52,camR=42;
function updateCamera(){
  camera.position.x=camR*Math.sin(camTheta)*Math.sin(camPhi);
  camera.position.y=camR*Math.cos(camPhi);
  camera.position.z=camR*Math.cos(camTheta)*Math.sin(camPhi);
  camera.lookAt(0,0,0);
}
document.addEventListener('mousedown',e=>{if(e.target!==canvas)return;mouseDown=true;lastMouse={x:e.clientX,y:e.clientY};});
document.addEventListener('mouseup',()=>mouseDown=false);
document.addEventListener('mousemove',e=>{
  if(!mouseDown)return;
  camTheta-=(e.clientX-lastMouse.x)*0.007;
  camPhi=Math.max(0.1,Math.min(1.4,camPhi+(e.clientY-lastMouse.y)*0.007));
  lastMouse={x:e.clientX,y:e.clientY}; updateCamera();
});
document.addEventListener('wheel',e=>{
  camR=Math.max(12,Math.min(75,camR+e.deltaY*0.06)); updateCamera();
},{passive:true});
let lastTouch=null;
document.addEventListener('touchstart',e=>{lastTouch={x:e.touches[0].clientX,y:e.touches[0].clientY};});
document.addEventListener('touchmove',e=>{
  if(!lastTouch)return;
  camTheta-=(e.touches[0].clientX-lastTouch.x)*0.009;
  camPhi=Math.max(0.1,Math.min(1.4,camPhi+(e.touches[0].clientY-lastTouch.y)*0.009));
  lastTouch={x:e.touches[0].clientX,y:e.touches[0].clientY}; updateCamera();
},{passive:true});

// ═══════════════════════════════════════════════════
//  UI
// ═══════════════════════════════════════════════════
function rid(n){return n.replace(/\s+/g,'-');}

function buildUI(){
  buildVehiclePalette();
  buildUploadZones();
  buildSignalCards();
  ROADS.forEach(r=>setSignal(r.name,'red'));
  updateCamera();
}

function buildVehiclePalette(){
  const pal=document.getElementById('vehicle-palette');
  pal.innerHTML='';
  ROADS.forEach(road=>{
    const sec=document.createElement('div');
    sec.className='palette-section';
    sec.innerHTML=`
      <div class="palette-road-label">
        <div class="palette-dot" style="background:${road.hex}"></div>
        ${road.name}
        <span class="road-badge" id="rt-${rid(road.name)}">0</span>
      </div>
      <div class="vehicle-grid">
        ${VTYPES.map(v=>`
          <div class="veh-btn-wrap">
            <div class="veh-icon-row">
              <button class="veh-minus" onclick="changeVehicle('${road.name}','${v.key}',-1)">−</button>
              <div class="veh-center">
                <div class="vicon">${v.icon}</div>
                <div class="vlabel">${v.label}</div>
                <div class="vcount" id="vc-${rid(road.name)}-${v.key}"></div>
              </div>
              <button class="veh-plus" onclick="changeVehicle('${road.name}','${v.key}',1)">+</button>
            </div>
          </div>`).join('')}
      </div>`;
    pal.appendChild(sec);
  });
}

function buildUploadZones(){
  document.getElementById('upload-zones').innerHTML=ROADS.map(road=>`
    <div style="margin-bottom:8px;">
      <div style="font-size:9px;font-family:var(--mono);color:${road.hex};margin-bottom:3px;letter-spacing:.7px;">${road.name}</div>
      <div class="upload-zone">
        <input type="file" accept="image/*" onchange="fileSelected('${road.name}',this)"/>
        <div class="upload-zone-txt"><strong>Click to upload</strong> road image</div>
        <div class="upload-loaded" id="ul-${rid(road.name)}" style="display:none;"></div>
      </div>
    </div>`).join('');
}

function buildSignalCards(){
  document.getElementById('signal-override-grid').innerHTML=ROADS.map(road=>`
    <div class="sig-card" id="sigcard-${rid(road.name)}" onclick="toggleOverride('${road.name}')"
         title="Click to manually toggle this signal">
      <div class="sc-name" style="color:${road.hex}">${road.name}</div>
      <div class="sc-lights">
        <div class="sc-dot r on"  id="scd-r-${rid(road.name)}"></div>
        <div class="sc-dot y"     id="scd-y-${rid(road.name)}"></div>
        <div class="sc-dot g"     id="scd-g-${rid(road.name)}"></div>
      </div>
      <div class="sc-override" id="scov-${rid(road.name)}">AUTO</div>
    </div>`).join('');
}

function updateSigCard(roadName,state){
  const r=rid(roadName);
  const dr=document.getElementById(`scd-r-${r}`);
  const dy=document.getElementById(`scd-y-${r}`);
  const dg=document.getElementById(`scd-g-${r}`);
  if(!dr)return;
  dr.className='sc-dot r'+(state==='red'?' on':'');
  dy.className='sc-dot y'+(state==='yellow'?' on':'');
  dg.className='sc-dot g'+(state==='green'?' on':'');
}

function toggleOverride(roadName){
  if(manualOverride[roadName]){
    delete manualOverride[roadName];
    document.getElementById(`sigcard-${rid(roadName)}`).classList.remove('manual-override');
    document.getElementById(`scov-${rid(roadName)}`).textContent='AUTO';
  } else {
    const cur=signalState[roadName];
    const next=cur==='green'?'red':'green';
    if(next==='green'){
      // Clear other manual greens
      ROADS.forEach(r=>{
        if(r.name!==roadName&&manualOverride[r.name]==='green'){
          delete manualOverride[r.name];
          document.getElementById(`sigcard-${rid(r.name)}`).classList.remove('manual-override');
          document.getElementById(`scov-${rid(r.name)}`).textContent='AUTO';
        }
      });
      ROADS.forEach(r=>setSignal(r.name,r.name===roadName?'green':'red'));
    } else {
      setSignal(roadName,'red');
    }
    manualOverride[roadName]=next;
    document.getElementById(`sigcard-${rid(roadName)}`).classList.add('manual-override');
    document.getElementById(`scov-${rid(roadName)}`).textContent='MANUAL';
    cycleTimer=0;
  }
}

function changeVehicle(roadName,vtKey,delta){
  const cur=vehicleCounts[roadName][vtKey]||0;
  const nv=Math.max(0,cur+delta);
  vehicleCounts[roadName][vtKey]=nv;
  if(delta>0) for(let i=0;i<delta;i++) spawnVehicle(roadName,vtKey);
  refreshCounts(); recalcPCU(); runAnalysis();
}

function refreshCounts(){
  let total=0;
  ROADS.forEach(road=>{
    let rt=0;
    VTYPES.forEach(v=>{
      const c=vehicleCounts[road.name][v.key]||0;
      rt+=c;
      const el=document.getElementById(`vc-${rid(road.name)}-${v.key}`);
      if(el) el.textContent=c>0?c:'';
    });
    total+=rt;
    const el=document.getElementById(`rt-${rid(road.name)}`);
    if(el) el.textContent=rt;
  });
  document.getElementById('total-veh-count').textContent=total;
}

function renderResults(){
  const green=currentGreen();
  const maxP=Math.max(...ROADS.map(r=>roadPCU[r.name]),1);
  const sorted=[...ROADS].sort((a,b)=>roadPCU[b.name]-roadPCU[a.name]);
  let html='';
  sorted.forEach((road,i)=>{
    const pcu=roadPCU[road.name];
    const isG=road.name===green;
    const sig=signalState[road.name];
    const sc=sig==='green'?'var(--green)':sig==='yellow'?'var(--yellow)':'var(--red)';
    const ambu=(vehicleCounts[road.name]['ambulance']||0)>0;
    const bar=Math.round((pcu/maxP)*100);
    html+=`<div class="result-road" style="${ambu?'border-color:rgba(255,80,80,0.45)':''}">
      <div class="result-road-top">
        <div style="width:9px;height:9px;border-radius:50%;flex-shrink:0;background:${sc};box-shadow:0 0 6px ${sc};"></div>
        <div class="result-road-name" style="color:${road.hex}">${road.name}</div>
        <div style="font-size:9px;font-family:var(--mono);color:${sc};">${isG?'🟢 GO':sig==='yellow'?'🟡 WAIT':'🔴 STOP'}</div>
      </div>
      <div class="result-bar-wrap">
        <div class="result-bar" style="width:${bar}%;background:${isG?'rgba(34,213,90,0.5)':'rgba(239,68,68,0.3)'};"></div>
      </div>
      <div class="result-meta">
        <span>PCU: ${pcu.toFixed(1)}</span>
        <span>${ambu?'🚑 PRIORITY':'Rank #'+(i+1)}</span>
      </div>
    </div>`;
  });
  document.getElementById('results-panel').innerHTML=html||'<div class="empty-result">No vehicles.</div>';
}

// ═══════════════════════════════════════════════════
//  UPLOAD & ONNX DETECTION
// ═══════════════════════════════════════════════════
async function loadONNX(){
  if(typeof ort==='undefined') return;
  try {
    ortSession=await ort.InferenceSession.create('./yolov8n.onnx',{executionProviders:['wasm']});
    console.log('ONNX model loaded');
  } catch(e){ console.log('yolov8n.onnx not found — using heuristic fallback'); }
}

function fileSelected(roadName,input){
  if(!input.files[0]) return;
  uploadedFiles[roadName]=input.files[0];
  const fname=input.files[0].name;
  const el=document.getElementById(`ul-${rid(roadName)}`);
  if(el){ el.textContent='✓ '+(fname.length>28?fname.slice(0,25)+'…':fname); el.style.display='block'; }
}

async function runAllUploads(){
  const btn=document.getElementById('detect-btn');
  btn.textContent='⏳ Detecting…'; btn.style.opacity='0.65'; btn.style.pointerEvents='none';

  for(const road of ROADS){
    if(!uploadedFiles[road.name]) continue;
    const counts=await detectVehiclesInImage(uploadedFiles[road.name]);
    // Merge detected into vehicleCounts; spawn delta
    VTYPES.forEach(vt=>{
      const detected=counts[vt.key]||0;
      const cur=vehicleCounts[road.name][vt.key]||0;
      const diff=Math.max(0,detected-cur);
      vehicleCounts[road.name][vt.key]=detected;
      for(let i=0;i<diff;i++) spawnVehicle(road.name,vt.key);
    });
  }

  refreshCounts(); recalcPCU(); runAnalysis();
  setTab('vehicles'); // let user adjust
  btn.textContent='🔬 DETECT ALL & OPTIMIZE';
  btn.style.opacity=''; btn.style.pointerEvents='';
}

async function detectVehiclesInImage(file){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=async()=>{
      if(ortSession) resolve(await runONNX(img));
      else           resolve(heuristic(img));
    };
    img.src=URL.createObjectURL(file);
  });
}

async function runONNX(img){
  const S=640;
  const c=document.createElement('canvas'); c.width=c.height=S;
  const ctx=c.getContext('2d'); ctx.drawImage(img,0,0,S,S);
  const d=ctx.getImageData(0,0,S,S).data;
  const t=new Float32Array(3*S*S);
  for(let i=0;i<S*S;i++){t[i]=d[i*4]/255;t[i+S*S]=d[i*4+1]/255;t[i+S*S*2]=d[i*4+2]/255;}
  const inp=new ort.Tensor('float32',t,[1,3,S,S]);
  const out=await ortSession.run({images:inp});
  const p=out[Object.keys(out)[0]].data;
  const N=8400, CONF=0.3;
  const MAP={2:'car',3:'motorcycle',5:'bus',7:'bus',1:'bicycle',0:'pedestrian'};
  const counts={car:0,motorcycle:0,bus:0,bicycle:0,ambulance:0,pedestrian:0};
  for(let i=0;i<N;i++){
    let maxC=0,maxCls=0;
    for(let cl=0;cl<80;cl++){const v=p[4*N+cl*N+i];if(v>maxC){maxC=v;maxCls=cl;}}
    if(maxC<CONF) continue;
    const key=MAP[maxCls];
    if(key) counts[key]++;
  }
  return counts;
}

function heuristic(img){
  const c=document.createElement('canvas'); c.width=160;c.height=120;
  const ctx=c.getContext('2d'); ctx.drawImage(img,0,0,160,120);
  const d=ctx.getImageData(0,0,160,120).data;
  let edges=0;
  for(let y=1;y<119;y++) for(let x=1;x<159;x++){
    const i=(y*160+x)*4;
    const g=(d[i]+d[i+1]+d[i+2])/3;
    const gr=(d[i+4]+d[i+5]+d[i+6])/3;
    const gd=(d[(y+1)*160*4+x*4]+d[(y+1)*160*4+x*4+1]+d[(y+1)*160*4+x*4+2])/3;
    if(Math.abs(g-gr)>28||Math.abs(g-gd)>28) edges++;
  }
  const density=edges/(160*120);
  return{car:Math.round(density*70),motorcycle:Math.round(density*20),
         bus:Math.round(density*5),bicycle:0,ambulance:0,pedestrian:Math.round(density*12)};
}

// ═══════════════════════════════════════════════════
//  MISC
// ═══════════════════════════════════════════════════
function setTab(t){
  ['vehicles','upload','results'].forEach(n=>{
    document.getElementById(`tab-${n}`).classList.toggle('active',n===t);
    document.getElementById(`tab-body-${n}`).classList.toggle('active',n===t);
  });
}

function togglePause(){
  paused=!paused;
  const btn=document.getElementById('pause-btn');
  btn.textContent=paused?'▶ RESUME':'⏸ PAUSE';
  btn.classList.toggle('paused',paused);
}

function toggleSidebar() {
  const panel = document.getElementById('sidepanel');
  const btn   = document.getElementById('sidebar-toggle');
  const closed = panel.classList.toggle('closed');
  btn.classList.toggle('closed', closed);
  setTimeout(resize, 380);
}

function randomiseTraffic() {
  // Clear all existing vehicles from scene
  vehicles.forEach(v => { if(v.mesh) scene.remove(v.mesh); });
  vehicles = [];

  // Randomly assign counts for each road & vehicle type
  ROADS.forEach(road => {
    VTYPES.forEach(vt => {
      let max = vt.isAmbu ? 1 : vt.isPed ? 6 : 8;
      // Ambulance: 15% chance of appearing (0 or 1)
      const count = vt.isAmbu
        ? (Math.random() < 0.15 ? 1 : 0)
        : Math.floor(Math.random() * (max + 1));
      vehicleCounts[road.name][vt.key] = count;
      for (let i = 0; i < count; i++) spawnVehicle(road.name, vt.key);
    });
  });

  refreshCounts();
  recalcPCU();
  runAnalysis();
}

function resize(){
  const W=window.innerWidth,H=window.innerHeight;
  camera.aspect=W/H; camera.updateProjectionMatrix(); renderer.setSize(W,H);
}
window.addEventListener('resize',resize); resize();

// ═══════════════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════════════
let lastT=performance.now();
function animate(){
  requestAnimationFrame(animate);
  const now=performance.now();
  const dt=Math.min((now-lastT)/1000,0.05);
  lastT=now;
  if(!paused){
    simTime+=dt;
    tickCycle(dt);
    updateVehicles(dt);
    document.getElementById('sim-time').textContent=Math.floor(simTime)+'s';
  }
  renderer.render(scene,camera);
}

// ═══════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════
buildWorld();
buildSignals();
buildUI();
recalcPCU();
calcDurations();
updateCamera();
animate();
loadONNX();

// Start with a brief yellow flash, then settle
ROADS.forEach(r=>setSignal(r.name,'yellow'));
document.getElementById('active-road-label').textContent='INITIALIZING…';

setTimeout(()=>{
  recalcPCU(); calcDurations();
  const g=decideGreen();
  doSwitchGreen(g);
  renderResults();
},2000);