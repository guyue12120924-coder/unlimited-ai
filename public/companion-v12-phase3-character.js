// Companion V12.6 phase 3 — living central character interactions.
(() => {
  const REVISION = "2026-08-14-v12.6-phase3-1";
  let scheduled = false;
  let heartTimer = 0;
  let pointerBoundScene = null;

  function getRoot() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const root = document.getElementById("uaiCompanionRoot");
    return root && !root.hidden ? root : null;
  }

  function ensureHeartField(root) {
    const wrap = root?.querySelector(".uai-c-v122-portrait-wrap");
    if (!wrap) return null;
    let field = wrap.querySelector(":scope > .uai-c-v126-heart-field");
    if (!field) {
      field = document.createElement("div");
      field.className = "uai-c-v126-heart-field";
      field.setAttribute("aria-hidden", "true");
      wrap.appendChild(field);
    }
    return field;
  }

  function spawnHeart(root, initial = false) {
    const field = ensureHeartField(root);
    if (!field) return;
    const existing = field.querySelectorAll(".uai-c-v126-heart");
    if (existing.length >= 7) return;

    const heart = document.createElement("span");
    heart.className = "uai-c-v126-heart";
    const symbols = ["♥", "♥", "♡", "♥", "✦"];
    const colors = ["#ff8fd3", "#ff78c6", "#d9a8ff", "#aeb7ff"];
    heart.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    heart.style.setProperty("--left", `${24 + Math.random() * 53}%`);
    heart.style.setProperty("--size", `${10 + Math.random() * 9}px`);
    heart.style.setProperty("--drift-x", `${-34 + Math.random() * 68}px`);
    heart.style.setProperty("--rotation", `${-16 + Math.random() * 32}deg`);
    heart.style.setProperty("--duration", `${4.7 + Math.random() * 2.6}s`);
    heart.style.setProperty("--heart-color", colors[Math.floor(Math.random() * colors.length)]);
    if (initial) heart.style.animationDelay = `${Math.random() * -2.5}s`;
    field.appendChild(heart);
    heart.addEventListener("animationend", () => heart.remove(), { once: true });
  }

  function scheduleNextHeart() {
    clearTimeout(heartTimer);
    heartTimer = window.setTimeout(() => {
      const root = getRoot();
      if (root) spawnHeart(root);
      scheduleNextHeart();
    }, 1250 + Math.random() * 2300);
  }

  function bindCharacterParallax(root) {
    const scene = root?.querySelector(".uai-c-v122-scene");
    const wrap = root?.querySelector(".uai-c-v122-portrait-wrap");
    if (!scene || !wrap || pointerBoundScene === scene) return;
    pointerBoundScene = scene;

    scene.addEventListener("pointermove", (event) => {
      const rect = scene.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      wrap.style.setProperty("--v126-shift-x", `${(nx * 5.2).toFixed(2)}px`);
      wrap.style.setProperty("--v126-shift-y", `${(ny * 3.8).toFixed(2)}px`);
    }, { passive: true });

    scene.addEventListener("pointerleave", () => {
      wrap.style.setProperty("--v126-shift-x", "0px");
      wrap.style.setProperty("--v126-shift-y", "0px");
    }, { passive: true });
  }

  function bindPromptFeedback(root) {
    const buttons = root?.querySelectorAll(".uai-c-v122-prompts button") || [];
    buttons.forEach((button) => {
      if (button.dataset.v126Bound === "1") return;
      button.dataset.v126Bound = "1";
      button.addEventListener("click", () => {
        button.animate([
          { transform: "translateY(-2px) scale(1.02)", filter: "brightness(1.08)" },
          { transform: "translateY(0) scale(1)", filter: "brightness(1)" }
        ], { duration: 260, easing: "ease-out" });
        const liveRoot = getRoot();
        if (liveRoot) {
          spawnHeart(liveRoot);
          window.setTimeout(() => spawnHeart(liveRoot), 120);
        }
      });
    });
  }

  function seedHearts(root) {
    const field = ensureHeartField(root);
    if (!field || field.dataset.v126Seeded === "1") return;
    field.dataset.v126Seeded = "1";
    for (let i = 0; i < 3; i += 1) spawnHeart(root, true);
  }

  function enhance() {
    scheduled = false;
    const root = getRoot();
    if (!root) return;
    root.dataset.v126Phase3 = REVISION;
    ensureHeartField(root);
    seedHearts(root);
    bindCharacterParallax(root);
    bindPromptFeedback(root);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionV126Phase3Revision = REVISION;
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode", "class"]
    });
    window.addEventListener("storage", schedule);
    window.UnlimitedCompanionV126Phase3 = { revision: REVISION, refresh: schedule };
    schedule();
    scheduleNextHeart();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
