const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'src', 'game', 'GameScene.ts');
const MARK = 'V1010565O_DESKTOP_HUNTER_CURSOR_VISIBLE';

function fail(message) {
  throw new Error(`${message} No file written.`);
}

if (!fs.existsSync(FILE)) {
  fail(`Missing ${FILE}. Run from C:\\Users\\bak12\\color-hunt.`);
}

let src = fs.readFileSync(FILE, 'utf8');
const original = src;

if (src.includes(MARK)) {
  console.log('[skip] v0.10.10.565o already applied.');
  process.exit(0);
}

if (!src.includes('private syncDesktopHiderCursor(): void {')) {
  fail('syncDesktopHiderCursor() not found. Apply the desktop Hider cursor fix first.');
}

function findMethodRange(source, name) {
  const start = source.indexOf(`    private ${name}`);
  if (start < 0) fail(`${name}() not found.`);

  const brace = source.indexOf('{', start);
  if (brace < 0) fail(`${name}() opening brace not found.`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1] ?? '';

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: i + 1 };
    }
  }

  fail(`${name}() closing brace not found.`);
}

const range = findMethodRange(src, 'syncDesktopHiderCursor');
let method = src.slice(range.start, range.end);

const desiredCursorRegex =
  /const\s+desiredCursor\s*=\s*localIsHider\s*\?\s*['"]default['"]\s*:\s*['"]none['"]\s*;/m;

if (!desiredCursorRegex.test(method)) {
  if (/const\s+desiredCursor\s*=\s*['"]default['"]\s*;/m.test(method)) {
    console.log('[info] Hunter cursor already appears visible; adding durable marker only.');
  } else {
    fail('Expected Hider/Hunter desiredCursor policy not found in syncDesktopHiderCursor().');
  }
} else {
  method = method.replace(
    desiredCursorRegex,
`/*
         * ${MARK}
         * Desktop cursor policy is now intentionally identical for BOTH roles.
         * Hunter still keeps the in-game aim/crosshair visuals, but the native
         * OS mouse cursor must never disappear after Sniper/Vulcan teardown,
         * reconnect, role recovery, or a later Hunt round.
         */
        const desiredCursor =
            'default';`,
  );
}

src = src.slice(0, range.start) + method + src.slice(range.end);

/* Update the nearby old comment if present; behavior does not depend on this. */
src = src.replace(
  'desktop Hiders always keep a visible native mouse cursor in Hunt.',
  'desktop Hiders and Hunters always keep a visible native mouse cursor in Hunt.',
);

if (!src.includes(MARK)) {
  src = `/* ${MARK}: desktop Hunter and Hider native cursor always visible during Hunt; tactical visuals/mechanics unchanged. */\n` + src;
}

/* Safety: the per-frame sync must still be wired and the old Hunter-none policy gone. */
if (!src.includes('this.syncDesktopHiderCursor();')) {
  fail('Per-frame desktop cursor sync call is missing after edit.');
}

const updatedRange = findMethodRange(src, 'syncDesktopHiderCursor');
const updatedMethod = src.slice(updatedRange.start, updatedRange.end);

if (!/const\s+desiredCursor\s*=\s*['"]default['"]\s*;/m.test(updatedMethod)) {
  fail('Visible desktop cursor policy was not installed.');
}

if (/localIsHider\s*\?\s*['"]default['"]\s*:\s*['"]none['"]/m.test(updatedMethod)) {
  fail('Old Hunter cursor=none policy still exists.');
}

const backupDir = path.join(process.cwd(), '.patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(
  path.join(backupDir, 'GameScene-before-v0.10.10.565o.ts'),
  original,
  'utf8',
);
fs.writeFileSync(FILE, src, 'utf8');

console.log('');
console.log('[done] v0.10.10.565o DESKTOP HUNTER CURSOR VISIBLE applied');
console.log('[cursor] PC Hider cursor remains visible.');
console.log('[cursor] PC Hunter native mouse cursor is now also always visible during Hunt.');
console.log('[recovery] Sniper/Vulcan teardown and reconnect can no longer leave Hunter cursor hidden.');
console.log('[safe] Hunter crosshair/aim, Sniper scope, firing and tactical logic are untouched.');
console.log('[backup] .patch-backups/GameScene-before-v0.10.10.565o.ts');
console.log('Next: npm run build');
