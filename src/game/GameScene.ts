import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private gun!: Phaser.GameObjects.Rectangle;
  private hunterLabel!: Phaser.GameObjects.Text;

  private crosshair!: Phaser.GameObjects.Arc;
  private crosshairCenter!: Phaser.GameObjects.Arc;
  private aimLine!: Phaser.GameObjects.Graphics;

  private ammoText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  private reloadKey!: Phaser.Input.Keyboard.Key;

  private ammo = 5;
  private readonly maxAmmo = 5;

  private canShoot = true;
  private readonly shotCooldown = 450;

  private readonly pelletCount = 7;
  private readonly pelletRange = 600;

  // 전체 산탄 퍼짐 각도: 약 30도
  private readonly shotgunSpread =
    Phaser.Math.DegToRad(30);

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
  }

  private createGrid(): void {
    const graphics = this.add.graphics();

    graphics.lineStyle(1, 0x3b5068, 0.5);

    for (let x = 0; x <= this.gameWidth; x += 40) {
      graphics.lineBetween(
        x,
        0,
        x,
        this.gameHeight,
      );
    }

    for (let y = 0; y <= this.gameHeight; y += 40) {
      graphics.lineBetween(
        0,
        y,
        this.gameWidth,
        y,
      );
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

    // 총의 왼쪽 끝이 플레이어 중심에 붙도록 설정
    this.gun.setOrigin(0, 0.5);
    this.gun.setStrokeStyle(2, 0xffffff);
    this.gun.setDepth(4);

    this.hunterLabel = this.add
      .text(
        this.player.x,
        this.player.y - 48,
        'HUNTER',
        {
          fontFamily: 'Arial',
          fontSize: '16px',
          color: '#ffffff',
        },
      )
      .setOrigin(0.5)
      .setDepth(5);

    this.aimLine = this.add.graphics();
    this.aimLine.setDepth(2);
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
      throw new Error(
        'Keyboard input is not available.',
      );
    }

    this.cursors =
      this.input.keyboard.createCursorKeys();

    this.wasd = this.input.keyboard.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    }) as typeof this.wasd;

    this.reloadKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.R,
    );
  }

  private createHud(): void {
    this.ammoText = this.add
      .text(
        this.gameWidth - 24,
        20,
        '',
        {
          fontFamily: 'Arial',
          fontSize: '25px',
          fontStyle: 'bold',
          color: '#ffffff',
          backgroundColor: '#00000099',
          padding: {
            x: 14,
            y: 9,
          },
        },
      )
      .setOrigin(1, 0)
      .setDepth(30);

    this.statusText = this.add
      .text(
        this.gameWidth / 2,
        this.gameHeight - 35,
        '',
        {
          fontFamily: 'Arial',
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#ffdf70',
          backgroundColor: '#00000099',
          padding: {
            x: 14,
            y: 8,
          },
        },
      )
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false);

    this.updateAmmoText();
  }

  private createGuideText(): void {
    this.add
      .text(
        20,
        20,
        'WASD 이동 · 마우스 조준 · 좌클릭 발사 · R 재장전',
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
        // 왼쪽 클릭만 발사 처리
        if (!pointer.leftButtonDown()) {
          return;
        }

        this.fireShotgun(
          pointer.worldX,
          pointer.worldY,
        );
      },
    );
  }

  private updatePlayerMovement(
    delta: number,
  ): void {
    let directionX = 0;
    let directionY = 0;

    if (
      this.cursors.left.isDown ||
      this.wasd.A.isDown
    ) {
      directionX -= 1;
    }

    if (
      this.cursors.right.isDown ||
      this.wasd.D.isDown
    ) {
      directionX += 1;
    }

    if (
      this.cursors.up.isDown ||
      this.wasd.W.isDown
    ) {
      directionY -= 1;
    }

    if (
      this.cursors.down.isDown ||
      this.wasd.S.isDown
    ) {
      directionY += 1;
    }

    const direction =
      new Phaser.Math.Vector2(
        directionX,
        directionY,
      );

    if (direction.lengthSq() > 0) {
      direction.normalize();

      const distance =
        this.playerSpeed * (delta / 1000);

      this.player.x +=
        direction.x * distance;

      this.player.y +=
        direction.y * distance;
    }

    this.player.x = Phaser.Math.Clamp(
      this.player.x,
      this.player.width / 2,
      this.gameWidth -
        this.player.width / 2,
    );

    this.player.y = Phaser.Math.Clamp(
      this.player.y,
      this.player.height / 2,
      this.gameHeight -
        this.player.height / 2,
    );

    this.gun.setPosition(
      this.player.x,
      this.player.y,
    );

    this.hunterLabel.setPosition(
      this.player.x,
      this.player.y - 48,
    );
  }

  private updateAim(): void {
    const pointer = this.input.activePointer;

    const mouseX = pointer.worldX;
    const mouseY = pointer.worldY;

    const aimAngle =
      Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        mouseX,
        mouseY,
      );

    this.gun.setRotation(aimAngle);

    this.crosshair.setPosition(
      mouseX,
      mouseY,
    );

    this.crosshairCenter.setPosition(
      mouseX,
      mouseY,
    );

    this.drawAimLine(
      mouseX,
      mouseY,
      aimAngle,
    );
  }

  private drawAimLine(
    mouseX: number,
    mouseY: number,
    aimAngle: number,
  ): void {
    this.aimLine.clear();
    this.aimLine.lineStyle(
      1,
      0xffffff,
      0.2,
    );

    const distance =
      Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        mouseX,
        mouseY,
      );

    const dashLength = 8;
    const gapLength = 8;
    const segmentLength =
      dashLength + gapLength;

    for (
      let current = 55;
      current < distance;
      current += segmentLength
    ) {
      const startX =
        this.player.x +
        Math.cos(aimAngle) * current;

      const startY =
        this.player.y +
        Math.sin(aimAngle) * current;

      const endDistance = Math.min(
        current + dashLength,
        distance,
      );

      const endX =
        this.player.x +
        Math.cos(aimAngle) *
          endDistance;

      const endY =
        this.player.y +
        Math.sin(aimAngle) *
          endDistance;

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
    if (!this.canShoot) {
      return;
    }

    if (this.ammo <= 0) {
      this.showStatus(
        '탄약이 없습니다! R 키로 재장전',
      );

      this.cameras.main.shake(
        80,
        0.002,
      );

      return;
    }

    this.canShoot = false;
    this.ammo -= 1;

    this.updateAmmoText();

    const aimAngle =
      Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        targetX,
        targetY,
      );

    /*
     * 총구 위치를 계산합니다.
     * 총 길이가 약 48이므로 플레이어 중심에서
     * 48픽셀 앞을 총구로 사용합니다.
     */
    const muzzleDistance = 48;

    const muzzleX =
      this.player.x +
      Math.cos(aimAngle) *
        muzzleDistance;

    const muzzleY =
      this.player.y +
      Math.sin(aimAngle) *
        muzzleDistance;

    this.createMuzzleFlash(
      muzzleX,
      muzzleY,
    );

    this.createPellets(
      muzzleX,
      muzzleY,
      aimAngle,
    );

    this.cameras.main.shake(
      110,
      0.006,
    );

    this.time.delayedCall(
      this.shotCooldown,
      () => {
        this.canShoot = true;
      },
    );

    if (this.ammo === 0) {
      this.showStatus(
        '탄약 소진! R 키로 재장전',
      );
    }
  }

  private createPellets(
    startX: number,
    startY: number,
    centerAngle: number,
  ): void {
    const pelletGraphics =
      this.add.graphics();

    pelletGraphics.setDepth(15);

    const halfSpread =
      this.shotgunSpread / 2;

    for (
      let index = 0;
      index < this.pelletCount;
      index += 1
    ) {
      /*
       * 산탄이 일정한 간격으로 퍼지되,
       * 약간의 랜덤 오차도 추가합니다.
       */
      const ratio =
        this.pelletCount === 1
          ? 0.5
          : index /
            (this.pelletCount - 1);

      const spreadOffset =
        Phaser.Math.Linear(
          -halfSpread,
          halfSpread,
          ratio,
        );

      const randomOffset =
        Phaser.Math.FloatBetween(
          -0.025,
          0.025,
        );

      const pelletAngle =
        centerAngle +
        spreadOffset +
        randomOffset;

      const range =
        Phaser.Math.Between(
          Math.floor(
            this.pelletRange * 0.82,
          ),
          this.pelletRange,
        );

      const endX =
        startX +
        Math.cos(pelletAngle) *
          range;

      const endY =
        startY +
        Math.sin(pelletAngle) *
          range;

      pelletGraphics.lineStyle(
        2,
        0xffe08a,
        0.9,
      );

      pelletGraphics.lineBetween(
        startX,
        startY,
        endX,
        endY,
      );

      // 산탄 끝에 작은 점 표시
      pelletGraphics.fillStyle(
        0xffb347,
        0.8,
      );

      pelletGraphics.fillCircle(
        endX,
        endY,
        3,
      );
    }

    // 탄환 궤적을 빠르게 사라지게 함
    this.tweens.add({
      targets: pelletGraphics,
      alpha: 0,
      duration: 130,
      ease: 'Quad.easeOut',
      onComplete: () => {
        pelletGraphics.destroy();
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
      15,
      0xfff1a8,
      1,
    );

    flash.setDepth(16);

    const outerFlash = this.add.circle(
      x,
      y,
      25,
      0xff8c42,
      0.45,
    );

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
      this.showStatus(
        '이미 탄약이 가득합니다',
      );

      return;
    }

    this.ammo = this.maxAmmo;
    this.updateAmmoText();
    this.showStatus('재장전 완료!');
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

  private showStatus(
    message: string,
  ): void {
    this.statusText.setText(message);
    this.statusText.setVisible(true);
    this.statusText.setAlpha(1);

    this.tweens.killTweensOf(
      this.statusText,
    );

    this.tweens.add({
      targets: this.statusText,
      alpha: 0,
      delay: 900,
      duration: 400,
      onComplete: () => {
        this.statusText.setVisible(false);
      },
    });
  }
}