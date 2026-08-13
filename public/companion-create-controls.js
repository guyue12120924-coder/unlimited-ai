// Visible companion character controls.
(() => {
  const REVISION = "2026-08-13-v7.1-character-controls-2";
  let scheduled = false;

  function ensureOverrideStyle() {
    if (document.getElementById("uaiCompanionCreateControlsStyle")) return;
    const style = document.createElement("style");
    style.id = "uaiCompanionCreateControlsStyle";
    style.textContent = `
      #uaiCompanionCharacterBtn span{font-size:13px!important}
      #uaiCompanionCharacterBtn span::after{content:none!important}
      #uaiCompanionCharacterBtn b{font-size:12px!important;opacity:.78!important}
      #uaiCompanionCharacterBtn b::after{content:none!important}
      #uaiCompanionCreateCharacterBtn{border:1px solid rgba(255,255,255,.24)!important;background:rgba(255,255,255,.11)!important;min-height:46px!important;font-weight:750!important;box-shadow:0 8px 22px rgba(0,0,0,.14)!important}
      #uaiCompanionCreateCharacterBtn span{font-size:13px!important}
      #uaiCompanionCreateCharacterBtn b{font-size:11px!important;opacity:.84!important}
    `;
    document.head.appendChild(style);
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root) return;
    ensureOverrideStyle();

    const editButton = root.querySelector("#uaiCompanionCharacterBtn");
    if (editButton) {
      const label = editButton.querySelector("span");
      const hint = editButton.querySelector("b");
      if (label) label.textContent = "编辑当前角色";
      if (hint) hint.textContent = "编辑 ›";
    }

    if (!root.querySelector("#uaiCompanionCreateCharacterBtn")) {
      const actions = root.querySelector(".uai-c-side-actions");
      if (actions) {
        const button = document.createElement("button");
        button.className = "uai-c-sidebar-action uai-c-create-character-action";
        button.id = "uaiCompanionCreateCharacterBtn";
        button.type = "button";
        button.innerHTML = "<span>＋ 新增角色</span><b>新建 ›</b>";
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
