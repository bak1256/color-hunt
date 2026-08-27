const fs = require("fs");
const path = require("path");

const FILE = path.join("src", "game", "GameScene.ts");
const MARK = "V1010525B_GLOBAL_TACTICAL_BGM_MULTI_SUPPORT_EXACT";

if (!fs.existsSync(FILE)) {
  throw new Error(`Missing ${FILE}. No file written.`);
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");
const original = s;

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.525b already applied.");
  process.exit(0);
}

/* Add shared-state helpers before startSniperTacticalBgm(). */
const startSig = "    private startSniperTacticalBgm(): void {";
const startAt = s.indexOf(startSig);
if (startAt < 0) {
  throw new Error("startSniperTacticalBgm() not found. No file written.");
}

const helper = `    /* ${MARK}
     * One tactical score per client while ANY Hunter support is active.
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

s = s.slice(0, startAt) + helper + s.slice(startAt);

/*
 * Exact current Sniper callback tail:
 * state has already updated local/remote sets here.
 */
const sniperTail = `                    if (!state.active) {
                        this.remoteSniperScopes.get(state.sessionId)?.destroy();
                        this.remoteSniperScopes.delete(state.sessionId);
                        this.remoteSniperAimBySessionId
                            .delete(state.sessionId);
                    }
                },
            ),
        );`;

if (!s.includes(sniperTail)) {
  throw new Error("Exact Sniper callback tail not found. No file written.");
}

s = s.replace(
  sniperTail,
`                    if (!state.active) {
                        this.remoteSniperScopes.get(state.sessionId)?.destroy();
                        this.remoteSniperScopes.delete(state.sessionId);
                        this.remoteSniperAimBySessionId
                            .delete(state.sessionId);
                    }

                    /*
                     * ${MARK}
                     * Ending one Sniper must not restore Hunt music while
                     * another Sniper/Vulcan is still active.
                     */
                    this.syncGlobalTacticalBgm();
                },
            ),
        );`,
  1
);

/*
 * Exact current Vulcan activation:
 * move BGM start outside isOwner so ALL clients hear it.
 */
const vulcanStart = `                if (state.active) {
                    if (isOwner) {
                        this.startSniperTacticalBgm();
                        this.vulcanSupportCommitted = true;`;

if (!s.includes(vulcanStart)) {
  throw new Error("Exact Vulcan activation block not found. No file written.");
}

s = s.replace(
  vulcanStart,
`                if (state.active) {
                    /*
                     * ${MARK}
                     * Vulcan is room-global exactly like Sniper.
                     */
                    this.startSniperTacticalBgm();

                    if (isOwner) {
                        this.vulcanSupportCommitted = true;`,
  1
);

/*
 * Exact current Vulcan callback ending from the actual source:
 *     }),
 *   );
 * not "});" as the failed v525 assumed.
 */
const vulcanTail = `                if (isOwner) {
                    this.sniperButton?.setVisible(false);
                    this.vulcanButton?.setVisible(false);
                }
            }),
        );`;

if (!s.includes(vulcanTail)) {
  throw new Error("Exact Vulcan callback tail not found. No file written.");
}

s = s.replace(
  vulcanTail,
`                if (isOwner) {
                    this.sniperButton?.setVisible(false);
                    this.vulcanButton?.setVisible(false);
                }

                /*
                 * ${MARK}
                 * Active packet keeps one tactical loop alive.
                 * Inactive packet restores Hunt only when nobody else remains.
                 */
                this.syncGlobalTacticalBgm();
            }),
        );`,
  1
);

/*
 * Harden normal stop calls during Hunt.
 * Result cleanup calls stopSniperTacticalBgm(false), so victory cleanup
 * still force-stops immediately.
 */
const stopSig = `    private stopSniperTacticalBgm(
        restorePhaseMusic =
            true,
    ): void {`;

const stopAt = s.indexOf(stopSig);
if (stopAt < 0) {
  throw new Error("stopSniperTacticalBgm() not found. No file written.");
}

const stopBody = stopAt + stopSig.length;
s =
  s.slice(0, stopBody) +
`
        /*
         * ${MARK}
         * Shared tactical music cannot be stopped by one Hunter while another
         * active support still owns it.
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
  s.slice(stopBody);

/* Marker at file top. */
s =
  `/* ${MARK}: global Sniper/Vulcan tactical BGM with overlap-safe ownership. */\n` +
  s;

/* Postconditions. */
const checks = [
  ["helper", /private hasAnyActiveTacticalSupport\(\): boolean/],
  ["remote sniper ownership", /remoteSniperActiveSessionIds\.size > 0/],
  ["remote Vulcan ownership", /remoteVulcanActiveSessionIds\.size > 0/],
  ["sync helper", /private syncGlobalTacticalBgm\(\): void/],
  ["Vulcan global start", /if \(state\.active\) \{[\s\S]{0,350}?this\.startSniperTacticalBgm\(\);[\s\S]{0,200}?if \(isOwner\)/],
  ["Sniper callback sync", /remoteSniperAimBySessionId[\s\S]{0,250}?this\.syncGlobalTacticalBgm\(\);/],
  ["Vulcan callback sync", /this\.vulcanButton\?\.setVisible\(false\);[\s\S]{0,350}?this\.syncGlobalTacticalBgm\(\);/],
];

for (const [label, re] of checks) {
  if (!re.test(s)) {
    throw new Error(`Postcondition failed: ${label}. No file written.`);
  }
}

fs.mkdirSync(".patch-backups", { recursive: true });
fs.writeFileSync(
  path.join(".patch-backups", "GameScene-before-v525b.ts"),
  original,
  "utf8"
);
fs.writeFileSync(FILE, s, "utf8");

console.log("Applied v0.10.10.525b.");
console.log(" - fixed v525 callback-anchor assumption");
console.log(" - Vulcan BGM now starts on every Hunter/Hider client");
console.log(" - Sniper/Vulcan/multiple Hunters share one tactical BGM");
console.log(" - one support ending cannot interrupt another active support");
console.log(" - result cleanup with restorePhaseMusic=false still force-stops tactical audio");
console.log("Next: npm run build");
