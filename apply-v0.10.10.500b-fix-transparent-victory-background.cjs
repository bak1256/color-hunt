const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "src", "game", "GameScene.ts");
const MARK = "V1010500B_FIX_TRANSPARENT_VICTORY_BACKGROUND";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt CLIENT project root.");
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.500b already applied");
  process.exit(0);
}

const before = `.setBackgroundColor(null)`;
const count = s.split(before).length - 1;

if (count !== 1) {
  throw new Error(
    `Expected exactly 1 setBackgroundColor(null), found ${count}. No file written.`
  );
}

s = s.replace(
  before,
  `.setBackgroundColor('rgba(0,0,0,0)')`
);

s =
`/* ${MARK}: Phaser Text.setBackgroundColor() requires string; use fully transparent background instead of null. */\n` +
s;

fs.writeFileSync(FILE, s, "utf8");

console.log("[done] v0.10.10.500b CLIENT");
console.log("[fix] setBackgroundColor(null) -> transparent rgba string");
console.log("[visual] winner text still has NO visible background");
console.log("Next: npm run build");
