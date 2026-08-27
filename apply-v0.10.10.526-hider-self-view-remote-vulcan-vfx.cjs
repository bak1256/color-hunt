const fs = require("fs");
const path = require("path");

const FILE = path.join("src", "game", "GameScene.ts");
const MARK = "V1010526_HIDER_SELF_VIEW_REMOTE_VULCAN_VFX";

if (!fs.existsSync(FILE)) {
  throw new Error(`Missing ${FILE}. Run from color-hunt root. No file written.`);
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");
const original = s;

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.526 already applied.");
  process.exit(0);
}

/* ------------------------------------------------------------------
 * 1) Fields: independent passive VFX for Hider's ORIGINAL self-view.
 *    Do NOT reuse vulcanSpotlight/vulcanDarkness because those belong to
 *    owner/spectator aerial camera mode.
 * ------------------------------------------------------------------ */
const fieldNeedle =
`    private readonly remoteVulcanAimBySessionId = new Map<string, { x: number; y: number }>();`;

if (!s.includes(fieldNeedle)) {
  throw new Error("remoteVulcanAimBySessionId field anchor not found. No file written.");
}

s = s.replace(
  fieldNeedle,
`${fieldNeedle}

    /* ${MARK}
     * Passive world-space searchlights visible from a Hider's own camera.
     * One Graphics per remote Vulcan Hunter so multi-Hunter support is safe.
     */
    private readonly remoteVulcanSelfViewLights =
        new Map<string, Phaser.GameObjects.Graphics>();

    private readonly remoteVulcanSelfViewDisplayAim =
        new Map<string, { x: number; y: number }>();

    private readonly remoteVulcanSelfViewLastFxAt =
        new Map<string, number>();`,
  1
);

/* ------------------------------------------------------------------
 * 2) Add helpers immediately before updateVulcanAirSupport().
 * ------------------------------------------------------------------ */
const updateSig = "    private updateVulcanAirSupport(): void {";
const updateAt = s.indexOf(updateSig);

if (updateAt < 0) {
  throw new Error("updateVulcanAirSupport() not found. No file written.");
}

const helpers = `    /* ${MARK}
     * Draw ONLY the visible beam footprint in normal Hider self-view.
     * No aerial zoom, no darkness replacement, no camera orbit.
     */
    private drawRemoteVulcanSelfViewLight(
        graphics: Phaser.GameObjects.Graphics,
        x: number,
        y: number,
    ): void {
        const dx = x - 480;
        const dy = y - 270;

        const t =
            Phaser.Math.Clamp(
                Math.hypot(dx, dy) /
                    Math.hypot(480, 270),
                0,
                1,
            );

        const angle =
            Math.atan2(dy, dx);

        /*
         * Keep the SAME current Vulcan footprint proportions:
         * center = circle, farther from center = directional ellipse.
         */
        const major =
            Phaser.Math.Linear(
                144,
                350,
                t,
            );

        const minor =
            Phaser.Math.Linear(
                144,
                86,
                t,
            );

        graphics
            .clear()
            .setVisible(true)
            .setDepth(24992)
            .setPosition(x, y)
            .setRotation(angle);

        /*
         * Hider's own view already has its normal visibility treatment.
         * Add a clean warm beam footprint above it instead of replacing the
         * whole screen with Vulcan aerial darkness.
         */
        graphics.fillStyle(
            0xfff3b0,
            0.22,
        );

        graphics.fillEllipse(
            0,
            0,
            major,
            minor,
        );

        graphics.fillStyle(
            0xfff9d6,
            0.15,
        );

        graphics.fillEllipse(
            0,
            0,
            major * 0.72,
            minor * 0.72,
        );

        graphics.lineStyle(
            2,
            0xffefaa,
            0.72,
        );

        graphics.strokeEllipse(
            0,
            0,
            major,
            minor,
        );
    }

    private clearRemoteVulcanSelfViewVfx(): void {
        this.remoteVulcanSelfViewLights
            .forEach(
                (graphics) => {
                    graphics.destroy();
                },
            );

        this.remoteVulcanSelfViewLights.clear();
        this.remoteVulcanSelfViewDisplayAim.clear();
        this.remoteVulcanSelfViewLastFxAt.clear();
    }

    private updateRemoteVulcanSelfViewVfx(): void {
        const localPlayer =
            multiplayerClient.getLocalPlayer();

        /*
         * Requirement: only Hider ORIGINAL self-view.
         * If TAB/view-switch is watching a Hunter, the existing spectator
         * Vulcan renderer remains authoritative and we must not double-draw.
         */
        const shouldShow =
            this.phase === 'hunt' &&
            this.roundResultWinner === null &&
            localPlayer?.role === 'hider' &&
            !this.spectatorSessionId &&
            !this.vulcanSpectatorViewActive;

        if (!shouldShow) {
            this.clearRemoteVulcanSelfViewVfx();
            return;
        }

        const activeIds =
            Array.from(
                this.remoteVulcanActiveSessionIds,
            );

        /*
         * Destroy stale lights immediately when a Hunter leaves Vulcan mode.
         */
        this.remoteVulcanSelfViewLights
            .forEach(
                (graphics, sessionId) => {
                    if (
                        !this.remoteVulcanActiveSessionIds
                            .has(sessionId)
                    ) {
                        graphics.destroy();

                        this.remoteVulcanSelfViewLights
                            .delete(sessionId);

                        this.remoteVulcanSelfViewDisplayAim
                            .delete(sessionId);

                        this.remoteVulcanSelfViewLastFxAt
                            .delete(sessionId);
                    }
                },
            );

        const now =
            Date.now();

        for (const sessionId of activeIds) {
            const aim =
                this.remoteVulcanAimBySessionId
                    .get(sessionId);

            if (!aim) {
                continue;
            }

            let display =
                this.remoteVulcanSelfViewDisplayAim
                    .get(sessionId);

            if (!display) {
                display = {
                    x: aim.x,
                    y: aim.y,
                };

                this.remoteVulcanSelfViewDisplayAim
                    .set(
                        sessionId,
                        display,
                    );
            }

            /*
             * Match the weighted/lagged searchlight feeling of the aerial view.
             */
            display.x =
                Phaser.Math.Linear(
                    display.x,
                    aim.x,
                    0.22,
                );

            display.y =
                Phaser.Math.Linear(
                    display.y,
                    aim.y,
                    0.22,
                );

            let light =
                this.remoteVulcanSelfViewLights
                    .get(sessionId);

            if (!light) {
                light =
                    this.add.graphics();

                this.remoteVulcanSelfViewLights
                    .set(
                        sessionId,
                        light,
                    );
            }

            this.drawRemoteVulcanSelfViewLight(
                light,
                display.x,
                display.y,
            );

            /*
             * Same network firing state, same world coordinate.
             * The Hider sees the BRRRT impact/tracer shower in his own view.
             * withSound=false: do not multiply remote gun audio per client.
             */
            const firing =
                this.remoteVulcanFiringSessionIds
                    .has(sessionId);

            const lastFxAt =
                this.remoteVulcanSelfViewLastFxAt
                    .get(sessionId) ??
                0;

            /*
             * 524b uses 29ms presentation cadence. Keep this renderer aligned.
             */
            if (
                firing &&
                now - lastFxAt >= 29
            ) {
                this.remoteVulcanSelfViewLastFxAt
                    .set(
                        sessionId,
                        now,
                    );

                this.spawnVulcanPresentationImpact(
                    display.x,
                    display.y,
                    false,
                );
            }
        }
    }

`;

s = s.slice(0, updateAt) + helpers + s.slice(updateAt);

/* ------------------------------------------------------------------
 * 3) Run passive Hider renderer BEFORE the existing owner/spectator early
 *    return. This is the root cause of the missing VFX.
 * ------------------------------------------------------------------ */
const forceHudNeedle =
`        this.forceTacticalTopHud();
        this.applyTacticalSupportInputLock();`;

if (!s.includes(forceHudNeedle)) {
  throw new Error("updateVulcanAirSupport HUD anchor not found. No file written.");
}

s = s.replace(
  forceHudNeedle,
`        this.forceTacticalTopHud();
        this.applyTacticalSupportInputLock();

        /*
         * ${MARK}
         * Must run before owner/spectator early-return so a normal Hider
         * self-camera still receives remote spotlight + bullet presentation.
         */
        this.updateRemoteVulcanSelfViewVfx();`,
  1
);

/* ------------------------------------------------------------------
 * 4) Result/lobby cleanup: passive lights must never leak into victory cards.
 * ------------------------------------------------------------------ */
const resultReturnNeedle =
`            return;
        }

        this.forceTacticalTopHud();`;

if (!s.includes(resultReturnNeedle)) {
  throw new Error("Vulcan result cleanup return anchor not found. No file written.");
}

s = s.replace(
  resultReturnNeedle,
`            this.clearRemoteVulcanSelfViewVfx();

            return;
        }

        this.forceTacticalTopHud();`,
  1
);

/*
 * Also hook clearVulcanForResultCapture() if present, so every result capture
 * path is protected even if update ordering changes later.
 */
const clearSig = "    private clearVulcanForResultCapture(): void {";
const clearAt = s.indexOf(clearSig);

if (clearAt >= 0) {
  const bodyAt = clearAt + clearSig.length;
  const nearby = s.slice(bodyAt, bodyAt + 400);

  if (!nearby.includes("clearRemoteVulcanSelfViewVfx")) {
    s =
      s.slice(0, bodyAt) +
      `
        this.clearRemoteVulcanSelfViewVfx();
` +
      s.slice(bodyAt);
  }
}

/* ------------------------------------------------------------------
 * 5) Remote Vulcan inactive packet: remove that Hunter's passive light now,
 *    not one frame later.
 * ------------------------------------------------------------------ */
const remoteDeleteNeedle =
`                        this.remoteVulcanActiveSessionIds.delete(state.sessionId);
                        this.remoteVulcanAimBySessionId.delete(state.sessionId);`;

if (!s.includes(remoteDeleteNeedle)) {
  throw new Error("Remote Vulcan inactive cleanup anchor not found. No file written.");
}

s = s.replace(
  remoteDeleteNeedle,
`                        this.remoteVulcanActiveSessionIds.delete(state.sessionId);
                        this.remoteVulcanAimBySessionId.delete(state.sessionId);

                        this.remoteVulcanSelfViewLights
                            .get(state.sessionId)
                            ?.destroy();

                        this.remoteVulcanSelfViewLights
                            .delete(state.sessionId);

                        this.remoteVulcanSelfViewDisplayAim
                            .delete(state.sessionId);

                        this.remoteVulcanSelfViewLastFxAt
                            .delete(state.sessionId);`,
  1
);

/* Marker */
s =
  `/* ${MARK}: Hider own-view sees remote Vulcan searchlight + firing VFX without entering aerial spectator camera. */\n` +
  s;

/* Postconditions */
const checks = [
  ["passive light map", /remoteVulcanSelfViewLights/],
  ["passive updater", /private updateRemoteVulcanSelfViewVfx\(\): void/],
  ["hider role gate", /localPlayer\?\.role === 'hider'/],
  ["self-view gate", /!this\.spectatorSessionId/],
  ["remote aim", /remoteVulcanAimBySessionId[\s\S]*?get\(sessionId\)/],
  ["remote firing", /remoteVulcanFiringSessionIds[\s\S]*?has\(sessionId\)/],
  ["impact", /spawnVulcanPresentationImpact\([\s\S]*?display\.x,[\s\S]*?display\.y,[\s\S]*?false/],
  ["update hook", /updateRemoteVulcanSelfViewVfx\(\);/],
  ["result cleanup", /clearRemoteVulcanSelfViewVfx\(\);/],
];

for (const [label, re] of checks) {
  if (!re.test(s)) {
    throw new Error(`Postcondition failed: ${label}. No file written.`);
  }
}

fs.mkdirSync(".patch-backups", { recursive: true });
fs.writeFileSync(
  path.join(".patch-backups", "GameScene-before-v526.ts"),
  original,
  "utf8",
);
fs.writeFileSync(FILE, s, "utf8");

console.log("Applied v0.10.10.526.");
console.log(" - Hider ORIGINAL self-view now sees remote Vulcan searchlight");
console.log(" - searchlight follows server-shared Hunter aim in real time");
console.log(" - center circle -> directional ellipse preserved");
console.log(" - Hider ORIGINAL self-view now sees Vulcan tracer/impact shower");
console.log(" - spectator Hunter view keeps the existing aerial renderer (no double draw)");
console.log(" - no camera zoom/orbit is forced on Hider self-view");
console.log(" - passive VFX are hard-cleared on Vulcan end/result/victory capture");
console.log(" - no server change");
console.log("Next: npm run build");
