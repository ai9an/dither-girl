export const PRESETS = Object.freeze([
  { id: "custom", label: "Custom / current settings", settings: null },
  { id: "game-boy", label: "Game Boy", settings: { algorithm: "floyd-steinberg", grayscale: "luminosity", usePalette: true, palettePreset: "gameboy", pixelSize: 2, contrast: 12, grain: 0 } },
  { id: "newspaper", label: "Newspaper halftone", settings: { algorithm: "clustered", grayscale: "luminosity", usePalette: false, dotAngle: 45, dotSize: 7, contrast: 18, grain: 8 } },
  { id: "one-bit", label: "1-bit threshold", settings: { algorithm: "threshold", grayscale: "luminosity", usePalette: true, palettePreset: "1-bit", threshold: 128, contrast: 8 } },
  { id: "cga-crunch", label: "CGA crunch", settings: { algorithm: "atkinson", grayscale: "none", usePalette: true, palettePreset: "cga", pixelSize: 2, saturation: 130 } },
  { id: "sepia-stucki", label: "Sepia print", settings: { algorithm: "stucki", grayscale: "luminosity", usePalette: true, palettePreset: "sepia", grain: 9 } },
  { id: "cmyk-print", label: "CMYK screenprint", settings: { algorithm: "cmyk-halftone", grayscale: "none", usePalette: false, dotSize: 6, saturation: 125 } },
  { id: "blue-noise", label: "Blue-noise poster", settings: { algorithm: "blue-noise", grayscale: "none", usePalette: true, palettePreset: "c64", posterize: 8 } },
  { id: "spectral-fault", label: "Spectral fault", settings: { algorithm: "atkinson", grayscale: "none", usePalette: false, saturation: 122, chromaticDriftEnabled: true, chromaticDrift: 7 } },
  { id: "deep-transmission", label: "Deep transmission", settings: { algorithm: "blue-noise", grayscale: "luminosity", gradientMode: "tritone", shadowColor: "#05070b", midColor: "#4b6f84", highlightColor: "#d8edf5", usePalette: false, contrast: 14, scanlinesEnabled: true, scanlineStrength: 30, scanlineSpacing: 4 } }
]);
