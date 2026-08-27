const fs = require("fs");
const path = require("path");

const file = path.join("src","game","GameScene.ts");
const MARK = "V1010530E_VULCAN_IMPACT_SYNC";
if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run from C:\\Users\\bak12\\color-hunt. No file written.`);
let s=fs.readFileSync(file,"utf8").replace(/\r\n/g,"\n");
const original=s;
if(s.includes(MARK)){console.log("[skip] v530e already applied.");process.exit(0);}

// 530d explicitly wrote nothing on failure, so target should still be restored source.
// Replace callback using semantic boundaries.
const cbStart=s.indexOf("            multiplayerClient.onVulcanFired(");
if(cbStart<0) throw new Error("onVulcanFired start not found. No file written.");
const cbEnd=s.indexOf("\n        );",cbStart);
if(cbEnd<0) throw new Error("onVulcanFired end not found. No file written.");
const oldCb=s.slice(cbStart,cbEnd);
if(!oldCb.includes("NetworkVulcanFired") || !oldCb.includes("shot.x") || !oldCb.includes("shot.y"))
  throw new Error("Unexpected onVulcanFired callback. No file written.");
const newCb=`            multiplayerClient.onVulcanFired((shot: NetworkVulcanFired) => {
                /* ${MARK}: render the server-authoritative impact coordinate. */
                this.spawnVulcanAuthoritativeImpact(
                    shot.x,
                    shot.y,
                );
            }),`;
s=s.slice(0,cbStart)+newCb+s.slice(cbEnd);

// Do NOT edit the fragile existing impact method. Add a tiny exact-coordinate wrapper
// immediately before it, then reuse the existing renderer after temporarily neutralizing
// its random offset by pre-compensating with a dedicated exact draw path copied from its
// own body is unsafe. Instead clone the current method structurally and remove only
// Phaser.Math.Between calls inside the clone.
const mStart=s.indexOf("    private spawnVulcanPresentationImpact(");
if(mStart<0) throw new Error("spawnVulcanPresentationImpact not found. No file written.");
const mEnd=s.indexOf("\n    private ",mStart+20);
if(mEnd<0) throw new Error("Could not isolate impact method. No file written.");
const method=s.slice(mStart,mEnd);

const brace=method.indexOf("{");
if(brace<0) throw new Error("Impact method body not found. No file written.");
let exact=method;

// Rename clone and force withSound false at entry.
exact=exact.replace("private spawnVulcanPresentationImpact(", "private spawnVulcanAuthoritativeImpact(");
exact=exact.replace(
  /(\n\s*y:\s*number,\s*\n)\s*withSound:\s*boolean,\s*\n/,
  "$1"
);
if(exact.includes("withSound: boolean")) throw new Error("Could not simplify cloned exact method signature. No file written.");

// Remove any sound conditional in clone by defining a local false constant.
const bodyBrace=exact.indexOf("{");
exact=exact.slice(0,bodyBrace+1)+"\n        const withSound = false;"+exact.slice(bodyBrace+1);

// Replace random offsets semantically inside CLONE only.
// Handles multiline +/-26 and +/-18 formatting.
let count=0;
exact=exact.replace(/x\s*\+\s*Phaser\.Math\.Between\(\s*-26\s*,\s*26\s*,?\s*\)/g,()=>{count++;return "x";});
exact=exact.replace(/y\s*\+\s*Phaser\.Math\.Between\(\s*-18\s*,\s*18\s*,?\s*\)/g,()=>{count++;return "y";});
if(count!==2) throw new Error(`Expected 2 random coordinate offsets in cloned method, found ${count}. No file written.`);

// Insert clone before original. Existing local renderer remains untouched.
s=s.slice(0,mStart)+`    /* ${MARK}: exact network impact renderer; local legacy renderer remains untouched. */\n`+exact+"\n"+s.slice(mStart);

// Remove one local fake visual impact call; keep responsive sound/recoil.
const fakeRe=/this\.spawnVulcanPresentationImpact\(\s*this\.vulcanDisplayX\s*,\s*this\.vulcanDisplayY\s*,\s*true\s*,?\s*\);/g;
const matches=s.match(fakeRe)||[];
if(matches.length!==1) throw new Error(`Expected 1 local fake impact call, found ${matches.length}. No file written.`);
s=s.replace(fakeRe,`/* ${MARK}: visible impact comes from server packet. */\n            this.playVulcanGunPulse();`);

s=`/* ${MARK}: exact server impact VFX without mutating spotlight aim. */\n`+s;

// Validate syntax-sensitive structural facts before write.
if(!s.includes("private spawnVulcanAuthoritativeImpact(")) throw new Error("Postcondition failed: exact method. No file written.");
if(/spawnVulcanAuthoritativeImpact[\s\S]{0,500}?Phaser\.Math\.Between\(\s*-26/.test(s)) throw new Error("Postcondition failed: x random remains in exact renderer. No file written.");
if(/spawnVulcanAuthoritativeImpact[\s\S]{0,900}?Phaser\.Math\.Between\(\s*-18/.test(s)) throw new Error("Postcondition failed: y random remains in exact renderer. No file written.");
if(s.includes("this.vulcanTargetX = shot.x") || s.includes("this.vulcanTargetY = shot.y")) throw new Error("Postcondition failed: shot mutates aim. No file written.");

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v530e.ts"),original,"utf8");
fs.writeFileSync(file,s,"utf8");
console.log("Applied v0.10.10.530e.");
console.log(" - did NOT modify fragile existing impact px/py block");
console.log(" - added exact server-impact renderer cloned from current source");
console.log(" - removed only its +/-26,+/-18 coordinate randomness");
console.log(" - server shot packet no longer moves spotlight aim");
console.log(" - local fake impact removed; sound/recoil retained");
console.log("Next: npm run build");
