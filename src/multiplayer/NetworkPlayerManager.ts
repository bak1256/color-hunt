import Phaser from "phaser";

import {
  multiplayerClient,
  type NetworkBrushShape,
  type NetworkPaintPoint,
  type NetworkPaintStroke,
  type NetworkPlayerRole,
  type NetworkPlayerState,
} from "../network/MultiplayerClient";

type PaintLayer = {
  texture: Phaser.GameObjects.RenderTexture;
  maskShape: Phaser.GameObjects.Graphics;
  mask: Phaser.Display.Masks.GeometryMask;
};

type NetworkPlayerView = {
  container: Phaser.GameObjects.Container;
  nameText: Phaser.GameObjects.Text;
  role: NetworkPlayerRole;
  alive: boolean;
  customizationMode: boolean;
  savedX: number;
  savedY: number;
  paintZoom: number;
  gun?: Phaser.GameObjects.Container;
  aimGraphics?: Phaser.GameObjects.Graphics;
  revealMarker?: Phaser.GameObjects.Arc;
  targetX: number;
  targetY: number;
  paintLayer?: PaintLayer;
};

export class NetworkPlayerManager {
  private readonly scene: Phaser.Scene;
  private readonly gameWidth: number;
  private readonly gameHeight: number;

  private readonly players =
    new Map<string, NetworkPlayerView>();

  private localX = 480;
  private localY = 270;

  private readonly hiderMoveSpeed = 180;
  private readonly hunterMoveSpeed = 145;
  private readonly sendInterval = 50;
  private lastSendTime = 0;

  constructor(
    scene: Phaser.Scene,
    gameWidth: number,
    gameHeight: number,
  ) {
    this.scene = scene;
    this.gameWidth = gameWidth;
    this.gameHeight = gameHeight;
  }

  addPlayer(
    sessionId: string,
    player: NetworkPlayerState,
  ): void {
    this.removePlayer(sessionId);

    const isLocal =
      sessionId ===
      multiplayerClient.getSessionId();

    const container = this.createPlayerContainer(
      player,
      isLocal,
    );

    container.setPosition(
      player.x,
      player.y,
    );

    const nameText =
      container.getByName(
        "network-player-name",
      ) as Phaser.GameObjects.Text;

    const paintLayer =
      this.createPaintLayer(
        player.x,
        player.y,
      );

    this.players.set(sessionId, {
      container,
      nameText,
      role: player.role,
      alive: player.alive,
      customizationMode: false,
      savedX: player.x,
      savedY: player.y,
      paintZoom: 1,
      gun:
        container.getData(
          "network-gun",
        ) as Phaser.GameObjects.Container,
      aimGraphics:
        this.scene.add.graphics()
          .setDepth(118)
          .setVisible(false),
      revealMarker: undefined,
      targetX: player.x,
      targetY: player.y,
      paintLayer,
    });

    const createdView =
      this.players.get(sessionId);

    if (createdView) {
      /*
       * 생성 직후 서버 좌표를 컨테이너와 페인트 레이어에
       * 즉시 동일하게 적용합니다.
       * 첫 이동 패킷 전에도 위치가 어긋나지 않습니다.
       */
      this.setViewPosition(
        createdView,
        player.x,
        player.y,
      );
    }

    if (isLocal) {
      this.localX = player.x;
      this.localY = player.y;
    }
  }

  updatePlayer(
    sessionId: string,
    player: NetworkPlayerState,
  ): void {
    const view = this.players.get(sessionId);

    if (!view) {
      this.addPlayer(sessionId, player);
      return;
    }

    view.targetX = player.x;
    view.targetY = player.y;

    if (view.role !== player.role) {
      view.role = player.role;

      view.gun?.setVisible(
        player.role === "hunter",
      );

      view.nameText.setText(
        `${player.name}\n${player.role.toUpperCase()}`,
      );
    }

    view.nameText.setText(
      `${player.name}\n${player.role.toUpperCase()}`,
    );

    if (
      view.alive !== player.alive
    ) {
      view.alive = player.alive;

      view.container.setAlpha(
        player.alive ? 1 : 0.28,
      );

      view.paintLayer?.texture.setAlpha(
        player.alive ? 1 : 0.28,
      );

      view.nameText.setText(
        player.alive
          ? `${player.name}\n${player.role.toUpperCase()}`
          : `${player.name}\nFOUND!`,
      );

      if (!player.alive) {
        this.scene.tweens.add({
          targets: [
            view.container,
            view.paintLayer?.texture,
          ].filter(Boolean),
          scale: 1.18,
          duration: 130,
          yoyo: true,
          repeat: 1,
        });
      }
    }

    if (
      sessionId ===
      multiplayerClient.getSessionId()
    ) {
      this.localX = player.x;
      this.localY = player.y;
    }
  }

  removePlayer(sessionId: string): void {
    const view = this.players.get(sessionId);

    if (!view) {
      return;
    }

    view.revealMarker?.destroy();
    view.aimGraphics?.destroy();
    view.container.destroy(true);

    if (view.paintLayer) {
      view.paintLayer.texture.destroy();
      view.paintLayer.mask.destroy();
      view.paintLayer.maskShape.destroy();
    }

    this.players.delete(sessionId);
  }

  moveLocalPlayer(
    directionX: number,
    directionY: number,
    delta: number,
  ): void {
    const sessionId =
      multiplayerClient.getSessionId();

    if (!sessionId) {
      return;
    }

    const view = this.players.get(sessionId);

    if (
      !view ||
      !view.alive ||
      view.customizationMode
    ) {
      return;
    }

    const direction =
      new Phaser.Math.Vector2(
        directionX,
        directionY,
      );

    if (direction.lengthSq() === 0) {
      return;
    }

    direction.normalize();

    const speed =
      view.role === "hunter"
        ? this.hunterMoveSpeed
        : this.hiderMoveSpeed;

    const distance =
      speed * (delta / 1000);

    this.localX = Phaser.Math.Clamp(
      this.localX +
        direction.x * distance,
      24,
      this.gameWidth - 24,
    );

    this.localY = Phaser.Math.Clamp(
      this.localY +
        direction.y * distance,
      42,
      this.gameHeight - 30,
    );

    view.targetX = this.localX;
    view.targetY = this.localY;

    this.setViewPosition(
      view,
      this.localX,
      this.localY,
    );

    const now = this.scene.time.now;

    if (
      now - this.lastSendTime >=
      this.sendInterval
    ) {
      this.lastSendTime = now;

      multiplayerClient.sendMove(
        this.localX,
        this.localY,
      );
    }
  }

  update(): void {
    const localSessionId =
      multiplayerClient.getSessionId();

    this.players.forEach(
      (view, sessionId) => {
        if (
          sessionId === localSessionId
        ) {
          this.syncPaintLayerPosition(view);
          return;
        }

        if (view.customizationMode) {
          return;
        }

        const distance =
          Phaser.Math.Distance.Between(
            view.container.x,
            view.container.y,
            view.targetX,
            view.targetY,
          );

        /*
         * 초기 생성 또는 서버 재동기화처럼 차이가 큰 경우에는
         * 보간하지 않고 즉시 정확한 위치에 맞춥니다.
         */
        if (
          distance > 120 ||
          !Number.isFinite(
            view.container.x,
          ) ||
          !Number.isFinite(
            view.container.y,
          )
        ) {
          this.setViewPosition(
            view,
            view.targetX,
            view.targetY,
          );

          return;
        }

        if (distance < 0.2) {
          this.setViewPosition(
            view,
            view.targetX,
            view.targetY,
          );

          return;
        }

        const x = Phaser.Math.Linear(
          view.container.x,
          view.targetX,
          0.22,
        );

        const y = Phaser.Math.Linear(
          view.container.y,
          view.targetY,
          0.22,
        );

        this.setViewPosition(view, x, y);
      },
    );
  }

  isLocalCustomizationMode(): boolean {
    const sessionId =
      multiplayerClient.getSessionId();

    if (!sessionId) {
      return false;
    }

    return (
      this.players.get(sessionId)
        ?.customizationMode === true
    );
  }

  isLocalHunter(): boolean {
    return (
      multiplayerClient.getLocalPlayer()
        ?.role === "hunter"
    );
  }

  getLocalPlayerPosition():
    | Phaser.Math.Vector2
    | null {
    const sessionId =
      multiplayerClient.getSessionId();

    if (!sessionId) {
      return null;
    }

    const view =
      this.players.get(sessionId);

    if (!view) {
      return null;
    }

    return new Phaser.Math.Vector2(
      view.container.x,
      view.container.y,
    );
  }

  isLocalHider(): boolean {
    return (
      multiplayerClient.getLocalPlayer()
        ?.role === "hider"
    );
  }

  paintLocalPlayer(
    worldX: number,
    worldY: number,
    brushTextureKey: string,
  ): NetworkPaintPoint | null {
    const sessionId =
      multiplayerClient.getSessionId();

    if (!sessionId) {
      return null;
    }

    const view = this.players.get(sessionId);

    if (
      !view ||
      !view.paintLayer ||
      !view.alive
    ) {
      return null;
    }

    const scale =
      view.container.scaleX || 1;

    const localX =
      (
        worldX -
        view.container.x
      ) / scale;

    const localY =
      (
        worldY -
        view.container.y
      ) / scale;

    if (
      !this.isInsideHiderShape(
        localX,
        localY,
      )
    ) {
      return null;
    }

    const textureX = localX + 40;
    const textureY = localY + 60;

    view.paintLayer.texture.stamp(
      brushTextureKey,
      undefined,
      textureX,
      textureY,
      {
        originX: 0.5,
        originY: 0.5,
      },
    );

    this.renderPaintTexture(
      view.paintLayer.texture,
    );

    return {
      x: textureX,
      y: textureY,
    };
  }

  applyPaintStroke(
    stroke: NetworkPaintStroke,
    textureKey: string,
  ): void {
    const view =
      this.players.get(
        stroke.targetSessionId,
      );

    if (
      !view ||
      !view.paintLayer
    ) {
      return;
    }

    stroke.points.forEach((point) => {
      view.paintLayer!.texture.stamp(
        textureKey,
        undefined,
        point.x,
        point.y,
        {
          originX: 0.5,
          originY: 0.5,
        },
      );
    });

    this.renderPaintTexture(
      view.paintLayer.texture,
    );
  }

  setLocalHunterCustomizationMode(
    enabled: boolean,
  ): void {
    const sessionId =
      multiplayerClient.getSessionId();

    if (!sessionId) {
      return;
    }

    const localView =
      this.players.get(sessionId);

    if (
      !localView ||
      localView.role !== "hunter"
    ) {
      return;
    }

    if (
      enabled &&
      !localView.customizationMode
    ) {
      localView.savedX =
        localView.container.x;
      localView.savedY =
        localView.container.y;
      localView.customizationMode = true;

      this.players.forEach(
        (view, id) => {
          const isLocal =
            id === sessionId;

          view.container.setVisible(
            isLocal,
          );

          view.paintLayer?.texture
            .setVisible(isLocal);
        },
      );

      localView.container
        .setPosition(
          this.gameWidth / 2,
          this.gameHeight / 2 + 20,
        )
        .setScale(3)
        .setDepth(920);

      localView.paintLayer?.texture
        .setDepth(921);

      this.syncPaintLayerPosition(
        localView,
      );

      return;
    }

    if (
      !enabled &&
      localView.customizationMode
    ) {
      this.normalizeLocalPlayerForGameplay();
    }
  }

  adjustLocalPaintZoom(
    wheelDeltaY: number,
  ): number {
    const sessionId =
      multiplayerClient.getSessionId();

    if (!sessionId) {
      return 1;
    }

    const view =
      this.players.get(sessionId);

    if (!view) {
      return 1;
    }

    const direction =
      wheelDeltaY < 0
        ? 1
        : -1;

    const nextZoom =
      Phaser.Math.Clamp(
        view.paintZoom +
          direction * 0.25,
        1,
        4,
      );

    view.paintZoom = nextZoom;

    view.container.setScale(
      nextZoom,
    );

    this.syncPaintLayerPosition(
      view,
    );

    return nextZoom;
  }

  getLocalPaintZoom(): number {
    const sessionId =
      multiplayerClient.getSessionId();

    if (!sessionId) {
      return 1;
    }

    return (
      this.players.get(sessionId)
        ?.paintZoom ?? 1
    );
  }

  resetLocalPaintZoom(): void {
    const sessionId =
      multiplayerClient.getSessionId();

    if (!sessionId) {
      return;
    }

    const view =
      this.players.get(sessionId);

    if (!view) {
      return;
    }

    view.paintZoom = 1;

    view.container
      .setScale(1)
      .setDepth(120);

    if (view.paintLayer) {
      view.paintLayer.texture
        .setScale(1)
        .setDepth(122);

      view.paintLayer.maskShape
        .setScale(1);
    }

    this.syncPaintLayerPosition(view);
  }

  normalizeLocalPlayerForGameplay(): void {
    const sessionId =
      multiplayerClient.getSessionId();

    if (!sessionId) {
      return;
    }

    const view =
      this.players.get(sessionId);

    if (!view) {
      return;
    }

    view.customizationMode = false;
    view.paintZoom = 1;

    view.container
      .setScale(1)
      .setDepth(120)
      .setPosition(
        view.targetX,
        view.targetY,
      )
      .setVisible(true);

    if (view.paintLayer) {
      view.paintLayer.texture
        .setScale(1)
        .setDepth(122)
        .setVisible(true);

      view.paintLayer.maskShape
        .setScale(1);
    }

    this.players.forEach(
      (otherView) => {
        otherView.container.setVisible(
          true,
        );

        otherView.paintLayer?.texture
          .setVisible(true);
      },
    );

    this.syncPaintLayerPosition(view);
  }

  clearAllPaint(): void {
    this.players.forEach(
      (view) => {
        view.paintLayer?.texture.clear();

        if (view.paintLayer) {
          this.renderPaintTexture(
            view.paintLayer.texture,
          );
        }

        view.container
          .setAlpha(1)
          .setScale(1);

        view.paintLayer?.texture
          .setAlpha(1)
          .setScale(1);

        view.alive = true;
        view.customizationMode = false;
        view.paintZoom = 1;
      },
    );
  }

  setAllVisible(
    visible: boolean,
  ): void {
    this.players.forEach(
      (view) => {
        view.container.setVisible(
          visible,
        );

        view.paintLayer?.texture
          .setVisible(visible);
      },
    );
  }

  setNamesVisible(
    visible: boolean,
  ): void {
    this.players.forEach(
      (view) => {
        view.nameText.setVisible(
          visible,
        );
      },
    );
  }

  updateHunterAim(
    sessionId: string,
    angle: number,
    range: number,
  ): void {
    const view =
      this.players.get(sessionId);

    if (
      !view ||
      view.role !== "hunter"
    ) {
      return;
    }

    view.gun
      ?.setVisible(true)
      .setRotation(angle);

    const graphics =
      view.aimGraphics;

    if (!graphics) {
      return;
    }

    graphics
      .setVisible(true)
      .clear()
      .lineStyle(
        2,
        0xffd166,
        0.62,
      );

    graphics.lineBetween(
      view.container.x,
      view.container.y,
      view.container.x +
        Math.cos(angle) * range,
      view.container.y +
        Math.sin(angle) * range,
    );
  }

  clearHunterAimLines(): void {
    this.players.forEach(
      (view) => {
        view.aimGraphics
          ?.clear()
          .setVisible(false);
      },
    );
  }

  revealHiders(
    hiders: Array<{
      sessionId: string;
      x: number;
      y: number;
    }>,
  ): void {
    this.clearRevealMarkers();

    hiders.forEach(
      (hider) => {
        const view =
          this.players.get(
            hider.sessionId,
          );

        if (!view) {
          return;
        }

        const marker =
          this.scene.add.circle(
            hider.x,
            hider.y,
            29,
            0xff2020,
            0.25,
          );

        marker.setStrokeStyle(
          5,
          0xff2020,
          1,
        );

        marker.setDepth(850);

        this.scene.tweens.add({
          targets: marker,
          alpha: 0.05,
          scale: 1.25,
          duration: 330,
          yoyo: true,
          repeat: -1,
        });

        view.revealMarker = marker;
        view.container.setAlpha(1);
        view.paintLayer?.texture
          .setAlpha(1);
      },
    );
  }

  clearRevealMarkers(): void {
    this.players.forEach(
      (view) => {
        view.revealMarker?.destroy();
        view.revealMarker = undefined;
      },
    );
  }

  setHunterGunsVisible(): void {
    this.players.forEach(
      (view) => {
        view.gun?.setVisible(
          view.role === "hunter",
        );
      },
    );
  }

  destroy(): void {
    [...this.players.keys()].forEach(
      (sessionId) => {
        this.removePlayer(sessionId);
      },
    );
  }

  private createPlayerContainer(
    player: NetworkPlayerState,
    isLocal: boolean,
  ): Phaser.GameObjects.Container {
    const container =
      this.scene.add.container(0, 0);

    container.setDepth(120);

    const shadow =
      this.scene.add.ellipse(
        0,
        18,
        29,
        10,
        0x304d37,
        0.28,
      );

    const color =
      this.getRoleColor(player.role);

    const head =
      this.scene.add.circle(
        0,
        -12,
        12,
        color,
      );

    const body =
      this.scene.add.rectangle(
        0,
        7,
        18,
        24,
        color,
      );

    const leftArm =
      this.scene.add.rectangle(
        -13,
        6,
        7,
        18,
        color,
      );

    const rightArm =
      this.scene.add.rectangle(
        13,
        6,
        7,
        18,
        color,
      );

    const leftLeg =
      this.scene.add.rectangle(
        -5,
        23,
        7,
        13,
        color,
      );

    const rightLeg =
      this.scene.add.rectangle(
        5,
        23,
        7,
        13,
        color,
      );

    const outlineColor =
      isLocal ? 0xfff2a6 : 0x4f463c;

    [
      head,
      body,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
    ].forEach((part) => {
      part.setStrokeStyle(
        isLocal ? 3 : 2,
        outlineColor,
        1,
      );
    });

    if (player.role === "hunter") {
      const hat =
        this.scene.add.rectangle(
          0,
          -24,
          26,
          7,
          0x4675a8,
        );

      const brim =
        this.scene.add.rectangle(
          6,
          -20,
          23,
          5,
          0x355f8c,
        );

      container.add([hat, brim]);
    }

    const nameText = this.scene.add
      .text(
        0,
        -39,
        `${player.name}\n${player.role.toUpperCase()}`,
        {
          fontFamily: "monospace",
          fontSize: "10px",
          fontStyle: "bold",
          color: "#4f3f34",
          backgroundColor: "#fff4d6dd",
          align: "center",
          padding: {
            x: 5,
            y: 3,
          },
        },
      )
      .setOrigin(0.5, 1)
      .setName("network-player-name");

    const gunBody =
      this.scene.add.rectangle(
        6,
        1,
        21,
        6,
        0x654832,
      );

    const gunBarrel =
      this.scene.add.rectangle(
        22,
        1,
        18,
        4,
        0x263238,
      );

    const gunStock =
      this.scene.add.rectangle(
        -4,
        6,
        8,
        7,
        0x8a613f,
      );

    const gun =
      this.scene.add.container(
        8,
        3,
        [
          gunBody,
          gunBarrel,
          gunStock,
        ],
      );

    gun.setVisible(
      player.role === "hunter",
    );

    container.add([
      shadow,
      head,
      body,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      gun,
      nameText,
    ]);

    container.setData(
      "network-gun",
      gun,
    );

    return container;
  }

  private createPaintLayer(
    centerX: number,
    centerY: number,
  ): PaintLayer {
    const texture =
      this.scene.add.renderTexture(
        centerX - 40,
        centerY - 60,
        80,
        120,
      );

    texture.setOrigin(0, 0);
    texture.setDepth(122);
    texture.clear();

    const maskShape =
      this.scene.add.graphics();

    maskShape.fillStyle(0xffffff, 1);

    // 머리
    maskShape.fillCircle(40, 48, 12);

    // 몸통
    maskShape.fillRect(31, 55, 18, 24);

    // 팔
    maskShape.fillRect(23.5, 57, 7, 18);
    maskShape.fillRect(49.5, 57, 7, 18);

    // 다리
    maskShape.fillRect(31.5, 76.5, 7, 13);
    maskShape.fillRect(41.5, 76.5, 7, 13);

    maskShape.setPosition(
      centerX - 40,
      centerY - 60,
    );

    maskShape.setVisible(true);
    maskShape.setAlpha(0.001);
    maskShape.setDepth(-10);

    const mask =
      maskShape.createGeometryMask();

    texture.setMask(mask);

    return {
      texture,
      maskShape,
      mask,
    };
  }

  private setViewPosition(
    view: NetworkPlayerView,
    x: number,
    y: number,
  ): void {
    view.container.setPosition(x, y);
    this.syncPaintLayerPosition(view);
  }

  private syncPaintLayerPosition(
    view: NetworkPlayerView,
  ): void {
    if (!view.paintLayer) {
      return;
    }

    const scale =
      view.container.scaleX || 1;

    view.paintLayer.texture
      .setPosition(
        view.container.x -
          40 * scale,
        view.container.y -
          60 * scale,
      )
      .setScale(scale);

    view.paintLayer.maskShape
      .setPosition(
        view.container.x -
          40 * scale,
        view.container.y -
          60 * scale,
      )
      .setScale(scale);
  }

  private isInsideHiderShape(
    x: number,
    y: number,
  ): boolean {
    const inHead =
      x * x +
        (y + 12) * (y + 12) <=
      12 * 12;

    const inBody =
      x >= -9 &&
      x <= 9 &&
      y >= -5 &&
      y <= 19;

    const inLeftArm =
      x >= -16.5 &&
      x <= -9.5 &&
      y >= -3 &&
      y <= 15;

    const inRightArm =
      x >= 9.5 &&
      x <= 16.5 &&
      y >= -3 &&
      y <= 15;

    const inLeftLeg =
      x >= -8.5 &&
      x <= -1.5 &&
      y >= 16.5 &&
      y <= 29.5;

    const inRightLeg =
      x >= 1.5 &&
      x <= 8.5 &&
      y >= 16.5 &&
      y <= 29.5;

    return (
      inHead ||
      inBody ||
      inLeftArm ||
      inRightArm ||
      inLeftLeg ||
      inRightLeg
    );
  }

  private renderPaintTexture(
    texture:
      Phaser.GameObjects.RenderTexture,
  ): void {
    const dynamicTexture =
      texture as unknown as {
        render?: () => void;
      };

    dynamicTexture.render?.();
  }

  private getRoleColor(
    role: NetworkPlayerRole,
  ): number {
    return role === "hunter"
      ? 0x5f91c9
      : 0xf5eee2;
  }
}
