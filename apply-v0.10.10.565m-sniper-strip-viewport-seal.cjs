const fs = require('fs');
const path = require('path');

const MARK = 'V1010565M_SNIPER_STRIP_VIEWPORT_SEAL';
const FILE = path.join(process.cwd(), 'src', 'game', 'GameScene.ts');

function fail(message) {
  throw new Error(`${message} No file written.`);
}

function countOf(source, needle) {
  return source.split(needle).length - 1;
}

function replaceOnce(source, before, after, label) {
  const count = countOf(source, before);
  if (count !== 1) {
    fail(`${label}: expected exactly one match, found ${count}.`);
  }
  return source.replace(before, after);
}

if (!fs.existsSync(FILE)) {
  fail(`Missing ${FILE}. Run from C:\\Users\\bak12\\color-hunt.`);
}

let source = fs.readFileSync(FILE, 'utf8');
const original = source;

if (source.includes(MARK)) {
  console.log('[skip] v0.10.10.565m already applied.');
  process.exit(0);
}

if (!source.includes('V1010565L_SNIPER_OUTSIDE_BACKDROP_STABILITY')) {
  fail('v565l marker missing. Apply v0.10.10.565l first.');
}

for (const token of [
  'private createSniperScopeCamera(): void {',
  'private drawLocalSniperScope(',
  'private ensureSniperScopeDom(): void {',
  'const stripCount =',
  ': 32;',
  "right: '-15px'",
  "backdropFilter:",
]) {
  if (!source.includes(token)) {
    fail(`required sniper token missing: ${token}`);
  }
}

/* -------------------------------------------------------------------------
 * 1) Start every magnification strip from a harmless hidden viewport.
 *
 * The active scope renderer immediately places each strip before showing it.
 * Creating a strip at an off-canvas rack-in coordinate can leave Chrome/WebGL
 * with an old scissor/viewport for one render pass. Keep creation neutral.
 * Scope zoom, strip count and circular chord geometry remain identical.
 * ---------------------------------------------------------------------- */
source = replaceOnce(
  source,
`            const camera =
                this.cameras.add(
                    this.sniperScopeScreenX -
                        halfChord,
                    this.sniperScopeScreenY +
                        y0,
                    stripWidth,
                    stripHeight,
                    false,
                    'sniper-overwatch-strip-' +
                        String(index),
                );`,
`            const camera =
                this.cameras.add(
                    0,
                    0,
                    stripWidth,
                    stripHeight,
                    false,
                    'sniper-overwatch-strip-' +
                        String(index),
                );`,
  'neutral strip camera creation viewport',
);

source = replaceOnce(
  source,
`                .setBackgroundColor(
                    'rgba(0,0,0,0)',
                );`,
`                .setBackgroundColor(
                    'rgba(0,0,0,0)',
                )
                /*
                 * ${MARK} / CREATE_HIDDEN
                 * drawLocalSniperScope() makes the camera visible only after a
                 * valid in-canvas viewport has been committed.
                 */
                .setVisible(false);`,
  'hide new strip camera until safe viewport commit',
);

/* -------------------------------------------------------------------------
 * 2) Replace moving 32x setViewport() churn with a safe viewport commit.
 *
 * When the whole strip is on-screen its width/height never change, so only
 * position is updated. At canvas edges we clip the viewport to the game rect
 * and shift the world center by the exact clipped pixel offset / zoom. This
 * keeps the lens visually identical while preventing negative/out-of-range
 * WebGL scissors from leaking an old magnified strip into the outside blur.
 * ---------------------------------------------------------------------- */
source = replaceOnce(
  source,
`                    camera
                        .setViewport(
                            this.sniperScopeScreenX -
                                halfChord,
                            this.sniperScopeScreenY +
                                y0,
                            Math.max(
                                2,
                                Math.ceil(
                                    halfChord *
                                        2,
                                ),
                            ),
                            Math.ceil(
                                y1 -
                                    y0,
                            ) +
                                1,
                        )
                        .centerOn(
                            x,
                            y +
                                midY /
                                    scopeZoom,
                        );`,
`                    const desiredX =
                        Math.round(
                            this.sniperScopeScreenX -
                                halfChord,
                        );

                    const desiredY =
                        Math.round(
                            this.sniperScopeScreenY +
                                y0,
                        );

                    const desiredWidth =
                        Math.max(
                            2,
                            Math.ceil(
                                halfChord * 2,
                            ),
                        );

                    const desiredHeight =
                        Math.ceil(
                            y1 - y0,
                        ) + 1;

                    const clippedLeft =
                        Phaser.Math.Clamp(
                            desiredX,
                            0,
                            this.gameWidth,
                        );

                    const clippedTop =
                        Phaser.Math.Clamp(
                            desiredY,
                            0,
                            this.gameHeight,
                        );

                    const clippedRight =
                        Phaser.Math.Clamp(
                            desiredX + desiredWidth,
                            0,
                            this.gameWidth,
                        );

                    const clippedBottom =
                        Phaser.Math.Clamp(
                            desiredY + desiredHeight,
                            0,
                            this.gameHeight,
                        );

                    const clippedWidth =
                        Math.max(
                            0,
                            clippedRight - clippedLeft,
                        );

                    const clippedHeight =
                        Math.max(
                            0,
                            clippedBottom - clippedTop,
                        );

                    if (
                        clippedWidth < 1 ||
                        clippedHeight < 1
                    ) {
                        camera.setVisible(false);
                        return;
                    }

                    const desiredCenterScreenX =
                        desiredX + desiredWidth / 2;

                    const desiredCenterScreenY =
                        desiredY + desiredHeight / 2;

                    const clippedCenterScreenX =
                        clippedLeft + clippedWidth / 2;

                    const clippedCenterScreenY =
                        clippedTop + clippedHeight / 2;

                    const clippedWorldCenterX =
                        x +
                        (
                            clippedCenterScreenX -
                            desiredCenterScreenX
                        ) /
                            scopeZoom;

                    const clippedWorldCenterY =
                        y +
                        midY /
                            scopeZoom +
                        (
                            clippedCenterScreenY -
                            desiredCenterScreenY
                        ) /
                            scopeZoom;

                    const fullyInsideCanvas =
                        clippedLeft === desiredX &&
                        clippedTop === desiredY &&
                        clippedWidth === desiredWidth &&
                        clippedHeight === desiredHeight;

                    if (fullyInsideCanvas) {
                        /*
                         * ${MARK} / POSITION_ONLY_WHEN_INSIDE
                         * The strip shape is constant. Avoid setViewport(),
                         * which rewrites width/height + projection/scissor state
                         * for every one of the 32 cameras on every mouse frame.
                         * If this strip was clipped at the edge last frame, restore
                         * its canonical size exactly once on re-entry.
                         */
                        if (
                            camera.width !== desiredWidth ||
                            camera.height !== desiredHeight
                        ) {
                            camera.setViewport(
                                desiredX,
                                desiredY,
                                desiredWidth,
                                desiredHeight,
                            );
                        } else if (
                            camera.x !== desiredX ||
                            camera.y !== desiredY
                        ) {
                            camera.setPosition(
                                desiredX,
                                desiredY,
                            );
                        }
                    } else if (
                        camera.x !== clippedLeft ||
                        camera.y !== clippedTop ||
                        camera.width !== clippedWidth ||
                        camera.height !== clippedHeight
                    ) {
                        /*
                         * ${MARK} / EDGE_CLIP
                         * Never feed Phaser/WebGL a negative or overflowing
                         * scope-strip viewport. Preserve the same optical pixels
                         * by compensating centerOn() below.
                         */
                        camera.setViewport(
                            clippedLeft,
                            clippedTop,
                            clippedWidth,
                            clippedHeight,
                        );
                    }

                    camera
                        .centerOn(
                            clippedWorldCenterX,
                            clippedWorldCenterY,
                        )
                        .setVisible(true);`,
  'safe moving sniper strip viewport commit',
);

/* -------------------------------------------------------------------------
 * 3) Remove only the right-hand optic index notch seen as a stray mark next
 * to the horizontal crosshair. Top / bottom / left marks, reticle, bezel,
 * reload gauge, blur and magnification remain unchanged.
 * ---------------------------------------------------------------------- */
source = replaceOnce(
  source,
`            {
                right: '-15px',
                top: '50%',
                width: '20px',
                height: '6px',
                transform: 'translateY(-50%)',
            },`,
`            /*
             * ${MARK} / RIGHT_NOTCH_REMOVED
             * The right index notch overlapped the horizontal reticle and read
             * as a leftover rendering mark in motion captures.
             */`,
  'remove right scope notch only',
);

source = `/* ${MARK}: clamp moving sniper strip viewports to canvas and remove the right reticle notch; blur/scope magnification unchanged. */\n` + source;

for (const token of [
  MARK,
  'CREATE_HIDDEN',
  'POSITION_ONLY_WHEN_INSIDE',
  'EDGE_CLIP',
  'RIGHT_NOTCH_REMOVED',
  "? 4\n                : 32;",
  "? 3.35\n                : 2.7;",
  "blur(7px) brightness(0.70) saturate(0.78)",
  'sniperScopeStripCameras',
]) {
  if (!source.includes(token)) {
    fail(`safety assertion missing after edit: ${token}`);
  }
}

if (source.includes("right: '-15px'")) {
  fail('right scope notch still present after patch.');
}

const backupDir = path.join(process.cwd(), '.patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(
  path.join(backupDir, 'GameScene-before-v0.10.10.565m.ts'),
  original,
  'utf8',
);
fs.writeFileSync(FILE, source, 'utf8');

console.log('');
console.log('[done] v0.10.10.565m SNIPER STRIP VIEWPORT SEAL applied');
console.log('[flicker] 32-strip circular scope preserved; no strip-count or magnification change.');
console.log('[flicker] on-screen strips move with position-only writes instead of 32x setViewport size rewrites.');
console.log('[edge] partially off-screen strips are clipped to valid canvas scissors with exact world-center compensation.');
console.log('[edge] fully off-screen strips are hidden until they re-enter the canvas.');
console.log('[reticle] removed only the right-hand optic notch that looked like a stray crosshair mark.');
console.log('[safe] existing desktop blur(7px), mask, scope ring, zoom 2.7, aim/fire/reload logic untouched.');
console.log('[backup] .patch-backups/GameScene-before-v0.10.10.565m.ts');
console.log('Next: npm run build');
