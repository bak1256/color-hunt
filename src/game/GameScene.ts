import Phaser from 'phaser';

type GamePhase =
    | 'paint'
    | 'hunt'
    | 'hunterVictory'
    | 'hiderVictory';
type PartName = 'head' | 'body' | 'arms' | 'legs';

type HiderPartObject =
    | Phaser.GameObjects.Arc
    | Phaser.GameObjects.Rectangle;

type HiderPart = {
    object: HiderPartObject;
    color: number;
};

type Hider = {
    parts: {
        head: HiderPart;
        body: HiderPart;
        leftArm: HiderPart;
        rightArm: HiderPart;
        leftLeg: HiderPart;
        rightLeg: HiderPart;
    };
    label: Phaser.GameObjects.Text;
    alive: boolean;
    centerX: number;
    centerY: number;
};

type ColorZone = {
    object: Phaser.GameObjects.Rectangle;
    color: number;
};

type Obstacle = {
    object: Phaser.GameObjects.Rectangle;
    bounds: Phaser.Geom.Rectangle;
};

export class GameScene extends Phaser.Scene {
    private player!: Phaser.GameObjects.Rectangle;
    private gun!: Phaser.GameObjects.Rectangle;
    private hunterLabel!: Phaser.GameObjects.Text;

    private crosshair!: Phaser.GameObjects.Arc;
    private crosshairCenter!: Phaser.GameObjects.Arc;
    private aimLine!: Phaser.GameObjects.Graphics;

    private selectionRing!: Phaser.GameObjects.Arc;

    private ammoText!: Phaser.GameObjects.Text;
    private targetText!: Phaser.GameObjects.Text;
    private phaseText!: Phaser.GameObjects.Text;
    private guideText!: Phaser.GameObjects.Text;
    private selectedPartText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    private timerText!: Phaser.GameObjects.Text;

    private hiders: Hider[] = [];
    private colorZones: ColorZone[] = [];
    private obstacles: Obstacle[] = [];

    private selectedHiderIndex = 0;
    private selectedPart: PartName = 'body';
    private phase: GamePhase = 'paint';

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

    private wasd!: {
        W: Phaser.Input.Keyboard.Key;
        A: Phaser.Input.Keyboard.Key;
        S: Phaser.Input.Keyboard.Key;
        D: Phaser.Input.Keyboard.Key;
    };

    private reloadKey!: Phaser.Input.Keyboard.Key;
    private resetKey!: Phaser.Input.Keyboard.Key;
    private startKey!: Phaser.Input.Keyboard.Key;
    private nextHiderKey!: Phaser.Input.Keyboard.Key;
    private partKeys!: {
        ONE: Phaser.Input.Keyboard.Key;
        TWO: Phaser.Input.Keyboard.Key;
        THREE: Phaser.Input.Keyboard.Key;
        FOUR: Phaser.Input.Keyboard.Key;
    };

    private ammo = 5;
    private readonly maxAmmo = 5;

    private canShoot = true;
    private readonly shotCooldown = 450;

    private readonly pelletCount = 7;

    // 이전 단계에서 줄인 샷건 사정거리
    private readonly pelletRange = 150;

    private readonly shotgunSpread = Phaser.Math.DegToRad(30);

    private readonly playerSpeed = 250;
    private readonly hiderSpeed = 140;

    private readonly paintDuration = 20;
    private readonly huntDuration = 30;

    private phaseEndTime = 0;

    private readonly gameWidth = 960;
    private readonly gameHeight = 540;

    constructor() {
        super('GameScene');
    }

    create(): void {
        this.cameras.main.setBackgroundColor('#243447');

        this.createBackgroundZones();
        this.createGrid();
        this.createObstacles();
        this.createHunter();
        this.createHiders();
        this.createSelectionRing();
        this.createCrosshair();
        this.createKeyboardControls();
        this.createHud();
        this.registerInputEvents();

        this.enterPaintPhase();
    }

    update(_: number, delta: number): void {
        this.updateRoundTimer();

        if (this.phase === 'hunt') {
            this.updatePlayerMovement(delta);
            this.updateAim();

            if (Phaser.Input.Keyboard.JustDown(this.reloadKey)) {
                this.reload();
            }
        }

        if (this.phase === 'paint') {
            this.updatePartSelection();
            this.updateSelectedHiderMovement(delta);

            if (Phaser.Input.Keyboard.JustDown(this.nextHiderKey)) {
                this.selectNextHider();
            }

            if (Phaser.Input.Keyboard.JustDown(this.startKey)) {
                this.startHunt();
            }
        }

        if (Phaser.Input.Keyboard.JustDown(this.resetKey)) {
            this.resetGame();
        }
    }

    private updateSelectedHiderMovement(delta: number): void {
        const hider = this.hiders[this.selectedHiderIndex];

        if (!hider || !hider.alive) {
            return;
        }

        let directionX = 0;
        let directionY = 0;

        if (this.cursors.left.isDown || this.wasd.A.isDown) {
            directionX -= 1;
        }

        if (this.cursors.right.isDown || this.wasd.D.isDown) {
            directionX += 1;
        }

        if (this.cursors.up.isDown || this.wasd.W.isDown) {
            directionY -= 1;
        }

        if (this.cursors.down.isDown || this.wasd.S.isDown) {
            directionY += 1;
        }

        const direction = new Phaser.Math.Vector2(
            directionX,
            directionY,
        );

        if (direction.lengthSq() === 0) {
            return;
        }

        direction.normalize();

        const distance = this.hiderSpeed * (delta / 1000);

        const requestedX = direction.x * distance;
        const requestedY = direction.y * distance;

        const nextCenterX = Phaser.Math.Clamp(
            hider.centerX + requestedX,
            40,
            this.gameWidth - 40,
        );

        const nextCenterY = Phaser.Math.Clamp(
            hider.centerY + requestedY,
            75,
            this.gameHeight - 65,
        );

        const movementX = nextCenterX - hider.centerX;
        const movementY = nextCenterY - hider.centerY;

        this.moveHider(hider, movementX, movementY);
    }

    private moveHider(
        hider: Hider,
        movementX: number,
        movementY: number,
    ): void {
        if (movementX === 0 && movementY === 0) {
            return;
        }

        hider.centerX += movementX;
        hider.centerY += movementY;

        this.getAllPartObjects(hider).forEach((object) => {
            object.x += movementX;
            object.y += movementY;
        });

        hider.label.x += movementX;
        hider.label.y += movementY;

        if (this.isHiderTouchingObstacle(hider)) {
            hider.centerX -= movementX;
            hider.centerY -= movementY;

            this.getAllPartObjects(hider).forEach((object) => {
                object.x -= movementX;
                object.y -= movementY;
            });

            hider.label.x -= movementX;
            hider.label.y -= movementY;
        }

        if (hider === this.hiders[this.selectedHiderIndex]) {
            this.selectionRing.setPosition(
                hider.centerX,
                hider.centerY + 5,
            );
        }
    }

    private isHiderTouchingObstacle(
        hider: Hider,
    ): boolean {
        return this.getAllPartObjects(hider).some((part) => {
            const partBounds = part.getBounds();

            return this.obstacles.some((obstacle) =>
                Phaser.Geom.Intersects.RectangleToRectangle(
                    partBounds,
                    obstacle.bounds,
                ),
            );
        });
    }

    private selectNextHider(): void {
        const nextIndex =
            (this.selectedHiderIndex + 1) % this.hiders.length;

        this.selectHider(nextIndex);
    }
    private createBackgroundZones(): void {
        const zoneData = [
            {
                x: 160,
                y: 135,
                width: 280,
                height: 190,
                color: 0x4f7f52,
            },
            {
                x: 480,
                y: 135,
                width: 320,
                height: 190,
                color: 0x4b6f8f,
            },
            {
                x: 800,
                y: 135,
                width: 280,
                height: 190,
                color: 0x8a6545,
            },
            {
                x: 160,
                y: 405,
                width: 280,
                height: 270,
                color: 0x80638f,
            },
            {
                x: 480,
                y: 405,
                width: 320,
                height: 270,
                color: 0xb78a45,
            },
            {
                x: 800,
                y: 405,
                width: 280,
                height: 270,
                color: 0x65727c,
            },
        ];

        this.colorZones = zoneData.map((data) => {
            const object = this.add.rectangle(
                data.x,
                data.y,
                data.width,
                data.height,
                data.color,
            );

            object.setStrokeStyle(3, 0xffffff, 0.12);
            object.setDepth(0);
            object.setInteractive({ useHandCursor: true });

            object.on('pointerover', () => {
                if (this.phase !== 'paint') {
                    return;
                }

                object.setStrokeStyle(4, 0xffffff, 0.7);
            });

            object.on('pointerout', () => {
                object.setStrokeStyle(3, 0xffffff, 0.12);
            });

            object.on('pointerdown', () => {
                if (this.phase !== 'paint') {
                    return;
                }

                this.paintSelectedPart(data.color);
            });

            return {
                object,
                color: data.color,
            };
        });
    }

    private createGrid(): void {
        const graphics = this.add.graphics();

        graphics.lineStyle(1, 0xffffff, 0.07);
        graphics.setDepth(1);

        for (let x = 0; x <= this.gameWidth; x += 40) {
            graphics.lineBetween(x, 0, x, this.gameHeight);
        }

        for (let y = 0; y <= this.gameHeight; y += 40) {
            graphics.lineBetween(0, y, this.gameWidth, y);
        }
    }

    private createObstacles(): void {
        const obstacleData = [
            {
                x: 290,
                y: 210,
                width: 120,
                height: 32,
            },
            {
                x: 650,
                y: 240,
                width: 32,
                height: 150,
            },
            {
                x: 340,
                y: 410,
                width: 150,
                height: 35,
            },
            {
                x: 790,
                y: 390,
                width: 110,
                height: 40,
            },
        ];

        this.obstacles = obstacleData.map((data) => {
            const object = this.add.rectangle(
                data.x,
                data.y,
                data.width,
                data.height,
                0x30343b,
            );

            object.setStrokeStyle(4, 0x111111);
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

    private createHunter(): void {
        this.player = this.add.rectangle(
            this.gameWidth / 2,
            this.gameHeight / 2,
            40,
            55,
            0xffc857,
        );

        this.player.setStrokeStyle(3, 0xffffff);
        this.player.setDepth(10);

        this.gun = this.add.rectangle(
            this.player.x,
            this.player.y,
            48,
            12,
            0x2b2b2b,
        );

        this.gun.setOrigin(0, 0.5);
        this.gun.setStrokeStyle(2, 0xffffff);
        this.gun.setDepth(11);

        this.hunterLabel = this.add
            .text(this.player.x, this.player.y - 48, 'HUNTER', {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#00000080',
                padding: {
                    x: 6,
                    y: 3,
                },
            })
            .setOrigin(0.5)
            .setDepth(12);

        this.aimLine = this.add.graphics();
        this.aimLine.setDepth(8);
    }

    private createHiders(): void {
        const positions = [
            { x: 170, y: 145 },
            { x: 760, y: 155 },
            { x: 720, y: 415 },
        ];

        this.hiders = positions.map((position, index) =>
            this.createHider(position.x, position.y, index),
        );
    }

    private createHider(
        x: number,
        y: number,
        index: number,
    ): Hider {
        const head = this.add.circle(x, y - 35, 13, 0xffffff);
        const body = this.add.rectangle(x, y, 28, 42, 0xffffff);

        const leftArm = this.add.rectangle(
            x - 22,
            y,
            12,
            38,
            0xffffff,
        );

        const rightArm = this.add.rectangle(
            x + 22,
            y,
            12,
            38,
            0xffffff,
        );

        const leftLeg = this.add.rectangle(
            x - 9,
            y + 38,
            12,
            34,
            0xffffff,
        );

        const rightLeg = this.add.rectangle(
            x + 9,
            y + 38,
            12,
            34,
            0xffffff,
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
            object.setStrokeStyle(2, 0xe2e8f0, 0.9);
            object.setDepth(5);
            object.setInteractive({ useHandCursor: true });
        });

        const label = this.add
            .text(x, y - 65, `HIDER ${index + 1}`, {
                fontFamily: 'Arial',
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: '#000000aa',
                padding: {
                    x: 7,
                    y: 4,
                },
            })
            .setOrigin(0.5)
            .setDepth(7);

        const hider: Hider = {
            parts: {
                head: {
                    object: head,
                    color: 0xffffff,
                },
                body: {
                    object: body,
                    color: 0xffffff,
                },
                leftArm: {
                    object: leftArm,
                    color: 0xffffff,
                },
                rightArm: {
                    object: rightArm,
                    color: 0xffffff,
                },
                leftLeg: {
                    object: leftLeg,
                    color: 0xffffff,
                },
                rightLeg: {
                    object: rightLeg,
                    color: 0xffffff,
                },
            },
            label,
            alive: true,
            centerX: x,
            centerY: y,
        };

        objects.forEach((object) => {
            object.on('pointerdown', () => {
                if (this.phase !== 'paint' || !hider.alive) {
                    return;
                }

                this.selectHider(index);
            });

            object.on('pointerover', () => {
                if (this.phase !== 'paint' || !hider.alive) {
                    return;
                }

                object.setScale(1.1);
            });

            object.on('pointerout', () => {
                if (this.phase !== 'paint' || !hider.alive) {
                    return;
                }

                object.setScale(1);
            });
        });

        return hider;
    }

    private createSelectionRing(): void {
        this.selectionRing = this.add.circle(
            0,
            0,
            48,
            0xffff00,
            0,
        );

        this.selectionRing.setStrokeStyle(3, 0xffff00, 1);
        this.selectionRing.setDepth(6);

        this.tweens.add({
            targets: this.selectionRing,
            scale: 1.08,
            alpha: 0.35,
            duration: 650,
            yoyo: true,
            repeat: -1,
        });
    }

    private createCrosshair(): void {
        this.crosshair = this.add.circle(
            0,
            0,
            10,
            0xff4d4d,
            0,
        );

        this.crosshair.setStrokeStyle(2, 0xff4d4d);
        this.crosshair.setDepth(20);

        this.crosshairCenter = this.add.circle(
            0,
            0,
            2,
            0xff4d4d,
        );

        this.crosshairCenter.setDepth(21);
    }

    private createKeyboardControls(): void {
        if (!this.input.keyboard) {
            throw new Error('Keyboard input is not available.');
        }

        this.cursors = this.input.keyboard.createCursorKeys();

        this.wasd = this.input.keyboard.addKeys({
            W: Phaser.Input.Keyboard.KeyCodes.W,
            A: Phaser.Input.Keyboard.KeyCodes.A,
            S: Phaser.Input.Keyboard.KeyCodes.S,
            D: Phaser.Input.Keyboard.KeyCodes.D,
        }) as typeof this.wasd;

        this.reloadKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.R,
        );

        this.resetKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.N,
        );

        this.startKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.ENTER,
        );

        this.nextHiderKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.TAB,
        );

        this.nextHiderKey.on('down', (event: KeyboardEvent) => {
            event.preventDefault();
        });

        this.partKeys = this.input.keyboard.addKeys({
            ONE: Phaser.Input.Keyboard.KeyCodes.ONE,
            TWO: Phaser.Input.Keyboard.KeyCodes.TWO,
            THREE: Phaser.Input.Keyboard.KeyCodes.THREE,
            FOUR: Phaser.Input.Keyboard.KeyCodes.FOUR,
        }) as typeof this.partKeys;

    }

    private createHud(): void {
        this.phaseText = this.add
            .text(this.gameWidth / 2, 18, '', {
                fontFamily: 'Arial',
                fontSize: '24px',
                fontStyle: 'bold',
                color: '#ffffff',
                backgroundColor: '#000000bb',
                padding: {
                    x: 16,
                    y: 8,
                },
            })
            .setOrigin(0.5, 0)
            .setDepth(40);

        this.guideText = this.add
            .text(20, 20, '', {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#00000099',
                padding: {
                    x: 12,
                    y: 8,
                },
            })
            .setDepth(40);

        this.selectedPartText = this.add
            .text(20, 78, '', {
                fontFamily: 'Arial',
                fontSize: '18px',
                fontStyle: 'bold',
                color: '#ffff66',
                backgroundColor: '#00000099',
                padding: {
                    x: 12,
                    y: 8,
                },
            })
            .setDepth(40);

        this.ammoText = this.add
            .text(this.gameWidth - 24, 20, '', {
                fontFamily: 'Arial',
                fontSize: '24px',
                fontStyle: 'bold',
                color: '#ffffff',
                backgroundColor: '#00000099',
                padding: {
                    x: 14,
                    y: 9,
                },
            })
            .setOrigin(1, 0)
            .setDepth(40);

        this.targetText = this.add
            .text(this.gameWidth - 24, 100, '', {
                fontFamily: 'Arial',
                fontSize: '20px',
                fontStyle: 'bold',
                color: '#ffffff',
                backgroundColor: '#00000099',
                padding: {
                    x: 14,
                    y: 9,
                },
            })
            .setOrigin(1, 0)
            .setDepth(40);

        this.statusText = this.add
            .text(this.gameWidth / 2, this.gameHeight - 38, '', {
                fontFamily: 'Arial',
                fontSize: '21px',
                fontStyle: 'bold',
                color: '#ffdf70',
                backgroundColor: '#000000cc',
                padding: {
                    x: 18,
                    y: 10,
                },
            })
            .setOrigin(0.5)
            .setDepth(50)
            .setVisible(false);

        this.timerText = this.add
            .text(this.gameWidth / 2, 70, '', {
                fontFamily: 'Arial',
                fontSize: '28px',
                fontStyle: 'bold',
                color: '#ffffff',
                backgroundColor: '#000000bb',
                padding: {
                    x: 16,
                    y: 8,
                },
            })
            .setOrigin(0.5, 0)
            .setDepth(40);
        this.updateAmmoText();
        this.updateTargetText();
        this.updateSelectedPartText();
    }

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
            Math.ceil(remainingMilliseconds / 1000),
        );

        this.timerText.setText(
            `TIME ${remainingSeconds}`,
        );

        if (remainingSeconds <= 5) {
            this.timerText.setColor('#ff5c5c');
        } else {
            this.timerText.setColor('#ffffff');
        }

        if (remainingMilliseconds > 0) {
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

    private registerInputEvents(): void {
        this.input.on(
            'pointerdown',
            (pointer: Phaser.Input.Pointer) => {
                if (this.phase !== 'hunt') {
                    return;
                }

                if (!pointer.leftButtonDown()) {
                    return;
                }

                this.fireShotgun(pointer.worldX, pointer.worldY);
            },
        );
    }

    private enterPaintPhase(): void {
        this.phase = 'paint';
        this.phaseEndTime =
            this.time.now + this.paintDuration * 1000;
        this.selectedHiderIndex = 0;
        this.selectedPart = 'body';

        this.player.setVisible(false);
        this.gun.setVisible(false);
        this.hunterLabel.setVisible(false);
        this.aimLine.setVisible(false);

        this.crosshair.setVisible(false);
        this.crosshairCenter.setVisible(false);

        this.ammoText.setVisible(false);
        this.targetText.setVisible(true);
        this.selectionRing.setVisible(true);
        this.selectedPartText.setVisible(true);

        this.hiders.forEach((hider, index) => {
            this.getAllPartObjects(hider).forEach((object) => {
                object.setInteractive({ useHandCursor: true });
            });

            hider.label
                .setVisible(true)
                .setColor('#ffffff')
                .setText(`HIDER ${index + 1}`);
        });

        this.colorZones.forEach((zone) => {
            zone.object.setInteractive({ useHandCursor: true });
        });

        this.selectHider(0);
        this.updateSelectedPartText();

        this.phaseText.setText('🎨 CAMOUFLAGE PHASE');

        this.guideText.setText(
            'WASD 이동 · Tab 변경 · 1~4 부위 선택 · Enter 즉시 시작',
        );

        this.input.setDefaultCursor('default');

        this.updateTargetText();
        this.showStatus(
            `${this.paintDuration}초 안에 위장하고 숨으세요`,
        );
    }

    private updatePartSelection(): void {
        if (Phaser.Input.Keyboard.JustDown(this.partKeys.ONE)) {
            this.selectPart('head');
        }

        if (Phaser.Input.Keyboard.JustDown(this.partKeys.TWO)) {
            this.selectPart('body');
        }

        if (Phaser.Input.Keyboard.JustDown(this.partKeys.THREE)) {
            this.selectPart('arms');
        }

        if (Phaser.Input.Keyboard.JustDown(this.partKeys.FOUR)) {
            this.selectPart('legs');
        }
    }

    private selectPart(part: PartName): void {
        this.selectedPart = part;
        this.updateSelectedPartText();

        this.showStatus(
            `${this.getPartDisplayName(part)} 선택`,
        );
    }

    private selectHider(index: number): void {
        const hider = this.hiders[index];

        if (!hider || !hider.alive) {
            return;
        }

        this.selectedHiderIndex = index;

        this.selectionRing.setPosition(
            hider.centerX,
            hider.centerY + 5,
        );

        this.hiders.forEach((currentHider, currentIndex) => {
            if (currentIndex === index) {
                currentHider.label.setColor('#ffff66');
                currentHider.label.setText(
                    `HIDER ${currentIndex + 1} · SELECTED`,
                );
            } else {
                currentHider.label.setColor('#ffffff');
                currentHider.label.setText(
                    `HIDER ${currentIndex + 1}`,
                );
            }
        });

        this.updateSelectedPartText();
        this.showStatus(`HIDER ${index + 1} 선택`);
    }

    private paintSelectedPart(color: number): void {
        const hider = this.hiders[this.selectedHiderIndex];

        if (!hider || !hider.alive) {
            return;
        }

        const parts = this.getSelectedParts(hider);

        parts.forEach((part) => {
            part.color = color;
            part.object.setFillStyle(color);
            part.object.setStrokeStyle(2, 0xffffff, 0.25);

            this.tweens.add({
                targets: part.object,
                scale: 1.2,
                duration: 100,
                yoyo: true,
                ease: 'Quad.easeOut',
            });
        });

        const colorText = `#${color
            .toString(16)
            .padStart(6, '0')
            .toUpperCase()}`;

        this.showStatus(
            `HIDER ${this.selectedHiderIndex + 1} ${this.getPartDisplayName(
                this.selectedPart,
            )}: ${colorText}`,
        );
    }

    private getSelectedParts(hider: Hider): HiderPart[] {
        switch (this.selectedPart) {
            case 'head':
                return [hider.parts.head];

            case 'body':
                return [hider.parts.body];

            case 'arms':
                return [
                    hider.parts.leftArm,
                    hider.parts.rightArm,
                ];

            case 'legs':
                return [
                    hider.parts.leftLeg,
                    hider.parts.rightLeg,
                ];
        }
    }

    private getPartDisplayName(part: PartName): string {
        switch (part) {
            case 'head':
                return '머리';

            case 'body':
                return '몸통';

            case 'arms':
                return '팔';

            case 'legs':
                return '다리';
        }
    }

    private updateSelectedPartText(): void {
        this.selectedPartText.setText(
            `선택: HIDER ${this.selectedHiderIndex + 1} / ${this.getPartDisplayName(
                this.selectedPart,
            )}`,
        );
    }

    private startHunt(): void {
        if (this.phase !== 'paint') {
            return;
        }

        this.phase = 'hunt';

        this.phaseEndTime =
            this.time.now + this.huntDuration * 1000;

        this.canShoot = true;

        this.player.setPosition(
            this.gameWidth / 2,
            this.gameHeight / 2,
        );

        this.gun.setPosition(
            this.player.x,
            this.player.y,
        );

        this.hunterLabel.setPosition(
            this.player.x,
            this.player.y - 48,
        );

        this.player.setVisible(true);
        this.gun.setVisible(true);
        this.hunterLabel.setVisible(true);
        this.aimLine.setVisible(true);

        this.crosshair.setVisible(true);
        this.crosshairCenter.setVisible(true);

        this.ammoText.setVisible(true);
        this.targetText.setVisible(true);
        this.selectionRing.setVisible(false);
        this.selectedPartText.setVisible(false);

        this.hiders.forEach((hider) => {
            this.getAllPartObjects(hider).forEach((object) => {
                object.disableInteractive();
                object.setScale(1);
            });

            hider.label.setVisible(false);
        });

        this.colorZones.forEach((zone) => {
            zone.object.disableInteractive();
            zone.object.setStrokeStyle(3, 0xffffff, 0.12);
        });

        this.phaseText.setText('🔫 HUNT PHASE');

        this.guideText.setText(
            'WASD 이동 · Tab 하이더 변경 · 1 머리 · 2 몸통 · 3 팔 · 4 다리 · Enter 사냥',
        );

        this.input.setDefaultCursor('none');

        this.showStatus(
            `${this.huntDuration}초 안에 하이더를 찾으세요`,
        );
    }

    private updatePlayerMovement(delta: number): void {
        let directionX = 0;
        let directionY = 0;

        if (this.cursors.left.isDown || this.wasd.A.isDown) {
            directionX -= 1;
        }

        if (this.cursors.right.isDown || this.wasd.D.isDown) {
            directionX += 1;
        }

        if (this.cursors.up.isDown || this.wasd.W.isDown) {
            directionY -= 1;
        }

        if (this.cursors.down.isDown || this.wasd.S.isDown) {
            directionY += 1;
        }

        const direction = new Phaser.Math.Vector2(
            directionX,
            directionY,
        );

        if (direction.lengthSq() > 0) {
            direction.normalize();

            const distance = this.playerSpeed * (delta / 1000);

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
        }

        this.gun.setPosition(this.player.x, this.player.y);

        this.hunterLabel.setPosition(
            this.player.x,
            this.player.y - 48,
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

    private updateAim(): void {
        const pointer = this.input.activePointer;

        const mouseX = pointer.worldX;
        const mouseY = pointer.worldY;

        const aimAngle = Phaser.Math.Angle.Between(
            this.player.x,
            this.player.y,
            mouseX,
            mouseY,
        );

        this.gun.setRotation(aimAngle);
        this.crosshair.setPosition(mouseX, mouseY);
        this.crosshairCenter.setPosition(mouseX, mouseY);

        this.drawAimLine(mouseX, mouseY, aimAngle);
    }

    private drawAimLine(
        mouseX: number,
        mouseY: number,
        aimAngle: number,
    ): void {
        this.aimLine.clear();
        this.aimLine.lineStyle(1, 0xffffff, 0.2);

        const distance = Phaser.Math.Distance.Between(
            this.player.x,
            this.player.y,
            mouseX,
            mouseY,
        );

        const visibleDistance = Math.min(
            distance,
            this.pelletRange,
        );

        const dashLength = 8;
        const gapLength = 8;

        for (
            let current = 55;
            current < visibleDistance;
            current += dashLength + gapLength
        ) {
            const startX =
                this.player.x + Math.cos(aimAngle) * current;

            const startY =
                this.player.y + Math.sin(aimAngle) * current;

            const endDistance = Math.min(
                current + dashLength,
                visibleDistance,
            );

            const endX =
                this.player.x + Math.cos(aimAngle) * endDistance;

            const endY =
                this.player.y + Math.sin(aimAngle) * endDistance;

            this.aimLine.lineBetween(
                startX,
                startY,
                endX,
                endY,
            );
        }
    }

    private fireShotgun(
        targetX: number,
        targetY: number,
    ): void {
        if (!this.canShoot || this.phase !== 'hunt') {
            return;
        }

        if (this.ammo <= 0) {
            this.showStatus('탄약이 없습니다! R 키로 재장전');
            this.cameras.main.shake(80, 0.002);
            return;
        }

        this.canShoot = false;
        this.ammo -= 1;

        this.updateAmmoText();

        const aimAngle = Phaser.Math.Angle.Between(
            this.player.x,
            this.player.y,
            targetX,
            targetY,
        );

        const muzzleDistance = 48;

        const muzzleX =
            this.player.x + Math.cos(aimAngle) * muzzleDistance;

        const muzzleY =
            this.player.y + Math.sin(aimAngle) * muzzleDistance;

        this.createMuzzleFlash(muzzleX, muzzleY);

        const hitHiders = this.createPellets(
            muzzleX,
            muzzleY,
            aimAngle,
        );

        hitHiders.forEach((hider) => {
            this.hitHider(hider);
        });

        this.cameras.main.shake(110, 0.006);

        this.time.delayedCall(this.shotCooldown, () => {
            this.canShoot = true;
        });

        if (this.getAliveHiderCount() === 0) {
            this.showVictory();
        } else if (this.ammo === 0) {
            this.showStatus('탄약 소진! R 키로 재장전');
        }
    }

    private createPellets(
        startX: number,
        startY: number,
        centerAngle: number,
    ): Set<Hider> {
        const pelletGraphics = this.add.graphics();
        pelletGraphics.setDepth(15);

        const hitHiders = new Set<Hider>();
        const halfSpread = this.shotgunSpread / 2;

        for (
            let index = 0;
            index < this.pelletCount;
            index += 1
        ) {
            const ratio = index / (this.pelletCount - 1);

            const spreadOffset = Phaser.Math.Linear(
                -halfSpread,
                halfSpread,
                ratio,
            );

            const randomOffset = Phaser.Math.FloatBetween(
                -0.025,
                0.025,
            );

            const pelletAngle =
                centerAngle + spreadOffset + randomOffset;

            const range = Phaser.Math.Between(
                Math.floor(this.pelletRange * 0.82),
                this.pelletRange,
            );

            const originalEndX =
                startX + Math.cos(pelletAngle) * range;

            const originalEndY =
                startY + Math.sin(pelletAngle) * range;

            const blockedPoint = this.getBlockedPelletEnd(
                startX,
                startY,
                originalEndX,
                originalEndY,
            );

            const endX = blockedPoint.x;
            const endY = blockedPoint.y;

            pelletGraphics.lineStyle(2, 0xffe08a, 0.9);
            pelletGraphics.lineBetween(
                startX,
                startY,
                endX,
                endY,
            );

            pelletGraphics.fillStyle(0xffb347, 0.8);
            pelletGraphics.fillCircle(endX, endY, 3);

            const pelletLine = new Phaser.Geom.Line(
                startX,
                startY,
                endX,
                endY,
            );

            this.hiders.forEach((hider) => {
                if (!hider.alive) {
                    return;
                }

                if (this.isHiderHitByLine(hider, pelletLine)) {
                    hitHiders.add(hider);
                }
            });
        }

        this.tweens.add({
            targets: pelletGraphics,
            alpha: 0,
            duration: 130,
            ease: 'Quad.easeOut',
            onComplete: () => {
                pelletGraphics.destroy();
            },
        });

        return hitHiders;
    }

    private getBlockedPelletEnd(
        startX: number,
        startY: number,
        endX: number,
        endY: number,
    ): Phaser.Math.Vector2 {
        const distance = Phaser.Math.Distance.Between(
            startX,
            startY,
            endX,
            endY,
        );

        const stepSize = 4;
        const stepCount = Math.ceil(distance / stepSize);

        for (let step = 1; step <= stepCount; step += 1) {
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

            const isBlocked = this.obstacles.some((obstacle) =>
                Phaser.Geom.Rectangle.Contains(
                    obstacle.bounds,
                    currentX,
                    currentY,
                ),
            );

            if (isBlocked) {
                return new Phaser.Math.Vector2(
                    currentX,
                    currentY,
                );
            }
        }

        return new Phaser.Math.Vector2(endX, endY);
    }

    private isHiderHitByLine(
        hider: Hider,
        line: Phaser.Geom.Line,
    ): boolean {
        return this.getAllPartObjects(hider).some((object) => {
            const bounds = object.getBounds();

            return Phaser.Geom.Intersects.LineToRectangle(
                line,
                bounds,
            );
        });
    }

    private hitHider(hider: Hider): void {
        if (!hider.alive) {
            return;
        }

        hider.alive = false;

        const objects = this.getAllPartObjects(hider);

        objects.forEach((object) => {
            object.setFillStyle(0xff3b3b);
            object.setStrokeStyle(2, 0xffffff);
        });

        this.tweens.add({
            targets: objects,
            alpha: 0,
            scale: 1.5,
            duration: 350,
            ease: 'Back.easeIn',
            onComplete: () => {
                objects.forEach((object) => {
                    object.setVisible(false);
                });
            },
        });

        this.updateTargetText();
    }

    private createMuzzleFlash(x: number, y: number): void {
        const flash = this.add.circle(
            x,
            y,
            15,
            0xfff1a8,
            1,
        );

        const outerFlash = this.add.circle(
            x,
            y,
            25,
            0xff8c42,
            0.45,
        );

        flash.setDepth(16);
        outerFlash.setDepth(15);

        this.tweens.add({
            targets: [flash, outerFlash],
            scale: 1.7,
            alpha: 0,
            duration: 100,
            ease: 'Quad.easeOut',
            onComplete: () => {
                flash.destroy();
                outerFlash.destroy();
            },
        });
    }

    private reload(): void {
        if (this.phase !== 'hunt') {
            return;
        }

        if (this.ammo === this.maxAmmo) {
            this.showStatus('이미 탄약이 가득합니다');
            return;
        }

        this.ammo = this.maxAmmo;

        this.updateAmmoText();
        this.showStatus('재장전 완료!');
    }

    private resetGame(): void {
        this.ammo = this.maxAmmo;
        this.canShoot = true;

        this.hiders.forEach((hider, index) => {
            hider.alive = true;

            const parts = [
                hider.parts.head,
                hider.parts.body,
                hider.parts.leftArm,
                hider.parts.rightArm,
                hider.parts.leftLeg,
                hider.parts.rightLeg,
            ];

            parts.forEach((part) => {
                part.color = 0xffffff;

                part.object
                    .setVisible(true)
                    .setAlpha(1)
                    .setScale(1)
                    .setFillStyle(0xffffff)
                    .setStrokeStyle(2, 0xe2e8f0, 0.9);
            });

            hider.label
                .setVisible(true)
                .setAlpha(1)
                .setColor('#ffffff')
                .setText(`HIDER ${index + 1}`);
        });

        this.updateAmmoText();
        this.updateTargetText();
        this.enterPaintPhase();
    }

    private getAllPartObjects(
        hider: Hider,
    ): HiderPartObject[] {
        return [
            hider.parts.head.object,
            hider.parts.body.object,
            hider.parts.leftArm.object,
            hider.parts.rightArm.object,
            hider.parts.leftLeg.object,
            hider.parts.rightLeg.object,
        ];
    }

    private getAliveHiderCount(): number {
        return this.hiders.filter((hider) => hider.alive).length;
    }

    private updateAmmoText(): void {
        const shells = '●'.repeat(this.ammo);

        const emptyShells = '○'.repeat(
            this.maxAmmo - this.ammo,
        );

        this.ammoText.setText(
            `AMMO ${this.ammo} / ${this.maxAmmo}\n${shells}${emptyShells}`,
        );
    }

    private updateTargetText(): void {
        this.targetText.setText(
            `TARGETS ${this.getAliveHiderCount()} / ${this.hiders.length}`,
        );
    }

    private showVictory(): void {
        this.phase = 'hunterVictory';

        this.phaseText.setText('🏆 HUNTER VICTORY');
        this.timerText.setText('HUNTER WIN');
        this.timerText.setColor('#ffdf70');

        this.guideText.setText(
            '모든 하이더 발견 · N 키로 새 게임',
        );

        this.crosshair.setVisible(false);
        this.crosshairCenter.setVisible(false);
        this.aimLine.clear();

        this.player.setVisible(false);
        this.gun.setVisible(false);
        this.hunterLabel.setVisible(false);

        this.showStatus('모든 하이더를 찾았습니다!');

        this.cameras.main.flash(
            350,
            255,
            255,
            255,
        );

        this.input.setDefaultCursor('default');
    }

    private showHiderVictory(): void {
        if (this.phase !== 'hunt') {
            return;
        }

        this.phase = 'hiderVictory';

        this.phaseText.setText('🌿 HIDER VICTORY');
        this.timerText.setText('HIDERS WIN');
        this.timerText.setColor('#8cff9b');

        this.guideText.setText(
            '시간 종료 · N 키로 새 게임',
        );

        this.crosshair.setVisible(false);
        this.crosshairCenter.setVisible(false);
        this.aimLine.clear();

        this.player.setVisible(false);
        this.gun.setVisible(false);
        this.hunterLabel.setVisible(false);

        this.hiders.forEach((hider) => {
            if (!hider.alive) {
                return;
            }

            hider.label
                .setVisible(true)
                .setText('SURVIVED')
                .setColor('#8cff9b');

            this.getAllPartObjects(hider).forEach((object) => {
                object.setVisible(true);

                this.tweens.add({
                    targets: object,
                    scale: 1.25,
                    duration: 250,
                    yoyo: true,
                    repeat: 2,
                });
            });
        });

        this.showStatus(
            `${this.getAliveHiderCount()}명의 하이더가 살아남았습니다!`,
        );

        this.cameras.main.flash(
            350,
            100,
            255,
            140,
        );

        this.input.setDefaultCursor('default');
    }

    private showStatus(message: string): void {
        this.statusText.setText(message);
        this.statusText.setVisible(true);
        this.statusText.setAlpha(1);

        this.tweens.killTweensOf(this.statusText);

        this.tweens.add({
            targets: this.statusText,
            alpha: 0,
            delay: 1300,
            duration: 400,
            onComplete: () => {
                this.statusText.setVisible(false);
            },
        });
    }
}