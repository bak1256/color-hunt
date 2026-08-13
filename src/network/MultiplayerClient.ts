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

  private readonly huntersOutOfAmmoHandlers =
    new Set<HuntersOutOfAmmoHandler>();

  private readonly playerDisconnectedHandlers =
    new Set<PlayerDisconnectedHandler>();

  private readonly roundAbortedHandlers =
    new Set<RoundAbortedHandler>();

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
    await this.disconnect();

    const joinPromise =
      this.client.joinById<
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

    /*
     * 로비 목록이 갱신되기 직전에 사라진 방을 누르는 경우,
     * 일부 환경에서 joinById가 즉시 reject되지 않고 오래 pending될 수 있습니다.
     * UI가 영원히 "방에 참가하는 중..."에 머물지 않도록 hard timeout을 둡니다.
     */
    let timedOut = false;

    const timeoutPromise =
      new Promise<never>(
        (_, reject) => {
          globalThis.setTimeout(
            () => {
              timedOut = true;
              reject(
                new Error(
                  "ROOM_JOIN_TIMEOUT_OR_MISSING",
                ),
              );
            },
            5000,
          );
        },
      );

    let room:
      Room<NetworkGameState>;

    try {
      room =
        await Promise.race([
          joinPromise,
          timeoutPromise,
        ]);
    } catch (error) {
      /*
       * timeout 뒤 아주 늦게 join이 성공하더라도 유령 연결을 남기지 않습니다.
       */
      if (timedOut) {
        void joinPromise
          .then(
            (lateRoom) =>
              lateRoom.leave(),
          )
          .catch(() => {
            // 이미 서버에서 거절된 경우 정리할 것이 없습니다.
          });
      }

      throw error;
    }

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

private attachRoom(
    room: Room<NetworkGameState>,
  ): void {
    this.snapshotPlayers.clear();
    this.snapshotHostId = "";
    this.snapshotSelectedMap = "random";
    this.snapshotActiveMap = "forest";

    this.room = room;
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
    this.phaseChangedHandlers
      .forEach(
        (handler) => {
          try {
            handler(
              room.state?.phase ??
                "lobby",
              room.state
                ?.phaseEndsAt ?? 0,
            );
          } catch (error) {
            console.error(
              "[Chameleon Hunt] Initial phase replay handler failed",
              error,
            );
          }
        },
      );

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
    this.requestLobbySnapshot();

    globalThis.setTimeout(
      () => {
        if (this.room === room) {
          this.requestLobbySnapshot();
        }
      },
      120,
    );

    globalThis.setTimeout(
      () => {
        if (this.room === room) {
          this.requestLobbySnapshot();
        }
      },
      450,
    );

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

        this.phaseChangedHandlers
          .forEach(
            (handler) => {
              handler(
                phase,
                Number.isFinite(
                  phaseEndsAt,
                )
                  ? phaseEndsAt
                  : 0,
              );
            },
          );
      },
    );

    if (room.state) {
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

  sendStartGame(): void {
    this.room?.send(
      "start_game",
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
