// public/history-lifecycle-v16.js
// V16.1: keep one session source for all legacy novel modules while honoring the
// user's choice about whether conversations survive a page reload.
(() => {
  const REVISION = "2026-08-20-v16.1-history-lifecycle";
  if (window.UnlimitedHistoryLifecycleV16) return;

  const LEGACY_HISTORY_FLAG = "cfw_history_enabled";
  const PERSIST_PREF = "cfw_history_persist_v16";
  const LS_SESSIONS = "cfw_sessions_v2";
  const EPHEMERAL_SESSIONS = "uai_v16_ephemeral_novel_sessions";

  const previousGetItem = Storage.prototype.getItem;
  const previousSetItem = Storage.prototype.setItem;
  const previousRemoveItem = Storage.prototype.removeItem;

  function rawGet(storage, key) {
    try { return previousGetItem.call(storage, key); }
    catch { return null; }
  }

  function rawSet(storage, key, value) {
    return previousSetItem.call(storage, key, String(value));
  }

  function rawRemove(storage, key) {
    try { previousRemoveItem.call(storage, key); } catch {}
  }

  function ensurePreference() {
    const existing = rawGet(localStorage, PERSIST_PREF);
    if (existing === "0" || existing === "1") return existing === "1";

    const legacy = rawGet(localStorage, LEGACY_HISTORY_FLAG);
    const enabled = (legacy ?? "0") === "1";
    try { rawSet(localStorage, PERSIST_PREF, enabled ? "1" : "0"); } catch {}
    return enabled;
  }

  let persistAcrossReloads = ensurePreference();

  function transientRead() {
    return rawGet(sessionStorage, EPHEMERAL_SESSIONS);
  }

  function transientWrite(value) {
    try {
      rawSet(sessionStorage, EPHEMERAL_SESSIONS, value ?? "[]");
      return true;
    } catch {
      return false;
    }
  }

  function transientClear() {
    rawRemove(sessionStorage, EPHEMERAL_SESSIONS);
  }

  // Legacy app.js only writes session changes when cfw_history_enabled is true. Keep
  // that internal maintenance path enabled, then route the actual session bytes below
  // to durable localStorage or same-page sessionStorage according to the real V16 pref.
  try { rawSet(localStorage, LEGACY_HISTORY_FLAG, "1"); } catch {}

  // With persistence disabled, every page load starts a fresh transient conversation.
  // Any old durable data is left untouched but hidden, avoiding destructive migration.
  if (!persistAcrossReloads) transientClear();

  Storage.prototype.getItem = function v16HistoryGetItem(key) {
    if (this === localStorage && key === LEGACY_HISTORY_FLAG) return "1";
    if (this === localStorage && key === LS_SESSIONS && !persistAcrossReloads) {
      return transientRead();
    }
    return previousGetItem.call(this, key);
  };

  Storage.prototype.setItem = function v16HistorySetItem(key, value) {
    if (this === localStorage && key === LEGACY_HISTORY_FLAG) {
      return previousSetItem.call(this, key, "1");
    }
    if (this === localStorage && key === LS_SESSIONS && !persistAcrossReloads) {
      if (transientWrite(value)) return undefined;
      // If temporary browser storage itself is unavailable, fall back to the existing
      // storage layer so its error reporting can explain the failure to the user.
      return previousSetItem.call(this, key, value);
    }
    return previousSetItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function v16HistoryRemoveItem(key) {
    if (this === localStorage && key === LS_SESSIONS && !persistAcrossReloads) {
      transientClear();
      return undefined;
    }
    if (this === localStorage && key === LEGACY_HISTORY_FLAG) {
      return previousSetItem.call(this, key, "1");
    }
    return previousRemoveItem.call(this, key);
  };

  function applyPreference(enabled) {
    const next = Boolean(enabled);
    if (next === persistAcrossReloads) return;

    if (next) {
      // Promote the live transient session set before switching reads to localStorage.
      const live = transientRead();
      try { rawSet(localStorage, PERSIST_PREF, "1"); } catch {}
      persistAcrossReloads = true;
      if (live != null) {
        try { previousSetItem.call(localStorage, LS_SESSIONS, live); } catch {}
      }
      transientClear();
    } else {
      // Seed the transient mirror with the current durable state so the current page
      // does not visually lose its conversations after the user disables persistence.
      const current = rawGet(localStorage, LS_SESSIONS);
      if (current != null) transientWrite(current);
      try { rawSet(localStorage, PERSIST_PREF, "0"); } catch {}
      persistAcrossReloads = false;
    }

    try { rawSet(localStorage, LEGACY_HISTORY_FLAG, "1"); } catch {}
    syncUi();
  }

  function syncUi() {
    const input = document.getElementById("historyKeep");
    if (!input) return;
    input.disabled = false;
    input.checked = persistAcrossReloads;
    input.setAttribute("aria-label", persistAcrossReloads
      ? "小说对话会在当前浏览器中保留"
      : "小说对话仅在当前页面临时保留");

    const description = input.closest(".settings-section")?.querySelector(".section-heading p");
    if (description) {
      description.textContent = persistAcrossReloads
        ? "已开启：刷新或重开浏览器后仍会恢复小说对话。"
        : "已关闭：当前页面内书架与聊天仍保持一致，刷新后不会恢复这些对话。";
    }
  }

  // Capture the setting before app.js sees it. app.js intentionally remains in its
  // internal "history enabled" mode so every module keeps receiving one synchronized
  // session store; V16 owns only the persistence destination.
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

  setTimeout(syncUi, 0);

  document.documentElement.dataset.historyLifecycleRevision = REVISION;
  window.UnlimitedHistoryLifecycleV16 = {
    revision: REVISION,
    get enabled() { return persistAcrossReloads; },
    get ephemeral() { return transientRead(); },
    setEnabled: applyPreference,
    syncUi,
    clearEphemeral: transientClear
  };
})();