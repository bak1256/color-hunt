const fs = require("fs");
const path = require("path");

const FILE = path.join("src", "game", "GameScene.ts");
const MARK = "V1010525_GLOBAL_TACTICAL_BGM_MULTI_SUPPORT";

if (!fs.existsSync(FILE)) {
  throw new Error(`Missing ${FILE}. No file written.`);
}

let src = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");
const original = src;

if (src.includes(MARK)) {
  console.log("[skip] v0.10.10.525 already applied.");
  process.exit(0);
}

/*
 * 1) Add a helper that derives GLOBAL tactical-BGM ownership from the
 *    already-existing per-support state:
 *
 *    - local sniper
 *    - remote sniper session set
 *    - local Vulcan
 *    - remote Vulcan session set
 *
 *    This avoids a single Hunter ending his support from stopping the
 *    tactical score while another Hunter is still in Sniper/Vulcan.
 */
const startSig = "    private startSniperTacticalBgm(): void {";
const startAt = src.indexOf(startSig);
if (startAt < 0) {
  throw new Error("startSniperTacticalBgm() not found. No file written.");
}

const helper = `    /* ${MARK}
     * Tactical music is room-global on every client.
     * Keep it alive while ANY local/remote Sniper or Vulcan support is active.
     */
    private hasAnyActiveTacticalSupport(): boolean {
        return (
            this.sniperActive ||
            this.remoteSniperActiveSessionIds.size > 0 ||
            this.vulcanActive ||
            this.remoteVulcanActiveSessionIds.size > 0
        );
    }

    private syncGlobalTacticalBgm(): void {
        if (this.hasAnyActiveTacticalSupport()) {
            this.startSniperTacticalBgm();
            return;
        }

        this.stopSniperTacticalBgm(true);
    }

`;

src = src.slice(0, startAt) + helper + src.slice(startAt);

/*
 * 2) Vulcan activation:
 *    currently only isOwner starts tactical BGM.
 *    Start it BEFORE owner branching so every Hunter/Hider client that receives
 *    active Vulcan state hears the same global score.
 */
const vulcanNeedle = `                if (state.active) {
                    if (isOwner) {
                        this.startSniperTacticalBgm();`;

if (!src.includes(vulcanNeedle)) {
  throw new Error(
    "Current Vulcan owner-only tactical BGM activation block not found. No file written."
  );
}

src = src.replace(
  vulcanNeedle,
  `                if (state.active) {
                    /*
                     * ${MARK}
                     * Match Sniper behavior: Vulcan tactical music is GLOBAL.
                     * startSniperTacticalBgm() is idempotent while already playing,
                     * so another Hunter's Sniper/Vulcan cannot stack a second loop.
                     */
                    this.startSniperTacticalBgm();

                    if (isOwner) {`
);

/*
 * 3) Sniper deactivation:
 *    locate the onSniperState callback only, then inject a global BGM resync
 *    after that callback has updated local/remote active state.
 *
 *    We deliberately do not rewrite the cinematic behavior.
 */
const sniperCbStart = src.indexOf("            multiplayerClient.onSniperState(");
const sniperCbEnd = src.indexOf(
  "\n        this.networkUnsubscribers.push(",
  sniperCbStart + 10
);

if (sniperCbStart < 0 || sniperCbEnd < 0) {
  throw new Error("Sniper state callback range not found. No file written.");
}

let sniperBlock = src.slice(sniperCbStart, sniperCbEnd);

/* Find the callback's final state.active false cleanup tail. */
const sniperFalseCandidates = [
  `                    if (!state.active) {
                        this.remoteSniperActiveSessionIds.delete(state.sessionId);
                    }`,
  `                    if (!state.active) {
                        this.remoteSniperActiveSessionIds
                            .delete(state.sessionId);
                    }`
];

let sniperInjected = false;
for (const needle of sniperFalseCandidates) {
  if (sniperBlock.includes(needle)) {
    sniperBlock = sniperBlock.replace(
      needle,
      `${needle}

                    /*
                     * ${MARK}
                     * Do not restore Hunt BGM if another tactical support remains.
                     */
                    this.syncGlobalTacticalBgm();`
    );
    sniperInjected = true;
    break;
  }
}

/*
 * If exact formatting differs, inject immediately before the callback closes,
 * but only after proving the block contains both local and remote sniper state.
 */
if (!sniperInjected) {
  if (
    !sniperBlock.includes("this.sniperActive = state.active") ||
    !sniperBlock.includes("remoteSniperActiveSessionIds")
  ) {
    throw new Error(
      "Sniper callback shape differs; refusing unsafe BGM injection. No file written."
    );
  }

  const closePos = sniperBlock.lastIndexOf("                },");
  if (closePos < 0) {
    throw new Error("Sniper callback closing anchor not found. No file written.");
  }

  sniperBlock =
    sniperBlock.slice(0, closePos) +
    `                    /*
                     * ${MARK}
                     * Re-evaluate room-global tactical score after every Sniper state.
                     */
                    this.syncGlobalTacticalBgm();

` +
    sniperBlock.slice(closePos);
}

src =
  src.slice(0, sniperCbStart) +
  sniperBlock +
  src.slice(sniperCbEnd);

/*
 * 4) Vulcan deactivation:
 *    after local/remote Vulcan state is updated, resync instead of allowing one
 *    support ending to kill another support's music.
 */
const vulcanCbStart = src.indexOf(
  "            multiplayerClient.onVulcanState((state: NetworkVulcanState) => {"
);
const vulcanCbEnd = src.indexOf(
  "\n        this.networkUnsubscribers.push(",
  vulcanCbStart + 10
);

if (vulcanCbStart < 0 || vulcanCbEnd < 0) {
  throw new Error("Vulcan state callback range not found. No file written.");
}

let vulcanBlock = src.slice(vulcanCbStart, vulcanCbEnd);

if (
  !vulcanBlock.includes("remoteVulcanActiveSessionIds") ||
  !vulcanBlock.includes("this.vulcanActive")
) {
  throw new Error(
    "Vulcan callback state shape differs; refusing unsafe BGM injection. No file written."
  );
}

/*
 * Put one sync at callback tail. It is safe for active packets too:
 * startSniperTacticalBgm() sees isPlaying and does not stack.
 */
const vulcanClosePos = vulcanBlock.lastIndexOf("            });");
if (vulcanClosePos < 0) {
  throw new Error("Vulcan callback closing anchor not found. No file written.");
}

vulcanBlock =
  vulcanBlock.slice(0, vulcanClosePos) +
  `                /*
                 * ${MARK}
                 * Active -> ensure one global loop.
                 * Inactive -> restore Hunt only when no other Sniper/Vulcan remains.
                 */
                this.syncGlobalTacticalBgm();
` +
  vulcanBlock.slice(vulcanClosePos);

src =
  src.slice(0, vulcanCbStart) +
  vulcanBlock +
  src.slice(vulcanCbEnd);

/*
 * 5) Harden stopSniperTacticalBgm().
 *    Normal callers may request restore while another support remains active.
 *    In that case do NOT tear down the shared tactical score.
 *
 *    Result/round cleanup already uses explicit cleanup paths and clears support
 *    state; this guard is about overlapping live Hunt supports.
 */
const stopSig = `    private stopSniperTacticalBgm(
        restorePhaseMusic =
            true,
    ): void {`;

const stopAt = src.indexOf(stopSig);
if (stopAt < 0) {
  throw new Error("stopSniperTacticalBgm() not found. No file written.");
}

const stopBodyAt = stopAt + stopSig.length;
src =
  src.slice(0, stopBodyAt) +
  `
        /*
         * ${MARK}
         * Shared tactical loop: one support ending must not stop music owned by
         * another active Sniper/Vulcan. Forced result cleanup passes false and
         * therefore still tears audio down immediately.
         */
        if (
            restorePhaseMusic &&
            this.phase === 'hunt' &&
            this.hasAnyActiveTacticalSupport()
        ) {
            this.sniperTacticalBgmActive = true;

            if (
                this.audioUnlocked &&
                this.bgmEnabled &&
                this.sniperTacticalMusic &&
                !this.sniperTacticalMusic.isPlaying
            ) {
                this.huntMusic?.stop();
                this.paintMusic?.stop();
                this.lobbyMusic?.stop();
                this.backgroundMusic?.stop();
                this.sniperTacticalMusic.play();
            }

            return;
        }
` +
  src.slice(stopBodyAt);

/* Postconditions */
const required = [
  MARK,
  "private hasAnyActiveTacticalSupport(): boolean",
  "private syncGlobalTacticalBgm(): void",
  "this.remoteSniperActiveSessionIds.size > 0",
  "this.remoteVulcanActiveSessionIds.size > 0",
  "this.syncGlobalTacticalBgm();",
];

for (const needle of required) {
  if (!src.includes(needle)) {
    throw new Error(`Postcondition missing: ${needle}. No file written.`);
  }
}

/* Ensure Vulcan active path now starts BGM before owner branch. */
const finalVulcanStart = src.indexOf(
  "            multiplayerClient.onVulcanState((state: NetworkVulcanState) => {"
);
const finalVulcanSlice = src.slice(finalVulcanStart, finalVulcanStart + 1800);
const bgmPos = finalVulcanSlice.indexOf("this.startSniperTacticalBgm();");
const ownerPos = finalVulcanSlice.indexOf("if (isOwner)");

if (bgmPos < 0 || ownerPos < 0 || bgmPos > ownerPos) {
  throw new Error(
    "Postcondition failed: Vulcan global BGM is not before owner branch. No file written."
  );
}

fs.mkdirSync(".patch-backups", { recursive: true });
fs.writeFileSync(
  path.join(".patch-backups", "GameScene-before-v525.ts"),
  original,
  "utf8"
);
fs.writeFileSync(FILE, src, "utf8");

console.log("Applied v0.10.10.525.");
console.log(" - Vulcan tactical BGM now starts on EVERY Hunter/Hider client");
console.log(" - Sniper remains room-global");
console.log(" - Sniper + Vulcan + multiple Hunters share ONE tactical BGM loop");
console.log(" - ending one support no longer restores Hunt BGM while another support is active");
console.log(" - result cleanup can still force-stop tactical audio");
console.log("Next: npm run build");
