const fs = require('fs');
const path = require('path');

const MARK = 'V1010565K_HIDER_CURSOR_MOBILE_FART_VISIBLE_ACTIVE';
const cwd = process.cwd();
const file = path.join(cwd, 'src', 'game', 'GameScene.ts');

function fail(msg) {
  throw new Error(`${msg} No file written.`);
}
function countOf(s, needle) {
  return s.split(needle).length - 1;
}
function replaceOnce(s, before, after, label) {
  const n = countOf(s, before);
  if (n !== 1) fail(`${label}: expected exactly 1 match, found ${n}.`);
  return s.replace(before, after);
}

if (!fs.existsSync(file)) {
  fail(`Missing ${file}. Run this from C:\\Users\\bak12\\color-hunt.`);
}

let s = fs.readFileSync(file, 'utf8');
const original = s;

if (s.includes(MARK)) {
  console.log('[skip] v0.10.10.565k already applied.');
  process.exit(0);
}

if (!s.includes('V1010565J_BACKGROUND_CAMOUFLAGE_SCORE')) {
  fail('v565j marker missing. Apply through v0.10.10.565j first.');
}

/* -------------------------------------------------------------------------
 * 1) DESKTOP HIDER CURSOR
 * Hunt used one unconditional cursor="none" for everybody because Hunters
 * render their own crosshair. That also hid the native mouse for Hiders.
 * Keep Hunter behavior unchanged, but make desktop Hider cursor authoritative
 * and reassert it every frame so reconnect/spectator/UI transitions cannot
 * accidentally hide it again.
 * ---------------------------------------------------------------------- */
s = replaceOnce(
  s,
`        this.input.setDefaultCursor('none');
    }

    private getPracticeRankingPosition(`,
`        this.syncDesktopHiderCursor();
    }

    /* ${MARK}: desktop Hiders always keep a visible native mouse cursor in Hunt. */
    private syncDesktopHiderCursor(): void {
        if (
            this.mobileControlsEnabled ||
            this.phase !== 'hunt'
        ) {
            return;
        }

        const role =
            multiplayerClient
                .getLocalPlayer()
                ?.role;

        const localIsHider =
            this.practiceMode === 'hider' ||
            role === 'hider' ||
            this.networkPlayerManager
                .isLocalHider();

        const localIsHunter =
            this.practiceMode === 'hunter' ||
            (
                !this.isMultiplayerSession() &&
                this.practiceMode !== 'hider'
            ) ||
            role === 'hunter' ||
            this.networkPlayerManager
                .canLocalControlHunter();

        if (!localIsHider && !localIsHunter) {
            return;
        }

        const desiredCursor =
            localIsHider
                ? 'default'
                : 'none';

        this.input.setDefaultCursor(
            desiredCursor,
        );

        if (
            this.game.canvas.style.cursor !==
            desiredCursor
        ) {
            this.game.canvas.style.cursor =
                desiredCursor;
        }
    }

    private getPracticeRankingPosition(`,
  'desktop Hider cursor helper',
);

s = replaceOnce(
  s,
`        this.updateNetworkPlayers(delta);
        this.updateMobileControlVisibility();

        if (`,
`        this.updateNetworkPlayers(delta);
        this.updateMobileControlVisibility();
        this.syncDesktopHiderCursor();

        if (`,
  'per-frame desktop Hider cursor reassert',
);

/* -------------------------------------------------------------------------
 * 2) MOBILE FART: VISIBLE === INTERACTIVE
 * Tactical code correctly hides + disables FART, but generic normal-Hunt UI
 * historically only made it visible again. A Phaser object can therefore look
 * tappable while its Input component is still disabled. Re-enable interaction
 * whenever normal Hunter combat makes the button visible.
 * ---------------------------------------------------------------------- */
s = replaceOnce(
  s,
`        this.mobileFartButton
            ?.setVisible(showHunterCombat);

        this.mobileFartLabel`,
`        this.mobileFartButton
            ?.setVisible(showHunterCombat);

        /* ${MARK}: if FART is shown as a normal Hunter control, it must accept taps. */
        if (
            showHunterCombat &&
            this.mobileFartButton
        ) {
            if (this.mobileFartButton.input) {
                this.mobileFartButton.input.enabled =
                    true;
            } else {
                this.mobileFartButton.setInteractive({
                    useHandCursor: true,
                });
            }
        }

        this.mobileFartLabel`,
  'visible mobile FART re-enable',
);

/* A visible button is the UX authority. Tactical modes are responsible for
 * hiding/disabling it; do not let a stale tactical boolean turn a visible
 * button into a silent dead control. Existing role/phase/cooldown/poop rules
 * above this point remain unchanged.
 */
s = replaceOnce(
  s,
`                if (
                    this.practiceMode === 'hunter'
                ) {
                    this.useHunterPracticeFart();
                    return;
                }

                if (!this.isTacticalSupportInputLocked()) {
                    multiplayerClient.sendFart();
                }`,
`                if (
                    this.practiceMode === 'hunter'
                ) {
                    this.useHunterPracticeFart();
                    return;
                }

                if (this.mobileFartButton?.visible) {
                    multiplayerClient.sendFart();
                }`,
  'visible mobile FART send authority',
);

/* Clean a lost/cancelled FART pointer independently, not only as a side effect
 * of clearing FIRE. This prevents mobile WebView pointer residue after focus
 * changes or finger-up outside the canvas.
 */
s = replaceOnce(
  s,
`                        if (
                            this.mobileFirePointerId >=
                                0 &&
                            !this.isMobilePointerActuallyDown(
                                this.mobileFirePointerId,
                            )
                        ) {
                            this.mobileFirePointerId =
                                -1;
                        }
                    };`,
`                        if (
                            this.mobileFirePointerId >=
                                0 &&
                            !this.isMobilePointerActuallyDown(
                                this.mobileFirePointerId,
                            )
                        ) {
                            this.mobileFirePointerId =
                                -1;
                        }

                        if (
                            this.mobileFartPointerId >=
                                0 &&
                            !this.isMobilePointerActuallyDown(
                                this.mobileFartPointerId,
                            )
                        ) {
                            this.mobileFartPointerId =
                                -1;
                        }
                    };`,
  'independent stale FART pointer release',
);

if (!s.includes(MARK)) {
  s = `/* ${MARK}: desktop Hider native cursor + visible mobile FART is always interactive. */\n` + s;
}

for (const token of [
  MARK,
  'private syncDesktopHiderCursor(): void',
  'this.syncDesktopHiderCursor();',
  'showHunterCombat &&',
  'this.mobileFartButton.input.enabled =',
  'if (this.mobileFartButton?.visible)',
]) {
  if (!s.includes(token)) {
    fail(`postcondition missing: ${token}`);
  }
}

if (s === original) {
  fail('Patch made no changes.');
}

const backupDir = path.join(cwd, '.patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(
  path.join(backupDir, 'GameScene-before-v0.10.10.565k.ts'),
  original,
  'utf8',
);
fs.writeFileSync(file, s, 'utf8');

console.log('');
console.log('[done] v0.10.10.565k HIDER CURSOR + MOBILE FART LIVE applied');
console.log('[pc] Desktop Hider native mouse cursor stays visible throughout Hunt, including reconnect/spectator UI churn.');
console.log('[pc] Desktop Hunter keeps the existing hidden native cursor/custom crosshair behavior.');
console.log('[mobile] Whenever the normal Hunter FART button is visible, its Phaser input is explicitly re-enabled.');
console.log('[mobile] A visible FART button sends the fart request; tactical modes must hide/disable it instead of leaving a dead visible control.');
console.log('[mobile] Lost/cancelled FART pointer ownership is cleaned independently.');
console.log('[balance] Existing Hunt/role, fart cooldown, and poop/GAS restrictions are unchanged.');
console.log('NEXT: npm run build');
