const fs = require("fs");
const path = require("path");

const GAME = path.join("src", "game", "GameScene.ts");
const NET = path.join("src", "multiplayer", "NetworkPlayerManager.ts");
const MARK = "V1010542C_REMOVE_UNUSED_TELEMETRY_ROBUST";

for (const file of [GAME, NET]) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing ${file}. Run from C:\\Users\\bak12\\color-hunt. No files written.`
    );
  }
}

let g = fs.readFileSync(GAME, "utf8").replace(/\r\n/g, "\n");
const n = fs.readFileSync(NET, "utf8").replace(/\r\n/g, "\n");
const original = g;

if (g.includes(MARK)) {
  console.log("[skip] v542c already applied.");
  process.exit(0);
}

/*
 * v542b failed because it looked for STATIONARY_REMOTE_FAST_PATH
 * inside GameScene.ts even though that optimization belongs to
 * NetworkPlayerManager.ts.
 *
 * This repair verifies each optimization in the CORRECT file.
 */

/* 1) Verify v542 NetworkPlayerManager optimization separately. */
if (
  !n.includes("V1010542_TEN_PLAYER_PREFLIGHT_SAFE_OPT") &&
  !n.includes("STATIONARY_REMOTE_FAST_PATH")
) {
  throw new Error(
    "v542 NetworkPlayerManager optimization marker not found. No files written."
  );
}

/* 2) Verify GameScene VFX optimization separately. */
if (
  !g.includes("V1010542_TEN_PLAYER_PREFLIGHT_SAFE_OPT") &&
  !g.includes("LARGE_ROOM_VFX_CIRCUIT_BREAKER")
) {
  throw new Error(
    "v542 GameScene VFX optimization marker not found. No files written."
  );
}

/* 3) Remove ONLY the two unused optional telemetry fields. */
const fieldPatterns = [
  /^\s*private largeRoomPerfLastLogAt\s*=\s*0\s*;\s*$/m,
  /^\s*private largeRoomPerfWorstFrameMs\s*=\s*0\s*;\s*$/m,
];

let removed = 0;

for (const re of fieldPatterns) {
  if (re.test(g)) {
    g = g.replace(re, "");
    removed += 1;
  }
}

if (removed === 0) {
  console.log(
    "[note] telemetry fields are already absent; verifying v542 core only."
  );
} else if (removed !== 2) {
  throw new Error(
    `Expected to remove 2 telemetry fields, removed ${removed}. No file written.`
  );
}

/* 4) Core v542 safety checks, in their actual files. */
const gameRequired = [
  "LARGE_ROOM_VFX_CIRCUIT_BREAKER",
  "transientGameplayVfx.size >=",
];

for (const token of gameRequired) {
  if (!g.includes(token)) {
    throw new Error(
      `GameScene v542 core missing after repair: ${token}. No file written.`
    );
  }
}

const netRequired = [
  "STATIONARY_REMOTE_FAST_PATH",
  "private readonly sendInterval = 66",
  "private readonly authoritativeSyncIntervalMs = 66",
];

for (const token of netRequired) {
  if (!n.includes(token)) {
    throw new Error(
      `NetworkPlayerManager v542/stability contract missing: ${token}. No file written.`
    );
  }
}

/* 5) Ensure the TS6133-causing declarations are gone. */
if (
  /private largeRoomPerfLastLogAt/.test(g) ||
  /private largeRoomPerfWorstFrameMs/.test(g)
) {
  throw new Error(
    "Postcondition failed: unused telemetry fields still remain. No file written."
  );
}

/*
 * If an actual telemetry implementation somehow exists in the current source,
 * don't leave references to fields that we just removed.
 */
if (
  /\bthis\.largeRoomPerfLastLogAt\b/.test(g) ||
  /\bthis\.largeRoomPerfWorstFrameMs\b/.test(g)
) {
  throw new Error(
    "Telemetry fields are referenced by active code; refusing to remove declarations. No file written."
  );
}

g =
  `/* ${MARK}: removed only unused v542 telemetry declarations; core 10-player optimizations preserved in their respective files. */\n` +
  g;

fs.mkdirSync(".patch-backups", { recursive: true });

fs.writeFileSync(
  path.join(
    ".patch-backups",
    "GameScene-before-v542c-remove-unused-telemetry.ts"
  ),
  original,
  "utf8"
);

fs.writeFileSync(GAME, g, "utf8");

console.log("");
console.log("Applied v0.10.10.542c.");
console.log(" - fixed v542b's cross-file safety-check mistake");
console.log(" - removed unused largeRoomPerfLastLogAt");
console.log(" - removed unused largeRoomPerfWorstFrameMs");
console.log(" - GameScene VFX circuit breaker preserved");
console.log(" - NetworkPlayerManager stationary remote fast-path verified");
console.log(" - movement sendInterval stays 66ms (~15Hz)");
console.log(" - authoritative sync stays 66ms (~15Hz)");
console.log(" - reconnect / paint / server / hit logic untouched");
console.log("Next: npm run build");
