// public/mode-router-luxury.js
(() => {
  const REVISION = "2026-08-17-v14.0-luxury-effects";
  if (window.UnlimitedModeLuxury) return;

  const state = {
    root: null,
    lobby: null,
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    dpr: 1,
    raf: 0,
    running: false,
    lastPointer: null,
    points: [],
    particles: [],
    rootObserver: null,
    bodyObserver: null,
    finderObserver: null,
    resizeHandler: null,
    pointerHandler: null,
    leaveHandler: null,
    visibilityHandler: null
  };

  function reducedMotion() {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }

  function coarsePointer() {
    return Boolean(window.matchMedia?.("(pointer: coarse)").matches);
  }

  function effectsDisabled() {
    return reducedMotion() || coarsePointer();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function mix(a, b, t) {
    return Math.round(a + (b - a) * t);
  }

  function colorAt(x) {
    const ratio = clamp(x / Math.max(window.innerWidth, 1), 0, 1);
    const blue = [92, 158, 255];
    const purple = [164, 104, 255];
    const pink = [255, 101, 190];
    if (ratio <= 0.5) {
      const t = ratio * 2;
      return [mix(blue[0], purple[0], t), mix(blue[1], purple[1], t), mix(blue[2], purple[2], t)];
    }
    const t = (ratio - 0.5) * 2;
    return [mix(purple[0], pink[0], t), mix(purple[1], pink[1], t), mix(purple[2], pink[2], t)];
  }

  function isLobbyVisible() {
    return Boolean(
      state.root &&
      state.canvas &&
      document.body.dataset.uaiMode === "lobby" &&
      !state.root.hidden &&
      !document.hidden
    );
  }

  function createLuxuryLayers() {
    if (!state.lobby || state.lobby.querySelector(".uai-luxury-space")) return;

    const space = document.createElement("div");
    space.className = "uai-luxury-space";
    space.setAttribute("aria-hidden", "true");
    space.innerHTML = `
      <span class="uai-luxury-aurora blue"></span>
      <span class="uai-luxury-aurora pink"></span>
      <span class="uai-luxury-galaxy"></span>
      <span class="uai-luxury-ribbon"></span>
      <span class="uai-luxury-dust"></span>
      <span class="uai-luxury-cursor-aura"></span>`;

    const shell = state.lobby.querySelector(".uai-mode-shell");
    state.lobby.insertBefore(space, shell || null);

    const canvas = document.createElement("canvas");
    canvas.id = "uaiLuxuryTrail";
    canvas.setAttribute("aria-hidden", "true");
    state.root.appendChild(canvas);
    state.canvas = canvas;
    state.ctx = canvas.getContext("2d", { alpha: true });

    state.root.querySelectorAll(".uai-mode-card").forEach((card) => {
      if (card.querySelector(".uai-energy-frame")) return;
      const frame = document.createElement("span");
      frame.className = "uai-energy-frame";
      frame.setAttribute("aria-hidden", "true");
      card.appendChild(frame);
    });
  }

  function resize() {
    if (!state.canvas || !state.ctx) return;
    state.width = Math.max(1, window.innerWidth);
    state.height = Math.max(1, window.innerHeight);
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.canvas.width = Math.round(state.width * state.dpr);
    state.canvas.height = Math.round(state.height * state.dpr);
    state.ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  function spawnParticles(x, y, dx, dy, speed) {
    const count = clamp(Math.round(2 + speed / 18), 2, 7);
    const base = colorAt(x);
    const mag = Math.hypot(dx, dy) || 1;
    const nx = dx / mag;
    const ny = dy / mag;

    for (let i = 0; i < count; i += 1) {
      const spread = (Math.random() - 0.5) * 1.4;
      const back = 0.025 + Math.random() * 0.055;
      state.particles.push({
        x: x + (Math.random() - 0.5) * 5,
        y: y + (Math.random() - 0.5) * 5,
        vx: -nx * speed * back + -ny * spread,
        vy: -ny * speed * back + nx * spread + (Math.random() - 0.5) * 0.12,
        born: performance.now(),
        life: 360 + Math.random() * 420,
        radius: 0.7 + Math.random() * 1.9,
        color: base,
        cross: Math.random() > 0.88
      });
    }

    if (state.particles.length > 180) {
      state.particles.splice(0, state.particles.length - 180);
    }
  }

  function onPointerMove(event) {
    if (!isLobbyVisible() || effectsDisabled() || event.pointerType === "touch") return;

    const x = event.clientX;
    const y = event.clientY;
    state.root.style.setProperty("--uai-lux-x", `${x}px`);
    state.root.style.setProperty("--uai-lux-y", `${y}px`);

    const now = performance.now();
    const last = state.lastPointer;
    if (!last) {
      state.lastPointer = { x, y, time: now };
      state.points.push({ x, y, born: now, color: colorAt(x) });
      return;
    }

    const dx = x - last.x;
    const dy = y - last.y;
    const distance = Math.hypot(dx, dy);
    const elapsed = Math.max(8, now - last.time);
    const speed = distance / elapsed * 16;

    if (distance >= 2) {
      const steps = clamp(Math.ceil(distance / 12), 1, 5);
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        const px = last.x + dx * t;
        const py = last.y + dy * t;
        state.points.push({ x: px, y: py, born: now - (steps - i) * 7, color: colorAt(px) });
      }
      spawnParticles(x, y, dx, dy, Math.min(26, speed));
    }

    if (state.points.length > 34) state.points.splice(0, state.points.length - 34);
    state.lastPointer = { x, y, time: now };
  }

  function drawTrail(ctx, now) {
    state.points = state.points.filter((point) => now - point.born < 560);
    if (state.points.length < 2) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = 1; i < state.points.length; i += 1) {
      const a = state.points[i - 1];
      const b = state.points[i];
      const age = now - b.born;
      const alpha = Math.pow(1 - clamp(age / 560, 0, 1), 1.55);
      const [r, g, bl] = b.color;

      ctx.strokeStyle = `rgba(${r},${g},${bl},${alpha * 0.24})`;
      ctx.lineWidth = 7.5 * alpha + 0.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      ctx.strokeStyle = `rgba(245,243,255,${alpha * 0.72})`;
      ctx.lineWidth = 1.15 * alpha + 0.25;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  function drawParticles(ctx, now, dt) {
    state.particles.forEach((particle) => {
      const age = now - particle.born;
      const ratio = clamp(age / particle.life, 0, 1);
      const alpha = Math.pow(1 - ratio, 1.4);
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.994;
      particle.vy *= 0.994;

      const [r, g, b] = particle.color;
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.9})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius * (0.7 + alpha * 0.5), 0, Math.PI * 2);
      ctx.fill();

      if (particle.cross && alpha > 0.35) {
        const size = 3 + particle.radius * 2.8;
        ctx.strokeStyle = `rgba(255,250,255,${alpha * 0.62})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(particle.x - size, particle.y);
        ctx.lineTo(particle.x + size, particle.y);
        ctx.moveTo(particle.x, particle.y - size);
        ctx.lineTo(particle.x, particle.y + size);
        ctx.stroke();
      }
    });

    state.particles = state.particles.filter((particle) => now - particle.born < particle.life);
  }

  function render(now) {
    if (!state.running || !state.ctx) return;
    const ctx = state.ctx;
    const dt = Math.min(34, Math.max(0.5, now - (render.lastTime || now))) / 16.67;
    render.lastTime = now;

    ctx.clearRect(0, 0, state.width, state.height);
    ctx.globalCompositeOperation = "lighter";
    drawTrail(ctx, now);
    drawParticles(ctx, now, dt);
    ctx.globalCompositeOperation = "source-over";

    state.raf = requestAnimationFrame(render);
  }

  function start() {
    if (state.running || !state.ctx || !isLobbyVisible() || effectsDisabled()) return;
    state.running = true;
    render.lastTime = performance.now();
    state.raf = requestAnimationFrame(render);
  }

  function stop() {
    state.running = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    render.lastTime = 0;
    state.lastPointer = null;
    state.points = [];
    state.particles = [];
    if (state.root) {
      delete state.root.dataset.luxuryWorld;
      state.root.style.setProperty("--uai-lux-x", "50vw");
      state.root.style.setProperty("--uai-lux-y", "42vh");
    }
    state.ctx?.clearRect(0, 0, state.width, state.height);
  }

  function syncRunning() {
    if (isLobbyVisible() && !effectsDisabled()) start();
    else stop();
  }

  function bindWorldHover() {
    state.root.querySelectorAll(".uai-mode-card").forEach((card) => {
      const kind = card.classList.contains("novel") ? "novel" : "companion";
      card.addEventListener("pointerenter", () => {
        if (!state.root || document.body.dataset.uaiMode !== "lobby") return;
        state.root.dataset.luxuryWorld = kind;
      });
      card.addEventListener("focus", () => {
        if (!state.root || document.body.dataset.uaiMode !== "lobby") return;
        state.root.dataset.luxuryWorld = kind;
      });
      card.addEventListener("pointerleave", () => {
        if (state.root?.dataset.luxuryWorld === kind) delete state.root.dataset.luxuryWorld;
      });
      card.addEventListener("blur", () => {
        if (state.root?.dataset.luxuryWorld === kind) delete state.root.dataset.luxuryWorld;
      });
    });
  }

  function attach(root) {
    if (!root || root.dataset.luxuryMounted === "1") return;
    state.root = root;
    state.lobby = root.querySelector(".uai-mode-lobby");
    if (!state.lobby) return;

    root.dataset.luxuryMounted = "1";
    root.dataset.luxuryRevision = REVISION;
    createLuxuryLayers();
    if (!state.canvas || !state.ctx) return;

    bindWorldHover();
    state.resizeHandler = resize;
    state.pointerHandler = onPointerMove;
    state.leaveHandler = () => {
      state.lastPointer = null;
      state.root?.style.setProperty("--uai-lux-x", "50vw");
      state.root?.style.setProperty("--uai-lux-y", "42vh");
    };
    state.visibilityHandler = syncRunning;

    window.addEventListener("resize", state.resizeHandler, { passive: true });
    window.addEventListener("pointermove", state.pointerHandler, { passive: true });
    document.documentElement.addEventListener("mouseleave", state.leaveHandler, { passive: true });
    document.addEventListener("visibilitychange", state.visibilityHandler);

    state.bodyObserver = new MutationObserver(syncRunning);
    state.bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["data-uai-mode"] });

    state.rootObserver = new MutationObserver(syncRunning);
    state.rootObserver.observe(root, { attributes: true, attributeFilter: ["hidden"] });

    resize();
    syncRunning();
  }

  function findAndAttach() {
    const root = document.getElementById("uaiModeRoot");
    if (root) {
      attach(root);
      state.finderObserver?.disconnect();
      state.finderObserver = null;
      return true;
    }
    return false;
  }

  function init() {
    if (findAndAttach()) return;
    state.finderObserver = new MutationObserver(findAndAttach);
    state.finderObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.UnlimitedModeLuxury = {
    revision: REVISION,
    start,
    stop,
    refresh: syncRunning
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();