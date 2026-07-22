import Phaser from 'phaser';

type GamePhase = 'paint' | 'hunt' | 'victory';
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

  private hiders: Hider[] = [];
  private colorZones: ColorZone[] = [];

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

    if (this.phase === 'paint') {
      this.updatePartSelection();

      if (Phaser.Input.Keyboard.JustDown(this.startKey)) {
        this.startHunt();
      }
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

    this.updateAmmoText();
    this.updateTargetText();
    this.updateSelectedPartText();
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
      '하이더 선택 · 1 머리 · 2 몸통 · 3 팔 · 4 다리 · Enter 사냥',
    );

    this.input.setDefaultCursor('default');

    this.updateTargetText();
    this.showStatus('부위를 선택하고 배경을 클릭해 색칠하세요');
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
      'WASD 이동 · 좌클릭 발사 · R 재장전 · N 새 게임',
    );

    this.input.setDefaultCursor('none');

    this.showStatus('위장 완료! 하이더를 찾으세요');
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

      const endX =
        startX + Math.cos(pelletAngle) * range;

      const endY =
        startY + Math.sin(pelletAngle) * range;

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