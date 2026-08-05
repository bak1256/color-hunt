import Phaser from 'phaser';

type GamePhase =
    | 'paint'
    | 'hunt'
    | 'hunterVictory'
    | 'hiderVictory';

type BrushShape = 'circle' | 'square';

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

    private phase: GamePhase = 'paint';

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

    private startKey!: Phaser.Input.Keyboard.Key;
    private reloadKey!: Phaser.Input.Keyboard.Key;
    private resetKey!: Phaser.Input.Keyboard.Key;
    private nextHiderKey!: Phaser.Input.Keyboard.Key;

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
    private readonly defaultPaintColor = 0xff0000;
    private paintColor = this.defaultPaintColor;

    private brushSize = 10;
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
        this.createPointerControls();

        this.enterPaintPhase();
    }

    update(_: number, delta: number): void {
        this.updateRoundTimer();

        if (this.phase === 'paint') {
            this.updateSelectedHiderMovement(delta);
            this.updateBrushSizeInput();

            if (
                Phaser.Input.Keyboard.JustDown(
                    this.brushShapeKey,
                )
            ) {
                this.toggleBrushShape();
            }

            if (
                Phaser.Input.Keyboard.JustDown(
                    this.nextHiderKey,
                )
            ) {
                this.selectNextHider();
            }

            if (
                Phaser.Input.Keyboard.JustDown(this.startKey)
            ) {
                this.startHunt();
            }
        }

        if (this.phase === 'hunt') {
            this.updateHunterMovement(delta);
            this.updateAim();

            if (
                Phaser.Input.Keyboard.JustDown(this.reloadKey)
            ) {
                this.reload();
            }
        }

        if (
            Phaser.Input.Keyboard.JustDown(this.resetKey)
        ) {
            this.resetGame();
        }
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

    private selectNextHider(): void {
        if (this.hiders.length === 0) {
            return;
        }

        let nextIndex =
            (this.selectedHiderIndex + 1) %
            this.hiders.length;

        for (
            let count = 0;
            count < this.hiders.length;
            count += 1
        ) {
            if (this.hiders[nextIndex].alive) {
                this.selectHider(nextIndex);
                return;
            }

            nextIndex =
                (nextIndex + 1) %
                this.hiders.length;
        }
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

    private createPaintTools(): void {
        this.paintPreview = this.add.graphics();
        this.paintPreview.setDepth(200);
        this.paintPreview.setVisible(false);

        this.createBrushTexture();
        this.redrawPaintPreview();
    }

    private redrawPaintPreview(): void {
        if (!this.paintPreview) {
            return;
        }

        this.paintPreview.clear();
        this.paintPreview.fillStyle(this.paintColor, 0.4);
        this.paintPreview.lineStyle(1, 0xffffff, 0.9);

        if (this.brushShape === 'circle') {
            this.paintPreview.fillCircle(0, 0, this.brushSize);
            this.paintPreview.strokeCircle(0, 0, this.brushSize);
            return;
        }

        const size = this.brushSize * 2;

        this.paintPreview.fillRect(
            -this.brushSize,
            -this.brushSize,
            size,
            size,
        );

        this.paintPreview.strokeRect(
            -this.brushSize,
            -this.brushSize,
            size,
            size,
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

        const imageX = Phaser.Math.Clamp(
            Math.floor(
                (worldX / this.gameWidth) *
                sourceImage.width,
            ),
            0,
            sourceImage.width - 1,
        );

        const imageY = Phaser.Math.Clamp(
            Math.floor(
                (worldY / this.gameHeight) *
                sourceImage.height,
            ),
            0,
            sourceImage.height - 1,
        );

        const canvas =
            document.createElement('canvas');

        canvas.width = 1;
        canvas.height = 1;

        const context = canvas.getContext('2d');

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

        const pixel = context.getImageData(
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

        const hexColor = this.paintColor
            .toString(16)
            .padStart(6, '0')
            .toUpperCase();

        this.showStatus(
            `색상 추출 완료: #${hexColor}`,
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
            this.brushSize = Phaser.Math.Clamp(
                this.brushSize + 2,
                4,
                30,
            );

            brushSizeChanged = true;
        }

        if (
            Phaser.Input.Keyboard.JustDown(
                this.brushDecreaseKey,
            )
        ) {
            this.brushSize = Phaser.Math.Clamp(
                this.brushSize - 2,
                4,
                30,
            );

            brushSizeChanged = true;
        }

        if (!brushSizeChanged) {
            return;
        }

        this.createBrushTexture();
        this.updatePaintHud();
        this.updatePaintPreviewImmediately();
    }

    private toggleBrushShape(): void {
        this.brushShape =
            this.brushShape === 'circle'
                ? 'square'
                : 'circle';

        this.createBrushTexture();
        this.updatePaintHud();
        this.updatePaintPreviewImmediately();

        this.showStatus(
            this.brushShape === 'circle'
                ? '원형 브러시'
                : '사각 도트 브러시',
        );
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
        const pointer =
            this.input.activePointer;

        const angle = Phaser.Math.Angle.Between(
            this.player.x,
            this.player.y,
            pointer.worldX,
            pointer.worldY,
        );

        this.gun.setRotation(angle);

        this.aimLine.clear();
        this.aimLine.lineStyle(
            2,
            0xffffff,
            0.35,
        );

        const lineLength = 230;

        this.aimLine.lineBetween(
            this.player.x,
            this.player.y,
            this.player.x +
            Math.cos(angle) * lineLength,
            this.player.y +
            Math.sin(angle) * lineLength,
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

        if (this.isReloading) {
            this.showStatus('재장전 중입니다');
            return;
        }

        if (!this.canShoot) {
            return;
        }

        if (this.ammo <= 0) {
            this.showStatus(
                '탄약이 없습니다. R 키로 재장전',
            );

            return;
        }

        this.canShoot = false;
        this.ammo -= 1;

        this.updateAmmoText();

        const pointer =
            this.input.activePointer;

        const aimAngle = Phaser.Math.Angle.Between(
            this.player.x,
            this.player.y,
            pointer.worldX,
            pointer.worldY,
        );

        const muzzleDistance = 42;

        const muzzleX =
            this.player.x +
            Math.cos(aimAngle) * muzzleDistance;

        const muzzleY =
            this.player.y +
            Math.sin(aimAngle) * muzzleDistance;

        this.createMuzzleFlash(
            muzzleX,
            muzzleY,
        );

        const hitHiders = this.createPellets(
            muzzleX,
            muzzleY,
            aimAngle,
        );

        if (hitHiders.size > 0) {
            this.showHitMarker();
        }

        hitHiders.forEach((hider) => {
            this.hitHider(hider);
        });

        this.cameras.main.shake(
            90,
            0.004,
        );

        if (this.getAliveHiderCount() === 0) {
            this.showHunterVictory();
            return;
        }

        if (this.ammo === 0) {
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

        this.startKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.ENTER,
        );

        this.reloadKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.R,
        );

        this.resetKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.N,
        );

        this.nextHiderKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.TAB,
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

        this.ammoText.setColor('#ffffff');
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
            this.brushShape === 'circle'
                ? 'CIRCLE'
                : 'SQUARE';

        this.brushSizeText.setText(
            `BRUSH ${shapeText} ${this.brushSize} · B 전환 · [ / ]`,
        );
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
            '좌클릭 페인팅 · 우클릭 스포이드 · B 모양 · [ ] 크기 · WASD 이동 · Tab 변경 · Enter 시작',
        );

        this.player.setVisible(false);
        this.hunterVisuals.forEach(({ object }) => object.setVisible(false));
        this.gun.setVisible(false);
        this.hunterLabel.setVisible(false);

        this.aimLine.clear();
        this.crosshair.clear();

        this.selectionRing.setVisible(true);
        this.paintPreview.setVisible(false);

        this.paintColorText.setVisible(true);
        this.brushSizeText.setVisible(true);

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
        if (this.phase !== 'paint') {
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
            'WASD 이동 · 마우스 조준 · 좌클릭 발사 · R 재장전 · N 초기화',
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
            '모든 하이더를 발견했습니다 · N 키로 다시 시작',
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
            '시간 종료 · N 키로 다시 시작',
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

    /*
     * Reset
     */

    private resetGame(): void {
        this.tweens.killAll();

        this.destroyHiders();
        this.createHiders();

        this.ammo = this.maxAmmo;
        this.canShoot = true;
        this.isReloading = false;
        this.isPainting = false;

        this.paintColor =
            this.defaultPaintColor;
        this.brushSize = 10;
        this.brushShape = 'circle';

        this.hitMarker.setVisible(false);
        this.statusText.setVisible(false);

        this.updateAmmoText();
        this.updateTargetText();
        this.updatePaintHud();

        this.enterPaintPhase();
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
        if (this.textures.exists(this.brushTextureKey)) {
            this.textures.remove(this.brushTextureKey);
        }

        const size = this.brushSize * 2;
        const graphics = this.add.graphics();

        graphics.fillStyle(this.paintColor, 1);

        if (this.brushShape === 'circle') {
            graphics.fillCircle(
                this.brushSize,
                this.brushSize,
                this.brushSize,
            );
        } else {
            graphics.fillRect(0, 0, size, size);
        }

        graphics.generateTexture(
            this.brushTextureKey,
            size,
            size,
        );

        graphics.destroy();
    }

}

export default GameScene;