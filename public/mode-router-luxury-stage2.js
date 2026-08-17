// public/mode-router-luxury-stage2.js
(() => {
  const REVISION = "2026-08-17-v14.1-luxury-stage2";
  if (window.UnlimitedModeLuxuryStage2) return;

  const state = {
    root: null,
    lobby: null,
    space: null,
    lastPointer: null,
    lastRippleAt: 0,
    pulseTimer: 0,
    finderObserver: null,
    bodyObserver: null,
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

  function isLobbyVisible() {
    return Boolean(
      state.root &&
      document.body.dataset.uaiMode === "lobby" &&
      !state.root.hidden &&
      !document.hidden
    );
  }

  function clearPulseTimer() {
    if (!state.pulseTimer) return;
    window.clearTimeout(state.pulseTimer);
    state.pulseTimer = 0;
  }

  function removeTransientEffects() {
    state.root?.querySelectorAll(".uai-speed-ripple,.uai-space-pulse").forEach((node) => node.remove());
  }

  function addBrandSatellites() {
    const mark = state.root?.querySelector(".uai-brand-mark");
    if (!mark || mark.querySelector(".uai-brand-satellite")) return;

    ["sat-a", "sat-b", "sat-c"].forEach((className) => {
      const satellite = document.createElement("span");
      satellite.className = `uai-brand-satellite ${className}`;
      satellite.setAttribute("aria-hidden", "true");
      mark.appendChild(satellite);
    });
  }

  function addWorldMotes() {
    state.root?.querySelectorAll(".uai-mode-card").forEach((card) => {
      if (card.querySelector(".uai-world-motes")) return;

      const motes = document.createElement("span");
      motes.className = "uai-world-motes";
      motes.setAttribute("aria-hidden", "true");

      for (let i = 0; i < 8; i += 1) {
        const mote = document.createElement("i");
        mote.style.setProperty("--mote-index", String(i));
        motes.appendChild(mote);
      }

      const orbit = document.createElement("span");
      orbit.className = "uai-card-orbit";
      orbit.setAttribute("aria-hidden", "true");

      card.appendChild(motes);
      card.appendChild(orbit);
    });
  }

  function spawnSpeedRipple(x, y, strength = 1) {
    if (!state.root || reducedMotion() || coarsePointer()) return;

    const normalized = Math.min(1.45, Math.max(.75, strength));
    const ripple = document.createElement("span");
    ripple.className = "uai-speed-ripple";
    ripple.setAttribute("aria-hidden", "true");
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.style.setProperty("--ripple-scale", String((4.6 * normalized).toFixed(2)));
    ripple.dataset.side = x < window.innerWidth / 2 ? "novel" : "companion";
    state.root.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 920);
  }

  function onPointerMove(event) {
    if (!isLobbyVisible() || reducedMotion() || coarsePointer() || event.pointerType === "touch") return;

    const now = performance.now();
    const current = { x: event.clientX, y: event.clientY, time: now };
    const last = state.lastPointer;
    state.lastPointer = current;
    if (!last) return;

    const dx = current.x - last.x;
    const dy = current.y - last.y;
    const distance = Math.hypot(dx, dy);
    const elapsed = Math.max(8, now - last.time);
    const velocity = distance / elapsed;

    if (velocity > 1.05 && now - state.lastRippleAt > 150) {
      state.lastRippleAt = now;
      spawnSpeedRipple(current.x, current.y, .78 + Math.min(.62, velocity * .22));
    }
  }

  function spawnSpacePulse() {
    if (!isLobbyVisible() || reducedMotion()) return;

    const space = state.space || state.root?.querySelector(".uai-luxury-space");
    if (!space) return;

    const scale = .8 + Math.random() * .75;
    const pulse = document.createElement("span");
    const leftHalf = Math.random() > .48;
    pulse.className = `uai-space-pulse ${leftHalf ? "blue" : "pink"}`;
    pulse.setAttribute("aria-hidden", "true");
    pulse.style.left = `${8 + Math.random() * 84}%`;
    pulse.style.top = `${9 + Math.random() * 72}%`;
    pulse.style.setProperty("--pulse-mid-scale", String((1.2 * scale).toFixed(2)));
    pulse.style.setProperty("--pulse-final-scale", String((2.1 * scale).toFixed(2)));
    space.appendChild(pulse);

    window.setTimeout(() => pulse.remove(), 2300);
  }

  function scheduleSpacePulse() {
    clearPulseTimer();
    if (!isLobbyVisible() || reducedMotion()) return;

    state.pulseTimer = window.setTimeout(() => {
      state.pulseTimer = 0;
      if (isLobbyVisible()) spawnSpacePulse();
      scheduleSpacePulse();
    }, 6000 + Math.random() * 7000);
  }

  function sync() {
    if (isLobbyVisible()) {
      scheduleSpacePulse();
      return;
    }

    clearPulseTimer();
    state.lastPointer = null;
    removeTransientEffects();
  }

  function install(root) {
    if (!root || root.dataset.luxuryStage2Mounted === "1") return false;

    state.root = root;
    state.lobby = root.querySelector(".uai-mode-lobby");
    state.space = root.querySelector(".uai-luxury-space");
    if (!state.lobby || !state.space) return false;

    root.dataset.luxuryStage2Mounted = "1";
    root.dataset.luxuryStage2Revision = REVISION;

    addBrandSatellites();
    addWorldMotes();

    state.pointerHandler = onPointerMove;
    state.leaveHandler = () => { state.lastPointer = null; };
    state.visibilityHandler = sync;

    window.addEventListener("pointermove", state.pointerHandler, { passive: true });
    document.documentElement.addEventListener("mouseleave", state.leaveHandler, { passive: true });
    document.addEventListener("visibilitychange", state.visibilityHandler);

    state.bodyObserver = new MutationObserver(sync);
    state.bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["data-uai-mode"] });

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

  window.UnlimitedModeLuxuryStage2 = {
    revision: REVISION,
    refresh: sync,
    pulse: spawnSpacePulse
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();