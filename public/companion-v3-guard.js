// public/companion-v3-guard.js
// Safety/data companion for the multi-character layers.
(() => {
  const REVISION = "2026-08-13-v4.3-companion-guard-2";
  const CHARACTERS_KEY = "uai_companion_characters_v1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  const PROFILE_KEY = "uai_companion_profile_v1";
  const MOMENTS_KEY = "uai_companion_moments_v1";
  const ARCHIVE_KEY = "uai_companion_memory_archive_v1";
  let scheduled = false;

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function isGenerating() {
    return Boolean(document.querySelector("#uaiCompanionInput:disabled"));
  }

  function blockUnsafeActions(event) {
    if (document.body.dataset.uaiMode !== "companion" || !isGenerating()) return;
    const target = event.target?.closest?.("[data-switch-character], [data-delete-character], #uaiCompanionAddCharacter, .uai-c-v3-actions button, #uaiCompanionReset");
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
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

  function ensureExportButton() {
    const modal = document.querySelector("#uaiCompanionV3Mask .uai-c-v3-modal:not(.compact)");
    const footer = modal?.querySelector(":scope > footer");
    if (!footer || footer.querySelector("#uaiV3ExportAll")) return;
    const button = document.createElement("button");
    button.id = "uaiV3ExportAll";
    button.type = "button";
    button.className = "secondary";
    button.textContent = "导出全部角色";
    button.addEventListener("click", exportAllCharacters);
    const add = footer.querySelector("#uaiCompanionAddCharacter");
    if (add) footer.insertBefore(button, add);
    else footer.appendChild(button);
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
    // The legacy reset action removes all active companion slots. When that
    // happens, also drop multi-character snapshots and V4 companion metadata.
    localStorage.removeItem(CHARACTERS_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(MOMENTS_KEY);
    localStorage.removeItem(ARCHIVE_KEY);
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    reconcileReset();
    pruneOrphanedRoleData();
    ensureExportButton();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionGuardRevision = REVISION;
    document.addEventListener("click", blockUnsafeActions, true);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "class", "data-uai-mode"] });
    schedule();
  }

  window.UnlimitedCompanionGuard = { revision: REVISION, exportAllCharacters, pruneOrphanedRoleData };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();