// V17.8 safe companion controls: settings, search, relationship and backup UX.
(() => {
  const REVISION = "2026-08-22-v17.8-safe-controls-restore";
  if (window.UnlimitedCompanionControlsV178) return;

  const KEYS = {
    characters: "uai_companion_characters_v1",
    activeCharacter: "uai_companion_active_character_v1",
    profile: "uai_companion_profile_v1",
    sessions: "uai_companion_sessions_v1",
    memories: "uai_companion_memories_v1",
    settings: "uai_companion_settings_v1",
    moments: "uai_companion_moments_v1",
    archive: "uai_companion_memory_archive_v1",
    rollback: "uai_companion_import_rollback_v1"
  };

  const REPLY_PRESETS = [
    ["short", "简短", "像即时聊天，快速来回"],
    ["balanced", "自然", "日常默认，长度更均衡"],
    ["detailed", "详细", "解释和剧情时多说一些"]
  ];

  let functionsReady = false;

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function makeId(prefix) {
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${token}`;
  }

  function root() { return document.getElementById("uaiCompanionRoot"); }

  function showToast(message) {
    const host = root();
    if (!host) return;
    let toast = host.querySelector("#uaiCompanionToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "uaiCompanionToast";
      toast.className = "uai-c-toast";
      host.appendChild(toast);
    }
    toast.textContent = String(message || "");
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  async function ensureFunctions() {
    if (functionsReady && window.UnlimitedCompanionMemorySearch && window.UnlimitedCompanionProfileRestore) return true;
    const pack = window.UnlimitedCompanionFunctionPackV177;
    if (!pack?.load) return false;
    const ok = await pack.load();
    functionsReady = Boolean(ok && window.UnlimitedCompanionMemorySearch && window.UnlimitedCompanionProfileRestore);
    if (functionsReady) activateToolbar();
    return functionsReady;
  }

  async function runFeature(callback) {
    if (!(await ensureFunctions())) {
      showToast("扩展功能暂时没有加载完成，基础聊天仍可使用");
      return;
    }
    try { callback?.(); }
    catch (error) {
      console.warn("[Unlimited AI] V17.8 companion control action failed", error);
      showToast("这个功能暂时没有打开，请稍后重试");
    }
  }

  function toolButton(action, icon, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "uai-c-v178-tool";
    button.dataset.v178Action = action;
    button.disabled = !functionsReady;
    button.innerHTML = `<span aria-hidden="true">${icon}</span><b>${label}</b>`;
    return button;
  }

  function ensureToolbar() {
    if (document.body.dataset.uaiMode !== "companion") return;
    const host = root();
    const sidebar = host?.querySelector(".uai-c-sidebar");
    const newChat = host?.querySelector("#uaiCompanionNewChat");
    if (!sidebar || !newChat) return;

    let toolbar = sidebar.querySelector("#uaiCompanionV178Tools");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = "uaiCompanionV178Tools";
      toolbar.className = "uai-c-v178-tools";
      toolbar.setAttribute("aria-label", "陪伴快捷工具");
      toolbar.append(
        toolButton("companions", "♡", "伙伴"),
        toolButton("search", "⌕", "搜索"),
        toolButton("relationship", "∞", "关系"),
        toolButton("moments", "✦", "时刻")
      );
      newChat.insertAdjacentElement("afterend", toolbar);

      toolbar.addEventListener("click", (event) => {
        const button = event.target.closest("[data-v178-action]");
        if (!button) return;
        const action = button.dataset.v178Action;
        if (action === "companions") runFeature(() => window.UnlimitedCompanionCharacterControls?.openManager?.());
        if (action === "search") runFeature(() => window.UnlimitedCompanionMemorySearch?.showSearch?.());
        if (action === "relationship") runFeature(() => window.UnlimitedCompanionProfileRestore?.showCharacterProfile?.());
        if (action === "moments") runFeature(() => window.UnlimitedCompanionMemorySearch?.showMoments?.());
      });
    }
    activateToolbar();
  }

  function activateToolbar() {
    const toolbar = root()?.querySelector("#uaiCompanionV178Tools");
    if (!toolbar) return;
    const ready = functionsReady || document.documentElement.dataset.companionFunctionPack === "ready";
    toolbar.classList.toggle("is-ready", ready);
    toolbar.querySelectorAll("button").forEach((button) => { button.disabled = !ready; });
  }

  function exportAllCharacters() {
    window.UnlimitedCompanionMulti?.persist?.();
    let characters = safeParse(localStorage.getItem(KEYS.characters), []);
    if (!Array.isArray(characters)) characters = [];

    if (!characters.length) {
      const state = window.UnlimitedCompanion?.getState?.();
      if (state?.profile) {
        const id = localStorage.getItem(KEYS.activeCharacter) || makeId("companion-character");
        characters = [{
          id,
          profile: state.profile,
          sessions: Array.isArray(state.sessions) ? state.sessions : [],
          memories: Array.isArray(state.memories) ? state.memories : [],
          settings: state.settings || {},
          createdAt: Number(state.profile.createdAt) || Date.now(),
          updatedAt: Date.now()
        }];
      }
    }

    if (!characters.length) return showToast("当前没有可导出的陪伴角色");
    const activeId = localStorage.getItem(KEYS.activeCharacter) || characters[0]?.id || "";
    const payload = {
      format: "unlimited-ai-companion-multichar-backup",
      version: 2,
      exportedAt: new Date().toISOString(),
      activeCharacterId: activeId,
      characters,
      importantMomentsByCharacter: safeParse(localStorage.getItem(KEYS.moments), {}),
      memoryArchiveByCharacter: safeParse(localStorage.getItem(KEYS.archive), {})
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `unlimited-ai-companions-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast("完整陪伴备份已导出");
  }

  function syncPresetSelection(select, host) {
    host.querySelectorAll("[data-reply-preset]").forEach((button) => {
      button.classList.toggle("selected", button.dataset.replyPreset === select.value);
    });
  }

  function ensureReplyPresets(modal) {
    const select = modal.querySelector("#uaiCompanionReplyLength");
    if (!select || modal.querySelector("#uaiCompanionV178ReplyPresets")) return;
    select.classList.add("uai-c-v178-native-select");
    const presets = document.createElement("div");
    presets.id = "uaiCompanionV178ReplyPresets";
    presets.className = "uai-c-v178-reply-presets";
    REPLY_PRESETS.forEach(([value, title, hint]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.replyPreset = value;
      button.innerHTML = `<strong>${title}</strong><span>${hint}</span>`;
      button.addEventListener("click", () => {
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncPresetSelection(select, presets);
      });
      presets.appendChild(button);
    });
    select.insertAdjacentElement("afterend", presets);
    syncPresetSelection(select, presets);
    select.addEventListener("change", () => syncPresetSelection(select, presets));
  }

  function countData() {
    const characters = safeParse(localStorage.getItem(KEYS.characters), []);
    const state = window.UnlimitedCompanion?.getState?.();
    const roleCount = Array.isArray(characters) && characters.length ? characters.length : (state?.profile ? 1 : 0);
    const sessions = Array.isArray(state?.sessions) ? state.sessions : [];
    const messages = sessions.reduce((sum, item) => sum + (Array.isArray(item?.messages) ? item.messages.length : 0), 0);
    const memories = Array.isArray(state?.memories) ? state.memories.length : 0;
    return { roleCount, messages, memories };
  }

  function ensureDataPanel(modal) {
    if (modal.querySelector("#uaiCompanionV178DataPanel")) return;
    const saveActions = modal.querySelector("#uaiCompanionSettingsSave")?.closest(".uai-c-modal-actions");
    if (!saveActions) return;

    const originalExport = modal.querySelector("#uaiCompanionExport");
    if (originalExport) originalExport.textContent = "导出当前角色";

    const stats = countData();
    const panel = document.createElement("section");
    panel.id = "uaiCompanionV178DataPanel";
    panel.className = "uai-c-v178-data-panel";
    panel.innerHTML = `
      <div class="uai-c-v178-data-head">
        <div><span>DATA & TOOLS</span><strong>完整数据与常用工具</strong></div>
        <small>${stats.roleCount} 个伙伴 · ${stats.messages} 条消息 · ${stats.memories} 条当前记忆</small>
      </div>
      <div class="uai-c-v178-data-actions">
        <button type="button" data-v178-data="export-all"><b>导出全部伙伴</b><span>角色、聊天、记忆与重要时刻</span></button>
        <button type="button" data-v178-data="import"><b>导入完整备份</b><span>支持合并或覆盖恢复</span></button>
        <button type="button" data-v178-data="companions"><b>管理 AI 伙伴</b><span>新增、编辑、切换角色</span></button>
        <button type="button" data-v178-data="memories"><b>整理长期记忆</b><span>去重、置顶、归档与恢复</span></button>
      </div>`;

    if (localStorage.getItem(KEYS.rollback)) {
      const rollback = document.createElement("button");
      rollback.type = "button";
      rollback.className = "uai-c-v178-rollback";
      rollback.dataset.v178Data = "rollback";
      rollback.textContent = "↶ 撤销最近一次备份导入";
      panel.appendChild(rollback);
    }

    panel.addEventListener("click", (event) => {
      const button = event.target.closest("[data-v178-data]");
      if (!button) return;
      const action = button.dataset.v178Data;
      if (action === "export-all") exportAllCharacters();
      if (action === "import") runFeature(() => window.UnlimitedCompanionProfileRestore?.chooseBackupFile?.());
      if (action === "rollback") runFeature(() => window.UnlimitedCompanionProfileRestore?.restoreRollback?.());
      if (action === "companions") runFeature(() => window.UnlimitedCompanionCharacterControls?.openManager?.());
      if (action === "memories") runFeature(() => window.UnlimitedCompanionMemorySearch?.showMemoryOrganizer?.());
    });

    saveActions.insertAdjacentElement("beforebegin", panel);
  }

  function enhanceSettings() {
    if (document.body.dataset.uaiMode !== "companion") return;
    const modal = root()?.querySelector("#uaiCompanionModalMask .uai-c-modal");
    if (!modal || !modal.querySelector("#uaiCompanionSettingsSave")) return;
    modal.classList.add("uai-c-v178-settings");
    const title = modal.querySelector(".uai-c-modal-head h3");
    const desc = modal.querySelector(".uai-c-modal-head p");
    if (title) title.textContent = "陪伴设置与数据";
    if (desc) desc.textContent = "模型、回复长度、长期记忆与完整备份都在这里。";
    ensureReplyPresets(modal);
    ensureDataPanel(modal);
  }

  function onDocumentClick(event) {
    if (document.body.dataset.uaiMode !== "companion") return;
    if (event.target.closest("#uaiCompanionSettingsBtn")) requestAnimationFrame(enhanceSettings);
    if (event.target.closest(".uai-c-profile-card") && !event.target.closest("button, input, textarea, select, a")) {
      runFeature(() => window.UnlimitedCompanionCharacterControls?.openManager?.());
    }
  }

  function refresh() {
    if (document.body.dataset.uaiMode !== "companion") return;
    functionsReady = document.documentElement.dataset.companionFunctionPack === "ready";
    ensureToolbar();
    activateToolbar();
    enhanceSettings();
  }

  window.addEventListener("uai:companion-core-entered", () => {
    functionsReady = document.documentElement.dataset.companionFunctionPack === "ready";
    ensureToolbar();
  });
  window.addEventListener("uai:companion-functions-ready", () => {
    functionsReady = true;
    refresh();
  });
  window.addEventListener("uai:mode-refresh", refresh);
  document.addEventListener("click", onDocumentClick, false);

  document.documentElement.dataset.companionControlsRevision = REVISION;
  window.UnlimitedCompanionControlsV178 = {
    revision: REVISION,
    refresh,
    exportAllCharacters,
    enhanceSettings,
    ensureToolbar,
    get functionsReady() { return functionsReady; }
  };
})();
