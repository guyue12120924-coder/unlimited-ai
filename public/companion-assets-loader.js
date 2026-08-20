// public/companion-assets-loader.js
// Compatibility marker: 2026-08-17-v14.7-companion-lazy-progress
(() => {
  const REVISION = "2026-08-20-v16.0-companion-lazy-hardening";
  if (window.UnlimitedCompanionAssets) return;

  const STYLE_ASSETS = [
    ["/companion-mode.css", "uaiCompanionCss"],
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
    ["/companion-live2d-polish.css", "uaiCompanionLive2dPolishCss"],
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

  const TOTAL_ASSETS = STYLE_ASSETS.length + SCRIPT_ASSETS.length;
  const state = {
    loadPromise: null,
    ready: false,
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

  function markStyleLoaded(path, link) {
    link.dataset.uaiLoaded = "true";
    state.loadedStyles += 1;
    emitProgress({ asset: path, type: "style", phase: "asset" });
  }

  function loadStyle(path, id) {
    return new Promise((resolve, reject) => {
      let link = document.getElementById(id);

      if (link && (link.dataset.uaiDeferredPlaceholder === "true" || link.tagName !== "LINK")) {
        link.remove();
        link = null;
      }

      if (link?.dataset.uaiLoaded === "true" || link?.sheet) {
        markStyleLoaded(path, link);
        resolve();
        return;
      }

      if (link?.dataset.uaiLoaded === "false") {
        link.remove();
        link = null;
      }

      const isNew = !link;
      if (!link) {
        link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = versioned(path);
        link.dataset.uaiCompanionLazy = "true";
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
        markStyleLoaded(path, link);
        resolve();
      };
      const onLoad = () => finish();
      const onError = () => finish(new Error(`Failed to load ${path}`));

      link.addEventListener("load", onLoad, { once: true });
      link.addEventListener("error", onError, { once: true });
      timer = window.setTimeout(() => finish(new Error(`Timed out loading ${path}`)), 20000);
      if (isNew) document.head.appendChild(link);
      else if (link.sheet) finish();
    });
  }

  function markScriptLoaded(path, script) {
    script.dataset.uaiLoaded = "true";
    state.loadedScripts += 1;
    emitProgress({ asset: path, type: "script", phase: "asset" });
  }

  function loadScript(path, id) {
    return new Promise((resolve, reject) => {
      let script = document.getElementById(id);
      if (script?.dataset.uaiLoaded === "true") {
        markScriptLoaded(path, script);
        resolve();
        return;
      }

      if (script?.dataset.uaiLoaded === "false") {
        script.remove();
        script = null;
      }

      const isNew = !script;
      if (!script) {
        script = document.createElement("script");
        script.id = id;
        script.async = false;
        script.src = versioned(path);
        script.dataset.uaiCompanionLazy = "true";
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
        markScriptLoaded(path, script);
        resolve();
      };
      const onLoad = () => finish();
      const onError = () => finish(new Error(`Failed to load ${path}`));

      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      timer = window.setTimeout(() => finish(new Error(`Timed out loading ${path}`)), 20000);
      if (isNew) document.body.appendChild(script);
    });
  }

  async function performLoad() {
    state.lastError = null;
    state.ready = false;
    state.loadedStyles = 0;
    state.loadedScripts = 0;
    document.documentElement.dataset.companionAssetsRevision = REVISION;
    updateBootState({ companionAssetsDeferred: false, companionAssetsLoading: true });
    emitProgress({ phase: "start", loading: true });

    // Styles download in parallel. Scripts are inserted in the original dependency order
    // with async=false, so browsers may fetch them in parallel while preserving execution order.
    await Promise.all([
      Promise.all(STYLE_ASSETS.map(([path, id]) => loadStyle(path, id))),
      Promise.all(SCRIPT_ASSETS.map(([path, id]) => loadScript(path, id)))
    ]);

    state.ready = true;
    updateBootState({ companionAssetsDeferred: false, companionAssetsReady: true, companionAssetsError: "" });
    emitProgress({ phase: "ready", ready: true, loading: false });
    return true;
  }

  function load() {
    if (state.ready) return Promise.resolve(true);
    if (state.loadPromise) return state.loadPromise;

    state.loadPromise = performLoad()
      .catch((error) => {
        state.lastError = error;
        state.ready = false;
        const message = error?.message || String(error);
        updateBootState({ companionAssetsReady: false, companionAssetsError: message, companionAssetsLoading: false });
        emitProgress({ phase: "error", error: message, loading: false });
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
    total: TOTAL_ASSETS,
    get ready() { return state.ready; },
    get loading() { return Boolean(state.loadPromise); },
    get lastError() { return state.lastError; },
    get loaded() { return state.loadedStyles + state.loadedScripts; },
    get progress() { return progressDetail().percent; },
    styles: STYLE_ASSETS.map(([path]) => path),
    scripts: SCRIPT_ASSETS.map(([path]) => path)
  };

  updateBootState({
    companionAssetsDeferred: true,
    companionAssetsLoaded: 0,
    companionAssetsTotal: TOTAL_ASSETS,
    companionAssetsProgress: 0
  });
})();