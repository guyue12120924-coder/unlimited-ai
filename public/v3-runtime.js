// public/v3-runtime.js
// V16.5 coordination layer: keep the browser's native MutationObserver untouched and
// provide an explicit frame-batched observer/scheduler for product modules that want it.
(() => {
  const REVISION = "2026-08-21-v16.5-observer-scheduler";
  if (window.__UNLIMITED_V3_RUNTIME__) return;
  window.__UNLIMITED_V3_RUNTIME__ = true;

  const NativeMutationObserver = window.MutationObserver;
  const pendingObservers = new Set();
  const pendingTasks = new Map();
  let animationFrame = 0;
  let safetyTimer = 0;

  const metrics = {
    explicitObserverInstances: 0,
    observeCalls: 0,
    nativeDeliveries: 0,
    coordinatedFlushes: 0,
    coordinatedCallbacks: 0,
    scheduledTasks: 0,
    refreshAllCalls: 0,
    startedAt: Date.now()
  };

  function reportAsyncError(error) {
    queueMicrotask(() => { throw error; });
  }

  function flushCoordinator() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (safetyTimer) clearTimeout(safetyTimer);
    animationFrame = 0;
    safetyTimer = 0;

    if (pendingObservers.size) {
      const current = Array.from(pendingObservers);
      pendingObservers.clear();
      current.forEach((observer) => observer.__flush());
    }

    if (pendingTasks.size) {
      const tasks = Array.from(pendingTasks.values());
      pendingTasks.clear();
      tasks.forEach((task) => {
        try { task(); }
        catch (error) { reportAsyncError(error); }
      });
    }

    metrics.coordinatedFlushes += 1;
  }

  function ensureFlush() {
    if (!animationFrame) animationFrame = requestAnimationFrame(flushCoordinator);
    if (!safetyTimer) safetyTimer = setTimeout(flushCoordinator, 72);
  }

  class ExplicitCoordinatedObserver {
    constructor(callback) {
      if (typeof callback !== "function") throw new TypeError("MutationObserver callback must be a function");
      this.__callback = callback;
      this.__records = [];
      this.__connected = true;
      this.__native = new NativeMutationObserver((records) => {
        metrics.nativeDeliveries += 1;
        if (!this.__connected || !records.length) return;
        this.__records.push(...records);
        pendingObservers.add(this);
        ensureFlush();
      });
      metrics.explicitObserverInstances += 1;
    }

    observe(target, options) {
      this.__connected = true;
      metrics.observeCalls += 1;
      return this.__native.observe(target, options);
    }

    disconnect() {
      this.__connected = false;
      this.__records.length = 0;
      pendingObservers.delete(this);
      return this.__native.disconnect();
    }

    takeRecords() {
      const buffered = this.__records.splice(0);
      return buffered.concat(this.__native.takeRecords());
    }

    __flush() {
      if (!this.__connected || !this.__records.length) return;
      const records = this.__records.splice(0);
      metrics.coordinatedCallbacks += 1;
      try { this.__callback(records, this); }
      catch (error) { reportAsyncError(error); }
    }
  }

  function createObserver(callback) {
    return new ExplicitCoordinatedObserver(callback);
  }

  function schedule(key, task) {
    if (typeof task !== "function") return false;
    const taskKey = String(key || "default");
    pendingTasks.set(taskKey, task);
    metrics.scheduledTasks += 1;
    ensureFlush();
    return true;
  }

  // Compatibility handle for modules that intentionally need the native observer.
  // V16.5 deliberately does NOT assign window.MutationObserver.
  window.__UNLIMITED_NATIVE_MUTATION_OBSERVER__ = NativeMutationObserver;

  function refreshAll() {
    metrics.refreshAllCalls += 1;
    try { window.UnlimitedV2Experience?.refresh?.(); } catch (error) { console.warn("[V3] experience refresh failed", error); }
    try { window.UnlimitedV2Product?.refresh?.(0); } catch (error) { console.warn("[V3] product refresh failed", error); }
    try { window.UnlimitedV2Phase2?.refresh?.(0); } catch (error) { console.warn("[V3] phase2 refresh failed", error); }
  }

  function handleOutlineRefresh(event) {
    if (!event.target.closest?.('.studio-tabs [data-studio-tab="outline"]')) return;
    document.getElementById("studioPanelBody")?.removeAttribute("data-v2-outline-ready");
    schedule("outline-refresh", refreshAll);
  }

  function runtimeDiagnostics() {
    const product = window.UnlimitedProductDiagnostics?.run?.() || null;
    return {
      runtime: "v16.5",
      revision: REVISION,
      globalObserverUntouched: window.MutationObserver === NativeMutationObserver,
      explicitObserverScheduler: true,
      metrics: { ...metrics, uptimeMs: Date.now() - metrics.startedAt },
      product
    };
  }

  function bindPostLoadCoordinator() {
    document.documentElement.dataset.unlimitedRuntime = "v16.5";
    document.documentElement.dataset.observerSchedulerRevision = REVISION;
    document.querySelector(".studio-tabs")?.addEventListener("click", handleOutlineRefresh);

    window.addEventListener("pageshow", () => schedule("pageshow-refresh", refreshAll));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") schedule("visibility-refresh", refreshAll);
    });

    setTimeout(() => schedule("initial-refresh", refreshAll), 120);
  }

  window.UnlimitedV3 = {
    revision: REVISION,
    refresh: refreshAll,
    diagnostics: runtimeDiagnostics,
    metrics,
    createObserver,
    schedule,
    NativeMutationObserver
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindPostLoadCoordinator, { once: true });
  else bindPostLoadCoordinator();
})();
