const fs = require("fs");
const path = require("path");

const GS = path.join("src", "game", "GameScene.ts");
const NPM = path.join("src", "multiplayer", "NetworkPlayerManager.ts");
const MARK = "V1010528_ATOMIC_PAINT_HUNT_AND_VULCAN_SELFVIEW_PACKET_AUTHORITY";

for (const file of [GS, NPM]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}. No file written.`);
  }
}

let gs = fs.readFileSync(GS, "utf8").replace(/\r\n/g, "\n");
let npm = fs.readFileSync(NPM, "utf8").replace(/\r\n/g, "\n");

const gsOriginal = gs;
const npmOriginal = npm;

if (gs.includes(MARK) || npm.includes(MARK)) {
  console.log("[skip] v0.10.10.528 already applied.");
  process.exit(0);
}

/* ============================================================
 * A. Paint -> Hunt atomic visual/position handoff
 * ============================================================ */

/*
 * NetworkPlayerManager: keep an explicit position lock that survives BOTH
 * normalizeLocalPlayerForGameplay() calls during Paint->Hunt.
 */
const localXYNeedle =
`  private localX = 480;
  private localY = 270;`;

if (!npm.includes(localXYNeedle)) {
  throw new Error("NetworkPlayerManager localX/localY anchor missing. No file written.");
}

npm = npm.replace(
  localXYNeedle,
`${localXYNeedle}

  /*
   * ${MARK} / HUNT_TRANSITION_POSITION_LOCK
   * Exact rendered Hider coordinate captured at the Paint deadline.
   * normalizeLocalPlayerForGameplay() must honor it until GameScene ends
   * the transition after startHunt().
   */
  private localHiderHuntTransitionLock:
    Phaser.Math.Vector2 | null = null;`,
  1,
);

/*
 * Add lock API immediately before normalizeLocalPlayerForGameplay().
 */
const normalizeSig =
`  normalizeLocalPlayerForGameplay(): void {`;

const normalizeAt = npm.indexOf(normalizeSig);

if (normalizeAt < 0) {
  throw new Error("normalizeLocalPlayerForGameplay() missing. No file written.");
}

const lockHelpers =
`  beginLocalHiderHuntTransitionLock(
    position: Phaser.Math.Vector2 | null,
  ): void {
    if (!position) {
      this.localHiderHuntTransitionLock = null;
      return;
    }

    const sessionId =
      this.getEffectiveLocalSessionId();

    const view =
      sessionId
        ? this.players.get(sessionId)
        : undefined;

    if (
      !view ||
      view.role !== "hider"
    ) {
      this.localHiderHuntTransitionLock = null;
      return;
    }

    this.localHiderHuntTransitionLock =
      new Phaser.Math.Vector2(
        Phaser.Math.Clamp(
          position.x,
          24,
          this.gameWidth - 24,
        ),
        Phaser.Math.Clamp(
          position.y,
          24,
          this.gameHeight - 24,
        ),
      );
  }

  endLocalHiderHuntTransitionLock(): void {
    const locked =
      this.localHiderHuntTransitionLock;

    if (!locked) {
      return;
    }

    const sessionId =
      this.getEffectiveLocalSessionId();

    const view =
      sessionId
        ? this.players.get(sessionId)
        : undefined;

    if (
      view &&
      view.role === "hider"
    ) {
      this.localX = locked.x;
      this.localY = locked.y;
      view.targetX = locked.x;
      view.targetY = locked.y;
      view.savedX = locked.x;
      view.savedY = locked.y;
      view.movingUntil = 0;

      this.setViewPosition(
        view,
        locked.x,
        locked.y,
      );

      this.localMovementInitialized = true;
      this.localWasMoving = false;
      this.lastLocalMoveInputAt = 0;
      this.recentSentPositions = [];

      if (!this.practiceLocalSessionId) {
        multiplayerClient.sendMove(
          locked.x,
          locked.y,
        );

        this.rememberSentPosition(
          locked.x,
          locked.y,
        );

        this.lastSendTime =
          this.scene.time.now;
      }
    }

    this.localHiderHuntTransitionLock = null;
  }

`;

npm =
  npm.slice(0, normalizeAt) +
  lockHelpers +
  npm.slice(normalizeAt);

/*
 * Make normalize use the locked coordinate instead of stale server targetX/Y.
 */
const normalizePositionNeedle =
`    this.localX = view.targetX;
    this.localY = view.targetY;
    this.localMovementInitialized = true;

    view.container
      .setScale(1)
      .setDepth(
        view.role === "hunter"
          ? 160
          : 120,
      )
      .setPosition(
        view.targetX,
        view.targetY,
      )
      .setVisible(true);`;

if (!npm.includes(normalizePositionNeedle)) {
  throw new Error("normalize position block shape differs. No file written.");
}

npm = npm.replace(
  normalizePositionNeedle,
`    const transitionPosition =
      view.role === "hider"
        ? this.localHiderHuntTransitionLock
        : null;

    const normalizedX =
      transitionPosition?.x ??
      view.targetX;

    const normalizedY =
      transitionPosition?.y ??
      view.targetY;

    /*
     * ${MARK}
     * A stale Schema target must never yank the Hider between the two
     * Paint->Hunt normalize passes.
     */
    this.localX = normalizedX;
    this.localY = normalizedY;
    this.localMovementInitialized = true;

    if (transitionPosition) {
      view.targetX = normalizedX;
      view.targetY = normalizedY;
      view.savedX = normalizedX;
      view.savedY = normalizedY;
    }

    view.container
      .setScale(1)
      .setDepth(
        view.role === "hunter"
          ? 160
          : 120,
      )
      .setPosition(
        normalizedX,
        normalizedY,
      )
      .setVisible(true);`,
  1,
);

/*
 * GameScene: current 527 should already capture preHuntLocalHiderPosition.
 * If it exists, strengthen it. If not, inject equivalent capture.
 */
const finishAnchor =
`            this.finishActivePaintStroke();
            this.isPainting = false;`;

if (!gs.includes(finishAnchor)) {
  throw new Error("Paint->Hunt finishActivePaintStroke anchor missing. No file written.");
}

if (gs.includes("const preHuntLocalHiderPosition")) {
  /*
   * Add active-stroke capture immediately before finish.
   */
  const captureBlockRe =
/(\s*const preHuntLocalHiderPosition\s*=[\s\S]*?: null;\s*)/m;

  const match = gs.match(captureBlockRe);

  if (!match) {
    throw new Error("Existing preHuntLocalHiderPosition block could not be isolated. No file written.");
  }

  const old = match[1];

  const replacement =
`${old}
            /*
             * ${MARK} / PRESERVE_LIVE_PAINT_RASTER
             *
             * If the deadline arrives while a brush is physically held down,
             * the RenderTexture currently on screen is already the exact final
             * camouflage. Commit the stroke, but DO NOT white-reset/replay it
             * during this same handoff.
             */
            const hadLivePaintStrokeAtHuntBoundary =
                this.isPainting ||
                this.activeStrokePoints.length > 0 ||
                this.currentStrokeHistoryPoints.length > 0;

            this.networkPlayerManager
                .beginLocalHiderHuntTransitionLock(
                    preHuntLocalHiderPosition,
                );
`;

  gs = gs.replace(old, replacement, 1);
} else {
  gs = gs.replace(
    finishAnchor,
`            const preHuntLocalHiderPosition =
                (
                    this.networkPlayerManager.isLocalHider() ||
                    multiplayerClient.getLocalPlayer()?.role === 'hider'
                )
                    ? this.networkPlayerManager.getLocalPlayerPosition()
                    : null;

            const hadLivePaintStrokeAtHuntBoundary =
                this.isPainting ||
                this.activeStrokePoints.length > 0 ||
                this.currentStrokeHistoryPoints.length > 0;

            this.networkPlayerManager
                .beginLocalHiderHuntTransitionLock(
                    preHuntLocalHiderPosition,
                );

${finishAnchor}`,
    1,
  );
}

/*
 * Existing v497 post-start rebuild:
 * only rebuild when there was NO live stroke at the forced boundary.
 *
 * This removes the visible white body -> replay -> shifted texture sequence.
 */
const rebuildNeedle =
`            if (
                shouldRestoreLocalHiderPaintAfterHuntStart
            ) {
                this.rebuildLocalPaintFromHistory(
                    false,
                );
            }

            this.startGameplayCamera();`;

if (!gs.includes(rebuildNeedle)) {
  throw new Error("Post-startHunt paint rebuild block missing. No file written.");
}

gs = gs.replace(
  rebuildNeedle,
`            if (
                shouldRestoreLocalHiderPaintAfterHuntStart &&
                !hadLivePaintStrokeAtHuntBoundary
            ) {
                this.rebuildLocalPaintFromHistory(
                    false,
                );
            }

            /*
             * ${MARK}
             * Both normalize passes are finished. Publish one final position
             * and release the transition lock only now.
             */
            this.networkPlayerManager
                .endLocalHiderHuntTransitionLock();

            this.startGameplayCamera();`,
  1,
);

/*
 * Remove the old 527 one-shot post-start latch call if present; the persistent
 * lock above supersedes it and protects both normalize passes.
 */
gs = gs.replace(
/\s*if \(preHuntLocalHiderPosition\) \{\s*this\.networkPlayerManager\s*\.latchLocalHiderPositionForHunt\(\s*preHuntLocalHiderPosition,\s*\);\s*\}\s*/m,
"\n",
);

/* ============================================================
 * B. Hider own-view Vulcan: packet-authoritative visibility
 * ============================================================ */

if (!gs.includes("updateRemoteVulcanSelfViewVfx")) {
  throw new Error(
    "v526 Hider self-view Vulcan renderer missing. Apply v526 first. No file written."
  );
}

/* Track actual aim packet freshness. */
const aimMapField =
`    private readonly remoteVulcanAimBySessionId = new Map<string, { x: number; y: number }>();`;

if (!gs.includes(aimMapField)) {
  throw new Error("remoteVulcanAimBySessionId field missing. No file written.");
}

gs = gs.replace(
  aimMapField,
`${aimMapField}

    /*
     * ${MARK} / VULCAN_PACKET_AUTHORITY
     * A fresh vulcan_aim packet is itself proof that this Hunter is currently
     * operating Vulcan. Do not depend only on vulcan_state delivery timing.
     */
    private readonly remoteVulcanAimSeenAtBySessionId =
        new Map<string, number>();`,
  1,
);

/* Every remote aim packet refreshes liveness. */
const aimSetNeedle =
`                this.remoteVulcanAimBySessionId.set(
                    aim.sessionId,
                    {
                        x: Phaser.Math.Clamp(aim.x, 0, 960),
                        y: Phaser.Math.Clamp(aim.y, 0, 540),
                    },
                );`;

if (!gs.includes(aimSetNeedle)) {
  throw new Error("onVulcanAim map-set anchor missing. No file written.");
}

gs = gs.replace(
  aimSetNeedle,
`${aimSetNeedle}

                if (
                    aim.sessionId !==
                    multiplayerClient.getSessionId()
                ) {
                    this.remoteVulcanAimSeenAtBySessionId
                        .set(
                            aim.sessionId,
                            Date.now(),
                        );
                }`,
  1,
);

/*
 * Replace 526's activeIds source. Candidate remote Vulcan Hunters are:
 * - explicit active state OR
 * - firing state OR
 * - fresh aim packet (<= 900ms)
 *
 * vulcan_aim is mode-specific, so this is safe and far more robust.
 */
const activeIdsNeedle =
`        const activeIds =
            Array.from(
                this.remoteVulcanActiveSessionIds,
            );`;

if (!gs.includes(activeIdsNeedle)) {
  throw new Error("v526 activeIds source not found. No file written.");
}

gs = gs.replace(
  activeIdsNeedle,
`        const now =
            Date.now();

        const activeIdSet =
            new Set<string>([
                ...this.remoteVulcanActiveSessionIds,
                ...this.remoteVulcanFiringSessionIds,
            ]);

        this.remoteVulcanAimSeenAtBySessionId
            .forEach(
                (
                    seenAt,
                    sessionId,
                ) => {
                    if (
                        now - seenAt <=
                        900
                    ) {
                        activeIdSet.add(
                            sessionId,
                        );
                    }
                },
            );

        const localSessionId =
            multiplayerClient.getSessionId();

        if (localSessionId) {
            activeIdSet.delete(
                localSessionId,
            );
        }

        const activeIds =
            Array.from(
                activeIdSet,
            );`,
  1,
);

/*
 * 526 later declares `const now = Date.now();`; now is already declared above.
 */
const duplicateNow =
`        const now =
            Date.now();

        for (const sessionId of activeIds) {`;

if (!gs.includes(duplicateNow)) {
  throw new Error("v526 now/loop anchor missing. No file written.");
}

gs = gs.replace(
  duplicateNow,
`        for (const sessionId of activeIds) {`,
  1,
);

/*
 * Stale-light cleanup currently checks only remoteVulcanActiveSessionIds.
 * Change it to packet-authoritative activeIdSet.
 */
const staleNeedle =
`                    if (
                        !this.remoteVulcanActiveSessionIds
                            .has(sessionId)
                    ) {`;

if (!gs.includes(staleNeedle)) {
  throw new Error("v526 stale passive-light cleanup anchor missing. No file written.");
}

gs = gs.replace(
  staleNeedle,
`                    if (
                        !activeIdSet.has(
                            sessionId,
                        )
                    ) {`,
  1,
);

/*
 * Make the circle/ellipse outline impossible to miss, even over a bright map.
 */
const lineNeedle =
`        graphics.lineStyle(
            2,
            0xffefaa,
            0.72,
        );`;

if (!gs.includes(lineNeedle)) {
  throw new Error("v526 passive spotlight outline style missing. No file written.");
}

gs = gs.replace(
  lineNeedle,
`        graphics.lineStyle(
            4,
            0xfff3a8,
            0.98,
        );`,
  1,
);

/*
 * Cleanup freshness map on full passive VFX cleanup.
 */
const clearNeedle =
`        this.remoteVulcanSelfViewLastFxAt.clear();`;

if (!gs.includes(clearNeedle)) {
  throw new Error("v526 passive VFX cleanup anchor missing. No file written.");
}

gs = gs.replace(
  clearNeedle,
`${clearNeedle}
        this.remoteVulcanAimSeenAtBySessionId.clear();`,
  1,
);

/* Top markers. */
gs =
`/* ${MARK}: atomic held-stroke Paint->Hunt handoff + packet-authoritative Hider self-view Vulcan VFX. */\n` +
gs;

npm =
`/* ${MARK}: persistent local-Hider transition position lock across both normalize passes. */\n` +
npm;

/* Validation. */
const validations = [
  [npm, "position lock field", /localHiderHuntTransitionLock/],
  [npm, "begin lock", /beginLocalHiderHuntTransitionLock/],
  [npm, "end lock", /endLocalHiderHuntTransitionLock/],
  [npm, "normalize respects lock", /const transitionPosition[\s\S]{0,300}?localHiderHuntTransitionLock/],
  [gs, "held paint detection", /hadLivePaintStrokeAtHuntBoundary/],
  [gs, "skip rebuild on held stroke", /shouldRestoreLocalHiderPaintAfterHuntStart &&[\s\S]{0,100}?!hadLivePaintStrokeAtHuntBoundary/],
  [gs, "packet freshness map", /remoteVulcanAimSeenAtBySessionId/],
  [gs, "fresh aim active", /now - seenAt <=\s*900/],
  [gs, "firing state active", /\.\.\.this\.remoteVulcanFiringSessionIds/],
  [gs, "visible outline", /lineStyle\(\s*4,\s*0xfff3a8,\s*0\.98/],
];

for (const [text, label, re] of validations) {
  if (!re.test(text)) {
    throw new Error(`Postcondition failed: ${label}. No file written.`);
  }
}

/* Backups + writes only after every verification succeeds. */
fs.mkdirSync(".patch-backups", { recursive: true });

fs.writeFileSync(
  path.join(".patch-backups", "GameScene-before-v528.ts"),
  gsOriginal,
  "utf8",
);

fs.writeFileSync(
  path.join(".patch-backups", "NetworkPlayerManager-before-v528.ts"),
  npmOriginal,
  "utf8",
);

fs.writeFileSync(GS, gs, "utf8");
fs.writeFileSync(NPM, npm, "utf8");

console.log("Applied v0.10.10.528.");
console.log(" - Paint->Hunt local Hider position is locked across BOTH normalize passes");
console.log(" - mouse-held deadline transition commits final stroke without white-reset/replay");
console.log(" - live RenderTexture is preserved when Paint expires mid-stroke");
console.log(" - final Hider coordinate is sent once after Hunt transition completes");
console.log(" - Hider own-view Vulcan no longer depends solely on vulcan_state");
console.log(" - fresh vulcan_aim OR firing-state keeps remote searchlight alive");
console.log(" - bright-map searchlight outline strengthened to 4px / 98% alpha");
console.log(" - remote firing still drives the same tracer/impact presentation");
console.log(" - v526 result/victory cleanup remains in place");
console.log(" - server source unchanged");
console.log("Next: npm run build");
