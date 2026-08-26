const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "src", "game", "GameScene.ts");
const MARK = "V1010501C_REMOVE_UNUSED_PAINT_ASSIST_DISCOVERY_ASSIGNMENT";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt CLIENT project root.");
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.501c already applied");
  process.exit(0);
}

const target =
`            this.paintAssistDiscoveryBubbleShown = true;
`;

const count = s.split(target).length - 1;

if (count !== 1) {
  throw new Error(
    `Expected exactly 1 obsolete paintAssistDiscoveryBubbleShown assignment, found ${count}. No file written.`
  );
}

s = s.replace(target, "");

s =
  `/* ${MARK}: remove leftover assignment after v501b removed obsolete Paint Assist discovery flag. */\n` +
  s;

fs.writeFileSync(FILE, s, "utf8");

console.log("[done] v0.10.10.501c CLIENT");
console.log("[fix] removed leftover paintAssistDiscoveryBubbleShown assignment");
console.log("[safe] Paint Help bubble behavior remains unchanged");
console.log("[safe] sniper/victory/network/READY/reconnect untouched");
console.log("Next: npm run build");
