// public/companion-assets-loader-v174.js
// V17.4: single-owner, atomic companion enhancement loading.
(() => {
  const REVISION = "2026-08-22-v17.4-companion-verified-commit";
  if (window.UnlimitedCompanionAssetsV174) return;

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
    ["/companion-v12-phase1.css", "uaiCompanionV124Phase1Css"],
    ["/companion-v12-phase2-background.css", "uaiCompanionV12Phase2BackgroundCss"],
    ["/companion-v12-phase3-character.css", "uaiCompanionV12Phase3CharacterCss"],
    ["/companion-v12-phase4-themes.css", "uaiCompanionV12Phase4ThemesCss"],
    ["/companion-v12-phase5-scene-state.css", "uaiCompanionV12Phase5SceneStateCss"],
    ["/companion-live2d.css", "uaiCompanionLive2dCss"],
    ["/companion-live2d-interaction.css", "uaiCompanionLive2dInteractionCss"],
    ["/companion-live2d-voice.css", "uaiCompanionLive2dVoiceCss"],
    ["/companion-live2d-neural-voice.css", "uaiCompanionLive2dNeuralVoiceCss"],
    ["/companion-voice-input.css", "uaiCompanionVoiceInputCss"],
    ["/companion-call-mode.css", "uaiCompanionCallModeCss"],
    ["/companion-live2d-model-pool.css", "uaiCompanionLive2dModelPoolCss"],
    ["/companion-live2d-polish.css", "uaiCompanionLive2DPolishCss"],
    ["/companion-live2d-emotion-engine.css", "uaiCompanionLive2dEmotionEngineCss"],
    ["/companion-v12-ux-hardening.css", "uaiCompanionV123UxHardeningCss"]
  ];

  // V17.4 physically removed the old Phase1/Phase4 self-load chains. This list is now the
  // one authoritative insertion/execution order for every structural companion enhancement.
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
    ["/companion-v12-phase2-background.js", "uaiCompanionV12Phase2BackgroundScript"],
    ["/companion-v12-phase3-character.js", "uaiCompanionV12Phase3CharacterScript"],
    ["/companion-v12-phase4-themes.js", "uaiCompanionV12Phase4ThemesScript"],
    ["/companion-v12-phase5-scene-state.js", "uaiCompanionV12Phase5SceneStateScript"],
    ["/companion-live2d.js", "uaiCompanionLive2dScript"],
    ["/companion-live2d-interaction.js", "uaiCompanionLive2dInteractionScript"],
    ["/companion-live2d-voice.js", "uaiCompanionLive2dVoiceScript"],
    ["/companion-live2d-neural-voice.js", "uaiCompanionNeuralVoiceScript"],
    ["/companion-voice-input.js", "uaiCompanionVoiceInputScript"],
    ["/companion-call-mode.js", "uaiCompanionCallModeScript"],
    ["/companion-live2d-model-pool.js", "uaiCompanionLive2dModelPoolScript"],
    ["/companion-live2d-polish.js", "uaiCompanionLive2DPolishScript"],
    ["/companion-live2d-emotion-engine.js", "uaiCompanionLive2dEmotionEngineScript"],
    ["/companion-v12-ux-hardening.js", "uaiCompanionV123UxHardeningScript"]
  ];

  const state = {
    promise: null,
    assetsReady: false,
    ready: false,
    error: null,
    loaded: 0
  };

  function companionActive() {
    const root = document.getElementById("uaiCompanionRoot");
    return Boolean(
      document.body.dataset.uaiMode === "companion" &&
      root && !root.hidden && root.isConnected
    );
  }

  function versioned(path) {
    const join = path.includes("?") ? "&" : "?";
    return `${path}${join}v=${encodeURIComponent(REVISION)}`;
  }

  function publish(extra = {}) {
    const total = STYLE_ASSETS.length + SCRIPT_ASSETS.length;
    const detail = {
      revision: REVISION,
      loaded: state.loaded,
      total,
      percent: total ? Math.round((state.loaded / total) * 100) : 100,
      assetsReady: state.assetsReady,
      ready: state.ready,
      loading: Boolean(state.promise),
      ...extra
    };
    if (window.__UNLIMITED_BOOT__) {
      Object.assign(window.__UNLIMITED_BOOT__, {
        companionAssetsRevision: REVISION,
        companionAssetsLoaded: detail.loaded,
        companionAssetsTotal: detail.total,
        companionAssetsProgress: detail.percent,
        companionAssetsReady: state.assetsReady,
        companionEnhancementsReady: state.ready,
        companionAssetsLoading: detail.loading,
        ...extra
      });
    }
    window.dispatchEvent(new CustomEvent("uai:companion-assets-progress", { detail }));
  }

  function predeclareScripts() {
    for (const [, id] of SCRIPT_ASSETS) {
      if (document.getElementById(id)) continue;
      const placeholder = document.createElement("meta");
      placeholder.id = id;
      placeholder.dataset.uaiCompanionScriptPlaceholder = "true";
      document.head.appendChild(placeholder);
    }
  }

  function loadStyle(path, id) {
    return new Promise((resolve, reject) => {
      let link = document.getElementById(id);
      if (link && link.tagName !== "LINK") {
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
        link.media = "not all";
        link.dataset.uaiDeferredActivation = "true";
        link.dataset.uaiCompanionEnhancement = "true";
        document.head.appendChild(link);
      } else {
        link.media = "not all";
        link.dataset.uaiDeferredActivation = "true";
      }

      if (link.dataset.uaiLoaded === "true" || link.sheet) {
        link.dataset.uaiLoaded = "true";
        state.loaded += 1;
        publish({ phase: "asset", asset: path, type: "style" });
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
          if (link.dataset.uaiCompanionEnhancement === "true") link.remove();
          reject(error);
          return;
        }
        link.dataset.uaiLoaded = "true";
        state.loaded += 1;
        publish({ phase: "asset", asset: path, type: "style" });
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

  function loadScript(path, id) {
    return new Promise((resolve, reject) => {
      let script = document.getElementById(id);
      if (script && (script.tagName !== "SCRIPT" || script.dataset.uaiCompanionScriptPlaceholder === "true")) {
        script.remove();
        script = null;
      }
      if (script?.dataset.uaiLoaded === "false") {
        script.remove();
        script = null;
      }
      if (script?.dataset.uaiLoaded === "true") {
        state.loaded += 1;
        publish({ phase: "asset", asset: path, type: "script" });
        resolve(script);
        return;
      }
      if (!script) {
        script = document.createElement("script");
        script.id = id;
        script.async = false;
        script.src = versioned(path);
        script.dataset.uaiCompanionEnhancement = "true";
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
          if (script.dataset.uaiCompanionEnhancement === "true") script.remove();
          reject(error);
          return;
        }
        script.dataset.uaiLoaded = "true";
        state.loaded += 1;
        publish({ phase: "asset", asset: path, type: "script" });
        resolve(script);
      };
      const onLoad = () => finish();
      const onError = () => finish(new Error(`Failed to load ${path}`));
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      timer = window.setTimeout(() => finish(new Error(`Timed out loading ${path}`)), 20000);
    });
  }

  function suppressStyles() {
    for (const [, id] of STYLE_ASSETS) {
      const link = document.getElementById(id);
      if (link?.tagName === "LINK") {
        link.media = "not all";
        link.dataset.uaiDeferredActivation = "true";
      }
    }
    state.ready = false;
    document.documentElement.dataset.companionEnhancementStyles = "deferred";
  }

  function activateStyles() {
    for (const [, id] of STYLE_ASSETS) {
      const link = document.getElementById(id);
      if (link?.tagName === "LINK" && link.dataset.uaiLoaded === "true") {
        link.media = "all";
        delete link.dataset.uaiDeferredActivation;
      }
    }
    document.documentElement.dataset.companionEnhancementStyles = "active";
  }

  function refreshDom() {
    const apis = [
      window.UnlimitedCompanionV10Shell,
      window.UnlimitedCompanionV11,
      window.UnlimitedCompanionV12Galaxy,
      window.UnlimitedCompanionV122,
      window.UnlimitedCompanionV123,
      window.UnlimitedCompanionV124Phase1,
      window.UnlimitedCompanionV125Phase2,
      window.UnlimitedCompanionV126Phase3,
      window.UnlimitedCompanionV127Themes,
      window.UnlimitedCompanionV128Scenes,
      window.UnlimitedCompanionLive2D,
      window.UnlimitedCompanionV123UXHardening
    ];
    for (const api of apis) {
      try { api?.refresh?.(); } catch (error) { console.warn("[Unlimited AI] companion refresh failed", error); }
    }
  }

  function structureReady() {
    if (!companionActive()) return false;
    const root = document.getElementById("uaiCompanionRoot");
    const coreReady = Boolean(
      root?.querySelector(".uai-c-shell") &&
      root.querySelector(".uai-c-main") &&
      root.querySelector("#uaiCompanionMessages") &&
      root.querySelector("#uaiCompanionInput")
    );
    if (!coreReady) return false;
    return Boolean(
      root.querySelector(".uai-c-v12-sidepanel") &&
      root.querySelector(".uai-c-v122-scene") &&
      root.querySelector(".uai-c-v125-scene") &&
      root.querySelector(".uai-c-v127-theme-layer")
    );
  }

  function waitForVerifiedDom(timeoutMs = 1800) {
    return new Promise((resolve, reject) => {
      const deadline = performance.now() + timeoutMs;
      const tick = () => {
        if (!companionActive()) {
          resolve(false);
          return;
        }
        refreshDom();
        if (structureReady()) {
          resolve(true);
          return;
        }
        if (performance.now() >= deadline) {
          reject(new Error("Companion enhancement DOM did not become structurally ready"));
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  async function commitVerifiedStyles() {
    suppressStyles();
    if (!companionActive()) {
      document.documentElement.dataset.companionEnhancementCommit = "deferred";
      publish({ phase: "warm", assetsReady: state.assetsReady, ready: false, loading: false });
      return false;
    }

    refreshDom();
    const verified = await waitForVerifiedDom();
    if (!verified || !companionActive()) {
      suppressStyles();
      document.documentElement.dataset.companionEnhancementCommit = "deferred";
      publish({ phase: "warm", assetsReady: state.assetsReady, ready: false, loading: false });
      return false;
    }

    // The commit event lets gated inline styles initialize only after the required DOM exists.
    document.documentElement.dataset.companionEnhancementCommit = "active";
    window.dispatchEvent(new CustomEvent("uai:companion-enhancements-commit", { detail: { revision: REVISION } }));
    activateStyles();
    refreshDom();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    if (!companionActive()) {
      suppressStyles();
      document.documentElement.dataset.companionEnhancementCommit = "deferred";
      return false;
    }

    state.ready = true;
    publish({ phase: "ready", assetsReady: true, ready: true, loading: false, enhancementsReady: true });
    return true;
  }

  async function recommit() {
    if (!state.assetsReady) return false;
    return commitVerifiedStyles();
  }

  async function performLoad() {
    state.error = null;
    state.assetsReady = false;
    state.ready = false;
    state.loaded = 0;
    suppressStyles();
    predeclareScripts();
    document.documentElement.dataset.companionAssetsRevision = REVISION;
    document.documentElement.dataset.companionEnhancementCommit = "loading";
    publish({ phase: "start", loading: true, assetsReady: false, ready: false });

    const stylePromise = Promise.all(STYLE_ASSETS.map(([path, id]) => loadStyle(path, id)));
    for (const [path, id] of SCRIPT_ASSETS) await loadScript(path, id);
    await stylePromise;

    state.assetsReady = true;
    publish({ phase: "assets-ready", assetsReady: true, ready: false, loading: true });
    return commitVerifiedStyles();
  }

  function load() {
    if (state.assetsReady) return recommit();
    if (state.promise) return state.promise;
    state.promise = performLoad()
      .catch((error) => {
        state.error = error;
        state.assetsReady = false;
        state.ready = false;
        suppressStyles();
        document.documentElement.dataset.companionEnhancementCommit = "degraded";
        publish({ phase: "error", error: error?.message || String(error), loading: false, assetsReady: false, ready: false });
        throw error;
      })
      .finally(() => { state.promise = null; });
    return state.promise;
  }

  window.UnlimitedCompanionAssetsV174 = {
    revision: REVISION,
    load,
    recommit,
    suppressStyles,
    refresh: refreshDom,
    get ready() { return state.ready; },
    get assetsReady() { return state.assetsReady; },
    get loading() { return Boolean(state.promise); },
    get lastError() { return state.error; },
    styles: STYLE_ASSETS.map(([path]) => path),
    scripts: SCRIPT_ASSETS.map(([path]) => path)
  };
  window.UnlimitedCompanionAssets = window.UnlimitedCompanionAssetsV174;
  publish({ phase: "deferred", loading: false, assetsReady: false, ready: false });
})();