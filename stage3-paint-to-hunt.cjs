const { Client } = require("@colyseus/sdk");
const fs = require("fs");

function arg(name, fallback=""){
  const i=process.argv.indexOf(`--${name}`);
  return i>=0 && process.argv[i+1] ? process.argv[i+1] : fallback;
}
function intArg(name,fallback){
  const n=Number(arg(name,String(fallback)));
  return Number.isFinite(n)?Math.max(1,Math.floor(n)):fallback;
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function rand(a,b){ return a+Math.random()*(b-a); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

const ROOM_ID=arg("room").trim();
const BOTS=Math.min(9,intArg("bots",9));
const PASSWORD=arg("password","");
const PROD="https://color-hunt-server.onrender.com";
let SERVER_URL=arg("url").trim();

if(!SERVER_URL){
  for(const f of [".env.local",".env.production",".env"]){
    if(!fs.existsSync(f)) continue;
    const text=fs.readFileSync(f,"utf8");
    const m=text.match(/^\s*VITE_MULTIPLAYER_URL\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);
    if(m){ SERVER_URL=m[1].trim(); break; }
  }
}
if(!SERVER_URL) SERVER_URL=PROD;
SERVER_URL=SERVER_URL.replace(/\/+$/,"");

if(!ROOM_ID){
  console.error("Room ID required.");
  process.exit(1);
}

const bots=[];
let shuttingDown=false;
function phase(room){ return String(room.state?.phase??"lobby"); }
function safeSend(room,type,payload={}){
  try { room.send(type,payload); return true; } catch { return false; }
}
async function health(){
  const r=await fetch(`${SERVER_URL}/hi`);
  if(!r.ok) throw new Error(`server health ${r.status}`);
  console.log("[server]",(await r.text()).slice(0,100));
}
async function shutdown(){
  if(shuttingDown) return;
  shuttingDown=true;
  console.log("\n[shutdown]");
  for(const b of bots) for(const t of b.timers||[]) clearInterval(t);
  await Promise.allSettled(bots.map(b=>b.room?.leave().catch(()=>{})));
  process.exit(0);
}
process.on("SIGINT",shutdown);
process.on("SIGTERM",shutdown);

async function joinBot(index){
  const client=new Client(SERVER_URL);
  const name=`LoadBot${String(index+1).padStart(2,"0")}`;
  const clientKey=`loadtest-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;
  const room=await client.joinById(ROOM_ID,{name,password:PASSWORD,clientKey});
  const bot={
    index,name,client,room,clientKey,timers:[],
    x:rand(120,1160),y:rand(100,620),
    vx:rand(-90,90)||55,vy:rand(-75,75)||45,
    paintSeq:0,paintStartedAt:0,paintReadySent:false,messages:0,
    reconnects:0
  };
  bots.push(bot);
  console.log(`[JOIN ${index+1}/${BOTS}] ${name} ${room.sessionId}`);
  room.onLeave(code=>console.log(`[LEAVE] ${name} code=${code}`));
  room.onError((code,msg)=>console.log(`[ERROR] ${name} ${code} ${msg??""}`));
  return bot;
}

function attachBaseLobbyReady(bot){
  bot.timers.push(setInterval(()=>{
    if(phase(bot.room)==="lobby") safeSend(bot.room,"lobby_ready",{ready:true});
  },1000));
}

function attachMovement(bot){
  bot.timers.push(setInterval(()=>{
    if(phase(bot.room)!=="hunt") return;
    const dt=.066;
    bot.x+=bot.vx*dt; bot.y+=bot.vy*dt;
    if(bot.x<70||bot.x>1210){bot.vx*=-1;bot.x=clamp(bot.x,70,1210);}
    if(bot.y<70||bot.y>650){bot.vy*=-1;bot.y=clamp(bot.y,70,650);}
    if(Math.random()<.015){bot.vx=clamp(bot.vx+rand(-30,30),-120,120);bot.vy=clamp(bot.vy+rand(-30,30),-100,100);}
    if(safeSend(bot.room,"move",{x:bot.x,y:bot.y})) bot.messages++;
  },66));
}

function makePaintStroke(bot, points=48){
  bot.paintSeq++;
  const cx=40+Math.sin(bot.paintSeq*.29+bot.index)*20;
  const cy=60+Math.cos(bot.paintSeq*.23+bot.index)*30;
  const pts=[];
  for(let i=0;i<points;i++){
    pts.push({
      x:clamp(Math.round(cx+Math.sin(i*.52+bot.paintSeq*.1)*13),0,79),
      y:clamp(Math.round(cy+Math.cos(i*.47+bot.paintSeq*.08)*18),0,119),
    });
  }
  return {
    targetSessionId: bot.room.sessionId,
    color: [0xff5252,0x4da6ff,0x54d98c,0xffd45c,0xbc65ff,0x55e6e6][bot.index%6],
    size: 4+(bot.index%3),
    shape: bot.index%2===0 ? "circle" : "square",
    points: pts,
  };
}

async function joinAll(setup){
  await health();
  for(let i=0;i<BOTS;i++){
    const b=await joinBot(i);
    attachBaseLobbyReady(b);
    setup(b);
    await sleep(180);
  }
  console.log(`\n[READY] ${BOTS} bots connected to ${ROOM_ID}`);
  console.log("Use your normal browser as host/player #10. Ctrl+C to stop.\n");
  setInterval(()=>{
    const ps={}; let sent=0,re=0;
    for(const b of bots){const p=phase(b.room);ps[p]=(ps[p]||0)+1;sent+=b.messages;re+=b.reconnects;}
    console.log(`[STAT] phases=${JSON.stringify(ps)} sent=${sent} reconnects=${re}`);
  },5000);
}

/* STAGE 3: bots Paint for 8s, then all send paint_ready within a narrow window.
   This stresses Paint -> Hunt transition while keeping actual paint snapshots. */
const PAINT_MS=intArg("paint-ms",8000);
function setup(bot){
  bot.timers.push(setInterval(()=>{
    if(phase(bot.room)!=="paint"){
      if(phase(bot.room)!=="paint"){ bot.paintStartedAt=0; bot.paintReadySent=false; }
      return;
    }
    if(!bot.paintStartedAt) bot.paintStartedAt=Date.now();

    if(Date.now()-bot.paintStartedAt < PAINT_MS){
      if(safeSend(bot.room,"paint_stroke",makePaintStroke(bot,48))) bot.messages++;
      return;
    }

    if(!bot.paintReadySent){
      bot.paintReadySent=true;
      const delay=bot.index*35;
      setTimeout(()=>{
        if(phase(bot.room)==="paint"){
          safeSend(bot.room,"paint_ready",{ready:true});
          console.log(`[PAINT READY] ${bot.name}`);
        }
      },delay);
    }
  },135+bot.index*3));
  attachMovement(bot);
}
joinAll(setup).catch(async e=>{console.error("[FATAL]",e);await shutdown();});
