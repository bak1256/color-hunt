const fs = require('fs');
const path = require('path');

const MARK = 'V1010565F_BOT_ROBOT_NATIVE_SCALE_SPAWN';
const cwd = process.cwd();

function fail(msg) {
  throw new Error(msg + ' No file written.');
}
function mustFile(candidates, label) {
  const f = candidates.find((p) => fs.existsSync(p));
  if (!f) fail(`${label} not found. Checked:\n${candidates.join('\n')}`);
  return f;
}
function replaceMethod(source, startNeedle, endNeedle, replacement, label) {
  const start = source.indexOf(startNeedle);
  if (start < 0) fail(`${label}: start anchor missing.`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  if (end < 0) fail(`${label}: end anchor missing.`);
  return source.slice(0, start) + replacement + '\n\n' + source.slice(end);
}

const clientRoots = [cwd, path.resolve(cwd, '..', 'color-hunt')];
const gameFile = mustFile(
  clientRoots.map((r) => path.join(r, 'src', 'game', 'GameScene.ts')),
  'GameScene.ts',
);
const managerFile = mustFile(
  clientRoots.map((r) => path.join(r, 'src', 'multiplayer', 'NetworkPlayerManager.ts')),
  'NetworkPlayerManager.ts',
);

let game = fs.readFileSync(gameFile, 'utf8');
let manager = fs.readFileSync(managerFile, 'utf8');
const gameOriginal = game;
const managerOriginal = manager;

if (game.includes(MARK) && manager.includes(MARK)) {
  console.log('[skip] v0.10.10.565f already applied.');
  process.exit(0);
}

for (const [label, source] of [['GameScene', game], ['NetworkPlayerManager', manager]]) {
  if (!source.includes('V1010565E_BOT_AI_VISUAL_LOBBY_POLISH')) {
    fail(`${label}: v565e marker missing. Apply v0.10.10.565e first.`);
  }
}

/* ========================================================================
 * GAME SCENE: virtual Lobby bot previews
 * - Keep the current robot design exactly, but scale the WHOLE robot body
 *   proportionally to the production character silhouette Y span.
 * - Human paint silhouette is y=-24..+28 => 52px.
 * - Current robot art is about y=-48..+40.5 => 88.5px.
 * - 0.585 scale + y=4.3 centers it on the same production Y footprint.
 * - Replace the obvious 3-column board/grid spawn with stable random-looking
 *   positions derived from roomId + bot index, so adding bots feels natural
 *   without every redraw teleporting existing preview bots.
 * ====================================================================== */

game = replaceMethod(
  game,
  `    private createLobbyBotPreviewActor(index: number): Phaser.GameObjects.Container {\n`,
  `    private updateLobbyBotPreviewActors(): void {\n`,
`    private createLobbyBotPreviewActor(index: number): Phaser.GameObjects.Container {
        /*
         * ${MARK} / PREVIEW_NATIVE_Y_SCALE
         * Keep the v565e robot design, only scale it uniformly so its Y span
         * matches the real player silhouette instead of towering over it.
         */
        const ROBOT_SCALE = 0.585;
        const ROBOT_Y = 4.3;

        /*
         * ${MARK} / RANDOM_LOOKING_STABLE_LOBBY_SPAWN
         * No chessboard/grid.  Use a tiny deterministic PRNG keyed by room +
         * bot index: positions look random, but existing bots do not jump just
         * because another + button press rebuilds the preview set.
         */
        const roomId = String(multiplayerClient.getRoom()?.roomId ?? 'bot-preview');
        let seed = 2166136261 >>> 0;
        const seedText = roomId + ':' + index;
        for (let i = 0; i < seedText.length; i += 1) {
            seed ^= seedText.charCodeAt(i);
            seed = Math.imul(seed, 16777619) >>> 0;
        }
        const random01 = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x100000000;
        };

        const reservedRight = this.mobileControlsEnabled ? 36 : 300;
        const minX = 62;
        const maxX = Math.max(minX + 40, this.gameWidth - reservedRight - 48);
        const minY = 84;
        const maxY = Math.max(minY + 60, this.gameHeight - 76);
        const x = minX + random01() * (maxX - minX);
        const y = minY + random01() * (maxY - minY);

        /* Match the normal character shadow footprint too. */
        const shadow = this.add.ellipse(0, 18, 29, 10, 0x304d37, 0.25);
        const body = this.add.rectangle(0, 7, 30, 31, 0x8da4ad).setStrokeStyle(2, 0x39505a);
        const head = this.add.rectangle(0, -20, 31, 24, 0xb9cbd1).setStrokeStyle(2, 0x39505a);
        const leftEye = this.add.rectangle(-7, -22, 5, 5, 0x183a46);
        const rightEye = this.add.rectangle(7, -22, 5, 5, 0x183a46);
        const mouth = this.add.rectangle(0, -13, 13, 3, 0x526a73);
        const antenna = this.add.rectangle(0, -37, 3, 11, 0x526a73);
        const lamp = this.add.circle(0, -44, 4, 0x63c977);
        const chest = this.add.rectangle(0, 5, 17, 10, 0x6f8790).setStrokeStyle(1, 0x39505a);
        const leftArm = this.add.rectangle(-20, 8, 8, 24, 0x9dafb6).setStrokeStyle(1, 0x39505a);
        const rightArm = this.add.rectangle(20, 8, 8, 24, 0x9dafb6).setStrokeStyle(1, 0x39505a);
        const leftLeg = this.add.rectangle(-8, 31, 9, 19, 0x81969f).setStrokeStyle(1, 0x39505a);
        const rightLeg = this.add.rectangle(8, 31, 9, 19, 0x81969f).setStrokeStyle(1, 0x39505a);

        const robot = this.add.container(0, ROBOT_Y, [
            body, head, leftEye, rightEye, mouth, antenna, lamp, chest,
            leftArm, rightArm, leftLeg, rightLeg,
        ]).setScale(ROBOT_SCALE);

        /* Keep label readable; only the robot art scales, not the typography. */
        const label = this.add.text(0, -31, 'BOT ' + (index + 1) + ' · AI', {
            fontFamily: 'monospace',
            fontSize: '10px',
            fontStyle: 'bold',
            color: '#234552',
            backgroundColor: '#d9f4ffdd',
            padding: { x: 5, y: 3 },
        }).setOrigin(0.5, 1);

        return this.add.container(x, y, [
            shadow,
            robot,
            label,
        ]).setDepth(132);
    }`,
  'GameScene Lobby bot preview actor',
);

if (!game.includes(MARK)) {
  game = `/* ${MARK}: proportional robot scale + natural Lobby bot preview spawn. */\n` + game;
}

/* ========================================================================
 * NETWORK PLAYER MANAGER: physical/materialized bot visuals
 * - Robot is the visible bot body, not a cover laid on top of the normal body.
 * - Scale proportionally to the same Y footprint as a real player.
 * - Hunter bot keeps its real network gun on top, so shotgun aim is visible.
 * - Hider bots still revert to their paintable Hider silhouette during
 *   Paint/Hunt; their camouflage mechanics stay unchanged.
 * ====================================================================== */

manager = replaceMethod(
  manager,
  `  private ensureBotRobotOverlay(view: NetworkPlayerView): Phaser.GameObjects.Container | undefined {\n`,
  `  private createPlayerContainer(\n`,
`  private ensureBotRobotOverlay(view: NetworkPlayerView): Phaser.GameObjects.Container | undefined {
    if (!this.isBotSessionId(view.sessionId)) return undefined;

    const existing = view.container.getByName(
      "network-bot-robot-overlay",
    ) as Phaser.GameObjects.Container | null;
    if (existing) return existing;

    /*
     * ${MARK} / PHYSICAL_NATIVE_Y_SCALE
     * Robot source artwork spans roughly -49..+40.5.  The production player
     * silhouette spans -24..+28.  Uniform 0.585 scale + 4.3px Y offset keeps
     * the design intact while matching the normal character height.
     */
    const ROBOT_SCALE = 0.585;
    const ROBOT_Y = 4.3;

    const body = this.scene.add.rectangle(0, 6, 31, 32, 0x8da4ad).setStrokeStyle(2, 0x39505a);
    const head = this.scene.add.rectangle(0, -21, 32, 24, 0xb9cbd1).setStrokeStyle(2, 0x39505a);
    const leftEye = this.scene.add.rectangle(-7, -23, 5, 5, 0x183a46);
    const rightEye = this.scene.add.rectangle(7, -23, 5, 5, 0x183a46);
    const mouth = this.scene.add.rectangle(0, -14, 13, 3, 0x526a73);
    const antenna = this.scene.add.rectangle(0, -38, 3, 11, 0x526a73);
    const lamp = this.scene.add.circle(0, -45, 4, 0x63c977);
    const chest = this.scene.add.rectangle(0, 4, 17, 10, 0x6f8790).setStrokeStyle(1, 0x39505a);
    const leftArm = this.scene.add.rectangle(-20, 7, 8, 24, 0x9dafb6).setStrokeStyle(1, 0x39505a);
    const rightArm = this.scene.add.rectangle(20, 7, 8, 24, 0x9dafb6).setStrokeStyle(1, 0x39505a);
    const leftLeg = this.scene.add.rectangle(-8, 31, 9, 19, 0x81969f).setStrokeStyle(1, 0x39505a);
    const rightLeg = this.scene.add.rectangle(8, 31, 9, 19, 0x81969f).setStrokeStyle(1, 0x39505a);

    const robot = this.scene.add.container(0, ROBOT_Y, [
      body, head, leftEye, rightEye, mouth, antenna, lamp, chest,
      leftArm, rightArm, leftLeg, rightLeg,
    ])
      .setScale(ROBOT_SCALE)
      .setName("network-bot-robot-overlay");

    view.container.add(robot);
    return robot;
  }

  private refreshBotRobotVisual(view: NetworkPlayerView): void {
    if (!this.isBotSessionId(view.sessionId)) return;
    const robot = this.ensureBotRobotOverlay(view);
    if (!robot) return;

    const phase = multiplayerClient.getRoom()?.state?.phase ?? "lobby";
    const showRobot = view.alive && (phase === "lobby" || view.role === "hunter");

    const hiderBody = view.container.getByName(
      "network-hider-pixel-body",
    ) as Phaser.GameObjects.Image | null;
    const hunterBody = view.container.getByName(
      "network-hunter-pixel-body",
    ) as Phaser.GameObjects.Image | null;

    robot.setVisible(showRobot);

    if (showRobot) {
      /*
       * ${MARK} / ROBOT_IS_THE_BODY
       * Never draw a normal human silhouette underneath the robot.  This is a
       * visual replacement only; authoritative position/hitbox stays unchanged.
       */
      hiderBody?.setVisible(false);
      hunterBody?.setVisible(false);
      view.paintLayer?.texture.setVisible(false);

      /*
       * Hunter bot uses the SAME network gun object as a human Hunter. Keep it
       * visible and make sure it renders above the robot body.
       */
      view.gun?.setVisible(view.role === "hunter");
      const sortable = view.container as Phaser.GameObjects.Container & {
        bringToTop?: (child: Phaser.GameObjects.GameObject) => void;
        sendToBack?: (child: Phaser.GameObjects.GameObject) => void;
      };
      sortable.sendToBack?.(robot);
      if (view.gun) sortable.bringToTop?.(view.gun);
      sortable.bringToTop?.(view.nameText);

      view.nameText.setBackgroundColor("#d9f4ffdd");
      view.nameText.setColor("#234552");
      return;
    }

    /* Active Hider bot: robot disappears; normal paintable camouflage returns. */
    hiderBody?.setVisible(view.role === "hider" && view.alive);
    hunterBody?.setVisible(view.role === "hunter" && view.alive);
    view.paintLayer?.texture.setVisible(view.role === "hider" && view.alive);
    view.gun?.setVisible(view.role === "hunter" && view.alive);
    view.nameText.setBackgroundColor("#fff4d6dd");
    view.nameText.setColor("#4f3f34");
  }`,
  'NetworkPlayerManager bot robot visual methods',
);

if (!manager.includes(MARK)) {
  manager = `/* ${MARK}: robot is native bot body; normal silhouette hidden; Hunter shotgun stays visible. */\n` + manager;
}

for (const [label, source, tokens] of [
  ['GameScene', game, [MARK, 'ROBOT_SCALE = 0.585', 'RANDOM_LOOKING_STABLE_LOBBY_SPAWN', 'robot,\n            label']],
  ['NetworkPlayerManager', manager, [MARK, 'ROBOT_IS_THE_BODY', 'view.gun?.setVisible(view.role === "hunter")', 'sendToBack?.(robot)', 'ROBOT_SCALE = 0.585']],
]) {
  for (const token of tokens) {
    if (!source.includes(token)) fail(`${label}: safety token missing: ${token}`);
  }
}

const backupDir = path.join(path.dirname(gameFile), '..', '..', '.patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(path.join(backupDir, 'GameScene-before-v0.10.10.565f.ts'), gameOriginal, 'utf8');
fs.writeFileSync(path.join(backupDir, 'NetworkPlayerManager-before-v0.10.10.565f.ts'), managerOriginal, 'utf8');
fs.writeFileSync(gameFile, game, 'utf8');
fs.writeFileSync(managerFile, manager, 'utf8');

console.log('');
console.log('[done] v0.10.10.565f BOT ROBOT NATIVE SCALE + SPAWN applied');
console.log('[size] robot design unchanged; whole body uniformly scaled to ~58.5% so Y footprint matches the normal character.');
console.log('[visual] normal Hider/Hunter body is hidden whenever robot body is shown; no more robot-over-human stacking.');
console.log('[hunter] Hunter bot uses the existing real shotgun object above the robot, including normal aim rotation.');
console.log('[lobby] virtual bot previews use stable random-looking positions instead of a 3-column board/grid.');
console.log('[safe] Hider camouflage rendering in Paint/Hunt remains the original paintable body; bot AI/server logic untouched.');
console.log('Next: npm run build');
