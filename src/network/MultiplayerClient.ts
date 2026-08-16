import { tr } from '../i18n';
import {
  Callbacks,
  Client,
  type Room,
} from "@colyseus/sdk";

export type NetworkPlayerRole =
  | "hunter"
  | "hider";

export type NetworkGamePhase =
  | "lobby"
  | "countdown"
  | "paint"
  | "hunt"
  | "finished";

export type NetworkBrushShape =
  | "dotCircle"
  | "circle"
  | "square";

export type NetworkPaintPoint = {
  x: number;
  y: number;
};

export type NetworkPaintStroke = {
  senderId?: string;
  targetSessionId: string;
  color: number;
  size: number;
  shape: NetworkBrushShape;
  points: NetworkPaintPoint[];
};

export type NetworkAvatarPreset = {
  sessionId: string;
  strokes: NetworkPaintStroke[];
};

export type AvatarPresetHandler = (
  preset: NetworkAvatarPreset,
) => void;

export type NetworkShotFired = {
  shooterId: string;
  startX: number;
  startY: number;
  pellets: Array<{
    endX: number;
    endY: number;
  }>;
  hitIds: string[];
  precisionReward: number;
  reserve: number;
  precisionPoints: number;
};

export type ShotFiredHandler = (
  shot: NetworkShotFired,
) => void;

export type NetworkHunterAim = {
  sessionId: string;
  angle: number;
  range: number;
};

export type HunterAimHandler = (
  aim: NetworkHunterAim,
) => void;

export type NetworkWeaponState = {
  heat: number;
  updatedAt: number;
  overheatedUntil: number;
  reserve: number;
  maxReserve: number;
  precisionPoints: number;
  shotsFired: number;
};

export type WeaponStateHandler = (
  state: NetworkWeaponState,
) => void;

export type ResetRoundHandler =
  () => void;

export type PlayerReconnectedHandler = (
  name: string,
) => void;

export type ConnectionDropHandler = (
  reason?: string,
) => void;

export type ConnectionRecoveredHandler =
  () => void;

export type NetworkRoundResult = {
  winner: "hunters" | "hiders";
  reason?:
    | "all_hiders_found"
    | "timeout"
    | "ammo_depleted";
  revealedHiders: Array<{
    sessionId: string;
    x: number;
    y: number;
  }>;
  durationMs: number;
};

export type RoundResultHandler = (
  result: NetworkRoundResult,
) => void;


export type NetworkPlayerState = {
  name: string;
  role: NetworkPlayerRole;
  hunterVolunteer: boolean;
  x: number;
  y: number;
  alive: boolean;
};

export type NetworkLobbySnapshot = {
  hostId: string;
  selectedMap?: string;
  activeMap?: string;
  paintDurationMs?: number;
  huntDurationMs?: number;
  phase?: NetworkGamePhase;
  phaseEndsAt?: number;
  serverNow?: number;
  paintReadyState?: PaintReadyState;
  players: Array<
    NetworkPlayerState & {
      sessionId: string;
    }
  >;
};

export type NetworkGameState = {
  gameName: string;
  roomTitle: string;
  isPrivate: boolean;
  phase: NetworkGamePhase;
  phaseEndsAt: number;
  hunterCount: number;
  winner: "hunters" | "hiders" | "";
  hostId: string;
  hunterId: string;
  selectedMap: string;
  activeMap: string;
  players: Map<string, NetworkPlayerState>;
};

export type PublicRoomInfo = {
  roomId: string;
  clients: number;
  maxClients: number;
  metadata?: {
    roomTitle?: string;
    isPrivate?: boolean;
    playerCount?: number;
    phase?: string;
  };
};

export type CreateRoomOptions = {
  playerName: string;
  roomTitle: string;
  isPrivate: boolean;
  password?: string;
};

export type JoinRoomOptions = {
  playerName: string;
  password?: string;
};

export type PlayerAddedHandler = (
  sessionId: string,
  player: NetworkPlayerState,
) => void;

export type PlayerRemovedHandler = (
  sessionId: string,
  player: NetworkPlayerState,
) => void;

export type PlayerChangedHandler = (
  sessionId: string,
  player: NetworkPlayerState,
) => void;

export type ConnectionChangedHandler = (
  connected: boolean,
) => void;

export type PaintStrokeHandler = (
  stroke: NetworkPaintStroke,
) => void;

export type PhaseChangedHandler = (
  phase: NetworkGamePhase,
  phaseEndsAt: number,
) => void;

export type StartGameErrorHandler = (
  message: string,
) => void;

export type HuntersOutOfAmmoHandler = (
  message: string,
) => void;

export type PlayerDisconnectedHandler = (
  payload: {
    sessionId: string;
    name: string;
  },
) => void;

export type RoundAbortedHandler = (
  message: string,
) => void;

export type PaintReadyState = {
  readySessionIds: string[];
  hiderCount: number;
  readyCount: number;
  allHidersReady: boolean;
};

export type PaintReadyStateHandler = (
  state: PaintReadyState,
) => void;

export class MultiplayerClient {
  private readonly client: Client;
  private readonly serverUrl: string;
  private room?: Room<NetworkGameState>;
  private callbacks?: any;

  /*
   * 최초 Schema snapshot이 브라우저/타이밍에 따라 누락되는 경우를 위한
   * plain-message 기반 Lobby fallback cache.
   */
  private readonly snapshotPlayers =
    new Map<
      string,
      NetworkPlayerState
    >();

  private snapshotHostId = "";
  private snapshotSelectedMap = "random";
  private snapshotActiveMap = "forest";
  private snapshotPaintDurationMs = 120_000;
  private snapshotHuntDurationMs = 80_000;

  /*
   * v0.10.10.73 MOBILE CRITICAL:
   * lobby_snapshot, Schema and phase_changed can all report the same phase.
   * Re-running enterLobbyPhase()/enterPaintPhase()/startHunt() for the same
   * phase is both expensive and destructive (READY gets reset).
   */
  private deliveredPhase:
    NetworkGamePhase | "" = "";

  private emitPhaseChanged(
    phase: NetworkGamePhase,
    phaseEndsAt: number,
  ): void {
    const normalizedEndsAt =
      Number.isFinite(phaseEndsAt)
        ? phaseEndsAt
        : 0;

    if (phase === this.deliveredPhase) {
return;
    }

    this.deliveredPhase = phase;
this.phaseChangedHandlers.forEach(
      (handler) => {
        handler(
          phase,
          normalizedEndsAt,
        );
      },
    );
  }

  /* Server epoch -> local epoch offset learned from phase_changed. */
  private serverClockOffsetMs = 0;
  private hasServerClockOffset = false;

  private localizeServerDeadline(
    deadline: number,
  ): number {
    if (!Number.isFinite(deadline) || deadline <= 0) {
      return 0;
    }

    return this.hasServerClockOffset
      ? deadline + this.serverClockOffsetMs
      : deadline;
  }

  /*
   * create()가 성공한 순간의 sessionId를 기억합니다.
   * 최초 Schema hostId가 아직 비어 있어도 생성자는 로컬에서 방장으로 취급합니다.
   */
  private createdRoomHostSessionId = "";

  private readonly playerAddedHandlers =
    new Set<PlayerAddedHandler>();

  private readonly playerRemovedHandlers =
    new Set<PlayerRemovedHandler>();

  private readonly playerChangedHandlers =
    new Set<PlayerChangedHandler>();

  private readonly connectionChangedHandlers =
    new Set<ConnectionChangedHandler>();

  private readonly paintStrokeHandlers =
    new Set<PaintStrokeHandler>();

  private readonly avatarPresetHandlers =
    new Set<AvatarPresetHandler>();

  private readonly shotFiredHandlers =
    new Set<ShotFiredHandler>();

  private readonly hunterAimHandlers =
    new Set<HunterAimHandler>();

  private readonly weaponStateHandlers =
    new Set<WeaponStateHandler>();

  private readonly resetRoundHandlers =
    new Set<ResetRoundHandler>();

  private readonly playerReconnectedHandlers =
    new Set<PlayerReconnectedHandler>();

  private readonly connectionDropHandlers =
    new Set<ConnectionDropHandler>();

  private readonly connectionRecoveredHandlers =
    new Set<ConnectionRecoveredHandler>();

  private roomHealthCleanup?: () => void;

  private lastRoomPingAt = 0;

  private connectionIssueNotified = false;

  private manualReconnectInFlight = false;

  private lastManualReconnectAt = 0;

  private connectionIssueStartedAt = 0;

  private lastJoinedRoomId = "";

  private lastJoinOptions?: JoinRoomOptions;

  private freshRejoinInFlight = false;

  private readonly roundResultHandlers =
    new Set<RoundResultHandler>();


  private readonly phaseChangedHandlers =
    new Set<PhaseChangedHandler>();

  private readonly startGameErrorHandlers =
    new Set<StartGameErrorHandler>();

  private readonly huntersOutOfAmmoHandlers =
    new Set<HuntersOutOfAmmoHandler>();

  private readonly playerDisconnectedHandlers =
    new Set<PlayerDisconnectedHandler>();

  private readonly roundAbortedHandlers =
    new Set<RoundAbortedHandler>();

  private readonly paintReadyStateHandlers =
    new Set<PaintReadyStateHandler>();

  private paintReadyState: PaintReadyState = {
    readySessionIds: [],
    hiderCount: 0,
    readyCount: 0,
    allHidersReady: false,
  };

  constructor() {
    this.serverUrl =
      import.meta.env
        .VITE_MULTIPLAYER_URL ??
      "http://localhost:2567";

    this.client =
      new Client(this.serverUrl);
  }

  async createRoom(
    options: CreateRoomOptions,
  ): Promise<
    Room<NetworkGameState>
  > {
    await this.disconnect();

    const room =
      await this.client.create<
        NetworkGameState
      >(
        "chameleon_hunt",
        {
          name:
            this.normalizeName(
              options.playerName,
            ),
          roomTitle:
            options.roomTitle
              .trim()
              .slice(0, 24),
          isPrivate:
            options.isPrivate,
          password:
            options.password ?? "",
        },
      );

    this.createdRoomHostSessionId =
      room.sessionId;


    /*
     * 서버 create가 성공한 뒤 attach/UI callback에서 오류가 나더라도
     * 네트워크 방 생성 성공 자체를 reject하지 않습니다.
     */
    try {
      this.attachRoom(room);
    } catch (error) {
      console.error(
        "[Chameleon Hunt] Room created but initial client attach had an error",
        error,
      );

      /*
       * attachRoom 시작 시 this.room은 이미 지정되므로 연결은 유지합니다.
       * GameScene의 self-heal/handshake가 UI를 다시 구성할 수 있습니다.
       */
      this.room = room;

      if (!this.callbacks) {
        try {
          this.callbacks =
            Callbacks.get(room as any);

          this.registerRoomCallbacks(
            room,
            this.callbacks,
          );
        } catch (
          callbackError
        ) {
          console.error(
            "[Chameleon Hunt] Callback registration recovery failed",
            callbackError,
          );
        }
      }

      try {
        this.emitConnectionChanged(
          true,
        );
      } catch (
        emitError
      ) {
        console.error(
          "[Chameleon Hunt] Connection notification recovery failed",
          emitError,
        );
      }
    }

    return room;
  }

  async joinRoomById(
    roomId: string,
    options: JoinRoomOptions,
  ): Promise<
    Room<NetworkGameState>
  > {
    this.lastJoinedRoomId =
      roomId.trim();

    this.lastJoinOptions = {
      playerName:
        options.playerName,
      password:
        options.password ?? "",
    };

    await this.disconnect();

    /*
     * v0.10.10.73 MOBILE CRITICAL:
     * Never cancel a legitimate mobile join after an arbitrary 5 seconds.
     * Let the Colyseus SDK own the connection lifecycle.
     */
    const room =
      await this.client.joinById<
        NetworkGameState
      >(
        roomId.trim(),
        {
          name:
            this.normalizeName(
              options.playerName,
            ),
          password:
            options.password ?? "",
          clientKey:
            this.getStableClientKey(),
        },
      );

    this.createdRoomHostSessionId =
      "";


    /*
     * joinById 서버 성공과 클라이언트 UI callback 성공을 분리합니다.
     */
    try {
      this.attachRoom(room);
    } catch (error) {
      console.error(
        "[Chameleon Hunt] Room joined but initial client attach had an error",
        error,
      );

      this.room = room;

      if (!this.callbacks) {
        try {
          this.callbacks =
            Callbacks.get(room as any);

          this.registerRoomCallbacks(
            room,
            this.callbacks,
          );
        } catch (
          callbackError
        ) {
          console.error(
            "[Chameleon Hunt] Join callback registration recovery failed",
            callbackError,
          );
        }
      }

      try {
        this.emitConnectionChanged(
          true,
        );
      } catch (
        emitError
      ) {
        console.error(
          "[Chameleon Hunt] Join connection notification recovery failed",
          emitError,
        );
      }
    }

    return room;
  }

  async listPublicRooms(): Promise<
    PublicRoomInfo[]
  > {
    const response = await fetch(
      `${this.serverUrl}/api/rooms`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Room list request failed: ${response.status}`,
      );
    }

    const payload =
      await response.json() as {
        rooms?: PublicRoomInfo[];
      };

    const rooms =
      payload.rooms ?? [];

    console.log(
      "[Chameleon Hunt] Public rooms from API",
      rooms,
    );

    return rooms;
  }

  private applyLobbySnapshot(
    snapshot:
      NetworkLobbySnapshot,
  ): void {
    this.snapshotHostId =
      String(
        snapshot.hostId ?? "",
      );

    this.snapshotSelectedMap =
      String(
        snapshot.selectedMap ??
        this.room?.state?.selectedMap ??
        "random",
      );

    this.snapshotActiveMap =
      String(
        snapshot.activeMap ??
        this.room?.state?.activeMap ??
        "forest",
      );

    const durationMs =
      Number(
        snapshot.paintDurationMs ??
        this.snapshotPaintDurationMs,
      );

    this.snapshotPaintDurationMs =
      [90_000, 120_000, 150_000]
        .includes(durationMs)
        ? durationMs
        : 120_000;

    const huntDurationMs =
      Number(
        snapshot.huntDurationMs ??
        this.snapshotHuntDurationMs,
      );

    this.snapshotHuntDurationMs =
      [80_000, 100_000, 120_000]
        .includes(huntDurationMs)
        ? huntDurationMs
        : 80_000;

    /*
     * v0.10.10.72:
     * lobby_snapshot is now an authoritative recovery snapshot for every
     * active phase, not just the Lobby UI. This heals a missed
     * phase_changed packet at Paint -> Hunt.
     */
    const snapshotPhase =
      snapshot.phase;

    if (
      snapshotPhase === "lobby" ||
      snapshotPhase === "countdown" ||
      snapshotPhase === "paint" ||
      snapshotPhase === "hunt" ||
      snapshotPhase === "finished"
    ) {
      const serverEndsAt =
        Number(snapshot.phaseEndsAt ?? 0);

      const serverNow =
        Number(snapshot.serverNow ?? 0);

      if (
        Number.isFinite(serverNow) &&
        serverNow > 0
      ) {
        this.serverClockOffsetMs =
          Date.now() - serverNow;
        this.hasServerClockOffset = true;
      }

      const localEndsAt =
        Number.isFinite(serverNow) &&
        serverNow > 0 &&
        Number.isFinite(serverEndsAt)
          ? Date.now() +
            Math.max(
              0,
              serverEndsAt - serverNow,
            )
          : this.localizeServerDeadline(
              serverEndsAt,
            );

      this.emitPhaseChanged(
        snapshotPhase,
        Number.isFinite(localEndsAt)
          ? localEndsAt
          : 0,
      );
    }

    if (snapshot.paintReadyState) {
      const readySessionIds =
        Array.isArray(
          snapshot.paintReadyState.readySessionIds,
        )
          ? snapshot.paintReadyState.readySessionIds.map(String)
          : [];

      const hiderCount =
        Number(
          snapshot.paintReadyState.hiderCount ?? 0,
        );

      const readyCount =
        Number(
          snapshot.paintReadyState.readyCount ??
          readySessionIds.length,
        );

      this.paintReadyState = {
        readySessionIds,
        hiderCount,
        readyCount,
        allHidersReady:
          Boolean(
            snapshot.paintReadyState.allHidersReady,
          ) ||
          (
            hiderCount > 0 &&
            readyCount >= hiderCount
          ),
      };

      this.paintReadyStateHandlers.forEach(
        (handler) => {
          handler(this.paintReadyState);
        },
      );
    }

    const incomingIds =
      new Set<string>();

    snapshot.players.forEach(
      (rawPlayer) => {
        const sessionId =
          String(
            rawPlayer.sessionId ??
            "",
          );

        if (!sessionId) {
          return;
        }

        incomingIds.add(
          sessionId,
        );

        const player:
          NetworkPlayerState = {
            name:
              String(
                rawPlayer.name ??
                "Player",
              ),
            role:
              rawPlayer.role ===
                "hunter"
                ? "hunter"
                : "hider",
            hunterVolunteer:
              Boolean(
                rawPlayer
                  .hunterVolunteer,
              ),
            x:
              Number(
                rawPlayer.x ?? 0,
              ),
            y:
              Number(
                rawPlayer.y ?? 0,
              ),
            alive:
              Boolean(
                rawPlayer.alive,
              ),
          };

        const existed =
          this.snapshotPlayers.has(
            sessionId,
          );

        this.snapshotPlayers.set(
          sessionId,
          player,
        );

        /*
         * GameScene/NetworkPlayerManager에는 Schema onAdd와 동일한 이벤트로 전달.
         * addPlayer()는 중복 sessionId를 update로 처리하므로 안전합니다.
         */
        this.playerAddedHandlers
          .forEach(
            (handler) => {
              try {
                handler(
                  sessionId,
                  player,
                );
              } catch (error) {
                console.error(
                  "[Chameleon Hunt] Lobby snapshot player handler failed",
                  {
                    sessionId,
                    error,
                  },
                );
              }
            },
          );

        if (existed) {
          this.playerChangedHandlers
            .forEach(
              (handler) => {
                try {
                  handler(
                    sessionId,
                    player,
                  );
                } catch (error) {
                  console.error(
                    "[Chameleon Hunt] Lobby snapshot change handler failed",
                    {
                      sessionId,
                      error,
                    },
                  );
                }
              },
            );
        }
      },
    );

    [...this.snapshotPlayers.keys()]
      .forEach(
        (sessionId) => {
          if (
            !incomingIds.has(
              sessionId,
            )
          ) {
            this.snapshotPlayers.delete(
              sessionId,
            );
          }
        },
      );
  }

  requestLobbySnapshot(): void {
    const room = this.room;

    if (!room) {
      return;
    }

    room.send(
      "request_lobby_snapshot",
      {},
    );
  }

  getPlayerCount(): number {
    const schemaCount =
      this.room?.state
        ?.players
        ?.size ?? 0;

    return Math.max(
      schemaCount,
      this.snapshotPlayers.size,
    );
  }

  getSnapshotPlayer(
    sessionId: string,
  ):
    | NetworkPlayerState
    | undefined {
    return this.snapshotPlayers.get(
      sessionId,
    );
  }

private async attemptFreshRejoin(
    sourceRoom: Room<NetworkGameState>,
  ): Promise<void> {
    if (
      this.room !== sourceRoom ||
      this.freshRejoinInFlight ||
      !this.lastJoinedRoomId ||
      !this.lastJoinOptions
    ) {
      return;
    }

    this.freshRejoinInFlight = true;

    try {
      const room =
        await this.client.joinById<
          NetworkGameState
        >(
          this.lastJoinedRoomId,
          {
            name:
              this.normalizeName(
                this.lastJoinOptions
                  .playerName,
              ),
            password:
              this.lastJoinOptions
                .password ?? "",
            clientKey:
              this.getStableClientKey(),
            reconnectFallback:
              true,
          },
        );

      if (this.room !== sourceRoom) {
        await room.leave();
        return;
      }

      /*
       * Server v0.10.10.78 transfers the old role/alive/position to this
       * replacement session. attachRoom() then replays the CURRENT phase,
       * including Finished/Lobby if the match ended while offline.
       */
      this.attachRoom(room);
      this.deliveredPhase = "";
      this.requestLobbySnapshot();
      this.requestPaintReadyState();

      try {
        await sourceRoom.leave();
      } catch {
        // The old half-open transport may already be dead.
      }

      this.clearConnectionIssue();
    } catch {
      // Keep retrying through the watchdog while network is available.
    } finally {
      this.freshRejoinInFlight = false;
    }
  }

  private async attemptManualReconnect(
    sourceRoom: Room<NetworkGameState>,
  ): Promise<void> {
    if (
      this.room !== sourceRoom ||
      this.manualReconnectInFlight
    ) {
      return;
    }

    const token =
      sourceRoom.reconnectionToken;

    if (!token) {
      return;
    }

    const now =
      Date.now();

    if (
      now -
        this.lastManualReconnectAt <
      350
    ) {
      return;
    }

    this.lastManualReconnectAt =
      now;
    this.manualReconnectInFlight =
      true;
    this.notifyConnectionIssue(
      "manual_reconnect",
    );

    try {
      const recoveredRoom =
        await this.client.reconnect<
          NetworkGameState
        >(token);

      if (
        this.room !== sourceRoom &&
        this.room !== undefined
      ) {
        await recoveredRoom
          .leave();
        return;
      }

      /*
       * The old Room instance is obsolete now. attachRoom() installs every
       * callback again and immediately replays the recovered Schema state.
       */
      this.attachRoom(
        recoveredRoom,
      );

      this.deliveredPhase = "";

      this.requestLobbySnapshot();
      this.requestPaintReadyState();

      globalThis.setTimeout(
        () => {
          if (
            this.room ===
              recoveredRoom
          ) {
            this.deliveredPhase =
              "";
            this.requestLobbySnapshot();
          }
        },
        120,
      );

      this.clearConnectionIssue();
    } catch {
      /*
       * If token recovery cannot complete quickly after a network handoff,
       * make a fresh connection using the same browser clientKey. The server
       * transfers the authoritative role/state from the old ghost session.
       */
      const issueFor =
        this.connectionIssueStartedAt > 0
          ? Date.now() -
            this.connectionIssueStartedAt
          : 0;

      if (
        issueFor >= 3200 &&
        (
          typeof navigator ===
            "undefined" ||
          navigator.onLine
        )
      ) {
        void this.attemptFreshRejoin(
          sourceRoom,
        );
      }
    } finally {
      this.manualReconnectInFlight =
        false;
    }
  }

  private notifyConnectionIssue(
    reason?: string,
  ): void {
    if (this.connectionIssueNotified) {
      return;
    }

    this.connectionIssueNotified = true;
    this.connectionIssueStartedAt =
      Date.now();

    this.connectionDropHandlers
      .forEach(
        (handler) => {
          handler(reason);
        },
      );
  }

  private clearConnectionIssue(): void {
    this.connectionIssueNotified = false;
    this.connectionIssueStartedAt = 0;
    this.lastRoomPingAt = Date.now();

    this.connectionRecoveredHandlers
      .forEach(
        (handler) => {
          handler();
        },
      );
  }

  private attachRoom(
    room: Room<NetworkGameState>,
  ): void {
    this.snapshotPlayers.clear();
    this.snapshotHostId = "";
    this.snapshotSelectedMap = "random";
    this.snapshotActiveMap = "forest";
    this.snapshotPaintDurationMs = 120_000;
    this.snapshotHuntDurationMs = 80_000;
    this.deliveredPhase = "";
this.room = room;

    /*
     * Mobile network handoffs can happen before Colyseus' default
     * 5000ms minUptime. Allow recovery after 500ms instead.
     */
    room.reconnection.minUptime = 250;
    room.reconnection.maxRetries = 60;
    room.reconnection.delay = 50;
    room.reconnection.minDelay = 50;
    room.reconnection.maxDelay = 350;
    room.reconnection.maxEnqueuedMessages = 40;
    room.reconnection.backoff =
      (
        attempt: number,
        _delay: number,
      ) =>
        Math.min(
          350,
          50 + attempt * 35,
        );

    this.roomHealthCleanup?.();

    this.lastRoomPingAt =
      Date.now();
    this.connectionIssueNotified =
      false;
this.manualReconnectInFlight = false;
    this.lastManualReconnectAt = 0;

    const handleBrowserOffline =
      (): void => {
        if (this.room !== room) {
          return;
        }

        this.notifyConnectionIssue(
          "browser_offline",
        );
      };

    const handleBrowserOnline =
      (): void => {
        if (this.room !== room) {
          return;
        }

        this.notifyConnectionIssue(
          "browser_online_recovering",
        );

        this.lastRoomPingAt =
          Math.min(
            this.lastRoomPingAt,
            Date.now() - 1400,
          );

        /*
         * Wi-Fi -> cellular often leaves the previous TCP connection in a
         * half-open state. Start a token-based reconnection immediately
         * instead of waiting for the browser socket timeout.
         */
        void this.attemptManualReconnect(
          room,
        );
      };

    globalThis.addEventListener?.(
      "offline",
      handleBrowserOffline,
    );

    globalThis.addEventListener?.(
      "online",
      handleBrowserOnline,
    );

    const healthTimer =
      globalThis.setInterval(
        () => {
          if (this.room !== room) {
            return;
          }

          const now =
            Date.now();

          /*
           * Skip aggressive watchdog work while a mobile browser tab is
           * backgrounded. Timers are throttled there and would create
           * false positives.
           */
          if (
            typeof document !==
              "undefined" &&
            document.hidden
          ) {
            return;
          }

          room.ping(
            () => {
              if (this.room !== room) {
                return;
              }

              const hadIssue =
                this.connectionIssueNotified;

              this.lastRoomPingAt =
                Date.now();

              if (
                hadIssue &&
                !room.reconnection
                  .isReconnecting
              ) {
                this.clearConnectionIssue();

                /*
                 * A network switch may recover the same socket without a
                 * formal onReconnect callback. Still refresh authoritative
                 * phase/READY state.
                 */
                this.requestLobbySnapshot();
                this.requestPaintReadyState();
              }
            },
          );

          const silentFor =
            now -
            this.lastRoomPingAt;

          const activeRound =
            this.deliveredPhase ===
              "countdown" ||
            this.deliveredPhase ===
              "paint" ||
            this.deliveredPhase ===
              "hunt";

          if (
            activeRound &&
            silentFor >= 1500
          ) {
            this.notifyConnectionIssue(
              "ping_timeout",
            );
          }

          /*
           * Wi-Fi -> cellular can leave the old TCP socket half-open.
           * Do NOT call leave(false) here: that can race the SDK's own Room
           * lifecycle and leave the game UI detached. Use the official
           * reconnection token as a manual fallback instead.
           */
          if (
            activeRound &&
            silentFor >= 1800 &&
            now -
              this.lastManualReconnectAt >=
              450
          ) {
            void this.attemptManualReconnect(
              room,
            );
          }

          if (
            activeRound &&
            this.connectionIssueStartedAt > 0 &&
            now -
              this.connectionIssueStartedAt >=
              4200 &&
            (
              typeof navigator ===
                "undefined" ||
              navigator.onLine
            )
          ) {
            void this.attemptFreshRejoin(
              room,
            );
          }
        },
        650,
      );

    this.roomHealthCleanup =
      () => {
        globalThis.clearInterval(
          healthTimer,
        );

        globalThis.removeEventListener?.(
          "offline",
          handleBrowserOffline,
        );

        globalThis.removeEventListener?.(
          "online",
          handleBrowserOnline,
        );
      };

    room.onDrop(
      (
        _code: number,
        reason?: string,
      ) => {
        if (this.room !== room) {
          return;
        }

        this.notifyConnectionIssue(
          reason,
        );

        globalThis.setTimeout(
          () => {
            if (
              this.room === room &&
              this.connectionIssueNotified
            ) {
              void this.attemptManualReconnect(
                room,
              );
            }
          },
          450,
        );
      },
    );

    room.onReconnect(
      () => {
        if (this.room !== room) {
          return;
        }

        /*
         * Force the authoritative server phase to be applied even when
         * reconnecting during the same phase.
         */
        this.deliveredPhase = "";

        this.requestLobbySnapshot();
        this.requestPaintReadyState();

        this.clearConnectionIssue();

        [80, 220, 650].forEach(
          (delay) => {
            globalThis.setTimeout(
              () => {
                if (
                  this.room === room
                ) {
                  this.deliveredPhase =
                    "";
                  this.requestLobbySnapshot();
                }
              },
              delay,
            );
          },
        );
      },
    );

    this.callbacks =
      Callbacks.get(room as any);

    this.registerRoomCallbacks(
      room,
      this.callbacks,
    );

    /*
     * IMPORTANT: create()/joinById()가 resolve될 때는 최초 Schema snapshot이
     * 이미 적용된 뒤일 수 있습니다. 그 뒤 callbacks.onAdd()를 등록하면
     * 첫 player add 이벤트를 놓치는 환경이 생기며, 이것이 "첫 접속만 멈춤,
     * 새로고침 후 두 번째는 정상" 증상의 핵심 원인이 될 수 있습니다.
     *
     * 따라서 callback 등록 직후 현재 snapshot을 명시적으로 replay합니다.
     * 이후 실시간 onAdd는 기존 callback이 계속 담당합니다.
     */
    room.state?.players?.forEach?.(
      (
        player: NetworkPlayerState,
        sessionId: string,
      ) => {
        this.playerAddedHandlers
          .forEach(
            (handler) => {
              try {
                handler(
                  sessionId,
                  player,
                );
              } catch (error) {
                console.error(
                  "[Chameleon Hunt] Initial player replay handler failed",
                  {
                    sessionId,
                    error,
                  },
                );
              }
            },
          );

        this.callbacks?.onChange(
          player,
          () => {
            this.playerChangedHandlers
              .forEach(
                (handler) => {
                  try {
                    handler(
                      sessionId,
                      player,
                    );
                  } catch (error) {
                    console.error(
                      "[Chameleon Hunt] Initial player change handler failed",
                      {
                        sessionId,
                        error,
                      },
                    );
                  }
                },
              );
          },
        );
      },
    );

    /*
     * 최초 phase 역시 onChange 등록 전에 snapshot으로 도착할 수 있으므로
     * 현재 값을 한 번 즉시 전달합니다.
     */
    try {
      this.emitPhaseChanged(
        room.state?.phase ??
          "lobby",
        this.localizeServerDeadline(
          Number(
            room.state
              ?.phaseEndsAt ?? 0,
          ),
        ),
      );
    } catch (error) {
      console.error(
        "[Chameleon Hunt] Initial phase replay handler failed",
        error,
      );
    }

    try {
      this.emitConnectionChanged(
        true,
      );
    } catch (error) {
      console.error(
        "[Chameleon Hunt] Connection handler failed after successful room attach",
        error,
      );
    }

    /*
     * onMessage 등록이 끝난 뒤 서버에 현재 Lobby 전체를 직접 요청합니다.
     * 최초 Schema 동기화를 놓쳤더라도 이 응답으로 반드시 복구됩니다.
     */
    /*
     * v0.10.10.77:
     * The initial Schema snapshot is already available when join resolves.
     * One explicit recovery snapshot is enough; remove the extra 350ms retry
     * from the hot join path.
     */
    this.requestLobbySnapshot();

    console.log(
      "[Chameleon Hunt] Connected",
      {
        roomId: room.roomId,
        sessionId:
          room.sessionId,
      },
    );
  }

  private registerRoomCallbacks(
    room: Room<NetworkGameState>,
    callbacks: any,
  ): void {
    callbacks.onAdd(
      "players",
      (
        player:
          NetworkPlayerState,
        sessionId: string,
      ) => {
        this.playerAddedHandlers
          .forEach(
            (handler) => {
              handler(
                sessionId,
                player,
              );
            },
          );

        callbacks.onChange(
          player,
          () => {
            this.playerChangedHandlers
              .forEach(
                (handler) => {
                  handler(
                    sessionId,
                    player,
                  );
                },
              );
          },
        );
      },
    );

    callbacks.onRemove(
      "players",
      (
        player:
          NetworkPlayerState,
        sessionId: string,
      ) => {
        this.playerRemovedHandlers
          .forEach(
            (handler) => {
              handler(
                sessionId,
                player,
              );
            },
          );
      },
    );

    room.onMessage<
      NetworkPaintStroke
    >(
      "paint_stroke",
      (stroke) => {
        this.paintStrokeHandlers
          .forEach(
            (handler) => {
              handler(stroke);
            },
          );
      },
    );

    room.onMessage<
      NetworkAvatarPreset
    >(
      "avatar_preset",
      (preset) => {
        this.avatarPresetHandlers
          .forEach(
            (handler) => {
              handler(preset);
            },
          );
      },
    );

    room.onMessage<{
      presets?: NetworkAvatarPreset[];
    }>(
      "avatar_presets",
      (payload) => {
        const presets =
          Array.isArray(payload?.presets)
            ? payload.presets
            : [];

        presets.forEach(
          (
            preset,
            index,
          ) => {
            /*
             * Spread large cosmetic reconstruction across frames.
             * Gameplay input stays responsive while avatars fill in.
             */
            globalThis.setTimeout(
              () => {
                if (this.room !== room) {
                  return;
                }

                this.avatarPresetHandlers
                  .forEach(
                    (handler) => {
                      handler(preset);
                    },
                  );
              },
              index * 120,
            );
          },
        );
      },
    );

    room.onMessage<
      NetworkLobbySnapshot
    >(
      "lobby_snapshot",
      (snapshot) => {
        this.applyLobbySnapshot(
          snapshot,
        );
      },
    );

    room.onMessage<{
      phase?: NetworkGamePhase;
      phaseEndsAt?: number;
      serverNow?: number;
    }>(
      "phase_changed",
      (payload) => {
        const phase =
          payload.phase;

        if (
          phase !== "lobby" &&
          phase !== "countdown" &&
          phase !== "paint" &&
          phase !== "hunt" &&
          phase !== "finished"
        ) {
          return;
        }

        const phaseEndsAt =
          Number(
            payload.phaseEndsAt ??
            0,
          );

        const serverNow =
          Number(
            payload.serverNow ??
            0,
          );

        /*
         * v0.10.10.68
         * Never compare another machine's epoch deadline directly with this
         * device clock. Convert the server deadline to an equivalent local
         * deadline from the remaining duration carried by the same packet.
         */
        if (
          Number.isFinite(serverNow) &&
          serverNow > 0
        ) {
          this.serverClockOffsetMs =
            Date.now() - serverNow;
          this.hasServerClockOffset = true;
        }

        const localPhaseEndsAt =
          Number.isFinite(serverNow) &&
          serverNow > 0 &&
          Number.isFinite(phaseEndsAt)
            ? Date.now() +
              Math.max(0, phaseEndsAt - serverNow)
            : this.localizeServerDeadline(phaseEndsAt);

        this.emitPhaseChanged(
          phase,
          Number.isFinite(
            localPhaseEndsAt,
          )
            ? localPhaseEndsAt
            : 0,
        );
      },
    );

    if (room.state) {
      callbacks.onChange(
        room.state,
        () => {
          this.emitPhaseChanged(
            room.state.phase,
            this.localizeServerDeadline(
              Number(
                room.state.phaseEndsAt ?? 0,
              ),
            ),
          );
        },
      );
    }

    room.onMessage<{
      message?: string;
    }>(
      "start_game_error",
      (payload) => {
        const message =
          payload.message ??
          tr('게임을 시작할 수 없습니다.');

        this.startGameErrorHandlers
          .forEach(
            (handler) => {
              handler(message);
            },
          );
      },
    );

    room.onMessage<{
      message?: string;
    }>(
      "hunters_out_of_ammo",
      (payload) => {
        const message =
          payload.message ??
          tr('헌터의 총알이 모두 떨어졌습니다!');

        this.huntersOutOfAmmoHandlers
          .forEach(
            (handler) => {
              handler(message);
            },
          );
      },
    );

    room.onMessage<{
      sessionId?: string;
      name?: string;
    }>(
      "player_disconnected",
      (payload) => {
        const normalized = {
          sessionId:
            String(
              payload.sessionId ??
                "",
            ),
          name:
            String(
              payload.name ??
                "Player",
            ),
        };

        this.playerDisconnectedHandlers
          .forEach(
            (handler) => {
              handler(normalized);
            },
          );
      },
    );

    room.onMessage<PaintReadyState>(
      "paint_ready_state",
      (payload) => {
        const readySessionIds =
          Array.isArray(payload?.readySessionIds)
            ? payload.readySessionIds.map(String)
            : [];

        const hiderCount = Number(
          payload?.hiderCount ??
          (payload as PaintReadyState & { total?: number })?.total ??
          0,
        );

        const readyCount = Number(
          payload?.readyCount ??
          (payload as PaintReadyState & { ready?: number })?.ready ??
          readySessionIds.length,
        );

        this.paintReadyState = {
          readySessionIds,
          hiderCount,
          readyCount,
          allHidersReady:
            payload?.allHidersReady ??
            (hiderCount > 0 && readyCount >= hiderCount),
        };

        this.paintReadyStateHandlers
          .forEach(
            (handler) => {
              handler(this.paintReadyState);
            },
          );
      },
    );

    room.onMessage<{
      message?: string;
    }>(
      "round_aborted",
      (payload) => {
        const message =
          payload.message ??
          tr('게임을 계속할 수 없어 대기실로 돌아갑니다.');

        this.roundAbortedHandlers
          .forEach(
            (handler) => {
              handler(message);
            },
          );
      },
    );

    room.onMessage<
      NetworkHunterAim
    >(
      "hunter_aim",
      (aim) => {
        this.hunterAimHandlers
          .forEach(
            (handler) => {
              handler(aim);
            },
          );
      },
    );

    room.onMessage<
      NetworkShotFired
    >(
      "shot_fired",
      (shot) => {
        this.shotFiredHandlers
          .forEach(
            (handler) => {
              handler(shot);
            },
          );
      },
    );

    room.onMessage<
      NetworkWeaponState
    >(
      "weapon_state",
      (state) => {
        this.weaponStateHandlers
          .forEach(
            (handler) => {
              handler(state);
            },
          );
      },
    );


    room.onMessage<
      NetworkRoundResult
    >(
      "round_result",
      (result) => {
        this.roundResultHandlers
          .forEach(
            (handler) => {
              handler(result);
            },
          );
      },
    );

    room.onMessage<{
      name?: string;
    }>(
      "player_reconnected",
      (payload) => {
        const name =
          String(payload?.name ?? "Player");

        this.playerReconnectedHandlers
          .forEach(
            (handler) => {
              handler(name);
            },
          );
      },
    );

    room.onMessage(
      "reset_round",
      () => {
        this.resetRoundHandlers
          .forEach(
            (handler) => {
              handler();
            },
          );
      },
    );

    room.onLeave(
      (
        code: number,
        reason?: string,
      ) => {
        console.log(
          "[Chameleon Hunt] Disconnected",
          {
            code,
            reason,
            roomId:
              room.roomId,
          },
        );

        /*
         * 이전 Room을 백그라운드로 leave한 뒤 그 onLeave가 늦게 와도
         * 이미 새 Room에 접속했다면 새 연결 상태를 절대 지우지 않습니다.
         */
        if (this.room !== room) {
          return;
        }

        this.room = undefined;
        this.callbacks =
          undefined;

        this.emitConnectionChanged(
          false,
        );
      },
    );

    room.onError(
      (
        code: number,
        message?: string,
      ) => {
        console.error(
          "[Chameleon Hunt] Room error",
          {
            code,
            message,
          },
        );
      },
    );
  }

  sendMove(
    x: number,
    y: number,
  ): void {
    if (
      !this.room ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return;
    }

    this.room.send(
      "move",
      {
        x,
        y,
      },
    );
  }

  sendHunterVolunteer(
    volunteer: boolean,
  ): void {
    this.room?.send(
      "hunter_volunteer",
      {
        volunteer,
      },
    );
  }

  sendHunterAim(
    angle: number,
  ): void {
    this.room?.send(
      "hunter_aim",
      {
        angle,
      },
    );
  }

  sendFireShot(
    angle: number,
  ): void {
    this.room?.send(
      "fire_shot",
      {
        angle,
      },
    );
  }

  sendMapSelection(
    map: string,
  ): void {
    this.room?.send(
      "select_map",
      {
        map,
      },
    );
  }

  sendPaintDurationSelection(
    durationMs: number,
  ): void {
    if (
      ![90_000, 120_000, 150_000]
        .includes(durationMs)
    ) {
      return;
    }

    this.room?.send(
      "select_paint_duration",
      { durationMs },
    );
  }

  getPaintDurationMs(): number {
    return this.snapshotPaintDurationMs;
  }

  sendHuntDurationSelection(
    durationMs: number,
  ): void {
    if (
      ![80_000, 100_000, 120_000]
        .includes(durationMs)
    ) {
      return;
    }

    this.room?.send(
      "select_hunt_duration",
      { durationMs },
    );
  }

  getHuntDurationMs(): number {
    return this.snapshotHuntDurationMs;
  }

  sendPaintReady(
    ready: boolean,
  ): void {
    this.room?.send(
      "paint_ready",
      { ready },
    );
  }

  requestPaintReadyState(): void {
    this.room?.send(
      "request_paint_ready_state",
      {},
    );
  }

  sendEarlyStartHunt(): void {
    this.room?.send(
      "early_start_hunt",
      {},
    );
  }

  getPaintReadyState(): PaintReadyState {
    return this.paintReadyState;
  }

  sendStartGame(): void {
    this.room?.send(
      "start_game",
      {},
    );
  }

  sendReturnToLobby(): void {
    this.room?.send(
      "return_to_lobby",
      {},
    );
  }


  getSelectedMap(): string {
    return (
      this.room?.state
        ?.selectedMap ??
      this.snapshotSelectedMap ??
      "random"
    );
  }

  getActiveMap(): string {
    return (
      this.room?.state
        ?.activeMap ??
      this.snapshotActiveMap ??
      "forest"
    );
  }

  onConnectionDrop(
    handler: ConnectionDropHandler,
  ): () => void {
    this.connectionDropHandlers.add(
      handler,
    );

    return () => {
      this.connectionDropHandlers.delete(
        handler,
      );
    };
  }

  onConnectionRecovered(
    handler: ConnectionRecoveredHandler,
  ): () => void {
    this.connectionRecoveredHandlers.add(
      handler,
    );

    return () => {
      this.connectionRecoveredHandlers.delete(
        handler,
      );
    };
  }

  onPlayerReconnected(
    handler: PlayerReconnectedHandler,
  ): () => void {
    this.playerReconnectedHandlers.add(
      handler,
    );

    return () => {
      this.playerReconnectedHandlers.delete(
        handler,
      );
    };
  }

  sendAvatarPreset(
    strokes: NetworkPaintStroke[],
  ): void {
    if (!this.room) {
      return;
    }

    this.room.send(
      "avatar_preset",
      {
        strokes,
      },
    );
  }

  requestAvatarPresets(): void {
    this.room?.send(
      "request_avatar_presets",
      {},
    );
  }

  sendPaintStroke(
    stroke: NetworkPaintStroke,
  ): void {
    if (
      !this.room ||
      stroke.points.length === 0
    ) {
      return;
    }

    this.room.send(
      "paint_stroke",
      {
        targetSessionId:
          stroke.targetSessionId,
        color: stroke.color,
        size: stroke.size,
        shape: stroke.shape,
        points: stroke.points,
      },
    );
  }

  isHost(): boolean {
    const room = this.room;

    if (!room) {
      return false;
    }

    const hostId =
      room.state?.hostId ||
      this.snapshotHostId ||
      this.createdRoomHostSessionId;

    return (
      hostId ===
      room.sessionId
    );
  }

  getPhase(): NetworkGamePhase {
    return (
      this.room?.state.phase ??
      "lobby"
    );
  }

  getPhaseEndsAt(): number {
    return this.localizeServerDeadline(
      Number(
        this.room?.state
          .phaseEndsAt ?? 0,
      ),
    );
  }

  getRoom():
    | Room<NetworkGameState>
    | undefined {
    return this.room;
  }

  getSessionId():
    | string
    | undefined {
    return this.room?.sessionId;
  }

  getRoomId():
    | string
    | undefined {
    return this.room?.roomId;
  }

  getLocalPlayer():
    | NetworkPlayerState
    | undefined {
    const room = this.room;

    if (!room) {
      return undefined;
    }

    /*
     * Colyseus 0.17 최초 JOIN_ROOM 직후에는 Room 객체가 먼저 생기고
     * Schema root의 `players` MapSchema가 한두 tick 뒤에 준비될 수 있습니다.
     *
     * 따라서 `room.state.players.get()`을 바로 호출하면
     * `Cannot read properties of undefined (reading 'get')`가 발생합니다.
     */
    const schemaPlayers =
      room.state?.players;

    const schemaPlayer =
      schemaPlayers?.get?.(
        room.sessionId,
      );

    return (
      schemaPlayer ??
      this.snapshotPlayers.get(
        room.sessionId,
      )
    );
  }

  isConnected(): boolean {
    return (
      this.room !== undefined
    );
  }

  onPlayerAdded(
    handler: PlayerAddedHandler,
  ): () => void {
    this.playerAddedHandlers
      .add(handler);

    return () => {
      this.playerAddedHandlers
        .delete(handler);
    };
  }

  onPlayerRemoved(
    handler:
      PlayerRemovedHandler,
  ): () => void {
    this.playerRemovedHandlers
      .add(handler);

    return () => {
      this.playerRemovedHandlers
        .delete(handler);
    };
  }

  onPlayerChanged(
    handler:
      PlayerChangedHandler,
  ): () => void {
    this.playerChangedHandlers
      .add(handler);

    return () => {
      this.playerChangedHandlers
        .delete(handler);
    };
  }

  onAvatarPreset(
    handler: AvatarPresetHandler,
  ): () => void {
    this.avatarPresetHandlers
      .add(handler);

    return () => {
      this.avatarPresetHandlers
        .delete(handler);
    };
  }

  onPaintStroke(
    handler: PaintStrokeHandler,
  ): () => void {
    this.paintStrokeHandlers
      .add(handler);

    return () => {
      this.paintStrokeHandlers
        .delete(handler);
    };
  }

  onWeaponState(
    handler: WeaponStateHandler,
  ): () => void {
    this.weaponStateHandlers.add(
      handler,
    );

    return () => {
      this.weaponStateHandlers.delete(
        handler,
      );
    };
  }


  onRoundResult(
    handler: RoundResultHandler,
  ): () => void {
    this.roundResultHandlers.add(
      handler,
    );

    return () => {
      this.roundResultHandlers.delete(
        handler,
      );
    };
  }

  onResetRound(
    handler: ResetRoundHandler,
  ): () => void {
    this.resetRoundHandlers.add(
      handler,
    );

    return () => {
      this.resetRoundHandlers.delete(
        handler,
      );
    };
  }

  onHunterAim(
    handler: HunterAimHandler,
  ): () => void {
    this.hunterAimHandlers.add(
      handler,
    );

    return () => {
      this.hunterAimHandlers.delete(
        handler,
      );
    };
  }

  onShotFired(
    handler: ShotFiredHandler,
  ): () => void {
    this.shotFiredHandlers.add(
      handler,
    );

    return () => {
      this.shotFiredHandlers.delete(
        handler,
      );
    };
  }

  onPhaseChanged(
    handler: PhaseChangedHandler,
  ): () => void {
    this.phaseChangedHandlers
      .add(handler);

    return () => {
      this.phaseChangedHandlers
        .delete(handler);
    };
  }

  onStartGameError(
    handler:
      StartGameErrorHandler,
  ): () => void {
    this.startGameErrorHandlers
      .add(handler);

    return () => {
      this.startGameErrorHandlers
        .delete(handler);
    };
  }

  onHuntersOutOfAmmo(
    handler:
      HuntersOutOfAmmoHandler,
  ): () => void {
    this.huntersOutOfAmmoHandlers
      .add(handler);

    return () => {
      this.huntersOutOfAmmoHandlers
        .delete(handler);
    };
  }

  onPlayerDisconnected(
    handler:
      PlayerDisconnectedHandler,
  ): () => void {
    this.playerDisconnectedHandlers
      .add(handler);

    return () => {
      this.playerDisconnectedHandlers
        .delete(handler);
    };
  }

  onPaintReadyState(
    handler:
      PaintReadyStateHandler,
  ): () => void {
    this.paintReadyStateHandlers
      .add(handler);

    return () => {
      this.paintReadyStateHandlers
        .delete(handler);
    };
  }

  onRoundAborted(
    handler:
      RoundAbortedHandler,
  ): () => void {
    this.roundAbortedHandlers
      .add(handler);

    return () => {
      this.roundAbortedHandlers
        .delete(handler);
    };
  }

  onConnectionChanged(
    handler:
      ConnectionChangedHandler,
  ): () => void {
    this.connectionChangedHandlers
      .add(handler);

    return () => {
      this.connectionChangedHandlers
        .delete(handler);
    };
  }

  async disconnect(): Promise<void> {
    const room = this.room;

    if (!room) {
      return;
    }

    /*
     * UI/새 join을 WebSocket close handshake가 끝날 때까지 막지 않습니다.
     * 기존 room 참조를 먼저 끊고 leave는 백그라운드로 정리합니다.
     */
    this.roomHealthCleanup?.();
    this.roomHealthCleanup =
      undefined;

    this.room = undefined;
    this.callbacks = undefined;
    this.snapshotPlayers.clear();
    this.snapshotHostId = "";
    this.createdRoomHostSessionId = "";

    this.emitConnectionChanged(
      false,
    );

    void room.leave().catch(
      (error) => {
        console.warn(
          "[Chameleon Hunt] Previous room leave cleanup failed",
          error,
        );
      },
    );
  }

  private getStableClientKey(): string {
    const storageKey =
      "chameleon-hunt-client-key";

    try {
      const existing =
        localStorage.getItem(
          storageKey,
        );

      if (existing) {
        return existing;
      }

      const created =
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID ===
          "function"
          ? crypto.randomUUID()
          : `client-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`;

      localStorage.setItem(
        storageKey,
        created,
      );

      return created;
    } catch {
      return `session-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
    }
  }

  private normalizeName(
    name: string,
  ): string {
    return (
      name.trim().slice(0, 16) ||
      "Player"
    );
  }

  private emitConnectionChanged(
    connected: boolean,
  ): void {
    this.connectionChangedHandlers
      .forEach(
        (handler) => {
          handler(connected);
        },
      );
  }
}

export const multiplayerClient =
  new MultiplayerClient();
