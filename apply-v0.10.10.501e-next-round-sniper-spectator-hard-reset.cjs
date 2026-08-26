const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "src", "game", "GameScene.ts");
const MARK = "V1010501E_NEXT_ROUND_SNIPER_SPECTATOR_HARD_RESET";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt CLIENT project root.");
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.501e already applied");
  process.exit(0);
}

const original = s;

function once(before, after, label) {
  const count = s.split(before).length - 1;
  if (count !== 1) {
    throw new Error(
      `${label}: expected 1 match, found ${count}. No file written.`
    );
  }
  s = s.replace(before, after);
}

/* ============================================================
 * A) Centralized remote-sniper spectator reset helper.
 * ============================================================ */
once(
`    private drawRemoteSniperScope(
        aim: NetworkSniperAim,
    ): void {`,
`    /*
     * ${MARK} / REMOTE_SNIPER_SPECTATOR_RESET
     *
     * Remote sniper state is strictly ROUND/HUNT scoped.
     * One helper clears BOTH Phaser and DOM state so stale previous-round
     * sniper data can never leak into the next Hunt.
     */
    private resetRemoteSniperSpectatorState(): void {
        document
            .querySelector(
                '.colorhunt-sniper-spectator-status',
            )
            ?.remove();

        this.sniperSpectatorStatusText
            ?.setVisible(false);

        this.remoteSniperScopes
            .forEach(
                (scope) => {
                    scope.destroy();
                },
            );
        this.remoteSniperScopes.clear();

        this.remoteSniperActiveSessionIds
            .clear();

        this.remoteSniperAimBySessionId
            .clear();
    }

    private drawRemoteSniperScope(
        aim: NetworkSniperAim,
    ): void {`,
"insert remote sniper hard-reset helper"
);

/* ============================================================
 * B) Never cache/render remote sniper aim outside Hunt.
 *    This blocks late packets from previous round.
 * ============================================================ */
once(
`    private drawRemoteSniperScope(
        aim: NetworkSniperAim,
    ): void {
        /*
         * V1010500_PAINT_BUBBLE_VICTORY_FONT_SNIPER_SPECTATE / REMOTE_SCOPE_CAMERA_TARGET`,
`    private drawRemoteSniperScope(
        aim: NetworkSniperAim,
    ): void {
        /*
         * ${MARK} / LATE_SNIPER_AIM_PACKET_GUARD
         *
         * A delayed sniper_aim from the just-finished round may arrive while
         * Lobby/Paint/Countdown is already active. Ignore it completely.
         */
        if (this.phase !== 'hunt') {
            return;
        }

        /*
         * V1010500_PAINT_BUBBLE_VICTORY_FONT_SNIPER_SPECTATE / REMOTE_SCOPE_CAMERA_TARGET`,
"guard remote sniper aim by Hunt phase"
);

/* ============================================================
 * C) Track sniper_state only during Hunt.
 *    Previous-round late active=true must never resurrect state.
 * ============================================================ */
once(
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

                    if (!state.active) {`,
`                    if (
                        state.sessionId !== localId
                    ) {
                        if (
                            this.phase === 'hunt' &&
                            state.active
                        ) {
                            this.remoteSniperActiveSessionIds
                                .add(state.sessionId);
                        } else {
                            /*
                             * ${MARK} / LATE_SNIPER_STATE_PACKET_GUARD
                             * Any non-Hunt sniper_state, even active=true,
                             * is stale for spectator purposes.
                             */
                            this.remoteSniperActiveSessionIds
                                .delete(state.sessionId);
                            this.remoteSniperAimBySessionId
                                .delete(state.sessionId);
                            this.remoteSniperScopes
                                .get(state.sessionId)
                                ?.destroy();
                            this.remoteSniperScopes
                                .delete(state.sessionId);
                        }
                    }

                    if (!state.active) {`,
"phase-gate remote sniper state tracking"
);

/* ============================================================
 * D) Replace 501d duplicated cleanup with helper and ALSO clear
 *    exactly when a NEW Hunt starts, before normal hunter vision.
 * ============================================================ */
once(
`        if (phase !== 'hunt') {
            document
                .querySelector(
                    '.colorhunt-sniper-spectator-status',
                )
                ?.remove();

            this.sniperSpectatorStatusText
                ?.setVisible(false);

            this.remoteSniperScopes
                .forEach(
                    (scope) => {
                        scope.destroy();
                    },
                );
            this.remoteSniperScopes.clear();

            this.remoteSniperActiveSessionIds
                .clear();
            this.remoteSniperAimBySessionId
                .clear();
        }
`,
`        /*
         * ${MARK} / ROUND_BOUNDARY_HARD_RESET
         *
         * 1) Every non-Hunt phase clears remote sniper state.
         * 2) Entering Hunt from Paint/Countdown/Lobby clears it AGAIN.
         *
         * The second reset is intentional: a late previous-round packet may
         * arrive after the non-Hunt cleanup but before next Hunt starts.
         */
        if (
            phase !== 'hunt' ||
            (
                phase === 'hunt' &&
                this.phase !== 'hunt'
            )
        ) {
            this.resetRemoteSniperSpectatorState();
        }
`,
"replace 501d cleanup with round-boundary helper"
);

/* ============================================================
 * E) Extra camera/view fail-safe:
 *    If not actively spectating a current-Hunt sniper, remove DOM badge.
 * ============================================================ */
once(
`        if (!remoteSniperAim) {
            existingSniperSpectatorDom?.remove();
        }

        if (remoteSniperAim) {`,
`        if (!remoteSniperAim) {
            existingSniperSpectatorDom?.remove();
            this.sniperSpectatorStatusText
                ?.setVisible(false);
        }

        if (remoteSniperAim) {`,
"hide stale sniper status when no current aim"
);

s =
`/* ${MARK}: hard-isolate remote sniper spectator state per Hunt/round and ignore late previous-round sniper packets. */\n` +
s;

for (const token of [
  MARK,
  "resetRemoteSniperSpectatorState",
  "LATE_SNIPER_AIM_PACKET_GUARD",
  "LATE_SNIPER_STATE_PACKET_GUARD",
  "ROUND_BOUNDARY_HARD_RESET",
  "this.phase !== 'hunt'",
  "this.phase === 'hunt' &&",
]) {
  if (!s.includes(token)) {
    throw new Error(`Safety assertion failed: ${token}. No file written.`);
  }
}

fs.mkdirSync(".patch-backups", { recursive: true });
fs.writeFileSync(
  ".patch-backups/GameScene-before-v501e.ts",
  original,
  "utf8",
);
fs.writeFileSync(FILE, s, "utf8");

console.log("");
console.log("[done] v0.10.10.501e CLIENT");
console.log("[fix] previous-round sniper scope/status can no longer leak into next round");
console.log("[fix] late sniper_state/sniper_aim packets outside Hunt are ignored/cleared");
console.log("[fix] entering a NEW Hunt hard-resets remote sniper spectator cache once more");
console.log("[fix] normal Hunter TAB view is restored unless CURRENT Hunt has live sniper aim");
console.log("[safe] actual Hunter sniper firing/camera/server protocol untouched");
console.log("[safe] reconnect/READY/paint sync untouched");
console.log("Next: npm run build");
