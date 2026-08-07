const clamp = (value) => Math.min(255, Math.max(0, value));

function chromaticDrift(imageData, settings = {}) {
  if (!settings.chromaticDriftEnabled) return imageData;
  const { width, height } = imageData;
  const source = imageData.data;
  const output = new Uint8ClampedArray(source);
  const distance = Math.max(1, Math.round(Number(settings.chromaticDrift || 4)));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const target = (y * width + x) * 4;
    const redX = Math.min(width - 1, x + distance);
    const blueX = Math.max(0, x - distance);
    output[target] = source[(y * width + redX) * 4];
    output[target + 2] = source[(y * width + blueX) * 4 + 2];
  }
  return new ImageData(output, width, height);
}

function scanlineField(imageData, settings = {}) {
  if (!settings.scanlinesEnabled) return imageData;
  const { width, height } = imageData;
  const data = new Uint8ClampedArray(imageData.data);
  const spacing = Math.max(2, Math.round(Number(settings.scanlineSpacing || 4)));
  const strength = Math.min(.8, Math.max(.01, Number(settings.scanlineStrength || 24) / 100));
  for (let y = 0; y < height; y++) {
    const phase = y % spacing;
    if (phase !== spacing - 1) continue;
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      data[index] = clamp(data[index] * (1 - strength));
      data[index + 1] = clamp(data[index + 1] * (1 - strength));
      data[index + 2] = clamp(data[index + 2] * (1 - strength));
    }
  }
  return new ImageData(data, width, height);
}

export const POST_EFFECTS = Object.freeze([
  { id: "chromaticDriftEnabled", label: "Chromatic drift", process: chromaticDrift },
  { id: "scanlinesEnabled", label: "Scanline field", process: scanlineField }
]);

export function applyPostEffects(imageData, settings = {}) {
  return POST_EFFECTS.reduce((result, effect) => effect.process(result, settings), imageData);
}
