// Companion runtime controls: reply sizing, generation guards, backup export and role-data housekeeping.
(() => {
  const REVISION = "2026-08-14-v9.6-runtime-1";
  const KEYS = {
    characters: "uai_companion_characters_v1",
    activeCharacter: "uai_companion_active_character_v1",
    profile: "uai_companion_profile_v1",
    moments: "uai_companion_moments_v1",
    archive: "uai_companion_memory_archive_v1"
  };
  const PRESETS = {
    short: { chars: 500, label: "约 500 字" },
    balanced: { chars: 1000, label: "约 1000 字 · 默认" },
    detailed: { chars: 5000, label: "约 5000 字" }
  };
  const nativeFetch = window.fetch.bind(window);
  let scheduled = false;

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function isGenerating() {
    return Boolean(document.querySelector("#uaiCompanionInput:disabled"));
  }

  function refreshReplyLengthUi() {
    scheduled = false;
    const select = document.getElementById("uaiCompanionReplyLength");
    if (!select) return;
    Object.entries(PRESETS).forEach(([value, preset]) => {
      const option = select.querySelector(`option[value="${value}"]`);
      if (option) option.textContent = preset.label;
    });
    const field = select.closest(".uai-c-field");
    if (field && !field.querySelector(".uai-c-reply-length-note")) {
      const note = document.createElement("small");
      note.className = "uai-c-reply-length-note";
      note.textContent = "实际回复会根据对话自然浮动，避免为了凑字数重复内容。";
      field.appendChild(note);
    }
  }

  function scheduleUi() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refreshReplyLengthUi);
  }

  function patchCompanionBody(body) {
    if (typeof body !== "string") return body;
    let payload;
    try { payload = JSON.parse(body); } catch { return body; }
    if (payload?.mode !== "companion") return body;

    const selected = String(payload?.companion_preferences?.replyLength || "balanced");
    const preset = PRESETS[selected] || PRESETS.balanced;
    payload.companion_preferences = { ...(payload.companion_preferences || {}), replyLength: "detailed" };

    const messages = Array.isArray(payload.messages) ? payload.messages.map((item) => ({ ...item })) : [];
    const hint = `【回复长度】本轮以约 ${preset.chars} 个中文字符为目标，可自然上下浮动约 20%。保持内容完整、自然、有互动感，不要重复或灌水。`;

    let attached = false;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "user" && typeof messages[i]?.content === "string") {
        messages[i].content = `${messages[i].content}\n\n${hint}`;
        attached = true;
        break;
      }
    }
    if (!attached) messages.push({ role: "user", content: hint });
    payload.messages = messages;
    return JSON.stringify(payload);
  }

  function installFetchTransform() {
    if (window.fetch?.__uaiCompanionRuntime === REVISION) return;
    const wrapped = function (input, init = {}) {
      const url = typeof input === "string" ? input : input?.url || "";
      const method = String(init?.method || (typeof input !== "string" ? input?.method : "") || "GET").toUpperCase();
      if (method !== "POST" || !/\/api\/chat(?:\?|$)/.test(url)) return nativeFetch(input, init);
      return nativeFetch(input, { ...init, body: patchCompanionBody(init.body) });
    };
    wrapped.__uaiCompanionRuntime = REVISION;
    window.fetch = wrapped;
  }

  function blockUnsafeActions(event) {
    if (document.body.dataset.uaiMode !== "companion" || !isGenerating()) return;
    const target = event.target?.closest?.([
      "[data-switch-character]",
      "[data-delete-character]",
      "#uaiCompanionAddCharacter",
      ".uai-c-v9-add",
      ".uai-c-v9-edit",
      "[data-v8-edit-character]",
      ".uai-c-v3-actions button",
      ".uai-c-v9-message-toolbar button",
      "#uaiCompanionReset"
    ].join(", "));
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    alert("当前回复还在生成。请先点击“停止”，再切换角色或修改对话。");
  }

  function exportAllCharacters() {
    window.UnlimitedCompanionMulti?.persist?.();
    const characters = safeParse(localStorage.getItem(KEYS.characters), []);
    if (!Array.isArray(characters) || !characters.length) return;
    const payload = {
      format: "unlimited-ai-companion-multichar-backup",
      version: 2,
      exportedAt: new Date().toISOString(),
      activeCharacterId: localStorage.getItem(KEYS.activeCharacter) || "",
      characters,
      importantMomentsByCharacter: safeParse(localStorage.getItem(KEYS.moments), {}),
      memoryArchiveByCharacter: safeParse(localStorage.getItem(KEYS.archive), {})
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `unlimited-ai-all-companions-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function pruneOrphanedRoleData() {
    const characters = safeParse(localStorage.getItem(KEYS.characters), []);
    if (!Array.isArray(characters) || !characters.length) return;
    const ids = new Set(characters.map((item) => item?.id).filter(Boolean));
    for (const key of [KEYS.moments, KEYS.archive]) {
      const map = safeParse(localStorage.getItem(key), {});
      if (!map || typeof map !== "object" || Array.isArray(map)) continue;
      let changed = false;
      for (const id of Object.keys(map)) {
        if (ids.has(id)) continue;
        delete map[id];
        changed = true;
      }
      if (changed) localStorage.setItem(key, JSON.stringify(map));
    }
  }

  function reconcileReset() {
    const characters = safeParse(localStorage.getItem(KEYS.characters), []);
    if (!Array.isArray(characters) || !characters.length) return;
    const profile = safeParse(localStorage.getItem(KEYS.profile), null);
    if (profile && typeof profile === "object") return;
    localStorage.removeItem(KEYS.characters);
    localStorage.removeItem(KEYS.activeCharacter);
    localStorage.removeItem(KEYS.moments);
    localStorage.removeItem(KEYS.archive);
  }

  function scheduleHousekeeping(event) {
    if (!event.target?.closest?.("[data-delete-character], #uaiCompanionReset")) return;
    setTimeout(() => {
      reconcileReset();
      pruneOrphanedRoleData();
    }, 0);
  }

  function init() {
    document.documentElement.dataset.companionRuntimeRevision = REVISION;
    installFetchTransform();
    document.addEventListener("click", blockUnsafeActions, true);
    document.addEventListener("click", scheduleHousekeeping, false);
    new MutationObserver(scheduleUi).observe(document.body, { subtree: true, childList: true });
    reconcileReset();
    pruneOrphanedRoleData();
    scheduleUi();
  }

  window.UnlimitedCompanionRuntime = {
    revision: REVISION,
    presets: PRESETS,
    refresh: scheduleUi,
    exportAllCharacters,
    pruneOrphanedRoleData,
    reconcileReset
  };
  // Compatibility for existing V9 settings/backup UI while old module names are retired.
  window.UnlimitedCompanionGuard = window.UnlimitedCompanionRuntime;
  window.UnlimitedCompanionReplyLength = window.UnlimitedCompanionRuntime;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();