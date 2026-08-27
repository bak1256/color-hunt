/*
 * Chameleon Hunt / Color Hunt - real Colyseus load bots
 *
 * Run from:
 *   C:\Users\bak12\color-hunt
 *
 * Examples:
 *   node color-hunt-loadtest-10p.cjs --room YOUR_ROOM_ID
 *   node color-hunt-loadtest-10p.cjs --room YOUR_ROOM_ID --bots 9
 *   node color-hunt-loadtest-10p.cjs --room YOUR_ROOM_ID --bots 9 --url https://YOUR-RENDER-SERVER
 *
 * Notes:
 * - Uses the project's existing @colyseus/sdk dependency.
 * - These are REAL Colyseus/WebSocket sessions, but they do NOT render Phaser/WebGL.
 * - Default is 9 bots so your real browser can be the 10th player.
 * - Bots auto READY in lobby/paint, move in Hunt, and create moderate Paint traffic.
 * - Ctrl+C cleanly leaves all bot sessions.
 */

const { Client, Callbacks } = require("@colyseus/sdk");
const fs = require("fs");
const path = require("path");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function intArg(name, fallback) {
  const n = Number(arg(name, String(fallback)));
  return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : fallback;
}
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
function rand(a,b) {
  return a + Math.random() * (b-a);
}
function clamp(v,a,b) {
  return Math.max(a, Math.min(b,v));
}

const ROOM_ID = arg("room").trim();
const BOTS = Math.min(9, intArg("bots", 9));
const PASSWORD = arg("password", "");
let SERVER_URL = arg("url").trim();

/* Try to discover the same production URL used by Vite, without modifying files. */
if (!SERVER_URL) {
  const candidates = [".env.local",".env.production",".env"];
  for (const f of candidates) {
    if (!fs.existsSync(f)) continue;
    const text = fs.readFileSync(f,"utf8");
    const m = text.match(/^\s*VITE_MULTIPLAYER_URL\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);
    if (m) {
      SERVER_URL = m[1].trim();
      break;
    }
  }
}
if (!SERVER_URL) SERVER_URL = "http://localhost:2567";

if (!ROOM_ID) {
  console.error("");
  console.error("Room ID is required.");
  console.error("Create a room in your normal browser, then copy its roomId/invite ID.");
  console.error("");
  console.error("Example:");
  console.error("  node color-hunt-loadtest-10p.cjs --room abc123 --bots 9");
  console.error("");
  process.exit(1);
}

console.log("======================================================");
console.log(" Chameleon Hunt - 10 Player Colyseus Load Test");
console.log("======================================================");
console.log("server :", SERVER_URL);
console.log("room   :", ROOM_ID);
console.log("bots   :", BOTS, "(leave one slot for your real browser)");
console.log("mode   : lobby ready + paint traffic + hunt movement");
console.log("render : NONE (network/server load only)");
console.log("======================================================");

const bots=[];
let shuttingDown=false;

function statePhase(room) {
  return String(room.state?.phase ?? "lobby");
}
function safeSend(room,type,payload={}) {
  try {
    if (room.connection?.isOpen === false) return false;
    room.send(type,payload);
    return true;
  } catch {
    return false;
  }
}

/* Paint packet shape is intentionally discovered conservatively from the
 * current public contract. If the server rejects it, the bot keeps the room
 * connection and movement/ready test alive instead of crashing. */
function makePaintStroke(bot) {
  bot.paintSeq += 1;
  const cx=40+Math.sin(bot.paintSeq*0.31+bot.index)*18;
  const cy=60+Math.cos(bot.paintSeq*0.27+bot.index)*25;
  const points=[];
  for(let i=0;i<24;i++){
    points.push({
      x: clamp(Math.round(cx+Math.sin(i*.7)*8),0,79),
      y: clamp(Math.round(cy+Math.cos(i*.55)*10),0,119),
    });
  }
  return {
    points,
    color: bot.color,
    size: 3,
    shape: "circle",
    reset: false,
  };
}

async function connectBot(index) {
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
    x:rand(120,1160),
    y:rand(100,620),
    vx:rand(-85,85)||50,
    vy:rand(-70,70)||45,
    paintSeq:0,
    color:["#ff4d4d","#4da6ff","#4dff88","#ffd24d","#c44dff"][index%5],
    timers:[],
    connectedAt:Date.now(),
    messages:0,
  };
  bots.push(bot);

  console.log(`[JOIN ${index+1}/${BOTS}] ${name} session=${room.sessionId}`);

  room.onLeave((code)=>{
    console.log(`[LEAVE] ${name} code=${code}`);
  });
  room.onError((code,message)=>{
    console.log(`[ERROR] ${name} code=${code} ${message ?? ""}`);
  });

  /* State watcher. Polling is deliberately low-frequency and robust across
     schema callback revisions. */
  bot.timers.push(setInterval(()=>{
    const phase=statePhase(room);
    if(phase!==bot.phase){
      bot.phase=phase;
      console.log(`[PHASE] ${name} -> ${phase}`);
    }

    if(phase==="lobby"){
      safeSend(room,"lobby_ready",{ready:true});
      safeSend(room,"request_lobby_ready_state",{});
    } else if(phase==="paint"){
      safeSend(room,"paint_ready",{ready:true});
    }
  },1000));

  /* Moderate paint load: 24 points every 220ms per bot.
     9 bots ~= 980 paint points/sec, enough to stress the transport without
     becoming an artificial denial-of-service style flood. */
  bot.timers.push(setInterval(()=>{
    if(statePhase(room)!=="paint") return;
    if(safeSend(room,"paint_stroke",makePaintStroke(bot))) bot.messages++;
  },220+index*7));

  /* Hunt movement at the game's real ~15Hz cadence (66ms). */
  bot.timers.push(setInterval(()=>{
    if(statePhase(room)!=="hunt") return;

    const dt=.066;
    bot.x += bot.vx*dt;
    bot.y += bot.vy*dt;

    if(bot.x<70||bot.x>1210){
      bot.vx*=-1;
      bot.x=clamp(bot.x,70,1210);
    }
    if(bot.y<70||bot.y>650){
      bot.vy*=-1;
      bot.y=clamp(bot.y,70,650);
    }

    /* Slight wandering rather than identical straight-line bots. */
    if(Math.random()<0.015){
      bot.vx=clamp(bot.vx+rand(-35,35),-120,120);
      bot.vy=clamp(bot.vy+rand(-35,35),-100,100);
    }

    if(safeSend(room,"move",{x:bot.x,y:bot.y})) bot.messages++;
  },66));

  return bot;
}

async function shutdown() {
  if(shuttingDown) return;
  shuttingDown=true;
  console.log("\n[shutdown] leaving bot sessions...");
  for(const bot of bots){
    for(const t of bot.timers) clearInterval(t);
  }
  await Promise.allSettled(
    bots.map(bot=>bot.room.leave().catch(()=>{}))
  );
  console.log("[shutdown] done.");
  process.exit(0);
}
process.on("SIGINT",shutdown);
process.on("SIGTERM",shutdown);

(async()=>{
  try{
    /* Stagger joins so matchmaking/upstream is tested realistically instead
       of hitting it with 9 requests in the same millisecond. */
    for(let i=0;i<BOTS;i++){
      await connectBot(i);
      await sleep(180);
    }

    console.log("");
    console.log(`[READY] ${bots.length} real WebSocket bot sessions connected.`);
    console.log("Now use your NORMAL browser as the remaining player.");
    console.log("Start the match normally from the host browser.");
    console.log("Bots will READY, paint, then move automatically.");
    console.log("Press Ctrl+C when the test is finished.");
    console.log("");

    setInterval(()=>{
      const byPhase={};
      let messages=0;
      for(const b of bots){
        const p=statePhase(b.room);
        byPhase[p]=(byPhase[p]||0)+1;
        messages+=b.messages;
      }
      console.log(
        `[STAT] connected=${bots.length}/${BOTS} phases=${JSON.stringify(byPhase)} sent=${messages}`
      );
    },5000);
  }catch(err){
    console.error("\n[FATAL] load test could not start:");
    console.error(err);
    await shutdown();
  }
})();
