const fs = require("fs");
const path = require("path");

const clientFile = path.join("src","game","GameScene.ts");
const serverFile = path.join("..","color-hunt-server","src","rooms","MyRoom.ts");
const CMARK="V1010532B_VULCAN_FULL_MAP_ORBIT_EXACT_SOURCE";
const SMARK="V1010532B_VULCAN_RADIUS15_EXACT_SOURCE";

if(!fs.existsSync(clientFile)) throw new Error(`Missing ${clientFile}. Run from C:\\Users\\bak12\\color-hunt. No file written.`);
if(!fs.existsSync(serverFile)) throw new Error(`Missing ${serverFile}. Expected sibling color-hunt-server. No file written.`);

let c=fs.readFileSync(clientFile,"utf8").replace(/\r\n/g,"\n");
let s=fs.readFileSync(serverFile,"utf8").replace(/\r\n/g,"\n");
const c0=c,s0=s;
if(c.includes(CMARK)||s.includes(SMARK)){console.log("[skip] v532b already applied.");process.exit(0);}

function range(src, sig){
  const a=src.indexOf(sig);
  if(a<0) throw new Error(`Missing ${sig}. No file written.`);
  const b=src.indexOf("\n    private ",a+sig.length);
  if(b<0) throw new Error(`Cannot isolate ${sig}. No file written.`);
  return {a,b,text:src.slice(a,b)};
}
function patchMethod(src,sig,fn){
  const r=range(src,sig), n=fn(r.text);
  if(n===r.text) throw new Error(`No change in ${sig}. No file written.`);
  return src.slice(0,r.a)+n+src.slice(r.b);
}

// Full map + preserve current circular orbit.
// 0.94 leaves enough margin for the existing center orbit ±24 X / ±16 Y.
c=patchMethod(c,"    private enterVulcanCinematic(",m=>{
  const n=(m.match(/\b1\.34\b/g)||[]).length;
  if(n!==2) throw new Error(`enterVulcanCinematic current 1.34 count=${n}, expected 2. No file written.`);
  return m.replace(/\b1\.34\b/g,"0.94");
});
c=patchMethod(c,"    private updateVulcanAirSupport(): void {",m=>{
  const n=(m.match(/\b1\.34\b/g)||[]).length;
  if(n!==1) throw new Error(`updateVulcanAirSupport current 1.34 count=${n}, expected 1. No file written.`);
  if(!/Math\.cos\([\s\S]{0,80}?orbit[\s\S]{0,80}?\*\s*24/.test(m) ||
     !/Math\.sin\([\s\S]{0,80}?orbit[\s\S]{0,80}?\*\s*16/.test(m))
    throw new Error("Existing Vulcan circular orbit not found. No file written.");
  return m.replace(/\b1\.34\b/,"0.94");
});
c=patchMethod(c,"    private enterVulcanSpectatorView(",m=>{
  const n=(m.match(/\b1\.34\b/g)||[]).length;
  if(n!==1) throw new Error(`enterVulcanSpectatorView current 1.34 count=${n}, expected 1. No file written.`);
  return m.replace(/\b1\.34\b/,"0.94");
});

// Exact uploaded server source has LOCAL constants inside V1010530 block:
// spreadRadius = 58; hitRadius = 22;
// Requested mouse-centered random circle = radius 15 (diameter 30).
// Keep hitRadius unchanged here: it is per-bullet collision tolerance, not scatter radius.
// This avoids making bullets unrealistically pixel-perfect and does not change the requested scatter circle.
const blockStart=s.indexOf("           * V1010530_VULCAN_CIRCULAR_RANDOM_IMPACT");
if(blockStart<0) throw new Error("V1010530 authoritative impact block not found. No file written.");
const blockEnd=s.indexOf("          const angle =",blockStart);
if(blockEnd<0) throw new Error("Authoritative impact constants boundary not found. No file written.");
let block=s.slice(blockStart,blockEnd);
const spreadMatches=block.match(/const spreadRadius\s*=\s*58\s*;/g)||[];
if(spreadMatches.length!==1) throw new Error(`Expected local spreadRadius=58 exactly once, found ${spreadMatches.length}. No file written.`);
block=block.replace(/const spreadRadius\s*=\s*58\s*;/,"const spreadRadius =\n            15;");
s=s.slice(0,blockStart)+block+s.slice(blockEnd);

c=`/* ${CMARK}: full-map Vulcan aerial view at 0.94; existing circular orbit preserved. */\n`+c;
s=`/* ${SMARK}: authoritative random Vulcan impact center is radius 15px / diameter 30px around live mouse aim. */\n`+s;

// Postconditions
const u=range(c,"    private updateVulcanAirSupport(): void {").text;
if(!/\.setZoom\(\s*0\.94\s*,?\s*\)/.test(u)) throw new Error("Postcondition: owner runtime zoom not 0.94. No file written.");
if(!/Math\.cos\([\s\S]{0,80}?orbit[\s\S]{0,80}?\*\s*24/.test(u)) throw new Error("Postcondition: X orbit lost. No file written.");
if(!/Math\.sin\([\s\S]{0,80}?orbit[\s\S]{0,80}?\*\s*16/.test(u)) throw new Error("Postcondition: Y orbit lost. No file written.");
if(!/const spreadRadius\s*=\s*15\s*;/.test(s)) throw new Error("Postcondition: server radius 15 missing. No file written.");
if(!/const hitRadius\s*=\s*22\s*;/.test(s)) throw new Error("Postcondition: existing per-impact hit radius unexpectedly changed. No file written.");
if(!/setTimeout\(\s*tick\s*,\s*60\s*,?\s*\)/.test(s)) throw new Error("Postcondition: authoritative 60ms cadence not found. No file written.");

fs.mkdirSync(".patch-backups",{recursive:true});
fs.mkdirSync(path.join("..","color-hunt-server",".patch-backups"),{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v532b.ts"),c0,"utf8");
fs.writeFileSync(path.join("..","color-hunt-server",".patch-backups","MyRoom-before-v532b.ts"),s0,"utf8");
fs.writeFileSync(clientFile,c,"utf8");
fs.writeFileSync(serverFile,s,"utf8");

console.log("Applied v0.10.10.532b from the exact uploaded sources.");
console.log(" - Vulcan owner cinematic final zoom: 1.34 -> 0.94");
console.log(" - Vulcan owner runtime/orbit zoom: 1.34 -> 0.94");
console.log(" - Vulcan spectator aerial zoom: 1.34 -> 0.94");
console.log(" - existing circular camera orbit ±24/±16 retained");
console.log(" - server random impact spread: radius 58px -> 15px (diameter 30px)");
console.log(" - existing per-impact hitRadius 22px retained");
console.log(" - authoritative 60ms cadence retained");
console.log("Next: build client AND server.");
