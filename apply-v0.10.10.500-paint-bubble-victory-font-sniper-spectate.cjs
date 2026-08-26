const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "src", "game", "GameScene.ts");
const MARK = "V1010500_PAINT_BUBBLE_VICTORY_FONT_SNIPER_SPECTATE";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt CLIENT project root.");
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.500 already applied");
  process.exit(0);
}

const original = s;

function once(before, after, label) {
  const count = s.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected 1 match, found ${count}. No file written.`);
  }
  s = s.replace(before, after);
}

/* ============================================================
 * 1) Paint Help bubble:
 * Existing 498b sets "shown=true" BEFORE checking whether the tutorial
 * is still open. If the tutorial is open at 1.4s, the bubble is skipped
 * forever. Retry until the tutorial actually closes, and only then mark
 * it as shown.
 * ============================================================ */
once(
`            if (!this.paintAssistDiscoveryBubbleShown) {
                this.paintAssistDiscoveryBubbleShown = true;
                window.setTimeout(
                    () => {
                        const tutorialOpen =
                            !!document.querySelector('[data-paint-tutorial],[data-confirm-modal],.paint-confirm-modal');

                        if (
                            !tutorialOpen &&
                            this.phase === 'paint' &&
                            this.paintAssistButton &&
                            !this.paintAssistButton.hidden &&
                            this.paintAssistButton.style.display !== 'none'
                        ) {
                            this.showFeatureDiscoveryBubble('paintAssist');
                        }
                    },
                    1400,
                );
            }`,
`            if (!this.paintAssistDiscoveryBubbleShown) {
                /*
                 * ${MARK} / PAINT_HELP_WAIT_UNTIL_VISIBLE
                 *
                 * Do not consume the one-shot flag while the first Paint
                 * tutorial / confirmation layer is still covering the game.
                 * PC + mobile both retry until the real Paint Help button is
                 * visible, then the persistent speech bubble is attached above it.
                 */
                const tryShowPaintAssistBubble =
                    (): void => {
                        if (
                            this.phase !== 'paint' ||
                            !this.paintAssistButton
                        ) {
                            return;
                        }

                        if (
                            this.paintAssistDiscoveryBubbleShown
                        ) {
                            return;
                        }

                        const tutorialOpen =
                            !!document.querySelector(
                                '[data-paint-tutorial],[data-confirm-modal],.paint-confirm-modal,.colorhunt-guide-overlay',
                            );

                        const buttonVisible =
                            !this.paintAssistButton.hidden &&
                            this.paintAssistButton.style.display !== 'none' &&
                            this.paintAssistButton.getBoundingClientRect().width > 0 &&
                            this.paintAssistButton.getBoundingClientRect().height > 0;

                        if (
                            tutorialOpen ||
                            !buttonVisible
                        ) {
                            window.setTimeout(
                                tryShowPaintAssistBubble,
                                250,
                            );
                            return;
                        }

                        this.paintAssistDiscoveryBubbleShown =
                            true;
                        this.showFeatureDiscoveryBubble(
                            'paintAssist',
                        );
                    };

                window.setTimeout(
                    tryShowPaintAssistBubble,
                    350,
                );
            }`,
"paint assist deferred bubble"
);

/* ============================================================
 * 2) Sniper discovery bubble:
 * Move it another ~20px lower than current 18/22px spacing, AND track
 * the button while it pulses/moves so the bubble cannot visually drift
 * back over it.
 * ============================================================ */
once(
`                const sniperGap =
                    this.mobileControlsEnabled
                        ? 18
                        : 22;`,
`                /*
                 * ${MARK} / SNIPER_HINT_REAL_GAP
                 * Previous target rect/pulse could make 18~22px look almost
                 * unchanged. Add another ~22px of real separation.
                 */
                const sniperGap =
                    this.mobileControlsEnabled
                        ? 40
                        : 44;`,
"sniper hint gap"
);

once(
`        place();
        requestAnimationFrame(()=>{
            place();
            if(document.body.contains(bubble)){
                bubble.style.opacity='1';
                bubble.style.transform='translateY(0) scale(1)';
            }
        });
        window.setTimeout(place,100);`,
`        place();

        /*
         * ${MARK} / DISCOVERY_BUBBLE_FOLLOWS_TARGET
         * Phaser support buttons can move/pulse after the DOM bubble is created.
         * Re-anchor for the whole visible lifetime instead of sampling only once.
         */
        let placementFrames = 0;
        const followTarget =
            (): void => {
                if (
                    !document.body.contains(bubble) ||
                    placementFrames > 330
                ) {
                    return;
                }

                placementFrames += 1;
                place();
                requestAnimationFrame(
                    followTarget,
                );
            };

        requestAnimationFrame(
            followTarget,
        );

        requestAnimationFrame(()=>{
            place();
            if(document.body.contains(bubble)){
                bubble.style.opacity='1';
                bubble.style.transform='translateY(0) scale(1)';
            }
        });
        window.setTimeout(place,100);`,
"bubble continuous placement"
);

/* ============================================================
 * 3) Finished winner title:
 * Match the clean Hunt-intro typography:
 * white text + black outline + shadow, absolutely NO text background.
 * ============================================================ */
once(
`            this.countdownText
                .setFontFamily(
                    '"Arial Black","Noto Sans KR","Noto Sans JP",Arial,sans-serif',
                )
                .setFontSize(
                    this.mobileControlsEnabled
                        ? 46
                        : 64,
                )
                .setFontStyle('bold')
                .setStroke('#fff8e8', 5)
                .setShadow(
                    0,
                    5,
                    'rgba(0,0,0,.28)',
                    7,
                    true,
                    true,
                )
                .setColor(
                    effectiveWinner === 'hunters'
                        ? '#d94242'
                        : '#285d48',
                )
                .setText(victoryText)
                .setVisible(
                    !this.victoryShowcaseCleanCaptureActive,
                );`,
`            this.countdownText
                /*
                 * ${MARK} / HUNT_INTRO_STYLE_WINNER
                 * Same visual family as "하이더를 찾자!":
                 * Arial Black + WHITE fill + BLACK outline + shadow.
                 * Remove the legacy Text background/padding completely.
                 */
                .setBackgroundColor(null)
                .setPadding(0)
                .setFontFamily(
                    '"Arial Black", "Noto Sans KR", "Noto Sans JP", Arial, sans-serif',
                )
                .setFontSize(
                    this.mobileControlsEnabled
                        ? 48
                        : 66,
                )
                .setFontStyle('bold')
                .setColor('#ffffff')
                .setStroke('#111111', 6)
                .setShadow(
                    0,
                    3,
                    'rgba(0,0,0,.42)',
                    0,
                    true,
                    true,
                )
                .setText(victoryText)
                .setVisible(
                    !this.victoryShowcaseCleanCaptureActive,
                );`,
"finished title font/background"
);

/* ============================================================
 * 4) Remote sniper spectator camera:
 * Remember the latest authoritative sniper_aim by Hunter.
 * ============================================================ */
once(
`    private readonly remoteSniperActiveSessionIds =
        new Set<string>();
    private sniperSpectatorStatusText?: Phaser.GameObjects.Text;`,
`    private readonly remoteSniperActiveSessionIds =
        new Set<string>();

    /* ${MARK}: latest server-authoritative remote sniper world aim. */
    private readonly remoteSniperAimBySessionId =
        new Map<
            string,
            {
                x: number;
                y: number;
            }
        >();

    private sniperSpectatorStatusText?: Phaser.GameObjects.Text;`,
"remote sniper aim field"
);

once(
`                    if (!state.active) {
                        this.remoteSniperScopes.get(state.sessionId)?.destroy();
                        this.remoteSniperScopes.delete(state.sessionId);
                    }`,
`                    if (!state.active) {
                        this.remoteSniperScopes.get(state.sessionId)?.destroy();
                        this.remoteSniperScopes.delete(state.sessionId);
                        this.remoteSniperAimBySessionId
                            .delete(state.sessionId);
                    }`,
"clear remote sniper aim"
);

once(
`    private drawRemoteSniperScope(
        aim: NetworkSniperAim,
    ): void {
        let g =`,
`    private drawRemoteSniperScope(
        aim: NetworkSniperAim,
    ): void {
        /*
         * ${MARK} / REMOTE_SCOPE_CAMERA_TARGET
         * The same authoritative sniper_aim that draws the reticle also drives
         * the Hider spectator camera.
         */
        if (
            Number.isFinite(aim.x) &&
            Number.isFinite(aim.y)
        ) {
            this.remoteSniperAimBySessionId
                .set(
                    aim.sessionId,
                    {
                        x: aim.x,
                        y: aim.y,
                    },
                );
        }

        let g =`,
"remember remote sniper aim"
);

/* Add remote-scope follow BEFORE normal character target follow. */
once(
`        const target =
            this.getActiveHuntViewTarget();

        if (!target) {
            return;
        }

        const camera =
            this.cameras.main;`,
`        /*
         * ${MARK} / HIDER_SPECTATES_REMOTE_SCOPE
         *
         * When a Hider TAB-spectates a Hunter in sniper mode, the Hunter body
         * must NOT remain the camera target. Follow the server sniper_aim world
         * point so the Hider literally watches where that scope is looking.
         */
        const spectatingRemoteSniper =
            this.networkPlayerManager
                .getLocalRole() === 'hider' &&
            Boolean(this.spectatorSessionId) &&
            this.remoteSniperActiveSessionIds
                .has(this.spectatorSessionId);

        const remoteSniperAim =
            spectatingRemoteSniper
                ? this.remoteSniperAimBySessionId
                    .get(this.spectatorSessionId)
                : undefined;

        if (remoteSniperAim) {
            const camera =
                this.cameras.main;

            if (
                Math.abs(
                    camera.zoom -
                    this.gameplayCameraZoom
                ) > 0.001
            ) {
                this.applyFixedHudForZoom(
                    this.gameplayCameraZoom,
                );
                camera.setZoom(
                    this.gameplayCameraZoom,
                );
            }

            camera
                .stopFollow()
                .removeBounds()
                .centerOn(
                    remoteSniperAim.x,
                    remoteSniperAim.y,
                );

            /*
             * Make the state impossible to miss, even if Hunt tension UI
             * happened to run in a different order this frame.
             */
            if (!this.sniperSpectatorStatusText) {
                const language =
                    getLanguage();
                const copy =
                    ({
                        ko: '🎯 저격 모드 중...',
                        ja: '🎯 狙撃モード中...',
                        en: '🎯 SNIPER MODE...',
                        zh: '🎯 狙击模式中...',
                    } as const)[language];

                this.sniperSpectatorStatusText =
                    this.add.text(
                        this.gameWidth / 2,
                        this.gameHeight - 72,
                        copy,
                        {
                            fontFamily:
                                '"Arial Black","Noto Sans KR","Noto Sans JP",Arial,sans-serif',
                            fontSize:
                                this.mobileControlsEnabled
                                    ? '17px'
                                    : '22px',
                            color: '#fff7de',
                            backgroundColor:
                                'rgba(16,20,24,.90)',
                            padding: {
                                x: 16,
                                y: 9,
                            },
                            stroke: '#111111',
                            strokeThickness: 3,
                        },
                    )
                        .setOrigin(0.5)
                        .setScrollFactor(0)
                        .setDepth(50000);
            }

            this.sniperSpectatorStatusText
                .setPosition(
                    this.gameWidth / 2,
                    this.gameHeight - 72,
                )
                .setDepth(50000)
                .setVisible(true);

            return;
        }

        const target =
            this.getActiveHuntViewTarget();

        if (!target) {
            return;
        }

        const camera =
            this.cameras.main;`,
"remote sniper camera follow"
);

/* Make existing status text a little more prominent too. */
once(
`                                fontSize:
                                    this.mobileControlsEnabled
                                        ? '16px'
                                        : '20px',`,
`                                fontSize:
                                    this.mobileControlsEnabled
                                        ? '17px'
                                        : '22px',`,
"sniper spectator status font"
);

once(
`                            .setOrigin(0.5)
                            .setScrollFactor(0)
                            .setDepth(26050);`,
`                            .setOrigin(0.5)
                            .setScrollFactor(0)
                            .setDepth(50000);`,
"sniper spectator status depth"
);

/* Header + invariants */
s =
`/* ${MARK}: Paint Help bubble retry, real sniper-hint gap, Hunt-intro victory typography, remote sniper-scope spectator camera. */\n` +
s;

for (const token of [
  MARK,
  "PAINT_HELP_WAIT_UNTIL_VISIBLE",
  "SNIPER_HINT_REAL_GAP",
  "HUNT_INTRO_STYLE_WINNER",
  "REMOTE_SCOPE_CAMERA_TARGET",
  "HIDER_SPECTATES_REMOTE_SCOPE",
  "remoteSniperAimBySessionId",
  ".setBackgroundColor(null)",
  "? 40",
  ": 44",
]) {
  if (!s.includes(token)) {
    throw new Error(`Safety assertion failed: ${token}. No file written.`);
  }
}

const backupDir =
    path.join(
        process.cwd(),
        ".patch-backups",
    );

fs.mkdirSync(
    backupDir,
    { recursive: true },
);

fs.writeFileSync(
    path.join(
        backupDir,
        "GameScene-before-v500.ts",
    ),
    original,
    "utf8",
);

fs.writeFileSync(
    FILE,
    s,
    "utf8",
);

console.log("");
console.log("[done] v0.10.10.500 CLIENT");
console.log("[paint] PC/mobile Paint Help speech bubble retries until tutorial closes");
console.log("[paint] bubble is above Paint Help and stays until Paint Help is pressed");
console.log("[sniper-ui] discovery bubble moved another ~20px down and tracks moving button");
console.log("[victory] WHITE winner text + BLACK outline + NO text background");
console.log("[spectator] Hider camera follows remote Hunter sniper_aim instead of Hunter body");
console.log("[spectator] remote scope reticle stays visible and '저격 모드 중...' is forced on top");
console.log("[safe] server/sniper fire/reconnect/READY/paint sync mechanics untouched");
console.log("");
console.log("Next: npm run build");
