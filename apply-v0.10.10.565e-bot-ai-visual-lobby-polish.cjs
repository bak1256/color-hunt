const fs = require('fs');
const path = require('path');

const MARK = 'V1010565E_BOT_AI_VISUAL_LOBBY_POLISH';
const cwd = process.cwd();

function fail(msg) {
  throw new Error(msg + ' No file written.');
}
function mustFile(candidates, label) {
  const f = candidates.find((p) => fs.existsSync(p));
  if (!f) fail(`${label} not found. Checked:\n${candidates.join('\n')}`);
  return f;
}
function countOf(s, needle) {
  return s.split(needle).length - 1;
}
function replaceOnce(s, before, after, label) {
  const n = countOf(s, before);
  if (n !== 1) fail(`${label}: expected exactly 1 match, found ${n}.`);
  return s.replace(before, after);
}
function replaceMethod(s, startNeedle, endNeedle, replacement, label) {
  const start = s.indexOf(startNeedle);
  if (start < 0) fail(`${label}: start anchor missing.`);
  const end = s.indexOf(endNeedle, start + startNeedle.length);
  if (end < 0) fail(`${label}: end anchor missing.`);
  return s.slice(0, start) + replacement + '\n\n' + s.slice(end);
}

const clientRootCandidates = [cwd, path.resolve(cwd, '..', 'color-hunt')];
const serverRootCandidates = [path.resolve(cwd, '..', 'color-hunt-server'), cwd];

const gameFile = mustFile(
  clientRootCandidates.map((r) => path.join(r, 'src', 'game', 'GameScene.ts')),
  'GameScene.ts',
);
const managerFile = mustFile(
  clientRootCandidates.map((r) => path.join(r, 'src', 'multiplayer', 'NetworkPlayerManager.ts')),
  'NetworkPlayerManager.ts',
);
const serverFile = mustFile(
  serverRootCandidates.map((r) => path.join(r, 'src', 'rooms', 'MyRoom.ts')),
  'MyRoom.ts',
);

let game = fs.readFileSync(gameFile, 'utf8');
let manager = fs.readFileSync(managerFile, 'utf8');
let server = fs.readFileSync(serverFile, 'utf8');
const gameOriginal = game;
const managerOriginal = manager;
const serverOriginal = server;

if (game.includes(MARK) && manager.includes(MARK) && server.includes(MARK)) {
  console.log('[skip] v0.10.10.565e already applied.');
  process.exit(0);
}

for (const [label, source, required] of [
  ['GameScene', game, ['V1010565D_TIMING_PADDING_RESTORE', 'V1010565_BOTS_V1']],
  ['NetworkPlayerManager', manager, ['V1010542_TEN_PLAYER_PREFLIGHT_SAFE_OPT']],
  ['MyRoom', server, ['V1010565D_BOT_READY_EARLY_HUNT', 'V1010565_BOTS_V1']],
]) {
  for (const token of required) {
    if (!source.includes(token)) fail(`${label}: required marker missing: ${token}`);
  }
}

/* ========================================================================
 * CLIENT / GameScene
 * - Final unconditional Paint/Hunt inner padding authority.
 * - Virtual Lobby bots get visible local robot previews before materializing.
 * - Stationary human entrants get a cheap lobby-only roster heal.
 * ====================================================================== */

const fieldAnchor = `    private botPaintAuthoringNotBefore = 0;\n`;
if (!game.includes(MARK)) {
  game = replaceOnce(
    game,
    fieldAnchor,
    `${fieldAnchor}    /* ${MARK}: local-only Lobby bot previews + stationary roster visibility heal. */\n    private readonly lobbyBotPreviewActors: Phaser.GameObjects.Container[] = [];\n    private lobbyBotPreviewKey = '';\n    private lastLobbyRosterVisibilityHealAt = 0;\n`,
    'GameScene bot preview fields',
  );
}

const waitingInfoAnchor = `        this.waitingRoomInfo =\n            root.querySelector('.ch-waiting-info') ?? undefined;`;
if (!game.includes('colorhunt-v565e-timing-breathing-room')) {
  if (!game.includes(waitingInfoAnchor)) fail('GameScene waitingRoomInfo anchor missing.');
  const cssBlock = `        /*\n         * ${MARK} / TIMING_BREATHING_ROOM_FINAL_AUTHORITY\n         * v565d restored padding only when ch-uniform-mobile-scale was present.\n         * Some narrow/mobile layouts never carry that class at the exact DOM\n         * build moment, so the older compact rules still won. Apply the same\n         * geometry unconditionally and let the existing WHOLE-panel scaler fit it.\n         */\n        {\n            const styleId = 'colorhunt-v565e-timing-breathing-room';\n            document.getElementById(styleId)?.remove();\n            const style = document.createElement('style');\n            style.id = styleId;\n            style.textContent = \`\n                .colorhunt-waiting-room .ch-waiting-timing {\n                    grid-template-rows: 118px 73px 73px !important;\n                    grid-auto-rows: max-content !important;\n                    row-gap: 7px !important;\n                    gap: 7px !important;\n                    height: 278px !important;\n                    min-height: 278px !important;\n                    max-height: 278px !important;\n                    flex: 0 0 278px !important;\n                    overflow: visible !important;\n                }\n\n                .colorhunt-waiting-room .ch-waiting-timing\n                > section:not(.ch-waiting-bot-section) {\n                    position: relative !important;\n                    display: grid !important;\n                    grid-template-columns: minmax(0, 1fr) !important;\n                    grid-template-rows: 18px 31px !important;\n                    align-content: start !important;\n                    row-gap: 7px !important;\n                    gap: 7px !important;\n                    width: 100% !important;\n                    height: 73px !important;\n                    min-height: 73px !important;\n                    max-height: 73px !important;\n                    margin: 0 !important;\n                    padding: 7px 7px 8px !important;\n                    box-sizing: border-box !important;\n                    overflow: hidden !important;\n                }\n\n                .colorhunt-waiting-room .ch-waiting-timing\n                > section:not(.ch-waiting-bot-section)\n                .ch-waiting-timing-title {\n                    position: static !important;\n                    inset: auto !important;\n                    transform: none !important;\n                    display: flex !important;\n                    align-items: center !important;\n                    justify-content: space-between !important;\n                    width: 100% !important;\n                    height: 18px !important;\n                    min-height: 18px !important;\n                    max-height: 18px !important;\n                    margin: 0 !important;\n                    padding: 0 1px !important;\n                    box-sizing: border-box !important;\n                    line-height: 18px !important;\n                }\n\n                .colorhunt-waiting-room .ch-waiting-timing\n                > section:not(.ch-waiting-bot-section)\n                .ch-waiting-time-options {\n                    position: static !important;\n                    inset: auto !important;\n                    transform: none !important;\n                    display: grid !important;\n                    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;\n                    gap: 5px !important;\n                    width: 100% !important;\n                    height: 31px !important;\n                    min-height: 31px !important;\n                    max-height: 31px !important;\n                    margin: 0 !important;\n                    padding: 0 !important;\n                    box-sizing: border-box !important;\n                }\n\n                .colorhunt-waiting-room .ch-waiting-timing\n                > section:not(.ch-waiting-bot-section)\n                .ch-waiting-time-options button {\n                    width: 100% !important;\n                    height: 31px !important;\n                    min-height: 31px !important;\n                    max-height: 31px !important;\n                    margin: 0 !important;\n                    padding: 0 4px !important;\n                    box-sizing: border-box !important;\n                }\n            \`;\n            document.head.appendChild(style);\n        }\n\n`;
  game = game.replace(waitingInfoAnchor, cssBlock + waitingInfoAnchor);
}

const botPaintMethodAnchor = `    private updateHostBotPaintAuthoring(): void {`;
if (!game.includes('private updateLobbyBotPreviewActors(): void')) {
  const methods = `    /*\n     * ${MARK} / LOBBY_BOT_PREVIEW\n     * Lobby +/- stays virtual to protect WebSocket stability. Render only the\n     * not-yet-materialized seats locally as obvious little robots instead of\n     * mutating synchronized PlayerState on each click.\n     */\n    private destroyLobbyBotPreviewActors(): void {\n        this.lobbyBotPreviewActors.forEach((actor) => actor.destroy(true));\n        this.lobbyBotPreviewActors.length = 0;\n        this.lobbyBotPreviewKey = '';\n    }\n\n    private createLobbyBotPreviewActor(index: number): Phaser.GameObjects.Container {\n        const leftWorldWidth = Math.min(600, this.gameWidth * 0.62);\n        const columns = 3;\n        const col = index % columns;\n        const row = Math.floor(index / columns);\n        const x = 95 + col * Math.max(125, (leftWorldWidth - 170) / 2);\n        const y = 145 + row * 128 + ((index * 17) % 23);\n\n        const shadow = this.add.ellipse(0, 26, 34, 11, 0x304d37, 0.25);\n        const body = this.add.rectangle(0, 7, 30, 31, 0x8da4ad).setStrokeStyle(2, 0x39505a);\n        const head = this.add.rectangle(0, -20, 31, 24, 0xb9cbd1).setStrokeStyle(2, 0x39505a);\n        const leftEye = this.add.rectangle(-7, -22, 5, 5, 0x183a46);\n        const rightEye = this.add.rectangle(7, -22, 5, 5, 0x183a46);\n        const mouth = this.add.rectangle(0, -13, 13, 3, 0x526a73);\n        const antenna = this.add.rectangle(0, -37, 3, 11, 0x526a73);\n        const lamp = this.add.circle(0, -44, 4, 0x63c977);\n        const chest = this.add.rectangle(0, 5, 17, 10, 0x6f8790).setStrokeStyle(1, 0x39505a);\n        const leftArm = this.add.rectangle(-20, 8, 8, 24, 0x9dafb6).setStrokeStyle(1, 0x39505a);\n        const rightArm = this.add.rectangle(20, 8, 8, 24, 0x9dafb6).setStrokeStyle(1, 0x39505a);\n        const leftLeg = this.add.rectangle(-8, 31, 9, 19, 0x81969f).setStrokeStyle(1, 0x39505a);\n        const rightLeg = this.add.rectangle(8, 31, 9, 19, 0x81969f).setStrokeStyle(1, 0x39505a);\n        const label = this.add.text(0, -50, \`BOT \${index + 1} · AI\`, {\n            fontFamily: 'monospace',\n            fontSize: '10px',\n            fontStyle: 'bold',\n            color: '#234552',\n            backgroundColor: '#d9f4ffdd',\n            padding: { x: 5, y: 3 },\n        }).setOrigin(0.5, 1);\n\n        return this.add.container(x, y, [\n            shadow, body, head, leftEye, rightEye, mouth, antenna, lamp, chest,\n            leftArm, rightArm, leftLeg, rightLeg, label,\n        ]).setDepth(132);\n    }\n\n    private updateLobbyBotPreviewActors(): void {\n        if (\n            this.phase !== 'lobby' ||\n            !this.isMultiplayerSession()\n        ) {\n            if (this.lobbyBotPreviewActors.length > 0) this.destroyLobbyBotPreviewActors();\n            return;\n        }\n\n        const room = multiplayerClient.getRoom();\n        if (!room) {\n            this.destroyLobbyBotPreviewActors();\n            return;\n        }\n\n        let physicalBotCount = 0;\n        room.state.players?.forEach?.((_player: NetworkPlayerState, sessionId: string) => {\n            const id = String(sessionId);\n            if (id.startsWith('bot_') || id.startsWith('bot:')) physicalBotCount += 1;\n        });\n\n        const configured = multiplayerClient.getBotCount();\n        const previewCount = Math.max(0, configured - physicalBotCount);\n        const key = \`${'${room.roomId}'}:${'${configured}'}:${'${physicalBotCount}'}\`;\n        if (key === this.lobbyBotPreviewKey && this.lobbyBotPreviewActors.length === previewCount) return;\n\n        this.destroyLobbyBotPreviewActors();\n        this.lobbyBotPreviewKey = key;\n        for (let i = 0; i < previewCount; i += 1) {\n            this.lobbyBotPreviewActors.push(this.createLobbyBotPreviewActor(i));\n        }\n    }\n\n    private updateLobbyRosterVisibilityHeal(): void {\n        if (this.phase !== 'lobby' || !this.isMultiplayerSession()) return;\n        if (this.time.now - this.lastLobbyRosterVisibilityHealAt < 350) return;\n        this.lastLobbyRosterVisibilityHealAt = this.time.now;\n\n        /* No network sends: only make already-authoritative stationary players visible. */\n        this.networkPlayerManager?.syncPlayersFromCurrentRoom();\n        this.networkPlayerManager?.forceLobbyPositionsFromState();\n    }\n\n`;
  if (!game.includes(botPaintMethodAnchor)) fail('GameScene bot paint method anchor missing.');
  game = game.replace(botPaintMethodAnchor, methods + botPaintMethodAnchor);
}


const updateWaitingAnchor = `    private updateWaitingRoomDom(): void {\n        if (\n            !this.waitingRoomRoot ||\n            !multiplayerClient.isConnected() ||\n            this.phase !== 'lobby'\n        ) {\n            return;\n        }`;
if (!game.includes('TIMING_INLINE_FINAL_LOCK')) {
  const inlineLock = `${updateWaitingAnchor}\n\n        /* ${MARK} / TIMING_INLINE_FINAL_LOCK: beat every legacy !important rescue stylesheet. */\n        this.waitingRoomRoot\n            .querySelectorAll<HTMLElement>(\n                '.ch-waiting-timing > section:not(.ch-waiting-bot-section)',\n            )\n            .forEach((section) => {\n                section.style.setProperty('display', 'grid', 'important');\n                section.style.setProperty('grid-template-rows', '18px 31px', 'important');\n                section.style.setProperty('row-gap', '7px', 'important');\n                section.style.setProperty('gap', '7px', 'important');\n                section.style.setProperty('height', '73px', 'important');\n                section.style.setProperty('min-height', '73px', 'important');\n                section.style.setProperty('max-height', '73px', 'important');\n                section.style.setProperty('padding', '7px 7px 8px', 'important');\n                section.style.setProperty('box-sizing', 'border-box', 'important');\n\n                const title = section.querySelector<HTMLElement>('.ch-waiting-timing-title');\n                title?.style.setProperty('position', 'static', 'important');\n                title?.style.setProperty('height', '18px', 'important');\n                title?.style.setProperty('min-height', '18px', 'important');\n                title?.style.setProperty('max-height', '18px', 'important');\n                title?.style.setProperty('margin', '0', 'important');\n                title?.style.setProperty('padding', '0 1px', 'important');\n\n                const options = section.querySelector<HTMLElement>('.ch-waiting-time-options');\n                options?.style.setProperty('position', 'static', 'important');\n                options?.style.setProperty('height', '31px', 'important');\n                options?.style.setProperty('min-height', '31px', 'important');\n                options?.style.setProperty('max-height', '31px', 'important');\n                options?.style.setProperty('margin', '0', 'important');\n                options?.style.setProperty('padding', '0', 'important');\n            });`;
  game = replaceOnce(
    game,
    updateWaitingAnchor,
    inlineLock,
    'GameScene timing inline final lock',
  );
}

const updateAnchor = `        /* V1010565_BOTS_V1: at most one bot is authored per throttled pass. */\n        this.updateHostBotPaintAuthoring();`;
if (!game.includes('this.updateLobbyBotPreviewActors();')) {
  game = replaceOnce(
    game,
    updateAnchor,
    `${updateAnchor}\n        /* ${MARK}: preview virtual bot seats + heal stationary Lobby roster visibility. */\n        this.updateLobbyBotPreviewActors();\n        this.updateLobbyRosterVisibilityHeal();`,
    'GameScene frame bot preview/heal',
  );
}

/* ========================================================================
 * CLIENT / NetworkPlayerManager
 * - Actual server-owned bots are visually robotic in Lobby.
 * - Hunter bots stay robotic during Paint/Hunt so humans can distinguish them.
 * - Hider bots hide the robot overlay during Paint/Hunt so camouflage remains fair.
 * ====================================================================== */

const createContainerAnchor = `  private createPlayerContainer(\n`;
if (!manager.includes('private refreshBotRobotVisual(')) {
  const robotMethods = `  /* ${MARK}: obvious bot rendering without changing gameplay hitboxes. */\n  private isBotSessionId(sessionId: string): boolean {\n    return sessionId.startsWith("bot_") || sessionId.startsWith("bot:");\n  }\n\n  private ensureBotRobotOverlay(view: NetworkPlayerView): Phaser.GameObjects.Container | undefined {\n    if (!this.isBotSessionId(view.sessionId)) return undefined;\n\n    const existing = view.container.getByName(\n      "network-bot-robot-overlay",\n    ) as Phaser.GameObjects.Container | null;\n    if (existing) return existing;\n\n    const body = this.scene.add.rectangle(0, 6, 31, 32, 0x8da4ad).setStrokeStyle(2, 0x39505a);\n    const head = this.scene.add.rectangle(0, -21, 32, 24, 0xb9cbd1).setStrokeStyle(2, 0x39505a);\n    const leftEye = this.scene.add.rectangle(-7, -23, 5, 5, 0x183a46);\n    const rightEye = this.scene.add.rectangle(7, -23, 5, 5, 0x183a46);\n    const mouth = this.scene.add.rectangle(0, -14, 13, 3, 0x526a73);\n    const antenna = this.scene.add.rectangle(0, -38, 3, 11, 0x526a73);\n    const lamp = this.scene.add.circle(0, -45, 4, 0x63c977);\n    const chest = this.scene.add.rectangle(0, 4, 17, 10, 0x6f8790).setStrokeStyle(1, 0x39505a);\n    const leftArm = this.scene.add.rectangle(-20, 7, 8, 24, 0x9dafb6).setStrokeStyle(1, 0x39505a);\n    const rightArm = this.scene.add.rectangle(20, 7, 8, 24, 0x9dafb6).setStrokeStyle(1, 0x39505a);\n    const leftLeg = this.scene.add.rectangle(-8, 31, 9, 19, 0x81969f).setStrokeStyle(1, 0x39505a);\n    const rightLeg = this.scene.add.rectangle(8, 31, 9, 19, 0x81969f).setStrokeStyle(1, 0x39505a);\n\n    const overlay = this.scene.add.container(0, 0, [\n      body, head, leftEye, rightEye, mouth, antenna, lamp, chest,\n      leftArm, rightArm, leftLeg, rightLeg,\n    ]).setName("network-bot-robot-overlay");\n\n    view.container.add(overlay);\n    return overlay;\n  }\n\n  private refreshBotRobotVisual(view: NetworkPlayerView): void {\n    if (!this.isBotSessionId(view.sessionId)) return;\n    const overlay = this.ensureBotRobotOverlay(view);\n    if (!overlay) return;\n\n    const phase = multiplayerClient.getRoom()?.state?.phase ?? "lobby";\n    /* Hider bots must keep camouflage unobstructed in Paint/Hunt. */\n    const showRobot = view.alive && (phase === "lobby" || view.role === "hunter");\n    overlay.setVisible(showRobot);\n\n    if (showRobot) {\n      view.nameText.setBackgroundColor("#d9f4ffdd");\n      view.nameText.setColor("#234552");\n    } else {\n      view.nameText.setBackgroundColor("#fff4d6dd");\n      view.nameText.setColor("#4f3f34");\n    }\n  }\n\n`;
  if (!manager.includes(createContainerAnchor)) fail('NetworkPlayerManager createPlayerContainer anchor missing.');
  manager = manager.replace(createContainerAnchor, robotMethods + createContainerAnchor);
}

const createdViewAnchor = `      this.updateRoleBodyVisibility(\n        createdView.container,\n        player.role,\n      );`;
if (!manager.includes('this.refreshBotRobotVisual(createdView);')) {
  manager = replaceOnce(
    manager,
    createdViewAnchor,
    `${createdViewAnchor}\n\n      this.refreshBotRobotVisual(createdView);`,
    'NetworkPlayerManager initial bot visual',
  );
}

const updateLoopAnchor = `  update(delta = 16): void {\n    const localSessionId =\n      this.getEffectiveLocalSessionId();\n\n    this.players.forEach(\n      (view, sessionId) => {`;
if (!manager.includes('this.refreshBotRobotVisual(view);')) {
  manager = replaceOnce(
    manager,
    updateLoopAnchor,
    `${updateLoopAnchor}\n        this.refreshBotRobotVisual(view);`,
    'NetworkPlayerManager frame bot visual',
  );
}

if (!manager.includes(MARK)) {
  manager = `/* ${MARK}: robot bot visuals; Hider camouflage remains unobstructed in Paint/Hunt. */\n` + manager;
}

/* ========================================================================
 * SERVER / Bot AI
 * - Hider bots never move in Hunt.
 * - Every Hunter difficulty uses the human Hunter movement speed (125).
 * - A fired miss causes a short reposition/search instead of turret-locking.
 * - Moving / Hardened-taunting Hiders trigger much faster attention, still
 *   constrained by local range/FOV (no global coordinate cheat).
 * ====================================================================== */

server = replaceMethod(
  server,
  `  private getBotDifficultyConfig(): {\n`,
  `  /*\n   * V1010565D_BOT_READY_EARLY_HUNT`,
`  private getBotDifficultyConfig(): {
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
    /* ${MARK}: human Hunter production speed is 125; difficulty must never grant movement cheats. */
    if (this.botDifficulty === "easy") return {
      speed: 125,
      visionRange: 340,
      reactionBaseMs: 1150,
      stealthPenaltyMs: 2100,
      memoryMs: 1800,
      aimErrorRad: 12 * Math.PI / 180,
      turnRateRad: 1.5,
      hiderFidgetEveryMs: Number.POSITIVE_INFINITY,
      hiderFidgetDistance: 0,
      hiderMoveSpeed: 0,
    };
    if (this.botDifficulty === "hard") return {
      speed: 125,
      visionRange: 427.5,
      reactionBaseMs: 260,
      stealthPenaltyMs: 700,
      memoryMs: 4800,
      aimErrorRad: 2.5 * Math.PI / 180,
      turnRateRad: 3.8,
      hiderFidgetEveryMs: Number.POSITIVE_INFINITY,
      hiderFidgetDistance: 0,
      hiderMoveSpeed: 0,
    };
    return {
      speed: 125,
      visionRange: 427.5,
      reactionBaseMs: 560,
      stealthPenaltyMs: 1250,
      memoryMs: 3400,
      aimErrorRad: 6 * Math.PI / 180,
      turnRateRad: 2.7,
      hiderFidgetEveryMs: Number.POSITIVE_INFINITY,
      hiderFidgetDistance: 0,
      hiderMoveSpeed: 0,
    };
  }`,
  'server bot difficulty human-speed',
);

server = replaceMethod(
  server,
  `  private tickHiderBot(sessionId: string, player: PlayerState, now: number): void {`,
  `  private tickHunterBot(`,
`  private tickHiderBot(_sessionId: string, _player: PlayerState, _now: number): void {
    /* ${MARK}: Hider bots choose their hiding spot in prepareBotsForPaint() and stay there. */
    return;
  }`,
  'server stationary Hider bots',
);

server = replaceMethod(
  server,
  `  private tickHunterBot(sessionId: string, player: PlayerState, now: number): void {`,
  `  private moveBotToward(`,
`  private tickHunterBot(sessionId: string, player: PlayerState, now: number): void {
    const cfg = this.getBotDifficultyConfig();
    let brain = this.botBrainBySessionId.get(sessionId);
    if (!brain) {
      brain = this.makeBotBrain(player.x, player.y);
      this.botBrainBySessionId.set(sessionId, brain);
    }

    const baseHalfFov = 36 * Math.PI / 180;
    const bodySafeRadius = 42;
    const searchingAfterMiss = now < brain.modeUntil;
    let candidateId = "";
    let candidateDistance = Number.POSITIVE_INFINITY;

    /* After a real fired miss, move/search briefly instead of instantly re-locking. */
    if (!searchingAfterMiss) {
      for (const [targetId, target] of this.state.players) {
        if (target.role !== "hider" || !target.alive) continue;
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const distance = Math.hypot(dx, dy);
        const taunting = this.isHiderHardened(targetId);
        const lastMoveAt = this.lastMoveAtBySessionId.get(targetId) ?? 0;
        const movingRecently = now - lastMoveAt < 1200;
        const attentionRange = cfg.visionRange * (taunting ? 1.10 : movingRecently ? 1.04 : 1);
        if (distance > attentionRange) continue;
        const angle = Math.atan2(dy, dx);
        const attentionHalfFov = Math.min(
          82 * Math.PI / 180,
          baseHalfFov +
            (movingRecently ? 14 * Math.PI / 180 : 0) +
            (taunting ? 30 * Math.PI / 180 : 0),
        );
        const diff = Math.abs(this.normalizeBotAngle(angle - brain.heading));
        if (distance > bodySafeRadius && diff > attentionHalfFov) continue;
        if (distance < candidateDistance) {
          candidateId = targetId;
          candidateDistance = distance;
        }
      }
    }

    if (candidateId) {
      if (brain.candidateId !== candidateId) {
        brain.candidateId = candidateId;
        brain.candidateSeenSince = now;
      }

      const taunting = this.isHiderHardened(candidateId);
      const lastMoveAt = this.lastMoveAtBySessionId.get(candidateId) ?? 0;
      const movingRecently = now - lastMoveAt < 1200;
      const stealth = this.getCamouflageStealthScore(candidateId, now);
      const distanceFactor = Math.max(0, Math.min(1, candidateDistance / cfg.visionRange));
      let threshold =
        cfg.reactionBaseMs +
        stealth * cfg.stealthPenaltyMs +
        distanceFactor * 360;

      /* Taunting is intentionally risky; movement is also a strong visual cue. */
      if (taunting) threshold = Math.min(threshold, movingRecently ? 70 : 160);
      else if (movingRecently) threshold = Math.max(120, threshold * 0.42);

      if (now - brain.candidateSeenSince >= threshold) {
        const target = this.state.players.get(candidateId);
        if (target) {
          brain.targetId = candidateId;
          brain.lastSeenX = target.x;
          brain.lastSeenY = target.y;
          brain.lastSeenAt = now;
        }
      }
    } else if (!searchingAfterMiss) {
      brain.candidateId = "";
      brain.candidateSeenSince = 0;
    }

    let targetX = brain.patrolX;
    let targetY = brain.patrolY;
    let targetVisible = false;
    let lockedTargetDistance = Number.POSITIVE_INFINITY;

    if (!searchingAfterMiss && brain.targetId) {
      const target = this.state.players.get(brain.targetId);
      if (!target || target.role !== "hider" || !target.alive) {
        brain.targetId = "";
      } else {
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const taunting = this.isHiderHardened(brain.targetId);
        const lastMoveAt = this.lastMoveAtBySessionId.get(brain.targetId) ?? 0;
        const movingRecently = now - lastMoveAt < 1200;
        const attentionHalfFov = Math.min(
          82 * Math.PI / 180,
          baseHalfFov +
            (movingRecently ? 14 * Math.PI / 180 : 0) +
            (taunting ? 30 * Math.PI / 180 : 0),
        );
        const attentionRange = cfg.visionRange * (taunting ? 1.10 : movingRecently ? 1.04 : 1);
        const diff = Math.abs(this.normalizeBotAngle(angle - brain.heading));
        targetVisible = dist <= attentionRange && (dist <= bodySafeRadius || diff <= attentionHalfFov);
        if (targetVisible) {
          brain.lastSeenX = target.x;
          brain.lastSeenY = target.y;
          brain.lastSeenAt = now;
          targetX = target.x;
          targetY = target.y;
          lockedTargetDistance = dist;
        } else if (now - brain.lastSeenAt <= cfg.memoryMs) {
          targetX = brain.lastSeenX;
          targetY = brain.lastSeenY;
        } else {
          brain.targetId = "";
        }
      }
    }

    if (!brain.targetId || searchingAfterMiss) {
      const toPatrol = Math.hypot(brain.patrolX - player.x, brain.patrolY - player.y);
      if (searchingAfterMiss) {
        /* Keep moving around the last sighting during the miss-recovery window. */
        if (toPatrol < 18) {
          const a = Math.random() * Math.PI * 2;
          const r = 42 + Math.random() * 58;
          brain.patrolX = Math.max(28, Math.min(932, brain.lastSeenX + Math.cos(a) * r));
          brain.patrolY = Math.max(44, Math.min(506, brain.lastSeenY + Math.sin(a) * r));
        }
      } else if (toPatrol < 24 || now >= brain.nextDecisionAt) {
        brain.patrolX = 45 + Math.random() * 870;
        brain.patrolY = 55 + Math.random() * 430;
        brain.nextDecisionAt = now + 2200 + Math.random() * 2600;
      }
      targetX = brain.patrolX;
      targetY = brain.patrolY;
    }

    const desiredHeading = Math.atan2(targetY - player.y, targetX - player.x);
    brain.heading = this.turnBotAngleToward(brain.heading, desiredHeading, cfg.turnRateRad * 0.10);
    this.moveBotToward(sessionId, player, brain, targetX, targetY, cfg.speed, 0.10);

    if (now - brain.lastAimBroadcastAt >= 140) {
      brain.lastAimBroadcastAt = now;
      this.broadcast("hunter_aim", {
        sessionId,
        angle: brain.heading,
        range: this.pelletRange,
      });
    }

    if (
      !searchingAfterMiss &&
      brain.targetId &&
      targetVisible &&
      lockedTargetDistance <= this.pelletRange * 0.96
    ) {
      const target = this.state.players.get(brain.targetId);
      if (target) {
        const perfectAngle = Math.atan2(target.y - player.y, target.x - player.x);
        const facingError = Math.abs(this.normalizeBotAngle(perfectAngle - brain.heading));
        if (facingError <= 10 * Math.PI / 180) {
          const error = (Math.random() * 2 - 1) * cfg.aimErrorRad;
          const shot = this.fireBotHunterShot(sessionId, perfectAngle + error, now);

          if (shot.fired && !shot.hit) {
            /* A miss/blocked shot is a stimulus to SEARCH, never an infinite turret state. */
            brain.lastSeenX = target.x;
            brain.lastSeenY = target.y;
            brain.lastSeenAt = now;
            brain.targetId = "";
            brain.candidateId = "";
            brain.candidateSeenSince = 0;
            const a = perfectAngle + (Math.random() - 0.5) * Math.PI * 1.25;
            const r = 48 + Math.random() * 72;
            brain.patrolX = Math.max(28, Math.min(932, target.x + Math.cos(a) * r));
            brain.patrolY = Math.max(44, Math.min(506, target.y + Math.sin(a) * r));
            brain.modeUntil = now + 850 + Math.random() * 650;
            brain.nextDecisionAt = brain.modeUntil + 350;
          }
        }
      }
    }
  }`,
  'server Hunter bot reactive search',
);

server = replaceMethod(
  server,
  `  private fireBotHunterShot(sessionId: string, angle: number, now: number): void {`,
  `  private assignRoles(): void {`,
`  private fireBotHunterShot(
    sessionId: string,
    angle: number,
    now: number,
  ): { fired: boolean; hit: boolean } {
    if (this.state.phase !== "hunt") return { fired: false, hit: false };
    if (this.state.phaseEndsAt > 0 && now >= this.state.phaseEndsAt) {
      this.finishGame("hiders");
      return { fired: false, hit: false };
    }
    const hunter = this.state.players.get(sessionId);
    if (!hunter || hunter.role !== "hunter" || !hunter.alive) {
      return { fired: false, hit: false };
    }
    const previousShot = this.lastShotAt.get(sessionId) ?? 0;
    if (now - previousShot < this.shotCooldownMs) return { fired: false, hit: false };

    const heatState = this.getUpdatedWeaponHeatState(sessionId, now);
    if (now < heatState.overheatedUntil) return { fired: false, hit: false };
    const hunterStats = this.getHunterRoundStats(sessionId);
    hunterStats.shotsFired += 1;
    heatState.heat = Math.min(100, heatState.heat + this.heatPerShot);
    if (heatState.heat >= 100) heatState.overheatedUntil = now + this.overheatDurationMs;
    heatState.updatedAt = now;
    this.weaponHeatStates.set(sessionId, heatState);
    this.lastShotAt.set(sessionId, now);

    const startX = hunter.x + Math.cos(angle) * 28;
    const startY = hunter.y + Math.sin(angle) * 28;
    const pellets: Array<{ endX: number; endY: number }> = [];
    const hitIds = new Set<string>();
    const hardenedBlockedIds = new Set<string>();

    for (let index = 0; index < this.pelletCount; index += 1) {
      const ratio = this.pelletCount <= 1 ? 0.5 : index / (this.pelletCount - 1);
      const pelletAngle = angle - this.pelletSpread / 2 + this.pelletSpread * ratio;
      const endX = startX + Math.cos(pelletAngle) * this.pelletRange;
      const endY = startY + Math.sin(pelletAngle) * this.pelletRange;
      pellets.push({ endX, endY });

      for (const [targetId, target] of this.state.players) {
        if (target.role !== "hider" || !target.alive || hitIds.has(targetId)) continue;
        const hit = this.distancePointToSegment(
          target.x, target.y, startX, startY, endX, endY,
        ) <= 18;
        if (!hit) continue;
        if (this.isHiderHardened(targetId)) {
          if (!hardenedBlockedIds.has(targetId)) {
            hardenedBlockedIds.add(targetId);
            this.broadcastHardenedHit(targetId, target.x, target.y);
          }
          continue;
        }
        hitIds.add(targetId);
      }
    }

    for (const hitId of hitIds) {
      const target = this.state.players.get(hitId);
      if (!target || target.role !== "hider" || !target.alive) continue;
      if (!this.victoryFoundHiders.some((entry) => entry.sessionId === hitId)) {
        this.victoryFoundHiders.push({
          sessionId: hitId,
          name: String(target.name ?? "Hider").slice(0, 32),
          x: target.x,
          y: target.y,
          foundOrder: this.victoryFoundHiders.length + 1,
          foundAt: now,
          foundByHunterSessionId: sessionId,
          foundByHunterClientKey: sessionId,
        });
      }
      target.alive = false;
    }

    const precisionReward = hitIds.size > 0 ? hitIds.size * 100 : 0;
    hunterStats.precisionPoints += precisionReward;
    this.broadcast("shot_fired", {
      shooterId: sessionId,
      startX,
      startY,
      pellets,
      hitIds: [...hitIds],
      precisionReward,
      reserve: hunterStats.reserve,
      precisionPoints: hunterStats.precisionPoints,
    });

    if (hitIds.size > 0 && this.getAliveHiderCount() === 0) {
      this.finishGame("hunters");
    }

    return { fired: true, hit: hitIds.size > 0 };
  }`,
  'server bot shot result',
);

if (!server.includes(MARK)) {
  server = `/* ${MARK}: stationary Hider bots, human-speed Hunter bots, reactive miss-search + taunt/motion attention. */\n` + server;
}
if (!game.includes(MARK)) {
  game = `/* ${MARK}: timing spacing + virtual Lobby bot previews + roster visibility heal. */\n` + game;
}

/* Safety assertions. */
for (const [label, source, tokens] of [
  ['GameScene', game, [MARK, 'colorhunt-v565e-timing-breathing-room', 'updateLobbyBotPreviewActors', 'updateLobbyRosterVisibilityHeal', 'TIMING_INLINE_FINAL_LOCK']],
  ['NetworkPlayerManager', manager, [MARK, 'network-bot-robot-overlay', 'refreshBotRobotVisual']],
  ['MyRoom', server, [MARK, 'speed: 125', 'A miss/blocked shot is a stimulus to SEARCH', 'threshold * 0.42', 'tickHiderBot(_sessionId']],
]) {
  for (const token of tokens) {
    if (!source.includes(token)) fail(`${label}: safety assertion missing ${token}`);
  }
}

/* Transactional writes only after every transformation succeeds. */
const backupDir = path.join(path.dirname(gameFile), '..', '..', '.patch-backups');
const serverBackupDir = path.join(path.dirname(serverFile), '..', '..', '.patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
fs.mkdirSync(serverBackupDir, { recursive: true });
fs.writeFileSync(path.join(backupDir, 'GameScene-before-v0.10.10.565e.ts'), gameOriginal, 'utf8');
fs.writeFileSync(path.join(backupDir, 'NetworkPlayerManager-before-v0.10.10.565e.ts'), managerOriginal, 'utf8');
fs.writeFileSync(path.join(serverBackupDir, 'MyRoom-before-v0.10.10.565e.ts'), serverOriginal, 'utf8');
fs.writeFileSync(gameFile, game, 'utf8');
fs.writeFileSync(managerFile, manager, 'utf8');
fs.writeFileSync(serverFile, server, 'utf8');

console.log('');
console.log('[done] v0.10.10.565e BOT AI + VISUAL + LOBBY POLISH applied');
console.log('[ui] Paint/Hunt timing cards now get unconditional 7px top / 8px bottom breathing room.');
console.log('[lobby] Virtual bots are visible immediately as local robot previews; no PlayerState churn/reconnect risk.');
console.log('[lobby] Stationary newly joined humans are re-synced every 350ms without any network send.');
console.log('[visual] Physical bots are robot-styled in Lobby; Hunter bots remain robot-styled in Hunt.');
console.log('[safe] Hider-bot robot overlay is hidden during Paint/Hunt so camouflage remains fair.');
console.log('[ai] Hider bots do not move after hiding.');
console.log('[ai] EASY/NORMAL/HARD Hunter bots all move at human Hunter speed 125.');
console.log('[ai] A real fired miss/blocked Hardened shot triggers reposition/search instead of infinite stationary fire.');
console.log('[ai] Moving and Hardened-taunting Hiders get much faster, wider-FOV attention while still requiring local FOV/range.');
console.log('NEXT:');
console.log('  cd C:\\Users\\bak12\\color-hunt-server && npm run build');
console.log('  cd C:\\Users\\bak12\\color-hunt && npm run build');
