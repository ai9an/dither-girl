import { nearestColor, normalizePalette } from "./palette.js?v=20260807-3";

const BLUE_NOISE_8 = [0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
const luminance = (r, g, b) => .2126 * r + .7152 * g + .0722 * b;
const clamp = (value) => Math.min(255, Math.max(0, value));
const quantizeChannel = (value, levels = 6) => Math.round(clamp(value) * (levels - 1) / 255) * 255 / (levels - 1);
const hash = (x, y) => ((Math.imul(x + 17, 374761393) ^ Math.imul(y + 31, 668265263)) >>> 0) / 4294967295;

export function noiseDither(imageData, settings = {}, kind = "white") {
  const data = new Uint8ClampedArray(imageData.data);
  const palette = normalizePalette(settings.palette);
  const bias = 128 - Number(settings.threshold ?? 128);
  for (let y = 0; y < imageData.height; y++) for (let x = 0; x < imageData.width; x++) {
    const i = (y * imageData.width + x) * 4;
    if (data[i + 3] === 0) continue;
    const noise = kind === "blue" ? (BLUE_NOISE_8[(y % 8) * 8 + (x % 8)] + .5) / 64 : hash(x, y);
    const offset = (noise - .5) * 255;
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
