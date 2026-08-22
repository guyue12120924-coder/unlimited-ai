// V17.7 safe companion function pack: restores non-structural features only.
(() => {
  const REVISION = "2026-08-22-v17.7-safe-function-restore";
  if (window.UnlimitedCompanionFunctionPackV177) return;

  const STYLE_ASSETS = [
    ["/companion-support.css", "uaiCompanionSupportSafeV177Css"],
    ["/companion-functional-v177.css", "uaiCompanionFunctionalV177Css"]
  ];
  const SCRIPT_ASSETS = [
    ["/companion-characters-core.js", "uaiCompanionCharactersCoreSafeV177Script"],
    ["/companion-character-editor.js", "uaiCompanionCharacterEditorSafeV177Script"],
    ["/companion-memory.js", "uaiCompanionMemorySafeV177Script"],
    ["/companion-records.js", "uaiCompanionRecordsSafeV177Script"],
    ["/companion-extras.js", "uaiCompanionExtrasSafeV177Script"]
  ];

  let loadPromise = null;
  let idleHandle = 0;
  let lastError = null;

  function loadStyle(src, id) {
    return new Promise((resolve, reject) => {
      let link = document.getElementById(id);
      if (link?.sheet) return resolve(link);
      if (!link) {
        link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = `${src}?v=${encodeURIComponent(REVISION)}`;
        document.head.appendChild(link);
      }
      const timer = setTimeout(() => reject(new Error(`Timed out loading ${src}`)), 8000);
      link.addEventListener("load", () => { clearTimeout(timer); resolve(link); }, { once: true });
      link.addEventListener("error", () => { clearTimeout(timer); link.remove(); reject(new Error(`Failed to load ${src}`)); }, { once: true });
      if (link.sheet) { clearTimeout(timer); resolve(link); }
    });
  }

  function loadScript(src, id) {
    return new Promise((resolve, reject) => {
      let script = document.getElementById(id);
      if (script?.dataset.uaiLoaded === "true") return resolve(script);
      if (script?.dataset.uaiLoaded === "false") { script.remove(); script = null; }
      if (!script) {
        script = document.createElement("script");
        script.id = id;
        script.async = false;
        script.src = `${src}?v=${encodeURIComponent(REVISION)}`;
        document.body.appendChild(script);
      }
      const timer = setTimeout(() => {
        script.dataset.uaiLoaded = "false";
        script.remove();
        reject(new Error(`Timed out loading ${src}`));
      }, 10000);
      script.addEventListener("load", () => {
        clearTimeout(timer);
        script.dataset.uaiLoaded = "true";
        resolve(script);
      }, { once: true });
      script.addEventListener("error", () => {
        clearTimeout(timer);
        script.dataset.uaiLoaded = "false";
        script.remove();
        reject(new Error(`Failed to load ${src}`));
      }, { once: true });
    });
  }

  function refreshFeatures() {
    if (document.body.dataset.uaiMode !== "companion") return;
    window.UnlimitedCompanionMulti?.refresh?.();
    window.UnlimitedCompanionCharacterControls?.refresh?.();
    window.UnlimitedCompanionMemorySearch?.refresh?.();
    window.UnlimitedCompanionProfileRestore?.refresh?.();
    window.UnlimitedCompanionExtras?.refresh?.();
  }

  async function load() {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      lastError = null;
      try {
        await Promise.all(STYLE_ASSETS.map(([src, id]) => loadStyle(src, id)));
        for (const [src, id] of SCRIPT_ASSETS) await loadScript(src, id);
        document.documentElement.dataset.companionFunctionPack = "ready";
        if (document.body.dataset.uaiMode === "companion") requestAnimationFrame(refreshFeatures);
        return true;
      } catch (error) {
        lastError = error;
        document.documentElement.dataset.companionFunctionPack = "degraded";
        console.warn("[Unlimited AI] V17.7 optional companion functions degraded; core chat remains available", error);
        return false;
      } finally {
        loadPromise = null;
      }
    })();
    return loadPromise;
  }

  function scheduleLoad() {
    if (idleHandle || document.documentElement.dataset.companionFunctionPack === "ready") return;
    const run = () => {
      idleHandle = 0;
      if (document.body.dataset.uaiMode === "companion") load();
    };
    if ("requestIdleCallback" in window) idleHandle = window.requestIdleCallback(run, { timeout: 1200 });
    else idleHandle = window.setTimeout(run, 320);
  }

  window.addEventListener("uai:companion-core-entered", scheduleLoad);
  window.addEventListener("uai:mode-refresh", () => {
    if (document.body.dataset.uaiMode === "companion") {
      if (document.documentElement.dataset.companionFunctionPack === "ready") requestAnimationFrame(refreshFeatures);
      else scheduleLoad();
    }
  });

  window.UnlimitedCompanionFunctionPackV177 = {
    revision: REVISION,
    load,
    refresh: refreshFeatures,
    get loading() { return Boolean(loadPromise); },
    get lastError() { return lastError; }
  };
})();
