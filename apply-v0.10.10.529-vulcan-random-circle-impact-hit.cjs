const fs = require("fs");
const path = require("path");

const serverFile = path.join("..","color-hunt-server","src","rooms","MyRoom.ts");
const MARK = "V1010529_VULCAN_RANDOM_CIRCLE_IMPACT_HIT";

if (!fs.existsSync(serverFile)) {
  throw new Error("Run from C:\\Users\\bak12\\color-hunt. Missing server MyRoom.ts. No file written.");
}

let s = fs.readFileSync(serverFile,"utf8").replace(/\r\n/g,"\n");
const original = s;

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.529 already applied.");
  process.exit(0);
}

// Isolate authoritative Vulcan hold-fire handler.
const start = s.indexOf("    vulcan_fire_start: (");
const end = s.indexOf("\n    vulcan_fire_stop: (", start);
if (start < 0 || end < 0) {
  throw new Error("vulcan_fire_start block not found. No file written.");
}
let block = s.slice(start,end);

// Require the already-tested 1.5x cadence.
const timers60 = (block.match(/this\.clock\.setTimeout\(\s*tick\s*,\s*60\s*,?\s*\);/g)||[]).length;
if (timers60 !== 2) {
  throw new Error(`Expected v526b 1.5x cadence (two 60ms timers), found ${timers60}. No file written.`);
}

// Add explicit circular spread / impact radius constants next to old ellipse constants.
// Keep old constants for rollback/reference, but they are no longer used for Vulcan kills.
const fieldAnchor = /(\s*private readonly vulcanHitRadiusX\s*=\s*105\s*;\s*\n\s*private readonly vulcanHitRadiusY\s*=\s*66\s*;)/;
if (!fieldAnchor.test(s)) {
  throw new Error("Expected current Vulcan 105x66 radius fields not found. No file written.");
}
s = s.replace(fieldAnchor, `$1
  /*
   * ${MARK}
   * Searchlight geometry remains visual-only.
   * Each authoritative 60ms Vulcan tick lands at one random point inside
   * this aim-centered circle, and only this small impact circle can kill.
   */
  private readonly vulcanImpactSpreadRadius = 58;
  private readonly vulcanImpactHitRadius = 22;`, 1);

// Replace the old "entire aim-centered ellipse can hit" target loop.
// Formatting-tolerant boundaries: from for(players) through its closing brace,
// immediately before getAliveHiderCount.
const loopStart = block.indexOf("        for (const [sessionId, target] of this.state.players)");
const aliveCheck = block.indexOf("        if (this.getAliveHiderCount() === 0)", loopStart);
if (loopStart < 0 || aliveCheck < 0) {
  throw new Error("Authoritative Vulcan target loop boundaries not found. No file written.");
}
const oldLoop = block.slice(loopStart, aliveCheck);

if (
  !/target\.x\s*-\s*aim\.x/.test(oldLoop) ||
  !/target\.y\s*-\s*aim\.y/.test(oldLoop) ||
  !/\bd2\b/.test(oldLoop) ||
  !/target\.alive\s*=\s*false/.test(oldLoop)
) {
  throw new Error("Current Vulcan ellipse kill loop differs from expected semantics. No file written.");
}

const newLoop = `        /*
         * ${MARK}
         *
         * Uniform random point inside a CIRCLE around the live mouse aim.
         * sqrt(random) is important: it gives uniform AREA density instead of
         * clustering impacts unnaturally at the center.
         *
         * This impact point is now the single source of truth for:
         *   1) visible vulcan_fired impact/tracer position
         *   2) authoritative Hider hit test
         *
         * The animated searchlight ellipse is NOT a damage hitbox anymore.
         */
        const shotAngle =
          Math.random() *
          Math.PI *
          2;

        const shotDistance =
          Math.sqrt(Math.random()) *
          this.vulcanImpactSpreadRadius;

        const impactX =
          Math.max(
            0,
            Math.min(
              960,
              aim.x +
                Math.cos(shotAngle) *
                  shotDistance,
            ),
          );

        const impactY =
          Math.max(
            0,
            Math.min(
              540,
              aim.y +
                Math.sin(shotAngle) *
                  shotDistance,
            ),
          );

        /*
         * Reuse the existing vulcan_fired network event so every client sees
         * the EXACT server-authoritative impact coordinate. No client-side
         * random mismatch.
         */
        this.broadcast('vulcan_fired', {
          shooterId: client.sessionId,
          x: impactX,
          y: impactY,
        });

        const impactRadiusSq =
          this.vulcanImpactHitRadius *
          this.vulcanImpactHitRadius;

        for (
          const [sessionId, target]
          of this.state.players
        ) {
          if (
            target.role !== 'hider' ||
            !target.alive
          ) {
            continue;
          }

          const dx =
            target.x - impactX;

          const dy =
            target.y - impactY;

          if (
            dx * dx + dy * dy >
            impactRadiusSq
          ) {
            continue;
          }

          target.alive = false;

          if (
            !this.victoryFoundHiders.some(
              (entry) =>
                entry.sessionId ===
                sessionId,
            )
          ) {
            this.victoryFoundHiders.push({
              sessionId,
              name: String(
                target.name ??
                  'Hider',
              ).slice(0, 32),
              x: target.x,
              y: target.y,
              foundOrder:
                this.victoryFoundHiders.length +
                1,
              foundAt: tickNow,
            });
          }
        }

`;

block = block.slice(0,loopStart) + newLoop + block.slice(aliveCheck);
s = s.slice(0,start) + block + s.slice(end);

// Old ellipse fields are intentionally retained but TS noUnusedLocals may reject them.
// Rename them as documented legacy values and make them statics used in one no-op audit tuple.
s = s.replace(
  /private readonly vulcanHitRadiusX\s*=\s*105\s*;/,
  "private readonly vulcanLegacyHitRadiusX = 105;"
);
s = s.replace(
  /private readonly vulcanHitRadiusY\s*=\s*66\s*;/,
  "private readonly vulcanLegacyHitRadiusY = 66;"
);

// Since noUnusedLocals is enabled, don't leave unused legacy fields.
s = s.replace(
  /\s*private readonly vulcanLegacyHitRadiusX\s*=\s*105\s*;\s*\n\s*private readonly vulcanLegacyHitRadiusY\s*=\s*66\s*;/,
  ""
);

s = `/* ${MARK}: searchlight ellipse is visual-only; server chooses random circular impact points and hits only around the visible impact. */\n` + s;

// Validate exact semantics.
const checks = [
  ["spread radius 58", /vulcanImpactSpreadRadius\s*=\s*58/],
  ["hit radius 22", /vulcanImpactHitRadius\s*=\s*22/],
  ["uniform circular spread", /Math\.sqrt\(Math\.random\(\)\)/],
  ["impact X", /const impactX/],
  ["impact Y", /const impactY/],
  ["broadcast exact impact", /broadcast\('vulcan_fired',\s*\{[\s\S]{0,180}?x:\s*impactX,[\s\S]{0,100}?y:\s*impactY/],
  ["circle hit dx", /target\.x\s*-\s*impactX/],
  ["circle hit dy", /target\.y\s*-\s*impactY/],
  ["circle radius squared", /impactRadiusSq/],
  ["1.5x timer retained", /setTimeout\(\s*tick\s*,\s*60/],
];
for (const [label,re] of checks) {
  if (!re.test(s)) throw new Error(`Postcondition failed: ${label}. No file written.`);
}

// Ensure the OLD ellipse damage math is gone from the fire handler.
const newStart=s.indexOf("    vulcan_fire_start: (");
const newEnd=s.indexOf("\n    vulcan_fire_stop: (",newStart);
const finalBlock=s.slice(newStart,newEnd);
if (
  /vulcanHitRadiusX/.test(finalBlock) ||
  /vulcanHitRadiusY/.test(finalBlock) ||
  /const nx\s*=/.test(finalBlock) ||
  /const ny\s*=/.test(finalBlock)
) {
  throw new Error("Old ellipse damage math still present in vulcan_fire_start. No file written.");
}

fs.mkdirSync(path.join("..","color-hunt-server",".patch-backups"),{recursive:true});
fs.writeFileSync(
  path.join("..","color-hunt-server",".patch-backups","MyRoom-before-v529.ts"),
  original,
  "utf8"
);
fs.writeFileSync(serverFile,s,"utf8");

console.log("Applied v0.10.10.529.");
console.log(" - searchlight ellipse animation/size is untouched (visual-only)");
console.log(" - actual Vulcan shots now scatter uniformly inside a 58px circle around mouse aim");
console.log(" - each shot has a small 22px circular authoritative hit radius");
console.log(" - server broadcasts the SAME random impact coordinate through vulcan_fired");
console.log(" - visible impact and actual kill location are now synchronized");
console.log(" - old ±105 x ±66 ellipse damage test removed");
console.log(" - v526b 60ms authoritative cadence (1.5x original) retained");
console.log(" - client source unchanged");
console.log("Next: cd ..\\color-hunt-server && npm run build");
