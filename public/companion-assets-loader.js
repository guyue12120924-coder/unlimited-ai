// public/companion-assets-loader.js
// Compatibility marker: 2026-08-17-v14.7-companion-lazy-progress
// Compatibility marker: 2026-08-20-v16.0-companion-lazy-hardening
// Compatibility marker: 2026-08-21-v17.1-companion-entry-recovery
(() => {
  const REVISION = "2026-08-21-v17.3-companion-atomic-enhancements";
  if (window.UnlimitedCompanionAssets) return;

  const CORE_STYLE = ["/companion-mode.css", "uaiCompanionCss"];
  const CORE_SCRIPT = ["/companion-mode.js", "uaiCompanionScript"];

  const STYLE_ASSETS = [
    ["/companion-characters.css", "uaiCompanionCharactersCss"],
    ["/companion-memory.css", "uaiCompanionMemoryCss"],
    ["/companion-records.css", "uaiCompanionRecordsCss"],
    ["/companion-support.css", "uaiCompanionSupportCss"],
    ["/companion-v10.css", "uaiCompanionV10Css"],
    ["/companion-v10-vibrant.css", "uaiCompanionV10VibrantCss"],
    ["/companion-v10-stage2.css", "uaiCompanionV10Stage2Css"],
    ["/companion-v10-stage3.css", "uaiCompanionV10Stage3Css"],
    ["/companion-v10-stage4.css", "uaiCompanionV10Stage4Css"],
    ["/companion-v10-stage5.css", "uaiCompanionV10Stage5Css"],
    ["/companion-v10-stage6.css", "uaiCompanionV10Stage6Css"],
    ["/companion-v11.css", "uaiCompanionV11Css"],
    ["/companion-v11-stage1.css", "uaiCompanionV11Stage1Css"],
    ["/companion-v11-stage2.css", "uaiCompanionV11Stage2Css"],
    ["/companion-v11-stage3.css", "uaiCompanionV11Stage3Css"],
    ["/companion-v11-stage4.css", "uaiCompanionV11Stage4Css"],
    ["/companion-v12-galaxy.css", "uaiCompanionV12GalaxyCss"],
    ["/companion-v12-stage2.css", "uaiCompanionV12Stage2Css"],
    ["/companion-v12-final.css", "uaiCompanionV12FinalCss"],
    ["/companion-v12-polish.css", "uaiCompanionV12PolishCss"],
    ["/companion-v12-phase1.css", "uaiCompanionV12Phase1Css"],
    ["/companion-live2d.css", "uaiCompanionLive2dCss"],
    ["/companion-live2d-voice.css", "uaiCompanionLive2dVoiceCss"],
    ["/companion-live2d-neural-voice.css", "uaiCompanionLive2dNeuralVoiceCss"],
    ["/companion-voice-input.css", "uaiCompanionVoiceInputCss"],
    ["/companion-call-mode.css", "uaiCompanionCallModeCss"],
    ["/companion-live2d-model-pool.css", "uaiCompanionLive2dModelPoolCss"],
    ["/companion-live2d-polish.css", "uaiCompanionLive2DPolishCss"],
    ["/companion-live2d-emotion-engine.css", "uaiCompanionLive2dEmotionEngineCss"],
    ["/companion-v12-ux-hardening.css", "uaiCompanionV123UxHardeningCss"]
  ];

  const SCRIPT_ASSETS = [
    ["/companion-characters-core.js", "uaiCompanionCharactersCoreScript"],
    ["/companion-character-editor.js", "uaiCompanionCharacterEditorScript"],
    ["/companion-memory.js", "uaiCompanionMemoryScript"],
    ["/companion-records.js", "uaiCompanionRecordsScript"],
    ["/companion-settings.js", "uaiCompanionSettingsScript"],
    ["/companion-runtime.js", "uaiCompanionRuntimeScript"],
    ["/companion-extras.js", "uaiCompanionExtrasScript"],
    ["/companion-v10-shell.js", "uaiCompanionV10ShellScript"],
    ["/companion-v10-stage2.js", "uaiCompanionV10Stage2Script"],
    ["/companion-v10-stage4.js", "uaiCompanionV10Stage4Script"],
    ["/companion-v10-stage5.js", "uaiCompanionV10Stage5Script"],
    ["/companion-v11.js", "uaiCompanionV11Script"],
    ["/companion-v11-stage1.js", "uaiCompanionV11Stage1Script"],
    ["/companion-v11-stage2.js", "uaiCompanionV11Stage2Script"],
    ["/companion-v11-stage3.js", "uaiCompanionV11Stage3Script"],
    ["/companion-v11-stage4.js", "uaiCompanionV11Stage4Script"],
    ["/companion-v12-galaxy.js", "uaiCompanionV12GalaxyScript"],
    ["/companion-v12-stage2.js", "uaiCompanionV12Stage2Script"],
    ["/companion-v12-final.js", "uaiCompanionV12FinalScript"],
    ["/companion-v12-polish.js", "uaiCompanionV12PolishScript"],
    ["/companion-v12-phase1.js", "uaiCompanionV124Phase1Script"],
    ["/companion-live2d.js", "uaiCompanionLive2dScript"],
    ["/companion-live2d-voice.js", "uaiCompanionLive2dVoiceScript"],
    ["/companion-live2d-neural-voice.js", "uaiCompanionNeuralVoiceScript"],
    ["/companion-voice-input.js", "uaiCompanionVoiceInputScript"],
    ["/companion-call-mode.js", "uaiCompanionCallModeScript"],
    ["/companion-live2d-model-pool.js", "uaiCompanionLive2dModelPoolScript"],
    ["/companion-live2d-polish.js", "uaiCompanionLive2DPolishScript"],
    ["/companion-live2d-emotion-engine.js", "uaiCompanionLive2dEmotionEngineScript"],
    ["/companion-v12-ux-hardening.js", "uaiCompanionV123UxHardeningScript"]
  ];

  const TOTAL_ASSETS = 2 + STYLE_ASSETS.length + SCRIPT_ASSETS.length;
  const state = {
    loadPromise: null,
    ready: false,
    coreReady: false,
    enhancementsReady: false,
    lastError: null,
    loadedStyles: 0,
    loadedScripts: 0
  };

  function versioned(path) {
    const join = path.includes("?") ? "&" : "?";
    return `${path}${join}v=${encodeURIComponent(REVISION)}`;
  }

  function updateBootState(extra = {}) {
    if (!window.__UNLIMITED_BOOT__) return;
    Object.assign(window.__UNLIMITED_BOOT__, {
      companionAssetsRevision: REVISION,
      companionAssetsReady: state.ready,
      companionCoreReady: state.coreReady,
      companionEnhancementsReady: state.enhancementsReady,
      companionAssetsLoading: Boolean(state.loadPromise && !state.ready),
      companionAssetsLoadedStyles: state.loadedStyles,
      companionAssetsLoadedScripts: state.loadedScripts,
      ...extra
    });
  }

  function progressDetail(extra = {}) {
    const loaded = state.loadedStyles + state.loadedScripts;
    return {
      revision: REVISION,
      loaded,
      total: TOTAL_ASSETS,
      percent: TOTAL_ASSETS ? Math.round((loaded / TOTAL_ASSETS) * 100) : 100,
      ready: state.ready,
      coreReady: state.coreReady,
      enhancementsReady: state.enhancementsReady,
      loading: Boolean(state.loadPromise && !state.ready),
      ...extra
    };
  }

  function emitProgress(extra = {}) {
    const detail = progressDetail(extra);
    updateBootState({
      companionAssetsLoaded: detail.loaded,
      companionAssetsTotal: detail.total,
      companionAssetsProgress: detail.percent,
      companionAssetsLoading: detail.loading
    });
    window.dispatchEvent(new CustomEvent("uai:companion-assets-progress", { detail }));
  }

  function countStyle(path, link) {
    if (link.dataset.uaiCountedRevision === REVISION) return;
    link.dataset.uaiCountedRevision = REVISION;
    state.loadedStyles += 1;
    emitProgress({ asset: path, type: "style", phase: "asset" });
  }

  function countScript(path, script) {
    if (script.dataset.uaiCountedRevision === REVISION) return;
    script.dataset.uaiCountedRevision = REVISION;
    state.loadedScripts += 1;
    emitProgress({ asset: path, type: "script", phase: "asset" });
  }

  function loadStyle(path, id, { inactive = false } = {}) {
    return new Promise((resolve, reject) => {
      let link = document.getElementById(id);
      if (link && (link.dataset.uaiDeferredPlaceholder === "true" || link.tagName !== "LINK")) {
        link.remove();
        link = null;
      }

      if (link?.dataset.uaiLoaded === "false") {
        link.remove();
        link = null;
      }

      if (!link) {
        link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = versioned(path);
        link.dataset.uaiCompanionLazy = "true";
        if (inactive) {
          link.media = "not all";
          link.dataset.uaiDeferredActivation = "true";
        }
        document.head.appendChild(link);
      } else if (inactive && link.dataset.uaiDeferredActivation === "true") {
        link.media = "not all";
      }

      if (link.dataset.uaiLoaded === "true" || link.sheet) {
        link.dataset.uaiLoaded = "true";
        countStyle(path, link);
        resolve(link);
        return;
      }

      let settled = false;
      let timer = 0;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        if (timer) window.clearTimeout(timer);
        link.removeEventListener("load", onLoad);
        link.removeEventListener("error", onError);
        if (error) {
          link.dataset.uaiLoaded = "false";
          if (link.dataset.uaiCompanionLazy === "true") link.remove();
          reject(error);
          return;
        }
        link.dataset.uaiLoaded = "true";
        countStyle(path, link);
        resolve(link);
      };
      const onLoad = () => finish();
      const onError = () => finish(new Error(`Failed to load ${path}`));
      link.addEventListener("load", onLoad, { once: true });
      link.addEventListener("error", onError, { once: true });
      timer = window.setTimeout(() => finish(new Error(`Timed out loading ${path}`)), 20000);
      if (link.sheet) finish();
    });
  }

  function scriptApiReady(id) {
    if (id === "uaiCompanionScript") return Boolean(window.UnlimitedCompanion?.mount);
    return false;
  }

  function loadScript(path, id) {
    return new Promise((resolve, reject) => {
      let script = document.getElementById(id);
      if (scriptApiReady(id)) {
        if (!script) {
          script = document.createElement("script");
          script.id = id;
          script.dataset.uaiLoaded = "true";
          script.dataset.uaiCompanionExistingCore = "true";
        }
        countScript(path, script);
        resolve(script);
        return;
      }
      if (script?.dataset.uaiLoaded === "true") {
        countScript(path, script);
        resolve(script);
        return;
      }
      if (script?.dataset.uaiLoaded === "false") {
        script.remove();
        script = null;
      }

      if (!script) {
        script = document.createElement("script");
        script.id = id;
        script.async = false;
        script.src = versioned(path);
        script.dataset.uaiCompanionLazy = "true";
        document.body.appendChild(script);
      }

      let settled = false;
      let timer = 0;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        if (timer) window.clearTimeout(timer);
        script.removeEventListener("load", onLoad);
        script.removeEventListener("error", onError);
        if (error) {
          script.dataset.uaiLoaded = "false";
          if (script.dataset.uaiCompanionLazy === "true") script.remove();
          reject(error);
          return;
        }
        script.dataset.uaiLoaded = "true";
        countScript(path, script);
        resolve(script);
      };
      const onLoad = () => finish();
      const onError = () => finish(new Error(`Failed to load ${path}`));
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      timer = window.setTimeout(() => finish(new Error(`Timed out loading ${path}`)), 20000);
      if (scriptApiReady(id)) finish();
    });
  }

  async function ensureCore() {
    await Promise.all([
      loadStyle(CORE_STYLE[0], CORE_STYLE[1]),
      loadScript(CORE_SCRIPT[0], CORE_SCRIPT[1])
    ]);
    if (!window.UnlimitedCompanion?.mount) throw new Error("Companion core loaded without mount()");
    state.coreReady = true;
    updateBootState({ companionCoreReady: true });
    emitProgress({ phase: "core-ready", coreReady: true, loading: true });
  }

  function deactivateEnhancementStyles() {
    STYLE_ASSETS.forEach(([, id]) => {
      const link = document.getElementById(id);
      if (!link || link.tagName !== "LINK") return;
      link.media = "not all";
      link.dataset.uaiDeferredActivation = "true";
    });
    document.documentElement.dataset.companionEnhancementStyles = "deferred";
  }

  function activateEnhancementStyles() {
    STYLE_ASSETS.forEach(([, id]) => {
      const link = document.getElementById(id);
      if (!link || link.tagName !== "LINK" || link.dataset.uaiLoaded !== "true") return;
      link.media = "all";
      delete link.dataset.uaiDeferredActivation;
    });
    document.documentElement.dataset.companionEnhancementStyles = "active";
  }

  async function loadEnhancementsAtomically() {
    deactivateEnhancementStyles();

    // Download every optional stylesheet without applying it. This prevents a theme CSS file
    // from changing the base grid before its matching JavaScript has inserted the required DOM.
    const stylePromise = Promise.all(STYLE_ASSETS.map(([path, id]) => loadStyle(path, id, { inactive: true })));

    // Execute enhancement JavaScript in dependency order. The core chat stays interactive while
    // this happens. If any script fails, no optional stylesheet is activated.
    for (const [path, id] of SCRIPT_ASSETS) {
      await loadScript(path, id);
    }

    await stylePromise;
    activateEnhancementStyles();

    state.enhancementsReady = true;
    document.documentElement.dataset.companionEnhancementsRevision = REVISION;
    window.dispatchEvent(new CustomEvent("uai:companion-enhancements-ready", { detail: { revision: REVISION } }));
  }

  async function performLoad() {
    state.lastError = null;
    state.ready = false;
    state.enhancementsReady = false;
    state.loadedStyles = 0;
    state.loadedScripts = 0;
    document.documentElement.dataset.companionAssetsRevision = REVISION;
    updateBootState({ companionAssetsDeferred: false, companionAssetsLoading: true, companionEnhancementsReady: false });
    emitProgress({ phase: "start", loading: true });

    await ensureCore();
    await loadEnhancementsAtomically();

    state.ready = true;
    updateBootState({ companionAssetsDeferred: false, companionAssetsReady: true, companionAssetsError: "", companionEnhancementsReady: true });
    emitProgress({ phase: "ready", ready: true, loading: false, coreReady: true, enhancementsReady: true });
    return true;
  }

  function load() {
    if (state.ready) return Promise.resolve(true);
    if (state.loadPromise) return state.loadPromise;

    state.loadPromise = performLoad()
      .catch((error) => {
        state.lastError = error;
        state.ready = false;
        state.enhancementsReady = false;
        deactivateEnhancementStyles();
        const message = error?.message || String(error);
        updateBootState({ companionAssetsReady: false, companionEnhancementsReady: false, companionAssetsError: message, companionAssetsLoading: false });
        emitProgress({ phase: "error", error: message, loading: false, coreReady: state.coreReady, enhancementsReady: false });
        throw error;
      })
      .finally(() => {
        state.loadPromise = null;
        updateBootState({ companionAssetsLoading: false });
      });

    updateBootState({ companionAssetsDeferred: false, companionAssetsLoading: true });
    return state.loadPromise;
  }

  window.UnlimitedCompanionAssets = {
    revision: REVISION,
    load,
    ensureCore,
    total: TOTAL_ASSETS,
    get ready() { return state.ready; },
    get coreReady() { return state.coreReady; },
    get enhancementsReady() { return state.enhancementsReady; },
    get loading() { return Boolean(state.loadPromise); },
    get lastError() { return state.lastError; },
    get loaded() { return state.loadedStyles + state.loadedScripts; },
    get progress() { return progressDetail().percent; },
    styles: [CORE_STYLE[0], ...STYLE_ASSETS.map(([path]) => path)],
    scripts: [CORE_SCRIPT[0], ...SCRIPT_ASSETS.map(([path]) => path)]
  };

  updateBootState({
    companionAssetsDeferred: true,
    companionAssetsLoaded: 0,
    companionAssetsTotal: TOTAL_ASSETS,
    companionAssetsProgress: 0,
    companionCoreReady: Boolean(window.UnlimitedCompanion?.mount),
    companionEnhancementsReady: false
  });
})();