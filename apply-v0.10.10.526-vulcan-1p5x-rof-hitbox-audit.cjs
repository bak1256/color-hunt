const fs = require("fs");
const path = require("path");

const clientFile = path.join("src","game","GameScene.ts");
const serverFile = path.join("..","color-hunt-server","src","rooms","MyRoom.ts");

if (!fs.existsSync(clientFile) || !fs.existsSync(serverFile)) {
  throw new Error("Run this from C:\\Users\\bak12\\color-hunt. No file written.");
}

const client0 = fs.readFileSync(clientFile,"utf8");
const server0 = fs.readFileSync(serverFile,"utf8");
let client = client0;
let server = server0;

// v524b = 2x original: client 29ms, authoritative server 45ms.
// Requested 1.5x original => 58/1.5 ~= 39ms, 90/1.5 = 60ms.
// Change cadence only. Do NOT silently alter hitbox/spread in this audit patch.
const clientRe = /vulcanLastMuzzleFxAt\s*>=\s*29/g;
const clientCount = (client.match(clientRe) || []).length;
if (clientCount !== 1) {
  throw new Error(`Expected exactly one v524b client 29ms cadence, found ${clientCount}. No file written.`);
}
client = client.replace(clientRe, "vulcanLastMuzzleFxAt >= 39");

const fireStart = server.indexOf("    vulcan_fire_start: (");
const fireStop = server.indexOf("\n    vulcan_fire_stop: (", fireStart);
if (fireStart < 0 || fireStop < 0) {
  throw new Error("Server vulcan_fire_start block not found. No file written.");
}
let block = server.slice(fireStart, fireStop);
const tick45 = /this\.clock\.setTimeout\(\s*tick,\s*45,\s*\);/g;
const tickCount = (block.match(tick45) || []).length;
if (tickCount !== 2) {
  throw new Error(`Expected exactly two v524b authoritative 45ms timers, found ${tickCount}. No file written.`);
}
block = block.replace(tick45, `this.clock.setTimeout(
            tick,
            60,
          );`);
server = server.slice(0,fireStart) + block + server.slice(fireStop);

// Audit the authoritative hit geometry and fail rather than guessing if it changed.
const rx = server.match(/private readonly vulcanHitRadiusX\s*=\s*(\d+)\s*;/);
const ry = server.match(/private readonly vulcanHitRadiusY\s*=\s*(\d+)\s*;/);
if (!rx || !ry) {
  throw new Error("Could not locate authoritative Vulcan hit radii. No file written.");
}
const hitX = Number(rx[1]), hitY = Number(ry[1]);

const ellipseCheck =
  /const nx\s*=\s*\(target\.x\s*-\s*aim\.x\)\s*\/\s*this\.vulcanHitRadiusX;[\s\S]{0,400}?const ny\s*=\s*\(target\.y\s*-\s*aim\.y\)\s*\/\s*this\.vulcanHitRadiusY;[\s\S]{0,300}?if\s*\(d2\s*>\s*1\)\s*continue;/m;
if (!ellipseCheck.test(server)) {
  throw new Error("Authoritative ellipse hit-test shape differs from expected. No file written.");
}

client = `/* V1010526_VULCAN_1P5X_ROF: v524b 2x ROF reduced to 1.5x; hit geometry intentionally unchanged pending balance test. */\n` + client;
server = `/* V1010526_VULCAN_1P5X_ROF: authoritative tick 45ms->60ms; hit ellipse audited, unchanged. */\n` + server;

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v526.ts"),client0,"utf8");
fs.mkdirSync(path.join("..","color-hunt-server",".patch-backups"),{recursive:true});
fs.writeFileSync(path.join("..","color-hunt-server",".patch-backups","MyRoom-before-v526.ts"),server0,"utf8");

fs.writeFileSync(clientFile,client,"utf8");
fs.writeFileSync(serverFile,server,"utf8");

console.log("Applied v0.10.10.526.");
console.log(" - Vulcan visual cadence: 29ms -> 39ms (~1.5x original)");
console.log(" - authoritative hit tick: 45ms -> 60ms (1.5x original)");
console.log(` - authoritative hit ellipse: ±${hitX}px X / ±${hitY}px Y`);
console.log(" - IMPORTANT: spotlight/impact visuals are presentation; kill check uses the server aim-centered ellipse above.");
console.log(" - hitbox/spread were NOT changed in this patch, so we can test cadence separately.");
console.log("Next: npm run build && cd ..\\color-hunt-server && npm run build");
