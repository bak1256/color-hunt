const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "src", "game", "GameScene.ts");
const MARK = "V1010501G4_HIDE_CLEAR_CIRCLE_UNTIL_SCOPE_INTERACTIVE";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt project root.");
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.501g4 already applied");
  process.exit(0);
}

const original = s;

const revealMarker = "V1010501G2_SCOPE_REVEAL_LAST";
const markerAt = s.indexOf(revealMarker);

if (markerAt < 0) {
  throw new Error(
    "g2 scope reveal marker not found. No file written."
  );
}

const oldReveal =
`        this.sniperScopeCamera
            ?.setVisible(true);
`;

const revealAt = s.indexOf(oldReveal, markerAt);

if (revealAt < 0) {
  throw new Error(
    "g2 scope reveal call not found after marker. No file written."
  );
}

/*
 * The actual bug:
 * drawLocalSniperScope() runs during rack-in BEFORE the physical scope is
 * interactive. g2 revealed the magnified camera at the end of EVERY draw,
 * so a sharp circular lens could still appear before the scope body.
 *
 * Keep the camera completely hidden until sniperScopeInteractive === true.
 * This field already represents "rack-in finished / scope is actually ready".
 */
const newReveal =
`        /*
         * ${MARK}
         * DO NOT reveal the magnified circular camera during rack-in.
         * It may appear only when the physical scope has finished arriving
         * and the existing sniperScopeInteractive gate is true.
         */
        this.sniperScopeCamera
            ?.setVisible(
                this.sniperScopeInteractive,
            );
`;

s =
  s.slice(0, revealAt) +
  newReveal +
  s.slice(revealAt + oldReveal.length);

/* Extra belt-and-suspenders: while rack-in is not interactive, explicitly hide
 * the camera at the START of drawLocalSniperScope too. This changes visibility
 * only; it does not touch blur/mask/zoom/aim/fire.
 */
const drawRegex =
  /(^[ \t]*private drawLocalSniperScope\([\s\S]*?\):\s*void\s*\{)/m;

const drawMatch = s.match(drawRegex);

if (!drawMatch || drawMatch.index == null) {
  throw new Error(
    "drawLocalSniperScope() signature not found. No file written."
  );
}

const drawOpenEnd =
  drawMatch.index + drawMatch[0].length;

const guard =
`
        /*
         * ${MARK} / PRE_SCOPE_CLEAR_CIRCLE_KILL
         */
        if (!this.sniperScopeInteractive) {
            (
                this.sniperScopeCamera as
                    Phaser.Cameras.Scene2D.Camera | undefined
            )
                ?.setVisible(false);
        }
`;

s =
  s.slice(0, drawOpenEnd) +
  guard +
  s.slice(drawOpenEnd);

s =
`/* ${MARK}: magnified scope camera stays hidden through rack-in; reveal only after existing scope-interactive gate. */\n` +
s;

for (const token of [
  MARK,
  "PRE_SCOPE_CLEAR_CIRCLE_KILL",
  "this.sniperScopeInteractive",
]) {
  if (!s.includes(token)) {
    throw new Error(
      `Safety assertion failed: ${token}. No file written.`
    );
  }
}

fs.mkdirSync(".patch-backups", { recursive: true });
fs.writeFileSync(
  ".patch-backups/GameScene-before-v501g4.ts",
  original,
  "utf8",
);
fs.writeFileSync(FILE, s, "utf8");

console.log("");
console.log("[done] v0.10.10.501g4 CLIENT");
console.log("[fix] magnified clear circle is FORCED HIDDEN during rack-in");
console.log("[fix] scope camera becomes visible only when sniperScopeInteractive === true");
console.log("[unchanged] outside blur");
console.log("[unchanged] scope mask/radius/zoom");
console.log("[unchanged] sniper aim/fire/camera movement/server");
console.log("Next: npm run build");
