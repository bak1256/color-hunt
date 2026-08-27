const fs = require("fs");
const path = require("path");

const GS = path.join("src", "game", "GameScene.ts");
const NPM = path.join("src", "multiplayer", "NetworkPlayerManager.ts");
const MARK = "V1010527_PAINT_HUNT_POSITION_LATCH_HIDER_VULCAN_SELFVIEW";

for (const f of [GS, NPM]) {
  if (!fs.existsSync(f)) throw new Error(`Missing ${f}. No file written.`);
}

let gs = fs.readFileSync(GS, "utf8").replace(/\r\n/g, "\n");
let npm = fs.readFileSync(NPM, "utf8").replace(/\r\n/g, "\n");
const gs0 = gs, npm0 = npm;

if (gs.includes(MARK) || npm.includes(MARK)) {
  console.log("[skip] v0.10.10.527 already applied.");
  process.exit(0);
}

/* ================================================================
 * A) Paint -> Hunt: latch the exact rendered local Hider position.
 * ================================================================ */

/* Add a manager method before stabilizeHidersForHunt(). */
const stabSig = "  stabilizeHidersForHunt(): void {";
const stabAt = npm.indexOf(stabSig);
if (stabAt < 0) throw new Error("stabilizeHidersForHunt() missing. No file written.");

const managerHelper = `  /*
   * ${MARK} / LOCAL_HIDER_TRANSITION_POSITION_LATCH
   *
   * Paint may end while the mouse/finger is still held. During the same
   * transition GameScene performs authoritative resync + normalize passes.
   * Preserve the exact last rendered hiding position across those passes and
   * rebase local prediction to it atomically.
   */
  latchLocalHiderPositionForHunt(
    position: Phaser.Math.Vector2 | null,
  ): void {
    if (!position) {
      return;
    }

    const sessionId =
      this.getEffectiveLocalSessionId();

    if (!sessionId) {
      return;
    }

    const view =
      this.players.get(sessionId);

    if (
      !view ||
      view.role !== "hider"
    ) {
      return;
    }

    const x =
      Phaser.Math.Clamp(
        position.x,
        24,
        this.gameWidth - 24,
      );

    const y =
      Phaser.Math.Clamp(
        position.y,
        24,
        this.gameHeight - 24,
      );

    this.localX = x;
    this.localY = y;
    view.targetX = x;
    view.targetY = y;
    view.savedX = x;
    view.savedY = y;
    view.movingUntil = 0;
    view.huntFrozenX = undefined;
    view.huntFrozenY = undefined;

    this.setViewPosition(
      view,
      x,
      y,
    );

    this.localMovementInitialized = true;
    this.localWasMoving = false;
    this.lastLocalMoveInputAt = 0;
    this.lastSendTime = this.scene.time.now;
    this.recentSentPositions = [];

    /*
     * Make the server/Hunters converge on the same hiding coordinate too.
     * One final move packet is enough; this is NOT paint snapshot traffic.
     */
    if (!this.practiceLocalSessionId) {
      multiplayerClient.sendMove(
        x,
        y,
      );

      this.rememberSentPosition(
        x,
        y,
      );
    }
  }

`;

npm = npm.slice(0, stabAt) + managerHelper + npm.slice(stabAt);

/* Capture before final stroke/transition machinery can alter visual state. */
const huntStrokeAnchor =
`            /*
             * HOTFIX: Hunt can begin before the painter's final pointer-up.
             * Finish the last stroke first, then rebroadcast the Hider's
             * complete authoritative paint history. Hunter clients therefore
             * enter Hunt with the exact final camouflage the Hider sees.
             */
            this.finishActivePaintStroke();
            this.isPainting = false;`;

if (!gs.includes(huntStrokeAnchor)) {
  throw new Error("Paint->Hunt final-stroke anchor missing. No file written.");
}

gs = gs.replace(
  huntStrokeAnchor,
`            /*
             * ${MARK} / CAPTURE_PRE_TRANSITION_HIDER_POSITION
             *
             * Capture BEFORE finishActivePaintStroke()/resync/normalize.
             * A held drawing pointer must never be able to shift the Hider's
             * hiding coordinate when Paint is force-ended by the server timer.
             */
            const preHuntLocalHiderPosition =
                (
                    this.networkPlayerManager.isLocalHider() ||
                    multiplayerClient.getLocalPlayer()?.role === 'hider'
                )
                    ? this.networkPlayerManager.getLocalPlayerPosition()
                    : null;

${huntStrokeAnchor}`,
  1
);

/* Restore after startHunt()'s final normalization, before paint raster rebuild/camera. */
const afterStartAnchor =
`            this.startHunt();

            /*
             * V1010497_DESKTOP_ASSIST_POSITION_LOCAL_HIDER_HUNT_PAINT_FIX / LOCAL_HIDER_FINAL_RASTER_AFTER_ALL_NORMALIZE`;

if (!gs.includes(afterStartAnchor)) {
  throw new Error("Post-startHunt local paint restore anchor missing. No file written.");
}

gs = gs.replace(
  afterStartAnchor,
`            this.startHunt();

            /*
             * ${MARK} / RESTORE_PRE_TRANSITION_HIDER_POSITION
             *
             * startHunt() performs its own normalization. Re-latch only after
             * that final pass, then rebuild camouflage at the same coordinate.
             */
            if (preHuntLocalHiderPosition) {
                this.networkPlayerManager
                    .latchLocalHiderPositionForHunt(
                        preHuntLocalHiderPosition,
                    );
            }

            /*
             * V1010497_DESKTOP_ASSIST_POSITION_LOCAL_HIDER_HUNT_PAINT_FIX / LOCAL_HIDER_FINAL_RASTER_AFTER_ALL_NORMALIZE`,
  1
);

/* ================================================================
 * B) Hider ORIGINAL view Vulcan VFX: fix overly-strict self-view gate.
 * 526 required getLocalPlayer()?.role AND empty spectatorSessionId.
 * spectatorSessionId may remain selected even while the player is back in
 * his own camera, and schema role can briefly lag. Use the same role fallback
 * as the rest of GameScene + actual Vulcan spectator flag.
 * ================================================================ */

const old526Gate =
`        const shouldShow =
            this.phase === 'hunt' &&
            this.roundResultWinner === null &&
            localPlayer?.role === 'hider' &&
            !this.spectatorSessionId &&
            !this.vulcanSpectatorViewActive;`;

const new526Gate =
`        const shouldShow =
            this.phase === 'hunt' &&
            this.roundResultWinner === null &&
            (
                localPlayer?.role === 'hider' ||
                this.networkPlayerManager.isLocalHider()
            ) &&
            /*
             * ${MARK} / TRUE_SELF_VIEW_GATE
             *
             * spectatorSessionId can remain populated as the selected Hunter
             * even after the Hider returns to his own camera. The real switch
             * that means "Vulcan aerial spectator renderer owns the screen" is
             * vulcanSpectatorViewActive.
             */
            !this.vulcanSpectatorViewActive;`;

if (gs.includes(old526Gate)) {
  gs = gs.replace(old526Gate, new526Gate, 1);
} else {
  /*
   * If 526 was not applied yet, stop safely. 527 depends on its passive
   * self-view renderer and should not silently invent a second implementation.
   */
  if (!gs.includes("updateRemoteVulcanSelfViewVfx")) {
    throw new Error(
      "v526 Hider self-view Vulcan renderer is not present. Apply 526 first. No file written."
    );
  }

  throw new Error(
    "v526 self-view gate shape differs. Please send current GameScene.ts. No file written."
  );
}

/* Make passive self-view light unmistakably visible above normal Hider vision. */
const oldDepth = `.setDepth(24992)
            .setPosition(x, y)`;
if (!gs.includes(oldDepth)) {
  throw new Error("v526 passive spotlight depth anchor missing. No file written.");
}
gs = gs.replace(
  oldDepth,
  `.setDepth(25020)
            .setPosition(x, y)`,
  1
);

/* Put passive impacts above the passive beam if the shared impact helper is lower. */
const impactCall =
`                this.spawnVulcanPresentationImpact(
                    display.x,
                    display.y,
                    false,
                );`;

if (!gs.includes(impactCall)) {
  throw new Error("v526 passive Vulcan impact call missing. No file written.");
}

/* Top markers. */
gs = `/* ${MARK}: force-ended Paint keeps exact Hider hiding position; Hider own-view remote Vulcan VFX uses true camera-state gate. */\n` + gs;
npm = `/* ${MARK}: atomic local-Hider position latch for Paint->Hunt transition. */\n` + npm;

/* Validation */
const checks = [
  [npm, "manager latch", /latchLocalHiderPositionForHunt/],
  [npm, "prediction rebase", /this\.localX = x;[\s\S]{0,120}?this\.localY = y;/],
  [npm, "server convergence", /multiplayerClient\.sendMove\([\s\S]{0,80}?x,[\s\S]{0,80}?y/],
  [gs, "pre-Hunt capture", /const preHuntLocalHiderPosition/],
  [gs, "post-Hunt restore", /latchLocalHiderPositionForHunt\(/],
  [gs, "role fallback", /localPlayer\?\.role === 'hider'[\s\S]{0,120}?isLocalHider\(\)/],
  [gs, "true spectator gate", /!this\.vulcanSpectatorViewActive/],
  [gs, "passive impact", /spawnVulcanPresentationImpact\([\s\S]{0,100}?display\.x/],
  [gs, "passive light depth", /setDepth\(25020\)/],
];
for (const [text, label, re] of checks) {
  if (!re.test(text)) throw new Error(`Postcondition failed: ${label}. No file written.`);
}

fs.mkdirSync(".patch-backups", { recursive: true });
fs.writeFileSync(path.join(".patch-backups", "GameScene-before-v527.ts"), gs0, "utf8");
fs.writeFileSync(path.join(".patch-backups", "NetworkPlayerManager-before-v527.ts"), npm0, "utf8");
fs.writeFileSync(GS, gs, "utf8");
fs.writeFileSync(NPM, npm, "utf8");

console.log("Applied v0.10.10.527.");
console.log(" - Paint timer force-transition latches exact local Hider world position");
console.log(" - final held paint stroke is still committed normally");
console.log(" - post-startHunt normalization can no longer visually/server-shift the Hider");
console.log(" - Hider original self-view Vulcan gate no longer depends on stale spectatorSessionId");
console.log(" - role fallback handles brief schema-role lag");
console.log(" - passive remote searchlight raised above normal Hider vision");
console.log(" - remote Vulcan impact/tracer presentation remains tied to shared firing state");
console.log(" - victory/result cleanup from v526 remains untouched");
console.log(" - no server source change");
console.log("Next: npm run build");
