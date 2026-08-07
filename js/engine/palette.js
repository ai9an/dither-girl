export const PALETTE_PRESETS = Object.freeze({
  "1-bit": ["#111111", "#f4f1e8"],
  "mono-4": ["#101317", "#565f66", "#a9b0b3", "#f2f0e9"],
  "gray-8": ["#000000", "#242424", "#494949", "#6d6d6d", "#929292", "#b6b6b6", "#dbdbdb", "#ffffff"],
  gameboy: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
  cga: ["#000000", "#0000aa", "#00aa00", "#00aaaa", "#aa0000", "#aa00aa", "#aa5500", "#aaaaaa", "#555555", "#5555ff", "#55ff55", "#55ffff", "#ff5555", "#ff55ff", "#ffff55", "#ffffff"],
  ega: ["#000000", "#0000aa", "#00aa00", "#00aaaa", "#aa0000", "#aa00aa", "#aa5500", "#aaaaaa", "#555555", "#5555ff", "#55ff55", "#55ffff", "#ff5555", "#ff55ff", "#ffff55", "#ffffff"],
  c64: ["#000000", "#ffffff", "#813338", "#75cec8", "#8e3c97", "#56ac4d", "#2e2c9b", "#edf171", "#8e5029", "#553800", "#c46c71", "#4a4a4a", "#7b7b7b", "#a9ff9f", "#706deb", "#b2b2b2"],
  "pico-8": ["#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8", "#ff004d", "#ffa300", "#ffec27", "#00e436", "#29adff", "#83769c", "#ff77a8", "#ffccaa"],
  sepia: ["#241a12", "#5c4026", "#9a7445", "#d7bb78", "#f2e5bd"],
  ocean: ["#071821", "#0b2f3a", "#164e63", "#247b89", "#3aa6a0", "#7cc9b5", "#c7e6cf", "#f4f1df"],
  ember: ["#160d12", "#3b1725", "#72263d", "#a63c3c", "#d46332", "#ed9b40", "#f4ce78", "#fff3c7"],
  pastel: ["#28263d", "#4d426d", "#766c91", "#a49ab5", "#d9c8c4", "#f2d3ab", "#eaa0a2", "#bd6985", "#7f4f78", "#54718c", "#65a2a6", "#9ac7a5", "#d6e1a3", "#f2eda7", "#f2f0e9", "#9aabc2"],
  "studio-32": ["#08090d", "#181b25", "#2b2d42", "#463a55", "#653d5c", "#8a4f64", "#bd6b6b", "#e38b73", "#f2b27d", "#f7d69a", "#fff1c1", "#d7e6af", "#9dcc9a", "#61a889", "#3b7f7a", "#285a68", "#1e3b55", "#294d7a", "#3e70a8", "#63a2cf", "#9ac9e3", "#d5edf2", "#f4f4ef", "#c7c8cc", "#969aa3", "#676b75", "#484b54", "#765f91", "#a879b2", "#d89ab7", "#efbdd0", "#ffffff"]
});

export const PALETTE_PRESET_LABELS = Object.freeze({
  "1-bit": "1-bit",
  "mono-4": "Monochrome 4",
  "gray-8": "Grayscale 8",
  gameboy: "Game Boy",
  cga: "CGA 16",
  ega: "EGA 16",
  c64: "C64 16",
  "pico-8": "PICO-8",
  sepia: "Sepia print",
  ocean: "Ocean 8",
  ember: "Ember 8",
  pastel: "Pastel 16",
  "studio-32": "Studio 32"
});

export function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? [...value].map((c) => c + c).join("") : value;
  const number = Number.parseInt(full, 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

export function normalizePalette(colors = []) {
  return colors.map((color) => Array.isArray(color) ? color.slice(0, 3) : hexToRgb(color));
}

export function nearestColor(r, g, b, palette) {
  let best = palette[0] || [0, 0, 0];
  let bestDistance = Infinity;
  for (const color of palette) {
    const dr = r - color[0];
    const dg = g - color[1];
    const db = b - color[2];
    const distance = dr * dr * .3 + dg * dg * .59 + db * db * .11;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = color;
    }
  }
  return best;
}

function channelRange(colors, channel) {
  let min = 255;
  let max = 0;
  for (const color of colors) {
    min = Math.min(min, color[channel]);
    max = Math.max(max, color[channel]);
  }
  return max - min;
}

export function medianCutPalette(imageData, colorCount = 8) {
  const pixels = [];
  const stride = Math.max(1, Math.floor((imageData.width * imageData.height) / 60000));
  for (let pixel = 0; pixel < imageData.width * imageData.height; pixel += stride) {
    const i = pixel * 4;
    if (imageData.data[i + 3] > 8) pixels.push([imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]]);
  }
  if (!pixels.length) return [[0, 0, 0]];
  let boxes = [pixels];
  while (boxes.length < colorCount) {
    boxes.sort((a, b) => {
      const ar = Math.max(channelRange(a, 0), channelRange(a, 1), channelRange(a, 2));
      const br = Math.max(channelRange(b, 0), channelRange(b, 1), channelRange(b, 2));
      return br * b.length - ar * a.length;
    });
    const box = boxes.shift();
    if (!box || box.length < 2) {
      if (box) boxes.push(box);
      break;
    }
    const ranges = [channelRange(box, 0), channelRange(box, 1), channelRange(box, 2)];
    const channel = ranges.indexOf(Math.max(...ranges));
    box.sort((a, b) => a[channel] - b[channel]);
    const middle = Math.floor(box.length / 2);
    boxes.push(box.slice(0, middle), box.slice(middle));
  }
  return boxes.map((box) => {
    const sum = box.reduce((acc, color) => [acc[0] + color[0], acc[1] + color[1], acc[2] + color[2]], [0, 0, 0]);
    return sum.map((value) => Math.round(value / box.length));
  });
}

export function mapToPalette(imageData, palette) {
  const data = new Uint8ClampedArray(imageData.data);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const color = nearestColor(data[i], data[i + 1], data[i + 2], palette);
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
  }
  return new ImageData(data, imageData.width, imageData.height);
}
