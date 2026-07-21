/** Ícones procedurais dos itens do inventário. */

import { ITEM_DEFS } from './inventory.js';

const ICON_SIZE = 48;

function hexRgb(color) {
  const c = color >>> 0;
  return {
    r: (c >> 16) & 0xff,
    g: (c >> 8) & 0xff,
    b: c & 0xff,
  };
}

function fill(ctx, color, alpha = 1) {
  const { r, g, b } = hexRgb(color);
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
}

function stroke(ctx, color, alpha = 1) {
  const { r, g, b } = hexRgb(color);
  ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
}

function drawHat(ctx, color) {
  fill(ctx, color);
  ctx.beginPath();
  ctx.moveTo(8, 34);
  ctx.lineTo(40, 34);
  ctx.lineTo(36, 28);
  ctx.lineTo(12, 28);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(16, 28);
  ctx.lineTo(24, 8);
  ctx.lineTo(32, 28);
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0xffffff, 0.2);
  ctx.fillRect(20, 14, 4, 12);
}

function drawCape(ctx, color) {
  fill(ctx, color);
  ctx.beginPath();
  ctx.moveTo(14, 10);
  ctx.quadraticCurveTo(24, 6, 34, 10);
  ctx.lineTo(38, 40);
  ctx.quadraticCurveTo(24, 34, 10, 40);
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0xffffff, 0.15);
  ctx.beginPath();
  ctx.moveTo(18, 14);
  ctx.quadraticCurveTo(24, 12, 30, 14);
  ctx.lineTo(32, 30);
  ctx.quadraticCurveTo(24, 26, 16, 30);
  ctx.closePath();
  ctx.fill();
}

function drawRing(ctx, color) {
  ctx.lineWidth = 5;
  stroke(ctx, color);
  ctx.beginPath();
  ctx.arc(24, 24, 12, 0, Math.PI * 2);
  ctx.stroke();
  fill(ctx, color, 0.85);
  ctx.beginPath();
  ctx.arc(24, 12, 4, 0, Math.PI * 2);
  ctx.fill();
  fill(ctx, 0xffffff, 0.35);
  ctx.beginPath();
  ctx.arc(22, 11, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawTunic(ctx, color) {
  fill(ctx, color);
  // corpo
  ctx.beginPath();
  ctx.moveTo(16, 12);
  ctx.lineTo(32, 12);
  ctx.lineTo(36, 42);
  ctx.lineTo(12, 42);
  ctx.closePath();
  ctx.fill();
  // gola
  fill(ctx, 0xffffff, 0.18);
  ctx.beginPath();
  ctx.moveTo(18, 12);
  ctx.lineTo(24, 16);
  ctx.lineTo(30, 12);
  ctx.closePath();
  ctx.fill();
  // cinto
  fill(ctx, 0x1a1430, 0.35);
  ctx.fillRect(14, 28, 20, 4);
  fill(ctx, 0xffffff, 0.12);
  ctx.fillRect(16, 16, 4, 18);
}

function drawNecklace(ctx, color) {
  ctx.lineWidth = 2.5;
  stroke(ctx, color);
  ctx.beginPath();
  ctx.arc(24, 10, 14, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  fill(ctx, color);
  ctx.beginPath();
  ctx.moveTo(24, 22);
  ctx.lineTo(30, 34);
  ctx.lineTo(24, 40);
  ctx.lineTo(18, 34);
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0xffffff, 0.25);
  ctx.fillRect(22, 28, 4, 6);
}

function drawBoots(ctx, color) {
  fill(ctx, color);
  // cano
  ctx.fillRect(14, 10, 12, 22);
  // pé
  ctx.beginPath();
  ctx.moveTo(14, 30);
  ctx.lineTo(38, 30);
  ctx.lineTo(38, 38);
  ctx.lineTo(14, 38);
  ctx.closePath();
  ctx.fill();
  // furo (botas furas)
  fill(ctx, 0x1a1430, 0.9);
  ctx.beginPath();
  ctx.arc(20, 20, 3, 0, Math.PI * 2);
  ctx.fill();
  fill(ctx, 0xffffff, 0.15);
  ctx.fillRect(16, 12, 3, 14);
}

const DRAWER_BY_SLOT = {
  hat: drawHat,
  cape: drawCape,
  ring: drawRing,
  tunic: drawTunic,
  necklace: drawNecklace,
  boots: drawBoots,
};

export function itemIconKey(itemId) {
  return `item_icon_${itemId}`;
}

export function ensureItemIconTextures(scene) {
  for (const def of Object.values(ITEM_DEFS)) {
    const key = itemIconKey(def.id);
    if (scene.textures.exists(key)) continue;

    const tex = scene.textures.createCanvas(key, ICON_SIZE, ICON_SIZE);
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);

    fill(ctx, 0x1a1430, 0.35);
    ctx.fillRect(6, 6, 36, 36);

    const draw = DRAWER_BY_SLOT[def.slot];
    if (draw) draw(ctx, def.color);

    tex.refresh();
  }
}
