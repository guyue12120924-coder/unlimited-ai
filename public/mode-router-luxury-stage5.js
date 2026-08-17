// public/mode-router-luxury-stage5.js
(() => {
  const REVISION = "2026-08-17-v14.4-micro-polish";
  if (window.UnlimitedModeLuxuryStage5) return;

  const state = {
    root: null,
    observer: null
  };

  function reducedMotion() {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }

  function coarsePointer() {
    return Boolean(window.matchMedia?.("(pointer: coarse)").matches);
  }

  function lobbyActive() {
    return Boolean(
      state.root &&
      document.body.dataset.uaiMode === "lobby" &&
      !state.root.hidden
    );
  }

  function resetCard(card) {
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

  function onPointerMove(card, event) {
    if (!lobbyActive() || reducedMotion() || coarsePointer() || event.pointerType === "touch") return;
    const rect = card.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1)));
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

    card.addEventListener("pointermove", (event) => onPointerMove(card, event), { passive: true });
    card.addEventListener("pointerleave", () => resetCard(card), { passive: true });
    card.addEventListener("blur", () => resetCard(card));
  }

  function install(root) {
    if (!root) return false;
    state.root = root;
    root.dataset.luxuryStage5Revision = REVISION;
    root.querySelectorAll(".uai-mode-card").forEach(enhanceCard);
    return root.querySelectorAll(".uai-mode-card[data-micro-polish-mounted='1']").length >= 2;
  }

  function findAndInstall() {
    return install(document.getElementById("uaiModeRoot"));
  }

  function init() {
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
    refresh: findAndInstall
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();