const fs = require("fs");
const path = require("path");

const clientFile = path.join("src","game","GameScene.ts");
const serverFile = path.join("..","color-hunt-server","src","rooms","MyRoom.ts");

if (!fs.existsSync(clientFile) || !fs.existsSync(serverFile)) {
  throw new Error("Run from C:\\Users\\bak12\\color-hunt. No file written.");
}

const c0=fs.readFileSync(clientFile,"utf8");
const s0=fs.readFileSync(serverFile,"utf8");
let c=c0, s=s0;

// Client presentation: 2x (29ms) -> 1.5x (~39ms).
const cr=/vulcanLastMuzzleFxAt\s*>=\s*29/g;
const cc=(c.match(cr)||[]).length;
if(cc!==1) throw new Error(`Expected one client 29ms Vulcan cadence, found ${cc}. No file written.`);
c=c.replace(cr,"vulcanLastMuzzleFxAt >= 39");

// Server authoritative cadence: isolate handler and change its two recursive timers.
const a=s.indexOf("    vulcan_fire_start: (");
const b=s.indexOf("\n    vulcan_fire_stop: (",a);
if(a<0||b<0) throw new Error("vulcan_fire_start block not found. No file written.");
let block=s.slice(a,b);
const tr=/this\.clock\.setTimeout\(\s*tick\s*,\s*45\s*,?\s*\);/g;
const tc=(block.match(tr)||[]).length;
if(tc!==2) throw new Error(`Expected two authoritative 45ms Vulcan timers, found ${tc}. No file written.`);
block=block.replace(tr,`this.clock.setTimeout(
            tick,
            60,
          );`);
s=s.slice(0,a)+block+s.slice(b);

// Read-only audit. Do NOT reject formatting differences in the hit-test.
const rx=s.match(/vulcanHitRadiusX\s*=\s*([\d.]+)/);
const ry=s.match(/vulcanHitRadiusY\s*=\s*([\d.]+)/);
const hitX=rx ? rx[1] : "UNKNOWN";
const hitY=ry ? ry[1] : "UNKNOWN";
const hasNx=/target\.x\s*-\s*aim\.x/.test(block);
const hasNy=/target\.y\s*-\s*aim\.y/.test(block);
const hasD2=/\bd2\b/.test(block);

c=`/* V1010526B_VULCAN_1P5X: presentation 29ms->39ms. */\n`+c;
s=`/* V1010526B_VULCAN_1P5X: authoritative tick 45ms->60ms; hitbox untouched. */\n`+s;

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v526b.ts"),c0,"utf8");
fs.mkdirSync(path.join("..","color-hunt-server",".patch-backups"),{recursive:true});
fs.writeFileSync(path.join("..","color-hunt-server",".patch-backups","MyRoom-before-v526b.ts"),s0,"utf8");
fs.writeFileSync(clientFile,c,"utf8");
fs.writeFileSync(serverFile,s,"utf8");

console.log("Applied v0.10.10.526b.");
console.log(" - visual cadence: 29ms -> 39ms (~1.5x original)");
console.log(" - authoritative cadence: 45ms -> 60ms (1.5x original)");
console.log(` - detected hit radii: X=${hitX}, Y=${hitY}`);
console.log(` - aim-relative hit-test signals: x=${hasNx}, y=${hasNy}, d2=${hasD2}`);
console.log(" - hitbox values/logic were NOT modified.");
console.log("Next: npm run build && cd ..\\color-hunt-server && npm run build");
