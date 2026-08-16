const fs = require("fs");

const path = "src/game/GameScene.ts";
let s = fs.readFileSync(path, "utf8");

const replacements = [
  [
`                        {
                            x: hourglassX - topHalfWidth,
                            y: fillTopY,
                        },`,
`                        new Phaser.Math.Vector2(
                            hourglassX - topHalfWidth,
                            fillTopY,
                        ),`
  ],
  [
`                        {
                            x: hourglassX + topHalfWidth,
                            y: fillTopY,
                        },`,
`                        new Phaser.Math.Vector2(
                            hourglassX + topHalfWidth,
                            fillTopY,
                        ),`
  ],
  [
`                        {
                            x: hourglassX + halfW - 3,
                            y: chamberBottomY,
                        },`,
`                        new Phaser.Math.Vector2(
                            hourglassX + halfW - 3,
                            chamberBottomY,
                        ),`
  ],
  [
`                        {
                            x: hourglassX - halfW + 3,
                            y: chamberBottomY,
                        },`,
`                        new Phaser.Math.Vector2(
                            hourglassX - halfW + 3,
                            chamberBottomY,
                        ),`
  ],
];

let changed = 0;

for (const [before, after] of replacements) {
  if (s.includes(after)) {
    continue;
  }

  if (!s.includes(before)) {
    throw new Error("Could not find one of the hourglass point blocks");
  }

  s = s.replace(before, after);
  changed += 1;
}

fs.writeFileSync(path, s, "utf8");

console.log(`[ok] converted ${changed} hourglass points to Phaser.Math.Vector2`);
console.log("[done] v0.10.10.70b client Vector2 build fix applied");
console.log("Next: npm run build");
