const fs = require("fs");
const path = require("path");

const file = path.join("src", "game", "GameScene.ts");
const MARK = "V1010530C_VULCAN_AUTHORITATIVE_IMPACT_VFX";
if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run from C:\\Users\\bak12\\color-hunt. No file written.`);

let s = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const original = s;
if (s.includes(MARK)) { console.log("[skip] v530c already applied."); process.exit(0); }

// Replace current onVulcanFired body structurally, not by exact whitespace.
const cbRe = /multiplayerClient\.onVulcanFired\(\(shot:\s*NetworkVulcanFired\)\s*=>\s*\{[\s\S]*?\}\),\s*\n\s*\),/m;
const cbMatch = s.match(cbRe);
if (!cbMatch) throw new Error("onVulcanFired callback not found. No file written.");

const newCb = `multiplayerClient.onVulcanFired((shot: NetworkVulcanFired) => {
                /*
                 * ${MARK}
                 * v530 server owns the random impact coordinate.
                 * Render that coordinate exactly; do NOT move spotlight aim.
                 */
                this.spawnVulcanPresentationImpact(
                    shot.x,
                    shot.y,
                    false,
                    true,
                );
            }),
        ),`;
s = s.replace(cbRe, newCb);

// Locate method and surgically replace ONLY px/py coordinate calculation.
// true = exact authoritative coordinate.
const methodStart = s.indexOf("    private spawnVulcanPresentationImpact(");
if (methodStart < 0) throw new Error("spawnVulcanPresentationImpact method not found. No file written.");
const nextMethod = s.indexOf("\n    private ", methodStart + 10);
if (nextMethod < 0) throw new Error("Could not isolate spawnVulcanPresentationImpact. No file written.");
let method = s.slice(methodStart, nextMethod);

// Add fourth parameter if absent.
if (!/exactCoordinate\s*=\s*false/.test(method)) {
  method = method.replace(
    /(withSound:\s*boolean,\s*\n\s*)\):\s*void\s*\{/,
    `$1exactCoordinate = false,\n    ): void {`
  );
}
if (!/exactCoordinate\s*=\s*false/.test(method)) {
  throw new Error("Could not add exactCoordinate parameter. No file written.");
}

// Find px block by semantic landmarks, regardless formatting.
const pxStart = method.indexOf("        const px");
const pyStart = method.indexOf("        const py", pxStart);
if (pxStart < 0 || pyStart < 0) throw new Error("px/py impact calculations not found. No file written.");

const afterPyCandidates = [
  method.indexOf("\n\n        const ", pyStart + 1),
  method.indexOf("\n        const ", pyStart + 1),
  method.indexOf("\n\n        this.", pyStart + 1),
  method.indexOf("\n        this.", pyStart + 1),
].filter(v => v > pyStart);
if (!afterPyCandidates.length) throw new Error("Could not find end of py calculation. No file written.");
const afterPy = Math.min(...afterPyCandidates);

const coordBlock = method.slice(pxStart, afterPy);
if (!/Phaser\.Math\.(Between|FloatBetween)/.test(coordBlock)) {
  throw new Error("Impact coordinate block has no client random offset; source shape differs. No file written.");
}

const exactBlock = `        const px =
            exactCoordinate
                ? Phaser.Math.Clamp(
                      x,
                      0,
                      960,
                  )
                : Phaser.Math.Clamp(
                      x +
                          Phaser.Math.Between(
                              -26,
                              26,
                          ),
                      0,
                      960,
                  );

        const py =
            exactCoordinate
                ? Phaser.Math.Clamp(
                      y,
                      0,
                      540,
                  )
                : Phaser.Math.Clamp(
                      y +
                          Phaser.Math.Between(
                              -18,
                              18,
                          ),
                      0,
                      540,
                  );`;

method = method.slice(0, pxStart) + exactBlock + method.slice(afterPy);
s = s.slice(0, methodStart) + method + s.slice(nextMethod);

// Remove the old frame-driven fake impact call, but KEEP gun pulse/recoil.
// Flexible whitespace.
const fakeRe = /this\.spawnVulcanPresentationImpact\(\s*this\.vulcanDisplayX,\s*this\.vulcanDisplayY,\s*true,\s*\);/g;
const fakeMatches = s.match(fakeRe) || [];
if (fakeMatches.length !== 1) {
  throw new Error(`Expected exactly one frame-driven fake Vulcan impact call, found ${fakeMatches.length}. No file written.`);
}
s = s.replace(fakeRe, `/* ${MARK}: server vulcan_fired drives visible impacts. */\n            this.playVulcanGunPulse();`);

s = `/* ${MARK}: server impact coordinate = visible impact coordinate; spotlight remains independent. */\n` + s;

const checks = [
  ["exact callback", /onVulcanFired[\s\S]{0,600}?shot\.x,[\s\S]{0,80}?shot\.y,[\s\S]{0,80}?false,[\s\S]{0,80}?true/],
  ["exactCoordinate param", /exactCoordinate\s*=\s*false/],
  ["exact px", /exactCoordinate[\s\S]{0,120}?Phaser\.Math\.Clamp\(\s*x,/],
  ["exact py", /const py[\s\S]{0,120}?exactCoordinate[\s\S]{0,120}?Phaser\.Math\.Clamp\(\s*y,/],
  ["fake removed", !fakeRe.test(s)],
];
for (const [label, test] of checks) {
  const ok = test instanceof RegExp ? test.test(s) : test;
  if (!ok) throw new Error(`Postcondition failed: ${label}. No file written.`);
}

fs.mkdirSync(".patch-backups", { recursive: true });
fs.writeFileSync(path.join(".patch-backups", "GameScene-before-v530c.ts"), original, "utf8");
fs.writeFileSync(file, s, "utf8");

console.log("Applied v0.10.10.530c.");
console.log(" - exact server vulcan_fired coordinate now renders the impact");
console.log(" - authoritative impact gets NO extra client random offset");
console.log(" - spotlight target is no longer overwritten by bullet impact packets");
console.log(" - old frame-driven fake impacts removed");
console.log(" - local BRRRT sound/recoil cadence retained");
console.log("Next: npm run build");
