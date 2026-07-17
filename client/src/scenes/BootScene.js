import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Player body
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 16, 14);
    g.lineStyle(3, 0x111111, 0.35);
    g.strokeCircle(16, 16, 14);
    g.generateTexture('wizard', 32, 32);

    // Monster
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(14, 14, 12);
    g.fillStyle(0x222222, 1);
    g.fillCircle(10, 11, 2);
    g.fillCircle(18, 11, 2);
    g.generateTexture('monster', 28, 28);

    // Projectile
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(6, 6, 6);
    g.generateTexture('orb', 12, 12);

    // Particle
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(3, 3, 3);
    g.generateTexture('particle', 6, 6);

    g.destroy();
    this.scene.start('Lobby');
  }
}
