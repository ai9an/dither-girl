import { processImage } from "./process.js?v=20260807-3";

self.addEventListener("message", (event) => {
  const { id, width, height, buffer, settings } = event.data;
  try {
    const source = new ImageData(new Uint8ClampedArray(buffer), width, height);
    const result = processImage(source, settings);
    self.postMessage({ id, width, height, buffer: result.data.buffer }, [result.data.buffer]);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});
