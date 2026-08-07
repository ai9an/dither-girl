import { nearestColor, normalizePalette } from "./palette.js?v=20260807-3";

export const ERROR_KERNELS = Object.freeze({
  "floyd-steinberg": { divisor: 16, points: [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]] },
  "false-floyd-steinberg": { divisor: 8, points: [[1, 0, 3], [0, 1, 3], [1, 1, 2]] },
  jjn: { divisor: 48, points: [[1, 0, 7], [2, 0, 5], [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3], [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1]] },
  stucki: { divisor: 42, points: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2], [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1]] },
  atkinson: { divisor: 8, points: [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]] },
  burkes: { divisor: 32, points: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2]] },
  "sierra-3": { divisor: 32, points: [[1, 0, 5], [2, 0, 3], [-2, 1, 2], [-1, 1, 4], [0, 1, 5], [1, 1, 4], [2, 1, 2], [-1, 2, 2], [0, 2, 3], [1, 2, 2]] },
  "two-row-sierra": { divisor: 16, points: [[1, 0, 4], [2, 0, 3], [-2, 1, 1], [-1, 1, 2], [0, 1, 3], [1, 1, 2], [2, 1, 1]] },
  "sierra-lite": { divisor: 4, points: [[1, 0, 2], [-1, 1, 1], [0, 1, 1]] },
  "steven-pigeon": { divisor: 14, points: [[1, 0, 2], [2, 0, 1], [-2, 1, 1], [-1, 1, 2], [0, 1, 2], [1, 1, 2], [2, 1, 1], [-1, 2, 1], [0, 2, 1], [1, 2, 1]] }
});

const luminance = (r, g, b) => .2126 * r + .7152 * g + .0722 * b;
const clamp = (value) => Math.min(255, Math.max(0, value));
const quantizeChannel = (value, levels = 6) => Math.round(clamp(value) * (levels - 1) / 255) * 255 / (levels - 1);

function thresholdBias(settings) {
  return 128 - Number(settings.threshold ?? 128);
}

function targetColor(r, g, b, settings, palette) {
  const bias = thresholdBias(settings);
  if (settings.usePalette && palette.length) return nearestColor(clamp(r + bias), clamp(g + bias), clamp(b + bias), palette);
  return [quantizeChannel(r + bias), quantizeChannel(g + bias), quantizeChannel(b + bias)];
}

export function errorDiffusion(imageData, settings = {}, kernelName = "floyd-steinberg") {
  const kernel = ERROR_KERNELS[kernelName] || ERROR_KERNELS["floyd-steinberg"];
  const { width, height } = imageData;
  const work = new Float32Array(imageData.data);
  const output = new Uint8ClampedArray(imageData.data);
  const palette = normalizePalette(settings.palette);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      if (output[index + 3] === 0) continue;
      const chosen = targetColor(work[index], work[index + 1], work[index + 2], settings, palette);
      const errors = [work[index] - chosen[0], work[index + 1] - chosen[1], work[index + 2] - chosen[2]];
      output[index] = chosen[0]; output[index + 1] = chosen[1]; output[index + 2] = chosen[2];
      for (const [dx, dy, weight] of kernel.points) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || nx >= width || ny >= height) continue;
        const target = (ny * width + nx) * 4;
        for (let channel = 0; channel < 3; channel++) work[target + channel] += errors[channel] * weight / kernel.divisor;
      }
    }
  }
  return new ImageData(output, width, height);
}

export function thresholdDither(imageData, settings = {}) {
  const data = new Uint8ClampedArray(imageData.data);
  const palette = normalizePalette(settings.palette);
  const threshold = Number(settings.threshold ?? 128);
  const sortedPalette = [...palette].sort((a, b) => luminance(...a) - luminance(...b));
  const shadow = settings.usePalette && sortedPalette.length ? sortedPalette[0] : [0, 0, 0];
  const highlight = settings.usePalette && sortedPalette.length ? sortedPalette[sortedPalette.length - 1] : [255, 255, 255];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const color = luminance(data[i], data[i + 1], data[i + 2]) >= threshold ? highlight : shadow;
    data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2];
  }
  return new ImageData(data, imageData.width, imageData.height);
}
