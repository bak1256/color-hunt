const fs = require('fs');
const path = require('path');

const MARK = 'V1010565L_SNIPER_OUTSIDE_BACKDROP_STABILITY';
const FILE = path.join(process.cwd(), 'src', 'game', 'GameScene.ts');

function fail(msg) {
  throw new Error(`${msg} No file written.`);
}

function countOf(s, needle) {
  return s.split(needle).length - 1;
}

function replaceOnce(s, before, after, label) {
  const n = countOf(s, before);
  if (n !== 1) {
    fail(`${label}: expected exactly 1 match, found ${n}.`);
  }
  return s.replace(before, after);
}

if (!fs.existsSync(FILE)) {
  fail(`Missing ${FILE}. Run from C:\\Users\\bak12\\color-hunt.`);
}

let s = fs.readFileSync(FILE, 'utf8');
const original = s;

if (s.includes(MARK)) {
  console.log('[skip] v0.10.10.565l already applied.');
  process.exit(0);
}

if (!s.includes('V1010565J_BACKGROUND_CAMOUFLAGE_SCORE')) {
  fail('v565j marker missing. Apply through v0.10.10.565j first.');
}

for (const token of [
  'V1010551_RECONNECT_AUTHORITY_SNIPER_BACKDROP_STABILITY',
  'private syncSniperScopeDom(): void {',
  'private updateSniperCinematicFrame(): void {',
  'private fireSniperAtCurrentAim(): void {',
  'private showSniperImpact(shot: NetworkSniperFired): void {',
]) {
  if (!s.includes(token)) {
    fail(`required current sniper anchor missing: ${token}`);
  }
}

/* -------------------------------------------------------------------------
 * 1) Full-screen DOM backdrop geometry cache.
 *
 * syncSniperScopeDom() runs every frame. The moving circular mask really does
 * need updates, but the full-canvas clipRoot normally has identical left/top/
 * width/height for hundreds of frames. Rewriting that geometry can invalidate
 * Chrome's backdrop-filter compositor layer and briefly expose a differently
 * scaled previous canvas frame. Cache ONLY the root rectangle; optic/mask
 * position, blur strength and scope geometry remain untouched.
 * ---------------------------------------------------------------------- */
s = replaceOnce(
  s,
`    private sniperScopeBlurDom?: HTMLDivElement;
    private sniperScopeLastAppliedMask = '';
    private sniperScopeLensShieldDom?: HTMLDivElement;`,
`    private sniperScopeBlurDom?: HTMLDivElement;
    private sniperScopeLastAppliedMask = '';
    /* ${MARK}: avoid re-laying out the full-screen blur root every frame. */
    private sniperScopeLastClipRectKey = '';
    private sniperScopeLensShieldDom?: HTMLDivElement;`,
  'sniper clip rect cache field',
);

s = replaceOnce(
  s,
`        if (clipRoot) {
            clipRoot.style.display =
                '';

            clipRoot.style.left =
                String(
                    Math.round(
                        rect.left,
                    ),
                ) +
                'px';

            clipRoot.style.top =
                String(
                    Math.round(
                        rect.top,
                    ),
                ) +
                'px';

            clipRoot.style.width =
                String(
                    Math.round(
                        rect.width,
                    ),
                ) +
                'px';

            clipRoot.style.height =
                String(
                    Math.round(
                        rect.height,
                    ),
                ) +
                'px';
        }`,
`        if (clipRoot) {
            if (clipRoot.style.display === 'none') {
                clipRoot.style.display = '';
            }

            const clipLeft = Math.round(rect.left);
            const clipTop = Math.round(rect.top);
            const clipWidth = Math.round(rect.width);
            const clipHeight = Math.round(rect.height);
            const clipRectKey =
                clipLeft + ':' +
                clipTop + ':' +
                clipWidth + ':' +
                clipHeight;

            /*
             * ${MARK} / STATIC_BLUR_ROOT
             * Do not dirty layout/compositing unless the actual canvas CSS rect
             * changed (resize/orientation/fullscreen). The moving scope/mask is
             * still updated by the existing code below.
             */
            if (
                this.sniperScopeLastClipRectKey !==
                    clipRectKey
            ) {
                clipRoot.style.left = clipLeft + 'px';
                clipRoot.style.top = clipTop + 'px';
                clipRoot.style.width = clipWidth + 'px';
                clipRoot.style.height = clipHeight + 'px';
                this.sniperScopeLastClipRectKey =
                    clipRectKey;
            }
        }`,
  'cache full-screen sniper blur root geometry',
);

/* -------------------------------------------------------------------------
 * 2) Main-camera ownership during active scope.
 *
 * Existing code already corrected zoom/scroll only when they drifted, but it
 * still called stopFollow/removeBounds/setSize EVERY frame. setSize dirties the
 * Phaser camera viewport and can force the same canvas/backdrop compositor to
 * rebuild. Move every camera mutation behind the drift test. Scope camera and
 * DOM blur are not touched.
 * ---------------------------------------------------------------------- */
s = replaceOnce(
  s,
`            overwatchCamera
                .stopFollow()
                .removeBounds()
                .setSize(
                    this.gameWidth,
                    this.gameHeight,
                );

            if (
                Math.abs(
                    overwatchCamera.zoom -
                        1,
                ) >
                    0.0001 ||
                Math.abs(
                    overwatchCamera.scrollX,
                ) >
                    0.01 ||
                Math.abs(
                    overwatchCamera.scrollY,
                ) >
                    0.01
            ) {
                overwatchCamera
                    .setZoom(
                        1,
                    )
                    .setScroll(
                        0,
                        0,
                    );

                this.applyFixedHudForZoom(
                    1,
                );
            }`,
`            const backdropCameraDrifted =
                Math.abs(
                    overwatchCamera.zoom -
                        1,
                ) >
                    0.0001 ||
                Math.abs(
                    overwatchCamera.scrollX,
                ) >
                    0.01 ||
                Math.abs(
                    overwatchCamera.scrollY,
                ) >
                    0.01 ||
                Math.abs(
                    overwatchCamera.rotation,
                ) >
                    0.0001 ||
                Math.abs(
                    overwatchCamera.width -
                        this.gameWidth,
                ) >
                    0.01 ||
                Math.abs(
                    overwatchCamera.height -
                        this.gameHeight,
                ) >
                    0.01;

            if (backdropCameraDrifted) {
                /*
                 * ${MARK} / WRITE_ONLY_ON_DRIFT
                 * Stable frame = ZERO main-camera writes. This keeps the
                 * backdrop-filter sampling the same canvas transform frame to
                 * frame. Reconnect/foreign camera drift is still repaired.
                 */
                overwatchCamera
                    .stopFollow()
                    .removeBounds()
                    .setSize(
                        this.gameWidth,
                        this.gameHeight,
                    )
                    .setRotation(0)
                    .setZoom(1)
                    .setScroll(0, 0);

                this.applyFixedHudForZoom(1);
            }`,
  'sniper active main camera write-on-drift',
);

/* Lock the completed whole-map transition to a neutral rotation too. This is
 * a one-time transition write and does not alter the existing 1.05s zoom path.
 */
s = replaceOnce(
  s,
`                        .setZoom(
                            1,
                        )
                        .setScroll(
                            0,
                            0,
                        );

                    this.applyFixedHudForZoom(
                        1,
                    );`,
`                        .setRotation(0)
                        .setZoom(
                            1,
                        )
                        .setScroll(
                            0,
                            0,
                        );

                    this.applyFixedHudForZoom(
                        1,
                    );`,
  'sniper full-map final neutral rotation',
);

/* -------------------------------------------------------------------------
 * 3) Recoil must stay INSIDE the scope.
 *
 * The current PC shot performs both:
 *   - full MAIN camera shake (moves the blurred outside map)
 *   - scope camera shake (actual optic recoil)
 * That first shake is exactly an outside-background transform during a masked
 * backdrop-filter. Remove only the full-map shake; keep DOM recoil animation
 * and sniperScopeCamera shake unchanged.
 * ---------------------------------------------------------------------- */
s = replaceOnce(
  s,
`        /*
         * V1010455C_SNIPER_MOBILE_CONTROLS_PC_HELI_FLICKER_FIRE_PERF
         * Mobile keeps optic recoil but skips expensive full-canvas shake.
         */
        if (
            !this.mobileControlsEnabled
        ) {
            this.cameras.main.shake(
                210,
                0.016,
            );
        }

        this.sniperScopeCamera
            ?.shake(`,
`        /*
         * ${MARK} / SCOPE_ONLY_RECOIL
         * Keep recoil in the optic. Never shake the full-map camera while the
         * masked outside backdrop is active; that shake can look like a one-
         * frame zoom/pop through Chrome backdrop compositing.
         */
        this.sniperScopeCamera
            ?.shake(`,
  'remove local sniper full-map recoil shake',
);

/* Networked impact feedback may arrive a frame later and used to shake MAIN
 * again. Preserve that feedback for normal/spectator views, but not while the
 * local player owns the active sniper backdrop.
 */
s = replaceOnce(
  s,
`        this.cameras.main.shake(
            shot.hitId
                ? 125
                : 70,
            shot.hitId
                ? 0.006
                : 0.003,
        );`,
`        if (
            !this.sniperActive &&
            !this.sniperCinematicActive
        ) {
            this.cameras.main.shake(
                shot.hitId
                    ? 125
                    : 70,
                shot.hitId
                    ? 0.006
                    : 0.003,
            );
        }`,
  'suppress network impact main shake during local sniper',
);

/* Marker only after all edits succeeded. */
s = `/* ${MARK}: stabilize only Sniper outside-map camera/compositor; scope geometry, magnification and blur strength untouched. */\n` + s;

for (const token of [
  MARK,
  'sniperScopeLastClipRectKey',
  'STATIC_BLUR_ROOT',
  'WRITE_ONLY_ON_DRIFT',
  'SCOPE_ONLY_RECOIL',
  "backdropFilter:",
  'sniperScopeLastAppliedMask',
  'this.sniperScopeCamera',
]) {
  if (!s.includes(token)) {
    fail(`safety assertion missing: ${token}`);
  }
}

/* Safety: scope magnification / blur declarations must still exist. */
if (!/backdropFilter:\s*[\s\S]{0,250}blur\(/m.test(s)) {
  fail('existing sniper backdrop blur declaration appears missing.');
}
if (!/sniperScopeStripCameras|sniperScopeCamera/m.test(s)) {
  fail('existing sniper scope camera implementation appears missing.');
}

const backupDir = path.join(process.cwd(), '.patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(
  path.join(backupDir, 'GameScene-before-v0.10.10.565l.ts'),
  original,
  'utf8',
);
fs.writeFileSync(FILE, s, 'utf8');

console.log('');
console.log('[done] v0.10.10.565l SNIPER OUTSIDE BACKDROP STABILITY applied');
console.log('[outside] stable scope frames no longer call main-camera setSize/stopFollow/removeBounds every frame.');
console.log('[outside] full-screen blur root left/top/width/height are rewritten only when the canvas rect actually changes.');
console.log('[recoil] PC sniper shot keeps scope recoil, but no longer shakes the full outside map.');
console.log('[impact] delayed sniper impact cannot shake the local sniper outside map a second time.');
console.log('[safe] existing blur strength, moving circular mask, scope size, scope magnification, aim and firing logic are untouched.');
console.log('[backup] .patch-backups/GameScene-before-v0.10.10.565l.ts');
console.log('Next: npm run build');
