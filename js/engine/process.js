import { applyTone, applyGradientMap, applyGrain } from "./tone.js?v=20260807-3";
import { medianCutPalette, mapToPalette } from "./palette.js?v=20260807-3";
import { runAlgorithm } from "./registry.js?v=20260807-3";
import { applyPostEffects } from "./effects.js?v=20260807-3";

export function processImage(imageData, settings = {}) {
  const toneSettings = settings.chromaticEnabled === false ? { ...settings, grayscale: "none", gradientMode: "none" } : settings;
  let result = settings.adjustmentsEnabled === false ? imageData : applyTone(imageData, toneSettings, { applyGradient: false });
  if (settings.chromaticEnabled !== false && settings.adjustmentsEnabled === false && settings.grayscale && settings.grayscale !== "none") {
    result = applyTone(result, { grayscale: settings.grayscale }, { applyGradient: false });
  }
  let algorithmSettings = settings;
  if (settings.quantize) {
    const extractedPalette = medianCutPalette(result, Number(settings.quantizeColors || 8));
    result = mapToPalette(result, extractedPalette);
    if (!settings.usePalette) algorithmSettings = { ...settings, usePalette: true, palette: extractedPalette };
  }
  if (settings.ditherEnabled !== false) result = runAlgorithm(settings.algorithm, result, algorithmSettings);
  if (settings.chromaticEnabled !== false) result = applyGradientMap(result, settings);
  result = applyPostEffects(result, settings);
  return applyGrain(result, settings.adjustmentsEnabled === false ? 0 : settings.grain);
}
