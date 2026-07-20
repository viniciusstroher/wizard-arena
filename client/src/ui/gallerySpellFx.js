import { GameScene } from '../scenes/GameScene.js';
import { getSpellDef } from '../../../server/spells.js';

/** Escala de raios do jogo → preview da galeria. */
const R = (gameR, fallback = 36) => Math.max(14, Math.round((gameR ?? fallback) * 0.36));

const PENTAGRAM_LIFE = 0.35;

const PROJECTILE_SPELLS = new Set([
  'firebolt',
  'ice_shard',
  'skull_bolt',
  'acid_bolt',
  'crystal_bolt',
  'skull_wave',
  'bone_volley',
]);

/**
 * Host de VFX da galeria: reutiliza draw/burst do GameScene em fade 100% (life = maxLife).
 */
export class GallerySpellFx {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ getOrigin: () => { x: number, y: number }, depth?: number }} opts
   */
  constructor(scene, opts) {
    this.scene = scene;
    this.getOrigin = opts.getOrigin;
    this.depth = opts.depth ?? 10003;
    this.time = scene.time;
    this.effects = [];
    this.burstSeen = new Set();
    this.meteorTrailAt = new Map();
    this.effectGraphics = null;
    this._emitters = [];
    this._timer = null;
    this._bound = false;

    this.conjureFx = null;
    this.conjureEmbers = null;
    this.fireballFx = null;
    this.iceFx = null;
    this.healFx = null;
    this.mistFx = null;
    this.windFx = null;
    this.poisonFx = null;
    this.necroFx = null;
    this.sparkFx = null;
    this.magicFx = null;
    this.meteorFx = null;
  }

  create(parent) {
    this.destroy();
    this._bindGameMethods();

    this.effectGraphics = this.scene.add.graphics().setDepth(this.depth);
    if (parent) parent.add(this.effectGraphics);

    const wrap = (emitter) => {
      this._emitters.push(emitter);
      if (parent) parent.add(emitter);
      return {
        emitParticleAt: (x, y, count) => {
          const o = this.getOrigin();
          emitter.emitParticleAt(o.x + x, o.y + y, count);
        },
        setEmitterAngle: (v) => emitter.setEmitterAngle(v),
        setParticleSpeed: (v) => emitter.setParticleSpeed(v),
        destroy: () => emitter.destroy(),
      };
    };

    const make = (tint, opts = {}) =>
      wrap(
        this.scene.add
          .particles(0, 0, 'particle', {
            tint,
            speed: { min: 20, max: 90 },
            scale: { start: 1.4, end: 0 },
            alpha: { start: 0.95, end: 0 },
            lifespan: { min: 180, max: 420 },
            gravityY: opts.gravityY ?? -30,
            frequency: -1,
            emitting: false,
            blendMode: opts.blendMode ?? 'ADD',
            ...opts,
          })
          .setDepth(this.depth + 1)
      );

    this.conjureFx = make([0x4a2080, 0x6b40a8, 0x4488aa, 0x88aacc], {
      speed: { min: 28, max: 70 },
      angle: { min: 255, max: 285 },
      gravityY: -55,
      blendMode: 'NORMAL',
      alpha: { start: 0.55, end: 0 },
      lifespan: { min: 420, max: 780 },
    });
    this.conjureEmbers = make([0x5a3088, 0x5070a0, 0x8860b0, 0xaad0e8], {
      speed: { min: 16, max: 42 },
      angle: { min: 240, max: 300 },
      gravityY: -35,
      blendMode: 'NORMAL',
      alpha: { start: 0.4, end: 0 },
      lifespan: { min: 500, max: 900 },
      scale: { start: 0.65, end: 0 },
    });
    this.fireballFx = make([0xff2200, 0xff4a00, 0xff8800, 0xffcc33, 0xffee88], {
      gravityY: -40,
      scale: { start: 1.6, end: 0 },
    });
    this.iceFx = make([0xffffff, 0xc8f0ff, 0x66ccff, 0x88ddff, 0xaaddff], {
      gravityY: 18,
      scale: { start: 1.35, end: 0 },
    });
    this.healFx = make([0x55ff88, 0xa8ffc8, 0xffffff, 0x88ffaa], {
      angle: { min: 240, max: 300 },
      gravityY: -55,
      lifespan: { min: 420, max: 780 },
    });
    this.mistFx = make([0x6b2cff, 0xaa66ff, 0xcc99ff, 0x8844dd, 0x5522aa], {
      speed: { min: 6, max: 28 },
      angle: { min: 0, max: 360 },
      scale: { start: 2.4, end: 0 },
      gravityY: -18,
    });
    this.windFx = make([0xffffff, 0xc8e8ff, 0xa8d8ff, 0x88c8ff, 0xe8f4ff], {
      speed: { min: 90, max: 220 },
      angle: { min: -12, max: 12 },
      gravityY: 0,
    });
    this.poisonFx = make([0x88ff44, 0x66cc33, 0xaaff66, 0x44aa22], {
      speed: { min: 8, max: 36 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.8, end: 0 },
      gravityY: -22,
      blendMode: 'NORMAL',
    });
    this.necroFx = make([0x1a001a, 0x4a0080, 0x7b2cff, 0x120018, 0x2a0a3a], {
      gravityY: -20,
      scale: { start: 1.6, end: 0 },
    });
    this.sparkFx = make([0xffffff, 0xaadfff, 0xffee88, 0x88ccff], {
      speed: { min: 40, max: 160 },
      gravityY: 40,
      scale: { start: 1.5, end: 0 },
    });
    this.magicFx = make([0xaa88ff, 0xccbbff, 0xffffff, 0x8866ee], {
      gravityY: -30,
      scale: { start: 1.5, end: 0 },
    });
    this.meteorFx = make([0xff2200, 0xff5500, 0xff9900, 0xffcc44, 0xffeebb, 0xffffff], {
      speed: { min: 30, max: 180 },
      gravityY: 60,
      scale: { start: 2.2, end: 0 },
      maxParticles: 80,
    });

    this._timer = this.scene.time.addEvent({
      delay: 33,
      loop: true,
      callback: () => this.tick(0.033),
    });
  }

  _bindGameMethods() {
    if (this._bound) return;
    this._bound = true;
    const proto = GameScene.prototype;
    const methods = [
      'effectFade',
      'effectProgress',
      'seededRand',
      'burstOnce',
      'pruneBurstSeen',
      'burstSpellParticles',
      'meteorFallPose',
      'emitMeteorTrail',
      'drawMeteorBody',
      'drawLightningBolt',
      'drawSkyLightning',
      'drawElectricStorm',
      'drawPentagram',
      'drawNova',
      'drawFirebreath',
      'drawHeal',
      'drawBarrier',
      'drawBlink',
      'drawImpact',
      'drawFreeze',
      'drawApocalypse',
      'drawStorm',
      'drawPoisonBurst',
      'drawBossNova',
      'drawBossStrike',
      'drawMeteorWarn',
      'drawMeteorStrike',
      'drawMassHealWarn',
      'drawMassHealStrike',
      'drawCooldownMistWarn',
      'drawCooldownMistStrike',
      'drawGaleWarn',
      'drawGaleStrike',
    ];
    for (const name of methods) {
      if (typeof proto[name] === 'function') {
        this[name] = proto[name];
      }
    }
  }

  clear() {
    this.effects = [];
    this.burstSeen.clear();
    this.meteorTrailAt.clear();
    this.effectGraphics?.clear();
  }

  /**
   * Dispara o VFX da magia (começa em fade 100%).
   * @returns {{ needsProjectile: boolean, impactAt?: {x:number,y:number} }}
   */
  play(spellId, color, from, to) {
    const built = buildGallerySpellEffects(spellId, color ?? 0xffffff, from, to);
    this.effects = built.effects;
    this.burstSeen.clear();
    return { needsProjectile: built.needsProjectile, impactAt: built.impactAt };
  }

  /** Impacto de projétil após o tween (mesmo drawImpact do jogo). */
  playImpact(spellId, color, x, y, radius = 24) {
    this.effects.push({
      type: 'impact',
      spellId: spellId || 'orb',
      x,
      y,
      radius: R(radius, 24),
      life: 0.4,
      maxLife: 0.4,
      color: color || 0xffffff,
      seed: (Math.random() * 1e9) | 0,
    });
  }

  tick(dt) {
    if (!this.effectGraphics) return;
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter((e) => e.life > 0);
    this.render();
  }

  render() {
    const g = this.effectGraphics;
    if (!g) return;
    g.clear();
    const activeBursts = new Set();

    for (const e of this.effects) {
      const burstKey = `${e.type}:${e.spellId || ''}:${Math.round(e.x ?? e.x1 ?? 0)}:${Math.round(e.y ?? e.y1 ?? 0)}:${e.seed ?? 0}:${e.phase || ''}`;
      if (
        e.type === 'impact' ||
        e.type === 'nova' ||
        e.type === 'firebreath' ||
        e.type === 'heal' ||
        e.type === 'blink' ||
        e.type === 'barrier' ||
        e.type === 'freeze' ||
        e.type === 'apocalypse' ||
        e.type === 'storm' ||
        e.type === 'electric_storm' ||
        e.type === 'poison_burst' ||
        e.type === 'boss_nova' ||
        e.type === 'boss_strike' ||
        e.type === 'lightning' ||
        e.type === 'sky_lightning' ||
        e.type === 'meteor_strike' ||
        e.type === 'mass_heal_strike' ||
        e.type === 'cooldown_mist_strike' ||
        e.type === 'cooldown_mist' ||
        e.type === 'gale_strike'
      ) {
        activeBursts.add(burstKey);
        this.burstOnce(burstKey, () => this.burstSpellParticles(e));
      }

      if (e.type === 'pentagram') this.drawPentagram(e);
      else if (e.type === 'sky_lightning') this.drawSkyLightning(e);
      else if (e.type === 'lightning') this.drawLightningBolt(e);
      else if (e.type === 'dash') {
        const dx = e.dx || 0;
        const dy = e.dy || 0;
        const len = 28;
        const fade = Math.min(1, e.life / 0.18);
        g.lineStyle(3, e.color || 0xffffff, 0.55 * fade);
        g.lineBetween(e.x - dx * len, e.y - dy * len, e.x + dx * 8, e.y + dy * 8);
        g.fillStyle(e.color || 0xffffff, 0.1 * fade);
        g.fillEllipse(
          e.x - dx * 6,
          e.y - dy * 6,
          Math.abs(dx) > 0 ? 36 : 14,
          Math.abs(dy) > 0 ? 36 : 14
        );
      } else if (e.type === 'nova') this.drawNova(e);
      else if (e.type === 'firebreath') this.drawFirebreath(e);
      else if (e.type === 'heal') this.drawHeal(e);
      else if (e.type === 'barrier') this.drawBarrier(e);
      else if (e.type === 'blink') this.drawBlink(e);
      else if (e.type === 'impact') this.drawImpact(e);
      else if (e.type === 'freeze') this.drawFreeze(e);
      else if (e.type === 'apocalypse') this.drawApocalypse(e);
      else if (e.type === 'meteor_warn') this.drawMeteorWarn(e);
      else if (e.type === 'meteor_strike') this.drawMeteorStrike(e);
      else if (e.type === 'mass_heal_warn') this.drawMassHealWarn(e);
      else if (e.type === 'mass_heal_strike') this.drawMassHealStrike(e);
      else if (e.type === 'cooldown_mist_warn') this.drawCooldownMistWarn(e);
      else if (e.type === 'cooldown_mist_strike') this.drawCooldownMistStrike(e);
      else if (e.type === 'gale_warn') this.drawGaleWarn(e);
      else if (e.type === 'gale_strike') this.drawGaleStrike(e);
      else if (e.type === 'storm') this.drawStorm(e);
      else if (e.type === 'electric_storm') this.drawElectricStorm(e);
      else if (e.type === 'poison_burst') this.drawPoisonBurst(e);
      else if (e.type === 'boss_nova') this.drawBossNova(e);
      else if (e.type === 'boss_strike') this.drawBossStrike(e);
    }

    this.pruneBurstSeen(activeBursts);
  }

  destroy() {
    if (this._timer) {
      this._timer.remove(false);
      this._timer = null;
    }
    this.clear();
    for (const em of this._emitters) em?.destroy?.();
    this._emitters = [];
    this.effectGraphics?.destroy?.();
    this.effectGraphics = null;
    this.conjureFx = null;
    this.conjureEmbers = null;
    this.fireballFx = null;
    this.iceFx = null;
    this.healFx = null;
    this.mistFx = null;
    this.windFx = null;
    this.poisonFx = null;
    this.necroFx = null;
    this.sparkFx = null;
    this.magicFx = null;
    this.meteorFx = null;
  }
}

function pentagram(x, y, color, radius = 30.4) {
  return {
    type: 'pentagram',
    x,
    y,
    radius: R(radius, 30.4),
    life: PENTAGRAM_LIFE,
    maxLife: PENTAGRAM_LIFE,
    color,
  };
}

/**
 * Monta os efeitos sintéticos da magia (mesmos tipos do servidor / GameScene).
 */
export function buildGallerySpellEffects(spellId, color, from, to) {
  const def = getSpellDef(spellId) || {};
  const fxColor = color ?? def.color ?? 0xffffff;
  const x1 = from?.x ?? -40;
  const y1 = from?.y ?? 10;
  const x2 = to?.x ?? 48;
  const y2 = to?.y ?? 10;
  const effects = [];
  let needsProjectile = false;
  let impactAt = null;

  const add = (e) => effects.push(e);

  // Conjuração sempre em fade 100% no início
  add(pentagram(x1, y1, fxColor, 30.4));

  switch (spellId) {
    case 'flame_nova':
    case 'magma_surge':
      add({
        type: 'nova',
        spellId: 'flame_nova',
        x: x1,
        y: y1,
        radius: R(def.radius || 110),
        life: 0.7,
        maxLife: 0.7,
        color: fxColor,
      });
      break;

    case 'poison_cloud':
    case 'plague_burst':
    case 'thorn_nova':
      add({
        type: 'poison_burst',
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
        radius: R(def.radius || 90),
        life: 0.45,
        maxLife: 0.45,
        color: fxColor,
      });
      break;

    case 'arc_lightning':
      add({
        type: 'lightning',
        x1,
        y1,
        x2,
        y2,
        life: 0.38,
        maxLife: 0.38,
        color: fxColor,
        seed: (Math.random() * 1e9) | 0,
        branches: 3,
      });
      add({
        type: 'impact',
        spellId: 'arc_lightning',
        x: x2,
        y: y2,
        radius: R(26),
        life: 0.4,
        maxLife: 0.4,
        color: fxColor,
        seed: (Math.random() * 1e9) | 0,
      });
      break;

    case 'electric_bolt':
    case 'hex_bolt':
    case 'infernal_judgment':
    case 'solar_judgment':
      add({
        type: 'sky_lightning',
        x1: x2,
        y1: y2 - 95,
        x2,
        y2,
        life: 0.45,
        maxLife: 0.45,
        color: fxColor,
        seed: (Math.random() * 1e9) | 0,
        branches: 4,
      });
      add({
        type: 'impact',
        spellId,
        x: x2,
        y: y2,
        radius: R(30),
        life: 0.4,
        maxLife: 0.4,
        color: fxColor,
        seed: (Math.random() * 1e9) | 0,
      });
      break;

    case 'electric_storm':
      add({
        type: 'electric_storm',
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
        radius: R(def.radius || 130),
        life: 0.7,
        maxLife: 0.7,
        color: fxColor,
        seed: (Math.random() * 1e9) | 0,
      });
      for (let i = 0; i < 3; i++) {
        const ox = ((i - 1) * 22);
        add({
          type: 'sky_lightning',
          x1: x2 + ox,
          y1: y2 - 90,
          x2: x2 + ox,
          y2: y2 + (i % 2) * 4,
          life: 0.4,
          maxLife: 0.4,
          color: fxColor,
          seed: ((Math.random() * 1e9) | 0) + i,
          branches: 3,
          flash: i === 1,
        });
      }
      break;

    case 'storm_call':
      add({
        type: 'storm',
        x: x1,
        y: y1,
        radius: R(def.range || 160, 160),
        life: 0.85,
        maxLife: 0.85,
        color: fxColor,
        seed: (Math.random() * 1e9) | 0,
      });
      add({
        type: 'lightning',
        x1,
        y1: y1 - 20,
        x2,
        y2,
        life: 0.4,
        maxLife: 0.4,
        color: fxColor,
        seed: (Math.random() * 1e9) | 0,
        branches: 4,
      });
      add({
        type: 'impact',
        spellId: 'storm_call',
        x: x2,
        y: y2,
        radius: R(30),
        life: 0.4,
        maxLife: 0.4,
        color: fxColor,
        seed: (Math.random() * 1e9) | 0,
      });
      break;

    case 'mend':
      add({
        type: 'heal',
        x: x1,
        y: y1,
        life: 0.75,
        maxLife: 0.75,
        color: fxColor,
        radius: R(42),
      });
      break;

    case 'barrier':
      add({
        type: 'barrier',
        x: x1,
        y: y1,
        life: 0.7,
        maxLife: 0.7,
        color: fxColor,
        radius: R(40),
      });
      break;

    case 'blink':
      add({
        type: 'blink',
        phase: 'out',
        x: x1,
        y: y1,
        x2,
        y2,
        life: 0.5,
        maxLife: 0.5,
        color: fxColor,
        radius: R(36),
      });
      add({
        type: 'blink',
        phase: 'in',
        x: x2,
        y: y2,
        x2: x1,
        y2: y1,
        life: 0.55,
        maxLife: 0.55,
        color: fxColor,
        radius: R(36),
      });
      break;

    case 'apocalypse':
      add({
        type: 'apocalypse',
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
        radius: R(def.radius || 120, 120),
        life: 1.35,
        maxLife: 1.35,
        color: fxColor,
        seed: (Math.random() * 1e9) | 0,
      });
      break;

    case 'time_freeze':
    case 'frost_apocalypse':
      add({
        type: 'freeze',
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
        radius: R(def.radius || 130, 130),
        life: 1.1,
        maxLife: 1.1,
        color: fxColor,
        seed: (Math.random() * 1e9) | 0,
      });
      break;

    case 'firebreath':
    case 'frost_breath':
    case 'cataclysm_beam': {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      add({
        type: 'firebreath',
        spellId,
        x: x1,
        y: y1,
        dirX: dx / len,
        dirY: dy / len,
        range: R(def.range || 170, 170),
        coneAngle: def.coneAngle || 38,
        life: 0.55,
        maxLife: 0.55,
        color: fxColor,
      });
      break;
    }

    case 'void_collapse':
    case 'abyss_nova':
    case 'shadow_eclipse':
    case 'entropy_pulse':
    case 'tidal_crush':
      add({
        type: 'boss_nova',
        spellId,
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
        radius: R(def.radius || 130),
        life: 0.85,
        maxLife: 0.85,
        color: fxColor,
      });
      add({
        type: 'impact',
        spellId,
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
        radius: R(44),
        life: 0.4,
        maxLife: 0.4,
        color: fxColor,
        seed: (Math.random() * 1e9) | 0,
      });
      break;

    case 'soul_rend':
    case 'death_knell':
    case 'blood_pact':
    case 'soul_lance':
    case 'rift_lance':
      add({
        type: 'boss_strike',
        spellId,
        x: x2,
        y: y2,
        radius: R(36),
        life: 0.55,
        maxLife: 0.55,
        color: fxColor,
      });
      add({
        type: 'impact',
        spellId,
        x: x2,
        y: y2,
        radius: R(34),
        life: 0.4,
        maxLife: 0.4,
        color: fxColor,
        seed: (Math.random() * 1e9) | 0,
      });
      break;

    default:
      if (PROJECTILE_SPELLS.has(spellId)) {
        needsProjectile = true;
        impactAt = { x: x2, y: y2 };
      } else {
        // Fallback: impacto no alvo
        add({
          type: 'impact',
          spellId,
          x: x2,
          y: y2,
          radius: R(def.radius || 28),
          life: 0.45,
          maxLife: 0.45,
          color: fxColor,
          seed: (Math.random() * 1e9) | 0,
        });
      }
      break;
  }

  return { effects, needsProjectile, impactAt };
}

export function isProjectileSpell(spellId) {
  return PROJECTILE_SPELLS.has(spellId);
}
