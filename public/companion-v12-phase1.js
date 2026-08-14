// Companion V12.4 phase 1 — visual state hooks for the desktop composer.
(() => {
  const REVISION = "2026-08-14-v12.5-phase1-loader-1";
  let boundInput = null;
  let scheduled = false;

  function ensureStyle(href, id) {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function ensureScript(src, id) {
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = false;
    document.body.appendChild(script);
  }

  function loadPhase2Background() {
    ensureStyle(`/companion-v12-phase2-background.css?v=${encodeURIComponent(REVISION)}`, "uaiCompanionV12Phase2BackgroundCss");
    ensureScript(`/companion-v12-phase2-background.js?v=${encodeURIComponent(REVISION)}`, "uaiCompanionV12Phase2BackgroundScript");
  }

  function sync(root) {
    const input = root?.querySelector("#uaiCompanionInput");
    const composer = root?.querySelector(".uai-c-composer");
    if (!input || !composer) return;
    composer.classList.toggle("uai-c-v124-has-value", Boolean(String(input.value || "").trim()));
    composer.classList.toggle("uai-c-v124-focused", document.activeElement === input);
  }

  function bind(root) {
    const input = root?.querySelector("#uaiCompanionInput");
    if (!input) return;
    if (boundInput === input) {
      sync(root);
      return;
    }
    boundInput = input;
    const update = () => sync(root);
    input.addEventListener("input", update, { passive: true });
    input.addEventListener("focus", update, { passive: true });
    input.addEventListener("blur", update, { passive: true });
    input.addEventListener("change", update, { passive: true });
    sync(root);
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root || root.hidden) return;
    root.dataset.v124Phase1 = REVISION;
    bind(root);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionV124Phase1Revision = REVISION;
    loadPhase2Background();
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode", "class"]
    });
    window.UnlimitedCompanionV124Phase1 = { revision: REVISION, refresh: schedule };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
