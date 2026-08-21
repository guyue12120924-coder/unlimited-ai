// public/history-lifecycle-v16.js
// V16.5: user-facing history persistence controller. Storage routing itself is owned
// exclusively by V16.3 Storage Core; this file no longer rewrites Storage.prototype.
(() => {
  const REVISION = "2026-08-21-v16.5-history-ui";
  if (window.UnlimitedHistoryLifecycleV16) return;

  const PERSIST_PREF = "cfw_history_persist_v16";
  const EPHEMERAL_SESSIONS = "uai_v16_ephemeral_novel_sessions";

  function storageCore() {
    return window.UnlimitedStorageV163 || null;
  }

  function readFallbackPreference() {
    try {
      const value = localStorage.getItem(PERSIST_PREF);
      return value === "1";
    } catch {
      return false;
    }
  }

  function isPersistent() {
    const core = storageCore();
    return core ? Boolean(core.persistent) : readFallbackPreference();
  }

  function transientRead() {
    try { return sessionStorage.getItem(EPHEMERAL_SESSIONS); }
    catch { return null; }
  }

  function transientClear() {
    try { sessionStorage.removeItem(EPHEMERAL_SESSIONS); }
    catch {}
  }

  function syncUi() {
    const input = document.getElementById("historyKeep");
    if (!input) return;
    const enabled = isPersistent();
    input.disabled = false;
    input.checked = enabled;
    input.setAttribute("aria-label", enabled
      ? "小说对话会在当前浏览器中保留"
      : "小说对话仅在当前页面临时保留");

    const description = input.closest(".settings-section")?.querySelector(".section-heading p");
    if (description) {
      description.textContent = enabled
        ? "已开启：刷新或重开浏览器后仍会恢复小说对话。"
        : "已关闭：当前页面内书架与聊天仍保持一致，刷新后不会恢复这些对话。";
    }
  }

  function applyPreference(enabled) {
    const next = Boolean(enabled);
    const core = storageCore();

    if (core?.setPersistence) {
      try { core.setPersistence(next); }
      catch (error) {
        window.__UNLIMITED_HISTORY_ERROR__ = {
          revision: REVISION,
          message: error?.message || String(error),
          at: Date.now()
        };
      }
    } else {
      try { localStorage.setItem(PERSIST_PREF, next ? "1" : "0"); }
      catch {}
    }

    syncUi();
    try {
      window.dispatchEvent(new CustomEvent("uai:history-persistence-change", {
        detail: { enabled: isPersistent(), revision: REVISION }
      }));
    } catch {}
  }

  // Capture the user-facing toggle before legacy app.js sees it. app.js keeps one live
  // session source; Storage Core decides whether that source is durable or ephemeral.
  document.addEventListener("change", (event) => {
    const input = event.target;
    if (input?.id !== "historyKeep") return;
    event.stopImmediatePropagation();
    applyPreference(input.checked);
  }, true);

  document.addEventListener("click", (event) => {
    if (!event.target?.closest?.("#settingsBtn")) return;
    setTimeout(syncUi, 0);
  }, true);

  window.addEventListener("uai:storage-error", syncUi);
  setTimeout(syncUi, 0);

  document.documentElement.dataset.historyLifecycleRevision = REVISION;
  window.UnlimitedHistoryLifecycleV16 = {
    revision: REVISION,
    get enabled() { return isPersistent(); },
    get ephemeral() { return transientRead(); },
    setEnabled: applyPreference,
    syncUi,
    clearEphemeral: transientClear,
    get storageCoreRevision() { return storageCore()?.revision || ""; }
  };
})();
