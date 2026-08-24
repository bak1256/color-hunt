import Phaser from "phaser";

import {
  multiplayerClient,
  type NetworkBrushShape,
  type NetworkPaintPoint,
  type NetworkPaintStroke,
  type NetworkPlayerRole,
  type NetworkPlayerState,
} from "../network/MultiplayerClient";

type PaintLayer = {
  texture: Phaser.GameObjects.RenderTexture;
  maskShape: Phaser.GameObjects.Graphics;
  mask: Phaser.Display.Masks.GeometryMask;
};

type NetworkPlayerView = {
  sessionId: string;
  container: Phaser.GameObjects.Container;
  nameText: Phaser.GameObjects.Text;
  role: NetworkPlayerRole;
  alive: boolean;
  customizationMode: boolean;
  savedX: number;
  savedY: number;
  paintZoom: number;
  gun?: Phaser.GameObjects.Container;
  aimGraphics?: Phaser.GameObjects.Graphics;
  revealMarker?: Phaser.GameObjects.Arc;
  targetX: number;
  targetY: number;
  spawnSynced: boolean;
  paintLayer?: PaintLayer;
  walkPhase: number;
  walkBlend: number;
  movingUntil: number;
  nextFootstepAt: number;
  huntFrozenX?: number;
  huntFrozenY?: number;
  leftArm?: Phaser.GameObjects.Rectangle;
  rightArm?: Phaser.GameObjects.Rectangle;
  leftLeg?: Phaser.GameObjects.Rectangle;
  rightLeg?: Phaser.GameObjects.Rectangle;
  shadow?: Phaser.GameObjects.Ellipse;
  gunBaseY?: number;
};

export class NetworkPlayerManager {
  /* V1010374_PAINT_FLOOD_FRAME_BUDGET: network paint callbacks enqueue only; exact serialized points drain under a per-frame raster budget. */
  /* V1010373_RECONNECT_SINGLE_AUTHORITY_GAMEPLAY_LOCK: stale reconnect echoes cannot move the local actor; prediction is rebased once after recovery. */
  /* V1010370_LARGE_ROOM_TRANSPORT_BUDGET: movement snapshots/fallback authority ~=15Hz for 3-10 player rooms; local prediction unchanged. */
  /* V1010364_P0_MULTIPLAYER_STABILITY: cap movement transport to 20Hz while keeping local rendering frame-rate smooth. */
  /* V1010346_MOVEMENT_JITTER_MAX_HARDENING: local prediction, remote damping, delta and network cadence hardening. */
  /* V1010343_URGENT_HUNTER_INPUT_JITTER_EYEDROPPER: protect active local Hunter prediction from delayed echo jitter. */
  /* V1010341_CLIENT_GAMEPLAY_STABILITY_SAFE: movement + paint rendering stability. */
  /* V1010339C_CRITICAL_ROUND_STABILITY_CLIENT: preserve exact thin-brush remote density. */
  /* V1010338_CRITICAL_GAMEPLAY_TRIPLE_FIX: remote Hunter smoothing + remote paint raster continuity. */
  /* V1010286B_LOBBY_AVATAR_EXACT_RENDER_PATHFIX: saved avatar strokes replay continuously with editor-equivalent geometry. */
  private readonly scene: Phaser.Scene;
  private readonly gameWidth: number;
  private readonly gameHeight: number;

  private readonly players =
    new Map<string, NetworkPlayerView>();

  /*
   * v0.10.10.134 Practice Ground:
   * A local-only session id lets Practice reuse the exact production
   * character renderer / paint mask / movement code without a Colyseus room.
   */
  private practiceLocalSessionId = "";
  private readonly practiceSessionIds =
    new Set<string>();
  private readonly practicePaintTextureKeys =
    new Set<string>();

  private getEffectiveLocalSessionId():
    string | undefined {
    return (
      this.practiceLocalSessionId ||
      multiplayerClient.getSessionId()
    );
  }

  getLocalSessionId():
    string | undefined {
    return this.getEffectiveLocalSessionId();
  }

  /*
   * V1010373_RECONNECT_SINGLE_AUTHORITY_GAMEPLAY_LOCK / LOCAL_PREDICTION_RESET
   * Called once when a recovered Room becomes authoritative. Adopt the
   * currently rendered position as the new prediction origin and discard old
   * movement echoes/history from the dead transport.
   */
  resetLocalPredictionAfterRecovery(): void {
    const sessionId =
      this.getEffectiveLocalSessionId();

    const view =
      sessionId
        ? this.players.get(
            sessionId,
          )
        : undefined;

    if (view) {
      this.localX =
        view.container.x;
      this.localY =
        view.container.y;
      view.targetX =
        view.container.x;
      view.targetY =
        view.container.y;
    }

    this.localMovementInitialized =
      Boolean(view);
    this.lastLocalMoveInputAt =
      0;
    this.localWasMoving =
      false;
    this.lastSendTime =
      this.scene.time.now;
    this.recentSentPositions =
      [];
  }


  /*
   * V1010374_PAINT_FLOOD_FRAME_BUDGET / REMOTE_PAINT_QUEUE
   *
   * Network callbacks may deliver several dense strokes in the same JS turn.
   * Applying all of them synchronously can block browser networking long
   * enough to trigger a false reconnect spiral. Drain a bounded amount from
   * update() instead.
   */
  private readonly pendingRemotePaintStrokes:
    Array<{
      stroke: NetworkPaintStroke;
      textureKey: string;
    }> = [];

  private readonly remotePaintPointBudgetPerFrame =
    320;

  private localX = 480;
  private localY = 270;

  /*
   * 로컬 캐릭터가 현재 화면에 보이는 위치에서
   * 실제 이동을 시작했는지 여부입니다.
   * 첫 이동 전에 서버 좌표와 렌더 좌표가 조금 달라도
   * WASD 입력 순간 점프하지 않게 합니다.
   */
  private localMovementInitialized = false;
  private localLobbyInputStarted = false;

  private readonly hiderMoveSpeed = 180;
  private readonly hunterMoveSpeed = 125;
  /* V1010242_HUNTER_FART_SKILL: poop debuff. */
  private localHunterSpeedMultiplier = 1;
  /*
   * V1010370_LARGE_ROOM_TRANSPORT_BUDGET / MOVE_15HZ
   * Local prediction stays frame-rate smooth. Only WebSocket movement
   * snapshots are capped near 15Hz for 3-10 player rooms.
   */
  private readonly sendInterval = 66;
  private lastSendTime = 0;
  private recentSentPositions:
    Array<{
      x: number;
      y: number;
      sentAt: number;
    }> = [];

  /*
   * 로컬 이동 중 서버 echo 좌표가 local prediction을 매 packet마다
   * 되감지 않도록 입력 직후 짧은 reconciliation grace를 둡니다.
   */
  private lastLocalMoveInputAt = 0;
  private localWasMoving = false;
  private lastAuthoritativeSyncAt = 0;
  /*
   * V1010346_MOVEMENT_JITTER_MAX_HARDENING / AUTHORITY_SYNC_RATE
   * Avoid redundant remote target reconciliation at render-frame frequency.
   */
  private readonly authoritativeSyncIntervalMs = 66;
  /*
   * V1010343_URGENT_HUNTER_INPUT_JITTER_EYEDROPPER / LOCAL_PREDICTION_GRACE
   * During active input, delayed server echoes must not fight the locally
   * predicted Hunter. 650ms comfortably covers transient mobile/room jitter.
   */
  private readonly localMoveReconcileGraceMs = 650;
  /*
   * V1010343_URGENT_HUNTER_INPUT_JITTER_EYEDROPPER / LOCAL_HARD_CORRECTION
   * Small/medium delayed server differences are not a reason to yank the
   * camera/player backwards while the Hunter is actively controlling.
   */
  private readonly localHardCorrectionDistance = 128;

  constructor(
    scene: Phaser.Scene,
    gameWidth: number,
    gameHeight: number,
  ) {
    this.scene = scene;
    this.gameWidth = gameWidth;
    this.gameHeight = gameHeight;
  }

  clearAllPlayers(): void {
    this.pendingRemotePaintStrokes.length =
      0;

    this.players.forEach((view) => {
      view.container.destroy(true);
      view.aimGraphics?.destroy();
      view.revealMarker?.destroy();
      view.paintLayer?.texture.destroy();
      view.paintLayer?.maskShape.destroy();
    });

    this.players.clear();

    this.practicePaintTextureKeys.forEach(
      (textureKey) => {
        if (
          this.scene.textures.exists(
            textureKey,
          )
        ) {
          this.scene.textures.remove(
            textureKey,
          );
        }
      },
    );
    this.practicePaintTextureKeys.clear();
    this.practiceSessionIds.clear();
    this.practiceLocalSessionId = "";

    this.lobbyPresetRenderTokens.clear();
    this.lobbyPresetAppliedSignatures.clear();
    this.lobbyPresetRenderingSignatures.clear();
    this.activeLobbyPresetRenderSessions.clear();
    this.localMovementInitialized = false;
    this.localLobbyInputStarted = false;
    this.localX = 480;
    this.localY = 270;
    this.lastLocalMoveInputAt = 0;
    this.localWasMoving = false;
    this.lastAuthoritativeSyncAt = 0;
    this.recentSentPositions = [];
  }

  beginPracticeLocalPlayer(
    sessionId: string,
    player: NetworkPlayerState,
  ): void {
    this.practiceLocalSessionId =
      sessionId;
    this.practiceSessionIds.add(
      sessionId,
    );

    this.addPlayer(
      sessionId,
      player,
    );

    const view =
      this.players.get(
        sessionId,
      );

    if (view) {
      this.localX =
        view.container.x;
      this.localY =
        view.container.y;
      this.localMovementInitialized =
        true;
      view.nameText.setVisible(
        false,
      );
    }
  }

  addPracticePlayer(
    sessionId: string,
    player: NetworkPlayerState,
  ): void {
    this.practiceSessionIds.add(
      sessionId,
    );

    this.addPlayer(
      sessionId,
      player,
    );

    this.players.get(
      sessionId,
    )?.nameText.setVisible(
      false,
    );
  }

  clearPracticePlayers(): void {
    [
      ...this.practiceSessionIds,
    ].forEach(
      (sessionId) => {
        this.removePlayer(
          sessionId,
        );
      },
    );

    this.practiceSessionIds.clear();
    this.practiceLocalSessionId =
      "";

    this.practicePaintTextureKeys.forEach(
      (textureKey) => {
        if (
          this.scene.textures.exists(
            textureKey,
          )
        ) {
          this.scene.textures.remove(
            textureKey,
          );
        }
      },
    );

    this.practicePaintTextureKeys.clear();
  }

  setPracticePlayerPosition(
    sessionId: string,
    x: number,
    y: number,
  ): void {
    const view =
      this.players.get(
        sessionId,
      );

    if (!view) {
      return;
    }

    view.targetX = x;
    view.targetY = y;

    if (
      sessionId ===
      this.practiceLocalSessionId
    ) {
      this.localX = x;
      this.localY = y;
    }

    this.setViewPosition(
      view,
      x,
      y,
    );
  }

  setPracticePlayerAlive(
    sessionId: string,
    alive: boolean,
  ): void {
    const view =
      this.players.get(
        sessionId,
      );

    if (!view) {
      return;
    }

    view.alive = alive;

    view.container
      .setVisible(alive)
      .setAlpha(
        alive
          ? 1
          : 0,
      );

    view.paintLayer?.texture
      .setVisible(alive)
      .setAlpha(
        alive
          ? 1
          : 0,
      );

    view.gun?.setVisible(
      alive &&
      view.role ===
        "hunter",
    );
  }

  setPracticePlayerVisible(
    sessionId: string,
    visible: boolean,
  ): void {
    const view =
      this.players.get(
        sessionId,
      );

    if (!view) {
      return;
    }

    view.container.setVisible(
      visible,
    );
    view.paintLayer?.texture
      .setVisible(
        visible,
      );
    view.gun?.setVisible(
      visible &&
      view.role ===
        "hunter",
    );
    view.nameText.setVisible(
      false,
    );
  }

  applyPracticeFullCamouflage(
    sessionId: string,
    colorAt:
      (
        textureX: number,
        textureY: number,
      ) => number,
  ): void {
    const view =
      this.players.get(
        sessionId,
      );

    if (!view?.paintLayer) {
      return;
    }

    /*
     * Use the EXACT same masked pixel stamper as real player painting.
     * This guarantees 100% coverage of every paintable head/body/arm/leg
     * pixel and cannot silently fail like RenderTexture.draw(CanvasTexture)
     * did on some browsers.
     */
    view.paintLayer.texture.clear();

    for (
      let y = 0;
      y < 120;
      y += 1
    ) {
      for (
        let x = 0;
        x < 80;
        x += 1
      ) {
        if (
          !this.isPaintPixelInsideCharacter(
            x,
            y,
          )
        ) {
          continue;
        }

        const color =
          colorAt(
            x,
            y,
          );

        this.stampMaskedPaintBrush(
          view,
          x,
          y,
          color,
          1,
          "square",
          false,
        );
      }
    }

    this.renderPaintTexture(
      view.paintLayer.texture,
    );

    this.syncPaintLayerPosition(
      view,
      true,
    );

    view.paintLayer.texture
      .setVisible(true)
      .setAlpha(1)
      .setDepth(
        view.role ===
          "hunter"
          ? 162
          : 122,
      );
  }

  syncPlayersFromCurrentRoom(): void {
    const room =
      multiplayerClient.getRoom();

    if (!room) {
      return;
    }

    const activeSessionIds =
      new Set<string>();

    room.state.players?.forEach?.(
      (
        player: NetworkPlayerState,
        sessionId: string,
      ) => {
        activeSessionIds.add(
          sessionId,
        );

        if (
          this.players.has(
            sessionId,
          )
        ) {
          this.updatePlayer(
            sessionId,
            player,
          );
        } else {
          this.addPlayer(
            sessionId,
            player,
          );
        }
      },
    );

    const localSessionId =
      this.getEffectiveLocalSessionId();

    [...this.players.keys()]
      .forEach(
        (sessionId) => {
          if (
            activeSessionIds.has(
              sessionId,
            )
          ) {
            return;
          }

          /*
           * 중요:
           * 최초 서버 기동 직후 create에서는 Room 연결은 성공했지만
           * client Schema players snapshot이 한두 순간 비어 있을 수 있습니다.
           *
           * createFromCleanBoot가 즉시 만든 local fallback player를
           * 이 sync 함수가 "Schema 목록에 없다"는 이유로 삭제하면:
           *
           *   local fallback 생성
           *   -> ready=true
           *   -> syncPlayersFromCurrentRoom()
           *   -> activeSessionIds가 비어 있음
           *   -> 자기 캐릭터 삭제
           *   -> ready=false
           *   -> tr('플레이어 연결 중...') 무한
           *
           * 연결된 Room의 자기 sessionId는 Schema가 늦더라도 절대 여기서
           * 삭제하지 않습니다. 실제 disconnect 시에는 Manager 전체 정리
           * 경로가 별도로 실행됩니다.
           */
          if (
            localSessionId &&
            sessionId ===
              localSessionId &&
            multiplayerClient
              .isConnected()
          ) {
            return;
          }

          this.removePlayer(
            sessionId,
          );
        },
      );
  }

  private getLobbyDisplayX(
    x: number,
  ): number {
    return Phaser.Math.Clamp(
      x,
      36,
      Math.min(
        610,
        this.gameWidth * 0.64,
      ),
    );
  }

  forceLobbyPositionsFromState(): void {
    const room =
      multiplayerClient.getRoom();

    if (
      !room ||
      room.state?.phase !== "lobby"
    ) {
      return;
    }

    room.state.players?.forEach?.(
      (
        player: NetworkPlayerState,
        sessionId: string,
      ) => {
        const view =
          this.players.get(
            sessionId,
          );

        if (!view) {
          this.addPlayer(
            sessionId,
            player,
          );
          return;
        }

        const lobbyX =
          this.getLobbyDisplayX(
            player.x,
          );

        const isLocal =
          sessionId ===
          multiplayerClient
            .getSessionId();

        if (
          !isLocal ||
          !this.localLobbyInputStarted
        ) {
          view.targetX = lobbyX;
          view.targetY = player.y;

          this.setViewPosition(
            view,
            lobbyX,
            player.y,
          );

          if (isLocal) {
            this.localX = lobbyX;
            this.localY = player.y;
            this.localMovementInitialized =
              true;
          }
        }

        view.spawnSynced = true;
      },
    );
  }

  syncLobbyPositionsFromState(): void {
    const room =
      multiplayerClient.getRoom();

    if (!room) {
      return;
    }

    room.state.players?.forEach?.(
      (
        player: NetworkPlayerState,
        sessionId: string,
      ) => {
        const view =
          this.players.get(sessionId);

        if (!view) {
          return;
        }

        const isLocal =
          sessionId ===
          this.getEffectiveLocalSessionId();

        /*
         * Online lobby:
         * the local player is client-predicted. Do not snap it back to an
         * older server echo packet on every state synchronization.
         */
        if (isLocal) {
          const lobbyX =
            this.getLobbyDisplayX(
              player.x,
            );

          if (
            !this.localLobbyInputStarted
          ) {
            this.localX = lobbyX;
            this.localY = player.y;
            view.targetX = lobbyX;
            view.targetY = player.y;

            this.setViewPosition(
              view,
              lobbyX,
              player.y,
            );

            this.localMovementInitialized = true;
          }

          view.spawnSynced = true;
          return;
        }

        const lobbyX =
          this.getLobbyDisplayX(
            player.x,
          );

        view.targetX = lobbyX;
        view.targetY = player.y;

        const initialOffset =
          Phaser.Math.Distance.Between(
            view.container.x,
            view.container.y,
            lobbyX,
            player.y,
          );

        if (
          !view.spawnSynced ||
          initialOffset > 28
        ) {
          this.setViewPosition(
            view,
            lobbyX,
            player.y,
          );
        }

        view.spawnSynced = true;
      },
    );
  }

  hasPlayer(
    sessionId: string,
  ): boolean {
    return this.players.has(
      sessionId,
    );
  }

  addPlayer(
    sessionId: string,
    player: NetworkPlayerState,
  ): void {
    const existing =
      this.players.get(sessionId);

    if (existing) {
      this.updatePlayer(
        sessionId,
        player,
      );
      return;
    }

    const isLocal =
      sessionId ===
      this.getEffectiveLocalSessionId();

    const container = this.createPlayerContainer(
      player,
    );

    const roomPhase =
      multiplayerClient.getRoom()
        ?.state?.phase;

    const initialX =
      roomPhase === "lobby"
        ? this.getLobbyDisplayX(
            player.x,
          )
        : player.x;

    container.setPosition(
      initialX,
      player.y,
    );

    const nameText =
      container.getByName(
        "network-player-name",
      ) as Phaser.GameObjects.Text;

    const paintLayer =
      this.createPaintLayer(
        container,
      );

    this.players.set(sessionId, {
      sessionId,
      container,
      nameText,
      role: player.role,
      alive: player.alive,
      customizationMode: false,
      savedX: player.x,
      savedY: player.y,
      paintZoom: 1,
      gun:
        container.getData(
          "network-gun",
        ) as Phaser.GameObjects.Container,
      aimGraphics:
        this.scene.add.graphics()
          .setDepth(180)
          .setVisible(false),
      revealMarker: undefined,
      targetX: player.x,
      targetY: player.y,
      spawnSynced: false,
      paintLayer,
      walkPhase: 0,
      walkBlend: 0,
      movingUntil: 0,
      nextFootstepAt: 0,
      huntFrozenX: undefined,
      huntFrozenY: undefined,
      leftArm:
        container.getByName(
          "network-left-arm",
        ) as Phaser.GameObjects.Rectangle,
      rightArm:
        container.getByName(
          "network-right-arm",
        ) as Phaser.GameObjects.Rectangle,
      leftLeg:
        container.getByName(
          "network-left-leg",
        ) as Phaser.GameObjects.Rectangle,
      rightLeg:
        container.getByName(
          "network-right-leg",
        ) as Phaser.GameObjects.Rectangle,
      shadow:
        container.getByName(
          "network-player-shadow",
        ) as Phaser.GameObjects.Ellipse,
      gunBaseY:
        (
          container.getData(
            "network-gun",
          ) as Phaser.GameObjects.Container
        )?.y ?? 3,
    });

    const createdView =
      this.players.get(sessionId);

    if (createdView) {
      /*
       * v0.10.10.81:
       * Always normalize the role body on creation as well as role changes.
       * This is especially important after mobile Hunter fresh-rejoin.
       */
      this.updateRoleBodyVisibility(
        createdView.container,
        player.role,
      );

      /*
       * 생성 직후 서버 좌표를 컨테이너와 페인트 레이어에
       * 즉시 동일하게 적용합니다.
       */
      createdView.targetX =
        initialX;
      createdView.targetY =
        player.y;

      this.setViewPosition(
        createdView,
        initialX,
        player.y,
      );
    }

    if (isLocal) {
      /*
       * 화면에 보이는 초기 위치와 이동 기준을 서버 spawn 좌표로 통일합니다.
       */
      this.localX = initialX;
      this.localY = player.y;
      this.localMovementInitialized = true;

      if (
        roomPhase === "lobby"
      ) {
        this.localLobbyInputStarted =
          false;
      }
    }
  }

  updatePlayer(
    sessionId: string,
    player: NetworkPlayerState,
  ): void {
    const view = this.players.get(sessionId);

    if (!view) {
      this.addPlayer(sessionId, player);
      return;
    }

    /*
     * 서버 좌표를 target에 덮어쓰기 전에 이전 target과 비교해야 합니다.
     *
     * Lobby에서는 아래 로직이 서버 좌표로 즉시 snap하기 때문에
     * update() 시점에는 distance가 이미 0이 되어 원격 캐릭터가
     * 걷지 않는 것으로 판단되던 문제가 있었습니다.
     */
    const authoritativeMoved =
      Phaser.Math.Distance.Between(
        view.targetX,
        view.targetY,
        player.x,
        player.y,
      ) > 0.35;

    const isRemote =
      sessionId !==
      this.getEffectiveLocalSessionId();

    if (
      isRemote &&
      authoritativeMoved &&
      !view.customizationMode
    ) {
      /*
       * 서버 move packet 간격보다 조금 길게 유지해서
       * packet 사이에서도 걷기 모션이 끊기지 않게 합니다.
       */
      view.movingUntil =
        Math.max(
          view.movingUntil,
          this.scene.time.now + 190,
        );
    }

    view.targetX = player.x;
    view.targetY = player.y;

    const roomPhase =
      multiplayerClient.getRoom()
        ?.state?.phase;

    if (
      roomPhase === "hunt" &&
      view.role === "hider"
    ) {
      /*
       * v0.10.10.32 and earlier could leave these populated and visually
       * freeze remote Hiders.  Authoritative Hunt movement invalidates them.
       */
      view.huntFrozenX = undefined;
      view.huntFrozenY = undefined;
    }

    /*
     * Lobby에서는 서버 spawn 좌표가 화면 표시의 유일한 기준입니다.
     * 다른 참가자도 첫 WASD 입력 전부터 정확한 서버 좌표에 표시합니다.
     */
    if (
      roomPhase === "lobby" &&
      !view.customizationMode
    ) {
      const lobbyX =
        this.getLobbyDisplayX(
          player.x,
        );

      view.targetX = lobbyX;
      view.targetY = player.y;
      if (isRemote) {
        /*
         * Remote lobby players receive authoritative targets and are
         * interpolated in update(). Avoid packet-by-packet hard snapping.
         */
        view.targetX = lobbyX;
        view.targetY = player.y;
      } else if (
        !this.localMovementInitialized
      ) {
        /*
         * Initialize the local player once from the authoritative spawn.
         * After that, local WASD prediction owns the rendered position.
         */
        this.localX = lobbyX;
        this.localY = player.y;
        view.targetX = lobbyX;
        view.targetY = player.y;

        this.setViewPosition(
          view,
          lobbyX,
          player.y,
        );

        this.localMovementInitialized = true;
      }

      view.spawnSynced = true;
    }

    if (view.role !== player.role) {
      view.role = player.role;

      if (
        sessionId ===
        this.getEffectiveLocalSessionId()
      ) {
        this.localX = player.x;
        this.localY = player.y;
        this.localMovementInitialized = true;
        this.lastLocalMoveInputAt = 0;

        this.setViewPosition(
          view,
          player.x,
          player.y,
        );
      }

      view.container.setDepth(
        player.role === "hunter"
          ? 160
          : 120,
      );

      view.aimGraphics?.setDepth(
        player.role === "hunter"
          ? 180
          : 118,
      );

      view.gun?.setVisible(
        player.role === "hunter",
      );

      this.updateRoleBodyVisibility(
        view.container,
        player.role,
      );

      view.shadow?.setVisible(
        player.role === "hunter",
      );

      view.nameText.setText(
        player.name,
      );
    }

    view.nameText.setText(
      player.name,
    );

    if (
      view.alive !== player.alive
    ) {
      view.alive = player.alive;

      view.container.setAlpha(
        player.alive ? 1 : 0.28,
      );

      view.paintLayer?.texture.setAlpha(
        player.alive ? 1 : 0.28,
      );

      view.nameText.setText(
        player.alive
          ? player.name
          : `${player.name}\nFOUND!`,
      );

      if (!player.alive) {
        this.scene.tweens.add({
          targets: [
            view.container,
          ],
          scale: 1.18,
          duration: 130,
          yoyo: true,
          repeat: 1,
        });
      }
    }

    if (
      sessionId ===
      this.getEffectiveLocalSessionId() &&
      !view.customizationMode
    ) {
      /*
       * V1010373_RECONNECT_SINGLE_AUTHORITY_GAMEPLAY_LOCK / STALE_LOCAL_ECHO_GUARD
       *
       * A half-dead Room may still replay delayed Schema x/y while SDK
       * reconnect/fresh handoff is underway. Never let those echoes drag the
       * local Hunter and camera around. Role/alive/name above are still kept.
       */
      if (
        !multiplayerClient
          .isGameplayTransportStable()
      ) {
        return;
      }

      /*
       * Lobby movement uses local prediction. The server still receives
       * coordinates, but its delayed echo must never rewind the local avatar.
       */
      if (roomPhase === "lobby") {
        return;
      }

      const now =
        this.scene.time.now;

      const recentlyMoving =
        now -
          this.lastLocalMoveInputAt <
        this.localMoveReconcileGraceMs;

      const correctionDistance =
        Phaser.Math.Distance.Between(
          this.localX,
          this.localY,
          player.x,
          player.y,
        );

      const normalDelayedEcho =
        recentlyMoving &&
        this.isNormalServerEcho(
          player.x,
          player.y,
        );

      /*
       * 로컬 캐릭터는 입력 중 client prediction을 우선합니다.
       * 예전에는 서버 echo packet이 올 때마다 localX/localY를 과거 좌표로
       * 되감아서, 특히 Hunter 첫 이동에서 앞/뒤로 덜덜거렸습니다.
       *
       * - 이동 중 작은 오차: 무시
       * - 큰 오차(32px 이상): 서버 좌표로 hard correction
       * - 입력이 멈춘 뒤: 서버 좌표로 부드럽게 정합
       */
      if (
        !this.localMovementInitialized
      ) {
        this.localX = player.x;
        this.localY = player.y;

        this.setViewPosition(
          view,
          player.x,
          player.y,
        );

        this.localMovementInitialized =
          true;
      } else if (
        !normalDelayedEcho &&
        correctionDistance >=
          this.localHardCorrectionDistance
      ) {
        this.localX =
          Phaser.Math.Linear(
            this.localX,
            player.x,
            0.72,
          );

        this.localY =
          Phaser.Math.Linear(
            this.localY,
            player.y,
            0.72,
          );

        this.setViewPosition(
          view,
          this.localX,
          this.localY,
        );
      } else if (!recentlyMoving) {
        /*
         * 정지 중에는 작은 서버 오차만 천천히 흡수해서
         * 다시 이동을 시작할 때 기준 좌표가 틀어지지 않게 합니다.
         */
        this.localX =
          Phaser.Math.Linear(
            this.localX,
            player.x,
            0.35,
          );

        this.localY =
          Phaser.Math.Linear(
            this.localY,
            player.y,
            0.35,
          );

        if (
          Phaser.Math.Distance.Between(
            view.container.x,
            view.container.y,
            this.localX,
            this.localY,
          ) > 0.75
        ) {
          this.setViewPosition(
            view,
            this.localX,
            this.localY,
          );
        }
      }
    }
  }

  removePlayer(sessionId: string): void {
    const view = this.players.get(sessionId);

    if (!view) {
      return;
    }

    view.revealMarker?.destroy();
    view.aimGraphics?.destroy();
    view.container.destroy(true);

    if (view.paintLayer) {
      view.paintLayer.texture.destroy();
      view.paintLayer.mask.destroy();
      view.paintLayer.maskShape.destroy();
    }

    this.lobbyPresetRenderTokens.delete(
      sessionId,
    );
    this.lobbyPresetAppliedSignatures.delete(
      sessionId,
    );
    this.lobbyPresetRenderingSignatures.delete(
      sessionId,
    );
    this.activeLobbyPresetRenderSessions.delete(
      sessionId,
    );
    this.players.delete(sessionId);
  }

  syncAuthoritativePositionsNow(): void {
    const room =
      multiplayerClient.getRoom();

    if (!room) {
      return;
    }

    const now =
      this.scene.time.now;

    if (
      now -
        this.lastAuthoritativeSyncAt <
      this.authoritativeSyncIntervalMs
    ) {
      return;
    }

    this.lastAuthoritativeSyncAt =
      now;

    /*
     * Do not rely only on Colyseus player onChange callbacks.
     * Read the current authoritative Schema every frame-scale tick.
     * This guarantees the Hunter's rendered Hider position follows the
     * same x/y the server uses for shotgun hit detection.
     */
    const localSessionId =
      this.getEffectiveLocalSessionId();

    room.state.players?.forEach?.(
      (
        player: NetworkPlayerState,
        sessionId: string,
      ) => {
        /*
         * HOTFIX:
         * Local movement is client-predicted. Re-applying the server echo
         * every frame makes localX/container and authoritative x/y fight
         * each other, producing severe camera/avatar jitter.
         *
         * Keep frame-scale authority sync ONLY for remote players.
         * The local player is reconciled by the normal player-state update
         * path plus the final move packet sent when input stops.
         */
        if (
          localSessionId &&
          sessionId ===
            localSessionId
        ) {
          return;
        }

        if (
          this.players.has(
            sessionId,
          )
        ) {
          this.updatePlayer(
            sessionId,
            player,
          );
        } else {
          this.addPlayer(
            sessionId,
            player,
          );
        }
      },
    );
  }

  private rememberSentPosition(
    x: number,
    y: number,
  ): void {
    const now =
      this.scene.time.now;

    this.recentSentPositions.push({
      x,
      y,
      sentAt: now,
    });

    this.recentSentPositions =
      this.recentSentPositions
        .filter(
          (entry) =>
            now - entry.sentAt <
            1200,
        )
        .slice(-80);
  }

  private isNormalServerEcho(
    x: number,
    y: number,
  ): boolean {
    return this.recentSentPositions.some(
      (entry) =>
        Phaser.Math.Distance.Between(
          entry.x,
          entry.y,
          x,
          y,
        ) <= 2.25,
    );
  }

  moveLocalPlayer(
    directionX: number,
    directionY: number,
    delta: number,
  ): void {
    const sessionId =
      this.getEffectiveLocalSessionId();

    if (!sessionId) {
      return;
    }

    const view = this.players.get(sessionId);

    if (
      !view ||
      !view.alive ||
      view.customizationMode
    ) {
      return;
    }

    const direction =
      new Phaser.Math.Vector2(
        directionX,
        directionY,
      );

    if (direction.lengthSq() === 0) {
      if (this.localWasMoving) {
        /*
         * A movement burst may end between sendInterval ticks. Send the
         * final rendered coordinate immediately so the server hit position
         * and every remote Hunter settle on exactly the same point.
         */
        if (!this.practiceLocalSessionId) {
          multiplayerClient.sendMove(
            this.localX,
            this.localY,
          );
        }

        this.rememberSentPosition(
          this.localX,
          this.localY,
        );

        this.lastSendTime =
          this.scene.time.now;
        this.localWasMoving =
          false;
      }

      return;
    }

    this.localWasMoving = true;

    view.movingUntil =
      this.scene.time.now + 120;

    this.lastLocalMoveInputAt =
      this.scene.time.now;

    if (
      multiplayerClient.getRoom()
        ?.state?.phase === "lobby" &&
      !this.localMovementInitialized
    ) {
      /*
       * 최초 입력 1회만 화면 위치를 이동 기준으로 채택합니다.
       * 매 프레임 container 위치로 localX를 재설정하면
       * 입력/서버 sync가 서로 싸우며 미세 진동할 수 있습니다.
       */
      this.localX = view.container.x;
      this.localY = view.container.y;
      view.targetX = view.container.x;
      view.targetY = view.container.y;
      this.localMovementInitialized = true;
    }

    if (
      multiplayerClient.getRoom()
        ?.state?.phase === "lobby"
    ) {
      this.localLobbyInputStarted =
        true;
    }

    direction.normalize();

    const roomPhase =
      multiplayerClient.getRoom()
        ?.state?.phase;

    /*
     * V101023838_HUNT_BALANCE
     * Hiders keep normal speed in lobby/paint/practice, but during the real
     * Hunt phase their movement is exactly 50% of the previous value.
     * Hunter speed is unchanged.
     */
    const speed =
      view.role === "hunter"
        ? this.hunterMoveSpeed
        : this.hiderMoveSpeed *
          (
            roomPhase === "hunt"
              ? 0.5
              : 1
          );

    const distance =
      speed *
      (view.role === 'hunter' ? this.localHunterSpeedMultiplier : 1) *
      (delta / 1000);

    const maxMovementX =
      roomPhase === "lobby"
        ? Math.min(
            610,
            this.gameWidth * 0.64,
          )
        : this.gameWidth - 24;

    this.localX = Phaser.Math.Clamp(
      this.localX +
        direction.x * distance,
      24,
      maxMovementX,
    );

    this.localY = Phaser.Math.Clamp(
      this.localY +
        direction.y * distance,
      42,
      this.gameHeight - 30,
    );

    view.targetX = this.localX;
    view.targetY = this.localY;

    this.setViewPosition(
      view,
      this.localX,
      this.localY,
    );

    const now = this.scene.time.now;

    if (
      now - this.lastSendTime >=
      this.sendInterval
    ) {
      this.lastSendTime = now;

      if (!this.practiceLocalSessionId) {
        multiplayerClient.sendMove(
          this.localX,
          this.localY,
        );
      }

      this.rememberSentPosition(
        this.localX,
        this.localY,
      );
    }
  }

  update(delta = 16): void {
    /*
     * V1010374_PAINT_FLOOD_FRAME_BUDGET / FRAME_DRAIN
     */
    this.drainRemotePaintQueue();

    const localSessionId =
      this.getEffectiveLocalSessionId();

    this.players.forEach(
      (view, sessionId) => {
        if (
          sessionId === localSessionId
        ) {
          const moving =
            this.scene.time.now <
            view.movingUntil;

          this.applyWalkMotion(
            view,
            moving,
            delta,
          );

          /*
           * applyWalkMotion 안에서 hunt idle Hider는 이미 pixel-snap까지
           * 처리하므로 다시 sub-pixel 위치로 덮어쓰지 않습니다.
           */
          if (
            !(
              multiplayerClient.getRoom()
                ?.state.phase ===
                  "hunt" &&
              view.role ===
                "hider" &&
              !moving
            )
          ) {
            this.syncPaintLayerPosition(
              view,
            );
          }

          return;
        }

        if (view.customizationMode) {
          return;
        }

        if (
          multiplayerClient.getRoom()
            ?.state.phase === "lobby"
        ) {
          const distance =
            Phaser.Math.Distance.Between(
              view.container.x,
              view.container.y,
              view.targetX,
              view.targetY,
            );

          if (distance > 0.4) {
            view.movingUntil =
              this.scene.time.now + 180;
          }

          if (
            distance > 100 ||
            !Number.isFinite(view.container.x) ||
            !Number.isFinite(view.container.y)
          ) {
            this.setViewPosition(
              view,
              view.targetX,
              view.targetY,
            );
          } else if (distance > 0.15) {
            /*
             * Smooth remote players between network packets.
             * Frame-rate independent damping keeps motion stable online.
             */
            const smoothing =
              1 -
              Math.pow(
                0.001,
                delta / 1000,
              );

            this.setViewPosition(
              view,
              Phaser.Math.Linear(
                view.container.x,
                view.targetX,
                smoothing,
              ),
              Phaser.Math.Linear(
                view.container.y,
                view.targetY,
                smoothing,
              ),
            );
          } else {
            this.setViewPosition(
              view,
              view.targetX,
              view.targetY,
            );
          }

          this.applyWalkMotion(
            view,
            this.scene.time.now <
              view.movingUntil,
            delta,
          );

          return;
        }

        const distance =
          Phaser.Math.Distance.Between(
            view.container.x,
            view.container.y,
            view.targetX,
            view.targetY,
          );

        const huntActive =
          multiplayerClient.getRoom()
            ?.state.phase === "hunt";

        /*
         * HIT-POSITION SYNC:
         * During Hunt, the server's Hider x/y is also the authoritative
         * shotgun hit position.  Rendering a remote Hider behind that point
         * via interpolation lets a Hunter shoot what they see but miss the
         * server-side target.
         *
         * Therefore remote Hiders snap to each authoritative Hunt update.
         * Between network updates they remain stable at the latest true
         * position.  The walk animation is driven only when that position
         * actually changes.
         */
        if (
          huntActive &&
          view.role === "hider"
        ) {
          const actuallyMoved =
            distance > 0.35;

          /*
           * v0.10.10.67
           * Do NOT packet-snap remote Hiders during Hunt.
           * Movement packets can arrive in uneven bursts even when they are
           * sent frequently; snapping made the character visibly stutter.
           *
           * Use strong frame-rate-independent damping. With the current
           * high-frequency movement send this stays only a few pixels behind
           * the authoritative target while rendering continuously.
           */
          if (
            distance > 72 ||
            !Number.isFinite(view.container.x) ||
            !Number.isFinite(view.container.y)
          ) {
            this.setViewPosition(
              view,
              view.targetX,
              view.targetY,
            );
          } else if (distance > 0.08) {
            const smoothing =
              1 -
              Math.pow(
                0.00002,
                delta / 1000,
              );

            this.setViewPosition(
              view,
              Phaser.Math.Linear(
                view.container.x,
                view.targetX,
                smoothing,
              ),
              Phaser.Math.Linear(
                view.container.y,
                view.targetY,
                smoothing,
              ),
            );
          } else {
            this.setViewPosition(
              view,
              view.targetX,
              view.targetY,
            );
          }

          view.movingUntil =
            actuallyMoved
              ? this.scene.time.now + 140
              : view.movingUntil;

          this.applyWalkMotion(
            view,
            this.scene.time.now <
              view.movingUntil,
            delta,
          );

          return;
        }

        /*
         * Hider는 네트워크 좌표의 아주 작은 흔들림(패킷 보간/부동소수점)을
         * 걷기 시작으로 취급하지 않습니다.
         */
        const movementThreshold =
          huntActive &&
          view.role === "hider"
            ? 1.25
            : 0.4;

        if (
          distance >
          movementThreshold
        ) {
          view.movingUntil =
            this.scene.time.now + 140;
        } else if (
          huntActive &&
          view.role === "hider"
        ) {
          view.movingUntil = 0;
        }

        /*
         * 초기 생성 또는 서버 재동기화처럼 차이가 큰 경우에는
         * 보간하지 않고 즉시 정확한 위치에 맞춥니다.
         */
        if (
          distance > 120 ||
          !Number.isFinite(
            view.container.x,
          ) ||
          !Number.isFinite(
            view.container.y,
          )
        ) {
          this.setViewPosition(
            view,
            view.targetX,
            view.targetY,
          );

          /*
           * 좌표를 큰 폭으로 snap한 프레임에도 서버상 이동 중이었다면
           * 걷기 모션은 계속 보여줍니다.
           */
          this.applyWalkMotion(
            view,
            this.scene.time.now <
              view.movingUntil,
            delta,
          );

          return;
        }

        if (distance < 0.2) {
          this.setViewPosition(
            view,
            view.targetX,
            view.targetY,
          );

          /*
           * 렌더 좌표가 target에 도착했다고 바로 idle로 만들지 않습니다.
           * 다음 서버 move packet까지 movingUntil 동안 걷기 리듬 유지.
           */
          this.applyWalkMotion(
            view,
            this.scene.time.now <
              view.movingUntil,
            delta,
          );

          return;
        }

        /*
         * V1010338_CRITICAL_GAMEPLAY_TRIPLE_FIX / REMOTE_HUNTER_SMOOTHING
         *
         * Fixed 0.22 lerp depends on FPS and makes uneven network packet
         * cadence visible as stop/go motion, especially with 3+ players.
         *
         * Hunter gets frame-rate-independent damping during Hunt.
         * Other phases keep a slightly softer equivalent damping.
         */
        const smoothing =
          1 -
          Math.pow(
            huntActive &&
            view.role === "hunter"
              ? 0.00001
              : 0.00008,
            Math.max(1, delta) / 1000,
          );

        const x = Phaser.Math.Linear(
          view.container.x,
          view.targetX,
          smoothing,
        );

        const y = Phaser.Math.Linear(
          view.container.y,
          view.targetY,
          smoothing,
        );

        this.setViewPosition(
          view,
          x,
          y,
        );

        this.applyWalkMotion(
          view,
          this.scene.time.now <
            view.movingUntil,
          delta,
        );
      },
    );
  }

  isLocalCustomizationMode(): boolean {
    const sessionId =
      this.getEffectiveLocalSessionId();

    if (!sessionId) {
      return false;
    }

    return (
      this.players.get(sessionId)
        ?.customizationMode === true
    );
  }

  getLocalRole(): NetworkPlayerRole | null {
    const sessionId =
      this.getEffectiveLocalSessionId();

    if (!sessionId) {
      return null;
    }

    return (
      this.players.get(sessionId)
        ?.role ?? null
    );
  }

  canLocalControlHunter(): boolean {
    if (this.practiceLocalSessionId) {
      return (
        this.getLocalRole() ===
        "hunter"
      );
    }

    return (
      this.getLocalRole() ===
        "hunter" &&
      multiplayerClient.getLocalPlayer()
        ?.role === "hunter"
    );
  }

  setLocalHunterSpeedMultiplier(multiplier: number): void {
    this.localHunterSpeedMultiplier = Phaser.Math.Clamp(
      Number.isFinite(multiplier) ? multiplier : 1,
      0.1,
      1,
    );
  }

  getPlayerPosition(
    sessionId: string,
  ): Phaser.Math.Vector2 | null {
    const view =
      this.players.get(
        sessionId,
      );

    if (!view) {
      return null;
    }

    return new Phaser.Math.Vector2(
      view.container.x,
      view.container.y,
    );
  }

  getLocalPlayerContainer():
    | Phaser.GameObjects.Container
    | null {
    const sessionId =
      this.getEffectiveLocalSessionId();

    if (!sessionId) {
      return null;
    }

    return (
      this.players.get(sessionId)
        ?.container ?? null
    );
  }

  isLocalHunter(): boolean {
    return this.canLocalControlHunter();
  }

  snapLocalPlayerToAuthoritativePosition(): void {
    const sessionId =
      this.getEffectiveLocalSessionId();

    if (!sessionId) {
      return;
    }

    const view =
      this.players.get(sessionId);

    if (!view) {
      return;
    }

    /*
     * 서버에서 받은 최신 target 좌표와 렌더 좌표/local movement 기준을
     * 한 번에 통일합니다. 첫 이동/첫 확대에서 오래된 container 좌표가
     * 사용되어 순간 이동하는 현상을 막습니다.
     */
    this.localX = view.targetX;
    this.localY = view.targetY;
    this.localMovementInitialized = false;

    this.setViewPosition(
      view,
      view.targetX,
      view.targetY,
    );
  }

  getAliveHunterPositions():
    Phaser.Math.Vector2[] {
    const positions:
      Phaser.Math.Vector2[] = [];

    this.players.forEach(
      (view) => {
        if (
          view.role !== "hunter" ||
          !view.alive
        ) {
          return;
        }

        positions.push(
          new Phaser.Math.Vector2(
            view.container.x,
            view.container.y,
          ),
        );
      },
    );

    return positions;
  }

  getPlayerContainer(
    sessionId: string,
  ): Phaser.GameObjects.Container | null {
    return (
      this.players.get(sessionId)
        ?.container ?? null
    );
  }

  getPlayerAimAngle(
    sessionId: string,
  ): number {
    const view =
      this.players.get(sessionId);

    return (
      view?.gun?.rotation ??
      view?.aimGraphics?.rotation ??
      0
    );
  }

  getSpectatablePlayers(): Array<{
    sessionId: string;
    name: string;
    role: NetworkPlayerRole;
    alive: boolean;
    x: number;
    y: number;
  }> {
    return [...this.players.entries()]
      .filter(
        ([, view]) => view.alive,
      )
      .map(
        ([sessionId, view]) => ({
          sessionId,
          name:
            view.nameText.text ||
            "Player",
          role: view.role,
          alive: view.alive,
          x: view.container.x,
          y: view.container.y,
        }),
      );
  }

  getLocalPlayerPosition():
    | Phaser.Math.Vector2
    | null {
    const sessionId =
      this.getEffectiveLocalSessionId();

    if (!sessionId) {
      return null;
    }

    const view =
      this.players.get(sessionId);

    if (!view) {
      return null;
    }

    return new Phaser.Math.Vector2(
      view.container.x,
      view.container.y,
    );
  }

  isLocalHider(): boolean {
    if (this.practiceLocalSessionId) {
      return (
        this.getLocalRole() ===
        "hider"
      );
    }

    return (
      multiplayerClient.getLocalPlayer()
        ?.role === "hider"
    );
  }

  getLocalPaintVisual():
    | {
        source:
          HTMLCanvasElement |
          HTMLImageElement;
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
      }
    | null {
    const sessionId =
      this.getEffectiveLocalSessionId();

    if (!sessionId) {
      return null;
    }

    const view =
      this.players.get(sessionId);

    if (!view?.paintLayer) {
      return null;
    }

    const source =
      view.paintLayer.texture
        .texture
        .getSourceImage() as
          | HTMLCanvasElement
          | HTMLImageElement;

    if (!source) {
      return null;
    }

    return {
      source,
      x: view.container.x,
      y: view.container.y,
      scaleX:
        view.container.scaleX || 1,
      scaleY:
        view.container.scaleY || 1,
    };
  }

  getLocalPlayerVisualScale(): number {
    const sessionId =
      this.getEffectiveLocalSessionId();

    if (!sessionId) {
      return 1;
    }

    const view =
      this.players.get(sessionId);

    if (!view) {
      return 1;
    }

    return Math.max(
      0.01,
      view.container.scaleX || 1,
    );
  }

  private isPaintPixelInsideCharacter(
    textureX: number,
    textureY: number,
  ): boolean {
    const x =
      Math.round(textureX);
    const y =
      Math.round(textureY);

    /*
     * This is the ONE authoritative paint silhouette used by local paint,
     * remote replay and every brush size.
     *
     * Texture origin is character local (-40, -60).
     * All boundaries are integer pixels to avoid antialiased fringe.
     */
    const headDx =
      x - 40;
    const headDy =
      y - 48;

    const insideHead =
      headDx * headDx +
        headDy * headDy <=
      12 * 12;

    const insideBody =
      x >= 31 &&
      x <= 48 &&
      y >= 55 &&
      y <= 78;

    /*
     * Arms and legs overlap the torso by 1-2 pixels.
     * This deliberately removes the unpaintable white seams that used to
     * appear between body/arms and body/legs.
     */
    const insideLeftArm =
      x >= 24 &&
      x <= 31 &&
      y >= 57 &&
      y <= 74;

    const insideRightArm =
      x >= 48 &&
      x <= 55 &&
      y >= 57 &&
      y <= 74;

    const insideLeftLeg =
      x >= 31 &&
      x <= 38 &&
      y >= 75 &&
      y <= 88;

    const insideRightLeg =
      x >= 41 &&
      x <= 48 &&
      y >= 75 &&
      y <= 88;

    return (
      insideHead ||
      insideBody ||
      insideLeftArm ||
      insideRightArm ||
      insideLeftLeg ||
      insideRightLeg
    );
  }

  private ensurePaintPixelTexture(
    color: number,
  ): string {
    const textureKey =
      `paint-pixel-${color
        .toString(16)
        .padStart(6, "0")}`;

    if (
      this.scene.textures.exists(
        textureKey,
      )
    ) {
      return textureKey;
    }

    const graphics =
      this.scene.add.graphics();

    graphics.fillStyle(
      color,
      1,
    );

    graphics.fillRect(
      0,
      0,
      1,
      1,
    );

    graphics.generateTexture(
      textureKey,
      1,
      1,
    );

    this.scene.textures
      .get(textureKey)
      .setFilter(
        Phaser.Textures
          .FilterMode.NEAREST,
      );

    graphics.destroy();

    return textureKey;
  }

  private stampMaskedPaintBrush(
    view: NetworkPlayerView,
    centerX: number,
    centerY: number,
    color: number,
    size: number,
    shape: NetworkBrushShape,
    renderNow = true,
  ): void {
    if (!view.paintLayer) {
      return;
    }

    const pixelTexture =
      this.ensurePaintPixelTexture(
        color,
      );

    /*
     * size is the actual pixel DIAMETER. Previously size=2 was interpreted
     * as radius=2, so 1px -> 2px jumped from 1x1 to as much as 5x5.
     * Keep square brushes exactly N x N and circular brushes inside the same
     * N x N footprint.
     */
    const diameter = Math.max(
      1,
      Math.round(size),
    );
    const minOffset =
      -Math.floor(diameter / 2);
    const maxOffset =
      minOffset + diameter - 1;
    const centerOffset =
      (minOffset + maxOffset) / 2;
    const circleRadius =
      Math.max(0.5, diameter / 2 - 0.25);

    for (
      let offsetY = minOffset;
      offsetY <= maxOffset;
      offsetY += 1
    ) {
      for (
        let offsetX = minOffset;
        offsetX <= maxOffset;
        offsetX += 1
      ) {
        if (shape !== "square") {
          const dx =
            offsetX - centerOffset;
          const dy =
            offsetY - centerOffset;
          const insideBrush =
            dx * dx + dy * dy <=
            circleRadius * circleRadius;

          if (!insideBrush) {
            continue;
          }
        }

        const pixelX =
          Math.round(
            centerX +
            offsetX,
          );

        const pixelY =
          Math.round(
            centerY +
            offsetY,
          );

        if (
          !this.isPaintPixelInsideCharacter(
            pixelX,
            pixelY,
          )
        ) {
          continue;
        }

        view.paintLayer.texture.stamp(
          pixelTexture,
          undefined,
          pixelX,
          pixelY,
          {
            /*
             * IMPORTANT:
             * The white Hider base is generated as Canvas pixel cells
             * [x,x+1) × [y,y+1). A 1x1 stamp with origin 0.5 is shifted
             * by half a pixel and exposes a white fringe on the opposite
             * edge. Use top-left origin so paint cell and body cell are
             * exactly identical.
             */
            originX: 0,
            originY: 0,
          },
        );
      }
    }

    if (renderNow) {
      this.renderPaintTexture(
        view.paintLayer.texture,
      );
    }
  }

  paintLocalPlayer(
    worldX: number,
    worldY: number,
    _brushTextureKey: string,
    color: number,
    size: number,
    shape: NetworkBrushShape,
  ): NetworkPaintPoint | null {
    const sessionId =
      this.getEffectiveLocalSessionId();

    if (!sessionId) {
      return null;
    }

    const view = this.players.get(sessionId);

    if (
      !view ||
      !view.paintLayer ||
      !view.alive
    ) {
      return null;
    }

    const scaleX =
      view.container.scaleX || 1;

    const scaleY =
      view.container.scaleY || 1;

    const localX =
      (
        worldX -
        view.container.x
      ) / scaleX;

    const localY =
      (
        worldY -
        view.container.y
      ) / scaleY;

    /*
     * 가장자리 색칠 편의성:
     *
     * 이전에는 브러시의 '중심점'이 몸 안에 있을 때만 stamp를 허용했습니다.
     * 그래서 큰 브러시의 절반이 몸에 걸쳐 있어도 중심이 1px 밖이면
     * 아무것도 칠해지지 않았습니다.
     *
     * 이제 중심점 shape 검사를 하지 않습니다.
     * 브러시를 실제 커서 위치에 그대로 stamp하고,
     * paint geometry mask가 캐릭터 밖의 픽셀만 자동으로 잘라냅니다.
     *
     * 즉 화면에 보이는 브러시와 실제 색칠 범위가 동일하게 동작합니다.
     */

    /*
     * Paint 입력 범위를 실제 캐릭터 몸 크기에 맞춥니다.
     *
     * 실제 캐릭터 실루엣은 대략:
     *   X: -16.5 ~ +16.5
     *   Y: -24   ~ +30
     *
     * 기존 -48~48 / -68~68 범위는 몸보다 지나치게 커서,
     * 스크린샷처럼 캐릭터 주변 허공까지 paint stamp가 남을 수 있었습니다.
     *
     * 가장자리 색칠 편의성을 잃지 않도록 3~4px 정도의 작은 여유만 둡니다.
     */
    /*
     * A large brush may reach a visible edge from a center just outside
     * the exact silhouette.  If center input is limited to the silhouette,
     * that edge can become impossible to repaint later with a 1px brush.
     *
     * Accept a tight body-area box for pointer centers and let the shared
     * geometry mask decide the final visible pixels.  Thus no paint is
     * visible outside the character, while every visible edge remains
     * reachable with a small brush.
     */
    if (
      localX < -18 ||
      localX > 18 ||
      localY < -26 ||
      localY > 31
    ) {
      return null;
    }

    /*
     * 색칠 좌표를 texture pixel grid에 스냅합니다.
     * 소수점 위치에 stamp되어 가장자리가 흐릿해지는 현상을 줄입니다.
     */
    const textureX =
      Math.round(
        localX + 40,
      );

    const textureY =
      Math.round(
        localY + 60,
      );

    if (view.customizationMode) {
      view.paintLayer.texture
        .setVisible(true)
        .setAlpha(1)
        .setDepth(921);
    }

    this.stampMaskedPaintBrush(
      view,
      textureX,
      textureY,
      color,
      size,
      shape,
    );

    return {
      x: textureX,
      y: textureY,
    };
  }

  stampLocalPaintPoint(
    textureX: number,
    textureY: number,
    _brushTextureKey: string,
    color: number,
    size: number,
    shape: NetworkBrushShape,
  ): void {
    const sessionId =
      this.getEffectiveLocalSessionId();

    if (!sessionId) {
      return;
    }

    const view =
      this.players.get(sessionId);

    if (
      !view?.paintLayer ||
      !view.alive
    ) {
      return;
    }

    const pixelX =
      Phaser.Math.Clamp(
        Math.round(textureX),
        0,
        80,
      );

    const pixelY =
      Phaser.Math.Clamp(
        Math.round(textureY),
        0,
        120,
      );

    this.stampMaskedPaintBrush(
      view,
      pixelX,
      pixelY,
      color,
      size,
      shape,
    );
  }

  private readonly lobbyPresetRenderTokens =
    new Map<string, number>();

  private readonly activeLobbyPresetRenderSessions =
    new Set<string>();

  /*
   * v0.10.10.119:
   * The server can resend the same avatar preset during lobby snapshots /
   * reconnect reconciliation.  Re-clearing and replaying an identical
   * preset makes mobile avatars visibly blink. Cache what is already on
   * screen and ignore exact-equivalent replays.
   */
  private readonly lobbyPresetAppliedSignatures =
    new Map<string, string>();

  private readonly lobbyPresetRenderingSignatures =
    new Map<string, string>();

  private getLobbyPresetSignature(
    strokes: NetworkPaintStroke[],
  ): string {
    let hash = 2166136261;
    let pointCount = 0;

    const mix =
      (value: number): void => {
        hash ^= value | 0;
        hash = Math.imul(
          hash,
          16777619,
        );
      };

    strokes.forEach(
      (stroke) => {
        mix(stroke.color);
        mix(
          Math.round(
            stroke.size * 100,
          ),
        );
        mix(
          stroke.shape === "square"
            ? 2
            : 1,
        );
        mix(stroke.points.length);

        stroke.points.forEach(
          (point) => {
            pointCount += 1;
            mix(
              Math.round(
                point.x * 10,
              ),
            );
            mix(
              Math.round(
                point.y * 10,
              ),
            );
          },
        );
      },
    );

    return [
      strokes.length,
      pointCount,
      hash >>> 0,
    ].join(":");
  }

  isLobbyAvatarRendering(): boolean {
    return (
      this.activeLobbyPresetRenderSessions.size >
      0
    );
  }

  private expandLobbyAvatarStrokePoints(
    points: NetworkPaintPoint[],
  ): NetworkPaintPoint[] {
    if (
      points.length <=
      1
    ) {
      return points.map(
        (point) => ({
          x: point.x,
          y: point.y,
        }),
      );
    }

    const expanded:
      NetworkPaintPoint[] = [];

    for (
      let index = 1;
      index < points.length;
      index += 1
    ) {
      const from =
        points[index - 1];
      const to =
        points[index];

      const dx =
        to.x - from.x;
      const dy =
        to.y - from.y;

      const steps =
        Math.max(
          Math.abs(
            Math.round(dx),
          ),
          Math.abs(
            Math.round(dy),
          ),
          1,
        );

      for (
        let step = 0;
        step <= steps;
        step += 1
      ) {
        if (
          index > 1 &&
          step === 0
        ) {
          continue;
        }

        const t =
          step / steps;

        const point = {
          x:
            Math.round(
              Phaser.Math.Linear(
                from.x,
                to.x,
                t,
              ),
            ),
          y:
            Math.round(
              Phaser.Math.Linear(
                from.y,
                to.y,
                t,
              ),
            ),
        };

        const previous =
          expanded[
            expanded.length - 1
          ];

        if (
          !previous ||
          previous.x !== point.x ||
          previous.y !== point.y
        ) {
          expanded.push(
            point,
          );
        }
      }
    }

    return expanded;
  }

  applyLobbyAvatarPresetProgressive(
    sessionId: string,
    strokes: NetworkPaintStroke[],
    pointsPerFrame = 48,
  ): void {
    const view =
      this.players.get(
        sessionId,
      );

    if (!view?.paintLayer) {
      return;
    }

    const signature =
      this.getLobbyPresetSignature(
        strokes,
      );

    if (
      this.lobbyPresetAppliedSignatures.get(
        sessionId,
      ) === signature
    ) {
      view.paintLayer.texture
        .setVisible(true)
        .setAlpha(1);
      return;
    }

    if (
      this.lobbyPresetRenderingSignatures.get(
        sessionId,
      ) === signature
    ) {
      return;
    }

    this.lobbyPresetRenderingSignatures.set(
      sessionId,
      signature,
    );

    const renderToken =
      (
        this.lobbyPresetRenderTokens.get(
          sessionId,
        ) ?? 0
      ) + 1;

    this.lobbyPresetRenderTokens.set(
      sessionId,
      renderToken,
    );

    this.activeLobbyPresetRenderSessions.add(
      sessionId,
    );

    const commands =
      strokes.flatMap(
        (stroke) =>
          this.expandLobbyAvatarStrokePoints(
            stroke.points,
          ).map(
            (point) => ({
              point,
              color:
                stroke.color,
              size:
                stroke.size,
              shape:
                stroke.shape,
            }),
          ),
      );

    view.paintLayer.texture.clear();

    let cursor = 0;

    const drawBatch =
      (): void => {
        if (
          this.lobbyPresetRenderTokens.get(
            sessionId,
          ) !== renderToken
        ) {
          return;
        }

        const currentView =
          this.players.get(
            sessionId,
          );

        if (
          !currentView?.paintLayer
        ) {
          if (
            this.lobbyPresetRenderTokens.get(
              sessionId,
            ) === renderToken
          ) {
            this.activeLobbyPresetRenderSessions.delete(
              sessionId,
            );
          }

          return;
        }

        const end =
          Math.min(
            commands.length,
            cursor +
              Math.max(
                40,
                pointsPerFrame,
              ),
          );

        for (
          ;
          cursor < end;
          cursor += 1
        ) {
          const command =
            commands[cursor];

          this.stampMaskedPaintBrush(
            currentView,
            Math.round(
              command.point.x,
            ),
            Math.round(
              command.point.y,
            ),
            command.color,
            command.size,
            command.shape,
            false,
          );
        }

        this.renderPaintTexture(
          currentView.paintLayer.texture,
        );

        this.syncPaintLayerPosition(
          currentView,
          false,
        );

        currentView.paintLayer.texture
          .setVisible(true)
          .setAlpha(1);

        if (
          cursor <
          commands.length
        ) {
          this.scene.time.delayedCall(
            16,
            drawBatch,
          );

          return;
        }

        if (
          this.lobbyPresetRenderTokens.get(
            sessionId,
          ) === renderToken
        ) {
          this.lobbyPresetAppliedSignatures.set(
            sessionId,
            signature,
          );
          this.lobbyPresetRenderingSignatures.delete(
            sessionId,
          );
          this.activeLobbyPresetRenderSessions.delete(
            sessionId,
          );
        }
      };

    drawBatch();
  }

  applyLobbyAvatarPreset(
    sessionId: string,
    strokes: NetworkPaintStroke[],
  ): void {
    const view =
      this.players.get(
        sessionId,
      );

    if (!view?.paintLayer) {
      return;
    }

    const signature =
      this.getLobbyPresetSignature(
        strokes,
      );

    if (
      this.lobbyPresetAppliedSignatures.get(
        sessionId,
      ) === signature
    ) {
      view.paintLayer.texture
        .setVisible(true)
        .setAlpha(1);
      return;
    }

    /*
     * Cancel any older progressive job for this player before replacing
     * the texture atomically.
     */
    this.lobbyPresetRenderTokens.set(
      sessionId,
      (
        this.lobbyPresetRenderTokens.get(
          sessionId,
        ) ?? 0
      ) + 1,
    );
    this.lobbyPresetRenderingSignatures.delete(
      sessionId,
    );
    this.activeLobbyPresetRenderSessions.delete(
      sessionId,
    );

    view.paintLayer.texture.clear();

    strokes.forEach(
      (stroke) => {
        const points =
          this.expandLobbyAvatarStrokePoints(
            stroke.points,
          );

        points.forEach(
          (point) => {
            this.stampMaskedPaintBrush(
              view,
              Math.round(point.x),
              Math.round(point.y),
              stroke.color,
              stroke.size,
              stroke.shape,
              false,
            );
          },
        );
      },
    );

    this.renderPaintTexture(
      view.paintLayer.texture,
    );

    this.lobbyPresetAppliedSignatures.set(
      sessionId,
      signature,
    );

    this.syncPaintLayerPosition(
      view,
      false,
    );

    view.paintLayer.texture
      .setVisible(true)
      .setAlpha(1);
  }

  applyPaintStroke(
    stroke: NetworkPaintStroke,
    textureKey: string,
  ): void {
    if (
      stroke.points.length === 0
    ) {
      return;
    }

    /*
     * V1010374_PAINT_FLOOD_FRAME_BUDGET / ENQUEUE_ONLY
     * Never rasterize a network packet directly from a WebSocket callback.
     */
    this.pendingRemotePaintStrokes.push({
      stroke,
      textureKey,
    });
  }

  private drainRemotePaintQueue(): void {
    if (
      this.pendingRemotePaintStrokes.length ===
      0
    ) {
      return;
    }

    let remainingBudget =
      this.remotePaintPointBudgetPerFrame;

    const touchedViews =
      new Map<
        string,
        PlayerView
      >();

    while (
      remainingBudget > 0 &&
      this.pendingRemotePaintStrokes.length >
        0
    ) {
      const queued =
        this.pendingRemotePaintStrokes[0];

      const stroke =
        queued.stroke;

      const view =
        this.players.get(
          stroke.targetSessionId,
        );

      /*
       * Preserve the old ownership guard.
       */
      const room =
        multiplayerClient.getRoom();

      const authoritativePlayer =
        room?.state?.players?.get?.(
          stroke.targetSessionId,
        );

      if (
        !view ||
        !view.paintLayer ||
        (
          room &&
          !authoritativePlayer
        )
      ) {
        this.pendingRemotePaintStrokes.shift();
        continue;
      }

      /*
       * Process a slice so a single large restore/snapshot stroke cannot own
       * the whole frame. Keep the unprocessed remainder at queue head.
       */
      const take =
        Math.min(
          remainingBudget,
          stroke.points.length,
        );

      const points =
        stroke.points.slice(
          0,
          take,
        );

      /*
       * IMPORTANT:
       * GameScene.interpolateActivePaintStroke() ALREADY serializes points at
       * ~0.75-1.5px spacing before send. The former receiver re-interpolated
       * every adjacent pair again (often doubling stamps). Direct replay here
       * is visually equivalent to the sender path while dramatically cheaper.
       */
      points.forEach(
        (point) => {
          this.stampMaskedPaintBrush(
            view,
            Math.round(
              point.x,
            ),
            Math.round(
              point.y,
            ),
            stroke.color,
            stroke.size,
            stroke.shape,
            false,
          );
        },
      );

      touchedViews.set(
        stroke.targetSessionId,
        view,
      );

      remainingBudget -=
        take;

      if (
        take >=
        stroke.points.length
      ) {
        this.pendingRemotePaintStrokes.shift();
      } else {
        queued.stroke = {
          ...stroke,
          points:
            stroke.points.slice(
              take,
            ),
        };
      }
    }

    /*
     * RenderTexture upload/render is one of the expensive parts. No matter how
     * many paint messages arrived this frame, render each touched player once.
     */
    touchedViews.forEach(
      (view) => {
        if (!view.paintLayer) {
          return;
        }

        this.renderPaintTexture(
          view.paintLayer.texture,
        );

        this.syncPaintLayerPosition(
          view,
          multiplayerClient.getRoom()
            ?.state.phase === "hunt",
        );
      },
    );
  }

  setLocalHunterCustomizationMode(
    enabled: boolean,
  ): void {
    const sessionId =
      this.getEffectiveLocalSessionId();

    if (!sessionId) {
      return;
    }

    const localView =
      this.players.get(sessionId);

    if (
      !localView ||
      localView.role !== "hunter"
    ) {
      return;
    }

    if (
      enabled &&
      !localView.customizationMode
    ) {
      localView.savedX =
        localView.container.x;
      localView.savedY =
        localView.container.y;
      localView.customizationMode = true;

      this.players.forEach(
        (view, id) => {
          const isLocal =
            id === sessionId;

          view.container.setVisible(
            isLocal,
          );

          view.paintLayer?.texture
            .setVisible(isLocal);
        },
      );

      localView.container
        .setPosition(
          this.gameWidth / 2,
          this.gameHeight / 2 + 20,
        )
        .setScale(3)
        .setDepth(920);

      localView.paintLayer?.texture
        .setVisible(true)
        .setAlpha(1)
        .setDepth(921);

      localView.paintLayer?.maskShape
        .setVisible(true);

      this.syncPaintLayerPosition(
        localView,
      );

      return;
    }

    if (
      !enabled &&
      localView.customizationMode
    ) {
      this.normalizeLocalPlayerForGameplay();
    }
  }

  setLocalPaintZoom(
    zoom: number,
  ): number {
    const sessionId =
      this.getEffectiveLocalSessionId();

    if (!sessionId) {
      return 1;
    }

    const view =
      this.players.get(sessionId);

    if (!view) {
      return 1;
    }

    const nextZoom =
      Phaser.Math.Clamp(
        zoom,
        1,
        5,
      );

    /*
     * 상대적인 휠 증감이 아니라 절대 배율을 적용합니다.
     * 배경과 캐릭터가 항상 정확히 같은 배율을 사용하게 됩니다.
     */
    view.paintZoom = nextZoom;

    const fixedX =
      view.container.x;

    const fixedY =
      view.container.y;

    view.container
      .setScale(nextZoom)
      .setPosition(
        fixedX,
        fixedY,
      );

    this.syncPaintLayerPosition(
      view,
    );

    return nextZoom;
  }

  adjustLocalPaintZoom(
    wheelDeltaY: number,
  ): number {
    const direction =
      wheelDeltaY < 0
        ? 1
        : -1;

    return this.setLocalPaintZoom(
      this.getLocalPaintZoom() +
        direction * 0.25,
    );
  }

  getLocalPaintZoom(): number {
    const sessionId =
      this.getEffectiveLocalSessionId();

    if (!sessionId) {
      return 1;
    }

    return (
      this.players.get(sessionId)
        ?.paintZoom ?? 1
    );
  }

  resetLocalPaintZoom(): void {
    const sessionId =
      this.getEffectiveLocalSessionId();

    if (!sessionId) {
      return;
    }

    const view =
      this.players.get(sessionId);

    if (!view) {
      return;
    }

    view.paintZoom = 1;

    view.container
      .setScale(1)
      .setDepth(
        view.role === "hunter"
          ? 160
          : 120,
      );

    if (view.paintLayer) {
      view.paintLayer.texture
        .setScale(1)
        .setDepth(
          view.role === "hunter"
            ? 162
            : 122,
        );

      view.paintLayer.maskShape
        .setScale(1);
    }

    this.syncPaintLayerPosition(view);
  }

  stabilizeHidersForHunt(): void {
    this.players.forEach(
      (view) => {
        if (
          view.role !== "hider" ||
          !view.alive
        ) {
          return;
        }

        /*
         * Paint -> Hunt only stabilizes the VISUAL pose.
         *
         * Do not freeze world X/Y here.  The previous implementation stored
         * huntFrozenX/Y and every later setViewPosition() snapped the Hider
         * back to that starting point on Hunter clients, while the server
         * continued accepting the Hider's real movement.
         */
        view.huntFrozenX = undefined;
        view.huntFrozenY = undefined;
        view.movingUntil = 0;
        view.walkBlend = 0;

        /*
         * Keep the latest authoritative target.  Only integer-snap the
         * currently rendered pose once to remove Paint sub-pixel residue.
         */
        const stableX =
          Math.round(
            view.container.x,
          );
        const stableY =
          Math.round(
            view.container.y,
          );

        view.container.setPosition(
          stableX,
          stableY,
        );

        this.resetWalkPoseImmediately(
          view,
        );

        this.syncPaintLayerPosition(
          view,
          true,
        );
      },
    );
  }

  normalizeLocalPlayerForGameplay(): void {
    const sessionId =
      this.getEffectiveLocalSessionId();

    if (!sessionId) {
      return;
    }

    const view =
      this.players.get(sessionId);

    if (!view) {
      return;
    }

    view.customizationMode = false;
    view.paintZoom = 1;
    view.huntFrozenX = undefined;
    view.huntFrozenY = undefined;

    this.localX = view.targetX;
    this.localY = view.targetY;
    this.localMovementInitialized = true;

    view.container
      .setScale(1)
      .setDepth(
        view.role === "hunter"
          ? 160
          : 120,
      )
      .setPosition(
        view.targetX,
        view.targetY,
      )
      .setVisible(true);

    if (view.paintLayer) {
      view.paintLayer.texture
        .setScale(1)
        .setDepth(
          view.role === "hunter"
            ? 162
            : 122,
        )
        .setVisible(true);

      view.paintLayer.maskShape
        .setScale(1);
    }

    this.restoreAllPlayerVisibility();

    this.syncPaintLayerPosition(view);
  }

  clearAllPaint(): void {
    this.lobbyPresetRenderTokens.clear();
    this.lobbyPresetAppliedSignatures.clear();
    this.lobbyPresetRenderingSignatures.clear();
    this.activeLobbyPresetRenderSessions.clear();

    this.players.forEach(
      (view) => {
        view.paintLayer?.texture.clear();

        if (view.paintLayer) {
          this.renderPaintTexture(
            view.paintLayer.texture,
          );
        }

        view.container
          .setAlpha(1)
          .setScale(1);

        view.paintLayer?.texture
          .setAlpha(1)
          .setScale(1);

        view.alive = true;
        view.customizationMode = false;
        view.paintZoom = 1;
      },
    );
  }

  showOnlyLocalPlayer(): void {
    const localSessionId =
      this.getEffectiveLocalSessionId();

    this.players.forEach(
      (view, sessionId) => {
        const isLocal =
          sessionId === localSessionId;

        view.container.setVisible(
          isLocal,
        );

        view.paintLayer?.texture
          .setVisible(isLocal);

        view.nameText.setVisible(
          false,
        );

        view.revealMarker?.setVisible(
          false,
        );

        view.aimGraphics
          ?.setVisible(false);

        view.gun?.setVisible(
          isLocal &&
          view.role === "hunter",
        );
      },
    );
  }

  restoreAllPlayerVisibility(): void {
    this.players.forEach(
      (view) => {
        view.container.setVisible(true);

        view.paintLayer?.texture
          .setVisible(true);

        view.nameText.setVisible(true);

        view.gun?.setVisible(
          view.role === "hunter",
        );
      },
    );
  }

  setAllVisible(
    visible: boolean,
  ): void {
    this.players.forEach(
      (view) => {
        view.container.setVisible(
          visible,
        );

        view.paintLayer?.texture
          .setVisible(visible);
      },
    );
  }

  setNamesVisible(
    visible: boolean,
  ): void {
    this.players.forEach(
      (view) => {
        view.nameText.setVisible(
          visible,
        );
      },
    );
  }

  updateHunterAim(
    sessionId: string,
    angle: number,
    range: number,
  ): void {
    const view =
      this.players.get(sessionId);

    if (
      !view ||
      view.role !== "hunter"
    ) {
      return;
    }

    view.gun
      ?.setVisible(true)
      .setRotation(angle);

    const graphics =
      view.aimGraphics;

    if (!graphics) {
      return;
    }

    graphics
      .setDepth(180)
      .setVisible(true)
      .clear()
      .lineStyle(
        2,
        0xffd166,
        0.62,
      );

    graphics.lineBetween(
      view.container.x,
      view.container.y,
      view.container.x +
        Math.cos(angle) * range,
      view.container.y +
        Math.sin(angle) * range,
    );
  }

  clearHunterAimLines(): void {
    this.players.forEach(
      (view) => {
        view.aimGraphics
          ?.clear()
          .setVisible(false);
      },
    );
  }

  revealHiders(
    hiders: Array<{
      sessionId: string;
      x: number;
      y: number;
    }>,
  ): void {
    this.clearRevealMarkers();

    hiders.forEach(
      (hider) => {
        const view =
          this.players.get(
            hider.sessionId,
          );

        if (!view) {
          return;
        }

        const marker =
          this.scene.add.circle(
            hider.x,
            hider.y,
            29,
            0xff2020,
            0.25,
          );

        marker.setStrokeStyle(
          5,
          0xff2020,
          1,
        );

        marker.setDepth(850);

        this.scene.tweens.add({
          targets: marker,
          alpha: 0.05,
          scale: 1.25,
          duration: 330,
          yoyo: true,
          repeat: -1,
        });

        view.revealMarker = marker;
        view.container.setAlpha(1);
        view.paintLayer?.texture
          .setAlpha(1);
      },
    );
  }

  showHiderRevealMarkers(): void {
    this.players.forEach(
      (view) => {
        if (
          view.role !== "hider" ||
          !view.alive
        ) {
          return;
        }

        view.revealMarker?.destroy();

        const marker =
          this.scene.add
            .circle(
              view.container.x,
              view.container.y,
              27,
              0xff2d2d,
              0.24,
            )
            .setStrokeStyle(
              4,
              0xff2d2d,
              1,
            )
            .setDepth(1500);

        view.revealMarker =
          marker;

        this.scene.tweens.add({
          targets: marker,
          alpha: {
            from: 0.15,
            to: 0.9,
          },
          duration: 280,
          yoyo: true,
          repeat: -1,
        });
      },
    );
  }

  clearRevealMarkers(): void {
    this.players.forEach(
      (view) => {
        view.revealMarker?.destroy();
        view.revealMarker = undefined;
      },
    );
  }

  setHunterGunsVisible(): void {
    this.players.forEach(
      (view) => {
        view.gun?.setVisible(
          view.role === "hunter",
        );
      },
    );
  }

  destroy(): void {
    [...this.players.keys()].forEach(
      (sessionId) => {
        this.removePlayer(sessionId);
      },
    );
  }

  private ensurePixelBodyTexture(
    role: NetworkPlayerRole,
  ): string {
    const textureKey =
      role === "hunter"
        ? "network-hunter-pixel-body"
        : "network-hider-pixel-body";

    if (
      this.scene.textures.exists(
        textureKey,
      )
    ) {
      return textureKey;
    }

    /*
     * One authoritative raster silhouette for BOTH roles.
     * The visible base body and the paint predicate are generated from
     * exactly the same integer cells, so a fully painted Hunter/Hider can
     * never expose an antialiased Phaser Circle/Rectangle fringe.
     */
    const canvasTexture =
      this.scene.textures.createCanvas(
        textureKey,
        80,
        120,
      );

    if (!canvasTexture) {
      throw new Error(
        "Failed to create pixel body texture",
      );
    }

    const context =
      canvasTexture.getContext();

    context.clearRect(
      0,
      0,
      80,
      120,
    );

    context.fillStyle =
      "#f5eee2";

    for (
      let y = 0;
      y < 120;
      y += 1
    ) {
      for (
        let x = 0;
        x < 80;
        x += 1
      ) {
        if (
          !this.isPaintPixelInsideCharacter(
            x,
            y,
          )
        ) {
          continue;
        }

        context.fillRect(
          x,
          y,
          1,
          1,
        );
      }
    }

    canvasTexture.refresh();

    this.scene.textures
      .get(textureKey)
      .setFilter(
        Phaser.Textures
          .FilterMode.NEAREST,
      );

    return textureKey;
  }


  private updateRoleBodyVisibility(
    container:
      Phaser.GameObjects.Container,
    role: NetworkPlayerRole,
  ): void {
    const isHunter =
      role === "hunter";

    const hiderBody =
      container.getByName(
        "network-hider-pixel-body",
      ) as
        | Phaser.GameObjects.Image
        | null;

    const hunterBody =
      container.getByName(
        "network-hunter-pixel-body",
      ) as
        | Phaser.GameObjects.Image
        | null;

    hiderBody?.setVisible(
      !isHunter,
    );

    hunterBody?.setVisible(
      isHunter,
    );

    /*
     * Legacy Phaser primitives are retained only as animation/reference
     * objects. They are never rendered because their anti-aliased edges do
     * not match the integer paint raster.
     */
    [
      "network-player-head",
      "network-player-body",
      "network-left-arm",
      "network-right-arm",
      "network-left-leg",
      "network-right-leg",
    ].forEach(
      (name) => {
        const part =
          container.getByName(
            name,
          ) as
            | Phaser.GameObjects.Shape
            | null;

        part?.setVisible(false);
      },
    );
  }


  private createPlayerContainer(
    player: NetworkPlayerState,
  ): Phaser.GameObjects.Container {
    const container =
      this.scene.add.container(0, 0);

    container.setDepth(
      player.role === "hunter"
        ? 160
        : 120,
    );

    const shadow =
      this.scene.add.ellipse(
        0,
        18,
        29,
        10,
        0x304d37,
        0.28,
      )
        .setName(
          "network-player-shadow",
        )        .setVisible(
          player.role === "hunter",
        );

    const color =
      this.getRoleColor(player.role);

    const hiderPixelBody =
      this.scene.add.image(
        -40,
        -60,
        this.ensurePixelBodyTexture(
          "hider",
        ),
      )
        .setOrigin(0, 0)
        .setName(
          "network-hider-pixel-body",
        )
        .setVisible(
          player.role === "hider",
        );

    const hunterPixelBody =
      this.scene.add.image(
        -40,
        -60,
        this.ensurePixelBodyTexture(
          "hunter",
        ),
      )
        .setOrigin(0, 0)
        .setName(
          "network-hunter-pixel-body",
        )
        /*
         * v0.10.10.81:
         * A fresh reconnect session may already arrive with role=hunter.
         * In that case updatePlayer() never sees a role CHANGE, so the old
         * hard-coded false left only the gun visible.
         */
        .setVisible(
          player.role === "hunter",
        );

    const head =
      this.scene.add.circle(
        0,
        -12,
        12,
        color,
      )
        .setName(
          "network-player-head",
        )
        .setVisible(false);

    const body =
      this.scene.add.rectangle(
        0,
        7,
        18,
        24,
        color,
      )
        .setName(
          "network-player-body",
        )
        .setVisible(false);

    const leftArm =
      this.scene.add.rectangle(
        -12,
        6,
        8,
        18,
        color,
      )
        .setName(
          "network-left-arm",
        )
        .setVisible(false);

    const rightArm =
      this.scene.add.rectangle(
        12,
        6,
        8,
        18,
        color,
      )
        .setName(
          "network-right-arm",
        )
        .setVisible(false);

    const leftLeg =
      this.scene.add.rectangle(
        -5,
        22,
        8,
        14,
        color,
      )
        .setName(
          "network-left-leg",
        )
        .setVisible(false);

    const rightLeg =
      this.scene.add.rectangle(
        5,
        22,
        8,
        14,
        color,
      )
        .setName(
          "network-right-leg",
        )
        .setVisible(false);

    /*
     * 캐릭터 외곽선 제거.
     *
     * 기존 2px stroke는 실제 paint mask 밖까지 보이는 영역을 만들었기 때문에
     * 사용자는 외곽선 위에 브러시가 닿았다고 느끼는데 paint는 적용되지 않는
     * 시각/판정 차이가 있었습니다.
     *
     * 이제 실제 몸체 fill 영역 = 색칠 가능한 실루엣입니다.
     */


    const nameText = this.scene.add
      .text(
        0,
        -39,
        player.name,
        {
          fontFamily: "monospace",
          fontSize: "10px",
          fontStyle: "bold",
          color: "#4f3f34",
          backgroundColor: "#fff4d6dd",
          align: "center",
          padding: {
            x: 5,
            y: 3,
          },
        },
      )
      .setOrigin(0.5, 1)
      .setName("network-player-name");

    const gunBody =
      this.scene.add.rectangle(
        6,
        1,
        21,
        6,
        0x654832,
      );

    const gunBarrel =
      this.scene.add.rectangle(
        22,
        1,
        18,
        4,
        0x263238,
      );

    const gunStock =
      this.scene.add.rectangle(
        -4,
        6,
        8,
        7,
        0x8a613f,
      );

    const gun =
      this.scene.add.container(
        8,
        3,
        [
          gunBody,
          gunBarrel,
          gunStock,
        ],
      );

    gun.setVisible(
      player.role === "hunter",
    );

    container.add([
      shadow,
      hiderPixelBody,
      hunterPixelBody,
      head,
      body,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      gun,
      nameText,
    ]);

    container.setData(
      "network-gun",
      gun,
    );

    return container;
  }

  private createPaintLayer(
    container:
      Phaser.GameObjects.Container,
  ): PaintLayer {
    /*
     * ROOT FIX:
     * Paint is no longer an independent world-space GameObject.
     * It is a CHILD of the exact player container it paints.
     *
     * Therefore:
     *   player movement
     *   camera zoom
     *   network interpolation
     *   integer snapping
     * can never create a relative X/Y offset between body and paint.
     */
    const texture =
      this.scene.add.renderTexture(
        -40,
        -60,
        80,
        120,
      );

    texture
      .setOrigin(0, 0)
      .setScale(1);

    texture.texture.setFilter(
      Phaser.Textures.FilterMode.NEAREST,
    );

    texture.clear();

    /*
     * Insert paint above the body but keep the gun/name readable.
     */
    container.add(
      texture,
    );

    const gun =
      container.getData(
        "network-gun",
      ) as
        | Phaser.GameObjects.Container
        | undefined;

    const nameText =
      container.getByName(
        "network-player-name",
      ) as
        | Phaser.GameObjects.Text
        | null;

    if (gun) {
      container.bringToTop(
        gun,
      );
    }

    if (nameText) {
      container.bringToTop(
        nameText,
      );
    }

    /*
     * Kept only for PaintLayer compatibility / cleanup.
     * Pixel clipping is already performed by stampMaskedPaintBrush(),
     * so this shape is never used to position or clip the texture.
     */
    const maskShape =
      this.scene.add.graphics();

    maskShape
      .setVisible(false)
      .setAlpha(0);

    const mask =
      maskShape.createGeometryMask();

    return {
      texture,
      maskShape,
      mask,
    };
  }

  private resetWalkPoseImmediately(
    view: NetworkPlayerView,
  ): void {
    view.walkBlend = 0;

    if (
      multiplayerClient.getRoom()
        ?.state.phase === "hunt" &&
      view.role === "hider"
    ) {
      const snappedX =
        Math.round(view.container.x);
      const snappedY =
        Math.round(view.container.y);

      view.container.setPosition(
        snappedX,
        snappedY,
      );

      if (
        view.sessionId ===
        this.getEffectiveLocalSessionId()
      ) {
        this.localX = snappedX;
        this.localY = snappedY;
      }
    }

    view.container.setScale(
      1,
      1,
    );

    view.leftArm
      ?.setRotation(0)
      .setPosition(
        -12,
        6,
      );

    view.rightArm
      ?.setRotation(0)
      .setPosition(
        12,
        6,
      );

    view.leftLeg
      ?.setRotation(0)
      .setPosition(
        -5,
        22,
      );

    view.rightLeg
      ?.setRotation(0)
      .setPosition(
        5,
        22,
      );

    view.shadow?.setScale(
      1,
      1,
    );

    const gun =
      view.container.getData(
        "network-gun",
      ) as
        | Phaser.GameObjects.Container
        | undefined;

    gun?.setY(
      view.gunBaseY ?? 3,
    );

    this.syncPaintLayerPosition(
      view,
      true,
    );
  }

  private applyWalkMotion(
    view: NetworkPlayerView,
    moving: boolean,
    delta: number,
  ): void {
    if (view.customizationMode) {
      return;
    }

    const huntActive =
      multiplayerClient.getRoom()
        ?.state.phase === "hunt";

    /*
     * Hider paint is a single 80x120 raster layer.  Animating arms/legs
     * independently while the raster stays rigid makes the camouflage
     * visibly detach from the body.
     *
     * Hiders therefore move as one rigid painted character:
     * - container position still follows movement/network state
     * - head/body/arms/legs stay in their neutral pose
     * - paint layer receives exactly the same container transform
     *
     * Hunter animation remains unchanged.
     */
    if (view.role === "hider") {
      /*
       * Keep camouflage rigid while moving. The old squash/stretch of the
       * entire container looked like network shaking and could make painted
       * edges appear to wobble.
       */
      view.walkBlend =
        moving ? 1 : 0;

      view.container.setScale(
        1,
        1,
      );

      view.shadow?.setScale(
        1,
        1,
      );

      if (
        moving &&
        this.scene.time.now >=
          view.nextFootstepAt
      ) {
        view.nextFootstepAt =
          this.scene.time.now + 330;

        const isLocal =
          view.sessionId ===
          this.getEffectiveLocalSessionId();

        this.scene.sound.play(
          "footstep",
          {
            volume:
              isLocal
                ? 0.16
                : 0.055,
          },
        );
      }

      this.syncPaintLayerPosition(
        view,
        huntActive,
      );

      return;
    }

    const targetBlend =
      moving ? 1 : 0;

    view.walkBlend =
      Phaser.Math.Linear(
        view.walkBlend,
        targetBlend,
        moving ? 0.24 : 0.12,
      );

    if (
      moving &&
      view.walkBlend > 0.22 &&
      this.scene.time.now >=
        view.nextFootstepAt
    ) {
      view.nextFootstepAt =
        this.scene.time.now +
        (
          view.role === "hunter"
            ? 390
            : 330
        );

      /*
       * 여러 원격 플레이어가 멀리서 걸어도 소리가 과도하게 겹치지 않도록
       * 로컬 플레이어는 크게, 원격은 작게 재생합니다.
       */
      const isLocal =
        view.sessionId ===
        this.getEffectiveLocalSessionId();

      this.scene.sound.play(
        "footstep",
        {
          volume:
            isLocal
              ? 0.16
              : 0.055,
        },
      );
    }

    const leftArm =
      view.leftArm;
    const rightArm =
      view.rightArm;
    const leftLeg =
      view.leftLeg;
    const rightLeg =
      view.rightLeg;

    if (
      view.walkBlend < 0.01 &&
      !moving
    ) {
      view.walkBlend = 0;

      view.container.setScale(
        1,
        1,
      );

      [
        leftArm,
        rightArm,
        leftLeg,
        rightLeg,
      ].forEach(
        (part) => {
          part?.setRotation(0);
        },
      );

      leftArm?.setPosition(
        -13,
        6,
      );
      rightArm?.setPosition(
        13,
        6,
      );
      leftLeg?.setPosition(
        -5,
        23,
      );
      rightLeg?.setPosition(
        5,
        23,
      );

      view.shadow?.setScale(
        1,
        1,
      );

      const gun =
        view.container.getData(
          "network-gun",
        ) as
          | Phaser.GameObjects.Container
          | undefined;

      gun?.setY(
        view.gunBaseY ?? 3,
      );

      this.syncPaintLayerPosition(
        view,
      );

      return;
    }

    view.walkPhase +=
      delta *
      (
        view.role === "hunter"
          ? 0.0095
          : 0.0135
      );

    const step =
      Math.sin(
        view.walkPhase,
      );

    const oppositeStep =
      -step;

    const bounce =
      Math.abs(
        Math.sin(
          view.walkPhase * 2,
        ),
      );

    /*
     * 기존 통통 튀는 squash/stretch를 조금 강화합니다.
     */
    const scaleX =
      1 +
      bounce *
        0.065 *
        view.walkBlend;

    const scaleY =
      1 -
      bounce *
        0.050 *
        view.walkBlend;

    view.container.setScale(
      scaleX,
      scaleY,
    );

    /*
     * 사람 걸음처럼 반대 팔/다리가 함께 나갑니다.
     * Hider가 조금 더 경쾌하고 Hunter는 무겁게 흔들립니다.
     */
    const armSwing =
      (
        view.role === "hunter"
          ? 0.18
          : 0.24
      ) *
      view.walkBlend;

    const legSwing =
      (
        view.role === "hunter"
          ? 0.14
          : 0.20
      ) *
      view.walkBlend;

    leftArm
      ?.setRotation(
        step *
          armSwing,
      )
      .setY(
        6 -
          bounce *
            1.3 *
            view.walkBlend,
      );

    rightArm
      ?.setRotation(
        oppositeStep *
          armSwing,
      )
      .setY(
        6 -
          bounce *
            1.3 *
            view.walkBlend,
      );

    leftLeg
      ?.setRotation(
        oppositeStep *
          legSwing,
      )
      .setY(
        23 -
          Math.max(
            0,
            step,
          ) *
            2.4 *
            view.walkBlend,
      );

    rightLeg
      ?.setRotation(
        step *
          legSwing,
      )
      .setY(
        23 -
          Math.max(
            0,
            oppositeStep,
          ) *
            2.4 *
            view.walkBlend,
      );

    /*
     * 발이 바닥을 딛는 순간 그림자가 살짝 눌려 통통 뛰는 느낌을 강조.
     */
    view.shadow?.setScale(
      1 +
        bounce *
          0.09 *
          view.walkBlend,
      1 -
        bounce *
          0.08 *
          view.walkBlend,
    );

    const gun =
      view.container.getData(
        "network-gun",
      ) as
        | Phaser.GameObjects.Container
        | undefined;

    if (gun) {
      gun.setY(
        (view.gunBaseY ?? 3) -
          bounce *
            1.6 *
            view.walkBlend,
      );
    }

    /*
     * Paint texture는 기존과 동일하게 전체 몸의 squash/stretch를 따라갑니다.
     * 따라서 색칠 정보 자체는 유지됩니다.
     */
    this.syncPaintLayerPosition(
      view,
    );
  }

  private setViewPosition(
    view: NetworkPlayerView,
    x: number,
    y: number,
  ): void {
    /*
     * Player render position is always the supplied movement position.
     * Hunt no longer has a separate frozen coordinate system.
     *
     * The Paint RenderTexture is a child of the same player Container, so
     * moving this Container automatically moves camouflage with the body.
     */
    view.container.setPosition(
      x,
      y,
    );

    this.syncPaintLayerPosition(
      view,
    );
  }

  private syncPaintLayerPosition(
    view: NetworkPlayerView,
    _forcePixelSnap = false,
  ): void {
    if (!view.paintLayer) {
      return;
    }

    /*
     * Paint texture is a player-container child now.
     * NEVER convert world coordinates here.
     * Its correct position is permanently (-40, -60) in player-local space.
     */
    view.paintLayer.texture
      .setPosition(
        -40,
        -60,
      )
      .setScale(
        1,
        1,
      )
      .setVisible(
        view.customizationMode
          ? true
          : view.paintLayer.texture
              .visible,
      );

    /*
     * maskShape is no longer part of rendering; keep it detached and hidden.
     */
    view.paintLayer.maskShape
      .setVisible(false)
      .setScale(1);
  }

  private renderPaintTexture(
    texture:
      Phaser.GameObjects.RenderTexture,
  ): void {
    const dynamicTexture =
      texture as unknown as {
        render?: () => void;
      };

    dynamicTexture.render?.();
  }

  private getRoleColor(
    role: NetworkPlayerRole,
  ): number {
    return role === "hunter"
      ? 0x5f91c9
      : 0xf5eee2;
  }
}
