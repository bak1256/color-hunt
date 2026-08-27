const fs = require("fs");
const path = require("path");

const file = path.join("src","game","GameScene.ts");
const MARK = "V1010530F_VULCAN_AUTHORITATIVE_IMPACT_NO_GUESS";
if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run from C:\\Users\\bak12\\color-hunt. No file written.`);

let s = fs.readFileSync(file,"utf8").replace(/\r\n/g,"\n");
const original=s;
if(s.includes(MARK)){ console.log("[skip] v530f already applied."); process.exit(0); }

// Current network callback: replace its BODY only.
// This avoids assumptions about the impact renderer's internal px/py implementation.
const cbStart=s.indexOf("            multiplayerClient.onVulcanFired((shot: NetworkVulcanFired) => {");
if(cbStart<0) throw new Error("onVulcanFired callback start not found. No file written.");
const bodyStart=s.indexOf("{",cbStart)+1;
const cbClose=s.indexOf("\n            }),",bodyStart);
if(bodyStart<=0 || cbClose<0) throw new Error("onVulcanFired callback end not found. No file written.");
const oldBody=s.slice(bodyStart,cbClose);
if(!oldBody.includes("shot.x") || !oldBody.includes("shot.y"))
  throw new Error("Current onVulcanFired body does not reference shot.x/y. No file written.");

const newBody=`
                /*
                 * ${MARK}
                 * v530 server sends the REAL random impact coordinate.
                 * Draw a compact impact directly at shot.x/y.
                 * Do not feed bullet impacts back into vulcanTargetX/Y.
                 */
                const impactX =
                    Phaser.Math.Clamp(
                        shot.x,
                        0,
                        960,
                    );

                const impactY =
                    Phaser.Math.Clamp(
                        shot.y,
                        0,
                        540,
                    );

                const impact =
                    this.add
                        .circle(
                            impactX,
                            impactY,
                            7,
                            0xffd166,
                            0.96,
                        )
                        .setDepth(
                            10035,
                        );

                impact.setStrokeStyle(
                    3,
                    0xff7a00,
                    0.98,
                );

                this.tweens.add({
                    targets:
                        impact,
                    scale:
                        1.65,
                    alpha:
                        0,
                    duration:
                        105,
                    ease:
                        'Quad.Out',
                    onComplete:
                        () =>
                            impact.destroy(),
                });
`;
s=s.slice(0,bodyStart)+newBody+s.slice(cbClose);

// Remove the old client-generated fake impact call. This is the only place where
// the visual hit was independently randomized from vulcanDisplayX/Y.
// Match only the call with vulcanDisplayX/Y, irrespective of whitespace.
const fakeRe=/\s*this\.spawnVulcanPresentationImpact\(\s*this\.vulcanDisplayX\s*,\s*this\.vulcanDisplayY\s*,\s*true\s*,?\s*\);/g;
const fake=s.match(fakeRe)||[];
if(fake.length!==1) throw new Error(`Expected exactly one local fake Vulcan impact call, found ${fake.length}. No file written.`);
s=s.replace(fake[0],`
            /* ${MARK}: impact position comes only from server vulcan_fired. */
            this.playVulcanGunPulse();`);

// Preserve existing impact helper untouched. No px/py assumptions at all.
s=`/* ${MARK}: server shot.x/y directly drives visible Vulcan impacts. */\n`+s;

// Postconditions.
if(s.includes("this.vulcanTargetX = shot.x") || s.includes("this.vulcanTargetY = shot.y"))
  throw new Error("Postcondition failed: bullet packet still mutates spotlight aim. No file written.");
if(!/onVulcanFired[\s\S]{0,1800}?Phaser\.Math\.Clamp\(\s*shot\.x/.test(s))
  throw new Error("Postcondition failed: exact shot.x render missing. No file written.");
if(!/onVulcanFired[\s\S]{0,2200}?Phaser\.Math\.Clamp\(\s*shot\.y/.test(s))
  throw new Error("Postcondition failed: exact shot.y render missing. No file written.");
if(/spawnVulcanPresentationImpact\(\s*this\.vulcanDisplayX\s*,\s*this\.vulcanDisplayY/.test(s))
  throw new Error("Postcondition failed: fake display impact remains. No file written.");

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v530f.ts"),original,"utf8");
fs.writeFileSync(file,s,"utf8");

console.log("Applied v0.10.10.530f.");
console.log(" - NO assumptions about existing px/py random-offset code");
console.log(" - exact server shot.x/y draws the visible impact directly");
console.log(" - bullet packets no longer move spotlight aim");
console.log(" - old local fake/random impact call removed");
console.log(" - existing impact helper left untouched");
console.log("Next: npm run build");
