const fs = require('fs');
const path = require('path');

const MARK = 'V1010565G_BOT_HUMANIZED_HUNT';
const cwd = process.cwd();

function fail(msg) { throw new Error(msg + ' No file written.'); }
function mustFile(candidates, label) {
  const f = candidates.find((p) => fs.existsSync(p));
  if (!f) fail(`${label} not found. Checked:\n${candidates.join('\n')}`);
  return f;
}
function countOf(s, needle) { return s.split(needle).length - 1; }
function replaceOnce(s, before, after, label) {
  const n = countOf(s, before);
  if (n !== 1) fail(`${label}: expected exactly 1 match, found ${n}.`);
  return s.replace(before, after);
}
function replaceMethod(source, startNeedle, endNeedle, replacement, label) {
  const start = source.indexOf(startNeedle);
  if (start < 0) fail(`${label}: start anchor missing.`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  if (end < 0) fail(`${label}: end anchor missing.`);
  return source.slice(0, start) + replacement + '\n\n' + source.slice(end);
}

const clientRoots = [cwd, path.resolve(cwd, '..', 'color-hunt')];
const serverRoots = [path.resolve(cwd, '..', 'color-hunt-server'), cwd];
const gameFile = mustFile(clientRoots.map((r) => path.join(r, 'src', 'game', 'GameScene.ts')), 'GameScene.ts');
const netFile = mustFile(clientRoots.map((r) => path.join(r, 'src', 'network', 'MultiplayerClient.ts')), 'MultiplayerClient.ts');
const serverFile = mustFile(serverRoots.map((r) => path.join(r, 'src', 'rooms', 'MyRoom.ts')), 'MyRoom.ts');

let game = fs.readFileSync(gameFile, 'utf8');
let net = fs.readFileSync(netFile, 'utf8');
let server = fs.readFileSync(serverFile, 'utf8');
const gameOriginal = game;
const netOriginal = net;
const serverOriginal = server;

if (game.includes(MARK) && net.includes(MARK) && server.includes(MARK)) {
  console.log('[skip] v0.10.10.565g already applied.');
  process.exit(0);
}
if (!game.includes('V1010565F_BOT_ROBOT_NATIVE_SCALE_SPAWN')) fail('GameScene v565f marker missing.');
if (!server.includes('V1010565E_BOT_AI_VISUAL_LOBBY_POLISH')) fail('MyRoom v565e marker missing.');
if (!net.includes('V1010565_BOTS_V1')) fail('MultiplayerClient v565 bot marker missing.');

/* -------------------------------------------------------------------------
 * SERVER: humanize full-detection -> firing.
 *  - once a locked target enters shotgun range, STOP
 *  - sweep aim around the target for a readable inspection beat
 *  - randomly fire quickly or hesitate a little longer
 *  - exactly 20% mercy: sigh, ignore that target briefly, walk away
 *  - movement/taunt sensitivity from v565e is preserved
 * ---------------------------------------------------------------------- */
server = replaceOnce(
  server,
`type BotBrain = {
  heading: number;
  patrolX: number;
  patrolY: number;
  targetId: string;
  candidateId: string;
  candidateSeenSince: number;
  lastSeenX: number;
  lastSeenY: number;
  lastSeenAt: number;
  nextDecisionAt: number;
  modeUntil: number;
  lastAimBroadcastAt: number;
};`,
`type BotBrain = {
  heading: number;
  patrolX: number;
  patrolY: number;
  targetId: string;
  candidateId: string;
  candidateSeenSince: number;
  lastSeenX: number;
  lastSeenY: number;
  lastSeenAt: number;
  nextDecisionAt: number;
  modeUntil: number;
  lastAimBroadcastAt: number;

  /* ${MARK}: short human-like inspection beat before a bot fires. */
  inspectTargetId: string;
  inspectStartedAt: number;
  inspectSweepEndsAt: number;
  inspectFireAt: number;
  inspectMercy: boolean;
  inspectMercyShown: boolean;
  ignoreTargetId: string;
  ignoreTargetUntil: number;
};`,
  'server BotBrain fields',
);

server = replaceOnce(
  server,
`      nextDecisionAt: 0,
      modeUntil: 0,
      lastAimBroadcastAt: 0,
    };`,
`      nextDecisionAt: 0,
      modeUntil: 0,
      lastAimBroadcastAt: 0,
      inspectTargetId: "",
      inspectStartedAt: 0,
      inspectSweepEndsAt: 0,
      inspectFireAt: 0,
      inspectMercy: false,
      inspectMercyShown: false,
      ignoreTargetId: "",
      ignoreTargetUntil: 0,
    };`,
  'server makeBotBrain init',
);

server = replaceMethod(
  server,
  `  private tickHunterBot(sessionId: string, player: PlayerState, now: number): void {\n`,
  `  private moveBotToward(\n`,
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

    if (brain.ignoreTargetId && now >= brain.ignoreTargetUntil) {
      brain.ignoreTargetId = "";
      brain.ignoreTargetUntil = 0;
    }

    let candidateId = "";
    let candidateDistance = Number.POSITIVE_INFINITY;

    /* After a real fired miss, move/search briefly instead of instantly re-locking. */
    if (!searchingAfterMiss) {
      for (const [targetId, target] of this.state.players) {
        if (target.role !== "hider" || !target.alive) continue;
        if (
          targetId === brain.ignoreTargetId &&
          now < brain.ignoreTargetUntil
        ) continue;

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

      /* Taunting/movement remain strong visual stimuli from v565e. */
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
        brain.inspectTargetId = "";
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
          brain.inspectTargetId = "";
        }
      }
    }

    /*
     * ${MARK} / STOP_LOOK_HESITATE
     * Once the bot has 100% committed to a target AND is actually in shotgun
     * range, it does not swoop straight into an instant shot.  It plants its
     * feet, visually sweeps its aim above/below the target, then either fires
     * quickly or hesitates for a short random beat.
     */
    const inspectTarget = brain.targetId
      ? this.state.players.get(brain.targetId)
      : undefined;
    const canStartInspection =
      !searchingAfterMiss &&
      inspectTarget &&
      inspectTarget.role === "hider" &&
      inspectTarget.alive &&
      targetVisible &&
      lockedTargetDistance <= this.pelletRange * 0.98;

    if (
      canStartInspection &&
      brain.inspectTargetId !== brain.targetId
    ) {
      const sweepMs =
        this.botDifficulty === "easy"
          ? 900 + Math.random() * 500
          : this.botDifficulty === "hard"
            ? 430 + Math.random() * 320
            : 620 + Math.random() * 430;

      /* About half snap-shot after the sweep; half wait a bit longer. */
      const extraFireDelay =
        Math.random() < 0.55
          ? 80 + Math.random() * 240
          : 420 + Math.random() * 620;

      brain.inspectTargetId = brain.targetId;
      brain.inspectStartedAt = now;
      brain.inspectSweepEndsAt = now + sweepMs;
      brain.inspectFireAt = now + sweepMs + extraFireDelay;
      brain.inspectMercy = Math.random() < 0.20;
      brain.inspectMercyShown = false;
    }

    if (brain.inspectTargetId) {
      const target = this.state.players.get(brain.inspectTargetId);
      if (!target || target.role !== "hider" || !target.alive) {
        brain.inspectTargetId = "";
      } else {
        /*
         * Keep the old limited-vision contract even during the dramatic pause:
         * if the Hider actually escapes our attention, do NOT keep tracking its
         * hidden authoritative coordinates. Search the last seen point instead.
         */
        if (!targetVisible && now - brain.lastSeenAt > 420) {
          brain.inspectTargetId = "";
          brain.targetId = "";
          brain.candidateId = "";
          brain.candidateSeenSince = 0;
          brain.modeUntil = now + 700 + Math.random() * 450;
          const a = Math.random() * Math.PI * 2;
          const r = 45 + Math.random() * 65;
          brain.patrolX = Math.max(28, Math.min(932, brain.lastSeenX + Math.cos(a) * r));
          brain.patrolY = Math.max(44, Math.min(506, brain.lastSeenY + Math.sin(a) * r));
          return;
        }

        const aimX = targetVisible ? target.x : brain.lastSeenX;
        const aimY = targetVisible ? target.y : brain.lastSeenY;
        const perfectAngle = Math.atan2(aimY - player.y, aimX - player.x);
        const elapsed = Math.max(0, now - brain.inspectStartedAt);
        const sweepDuration = Math.max(1, brain.inspectSweepEndsAt - brain.inspectStartedAt);
        const sweepProgress = Math.max(0, Math.min(1, elapsed / sweepDuration));

        /*
         * Literal screen-Y sweep: the cone looks a little above and below the
         * Hider rather than roboticly pinning its center the whole time.
         */
        const sweepWave = Math.sin(elapsed / 115 * Math.PI);
        const sweepOffsetY = sweepWave * (24 - sweepProgress * 7);
        const scanAngle = Math.atan2(
          aimY + sweepOffsetY - player.y,
          aimX - player.x,
        );
        brain.heading = this.turnBotAngleToward(
          brain.heading,
          scanAngle,
          cfg.turnRateRad * 0.11,
        );

        /* Intentionally NO moveBotToward() here: this pause creates tension. */
        if (now - brain.lastAimBroadcastAt >= 75) {
          brain.lastAimBroadcastAt = now;
          this.broadcast("hunter_aim", {
            sessionId,
            angle: brain.heading,
            range: this.pelletRange,
          });
        }

        if (now >= brain.inspectSweepEndsAt && brain.inspectMercy) {
          if (!brain.inspectMercyShown) {
            brain.inspectMercyShown = true;
            this.broadcast("bot_mercy", {
              sessionId,
              x: player.x,
              y: player.y,
              serverNow: now,
            });
          }

          /* "후... 봐준다" — ignore only THIS Hider for a few seconds and
           * deliberately veer away instead of freezing in front of them. */
          brain.ignoreTargetId = brain.inspectTargetId;
          brain.ignoreTargetUntil = now + 3_500 + Math.random() * 1_800;
          brain.targetId = "";
          brain.candidateId = "";
          brain.candidateSeenSince = 0;
          brain.inspectTargetId = "";

          const away = perfectAngle + Math.PI + (Math.random() - 0.5) * 1.35;
          const travel = 115 + Math.random() * 95;
          brain.patrolX = Math.max(28, Math.min(932, player.x + Math.cos(away) * travel));
          brain.patrolY = Math.max(44, Math.min(506, player.y + Math.sin(away) * travel));
          brain.nextDecisionAt = brain.ignoreTargetUntil;
          return;
        }

        if (now >= brain.inspectFireAt && !brain.inspectMercy) {
          const error = (Math.random() * 2 - 1) * cfg.aimErrorRad;
          const shot = this.fireBotHunterShot(sessionId, perfectAngle + error, now);

          if (shot.fired) {
            brain.inspectTargetId = "";

            if (!shot.hit) {
              /* Existing v565e miss response: move around the last sighting. */
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
            return;
          }

          /* Overheated/cooldown edge: don't become a permanent staring turret. */
          if (now - brain.inspectFireAt > 1_250) {
            brain.inspectTargetId = "";
            brain.targetId = "";
            brain.candidateId = "";
            brain.modeUntil = now + 650;
            brain.patrolX = Math.max(28, Math.min(932, player.x + (Math.random() - 0.5) * 150));
            brain.patrolY = Math.max(44, Math.min(506, player.y + (Math.random() - 0.5) * 130));
          }
        }
        return;
      }
    }

    if (!brain.targetId || searchingAfterMiss) {
      const toPatrol = Math.hypot(brain.patrolX - player.x, brain.patrolY - player.y);
      if (searchingAfterMiss) {
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
  }`,
  'server humanized tickHunterBot',
);

if (!server.includes(MARK)) {
  server = `/* ${MARK}: Hunter bots stop, inspect, hesitate, and sometimes spare a detected Hider. */\n` + server;
}

/* -------------------------------------------------------------------------
 * NETWORK CLIENT: tiny dedicated visual event; no gameplay authority here.
 * ---------------------------------------------------------------------- */
net = replaceOnce(
  net,
`export type HiderHardenedStateHandler = (state: NetworkHiderHardenedState) => void;
export type HiderHardenedHitHandler = (event: NetworkHiderHardenedHit) => void;`,
`export type HiderHardenedStateHandler = (state: NetworkHiderHardenedState) => void;
export type HiderHardenedHitHandler = (event: NetworkHiderHardenedHit) => void;

/* ${MARK}: visual-only Hunter-bot mercy/sigh cue. */
export type NetworkBotMercy = {
  sessionId: string;
  x: number;
  y: number;
  serverNow: number;
};
export type BotMercyHandler = (event: NetworkBotMercy) => void;`,
  'net bot mercy types',
);

net = replaceOnce(
  net,
`  private readonly hiderHardenedStateHandlers = new Set<HiderHardenedStateHandler>();
  private readonly hiderHardenedHitHandlers = new Set<HiderHardenedHitHandler>();`,
`  private readonly hiderHardenedStateHandlers = new Set<HiderHardenedStateHandler>();
  private readonly hiderHardenedHitHandlers = new Set<HiderHardenedHitHandler>();
  private readonly botMercyHandlers = new Set<BotMercyHandler>();`,
  'net mercy handler set',
);

net = replaceOnce(
  net,
`    room.onMessage<NetworkHiderHardenedHit>("hider_hardened_hit", (payload) => {
      this.hiderHardenedHitHandlers.forEach((handler) => handler({
        sessionId: String(payload?.sessionId ?? ""), x: Number(payload?.x ?? 0), y: Number(payload?.y ?? 0),
        pose: Math.max(1, Math.min(5, Number(payload?.pose) || 1)), endsAt: Number(payload?.endsAt ?? 0), serverNow: Number(payload?.serverNow ?? Date.now()),
      }));
    });`,
`    room.onMessage<NetworkHiderHardenedHit>("hider_hardened_hit", (payload) => {
      this.hiderHardenedHitHandlers.forEach((handler) => handler({
        sessionId: String(payload?.sessionId ?? ""), x: Number(payload?.x ?? 0), y: Number(payload?.y ?? 0),
        pose: Math.max(1, Math.min(5, Number(payload?.pose) || 1)), endsAt: Number(payload?.endsAt ?? 0), serverNow: Number(payload?.serverNow ?? Date.now()),
      }));
    });
    room.onMessage<NetworkBotMercy>("bot_mercy", (payload) => {
      this.botMercyHandlers.forEach((handler) => handler({
        sessionId: String(payload?.sessionId ?? ""),
        x: Number(payload?.x ?? 0),
        y: Number(payload?.y ?? 0),
        serverNow: Number(payload?.serverNow ?? Date.now()),
      }));
    });`,
  'net room bot mercy message',
);

net = replaceOnce(
  net,
`  onHiderHardenedHit(handler: HiderHardenedHitHandler): () => void {
    this.hiderHardenedHitHandlers.add(handler); return () => this.hiderHardenedHitHandlers.delete(handler);
  }`,
`  onHiderHardenedHit(handler: HiderHardenedHitHandler): () => void {
    this.hiderHardenedHitHandlers.add(handler); return () => this.hiderHardenedHitHandlers.delete(handler);
  }
  onBotMercy(handler: BotMercyHandler): () => void {
    this.botMercyHandlers.add(handler);
    return () => this.botMercyHandlers.delete(handler);
  }`,
  'net onBotMercy public handler',
);

if (!net.includes(MARK)) {
  net = `/* ${MARK}: visual-only bot mercy event plumbing. */\n` + net;
}

/* -------------------------------------------------------------------------
 * GAME SCENE: small readable sigh above the bot, then it walks away.
 * No sound dependency; works for muted players too.
 * ---------------------------------------------------------------------- */
game = replaceOnce(
  game,
`    type NetworkHiderHardenedState,
    type NetworkHiderHardenedHit,`,
`    type NetworkHiderHardenedState,
    type NetworkHiderHardenedHit,
    type NetworkBotMercy,`,
  'game import NetworkBotMercy',
);

const applyAnchor = `    private applyHardenedState(state:NetworkHiderHardenedState):void {`;
if (!game.includes(applyAnchor)) fail('GameScene applyHardenedState anchor missing.');
if (!game.includes('private applyBotMercy(')) {
  const mercyMethod = `    /* ${MARK}: visual-only 20% mercy cue. */
    private applyBotMercy(event: NetworkBotMercy): void {
        if (this.phase !== 'hunt') {
            return;
        }

        const language = getLanguage();
        const sigh =
            language === 'ja'
                ? 'ふぅ…'
                : language === 'en'
                    ? 'Phew…'
                    : '후…';

        const puff = this.add
            .ellipse(
                event.x + 13,
                event.y - 28,
                17,
                9,
                0xe9f5f4,
                0.82,
            )
            .setStrokeStyle(
                1,
                0x6d8588,
                0.72,
            )
            .setDepth(1130);

        const text = this.add
            .text(
                event.x,
                event.y - 42,
                sigh,
                {
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    fontStyle: 'bold',
                    color: '#405b61',
                    backgroundColor: '#f2fbf8e8',
                    padding: {
                        x: 6,
                        y: 3,
                    },
                },
            )
            .setOrigin(0.5, 1)
            .setDepth(1131);

        this.tweens.add({
            targets: [puff, text],
            y: '-=14',
            alpha: 0,
            duration: 1050,
            ease: 'Cubic.Out',
            onComplete: () => {
                puff.destroy();
                text.destroy();
            },
        });
    }

`;
  game = game.replace(applyAnchor, mercyMethod + applyAnchor);
}

game = replaceOnce(
  game,
`        this.networkUnsubscribers.push(multiplayerClient.onHiderHardenedHit((event: NetworkHiderHardenedHit) => this.applyHardenedHit(event)));`,
`        this.networkUnsubscribers.push(multiplayerClient.onHiderHardenedHit((event: NetworkHiderHardenedHit) => this.applyHardenedHit(event)));
        this.networkUnsubscribers.push(multiplayerClient.onBotMercy((event: NetworkBotMercy) => this.applyBotMercy(event)));`,
  'game register bot mercy listener',
);

if (!game.includes(MARK)) {
  game = `/* ${MARK}: Hunter-bot inspect/mercy visual cue. */\n` + game;
}

/* Safety assertions. */
for (const [label, source, tokens] of [
  ['MyRoom', server, [MARK, 'STOP_LOOK_HESITATE', 'Math.random() < 0.20', 'bot_mercy', 'inspectSweepEndsAt', 'ignoreTargetUntil']],
  ['MultiplayerClient', net, [MARK, 'NetworkBotMercy', 'botMercyHandlers', 'onBotMercy']],
  ['GameScene', game, [MARK, 'applyBotMercy', "language === 'ja'", 'onBotMercy']],
]) {
  for (const token of tokens) {
    if (!source.includes(token)) fail(`${label}: safety token missing: ${token}`);
  }
}

const backupDir = path.join(path.dirname(gameFile), '..', '..', '.patch-backups');
const serverBackupDir = path.join(path.dirname(serverFile), '..', '..', '.patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
fs.mkdirSync(serverBackupDir, { recursive: true });
fs.writeFileSync(path.join(backupDir, 'GameScene-before-v0.10.10.565g.ts'), gameOriginal, 'utf8');
fs.writeFileSync(path.join(backupDir, 'MultiplayerClient-before-v0.10.10.565g.ts'), netOriginal, 'utf8');
fs.writeFileSync(path.join(serverBackupDir, 'MyRoom-before-v0.10.10.565g.ts'), serverOriginal, 'utf8');
fs.writeFileSync(gameFile, game, 'utf8');
fs.writeFileSync(netFile, net, 'utf8');
fs.writeFileSync(serverFile, server, 'utf8');

console.log('');
console.log('[done] v0.10.10.565g BOT HUMANIZED HUNT applied');
console.log('[ai] Full detection no longer means instant drive-by firing.');
console.log('[ai] In shotgun range, Hunter bot stops and sweeps aim around the Hider before deciding.');
console.log('[ai] After the sweep: ~55% quick follow-up, ~45% extra hesitation before firing.');
console.log('[ai] Exactly 20% mercy: visual sigh, no shot, ignore that Hider for ~3.5-5.3s, walk away.');
console.log('[ai] v565e movement/taunt sensitivity and miss->search behavior are preserved.');
console.log('[visual] Mercy cue is muted-player-safe: 후… / ふぅ… / Phew… + breath puff.');
console.log('NEXT:');
console.log('  cd C:\\Users\\bak12\\color-hunt-server && npm run build');
console.log('  cd C:\\Users\\bak12\\color-hunt && npm run build');
