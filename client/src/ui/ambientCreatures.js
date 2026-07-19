import Phaser from 'phaser';

const WIZARD_TYPES = ['crimson', 'azure', 'emerald', 'amber', 'necromancer'];

const MONSTER_TYPES = [
  'imp',
  'slime',
  'wraith',
  'goblin',
  'orc',
  'skeleton',
  'skeleton_archer',
  'wolf',
  'giant_spider',
  'bat',
  'elf',
  'beholder',
  'dragon',
  'lich',
  'fire_elemental',
  'demon',
  'grim_reaper',
  'bruxo',
];

function buildCatalogs(scene) {
  return [
    { prefix: 'wizard', types: WIZARD_TYPES },
    { prefix: 'monster', types: MONSTER_TYPES },
  ]
    .map((c) => ({
      ...c,
      types: c.types.filter((t) => scene.textures.exists(`${c.prefix}_${t}`)),
    }))
    .filter((c) => c.types.length);
}

function spawnAmbientCreature(scene, catalog, width, height, instant = false) {
  const type = Phaser.Utils.Array.GetRandom(catalog.types);
  const tex = `${catalog.prefix}_${type}`;
  // z: 0 = longe (fundo), 1 = perto (ainda atrás do menu)
  const z = Phaser.Math.FloatBetween(0.08, 1);
  const scale = Phaser.Math.Linear(0.72, 3.05, z);
  const alpha = Phaser.Math.Linear(0.12, 0.5, z);
  // Mais longe = mais escuro / azulado (atmosfera)
  const shade = Phaser.Math.Linear(0.35, 1, z);
  const tint = Phaser.Display.Color.GetColor(
    Math.floor(140 * shade + 40 * (1 - shade)),
    Math.floor(150 * shade + 55 * (1 - shade)),
    Math.floor(190 * shade + 90 * (1 - shade))
  );

  // Evita o centro do menu um pouco; favorece laterais e fundo
  let x;
  let y;
  if (Math.random() < 0.65) {
    x =
      Math.random() < 0.5
        ? Phaser.Math.Between(40, Math.floor(width * 0.28))
        : Phaser.Math.Between(Math.floor(width * 0.72), width - 40);
    y = Phaser.Math.Between(Math.floor(height * 0.22), height - 50);
  } else {
    x = Phaser.Math.Between(60, width - 60);
    y = Phaser.Math.Between(Math.floor(height * 0.55), height - 40);
  }

  const sprite = scene.add
    .sprite(x, y, tex)
    .setScale(scale)
    .setAlpha(instant ? alpha : 0)
    .setTint(tint)
    .setDepth(0.05 + z * 0.55)
    .setFlipX(Math.random() < 0.5);

  const speed = Phaser.Math.Linear(12, 38, z);
  const angle = Math.random() * Math.PI * 2;
  const creature = {
    sprite,
    type,
    tex,
    prefix: catalog.prefix,
    z,
    x,
    y,
    baseScale: scale,
    baseAlpha: alpha,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed * 0.55,
    bobPhase: Math.random() * Math.PI * 2,
    bobAmp: Phaser.Math.Linear(0.6, 2.2, z),
    life: Phaser.Math.Between(9000, 18000),
    fadingOut: false,
    catalog,
  };

  if (!instant) {
    scene.tweens.add({
      targets: sprite,
      alpha,
      duration: 700,
      ease: 'Sine.easeOut',
    });
  }

  const idleKey = `${tex}_idle`;
  const walkKey = `${tex}_walk`;
  if (scene.anims.exists(walkKey)) {
    sprite.play(walkKey);
    sprite.anims.timeScale = Phaser.Math.Linear(0.45, 0.95, z);
  } else if (scene.anims.exists(idleKey)) {
    sprite.play(idleKey);
  }

  return creature;
}

/** Magos e monstros do jogo vagando atrás do menu, em camadas de profundidade. */
export function createAmbientCreatures(scene, count = 32) {
  const catalogs = buildCatalogs(scene);

  if (!catalogs.length) {
    scene.ambientCreatures = [];
    scene.ambientCatalogs = null;
    return;
  }

  const { width, height } = scene.scale;
  scene.ambientCreatures = [];
  scene.ambientCatalogs = catalogs;

  for (let i = 0; i < count; i++) {
    // Alterna catálogos no spawn inicial para garantir variedade
    const catalog = catalogs[i % catalogs.length];
    scene.ambientCreatures.push(spawnAmbientCreature(scene, catalog, width, height, true));
  }
}

export function destroyAmbientCreatures(scene) {
  if (!scene.ambientCreatures) return;
  for (const c of scene.ambientCreatures) {
    c.sprite?.destroy();
  }
  scene.ambientCreatures = null;
  scene.ambientCatalogs = null;
}

export function updateAmbientCreatures(scene, delta) {
  const list = scene.ambientCreatures;
  if (!list?.length) return;

  const { width, height } = scene.scale;
  const dt = delta / 1000;
  const catalogs = scene.ambientCatalogs;

  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const s = c.sprite;
    if (!s?.active) continue;

    c.life -= delta;

    // Troca de direção ocasional
    if (Math.random() < 0.008) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Phaser.Math.Linear(12, 38, c.z);
      c.vx = Math.cos(angle) * speed;
      c.vy = Math.sin(angle) * speed * 0.55;
    }

    c.x += c.vx * dt;
    c.y += c.vy * dt;

    const margin = 28;
    if (c.x < margin || c.x > width - margin) {
      c.vx *= -1;
      c.x = Phaser.Math.Clamp(c.x, margin, width - margin);
    }
    if (c.y < height * 0.18 || c.y > height - 36) {
      c.vy *= -1;
      c.y = Phaser.Math.Clamp(c.y, height * 0.18, height - 36);
    }

    if (Math.abs(c.vx) > 4) s.setFlipX(c.vx < 0);

    c.bobPhase += dt * (2.2 + c.z);
    const bob = Math.sin(c.bobPhase) * c.bobAmp;
    s.setPosition(c.x, c.y + bob);

    // Respiração leve de escala (profundidade viva)
    const breathe = 1 + Math.sin(c.bobPhase * 0.55) * 0.02;
    s.setScale(c.baseScale * breathe);

    if (!c.fadingOut && c.life <= 0) {
      c.fadingOut = true;
      scene.tweens.add({
        targets: s,
        alpha: 0,
        duration: 650,
        ease: 'Sine.easeIn',
        onComplete: () => {
          if (!scene.ambientCreatures) return;
          s.destroy();
          const idx = scene.ambientCreatures.indexOf(c);
          if (idx >= 0) {
            const nextCatalog = catalogs?.length
              ? Phaser.Utils.Array.GetRandom(catalogs)
              : c.catalog;
            scene.ambientCreatures[idx] = spawnAmbientCreature(
              scene,
              nextCatalog,
              width,
              height,
              false
            );
          }
        },
      });
    }
  }
}
