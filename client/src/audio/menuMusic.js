import Phaser from 'phaser';

const VOLUME_KEY = 'wa_lobby_music_vol';
const TRACKS = ['lobby_music_a', 'lobby_music_b'];

/** @type {Phaser.Sound.BaseSound | null} */
let menuMusic = null;
/** @type {Phaser.Scene | null} */
let boundScene = null;
let volume = loadVolume();

function loadVolume() {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw != null && raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n)) return Phaser.Math.Clamp(n, 0, 1);
    }
  } catch {
    // ignore
  }
  return 0.25;
}

export function getMenuMusicVolume() {
  return volume;
}

export function setMenuMusicVolume(vol) {
  volume = Phaser.Math.Clamp(Number(vol) || 0, 0, 1);
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    // ignore
  }
  if (menuMusic && typeof menuMusic.setVolume === 'function') {
    menuMusic.setVolume(volume);
  }
  return volume;
}

/** Garante tavern-festival tocando nas telas de menu (não reinicia se já estiver). */
export function ensureMenuMusic(scene) {
  if (!scene?.sound || !scene.cache?.audio) return;

  const available = TRACKS.filter((key) => scene.cache.audio.exists(key));
  if (!available.length) return;

  // Já tocando — só atualiza volume / referência da cena
  if (menuMusic && menuMusic.isPlaying) {
    boundScene = scene;
    menuMusic.setVolume(volume);
    return;
  }

  // Sound ficou órfão após troca de cena
  if (menuMusic) {
    try {
      menuMusic.stop();
      menuMusic.destroy();
    } catch {
      // ignore
    }
    menuMusic = null;
  }

  boundScene = scene;
  const key = available[Math.floor(Math.random() * available.length)];
  menuMusic = scene.sound.add(key, {
    loop: true,
    volume,
  });

  const play = () => {
    if (menuMusic && !menuMusic.isPlaying) {
      menuMusic.play();
    }
  };

  if (scene.sound.locked) {
    scene.sound.once('unlocked', play);
  } else {
    play();
  }
}

/** Para a música de menu (ex.: ao entrar na partida). */
export function stopMenuMusic() {
  if (menuMusic) {
    try {
      menuMusic.stop();
      menuMusic.destroy();
    } catch {
      // ignore
    }
    menuMusic = null;
  }
  boundScene = null;
}
