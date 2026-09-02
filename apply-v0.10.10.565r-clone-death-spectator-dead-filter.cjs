const fs = require("fs");
const path = require("path");

const MARK = "V1010565R_CLONE_DEATH_SPECTATOR_DEAD_FILTER";

function fail(message) {
  throw new Error(`${message} No file written.`);
}

function firstExisting(paths) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) return path.resolve(p);
  }
  return "";
}

function countOf(source, token) {
  return source.split(token).length - 1;
}

function replaceOnce(source, before, after, label) {
  const count = countOf(source, before);
  if (count !== 1) {
    fail(`${label}: expected exactly 1 match, found ${count}.`);
  }
  const next = source.replace(before, after);
  if (next === source) fail(`${label}: replacement made no change.`);
  console.log(`[ok] ${label}`);
  return next;
}

function sliceMethod(source, startNeedle, endNeedle, label) {
  const start = source.indexOf(startNeedle);
  if (start < 0) fail(`${label}: start anchor missing.`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  if (end < 0) fail(`${label}: end anchor missing.`);
  return { start, end, text: source.slice(start, end) };
}

const cwd = process.cwd();
const gameFile = firstExisting([
  path.join(cwd, "src", "game", "GameScene.ts"),
  path.join(cwd, "..", "color-hunt", "src", "game", "GameScene.ts"),
]);

if (!gameFile) {
  fail(
    "GameScene.ts not found. Run from C:\\Users\\bak12\\color-hunt " +
    "or C:\\Users\\bak12\\color-hunt-server."
  );
}

let s = fs.readFileSync(gameFile, "utf8");
const original = s;

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.565r already applied.");
  process.exit(0);
}

for (const token of [
  "V1010555_CLONE_DANCE_PARTY_CLIENT",
  "private startCloneDanceParty(",
  "private finishCloneDanceParty(",
  "private clearCloneDancePartyFx(",
  "private cycleSpectatorView(): void",
  "private getActiveHuntViewTarget()",
  "getSpectatablePlayers()",
]) {
  if (!s.includes(token)) fail(`Required current client token missing: ${token}`);
}

/* -------------------------------------------------------------------------
 * 1) One small authoritative/render-alive helper shared by Clone Dance + view.
 * ---------------------------------------------------------------------- */
{
  const anchor = `    private startCloneDanceParty(
        event:NetworkHiderCloneDanceParty,
    ):void{`;

  const helper = `    /*
     * ${MARK} / ALIVE_VIEW_AUTHORITY
     * A cinematic or spectator target is valid only while BOTH the room Schema
     * and the rendered NetworkPlayerManager still consider that player alive.
     * This closes the brief death frame where a stale container can otherwise
     * remain camera/cinematic-owned.
     */
    private isNetworkPlayerAliveForView(
        sessionId:string,
    ):boolean{
        if(!sessionId)return false;

        const roomPlayer=
            multiplayerClient.getRoom()
                ?.state.players.get(
                    sessionId,
                );

        const renderedAlive=
            this.networkPlayerManager
                .getSpectatablePlayers()
                .some(
                    (player)=>
                        player.sessionId===
                        sessionId,
                );

        return roomPlayer
            ? Boolean(roomPlayer.alive) &&
                renderedAlive
            : renderedAlive;
    }

${anchor}`;

  s = replaceOnce(
    s,
    anchor,
    helper,
    "shared alive-view helper",
  );
}

/* -------------------------------------------------------------------------
 * 2) Clone Dance may never start/continue on a dead owner.
 *    The 50ms dance tick becomes a hard death barrier.
 * ---------------------------------------------------------------------- */
{
  const startInfo = sliceMethod(
    s,
    "    private startCloneDanceParty(",
    "\n    private finishCloneDanceParty(",
    "startCloneDanceParty",
  );
  let method = startInfo.text;

  method = replaceOnce(
    method,
`        if(!owner)return;

        /*
         * If a duplicate/reconnect start arrives, clean only this owner's old`,
`        if(!owner)return;

        /*
         * ${MARK} / LATE_START_DEATH_GUARD
         * A delayed/reordered Clone Dance start must never resurrect a Hider
         * that has already been found.
         */
        if(
            !this.isNetworkPlayerAliveForView(
                event.sessionId,
            )
        ){
            return;
        }

        /*
         * If a duplicate/reconnect start arrives, clean only this owner's old`,
    "Clone Dance late-start death guard",
  );

  method = replaceOnce(
    method,
`                    callback:()=>{
                        if(
                            this.phase!=='hunt' ||
                            this.roundResultWinner!==null ||
                            !this.cloneDancePartyRuntimes.has(
                                event.sessionId,
                            )
                        ){
                            return;
                        }

                        const t=`,
`                    callback:()=>{
                        /*
                         * ${MARK} / SAME_FRAME_DEATH_CANCEL
                         * Schema death wins over every cinematic timer. Do not
                         * wait for the normal Clone Dance end event.
                         */
                        if(
                            !this.isNetworkPlayerAliveForView(
                                event.sessionId,
                            )
                        ){
                            this.finishCloneDanceParty(
                                event.sessionId,
                                false,
                            );
                            return;
                        }

                        if(
                            this.phase!=='hunt' ||
                            this.roundResultWinner!==null ||
                            !this.cloneDancePartyRuntimes.has(
                                event.sessionId,
                            )
                        ){
                            return;
                        }

                        const t=`,
    "Clone Dance death cancels immediately",
  );

  s = s.slice(0, startInfo.start) + method + s.slice(startInfo.end);
}

/* -------------------------------------------------------------------------
 * 3) Death cleanup must use the SAME corpse alpha as normal Hider death.
 *    Normal NetworkPlayerManager corpse parent alpha = 0.28.
 * ---------------------------------------------------------------------- */
{
  const info = sliceMethod(
    s,
    "    private finishCloneDanceParty(",
    "\n    private clearCloneDancePartyFx(",
    "finishCloneDanceParty",
  );
  let method = info.text;

  method = replaceOnce(
    method,
`        if(!runtime)return;

        runtime.danceTimer?.remove(false);`,
`        if(!runtime)return;

        /*
         * ${MARK} / NORMAL_CORPSE_PARITY
         * Capture alive state before releasing cinematic ownership. If the
         * owner died during the dance, never force the parent back to alpha 1.
         */
        const ownerAliveForView=
            this.isNetworkPlayerAliveForView(
                sessionId,
            );

        runtime.danceTimer?.remove(false);`,
    "Clone Dance corpse-parity state",
  );

  const alphaCount = countOf(method, ".setAlpha(1);");
  if (alphaCount !== 2) {
    fail(`finishCloneDanceParty: expected 2 owner .setAlpha(1) writes, found ${alphaCount}.`);
  }
  method = method.replace(
    /\.setAlpha\(1\);/g,
    `.setAlpha(
                ownerAliveForView
                    ? 1
                    : 0.28,
            );`,
  );

  s = s.slice(0, info.start) + method + s.slice(info.end);
  console.log("[ok] Clone Dance dead owner now uses normal 0.28 corpse alpha");
}

/* Result/terminal hard cleanup also must not re-brighten a dead dance owner. */
{
  const info = sliceMethod(
    s,
    "    private clearCloneDancePartyFx(",
    "\n    private applyCloneDanceParty(",
    "clearCloneDancePartyFx",
  );
  let method = info.text;

  const ownerBlock = `            runtime.danceTimer?.remove(false);
            runtime.noteTimer?.remove(false);

            runtime.owner`;

  const replacement = `            runtime.danceTimer?.remove(false);
            runtime.noteTimer?.remove(false);

            const ownerAliveForView=
                this.isNetworkPlayerAliveForView(
                    sessionId,
                );

            runtime.owner`;

  method = replaceOnce(
    method,
    ownerBlock,
    replacement,
    "result Clone Dance owner alive state",
  );

  const alphaCount = countOf(method, ".setAlpha(1);");
  if (alphaCount !== 1) {
    fail(`clearCloneDancePartyFx: expected 1 owner .setAlpha(1) write, found ${alphaCount}.`);
  }
  method = method.replace(
    ".setAlpha(1);",
    `.setAlpha(
                    ownerAliveForView
                        ? 1
                        : 0.28,
                );`,
  );

  s = s.slice(0, info.start) + method + s.slice(info.end);
  console.log("[ok] result cleanup cannot brighten a dead Clone Dance owner");
}

/* -------------------------------------------------------------------------
 * 4) Spectator cycle: SELF is a valid slot only while local Hider is alive.
 *    Dead remote players are already filtered by getSpectatablePlayers().
 * ---------------------------------------------------------------------- */
{
  const info = sliceMethod(
    s,
    "    private cycleSpectatorView(): void {",
    "\n    private getActiveHuntViewTarget()",
    "cycleSpectatorView",
  );
  let method = info.text;

  method = replaceOnce(
    method,
`        /*
         * Final slot is always SELF so TAB can return to normal play.
         */
        const cycle = [
            ...ordered.map(
                (player) =>
                    player.sessionId,
            ),
            '',
        ];`,
`        /*
         * ${MARK} / DEAD_SELF_FILTER
         * SELF is a valid camera slot only while the local Hider is alive.
         * A dead Hider must never cycle back to his own corpse camera.
         */
        const localAlive=
            Boolean(
                multiplayerClient
                    .getLocalPlayer()
                    ?.alive,
            );

        const cycle = [
            ...ordered.map(
                (player) =>
                    player.sessionId,
            ),
            ...(localAlive
                ? ['']
                : []),
        ];`,
    "spectator dead-self slot filter",
  );

  s = s.slice(0, info.start) + method + s.slice(info.end);
}

/* -------------------------------------------------------------------------
 * 5) Camera target: stale/dead selected player is rejected every frame.
 *    If the local Hider is dead, automatically follow the first live player
 *    rather than falling through to the local corpse.
 * ---------------------------------------------------------------------- */
{
  const info = sliceMethod(
    s,
    "    private getActiveHuntViewTarget():",
    "\n    private forceFinishedFullMapCamera()",
    "getActiveHuntViewTarget",
  );
  let method = info.text;

  const oldBody = `        if (this.spectatorSessionId) {
            const spectated =
                this.networkPlayerManager
                    .getPlayerContainer(
                        this.spectatorSessionId,
                    );

            if (spectated) {
                return spectated;
            }

            this.spectatorSessionId = '';
        }

        return this.networkPlayerManager
            .getLocalPlayerContainer();`;

  const newBody = `        if (this.spectatorSessionId) {
            const aliveSelected=
                this.isNetworkPlayerAliveForView(
                    this.spectatorSessionId,
                );

            if(aliveSelected){
                const spectated =
                    this.networkPlayerManager
                        .getPlayerContainer(
                            this.spectatorSessionId,
                        );

                if (spectated) {
                    return spectated;
                }
            }

            /*
             * ${MARK} / STALE_DEAD_TARGET_EJECT
             * Never let a dead/stale container remain the camera target.
             */
            this.spectatorSessionId = '';
            this.spectatorCycleIndex = -1;
        }

        const localId=
            multiplayerClient.getSessionId();

        const localAlive=
            Boolean(
                localId &&
                this.isNetworkPlayerAliveForView(
                    localId,
                ),
            );

        if(localAlive){
            return this.networkPlayerManager
                .getLocalPlayerContainer();
        }

        /*
         * Local Hider is dead: choose a live remote target immediately.
         * This prevents the empty SELF slot from becoming a corpse camera even
         * before the user presses TAB again.
         */
        const fallback=
            this.networkPlayerManager
                .getSpectatablePlayers()
                .find(
                    (player)=>
                        player.sessionId!==
                        localId,
                );

        if(fallback){
            this.spectatorSessionId=
                fallback.sessionId;
            this.spectatorCycleIndex=0;

            this.spectatorStatusText
                ?.setText(
                    this.formatSpectatorStatus(
                        fallback.name,
                    ),
                )
                .setVisible(true);

            return this.networkPlayerManager
                .getPlayerContainer(
                    fallback.sessionId,
                );
        }

        return null;`;

  method = replaceOnce(
    method,
    oldBody,
    newBody,
    "active Hunt camera dead-target rejection",
  );

  s = s.slice(0, info.start) + method + s.slice(info.end);
}

/* -------------------------------------------------------------------------
 * 6) Hider vision post-pass: never derive circular vision from a dead SELF.
 * ---------------------------------------------------------------------- */
{
  const info = sliceMethod(
    s,
    "    private updateHuntTension(",
    "\n    private unlockGameAudio(): void {",
    "updateHuntTension",
  );
  let method = info.text;

  const oldLocalPosition = `        const localPosition =
            spectatedPlayer
                ? new Phaser.Math.Vector2(
                    spectatedPlayer.x,
                    spectatedPlayer.y,
                )
                : this.networkPlayerManager
                    .getLocalPlayerPosition();`;

  const newLocalPosition = `        const localSessionId=
            multiplayerClient.getSessionId();

        const localAliveForView=
            Boolean(
                localSessionId &&
                this.isNetworkPlayerAliveForView(
                    localSessionId,
                ),
            );

        const localPosition =
            spectatedPlayer
                ? new Phaser.Math.Vector2(
                    spectatedPlayer.x,
                    spectatedPlayer.y,
                )
                : localAliveForView
                    ? this.networkPlayerManager
                        .getLocalPlayerPosition()
                    : null;`;

  method = replaceOnce(
    method,
    oldLocalPosition,
    newLocalPosition,
    "Hider vision dead-self position filter",
  );

  s = s.slice(0, info.start) + method + s.slice(info.end);
}

/* Durable source marker. */
s = `/* ${MARK}: Clone Dance ends on owner death; normal corpse alpha; dead players excluded from Hider view switching. */\n` + s;

/* Final safety checks. */
for (const token of [
  MARK,
  "private isNetworkPlayerAliveForView(",
  "SAME_FRAME_DEATH_CANCEL",
  "ownerAliveForView",
  "? 1\n                    : 0.28",
  "DEAD_SELF_FILTER",
  "STALE_DEAD_TARGET_EJECT",
  "localAliveForView",
  "this.finishCloneDanceParty(\n                                event.sessionId,\n                                false,",
  "V1010555_CLONE_DANCE_PARTY_CLIENT",
  "V1010555F_CLONE_DANCE_FIXED_OWNER_BGM_RESUME_CLIENT",
]) {
  if (!s.includes(token)) fail(`Final safety token missing: ${token}`);
}

const backupDir = path.join(
  path.dirname(gameFile),
  "..",
  "..",
  ".patch-backups",
);
fs.mkdirSync(backupDir, { recursive: true });

const backupFile = path.join(
  backupDir,
  "GameScene-before-v0.10.10.565r.ts",
);

fs.writeFileSync(backupFile, original, "utf8");
fs.writeFileSync(gameFile, s, "utf8");

console.log("");
console.log("[done] v0.10.10.565r CLONE DEATH + SPECTATOR DEAD FILTER applied");
console.log("[clone] dead Clone Dance owner cancels party within the 50ms dance tick");
console.log("[clone] all clone sprites are destroyed immediately; no exit-smoke delay on death");
console.log("[corpse] Clone Dance can no longer force dead owner alpha back to 1");
console.log("[corpse] dead owner uses the normal Hider corpse parent alpha 0.28");
console.log("[view] dead remote players are rejected as camera targets every frame");
console.log("[view] dead local Hider SELF slot is removed; a live remote target is selected instead");
console.log("[vision] dead SELF position cannot generate Hider circular vision");
console.log("[safe] Clone Dance normal end/cancel smoke, BGM, textures and taunt logic are preserved");
console.log(`[backup] ${backupFile}`);
console.log("Next: npm run build");
