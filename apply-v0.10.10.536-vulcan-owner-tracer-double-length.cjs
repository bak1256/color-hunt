const fs=require("fs"),path=require("path");
const FILE=path.join("src","game","GameScene.ts");
const MARK="V1010536_VULCAN_OWNER_TRACER_DOUBLE_LENGTH";
if(!fs.existsSync(FILE)) throw new Error(`Missing ${FILE}. Run from C:\\Users\\bak12\\color-hunt. No file written.`);
let s=fs.readFileSync(FILE,"utf8").replace(/\r\n/g,"\n"), original=s;
if(s.includes(MARK)){console.log("[skip] v536 already applied.");process.exit(0);}

function methodRange(name){
  const a=s.indexOf(`    private ${name}(`);
  if(a<0) throw new Error(`${name}() not found. No file written.`);
  const b=s.indexOf("\n    private ",a+20);
  if(b<0) throw new Error(`Cannot isolate ${name}(). No file written.`);
  return {a,b,text:s.slice(a,b)};
}
function replaceMethod(name,fn){
  const r=methodRange(name), n=fn(r.text);
  if(n===r.text) throw new Error(`No change in ${name}(). No file written.`);
  s=s.slice(0,r.a)+n+s.slice(r.b);
}

/*
 * Current shared Vulcan presentation helper creates the visible straight tracer:
 * width = Between(18,34), height = 2.
 * It is used by the active Vulcan runtime path for owner/spectator firing.
 *
 * Double only the tracer LENGTH: 18..34 -> 36..68.
 * Do not change impact circle/ring, cadence, authoritative shot coordinates,
 * 15px server spread, or hit detection.
 */
replaceMethod("spawnVulcanPresentationImpact",m=>{
  const re=/Phaser\.Math\.Between\(\s*18\s*,\s*34\s*,?\s*\)/;
  const hits=m.match(new RegExp(re.source,"g"))||[];
  if(hits.length!==1) throw new Error(`Expected exactly one Vulcan tracer length 18..34, found ${hits.length}. No file written.`);
  return m.replace(re,`Phaser.Math.Between(
                    36,
                    68,
                )`);
});

/*
 * Guard against the owner presentation disappearing:
 * updateVulcanAirSupport must still call the SAME helper while visualFiring.
 * We don't add a second local effect because that would double-draw for owners
 * on versions where the shared runtime path is already active.
 */
const u=methodRange("updateVulcanAirSupport").text;
if(!/visualFiring[\s\S]{0,700}?spawnVulcanPresentationImpact\(\s*this\.vulcanDisplayX\s*,\s*this\.vulcanDisplayY\s*,\s*true/.test(u)){
  throw new Error("Owner/spectator shared Vulcan presentation call not found in updateVulcanAirSupport(). No file written.");
}

s=`/* ${MARK}: shared Vulcan tracer length doubled to 36..68px; owner active runtime path explicitly verified. */\n`+s;

const h=methodRange("spawnVulcanPresentationImpact").text;
if(!/Phaser\.Math\.Between\(\s*36\s*,\s*68/.test(h))
  throw new Error("Postcondition failed: doubled tracer length missing. No file written.");
if(/Phaser\.Math\.Between\(\s*18\s*,\s*34/.test(h))
  throw new Error("Postcondition failed: old tracer length remains in shared helper. No file written.");
if(!/,\s*2\s*,\s*0xffcf54/.test(h))
  throw new Error("Postcondition failed: tracer thickness/color shape unexpectedly differs. No file written.");

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v536.ts"),original,"utf8");
fs.writeFileSync(FILE,s,"utf8");

console.log("Applied v0.10.10.536.");
console.log(" - verified active Hunter Vulcan runtime uses the shared tracer helper");
console.log(" - shared straight tracer length: 18..34px -> 36..68px");
console.log(" - therefore Hunter owner + spectator/shared presentation use the longer tracer");
console.log(" - tracer thickness, impact ring/flash, cadence and firing logic unchanged");
console.log(" - server 15px spread / hit logic untouched");
console.log("Next: npm run build");
