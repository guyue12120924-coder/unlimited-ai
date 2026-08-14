// public/companion-v3-guard.js
// Data safety guard for the multi-character companion runtime.
(() => {
  const REVISION = "2026-08-14-v8.1-companion-guard-1";
  const CHARACTERS_KEY = "uai_companion_characters_v1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  const PROFILE_KEY = "uai_companion_profile_v1";
  const MOMENTS_KEY = "uai_companion_moments_v1";
  const ARCHIVE_KEY = "uai_companion_memory_archive_v1";

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function isGenerating() {
    return Boolean(document.querySelector("#uaiCompanionInput:disabled"));
  }

  function blockUnsafeActions(event) {
    if (document.body.dataset.uaiMode !== "companion" || !isGenerating()) return;
    const target = event.target?.closest?.([
      "[data-switch-character]",
      "[data-delete-character]",
      "#uaiCompanionAddCharacter",
      "#uaiCompanionRoleAdd",
      "#uaiCompanionRoleEdit",
      "[data-v8-edit-character]",
      ".uai-c-v3-actions button",
      "#uaiCompanionReset"
    ].join(", "));
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    alert("当前回复还在生成。请先点击“停止”，再切换角色或修改对话。");
  }

  function exportAllCharacters() {
    window.UnlimitedCompanionMulti?.persist?.();
    const characters = safeParse(localStorage.getItem(CHARACTERS_KEY), []);
    if (!Array.isArray(characters) || !characters.length) return;
    const payload = {
      format: "unlimited-ai-companion-multichar-backup",
      version: 2,
      exportedAt: new Date().toISOString(),
      activeCharacterId: localStorage.getItem(ACTIVE_KEY) || "",
      characters,
      importantMomentsByCharacter: safeParse(localStorage.getItem(MOMENTS_KEY), {}),
      memoryArchiveByCharacter: safeParse(localStorage.getItem(ARCHIVE_KEY), {})
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
    const characters = safeParse(localStorage.getItem(CHARACTERS_KEY), []);
    if (!Array.isArray(characters) || !characters.length) return;
    const ids = new Set(characters.map((item) => item?.id).filter(Boolean));
    for (const key of [MOMENTS_KEY, ARCHIVE_KEY]) {
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
    const characters = safeParse(localStorage.getItem(CHARACTERS_KEY), []);
    if (!Array.isArray(characters) || !characters.length) return;
    const profile = safeParse(localStorage.getItem(PROFILE_KEY), null);
    if (profile && typeof profile === "object") return;
    localStorage.removeItem(CHARACTERS_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(MOMENTS_KEY);
    localStorage.removeItem(ARCHIVE_KEY);
  }

  function scheduleHousekeeping(event) {
    if (!event.target?.closest?.("[data-delete-character], #uaiCompanionReset")) return;
    setTimeout(() => {
      reconcileReset();
      pruneOrphanedRoleData();
    }, 0);
  }

  function init() {
    document.documentElement.dataset.companionGuardRevision = REVISION;
    document.addEventListener("click", blockUnsafeActions, true);
    document.addEventListener("click", scheduleHousekeeping, false);
    reconcileReset();
    pruneOrphanedRoleData();
  }

  window.UnlimitedCompanionGuard = {
    revision: REVISION,
    exportAllCharacters,
    pruneOrphanedRoleData,
    reconcileReset
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
