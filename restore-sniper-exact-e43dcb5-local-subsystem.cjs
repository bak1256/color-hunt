const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = process.cwd();
const FILE = path.join(ROOT, "src", "game", "GameScene.ts");
const GOOD = "e43dcb5";
const MARK = "RESTORE_SNIPER_EXACT_E43DCB5_LOCAL_SUBSYSTEM";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt project root.");
}

let current = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (current.includes(MARK)) {
  console.log("[skip] exact e43dcb5 local sniper subsystem already restored");
  process.exit(0);
}

function gitShow(spec) {
  try {
    return cp.execSync(`git show ${spec}`, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    }).replace(/\r\n/g, "\n");
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr) : "";
    throw new Error(
      `Could not read saved git point ${spec}.\n${stderr}\nNo file written.`
    );
  }
}

const good = gitShow(`${GOOD}:src/game/GameScene.ts`);

function findMethodStart(src, methodName) {
  const re = new RegExp(
    `^[ \\t]*private[ \\t]+${methodName}\\s*\\(`,
    "m"
  );
  const m = src.match(re);
  if (!m || m.index == null) {
    throw new Error(`${methodName}() not found. No file written.`);
  }
  return m.index;
}

/*
 * Restore the exact LOCAL sniper rendering/cinematic block from the saved
 * known-good point, but deliberately stop before drawSniperReloadGauge().
 *
 * This preserves all current remote spectator code, reconnect fixes,
 * victory UI, Paint/READY work, and later non-sniper GameScene changes.
 */
const startName = "enterSniperCinematic";
const endName = "drawSniperReloadGauge";

const goodStart = findMethodStart(good, startName);
const goodEnd = findMethodStart(good, endName);

const curStart = findMethodStart(current, startName);
const curEnd = findMethodStart(current, endName);

if (!(goodStart < goodEnd && curStart < curEnd)) {
  throw new Error("Sniper block boundaries are invalid. No file written.");
}

const goodBlock = good.slice(goodStart, goodEnd);

if (
  !goodBlock.includes("enterSniperCinematic") ||
  !goodBlock.includes("exitSniperCinematic") ||
  !goodBlock.includes("createSniperScopeCamera") ||
  !goodBlock.includes("drawLocalSniperScope")
) {
  throw new Error(
    "Saved sniper block does not contain all required known-good methods. No file written."
  );
}

/*
 * Safety: the saved point was explicitly documented as the state with
 * moving magnified scope + DOM blur + rack-in behavior.
 */
const hasBlurEvidence =
  goodBlock.includes("blur") ||
  goodBlock.includes("Blur") ||
  goodBlock.includes("backdropFilter") ||
  goodBlock.includes("postFX");

if (!hasBlurEvidence) {
  throw new Error(
    "Saved e43dcb5 sniper block does not expose blur-related implementation. Refusing to guess. No file written."
  );
}

const backupDir = path.join(ROOT, ".patch-backups");
fs.mkdirSync(backupDir, { recursive: true });

fs.writeFileSync(
  path.join(backupDir, "GameScene-before-exact-e43dcb5-sniper-restore.ts"),
  current,
  "utf8"
);

current =
  current.slice(0, curStart) +
  `    /* ${MARK}: exact local sniper subsystem restored from git ${GOOD}. */\n` +
  goodBlock +
  current.slice(curEnd);

fs.writeFileSync(FILE, current, "utf8");

console.log("");
console.log("[done] exact LOCAL sniper subsystem restored");
console.log(`[source] git ${GOOD}:src/game/GameScene.ts`);
console.log("[restored] enterSniperCinematic");
console.log("[restored] exitSniperCinematic");
console.log("[restored] createSniperScopeCamera");
console.log("[restored] drawLocalSniperScope + helpers between those methods");
console.log("[expected] original moving magnified scope + outside blur + rack-in behavior");
console.log("[preserved] current remote spectator code after drawSniperReloadGauge");
console.log("[preserved] current victory/paint/READY/reconnect and other later GameScene work");
console.log("[backup] .patch-backups/GameScene-before-exact-e43dcb5-sniper-restore.ts");
console.log("Next: npm run build");
