// V17.21 integrated Live2D background with version-independent emotional voice lip-sync ownership.
(() => {
  const REVISION = "2026-08-23-v17.21-emotional-lipsync-owner";
  if (window.UnlimitedCompanionStageV1712?.revision === REVISION) return;

  const CONFIG_URL = "/live2d/characters.json";
  const ASSIGNMENTS_KEY = "uai_companion_live2d_assignments_v1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  const PIXI_URL = "https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js";
  const PLUGIN_URL = "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js";
  const LOCAL_CORE_URL = "/live2d/vendor/live2dcubismcore.min.js";
  const OFFICIAL_CORE_URL = "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js";

  let openState = true;
  let stageHost = null;
  let stageMain = null;
  let canvas = null;
  let app = null;
  let model = null;
  let modelSpec = null;
  let currentModelKey = "";
  let runtimePromise = null;
  let configPromise = null;
  let loadingPromise = null;
  let pendingReload = false;
  let loadToken = 0;
  let resizeObserver = null;
  let voiceObserver = null;
  let generationObserver = null;
  let observedInput = null;
  let pointerBoundMain = null;
  let interactionController = null;
  let mouthTimer = 0;
  let mouthValue = 0;
  let status = "idle";
  const availabilityCache = new Map();

  function root() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const host = document.getElementById("uaiCompanionRoot");
    return host && !host.hidden && host.isConnected ? host : null;
  }

  function main() { return root()?.querySelector(".uai-c-main") || null; }

  function nextFrame(count = 1) {
    return new Promise((resolve) => {
      const step = () => count-- > 1 ? requestAnimationFrame(step) : resolve();
      requestAnimationFrame(step);
    });
  }

  function safeParse(value, fallback) { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } }

  function activeCharacter() {
    const id = window.UnlimitedCompanionMulti?.activeCharacterId || localStorage.getItem(ACTIVE_KEY) || "legacy";
    const list = window.UnlimitedCompanionMulti?.getCharacters?.();
    const character = Array.isArray(list) ? list.find((item) => item?.id === id) || list[0] : null;
    const state = window.UnlimitedCompanion?.getState?.() || {};
    return { id: character?.id || id, profile: character?.profile || state.profile || {} };
  }

  function assignments() {
    const value = safeParse(localStorage.getItem(ASSIGNMENTS_KEY), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  async function readConfig() {
    if (configPromise) return configPromise;
    configPromise = fetch(`${CONFIG_URL}?v=${encodeURIComponent(REVISION)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : {})
      .catch(() => ({}));
    return configPromise;
  }

  function normalizeSpec(raw) {
    if (!raw) return null;
    if (typeof raw === "string") return { model: raw, position: {} };
    if (typeof raw !== "object" || Array.isArray(raw)) return null;
    const url = String(raw.model || raw.url || "").trim();
    if (!url) return null;
    return { ...raw, model: url, position: raw.position && typeof raw.position === "object" ? raw.position : {} };
  }

  async function resolveSpec(character) {
    const direct = normalizeSpec(assignments()[character.id]);
    if (direct) return direct;
    const config = await readConfig();
    const byId = config?.byId && typeof config.byId === "object" ? config.byId : {};
    const byName = config?.byName && typeof config.byName === "object" ? config.byName : {};
    return normalizeSpec(byId[character.id]) || normalizeSpec(byName[String(character.profile?.name || "")]) || normalizeSpec(config?.defaultModel) || null;
  }

  async function modelAvailable(url) {
    if (!url) return false;
    if (availabilityCache.has(url)) return availabilityCache.get(url);
    const promise = fetch(url, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return false;
        if (String(response.headers.get("content-type") || "").includes("text/html")) return false;
        const data = await response.json();
        return Boolean(data && typeof data === "object" && (data.FileReferences || data.fileReferences));
      })
      .catch(() => false);
    availabilityCache.set(url, promise);
    return promise;
  }

  async function selectAvailableSpec(spec) {
    if (spec?.model && await modelAvailable(spec.model)) return spec;
    const fallback = normalizeSpec(spec?.fallback);
    if (fallback?.model && await modelAvailable(fallback.model)) return fallback;
    return null;
  }

  function loadScript(src, id, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let script = document.getElementById(id);
      if (script && script.dataset.uaiLoadFailed === "1") { script.remove(); script = null; }
      if (!script) {
        script = document.createElement("script");
        script.id = id;
        script.async = false;
        script.src = src;
        document.body.appendChild(script);
      }
      const timer = setTimeout(() => reject(new Error(`Timed out loading ${src}`)), 15000);
      const finish = () => { clearTimeout(timer); ready() ? resolve() : reject(new Error(`Resource not initialized: ${src}`)); };
      script.addEventListener("load", finish, { once: true });
      script.addEventListener("error", () => { clearTimeout(timer); script.dataset.uaiLoadFailed = "1"; reject(new Error(`Failed to load ${src}`)); }, { once: true });
      if (ready()) { clearTimeout(timer); resolve(); }
    });
  }

  async function localCoreExists() {
    try {
      const response = await fetch(LOCAL_CORE_URL, { method: "HEAD", cache: "no-store" });
      return response.ok && !String(response.headers.get("content-type") || "").includes("text/html");
    } catch { return false; }
  }

  async function ensureRuntime() {
    if (window.PIXI?.live2d?.Live2DModel && window.Live2DCubismCore) return;
    if (runtimePromise) return runtimePromise;
    runtimePromise = (async () => {
      await loadScript(PIXI_URL, "uaiV1712Pixi", () => Boolean(window.PIXI?.Application));
      if (!window.Live2DCubismCore && await localCoreExists()) {
        try { await loadScript(LOCAL_CORE_URL, "uaiV1712CubismLocal", () => Boolean(window.Live2DCubismCore)); } catch {}
      }
      if (!window.Live2DCubismCore) await loadScript(OFFICIAL_CORE_URL, "uaiV1712CubismOfficial", () => Boolean(window.Live2DCubismCore));
      await loadScript(PLUGIN_URL, "uaiV1712Live2DPlugin", () => Boolean(window.PIXI?.live2d?.Live2DModel));
    })().catch((error) => { runtimePromise = null; throw error; });
    return runtimePromise;
  }

  function setStatus(next, message = "") {
    status = next;
    if (!stageHost) return;
    stageHost.dataset.state = next;
    const note = stageHost.querySelector("[data-v1712-status]");
    if (!note) return;
    const fallbackText = { loading: "正在唤醒角色…", ready: "", fallback: "Live2D 暂不可用，已使用角色头像", degraded: "角色保持在线，模型刷新稍后重试", error: "角色加载失败" }[next] || "";
    note.textContent = message || fallbackText;
    note.hidden = !note.textContent;
  }

  function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

  function fallbackAvatar(message = "") {
    const profile = activeCharacter().profile || {};
    const fallback = stageHost?.querySelector("[data-v1712-fallback]");
    if (!fallback) return;
    fallback.hidden = false;
    const image = profile.avatarData || profile.avatar || "";
    fallback.innerHTML = image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(profile.name || "角色")}" />` : `<span>${String(profile.name || "AI").trim().slice(0, 1) || "♡"}</span><strong>${escapeHtml(profile.name || "AI 伙伴")}</strong>`;
    setStatus("fallback", message);
  }

  function hideFallback() { const fallback = stageHost?.querySelector("[data-v1712-fallback]"); if (fallback) fallback.hidden = true; }

  function releaseRenderer() {
    if (app) {
      try { app.ticker?.stop?.(); } catch {}
      try { app.destroy?.(false, { children: false, texture: false, baseTexture: false }); } catch { try { app.destroy?.(); } catch {} }
    }
    app = null;
  }

  function disconnectStageObservers() {
    resizeObserver?.disconnect?.(); resizeObserver = null;
    voiceObserver?.disconnect?.(); voiceObserver = null;
    generationObserver?.disconnect?.(); generationObserver = null;
    observedInput = null;
  }

  function disconnectInteractions() { interactionController?.abort?.(); interactionController = null; pointerBoundMain = null; }

  function ensureStageHost() {
    const host = root();
    const targetMain = main();
    if (!host || !targetMain) return null;
    if (stageHost && (!stageHost.isConnected || stageMain !== targetMain)) {
      destroyModel(); disconnectStageObservers(); disconnectInteractions(); releaseRenderer(); stageHost?.remove(); stageHost = null; canvas = null; stageMain = null; currentModelKey = "";
    }
    if (stageHost?.isConnected) return stageHost;
    stageHost = document.createElement("section");
    stageHost.id = "uaiCompanionStageV1712";
    stageHost.className = "uai-c-v1712-stage uai-c-v1712-integrated";
    stageHost.setAttribute("aria-label", "背景角色");
    stageHost.setAttribute("aria-hidden", "true");
    stageHost.innerHTML = `<div class="uai-c-v1712-viewport"><div class="uai-c-v1712-glow"></div><div class="uai-c-v1712-floor"></div><canvas data-v1712-canvas></canvas><div class="uai-c-v1712-fallback" data-v1712-fallback hidden></div><small class="uai-c-v1712-credit" data-v1712-credit hidden></small><small class="uai-c-v1712-status" data-v1712-status hidden></small></div>`;
    canvas = stageHost.querySelector("[data-v1712-canvas]");
    stageMain = targetMain;
    targetMain.appendChild(stageHost);
    bindStageInteractions(targetMain);
    bindVoiceObserver();
    bindGenerationObserver();
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(() => { resizeRenderer(); fitModel(); });
      resizeObserver.observe(targetMain);
    }
    return stageHost;
  }

  function bindStageInteractions(targetMain) {
    if (!targetMain || pointerBoundMain === targetMain) return;
    disconnectInteractions();
    pointerBoundMain = targetMain;
    interactionController = new AbortController();
    const signal = interactionController.signal;
    targetMain.addEventListener("pointermove", focusPointer, { passive: true, signal });
    targetMain.addEventListener("pointerdown", (event) => {
      if (event.target?.closest?.("button,textarea,input,select,a,.uai-c-bubble,.uai-c-composer,.uai-c-header")) return;
      const rect = targetMain.getBoundingClientRect();
      if (!rect.width || event.clientX < rect.left + rect.width * .52) return;
      tapModel(event);
    }, { passive: true, signal });
  }

  function rendererHealthy() {
    if (!app?.renderer) return false;
    try { const gl = app.renderer.gl; return !gl?.isContextLost?.(); }
    catch { return true; }
  }

  async function ensureRenderer() {
    ensureStageHost();
    if (app && rendererHealthy()) return app;
    if (app && !rendererHealthy()) releaseRenderer();
    await nextFrame(2);
    const viewport = stageHost?.querySelector(".uai-c-v1712-viewport");
    const rect = viewport?.getBoundingClientRect();
    if (!canvas || !rect?.width || !rect.height) throw new Error("Live2D background has no visible viewport");
    const PIXI = window.PIXI;
    if (!PIXI?.Application) throw new Error("Pixi runtime unavailable");
    app = new PIXI.Application({ view: canvas, width: Math.max(2, Math.round(rect.width)), height: Math.max(2, Math.round(rect.height)), transparent: true, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 1.75), backgroundAlpha: 0, autoStart: true });
    canvas.addEventListener("webglcontextlost", (event) => { event.preventDefault(); setStatus("degraded", "角色画面正在恢复…"); }, { passive: false });
    canvas.addEventListener("webglcontextrestored", () => { setStatus("loading", "正在恢复角色画面…"); requestAnimationFrame(() => loadCharacter({ recover: true })); });
    resizeRenderer();
    return app;
  }

  function resizeRenderer() {
    if (!app || !stageHost) return;
    const rect = stageHost.querySelector(".uai-c-v1712-viewport")?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    try { app.renderer.resize(Math.max(2, Math.round(rect.width)), Math.max(2, Math.round(rect.height))); } catch {}
  }

  function fitModel() {
    if (!model || !stageHost) return;
    const rect = stageHost.querySelector(".uai-c-v1712-viewport")?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    const position = modelSpec?.position || {};
    const inCall = root()?.dataset.v1713Call === "active";
    const defaultHeight = inCall ? .96 : .84;
    const defaultX = inCall ? .64 : .78;
    const heightRatio = Math.max(.52, Math.min(1.08, Number(position.height) || defaultHeight));
    const baseHeight = model.__uaiBaseHeight || model.height || 1;
    model.scale.set((rect.height * heightRatio) / Math.max(1, baseHeight));
    model.anchor?.set?.(.5, 1);
    model.x = rect.width * Math.max(.42, Math.min(.9, Number(position.x) || defaultX));
    model.y = rect.height * Math.max(.82, Math.min(1.08, Number(position.y) || 1.02));
  }

  function destroyModel(target = model) {
    if (!target) return;
    stopMouthAnimation();
    try { app?.stage?.removeChild?.(target); } catch {}
    try { target.destroy?.({ children: true }); } catch { try { target.destroy?.(); } catch {} }
    if (target === model) { model = null; modelSpec = null; currentModelKey = ""; }
  }

  function destroyStage() {
    loadToken += 1; loadingPromise = null; pendingReload = false; destroyModel(); disconnectStageObservers(); disconnectInteractions(); releaseRenderer(); stageHost?.remove(); stageHost = null; stageMain = null; canvas = null; status = "idle";
  }

  async function performLoad(options = {}) {
    const host = root();
    if (!openState || !host) return false;
    ensureStageHost();
    const token = ++loadToken;
    setStatus("loading");
    try {
      const character = activeCharacter();
      if (options.resetConfig) configPromise = null;
      const configured = await resolveSpec(character);
      const selected = await selectAvailableSpec(configured);
      if (token !== loadToken || !openState) return false;
      if (!selected) {
        if (!model) fallbackAvatar("没有找到可用的 Live2D 模型");
        else setStatus("degraded", "当前角色模型配置暂不可用");
        return Boolean(model);
      }
      const nextKey = `${character.id}::${selected.model}`;
      if (model && currentModelKey === nextKey && rendererHealthy() && !options.recover) {
        modelSpec = selected; hideFallback(); resizeRenderer(); fitModel(); setStatus("ready"); syncVoiceState(); return true;
      }
      await ensureRuntime();
      if (token !== loadToken || !openState) return false;
      await ensureRenderer();
      if (token !== loadToken || !openState) return false;
      const PIXI = window.PIXI;
      if (!PIXI?.live2d?.Live2DModel) throw new Error("Live2D runtime unavailable");
      const loaded = await PIXI.live2d.Live2DModel.from(selected.model, { autoInteract: false, autoUpdate: true, idleMotionGroup: String(selected.idleMotionGroup || "Idle") });
      if (token !== loadToken || !openState) { try { loaded.destroy?.({ children: true }); } catch {} return false; }
      const previous = model;
      model = loaded; modelSpec = selected; currentModelKey = nextKey; model.__uaiBaseHeight = model.height || 1; model.interactive = false; app.stage.addChild(model); resizeRenderer(); fitModel(); if (previous && previous !== model) destroyModel(previous);
      const credit = stageHost?.querySelector("[data-v1712-credit]");
      if (credit) { const showCredit = Boolean(selected.sample?.name); credit.hidden = !showCredit; credit.textContent = showCredit ? `${selected.sample.name} · ${selected.sample.owner || "Live2D Inc."}` : ""; credit.title = showCredit ? String(selected.sample.notice || "") : ""; }
      hideFallback(); setStatus("ready"); syncVoiceState(); const text = lastAssistantText(); if (text) setEmotion(classifyEmotion(text)); return true;
    } catch (error) {
      if (token !== loadToken || !openState) return false;
      console.warn("[Unlimited AI] integrated Live2D background degraded", error);
      if (model && rendererHealthy()) { setStatus("degraded", "角色保持在线，模型刷新稍后重试"); return true; }
      fallbackAvatar(error?.message || "Live2D 加载失败"); return false;
    }
  }

  function loadCharacter(options = {}) {
    const normalized = typeof options === "boolean" ? { force: options } : (options || {});
    if (loadingPromise) { if (normalized.force || normalized.recover || normalized.resetConfig) pendingReload = true; return loadingPromise; }
    loadingPromise = performLoad(normalized).finally(() => { loadingPromise = null; if (pendingReload && openState && root()) { pendingReload = false; queueMicrotask(() => loadCharacter()); } });
    return loadingPromise;
  }

  function stagePoint(event) {
    const rect = stageHost?.querySelector(".uai-c-v1712-viewport")?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return null;
    return { x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)), y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)) };
  }

  function focusPointer(event) { if (!model || !openState) return; const point = stagePoint(event); if (!point) return; try { model.focus(point.x, point.y); } catch {} }
  function tapModel(event) { if (!model || !openState) return; const point = stagePoint(event); if (!point) return; try { model.tap(point.x, point.y); } catch {} const groups = Array.isArray(modelSpec?.tapMotionGroups) ? modelSpec.tapMotionGroups : ["TapBody"]; for (const group of groups) { try { if (model.motion(group)) break; } catch {} } }

  function parameterIds() { try { return Array.from(model?.internalModel?.coreModel?.getModel?.()?.parameters?.ids || []).map(String); } catch { return []; } }

  function setMouthOpen(value) {
    if (!model) return false;
    const core = model.internalModel?.coreModel;
    if (typeof core?.setParameterValueById !== "function") return false;
    const ids = parameterIds();
    const mouthIds = ["ParamMouthOpenY", "ParamA", "PARAM_MOUTH_OPEN_Y"].filter((id) => !ids.length || ids.includes(id));
    mouthValue = Math.max(0, Math.min(1, Number(value) || 0));
    for (const id of mouthIds.length ? mouthIds : ["ParamMouthOpenY"]) { try { core.setParameterValueById(id, mouthValue, 1); } catch {} }
    return true;
  }

  function stopMouthAnimation() { if (mouthTimer) clearInterval(mouthTimer); mouthTimer = 0; setMouthOpen(0); }
  function pauseLegacyMouthAnimation() { if (mouthTimer) clearInterval(mouthTimer); mouthTimer = 0; }
  function startMouthAnimation() { if (!model || mouthTimer || document.hidden) return; mouthTimer = setInterval(() => { if (!openState || !model || document.hidden) return stopMouthAnimation(); setMouthOpen(.2 + Math.random() * .7); }, 90); }

  function emotionalVoiceOwnsLipSync() {
    const api = window.UnlimitedCompanionVoiceV1711;
    return Boolean(api?.buildSpeechPlan && api?.speak && api?.setSettings && api?.unlockAudio);
  }

  function syncVoiceState() {
    const voiceState = root()?.dataset.v1711VoiceState || "";
    if (voiceState === "speaking") {
      if (emotionalVoiceOwnsLipSync()) pauseLegacyMouthAnimation();
      else startMouthAnimation();
    } else stopMouthAnimation();
    fitModel();
  }

  function bindVoiceObserver() {
    const host = root();
    if (!host) return;
    voiceObserver?.disconnect?.();
    voiceObserver = new MutationObserver(syncVoiceState);
    voiceObserver.observe(host, { attributes: true, attributeFilter: ["data-v1711-voice-state", "data-v1713-call"] });
  }

  function classifyEmotion(text) {
    const source = String(text || "");
    if (/难过|伤心|抱歉|心疼|哭|失落/.test(source)) return "sad";
    if (/生气|讨厌|别闹|哼|气死/.test(source)) return "angry";
    if (/害羞|脸红|笨蛋|喜欢你|想你|抱抱/.test(source)) return "shy";
    if (/哈哈|开心|太好了|好呀|当然|喜欢/.test(source)) return "happy";
    if (/想想|也许|可能|认真|考虑/.test(source)) return "thinking";
    if (/晚安|放心|陪你|没关系|乖/.test(source)) return "caring";
    return "normal";
  }

  async function setEmotion(emotion = "normal") {
    if (!model) return false;
    const key = String(emotion || "normal").toLowerCase();
    stageHost?.setAttribute("data-emotion", key);
    const defaults = { happy: ["happy", "smile", "joy"], shy: ["shy", "blush"], sad: ["sad"], angry: ["angry"], caring: ["gentle", "smile"], thinking: ["thinking", "serious"] };
    const expressions = modelSpec?.expressions?.[key] || defaults[key] || [];
    for (const name of Array.isArray(expressions) ? expressions : [expressions]) { try { if (await model.expression(name)) return true; } catch {} }
    const motions = modelSpec?.motions?.[key] || [];
    for (const group of Array.isArray(motions) ? motions : [motions]) { try { if (await model.motion(group)) return true; } catch {} }
    return false;
  }

  function lastAssistantText() { const rows = root()?.querySelectorAll("#uaiCompanionMessages .uai-c-message-row.assistant") || []; const row = rows.length ? rows[rows.length - 1] : null; return String(row?.querySelector(".uai-c-bubble")?.textContent || "").trim(); }
  function onGenerationChange() { const disabled = Boolean(observedInput?.disabled); stageHost?.classList.toggle("is-thinking", disabled); if (!disabled) { const text = lastAssistantText(); if (text) setEmotion(classifyEmotion(text)); } }
  function bindGenerationObserver() { const input = root()?.querySelector("#uaiCompanionInput"); if (!input || input === observedInput) return; generationObserver?.disconnect?.(); observedInput = input; generationObserver = new MutationObserver(onGenerationChange); generationObserver.observe(input, { attributes: true, attributeFilter: ["disabled"] }); }

  async function open() { if (!root()) return false; openState = true; ensureStageHost(); return loadCharacter(); }
  function close() { openState = false; destroyStage(); return true; }

  function setModelForCharacter(characterId, url, options = {}) {
    const id = String(characterId || activeCharacter().id || "").trim();
    const modelUrl = String(url || "").trim();
    if (!id || !modelUrl) return false;
    const map = assignments(); map[id] = { ...options, model: modelUrl }; localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(map)); availabilityCache.delete(modelUrl);
    if (openState && id === activeCharacter().id) loadCharacter({ resetConfig: true });
    return true;
  }

  function clearModelForCharacter(characterId) {
    const id = String(characterId || activeCharacter().id || "").trim();
    const map = assignments();
    if (!id || !Object.prototype.hasOwnProperty.call(map, id)) return false;
    delete map[id]; localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(map)); configPromise = null;
    if (openState && id === activeCharacter().id) loadCharacter({ resetConfig: true });
    return true;
  }

  function refresh() {
    const host = root();
    if (!host) { openState = false; destroyStage(); return false; }
    if (!openState) openState = true;
    ensureStageHost(); bindVoiceObserver(); bindGenerationObserver(); loadCharacter(); return true;
  }

  window.addEventListener("uai:companion-core-entered", refresh);
  window.addEventListener("uai:companion-functions-ready", refresh);
  window.addEventListener("uai:mode-refresh", refresh);
  window.addEventListener("storage", (event) => { if ([ACTIVE_KEY, ASSIGNMENTS_KEY, "uai_companion_characters_v1"].includes(event.key)) { configPromise = null; refresh(); } });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { stopMouthAnimation(); try { app?.ticker?.stop?.(); } catch {} } else if (openState && root()) { try { app?.ticker?.start?.(); } catch {} resizeRenderer(); fitModel(); syncVoiceState(); } });
  window.addEventListener("pagehide", () => { openState = false; destroyStage(); }, { passive: true });

  document.documentElement.dataset.companionStageV1712Revision = REVISION;
  window.UnlimitedCompanionStageV1712 = {
    revision: REVISION, open, close, refresh, setEmotion, setMouthOpen, setModelForCharacter, clearModelForCharacter,
    getModel: () => model,
    getStatus: () => ({ open: openState, state: status, model: modelSpec?.model || "", integrated: true }),
    get rendererHealthy() { return rendererHealthy(); }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
})();