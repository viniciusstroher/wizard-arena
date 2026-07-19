import Phaser from 'phaser';

/**
 * Painel inferior-esquerdo de Eventos / Chat (HUD Phaser + input DOM).
 * Lobby: só aba Chat. Batalha: abas Chat + Eventos.
 */
export class MessageBoard {
  /**
   * @param {Phaser.Scene} scene
   * @param {{
   *   tabs?: Array<'events'|'chat'>,
   *   initialTab?: 'events'|'chat',
   *   onSendChat?: (text: string) => void,
   *   canCaptureEnter?: () => boolean,
   *   depth?: number,
   * }} [options]
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.tabs = options.tabs?.length ? [...options.tabs] : ['chat', 'events'];
    this.activeTab = options.initialTab && this.tabs.includes(options.initialTab)
      ? options.initialTab
      : this.tabs[0];
    this.onSendChat = options.onSendChat || null;
    this.canCaptureEnter = options.canCaptureEnter || null;
    this.depth = options.depth ?? 100;

    this.eventLog = [];
    this.chatLog = [];
    this.eventScroll = 0;
    this.chatScroll = 0;
    this.chatEnabled = true;
    this.chatOpen = false;
    this._ignoreEnterUntil = 0;
    this.destroyed = false;

    this.boardW = 300;
    this.boardH = 168;
    this.x = 16;
    // Acima da barra de magias (2 linhas) na batalha; mesmo offset no lobby.
    this.y = scene.scale.height - 340;
    this.lineH = 14;
    this.maxLog = 80;
    this.textMaxW = this.boardW - 20;

    this.bounds = { x: this.x, y: this.y, w: this.boardW, h: this.boardH };
    this.tabLabels = [];
    this.lines = [];
    this.measureText = null;

    this._build();
    this._refreshTabs();
    this._refreshLines();
    this._syncInputVisibility();
  }

  _build() {
    const { x, y, boardW, boardH, depth } = this;
    const font = 'Trebuchet MS, sans-serif';

    this.bg = this.scene.add
      .rectangle(x, y, boardW, boardH, 0x0e0a1a, 0.82)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x6b5cff, 0.45)
      .setScrollFactor(0)
      .setDepth(depth);

    const showTabs = this.tabs.length > 1;
    let tabX = x + 8;
    if (showTabs) {
      for (const tab of this.tabs) {
        const label = tab === 'events' ? 'Eventos' : 'Chat';
        const t = this.scene.add
          .text(tabX, y + 5, label, {
            fontFamily: font,
            fontSize: '12px',
            color: '#7a6e96',
          })
          .setScrollFactor(0)
          .setDepth(depth + 1)
          .setInteractive({ useHandCursor: true });
        t.on('pointerup', () => this.setTab(tab));
        this.tabLabels.push({ tab, text: t });
        tabX += t.width + 14;
      }
    } else {
      const only = this.tabs[0];
      const label = only === 'events' ? 'Eventos' : 'Chat';
      const t = this.scene.add
        .text(x + 10, y + 5, label, {
          fontFamily: font,
          fontSize: '12px',
          color: '#a99bc8',
        })
        .setScrollFactor(0)
        .setDepth(depth + 1);
      this.tabLabels.push({ tab: only, text: t });
    }

    this.hint = this.scene.add
      .text(x + boardW - 10, y + 5, '', {
        fontFamily: font,
        fontSize: '11px',
        color: '#7a6e96',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(depth + 1);

    this.linesTop = y + 24;
    this.maxVisibleEvents = 10;
    this.maxVisibleChat = 8;

    this.measureText = this.scene.add
      .text(0, 0, '', {
        fontFamily: font,
        fontSize: '12px',
        wordWrap: { width: this.textMaxW, useAdvancedWrap: true },
      })
      .setVisible(false)
      .setActive(false);

    const maxLines = Math.max(this.maxVisibleEvents, this.maxVisibleChat);
    for (let i = 0; i < maxLines; i++) {
      const line = this.scene.add
        .text(x + 10, this.linesTop + i * this.lineH, '', {
          fontFamily: font,
          fontSize: '12px',
          color: '#e8dfff',
        })
        .setScrollFactor(0)
        .setDepth(depth + 1);
      this.lines.push(line);
    }

    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.maxLength = 100;
    inputEl.autocomplete = 'off';
    inputEl.spellcheck = false;
    inputEl.readOnly = true;
    inputEl.placeholder = 'Enter para conversar…';
    inputEl.style.cssText = [
      'width: 280px',
      'height: 26px',
      'padding: 0 8px',
      'box-sizing: border-box',
      'font-size: 12px',
      'font-family: Trebuchet MS, sans-serif',
      'border-radius: 4px',
      'border: 1px solid #4a3f78',
      'background: #160f28',
      'color: #f0e8ff',
      'outline: none',
      'pointer-events: none',
      'caret-color: #f0e8ff',
    ].join(';');

    this.inputEl = inputEl;
    this.chatInput = this.scene.add
      .dom(x + boardW / 2, y + boardH - 16, inputEl)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth + 2);

    this._onInputKeyDown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        this._submitChat();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.closeChat();
      }
    };
    this._onFocus = () => {
      if (!this.chatOpen) {
        inputEl.blur();
        return;
      }
      if (this.scene.input?.keyboard) this.scene.input.keyboard.enabled = false;
    };
    this._onBlur = () => {
      this._lockChatInput();
      if (this.scene.input?.keyboard) this.scene.input.keyboard.enabled = true;
    };
    this._onSceneEnterKey = (event) => {
      if (event?.repeat) return;
      if (performance.now() < this._ignoreEnterUntil) return;
      if (!this._canOpenChat()) return;
      event?.preventDefault?.();
      this.openChat();
    };

    inputEl.addEventListener('keydown', this._onInputKeyDown);
    inputEl.addEventListener('focus', this._onFocus);
    inputEl.addEventListener('blur', this._onBlur);
    this.scene.input?.keyboard?.on('keydown-ENTER', this._onSceneEnterKey);
  }

  _canOpenChat() {
    if (this.destroyed || !this.chatEnabled || this.chatOpen) return false;
    if (this.activeTab !== 'chat') return false;
    if (this.canCaptureEnter && !this.canCaptureEnter()) return false;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
    return true;
  }

  _lockChatInput() {
    this.chatOpen = false;
    if (!this.inputEl) return;
    this.inputEl.readOnly = true;
    this.inputEl.style.pointerEvents = 'none';
    if (this.chatEnabled) {
      this.inputEl.placeholder = 'Enter para conversar…';
    }
  }

  openChat() {
    if (this.destroyed || !this.chatEnabled || this.activeTab !== 'chat') return;
    if (this.chatOpen) {
      this.inputEl?.focus();
      return;
    }
    if (this.canCaptureEnter && !this.canCaptureEnter()) return;

    this.chatOpen = true;
    if (this.inputEl) {
      this.inputEl.readOnly = false;
      this.inputEl.style.pointerEvents = 'auto';
      this.inputEl.placeholder = 'Digite e Enter para enviar…';
      this.inputEl.focus();
    }
    if (this.scene.input?.keyboard) this.scene.input.keyboard.enabled = false;
  }

  closeChat() {
    if (!this.chatOpen && document.activeElement !== this.inputEl) {
      this._lockChatInput();
      return;
    }
    this._lockChatInput();
    if (this.inputEl && document.activeElement === this.inputEl) {
      this.inputEl.blur();
    } else if (this.scene.input?.keyboard) {
      this.scene.input.keyboard.enabled = true;
    }
  }

  _submitChat() {
    // Evita que o mesmo Enter reabra o chat via listener do Phaser.
    this._ignoreEnterUntil = performance.now() + 200;
    if (!this.chatEnabled) {
      this.closeChat();
      return;
    }
    const text = (this.inputEl?.value || '').trim().slice(0, 100);
    if (text && this.onSendChat) {
      this.inputEl.value = '';
      this.onSendChat(text);
    }
    this.closeChat();
  }

  setChatEnabled(enabled) {
    this.chatEnabled = !!enabled;
    if (!this.chatEnabled) this.closeChat();
    if (this.inputEl) {
      this.inputEl.disabled = !this.chatEnabled;
      this.inputEl.placeholder = this.chatEnabled
        ? this.chatOpen
          ? 'Digite e Enter para enviar…'
          : 'Enter para conversar…'
        : 'Entre no lobby para conversar…';
      this.inputEl.style.opacity = this.chatEnabled ? '1' : '0.55';
      if (!this.chatEnabled) {
        this.inputEl.readOnly = true;
        this.inputEl.style.pointerEvents = 'none';
      }
    }
  }

  setTab(tab) {
    if (!this.tabs.includes(tab) || this.activeTab === tab) {
      this._refreshTabs();
      return;
    }
    this.activeTab = tab;
    this._refreshTabs();
    this._refreshLines();
    this._syncInputVisibility();
  }

  _refreshTabs() {
    const multi = this.tabs.length > 1;
    for (const { tab, text } of this.tabLabels) {
      const active = tab === this.activeTab;
      text.setColor(active ? '#e8dfff' : '#7a6e96');
      if (multi) text.setAlpha(active ? 1 : 0.75);
    }
  }

  _activeLog() {
    return this.activeTab === 'chat' ? this.chatLog : this.eventLog;
  }

  _activeScrollKey() {
    return this.activeTab === 'chat' ? 'chatScroll' : 'eventScroll';
  }

  _maxVisible() {
    return this.activeTab === 'chat' ? this.maxVisibleChat : this.maxVisibleEvents;
  }

  _formatStamp(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const dd = pad(date.getDate());
    const mm = pad(date.getMonth() + 1);
    const yyyy = date.getFullYear();
    const hh = pad(date.getHours());
    const mi = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `[${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}]`;
  }

  /** Quebra uma mensagem em linhas que cabem na largura da box. */
  _wrapMessage(text) {
    if (!text) return [''];
    if (!this.measureText) return [text];
    this.measureText.setWordWrapWidth(this.textMaxW, true);
    this.measureText.setText(text);
    const wrapped = this.measureText.getWrappedText();
    if (!wrapped?.length) return [text];
    // Palavras longas sem espaço: força quebra por caractere
    const out = [];
    for (const row of wrapped) {
      if (!row) {
        out.push('');
        continue;
      }
      this.measureText.setWordWrapWidth(0);
      this.measureText.setText(row);
      if (this.measureText.width <= this.textMaxW) {
        out.push(row);
        continue;
      }
      let chunk = '';
      for (const ch of row) {
        this.measureText.setText(chunk + ch);
        if (chunk && this.measureText.width > this.textMaxW) {
          out.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      if (chunk) out.push(chunk);
    }
    return out.length ? out : [text];
  }

  _displayLines(log = this._activeLog()) {
    const lines = [];
    for (const msg of log) {
      lines.push(...this._wrapMessage(msg));
    }
    return lines;
  }

  pushEvent(message) {
    if (!message || this.destroyed) return;
    this.eventLog.push(`${this._formatStamp()} ${message}`);
    if (this.eventLog.length > this.maxLog) {
      this.eventLog.splice(0, this.eventLog.length - this.maxLog);
    }
    this.eventScroll = 0;
    if (this.activeTab === 'events') this._refreshLines();
  }

  pushChat(message) {
    if (!message || this.destroyed) return;
    this.chatLog.push(`${this._formatStamp()} ${message}`);
    if (this.chatLog.length > this.maxLog) {
      this.chatLog.splice(0, this.chatLog.length - this.maxLog);
    }
    this.chatScroll = 0;
    if (this.activeTab === 'chat') this._refreshLines();
  }

  /** @returns {boolean} true se o scroll foi consumido */
  onWheel(dy) {
    if (this.destroyed) return false;
    const display = this._displayLines();
    const maxVisible = this._maxVisible();
    if (display.length <= maxVisible) return false;

    const pointer = this.scene.input.activePointer;
    const b = this.bounds;
    if (!b || !pointer) return false;
    if (pointer.x < b.x || pointer.x > b.x + b.w || pointer.y < b.y || pointer.y > b.y + b.h) {
      return false;
    }

    const scrollKey = this._activeScrollKey();
    const maxScroll = display.length - maxVisible;
    if (dy > 0) this[scrollKey] = Math.min(maxScroll, this[scrollKey] + 1);
    else if (dy < 0) this[scrollKey] = Math.max(0, this[scrollKey] - 1);
    this._refreshLines();
    return true;
  }

  _refreshLines() {
    if (!this.lines?.length) return;
    const display = this._displayLines();
    const max = this._maxVisible();
    const scrollKey = this._activeScrollKey();
    const total = display.length;
    const overflow = total > max;
    const maxScroll = overflow ? total - max : 0;
    this[scrollKey] = Phaser.Math.Clamp(this[scrollKey], 0, maxScroll);

    const end = total - this[scrollKey];
    const start = Math.max(0, end - max);
    const slice = display.slice(start, end);

    for (let i = 0; i < this.lines.length; i++) {
      const visible = i < max;
      this.lines[i].setVisible(visible);
      this.lines[i].setText(visible ? slice[i] || '' : '');
    }

    if (this.hint) {
      this.hint.setText(overflow ? `↕ ${total}` : '');
    }
  }

  _syncInputVisibility() {
    const show = this.activeTab === 'chat';
    if (this.chatInput) this.chatInput.setVisible(show);
    if (!show) this.closeChat();
  }

  setDomVisible(visible) {
    if (this.chatInput) {
      this.chatInput.setVisible(visible && this.activeTab === 'chat');
    }
    if (!visible) this.closeChat();
  }

  destroy() {
    this.destroyed = true;
    this.scene.input?.keyboard?.off('keydown-ENTER', this._onSceneEnterKey);
    if (this.inputEl) {
      this.inputEl.removeEventListener('keydown', this._onInputKeyDown);
      this.inputEl.removeEventListener('focus', this._onFocus);
      this.inputEl.removeEventListener('blur', this._onBlur);
      if (document.activeElement === this.inputEl) this.inputEl.blur();
    }
    this.chatOpen = false;
    if (this.scene.input?.keyboard) this.scene.input.keyboard.enabled = true;

    this.bg?.destroy();
    this.hint?.destroy();
    this.chatInput?.destroy();
    this.measureText?.destroy();
    for (const { text } of this.tabLabels) text.destroy();
    for (const line of this.lines) line.destroy();

    this.tabLabels = [];
    this.lines = [];
    this.bg = null;
    this.hint = null;
    this.chatInput = null;
    this.inputEl = null;
    this.measureText = null;
  }
}
