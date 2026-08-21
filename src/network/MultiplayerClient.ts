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

export type AvatarPresetBatchHandler = (
  count: number,
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

/* V1010242_HUNTER_FART_SKILL */
/* V1010307_CLIENT_FOLD_WAITING_AUTHORITATIVE_GAS */
export type NetworkFartState = {
  gauge: number;
  poopUntil: number;
  serverNow: number;
  radius: number;

  /*
   * V1010307_CLIENT_FOLD_WAITING_AUTHORITATIVE_GAS: exact destination of the current accident animation.
   * 36 -> first accident, 72 -> second, 100 -> third/locked.
   */
  targetGauge?: number;
  accidentCount?: number;
  locked?: boolean;
};
export type NetworkFartBurst = {
  hunterId: string; x: number; y: number; radius: number; soundTier: number;
};
export type NetworkPoopBurst = {
  hunterId: string;
  hunterName?: string;
  x: number;
  y: number;
  poopUntil: number;
  serverNow: number;
  detected?: boolean;
  /* V1010266_AUTHORITATIVE_POOP_COMBO_FOLLOW */
  /* V1010247_FART_ULTIMATE_BALANCE */

  targetGauge?: number;
  accidentCount?: number;
  locked?: boolean;
};
export type NetworkHiderReaction = {
  hunterId: string; hiderId: string; x: number; y: number;
};
export type FartStateHandler = (state: NetworkFartState) => void;
export type FartBurstHandler = (event: NetworkFartBurst) => void;
export type PoopBurstHandler = (event: NetworkPoopBurst) => void;
export type HiderReactionHandler = (event: NetworkHiderReaction) => void;
export type FartDetectedHandler = (reaction: 'cough' | 'laugh') => void;

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

export type RoundPaintStateHandler = (
  strokes: NetworkPaintStroke[],
) => void;

export type ReconnectedPlayerPaintHandler = (
  strokes: NetworkPaintStroke[],
) => void;

export type NetworkChatMessage = {
  id: string;
  sessionId: string;
  name: string;
  text: string;
  sentAt: number;
};

export type ChatMessageHandler = (
  message: NetworkChatMessage,
) => void;

export type ChatHistoryHandler = (
  messages: NetworkChatMessage[],
) => void;

export type ChatErrorHandler = (
  message: string,
) => void;

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
  lobbyReadyState?: LobbyReadyState;
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
    selectedMap?: string;
    activeMap?: string;
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

export type LobbyReadyState = {
  readySessionIds: string[];
  readyCount: number;
  totalCount: number;
  allReady: boolean;
  canStart: boolean;
  livePlayerCount: number;
  hasDisconnectedPlayers: boolean;
};

export type LobbyReadyStateHandler = (
  state: LobbyReadyState,
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
  /* V1010371_LOBBY_READY_BARRIER: authoritative lobby READY state and host handoff UI support. */
  /* V1010345_CONNECTION_STABILITY_HARDENING: same-session recovery wins; fresh handoff is final fallback. */
  /* V1010341_CLIENT_GAMEPLAY_STABILITY_SAFE: reconnect/background/tab stability. */
  /* V1010340C_MULTIPLAYER_TRANSPORT_HARDENING_FINAL: aim traffic and hidden-tab movement hardening. */
  /*
   * V1010340C_MULTIPLAYER_TRANSPORT_HARDENING_FINAL / AIM_TRANSPORT
   */
  private lastHunterAimSentAt = 0;
  private lastHunterAimSentAngle =
    Number.NaN;
  /*
   * V1010237_BACKGROUND_RESUME_POLICY
   * Hidden/minimized is NOT a leave signal.
   * Never close/recreate the room merely because document.hidden, blur,
   * pagehide, or visibilitychange fired. Transport close/error remains the
   * authority for reconnect; the server now preserves the same session for
   * five minutes.
   */
private client: Client;
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

  /* V1010295_ALL_PHASE_RECONNECT: every room phase is reconnect-safe. */

  private lastStablePhase:
    NetworkGamePhase = "lobby";

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
    this.lastStablePhase = phase;

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

  private readonly avatarPresetBatchStartHandlers =
    new Set<AvatarPresetBatchHandler>();

  private readonly avatarPresetBatchEndHandlers =
    new Set<AvatarPresetBatchHandler>();

  private readonly shotFiredHandlers =
    new Set<ShotFiredHandler>();

  private readonly hunterAimHandlers =
    new Set<HunterAimHandler>();

  private readonly weaponStateHandlers =
    new Set<WeaponStateHandler>();

  private readonly fartStateHandlers = new Set<FartStateHandler>();
  private readonly fartBurstHandlers = new Set<FartBurstHandler>();
  private readonly poopBurstHandlers = new Set<PoopBurstHandler>();
  private readonly hiderCoughHandlers = new Set<HiderReactionHandler>();
  private readonly hiderLaughHandlers = new Set<HiderReactionHandler>();
  private readonly fartDetectedHandlers = new Set<FartDetectedHandler>();

  private readonly resetRoundHandlers =
    new Set<ResetRoundHandler>();

  private readonly playerReconnectedHandlers =
    new Set<PlayerReconnectedHandler>();

  private readonly connectionDropHandlers =
    new Set<ConnectionDropHandler>();

  private readonly connectionRecoveredHandlers =
    new Set<ConnectionRecoveredHandler>();

  private readonly roundPaintStateHandlers =
    new Set<RoundPaintStateHandler>();

  private readonly reconnectedPlayerPaintHandlers =
    new Set<ReconnectedPlayerPaintHandler>();

  private readonly chatMessageHandlers =
    new Set<ChatMessageHandler>();

  private readonly chatHistoryHandlers =
    new Set<ChatHistoryHandler>();

  private readonly chatErrorHandlers =
    new Set<ChatErrorHandler>();

  private roomHealthCleanup?: () => void;

  private lastRoomPingAt = 0;

  private connectionIssueNotified = false;

  private manualReconnectInFlight = false;

  private lastManualReconnectAt = 0;

  /* v0.10.10.220: remember every browser/app background lifecycle signal. */
  private lastDocumentHiddenAt = 0;

  private lastDocumentVisibleAt = Date.now();

  private lastAppBackgroundAt = 0;

  private lastAppForegroundAt = Date.now();

  private appBackgroundSignalActive = false;

  private lastJoinedRoomId = "";

  private lastJoinOptions?: JoinRoomOptions;

  private freshRejoinInFlight = false;

  /* v0.10.10.239: recovery escalation only follows REAL transport evidence. */
  private lastConfirmedTransportDropAt = 0;
  private browserOfflineCycleActive = false;
  private recoveryEscalationGeneration = 0;

  /*
   * v0.10.10.221: foreground/background transitions must not force a
   * reconnect while the existing socket is still perfectly healthy.
   * A short ping probe owns resume recovery; only a failed probe escalates.
   */
  private resumeProbeGeneration = 0;

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

  private readonly lobbyReadyStateHandlers =
    new Set<LobbyReadyStateHandler>();

  private readonly paintReadyStateHandlers =
    new Set<PaintReadyStateHandler>();

  private lobbyReadyState: LobbyReadyState = {
    readySessionIds: [],
    readyCount: 0,
    totalCount: 0,
    allReady: false,
    canStart: false,
    livePlayerCount: 0,
    hasDisconnectedPlayers: false,
  };

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

    void fetch(
      `${this.serverUrl}/hi`,
      {
        method: "GET",
        cache: "no-store",
      },
    ).catch(() => {
      // Optional connection prewarm.
    });
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
          /*
           * v0.10.10.230:
           * Hosts need the same stable identity as joiners from the very first
           * socket. Without this, a host background/fresh-rejoin creates a
           * second Hider while the old Hunter/host remains as a ghost.
           */
          clientKey:
            this.getStableClientKey(),
        },
      );

    this.createdRoomHostSessionId =
      room.sessionId;

    /*
     * Hosts need exactly the same recovery identity as joiners. Previously
     * lastJoinedRoomId/lastJoinOptions were only populated by joinRoomById(),
     * so a host that locked the phone or minimized Chrome could not use the
     * stable-clientKey handoff path at all.
     */
    this.lastJoinedRoomId = room.roomId;
    this.lastJoinOptions = {
      playerName: options.playerName,
      password: options.password ?? "",
    };


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

  async getRoomStatus(
    roomId: string,
  ): Promise<{
    exists: boolean;
    phase: string;
    isPrivate: boolean;
  }> {
    const response = await fetch(
      `${this.serverUrl}/api/room-status?roomId=${encodeURIComponent(roomId)}&t=${Date.now()}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(
        `Room status request failed: ${response.status}`,
      );
    }

    const payload =
      await response.json() as {
        exists?: boolean;
        phase?: string;
        isPrivate?: boolean;
      };

    return {
      exists:
        payload.exists === true,
      phase:
        String(
          payload.phase ??
          "unknown",
        ),
      isPrivate:
        payload.isPrivate === true,
    };
  }

  prewarmServer(): void {
    /*
     * v0.10.10.105:
     * Warm DNS/TLS/HTTP connection while the player is browsing the room UI.
     * This is intentionally fire-and-forget and NEVER blocks joining.
     */
    void fetch(
      `${this.serverUrl}/api/rooms`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      },
    ).catch(
      () => {
        // Best-effort only.
      },
    );
  }

  async listPublicRooms(): Promise<
    PublicRoomInfo[]
  > {
    const response = await fetch(
      `${this.serverUrl}/api/rooms?t=${Date.now()}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        // Keep this a CORS-simple GET. A request-side Cache-Control header
        // triggers a preflight on cross-origin deployments and can make the
        // public room list fail entirely when the server does not allow that
        // header. The timestamp already defeats intermediary/browser caches.
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(
        `Room list request failed: ${response.status}`,
      );
    }

    const payload =
      await response.json() as
        | { rooms?: PublicRoomInfo[] }
        | PublicRoomInfo[];

    const rooms = Array.isArray(payload)
      ? payload
      : payload.rooms ?? [];

    console.log(
      "[Chameleon Hunt] Public rooms from API",
      rooms,
    );

    return rooms;
  }

  private applyLobbyReadyState(
    payload:
      Partial<LobbyReadyState> |
      undefined,
  ): void {
    const readySessionIds =
      Array.isArray(
        payload?.readySessionIds,
      )
        ? payload!.readySessionIds!.map(
            String,
          )
        : [];

    const readyCount =
      Number(
        payload?.readyCount ??
        readySessionIds.length,
      );

    const totalCount =
      Number(
        payload?.totalCount ?? 0,
      );

    this.lobbyReadyState = {
      readySessionIds,
      readyCount:
        Number.isFinite(readyCount)
          ? Math.max(0, readyCount)
          : 0,
      totalCount:
        Number.isFinite(totalCount)
          ? Math.max(0, totalCount)
          : 0,
      allReady:
        Boolean(
          payload?.allReady,
        ),
      canStart:
        Boolean(
          payload?.canStart,
        ),
      livePlayerCount:
        Math.max(
          0,
          Number(
            payload?.livePlayerCount ??
            0,
          ) || 0,
        ),
      hasDisconnectedPlayers:
        Boolean(
          payload?.hasDisconnectedPlayers,
        ),
    };

    this.lobbyReadyStateHandlers
      .forEach(
        (handler) => {
          handler(
            this.lobbyReadyState,
          );
        },
      );
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

    if (snapshot.lobbyReadyState) {
      this.applyLobbyReadyState(
        snapshot.lobbyReadyState,
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
            const removedPlayer =
              this.snapshotPlayers.get(
                sessionId,
              );

            this.snapshotPlayers.delete(
              sessionId,
            );

            /*
             * v0.10.10.239 GHOST SNAPSHOT CLEANUP:
             * A plain lobby_snapshot can be the only authoritative source
             * after a mobile handoff. If a stale session disappeared from the
             * snapshot, emit the same removal event as Schema onRemove so the
             * renderer cannot keep a ghost actor in the lobby.
             */
            if (removedPlayer) {
              this.playerRemovedHandlers.forEach(
                (handler) => {
                  try {
                    handler(
                      sessionId,
                      removedPlayer,
                    );
                  } catch (error) {
                    console.error(
                      "[Chameleon Hunt] Snapshot stale-player removal failed",
                      { sessionId, error },
                    );
                  }
                },
              );
            }
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
    forceDuringManualReconnect = false,
  ): Promise<void> {
    if (
      this.room !== sourceRoom ||
      this.freshRejoinInFlight ||
      (
        this.manualReconnectInFlight &&
        !forceDuringManualReconnect
      ) ||
      !this.lastJoinedRoomId ||
      !this.lastJoinOptions
    ) {
      return;
    }

    this.freshRejoinInFlight = true;

    try {
      /*
       * v0.10.10.79 HUNTER HANDOFF:
       * Do not ask the Client instance that is already reconnecting to open
       * another room. Mobile Hunter traffic can leave that transport stuck
       * in its reconnect state. Use a completely fresh Client/WebSocket.
       */
      const fallbackClient =
        new Client(
          this.serverUrl,
        );

      const room =
        await fallbackClient.joinById<
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

      this.client =
        fallbackClient;

      /*
       * Server v0.10.10.78 transfers the old role/alive/position to this
       * replacement session. attachRoom() then replays the CURRENT phase,
       * including Finished/Lobby if the match ended while offline.
       */
      this.attachRoom(room);
      this.deliveredPhase = "";
      this.requestLobbySnapshot();
      this.requestPaintReadyState();
      this.requestAvatarPresets();
      this.requestRoundPaintState();

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

      try {
        await sourceRoom.leave();
      } catch {
        // The old half-open transport may already be dead.
      }

      /* V101023840D_MOBILE_RECONNECT_CONVERGENCE: wait for authoritative replacement session */
      let authorityAttempts = 0;
      const finishWhenAuthoritative = (): void => {
        if (this.room !== room) return;

        const sid = room.sessionId;
        const ready =
          Boolean(room.state?.players?.get?.(sid)) ||
          this.snapshotPlayers.has(sid);

        if (ready) {
          this.deliveredPhase = "";
          this.requestLobbySnapshot();
          this.requestPaintReadyState();
          /*
           * V1010366_RECONNECT_PAINT_CHUNK_FIX:
           * attachRoom recovery already requested the authoritative paint once.
           * Avoid a second replay wave as soon as the replacement session appears.
           */
          this.clearConnectionIssue();
          return;
        }

        authorityAttempts += 1;
        if (authorityAttempts >= 12) return;

        this.deliveredPhase = "";
        this.requestLobbySnapshot();
        this.requestPaintReadyState();
        globalThis.setTimeout(
          finishWhenAuthoritative,
          Math.min(700,100+authorityAttempts*70),
        );
      };
      globalThis.setTimeout(finishWhenAuthoritative,60);
    } catch {
      // Keep retrying through the watchdog while network is available.
    } finally {
      this.freshRejoinInFlight = false;
    }
  }

  private scheduleConfirmedFreshRecovery(
    sourceRoom: Room<NetworkGameState>,
    delayMs = 15_000,
  ): void {
    const generation =
      ++this.recoveryEscalationGeneration;

    globalThis.setTimeout(
      () => {
        if (
          generation !==
            this.recoveryEscalationGeneration ||
          this.room !== sourceRoom ||
          !this.connectionIssueNotified ||
          this.freshRejoinInFlight ||
          /*
           * V1010345_CONNECTION_STABILITY_HARDENING / SDK_RECONNECT_OWNS_RECOVERY
           * Never replace the Room while Colyseus is still recovering the
           * SAME session. Fresh handoff is the final fallback only.
           */
          sourceRoom.reconnection
            .isReconnecting ||
          (
            typeof navigator !== "undefined" &&
            !navigator.onLine
          )
        ) {
          return;
        }

        const now = Date.now();
        const confirmedRecently =
          this.browserOfflineCycleActive ||
          (
            this.lastConfirmedTransportDropAt > 0 &&
            now - this.lastConfirmedTransportDropAt <
              30_000
          );

        if (!confirmedRecently) {
          return;
        }

        /*
         * v0.10.10.239 HARD RECOVERY:
         * The server can transfer the stable clientKey identity onto a fresh
         * session and supersede the stale transport. Do this only after a REAL
         * offline/drop signal and only after normal SDK recovery had time to
         * work. This breaks the previous 5-minute deadlock where a dead socket
         * kept its reservation but never delivered READY/phase updates.
         */
        void this.attemptFreshRejoin(
          sourceRoom,
          true,
        );
      },
      delayMs,
    );
  }

  private async attemptManualReconnect(
    sourceRoom: Room<NetworkGameState>,
  ): Promise<void> {
    if (
      this.room !== sourceRoom ||
      this.manualReconnectInFlight ||
      sourceRoom.reconnection
        .isReconnecting
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
      this.requestAvatarPresets();
      this.requestRoundPaintState();

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
       * v0.10.10.230 SINGLE RECOVERY OWNER:
       * Never start a fresh join from inside a token reconnect attempt.
       * Colyseus/server still own the old session reservation here. Starting
       * both paths at once is what produced duplicate players/paint ownership.
       * A fresh clientKey handoff is allowed only after final room.onLeave().
       */
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
this.connectionDropHandlers
      .forEach(
        (handler) => {
          handler(reason);
        },
      );
  }

  private clearConnectionIssue(): void {
    this.connectionIssueNotified = false;
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
    this.lastConfirmedTransportDropAt = 0;
    this.browserOfflineCycleActive = false;
    this.recoveryEscalationGeneration += 1;

    const handleBrowserOffline =
      (): void => {
        if (this.room !== room) {
          return;
        }

        this.browserOfflineCycleActive = true;
        this.lastConfirmedTransportDropAt =
          Date.now();

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
         * First give the official token reconnect a chance. If this was a
         * confirmed offline cycle and the old socket is still unusable after
         * 6.5s, escalate once to the stable-clientKey fresh handoff.
         */
        void this.attemptManualReconnect(
          room,
        );
        this.scheduleConfirmedFreshRecovery(
          room,
          15_000,
        );
      };

    const isActiveRound = (): boolean =>
      this.lastStablePhase === "countdown" ||
      this.lastStablePhase === "paint" ||
      this.lastStablePhase === "hunt" ||
      this.lastStablePhase === "finished";

    const markAppBackground =
      (): void => {
        const now = Date.now();
        this.appBackgroundSignalActive = true;
        this.lastAppBackgroundAt = now;
        this.lastDocumentHiddenAt = now;
      };

    const resumeFromAppBackground =
      (reason: string): void => {
        const now = Date.now();
        this.appBackgroundSignalActive = false;
        this.lastAppForegroundAt = now;
        this.lastDocumentVisibleAt = now;

        if (this.room !== room || !isActiveRound()) {
          return;
        }

        /*
         * V1010341_CLIENT_GAMEPLAY_STABILITY_SAFE / FOREGROUND_WATCHDOG_RESET
         * Hidden duration must not become instant ping silence on resume.
         */
        this.lastRoomPingAt = now;

        /*
         * V1010339C_CRITICAL_ROUND_STABILITY_CLIENT / BACKGROUND_FALSE_WARNING_GUARD
         * Hidden-tab time must not count as immediate connection silence.
         */
        this.lastRoomPingAt = now;

        /*
         * v0.10.10.221 CONNECTION STABILITY:
         * Do NOT reconnect merely because the browser regained focus.
         * Alt-tab, Home, lock-screen and app switching are normal user
         * actions, and many browsers keep the existing websocket alive.
         * Forcing token reconnect + fresh rejoin in parallel here caused
         * healthy sessions to replace themselves and was a major source of
         * "random kicks while painting".
         *
         * First probe the current room. Only a probe that does not answer
         * within a generous foreground window escalates to recovery.
         */
        const generation = ++this.resumeProbeGeneration;
        let answered = false;

        const markHealthy = (): void => {
          if (
            answered ||
            generation !== this.resumeProbeGeneration ||
            this.room !== room
          ) {
            return;
          }

          answered = true;
          this.lastRoomPingAt = Date.now();

          if (this.connectionIssueNotified) {
            this.clearConnectionIssue();
          }

          this.requestLobbySnapshot();
          this.requestPaintReadyState();
        };

        try {
          room.ping(markHealthy);
        } catch {
          // Closed/half-open transport: the timeout below escalates recovery.
        }

        globalThis.setTimeout(() => {
          if (
            answered ||
            generation !== this.resumeProbeGeneration ||
            this.room !== room ||
            !isActiveRound() ||
            (typeof document !== "undefined" && document.hidden)
          ) {
            return;
          }

          this.notifyConnectionIssue(reason);

          /*
           * v0.10.10.230:
           * Focus/visibility changes are normal. Give the SDK/server
           * reconnection reservation time to recover the SAME sessionId.
           * Do not open a second WebSocket/player while automatic reconnect
           * is active.
           */
          globalThis.setTimeout(() => {
            if (
              answered ||
              generation !== this.resumeProbeGeneration ||
              this.room !== room ||
              !this.connectionIssueNotified ||
              (typeof document !== "undefined" && document.hidden) ||
              room.reconnection.isReconnecting
            ) {
              return;
            }

            void this.attemptManualReconnect(
              room,
            );
          }, 7000);
        }, 5000);
      };

    const handleVisibilityChange =
      (): void => {
        if (typeof document === "undefined") {
          return;
        }

        if (document.hidden) {
          markAppBackground();
          return;
        }

        resumeFromAppBackground(
          "browser_visible_recovering",
        );
      };

    const handlePageHide = (): void => {
      markAppBackground();
    };

    const handlePageShow = (): void => {
      resumeFromAppBackground(
        "browser_pageshow_recovering",
      );
    };

    const handleWindowBlur = (): void => {
      markAppBackground();
    };

    const handleWindowFocus = (): void => {
      resumeFromAppBackground(
        "browser_focus_recovering",
      );
    };

    const handleFreeze = (): void => {
      markAppBackground();
    };

    const handleResume = (): void => {
      resumeFromAppBackground(
        "browser_resume_recovering",
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

    if (typeof document !== "undefined") {
      document.addEventListener(
        "visibilitychange",
        handleVisibilityChange,
        { passive: true },
      );
      document.addEventListener(
        "freeze",
        handleFreeze,
        { passive: true },
      );
      document.addEventListener(
        "resume",
        handleResume,
        { passive: true },
      );
    }

    globalThis.addEventListener?.(
      "pagehide",
      handlePageHide,
      { passive: true },
    );
    globalThis.addEventListener?.(
      "pageshow",
      handlePageShow,
      { passive: true },
    );
    globalThis.addEventListener?.(
      "blur",
      handleWindowBlur,
      { passive: true },
    );
    globalThis.addEventListener?.(
      "focus",
      handleWindowFocus,
      { passive: true },
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
            silentFor >= 30_000 &&
            (
              this.browserOfflineCycleActive ||
              this.lastConfirmedTransportDropAt > 0 ||
              room.reconnection.isReconnecting
            )
          ) {
            /*
             * V1010339C_CRITICAL_ROUND_STABILITY_CLIENT: throttled/background timers alone are not a disconnect.
             */
            this.notifyConnectionIssue(
              "ping_timeout",
            );
          }

          /*
           * v0.10.10.239 FALSE-DROP GUARD:
           * Mobile GC, Phaser frame stalls and browser timer throttling may
           * delay a ping callback without the WebSocket being broken. A ping
           * timeout alone MUST NEVER replace a healthy Room. Escalate transport
           * recovery only when navigator.offline or Room.onDrop proved a real
           * connectivity event.
           */
          const confirmedTransportProblem =
            this.browserOfflineCycleActive ||
            (
              this.lastConfirmedTransportDropAt > 0 &&
              now -
                this.lastConfirmedTransportDropAt <
                30_000
            );

          if (
            activeRound &&
            confirmedTransportProblem &&
            silentFor >= 15_000 &&
            !room.reconnection
              .isReconnecting &&
            now -
              this.lastManualReconnectAt >=
              5000
          ) {
            void this.attemptManualReconnect(
              room,
            );
            this.scheduleConfirmedFreshRecovery(
              room,
              15_000,
            );
          }
        },
        1800,
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

        if (typeof document !== "undefined") {
          document.removeEventListener(
            "visibilitychange",
            handleVisibilityChange,
          );
          document.removeEventListener(
            "freeze",
            handleFreeze,
          );
          document.removeEventListener(
            "resume",
            handleResume,
          );
        }

        globalThis.removeEventListener?.(
          "pagehide",
          handlePageHide,
        );
        globalThis.removeEventListener?.(
          "pageshow",
          handlePageShow,
        );
        globalThis.removeEventListener?.(
          "blur",
          handleWindowBlur,
        );
        globalThis.removeEventListener?.(
          "focus",
          handleWindowFocus,
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

        this.lastConfirmedTransportDropAt =
          Date.now();

        this.notifyConnectionIssue(
          reason,
        );

        /*
         * V1010345_CONNECTION_STABILITY_HARDENING / ONDROP_SAME_SESSION_FIRST
         *
         * onDrop is already a real transport event, but replacing the Room
         * immediately is still too aggressive. Colyseus + server keep the SAME
         * session reconnectable. Let that path own recovery first.
         *
         * The watchdog can escalate later if the transport stays dead, and
         * final room.onLeave() still owns fresh-rejoin retries.
         */

        /*
         * v0.10.10.230:
         * Do not race Colyseus' own reconnect 450ms after a drop.
         * The server keeps this exact session reconnectable for 30 seconds.
         * The health watchdog may use token reconnect later only if the SDK
         * is NOT already reconnecting.
         */
      },
    );

    room.onReconnect(
      () => {
        if (this.room !== room) {
          return;
        }

        /*
         * V1010340C_MULTIPLAYER_TRANSPORT_HARDENING_FINAL / RECONNECT_AIM_RESET
         */
        this.lastHunterAimSentAt = 0;
        this.lastHunterAimSentAngle =
          Number.NaN;

        /*
         * Force the authoritative server phase to be applied even when
         * reconnecting during the same phase.
         */
        this.deliveredPhase = "";

        this.requestLobbySnapshot();
        this.requestPaintReadyState();
        this.requestAvatarPresets();

        /*
         * V1010366_RECONNECT_PAINT_CHUNK_FIX:
         * The server's onReconnect already pushes one authoritative, chunked
         * paint recovery stream. Do not request the same large round snapshot
         * four more times; repeated replay waves made every actor's camouflage
         * appear to rewind/flicker and stalled mobile rendering.
         *
         * Keep lightweight phase/READY pulses only.
         */
        [120, 420, 1100].forEach(
          (delay) => {
            globalThis.setTimeout(
              () => {
                if (this.room !== room) {
                  return;
                }

                this.deliveredPhase = "";
                this.requestLobbySnapshot();
                this.requestPaintReadyState();
              },
              delay,
            );
          },
        );

        this.lastConfirmedTransportDropAt = 0;
        this.browserOfflineCycleActive = false;
        this.recoveryEscalationGeneration += 1;
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
          this.lastStablePhase,
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

        this.avatarPresetBatchStartHandlers
          .forEach(
            (handler) => {
              handler(
                presets.length,
              );
            },
          );

        if (presets.length === 0) {
          this.avatarPresetBatchEndHandlers
            .forEach(
              (handler) => {
                handler(0);
              },
            );

          return;
        }

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

                if (
                  index ===
                  presets.length - 1
                ) {
                  this.avatarPresetBatchEndHandlers
                    .forEach(
                      (handler) => {
                        handler(
                          presets.length,
                        );
                      },
                    );
                }
              },
              index * 120,
            );
          },
        );
      },
    );

    room.onMessage<{
      strokes?: NetworkPaintStroke[];
    }>(
      "reconnected_player_paint",
      (payload) => {
        const strokes =
          Array.isArray(payload?.strokes)
            ? payload.strokes
            : [];

        this.reconnectedPlayerPaintHandlers
          .forEach(
            (handler) => {
              handler(strokes);
            },
          );
      },
    );

    room.onMessage<NetworkChatMessage>(
      "chat_message",
      (message) => {
        if (
          !message ||
          typeof message.text !== "string"
        ) {
          return;
        }

        this.chatMessageHandlers.forEach(
          (handler) => {
            handler(message);
          },
        );
      },
    );

    room.onMessage<{
      messages?: NetworkChatMessage[];
    }>(
      "chat_history",
      (payload) => {
        const messages =
          Array.isArray(payload?.messages)
            ? payload.messages
            : [];

        this.chatHistoryHandlers.forEach(
          (handler) => {
            handler(messages);
          },
        );
      },
    );

    room.onMessage<{
      message?: string;
    }>(
      "chat_error",
      (payload) => {
        const message =
          String(
            payload?.message ?? "",
          );

        if (!message) {
          return;
        }

        this.chatErrorHandlers.forEach(
          (handler) => {
            handler(message);
          },
        );
      },
    );

    room.onMessage<{
      strokes?: NetworkPaintStroke[];
    }>(
      "round_paint_state",
      (payload) => {
        const strokes =
          Array.isArray(payload?.strokes)
            ? payload.strokes
            : [];

        this.roundPaintStateHandlers
          .forEach(
            (handler) => {
              handler(strokes);
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

    room.onMessage<LobbyReadyState>(
      "lobby_ready_state",
      (payload) => {
        this.applyLobbyReadyState(
          payload,
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

    room.onMessage<NetworkFartState>('fart_state', (state) => {
      this.fartStateHandlers.forEach((handler) => handler(state));
    });
    room.onMessage<NetworkFartBurst>('fart_burst', (event) => {
      this.fartBurstHandlers.forEach((handler) => handler(event));
    });
    room.onMessage<NetworkPoopBurst>('poop_burst', (event) => {
      this.poopBurstHandlers.forEach((handler) => handler(event));
    });
    room.onMessage<NetworkHiderReaction>('hider_cough', (event) => {
      this.hiderCoughHandlers.forEach((handler) => handler(event));
    });
    room.onMessage<NetworkHiderReaction>('hider_laugh', (event) => {
      this.hiderLaughHandlers.forEach((handler) => handler(event));
    });
    room.onMessage<{ reaction?: 'cough' | 'laugh' }>('fart_detected', (event) => {
      const reaction = event?.reaction === 'laugh' ? 'laugh' : 'cough';
      this.fartDetectedHandlers.forEach((handler) => handler(reaction));
    });


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
         * A deliberately abandoned/old Room must never affect the current
         * connection.
         */
        if (this.room !== room) {
          return;
        }

        /*
         * v0.10.10.127 EMERGENCY REJOIN:
         *
         * Colyseus can emit the final onLeave after a short mobile/Incognito
         * transport disturbance. The old behavior immediately set room to
         * undefined, which made GameScene throw the Hider into the main
         * lobby after only ~700ms.
         *
         * Keep the closed Room as the recovery identity for a grace period
         * and use the existing clientKey handoff path to join the SAME room.
         * Manual disconnect() is unaffected because it clears this.room
         * BEFORE calling room.leave().
         */
        const recoverable =
          Boolean(
            this.lastJoinedRoomId &&
            this.lastJoinOptions,
          ) &&
          (
            this.lastStablePhase ===
              "lobby" ||
            this.lastStablePhase ===
              "countdown" ||
            this.lastStablePhase ===
              "paint" ||
            this.lastStablePhase ===
              "hunt" ||
            this.lastStablePhase ===
              "finished"
          ) &&
          (
            typeof navigator ===
              "undefined" ||
            navigator.onLine
          );

        if (recoverable) {
          this.notifyConnectionIssue(
            reason ??
              "unexpected_room_leave",
          );

          /*
           * attemptFreshRejoin() only requires this.room === sourceRoom;
           * keeping the old object here intentionally allows the handoff
           * even though its socket has already closed.
           */
          void this.attemptFreshRejoin(
            room,
          );

          const leaveAt = Date.now();
          const hiddenNow =
            typeof document !== "undefined" && document.hidden;
          const recentlyVisible =
            this.lastDocumentVisibleAt > 0 &&
            leaveAt - this.lastDocumentVisibleAt < 6500;
          const recentlyHidden =
            this.lastDocumentHiddenAt > 0 &&
            leaveAt - this.lastDocumentHiddenAt < 30 * 60 * 1000;
          const recentlyBackgrounded =
            this.lastAppBackgroundAt > 0 &&
            leaveAt - this.lastAppBackgroundAt < 30 * 60 * 1000;
          const backgroundTabRecovery =
            hiddenNow ||
            this.appBackgroundSignalActive ||
            recentlyVisible ||
            recentlyHidden ||
            recentlyBackgrounded;

          /*
           * We are here only after final room.onLeave(), so the old server
           * reservation is no longer the recovery owner. Fresh handoff is now
           * safe, but keep retries sparse to avoid connection storms.
           */
          const retryDelays = backgroundTabRecovery
            ? [1000, 3000, 7000, 15000, 30000, 60000]
            : [1200, 3500, 8000, 15000];

          retryDelays.forEach((delay) => {
            globalThis.setTimeout(() => {
              if (
                this.room === room &&
                (typeof navigator === "undefined" || navigator.onLine)
              ) {
                void this.attemptFreshRejoin(room);
              }
            }, delay);
          });

          const terminalCheck = (): void => {
            if (this.room !== room) {
              return;
            }

            /*
             * Never declare Home/screen-lock/app-switch/minimized sessions
             * terminally dead. Mobile JS timers may wake only after minutes.
             */
            if (
              (typeof document !== "undefined" && document.hidden) ||
              this.appBackgroundSignalActive
            ) {
              globalThis.setTimeout(terminalCheck, 5000);
              return;
            }

            const visibleFor =
              this.lastAppForegroundAt > 0
                ? Date.now() - this.lastAppForegroundAt
                : Number.POSITIVE_INFINITY;

            /*
             * Mobile/desktop background recovery gets a long foreground grace
             * window. Browsers may need tens of seconds after unlock/focus to
             * restore radio, DNS and websocket scheduling. Do not send the
             * player to the public lobby while recovery is still plausible.
             */
            if (backgroundTabRecovery && visibleFor < 180000) {
              if (visibleFor >= 3000) {
                void this.attemptFreshRejoin(
                  room,
                );
              }

              globalThis.setTimeout(
                terminalCheck,
                Math.max(3000, Math.min(8000, 180500 - visibleFor)),
              );
              return;
            }

            this.room = undefined;
            this.callbacks = undefined;
            this.lastStablePhase = "lobby";
            this.emitConnectionChanged(false);
          };

          globalThis.setTimeout(
            terminalCheck,
            backgroundTabRecovery ? 30000 : 20000,
          );

          return;
        }

        this.room = undefined;
        this.callbacks =
          undefined;
        this.lastStablePhase =
          "lobby";

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
        const normalizedMessage =
          String(message ?? "")
            .trim()
            .toLowerCase();

        /*
         * V1010387_STALE_SEAT_RESERVATION_LOG_CLEANUP:
         * Colyseus may report an expired reservation from an obsolete reconnect
         * attempt even after the client has already recovered through a newer Room.
         * This is non-fatal and must not be presented as a red gameplay error.
         *
         * IMPORTANT:
         * Do not alter reconnect state here.
         * The normal reconnect / fresh-rejoin paths remain authoritative.
         */
        if (
          code === 524 &&
          normalizedMessage.includes(
            "seat reservation expired",
          )
        ) {
          console.info(
            "[Chameleon Hunt] Ignored stale reconnect reservation",
            {
              code,
              message,
              roomId:
                room.roomId,
              sessionId:
                room.sessionId,
            },
          );

          return;
        }

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

    /*
     * V1010340C_MULTIPLAYER_TRANSPORT_HARDENING_FINAL / HIDDEN_MOVE_GUARD
     * Never flush stale movement callbacks while the page is hidden/frozen.
     */
    if (
      typeof document !==
        "undefined" &&
      document.hidden
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
    /*
     * V1010340C_MULTIPLAYER_TRANSPORT_HARDENING_FINAL / AIM_THROTTLE
     *
     * Gaming mice can produce hundreds of pointer events each second.
     * Ordinary aim updates are limited to ~30Hz, while large turns bypass.
     */
    if (
      !this.room ||
      !Number.isFinite(angle)
    ) {
      return;
    }

    const now =
      typeof performance !==
        "undefined"
        ? performance.now()
        : Date.now();

    const previous =
      this.lastHunterAimSentAngle;

    const angularJump =
      Number.isFinite(previous)
        ? Math.abs(
            Math.atan2(
              Math.sin(
                angle -
                  previous
              ),
              Math.cos(
                angle -
                  previous
              ),
            ),
          )
        : Number.POSITIVE_INFINITY;

    if (
      now -
        this.lastHunterAimSentAt <
        33 &&
      angularJump < 0.14
    ) {
      return;
    }

    this.lastHunterAimSentAt =
      now;

    this.lastHunterAimSentAngle =
      angle;

    this.room.send(
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

  sendFart(): void {
    this.room?.send('fart_use', { pressedAt: Date.now() });
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

  sendLobbyReady(
    ready: boolean,
  ): void {
    this.room?.send(
      "lobby_ready",
      { ready },
    );
  }

  requestLobbyReadyState(): void {
    this.room?.send(
      "request_lobby_ready_state",
      {},
    );
  }

  getLobbyReadyState(): LobbyReadyState {
    return this.lobbyReadyState;
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

  onReconnectedPlayerPaint(
    handler: ReconnectedPlayerPaintHandler,
  ): () => void {
    this.reconnectedPlayerPaintHandlers.add(
      handler,
    );

    return () => {
      this.reconnectedPlayerPaintHandlers.delete(
        handler,
      );
    };
  }

  onChatMessage(
    handler: ChatMessageHandler,
  ): () => void {
    this.chatMessageHandlers.add(
      handler,
    );

    return () => {
      this.chatMessageHandlers.delete(
        handler,
      );
    };
  }

  onChatHistory(
    handler: ChatHistoryHandler,
  ): () => void {
    this.chatHistoryHandlers.add(
      handler,
    );

    return () => {
      this.chatHistoryHandlers.delete(
        handler,
      );
    };
  }

  onChatError(
    handler: ChatErrorHandler,
  ): () => void {
    this.chatErrorHandlers.add(
      handler,
    );

    return () => {
      this.chatErrorHandlers.delete(
        handler,
      );
    };
  }

  sendChatMessage(
    text: string,
  ): void {
    const normalized =
      text.trim();

    if (
      !this.room ||
      !normalized
    ) {
      return;
    }

    this.room.send(
      "chat_send",
      {
        text:
          normalized.slice(
            0,
            140,
          ),
      },
    );
  }

  requestChatHistory(): void {
    this.room?.send(
      "request_chat_history",
      {},
    );
  }

  onRoundPaintState(
    handler: RoundPaintStateHandler,
  ): () => void {
    this.roundPaintStateHandlers.add(
      handler,
    );

    return () => {
      this.roundPaintStateHandlers.delete(
        handler,
      );
    };
  }

  requestRoundPaintState(): void {
    this.room?.send(
      "request_round_paint_state",
      {},
    );
  }

  sendReconnectPaintSnapshot(
    strokes: NetworkPaintStroke[],
  ): void {
    if (
      !this.room ||
      strokes.length < 1
    ) {
      return;
    }

    /*
     * v0.10.10.93:
     * The reconnecting client is the most reliable source of its own
     * camouflage because its GameScene/localPaintHistory survives the
     * WebSocket handoff. Ask the server to normalize these strokes to the
     * NEW sessionId and replay them only to opponents.
     */
    /*
     * V1010364_MAX_PAYLOAD_RECONNECT_LOOP_FIX:
     * Never put an unbounded round history into one WebSocket frame.
     * This is a last-resort compatibility path; normal recovery now pulls
     * request_round_paint_state from the authoritative server.
     */
    const boundedStrokes = strokes
      .slice(-120)
      .map((stroke) => ({
        ...stroke,
        points: stroke.points.slice(-96),
      }));

    this.room.send(
      "restore_local_paint",
      {
        strokes: boundedStrokes,
      },
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
      this.room?.state?.phase ??
      this.lastStablePhase
    );
  }

  isConnectionRecovering(): boolean {
    return (
      this.connectionIssueNotified ||
      this.manualReconnectInFlight ||
      this.freshRejoinInFlight
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

  onAvatarPresetBatchStart(
    handler: AvatarPresetBatchHandler,
  ): () => void {
    this.avatarPresetBatchStartHandlers.add(
      handler,
    );

    return () => {
      this.avatarPresetBatchStartHandlers.delete(
        handler,
      );
    };
  }

  onAvatarPresetBatchEnd(
    handler: AvatarPresetBatchHandler,
  ): () => void {
    this.avatarPresetBatchEndHandlers.add(
      handler,
    );

    return () => {
      this.avatarPresetBatchEndHandlers.delete(
        handler,
      );
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


  onFartState(handler: FartStateHandler): () => void {
    this.fartStateHandlers.add(handler);
    return () => this.fartStateHandlers.delete(handler);
  }
  onFartBurst(handler: FartBurstHandler): () => void {
    this.fartBurstHandlers.add(handler);
    return () => this.fartBurstHandlers.delete(handler);
  }
  onPoopBurst(handler: PoopBurstHandler): () => void {
    this.poopBurstHandlers.add(handler);
    return () => this.poopBurstHandlers.delete(handler);
  }
  onHiderCough(handler: HiderReactionHandler): () => void {
    this.hiderCoughHandlers.add(handler);
    return () => this.hiderCoughHandlers.delete(handler);
  }
  onHiderLaugh(handler: HiderReactionHandler): () => void {
    this.hiderLaughHandlers.add(handler);
    return () => this.hiderLaughHandlers.delete(handler);
  }
  onFartDetected(handler: FartDetectedHandler): () => void {
    this.fartDetectedHandlers.add(handler);
    return () => this.fartDetectedHandlers.delete(handler);
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

  onLobbyReadyState(
    handler:
      LobbyReadyStateHandler,
  ): () => void {
    this.lobbyReadyStateHandlers
      .add(handler);

    return () => {
      this.lobbyReadyStateHandlers
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
    this.lastStablePhase = "lobby";
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
    /*
     * V1010339C_CRITICAL_ROUND_STABILITY_CLIENT / TAB_SCOPED_RECOVERY_ID
     *
     * localStorage is shared by every browser tab. Opening a second game tab
     * could therefore supersede the active tab's player connection.
     *
     * sessionStorage survives refresh in this tab while independent tabs get
     * independent identities.
     */
    const storageKey =
      "chameleon-hunt-tab-client-key";

    try {
      const existing =
        sessionStorage.getItem(
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

      sessionStorage.setItem(
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
