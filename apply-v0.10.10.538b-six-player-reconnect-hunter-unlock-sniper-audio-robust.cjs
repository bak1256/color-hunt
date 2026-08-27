const fs=require("fs"),path=require("path");
const GAME=path.join("src","game","GameScene.ts");
const CLIENT=path.join("src","network","MultiplayerClient.ts");
const MARK="V1010538B_SIX_PLAYER_STABILITY_REMOTE_SNIPER_AUDIO_ROBUST";
for(const f of [GAME,CLIENT]) if(!fs.existsSync(f)) throw new Error(`Missing ${f}. Run from client root.`);
let g=fs.readFileSync(GAME,"utf8").replace(/\r\n/g,"\n");
let c=fs.readFileSync(CLIENT,"utf8").replace(/\r\n/g,"\n");
const g0=g,c0=c;
if(g.includes(MARK)||c.includes(MARK)){console.log("[skip] v538b already applied");process.exit(0);}

/* 1) Ping warning: current builds may already contain the hardened 30s guard.
   Do not fail merely because the exact old text changed. Only rewrite an
   actually unsafe ping-only condition. */
const pingCall=/this\.notifyConnectionIssue\(\s*["']ping_timeout["']\s*,?\s*\)/g;
const pingCount=(c.match(pingCall)||[]).length;
if(pingCount<1) console.log("[note] no ping_timeout warning call found; nothing to rewrite");
else {
  const unsafe=/if\s*\(\s*activeRound\s*&&\s*silentFor\s*>=\s*(?:15_000|15000|8_000|8000)\s*\)\s*\{\s*this\.notifyConnectionIssue\(\s*["']ping_timeout["']\s*,?\s*\);\s*\}/m;
  if(unsafe.test(c)){
    c=c.replace(unsafe,`if (
            activeRound &&
            silentFor >= 30_000 &&
            (
              this.browserOfflineCycleActive ||
              this.lastConfirmedTransportDropAt > 0 ||
              room.reconnection.isReconnecting
            )
          ) {
            /* ${MARK} / REAL_TRANSPORT_ONLY */
            this.notifyConnectionIssue(
              "ping_timeout",
            );
          }`);
    console.log("[ok] unsafe ping-only reconnect warning hardened");
  } else {
    console.log("[ok] current ping policy is already hardened/different; preserved verbatim");
  }
}

/* 2) Exact current recovery gate: only the paint-snapshot term is relaxed for
   a Hunter already in Hunt. Transport and unlock delay stay mandatory. */
const gate=`            !multiplayerClient
                .isGameplayTransportStable() ||
            this.recoveryPaintSnapshotPending`;
if(g.includes(gate)){
  g=g.replace(gate,`            !multiplayerClient
                .isGameplayTransportStable() ||
            (
                this.recoveryPaintSnapshotPending &&
                !(
                    this.phase ===
                        'hunt' &&
                    this.networkPlayerManager
                        ?.isLocalHunter()
                )
            )`);
  console.log("[ok] Hunter Hunt unlock no longer waits on remote paint convergence");
} else if(/recoveryPaintSnapshotPending[\s\S]{0,300}?isLocalHunter/.test(g)){
  console.log("[ok] Hunter recovery bypass already present");
} else {
  throw new Error("Current recoveryPaintSnapshotPending gate differs. No files written.");
}

/* 3) Remote sniper audio. */
const cbStart=g.indexOf("            multiplayerClient.onSniperFired(");
if(cbStart<0) throw new Error("onSniperFired callback not found. No files written.");
const cbEnd=g.indexOf("\n            ),",cbStart);
if(cbEnd<0) throw new Error("Could not isolate onSniperFired callback. No files written.");
let cb=g.slice(cbStart,cbEnd);
if(!cb.includes("this.playProceduralSniperShot()")){
  const anchor="                    if (shot.shooterId === multiplayerClient.getSessionId()) {";
  if(!cb.includes(anchor)) throw new Error("Sniper shooter anchor differs. No files written.");
  cb=cb.replace(anchor,`                    /*
                     * ${MARK} / REMOTE_SNIPER_REPORT
                     * Local shooter already plays the report before send.
                     */
                    if (
                        shot.shooterId !==
                        multiplayerClient.getSessionId()
                    ) {
                        this.playProceduralSniperShot();
                    }

${anchor}`);
  g=g.slice(0,cbStart)+cb+g.slice(cbEnd);
  console.log("[ok] remote Hiders/Hunters hear sniper fire");
}else console.log("[ok] remote sniper audio already present");

g=`/* ${MARK}: Hunter recovery paint barrier relaxed in Hunt; remote sniper report synced. */\n`+g;
c=`/* ${MARK}: preserves current reconnect policy; only unsafe legacy ping-only warning is rewritten. */\n`+c;

if(!/recoveryPaintSnapshotPending[\s\S]{0,300}?isLocalHunter/.test(g))
  throw new Error("Verification failed: Hunter recovery bypass.");
if(!/shot\.shooterId !==[\s\S]{0,180}?getSessionId\(\)[\s\S]{0,220}?playProceduralSniperShot\(\)/.test(g))
  throw new Error("Verification failed: remote sniper audio.");

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v538b.ts"),g0);
fs.writeFileSync(path.join(".patch-backups","MultiplayerClient-before-v538b.ts"),c0);
fs.writeFileSync(GAME,g);
fs.writeFileSync(CLIENT,c);
console.log("\n[done] v0.10.10.538b applied");
console.log("[safe] current reconnect policy preserved when already hardened");
console.log("[safe] transport stability + recovery delay remain mandatory");
console.log("[fix] Hunter Hunt movement does not wait for remote paint snapshot");
console.log("[fix] remote clients hear sniper shot without doubling shooter audio");
console.log("Next: npm run build");
