const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(process.cwd(), "src", "game", "GameScene.ts");
const MARK = "V1010504B_BUBBLE_2LINES_DESKTOP_BLUR_MASK_ROBUST";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt CLIENT project root.");
}

let src = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (src.includes(MARK)) {
  console.log("[skip] v0.10.10.504b already applied");
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
      if (depth === 0) return { start, end: i + 1 };
    }
  }

  throw new Error(`${name}() closing brace not found. No file written.`);
}

function getMethod(source, name) {
  const r = findMethodRange(source, name);
  return source.slice(r.start, r.end);
}

function editMethod(name, editor) {
  const r = findMethodRange(src, name);
  const before = src.slice(r.start, r.end);
  const after = editor(before);

  if (after === before) {
    throw new Error(`${name}(): no edit applied. No file written.`);
  }

  src =
    src.slice(0, r.start) +
    after +
    src.slice(r.end);

  console.log("[ok]", name);
}

/* ============================================================
 * HARD LOCK: all known-good physical sniper behavior.
 * ============================================================ */
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

/* ============================================================
 * 1) Paint Help bubble: exactly 2 explicit lines.
 * ============================================================ */
editMethod(
  "showPaintAssistReadyStyleBubble",
  (method) => {
    let out = method;

    if (!/whiteSpace\s*:\s*'pre-line'/.test(out)) {
      throw new Error(
        "Paint Help bubble whiteSpace:'pre-line' anchor not found. No file written."
      );
    }

    out = out.replace(
      /whiteSpace\s*:\s*'pre-line'/,
      "whiteSpace:'pre'",
    );

    /*
     * Replace ONLY the maxWidth declaration in this method.
     * width:max-content + pre = the two explicit text lines never re-wrap.
     */
    const maxWidthRe =
      /maxWidth\s*:\s*this\.mobileControlsEnabled\s*\?\s*'[^']+'\s*:\s*'[^']+'/;

    if (!maxWidthRe.test(out)) {
      throw new Error(
        "Paint Help bubble maxWidth anchor not found. No file written."
      );
    }

    out = out.replace(
      maxWidthRe,
      `width:'max-content',
                maxWidth:'calc(100vw - 20px)'`,
    );

    /*
     * Keep the same visual family, just a hair smaller on mobile so
     * Korean/Japanese remain inside the viewport without clipping.
     */
    const fontSizeRe =
      /fontSize\s*:\s*this\.mobileControlsEnabled\s*\?\s*'12px'\s*:\s*'14px'/;

    if (fontSizeRe.test(out)) {
      out = out.replace(
        fontSizeRe,
        `fontSize:this.mobileControlsEnabled?'11px':'14px'`,
      );
    }

    return out;
  },
);

/* ============================================================
 * 2) Desktop blur mask robustness.
 *
 * ONLY change the opaque OUTSIDE color in desktopScopeHoleMask:
 * #000 -> #fff
 *
 * We do NOT touch:
 * - hole center / radius
 * - scope X/Y
 * - rack-in
 * - cameras
 * - blur strength
 * - blur opacity/timing
 * ============================================================ */
const syncBefore = getMethod(src, "syncSniperScopeDom");

editMethod(
  "syncSniperScopeDom",
  (method) => {
    const startMarker = "const desktopScopeHoleMask";
    const start = method.indexOf(startMarker);

    if (start < 0) {
      throw new Error(
        "desktopScopeHoleMask not found. No file written."
      );
    }

    const endMarker = "blurLayer.style.maskImage";
    const end = method.indexOf(endMarker, start);

    if (end < 0) {
      throw new Error(
        "desktopScopeHoleMask end not found. No file written."
      );
    }

    const beforeBlock = method.slice(start, end);

    const blackCount =
      (beforeBlock.match(/#000/g) || []).length;

    if (blackCount !== 1) {
      throw new Error(
        `desktopScopeHoleMask expected exactly one #000, found ${blackCount}. No file written.`
      );
    }

    const afterBlock =
      beforeBlock.replace("#000", "#fff");

    return (
      method.slice(0, start) +
      afterBlock +
      method.slice(end)
    );
  },
);

const syncAfter = getMethod(src, "syncSniperScopeDom");

/* Exact guard: reverting #fff -> #000 must reconstruct the original method. */
const revertedSync =
  syncAfter.replace("#fff", "#000");

if (revertedSync !== syncBefore) {
  throw new Error(
    "[SCOPE MASK GUARD] syncSniperScopeDom changed beyond #000 -> #fff. No file written."
  );
}

/* All other scope methods must remain byte-identical. */
for (const name of LOCKED) {
  if (sha(getMethod(src, name)) !== lockedBefore.get(name)) {
    throw new Error(
      `[SCOPE LOCK VIOLATION] ${name}() changed. ABORT. No file written.`
    );
  }
}

src =
  `/* ${MARK}: Paint Help forced to 2 explicit lines; desktop outside-blur mask opaque color made alpha/luminance-safe. Physical sniper subsystem LOCKED. */\n` +
  src;

for (const required of [
  MARK,
  "whiteSpace:'pre'",
  "width:'max-content'",
  "#fff",
]) {
  if (!src.includes(required)) {
    throw new Error(
      `Verification failed: ${required}. No file written.`
    );
  }
}

fs.mkdirSync(".patch-backups", { recursive: true });

fs.writeFileSync(
  ".patch-backups/GameScene-before-v504b.ts",
  original,
  "utf8",
);

fs.writeFileSync(FILE, src, "utf8");

console.log("");
console.log("[done] v0.10.10.504b CLIENT");
console.log("[paint] Paint Help bubble is exactly 2 explicit lines");
console.log("[paint] max-content width prevents final-character wrap");
console.log("[blur] desktopScopeHoleMask outside color #000 -> #fff ONLY");
console.log("[SCOPE LOCK] rack-in/radius/X/Y/cameras/aim/fire/blur strength unchanged");
console.log("[SCOPE LOCK] no pre-rack circle logic added");
console.log("[backup] .patch-backups/GameScene-before-v504b.ts");
console.log("Next: npm run build");
