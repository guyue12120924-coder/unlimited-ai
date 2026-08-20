// public/storage-core-v163.js
// V16.3 runtime core: one Storage gateway for session persistence routing,
// schema normalization and visible write failures. Older migration/history modules
// may keep their UI/migration logic, but direct prototype re-wrapping is blocked.
(() => {
  const REVISION = "2026-08-20-v16.3-storage-core";
  if (window.UnlimitedStorageV163) return;

  const LS_SESSIONS = "cfw_sessions_v2";
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LEGACY_HISTORY_FLAG = "cfw_history_enabled";
  const PERSIST_PREF = "cfw_history_persist_v16";
  const EPHEMERAL_SESSIONS = "uai_v16_ephemeral_novel_sessions";

  const nativeGetItem = Storage.prototype.getItem;
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  let lastStorageErrorAt = 0;

  function nativeGet(storage, key) {
    try { return nativeGetItem.call(storage, key); }
    catch { return null; }
  }

  function reportStorageError(error, key, storage = localStorage) {
    const now = Date.now();
    const detail = {
      key: String(key || ""),
      storage: storage === sessionStorage ? "sessionStorage" : "localStorage",
      name: error?.name || "StorageError",
      message: error?.message || String(error || "Browser storage write failed"),
      at: now,
      revision: REVISION
    };
    window.__UNLIMITED_STORAGE_ERROR__ = detail;
    if (now - lastStorageErrorAt < 800) return;
    lastStorageErrorAt = now;
    try { window.dispatchEvent(new CustomEvent("uai:storage-error", { detail })); } catch {}
  }

  function nativeSet(storage, key, value) {
    try {
      return nativeSetItem.call(storage, key, String(value));
    } catch (error) {
      reportStorageError(error, key, storage);
      throw error;
    }
  }

  function nativeRemove(storage, key) {
    try { return nativeRemoveItem.call(storage, key); }
    catch (error) {
      reportStorageError(error, key, storage);
      throw error;
    }
  }

  function initialPersistencePreference() {
    const explicit = nativeGet(localStorage, PERSIST_PREF);
    if (explicit === "0" || explicit === "1") return explicit === "1";
    return (nativeGet(localStorage, LEGACY_HISTORY_FLAG) ?? "0") === "1";
  }

  let persistAcrossReloads = initialPersistencePreference();

  function currentSessionRaw() {
    return persistAcrossReloads
      ? nativeGet(localStorage, LS_SESSIONS)
      : nativeGet(sessionStorage, EPHEMERAL_SESSIONS);
  }

  function parseJson(value, fallback) {
    try { return JSON.parse(value); }
    catch { return fallback; }
  }

  function normalizeValue(key, value) {
    const source = String(value);
    const dataApi = window.UnlimitedData;
    if (!dataApi) return source;

    if (key === LS_SESSIONS && typeof dataApi.normalizeSessions === "function") {
      const parsed = parseJson(source, null);
      if (Array.isArray(parsed)) {
        try { return JSON.stringify(dataApi.normalizeSessions(parsed).value); }
        catch { return source; }
      }
    }

    if (key === LS_STUDIO && typeof dataApi.normalizeWorkspace === "function") {
      const parsed = parseJson(source, null);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const sessions = parseJson(currentSessionRaw() || "[]", []);
        try {
          return JSON.stringify(dataApi.normalizeWorkspace(parsed, Array.isArray(sessions) ? sessions : []).value);
        } catch {
          return source;
        }
      }
    }

    return source;
  }

  function setPersistencePreference(nextValue) {
    const next = String(nextValue) === "1";
    if (next === persistAcrossReloads) {
      nativeSet(localStorage, PERSIST_PREF, next ? "1" : "0");
      return;
    }

    if (next) {
      const ephemeral = nativeGet(sessionStorage, EPHEMERAL_SESSIONS);
      nativeSet(localStorage, PERSIST_PREF, "1");
      persistAcrossReloads = true;
      if (ephemeral != null) nativeSet(localStorage, LS_SESSIONS, normalizeValue(LS_SESSIONS, ephemeral));
      try { nativeRemoveItem.call(sessionStorage, EPHEMERAL_SESSIONS); } catch {}
    } else {
      const durable = nativeGet(localStorage, LS_SESSIONS);
      if (durable != null) nativeSet(sessionStorage, EPHEMERAL_SESSIONS, normalizeValue(LS_SESSIONS, durable));
      nativeSet(localStorage, PERSIST_PREF, "0");
      persistAcrossReloads = false;
    }
  }

  function unifiedGetItem(key) {
    if (this === localStorage && key === LEGACY_HISTORY_FLAG) return "1";
    if (this === localStorage && key === LS_SESSIONS && !persistAcrossReloads) {
      return nativeGet(sessionStorage, EPHEMERAL_SESSIONS);
    }
    return nativeGetItem.call(this, key);
  }

  function unifiedSetItem(key, value) {
    if (this !== localStorage) return nativeSet(this, key, value);

    if (key === LEGACY_HISTORY_FLAG) {
      return nativeSet(localStorage, LEGACY_HISTORY_FLAG, "1");
    }

    if (key === PERSIST_PREF) {
      setPersistencePreference(value);
      return undefined;
    }

    const normalized = normalizeValue(key, value);
    if (key === LS_SESSIONS && !persistAcrossReloads) {
      nativeSet(sessionStorage, EPHEMERAL_SESSIONS, normalized);
      return undefined;
    }

    return nativeSet(localStorage, key, normalized);
  }

  function unifiedRemoveItem(key) {
    if (this !== localStorage) return nativeRemove(this, key);

    if (key === LEGACY_HISTORY_FLAG) {
      // app.js uses this flag only as an internal "keep one live session source" switch.
      return nativeSet(localStorage, LEGACY_HISTORY_FLAG, "1");
    }

    if (key === LS_SESSIONS && !persistAcrossReloads) {
      try { nativeRemoveItem.call(sessionStorage, EPHEMERAL_SESSIONS); } catch {}
      return undefined;
    }

    if (key === PERSIST_PREF) persistAcrossReloads = false;
    return nativeRemove(localStorage, key);
  }

  // One controlled gateway. Existing V16 migration/history scripts run in classic
  // non-strict mode, so their old direct assignments become harmless no-ops while
  // their migration and UI functions continue to work through these methods.
  Object.defineProperties(Storage.prototype, {
    getItem: {
      value: unifiedGetItem,
      writable: false,
      enumerable: false,
      configurable: true
    },
    setItem: {
      value: unifiedSetItem,
      writable: false,
      enumerable: false,
      configurable: true
    },
    removeItem: {
      value: unifiedRemoveItem,
      writable: false,
      enumerable: false,
      configurable: true
    }
  });

  // Match the V16.1 contract: legacy app.js always maintains one live session source;
  // this gateway decides whether that source is durable or page-ephemeral.
  try { nativeSet(localStorage, LEGACY_HISTORY_FLAG, "1"); } catch {}
  if (!persistAcrossReloads) {
    try { nativeRemoveItem.call(sessionStorage, EPHEMERAL_SESSIONS); } catch {}
  }

  document.documentElement.dataset.storageCoreRevision = REVISION;
  window.UnlimitedStorageV163 = {
    revision: REVISION,
    get persistent() { return persistAcrossReloads; },
    get sessionsRaw() { return currentSessionRaw(); },
    normalizeValue,
    setPersistence: (enabled) => setPersistencePreference(enabled ? "1" : "0"),
    native: {
      getItem: nativeGetItem,
      setItem: nativeSetItem,
      removeItem: nativeRemoveItem
    }
  };
})();