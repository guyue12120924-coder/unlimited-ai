// public/v3-runtime.js
// V3 coordination layer. It is intentionally loaded before the V2 product adapters
// so their MutationObserver callbacks are frame-batched instead of firing independently.
(() => {
  if (window.__UNLIMITED_V3_RUNTIME__) return;
  window.__UNLIMITED_V3_RUNTIME__ = true;

  const NativeMutationObserver = window.MutationObserver;
  const pendingObservers = new Set();
  let animationFrame = 0;
  let safetyTimer = 0;

  const metrics = {
    observerInstances: 0,
    observeCalls: 0,
    nativeDeliveries: 0,
    coordinatedFlushes: 0,
    coordinatedCallbacks: 0,
    refreshAllCalls: 0,
    startedAt: Date.now()
  };

  function reportAsyncError(error) {
    queueMicrotask(() => { throw error; });
  }

  function flushObservers() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (safetyTimer) clearTimeout(safetyTimer);
    animationFrame = 0;
    safetyTimer = 0;
    if (!pendingObservers.size) return;

    metrics.coordinatedFlushes += 1;
    const current = Array.from(pendingObservers);
    pendingObservers.clear();
    current.forEach((observer) => observer.__flush());
  }

  function scheduleObserverFlush() {
    if (!animationFrame) animationFrame = requestAnimationFrame(flushObservers);
    if (!safetyTimer) safetyTimer = setTimeout(flushObservers, 72);
  }

  class CoordinatedMutationObserver {
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
        scheduleObserverFlush();
      });
      metrics.observerInstances += 1;
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
      try {
        this.__callback(records, this);
      } catch (error) {
        reportAsyncError(error);
      }
    }
  }

  // Only product adapters loaded after this file use the coordinated observer.
  // Core storage/editor modules loaded earlier keep their original native behavior.
  window.MutationObserver = CoordinatedMutationObserver;
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
    setTimeout(refreshAll, 12);
  }

  function runtimeDiagnostics() {
    const product = window.UnlimitedProductDiagnostics?.run?.() || null;
    return {
      runtime: "v3.0",
      coordinatedObserver: window.MutationObserver === CoordinatedMutationObserver,
      metrics: { ...metrics, uptimeMs: Date.now() - metrics.startedAt },
      product
    };
  }

  function bindPostLoadCoordinator() {
    document.documentElement.dataset.unlimitedRuntime = "v3";
    document.querySelector(".studio-tabs")?.addEventListener("click", handleOutlineRefresh);

    window.addEventListener("pageshow", () => setTimeout(refreshAll, 30));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") setTimeout(refreshAll, 40);
    });

    setTimeout(refreshAll, 120);
  }

  window.UnlimitedV3 = {
    refresh: refreshAll,
    diagnostics: runtimeDiagnostics,
    metrics
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindPostLoadCoordinator, { once: true });
  else bindPostLoadCoordinator();
})();
