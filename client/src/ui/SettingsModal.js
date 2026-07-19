import {
  RESOLUTIONS,
  applyResolution,
  loadResolutionId,
  saveResolutionId,
} from '../settings/resolution.js';
import { getMenuMusicVolume, setMenuMusicVolume } from '../audio/menuMusic.js';

/**
 * Modal de configurações (resolução + volume da música de menu).
 */
export class SettingsModal {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ onOpen?: () => void, onClose?: () => void }} [options]
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.onOpen = options.onOpen || null;
    this.onClose = options.onClose || null;

    this.open = false;
    this.resolutionId = loadResolutionId();
    this.container = scene.add.container(0, 0).setDepth(400).setVisible(false);
    this.volumeSlider = null;
    this.resolutionSelect = null;
    this.volumeValueText = null;
  }

  isOpen() {
    return this.open;
  }

  show() {
    if (this.open) return;
    this.open = true;
    this.onOpen?.();

    const { width, height } = this.scene.scale;
    this.container.removeAll(true);
    this.container.setDepth(10000).setVisible(true);
    this.scene.children.bringToTop(this.container);

    const dim = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72);
    dim.setInteractive();
    dim.on('pointerup', () => this.hide());

    const panel = this.scene.add
      .rectangle(width / 2, height / 2, 420, 340, 0x161228, 0.98)
      .setStrokeStyle(2, 0x6b5cff)
      .setInteractive();

    const title = this.scene.add
      .text(width / 2, height / 2 - 130, 'Configurações', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#f4e8ff',
      })
      .setOrigin(0.5);

    const resLabel = this.scene.add
      .text(width / 2, height / 2 - 75, 'Resolução', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#c4b5e0',
      })
      .setOrigin(0.5);

    const selectEl = document.createElement('select');
    selectEl.style.cssText = [
      'width: 280px',
      'height: 34px',
      'padding: 0 10px',
      'border: 1px solid #6b5cff',
      'border-radius: 6px',
      'background: #1e1836',
      'color: #e8dfff',
      'font-family: Trebuchet MS, sans-serif',
      'font-size: 14px',
      'cursor: pointer',
      'outline: none',
    ].join(';');
    for (const res of RESOLUTIONS) {
      const opt = document.createElement('option');
      opt.value = res.id;
      opt.textContent = res.label;
      if (res.id === this.resolutionId) opt.selected = true;
      selectEl.appendChild(opt);
    }
    selectEl.addEventListener('change', () => {
      this.resolutionId = selectEl.value;
      saveResolutionId(this.resolutionId);
      applyResolution(this.resolutionId, this.scene.game);
      // Rebuild para recentrar o modal após o Scale.FIT recalcular
      this.hide();
      this.show();
    });
    this.resolutionSelect = this.scene.add.dom(width / 2, height / 2 - 40, selectEl).setOrigin(0.5);

    const volLabel = this.scene.add
      .text(width / 2, height / 2 + 10, 'Volume da música de fundo', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#c4b5e0',
      })
      .setOrigin(0.5);

    const pct = Math.round(getMenuMusicVolume() * 100);
    this.volumeValueText = this.scene.add
      .text(width / 2, height / 2 + 42, `${pct}%`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '18px',
        color: '#e8dfff',
      })
      .setOrigin(0.5);

    const sliderEl = document.createElement('input');
    sliderEl.type = 'range';
    sliderEl.min = '0';
    sliderEl.max = '100';
    sliderEl.step = '1';
    sliderEl.value = String(pct);
    sliderEl.style.cssText = [
      'width: 280px',
      'height: 28px',
      'accent-color: #6b5cff',
      'cursor: pointer',
    ].join(';');
    sliderEl.addEventListener('input', () => {
      const v = Number(sliderEl.value) / 100;
      setMenuMusicVolume(v);
      if (this.volumeValueText) {
        this.volumeValueText.setText(`${Math.round(v * 100)}%`);
      }
    });

    this.volumeSlider = this.scene.add.dom(width / 2, height / 2 + 78, sliderEl).setOrigin(0.5);

    const closeBg = this.scene.add
      .rectangle(width / 2, height / 2 + 130, 140, 40, 0x6b5cff, 1)
      .setStrokeStyle(1, 0xffffff, 0.15);
    const closeLabel = this.scene.add
      .text(width / 2, height / 2 + 130, 'Fechar', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    closeBg.setInteractive({ useHandCursor: true });
    closeBg.on('pointerover', () => closeBg.setScale(1.04));
    closeBg.on('pointerout', () => closeBg.setScale(1));
    closeBg.on('pointerup', () => this.hide());

    this.container.add([
      dim,
      panel,
      title,
      resLabel,
      volLabel,
      this.volumeValueText,
      closeBg,
      closeLabel,
    ]);
  }

  hide() {
    if (!this.open && !this.volumeSlider && !this.resolutionSelect) return;
    this.open = false;
    if (this.volumeSlider) {
      this.volumeSlider.destroy();
      this.volumeSlider = null;
    }
    if (this.resolutionSelect) {
      this.resolutionSelect.destroy();
      this.resolutionSelect = null;
    }
    this.container.removeAll(true);
    this.container.setVisible(false);
    this.volumeValueText = null;
    this.onClose?.();
  }

  destroy() {
    this.hide();
    this.container.destroy();
    this.container = null;
  }
}
