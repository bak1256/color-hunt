const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "src", "game", "GameScene.ts");
const MARK = "V1010504C_FIX_DUPLICATE_PAINT_BUBBLE_WIDTH";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt CLIENT project root.");
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.504c already applied");
  process.exit(0);
}

const original = s;

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

const range =
  findMethodRange(
    s,
    "showPaintAssistReadyStyleBubble",
  );

const method =
  s.slice(
    range.start,
    range.end,
  );

const widthToken =
  "                width:'max-content',\n";

const widthCount =
  method.split(widthToken).length - 1;

if (widthCount !== 2) {
  throw new Error(
    `Expected exactly 2 duplicate width:'max-content' declarations in Paint Help bubble, found ${widthCount}. No file written.`
  );
}

/*
 * 504b inserted a new width:max-content while the existing bubble already
 * had one. Remove ONLY the second duplicate declaration.
 */
const firstAt =
  method.indexOf(widthToken);

const secondAt =
  method.indexOf(
    widthToken,
    firstAt + widthToken.length,
  );

if (secondAt < 0) {
  throw new Error(
    "Second duplicate Paint Help width declaration not found. No file written."
  );
}

const fixedMethod =
  method.slice(0, secondAt) +
  method.slice(
    secondAt + widthToken.length,
  );

const widthCountAfter =
  fixedMethod.split(widthToken).length - 1;

if (widthCountAfter !== 1) {
  throw new Error(
    `Paint Help width verification failed: expected 1 after fix, found ${widthCountAfter}. No file written.`
  );
}

/*
 * Safety: this hotfix is forbidden from touching any sniper text/state.
 * It replaces only one line inside showPaintAssistReadyStyleBubble().
 */
s =
  s.slice(0, range.start) +
  fixedMethod +
  s.slice(range.end);

s =
  `/* ${MARK}: remove only duplicate width property introduced by 504b; sniper subsystem untouched. */\n` +
  s;

fs.mkdirSync(
  ".patch-backups",
  { recursive: true },
);

fs.writeFileSync(
  ".patch-backups/GameScene-before-v504c.ts",
  original,
  "utf8",
);

fs.writeFileSync(
  FILE,
  s,
  "utf8",
);

console.log("");
console.log("[done] v0.10.10.504c CLIENT");
console.log("[fix] removed ONE duplicate width:'max-content' from Paint Help bubble");
console.log("[paint] 2-line wording/layout from 504b preserved");
console.log("[sniper] ZERO sniper code touched");
console.log("Next: npm run build");
