// Companion V12.4 phase 1 — visual state hooks for the desktop composer.
(() => {
  const REVISION = "2026-08-14-v12.4-phase1-1";
  let boundInput = null;
  let scheduled = false;

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
