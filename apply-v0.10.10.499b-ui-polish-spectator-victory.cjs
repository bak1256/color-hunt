const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "src", "game", "GameScene.ts");
const MARK = "V1010499B_UI_POLISH_SPECTATOR_VICTORY";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt CLIENT project root.");
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.499 already applied");
  process.exit(0);
}

const original = s;

function must(needle, label) {
  if (!s.includes(needle)) {
    throw new Error(`${label} anchor missing. No file written.`);
  }
}

function rep(before, after, label) {
  must(before, label);
  s = s.replace(before, after);
}

/* ============================================================
 * 1) Paint Help discovery bubble:
 *    - ABOVE Paint Help button
 *    - stays visible until Paint Help is pressed / dock destroyed
 *    - light speech-bubble style, matching READY guidance language
 * ============================================================ */

rep(
`        Object.assign(bubble.style,{
            position:'fixed',
            zIndex:'2147483001',
            pointerEvents:'none',
            boxSizing:'border-box',
            padding:this.mobileControlsEnabled ? '7px 10px' : '9px 13px',
            borderRadius:'13px',
            border:'2px solid rgba(255,255,255,.92)',
            background:'rgba(25,32,43,.96)',
            color:'#fff7c7',
            fontFamily:'"Arial Black","Noto Sans KR",Arial,sans-serif',
            fontSize:this.mobileControlsEnabled ? '12px' : '15px',
            fontWeight:'900',
            lineHeight:'1.15',
            whiteSpace:'nowrap',
            textAlign:'center',
            textShadow:'0 2px 2px rgba(0,0,0,.75)',
            boxShadow:'0 8px 22px rgba(0,0,0,.32)',
            opacity:'0',
            transform:'translateY(-8px) scale(.92)',
            transition:'opacity 150ms ease, transform 180ms cubic-bezier(.2,1.5,.4,1)',
        });`,
`        const isPaintAssistBubble =
            kind === 'paintAssist';

        Object.assign(bubble.style,{
            position:'fixed',
            zIndex:'2147483001',
            pointerEvents:'none',
            boxSizing:'border-box',
            padding:this.mobileControlsEnabled ? '7px 10px' : '9px 13px',
            borderRadius:'13px',
            border:isPaintAssistBubble
                ? '2px solid rgba(34,49,43,.96)'
                : '2px solid rgba(255,255,255,.92)',
            background:isPaintAssistBubble
                ? 'rgba(255,248,218,.98)'
                : 'rgba(25,32,43,.96)',
            color:isPaintAssistBubble
                ? '#26362f'
                : '#fff7c7',
            fontFamily:'"Arial Black","Noto Sans KR",Arial,sans-serif',
            fontSize:this.mobileControlsEnabled ? '12px' : '15px',
            fontWeight:'900',
            lineHeight:'1.15',
            whiteSpace:'nowrap',
            textAlign:'center',
            textShadow:isPaintAssistBubble
                ? '0 1px 0 rgba(255,255,255,.8)'
                : '0 2px 2px rgba(0,0,0,.75)',
            boxShadow:isPaintAssistBubble
                ? '0 7px 18px rgba(34,49,43,.22)'
                : '0 8px 22px rgba(0,0,0,.32)',
            opacity:'0',
            transform:'translateY(-8px) scale(.92)',
            transition:'opacity 150ms ease, transform 180ms cubic-bezier(.2,1.5,.4,1)',
        });`,
"feature bubble style"
);

rep(
`        Object.assign(tail.style,{
            position:'absolute',
            left:'50%',
            top:'-10px',
            transform:'translateX(-50%)',
            width:'0',
            height:'0',
            borderLeft:'9px solid transparent',
            borderRight:'9px solid transparent',
            borderBottom:'10px solid rgba(25,32,43,.96)',
        });`,
`        Object.assign(tail.style,{
            position:'absolute',
            left:'50%',
            top:'-10px',
            transform:'translateX(-50%)',
            width:'0',
            height:'0',
            borderLeft:'9px solid transparent',
            borderRight:'9px solid transparent',
            borderBottom:isPaintAssistBubble
                ? '10px solid rgba(255,248,218,.98)'
                : '10px solid rgba(25,32,43,.96)',
        });`,
"feature bubble tail style"
);

rep(
`            /* V1010498B_DISCOVERY_TIMING_POSITION: keep discovery bubble away from sniper button */
            let top=target.bottom+22;
            if(top+bubble.offsetHeight>canvas.bottom-6){
                top=Math.max(canvas.top+6,target.top-bubble.offsetHeight-10);
                tail.style.top='auto';
                tail.style.bottom='-10px';
                tail.style.borderBottom='0 solid transparent';
                tail.style.borderTop='10px solid rgba(25,32,43,.96)';
            }
            bubble.style.left=\`\${Math.round(left)}px\`;
            bubble.style.top=\`\${Math.round(top)}px\`;`,
`            let top:number;

            if(kind==='paintAssist'){
                /*
                 * ${MARK} / PAINT_HELP_PERSISTENT_BUBBLE
                 * Paint Help guidance belongs ABOVE the Paint Help button,
                 * like the READY guidance bubble. It remains there until used.
                 */
                top=Math.max(
                    canvas.top+6,
                    target.top-bubble.offsetHeight-12,
                );
                tail.style.top='auto';
                tail.style.bottom='-10px';
                tail.style.borderBottom='0 solid transparent';
                tail.style.borderTop='10px solid rgba(255,248,218,.98)';
            }else{
                /*
                 * Keep the sniper discovery bubble clearly separated from the
                 * sniper-mode button instead of visually covering it.
                 */
                const sniperGap =
                    this.mobileControlsEnabled
                        ? 18
                        : 22;
                top=target.bottom+sniperGap;

                if(top+bubble.offsetHeight>canvas.bottom-6){
                    top=Math.max(
                        canvas.top+6,
                        target.top-bubble.offsetHeight-sniperGap,
                    );
                    tail.style.top='auto';
                    tail.style.bottom='-10px';
                    tail.style.borderBottom='0 solid transparent';
                    tail.style.borderTop='10px solid rgba(25,32,43,.96)';
                }
            }

            bubble.style.left=\`\${Math.round(left)}px\`;
            bubble.style.top=\`\${Math.round(top)}px\`;`,
"feature bubble placement"
);

rep(
`        window.setTimeout(()=>{
            if(!document.body.contains(bubble))return;
            bubble.style.opacity='0';
            bubble.style.transform='translateY(-4px) scale(.96)';
            window.setTimeout(()=>{
                bubble.remove();
                if(kind==='sniper'&&this.sniperDiscoveryBubble===bubble)
                    this.sniperDiscoveryBubble=undefined;
                if(kind==='paintAssist'&&this.paintAssistDiscoveryBubble===bubble)
                    this.paintAssistDiscoveryBubble=undefined;
            },220);
        },4200);`,
`        /*
         * ${MARK}: Paint Help hint is persistent until the player presses
         * the Paint Help button (or Paint UI is destroyed). Sniper remains
         * a short one-time discovery hint.
         */
        if(kind==='sniper'){
            window.setTimeout(()=>{
                if(!document.body.contains(bubble))return;
                bubble.style.opacity='0';
                bubble.style.transform='translateY(-4px) scale(.96)';
                window.setTimeout(()=>{
                    bubble.remove();
                    if(this.sniperDiscoveryBubble===bubble)
                        this.sniperDiscoveryBubble=undefined;
                },220);
            },4200);
        }`,
"feature bubble lifetime"
);

/* ============================================================
 * 2) Remote sniper spectator state
 * ============================================================ */

rep(
`    private readonly remoteSniperScopes = new Map<string, Phaser.GameObjects.Graphics>();`,
`    private readonly remoteSniperScopes = new Map<string, Phaser.GameObjects.Graphics>();

    /* ${MARK}: Hider spectator can recognize a Hunter who is in sniper mode. */
    private readonly remoteSniperActiveSessionIds =
        new Set<string>();
    private sniperSpectatorStatusText?: Phaser.GameObjects.Text;`,
"remote sniper fields"
);

rep(
`                    if (!state.active) {
                        this.remoteSniperScopes.get(state.sessionId)?.destroy();
                        this.remoteSniperScopes.delete(state.sessionId);
                    }`,
`                    if (
                        state.sessionId !== localId
                    ) {
                        if (state.active) {
                            this.remoteSniperActiveSessionIds
                                .add(state.sessionId);
                        } else {
                            this.remoteSniperActiveSessionIds
                                .delete(state.sessionId);
                        }
                    }

                    if (!state.active) {
                        this.remoteSniperScopes.get(state.sessionId)?.destroy();
                        this.remoteSniperScopes.delete(state.sessionId);
                    }`,
"remote sniper state tracking"
);

rep(
`        const localRole =
            this.practiceMode ===
                'hunter'
                ? 'hunter'
                : this.networkPlayerManager
                    .getLocalRole();

        if (localRole === 'hunter') {`,
`        const localRole =
            this.practiceMode ===
                'hunter'
                ? 'hunter'
                : this.networkPlayerManager
                    .getLocalRole();

        /*
         * ${MARK}: status is opt-in only while spectating a sniper Hunter.
         */
        this.sniperSpectatorStatusText
            ?.setVisible(false);

        if (localRole === 'hunter') {`,
"spectator indicator reset"
);

rep(
`        if (
            spectatedPlayer?.role ===
            'hunter'
        ) {
            const hunterViewPosition =
                new Phaser.Math.Vector2(
                    spectatedPlayer.x,
                    spectatedPlayer.y,
                );

            this.drawHunterFocusVision(
                hunterViewPosition,
                this.networkPlayerManager
                    .getPlayerAimAngle(
                        spectatedPlayer.sessionId,
                    ),
            );`,
`        if (
            spectatedPlayer?.role ===
            'hunter'
        ) {
            const spectatedHunterSniping =
                this.remoteSniperActiveSessionIds
                    .has(
                        spectatedPlayer.sessionId,
                    );

            const hunterViewPosition =
                new Phaser.Math.Vector2(
                    spectatedPlayer.x,
                    spectatedPlayer.y,
                );

            if (spectatedHunterSniping) {
                /*
                 * ${MARK} / HIDER_REMOTE_SNIPER_VIEW
                 * Do NOT leave the Hider spectator stuck in the normal shotgun
                 * cone. Remote sniper_aim already carries the Hunter's exact
                 * world aim and drawRemoteSniperScope() renders that reticle.
                 * Here we remove the normal cone/round vision restriction and
                 * add an explicit state label.
                 */
                this.hiderVisionGraphics
                    ?.clear()
                    .setVisible(false);

                this.hiderVisionOverlays
                    .forEach(
                        (overlay) =>
                            overlay.setVisible(false),
                    );

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
                            this.gameHeight - 74,
                            copy,
                            {
                                fontFamily:
                                    '"Arial Black","Noto Sans KR","Noto Sans JP",Arial,sans-serif',
                                fontSize:
                                    this.mobileControlsEnabled
                                        ? '16px'
                                        : '20px',
                                color: '#fff4dd',
                                backgroundColor:
                                    'rgba(20,24,28,.88)',
                                padding: {
                                    x: 15,
                                    y: 9,
                                },
                                stroke: '#171717',
                                strokeThickness: 2,
                            },
                        )
                            .setOrigin(0.5)
                            .setScrollFactor(0)
                            .setDepth(26050);
                }

                this.sniperSpectatorStatusText
                    .setVisible(true);
            } else {
                this.drawHunterFocusVision(
                    hunterViewPosition,
                    this.networkPlayerManager
                        .getPlayerAimAngle(
                            spectatedPlayer.sessionId,
                        ),
                );
            }`,
"spectated hunter sniper branch"
);

/* ============================================================
 * 3) Cleaner Finished UI:
 *    winner text only, no giant old GAME OVER/countdown block.
 * ============================================================ */

rep(
`            this.countdownText
                .setFontSize(48)
                .setColor(
                    effectiveWinner === 'hunters'
                        ? '#d32f2f'
                        : '#1f2937',
                )
                .setText(
                    [
                        victoryText,
                        tr('게임 종료'),
                        String(remaining),
                    ].join('\\n'),
                )
                .setVisible(
                    !this.victoryShowcaseCleanCaptureActive,
                );`,
`            /*
             * ${MARK} / CLEAN_FINISHED_TITLE
             * Keep the map and reveal circles readable. The old giant
             * "GAME OVER + countdown" block is replaced by one clean winner title.
             */
            this.countdownText
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
"finished winner title"
);

/* ============================================================
 * 4) Hider victory reveal circles:
 *    explicitly show circles around every surviving Hider too.
 * ============================================================ */

rep(
`            this.networkPlayerManager
                .revealHiders(
                    result.revealedHiders,
                );

            this.phaseText`,
`            this.networkPlayerManager
                .revealHiders(
                    result.revealedHiders,
                );

            /*
             * ${MARK}: Hider winners also get clear survivor circles so their
             * final hiding positions remain readable behind the clean title.
             */
            this.networkPlayerManager
                .showHiderRevealMarkers();

            this.phaseText`,
"hider victory reveal circles"
);

/* Header + safety */
s =
`/* ${MARK}: persistent Paint Help bubble, spaced sniper hint, remote sniper spectator feedback, clean Finished winner title + Hider reveal circles. */\n` +
s;

for (const token of [
  MARK,
  "PAINT_HELP_PERSISTENT_BUBBLE",
  "HIDER_REMOTE_SNIPER_VIEW",
  "CLEAN_FINISHED_TITLE",
  "showHiderRevealMarkers();",
  "remoteSniperActiveSessionIds",
  "sniperSpectatorStatusText",
]) {
  if (!s.includes(token)) {
    throw new Error(`Safety assertion failed: ${token}. No file written.`);
  }
}

const backupDir = path.join(process.cwd(), ".patch-backups");
fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(
  path.join(backupDir, "GameScene-before-v499.ts"),
  original,
  "utf8",
);
fs.writeFileSync(FILE, s, "utf8");

console.log("");
console.log("[done] v0.10.10.499 CLIENT");
console.log("[1] Paint Help hint: ABOVE button + stays until button pressed");
console.log("[2] sniper discovery hint: >=18px mobile / 22px desktop gap");
console.log("[3] Hider spectator: remote sniper reticle remains exact aim; shotgun cone removed while sniping; status shown");
console.log("[4] Finished: winner title only; giant GAME OVER/countdown text removed");
console.log("[4] Hider victory: survivor reveal circles explicitly shown");
console.log("[safe] sniper fire/camera/server protocol untouched");
console.log("[safe] READY/reconnect/paint sync untouched");
console.log("");
console.log("Next: npm run build");
