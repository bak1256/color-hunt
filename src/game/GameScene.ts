import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private gun!: Phaser.GameObjects.Rectangle;
  private hunterLabel!: Phaser.GameObjects.Text;
  private crosshair!: Phaser.GameObjects.Arc;
  private aimLine!: Phaser.GameObjects.Graphics;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

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
    this.createGuideText();

    // 게임 화면 위에서는 기본 마우스 커서를 숨깁니다.
    this.input.setDefaultCursor('none');
  }

  update(_: number, delta: number): void {
    this.updatePlayerMovement(delta);
    this.updateAim();
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

    /*
     * 총의 중심점을 왼쪽으로 설정합니다.
     * 따라서 총이 플레이어 중심에서 마우스 방향으로 뻗습니다.
     */
    this.gun = this.add.rectangle(
      this.player.x,
      this.player.y,
      46,
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

  private createCrosshair(): void {
    this.crosshair = this.add.circle(0, 0, 10);
    this.crosshair.setStrokeStyle(2, 0xff4d4d);
    this.crosshair.setFillStyle(0xff4d4d, 0);
    this.crosshair.setDepth(20);

    // 조준점 중앙
    const center = this.add.circle(0, 0, 2, 0xff4d4d);
    center.setDepth(21);

    // 중앙점을 조준점에 연결해서 같이 움직이게 합니다.
    this.crosshair.setData('center', center);
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
  }

  private createGuideText(): void {
    this.add
      .text(20, 20, 'WASD 이동 · 마우스 조준', {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#00000080',
        padding: {
          x: 12,
          y: 8,
        },
      })
      .setDepth(30);
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

    // 총과 이름표도 플레이어를 따라 이동합니다.
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

    // 총이 마우스 방향을 바라봅니다.
    this.gun.setRotation(aimAngle);

    // 조준점 이동
    this.crosshair.setPosition(mouseX, mouseY);

    const center = this.crosshair.getData(
      'center',
    ) as Phaser.GameObjects.Arc;

    center.setPosition(mouseX, mouseY);

    // 플레이어와 조준점 사이 점선
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
    const segmentLength = dashLength + gapLength;

    for (let current = 55; current < distance; current += segmentLength) {
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
}