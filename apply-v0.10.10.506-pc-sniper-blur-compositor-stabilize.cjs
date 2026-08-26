const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(process.cwd(), "src", "game", "GameScene.ts");
const MARK = "V1010506_PC_SNIPER_BLUR_COMPOSITOR_STABILIZE";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt CLIENT project root.");
}

let src = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (src.includes(MARK)) {
  console.log("[skip] v0.10.10.506 already applied");
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
 * HARD LOCK.
 * This patch is NOT allowed to alter physical scope behavior.
 */
const LOCKED = [
  "enterSniperCinematic",
  "startSniperScopeRackIn",
  "createSniperScopeCamera",
  "drawLocalSniperScope",
  "syncSniperScopeDom",
  "exitSniperCinematic",
];

const lockedBefore = new Map(
  LOCKED.map((name) => [name, sha(getMethod(original, name))]),
);

/*
 * Edit ONLY ensureSniperScopeDom(), specifically blurLayer's creation style.
 *
 * Video diagnosis:
 * the outside map geometry itself is stable; the apparent zoom/breathing is
 * Chrome re-rasterizing a full-screen backdrop-filter while its radial mask
 * moves with the scope.
 *
 * Promote ONLY the blur overlay to its own compositor layer so the backdrop
 * texture stays stable while mask-image changes.
 */
const r = findMethodRange(src, "ensureSniperScopeDom");
const methodBefore = src.slice(r.start, r.end);

const oldWillChange =
`                willChange:
                    'mask-image, -webkit-mask-image',`;

const count =
  methodBefore.split(oldWillChange).length - 1;

if (count !== 1) {
  throw new Error(
    `ensureSniperScopeDom blur willChange anchor: expected 1, found ${count}. No file written.`
  );
}

const newWillChange =
`                /*
                 * ${MARK}
                 * PC Chrome compositor stabilization:
                 * keep the moving masked backdrop blur on a dedicated layer.
                 *
                 * This changes ONLY browser compositing hints.
                 * No scope radius / X/Y / mask geometry / camera / rack-in /
                 * aim / fire logic is touched.
                 */
                transform:
                    'translate3d(0,0,0)',
                transformOrigin:
                    '0 0',
                backfaceVisibility:
                    'hidden',
                webkitBackfaceVisibility:
                    'hidden',
                willChange:
                    'backdrop-filter, -webkit-backdrop-filter, mask-image, -webkit-mask-image',`;

const methodAfter =
  methodBefore.replace(
    oldWillChange,
    newWillChange,
  );

src =
  src.slice(0, r.start) +
  methodAfter +
  src.slice(r.end);

/*
 * Exact guard: removing our compositor-only properties must reconstruct
 * ensureSniperScopeDom() byte-for-byte.
 */
if (
  methodAfter.replace(newWillChange, oldWillChange) !==
  methodBefore
) {
  throw new Error(
    "[COMPOSITOR GUARD] ensureSniperScopeDom changed beyond blur-layer compositor hints. No file written."
  );
}

/* Physical scope methods remain byte-identical. */
for (const name of LOCKED) {
  if (sha(getMethod(src, name)) !== lockedBefore.get(name)) {
    throw new Error(
      `[SCOPE LOCK VIOLATION] ${name}() changed. ABORT. No file written.`
    );
  }
}

src =
  `/* ${MARK}: stabilize PC masked backdrop-filter compositor only; physical sniper scope LOCKED. */\n` +
  src;

fs.mkdirSync(".patch-backups", { recursive: true });

fs.writeFileSync(
  ".patch-backups/GameScene-before-v506.ts",
  original,
  "utf8",
);

fs.writeFileSync(FILE, src, "utf8");

console.log("");
console.log("[done] v0.10.10.506 CLIENT");
console.log("[video diagnosis] main background geometry/zoom is stable; apparent breathing comes from masked backdrop-filter compositing");
console.log("[fix ONLY] promote sniper blurLayer to a stable compositor layer");
console.log("[fix ONLY] add transform3d/backface/will-change compositor hints");
console.log("[SCOPE LOCK] rack-in/radius/X/Y/mask geometry/cameras/aim/fire unchanged");
console.log("[SCOPE LOCK] second-round blur lifecycle from 505 untouched");
console.log("[SCOPE LOCK] pre-rack clear-circle prevention untouched");
console.log("[backup] .patch-backups/GameScene-before-v506.ts");
console.log("Next: npm run build");
