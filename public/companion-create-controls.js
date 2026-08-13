// Companion primary navigation and role controls.
(() => {
  const REVISION = "2026-08-13-v8.0-primary-ux-1";
  const KEYS = {
    characters: "uai_companion_characters_v1",
    activeCharacter: "uai_companion_active_character_v1"
  };
  let scheduled = false;

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function getCharacters() {
    const value = safeParse(localStorage.getItem(KEYS.characters), []);
    return Array.isArray(value) ? value.filter((item) => item?.id && item?.profile) : [];
  }

  function getActiveId() {
    return localStorage.getItem(KEYS.activeCharacter) || "";
  }

  function openEditor() {
    window.UnlimitedCompanionProfileEditor?.openEditor?.(getActiveId());
  }

  function openCreate() {
    if (window.UnlimitedCompanionProfileEditor?.openCreate) {
      window.UnlimitedCompanionProfileEditor.openCreate();
      return;
    }
    window.UnlimitedCompanionMulti?.showCharacterManager?.();
  }

  function openManager() {
    window.UnlimitedCompanionMulti?.showCharacterManager?.();
  }

  function ensureRoleToolbar(root) {
    const profileCard = root.querySelector("#uaiCompanionProfileCard");
    if (!profileCard) return;
    const profile = window.UnlimitedCompanion?.getState?.()?.profile;
    if (!profile) return;

    let toolbar = root.querySelector("#uaiCompanionRoleToolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = "uaiCompanionRoleToolbar";
      toolbar.className = "uai-c-role-toolbar";
      profileCard.insertAdjacentElement("afterend", toolbar);
    }

    const characters = getCharacters();
    const activeId = getActiveId();
    const active = characters.find((item) => item.id === activeId) || characters[0];
    const signature = `${active?.id || ""}|${active?.profile?.name || profile.name || ""}|${characters.length}`;
    if (toolbar.dataset.signature === signature) return;
    toolbar.dataset.signature = signature;

    toolbar.innerHTML = `
      <button type="button" class="uai-c-role-main" id="uaiCompanionRoleSwitch" title="切换角色">
        <span>切换角色</span>
        <b>${characters.length || 1}/6</b>
      </button>
      <button type="button" class="uai-c-role-sub" id="uaiCompanionRoleEdit" title="编辑当前角色">编辑</button>
      <button type="button" class="uai-c-role-add" id="uaiCompanionRoleAdd" title="新增角色">＋ 新增</button>
    `;

    toolbar.querySelector("#uaiCompanionRoleSwitch")?.addEventListener("click", openManager);
    toolbar.querySelector("#uaiCompanionRoleEdit")?.addEventListener("click", openEditor);
    toolbar.querySelector("#uaiCompanionRoleAdd")?.addEventListener("click", openCreate);
  }

  function simplifySidebar(root) {
    const sideLabel = root.querySelector(".uai-c-sidebar > .uai-c-side-label");
    if (sideLabel) sideLabel.textContent = "聊天记录";

    const memory = root.querySelector("#uaiCompanionMemoryBtn span");
    if (memory) memory.textContent = "长期记忆";

    const settings = root.querySelector("#uaiCompanionSettingsBtn span");
    if (settings) settings.textContent = "设置";

    const exit = root.querySelector("#uaiCompanionExitBtn span");
    if (exit) exit.textContent = "返回模式大厅";

    root.querySelector("#uaiCompanionCreateCharacterBtn")?.remove();
  }

  function simplifyCharacterManager() {
    const manager = document.getElementById("uaiCompanionV3Mask");
    if (!manager) return;
    const title = manager.querySelector(".uai-c-v3-modal:not(.compact) header h3");
    const desc = manager.querySelector(".uai-c-v3-modal:not(.compact) header p");
    const add = manager.querySelector("#uaiCompanionAddCharacter");
    if (title) title.textContent = "我的角色";
    if (desc) desc.textContent = "每个角色拥有独立的设定、聊天、长期记忆和模型设置。";
    if (add) add.textContent = "＋ 新增角色";
  }

  function simplifyHeader(root) {
    const input = root.querySelector("#uaiCompanionInput");
    const profile = window.UnlimitedCompanion?.getState?.()?.profile;
    if (input && profile?.name) input.placeholder = `和${profile.name}说点什么……`;
    const hint = root.querySelector(".uai-c-composer-hint");
    if (hint) hint.textContent = "Enter 发送 · Shift + Enter 换行";
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root) return;

    simplifySidebar(root);
    ensureRoleToolbar(root);
    simplifyHeader(root);
    simplifyCharacterManager();
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

  window.UnlimitedCompanionCharacterControls = {
    revision: REVISION,
    refresh: schedule,
    openCreate,
    openEditor,
    openManager
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
