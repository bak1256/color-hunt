const fs=require("fs"),path=require("path");
const GAME=path.join("src","game","GameScene.ts");
const NET=path.join("src","multiplayer","NetworkPlayerManager.ts");
const MARK="V1010541_PAINT_CURSOR_PIXEL_CENTER_ALIGNMENT";

for(const f of [GAME,NET]){
  if(!fs.existsSync(f)) throw new Error(`Missing ${f}. Run from C:\\Users\\bak12\\color-hunt. No files written.`);
}

let g=fs.readFileSync(GAME,"utf8").replace(/\r\n/g,"\n");
let n=fs.readFileSync(NET,"utf8").replace(/\r\n/g,"\n");
const g0=g,n0=n;

if(g.includes(MARK)||n.includes(MARK)){
  console.log("[skip] v541 already applied");
  process.exit(0);
}

/*
 * Root cause:
 *
 * paint pixels are 1x1 cells [x,x+1) × [y,y+1), stamped with origin 0.
 * But paintLocalPlayer used Math.round(local + textureOrigin).
 *
 * That makes the selected paint CELL jump to the next integer as soon as the
 * pointer crosses the half-pixel boundary. Since the visible pixel occupies
 * x..x+1 / y..y+1, it appears consistently down-right from the cursor when
 * zoomed in.
 *
 * Correct contract:
 *   pointer world coordinate -> containing texture cell via Math.floor()
 *   preview location         -> CENTER of that cell (+0.5)
 *
 * Do NOT change originX/originY=0. Those are intentional to avoid white seams.
 */

/* ------------------------------------------------------------
 * NetworkPlayerManager: local pointer -> containing pixel cell.
 * Isolate paintLocalPlayer() only; do not modify rebuild/remote/history paths.
 * ------------------------------------------------------------ */
{
  const sig="  paintLocalPlayer(";
  const a=n.indexOf(sig);
  if(a<0) throw new Error("paintLocalPlayer() not found. No files written.");
  const b=n.indexOf("\n  stampLocalPaintPoint(",a);
  if(b<0) throw new Error("Could not isolate paintLocalPlayer(). No files written.");
  let m=n.slice(a,b);

  const xRe=/const textureX\s*=\s*Math\.round\(\s*localX\s*\+\s*40\s*,?\s*\);/m;
  const yRe=/const textureY\s*=\s*Math\.round\(\s*localY\s*\+\s*60\s*,?\s*\);/m;

  if(!xRe.test(m)||!yRe.test(m)){
    throw new Error("Current paintLocalPlayer texture rounding shape differs. No files written.");
  }

  m=m.replace(xRe,`/*
     * ${MARK}
     * Select the pixel CELL actually under the cursor.
     * Pixel raster uses top-left-origin integer cells, so floor is correct.
     */
    const textureX =
      Math.floor(
        localX + 40,
      );`);

  m=m.replace(yRe,`    const textureY =
      Math.floor(
        localY + 60,
      );`);

  n=n.slice(0,a)+m+n.slice(b);
}

/* ------------------------------------------------------------
 * GameScene preview: use the SAME floor convention and render preview on the
 * center of the selected cell. This makes cursor/preview/actual raster agree.
 * ------------------------------------------------------------ */
{
  const sig="    private getPaintPreviewWorldPoint(";
  const a=g.indexOf(sig);
  if(a<0) throw new Error("getPaintPreviewWorldPoint() not found. No files written.");
  const b=g.indexOf("\n    private ",a+sig.length);
  if(b<0) throw new Error("Could not isolate getPaintPreviewWorldPoint(). No files written.");
  let m=g.slice(a,b);

  const xRe=/const textureX\s*=\s*Math\.round\(\s*localX\s*\+\s*40\s*,?\s*\);/m;
  const yRe=/const textureY\s*=\s*Math\.round\(\s*localY\s*\+\s*60\s*,?\s*\);/m;

  if(!xRe.test(m)||!yRe.test(m)){
    throw new Error("Current paint preview texture rounding shape differs. No files written.");
  }

  m=m.replace(xRe,`/*
         * ${MARK}
         * Preview and raster now share the same containing-cell convention.
         */
        const textureX =
            Math.floor(
                localX + 40,
            );`);

  m=m.replace(yRe,`        const textureY =
            Math.floor(
                localY + 60,
            );`);

  /* Current back-conversion points at cell top-left. Move it to cell center. */
  const backX=/textureX\s*-\s*40/g;
  const backY=/textureY\s*-\s*60/g;

  const bx=(m.match(backX)||[]).length;
  const by=(m.match(backY)||[]).length;
  if(bx!==1||by!==1){
    throw new Error(`Expected one preview back-conversion each, got X=${bx}, Y=${by}. No files written.`);
  }

  m=m.replace(backX,"textureX - 40 + 0.5");
  m=m.replace(backY,"textureY - 60 + 0.5");

  g=g.slice(0,a)+m+g.slice(b);
}

g=`/* ${MARK}: desktop/finger paint preview targets the exact center of the texture pixel cell under the pointer. */\n`+g;
n=`/* ${MARK}: local paint uses containing pixel cell (floor), preserving top-left-origin seam-free raster stamps. */\n`+n;

/* Safety: seam fix and brush geometry must remain untouched. */
const checks=[
  ["NET floor X",/paintLocalPlayer[\s\S]{0,5000}?Math\.floor\(\s*localX\s*\+\s*40/.test(n)],
  ["NET floor Y",/paintLocalPlayer[\s\S]{0,5000}?Math\.floor\(\s*localY\s*\+\s*60/.test(n)],
  ["originX 0 retained",/originX:\s*0/.test(n)],
  ["originY 0 retained",/originY:\s*0/.test(n)],
  ["preview floor X",/getPaintPreviewWorldPoint[\s\S]{0,3000}?Math\.floor\(\s*localX\s*\+\s*40/.test(g)],
  ["preview floor Y",/getPaintPreviewWorldPoint[\s\S]{0,3000}?Math\.floor\(\s*localY\s*\+\s*60/.test(g)],
  ["preview center X",/textureX\s*-\s*40\s*\+\s*0\.5/.test(g)],
  ["preview center Y",/textureY\s*-\s*60\s*\+\s*0\.5/.test(g)],
];
for(const [label,ok] of checks){
  if(!ok) throw new Error(`Postcondition failed: ${label}. No files written.`);
}

fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(path.join(".patch-backups","GameScene-before-v541.ts"),g0,"utf8");
fs.writeFileSync(path.join(".patch-backups","NetworkPlayerManager-before-v541.ts"),n0,"utf8");
fs.writeFileSync(GAME,g,"utf8");
fs.writeFileSync(NET,n,"utf8");

console.log("Applied v0.10.10.541.");
console.log(" - paint cell selection: Math.round -> Math.floor");
console.log(" - preview now sits at exact selected pixel-cell center (+0.5,+0.5)");
console.log(" - fixes down-right one-pixel feel at high paint zoom");
console.log(" - square/circle brush size logic unchanged");
console.log(" - originX/originY=0 seam-prevention logic unchanged");
console.log(" - multiplayer paint/history coordinates stay integer texture pixels");
console.log(" - mobile precision-brush offset itself is unchanged");
console.log("Next: npm run build");
