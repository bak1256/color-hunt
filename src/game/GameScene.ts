import Phaser from 'phaser';

type Hider = {
  body: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  alive: boolean;
};

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private gun!: Phaser.GameObjects.Rectangle;
  private hunterLabel!: Phaser.GameObjects.Text;

  private crosshair!: Phaser.GameObjects.Arc;
  private crosshairCenter!: Phaser.GameObjects.Arc;
  private aimLine!: Phaser.GameObjects.Graphics;

  private ammoText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  private hiders: Hider[] = [];

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  private reloadKey!: Phaser.Input.Keyboard.Key;
  private resetKey!: Phaser.Input.Keyboard.Key;

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

    this.createGrid();
    this.createHunter();
    this.createHiders();
    this.createCrosshair();
    this.createKeyboardControls();
    this.createHud();
    this.createGuideText();
    this.registerInputEvents();

    this.input.setDefaultCursor('none');
  }

  update(_: number, delta: number): void {
    this.updatePlayerMovement(delta);
    this.updateAim();

    if (Phaser.Input.Keyboard.JustDown(this.reloadKey)) {
      this.reload();
    }

    if (Phaser.Input.Keyboard.JustDown(this.resetKey)) {
      this.resetGame();
    }
  }

  private createGrid(): void {
    const graphics = this.add.graphics();

    graphics.lineStyle(1, 0x3b5068, 0.5);

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
    this.player.setDepth(3);

    this.gun = this.add.rectangle(
      this.player.x,
      this.player.y,
      48,
      12,
      0x2b2b2b,
    );

    this.gun.setOrigin(0, 0.5);
    this.gun.setStrokeStyle(2, 0xffffff);
    this.gun.setDepth(4);

    this.hunterLabel = this.add
      .text(this.player.x, this.player.y - 48, 'HUNTER', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(5);

    this.aimLine = this.add.graphics();
    this.aimLine.setDepth(2);
  }

  private createHiders(): void {
    const positions = [
      { x: 180, y: 140 },
      { x: 760, y: 160 },
      { x: 720, y: 420 },
    ];

    this.hiders = positions.map((position, index) => {
      const body = this.add.circle(
        position.x,
        position.y,
        22,
        0xffffff,
      );

      body.setStrokeStyle(3, 0xbfc8d6);
      body.setDepth(5);

      const label = this.add
        .text(position.x, position.y - 38, `HIDER ${index + 1}`, {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: '#ffffff',
          backgroundColor: '#00000080',
          padding: {
            x: 6,
            y: 3,
          },
        })
        .setOrigin(0.5)
        .setDepth(6);

      return {
        body,
        label,
        alive: true,
      };
    });
  }

  private createCrosshair(): void {
    this.crosshair = this.add.circle(0, 0, 10, 0xff4d4d, 0);
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
  }

  private createHud(): void {
    this.ammoText = this.add
      .text(this.gameWidth - 24, 20, '', {
        fontFamily: 'Arial',
        fontSize: '25px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#00000099',
        padding: {
          x: 14,
          y: 9,
        },
      })
      .setOrigin(1, 0)
      .setDepth(30);

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
      .setDepth(30);

    this.statusText = this.add
      .text(this.gameWidth / 2, this.gameHeight - 40, '', {
        fontFamily: 'Arial',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffdf70',
        backgroundColor: '#000000bb',
        padding: {
          x: 18,
          y: 10,
        },
      })
      .setOrigin(0.5)
      .setDepth(40)
      .setVisible(false);

    this.updateAmmoText();
    this.updateTargetText();
  }

  private createGuideText(): void {
    this.add
      .text(
        20,
        20,
        'WASD 이동 · 좌클릭 발사 · R 재장전 · N 새 게임',
        {
          fontFamily: 'Arial',
          fontSize: '18px',
          color: '#ffffff',
          backgroundColor: '#00000080',
          padding: {
            x: 12,
            y: 8,
          },
        },
      )
      .setDepth(30);
  }

  private registerInputEvents(): void {
    this.input.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer) => {
        if (!pointer.leftButtonDown()) {
          return;
        }

        this.fireShotgun(pointer.worldX, pointer.worldY);
      },
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

      this.aimLine.lineBetween(startX, startY, endX, endY);
    }
  }

  private fireShotgun(
    targetX: number,
    targetY: number,
  ): void {
    if (!this.canShoot) {
      return;
    }

    if (this.getAliveHiderCount() === 0) {
      this.showStatus('이미 모두 잡았습니다! N 키로 새 게임');
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
    hider.body.setFillStyle(0xff4d4d);
    hider.body.setStrokeStyle(3, 0xffffff);
    hider.label.setText('HIT!');

    this.tweens.add({
      targets: [hider.body, hider.label],
      alpha: 0,
      scale: 1.5,
      duration: 350,
      ease: 'Back.easeIn',
      onComplete: () => {
        hider.body.setVisible(false);
        hider.label.setVisible(false);
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

      hider.body
        .setVisible(true)
        .setAlpha(1)
        .setScale(1)
        .setFillStyle(0xffffff)
        .setStrokeStyle(3, 0xbfc8d6);

      hider.label
        .setVisible(true)
        .setAlpha(1)
        .setScale(1)
        .setText(`HIDER ${index + 1}`);
    });

    this.updateAmmoText();
    this.updateTargetText();
    this.showStatus('새 게임 시작!');
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
    this.showStatus('🎉 모든 숨은 캐릭터를 찾았습니다!');

    this.cameras.main.flash(
      350,
      255,
      255,
      255,
    );
  }

  private showStatus(message: string): void {
    this.statusText.setText(message);
    this.statusText.setVisible(true);
    this.statusText.setAlpha(1);

    this.tweens.killTweensOf(this.statusText);

    this.tweens.add({
      targets: this.statusText,
      alpha: 0,
      delay: 1200,
      duration: 400,
      onComplete: () => {
        this.statusText.setVisible(false);
      },
    });
  }
}