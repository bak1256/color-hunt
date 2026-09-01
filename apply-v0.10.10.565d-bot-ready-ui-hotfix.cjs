const fs = require('fs');
const path = require('path');

const MARK_CLIENT = 'V1010565D_TIMING_PADDING_RESTORE';
const MARK_SERVER = 'V1010565D_BOT_READY_EARLY_HUNT';

const cwd = process.cwd();
const clientFile = path.resolve(cwd, 'src', 'game', 'GameScene.ts');
const serverFile = path.resolve(cwd, '..', 'color-hunt-server', 'src', 'rooms', 'MyRoom.ts');

function fail(message) {
  throw new Error(message + ' No file written.');
}

if (!fs.existsSync(clientFile)) {
  fail(`Client GameScene.ts not found at ${clientFile}. Run from C:\\Users\\bak12\\color-hunt.`);
}
if (!fs.existsSync(serverFile)) {
  fail(`Server MyRoom.ts not found at ${serverFile}. Expected sibling repo C:\\Users\\bak12\\color-hunt-server.`);
}

let client = fs.readFileSync(clientFile, 'utf8');
let server = fs.readFileSync(serverFile, 'utf8');
const clientOriginal = client;
const serverOriginal = server;

if (!client.includes('V1010565C_BOT_UI_TRACK_HOTFIX')) {
  fail('Expected v565c bot UI track hotfix marker in GameScene.ts.');
}
if (!server.includes('V1010565B_BOT_LOBBY_RECONNECT_HOTFIX')) {
  fail('Expected v565b bot lobby hotfix marker in MyRoom.ts.');
}

/* -------------------------------------------------------------------------
 * CLIENT: restore the same comfortable inner vertical whitespace that Paint
 * and Hunt cards had before the Bot row was introduced.  Do not squeeze the
 * buttons; grow the natural timing stack and let the existing whole-panel
 * mobile scaler fit the complete card into one screen.
 * ---------------------------------------------------------------------- */
if (!client.includes(MARK_CLIENT)) {
  const anchor = `        this.waitingRoomInfo =\n            root.querySelector('.ch-waiting-info') ?? undefined;`;
  if (!client.includes(anchor)) {
    fail('GameScene waitingRoomInfo anchor not found.');
  }

  const block = `        /*\n         * ${MARK_CLIENT}\n         * v565c fixed clipping by giving Bot a real grid row, but Paint/Hunt\n         * were left at 65px and inherited the older compact 3px vertical\n         * padding. Restore the known comfortable 73px timing-card geometry:\n         * 7px top + 18px title + 7px gap + 31px controls + 8px bottom.\n         * The WHOLE waiting panel is still uniformly scaled afterwards.\n         */\n        {\n            const styleId = 'colorhunt-v565d-timing-padding-restore';\n            document.getElementById(styleId)?.remove();\n\n            const style = document.createElement('style');\n            style.id = styleId;\n            style.textContent = \`\n                .colorhunt-waiting-room.ch-uniform-mobile-scale\n                .ch-waiting-timing {\n                    grid-template-rows: 118px 73px 73px !important;\n                    grid-auto-rows: max-content !important;\n                    row-gap: 7px !important;\n                    gap: 7px !important;\n                    height: 278px !important;\n                    min-height: 278px !important;\n                    max-height: 278px !important;\n                    flex: 0 0 278px !important;\n                    overflow: visible !important;\n                }\n\n                .colorhunt-waiting-room.ch-uniform-mobile-scale\n                .ch-waiting-timing\n                > section:not(.ch-waiting-bot-section) {\n                    position: relative !important;\n                    display: grid !important;\n                    grid-template-columns: minmax(0, 1fr) !important;\n                    grid-template-rows: 18px 31px !important;\n                    align-content: start !important;\n                    row-gap: 7px !important;\n                    gap: 7px !important;\n                    width: 100% !important;\n                    height: 73px !important;\n                    min-height: 73px !important;\n                    max-height: 73px !important;\n                    margin: 0 !important;\n                    padding: 7px 7px 8px !important;\n                    box-sizing: border-box !important;\n                    overflow: hidden !important;\n                }\n\n                .colorhunt-waiting-room.ch-uniform-mobile-scale\n                .ch-waiting-timing\n                > section:not(.ch-waiting-bot-section)\n                .ch-waiting-timing-title {\n                    position: static !important;\n                    inset: auto !important;\n                    transform: none !important;\n                    display: flex !important;\n                    align-items: center !important;\n                    justify-content: space-between !important;\n                    gap: 6px !important;\n                    width: 100% !important;\n                    height: 18px !important;\n                    min-height: 18px !important;\n                    max-height: 18px !important;\n                    margin: 0 !important;\n                    padding: 0 1px !important;\n                    box-sizing: border-box !important;\n                    line-height: 18px !important;\n                    overflow: visible !important;\n                }\n\n                .colorhunt-waiting-room.ch-uniform-mobile-scale\n                .ch-waiting-timing\n                > section:not(.ch-waiting-bot-section)\n                .ch-waiting-time-options {\n                    position: static !important;\n                    inset: auto !important;\n                    transform: none !important;\n                    display: grid !important;\n                    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;\n                    gap: 5px !important;\n                    width: 100% !important;\n                    height: 31px !important;\n                    min-height: 31px !important;\n                    max-height: 31px !important;\n                    margin: 0 !important;\n                    padding: 0 !important;\n                    box-sizing: border-box !important;\n                }\n\n                .colorhunt-waiting-room.ch-uniform-mobile-scale\n                .ch-waiting-timing\n                > section:not(.ch-waiting-bot-section)\n                .ch-waiting-time-options button {\n                    width: 100% !important;\n                    height: 31px !important;\n                    min-height: 31px !important;\n                    max-height: 31px !important;\n                    margin: 0 !important;\n                    padding: 0 4px !important;\n                    box-sizing: border-box !important;\n                    line-height: 1 !important;\n                }\n            \`;\n\n            document.head.appendChild(style);\n        }\n\n`;

  client = client.replace(anchor, block + anchor);
}

/* -------------------------------------------------------------------------
 * SERVER FIX #1: a Bot Hider is an authoritative alive round participant even
 * though it has no WebSocket transport.  The old early-start gate required
 * liveSessionIds only, so a human Hunter's visible "Start Hunt Now" button
 * could never pass when any Hider was a bot.
 * ---------------------------------------------------------------------- */
const oldEarlyLiveGate = `          .every(\n            ([sessionId]) =>\n              this.liveSessionIds.has(\n                sessionId,\n              ) &&\n              !this.supersededSessionIds.has(\n                sessionId,\n              ),\n          );`;

const newEarlyLiveGate = `          .every(\n            ([sessionId]) =>\n              (\n                this.liveSessionIds.has(\n                  sessionId,\n                ) ||\n                this.botSessionIds.has(\n                  sessionId,\n                )\n              ) &&\n              !this.supersededSessionIds.has(\n                sessionId,\n              ),\n          );`;

if (!server.includes(MARK_SERVER)) {
  const gateCount = server.split(oldEarlyLiveGate).length - 1;
  if (gateCount !== 1) {
    fail(`Expected exactly one early-start allRoundHidersLive gate, found ${gateCount}.`);
  }
  server = server.replace(oldEarlyLiveGate, newEarlyLiveGate);

  /* -----------------------------------------------------------------------
   * SERVER FIX #2: when EVERY alive Hunter is a bot there is no human Hunter
   * who can click "Start Hunt Now".  Simulation tick performs the click's
   * server-side equivalent once every alive Hider is READY.  It still obeys
   * the existing canEnterHuntFromPaint() topology/convergence barrier.
   * -------------------------------------------------------------------- */
  const tickAnchor = `  private tickBots(): void {\n    if (this.botSessionIds.size < 1) return;`;
  if (!server.includes(tickAnchor)) {
    fail('tickBots() anchor not found.');
  }

  const helper = `  /*\n   * ${MARK_SERVER}\n   * If no human Hunter exists, nobody can press the Hunter-only early-start\n   * button. Treat all-bot Hunters as consenting automatically, but ONLY after\n   * every alive Hider is READY and the existing Paint->Hunt safety barrier is\n   * satisfied. Bots still do not invoke skills/ultimates/taunts.\n   */\n  private tryAutoStartHuntForBotHunters(\n    now = Date.now(),\n  ): void {\n    if (this.state.phase !== "paint") return;\n\n    const aliveHunterIds =\n      [...this.state.players.entries()]\n        .filter(\n          ([, player]) =>\n            player.role === "hunter" &&\n            player.alive,\n        )\n        .map(([sessionId]) => sessionId);\n\n    if (\n      aliveHunterIds.length < 1 ||\n      !aliveHunterIds.every(\n        (sessionId) =>\n          this.botSessionIds.has(sessionId),\n      )\n    ) {\n      return;\n    }\n\n    const readyState =\n      this.getPaintReadyState();\n\n    if (\n      readyState.total < 1 ||\n      !readyState.allHidersReady ||\n      !this.canEnterHuntFromPaint(now)\n    ) {\n      return;\n    }\n\n    /* Match the existing human-Hunter early_start_hunt path: open the\n     * authoritative Paint deadline before entering startHuntPhase(). */\n    this.state.phaseEndsAt =\n      Date.now();\n\n    this.startHuntPhase();\n  }\n\n`;

  server = server.replace(tickAnchor, helper + tickAnchor);

  const paintTickReturn = `        this.botPaintFallbackAt = Number.POSITIVE_INFINITY;\n        if (fallbackApplied) this.broadcastPaintReadyState();\n      }\n      return;\n    }`;
  const paintTickReturnNew = `        this.botPaintFallbackAt = Number.POSITIVE_INFINITY;\n        if (fallbackApplied) this.broadcastPaintReadyState();\n      }\n\n      /* ${MARK_SERVER}: all-bot Hunter teams auto-accept an all-Hider READY state. */\n      this.tryAutoStartHuntForBotHunters(now);\n      return;\n    }`;

  if (!server.includes(paintTickReturn)) {
    fail('Paint branch in tickBots() not found.');
  }
  server = server.replace(paintTickReturn, paintTickReturnNew);
}

for (const [label, text, tokens] of [
  ['client', client, [
    MARK_CLIENT,
    'grid-template-rows: 118px 73px 73px !important',
    'padding: 7px 7px 8px !important',
    'colorhunt-v565d-timing-padding-restore',
  ]],
  ['server', server, [
    MARK_SERVER,
    'this.botSessionIds.has(',
    'tryAutoStartHuntForBotHunters',
    'this.startHuntPhase();',
  ]],
]) {
  for (const token of tokens) {
    if (!text.includes(token)) fail(`${label} safety token missing: ${token}`);
  }
}

if (client === clientOriginal && server === serverOriginal) {
  console.log('[skip] v0.10.10.565d already applied');
  process.exit(0);
}

fs.mkdirSync(path.join(cwd, '.patch-backups'), { recursive: true });
fs.mkdirSync(path.join(cwd, '..', 'color-hunt-server', '.patch-backups'), { recursive: true });

if (client !== clientOriginal) {
  fs.writeFileSync(
    path.join(cwd, '.patch-backups', 'GameScene-before-v0.10.10.565d.ts'),
    clientOriginal,
    'utf8',
  );
}
if (server !== serverOriginal) {
  fs.writeFileSync(
    path.join(cwd, '..', 'color-hunt-server', '.patch-backups', 'MyRoom-before-v0.10.10.565d.ts'),
    serverOriginal,
    'utf8',
  );
}

fs.writeFileSync(clientFile, client, 'utf8');
fs.writeFileSync(serverFile, server, 'utf8');

console.log('');
console.log('[done] v0.10.10.565d BOT READY + TIMING PADDING HOTFIX applied');
console.log('[ui] Paint/Hunt cards restored to 73px with 7/8px vertical inner breathing room.');
console.log('[ui] Bot/Paint/Hunt natural stack = 118/73/73; existing whole-panel scaler still fits one screen.');
console.log('[server] Human Hunter early-start accepts Bot Hiders as live round participants.');
console.log('[server] If ALL alive Hunters are bots, all-Hider READY automatically starts Hunt after safety convergence.');
console.log('[safe] Bots still do not use taunt/fart/sniper/vulcan/hardening/ultimate controls.');
console.log('Next:');
console.log('  cd ..\\color-hunt-server && npm run build');
console.log('  cd ..\\color-hunt && npm run build');
