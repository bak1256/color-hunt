const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const FILE = path.join(ROOT, "src", "game", "GameScene.ts");
const BACKUP = path.join(
  ROOT,
  ".patch-backups",
  "GameScene-before-v501f4.ts"
);

if (!fs.existsSync(FILE)) {
  throw new Error("src/game/GameScene.ts not found. Run from color-hunt project root.");
}

if (!fs.existsSync(BACKUP)) {
  throw new Error(
    "Exact pre-501f4 backup not found: .patch-backups/GameScene-before-v501f4.ts. No file written."
  );
}

const current = fs.readFileSync(FILE, "utf8");
const backup = fs.readFileSync(BACKUP, "utf8");

if (!current.includes("V1010501F4_ROBUST_COUNTDOWN_YELLOW_SNIPER_OUTSIDE_FOCUS")) {
  throw new Error(
    "Current GameScene.ts does not contain the 501f4 marker. Refusing rollback to avoid overwriting unrelated work."
  );
}

if (backup.includes("V1010501F4_ROBUST_COUNTDOWN_YELLOW_SNIPER_OUTSIDE_FOCUS")) {
  throw new Error(
    "Backup unexpectedly already contains the 501f4 marker. No file written."
  );
}

/* Preserve the broken/current version too, just in case. */
const rescue = path.join(
  ROOT,
  ".patch-backups",
  "GameScene-broken-after-v501f5.ts"
);
fs.writeFileSync(rescue, current, "utf8");

/* Exact restore to the snapshot created immediately before 501f4 wrote GameScene.ts. */
fs.writeFileSync(FILE, backup, "utf8");

console.log("");
console.log("[done] exact rollback to GameScene-before-v501f4.ts");
console.log("[removed] 501f4 sniper DOM blur/mask changes");
console.log("[removed] 501f5 webkitMaskImage follow-up");
console.log("[restored] exact GameScene.ts state from immediately before 501f4");
console.log("[kept] 501e and all earlier changes already present in that saved snapshot");
console.log("[rescue] broken current file saved as .patch-backups/GameScene-broken-after-v501f5.ts");
console.log("Next: npm run build");
