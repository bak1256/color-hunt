const fs = require('fs');
const path = require('path');

const MARK = 'V1010565I_BOT_ATTENTION_STIMULUS';
const cwd = process.cwd();

function fail(message) {
  throw new Error(`[${MARK}] ${message}\nNo file written.`);
}
function mustFile(candidates, label) {
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) fail(`${label} not found. Checked:\n${candidates.join('\n')}`);
  return file;
}
function countOf(source, needle) {
  return source.split(needle).length - 1;
}
function replaceOnce(source, before, after, label) {
  const count = countOf(source, before);
  if (count !== 1) fail(`${label}: expected exactly 1 match, found ${count}.`);
  return source.replace(before, after);
}
function insertBeforeOnce(source, anchor, block, label) {
  const count = countOf(source, anchor);
  if (count !== 1) fail(`${label}: expected exactly 1 anchor, found ${count}.`);
  return source.replace(anchor, `${block}${anchor}`);
}

const clientRoots = [cwd, path.resolve(cwd, '..', 'color-hunt')];
const serverRoots = [path.resolve(cwd, '..', 'color-hunt-server'), cwd];

const netFile = mustFile(
  clientRoots.map((root) => path.join(root, 'src', 'network', 'MultiplayerClient.ts')),
  'MultiplayerClient.ts',
);
const serverFile = mustFile(
  serverRoots.map((root) => path.join(root, 'src', 'rooms', 'MyRoom.ts')),
  'MyRoom.ts',
);

let net = fs.readFileSync(netFile, 'utf8');
let server = fs.readFileSync(serverFile, 'utf8');
const netOriginal = net;
const serverOriginal = server;

if (net.includes(MARK) && server.includes(MARK)) {
  console.log('[skip] v0.10.10.565i already applied.');
  process.exit(0);
}

for (const [label, source] of [['MultiplayerClient', net], ['MyRoom', server]]) {
  if (!source.includes('V1010565H_HARDENED_RAGE_LOCK')) {
    fail(`${label}: v565h marker missing. Apply v0.10.10.565h first.`);
  }
}

/* -------------------------------------------------------------------------
 * CLIENT
 * Random Taunt gets one generic attention ping. The server never trusts a
 * client-supplied position; it uses the Hider's authoritative PlayerState.
 * This arms a short trail window, so dash/teleport/future movement-based
 * taunts can be followed by nearby Hunter bots without GPS-style tracking.
 * ---------------------------------------------------------------------- */
if (!net.includes(MARK)) {
  net = replaceOnce(
    net,
`    this.room?.send("hider_random_taunt", {});`,
`    this.room?.send("hider_random_taunt", {});
    /*
     * ${MARK}: visual/loud taunts should attract nearby Hunter bots even if
     * the exact taunt implementation changes. Position is NOT sent/trusted.
     */
    this.room?.send("hider_bot_taunt_ping", {
      kind: "random_taunt",
    });`,
    'client Random Taunt attention ping',
  );

  /* Development Clone Dance endpoint should exercise the same bot attention. */
  const cloneTestSend = `    this.room?.send("hider_clone_dance_test", {});`;
  if (countOf(net, cloneTestSend) === 1) {
    net = net.replace(
      cloneTestSend,
`${cloneTestSend}
    this.room?.send("hider_bot_taunt_ping", {
      kind: "clone_dance",
    });`,
    );
  }

  net = `/* ${MARK}: Random Taunt emits a server-validated Hunter-bot attention ping. */\n` + net;
}

/* -------------------------------------------------------------------------
 * SERVER TYPES / BRAIN STATE
 * Stimuli are only LAST-KNOWN attention points. They NEVER turn into a direct
 * target lock. A bot still has to turn, move, and reacquire the Hider through
 * its own local FOV/range before the normal inspect/fire pipeline starts.
 * ---------------------------------------------------------------------- */
server = replaceOnce(
  server,
`type BotPaintCompleteMessage = {
  targetSessionId?: string;
};
type BotBrain = {`,
`type BotPaintCompleteMessage = {
  targetSessionId?: string;
};

type BotAttentionKind =
  | "movement"
  | "taunt"
  | "taunt_trail";

type BotAttentionStimulus = {
  serial: number;
  hiderId: string;
  kind: BotAttentionKind;
  x: number;
  y: number;
  radius: number;
  strength: number;
  expiresAt: number;
};

type BotBrain = {`,
  'server attention stimulus types',
);

server = replaceOnce(
  server,
`  /* V1010565H_HARDENED_RAGE_LOCK: Hardened taunt creates a persistent priority target. */
  rageTargetId: string;
};`,
`  /* V1010565H_HARDENED_RAGE_LOCK: Hardened taunt creates a persistent priority target. */
  rageTargetId: string;

  /* ${MARK}: last-known stimulus investigation; never a hidden live-coordinate lock. */
  attentionSerial: number;
  attentionHiderId: string;
  attentionX: number;
  attentionY: number;
  attentionUntil: number;
};`,
  'server BotBrain attention fields',
);

server = replaceOnce(
  server,
`  private readonly botSessionIds = new Set<string>();
  private readonly botBrainBySessionId = new Map<string, BotBrain>();
  private readonly lastMoveAtBySessionId = new Map<string, number>();
  private botDifficulty: BotDifficulty = "normal";`,
`  private readonly botSessionIds = new Set<string>();
  private readonly botBrainBySessionId = new Map<string, BotBrain>();
  private readonly lastMoveAtBySessionId = new Map<string, number>();

  /* ${MARK}: short-lived server-authoritative "something happened there" breadcrumbs. */
  private readonly botAttentionStimuli: BotAttentionStimulus[] = [];
  private botAttentionStimulusSerial = 0;
  private readonly botTauntAttentionUntilByHider = new Map<string, number>();
  private readonly botAttentionLastSampleByHider = new Map<
    string,
    { x: number; y: number; at: number }
  >();
  private readonly botAttentionLastTrailAtByHider = new Map<string, number>();
  private readonly botAttentionLastTauntPingAtByHider = new Map<string, number>();

  private botDifficulty: BotDifficulty = "normal";`,
  'server attention state fields',
);

server = replaceOnce(
  server,
`      ignoreTargetUntil: 0,
      rageTargetId: "",
    };`,
`      ignoreTargetUntil: 0,
      rageTargetId: "",
      attentionSerial: 0,
      attentionHiderId: "",
      attentionX: x,
      attentionY: y,
      attentionUntil: 0,
    };`,
  'server BotBrain attention init',
);

/* -------------------------------------------------------------------------
 * SERVER MESSAGE
 * Client says only "I used Random Taunt". Server validates role/phase and
 * takes x/y from authoritative PlayerState, then rate-limits the event.
 * ---------------------------------------------------------------------- */
const botAttentionMessageAnchor = `    sniper_toggle: (`;
server = insertBeforeOnce(
  server,
  botAttentionMessageAnchor,
`    /*
     * ${MARK}: Generic Random-Taunt attention signal for Hunter bots.
     * Security/fairness: ignore all client coordinates; only authoritative
     * PlayerState position is used. This cannot damage/kill or alter player
     * movement—it only creates a short investigation breadcrumb.
     */
    hider_bot_taunt_ping: (
      client: Client,
      _message: { kind?: string },
    ): void => {
      if (this.state.phase !== "hunt") return;
      const hider = this.state.players.get(client.sessionId);
      if (!hider || hider.role !== "hider" || !hider.alive) return;

      const now = Date.now();
      const previous = this.botAttentionLastTauntPingAtByHider.get(client.sessionId) ?? 0;
      if (now - previous < 800) return;
      this.botAttentionLastTauntPingAtByHider.set(client.sessionId, now);

      this.armBotTauntAttention(
        client.sessionId,
        hider.x,
        hider.y,
        now,
      );
    },

`,
  'server generic taunt ping handler',
);

/* Direct/legacy Hardened endpoint also creates the same initial commotion when present. */
const legacyHardenedLine =
  `      const now = Date.now(); const endsAt = now + this.hiderHardenedDurationMs; const pose = 1 + Math.floor(Math.random() * 3);`;
if (countOf(server, legacyHardenedLine) === 1) {
  server = server.replace(
    legacyHardenedLine,
`      const now = Date.now();
      this.armBotTauntAttention(client.sessionId, hider.x, hider.y, now);
      const endsAt = now + this.hiderHardenedDurationMs; const pose = 1 + Math.floor(Math.random() * 3);`,
  );
}

/* -------------------------------------------------------------------------
 * SERVER HELPERS
 * - Initial taunt ping: large but finite "heard/saw something" radius.
 * - During the next few seconds, ANY authoritative Hider displacement can
 *   leave a trail: client dash, server teleport, future movement-based taunt.
 * - Normal movement makes only a small local rustle, so standing still keeps
 *   camouflage valuable.
 * ---------------------------------------------------------------------- */
const tickHunterAnchor = `  private tickHunterBot(sessionId: string, player: PlayerState, now: number): void {\n`;
server = insertBeforeOnce(
  server,
  tickHunterAnchor,
`  private pushBotAttentionStimulus(
    hiderId: string,
    kind: BotAttentionKind,
    x: number,
    y: number,
    radius: number,
    strength: number,
    expiresAt: number,
  ): void {
    if (this.state.phase !== "hunt") return;

    this.botAttentionStimulusSerial += 1;
    this.botAttentionStimuli.push({
      serial: this.botAttentionStimulusSerial,
      hiderId,
      kind,
      x: Math.max(0, Math.min(960, x)),
      y: Math.max(0, Math.min(540, y)),
      radius: Math.max(40, Math.min(560, radius)),
      strength: Math.max(0.1, Math.min(1.4, strength)),
      expiresAt,
    });

    /* Bounded list: no long-room memory growth. */
    if (this.botAttentionStimuli.length > 72) {
      this.botAttentionStimuli.splice(0, this.botAttentionStimuli.length - 72);
    }
  }

  private armBotTauntAttention(
    hiderId: string,
    x: number,
    y: number,
    now = Date.now(),
  ): void {
    /* Covers dash/teleport/clone/hardened and future Random Taunt variants. */
    this.botTauntAttentionUntilByHider.set(hiderId, now + 5_200);
    this.pushBotAttentionStimulus(
      hiderId,
      "taunt",
      x,
      y,
      520,
      1.18,
      now + 1_450,
    );
  }

  private sampleHiderBotAttentionMovement(now: number): void {
    /* Prune expired breadcrumbs and dead/expired taunt windows first. */
    for (let i = this.botAttentionStimuli.length - 1; i >= 0; i -= 1) {
      const stimulus = this.botAttentionStimuli[i];
      const hider = this.state.players.get(stimulus.hiderId);
      if (
        stimulus.expiresAt <= now ||
        !hider ||
        hider.role !== "hider" ||
        !hider.alive
      ) {
        this.botAttentionStimuli.splice(i, 1);
      }
    }

    for (const [hiderId, until] of this.botTauntAttentionUntilByHider) {
      if (until <= now) this.botTauntAttentionUntilByHider.delete(hiderId);
    }

    for (const [hiderId, hider] of this.state.players) {
      if (hider.role !== "hider" || !hider.alive) continue;

      const previous = this.botAttentionLastSampleByHider.get(hiderId);
      this.botAttentionLastSampleByHider.set(hiderId, {
        x: hider.x,
        y: hider.y,
        at: now,
      });
      if (!previous) continue;

      const dt = Math.max(16, Math.min(500, now - previous.at));
      const dx = hider.x - previous.x;
      const dy = hider.y - previous.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 2.5) continue;

      const speed = distance / dt * 1000;
      const tauntBoost = (this.botTauntAttentionUntilByHider.get(hiderId) ?? 0) > now;
      const lastTrail = this.botAttentionLastTrailAtByHider.get(hiderId) ?? 0;

      if (tauntBoost && now - lastTrail >= 160) {
        /* Loud/flashy taunt trail: strong attention, but only to the place just seen/heard. */
        this.botAttentionLastTrailAtByHider.set(hiderId, now);
        this.pushBotAttentionStimulus(
          hiderId,
          "taunt_trail",
          hider.x,
          hider.y,
          465,
          1.04,
          now + 900,
        );
        continue;
      }

      if (speed >= 170 && now - lastTrail >= 210) {
        /* Abnormally fast motion is conspicuous even without an armed taunt window. */
        this.botAttentionLastTrailAtByHider.set(hiderId, now);
        this.pushBotAttentionStimulus(
          hiderId,
          "movement",
          hider.x,
          hider.y,
          300,
          0.74,
          now + 720,
        );
        continue;
      }

      if (speed >= 85 && now - lastTrail >= 340) {
        /* Ordinary walking creates only a small nearby rustle. */
        this.botAttentionLastTrailAtByHider.set(hiderId, now);
        this.pushBotAttentionStimulus(
          hiderId,
          "movement",
          hider.x,
          hider.y,
          180,
          0.38,
          now + 560,
        );
      }
    }
  }

  private applyBotAttentionStimulus(
    player: PlayerState,
    brain: BotBrain,
    now: number,
    turnRateRad: number,
  ): void {
    if (
      brain.rageTargetId ||
      brain.targetId ||
      brain.inspectTargetId ||
      now < brain.modeUntil
    ) {
      return;
    }

    let best: BotAttentionStimulus | undefined;
    let bestScore = -Infinity;

    for (const stimulus of this.botAttentionStimuli) {
      if (
        stimulus.expiresAt <= now ||
        stimulus.serial <= brain.attentionSerial ||
        (
          stimulus.hiderId === brain.ignoreTargetId &&
          now < brain.ignoreTargetUntil
        )
      ) {
        continue;
      }

      const source = this.state.players.get(stimulus.hiderId);
      if (!source || source.role !== "hider" || !source.alive) continue;

      const dx = stimulus.x - player.x;
      const dy = stimulus.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > stimulus.radius) continue;

      const proximity = 1 - Math.min(1, distance / stimulus.radius);
      const recency = Math.max(0, Math.min(1, (stimulus.expiresAt - now) / 1450));
      const score =
        stimulus.strength * 1.45 +
        proximity * 0.72 +
        recency * 0.22 +
        (stimulus.kind === "taunt" ? 0.18 : 0);

      if (score > bestScore) {
        best = stimulus;
        bestScore = score;
      }
    }

    if (!best) return;

    brain.attentionSerial = best.serial;
    brain.attentionHiderId = best.hiderId;
    brain.attentionX = best.x;
    brain.attentionY = best.y;
    brain.attentionUntil = now +
      (best.kind === "taunt" ? 1_850 : best.kind === "taunt_trail" ? 1_450 : 950);
    brain.patrolX = best.x;
    brain.patrolY = best.y;
    brain.nextDecisionAt = now + 520;

    /* Visible "what was that?" turn. Still not a target lock. */
    const direction = Math.atan2(best.y - player.y, best.x - player.x);
    brain.heading = this.turnBotAngleToward(
      brain.heading,
      direction,
      turnRateRad * 0.34,
    );
  }

`,
  'server attention helper methods',
);

/* Sample authoritative positions once per bot tick before any Hunter chooses. */
server = replaceOnce(
  server,
`    if (this.state.phase !== "hunt") return;

    for (const sessionId of this.botSessionIds) {`,
`    if (this.state.phase !== "hunt") return;

    /* ${MARK}: catches normal walking, dash, teleport and server-driven taunt motion. */
    this.sampleHiderBotAttentionMovement(now);

    for (const sessionId of this.botSessionIds) {`,
  'server bot tick attention sampling',
);

/* Reset per-round attention sampling when a new Paint phase prepares bots. */
server = replaceOnce(
  server,
`  private prepareBotsForPaint(): void {
    this.botPaintFallbackAt = Date.now() + 8_000;`,
`  private prepareBotsForPaint(): void {
    this.botAttentionStimuli.length = 0;
    this.botTauntAttentionUntilByHider.clear();
    this.botAttentionLastSampleByHider.clear();
    this.botAttentionLastTrailAtByHider.clear();
    this.botAttentionLastTauntPingAtByHider.clear();
    this.botPaintFallbackAt = Date.now() + 8_000;`,
  'server round attention reset',
);

/* -------------------------------------------------------------------------
 * HUNTER AI INTEGRATION
 * 1) free/patrol bots consume last-known stimuli;
 * 2) recent stimulus source becomes easier to notice ONCE actually in local
 *    range/FOV; no live-coordinate lock is created by the breadcrumb;
 * 3) arriving at a breadcrumb causes a brief local search instead of an
 *    immediate return to random patrol.
 * ---------------------------------------------------------------------- */
server = replaceOnce(
  server,
`    const rageActive = brain.rageTargetId.length > 0;
    /* Normal miss-search must never cancel an already activated RAGE. */
    const searchingAfterMiss = !rageActive && now < brain.modeUntil;`,
`    const rageActive = brain.rageTargetId.length > 0;
    /* Normal miss-search must never cancel an already activated RAGE. */
    const searchingAfterMiss = !rageActive && now < brain.modeUntil;

    if (brain.attentionUntil > 0 && now >= brain.attentionUntil) {
      brain.attentionHiderId = "";
      brain.attentionUntil = 0;
    }

    /* ${MARK}: free Hunter turns/moves toward a recent commotion, never the hidden live Hider. */
    this.applyBotAttentionStimulus(
      player,
      brain,
      now,
      cfg.turnRateRad,
    );`,
  'hunter apply attention stimulus',
);

/* Candidate scan: widen local attention only for the Hider associated with the breadcrumb. */
server = replaceOnce(
  server,
`        const lastMoveAt = this.lastMoveAtBySessionId.get(targetId) ?? 0;
        const movingRecently = now - lastMoveAt < 1200;
        const attentionRange = cfg.visionRange *
          (rageCandidate ? 1.12 : taunting ? 1.10 : movingRecently ? 1.04 : 1);`,
`        const lastMoveAt = this.lastMoveAtBySessionId.get(targetId) ?? 0;
        const movingRecently = now - lastMoveAt < 1200;
        const stimulusAttention =
          targetId === brain.attentionHiderId &&
          now < brain.attentionUntil;
        const attentionRange = cfg.visionRange *
          (rageCandidate ? 1.12 : taunting ? 1.10 : stimulusAttention ? 1.08 : movingRecently ? 1.04 : 1);`,
  'hunter candidate stimulus range',
);

server = replaceOnce(
  server,
`          baseHalfFov +
            (movingRecently ? 14 * Math.PI / 180 : 0) +
            (taunting ? 30 * Math.PI / 180 : 0) +
            (rageCandidate ? 14 * Math.PI / 180 : 0),`,
`          baseHalfFov +
            (movingRecently ? 14 * Math.PI / 180 : 0) +
            (stimulusAttention ? 20 * Math.PI / 180 : 0) +
            (taunting ? 30 * Math.PI / 180 : 0) +
            (rageCandidate ? 14 * Math.PI / 180 : 0),`,
  'hunter candidate stimulus FOV',
);

/* Positive-candidate reaction threshold. */
server = replaceOnce(
  server,
`      const lastMoveAt = this.lastMoveAtBySessionId.get(candidateId) ?? 0;
      const movingRecently = now - lastMoveAt < 1200;
      const stealth = this.getCamouflageStealthScore(candidateId, now);`,
`      const lastMoveAt = this.lastMoveAtBySessionId.get(candidateId) ?? 0;
      const movingRecently = now - lastMoveAt < 1200;
      const stimulusAttention =
        candidateId === brain.attentionHiderId &&
        now < brain.attentionUntil;
      const stealth = this.getCamouflageStealthScore(candidateId, now);`,
  'hunter candidate reaction stimulus flag',
);

server = replaceOnce(
  server,
`      if (rageCandidate) threshold = Math.min(threshold, 70);
      else if (taunting) threshold = Math.min(threshold, movingRecently ? 70 : 160);
      else if (movingRecently) threshold = Math.max(120, threshold * 0.42);`,
`      if (rageCandidate) threshold = Math.min(threshold, 70);
      else if (taunting) threshold = Math.min(threshold, movingRecently ? 70 : 160);
      else if (stimulusAttention) threshold = Math.min(threshold, movingRecently ? 80 : 145);
      else if (movingRecently) threshold = Math.max(120, threshold * 0.42);`,
  'hunter candidate reaction stimulus threshold',
);

/* Existing target visibility gets the same temporary local-attention benefit. */
server = replaceOnce(
  server,
`        const lastMoveAt = this.lastMoveAtBySessionId.get(brain.targetId) ?? 0;
        const movingRecently = now - lastMoveAt < 1200;
        const attentionHalfFov = Math.min(`,
`        const lastMoveAt = this.lastMoveAtBySessionId.get(brain.targetId) ?? 0;
        const movingRecently = now - lastMoveAt < 1200;
        const stimulusAttention =
          brain.targetId === brain.attentionHiderId &&
          now < brain.attentionUntil;
        const attentionHalfFov = Math.min(`,
  'hunter target tracking stimulus flag',
);

/* This is the second FOV block in tickHunterBot; after adding the flag, replace its local expression. */
const trackingStart = server.indexOf('        const stimulusAttention =\n          brain.targetId === brain.attentionHiderId');
if (trackingStart < 0) fail('hunter tracking stimulus insertion missing.');
const trackingEnd = server.indexOf('        const diff = Math.abs', trackingStart);
if (trackingEnd < 0) fail('hunter tracking FOV block end missing.');
let trackingBlock = server.slice(trackingStart, trackingEnd);
trackingBlock = trackingBlock.replace(
`          baseHalfFov +
            (movingRecently ? 14 * Math.PI / 180 : 0) +
            (taunting ? 30 * Math.PI / 180 : 0) +
            (rageTracking ? 14 * Math.PI / 180 : 0),`,
`          baseHalfFov +
            (movingRecently ? 14 * Math.PI / 180 : 0) +
            (stimulusAttention ? 20 * Math.PI / 180 : 0) +
            (taunting ? 30 * Math.PI / 180 : 0) +
            (rageTracking ? 14 * Math.PI / 180 : 0),`,
);
trackingBlock = trackingBlock.replace(
`        const attentionRange = cfg.visionRange *
          (rageTracking ? 1.12 : taunting ? 1.10 : movingRecently ? 1.04 : 1);`,
`        const attentionRange = cfg.visionRange *
          (rageTracking ? 1.12 : taunting ? 1.10 : stimulusAttention ? 1.08 : movingRecently ? 1.04 : 1);`,
);
if (!trackingBlock.includes('stimulusAttention ? 20') || !trackingBlock.includes('stimulusAttention ? 1.08')) {
  fail('hunter target tracking stimulus FOV/range rewrite did not match expected current v565h block.');
}
server = server.slice(0, trackingStart) + trackingBlock + server.slice(trackingEnd);

/* Breadcrumb investigation owns patrol until its short window expires. */
server = replaceOnce(
  server,
`    if (!brain.targetId || searchingAfterMiss) {
      const toPatrol = Math.hypot(brain.patrolX - player.x, brain.patrolY - player.y);

      if (brain.rageTargetId && !brain.targetId) {`,
`    if (!brain.targetId || searchingAfterMiss) {
      let toPatrol = Math.hypot(brain.patrolX - player.x, brain.patrolY - player.y);
      const investigatingStimulus =
        !brain.rageTargetId &&
        !searchingAfterMiss &&
        brain.attentionHiderId.length > 0 &&
        now < brain.attentionUntil;

      if (investigatingStimulus) {
        const toStimulus = Math.hypot(
          brain.attentionX - player.x,
          brain.attentionY - player.y,
        );

        if (toStimulus > 22) {
          brain.patrolX = brain.attentionX;
          brain.patrolY = brain.attentionY;
          brain.nextDecisionAt = Math.max(brain.nextDecisionAt, now + 420);
        } else if (now >= brain.nextDecisionAt) {
          /* Arrived: look around the LAST stimulus point, not current hidden coordinates. */
          const a = Math.random() * Math.PI * 2;
          const r = 24 + Math.random() * 54;
          brain.patrolX = Math.max(28, Math.min(932, brain.attentionX + Math.cos(a) * r));
          brain.patrolY = Math.max(44, Math.min(506, brain.attentionY + Math.sin(a) * r));
          brain.nextDecisionAt = now + 360 + Math.random() * 360;
        }
        toPatrol = Math.hypot(brain.patrolX - player.x, brain.patrolY - player.y);
      } else if (brain.rageTargetId && !brain.targetId) {`,
  'hunter stimulus investigation patrol branch',
);

/* mark source and sanity assertions */
if (!server.includes(MARK)) {
  server = `/* ${MARK}: server-authoritative attention breadcrumbs for Random Taunt / movement. */\n` + server;
}

for (const [label, source, tokens] of [
  ['MultiplayerClient', net, [MARK, 'hider_bot_taunt_ping', 'random_taunt']],
  ['MyRoom', server, [
    MARK,
    'type BotAttentionStimulus',
    'armBotTauntAttention(',
    'sampleHiderBotAttentionMovement(',
    'applyBotAttentionStimulus(',
    'taunt_trail',
    'stimulusAttention',
  ]],
]) {
  for (const token of tokens) {
    if (!source.includes(token)) fail(`${label}: safety token missing: ${token}`);
  }
}

/* No bot is allowed to be directly target-locked from a stimulus. */
const attentionHelperStart = server.indexOf('  private applyBotAttentionStimulus(');
const attentionHelperEnd = server.indexOf('  private tickHunterBot(', attentionHelperStart);
const attentionHelper = server.slice(attentionHelperStart, attentionHelperEnd);
if (attentionHelper.includes('brain.targetId = best.hiderId')) {
  fail('fairness guard: attention helper directly target-locks stimulus source.');
}

/* transactional write */
const clientBackupDir = path.join(path.dirname(netFile), '..', '..', '.patch-backups');
const serverBackupDir = path.join(path.dirname(serverFile), '..', '..', '.patch-backups');
fs.mkdirSync(clientBackupDir, { recursive: true });
fs.mkdirSync(serverBackupDir, { recursive: true });
fs.writeFileSync(path.join(clientBackupDir, 'MultiplayerClient-before-v0.10.10.565i.ts'), netOriginal, 'utf8');
fs.writeFileSync(path.join(serverBackupDir, 'MyRoom-before-v0.10.10.565i.ts'), serverOriginal, 'utf8');
fs.writeFileSync(netFile, net, 'utf8');
fs.writeFileSync(serverFile, server, 'utf8');

console.log('');
console.log('[done] v0.10.10.565i BOT ATTENTION STIMULUS applied');
console.log('[taunt] Random Taunt emits one server-validated attention ping; client coordinates are never trusted.');
console.log('[trail] For ~5.2s after taunt, authoritative Hider movement leaves short-lived last-known-position breadcrumbs.');
console.log('[movement] Fast movement is conspicuous; ordinary walking only creates a small nearby rustle.');
console.log('[ai] Free Hunter bots turn toward/investigate breadcrumbs, then must reacquire through real FOV/range before targeting.');
console.log('[fair] No GPS lock: stimuli never assign targetId and expire quickly; hidden live coordinates are not followed.');
console.log('[compat] Hardened RAGE still overrides everything; mercy ignore also suppresses that Hider\'s breadcrumbs until mercy ends.');
console.log('NEXT:');
console.log('  cd C:\\Users\\bak12\\color-hunt-server && npm run build');
console.log('  cd C:\\Users\\bak12\\color-hunt && npm run build');
