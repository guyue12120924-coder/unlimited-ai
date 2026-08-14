// Companion V12.3 — final desktop visual polish and explicit settings entry.
(() => {
  const REVISION = "2026-08-14-v12.3-polish-1";
  let scheduled = false;

  function getRoot() {
    return document.getElementById("uaiCompanionRoot");
  }

  function openSettings(root) {
    root?.querySelector("#uaiCompanionSettingsBtn")?.click();
  }

  function ensureHeaderSettings(root) {
    const header = root.querySelector(".uai-c-header");
    if (!header || header.querySelector("#uaiV123Settings")) return;
    let actions = header.querySelector(".uai-c-v11-header-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "uai-c-v11-header-actions";
      header.appendChild(actions);
    }
    const button = document.createElement("button");
    button.id = "uaiV123Settings";
    button.type = "button";
    button.className = "uai-c-v123-settings-trigger";
    button.innerHTML = `<i>⚙</i><span>设置</span>`;
    button.addEventListener("click", () => openSettings(root));
    actions.appendChild(button);
  }

  function enhanceSideActions(root) {
    const actions = root.querySelector(".uai-c-side-actions");
    if (!actions) return;
    actions.classList.add("uai-c-v123-side-dock");
    const memory = root.querySelector("#uaiCompanionMemoryBtn span");
    const settings = root.querySelector("#uaiCompanionSettingsBtn span");
    const exit = root.querySelector("#uaiCompanionExitBtn span");
    if (memory) memory.textContent = "长期记忆";
    if (settings) settings.textContent = "设置";
    if (exit) exit.textContent = "返回模式大厅";
  }

  function enhanceSidePanel(root) {
    const panel = root.querySelector(".uai-c-v12-sidepanel");
    if (!panel) return;
    if (!panel.querySelector('[data-v123-settings]')) {
      const section = panel.querySelector(".uai-c-v12-side-actions");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.v123Settings = "1";
      button.className = "uai-c-v123-side-settings";
      button.innerHTML = `<i>⚙</i><b>聊天设置</b><small>模型、回复长度与主题</small><em>›</em>`;
      button.addEventListener("click", () => openSettings(root));
      section?.appendChild(button);
    }
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = getRoot();
    if (!root || root.hidden) return;
    root.dataset.v123Polish = REVISION;
    ensureHeaderSettings(root);
    enhanceSideActions(root);
    enhanceSidePanel(root);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionV123Revision = REVISION;
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode", "data-v11-theme"]
    });
    window.addEventListener("storage", schedule);
    window.UnlimitedCompanionV123 = { revision: REVISION, refresh: schedule };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();