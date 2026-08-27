const fs = require("fs");
const path = require("path");

const FILE = path.join("src", "game", "GameScene.ts");
const MARK = "V1010528B_VULCAN_SELFVIEW_MAIN_UPDATE";

if (!fs.existsSync(FILE)) {
  throw new Error(`Missing ${FILE}. No file written.`);
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");
const original = s;

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.528b already applied.");
  process.exit(0);
}

/*
 * ROOT CAUSE:
 *
 * updateRemoteVulcanSelfViewVfx() was only reached through
 * updateVulcanAirSupport(), whose ordinary per-frame caller currently lives
 * inside updateMobileControlVisibility().
 *
 * Desktop can return from mobile HUD visibility logic before that call,
 * so a Hider's OWN camera never updates the passive spotlight/tracer renderer.
 *
 * Spectator Vulcan still worked because it has a separate spectator/runtime
 * path. Move passive self-view VFX ownership to the Scene's real update loop.
 */

/* 1) Remove passive self-view call from updateVulcanAirSupport(). */
const oldHook =
`        /*
         * V1010526_HIDER_SELF_VIEW_REMOTE_VULCAN_VFX
         * Must run before owner/spectator early-return so a normal Hider
         * self-camera still receives remote spotlight + bullet presentation.
         */
        this.updateRemoteVulcanSelfViewVfx();`;

if (!s.includes(oldHook)) {
  /*
   * 528 may have changed the comment while preserving the call.
   * Use a bounded structural fallback around forceTacticalTopHud().
   */
  const areaStart =
    s.indexOf("    private updateVulcanAirSupport(): void {");

  if (areaStart < 0) {
    throw new Error("updateVulcanAirSupport() missing. No file written.");
  }

  const areaEnd =
    s.indexOf(
      "\n    private ",
      areaStart + 50,
    );

  const end =
    areaEnd >= 0
      ? areaEnd
      : Math.min(
          s.length,
          areaStart + 12000,
        );

  let block =
    s.slice(
      areaStart,
      end,
    );

  const callRe =
/\s*this\.updateRemoteVulcanSelfViewVfx\(\);\s*/;

  if (!callRe.test(block)) {
    throw new Error(
      "Passive Vulcan self-view call not found inside updateVulcanAirSupport(). No file written."
    );
  }

  block =
    block.replace(
      callRe,
      "\n",
      1,
    );

  s =
    s.slice(0, areaStart) +
    block +
    s.slice(end);
} else {
  s =
    s.replace(
      oldHook,
      "",
      1,
    );
}

/* 2) Install it in the ACTUAL Scene update loop. */
const mainUpdateAnchor =
`        this.ensureGameplayCameraFollow();
        this.updateHuntTension(delta);`;

if (!s.includes(mainUpdateAnchor)) {
  throw new Error(
    "Main update ensureGameplayCameraFollow/updateHuntTension anchor missing. No file written."
  );
}

s =
  s.replace(
    mainUpdateAnchor,
`        this.ensureGameplayCameraFollow();

        /*
         * ${MARK}
         *
         * Passive remote Vulcan VFX belongs to gameplay rendering, NOT mobile
         * HUD visibility. Run it every Scene frame on desktop and mobile.
         *
         * It internally gates itself to:
         * - Hunt
         * - local Hider
         * - own camera (not Vulcan spectator aerial camera)
         * - no victory/result capture
         */
        this.updateRemoteVulcanSelfViewVfx();

        this.updateHuntTension(delta);`,
    1,
  );

/*
 * 3) Remove updateVulcanAirSupport() from mobile HUD visibility.
 *
 * Owner/spectator Vulcan already has its dedicated runtime timer
 * (ensureVulcanRuntimeTimer), so mobile HUD code must not own gameplay
 * simulation/rendering.
 */
const mobileHook =
`        if (this.phase === 'hunt') {
            this.refreshSniperSupportUi();
            this.updateVulcanAirSupport();
        }`;

if (!s.includes(mobileHook)) {
  throw new Error(
    "Mobile visibility Vulcan hook not found. No file written."
  );
}

s =
  s.replace(
    mobileHook,
`        if (this.phase === 'hunt') {
            this.refreshSniperSupportUi();
        }`,
    1,
  );

/*
 * 4) Ensure passive VFX are extra obvious.
 * 528 already strengthened the outline; if present, leave it.
 * Otherwise strengthen the 526 style.
 */
if (
  s.includes(
`        graphics.lineStyle(
            2,
            0xffefaa,
            0.72,
        );`
  )
) {
  s =
    s.replace(
`        graphics.lineStyle(
            2,
            0xffefaa,
            0.72,
        );`,
`        graphics.lineStyle(
            4,
            0xfff3a8,
            0.98,
        );`,
      1,
    );
}

/*
 * 5) Add a tiny center marker in Hider self-view.
 * This makes it impossible to confuse "beam is too bright/dim" with
 * "renderer did not execute" during the next test.
 */
const strokeEllipseNeedle =
`        graphics.strokeEllipse(
            0,
            0,
            major,
            minor,
        );`;

if (!s.includes(strokeEllipseNeedle)) {
  throw new Error(
    "Passive Vulcan spotlight strokeEllipse anchor missing. No file written."
  );
}

s =
  s.replace(
    strokeEllipseNeedle,
`${strokeEllipseNeedle}

        /*
         * ${MARK} / CENTER_CONFIRMATION_DOT
         * Small visual anchor at the live network aim point.
         */
        graphics.fillStyle(
            0xfff6bf,
            0.95,
        );

        graphics.fillCircle(
            0,
            0,
            3,
        );`,
    1,
  );

/* Top marker. */
s =
  `/* ${MARK}: Hider own-view Vulcan rendering moved from mobile HUD path to the real Scene update loop. */\n` +
  s;

/* Postconditions. */
const checks = [
  [
    "main-loop passive update",
    /ensureGameplayCameraFollow\(\);[\s\S]{0,700}?updateRemoteVulcanSelfViewVfx\(\);[\s\S]{0,300}?updateHuntTension\(delta\);/,
  ],
  [
    "mobile hook removed",
    /if \(this\.phase === 'hunt'\) \{\s*this\.refreshSniperSupportUi\(\);\s*\}/,
  ],
  [
    "passive updater still exists",
    /private updateRemoteVulcanSelfViewVfx\(\): void/,
  ],
  [
    "packet aim map still used",
    /remoteVulcanAimBySessionId[\s\S]{0,400}?get\(sessionId\)/,
  ],
  [
    "firing state still used",
    /remoteVulcanFiringSessionIds[\s\S]{0,300}?has\(sessionId\)/,
  ],
  [
    "visible ring",
    /graphics\.lineStyle\(\s*4,\s*0xfff3a8,\s*0\.98/,
  ],
  [
    "center dot",
    /graphics\.fillCircle\(\s*0,\s*0,\s*3/,
  ],
];

for (const [label, re] of checks) {
  if (!re.test(s)) {
    throw new Error(
      `Postcondition failed: ${label}. No file written.`
    );
  }
}

/*
 * Verify updateVulcanAirSupport no longer owns the passive Hider renderer.
 */
const vulcanMethodAt =
  s.indexOf(
    "    private updateVulcanAirSupport(): void {",
  );

const vulcanMethodEnd =
  s.indexOf(
    "\n    private ",
    vulcanMethodAt + 50,
  );

if (
  vulcanMethodAt < 0 ||
  vulcanMethodEnd < 0
) {
  throw new Error(
    "Could not isolate updateVulcanAirSupport() after patch. No file written."
  );
}

const vulcanMethod =
  s.slice(
    vulcanMethodAt,
    vulcanMethodEnd,
  );

if (
  vulcanMethod.includes(
    "this.updateRemoteVulcanSelfViewVfx();",
  )
) {
  throw new Error(
    "Postcondition failed: passive renderer still lives in updateVulcanAirSupport(). No file written."
  );
}

fs.mkdirSync(
  ".patch-backups",
  {
    recursive: true,
  },
);

fs.writeFileSync(
  path.join(
    ".patch-backups",
    "GameScene-before-v528b.ts",
  ),
  original,
  "utf8",
);

fs.writeFileSync(
  FILE,
  s,
  "utf8",
);

console.log("Applied v0.10.10.528b.");
console.log(" - ROOT FIX: Hider own-view Vulcan VFX moved to Scene main update loop");
console.log(" - no longer depends on updateMobileControlVisibility()");
console.log(" - desktop and mobile now execute passive searchlight/tracer rendering every frame");
console.log(" - Hunter/Vulcan spectator aerial path remains unchanged");
console.log(" - 4px / 98% ellipse outline retained");
console.log(" - added 3px live-aim center dot for unmistakable visibility");
console.log(" - result/victory cleanup remains unchanged");
console.log(" - Paint->Hunt v528 fix untouched");
console.log(" - server unchanged");
console.log("Next: npm run build");
