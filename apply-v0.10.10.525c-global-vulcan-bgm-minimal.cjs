const fs = require("fs");
const path = require("path");

const FILE = path.join("src", "game", "GameScene.ts");
const MARK = "V1010525C_GLOBAL_TACTICAL_BGM_MINIMAL";

if (!fs.existsSync(FILE)) {
  throw new Error(`Missing ${FILE}. No file written.`);
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");
const original = s;

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.525c already applied.");
  process.exit(0);
}

/*
 * Minimal fix only.
 *
 * Sniper is ALREADY global:
 *   if (state.active) this.startSniperTacticalBgm();
 *
 * Vulcan currently starts BGM only inside isOwner.
 * Move that one call before isOwner.
 *
 * We intentionally do NOT add new helper/state machinery here.
 * Existing startSniperTacticalBgm() already has the no-overlap/isPlaying guard.
 */

const oldBlock = `                if (state.active) {
                    if (isOwner) {
                        this.startSniperTacticalBgm();
                        this.vulcanSupportCommitted = true;
                        this.vulcanActive = true;`;

const newBlock = `                if (state.active) {
                    /*
                     * ${MARK}
                     * Match Sniper: every client receiving active Vulcan state
                     * enters the shared tactical BGM. startSniperTacticalBgm()
                     * already prevents duplicate playback.
                     */
                    this.startSniperTacticalBgm();

                    if (isOwner) {
                        this.vulcanSupportCommitted = true;
                        this.vulcanActive = true;`;

const matches = s.split(oldBlock).length - 1;

if (matches !== 1) {
  throw new Error(
    `Expected exactly one current Vulcan owner-only BGM block, found ${matches}. No file written.`
  );
}

s = s.replace(oldBlock, newBlock);

/* Exact, simple postconditions. */
if (!s.includes(MARK)) {
  throw new Error("Marker missing. No file written.");
}

const vulcanCb = s.indexOf(
  "multiplayerClient.onVulcanState((state: NetworkVulcanState) => {"
);
if (vulcanCb < 0) {
  throw new Error("Vulcan callback missing after patch. No file written.");
}

const window = s.slice(vulcanCb, vulcanCb + 1200);
const activePos = window.indexOf("if (state.active)");
const bgmPos = window.indexOf("this.startSniperTacticalBgm();");
const ownerPos = window.indexOf("if (isOwner)");

if (
  activePos < 0 ||
  bgmPos < 0 ||
  ownerPos < 0 ||
  !(activePos < bgmPos && bgmPos < ownerPos)
) {
  throw new Error(
    "Postcondition failed: global Vulcan BGM call is not before isOwner. No file written."
  );
}

/* Make sure we did not accidentally add a second BGM start in the owner branch. */
const bgmCount = (window.match(/this\.startSniperTacticalBgm\(\);/g) || []).length;
if (bgmCount !== 1) {
  throw new Error(
    `Postcondition failed: expected one Vulcan BGM start in callback window, found ${bgmCount}. No file written.`
  );
}

fs.mkdirSync(".patch-backups", { recursive: true });
fs.writeFileSync(
  path.join(".patch-backups", "GameScene-before-v525c.ts"),
  original,
  "utf8"
);
fs.writeFileSync(FILE, s, "utf8");

console.log("Applied v0.10.10.525c.");
console.log(" - minimal patch: Vulcan tactical BGM moved outside isOwner");
console.log(" - every Hunter/Hider receiving Vulcan active state now hears tactical BGM");
console.log(" - Sniper behavior untouched");
console.log(" - existing tactical BGM duplicate-play guard untouched");
console.log(" - no server change");
console.log("Next: npm run build");
