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
  leftArm?: Phaser.GameObjects.Rectangle;
  rightArm?: Phaser.GameObjects.Rectangle;
  leftLeg?: Phaser.GameObjects.Rectangle;
  rightLeg?: Phaser.GameObjects.Rectangle;
  shadow?: Phaser.GameObjects.Ellipse;
  gunBaseY?: number;
};

export class NetworkPlayerManager {
  private readonly scene: Phaser.Scene;
  private readonly gameWidth: number;
  private readonly gameHeight: number;

  private readonly players =
    new Map<string, NetworkPlayerView>();


  private localX = 480;
  private localY = 270;

  /*
   * 로컬 캐릭터가 현재 화면에 보이는 위치에서
   * 실제 이동을 시작했는지 여부입니다.
   * 첫 이동 전에 서버 좌표와 렌더 좌표가 조금 달라도
   * WASD 입력 순간 점프하지 않게 합니다.
   */
  private localMovementInitialized = false;

  private readonly hiderMoveSpeed = 180;
  private readonly hunterMoveSpeed = 125;
  private readonly sendInterval = 50;
  private lastSendTime = 0;

  /*
   * 로컬 이동 중 서버 echo 좌표가 local prediction을 매 packet마다
   * 되감지 않도록 입력 직후 짧은 reconciliation grace를 둡니다.
   */
  private lastLocalMoveInputAt = 0;
  private readonly localMoveReconcileGraceMs = 180;
  private readonly localHardCorrectionDistance = 32;

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
    this.players.forEach((view) => {
      view.container.destroy(true);
      view.aimGraphics?.destroy();
      view.revealMarker?.destroy();
      view.paintLayer?.texture.destroy();
      view.paintLayer?.maskShape.destroy();
    });

    this.players.clear();
    this.localMovementInitialized = false;
    this.localX = 480;
    this.localY = 270;
    this.lastLocalMoveInputAt = 0;
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
      multiplayerClient.getSessionId();

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
           *   -> '플레이어 연결 중...' 무한
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

        view.targetX = player.x;
        view.targetY = player.y;

        this.setViewPosition(
          view,
          player.x,
          player.y,
        );

        if (
          sessionId ===
          multiplayerClient.getSessionId()
        ) {
          this.localX = player.x;
          this.localY = player.y;
          this.localMovementInitialized = true;
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
      multiplayerClient.getSessionId();

    const container = this.createPlayerContainer(
      player,
      isLocal,
    );

    container.setPosition(
      player.x,
      player.y,
    );

    const nameText =
      container.getByName(
        "network-player-name",
      ) as Phaser.GameObjects.Text;

    const paintLayer =
      this.createPaintLayer(
        player.x,
        player.y,
      );

    paintLayer.texture.setDepth(
      player.role === "hunter"
        ? 162
        : 122,
    );

    this.players.set(sessionId, {
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
          .setDepth(170)
          .setVisible(false),
      revealMarker: undefined,
      targetX: player.x,
      targetY: player.y,
      spawnSynced: true,
      paintLayer,
      walkPhase: 0,
      walkBlend: 0,
      movingUntil: 0,
      nextFootstepAt: 0,
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
       * 생성 직후 서버 좌표를 컨테이너와 페인트 레이어에
       * 즉시 동일하게 적용합니다.
       */
      createdView.targetX = player.x;
      createdView.targetY = player.y;

      this.setViewPosition(
        createdView,
        player.x,
        player.y,
      );
    }

    if (isLocal) {
      /*
       * 화면에 보이는 초기 위치와 이동 기준을 서버 spawn 좌표로 통일합니다.
       */
      this.localX = player.x;
      this.localY = player.y;
      this.localMovementInitialized = true;
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
      multiplayerClient.getSessionId();

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

    /*
     * Lobby에서는 서버 spawn 좌표가 화면 표시의 유일한 기준입니다.
     * 다른 참가자도 첫 WASD 입력 전부터 정확한 서버 좌표에 표시합니다.
     */
    const roomPhase =
      multiplayerClient.getRoom()
        ?.state?.phase;

    if (
      roomPhase === "lobby" &&
      !view.customizationMode
    ) {
      /*
       * Lobby에서는 렌더 좌표, target 좌표, 이동 기준 좌표를
       * 모두 서버 좌표 하나로 고정합니다.
       */
      view.targetX = player.x;
      view.targetY = player.y;

      this.setViewPosition(
        view,
        player.x,
        player.y,
      );

      if (
        sessionId ===
        multiplayerClient.getSessionId()
      ) {
        this.localX = player.x;
        this.localY = player.y;
        this.localMovementInitialized = true;
      }

      view.spawnSynced = true;
    }

    if (view.role !== player.role) {
      view.role = player.role;

      if (
        sessionId ===
        multiplayerClient.getSessionId()
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

      view.paintLayer?.texture.setDepth(
        player.role === "hunter"
          ? 162
          : 122,
      );

      view.aimGraphics?.setDepth(
        player.role === "hunter"
          ? 170
          : 118,
      );

      view.gun?.setVisible(
        player.role === "hunter",
      );

      view.nameText.setText(
        `${player.name}\n${player.role.toUpperCase()}`,
      );
    }

    view.nameText.setText(
      `${player.name}\n${player.role.toUpperCase()}`,
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
          ? `${player.name}\n${player.role.toUpperCase()}`
          : `${player.name}\nFOUND!`,
      );

      if (!player.alive) {
        this.scene.tweens.add({
          targets: [
            view.container,
            view.paintLayer?.texture,
          ].filter(Boolean),
          scale: 1.18,
          duration: 130,
          yoyo: true,
          repeat: 1,
        });
      }
    }

    if (
      sessionId ===
      multiplayerClient.getSessionId() &&
      !view.customizationMode
    ) {
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
        correctionDistance >=
        this.localHardCorrectionDistance
      ) {
        this.localX = player.x;
        this.localY = player.y;

        this.setViewPosition(
          view,
          player.x,
          player.y,
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

    this.players.delete(sessionId);
  }

  moveLocalPlayer(
    directionX: number,
    directionY: number,
    delta: number,
  ): void {
    const sessionId =
      multiplayerClient.getSessionId();

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
      return;
    }

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

    direction.normalize();

    const speed =
      view.role === "hunter"
        ? this.hunterMoveSpeed
        : this.hiderMoveSpeed;

    const distance =
      speed * (delta / 1000);

    this.localX = Phaser.Math.Clamp(
      this.localX +
        direction.x * distance,
      24,
      this.gameWidth - 24,
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

      multiplayerClient.sendMove(
        this.localX,
        this.localY,
      );
    }
  }

  update(delta = 16): void {
    const localSessionId =
      multiplayerClient.getSessionId();

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
              this.scene.time.now + 140;
          }

          this.setViewPosition(
            view,
            view.targetX,
            view.targetY,
          );

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

        const x = Phaser.Math.Linear(
          view.container.x,
          view.targetX,
          0.22,
        );

        const y = Phaser.Math.Linear(
          view.container.y,
          view.targetY,
          0.22,
        );

        this.setViewPosition(view, x, y);

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
      multiplayerClient.getSessionId();

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
      multiplayerClient.getSessionId();

    if (!sessionId) {
      return null;
    }

    return (
      this.players.get(sessionId)
        ?.role ?? null
    );
  }

  canLocalControlHunter(): boolean {
    return (
      this.getLocalRole() ===
        "hunter" &&
      multiplayerClient.getLocalPlayer()
        ?.role === "hunter"
    );
  }

  getLocalPlayerContainer():
    | Phaser.GameObjects.Container
    | null {
    const sessionId =
      multiplayerClient.getSessionId();

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
      multiplayerClient.getSessionId();

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

  getLocalPlayerPosition():
    | Phaser.Math.Vector2
    | null {
    const sessionId =
      multiplayerClient.getSessionId();

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
    return (
      multiplayerClient.getLocalPlayer()
        ?.role === "hider"
    );
  }

  getLocalPlayerVisualScale(): number {
    const sessionId =
      multiplayerClient.getSessionId();

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

  paintLocalPlayer(
    worldX: number,
    worldY: number,
    brushTextureKey: string,
  ): NetworkPaintPoint | null {
    const sessionId =
      multiplayerClient.getSessionId();

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
    const paintBodyMinX = -20;
    const paintBodyMaxX = 20;
    const paintBodyMinY = -28;
    const paintBodyMaxY = 34;

    if (
      localX < paintBodyMinX ||
      localX > paintBodyMaxX ||
      localY < paintBodyMinY ||
      localY > paintBodyMaxY
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

    view.paintLayer.texture.stamp(
      brushTextureKey,
      undefined,
      textureX,
      textureY,
      {
        originX: 0.5,
        originY: 0.5,
      },
    );

    this.renderPaintTexture(
      view.paintLayer.texture,
    );

    return {
      x: textureX,
      y: textureY,
    };
  }

  applyPaintStroke(
    stroke: NetworkPaintStroke,
    textureKey: string,
  ): void {
    const view =
      this.players.get(
        stroke.targetSessionId,
      );

    if (
      !view ||
      !view.paintLayer
    ) {
      return;
    }

    stroke.points.forEach((point) => {
      const pixelX =
        Math.round(point.x);
      const pixelY =
        Math.round(point.y);

      /*
       * Network stroke도 80x120 paint texture 안의 캐릭터 주변 영역으로 제한.
       * localX = pixelX - 40 / localY = pixelY - 60 기준입니다.
       */
      if (
        pixelX < 20 ||
        pixelX > 60 ||
        pixelY < 32 ||
        pixelY > 94
      ) {
        return;
      }

      view.paintLayer!.texture.stamp(
        textureKey,
        undefined,
        pixelX,
        pixelY,
        {
          originX: 0.5,
          originY: 0.5,
        },
      );
    });

    this.renderPaintTexture(
      view.paintLayer.texture,
    );
  }

  setLocalHunterCustomizationMode(
    enabled: boolean,
  ): void {
    const sessionId =
      multiplayerClient.getSessionId();

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
      multiplayerClient.getSessionId();

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
      multiplayerClient.getSessionId();

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
      multiplayerClient.getSessionId();

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

  normalizeLocalPlayerForGameplay(): void {
    const sessionId =
      multiplayerClient.getSessionId();

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
      multiplayerClient.getSessionId();

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

  private createPlayerContainer(
    player: NetworkPlayerState,
    isLocal: boolean,
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
        );

    const color =
      this.getRoleColor(player.role);

    const head =
      this.scene.add.circle(
        0,
        -12,
        12,
        color,
      );

    const body =
      this.scene.add.rectangle(
        0,
        7,
        18,
        24,
        color,
      );

    const leftArm =
      this.scene.add.rectangle(
        -13,
        6,
        7,
        18,
        color,
      )
        .setName(
          "network-left-arm",
        );

    const rightArm =
      this.scene.add.rectangle(
        13,
        6,
        7,
        18,
        color,
      )
        .setName(
          "network-right-arm",
        );

    const leftLeg =
      this.scene.add.rectangle(
        -5,
        23,
        7,
        13,
        color,
      )
        .setName(
          "network-left-leg",
        );

    const rightLeg =
      this.scene.add.rectangle(
        5,
        23,
        7,
        13,
        color,
      )
        .setName(
          "network-right-leg",
        );

    /*
     * 캐릭터 외곽선 제거.
     *
     * 기존 2px stroke는 실제 paint mask 밖까지 보이는 영역을 만들었기 때문에
     * 사용자는 외곽선 위에 브러시가 닿았다고 느끼는데 paint는 적용되지 않는
     * 시각/판정 차이가 있었습니다.
     *
     * 이제 실제 몸체 fill 영역 = 색칠 가능한 실루엣입니다.
     */

    if (player.role === "hunter") {
      const hat =
        this.scene.add.rectangle(
          0,
          -24,
          26,
          7,
          0x4675a8,
        );

      const brim =
        this.scene.add.rectangle(
          6,
          -20,
          23,
          5,
          0x355f8c,
        );

      container.add([hat, brim]);
    }

    const nameText = this.scene.add
      .text(
        0,
        -39,
        `${player.name}\n${player.role.toUpperCase()}`,
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
    centerX: number,
    centerY: number,
  ): PaintLayer {
    const texture =
      this.scene.add.renderTexture(
        centerX - 40,
        centerY - 60,
        80,
        120,
      );

    texture.setOrigin(0, 0);
    texture.setDepth(122);

    texture.texture.setFilter(
      Phaser.Textures.FilterMode.NEAREST,
    );

    texture.clear();

    const maskShape =
      this.scene.add.graphics();

    maskShape.fillStyle(0xffffff, 1);

    /*
     * visible character와 paint mask가 같은 치수를 사용하도록 통일.
     *
     * 캐릭터 local origin:
     *   texture origin = (-40, -60)
     *
     * visible geometry:
     *   head      circle(0, -12, 12)
     *   body      rect(0, 7, 18, 24)
     *   leftArm   rect(-13, 6, 7, 18)
     *   rightArm  rect(13, 6, 7, 18)
     *   leftLeg   rect(-5, 23, 7, 13)
     *   rightLeg  rect(5, 23, 7, 13)
     *
     * 이전 mask의 팔/다리는 8px/14px로 실제 7px/13px 몸체와 달랐습니다.
     */

    // head: exact visible circle
    maskShape.fillCircle(
      40,
      48,
      12,
    );

    // body: x[-9,9], y[-5,19]
    maskShape.fillRect(
      31,
      55,
      18,
      24,
    );

    // arms: exact width 7 / height 18
    maskShape.fillRect(
      23.5,
      57,
      7,
      18,
    );

    maskShape.fillRect(
      49.5,
      57,
      7,
      18,
    );

    // legs: exact width 7 / height 13
    maskShape.fillRect(
      31.5,
      76.5,
      7,
      13,
    );

    maskShape.fillRect(
      41.5,
      76.5,
      7,
      13,
    );

    maskShape.setPosition(
      centerX - 40,
      centerY - 60,
    );

    maskShape.setVisible(true);
    maskShape.setAlpha(0.001);
    maskShape.setDepth(-10);

    const mask =
      maskShape.createGeometryMask();

    texture.setMask(mask);

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

    view.container.setScale(
      1,
      1,
    );

    view.leftArm
      ?.setRotation(0)
      .setPosition(
        -13,
        6,
      );

    view.rightArm
      ?.setRotation(0)
      .setPosition(
        13,
        6,
      );

    view.leftLeg
      ?.setRotation(0)
      .setPosition(
        -5,
        23,
      );

    view.rightLeg
      ?.setRotation(0)
      .setPosition(
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
     * 사냥 중 숨어서 멈춰 있는 Hider는 walkBlend를 천천히 감쇠시키지 않습니다.
     * 즉시 완전한 정지 pose로 고정해 Hunter 카메라가 움직일 때
     * 미세한 squash/stretch가 위장 위치를 드러내는 문제를 막습니다.
     */
    if (
      huntActive &&
      view.role === "hider" &&
      !moving
    ) {
      this.resetWalkPoseImmediately(
        view,
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
        multiplayerClient.getSessionId();

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
    view.container.setPosition(x, y);
    this.syncPaintLayerPosition(view);
  }

  private syncPaintLayerPosition(
    view: NetworkPlayerView,
    forcePixelSnap = false,
  ): void {
    if (!view.paintLayer) {
      return;
    }

    const scaleX =
      view.container.scaleX || 1;

    const scaleY =
      view.container.scaleY || 1;

    const huntActive =
      multiplayerClient.getRoom()
        ?.state.phase === "hunt";

    const shouldPixelSnap =
      forcePixelSnap ||
      (
        huntActive &&
        view.role === "hider" &&
        view.walkBlend <= 0.001
      );

    const rawPaintX =
      view.container.x -
      40 * scaleX;

    const rawPaintY =
      view.container.y -
      60 * scaleY;

    /*
     * 숨은 Hider의 paint texture와 mask를 동일한 정수 픽셀 좌표에 고정합니다.
     * 카메라 이동 시 texture/mask가 서로 다른 sub-pixel에서 샘플링되어
     * 가장자리가 일렁이는 현상을 줄입니다.
     */
    const paintX =
      shouldPixelSnap
        ? Math.round(rawPaintX)
        : rawPaintX;

    const paintY =
      shouldPixelSnap
        ? Math.round(rawPaintY)
        : rawPaintY;

    view.paintLayer.texture
      .setDepth(
        view.customizationMode
          ? 921
          : view.role === "hunter"
              ? 162
              : 122,
      )
      .setVisible(
        view.customizationMode
          ? true
          : view.paintLayer.texture.visible,
      )
      .setPosition(
        paintX,
        paintY,
      )
      .setScale(
        scaleX,
        scaleY,
      );

    view.paintLayer.maskShape
      .setPosition(
        paintX,
        paintY,
      )
      .setScale(
        scaleX,
        scaleY,
      );
  }

  private isInsideHiderShape(
    x: number,
    y: number,
  ): boolean {
    const inHead =
      x * x +
        (y + 12) * (y + 12) <=
      12 * 12;

    const inBody =
      x >= -9 &&
      x <= 9 &&
      y >= -5 &&
      y <= 19;

    const inLeftArm =
      x >= -16.5 &&
      x <= -9.5 &&
      y >= -3 &&
      y <= 15;

    const inRightArm =
      x >= 9.5 &&
      x <= 16.5 &&
      y >= -3 &&
      y <= 15;

    const inLeftLeg =
      x >= -8.5 &&
      x <= -1.5 &&
      y >= 16.5 &&
      y <= 29.5;

    const inRightLeg =
      x >= 1.5 &&
      x <= 8.5 &&
      y >= 16.5 &&
      y <= 29.5;

    return (
      inHead ||
      inBody ||
      inLeftArm ||
      inRightArm ||
      inLeftLeg ||
      inRightLeg
    );
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
