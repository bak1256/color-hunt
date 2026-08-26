const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "src", "game", "GameScene.ts");
const MARK = "V1010501H_RESTORE_EXACT_491_PRE_RACK_STRIP_GATE";

if (!fs.existsSync(FILE)) {
  throw new Error("Run this from the color-hunt project root.");
}

let s = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.501h already applied");
  process.exit(0);
}

const original = s;

/*
 * Exact regression diagnosis:
 * Current source still has the V1010491 banner, but the actual
 * V1010491_PRE_RACK_CAMERA_LIFECYCLE guard disappeared when the older
 * local sniper subsystem was restored.
 *
 * Restore ONLY that proven guard.
 */
const anchor =
`        if (
            !this.sniperActive ||
            !this.sniperCinematicActive
        ) {
            return;
        }

        if (
            this.sniperScopeStripCameras.length ===
            0
        ) {
            this.createSniperScopeCamera();
        }`;

const count = s.split(anchor).length - 1;

if (count !== 1) {
  throw new Error(
    `drawLocalSniperScope exact anchor: expected 1 match, found ${count}. No file written.`
  );
}

const replacement =
`        if (
            !this.sniperActive ||
            !this.sniperCinematicActive
        ) {
            return;
        }

        /*
         * ${MARK}
         * Restore the previously working v491 lifecycle gate exactly:
         *
         * Before physical rack-in:
         *   - DO NOT create/render magnification strip cameras
         *   - hide stale strip cameras
         *   - hide optical scope UI
         *   - return
         *
         * During rack-in / once interactive:
         *   - existing renderer continues unchanged
         *
         * This is the exact bug shown in the video:
         * a borderless sharp circular/moving magnified patch appeared before
         * the physical scope because the strip cameras rendered too early.
         */
        const opticRendererAllowed =
            this.sniperScopeRackInRunning ||
            this.sniperScopeInteractive;

        if (!opticRendererAllowed) {
            this.sniperScopeStripCameras
                .forEach(
                    (scopeCamera) => {
                        scopeCamera.visible =
                            false;
                    },
                );

            this.sniperScope
                ?.clear()
                .setVisible(false);

            this.sniperScopeShade
                ?.clear()
                .setVisible(false);

            this.sniperReloadGraphics
                ?.clear()
                .setVisible(false);

            if (this.sniperScopeDom) {
                this.sniperScopeDom.style.display =
                    'none';
            }

            return;
        }

        if (
            this.sniperScopeStripCameras.length ===
            0
        ) {
            this.createSniperScopeCamera();
        }`;

s = s.replace(anchor, replacement);

s =
`/* ${MARK}: restore only the proven v491 pre-rack 32-strip lifecycle gate; all working sniper visuals/mechanics unchanged. */\n` +
s;

for (const token of [
  MARK,
  "const opticRendererAllowed =",
  "this.sniperScopeRackInRunning ||",
  "scopeCamera.visible =",
  "this.sniperScopeDom.style.display =",
]) {
  if (!s.includes(token)) {
    throw new Error(`Safety assertion failed: ${token}. No file written.`);
  }
}

/*
 * Safety: this patch MUST NOT modify blur strength, scope radius, zoom,
 * mask, firing, aim, helicopter, camera movement, or spectator code.
 */
fs.mkdirSync(".patch-backups", { recursive: true });

fs.writeFileSync(
  ".patch-backups/GameScene-before-v501h.ts",
  original,
  "utf8",
);

fs.writeFileSync(FILE, s, "utf8");

console.log("");
console.log("[done] v0.10.10.501h CLIENT");
console.log("[fix ONLY] restored proven v491 pre-rack strip-camera lifecycle gate");
console.log("[fix] sharp moving circle cannot exist before rack-in begins");
console.log("[unchanged] current outside blur");
console.log("[unchanged] finished scope shape/radius/zoom");
console.log("[unchanged] scope rack-in tween");
console.log("[unchanged] aim/fire/helicopter/camera movement");
console.log("[unchanged] spectator/reconnect/READY/paint/victory");
console.log("[backup] .patch-backups/GameScene-before-v501h.ts");
console.log("Next: npm run build");
