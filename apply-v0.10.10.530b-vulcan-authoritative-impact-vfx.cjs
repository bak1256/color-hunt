const fs = require("fs");
const path = require("path");

const file = path.join("src", "game", "GameScene.ts");
const MARK = "V1010530B_VULCAN_AUTHORITATIVE_IMPACT_VFX";
if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run from C:\\Users\\bak12\\color-hunt. No file written.`);
let s=fs.readFileSync(file,"utf8").replace(/\r\n/g,"\n");
const original=s;
if(s.includes(MARK)){ console.log("[skip] v530b already applied."); process.exit(0); }

// 1) Network vulcan_fired is no longer a legacy aim packet. It is the exact server impact.
const oldCb=`        this.networkUnsubscribers.push(
            multiplayerClient.onVulcanFired((shot: NetworkVulcanFired) => {
                // Legacy v507/v508 packet: kept only for rolling-server compatibility.
                this.vulcanTargetX = shot.x;
                this.vulcanTargetY = shot.y;
            }),
        );`;
const newCb=`        this.networkUnsubscribers.push(
            multiplayerClient.onVulcanFired((shot: NetworkVulcanFired) => {
                /*
                 * ${MARK}
                 * v530 server chooses the authoritative random impact point.
                 * Render THAT exact coordinate. Never move the spotlight/aim
                 * target to a bullet impact and never randomize it again here.
                 */
                this.spawnVulcanPresentationImpact(
                    shot.x,
                    shot.y,
                    false,
                    false,
                );
            }),
        );`;
if(!s.includes(oldCb)) throw new Error("Current onVulcanFired callback not found exactly. No file written.");
s=s.replace(oldCb,newCb);

// 2) Add an exactCoordinate switch. Existing local/spectator synthetic calls keep old behavior
// until removed below; authoritative network calls pass exactCoordinate=false? No: fourth arg false means no random.
const sig=`    private spawnVulcanPresentationImpact(
        x: number,
        y: number,
        withSound: boolean,
    ): void {`;
const sig2=`    private spawnVulcanPresentationImpact(
        x: number,
        y: number,
        withSound: boolean,
        randomize = true,
    ): void {`;
if(!s.includes(sig)) throw new Error("spawnVulcanPresentationImpact signature not found. No file written.");
s=s.replace(sig,sig2);

const oldPx=`        const px =
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
const newPx=`        const px =
            Phaser.Math.Clamp(
                randomize
                    ? x + Phaser.Math.Between(-26, 26)
                    : x,
                0,
                960,
            );

        const py =
            Phaser.Math.Clamp(
                randomize
                    ? y + Phaser.Math.Between(-18, 18)
                    : y,
                0,
                540,
            );`;
if(!s.includes(oldPx)) throw new Error("Current client impact random-offset block not found. No file written.");
s=s.replace(oldPx,newPx);

// 3) Remove fake local/spectator impact generation. Server packets now drive impacts for everyone.
const fake=`            this.spawnVulcanPresentationImpact(
                this.vulcanDisplayX,
                this.vulcanDisplayY,
                true,
            );`;
const fakeCount=s.split(fake).length-1;
if(fakeCount!==1) throw new Error(`Expected exactly one frame-driven fake impact call, found ${fakeCount}. No file written.`);
s=s.replace(fake,`            /* ${MARK}: impact VFX comes from server vulcan_fired coordinates. */
            this.playVulcanGunPulse();`);

s=`/* ${MARK}: visible Vulcan impacts use exact v530 server impact coordinates; spotlight aim remains independent. */\n`+s;
const checks=[
 ["callback exact render",/onVulcanFired[\s\S]{0,700}?spawnVulcanPresentationImpact\([\s\S]{0,160}?shot\.x,[\s\S]{0,80}?shot\.y,[\s\S]{0,80}?false,[\s\S]{0,80}?false/],
 ["randomize param",/randomize = true/],
 ["exact x branch",/randomize\s*\? x \+ Phaser\.Math\.Between\(-26, 26\)\s*:\s*x/],
 ["exact y branch",/randomize\s*\? y \+ Phaser\.Math\.Between\(-18, 18\)\s*:\s*y/],
 ["fake display impact removed",!s.includes(fake)],
];
for(const [label,test] of checks){ const ok=test instanceof RegExp?test.test(s):test; if(!ok) throw new Error(`Postcondition failed: ${label}. No file written.`); }
fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v530b.ts"),original,"utf8");
fs.writeFileSync(file,s,"utf8");
console.log("Applied v0.10.10.530b.");
console.log(" - spotlight/aim remains independent from bullet impacts");
console.log(" - frame-generated fake impact removed");
console.log(" - vulcan_fired now renders the exact server impact coordinate");
console.log(" - no extra +/-26 x +/-18 offset on authoritative impacts");
console.log(" - gun pulse/recoil cadence remains local for responsive BRRRT feel");
console.log("Next: npm run build");
