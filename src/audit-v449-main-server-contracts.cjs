const fs = require("fs");
const path = require("path");

const ROOT = "C:\\Users\\bak12";
const CLIENT = path.join(ROOT, "color-hunt", "src", "network", "MultiplayerClient.ts");
const SERVER = path.join(ROOT, "color-hunt-server", "src", "rooms", "MyRoom.ts");
const OUT = path.join(ROOT, "color-hunt-server", "audit-v449-main-server-contracts.txt");

for (const f of [CLIENT, SERVER]) {
  if (!fs.existsSync(f)) throw new Error(`Missing ${f}`);
}

const c = fs.readFileSync(CLIENT, "utf8").replace(/\r\n/g, "\n");
const s = fs.readFileSync(SERVER, "utf8").replace(/\r\n/g, "\n");

function extractAll(text, regex, group = 1) {
  const out = [];
  let m;
  while ((m = regex.exec(text))) out.push(m[group]);
  return [...new Set(out)].sort();
}

const clientSends = extractAll(c, /(?:this\.)?room\??\.send\(\s*["'`]([^"'`]+)["'`]/g);
const serverHandlers = extractAll(s, /^\s{4}([A-Za-z0-9_]+):\s*\(\s*client:/gm);
const serverSends = extractAll(s, /(?:\bclient|\bconnectedClient|\bresultClient|\btargetClient|\bthis)\s*\.\s*(?:send|broadcast)\(\s*["'`]([^"'`]+)["'`]/g);
const clientReceives = extractAll(c, /\broom\.onMessage(?:<[^>]+>)?\(\s*["'`]([^"'`]+)["'`]/g);

const missingServerHandlers = clientSends.filter(x => !serverHandlers.includes(x));
const missingClientHandlers = serverSends.filter(x => !clientReceives.includes(x));

const checks = [
  ["READY state field", "lobbyReadySessionIds"],
  ["READY snapshot", "lobbyReadyState:"],
  ["READY handler", "lobby_ready:"],
  ["READY request handler", "request_lobby_ready_state:"],
  ["READY send", "\"lobby_ready_state\""],
  ["Paint READY handler", "paint_ready:"],
  ["Paint READY request", "request_paint_ready_state:"],
  ["Round paint request", "request_round_paint_state:"],
  ["Round paint restore", "restore_local_paint:"],
  ["Avatar preset handler", "avatar_preset:"],
  ["Avatar preset request", "request_avatar_presets:"],
  ["Final camouflage store", "finalCamouflageSnapshots"],
  ["Final camouflage upload", "final_camouflage_snapshot:"],
  ["Final camouflage request", "request_final_camouflage_snapshots:"],
  ["Hunter personal found event", "hunter_personal_found"],
  ["Personal found ledger", "victoryFoundByHunterKey"],
  ["Personalized round result", "sendRoundResultPersonalized"],
  ["Full finished result retention", "lastRoundResultPayload"],
  ["Reconnect authority", "allowReconnection("],
  ["Reconnect identity", "clientKeyBySessionId"],
  ["Superseded session guard", "supersededSessionIds"],
  ["Live session guard", "liveSessionIds"],
  ["Full room guard", "room_full"],
  ["Join rejected message", "join_rejected"],
  ["Hunter volunteer", "hunter_volunteer:"],
  ["Start game handler", "start_game:"],
  ["Start error", "start_game_error"],
  ["Round result", "\"round_result\""],
  ["Reset round", "\"reset_round\""],
  ["Phase changed", "\"phase_changed\""],
];

let text = "COLOR HUNT v449 MAIN SERVER CONTRACT AUDIT\nREAD ONLY - NO SOURCE MODIFICATION\n\n";
text += `CLIENT: ${CLIENT}\nSERVER: ${SERVER}\n\n`;

text += "===== HIGH-VALUE SERVER FEATURES =====\n";
for (const [label, token] of checks) {
  text += `${s.includes(token) ? "[OK]  " : "[MISS]"} ${label} :: ${token}\n`;
}

text += "\n===== CLIENT -> SERVER MESSAGE CONTRACT =====\n";
if (!missingServerHandlers.length) text += "[OK] No obvious missing server handlers.\n";
for (const m of missingServerHandlers) text += `[MISS] server handler: ${m}\n`;

text += "\n===== SERVER -> CLIENT MESSAGE CONTRACT =====\n";
text += "NOTE: REVIEW items can be intentional if consumed elsewhere.\n";
if (!missingClientHandlers.length) text += "[OK] No obvious missing client handlers.\n";
for (const m of missingClientHandlers) text += `[REVIEW] client handler: ${m}\n`;

text += `\n===== COUNTS =====
client sends: ${clientSends.length}
server handlers: ${serverHandlers.length}
server sends: ${serverSends.length}
client receives: ${clientReceives.length}
missing server handlers: ${missingServerHandlers.length}
review client handlers: ${missingClientHandlers.length}
`;

text += "\n===== ALL CLIENT SENDS =====\n" + clientSends.join("\n") + "\n";
text += "\n===== ALL SERVER HANDLERS =====\n" + serverHandlers.join("\n") + "\n";
text += "\n===== ALL SERVER SENDS =====\n" + serverSends.join("\n") + "\n";
text += "\n===== ALL CLIENT RECEIVES =====\n" + clientReceives.join("\n") + "\n";

fs.writeFileSync(OUT, text, "utf8");
console.log(`[ok] wrote ${OUT}`);
console.log("[safe] READ ONLY");
console.log(`[info] missing server handlers: ${missingServerHandlers.length}`);
console.log(`[info] review client handlers: ${missingClientHandlers.length}`);
