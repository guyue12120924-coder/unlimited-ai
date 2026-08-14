// Companion V12.9 — Live2D virtual character stage for the companion chat.
(() => {
  const REVISION = "2026-08-14-v12.9-live2d-stage-1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  const MODEL_ASSIGNMENTS_KEY = "uai_companion_live2d_assignments_v1";
  const CONFIG_URL = "/live2d/characters.json";
  const PIXI_URL = "https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js";
  const LIVE2D_PLUGIN_URL = "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js";
  const LOCAL_CORE_URL = "/live2d/vendor/live2dcubismcore.min.js";
  const OFFICIAL_CORE_URL = "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js";

  let scheduled = false;
  let configPromise = null;
  let runtimePromise = null;
  let app = null;
  let canvas = null;
  let layer = null;
  let currentModel = null;
  let currentSpec = null;
  let currentCharacterId = "";
  let currentSignature = "";
  let loadToken = 0;
  let boundMain = null;
  let resizeObserver = null;
  let status = { state: "idle", characterId: "", modelUrl: "", message: "" };

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function liveRoot() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const root = document.getElementById("uaiCompanionRoot");
    return root && !root.hidden && root.isConnected ? root : null;
  }

  function activeCharacter() {
    const id = window.UnlimitedCompanionMulti?.activeCharacterId || localStorage.getItem(ACTIVE_KEY) || "";
    const list = window.UnlimitedCompanionMulti?.getCharacters?.();
    const character = Array.isArray(list) ? list.find((item) => item?.id === id) || list[0] : null;
    const state = window.UnlimitedCompanion?.getState?.() || {};
    const profile = character?.profile || state.profile || {};
    return {
      id: character?.id || id || "legacy",
      profile
    };
  }

  function setStatus(root, state, message = "", modelUrl = "") {
    const characterId = activeCharacter().id;
    status = { state, message, modelUrl, characterId };
    if (root) {
      root.dataset.v129Live2dStatus = state;
      root.dataset.v129Live2dCharacter = characterId;
    }
    document.documentElement.dataset.companionLive2dStatus = state;
  }

  function normalizeSpec(raw) {
    if (!raw) return null;
    if (typeof raw === "string") return { model: raw };
    if (typeof raw !== "object" || Array.isArray(raw)) return null;
    const model = String(raw.model || raw.url || "").trim();
    if (!model) return null;
    return {
      ...raw,
      model,
      position: raw.position && typeof raw.position === "object" ? raw.position : {},
      expressions: raw.expressions && typeof raw.expressions === "object" ? raw.expressions : {},
      motions: raw.motions && typeof raw.motions === "object" ? raw.motions : {},
      tapMotionGroups: Array.isArray(raw.tapMotionGroups) ? raw.tapMotionGroups : []
    };
  }

  async function readConfig() {
    if (configPromise) return configPromise;
    configPromise = fetch(`${CONFIG_URL}?v=${encodeURIComponent(REVISION)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return {};
        const type = String(response.headers.get("content-type") || "");
        if (type.includes("text/html")) return {};
        return response.json();
      })
      .catch(() => ({}));
    return configPromise;
  }

  function localAssignments() {
    const value = safeParse(localStorage.getItem(MODEL_ASSIGNMENTS_KEY), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  async function resolveSpec(character) {
    const assignments = localAssignments();
    const direct = normalizeSpec(assignments[character.id]);
    if (direct) return direct;

    const config = await readConfig();
    const byId = config?.byId && typeof config.byId === "object" ? config.byId : {};
    const byName = config?.byName && typeof config.byName === "object" ? config.byName : {};
    return normalizeSpec(byId[character.id])
      || normalizeSpec(byName[String(character.profile?.name || "")])
      || normalizeSpec(config?.defaultModel)
      || null;
  }

  async function resourceExists(url) {
    if (!url) return false;
    try {
      const response = await fetch(url, { method: "HEAD", cache: "no-store" });
      const type = String(response.headers.get("content-type") || "");
      return response.ok && !type.includes("text/html");
    } catch {
      return false;
    }
  }

  async function probeModel(url) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return false;
      const type = String(response.headers.get("content-type") || "");
      if (type.includes("text/html")) return false;
      const json = await response.json();
      return Boolean(json && typeof json === "object" && (json.FileReferences || json.fileReferences));
    } catch {
      return false;
    }
  }

  function scriptReady(test) {
    try { return Boolean(test?.()); } catch { return false; }
  }

  function loadScript(src, id, test) {
    if (scriptReady(test)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let script = document.getElementById(id);
      if (script) {
        if (scriptReady(test)) return resolve();
        script.addEventListener("load", () => scriptReady(test) ? resolve() : reject(new Error(`资源未初始化：${src}`)), { once: true });
        script.addEventListener("error", () => reject(new Error(`资源加载失败：${src}`)), { once: true });
        return;
      }
      script = document.createElement("script");
      script.id = id;
      script.async = false;
      script.src = src;
      script.addEventListener("load", () => scriptReady(test) ? resolve() : reject(new Error(`资源未初始化：${src}`)), { once: true });
      script.addEventListener("error", () => reject(new Error(`资源加载失败：${src}`)), { once: true });
      document.body.appendChild(script);
    });
  }

  async function ensureRuntime() {
    if (window.PIXI?.live2d?.Live2DModel && window.Live2DCubismCore) return;
    if (runtimePromise) return runtimePromise;
    runtimePromise = (async () => {
      await loadScript(PIXI_URL, "uaiCompanionPixiV6", () => window.PIXI?.Application);

      if (!window.Live2DCubismCore) {
        const hasLocalCore = await resourceExists(LOCAL_CORE_URL);
        if (hasLocalCore) {
          await loadScript(LOCAL_CORE_URL, "uaiCompanionCubismCore", () => window.Live2DCubismCore);
        } else {
          await loadScript(OFFICIAL_CORE_URL, "uaiCompanionCubismCore", () => window.Live2DCubismCore);
        }
      }

      await loadScript(LIVE2D_PLUGIN_URL, "uaiCompanionPixiLive2D", () => window.PIXI?.live2d?.Live2DModel);
    })().catch((error) => {
      runtimePromise = null;
      throw error;
    });
    return runtimePromise;
  }

  function ensureLayer(root) {
    const main = root?.querySelector(".uai-c-main");
    if (!main) return null;
    let host = main.querySelector(":scope > .uai-c-live2d-layer");
    if (!host) {
      host = document.createElement("div");
      host.className = "uai-c-live2d-layer";
      host.setAttribute("aria-hidden", "true");
      host.innerHTML = `
        <div class="uai-c-live2d-stage">
          <canvas class="uai-c-live2d-canvas"></canvas>
          <div class="uai-c-live2d-floor"></div>
          <div class="uai-c-live2d-wash"></div>
        </div>`;
      main.prepend(host);
    }
    layer = host;
    canvas = host.querySelector(".uai-c-live2d-canvas");
    bindMainInteraction(main);
    observeResize(main);
    return host;
  }

  function observeResize(main) {
    if (resizeObserver && boundMain === main) return;
    resizeObserver?.disconnect?.();
    if (typeof ResizeObserver !== "function") return;
    resizeObserver = new ResizeObserver(() => {
      resizeRenderer();
      fitModel();
    });
    resizeObserver.observe(main);
  }

  function bindMainInteraction(main) {
    if (boundMain === main) return;
    boundMain = main;
    main.addEventListener("pointermove", (event) => {
      if (!currentModel || !liveRoot()) return;
      try { currentModel.focus(event.clientX, event.clientY); } catch {}
    }, { passive: true });

    main.addEventListener("pointerleave", () => {
      if (!currentModel) return;
      const rect = main.getBoundingClientRect();
      try { currentModel.focus(rect.left + rect.width * .72, rect.top + rect.height * .46); } catch {}
    }, { passive: true });

    main.addEventListener("pointerdown", (event) => {
      if (!currentModel || !liveRoot()) return;
      if (event.target?.closest?.("button,input,textarea,select,a,.uai-c-message-row,.uai-c-composer")) return;
      const rect = main.getBoundingClientRect();
      if (!rect.width || event.clientX < rect.left + rect.width * .46) return;
      try { currentModel.tap(event.clientX, event.clientY); } catch {}
    }, { passive: true });
  }

  function ensureApp() {
    if (app && canvas) return app;
    if (!canvas || !window.PIXI?.Application) return null;
    app = new window.PIXI.Application({
      view: canvas,
      transparent: true,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      backgroundAlpha: 0
    });
    app.stage.sortableChildren = true;
    resizeRenderer();
    return app;
  }

  function resizeRenderer() {
    if (!app || !layer) return;
    const rect = layer.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    app.renderer.resize(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)));
  }

  function fitModel() {
    if (!currentModel || !layer) return;
    const rect = layer.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const spec = currentSpec || {};
    const position = spec.position || {};
    const base = currentModel.__uaiBaseSize || { width: currentModel.width || 1, height: currentModel.height || 1 };
    const targetHeight = rect.height * clamp(position.height, .46, 1.08, .82);
    const scale = targetHeight / Math.max(1, base.height);
    currentModel.scale.set(scale);
    currentModel.anchor?.set?.(.5, 1);
    currentModel.x = rect.width * clamp(position.x, .48, .96, .73);
    currentModel.y = rect.height * clamp(position.y, .72, 1.08, .985);
  }

  function stopTicker() {
    try { app?.ticker?.stop?.(); } catch {}
  }

  function startTicker() {
    if (document.hidden || !liveRoot() || !currentModel) return;
    try { app?.ticker?.start?.(); } catch {}
  }

  function destroyCurrentModel(root, nextState = "idle") {
    loadToken += 1;
    if (currentModel) {
      try { app?.stage?.removeChild?.(currentModel); } catch {}
      try { currentModel.destroy?.({ children: true }); } catch { try { currentModel.destroy?.(); } catch {} }
    }
    currentModel = null;
    currentSpec = null;
    currentCharacterId = "";
    stopTicker();
    root?.classList.remove("uai-c-live2d-active");
    if (nextState) setStatus(root, nextState);
  }

  function asList(value, fallback = []) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === "string" && value.trim()) return [value.trim()];
    return fallback;
  }

  async function firstSuccessful(items, runner) {
    for (const item of items) {
      try {
        if (await runner(item)) return true;
      } catch {}
    }
    return false;
  }

  function defaultExpressionNames(emotion) {
    return ({
      happy: ["happy", "smile", "joy"],
      shy: ["shy", "blush", "embarrassed"],
      sad: ["sad", "down"],
      angry: ["angry", "mad"],
      caring: ["gentle", "smile", "happy"],
      thinking: ["thinking", "serious"],
      normal: ["default", "normal"]
    })[emotion] || [];
  }

  function defaultMotionGroups(emotion) {
    return ({
      happy: ["Happy", "happy", "Joy"],
      shy: ["Shy", "shy"],
      sad: ["Sad", "sad"],
      angry: ["Angry", "angry"],
      caring: ["Gentle", "Love", "happy"],
      thinking: ["Thinking", "thinking"],
      normal: []
    })[emotion] || [];
  }

  async function playTapReaction(hitAreas = []) {
    if (!currentModel) return false;
    const configured = currentSpec?.tapMotionGroups;
    const groups = asList(configured, ["TapBody", "tap_body", "TouchBody"]);
    const bodyHit = !hitAreas.length || hitAreas.some((name) => /body|head|face/i.test(String(name)));
    if (!bodyHit) return false;
    return firstSuccessful(groups, (group) => currentModel.motion(group));
  }

  async function setExpression(name) {
    if (!currentModel || name == null) return false;
    try { return Boolean(await currentModel.expression(name)); } catch { return false; }
  }

  async function playMotion(group, index) {
    if (!currentModel || !group) return false;
    try { return Boolean(await currentModel.motion(String(group), index)); } catch { return false; }
  }

  async function setEmotion(emotion = "normal") {
    const key = String(emotion || "normal").toLowerCase();
    const root = liveRoot();
    if (root) root.dataset.v129Live2dEmotion = key;
    if (!currentModel) return false;
    const expressionNames = asList(currentSpec?.expressions?.[key], defaultExpressionNames(key));
    const motionGroups = asList(currentSpec?.motions?.[key], defaultMotionGroups(key));
    const expressionChanged = await firstSuccessful(expressionNames, (name) => currentModel.expression(name));
    const motionChanged = await firstSuccessful(motionGroups, (group) => currentModel.motion(group));
    return expressionChanged || motionChanged;
  }

  function setMouthOpen(value) {
    if (!currentModel) return false;
    const amount = clamp(value, 0, 1, 0);
    const core = currentModel.internalModel?.coreModel;
    const setter = core?.setParameterValueById;
    if (typeof setter !== "function") return false;
    for (const id of ["ParamMouthOpenY", "PARAM_MOUTH_OPEN_Y"]) {
      try {
        setter.call(core, id, amount);
        return true;
      } catch {}
    }
    return false;
  }

  async function loadModel(root, character, spec, signature) {
    const token = ++loadToken;
    setStatus(root, "loading", "正在加载 Live2D", spec.model);
    root.classList.remove("uai-c-live2d-active");

    const exists = await probeModel(spec.model);
    if (token !== loadToken) return;
    if (!exists) {
      destroyCurrentModel(root, "model-missing");
      status.modelUrl = spec.model;
      return;
    }

    try {
      await ensureRuntime();
      if (token !== loadToken) return;
      ensureApp();
      if (!app) throw new Error("PixiJS 初始化失败");

      if (currentModel) {
        try { app.stage.removeChild(currentModel); } catch {}
        try { currentModel.destroy?.({ children: true }); } catch { try { currentModel.destroy?.(); } catch {} }
      }

      const Live2DModel = window.PIXI?.live2d?.Live2DModel;
      if (!Live2DModel) throw new Error("Live2DModel 不可用");
      const model = await Live2DModel.from(spec.model, {
        autoInteract: false,
        autoUpdate: true,
        idleMotionGroup: String(spec.idleMotionGroup || "Idle")
      });
      if (token !== loadToken) {
        try { model.destroy?.({ children: true }); } catch {}
        return;
      }

      currentModel = model;
      currentSpec = spec;
      currentCharacterId = character.id;
      currentSignature = signature;
      model.__uaiBaseSize = { width: model.width || 1, height: model.height || 1 };
      model.zIndex = 1;
      model.interactive = false;
      model.on?.("hit", (hitAreas) => playTapReaction(Array.isArray(hitAreas) ? hitAreas : []));
      app.stage.addChild(model);
      resizeRenderer();
      fitModel();
      root.classList.add("uai-c-live2d-active");
      setStatus(root, "ready", "", spec.model);
      startTicker();
    } catch (error) {
      if (token !== loadToken) return;
      destroyCurrentModel(root, "runtime-error");
      status.modelUrl = spec.model;
      status.message = error?.message || String(error);
      console.warn("[Unlimited AI] Live2D load failed:", error);
    }
  }

  async function enhance() {
    scheduled = false;
    const root = liveRoot();
    if (!root) {
      stopTicker();
      return;
    }
    root.dataset.v129Live2d = REVISION;
    ensureLayer(root);

    const character = activeCharacter();
    const spec = await resolveSpec(character);
    const signature = `${character.id}|${spec?.model || "none"}`;
    if (signature === currentSignature) {
      if (currentModel) {
        root.classList.add("uai-c-live2d-active");
        fitModel();
        startTicker();
      }
      return;
    }

    currentSignature = signature;
    if (!spec?.model) {
      destroyCurrentModel(root, "unconfigured");
      currentSignature = signature;
      return;
    }
    await loadModel(root, character, spec, signature);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function setModelForCharacter(characterId, model, options = {}) {
    const id = String(characterId || activeCharacter().id || "").trim();
    const url = String(model || "").trim();
    if (!id || !url) return false;
    const map = localAssignments();
    map[id] = { ...options, model: url };
    localStorage.setItem(MODEL_ASSIGNMENTS_KEY, JSON.stringify(map));
    currentSignature = "";
    schedule();
    return true;
  }

  function clearModelForCharacter(characterId) {
    const id = String(characterId || activeCharacter().id || "").trim();
    if (!id) return false;
    const map = localAssignments();
    if (!Object.prototype.hasOwnProperty.call(map, id)) return false;
    delete map[id];
    localStorage.setItem(MODEL_ASSIGNMENTS_KEY, JSON.stringify(map));
    currentSignature = "";
    schedule();
    return true;
  }

  function refresh() {
    configPromise = null;
    currentSignature = "";
    schedule();
  }

  function init() {
    document.documentElement.dataset.companionLive2dRevision = REVISION;
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode", "class"]
    });
    window.addEventListener("storage", (event) => {
      if ([ACTIVE_KEY, MODEL_ASSIGNMENTS_KEY, "uai_companion_characters_v1"].includes(event.key)) refresh();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopTicker(); else schedule();
    });

    window.UnlimitedCompanionLive2D = {
      revision: REVISION,
      refresh,
      getStatus: () => ({ ...status }),
      getModel: () => currentModel,
      setModelForCharacter,
      clearModelForCharacter,
      setEmotion,
      setExpression,
      playMotion,
      setMouthOpen
    };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
