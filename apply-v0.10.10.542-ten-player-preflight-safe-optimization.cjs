const fs=require("fs"),path=require("path");

const GAME=path.join("src","game","GameScene.ts");
const NET=path.join("src","multiplayer","NetworkPlayerManager.ts");
const MARK="V1010542_TEN_PLAYER_PREFLIGHT_SAFE_OPT";

for(const f of [GAME,NET]){
  if(!fs.existsSync(f)) throw new Error(`Missing ${f}. Run from C:\\Users\\bak12\\color-hunt. No files written.`);
}

let g=fs.readFileSync(GAME,"utf8").replace(/\r\n/g,"\n");
let n=fs.readFileSync(NET,"utf8").replace(/\r\n/g,"\n");
const g0=g,n0=n;

if(g.includes(MARK)||n.includes(MARK)){
  console.log("[skip] v542 already applied.");
  process.exit(0);
}

/* ============================================================
 * A) 10-player stationary remote fast-path
 *
 * Existing syncAuthoritativePositionsNow() already runs at ~15Hz and loops
 * every remote player. That cadence MUST NOT be reduced because the game has
 * already received "stop/go" movement feedback.
 *
 * But stationary Hiders/Hunters do not need another full updatePlayer() call
 * when x/y/role/alive are byte-for-byte unchanged. Colyseus schema callbacks
 * still remain authoritative for all state changes; this is only the fallback
 * scan fast-path.
 * ============================================================ */
{
  const sig="  syncAuthoritativePositionsNow(): void {";
  const a=n.indexOf(sig);
  if(a<0) throw new Error("syncAuthoritativePositionsNow() not found. No files written.");
  const b=n.indexOf("\n  private ",a+sig.length);
  if(b<0) throw new Error("Could not isolate syncAuthoritativePositionsNow(). No files written.");
  let m=n.slice(a,b);

  const anchor=`        if (
          this.players.has(
            sessionId,
          )
        ) {
          this.updatePlayer(
            sessionId,
            player,
          );
        } else {`;

  if(!m.includes(anchor)){
    throw new Error("Authoritative remote update anchor differs. No files written.");
  }

  m=m.replace(anchor,`        const existingView =
          this.players.get(
            sessionId,
          );

        if (existingView) {
          /*
           * ${MARK} / STATIONARY_REMOTE_FAST_PATH
           *
           * Keep the existing ~15Hz movement cadence for moving players.
           * Skip only an expensive fallback update when every gameplay field
           * this scan is responsible for is already identical.
           *
           * Normal Schema onChange handlers are untouched, so role/alive/etc.
           * changes still arrive immediately through the normal path.
           */
          const unchangedPosition =
            existingView.targetX ===
              player.x &&
            existingView.targetY ===
              player.y;

          const unchangedIdentity =
            existingView.role ===
              player.role &&
            existingView.alive ===
              player.alive;

          if (
            unchangedPosition &&
            unchangedIdentity
          ) {
            return;
          }

          this.updatePlayer(
            sessionId,
            player,
          );
        } else {`);

  n=n.slice(0,a)+m+n.slice(b);
}

/* ============================================================
 * B) Pathological transient-VFX circuit breaker for 8-10 players.
 *
 * Do NOT lower normal VFX quality or cadence.
 * Only when more than 220 simultaneously-live one-shot Phaser objects exist
 * in a large room do we reclaim oldest transient objects down to 190.
 *
 * This threshold should never be hit during normal play; it is protection
 * against multiple Hunters firing shotgun/Vulcan/fart effects at once and
 * causing a GC/GPU spike.
 * ============================================================ */
{
  const sig=`    private trackTransientGameplayVfx<T extends Phaser.GameObjects.GameObject>(
        object: T,
    ): T {`;
  const a=g.indexOf(sig);
  if(a<0) throw new Error("trackTransientGameplayVfx() not found. No files written.");
  const b=g.indexOf("\n    private ",a+sig.length);
  if(b<0) throw new Error("Could not isolate trackTransientGameplayVfx(). No files written.");
  let m=g.slice(a,b);

  const addAnchor=`        this.transientGameplayVfx.add(
            object,
        );`;

  if(!m.includes(addAnchor)){
    throw new Error("Transient VFX add anchor differs. No files written.");
  }

  m=m.replace(addAnchor,`        /*
         * ${MARK} / LARGE_ROOM_VFX_CIRCUIT_BREAKER
         *
         * This is intentionally a very high emergency ceiling, not a normal
         * visual-quality reduction. 10-player tactical-effect storms can
         * otherwise create hundreds of short-lived Phaser objects/tweens at
         * exactly the same time and trigger a GC/render spike.
         */
        if (
            this.networkPlayerCount >=
                8 &&
            this.transientGameplayVfx.size >=
                220
        ) {
            const oldest =
                [
                    ...this.transientGameplayVfx,
                ];

            const removeCount =
                Math.max(
                    0,
                    oldest.length -
                        190,
                );

            for (
                let index = 0;
                index < removeCount;
                index += 1
            ) {
                const stale =
                    oldest[index];

                if (
                    stale &&
                    stale.active
                ) {
                    stale.destroy();
                }
            }
        }

${addAnchor}`);

  g=g.slice(0,a)+m+g.slice(b);
}

/* ============================================================
 * C) Cheap large-room diagnostics, console only, once per 5 seconds.
 *
 * No timers, no networking, no DOM, no reconnect changes.
 * This runs only when 8+ players are actually present and simply reports
 * Phaser FPS + transient object count so a 10-player test can distinguish
 * client frame pressure from transport problems.
 * ============================================================ */
{
  const fieldAnchor=`    private transientGameplayVfx =
        new Set<Phaser.GameObjects.GameObject>();`;

  if(!g.includes(fieldAnchor)){
    throw new Error("transientGameplayVfx field anchor not found. No files written.");
  }

  g=g.replace(fieldAnchor,`${fieldAnchor}

    /* ${MARK}: invisible 8-10 player preflight diagnostics; no network/UI side effects. */
    private largeRoomPerfLastLogAt = 0;
    private largeRoomPerfWorstFrameMs = 0;`);

  /* Find public Phaser update() method by distinctive network update call.
     Add diagnostics near its beginning without altering any return/gating. */
  const updateNeedle=`    update(
        _time: number,
        delta: number,
    ): void {`;
  const ua=g.indexOf(updateNeedle);

  if(ua>=0){
    const brace=g.indexOf("{",ua);
    const inject=`
        /*
         * ${MARK} / PASSIVE_PERF_SAMPLE
         * Purely diagnostic. Never changes gameplay timing.
         */
        if (
            this.networkPlayerCount >=
                8
        ) {
            this.largeRoomPerfWorstFrameMs =
                Math.max(
                    this.largeRoomPerfWorstFrameMs,
                    delta,
                );

            if (
                _time -
                    this.largeRoomPerfLastLogAt >=
                5000
            ) {
                const fps =
                    this.game.loop
                        .actualFps;

                console.info(
                    '[Color Hunt][10P perf]',
                    {
                        players:
                            this.networkPlayerCount,
                        fps:
                            Math.round(
                                fps *
                                    10,
                            ) /
                            10,
                        worstFrameMs:
                            Math.round(
                                this.largeRoomPerfWorstFrameMs *
                                    10,
                            ) /
                            10,
                        transientVfx:
                            this.transientGameplayVfx.size,
                    },
                );

                this.largeRoomPerfLastLogAt =
                    _time;
                this.largeRoomPerfWorstFrameMs =
                    0;
            }
        }
`;
    g=g.slice(0,brace+1)+inject+g.slice(brace+1);
    console.log("[ok] passive 8-10 player perf sample added");
  }else{
    console.log("[note] Phaser update(_time, delta) signature differs; telemetry skipped safely");
  }
}

/* Durable markers */
g=`/* ${MARK}: 10-player preflight - stationary fallback fast-path, pathological VFX cap, passive diagnostics. Reconnect/gameplay cadence unchanged. */\n`+g;
n=`/* ${MARK}: stationary remote fallback updates are skipped; moving-player 15Hz transport/smoothing is untouched. */\n`+n;

/* ============================================================
 * Safety assertions: DO NOT damage the known-good stability contracts.
 * ============================================================ */
const netRequired=[
  "private readonly sendInterval = 66",
  "private readonly authoritativeSyncIntervalMs = 66",
  "isGameplayTransportStable()",
  "STALE_LOCAL_ECHO_GUARD",
  "STATIONARY_REMOTE_FAST_PATH",
];
for(const token of netRequired){
  if(!n.includes(token)){
    throw new Error(`Safety assertion failed in NetworkPlayerManager: ${token}. No files written.`);
  }
}

const gameRequired=[
  "transientGameplayVfx",
  "LARGE_ROOM_VFX_CIRCUIT_BREAKER",
];
for(const token of gameRequired){
  if(!g.includes(token)){
    throw new Error(`Safety assertion failed in GameScene: ${token}. No files written.`);
  }
}

/* Explicitly verify we did NOT touch transport cadence. */
if(!/private readonly sendInterval\s*=\s*66\s*;/.test(n))
  throw new Error("Movement send cadence changed unexpectedly. No files written.");
if(!/private readonly authoritativeSyncIntervalMs\s*=\s*66\s*;/.test(n))
  throw new Error("Authority scan cadence changed unexpectedly. No files written.");

/* VFX threshold must remain emergency-only. */
if(!/transientGameplayVfx\.size\s*>=\s*220/.test(g))
  throw new Error("VFX emergency ceiling verification failed. No files written.");

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v542.ts"),g0,"utf8");
fs.writeFileSync(path.join(".patch-backups","NetworkPlayerManager-before-v542.ts"),n0,"utf8");
fs.writeFileSync(GAME,g,"utf8");
fs.writeFileSync(NET,n,"utf8");

console.log("");
console.log("Applied v0.10.10.542.");
console.log(" - moving-player network cadence stays EXACTLY ~15Hz (66ms)");
console.log(" - stationary remote players skip redundant fallback updatePlayer() work");
console.log(" - normal Schema state-change callbacks remain untouched");
console.log(" - 8-10 player VFX storm emergency ceiling = 220 live transient objects");
console.log(" - ceiling trims only pathological overflow down toward 190");
console.log(" - normal shotgun/sniper/Vulcan visual quality/cadence is unchanged");
console.log(" - optional 5s console perf sample activates only at 8+ players");
console.log(" - NO reconnect, Room ownership, paint transport, hit detection or server logic changed");
console.log(" - backups written to .patch-backups");
console.log("Next: npm run build");
