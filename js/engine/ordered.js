import { nearestColor, normalizePalette } from "./palette.js?v=20260807-3";

const luminance = (r, g, b) => .2126 * r + .7152 * g + .0722 * b;
const clamp = (value) => Math.min(255, Math.max(0, value));
const quantizeChannel = (value, levels = 6) => Math.round(clamp(value) * (levels - 1) / 255) * 255 / (levels - 1);

function bayer(size) {
  let matrix = [[0]];
  while (matrix.length < size) {
    const n = matrix.length;
    const next = Array.from({ length: n * 2 }, () => Array(n * 2));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const value = matrix[y][x] * 4;
      next[y][x] = value; next[y][x + n] = value + 2;
      next[y + n][x] = value + 3; next[y + n][x + n] = value + 1;
    }
    matrix = next;
  }
  return matrix;
}

export function orderedDither(imageData, settings = {}, size = 4) {
  const matrix = bayer(size);
  const data = new Uint8ClampedArray(imageData.data);
  const palette = normalizePalette(settings.palette);
  const bias = 128 - Number(settings.threshold ?? 128);
  for (let y = 0; y < imageData.height; y++) for (let x = 0; x < imageData.width; x++) {
    const i = (y * imageData.width + x) * 4;
    if (data[i + 3] === 0) continue;
    const offset = ((matrix[y % size][x % size] + .5) / (size * size) - .5) * 96;
    if (settings.usePalette && palette.length) {
      const color = nearestColor(clamp(data[i] + offset + bias), clamp(data[i + 1] + offset + bias), clamp(data[i + 2] + offset + bias), palette);
      data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2];
    } else {
      data[i] = quantizeChannel(data[i] + offset + bias);
      data[i + 1] = quantizeChannel(data[i + 1] + offset + bias);
      data[i + 2] = quantizeChannel(data[i + 2] + offset + bias);
    }
  }
  return new ImageData(data, imageData.width, imageData.height);
}

export function clusteredHalftone(imageData, settings = {}) {
  const data = new Uint8ClampedArray(imageData.data);
  const size = Math.max(2, Number(settings.dotSize || 6));
  const angle = Number(settings.dotAngle || 45) * Math.PI / 180;
  const cos = Math.cos(angle); const sin = Math.sin(angle);
  const palette = normalizePalette(settings.palette);
  for (let y = 0; y < imageData.height; y++) for (let x = 0; x < imageData.width; x++) {
    const i = (y * imageData.width + x) * 4;
    if (data[i + 3] === 0) continue;
    const rx = x * cos - y * sin; const ry = x * sin + y * cos;
    const dx = ((rx % size) + size) % size - size / 2;
    const dy = ((ry % size) + size) % size - size / 2;
    const radial = Math.min(1, Math.sqrt(dx * dx + dy * dy) / (size * .707));
    const value = luminance(data[i], data[i + 1], data[i + 2]) / 255 > 1 - radial ? 255 : 0;
    if (settings.usePalette && palette.length) {
      const color = nearestColor(value, value, value, palette);
      data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2];
    } else data[i] = data[i + 1] = data[i + 2] = value;
  }
  return new ImageData(data, imageData.width, imageData.height);
}

function screen(value, x, y, angle, size) {
  const radians = angle * Math.PI / 180;
  const rx = x * Math.cos(radians) - y * Math.sin(radians);
  const ry = x * Math.sin(radians) + y * Math.cos(radians);
  const wave = (Math.sin(rx * Math.PI * 2 / size) + Math.sin(ry * Math.PI * 2 / size) + 2) / 4;
  return value / 255 > wave ? 255 : 0;
}

export function cmykHalftone(imageData, settings = {}) {
  const data = new Uint8ClampedArray(imageData.data);
  const size = Math.max(2, Number(settings.dotSize || 6));
  const palette = normalizePalette(settings.palette);
  for (let y = 0; y < imageData.height; y++) for (let x = 0; x < imageData.width; x++) {
    const i = (y * imageData.width + x) * 4;
    if (data[i + 3] === 0) continue;
    const c = screen(255 - data[i], x, y, 15, size);
    const m = screen(255 - data[i + 1], x, y, 75, size);
    const yy = screen(255 - data[i + 2], x, y, 0, size);
    const kBase = 255 - Math.max(data[i], data[i + 1], data[i + 2]);
    const k = screen(kBase, x, y, 45, size);
    let r = 255 - Math.min(255, c + k); let g = 255 - Math.min(255, m + k); let b = 255 - Math.min(255, yy + k);
    if (settings.usePalette && palette.length) [r, g, b] = nearestColor(r, g, b, palette);
    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }
  return new ImageData(data, imageData.width, imageData.height);
}
