// public/companion-v3-guard.js
// Small safety/data companion for the V3 multi-character layer.
(() => {
  const REVISION = "2026-08-13-v4.2-companion-guard-1";
  const CHARACTERS_KEY = "uai_companion_characters_v1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  const PROFILE_KEY = "uai_companion_profile_v1";
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
      version: 1,
      exportedAt: new Date().toISOString(),
      activeCharacterId: localStorage.getItem(ACTIVE_KEY) || "",
      characters
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

  function reconcileReset() {
    const characters = safeParse(localStorage.getItem(CHARACTERS_KEY), []);
    if (!Array.isArray(characters) || !characters.length) return;
    const profile = safeParse(localStorage.getItem(PROFILE_KEY), null);
    if (profile && typeof profile === "object") return;
    // The legacy reset action removes all active companion slots. When that
    // happens, also drop the V3 snapshots so “重置陪伴模式” really means all roles.
    localStorage.removeItem(CHARACTERS_KEY);
    localStorage.removeItem(ACTIVE_KEY);
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    reconcileReset();
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

  window.UnlimitedCompanionGuard = { revision: REVISION, exportAllCharacters };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
