const fs = require('fs');
const path = require('path');

const MARK = 'V1010565J_BACKGROUND_CAMOUFLAGE_SCORE';
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

const gameFile = mustFile(
  clientRoots.map((root) => path.join(root, 'src', 'game', 'GameScene.ts')),
  'GameScene.ts',
);
const netFile = mustFile(
  clientRoots.map((root) => path.join(root, 'src', 'network', 'MultiplayerClient.ts')),
  'MultiplayerClient.ts',
);
const serverFile = mustFile(
  serverRoots.map((root) => path.join(root, 'src', 'rooms', 'MyRoom.ts')),
  'MyRoom.ts',
);

let game = fs.readFileSync(gameFile, 'utf8');
let net = fs.readFileSync(netFile, 'utf8');
let server = fs.readFileSync(serverFile, 'utf8');
const gameOriginal = game;
const netOriginal = net;
const serverOriginal = server;

if (game.includes(MARK) && net.includes(MARK) && server.includes(MARK)) {
  console.log('[skip] v0.10.10.565j already applied.');
  process.exit(0);
}

if (!game.includes('V1010565H_HARDENED_RAGE_LOCK')) {
  fail('GameScene: v565h marker missing. Apply v0.10.10.565h first.');
}
for (const [label, source] of [
  ['MultiplayerClient', net],
  ['MyRoom', server],
]) {
  if (!source.includes('V1010565I_BOT_ATTENTION_STIMULUS')) {
    fail(`${label}: v565i marker missing. Apply v0.10.10.565i first.`);
  }
}

/* ========================================================================
 * CLIENT / MultiplayerClient
 * Host browser reports one compact 0..1 visual camouflage similarity score.
 * The server validates host authority, target role and sampled position.
 * ====================================================================== */
net = replaceOnce(
  net,
`  sendBotPaintComplete(
    targetSessionId: string,
  ): void {
    if (!this.room || !this.isHost()) return;
    this.room.send("bot_paint_complete", {
      targetSessionId,
    });
  }

  isHost(): boolean {`,
`  sendBotPaintComplete(
    targetSessionId: string,
  ): void {
    if (!this.room || !this.isHost()) return;
    this.room.send("bot_paint_complete", {
      targetSessionId,
    });
  }

  /*
   * ${MARK}: the current human Host samples the same rendered map used by
   * Paint Assist and reports how closely the FINAL painted body matches it.
   * Only a score + sampled authoritative-looking position is sent; the server
   * still owns all detection timing and validates the target/position.
   */
  sendHiderCamouflageSimilarity(
    targetSessionId: string,
    score: number,
    sampleX: number,
    sampleY: number,
  ): void {
    if (
      !this.room ||
      !this.isHost() ||
      !targetSessionId ||
      !Number.isFinite(score) ||
      !Number.isFinite(sampleX) ||
      !Number.isFinite(sampleY)
    ) return;

    this.room.send("hider_camouflage_similarity", {
      targetSessionId,
      score: Math.max(0, Math.min(1, score)),
      sampleX,
      sampleY,
    });
  }

  isHost(): boolean {`,
  'client camouflage similarity sender',
);

if (!net.includes(MARK)) {
  net = `/* ${MARK}: Host-rendered background-vs-paint camouflage similarity transport. */\n` + net;
}

/* ========================================================================
 * CLIENT / GameScene
 * Reconstruct the real 80x120 painted Hider raster using the SAME pixel mask
 * and brush diameter rules as NetworkPlayerManager, then compare every body
 * pixel against the real map texture hidden behind the current Hider position.
 *
 * This runs only on the Host, only during Hunt, and is throttled. Paint raster
 * is cached; moving only requires cheap ~1212-pixel background resampling.
 * ====================================================================== */
const botFieldAnchor = `    private botPaintAuthoringNotBefore = 0;\n`;
game = replaceOnce(
  game,
  botFieldAnchor,
`${botFieldAnchor}    /* ${MARK}: Host-only real background-vs-painted-body scoring. */
    private hostCamouflageScoreRoundKey = '';
    private hostCamouflageScoreLastPassAt = 0;
    private readonly hostCamouflageRasterBySession = new Map<
        string,
        { signature: string; colors: Int32Array }
    >();
    private readonly hostCamouflageLastSentBySession = new Map<
        string,
        { score: number; x: number; y: number; at: number }
    >();
`,
  'GameScene camouflage score fields',
);

const botAuthoringAnchor = `    private updateHostBotPaintAuthoring(): void {\n`;
const camouflageMethods = `    private isCamouflageScorePixelInsideCharacter(
        textureX: number,
        textureY: number,
    ): boolean {
        const x = Math.round(textureX);
        const y = Math.round(textureY);
        const headDx = x - 40;
        const headDy = y - 48;
        const insideHead = headDx * headDx + headDy * headDy <= 12 * 12;
        const insideBody = x >= 31 && x <= 48 && y >= 55 && y <= 78;
        const insideLeftArm = x >= 24 && x <= 31 && y >= 57 && y <= 74;
        const insideRightArm = x >= 48 && x <= 55 && y >= 57 && y <= 74;
        const insideLeftLeg = x >= 31 && x <= 38 && y >= 75 && y <= 88;
        const insideRightLeg = x >= 41 && x <= 48 && y >= 75 && y <= 88;
        return (
            insideHead || insideBody || insideLeftArm || insideRightArm ||
            insideLeftLeg || insideRightLeg
        );
    }

    private getHostCamouflageRasterSignature(
        strokes: NetworkPaintStroke[],
    ): string {
        let hash = 2166136261 >>> 0;
        for (const stroke of strokes) {
            hash ^= Number(stroke.color) >>> 0;
            hash = Math.imul(hash, 16777619) >>> 0;
            hash ^= Math.round(Number(stroke.size) || 0) >>> 0;
            hash = Math.imul(hash, 16777619) >>> 0;
            hash ^= stroke.shape === 'square' ? 0x51 : 0xa7;
            hash = Math.imul(hash, 16777619) >>> 0;
            const points = Array.isArray(stroke.points) ? stroke.points : [];
            hash ^= points.length >>> 0;
            hash = Math.imul(hash, 16777619) >>> 0;
            if (points.length > 0) {
                const first = points[0];
                const last = points[points.length - 1];
                hash ^= (Math.round(first.x * 4) & 0xffff) | ((Math.round(first.y * 4) & 0xffff) << 16);
                hash = Math.imul(hash, 16777619) >>> 0;
                hash ^= (Math.round(last.x * 4) & 0xffff) | ((Math.round(last.y * 4) & 0xffff) << 16);
                hash = Math.imul(hash, 16777619) >>> 0;
            }
        }
        return String(strokes.length) + ':' + hash.toString(16);
    }

    private buildHostCamouflagePaintRaster(
        sessionId: string,
        strokes: NetworkPaintStroke[],
    ): Int32Array {
        const signature = this.getHostCamouflageRasterSignature(strokes);
        const cached = this.hostCamouflageRasterBySession.get(sessionId);
        if (cached?.signature === signature) return cached.colors;

        const width = 80;
        const height = 120;
        const colors = new Int32Array(width * height);
        colors.fill(-1);

        /* Same visible unpainted Hider base used by NetworkPlayerManager. */
        const baseColor = 0xf5eee2;
        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                if (this.isCamouflageScorePixelInsideCharacter(x, y)) {
                    colors[y * width + x] = baseColor;
                }
            }
        }

        for (const stroke of strokes) {
            const color = Number(stroke.color);
            const rawSize = Number(stroke.size);
            if (!Number.isInteger(color) || !Number.isFinite(rawSize)) continue;
            const diameter = Math.max(1, Math.min(20, Math.round(rawSize)));
            const minOffset = -Math.floor(diameter / 2);
            const maxOffset = minOffset + diameter - 1;
            const centerOffset = (minOffset + maxOffset) / 2;
            const circleRadius = Math.max(0.5, diameter / 2 - 0.25);
            const points = Array.isArray(stroke.points) ? stroke.points : [];

            for (const point of points) {
                const centerX = Number(point.x);
                const centerY = Number(point.y);
                if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) continue;

                for (let offsetY = minOffset; offsetY <= maxOffset; offsetY += 1) {
                    for (let offsetX = minOffset; offsetX <= maxOffset; offsetX += 1) {
                        if (stroke.shape !== 'square') {
                            const dx = offsetX - centerOffset;
                            const dy = offsetY - centerOffset;
                            if (dx * dx + dy * dy > circleRadius * circleRadius) continue;
                        }

                        const pixelX = Math.round(centerX + offsetX);
                        const pixelY = Math.round(centerY + offsetY);
                        if (
                            pixelX < 0 || pixelX >= width ||
                            pixelY < 0 || pixelY >= height ||
                            !this.isCamouflageScorePixelInsideCharacter(pixelX, pixelY)
                        ) continue;

                        colors[pixelY * width + pixelX] = color & 0xffffff;
                    }
                }
            }
        }

        this.hostCamouflageRasterBySession.set(sessionId, { signature, colors });
        return colors;
    }

    private measureHostCamouflageSimilarity(
        sessionId: string,
        centerX: number,
        centerY: number,
        strokes: NetworkPaintStroke[],
        sampler: {
            data: Uint8ClampedArray;
            width: number;
            height: number;
        },
    ): number {
        const colors = this.buildHostCamouflagePaintRaster(sessionId, strokes);
        let matchSum = 0;
        let goodMatches = 0;
        let badMatches = 0;
        let count = 0;

        for (let y = 0; y < 120; y += 1) {
            for (let x = 0; x < 80; x += 1) {
                const paintColor = colors[y * 80 + x];
                if (paintColor < 0) continue;

                const background = this.samplePracticeBackgroundRgb(
                    sampler,
                    centerX + x - 40,
                    centerY + y - 60,
                );
                const pr = (paintColor >>> 16) & 255;
                const pg = (paintColor >>> 8) & 255;
                const pb = paintColor & 255;
                const dr = pr - background.r;
                const dg = pg - background.g;
                const db = pb - background.b;

                /* Perceptual-ish RGB distance: green/luma differences matter most. */
                const normalizedDistance = Math.min(
                    1,
                    Math.sqrt(
                        0.30 * dr * dr +
                        0.59 * dg * dg +
                        0.11 * db * db,
                    ) / 255,
                );
                const pixelMatch = Math.pow(Math.max(0, 1 - normalizedDistance), 1.25);
                matchSum += pixelMatch;
                if (pixelMatch >= 0.72) goodMatches += 1;
                if (pixelMatch < 0.38) badMatches += 1;
                count += 1;
            }
        }

        if (count < 1) return 0;
        const mean = matchSum / count;
        const goodFraction = goodMatches / count;
        const badFraction = badMatches / count;

        /* Broad similarity matters most; obvious mismatched patches still hurt. */
        return Phaser.Math.Clamp(
            mean * 0.82 + goodFraction * 0.22 - badFraction * 0.08,
            0,
            1,
        );
    }

    private updateHostCamouflageSimilarity(): void {
        if (
            this.phase !== 'hunt' ||
            !this.isMultiplayerSession() ||
            !multiplayerClient.isHost()
        ) {
            if (this.phase !== 'hunt' && this.hostCamouflageScoreRoundKey) {
                this.hostCamouflageScoreRoundKey = '';
                this.hostCamouflageScoreLastPassAt = 0;
                this.hostCamouflageRasterBySession.clear();
                this.hostCamouflageLastSentBySession.clear();
            }
            return;
        }

        if (this.time.now - this.hostCamouflageScoreLastPassAt < 700) return;
        this.hostCamouflageScoreLastPassAt = this.time.now;

        const room = multiplayerClient.getRoom();
        const players = room?.state?.players;
        if (!room || !players?.entries) return;

        const roundKey = String(room.roomId) + ':' + multiplayerClient.getPhaseEndsAt() + ':' + multiplayerClient.getActiveMap();
        if (roundKey !== this.hostCamouflageScoreRoundKey) {
            this.hostCamouflageScoreRoundKey = roundKey;
            this.hostCamouflageRasterBySession.clear();
            this.hostCamouflageLastSentBySession.clear();
        }

        const sampler = this.createCurrentPaintBackgroundSampler();
        if (!sampler) return;
        const localSessionId = multiplayerClient.getSessionId() ?? '';

        for (const [rawSessionId, rawPlayer] of players.entries()) {
            const sessionId = String(rawSessionId);
            const player = rawPlayer as NetworkPlayerState;
            if (player?.role !== 'hider' || !player?.alive) continue;

            let strokes = this.victoryRoundPaintBySession.get(sessionId) ?? [];
            if (strokes.length < 1 && sessionId === localSessionId) {
                strokes = this.localPaintHistory;
            }

            const renderedPosition = this.networkPlayerManager?.getPlayerPosition?.(sessionId);
            const centerX = Number(renderedPosition?.x ?? player.x);
            const centerY = Number(renderedPosition?.y ?? player.y);
            if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) continue;

            const score = this.measureHostCamouflageSimilarity(
                sessionId,
                centerX,
                centerY,
                strokes,
                sampler,
            );
            const previous = this.hostCamouflageLastSentBySession.get(sessionId);
            const moved = previous
                ? Math.hypot(centerX - previous.x, centerY - previous.y)
                : Number.POSITIVE_INFINITY;
            const changed = previous
                ? Math.abs(score - previous.score)
                : Number.POSITIVE_INFINITY;
            const stale = !previous || this.time.now - previous.at >= 2_200;

            if (moved < 2.5 && changed < 0.018 && !stale) continue;

            multiplayerClient.sendHiderCamouflageSimilarity(
                sessionId,
                score,
                centerX,
                centerY,
            );
            this.hostCamouflageLastSentBySession.set(sessionId, {
                score,
                x: centerX,
                y: centerY,
                at: this.time.now,
            });
        }
    }

`;
game = insertBeforeOnce(
  game,
  botAuthoringAnchor,
  camouflageMethods,
  'GameScene camouflage scoring methods',
);

const updateBotAuthoringCall = `        /* V1010565_BOTS_V1: at most one bot is authored per throttled pass. */\n        this.updateHostBotPaintAuthoring();`;
game = replaceOnce(
  game,
  updateBotAuthoringCall,
`${updateBotAuthoringCall}
        /* ${MARK}: actual paint-vs-map similarity now feeds Hunter-bot stealth. */
        this.updateHostCamouflageSimilarity();`,
  'GameScene camouflage scoring update call',
);

if (!game.includes(MARK)) {
  game = `/* ${MARK}: actual rendered background color now contributes to Hider stealth against Hunter bots. */\n` + game;
}

/* ========================================================================
 * SERVER
 * Store Host-reported visual similarity only if the sampled position is close
 * to the authoritative Hider position. Then make real visual similarity the
 * dominant stationary camouflage factor; old point-count heuristic remains a
 * fallback if no valid Host report exists.
 * ====================================================================== */
server = replaceOnce(
  server,
`  private readonly lastMoveAtBySessionId = new Map<string, number>();

  /* V1010565I_BOT_ATTENTION_STIMULUS: short-lived server-authoritative "something happened there" breadcrumbs. */`,
`  private readonly lastMoveAtBySessionId = new Map<string, number>();

  /* ${MARK}: Host-rendered paint-vs-map similarity, anchored to a sampled position. */
  private readonly camouflageSimilarityBySessionId = new Map<
    string,
    { score: number; x: number; y: number; updatedAt: number }
  >();

  /* V1010565I_BOT_ATTENTION_STIMULUS: short-lived server-authoritative "something happened there" breadcrumbs. */`,
  'server camouflage score field',
);

const serverMessageAnchor = `    /*\n     * V1010451M5S_SERVER_INTENTIONAL_LOBBY_LEAVE_GHOST_FIX_ROOT_ROBUST / LEAVE_INTENT\n     */`;
server = insertBeforeOnce(
  server,
  serverMessageAnchor,
`    /*
     * ${MARK}: Host browser compares the final 80x120 Hider paint raster with
     * the actual map pixels behind that Hider. The server accepts the compact
     * score only from the current Host and only when the reported sample
     * position is still close to authoritative PlayerState.
     */
    hider_camouflage_similarity: (
      client: Client,
      message: {
        targetSessionId?: string;
        score?: number;
        sampleX?: number;
        sampleY?: number;
      },
    ): void => {
      if (
        this.state.phase !== "hunt" ||
        client.sessionId !== this.state.hostId
      ) return;

      const targetSessionId = String(message?.targetSessionId ?? "");
      const target = this.state.players.get(targetSessionId);
      if (!target || target.role !== "hider" || !target.alive) return;

      const score = Number(message?.score);
      const sampleX = Number(message?.sampleX);
      const sampleY = Number(message?.sampleY);
      if (
        !Number.isFinite(score) ||
        !Number.isFinite(sampleX) ||
        !Number.isFinite(sampleY)
      ) return;

      /* A stale/made-up position must never give a moving Hider free stealth. */
      if (Math.hypot(target.x - sampleX, target.y - sampleY) > 18) return;

      this.camouflageSimilarityBySessionId.set(targetSessionId, {
        score: Math.max(0, Math.min(1, score)),
        x: sampleX,
        y: sampleY,
        updatedAt: Date.now(),
      });
    },

`,
  'server camouflage score message',
);

server = replaceOnce(
  server,
`    /* V101082B_CLEAR_ROUND_PAINT */
    this.roundPaintStrokes.clear();`,
`    /* V101082B_CLEAR_ROUND_PAINT */
    this.roundPaintStrokes.clear();
    /* ${MARK}: no visual similarity score may leak across rounds. */
    this.camouflageSimilarityBySessionId.clear();`,
  'server camouflage score round reset',
);

const oldStealthMethod = `  private getCamouflageStealthScore(sessionId: string, now: number): number {
    const strokes = this.roundPaintStrokes.get(sessionId) ?? [];
    let pointCount = 0;
    const colors = new Set<number>();
    for (const stroke of strokes) {
      pointCount += Array.isArray(stroke?.points) ? stroke.points.length : 0;
      if (Number.isInteger(stroke?.color)) colors.add(stroke.color);
    }
    const coverage = Math.max(0, Math.min(1, pointCount / 850));
    const variety = Math.max(0, Math.min(1, colors.size / 12));
    let stealth = coverage * 0.72 + variety * 0.18;

    if (this.botSessionIds.has(sessionId)) {
      stealth += this.botDifficulty === "hard" ? 0.10 : this.botDifficulty === "easy" ? -0.08 : 0.03;
    }
    const lastMoveAt = this.lastMoveAtBySessionId.get(sessionId) ?? 0;
    if (now - lastMoveAt < 650) stealth -= 0.48;
    else if (now - lastMoveAt < 1_600) stealth -= 0.22;
    return Math.max(0, Math.min(1, stealth));
  }`;

const newStealthMethod = `  private getCamouflageStealthScore(sessionId: string, now: number): number {
    const strokes = this.roundPaintStrokes.get(sessionId) ?? [];
    let pointCount = 0;
    const colors = new Set<number>();
    for (const stroke of strokes) {
      pointCount += Array.isArray(stroke?.points) ? stroke.points.length : 0;
      if (Number.isInteger(stroke?.color)) colors.add(stroke.color);
    }
    const coverage = Math.max(0, Math.min(1, pointCount / 850));
    const variety = Math.max(0, Math.min(1, colors.size / 12));

    const player = this.state.players.get(sessionId);
    const visual = this.camouflageSimilarityBySessionId.get(sessionId);
    const visualStillMatchesPosition = Boolean(
      player &&
      visual &&
      Math.hypot(player.x - visual.x, player.y - visual.y) <= 14
    );

    let stealth: number;
    if (visual && visualStillMatchesPosition) {
      /*
       * ${MARK} / REAL_CAMOUFLAGE_DOMINATES
       * Similar-looking paint is now the main factor. Coverage remains a
       * smaller anti-cheese term; "many colors" is NOT rewarded because a
       * rainbow is not camouflage on a plain wall.
       * Max before difficulty/movement = 0.90, same envelope as old logic.
       */
      stealth = coverage * 0.16 + visual.score * 0.74;

      if (this.botSessionIds.has(sessionId)) {
        /* Bot paint quality already differs by difficulty; keep only a small nudge. */
        stealth += this.botDifficulty === "hard" ? 0.04 : this.botDifficulty === "easy" ? -0.04 : 0.01;
      }
    } else {
      /* Safe fallback for Host handoff / score not received yet. */
      stealth = coverage * 0.72 + variety * 0.18;
      if (this.botSessionIds.has(sessionId)) {
        stealth += this.botDifficulty === "hard" ? 0.10 : this.botDifficulty === "easy" ? -0.08 : 0.03;
      }
    }

    const lastMoveAt = this.lastMoveAtBySessionId.get(sessionId) ?? 0;
    if (now - lastMoveAt < 650) stealth -= 0.48;
    else if (now - lastMoveAt < 1_600) stealth -= 0.22;
    return Math.max(0, Math.min(1, stealth));
  }`;

server = replaceOnce(
  server,
  oldStealthMethod,
  newStealthMethod,
  'server real camouflage stealth formula',
);

if (!server.includes(MARK)) {
  server = `/* ${MARK}: Hunter-bot stealth uses real paint-vs-map color similarity when Host report is valid. */\n` + server;
}

/* Safety checks. */
for (const [label, source, tokens] of [
  ['GameScene', game, [
    MARK,
    'updateHostCamouflageSimilarity',
    'measureHostCamouflageSimilarity',
    '0.30 * dr * dr',
    'sendHiderCamouflageSimilarity',
  ]],
  ['MultiplayerClient', net, [
    MARK,
    'sendHiderCamouflageSimilarity',
    'hider_camouflage_similarity',
  ]],
  ['MyRoom', server, [
    MARK,
    'camouflageSimilarityBySessionId',
    'REAL_CAMOUFLAGE_DOMINATES',
    'visual.score * 0.74',
    'Math.hypot(target.x - sampleX, target.y - sampleY) > 18',
  ]],
]) {
  for (const token of tokens) {
    if (!source.includes(token)) fail(`${label}: safety token missing: ${token}`);
  }
}

/* Transactional writes after every transformation succeeds. */
const clientBackupDir = path.join(path.dirname(gameFile), '..', '..', '.patch-backups');
const serverBackupDir = path.join(path.dirname(serverFile), '..', '..', '.patch-backups');
fs.mkdirSync(clientBackupDir, { recursive: true });
fs.mkdirSync(serverBackupDir, { recursive: true });
fs.writeFileSync(path.join(clientBackupDir, 'GameScene-before-v0.10.10.565j.ts'), gameOriginal, 'utf8');
fs.writeFileSync(path.join(clientBackupDir, 'MultiplayerClient-before-v0.10.10.565j.ts'), netOriginal, 'utf8');
fs.writeFileSync(path.join(serverBackupDir, 'MyRoom-before-v0.10.10.565j.ts'), serverOriginal, 'utf8');
fs.writeFileSync(gameFile, game, 'utf8');
fs.writeFileSync(netFile, net, 'utf8');
fs.writeFileSync(serverFile, server, 'utf8');

console.log('');
console.log('[done] v0.10.10.565j BACKGROUND CAMOUFLAGE SCORE applied');
console.log('[vision] Host reconstructs the exact Hider paint raster and compares ~1212 body pixels with the real map behind the current position.');
console.log('[vision] Unpainted body pixels use the real base body color, so incomplete camouflage is naturally penalized unless the wall genuinely matches it.');
console.log('[server] Actual background similarity now dominates stationary stealth: coverage 16% + visual match 74%.');
console.log('[server] Old coverage/variety heuristic remains as a safe fallback until a valid Host score exists.');
console.log('[fair] A score is ignored after the Hider moves away from its sampled position; movement penalties remain unchanged.');
console.log('[fair] Bot difficulty no longer gets a huge duplicate stealth bonus when real paint quality is available.');
console.log('NEXT:');
console.log('  cd C:\\Users\\bak12\\color-hunt-server && npm run build');
console.log('  cd C:\\Users\\bak12\\color-hunt && npm run build');
