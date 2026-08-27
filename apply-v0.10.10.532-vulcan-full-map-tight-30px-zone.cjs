const fs = require("fs");
const path = require("path");

const clientFile = path.join("src", "game", "GameScene.ts");
const serverFile = path.join("..", "color-hunt-server", "src", "rooms", "MyRoom.ts");

const CLIENT_MARK = "V1010532_VULCAN_FULL_MAP_ORBIT";
const SERVER_MARK = "V1010532_VULCAN_TIGHT_30PX_ZONE";

if (!fs.existsSync(clientFile)) {
  throw new Error(`Missing ${clientFile}. Run from C:\\Users\\bak12\\color-hunt. No file written.`);
}
if (!fs.existsSync(serverFile)) {
  throw new Error(`Missing ${serverFile}. Expected sibling color-hunt-server. No file written.`);
}

let client = fs.readFileSync(clientFile, "utf8").replace(/\r\n/g, "\n");
let server = fs.readFileSync(serverFile, "utf8").replace(/\r\n/g, "\n");

const clientOriginal = client;
const serverOriginal = server;

if (client.includes(CLIENT_MARK) || server.includes(SERVER_MARK)) {
  console.log("[skip] v0.10.10.532 already applied.");
  process.exit(0);
}

function methodRange(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Missing method: ${signature}. No file written.`);
  const next = source.indexOf("\n    private ", start + signature.length);
  if (next < 0) throw new Error(`Could not isolate method: ${signature}. No file written.`);
  return { start, end: next, text: source.slice(start, next) };
}

function replaceMethod(source, signature, transform) {
  const r = methodRange(source, signature);
  const changed = transform(r.text);
  if (changed === r.text) {
    throw new Error(`No expected change inside ${signature}. No file written.`);
  }
  return source.slice(0, r.start) + changed + source.slice(r.end);
}

/* ============================================================
 * CLIENT
 *
 * Current Vulcan aerial view ends at zoom 1.34, so map edges are
 * outside the viewport. Keep the existing circular/orbit motion,
 * but pull back just enough that the whole 960x540 map remains
 * visible even at the existing ±24 / ±16 camera-center orbit.
 *
 * Required zoom:
 *   width  : 960 / (960 + 48) = 0.952...
 *   height : 540 / (540 + 32) = 0.944...
 * Use 0.94 for a tiny safety margin.
 * ============================================================ */

const FULL_MAP_ZOOM = "0.94";

client = replaceMethod(
  client,
  "    private enterVulcanCinematic(",
  (m) => {
    const count = (m.match(/\b1\.34\b/g) || []).length;
    if (count < 2) {
      throw new Error(`enterVulcanCinematic expected >=2 aerial 1.34 zooms, found ${count}. No file written.`);
    }
    return m.replace(/\b1\.34\b/g, FULL_MAP_ZOOM);
  },
);

client = replaceMethod(
  client,
  "    private updateVulcanAirSupport(): void {",
  (m) => {
    const count = (m.match(/\.setZoom\(\s*1\.34,\s*\)/g) || []).length;
    if (count !== 1) {
      throw new Error(`updateVulcanAirSupport expected exactly one 1.34 orbit zoom, found ${count}. No file written.`);
    }
    return m.replace(
      /\.setZoom\(\s*1\.34,\s*\)/,
      `.setZoom(
                ${FULL_MAP_ZOOM},
            )`,
    );
  },
);

client = replaceMethod(
  client,
  "    private enterVulcanSpectatorView(",
  (m) => {
    const count = (m.match(/\.setZoom\(\s*1\.34,\s*\)/g) || []).length;
    if (count !== 1) {
      throw new Error(`enterVulcanSpectatorView expected exactly one 1.34 zoom, found ${count}. No file written.`);
    }
    return m.replace(
      /\.setZoom\(\s*1\.34,\s*\)/,
      `.setZoom(
                ${FULL_MAP_ZOOM},
            )`,
    );
  },
);

client =
`/* ${CLIENT_MARK}: Vulcan keeps its existing aerial orbit, but camera zoom is 0.94 so the full 960x540 map remains visible even at orbit extremes. */\n` +
client;

/* ============================================================
 * SERVER
 *
 * Previous authoritative Vulcan:
 *   random impact spread radius = 58px
 *   per-impact kill radius       = 22px
 *
 * Requested test:
 *   mouse-centered firing zone diameter = 30px
 *   => random impact spread radius = 15px
 *
 * Also shrink each impact's own hit radius to 3px. This keeps the
 * effective outer reach close to the requested mouse-centered zone
 * instead of retaining the old broad 22px splash around each impact.
 * ============================================================ */

const spreadRe =
  /private readonly vulcanImpactSpreadRadius\s*=\s*58\s*;/;

const hitRe =
  /private readonly vulcanImpactHitRadius\s*=\s*22\s*;/;

if (!spreadRe.test(server)) {
  throw new Error("Expected current Vulcan spread radius 58 not found in server. No file written.");
}
if (!hitRe.test(server)) {
  throw new Error("Expected current Vulcan impact hit radius 22 not found in server. No file written.");
}

server = server.replace(
  spreadRe,
  "private readonly vulcanImpactSpreadRadius = 15;",
);

server = server.replace(
  hitRe,
  "private readonly vulcanImpactHitRadius = 3;",
);

server =
`/* ${SERVER_MARK}: authoritative Vulcan impacts scatter only inside a mouse-centered radius-15px (30px diameter) circle; each impact has a tiny 3px hit radius. */\n` +
server;

/* ============================================================
 * POSTCONDITIONS
 * ============================================================ */

const enter = methodRange(client, "    private enterVulcanCinematic(").text;
const update = methodRange(client, "    private updateVulcanAirSupport(): void {").text;
const spectator = methodRange(client, "    private enterVulcanSpectatorView(").text;

const checks = [
  ["client marker", client.includes(CLIENT_MARK)],
  ["entry full-map zoom", /\b0\.94\b/.test(enter)],
  ["owner orbit full-map zoom", /\.setZoom\(\s*0\.94,\s*\)/.test(update)],
  ["existing X orbit retained", /Math\.cos\([\s\S]{0,120}?\)\s*\*\s*24/.test(update)],
  ["existing Y orbit retained", /Math\.sin\([\s\S]{0,120}?\)\s*\*\s*16/.test(update)],
  ["spectator full-map zoom", /\.setZoom\(\s*0\.94,\s*\)/.test(spectator)],
  ["server marker", server.includes(SERVER_MARK)],
  ["15px spread radius", /vulcanImpactSpreadRadius\s*=\s*15/.test(server)],
  ["3px impact hit radius", /vulcanImpactHitRadius\s*=\s*3/.test(server)],
  ["60ms cadence retained", /this\.clock\.setTimeout\(\s*tick\s*,\s*60\s*,?\s*\);/.test(server)],
];

for (const [label, ok] of checks) {
  if (!ok) {
    throw new Error(`Postcondition failed: ${label}. No file written.`);
  }
}

/* Backups + write only after every validation passed. */
fs.mkdirSync(".patch-backups", { recursive: true });
fs.mkdirSync(path.join("..", "color-hunt-server", ".patch-backups"), { recursive: true });

fs.writeFileSync(
  path.join(".patch-backups", "GameScene-before-v532.ts"),
  clientOriginal,
  "utf8",
);

fs.writeFileSync(
  path.join("..", "color-hunt-server", ".patch-backups", "MyRoom-before-v532.ts"),
  serverOriginal,
  "utf8",
);

fs.writeFileSync(clientFile, client, "utf8");
fs.writeFileSync(serverFile, server, "utf8");

console.log("Applied v0.10.10.532.");
console.log(" - Vulcan aerial camera: 1.34 -> 0.94");
console.log(" - existing circular/orbit camera movement retained");
console.log(" - full 960x540 map remains visible even near orbit extremes");
console.log(" - Hider spectator Vulcan aerial view uses the same full-map zoom");
console.log(" - authoritative random impact spread: radius 58px -> 15px");
console.log(" - firing-zone diameter around mouse: 30px");
console.log(" - per-impact hit radius: 22px -> 3px");
console.log(" - authoritative 60ms firing cadence retained");
console.log("Next: build BOTH client and server.");
