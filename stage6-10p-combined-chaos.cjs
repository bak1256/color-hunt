/*
 * COLOR HUNT - Stage 6 / 10P Combined Chaos
 *
 * Goal:
 *   9 real Colyseus bots + 1 real browser
 *   Paint load -> tight Paint READY -> Hunt movement ->
 *   3 near-simultaneous token reconnects -> recovery ->
 *   shotgun/sniper/Vulcan tactical traffic
 *
 * IMPORTANT:
 * - Network/server/state/reconnect stress only. Bots do not render Phaser/WebGL.
 * - Uses moderate gameplay-like rates; intentionally NOT a packet flood.
 * - Run from C:\Users\bak12\color-hunt
 *
 * Usage:
 *   node stage6-10p-combined-chaos.cjs --room ROOM_ID
 * Options:
 *   --bots 9
 *   --paint-ms 8000
 *   --chaos-bots 3
 *   --password PASSWORD
 *   --url https://color-hunt-server.onrender.com
 */

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
const PAINT_MS=intArg("paint-ms",8000);
const CHAOS_BOTS=Math.min(3,Math.max(2,intArg("chaos-bots",3)));
const PASSWORD=arg("password","");
const PROD="https://color-hunt-server.onrender.com";

let SERVER_URL=arg("url").trim();
if(!SERVER_URL){
  for(const f of [".env.local",".env.production",".env"]){
    if(!fs.existsSync(f)) continue;
    const text=fs.readFileSync(f,"utf8");
    const m=text.match(/^\s*VITE_MULTIPLAYER_URL\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);
    if(m){SERVER_URL=m[1].trim();break;}
  }
}
if(!SERVER_URL) SERVER_URL=PROD;
SERVER_URL=SERVER_URL.replace(/\/+$/,"");

if(!ROOM_ID){
  console.error("Room ID required.");
  console.error("Example: node stage6-10p-combined-chaos.cjs --room XI84s4ssq");
  process.exit(1);
}

const bots=[];
let shuttingDown=false;
let huntStartedAt=0;
let reconnectWaveStarted=false;
let tacticalWaveStarted=false;

function phase(room){ return String(room.state?.phase??"lobby"); }
function safeSend(room,type,payload={}){
  try { room.send(type,payload); return true; }
  catch { return false; }
}

function discoverVulcanMessages(){
  const file="src/network/MultiplayerClient.ts";
  if(!fs.existsSync(file)) return [];
  const text=fs.readFileSync(file,"utf8");
  return [...new Set(
    [...text.matchAll(/\.send\(\s*["'`]([^"'`]*vulcan[^"'`]*)["'`]/gi)]
      .map(m=>m[1])
  )];
}
const VULCAN=discoverVulcanMessages();

function makePaintStroke(bot, pointCount=64){
  bot.paintSeq++;
  const cx=40+Math.sin(bot.paintSeq*.29+bot.index)*20;
  const cy=60+Math.cos(bot.paintSeq*.23+bot.index)*30;
  const points=[];
  for(let i=0;i<pointCount;i++){
    points.push({
      x:clamp(Math.round(cx+Math.sin(i*.52+bot.paintSeq*.1)*13),0,79),
      y:clamp(Math.round(cy+Math.cos(i*.47+bot.paintSeq*.08)*18),0,119),
    });
  }
  return {
    targetSessionId:bot.room.sessionId,
    color:[0xff5252,0x4da6ff,0x54d98c,0xffd45c,0xbc65ff,0x55e6e6][bot.index%6],
    size:4+(bot.index%3),
    shape:bot.index%2===0?"circle":"square",
    points,
  };
}

async function health(){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetch(`${SERVER_URL}/hi`,{signal:controller.signal});
    if(!r.ok) throw new Error(`health HTTP ${r.status}`);
    console.log("[server]",(await r.text()).slice(0,100));
  }finally{clearTimeout(timer);}
}

async function joinBot(index){
  const client=new Client(SERVER_URL);
  const name=`ChaosBot${String(index+1).padStart(2,"0")}`;
  const clientKey=`stage6-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;
  const room=await client.joinById(ROOM_ID,{name,password:PASSWORD,clientKey});

  const bot={
    index,name,client,room,clientKey,timers:[],
    x:rand(120,1160),y:rand(100,620),
    vx:rand(-95,95)||60,vy:rand(-80,80)||50,
    paintSeq:0,paintStartedAt:0,paintReadySent:false,
    messages:0,reconnects:0,reconnectFailures:0,
  };
  bots.push(bot);
  console.log(`[JOIN ${index+1}/${BOTS}] ${name} session=${room.sessionId}`);
  room.onLeave(code=>console.log(`[LEAVE] ${name} code=${code}`));
  room.onError((code,msg)=>console.log(`[ERROR] ${name} ${code} ${msg??""}`));
  return bot;
}

function attachBehavior(bot){
  /* Lobby ready + Hunter volunteer. */
  bot.timers.push(setInterval(()=>{
    if(phase(bot.room)!=="lobby") return;
    safeSend(bot.room,"lobby_ready",{ready:true});
    safeSend(bot.room,"hunter_volunteer",{volunteer:true});
  },900+bot.index*25));

  /* Heavy-but-reasonable simultaneous Paint.
     64 pts / ~155ms / bot ~= 3.7k points/sec across 9 bots. */
  bot.timers.push(setInterval(()=>{
    if(phase(bot.room)!=="paint") return;

    if(!bot.paintStartedAt) bot.paintStartedAt=Date.now();

    if(Date.now()-bot.paintStartedAt<PAINT_MS){
      if(safeSend(bot.room,"paint_stroke",makePaintStroke(bot,64))){
        bot.messages++;
      }
      return;
    }

    if(!bot.paintReadySent){
      bot.paintReadySent=true;
      /* Tight 0-280ms READY wave rather than exact same millisecond. */
      setTimeout(()=>{
        if(phase(bot.room)==="paint"){
          safeSend(bot.room,"paint_ready",{ready:true});
          console.log(`[PAINT READY] ${bot.name}`);
        }
      },bot.index*35);
    }
  },150+bot.index*3));

  /* Existing game-like 15Hz movement. */
  bot.timers.push(setInterval(()=>{
    if(phase(bot.room)!=="hunt") return;
    const dt=.066;
    bot.x+=bot.vx*dt;
    bot.y+=bot.vy*dt;

    if(bot.x<70||bot.x>1210){
      bot.vx*=-1; bot.x=clamp(bot.x,70,1210);
    }
    if(bot.y<70||bot.y>650){
      bot.vy*=-1; bot.y=clamp(bot.y,70,650);
    }
    if(Math.random()<.02){
      bot.vx=clamp(bot.vx+rand(-35,35),-125,125);
      bot.vy=clamp(bot.vy+rand(-30,30),-105,105);
    }
    if(safeSend(bot.room,"move",{x:bot.x,y:bot.y})) bot.messages++;
  },66));

  /* Moderate shotgun stream. Server ignores unauthorized roles. */
  bot.timers.push(setInterval(()=>{
    if(phase(bot.room)!=="hunt" || !tacticalWaveStarted) return;
    const angle=rand(-Math.PI,Math.PI);
    safeSend(bot.room,"hunter_aim",{angle,range:150});
    safeSend(bot.room,"fire_shot",{angle});
    bot.messages+=2;
  },800+bot.index*65));

  /* Sparse sniper sequence. */
  bot.timers.push(setInterval(()=>{
    if(phase(bot.room)!=="hunt" || !tacticalWaveStarted) return;
    const x=rand(100,1180),y=rand(80,650);
    safeSend(bot.room,"sniper_toggle",{active:true});
    safeSend(bot.room,"sniper_aim",{x,y});
    setTimeout(()=>{
      if(phase(bot.room)==="hunt") safeSend(bot.room,"sniper_fire",{x,y});
    },220);
    bot.messages+=3;
  },5200+bot.index*260));

  /* Sparse Vulcan using current local message contracts. */
  if(VULCAN.length){
    bot.timers.push(setInterval(()=>{
      if(phase(bot.room)!=="hunt" || !tacticalWaveStarted) return;
      const x=rand(100,1180),y=rand(80,650);
      for(const msg of VULCAN){
        if(/toggle|activate|start|support/i.test(msg)){
          safeSend(bot.room,msg,{active:true,x,y});
        }else if(/aim|target/i.test(msg)){
          safeSend(bot.room,msg,{x,y});
        }else if(/fire|shot/i.test(msg)){
          safeSend(bot.room,msg,{x,y});
        }else{
          safeSend(bot.room,msg,{x,y,active:true});
        }
      }
      bot.messages+=VULCAN.length;
    },6200+bot.index*300));
  }
}

async function reconnectBot(bot, ordinal){
  if(phase(bot.room)!=="hunt") return;

  const old=bot.room;
  const token=old.reconnectionToken;
  if(!token){
    console.log(`[RECONNECT SKIP] ${bot.name}: no token`);
    return;
  }

  console.log(`[DROP ${ordinal}/${CHAOS_BOTS}] ${bot.name}`);

  try{
    old.connection?.close?.();
  }catch(e){
    console.log(`[DROP WARNING] ${bot.name}: ${String(e)}`);
  }

  /* Different brief outage durations, all around/above v540 550ms grace. */
  await sleep(650+ordinal*180+Math.floor(rand(0,250)));

  try{
    const recovered=await bot.client.reconnect(token);
    bot.room=recovered;
    bot.reconnects++;
    console.log(`[RECOVERED ${ordinal}/${CHAOS_BOTS}] ${bot.name} session=${recovered.sessionId}`);
  }catch(e){
    bot.reconnectFailures++;
    console.log(`[RECONNECT FAILED] ${bot.name}: ${String(e)}`);
  }
}

async function reconnectWave(){
  if(reconnectWaveStarted) return;
  reconnectWaveStarted=true;

  const selected=[...bots]
    .sort(()=>Math.random()-.5)
    .slice(0,CHAOS_BOTS);

  console.log("");
  console.log(`[CHAOS] ${CHAOS_BOTS}-bot reconnect wave NOW`);

  /* Near-simultaneous, but not same-tick artificial burst. */
  selected.forEach((bot,i)=>{
    setTimeout(()=>void reconnectBot(bot,i+1),i*180);
  });

  /* Start tactical storm while reconnect recovery has just settled. */
  setTimeout(()=>{
    tacticalWaveStarted=true;
    console.log("[CHAOS] tactical wave enabled: movement + shotgun + sniper + Vulcan");
  },3200);
}

async function shutdown(){
  if(shuttingDown) return;
  shuttingDown=true;
  console.log("\n[shutdown] leaving sessions...");
  for(const b of bots) for(const t of b.timers) clearInterval(t);
  await Promise.allSettled(bots.map(b=>b.room?.leave().catch(()=>{})));
  console.log("[shutdown] done");
  process.exit(0);
}
process.on("SIGINT",shutdown);
process.on("SIGTERM",shutdown);

(async()=>{
  try{
    console.log("======================================================");
    console.log(" COLOR HUNT - STAGE 6 / 10P COMBINED CHAOS");
    console.log("======================================================");
    console.log("server      :",SERVER_URL);
    console.log("room        :",ROOM_ID);
    console.log("bots        :",BOTS,"(+ your browser = 10)");
    console.log("paint load  :",`${PAINT_MS}ms`);
    console.log("reconnects  :",CHAOS_BOTS);
    console.log("Vulcan msgs :",VULCAN.length?VULCAN:"none discovered");
    console.log("======================================================");

    await health();

    for(let i=0;i<BOTS;i++){
      const b=await joinBot(i);
      attachBehavior(b);
      await sleep(180);
    }

    console.log("\n[READY] Bots connected.");
    console.log("Start the match normally from your host browser.");
    console.log("Stage 6 sequence is automatic after that.");
    console.log("Ctrl+C to stop.\n");

    const huntWatch=setInterval(()=>{
      const huntCount=bots.filter(b=>phase(b.room)==="hunt").length;
      if(huntCount>=Math.max(1,BOTS-1)){
        if(!huntStartedAt){
          huntStartedAt=Date.now();
          console.log("[HUNT] detected. Reconnect wave scheduled in 5 seconds.");
        }
        if(Date.now()-huntStartedAt>=5000 && !reconnectWaveStarted){
          void reconnectWave();
        }
      }
    },250);

    setInterval(()=>{
      const phases={};
      let sent=0,re=0,fail=0;
      for(const b of bots){
        const p=phase(b.room);
        phases[p]=(phases[p]||0)+1;
        sent+=b.messages;
        re+=b.reconnects;
        fail+=b.reconnectFailures;
      }
      console.log(
        `[STAT] phases=${JSON.stringify(phases)} sent=${sent} recovered=${re}/${CHAOS_BOTS} reconnectFail=${fail} tactical=${tacticalWaveStarted}`
      );
    },5000);

  }catch(e){
    console.error("\n[FATAL]",e);
    await shutdown();
  }
})();
