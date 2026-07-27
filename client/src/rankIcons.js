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

 // --- 42 icon drawers ---

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

function drawAstral(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 0.8);
  ctx.beginPath();
  ctx.arc(16, 16, 10, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    fill(ctx, 0xffffff, 0.5);
    ctx.beginPath();
    ctx.arc(16 + 7 * Math.cos(a), 16 + 7 * Math.sin(a), 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  fill(ctx, 0xffffff, 0.9);
  ctx.beginPath();
  ctx.arc(16, 16, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawVoid(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, 0x000000, 0.8);
  ctx.beginPath();
  ctx.arc(16, 16, 11, 0, Math.PI * 2);
  ctx.fill();
  stroke(ctx, color, 1, 2.5);
  ctx.beginPath();
  ctx.arc(16, 16, 11, 0, Math.PI * 2);
  ctx.stroke();
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.arc(16, 16, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawInfinity(ctx, color) {
  bgCircle(ctx, color);
  stroke(ctx, color, 1, 3);
  ctx.beginPath();
  ctx.moveTo(8, 16);
  ctx.bezierCurveTo(8, 8, 24, 8, 24, 16);
  ctx.bezierCurveTo(24, 24, 8, 24, 8, 16);
  ctx.stroke();
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.arc(16, 16, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawGalaxy(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 0.9);
  ctx.beginPath();
  ctx.ellipse(16, 16, 12, 6, -Math.PI / 3, 0, Math.PI * 2);
  ctx.fill();
  fill(ctx, 0xffffff, 0.4);
  ctx.beginPath();
  ctx.ellipse(16, 16, 6, 3, -Math.PI / 3, 0, Math.PI * 2);
  ctx.fill();
  fill(ctx, 0xffffff, 0.8);
  ctx.beginPath();
  ctx.arc(16, 16, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawNebula(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 0.7);
  ctx.beginPath();
  ctx.arc(16, 16, 11, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    fill(ctx, 0xffffff, 0.3 + i * 0.03);
    ctx.beginPath();
    ctx.arc(16 + 5 * Math.cos(a), 16 + 5 * Math.sin(a), 4 + i, 0, Math.PI * 2);
    ctx.fill();
  }
  fill(ctx, color, 0.9);
  ctx.beginPath();
  ctx.arc(16, 16, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPhoenix(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 0.9);
  ctx.beginPath();
  ctx.moveTo(16, 4);
  ctx.lineTo(22, 10);
  ctx.lineTo(20, 16);
  ctx.lineTo(26, 18);
  ctx.lineTo(22, 22);
  ctx.lineTo(20, 26);
  ctx.lineTo(16, 24);
  ctx.lineTo(12, 26);
  ctx.lineTo(10, 22);
  ctx.lineTo(6, 18);
  ctx.lineTo(12, 16);
  ctx.lineTo(10, 10);
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0xffffff, 0.3);
  ctx.beginPath();
  ctx.arc(16, 10, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawDragon(ctx, color) {
  bgCircle(ctx, color);
  stroke(ctx, color, 1, 2.5);
  ctx.beginPath();
  ctx.moveTo(5, 20);
  ctx.lineTo(10, 12);
  ctx.lineTo(16, 8);
  ctx.lineTo(22, 12);
  ctx.lineTo(27, 20);
  ctx.lineTo(22, 24);
  ctx.lineTo(10, 24);
  ctx.closePath();
  ctx.stroke();
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.moveTo(8, 16);
  ctx.lineTo(16, 6);
  ctx.lineTo(24, 16);
  ctx.closePath();
  ctx.fill();
}

function drawTitan(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 0.9);
  ctx.beginPath();
  ctx.moveTo(16, 3);
  ctx.lineTo(24, 8);
  ctx.lineTo(24, 18);
  ctx.lineTo(20, 28);
  ctx.lineTo(12, 28);
  ctx.lineTo(8, 18);
  ctx.lineTo(8, 8);
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0xffffff, 0.25);
  ctx.beginPath();
  ctx.moveTo(16, 7);
  ctx.lineTo(20, 10);
  ctx.lineTo(20, 18);
  ctx.lineTo(16, 24);
  ctx.lineTo(12, 18);
  ctx.lineTo(12, 10);
  ctx.closePath();
  ctx.fill();
}

function drawDivine(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.arc(16, 16, 11, 0, Math.PI * 2);
  ctx.fill();
  stroke(ctx, 0xffffff, 0.5, 1.5);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(16 + 11 * Math.cos(a), 16 + 11 * Math.sin(a));
    ctx.lineTo(16 + 14 * Math.cos(a), 16 + 14 * Math.sin(a));
    ctx.stroke();
  }
  fill(ctx, 0xffffff, 0.4);
  ctx.beginPath();
  ctx.arc(16, 16, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrownGold(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.moveTo(6, 22);
  ctx.lineTo(6, 12);
  ctx.lineTo(9, 8);
  ctx.lineTo(12, 14);
  ctx.lineTo(16, 6);
  ctx.lineTo(20, 14);
  ctx.lineTo(23, 8);
  ctx.lineTo(26, 12);
  ctx.lineTo(26, 22);
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0xffffff, 0.3);
  for (const x of [9, 16, 23]) {
    ctx.beginPath();
    ctx.arc(x, 8, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSupernova(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 1);
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 === 0 ? 13 : 6;
    const x = 16 + r * Math.cos(a);
    const y = 16 + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0xffffff, 0.5);
  ctx.beginPath();
  ctx.arc(16, 16, 4, 0, Math.PI * 2);
  ctx.fill();
  fill(ctx, color, 0.8);
  ctx.beginPath();
  ctx.arc(16, 16, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawQuasar(ctx, color) {
  bgCircle(ctx, color);
  stroke(ctx, 0xffffff, 0.6, 1.5);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(16, 16);
    ctx.lineTo(16 + 13 * Math.cos(a), 16 + 13 * Math.sin(a));
    ctx.stroke();
  }
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.arc(16, 16, 5, 0, Math.PI * 2);
  ctx.fill();
  fill(ctx, 0xffffff, 0.5);
  ctx.beginPath();
  ctx.arc(16, 16, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPortal(ctx, color) {
  bgCircle(ctx, color);
  stroke(ctx, color, 1, 4);
  ctx.beginPath();
  ctx.arc(16, 16, 9, 0, Math.PI * 2);
  ctx.stroke();
  const innerColor = (color >>> 0) + 0x222222;
  fill(ctx, innerColor, 0.6);
  ctx.beginPath();
  ctx.arc(16, 16, 7.5, 0, Math.PI * 2);
  ctx.fill();
  stroke(ctx, 0xffffff, 0.4, 1.5);
  ctx.beginPath();
  ctx.moveTo(11, 11);
  ctx.lineTo(21, 21);
  ctx.moveTo(21, 11);
  ctx.lineTo(11, 21);
  ctx.stroke();
}

function drawAether(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 0.7);
  ctx.beginPath();
  ctx.arc(16, 16, 11, 0, Math.PI * 2);
  ctx.fill();
  stroke(ctx, 0xffffff, 0.6, 1.2);
  for (let i = 0; i < 3; i++) {
    const y = 8 + i * 6;
    ctx.beginPath();
    ctx.moveTo(6, y);
    ctx.quadraticCurveTo(16, y + (i % 2 ? 6 : -4), 26, y);
    ctx.stroke();
  }
  fill(ctx, 0xffffff, 0.5);
  ctx.beginPath();
  ctx.arc(16, 16, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawRune(ctx, color) {
  bgCircle(ctx, color);
  stroke(ctx, color, 1, 2.5);
  ctx.beginPath();
  ctx.moveTo(10, 6);
  ctx.lineTo(16, 14);
  ctx.lineTo(22, 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16, 14);
  ctx.lineTo(16, 26);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8, 18);
  ctx.lineTo(24, 18);
  ctx.stroke();
  fill(ctx, 0xffffff, 0.5);
  ctx.beginPath();
  ctx.arc(16, 14, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawElemental(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 0.9);
  ctx.beginPath();
  ctx.moveTo(16, 2);
  ctx.lineTo(28, 16);
  ctx.lineTo(24, 30);
  ctx.lineTo(8, 30);
  ctx.lineTo(4, 16);
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0xffffff, 0.3);
  ctx.beginPath();
  ctx.moveTo(16, 7);
  ctx.lineTo(23, 16);
  ctx.lineTo(20, 25);
  ctx.lineTo(12, 25);
  ctx.lineTo(9, 16);
  ctx.closePath();
  ctx.fill();
}

function drawSigil(ctx, color) {
  bgCircle(ctx, color);
  stroke(ctx, color, 1, 2);
  ctx.beginPath();
  ctx.arc(16, 16, 10, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(16, 16);
    ctx.lineTo(16 + 10 * Math.cos(a), 16 + 10 * Math.sin(a));
    ctx.stroke();
  }
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.arc(16, 16, 3.5, 0, Math.PI * 2);
  ctx.fill();
  fill(ctx, 0xffffff, 0.5);
  ctx.beginPath();
  ctx.arc(16, 16, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawMandala(ctx, color) {
  bgCircle(ctx, color);
  stroke(ctx, color, 1, 1.5);
  for (let r = 3; r <= 11; r += 2) {
    ctx.beginPath();
    ctx.arc(16, 16, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(16 + 3 * Math.cos(a), 16 + 3 * Math.sin(a));
    ctx.lineTo(16 + 11 * Math.cos(a), 16 + 11 * Math.sin(a));
    ctx.stroke();
  }
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.arc(16, 16, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawOuroboros(ctx, color) {
  bgCircle(ctx, color);
  stroke(ctx, color, 1, 3);
  ctx.beginPath();
  ctx.arc(16, 16, 9, Math.PI * 0.3, Math.PI * 2.3);
  ctx.stroke();
  fill(ctx, color, 1);
  ctx.beginPath();
  ctx.arc(22, 12, 3, 0, Math.PI * 2);
  ctx.fill();
  fill(ctx, 0x000000, 0.7);
  ctx.beginPath();
  ctx.arc(22, 12, 1.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawTranscend(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 0.8);
  ctx.beginPath();
  ctx.moveTo(16, 2);
  ctx.lineTo(22, 14);
  ctx.lineTo(30, 14);
  ctx.lineTo(24, 22);
  ctx.lineTo(28, 30);
  ctx.lineTo(16, 24);
  ctx.lineTo(4, 30);
  ctx.lineTo(8, 22);
  ctx.lineTo(2, 14);
  ctx.lineTo(10, 14);
  ctx.closePath();
  ctx.fill();
  fill(ctx, 0xffffff, 0.4);
  ctx.beginPath();
  ctx.moveTo(16, 7);
  ctx.lineTo(20, 14);
  ctx.lineTo(25, 14);
  ctx.lineTo(21, 19);
  ctx.lineTo(23, 25);
  ctx.lineTo(16, 20);
  ctx.lineTo(9, 25);
  ctx.lineTo(11, 19);
  ctx.lineTo(7, 14);
  ctx.lineTo(12, 14);
  ctx.closePath();
  ctx.fill();
}

function drawOmnipotent(ctx, color) {
  bgCircle(ctx, color);
  fill(ctx, color, 0.9);
  ctx.beginPath();
  ctx.arc(16, 16, 12, 0, Math.PI * 2);
  ctx.fill();
  stroke(ctx, 0xffffff, 0.6, 1);
  // concentric triangles
  for (let rot = 0; rot < 3; rot++) {
    const off = (rot / 3) * Math.PI;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + off;
      const x = 16 + 9 * Math.cos(a);
      const y = 16 + 9 * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  fill(ctx, 0xffffff, 0.8);
  ctx.beginPath();
  ctx.arc(16, 16, 3, 0, Math.PI * 2);
  ctx.fill();
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
  drawAstral,     // 20 (101–105)
  drawVoid,       // 21 (106–110)
  drawInfinity,   // 22 (111–115)
  drawGalaxy,     // 23 (116–120)
  drawNebula,     // 24 (121–125)
  drawPhoenix,    // 25 (126–130)
  drawDragon,     // 26 (131–135)
  drawTitan,      // 27 (136–140)
  drawDivine,     // 28 (141–145)
  drawCrownGold,  // 29 (146–150)
  drawSupernova,  // 30 (151–155)
  drawQuasar,     // 31 (156–160)
  drawPortal,     // 32 (161–165)
  drawAether,     // 33 (166–170)
  drawRune,       // 34 (171–175)
  drawElemental,  // 35 (176–180)
  drawSigil,      // 36 (181–185)
  drawMandala,    // 37 (186–190)
  drawOuroboros,  // 38 (191–195)
  drawTranscend,  // 39 (196–200)
  drawOmnipotent, // 40 (201–205)
  drawCosmic,     // 41 (206–210)
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
