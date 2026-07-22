/** Ícones procedurais para os ranks de nível do personagem. */

import { iconGroupForLevel, MAX_LEVEL } from './characterLevel.js';

const ICON_SIZE = 32;

function hexRgb(color) {
  const c = color >>> 0;
  return { r: (c >> 16) & 0xff, g: (c >> 8) & 0xff, b: c & 0xff };
}

function fill(ctx, color, alpha = 1) {
  const { r, g, b } = hexRgb(color);
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
}

function stroke(ctx, color, alpha = 1, width = 2) {
  const { r, g, b } = hexRgb(color);
  ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
  ctx.lineWidth = width;
}

function bgCircle(ctx, lvlColor) {
  fill(ctx, 0x0a0814, 0.7);
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, Math.PI * 2);
  ctx.fill();
  stroke(ctx, lvlColor, 0.4, 1.2);
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, Math.PI * 2);
  ctx.stroke();
}

// --- 20 icon drawers ---

function drawOrb(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.arc(16, 16, 8, 0, Math.PI * 2);
  ctx.fill();
  fill(ctx, 0xffffff, 0.35);
  ctx.beginPath();
  ctx.arc(13, 13, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawDiamond(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.moveTo(16, 6);
  ctx.lineTo(24, 16);
  ctx.lineTo(16, 26);
  ctx.lineTo(8, 16);
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0xffffff, 0.25);
  ctx.beginPath();
  ctx.moveTo(16, 8);
  ctx.lineTo(20, 16);
  ctx.lineTo(16, 24);
  ctx.lineTo(12, 16);
  ctx.closePath();
  ctx.fill();
}

function drawTriangle(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.moveTo(16, 6);
  ctx.lineTo(25, 26);
  ctx.lineTo(7, 26);
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0xffffff, 0.2);
  ctx.beginPath();
  ctx.moveTo(16, 10);
  ctx.lineTo(20, 22);
  ctx.lineTo(12, 22);
  ctx.closePath();
  ctx.fill();
}

function drawHexagon(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = 16 + 10 * Math.cos(a);
    const y = 16 + 10 * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0xffffff, 0.25);
  ctx.beginPath();
  ctx.arc(16, 16, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawStar(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const x = 16 + 11 * Math.cos(a);
    const y = 16 + 11 * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    const ia = a + Math.PI / 5;
    ctx.lineTo(16 + 4.5 * Math.cos(ia), 16 + 4.5 * Math.sin(ia));
  }
  ctx.closePath();
  ctx.fill();
}

function drawCross(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.fillRect(11, 4, 10, 24);
  ctx.fillRect(4, 11, 24, 10);
  fill(ctx, 0xffffff, 0.2);
  ctx.fillRect(13, 6, 6, 20);
  ctx.fillRect(6, 13, 20, 6);
}

function drawXMarks(ctx, color) {
  bgCircle(ctx, color);
  stroke(ctx, color, 1, 3.5);
  ctx.beginPath();
  ctx.moveTo(7, 7);
  ctx.lineTo(25, 25);
  ctx.moveTo(25, 7);
  ctx.lineTo(7, 25);
  ctx.stroke();
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.arc(16, 16, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpiral(ctx, color) {
  bgCircle(ctx, color);
  stroke(ctx, color, 1, 2.2);
  ctx.beginPath();
  const turns = 2.2;
  const points = 40;
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * turns * Math.PI * 2;
    const r = 1 + (i / points) * 12;
    const x = 16 + r * Math.cos(t);
    const y = 16 + r * Math.sin(t);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawRing(ctx, color) {
  bgCircle(ctx, color);
  stroke(ctx, color, 1, 3.5);
  ctx.beginPath();
  ctx.arc(16, 16, 9, 0, Math.PI * 2);
  ctx.stroke();
  fill(ctx, color, 0.9);
  ctx.beginPath();
  ctx.arc(16, 8, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrown(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.moveTo(6, 22);
  ctx.lineTo(6, 14);
  ctx.lineTo(10, 8);
  ctx.lineTo(16, 14);
  ctx.lineTo(22, 8);
  ctx.lineTo(26, 14);
  ctx.lineTo(26, 22);
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0xffffff, 0.2);
  ctx.beginPath();
  ctx.arc(10, 8, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(22, 8, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawSun(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.arc(16, 16, 7, 0, Math.PI * 2);
  ctx.fill();
  stroke(ctx, color, 1, 2);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(16 + 8 * Math.cos(a), 16 + 8 * Math.sin(a));
    ctx.lineTo(16 + 13 * Math.cos(a), 16 + 13 * Math.sin(a));
    ctx.stroke();
  }
}

function drawEye(ctx, color) {
  bgCircle(ctx, color);
  stroke(ctx, color, 1, 2.2);
  ctx.beginPath();
  ctx.ellipse(16, 16, 11, 7, 0, 0, Math.PI * 2);
  ctx.stroke();
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.arc(16, 16, 4, 0, Math.PI * 2);
  ctx.fill();
  fill(ctx, 0x0a0814, 0.9);
  ctx.beginPath();
  ctx.arc(16, 16, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawMoon(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.arc(17, 16, 11, 0, Math.PI * 2);
  ctx.fill();
  fill(ctx, 0x0a0814, 0.85);
  ctx.beginPath();
  ctx.arc(22, 13, 9.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawShield(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.moveTo(16, 3);
  ctx.lineTo(24, 7);
  ctx.lineTo(22, 17);
  ctx.lineTo(16, 29);
  ctx.lineTo(10, 17);
  ctx.lineTo(8, 7);
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0xffffff, 0.25);
  ctx.beginPath();
  ctx.moveTo(16, 7);
  ctx.lineTo(20, 9);
  ctx.lineTo(19, 16);
  ctx.lineTo(16, 23);
  ctx.lineTo(13, 16);
  ctx.lineTo(12, 9);
  ctx.closePath();
  ctx.fill();
}

function drawDoubleRing(ctx, color) {
  bgCircle(ctx, color);
  stroke(ctx, color, 1, 2.5);
  ctx.beginPath();
  ctx.arc(16, 16, 10, 0, Math.PI * 2);
  ctx.stroke();
  stroke(ctx, color, 0.65, 1.8);
  ctx.beginPath();
  ctx.arc(16, 16, 6, 0, Math.PI * 2);
  ctx.stroke();
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.arc(16, 16, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawTriangleEye(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.moveTo(16, 5);
  ctx.lineTo(25, 27);
  ctx.lineTo(7, 27);
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0xffffff, 0.25);
  ctx.beginPath();
  ctx.moveTo(16, 9);
  ctx.lineTo(21, 23);
  ctx.lineTo(11, 23);
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0x0a0814, 0.8);
  ctx.beginPath();
  ctx.arc(16, 18, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawPentagram(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const x = 16 + 11 * Math.cos(a);
    const y = 16 + 11 * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0x0a0814, 0.65);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const x = 16 + 5 * Math.cos(a);
    const y = 16 + 5 * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawStarBurst(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = i % 2 === 0 ? 12 : 6;
    const x = 16 + r * Math.cos(a);
    const y = 16 + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0xffffff, 0.3);
  ctx.beginPath();
  ctx.arc(16, 16, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawYinYang(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.arc(16, 16, 11, 0, Math.PI * 2);
  ctx.fill();
  fill(ctx, 0x0a0814, 0.7);
  ctx.beginPath();
  ctx.arc(16, 11, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(16, 21, 5.5, 0, Math.PI * 2);
  ctx.fill();
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.arc(16, 11, 2, 0, Math.PI * 2);
  ctx.fill();
  fill(ctx, 0x0a0814, 0.7);
  ctx.beginPath();
  ctx.arc(16, 21, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawCosmic(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.arc(16, 16, 10, 0, Math.PI * 2);
  ctx.fill();
  stroke(ctx, 0xffffff, 0.4, 1);
  // concentric arcs
  for (let r = 3; r <= 9; r += 3) {
    ctx.beginPath();
    ctx.arc(16, 16, r, 0, Math.PI * 1.5);
    ctx.stroke();
  }
  fill(ctx, 0xffffff, 0.7);
  ctx.beginPath();
  ctx.arc(16, 16, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // orbits
  stroke(ctx, 0xffffff, 0.25, 0.8);
  ctx.beginPath();
  ctx.ellipse(16, 16, 13, 5, Math.PI / 4, 0, Math.PI * 2);
  ctx.stroke();
}

const DRAWERS = [
  drawOrb,        // 0  (1–5)
  drawDiamond,    // 1  (6–10)
  drawTriangle,   // 2  (11–15)
  drawHexagon,    // 3  (16–20)
  drawStar,       // 4  (21–25)
  drawCross,      // 5  (26–30)
  drawXMarks,     // 6  (31–35)
  drawSpiral,     // 7  (36–40)
  drawRing,       // 8  (41–45)
  drawCrown,      // 9  (46–50)
  drawSun,        // 10 (51–55)
  drawEye,        // 11 (56–60)
  drawMoon,       // 12 (61–65)
  drawShield,     // 13 (66–70)
  drawDoubleRing, // 14 (71–75)
  drawTriangleEye,// 15 (76–80)
  drawPentagram,  // 16 (81–85)
  drawStarBurst,  // 17 (86–90)
  drawYinYang,    // 18 (91–95)
  drawCosmic,     // 19 (96–100)
];

export function rankIconKey(groupIndex) {
  return `rank_icon_${groupIndex}`;
}

export function ensureRankIconTextures(scene) {
  for (let g = 0; g < DRAWERS.length; g++) {
    const key = rankIconKey(g);
    if (scene.textures.exists(key)) continue;

    const tex = scene.textures.createCanvas(key, ICON_SIZE, ICON_SIZE);
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
    DRAWERS[g](ctx, 0x6b5cff); // cor default, sobrescrita pelo tint
    tex.refresh();
  }
}

export function rankIconKeyForLevel(level) {
  return rankIconKey(iconGroupForLevel(level));
}
