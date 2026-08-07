import { processImage } from "./engine/process.js?v=20260807-3";
import { chooseRecorderFormat, recordProcessedVideo } from "./engine/video.js?v=20260807-3";
import { setupControls, getSettings, applySettings, resetEffectSettings } from "./ui/controls.js?v=20260807-5";
import { createOrbitalScene } from "./ui/scene.js?v=20260807-3";

const $ = (id) => document.getElementById(id);
const state = {
  kind: null,
  bitmap: null,
  objectUrl: null,
  sourceWidth: 0,
  sourceHeight: 0,
  sourceName: "dither-girl",
  renderToken: 0,
  renderTimer: 0,
  historyTimer: 0,
  exporting: false,
  frameLoopActive: false,
  frameCallbackId: 0,
  frameCallbackKind: null
};

let history = [];
let historyIndex = -1;
let applyingHistory = false;
let defaultSettings;

function setStatus(message, stateName = "ready") {
  if (typeof stateName === "boolean") stateName = stateName ? "error" : "ready";
  const indicator = document.createElement("i");
  indicator.className = "status-indicator";
  indicator.setAttribute("aria-hidden", "true");
  const prefix = document.createElement("span");
  prefix.textContent = `${stateName === "error" ? "ERR" : stateName === "busy" ? "RUN" : "SYS"} `;
  const copy = document.createElement("b");
  copy.textContent = message;
  $("status").replaceChildren(indicator, prefix, copy);
  $("status").dataset.state = stateName;
  $("status").classList.toggle("error", stateName === "error");
  document.body.classList.toggle("is-processing", stateName === "busy");
}

class PixelProcessor {
  constructor() {
    this.worker = null;
    this.requests = new Map();
    this.nextId = 1;
    try {
      this.worker = new Worker(new URL("./engine/worker.js?v=20260807-3", import.meta.url), { type: "module" });
      this.worker.addEventListener("message", (event) => {
        const request = this.requests.get(event.data.id);
        if (!request) return;
        this.requests.delete(event.data.id);
        if (event.data.error) request.reject(new Error(event.data.error));
        else request.resolve(new ImageData(new Uint8ClampedArray(event.data.buffer), event.data.width, event.data.height));
      });
      this.worker.addEventListener("error", () => this.disableWorker());
    } catch {
      this.worker = null;
    }
  }

  disableWorker() {
    this.worker?.terminate();
    this.worker = null;
    for (const request of this.requests.values()) {
      try { request.resolve(processImage(request.source, request.settings)); }
      catch (error) { request.reject(error); }
    }
    this.requests.clear();
  }

  process(source, settings) {
    if (!this.worker) return Promise.resolve().then(() => processImage(source, settings));
    const id = this.nextId++;
    const copy = new Uint8ClampedArray(source.data);
    return new Promise((resolve, reject) => {
      this.requests.set(id, { resolve, reject, source, settings });
      this.worker.postMessage({ id, width: source.width, height: source.height, buffer: copy.buffer, settings }, [copy.buffer]);
    });
  }
}

const processor = new PixelProcessor();
const sourceCanvas = $("sourceCanvas");
const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
const preview = $("preview");
const previewContext = preview.getContext("2d");
const originalPreview = $("originalPreview");
const originalContext = originalPreview.getContext("2d");
const video = $("sourceVideo");
const orbitalScene = createOrbitalScene($("orbitalScene"));

function dimensions() {
  const scale = Number($("scale").value) / 100;
  return {
    width: Math.max(1, Math.min(8192, Math.round(Number($("outputWidth").value || 1) * scale))),
    height: Math.max(1, Math.min(8192, Math.round(Number($("outputHeight").value || 1) * scale)))
  };
}

function drawFitted(context, source, targetWidth, targetHeight, fit, smoothing) {
  const sourceWidth = state.sourceWidth;
  const sourceHeight = state.sourceHeight;
  context.clearRect(0, 0, targetWidth, targetHeight);
  context.imageSmoothingEnabled = smoothing;
  if (fit === "stretch") {
    context.drawImage(source, 0, 0, targetWidth, targetHeight);
    return;
  }
  const ratio = fit === "cover" ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight) : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * ratio;
  const height = sourceHeight * ratio;
  context.drawImage(source, (targetWidth - width) / 2, (targetHeight - height) / 2, width, height);
}

function drawOriginal(source, output, settings) {
  const pixelBudget = state.kind === "video" ? 750000 : 1800000;
  const reduction = Math.min(1, Math.sqrt(pixelBudget / Math.max(1, output.width * output.height)));
  const width = Math.max(1, Math.round(output.width * reduction));
  const height = Math.max(1, Math.round(output.height * reduction));
  originalPreview.width = width;
  originalPreview.height = height;
  drawFitted(originalContext, source, width, height, settings.fitMode, settings.resample === "smooth");
}

async function renderCurrent({ full = false, quiet = false } = {}) {
  if (!state.kind) return false;
  const token = ++state.renderToken;
  if (!state.exporting && !quiet) {
    setStatus("Processing the active effects stack…", "busy");
    $("workerStatus").textContent = processor.worker ? "WORKER / PROCESSING" : "CPU / PROCESSING";
  }
  const settings = getSettings();
  const output = dimensions();
  const pixelSize = Math.max(1, settings.pixelSize);
  let workWidth = Math.max(1, Math.ceil(output.width / pixelSize));
  let workHeight = Math.max(1, Math.ceil(output.height / pixelSize));
  const fullPreview = full || $("previewQuality").value === "full";
  if (state.kind === "video" && !fullPreview && workWidth * workHeight > 650000) {
    const reduction = Math.sqrt(650000 / (workWidth * workHeight));
    workWidth = Math.max(1, Math.round(workWidth * reduction));
    workHeight = Math.max(1, Math.round(workHeight * reduction));
  }
  sourceCanvas.width = workWidth;
  sourceCanvas.height = workHeight;
  const source = state.kind === "image" ? state.bitmap : video;
  drawFitted(sourceContext, source, workWidth, workHeight, settings.fitMode, settings.resample === "smooth");
  const imageData = sourceContext.getImageData(0, 0, workWidth, workHeight);
  let result;
  try {
    result = await processor.process(imageData, settings);
  } catch (error) {
    setStatus(`Processing failed: ${error.message}`, "error");
    return false;
  }
  if (token !== state.renderToken) return false;
  sourceCanvas.width = workWidth;
  sourceCanvas.height = workHeight;
  sourceContext.putImageData(result, 0, 0);
  preview.width = output.width;
  preview.height = output.height;
  previewContext.clearRect(0, 0, output.width, output.height);
  previewContext.imageSmoothingEnabled = settings.resample === "smooth" && pixelSize === 1;
  previewContext.drawImage(sourceCanvas, 0, 0, output.width, output.height);
  drawOriginal(source, output, settings);
  $("emptyState").hidden = true;
  document.body.classList.add("has-media");
  updateReadouts();
  applyPreviewZoom();
  if (!state.exporting && !quiet) setStatus(`${$("previewAlgorithm").textContent} / ${output.width} × ${output.height}px / ${processor.worker ? "worker online" : "main-thread fallback"}`, "ready");
  return true;
}

function scheduleRender(delay = 130) {
  clearTimeout(state.renderTimer);
  if (state.kind && !state.exporting) {
    setStatus("Effect changes queued for preview…", "busy");
    $("workerStatus").textContent = processor.worker ? "WORKER / QUEUED" : "CPU / QUEUED";
  }
  state.renderTimer = setTimeout(() => renderCurrent(), delay);
}

function updateReadouts() {
  const output = dimensions();
  const width = Number($("outputWidth").value) || 1;
  const height = Number($("outputHeight").value) || 1;
  const divisor = greatestCommonDivisor(Math.round(width), Math.round(height));
  $("aspectReadout").textContent = `${Math.round(width / divisor)} : ${Math.round(height / divisor)}`;
  $("exportDimensions").textContent = `${output.width} × ${output.height}`;
  $("previewDimensions").textContent = `${output.width} × ${output.height} PX`;
  $("workerStatus").textContent = processor.worker ? "WORKER / READY" : "CPU / READY";
}

function greatestCommonDivisor(a, b) {
  a = Math.max(1, Math.abs(a));
  b = Math.max(1, Math.abs(b));
  while (b) [a, b] = [b, a % b];
  return a;
}

function setNativeDimensions(width, height) {
  state.sourceWidth = width;
  state.sourceHeight = height;
  $("outputWidth").value = width;
  $("outputHeight").value = height;
  $("scale").value = 100;
  document.querySelector('output[for="scale"]').value = "100%";
  updateReadouts();
}

function switchMode(kind) {
  state.kind = kind;
  $("imageExport").hidden = kind !== "image";
  $("videoExport").hidden = kind !== "video";
  $("videoControls").hidden = kind !== "video";
  $("exportImage").hidden = kind !== "image";
  $("exportVideo").hidden = kind !== "video";
  $("exportImage").disabled = kind !== "image";
  $("exportVideo").disabled = kind !== "video" || !chooseRecorderFormat();
  $("compareSource").disabled = false;
  $("clearSource").disabled = false;
  $("exportKind").textContent = kind === "video" ? "Browser-native video" : "Lossless still";
}

function releaseSource({ clearVisuals = false } = {}) {
  state.bitmap?.close?.();
  state.bitmap = null;
  video.pause();
  video.removeAttribute("src");
  video.load();
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = null;
  stopVideoLoop();
  if (clearVisuals) {
    state.kind = null;
    document.body.classList.remove("has-media", "is-comparing");
    $("emptyState").hidden = false;
    $("compareSource").disabled = true;
    $("clearSource").disabled = true;
    $("fileMeta").textContent = "No source acquired";
    $("exportKind").textContent = "No source";
  }
}

function clearLoadedMedia() {
  clearTimeout(state.renderTimer);
  state.renderToken++;
  releaseSource({ clearVisuals: true });
  state.sourceWidth = 0;
  state.sourceHeight = 0;
  state.sourceName = "dither-girl";
  sourceCanvas.width = 1;
  sourceCanvas.height = 1;
  preview.width = 1;
  preview.height = 1;
  originalPreview.width = 1;
  originalPreview.height = 1;
  $("imageExport").hidden = false;
  $("videoExport").hidden = true;
  $("videoControls").hidden = true;
  $("exportImage").hidden = false;
  $("exportImage").disabled = true;
  $("exportVideo").hidden = true;
  $("exportVideo").disabled = true;
  $("seek").value = 0;
  $("fileInput").value = "";
  $("compareSource").setAttribute("aria-pressed", "false");
  updateReadouts();
  resetHistory();
  setStatus("Source cleared. Drop an image or video to begin.", "idle");
}

function fileKind(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  const imageTypes = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp", "image/x-ms-bmp"];
  const videoTypes = ["video/mp4", "video/webm", "video/ogg"];
  if (imageTypes.includes(file.type)) return "image";
  if (videoTypes.includes(file.type)) return "video";
  if (["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(extension)) return "image";
  if (["mp4", "webm", "ogg", "ogv"].includes(extension)) return "video";
  return null;
}

async function loadFile(file) {
  const kind = fileKind(file);
  if (!kind) {
    setStatus("That file is not a supported image or video type.", true);
    return;
  }
  releaseSource();
  document.body.classList.add("is-acquiring");
  state.sourceName = file.name.replace(/\.[^.]+$/, "") || "dither-girl";
  $("fileMeta").textContent = `Acquiring ${file.name}…`;
  setStatus(`Acquiring ${file.name}…`, "busy");
  try {
    if (kind === "image") {
      state.bitmap = await createImageBitmap(file);
      setNativeDimensions(state.bitmap.width, state.bitmap.height);
      switchMode("image");
      $("fileMeta").textContent = `${file.name} / STILL / ${state.bitmap.width} × ${state.bitmap.height}`;
      await renderCurrent();
    } else {
      state.objectUrl = URL.createObjectURL(file);
      video.src = state.objectUrl;
      await new Promise((resolve, reject) => {
        video.addEventListener("loadedmetadata", resolve, { once: true });
        video.addEventListener("error", () => reject(new Error("The browser could not decode this video or codec.")), { once: true });
      });
      setNativeDimensions(video.videoWidth, video.videoHeight);
      switchMode("video");
      $("seek").value = 0;
      $("fileMeta").textContent = `${file.name} / VIDEO / ${video.videoWidth} × ${video.videoHeight} / ${formatTime(video.duration)}`;
      updateVideoTime();
      await renderCurrent();
    }
    resetHistory();
  } catch (error) {
    releaseSource({ clearVisuals: true });
    setStatus(`Could not load ${file.name}: ${error.message}`, true);
  } finally {
    document.body.classList.remove("is-acquiring");
  }
}

function blobFromCanvas(type) {
  return new Promise((resolve, reject) => preview.toBlob((blob) => blob ? resolve(blob) : reject(new Error(`This browser cannot encode ${type}.`)), type, type === "image/png" ? undefined : .92));
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function updateVideoTime() {
  $("seek").value = video.duration ? video.currentTime / video.duration : 0;
  $("timeLabel").textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  const symbol = document.createElement("span");
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = video.paused ? "▶" : "Ⅱ";
  const label = document.createElement("strong");
  label.textContent = video.paused ? "Play" : "Pause";
  $("playPause").replaceChildren(symbol, label);
}

function beginVideoLoop() {
  if (state.frameLoopActive || state.exporting) return;
  state.frameLoopActive = true;
  const scheduleNext = (callback) => {
    if (video.requestVideoFrameCallback) {
      state.frameCallbackKind = "video";
      state.frameCallbackId = video.requestVideoFrameCallback(callback);
    } else {
      state.frameCallbackKind = "animation";
      state.frameCallbackId = requestAnimationFrame(callback);
    }
  };
  const next = async () => {
    state.frameCallbackId = 0;
    if (video.paused || video.ended || state.exporting) {
      state.frameLoopActive = false;
      return;
    }
    await renderCurrent({ quiet: true });
    if (video.paused || video.ended || state.exporting || !state.frameLoopActive) {
      state.frameLoopActive = false;
      return;
    }
    updateVideoTime();
    scheduleNext(next);
  };
  scheduleNext(next);
}

function stopVideoLoop({ renderPausedFrame = false } = {}) {
  state.frameLoopActive = false;
  if (state.frameCallbackId) {
    if (state.frameCallbackKind === "video" && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(state.frameCallbackId);
    else if (state.frameCallbackKind === "animation") cancelAnimationFrame(state.frameCallbackId);
  }
  state.frameCallbackId = 0;
  state.frameCallbackKind = null;
  state.renderToken++;
  if (renderPausedFrame && state.kind === "video" && !state.exporting) renderCurrent();
}

function applyPreviewZoom() {
  const value = $("previewZoom").value;
  const stack = $("canvasStack");
  if (value === "fit") {
    preview.style.width = "";
    preview.style.maxWidth = "";
    preview.style.maxHeight = "";
    stack.style.maxWidth = "";
    stack.style.maxHeight = "";
    return;
  }
  const factor = Number(value) / 100;
  preview.style.width = `${Math.max(1, preview.width * factor)}px`;
  preview.style.maxWidth = "none";
  preview.style.maxHeight = "none";
  stack.style.maxWidth = "none";
  stack.style.maxHeight = "none";
}

function captureEditorState() {
  return {
    settings: getSettings(),
    outputWidth: Number($("outputWidth").value),
    outputHeight: Number($("outputHeight").value),
    aspectLock: $("aspectLock").checked,
    imageFormat: $("imageFormat").value
  };
}

function updateHistoryButtons() {
  $("undo").disabled = historyIndex <= 0;
  $("redo").disabled = historyIndex < 0 || historyIndex >= history.length - 1;
}

function pushHistory() {
  if (applyingHistory) return;
  const snapshot = captureEditorState();
  const serialized = JSON.stringify(snapshot);
  if (historyIndex >= 0 && JSON.stringify(history[historyIndex]) === serialized) return;
  history = history.slice(0, historyIndex + 1);
  history.push(snapshot);
  if (history.length > 40) history.shift();
  historyIndex = history.length - 1;
  updateHistoryButtons();
}

function scheduleHistory() {
  if (applyingHistory) return;
  clearTimeout(state.historyTimer);
  state.historyTimer = setTimeout(pushHistory, 280);
}

function resetHistory() {
  clearTimeout(state.historyTimer);
  history = [captureEditorState()];
  historyIndex = 0;
  updateHistoryButtons();
}

function restoreHistory(index) {
  const snapshot = history[index];
  if (!snapshot) return;
  applyingHistory = true;
  applySettings(snapshot.settings);
  $("outputWidth").value = snapshot.outputWidth;
  $("outputHeight").value = snapshot.outputHeight;
  $("aspectLock").checked = snapshot.aspectLock;
  $("imageFormat").value = snapshot.imageFormat;
  historyIndex = index;
  updateHistoryButtons();
  updateReadouts();
  scheduleRender(0);
  applyingHistory = false;
}

setupControls(() => {
  scheduleRender();
  scheduleHistory();
  updateReadouts();
});
defaultSettings = getSettings();
updateReadouts();
resetHistory();

function openPicker() {
  $("fileInput").value = "";
  $("fileInput").click();
}

$("openFile").addEventListener("click", openPicker);
$("emptyOpen").addEventListener("click", openPicker);
$("clearSource").addEventListener("click", clearLoadedMedia);
$("fileInput").addEventListener("click", (event) => {
  event.currentTarget.value = "";
});
$("fileInput").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) loadFile(file);
});

function setupDropTarget(target) {
  for (const type of ["dragenter", "dragover"]) target.addEventListener(type, (event) => {
    event.preventDefault();
    $("dropZone").classList.add("dragging");
  });
  for (const type of ["dragleave", "drop"]) target.addEventListener(type, (event) => {
    event.preventDefault();
    $("dropZone").classList.remove("dragging");
  });
  target.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer.files;
    if (file) loadFile(file);
  });
}
setupDropTarget($("dropZone"));
setupDropTarget($("canvasViewport"));

$("outputWidth").addEventListener("change", () => {
  if ($("aspectLock").checked && state.sourceWidth) $("outputHeight").value = Math.max(1, Math.round(Number($("outputWidth").value) * state.sourceHeight / state.sourceWidth));
  updateReadouts();
  scheduleHistory();
  scheduleRender(0);
});
$("outputHeight").addEventListener("change", () => {
  if ($("aspectLock").checked && state.sourceHeight) $("outputWidth").value = Math.max(1, Math.round(Number($("outputHeight").value) * state.sourceWidth / state.sourceHeight));
  updateReadouts();
  scheduleHistory();
  scheduleRender(0);
});
$("aspectLock").addEventListener("change", () => {
  scheduleHistory();
  scheduleRender(0);
});
$("imageFormat").addEventListener("change", scheduleHistory);
$("previewQuality").addEventListener("change", () => scheduleRender(0));
$("previewZoom").addEventListener("change", applyPreviewZoom);

$("compareSource").addEventListener("click", () => {
  const active = !document.body.classList.contains("is-comparing");
  document.body.classList.toggle("is-comparing", active);
  $("compareSource").setAttribute("aria-pressed", String(active));
  $("compareSource").lastChild.textContent = active ? " Processed" : " Original";
});

$("undo").addEventListener("click", () => restoreHistory(historyIndex - 1));
$("redo").addEventListener("click", () => restoreHistory(historyIndex + 1));
$("reset").addEventListener("click", () => {
  applySettings(defaultSettings);
  if (state.sourceWidth && state.sourceHeight) setNativeDimensions(state.sourceWidth, state.sourceHeight);
  else {
    $("outputWidth").value = 800;
    $("outputHeight").value = 600;
    updateReadouts();
  }
  $("aspectLock").checked = true;
  $("imageFormat").value = "image/png";
  pushHistory();
  if (state.kind) scheduleRender(0);
  else setStatus("Control stack returned to baseline.", "ready");
});

$("resetEffects").addEventListener("click", () => {
  resetEffectSettings();
  pushHistory();
  updateReadouts();
  if (state.kind) scheduleRender(0);
  else setStatus("Effects stack returned to baseline.", "ready");
});

document.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
  event.preventDefault();
  if (event.shiftKey) restoreHistory(historyIndex + 1);
  else restoreHistory(historyIndex - 1);
});

$("exportImage").addEventListener("click", async () => {
  clearTimeout(state.renderTimer);
  state.exporting = true;
  $("exportImage").disabled = true;
  $("exportImage").classList.add("is-exporting");
  setStatus("Rendering full-resolution image…", "busy");
  try {
    await renderCurrent({ full: true });
    const type = $("imageFormat").value;
    const extensions = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
    download(await blobFromCanvas(type), `${state.sourceName}-dithered.${extensions[type]}`);
    setStatus("Image export complete. Signal written to downloads.", "ready");
  } catch (error) {
    setStatus(`Export failed: ${error.message}`, true);
  } finally {
    state.exporting = false;
    $("exportImage").disabled = false;
    $("exportImage").classList.remove("is-exporting");
  }
});

$("playPause").addEventListener("click", () => {
  if (video.paused) video.play().catch((error) => setStatus(error.message, true));
  else video.pause();
});
video.addEventListener("play", () => {
  updateVideoTime();
  beginVideoLoop();
});
video.addEventListener("pause", () => {
  stopVideoLoop({ renderPausedFrame: Boolean(video.currentSrc) && video.readyState >= 2 });
  updateVideoTime();
});
video.addEventListener("timeupdate", updateVideoTime);
video.addEventListener("seeked", () => {
  updateVideoTime();
  if (video.paused && !state.exporting) renderCurrent();
});
$("seek").addEventListener("input", () => {
  if (video.duration) video.currentTime = Number($("seek").value) * video.duration;
});

const recorderFormat = chooseRecorderFormat();
$("videoFormat").textContent = recorderFormat ? `Recording target: ${recorderFormat.mimeType || "browser default"}. Real-time capture; source audio is included when exposed by the browser.` : "MediaRecorder is unavailable in this browser.";
$("exportVideo").addEventListener("click", async () => {
  if (state.exporting) return;
  state.exporting = true;
  stopVideoLoop();
  $("exportVideo").disabled = true;
  $("exportVideo").classList.add("is-exporting");
  $("exportProgress").value = 0;
  setStatus("Recording processed video in real time. Keep this tab active.", "busy");
  try {
    const result = await recordProcessedVideo({
      video,
      canvas: preview,
      renderFrame: () => renderCurrent({ full: true }),
      onProgress: (value) => { $("exportProgress").value = value; }
    });
    download(result.blob, `${state.sourceName}-dithered.${result.extension}`);
    setStatus(result.hasAudio ? `Video exported as ${result.mimeType} with audio.` : `Video exported as ${result.mimeType}; this browser did not expose an audio track.`, !result.hasAudio);
  } catch (error) {
    setStatus(`Video export failed: ${error.message}`, true);
  } finally {
    state.exporting = false;
    $("exportVideo").disabled = false;
    $("exportVideo").classList.remove("is-exporting");
    updateVideoTime();
  }
});

window.addEventListener("beforeunload", () => {
  orbitalScene.destroy();
  releaseSource();
});
