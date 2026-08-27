const fs=require("fs"),path=require("path");
const FILE=path.join("src","game","GameScene.ts");
const MARK="V1010535_VULCAN_MOUSE_FOLLOW_HELICAM";
if(!fs.existsSync(FILE)) throw new Error(`Missing ${FILE}. Run from C:\\Users\\bak12\\color-hunt. No file written.`);
let s=fs.readFileSync(FILE,"utf8").replace(/\r\n/g,"\n"), original=s;
if(s.includes(MARK)){console.log("[skip] v535 already applied.");process.exit(0);}

function range(sig){
  const a=s.indexOf(sig);
  if(a<0) throw new Error(`Missing ${sig}. No file written.`);
  const b=s.indexOf("\n    private ",a+sig.length);
  if(b<0) throw new Error(`Cannot isolate ${sig}. No file written.`);
  return {a,b,text:s.slice(a,b)};
}
function replaceMethod(sig,fn){
  const r=range(sig), n=fn(r.text);
  if(n===r.text) throw new Error(`No change in ${sig}. No file written.`);
  s=s.slice(0,r.a)+n+s.slice(r.b);
}

/*
 * v532b state:
 * - Vulcan runtime zoom = 0.94
 * - camera center = map center + small circular orbit
 * - spotlight target/display already follows mouse/remote aim
 *
 * v535:
 * - zoom in modestly to 1.12
 * - camera follows the smoothed spotlight position, not raw pointer
 * - keep the helicopter orbit as secondary motion
 * - clamp camera center so viewport never exposes outside the 960x540 map
 *
 * At zoom 1.12 with a 960x540 viewport:
 * half visible world size = 480/1.12, 270/1.12
 * => center clamp approx X 428.6..531.4, Y 241.1..298.9
 *
 * This intentionally means the camera follows mouse direction with a limited
 * cinematic pan. The spotlight itself can still travel all the way to map edges.
 */
replaceMethod("    private updateVulcanAirSupport(): void {",m=>{
  const zoomCount=(m.match(/\.setZoom\(\s*0\.94\s*,?\s*\)/g)||[]).length;
  if(zoomCount!==1) throw new Error(`Expected one current runtime zoom 0.94, found ${zoomCount}. No file written.`);

  const centerRe=/\.centerOn\(\s*480\s*\+\s*Math\.cos\(\s*orbit\s*,?\s*\)\s*\*\s*24\s*,\s*270\s*\+\s*Math\.sin\(\s*orbit\s*,?\s*\)\s*\*\s*16\s*,?\s*\)/m;
  if(!centerRe.test(m)) throw new Error("Current map-center ±24/±16 orbit centerOn block not found. No file written.");

  const insertAnchor=`        const orbit =
            elapsed *
            0.00048;`;
  if(!m.includes(insertAnchor)) throw new Error("Current Vulcan orbit calculation anchor not found. No file written.");

  const tracking=`        const orbit =
            elapsed *
            0.00048;

        /*
         * ${MARK}
         * Helicopter camera follows the already-smoothed spotlight position.
         * Only part of the aim displacement is inherited so aiming remains
         * controllable while the aerial camera visibly searches with the lamp.
         */
        const vulcanCameraZoom =
            1.12;

        const halfVisibleWorldW =
            480 /
            vulcanCameraZoom;

        const halfVisibleWorldH =
            270 /
            vulcanCameraZoom;

        const cameraFollowStrength =
            0.32;

        const desiredCameraX =
            480 +
            (
                this.vulcanDisplayX -
                480
            ) *
                cameraFollowStrength +
            Math.cos(
                orbit,
            ) *
                24;

        const desiredCameraY =
            270 +
            (
                this.vulcanDisplayY -
                270
            ) *
                cameraFollowStrength +
            Math.sin(
                orbit,
            ) *
                16;

        const cameraCenterX =
            Phaser.Math.Clamp(
                desiredCameraX,
                halfVisibleWorldW,
                960 -
                    halfVisibleWorldW,
            );

        const cameraCenterY =
            Phaser.Math.Clamp(
                desiredCameraY,
                halfVisibleWorldH,
                540 -
                    halfVisibleWorldH,
            );`;

  m=m.replace(insertAnchor,tracking);
  m=m.replace(/\.setZoom\(\s*0\.94\s*,?\s*\)/,`.setZoom(
                vulcanCameraZoom,
            )`);
  m=m.replace(centerRe,`.centerOn(
                cameraCenterX,
                cameraCenterY,
            )`);
  return m;
});

/* Cinematic ends at the same new tactical zoom instead of snapping 0.94 -> 1.12. */
replaceMethod("    private enterVulcanCinematic(",m=>{
  const n=(m.match(/\b0\.94\b/g)||[]).length;
  if(n<1) throw new Error(`enterVulcanCinematic has no current 0.94 final zoom. No file written.`);
  return m.replace(/\b0\.94\b/g,"1.12");
});

/* Remote-Hunter spectator gets the same zoom; runtime update then follows remote aim. */
replaceMethod("    private enterVulcanSpectatorView(",m=>{
  const n=(m.match(/\b0\.94\b/g)||[]).length;
  if(n!==1) throw new Error(`enterVulcanSpectatorView expected one 0.94 zoom, found ${n}. No file written.`);
  return m.replace(/\b0\.94\b/,"1.12");
});

s=`/* ${MARK}: Vulcan aerial camera zooms to 1.12 and smoothly pans with spotlight/mouse aim while retaining helicopter orbit and map-edge clamps. */\n`+s;

const u=range("    private updateVulcanAirSupport(): void {").text;
const checks=[
 ["zoom",/vulcanCameraZoom\s*=\s*1\.12/.test(u)],
 ["smoothed spotlight X follow",/this\.vulcanDisplayX\s*-\s*480/.test(u)],
 ["smoothed spotlight Y follow",/this\.vulcanDisplayY\s*-\s*270/.test(u)],
 ["follow strength",/cameraFollowStrength\s*=\s*0\.32/.test(u)],
 ["X orbit retained",/Math\.cos\(\s*orbit[\s\S]{0,40}?\*\s*24/.test(u)],
 ["Y orbit retained",/Math\.sin\(\s*orbit[\s\S]{0,40}?\*\s*16/.test(u)],
 ["X clamp",/Phaser\.Math\.Clamp\(\s*desiredCameraX/.test(u)],
 ["Y clamp",/Phaser\.Math\.Clamp\(\s*desiredCameraY/.test(u)],
 ["new center",/\.centerOn\(\s*cameraCenterX\s*,\s*cameraCenterY/.test(u)],
];
for(const [label,ok] of checks) if(!ok) throw new Error(`Postcondition failed: ${label}. No file written.`);

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v535.ts"),original,"utf8");
fs.writeFileSync(FILE,s,"utf8");

console.log("Applied v0.10.10.535.");
console.log(" - Vulcan aerial zoom: 0.94 -> 1.12");
console.log(" - camera follows the smoothed spotlight/mouse aim at 32% strength");
console.log(" - existing helicopter circular orbit ±24/±16 retained");
console.log(" - camera center is clamped so no outside-map area is exposed");
console.log(" - spotlight itself still reaches the full map");
console.log(" - Hider spectator view follows the remote Hunter aim with the same camera behavior");
console.log(" - Vulcan 15px firing spread/server balance untouched");
console.log("Next: npm run build");
