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

export type NetworkShotFired = {
  shooterId: string;
  startX: number;
  startY: number;
  pellets: Array<{
    endX: number;
    endY: number;
  }>;
  hitIds: string[];
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
};

export type WeaponStateHandler = (
  state: NetworkWeaponState,
) => void;

export type ResetRoundHandler =
  () => void;

export type NetworkRoundResult = {
  winner: "hunters" | "hiders";
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

export type NetworkGameState = {
  gameName: string;
  roomTitle: string;
  isPrivate: boolean;
  phase: NetworkGamePhase;
  phaseEndsAt: number;
  hunterCount: number;
  hostId: string;
  hunterId: string;
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

export class MultiplayerClient {
  private readonly client: Client;
  private readonly serverUrl: string;
  private room?: Room<NetworkGameState>;
  private callbacks?: ReturnType<
    typeof Callbacks.get
  >;

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

  private readonly shotFiredHandlers =
    new Set<ShotFiredHandler>();

  private readonly hunterAimHandlers =
    new Set<HunterAimHandler>();

  private readonly weaponStateHandlers =
    new Set<WeaponStateHandler>();

  private readonly resetRoundHandlers =
    new Set<ResetRoundHandler>();

  private readonly roundResultHandlers =
    new Set<RoundResultHandler>();

  private readonly phaseChangedHandlers =
    new Set<PhaseChangedHandler>();

  private readonly startGameErrorHandlers =
    new Set<StartGameErrorHandler>();

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

    this.attachRoom(room);
    return room;
  }

  async joinRoomById(
    roomId: string,
    options: JoinRoomOptions,
  ): Promise<
    Room<NetworkGameState>
  > {
    await this.disconnect();

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
        },
      );

    this.attachRoom(room);
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

  private attachRoom(
    room: Room<NetworkGameState>,
  ): void {
    this.room = room;
    this.callbacks =
      Callbacks.get(room);

    this.registerRoomCallbacks(
      room,
      this.callbacks,
    );

    this.emitConnectionChanged(true);

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
    callbacks: ReturnType<
      typeof Callbacks.get
    >,
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

    callbacks.onChange(
      room.state,
      () => {
        this.phaseChangedHandlers
          .forEach(
            (handler) => {
              handler(
                room.state.phase,
                room.state
                  .phaseEndsAt,
              );
            },
          );
      },
    );

    room.onMessage<{
      message?: string;
    }>(
      "start_game_error",
      (payload) => {
        const message =
          payload.message ??
          "게임을 시작할 수 없습니다.";

        this.startGameErrorHandlers
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
          },
        );

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

  sendStartGame(): void {
    this.room?.send(
      "start_game",
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
    return (
      this.room?.state.hostId ===
      this.room?.sessionId
    );
  }

  getPhase(): NetworkGamePhase {
    return (
      this.room?.state.phase ??
      "lobby"
    );
  }

  getPhaseEndsAt(): number {
    return (
      this.room?.state
        .phaseEndsAt ?? 0
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

    return room.state.players
      .get(room.sessionId);
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

    this.room = undefined;
    this.callbacks = undefined;

    await room.leave();

    this.emitConnectionChanged(
      false,
    );
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
