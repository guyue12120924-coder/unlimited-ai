// Visible companion character controls.
(() => {
  const REVISION = "2026-08-13-v7.1-character-controls-1";
  let scheduled = false;

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root) return;

    const editButton = root.querySelector("#uaiCompanionCharacterBtn");
    if (editButton) {
      const label = editButton.querySelector("span");
      const hint = editButton.querySelector("b");
      if (label) label.textContent = "编辑当前角色";
      if (hint) hint.textContent = "编辑";
    }

    if (!root.querySelector("#uaiCompanionCreateCharacterBtn")) {
      const actions = root.querySelector(".uai-c-side-actions");
      if (actions) {
        const button = document.createElement("button");
        button.className = "uai-c-sidebar-action uai-c-create-character-action";
        button.id = "uaiCompanionCreateCharacterBtn";
        button.type = "button";
        button.innerHTML = "<span>＋ 新增角色</span><b>新建</b>";
        button.addEventListener("click", () => {
          if (window.UnlimitedCompanionProfileEditor?.openCreate) {
            window.UnlimitedCompanionProfileEditor.openCreate();
          } else {
            window.UnlimitedCompanionMulti?.showCharacterManager?.();
          }
        });

        const settings = root.querySelector("#uaiCompanionSettingsBtn");
        if (settings) actions.insertBefore(button, settings);
        else actions.appendChild(button);
      }
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionCharacterControlsRevision = REVISION;
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-uai-mode", "hidden", "class"]
    });
    schedule();
  }

  window.UnlimitedCompanionCharacterControls = { revision: REVISION, refresh: schedule };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
