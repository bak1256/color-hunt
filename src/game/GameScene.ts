import Phaser from 'phaser';
import {
    multiplayerClient,
    type NetworkBrushShape,
    type NetworkPaintPoint,
    type NetworkPaintStroke,
    type NetworkPlayerState,
    type NetworkShotFired,
    type NetworkHunterAim,
    type NetworkWeaponState,
    type NetworkRoundResult,
    type PublicRoomInfo,
} from '../network/MultiplayerClient';
import { NetworkPlayerManager } from '../multiplayer/NetworkPlayerManager';

type GamePhase =
    | 'lobby'
    | 'countdown'
    | 'paint'
    | 'hunt'
    | 'hunterVictory'
    | 'hiderVictory';

type BrushShape = 'dotCircle' | 'circle' | 'square';

type HiderPartObject =
    | Phaser.GameObjects.Arc
    | Phaser.GameObjects.Rectangle;

type HunterVisual = {
    object: HiderPartObject;
    offsetX: number;
    offsetY: number;
};

type Hider = {
    centerX: number;
    centerY: number;
    alive: boolean;

    head: Phaser.GameObjects.Arc;
    body: Phaser.GameObjects.Rectangle;
    leftArm: Phaser.GameObjects.Rectangle;
    rightArm: Phaser.GameObjects.Rectangle;
    leftLeg: Phaser.GameObjects.Rectangle;
    rightLeg: Phaser.GameObjects.Rectangle;

    label: Phaser.GameObjects.Text;

    paintTexture: Phaser.GameObjects.RenderTexture;
    paintMaskShape: Phaser.GameObjects.Graphics;
    paintMask: Phaser.Display.Masks.GeometryMask;
};

type Obstacle = {
    object: Phaser.GameObjects.Rectangle;
    bounds: Phaser.Geom.Rectangle;
};

export class GameScene extends Phaser.Scene {
    private readonly gameWidth = 960;
    private readonly gameHeight = 540;

    private phase: GamePhase = 'lobby';

    /*
     * Hunter
     */
    private player!: Phaser.GameObjects.Rectangle;
    private gun!: Phaser.GameObjects.Rectangle;
    private hunterLabel!: Phaser.GameObjects.Text;
    private hunterVisuals: HunterVisual[] = [];

    private readonly playerSpeed = 240;

    /*
     * Keyboard
     */
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

    private moveUpKey!: Phaser.Input.Keyboard.Key;
    private moveDownKey!: Phaser.Input.Keyboard.Key;
    private moveLeftKey!: Phaser.Input.Keyboard.Key;
    private moveRightKey!: Phaser.Input.Keyboard.Key;

    private reloadKey!: Phaser.Input.Keyboard.Key;

    private brushIncreaseKey!: Phaser.Input.Keyboard.Key;
    private brushDecreaseKey!: Phaser.Input.Keyboard.Key;
    private brushShapeKey!: Phaser.Input.Keyboard.Key;

    /*
     * Hiders
     */
    private hiders: Hider[] = [];
    private selectedHiderIndex = 0;

    private selectionRing!: Phaser.GameObjects.Arc;

    private readonly hiderSpeed = 140;

    /*
     * Background and obstacles
     */
    private backgroundImage!: Phaser.GameObjects.Image;
    private obstacles: Obstacle[] = [];

    /*
     * Painting
     */
    private readonly defaultPaintColor = 0x000000;
    private paintColor = this.defaultPaintColor;

    private brushSize = 4;
    private brushShape: BrushShape = 'dotCircle';
    private isPainting = false;

    private paintPreview!: Phaser.GameObjects.Graphics;
    private brushTextureKey = 'paint-brush';

    /*
     * Aiming
     */
    private aimLine!: Phaser.GameObjects.Graphics;
    private crosshair!: Phaser.GameObjects.Graphics;

    /*
     * Shotgun
     */
    private ammo = 5;
    private readonly maxAmmo = 5;

    private canShoot = true;
    private isReloading = false;

    private readonly shotCooldown = 450;
    private readonly reloadDuration = 1500;

    private readonly pelletCount: number = 7;
    private readonly pelletRange = 300;
    private readonly pelletSpread = Phaser.Math.DegToRad(18);

    private hitMarker!: Phaser.GameObjects.Graphics;

    /*
     * Timer
     */
    private readonly paintDuration = 45;
    private readonly huntDuration = 30;

    private phaseEndTime = 0;

    /*
     * HUD
     */
    private phaseText!: Phaser.GameObjects.Text;
    private timerText!: Phaser.GameObjects.Text;
    private guideText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    private ammoText!: Phaser.GameObjects.Text;
    private targetText!: Phaser.GameObjects.Text;

    private paintColorText!: Phaser.GameObjects.Text;
    private brushSizeText!: Phaser.GameObjects.Text;
    private paletteObjects: Phaser.GameObjects.GameObject[] = [];
    private paintZoomText!: Phaser.GameObjects.Text;
    private paintControlHelpText!: Phaser.GameObjects.Text;

    /*
     * Multiplayer
     */
    private multiplayerText!: Phaser.GameObjects.Text;
    private lobbyPanel!: Phaser.GameObjects.Rectangle;
    private lobbyTitleText!: Phaser.GameObjects.Text;
    private lobbyInfoText!: Phaser.GameObjects.Text;
    private startGameButton!: Phaser.GameObjects.Text;
    private roleHunterButton!: Phaser.GameObjects.Text;
    private roleHiderButton!: Phaser.GameObjects.Text;
    private mainMenuObjects: Phaser.GameObjects.GameObject[] = [];
    private roomListObjects: Phaser.GameObjects.GameObject[] = [];
    private hunterBlindPanel!: Phaser.GameObjects.Rectangle;
    private hunterBlindText!: Phaser.GameObjects.Text;
    private countdownPanel!: Phaser.GameObjects.Rectangle;
    private countdownText!: Phaser.GameObjects.Text;
    private weaponHeat = 0;
    private weaponHeatUpdatedAt = 0;
    private weaponOverheatedUntil = 0;
    private paintWorldZoom = 1;
    private lastHunterAimSentAt = 0;
    private readonly hunterAimSendInterval = 50;
    private backgroundBaseX = 0;
    private backgroundBaseY = 0;
    private networkPlayerCount = 0;
    private networkUnsubscribers: Array<() => void> = [];
    private networkPlayerManager!: NetworkPlayerManager;
    private activeStrokePoints: NetworkPaintPoint[] = [];
    private activeStrokeTargetSessionId = '';
    private readonly remoteBrushTexturePrefix =
        'remote-paint-brush';

    constructor() {
        super('GameScene');
    }

    preload(): void {
        this.load.image(
            'forest-background',
            '/assets/backgrounds/forest-01.png',
        );
    }

    create(): void {
        this.createImageBackground();
        this.createObstacles();

        this.createHunter();
        this.createHiders();
        this.createSelectionRing();

        this.createAimObjects();
        this.createHitMarker();

        this.createKeyboardControls();
        this.createHud();

        this.createPaintTools();
        this.createPaintPalette();
        this.createPointerControls();

        this.createMultiplayerHud();
        this.createLobbyUi();
        this.createHunterBlindUi();
        this.createCountdownUi();

        this.networkPlayerManager = new NetworkPlayerManager(
            this,
            this.gameWidth,
            this.gameHeight,
        );

        this.registerMultiplayerEvents();
        this.enterLobbyPhase();
        this.showMainMenu();
    }

    update(_: number, delta: number): void {
        this.updateRoundTimer();
        this.updateCountdownUi();
        this.updateWeaponHeatHud();
        this.updateNetworkPlayers(delta);

        if (this.phase === 'paint') {
            if (!multiplayerClient.isConnected()) {
                this.updateSelectedHiderMovement(delta);
            }
            this.updateBrushSizeInput();

            if (
                Phaser.Input.Keyboard.JustDown(
                    this.brushShapeKey,
                )
            ) {
                this.toggleBrushShape();
            }
        }

        if (this.phase === 'hunt') {
            if (!multiplayerClient.isConnected()) {
                this.updateHunterMovement(delta);
            }
            this.updateAim();

            if (
                !multiplayerClient.isConnected() &&
                Phaser.Input.Keyboard.JustDown(
                    this.reloadKey,
                )
            ) {
                this.reload();
            }
        }
    }

    /*
     * Multiplayer
     */

    private createMultiplayerHud(): void {
        this.multiplayerText = this.add
            .text(
                this.gameWidth - 16,
                16,
                'MULTI · CONNECTING...',
                {
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: '#fff4d6',
                    padding: {
                        x: 9,
                        y: 6,
                    },
                    align: 'right',
                },
            )
            .setOrigin(1, 0)
            .setDepth(310);
    }

    private registerMultiplayerEvents(): void {
        this.networkUnsubscribers.push(
            multiplayerClient.onPlayerAdded(
                (
                    sessionId: string,
                    player: NetworkPlayerState,
                ) => {
                    this.networkPlayerCount =
                        multiplayerClient.getRoom()
                            ?.state.players.size ?? 0;
                    this.networkPlayerManager.addPlayer(
                        sessionId,
                        player,
                    );

                    console.log(
                        '[Chameleon Hunt] Player added',
                        sessionId,
                        player.name,
                        player.role,
                    );

                    this.updateMultiplayerHud();
                },
            ),
        );

        this.networkUnsubscribers.push(
            multiplayerClient.onPlayerRemoved(
                (
                    sessionId: string,
                    player: NetworkPlayerState,
                ) => {
                    this.networkPlayerCount =
                        multiplayerClient.getRoom()
                            ?.state.players.size ?? 0;
                    this.networkPlayerManager.removePlayer(
                        sessionId,
                    );

                    console.log(
                        '[Chameleon Hunt] Player removed',
                        sessionId,
                        player.name,
                    );

                    this.updateMultiplayerHud();
                },
            ),
        );

        this.networkUnsubscribers.push(
            multiplayerClient.onPlayerChanged(
                (
                    sessionId: string,
                    player: NetworkPlayerState,
                ) => {
                    this.networkPlayerManager.updatePlayer(
                        sessionId,
                        player,
                    );

                    if (
                        sessionId ===
                        multiplayerClient.getSessionId()
                    ) {
                        this.updateMultiplayerHud();
                        this.updateLobbyUi();
                    }
                },
            ),
        );

        this.networkUnsubscribers.push(
            multiplayerClient.onPaintStroke(
                (stroke: NetworkPaintStroke) => {
                    this.applyRemotePaintStroke(stroke);
                },
            ),
        );

        this.networkUnsubscribers.push(
            multiplayerClient.onWeaponState(
                (
                    state: NetworkWeaponState,
                ) => {
                    this.weaponHeat =
                        state.heat;

                    this.weaponHeatUpdatedAt =
                        state.updatedAt;

                    this.weaponOverheatedUntil =
                        state.overheatedUntil;

                    this.updateWeaponHeatHud();
                },
            ),
        );

        this.networkUnsubscribers.push(
            multiplayerClient.onRoundResult(
                (
                    result: NetworkRoundResult,
                ) => {
                    this.handleNetworkRoundResult(
                        result,
                    );
                },
            ),
        );

        this.networkUnsubscribers.push(
            multiplayerClient.onResetRound(
                () => {
                    this.networkPlayerManager
                        .setLocalHunterCustomizationMode(
                            false,
                        );

                    this.networkPlayerManager
                        .clearAllPaint();

                    this.networkPlayerManager
                        .clearRevealMarkers();

                    this.networkPlayerManager
                        .setNamesVisible(true);

                    this.resetPaintWorldZoom();

                    this.weaponHeat = 0;
                    this.weaponHeatUpdatedAt =
                        Date.now();
                    this.weaponOverheatedUntil = 0;
                    this.clearStatus();
                },
            ),
        );

        this.networkUnsubscribers.push(
            multiplayerClient.onHunterAim(
                (
                    aim: NetworkHunterAim,
                ) => {
                    this.networkPlayerManager
                        .updateHunterAim(
                            aim.sessionId,
                            aim.angle,
                            aim.range,
                        );
                },
            ),
        );

        this.networkUnsubscribers.push(
            multiplayerClient.onShotFired(
                (shot: NetworkShotFired) => {
                    this.applyNetworkShot(shot);
                },
            ),
        );

        this.networkUnsubscribers.push(
            multiplayerClient.onPhaseChanged(
                (
                    phase,
                    phaseEndsAt,
                ) => {
                    this.applyNetworkPhase(
                        phase,
                        phaseEndsAt,
                    );
                },
            ),
        );

        this.networkUnsubscribers.push(
            multiplayerClient.onStartGameError(
                (message: string) => {
                    this.showStatus(message);
                },
            ),
        );

        this.networkUnsubscribers.push(
            multiplayerClient.onConnectionChanged(
                (connected: boolean) => {
                    if (!connected) {
                        this.setHunterPaintBlind(false);
                        this.multiplayerText
                            .setText('MULTI · DISCONNECTED')
                            .setColor('#a33b3b');
                    }
                },
            ),
        );

        this.events.once(
            Phaser.Scenes.Events.SHUTDOWN,
            () => {
                this.networkUnsubscribers.forEach(
                    (unsubscribe) => {
                        unsubscribe();
                    },
                );

                this.networkUnsubscribers = [];
                this.networkPlayerManager.destroy();
            },
        );
    }

    private getSavedPlayerName(): string {
        const savedName =
            localStorage.getItem(
                'chameleon-hunt-player-name',
            );

        if (savedName) {
            return savedName;
        }

        const generatedName =
            `Player-${Phaser.Math.Between(
                1000,
                9999,
            )}`;

        localStorage.setItem(
            'chameleon-hunt-player-name',
            generatedName,
        );

        return generatedName;
    }

    private async createGameRoom(
        isPrivate: boolean,
    ): Promise<void> {
        const playerName =
            window.prompt(
                '닉네임을 입력하세요.',
                this.getSavedPlayerName(),
            )?.trim();

        if (!playerName) {
            return;
        }

        localStorage.setItem(
            'chameleon-hunt-player-name',
            playerName,
        );

        const roomTitle =
            window.prompt(
                '방 이름을 입력하세요.',
                'Chameleon Room',
            )?.trim();

        if (!roomTitle) {
            return;
        }

        const password =
            isPrivate
                ? window.prompt(
                    '비밀번호를 입력하세요.',
                    '',
                ) ?? ''
                : '';

        if (
            isPrivate &&
            password.length === 0
        ) {
            return;
        }

        let room;

        try {
            room =
                await multiplayerClient
                    .createRoom({
                        playerName,
                        roomTitle,
                        isPrivate,
                        password,
                    });
        } catch (error) {
            console.error(
                '방 생성 요청 실패:',
                error,
            );

            window.alert(
                '방을 생성하지 못했습니다.',
            );

            return;
        }

        try {
            this.handleJoinedRoom(room);
        } catch (error) {
            console.error(
                '방 생성 후 화면 전환 실패:',
                error,
            );

            // 방 연결은 성공한 상태이므로 실패 알림을 띄우지 않습니다.
            this.clearMainMenuObjects();
            this.multiplayerText.setVisible(true);
            this.enterLobbyPhase();
            this.updateMultiplayerHud();
            this.updateLobbyUi();
        }
    }

    private async joinPublicRoom(
        roomId: string,
    ): Promise<void> {
        const playerName =
            window.prompt(
                '닉네임을 입력하세요.',
                this.getSavedPlayerName(),
            )?.trim();

        if (!playerName) {
            return;
        }

        localStorage.setItem(
            'chameleon-hunt-player-name',
            playerName,
        );

        let room;

        try {
            room =
                await multiplayerClient
                    .joinRoomById(
                        roomId,
                        {
                            playerName,
                        },
                    );
        } catch (error) {
            console.error(
                '방 참가 요청 실패:',
                error,
            );

            window.alert(
                '방에 참가하지 못했습니다.',
            );

            return;
        }

        this.handleJoinedRoomSafely(room);
    }

    private async joinPrivateRoom(): Promise<void> {
        const roomId =
            window.prompt(
                '방 ID를 입력하세요.',
                '',
            )?.trim();

        if (!roomId) {
            return;
        }

        const password =
            window.prompt(
                '비밀번호를 입력하세요.',
                '',
            ) ?? '';

        const playerName =
            window.prompt(
                '닉네임을 입력하세요.',
                this.getSavedPlayerName(),
            )?.trim();

        if (!playerName) {
            return;
        }

        localStorage.setItem(
            'chameleon-hunt-player-name',
            playerName,
        );

        let room;

        try {
            room =
                await multiplayerClient
                    .joinRoomById(
                        roomId,
                        {
                            playerName,
                            password,
                        },
                    );
        } catch (error) {
            console.error(
                '비공개방 참가 요청 실패:',
                error,
            );

            window.alert(
                '방 ID 또는 비밀번호를 확인하세요.',
            );

            return;
        }

        this.handleJoinedRoomSafely(room);
    }

    private handleJoinedRoomSafely(
        room: NonNullable<
            ReturnType<
                typeof multiplayerClient.getRoom
            >
        >,
    ): void {
        try {
            this.handleJoinedRoom(room);
        } catch (error) {
            console.error(
                '방 입장 후 화면 전환 실패:',
                error,
            );

            this.clearMainMenuObjects();
            this.multiplayerText.setVisible(true);
            this.enterLobbyPhase();
            this.updateMultiplayerHud();
            this.updateLobbyUi();
        }
    }

    private handleJoinedRoom(
        room: NonNullable<
            ReturnType<
                typeof multiplayerClient.getRoom
            >
        >,
    ): void {
        this.clearMainMenuObjects();
        this.multiplayerText.setVisible(true);

        this.networkPlayerCount =
            room.state.players?.size ?? 1;

        /*
         * 기본 생성은 onAdd 콜백이 담당합니다.
         * 다만 이미 적용된 초기 Schema 항목이 있으면 한 번 더
         * 정확한 서버 좌표로 보정합니다.
         */
        room.state.players?.forEach?.(
            (
                player: NetworkPlayerState,
                sessionId: string,
            ) => {
                this.networkPlayerManager
                    .updatePlayer(
                        sessionId,
                        player,
                    );
            },
        );

        this.applyNetworkPhase(
            room.state.phase ?? 'lobby',
            room.state.phaseEndsAt ?? 0,
        );

        this.updateMultiplayerHud();
        this.updateLobbyUi();
        this.hideLegacySinglePlayerActors();
        this.clearStatus();

        console.log(
            '[Chameleon Hunt] Joined room',
            {
                roomId: room.roomId,
                sessionId: room.sessionId,
                roomTitle:
                    room.state.roomTitle,
            },
        );
    }

    private updateNetworkPlayers(
        delta: number,
    ): void {
        if (multiplayerClient.isConnected()) {
            this.hideLegacySinglePlayerActors();
        }

        if (
            !multiplayerClient.isConnected() ||
            !this.networkPlayerManager
        ) {
            return;
        }

        if (
            this.networkPlayerManager
                .isLocalCustomizationMode()
        ) {
            /*
             * Hunter 중앙 색칠 모드에서는 키 입력과
             * 이동 패킷 전송을 모두 중지합니다.
             */
            this.networkPlayerManager.update();
            return;
        }

        let directionX = 0;
        let directionY = 0;

        if (
            this.moveLeftKey.isDown ||
            this.cursors.left.isDown
        ) {
            directionX -= 1;
        }

        if (
            this.moveRightKey.isDown ||
            this.cursors.right.isDown
        ) {
            directionX += 1;
        }

        if (
            this.moveUpKey.isDown ||
            this.cursors.up.isDown
        ) {
            directionY -= 1;
        }

        if (
            this.moveDownKey.isDown ||
            this.cursors.down.isDown
        ) {
            directionY += 1;
        }

        this.networkPlayerManager.moveLocalPlayer(
            directionX,
            directionY,
            delta,
        );

        this.networkPlayerManager.update();
    }

    private hideLegacySinglePlayerActors(): void {
        this.player.setVisible(false);

        this.hunterVisuals.forEach(
            ({ object }) => {
                object.setVisible(false);
            },
        );

        this.gun.setVisible(false);
        this.hunterLabel.setVisible(false);
        this.selectionRing.setVisible(false);

        this.hiders.forEach((hider) => {
            this.setHiderVisible(hider, false);
            hider.label.setVisible(false);
        });
    }

    private makeMenuButton(
        x: number,
        y: number,
        label: string,
        onClick: () => void,
    ): Phaser.GameObjects.Text {
        const button = this.add
            .text(
                x,
                y,
                label,
                {
                    fontFamily: 'monospace',
                    fontSize: '19px',
                    fontStyle: 'bold',
                    color: '#fffdf3',
                    backgroundColor: '#5c8f66',
                    padding: {
                        x: 22,
                        y: 11,
                    },
                },
            )
            .setOrigin(0.5)
            .setDepth(502)
            .setInteractive({
                useHandCursor: true,
            });

        button.on(
            'pointerdown',
            onClick,
        );

        button.on(
            'pointerover',
            () => {
                button.setScale(1.05);
            },
        );

        button.on(
            'pointerout',
            () => {
                button.setScale(1);
            },
        );

        return button;
    }

    private showMainMenu(): void {
        this.clearMainMenuObjects();
        this.enterLobbyPhase();
        this.updateLobbyUi();

        this.lobbyPanel.setVisible(false);
        this.lobbyTitleText.setVisible(false);
        this.lobbyInfoText.setVisible(false);
        this.startGameButton.setVisible(false);
        this.roleHunterButton?.setVisible(false);
        this.roleHiderButton?.setVisible(false);

        this.multiplayerText.setVisible(false);

        const panel = this.add
            .rectangle(
                this.gameWidth / 2,
                this.gameHeight / 2,
                700,
                460,
                0xfff4d6,
                0.97,
            )
            .setStrokeStyle(
                5,
                0x6f8f65,
                1,
            )
            .setDepth(500);

        const title = this.add
            .text(
                this.gameWidth / 2,
                78,
                'CHAMELEON HUNT',
                {
                    fontFamily: 'monospace',
                    fontSize: '38px',
                    fontStyle: 'bold',
                    color: '#476348',
                },
            )
            .setOrigin(0.5)
            .setDepth(501);

        const subtitle = this.add
            .text(
                this.gameWidth / 2,
                124,
                '위장하고, 숨고, 찾아내세요!',
                {
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    color: '#765c49',
                },
            )
            .setOrigin(0.5)
            .setDepth(501);

        const publicCreate =
            this.makeMenuButton(
                280,
                178,
                '공개방 만들기',
                () => {
                    void this.createGameRoom(
                        false,
                    );
                },
            );

        const privateCreate =
            this.makeMenuButton(
                480,
                178,
                '비공개방 만들기',
                () => {
                    void this.createGameRoom(
                        true,
                    );
                },
            );

        const privateJoin =
            this.makeMenuButton(
                680,
                178,
                '비공개방 참가',
                () => {
                    void this.joinPrivateRoom();
                },
            );

        const listTitle = this.add
            .text(
                175,
                230,
                '공개 게임방',
                {
                    fontFamily: 'monospace',
                    fontSize: '20px',
                    fontStyle: 'bold',
                    color: '#476348',
                },
            )
            .setDepth(501);

        const refreshButton =
            this.makeMenuButton(
                760,
                236,
                '새로고침',
                () => {
                    void this.refreshPublicRoomList();
                },
            );

        refreshButton
            .setFontSize(15)
            .setPadding(
                14,
                7,
                14,
                7,
            );

        this.mainMenuObjects.push(
            panel,
            title,
            subtitle,
            publicCreate,
            privateCreate,
            privateJoin,
            listTitle,
            refreshButton,
        );

        void this.refreshPublicRoomList();
    }

    private async refreshPublicRoomList(): Promise<void> {
        this.roomListObjects.forEach(
            (object) => {
                object.destroy();
            },
        );

        this.roomListObjects = [];

        const loading = this.add
            .text(
                175,
                275,
                '방 목록을 불러오는 중...',
                {
                    fontFamily: 'monospace',
                    fontSize: '15px',
                    color: '#765c49',
                },
            )
            .setDepth(503);

        this.roomListObjects.push(
            loading,
        );

        try {
            const rooms =
                (
                    await multiplayerClient
                        .listPublicRooms()
                ).filter(
                    (room: PublicRoomInfo) =>
                        room.metadata
                            ?.isPrivate !== true,
                );

            console.log(
                '[Chameleon Hunt] Public rooms',
                rooms,
            );

            loading.destroy();
            this.roomListObjects = [];

            if (rooms.length === 0) {
                const emptyText =
                    this.add
                        .text(
                            175,
                            275,
                            '생성된 공개방이 없습니다.',
                            {
                                fontFamily: 'monospace',
                                fontSize: '15px',
                                color: '#765c49',
                            },
                        )
                        .setDepth(503);

                this.roomListObjects.push(
                    emptyText,
                );

                return;
            }

            rooms
                .slice(0, 6)
                .forEach(
                    (
                        room: PublicRoomInfo,
                        index: number,
                    ) => {
                        const roomTitle =
                            room.metadata
                                ?.roomTitle ??
                            'Chameleon Room';

                        const phase =
                            room.metadata
                                ?.phase ??
                            'lobby';

                        const row =
                            this.makeMenuButton(
                                this.gameWidth / 2,
                                275 +
                                    index * 45,
                                `${roomTitle}  ·  ${room.clients}/${room.maxClients}  ·  ${phase.toUpperCase()}`,
                                () => {
                                    void this.joinPublicRoom(
                                        room.roomId,
                                    );
                                },
                            );

                        row
                            .setFontSize(15)
                            .setFixedSize(
                                580,
                                36,
                            )
                            .setAlign(
                                'center',
                            );

                        this.roomListObjects.push(
                            row,
                        );
                    },
                );
        } catch (error) {
            console.error(
                '공개방 목록 조회 실패:',
                error,
            );

            loading.setText(
                '방 목록을 불러오지 못했습니다.',
            );
        }
    }

    private clearMainMenuObjects(): void {
        this.mainMenuObjects.forEach(
            (object) => {
                object.destroy();
            },
        );

        this.roomListObjects.forEach(
            (object) => {
                object.destroy();
            },
        );

        this.mainMenuObjects = [];
        this.roomListObjects = [];
    }

    private createLobbyUi(): void {
        this.lobbyPanel = this.add
            .rectangle(
                790,
                this.gameHeight / 2,
                310,
                390,
                0xfff4d6,
                0.96,
            )
            .setStrokeStyle(
                4,
                0x6f8f65,
                1,
            )
            .setDepth(400);

        this.lobbyTitleText = this.add
            .text(
                790,
                95,
                'CHAMELEON HUNT',
                {
                    fontFamily: 'monospace',
                    fontSize: '28px',
                    fontStyle: 'bold',
                    color: '#476348',
                },
            )
            .setOrigin(0.5)
            .setDepth(401);

        this.lobbyInfoText = this.add
            .text(
                790,
                145,
                '서버 연결 중...',
                {
                    fontFamily: 'monospace',
                    fontSize: '17px',
                    color: '#5b4636',
                    align: 'center',
                    lineSpacing: 8,
                },
            )
            .setOrigin(0.5, 0)
            .setDepth(401);

        this.startGameButton = this.add
            .text(
                790,
                430,
                'START GAME',
                {
                    fontFamily: 'monospace',
                    fontSize: '21px',
                    fontStyle: 'bold',
                    color: '#fffdf3',
                    backgroundColor: '#5c8f66',
                    padding: {
                        x: 24,
                        y: 12,
                    },
                },
            )
            .setOrigin(0.5)
            .setDepth(402)
            .setInteractive({
                useHandCursor: true,
            });

        this.startGameButton.on(
            'pointerdown',
            () => {
                if (
                    multiplayerClient.isHost() &&
                    multiplayerClient.getPhase() ===
                        'lobby'
                ) {
                    multiplayerClient.sendStartGame();
                }
            },
        );

        this.startGameButton.on(
            'pointerover',
            () => {
                this.startGameButton.setScale(1.05);
            },
        );

        this.startGameButton.on(
            'pointerout',
            () => {
                this.startGameButton.setScale(1);
            },
        );

        this.roleHunterButton =
            this.makeMenuButton(
                720,
                385,
                'HUNTER 지원',
                () => {
                    const localPlayer =
                        multiplayerClient
                            .getLocalPlayer();

                    multiplayerClient
                        .sendHunterVolunteer(
                            !localPlayer
                                ?.hunterVolunteer,
                        );
                },
            )
                .setDepth(402)
                .setFontSize(17);

        this.roleHiderButton =
            this.makeMenuButton(
                860,
                385,
                '지원 취소',
                () => {
                    multiplayerClient
                        .sendHunterVolunteer(
                            false,
                        );
                },
            )
                .setDepth(402)
                .setFontSize(17);

        this.updateLobbyUi();
    }

    private updateLobbyUi(): void {
        if (!this.lobbyPanel) {
            return;
        }

        const isLobby =
            this.phase === 'lobby';

        this.lobbyPanel.setVisible(isLobby);
        this.lobbyTitleText.setVisible(isLobby);
        this.lobbyInfoText.setVisible(isLobby);
        this.roleHunterButton.setVisible(isLobby);
        this.roleHiderButton.setVisible(isLobby);

        if (!isLobby) {
            this.startGameButton.setVisible(false);
            this.roleHunterButton.setVisible(false);
            this.roleHiderButton.setVisible(false);
            return;
        }

        const roomId =
            multiplayerClient.getRoomId() ??
            '-';

        const localPlayer =
            multiplayerClient.getLocalPlayer();

        const isHost =
            multiplayerClient.isHost();

        this.lobbyInfoText.setText(
            [
                `ROOM  ${roomId}`,
                `TITLE  ${multiplayerClient.getRoom()?.state.roomTitle ?? '-'}`,
                `PLAYERS  ${this.networkPlayerCount} / 10`,
                `현재 역할  ${
                    localPlayer?.role
                        ?.toUpperCase() ??
                    'HIDER'
                }`,
                `Hunter 지원  ${
                    localPlayer
                        ?.hunterVolunteer
                        ? 'ON'
                        : 'OFF'
                }`,
                `시작 시 Hunter 수  ${this.getRecommendedHunterCount(this.networkPlayerCount)}`,
                isHost
                    ? '당신은 방장입니다.'
                    : '방장이 시작하기를 기다리는 중...',
                'WASD로 대기실 캐릭터 이동',
            ].join('\n'),
        );

        this.startGameButton
            .setVisible(isHost)
            .setAlpha(
                this.networkPlayerCount >= 2
                    ? 1
                    : 0.55,
            );

        this.roleHunterButton
            .setText(
                localPlayer
                    ?.hunterVolunteer
                    ? 'HUNTER 지원 중'
                    : 'HUNTER 지원',
            )
            .setAlpha(
                localPlayer
                    ?.hunterVolunteer
                    ? 1
                    : 0.72,
            );

        this.roleHiderButton
            .setAlpha(
                localPlayer
                    ?.hunterVolunteer
                    ? 1
                    : 0.55,
            );

        this.startGameButton.setText(
            this.networkPlayerCount >= 2
                ? 'START GAME'
                : 'WAITING FOR PLAYER',
        );
    }

    private getRecommendedHunterCount(
        playerCount: number,
    ): number {
        if (playerCount >= 9) {
            return 3;
        }

        if (playerCount >= 5) {
            return 2;
        }

        return 1;
    }

    private createCountdownUi(): void {
        this.countdownPanel = this.add
            .rectangle(
                this.gameWidth / 2,
                this.gameHeight / 2,
                this.gameWidth,
                this.gameHeight,
                0x1d2a24,
                0.78,
            )
            .setDepth(960)
            .setVisible(false);

        this.countdownText = this.add
            .text(
                this.gameWidth / 2,
                this.gameHeight / 2,
                '3',
                {
                    fontFamily: 'monospace',
                    fontSize: '110px',
                    fontStyle: 'bold',
                    color: '#fff4d6',
                    align: 'center',
                },
            )
            .setOrigin(0.5)
            .setDepth(961)
            .setVisible(false);
    }

    private updateCountdownUi(): void {
        const isStartCountdown =
            this.phase === 'countdown';

        const isRoundEnd =
            this.phase === 'finished';

        const visible =
            isStartCountdown ||
            isRoundEnd;

        this.countdownPanel.setVisible(
            visible,
        );

        this.countdownText.setVisible(
            visible,
        );

        if (!visible) {
            return;
        }

        if (isRoundEnd) {
            return;
        }

        this.countdownText
            .setFontSize(110);

        const remaining =
            Math.max(
                1,
                Math.ceil(
                    (
                        this.phaseEndTime -
                        this.time.now
                    ) / 1000,
                ),
            );

        this.countdownText.setText(
            String(remaining),
        );
    }

    private updateWeaponHeatHud(): void {
        if (
            !multiplayerClient.isConnected() ||
            this.phase !== 'hunt' ||
            !this.networkPlayerManager
                .isLocalHunter()
        ) {
            return;
        }

        const now = Date.now();
        const elapsed =
            Math.max(
                0,
                now -
                this.weaponHeatUpdatedAt,
            );

        const estimatedHeat =
            Math.max(
                0,
                this.weaponHeat -
                elapsed * 0.025,
            );

        const overheated =
            now <
            this.weaponOverheatedUntil;

        const filled =
            Math.round(
                estimatedHeat / 10,
            );

        const gauge =
            '■'.repeat(filled) +
            '□'.repeat(10 - filled);

        this.ammoText
            .setVisible(true)
            .setText(
                overheated
                    ? `OVERHEATED\n${gauge}`
                    : `HEAT ${Math.round(estimatedHeat)}%\n${gauge}`,
            )
            .setColor(
                overheated
                    ? '#ff776f'
                    : estimatedHeat >= 70
                        ? '#ffcf70'
                        : '#ffffff',
            );
    }

    private createHunterBlindUi(): void {
        this.hunterBlindPanel = this.add
            .rectangle(
                this.gameWidth / 2,
                this.gameHeight / 2,
                this.gameWidth,
                this.gameHeight,
                0x1d2a24,
                1,
            )
            .setDepth(800)
            .setVisible(false);

        this.hunterBlindText = this.add
            .text(
                this.gameWidth / 2,
                72,
                'HIDERS ARE PAINTING...\nHunter도 자신의 위장색을 칠해보세요.',
                {
                    fontFamily: 'monospace',
                    fontSize: '27px',
                    fontStyle: 'bold',
                    color: '#fff4d6',
                    align: 'center',
                    lineSpacing: 12,
                },
            )
            .setOrigin(0.5)
            .setDepth(801)
            .setVisible(false);
    }

    private setHunterPaintBlind(
        visible: boolean,
    ): void {
        if (
            this.hunterBlindPanel &&
            this.hunterBlindText
        ) {
            this.hunterBlindPanel.setVisible(
                visible,
            );

            this.hunterBlindText.setVisible(
                visible,
            );
        }

        if (
            this.networkPlayerManager
        ) {
            this.networkPlayerManager
                .setLocalHunterCustomizationMode(
                    visible,
                );
        }

        this.paintPreview.setDepth(
            visible ? 970 : 200,
        );
    }

    private clearStatus(): void {
        this.statusText
            .setText('')
            .setVisible(false)
            .setAlpha(1);
    }

    private enterLobbyPhase(): void {
        this.phase = 'lobby';
        this.resetPaintWorldZoom();
        this.clearStatus();
        this.setHunterPaintBlind(false);
        this.phaseEndTime = 0;

        this.phaseText.setText(
            '🦎 MULTIPLAYER LOBBY',
        );

        this.timerText
            .setText('WAITING')
            .setColor('#26352b');

        this.guideText.setText(
            '방장이 START GAME 버튼을 누르면 시작합니다.',
        );

        this.paintPreview.setVisible(false);
        this.setPaintPaletteVisible(false);
        this.countdownPanel?.setVisible(false);
        this.countdownText?.setVisible(false);
        this.paintColorText.setVisible(false);
        this.brushSizeText.setVisible(false);
        this.setPaintPaletteVisible(false);

        if (
            multiplayerClient.isConnected()
        ) {
            this.networkPlayerManager
                .resetLocalPaintZoom();
        }
        this.setPaintPaletteVisible(false);
        this.ammoText.setVisible(false);
        this.targetText.setVisible(false);

        this.aimLine.clear();
        this.crosshair.clear();

        this.hideLegacySinglePlayerActors();
        this.input.setDefaultCursor('default');

        this.updateLobbyUi();
    }

    private handleNetworkRoundResult(
        result: NetworkRoundResult,
    ): void {
        this.hideLegacySinglePlayerActors();
        this.resetPaintWorldZoom();

        this.networkPlayerManager
            .setNamesVisible(false);

        if (
            result.winner ===
            'hiders'
        ) {
            this.networkPlayerManager
                .revealHiders(
                    result.revealedHiders,
                );

            this.phaseText.setText(
                '🌿 HIDERS WIN',
            );

            this.guideText.setText(
                '10초 동안 Hider의 은신 위치를 공개합니다.',
            );
        } else {
            this.networkPlayerManager
                .clearRevealMarkers();

            this.phaseText.setText(
                '🔫 HUNTERS WIN',
            );

            this.guideText.setText(
                '10초 후 대기실로 돌아갑니다.',
            );
        }
    }

    private applyNetworkPhase(
        phase: string,
        phaseEndsAt: number,
    ): void {
        const remainingMs =
            Math.max(
                0,
                phaseEndsAt - Date.now(),
            );

        this.phaseEndTime =
            this.time.now +
            remainingMs;

        if (phase === 'lobby') {
            this.enterLobbyPhase();
            return;
        }

        if (phase === 'countdown') {
            this.clearStatus();
            this.setHunterPaintBlind(false);
            this.phase = 'countdown';
            this.phaseEndTime =
                this.time.now +
                remainingMs;

            this.updateLobbyUi();
            return;
        }

        if (phase === 'paint') {
            this.clearStatus();
            this.enterPaintPhase();
            this.setHunterPaintBlind(
                this.networkPlayerManager
                    .isLocalHunter(),
            );
            this.phaseEndTime =
                this.time.now +
                remainingMs;
            return;
        }

        if (phase === 'hunt') {
            this.clearStatus();

            this.networkPlayerManager
                .normalizeLocalPlayerForGameplay();

            this.resetPaintWorldZoom();

            this.setHunterPaintBlind(false);
            this.setPaintPaletteVisible(false);
            this.paintPreview.setVisible(false);

            this.networkPlayerManager
                .setNamesVisible(false);

            this.networkPlayerManager
                .setHunterGunsVisible();

            this.startHunt();

            this.phaseEndTime =
                this.time.now +
                remainingMs;

            return;
        }

        if (phase === 'finished') {
            this.clearStatus();
            this.setHunterPaintBlind(false);
            this.hideLegacySinglePlayerActors();
            this.phase = 'hiderVictory';

            this.phaseText.setText(
                '🌿 ROUND FINISHED',
            );

            this.phaseEndTime =
                this.time.now +
                remainingMs;

            this.timerText
                .setText(
                    `LOBBY ${Math.max(
                        1,
                        Math.ceil(
                            remainingMs /
                            1000,
                        ),
                    )}`,
                )
                .setColor('#8cff9b');

            this.guideText.setText(
                '라운드가 종료되었습니다.',
            );

            this.aimLine.clear();
            this.crosshair.clear();
        }

        this.updateLobbyUi();
    }

    private updateMultiplayerHud(): void {
        if (!this.multiplayerText) {
            return;
        }

        const localPlayer =
            multiplayerClient.getLocalPlayer();

        const roomId =
            multiplayerClient.getRoomId();

        const role =
            localPlayer?.role?.toUpperCase() ??
            'WAITING';

        this.multiplayerText
            .setText(
                [
                    'CHAMELEON HUNT ONLINE',
                    `ROOM ${roomId ?? '-'}`,
                    `PLAYERS ${this.networkPlayerCount} / 10`,
                    `ROLE ${role}`,
                ].join('\n'),
            )
            .setColor('#35634a');

        this.updateLobbyUi();
    }

    /*
     * Background
     */

    private createImageBackground(): void {
        this.backgroundImage = this.add.image(
            this.gameWidth / 2,
            this.gameHeight / 2,
            'forest-background',
        );

        this.backgroundImage.setDisplaySize(
            this.gameWidth,
            this.gameHeight,
        );

        this.backgroundImage.setDepth(-20);

        this.backgroundBaseX =
            this.backgroundImage.x;

        this.backgroundBaseY =
            this.backgroundImage.y;
    }

    /*
     * Obstacles
     */

    private createObstacles(): void {
        const obstacleData = [
            {
                x: 285,
                y: 210,
                width: 125,
                height: 32,
            },
            {
                x: 640,
                y: 230,
                width: 32,
                height: 140,
            },
            {
                x: 350,
                y: 415,
                width: 150,
                height: 34,
            },
            {
                x: 795,
                y: 385,
                width: 115,
                height: 40,
            },
        ];

        this.obstacles = obstacleData.map((data) => {
            const object = this.add.rectangle(
                data.x,
                data.y,
                data.width,
                data.height,
                0x353b42,
                0.9,
            );

            object.setStrokeStyle(0, 0x000000, 0);
            object.setAlpha(0);
            object.setDepth(3);

            const bounds = new Phaser.Geom.Rectangle(
                data.x - data.width / 2,
                data.y - data.height / 2,
                data.width,
                data.height,
            );

            return {
                object,
                bounds,
            };
        });
    }

    /*
     * Hunter
     */

    private createHunter(): void {
        const x = 100;
        const y = this.gameHeight / 2;

        // 이동 및 충돌 판정용 투명 본체
        this.player = this.add.rectangle(x, y, 24, 42, 0x000000, 0);
        this.player.setDepth(10);

        const head = this.add.circle(x, y - 17, 13, 0xfff7e8);
        const body = this.add.rectangle(x, y + 5, 20, 24, 0x4f86c6);
        const leftArm = this.add.rectangle(x - 13, y + 4, 7, 18, 0x4f86c6);
        const rightArm = this.add.rectangle(x + 13, y + 4, 7, 18, 0x4f86c6);
        const leftLeg = this.add.rectangle(x - 6, y + 22, 8, 14, 0x355f91);
        const rightLeg = this.add.rectangle(x + 6, y + 22, 8, 14, 0x355f91);

        // 이미지에서 보였던 파란 모자 느낌
        const hatBrim = this.add.rectangle(x, y - 27, 28, 6, 0x2f5f98);
        const hatTop = this.add.rectangle(x, y - 33, 20, 9, 0x477fb8);
        const scarf = this.add.rectangle(x, y - 3, 18, 5, 0xf2c14e);

        this.hunterVisuals = [
            { object: head, offsetX: 0, offsetY: -17 },
            { object: body, offsetX: 0, offsetY: 5 },
            { object: leftArm, offsetX: -13, offsetY: 4 },
            { object: rightArm, offsetX: 13, offsetY: 4 },
            { object: leftLeg, offsetX: -6, offsetY: 22 },
            { object: rightLeg, offsetX: 6, offsetY: 22 },
            { object: hatBrim, offsetX: 0, offsetY: -27 },
            { object: hatTop, offsetX: 0, offsetY: -33 },
            { object: scarf, offsetX: 0, offsetY: -3 },
        ];

        this.hunterVisuals.forEach(({ object }) => {
            object.setStrokeStyle(1, 0x5b4636, 0.75);
            object.setDepth(10);
        });

        this.gun = this.add.rectangle(
            x + 20,
            y + 3,
            32,
            7,
            0x6b4b2a,
        );

        this.gun.setOrigin(0.15, 0.5);
        this.gun.setDepth(11);

        this.hunterLabel = this.add
            .text(x, y - 49, 'HUNTER', {
                fontFamily: 'Arial',
                fontSize: '13px',
                fontStyle: 'bold',
                color: '#315f94',
                backgroundColor: '#fff4d6',
                padding: { x: 6, y: 3 },
            })
            .setOrigin(0.5)
            .setDepth(12);
    }

    private updateHunterMovement(delta: number): void {
        let movementX = 0;
        let movementY = 0;

        if (
            this.moveLeftKey.isDown ||
            this.cursors.left.isDown
        ) {
            movementX -= 1;
        }

        if (
            this.moveRightKey.isDown ||
            this.cursors.right.isDown
        ) {
            movementX += 1;
        }

        if (
            this.moveUpKey.isDown ||
            this.cursors.up.isDown
        ) {
            movementY -= 1;
        }

        if (
            this.moveDownKey.isDown ||
            this.cursors.down.isDown
        ) {
            movementY += 1;
        }

        if (movementX === 0 && movementY === 0) {
            return;
        }

        const direction = new Phaser.Math.Vector2(
            movementX,
            movementY,
        ).normalize();

        const distance =
            this.playerSpeed * (delta / 1000);

        const previousX = this.player.x;
        const previousY = this.player.y;

        this.player.x += direction.x * distance;
        this.player.y += direction.y * distance;

        this.player.x = Phaser.Math.Clamp(
            this.player.x,
            this.player.width / 2,
            this.gameWidth - this.player.width / 2,
        );

        this.player.y = Phaser.Math.Clamp(
            this.player.y,
            this.player.height / 2,
            this.gameHeight - this.player.height / 2,
        );

        if (this.isHunterTouchingObstacle()) {
            this.player.setPosition(previousX, previousY);
        }

        this.updateHunterObjects();
    }

    private updateHunterObjects(): void {
        this.hunterVisuals.forEach(({ object, offsetX, offsetY }) => {
            object.setPosition(
                this.player.x + offsetX,
                this.player.y + offsetY,
            );
        });

        this.gun.setPosition(
            this.player.x,
            this.player.y + 3,
        );

        this.hunterLabel.setPosition(
            this.player.x,
            this.player.y - 49,
        );
    }

    private isHunterTouchingObstacle(): boolean {
        const hunterBounds = this.player.getBounds();

        return this.obstacles.some((obstacle) =>
            Phaser.Geom.Intersects.RectangleToRectangle(
                hunterBounds,
                obstacle.bounds,
            ),
        );
    }

    /*
     * Hiders
     */

    private createHiders(): void {
        const positions = [
            { x: 170, y: 145 },
            { x: 760, y: 155 },
            { x: 720, y: 415 },
        ];

        this.hiders = positions.map(
            (position, index) =>
                this.createHider(
                    position.x,
                    position.y,
                    index,
                ),
        );
    }

    private createHider(
        x: number,
        y: number,
        index: number,
    ): Hider {
        // 얼굴 요소 없이 실루엣만 귀여운 SD 비율
        const head = this.add.circle(x, y - 22, 13, 0xfffbf2);

        const body = this.add.rectangle(
            x,
            y + 1,
            21,
            23,
            0xfffbf2,
        );

        const leftArm = this.add.rectangle(
            x - 14,
            y + 1,
            7,
            18,
            0xfffbf2,
        );

        const rightArm = this.add.rectangle(
            x + 14,
            y + 1,
            7,
            18,
            0xfffbf2,
        );

        const leftLeg = this.add.rectangle(
            x - 6,
            y + 20,
            8,
            15,
            0xfffbf2,
        );

        const rightLeg = this.add.rectangle(
            x + 6,
            y + 20,
            8,
            15,
            0xfffbf2,
        );

        const objects: HiderPartObject[] = [
            head,
            body,
            leftArm,
            rightArm,
            leftLeg,
            rightLeg,
        ];

        objects.forEach((object) => {
            object.setStrokeStyle(1, 0x8d6e63, 0.75);
            object.setDepth(5);
        });

        const paintLayer = this.createPaintLayer(x, y);

        const label = this.add
            .text(x, y - 43, `HIDER ${index + 1}`, {
                fontFamily: 'Arial',
                fontSize: '14px',
                fontStyle: 'bold',
                color: '#5b4636',
                backgroundColor: '#fff4d6',
                padding: {
                    x: 7,
                    y: 4,
                },
            })
            .setOrigin(0.5)
            .setDepth(9);

        return {
            centerX: x,
            centerY: y,
            alive: true,

            head,
            body,
            leftArm,
            rightArm,
            leftLeg,
            rightLeg,
            label,

            paintTexture: paintLayer.paintTexture,
            paintMaskShape:
                paintLayer.paintMaskShape,
            paintMask: paintLayer.paintMask,
        };
    }

    private createPaintLayer(
        centerX: number,
        centerY: number,
    ): {
        paintTexture: Phaser.GameObjects.RenderTexture;
        paintMaskShape: Phaser.GameObjects.Graphics;
        paintMask: Phaser.Display.Masks.GeometryMask;
    } {
        const textureWidth = 60;
        const textureHeight = 76;

        const textureX = centerX - textureWidth / 2;
        const textureY = centerY - 38;

        const paintTexture = this.add.renderTexture(
            textureX,
            textureY,
            textureWidth,
            textureHeight,
        );

        paintTexture.setOrigin(0, 0);
        paintTexture.setDepth(20);

        // 처음 흰색으로 채우지 않음
        // 기존 하이더 몸체가 흰색이므로 그대로 보임
        paintTexture.clear();

        const paintMaskShape = this.add.graphics();

        // 마스크는 로컬 좌표로 그림
        this.drawLocalHiderMask(paintMaskShape);

        // RenderTexture와 같은 위치에 배치
        paintMaskShape.setPosition(
            textureX,
            textureY,
        );

        paintMaskShape.setVisible(false);

        const paintMask =
            paintMaskShape.createGeometryMask();

        paintTexture.setMask(paintMask);

        return {
            paintTexture,
            paintMaskShape,
            paintMask,
        };
    }

    private drawLocalHiderMask(
        graphics: Phaser.GameObjects.Graphics,
    ): void {
        graphics.clear();
        graphics.fillStyle(0xffffff, 1);

        // RenderTexture: 60 x 76, 중심은 (30, 38)
        const centerX = 30;
        const centerY = 38;

        graphics.fillCircle(centerX, centerY - 22, 13);
        graphics.fillRect(centerX - 10.5, centerY - 10.5, 21, 23);
        graphics.fillRect(centerX - 17.5, centerY - 8, 7, 18);
        graphics.fillRect(centerX + 10.5, centerY - 8, 7, 18);
        graphics.fillRect(centerX - 10, centerY + 12, 8, 15);
        graphics.fillRect(centerX + 2, centerY + 12, 8, 15);
    }

    private getAllPartObjects(
        hider: Hider,
    ): HiderPartObject[] {
        return [
            hider.head,
            hider.body,
            hider.leftArm,
            hider.rightArm,
            hider.leftLeg,
            hider.rightLeg,
        ];
    }

    private createSelectionRing(): void {
        this.selectionRing = this.add.circle(
            0,
            0,
            38,
            0xffe082,
            0,
        );

        this.selectionRing.setStrokeStyle(
            3,
            0xffe082,
            1,
        );

        this.selectionRing.setDepth(8);

        this.tweens.add({
            targets: this.selectionRing,
            scale: 1.08,
            alpha: 0.35,
            duration: 650,
            yoyo: true,
            repeat: -1,
        });
    }

    private selectHider(index: number): void {
        const hider = this.hiders[index];

        if (!hider || !hider.alive) {
            return;
        }

        this.selectedHiderIndex = index;

        this.selectionRing.setPosition(
            hider.centerX,
            hider.centerY + 4,
        );

        this.showStatus(
            `HIDER ${index + 1} 선택`,
        );
    }

    private updateSelectedHiderMovement(
        delta: number,
    ): void {
        const hider =
            this.hiders[this.selectedHiderIndex];

        if (!hider || !hider.alive) {
            return;
        }

        let movementX = 0;
        let movementY = 0;

        if (this.moveLeftKey.isDown) {
            movementX -= 1;
        }

        if (this.moveRightKey.isDown) {
            movementX += 1;
        }

        if (this.moveUpKey.isDown) {
            movementY -= 1;
        }

        if (this.moveDownKey.isDown) {
            movementY += 1;
        }

        if (movementX === 0 && movementY === 0) {
            return;
        }

        const direction = new Phaser.Math.Vector2(
            movementX,
            movementY,
        ).normalize();

        const distance =
            this.hiderSpeed * (delta / 1000);

        this.moveHider(
            hider,
            direction.x * distance,
            direction.y * distance,
        );
    }

    private moveHider(
        hider: Hider,
        movementX: number,
        movementY: number,
    ): void {
        const previousCenterX = hider.centerX;
        const previousCenterY = hider.centerY;

        this.applyHiderMovement(
            hider,
            movementX,
            movementY,
        );

        const outsideBounds =
            hider.centerX < 45 ||
            hider.centerX > this.gameWidth - 45 ||
            hider.centerY < 90 ||
            hider.centerY > this.gameHeight - 72;

        if (
            outsideBounds ||
            this.isHiderTouchingObstacle(hider)
        ) {
            this.applyHiderMovement(
                hider,
                previousCenterX - hider.centerX,
                previousCenterY - hider.centerY,
            );
        }

        this.selectionRing.setPosition(
            hider.centerX,
            hider.centerY + 4,
        );
    }

    private applyHiderMovement(
        hider: Hider,
        movementX: number,
        movementY: number,
    ): void {
        hider.centerX += movementX;
        hider.centerY += movementY;

        this.getAllPartObjects(hider).forEach(
            (object) => {
                object.x += movementX;
                object.y += movementY;
            },
        );

        hider.label.x += movementX;
        hider.label.y += movementY;

        hider.paintTexture.x += movementX;
        hider.paintTexture.y += movementY;

        hider.paintMaskShape.x += movementX;
        hider.paintMaskShape.y += movementY;
    }

    private isHiderTouchingObstacle(
        hider: Hider,
    ): boolean {
        return this.getAllPartObjects(hider).some(
            (part) => {
                const partBounds = part.getBounds();

                return this.obstacles.some((obstacle) =>
                    Phaser.Geom.Intersects.RectangleToRectangle(
                        partBounds,
                        obstacle.bounds,
                    ),
                );
            },
        );
    }

    private findHiderAtPoint(
        worldX: number,
        worldY: number,
    ): {
        hider: Hider;
        index: number;
    } | null {
        for (
            let index = this.hiders.length - 1;
            index >= 0;
            index -= 1
        ) {
            const hider = this.hiders[index];

            if (
                hider.alive &&
                this.isPointerInsideHider(
                    hider,
                    worldX,
                    worldY,
                )
            ) {
                return {
                    hider,
                    index,
                };
            }
        }

        return null;
    }

    private isPointerInsideHider(
        hider: Hider,
        worldX: number,
        worldY: number,
    ): boolean {
        return this.getAllPartObjects(hider).some(
            (part) =>
                part
                    .getBounds()
                    .contains(worldX, worldY),
        );
    }

    /*
     * Painting
     */

    private adjustPaintWorldZoom(
        wheelDeltaY: number,
    ): number {
        const localPosition =
            this.networkPlayerManager
                .getLocalPlayerPosition();

        if (!localPosition) {
            return 1;
        }

        const direction =
            wheelDeltaY < 0
                ? 1
                : -1;

        this.paintWorldZoom =
            Phaser.Math.Clamp(
                this.paintWorldZoom +
                    direction * 0.25,
                1,
                3,
            );

        /*
         * UI는 그대로 두고 배경과 캐릭터만
         * 로컬 플레이어를 기준으로 확대합니다.
         */
        const zoom =
            this.paintWorldZoom;

        this.backgroundImage
            .setScale(zoom)
            .setPosition(
                localPosition.x +
                    (
                        this.backgroundBaseX -
                        localPosition.x
                    ) *
                    zoom,
                localPosition.y +
                    (
                        this.backgroundBaseY -
                        localPosition.y
                    ) *
                    zoom,
            );

        this.networkPlayerManager
            .adjustLocalPaintZoom(
                wheelDeltaY,
            );

        return zoom;
    }

    private resetPaintWorldZoom(): void {
        this.paintWorldZoom = 1;

        this.backgroundImage
            .setScale(1)
            .setPosition(
                this.backgroundBaseX,
                this.backgroundBaseY,
            );

        this.networkPlayerManager
            ?.resetLocalPaintZoom();
    }

    private createPaintPalette(): void {
        const colors = [
            0x000000,
            0xef4444,
            0xf97316,
            0xfacc15,
            0x84cc16,
            0x22c55e,
            0x14b8a6,
            0x38bdf8,
            0x3b82f6,
            0x8b5cf6,
            0xec4899,
            0x8b5a2b,
            0xf5eee2,
            0x9ca3af,
            0x374151,
        ];

        const panel = this.add
            .rectangle(
                150,
                this.gameHeight - 52,
                280,
                74,
                0xfff4d6,
                0.93,
            )
            .setStrokeStyle(
                2,
                0x6f8f65,
                1,
            )
            .setDepth(870)
            .setVisible(false);

        const title = this.add
            .text(
                20,
                this.gameHeight - 83,
                'COLOR PALETTE',
                {
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                },
            )
            .setDepth(871)
            .setVisible(false);

        this.paletteObjects.push(
            panel,
            title,
        );

        colors.forEach(
            (
                color,
                index,
            ) => {
                const column =
                    index % 8;

                const row =
                    Math.floor(
                        index / 7,
                    );

                const swatch =
                    this.add.rectangle(
                        38 +
                            column * 32,
                        this.gameHeight -
                            58 +
                            row * 30,
                        24,
                        24,
                        color,
                        1,
                    )
                        .setStrokeStyle(
                            2,
                            0xffffff,
                            0.95,
                        )
                        .setDepth(872)
                        .setVisible(false)
                        .setInteractive({
                            useHandCursor: true,
                        });

                swatch.on(
                    'pointerdown',
                    () => {
                        this.paintColor =
                            color;

                        this.createBrushTexture();
                        this.updatePaintHud();
                        this.updatePaintPreviewImmediately();
                        this.highlightPaletteColor(
                            color,
                        );
                    },
                );

                swatch.setData(
                    'paletteColor',
                    color,
                );

                this.paletteObjects.push(
                    swatch,
                );
            },
        );

        this.paintZoomText = this.add
            .text(
                305,
                this.gameHeight - 72,
                'ZOOM 1.0x\n마우스 휠',
                {
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: '#fff4d6dd',
                    padding: {
                        x: 8,
                        y: 5,
                    },
                    align: 'center',
                },
            )
            .setDepth(872)
            .setVisible(false);

        this.paintControlHelpText =
            this.add
                .text(
                    this.gameWidth - 18,
                    this.gameHeight - 18,
                    '',
                    {
                        fontFamily:
                            'monospace',
                        fontSize: '13px',
                        fontStyle: 'bold',
                        color: '#26352b',
                        backgroundColor:
                            '#fff4d6ee',
                        padding: {
                            x: 12,
                            y: 8,
                        },
                        align: 'right',
                        lineSpacing: 4,
                    },
                )
                .setOrigin(1, 1)
                .setDepth(875)
                .setVisible(false);

        this.updatePaintControlHelp();
    }

    private updatePaintControlHelp(): void {
        if (
            !this.paintControlHelpText
        ) {
            return;
        }

        this.paintControlHelpText.setText(
            [
                'PAINT CONTROLS',
                '좌클릭  색칠',
                '우클릭  스포이드',
                '휠      확대 / 축소',
                '[ / ]   브러시 크기',
                'B       브러시 모양',
                `현재 ${this.getBrushShapeLabel()} · ${this.brushSize}`,
            ].join('\n'),
        );
    }

    private setPaintPaletteVisible(
        visible: boolean,
    ): void {
        this.paletteObjects.forEach(
            (object) => {
                const visibleObject =
                    object as Phaser.GameObjects.GameObject & {
                        setVisible?: (
                            value: boolean,
                        ) => unknown;
                    };

                visibleObject.setVisible?.(
                    visible,
                );
            },
        );

        this.paintZoomText?.setVisible(
            visible &&
            multiplayerClient.isConnected(),
        );

        this.paintControlHelpText?.setVisible(
            visible,
        );
    }

    private highlightPaletteColor(
        selectedColor: number,
    ): void {
        this.paletteObjects.forEach(
            (object) => {
                if (
                    !(object instanceof
                        Phaser.GameObjects.Rectangle)
                ) {
                    return;
                }

                const color =
                    object.getData(
                        'paletteColor',
                    );

                if (
                    typeof color !==
                    'number'
                ) {
                    return;
                }

                object.setStrokeStyle(
                    color ===
                        selectedColor
                        ? 4
                        : 2,
                    color ===
                        selectedColor
                        ? 0x111827
                        : 0xffffff,
                    1,
                );
            },
        );
    }

    private createPaintTools(): void {
        this.paintPreview = this.add.graphics();
        this.paintPreview.setDepth(200);
        this.paintPreview.setVisible(false);

        this.createBrushTexture();
        this.redrawPaintPreview();
    }

    private getPaintPreviewBrushSize(): number {
        if (
            multiplayerClient.isConnected() &&
            this.phase === 'paint'
        ) {
            return (
                this.brushSize *
                this.paintWorldZoom
            );
        }

        return this.brushSize;
    }

    private redrawPaintPreview(): void {
        if (!this.paintPreview) {
            return;
        }

        const previewSize =
            this.getPaintPreviewBrushSize();

        this.paintPreview.clear();
        this.paintPreview.fillStyle(
            this.paintColor,
            0.45,
        );
        this.paintPreview.lineStyle(
            1,
            0x111827,
            0.95,
        );

        if (
            this.brushShape ===
            'dotCircle'
        ) {
            this.drawPixelCirclePreview(
                previewSize,
            );
            return;
        }

        if (
            this.brushShape ===
            'circle'
        ) {
            this.paintPreview.fillCircle(
                0,
                0,
                previewSize,
            );
            this.paintPreview.strokeCircle(
                0,
                0,
                previewSize,
            );
            return;
        }

        const diameter =
            previewSize * 2;

        this.paintPreview.fillRect(
            -previewSize,
            -previewSize,
            diameter,
            diameter,
        );

        this.paintPreview.strokeRect(
            -previewSize,
            -previewSize,
            diameter,
            diameter,
        );
    }

    private drawPixelCirclePreview(
        radius: number,
    ): void {
        const pixelSize =
            Math.max(
                1,
                this.paintWorldZoom,
            );

        const logicalRadius =
            Math.max(
                1,
                Math.round(
                    radius /
                    pixelSize,
                ),
            );

        for (
            let y = -logicalRadius;
            y <= logicalRadius;
            y += 1
        ) {
            const halfWidth =
                Math.floor(
                    Math.sqrt(
                        Math.max(
                            0,
                            logicalRadius *
                                logicalRadius -
                            y * y,
                        ),
                    ),
                );

            this.paintPreview.fillRect(
                -halfWidth * pixelSize,
                y * pixelSize,
                (halfWidth * 2 + 1) *
                    pixelSize,
                pixelSize,
            );
        }

        this.paintPreview.strokeCircle(
            0,
            0,
            radius,
        );
    }

    private createPointerControls(): void {
        this.input.on(
            Phaser.Input.Events.POINTER_DOWN,
            (pointer: Phaser.Input.Pointer) => {
                if (this.phase === 'hunt') {
                    if (pointer.leftButtonDown()) {
                        this.fireShotgun();
                    }

                    return;
                }

                if (this.phase !== 'paint') {
                    return;
                }

                if (pointer.rightButtonDown()) {
                    this.pickColorFromBackground(
                        pointer.worldX,
                        pointer.worldY,
                    );

                    return;
                }

                if (!pointer.leftButtonDown()) {
                    return;
                }

                if (
                    multiplayerClient.isConnected()
                ) {
                    const point =
                        this.networkPlayerManager
                            .paintLocalPlayer(
                                pointer.worldX,
                                pointer.worldY,
                                this.brushTextureKey,
                            );

                    if (!point) {
                        return;
                    }

                    this.isPainting = true;
                    this.activeStrokeTargetSessionId =
                        multiplayerClient
                            .getSessionId() ?? '';
                    this.activeStrokePoints = [
                        point,
                    ];

                    return;
                }

                const selected = this.findHiderAtPoint(
                    pointer.worldX,
                    pointer.worldY,
                );

                if (!selected) {
                    return;
                }

                this.selectHider(selected.index);
                this.isPainting = true;

                this.paintOnHider(
                    selected.hider,
                    pointer.worldX,
                    pointer.worldY,
                );
            },
        );

        this.input.on(
            Phaser.Input.Events.POINTER_MOVE,
            (pointer: Phaser.Input.Pointer) => {
                this.updatePaintPreview(pointer);

                if (
                    this.phase !== 'paint' ||
                    !this.isPainting ||
                    !pointer.isDown
                ) {
                    return;
                }

                if (
                    multiplayerClient.isConnected()
                ) {
                    const point =
                        this.networkPlayerManager
                            .paintLocalPlayer(
                                pointer.worldX,
                                pointer.worldY,
                                this.brushTextureKey,
                            );

                    if (point) {
                        this.recordActivePaintPoint(
                            point.x,
                            point.y,
                        );
                    }

                    return;
                }

                const hider =
                    this.hiders[this.selectedHiderIndex];

                if (!hider || !hider.alive) {
                    return;
                }

                this.paintOnHider(
                    hider,
                    pointer.worldX,
                    pointer.worldY,
                );
            },
        );

        this.input.on(
            Phaser.Input.Events.POINTER_UP,
            () => {
                this.isPainting = false;
                this.finishActivePaintStroke();
            },
        );

        this.input.on(
            Phaser.Input.Events.POINTER_WHEEL,
            (
                _pointer:
                    Phaser.Input.Pointer,
                _gameObjects:
                    Phaser.GameObjects.GameObject[],
                _deltaX: number,
                deltaY: number,
            ) => {
                if (
                    this.phase !== 'paint' ||
                    !multiplayerClient.isConnected()
                ) {
                    return;
                }

                const zoom =
                    this.adjustPaintWorldZoom(
                        deltaY,
                    );

                const visibleBrushSize =
                    this.brushSize * zoom;

                this.paintZoomText.setText(
                    [
                        `ZOOM ${zoom.toFixed(2)}x`,
                        `VISIBLE BRUSH ${visibleBrushSize.toFixed(1)}`,
                        '마우스 휠',
                    ].join('\n'),
                );

                this.updatePaintPreviewImmediately();
            },
        );

        this.game.canvas.addEventListener(
            'contextmenu',
            (event) => {
                event.preventDefault();
            },
        );
    }

    private paintOnHider(
        hider: Hider,
        worldX: number,
        worldY: number,
    ): void {
        const textureX =
            worldX - hider.paintTexture.x;

        const textureY =
            worldY - hider.paintTexture.y;

        if (
            textureX < 0 ||
            textureY < 0 ||
            textureX > hider.paintTexture.width ||
            textureY > hider.paintTexture.height
        ) {
            return;
        }

        this.recordActivePaintPoint(
            textureX,
            textureY,
        );

        hider.paintTexture.stamp(
            this.brushTextureKey,
            undefined,
            textureX,
            textureY,
            {
                originX: 0.5,
                originY: 0.5,
            },
        );

        // Phaser 4에서는 DynamicTexture 변경 사항을 실제 화면에
        // 반영하려면 render()를 호출해야 합니다.
        const renderTexture = hider.paintTexture as unknown as {
            render?: () => void;
        };

        renderTexture.render?.();
    }

    private recordActivePaintPoint(
        textureX: number,
        textureY: number,
    ): void {
        if (
            !this.isPainting ||
            (
                multiplayerClient.isConnected() &&
                !this.activeStrokeTargetSessionId
            )
        ) {
            return;
        }

        const previousPoint =
            this.activeStrokePoints[
                this.activeStrokePoints.length - 1
            ];

        if (previousPoint) {
            const distance =
                Phaser.Math.Distance.Between(
                    previousPoint.x,
                    previousPoint.y,
                    textureX,
                    textureY,
                );

            if (distance < 1.5) {
                return;
            }
        }

        this.activeStrokePoints.push({
            x: Phaser.Math.Clamp(
                textureX,
                0,
                80,
            ),
            y: Phaser.Math.Clamp(
                textureY,
                0,
                120,
            ),
        });
    }

    private finishActivePaintStroke(): void {
        if (
            !multiplayerClient.isConnected() ||
            !this.activeStrokeTargetSessionId ||
            this.activeStrokePoints.length === 0
        ) {
            this.activeStrokePoints = [];
            this.activeStrokeTargetSessionId = '';
            return;
        }

        multiplayerClient.sendPaintStroke({
            targetSessionId:
                this.activeStrokeTargetSessionId,
            color: this.paintColor,
            size: this.brushSize,
            shape: this.brushShape,
            points: [
                ...this.activeStrokePoints,
            ],
        });

        this.activeStrokePoints = [];
        this.activeStrokeTargetSessionId = '';
    }

    private applyRemotePaintStroke(
        stroke: NetworkPaintStroke,
    ): void {
        if (stroke.points.length === 0) {
            return;
        }

        const textureKey =
            `${this.remoteBrushTexturePrefix}-` +
            `${stroke.shape}-${stroke.size}-` +
            `${stroke.color}`;

        this.ensureRemoteBrushTexture(
            textureKey,
            stroke.color,
            stroke.size,
            stroke.shape,
        );

        this.networkPlayerManager.applyPaintStroke(
            stroke,
            textureKey,
        );
    }

    private ensureRemoteBrushTexture(
        textureKey: string,
        color: number,
        size: number,
        shape: NetworkBrushShape,
    ): void {
        if (this.textures.exists(textureKey)) {
            return;
        }

        const diameter = size * 2;
        const graphics = this.add.graphics();

        graphics.fillStyle(color, 1);

        if (shape === 'circle') {
            graphics.fillCircle(
                size,
                size,
                size,
            );
        } else {
            graphics.fillRect(
                0,
                0,
                diameter,
                diameter,
            );
        }

        graphics.generateTexture(
            textureKey,
            diameter,
            diameter,
        );

        graphics.destroy();
    }

    private pickColorFromBackground(
        worldX: number,
        worldY: number,
    ): void {
        const sourceImage = this.textures
            .get('forest-background')
            .getSourceImage() as HTMLImageElement;

        if (!sourceImage) {
            this.showStatus(
                '배경 이미지를 읽을 수 없습니다',
            );

            return;
        }

        /*
         * 확대된 배경의 현재 화면 경계를 기준으로 정규화합니다.
         * 따라서 눈으로 클릭한 픽셀과 실제 스포이드 색이 일치합니다.
         */
        const bounds =
            this.backgroundImage.getBounds();

        const normalizedX =
            Phaser.Math.Clamp(
                (
                    worldX -
                    bounds.left
                ) /
                bounds.width,
                0,
                1,
            );

        const normalizedY =
            Phaser.Math.Clamp(
                (
                    worldY -
                    bounds.top
                ) /
                bounds.height,
                0,
                1,
            );

        const imageX =
            Phaser.Math.Clamp(
                Math.floor(
                    normalizedX *
                    sourceImage.width,
                ),
                0,
                sourceImage.width - 1,
            );

        const imageY =
            Phaser.Math.Clamp(
                Math.floor(
                    normalizedY *
                    sourceImage.height,
                ),
                0,
                sourceImage.height - 1,
            );

        const canvas =
            document.createElement('canvas');

        canvas.width = 1;
        canvas.height = 1;

        const context =
            canvas.getContext('2d');

        if (!context) {
            return;
        }

        context.drawImage(
            sourceImage,
            imageX,
            imageY,
            1,
            1,
            0,
            0,
            1,
            1,
        );

        const pixel =
            context.getImageData(
                0,
                0,
                1,
                1,
            ).data;

        this.paintColor =
            Phaser.Display.Color.GetColor(
                pixel[0],
                pixel[1],
                pixel[2],
            );

        this.createBrushTexture();
        this.updatePaintHud();
        this.updatePaintPreviewImmediately();

        const hexColor =
            this.paintColor
                .toString(16)
                .padStart(6, '0')
                .toUpperCase();

        this.showStatus(
            `색상 추출 #${hexColor}`,
        );
    }

    private updatePaintPreview(
        pointer: Phaser.Input.Pointer,
    ): void {
        if (this.phase !== 'paint') {
            this.paintPreview.setVisible(false);
            return;
        }

        this.paintPreview.setPosition(
            pointer.worldX,
            pointer.worldY,
        );

        this.redrawPaintPreview();
        this.paintPreview.setVisible(true);
    }

    private updatePaintPreviewImmediately(): void {
        if (
            this.phase !== 'paint' ||
            !this.paintPreview
        ) {
            return;
        }

        const pointer = this.input.activePointer;

        this.paintPreview.setPosition(
            pointer.worldX,
            pointer.worldY,
        );

        this.redrawPaintPreview();
        this.paintPreview.setVisible(true);
    }

    private updateBrushSizeInput(): void {
        let brushSizeChanged = false;

        if (
            Phaser.Input.Keyboard.JustDown(
                this.brushIncreaseKey,
            )
        ) {
            this.brushSize =
                Phaser.Math.Clamp(
                    this.brushSize + 1,
                    1,
                    24,
                );
            brushSizeChanged = true;
        }

        if (
            Phaser.Input.Keyboard.JustDown(
                this.brushDecreaseKey,
            )
        ) {
            this.brushSize =
                Phaser.Math.Clamp(
                    this.brushSize - 1,
                    1,
                    24,
                );
            brushSizeChanged = true;
        }

        if (!brushSizeChanged) {
            return;
        }

        this.createBrushTexture();
        this.updatePaintHud();
        this.updatePaintPreviewImmediately();
        this.updatePaintControlHelp();
    }

    private toggleBrushShape(): void {
        const brushOrder:
            BrushShape[] = [
                'dotCircle',
                'circle',
                'square',
            ];

        const currentIndex =
            brushOrder.indexOf(
                this.brushShape,
            );

        this.brushShape =
            brushOrder[
                (currentIndex + 1) %
                brushOrder.length
            ];

        this.createBrushTexture();
        this.updatePaintHud();
        this.updatePaintPreviewImmediately();
        this.updatePaintControlHelp();

        this.showStatus(
            `${this.getBrushShapeLabel()} 브러시`,
        );
    }

    private getBrushShapeLabel(): string {
        if (
            this.brushShape ===
            'dotCircle'
        ) {
            return 'DOT CIRCLE';
        }

        if (
            this.brushShape ===
            'circle'
        ) {
            return 'SMOOTH CIRCLE';
        }

        return 'SQUARE DOT';
    }

    /*
     * Aim and shotgun
     */

    private createAimObjects(): void {
        this.aimLine = this.add.graphics();
        this.aimLine.setDepth(20);

        this.crosshair = this.add.graphics();
        this.crosshair.setDepth(100);
    }

    private updateAim(): void {
        if (
            multiplayerClient.isConnected() &&
            !this.networkPlayerManager
                .isLocalHunter()
        ) {
            this.aimLine.clear();
            this.crosshair.clear();
            return;
        }

        const origin =
            multiplayerClient.isConnected()
                ? this.networkPlayerManager
                    .getLocalPlayerPosition()
                : new Phaser.Math.Vector2(
                    this.player.x,
                    this.player.y,
                );

        if (!origin) {
            return;
        }

        const pointer =
            this.input.activePointer;

        const angle =
            Phaser.Math.Angle.Between(
                origin.x,
                origin.y,
                pointer.worldX,
                pointer.worldY,
            );

        this.gun.setRotation(angle);

        if (
            multiplayerClient.isConnected()
        ) {
            const now =
                this.time.now;

            this.networkPlayerManager
                .updateHunterAim(
                    multiplayerClient
                        .getSessionId() ?? '',
                    angle,
                    245,
                );

            if (
                now -
                this.lastHunterAimSentAt >=
                this.hunterAimSendInterval
            ) {
                this.lastHunterAimSentAt =
                    now;

                multiplayerClient
                    .sendHunterAim(
                        angle,
                    );
            }
        }

        this.aimLine.clear();
        this.aimLine.lineStyle(
            2,
            0xffffff,
            0.35,
        );

        const lineLength = 185;

        this.aimLine.lineBetween(
            origin.x,
            origin.y,
            origin.x +
                Math.cos(angle) *
                    lineLength,
            origin.y +
                Math.sin(angle) *
                    lineLength,
        );

        this.drawCrosshair(
            pointer.worldX,
            pointer.worldY,
        );
    }

    private drawCrosshair(
        x: number,
        y: number,
    ): void {
        const size = 11;
        const gap = 4;

        this.crosshair.clear();
        this.crosshair.lineStyle(
            2,
            0xffffff,
            1,
        );

        this.crosshair.lineBetween(
            x - size,
            y,
            x - gap,
            y,
        );

        this.crosshair.lineBetween(
            x + gap,
            y,
            x + size,
            y,
        );

        this.crosshair.lineBetween(
            x,
            y - size,
            x,
            y - gap,
        );

        this.crosshair.lineBetween(
            x,
            y + gap,
            x,
            y + size,
        );

        this.crosshair.strokeCircle(x, y, 2);
    }

    private fireShotgun(): void {
        if (this.phase !== 'hunt') {
            return;
        }

        if (
            multiplayerClient.isConnected() &&
            !this.networkPlayerManager
                .isLocalHunter()
        ) {
            return;
        }

        if (!this.canShoot) {
            return;
        }

        if (
            multiplayerClient.isConnected()
        ) {
            if (
                Date.now() <
                this.weaponOverheatedUntil
            ) {
                this.showStatus(
                    '샷건이 과열되었습니다',
                );
                return;
            }
        } else {
            if (this.isReloading) {
                this.showStatus(
                    '재장전 중입니다',
                );
                return;
            }

            if (this.ammo <= 0) {
                this.showStatus(
                    '탄약이 없습니다. R 키로 재장전',
                );
                return;
            }

            this.ammo -= 1;
            this.updateAmmoText();
        }

        this.canShoot = false;

        const pointer =
            this.input.activePointer;

        const origin =
            multiplayerClient.isConnected()
                ? this.networkPlayerManager
                    .getLocalPlayerPosition()
                : new Phaser.Math.Vector2(
                    this.player.x,
                    this.player.y,
                );

        if (!origin) {
            return;
        }

        const aimAngle = Phaser.Math.Angle.Between(
            origin.x,
            origin.y,
            pointer.worldX,
            pointer.worldY,
        );

        const muzzleDistance = 28;

        const muzzleX =
            origin.x +
            Math.cos(aimAngle) * muzzleDistance;

        const muzzleY =
            origin.y +
            Math.sin(aimAngle) * muzzleDistance;

        if (
            multiplayerClient.isConnected()
        ) {
            multiplayerClient.sendFireShot(
                aimAngle,
            );
        } else {
            this.createMuzzleFlash(
                muzzleX,
                muzzleY,
            );

            const hitHiders =
                this.createPellets(
                    muzzleX,
                    muzzleY,
                    aimAngle,
                );

            if (
                hitHiders.size > 0
            ) {
                this.showHitMarker();
            }

            hitHiders.forEach(
                (hider) => {
                    this.hitHider(
                        hider,
                    );
                },
            );

            if (
                this.getAliveHiderCount() ===
                0
            ) {
                this.showHunterVictory();
                return;
            }
        }

        this.cameras.main.shake(
            90,
            0.004,
        );

        if (
            !multiplayerClient.isConnected() &&
            this.ammo === 0
        ) {
            this.showStatus(
                '탄약 소진! R 키로 재장전',
            );
        }

        this.time.delayedCall(
            this.shotCooldown,
            () => {
                if (
                    this.phase === 'hunt' &&
                    !this.isReloading
                ) {
                    this.canShoot = true;
                }
            },
        );
    }

    private applyNetworkShot(
        shot: NetworkShotFired,
    ): void {
        this.createMuzzleFlash(
            shot.startX,
            shot.startY,
        );

        shot.pellets.forEach(
            (pellet) => {
                this.createPelletTrail(
                    new Phaser.Geom.Line(
                        shot.startX,
                        shot.startY,
                        pellet.endX,
                        pellet.endY,
                    ),
                );
            },
        );

        if (
            shot.hitIds.length > 0 &&
            shot.shooterId ===
                multiplayerClient
                    .getSessionId()
        ) {
            this.showHitMarker();
        }

        this.cameras.main.shake(
            70,
            0.003,
        );
    }

    private createPellets(
        startX: number,
        startY: number,
        aimAngle: number,
    ): Set<Hider> {
        const hitHiders = new Set<Hider>();

        for (
            let index = 0;
            index < this.pelletCount;
            index += 1
        ) {
            const ratio =
                index / (this.pelletCount - 1);

            const spreadOffset = Phaser.Math.Linear(
                -this.pelletSpread / 2,
                this.pelletSpread / 2,
                ratio,
            );

            const randomOffset =
                Phaser.Math.FloatBetween(
                    -0.025,
                    0.025,
                );

            const pelletAngle =
                aimAngle +
                spreadOffset +
                randomOffset;

            const range = Phaser.Math.Between(
                Math.floor(
                    this.pelletRange * 0.82,
                ),
                this.pelletRange,
            );

            const originalEndX =
                startX +
                Math.cos(pelletAngle) * range;

            const originalEndY =
                startY +
                Math.sin(pelletAngle) * range;

            const blockedEnd =
                this.getBlockedPelletEnd(
                    startX,
                    startY,
                    originalEndX,
                    originalEndY,
                );

            const pelletLine = new Phaser.Geom.Line(
                startX,
                startY,
                blockedEnd.x,
                blockedEnd.y,
            );

            this.createPelletTrail(pelletLine);

            this.hiders.forEach((hider) => {
                if (
                    !hider.alive ||
                    hitHiders.has(hider)
                ) {
                    return;
                }

                const wasHit =
                    this.getAllPartObjects(hider).some(
                        (part) =>
                            Phaser.Geom.Intersects.LineToRectangle(
                                pelletLine,
                                part.getBounds(),
                            ),
                    );

                if (wasHit) {
                    hitHiders.add(hider);
                }
            });
        }

        return hitHiders;
    }

    private getBlockedPelletEnd(
        startX: number,
        startY: number,
        endX: number,
        endY: number,
    ): Phaser.Math.Vector2 {
        const distance =
            Phaser.Math.Distance.Between(
                startX,
                startY,
                endX,
                endY,
            );

        const stepSize = 4;

        const stepCount = Math.ceil(
            distance / stepSize,
        );

        for (
            let step = 1;
            step <= stepCount;
            step += 1
        ) {
            const ratio = step / stepCount;

            const currentX = Phaser.Math.Linear(
                startX,
                endX,
                ratio,
            );

            const currentY = Phaser.Math.Linear(
                startY,
                endY,
                ratio,
            );

            const blocked = this.obstacles.some(
                (obstacle) =>
                    Phaser.Geom.Rectangle.Contains(
                        obstacle.bounds,
                        currentX,
                        currentY,
                    ),
            );

            if (blocked) {
                return new Phaser.Math.Vector2(
                    currentX,
                    currentY,
                );
            }
        }

        return new Phaser.Math.Vector2(
            endX,
            endY,
        );
    }

    private createPelletTrail(
        line: Phaser.Geom.Line,
    ): void {
        const trail = this.add.graphics();

        trail.setDepth(50);
        trail.lineStyle(2, 0xfff4c2, 0.85);

        trail.lineBetween(
            line.x1,
            line.y1,
            line.x2,
            line.y2,
        );

        this.tweens.add({
            targets: trail,
            alpha: 0,
            duration: 130,
            onComplete: () => {
                trail.destroy();
            },
        });
    }

    private createMuzzleFlash(
        x: number,
        y: number,
    ): void {
        const flash = this.add.circle(
            x,
            y,
            12,
            0xffd54f,
            0.9,
        );

        flash.setDepth(60);

        this.tweens.add({
            targets: flash,
            scale: 2,
            alpha: 0,
            duration: 100,
            onComplete: () => {
                flash.destroy();
            },
        });
    }

    private hitHider(hider: Hider): void {
        if (!hider.alive) {
            return;
        }

        hider.alive = false;

        const targets: Phaser.GameObjects.GameObject[] = [
            ...this.getAllPartObjects(hider),
            hider.paintTexture,
            hider.label,
        ];

        hider.label
            .setText('FOUND!')
            .setColor('#ff6b6b');

        this.tweens.add({
            targets,
            alpha: 0,
            scale: 1.18,
            duration: 350,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.getAllPartObjects(hider).forEach(
                    (object) => {
                        object.setVisible(false);
                    },
                );

                hider.paintTexture.setVisible(false);
                hider.label.setVisible(false);
            },
        });

        this.updateTargetText();
    }

    private reload(): void {
        if (this.phase !== 'hunt') {
            return;
        }

        if (this.isReloading) {
            this.showStatus(
                '이미 재장전 중입니다',
            );

            return;
        }

        if (this.ammo === this.maxAmmo) {
            this.showStatus(
                '탄약이 이미 가득합니다',
            );

            return;
        }

        this.isReloading = true;
        this.canShoot = false;

        this.updateAmmoText();
        this.showStatus('재장전 중...');

        this.time.delayedCall(
            this.reloadDuration,
            () => {
                if (this.phase !== 'hunt') {
                    this.isReloading = false;
                    return;
                }

                this.ammo = this.maxAmmo;
                this.isReloading = false;
                this.canShoot = true;

                this.updateAmmoText();
                this.showStatus('재장전 완료!');
            },
        );
    }

    /*
     * Hit marker
     */

    private createHitMarker(): void {
        this.hitMarker = this.add.graphics();

        this.hitMarker.setDepth(150);
        this.hitMarker.setVisible(false);
    }

    private showHitMarker(): void {
        const pointer =
            this.input.activePointer;

        const centerX = pointer.worldX;
        const centerY = pointer.worldY;

        const innerDistance = 6;
        const outerDistance = 15;

        this.hitMarker.clear();
        this.hitMarker.lineStyle(
            3,
            0xffffff,
            1,
        );

        this.hitMarker.lineBetween(
            centerX - outerDistance,
            centerY - outerDistance,
            centerX - innerDistance,
            centerY - innerDistance,
        );

        this.hitMarker.lineBetween(
            centerX + outerDistance,
            centerY - outerDistance,
            centerX + innerDistance,
            centerY - innerDistance,
        );

        this.hitMarker.lineBetween(
            centerX - outerDistance,
            centerY + outerDistance,
            centerX - innerDistance,
            centerY + innerDistance,
        );

        this.hitMarker.lineBetween(
            centerX + outerDistance,
            centerY + outerDistance,
            centerX + innerDistance,
            centerY + innerDistance,
        );

        this.hitMarker.setVisible(true);
        this.hitMarker.setAlpha(1);
        this.hitMarker.setScale(1);

        this.tweens.killTweensOf(
            this.hitMarker,
        );

        this.tweens.add({
            targets: this.hitMarker,
            alpha: 0,
            scale: 1.35,
            duration: 180,
            onComplete: () => {
                this.hitMarker.setVisible(false);
            },
        });
    }

    /*
     * Keyboard
     */

    private createKeyboardControls(): void {
        const keyboard = this.input.keyboard;

        if (!keyboard) {
            throw new Error(
                'Keyboard input is unavailable.',
            );
        }

        this.cursors =
            keyboard.createCursorKeys();

        this.moveUpKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.W,
        );

        this.moveDownKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.S,
        );

        this.moveLeftKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.A,
        );

        this.moveRightKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.D,
        );

        this.reloadKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.R,
        );

        this.brushIncreaseKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.CLOSED_BRACKET,
        );

        this.brushDecreaseKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.OPEN_BRACKET,
        );

        this.brushShapeKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.B,
        );

        keyboard.addCapture([
            Phaser.Input.Keyboard.KeyCodes.TAB,
            Phaser.Input.Keyboard.KeyCodes.SPACE,
            Phaser.Input.Keyboard.KeyCodes.UP,
            Phaser.Input.Keyboard.KeyCodes.DOWN,
            Phaser.Input.Keyboard.KeyCodes.LEFT,
            Phaser.Input.Keyboard.KeyCodes.RIGHT,
        ]);
    }

    /*
     * HUD
     */

    private createHud(): void {
        this.phaseText = this.add
            .text(
                this.gameWidth / 2,
                14,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '22px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: '#fff4d6',
                    padding: {
                        x: 16,
                        y: 8,
                    },
                },
            )
            .setOrigin(0.5, 0)
            .setDepth(300);

        this.timerText = this.add
            .text(
                this.gameWidth / 2,
                62,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '22px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: '#fff4d6',
                    padding: {
                        x: 14,
                        y: 7,
                    },
                },
            )
            .setOrigin(0.5, 0)
            .setDepth(300);

        this.guideText = this.add
            .text(
                this.gameWidth / 2,
                this.gameHeight - 34,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '15px',
                    color: '#5b4636',
                    backgroundColor: '#fff4d6',
                    padding: {
                        x: 12,
                        y: 7,
                    },
                },
            )
            .setOrigin(0.5)
            .setDepth(300);

        this.statusText = this.add
            .text(
                this.gameWidth / 2,
                105,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: '#fff4d6',
                    padding: {
                        x: 10,
                        y: 6,
                    },
                },
            )
            .setOrigin(0.5)
            .setDepth(300)
            .setVisible(false);

        this.ammoText = this.add
            .text(
                this.gameWidth - 20,
                20,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: '#fff4d6',
                    padding: {
                        x: 10,
                        y: 7,
                    },
                    align: 'right',
                },
            )
            .setOrigin(1, 0)
            .setDepth(300);

        this.targetText = this.add
            .text(
                this.gameWidth - 20,
                82,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: '#fff4d6',
                    padding: {
                        x: 10,
                        y: 7,
                    },
                },
            )
            .setOrigin(1, 0)
            .setDepth(300);

        this.paintColorText = this.add
            .text(
                20,
                20,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: '#fff4d6',
                    padding: {
                        x: 10,
                        y: 7,
                    },
                },
            )
            .setDepth(300);

        this.brushSizeText = this.add
            .text(
                20,
                61,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: '#fff4d6',
                    padding: {
                        x: 10,
                        y: 7,
                    },
                },
            )
            .setDepth(300);

        this.updateAmmoText();
        this.updateTargetText();
        this.updatePaintHud();
    }

    private updateAmmoText(): void {
        if (this.isReloading) {
            this.ammoText.setText(
                `RELOADING...\n${this.ammo} / ${this.maxAmmo}`,
            );

            this.ammoText.setColor('#ffdf70');
            return;
        }

        const loaded = '●'.repeat(this.ammo);

        const empty = '○'.repeat(
            this.maxAmmo - this.ammo,
        );

        this.ammoText.setText(
            `AMMO ${this.ammo} / ${this.maxAmmo}\n${loaded}${empty}`,
        );

        this.ammoText.setColor('#26352b');
    }

    private updateTargetText(): void {
        this.targetText.setText(
            `HIDERS ${this.getAliveHiderCount()} / ${this.hiders.length}`,
        );
    }

    private updatePaintHud(): void {
        if (
            !this.paintColorText ||
            !this.brushSizeText
        ) {
            return;
        }

        const hexColor = this.paintColor
            .toString(16)
            .padStart(6, '0')
            .toUpperCase();

        this.paintColorText.setText(
            `COLOR #${hexColor}`,
        );

        this.paintColorText.setBackgroundColor(
            `#${hexColor}`,
        );

        const color =
            Phaser.Display.Color.IntegerToColor(
                this.paintColor,
            );

        const brightness =
            color.red * 0.299 +
            color.green * 0.587 +
            color.blue * 0.114;

        this.paintColorText.setColor(
            brightness > 150
                ? '#000000'
                : '#ffffff',
        );

        const shapeText =
            this.getBrushShapeLabel();

        this.brushSizeText.setText(
            `BRUSH ${shapeText} ${this.brushSize}`,
        );

        this.updatePaintControlHelp();
    }

    private showStatus(message: string): void {
        this.statusText
            .setText(message)
            .setVisible(true)
            .setAlpha(1);

        this.time.delayedCall(1400, () => {
            if (
                this.statusText.text === message
            ) {
                this.statusText.setVisible(false);
            }
        });
    }

    /*
     * Timer and phase
     */

    private updateRoundTimer(): void {
        if (
            this.phase !== 'paint' &&
            this.phase !== 'hunt'
        ) {
            return;
        }

        const remainingMilliseconds =
            this.phaseEndTime - this.time.now;

        const remainingSeconds = Math.max(
            0,
            Math.ceil(
                remainingMilliseconds / 1000,
            ),
        );

        this.timerText.setText(
            `TIME ${remainingSeconds}`,
        );

        this.timerText.setColor(
            remainingSeconds <= 5
                ? '#ff5c5c'
                : '#ffffff',
        );

        if (
            remainingMilliseconds > 0 ||
            multiplayerClient.isConnected()
        ) {
            return;
        }

        if (this.phase === 'paint') {
            this.startHunt();
            return;
        }

        if (this.phase === 'hunt') {
            this.showHiderVictory();
        }
    }

    private enterPaintPhase(): void {
        this.phase = 'paint';

        this.phaseEndTime =
            this.time.now +
            this.paintDuration * 1000;

        this.selectedHiderIndex = 0;
        this.isPainting = false;
        this.paintColor =
            this.defaultPaintColor;

        this.createBrushTexture();

        this.phaseText.setText(
            '🎨 CAMOUFLAGE PHASE',
        );

        this.guideText.setText(
            '자신의 캐릭터를 배경과 비슷하게 위장하세요.',
        );

        this.player.setVisible(false);
        this.hunterVisuals.forEach(({ object }) => object.setVisible(false));
        this.gun.setVisible(false);
        this.hunterLabel.setVisible(false);

        this.aimLine.clear();
        this.crosshair.clear();

        this.networkPlayerManager
            ?.clearHunterAimLines();

        this.selectionRing.setVisible(true);
        this.paintPreview.setVisible(false);

        this.paintColorText.setVisible(true);
        this.brushSizeText.setVisible(true);
        this.setPaintPaletteVisible(true);
        this.highlightPaletteColor(
            this.paintColor,
        );

        this.ammoText.setVisible(false);
        this.targetText.setVisible(false);

        this.hiders.forEach((hider) => {
            this.setHiderVisible(hider, true);
            hider.label.setVisible(true);
        });

        this.selectHider(0);
        this.updatePaintHud();

        this.showStatus(
            `${this.paintDuration}초 안에 위장하세요`,
        );

        this.input.setDefaultCursor('crosshair');
    }

    private startHunt(): void {
        if (
            multiplayerClient.isConnected()
        ) {
            this.networkPlayerManager
                .normalizeLocalPlayerForGameplay();
        }

        if (
            this.phase !== 'paint' &&
            !multiplayerClient.isConnected()
        ) {
            return;
        }

        this.phase = 'hunt';

        this.phaseEndTime =
            this.time.now +
            this.huntDuration * 1000;

        this.ammo = this.maxAmmo;
        this.canShoot = true;
        this.isReloading = false;
        this.isPainting = false;

        this.phaseText.setText(
            '🔫 HUNT PHASE',
        );

        this.guideText.setText(
            'WASD 이동 · 마우스 조준 · 좌클릭 발사 · R 재장전',
        );

        this.player.setPosition(
            100,
            this.gameHeight / 2,
        );

        this.updateHunterObjects();

        this.player.setVisible(true);
        this.hunterVisuals.forEach(({ object }) => object.setVisible(true));
        this.gun.setVisible(true);
        this.hunterLabel.setVisible(true);

        this.selectionRing.setVisible(false);
        this.paintPreview.setVisible(false);

        this.paintColorText.setVisible(false);
        this.brushSizeText.setVisible(false);

        this.ammoText.setVisible(true);
        this.targetText.setVisible(true);

        this.hiders.forEach((hider) => {
            hider.label.setVisible(false);
        });

        this.updateAmmoText();
        this.updateTargetText();

        this.showStatus(
            `${this.huntDuration}초 안에 하이더를 찾으세요`,
        );

        this.input.setDefaultCursor('none');
    }

    private showHunterVictory(): void {
        if (this.phase !== 'hunt') {
            return;
        }

        this.phase = 'hunterVictory';

        this.phaseText.setText(
            '🏆 HUNTER VICTORY',
        );

        this.timerText
            .setText('HUNTER WIN')
            .setColor('#ffdf70');

        this.guideText.setText(
            '모든 하이더를 발견했습니다 · 자동으로 대기실로 이동',
        );

        this.player.setVisible(false);
        this.hunterVisuals.forEach(({ object }) => object.setVisible(false));
        this.gun.setVisible(false);
        this.hunterLabel.setVisible(false);

        this.aimLine.clear();
        this.crosshair.clear();

        this.showStatus(
            '모든 하이더를 찾았습니다!',
        );

        this.cameras.main.flash(
            350,
            255,
            255,
            255,
        );

        this.input.setDefaultCursor('default');
    }

    private showHiderVictory(): void {
        if (
            multiplayerClient.isConnected()
        ) {
            return;
        }

        if (this.phase !== 'hunt') {
            return;
        }

        this.phase = 'hiderVictory';

        this.phaseText.setText(
            '🌿 HIDER VICTORY',
        );

        this.timerText
            .setText('HIDERS WIN')
            .setColor('#8cff9b');

        this.guideText.setText(
            '시간 종료 · 자동으로 대기실로 이동',
        );

        this.player.setVisible(false);
        this.hunterVisuals.forEach(({ object }) => object.setVisible(false));
        this.gun.setVisible(false);
        this.hunterLabel.setVisible(false);

        this.aimLine.clear();
        this.crosshair.clear();

        this.hiders.forEach((hider) => {
            if (!hider.alive) {
                return;
            }

            hider.label
                .setText('SURVIVED')
                .setColor('#8cff9b')
                .setVisible(true);

            const targets: Phaser.GameObjects.GameObject[] = [
                ...this.getAllPartObjects(hider),
                    hider.paintTexture,
            ];

            this.tweens.add({
                targets,
                scale: 1.18,
                duration: 220,
                yoyo: true,
                repeat: 2,
            });
        });

        this.showStatus(
            `${this.getAliveHiderCount()}명의 하이더가 살아남았습니다`,
        );

        this.cameras.main.flash(
            350,
            100,
            255,
            140,
        );

        this.input.setDefaultCursor('default');
    }

    private destroyHiders(): void {
        this.hiders.forEach((hider) => {
            this.getAllPartObjects(hider).forEach(
                (object) => {
                    object.destroy();
                },
            );

            hider.label.destroy();
            hider.paintTexture.destroy();
            hider.paintMask.destroy();
            hider.paintMaskShape.destroy();
        });

        this.hiders = [];
    }

    private setHiderVisible(
        hider: Hider,
        visible: boolean,
    ): void {
        this.getAllPartObjects(hider).forEach(
            (object) => {
                object
                    .setVisible(visible)
                    .setAlpha(1)
                    .setScale(1);
            },
        );

        hider.paintTexture
            .setVisible(visible)
            .setAlpha(1)
            .setScale(1);
    }

    private getAliveHiderCount(): number {
        return this.hiders.filter(
            (hider) => hider.alive,
        ).length;
    }

    private createBrushTexture(): void {
        if (
            this.textures.exists(
                this.brushTextureKey,
            )
        ) {
            this.textures.remove(
                this.brushTextureKey,
            );
        }

        const radius =
            Math.max(
                1,
                Math.round(
                    this.brushSize,
                ),
            );

        const diameter =
            radius * 2 + 1;

        const graphics =
            this.add.graphics();

        graphics.fillStyle(
            this.paintColor,
            1,
        );

        if (
            this.brushShape ===
            'dotCircle'
        ) {
            for (
                let y = -radius;
                y <= radius;
                y += 1
            ) {
                const halfWidth =
                    Math.floor(
                        Math.sqrt(
                            Math.max(
                                0,
                                radius * radius -
                                y * y,
                            ),
                        ),
                    );

                graphics.fillRect(
                    radius - halfWidth,
                    radius + y,
                    halfWidth * 2 + 1,
                    1,
                );
            }
        } else if (
            this.brushShape ===
            'circle'
        ) {
            graphics.fillCircle(
                radius,
                radius,
                radius,
            );
        } else {
            graphics.fillRect(
                0,
                0,
                diameter,
                diameter,
            );
        }

        graphics.generateTexture(
            this.brushTextureKey,
            diameter,
            diameter,
        );

        graphics.destroy();
    }

}

export default GameScene;