// V17.9 safe companion runtime: generation guards, data housekeeping and status UI only.
(() => {
  const REVISION = "2026-08-22-v17.9-safe-runtime-restore";
  if (window.UnlimitedCompanionRuntimeV179) return;

  const KEYS = {
    characters: "uai_companion_characters_v1",
    activeCharacter: "uai_companion_active_character_v1",
    profile: "uai_companion_profile_v1",
    settings: "uai_companion_settings_v1",
    moments: "uai_companion_moments_v1",
    archive: "uai_companion_memory_archive_v1",
    rollback: "uai_companion_import_rollback_v1"
  };

  const REPLY_LABELS = {
    short: "简短回复",
    balanced: "自然回复",
    detailed: "详细回复"
  };

  let statusTimer = 0;

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function root() { return document.getElementById("uaiCompanionRoot"); }
  function isGenerating() { return Boolean(root()?.querySelector("#uaiCompanionInput:disabled")); }

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

  function activeCharacterIds() {
    const characters = safeParse(localStorage.getItem(KEYS.characters), []);
    if (!Array.isArray(characters)) return new Set();
    return new Set(characters.map((item) => item?.id).filter(Boolean));
  }

  function pruneRoleMap(key, ids) {
    const map = safeParse(localStorage.getItem(key), {});
    if (!map || typeof map !== "object" || Array.isArray(map)) return false;
    let changed = false;
    Object.keys(map).forEach((id) => {
      if (ids.has(id)) return;
      delete map[id];
      changed = true;
    });
    if (changed) localStorage.setItem(key, JSON.stringify(map));
    return changed;
  }

  function pruneOrphanedRoleData() {
    const ids = activeCharacterIds();
    if (!ids.size) return false;
    const a = pruneRoleMap(KEYS.moments, ids);
    const b = pruneRoleMap(KEYS.archive, ids);
    return a || b;
  }

  function reconcileReset() {
    const characters = safeParse(localStorage.getItem(KEYS.characters), []);
    const profile = safeParse(localStorage.getItem(KEYS.profile), null);
    const hasCharacters = Array.isArray(characters) && characters.length > 0;
    const hasProfile = Boolean(profile && typeof profile === "object");

    if (!hasCharacters && !hasProfile) {
      localStorage.removeItem(KEYS.activeCharacter);
      localStorage.removeItem(KEYS.moments);
      localStorage.removeItem(KEYS.archive);
      localStorage.removeItem(KEYS.rollback);
      return;
    }

    if (hasCharacters && !hasProfile) {
      localStorage.removeItem(KEYS.characters);
      localStorage.removeItem(KEYS.activeCharacter);
      localStorage.removeItem(KEYS.moments);
      localStorage.removeItem(KEYS.archive);
      localStorage.removeItem(KEYS.rollback);
    }
  }

  function unsafeTarget(event) {
    return event.target?.closest?.([
      "[data-switch-character]",
      "[data-delete-character]",
      "#uaiCompanionAddCharacter",
      "[data-v8-edit-character]",
      ".uai-c-v9-add",
      ".uai-c-v9-edit",
      ".uai-c-v3-actions button",
      "#uaiCompanionReset",
      "#uaiCompanionClearCurrent",
      "[data-v178-data='import']",
      "[data-v178-data='rollback']",
      "[data-v178-data='companions']",
      "#uaiCompanionV178Tools [data-v178-action='companions']"
    ].join(", ")) || null;
  }

  function blockUnsafeActions(event) {
    if (document.body.dataset.uaiMode !== "companion" || !isGenerating()) return;
    const target = unsafeTarget(event);
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showToast("当前回复还在生成，请先停止，再切换角色或修改数据");
  }

  function scheduleHousekeeping(event) {
    if (!event.target?.closest?.("[data-delete-character], #uaiCompanionReset, [data-v178-data='import'], [data-v178-data='rollback']")) return;
    setTimeout(() => {
      reconcileReset();
      pruneOrphanedRoleData();
      refreshStatus();
    }, 0);
  }

  function settings() {
    const value = safeParse(localStorage.getItem(KEYS.settings), {});
    return value && typeof value === "object" ? value : {};
  }

  function ensureStatusPill() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const host = root();
    const header = host?.querySelector(".uai-c-header");
    if (!header) return null;
    let pill = header.querySelector("#uaiCompanionRuntimeStatusV179");
    if (!pill) {
      pill = document.createElement("div");
      pill.id = "uaiCompanionRuntimeStatusV179";
      pill.className = "uai-c-v179-status";
      header.appendChild(pill);
    }
    return pill;
  }

  function refreshStatus() {
    clearTimeout(statusTimer);
    statusTimer = 0;
    if (document.body.dataset.uaiMode !== "companion") return;
    const pill = ensureStatusPill();
    if (!pill) return;
    const value = settings();
    const reply = REPLY_LABELS[String(value.replyLength || "balanced")] || REPLY_LABELS.balanced;
    const memory = value.memoryEnabled === false ? "记忆关闭" : "记忆开启";
    const generating = isGenerating();
    pill.innerHTML = `<span class="uai-c-v179-dot${generating ? " busy" : ""}"></span><span>${generating ? "正在回复" : `${reply} · ${memory}`}</span>`;
    pill.classList.toggle("is-generating", generating);
  }

  function scheduleStatus(delay = 0) {
    clearTimeout(statusTimer);
    statusTimer = setTimeout(refreshStatus, delay);
  }

  function onClick(event) {
    if (document.body.dataset.uaiMode !== "companion") return;
    if (event.target?.closest?.("#uaiCompanionSend, #uaiCompanionStop, #uaiCompanionSettingsSave, #uaiCompanionSettingsBtn")) {
      scheduleStatus(event.target.closest("#uaiCompanionSend") ? 40 : 0);
      scheduleStatus(240);
    }
  }

  function onKeydown(event) {
    if (document.body.dataset.uaiMode !== "companion") return;
    if (event.key === "Enter" && !event.shiftKey && event.target?.id === "uaiCompanionInput") {
      scheduleStatus(50);
      scheduleStatus(260);
    }
  }

  function refresh() {
    reconcileReset();
    pruneOrphanedRoleData();
    refreshStatus();
  }

  document.addEventListener("click", blockUnsafeActions, true);
  document.addEventListener("click", scheduleHousekeeping, false);
  document.addEventListener("click", onClick, false);
  document.addEventListener("keydown", onKeydown, false);
  window.addEventListener("uai:companion-core-entered", () => scheduleStatus(0));
  window.addEventListener("uai:companion-functions-ready", () => scheduleStatus(0));
  window.addEventListener("uai:mode-refresh", () => {
    if (document.body.dataset.uaiMode === "companion") scheduleStatus(0);
  });

  document.documentElement.dataset.companionSafeRuntimeRevision = REVISION;
  window.UnlimitedCompanionRuntimeV179 = {
    revision: REVISION,
    refresh,
    isGenerating,
    pruneOrphanedRoleData,
    reconcileReset,
    refreshStatus
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
})();
