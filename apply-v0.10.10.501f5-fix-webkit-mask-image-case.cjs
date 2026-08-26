const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "src", "game", "GameScene.ts");
const MARK = "V1010501F5_FIX_WEBKIT_MASK_IMAGE_CASE";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt CLIENT project root.");
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.501f5 already applied");
  process.exit(0);
}

const target = "        overlay.style.WebkitMaskImage = mask;\n";
const count = s.split(target).length - 1;

if (count !== 1) {
  throw new Error(
    `Expected exactly 1 WebkitMaskImage assignment, found ${count}. No file written.`
  );
}

s = s.replace(
  target,
  "        overlay.style.webkitMaskImage = mask;\n"
);

s =
`/* ${MARK}: TypeScript CSSStyleDeclaration uses webkitMaskImage (lowercase w). */\n` +
s;

fs.writeFileSync(FILE, s, "utf8");

console.log("[done] v0.10.10.501f5 CLIENT");
console.log("[fix] WebkitMaskImage -> webkitMaskImage");
console.log("[safe] sniper blur behavior unchanged");
console.log("Next: npm run build");
