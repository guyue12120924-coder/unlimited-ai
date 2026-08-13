// Companion primary navigation and role controls.
(() => {
  const REVISION = "2026-08-13-v8.0-primary-ux-3";
  const KEYS = {
    characters: "uai_companion_characters_v1",
    activeCharacter: "uai_companion_active_character_v1",
    rollback: "uai_companion_import_rollback_v1"
  };
  const LONG_REPLY_THRESHOLD = 1800;
  const LENGTH_PRESETS = [
    ["short", "约 500 字", "短一些"],
    ["balanced", "约 1000 字", "默认"],
    ["detailed", "约 5000 字", "长回复"]
  ];
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

  function openRelationshipRecord() {
    document.getElementById("uaiCompanionV3Mask")?.remove();
    window.UnlimitedCompanionProfileRestore?.showCharacterProfile?.();
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
    const modal = manager.querySelector(".uai-c-v3-modal:not(.compact)");
    if (!modal) return;
    const title = modal.querySelector("header h3");
    const desc = modal.querySelector("header p");
    const footer = modal.querySelector(":scope > footer");
    const add = modal.querySelector("#uaiCompanionAddCharacter");
    if (title) title.textContent = "我的角色";
    if (desc) desc.textContent = "每个角色拥有独立的设定、聊天、长期记忆和模型设置。";
    if (add) add.textContent = "＋ 新增角色";

    if (footer && !footer.querySelector("#uaiV8RelationshipRecord") && window.UnlimitedCompanionProfileRestore?.showCharacterProfile) {
      const relationship = document.createElement("button");
      relationship.type = "button";
      relationship.id = "uaiV8RelationshipRecord";
      relationship.className = "secondary";
      relationship.textContent = "关系记录";
      relationship.addEventListener("click", openRelationshipRecord);
      footer.insertBefore(relationship, add || null);
    }
  }

  function simplifyHeader(root) {
    const input = root.querySelector("#uaiCompanionInput");
    const profile = window.UnlimitedCompanion?.getState?.()?.profile;
    if (input && profile?.name) input.placeholder = `和${profile.name}说点什么……`;
    const hint = root.querySelector(".uai-c-composer-hint");
    if (hint) hint.textContent = "Enter 发送 · Shift + Enter 换行";
  }

  function ensureLengthPills(modal) {
    const select = modal.querySelector("#uaiCompanionReplyLength");
    if (!select || select.dataset.v8Ready === "1") return;
    select.dataset.v8Ready = "1";
    select.classList.add("uai-c-v8-native-hidden");

    const pills = document.createElement("div");
    pills.className = "uai-c-v8-length-pills";
    const refresh = () => {
      pills.querySelectorAll("button").forEach((button) => {
        button.classList.toggle("selected", button.dataset.value === select.value);
      });
    };

    LENGTH_PRESETS.forEach(([value, label, hint]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.value = value;
      button.innerHTML = `<strong>${label}</strong><span>${hint}</span>`;
      button.addEventListener("click", () => {
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        refresh();
      });
      pills.appendChild(button);
    });
    select.insertAdjacentElement("afterend", pills);
    refresh();
  }

  function ensureDataPanel(modal) {
    if (modal.querySelector("#uaiV8DataPanel")) return;
    const clear = modal.querySelector("#uaiCompanionClearCurrent");
    const reset = modal.querySelector("#uaiCompanionReset");
    const oldExport = modal.querySelector("#uaiCompanionExport");
    const oldActions = oldExport?.closest(".uai-c-modal-actions") || clear?.closest(".uai-c-modal-actions");
    if (!oldActions) return;

    const details = document.createElement("details");
    details.id = "uaiV8DataPanel";
    details.className = "uai-c-v8-data-panel";
    details.innerHTML = `<summary><span>数据与备份</span><b>›</b></summary>`;

    const body = document.createElement("div");
    body.className = "uai-c-v8-data-body";
    const backup = document.createElement("div");
    backup.className = "uai-c-v8-data-row";

    const exportAll = document.createElement("button");
    exportAll.type = "button";
    exportAll.textContent = "导出全部角色";
    exportAll.addEventListener("click", () => window.UnlimitedCompanionGuard?.exportAllCharacters?.());

    const importAll = document.createElement("button");
    importAll.type = "button";
    importAll.textContent = "导入备份";
    importAll.addEventListener("click", () => window.UnlimitedCompanionProfileRestore?.chooseBackupFile?.());

    backup.append(exportAll, importAll);
    if (localStorage.getItem(KEYS.rollback)) {
      const rollback = document.createElement("button");
      rollback.type = "button";
      rollback.textContent = "撤销上次导入";
      rollback.addEventListener("click", () => window.UnlimitedCompanionProfileRestore?.restoreRollback?.());
      backup.appendChild(rollback);
    }
    body.appendChild(backup);

    if (clear || reset) {
      const dangerTitle = document.createElement("p");
      dangerTitle.className = "uai-c-v8-danger-title";
      dangerTitle.textContent = "危险操作";
      body.appendChild(dangerTitle);
      const danger = document.createElement("div");
      danger.className = "uai-c-v8-danger-row";
      if (clear) danger.appendChild(clear);
      if (reset) {
        reset.textContent = "重置全部陪伴数据";
        danger.appendChild(reset);
      }
      body.appendChild(danger);
    }

    details.appendChild(body);
    oldExport?.remove();
    oldActions.replaceWith(details);
  }

  function simplifySettingsModal() {
    const mask = document.getElementById("uaiCompanionModalMask");
    if (!mask || mask.hidden) return;
    const modal = mask.querySelector(".uai-c-modal");
    const model = modal?.querySelector("#uaiCompanionModel");
    const reply = modal?.querySelector("#uaiCompanionReplyLength");
    if (!modal || !model || !reply) return;

    const title = modal.querySelector(".uai-c-modal-head h3");
    const desc = modal.querySelector(".uai-c-modal-head p");
    if (title) title.textContent = "设置";
    if (desc) desc.textContent = "模型、回复长度和长期记忆。低频数据操作已经收进下方。";
    const stats = modal.querySelector(".uai-c-stat-grid");
    if (stats) stats.classList.add("uai-c-v8-hidden");

    ensureLengthPills(modal);
    ensureDataPanel(modal);
  }

  function enhanceLongReplies(root) {
    root.querySelectorAll("#uaiCompanionMessages .uai-c-message-row.assistant").forEach((row) => {
      const bubble = row.querySelector(".uai-c-bubble");
      if (!bubble || bubble.querySelector(".uai-c-typing")) return;
      const text = bubble.textContent || "";
      if (text.length <= LONG_REPLY_THRESHOLD) {
        row.classList.remove("uai-c-long-reply", "expanded");
        row.querySelector(".uai-c-long-toggle")?.remove();
        return;
      }

      row.classList.add("uai-c-long-reply");
      if (row.querySelector(".uai-c-long-toggle")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "uai-c-long-toggle";
      button.textContent = "展开全文";
      button.addEventListener("click", () => {
        const expanded = row.classList.toggle("expanded");
        button.textContent = expanded ? "收起" : "展开全文";
      });
      bubble.insertAdjacentElement("afterend", button);
    });
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
    simplifySettingsModal();
    enhanceLongReplies(root);
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
      characterData: true,
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
