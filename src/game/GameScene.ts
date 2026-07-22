import Phaser from 'phaser';

type GamePhase = 'paint' | 'hunt' | 'victory';

type Hider = {
  body: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  alive: boolean;
  color: number;
};

type ColorZone = {
  object: Phaser.GameObjects.Rectangle;
  color: number;
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
  private statusText!: Phaser.GameObjects.Text;

  private hiders: Hider[] = [];
  private colorZones: ColorZone[] = [];

  private selectedHiderIndex = 0;
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

  private ammo = 5;
  private readonly maxAmmo = 5;

  private canShoot = true;
  private readonly shotCooldown = 450;

  private readonly pelletCount = 7;
  private readonly pelletRange = 600;
  private readonly shotgunSpread = Phaser.Math.DegToRad(30);

  private readonly playerSpeed = 250;
  private readonly gameWidth = 960;
  private readonly gameHeight = 540;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#243447');

    this.createBackgroundZones();
    this.createGrid();
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
    if (this.phase === 'hunt') {
      this.updatePlayerMovement(delta);
      this.updateAim();

      if (Phaser.Input.Keyboard.JustDown(this.reloadKey)) {
        this.reload();
      }
    }

    if (
      this.phase === 'paint' &&
      Phaser.Input.Keyboard.JustDown(this.startKey)
    ) {
      this.startHunt();
    }

    if (Phaser.Input.Keyboard.JustDown(this.resetKey)) {
      this.resetGame();
    }
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

        this.paintSelectedHider(data.color);
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
      { x: 170, y: 135 },
      { x: 760, y: 145 },
      { x: 720, y: 410 },
    ];

    this.hiders = positions.map((position, index) => {
      const body = this.add.circle(
        position.x,
        position.y,
        22,
        0xffffff,
      );

      body.setStrokeStyle(3, 0xe2e8f0);
      body.setDepth(5);
      body.setInteractive({ useHandCursor: true });

      const label = this.add
        .text(position.x, position.y - 40, `HIDER ${index + 1}`, {
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
        .setDepth(6);

      const hider: Hider = {
        body,
        label,
        alive: true,
        color: 0xffffff,
      };

      body.on('pointerdown', () => {
        if (this.phase !== 'paint' || !hider.alive) {
          return;
        }

        this.selectHider(index);
      });

      body.on('pointerover', () => {
        if (this.phase !== 'paint' || !hider.alive) {
          return;
        }

        body.setScale(1.12);
      });

      body.on('pointerout', () => {
        if (this.phase !== 'paint' || !hider.alive) {
          return;
        }

        body.setScale(1);
      });

      return hider;
    });
  }

  private createSelectionRing(): void {
    this.selectionRing = this.add.circle(
      0,
      0,
      30,
      0xffff00,
      0,
    );

    this.selectionRing.setStrokeStyle(3, 0xffff00, 1);
    this.selectionRing.setDepth(7);

    this.tweens.add({
      targets: this.selectionRing,
      scale: 1.15,
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
        fontSize: '17px',
        color: '#ffffff',
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

    this.updateAmmoText();
    this.updateTargetText();
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
    this.selectedHiderIndex = 0;

    this.player.setVisible(false);
    this.gun.setVisible(false);
    this.hunterLabel.setVisible(false);
    this.aimLine.setVisible(false);

    this.crosshair.setVisible(false);
    this.crosshairCenter.setVisible(false);

    this.ammoText.setVisible(false);
    this.targetText.setVisible(true);
    this.selectionRing.setVisible(true);

    this.hiders.forEach((hider, index) => {
      hider.body.setInteractive({ useHandCursor: true });
      hider.label
        .setVisible(true)
        .setText(`HIDER ${index + 1}`);
    });

    this.colorZones.forEach((zone) => {
      zone.object.setInteractive({ useHandCursor: true });
    });

    this.selectHider(0);

    this.phaseText.setText('🎨 CAMOUFLAGE PHASE');
    this.guideText.setText(
      '① 하이더 선택  ② 배경 색상 클릭  ③ Enter로 사냥 시작',
    );

    this.input.setDefaultCursor('default');

    this.updateTargetText();
    this.showStatus('하이더를 선택하고 배경을 클릭해 색칠하세요');
  }

  private selectHider(index: number): void {
    const hider = this.hiders[index];

    if (!hider || !hider.alive) {
      return;
    }

    this.selectedHiderIndex = index;

    this.selectionRing.setPosition(
      hider.body.x,
      hider.body.y,
    );

    this.hiders.forEach((currentHider, currentIndex) => {
      if (currentIndex === index) {
        currentHider.label.setColor('#ffff66');
        currentHider.label.setText(`HIDER ${currentIndex + 1} · SELECTED`);
      } else {
        currentHider.label.setColor('#ffffff');
        currentHider.label.setText(`HIDER ${currentIndex + 1}`);
      }
    });

    this.showStatus(`HIDER ${index + 1} 선택`);
  }

  private paintSelectedHider(color: number): void {
    const selectedHider = this.hiders[this.selectedHiderIndex];

    if (!selectedHider || !selectedHider.alive) {
      return;
    }

    selectedHider.color = color;
    selectedHider.body.setFillStyle(color);
    selectedHider.body.setStrokeStyle(3, 0xffffff, 0.45);

    this.tweens.add({
      targets: selectedHider.body,
      scale: 1.3,
      duration: 100,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    const colorText = `#${color
      .toString(16)
      .padStart(6, '0')
      .toUpperCase()}`;

    this.showStatus(
      `HIDER ${this.selectedHiderIndex + 1} 색상: ${colorText}`,
    );
  }

  private startHunt(): void {
    this.phase = 'hunt';
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

    this.hiders.forEach((hider) => {
      hider.body.disableInteractive();
      hider.body.setScale(1);
      hider.label.setVisible(false);
    });

    this.colorZones.forEach((zone) => {
      zone.object.disableInteractive();
      zone.object.setStrokeStyle(3, 0xffffff, 0.12);
    });

    this.phaseText.setText('🔫 HUNT PHASE');
    this.guideText.setText(
      'WASD 이동 · 좌클릭 발사 · R 재장전 · N 새 게임',
    );

    this.input.setDefaultCursor('none');

    this.showStatus('위장 완료! 숨어 있는 하이더를 찾으세요');
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

      this.player.x += direction.x * distance;
      this.player.y += direction.y * distance;
    }

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

    this.gun.setPosition(this.player.x, this.player.y);

    this.hunterLabel.setPosition(
      this.player.x,
      this.player.y - 48,
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

    const dashLength = 8;
    const gapLength = 8;

    for (
      let current = 55;
      current < distance;
      current += dashLength + gapLength
    ) {
      const startX =
        this.player.x + Math.cos(aimAngle) * current;

      const startY =
        this.player.y + Math.sin(aimAngle) * current;

      const endDistance = Math.min(
        current + dashLength,
        distance,
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

      const endX =
        startX + Math.cos(pelletAngle) * range;

      const endY =
        startY + Math.sin(pelletAngle) * range;

      pelletGraphics.lineStyle(2, 0xffe08a, 0.9);
      pelletGraphics.lineBetween(startX, startY, endX, endY);

      pelletGraphics.fillStyle(0xffb347, 0.8);
      pelletGraphics.fillCircle(endX, endY, 3);

      this.hiders.forEach((hider) => {
        if (!hider.alive) {
          return;
        }

        const wasHit = this.isCircleHitByLine(
          hider.body.x,
          hider.body.y,
          hider.body.radius,
          startX,
          startY,
          endX,
          endY,
        );

        if (wasHit) {
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

  private isCircleHitByLine(
    circleX: number,
    circleY: number,
    radius: number,
    lineStartX: number,
    lineStartY: number,
    lineEndX: number,
    lineEndY: number,
  ): boolean {
    const lineX = lineEndX - lineStartX;
    const lineY = lineEndY - lineStartY;

    const lineLengthSquared =
      lineX * lineX + lineY * lineY;

    if (lineLengthSquared === 0) {
      return false;
    }

    const projection =
      ((circleX - lineStartX) * lineX +
        (circleY - lineStartY) * lineY) /
      lineLengthSquared;

    const clampedProjection = Phaser.Math.Clamp(
      projection,
      0,
      1,
    );

    const nearestX =
      lineStartX + clampedProjection * lineX;

    const nearestY =
      lineStartY + clampedProjection * lineY;

    const distance = Phaser.Math.Distance.Between(
      circleX,
      circleY,
      nearestX,
      nearestY,
    );

    return distance <= radius;
  }

  private hitHider(hider: Hider): void {
    if (!hider.alive) {
      return;
    }

    hider.alive = false;

    hider.body.setFillStyle(0xff3b3b);
    hider.body.setStrokeStyle(3, 0xffffff);

    this.tweens.add({
      targets: hider.body,
      alpha: 0,
      scale: 1.6,
      duration: 350,
      ease: 'Back.easeIn',
      onComplete: () => {
        hider.body.setVisible(false);
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
      hider.color = 0xffffff;

      hider.body
        .setVisible(true)
        .setAlpha(1)
        .setScale(1)
        .setFillStyle(0xffffff)
        .setStrokeStyle(3, 0xe2e8f0);

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
    this.phase = 'victory';

    this.phaseText.setText('🏆 HUNTER VICTORY');
    this.guideText.setText('N 키를 눌러 새 게임');

    this.crosshair.setVisible(false);
    this.crosshairCenter.setVisible(false);
    this.aimLine.clear();

    this.showStatus('모든 하이더를 찾았습니다!');

    this.cameras.main.flash(
      350,
      255,
      255,
      255,
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