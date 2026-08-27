const fs = require("fs");
const path = require("path");

const target = path.resolve(process.cwd(), "..", "color-hunt-server", "src", "rooms", "MyRoom.ts");
const MARK = "V1010530_VULCAN_CIRCULAR_RANDOM_IMPACT";

if (!fs.existsSync(target)) {
  throw new Error(`Server MyRoom.ts not found: ${target}\nRun from C:\\Users\\bak12\\color-hunt. No file written.`);
}

let s = fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n");
const original = s;

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.530 already applied.");
  process.exit(0);
}

const start = s.indexOf("    vulcan_fire_start: (");
const end = s.indexOf("\n    vulcan_fire_stop: (", start);
if (start < 0 || end < 0) throw new Error("vulcan_fire_start block not found. No file written.");

let block = s.slice(start, end);

// Works on both uploaded pre-529c source and already-pushed 529c source.
// Replace from the old per-target loop up to (but not including) alive-count check.
const loopStart = block.indexOf("          for (\n            const [");
const alive = block.indexOf("          if (\n            this.getAliveHiderCount()", loopStart);
if (loopStart < 0 || alive < 0) {
  throw new Error("Current Vulcan target-loop boundaries not found. No file written.");
}

const oldLoop = block.slice(loopStart, alive);
if (!oldLoop.includes("target.role") ||
    !oldLoop.includes("target.alive") ||
    !oldLoop.includes("target.x") ||
    !oldLoop.includes("target.y") ||
    !oldLoop.includes("target.alive =") ||
    !oldLoop.includes("victoryFoundHiders")) {
  throw new Error("Located loop is not the expected Vulcan Hider kill loop. No file written.");
}

const replacement = `          /*
           * ${MARK}
           *
           * IMPORTANT:
           * - The animated spotlight ellipse remains 100% VISUAL.
           * - Damage no longer uses vulcanHitRadiusX/Y.
           * - Every authoritative 60ms tick chooses ONE random impact point
           *   inside a small circle around the live mouse aim.
           * - The SAME impact coordinate is broadcast to clients and used
           *   for the actual Hider hit test.
           */
          const spreadRadius =
            58;

          const hitRadius =
            22;

          const angle =
            Math.random() *
            Math.PI *
            2;

          // sqrt() makes random points uniform across the circle's AREA.
          const distance =
            Math.sqrt(
              Math.random(),
            ) *
            spreadRadius;

          const impactX =
            Math.max(
              0,
              Math.min(
                960,
                aim.x +
                  Math.cos(
                    angle,
                  ) *
                    distance,
              ),
            );

          const impactY =
            Math.max(
              0,
              Math.min(
                540,
                aim.y +
                  Math.sin(
                    angle,
                  ) *
                    distance,
              ),
            );

          /*
           * One authoritative visual/damage coordinate.
           * Existing clients that don't listen to this packet simply ignore it;
           * the server hit logic below remains authoritative.
           */
          this.broadcast(
            'vulcan_fired',
            {
              shooterId:
                client.sessionId,
              x:
                impactX,
              y:
                impactY,
              radius:
                hitRadius,
              serverNow:
                tickNow,
            },
          );

          const hitRadiusSq =
            hitRadius *
            hitRadius;

          for (
            const [
              sessionId,
              target,
            ] of
            this.state.players
          ) {
            if (
              target.role !==
                'hider' ||
              !target.alive
            ) {
              continue;
            }

            const dx =
              target.x -
              impactX;

            const dy =
              target.y -
              impactY;

            if (
              dx * dx +
                dy * dy >
              hitRadiusSq
            ) {
              continue;
            }

            target.alive =
              false;

            if (
              !this.victoryFoundHiders.some(
                (
                  entry,
                ) =>
                  entry.sessionId ===
                  sessionId,
              )
            ) {
              this.victoryFoundHiders.push({
                sessionId,
                name:
                  String(
                    target.name ??
                      'Hider',
                  ).slice(
                    0,
                    32,
                  ),
                x:
                  target.x,
                y:
                  target.y,
                foundOrder:
                  this.victoryFoundHiders.length +
                  1,
                foundAt:
                  tickNow,
              });
            }
          }

`;

block = block.slice(0, loopStart) + replacement + block.slice(alive);
s = s.slice(0, start) + block + s.slice(end);

// Postconditions: keep 1.5x cadence and ensure old ellipse damage math is gone from fire handler.
const finalStart = s.indexOf("    vulcan_fire_start: (");
const finalEnd = s.indexOf("\n    vulcan_fire_stop: (", finalStart);
const finalBlock = s.slice(finalStart, finalEnd);

const checks = [
  ["marker", finalBlock.includes(MARK)],
  ["58px spread", /const spreadRadius\s*=\s*58/.test(finalBlock)],
  ["22px hit radius", /const hitRadius\s*=\s*22/.test(finalBlock)],
  ["random circular point", /Math\.sqrt\(\s*Math\.random\(\)/.test(finalBlock)],
  ["impact broadcast", /'vulcan_fired'[\s\S]*?impactX[\s\S]*?impactY/.test(finalBlock)],
  ["impact hit X", /target\.x\s*-\s*impactX/.test(finalBlock)],
  ["impact hit Y", /target\.y\s*-\s*impactY/.test(finalBlock)],
  ["60ms cadence", (finalBlock.match(/setTimeout\(\s*tick,\s*60/g) || []).length === 2],
  ["old ellipse X removed from damage", !/\/\s*this\.vulcanHitRadiusX/.test(finalBlock)],
  ["old ellipse Y removed from damage", !/\/\s*this\.vulcanHitRadiusY/.test(finalBlock)],
];

for (const [label, ok] of checks) {
  if (!ok) throw new Error(`Postcondition failed: ${label}. No file written.`);
}

const backup = `${target}.bak-v0.10.10.530`;
fs.copyFileSync(target, backup);
fs.writeFileSync(target, `/* ${MARK}: spotlight ellipse visual-only; damage follows server-random circular impacts. */\n` + s, "utf8");

console.log("Applied v0.10.10.530.");
console.log(" - spotlight ellipse: UNCHANGED, visual-only");
console.log(" - mouse-centered random spread circle: radius 58px");
console.log(" - each visible impact damage circle: radius 22px");
console.log(" - server chooses impact coordinates");
console.log(" - same coordinates broadcast as vulcan_fired");
console.log(" - old 105x66 ellipse is NOT used for Vulcan damage");
console.log(" - authoritative cadence remains 60ms (1.5x original)");
console.log("Backup:", backup);
console.log("Next: cd ..\\color-hunt-server && npm run build");
