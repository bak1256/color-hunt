const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'src', 'game', 'GameScene.ts');
const MARK = 'V1010565N_SNIPER_ROUND_LIFECYCLE_HARD_RESET';

function fail(message) {
  throw new Error(`${message} No file written.`);
}

if (!fs.existsSync(FILE)) {
  fail(`Missing ${FILE}. Run from the color-hunt CLIENT project root.`);
}

let src = fs.readFileSync(FILE, 'utf8');
const original = src;

if (src.includes(MARK)) {
  console.log('[skip] v0.10.10.565n already applied');
  process.exit(0);
}

/* v565n is intentionally based on the post-v565m sniper renderer. */
for (const token of [
  'V1010565M_SNIPER_STRIP_VIEWPORT_SEAL',
  'private ensureSniperScopeDom(): void {',
  'private startSniperScopeRackIn(): void {',
  'private enterSniperCinematic(): void {',
  'private exitSniperCinematic(): void {',
  'private sniperScopeLastClipRectKey',
]) {
  if (!src.includes(token)) {
    fail(`Expected current sniper token missing: ${token}`);
  }
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
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
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

function editMethod(name, editor) {
  const r = findMethodRange(src, name);
  const before = src.slice(r.start, r.end);
  const after = editor(before);
  if (after === before) fail(`${name}(): expected edit anchor not found.`);
  src = src.slice(0, r.start) + after + src.slice(r.end);
  console.log(`[ok] edited ${name}()`);
}

/* -------------------------------------------------------------------------
 * 1) Register only ONE scene-shutdown cleanup listener even though the scope
 *    DOM is now intentionally recreated on every sniper use.
 * ---------------------------------------------------------------------- */
const fieldAnchor = `    private sniperScopeLastClipRectKey = '';`;
if (!src.includes(fieldAnchor)) {
  fail('sniperScopeLastClipRectKey field anchor missing.');
}
src = src.replace(
  fieldAnchor,
`${fieldAnchor}
    /* ${MARK} / ONE_SHUTDOWN_LISTENER */
    private sniperScopeShutdownCleanupRegistered = false;`,
);

/* -------------------------------------------------------------------------
 * 2) Add one authoritative cleanup helper before ensureSniperScopeDom().
 *
 * Why this exists:
 * - first sniper use was clean
 * - second+ use reused the same masked backdrop DOM
 * - the 32 strip cameras could also survive by name if an older path lost
 *   array ownership
 *
 * Rebuilding the optical render epoch per use is cheaper and safer than trying
 * to resurrect compositor state from the previous round.
 * ---------------------------------------------------------------------- */
const ensureAnchor = `    private ensureSniperScopeDom(): void {`;
const ensureIndex = src.indexOf(ensureAnchor);
if (ensureIndex < 0) fail('ensureSniperScopeDom() anchor missing.');

const helper = `    /*
     * ${MARK}
     * A sniper session owns a disposable render epoch.
     *
     * The physical scope look is NOT changed here: blur strength, circular
     * mask, reticle, 2.7x desktop magnification and strip count remain owned
     * by the existing renderer. This helper only destroys previous-round
     * browser/compositor/camera state so round 2 starts as clean as round 1.
     */
    private destroySniperScopeRoundRenderState(): void {
        this.sniperScopeIntroTween
            ?.stop();
        this.sniperScopeIntroTween =
            undefined;

        /* Remove every strip that is still tracked normally. */
        this.sniperScopeStripCameras
            .forEach(
                (camera) => {
                    try {
                        this.cameras.remove(
                            camera,
                            true,
                        );
                    } catch {
                        // Camera may already have been removed by another exit path.
                    }
                },
            );

        this.sniperScopeStripCameras =
            [];

        /*
         * Defensive orphan sweep.
         * Old round/transition code historically used several local sniper
         * camera names. Remove them by name even if array/reference ownership
         * was lost. Bounded retries also handle accidental duplicate names.
         */
        const staleCameraNames: string[] = [
            'sniper-overwatch-camera',
            'sniper-scope-camera',
        ];

        for (
            let index = 0;
            index < 64;
            index += 1
        ) {
            staleCameraNames.push(
                'sniper-overwatch-strip-' +
                    String(index),
            );
        }

        staleCameraNames.forEach(
            (cameraName) => {
                for (
                    let attempt = 0;
                    attempt < 8;
                    attempt += 1
                ) {
                    const stale =
                        this.cameras.getCamera(
                            cameraName,
                        );

                    if (!stale) {
                        break;
                    }

                    if (
                        stale ===
                        this.cameras.main
                    ) {
                        break;
                    }

                    try {
                        this.cameras.remove(
                            stale,
                            true,
                        );
                    } catch {
                        break;
                    }
                }
            },
        );

        if (this.sniperScopeCamera) {
            try {
                this.cameras.remove(
                    this.sniperScopeCamera,
                    true,
                );
            } catch {
                // Already removed.
            }
            this.sniperScopeCamera =
                undefined;
        }

        this.sniperScopeMaskGraphics
            ?.destroy();
        this.sniperScopeMaskGraphics =
            undefined;

        this.sniperScopeCornerMask
            ?.clear()
            .setVisible(false);

        /*
         * Cancel any Web Animations still attached to the old optic before the
         * subtree is detached. The recoil animation is intentionally retained
         * during a live session; it is cancelled only at session teardown.
         */
        [
            this.sniperScopeClipDom,
            this.sniperScopeBlurDom,
            this.sniperScopeLensShieldDom,
            this.sniperScopeRackInBlackoutDom,
            this.sniperScopeDom,
            this.sniperScopeReloadDom,
            this.sniperPriorityTimerDom,
            this.sniperMobileHintDom,
        ].forEach(
            (element) => {
                if (!element) {
                    return;
                }

                try {
                    element
                        .getAnimations()
                        .forEach(
                            (animation) => {
                                try {
                                    animation.cancel();
                                } catch {
                                    // Ignore an already-finished animation.
                                }
                            },
                        );
                } catch {
                    // getAnimations may be unavailable in an older webview.
                }
            },
        );

        this.sniperScopeClipDom
            ?.remove();

        this.sniperScopeClipDom =
            undefined;
        this.sniperScopeBlurDom =
            undefined;
        this.sniperScopeLensShieldDom =
            undefined;
        this.sniperScopeRackInBlackoutDom =
            undefined;
        this.sniperPriorityTimerDom =
            undefined;
        this.sniperMobileHintDom =
            undefined;
        this.sniperScopeDom =
            undefined;
        this.sniperScopeReloadDom =
            undefined;

        /* Force a brand-new mask + canvas-rect commit for the next use. */
        this.sniperScopeLastAppliedMask =
            '';
        this.sniperScopeLastClipRectKey =
            '';
        this.mobileSniperScopeDirty =
            true;
    }

`;

src = src.slice(0, ensureIndex) + helper + src.slice(ensureIndex);
console.log('[ok] added destroySniperScopeRoundRenderState()');

/* -------------------------------------------------------------------------
 * 3) ensureSniperScopeDom(): keep a single Scene.SHUTDOWN listener.
 *    Recreating the DOM every round must NOT accumulate one listener per use.
 * ---------------------------------------------------------------------- */
editMethod('ensureSniperScopeDom', (method) => {
  const listenerStart = method.indexOf(
`        this.events.once(
            Phaser.Scenes.Events.SHUTDOWN,`
  );

  if (listenerStart < 0) {
    throw new Error('ensureSniperScopeDom: existing SHUTDOWN listener not found.');
  }

  /* Find the listener statement terminator by scanning parentheses. */
  let i = listenerStart;
  let parenDepth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let listenerEnd = -1;

  for (; i < method.length; i += 1) {
    const ch = method[i];
    const next = method[i + 1] ?? '';

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

    if (ch === '(') parenDepth += 1;
    else if (ch === ')') parenDepth -= 1;

    if (parenDepth === 0 && ch === ';' && i > listenerStart) {
      listenerEnd = i + 1;
      break;
    }
  }

  if (listenerEnd < 0) {
    throw new Error('ensureSniperScopeDom: SHUTDOWN listener end not found.');
  }

  const before = method.slice(0, listenerStart);
  const after = method.slice(listenerEnd);

  const replacement =
`        /* ${MARK} / ONE_SHUTDOWN_LISTENER */
        if (
            !this.sniperScopeShutdownCleanupRegistered
        ) {
            this.sniperScopeShutdownCleanupRegistered =
                true;

            this.events.once(
                Phaser.Scenes.Events.SHUTDOWN,
                () => {
                    this.destroySniperScopeRoundRenderState();
                    this.sniperScopeShutdownCleanupRegistered =
                        false;
                },
            );
        }`;

  return before + replacement + after;
});

/* -------------------------------------------------------------------------
 * 4) Fresh render epoch at the start of every sniper cinematic.
 *    This is the key first-round == second-round invariant.
 * ---------------------------------------------------------------------- */
editMethod('enterSniperCinematic', (method) => {
  const anchor =
`        this.sniperCinematicActive =
            true;`;

  if (!method.includes(anchor)) {
    throw new Error('enterSniperCinematic: active-state anchor missing.');
  }

  return method.replace(
    anchor,
`        /*
         * ${MARK} / FRESH_RENDER_EPOCH
         * The first sniper use is the reference state. Before round 2/3/etc,
         * destroy every previous local scope compositor/camera object so the
         * next session begins from the identical empty render state.
         */
        this.destroySniperScopeRoundRenderState();

${anchor}`,
  );
});

/* -------------------------------------------------------------------------
 * 5) Belt-and-suspenders reset immediately before rack-in creates cameras/DOM.
 *    This covers unusual reconnect/phase recovery paths that reach rack-in
 *    without a normal previous exit.
 * ---------------------------------------------------------------------- */
editMethod('startSniperScopeRackIn', (method) => {
  const anchor =
`        this.createSniperScopeCamera();
        this.ensureSniperScopeDom();`;

  if (!method.includes(anchor)) {
    throw new Error('startSniperScopeRackIn: create/ensure anchor missing.');
  }

  return method.replace(
    anchor,
`        /* ${MARK} / PRE_CREATE_CLEAN_EPOCH */
        this.destroySniperScopeRoundRenderState();

${anchor}`,
  );
});

/* -------------------------------------------------------------------------
 * 6) exitSniperCinematic(): after existing ordinary teardown, remove the DOM
 *    subtree itself instead of leaving it display:none for the next round.
 * ---------------------------------------------------------------------- */
editMethod('exitSniperCinematic', (method) => {
  const anchor =
`        this.sniperScopeMaskGraphics?.destroy();
        this.sniperScopeMaskGraphics = undefined;`;

  if (!method.includes(anchor)) {
    throw new Error('exitSniperCinematic: mask cleanup anchor missing.');
  }

  return method.replace(
    anchor,
`${anchor}

        /*
         * ${MARK} / DESTROY_ON_EXIT
         * Do not carry display:none compositor state into the next round.
         * The next sniper use will recreate the same visual DOM from scratch.
         */
        this.destroySniperScopeRoundRenderState();`,
  );
});

/* -------------------------------------------------------------------------
 * Safety checks: scope appearance/mechanics still exist and the new lifecycle
 * reset is wired at start + rack-in + exit.
 * ---------------------------------------------------------------------- */
for (const token of [
  MARK,
  'private destroySniperScopeRoundRenderState(): void {',
  'FRESH_RENDER_EPOCH',
  'PRE_CREATE_CLEAN_EPOCH',
  'DESTROY_ON_EXIT',
  'ONE_SHUTDOWN_LISTENER',
  "? 'blur(3px) brightness(0.70) saturate(0.80)'",
  ": 'blur(7px) brightness(0.70) saturate(0.78)'",
  '? 4\n                : 32',
  '? 3.35\n                : 2.7',
  'V1010565M_SNIPER_STRIP_VIEWPORT_SEAL / RIGHT_NOTCH_REMOVED',
]) {
  if (!src.includes(token)) {
    fail(`Safety assertion missing: ${token}`);
  }
}

/* The right notch must stay removed. */
if (
  /right:\s*['"]-15px['"][\s\S]{0,180}width:\s*['"]20px['"][\s\S]{0,120}height:\s*['"]6px['"]/.test(src)
) {
  fail('Right scope notch unexpectedly exists after v565n.');
}

/* Transactional write after every transformation succeeds. */
const backupDir = path.join(process.cwd(), '.patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(
  path.join(backupDir, 'GameScene-before-v0.10.10.565n.ts'),
  original,
  'utf8',
);
fs.writeFileSync(FILE, src, 'utf8');

console.log('');
console.log('[done] v0.10.10.565n SNIPER ROUND LIFECYCLE HARD RESET applied');
console.log('[root] first sniper use is now the template: every later use starts from a fresh local scope render epoch');
console.log('[dom] old clip/blur/lens/reticle/reload DOM subtree is removed, not reused with display:none');
console.log('[camera] tracked + orphan named sniper strip cameras are removed before recreation');
console.log('[web] old scope Web Animations are cancelled at teardown');
console.log('[round] mask cache + canvas rect cache are cleared for the next sniper use');
console.log('[safe] existing blur strength, circular scope, 32 PC strips, 2.7x PC magnification, aim/fire/reload are unchanged');
console.log('[safe] v565m right-notch removal stays intact');
console.log('[listener] only one Scene.SHUTDOWN cleanup listener is registered despite per-round DOM recreation');
console.log('[backup] .patch-backups/GameScene-before-v0.10.10.565n.ts');
console.log('Next: npm run build');
