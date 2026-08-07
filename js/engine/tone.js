import { hexToRgb } from "./palette.js?v=20260807-3";

const clamp = (value, min = 0, max = 255) => Math.min(max, Math.max(min, value));
const luminance = (r, g, b) => .2126 * r + .7152 * g + .0722 * b;

function grayValue(r, g, b, mode) {
  if (mode === "average") return (r + g + b) / 3;
  if (mode === "red") return r;
  if (mode === "green") return g;
  if (mode === "blue") return b;
  return luminance(r, g, b);
}

function rotateHueAndSaturate(r, g, b, degrees, saturation) {
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let nr = (.213 + cos * .787 - sin * .213) * r + (.715 - cos * .715 - sin * .715) * g + (.072 - cos * .072 + sin * .928) * b;
  let ng = (.213 - cos * .213 + sin * .143) * r + (.715 + cos * .285 + sin * .140) * g + (.072 - cos * .072 - sin * .283) * b;
  let nb = (.213 - cos * .213 - sin * .787) * r + (.715 - cos * .715 + sin * .715) * g + (.072 + cos * .928 + sin * .072) * b;
  const gray = luminance(nr, ng, nb);
  const factor = saturation / 100;
  nr = gray + (nr - gray) * factor;
  ng = gray + (ng - gray) * factor;
  nb = gray + (nb - gray) * factor;
  return [nr, ng, nb];
}

function mix(a, b, amount) {
  return a.map((value, index) => value + (b[index] - value) * amount);
}

function gradientColor(value, settings) {
  const shadow = hexToRgb(settings.shadowColor || "#151515");
  const middle = hexToRgb(settings.midColor || "#8f8f8f");
  const highlight = hexToRgb(settings.highlightColor || "#f5f5f5");
  const position = clamp(value) / 255;
  if (settings.gradientMode === "duotone") return mix(shadow, highlight, position);
  return position <= .5 ? mix(shadow, middle, position * 2) : mix(middle, highlight, (position - .5) * 2);
}

export function applyGradientMap(imageData, settings = {}) {
  if (!settings.gradientMode || settings.gradientMode === "none") return imageData;
  const data = new Uint8ClampedArray(imageData.data);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const color = gradientColor(luminance(data[i], data[i + 1], data[i + 2]), settings);
    data[i] = clamp(color[0]);
    data[i + 1] = clamp(color[1]);
    data[i + 2] = clamp(color[2]);
  }
  return new ImageData(data, imageData.width, imageData.height);
}

export function applyTone(imageData, settings = {}, { applyGradient = true } = {}) {
  const data = new Uint8ClampedArray(imageData.data);
  const brightness = Number(settings.brightness || 0) * 2.55;
  const contrastValue = Number(settings.contrast || 0);
  const contrast = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));
  const gamma = Math.max(.01, Number(settings.gamma || 1));
  const black = Math.min(254, Number(settings.levelBlack || 0));
  const white = Math.max(black + 1, Number(settings.levelWhite ?? 255));
  const posterize = Math.max(2, Number(settings.posterize || 256));
  const posterStep = 255 / (posterize - 1);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    [r, g, b] = rotateHueAndSaturate(r, g, b, Number(settings.hue || 0), Number(settings.saturation ?? 100));
    if (settings.grayscale && settings.grayscale !== "none") {
      const gray = grayValue(r, g, b, settings.grayscale);
      r = gray; g = gray; b = gray;
    }
    r = contrast * (r - 128) + 128 + brightness;
    g = contrast * (g - 128) + 128 + brightness;
    b = contrast * (b - 128) + 128 + brightness;
    const adjust = (value) => {
      value = clamp((value - black) * 255 / (white - black));
      value = 255 * Math.pow(value / 255, 1 / gamma);
      value = Math.round(value / posterStep) * posterStep;
      return settings.invert ? 255 - value : value;
    };
    r = adjust(r); g = adjust(g); b = adjust(b);
    if (applyGradient && settings.gradientMode && settings.gradientMode !== "none") [r, g, b] = gradientColor(luminance(r, g, b), settings);
    data[i] = clamp(r); data[i + 1] = clamp(g); data[i + 2] = clamp(b);
  }
  return new ImageData(data, imageData.width, imageData.height);
}

export function applyGrain(imageData, amount = 0) {
  if (!amount) return imageData;
  const data = new Uint8ClampedArray(imageData.data);
  const strength = Number(amount) * 1.28;
  for (let i = 0; i < data.length; i += 4) {
    const pixel = i / 4;
    const noise = (((pixel * 16807 + 17) % 2147483647) / 2147483647 - .5) * strength;
    data[i] = clamp(data[i] + noise); data[i + 1] = clamp(data[i + 1] + noise); data[i + 2] = clamp(data[i + 2] + noise);
  }
  return new ImageData(data, imageData.width, imageData.height);
}
