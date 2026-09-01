const fs = require('fs');
const path = require('path');

const MARK = 'V1010565Q_BOT_ROLE_BALANCE_REWORK';

function fail(message) {
  throw new Error(`${message} No file written.`);
}

function firstExisting(paths) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) return path.resolve(p);
  }
  return '';
}

function countOf(source, token) {
  return source.split(token).length - 1;
}

function replaceRegexOnce(source, regex, replacement, label) {
  const matches = source.match(regex);
  if (!matches) fail(`${label}: source pattern not found.`);
  // Non-global regexes are intentional here; additionally guard with a global clone when possible.
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const all = [...source.matchAll(new RegExp(regex.source, flags))];
  if (all.length !== 1) fail(`${label}: expected exactly 1 match, found ${all.length}.`);
  const next = source.replace(regex, replacement);
  if (next === source) fail(`${label}: replacement produced no change.`);
  console.log(`[ok] ${label}`);
  return next;
}

function replaceMethod(source, startNeedle, endNeedle, replacement, label) {
  const start = source.indexOf(startNeedle);
  if (start < 0) fail(`${label}: method start not found.`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  if (end < 0) fail(`${label}: method end anchor not found.`);
  const existing = source.slice(start, end);
  if (existing.includes(MARK)) {
    console.log(`[skip] ${label} already contains marker`);
    return source;
  }
  console.log(`[ok] ${label}`);
  return source.slice(0, start) + replacement + '\n\n' + source.slice(end);
}

const cwd = process.cwd();
const clientFile = firstExisting([
  path.join(cwd, 'src', 'game', 'GameScene.ts'),
  path.join(cwd, '..', 'color-hunt', 'src', 'game', 'GameScene.ts'),
]);
const serverFile = firstExisting([
  path.join(cwd, 'src', 'rooms', 'MyRoom.ts'),
  path.join(cwd, '..', 'color-hunt-server', 'src', 'rooms', 'MyRoom.ts'),
]);

if (!clientFile || !serverFile) {
  fail(
    `Required files not found. Run from color-hunt OR color-hunt-server root.\n` +
    `GameScene=${clientFile || 'MISSING'}\nMyRoom=${serverFile || 'MISSING'}`
  );
}

let game = fs.readFileSync(clientFile, 'utf8');
let server = fs.readFileSync(serverFile, 'utf8');
const gameOriginal = game;
const serverOriginal = server;

const gameHas = game.includes(MARK);
const serverHas = server.includes(MARK);
if (gameHas && serverHas) {
  console.log('[skip] v0.10.10.565q already applied to client + server.');
  process.exit(0);
}
if (gameHas !== serverHas) {
  fail('Partial v565q marker detected in only one repository. Restore the other side or send latest files.');
}

for (const [label, src, tokens] of [
  ['GameScene', game, ['V1010565_BOTS_V1', 'updateHostBotPaintAuthoring', 'getBotDifficulty']],
  ['MyRoom', server, ['V1010565E_BOT_AI_VISUAL_LOBBY_POLISH', 'V1010565J_BACKGROUND_CAMOUFLAGE_SCORE', 'getBotDifficultyConfig', 'getCamouflageStealthScore']],
]) {
  for (const token of tokens) {
    if (!src.includes(token)) fail(`${label}: required baseline token missing: ${token}`);
  }
}

/* -------------------------------------------------------------------------
 * CLIENT / HIDER BOT CAMOUFLAGE
 * EASY   -> old NORMAL
 * NORMAL -> old HARD
 * HARD   -> stronger-than-old-HARD (same dense spacing, finer color fidelity)
 * ---------------------------------------------------------------------- */
{
  const methodStart = game.indexOf('    private updateHostBotPaintAuthoring');
  const methodEnd = game.indexOf('\n    private ', methodStart + 20);
  if (methodStart < 0 || methodEnd < 0) fail('GameScene: could not isolate updateHostBotPaintAuthoring().');
  let method = game.slice(methodStart, methodEnd);

  const cfgRe = /const cfg\s*=\s*difficulty === 'easy'\s*\?\s*\{\s*step:\s*5,\s*baseSize:\s*12,\s*quant:\s*40,\s*noise:\s*24\s*\}\s*:\s*difficulty === 'hard'\s*\?\s*\{\s*step:\s*2,\s*baseSize:\s*6,\s*quant:\s*8,\s*noise:\s*3\s*\}\s*:\s*\{\s*step:\s*3,\s*baseSize:\s*8,\s*quant:\s*20,\s*noise:\s*10\s*\s*\};/m;

  if (!cfgRe.test(method)) {
    fail('GameScene: expected v565 bot-paint difficulty config not found inside updateHostBotPaintAuthoring().');
  }

  method = method.replace(
    cfgRe,
`/* ${MARK}: Hider difficulty is intentionally stronger than Hunter difficulty. */
            const cfg =
                difficulty === 'easy'
                    /* old NORMAL */
                    ? { step: 3, baseSize: 8, quant: 20, noise: 10 }
                    : difficulty === 'hard'
                        /* stronger than old HARD: same dense coverage, almost exact sampled color */
                        ? { step: 2, baseSize: 5, quant: 4, noise: 1 }
                        /* NORMAL = old HARD */
                        : { step: 2, baseSize: 6, quant: 8, noise: 3 };`
  );
  game = game.slice(0, methodStart) + method + game.slice(methodEnd);
  console.log('[ok] client Hider bot camouflage tiers shifted upward');
}

if (!game.includes(MARK)) {
  game = `/* ${MARK}: stronger Hider camouflage tiers; softer/slower Hunter tiers. */\n` + game;
}

/* -------------------------------------------------------------------------
 * SERVER / FALLBACK HIDER PAINT
 * Keeps emergency paint tier ordering aligned if Host authoring is unavailable.
 * ---------------------------------------------------------------------- */
server = replaceRegexOnce(
  server,
  /const cfg = this\.botDifficulty === "easy"\s*\? \{ step: 5, size: 12 \}\s*:\s*this\.botDifficulty === "hard"\s*\? \{ step: 2, size: 6 \}\s*:\s*\{ step: 3, size: 8 \};/m,
`const cfg = this.botDifficulty === "easy"
      /* ${MARK}: fallback EASY = old NORMAL */
      ? { step: 3, size: 8 }
      : this.botDifficulty === "hard"
        /* HARD is slightly denser/smaller than old HARD */
        ? { step: 2, size: 5 }
        /* NORMAL = old HARD */
        : { step: 2, size: 6 };`,
  'server fallback Hider camouflage tiers',
);

/* -------------------------------------------------------------------------
 * SERVER / HUNTER BOT DIFFICULTY
 * All are slower than the human 125 speed.
 * EASY   = truly forgiving
 * NORMAL = around old EASY, but with shorter vision and more camouflage respect
 * HARD   = around old NORMAL, also softened and shorter-ranged
 * ---------------------------------------------------------------------- */
const newDifficultyMethod = `  private getBotDifficultyConfig(): {
    speed: number;
    visionRange: number;
    reactionBaseMs: number;
    stealthPenaltyMs: number;
    memoryMs: number;
    aimErrorRad: number;
    turnRateRad: number;
    hiderFidgetEveryMs: number;
    hiderFidgetDistance: number;
    hiderMoveSpeed: number;
  } {
    /*
     * ${MARK} / ASYMMETRIC_ROLE_BALANCE
     * Hider bots became stronger, while Hunter bots are intentionally slower,
     * shorter-ranged and more respectful of real background camouflage.
     * Human Hunter production speed remains 125; bots never exceed it.
     */
    if (this.botDifficulty === "easy") return {
      speed: 85,
      visionRange: 245,
      reactionBaseMs: 1_650,
      stealthPenaltyMs: 3_000,
      memoryMs: 900,
      aimErrorRad: 18 * Math.PI / 180,
      turnRateRad: 1.0,
      hiderFidgetEveryMs: Number.POSITIVE_INFINITY,
      hiderFidgetDistance: 0,
      hiderMoveSpeed: 0,
    };
    if (this.botDifficulty === "hard") return {
      speed: 110,
      visionRange: 350,
      reactionBaseMs: 720,
      stealthPenaltyMs: 1_850,
      memoryMs: 2_700,
      aimErrorRad: 7 * Math.PI / 180,
      turnRateRad: 2.2,
      hiderFidgetEveryMs: Number.POSITIVE_INFINITY,
      hiderFidgetDistance: 0,
      hiderMoveSpeed: 0,
    };
    return {
      speed: 100,
      visionRange: 300,
      reactionBaseMs: 1_250,
      stealthPenaltyMs: 2_450,
      memoryMs: 1_550,
      aimErrorRad: 13 * Math.PI / 180,
      turnRateRad: 1.45,
      hiderFidgetEveryMs: Number.POSITIVE_INFINITY,
      hiderFidgetDistance: 0,
      hiderMoveSpeed: 0,
    };
  }`;

server = replaceMethod(
  server,
  '  private getBotDifficultyConfig(): {',
  '  private tickBots(): void {',
  newDifficultyMethod,
  'server Hunter difficulty/speed config',
);

/* Narrow the normal visual cone from 72 degrees total -> 60 degrees total. */
{
  const tickStart = server.indexOf('  private tickHunterBot(');
  const tickEnd = server.indexOf('\n  private moveBotToward(', tickStart + 10);
  if (tickStart < 0 || tickEnd < 0) fail('MyRoom: could not isolate tickHunterBot().');
  let tick = server.slice(tickStart, tickEnd);

  const fovCount = countOf(tick, 'const baseHalfFov = 36 * Math.PI / 180;');
  if (fovCount !== 1) fail(`MyRoom tickHunterBot: expected baseHalfFov 36 exactly once, found ${fovCount}.`);
  tick = tick.replace(
    'const baseHalfFov = 36 * Math.PI / 180;',
    `/* ${MARK}: 60-degree base cone instead of 72. */\n    const baseHalfFov = 30 * Math.PI / 180;`
  );

  const thresholdRe = /const stealth = this\.getCamouflageStealthScore\(candidateId, now\);\s*const distanceFactor = Math\.max\(0, Math\.min\(1, candidateDistance \/ cfg\.visionRange\)\);\s*let threshold =\s*cfg\.reactionBaseMs \+\s*stealth \* cfg\.stealthPenaltyMs \+\s*distanceFactor \* 360;/m;
  if (!thresholdRe.test(tick)) {
    fail('MyRoom tickHunterBot: candidate detection threshold block not found.');
  }
  tick = tick.replace(
    thresholdRe,
`const stealth = this.getCamouflageStealthScore(candidateId, now);
      const distanceFactor = Math.max(0, Math.min(1, candidateDistance / cfg.visionRange));

      /*
       * ${MARK} / CAMOUFLAGE_CURVE
       * Real paint-vs-background similarity already dominates stealth (v565j).
       * Give GOOD stationary camouflage an extra nonlinear delay so a close
       * color match is meaningfully safer instead of merely a small bonus.
       */
      const highCamouflageBonusMs =
        stealth > 0.62
          ? ((stealth - 0.62) / 0.38) * cfg.stealthPenaltyMs * 0.55
          : 0;
      let threshold =
        cfg.reactionBaseMs +
        stealth * cfg.stealthPenaltyMs +
        highCamouflageBonusMs +
        distanceFactor * 420;`
  );

  server = server.slice(0, tickStart) + tick + server.slice(tickEnd);
  console.log('[ok] Hunter FOV narrowed and high-camouflage detection delayed');
}

/* Hider-bot stealth nudge follows the new Hider tier mapping too. */
server = replaceRegexOnce(
  server,
  /stealth \+= this\.botDifficulty === "hard" \? 0\.04 : this\.botDifficulty === "easy" \? -0\.04 : 0\.01;/,
  `stealth += this.botDifficulty === "hard" ? 0.08 : this.botDifficulty === "easy" ? 0.01 : 0.04;`,
  'server visual-score Hider bot stealth tier nudge',
);

server = replaceRegexOnce(
  server,
  /stealth \+= this\.botDifficulty === "hard" \? 0\.10 : this\.botDifficulty === "easy" \? -0\.08 : 0\.03;/,
  `stealth += this.botDifficulty === "hard" ? 0.14 : this.botDifficulty === "easy" ? 0.03 : 0.10;`,
  'server fallback-score Hider bot stealth tier nudge',
);

if (!server.includes(MARK)) {
  server = `/* ${MARK}: asymmetric Hider/Hunter bot difficulty rebalance. */\n` + server;
}

/* -------------------------------------------------------------------------
 * Safety checks
 * ---------------------------------------------------------------------- */
for (const [label, src, tokens] of [
  ['GameScene', game, [
    MARK,
    "difficulty === 'easy'",
    '{ step: 3, baseSize: 8, quant: 20, noise: 10 }',
    '{ step: 2, baseSize: 6, quant: 8, noise: 3 }',
    '{ step: 2, baseSize: 5, quant: 4, noise: 1 }',
  ]],
  ['MyRoom', server, [
    MARK,
    'speed: 85',
    'speed: 100',
    'speed: 110',
    'visionRange: 245',
    'visionRange: 300',
    'visionRange: 350',
    'const baseHalfFov = 30 * Math.PI / 180;',
    'highCamouflageBonusMs',
    'visual.score * 0.74',
    'Math.random() < 0.20',
  ]],
]) {
  for (const token of tokens) {
    if (!src.includes(token)) fail(`${label}: safety token missing after rewrite: ${token}`);
  }
}

// Protect core fairness systems from accidental removal.
for (const token of [
  'V1010565G_BOT_HUMANIZED_HUNT',
  'V1010565H_HARDENED_RAGE_LOCK',
  'V1010565I_BOT_ATTENTION_STIMULUS',
  'V1010565J_BACKGROUND_CAMOUFLAGE_SCORE',
  'bot_mercy',
  'rageTargetId',
  'stimulusAttention',
]) {
  if (!server.includes(token)) fail(`MyRoom: protected bot contract missing after rewrite: ${token}`);
}

/* Transactional write only after every transformation succeeds. */
const clientBackupDir = path.join(path.dirname(clientFile), '..', '..', '.patch-backups');
const serverBackupDir = path.join(path.dirname(serverFile), '..', '..', '.patch-backups');
fs.mkdirSync(clientBackupDir, { recursive: true });
fs.mkdirSync(serverBackupDir, { recursive: true });
const clientBackup = path.join(clientBackupDir, 'GameScene-before-v0.10.10.565q.ts');
const serverBackup = path.join(serverBackupDir, 'MyRoom-before-v0.10.10.565q.ts');
fs.writeFileSync(clientBackup, gameOriginal, 'utf8');
fs.writeFileSync(serverBackup, serverOriginal, 'utf8');
fs.writeFileSync(clientFile, game, 'utf8');
fs.writeFileSync(serverFile, server, 'utf8');

console.log('');
console.log('[done] v0.10.10.565q BOT ROLE BALANCE REWORK applied');
console.log('[Hider EASY] old NORMAL camouflage quality');
console.log('[Hider NORMAL] old HARD camouflage quality');
console.log('[Hider HARD] stronger-than-old-HARD color fidelity + stealth nudge');
console.log('[Hunter EASY] speed 85 / range 245 / very slow recognition');
console.log('[Hunter NORMAL] speed 100 / range 300 / roughly old EASY but softer');
console.log('[Hunter HARD] speed 110 / range 350 / roughly old NORMAL but softer');
console.log('[vision] base FOV 72deg -> 60deg; high real camouflage gains extra nonlinear detection delay');
console.log('[safe] mercy/RAGE/attention/no-GPS logic remains intact');
console.log(`[backup client] ${clientBackup}`);
console.log(`[backup server] ${serverBackup}`);
console.log('NEXT:');
console.log('  cd C:\\Users\\bak12\\color-hunt-server && npm run build');
console.log('  cd C:\\Users\\bak12\\color-hunt && npm run build');
