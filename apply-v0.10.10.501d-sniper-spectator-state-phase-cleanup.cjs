const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "src", "game", "GameScene.ts");
const MARK = "V1010501D_SNIPER_SPECTATOR_PHASE_CLEANUP";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt CLIENT project root.");
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.501d already applied");
  process.exit(0);
}

const anchor =
`    private applyNetworkPhase(
        phase: string,
        phaseEndsAt: number,
    ): void {
        this.phaseExpiredSince = 0;
`;

const count = s.split(anchor).length - 1;
if (count !== 1) {
  throw new Error(
    `applyNetworkPhase anchor: expected 1 match, found ${count}. No file written.`
  );
}

const replacement =
`    private applyNetworkPhase(
        phase: string,
        phaseEndsAt: number,
    ): void {
        this.phaseExpiredSince = 0;

        /*
         * ${MARK}
         *
         * Remote sniper spectator visuals/state belong to Hunt ONLY.
         * v501 moved the visible "저격 모드 중..." badge to document.body,
         * so Phaser's normal clearAllAimingVisuals() cannot remove that DOM node.
         *
         * Hard-clean at every non-Hunt authoritative phase boundary:
         * finished -> lobby, direct lobby recovery, countdown/paint reconnect.
         */
        if (phase !== 'hunt') {
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
`;

s = s.replace(anchor, replacement);

s =
`/* ${MARK}: remote sniper spectator DOM/scope/state is hard-cleared whenever authoritative phase is not Hunt. */\n` +
s;

for (const token of [
  MARK,
  "'.colorhunt-sniper-spectator-status'",
  "this.remoteSniperScopes.clear();",
  "this.remoteSniperActiveSessionIds",
  "this.remoteSniperAimBySessionId",
  "if (phase !== 'hunt')",
]) {
  if (!s.includes(token)) {
    throw new Error(`Safety assertion failed: ${token}. No file written.`);
  }
}

fs.mkdirSync(".patch-backups", { recursive: true });
fs.writeFileSync(
  ".patch-backups/GameScene-before-v501d.ts",
  fs.readFileSync(FILE, "utf8"),
  "utf8",
);
fs.writeFileSync(FILE, s, "utf8");

console.log("");
console.log("[done] v0.10.10.501d CLIENT");
console.log("[fix] '저격 모드 중...' DOM badge removed immediately on Finished/Lobby");
console.log("[fix] remote sniper scopes, active-session set, aim cache cleared outside Hunt");
console.log("[safe] active Hunt sniper spectating/follow camera is unchanged");
console.log("[safe] server/network/reconnect/READY/paint sync untouched");
console.log("Next: npm run build");
