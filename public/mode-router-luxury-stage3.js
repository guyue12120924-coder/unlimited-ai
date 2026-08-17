// public/mode-router-luxury-stage3.js
(() => {
  const REVISION = "2026-08-17-v14.2-cinematic-depth";
  if (window.UnlimitedModeLuxuryStage3) return;

  const state = {
    root: null,
    lobby: null,
    space: null,
    raf: 0,
    running: false,
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    pointerX: 0,
    pointerY: 0,
    bodyObserver: null,
    rootObserver: null,
    finderObserver: null,
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

  function lobbyVisible() {
    return Boolean(
      state.root &&
      state.space &&
      document.body.dataset.uaiMode === "lobby" &&
      !state.root.hidden &&
      !document.hidden
    );
  }

  function createConstellation(className, stars, lines) {
    const group = document.createElement("span");
    group.className = `uai-cinema-constellation ${className}`;
    group.setAttribute("aria-hidden", "true");

    lines.forEach(([left, top, width, rotate]) => {
      const line = document.createElement("i");
      line.className = "uai-cinema-constellation-line";
      line.style.left = `${left}%`;
      line.style.top = `${top}%`;
      line.style.width = `${width}%`;
      line.style.transform = `rotate(${rotate}deg)`;
      group.appendChild(line);
    });

    stars.forEach(([left, top, size, delay]) => {
      const star = document.createElement("b");
      star.style.left = `${left}%`;
      star.style.top = `${top}%`;
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      star.style.animationDelay = `${delay}s`;
      group.appendChild(star);
    });

    return group;
  }

  function createCinematicLayers() {
    if (!state.space || state.space.querySelector(".uai-cinematic-space")) return;

    const cinema = document.createElement("div");
    cinema.className = "uai-cinematic-space";
    cinema.setAttribute("aria-hidden", "true");
    cinema.innerHTML = `
      <span class="uai-cinema-depth-nebula blue"></span>
      <span class="uai-cinema-depth-nebula pink"></span>
      <span class="uai-cinema-filament filament-a"></span>
      <span class="uai-cinema-filament filament-b"></span>
      <span class="uai-cinema-horizon"></span>
      <span class="uai-cinema-gravity-lens"></span>
      <span class="uai-cinema-vignette"></span>`;

    const novelConstellation = createConstellation(
      "novel",
      [[10, 24, 4, 0], [28, 10, 3, .4], [45, 31, 5, 1.1], [62, 18, 3, .7], [79, 38, 4, 1.5], [90, 16, 3, .2]],
      [[12, 25, 20, -28], [30, 12, 20, 28], [47, 31, 18, -22], [64, 19, 18, 24], [79, 37, 15, -38]]
    );
    const companionConstellation = createConstellation(
      "companion",
      [[8, 38, 3, .6], [24, 20, 4, 1.2], [42, 34, 3, .3], [58, 13, 5, 1.5], [76, 29, 3, .9], [91, 11, 4, .1]],
      [[10, 37, 19, -31], [25, 21, 20, 26], [43, 33, 20, -34], [59, 14, 20, 27], [77, 28, 17, -39]]
    );

    cinema.appendChild(novelConstellation);
    cinema.appendChild(companionConstellation);
    state.space.appendChild(cinema);

    state.root.querySelectorAll(".uai-mode-card").forEach((card) => {
      if (card.querySelector(".uai-cinema-card-glow")) return;
      const layer = document.createElement("span");
      layer.className = "uai-cinema-card-glow";
      layer.setAttribute("aria-hidden", "true");
      for (let i = 0; i < 3; i += 1) {
        const spark = document.createElement("i");
        spark.className = `spark-${i + 1}`;
        layer.appendChild(spark);
      }
      card.appendChild(layer);
    });
  }

  function setDepthVars(x, y) {
    if (!state.root) return;
    const nearX = x * 18;
    const nearY = y * 14;
    const farX = x * 7;
    const farY = y * 5;
    state.root.style.setProperty("--uai-depth-near-x", `${nearX.toFixed(2)}px`);
    state.root.style.setProperty("--uai-depth-near-y", `${nearY.toFixed(2)}px`);
    state.root.style.setProperty("--uai-depth-far-x", `${farX.toFixed(2)}px`);
    state.root.style.setProperty("--uai-depth-far-y", `${farY.toFixed(2)}px`);
    state.root.style.setProperty("--uai-cinema-x", `${state.pointerX.toFixed(1)}px`);
    state.root.style.setProperty("--uai-cinema-y", `${state.pointerY.toFixed(1)}px`);
  }

  function onPointerMove(event) {
    if (!lobbyVisible() || effectsDisabled() || event.pointerType === "touch") return;
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    state.targetX = Math.max(-1, Math.min(1, (event.clientX / Math.max(window.innerWidth, 1) - .5) * 2));
    state.targetY = Math.max(-1, Math.min(1, (event.clientY / Math.max(window.innerHeight, 1) - .5) * 2));
  }

  function render() {
    if (!state.running) return;
    state.currentX += (state.targetX - state.currentX) * .055;
    state.currentY += (state.targetY - state.currentY) * .055;
    setDepthVars(state.currentX, state.currentY);
    state.raf = requestAnimationFrame(render);
  }

  function start() {
    if (state.running || !lobbyVisible() || effectsDisabled()) return;
    state.running = true;
    state.pointerX = window.innerWidth * .5;
    state.pointerY = window.innerHeight * .42;
    state.raf = requestAnimationFrame(render);
  }

  function stop() {
    state.running = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    state.targetX = 0;
    state.targetY = 0;
    state.currentX = 0;
    state.currentY = 0;
    state.pointerX = window.innerWidth * .5;
    state.pointerY = window.innerHeight * .42;
    setDepthVars(0, 0);
  }

  function sync() {
    if (lobbyVisible() && !effectsDisabled()) start();
    else stop();
  }

  function install(root) {
    if (!root || root.dataset.luxuryStage3Mounted === "1") return false;
    const space = root.querySelector(".uai-luxury-space");
    const lobby = root.querySelector(".uai-mode-lobby");
    if (!space || !lobby) return false;

    state.root = root;
    state.space = space;
    state.lobby = lobby;
    root.dataset.luxuryStage3Mounted = "1";
    root.dataset.luxuryStage3Revision = REVISION;

    createCinematicLayers();

    state.pointerHandler = onPointerMove;
    state.leaveHandler = () => {
      state.targetX = 0;
      state.targetY = 0;
      state.pointerX = window.innerWidth * .5;
      state.pointerY = window.innerHeight * .42;
    };
    state.visibilityHandler = sync;

    window.addEventListener("pointermove", state.pointerHandler, { passive: true });
    document.documentElement.addEventListener("mouseleave", state.leaveHandler, { passive: true });
    document.addEventListener("visibilitychange", state.visibilityHandler);

    state.bodyObserver = new MutationObserver(sync);
    state.bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["data-uai-mode"] });

    state.rootObserver = new MutationObserver(sync);
    state.rootObserver.observe(root, { attributes: true, attributeFilter: ["hidden"] });

    sync();
    return true;
  }

  function findAndInstall() {
    const root = document.getElementById("uaiModeRoot");
    if (root && install(root)) {
      state.finderObserver?.disconnect();
      state.finderObserver = null;
      return true;
    }
    return false;
  }

  function init() {
    if (findAndInstall()) return;
    state.finderObserver = new MutationObserver(findAndInstall);
    state.finderObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.UnlimitedModeLuxuryStage3 = {
    revision: REVISION,
    refresh: sync,
    start,
    stop
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();