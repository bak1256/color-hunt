const fs = require("fs");

const path = "src/game/GameScene.ts";
let s = fs.readFileSync(path, "utf8");

const before = `                .fillPoints(
                    [
                        new Phaser.Geom.Point(
                            hourglassX - topHalfWidth,
                            fillTopY,
                        ),
                        new Phaser.Geom.Point(
                            hourglassX + topHalfWidth,
                            fillTopY,
                        ),
                        new Phaser.Geom.Point(
                            hourglassX + halfW - 3,
                            chamberBottomY,
                        ),
                        new Phaser.Geom.Point(
                            hourglassX - halfW + 3,
                            chamberBottomY,
                        ),
                    ],
                    true,
                );`;

const after = `                .fillPoints(
                    [
                        {
                            x: hourglassX - topHalfWidth,
                            y: fillTopY,
                        },
                        {
                            x: hourglassX + topHalfWidth,
                            y: fillTopY,
                        },
                        {
                            x: hourglassX + halfW - 3,
                            y: chamberBottomY,
                        },
                        {
                            x: hourglassX - halfW + 3,
                            y: chamberBottomY,
                        },
                    ],
                    true,
                );`;

if (s.includes(after)) {
  console.log("[skip] Phaser point build fix already applied");
} else if (s.includes(before)) {
  s = s.replace(before, after);
  fs.writeFileSync(path, s, "utf8");
  console.log("[ok] replaced Phaser.Geom.Point with plain point objects");
} else {
  throw new Error("Could not find hourglass fillPoints block in GameScene.ts");
}

console.log("[done] v0.10.10.70a client build fix applied");
console.log("Next: npm run build");
