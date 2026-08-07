const audioNodes = new WeakMap();

export function chooseRecorderFormat() {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    { mimeType: "video/mp4;codecs=h264,aac", extension: "mp4" },
    { mimeType: "video/mp4", extension: "mp4" },
    { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" }
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate.mimeType)) || { mimeType: "", extension: "webm" };
}

function waitFor(target, event) {
  return new Promise((resolve) => target.addEventListener(event, resolve, { once: true }));
}

async function audioTracksFor(video) {
  const capture = video.captureStream || video.mozCaptureStream || video.webkitCaptureStream;
  if (capture) {
    const stream = capture.call(video);
    const tracks = stream.getAudioTracks();
    if (tracks.length) return { tracks, cleanup: () => stream.getTracks().forEach((track) => track.stop()) };
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return { tracks: [], cleanup: () => {} };
  let nodes = audioNodes.get(video);
  if (!nodes) {
    const context = new AudioContextClass();
    const source = context.createMediaElementSource(video);
    const destination = context.createMediaStreamDestination();
    source.connect(destination); source.connect(context.destination);
    nodes = { context, destination }; audioNodes.set(video, nodes);
  }
  await nodes.context.resume();
  return { tracks: nodes.destination.stream.getAudioTracks(), cleanup: () => {} };
}

export async function recordProcessedVideo({ video, canvas, renderFrame, onProgress = () => {} }) {
  const format = chooseRecorderFormat();
  if (!format) throw new Error("MediaRecorder is not available in this browser.");
  if (!canvas.captureStream) throw new Error("Canvas recording is not available in this browser.");
  const previous = { time: video.currentTime, paused: video.paused, muted: video.muted };
  video.pause(); video.currentTime = 0;
  if (video.readyState < 2 || video.seeking) await waitFor(video, "seeked");
  const canvasStream = canvas.captureStream(30);
  const audio = await audioTracksFor(video);
  const stream = new MediaStream([...canvasStream.getVideoTracks(), ...audio.tracks]);
  const recorder = format.mimeType ? new MediaRecorder(stream, { mimeType: format.mimeType, videoBitsPerSecond: 8_000_000 }) : new MediaRecorder(stream);
  const chunks = [];
  recorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
  const stopped = waitFor(recorder, "stop");
  let rendering = false;
  let active = true;
  const draw = async () => {
    if (rendering) return;
    rendering = true;
    try { await renderFrame(); onProgress(video.duration ? video.currentTime / video.duration : 0); }
    finally { rendering = false; }
  };
  const frameCallback = () => { if (!active) return; draw(); if (!video.ended && active) video.requestVideoFrameCallback(frameCallback); };
  const timeHandler = () => draw();
  if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(frameCallback);
  else video.addEventListener("timeupdate", timeHandler);
  await renderFrame();
  recorder.start(1000);
  const ended = waitFor(video, "ended");
  await video.play();
  await ended;
  active = false;
  await draw();
  recorder.stop();
  await stopped;
  video.removeEventListener("timeupdate", timeHandler);
  stream.getTracks().forEach((track) => track.stop()); audio.cleanup();
  video.currentTime = Math.min(previous.time, video.duration || previous.time); video.muted = previous.muted;
  if (!previous.paused) video.play().catch(() => {});
  onProgress(1);
  return { blob: new Blob(chunks, { type: recorder.mimeType || format.mimeType || "video/webm" }), extension: format.extension, mimeType: recorder.mimeType || format.mimeType || "video/webm", hasAudio: audio.tracks.length > 0 };
}
