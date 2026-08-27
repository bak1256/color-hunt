const fs = require("fs");
const path = require("path");

const FILE = path.join("src", "game", "GameScene.ts");
const MARK = "V1010531_TACTICAL_IDLE_FADE_HIDE";

if (!fs.existsSync(FILE)) {
  throw new Error(`Missing ${FILE}. Run from C:\\Users\\bak12\\color-hunt. No file written.`);
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");
const original = s;

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.531 already applied.");
  process.exit(0);
}

const methodStart =
  s.indexOf("    private refreshSniperSupportUi(): void {");

if (methodStart < 0) {
  throw new Error("refreshSniperSupportUi() not found. No file written.");
}

const methodEnd =
  s.indexOf(
    "\n    private ",
    methodStart + 50,
  );

if (methodEnd < 0) {
  throw new Error("Could not isolate refreshSniperSupportUi(). No file written.");
}

let method =
  s.slice(
    methodStart,
    methodEnd,
  );

/*
 * Current code starts a one-off 10s timer only when Sniper first becomes
 * visible, then blinks Sniper alone and hides it. Replace that whole block
 * with a deterministic remaining-time lifecycle:
 *
 * support appears at remaining <= 30s
 * 0~10s : normal
 * 10~13s: BOTH buttons semi-transparent blink
 * 13s+  : BOTH buttons hard-hidden + input disabled + discovery bubble removed
 *
 * Because this is enforced every refresh frame, pointer hover cannot revive it.
 */
const oldIdleRe =
/            if \(wasHidden\) \{\n                window\.setTimeout\(\(\) => \{[\s\S]*?                if \(!this\.sniperDiscoveryBubbleShown\) \{\n                    this\.sniperDiscoveryBubbleShown = true;\n                    this\.showFeatureDiscoveryBubble\('sniper'\);\n                \}\n            \}/m;

if (!oldIdleRe.test(method)) {
  throw new Error(
    "Current tactical wasHidden/10s blink block not found. No file written."
  );
}

const newIdle = `            /*
             * ${MARK}
             *
             * The tactical choice is intentionally temporary.
             *
             * available at Hunt remaining 30s
             *   0~10s  : fully visible
             *  10~13s  : both choices blink semi-transparent
             *   13s+   : both choices disappear permanently for this round
             *
             * This uses round time instead of hover/activity timers.
             * Therefore moving the mouse over the old hit area CANNOT restore
             * either button after expiry.
             */
            const tacticalChoiceElapsedMs =
                Phaser.Math.Clamp(
                    30000 -
                        remainingMs,
                    0,
                    30000,
                );

            if (
                wasHidden &&
                !this.sniperDiscoveryBubbleShown
            ) {
                this.sniperDiscoveryBubbleShown =
                    true;

                this.showFeatureDiscoveryBubble(
                    'sniper',
                );
            }

            if (
                tacticalChoiceElapsedMs >=
                    13000
            ) {
                this.sniperButton
                    .setAlpha(1)
                    .disableInteractive()
                    .setVisible(false);

                this.vulcanButton
                    ?.setAlpha(1)
                    .disableInteractive()
                    .setVisible(false);

                /*
                 * The ultimate-support explanation bubble belongs to the same
                 * choice UI. Never leave it floating after both choices expire.
                 */
                this.hideFeatureDiscoveryBubble(
                    'sniper',
                );

                return;
            }

            if (
                tacticalChoiceElapsedMs >=
                    10000
            ) {
                /*
                 * ~3 seconds of warning blink before disappearing.
                 * 320ms half-period => readable but clearly urgent.
                 */
                const blinkPhase =
                    Math.floor(
                        (
                            tacticalChoiceElapsedMs -
                            10000
                        ) /
                        320,
                    ) %
                    2;

                const warningAlpha =
                    blinkPhase ===
                        0
                        ? 0.30
                        : 0.68;

                this.sniperButton
                    .setAlpha(
                        warningAlpha,
                    );

                this.vulcanButton
                    ?.setAlpha(
                        warningAlpha,
                    );

                /*
                 * If the discovery bubble is still present in a future UI
                 * revision, pulse it with the choices too. Current short-lived
                 * bubbles may already be gone by this point.
                 */
                if (
                    this.sniperDiscoveryBubble &&
                    document.body.contains(
                        this.sniperDiscoveryBubble,
                    )
                ) {
                    this.sniperDiscoveryBubble
                        .style.opacity =
                        String(
                            warningAlpha,
                        );
                }
            } else {
                this.sniperButton
                    .setAlpha(1);

                this.vulcanButton
                    ?.setAlpha(1);
            }`;

method =
  method.replace(
    oldIdleRe,
    newIdle,
  );

s =
  s.slice(0, methodStart) +
  method +
  s.slice(methodEnd);

/*
 * Also hard-clear the discovery bubble on the existing non-Hunt/result path.
 * This prevents an async DOM bubble from surviving after victory/lobby.
 */
const resultAnchor = `            this.vulcanButton
                ?.disableInteractive()
                .setVisible(false);

            return;`;

if (!s.includes(resultAnchor)) {
  throw new Error(
    "Tactical result/lobby hide anchor not found. No file written."
  );
}

s =
  s.replace(
    resultAnchor,
`            this.vulcanButton
                ?.disableInteractive()
                .setVisible(false);

            this.hideFeatureDiscoveryBubble(
                'sniper',
            );

            return;`,
    1,
  );

s =
`/* ${MARK}: unused tactical choices stay 10s, blink semi-transparent for 3s, then both buttons + support bubble hard-disappear. */\n` +
s;

const checks = [
  [
    "10s fade threshold",
    /tacticalChoiceElapsedMs >=\s*10000/,
  ],
  [
    "13s hard hide threshold",
    /tacticalChoiceElapsedMs >=\s*13000/,
  ],
  [
    "sniper hard hide",
    /this\.sniperButton[\s\S]{0,120}?disableInteractive\(\)[\s\S]{0,100}?setVisible\(false\)/,
  ],
  [
    "vulcan hard hide",
    /this\.vulcanButton[\s\S]{0,140}?disableInteractive\(\)[\s\S]{0,100}?setVisible\(false\)/,
  ],
  [
    "bubble hard hide",
    /hideFeatureDiscoveryBubble\(\s*'sniper'/,
  ],
  [
    "both alpha pulse",
    /this\.sniperButton[\s\S]{0,100}?warningAlpha[\s\S]{0,160}?this\.vulcanButton[\s\S]{0,100}?warningAlpha/,
  ],
];

for (const [label, re] of checks) {
  if (!re.test(s)) {
    throw new Error(
      `Postcondition failed: ${label}. No file written.`
    );
  }
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
    "GameScene-before-v531.ts",
  ),
  original,
  "utf8",
);

fs.writeFileSync(
  FILE,
  s,
  "utf8",
);

console.log("Applied v0.10.10.531.");
console.log(" - Sniper + Vulcan choice buttons: normal for 10s");
console.log(" - then BOTH blink semi-transparent for ~3s");
console.log(" - after 13s BOTH are hidden and interaction is disabled");
console.log(" - mouse hover cannot restore expired tactical buttons");
console.log(" - tactical support explanation bubble pulses if still present");
console.log(" - explanation bubble is removed when choices expire");
console.log(" - explanation bubble also clears on result/lobby");
console.log(" - no server change");
console.log("Next: npm run build");
