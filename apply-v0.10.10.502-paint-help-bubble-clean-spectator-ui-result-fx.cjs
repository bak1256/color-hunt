const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(process.cwd(), "src", "game", "GameScene.ts");
const MARK = "V1010502_PAINT_HELP_BUBBLE_CLEAN_SPECTATOR_UI_RESULT_FX";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt CLIENT project root.");
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.502 already applied");
  process.exit(0);
}

const original = s;

function sha(v) {
  return crypto.createHash("sha256").update(v).digest("hex");
}

function methodBlock(source, name) {
  const re = new RegExp(`^[ \\t]*private[ \\t]+${name}\\s*\\(`, "m");
  const m = source.match(re);
  if (!m || m.index == null) throw new Error(`${name}() not found. No file written.`);
  const start = m.index;
  const brace = source.indexOf("{", start);
  if (brace < 0) throw new Error(`${name}() brace not found. No file written.`);
  let depth = 0, quote = "", esc = false, line = false, block = false;
  for (let i = brace; i < source.length; i++) {
    const c = source[i], n = source[i + 1] || "";
    if (line) { if (c === "\n") line = false; continue; }
    if (block) { if (c === "*" && n === "/") { block = false; i++; } continue; }
    if (quote) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === quote) quote = "";
      continue;
    }
    if (c === "/" && n === "/") { line = true; i++; continue; }
    if (c === "/" && n === "*") { block = true; i++; continue; }
    if (c === "'" || c === '"' || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    if (c === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name}() end not found. No file written.`);
}

/*
 * HARD LOCK: these known-good LOCAL sniper methods MUST be byte-identical
 * before and after this patch. If anything touches them, abort without write.
 */
const LOCKED_SNIPER_METHODS = [
  "enterSniperCinematic",
  "startSniperScopeRackIn",
  "createSniperScopeCamera",
  "drawLocalSniperScope",
  "syncSniperScopeDom",
  "exitSniperCinematic",
];

const lockedBefore = new Map();
for (const name of LOCKED_SNIPER_METHODS) {
  lockedBefore.set(name, sha(methodBlock(original, name)));
}

function replaceOnce(before, after, label) {
  const n = s.split(before).length - 1;
  if (n !== 1) {
    throw new Error(`${label}: expected 1 match, found ${n}. No file written.`);
  }
  s = s.replace(before, after);
}

/* ============================================================
 * 1) PAINT HELP BUBBLE — rebuild lifecycle around the REAL button.
 *
 * Root cause in current source:
 * showPaintAssistReadyStyleBubble() is called only once while the dock is
 * being created. If createMobilePaintDock() happens before phase/role/visible
 * state settles, show... immediately removes itself and NOTHING retries it.
 *
 * READY does not have that weakness: updatePaintReadyButton() runs repeatedly.
 * So Paint Help now gets the same "derive from current visible button state"
 * treatment whenever dock visibility/position is refreshed.
 * ============================================================ */

/* Remove the one-shot creation-time call. */
replaceOnce(
`            this.hideFeatureDiscoveryBubble('paintAssist');
            this.showPaintAssistReadyStyleBubble(assistButton);`,
`            this.hideFeatureDiscoveryBubble('paintAssist');
            /*
             * ${MARK} / PAINT_HELP_NO_ONE_SHOT_CREATION
             * Bubble visibility is synchronized AFTER the real button receives
             * its authoritative Paint visibility + screen position.
             */`,
"remove fragile one-shot Paint Help bubble call"
);

/* When Paint Help visibility is resolved, immediately sync bubble lifecycle. */
replaceOnce(
`            this.paintAssistButton.style.setProperty(
                'filter',
                'none',
                'important',
            );
        }

        if (!visible) {`,
`            this.paintAssistButton.style.setProperty(
                'filter',
                'none',
                'important',
            );

            /*
             * ${MARK} / PAINT_HELP_READY_STYLE_LIFECYCLE
             * Same principle as READY: current phase/role/button visibility is
             * authoritative. No "shown once" flag and no transient timer.
             */
            if (
                canAssist &&
                !this.paintAssistUsedThisRound
            ) {
                requestAnimationFrame(
                    () => {
                        const button =
                            this.paintAssistButton;
                        if (button) {
                            this.updateMobilePaintDockPosition();
                            this.showPaintAssistReadyStyleBubble(button);
                        }
                    },
                );
            } else {
                this.hidePaintAssistReadyStyleBubble();
            }
        }

        if (!visible) {`,
"sync Paint Help bubble from dock visibility"
);

/* Also reposition/re-show after the button's actual left/top are calculated.
 * This is what makes PC + mobile deterministic.
 */
replaceOnce(
`            this.paintAssistButton.style.transform =
                'translateY(-50%)';
        }
    }

    private destroyMobilePaintDock(): void {`,
`            this.paintAssistButton.style.transform =
                'translateY(-50%)';
        }

        /*
         * ${MARK} / PAINT_HELP_POSITION_FINAL_SYNC
         * The button now has its FINAL screen coordinates. Anchor the speech
         * bubble here, above the button, exactly like the READY bubble.
         */
        if (
            this.paintAssistButton &&
            this.phase === 'paint' &&
            !this.paintAssistUsedThisRound &&
            !this.paintAssistButton.hidden &&
            this.paintAssistButton.style.display !== 'none'
        ) {
            this.showPaintAssistReadyStyleBubble(
                this.paintAssistButton,
            );
        }
    }

    private destroyMobilePaintDock(): void {`,
"final-position Paint Help bubble sync"
);

/* Make the wording shorter/cleaner while preserving translations. */
replaceOnce(
`                    ko: '색칠이 어렵다면 도움을 받아보세요!\\n배경을 참고해 위장색을 도와줘요.',
                    ja: '色塗りが難しいときはお手伝い！\\n背景を参考に擬態色を塗ります。',
                    en: 'Need help painting?\\nGet camouflage help from the background.',
                    zh: '上色困难时可以使用辅助！\\n会参考背景帮助完成伪装色。',`,
`                    ko: '색칠이 어렵다면 도움받아 보세요!\\n배경에 어울리는 위장색을 도와줘요.',
                    ja: '色塗りが難しいときはお手伝い！\\n背景になじむ擬態色をサポートします。',
                    en: 'Need help painting?\\nGet camouflage colors that match the background.',
                    zh: '上色困难时可以使用辅助！\\n帮助搭配适合背景的伪装色。',`,
"Paint Help bubble copy"
);

/* ============================================================
 * 2) REMOVE "SNIPER MODE..." SPECTATOR STATUS CLUTTER.
 *
 * IMPORTANT: remote sniper_aim camera following / remote scope rendering is
 * NOT changed. Only the redundant status label is suppressed.
 * ============================================================ */
const statusTruePattern =
/(this\.sniperSpectatorStatusText\s*\n\s*\.set(?:Position\([\s\S]*?\)\s*\n\s*\.setDepth\([^)]+\)\s*\n\s*)?\.setVisible\()true(\);)/g;

let statusReplacements = 0;
s = s.replace(statusTruePattern, (all, a, b) => {
  statusReplacements++;
  return a + "false" + b;
});

if (statusReplacements < 1) {
  throw new Error("spectator status visible=true anchor not found. No file written.");
}

/* DOM version: if created by the remote-aim path, keep it permanently hidden.
 * Camera follow code around it remains untouched.
 */
const domClassAnchor =
`                sniperSpectatorDom.className =
                    'colorhunt-sniper-spectator-status';`;

if (s.includes(domClassAnchor)) {
  s = s.replace(
    domClassAnchor,
`                sniperSpectatorDom.className =
                    'colorhunt-sniper-spectator-status';
                sniperSpectatorDom.style.display =
                    'none';`
  );
}

/* ============================================================
 * 3) WIN / LOSE presentation — stronger, still map-readable.
 *
 * No giant opaque result card. Keep reveal circles visible.
 * WIN: bigger celebratory bounce + brighter gold glow.
 * LOSE: visibly sinks/dims with a restrained "thud" wobble.
 * ============================================================ */
replaceOnce(
`                .setScale(
                    localWonFinishedRound
                        ? 1 + Math.sin(this.time.now / 145) * 0.035
                        : 0.985 + Math.sin(this.time.now / 360) * 0.012,
                )
                .setAlpha(
                    localWonFinishedRound
                        ? 1
                        : 0.86,
                )`,
`                /*
                 * ${MARK} / STRONGER_LOCAL_RESULT_MOOD
                 * WIN = celebratory bounce/glow.
                 * LOSE = heavier, lower-energy thud.
                 */
                .setScale(
                    localWonFinishedRound
                        ? 1.055 +
                            Math.sin(this.time.now / 105) * 0.065
                        : 0.955 +
                            Math.sin(this.time.now / 430) * 0.010,
                )
                .setAngle(
                    localWonFinishedRound
                        ? Math.sin(this.time.now / 180) * 1.1
                        : Math.sin(this.time.now / 520) * 0.45,
                )
                .setY(
                    this.gameHeight / 2 +
                    (
                        localWonFinishedRound
                            ? Math.sin(this.time.now / 125) * 7
                            : 12 +
                                Math.abs(
                                    Math.sin(this.time.now / 390),
                                ) * 3
                    ),
                )
                .setAlpha(
                    localWonFinishedRound
                        ? 1
                        : 0.72,
                )`,
"stronger WIN/LOSE motion"
);

replaceOnce(
`                    localWonFinishedRound ? 8 : 2,
                    true,
                    true,`,
`                    localWonFinishedRound ? 14 : 4,
                    true,
                    true,`,
"stronger result glow"
);

s =
`/* ${MARK}: Paint Help persistent READY-style bubble + remove spectator status clutter + stronger WIN/LOSE mood. [LOCKED] local sniper scope subsystem untouched. */\n` +
s;

/* HARD LOCK VERIFY before any write. */
for (const name of LOCKED_SNIPER_METHODS) {
  const beforeHash = lockedBefore.get(name);
  const afterHash = sha(methodBlock(s, name));
  if (beforeHash !== afterHash) {
    throw new Error(
      `[LOCKED SNIPER VIOLATION] ${name}() changed. ABORTING. No file written.`
    );
  }
}

for (const token of [
  MARK,
  "PAINT_HELP_READY_STYLE_LIFECYCLE",
  "PAINT_HELP_POSITION_FINAL_SYNC",
  "STRONGER_LOCAL_RESULT_MOOD",
]) {
  if (!s.includes(token)) {
    throw new Error(`Safety assertion failed: ${token}. No file written.`);
  }
}

fs.mkdirSync(".patch-backups", { recursive: true });
fs.writeFileSync(
  ".patch-backups/GameScene-before-v502.ts",
  original,
  "utf8",
);
fs.writeFileSync(FILE, s, "utf8");

console.log("");
console.log("[done] v0.10.10.502 CLIENT");
console.log("[paint] Paint Help bubble now follows actual Paint visibility/position on PC + mobile");
console.log("[paint] persistent until Paint Help is pressed/used or Paint ends");
console.log("[spectator] redundant 'SNIPER MODE...' status label suppressed");
console.log("[spectator] remote sniper_aim camera follow + remote reticle preserved");
console.log("[result] WIN bounce/glow stronger; LOSE sinks/dims more clearly");
console.log("[LOCKED] enterSniperCinematic unchanged");
console.log("[LOCKED] startSniperScopeRackIn unchanged");
console.log("[LOCKED] createSniperScopeCamera unchanged");
console.log("[LOCKED] drawLocalSniperScope unchanged");
console.log("[LOCKED] syncSniperScopeDom unchanged");
console.log("[LOCKED] exitSniperCinematic unchanged");
console.log("[safe] reconnect/READY/server/paint mechanics untouched");
console.log("Next: npm run build");
