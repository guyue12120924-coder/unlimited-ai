// public/mode-router-luxury-stage5.js
(() => {
  const REVISION = "2026-08-17-v14.4-micro-polish";
  const HANDOFF_REVISION = "2026-08-17-v14.9-world-handoff";
  if (window.UnlimitedModeLuxuryStage5) return;

  const state = {
    root: null,
    observer: null,
    bodyObserver: null,
    rootObserver: null,
    visibilityHandler: null,
    cards: [],
    frames: new WeakMap()
  };

  function reducedMotion() {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }

  function coarsePointer() {
    return Boolean(window.matchMedia?.("(pointer: coarse)").matches);
  }

  function recordBootError(message) {
    const errors = window.__UNLIMITED_BOOT__?.errors;
    if (Array.isArray(errors) && !errors.includes(message)) errors.push(message);
    console.error(`[Unlimited AI] ${message}`);
  }

  function ensureTransitionHandoff() {
    if (!document.getElementById("uaiModeTransitionV149Css")) {
      const link = document.createElement("link");
      link.id = "uaiModeTransitionV149Css";
      link.rel = "stylesheet";
      link.href = `/mode-router-transition-v149.css?v=${encodeURIComponent(HANDOFF_REVISION)}`;
      link.addEventListener("error", () => recordBootError("V14.9 世界切换样式加载失败"), { once: true });
      document.head.appendChild(link);
    }

    if (window.UnlimitedModeTransitionV149 || document.getElementById("uaiModeTransitionV149Script")) return;
    const script = document.createElement("script");
    script.id = "uaiModeTransitionV149Script";
    script.async = false;
    script.src = `/mode-router-transition-v149.js?v=${encodeURIComponent(HANDOFF_REVISION)}`;
    script.addEventListener("error", () => recordBootError("V14.9 世界切换脚本加载失败"), { once: true });
    document.body.appendChild(script);
  }

  function lobbyActive() {
    return Boolean(
      state.root &&
      document.body.dataset.uaiMode === "lobby" &&
      !state.root.hidden &&
      !document.hidden
    );
  }

  function getFrameState(card) {
    let frame = state.frames.get(card);
    if (!frame) {
      frame = { raf: 0, x: 0, y: 0 };
      state.frames.set(card, frame);
    }
    return frame;
  }

  function resetCard(card) {
    const frame = getFrameState(card);
    if (frame.raf) cancelAnimationFrame(frame.raf);
    frame.raf = 0;

    card.style.setProperty("--uai-micro-x", "50%");
    card.style.setProperty("--uai-micro-y", "50%");
    card.style.setProperty("--uai-copy-x", "0px");
    card.style.setProperty("--uai-copy-y", "0px");
    card.style.setProperty("--uai-preview-x", "0px");
    card.style.setProperty("--uai-preview-y", "0px");
    card.style.setProperty("--uai-tags-x", "0px");
    card.style.setProperty("--uai-tags-y", "0px");
    card.style.setProperty("--uai-cta-x", "0px");
    card.style.setProperty("--uai-cta-y", "0px");
  }

  function applyPointer(card, clientX, clientY) {
    if (!lobbyActive() || reducedMotion() || coarsePointer()) return;
    const rect = card.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(rect.width, 1)));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(rect.height, 1)));
    const nx = (x - .5) * 2;
    const ny = (y - .5) * 2;

    card.style.setProperty("--uai-micro-x", `${(x * 100).toFixed(1)}%`);
    card.style.setProperty("--uai-micro-y", `${(y * 100).toFixed(1)}%`);
    card.style.setProperty("--uai-copy-x", `${(nx * 2.4).toFixed(2)}px`);
    card.style.setProperty("--uai-copy-y", `${(ny * 1.8).toFixed(2)}px`);
    card.style.setProperty("--uai-preview-x", `${(nx * 4.8).toFixed(2)}px`);
    card.style.setProperty("--uai-preview-y", `${(ny * 3.6).toFixed(2)}px`);
    card.style.setProperty("--uai-tags-x", `${(nx * 3.0).toFixed(2)}px`);
    card.style.setProperty("--uai-tags-y", `${(ny * 2.2).toFixed(2)}px`);
    card.style.setProperty("--uai-cta-x", `${(nx * 6.0).toFixed(2)}px`);
    card.style.setProperty("--uai-cta-y", `${(ny * 4.0).toFixed(2)}px`);
  }

  function schedulePointer(card, event) {
    if (!lobbyActive() || reducedMotion() || coarsePointer() || event.pointerType === "touch") return;
    const frame = getFrameState(card);
    frame.x = event.clientX;
    frame.y = event.clientY;
    if (frame.raf) return;

    frame.raf = requestAnimationFrame(() => {
      frame.raf = 0;
      applyPointer(card, frame.x, frame.y);
    });
  }

  function addPreviewDetails(card, kind) {
    const preview = card.querySelector(".uai-mode-preview");
    if (preview && !preview.querySelector(".uai-micro-preview-glass")) {
      const glass = document.createElement("span");
      glass.className = "uai-micro-preview-glass";
      glass.setAttribute("aria-hidden", "true");
      preview.appendChild(glass);
    }

    if (kind === "novel" && preview && !preview.querySelector(".uai-novel-progress")) {
      const progress = document.createElement("span");
      progress.className = "uai-novel-progress";
      progress.setAttribute("aria-hidden", "true");
      progress.innerHTML = '<i></i><b>07 / 24</b>';
      preview.appendChild(progress);
    }

    if (kind === "companion" && preview && !preview.querySelector(".uai-companion-typing")) {
      const typing = document.createElement("span");
      typing.className = "uai-companion-typing";
      typing.setAttribute("aria-hidden", "true");
      typing.innerHTML = '<i></i><i></i><i></i><b>正在输入</b>';
      preview.appendChild(typing);
    }
  }

  function enhanceCard(card) {
    if (!card || card.dataset.microPolishMounted === "1") return;
    card.dataset.microPolishMounted = "1";
    const kind = card.classList.contains("novel") ? "novel" : "companion";

    const sheen = document.createElement("span");
    sheen.className = "uai-micro-sheen";
    sheen.setAttribute("aria-hidden", "true");
    card.appendChild(sheen);

    const depth = document.createElement("span");
    depth.className = "uai-micro-depth-ring";
    depth.setAttribute("aria-hidden", "true");
    card.appendChild(depth);

    const enter = card.querySelector(".uai-mode-enter");
    if (enter && !enter.querySelector(".uai-enter-halo")) {
      const halo = document.createElement("span");
      halo.className = "uai-enter-halo";
      halo.setAttribute("aria-hidden", "true");
      enter.prepend(halo);
    }

    addPreviewDetails(card, kind);
    resetCard(card);

    card.addEventListener("pointermove", (event) => schedulePointer(card, event), { passive: true });
    card.addEventListener("pointerleave", () => resetCard(card), { passive: true });
    card.addEventListener("blur", () => resetCard(card));
  }

  function sync() {
    if (lobbyActive()) return;
    state.cards.forEach(resetCard);
  }

  function install(root) {
    if (!root) return false;
    state.root = root;
    root.dataset.luxuryStage5Revision = REVISION;
    state.cards = [...root.querySelectorAll(".uai-mode-card")];
    state.cards.forEach(enhanceCard);

    if (!state.bodyObserver) {
      state.bodyObserver = new MutationObserver(sync);
      state.bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["data-uai-mode"] });
    }

    if (!state.rootObserver) {
      state.rootObserver = new MutationObserver(sync);
      state.rootObserver.observe(root, { attributes: true, attributeFilter: ["hidden"] });
    }

    if (!state.visibilityHandler) {
      state.visibilityHandler = sync;
      document.addEventListener("visibilitychange", state.visibilityHandler);
    }

    window.UnlimitedModeTransitionV149?.refresh?.();
    return root.querySelectorAll(".uai-mode-card[data-micro-polish-mounted='1']").length >= 2;
  }

  function findAndInstall() {
    return install(document.getElementById("uaiModeRoot"));
  }

  function init() {
    ensureTransitionHandoff();
    if (findAndInstall()) return;
    state.observer = new MutationObserver(() => {
      if (findAndInstall()) {
        state.observer?.disconnect();
        state.observer = null;
      }
    });
    state.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.UnlimitedModeLuxuryStage5 = {
    revision: REVISION,
    handoffRevision: HANDOFF_REVISION,
    refresh: findAndInstall,
    reset: sync,
    ensureTransitionHandoff
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();