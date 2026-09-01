const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'src', 'game', 'GameScene.ts');
const MARK = 'V1010565N2_SNIPER_ROUND_LIFECYCLE_HARD_RESET_ROBUST';

function fail(message) {
  throw new Error(`${message} No file written.`);
}

if (!fs.existsSync(FILE)) {
  fail(`Missing ${FILE}. Run from C:\\Users\\bak12\\color-hunt.`);
}

let src = fs.readFileSync(FILE, 'utf8');
const original = src;

if (src.includes(MARK)) {
  console.log('[skip] v0.10.10.565n2 already applied');
  process.exit(0);
}

/*
 * v565n2 intentionally does NOT require the v565m marker.
 * The lifecycle bug can be fixed safely whether v565m was applied, partially
 * applied, or never applied. Only the live sniper structure is required.
 */
for (const token of [
  'private ensureSniperScopeDom(): void {',
  'private startSniperScopeRackIn(): void {',
  'private enterSniperCinematic(): void {',
  'private exitSniperCinematic(): void {',
  'sniperScopeStripCameras',
  'sniperScopeClipDom',
  'sniperScopeBlurDom',
  'sniperScopeLastAppliedMask',
]) {
  if (!src.includes(token)) {
    fail(`Required current sniper token missing: ${token}`);
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
    else if (ch === '}') {
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
 * 1) One lifetime cleanup-listener flag.
 * ---------------------------------------------------------------------- */
if (!src.includes('private sniperScopeShutdownCleanupRegistered = false;')) {
  const clipKeyAnchor = `    private sniperScopeLastClipRectKey = '';`;
  const maskAnchor = `    private sniperScopeLastAppliedMask = '';`;

  if (src.includes(clipKeyAnchor)) {
    src = src.replace(
      clipKeyAnchor,
`${clipKeyAnchor}
    /* ${MARK} / ONE_SHUTDOWN_LISTENER */
    private sniperScopeShutdownCleanupRegistered = false;`,
    );
  } else if (src.includes(maskAnchor)) {
    src = src.replace(
      maskAnchor,
`${maskAnchor}
    /* ${MARK} / ONE_SHUTDOWN_LISTENER */
    private sniperScopeShutdownCleanupRegistered = false;`,
    );
  } else {
    fail('Could not find sniper mask/clip cache field anchor.');
  }
}

/* -------------------------------------------------------------------------
 * 2) Authoritative disposable render-epoch cleanup helper.
 * ---------------------------------------------------------------------- */
const ensureAnchor = `    private ensureSniperScopeDom(): void {`;
const ensureIndex = src.indexOf(ensureAnchor);
if (ensureIndex < 0) fail('ensureSniperScopeDom() anchor missing.');

if (!src.includes('private destroySniperScopeRoundRenderState(): void {')) {
  const hasClipRectKey = src.includes('private sniperScopeLastClipRectKey');
  const hasMobileDirty = src.includes('private mobileSniperScopeDirty');

  const optionalResets = [
    hasClipRectKey
      ? `        this.sniperScopeLastClipRectKey =\n            '';\n`
      : '',
    hasMobileDirty
      ? `        this.mobileSniperScopeDirty =\n            true;\n`
      : '',
  ].join('');

  const helper = `    /*
     * ${MARK}
     * Each sniper activation owns a disposable browser/WebGL render epoch.
     * Round 2/3/etc must start from the same empty state as round 1.
     * Existing blur strength, circular mask, scope magnification and gameplay
     * mechanics are intentionally left to the normal renderer.
     */
    private destroySniperScopeRoundRenderState(): void {
        this.sniperScopeIntroTween
            ?.stop();
        this.sniperScopeIntroTween =
            undefined;

        this.sniperScopeStripCameras
            .forEach(
                (camera) => {
                    try {
                        this.cameras.remove(
                            camera,
                            true,
                        );
                    } catch {
                        // Already removed by another teardown path.
                    }
                },
            );

        this.sniperScopeStripCameras =
            [];

        /* Defensive orphan sweep for older/partial sniper lifecycles. */
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

                    if (
                        !stale ||
                        stale === this.cameras.main
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

        /* Cancel any stale recoil/rack-in Web Animations before DOM removal. */
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
                if (!element) return;
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
                    // Older webviews may not expose getAnimations().
                }
            },
        );

        /* clipRoot normally owns the whole optical subtree. */
        this.sniperScopeClipDom
            ?.remove();

        /* Defensive removal if an old version mounted one outside clipRoot. */
        this.sniperPriorityTimerDom
            ?.remove();
        this.sniperMobileHintDom
            ?.remove();
        this.sniperScopeDom
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

        this.sniperScopeLastAppliedMask =
            '';
${optionalResets}    }

`;

  src = src.slice(0, ensureIndex) + helper + src.slice(ensureIndex);
  console.log('[ok] added destroySniperScopeRoundRenderState()');
}

/* -------------------------------------------------------------------------
 * 3) ensureSniperScopeDom(): replace the per-DOM SHUTDOWN listener with a
 *    single scene-lifetime listener. This prevents one listener per round.
 * ---------------------------------------------------------------------- */
editMethod('ensureSniperScopeDom', (method) => {
  if (method.includes(`${MARK} / ONE_SHUTDOWN_LISTENER`)) {
    return method;
  }

  const listenerStart = method.indexOf(
`        this.events.once(
            Phaser.Scenes.Events.SHUTDOWN,`
  );

  if (listenerStart < 0) {
    throw new Error('ensureSniperScopeDom: existing SHUTDOWN listener not found.');
  }

  let parenDepth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let listenerEnd = -1;

  for (let i = listenerStart; i < method.length; i += 1) {
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

  return (
    method.slice(0, listenerStart) +
    replacement +
    method.slice(listenerEnd)
  );
});

/* -------------------------------------------------------------------------
 * 4) Fresh render epoch immediately before a new sniper cinematic becomes
 *    active. First-round state becomes the template for every later round.
 * ---------------------------------------------------------------------- */
editMethod('enterSniperCinematic', (method) => {
  if (method.includes(`${MARK} / FRESH_RENDER_EPOCH`)) return method;

  const anchor =
`        this.sniperCinematicActive =
            true;`;

  if (!method.includes(anchor)) {
    throw new Error('enterSniperCinematic: active-state anchor missing.');
  }

  return method.replace(
    anchor,
`        /* ${MARK} / FRESH_RENDER_EPOCH */
        this.destroySniperScopeRoundRenderState();

${anchor}`,
  );
});

/* -------------------------------------------------------------------------
 * 5) Reconnect/phase-recovery safety: clean once more immediately before the
 *    normal rack-in renderer creates its cameras + DOM.
 * ---------------------------------------------------------------------- */
editMethod('startSniperScopeRackIn', (method) => {
  if (method.includes(`${MARK} / PRE_CREATE_CLEAN_EPOCH`)) return method;

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
 * 6) Hard-destroy browser/WebGL render state at sniper exit instead of leaving
 *    display:none state to be reused in round 2.
 * ---------------------------------------------------------------------- */
editMethod('exitSniperCinematic', (method) => {
  if (method.includes(`${MARK} / DESTROY_ON_EXIT`)) return method;

  const phaseRestore = `        if (this.phase === 'hunt') {`;
  const at = method.lastIndexOf(phaseRestore);
  if (at < 0) {
    throw new Error('exitSniperCinematic: final Hunt camera restore anchor missing.');
  }

  return (
    method.slice(0, at) +
`        /* ${MARK} / DESTROY_ON_EXIT */
        this.destroySniperScopeRoundRenderState();

` +
    method.slice(at)
  );
});

/* -------------------------------------------------------------------------
 * 7) Remove the right optic notch if it still exists. This is safe whether
 *    v565m was applied or not and does not alter the center crosshair.
 * ---------------------------------------------------------------------- */
if (/right:\s*['"]-15px['"]/.test(src)) {
  const rightNotch = /\n\s*\{\s*\n\s*right:\s*['"]-15px['"],\s*\n\s*top:\s*['"]50%['"],\s*\n\s*width:\s*['"]20px['"],\s*\n\s*height:\s*['"]6px['"],\s*\n\s*transform:\s*['"]translateY\(-50%\)['"],\s*\n\s*\},/m;

  if (!rightNotch.test(src)) {
    fail('Right scope notch exists but exact safe object shape was not found.');
  }

  src = src.replace(
    rightNotch,
`\n            /* ${MARK} / RIGHT_NOTCH_REMOVED */`,
  );
  console.log('[ok] removed right scope notch');
} else {
  console.log('[ok] right scope notch already absent');
}

/* Top marker only after all transformations succeeded. */
src =
`/* ${MARK}: disposable sniper DOM/camera render epoch per activation; supports pre/post-v565m sources. */\n` +
src;

/* Conservative safety checks: mechanics/visual declarations must still exist. */
for (const token of [
  MARK,
  'private destroySniperScopeRoundRenderState(): void {',
  'FRESH_RENDER_EPOCH',
  'PRE_CREATE_CLEAN_EPOCH',
  'DESTROY_ON_EXIT',
  'ONE_SHUTDOWN_LISTENER',
  'sniperScopeStripCameras',
  'backdropFilter:',
  'sniperScopeLastAppliedMask',
]) {
  if (!src.includes(token)) {
    fail(`Safety assertion missing after edit: ${token}`);
  }
}

if (/right:\s*['"]-15px['"]/.test(src)) {
  fail('Right scope notch still exists after v565n2.');
}

if (!/blur\(7px\)/.test(src)) {
  fail('Desktop sniper blur(7px) declaration appears missing.');
}

if (!/\b32\b/.test(src) || !/\b2\.7\b/.test(src)) {
  fail('Expected existing PC strip count / magnification tokens are missing.');
}

const backupDir = path.join(process.cwd(), '.patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(
  path.join(backupDir, 'GameScene-before-v0.10.10.565n2.ts'),
  original,
  'utf8',
);
fs.writeFileSync(FILE, src, 'utf8');

console.log('');
console.log('[done] v0.10.10.565n2 SNIPER ROUND LIFECYCLE HARD RESET ROBUST applied');
console.log(`[source] v565m marker detected: ${original.includes('V1010565M_SNIPER_STRIP_VIEWPORT_SEAL') ? 'YES' : 'NO (not required)'}`);
console.log('[round] every sniper activation now starts with fresh scope DOM + fresh strip cameras');
console.log('[exit] old blur/mask/reticle DOM and stale Web Animations are physically removed');
console.log('[camera] tracked and orphan named sniper cameras are removed before reuse');
console.log('[listener] Scene.SHUTDOWN cleanup listener no longer accumulates each round');
console.log('[reticle] right-side notch is removed whether or not v565m was previously applied');
console.log('[safe] existing blur(7px), 32-strip structure, 2.7x magnification, aim/fire/reload stay owned by current renderer');
console.log('[backup] .patch-backups/GameScene-before-v0.10.10.565n2.ts');
console.log('Next: npm run build');
