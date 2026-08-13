// public/companion-v5-guard.js
// Post-restore normalization for companion settings and rollback housekeeping.
(() => {
  const REVISION = "2026-08-13-v5.0-companion-restore-guard-1";
  const CHARACTERS_KEY = "uai_companion_characters_v1";
  const SETTINGS_KEY = "uai_companion_settings_v1";
  const ROLLBACK_KEY = "uai_companion_import_rollback_v1";
  const VALID_REPLY_LENGTHS = new Set(["short", "balanced", "detailed"]);

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }
  function clean(value, max = 180) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  }
  function normalizeSettings(raw) {
    const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const replyLength = VALID_REPLY_LENGTHS.has(value.replyLength) ? value.replyLength : "balanced";
    return {
      model: clean(value.model, 180),
      replyLength,
      memoryEnabled: value.memoryEnabled !== false
    };
  }
  function normalizeStoredSettings() {
    const characters = safeParse(localStorage.getItem(CHARACTERS_KEY), []);
    if (Array.isArray(characters) && characters.length) {
      let changed = false;
      const next = characters.map((character) => {
        if (!character || typeof character !== "object") return character;
        const normalized = normalizeSettings(character.settings);
        if (JSON.stringify(normalized) === JSON.stringify(character.settings || {})) return character;
        changed = true;
        return { ...character, settings: normalized };
      });
      if (changed) localStorage.setItem(CHARACTERS_KEY, JSON.stringify(next));
    }
    const current = safeParse(localStorage.getItem(SETTINGS_KEY), {});
    const normalizedCurrent = normalizeSettings(current);
    if (JSON.stringify(current) !== JSON.stringify(normalizedCurrent)) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizedCurrent));
    }
  }
  function pruneExpiredRollback() {
    const rollback = safeParse(localStorage.getItem(ROLLBACK_KEY), null);
    if (!rollback?.savedAt) return;
    if (Date.now() - Number(rollback.savedAt) > 7 * 86400000) localStorage.removeItem(ROLLBACK_KEY);
  }
  function init() {
    document.documentElement.dataset.companionRestoreGuardRevision = REVISION;
    normalizeStoredSettings();
    pruneExpiredRollback();
  }

  window.UnlimitedCompanionRestoreGuard = {
    revision: REVISION,
    normalizeSettings,
    normalizeStoredSettings,
    pruneExpiredRollback
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
