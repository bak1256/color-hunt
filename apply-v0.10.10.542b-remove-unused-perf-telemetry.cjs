const fs = require("fs");
const path = require("path");

const FILE = path.join("src", "game", "GameScene.ts");
const MARK = "V1010542B_REMOVE_UNUSED_PERF_TELEMETRY";

if (!fs.existsSync(FILE)) {
  throw new Error(
    `Missing ${FILE}. Run from C:\\Users\\bak12\\color-hunt. No file written.`
  );
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");
const original = s;

if (s.includes(MARK)) {
  console.log("[skip] v542b already applied.");
  process.exit(0);
}

const fields = [
  /^\s*private largeRoomPerfLastLogAt\s*=\s*0\s*;\s*$/m,
  /^\s*private largeRoomPerfWorstFrameMs\s*=\s*0\s*;\s*$/m,
];

for (const re of fields) {
  const matches = s.match(re);
  if (!matches) {
    throw new Error(
      `Expected unused v542 telemetry field not found: ${re}. No file written.`
    );
  }
  s = s.replace(re, "");
}

/*
 * Safety: remove ONLY the unused diagnostic declarations.
 * The actual v542 optimization must remain intact.
 */
const required = [
  "V1010542_TEN_PLAYER_PREFLIGHT_SAFE_OPT",
  "STATIONARY_REMOTE_FAST_PATH",
  "LARGE_ROOM_VFX_CIRCUIT_BREAKER",
  "transientGameplayVfx.size >=",
];

for (const token of required) {
  if (!s.includes(token)) {
    throw new Error(
      `Safety check failed: v542 core optimization missing: ${token}. No file written.`
    );
  }
}

if (
  s.includes("private largeRoomPerfLastLogAt") ||
  s.includes("private largeRoomPerfWorstFrameMs")
) {
  throw new Error(
    "Postcondition failed: unused telemetry declarations remain. No file written."
  );
}

s =
  `/* ${MARK}: removed unused optional telemetry declarations; v542 gameplay optimizations preserved. */\n` +
  s;

fs.mkdirSync(".patch-backups", { recursive: true });
fs.writeFileSync(
  path.join(
    ".patch-backups",
    "GameScene-before-v542b-remove-unused-telemetry.ts"
  ),
  original,
  "utf8"
);

fs.writeFileSync(FILE, s, "utf8");

console.log("Applied v0.10.10.542b.");
console.log(" - removed unused largeRoomPerfLastLogAt");
console.log(" - removed unused largeRoomPerfWorstFrameMs");
console.log(" - stationary remote-player optimization preserved");
console.log(" - large-room VFX circuit breaker preserved");
console.log(" - reconnect/network/paint/hit logic untouched");
console.log(" - backup created in .patch-backups");
console.log("Next: npm run build");
