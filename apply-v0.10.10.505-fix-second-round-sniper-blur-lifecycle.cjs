const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(process.cwd(), "src", "game", "GameScene.ts");
const MARK = "V1010505_SECOND_ROUND_SNIPER_BLUR_LIFECYCLE";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt CLIENT project root.");
}

let src = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (src.includes(MARK)) {
  console.log("[skip] v0.10.10.505 already applied");
  process.exit(0);
}

const original = src;

function sha(v) {
  return crypto.createHash("sha256").update(v).digest("hex");
}

function findMethodRange(source, name) {
  const re = new RegExp(`^[ \\t]*private[ \\t]+${name}\\s*\\(`, "m");
  const m = source.match(re);

  if (!m || m.index == null) {
    throw new Error(`${name}() not found. No file written.`);
  }

  const start = m.index;
  const brace = source.indexOf("{", start);

  if (brace < 0) {
    throw new Error(`${name}() opening brace not found. No file written.`);
  }

  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1] || "";

    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }

    if (ch === "/" && next === "/") {
      lineComment = true;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      blockComment = true;
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "{") depth += 1;

    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return { start, end: i + 1 };
      }
    }
  }

  throw new Error(`${name}() closing brace not found. No file written.`);
}

function getMethod(source, name) {
  const r = findMethodRange(source, name);
  return source.slice(r.start, r.end);
}

/*
 * HARD LOCK:
 * v505 is ONLY allowed to change syncSniperScopeDom().
 * All physical sniper behavior remains byte-identical.
 */
const LOCKED = [
  "enterSniperCinematic",
  "startSniperScopeRackIn",
  "createSniperScopeCamera",
  "drawLocalSniperScope",
  "exitSniperCinematic",
  "ensureSniperScopeDom",
];

const lockedBefore = new Map(
  LOCKED.map((name) => [name, sha(getMethod(original, name))]),
);

const syncRange = findMethodRange(src, "syncSniperScopeDom");
const syncBefore = src.slice(syncRange.start, syncRange.end);

/*
 * ROOT CAUSE:
 * exitSniperCinematic() does:
 *     sniperScopeBlurDom.style.display = 'none'
 *
 * ensureSniperScopeDom() on later rounds returns early because sniperScopeDom
 * already exists, so the blur node is REUSED.
 *
 * syncSniperScopeDom() re-shows clipRoot, but never re-shows blurLayer itself.
 * Therefore:
 *     first sniper use  -> blur visible
 *     exit              -> blurLayer display:none
 *     second sniper use -> same blurLayer remains display:none forever
 *
 * Fix the lifecycle at the authoritative active sync point:
 * whenever blurLayer is being synchronized for an active optic, restore
 * display before updating its existing mask.
 */
const anchor =
`        if (blurLayer) {
            const holeX =`;

const count = syncBefore.split(anchor).length - 1;

if (count !== 1) {
  throw new Error(
    `syncSniperScopeDom blurLayer anchor: expected 1, found ${count}. No file written.`
  );
}

const replacement =
`        if (blurLayer) {
            /*
             * ${MARK}
             * exitSniperCinematic() intentionally hides this reusable DOM node.
             * Re-arm ONLY its visibility when the active scope sync resumes.
             *
             * No mask/radius/camera/rack-in behavior changes.
             */
            blurLayer.style.display =
                '';

            const holeX =`;

const syncAfter = syncBefore.replace(anchor, replacement);

src =
  src.slice(0, syncRange.start) +
  syncAfter +
  src.slice(syncRange.end);

/* Exact safety verification: remove our inserted visibility block and the
 * sync method must become byte-identical to the input.
 */
const inserted =
`            /*
             * ${MARK}
             * exitSniperCinematic() intentionally hides this reusable DOM node.
             * Re-arm ONLY its visibility when the active scope sync resumes.
             *
             * No mask/radius/camera/rack-in behavior changes.
             */
            blurLayer.style.display =
                '';

`;

if (syncAfter.replace(inserted, "") !== syncBefore) {
  throw new Error(
    "[SCOPE SYNC GUARD] syncSniperScopeDom changed beyond blurLayer display re-arm. No file written."
  );
}

/* All other sniper methods byte-identical. */
for (const name of LOCKED) {
  if (sha(getMethod(src, name)) !== lockedBefore.get(name)) {
    throw new Error(
      `[SCOPE LOCK VIOLATION] ${name}() changed. ABORT. No file written.`
    );
  }
}

src =
  `/* ${MARK}: re-show reused blur DOM on active scope sync; fixes first-round-only blur. Scope geometry/rack-in/cameras LOCKED. */\n` +
  src;

fs.mkdirSync(".patch-backups", { recursive: true });

fs.writeFileSync(
  ".patch-backups/GameScene-before-v505.ts",
  original,
  "utf8",
);

fs.writeFileSync(FILE, src, "utf8");

console.log("");
console.log("[done] v0.10.10.505 CLIENT");
console.log("[root cause] exit hides sniperScopeBlurDom with display:none");
console.log("[root cause] later rounds reuse the same DOM node, but sync never restored display");
console.log("[fix ONLY] blurLayer.style.display = '' during active sync");
console.log("[expected] first / second / third+ sniper uses all keep outside blur");
console.log("[SCOPE LOCK] rack-in/radius/X/Y/cameras/mask/aim/fire unchanged");
console.log("[SCOPE LOCK] no pre-rack clear-circle logic changed");
console.log("[backup] .patch-backups/GameScene-before-v505.ts");
console.log("Next: npm run build");
