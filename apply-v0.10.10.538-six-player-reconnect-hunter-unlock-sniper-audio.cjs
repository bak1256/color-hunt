const fs=require("fs"),path=require("path");

const GAME=path.join("src","game","GameScene.ts");
const CLIENT=path.join("src","network","MultiplayerClient.ts");
const MARK="V1010538_SIX_PLAYER_STABILITY_REMOTE_SNIPER_AUDIO";

for(const f of [GAME,CLIENT]){
  if(!fs.existsSync(f)) throw new Error(`Missing ${f}. Run from C:\\Users\\bak12\\color-hunt. No files written.`);
}

let g=fs.readFileSync(GAME,"utf8").replace(/\r\n/g,"\n");
let c=fs.readFileSync(CLIENT,"utf8").replace(/\r\n/g,"\n");
const g0=g,c0=c;

if(g.includes(MARK)||c.includes(MARK)){
  console.log("[skip] v538 already applied.");
  process.exit(0);
}

/* ============================================================
 * A) 6-player reconnect false-positive hardening
 *
 * Video symptom:
 *   multiple reconnect notices around Paint->Hunt, then Hunters frozen.
 *
 * A ping/timer stall caused by a busy paint frame is NOT enough evidence to
 * freeze gameplay. Only warn on ping timeout when there is real transport
 * evidence: browser offline, Room.onDrop, or SDK reconnect in progress.
 * ============================================================ */
{
  const legacyRe=/          if \(\s*activeRound\s*&&\s*silentFor\s*>=\s*(?:15_000|30000|30_000|15000)\s*\) \{\s*this\.notifyConnectionIssue\(\s*["']ping_timeout["']\s*,?\s*\);\s*\}/m;

  if(legacyRe.test(c)){
    c=c.replace(legacyRe,`          /*
           * ${MARK} / REAL_TRANSPORT_ONLY
           *
           * Six-player Paint can briefly stall timers/rendering. Silence by
           * itself is not a disconnect and must never freeze Hunter controls.
           */
          if (
            activeRound &&
            silentFor >= 30_000 &&
            (
              this.browserOfflineCycleActive ||
              (
                this.lastConfirmedTransportDropAt > 0 &&
                now -
                  this.lastConfirmedTransportDropAt <
                  30_000
              ) ||
              room.reconnection
                .isReconnecting
            )
          ) {
            this.notifyConnectionIssue(
              "ping_timeout",
            );
          }`);
    console.log("[ok] upgraded ping-only reconnect warning to real-transport-only");
  }else if(
    c.includes("REAL_TRANSPORT_WARNING_ONLY") ||
    c.includes("REAL_TRANSPORT_ONLY")
  ){
    console.log("[ok] ping false-drop guard already present; left unchanged");
  }else{
    throw new Error("Could not identify current ping-timeout warning policy safely. No files written.");
  }
}

/* ============================================================
 * B) Hunter must not wait on the full paint snapshot barrier in HUNT.
 *
 * The recovery barrier was designed to avoid showing a Hider with missing
 * camouflage. But a Hunter's movement does not depend on replaying every
 * remote paint stroke. With 6 players that barrier can remain pending long
 * enough to make a recovered Hunter look permanently frozen.
 *
 * Keep transport + Room + local PlayerState authority strict.
 * Only bypass the PAINT SNAPSHOT sub-gate for a local Hunter in Hunt.
 * Snapshot replay continues in background.
 * ============================================================ */
{
  const methodStart=g.indexOf("    private canUseRecoveredGameplayNow(): boolean {");
  if(methodStart<0) throw new Error("canUseRecoveredGameplayNow() not found. No files written.");
  const methodEnd=g.indexOf("\n    private ",methodStart+30);
  if(methodEnd<0) throw new Error("Could not isolate canUseRecoveredGameplayNow(). No files written.");
  let m=g.slice(methodStart,methodEnd);

  const oldGate=/            this\.time\.now <\s*this\.reconnectGameplayUnlockNotBefore \|\|\s*!multiplayerClient\s*\.isGameplayTransportStable\(\) \|\|\s*this\.recoveryPaintSnapshotPending/m;

  if(oldGate.test(m)){
    m=m.replace(oldGate,`            this.time.now <
                this.reconnectGameplayUnlockNotBefore ||
            !multiplayerClient
                .isGameplayTransportStable() ||
            (
                this.recoveryPaintSnapshotPending &&
                !(
                    this.phase ===
                        'hunt' &&
                    this.networkPlayerManager
                        .isLocalHunter()
                )
            )`);
    g=g.slice(0,methodStart)+m+g.slice(methodEnd);
    console.log("[ok] local Hunter can unlock in Hunt while remote paint snapshot finishes");
  }else if(
    m.includes("recoveryPaintSnapshotPending") &&
    m.includes("isLocalHunter")
  ){
    console.log("[ok] Hunter paint-barrier bypass already present; left unchanged");
  }else{
    throw new Error("Current recovery paint gate shape differs. No files written.");
  }
}

/* ============================================================
 * C) Remote Sniper shot audio
 *
 * Video 2 + source confirm:
 * local shooter calls playProceduralSniperShot() before sending the shot,
 * but onSniperFired() only draws showSniperImpact() for remote clients.
 * Therefore Hiders see the shot but do not hear the rifle report.
 *
 * Play the existing sniper shot helper ONLY when shooterId != local id.
 * The firing Hunter already played it locally, so no double sound.
 * ============================================================ */
{
  const cbStart=g.indexOf("            multiplayerClient.onSniperFired(");
  if(cbStart<0) throw new Error("onSniperFired callback not found. No files written.");
  const cbEnd=g.indexOf("\n            ),",cbStart);
  if(cbEnd<0) throw new Error("Could not isolate onSniperFired callback. No files written.");
  let cb=g.slice(cbStart,cbEnd);

  if(!cb.includes("this.playProceduralSniperShot()")){
    const anchor=`                    if (shot.shooterId === multiplayerClient.getSessionId()) {`;
    if(!cb.includes(anchor)) throw new Error("Sniper local-shooter anchor not found. No files written.");

    cb=cb.replace(anchor,`                    /*
                     * ${MARK} / REMOTE_SNIPER_REPORT
                     * The shooter already plays this locally before sendSniperFire().
                     * Everyone else (Hiders + other Hunters) hears the network shot.
                     */
                    if (
                        shot.shooterId !==
                        multiplayerClient.getSessionId()
                    ) {
                        this.playProceduralSniperShot();
                    }

${anchor}`);
    g=g.slice(0,cbStart)+cb+g.slice(cbEnd);
    console.log("[ok] remote Hiders/Hunters now hear sniper shot report");
  }else{
    console.log("[ok] remote sniper audio already wired; left unchanged");
  }
}

/* Markers */
g=`/* ${MARK}: 6-player recovery no longer freezes Hunters on paint convergence; remote sniper fire is audible. */\n`+g;
c=`/* ${MARK}: ping silence alone cannot create reconnect/freeze storms in busy large-room Paint. */\n`+c;

/* Postconditions */
const checks=[
  ["client real transport policy",
    c.includes("REAL_TRANSPORT_ONLY") ||
    c.includes("REAL_TRANSPORT_WARNING_ONLY")],
  ["Hunter snapshot bypass",
    /recoveryPaintSnapshotPending[\s\S]{0,260}?phase ===[\s\S]{0,100}?'hunt'[\s\S]{0,180}?isLocalHunter/.test(g)],
  ["remote sniper sound",
    /shot\.shooterId !==[\s\S]{0,140}?multiplayerClient\.getSessionId\(\)[\s\S]{0,180}?playProceduralSniperShot\(\)/.test(g)],
  ["local sniper helper retained",
    (g.match(/playProceduralSniperShot\(\)/g)||[]).length>=3], // definition-like token + local call + remote call
];
for(const [label,ok] of checks){
  if(!ok) throw new Error(`Postcondition failed: ${label}. No files written.`);
}

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v538.ts"),g0,"utf8");
fs.writeFileSync(path.join(".patch-backups","MultiplayerClient-before-v538.ts"),c0,"utf8");
fs.writeFileSync(GAME,g,"utf8");
fs.writeFileSync(CLIENT,c,"utf8");

console.log("");
console.log("Applied v0.10.10.538.");
console.log(" - busy Paint timer silence alone cannot show reconnect/freeze gameplay");
console.log(" - real offline/onDrop/SDK reconnect still triggers normal recovery");
console.log(" - recovered Hunter in Hunt no longer waits for full remote paint snapshot");
console.log(" - Room/local-player/transport authority checks remain strict");
console.log(" - Hiders still keep strict paint convergence");
console.log(" - remote Hiders and other Hunters now hear the existing sniper rifle report");
console.log(" - firing Hunter does not receive duplicate sniper audio");
console.log("Next: npm run build");
