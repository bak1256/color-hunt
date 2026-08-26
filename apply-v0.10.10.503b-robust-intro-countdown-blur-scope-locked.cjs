const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(process.cwd(), "src", "game", "GameScene.ts");
const MARK = "V1010503B_ROBUST_INTRO_COUNTDOWN_BLUR_SCOPE_LOCKED";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt CLIENT project root.");
}

let src = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (src.includes(MARK)) {
  console.log("[skip] v0.10.10.503b already applied");
  process.exit(0);
}

const original = src;

function sha(v) {
  return crypto.createHash("sha256").update(v).digest("hex");
}

function findMethodRange(source, name) {
  const re = new RegExp(`^[ \\t]*private[ \\t]+${name}\\s*\\(`, "m");
  const match = source.match(re);

  if (!match || match.index == null) {
    throw new Error(`${name}() not found. No file written.`);
  }

  const start = match.index;
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

    if (ch === "{") {
      depth += 1;
      continue;
    }

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
  const range = findMethodRange(source, name);
  return source.slice(range.start, range.end);
}

function editMethod(name, editor) {
  const range = findMethodRange(src, name);
  const before = src.slice(range.start, range.end);
  const after = editor(before);

  if (before === after) {
    throw new Error(`${name}(): no edit applied. No file written.`);
  }

  src =
    src.slice(0, range.start) +
    after +
    src.slice(range.end);

  console.log("[ok]", name);
}

function replaceExactlyOnce(text, before, after, label) {
  const count = text.split(before).length - 1;

  if (count !== 1) {
    throw new Error(
      `${label}: expected 1 match inside method, found ${count}. No file written.`,
    );
  }

  return text.replace(before, after);
}

/* ============================================================
 * HARD LOCK: physical sniper/rack/camera/mask movement methods.
 * ============================================================ */
const LOCKED_SCOPE_METHODS = [
  "enterSniperCinematic",
  "startSniperScopeRackIn",
  "createSniperScopeCamera",
  "drawLocalSniperScope",
  "syncSniperScopeDom",
  "exitSniperCinematic",
];

const lockedBefore = new Map(
  LOCKED_SCOPE_METHODS.map(
    (name) => [name, sha(getMethod(original, name))],
  ),
);

/* ============================================================
 * 1) HUNT INTRO — edit ONLY showMainMatchHuntIntroText().
 * ============================================================ */
editMethod(
  "showMainMatchHuntIntroText",
  (method) => {
    let out = method;

    /* Hunter/Hider both yellow, keeping existing black Webkit stroke. */
    const colorRegex =
      /color:\s*localIsHunter\s*\?\s*'#ffd85a'\s*:\s*'#ffffff',/m;

    if (colorRegex.test(out)) {
      out = out.replace(
        colorRegex,
        `color:
                    '#ffd85a',`,
      );
    } else if (!out.includes("color:\n                    '#ffd85a',")) {
      throw new Error(
        "showMainMatchHuntIntroText(): role-color anchor not found.",
      );
    }

    /*
     * There may be another 0.105/0.115 block elsewhere in GameScene, which
     * caused 503 to fail. Here we are INSIDE this exact method only.
     */
    const positionRegex =
      /this\.mobileControlsEnabled\s*\?\s*0\.105\s*:\s*0\.115/m;

    if (!positionRegex.test(out)) {
      throw new Error(
        "showMainMatchHuntIntroText(): intro-position anchor not found.",
      );
    }

    out = out.replace(
      positionRegex,
      `this.mobileControlsEnabled
                                            ? 0.225
                                            : 0.235`,
    );

    return out;
  },
);

/* ============================================================
 * 2) COUNTDOWN INITIAL STYLE — createCountdownUi().
 * ============================================================ */
editMethod(
  "createCountdownUi",
  (method) => {
    let out = method;

    out = replaceExactlyOnce(
      out,
      `                    color: '#1f2937',
                    backgroundColor:
                        'rgba(255, 244, 214, 0.68)',`,
      `                    color: '#ffd85a',
                    stroke: '#111111',
                    strokeThickness: 8,
                    backgroundColor:
                        'rgba(0,0,0,0)',`,
      "createCountdownUi high-contrast style",
    );

    return out;
  },
);

/* ============================================================
 * 3) COUNTDOWN LIVE RESET — updateCountdownUi().
 * This prevents Finished WIN/LOSE styling leaking into next 3/2/1.
 * ============================================================ */
editMethod(
  "updateCountdownUi",
  (method) => {
    let out = method;

    const oldBlock =
`        this.countdownText
            .setFontSize(110)
            .setColor('#1f2937')
            .setText(`;

    if (!out.includes(oldBlock)) {
      throw new Error(
        "updateCountdownUi(): live countdown anchor not found.",
      );
    }

    out = out.replace(
      oldBlock,
`        this.countdownText
            /*
             * ${MARK} / COUNTDOWN_HIGH_CONTRAST
             */
            .setBackgroundColor('rgba(0,0,0,0)')
            .setPadding(0)
            .setFontFamily(
                '"Arial Black", "Noto Sans KR", "Noto Sans JP", Arial, sans-serif',
            )
            .setFontStyle('bold')
            .setFontSize(
                this.mobileControlsEnabled
                    ? 92
                    : 110,
            )
            .setColor('#ffd85a')
            .setStroke('#111111', 8)
            .setShadow(
                0,
                4,
                'rgba(0,0,0,.62)',
                6,
                true,
                true,
            )
            .setScale(1)
            .setAngle(0)
            .setPosition(
                this.gameWidth / 2,
                this.gameHeight / 2,
            )
            .setAlpha(1)
            .setText(`
    );

    return out;
  },
);

/* ============================================================
 * 4) OUTSIDE SCOPE BLUR — CSS strength ONLY in ensureSniperScopeDom().
 *
 * No mask/radius/position/rack/camera changes.
 * ============================================================ */
const ensureBefore = getMethod(src, "ensureSniperScopeDom");

editMethod(
  "ensureSniperScopeDom",
  (method) => {
    let out = method;

    const desktopOld =
      `: 'blur(5px) brightness(0.76) saturate(0.82)'`;

    const mobileOld =
      `? 'blur(2px) brightness(0.74) saturate(0.84)'`;

    const desktopCount =
      out.split(desktopOld).length - 1;
    const mobileCount =
      out.split(mobileOld).length - 1;

    /* Expected twice each: backdropFilter + webkitBackdropFilter. */
    if (desktopCount !== 2 || mobileCount !== 2) {
      throw new Error(
        `ensureSniperScopeDom(): blur anchors unexpected ` +
        `(desktop=${desktopCount}, mobile=${mobileCount}). No file written.`,
      );
    }

    out = out
      .replaceAll(
        mobileOld,
        `? 'blur(3px) brightness(0.70) saturate(0.80)'`,
      )
      .replaceAll(
        desktopOld,
        `: 'blur(7px) brightness(0.70) saturate(0.78)'`,
      );

    return out;
  },
);

const ensureAfter = getMethod(src, "ensureSniperScopeDom");

/* Guard: only blur strings may change inside ensureSniperScopeDom. */
function normalizeBlurStrength(method) {
  return method
    .replace(
      /blur\(\d+px\) brightness\(0\.\d+\) saturate\(0\.\d+\)/g,
      "BLUR_STRENGTH",
    );
}

if (
  normalizeBlurStrength(ensureBefore) !==
  normalizeBlurStrength(ensureAfter)
) {
  throw new Error(
    "[SCOPE CSS GUARD] ensureSniperScopeDom changed beyond blur strength. No file written.",
  );
}

/* Physical sniper methods must remain byte-identical. */
for (const name of LOCKED_SCOPE_METHODS) {
  const after = sha(getMethod(src, name));

  if (after !== lockedBefore.get(name)) {
    throw new Error(
      `[SCOPE LOCK VIOLATION] ${name}() changed. ABORT. No file written.`,
    );
  }
}

src =
  `/* ${MARK}: robust Hunt intro/countdown + CSS-strength-only sniper outside blur. Physical scope subsystem LOCKED. */\n` +
  src;

for (const required of [
  MARK,
  "COUNTDOWN_HIGH_CONTRAST",
  "? 0.225",
  ": 0.235",
  "blur(7px) brightness(0.70) saturate(0.78)",
]) {
  if (!src.includes(required)) {
    throw new Error(
      `Verification failed: ${required}. No file written.`,
    );
  }
}

fs.mkdirSync(".patch-backups", { recursive: true });
fs.writeFileSync(
  ".patch-backups/GameScene-before-v503b.ts",
  original,
  "utf8",
);
fs.writeFileSync(FILE, src, "utf8");

console.log("");
console.log("[done] v0.10.10.503b CLIENT");
console.log("[intro] Hunter + Hider intro both yellow/black and moved below timer");
console.log("[countdown] 3/2/1 yellow + thick black outline, style reset every countdown tick");
console.log("[blur] desktop 7px / mobile 3px outside-lens blur");
console.log("[SCOPE LOCK] rack-in/camera/mask/radius/aim/fire methods byte-identical");
console.log("[SCOPE GUARD] ensureSniperScopeDom changed ONLY blur strength strings");
console.log("[safe] no server/reconnect/READY/paint gameplay changes");
console.log("Next: npm run build");
