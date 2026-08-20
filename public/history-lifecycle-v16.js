// public/history-lifecycle-v16.js
// V16.1: keep novel session state shared across legacy modules without persisting it
// when the user has disabled local conversation history.
(() => {
  const REVISION = "2026-08-20-v16.1-history-lifecycle";
  if (window.UnlimitedHistoryLifecycleV16) return;

  const LS_HISTORY_ENABLED = "cfw_history_enabled";
  const LS_SESSIONS = "cfw_sessions_v2";
  const EPHEMERAL_SESSIONS = "uai_v16_ephemeral_novel_sessions";

  const previousGetItem = Storage.prototype.getItem;
  const previousSetItem = Storage.prototype.setItem;
  const previousRemoveItem = Storage.prototype.removeItem;

  function historyEnabled() {
    try { return (previousGetItem.call(localStorage, LS_HISTORY_ENABLED) ?? "0") === "1"; }
    catch { return false; }
  }

  function transientRead() {
    try { return previousGetItem.call(sessionStorage, EPHEMERAL_SESSIONS); }
    catch { return null; }
  }

  function transientWrite(value) {
    try {
      previousSetItem.call(sessionStorage, EPHEMERAL_SESSIONS, String(value ?? "[]"));
      return true;
    } catch {
      return false;
    }
  }

  function transientClear() {
    try { previousRemoveItem.call(sessionStorage, EPHEMERAL_SESSIONS); } catch {}
  }

  // A fresh page load with history disabled must start fresh. sessionStorage is only
  // used as a same-page compatibility bus between app.js and the studio modules.
  if (!historyEnabled()) transientClear();

  Storage.prototype.getItem = function v16HistoryGetItem(key) {
    if (this === localStorage && key === LS_SESSIONS && !historyEnabled()) {
      return transientRead();
    }
    return previousGetItem.call(this, key);
  };

  Storage.prototype.setItem = function v16HistorySetItem(key, value) {
    if (this === localStorage && key === LS_SESSIONS && !historyEnabled()) {
      if (!transientWrite(value)) {
        // Let the existing storage error layer surface the failure if even temporary
        // browser storage is unavailable.
        return previousSetItem.call(this, key, value);
      }
      return undefined;
    }
    return previousSetItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function v16HistoryRemoveItem(key) {
    if (this === localStorage && key === LS_SESSIONS && !historyEnabled()) {
      transientClear();
      return undefined;
    }
    return previousRemoveItem.call(this, key);
  };

  let pendingDisableSnapshot = null;

  document.addEventListener("change", (event) => {
    const toggle = event.target;
    if (toggle?.id !== "historyKeep") return;

    if (!toggle.checked) {
      // Capture the current persistent state before app.js flips cfw_history_enabled.
      try { pendingDisableSnapshot = previousGetItem.call(localStorage, LS_SESSIONS); }
      catch { pendingDisableSnapshot = null; }

      setTimeout(() => {
        if (historyEnabled()) return;
        if (pendingDisableSnapshot) transientWrite(pendingDisableSnapshot);
        pendingDisableSnapshot = null;
        // The user explicitly disabled persistence, so remove the durable copy while
        // keeping the current in-memory/session-compatible state available this page.
        try { previousRemoveItem.call(localStorage, LS_SESSIONS); } catch {}
      }, 0);
      return;
    }

    // app.js persists the active in-memory session after setting the preference to 1.
    // Clear the temporary mirror after that write has had a chance to complete.
    setTimeout(() => {
      if (historyEnabled()) transientClear();
    }, 0);
  }, true);

  document.documentElement.dataset.historyLifecycleRevision = REVISION;
  window.UnlimitedHistoryLifecycleV16 = {
    revision: REVISION,
    get enabled() { return historyEnabled(); },
    get ephemeral() { return transientRead(); },
    clearEphemeral: transientClear
  };
})();