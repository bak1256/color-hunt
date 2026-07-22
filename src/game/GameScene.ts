import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  private readonly playerSpeed = 250;

  constructor() {
    super('GameScene');
  }

  create(): void {
    // 배경
    this.cameras.main.setBackgroundColor('#243447');

    // 격자무늬 바닥
    const graphics = this.add.graphics();

    graphics.lineStyle(1, 0x3b5068, 0.5);

    for (let x = 0; x <= 960; x += 40) {
      graphics.lineBetween(x, 0, x, 540);
    }

    for (let y = 0; y <= 540; y += 40) {
      graphics.lineBetween(0, y, 960, y);
    }

    // 술래 캐릭터
    this.player = this.add.rectangle(
      480,
      270,
      40,
      55,
      0xffc857,
    );

    this.player.setStrokeStyle(3, 0xffffff);

    // 캐릭터가 바라보는 방향 표시
    this.add
      .text(480, 220, 'HUNTER', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // 키보드 입력
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

    // 안내 문구
    this.add
      .text(20, 20, 'WASD 또는 방향키로 이동', {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#00000080',
        padding: {
          x: 12,
          y: 8,
        },
      })
      .setDepth(10);
  }

  update(_: number, delta: number): void {
    if (!this.player) {
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

    // 대각선 이동속도가 빨라지지 않도록 정규화
    const direction = new Phaser.Math.Vector2(directionX, directionY);

    if (direction.lengthSq() > 0) {
      direction.normalize();

      const distance = this.playerSpeed * (delta / 1000);

      this.player.x += direction.x * distance;
      this.player.y += direction.y * distance;
    }

    // 화면 밖으로 나가지 않도록 제한
    this.player.x = Phaser.Math.Clamp(
      this.player.x,
      this.player.width / 2,
      960 - this.player.width / 2,
    );

    this.player.y = Phaser.Math.Clamp(
      this.player.y,
      this.player.height / 2,
      540 - this.player.height / 2,
    );
  }
}