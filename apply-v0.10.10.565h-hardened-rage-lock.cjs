const fs = require('fs');
const path = require('path');

const MARK = 'V1010565H_HARDENED_RAGE_LOCK';
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
  console.log('[skip] v0.10.10.565h already applied.');
  process.exit(0);
}
for (const [label, source] of [['GameScene', game], ['MultiplayerClient', net], ['MyRoom', server]]) {
  if (!source.includes('V1010565G_BOT_HUMANIZED_HUNT')) {
    fail(`${label}: v565g marker missing. Apply v0.10.10.565g first.`);
  }
}

/* -------------------------------------------------------------------------
 * SERVER
 * Hardened taunt is the one exception to normal bot mercy/hesitation.
 * Once a Hunter bot positively detects a Hardened Hider, that Hider becomes
 * a persistent RAGE target until eliminated. No speed/fire-rate cheats:
 * normal movement, shotgun cooldown, HEAT and aim error remain authoritative.
 * The bot still cannot see through walls/off-screen: if line of attention is
 * lost it searches the last seen area and only re-locks on local FOV/range.
 * ---------------------------------------------------------------------- */
server = replaceOnce(
  server,
`  ignoreTargetId: string;
  ignoreTargetUntil: number;
};`,
`  ignoreTargetId: string;
  ignoreTargetUntil: number;

  /* ${MARK}: Hardened taunt creates a persistent priority target. */
  rageTargetId: string;
};`,
  'server BotBrain rage field',
);

server = replaceOnce(
  server,
`      ignoreTargetId: "",
      ignoreTargetUntil: 0,
    };`,
`      ignoreTargetId: "",
      ignoreTargetUntil: 0,
      rageTargetId: "",
    };`,
  'server BotBrain rage init',
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

    /* ${MARK} / RAGE_LIFETIME: only death/removal ends the grudge. */
    if (brain.rageTargetId) {
      const rageTarget = this.state.players.get(brain.rageTargetId);
      if (!rageTarget || rageTarget.role !== "hider" || !rageTarget.alive) {
        if (brain.targetId === brain.rageTargetId) brain.targetId = "";
        if (brain.candidateId === brain.rageTargetId) brain.candidateId = "";
        if (brain.inspectTargetId === brain.rageTargetId) brain.inspectTargetId = "";
        brain.rageTargetId = "";
        brain.candidateSeenSince = 0;
      }
    }

    const rageActive = brain.rageTargetId.length > 0;
    /* Normal miss-search must never cancel an already activated RAGE. */
    const searchingAfterMiss = !rageActive && now < brain.modeUntil;

    if (brain.ignoreTargetId && now >= brain.ignoreTargetUntil) {
      brain.ignoreTargetId = "";
      brain.ignoreTargetUntil = 0;
    }
    if (rageActive) {
      /* Hardened target can never receive the 20% mercy cooldown. */
      brain.ignoreTargetId = "";
      brain.ignoreTargetUntil = 0;
    }

    let candidateId = "";
    let candidateDistance = Number.POSITIVE_INFINITY;

    if (!searchingAfterMiss) {
      for (const [targetId, target] of this.state.players) {
        if (target.role !== "hider" || !target.alive) continue;

        /* ${MARK}: while raging, every other Hider loses target priority. */
        if (rageActive && targetId !== brain.rageTargetId) continue;
        if (
          !rageActive &&
          targetId === brain.ignoreTargetId &&
          now < brain.ignoreTargetUntil
        ) continue;

        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const distance = Math.hypot(dx, dy);
        const taunting = this.isHiderHardened(targetId);
        const rageCandidate = targetId === brain.rageTargetId;
        const lastMoveAt = this.lastMoveAtBySessionId.get(targetId) ?? 0;
        const movingRecently = now - lastMoveAt < 1200;
        const attentionRange = cfg.visionRange *
          (rageCandidate ? 1.12 : taunting ? 1.10 : movingRecently ? 1.04 : 1);
        if (distance > attentionRange) continue;

        const angle = Math.atan2(dy, dx);
        const attentionHalfFov = Math.min(
          88 * Math.PI / 180,
          baseHalfFov +
            (movingRecently ? 14 * Math.PI / 180 : 0) +
            (taunting ? 30 * Math.PI / 180 : 0) +
            (rageCandidate ? 14 * Math.PI / 180 : 0),
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
      const rageCandidate = candidateId === brain.rageTargetId;
      const lastMoveAt = this.lastMoveAtBySessionId.get(candidateId) ?? 0;
      const movingRecently = now - lastMoveAt < 1200;
      const stealth = this.getCamouflageStealthScore(candidateId, now);
      const distanceFactor = Math.max(0, Math.min(1, candidateDistance / cfg.visionRange));
      let threshold =
        cfg.reactionBaseMs +
        stealth * cfg.stealthPenaltyMs +
        distanceFactor * 360;

      if (rageCandidate) threshold = Math.min(threshold, 70);
      else if (taunting) threshold = Math.min(threshold, movingRecently ? 70 : 160);
      else if (movingRecently) threshold = Math.max(120, threshold * 0.42);

      if (now - brain.candidateSeenSince >= threshold) {
        const target = this.state.players.get(candidateId);
        if (target) {
          brain.targetId = candidateId;
          brain.lastSeenX = target.x;
          brain.lastSeenY = target.y;
          brain.lastSeenAt = now;

          /*
           * ${MARK} / HARDENED_TAUNT_RAGE
           * First positive detection WHILE Hardened permanently flips this bot
           * into RAGE against that Hider.  Hardened expiring later does NOT
           * erase the grudge; only elimination/removal does.
           */
          if (taunting && !brain.rageTargetId) {
            brain.rageTargetId = candidateId;
            brain.ignoreTargetId = "";
            brain.ignoreTargetUntil = 0;
            brain.inspectMercy = false;
            brain.inspectMercyShown = false;
            brain.modeUntil = 0;
            this.broadcast("bot_rage", {
              sessionId,
              targetSessionId: candidateId,
              x: player.x,
              y: player.y,
              serverNow: now,
            });
          }
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
        const rageTracking = brain.targetId === brain.rageTargetId;
        const lastMoveAt = this.lastMoveAtBySessionId.get(brain.targetId) ?? 0;
        const movingRecently = now - lastMoveAt < 1200;
        const attentionHalfFov = Math.min(
          88 * Math.PI / 180,
          baseHalfFov +
            (movingRecently ? 14 * Math.PI / 180 : 0) +
            (taunting ? 30 * Math.PI / 180 : 0) +
            (rageTracking ? 14 * Math.PI / 180 : 0),
        );
        const attentionRange = cfg.visionRange *
          (rageTracking ? 1.12 : taunting ? 1.10 : movingRecently ? 1.04 : 1);
        const diff = Math.abs(this.normalizeBotAngle(angle - brain.heading));
        targetVisible = dist <= attentionRange &&
          (dist <= bodySafeRadius || diff <= attentionHalfFov);

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
          /* No coordinate cheating. RAGE survives, target lock does not. */
          brain.targetId = "";
          brain.inspectTargetId = "";
          if (rageTracking) {
            const a = Math.random() * Math.PI * 2;
            const r = 45 + Math.random() * 75;
            brain.patrolX = Math.max(28, Math.min(932, brain.lastSeenX + Math.cos(a) * r));
            brain.patrolY = Math.max(44, Math.min(506, brain.lastSeenY + Math.sin(a) * r));
            brain.nextDecisionAt = now + 650 + Math.random() * 550;
          }
        }
      }
    }

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
      const rageInspection = brain.targetId === brain.rageTargetId;
      const sweepMs = rageInspection
        ? 220 + Math.random() * 180
        : this.botDifficulty === "easy"
          ? 900 + Math.random() * 500
          : this.botDifficulty === "hard"
            ? 430 + Math.random() * 320
            : 620 + Math.random() * 430;

      const extraFireDelay = rageInspection
        ? 45 + Math.random() * 150
        : Math.random() < 0.55
          ? 80 + Math.random() * 240
          : 420 + Math.random() * 620;

      brain.inspectTargetId = brain.targetId;
      brain.inspectStartedAt = now;
      brain.inspectSweepEndsAt = now + sweepMs;
      brain.inspectFireAt = now + sweepMs + extraFireDelay;
      brain.inspectMercy = rageInspection ? false : Math.random() < 0.20;
      brain.inspectMercyShown = false;
    }

    if (brain.inspectTargetId) {
      const target = this.state.players.get(brain.inspectTargetId);
      const rageInspection = brain.inspectTargetId === brain.rageTargetId;

      if (!target || target.role !== "hider" || !target.alive) {
        brain.inspectTargetId = "";
        if (rageInspection) brain.rageTargetId = "";
      } else {
        if (!targetVisible && now - brain.lastSeenAt > 420) {
          brain.inspectTargetId = "";
          brain.targetId = "";
          brain.candidateId = "";
          brain.candidateSeenSince = 0;

          const a = Math.random() * Math.PI * 2;
          const r = 45 + Math.random() * 65;
          brain.patrolX = Math.max(28, Math.min(932, brain.lastSeenX + Math.cos(a) * r));
          brain.patrolY = Math.max(44, Math.min(506, brain.lastSeenY + Math.sin(a) * r));
          brain.nextDecisionAt = now + 650 + Math.random() * 550;

          /* Normal AI gets a brief miss/search lockout; RAGE immediately hunts. */
          if (!rageInspection) brain.modeUntil = now + 700 + Math.random() * 450;
          return;
        }

        const aimX = targetVisible ? target.x : brain.lastSeenX;
        const aimY = targetVisible ? target.y : brain.lastSeenY;
        const perfectAngle = Math.atan2(aimY - player.y, aimX - player.x);
        const elapsed = Math.max(0, now - brain.inspectStartedAt);
        const sweepDuration = Math.max(1, brain.inspectSweepEndsAt - brain.inspectStartedAt);
        const sweepProgress = Math.max(0, Math.min(1, elapsed / sweepDuration));
        const sweepWave = Math.sin(elapsed / 115 * Math.PI);
        const sweepAmplitude = rageInspection ? 13 : 24 - sweepProgress * 7;
        const sweepOffsetY = sweepWave * sweepAmplitude;
        const scanAngle = Math.atan2(
          aimY + sweepOffsetY - player.y,
          aimX - player.x,
        );
        brain.heading = this.turnBotAngleToward(
          brain.heading,
          scanAngle,
          cfg.turnRateRad * (rageInspection ? 0.13 : 0.11),
        );

        if (now - brain.lastAimBroadcastAt >= 75) {
          brain.lastAimBroadcastAt = now;
          this.broadcast("hunter_aim", {
            sessionId,
            angle: brain.heading,
            range: this.pelletRange,
          });
        }

        /* Normal 20% mercy is completely disabled in RAGE. */
        if (now >= brain.inspectSweepEndsAt && brain.inspectMercy && !rageInspection) {
          if (!brain.inspectMercyShown) {
            brain.inspectMercyShown = true;
            this.broadcast("bot_mercy", {
              sessionId,
              x: player.x,
              y: player.y,
              serverNow: now,
            });
          }

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

            if (rageInspection) {
              /*
               * ${MARK} / SHOOT_UNTIL_DEAD
               * Miss, blocked Hardened pellet, or surviving target: do NOT
               * forgive, do NOT switch targets, do NOT enter miss-search.
               * The next legal shotgun/HEAT window starts another short scan.
               */
              const stillAlive = this.state.players.get(brain.rageTargetId);
              if (!stillAlive || stillAlive.role !== "hider" || !stillAlive.alive) {
                brain.rageTargetId = "";
                brain.targetId = "";
                brain.candidateId = "";
              } else {
                brain.targetId = brain.rageTargetId;
                brain.candidateId = brain.rageTargetId;
                brain.candidateSeenSince = now;
                brain.lastSeenX = target.x;
                brain.lastSeenY = target.y;
                brain.lastSeenAt = now;
              }
              return;
            }

            if (!shot.hit) {
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

          if (rageInspection) {
            /* Cooldown/overheat waits in place; normal HEAT rules still win. */
            brain.inspectFireAt = now + 120;
            return;
          }

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

      if (brain.rageTargetId && !brain.targetId) {
        /* Persistent last-seen search: still no access to hidden live position. */
        if (toPatrol < 18 || now >= brain.nextDecisionAt) {
          const a = Math.random() * Math.PI * 2;
          const r = 42 + Math.random() * 78;
          brain.patrolX = Math.max(28, Math.min(932, brain.lastSeenX + Math.cos(a) * r));
          brain.patrolY = Math.max(44, Math.min(506, brain.lastSeenY + Math.sin(a) * r));
          brain.nextDecisionAt = now + 650 + Math.random() * 600;
        }
      } else if (searchingAfterMiss) {
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
  'server hardened rage tickHunterBot',
);

if (!server.includes(MARK)) {
  server = `/* ${MARK}: Hardened taunt locks Hunter bots into fair-speed RAGE until target elimination. */\n` + server;
}

/* -------------------------------------------------------------------------
 * NETWORK CLIENT: visual-only RAGE cue.
 * ---------------------------------------------------------------------- */
net = replaceOnce(
  net,
`export type BotMercyHandler = (event: NetworkBotMercy) => void;`,
`export type BotMercyHandler = (event: NetworkBotMercy) => void;

/* ${MARK}: visual-only bot RAGE lock cue. */
export type NetworkBotRage = {
  sessionId: string;
  targetSessionId: string;
  x: number;
  y: number;
  serverNow: number;
};
export type BotRageHandler = (event: NetworkBotRage) => void;`,
  'net bot rage types',
);

net = replaceOnce(
  net,
`  private readonly botMercyHandlers = new Set<BotMercyHandler>();`,
`  private readonly botMercyHandlers = new Set<BotMercyHandler>();
  private readonly botRageHandlers = new Set<BotRageHandler>();`,
  'net rage handler set',
);

net = replaceOnce(
  net,
`    room.onMessage<NetworkBotMercy>("bot_mercy", (payload) => {
      this.botMercyHandlers.forEach((handler) => handler({
        sessionId: String(payload?.sessionId ?? ""),
        x: Number(payload?.x ?? 0),
        y: Number(payload?.y ?? 0),
        serverNow: Number(payload?.serverNow ?? Date.now()),
      }));
    });`,
`    room.onMessage<NetworkBotMercy>("bot_mercy", (payload) => {
      this.botMercyHandlers.forEach((handler) => handler({
        sessionId: String(payload?.sessionId ?? ""),
        x: Number(payload?.x ?? 0),
        y: Number(payload?.y ?? 0),
        serverNow: Number(payload?.serverNow ?? Date.now()),
      }));
    });
    room.onMessage<NetworkBotRage>("bot_rage", (payload) => {
      this.botRageHandlers.forEach((handler) => handler({
        sessionId: String(payload?.sessionId ?? ""),
        targetSessionId: String(payload?.targetSessionId ?? ""),
        x: Number(payload?.x ?? 0),
        y: Number(payload?.y ?? 0),
        serverNow: Number(payload?.serverNow ?? Date.now()),
      }));
    });`,
  'net room bot rage message',
);

net = replaceOnce(
  net,
`  onBotMercy(handler: BotMercyHandler): () => void {
    this.botMercyHandlers.add(handler);
    return () => this.botMercyHandlers.delete(handler);
  }`,
`  onBotMercy(handler: BotMercyHandler): () => void {
    this.botMercyHandlers.add(handler);
    return () => this.botMercyHandlers.delete(handler);
  }
  onBotRage(handler: BotRageHandler): () => void {
    this.botRageHandlers.add(handler);
    return () => this.botRageHandlers.delete(handler);
  }`,
  'net onBotRage public handler',
);

if (!net.includes(MARK)) {
  net = `/* ${MARK}: visual-only Hunter-bot RAGE event plumbing. */\n` + net;
}

/* -------------------------------------------------------------------------
 * GAME SCENE: short TARGET LOCK popup over the Hunter bot.
 * ---------------------------------------------------------------------- */
game = replaceOnce(
  game,
`    type NetworkBotMercy,`,
`    type NetworkBotMercy,
    type NetworkBotRage,`,
  'game import NetworkBotRage',
);

const mercyMethodAnchor = `    /* V1010565G_BOT_HUMANIZED_HUNT: visual-only 20% mercy cue. */\n    private applyBotMercy(event: NetworkBotMercy): void {`;
if (!game.includes(mercyMethodAnchor)) fail('GameScene applyBotMercy anchor missing.');
if (!game.includes('private applyBotRage(')) {
  const rageMethod = `    /* ${MARK}: Hardened taunt made this bot angry. Visual only. */
    private applyBotRage(event: NetworkBotRage): void {
        if (this.phase !== 'hunt') {
            return;
        }

        const language = getLanguage();
        const label =
            language === 'ja'
                ? '💢 ターゲットロック'
                : language === 'en'
                    ? '💢 TARGET LOCK'
                    : '💢 타깃 고정!';

        const ring = this.add
            .circle(
                event.x,
                event.y - 20,
                17,
                0xff4d45,
                0.10,
            )
            .setStrokeStyle(
                3,
                0xff544c,
                0.92,
            )
            .setDepth(1132);

        const text = this.add
            .text(
                event.x,
                event.y - 39,
                label,
                {
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    fontStyle: 'bold',
                    color: '#fff4e8',
                    backgroundColor: '#8e241fe8',
                    stroke: '#36100e',
                    strokeThickness: 2,
                    padding: {
                        x: 6,
                        y: 3,
                    },
                },
            )
            .setOrigin(0.5, 1)
            .setDepth(1133);

        this.tweens.add({
            targets: ring,
            scale: 1.45,
            alpha: 0,
            duration: 720,
            ease: 'Cubic.Out',
            onComplete: () => ring.destroy(),
        });

        this.tweens.add({
            targets: text,
            y: '-=9',
            duration: 130,
            yoyo: true,
            repeat: 3,
            ease: 'Sine.InOut',
            onComplete: () => {
                this.tweens.add({
                    targets: text,
                    alpha: 0,
                    y: '-=8',
                    duration: 260,
                    onComplete: () => text.destroy(),
                });
            },
        });
    }

`;
  game = game.replace(mercyMethodAnchor, rageMethod + mercyMethodAnchor);
}

game = replaceOnce(
  game,
`        this.networkUnsubscribers.push(multiplayerClient.onBotMercy((event: NetworkBotMercy) => this.applyBotMercy(event)));`,
`        this.networkUnsubscribers.push(multiplayerClient.onBotMercy((event: NetworkBotMercy) => this.applyBotMercy(event)));
        this.networkUnsubscribers.push(multiplayerClient.onBotRage((event: NetworkBotRage) => this.applyBotRage(event)));`,
  'game register bot rage listener',
);

if (!game.includes(MARK)) {
  game = `/* ${MARK}: visual TARGET LOCK cue for Hardened-triggered Hunter bot RAGE. */\n` + game;
}

/* Safety assertions */
for (const [label, source, tokens] of [
  ['MyRoom', server, [MARK, 'HARDENED_TAUNT_RAGE', 'SHOOT_UNTIL_DEAD', 'rageTargetId', 'bot_rage', 'rageInspection ? false : Math.random() < 0.20']],
  ['MultiplayerClient', net, [MARK, 'NetworkBotRage', 'botRageHandlers', 'onBotRage']],
  ['GameScene', game, [MARK, 'applyBotRage', '💢 TARGET LOCK', 'onBotRage']],
]) {
  for (const token of tokens) {
    if (!source.includes(token)) fail(`${label}: safety token missing: ${token}`);
  }
}

const backupDir = path.join(path.dirname(gameFile), '..', '..', '.patch-backups');
const serverBackupDir = path.join(path.dirname(serverFile), '..', '..', '.patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
fs.mkdirSync(serverBackupDir, { recursive: true });
fs.writeFileSync(path.join(backupDir, 'GameScene-before-v0.10.10.565h.ts'), gameOriginal, 'utf8');
fs.writeFileSync(path.join(backupDir, 'MultiplayerClient-before-v0.10.10.565h.ts'), netOriginal, 'utf8');
fs.writeFileSync(path.join(serverBackupDir, 'MyRoom-before-v0.10.10.565h.ts'), serverOriginal, 'utf8');
fs.writeFileSync(gameFile, game, 'utf8');
fs.writeFileSync(netFile, net, 'utf8');
fs.writeFileSync(serverFile, server, 'utf8');

console.log('');
console.log('[done] v0.10.10.565h HARDENED RAGE LOCK applied');
console.log('[rage] Detecting a Hardened Hider creates a persistent priority target until that Hider is eliminated.');
console.log('[rage] Mercy = 0%, normal long hesitation shortened to ~0.22-0.40s, then repeated legal shotgun attempts.');
console.log('[fair] Hunter movement speed, shotgun cooldown, HEAT, aim error, range and FOV remain normal; no coordinate cheat.');
console.log('[search] Lost sight -> search around last seen position; re-lock only when the target returns to local FOV/range.');
console.log('[priority] While RAGE target lives, other Hiders are ignored as intentional target choices.');
console.log('[visual] One-time 💢 TARGET LOCK / 타깃 고정 / ターゲットロック popup when RAGE begins.');
console.log('NEXT:');
console.log('  cd C:\\Users\\bak12\\color-hunt-server && npm run build');
console.log('  cd C:\\Users\\bak12\\color-hunt && npm run build');
