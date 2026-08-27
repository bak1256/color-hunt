/*
 * Chameleon Hunt / Color Hunt - Colyseus 10P load bots v2
 * Fix: production server fallback is Render, not localhost.
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
const PASSWORD=arg("password","");
const PROD_FALLBACK="https://color-hunt-server.onrender.com";

let SERVER_URL=arg("url").trim();

if(!SERVER_URL){
  for(const f of [".env.local",".env.production",".env"]){
    if(!fs.existsSync(f)) continue;
    const text=fs.readFileSync(f,"utf8");
    const m=text.match(/^\s*VITE_MULTIPLAYER_URL\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);
    if(m){
      SERVER_URL=m[1].trim();
      break;
    }
  }
}

if(!SERVER_URL){
  SERVER_URL=PROD_FALLBACK;
  console.log(`[auto] VITE_MULTIPLAYER_URL not found locally; using production ${SERVER_URL}`);
}

SERVER_URL=SERVER_URL.replace(/\/+$/,"");

if(!ROOM_ID){
  console.error("Room ID required.");
  console.error("Example: node color-hunt-loadtest-10p-v2.cjs --room XI84s4ssq");
  process.exit(1);
}

const bots=[];
let shuttingDown=false;

function phase(room){ return String(room.state?.phase??"lobby"); }
function safeSend(room,type,payload={}){
  try { room.send(type,payload); return true; }
  catch { return false; }
}

function makePaintStroke(bot){
  bot.paintSeq++;
  const cx=40+Math.sin(bot.paintSeq*.31+bot.index)*18;
  const cy=60+Math.cos(bot.paintSeq*.27+bot.index)*25;
  const points=[];
  for(let i=0;i<24;i++){
    points.push({
      x:clamp(Math.round(cx+Math.sin(i*.7)*8),0,79),
      y:clamp(Math.round(cy+Math.cos(i*.55)*10),0,119),
    });
  }
  return {
    points,
    color:bot.color,
    size:3,
    shape:"circle",
    reset:false,
  };
}

async function healthCheck(){
  const url=`${SERVER_URL}/hi`;
  console.log(`[preflight] ${url}`);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const res=await fetch(url,{signal:controller.signal});
    const text=await res.text();
    if(!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0,120)}`);
    console.log(`[preflight] server OK: ${text.slice(0,100)}`);
  }finally{
    clearTimeout(timer);
  }
}

async function connectBot(index){
  const client=new Client(SERVER_URL);
  const name=`LoadBot${String(index+1).padStart(2,"0")}`;
  const clientKey=`loadtest-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;

  const room=await client.joinById(ROOM_ID,{
    name,
    password:PASSWORD,
    clientKey,
  });

  const bot={
    index,name,client,room,clientKey,
    phase:"",
    x:rand(120,1160),y:rand(100,620),
    vx:rand(-85,85)||50,vy:rand(-70,70)||45,
    paintSeq:0,
    color:[0xff4d4d,0x4da6ff,0x4dff88,0xffd24d,0xc44dff][index%5],
    timers:[],messages:0,
  };
  bots.push(bot);

  console.log(`[JOIN ${index+1}/${BOTS}] ${name} session=${room.sessionId}`);

  room.onLeave(code=>console.log(`[LEAVE] ${name} code=${code}`));
  room.onError((code,msg)=>console.log(`[ERROR] ${name} code=${code} ${msg??""}`));

  bot.timers.push(setInterval(()=>{
    const p=phase(room);
    if(p!==bot.phase){
      bot.phase=p;
      console.log(`[PHASE] ${name} -> ${p}`);
    }
    if(p==="lobby"){
      safeSend(room,"lobby_ready",{ready:true});
    }else if(p==="paint"){
      safeSend(room,"paint_ready",{ready:true});
    }
  },1000));

  bot.timers.push(setInterval(()=>{
    if(phase(room)!=="paint") return;
    if(safeSend(room,"paint_stroke",makePaintStroke(bot))) bot.messages++;
  },220+index*7));

  bot.timers.push(setInterval(()=>{
    if(phase(room)!=="hunt") return;
    const dt=.066;
    bot.x+=bot.vx*dt; bot.y+=bot.vy*dt;
    if(bot.x<70||bot.x>1210){ bot.vx*=-1; bot.x=clamp(bot.x,70,1210); }
    if(bot.y<70||bot.y>650){ bot.vy*=-1; bot.y=clamp(bot.y,70,650); }
    if(Math.random()<.015){
      bot.vx=clamp(bot.vx+rand(-35,35),-120,120);
      bot.vy=clamp(bot.vy+rand(-35,35),-100,100);
    }
    if(safeSend(room,"move",{x:bot.x,y:bot.y})) bot.messages++;
  },66));

  return bot;
}

async function shutdown(){
  if(shuttingDown) return;
  shuttingDown=true;
  console.log("\n[shutdown] leaving bot sessions...");
  for(const b of bots) for(const t of b.timers) clearInterval(t);
  await Promise.allSettled(bots.map(b=>b.room.leave().catch(()=>{})));
  console.log("[shutdown] done.");
  process.exit(0);
}
process.on("SIGINT",shutdown);
process.on("SIGTERM",shutdown);

(async()=>{
  try{
    console.log("======================================================");
    console.log(" Chameleon Hunt - 10 Player Load Test v2");
    console.log("======================================================");
    console.log("server :",SERVER_URL);
    console.log("room   :",ROOM_ID);
    console.log("bots   :",BOTS);
    console.log("======================================================");

    await healthCheck();

    for(let i=0;i<BOTS;i++){
      await connectBot(i);
      await sleep(180);
    }

    console.log(`\n[READY] ${bots.length} real WebSocket bots connected.`);
    console.log("Use your normal host browser as player #10 and start normally.");
    console.log("Ctrl+C ends the test.\n");

    setInterval(()=>{
      const phases={};
      let sent=0;
      for(const b of bots){
        const p=phase(b.room);
        phases[p]=(phases[p]||0)+1;
        sent+=b.messages;
      }
      console.log(`[STAT] connected=${bots.length}/${BOTS} phases=${JSON.stringify(phases)} sent=${sent}`);
    },5000);
  }catch(err){
    console.error("\n[FATAL]",err);
    await shutdown();
  }
})();
