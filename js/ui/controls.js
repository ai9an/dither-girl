import { ALGORITHMS } from "../engine/registry.js?v=20260807-3";
import { PALETTE_PRESETS, PALETTE_PRESET_LABELS } from "../engine/palette.js?v=20260807-3";
import { PRESETS } from "./presets.js?v=20260807-3";

const $ = (id) => document.getElementById(id);
const watchedIds = ["ditherEnabled", "algorithm", "dotAngle", "dotSize", "threshold", "chromaticEnabled", "grayscale", "gradientMode", "shadowColor", "midColor", "highlightColor", "adjustmentsEnabled", "brightness", "contrast", "gamma", "levelBlack", "levelWhite", "posterize", "invert", "hue", "saturation", "grain", "chromaticDriftEnabled", "chromaticDrift", "scanlinesEnabled", "scanlineStrength", "scanlineSpacing", "usePalette", "quantize", "quantizeColors", "scale", "pixelSize", "fitMode", "resample"];
const numericIds = new Set(["dotAngle", "dotSize", "threshold", "brightness", "contrast", "gamma", "levelBlack", "levelWhite", "posterize", "hue", "saturation", "grain", "chromaticDrift", "scanlineStrength", "scanlineSpacing", "quantizeColors", "scale", "pixelSize"]);
const sourceSettingIds = new Set(["scale", "pixelSize", "fitMode", "resample"]);
const presetStorageKey = "dither-girl-presets-v1";
const legacySessionKey = "dither-girl-session-presets";
const HINTS = Object.freeze({
  aspectLock: "Keeps width and height at the source media's original proportion when either dimension changes.",
  scale: "Multiplies the output dimensions without changing the width and height fields. Useful for quick export-size variants.",
  pixelSize: "Processes a smaller pixel grid, then enlarges it with hard edges for a chunkier retro pattern.",
  fitMode: "Contain shows the entire source, cover fills and crops, and stretch ignores the original aspect ratio.",
  resample: "Nearest preserves crisp dither cells; smooth blends pixels when the processed image is scaled.",
  algorithm: "Chooses how quantization error or threshold patterns are distributed across neighbouring pixels.",
  dotAngle: "Rotates the halftone screen. Different angles change the direction and interference pattern of the dots.",
  dotSize: "Sets the spacing of the halftone screen. Larger values create larger, more visible dots.",
  threshold: "Moves the brightness cutoff used by the selected dither. Higher values produce more shadow pixels.",
  grayscale: "Chooses the channel formula used to collapse colour into brightness before dithering.",
  gradientMode: "Replaces brightness values with a two- or three-colour gradient after dithering.",
  gamma: "Redistributes midtones non-linearly while leaving the darkest and lightest endpoints in place.",
  levelBlack: "Pixels at or below this input level become pure black, expanding the shadow range.",
  levelWhite: "Pixels at or above this input level become pure white, expanding the highlight range.",
  posterize: "Limits each colour channel to a fixed number of steps before dithering.",
  hue: "Rotates all colours around the colour wheel without changing their overall brightness.",
  saturation: "Controls colour intensity. Zero is monochrome; values above 100% exaggerate colour separation.",
  grain: "Adds deterministic fine noise after processing, so still exports remain repeatable.",
  chromaticDriftEnabled: "Offsets the red and blue signal planes in opposite directions to mimic optical or transmission misalignment.",
  chromaticDrift: "Sets how many processed pixels separate the red and blue signal planes.",
  scanlinesEnabled: "Darkens regularly spaced rows to create a restrained monitor or transmitted-signal texture.",
  scanlineStrength: "Controls how much darker each scanline becomes.",
  scanlineSpacing: "Sets the number of rows between scanlines.",
  palettePreset: "Selects the swatches used when palette mapping is enabled. Swatches remain editable.",
  usePalette: "Constrains dither output to the visible palette swatches instead of the default channel levels.",
  quantize: "Extracts a compact palette from the source with median cut before running the selected dither.",
  quantizeColors: "Sets how many colours median cut extracts from the current source.",
  previewQuality: "Auto reduces very large video frames for responsiveness; Full processes the requested resolution."
});
let customPalette = [...PALETTE_PRESETS["studio-32"]];
let activePaletteName = "studio-32";
let controlsChanged = () => {};
let savedPresets = [];
let defaultEffectSettings = null;

function buildAlgorithms() {
  const select = $("algorithm");
  const groups = new Map();
  for (const algorithm of ALGORITHMS) {
    if (!groups.has(algorithm.group)) {
      const group = document.createElement("optgroup");
      group.label = algorithm.group;
      groups.set(algorithm.group, group);
      select.append(group);
    }
    const option = document.createElement("option");
    option.value = algorithm.id;
    option.textContent = algorithm.label;
    groups.get(algorithm.group).append(option);
  }
}

function buildPresets() {
  for (const preset of PRESETS) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.label;
    $("preset").append(option);
  }
  for (const [id] of Object.entries(PALETTE_PRESETS)) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = PALETTE_PRESET_LABELS[id] || id;
    $("palettePreset").append(option);
  }
  const custom = document.createElement("option");
  custom.value = "custom";
  custom.textContent = "Custom";
  $("palettePreset").append(custom);
  $("palettePreset").value = activePaletteName;
}

function updatePresetCards() {
  const selected = $("preset").value;
  document.querySelectorAll(".preset-card").forEach((card) => {
    const active = card.dataset.preset === selected;
    card.classList.toggle("is-active", active);
    card.setAttribute("aria-pressed", String(active));
  });
}

function renderPresetCards() {
  const root = $("presetGrid");
  root.replaceChildren();
  PRESETS.filter((preset) => preset.settings).forEach((preset, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset-card";
    button.dataset.preset = preset.id;
    button.dataset.pattern = String(index % 7);
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `Apply ${preset.label} preset`);
    const visual = document.createElement("span");
    visual.className = "preset-visual";
    visual.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "preset-label";
    label.textContent = `${String(index + 1).padStart(2, "0")} / ${preset.label}`;
    button.append(visual, label);
    button.addEventListener("click", () => applyBuiltInPreset(preset.id));
    root.append(button);
  });
}

function renderSwatches(onChange = controlsChanged) {
  const root = $("swatches");
  root.replaceChildren();
  customPalette.forEach((color, index) => {
    const wrap = document.createElement("div");
    wrap.className = "swatch";
    const input = document.createElement("input");
    input.type = "color";
    input.value = color;
    input.setAttribute("aria-label", `Palette colour ${index + 1}`);
    input.addEventListener("input", () => {
      customPalette[index] = input.value;
      activePaletteName = "custom";
      $("palettePreset").value = "custom";
      markCustom();
      onChange("palette");
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "Remove swatch";
    remove.setAttribute("aria-label", `Remove palette colour ${index + 1}`);
    remove.addEventListener("click", () => {
      if (customPalette.length <= 2) return;
      customPalette.splice(index, 1);
      activePaletteName = "custom";
      $("palettePreset").value = "custom";
      renderSwatches(onChange);
      markCustom();
      onChange("palette");
    });
    wrap.append(input, remove);
    root.append(wrap);
  });
  $("swatchCount").textContent = `${customPalette.length} colour${customPalette.length === 1 ? "" : "s"}`;
}

function updateOutputs() {
  const suffixes = { dotAngle: "°", hue: "°", saturation: "%", scale: "%", pixelSize: "×", chromaticDrift: " PX", scanlineStrength: "%", scanlineSpacing: " PX" };
  for (const id of numericIds) {
    const output = document.querySelector(`output[for="${id}"]`);
    if (output) output.value = `${$(id).value}${suffixes[id] || ""}`;
  }
  const algorithm = ALGORITHMS.find((item) => item.id === $("algorithm").value);
  $("halftoneControls").hidden = algorithm?.controls !== "halftone";
  $("thresholdControl").hidden = algorithm?.controls === "halftone";
  $("algorithmFamily").textContent = algorithm?.group || "Dither";
  $("previewAlgorithm").textContent = $("ditherEnabled").checked ? (algorithm?.label || "Dither") : "Dither bypassed";
  document.body.classList.toggle("is-smooth", $("resample").value === "smooth");
  updateEffectStates();
}

function setControlAvailability(rootId, toggleId) {
  const root = $(rootId);
  const toggle = $(toggleId);
  const enabled = toggle.checked;
  root.classList.toggle("is-disabled", !enabled);
  root.querySelectorAll("input, select, button").forEach((control) => {
    if (control !== toggle && !control.classList.contains("help-hint")) control.disabled = !enabled;
  });
  const readout = toggle.closest(".mini-switch")?.querySelector("b");
  if (readout) readout.textContent = enabled ? "ON" : "OFF";
}

function setDependentState(root, enabled) {
  if (!root) return;
  root.classList.toggle("is-disabled", !enabled);
  root.querySelectorAll?.("input, select").forEach((control) => { control.disabled = !enabled; });
  if (root.matches?.("label") && root.control) root.control.disabled = !enabled;
}

function updateEffectStates() {
  setControlAvailability("ditherGroup", "ditherEnabled");
  setControlAvailability("chromaticGroup", "chromaticEnabled");
  setControlAvailability("responseGroup", "adjustmentsEnabled");
  setDependentState($("chromaticDriftControl"), $("chromaticDriftEnabled").checked);
  setDependentState($("scanlineControls"), $("scanlinesEnabled").checked);
  setDependentState($("quantizeColors").closest("label"), $("quantize").checked);
  const gradientColorsEnabled = $("chromaticEnabled").checked && $("gradientMode").value !== "none";
  setDependentState(document.querySelector(".colour-row"), gradientColorsEnabled);
}

function setupHints() {
  const tooltip = $("controlTooltip");
  let timer = 0;
  let activeButton = null;

  const hide = () => {
    clearTimeout(timer);
    activeButton?.setAttribute("aria-expanded", "false");
    activeButton = null;
    tooltip.hidden = true;
  };
  const show = (button, description) => {
    clearTimeout(timer);
    activeButton?.setAttribute("aria-expanded", "false");
    activeButton = button;
    button.setAttribute("aria-expanded", "true");
    tooltip.textContent = description;
    tooltip.hidden = false;
    const anchor = button.getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    const left = Math.min(window.innerWidth - box.width - 10, Math.max(10, anchor.left + anchor.width / 2 - box.width / 2));
    let top = anchor.bottom + 10;
    if (top + box.height > window.innerHeight - 10) top = Math.max(10, anchor.top - box.height - 10);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };
  const queue = (button, description) => {
    clearTimeout(timer);
    timer = setTimeout(() => show(button, description), 650);
  };

  for (const [id, description] of Object.entries(HINTS)) {
    const control = $(id);
    const label = control?.closest("label");
    if (!label) continue;
    const host = label.querySelector("strong") || label.querySelector(":scope > span:first-child") || label;
    const button = document.createElement("span");
    button.className = "help-hint";
    button.textContent = "?";
    button.tabIndex = 0;
    button.setAttribute("role", "button");
    button.setAttribute("aria-label", `About ${host.textContent.trim()}`);
    button.setAttribute("aria-describedby", "controlTooltip");
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("mouseenter", () => queue(button, description));
    button.addEventListener("mouseleave", hide);
    button.addEventListener("focus", () => show(button, description));
    button.addEventListener("blur", hide);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (activeButton === button && !tooltip.hidden) hide();
      else show(button, description);
    });
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (activeButton === button && !tooltip.hidden) hide();
      else show(button, description);
    });
    host.append(button);
  }
  document.addEventListener("pointerdown", (event) => {
    if (activeButton && !activeButton.contains(event.target) && !tooltip.contains(event.target)) hide();
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") hide(); });
  window.addEventListener("resize", hide);
  document.querySelector(".panel-viewport")?.addEventListener("scroll", hide, { passive: true });
}

function setControl(id, value) {
  const element = $(id);
  if (!element || value === undefined) return;
  if (element.type === "checkbox") element.checked = Boolean(value);
  else element.value = String(value);
}

function markCustom() {
  $("preset").value = "custom";
  updatePresetCards();
}

function signalPresetMotion() {
  document.body.classList.remove("preset-applied");
  requestAnimationFrame(() => {
    document.body.classList.add("preset-applied");
    setTimeout(() => document.body.classList.remove("preset-applied"), 650);
  });
}

function applyBuiltInPreset(id) {
  const preset = PRESETS.find((item) => item.id === id);
  if (!preset?.settings) return;
  $("preset").value = preset.id;
  applySettings({ ditherEnabled: true, chromaticEnabled: true, adjustmentsEnabled: true, chromaticDriftEnabled: false, scanlinesEnabled: false, ...preset.settings }, { preservePreset: true });
  updatePresetCards();
  signalPresetMotion();
  controlsChanged("preset");
}

function setupTabs() {
  const tabs = [...document.querySelectorAll(".section-tab")];
  const panels = [...document.querySelectorAll(".tab-panel")];
  const activate = (tab, focus = false) => {
    const name = tab.dataset.tab;
    tabs.forEach((item, index) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
      if (active) $("sourceTab").parentElement.style.setProperty("--tab-index", String(index));
    });
    panels.forEach((panel) => {
      const active = panel.dataset.panel === name;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
    $("sourceTab").closest(".controls").querySelector(".panel-viewport").scrollTop = 0;
    if (focus) tab.focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      activate(tabs[nextIndex], true);
    });
  });
}

function readSavedPresets() {
  let serialized = "[]";
  try {
    const localValue = localStorage.getItem(presetStorageKey);
    const legacyValue = sessionStorage.getItem(legacySessionKey);
    serialized = localValue ?? legacyValue ?? "[]";
    if (localValue === null && legacyValue !== null) localStorage.setItem(presetStorageKey, legacyValue);
    $("presetStorageScope").textContent = "Local browser";
  } catch {
    try {
      serialized = sessionStorage.getItem(legacySessionKey) || "[]";
      $("presetStorageScope").textContent = "This tab only";
    } catch {
      serialized = "[]";
      $("presetStorageScope").textContent = "Unavailable";
    }
  }
  try {
    const value = JSON.parse(serialized);
    savedPresets = Array.isArray(value) ? value.slice(0, 12) : [];
  } catch {
    savedPresets = [];
  }
}

function persistSavedPresets() {
  const serialized = JSON.stringify(savedPresets);
  try {
    localStorage.setItem(presetStorageKey, serialized);
    $("presetStorageScope").textContent = "Local browser";
  } catch {
    try {
      sessionStorage.setItem(legacySessionKey, serialized);
      $("presetStorageScope").textContent = "This tab only";
    } catch {
      $("presetStorageScope").textContent = "Unavailable";
    }
  }
}

function renderSavedPresets() {
  const root = $("savedPresetList");
  root.replaceChildren();
  if (!savedPresets.length) {
    const empty = document.createElement("p");
    empty.className = "empty-list";
    empty.textContent = "No local presets captured.";
    root.append(empty);
    return;
  }
  savedPresets.forEach((preset, index) => {
    const row = document.createElement("div");
    row.className = "saved-preset";
    const name = document.createElement("strong");
    name.textContent = preset.name;
    const load = document.createElement("button");
    load.type = "button";
    load.textContent = "LOAD";
    load.title = `Load ${preset.name}`;
    load.setAttribute("aria-label", `Load ${preset.name}`);
    load.addEventListener("click", () => {
      applySettings(preset.settings);
      markCustom();
      signalPresetMotion();
      controlsChanged("preset");
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = `Delete ${preset.name}`;
    remove.setAttribute("aria-label", `Delete ${preset.name}`);
    remove.addEventListener("click", () => {
      savedPresets.splice(index, 1);
      persistSavedPresets();
      renderSavedPresets();
    });
    row.append(name, load, remove);
    root.append(row);
  });
}

function setupSavedPresets() {
  readSavedPresets();
  renderSavedPresets();
  $("savePresetForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("presetName").value.trim() || `Signal ${savedPresets.length + 1}`;
    savedPresets.unshift({ name, settings: getSettings() });
    savedPresets = savedPresets.slice(0, 12);
    persistSavedPresets();
    renderSavedPresets();
    $("presetName").value = "";
    signalPresetMotion();
  });
}

export function setupControls(onChange) {
  controlsChanged = onChange;
  buildAlgorithms();
  buildPresets();
  renderPresetCards();
  renderSwatches(onChange);
  updateOutputs();
  setupHints();
  setupTabs();
  setupSavedPresets();
  const initialSettings = getSettings();
  defaultEffectSettings = Object.fromEntries(Object.entries(initialSettings).filter(([id]) => !sourceSettingIds.has(id)));

  for (const id of watchedIds) {
    $(id).addEventListener("input", () => {
      updateOutputs();
      markCustom();
      onChange("control");
    });
    $(id).addEventListener("change", () => {
      updateOutputs();
      markCustom();
      onChange("control");
    });
  }
  $("palettePreset").addEventListener("change", () => {
    const selected = $("palettePreset").value;
    if (selected !== "custom") customPalette = [...PALETTE_PRESETS[selected]];
    activePaletteName = selected;
    renderSwatches(onChange);
    markCustom();
    onChange("palette");
  });
  $("addSwatch").addEventListener("click", () => {
    if (customPalette.length >= 32) return;
    customPalette.push("#808080");
    activePaletteName = "custom";
    $("palettePreset").value = "custom";
    renderSwatches(onChange);
    markCustom();
    onChange("palette");
  });
  $("preset").addEventListener("change", () => applyBuiltInPreset($("preset").value));
}

export function resetEffectSettings() {
  if (!defaultEffectSettings) return;
  applySettings({ ...defaultEffectSettings, palette: [...defaultEffectSettings.palette] });
}

export function applySettings(settings, { preservePreset = false } = {}) {
  if (!settings) return;
  for (const [id, value] of Object.entries(settings)) {
    if (id === "palette") {
      customPalette = [...value];
      activePaletteName = settings.palettePreset || "custom";
      $("palettePreset").value = activePaletteName;
    } else if (id === "palettePreset") {
      if (!settings.palette && PALETTE_PRESETS[value]) customPalette = [...PALETTE_PRESETS[value]];
      activePaletteName = value;
      $("palettePreset").value = PALETTE_PRESETS[value] ? value : "custom";
    } else {
      setControl(id, value);
    }
  }
  if (!preservePreset) $("preset").value = "custom";
  renderSwatches(controlsChanged);
  updateOutputs();
  updatePresetCards();
}

export function getSettings() {
  const settings = {};
  for (const id of watchedIds) {
    const element = $(id);
    settings[id] = element.type === "checkbox" ? element.checked : numericIds.has(id) ? Number(element.value) : element.value;
  }
  settings.palette = [...customPalette];
  settings.palettePreset = activePaletteName;
  return settings;
}
