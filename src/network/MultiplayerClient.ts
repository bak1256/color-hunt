/* V1010538B_SIX_PLAYER_STABILITY_REMOTE_SNIPER_AUDIO_ROBUST: preserves current reconnect policy; only unsafe legacy ping-only warning is rewritten. */
/* V1010521G_VULCAN_SERVER_HEAT_RESULT_CLEAN_HIDER_OUTLINE_CURRENT_SOURCE: NetworkVulcanFiringState carries authoritative accumulated heat. */
/* V1010510_VULCAN_HOLD_FIRE_CINEMATIC_SEARCHLIGHT: Vulcan hold-fire network protocol. */
/* V1010508_VULCAN_SEARCHLIGHT_COOLDOWN_CINEMATIC: Vulcan repeated-fire cooldown deadline. */
/* V1010507_TACTICAL_VULCAN_AIR_SUPPORT: tactical support transport, synced spotlight + Vulcan burst. */
/* V1010470_FRESH_HANDOFF_RELEASE: successful fresh reconnect no longer waits on stale Room.leave(); transport gate releases as soon as replacement local state is authoritative. */
/* V1010468D_REPAIR_RESUME_FUNCTIONS: restores lifecycle function declarations accidentally removed by 468c while preserving v468 fast reconnect behavior. */
/* V1010468_FAST_MOBILE_FOREGROUND_RECONNECT: Lobby now probes immediately on mobile foreground; confirmed onDrop gets an 850ms same-session grace then bounded stable-clientKey handoff; post-leave retries/convergence are faster. */
/* V1010452_SKILL_SYSTEM_FOUNDATION: client skill selection/state API. */
/* V1010451E2_TERMINAL_REJOIN_AND_FOUND_POSITIONS_ROBUST: robust terminal fresh-rejoin rejection handling. */
/* V1010450ZG_READY_AND_SNAPSHOT_STABILITY */
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

/* V1010453_SNIPER_SUPPORT_MODE */
export type NetworkSniperState = {
  sessionId: string;
  active: boolean;
  available: boolean;
  remainingMs: number;
  serverNow: number;
};
export type NetworkSniperAim = { sessionId: string; x: number; y: number };
export type NetworkSniperFired = {
  shooterId: string;
  x: number;
  y: number;
  hitId: string;
  readyAt: number;
  serverNow: number;
};
export type SniperStateHandler = (state: NetworkSniperState) => void;
export type SniperAimHandler = (aim: NetworkSniperAim) => void;
export type SniperFiredHandler = (shot: NetworkSniperFired) => void;

/* V1010507_TACTICAL_VULCAN_AIR_SUPPORT */
export type NetworkVulcanState = {
  sessionId: string;
  active: boolean;
  available: boolean;
  remainingMs: number;
  serverNow: number;
};
export type NetworkVulcanAim = { sessionId: string; x: number; y: number };
export type NetworkVulcanFired = {
  shooterId: string;
  x: number;
  y: number;
  seed: number;
  startedAt: number;
  durationMs: number;
  hitIds: string[];
  readyAt: number;
  serverNow: number;
};
export type NetworkVulcanFiringState = {
  shooterId: string;
  active: boolean;
  startedAt: number;
  heldMs: number;
  cooldownMs: number;
  readyAt: number;
  serverNow: number;
  heat: number;
};
export type VulcanStateHandler = (state: NetworkVulcanState) => void;
export type VulcanAimHandler = (aim: NetworkVulcanAim) => void;
export type VulcanFiredHandler = (shot: NetworkVulcanFired) => void;
export type VulcanFiringStateHandler = (state: NetworkVulcanFiringState) => void;

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
  /*
   * V1010436_VICTORY_FOUND_PAINT_AUTHORITATIVE
   * Authoritative victory metadata. foundHiders may also contain the exact
   * final camouflage snapshot captured by the server at hit time.
   */
  victoryShowcase?: {
    activeMap?: string;
    foundHiders?: Array<{
      sessionId: string;
      name?: string;
      x: number;
      y: number;
      foundOrder?: number;
      foundAt?: number;
      foundByHunterSessionId?: string;
      foundByHunterClientKey?: string;
      paintStrokes?: NetworkPaintStroke[];
    }>;
    /*
     * V1010439_PERSONAL_FOUND_VISUAL_FINAL: authoritative per-recipient subset calculated by server.
     */
    personalFoundHiders?: Array<{
      sessionId: string;
      name?: string;
      x: number;
      y: number;
      foundOrder?: number;
      foundAt?: number;
      foundByHunterSessionId?: string;
      foundByHunterClientKey?: string;
      paintStrokes?: NetworkPaintStroke[];
    }>;
    recipientName?: string;
    recipientSessionId?: string;
    recipientClientKey?: string;
    survivingHiders?: Array<{
      sessionId: string;
      name?: string;
      x: number;
      y: number;
    }>;
  };
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

export type PlayerSkillId =
  | "paintball"
  | "laser";

export type SkillStateHandler = (
  skillId: PlayerSkillId,
) => void;

export class MultiplayerClient {
  /* V1010433_RESTORE_819_SINGLE_RECOVERY_OWNER: restore 8/19 single reconnect owner; terminal 524 handoff is serialized. */
  /* V1010426B_RECONNECT_STORM_VISUAL_CONVERGENCE: old reconnect stability contracts restored without recovery fanout. */
  /* V1010374_RESTORE_LOBBY_READY_CLIENT_API: restore authoritative lobby READY client contract without touching reconnect/gameplay transport. */
  /* V1010373_RECONNECT_SINGLE_AUTHORITY_GAMEPLAY_LOCK: reconnect has one transport owner; gameplay sends pause until the authoritative Room is stable. */
  /* V1010372_SEAT_EXPIRED_FRESH_REJOIN: terminal 524 reconnect seats immediately fall back to bounded fresh clientKey rejoin. */
  /* V1010367_CLIENT_RECONNECT_SNAPSHOT_CONVERGENCE: throttle heavy paint snapshots and converge reconnect state before gameplay rebuild. */
  /* V1010364_P0_MULTIPLAYER_STABILITY: reduce high-frequency aim transport; preserve large-turn bypass. */
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

  private readonly sniperStateHandlers = new Set<SniperStateHandler>();
  private readonly sniperAimHandlers = new Set<SniperAimHandler>();
  private readonly sniperFiredHandlers = new Set<SniperFiredHandler>();
  private readonly vulcanStateHandlers = new Set<VulcanStateHandler>();
  private readonly vulcanAimHandlers = new Set<VulcanAimHandler>();
  private readonly vulcanFiredHandlers = new Set<VulcanFiredHandler>();
  private readonly vulcanFiringStateHandlers = new Set<VulcanFiringStateHandler>();



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

  /*
   * V1010367_CLIENT_RECONNECT_SNAPSHOT_CONVERGENCE / PAINT_SNAPSHOT_THROTTLE
   * A full round snapshot can replay thousands of raster stamps on mobile.
   */
  private lastRoundPaintStateRequestAt =
    0;

  private readonly roundPaintStateRequestMinIntervalMs =
    900;

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

  /* V1010471_RECOVERY_NOTICE_EPOCH_DEDUPE
   * Transport recovery itself is unchanged. This flag only deduplicates the
   * public connectionRecovered pulse so one confirmed drop produces one
   * recovered notification, even if ping/onReconnect/fresh-handoff convergence
   * call clearConnectionIssue() more than once.
   */
  private connectionRecoveryNoticeArmed = false;

  /*
   * V1010373_RECONNECT_SINGLE_AUTHORITY_GAMEPLAY_LOCK / TRANSPORT_GATE
   * Gameplay traffic is legal only while ONE current Room owns a healthy
   * transport. Recovery/snapshot messages still use their dedicated methods.
   */
  consumeTerminalJoinRejectionReason(): string {
    const reason =
      this.lastTerminalJoinRejectionReason;

    this.lastTerminalJoinRejectionReason =
      "";

    return reason;
  }

  isGameplayTransportStable(): boolean {
    const room =
      this.room;

    return Boolean(
      room &&
      !this.connectionIssueNotified &&
      !this.manualReconnectInFlight &&
      !this.freshRejoinInFlight &&
      !room.reconnection.isReconnecting,
    );
  }

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

  /*
   * V1010451E2_TERMINAL_REJOIN_AND_FOUND_POSITIONS_ROBUST / TERMINAL_JOIN_REJECTION
   * Persist a terminal active-round rejection until GameScene consumes it.
   */
  private lastTerminalJoinRejectionReason = "";

  /*
   * V1010372_SEAT_EXPIRED_FRESH_REJOIN
   * A 524 "seat reservation expired" is terminal for the OLD reconnection
   * token. Do not spend the SDK's remaining reconnect attempts on that seat;
   * hand off identity through the existing fresh joinById/clientKey path.
   */
  private seatExpiryRecoveryRoom?: object;

  private seatExpiryRecoveryGeneration = 0;

  private isSeatReservationExpired(
    code: number,
    message?: string,
  ): boolean {
    return (
      code === 524 ||
      /seats+reservations+expired/i.test(
        String(message ?? ""),
      )
    );
  }

  private recoverExpiredSeat(
    sourceRoom: Room<NetworkGameState>,
  ): void {
    if (
      this.room !== sourceRoom ||
      this.seatExpiryRecoveryRoom ===
        sourceRoom
    ) {
      return;
    }

    this.seatExpiryRecoveryRoom =
      sourceRoom;

    const generation =
      ++this.seatExpiryRecoveryGeneration;

    /*
     * This is authoritative terminal evidence for the old reconnect token.
     * Mark the connection unhealthy, but keep the UI/session context alive
     * while the fresh clientKey handoff is attempted.
     */
    this.lastConfirmedTransportDropAt =
      Date.now();

    this.notifyConnectionIssue(
      "seat_reservation_expired",
    );

    /*
     * A fresh join can occasionally race the server's old-seat cleanup.
     * Retry only a few bounded times with a completely fresh Client. Once one
     * succeeds, attachRoom() changes this.room and all later callbacks no-op.
     */
    [0, 700, 1800, 4000].forEach(
      (delay) => {
        globalThis.setTimeout(
          () => {
            if (
              generation !==
                this.seatExpiryRecoveryGeneration ||
              this.room !==
                sourceRoom
            ) {
              return;
            }

            void this.attemptFreshRejoin(
              sourceRoom,
              true,
            );
          },
          delay,
        );
      },
    );
  }

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

  /*
   * V1010440E_AUDITED_DIRECT_FOUND_GALLERY
   * Shooter-only hit events arrive before round_result and are cached here.
   * This is the final fallback if any result identity metadata is stale.
   */
  private personalVictoryFoundHiders:
    any[] = [];
  /* V1010444_RESULT_IDENTITY_FALLBACK: cache remains fallback; final result identity is primary. */
  /* V1010443_FREEZE_PERSONAL_FOUND_IN_ROUND_RESULT: async victory poster reads frozen round_result ownership. */

  /*
   * V1010441_LOCAL_SHOT_FOUND_IDS
   * shot_fired is broadcast by the authoritative server and already carries
   * shooterId + exact hitIds. Remember only THIS browser's own hit IDs.
   * round_result later upgrades those IDs to full authoritative entries
   * (name/position/foundOrder/paintStrokes), so FOUND no longer depends on
   * recipient-specific event timing.
   */
  private readonly personalVictoryFoundSessionIds =
    new Set<string>();

  getPersonalVictoryFoundHiders():
    any[] {
    return this.personalVictoryFoundHiders
      .map(
        (entry) => ({
          ...entry,
          paintStrokes:
            Array.isArray(
              entry?.paintStrokes,
            )
              ? entry.paintStrokes
                  .map(
                    (stroke: any) => ({
                      ...stroke,
                      points:
                        Array.isArray(
                          stroke?.points,
                        )
                          ? stroke.points.map(
                              (point: any) => ({
                                ...point,
                              }),
                            )
                          : [],
                    }),
                  )
              : [],
        }),
      );
  }


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

  private lobbyReadyState: LobbyReadyState = {
    readySessionIds: [],
    readyCount: 0,
    totalCount: 0,
    allReady: false,
    canStart: false,
    livePlayerCount: 0,
    hasDisconnectedPlayers: false,
  };

  private readonly paintReadyStateHandlers =
    new Set<PaintReadyStateHandler>();

  private readonly skillStateHandlers =
    new Set<SkillStateHandler>();

  private selectedSkill: PlayerSkillId =
    "paintball";

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
    clients?: number;
    playerCount?: number;
    maxClients?: number;
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
        clients?: number;
        playerCount?: number;
        maxClients?: number;
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
      clients:
        Number.isFinite(
          Number(payload.clients),
        )
          ? Number(payload.clients)
          : undefined,
      playerCount:
        Number.isFinite(
          Number(payload.playerCount),
        )
          ? Number(payload.playerCount)
          : undefined,
      maxClients:
        Number.isFinite(
          Number(payload.maxClients),
        )
          ? Number(payload.maxClients)
          : undefined,
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
         * V1010450ZG_SNAPSHOT_ADD_DEDUP
         *
         * lobby_snapshot is a recovery snapshot and may legitimately arrive
         * many times. Re-emitting PlayerAdded for an already-known session made
         * GameScene rebuild the same actors repeatedly and produced the visible
         * "Player added" storm. Existing snapshot players are updates, not adds.
         */
        const targetHandlers =
          existed
            ? this.playerChangedHandlers
            : this.playerAddedHandlers;

        targetHandlers.forEach(
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
                  existed,
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

  private applyLobbyReadyState(
    payload: LobbyReadyState,
  ): void {
    const readySessionIds =
      Array.isArray(payload?.readySessionIds)
        ? payload.readySessionIds.map(String)
        : [];

    const readyCount = Number(
      payload?.readyCount ??
      readySessionIds.length,
    );

    const totalCount = Number(
      payload?.totalCount ?? 0,
    );

    const livePlayerCount = Number(
      payload?.livePlayerCount ??
      totalCount,
    );

    this.lobbyReadyState = {
      readySessionIds,
      readyCount,
      totalCount,
      allReady:
        Boolean(payload?.allReady) ||
        (totalCount > 0 && readyCount >= totalCount),
      canStart: Boolean(payload?.canStart),
      livePlayerCount,
      hasDisconnectedPlayers:
        Boolean(payload?.hasDisconnectedPlayers),
    };

    this.lobbyReadyStateHandlers.forEach(
      (handler) => {
        handler(this.lobbyReadyState);
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

      /*
       * V1010470_FRESH_HANDOFF_RELEASE
       *
       * The replacement Room is already attached and authoritative here.
       * NEVER await cleanup of the stale half-open source Room:
       * mobile WebViews can leave that Promise pending for many seconds.
       *
       * While this function waits, freshRejoinInFlight stays true, which makes
       * isGameplayTransportStable() false. That blocks sendMove()/aim/fire even
       * though the new Room is alive. Local prediction then moves only on this
       * screen while every other client sees the player frozen.
       *
       * Server clientKey handoff already supersedes the old session, so cleanup
       * is best-effort and must not be on the critical recovery path.
       */
      void sourceRoom
        .leave()
        .catch(() => {
          // Old half-open transport may already be dead or never fully settle.
        });

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
          this.requestRoundPaintState();

          /*
           * V1010470_FRESH_HANDOFF_RELEASE / AUTHORITATIVE_RELEASE
           * The replacement session is now real. Clear the recovery transport
           * gate immediately so movement replication resumes for other clients.
           */
          this.clearConnectionIssue();
          this.freshRejoinInFlight = false;
          return;
        }

        authorityAttempts += 1;
        if (authorityAttempts >= 12) return;

        this.deliveredPhase = "";
        this.requestLobbySnapshot();
        this.requestPaintReadyState();
        globalThis.setTimeout(
          finishWhenAuthoritative,
          Math.min(
            320,
            70 +
              authorityAttempts *
                35,
          ),
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
      this.freshRejoinInFlight ||
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
    } catch (error) {
      const reconnectError =
        error as {
          code?: number;
          message?: string;
        };

      if (
        this.isSeatReservationExpired(
          Number(
            reconnectError?.code ??
              0,
          ),
          reconnectError?.message,
        )
      ) {
        /*
         * V1010372_SEAT_EXPIRED_FRESH_REJOIN: 524 means the server explicitly says the old seat no
         * longer exists, so the old SINGLE RECOVERY OWNER constraint is no
         * longer applicable. Fresh clientKey handoff is now the sole owner.
         */
        /*
         * V1010433_RESTORE_819_SINGLE_RECOVERY_OWNER / TERMINAL_524_HANDOFF
         * 524 is terminal for the old seat, but keep exactly one recovery owner.
         * Let attemptManualReconnect() release its lock in finally, then hand off
         * to the fresh-seat path on the next task.
         */
        globalThis.setTimeout(
          () => {
            if (
              this.room === sourceRoom &&
              !this.manualReconnectInFlight &&
              !this.freshRejoinInFlight
            ) {
              this.recoverExpiredSeat(
                sourceRoom,
              );
            }
          },
          0,
        );
      }

      /*
       * v0.10.10.230 SINGLE RECOVERY OWNER:
       * For ordinary reconnect failures, never race token reconnect and fresh
       * join. Only terminal expired-seat evidence bypasses this rule above.
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

    /* V1010471_RECOVERY_NOTICE_EPOCH_DEDUPE / ARM_ON_REAL_ISSUE
     * Arm exactly one recovered pulse for this connection-issue epoch.
     * Reconnect ownership, watchdog timing and transport recovery are untouched.
     */
    this.connectionRecoveryNoticeArmed = true;

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

    /* V1010471_RECOVERY_NOTICE_EPOCH_DEDUPE / ONE_RECOVERED_PULSE
     * IMPORTANT: do not gate transport recovery itself here. attachRoom(),
     * SDK reconnect, manual reconnect and fresh clientKey handoff still run
     * exactly as before. We only suppress duplicate recovered callbacks after
     * the first successful clear belonging to the same issue epoch.
     */
    if (!this.connectionRecoveryNoticeArmed) {
      return;
    }

    this.connectionRecoveryNoticeArmed = false;

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
    this.lastRoundPaintStateRequestAt = 0;

    /*
     * V1010372_SEAT_EXPIRED_FRESH_REJOIN / NEW_ROOM_OWNS_RECOVERY
     */
    this.seatExpiryRecoveryGeneration +=
      1;
    this.seatExpiryRecoveryRoom =
      undefined;

this.room = room;

    /*
     * V1010451E2_TERMINAL_REJOIN_AND_FOUND_POSITIONS_ROBUST / ATTACH_REJECTION_GATE
     *
     * A fresh-rejoin Room may receive join_rejected before GameScene can bind
     * its per-room listener. Catch it at the transport owner immediately.
     */
    room.onMessage(
      "join_rejected",
      (
        payload: {
          reason?: string;
          returnToLobby?: boolean;
        },
      ) => {
        if (
          this.room !== room ||
          payload?.reason !==
            "game_in_progress"
        ) {
          return;
        }

        this.lastTerminalJoinRejectionReason =
          "game_in_progress";

        /*
         * Stop every reconnect owner/watchdog so this rejected Room cannot
         * remain as a movable but non-authoritative ghost waiting room.
         */
        this.recoveryEscalationGeneration +=
          1;
        this.seatExpiryRecoveryGeneration +=
          1;
        this.freshRejoinInFlight = false;
        this.manualReconnectInFlight = false;
        this.connectionIssueNotified = false;

        this.room = undefined;
        this.callbacks = undefined;
        this.deliveredPhase = "";
        this.lastStablePhase = "lobby";
        this.snapshotPlayers.clear();
        this.snapshotHostId = "";

        this.emitConnectionChanged(
          false,
        );

        void room.leave().catch(
          () => {
            // Server may already have closed the rejected transport.
          },
        );
      },
    );

    /*
     * Mobile network handoffs can happen before Colyseus' default
     * 5000ms minUptime. Allow recovery after 500ms instead.
     */
    /*
     * V1010373_RECONNECT_SINGLE_AUTHORITY_GAMEPLAY_LOCK / RECONNECT_BACKOFF
     *
     * The old 50-350ms / 60 retry profile can hammer both browser and server
     * during a multi-client wobble. Keep automatic token recovery, but spread
     * attempts over a sensible window. Terminal 524 still escalates
     * immediately through v372.
     */
    room.reconnection.minUptime = 500;
    room.reconnection.maxRetries = 18;
    room.reconnection.delay = 120;
    room.reconnection.minDelay = 120;
    room.reconnection.maxDelay = 1200;
    room.reconnection.maxEnqueuedMessages = 12;
    room.reconnection.backoff =
      (
        attempt: number,
        _delay: number,
      ) =>
        Math.min(
          1200,
          120 + attempt * 80,
        );

    this.roomHealthCleanup?.();

    this.lastRoomPingAt =
      Date.now();
    this.connectionIssueNotified =
      false;
/* V1010433_RESTORE_819_SINGLE_RECOVERY_OWNER / ATTACH_ROOM_DOES_NOT_RELEASE_OWNER
     * Recovery ownership is released only by the reconnect method's finally.
     */
    
    this.lastManualReconnectAt = 0;
    this.lastConfirmedTransportDropAt = 0;
    this.browserOfflineCycleActive = false;
    this.recoveryEscalationGeneration += 1;

    const handleBrowserOffline =
      (): void => {
        if (this.room !== room) {
          return;
        }

        /*
         * V1010425_TRANSPORT_EVENT_ONLY_RECONNECT / OFFLINE_HINT_ONLY
         * navigator/offline is a browser hint, not proof that the Colyseus
         * Room transport died. Keep evidence for a later REAL onDrop, but do
         * not freeze gameplay or create a second reconnect owner here.
         */
        this.browserOfflineCycleActive = true;
      };

    const handleBrowserOnline =
      (): void => {
        if (this.room !== room) {
          return;
        }

        /*
         * V1010425_TRANSPORT_EVENT_ONLY_RECONNECT / ONLINE_PROBE_ONLY
         * Do not reconnect just because the browser emitted "online".
         * A healthy WebSocket often survives Wi-Fi/mobile lifecycle noise.
         */
        try {
          room.ping(
            () => {
              if (this.room !== room) {
                return;
              }

              this.lastRoomPingAt =
                Date.now();

              /*
               * No connectionRecovered event here: nothing actually dropped.
               * Cheap authoritative refresh only.
               */
              this.requestLobbySnapshot();
              this.requestPaintReadyState();
            },
          );
        } catch {
          // If the transport is truly gone, Room.onDrop owns recovery.
        }
      };

    /*
     * V1010468D_REPAIR_RESUME_FUNCTIONS
     * 468c removed these two lifecycle function declarations while trying to
     * remove the now-unused isActiveRound helper. Restore only the declarations
     * and v468 Lobby-inclusive foreground policy.
     */
    const markAppBackground =
      (): void => {
        const now = Date.now();
        this.appBackgroundSignalActive = true;
        this.lastAppBackgroundAt = now;
        this.lastDocumentHiddenAt = now;
      };

    const resumeFromAppBackground =
      (_reason: string): void => {
        const now = Date.now();
        this.appBackgroundSignalActive = false;
        this.lastAppForegroundAt = now;
        this.lastDocumentVisibleAt = now;

        /*
         * V1010468_FAST_MOBILE_FOREGROUND_RECONNECT / LOBBY_FOREGROUND_PROBE
         * Lobby is also a connected Room. Only reject callbacks belonging to
         * an obsolete Room; do not require an active round here.
         */
        if (this.room !== room) {
          return;
        }

        /*
         * Hidden duration must never become immediate foreground ping silence.
         */
        this.lastRoomPingAt = now;

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
          // Closed/half-open transport: the bounded handoff below owns recovery.
        }

        /*
         * V1010468_FAST_MOBILE_FOREGROUND_RECONNECT / FAST_CONFIRMED_DROP_HANDOFF
         *
         * Focus/visibility alone is NOT reconnect evidence. However, once
         * Room.onDrop has already proven that the transport died, waiting for
         * the SDK's full 18-attempt backoff makes a 5-second app switch feel
         * broken. Give same-session recovery a short head start; if it still
         * has not recovered, let the server's stable-clientKey replacement
         * path supersede the stale socket.
         *
         * Multiple browser resume signals are harmless: resumeProbeGeneration
         * makes only the newest foreground epoch authoritative, while
         * freshRejoinInFlight serializes the actual handoff.
         */
        const confirmedDropAtResume =
          this.lastConfirmedTransportDropAt;

        if (
          confirmedDropAtResume > 0 &&
          now -
            confirmedDropAtResume <
              30_000
        ) {
          const fastHandoffDelays =
            [
              850,
              1700,
              2800,
            ];

          fastHandoffDelays.forEach(
            (delay) => {
              globalThis.setTimeout(
                () => {
                  if (
                    answered ||
                    generation !==
                      this.resumeProbeGeneration ||
                    this.room !== room ||
                    this.lastConfirmedTransportDropAt <= 0 ||
                    Date.now() -
                      this.lastConfirmedTransportDropAt >=
                        30_000 ||
                    !this.connectionIssueNotified ||
                    this.freshRejoinInFlight ||
                    this.manualReconnectInFlight ||
                    (
                      typeof document !==
                        "undefined" &&
                      document.hidden
                    ) ||
                    (
                      typeof navigator !==
                        "undefined" &&
                      !navigator.onLine
                    )
                  ) {
                    return;
                  }

                  void this.attemptFreshRejoin(
                    room,
                  );
                },
                delay,
              );
            },
          );
        }

        /*
         * V1010425_TRANSPORT_EVENT_ONLY_RECONNECT / FOREGROUND_PROBE_ONLY
         * A missed lifecycle ping alone does NOT imply transport loss.
         * Fast handoff above still requires a REAL prior Room.onDrop().
         */
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
                this.requestRoundPaintState();
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
            this.lastConfirmedTransportDropAt > 0 &&
            now -
              this.lastConfirmedTransportDropAt <
              30_000;

          if (
            activeRound &&
            confirmedTransportProblem &&
            silentFor >= 15_000 &&
            !room.reconnection
              .isReconnecting &&
            now -
              this.lastManualReconnectAt >=
                10_000
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
         * V1010426B_RECONNECT_STORM_VISUAL_CONVERGENCE / SINGLE_RECOVERY_PULSE
         *
         * Restore the old stability rule:
         * one recovered transport -> one authoritative convergence pass.
         * Do not create a burst of delayed lobby/paint recovery work.
         */
        this.lastHunterAimSentAt = 0;
        this.lastHunterAimSentAngle =
          Number.NaN;

        this.deliveredPhase = "";

        this.requestLobbySnapshot();
        this.requestPaintReadyState();
        this.requestAvatarPresets();
        this.requestRoundPaintState(
          true,
        );

        this.lastConfirmedTransportDropAt = 0;
        this.browserOfflineCycleActive = false;
        this.recoveryEscalationGeneration += 1;
        this.clearConnectionIssue();

        /*
         * One cheap delayed phase/READY settle only.
         * Full paint convergence is owned by GameScene's bounded recovery.
         */
        globalThis.setTimeout(
          () => {
            if (this.room !== room) {
              return;
            }

            this.deliveredPhase = "";
            this.requestLobbySnapshot();
            this.requestPaintReadyState();
          },
          800,
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
        this.applyLobbyReadyState(payload);
      },
    );

    room.onMessage<{ skillId?: PlayerSkillId }>(
      "skill_state",
      (payload) => {
        const skillId =
          payload?.skillId === "laser"
            ? "laser"
            : "paintball";

        this.selectedSkill = skillId;
        this.skillStateHandlers.forEach(
          (handler) => handler(skillId),
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

    room.onMessage<NetworkSniperState>(
      "sniper_state",
      (state) => this.sniperStateHandlers.forEach((handler) => handler(state)),
    );

    room.onMessage<NetworkSniperAim>(
      "sniper_aim",
      (aim) => this.sniperAimHandlers.forEach((handler) => handler(aim)),
    );

    room.onMessage<NetworkSniperFired>(
      "sniper_fired",
      (shot) => this.sniperFiredHandlers.forEach((handler) => handler(shot)),
    );

    room.onMessage<NetworkVulcanState>(
      'vulcan_state',
      (state) => this.vulcanStateHandlers.forEach((handler) => handler(state)),
    );

    room.onMessage<NetworkVulcanAim>(
      'vulcan_aim',
      (aim) => this.vulcanAimHandlers.forEach((handler) => handler(aim)),
    );

    room.onMessage<NetworkVulcanFired>(
      'vulcan_fired',
      (shot) => this.vulcanFiredHandlers.forEach((handler) => handler(shot)),
    );
    room.onMessage<NetworkVulcanFiringState>(
      'vulcan_firing',
      (state) => this.vulcanFiringStateHandlers.forEach((handler) => handler(state)),
    );

    room.onMessage<{ readyAt: number; serverNow: number }>(
      "sniper_reload",
      (payload) => {
        this.sniperFiredHandlers.forEach((handler) => handler({
          shooterId: room.sessionId,
          x: Number.NaN,
          y: Number.NaN,
          hitId: "",
          readyAt: Number(payload?.readyAt ?? 0),
          serverNow: Number(payload?.serverNow ?? Date.now()),
        }));
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
        /*
         * V1010441_LOCAL_SHOT_FOUND_IDS / HIT_ID_LEDGER
         * This message is server-authoritative.  Because it contains shooterId,
         * each Hunter can deterministically remember only their own catches.
         */
        if (
          String(shot?.shooterId ?? "") ===
          String(room.sessionId ?? "") &&
          Array.isArray(shot?.hitIds)
        ) {
          shot.hitIds.forEach(
            (sessionId) => {
              const id =
                String(sessionId ?? "");
              if (id) {
                this.personalVictoryFoundSessionIds.add(id);
              }
            },
          );
        }

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


    room.onMessage<{
      entry?: any;
      count?: number;
    }>(
      "hunter_personal_found",
      (payload) => {
        const entry =
          payload?.entry;

        if (
          !entry ||
          !String(
            entry.sessionId ??
              "",
          )
        ) {
          return;
        }

        const exists =
          this.personalVictoryFoundHiders
            .some(
              (current) =>
                String(
                  current?.sessionId ??
                    "",
                ) ===
                String(
                  entry.sessionId,
                ),
            );

        if (!exists) {
          this.personalVictoryFoundHiders
            .push(entry);
        }
      },
    );

    room.onMessage<
      NetworkRoundResult
    >(
      "round_result",
      (result) => {
        /*
         * V1010445_FOUND_RUNTIME_TRACE_CLIENT
         * Temporary runtime trace.  This tells us what the deployed browser
         * actually received, before any victory-card transformation.
         */
        console.log(
          "[V445 CLIENT ROUND_RESULT]",
          {
            winner:
              result?.winner,
            reason:
              result?.reason,
            teamFoundCount:
              Array.isArray(
                result?.victoryShowcase
                  ?.foundHiders,
              )
                ? result.victoryShowcase
                    ?.foundHiders?.length
                : -1,
            personalFoundCount:
              Array.isArray(
                result?.victoryShowcase
                  ?.personalFoundHiders,
              )
                ? result.victoryShowcase
                    ?.personalFoundHiders?.length
                : -1,
            recipientSessionId:
              result?.victoryShowcase
                ?.recipientSessionId,
            recipientClientKey:
              result?.victoryShowcase
                ?.recipientClientKey,
            foundHiders:
              result?.victoryShowcase
                ?.foundHiders,
            personalFoundHiders:
              result?.victoryShowcase
                ?.personalFoundHiders,
          },
        );
        const personalized =
          result.victoryShowcase
            ?.personalFoundHiders;

        const authoritativeTeamFound =
          Array.isArray(
            result.victoryShowcase
              ?.foundHiders,
          )
            ? result.victoryShowcase
                ?.foundHiders ?? []
            : [];

        /*
         * V1010441_LOCAL_SHOT_FOUND_IDS / RESULT_UPGRADE
         * Priority:
         * 1) server recipient-personalized list
         * 2) locally remembered authoritative shot hitIds, upgraded from the
         *    authoritative team FOUND list
         * 3) earlier hunter_personal_found cache
         */
        const shotDerivedPersonal =
          authoritativeTeamFound.filter(
            (entry) =>
              this.personalVictoryFoundSessionIds
                .has(
                  String(
                    entry?.sessionId ?? "",
                  ),
                ),
          );

        const resolvedPersonalFound =
          (
            Array.isArray(personalized) &&
            personalized.length > 0
          )
            ? personalized.map(
                (entry) => ({
                  ...entry,
                }),
              )
            : shotDerivedPersonal.length > 0
              ? shotDerivedPersonal.map(
                  (entry) => ({
                    ...entry,
                  }),
                )
              : this.personalVictoryFoundHiders
                  .map(
                    (entry) => ({
                      ...entry,
                    }),
                  );

        this.personalVictoryFoundHiders =
          resolvedPersonalFound;

        /*
         * V1010443_FREEZE_PERSONAL_FOUND_IN_ROUND_RESULT
         * Freeze personal ownership inside the round_result itself BEFORE
         * GameScene begins asynchronous poster capture.  reset_round may clear
         * live caches later, but this immutable result payload remains correct.
         */
        if (
          resolvedPersonalFound.length > 0
        ) {
          result.victoryShowcase = {
            ...(
              result.victoryShowcase ??
              {}
            ),
            personalFoundHiders:
              resolvedPersonalFound,
          };
        }

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
        this.personalVictoryFoundHiders =
          [];
        this.personalVictoryFoundSessionIds
          .clear();

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
          /*
           * V1010468_FAST_MOBILE_FOREGROUND_RECONNECT / FASTER_POST_LEAVE_RETRIES
           * The first fresh handoff above is immediate. If radio/DNS is still
           * waking, retry quickly during the first few seconds, then back off.
           */
          const retryDelays = backgroundTabRecovery
            ? [350, 1000, 2200, 4500, 9000, 18000, 30000]
            : [500, 1400, 3200, 7000, 15000];

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
        console.error(
          "[Chameleon Hunt] Room error",
          {
            code,
            message,
          },
        );

        if (
          this.isSeatReservationExpired(
            code,
            message,
          )
        ) {
          /*
           * V1010372_SEAT_EXPIRED_FRESH_REJOIN / TERMINAL_524
           *
           * The old token cannot recover anymore. Move immediately to the
           * stable clientKey fresh-join handoff instead of waiting for dozens
           * of doomed reconnect attempts.
           */
          this.recoverExpiredSeat(
            room,
          );
        }
      },
    );
  }

  sendMove(
    x: number,
    y: number,
  ): void {
    if (
      !this.room ||
      !this.isGameplayTransportStable() ||
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

  sendSniperToggle(active: boolean): void {
    if (!this.isGameplayTransportStable()) return;
    this.room?.send("sniper_toggle", { active });
  }

  sendSniperAim(x: number, y: number): void {
    if (!this.isGameplayTransportStable()) return;
    this.room?.send("sniper_aim", { x, y });
  }

  sendSniperFire(x: number, y: number): void {
    if (!this.isGameplayTransportStable()) return;
    this.room?.send("sniper_fire", { x, y });
  }

  sendVulcanToggle(active: boolean): void {
    if (!this.isGameplayTransportStable()) return;
    this.room?.send('vulcan_toggle', { active });
  }

  sendVulcanAim(x: number, y: number): void {
    if (!this.isGameplayTransportStable()) return;
    this.room?.send('vulcan_aim', { x, y });
  }

  sendVulcanFire(x: number, y: number): void {
    if (!this.isGameplayTransportStable()) return;
    this.room?.send('vulcan_fire', { x, y });
  }

  sendVulcanFireStart(): void {
    if (!this.isGameplayTransportStable()) return;
    this.room?.send('vulcan_fire_start', {});
  }

  sendVulcanFireStop(): void {
    if (!this.isGameplayTransportStable()) return;
    this.room?.send('vulcan_fire_stop', {});
  }

  sendHunterAim(
    angle: number,
  ): void {
    /*
     * V1010340C_MULTIPLAYER_TRANSPORT_HARDENING_FINAL / AIM_THROTTLE
     *
     * Gaming mice can produce hundreds of pointer events each second.
     * Ordinary aim updates are limited to ~15Hz, while large turns bypass.
     */
    if (
      !this.room ||
      !this.isGameplayTransportStable() ||
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
        66 &&
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
    if (
      !this.isGameplayTransportStable()
    ) {
      return;
    }

    this.room?.send(
      "fire_shot",
      {
        angle,
      },
    );
  }

  sendFart(): void {
    if (
      !this.isGameplayTransportStable()
    ) {
      return;
    }

    this.room?.send(
      'fart_use',
      {
        pressedAt:
          Date.now(),
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

  sendSkillSelection(
    skillId: PlayerSkillId,
  ): void {
    if (
      skillId !== "paintball" &&
      skillId !== "laser"
    ) return;

    this.selectedSkill = skillId;
    this.room?.send("skill_select", { skillId });
  }

  requestSkillState(): void {
    this.room?.send("request_skill_state", {});
  }

  getSelectedSkill(): PlayerSkillId {
    return this.selectedSkill;
  }

  onSkillState(
    handler: SkillStateHandler,
  ): () => void {
    this.skillStateHandlers.add(handler);
    return () => this.skillStateHandlers.delete(handler);
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

  requestRoundPaintState(
    force = false,
  ): void {
    if (!this.room) {
      return;
    }

    const now =
      Date.now();

    if (
      !force &&
      now -
        this.lastRoundPaintStateRequestAt <
        this.roundPaintStateRequestMinIntervalMs
    ) {
      return;
    }

    this.lastRoundPaintStateRequestAt =
      now;

    this.room.send(
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
    this.room.send(
      "restore_local_paint",
      {
        strokes:
          /*
           * V1010339C_CRITICAL_ROUND_STABILITY_CLIENT / FULL_ROUND_PAINT
           * Dense full-body camouflage can exceed 240 strokes.
           */
          strokes.slice(
            0,
            500,
          ),
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

  onSniperState(handler: SniperStateHandler): () => void {
    this.sniperStateHandlers.add(handler);
    return () => this.sniperStateHandlers.delete(handler);
  }

  onSniperAim(handler: SniperAimHandler): () => void {
    this.sniperAimHandlers.add(handler);
    return () => this.sniperAimHandlers.delete(handler);
  }

  onSniperFired(handler: SniperFiredHandler): () => void {
    this.sniperFiredHandlers.add(handler);
    return () => this.sniperFiredHandlers.delete(handler);
  }

  onVulcanState(handler: VulcanStateHandler): () => void {
    this.vulcanStateHandlers.add(handler);
    return () => this.vulcanStateHandlers.delete(handler);
  }

  onVulcanAim(handler: VulcanAimHandler): () => void {
    this.vulcanAimHandlers.add(handler);
    return () => this.vulcanAimHandlers.delete(handler);
  }

  onVulcanFired(handler: VulcanFiredHandler): () => void {
    this.vulcanFiredHandlers.add(handler);
    return () => this.vulcanFiredHandlers.delete(handler);
  }


  onVulcanFiringState(handler: VulcanFiringStateHandler): () => void {
    this.vulcanFiringStateHandlers.add(handler);
    return () => this.vulcanFiringStateHandlers.delete(handler);
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

  /*
   * V1010438_PERSONAL_FOUND_VISUAL_AND_FOLD_CLOSE / PUBLIC_STABLE_ID
   * Read-only identity for UI attribution. It uses the SAME key already sent
   * to the server for reconnect handoff.
   */
  getStableClientKeyForUi(): string {
    return this.getStableClientKey();
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
