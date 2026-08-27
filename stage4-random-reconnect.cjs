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

/* STAGE 4: Paint->Hunt capable bots + 2~3 random official token reconnects.
   We use the same SDK contract as the game: client.reconnect(reconnectionToken).
   The old Room is deliberately closed non-consensually, then recovered by token. */
const PAINT_MS=intArg("paint-ms",5000);
const CHAOS_BOTS=Math.min(3,Math.max(2,intArg("chaos-bots",3)));

async function forceTokenReconnect(bot){
  if(phase(bot.room)!=="hunt") return;
  const old=bot.room;
  const token=old.reconnectionToken;
  if(!token){console.log(`[RECONNECT SKIP] ${bot.name} no token`);return;}

  console.log(`[DROP] ${bot.name}`);
  try{
    /* Close transport without consent. This is closer to Wi-Fi loss than leave(). */
    old.connection?.close?.();
  }catch(e){
    console.log(`[DROP close warning] ${bot.name}`,String(e));
  }

  await sleep(700+Math.floor(rand(0,900)));

  try{
    const recovered=await bot.client.reconnect(token);
    bot.room=recovered;
    bot.reconnects++;
    console.log(`[RECONNECTED] ${bot.name} -> ${recovered.sessionId}`);
  }catch(e){
    console.log(`[RECONNECT FAILED] ${bot.name}`,String(e));
  }
}

function setup(bot){
  bot.timers.push(setInterval(()=>{
    if(phase(bot.room)!=="paint") return;
    if(!bot.paintStartedAt) bot.paintStartedAt=Date.now();
    if(Date.now()-bot.paintStartedAt<PAINT_MS){
      if(safeSend(bot.room,"paint_stroke",makePaintStroke(bot,32))) bot.messages++;
    }else if(!bot.paintReadySent){
      bot.paintReadySent=true;
      safeSend(bot.room,"paint_ready",{ready:true});
    }
  },180+bot.index*4));
  attachMovement(bot);
}

joinAll(setup).then(()=>{
  let fired=false;
  const watcher=setInterval(()=>{
    if(fired) return;
    if(bots.length===BOTS && bots.every(b=>phase(b.room)==="hunt")){
      fired=true;
      clearInterval(watcher);
      console.log(`[CHAOS] Hunt detected. Random reconnect test begins in 4s.`);
      setTimeout(async()=>{
        const picked=[...bots].sort(()=>Math.random()-.5).slice(0,CHAOS_BOTS);
        for(const b of picked){
          void forceTokenReconnect(b);
          await sleep(650);
        }
      },4000);
    }
  },500);
}).catch(async e=>{console.error("[FATAL]",e);await shutdown();});
