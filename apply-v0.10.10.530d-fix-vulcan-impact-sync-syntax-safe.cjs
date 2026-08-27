const fs = require("fs");
const path = require("path");

const file = path.join("src","game","GameScene.ts");
const MARK = "V1010530D_VULCAN_IMPACT_SYNC";
if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run from C:\\Users\\bak12\\color-hunt. No file written.`);

let s=fs.readFileSync(file,"utf8").replace(/\r\n/g,"\n");
const original=s;

if (s.includes(MARK)) { console.log("[skip] v530d already applied."); process.exit(0); }

// If failed 530c partially wrote, refuse: user should restore first.
if (s.includes("V1010530C_VULCAN_AUTHORITATIVE_IMPACT_VFX")) {
  throw new Error("Partial v530c markers detected. Restore GameScene.ts from git/backup first. No file written.");
}

// Exact callback from the user's current GameScene.
const oldCb=`        this.networkUnsubscribers.push(
            multiplayerClient.onVulcanFired((shot: NetworkVulcanFired) => {
                // Legacy v507/v508 packet: kept only for rolling-server compatibility.
                this.vulcanTargetX = shot.x;
                this.vulcanTargetY = shot.y;
            }),
        );`;
const newCb=`        this.networkUnsubscribers.push(
            multiplayerClient.onVulcanFired((shot: NetworkVulcanFired) => {
                /* ${MARK}: server coordinate is the actual bullet impact. */
                this.spawnVulcanPresentationImpact(
                    shot.x,
                    shot.y,
                    false,
                    true,
                );
            }),
        );`;
if ((s.split(oldCb).length-1)!==1) throw new Error("Expected current onVulcanFired block exactly once. No file written.");
s=s.replace(oldCb,newCb);

// Exact current method signature.
const oldSig=`    private spawnVulcanPresentationImpact(
        x: number,
        y: number,
        withSound: boolean,
    ): void {`;
const newSig=`    private spawnVulcanPresentationImpact(
        x: number,
        y: number,
        withSound: boolean,
        exactCoordinate = false,
    ): void {`;
if ((s.split(oldSig).length-1)!==1) throw new Error("Current impact method signature not found exactly once. No file written.");
s=s.replace(oldSig,newSig);

// Replace exact coordinate calculations from the user's current source.
const oldCoords=`        const px =
            Phaser.Math.Clamp(
                x +
                    Phaser.Math.Between(
                        -26,
                        26,
                    ),
                0,
                960,
            );

        const py =
            Phaser.Math.Clamp(
                y +
                    Phaser.Math.Between(
                        -18,
                        18,
                    ),
                0,
                540,
            );`;
const newCoords=`        const px =
            Phaser.Math.Clamp(
                exactCoordinate
                    ? x
                    : x +
                        Phaser.Math.Between(
                            -26,
                            26,
                        ),
                0,
                960,
            );

        const py =
            Phaser.Math.Clamp(
                exactCoordinate
                    ? y
                    : y +
                        Phaser.Math.Between(
                            -18,
                            18,
                        ),
                0,
                540,
            );`;
if ((s.split(oldCoords).length-1)!==1) throw new Error("Current px/py block not found exactly once. No file written.");
s=s.replace(oldCoords,newCoords);

// Current fake local impact cadence is 58ms in the uploaded source.
// Remove ONLY the fake impact generation. Keep the existing recoil block below intact.
// We intentionally do not add playVulcanGunPulse() here because the old helper call
// already played it; replace with that pulse only.
const oldCall=`            this.spawnVulcanPresentationImpact(
                this.vulcanDisplayX,
                this.vulcanDisplayY,
                true,
            );`;
const newCall=`            /* ${MARK}: VFX position comes only from server vulcan_fired. */
            this.playVulcanGunPulse();`;
if ((s.split(oldCall).length-1)!==1) throw new Error("Expected current frame-driven fake impact call exactly once. No file written.");
s=s.replace(oldCall,newCall);

s=`/* ${MARK}: exact server Vulcan impact coordinates drive client impact VFX. */\n`+s;

// Conservative postconditions.
const methodStart=s.indexOf("    private spawnVulcanPresentationImpact(");
const methodEnd=s.indexOf("\n    private ",methodStart+20);
const method=s.slice(methodStart,methodEnd);
if (!method.includes("exactCoordinate = false")) throw new Error("Postcondition failed: exactCoordinate. No file written.");
if (!method.includes("? x") || !method.includes("? y")) throw new Error("Postcondition failed: exact coordinate branches. No file written.");
if (s.includes("this.vulcanTargetX = shot.x") || s.includes("this.vulcanTargetY = shot.y")) throw new Error("Postcondition failed: legacy shot->aim mutation remains. No file written.");
if (!/onVulcanFired[\s\S]{0,500}?shot\.x,[\s\S]{0,100}?shot\.y,[\s\S]{0,100}?false,[\s\S]{0,100}?true/.test(s)) throw new Error("Postcondition failed: server impact render callback. No file written.");
if ((s.match(/this\.spawnVulcanPresentationImpact\(/g)||[]).length !== 1) throw new Error("Postcondition failed: unexpected impact call count. No file written.");

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v530d.ts"),original,"utf8");
fs.writeFileSync(file,s,"utf8");

console.log("Applied v0.10.10.530d.");
console.log(" - server vulcan_fired x/y -> exact visible impact");
console.log(" - no extra +/-26 x +/-18 random offset for server impacts");
console.log(" - bullet impact packet no longer moves spotlight aim");
console.log(" - old local fake impact removed; BRRRT pulse/recoil retained");
console.log("Next: npm run build");
