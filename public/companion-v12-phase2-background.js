// Companion V12.5 phase 2 — five-layer animated background renderer.
(() => {
  const REVISION = "2026-08-14-v12.5-phase2-1";
  let canvas = null;
  let ctx = null;
  let frame = 0;
  let stars = [];
  let meteors = [];
  let resizeKey = "";
  let lastRoot = null;
  const pointer = { x: 0.5, y: 0.48, tx: 0.5, ty: 0.48 };

  function rgba(rgb, alpha) {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  }

  function currentPalette(root) {
    const style = getComputedStyle(root);
    const read = (name, fallback) => {
      const text = style.getPropertyValue(name).trim();
      const match = text.match(/^#([0-9a-f]{6})$/i);
      if (!match) return fallback;
      return [
        parseInt(match[1].slice(0, 2), 16),
        parseInt(match[1].slice(2, 4), 16),
        parseInt(match[1].slice(4, 6), 16)
      ];
    };
    return {
      purple: read("--v125-purple", [165, 102, 255]),
      pink: read("--v125-pink", [255, 100, 200]),
      blue: read("--v125-blue", [109, 140, 255])
    };
  }

  function ensureScene(root) {
    const main = root?.querySelector(".uai-c-main");
    if (!main) return null;

    let scene = main.querySelector(":scope > .uai-c-v125-scene");
    if (!scene) {
      scene = document.createElement("div");
      scene.className = "uai-c-v125-scene";
      scene.setAttribute("aria-hidden", "true");
      scene.innerHTML = `
        <div class="uai-c-v125-nebula"><i class="n1"></i><i class="n2"></i><i class="n3"></i></div>
        <div class="uai-c-v125-bands"><i class="uai-c-v125-band b1"></i><i class="uai-c-v125-band b2"></i></div>
        <canvas class="uai-c-v125-stars"></canvas>
        <div class="uai-c-v125-glints"></div>`;
      main.prepend(scene);
      buildGlints(scene.querySelector(".uai-c-v125-glints"));
    }

    canvas = scene.querySelector("canvas");
    ctx = canvas?.getContext("2d", { alpha: true }) || null;
    lastRoot = root;
    resizeCanvas();
    if (!frame && ctx) frame = requestAnimationFrame(animate);
    return scene;
  }

  function buildGlints(host) {
    if (!host || host.childElementCount) return;
    const points = [
      [12, 17, 19, 6.8, -1.5], [23, 43, 13, 7.6, -4.1], [38, 21, 16, 8.4, -6.2],
      [48, 59, 11, 6.6, -3.4], [59, 31, 18, 9.1, -7.2], [72, 16, 14, 7.2, -5.1],
      [83, 44, 20, 8.7, -2.8], [91, 24, 12, 6.9, -4.9], [76, 72, 15, 8.1, -6.7],
      [31, 78, 17, 9.4, -8.2], [15, 67, 12, 7.7, -2.1], [63, 83, 10, 6.5, -5.6]
    ];
    points.forEach(([x, y, size, duration, delay]) => {
      const star = document.createElement("i");
      star.className = "uai-c-v125-glint";
      star.style.setProperty("--x", `${x}%`);
      star.style.setProperty("--y", `${y}%`);
      star.style.setProperty("--s", `${size}px`);
      star.style.setProperty("--d", `${duration}s`);
      star.style.setProperty("--delay", `${delay}s`);
      host.appendChild(star);
    });
  }

  function makeStar(width, height, index) {
    const bright = index % 17 === 0;
    const depth = 0.35 + Math.random() * 0.75;
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * (0.018 + depth * 0.055),
      vy: (Math.random() - 0.5) * (0.014 + depth * 0.04),
      radius: bright ? 1.5 + Math.random() * 1.4 : 0.45 + Math.random() * 1.1,
      baseAlpha: bright ? 0.66 + Math.random() * 0.32 : 0.25 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
      twinkle: 0.004 + Math.random() * 0.016,
      tint: index % 7 === 0 ? "pink" : index % 5 === 0 ? "blue" : "purple",
      depth,
      cross: bright && index % 2 === 0
    };
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const key = `${width}x${height}@${dpr}`;
    if (key === resizeKey) return;
    resizeKey = key;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(110, Math.min(235, Math.round((width * height) / 8000)));
    stars = Array.from({ length: count }, (_, index) => makeStar(width, height, index));
    meteors = [];
  }

  function maybeMeteor(width, height) {
    if (meteors.length >= 2 || Math.random() > 0.0016) return;
    const fromRight = Math.random() > 0.22;
    meteors.push({
      x: fromRight ? width * (0.62 + Math.random() * 0.4) : width * (0.15 + Math.random() * 0.2),
      y: height * (0.03 + Math.random() * 0.34),
      vx: fromRight ? -(5.6 + Math.random() * 3.1) : 4.2 + Math.random() * 2.2,
      vy: 2.3 + Math.random() * 1.7,
      length: 85 + Math.random() * 105,
      life: 1
    });
  }

  function drawCross(x, y, radius, alpha, color) {
    ctx.save();
    ctx.strokeStyle = rgba(color, alpha * 0.72);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x - radius * 4.4, y);
    ctx.lineTo(x + radius * 4.4, y);
    ctx.moveTo(x, y - radius * 4.4);
    ctx.lineTo(x, y + radius * 4.4);
    ctx.stroke();
    ctx.restore();
  }

  function animate() {
    frame = requestAnimationFrame(animate);
    if (!canvas || !ctx || !lastRoot || document.hidden) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (!width || !height) return;
    if (`${Math.round(width)}x${Math.round(height)}` !== resizeKey.split("@")[0]) resizeCanvas();

    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;
    const px = (pointer.x - 0.5) * 10;
    const py = (pointer.y - 0.5) * 8;
    lastRoot.style.setProperty("--v125-parallax-x", `${px.toFixed(2)}px`);
    lastRoot.style.setProperty("--v125-parallax-y", `${py.toFixed(2)}px`);

    ctx.clearRect(0, 0, width, height);
    const palette = currentPalette(lastRoot);

    for (const star of stars) {
      star.x += star.vx;
      star.y += star.vy;
      star.phase += star.twinkle;
      if (star.x < -18) star.x = width + 18;
      if (star.x > width + 18) star.x = -18;
      if (star.y < -18) star.y = height + 18;
      if (star.y > height + 18) star.y = -18;

      const alpha = Math.max(0.08, star.baseAlpha * (0.64 + Math.sin(star.phase) * 0.36));
      const color = palette[star.tint] || palette.purple;
      const x = star.x + px * star.depth * 0.62;
      const y = star.y + py * star.depth * 0.62;
      const glowR = star.radius * (3.8 + star.depth * 2.6);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      glow.addColorStop(0, rgba([255, 255, 255], Math.min(0.98, alpha + 0.22)));
      glow.addColorStop(0.22, rgba(color, alpha * 0.82));
      glow.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = rgba([255, 255, 255], Math.min(1, alpha + 0.25));
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.52, star.radius * 0.55), 0, Math.PI * 2);
      ctx.fill();
      if (star.cross && alpha > 0.55) drawCross(x, y, star.radius, alpha, color);
    }

    maybeMeteor(width, height);
    meteors = meteors.filter((m) => {
      m.x += m.vx;
      m.y += m.vy;
      m.life -= 0.016;
      if (m.life <= 0) return false;
      const mag = Math.hypot(m.vx, m.vy) || 1;
      const tx = m.x - (m.vx / mag) * m.length;
      const ty = m.y - (m.vy / mag) * m.length;
      const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
      grad.addColorStop(0, rgba([255, 255, 255], Math.min(1, m.life)));
      grad.addColorStop(0.16, rgba(palette.pink, m.life * 0.72));
      grad.addColorStop(0.55, rgba(palette.purple, m.life * 0.32));
      grad.addColorStop(1, rgba(palette.blue, 0));
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      return true;
    });
  }

  function bindPointer(root) {
    if (!root || root.dataset.v125PointerBound === "1") return;
    root.dataset.v125PointerBound = "1";
    root.addEventListener("pointermove", (event) => {
      const rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.tx = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      pointer.ty = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    }, { passive: true });
    root.addEventListener("pointerleave", () => {
      pointer.tx = 0.5;
      pointer.ty = 0.48;
    }, { passive: true });
  }

  function enhance() {
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root || root.hidden) return;
    root.dataset.v125Phase2 = REVISION;
    ensureScene(root);
    bindPointer(root);
  }

  function schedule() {
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionV125Phase2Revision = REVISION;
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode", "class"]
    });
    window.addEventListener("resize", resizeCanvas, { passive: true });
    window.UnlimitedCompanionV125Phase2 = { revision: REVISION, refresh: schedule };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
