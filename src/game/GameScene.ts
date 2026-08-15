import Phaser from 'phaser';
import {
    multiplayerClient,
    type NetworkBrushShape,
    type NetworkPaintPoint,
    type NetworkPaintStroke,
    type NetworkAvatarPreset,
    type NetworkPlayerState,
    type NetworkShotFired,
    type NetworkHunterAim,
    type NetworkWeaponState,
    type NetworkRoundResult,
    type PublicRoomInfo,
} from '../network/MultiplayerClient';
import { NetworkPlayerManager } from '../multiplayer/NetworkPlayerManager';
import { getLanguage, setLanguage, tr, trPhase, type GameLanguage } from '../i18n';

type GamePhase =
    | 'lobby'
    | 'countdown'
    | 'paint'
    | 'hunt'
    | 'hunterVictory'
    | 'hiderVictory'
    | 'finished';

type BrushShape = 'dotCircle' | 'circle' | 'square';
type PendingReloadJoin = {
    roomId: string;
    playerName: string;
    password: string;
    isPrivate: boolean;
};

type PendingReloadCreate = {
    playerName: string;
    roomTitle: string;
    password: string;
    isPrivate: boolean;
};

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

    private brushPlusKey!: Phaser.Input.Keyboard.Key;
    private brushMinusKey!: Phaser.Input.Keyboard.Key;
    private brushNumpadPlusKey!: Phaser.Input.Keyboard.Key;
    private brushNumpadMinusKey!: Phaser.Input.Keyboard.Key;
    private brushShapeKey!: Phaser.Input.Keyboard.Key;
    private spectatorKey!: Phaser.Input.Keyboard.Key;
    private undoPaintKey!: Phaser.Input.Keyboard.Key;
    private redoPaintKey!: Phaser.Input.Keyboard.Key;
    private shiftPaintKey!: Phaser.Input.Keyboard.Key;
    private controlPaintKey!: Phaser.Input.Keyboard.Key;

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

    private readonly standardPaintColors = [
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

    private brushSize = 4;
    private brushShape: BrushShape = 'circle';
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
    private shotgunSound!: Phaser.Sound.BaseSound;
    private heartbeatSound!: Phaser.Sound.BaseSound;
    private backgroundMusic!: Phaser.Sound.BaseSound;
    private lobbyMusic!: Phaser.Sound.BaseSound;
    private huntMusic!: Phaser.Sound.BaseSound;
    private paintSound!: Phaser.Sound.BaseSound;
    private paintMusic!: Phaser.Sound.BaseSound;
    private victorySound!: Phaser.Sound.BaseSound;
    private hitSound!: Phaser.Sound.BaseSound;
    private hunterHitConfirmSound!: Phaser.Sound.BaseSound;
    private countdownBeepSound!: Phaser.Sound.BaseSound;
    private countdownStartSound!: Phaser.Sound.BaseSound;
    private lastCountdownSoundValue = -1;
    private readonly lobbyBgmResumeKey = 'chameleon-hunt-lobby-bgm-resume';
    private lobbyBgmResumeApplied = false;
    private audioUnlocked = false;
    private bgmEnabled =
        localStorage.getItem('chameleon-hunt-bgm-enabled') !== 'false';
    private bgmToggleButton!: Phaser.GameObjects.Text;
    private lastPaintSoundAt = 0;

    /*
     * Timer
     */
    private paintDuration = 120;
    private huntDuration = 80;

    private phaseEndTime = 0;

    /*
     * HUD
     */
    private phaseText!: Phaser.GameObjects.Text;
    private timerText!: Phaser.GameObjects.Text;
    private guideText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    private ammoText!: Phaser.GameObjects.Text;

    /*
     * Hunter weapon HUD
     * - ammo: 숫자/SHELLS 문자열 대신 shotgun shell 아이콘
     * - heat: 문자 □ 게이지 대신 연속형 animated bar
     */
    private hunterWeaponHudContainer!: Phaser.GameObjects.Container;
    private hunterAmmoGraphics!: Phaser.GameObjects.Graphics;
    private hunterHeatGraphics!: Phaser.GameObjects.Graphics;
    private hunterHeatLabel!: Phaser.GameObjects.Text;
    private hunterOverheatLabel!: Phaser.GameObjects.Text;

    private targetText!: Phaser.GameObjects.Text;

    private survivalHudGraphics!: Phaser.GameObjects.Graphics;
    private survivalHudText!: Phaser.GameObjects.Text;
    private knownAliveState =
        new Map<string, boolean>();

    private paintColorText!: Phaser.GameObjects.Text;
    private brushSizeText!: Phaser.GameObjects.Text;
    private paletteObjects: Phaser.GameObjects.GameObject[] = [];
    private hunterCamoPaletteObjects: Phaser.GameObjects.GameObject[] = [];
    private hunterCamoColors: number[] = [];
    private paintZoomText!: Phaser.GameObjects.Text;
    private paintControlHelpText!: Phaser.GameObjects.Text;

    private createSurvivalHud(): void {
        this.survivalHudGraphics =
            this.add.graphics()
                .setScrollFactor(0)
                .setDepth(6010)
                .setVisible(false);

        this.survivalHudText =
            this.add.text(
                this.gameWidth / 2,
                46,
                '',
                {
                    fontFamily:
                        'monospace',
                    fontSize: '12px',
                    fontStyle: 'bold',
                    color: '#ffffff',
                    backgroundColor:
                        'rgba(15,23,32,0.72)',
                    padding: {
                        x: 9,
                        y: 4,
                    },
                },
            )
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setDepth(6011)
                .setVisible(false);
    }

    private getAuthoritativeAliveHiderCount(): number {
        const room =
            multiplayerClient.getRoom();

        if (!room?.state?.players) {
            return 0;
        }

        let aliveCount = 0;

        room.state.players.forEach(
            (player: NetworkPlayerState) => {
                if (
                    player.role === 'hider' &&
                    player.alive
                ) {
                    aliveCount += 1;
                }
            },
        );

        return aliveCount;
    }

    private updateSurvivalHud(): void {
        if (
            !this.survivalHudGraphics ||
            !this.survivalHudText
        ) {
            return;
        }

        const localRole =
            multiplayerClient
                .getLocalPlayer()
                ?.role;

        /*
         * During Hunter customization the top paint UI is already dense.
         * Hide the survival HUD only for the Hunter in Paint.
         *
         * Hiders can still see it during Paint, and BOTH roles see it
         * throughout Hunt.
         */
        const visible =
            this.isMultiplayerSession() &&
            (
                this.phase === 'countdown' ||
                (
                    this.phase === 'paint' &&
                    localRole === 'hider'
                ) ||
                this.phase === 'hunt'
            );

        if (!visible) {
            this.survivalHudGraphics
                .setVisible(false);

            this.survivalHudText
                .setVisible(false);

            return;
        }

        const room =
            multiplayerClient.getRoom();

        if (!room?.state?.players) {
            this.survivalHudGraphics
                .setVisible(false);

            this.survivalHudText
                .setVisible(false);
            return;
        }

        const hiders:
            NetworkPlayerState[] = [];

        let hunterCount = 0;

        room.state.players.forEach(
            (player: NetworkPlayerState) => {
                if (
                    player.role === 'hunter'
                ) {
                    hunterCount += 1;
                } else {
                    hiders.push(player);
                }
            },
        );

        /*
         * PERSON ICON
         *
         * HIDER : bright beige person
         * FOUND : same person, translucent
         * HUNTER: black person
         */
        const hiderSpacing = 18;
        const hunterSpacing = 18;
        const dividerGap = 28;

        const totalWidth =
            Math.max(
                hiders.length,
                1,
            ) *
                hiderSpacing +
            dividerGap +
            Math.max(
                hunterCount,
                1,
            ) *
                hunterSpacing;

        let x =
            this.gameWidth / 2 -
            totalWidth / 2 +
            7;

        const headY = 15;
        const bodyY = 24;

        this.survivalHudGraphics
            .clear()
            .setVisible(true);

        hiders.forEach(
            (player) => {
                const alpha =
                    player.alive
                        ? 1
                        : 0.22;

                this.survivalHudGraphics
                    .fillStyle(
                        0xf5eee2,
                        alpha,
                    )
                    .fillCircle(
                        x,
                        headY,
                        4,
                    )
                    .fillRoundedRect(
                        x - 4,
                        bodyY - 5,
                        8,
                        11,
                        2,
                    );

                /*
                 * Small arms make the symbol read as a person rather than
                 * a circle/rectangle pair.
                 */
                this.survivalHudGraphics
                    .lineStyle(
                        2,
                        0xf5eee2,
                        alpha,
                    )
                    .lineBetween(
                        x - 6,
                        bodyY - 2,
                        x + 6,
                        bodyY - 2,
                    )
                    .lineBetween(
                        x - 2,
                        bodyY + 5,
                        x - 3,
                        bodyY + 10,
                    )
                    .lineBetween(
                        x + 2,
                        bodyY + 5,
                        x + 3,
                        bodyY + 10,
                    );

                x += hiderSpacing;
            },
        );

        x += dividerGap;

        for (
            let index = 0;
            index < hunterCount;
            index += 1
        ) {
            this.survivalHudGraphics
                .fillStyle(
                    0x090d12,
                    1,
                )
                .fillCircle(
                    x,
                    headY,
                    4,
                )
                .fillRoundedRect(
                    x - 4,
                    bodyY - 5,
                    8,
                    11,
                    2,
                )
                .lineStyle(
                    2,
                    0x090d12,
                    1,
                )
                .lineBetween(
                    x - 6,
                    bodyY - 2,
                    x + 6,
                    bodyY - 2,
                )
                .lineBetween(
                    x - 2,
                    bodyY + 5,
                    x - 3,
                    bodyY + 10,
                )
                .lineBetween(
                    x + 2,
                    bodyY + 5,
                    x + 3,
                    bodyY + 10,
                );

            x += hunterSpacing;
        }

        this.survivalHudText
            .setText(
                `${tr('HIDER')}   /   ${tr('HUNTER')}`,
            )
            .setPosition(
                this.gameWidth / 2,
                48,
            )
            .setVisible(true)
            .setAlpha(0.92);
    }

    private showHiderFoundEffect(
        sessionId: string,
    ): void {
        const position =
            this.networkPlayerManager
                .getPlayerPosition(
                    sessionId,
                );

        if (!position) {
            return;
        }

        const localIsHunter =
            multiplayerClient
                .getLocalPlayer()
                ?.role === 'hunter';

        const burst =
            this.add.graphics()
                .setDepth(5900)
                .lineStyle(
                    4,
                    0xffe27a,
                    1,
                );

        for (
            let index = 0;
            index < 12;
            index += 1
        ) {
            const angle =
                (
                    Math.PI * 2 *
                    index
                ) / 12;

            burst.lineBetween(
                position.x +
                    Math.cos(angle) * 8,
                position.y +
                    Math.sin(angle) * 8,
                position.x +
                    Math.cos(angle) * 32,
                position.y +
                    Math.sin(angle) * 32,
            );
        }

        const foundText =
            this.add.text(
                position.x,
                position.y - 42,
                `💥 ${tr('찾았다!')}`,
                {
                    fontFamily:
                        'Arial, sans-serif',
                    fontSize: '21px',
                    fontStyle: 'bold',
                    color: '#fff6a5',
                    stroke: '#5a220c',
                    strokeThickness: 5,
                },
            )
                .setOrigin(0.5)
                .setDepth(5901);

        this.tweens.add({
            targets: burst,
            alpha: 0,
            scaleX: 1.8,
            scaleY: 1.8,
            duration: 520,
            onComplete: () => {
                burst.destroy();
            },
        });

        this.tweens.add({
            targets: foundText,
            y: position.y - 74,
            alpha: 0,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 850,
            ease: 'Back.easeOut',
            onComplete: () => {
                foundText.destroy();
            },
        });

        this.cameras.main.shake(
            localIsHunter
                ? 160
                : 100,
            localIsHunter
                ? 0.009
                : 0.004,
        );

        if (localIsHunter) {
            this.hunterHitConfirmSound
                ?.play({
                    volume: 0.82,
                    rate: 0.92,
                });

            this.showStatus(
                tr('찾았다!'),
            );

            this.time.delayedCall(
                900,
                () => {
                    if (
                        this.statusText.text ===
                        tr('찾았다!')
                    ) {
                        this.clearStatus();
                    }
                },
            );
        } else if (
            sessionId ===
            multiplayerClient
                .getSessionId()
        ) {
            this.hitSound
                ?.play({
                    volume: 0.8,
                    rate: 0.88,
                });
        }
    }

    private createMobileControls(): void {
        /*
         * Spectator control exists on BOTH desktop and mobile.
         * Desktop keeps TAB as a shortcut but also gets a visible button.
         */
        this.spectatorButton =
            this.add.text(
                this.gameWidth - 148,
                76,
                this.mobileControlsEnabled
                    ? tr('시야 전환')
                    : tr('TAB · 시야 전환'),
                {
                    fontFamily:
                        'monospace',
                    fontSize: '10px',
                    fontStyle: 'bold',
                    color: '#ffffff',
                    backgroundColor:
                        '#416b8b',
                    fixedWidth: 122,
                    fixedHeight: 30,
                    align: 'center',
                    padding: {
                        top: 7,
                    },
                },
            )
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setDepth(6003)
                .setVisible(false)
                .setInteractive({
                    useHandCursor: true,
                });

        this.spectatorButton.on(
            'pointerdown',
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                pointer.event
                    ?.stopPropagation?.();

                this.cycleSpectatorView();
            },
        );

        this.spectatorStatusText =
            this.add.text(
                this.gameWidth - 148,
                112,
                '',
                {
                    fontFamily:
                        'monospace',
                    fontSize:
                        getLanguage() === 'ja'
                            ? '9px'
                            : '10px',
                    fontStyle: 'bold',
                    color: '#28445a',
                    backgroundColor:
                        'rgba(236, 247, 255, 0.94)',
                    fixedWidth: 188,
                    fixedHeight: 32,
                    align: 'center',
                    padding: {
                        top: 8,
                        left: 6,
                        right: 6,
                    },
                    wordWrap: {
                        width: 176,
                        useAdvancedWrap: true,
                    },
                },
            )
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setDepth(6003)
                .setVisible(false);

        if (!this.mobileControlsEnabled) {
            return;
        }

        /*
         * Movement is deliberately placed in the upper-left gameplay area.
         * The paint palette occupies the lower-left, so both remain visible
         * and independently touchable during Paint.
         */
        const moveX = 82;
        const moveY = 275;
        const aimX =
            this.gameWidth - 170;
        /*
         * Keep Hunter controls above the bottom-right minimap.
         * Minimap occupies roughly y=402..522 in the 960x540 game space.
         */
        const aimY =
            this.gameHeight - 190;
        const fireX =
            this.gameWidth - 64;
        const fireY =
            aimY;

        const createBase =
            (
                x: number,
                y: number,
            ): Phaser.GameObjects.Arc =>
                this.add.circle(
                    x,
                    y,
                    this.mobileJoystickRadius,
                    0x0f1720,
                    0.30,
                )
                    .setStrokeStyle(
                        3,
                        0xffffff,
                        0.52,
                    )
                    .setScrollFactor(0)
                    .setDepth(6000)
                    .setVisible(false);

        const createKnob =
            (
                x: number,
                y: number,
            ): Phaser.GameObjects.Arc =>
                this.add.circle(
                    x,
                    y,
                    19,
                    0xffffff,
                    0.42,
                )
                    .setStrokeStyle(
                        2,
                        0xffffff,
                        0.70,
                    )
                    .setScrollFactor(0)
                    .setDepth(6001)
                    .setVisible(false);

        this.mobileMoveBase =
            createBase(moveX, moveY);
        this.mobileMoveKnob =
            createKnob(moveX, moveY);
        this.mobileAimBase =
            createBase(aimX, aimY);
        this.mobileAimKnob =
            createKnob(aimX, aimY);

        const createJoystickLabel =
            (
                x: number,
                y: number,
                label: string,
            ): Phaser.GameObjects.Text =>
                this.add.text(
                    x,
                    y - 66,
                    label,
                    {
                        fontFamily:
                            'Arial, sans-serif',
                        fontSize: '12px',
                        fontStyle: 'bold',
                        color: '#ffffff',
                        backgroundColor:
                            'rgba(20, 31, 39, 0.72)',
                        align: 'center',
                        fixedWidth: 64,
                        fixedHeight: 24,
                        padding: {
                            top: 5,
                        },
                    },
                )
                    .setOrigin(0.5)
                    .setScrollFactor(0)
                    .setDepth(6002)
                    .setVisible(false);

        this.mobileMoveLabel =
            createJoystickLabel(
                moveX,
                moveY,
                tr('이동'),
            );

        this.mobileAimLabel =
            createJoystickLabel(
                aimX,
                aimY,
                tr('조준'),
            );

        this.mobileFireButton =
            this.add.circle(
                fireX,
                fireY,
                34,
                0xb53535,
                0.52,
            )
                .setStrokeStyle(
                    3,
                    0xffffff,
                    0.70,
                )
                .setScrollFactor(0)
                .setDepth(6000)
                .setVisible(false)
                .setInteractive({
                    useHandCursor: true,
                });

        this.mobileFireLabel =
            this.add.text(
                fireX,
                fireY,
                'FIRE',
                {
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    fontStyle: 'bold',
                    color: '#ffffff',
                    align: 'center',
                },
            )
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setDepth(6001)
                .setVisible(false);


        /*
         * Enough pointers for move + aim + fire / pinch gestures.
         */
        this.input.addPointer(4);

        this.input.on(
            Phaser.Input.Events.POINTER_DOWN,
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                this.mobileTouchPoints.set(
                    pointer.id,
                    new Phaser.Math.Vector2(
                        pointer.x,
                        pointer.y,
                    ),
                );

                const moveDistance =
                    Phaser.Math.Distance.Between(
                        pointer.x,
                        pointer.y,
                        moveX,
                        moveY,
                    );

                if (
                    this.mobileMoveBase?.visible &&
                    moveDistance <=
                        this.mobileJoystickRadius *
                        1.55
                ) {
                    this.mobileMovePointerId =
                        pointer.id;
                    this.updateMobileJoystick(
                        'move',
                        pointer.x,
                        pointer.y,
                    );
                    this.mobilePinchDistance = 0;
                    return;
                }

                if (
                    multiplayerClient
                        .getLocalPlayer()
                        ?.role === 'hunter' &&
                    this.phase === 'hunt'
                ) {
                    const aimDistance =
                        Phaser.Math.Distance.Between(
                            pointer.x,
                            pointer.y,
                            aimX,
                            aimY,
                        );

                    if (
                        this.mobileAimBase?.visible &&
                        aimDistance <=
                            this.mobileJoystickRadius *
                            1.55
                    ) {
                        this.mobileAimPointerId =
                            pointer.id;
                        this.updateMobileJoystick(
                            'aim',
                            pointer.x,
                            pointer.y,
                        );
                        return;
                    }
                }

                this.updateMobilePinchGesture();
            },
        );

        this.input.on(
            Phaser.Input.Events.POINTER_MOVE,
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                if (
                    !this.mobileTouchPoints.has(
                        pointer.id,
                    )
                ) {
                    return;
                }

                this.mobileTouchPoints.set(
                    pointer.id,
                    new Phaser.Math.Vector2(
                        pointer.x,
                        pointer.y,
                    ),
                );

                if (
                    pointer.id ===
                    this.mobileMovePointerId
                ) {
                    this.updateMobileJoystick(
                        'move',
                        pointer.x,
                        pointer.y,
                    );
                    return;
                }

                if (
                    pointer.id ===
                    this.mobileAimPointerId
                ) {
                    this.updateMobileJoystick(
                        'aim',
                        pointer.x,
                        pointer.y,
                    );
                    return;
                }

                this.updateMobilePinchGesture();
            },
        );

        const releasePointer =
            (
                pointer:
                    Phaser.Input.Pointer,
            ): void => {
                this.mobileTouchPoints.delete(
                    pointer.id,
                );

                if (
                    pointer.id ===
                    this.mobileMovePointerId
                ) {
                    this.mobileMovePointerId = -1;
                    this.mobileMoveX = 0;
                    this.mobileMoveY = 0;
                    this.mobileMoveKnob
                        ?.setPosition(
                            this.getFixedHudCompensatedX(
                                moveX,
                            ),
                            this.getFixedHudCompensatedY(
                                moveY,
                            ),
                        );
                }

                if (
                    pointer.id ===
                    this.mobileFirePointerId
                ) {
                    this.mobileFirePointerId = -1;
                }

                if (
                    pointer.id ===
                    this.mobileAimPointerId
                ) {
                    this.mobileAimPointerId = -1;
                    this.mobileAimKnob
                        ?.setPosition(
                            this.getFixedHudCompensatedX(
                                aimX,
                            ),
                            this.getFixedHudCompensatedY(
                                aimY,
                            ),
                        );
                }

                const realDownCount =
                    [
                        ...this.mobileTouchPoints
                            .keys(),
                    ].filter(
                        (id) =>
                            this.isMobilePointerActuallyDown(
                                id,
                            ),
                    ).length;

                if (realDownCount < 2) {
                    this.mobilePinchDistance = 0;
                    this.mobilePinchActive = false;
                }
            };

        this.input.on(
            Phaser.Input.Events.POINTER_UP,
            releasePointer,
        );

        this.input.on(
            Phaser.Input.Events.POINTER_UP_OUTSIDE,
            releasePointer,
        );

        this.mobileFireButton.on(
            'pointerdown',
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                pointer.event
                    ?.stopPropagation?.();

                if (
                    this.phase !== 'hunt' ||
                    multiplayerClient
                        .getLocalPlayer()
                        ?.role !== 'hunter'
                ) {
                    return;
                }

                this.mobileFirePointerId =
                    pointer.id;

                this.fireShotgun(
                    this.mobileAimAngle,
                );
            },
        );
    }

    private getFixedHudCompensatedX(
        baseX: number,
    ): number {
        const zoom =
            Math.max(
                0.01,
                this.cameras.main.zoom,
            );

        return (
            this.gameWidth / 2 +
            (
                baseX -
                this.gameWidth / 2
            ) /
            zoom
        );
    }

    private getFixedHudCompensatedY(
        baseY: number,
    ): number {
        const zoom =
            Math.max(
                0.01,
                this.cameras.main.zoom,
            );

        return (
            this.gameHeight / 2 +
            (
                baseY -
                this.gameHeight / 2
            ) /
            zoom
        );
    }

    private isMobileControlScreenPoint(
        screenX: number,
        screenY: number,
    ): boolean {
        if (!this.mobileControlsEnabled) {
            return false;
        }

        const moveDistance =
            Phaser.Math.Distance.Between(
                screenX,
                screenY,
                82,
                275,
            );

        if (
            this.mobileMoveBase?.visible &&
            moveDistance <=
                this.mobileJoystickRadius *
                1.65
        ) {
            return true;
        }

        const aimDistance =
            Phaser.Math.Distance.Between(
                screenX,
                screenY,
                this.gameWidth - 170,
                this.gameHeight - 190,
            );

        if (
            this.mobileAimBase?.visible &&
            aimDistance <=
                this.mobileJoystickRadius *
                1.65
        ) {
            return true;
        }

        const fireDistance =
            Phaser.Math.Distance.Between(
                screenX,
                screenY,
                this.gameWidth - 64,
                this.gameHeight - 190,
            );

        return Boolean(
            this.mobileFireButton?.visible &&
            fireDistance <= 48
        );
    }

    private isMobilePointerActuallyDown(
        pointerId: number,
    ): boolean {
        const manager =
            this.input.manager as unknown as {
                pointers?: Array<{
                    id: number;
                    isDown: boolean;
                }>;
            };

        return Boolean(
            manager.pointers?.some(
                (pointer) =>
                    pointer.id === pointerId &&
                    pointer.isDown,
            ),
        );
    }

    private updateMobilePinchGesture(): void {
        if (
            this.phase !== 'paint' ||
            !this.isMultiplayerSession()
        ) {
            this.mobilePinchDistance = 0;
            this.mobilePinchActive = false;
            return;
        }

        const activeTouches =
            [...this.mobileTouchPoints.entries()]
                .filter(
                    ([id, point]) =>
                        this.isMobilePointerActuallyDown(
                            id,
                        ) &&
                        id !==
                            this.mobileMovePointerId &&
                        id !==
                            this.mobileAimPointerId &&
                        id !==
                            this.mobileFirePointerId &&
                        !this.isMobileControlScreenPoint(
                            point.x,
                            point.y,
                        ),
                );

        /*
         * Exactly two physically-held fingers are required.
         * One finger can never enter zoom logic, even if a stale pointer
         * coordinate remains in mobileTouchPoints.
         */
        if (activeTouches.length !== 2) {
            this.mobilePinchDistance = 0;
            this.mobilePinchActive = false;
            return;
        }

        const first =
            activeTouches[0][1];

        const second =
            activeTouches[1][1];

        const distance =
            Phaser.Math.Distance.Between(
                first.x,
                first.y,
                second.x,
                second.y,
            );

        if (
            this.mobilePinchDistance <= 0
        ) {
            /*
             * Second finger only ARMS pinch.
             * Merely touching with finger #2 must not zoom or cancel paint.
             */
            this.mobilePinchDistance =
                distance;
            return;
        }

        const delta =
            distance -
            this.mobilePinchDistance;

        /*
         * Require a deliberate pinch before changing camera zoom.
         */
        if (
            !this.mobilePinchActive &&
            Math.abs(delta) < 14
        ) {
            return;
        }

        if (!this.mobilePinchActive) {
            this.mobilePinchActive = true;

            /*
             * Commit an already-started stroke before switching to zoom.
             * A preview-only touch is simply cancelled.
             */
            if (this.isPainting) {
                this.finishActivePaintStroke();
                this.isPainting = false;
            }

            if (
                this.mobilePendingPaintPointerId >= 0
            ) {
                this.clearMobilePendingPaint();
            }

            this.clearStraightLinePreview();
        }

        if (Math.abs(delta) < 8) {
            return;
        }

        const zoom =
            this.adjustPaintWorldZoom(
                delta > 0
                    ? -1
                    : 1,
            );

        this.mobilePinchDistance =
            distance;

        this.networkPlayerManager
            .showOnlyLocalPlayer();

        this.paintZoomText.setText(
            [
                tr(`ZOOM ${zoom.toFixed(2)}x`),
                tr(`BRUSH ${this.brushSize}`),
                tr('두 손가락: 확대/축소'),
            ].join('\n'),
        );

        this.updatePaintPreviewImmediately();
    }

    private updateMobileJoystick(
        kind: 'move' | 'aim',
        screenX: number,
        screenY: number,
    ): void {
        const baseX =
            kind === 'move'
                ? 82
                : this.gameWidth - 170;
        const baseY =
            kind === 'move'
                ? 275
                : this.gameHeight - 190;

        const deltaX =
            screenX - baseX;
        const deltaY =
            screenY - baseY;

        const length =
            Math.max(
                0.001,
                Math.sqrt(
                    deltaX * deltaX +
                    deltaY * deltaY,
                ),
            );

        const clampedLength =
            Math.min(
                this.mobileJoystickRadius,
                length,
            );

        const normalizedX =
            deltaX / length;
        const normalizedY =
            deltaY / length;

        const knobX =
            baseX +
            normalizedX *
                clampedLength;
        const knobY =
            baseY +
            normalizedY *
                clampedLength;

        if (kind === 'move') {
            this.mobileMoveKnob
                ?.setPosition(
                    this.getFixedHudCompensatedX(
                        knobX,
                    ),
                    this.getFixedHudCompensatedY(
                        knobY,
                    ),
                );

            const strength =
                Phaser.Math.Clamp(
                    length /
                        this.mobileJoystickRadius,
                    0,
                    1,
                );

            if (strength < 0.16) {
                this.mobileMoveX = 0;
                this.mobileMoveY = 0;
            } else {
                this.mobileMoveX =
                    normalizedX *
                    strength;
                this.mobileMoveY =
                    normalizedY *
                    strength;
            }
            return;
        }

        this.mobileAimKnob
            ?.setPosition(
                this.getFixedHudCompensatedX(
                    knobX,
                ),
                this.getFixedHudCompensatedY(
                    knobY,
                ),
            );

        if (length >= 6) {
            this.mobileAimAngle =
                Math.atan2(
                    normalizedY,
                    normalizedX,
                );
            this.mobileAimHasDirection =
                true;
        }
    }

    private updateMobileControlVisibility(): void {
        const inRoomForSpectator =
            multiplayerClient.isConnected();

        const roleForSpectator =
            multiplayerClient
                .getLocalPlayer()
                ?.role;

        const showSpectatorButton =
            inRoomForSpectator &&
            this.phase === 'hunt' &&
            roleForSpectator === 'hider';

        this.spectatorButton
            ?.setText(
                this.mobileControlsEnabled
                    ? tr('시야 전환')
                    : tr('TAB · 시야 전환'),
            )
            .setVisible(
                showSpectatorButton,
            );

        this.spectatorStatusText
            ?.setVisible(
                showSpectatorButton &&
                Boolean(
                    this.spectatorSessionId,
                ),
            );

        if (
            showSpectatorButton &&
            this.spectatorButton
        ) {
            this.setFixedHudScreenPosition(
                this.spectatorButton,
                this.gameWidth - 148,
                76,
            );

            if (
                this.spectatorStatusText
            ) {
                this.setFixedHudScreenPosition(
                    this.spectatorStatusText,
                    this.gameWidth - 148,
                    111,
                );
            }
        }

        if (!this.mobileControlsEnabled) {
            return;
        }

        const inRoom =
            multiplayerClient.isConnected();
        const localRole =
            multiplayerClient
                .getLocalPlayer()
                ?.role;

        const canMove =
            inRoom &&
            (
                this.phase === 'lobby' ||
                this.phase === 'paint' ||
                this.phase === 'hunt'
            ) &&
            !this.networkPlayerManager
                .isLocalCustomizationMode();

        const showHunterCombat =
            canMove &&
            this.phase === 'hunt' &&
            localRole === 'hunter';

        this.mobileMoveBase
            ?.setVisible(canMove);
        this.mobileMoveKnob
            ?.setVisible(canMove);

        this.mobileMoveLabel
            ?.setText(
                tr('이동'),
            )
            .setVisible(canMove);

        this.mobileAimBase
            ?.setVisible(showHunterCombat);
        this.mobileAimKnob
            ?.setVisible(showHunterCombat);

        this.mobileAimLabel
            ?.setText(
                tr('조준'),
            )
            .setVisible(showHunterCombat);
        this.mobileFireButton
            ?.setVisible(showHunterCombat);
        this.mobileFireLabel
            ?.setVisible(showHunterCombat);

        if (
            canMove &&
            this.mobileMoveLabel
        ) {
            this.setFixedHudScreenPosition(
                this.mobileMoveLabel,
                82,
                209,
            );
        }

        if (
            showHunterCombat &&
            this.mobileAimLabel
        ) {
            this.setFixedHudScreenPosition(
                this.mobileAimLabel,
                this.gameWidth - 170,
                this.gameHeight - 256,
            );
        }

        if (!canMove) {
            this.mobileMovePointerId = -1;
            this.mobileMoveX = 0;
            this.mobileMoveY = 0;
        }

        if (!showHunterCombat) {
            this.mobileAimPointerId = -1;
            this.mobileAimKnob
                ?.setPosition(
                    this.getFixedHudCompensatedX(
                        this.gameWidth - 170,
                    ),
                    this.getFixedHudCompensatedY(
                        this.gameHeight - 190,
                    ),
                );
        }
    }

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
    private inviteLinkButton!: Phaser.GameObjects.Text;
    private leaveRoomButton!: Phaser.GameObjects.Text;
    private lobbyHintText!: Phaser.GameObjects.Text;
    private lobbyMovementHelpText!: Phaser.GameObjects.Text;
    private lobbyPaintDurationLabel!: Phaser.GameObjects.Text;
    private paintDurationButtons: Phaser.GameObjects.Text[] = [];
    private lobbyHuntDurationLabel!: Phaser.GameObjects.Text;
    private huntDurationButtons: Phaser.GameObjects.Text[] = [];
    private brushSizeSliderTrack?: Phaser.GameObjects.Rectangle;
    private brushSizeSliderFill?: Phaser.GameObjects.Rectangle;
    private brushSizeSliderKnob?: Phaser.GameObjects.Arc;
    private brushSizeSliderLabel?: Phaser.GameObjects.Text;
    private brushSizeSliderDragging = false;


    /*
     * Map selection
     */
    private readonly selectableMaps = [
        'random',
        ...Array.from(
            { length: 11 },
            (_, index) =>
                `map${index + 1}`,
        ),
    ];
    private mapSelectorPanel!: Phaser.GameObjects.Rectangle;
    private mapSelectorLabel!: Phaser.GameObjects.Text;
    private mapPreviousButton!: Phaser.GameObjects.Text;
    private mapNextButton!: Phaser.GameObjects.Text;
    private currentBackgroundTextureKey = 'forest-background';

    private inviteJoinTriggered = false;
    private menuModalOverlay?: HTMLDivElement;
    private menuOperationSerial = 0;
    private menuOperationCancelled = false;
    private pendingInviteRoomId = '';
    private pendingInvitePrivate = false;
    private mainMenuObjects: Phaser.GameObjects.GameObject[] = [];
    private roomListObjects: Phaser.GameObjects.GameObject[] = [];
    private roomListRenderSerial = 0;
    private roomListRefreshEvent?: Phaser.Time.TimerEvent;
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
    private readonly gameplayCameraZoom = 1.65;
    private roundResultWinner: 'hunters' | 'hiders' | null = null;
    private roundResultMessage = '';
    private lastPhaseRecoveryAt = 0;
    private gameplayUiSnapshots = new Map<
        Phaser.GameObjects.GameObject,
        {
            x: number;
            y: number;
            scaleX: number;
            scaleY: number;
        }
    >();
    private fixedHudBaseTransforms = new Map<
        Phaser.GameObjects.GameObject,
        {
            x: number;
            y: number;
            scaleX: number;
            scaleY: number;
        }
    >();
    private networkPlayerCount = 0;
    private roomTransitionInProgress = false;
    private roomHandshakeSerial = 0;
    private roomHandshakeEvent?: Phaser.Time.TimerEvent;
    private roomHandshakeCompletedId = '';
    private localNetworkPlayerReady = false;
    private multiplayerSessionActive = false;
    private networkUnsubscribers: Array<() => void> = [];
    private networkPlayerManager!: NetworkPlayerManager;
    private activeStrokePoints: NetworkPaintPoint[] = [];
    private activeStrokeTargetSessionId = '';
    private currentStrokeHistoryPoints: NetworkPaintPoint[] = [];
    private localPaintHistory: NetworkPaintStroke[] = [];
    private redoPaintHistory: NetworkPaintStroke[] = [];
    private lobbyAvatarPreset: NetworkPaintStroke[] = [];
    private readonly lobbyAvatarPresetStorageKey =
        'chameleon-hunt-avatar-preset-v1';
    private lobbyAvatarPresetsBySession =
        new Map<string, NetworkPaintStroke[]>();
    private straightLineStart?: NetworkPaintPoint;
    private straightLineStartWorld?: Phaser.Math.Vector2;
    private straightLinePreview?: Phaser.GameObjects.Graphics;
    private straightLineModeActive = false;
    private undoPaintButton?: Phaser.GameObjects.Text;
    private redoPaintButton?: Phaser.GameObjects.Text;
    private mobilePaintPrecisionRing?: Phaser.GameObjects.Arc;
    private mobilePaintPrecisionCrosshair?: Phaser.GameObjects.Graphics;
    private spectatorButton?: Phaser.GameObjects.Text;
    private spectatorStatusText?: Phaser.GameObjects.Text;
    private spectatorSessionId = '';
    private spectatorCycleIndex = -1;
    private hunterFocusAngle = 0;
    private readonly remoteBrushTexturePrefix =
        'remote-paint-brush';

    /*
     * Hunt tension
     */
    private hiderVisionOverlays: Phaser.GameObjects.Rectangle[] = [];
    private hiderVisionGraphics!: Phaser.GameObjects.Graphics;
    /*
     * Hunt 중 Hider의 시야 크기는 Hunter 거리와 무관하게 고정합니다.
     */
    private readonly hiderVisionRadiusScreen = 205;

    private heartbeatDangerOverlay!: Phaser.GameObjects.Rectangle;
    private heartbeatBorders: Phaser.GameObjects.Rectangle[] = [];
    private heartbeatText!: Phaser.GameObjects.Text;
    private hidePointText!: Phaser.GameObjects.Text;
    private hidePoints = 0;
    private nextHeartbeatAt = 0;

    private hunterMinimapPanel!: Phaser.GameObjects.Rectangle;
    private hunterMinimapMarker!: Phaser.GameObjects.Arc;
    private hunterMinimapText!: Phaser.GameObjects.Text;

    /*
     * Hunter precision / limited reserve
     */
    private hunterReserve = 12;
    private hunterMaxReserve = 12;

    /*
     * Mobile controls
     */
    private readonly mobileControlsEnabled =
        typeof navigator !== 'undefined' &&
        (
            navigator.maxTouchPoints > 0 ||
            'ontouchstart' in window
        );
    private mobileMoveBase?: Phaser.GameObjects.Arc;
    private mobileMoveKnob?: Phaser.GameObjects.Arc;
    private mobileMoveLabel?: Phaser.GameObjects.Text;
    private mobileAimBase?: Phaser.GameObjects.Arc;
    private mobileAimKnob?: Phaser.GameObjects.Arc;
    private mobileAimLabel?: Phaser.GameObjects.Text;
    private mobileFireButton?: Phaser.GameObjects.Arc;
    private mobileFireLabel?: Phaser.GameObjects.Text;
    private mobileMovePointerId = -1;
    private mobileAimPointerId = -1;
    private mobileFirePointerId = -1;
    private mobileMoveX = 0;
    private mobileMoveY = 0;
    private mobileAimAngle = 0;
    private mobileAimHasDirection = false;
    private readonly mobileJoystickRadius = 46;
    private mobileTouchPoints =
        new Map<number, Phaser.Math.Vector2>();
    private mobilePinchDistance = 0;
    private mobilePinchActive = false;
    private mobilePendingPaintPointerId = -1;
    private mobilePendingPaintStartScreen?: Phaser.Math.Vector2;
    private mobilePendingPaintStartWorld?: Phaser.Math.Vector2;
    private eyedropperArmed = false;
    private eyedropperButton?: Phaser.GameObjects.Text;
    private eyedropperPointerId = -1;
    private eyedropperMagnifier?: Phaser.GameObjects.Image;
    private eyedropperMagnifierSwatch?: Phaser.GameObjects.Rectangle;
    private readonly eyedropperMagnifierTextureKey =
        'eyedropper-mobile-magnifier';
    private lobbyInfoCard!: Phaser.GameObjects.Rectangle;
    private lobbyControlsCard!: Phaser.GameObjects.Rectangle;
    private lobbyFooterDivider!: Phaser.GameObjects.Rectangle;

    constructor() {
        super('GameScene');
    }

    preload(): void {
        this.load.audio(
            'shotgun-blast',
            'assets/audio/shotgun-blast.wav',
        );
        this.load.audio(
            'heartbeat-double',
            'assets/audio/heartbeat-double.wav',
        );
        this.load.audio(
            'cheerful-bgm',
            'assets/audio/cheerful-bgm.wav',
        );
        this.load.audio(
            'lobby-calm-bgm',
            'assets/audio/lobby-calm-bgm.wav',
        );
        this.load.audio(
            'hunt-tension-bgm',
            'assets/audio/hunt-tension-bgm.wav',
        );
        this.load.audio(
            'paint-dab',
            'assets/audio/paint-dab.wav',
        );
        this.load.audio('paint-cheerful-bgm', 'assets/audio/paint-cheerful-bgm.wav');
        this.load.audio('victory-fanfare', 'assets/audio/victory-fanfare.wav');
        this.load.audio('hider-hit', 'assets/audio/hider-hit.wav');
        this.load.audio('hunter-hit-confirm', 'assets/audio/hunter-hit-confirm.wav');
        this.load.audio('footstep', 'assets/audio/footstep.wav');
        this.load.audio('countdown-beep', 'assets/audio/countdown-beep.wav');
        this.load.audio('countdown-start', 'assets/audio/countdown-start.wav');
        this.load.image(
            'forest-background',
            '/assets/backgrounds/forest-01.png',
        );

        for (
            let index = 1;
            index <= 11;
            index += 1
        ) {
            this.load.image(
                `map-background-${index}`,
                `/assets/backgrounds/map${index}.png`,
            );
        }
    }

    private consumePendingReloadCreate():
        PendingReloadCreate | undefined {
        const raw =
            sessionStorage.getItem(
                'chameleon-hunt-pending-reload-create',
            );

        if (!raw) {
            return undefined;
        }

        /*
         * 먼저 삭제해 create 실패 시에도 무한 reload가 생기지 않게 합니다.
         */
        sessionStorage.removeItem(
            'chameleon-hunt-pending-reload-create',
        );

        try {
            const parsed =
                JSON.parse(raw) as
                    Partial<PendingReloadCreate>;

            if (
                !parsed.playerName ||
                !parsed.roomTitle
            ) {
                return undefined;
            }

            return {
                playerName:
                    String(
                        parsed.playerName,
                    ),
                roomTitle:
                    String(
                        parsed.roomTitle,
                    ),
                password:
                    String(
                        parsed.password ??
                        '',
                    ),
                isPrivate:
                    Boolean(
                        parsed.isPrivate,
                    ),
            };
        } catch (error) {
            console.error(
                '[Chameleon Hunt] pending create parse error',
                error,
            );
            return undefined;
        }
    }

    private async createFromCleanBoot(
        pending:
            PendingReloadCreate,
        operationSerial?: number,
    ): Promise<void> {
        /*
         * 최초 서버 기동 후 create에서 PlayerState callback이 늦는 문제를
         * 더 이상 UI 진입 조건으로 사용하지 않습니다.
         *
         * Colyseus client.create()가 resolve됐다는 사실 자체를
         * "생성자 Room 연결 성공"으로 취급합니다.
         */
        this.stopRoomListAutoRefresh();

        this.roomTransitionInProgress =
            true;

        this.multiplayerText
            .setText(
                tr('방을 만드는 중...'),
            )
            .setVisible(true);

        try {
            const room =
                await multiplayerClient
                    .createRoom({
                        playerName:
                            pending.playerName,
                        roomTitle:
                            pending.roomTitle,
                        isPrivate:
                            pending.isPrivate,
                        password:
                            pending.password,
                    });

            if (
                operationSerial !== undefined &&
                (
                    this.menuOperationCancelled ||
                    operationSerial !==
                        this.menuOperationSerial
                )
            ) {
                /*
                 * User pressed Cancel while create() was in flight.
                 * Never enter the room. Leaving immediately also lets the
                 * server dispose an otherwise orphaned just-created room.
                 */
                await multiplayerClient.disconnect();

                this.multiplayerSessionActive =
                    false;
                this.localNetworkPlayerReady =
                    false;
                this.roomTransitionInProgress =
                    false;

                this.networkPlayerManager
                    .clearAllPlayers();

                this.hideAllWaitingRoomUi();
                this.showMainMenu();
                return;
            }

            this.menuOperationCancelled =
                false;

            this.closeMenuModal();

            this.multiplayerSessionActive =
                true;
            this.roomTransitionInProgress =
                false;

            /*
             * 최초 Schema/snapshot이 아직 비어 있어도 생성자 자신은
             * 이미 create() 성공으로 방에 연결된 상태입니다.
             *
             * 임시 local PlayerState를 즉시 만들어 Lobby를 확정합니다.
             * 실제 서버 state가 도착하면 기존 updatePlayer()가
             * 실제 role/x/y/alive 값으로 자연스럽게 덮어씁니다.
             */
            if (
                !this.networkPlayerManager
                    .hasPlayer(
                        room.sessionId,
                    )
            ) {
                const immediateLocal:
                    NetworkPlayerState = {
                        name:
                            pending.playerName,
                        role: 'hider',
                        hunterVolunteer:
                            false,
                        x:
                            this.gameWidth *
                            0.5,
                        y:
                            this.gameHeight *
                            0.55,
                        alive:
                            true,
                    };

                this.networkPlayerManager
                    .addPlayer(
                        room.sessionId,
                        immediateLocal,
                    );
            }

            this.localNetworkPlayerReady =
                true;

            this.networkPlayerCount =
                Math.max(
                    1,
                    multiplayerClient
                        .getPlayerCount(),
                );

            /*
             * 여기서 즉시 Lobby 표시.
             * `플레이어 연결 중...`을 방 생성 경로에서는 사용하지 않습니다.
             */
            this.handleJoinedRoom(
                room,
            );

            this.localNetworkPlayerReady =
                true;

            this.lobbyPanel
                .setVisible(true);

            this.lobbyTitleText
                .setVisible(true);

            this.startGameButton
                .setVisible(true);

            this.multiplayerText
                .setText('')
                .setVisible(false);

            this.updateLobbyUi();

            /*
             * 실제 서버 authoritative state는 뒤에서 계속 동기화합니다.
             * 이 동기화 실패가 Lobby 표시를 다시 막지는 않습니다.
             */
            const reconcile =
                (): void => {
                    if (
                        multiplayerClient.getRoom() !==
                        room ||
                        this.phase !==
                            'lobby'
                    ) {
                        return;
                    }

                    this.networkPlayerManager
                        .syncPlayersFromCurrentRoom();

                    multiplayerClient
                        .requestLobbySnapshot();

                    const serverLocal =
                        multiplayerClient
                            .getLocalPlayer();

                    if (serverLocal) {
                        this.networkPlayerManager
                            .addPlayer(
                                room.sessionId,
                                serverLocal,
                            );
                    }

                    this.localNetworkPlayerReady =
                        true;

                    this.networkPlayerCount =
                        Math.max(
                            1,
                            multiplayerClient
                                .getPlayerCount(),
                        );

                    this.startGameButton
                        .setVisible(
                            multiplayerClient
                                .isHost(),
                        );

                    this.updateLobbyUi();

                    this.time.delayedCall(
                        250,
                        reconcile,
                    );
                };

            this.time.delayedCall(
                100,
                reconcile,
            );
        } catch (error) {
            console.error(
                '[Chameleon Hunt] clean boot create failed',
                error,
            );

            const connectedRoom =
                multiplayerClient
                    .getRoom();

            /*
             * Room이 이미 생겼다면 생성 성공으로 간주하고
             * 동일하게 즉시 local fallback을 구성합니다.
             */
            if (connectedRoom) {
                this.multiplayerSessionActive =
                    true;
                this.roomTransitionInProgress =
                    false;

                if (
                    !this.networkPlayerManager
                        .hasPlayer(
                            connectedRoom
                                .sessionId,
                        )
                ) {
                    this.networkPlayerManager
                        .addPlayer(
                            connectedRoom
                                .sessionId,
                            {
                                name:
                                    pending.playerName,
                                role:
                                    'hider',
                                hunterVolunteer:
                                    false,
                                x:
                                    this.gameWidth *
                                    0.5,
                                y:
                                    this.gameHeight *
                                    0.55,
                                alive:
                                    true,
                            },
                        );
                }

                this.localNetworkPlayerReady =
                    true;

                this.handleJoinedRoom(
                    connectedRoom,
                );

                this.localNetworkPlayerReady =
                    true;

                this.startGameButton
                    .setVisible(true);

                this.multiplayerText
                    .setText('')
                    .setVisible(false);

                this.updateLobbyUi();

                return;
            }

            this.roomTransitionInProgress =
                false;
            this.multiplayerSessionActive =
                false;

            this.multiplayerText
                .setText('')
                .setVisible(false);

            this.showMainMenu();

            this.showStatus(
                tr('방을 만들지 못했습니다.'),
            );
        }
    }

    private consumePendingReloadJoin():
        PendingReloadJoin | undefined {
        const raw =
            sessionStorage.getItem(
                'chameleon-hunt-pending-reload-join',
            );

        if (!raw) {
            return undefined;
        }

        /*
         * 먼저 삭제해서 실패/예외가 나도 reload loop가 생기지 않게 합니다.
         */
        sessionStorage.removeItem(
            'chameleon-hunt-pending-reload-join',
        );

        try {
            const parsed =
                JSON.parse(raw) as
                    Partial<PendingReloadJoin>;

            if (
                !parsed.roomId ||
                !parsed.playerName
            ) {
                return undefined;
            }

            return {
                roomId:
                    String(parsed.roomId),
                playerName:
                    String(parsed.playerName),
                password:
                    String(
                        parsed.password ??
                        '',
                    ),
                isPrivate:
                    Boolean(
                        parsed.isPrivate,
                    ),
            };
        } catch (error) {
            console.error(
                '[Chameleon Hunt] pending join parse error',
                error,
            );
            return undefined;
        }
    }

    private async joinFromCleanBoot(
        pending:
            PendingReloadJoin,
    ): Promise<void> {
        /*
         * 기존 Clean Join 안정화 루틴.
         * 현재는 reload 없이 같은 Scene에서도 사용합니다.
         * 시작 즉시 room-list refresh를 중지해 비동기 UI 충돌을 방지합니다.
         */
        this.stopRoomListAutoRefresh();

        this.roomTransitionInProgress =
            true;

        this.multiplayerText
            .setText(
                tr('방에 참가하는 중...'),
            )
            .setVisible(true);

        try {
            const room =
                await multiplayerClient
                    .joinRoomById(
                        pending.roomId,
                        {
                            playerName:
                                pending.playerName,
                            password:
                                pending.password,
                        },
                    );

            this.multiplayerSessionActive =
                true;
            this.roomTransitionInProgress =
                false;

            /*
             * callback 순서를 기다리지 않고 현재 state 전체를 직접 읽습니다.
             */
            this.networkPlayerManager
                .syncPlayersFromCurrentRoom();

            const startedAt =
                this.time.now;

            const finishWhenLocalExists =
                (): void => {
                    if (
                        multiplayerClient.getRoom() !==
                        room
                    ) {
                        return;
                    }

                    this.networkPlayerManager
                        .syncPlayersFromCurrentRoom();

                    multiplayerClient
                        .requestLobbySnapshot();

                    const snapshotLocal =
                        multiplayerClient
                            .getSnapshotPlayer(
                                room.sessionId,
                            );

                    if (
                        snapshotLocal &&
                        !this.networkPlayerManager
                            .hasPlayer(
                                room.sessionId,
                            )
                    ) {
                        this.networkPlayerManager
                            .addPlayer(
                                room.sessionId,
                                snapshotLocal,
                            );
                    }

                    this.localNetworkPlayerReady =
                        this.ensureLocalNetworkPlayer(
                            room,
                        );

                    if (
                        this.localNetworkPlayerReady
                    ) {
                        this.multiplayerText
                            .setText('')
                            .setVisible(false);

                        this.handleJoinedRoom(
                            room,
                        );
                        return;
                    }

                    /*
                     * 서버 Room에는 들어갔지만 local PlayerState가 끝까지
                     * 만들어지지 않는 비정상 연결도 무한 대기하지 않습니다.
                     */
                    if (
                        this.time.now -
                            startedAt >=
                        5000
                    ) {
                        console.warn(
                            '[Chameleon Hunt] local player join timeout',
                            {
                                roomId:
                                    pending.roomId,
                            },
                        );

                        void multiplayerClient
                            .disconnect();

                        this.roomTransitionInProgress =
                            false;
                        this.multiplayerSessionActive =
                            false;
                        this.localNetworkPlayerReady =
                            false;

                        this.multiplayerText
                            .setText('')
                            .setVisible(false);

                        this.showMainMenu();

                        this.showStatus(
                            tr('방에 참가할 수 없습니다. 이미 종료된 방일 수 있습니다.'),
                        );

                        void this.refreshPublicRoomList(
                            false,
                        );

                        return;
                    }

                    this.time.delayedCall(
                        this.time.now -
                                startedAt <
                            3000
                            ? 40
                            : 120,
                        finishWhenLocalExists,
                    );
                };

            finishWhenLocalExists();
        } catch (error) {
            console.error(
                '[Chameleon Hunt] clean boot join failed',
                error,
            );

            this.roomTransitionInProgress =
                false;
            this.multiplayerSessionActive =
                false;

            this.multiplayerText
                .setText('')
                .setVisible(false);

            this.showMainMenu();

            this.showStatus(
                pending.isPrivate
                    ? tr('방 ID 또는 비밀번호를 확인하세요.')
                    : tr('방에 참가할 수 없습니다. 이미 사라진 방일 수 있습니다.'),
            );

            if (!pending.isPrivate) {
                void this.refreshPublicRoomList(
                    false,
                );
            }
        }
    }


    create(): void {
        this.cameras.main.setBackgroundColor(
            '#000000',
        );
        this.shotgunSound =
            this.sound.add(
                'shotgun-blast',
                {
                    volume: 0.88,
                },
            );

        this.heartbeatSound =
            this.sound.add(
                'heartbeat-double',
                {
                    volume: 0.34,
                },
            );

        this.backgroundMusic =
            this.sound.add(
                'cheerful-bgm',
                {
                    volume: 0.13,
                    loop: true,
                },
            );

        this.lobbyMusic =
            this.sound.add(
                'lobby-calm-bgm',
                {
                    volume: 0.18,
                    loop: true,
                },
            );

        this.huntMusic =
            this.sound.add(
                'hunt-tension-bgm',
                {
                    volume: 0.20,
                    loop: true,
                },
            );

        this.paintSound =
            this.sound.add(
                'paint-dab',
                {
                    volume: 0.18,
                },
            );

        this.paintMusic = this.sound.add(
            'paint-cheerful-bgm',
            { volume: 0.17, loop: true },
        );
        this.victorySound = this.sound.add(
            'victory-fanfare',
            { volume: 0.55 },
        );
        this.hitSound = this.sound.add(
            'hider-hit',
            { volume: 0.48 },
        );
        this.hunterHitConfirmSound = this.sound.add(
            'hunter-hit-confirm',
            { volume: 0.52 },
        );
        this.countdownBeepSound = this.sound.add(
            'countdown-beep',
            { volume: 0.34 },
        );
        this.countdownStartSound = this.sound.add(
            'countdown-start',
            { volume: 0.44 },
        );

        /*
         * 브라우저 autoplay 정책 때문에 최초 사용자 입력 후 BGM을 시작합니다.
         * 방 생성/참가를 위해 클릭한 뒤 Scene이 reload된 경우에도 다음 입력에서
         * 자연스럽게 시작되며, 네트워크 연결 로직에는 영향을 주지 않습니다.
         */
        /*
         * 브라우저 autoplay 제한 해제용 입력은 딱 한 번만 받습니다.
         * 이후 일반 클릭/페인트/사격이 BGM을 다시 시작하거나 리셋하지 않습니다.
         */
        this.input.once(
            'pointerdown',
            () => {
                this.unlockGameAudio();
            },
        );

        this.input.keyboard?.once(
            'keydown',
            () => {
                this.unlockGameAudio();
            },
        );

        this.createImageBackground();
        this.createObstacles();

        this.createHunter();
        this.createHiders();
        this.createSelectionRing();

        this.createAimObjects();
        this.createHitMarker();

        this.createKeyboardControls();
        this.createHud();
        this.createSurvivalHud();
        this.createBgmToggleButton();

        this.events.once(
            Phaser.Scenes.Events.SHUTDOWN,
            () => {
                this.saveLobbyBgmResumePosition();
            },
        );

        this.createPaintTools();
        this.createPaintPalette();
        this.createHunterCamoPalette();
        this.createPointerControls();

        this.createMultiplayerHud();
        this.createLobbyUi();
        this.createMapSelectorUi();
        this.createHunterBlindUi();
        this.createCountdownUi();
        this.createHuntTensionUi();
        this.createMobileControls();

        /*
         * HUD 기준 좌표는 최초 생성 시 한 번만 저장합니다.
         * 이후 Paint/Hunt 카메라 확대가 반복되어도 이 좌표는 변하지 않습니다.
         */
        this.captureFixedHudBaseTransforms();

        this.networkPlayerManager = new NetworkPlayerManager(
            this,
            this.gameWidth,
            this.gameHeight,
        );

        this.lobbyAvatarPreset =
            this.loadLobbyAvatarPreset();

        this.registerMultiplayerEvents();
        this.enterLobbyPhase();

        const existingRoom =
            multiplayerClient.getRoom();

        if (existingRoom) {
            /*
             * Room/WebSocket은 MultiplayerClient singleton에 유지됩니다.
             * 새 Phaser Scene에서는 기존 화면 상태를 전혀 재사용하지 않고
             * 현재 Room state로 플레이어와 Lobby를 다시 구성합니다.
             */
            this.multiplayerSessionActive =
                true;

            const joinedRestartRoomId =
                sessionStorage.getItem(
                    'chameleon-hunt-joined-scene-reset',
                );

            if (
                joinedRestartRoomId ===
                existingRoom.roomId
            ) {
                sessionStorage.removeItem(
                    'chameleon-hunt-joined-scene-reset',
                );
            }

            this.time.delayedCall(
                0,
                () => {
                    this.hydrateConnectedRoomAfterSceneReset(
                        existingRoom,
                    );
                },
            );
        } else {
            const pendingCreate =
                this.consumePendingReloadCreate();

            const pendingJoin =
                pendingCreate
                    ? undefined
                    : this.consumePendingReloadJoin();

            if (pendingCreate) {
                /*
                 * 방 생성 버튼에서 자동 reload된 깨끗한 부팅 경로.
                 */
                this.time.delayedCall(
                    120,
                    () => {
                        void this.createFromCleanBoot(
                            pendingCreate,
                        );
                    },
                );
            } else if (pendingJoin) {
                /*
                 * 참가 버튼에서 자동 reload된 깨끗한 부팅 경로.
                 */
                this.time.delayedCall(
                    120,
                    () => {
                        void this.joinFromCleanBoot(
                            pendingJoin,
                        );
                    },
                );
            } else {
                this.showMainMenu();

                this.time.delayedCall(
                    350,
                    () => {
                        this.handleInviteLinkOnLoad();
                    },
                );
            }
        }
    }

    private hydrateConnectedRoomAfterSceneReset(
        room: NonNullable<
            ReturnType<
                typeof multiplayerClient.getRoom
            >
        >,
    ): void {
        const startedAt =
            this.time.now;

        const hydrate = (): void => {
            if (
                multiplayerClient.getRoom() !==
                room
            ) {
                return;
            }

            /*
             * 새 Scene의 NetworkPlayerManager는 기존 Room callback replay를
             * 기다리지 않고 현재 authoritative state 전체를 직접 읽습니다.
             */
            this.networkPlayerManager
                .syncPlayersFromCurrentRoom();

            const localReady =
                this.networkPlayerManager
                    .hasPlayer(
                        room.sessionId,
                    );

            if (!localReady) {
                this.time.delayedCall(
                    this.time.now -
                            startedAt <
                        4000
                        ? 40
                        : 150,
                    hydrate,
                );
                return;
            }

            this.multiplayerSessionActive =
                true;
            this.localNetworkPlayerReady =
                true;
            this.roomTransitionInProgress =
                false;
            this.roomHandshakeCompletedId =
                room.roomId;
            try {
                this.handleJoinedRoom(
                    room,
                );
            } catch (error) {
                console.error(
                    '[Chameleon Hunt] Scene hydration failed; retrying current room state',
                    error,
                );

                this.roomHandshakeCompletedId =
                    '';
                this.time.delayedCall(
                    50,
                    hydrate,
                );
            }
        };

        hydrate();
    }

    private repairConnectedRoomUiIfNeeded(): void {
        const room =
            multiplayerClient.getRoom();

        if (!room) {
            return;
        }

        const localReady =
            this.ensureLocalNetworkPlayer(
                room,
            );

        if (!localReady) {
            return;
        }

        const needsRepair =
            !this.multiplayerSessionActive ||
            this.mainMenuObjects.length > 0 ||
            Boolean(this.menuModalOverlay) ||
            !this.networkPlayerManager
                .hasPlayer(
                    room.sessionId,
                );

        if (!needsRepair) {
            return;
        }

        if (
            this.mainMenuObjects.length > 0 ||
            this.menuModalOverlay
        ) {
            /*
             * 화면이 아직 Main Menu에 남아 있다면 과거 완료 플래그는 무효.
             */
            this.roomHandshakeCompletedId =
                '';
        }

        this.beginConnectedRoomHandshake(
            room,
        );
    }

    update(_: number, delta: number): void {
        /*
         * 서버에는 입장했는데 참가자 화면이 Main Menu에 남는 경우를
         * 매 프레임 자동 복구합니다.
         *
         * Room 객체가 이미 존재한다면 네트워크 참가 자체는 성공한 것이므로
         * main menu/modal 상태만 제거하고 현재 Room state를 Scene에 적용합니다.
         */
        this.repairConnectedRoomUiIfNeeded();
        this.syncMapBackground();
        this.updateMapSelectorUi();

        if (
            this.phase === 'lobby' &&
            multiplayerClient.isConnected()
        ) {
            /*
             * Paint time / host / volunteer changes can arrive through
             * lobby_snapshot rather than a Schema onChange callback.
             * Keep the lightweight lobby panel in sync every frame.
             */
            this.updateLobbyUi();

            this.networkPlayerManager
                ?.forceLobbyPositionsFromState();
        }

        if (this.isMultiplayerSession()) {
            this.hideLegacySinglePlayerActors();
        }


        this.updateRoundTimer();
        this.updateCountdownUi();
        this.updateWeaponHeatHud();
        this.updateNetworkPlayers(delta);
        this.updateMobileControlVisibility();

        if (
            this.phase === 'paint' &&
            !this.networkPlayerManager
                .isLocalCustomizationMode()
        ) {
            this.centerPaintCameraOnLocalPlayer();
        }

        this.ensureGameplayCameraFollow();
        this.updateHuntTension(delta);

        if (this.phase === 'paint') {
            if (!multiplayerClient.isConnected()) {
                this.updateSelectedHiderMovement(delta);
            }

            if (
                this.isPainting &&
                this.straightLineStart &&
                this.shiftPaintKey?.isDown
            ) {
                this.straightLineModeActive =
                    true;

                this.updateStraightLinePreview(
                    this.input.activePointer,
                );
            } else if (
                this.isPainting &&
                this.straightLineModeActive
            ) {
                this.updateStraightLinePreview(
                    this.input.activePointer,
                );
            }

            this.updateBrushSizeInput();

            if (
                Phaser.Input.Keyboard.JustDown(
                    this.brushShapeKey,
                )
            ) {
                this.toggleBrushShape();
            }

            if (
                this.controlPaintKey.isDown &&
                Phaser.Input.Keyboard.JustDown(
                    this.undoPaintKey,
                )
            ) {
                this.undoLastPaintStroke();
            }

            if (
                this.controlPaintKey.isDown &&
                Phaser.Input.Keyboard.JustDown(
                    this.redoPaintKey,
                )
            ) {
                this.redoLastPaintStroke();
            }
        }

        if (this.phase === 'hunt') {
            if (!multiplayerClient.isConnected()) {
                this.updateHunterMovement(delta);
            }

            if (
                Phaser.Input.Keyboard.JustDown(
                    this.spectatorKey,
                )
            ) {
                this.cycleSpectatorView();
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
                tr('MULTI · CONNECTING...'),
                {
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: 'rgba(255, 244, 214, 0.86)',
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
                        multiplayerClient.getPlayerCount();
                    this.networkPlayerManager.addPlayer(
                        sessionId,
                        player,
                    );

                    this.knownAliveState.set(
                        sessionId,
                        player.alive,
                    );

                    this.updateSurvivalHud();

                    if (
                        sessionId ===
                        multiplayerClient.getSessionId()
                    ) {
                        this.localNetworkPlayerReady =
                            true;

                        const room =
                            multiplayerClient
                                .getRoom();

                        if (room) {
                            /*
                             * 최초 create/join의 가장 신뢰할 수 있는 완료 신호:
                             * 서버가 내 PlayerState를 실제로 추가했고
                             * client callback까지 도착한 순간입니다.
                             */
                            this.time.delayedCall(
                                0,
                                () => {
                                    this.completeConnectedRoomHandshake(
                                        room,
                                    );
                                },
                            );
                        } else {
                            this.roomTransitionInProgress =
                                false;
                            this.updateLobbyUi();
                        }
                    }

                    console.log(
                        '[Chameleon Hunt] Player added',
                        sessionId,
                        player.name,
                        player.role,
                    );

                    this.updateMultiplayerHud();

                    const lobbyPreset =
                        this.lobbyAvatarPresetsBySession
                            .get(
                                sessionId,
                            );

                    if (
                        lobbyPreset &&
                        this.phase === 'lobby'
                    ) {
                        this.networkPlayerManager
                            .applyLobbyAvatarPreset(
                                sessionId,
                                lobbyPreset,
                            );
                    }
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
                        multiplayerClient.getPlayerCount();
                    this.networkPlayerManager.removePlayer(
                        sessionId,
                    );

                    this.knownAliveState.delete(
                        sessionId,
                    );

                    this.updateSurvivalHud();

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
                    const wasAlive =
                        this.knownAliveState.get(
                            sessionId,
                        );

                    this.networkPlayerManager.updatePlayer(
                        sessionId,
                        player,
                    );

                    this.knownAliveState.set(
                        sessionId,
                        player.alive,
                    );

                    if (
                        this.phase === 'hunt' &&
                        wasAlive === true &&
                        player.alive === false &&
                        player.role === 'hider'
                    ) {
                        this.showHiderFoundEffect(
                            sessionId,
                        );
                    }

                    this.updateSurvivalHud();

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

                    this.hunterReserve =
                        state.reserve;
                    this.hunterMaxReserve =
                        state.maxReserve;
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
                    this.hunterReserve = 12;
                    this.hunterMaxReserve = 12;
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
            multiplayerClient.onHuntersOutOfAmmo(
                (_message: string) => {
                    this.statusText
                        .setText(
                            tr('헌터의 탄약이 모두 소진되었습니다. HIDER 승리!'),
                        )
                        .setVisible(true)
                        .setAlpha(1);
                },
            ),
        );

        this.networkUnsubscribers.push(
            multiplayerClient.onPlayerDisconnected(
                (
                    payload: {
                        sessionId: string;
                        name: string;
                    },
                ) => {
                    this.showStatus(
                        tr(`${payload.name} 님의 연결이 끊겼습니다.`),
                    );
                },
            ),
        );

        this.networkUnsubscribers.push(
            multiplayerClient.onRoundAborted(
                (
                    message: string,
                ) => {
                    /*
                     * A stale round_aborted packet must not throw a Hunter out
                     * of the Paint screen.  Re-check authoritative room phase
                     * after a short tick; only a real server lobby transition
                     * is allowed to rebuild the lobby UI.
                     */
                    this.time.delayedCall(
                        250,
                        () => {
                            const serverPhase =
                                multiplayerClient
                                    .getPhase();

                            if (
                                serverPhase !==
                                'lobby'
                            ) {
                                return;
                            }

                            this.showStatus(
                                message,
                            );

                            this.multiplayerSessionActive =
                                true;

                            this.enterLobbyPhase();

                            this.time.delayedCall(
                                1800,
                                () => {
                                    this.clearStatus();
                                },
                            );
                        },
                    );
                },
            ),
        );

        this.networkUnsubscribers.push(
            multiplayerClient.onAvatarPreset(
                (
                    preset:
                        NetworkAvatarPreset,
                ) => {
                    const strokes =
                        preset.strokes
                            .map(
                                (stroke) => ({
                                    ...stroke,
                                    targetSessionId:
                                        preset.sessionId,
                                }),
                            );

                    this.lobbyAvatarPresetsBySession
                        .set(
                            preset.sessionId,
                            strokes,
                        );

                    if (
                        this.phase === 'lobby'
                    ) {
                        this.networkPlayerManager
                            .applyLobbyAvatarPreset(
                                preset.sessionId,
                                strokes,
                            );
                    }
                },
            ),
        );

        this.networkUnsubscribers.push(
            multiplayerClient.onConnectionChanged(
                (connected: boolean) => {
                    if (connected) {
                        const room =
                            multiplayerClient.getRoom();

                        if (
                            room &&
                            this.roomTransitionInProgress
                        ) {
                            this.beginConnectedRoomHandshake(
                                room,
                            );
                        }

                        return;
                    }

                    this.setHunterPaintBlind(false);
                    this.finishActivePaintStroke();
                    this.isPainting = false;

                    const wasMultiplayer =
                        this.multiplayerSessionActive;

                    this.multiplayerSessionActive =
                        false;

                    this.resetGameplayCamera();
                    this.resetPaintWorldZoom();
                    this.clearAllAimingVisuals();
                    this.hideLegacySinglePlayerActors();

                    if (wasMultiplayer) {
                        this.showStatus(
                            tr('서버 연결이 끊겼습니다. 메인 화면으로 돌아갑니다.'),
                        );

                        this.time.delayedCall(
                            700,
                            () => {
                                this.clearStatus();
                                this.showMainMenu();
                            },
                        );
                    }
                },
            ),
        );

        this.events.once(
            Phaser.Scenes.Events.SHUTDOWN,
            () => {
                this.closeMenuModal();

                this.networkUnsubscribers.forEach(
                    (unsubscribe) => {
                        unsubscribe();
                    },
                );

                this.networkUnsubscribers = [];

                this.roomHandshakeEvent?.remove();
                this.roomHandshakeEvent =
                    undefined;

                this.hiderVisionGraphics
                    ?.destroy();

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

    private buildInviteUrl(): string | null {
        const roomId =
            multiplayerClient.getRoomId();

        if (!roomId) {
            return null;
        }

        const url =
            new URL(
                window.location.href,
            );

        url.search = '';
        url.hash = '';

        url.searchParams.set(
            'room',
            roomId,
        );

        if (
            multiplayerClient
                .getRoom()
                ?.state.isPrivate
        ) {
            url.searchParams.set(
                'private',
                '1',
            );
        }

        return url.toString();
    }

    private async copyInviteLink(): Promise<void> {
        const inviteUrl =
            this.buildInviteUrl();

        if (!inviteUrl) {
            this.showStatus(
                tr('초대 링크를 만들 수 없습니다.'),
            );
            return;
        }

        try {
            await navigator.clipboard
                .writeText(
                    inviteUrl,
                );

            this.showStatus(
                tr('초대 링크를 복사했습니다!'),
            );
        } catch {
            this.openCopyLinkModal(
                inviteUrl,
            );
        }
    }

    private handleInviteLinkOnLoad(): void {
        if (this.inviteJoinTriggered) {
            return;
        }

        const params =
            new URLSearchParams(
                window.location.search,
            );

        const roomId =
            params.get('room')
                ?.trim();

        if (!roomId) {
            return;
        }

        this.inviteJoinTriggered = true;
        this.pendingInviteRoomId = roomId;
        this.pendingInvitePrivate =
            params.get('private') === '1';

        this.openJoinRoomModal(
            roomId,
            this.pendingInvitePrivate,
            true,
        );
    }

    private closeMenuModal(): void {
        this.menuModalOverlay?.remove();
        this.menuModalOverlay = undefined;

        /*
         * Do not re-enable Phaser in the same browser pointer event that
         * closed/submitted the DOM modal. Otherwise the pointer-up can fall
         * through to the game canvas and activate the button underneath.
         */
        window.setTimeout(
            () => {
                if (!this.menuModalOverlay) {
                    this.input.enabled = true;
                }
            },
            120,
        );
    }

    private cancelPendingMenuOperation(): void {
        /*
         * Invalidate the currently running create/join operation.  Colyseus
         * create() itself is not abortable, so if it resolves after cancel,
         * the completion path detects this serial mismatch and disconnects
         * immediately instead of entering the newly-created room.
         */
        this.menuOperationCancelled = true;
        this.menuOperationSerial += 1;
        this.roomTransitionInProgress = false;

        this.multiplayerText
            .setText('')
            .setVisible(false);

        this.closeMenuModal();

        if (
            this.pendingInviteRoomId
        ) {
            this.inviteJoinTriggered =
                false;
        }
    }

    private createMenuModal(
        title: string,
        fields: Array<{
            key: string;
            label: string;
            value?: string;
            type?: 'text' | 'password';
            placeholder?: string;
        }>,
        submitLabel: string,
        onSubmit: (
            values: Record<string, string>,
        ) => void,
    ): void {
        this.closeMenuModal();

        /*
         * Modal is a true input modal: while it exists, the Phaser scene
         * underneath is completely non-interactive.
         */
        this.input.enabled = false;

        const overlay =
            document.createElement('div');

        Object.assign(
            overlay.style,
            {
                position: 'fixed',
                inset: '0',
                zIndex: '10000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                    'rgba(8, 15, 22, 0.68)',
                pointerEvents: 'auto',
                touchAction: 'none',
            },
        );

        [
            'pointerdown',
            'pointerup',
            'click',
            'touchstart',
            'touchend',
        ].forEach(
            (eventName) => {
                overlay.addEventListener(
                    eventName,
                    (event) => {
                        event.stopPropagation();
                    },
                    false,
                );
            },
        );

        const card =
            document.createElement('form');

        Object.assign(
            card.style,
            {
                width: 'min(430px, calc(100vw - 40px))',
                boxSizing: 'border-box',
                padding: '26px',
                border: '4px solid #6f8f65',
                borderRadius: '8px',
                background: '#fff4d6',
                boxShadow:
                    '0 18px 55px rgba(0,0,0,.35)',
                color: '#3f513f',
                fontFamily: 'monospace',
            },
        );

        const heading =
            document.createElement('div');

        heading.textContent = title;

        Object.assign(
            heading.style,
            {
                marginBottom: '20px',
                fontSize: '24px',
                fontWeight: '800',
                textAlign: 'center',
            },
        );

        card.appendChild(heading);

        const inputs =
            new Map<
                string,
                HTMLInputElement
            >();

        fields.forEach(
            (field) => {
                const label =
                    document.createElement('label');

                label.textContent =
                    field.label;

                Object.assign(
                    label.style,
                    {
                        display: 'block',
                        marginTop: '6px',
                        marginBottom: '6px',
                        fontSize: '14px',
                        fontWeight: '700',
                    },
                );

                const input =
                    document.createElement('input');

                input.type =
                    field.type ?? 'text';
                input.value =
                    field.value ?? '';
                input.placeholder =
                    field.placeholder ?? '';
                input.autocomplete = 'off';

                Object.assign(
                    input.style,
                    {
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '11px 12px',
                        border: '2px solid #6f8f65',
                        borderRadius: '5px',
                        outline: 'none',
                        background: '#fffdf3',
                        color: '#26352b',
                        fontFamily: 'monospace',
                        fontSize: '16px',
                    },
                );

                card.append(
                    label,
                    input,
                );

                inputs.set(
                    field.key,
                    input,
                );
            },
        );

        const buttons =
            document.createElement('div');

        Object.assign(
            buttons.style,
            {
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
                marginTop: '22px',
            },
        );

        const cancel =
            document.createElement('button');

        cancel.type = 'button';
        cancel.textContent = tr('취소');

        const submit =
            document.createElement('button');

        submit.type = 'submit';
        submit.textContent =
            submitLabel;

        [cancel, submit].forEach(
            (button) => {
                Object.assign(
                    button.style,
                    {
                        border: '0',
                        borderRadius: '4px',
                        padding: '11px 20px',
                        cursor: 'pointer',
                        fontFamily: 'monospace',
                        fontSize: '15px',
                        fontWeight: '800',
                    },
                );
            },
        );

        cancel.style.background =
            '#d8dfce';
        cancel.style.color =
            '#405040';
        submit.style.background =
            '#5c8f66';
        submit.style.color =
            '#fffdf3';

        cancel.onclick = (
            event,
        ) => {
            event.preventDefault();
            event.stopPropagation();
            this.cancelPendingMenuOperation();
        };

        buttons.append(
            cancel,
            submit,
        );

        card.appendChild(buttons);
        overlay.appendChild(card);
        document.body.appendChild(
            overlay,
        );

        card.addEventListener(
            'submit',
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                const values:
                    Record<string, string> =
                    {};

                inputs.forEach(
                    (input, key) => {
                        values[key] =
                            input.value;
                    },
                );

                onSubmit(values);
            },
        );

        this.menuModalOverlay =
            overlay;

        requestAnimationFrame(
            () => {
                const first =
                    fields.length > 0
                        ? inputs.get(
                            fields[0].key,
                        )
                        : undefined;

                first?.focus();
                first?.select();
            },
        );
    }

    private setModalBusy(
        busy: boolean,
        message = '',
    ): void {
        const form =
            this.menuModalOverlay
                ?.querySelector('form');

        if (!form) {
            return;
        }

        const inputs =
            form.querySelectorAll<
                HTMLInputElement
            >(
                'input',
            );

        inputs.forEach(
            (input) => {
                input.disabled = busy;
            },
        );

        const buttons =
            form.querySelectorAll<
                HTMLButtonElement
            >(
                'button',
            );

        buttons.forEach(
            (button) => {
                /*
                 * Cancel must remain usable even while create/join is
                 * waiting on the network.
                 */
                button.disabled =
                    busy &&
                    button.type === 'submit';
            },
        );

        let status =
            form.querySelector<
                HTMLDivElement
            >(
                '[data-modal-status]',
            );

        if (!status) {
            status =
                document.createElement(
                    'div',
                );
            status.dataset.modalStatus =
                '1';
            Object.assign(
                status.style,
                {
                    marginTop: '14px',
                    textAlign: 'center',
                    color: '#8a3f36',
                    fontWeight: '700',
                    fontSize: '13px',
                },
            );
            form.appendChild(status);
        }

        status.textContent =
            message;
    }

    private openCreateRoomModal(
        isPrivate: boolean,
    ): void {
        const fields: Array<{
            key: string;
            label: string;
            value: string;
            type?: 'text' | 'password';
        }> = [
            {
                key: 'playerName',
                label: tr('닉네임'),
                value:
                    this.getSavedPlayerName(),
                type: 'text',
            },
            {
                key: 'roomTitle',
                label: tr('방 이름'),
                value: 'Chameleon Room',
                type: 'text',
            },
        ];

        if (isPrivate) {
            fields.push({
                key: 'password',
                label: tr('비밀번호'),
                value: '',
                type: 'password',
            });
        }

        this.createMenuModal(
            isPrivate
                ? tr('비공개방 만들기')
                : tr('공개방 만들기'),
            fields,
            tr('만들기'),
            (values) => {
                void this.submitCreateRoom(
                    isPrivate,
                    values,
                );
            },
        );
    }

    private openPrivateJoinModal(): void {
        this.createMenuModal(
            tr('비공개방 참가'),
            [
                {
                    key: 'roomId',
                    label: tr('방 ID'),
                },
                {
                    key: 'password',
                    label: tr('비밀번호'),
                    type: 'password',
                },
                {
                    key: 'playerName',
                    label: tr('닉네임'),
                    value:
                        this.getSavedPlayerName(),
                },
            ],
            tr('참가'),
            (values) => {
                void this.submitJoinRoom(
                    values.roomId,
                    true,
                    values,
                );
            },
        );
    }

    private openJoinRoomModal(
        roomId: string,
        isPrivate: boolean,
        fromInvite = false,
    ): void {
        /*
         * 이전 실패 요청에서 transition flag가 남아 있더라도
         * 방 선택/모달 표시 자체는 항상 가능해야 합니다.
         * 실제 중복 네트워크 요청은 submitJoinRoom()에서 막습니다.
         */
        if (
            !multiplayerClient.isConnected()
        ) {
            this.roomTransitionInProgress =
                false;
        }
        const fields: Array<{
            key: string;
            label: string;
            value?: string;
            type?: 'text' | 'password';
        }> = [];

        if (isPrivate) {
            fields.push({
                key: 'password',
                label: tr('비밀번호'),
                type: 'password',
            });
        }

        fields.push({
            key: 'playerName',
            label: tr('닉네임'),
            value:
                this.getSavedPlayerName(),
        });

        this.createMenuModal(
            fromInvite
                ? tr('초대받은 방 참가')
                : tr('게임방 참가'),
            fields,
            tr('참가'),
            (values) => {
                void this.submitJoinRoom(
                    roomId,
                    isPrivate,
                    values,
                );
            },
        );
    }

    private openCopyLinkModal(
        inviteUrl: string,
    ): void {
        this.createMenuModal(
            tr('초대 링크'),
            [
                {
                    key: 'inviteUrl',
                    label:
                        tr('아래 링크를 복사하세요.'),
                    value: inviteUrl,
                },
            ],
            tr('닫기'),
            () => {
                this.closeMenuModal();
            },
        );
    }

    private async submitCreateRoom(
        isPrivate: boolean,
        values: Record<string, string>,
    ): Promise<void> {
        const playerName =
            values.playerName
                ?.trim();

        const roomTitle =
            values.roomTitle
                ?.trim();

        const password =
            values.password ?? '';

        if (
            !playerName ||
            !roomTitle
        ) {
            this.setModalBusy(
                false,
                tr('닉네임과 방 이름을 입력하세요.'),
            );
            return;
        }

        if (
            isPrivate &&
            !password
        ) {
            this.setModalBusy(
                false,
                tr('비밀번호를 입력하세요.'),
            );
            return;
        }

        localStorage.setItem(
            'chameleon-hunt-player-name',
            playerName,
        );

        const pending:
            PendingReloadCreate = {
                playerName,
                roomTitle,
                password,
                isPrivate,
            };

        const operationSerial =
            ++this.menuOperationSerial;

        this.menuOperationCancelled =
            false;

        this.setModalBusy(
            true,
            tr('방을 만드는 중...'),
        );

        /*
         * v0.10.8.1 이후 실제 원인이었던
         * Colyseus version 혼재 + room.state.players 초기 undefined 문제가
         * 해결되었으므로 더 이상 페이지 reload가 필요하지 않습니다.
         *
         * 같은 Phaser Scene / 같은 WebAudio context에서 create를 수행하여
         * Lobby BGM이 단 한 번도 끊기지 않게 합니다.
         */
        sessionStorage.removeItem(
            'chameleon-hunt-pending-reload-create',
        );

        await this.createFromCleanBoot(
            pending,
            operationSerial,
        );
    }


    private async submitJoinRoom(
        roomIdValue: string,
        isPrivate: boolean,
        values: Record<string, string>,
    ): Promise<void> {
        const roomId =
            roomIdValue?.trim();

        const playerName =
            values.playerName
                ?.trim();

        const password =
            values.password ?? '';

        if (!roomId || !playerName) {
            this.setModalBusy(
                false,
                tr('방 정보와 닉네임을 확인하세요.'),
            );
            return;
        }

        if (
            isPrivate &&
            !password
        ) {
            this.setModalBusy(
                false,
                tr('비밀번호를 입력하세요.'),
            );
            return;
        }

        localStorage.setItem(
            'chameleon-hunt-player-name',
            playerName,
        );

        const pending:
            PendingReloadJoin = {
                roomId,
                playerName,
                password,
                isPrivate,
            };

        this.setModalBusy(
            true,
            tr('방을 확인하는 중...'),
        );

        /*
         * 공개방은 클릭한 목록이 stale일 수 있으므로 실제 join 직전에
         * 서버 room list를 한 번 더 확인합니다.
         */
        if (!isPrivate) {
            try {
                const latestRooms =
                    await multiplayerClient
                        .listPublicRooms();

                const roomStillExists =
                    latestRooms.some(
                        (room) =>
                            room.roomId ===
                                roomId &&
                            room.metadata
                                ?.isPrivate !==
                                true &&
                            (
                                room.metadata
                                    ?.phase ??
                                'lobby'
                            ) === 'lobby' &&
                            room.clients <
                                room.maxClients,
                    );

                if (!roomStillExists) {
                    this.setModalBusy(
                        false,
                        tr('이미 사라졌거나 참가할 수 없는 방입니다.'),
                    );

                    this.showStatus(
                        tr('방에 참가할 수 없습니다. 방 목록을 갱신했습니다.'),
                    );

                    void this.refreshPublicRoomList(
                        false,
                    );

                    return;
                }
            } catch (error) {
                /*
                 * 목록 API 자체가 잠깐 실패한 경우에는 join을 시도하되
                 * 아래 5초 timeout 안전장치가 최종적으로 UI를 복구합니다.
                 */
                console.warn(
                    '[Chameleon Hunt] pre-join room validation failed',
                    error,
                );
            }
        }

        this.setModalBusy(
            true,
            tr('방에 참가하는 중...'),
        );

        /*
         * 페이지 reload를 제거합니다.
         * 기존 joinFromCleanBoot의 안정화된 snapshot/local-player 복구 로직은
         * 그대로 사용하되 현재 Scene에서 직접 실행합니다.
         *
         * 따라서 WebAudio context와 lobbyMusic 인스턴스가 유지되어
         * 로비 -> 방 입장 과정에서 BGM이 끊기지 않습니다.
         */
        sessionStorage.removeItem(
            'chameleon-hunt-pending-reload-join',
        );

        await this.joinFromCleanBoot(
            pending,
        );
    }



    private completeConnectedRoomHandshake(
        room: NonNullable<
            ReturnType<
                typeof multiplayerClient.getRoom
            >
        >,
    ): void {
        if (
            multiplayerClient.getRoom() !== room
        ) {
            return;
        }

        if (
            this.roomHandshakeCompletedId ===
                room.roomId &&
            this.multiplayerSessionActive &&
            this.localNetworkPlayerReady &&
            this.mainMenuObjects.length === 0 &&
            !this.menuModalOverlay
        ) {
            return;
        }

        const localReady =
            this.ensureLocalNetworkPlayer(
                room,
            );

        if (!localReady) {
            return;
        }

        /*
         * 중요:
         * 완료 플래그를 handleJoinedRoom()보다 먼저 세팅하지 않습니다.
         *
         * 이전 구조에서는 최초 참가 시 UI 초기화 중 한 번이라도 예외가 나면
         * roomHandshakeCompletedId/multiplayerSessionActive가 이미 완료 상태가 되어
         * 이후 repair가 전부 return해 화면이 영구적으로 멈출 수 있었습니다.
         */
        this.roomTransitionInProgress =
            true;

        try {
            this.closeMenuModal();
            this.stopRoomListAutoRefresh();

            this.networkPlayerManager
                .syncPlayersFromCurrentRoom();

            this.handleJoinedRoom(
                room,
            );

            /*
             * 실제 Lobby 초기화까지 정상 완료된 뒤에만 완료로 기록.
             */
            this.roomHandshakeCompletedId =
                room.roomId;
            this.multiplayerSessionActive =
                true;
            this.localNetworkPlayerReady =
                this.ensureLocalNetworkPlayer(
                    room,
                );
            this.roomTransitionInProgress =
                false;

            this.roomHandshakeEvent?.remove();
            this.roomHandshakeEvent =
                undefined;
        } catch (error) {
            console.error(
                '[Chameleon Hunt] Lobby UI initialization failed. Network room is preserved; retrying...',
                error,
            );

            /*
             * 실패를 완료 상태로 잠그지 않고 다음 update/handshake에서 다시 시도.
             */
            this.roomHandshakeCompletedId =
                '';
            this.multiplayerSessionActive =
                false;
            this.localNetworkPlayerReady =
                this.ensureLocalNetworkPlayer(
                    room,
                );
            this.roomTransitionInProgress =
                false;

            this.time.delayedCall(
                50,
                () => {
                    if (
                        multiplayerClient.getRoom() ===
                        room
                    ) {
                        this.beginConnectedRoomHandshake(
                            room,
                        );
                    }
                },
            );
        }
    }

    private beginConnectedRoomHandshake(
        room: NonNullable<
            ReturnType<
                typeof multiplayerClient.getRoom
            >
        >,
    ): void {
        if (
            multiplayerClient.getRoom() !== room
        ) {
            return;
        }

        this.closeMenuModal();
        this.stopRoomListAutoRefresh();

        const serial =
            ++this.roomHandshakeSerial;

        this.roomHandshakeEvent?.remove();

        const startedAt =
            this.time.now;

        const tryEnterRoom = (): void => {
            if (
                serial !==
                    this.roomHandshakeSerial ||
                multiplayerClient.getRoom() !==
                    room
            ) {
                this.roomHandshakeEvent
                    ?.remove();
                this.roomHandshakeEvent =
                    undefined;
                return;
            }

            const localReady =
                this.ensureLocalNetworkPlayer(
                    room,
                );

            /*
             * 첫 연결에서는 Colyseus onAdd가 room.state 조회보다 먼저
             * NetworkPlayerManager를 준비시키는 경우가 있습니다.
             * 둘 중 하나라도 준비되면 즉시 로비 진입을 완료합니다.
             */
            if (localReady) {
                this.completeConnectedRoomHandshake(
                    room,
                );
                return;
            }

            /*
             * 정상 연결인데 state 동기화가 늦는 동안에는 실패로 처리하지 않고
             * 최대 3초까지 기다립니다.
             */
            if (
                this.time.now -
                    startedAt >
                3000
            ) {
                console.warn(
                    '[Chameleon Hunt] Waiting for local player state',
                    {
                        roomId:
                            room.roomId,
                        sessionId:
                            room.sessionId,
                        players:
                            room.state.players
                                ?.size ?? 0,
                    },
                );

                /*
                 * Room 자체가 살아 있다면 계속 재시도합니다.
                 * 새로고침을 요구하지 않습니다.
                 */
            }
        };

        tryEnterRoom();

        if (
            !this.ensureLocalNetworkPlayer(
                room,
            )
        ) {
            this.roomHandshakeEvent =
                this.time.addEvent({
                    delay: 50,
                    loop: true,
                    callback:
                        tryEnterRoom,
                });
        }
    }


    private ensureLocalNetworkPlayer(
        room: NonNullable<
            ReturnType<
                typeof multiplayerClient.getRoom
            >
        >,
    ): boolean {
        const sessionId =
            room.sessionId;

        if (
            this.networkPlayerManager
                .hasPlayer(
                    sessionId,
                )
        ) {
            return true;
        }

        /*
         * getLocalPlayer()는 MultiplayerClient에서
         * Schema player -> lobby snapshot fallback 순서로 조회합니다.
         */
        const localPlayer =
            multiplayerClient
                .getLocalPlayer();

        if (localPlayer) {
            this.networkPlayerManager
                .addPlayer(
                    sessionId,
                    localPlayer,
                );

            return this.networkPlayerManager
                .hasPlayer(
                    sessionId,
                );
        }

        multiplayerClient
            .requestLobbySnapshot();

        return false;
    }


    private handleJoinedRoom(
        room: NonNullable<
            ReturnType<
                typeof multiplayerClient.getRoom
            >
        >,
    ): void {
        if (
            multiplayerClient.getRoom() !== room
        ) {
            return;
        }

        /*
         * 방 생성/참가 직후 callback 순서에 의존하지 않습니다.
         * room.state에 이미 존재하는 tr('내 플레이어')를 즉시 view로 보장합니다.
         * onAdd가 먼저 왔더라도 addPlayer()는 기존 view를 update만 하므로 안전합니다.
         */
        this.multiplayerSessionActive = true;
        this.stopRoomListAutoRefresh();
        this.clearMainMenuObjects();

        this.multiplayerText
            .setText('')
            .setVisible(false);

        this.networkPlayerManager
            .syncPlayersFromCurrentRoom();

        /*
         * 중요: 최초 create에서 Schema snapshot이 비어 있어도
         * lobby_snapshot fallback으로 생성된 local view를 유지합니다.
         * 여기서 다시 false로 덮어쓰지 않습니다.
         */
        this.localNetworkPlayerReady =
            this.ensureLocalNetworkPlayer(
                room,
            );

        this.networkPlayerCount =
            multiplayerClient
                .getPlayerCount();

        const joinedPhase =
            room.state?.phase ?? 'lobby';

        this.applyNetworkPhase(
            joinedPhase,
            room.state?.phaseEndsAt ?? 0,
        );

        if (joinedPhase === 'lobby') {
            this.lobbyPanel
                .setVisible(true);

            this.lobbyTitleText
                .setVisible(true);

            this.networkPlayerManager
                .forceLobbyPositionsFromState();

            [80, 220, 520].forEach(
                (delay) => {
                    this.time.delayedCall(
                        delay,
                        () => {
                            if (
                                this.phase ===
                                    'lobby' &&
                                multiplayerClient
                                    .getRoom() ===
                                    room
                            ) {
                                this.networkPlayerManager
                                    .syncPlayersFromCurrentRoom();

                                this.networkPlayerManager
                                    .forceLobbyPositionsFromState();
                            }
                        },
                    );
                },
            );
        }

        this.hideLegacySinglePlayerActors();
        this.clearStatus();

        this.roomTransitionInProgress =
            false;

        this.updateLobbyUi();

        if (joinedPhase === 'lobby') {
            this.time.delayedCall(
                120,
                () => {
                    if (
                        multiplayerClient
                            .getRoom() ===
                            room &&
                        this.phase ===
                            'lobby'
                    ) {
                        multiplayerClient
                            .requestAvatarPresets();

                        this.sendLobbyAvatarPreset();
                    }
                },
            );
        }

        console.log(
            '[Chameleon Hunt] Room ready',
            {
                roomId: room.roomId,
                sessionId: room.sessionId,
                localReady:
                    this.localNetworkPlayerReady,
            },
        );
    }

    private isMultiplayerSession(): boolean {
        return (
            this.multiplayerSessionActive ||
            multiplayerClient.isConnected() ||
            Boolean(
                multiplayerClient.getRoom(),
            )
        );
    }

    private updateNetworkPlayers(
        delta: number,
    ): void {
        if (
            this.isMultiplayerSession() &&
            this.phase === 'hunt'
        ) {
            /*
             * Hunt 중에는 Hunter/Hider 모두 닉네임·ID 라벨을
             * 매 프레임 숨겨 상태 변경 콜백이 다시 표시하지 못하게 합니다.
             */
            this.networkPlayerManager
                .setNamesVisible(false);
        }

        if (
            this.isMultiplayerSession() &&
            this.phase === 'paint'
        ) {
            this.networkPlayerManager
                .showOnlyLocalPlayer();

            this.hideLegacySinglePlayerActors();
        }

        if (this.isMultiplayerSession()) {
            this.hideLegacySinglePlayerActors();

            this.player
                .setVisible(false)
                .setActive(false);

            this.gun
                .setVisible(false)
                .setActive(false);

            this.hunterLabel
                .setVisible(false)
                .setActive(false);
        }

        if (
            !this.isMultiplayerSession() ||
            !this.networkPlayerManager
        ) {
            return;
        }

        /*
         * Critical gameplay invariant:
         * the visual remote position must be the current server Schema
         * position before rendering/movement interpolation this frame.
         */
        this.networkPlayerManager
            .syncAuthoritativePositionsNow();

        const room =
            multiplayerClient
                .getRoom();

        if (room) {
            this.localNetworkPlayerReady =
                this.ensureLocalNetworkPlayer(
                    room,
                );
        } else {
            this.localNetworkPlayerReady =
                false;
        }

        if (!this.localNetworkPlayerReady) {
            /*
             * 네트워크 state가 아직 도착하지 않은 아주 짧은 구간만
             * 렌더링을 유지하고 다음 프레임에 다시 self-heal 합니다.
             */
            this.networkPlayerManager.update(delta);
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
            this.networkPlayerManager.update(delta);
            return;
        }

        let directionX = 0;
        let directionY = 0;

        if (this.moveLeftKey.isDown) {
            directionX -= 1;
        }

        if (this.moveRightKey.isDown) {
            directionX += 1;
        }

        if (this.moveUpKey.isDown) {
            directionY -= 1;
        }

        if (this.moveDownKey.isDown) {
            directionY += 1;
        }

        if (this.mobileControlsEnabled) {
            directionX += this.mobileMoveX;
            directionY += this.mobileMoveY;
        }

        directionX =
            Phaser.Math.Clamp(
                directionX,
                -1,
                1,
            );
        directionY =
            Phaser.Math.Clamp(
                directionY,
                -1,
                1,
            );

        this.networkPlayerManager.moveLocalPlayer(
            directionX,
            directionY,
            delta,
        );

        this.networkPlayerManager.update(delta);
    }

    private hideLegacySinglePlayerActors(): void {
        this.player
            .setVisible(false)
            .setActive(false);

        this.hunterVisuals.forEach(
            ({ object }) => {
                object.setVisible(false);
                object.setActive(false);
            },
        );

        this.gun
            .setVisible(false)
            .setActive(false);

        this.hunterLabel
            .setVisible(false)
            .setActive(false);

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
            .setFixedSize(184, 46)
            .setAlign('center')
            .setInteractive({
                useHandCursor: true,
            });

        const language =
            getLanguage();

        button.setFontSize(
            language === 'en'
                ? 13
                : language === 'ja'
                    ? 14
                    : 15,
        );

        button.on(
            'pointerdown',
            onClick,
        );

        /*
         * 번역 문자열이 길어도 버튼 자체 크기와 scale은 변하지 않습니다.
         * hover에서는 alpha만 조정해 이웃 버튼과 겹치지 않게 합니다.
         */
        button.on(
            'pointerover',
            () => {
                button.setAlpha(0.88);
            },
        );

        button.on(
            'pointerout',
            () => {
                button.setAlpha(1);
            },
        );

        return button;
    }

    private startRoomListAutoRefresh(): void {
        this.roomListRefreshEvent?.remove();
        this.roomListRefreshEvent =
            this.time.addEvent({
                delay: 3000,
                loop: true,
                callback: () => {
                    if (
                        multiplayerClient.isConnected() ||
                        this.roomTransitionInProgress
                    ) {
                        return;
                    }

                    void this.refreshPublicRoomList(
                        false,
                    );
                },
            });
    }

    private stopRoomListAutoRefresh(): void {
        this.roomListRefreshEvent?.remove();
        this.roomListRefreshEvent =
            undefined;
    }

    private hideAllWaitingRoomUi(): void {
        this.lobbyPanel?.setVisible(false);
        this.lobbyInfoCard?.setVisible(false);
        this.lobbyControlsCard?.setVisible(false);
        this.lobbyFooterDivider?.setVisible(false);
        this.lobbyTitleText
            ?.setText('')
            .setVisible(false);
        this.lobbyInfoText
            ?.setText('')
            .setVisible(false);
        this.startGameButton?.setVisible(false);
        this.roleHunterButton?.setVisible(false);
        this.roleHiderButton?.setVisible(false);
        this.inviteLinkButton?.setVisible(false);
        this.leaveRoomButton?.setVisible(false);
        this.lobbyHintText?.setVisible(false);
        this.lobbyMovementHelpText?.setVisible(false);
        this.lobbyPaintDurationLabel?.setVisible(false);
        this.lobbyHuntDurationLabel?.setVisible(false);

        this.paintDurationButtons
            .forEach(
                (button) =>
                    button.setVisible(false),
            );

        this.huntDurationButtons
            .forEach(
                (button) =>
                    button.setVisible(false),
            );

        this.mapSelectorPanel?.setVisible(false);
        this.mapSelectorLabel?.setVisible(false);
        this.mapPreviousButton?.setVisible(false);
        this.mapNextButton?.setVisible(false);

        this.multiplayerText
            ?.setText('')
            .setVisible(false);
    }

    private loadLobbyAvatarPreset(): NetworkPaintStroke[] {
        try {
            const raw =
                localStorage.getItem(
                    this.lobbyAvatarPresetStorageKey,
                );

            if (!raw) {
                return [];
            }

            const parsed =
                JSON.parse(raw);

            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed
                .slice(0, 80)
                .filter(
                    (stroke) =>
                        stroke &&
                        Number.isFinite(
                            stroke.color,
                        ) &&
                        Number.isFinite(
                            stroke.size,
                        ) &&
                        Array.isArray(
                            stroke.points,
                        ),
                )
                .map(
                    (stroke) => ({
                        targetSessionId: '',
                        color:
                            Phaser.Math.Clamp(
                                Math.round(
                                    stroke.color,
                                ),
                                0,
                                0xffffff,
                            ),
                        size:
                            Phaser.Math.Clamp(
                                Math.round(
                                    stroke.size,
                                ),
                                1,
                                12,
                            ),
                        shape:
                            stroke.shape ===
                                'square'
                                ? 'square'
                                : 'circle',
                        points:
                            stroke.points
                                .slice(0, 240)
                                .map(
                                    (point: {
                                        x?: number;
                                        y?: number;
                                    }) => ({
                                        x:
                                            Phaser.Math.Clamp(
                                                Math.round(
                                                    Number(
                                                        point.x ??
                                                        40,
                                                    ),
                                                ),
                                                0,
                                                80,
                                            ),
                                        y:
                                            Phaser.Math.Clamp(
                                                Math.round(
                                                    Number(
                                                        point.y ??
                                                        60,
                                                    ),
                                                ),
                                                0,
                                                120,
                                            ),
                                    }),
                                ),
                    }),
                );
        } catch {
            return [];
        }
    }

    private sendLobbyAvatarPreset(): void {
        if (
            !multiplayerClient.isConnected()
        ) {
            return;
        }

        const sessionId =
            multiplayerClient
                .getSessionId();

        if (!sessionId) {
            return;
        }

        const strokes =
            this.lobbyAvatarPreset
                .map(
                    (stroke) => ({
                        ...stroke,
                        targetSessionId:
                            sessionId,
                        points:
                            stroke.points.map(
                                (point) => ({
                                    x: point.x,
                                    y: point.y,
                                }),
                            ),
                    }),
                );

        multiplayerClient
            .sendAvatarPreset(
                strokes,
            );

        this.lobbyAvatarPresetsBySession
            .set(
                sessionId,
                strokes,
            );

        this.networkPlayerManager
            ?.applyLobbyAvatarPreset(
                sessionId,
                strokes,
            );
    }

    private buildLobbyAvatarPreviewTexture(): string {
        const textureKey =
            'lobby-avatar-preview';

        if (
            this.textures.exists(
                textureKey,
            )
        ) {
            this.textures.remove(
                textureKey,
            );
        }

        const previewCanvas =
            document.createElement(
                'canvas',
            );

        previewCanvas.width = 80;
        previewCanvas.height = 120;

        const previewContext =
            previewCanvas.getContext(
                '2d',
            );

        if (!previewContext) {
            return textureKey;
        }

        previewContext.clearRect(
            0,
            0,
            80,
            120,
        );

        const insideBody = (
            x: number,
            y: number,
        ): boolean => {
            const headDx =
                x - 40;
            const headDy =
                y - 48;

            return (
                headDx * headDx +
                    headDy * headDy <=
                    12 * 12 ||
                (
                    x >= 31 &&
                    x <= 48 &&
                    y >= 55 &&
                    y <= 78
                ) ||
                (
                    x >= 24 &&
                    x <= 31 &&
                    y >= 57 &&
                    y <= 74
                ) ||
                (
                    x >= 48 &&
                    x <= 55 &&
                    y >= 57 &&
                    y <= 74
                ) ||
                (
                    x >= 31 &&
                    x <= 38 &&
                    y >= 75 &&
                    y <= 88
                ) ||
                (
                    x >= 41 &&
                    x <= 48 &&
                    y >= 75 &&
                    y <= 88
                )
            );
        };

        const drawPixel = (
            x: number,
            y: number,
            color: string,
        ): void => {
            if (!insideBody(x, y)) {
                return;
            }

            previewContext.fillStyle =
                color;

            previewContext.fillRect(
                x,
                y,
                1,
                1,
            );
        };

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
                    insideBody(
                        x,
                        y,
                    )
                ) {
                    drawPixel(
                        x,
                        y,
                        '#f5eee2',
                    );
                }
            }
        }

        this.lobbyAvatarPreset.forEach(
            (stroke) => {
                const color =
                    `#${stroke.color
                        .toString(16)
                        .padStart(6, '0')}`;

                stroke.points.forEach(
                    (point) => {
                        const radius =
                            stroke.size <= 1
                                ? 0
                                : stroke.size;

                        for (
                            let oy = -radius;
                            oy <= radius;
                            oy += 1
                        ) {
                            for (
                                let ox = -radius;
                                ox <= radius;
                                ox += 1
                            ) {
                                if (
                                    stroke.shape !==
                                        'square' &&
                                    ox * ox +
                                        oy * oy >
                                        radius *
                                            radius
                                ) {
                                    continue;
                                }

                                drawPixel(
                                    Math.round(
                                        point.x +
                                        ox,
                                    ),
                                    Math.round(
                                        point.y +
                                        oy,
                                    ),
                                    color,
                                );
                            }
                        }
                    },
                );
            },
        );

        this.textures.addCanvas(
            textureKey,
            previewCanvas,
        );

        return textureKey;
    }

    private openLobbyAvatarEditor(): void {
        this.closeMenuModal();
        this.input.enabled = false;

        if (
            this.lobbyAvatarPreset.length ===
            0
        ) {
            this.lobbyAvatarPreset =
                this.loadLobbyAvatarPreset();
        }

        const overlay =
            document.createElement('div');

        Object.assign(
            overlay.style,
            {
                position: 'fixed',
                inset: '0',
                zIndex: '10000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                    'rgba(8, 15, 22, 0.72)',
                pointerEvents: 'auto',
                touchAction: 'none',
            },
        );

        const card =
            document.createElement('div');

        Object.assign(
            card.style,
            {
                width:
                    'min(620px, calc(100vw - 20px))',
                boxSizing: 'border-box',
                padding: '9px 11px',
                border:
                    '3px solid #75a66e',
                borderRadius: '12px',
                maxHeight:
                    'calc(100dvh - 10px)',
                overflowY: 'auto',
                background: '#fff9e8',
                boxShadow:
                    '0 20px 60px rgba(0,0,0,.38)',
                fontFamily:
                    'Arial, sans-serif',
                color: '#35523d',
                textAlign: 'center',
            },
        );

        const title =
            document.createElement('div');

        title.textContent =
            tr('내 캐릭터 꾸미기');

        Object.assign(
            title.style,
            {
                fontSize: '17px',
                fontWeight: '800',
                marginBottom: '1px',
            },
        );

        const hint =
            document.createElement('div');

        hint.textContent =
            tr('휠: 확대/축소 · Ctrl+휠: 브러시 · 모바일: 두 손가락 확대');

        Object.assign(
            hint.style,
            {
                fontSize: '10px',
                lineHeight: '12px',
                color: '#71806b',
                marginBottom: '4px',
            },
        );

        const canvasFrame =
            document.createElement('div');

        Object.assign(
            canvasFrame.style,
            {
                position: 'relative',
                width: '190px',
                height: '285px',
                overflow: 'hidden',
                border:
                    '3px solid #6f8f65',
                borderRadius: '10px',
                background: '#dfeadd',
                boxSizing: 'border-box',
                flex: '0 0 auto',
            },
        );

        const canvas =
            document.createElement('canvas');

        canvas.width = 240;
        canvas.height = 360;

        Object.assign(
            canvas.style,
            {
                width: '100%',
                height: '100%',
                display: 'block',
                imageRendering:
                    'pixelated',
                cursor: 'crosshair',
                touchAction: 'none',
            },
        );

        canvasFrame.appendChild(
            canvas,
        );

        const context =
            canvas.getContext('2d');

        if (!context) {
            this.input.enabled = true;
            return;
        }

        /*
         * Keep a stable non-null reference for nested editor callbacks.
         * TypeScript does not preserve the null narrowing of `context`
         * inside functions such as replay(), so use ctx there.
         */
        const ctx = context;

        const palette = [
            '#111827',
            '#ffffff',
            '#ef4444',
            '#f97316',
            '#facc15',
            '#22c55e',
            '#14b8a6',
            '#38bdf8',
            '#3b82f6',
            '#8b5cf6',
            '#ec4899',
            '#8b5a2b',
        ];

        let selectedColor =
            0x3b82f6;

        let selectedSize = 3;
        let editorZoom = 1.8;
        let drawing = false;
        let paintStarted = false;
        let pendingPointerId = -1;
        let pendingStartScreen:
            { x: number; y: number } |
            undefined;

        let currentPoints:
            NetworkPaintPoint[] = [];

        let hoverPoint:
            NetworkPaintPoint |
            undefined;

        let pinchDistance = 0;
        let pinchActive = false;

        const activePointers =
            new Map<
                number,
                {
                    x: number;
                    y: number;
                }
            >();

        const strokes:
            NetworkPaintStroke[] =
                this.lobbyAvatarPreset
                    .map(
                        (stroke) => ({
                            ...stroke,
                            targetSessionId: '',
                            points:
                                stroke.points.map(
                                    (point) => ({
                                        x: point.x,
                                        y: point.y,
                                    }),
                                ),
                        }),
                    );

        const insideBody = (
            x: number,
            y: number,
        ): boolean => {
            const headDx =
                x - 40;
            const headDy =
                y - 48;

            return (
                headDx * headDx +
                    headDy * headDy <=
                    12 * 12 ||
                (
                    x >= 31 &&
                    x <= 48 &&
                    y >= 55 &&
                    y <= 78
                ) ||
                (
                    x >= 24 &&
                    x <= 31 &&
                    y >= 57 &&
                    y <= 74
                ) ||
                (
                    x >= 48 &&
                    x <= 55 &&
                    y >= 57 &&
                    y <= 74
                ) ||
                (
                    x >= 31 &&
                    x <= 38 &&
                    y >= 75 &&
                    y <= 88
                ) ||
                (
                    x >= 41 &&
                    x <= 48 &&
                    y >= 75 &&
                    y <= 88
                )
            );
        };

        const zoomInput =
            document.createElement(
                'input',
            );

        const sizeInput =
            document.createElement(
                'input',
            );

        const zoomValueText =
            document.createElement(
                'span',
            );

        const brushValueText =
            document.createElement(
                'span',
            );

        const setZoom = (
            nextZoom: number,
        ): void => {
            editorZoom =
                Phaser.Math.Clamp(
                    nextZoom,
                    1,
                    3.4,
                );

            zoomInput.value =
                String(editorZoom);

            zoomValueText.textContent =
                `${editorZoom.toFixed(1)}x`;

            replay();
        };

        const setBrushSize = (
            nextSize: number,
        ): void => {
            selectedSize =
                Phaser.Math.Clamp(
                    Math.round(
                        nextSize,
                    ),
                    1,
                    8,
                );

            sizeInput.value =
                String(selectedSize);

            brushValueText.textContent =
                String(selectedSize);

            replay();
        };

        const canvasToLogical = (
            eventX: number,
            eventY: number,
        ): NetworkPaintPoint => {
            const rect =
                canvas.getBoundingClientRect();

            const displayX =
                (
                    eventX -
                    rect.left
                ) /
                rect.width *
                canvas.width;

            const displayY =
                (
                    eventY -
                    rect.top
                ) /
                rect.height *
                canvas.height;

            /*
             * Rendering zooms around logical body center (40, 60).
             * Invert exactly the same transform for input.
             */
            const logicalCanvasX =
                (
                    displayX -
                    canvas.width / 2
                ) /
                editorZoom +
                40 * 3;

            const logicalCanvasY =
                (
                    displayY -
                    canvas.height / 2
                ) /
                editorZoom +
                60 * 3;

            return {
                x:
                    Phaser.Math.Clamp(
                        Math.floor(
                            logicalCanvasX /
                            3,
                        ),
                        0,
                        79,
                    ),
                y:
                    Phaser.Math.Clamp(
                        Math.floor(
                            logicalCanvasY /
                            3,
                        ),
                        0,
                        119,
                    ),
            };
        };

        const logicalToCanvas = (
            x: number,
            y: number,
        ): {
            x: number;
            y: number;
        } => ({
            x:
                canvas.width / 2 +
                (
                    x * 3 -
                    40 * 3
                ) *
                    editorZoom,
            y:
                canvas.height / 2 +
                (
                    y * 3 -
                    60 * 3
                ) *
                    editorZoom,
        });

        const drawBodyPixel = (
            x: number,
            y: number,
            color: string,
            alpha = 1,
        ): void => {
            if (!insideBody(x, y)) {
                return;
            }

            const screen =
                logicalToCanvas(
                    x,
                    y,
                );

            context.globalAlpha =
                alpha;

            context.fillStyle =
                color;

            context.fillRect(
                screen.x,
                screen.y,
                Math.max(
                    1,
                    3 *
                        editorZoom +
                        0.25,
                ),
                Math.max(
                    1,
                    3 *
                        editorZoom +
                        0.25,
                ),
            );

            context.globalAlpha = 1;
        };

        const paintStroke = (
            stroke:
                NetworkPaintStroke,
            alpha = 1,
        ): void => {
            const color =
                `#${stroke.color
                    .toString(16)
                    .padStart(6, '0')}`;

            stroke.points.forEach(
                (point) => {
                    const radius =
                        stroke.size <= 1
                            ? 0
                            : stroke.size;

                    for (
                        let oy = -radius;
                        oy <= radius;
                        oy += 1
                    ) {
                        for (
                            let ox = -radius;
                            ox <= radius;
                            ox += 1
                        ) {
                            if (
                                stroke.shape !==
                                    'square' &&
                                ox * ox +
                                    oy * oy >
                                    radius *
                                        radius
                            ) {
                                continue;
                            }

                            drawBodyPixel(
                                Math.round(
                                    point.x +
                                    ox,
                                ),
                                Math.round(
                                    point.y +
                                    oy,
                                ),
                                color,
                                alpha,
                            );
                        }
                    }
                },
            );
        };

        const drawBrushPreview =
            (): void => {
                if (!hoverPoint) {
                    return;
                }

                const previewStroke:
                    NetworkPaintStroke = {
                        targetSessionId: '',
                        color:
                            selectedColor,
                        size:
                            selectedSize,
                        shape: 'circle',
                        points: [
                            hoverPoint,
                        ],
                    };

                paintStroke(
                    previewStroke,
                    0.42,
                );

                const center =
                    logicalToCanvas(
                        hoverPoint.x +
                            0.5,
                        hoverPoint.y +
                            0.5,
                    );

                context.strokeStyle =
                    'rgba(35, 62, 48, .88)';
                context.lineWidth =
                    Math.max(
                        1,
                        editorZoom,
                    );

                context.beginPath();
                context.arc(
                    center.x,
                    center.y,
                    Math.max(
                        3,
                        (
                            selectedSize +
                            0.9
                        ) *
                            3 *
                            editorZoom,
                    ),
                    0,
                    Math.PI * 2,
                );
                context.stroke();
            };

        function replay(): void {
            ctx.clearRect(
                0,
                0,
                canvas.width,
                canvas.height,
            );

            ctx.fillStyle =
                '#dfeadd';

            ctx.fillRect(
                0,
                0,
                canvas.width,
                canvas.height,
            );

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
                        insideBody(
                            x,
                            y,
                        )
                    ) {
                        drawBodyPixel(
                            x,
                            y,
                            '#f5eee2',
                        );
                    }
                }
            }

            strokes.forEach(
                (stroke) => {
                    paintStroke(
                        stroke,
                    );
                },
            );

            if (
                paintStarted &&
                currentPoints.length > 0
            ) {
                paintStroke(
                    {
                        targetSessionId: '',
                        color:
                            selectedColor,
                        size:
                            selectedSize,
                        shape: 'circle',
                        points:
                            currentPoints,
                    },
                );
            }

            drawBrushPreview();
        }

        replay();

        const controls =
            document.createElement('div');

        Object.assign(
            controls.style,
            {
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                justifyContent: 'center',
                marginTop: '4px',
                maxWidth: '290px',
            },
        );

        palette.forEach(
            (color) => {
                const swatch =
                    document.createElement(
                        'button',
                    );

                swatch.type = 'button';

                Object.assign(
                    swatch.style,
                    {
                        width: '25px',
                        height: '25px',
                        padding: '0',
                        border:
                            '2px solid #53695a',
                        borderRadius: '7px',
                        background: color,
                        cursor: 'pointer',
                    },
                );

                swatch.addEventListener(
                    'click',
                    () => {
                        selectedColor =
                            Number.parseInt(
                                color.slice(1),
                                16,
                            );

                        replay();
                    },
                );

                controls.appendChild(
                    swatch,
                );
            },
        );

        const makeSliderRow = (
            label: string,
            input:
                HTMLInputElement,
            value:
                HTMLSpanElement,
        ): HTMLDivElement => {
            const row =
                document.createElement(
                    'div',
                );

            Object.assign(
                row.style,
                {
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns:
                        '76px 1fr 38px',
                    gap: '6px',
                    alignItems: 'center',
                    fontSize: '10px',
                    fontWeight: '700',
                    color: '#53695a',
                },
            );

            const labelNode =
                document.createElement(
                    'span',
                );

            labelNode.textContent =
                label;

            row.append(
                labelNode,
                input,
                value,
            );

            return row;
        };

        zoomInput.type = 'range';
        zoomInput.min = '1';
        zoomInput.max = '3.4';
        zoomInput.step = '0.1';
        zoomInput.value =
            String(editorZoom);

        Object.assign(
            zoomInput.style,
            {
                width: '100%',
            },
        );

        zoomValueText.textContent =
            `${editorZoom.toFixed(1)}x`;

        zoomInput.addEventListener(
            'input',
            () => {
                setZoom(
                    Number(
                        zoomInput.value,
                    ),
                );
            },
        );

        sizeInput.type = 'range';
        sizeInput.min = '1';
        sizeInput.max = '8';
        sizeInput.step = '1';
        sizeInput.value =
            String(selectedSize);

        Object.assign(
            sizeInput.style,
            {
                width: '100%',
            },
        );

        brushValueText.textContent =
            String(selectedSize);

        sizeInput.addEventListener(
            'input',
            () => {
                setBrushSize(
                    Number(
                        sizeInput.value,
                    ),
                );
            },
        );

        controls.append(
            makeSliderRow(
                tr('캐릭터 확대'),
                zoomInput,
                zoomValueText,
            ),
            makeSliderRow(
                tr('브러시 크기'),
                sizeInput,
                brushValueText,
            ),
        );

        const finishStroke =
            (): void => {
                if (
                    paintStarted &&
                    currentPoints.length > 0
                ) {
                    strokes.push({
                        targetSessionId: '',
                        color:
                            selectedColor,
                        size:
                            selectedSize,
                        shape: 'circle',
                        points:
                            currentPoints.slice(
                                0,
                                500,
                            ),
                    });
                }

                drawing = false;
                paintStarted = false;
                pendingPointerId = -1;
                pendingStartScreen =
                    undefined;
                currentPoints = [];
                replay();
            };

        const updatePinch =
            (): void => {
                if (
                    activePointers.size !==
                    2
                ) {
                    pinchDistance = 0;
                    pinchActive = false;
                    return;
                }

                const points =
                    [...activePointers.values()];

                const dx =
                    points[0].x -
                    points[1].x;
                const dy =
                    points[0].y -
                    points[1].y;

                const distance =
                    Math.hypot(
                        dx,
                        dy,
                    );

                if (
                    pinchDistance <= 0
                ) {
                    pinchDistance =
                        distance;
                    return;
                }

                const delta =
                    distance -
                    pinchDistance;

                if (
                    !pinchActive &&
                    Math.abs(
                        delta,
                    ) < 10
                ) {
                    return;
                }

                if (!pinchActive) {
                    pinchActive = true;
                    finishStroke();
                }

                if (
                    Math.abs(
                        delta,
                    ) >= 4
                ) {
                    setZoom(
                        editorZoom +
                        delta *
                            0.008,
                    );

                    pinchDistance =
                        distance;
                }
            };

        canvas.addEventListener(
            'wheel',
            (event) => {
                event.preventDefault();

                if (event.ctrlKey) {
                    setBrushSize(
                        selectedSize +
                        (
                            event.deltaY < 0
                                ? 1
                                : -1
                        ),
                    );
                } else {
                    setZoom(
                        editorZoom +
                        (
                            event.deltaY < 0
                                ? 0.15
                                : -0.15
                        ),
                    );
                }
            },
            {
                passive: false,
            },
        );

        canvas.addEventListener(
            'pointerdown',
            (event) => {
                event.preventDefault();

                activePointers.set(
                    event.pointerId,
                    {
                        x: event.clientX,
                        y: event.clientY,
                    },
                );

                canvas.setPointerCapture(
                    event.pointerId,
                );

                if (
                    activePointers.size >=
                    2
                ) {
                    updatePinch();
                    return;
                }

                drawing = true;
                paintStarted = false;
                pendingPointerId =
                    event.pointerId;

                pendingStartScreen = {
                    x: event.clientX,
                    y: event.clientY,
                };

                hoverPoint =
                    canvasToLogical(
                        event.clientX,
                        event.clientY,
                    );

                currentPoints = [];
                replay();
            },
        );

        canvas.addEventListener(
            'pointermove',
            (event) => {
                hoverPoint =
                    canvasToLogical(
                        event.clientX,
                        event.clientY,
                    );

                if (
                    activePointers.has(
                        event.pointerId,
                    )
                ) {
                    activePointers.set(
                        event.pointerId,
                        {
                            x:
                                event.clientX,
                            y:
                                event.clientY,
                        },
                    );
                }

                if (
                    activePointers.size >=
                    2
                ) {
                    updatePinch();
                    replay();
                    return;
                }

                if (
                    !drawing ||
                    pendingPointerId !==
                        event.pointerId
                ) {
                    replay();
                    return;
                }

                event.preventDefault();

                if (
                    !paintStarted &&
                    pendingStartScreen
                ) {
                    const moved =
                        Math.hypot(
                            event.clientX -
                                pendingStartScreen.x,
                            event.clientY -
                                pendingStartScreen.y,
                        );

                    /*
                     * Same safety philosophy as in-game mobile paint:
                     * touch first = preview, actual paint after movement.
                     */
                    if (moved < 1) {
                        replay();
                        return;
                    }

                    paintStarted = true;

                    currentPoints = [
                        canvasToLogical(
                            pendingStartScreen.x,
                            pendingStartScreen.y,
                        ),
                    ];
                }

                const point =
                    canvasToLogical(
                        event.clientX,
                        event.clientY,
                    );

                const last =
                    currentPoints[
                        currentPoints.length -
                        1
                    ];

                if (
                    !last ||
                    last.x !== point.x ||
                    last.y !== point.y
                ) {
                    currentPoints.push(
                        point,
                    );
                }

                replay();
            },
        );

        const releasePointer =
            (
                event: PointerEvent,
            ): void => {
                activePointers.delete(
                    event.pointerId,
                );

                if (
                    activePointers.size <
                    2
                ) {
                    pinchDistance = 0;
                    pinchActive = false;
                }

                if (
                    pendingPointerId ===
                        event.pointerId
                ) {
                    finishStroke();
                }
            };

        canvas.addEventListener(
            'pointerup',
            releasePointer,
        );

        canvas.addEventListener(
            'pointercancel',
            releasePointer,
        );

        canvas.addEventListener(
            'pointerleave',
            () => {
                if (!drawing) {
                    hoverPoint =
                        undefined;
                    replay();
                }
            },
        );

        const actionRow =
            document.createElement('div');

        Object.assign(
            actionRow.style,
            {
                display: 'flex',
                gap: '6px',
                justifyContent: 'center',
                marginTop: '4px',
                flexWrap: 'wrap',
            },
        );

        const makeButton = (
            label: string,
            background: string,
            callback: () => void,
        ): HTMLButtonElement => {
            const button =
                document.createElement(
                    'button',
                );

            button.type = 'button';
            button.textContent = label;

            Object.assign(
                button.style,
                {
                    minWidth: '72px',
                    minHeight: '30px',
                    border: '0',
                    borderRadius: '8px',
                    background,
                    color: '#ffffff',
                    fontWeight: '700',
                    cursor: 'pointer',
                    padding: '5px 8px',
                    fontSize: '11px',
                },
            );

            button.addEventListener(
                'click',
                callback,
            );

            return button;
        };

        const undo =
            makeButton(
                tr('되돌리기'),
                '#78966f',
                () => {
                    finishStroke();
                    strokes.pop();
                    replay();
                },
            );

        const clear =
            makeButton(
                tr('초기화'),
                '#b36b67',
                () => {
                    finishStroke();
                    strokes.length = 0;
                    replay();
                },
            );

        const closeEditor = (
            restoreInput = true,
        ): void => {
            overlay.remove();
            this.menuModalOverlay =
                undefined;

            if (restoreInput) {
                window.setTimeout(
                    () => {
                        this.input.enabled =
                            true;
                    },
                    80,
                );
            }
        };

        const cancel =
            makeButton(
                tr('취소'),
                '#7b8490',
                () => {
                    closeEditor();
                },
            );

        const save =
            makeButton(
                tr('저장'),
                '#55ae5f',
                () => {
                    finishStroke();

                    this.lobbyAvatarPreset =
                        strokes.slice(
                            0,
                            120,
                        );

                    localStorage.setItem(
                        this.lobbyAvatarPresetStorageKey,
                        JSON.stringify(
                            this.lobbyAvatarPreset,
                        ),
                    );

                    closeEditor();

                    /*
                     * Refresh the lobby itself so the saved avatar preview
                     * immediately shows the newly-painted state.
                     */
                    this.showMainMenu();

                    this.showStatus(
                        tr('캐릭터 꾸미기를 저장했습니다.'),
                    );
                },
            );

        actionRow.append(
            undo,
            clear,
            cancel,
            save,
        );

        const sideControls =
            document.createElement('div');

        Object.assign(
            sideControls.style,
            {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '4px',
                minWidth: '250px',
                maxWidth: '290px',
            },
        );

        sideControls.append(
            controls,
            actionRow,
        );

        const editorBody =
            document.createElement('div');

        Object.assign(
            editorBody.style,
            {
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
            },
        );

        editorBody.append(
            canvasFrame,
            sideControls,
        );

        card.append(
            title,
            hint,
            editorBody,
        );

        const applyResponsiveEditorLayout =
            (): void => {
                const compact =
                    window.innerHeight <=
                    600;

                if (compact) {
                    Object.assign(
                        card.style,
                        {
                            width:
                                'min(650px, calc(100vw - 10px))',
                            padding: '6px 8px',
                        },
                    );

                    Object.assign(
                        canvasFrame.style,
                        {
                            width:
                                'min(160px, 38vh)',
                            height:
                                'min(240px, 57vh)',
                        },
                    );

                    title.style.fontSize =
                        '14px';

                    hint.style.fontSize =
                        '9px';

                    sideControls.style
                        .minWidth =
                        '225px';
                }

                if (
                    window.innerWidth <
                        520 &&
                    window.innerHeight >
                        window.innerWidth
                ) {
                    editorBody.style
                        .flexDirection =
                        'column';

                    canvasFrame.style.width =
                        '170px';
                    canvasFrame.style.height =
                        '255px';
                }
            };

        applyResponsiveEditorLayout();

        overlay.appendChild(card);
        document.body.appendChild(
            overlay,
        );

        this.menuModalOverlay =
            overlay;
    }

    private showMainMenu(): void {
        if (
            multiplayerClient.isConnected()
        ) {
            return;
        }

        this.multiplayerSessionActive = false;
        this.roomHandshakeCompletedId = '';
        this.localNetworkPlayerReady = false;

        this.roomListRenderSerial += 1;
        this.roomListObjects.forEach(
            (object) => object.destroy(),
        );
        this.roomListObjects = [];

        this.clearMainMenuObjects();
        this.startRoomListAutoRefresh();
        this.enterLobbyPhase();
        this.updateLobbyUi();

        /*
         * Always clear every waiting-room HUD before rebuilding the main
         * lobby. This is required after a cancelled in-flight room create.
         */
        this.hideAllWaitingRoomUi();

        /*
         * v0.10.10.37 lobby
         * Two-column card layout inspired by the clean mockup:
         * rooms on the left, room actions on the right.
         */
        const panel = this.add
            .rectangle(
                this.gameWidth / 2,
                290,
                820,
                446,
                0xfff9e8,
                0.97,
            )
            .setStrokeStyle(
                3,
                0x6aa86f,
                0.95,
            )
            .setDepth(500);

        const subtitle = this.add
            .text(
                78,
                92,
                tr('위장하고, 숨고, 찾아내세요!'),
                {
                    fontFamily:
                        'Arial, sans-serif',
                    fontSize: '13px',
                    color: '#6f7b64',
                },
            )
            .setDepth(502);

        const roomCard = this.add
            .rectangle(
                325,
                315,
                510,
                290,
                0xfffdf5,
                0.995,
            )
            .setStrokeStyle(
                2,
                0xa8c98e,
                1,
            )
            .setDepth(501);

        const actionCard = this.add
            .rectangle(
                725,
                315,
                254,
                290,
                0xfffdf5,
                0.995,
            )
            .setStrokeStyle(
                2,
                0xa8c98e,
                1,
            )
            .setDepth(501);

        const listTitle = this.add
            .text(
                94,
                184,
                tr('공개 게임방'),
                {
                    fontFamily:
                        'Arial, sans-serif',
                    fontSize: '20px',
                    fontStyle: 'bold',
                    color: '#2f6844',
                },
            )
            .setDepth(503);

        const roomDivider = this.add
            .rectangle(
                325,
                218,
                466,
                1,
                0xa9c99b,
                0.9,
            )
            .setDepth(502);


        const roomListHeader =
            this.add.text(
                102,
                226,
                `${tr('방 이름')}      ${tr('인원')}      ${tr('상태')}`,
                {
                    fontFamily:
                        'Arial, sans-serif',
                    fontSize: '9px',
                    color: '#72806f',
                },
            )
                .setDepth(503);

        /*
         * Refresh belongs to the public-room header, not between unrelated
         * elements. Right-aligned with a compact refresh glyph.
         */
        const refreshButton =
            this.makeMenuButton(
                526,
                184,
                `↻ ${tr('새로고침')}`,
                () => {
                    void this.refreshPublicRoomList(true);
                },
            );

        refreshButton
            .setFixedSize(
                78,
                26,
            )
            .setAlign('center')
            .setOrigin(0.5)
            .setFontSize(
                getLanguage() === 'en'
                    ? 9
                    : getLanguage() === 'ja'
                        ? 9
                        : 10,
            )
            .setPadding(
                0,
                1,
                0,
                0,
            )
            .setBackgroundColor(
                '#dff0d1',
            )
            .setColor(
                '#2f6844',
            );

        const actionTitle = this.add
            .text(
                622,
                184,
                tr('게임 시작하기'),
                {
                    fontFamily:
                        'Arial, sans-serif',
                    fontSize: '19px',
                    fontStyle: 'bold',
                    color: '#2f6844',
                },
            )
            .setDepth(503);


        /*
         * Saved lobby avatar preview:
         * users can see their current customization before opening editor.
         */
        if (
            this.lobbyAvatarPreset.length ===
            0
        ) {
            this.lobbyAvatarPreset =
                this.loadLobbyAvatarPreset();
        }

        const avatarPreviewTexture =
            this.buildLobbyAvatarPreviewTexture();

        const avatarPreviewFrame =
            this.add.rectangle(
                636,
                118,
                42,
                54,
                0xdfeadd,
                1,
            )
                .setStrokeStyle(
                    2,
                    0x75a66e,
                    1,
                )
                .setDepth(503);

        const avatarPreview =
            this.add.image(
                636,
                118,
                avatarPreviewTexture,
            )
                .setDisplaySize(
                    36,
                    54,
                )
                .setDepth(504);

        const avatarCustomizeButton =
            this.add.text(
                760,
                118,
                `🎨 ${tr('내 캐릭터 꾸미기')}`,
                {
                    fontFamily:
                        'Arial, sans-serif',
                    fontSize:
                        getLanguage() === 'ja'
                            ? '11px'
                            : '12px',
                    fontStyle: 'bold',
                    color: '#35523d',
                    backgroundColor:
                        '#e8f5dc',
                    fixedWidth: 176,
                    fixedHeight: 32,
                    align: 'center',
                    padding: {
                        top: 8,
                    },
                },
            )
                .setOrigin(0.5)
                .setDepth(504)
                .setInteractive({
                    useHandCursor: true,
                });

        avatarCustomizeButton.on(
            'pointerdown',
            () => {
                this.openLobbyAvatarEditor();
            },
        );

        const makeAction = (
            y: number,
            label: string,
            color: string,
            callback: () => void,
        ): Phaser.GameObjects.Text => {
            const button =
                this.add.text(
                    725,
                    y,
                    label,
                    {
                        fontFamily:
                            'Arial, sans-serif',
                        fontSize: '15px',
                        fontStyle: 'bold',
                        color: '#ffffff',
                        backgroundColor:
                            color,
                        fixedWidth: 214,
                        fixedHeight: 54,
                        align: 'center',
                        padding: {
                            top: 17,
                        },
                    },
                )
                    .setOrigin(0.5)
                    .setDepth(503)
                    .setInteractive({
                        useHandCursor: true,
                    });

            button.on(
                'pointerover',
                () =>
                    button.setAlpha(0.84),
            );
            button.on(
                'pointerout',
                () =>
                    button.setAlpha(1),
            );
            button.on(
                'pointerdown',
                callback,
            );

            return button;
        };

        const publicCreate =
            makeAction(
                242,
                `＋  ${tr('공개방 만들기')}`,
                '#55ae5f',
                () => {
                    this.openCreateRoomModal(
                        false,
                    );
                },
            );

        const privateCreate =
            makeAction(
                306,
                `▣  ${tr('비공개방 만들기')}`,
                '#4b97d1',
                () => {
                    this.openCreateRoomModal(
                        true,
                    );
                },
            );

        const privateJoin =
            makeAction(
                370,
                `◎  ${tr('비공개방 참가')}`,
                '#8d65c9',
                () => {
                    this.openPrivateJoinModal();
                },
            );

        const helpCard = this.add
            .rectangle(
                725,
                428,
                214,
                50,
                0xf5f1df,
                1,
            )
            .setStrokeStyle(
                1,
                0xb9c9a8,
                1,
            )
            .setDepth(502);

        const helpText = this.add
            .text(
                632,
                412,
                `${tr('게임 설명')}\n${tr('위장하고, 숨고, 찾아내세요!')}`,
                {
                    fontFamily:
                        'Arial, sans-serif',
                    fontSize: '11px',
                    color: '#566456',
                    lineSpacing: 4,
                    wordWrap: {
                        width: 186,
                    },
                },
            )
            .setDepth(503);

        const languageBar =
            this.add.rectangle(
                480,
                486,
                780,
                34,
                0xf7f7e8,
                1,
            )
            .setStrokeStyle(
                2,
                0xa8c98e,
                1,
            )
            .setDepth(502);

        const languageLabels:
            Array<[GameLanguage, string]> = [
                ['ko', '한국어'],
                ['ja', '日本語'],
                ['en', 'English'],
                ['zh', '中文'],
            ];

        const languageButtons =
            languageLabels.map(
                ([language, label], index) => {
                    const selected =
                        getLanguage() === language;

                    const button =
                        this.add.text(
                            310 + index * 112,
                            486,
                            label,
                            {
                                fontFamily:
                                    'Arial, sans-serif',
                                fontSize: '12px',
                                fontStyle:
                                    selected
                                        ? 'bold'
                                        : 'normal',
                                color:
                                    selected
                                        ? '#ffffff'
                                        : '#415445',
                                backgroundColor:
                                    selected
                                        ? '#58a962'
                                        : '#fffaf0',
                                fixedWidth: 96,
                                fixedHeight: 26,
                                align: 'center',
                                padding: {
                                    top: 6,
                                },
                            },
                        )
                            .setOrigin(0.5)
                            .setDepth(504)
                            .setInteractive({
                                useHandCursor: true,
                            });

                    button.on(
                        'pointerdown',
                        () => {
                            setLanguage(language);
                            this.closeMenuModal();
                            this.showMainMenu();
                        },
                    );

                    return button;
                },
            );

        this.mainMenuObjects.push(
            panel,
            subtitle,
            roomCard,
            actionCard,
            listTitle,
            roomDivider,
            roomListHeader,
            refreshButton,
            actionTitle,
            avatarPreviewFrame,
            avatarPreview,
            avatarCustomizeButton,
            publicCreate,
            privateCreate,
            privateJoin,
            helpCard,
            helpText,
            languageBar,
            ...languageButtons,
        );

        void this.refreshPublicRoomList();
    }

    private async refreshPublicRoomList(showLoading = true): Promise<void> {
        const renderSerial =
            ++this.roomListRenderSerial;

        this.roomListObjects.forEach(
            (object) => {
                object.destroy();
            },
        );

        this.roomListObjects = [];

        const loading =
            showLoading
                ? this.add
                    .text(
                        102,
                        252,
                        tr('방 목록을 불러오는 중...'),
                        {
                            fontFamily: 'Arial, sans-serif',
                            fontSize: '13px',
                            color: '#6f7868',
                        },
                    )
                    .setDepth(503)
                : undefined;

        if (loading) {
            this.roomListObjects.push(
                loading,
            );
        }

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

            if (
                renderSerial !==
                this.roomListRenderSerial
            ) {
                loading?.destroy();
                return;
            }

            /*
             * 초대 링크/직접 참가 중 room list 요청이 늦게 끝나더라도
             * 이미 방에 연결된 상태라면 메인 메뉴 UI를 다시 만들지 않습니다.
             */
            if (
                multiplayerClient.isConnected() ||
                this.roomTransitionInProgress
            ) {
                loading?.destroy();
                return;
            }

            console.log(
                '[Chameleon Hunt] Public rooms',
                rooms,
            );

            loading?.destroy();
            this.roomListObjects = [];

            if (rooms.length === 0) {
                const emptyText =
                    this.add
                        .text(
                            102,
                            252,
                            tr('생성된 공개방이 없습니다.'),
                            {
                                fontFamily: 'Arial, sans-serif',
                                fontSize: '13px',
                                color: '#6f7868',
                            },
                        )
                        .setDepth(503);

                this.roomListObjects.push(
                    emptyText,
                );

                return;
            }

            rooms
                .slice(0, 5)
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
                                325,
                                258 +
                                    index * 39,
                                `${roomTitle} · ${room.clients}/${room.maxClients} · ${trPhase(phase)}`,
                                () => {
                                    /*
                                     * native prompt 제거 후 공개방 참가도
                                     * 새 DOM 모달 경로를 사용해야 합니다.
                                     */
                                    this.openJoinRoomModal(
                                        room.roomId,
                                        false,
                                    );
                                },
                            );

                        row
                            .setFontSize(
                                getLanguage() === 'en'
                                    ? 10
                                    : 11,
                            )
                            .setFixedSize(
                                456,
                                34,
                            )
                            .setAlign(
                                'left',
                            )
                            .setOrigin(
                                0.5,
                            )
                            .setPadding(
                                14,
                                8,
                                0,
                                0,
                            )
                            .setBackgroundColor(
                                '#eef8e8',
                            )
                            .setColor(
                                '#35523d',
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

            if (
                multiplayerClient.isConnected()
            ) {
                loading?.destroy();
                return;
            }

            loading?.setText(
                tr('방 목록을 불러오지 못했습니다.'),
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
        /*
         * Waiting room: one clean right-side control dock.
         * Every decorative rectangle stays below the text/buttons, so no
         * panel can visually cover an interactive element.
         */
        this.lobbyPanel =
            this.add.rectangle(
                824,
                286,
                260,
                468,
                0xfff9e8,
                0.98,
            )
                .setStrokeStyle(
                    3,
                    0x6aa86f,
                    0.95,
                )
                .setDepth(390);

        /*
         * The page already has the large COLOR HUNT header.
         * Keep this object only for compatibility, but never render a second
         * title inside the waiting-room panel.
         */
        this.lobbyTitleText =
            this.add.text(
                824,
                72,
                '',
                {
                    fontFamily:
                        'Arial, sans-serif',
                    fontSize: '1px',
                    color: '#00000000',
                },
            )
                .setOrigin(0.5)
                .setDepth(405)
                .setVisible(false);

        /*
         * ROOM INFO CARD
         */
        this.lobbyInfoCard =
            this.add.rectangle(
                824,
                150,
                228,
                104,
                0xfffdf5,
                1,
            )
                .setStrokeStyle(
                    2,
                    0xd5bd82,
                    0.95,
                )
                .setDepth(395);

        this.lobbyInfoText =
            this.add.text(
                824,
                106,
                '',
                {
                    fontFamily:
                        'Arial, sans-serif',
                    fontSize: '11px',
                    color: '#4b4137',
                    align: 'left',
                    lineSpacing: 5,
                    fixedWidth: 192,
                },
            )
                .setOrigin(0.5, 0)
                .setDepth(406)
                .setVisible(false);

        /*
         * HOST / movement line.
         */
        this.lobbyHintText =
            this.add.text(
                824,
                214,
                '',
                {
                    fontFamily:
                        'Arial, sans-serif',
                    fontSize: '15px',
                    fontStyle: 'bold',
                    color: '#e36b2c',
                    align: 'center',
                },
            )
                .setOrigin(0.5)
                .setDepth(406);

        this.lobbyMovementHelpText =
            this.add.text(
                824,
                236,
                tr('WASD 이동'),
                {
                    fontFamily:
                        'Arial, sans-serif',
                    fontSize: '10px',
                    fontStyle: 'bold',
                    color: '#506a59',
                    align: 'center',
                },
            )
                .setOrigin(0.5)
                .setDepth(406);

        /*
         * GAME SETTINGS CARD
         */
        this.lobbyControlsCard =
            this.add.rectangle(
                824,
                352,
                228,
                220,
                0xeaf7fb,
                0.98,
            )
                .setStrokeStyle(
                    2,
                    0x9cc9d5,
                    0.95,
                )
                .setDepth(395);

        this.roleHunterButton =
            this.makeMenuButton(
                770,
                274,
                tr('HUNTER 지원'),
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
                .setDepth(406)
                .setFixedSize(104, 32)
                .setAlign('center');

        this.roleHiderButton =
            this.makeMenuButton(
                878,
                274,
                tr('지원 취소'),
                () => {
                    multiplayerClient
                        .sendHunterVolunteer(
                            false,
                        );
                },
            )
                .setDepth(406)
                .setFixedSize(104, 32)
                .setAlign('center');

        [
            this.roleHunterButton,
            this.roleHiderButton,
        ].forEach((button) => {
            button.removeAllListeners(
                'pointerover',
            );
            button.removeAllListeners(
                'pointerout',
            );
            button.setScale(1);

            button.on(
                'pointerover',
                () => {
                    button.setAlpha(0.88);
                },
            );

            button.on(
                'pointerout',
                () => {
                    this.updateLobbyUi();
                },
            );
        });

        this.lobbyPaintDurationLabel =
            this.add.text(
                824,
                306,
                tr('색칠 시간'),
                {
                    fontFamily:
                        'Arial, sans-serif',
                    fontSize: '10px',
                    fontStyle: 'bold',
                    color: '#8da096',
                },
            )
                .setOrigin(0.5)
                .setDepth(406);

        this.paintDurationButtons =
            [90_000, 120_000, 150_000]
                .map(
                    (
                        durationMs,
                        index,
                    ) => {
                        const seconds =
                            durationMs / 1000;

                        return this.makeMenuButton(
                            754 +
                                index * 70,
                            328,
                            `${seconds}s`,
                            () => {
                                if (
                                    multiplayerClient
                                        .isHost() &&
                                    multiplayerClient
                                        .getPhase() ===
                                        'lobby'
                                ) {
                                    multiplayerClient
                                        .sendPaintDurationSelection(
                                            durationMs,
                                        );
                                }
                            },
                        )
                            .setDepth(406)
                            .setFixedSize(
                                62,
                                26,
                            )
                            .setAlign('center')
                            .setFontSize(10);
                    },
                );

        this.lobbyHuntDurationLabel =
            this.add.text(
                824,
                356,
                tr('사냥 시간'),
                {
                    fontFamily:
                        'Arial, sans-serif',
                    fontSize: '10px',
                    fontStyle: 'bold',
                    color: '#8da096',
                },
            )
                .setOrigin(0.5)
                .setDepth(406);

        this.huntDurationButtons =
            [80_000, 100_000, 120_000]
                .map(
                    (
                        durationMs,
                        index,
                    ) => {
                        const seconds =
                            durationMs / 1000;

                        return this.makeMenuButton(
                            754 +
                                index * 70,
                            378,
                            `${seconds}s`,
                            () => {
                                if (
                                    multiplayerClient
                                        .isHost() &&
                                    multiplayerClient
                                        .getPhase() ===
                                        'lobby'
                                ) {
                                    multiplayerClient
                                        .sendHuntDurationSelection(
                                            durationMs,
                                        );
                                }
                            },
                        )
                            .setDepth(406)
                            .setFixedSize(
                                62,
                                26,
                            )
                            .setAlign('center')
                            .setFontSize(10);
                    },
                );

        /*
         * START lives in its own row, never underneath another panel.
         */
        this.startGameButton =
            this.add.text(
                824,
                426,
                tr('START GAME'),
                {
                    fontFamily:
                        'Arial, sans-serif',
                    fontSize: '17px',
                    fontStyle: 'bold',
                    color: '#ffffff',
                    backgroundColor:
                        '#65b94f',
                    fixedWidth: 214,
                    fixedHeight: 38,
                    align: 'center',
                    padding: {
                        top: 9,
                    },
                },
            )
                .setOrigin(0.5)
                .setDepth(407)
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
                    multiplayerClient
                        .sendStartGame();
                }
            },
        );

        this.startGameButton.on(
            'pointerover',
            () => {
                this.startGameButton
                    .setAlpha(0.9);
            },
        );

        this.startGameButton.on(
            'pointerout',
            () => {
                this.startGameButton
                    .setScale(1);
                this.updateLobbyUi();
            },
        );

        /*
         * Footer actions are separated by a divider rather than another
         * opaque card over the buttons.
         */
        this.lobbyFooterDivider =
            this.add.rectangle(
                824,
                470,
                214,
                1,
                0xb7cf9f,
                0.9,
            )
                .setDepth(396);

        this.inviteLinkButton =
            this.makeMenuButton(
                768,
                494,
                tr('초대 링크 복사'),
                () => {
                    void this.copyInviteLink();
                },
            )
                .setDepth(406)
                .setBackgroundColor(
                    '#4b97d1',
                )
                .setColor(
                    '#ffffff',
                )
                .setFixedSize(
                    108,
                    34,
                )
                .setAlign('center')
                .setFontSize(
                    getLanguage() === 'en'
                        ? 9
                        : 11,
                );

        this.leaveRoomButton =
            this.makeMenuButton(
                880,
                494,
                tr('로비로 나가기'),
                () => {
                    void this.leaveCurrentRoomToLobby();
                },
            )
                .setDepth(406)
                .setBackgroundColor(
                    '#ef6a62',
                )
                .setColor(
                    '#ffffff',
                )
                .setFixedSize(
                    108,
                    34,
                )
                .setAlign('center')
                .setFontSize(
                    getLanguage() === 'en'
                        ? 9
                        : 11,
                );

        this.updateLobbyUi();
    }

    private createMapSelectorUi(): void {
        /*
         * 대기방의 맵 자체가 미리보기 역할을 합니다.
         * 이 작은 HUD에서는 방장이 좌/우로 선택값만 바꿉니다.
         */
        this.mapSelectorPanel =
            this.add.rectangle(
                205,
                42,
                330,
                48,
                0x172027,
                0.84,
            )
                .setStrokeStyle(
                    2,
                    0xf4f0dd,
                    0.72,
                )
                .setDepth(450)
                .setVisible(false);

        this.mapPreviousButton =
            this.add.text(
                70,
                42,
                '◀',
                {
                    fontFamily:
                        'monospace',
                    fontSize: '24px',
                    fontStyle: 'bold',
                    color: '#ffffff',
                    backgroundColor:
                        '#5c8f66',
                    padding: {
                        x: 10,
                        y: 4,
                    },
                },
            )
                .setOrigin(0.5)
                .setDepth(451)
                .setVisible(false)
                .setInteractive({
                    useHandCursor: true,
                });

        this.mapSelectorLabel =
            this.add.text(
                205,
                42,
                tr('MAP  RANDOM'),
                {
                    fontFamily:
                        'monospace',
                    fontSize: '16px',
                    fontStyle: 'bold',
                    color: '#ffffff',
                    align: 'center',
                },
            )
                .setOrigin(0.5)
                .setDepth(451)
                .setVisible(false);

        this.mapNextButton =
            this.add.text(
                340,
                42,
                '▶',
                {
                    fontFamily:
                        'monospace',
                    fontSize: '24px',
                    fontStyle: 'bold',
                    color: '#ffffff',
                    backgroundColor:
                        '#5c8f66',
                    padding: {
                        x: 10,
                        y: 4,
                    },
                },
            )
                .setOrigin(0.5)
                .setDepth(451)
                .setVisible(false)
                .setInteractive({
                    useHandCursor: true,
                });

        this.mapPreviousButton.on(
            'pointerdown',
            () => {
                this.changeLobbyMapSelection(
                    -1,
                );
            },
        );

        this.mapNextButton.on(
            'pointerdown',
            () => {
                this.changeLobbyMapSelection(
                    1,
                );
            },
        );
    }

    private changeLobbyMapSelection(
        direction: -1 | 1,
    ): void {
        if (
            !multiplayerClient.isHost() ||
            multiplayerClient.getPhase() !==
                'lobby'
        ) {
            return;
        }

        const selected =
            multiplayerClient
                .getSelectedMap();

        const currentIndex =
            Math.max(
                0,
                this.selectableMaps
                    .indexOf(selected),
            );

        const nextIndex =
            (
                currentIndex +
                direction +
                this.selectableMaps.length
            ) %
            this.selectableMaps.length;

        multiplayerClient
            .sendMapSelection(
                this.selectableMaps[
                    nextIndex
                ],
            );
    }

    private getBackgroundTextureKey(
        mapName: string,
    ): string {
        const match =
            /^map([1-9]|1[0-2])$/.exec(
                mapName,
            );

        if (!match) {
            return 'forest-background';
        }

        return `map-background-${match[1]}`;
    }

    private syncMapBackground(): void {
        const room =
            multiplayerClient.getRoom();

        let mapName = 'forest';

        if (
            room &&
            this.phase === 'lobby'
        ) {
            const selected =
                multiplayerClient
                    .getSelectedMap();

            /*
             * RANDOM은 실제 라운드 시작 전까지 정보를 숨기고
             * 기존 forest-01 대기방을 보여줍니다.
             */
            mapName =
                selected === 'random'
                    ? 'forest'
                    : selected;
        } else if (
            room &&
            (
                this.phase === 'countdown' ||
                this.phase === 'paint' ||
                this.phase === 'hunt' ||
                this.phase === 'finished'
            )
        ) {
            mapName =
                multiplayerClient
                    .getActiveMap();
        }

        const textureKey =
            this.getBackgroundTextureKey(
                mapName,
            );

        if (
            textureKey ===
                this.currentBackgroundTextureKey ||
            !this.textures.exists(
                textureKey,
            )
        ) {
            return;
        }

        this.currentBackgroundTextureKey =
            textureKey;

        this.backgroundImage
            .setTexture(textureKey)
            .setDisplaySize(
                this.gameWidth,
                this.gameHeight,
            );

        /*
         * 텍스처마다 원본 크기가 다를 수 있으므로 새 display scale을
         * paint zoom의 기준값으로 다시 저장합니다.
         */
    }

    private updateMapSelectorUi(): void {
        if (
            !this.mapSelectorPanel
        ) {
            return;
        }

        const visible =
            this.phase === 'lobby' &&
            multiplayerClient
                .isConnected();

        const isHost =
            multiplayerClient.isHost();

        const selected =
            multiplayerClient
                .getSelectedMap();

        const index =
            this.selectableMaps
                .indexOf(selected);

        const label =
            selected === 'random'
                ? tr('MAP  RANDOM')
                : tr(
                    `MAP  ${Math.max(1, index)} / 11`,
                );

        this.mapSelectorPanel
            .setVisible(visible);

        this.mapSelectorLabel
            .setText(label)
            .setVisible(visible);

        this.mapPreviousButton
            .setVisible(
                visible &&
                isHost,
            )
            .setAlpha(
                isHost
                    ? 1
                    : 0.4,
            );

        this.mapNextButton
            .setVisible(
                visible &&
                isHost,
            )
            .setAlpha(
                isHost
                    ? 1
                    : 0.4,
            );
    }

    private updateLobbyUi(): void {
        if (!this.lobbyPanel) {
            return;
        }

        this.networkPlayerCount =
            multiplayerClient
                .getPlayerCount();

        const isLobby =
            this.phase === 'lobby';

        if (isLobby) {
            this.multiplayerText
                .setText('')
                .setVisible(false);
        }

        this.lobbyPanel.setVisible(isLobby);
        this.lobbyInfoCard?.setVisible(isLobby);
        this.lobbyControlsCard?.setVisible(isLobby);
        this.lobbyFooterDivider?.setVisible(isLobby);
        /*
         * Main page header already shows the game title; never duplicate it
         * inside the waiting-room panel.
         */
        this.lobbyTitleText
            .setText('')
            .setVisible(false);
        this.updateMapSelectorUi();
        this.roleHunterButton.setVisible(isLobby);
        this.roleHiderButton.setVisible(isLobby);

        if (!isLobby) {
            this.lobbyInfoText
                .setText('')
                .setVisible(false);

            this.startGameButton.setVisible(false);
            this.roleHunterButton.setVisible(false);
            this.roleHiderButton.setVisible(false);
            this.inviteLinkButton?.setVisible(false);
            this.leaveRoomButton?.setVisible(false);
            this.mapSelectorPanel?.setVisible(false);
            this.mapSelectorLabel?.setVisible(false);
            this.mapPreviousButton?.setVisible(false);
            this.mapNextButton?.setVisible(false);
            this.paintDurationButtons.forEach((button) => button.setVisible(false));
            this.huntDurationButtons.forEach((button) => button.setVisible(false));
            this.lobbyHintText?.setVisible(false);
            this.lobbyMovementHelpText?.setVisible(false);
            this.lobbyPaintDurationLabel?.setVisible(false);
            this.lobbyHuntDurationLabel?.setVisible(false);
            return;
        }

        const roomId =
            multiplayerClient.getRoomId() ??
            '-';

        const localPlayer =
            multiplayerClient.getLocalPlayer();

        const isHost =
            multiplayerClient.isHost();

        const lobbyInfo =
            !this.localNetworkPlayerReady
                ? tr('플레이어 연결 중...')
                : [
                    tr(tr(`ROOM  ${roomId}`)),
                    tr(tr(`TITLE  ${multiplayerClient.getRoom()?.state.roomTitle ?? '-'}`)),
                    tr(tr(`PLAYERS  ${this.networkPlayerCount} / 10`)),
                    tr(
                        `MAP  ${
                            multiplayerClient
                                .getSelectedMap() ===
                                'random'
                                ? 'RANDOM'
                                : multiplayerClient
                                    .getSelectedMap()
                                    .toUpperCase()
                        }`,
                    ),
                ].join('\n');

        const hasLobbyInfo =
            lobbyInfo.trim().length > 0;

        this.lobbyInfoText
            .setText(lobbyInfo)
            .setVisible(
                isLobby &&
                hasLobbyInfo,
            );

        this.lobbyHintText
            .setText(
                isHost
                    ? tr('방장')
                    : '',
            )
            .setVisible(
                isLobby &&
                isHost,
            );

        this.lobbyMovementHelpText
            .setText(
                tr('WASD 이동'),
            )
            .setVisible(isLobby);

        this.lobbyPaintDurationLabel
            .setText(
                `${tr('색칠 시간')} · ${
                    Math.round(
                        multiplayerClient
                            .getPaintDurationMs() /
                        1000,
                    )
                }s`,
            )
            .setVisible(isLobby);

        this.lobbyHuntDurationLabel
            .setText(
                `${tr('사냥 시간')} · ${
                    Math.round(
                        multiplayerClient
                            .getHuntDurationMs() /
                        1000,
                    )
                }s`,
            )
            .setVisible(isLobby);

        this.inviteLinkButton
            ?.setText(
                tr('초대 링크 복사'),
            )
            .setVisible(
                isHost &&
                roomId !== '-',
            );

        this.leaveRoomButton
            ?.setText(
                tr('로비로 나가기'),
            )
            .setVisible(
                roomId !== '-',
            );

        this.inviteLinkButton
            ?.setFontSize(
                getLanguage() === 'ja'
                    ? 9
                    : getLanguage() === 'en'
                        ? 9
                        : 10,
            )

        this.leaveRoomButton
            ?.setFontSize(
                getLanguage() === 'ja'
                    ? 10
                    : getLanguage() === 'en'
                        ? 9
                        : 10,
            )

        const selectedPaintDuration =
            multiplayerClient
                .getPaintDurationMs();

        this.paintDurationButtons
            .forEach(
                (button, index) => {
                    const option =
                        [90_000, 120_000, 150_000][index];

                    button
                        .setVisible(isLobby)
                        .setAlpha(
                            option ===
                                selectedPaintDuration
                                ? 1
                                : isHost
                                    ? 0.58
                                    : 0.25,
                        );

                    if (isHost) {
                        button.setInteractive({
                            useHandCursor:
                                true,
                        });
                    } else {
                        button.disableInteractive();
                    }
                },
            );

        const selectedHuntDuration =
            multiplayerClient
                .getHuntDurationMs();

        this.huntDurationButtons
            .forEach(
                (button, index) => {
                    const option =
                        [80_000, 100_000, 120_000][index];

                    button
                        .setVisible(isLobby)
                        .setAlpha(
                            option ===
                                selectedHuntDuration
                                ? 1
                                : isHost
                                    ? 0.58
                                    : 0.25,
                        );

                    if (isHost) {
                        button.setInteractive({
                            useHandCursor:
                                true,
                        });
                    } else {
                        button.disableInteractive();
                    }
                },
            );

        this.startGameButton
            .setVisible(isHost)
            .setAlpha(
                this.networkPlayerCount >= 2
                    ? 1
                    : 0.55,
            );

        this.roleHunterButton
            .setFontSize(
                getLanguage() === 'en'
                    ? 9
                    : getLanguage() === 'ja'
                        ? 10
                        : 11,
            )
            .setText(
                localPlayer
                    ?.hunterVolunteer
                    ? tr('HUNTER 지원 중')
                    : tr('HUNTER 지원'),
            )
            .setAlpha(
                localPlayer
                    ?.hunterVolunteer
                    ? 1
                    : 0.72,
            );

        this.roleHiderButton
            .setFontSize(
                getLanguage() === 'en'
                    ? 9
                    : 11,
            )
            .setText(
                tr('지원 취소'),
            )
            .setAlpha(
                localPlayer
                    ?.hunterVolunteer
                    ? 1
                    : 0.55,
            );

        this.startGameButton
            .setFixedSize(
                214,
                40,
            )
            .setAlign('center')
            .setFontSize(
                getLanguage() === 'en'
                    ? 14
                    : 17,
            )
            .setText(
                this.networkPlayerCount >= 2
                    ? tr('START GAME')
                    : tr('FOR PLAYER'),
            );
    }

    private async leaveCurrentRoomToLobby(): Promise<void> {
        if (
            this.roomTransitionInProgress
        ) {
            return;
        }

        this.roomTransitionInProgress = true;

        /*
         * 명시적인 방 나가기는 page reload 없이 처리합니다.
         * MultiplayerClient.disconnect()는 local room 참조를 즉시 해제하고
         * 실제 WebSocket leave handshake는 백그라운드에서 완료합니다.
         *
         * 따라서 로비 BGM/WebAudio context도 그대로 유지됩니다.
         */
        await multiplayerClient.disconnect();

        this.multiplayerSessionActive = false;
        this.localNetworkPlayerReady = false;
        this.roomHandshakeCompletedId = '';
        this.networkPlayerCount = 0;

        /*
         * 이전 Room 캐릭터/paint view를 모두 정리한 뒤
         * 메인 로비 화면을 다시 구성합니다.
         */
        this.networkPlayerManager
            .clearAllPlayers();

        this.enterLobbyPhase();

        this.currentBackgroundTextureKey =
            'forest-background';

        this.backgroundImage
            .setTexture(
                'forest-background',
            )
            .setDisplaySize(
                this.gameWidth,
                this.gameHeight,
            );
        this.showMainMenu();

        this.roomTransitionInProgress = false;

        this.showStatus(
            tr('방에서 나왔습니다.'),
        );
    }


    private createCountdownUi(): void {
        this.countdownPanel = this.add
            .rectangle(
                this.gameWidth / 2,
                this.gameHeight / 2,
                this.gameWidth,
                this.gameHeight,
                0xfff4d6,
                0.96,
            )
            .setDepth(2000)
            .setScrollFactor(0)
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
                    color: '#1f2937',
                    backgroundColor:
                        'rgba(255, 244, 214, 0.68)',
                    padding: {
                        x: 30,
                        y: 20,
                    },
                    align: 'center',
                },
            )
            .setOrigin(0.5)
            .setDepth(2001)
            .setScrollFactor(0)
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

        this.countdownPanel.setVisible(visible);
        this.countdownText.setVisible(visible);

        if (!visible) {
            return;
        }

        const remaining =
            Math.max(
                0,
                Math.ceil(
                    (
                        this.phaseEndTime -
                        this.time.now
                    ) / 1000,
                ),
            );

        /*
         * 서버 phase 전환 패킷이 조금 늦더라도 1초 화면에서
         * 멈춰 있지 않도록 로컬 종료 시점이 지나면 결과 UI를 즉시 숨깁니다.
         */
        if (
            isRoundEnd &&
            remaining <= 0
        ) {
            this.countdownPanel
                .setVisible(false);

            this.countdownText
                .setText('')
                .setVisible(false);

            this.timerText
                .setText('')
                .setVisible(false);

            return;
        }

        if (isRoundEnd) {
            const victoryText =
                this.roundResultWinner === 'hunters'
                    ? tr('HUNTER 승리!')
                    : this.roundResultWinner === 'hiders'
                        ? tr('HIDER 승리!')
                        : tr('ROUND OVER');

            this.countdownPanel
                .setFillStyle(0x000000, 0)
                .setAlpha(0);

            const victoryColor =
                this.roundResultWinner === 'hunters'
                    ? '#d32f2f'
                    : '#1f2937';

            if (remaining > 5) {
                this.countdownText
                    .setFontSize(58)
                    .setColor(victoryColor)
                    .setText(victoryText);

                this.timerText
                    .setText('')
                    .setVisible(false);
            } else {
                this.countdownText
                    .setFontSize(48)
                    .setColor(victoryColor)
                    .setText(
                        [
                            victoryText,
                            tr('게임 종료'),
                            String(remaining),
                        ].join('\n'),
                    );

                this.timerText
                    .setText('')
                    .setVisible(false);
            }

            return;
        }

        /*
         * 스크린샷에서 숫자 위에 떠 있던 작은 흰 네모는
         * text가 비어 있는 timerText의 background였습니다.
         * 시작 카운트 중 timerText 자체를 숨깁니다.
         */
        this.timerText
            .setText('')
            .setVisible(false);

        this.countdownPanel
            .setFillStyle(0x000000, 0)
            .setAlpha(0);

        if (
            remaining >= 1 &&
            remaining <= 3 &&
            remaining !== this.lastCountdownSoundValue
        ) {
            this.lastCountdownSoundValue = remaining;

            if (this.audioUnlocked) {
                if (remaining === 1) {
                    this.countdownStartSound?.play();
                } else {
                    this.countdownBeepSound?.play();
                }
            }
        }

        this.countdownText
            .setFontSize(110)
            .setColor('#1f2937')
            .setText(String(remaining));
    }

    private updateWeaponHeatHud(): void {
        const localRole =
            multiplayerClient
                .getLocalPlayer()
                ?.role;

        const localIsHunter =
            this.networkPlayerManager
                .canLocalControlHunter() ||
            localRole === 'hunter';

        const visible =
            multiplayerClient
                .isConnected() &&
            this.phase === 'hunt' &&
            localIsHunter;

        this.hunterWeaponHudContainer
            ?.setVisible(visible);

        /*
         * Multiplayer에서는 기존 문자열 SHELLS / □ / PRECISION HUD를
         * 완전히 사용하지 않습니다.
         */
        if (
            this.isMultiplayerSession()
        ) {
            this.ammoText
                ?.setVisible(false);
        }

        if (!visible) {
            return;
        }

        const now = Date.now();

        const elapsed =
            Math.max(
                0,
                now -
                this.weaponHeatUpdatedAt,
            );

        /*
         * 서버에서 받은 마지막 heat 값을 기준으로,
         * 서버와 동일한 cooldown 속도로 매 프레임 부드럽게 감소시킵니다.
         */
        const estimatedHeat =
            Phaser.Math.Clamp(
                this.weaponHeat -
                    elapsed * 0.025,
                0,
                100,
            );

        const overheated =
            now <
            this.weaponOverheatedUntil;

        /*
         * AMMO
         * 숫자와 SHELLS 텍스트 대신 shotgun shell 모양 자체를 개수로 표시.
         * 남은 탄 = 컬러 shell
         * 사용한 탄 = 흐린 outline shell
         */
        this.hunterAmmoGraphics.clear();

        const iconWidth = 9;
        const iconHeight = 16;
        const iconGap = 5;
        const startX = 2;
        const startY = 2;

        for (
            let index = 0;
            index <
                this.hunterMaxReserve;
            index += 1
        ) {
            const x =
                startX +
                index *
                    (
                        iconWidth +
                        iconGap
                    );

            const loaded =
                index <
                this.hunterReserve;

            if (loaded) {
                /*
                 * Shotgun shell:
                 * 둥근 빨간 탄두 + 붉은 몸통 + 황동색 바닥.
                 */
                this.hunterAmmoGraphics
                    .fillStyle(
                        0xd94b3d,
                        1,
                    )
                    .fillRoundedRect(
                        x + 1,
                        startY,
                        iconWidth - 2,
                        iconHeight - 4,
                        3,
                    )
                    .fillStyle(
                        0xe0ad37,
                        1,
                    )
                    .fillRect(
                        x,
                        startY +
                            iconHeight -
                            5,
                        iconWidth,
                        5,
                    )
                    .lineStyle(
                        1,
                        0x59483b,
                        1,
                    )
                    .strokeRoundedRect(
                        x + 1,
                        startY,
                        iconWidth - 2,
                        iconHeight - 4,
                        3,
                    )
                    .strokeRect(
                        x,
                        startY +
                            iconHeight -
                            5,
                        iconWidth,
                        5,
                    );
            } else {
                this.hunterAmmoGraphics
                    .lineStyle(
                        1,
                        0x897f72,
                        0.55,
                    )
                    .strokeRoundedRect(
                        x + 1,
                        startY,
                        iconWidth - 2,
                        iconHeight - 4,
                        3,
                    )
                    .strokeRect(
                        x,
                        startY +
                            iconHeight -
                            5,
                        iconWidth,
                        5,
                    );
            }
        }

        /*
         * HEAT BAR
         * □ 문자 대신 0~100% 연속 길이.
         * 안전: green -> 주의: yellow/orange -> 위험: red
         */
        const barX = 36;
        const barY = 23;
        const barWidth = 138;
        const barHeight = 9;

        this.hunterHeatGraphics.clear();

        this.hunterHeatGraphics
            .fillStyle(
                0x252d29,
                0.22,
            )
            .fillRoundedRect(
                barX,
                barY,
                barWidth,
                barHeight,
                3,
            );

        const ratio =
            estimatedHeat / 100;

        let heatColor =
            0x55a95d;

        if (
            estimatedHeat <= 50
        ) {
            const mixed =
                Phaser.Display.Color
                    .Interpolate
                    .ColorWithColor(
                        Phaser.Display.Color
                            .ValueToColor(
                                0x55a95d,
                            ),
                        Phaser.Display.Color
                            .ValueToColor(
                                0xf1c84b,
                            ),
                        100,
                        Math.round(
                            estimatedHeat *
                                2,
                        ),
                    );

            heatColor =
                Phaser.Display.Color
                    .GetColor(
                        mixed.r,
                        mixed.g,
                        mixed.b,
                    );
        } else {
            const mixed =
                Phaser.Display.Color
                    .Interpolate
                    .ColorWithColor(
                        Phaser.Display.Color
                            .ValueToColor(
                                0xf1c84b,
                            ),
                        Phaser.Display.Color
                            .ValueToColor(
                                0xd83a34,
                            ),
                        100,
                        Math.round(
                            (
                                estimatedHeat -
                                50
                            ) * 2,
                        ),
                    );

            heatColor =
                Phaser.Display.Color
                    .GetColor(
                        mixed.r,
                        mixed.g,
                        mixed.b,
                    );
        }

        if (ratio > 0) {
            this.hunterHeatGraphics
                .fillStyle(
                    heatColor,
                    1,
                )
                .fillRoundedRect(
                    barX,
                    barY,
                    Math.max(
                        2,
                        barWidth *
                            ratio,
                    ),
                    barHeight,
                    3,
                );
        }

        /*
         * 과열 중에는 작은 경고만 표시.
         * PRECISION은 의미가 직관적이지 않아 HUD에서 제거했습니다.
         */
        this.hunterOverheatLabel
            .setText(
                overheated
                    ? tr('OVERHEAT!')
                    : '',
            )
            .setVisible(
                overheated,
            );
    }

    private createHuntTensionUi(): void {
        /*
         * 원형 시야:
         * 어두운 월드 레이어에 Hider 위치를 중심으로 원형 구멍을 냅니다.
         * 캐릭터가 맵 가장자리로 이동해 화면 중앙에서 벗어나도
         * 시야 원은 실제 캐릭터 위치를 따라갑니다.
         */
        this.hiderVisionOverlays = [];

        /*
         * GeometryMask는 브라우저/카메라 상태에 따라 전체가 검게 보이는
         * 문제가 있었기 때문에 사용하지 않습니다.
         *
         * 대신 원 바깥 영역을 Graphics로 직접 그립니다.
         */
        this.hiderVisionGraphics =
            this.add.graphics()
                .setDepth(700)
                .setVisible(false);

        /*
         * 가까운 Hunter가 있을 때 화면 전체가 박동에 맞춰 붉어집니다.
         */
        this.heartbeatDangerOverlay =
            this.add.rectangle(
                this.gameWidth / 2,
                this.gameHeight / 2,
                this.gameWidth,
                this.gameHeight,
                0xb20d18,
                1,
            )
                .setDepth(710)
                .setAlpha(0)
                .setVisible(false);

        const borderThickness = 18;

        this.heartbeatBorders = [
            this.add.rectangle(
                this.gameWidth / 2,
                borderThickness / 2,
                this.gameWidth,
                borderThickness,
                0xff1f2d,
                1,
            ),
            this.add.rectangle(
                this.gameWidth / 2,
                this.gameHeight -
                    borderThickness / 2,
                this.gameWidth,
                borderThickness,
                0xff1f2d,
                1,
            ),
            this.add.rectangle(
                borderThickness / 2,
                this.gameHeight / 2,
                borderThickness,
                this.gameHeight,
                0xff1f2d,
                1,
            ),
            this.add.rectangle(
                this.gameWidth -
                    borderThickness / 2,
                this.gameHeight / 2,
                borderThickness,
                this.gameHeight,
                0xff1f2d,
                1,
            ),
        ];

        this.heartbeatBorders.forEach(
            (border) => {
                border
                    .setDepth(4200)
                    .setScrollFactor(0)
                    .setAlpha(0)
                    .setVisible(false);
            },
        );

        this.heartbeatText =
            this.add.text(
                18,
                this.gameHeight - 58,
                '♥',
                {
                    fontFamily: 'monospace',
                    fontSize: '24px',
                    fontStyle: 'bold',
                    color: '#ff2535',
                    backgroundColor:
                        'rgba(48,4,8,0.72)',
                    padding: {
                        x: 8,
                        y: 4,
                    },
                },
            )
                .setDepth(4210)
                .setScrollFactor(0)
                .setVisible(false);

        this.hidePointText =
            this.add.text(
                this.gameWidth - 18,
                18,
                tr('HIDE 0'),
                {
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    fontStyle: 'bold',
                    color: '#26352b',
                    backgroundColor:
                        'rgba(255,244,214,0.82)',
                    padding: {
                        x: 9,
                        y: 6,
                    },
                },
            )
                .setOrigin(1, 0)
                .setDepth(4210)
                .setScrollFactor(0)
                .setVisible(false);

        this.hunterMinimapPanel =
            this.add.rectangle(
                this.gameWidth - 108,
                this.gameHeight - 78,
                190,
                120,
                0x101820,
                0.78,
            )
                .setStrokeStyle(
                    2,
                    0xe7dcc1,
                    0.9,
                )
                .setDepth(4210)
                .setScrollFactor(0)
                .setVisible(false);

        this.hunterMinimapText =
            this.add.text(
                this.gameWidth - 196,
                this.gameHeight - 132,
                tr('MINIMAP'),
                {
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    fontStyle: 'bold',
                    color: '#f5eee2',
                },
            )
                .setDepth(4212)
                .setScrollFactor(0)
                .setVisible(false);

        this.hunterMinimapMarker =
            this.add.circle(
                this.gameWidth - 108,
                this.gameHeight - 78,
                5,
                0xffdf70,
                1,
            )
                .setStrokeStyle(
                    2,
                    0x26352b,
                    1,
                )
                .setDepth(4214)
                .setScrollFactor(0)
                .setVisible(false);
    }

    private hideHuntTensionUi(): void {
        this.spectatorButton
            ?.setVisible(false);

        this.spectatorStatusText
            ?.setVisible(false);

        this.hiderVisionOverlays.forEach(
            (overlay) => {
                overlay.setVisible(false);
            },
        );

        this.hiderVisionGraphics
            ?.clear()
            .setVisible(false);

        this.heartbeatDangerOverlay
            ?.setVisible(false)
            .setAlpha(0);

        this.heartbeatBorders.forEach(
            (border) => {
                border
                    .setVisible(false)
                    .setAlpha(0);
            },
        );

        this.heartbeatText
            ?.setVisible(false)
            .setScale(1);

        this.hidePointText
            ?.setVisible(false);

        this.hunterMinimapPanel
            ?.setVisible(false);

        this.hunterMinimapText
            ?.setVisible(false);

        this.hunterMinimapMarker
            ?.setVisible(false);
    }

    private isHunterVisibleToHider(
        hiderPosition: Phaser.Math.Vector2,
        hunterPosition: Phaser.Math.Vector2,
    ): boolean {
        const distance =
            Phaser.Math.Distance.Between(
                hiderPosition.x,
                hiderPosition.y,
                hunterPosition.x,
                hunterPosition.y,
            );

        if (distance > 250) {
            return false;
        }

        const sightLine =
            new Phaser.Geom.Line(
                hiderPosition.x,
                hiderPosition.y,
                hunterPosition.x,
                hunterPosition.y,
            );

        const blocked =
            this.obstacles.some(
                (obstacle) =>
                    Phaser.Geom.Intersects
                        .LineToRectangle(
                            sightLine,
                            obstacle.bounds,
                        ),
            );

        return !blocked;
    }

    private setFixedHudScreenPosition(
        object:
            Phaser.GameObjects.Components.Transform,
        screenX: number,
        screenY: number,
    ): void {
        const zoom =
            Math.max(
                0.01,
                this.cameras.main.zoom,
            );

        const centerX =
            this.gameWidth / 2;

        const centerY =
            this.gameHeight / 2;

        object.setPosition(
            centerX +
                (
                    screenX -
                    centerX
                ) /
                zoom,
            centerY +
                (
                    screenY -
                    centerY
                ) /
                zoom,
        );
    }

    private updateHunterMinimap(): void {
        const localPosition =
            this.networkPlayerManager
                .getLocalPlayerPosition();

        if (!localPosition) {
            return;
        }

        const left =
            this.gameWidth - 203;

        const top =
            this.gameHeight - 138;

        const width = 190;
        const height = 120;

        const markerScreenX =
            left +
            Phaser.Math.Clamp(
                localPosition.x /
                    this.gameWidth,
                0,
                1,
            ) *
                width;

        const markerScreenY =
            top +
            Phaser.Math.Clamp(
                localPosition.y /
                    this.gameHeight,
                0,
                1,
            ) *
                height;

        this.setFixedHudScreenPosition(
            this.hunterMinimapMarker,
            markerScreenX,
            markerScreenY,
        );
    }

    private drawCircularHiderVision(
        center:
            Phaser.Math.Vector2,
        radiusWorld: number,
    ): void {
        const graphics =
            this.hiderVisionGraphics;

        graphics
            .clear()
            .setVisible(true);

        /*
         * 바깥을 완전 검정이 아니라 짙은 청흑색으로 처리합니다.
         * 캐릭터 주변 원 안은 완전히 보이고 경계만 부드럽게 어두워집니다.
         */
        graphics.fillStyle(
            0x071019,
            0.52,
        );

        const step = 3;

        const minY =
            Math.floor(
                center.y -
                    radiusWorld -
                    40,
            );

        const maxY =
            Math.ceil(
                center.y +
                    radiusWorld +
                    40,
            );

        /*
         * 카메라가 캐릭터를 항상 화면 중앙에 두기 때문에
         * 월드 바깥까지 커버하도록 넉넉한 사각 영역을 사용합니다.
         */
        const margin =
            Math.max(
                this.gameWidth,
                this.gameHeight,
            );

        graphics.fillRect(
            -margin,
            -margin,
            this.gameWidth +
                margin * 2,
            Math.max(
                0,
                minY + margin,
            ),
        );

        for (
            let y = minY;
            y <= maxY;
            y += step
        ) {
            const dy =
                y -
                center.y;

            if (
                Math.abs(dy) >
                radiusWorld
            ) {
                graphics.fillRect(
                    -margin,
                    y,
                    this.gameWidth +
                        margin * 2,
                    step + 1,
                );
                continue;
            }

            const halfWidth =
                Math.sqrt(
                    Math.max(
                        0,
                        radiusWorld *
                            radiusWorld -
                        dy * dy,
                    ),
                );

            graphics.fillRect(
                -margin,
                y,
                center.x -
                    halfWidth +
                    margin,
                step + 1,
            );

            graphics.fillRect(
                center.x +
                    halfWidth,
                y,
                this.gameWidth +
                    margin -
                    (
                        center.x +
                        halfWidth
                    ),
                step + 1,
            );
        }

        graphics.fillRect(
            -margin,
            maxY,
            this.gameWidth +
                margin * 2,
            this.gameHeight +
                margin -
                maxY,
        );

        /*
         * 경계에 얇은 반투명 링을 겹쳐 딱 잘린 원처럼 보이지 않게 합니다.
         */
        for (
            let index = 0;
            index < 10;
            index += 1
        ) {
            graphics
                .lineStyle(
                    3 /
                        Math.max(
                            0.01,
                            this.cameras.main.zoom,
                        ),
                    0x071019,
                    0.025 +
                        index *
                            0.010,
                )
                .strokeCircle(
                    center.x,
                    center.y,
                    radiusWorld +
                        index *
                            (
                                3 /
                                Math.max(
                                    0.01,
                                    this.cameras.main.zoom,
                                )
                            ),
                );
        }
    }

    private drawHunterFocusVision(
        center:
            Phaser.Math.Vector2,
        angle: number,
    ): void {
        const graphics =
            this.hiderVisionGraphics;

        graphics
            .clear()
            .setVisible(true);

        const zoom =
            Math.max(
                0.01,
                this.cameras.main.zoom,
            );

        /*
         * True circular sector:
         * - two straight rays begin at the Hunter body
         * - the far edge is a rounded circular arc
         *
         * This reads visually as a flashlight / fan instead of a triangle.
         */
        const range =
            285 / zoom;

        const halfAngle =
            Phaser.Math.DegToRad(
                36,
            );

        const arcSteps = 18;

        const sector:
            Phaser.Math.Vector2[] = [
                center.clone(),
            ];

        for (
            let index = 0;
            index <= arcSteps;
            index += 1
        ) {
            const t =
                index /
                arcSteps;

            const arcAngle =
                Phaser.Math.Linear(
                    angle -
                        halfAngle,
                    angle +
                        halfAngle,
                    t,
                );

            sector.push(
                new Phaser.Math.Vector2(
                    center.x +
                        Math.cos(
                            arcAngle,
                        ) *
                            range,
                    center.y +
                        Math.sin(
                            arcAngle,
                        ) *
                            range,
                ),
            );
        }

        const margin =
            Math.max(
                this.gameWidth,
                this.gameHeight,
            );

        const minWorldX =
            -margin;
        const maxWorldX =
            this.gameWidth +
            margin;
        const minWorldY =
            -margin;
        const maxWorldY =
            this.gameHeight +
            margin;

        const step =
            Math.max(
                2,
                3 / zoom,
            );

        const edgeIntersectionX = (
            a: Phaser.Math.Vector2,
            b: Phaser.Math.Vector2,
            y: number,
        ): number | null => {
            const minY =
                Math.min(
                    a.y,
                    b.y,
                );
            const maxY =
                Math.max(
                    a.y,
                    b.y,
                );

            if (
                y < minY ||
                y >= maxY ||
                Math.abs(
                    b.y - a.y,
                ) < 0.0001
            ) {
                return null;
            }

            const t =
                (
                    y - a.y
                ) /
                (
                    b.y - a.y
                );

            return Phaser.Math.Linear(
                a.x,
                b.x,
                t,
            );
        };

        graphics.fillStyle(
            0x071019,
            0.72,
        );

        for (
            let y = minWorldY;
            y <= maxWorldY;
            y += step
        ) {
            const intersections:
                number[] = [];

            for (
                let index = 0;
                index <
                sector.length;
                index += 1
            ) {
                const x =
                    edgeIntersectionX(
                        sector[index],
                        sector[
                            (
                                index + 1
                            ) %
                                sector.length
                        ],
                        y,
                    );

                if (
                    x !== null &&
                    Number.isFinite(x)
                ) {
                    intersections.push(
                        x,
                    );
                }
            }

            intersections.sort(
                (a, b) =>
                    a - b,
            );

            if (
                intersections.length < 2
            ) {
                graphics.fillRect(
                    minWorldX,
                    y,
                    maxWorldX -
                        minWorldX,
                    step + 1,
                );
                continue;
            }

            const visibleLeft =
                intersections[0];

            const visibleRight =
                intersections[
                    intersections.length -
                    1
                ];

            graphics.fillRect(
                minWorldX,
                y,
                Math.max(
                    0,
                    visibleLeft -
                        minWorldX,
                ),
                step + 1,
            );

            graphics.fillRect(
                visibleRight,
                y,
                Math.max(
                    0,
                    maxWorldX -
                        visibleRight,
                ),
                step + 1,
            );
        }

        /*
         * Soft side rays + rounded far arc create a more polished
         * flashlight edge without making the visible area perfectly crisp.
         */
        for (
            let layer = 0;
            layer < 6;
            layer += 1
        ) {
            const alpha =
                0.11 +
                layer *
                    0.025;

            const expandedRange =
                range +
                layer *
                    (4 / zoom);

            const expandedHalf =
                halfAngle +
                Phaser.Math.DegToRad(
                    layer * 1.3,
                );

            graphics.lineStyle(
                3 / zoom,
                0x243746,
                alpha,
            );

            graphics.lineBetween(
                center.x,
                center.y,
                center.x +
                    Math.cos(
                        angle -
                            expandedHalf,
                    ) *
                        expandedRange,
                center.y +
                    Math.sin(
                        angle -
                            expandedHalf,
                    ) *
                        expandedRange,
            );

            graphics.lineBetween(
                center.x,
                center.y,
                center.x +
                    Math.cos(
                        angle +
                            expandedHalf,
                    ) *
                        expandedRange,
                center.y +
                    Math.sin(
                        angle +
                            expandedHalf,
                    ) *
                        expandedRange,
            );

            const arcPoints:
                Phaser.Math.Vector2[] = [];

            for (
                let index = 0;
                index <= 16;
                index += 1
            ) {
                const t =
                    index / 16;

                const arcAngle =
                    Phaser.Math.Linear(
                        angle -
                            expandedHalf,
                        angle +
                            expandedHalf,
                        t,
                    );

                arcPoints.push(
                    new Phaser.Math.Vector2(
                        center.x +
                            Math.cos(
                                arcAngle,
                            ) *
                                expandedRange,
                        center.y +
                            Math.sin(
                                arcAngle,
                            ) *
                                expandedRange,
                    ),
                );
            }

            for (
                let index = 1;
                index <
                arcPoints.length;
                index += 1
            ) {
                graphics.lineBetween(
                    arcPoints[
                        index - 1
                    ].x,
                    arcPoints[
                        index - 1
                    ].y,
                    arcPoints[index].x,
                    arcPoints[index].y,
                );
            }
        }
    }

    private updateHuntTension(
        delta: number,
    ): void {
        if (
            this.phase !== 'hunt' ||
            !this.isMultiplayerSession()
        ) {
            this.hideHuntTensionUi();
            return;
        }

        const localRole =
            this.networkPlayerManager
                .getLocalRole();

        if (localRole === 'hunter') {
            const hunterPosition =
                this.networkPlayerManager
                    .getLocalPlayerPosition();

            if (hunterPosition) {
                this.drawHunterFocusVision(
                    hunterPosition,
                    this.hunterFocusAngle,
                );
            }

            this.heartbeatDangerOverlay
                .setVisible(false)
                .setAlpha(0);

            this.heartbeatBorders.forEach(
                (border) => {
                    border
                        .setVisible(false)
                        .setAlpha(0);
                },
            );

            this.heartbeatText
                .setVisible(false)
                .setScale(1);

            this.hidePointText
                .setVisible(false);

            this.hunterMinimapPanel
                .setVisible(true);

            this.hunterMinimapText
                .setVisible(true);

            this.hunterMinimapMarker
                .setVisible(true);

            this.updateHunterMinimap();
            return;
        }

        if (localRole !== 'hider') {
            this.hideHuntTensionUi();
            return;
        }

        this.hunterMinimapPanel
            .setVisible(false);
        this.hunterMinimapText
            .setVisible(false);
        this.hunterMinimapMarker
            .setVisible(false);

        const spectatedPlayer =
            this.spectatorSessionId
                ? this.networkPlayerManager
                    .getSpectatablePlayers()
                    .find(
                        (player) =>
                            player.sessionId ===
                            this.spectatorSessionId,
                    )
                : undefined;

        if (
            spectatedPlayer?.role ===
            'hunter'
        ) {
            const hunterViewPosition =
                new Phaser.Math.Vector2(
                    spectatedPlayer.x,
                    spectatedPlayer.y,
                );

            this.drawHunterFocusVision(
                hunterViewPosition,
                this.networkPlayerManager
                    .getPlayerAimAngle(
                        spectatedPlayer.sessionId,
                    ),
            );

            this.hidePointText
                .setVisible(false);

            this.heartbeatDangerOverlay
                .setVisible(false)
                .setAlpha(0);

            this.heartbeatBorders.forEach(
                (border) => {
                    border
                        .setVisible(false)
                        .setAlpha(0);
                },
            );

            this.heartbeatText
                .setVisible(false);

            return;
        }

        const localPosition =
            spectatedPlayer
                ? new Phaser.Math.Vector2(
                    spectatedPlayer.x,
                    spectatedPlayer.y,
                )
                : this.networkPlayerManager
                    .getLocalPlayerPosition();

        this.hidePointText
            .setVisible(true)
            .setText(
                `HIDE ${Math.floor(
                    this.hidePoints,
                )}`,
            );

        const hunterPositions =
            this.networkPlayerManager
                .getAliveHunterPositions();

        if (
            !localPosition ||
            hunterPositions.length === 0
        ) {
            if (localPosition) {
                this.drawCircularHiderVision(
                    localPosition,
                    this.hiderVisionRadiusScreen /
                        Math.max(
                            0.01,
                            this.cameras.main.zoom,
                        ),
                );
            } else {
                this.hiderVisionGraphics
                    .clear()
                    .setVisible(false);
            }

            this.heartbeatDangerOverlay
                .setVisible(false)
                .setAlpha(0);

            this.heartbeatBorders.forEach(
                (border) => {
                    border
                        .setVisible(false)
                        .setAlpha(0);
                },
            );

            this.heartbeatText
                .setVisible(false)
                .setScale(1);

            return;
        }

        let nearestDistance =
            Number.POSITIVE_INFINITY;

        let hunterInSight = false;

        hunterPositions.forEach(
            (hunterPosition) => {
                const distance =
                    Phaser.Math.Distance.Between(
                        localPosition.x,
                        localPosition.y,
                        hunterPosition.x,
                        hunterPosition.y,
                    );

                nearestDistance =
                    Math.min(
                        nearestDistance,
                        distance,
                    );

                if (
                    this.isHunterVisibleToHider(
                        localPosition,
                        hunterPosition,
                    )
                ) {
                    hunterInSight = true;
                }
            },
        );

        /*
         * 두근두근은 Hunter가 정말 가까이 왔을 때만 시작합니다.
         * 약 260px부터 감지되고, 약 90px 부근에서 최대 강도입니다.
         */
        const intensity =
            Phaser.Math.Clamp(
                (
                    260 -
                    nearestDistance
                ) /
                    170,
                0,
                1,
            );

        /*
         * Hunter 거리는 heartbeat 강도에만 영향을 줍니다.
         * 시야 반경은 항상 동일합니다.
         */
        const radiusWorld =
            this.hiderVisionRadiusScreen /
            Math.max(
                0.01,
                this.cameras.main.zoom,
            );

        this.drawCircularHiderVision(
            localPosition,
            radiusWorld,
        );

        if (intensity <= 0) {
            this.heartbeatDangerOverlay
                .setVisible(false)
                .setAlpha(0);

            this.heartbeatBorders.forEach(
                (border) => {
                    border
                        .setVisible(false)
                        .setAlpha(0);
                },
            );

            this.heartbeatText
                .setVisible(false)
                .setScale(1);
        } else {
            /*
             * 빠른 점멸 대신 충분한 휴지 구간이 있는 느린 심박.
             */
            const period =
                Phaser.Math.Linear(
                    2200,
                    900,
                    intensity,
                );

            const cycle =
                (
                    this.time.now %
                    period
                ) /
                period;

            /*
             * 쿵-쿵 ... 쉼 형태의 double beat.
             */
            const firstBeat =
                Math.exp(
                    -Math.pow(
                        (
                            cycle -
                            0.10
                        ) /
                            0.085,
                        2,
                    ),
                );

            const secondBeat =
                0.72 *
                Math.exp(
                    -Math.pow(
                        (
                            cycle -
                            0.24
                        ) /
                            0.10,
                        2,
                    ),
                );

            const pulse =
                Math.max(
                    firstBeat,
                    secondBeat,
                );

            const borderAlpha =
                Phaser.Math.Clamp(
                    intensity *
                        (
                            0.16 +
                            pulse * 0.48
                        ),
                    0,
                    0.68,
                );

            const dangerAlpha =
                Phaser.Math.Clamp(
                    intensity *
                        (
                            0.015 +
                            pulse * 0.10
                        ),
                    0,
                    0.13,
                );

            this.heartbeatDangerOverlay
                .setVisible(true)
                .setAlpha(
                    dangerAlpha,
                );

            this.heartbeatBorders.forEach(
                (border) => {
                    border
                        .setVisible(true)
                        .setAlpha(
                            borderAlpha,
                        );
                },
            );

            this.heartbeatText
                .setVisible(true)
                .setScale(
                    1 +
                    pulse *
                        intensity *
                        0.12,
                )
                .setAlpha(
                    0.62 +
                    pulse * 0.38,
                )
                .setText(
                    intensity > 0.78
                        ? tr('♥ 위험!')
                        : intensity > 0.42
                            ? tr('♥ 두근두근')
                            : tr('♥ 두근'),
                );

            if (
                this.time.now >=
                this.nextHeartbeatAt
            ) {
                this.nextHeartbeatAt =
                    this.time.now +
                    period;

                this.playHeartbeatSound(
                    intensity,
                );

                this.cameras.main.shake(
                    55,
                    0.00020 +
                        intensity *
                            0.00045,
                );
            }
        }

        if (hunterInSight) {
            const rate =
                6 +
                intensity * 14;

            this.hidePoints +=
                rate *
                (
                    delta /
                    1000
                );

            this.hidePointText
                .setText(
                    `HIDE ${Math.floor(
                        this.hidePoints,
                    )} ▲`,
                );
        }
    }

    private unlockGameAudio(): void {
        if (this.audioUnlocked) {
            return;
        }

        this.audioUnlocked = true;
        this.syncPhaseMusic();
    }

    private createBgmToggleButton(): void {
        this.bgmToggleButton = this.add
            .text(
                this.gameWidth - 14,
                14,
                this.bgmEnabled
                    ? tr('♫ BGM ON')
                    : tr('♫ BGM OFF'),
                {
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    fontStyle: 'bold',
                    color: '#ffffff',
                    backgroundColor: '#20262bcc',
                    padding: { x: 8, y: 6 },
                },
            )
            .setOrigin(1, 0)
            .setScrollFactor(0)
            .setDepth(5000)
            .setInteractive({ useHandCursor: true });

        this.bgmToggleButton.on(
            'pointerdown',
            (
                _pointer: Phaser.Input.Pointer,
                _localX: number,
                _localY: number,
                event: Phaser.Types.Input.EventData,
            ) => {
                /*
                 * BGM 버튼 클릭이 월드 POINTER_DOWN까지 전달되어
                 * Hider 첫 클릭이 사격/페인트로 처리되지 않게 막습니다.
                 */
                event.stopPropagation();

                this.audioUnlocked = true;
                this.bgmEnabled = !this.bgmEnabled;

                localStorage.setItem(
                    'chameleon-hunt-bgm-enabled',
                    String(this.bgmEnabled),
                );

                this.bgmToggleButton.setText(
                    this.bgmEnabled
                        ? tr('♫ BGM ON')
                        : tr('♫ BGM OFF'),
                );

                this.syncPhaseMusic();
            },
        );
    }

    private stopAllBgm(): void {
        [
            this.backgroundMusic,
            this.lobbyMusic,
            this.huntMusic,
            this.paintMusic,
        ].forEach((music) => {
            if (music?.isPlaying) {
                music.stop();
            }
        });
    }

    private saveLobbyBgmResumePosition(): void {
        if (!this.lobbyMusic || !this.lobbyMusic.isPlaying) {
            return;
        }

        const seek = Number(
            (this.lobbyMusic as Phaser.Sound.WebAudioSound).seek ?? 0,
        );

        if (Number.isFinite(seek) && seek >= 0) {
            sessionStorage.setItem(
                this.lobbyBgmResumeKey,
                String(seek),
            );
        }
    }

    private restoreLobbyBgmPositionIfNeeded(): void {
        if (
            this.lobbyBgmResumeApplied ||
            !this.audioUnlocked ||
            !this.lobbyMusic ||
            !this.lobbyMusic.isPlaying
        ) {
            return;
        }

        const raw = sessionStorage.getItem(
            this.lobbyBgmResumeKey,
        );

        if (!raw) {
            this.lobbyBgmResumeApplied = true;
            return;
        }

        const seek = Number(raw);

        if (Number.isFinite(seek) && seek > 0) {
            try {
                (this.lobbyMusic as Phaser.Sound.WebAudioSound).seek = seek;
            } catch {
                // Audio backend differences must not block room entry.
            }
        }

        sessionStorage.removeItem(this.lobbyBgmResumeKey);
        this.lobbyBgmResumeApplied = true;
    }

    private syncPhaseMusic(): void {
        if (
            !this.audioUnlocked ||
            !this.bgmEnabled
        ) {
            this.stopAllBgm();
            return;
        }

        /*
         * Lobby -> Countdown -> Paint 까지는 같은 잔잔한 BGM을 계속 사용합니다.
         * phase가 바뀌어도 이미 재생 중인 곡이면 stop/play를 하지 않기 때문에
         * 처음부터 다시 시작하지 않고 자연스럽게 이어집니다.
         */
        const desiredMusic =
            this.phase === 'hunt'
                ? this.huntMusic
                : this.phase === 'paint'
                    ? this.paintMusic
                    : (
                        this.phase === 'lobby' ||
                        this.phase === 'countdown'
                    )
                        ? this.lobbyMusic
                        : undefined;

        if (!desiredMusic) {
            this.stopAllBgm();
            return;
        }

        if (desiredMusic.isPlaying) {
            if (desiredMusic === this.lobbyMusic) {
                this.restoreLobbyBgmPositionIfNeeded();
            }
            return;
        }

        [
            this.backgroundMusic,
            this.lobbyMusic,
            this.huntMusic,
            this.paintMusic,
        ].forEach((music) => {
            if (
                music &&
                music !== desiredMusic &&
                music.isPlaying
            ) {
                music.stop();
            }
        });

        desiredMusic.play();

        if (desiredMusic === this.lobbyMusic) {
            this.restoreLobbyBgmPositionIfNeeded();
        }
    }

    private playPaintSound(): void {
        if (
            !this.audioUnlocked ||
            !this.paintSound ||
            this.paintSound.isPlaying ||
            this.time.now - this.lastPaintSoundAt < 210
        ) {
            return;
        }

        this.lastPaintSoundAt = this.time.now;
        this.paintSound.play();
    }

    private playHeartbeatSound(
        intensity: number,
    ): void {
        if (
            !this.audioUnlocked ||
            !this.heartbeatSound
        ) {
            return;
        }

        /*
         * Hunter가 가까울수록 심장 소리가 조금 더 크고 선명하게 들립니다.
         */
        (this.heartbeatSound as unknown as { setVolume: (value: number) => void }).setVolume(Phaser.Math.Linear(
                0.20,
                0.58,
                intensity,
            ));

        this.heartbeatSound.play();
    }

    private createHunterBlindUi(): void {
        this.hunterBlindPanel = this.add
            .rectangle(
                this.gameWidth / 2,
                this.gameHeight / 2,
                this.gameWidth,
                this.gameHeight,
                0x20262b,
                1,
            )
            .setDepth(800)
            .setVisible(false);

        this.hunterBlindText = this.add
            .text(
                this.gameWidth / 2,
                72,
                [
                    tr('HIDERS ARE PAINTING...'),
                    tr('Hunter도 자신의 위장색을 칠해보세요.'),
                ].join('\n'),
                {
                    fontFamily: 'monospace',
                    fontSize: '27px',
                    fontStyle: 'bold',
                    color: '#f3f4f6',
                    backgroundColor: '#343b42',
                    padding: {
                        x: 18,
                        y: 12,
                    },
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

        this.straightLinePreview
            ?.setDepth(
                visible ? 975 : 205,
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

        this.survivalHudGraphics
            ?.setVisible(false);
        this.survivalHudText
            ?.setVisible(false);
        this.syncPhaseMusic();
        this.syncMapBackground();
        this.hidePoints = 0;
        this.nextHeartbeatAt = 0;
        this.hideHuntTensionUi();

        /*
         * Lobby에는 타이머 문자열이 없으므로 backgroundColor만 남은
         * 빈 흰 박스를 표시하지 않습니다.
         */
        this.timerText
            .setText('')
            .setVisible(false);

        if (multiplayerClient.isConnected()) {
            this.networkPlayerManager
                .setNamesVisible(true);
        }


        this.networkPlayerManager
            ?.restoreAllPlayerVisibility();

        this.networkPlayerManager
            ?.syncLobbyPositionsFromState();

        this.time.delayedCall(
            0,
            () => {
                if (
                    this.phase === 'lobby'
                ) {
                    this.networkPlayerManager
                        ?.syncLobbyPositionsFromState();
                }
            },
        );

        this.time.delayedCall(
            120,
            () => {
                if (
                    this.phase === 'lobby'
                ) {
                    this.networkPlayerManager
                        ?.syncLobbyPositionsFromState();
                }
            },
        );

        this.resetPaintWorldZoom();
        this.clearStatus();
        this.setHunterPaintBlind(false);
        this.phaseEndTime = 0;

        /*
         * Lobby 상단 COLOR HUNT · LOBBY 배너는 사용하지 않습니다.
         */
        this.phaseText
            .setText('')
            .setVisible(false);

        this.timerText
            .setText('')
            .setColor('#26352b')
            .setVisible(false);

        this.guideText
            .setText('')
            .setVisible(false);

        this.paintPreview.setVisible(false);
        this.setPaintPaletteVisible(false);
        this.setHunterCamoPaletteVisible(false);
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
        this.hunterWeaponHudContainer?.setVisible(false);
        this.targetText.setVisible(false);

        this.aimLine.clear();
        this.crosshair.clear();

        this.hideLegacySinglePlayerActors();
        this.input.setDefaultCursor('default');

        this.multiplayerText
            .setText('')
            .setVisible(false);

        this.updateLobbyUi();

        if (
            multiplayerClient.isConnected()
        ) {
            multiplayerClient
                .requestAvatarPresets();

            this.time.delayedCall(
                80,
                () => {
                    if (
                        this.phase ===
                            'lobby'
                    ) {
                        this.sendLobbyAvatarPreset();
                    }
                },
            );
        }
    }

    private getGameplayFixedUiObjects(): Phaser.GameObjects.GameObject[] {
        return [
            this.phaseText,
            this.timerText,
            this.guideText,
            this.statusText,
            this.ammoText,
            this.hunterWeaponHudContainer,
            this.targetText,
            this.paintColorText,
            this.brushSizeText,
            this.paintZoomText,
            this.paintControlHelpText,
            this.multiplayerText,
            this.survivalHudGraphics,
            this.survivalHudText,
            this.bgmToggleButton,
            this.hunterBlindPanel,
            this.hunterBlindText,
            this.countdownPanel,
            this.countdownText,
            ...this.hiderVisionOverlays,
            ...this.heartbeatBorders,
            this.heartbeatText,
            this.hidePointText,
            this.hunterMinimapPanel,
            this.hunterMinimapText,
            this.hunterMinimapMarker,
            ...this.paletteObjects,
            ...this.hunterCamoPaletteObjects,
            this.mobileMoveBase,
            this.mobileMoveKnob,
            this.mobileMoveLabel,
            this.mobileAimBase,
            this.mobileAimKnob,
            this.mobileAimLabel,
            this.mobileFireButton,
            this.mobileFireLabel,
        ].filter(
            (object): object is Phaser.GameObjects.GameObject =>
                Boolean(object),
        );
    }

    private captureFixedHudBaseTransforms(): void {
        this.fixedHudBaseTransforms.clear();

        this.getGameplayFixedUiObjects()
            .forEach((object) => {
                const transform =
                    object as unknown as {
                        x: number;
                        y: number;
                        scaleX: number;
                        scaleY: number;
                        setScrollFactor:
                            (
                                x: number,
                                y?: number,
                            ) => unknown;
                    };

                this.fixedHudBaseTransforms.set(
                    object,
                    {
                        x: transform.x,
                        y: transform.y,
                        scaleX:
                            transform.scaleX,
                        scaleY:
                            transform.scaleY,
                    },
                );

                transform.setScrollFactor(
                    0,
                );
            });
    }

    private refreshPaintHudBaseTransforms(): void {
        /*
         * Paint UI는 카메라 zoom과 독립적인 screen-space HUD로 취급합니다.
         * 팔레트 생성 후 현재의 원래 좌표/크기를 base transform으로 다시 저장합니다.
         */
        [
            ...this.paletteObjects,
            ...this.hunterCamoPaletteObjects,
            this.paintZoomText,
            this.paintControlHelpText,
            this.bgmToggleButton,
        ]
            .filter(
                (object): object is Phaser.GameObjects.GameObject =>
                    Boolean(object),
            )
            .forEach(
                (object) => {
                    const transform =
                        object as unknown as {
                            x: number;
                            y: number;
                            scaleX: number;
                            scaleY: number;
                            setScrollFactor:
                                (
                                    x: number,
                                    y?: number,
                                ) => unknown;
                        };

                    /*
                     * 이미 zoom compensation이 적용된 상태에서 다시 capture하면
                     * base가 오염될 수 있으므로 기존 base가 있으면 유지합니다.
                     */
                    if (
                        !this.fixedHudBaseTransforms
                            .has(object)
                    ) {
                        this.fixedHudBaseTransforms
                            .set(
                                object,
                                {
                                    x: transform.x,
                                    y: transform.y,
                                    scaleX:
                                        transform.scaleX,
                                    scaleY:
                                        transform.scaleY,
                                },
                            );
                    }

                    transform.setScrollFactor(
                        0,
                    );
                },
            );
    }

    private applyFixedHudForZoom(
        zoom: number,
    ): void {
        const safeZoom =
            Math.max(
                0.01,
                zoom,
            );

        const centerX =
            this.gameWidth / 2;

        const centerY =
            this.gameHeight / 2;

        this.fixedHudBaseTransforms.forEach(
            (
                base,
                object,
            ) => {
                const transform =
                    object as unknown as {
                        setScrollFactor:
                            (
                                x: number,
                                y?: number,
                            ) => unknown;
                        setPosition:
                            (
                                x: number,
                                y: number,
                            ) => unknown;
                        setScale:
                            (
                                x: number,
                                y?: number,
                            ) => unknown;
                    };

                /*
                 * Camera zoom은 화면 중심을 기준으로 확대됩니다.
                 * 단순히 x/zoom으로 계산하면 HUD가 좌상단 쪽으로 움직입니다.
                 *
                 * center + (base - center) / zoom
                 * 으로 역변환하면 최종 화면 픽셀 위치가 항상 동일합니다.
                 */
                const compensatedX =
                    centerX +
                    (
                        base.x -
                        centerX
                    ) /
                    safeZoom;

                const compensatedY =
                    centerY +
                    (
                        base.y -
                        centerY
                    ) /
                    safeZoom;

                transform
                    .setScrollFactor(
                        0,
                    );

                transform.setPosition(
                    compensatedX,
                    compensatedY,
                );

                transform.setScale(
                    base.scaleX /
                        safeZoom,
                    base.scaleY /
                        safeZoom,
                );
            },
        );

    }

    private restoreFixedHud(): void {
        this.fixedHudBaseTransforms.forEach(
            (
                base,
                object,
            ) => {
                const transform =
                    object as unknown as {
                        setScrollFactor:
                            (
                                x: number,
                                y?: number,
                            ) => unknown;
                        setPosition:
                            (
                                x: number,
                                y: number,
                            ) => unknown;
                        setScale:
                            (
                                x: number,
                                y?: number,
                            ) => unknown;
                    };

                transform
                    .setScrollFactor(
                        0,
                    );

                transform.setPosition(
                    base.x,
                    base.y,
                );

                transform.setScale(
                    base.scaleX,
                    base.scaleY,
                );
            },
        );
    }

    private startGameplayCamera(): void {
        if (!this.isMultiplayerSession()) {
            return;
        }

        const target =
            this.getActiveHuntViewTarget();

        if (!target) {
            return;
        }

        this.resetGameplayCamera();

        this.cameras.main
            .setZoom(
                this.gameplayCameraZoom,
            );

        this.applyFixedHudForZoom(
            this.gameplayCameraZoom,
        );
        this.ensureGameplayCameraFollow();
    }

    private formatSpectatorStatus(
        role: 'hunter' | 'hider',
        name: string,
    ): string {
        const safeName =
            name.length > 14
                ? `${name.slice(0, 13)}…`
                : name;

        return `${
            role === 'hunter'
                ? 'HUNTER'
                : 'HIDER'
        } · ${safeName}`;
    }

    private cycleSpectatorView(): void {
        if (
            this.phase !== 'hunt' ||
            !this.isMultiplayerSession() ||
            !this.networkPlayerManager
                .isLocalHider()
        ) {
            return;
        }

        const localSessionId =
            multiplayerClient
                .getSessionId();

        const players =
            this.networkPlayerManager
                .getSpectatablePlayers();

        const ordered =
            players.filter(
                (player) =>
                    player.sessionId !==
                    localSessionId,
            );

        /*
         * Final slot is always SELF so TAB can return to normal play.
         */
        const cycle = [
            ...ordered.map(
                (player) =>
                    player.sessionId,
            ),
            '',
        ];

        if (cycle.length === 0) {
            this.spectatorSessionId = '';
            return;
        }

        this.spectatorCycleIndex =
            (
                this.spectatorCycleIndex +
                1
            ) %
            cycle.length;

        this.spectatorSessionId =
            cycle[
                this.spectatorCycleIndex
            ];

        if (!this.spectatorSessionId) {
            this.spectatorStatusText
                ?.setText(
                    tr('시야: 내 캐릭터'),
                )
                .setVisible(true);
            return;
        }

        const selected =
            players.find(
                (player) =>
                    player.sessionId ===
                    this.spectatorSessionId,
            );

        this.spectatorStatusText
            ?.setText(
                selected
                    ? this.formatSpectatorStatus(
                        selected.role,
                        selected.name,
                    )
                    : tr('시야: 내 캐릭터'),
            )
            .setVisible(true);
    }

    private getActiveHuntViewTarget():
        Phaser.GameObjects.Container | null {
        if (this.spectatorSessionId) {
            const spectated =
                this.networkPlayerManager
                    .getPlayerContainer(
                        this.spectatorSessionId,
                    );

            if (spectated) {
                return spectated;
            }

            this.spectatorSessionId = '';
        }

        return this.networkPlayerManager
            .getLocalPlayerContainer();
    }

    private ensureGameplayCameraFollow(): void {
        if (
            this.phase !== 'hunt' ||
            !this.isMultiplayerSession()
        ) {
            return;
        }

        const target =
            this.getActiveHuntViewTarget();

        if (!target) {
            return;
        }

        const camera =
            this.cameras.main;

        if (
            Math.abs(
                camera.zoom -
                    this.gameplayCameraZoom
            ) > 0.001
        ) {
            this.applyFixedHudForZoom(
                this.gameplayCameraZoom,
            );

            camera.setZoom(
                this.gameplayCameraZoom,
            );
        }

        /*
         * Hunter/Hider 모두 Hunt 중에는 캐릭터를 화면 정중앙에 유지합니다.
         * 맵 가장자리에서도 clamp하지 않습니다.
         */
        camera
            .stopFollow()
            .removeBounds()
            .centerOn(
                target.x,
                target.y,
            );
    }

    private resetGameplayCamera(): void {
        const camera = this.cameras.main;

        camera
            .stopFollow()
            .setZoom(1)
            .setScroll(0, 0)
            .removeBounds();

        this.restoreFixedHud();

        this.gameplayUiSnapshots.clear();
    }

    private clearAllAimingVisuals(): void {
        this.aimLine.clear();
        this.crosshair.clear();

        this.aimLine.setVisible(false);
        this.crosshair.setVisible(false);

        this.networkPlayerManager
            .clearHunterAimLines();
    }

    private handleNetworkRoundResult(
        result: NetworkRoundResult,
    ): void {
        /*
         * CRITICAL SAFETY:
         * A transient/stale Hunter-win packet must never end a live round
         * while authoritative room state still contains an alive Hider.
         *
         * Server player.alive values are the same authority used for Hunt
         * gameplay, so reject the impossible result and wait for a coherent
         * state/result pair.
         */
        if (
            result.winner === 'hunters' &&
            this.phase === 'hunt' &&
            this.getAuthoritativeAliveHiderCount() > 0
        ) {
            console.warn(
                '[Color Hunt] Ignored premature Hunter victory while Hiders are still alive',
                {
                    aliveHiders:
                        this.getAuthoritativeAliveHiderCount(),
                    result,
                },
            );

            return;
        }

        this.roundResultWinner = result.winner;

        this.survivalHudGraphics
            ?.setVisible(false);
        this.survivalHudText
            ?.setVisible(false);

        this.clearAllAimingVisuals();
        this.resetGameplayCamera();
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

            this.phaseText
                .setText('')
                .setVisible(false);

            const hiderWinText =
                result.reason ===
                    'ammo_depleted'
                    ? tr('HIDER 승리! 헌터의 탄약이 모두 소진되어 패배했습니다.')
                    : tr('HIDER 승리! 은신 위치를 공개합니다.');

            this.roundResultMessage =
                hiderWinText;

            this.guideText
                .setPosition(
                    this.gameWidth / 2,
                    112,
                )
                .setOrigin(0.5, 0)
                .setDepth(5200)
                .setFontSize(20)
                .setBackgroundColor(
                    'rgba(255, 244, 214, 0.96)',
                )
                .setPadding(
                    16,
                    9,
                    16,
                    9,
                )
                .setText(
                    hiderWinText,
                )
                .setColor('#1f2937');
        } else {
            this.networkPlayerManager
                .clearRevealMarkers();

            this.phaseText
                .setText('')
                .setVisible(false);

            this.roundResultMessage =
                tr('HUNTER 승리!');

            this.guideText
                .setPosition(
                    this.gameWidth / 2,
                    112,
                )
                .setOrigin(0.5, 0)
                .setDepth(5200)
                .setFontSize(20)
                .setBackgroundColor(
                    'rgba(255, 244, 214, 0.96)',
                )
                .setPadding(
                    16,
                    9,
                    16,
                    9,
                )
                .setText(
                    this.roundResultMessage,
                )
                .setColor('#d32f2f');
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
            this.spectatorSessionId = '';
            this.spectatorCycleIndex = -1;

            this.roundResultWinner = null;
            this.roundResultMessage = '';

            this.guideText
                .setPosition(
                    18,
                    192,
                )
                .setOrigin(0, 0)
                .setDepth(300)
                .setFontSize(15)
                .setBackgroundColor(
                    'rgba(255, 244, 214, 0.86)',
                )
                .setPadding(
                    12,
                    7,
                    12,
                    7,
                );

            this.resetGameplayCamera();
            this.enterLobbyPhase();
            return;
        }

        if (phase === 'countdown') {
            this.clearStatus();

            /*
             * Lobby avatar art is cosmetic only. Clear it before the actual
             * round so every player begins Paint with the normal white base.
             */
            this.networkPlayerManager
                .clearAllPaint();

            this.networkPlayerManager
                .syncLobbyPositionsFromState();

            this.phaseText
                .setText('')
                .setVisible(false);
            this.setHunterPaintBlind(false);
            this.phase = 'countdown';
            this.lastCountdownSoundValue = -1;
            this.syncPhaseMusic();
            this.phaseEndTime =
                this.time.now +
                remainingMs;

            this.updateLobbyUi();
            this.updateSurvivalHud();
            return;
        }

        if (phase === 'paint') {
            this.spectatorSessionId = '';
            this.spectatorCycleIndex = -1;

            this.clearStatus();

            this.phaseText
                .setText('')
                .setVisible(false);

            this.networkPlayerManager
                .syncLobbyPositionsFromState();

            this.enterPaintPhase();
            this.networkPlayerManager
                .setNamesVisible(false);

            const localIsHunter =
                this.networkPlayerManager
                    .isLocalHunter();

            this.setHunterPaintBlind(
                localIsHunter,
            );

            /*
             * Both roles refresh map colors, but only HIDER receives them in
             * the normal left palette. HUNTER keeps the standard palette.
             * The old separate CAMO SWATCH panel is no longer shown.
             */
            this.refreshHunterCamoPalette();

            this.applyRolePaintPalette(
                localIsHunter,
            );

            this.setHunterCamoPaletteVisible(
                false,
            );

            this.updatePaintControlHelp();

            /*
             * Hunter customization은 캐릭터를 enterPaintPhase() 이후에
             * 월드 중앙으로 이동시킵니다.
             * 따라서 이동된 위치를 기준으로 카메라를 즉시 다시 맞춥니다.
             * 이전에는 휠을 돌릴 때만 이 보정이 일어나 캐릭터가 안 보였습니다.
             */
            if (localIsHunter) {
                /*
                 * Hunter 캐릭터 자체는 customization mode에서 3배 확대되므로
                 * camera까지 gameplay zoom을 쓰면 지나치게 확대됩니다.
                 * Hunter Paint 기본 camera는 1.05로 낮춰
                 * 캐릭터 전체 + 상단 안내 문구 + 팔레트가 동시에 보이게 합니다.
                 */
                this.paintWorldZoom =
                    1.05;

                this.refreshPaintHudBaseTransforms();

                this.cameras.main
                    .stopFollow()
                    .removeBounds()
                    .setZoom(
                        this.paintWorldZoom,
                    );

                this.applyFixedHudForZoom(
                    this.paintWorldZoom,
                );

                this.centerPaintCameraOnLocalPlayer();

                this.time.delayedCall(
                    0,
                    () => {
                        if (
                            this.phase ===
                            'paint' &&
                            this.networkPlayerManager
                                .isLocalCustomizationMode()
                        ) {
                            this.cameras.main
                                .setZoom(
                                    this.paintWorldZoom,
                                );

                            this.applyFixedHudForZoom(
                                this.paintWorldZoom,
                            );

                            this.centerPaintCameraOnLocalPlayer();
                        }
                    },
                );
            }

            this.phaseEndTime =
                this.time.now +
                remainingMs;

            this.updateSurvivalHud();
            return;
        }

        if (phase === 'hunt') {
            /*
             * HOTFIX: Hunt can begin before the painter's final pointer-up.
             * Finish the last stroke first, then rebroadcast the Hider's
             * complete authoritative paint history. Hunter clients therefore
             * enter Hunt with the exact final camouflage the Hider sees.
             */
            this.finishActivePaintStroke();
            this.isPainting = false;

            if (
                this.networkPlayerManager
                    .isLocalHider() &&
                this.localPaintHistory.length > 0
            ) {
                this.rebuildLocalPaintFromHistory();
            }

            this.clearStatus();


            this.phaseText
                .setText('')
                .setVisible(false);

            this.networkPlayerManager
                .syncLobbyPositionsFromState();

            this.networkPlayerManager
                .normalizeLocalPlayerForGameplay();

            /*
             * Paint -> Hunt 전환 프레임에서 이전 걷기 pose/sub-pixel 좌표가
             * 남아 있으면 픽셀 위장이 몸체와 어긋나 보입니다.
             * 모든 Hider를 즉시 neutral pose + 동일 픽셀 기준으로 고정합니다.
             */
            this.networkPlayerManager
                .stabilizeHidersForHunt();

            this.resetPaintWorldZoom();

            this.networkPlayerManager
                .restoreAllPlayerVisibility();

            this.setHunterPaintBlind(false);
            this.setPaintPaletteVisible(false);
            this.setHunterCamoPaletteVisible(false);
            this.paintPreview.setVisible(false);

            this.networkPlayerManager
                .setNamesVisible(false);

            this.networkPlayerManager
                .setHunterGunsVisible();

            this.startHunt();
            this.startGameplayCamera();

            this.phaseEndTime =
                this.time.now +
                remainingMs;

            /*
             * Camera zoom compensation has already been applied above.
             * Survival HUD is part of fixed UI now, so refresh visibility
             * after the Hunt camera starts.
             */
            this.updateSurvivalHud();

            return;
        }

        if (phase === 'finished') {
            const authoritativeWinner =
                multiplayerClient.getRoom()
                    ?.state.winner;

            /*
             * Same safety for phase transition. If winner says Hunters but
             * authoritative players still contain a living Hider, this
             * finished transition is internally inconsistent and must not
             * terminate the client's round.
             */
            if (
                authoritativeWinner === 'hunters' &&
                this.getAuthoritativeAliveHiderCount() > 0
            ) {
                console.warn(
                    '[Color Hunt] Ignored inconsistent finished phase: alive Hiders remain',
                    {
                        aliveHiders:
                            this.getAuthoritativeAliveHiderCount(),
                    },
                );

                this.phase = 'hunt';
                this.updateSurvivalHud();
                return;
            }

            if (
                authoritativeWinner === 'hunters' ||
                authoritativeWinner === 'hiders'
            ) {
                this.roundResultWinner =
                    authoritativeWinner;
            }

            this.resetGameplayCamera();
            this.clearStatus();
            this.clearAllAimingVisuals();
            this.setHunterPaintBlind(false);
            this.setHunterCamoPaletteVisible(false);
            this.hideLegacySinglePlayerActors();

            if (
                this.phase !== 'finished' &&
                this.audioUnlocked
            ) {
                this.victorySound?.play();
            }

            this.phase = 'finished';
            this.syncPhaseMusic();

            this.phaseText
                .setText('')
                .setVisible(false);

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

            /*
             * round_result가 먼저 도착하면 그 구체적인 승리/패배 사유를
             * finished phase가 덮어쓰지 않습니다.
             * ammo_depleted 문구는 결과 화면이 끝날 때까지 계속 유지됩니다.
             */
            this.guideText
                .setPosition(
                    this.gameWidth / 2,
                    112,
                )
                .setOrigin(0.5, 0)
                .setDepth(5200)
                .setFontSize(20)
                .setBackgroundColor(
                    'rgba(255, 244, 214, 0.96)',
                )
                .setPadding(
                    16,
                    9,
                    16,
                    9,
                )
                .setText(
                    this.roundResultMessage ||
                        (
                            this.roundResultWinner ===
                                'hunters'
                                ? tr('HUNTER 승리!')
                                : tr('HIDER 승리!')
                        ),
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
            '';

        this.multiplayerText
            .setText(
                [
                    `ROOM ${roomId ?? '-'}`,
                    tr(`PLAYERS ${this.networkPlayerCount} / 10`),
                    tr(`ROLE ${role}`),
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
        this.currentBackgroundTextureKey =
            'forest-background';
        /*
         * setDisplaySize()가 적용한 실제 이미지 기본 scale을 저장합니다.
         * 첫 휠 입력에서 scale을 1.25로 덮어쓰면 원본 이미지 크기에 따라
         * 화면이 튀므로 반드시 기본 scale × Paint zoom을 사용합니다.
         */
    }

    /*
     * Obstacles
     */

    private createObstacles(): void {
        /*
         * Random obstacle system removed in v0.10.10.4.
         * No gameplay obstacles are created.
         */
        this.obstacles = [];
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
            .text(x, y - 49, tr('HUNTER'), {
                fontFamily: 'Arial',
                fontSize: '13px',
                fontStyle: 'bold',
                color: '#315f94',
                backgroundColor: 'rgba(255, 244, 214, 0.86)',
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
            .text(x, y - 43, tr(`HIDER ${index + 1}`), {
                fontFamily: 'Arial',
                fontSize: '14px',
                fontStyle: 'bold',
                color: '#5b4636',
                backgroundColor: 'rgba(255, 244, 214, 0.86)',
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
            tr(`HIDER ${index + 1} 선택`),
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

    private centerPaintCameraOnLocalPlayer(): void {
        if (
            this.phase !== 'paint' ||
            !this.isMultiplayerSession()
        ) {
            return;
        }

        const target =
            this.networkPlayerManager
                .getLocalPlayerContainer();

        if (!target) {
            return;
        }

        /*
         * Paint 중에도 캐릭터를 화면 정중앙에 둡니다.
         * 맵 경계 clamp를 쓰지 않아 가장자리에서도 중심이 흔들리지 않습니다.
         */
        this.cameras.main
            .stopFollow()
            .removeBounds()
            .centerOn(
                target.x,
                target.y,
            );
    }

    private adjustPaintWorldZoom(
        wheelDeltaY: number,
    ): number {
        this.brushSizeSliderDragging =
            false;

        if (this.phase !== 'paint') {
            return this.paintWorldZoom;
        }

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

        const nextZoom =
            Phaser.Math.Clamp(
                this.paintWorldZoom +
                    direction * 0.25,
                1,
                5,
            );

        this.paintWorldZoom =
            nextZoom;
        const camera =
            this.cameras.main;

        /*
         * 월드 좌표는 그대로 두고 카메라만 확대합니다.
         * HUD는 최초 저장 좌표를 기준으로 역스케일하여 화면에 고정합니다.
         */
        this.applyFixedHudForZoom(
            nextZoom,
        );

        camera
            .stopFollow()
            .removeBounds()
            .setZoom(
                nextZoom,
            );

        this.centerPaintCameraOnLocalPlayer();

        return nextZoom;
    }

    private resetPaintWorldZoom(): void {
        this.paintWorldZoom = 1;
        this.mobilePinchDistance = 0;
        this.mobilePinchActive = false;
        this.mobileTouchPoints.clear();
        const camera =
            this.cameras.main;

        camera
            .stopFollow()
            .setZoom(1)
            .setScroll(0, 0)
            .removeBounds();

        this.restoreFixedHud();

        this.networkPlayerManager
            ?.resetLocalPaintZoom();
    }

    private createPaintPalette(): void {
        const colors = [
            ...this.standardPaintColors,
        ];

        const panel = this.add
            .rectangle(
                345,
                this.gameHeight - 64,
                670,
                110,
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
                tr('COLOR PALETTE'),
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
                        index / 8,
                    );

                const swatch =
                    this.add.rectangle(
                        35 +
                            column * 32,
                        this.gameHeight -
                            58 +
                            row * 29,
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
                    (
                        pointer:
                            Phaser.Input.Pointer,
                    ) => {
                        pointer.event
                            ?.stopPropagation?.();

                        /*
                         * Role palettes can recolor this same swatch after it
                         * was created. Always read the CURRENT data value.
                         * The old closure captured the original color and made
                         * Hider swatch visuals disagree with actual paint.
                         */
                        const currentColor =
                            swatch.getData(
                                'paletteColor',
                            );

                        if (
                            typeof currentColor !==
                            'number'
                        ) {
                            return;
                        }

                        this.paintColor =
                            currentColor;

                        this.createBrushTexture(
                            true,
                        );
                        this.updatePaintHud();
                        this.updatePaintPreviewImmediately();
                        this.highlightPaletteColor(
                            currentColor,
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

        const brushShapeTitle =
            this.add.text(
                395,
                this.gameHeight - 104,
                tr('브러시 모양'),
                {
                    fontFamily:
                        'monospace',
                    fontSize: '11px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                },
            )
                .setOrigin(0.5)
                .setDepth(872)
                .setVisible(false);

        this.paletteObjects.push(
            brushShapeTitle,
        );

        const brushShapeOptions: Array<{
            shape: BrushShape;
            label: string;
        }> = [
            {
                shape: 'circle',
                label: `● ${tr('원형')}`,
            },
            {
                shape: 'square',
                label: `■ ${tr('사각형')}`,
            },
        ];

        brushShapeOptions.forEach(
            (
                option,
                index,
            ) => {
                const button =
                    this.add
                        .text(
                            315 +
                                index * 80,
                            this.gameHeight -
                                78,
                            option.label,
                            {
                                fontFamily:
                                    'monospace',
                                fontSize: '11px',
                                fontStyle: 'bold',
                                color: '#26352b',
                                backgroundColor:
                                    '#e8efd8',
                                padding: {
                                    x: 7,
                                    y: 4,
                                },
                            },
                        )
                        .setOrigin(0.5)
                        .setFixedSize(72, 28)
                        .setAlign('center')
                        .setDepth(873)
                        .setVisible(false)
                        .setInteractive({
                            useHandCursor: true,
                        });

                button.setData(
                    'brushShape',
                    option.shape,
                );

                button.on(
                    'pointerdown',
                    () => {
                        this.eyedropperArmed =
                            false;
                        this.hideEyedropperMagnifier();
                        this.brushShape =
                            option.shape;

                        this.createBrushTexture();
                        this.updatePaintHud();
                        this.updatePaintPreviewImmediately();
                        this.updatePaintControlHelp();
                        this.highlightBrushShape(
                            option.shape,
                        );
                        this.updateEyedropperButtonUi();
                    },
                );

                this.paletteObjects.push(
                    button,
                );
            },
        );

        /*
         * Pixel brush is no longer exposed in the palette.  Its old third
         * slot is now a touch-friendly eyedropper button.
         */
        this.eyedropperButton =
            this.add.text(
                475,
                this.gameHeight - 78,
                `◉ ${tr('스포이드')}`,
                {
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    fontStyle: 'bold',
                    color: '#26352b',
                    backgroundColor: '#e8efd8',
                    padding: {
                        x: 5,
                        y: 4,
                    },
                },
            )
                .setOrigin(0.5)
                .setFixedSize(72, 28)
                .setAlign('center')
                .setDepth(873)
                .setVisible(false)
                .setInteractive({
                    useHandCursor: true,
                });

        this.eyedropperButton.on(
            'pointerdown',
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                pointer.event
                    ?.preventDefault?.();
                pointer.event
                    ?.stopPropagation?.();

                this.finishActivePaintStroke();
                this.isPainting = false;
                this.eyedropperPointerId = -1;

                const localIsHunter =
                    this.isMultiplayerSession() &&
                    this.networkPlayerManager
                        .canLocalControlHunter();

                if (localIsHunter) {
                    this.eyedropperArmed =
                        false;
                    this.hideEyedropperMagnifier();
                    this.showStatus(
                        tr('헌터는 스포이드를 사용할 수 없습니다.'),
                    );
                    this.updateEyedropperButtonUi();
                    return;
                }

                /*
                 * Arm on pointer DOWN. Mobile browsers can lose the object's
                 * pointerup after touch movement, which previously left this
                 * button apparently dead.
                 *
                 * Scene-level pointerdown sees this as UI and returns, so
                 * arming here cannot accidentally sample the button itself.
                 */
                this.eyedropperArmed =
                    !this.eyedropperArmed;

                this.updateEyedropperButtonUi();
                this.hideEyedropperMagnifier();

                if (this.eyedropperArmed) {
                    this.showStatus(
                        this.mobileControlsEnabled
                            ? tr('스포이드: 배경을 누른 채 움직이고 손을 떼면 색상이 선택됩니다')
                            : tr('스포이드: 배경에서 원하는 색을 클릭하세요'),
                    );
                }
            },
        );

        this.paletteObjects.push(
            this.eyedropperButton,
        );

        this.undoPaintButton =
            this.add.text(
                555,
                this.gameHeight - 78,
                `↶ ${tr('되돌리기')}`,
                {
                    fontFamily:
                        'monospace',
                    fontSize: '9px',
                    fontStyle: 'bold',
                    color: '#26352b',
                    backgroundColor:
                        '#f2e6c8',
                    fixedWidth: 76,
                    fixedHeight: 28,
                    align: 'center',
                    padding: {
                        top: 7,
                    },
                },
            )
                .setOrigin(0.5)
                .setDepth(873)
                .setVisible(false)
                .setInteractive({
                    useHandCursor: true,
                });

        this.undoPaintButton.on(
            'pointerdown',
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                pointer.event
                    ?.preventDefault?.();
                pointer.event
                    ?.stopPropagation?.();

                this.isPainting = false;
                this.finishActivePaintStroke();
                this.clearStraightLinePreview();

                this.undoLastPaintStroke();
            },
        );

        this.undoPaintButton.on(
            'pointerup',
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                pointer.event
                    ?.preventDefault?.();
                pointer.event
                    ?.stopPropagation?.();

                this.isPainting = false;
            },
        );

        this.paletteObjects.push(
            this.undoPaintButton,
        );

        this.redoPaintButton =
            this.add.text(
                635,
                this.gameHeight - 78,
                `↷ ${tr('다시 실행')}`,
                {
                    fontFamily:
                        'monospace',
                    fontSize: '9px',
                    fontStyle: 'bold',
                    color: '#26352b',
                    backgroundColor:
                        '#dfeeda',
                    fixedWidth: 76,
                    fixedHeight: 28,
                    align: 'center',
                    padding: {
                        top: 7,
                    },
                },
            )
                .setOrigin(0.5)
                .setDepth(873)
                .setVisible(false)
                .setInteractive({
                    useHandCursor: true,
                });

        this.redoPaintButton.on(
            'pointerdown',
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                pointer.event
                    ?.preventDefault?.();
                pointer.event
                    ?.stopPropagation?.();

                this.isPainting = false;
                this.finishActivePaintStroke();
                this.clearStraightLinePreview();

                this.redoLastPaintStroke();
            },
        );

        this.redoPaintButton.on(
            'pointerup',
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                pointer.event
                    ?.preventDefault?.();
                pointer.event
                    ?.stopPropagation?.();

                this.isPainting = false;
            },
        );

        this.paletteObjects.push(
            this.redoPaintButton,
        );

        const sliderMinX = 320;
        const sliderMaxX = 515;
        const sliderY =
            this.gameHeight - 38;

        const setBrushSizeFromSlider =
            (
                screenX: number,
            ): void => {
                const ratio =
                    Phaser.Math.Clamp(
                        (
                            screenX -
                            sliderMinX
                        ) /
                        (
                            sliderMaxX -
                            sliderMinX
                        ),
                        0,
                        1,
                    );

                this.setBrushSize(
                    1 +
                    ratio * 19,
                );
            };

        this.brushSizeSliderTrack =
            this.add.rectangle(
                (sliderMinX +
                    sliderMaxX) / 2,
                sliderY,
                sliderMaxX -
                    sliderMinX,
                6,
                0x6b7280,
                0.55,
            )
                .setScrollFactor(0)
                .setDepth(873)
                .setVisible(false)
                .setInteractive({
                    useHandCursor: true,
                });

        this.brushSizeSliderFill =
            this.add.rectangle(
                sliderMinX,
                sliderY,
                0,
                6,
                0x4f8f67,
                1,
            )
                .setOrigin(0, 0.5)
                .setScrollFactor(0)
                .setDepth(874)
                .setVisible(false);

        this.brushSizeSliderKnob =
            this.add.circle(
                sliderMinX,
                sliderY,
                7,
                0xf8fafc,
                1,
            )
                .setStrokeStyle(
                    2,
                    0x334155,
                    1,
                )
                .setScrollFactor(0)
                .setDepth(875)
                .setVisible(false)
                .setInteractive({
                    useHandCursor: true,
                });

        this.brushSizeSliderLabel =
            this.add.text(
                (sliderMinX +
                    sliderMaxX) / 2,
                sliderY - 18,
                `${this.brushSize}px`,
                {
                    fontFamily:
                        'monospace',
                    fontSize: '11px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                },
            )
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setDepth(875)
                .setVisible(false);

        const beginSliderDrag =
            (
                pointer:
                    Phaser.Input.Pointer,
            ): void => {
                pointer.event
                    ?.stopPropagation?.();

                this.brushSizeSliderDragging =
                    true;

                setBrushSizeFromSlider(
                    pointer.x,
                );
            };

        this.brushSizeSliderTrack.on(
            'pointerdown',
            beginSliderDrag,
        );

        this.brushSizeSliderKnob.on(
            'pointerdown',
            beginSliderDrag,
        );

        this.input.on(
            Phaser.Input.Events.POINTER_MOVE,
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                if (
                    !this.brushSizeSliderDragging
                ) {
                    return;
                }

                setBrushSizeFromSlider(
                    pointer.x,
                );
            },
        );

        this.input.on(
            Phaser.Input.Events.POINTER_UP,
            () => {
                this.brushSizeSliderDragging =
                    false;
            },
        );

        const sliderMinLabel =
            this.add.text(
                sliderMinX - 18,
                sliderY,
                '1px',
                {
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    color: '#5b4636',
                },
            )
                .setOrigin(1, 0.5)
                .setDepth(875)
                .setVisible(false);

        const sliderMaxLabel =
            this.add.text(
                sliderMaxX + 18,
                sliderY,
                '20px',
                {
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    color: '#5b4636',
                },
            )
                .setOrigin(0, 0.5)
                .setDepth(875)
                .setVisible(false);

        this.paletteObjects.push(
            this.brushSizeSliderTrack,
            this.brushSizeSliderFill,
            this.brushSizeSliderKnob,
            this.brushSizeSliderLabel,
            sliderMinLabel,
            sliderMaxLabel,
        );

        this.updateBrushSizeSliderUi();

        this.highlightBrushShape(
            this.brushShape,
        );

        this.paintZoomText = this.add
            .text(
                18,
                118,
                `ZOOM 1.0x\n${tr('마우스 휠')}`,
                {
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: 'rgba(255, 244, 214, 0.86)',
                    padding: {
                        x: 8,
                        y: 5,
                    },
                    align: 'center',
                },
            )
            .setOrigin(0, 0)
            .setDepth(872)
            .setVisible(false);

        this.paintControlHelpText =
            this.add
                .text(
                    this.gameWidth - 18,
                    this.gameHeight - 108,
                    '',
                    {
                        fontFamily:
                            'monospace',
                        fontSize: '13px',
                        fontStyle: 'bold',
                        color: '#26352b',
                        backgroundColor:
                            '#fff4d6',
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

    private updateEyedropperButtonUi(): void {
        if (!this.eyedropperButton) {
            return;
        }

        this.eyedropperButton
            .setBackgroundColor(
                this.eyedropperArmed
                    ? '#5c8f66'
                    : '#e8efd8',
            )
            .setColor(
                this.eyedropperArmed
                    ? '#fffdf3'
                    : '#26352b',
            );
    }

    private createHunterCamoPalette(): void {
        /*
         * 기본 Hunter Paint 배율(1.05)에서도 오른쪽이 잘리지 않도록
         * 화면 가장자리에서 충분히 안쪽으로 배치합니다.
         */
        const panelX = 755;
        const panelY =
            this.gameHeight - 52;

        const panel =
            this.add.rectangle(
                panelX,
                panelY,
                390,
                86,
                0xfff4d6,
                0.95,
            )
                .setStrokeStyle(
                    2,
                    0x6f8f65,
                    1,
                )
                .setScrollFactor(0)
                .setDepth(880)
                .setVisible(false);

        const title =
            this.add.text(
                575,
                panelY - 31,
                tr('CAMO SWATCH'),
                {
                    fontFamily:
                        'monospace',
                    fontSize: '12px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                },
            )
                .setOrigin(0, 0.5)
                .setScrollFactor(0)
                .setDepth(881)
                .setVisible(false);

        const hint =
            this.add.text(
                925,
                panelY - 31,
                tr('배경 대표색'),
                {
                    fontFamily:
                        'monospace',
                    fontSize: '10px',
                    color: '#765c49',
                },
            )
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setDepth(881)
                .setVisible(false);

        this.hunterCamoPaletteObjects.push(
            panel,
            title,
            hint,
        );

        /*
         * 4 x 3 = 12개 정사각형.
         * 실제 색은 각 Paint phase 진입 시 배경에서 다시 샘플링합니다.
         */
        for (
            let index = 0;
            index < 11;
            index += 1
        ) {
            const column =
                index % 6;

            const row =
                Math.floor(
                    index / 6,
                );

            const swatch =
                this.add.rectangle(
                    590 +
                        column * 36,
                    panelY - 4 +
                        row * 29,
                    26,
                    24,
                    0x6f8f65,
                    1,
                )
                    .setStrokeStyle(
                        2,
                        0xffffff,
                        1,
                    )
                    .setScrollFactor(0)
                    .setDepth(882)
                    .setVisible(false)
                    .setInteractive({
                        useHandCursor: true,
                    });

            swatch.setData(
                'hunterCamoIndex',
                index,
            );

            swatch.on(
                'pointerdown',
                (
                    pointer:
                        Phaser.Input.Pointer,
                ) => {
                    /*
                     * 좌/우클릭 모두 색 선택으로 처리.
                     * 월드 pointer handler로 전달되지 않도록 stopPropagation.
                     */
                    pointer.event
                        ?.stopPropagation?.();

                    const color =
                        this.hunterCamoColors[
                            index
                        ];

                    if (
                        typeof color !==
                        'number'
                    ) {
                        return;
                    }

                    this.finishActivePaintStroke();
                    this.isPainting = false;
                    this.activeStrokePoints = [];
                    this.activeStrokeTargetSessionId = '';

                    this.paintColor =
                        color;

                    this.createBrushTexture(
                        true,
                    );

                    this.updatePaintHud();
                    this.updatePaintPreviewImmediately();
                    this.highlightPaletteColor(
                        color,
                    );

                    this.highlightHunterCamoColor(
                        index,
                    );
                },
            );

            this.hunterCamoPaletteObjects.push(
                swatch,
            );
        }
    }

    private applyRolePaintPalette(
        localIsHunter: boolean,
    ): void {
        const colors =
            localIsHunter
                ? [
                    ...this.standardPaintColors,
                ]
                : [
                    0x000000,
                    0xf5eee2,
                    ...this.hunterCamoColors,
                ].slice(
                    0,
                    this.standardPaintColors
                        .length,
                );

        const swatches =
            this.paletteObjects
                .filter(
                    (
                        object,
                    ): object is
                        Phaser.GameObjects.Rectangle =>
                        object instanceof
                        Phaser.GameObjects.Rectangle &&
                        typeof object.getData(
                            'paletteColor',
                        ) ===
                            'number',
                );

        swatches.forEach(
            (
                swatch,
                index,
            ) => {
                const color =
                    colors[
                        index %
                            colors.length
                    ] ??
                    this.defaultPaintColor;

                swatch
                    .setFillStyle(
                        color,
                        1,
                    )
                    .setData(
                        'paletteColor',
                        color,
                    );
            },
        );

        /*
         * If the currently selected color vanished when the role palette
         * changed, reset selection to the first available color.
         */
        if (
            !colors.includes(
                this.paintColor,
            )
        ) {
            this.paintColor =
                colors[0] ??
                this.defaultPaintColor;
            this.createBrushTexture();
        }

        this.highlightPaletteColor(
            this.paintColor,
        );
        this.updatePaintHud();
        this.updatePaintPreviewImmediately();
    }

    private refreshHunterCamoPalette(): void {
        const sourceImage =
            this.textures
                .get(
                    this.currentBackgroundTextureKey,
                )
                .getSourceImage() as
                    | HTMLImageElement
                    | HTMLCanvasElement;

        if (
            !sourceImage ||
            !sourceImage.width ||
            !sourceImage.height
        ) {
            return;
        }

        /*
         * 원본 전체를 작은 canvas로 축소한 뒤 색을 추출합니다.
         * 따라서 맵의 특정 위치를 알려주는 정보는 노출하지 않고
         * "이 맵에 실제 존재하는 색"만 제공합니다.
         */
        const canvas =
            document.createElement(
                'canvas',
            );

        canvas.width = 96;
        canvas.height = 54;

        const context =
            canvas.getContext(
                '2d',
                {
                    willReadFrequently:
                        true,
                },
            );

        if (!context) {
            return;
        }

        context.imageSmoothingEnabled =
            false;

        context.drawImage(
            sourceImage,
            0,
            0,
            canvas.width,
            canvas.height,
        );

        const pixels =
            context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            ).data;

        const candidates:
            Array<{
                color: number;
                r: number;
                g: number;
                b: number;
            }> = [];

        /*
         * 매 라운드 후보 위치를 랜덤하게 뽑습니다.
         * 지나치게 검거나 하얀 UI성 색은 제외하고,
         * RGB를 약간 양자화해서 거의 같은 색의 중복을 줄입니다.
         */
        for (
            let sample = 0;
            sample < 260;
            sample += 1
        ) {
            const x =
                Phaser.Math.Between(
                    0,
                    canvas.width - 1,
                );

            const y =
                Phaser.Math.Between(
                    0,
                    canvas.height - 1,
                );

            const offset =
                (
                    y *
                        canvas.width +
                    x
                ) * 4;

            const rawR =
                pixels[offset];

            const rawG =
                pixels[
                    offset + 1
                ];

            const rawB =
                pixels[
                    offset + 2
                ];

            const brightness =
                (
                    rawR +
                    rawG +
                    rawB
                ) / 3;

            if (
                brightness < 32 ||
                brightness > 238
            ) {
                continue;
            }

            const quantize =
                (
                    value: number,
                ): number =>
                    Phaser.Math.Clamp(
                        Math.round(
                            value / 16,
                        ) * 16,
                        0,
                        255,
                    );

            const r =
                quantize(rawR);

            const g =
                quantize(rawG);

            const b =
                quantize(rawB);

            const color =
                Phaser.Display.Color
                    .GetColor(
                        r,
                        g,
                        b,
                    );

            if (
                candidates.some(
                    (candidate) =>
                        candidate.color ===
                        color,
                )
            ) {
                continue;
            }

            candidates.push({
                color,
                r,
                g,
                b,
            });
        }

        /*
         * 너무 비슷한 색만 몰리지 않게 greedy diversity 선택.
         */
        Phaser.Utils.Array.Shuffle(
            candidates,
        );

        const selected:
            typeof candidates = [];

        for (
            const candidate of
                candidates
        ) {
            const sufficientlyDifferent =
                selected.every(
                    (picked) => {
                        const distance =
                            Math.sqrt(
                                (
                                    candidate.r -
                                    picked.r
                                ) ** 2 +
                                (
                                    candidate.g -
                                    picked.g
                                ) ** 2 +
                                (
                                    candidate.b -
                                    picked.b
                                ) ** 2,
                            );

                        return (
                            distance >=
                            38
                        );
                    },
                );

            if (
                !sufficientlyDifferent &&
                selected.length >= 4
            ) {
                continue;
            }

            selected.push(
                candidate,
            );

            if (
                selected.length >= 12
            ) {
                break;
            }
        }

        /*
         * 샘플 다양성이 부족한 경우 forest 계열 기본색으로 보충.
         */
        const fallbackColors = [
            0x77a83b,
            0x4f7e36,
            0xa8c95a,
            0x6b8f47,
            0xc5b96b,
            0x8a6a42,
            0x557f68,
            0x88b66c,
            0x659cc2,
            0x557d9a,
            0x9c8f65,
            0x6e7756,
        ];

        this.hunterCamoColors =
            selected
                .map(
                    (item) =>
                        item.color,
                )
                .slice(
                    0,
                    13,
                );

        for (
            const fallback of
                fallbackColors
        ) {
            if (
                this.hunterCamoColors
                    .length >= 13
            ) {
                break;
            }

            if (
                !this.hunterCamoColors
                    .includes(
                        fallback,
                    )
            ) {
                this.hunterCamoColors
                    .push(
                        fallback,
                    );
            }
        }

        this.hunterCamoPaletteObjects
            .forEach(
                (object) => {
                    if (
                        !(
                            object instanceof
                            Phaser.GameObjects
                                .Rectangle
                        )
                    ) {
                        return;
                    }

                    const index =
                        object.getData(
                            'hunterCamoIndex',
                        );

                    if (
                        typeof index !==
                        'number'
                    ) {
                        return;
                    }

                    const color =
                        this.hunterCamoColors[
                            index
                        ];

                    if (
                        typeof color ===
                        'number'
                    ) {
                        object.setFillStyle(
                            color,
                            1,
                        );
                    }
                },
            );
    }

    private setHunterCamoPaletteVisible(
        visible: boolean,
    ): void {
        this.hunterCamoPaletteObjects
            .forEach(
                (object) => {
                    const visibleObject =
                        object as
                            Phaser.GameObjects
                                .GameObject & {
                                setVisible?: (
                                    value:
                                        boolean,
                                ) => unknown;
                            };

                    visibleObject
                        .setVisible?.(
                            visible,
                        );
                },
            );
    }

    private highlightHunterCamoColor(
        selectedIndex: number,
    ): void {
        this.hunterCamoPaletteObjects
            .forEach(
                (object) => {
                    if (
                        !(
                            object instanceof
                            Phaser.GameObjects
                                .Rectangle
                        )
                    ) {
                        return;
                    }

                    const index =
                        object.getData(
                            'hunterCamoIndex',
                        );

                    if (
                        typeof index !==
                        'number'
                    ) {
                        return;
                    }

                    object.setStrokeStyle(
                        index ===
                            selectedIndex
                            ? 4
                            : 2,
                        index ===
                            selectedIndex
                            ? 0x111827
                            : 0xffffff,
                        1,
                    );
                },
            );
    }

    private updatePaintControlHelp(): void {
        if (
            !this.paintControlHelpText
        ) {
            return;
        }

        const hunterPaint =
            multiplayerClient.isConnected() &&
            this.networkPlayerManager
                ?.canLocalControlHunter?.();

        this.paintControlHelpText.setText(
            [
                tr('PAINT CONTROLS'),
                tr('좌클릭  색칠'),
                hunterPaint
                    ? tr('기본 색상 팔레트')
                    : tr('배경 위장색 + 검정/흰색 팔레트'),
                hunterPaint
                    ? tr('우클릭  숨은 배경 추출 불가')
                    : tr('우클릭  스포이드'),
                tr('휠      확대 / 축소'),
                tr('Ctrl+휠 브러시 크기'),
                tr('Shift+드래그  직선 그리기'),
                this.mobileControlsEnabled
                    ? tr('터치  미리보기 · 움직이면 색칠')
                    : '',
                tr('Ctrl+Z  한 단계 되돌리기'),
                tr('Ctrl+Y  한 단계 다시 실행'),
                tr('팔레트  브러시 모양'),
                tr('B       모양 전환'),
                tr(`현재 ${this.getBrushShapeLabel()} · ${this.brushSize}`),
            ]
                .filter(Boolean)
                .join('\n'),
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

    private setBrushSize(
        requestedSize: number,
    ): void {
        const nextSize =
            Phaser.Math.Clamp(
                Math.round(requestedSize),
                1,
                20,
            );

        this.brushSize =
            nextSize;

        /*
         * One authoritative update path for slider / Ctrl+wheel / keys.
         * The slider knob can therefore never drift away from brushSize.
         */
        this.createBrushTexture(true);
        this.updatePaintHud();
        this.updatePaintPreviewImmediately();
        this.updatePaintControlHelp();
        this.updateBrushSizeSliderUi();
    }

    private updateBrushSizeSliderUi(): void {
        if (
            !this.brushSizeSliderTrack ||
            !this.brushSizeSliderFill ||
            !this.brushSizeSliderKnob ||
            !this.brushSizeSliderLabel
        ) {
            return;
        }

        const minX = 320;
        const maxX = 515;

        const ratio =
            Phaser.Math.Clamp(
                (this.brushSize - 1) /
                    19,
                0,
                1,
            );

        const baseKnobX =
            Phaser.Math.Linear(
                minX,
                maxX,
                ratio,
            );

        const fillWidth =
            Math.max(
                0,
                baseKnobX -
                    minX,
            );

        /*
         * fixedHudBaseTransforms is the single source of truth for screen HUD.
         * Update the UNZOOMED base positions, then apply camera compensation
         * exactly once.  This avoids the old double compensation that made
         * the knob drift while zoomed.
         */
        const knobBase =
            this.fixedHudBaseTransforms
                .get(
                    this.brushSizeSliderKnob,
                );

        if (knobBase) {
            knobBase.x =
                baseKnobX;
        } else {
            this.brushSizeSliderKnob
                .setX(
                    baseKnobX,
                );
        }

        const fillBase =
            this.fixedHudBaseTransforms
                .get(
                    this.brushSizeSliderFill,
                );

        if (fillBase) {
            fillBase.x =
                minX;
        }

        this.brushSizeSliderFill
            .setSize(
                fillWidth,
                6,
            );

        this.brushSizeSliderLabel
            .setText(
                `${this.brushSize}px`,
            );

        if (
            this.fixedHudBaseTransforms
                .has(
                    this.brushSizeSliderKnob,
                )
        ) {
            this.applyFixedHudForZoom(
                this.cameras.main.zoom,
            );
        }
    }

    private highlightBrushShape(
        selectedShape: BrushShape,
    ): void {
        this.paletteObjects.forEach(
            (object) => {
                if (
                    !(object instanceof
                        Phaser.GameObjects.Text)
                ) {
                    return;
                }

                const shape =
                    object.getData(
                        'brushShape',
                    ) as
                        | BrushShape
                        | undefined;

                if (!shape) {
                    return;
                }

                object
                    .setBackgroundColor(
                        shape === selectedShape
                            ? '#9fbd86'
                            : '#e8efd8',
                    )
                    .setColor(
                        '#26352b',
                    );
            },
        );
    }

    private createPaintTools(): void {
        this.paintPreview = this.add.graphics();
        this.paintPreview.setDepth(200);
        this.paintPreview.setVisible(false);

        this.straightLinePreview =
            this.add.graphics()
                /*
                 * Hunter customization uses player depth ~920 and paint
                 * texture depth ~921. Keep the line preview above both so
                 * Shift straight-line guidance is visible for Hunter too.
                 */
                .setDepth(975)
                .setVisible(false);

        this.createBrushTexture();
        this.redrawPaintPreview();
    }

    private getPaintPreviewBrushSize(): number {
        /*
         * Hider Paint:
         * 카메라 zoom이 preview와 실제 캐릭터를 함께 확대하므로
         * world brushSize 그대로 사용합니다.
         *
         * Hunter Paint:
         * 캐릭터 container 자체가 customization mode에서 3배 확대됩니다.
         * 실제 stamp는 80x120 paint texture의 local 좌표계에 찍히므로,
         * 화면에서 보이는 실제 칠 영역도 container scale만큼 커집니다.
         * preview는 container 밖의 world Graphics이므로 동일 scale을
         * 직접 반영해야 화면상 크기가 정확히 일치합니다.
         */
        if (
            multiplayerClient.isConnected() &&
            this.phase === 'paint' &&
            this.networkPlayerManager
                .canLocalControlHunter()
        ) {
            return (
                this.brushSize *
                this.networkPlayerManager
                    .getLocalPlayerVisualScale()
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

        if (this.brushSize === 1) {
            const pixelScale =
                multiplayerClient.isConnected() &&
                this.phase === 'paint' &&
                this.networkPlayerManager
                    .canLocalControlHunter()
                    ? this.networkPlayerManager
                        .getLocalPlayerVisualScale()
                    : 1;

            this.paintPreview.fillRect(
                -pixelScale / 2,
                -pixelScale / 2,
                pixelScale,
                pixelScale,
            );
            return;
        }

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
            const pixelScale =
                multiplayerClient.isConnected() &&
                this.phase === 'paint'
                    ? this.networkPlayerManager
                        .getLocalPlayerVisualScale()
                    : 1;

            const visibleRadius =
                previewSize +
                pixelScale * 0.5;

            this.paintPreview.fillCircle(
                0,
                0,
                visibleRadius,
            );
            this.paintPreview.strokeCircle(
                0,
                0,
                visibleRadius,
            );
            return;
        }

        const pixelScale =
            multiplayerClient.isConnected() &&
            this.phase === 'paint'
                ? this.networkPlayerManager
                    .getLocalPlayerVisualScale()
                : 1;

        const diameter =
            previewSize * 2 +
            pixelScale;

        /*
         * Actual square brush stamps integer cells from -radius..+radius,
         * i.e. 2*radius+1 pixels. Match that footprint exactly.
         */
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
        const logicalRadius =
            Math.max(
                1,
                Math.round(radius),
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
                -halfWidth,
                y,
                halfWidth * 2 + 1,
                1,
            );
        }

        this.paintPreview.strokeCircle(
            0,
            0,
            logicalRadius,
        );
    }

    private getPaintInputWorldPoint(
        pointer: Phaser.Input.Pointer,
    ): Phaser.Math.Vector2 {
        if (!this.mobileControlsEnabled) {
            return new Phaser.Math.Vector2(
                pointer.worldX,
                pointer.worldY,
            );
        }

        /*
         * Put the actual brush target above the finger so the finger never
         * covers the pixel being painted. Screen offset is converted back
         * through the current camera zoom.
         */
        const zoom =
            Math.max(
                0.01,
                this.cameras.main.zoom,
            );

        return new Phaser.Math.Vector2(
            pointer.worldX,
            pointer.worldY -
                58 / zoom,
        );
    }

    private getPaintPreviewWorldPoint(
        pointer: Phaser.Input.Pointer,
    ): Phaser.Math.Vector2 {
        const target =
            this.getPaintInputWorldPoint(
                pointer,
            );

        if (
            !this.isMultiplayerSession() ||
            !this.networkPlayerManager
        ) {
            return target;
        }

        const container =
            this.networkPlayerManager
                .getLocalPlayerContainer();

        if (!container) {
            return target;
        }

        const scaleX =
            container.scaleX || 1;

        const scaleY =
            container.scaleY || 1;

        /*
         * paintLocalPlayer() converts world -> character-local -> texture
         * and rounds to an integer texture pixel before stamping.
         *
         * Do that exact same conversion here, then convert the snapped pixel
         * back to world space. The visible brush therefore sits on the exact
         * center of the pixels that will actually be painted.
         */
        const localX =
            (
                target.x -
                container.x
            ) /
            scaleX;

        const localY =
            (
                target.y -
                container.y
            ) /
            scaleY;

        const textureX =
            Math.round(
                localX + 40,
            );

        const textureY =
            Math.round(
                localY + 60,
            );

        return new Phaser.Math.Vector2(
            container.x +
                (
                    textureX - 40
                ) *
                    scaleX,
            container.y +
                (
                    textureY - 60
                ) *
                    scaleY,
        );
    }

    private ensureMobilePaintPrecisionGuide(): void {
        if (
            this.mobilePaintPrecisionRing &&
            this.mobilePaintPrecisionCrosshair
        ) {
            return;
        }

        this.mobilePaintPrecisionRing =
            this.add.circle(
                0,
                0,
                25,
                0xffffff,
                0.08,
            )
                .setStrokeStyle(
                    3,
                    0x172027,
                    0.78,
                )
                .setDepth(6500)
                .setVisible(false);

        this.mobilePaintPrecisionCrosshair =
            this.add.graphics()
                .setDepth(6501)
                .setVisible(false);
    }

    private updateMobilePaintPrecisionGuide(
        pointer: Phaser.Input.Pointer,
    ): void {
        if (
            !this.mobileControlsEnabled ||
            this.phase !== 'paint'
        ) {
            return;
        }

        this.ensureMobilePaintPrecisionGuide();

        const target =
            this.getPaintPreviewWorldPoint(
                pointer,
            );

        this.mobilePaintPrecisionRing
            ?.setPosition(
                target.x,
                target.y,
            )
            .setRadius(
                Math.max(
                    12,
                    this.brushSize * 2.4,
                ),
            )
            .setVisible(true);

        this.mobilePaintPrecisionCrosshair
            ?.clear()
            .lineStyle(
                2 /
                    Math.max(
                        0.01,
                        this.cameras.main.zoom,
                    ),
                0x172027,
                0.9,
            )
            .lineBetween(
                target.x - 10,
                target.y,
                target.x + 10,
                target.y,
            )
            .lineBetween(
                target.x,
                target.y - 10,
                target.x,
                target.y + 10,
            )
            .setVisible(true);
    }

    private hideMobilePaintPrecisionGuide(): void {
        this.mobilePaintPrecisionRing
            ?.setVisible(false);

        this.mobilePaintPrecisionCrosshair
            ?.clear()
            .setVisible(false);
    }

    private showMobilePendingPaintPreview(
        pointer: Phaser.Input.Pointer,
    ): void {
        const target =
            this.getPaintPreviewWorldPoint(
                pointer,
            );

        this.updateMobilePaintPrecisionGuide(
            pointer,
        );

        this.paintPreview
            .setPosition(
                target.x,
                target.y,
            );

        this.redrawPaintPreview();

        /*
         * Tap shows the exact color + footprint that WOULD be painted,
         * but does not modify the character yet.
         */
        this.paintPreview
            .setAlpha(0.72)
            .setVisible(true);
    }

    private clearMobilePendingPaint(
        hidePreview = true,
    ): void {
        this.mobilePendingPaintPointerId =
            -1;

        this.mobilePendingPaintStartScreen =
            undefined;

        this.mobilePendingPaintStartWorld =
            undefined;

        if (hidePreview) {
            this.paintPreview
                ?.setAlpha(1)
                .setVisible(false);

            this.hideMobilePaintPrecisionGuide();
        }
    }

    private beginMobilePaintAfterDrag(
        pointer: Phaser.Input.Pointer,
    ): boolean {
        if (
            this.mobilePendingPaintPointerId < 0 ||
            pointer.id !==
                this.mobilePendingPaintPointerId ||
            !this.mobilePendingPaintStartScreen ||
            !this.mobilePendingPaintStartWorld ||
            !pointer.isDown ||
            this.phase !== 'paint' ||
            !this.isMultiplayerSession()
        ) {
            return false;
        }

        const movedScreenPixels =
            Phaser.Math.Distance.Between(
                this.mobilePendingPaintStartScreen.x,
                this.mobilePendingPaintStartScreen.y,
                pointer.x,
                pointer.y,
            );

        /*
         * A pure tap is preview-only.
         * The first real movement (>= 1 screen pixel) commits painting.
         */
        if (movedScreenPixels < 1) {
            this.showMobilePendingPaintPreview(
                pointer,
            );
            return true;
        }

        const startTarget =
            this.mobilePendingPaintStartWorld.clone();

        const currentTarget =
            this.getPaintInputWorldPoint(
                pointer,
            );

        this.paintPreview
            .setAlpha(1)
            .setPosition(
                this.getPaintPreviewWorldPoint(
                    pointer,
                ).x,
                this.getPaintPreviewWorldPoint(
                    pointer,
                ).y,
            );

        const startPoint =
            this.networkPlayerManager
                .paintLocalPlayer(
                    startTarget.x,
                    startTarget.y,
                    this.brushTextureKey,
                    this.paintColor,
                    this.brushSize,
                    this.brushShape,
                );

        if (!startPoint) {
            this.clearMobilePendingPaint(
                false,
            );
            return true;
        }

        this.playPaintSound();
        this.isPainting = true;
        this.activeStrokeTargetSessionId =
            multiplayerClient
                .getSessionId() ?? '';

        this.activeStrokePoints = [
            startPoint,
        ];

        this.currentStrokeHistoryPoints = [
            startPoint,
        ];

        this.straightLineStart = {
            x: startPoint.x,
            y: startPoint.y,
        };

        this.straightLineStartWorld =
            startTarget.clone();

        this.straightLineModeActive =
            false;

        /*
         * Immediately continue from the preview point to the first moved
         * point, so enabling the 1px threshold does not create a gap.
         */
        const currentPoint =
            this.networkPlayerManager
                .paintLocalPlayer(
                    currentTarget.x,
                    currentTarget.y,
                    this.brushTextureKey,
                    this.paintColor,
                    this.brushSize,
                    this.brushShape,
                );

        if (currentPoint) {
            this.interpolateActivePaintStroke(
                currentPoint,
            );
        }

        this.clearMobilePendingPaint(
            false,
        );

        this.updateMobilePaintPrecisionGuide(
            pointer,
        );

        return true;
    }

    private updateStraightLinePreview(
        pointer: Phaser.Input.Pointer,
    ): void {
        if (
            !this.straightLinePreview ||
            !this.straightLineStartWorld ||
            !this.straightLineModeActive ||
            !this.isPainting ||
            this.phase !== 'paint'
        ) {
            this.clearStraightLinePreview();
            return;
        }

        const target =
            this.getPaintInputWorldPoint(
                pointer,
            );

        const previewWidth =
            Math.max(
                1,
                this.getPaintPreviewBrushSize() *
                    1.7,
            );

        this.straightLinePreview
            .clear()
            .setVisible(true)
            .lineStyle(
                previewWidth,
                this.paintColor,
                this.networkPlayerManager
                    ?.canLocalControlHunter?.()
                    ? 0.68
                    : 0.48,
            )
            .lineBetween(
                this.straightLineStartWorld.x,
                this.straightLineStartWorld.y,
                target.x,
                target.y,
            )
            .lineStyle(
                this.networkPlayerManager
                    ?.canLocalControlHunter?.()
                    ? 2.5
                    : 1.5,
                0x172027,
                0.88,
            )
            .lineBetween(
                this.straightLineStartWorld.x,
                this.straightLineStartWorld.y,
                target.x,
                target.y,
            );
    }

    private clearStraightLinePreview(): void {
        this.straightLinePreview
            ?.clear()
            .setVisible(false);
    }

    private isPaintUiHit(
        currentlyOver:
            Phaser.GameObjects.GameObject[],
    ): boolean {
        return currentlyOver.some(
            (object) =>
                this.paletteObjects.includes(
                    object,
                ) ||
                this.hunterCamoPaletteObjects.includes(
                    object,
                ) ||
                object ===
                    this.eyedropperButton ||
                object ===
                    this.undoPaintButton ||
                object ===
                    this.redoPaintButton ||
                object ===
                    this.spectatorButton ||
                object ===
                    this.brushSizeSliderTrack ||
                object ===
                    this.brushSizeSliderKnob,
        );
    }

    private createPointerControls(): void {
        this.input.on(
            Phaser.Input.Events.POINTER_DOWN,
            (
                pointer: Phaser.Input.Pointer,
                currentlyOver:
                    Phaser.GameObjects.GameObject[],
            ) => {
                /*
                 * UI presses are not gameplay/background presses.
                 * This is especially important for the eyedropper button:
                 * pressing the button must arm the tool, not sample the
                 * background underneath the button.
                 */
                if (
                    this.isPaintUiHit(
                        currentlyOver,
                    )
                ) {
                    /*
                     * Palette/Undo/slider presses are UI-only. Never allow
                     * the same touch to paint the world underneath.
                     */
                    this.isPainting = false;
                    this.clearStraightLinePreview();
                    return;
                }

                if (
                    this.mobileControlsEnabled &&
                    (
                        pointer.id ===
                            this.mobileFirePointerId ||
                        this.isMobileControlScreenPoint(
                            pointer.x,
                            pointer.y,
                        )
                    )
                ) {
                    return;
                }

                if (this.phase === 'hunt') {
                    /*
                     * MOBILE HUNTER CONTROL CONTRACT:
                     *
                     * - left joystick  = movement only
                     * - right joystick = aiming only
                     * - FIRE button    = shooting only
                     *
                     * A generic world/screen tap must never fire on mobile.
                     * This prevents accidental shots while moving or simply
                     * touching the screen.
                     */
                    if (this.mobileControlsEnabled) {
                        return;
                    }

                    if (
                        pointer.leftButtonDown() &&
                        (
                            !this.isMultiplayerSession() ||
                            this.networkPlayerManager
                                .canLocalControlHunter()
                        )
                    ) {
                        this.fireShotgun();
                    }

                    return;
                }

                if (this.phase !== 'paint') {
                    return;
                }

                /*
                 * On mobile, finger #2 belongs to pinch zoom.
                 * It must never replace the pending/active paint pointer.
                 */
                if (
                    this.mobileControlsEnabled &&
                    (
                        this.mobilePinchActive ||
                        (
                            this.mobileTouchPoints.size >= 1 &&
                            !this.mobileTouchPoints.has(
                                pointer.id,
                            )
                        )
                    )
                ) {
                    return;
                }

                if (this.eyedropperArmed) {
                    /*
                     * Ignore every paint/palette UI object while the tool is
                     * armed.  The user must tap/click the actual game world.
                     */
                    const pressedPaintUi =
                        currentlyOver.some(
                            (object) =>
                                this.paletteObjects
                                    .includes(object) ||
                                this.hunterCamoPaletteObjects
                                    .includes(object),
                        );

                    if (pressedPaintUi) {
                        return;
                    }

                    this.finishActivePaintStroke();
                    this.isPainting = false;
                    this.activeStrokePoints = [];
                    this.activeStrokeTargetSessionId = '';

                    const localIsHunter =
                        this.isMultiplayerSession() &&
                        this.networkPlayerManager
                            .canLocalControlHunter();

                    if (localIsHunter) {
                        this.eyedropperArmed = false;
                        this.updateEyedropperButtonUi();
                        this.showStatus(
                            tr('헌터는 숨겨진 배경을 스포이드할 수 없습니다. CAMO SWATCH를 사용하세요.'),
                        );
                        return;
                    }

                    if (
                        this.mobileControlsEnabled
                    ) {
                        /*
                         * Mobile: this touch only STARTS precision sampling.
                         * Drag updates the loupe; pointer-up confirms.
                         */
                        this.eyedropperPointerId =
                            pointer.id;

                        this.updateEyedropperMagnifier(
                            pointer,
                        );

                        return;
                    }

                    /*
                     * PC keeps the fast one-click workflow.
                     */
                    this.pickColorFromBackground(
                        pointer.worldX,
                        pointer.worldY,
                    );

                    this.eyedropperArmed = false;
                    this.updateEyedropperButtonUi();
                    this.hideEyedropperMagnifier();
                    return;
                }

                if (pointer.rightButtonDown()) {
                    /*
                     * 직전 좌클릭 stroke가 남아 있는 상태에서 색을 바꾸면
                     * stroke metadata와 실제 brush texture 색이 어긋날 수 있습니다.
                     * 색 추출 전에 기존 stroke를 먼저 정상 종료합니다.
                     */
                    this.finishActivePaintStroke();
                    this.isPainting = false;
                    this.activeStrokePoints = [];
                    this.activeStrokeTargetSessionId = '';

                    const localIsHunter =
                        this.isMultiplayerSession() &&
                        this.networkPlayerManager
                            .canLocalControlHunter();

                    if (localIsHunter) {
                        /*
                         * Hunter Paint는 실제 배경을 검은 장막으로 가리고 있으므로
                         * 보이지 않는 현재 gameplay background pixel을 우클릭으로
                         * 추출하는 것을 금지합니다.
                         */
                        this.showStatus(
                            tr('헌터는 숨겨진 배경을 스포이드할 수 없습니다. CAMO SWATCH를 사용하세요.'),
                        );

                        return;
                    }

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
                    this.isMultiplayerSession()
                ) {
                    const paintTarget =
                        this.getPaintInputWorldPoint(
                            pointer,
                        );

                    if (
                        this.mobileControlsEnabled
                    ) {
                        /*
                         * Mobile safety mode:
                         * first touch only previews. Painting begins after
                         * the finger moves at least one screen pixel.
                         */
                        this.finishActivePaintStroke();
                        this.isPainting = false;

                        this.mobilePendingPaintPointerId =
                            pointer.id;

                        this.mobilePendingPaintStartScreen =
                            new Phaser.Math.Vector2(
                                pointer.x,
                                pointer.y,
                            );

                        this.mobilePendingPaintStartWorld =
                            paintTarget.clone();

                        this.showMobilePendingPaintPreview(
                            pointer,
                        );

                        return;
                    }

                    this.updateMobilePaintPrecisionGuide(
                        pointer,
                    );

                    const point =
                        this.networkPlayerManager
                            .paintLocalPlayer(
                                paintTarget.x,
                                paintTarget.y,
                                this.brushTextureKey,
                                this.paintColor,
                                this.brushSize,
                                this.brushShape,
                            );

                    if (!point) {
                        return;
                    }

                    this.playPaintSound();
                    this.isPainting = true;
                    this.activeStrokeTargetSessionId =
                        multiplayerClient
                            .getSessionId() ?? '';
                    this.activeStrokePoints = [
                        point,
                    ];
                    this.currentStrokeHistoryPoints = [
                        point,
                    ];

                    /*
                     * Always remember the stroke origin. Shift may be pressed
                     * before OR after pointer-down; preview should still work.
                     */
                    this.straightLineStart = {
                        x: point.x,
                        y: point.y,
                    };

                    this.straightLineStartWorld =
                        new Phaser.Math.Vector2(
                            paintTarget.x,
                            paintTarget.y,
                        );

                    this.straightLineModeActive =
                        Boolean(
                            this.shiftPaintKey
                                ?.isDown,
                        );

                    this.updateStraightLinePreview(
                        pointer,
                    );

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
                if (
                    this.eyedropperArmed &&
                    pointer.id ===
                        this.eyedropperPointerId
                ) {
                    this.updateEyedropperMagnifier(
                        pointer,
                    );
                    return;
                }

                const activeMobilePaintTouches =
                    this.mobileControlsEnabled
                        ? [
                            ...this.mobileTouchPoints
                                .keys(),
                        ].filter(
                            (id) =>
                                this.isMobilePointerActuallyDown(
                                    id,
                                ),
                        ).length
                        : 0;

                if (
                    this.mobileControlsEnabled &&
                    (
                        this.mobilePinchActive ||
                        activeMobilePaintTouches >= 2
                    )
                ) {
                    return;
                }

                if (
                    this.mobileControlsEnabled &&
                    this.phase === 'paint' &&
                    pointer.isDown
                ) {
                    this.updateMobilePaintPrecisionGuide(
                        pointer,
                    );
                }

                if (
                    this.mobileControlsEnabled &&
                    pointer.id ===
                        this.mobilePendingPaintPointerId
                ) {
                    const handledPending =
                        this.beginMobilePaintAfterDrag(
                            pointer,
                        );

                    if (
                        handledPending &&
                        !this.isPainting
                    ) {
                        return;
                    }

                    /*
                     * If painting just started in this move event, it already
                     * painted/interpolated to the current point above.
                     */
                    if (handledPending) {
                        return;
                    }
                }

                if (
                    pointer.id ===
                        this.mobileMovePointerId ||
                    pointer.id ===
                        this.mobileAimPointerId
                ) {
                    return;
                }

                this.updatePaintPreview(pointer);

                if (
                    this.phase !== 'paint' ||
                    !this.isPainting ||
                    !pointer.isDown
                ) {
                    return;
                }

                if (
                    this.isMultiplayerSession()
                ) {
                    if (
                        this.shiftPaintKey?.isDown &&
                        this.straightLineStart
                    ) {
                        this.straightLineModeActive =
                            true;

                        /*
                         * Live visual preview. No permanent paint is stamped
                         * until release, so the player can aim the line.
                         */
                        this.updateStraightLinePreview(
                            pointer,
                        );
                        return;
                    }

                    if (
                        this.straightLineModeActive
                    ) {
                        /*
                         * Once a stroke entered line mode, keep previewing
                         * until release even if Shift is released first.
                         */
                        this.updateStraightLinePreview(
                            pointer,
                        );
                        return;
                    }

                    const point =
                        this.networkPlayerManager
                            .paintLocalPlayer(
                                this.getPaintInputWorldPoint(
                                    pointer,
                                ).x,
                                this.getPaintInputWorldPoint(
                                    pointer,
                                ).y,
                                this.brushTextureKey,
                                this.paintColor,
                                this.brushSize,
                                this.brushShape,
                            );

                    if (point) {
                        this.playPaintSound();
                        this.interpolateActivePaintStroke(
                            point,
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
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                if (
                    this.eyedropperArmed &&
                    pointer.id ===
                        this.eyedropperPointerId
                ) {
                    this.pickColorFromBackground(
                        pointer.worldX,
                        pointer.worldY,
                    );

                    this.eyedropperArmed =
                        false;
                    this.updateEyedropperButtonUi();
                    this.hideEyedropperMagnifier();
                    this.hideMobilePaintPrecisionGuide();

                    this.isPainting = false;
                    this.finishActivePaintStroke();
                    return;
                }

                if (
                    this.mobileControlsEnabled &&
                    pointer.id ===
                        this.mobilePendingPaintPointerId
                ) {
                    /*
                     * Finger lifted before crossing the 1px threshold:
                     * preview disappears and absolutely no paint is applied.
                     */
                    this.clearMobilePendingPaint();
                    this.isPainting = false;
                    return;
                }

                if (
                    this.phase === 'paint' &&
                    this.isMultiplayerSession() &&
                    this.isPainting &&
                    this.straightLineStart &&
                    this.straightLineModeActive
                ) {
                    const target =
                        this.getPaintInputWorldPoint(
                            pointer,
                        );

                    const endPoint =
                        this.networkPlayerManager
                            .paintLocalPlayer(
                                target.x,
                                target.y,
                                this.brushTextureKey,
                                this.paintColor,
                                this.brushSize,
                                this.brushShape,
                            );

                    if (endPoint) {
                        /*
                         * Reuse the existing interpolation routine so Shift
                         * produces the same gap-free raster line locally and
                         * over the network.
                         */
                        this.interpolateActivePaintStroke(
                            endPoint,
                        );
                    }
                }

                this.straightLineStart =
                    undefined;
                this.straightLineStartWorld =
                    undefined;
                this.straightLineModeActive =
                    false;
                this.clearStraightLinePreview();

                this.hideMobilePaintPrecisionGuide();

                this.isPainting = false;
                this.finishActivePaintStroke();
            },
        );

        this.input.on(
            Phaser.Input.Events.POINTER_UP_OUTSIDE,
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                if (
                    pointer.id ===
                        this.mobilePendingPaintPointerId
                ) {
                    this.clearMobilePendingPaint();
                    this.isPainting = false;
                }
            },
        );

        this.input.on(
            Phaser.Input.Events.POINTER_WHEEL,
            (
                pointer:
                    Phaser.Input.Pointer,
                _gameObjects:
                    Phaser.GameObjects.GameObject[],
                _deltaX: number,
                deltaY: number,
            ) => {
                if (
                    this.phase !== 'paint' ||
                    !this.isMultiplayerSession()
                ) {
                    return;
                }

                const nativeEvent =
                    pointer.event as
                        | WheelEvent
                        | undefined;

                if (nativeEvent?.ctrlKey) {
                    /*
                     * Ctrl + Wheel = 브러시 크기.
                     * 위로 스크롤하면 크게, 아래로 스크롤하면 작게.
                     */
                    const delta =
                        deltaY < 0
                            ? 1
                            : -1;

                    this.setBrushSize(
                        this.brushSize +
                            delta,
                    );

                    return;
                }

                /*
                 * 일반 Wheel = Paint 화면 확대/축소.
                 */
                const zoom =
                    this.adjustPaintWorldZoom(
                        deltaY,
                    );

                this.networkPlayerManager
                    .showOnlyLocalPlayer();

                this.paintZoomText.setText(
                    [
                        tr(`ZOOM ${zoom.toFixed(2)}x`),
                        tr(`BRUSH ${this.brushSize}`),
                        tr('휠: 확대/축소 · Ctrl+휠: 브러시 크기'),
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

        this.playPaintSound();

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

    private flushActivePaintStrokeChunk(
        keepLastPoint = true,
    ): void {
        if (
            !multiplayerClient.isConnected() ||
            !this.activeStrokeTargetSessionId ||
            this.activeStrokePoints.length === 0
        ) {
            return;
        }

        const pointsToSend = [
            ...this.activeStrokePoints,
        ];

        multiplayerClient.sendPaintStroke({
            targetSessionId:
                this.activeStrokeTargetSessionId,
            color: this.paintColor,
            size: this.brushSize,
            shape: this.brushShape,
            points: pointsToSend,
        });

        if (
            keepLastPoint &&
            pointsToSend.length > 0
        ) {
            this.activeStrokePoints = [
                pointsToSend[
                    pointsToSend.length - 1
                ],
            ];
        } else {
            this.activeStrokePoints = [];
        }
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

        const nextX =
            Phaser.Math.Clamp(
                Math.round(textureX),
                0,
                80,
            );

        const nextY =
            Phaser.Math.Clamp(
                Math.round(textureY),
                0,
                120,
            );

        /*
         * Local interpolation stamps raster pixels continuously.
         * Only skip an identical pixel; otherwise remote clients must
         * receive the same path the painter actually saw.
         */
        if (
            previousPoint &&
            Math.round(previousPoint.x) === nextX &&
            Math.round(previousPoint.y) === nextY
        ) {
            return;
        }

        const recordedPoint = {
            x: nextX,
            y: nextY,
        };

        this.activeStrokePoints.push(
            recordedPoint,
        );

        const previousHistoryPoint =
            this.currentStrokeHistoryPoints[
                this.currentStrokeHistoryPoints.length - 1
            ];

        if (
            !previousHistoryPoint ||
            Math.round(
                previousHistoryPoint.x,
            ) !== nextX ||
            Math.round(
                previousHistoryPoint.y,
            ) !== nextY
        ) {
            this.currentStrokeHistoryPoints.push(
                recordedPoint,
            );
        }

        if (
            multiplayerClient.isConnected() &&
            this.activeStrokePoints.length >= 24
        ) {
            this.flushActivePaintStrokeChunk(
                true,
            );
        }
    }

    private interpolateActivePaintStroke(
        current:
            NetworkPaintPoint,
    ): void {
        const previous =
            this.activeStrokePoints[
                this.activeStrokePoints.length - 1
            ];

        if (!previous) {
            this.recordActivePaintPoint(
                current.x,
                current.y,
            );
            return;
        }

        const distance =
            Phaser.Math.Distance.Between(
                previous.x,
                previous.y,
                current.x,
                current.y,
            );

        const spacing =
            Math.max(
                0.75,
                Math.min(
                    1.5,
                    this.brushSize * 0.22,
                ),
            );

        const steps =
            Math.max(
                1,
                Math.ceil(
                    distance /
                    spacing,
                ),
            );

        for (
            let step = 1;
            step <= steps;
            step += 1
        ) {
            const t =
                step / steps;

            const x =
                Phaser.Math.Linear(
                    previous.x,
                    current.x,
                    t,
                );

            const y =
                Phaser.Math.Linear(
                    previous.y,
                    current.y,
                    t,
                );

            this.networkPlayerManager
                .stampLocalPaintPoint(
                    x,
                    y,
                    this.brushTextureKey,
                    this.paintColor,
                    this.brushSize,
                    this.brushShape,
                );

            this.recordActivePaintPoint(
                x,
                y,
            );
        }
    }

    private finishActivePaintStroke(): void {
        const completedTarget =
            this.activeStrokeTargetSessionId;

        if (
            multiplayerClient.isConnected() &&
            completedTarget &&
            this.activeStrokePoints.length > 0
        ) {
            this.flushActivePaintStrokeChunk(
                false,
            );
        }

        if (
            completedTarget &&
            this.currentStrokeHistoryPoints.length >
                0
        ) {
            this.localPaintHistory.push({
                targetSessionId:
                    completedTarget,
                color:
                    this.paintColor,
                size:
                    this.brushSize,
                shape:
                    this.brushShape,
                points:
                    this.currentStrokeHistoryPoints
                        .map(
                            (point) => ({
                                x: point.x,
                                y: point.y,
                            }),
                        ),
            });

            /*
             * Standard Undo/Redo behavior:
             * once the player draws something new after Undo, the old Redo
             * branch is no longer valid.
             */
            this.redoPaintHistory = [];

            /*
             * IMPORTANT:
             * localPaintHistory is the complete authoritative picture used
             * by rebuildLocalPaintFromHistory() at Paint -> Hunt.
             *
             * Do NOT trim old strokes here. The old 40-stroke limit meant
             * early camouflage (very often torso/legs painted first) was
             * discarded. Hunt then cleared the body to white and replayed
             * only the newest 40 strokes, making the Hunter see an
             * incompletely painted Hider.
             *
             * Undo depth can be handled independently; the final painted
             * state must retain every stroke for the duration of this round.
             */
        }

        this.activeStrokePoints = [];
        this.currentStrokeHistoryPoints = [];
        this.activeStrokeTargetSessionId = '';
        this.straightLineStart = undefined;
        this.straightLineStartWorld =
            undefined;
        this.straightLineModeActive =
            false;
        this.clearStraightLinePreview();
    }

    private rebuildLocalPaintFromHistory(): void {
        const sessionId =
            multiplayerClient.getSessionId();

        if (!sessionId) {
            return;
        }

        /*
         * Network-synchronized repaint:
         * 1) cover the full authoritative silhouette with legal white stamps
         * 2) replay every currently active stroke in original order
         *
         * Every client receives the same ordered paint_stroke messages.
         */
        const resetStroke:
            NetworkPaintStroke = {
                targetSessionId:
                    sessionId,
                color:
                    0xf5eee2,
                size:
                    20,
                shape:
                    'square',
                points: [
                    {
                        x: 40,
                        y: 48,
                    },
                    {
                        x: 40,
                        y: 78,
                    },
                ],
            };

        resetStroke.points.forEach(
            (point) => {
                this.networkPlayerManager
                    .stampLocalPaintPoint(
                        point.x,
                        point.y,
                        this.brushTextureKey,
                        resetStroke.color,
                        resetStroke.size,
                        resetStroke.shape,
                    );
            },
        );

        multiplayerClient
            .sendPaintStroke(
                resetStroke,
            );

        this.localPaintHistory.forEach(
            (stroke) => {
                stroke.points.forEach(
                    (point) => {
                        this.networkPlayerManager
                            .stampLocalPaintPoint(
                                point.x,
                                point.y,
                                this.brushTextureKey,
                                stroke.color,
                                stroke.size,
                                stroke.shape,
                            );
                    },
                );

                multiplayerClient
                    .sendPaintStroke(
                        stroke,
                    );
            },
        );
    }

    private undoLastPaintStroke(): void {
        if (
            this.phase !== 'paint' ||
            !this.isMultiplayerSession()
        ) {
            return;
        }

        this.finishActivePaintStroke();

        const removedStroke =
            this.localPaintHistory.pop();

        if (!removedStroke) {
            return;
        }

        /*
         * Undo moves the stroke to the Redo stack rather than discarding it.
         */
        this.redoPaintHistory.push(
            removedStroke,
        );

        if (
            this.redoPaintHistory.length >
            40
        ) {
            this.redoPaintHistory.shift();
        }

        this.rebuildLocalPaintFromHistory();

        this.showStatus(
            tr('한 단계 되돌렸습니다.'),
        );
    }

    private redoLastPaintStroke(): void {
        if (
            this.phase !== 'paint' ||
            !this.isMultiplayerSession()
        ) {
            return;
        }

        this.finishActivePaintStroke();

        const restoredStroke =
            this.redoPaintHistory.pop();

        if (!restoredStroke) {
            return;
        }

        this.localPaintHistory.push(
            restoredStroke,
        );

        /*
         * Never trim localPaintHistory here either. It is also the complete
         * reconstruction source for the Hunt transition.
         */

        /*
         * Rebuild and broadcast the same complete paint state used by Undo,
         * so Redo is visible on every connected player's screen as well.
         */
        this.rebuildLocalPaintFromHistory();

        this.showStatus(
            tr('한 단계 다시 실행했습니다.'),
        );
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
        if (
            this.textures.exists(
                textureKey,
            )
        ) {
            return;
        }

        if (size === 1) {
            const graphics =
                this.add.graphics();

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
            this.textures
                .get(textureKey)
                .setFilter(
                    Phaser.Textures
                        .FilterMode.NEAREST,
                );
            graphics.destroy();
            return;
        }

        const radius =
            Math.max(
                1,
                Math.round(size),
            );

        const diameter =
            radius * 2 + 1;

        const graphics =
            this.add.graphics();

        graphics.fillStyle(
            color,
            1,
        );

        if (shape === 'dotCircle') {
            /*
             * 로컬 DOT CIRCLE 브러시와 같은 픽셀 원 알고리즘을
             * 사용해 다른 클라이언트에서도 네모로 보이지 않게 합니다.
             */
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
            shape === 'circle'
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
            textureKey,
            diameter,
            diameter,
        );

        this.textures
            .get(textureKey)
            .setFilter(
                Phaser.Textures.FilterMode.NEAREST,
            );

        graphics.destroy();
    }

    private ensureEyedropperMagnifier(): void {
        if (
            this.eyedropperMagnifier &&
            this.eyedropperMagnifierSwatch
        ) {
            return;
        }

        if (
            !this.textures.exists(
                this.eyedropperMagnifierTextureKey,
            )
        ) {
            const canvasTexture =
                this.textures.createCanvas(
                    this.eyedropperMagnifierTextureKey,
                    112,
                    112,
                );

            if (!canvasTexture) {
                return;
            }

            canvasTexture.refresh();

            this.textures
                .get(
                    this.eyedropperMagnifierTextureKey,
                )
                .setFilter(
                    Phaser.Textures.FilterMode.NEAREST,
                );
        }

        this.eyedropperMagnifier =
            this.add.image(
                this.gameWidth / 2,
                this.gameHeight / 2,
                this.eyedropperMagnifierTextureKey,
            )
                .setScrollFactor(0)
                .setDepth(9100)
                .setVisible(false);

        this.eyedropperMagnifierSwatch =
            this.add.rectangle(
                this.gameWidth / 2,
                this.gameHeight / 2 + 64,
                42,
                14,
                0xffffff,
                1,
            )
                .setStrokeStyle(
                    2,
                    0xffffff,
                    0.95,
                )
                .setScrollFactor(0)
                .setDepth(9101)
                .setVisible(false);
    }

    private hideEyedropperMagnifier(): void {
        this.eyedropperPointerId = -1;

        this.eyedropperMagnifier
            ?.setVisible(false);

        this.eyedropperMagnifierSwatch
            ?.setVisible(false);
    }

    private updateEyedropperMagnifier(
        pointer: Phaser.Input.Pointer,
    ): void {
        this.ensureEyedropperMagnifier();

        if (!this.eyedropperMagnifier) {
            return;
        }

        const sourceImage =
            this.textures
                .get(
                    this.currentBackgroundTextureKey,
                )
                .getSourceImage() as
                    HTMLImageElement;

        if (!sourceImage) {
            return;
        }

        const bounds =
            this.backgroundImage.getBounds();

        const normalizedX =
            Phaser.Math.Clamp(
                (
                    pointer.worldX -
                    bounds.left
                ) /
                bounds.width,
                0,
                1,
            );

        const normalizedY =
            Phaser.Math.Clamp(
                (
                    pointer.worldY -
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

        const sampleSize = 15;
        const half =
            Math.floor(
                sampleSize / 2,
            );

        const sourceX =
            Phaser.Math.Clamp(
                imageX - half,
                0,
                Math.max(
                    0,
                    sourceImage.width -
                    sampleSize,
                ),
            );

        const sourceY =
            Phaser.Math.Clamp(
                imageY - half,
                0,
                Math.max(
                    0,
                    sourceImage.height -
                    sampleSize,
                ),
            );

        const texture =
            this.textures.get(
                this.eyedropperMagnifierTextureKey,
            );

        const canvas =
            texture.getSourceImage() as
                HTMLCanvasElement;

        const context =
            canvas.getContext('2d');

        if (!context) {
            return;
        }

        context.clearRect(
            0,
            0,
            112,
            112,
        );

        /*
         * Build a 15x15 representation of what is ACTUALLY visible:
         * background + the local player's current painted RenderTexture.
         * The old loupe sampled only the raw background image, so already
         * painted pixels vanished inside the mobile magnifier.
         */
        const sceneSample =
            document.createElement(
                'canvas',
            );

        sceneSample.width =
            sampleSize;
        sceneSample.height =
            sampleSize;

        const sceneContext =
            sceneSample.getContext(
                '2d',
            );

        if (!sceneContext) {
            return;
        }

        sceneContext.imageSmoothingEnabled =
            false;

        sceneContext.drawImage(
            sourceImage,
            sourceX,
            sourceY,
            sampleSize,
            sampleSize,
            0,
            0,
            sampleSize,
            sampleSize,
        );

        /*
         * Always draw the Hider base silhouette first. This must NOT depend
         * on RenderTexture readback, which can fail on mobile/WebGL.
         */
        if (
            this.networkPlayerManager
                ?.isLocalHider?.()
        ) {
            const localPosition =
                this.networkPlayerManager
                    .getLocalPlayerPosition();

            const localScale =
                this.networkPlayerManager
                    .getLocalPlayerVisualScale();

            if (localPosition) {
                const worldPerSourceX =
                    bounds.width /
                    sourceImage.width;

                const worldPerSourceY =
                    bounds.height /
                    sourceImage.height;

                const patchWorldLeft =
                    bounds.left +
                    sourceX *
                        worldPerSourceX;

                const patchWorldTop =
                    bounds.top +
                    sourceY *
                        worldPerSourceY;

                const bodyWorldLeft =
                    localPosition.x -
                    40 *
                        localScale;

                const bodyWorldTop =
                    localPosition.y -
                    60 *
                        localScale;

                const destX =
                    (
                        bodyWorldLeft -
                        patchWorldLeft
                    ) /
                    worldPerSourceX;

                const destY =
                    (
                        bodyWorldTop -
                        patchWorldTop
                    ) /
                    worldPerSourceY;

                const destWidth =
                    (
                        80 *
                        localScale
                    ) /
                    worldPerSourceX;

                const destHeight =
                    (
                        120 *
                        localScale
                    ) /
                    worldPerSourceY;

                const bodyCanvas =
                    document.createElement(
                        'canvas',
                    );

                bodyCanvas.width = 80;
                bodyCanvas.height = 120;

                const bodyContext =
                    bodyCanvas.getContext(
                        '2d',
                    );

                if (bodyContext) {
                    bodyContext.imageSmoothingEnabled =
                        false;
                    bodyContext.fillStyle =
                        '#f5eee2';

                    for (
                        let bodyY = 0;
                        bodyY < 120;
                        bodyY += 1
                    ) {
                        for (
                            let bodyX = 0;
                            bodyX < 80;
                            bodyX += 1
                        ) {
                            const headDx =
                                bodyX - 40;
                            const headDy =
                                bodyY - 48;

                            const insideHead =
                                headDx * headDx +
                                    headDy * headDy <=
                                12 * 12;

                            const insideBody =
                                bodyX >= 31 &&
                                bodyX <= 48 &&
                                bodyY >= 55 &&
                                bodyY <= 78;

                            const insideLeftArm =
                                bodyX >= 24 &&
                                bodyX <= 31 &&
                                bodyY >= 57 &&
                                bodyY <= 74;

                            const insideRightArm =
                                bodyX >= 48 &&
                                bodyX <= 55 &&
                                bodyY >= 57 &&
                                bodyY <= 74;

                            const insideLeftLeg =
                                bodyX >= 31 &&
                                bodyX <= 38 &&
                                bodyY >= 75 &&
                                bodyY <= 88;

                            const insideRightLeg =
                                bodyX >= 41 &&
                                bodyX <= 48 &&
                                bodyY >= 75 &&
                                bodyY <= 88;

                            if (
                                insideHead ||
                                insideBody ||
                                insideLeftArm ||
                                insideRightArm ||
                                insideLeftLeg ||
                                insideRightLeg
                            ) {
                                bodyContext.fillRect(
                                    bodyX,
                                    bodyY,
                                    1,
                                    1,
                                );
                            }
                        }
                    }

                    /*
                     * Reconstruct the current camouflage directly from the
                     * authoritative local stroke history.
                     *
                     * This is intentionally independent from Phaser/WebGL
                     * RenderTexture readback, which is unreliable on several
                     * mobile browsers. Undo/Redo already mutate this same
                     * localPaintHistory, so the loupe automatically shows the
                     * exact current painted state.
                     */
                    bodyContext.save();
                    bodyContext.globalCompositeOperation =
                        'source-atop';

                    const drawHistoryPoint = (
                        stroke:
                            NetworkPaintStroke,
                        point:
                            NetworkPaintPoint,
                    ): void => {
                        const radius =
                            Math.max(
                                1,
                                Math.round(
                                    stroke.size,
                                ),
                            );

                        bodyContext.fillStyle =
                            `#${stroke.color
                                .toString(16)
                                .padStart(6, '0')}`;

                        if (
                            stroke.size === 1
                        ) {
                            bodyContext.fillRect(
                                Math.round(
                                    point.x,
                                ),
                                Math.round(
                                    point.y,
                                ),
                                1,
                                1,
                            );
                            return;
                        }

                        if (
                            stroke.shape ===
                            'square'
                        ) {
                            bodyContext.fillRect(
                                Math.round(
                                    point.x,
                                ) - radius,
                                Math.round(
                                    point.y,
                                ) - radius,
                                radius * 2 + 1,
                                radius * 2 + 1,
                            );
                            return;
                        }

                        if (
                            stroke.shape ===
                            'circle'
                        ) {
                            bodyContext.beginPath();
                            bodyContext.arc(
                                point.x,
                                point.y,
                                radius,
                                0,
                                Math.PI * 2,
                            );
                            bodyContext.fill();
                            return;
                        }

                        /*
                         * DOT CIRCLE keeps the same pixel-circle geometry
                         * used by the actual brush.
                         */
                        for (
                            let offsetY =
                                -radius;
                            offsetY <=
                                radius;
                            offsetY += 1
                        ) {
                            const halfWidth =
                                Math.floor(
                                    Math.sqrt(
                                        Math.max(
                                            0,
                                            radius *
                                                radius -
                                            offsetY *
                                                offsetY,
                                        ),
                                    ),
                                );

                            bodyContext.fillRect(
                                Math.round(
                                    point.x,
                                ) -
                                    halfWidth,
                                Math.round(
                                    point.y,
                                ) +
                                    offsetY,
                                halfWidth * 2 +
                                    1,
                                1,
                            );
                        }
                    };

                    this.localPaintHistory
                        .forEach(
                            (stroke) => {
                                stroke.points
                                    .forEach(
                                        (point) => {
                                            drawHistoryPoint(
                                                stroke,
                                                point,
                                            );
                                        },
                                    );
                            },
                        );

                    /*
                     * Normally eyedropper arming finishes the active stroke,
                     * but include it defensively so the loupe never lags one
                     * gesture behind.
                     */
                    if (
                        this.currentStrokeHistoryPoints
                            .length > 0
                    ) {
                        const activeStroke:
                            NetworkPaintStroke = {
                                targetSessionId:
                                    multiplayerClient
                                        .getSessionId() ??
                                    '',
                                color:
                                    this.paintColor,
                                size:
                                    this.brushSize,
                                shape:
                                    this.brushShape,
                                points:
                                    this.currentStrokeHistoryPoints,
                            };

                        activeStroke.points
                            .forEach(
                                (point) => {
                                    drawHistoryPoint(
                                        activeStroke,
                                        point,
                                    );
                                },
                            );
                    }

                    bodyContext.restore();

                    sceneContext.drawImage(
                        bodyCanvas,
                        0,
                        0,
                        80,
                        120,
                        destX,
                        destY,
                        destWidth,
                        destHeight,
                    );
                }
            }
        }

        /*
         * Circular pixel loupe.
         */
        context.save();
        context.beginPath();
        context.arc(
            56,
            56,
            50,
            0,
            Math.PI * 2,
        );
        context.clip();
        context.imageSmoothingEnabled =
            false;
        context.drawImage(
            sceneSample,
            0,
            0,
            sampleSize,
            sampleSize,
            6,
            6,
            100,
            100,
        );
        context.restore();

        context.beginPath();
        context.arc(
            56,
            56,
            50,
            0,
            Math.PI * 2,
        );
        context.lineWidth = 5;
        context.strokeStyle =
            '#fffdf3';
        context.stroke();

        /*
         * Exact selected pixel is always the center crosshair.
         */
        context.strokeStyle =
            '#172027';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(
            44,
            56,
        );
        context.lineTo(
            68,
            56,
        );
        context.moveTo(
            56,
            44,
        );
        context.lineTo(
            56,
            68,
        );
        context.stroke();

        let candidateColor =
            0xffffff;

        const centerPixel =
            sceneContext.getImageData(
                half,
                half,
                1,
                1,
            ).data;

        candidateColor =
            Phaser.Display.Color
                .GetColor(
                    centerPixel[0],
                    centerPixel[1],
                    centerPixel[2],
                );

        (
            texture as unknown as
                {
                    refresh?: () => void;
                }
        ).refresh?.();

        const screenX =
            Phaser.Math.Clamp(
                pointer.x,
                70,
                this.gameWidth - 70,
            );

        /*
         * Prefer above the finger. Near the top edge, flip below.
         */
        const preferredY =
            pointer.y > 145
                ? pointer.y - 92
                : pointer.y + 92;

        const screenY =
            Phaser.Math.Clamp(
                preferredY,
                70,
                this.gameHeight - 82,
            );

        this.setFixedHudScreenPosition(
            this.eyedropperMagnifier,
            screenX,
            screenY,
        );

        this.setFixedHudScreenPosition(
            this.eyedropperMagnifierSwatch!,
            screenX,
            screenY + 62,
        );

        this.eyedropperMagnifier
            .setVisible(true);

        this.eyedropperMagnifierSwatch
            ?.setFillStyle(
                candidateColor,
                1,
            )
            .setVisible(true);
    }

    private pickColorFromBackground(
        worldX: number,
        worldY: number,
    ): void {
        const sourceImage = this.textures
            .get(
                this.currentBackgroundTextureKey,
            )
            .getSourceImage() as HTMLImageElement;

        if (!sourceImage) {
            this.showStatus(
                tr('배경 이미지를 읽을 수 없습니다'),
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

        /*
         * 같은 색을 과거에 사용했더라도 현재 Phaser texture cache 상태를
         * 신뢰하지 않고 스포이드 직후 현재 brush를 강제로 다시 생성합니다.
         */
        this.createBrushTexture(true);

        this.isPainting = false;
        this.activeStrokePoints = [];
        this.activeStrokeTargetSessionId = '';

        this.updatePaintHud();
        this.updatePaintPreviewImmediately();

        const hexColor =
            this.paintColor
                .toString(16)
                .padStart(6, '0')
                .toUpperCase();

        this.showStatus(
            tr(`색상 추출 #${hexColor}`),
        );
    }

    private updatePaintPreview(
        pointer: Phaser.Input.Pointer,
    ): void {
        if (this.phase !== 'paint') {
            this.paintPreview.setVisible(false);
            return;
        }

        const previewPoint =
            this.mobileControlsEnabled
                ? this.getPaintPreviewWorldPoint(
                    pointer,
                )
                : new Phaser.Math.Vector2(
                    pointer.worldX,
                    pointer.worldY,
                );

        this.paintPreview.setPosition(
            previewPoint.x,
            previewPoint.y,
        );

        this.redrawPaintPreview();
        this.paintPreview
            .setAlpha(
                this.mobilePendingPaintPointerId >=
                        0
                    ? 0.72
                    : 1,
            )
            .setVisible(true);
    }

    private updatePaintPreviewImmediately(): void {
        if (
            this.phase !== 'paint' ||
            !this.paintPreview
        ) {
            return;
        }

        const pointer = this.input.activePointer;

        const previewPoint =
            this.mobileControlsEnabled
                ? this.getPaintPreviewWorldPoint(
                    pointer,
                )
                : new Phaser.Math.Vector2(
                    pointer.worldX,
                    pointer.worldY,
                );

        this.paintPreview.setPosition(
            previewPoint.x,
            previewPoint.y,
        );

        this.redrawPaintPreview();
        this.paintPreview.setVisible(true);
    }

    private updateBrushSizeInput(): void {
        let brushSizeChanged = false;

        const increasePressed =
            Phaser.Input.Keyboard.JustDown(
                this.brushPlusKey,
            ) ||
            Phaser.Input.Keyboard.JustDown(
                this.brushNumpadPlusKey,
            );

        const decreasePressed =
            Phaser.Input.Keyboard.JustDown(
                this.brushMinusKey,
            ) ||
            Phaser.Input.Keyboard.JustDown(
                this.brushNumpadMinusKey,
            );

        if (increasePressed) {
            this.setBrushSize(
                this.brushSize + 1,
            );
            brushSizeChanged = true;
        }

        if (decreasePressed) {
            this.setBrushSize(
                this.brushSize - 1,
            );
            brushSizeChanged = true;
        }

        if (!brushSizeChanged) {
            return;
        }
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
        this.highlightBrushShape(
            this.brushShape,
        );
        this.updatePaintHud();
        this.updatePaintPreviewImmediately();
        this.updatePaintControlHelp();

        this.showStatus(
            tr(`${this.getBrushShapeLabel()} 브러시`),
        );
    }

    private getBrushShapeLabel(): string {
        if (
            this.brushShape ===
            'dotCircle'
        ) {
            return tr('DOT CIRCLE');
        }

        if (
            this.brushShape ===
            'circle'
        ) {
            return tr('SMOOTH CIRCLE');
        }

        return tr('SQUARE DOT');
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
            this.isMultiplayerSession() &&
            !this.networkPlayerManager
                .canLocalControlHunter()
        ) {
            this.aimLine.clear();
            this.crosshair.clear();
            this.gun.setVisible(false);
            return;
        }

        if (
            this.isMultiplayerSession() &&
            !this.networkPlayerManager
                .canLocalControlHunter()
        ) {
            this.aimLine.clear();
            this.crosshair.clear();
            this.gun.setVisible(false);
            return;
        }

        const origin =
            this.isMultiplayerSession()
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

        const usingMobileAim =
            this.mobileControlsEnabled &&
            this.networkPlayerManager
                .canLocalControlHunter() &&
            this.mobileAimHasDirection;

        const angle =
            usingMobileAim
                ? this.mobileAimAngle
                : Phaser.Math.Angle.Between(
                    origin.x,
                    origin.y,
                    pointer.worldX,
                    pointer.worldY,
                );

        this.hunterFocusAngle =
            angle;

        this.gun.setRotation(angle);

        if (
            this.isMultiplayerSession()
        ) {
            const now =
                this.time.now;

            this.networkPlayerManager
                .updateHunterAim(
                    multiplayerClient
                        .getSessionId() ?? '',
                    angle,
                    122,
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

        const lineLength = 122;

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

        if (usingMobileAim) {
            this.drawCrosshair(
                origin.x +
                    Math.cos(angle) *
                    lineLength,
                origin.y +
                    Math.sin(angle) *
                    lineLength,
            );
        } else {
            this.drawCrosshair(
                pointer.worldX,
                pointer.worldY,
            );
        }
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

    private fireShotgun(
        aimAngleOverride?: number,
    ): void {
        /*
         * POINTER_DOWN 이외의 경로/phase 전환 직후 이벤트가 들어와도
         * Hider는 절대로 shotgun SFX/발사 로직에 진입하지 않습니다.
         */
        if (
            this.isMultiplayerSession() &&
            !this.networkPlayerManager
                .canLocalControlHunter()
        ) {
            return;
        }

        if (
            this.isMultiplayerSession() &&
            this.phase === 'hunt' &&
            this.phaseEndTime > 0 &&
            this.time.now >=
                this.phaseEndTime
        ) {
            this.canShoot = false;
            this.clearAllAimingVisuals();
            return;
        }

        if (
            this.isMultiplayerSession() &&
            !this.networkPlayerManager
                .canLocalControlHunter()
        ) {
            return;
        }

        if (this.phase !== 'hunt') {
            return;
        }

        if (
            multiplayerClient.isConnected() &&
            !this.networkPlayerManager
                .canLocalControlHunter()
        ) {
            return;
        }

        if (!this.canShoot) {
            return;
        }

        if (
            this.isMultiplayerSession() &&
            this.hunterReserve <= 0
        ) {
            this.showStatus(
                tr('탄약 소진 · 남은 시간 동안 수색하세요'),
            );
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
                    tr('샷건이 과열되었습니다'),
                );
                return;
            }
        } else {
            if (this.isReloading) {
                this.showStatus(
                    tr('재장전 중입니다'),
                );
                return;
            }

            if (this.ammo <= 0) {
                this.showStatus(
                    tr('탄약이 없습니다. R 버튼을 눌러서 장전하세요'),
                );
                return;
            }

            this.ammo -= 1;
            this.updateAmmoText();
        }

        this.canShoot = false;

        if (
            !multiplayerClient.isConnected()
        ) {
            this.sound.play(
                'shotgun-blast',
                {
                    volume: 0.88,
                },
            );
        }

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

        const aimAngle =
            aimAngleOverride ??
            (
                this.mobileControlsEnabled &&
                this.networkPlayerManager
                    .canLocalControlHunter() &&
                this.mobileAimHasDirection
                    ? this.mobileAimAngle
                    : Phaser.Math.Angle.Between(
                        origin.x,
                        origin.y,
                        pointer.worldX,
                        pointer.worldY,
                    )
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
                tr('탄약 소진! R 키로 재장전'),
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
        if (
            shot.shooterId ===
                multiplayerClient.getSessionId() &&
            shot.precisionReward > 0
        ) {
            /*
             * Precision 숫자 표시는 직관적이지 않아 UI에서 제거했습니다.
             * 서버가 지급한 reserve 보상만 반영합니다.
             */
            this.hunterReserve =
                shot.reserve;
        }

        if (
            this.shotgunSound &&
            !this.shotgunSound.isPlaying
        ) {
            this.shotgunSound.play();
        } else {
            this.sound.play(
                'shotgun-blast',
                {
                    volume: 0.88,
                },
            );
        }
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

            if (
                multiplayerClient
                    .getLocalPlayer()
                    ?.role === 'hunter'
            ) {
                this.hunterHitConfirmSound?.play();
            }
        }

        if (
            shot.hitIds.includes(
                multiplayerClient.getSessionId() ?? '',
            ) &&
            multiplayerClient.getLocalPlayer()?.role === 'hider'
        ) {
            this.hitSound?.play();
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
            .setText(tr('FOUND!'))
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
                tr('이미 재장전 중입니다'),
            );

            return;
        }

        if (this.ammo === this.maxAmmo) {
            this.showStatus(
                tr('탄약이 이미 가득합니다'),
            );

            return;
        }

        this.isReloading = true;
        this.canShoot = false;

        this.updateAmmoText();
        this.showStatus(tr('재장전 중...'));

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
                this.showStatus(tr('재장전 완료!'));
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
                tr('Keyboard input is unavailable.'),
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
        this.brushPlusKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.PLUS,
        );

        this.brushMinusKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.MINUS,
        );

        this.brushNumpadPlusKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.NUMPAD_ADD,
        );

        this.brushNumpadMinusKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.NUMPAD_SUBTRACT,
        );

        this.brushShapeKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.B,
        );

        this.spectatorKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.TAB,
        );

        this.undoPaintKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.Z,
        );

        this.redoPaintKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.Y,
        );

        this.shiftPaintKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.SHIFT,
        );

        this.controlPaintKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.CTRL,
        );

        keyboard.addCapture([
            Phaser.Input.Keyboard.KeyCodes.TAB,
            Phaser.Input.Keyboard.KeyCodes.Z,
            Phaser.Input.Keyboard.KeyCodes.Y,
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
                    backgroundColor: 'rgba(255, 244, 214, 0.86)',
                    padding: {
                        x: 16,
                        y: 8,
                    },
                },
            )
            .setOrigin(0.5, 0)
            .setDepth(920);

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
                    backgroundColor: 'rgba(255, 244, 214, 0.86)',
                    padding: {
                        x: 14,
                        y: 7,
                    },
                },
            )
            .setOrigin(0.5, 0)
            .setDepth(3200);

        this.guideText = this.add
            .text(
                18,
                192,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '15px',
                    color: '#5b4636',
                    backgroundColor: 'rgba(255, 244, 214, 0.86)',
                    padding: {
                        x: 12,
                        y: 7,
                    },
                },
            )
            .setOrigin(0, 0)
            .setDepth(300);

        this.statusText = this.add
            .text(
                this.gameWidth / 2,
                150,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: 'rgba(255, 244, 214, 0.86)',
                    padding: {
                        x: 10,
                        y: 6,
                    },
                },
            )
            .setOrigin(0.5)
            .setDepth(300)
            .setVisible(false);

        /*
         * 기존 ammoText는 오프라인 테스트 호환용으로만 남기고
         * Multiplayer Hunt에서는 보이지 않게 합니다.
         */
        this.ammoText = this.add
            .text(
                18,
                76,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                },
            )
            .setOrigin(0, 0)
            .setDepth(5000)
            .setScrollFactor(0)
            .setVisible(false);

        this.hunterAmmoGraphics =
            this.add.graphics();

        this.hunterHeatGraphics =
            this.add.graphics();

        this.hunterHeatLabel =
            this.add.text(
                0,
                27,
                tr('HEAT'),
                {
                    fontFamily:
                        'monospace',
                    fontSize: '11px',
                    fontStyle: 'bold',
                    color: '#334139',
                },
            )
                .setOrigin(0, 0.5);

        this.hunterOverheatLabel =
            this.add.text(
                174,
                27,
                '',
                {
                    fontFamily:
                        'monospace',
                    fontSize: '10px',
                    fontStyle: 'bold',
                    color: '#d32f2f',
                },
            )
                .setOrigin(1, 0.5);

        const weaponHudBackground =
            this.add.rectangle(
                87,
                19,
                184,
                52,
                0xfff4d6,
                0.9,
            )
                .setOrigin(0.5)
                .setStrokeStyle(
                    1,
                    0x8d8066,
                    0.75,
                );

        this.hunterWeaponHudContainer =
            this.add.container(
                18,
                76,
                [
                    weaponHudBackground,
                    this.hunterAmmoGraphics,
                    this.hunterHeatGraphics,
                    this.hunterHeatLabel,
                    this.hunterOverheatLabel,
                ],
            )
                .setDepth(5000)
                .setScrollFactor(0)
                .setVisible(false);

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
                    backgroundColor: 'rgba(255, 244, 214, 0.86)',
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
                    backgroundColor: 'rgba(255, 244, 214, 0.86)',
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
                    backgroundColor: 'rgba(255, 244, 214, 0.86)',
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
        if (
            this.isMultiplayerSession()
        ) {
            this.ammoText
                .setText('')
                .setVisible(false);

            this.updateWeaponHeatHud();
            return;
        }

        if (this.isReloading) {
            this.ammoText.setText(
                tr('RELOADING...'),
            );

            this.ammoText.setColor('#ffdf70');
            return;
        }

        const loaded =
            '●'.repeat(this.ammo);

        const empty =
            '○'.repeat(
                this.maxAmmo -
                this.ammo,
            );

        /*
         * 오프라인 테스트 모드에서도 숫자식  대신
         * 탄환 아이콘만 표시합니다.
         */
        this.ammoText.setText(
            tr(`SHELLS ${loaded}${empty}`),
        );

        this.ammoText.setColor(
            '#26352b',
        );
    }

    private updateTargetText(): void {
        if (
            this.isMultiplayerSession()
        ) {
            this.targetText
                .setText('')
                .setVisible(false);
            return;
        }

        this.targetText.setText(
            tr(`HIDERS ${this.getAliveHiderCount()} / ${this.hiders.length}`),
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
            tr(`COLOR #${hexColor}`),
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
            tr(`BRUSH ${shapeText} ${this.brushSize}`),
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
            this.phase !== 'hunt' &&
            this.phase !== 'finished'
        ) {
            return;
        }

        if (this.phase === 'finished') {
            return;
        }

        const remainingMilliseconds =
            this.phaseEndTime - this.time.now;

        const remainingSeconds = Math.max(
            0,
            Math.ceil(remainingMilliseconds / 1000),
        );

        if (this.phase === 'paint') {
            const isHunter =
                this.isMultiplayerSession() &&
                this.networkPlayerManager
                    .isLocalHunter();

            if (isHunter) {
                /*
                 * Hunter는 중앙 대기 안내에 남은 시간이 표시되므로
                 * 상단 Paint 타이머 자체를 숨겨 배경 박스까지 제거합니다.
                 */
                this.timerText
                    .setText('')
                    .setVisible(false);
            } else {
                /*
                 * Hider는 상단 Paint 카운트를 계속 확인할 수 있습니다.
                 */
                this.timerText
                    .setVisible(true)
                    .setText(
                        tr(`PAINT ${remainingSeconds}`),
                    );
            }
        } else {
            this.timerText
                .setVisible(true)
                .setDepth(3200)
                .setText(
                    tr(`TIME ${remainingSeconds}`),
                );
        }

        this.timerText.setColor(
            remainingSeconds <= 5
                ? '#c62828'
                : '#1f2937',
        );

        if (
            this.phase === 'paint' &&
            this.isMultiplayerSession() &&
            this.networkPlayerManager
                .isLocalHunter() &&
            this.hunterBlindText?.visible
        ) {
            this.hunterBlindText.setText(
                [
                    tr('HIDERS ARE PAINTING...'),
                    tr('Hunter도 자신의 위장색을 칠해보세요.'),
                    tr(`게임 시작까지 ${remainingSeconds}초`),
                ].join('\n'),
            );
        }

        if (
            this.isMultiplayerSession()
        ) {
            if (
                remainingMilliseconds <= 0 &&
                this.time.now -
                    this.lastPhaseRecoveryAt >
                    350
            ) {
                this.lastPhaseRecoveryAt =
                    this.time.now;

                const serverPhase =
                    multiplayerClient
                        .getPhase();

                const serverEndsAt =
                    multiplayerClient
                        .getPhaseEndsAt();

                /*
                 * Schema callback can occasionally be missed/delayed in an
                 * online tab.  Re-apply authoritative server phase instead
                 * of leaving the UI frozen at PAINT 0 / TIME 0.
                 */
                if (
                    serverPhase !==
                    this.phase
                ) {
                    this.applyNetworkPhase(
                        serverPhase,
                        serverEndsAt,
                    );
                    return;
                }

                multiplayerClient
                    .requestLobbySnapshot();
            }

            if (
                remainingMilliseconds <= 0 &&
                this.phase === 'hunt'
            ) {
                /*
                 * 서버 결과가 도착하기 전의 짧은 네트워크 지연 구간에도
                 * 추가 사격/조준은 절대 허용하지 않습니다.
                 */
                this.timerText
                    .setText(tr('TIME 0'));

                this.canShoot = false;
                this.clearAllAimingVisuals();
                this.networkPlayerManager
                    .clearHunterAimLines();

                this.statusText
                    .setText('')
                    .setVisible(false);
            }

            return;
        }

        if (
            remainingMilliseconds > 0
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
        this.localPaintHistory = [];
        this.redoPaintHistory = [];
        this.currentStrokeHistoryPoints = [];
        this.clearMobilePendingPaint();
        this.straightLineStart = undefined;
        this.straightLineStartWorld =
            undefined;
        this.straightLineModeActive =
            false;
        this.clearStraightLinePreview();
        this.phase = 'paint';

        if (
            this.isMultiplayerSession()
        ) {
            this.paintDuration =
                Math.round(
                    multiplayerClient
                        .getPaintDurationMs() /
                    1000,
                );
        }
        this.syncPhaseMusic();
        this.hidePoints = 0;
        this.nextHeartbeatAt = 0;
        this.hideHuntTensionUi();

        this.timerText.setVisible(true);

        /*
         * 숨는 시간도 Hunt와 같은 기본 확대 배율을 사용합니다.
         */
        if (
            this.isMultiplayerSession()
        ) {
            this.paintWorldZoom =
                this.gameplayCameraZoom;

            this.cameras.main
                .stopFollow()
                .removeBounds()
                .setZoom(
                    this.paintWorldZoom,
                );

            this.applyFixedHudForZoom(
                this.paintWorldZoom,
            );

            this.centerPaintCameraOnLocalPlayer();
            this.networkPlayerManager
                .showOnlyLocalPlayer();

            const localPosition =
                this.networkPlayerManager
                    .getLocalPlayerPosition();

            if (localPosition) {
            }
        }

        this.phaseEndTime =
            this.time.now +
            this.paintDuration * 1000;

        this.selectedHiderIndex = 0;
        this.isPainting = false;
        this.paintColor =
            this.defaultPaintColor;

        if (
            this.isMultiplayerSession()
        ) {
            this.refreshHunterCamoPalette();
            this.applyRolePaintPalette(
                this.networkPlayerManager
                    .isLocalHunter(),
            );
            this.setHunterCamoPaletteVisible(
                false,
            );
        }

        this.createBrushTexture();

        this.phaseText
            .setText('')
            .setVisible(false);

        this.timerText.setVisible(true);

        this.guideText.setText(
            tr('배경색을 골라 캐릭터를 위장하세요.'),
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

        if (
            this.isMultiplayerSession()
        ) {
            this.hiders.forEach(
                (hider) => {
                    this.setHiderVisible(
                        hider,
                        false,
                    );

                    hider.label.setVisible(
                        false,
                    );
                },
            );

            this.selectionRing.setVisible(
                false,
            );
        } else {
            this.hiders.forEach(
                (hider) => {
                    this.setHiderVisible(
                        hider,
                        true,
                    );

                    hider.label.setVisible(
                        true,
                    );
                },
            );

            this.selectHider(0);
        }
        this.updatePaintHud();

        this.showStatus(
            tr(`${this.paintDuration}초 안에 위장하세요`),
        );

        this.input.setDefaultCursor('crosshair');
    }

    private startHunt(): void {
        this.hideMobilePaintPrecisionGuide();

        if (
            this.isMultiplayerSession()
        ) {
            this.huntDuration =
                Math.round(
                    multiplayerClient
                        .getHuntDurationMs() /
                    1000,
                );
        }

        this.spectatorSessionId = '';
        this.spectatorCycleIndex = -1;

        if (
            this.isMultiplayerSession()
        ) {
            this.networkPlayerManager
                .normalizeLocalPlayerForGameplay();
        }

        if (
            this.phase !== 'paint' &&
            !this.isMultiplayerSession()
        ) {
            return;
        }

        this.phase = 'hunt';
        this.syncPhaseMusic();

        if (this.isMultiplayerSession()) {
            this.hideLegacySinglePlayerActors();

            this.hiders.forEach(
                (hider) => {
                    this.setHiderVisible(
                        hider,
                        false,
                    );
                    hider.label.setVisible(
                        false,
                    );
                },
            );
        }

        this.timerText.setVisible(true);
        this.aimLine.setVisible(true);
        this.crosshair.setVisible(true);

        this.phaseEndTime =
            this.time.now +
            this.huntDuration * 1000;

        this.ammo = this.maxAmmo;
        this.hunterReserve = 12;
        this.hunterMaxReserve = 12;
        this.canShoot = true;
        this.isReloading = false;
        this.isPainting = false;

        this.phaseText
            .setText('')
            .setVisible(false);

        if (
            this.isMultiplayerSession()
        ) {
            const localRole =
                multiplayerClient
                    .getLocalPlayer()
                    ?.role;

            this.guideText.setText(
                localRole === 'hunter'
                    ? tr('WASD 이동 · 마우스 조준 · 좌클릭 발사')
                    : tr('WASD 이동'),
            );
        } else {
            this.guideText.setText(
                tr('WASD 이동 · 마우스 조준 · 좌클릭 발사'),
            );
        }

        if (
            this.isMultiplayerSession()
        ) {
            this.hideLegacySinglePlayerActors();

            this.targetText
                .setText('')
                .setVisible(false);
        } else {
            this.player.setPosition(
                100,
                this.gameHeight / 2,
            );

            this.updateHunterObjects();

            this.player
                .setActive(true)
                .setVisible(true);

            this.gun
                .setActive(true)
                .setVisible(true);

            this.hunterLabel
                .setActive(true)
                .setVisible(true);

            this.hunterVisuals.forEach(
                ({ object }) => object.setVisible(true),
            );
        }

        this.selectionRing.setVisible(false);
        this.paintPreview.setVisible(false);

        this.paintColorText.setVisible(false);
        this.brushSizeText.setVisible(false);

        const localIsHunter =
            !this.isMultiplayerSession() ||
            this.networkPlayerManager
                .canLocalControlHunter() ||
            multiplayerClient
                .getLocalPlayer()
                ?.role === 'hunter';

        this.ammoText.setVisible(
            localIsHunter,
        );

        this.targetText.setVisible(
            !this.isMultiplayerSession() &&
            localIsHunter,
        );

        this.hiders.forEach((hider) => {
            hider.label.setVisible(false);
        });

        this.updateAmmoText();
        this.updateTargetText();

        this.showStatus(
            tr(`${this.huntDuration}초 안에 하이더를 찾으세요`),
        );

        this.input.setDefaultCursor('none');
    }

    private showHunterVictory(): void {
        if (this.isMultiplayerSession()) {
            return;
        }

        if (this.phase !== 'hunt') {
            return;
        }

        this.phase = 'hunterVictory';
        this.stopAllBgm();
        this.victorySound?.play();

        this.phaseText.setText(
            tr('🏆 HUNTER VICTORY'),
        );

        this.timerText
            .setText(tr('HUNTER WIN'))
            .setColor('#ffdf70');

        this.guideText.setText(
            tr('모든 하이더를 발견했습니다 · 자동으로 대기실로 이동'),
        );

        this.player.setVisible(false);
        this.hunterVisuals.forEach(({ object }) => object.setVisible(false));
        this.gun.setVisible(false);
        this.hunterLabel.setVisible(false);

        this.aimLine.clear();
        this.crosshair.clear();

        this.showStatus(
            tr('모든 하이더를 찾았습니다!'),
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
            this.isMultiplayerSession()
        ) {
            return;
        }

        if (this.phase !== 'hunt') {
            return;
        }

        this.phase = 'hiderVictory';
        this.stopAllBgm();
        this.victorySound?.play();

        this.phaseText.setText(
            tr('🌿 HIDER VICTORY'),
        );

        this.timerText
            .setText(tr('HIDERS WIN'))
            .setColor('#8cff9b');

        this.guideText.setText(
            tr('시간 종료 · 자동으로 대기실로 이동'),
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
                .setText(tr('SURVIVED'))
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

        this.cameras.main.flash(
            350,
            100,
            255,
            140,
        );

        this.input.setDefaultCursor('default');
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

    private getCurrentBrushTextureKey(): string {
        return [
            'paint-brush',
            this.brushShape,
            String(this.brushSize),
            this.paintColor
                .toString(16)
                .padStart(6, '0'),
        ].join('-');
    }

    private createBrushTexture(force = false): void {
        this.brushTextureKey =
            this.getCurrentBrushTextureKey();

        if (
            this.textures.exists(
                this.brushTextureKey,
            )
        ) {
            if (!force) {
                return;
            }

            this.textures.remove(
                this.brushTextureKey,
            );
        }

        if (this.brushSize === 1) {
            const graphics =
                this.add.graphics();

            graphics.fillStyle(
                this.paintColor,
                1,
            );
            graphics.fillRect(
                0,
                0,
                1,
                1,
            );
            graphics.generateTexture(
                this.brushTextureKey,
                1,
                1,
            );
            this.textures
                .get(this.brushTextureKey)
                .setFilter(
                    Phaser.Textures
                        .FilterMode.NEAREST,
                );
            graphics.destroy();
            return;
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

        this.textures
            .get(this.brushTextureKey)
            .setFilter(
                Phaser.Textures.FilterMode.NEAREST,
            );

        graphics.destroy();
    }

}

export default GameScene;