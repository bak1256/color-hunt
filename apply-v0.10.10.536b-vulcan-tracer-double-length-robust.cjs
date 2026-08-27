const fs=require("fs"),path=require("path");
const FILE=path.join("src","game","GameScene.ts");
const MARK="V1010536B_VULCAN_TRACER_DOUBLE_LENGTH_ROBUST";
if(!fs.existsSync(FILE)) throw new Error(`Missing ${FILE}. Run from project root. No file written.`);
let s=fs.readFileSync(FILE,"utf8").replace(/\r\n/g,"\n"), original=s;
if(s.includes(MARK)){console.log("[skip] v536b already applied.");process.exit(0);}

const methodStart=s.indexOf("    private spawnVulcanPresentationImpact(");
if(methodStart<0) throw new Error("spawnVulcanPresentationImpact() not found. No file written.");
const methodEnd=s.indexOf("\n    private ",methodStart+20);
if(methodEnd<0) throw new Error("Could not isolate spawnVulcanPresentationImpact(). No file written.");
let m=s.slice(methodStart,methodEnd);

/* Find the tracer rectangle by its distinctive Vulcan tracer color, then
   modify ONLY the Phaser.Math.Between() width immediately before that color. */
const colorAt=m.indexOf("0xffcf54");
if(colorAt<0) throw new Error("Vulcan tracer color 0xffcf54 not found in presentation helper. No file written.");

const prefix=m.slice(0,colorAt);
const betweenRe=/Phaser\.Math\.Between\(\s*18\s*,\s*34\s*,?\s*\)/g;
const hits=[...prefix.matchAll(betweenRe)];
if(hits.length!==1) throw new Error(`Expected one tracer width 18..34 before tracer color, found ${hits.length}. No file written.`);

const hit=hits[0];
const replacement=`Phaser.Math.Between(
                    36,
                    68,
                )`;
const absStart=methodStart+(hit.index??0);
s=s.slice(0,absStart)+replacement+s.slice(absStart+hit[0].length);

/*
 * IMPORTANT:
 * v536 failed only because its optional owner-path assertion was too strict
 * about the current updateVulcanAirSupport() formatting/version.
 * Do NOT require or rewrite that path here. The shared tracer renderer itself
 * is the requested visual source and changing it affects every caller that
 * uses it without risking duplicate owner rendering.
 */
s=`/* ${MARK}: Vulcan shared tracer visual length 18..34px -> 36..68px. No firing-path rewrite. */\n`+s;

const checkStart=s.indexOf("    private spawnVulcanPresentationImpact(");
const checkEnd=s.indexOf("\n    private ",checkStart+20);
const check=s.slice(checkStart,checkEnd);
if(!/Phaser\.Math\.Between\(\s*36\s*,\s*68\s*,?\s*\)/.test(check))
  throw new Error("Postcondition failed: 36..68 tracer width missing. No file written.");
if(/Phaser\.Math\.Between\(\s*18\s*,\s*34\s*,?\s*\)/.test(check))
  throw new Error("Postcondition failed: old 18..34 tracer width remains. No file written.");
if(!check.includes("0xffcf54"))
  throw new Error("Postcondition failed: tracer color unexpectedly missing. No file written.");

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v536b.ts"),original,"utf8");
fs.writeFileSync(FILE,s,"utf8");
console.log("Applied v0.10.10.536b.");
console.log(" - Vulcan shared tracer length: 18..34px -> 36..68px");
console.log(" - no brittle updateVulcanAirSupport owner-path assertion");
console.log(" - no duplicate tracer renderer added");
console.log(" - firing cadence / impact / 15px server hit spread untouched");
console.log("Next: npm run build");
