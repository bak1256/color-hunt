const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "src", "game", "GameScene.ts");
const MARK = "V1010501G3_FIX_SNIPER_CAMERA_VISIBLE_TYPE";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt project root.");
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.501g3 already applied");
  process.exit(0);
}

const target =
`        this.sniperScopeCamera
            ?.setVisible(false);
`;

const matches = s.split(target).length - 1;

if (matches < 1) {
  throw new Error(
    "No inserted sniperScopeCamera?.setVisible(false) call found. No file written."
  );
}

/*
 * Only replace the first occurrence that belongs to the g2 PREHIDE block.
 * Locate the marker first so we don't touch unrelated existing camera code.
 */
const marker = "V1010501G2_SCOPE_CAMERA_PREHIDE";
const markerAt = s.indexOf(marker);

if (markerAt < 0) {
  throw new Error(
    "v501g2 PREHIDE marker not found. No file written."
  );
}

const targetAt = s.indexOf(target, markerAt);

if (targetAt < 0) {
  throw new Error(
    "PREHIDE setVisible(false) call not found after marker. No file written."
  );
}

const replacement =
`        (
            this.sniperScopeCamera as
                Phaser.Cameras.Scene2D.Camera | undefined
        )
            ?.setVisible(false);
`;

s =
  s.slice(0, targetAt) +
  replacement +
  s.slice(targetAt + target.length);

s =
`/* ${MARK}: explicit Phaser Camera cast for g2 prehide; runtime behavior unchanged. */\n` +
s;

fs.writeFileSync(FILE, s, "utf8");

console.log("");
console.log("[done] v0.10.10.501g3 CLIENT");
console.log("[fix] TypeScript 'never' inference only");
console.log("[behavior] scope prehide/reveal ordering unchanged");
console.log("[unchanged] blur/mask/zoom/fire/aim");
console.log("Next: npm run build");
