const TAU = Math.PI * 2;

function seededNoise(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function createOrbitalScene(canvas) {
  if (!canvas) return { destroy() {} };
  const context = canvas.getContext("2d", { alpha: false });
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const random = seededNoise(904201);
  const stars = Array.from({ length: 130 }, () => ({
    x: random(), y: random(), radius: random() * .75 + .15, alpha: random() * .5 + .08,
    phase: random() * TAU, depth: random() * .8 + .2
  }));
  const craters = Array.from({ length: 38 }, () => ({
    angle: random() * TAU, distance: Math.sqrt(random()) * .82, size: random() * .065 + .008, alpha: random() * .15 + .025
  }));
  let width = 0;
  let height = 0;
  let dpr = 1;
  let frame = 0;
  let visible = true;
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let previous = 0;

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  }

  function ellipsePoint(cx, cy, rx, ry, rotation, angle) {
    const x = Math.cos(angle) * rx;
    const y = Math.sin(angle) * ry;
    return {
      x: cx + x * Math.cos(rotation) - y * Math.sin(rotation),
      y: cy + x * Math.sin(rotation) + y * Math.cos(rotation)
    };
  }

  function drawOrbit(cx, cy, radius, time) {
    context.save();
    context.translate(cx, cy);
    context.rotate(-.22 + pointerX * .02);
    context.scale(1, .36);
    context.strokeStyle = "rgba(135, 168, 189, .16)";
    context.lineWidth = 1;
    context.setLineDash([1, 7]);
    context.beginPath();
    context.arc(0, 0, radius * 1.5, 0, TAU);
    context.stroke();
    context.setLineDash([]);

    context.strokeStyle = "rgba(159, 191, 210, .07)";
    context.beginPath();
    context.arc(0, 0, radius * 2.05, .08, Math.PI * 1.38);
    context.stroke();
    context.restore();

    const satelliteAngle = time * .000035 + .7;
    const satellite = ellipsePoint(cx, cy, radius * 1.5, radius * .54, -.22 + pointerX * .02, satelliteAngle);
    context.fillStyle = "rgba(219, 238, 247, .8)";
    context.shadowColor = "rgba(173, 213, 234, .7)";
    context.shadowBlur = 8;
    context.fillRect(Math.round(satellite.x), Math.round(satellite.y), 2, 2);
    context.shadowBlur = 0;
  }

  function drawMoon(cx, cy, radius, time) {
    context.save();
    context.beginPath();
    context.arc(cx, cy, radius, 0, TAU);
    context.clip();

    const base = context.createRadialGradient(cx - radius * .38, cy - radius * .42, radius * .02, cx, cy, radius * 1.1);
    base.addColorStop(0, "#b9c8cf");
    base.addColorStop(.25, "#778991");
    base.addColorStop(.66, "#29343b");
    base.addColorStop(1, "#090d12");
    context.fillStyle = base;
    context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    for (const crater of craters) {
      const x = cx + Math.cos(crater.angle) * crater.distance * radius;
      const y = cy + Math.sin(crater.angle) * crater.distance * radius;
      const edge = Math.hypot(x - cx, y - cy) / radius;
      const size = crater.size * radius * (1 - edge * .55);
      const shade = context.createRadialGradient(x - size * .25, y - size * .3, 0, x, y, size);
      shade.addColorStop(0, `rgba(216, 229, 233, ${crater.alpha})`);
      shade.addColorStop(.48, `rgba(45, 56, 62, ${crater.alpha * 1.3})`);
      shade.addColorStop(.72, `rgba(8, 13, 17, ${crater.alpha * 1.6})`);
      shade.addColorStop(1, "rgba(4, 8, 11, 0)");
      context.fillStyle = shade;
      context.beginPath();
      context.ellipse(x, y, size, size * .58, crater.angle, 0, TAU);
      context.fill();
    }

    const shadow = context.createLinearGradient(cx - radius, cy, cx + radius, cy);
    shadow.addColorStop(0, "rgba(0, 0, 0, 0)");
    shadow.addColorStop(.4, "rgba(1, 4, 7, .08)");
    shadow.addColorStop(.57, "rgba(1, 3, 6, .7)");
    shadow.addColorStop(.77, "rgba(0, 2, 5, .98)");
    context.fillStyle = shadow;
    context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    context.globalCompositeOperation = "screen";
    const shimmer = Math.sin(time * .00015) * .02 + .07;
    context.fillStyle = `rgba(178, 210, 224, ${shimmer})`;
    for (let y = -radius; y < radius; y += 5) {
      const chord = Math.sqrt(Math.max(0, radius * radius - y * y));
      const terminator = cx + radius * .13;
      for (let x = -chord; x < chord; x += 5) {
        const threshold = (x / radius + .55) * .36;
        const noise = Math.sin((x + y * 3) * 12.9898) * 43758.5453 % 1;
        if (noise > threshold && x + cx > terminator) context.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
      }
    }
    context.restore();

    context.strokeStyle = "rgba(196, 222, 234, .18)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(cx, cy, radius + .5, Math.PI * .58, Math.PI * 1.5);
    context.stroke();

    const glow = context.createRadialGradient(cx - radius * .2, cy - radius * .15, radius * .9, cx, cy, radius * 1.5);
    glow.addColorStop(0, "rgba(120, 164, 186, 0)");
    glow.addColorStop(.7, "rgba(120, 164, 186, .035)");
    glow.addColorStop(1, "rgba(120, 164, 186, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(cx, cy, radius * 1.5, 0, TAU);
    context.fill();
  }

  function draw(time = 0) {
    if (!width || !height) return;
    pointerX += (targetX - pointerX) * .028;
    pointerY += (targetY - pointerY) * .028;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const background = context.createRadialGradient(width * .68, height * .43, 0, width * .65, height * .48, Math.max(width, height) * .8);
    background.addColorStop(0, "#101820");
    background.addColorStop(.36, "#0a0f15");
    background.addColorStop(1, "#05070a");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    for (const star of stars) {
      const x = ((star.x * width + pointerX * star.depth * 10) % width + width) % width;
      const y = ((star.y * height + pointerY * star.depth * 7) % height + height) % height;
      const pulse = reducedMotion ? 1 : .78 + Math.sin(time * .00035 + star.phase) * .22;
      context.globalAlpha = star.alpha * pulse;
      context.fillStyle = "#c5dbe6";
      context.fillRect(Math.round(x), Math.round(y), star.radius, star.radius);
    }
    context.globalAlpha = 1;

    const radius = Math.min(width, height) * .205;
    const cx = width * .69 + pointerX * 10;
    const cy = height * .48 + pointerY * 7;
    drawOrbit(cx, cy, radius, time);
    drawMoon(cx, cy, radius, time);

    context.strokeStyle = "rgba(141, 174, 193, .08)";
    context.setLineDash([1, 9]);
    context.beginPath();
    context.moveTo(width * .08, height * .72);
    context.bezierCurveTo(width * .3, height * .55, width * .53, height * .85, width * .95, height * .61);
    context.stroke();
    context.setLineDash([]);
  }

  function animate(time) {
    frame = requestAnimationFrame(animate);
    if (!visible || reducedMotion || time - previous < 42) return;
    previous = time;
    draw(time);
  }

  function handlePointer(event) {
    const bounds = canvas.getBoundingClientRect();
    targetX = ((event.clientX - bounds.left) / Math.max(1, bounds.width) - .5) * 2;
    targetY = ((event.clientY - bounds.top) / Math.max(1, bounds.height) - .5) * 2;
    if (reducedMotion) draw(performance.now());
  }

  function handleVisibility() { visible = !document.hidden; }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  canvas.closest(".stage")?.addEventListener("pointermove", handlePointer, { passive: true });
  document.addEventListener("visibilitychange", handleVisibility);
  resize();
  if (!reducedMotion) frame = requestAnimationFrame(animate);

  return {
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.closest(".stage")?.removeEventListener("pointermove", handlePointer);
      document.removeEventListener("visibilitychange", handleVisibility);
    }
  };
}
