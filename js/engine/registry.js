import { ERROR_KERNELS, errorDiffusion, thresholdDither } from "./dither.js?v=20260807-3";
import { orderedDither, clusteredHalftone, cmykHalftone } from "./ordered.js?v=20260807-3";
import { noiseDither } from "./noise.js?v=20260807-3";

const errorNames = {
  "floyd-steinberg": "Floyd–Steinberg", "false-floyd-steinberg": "False Floyd–Steinberg", jjn: "Jarvis–Judice–Ninke",
  stucki: "Stucki", atkinson: "Atkinson", burkes: "Burkes", "sierra-3": "Sierra-3", "two-row-sierra": "Two-Row Sierra",
  "sierra-lite": "Sierra Lite", "steven-pigeon": "Steven Pigeon"
};

const entries = Object.keys(ERROR_KERNELS).map((id) => [id, { label: errorNames[id], group: "Error diffusion", process: (data, settings) => errorDiffusion(data, settings, id) }]);
for (const size of [2, 4, 8, 16]) entries.push([`bayer-${size}`, { label: `Bayer ${size}×${size}`, group: "Ordered", process: (data, settings) => orderedDither(data, settings, size) }]);
entries.push(
  ["clustered", { label: "Clustered-dot halftone", group: "Ordered", controls: "halftone", process: clusteredHalftone }],
  ["cmyk-halftone", { label: "CMYK angled halftone", group: "Ordered", controls: "halftone", process: cmykHalftone }],
  ["blue-noise", { label: "Blue noise", group: "Noise", process: (data, settings) => noiseDither(data, settings, "blue") }],
  ["white-noise", { label: "White noise", group: "Noise", process: (data, settings) => noiseDither(data, settings, "white") }],
  ["threshold", { label: "Threshold (no dither)", group: "Comparison", process: thresholdDither }]
);

export const ALGORITHM_REGISTRY = new Map(entries);
export const ALGORITHMS = entries.map(([id, details]) => ({ id, label: details.label, group: details.group, controls: details.controls || "standard" }));

export function runAlgorithm(id, imageData, settings) {
  const algorithm = ALGORITHM_REGISTRY.get(id) || ALGORITHM_REGISTRY.get("floyd-steinberg");
  return algorithm.process(imageData, settings);
}
