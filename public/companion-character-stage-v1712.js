// V17.12 isolated character stage. Live2D is lazy, optional and never changes the core chat grid.
(() => {
  const REVISION = "2026-08-23-v17.12-isolated-character-stage";
  if (window.UnlimitedCompanionStageV1712) return;

  const CONFIG_URL = "/live2d/characters.json";
  const ASSIGNMENTS_KEY = "uai_companion_live2d_assignments_v1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  const PIXI_URL = "https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js";
  const PLUGIN_URL = "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js";
  const LOCAL_CORE_URL = "/live2d/vendor/live2dcubismcore.min.js";
  const OFFICIAL_CORE_URL = "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js";

  let openState = false;
  let stageHost = null;
  let canvas = null;
  let app = null;
  let model = null;
  let modelSpec = null;
  let runtimePromise = null;
  let configPromise = null;
  let loadToken = 0;
  let resizeObserver = null;
  let voiceObserver = null;
  let generationObserver = null;
  let observedInput = null;
  let mouthTimer = 0;
  let mouthValue = 0;
  let status = "idle";

  function root() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const host = document.getElementById("uaiCompanionRoot");
    return host && !host.hidden && host.isConnected ? host : null;
  }

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

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
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return false;
      const type = String(response.headers.get("content-type") || "");
      if (type.includes("text/html")) return false;
      const data = await response.json();
      return Boolean(data && typeof data === "object" && (data.FileReferences || data.fileReferences));
    } catch { return false; }
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
      if (!script) {
        script = document.createElement("script");
        script.id = id;
        script.async = false;
        script.src = src;
        document.body.appendChild(script);
      }
      const timer = setTimeout(() => reject(new Error(`Timed out loading ${src}`)), 12000);
      const finish = () => {
        clearTimeout(timer);
        ready() ? resolve() : reject(new Error(`Resource not initialized: ${src}`));
      };
      script.addEventListener("load", finish, { once: true });
      script.addEventListener("error", () => { clearTimeout(timer); reject(new Error(`Failed to load ${src}`)); }, { once: true });
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
    const host = stageHost;
    if (!host) return;
    host.dataset.state = next;
    const note = host.querySelector("[data-v1712-status]");
    if (note) {
      note.textContent = message || ({ loading: "正在唤醒角色…", ready: "角色已在线", fallback: "Live2D 暂不可用，已使用角色头像", error: "角色舞台加载失败" })[next] || "";
      note.hidden = next === "ready" && !message;
    }
  }

  function fallbackAvatar(message = "") {
    const profile = activeCharacter().profile || {};
    const fallback = stageHost?.querySelector("[data-v1712-fallback]");
    if (!fallback) return;
    fallback.hidden = false;
    const image = profile.avatarData || profile.avatar || "";
    fallback.innerHTML = image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(profile.name || "角色")}" />` : `<span>${String(profile.name || "AI").trim().slice(0, 1) || "♡"}</span><strong>${escapeHtml(profile.name || "AI 伙伴")}</strong>`;
    setStatus("fallback", message);
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function ensureStageHost() {
    const host = root();
    if (!host) return null;
    if (stageHost?.isConnected) return stageHost;
    stageHost = document.createElement("section");
    stageHost.id = "uaiCompanionStageV1712";
    stageHost.className = "uai-c-v1712-stage";
    stageHost.setAttribute("aria-label", "角色舞台");
    stageHost.innerHTML = `
      <header><div><small>CHARACTER STAGE</small><strong>${escapeHtml(activeCharacter().profile?.name || "AI 伙伴")}</strong></div><div><button type="button" data-v1712-reload title="重新加载角色">↻</button><button type="button" data-v1712-close title="关闭角色舞台">×</button></div></header>
      <div class="uai-c-v1712-viewport"><canvas data-v1712-canvas></canvas><div class="uai-c-v1712-fallback" data-v1712-fallback hidden></div><div class="uai-c-v1712-floor"></div><div class="uai-c-v1712-glow"></div><small class="uai-c-v1712-credit" data-v1712-credit hidden></small></div>
      <footer><span class="uai-c-v1712-online"><i></i><b data-v1712-status>正在准备角色舞台</b></span><small>拖动鼠标，她会看向你</small></footer>`;
    canvas = stageHost.querySelector("[data-v1712-canvas]");
    host.appendChild(stageHost);
    stageHost.querySelector("[data-v1712-close]")?.addEventListener("click", close);
    stageHost.querySelector("[data-v1712-reload]")?.addEventListener("click", () => loadCharacter(true));
    stageHost.querySelector(".uai-c-v1712-viewport")?.addEventListener("pointermove", focusPointer, { passive: true });
    stageHost.querySelector(".uai-c-v1712-viewport")?.addEventListener("pointerdown", tapModel, { passive: true });
    bindVoiceObserver();
    bindGenerationObserver();
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(() => { resizeRenderer(); fitModel(); });
      resizeObserver.observe(stageHost);
    }
    return stageHost;
  }

  function ensureLauncher() {
    const host = root();
    const header = host?.querySelector(".uai-c-header");
    if (!header) return;
    let button = header.querySelector("#uaiCompanionStageButtonV1712");
    if (!button) {
      button = document.createElement("button");
      button.id = "uaiCompanionStageButtonV1712";
      button.className = "uai-c-v1712-launch";
      button.type = "button";
      button.innerHTML = `<span>✦</span><b>角色舞台</b>`;
      button.addEventListener("click", () => openState ? close() : open());
      header.appendChild(button);
    }
    button.classList.toggle("active", openState);
  }

  function resizeRenderer() {
    if (!app || !stageHost) return;
    const viewport = stageHost.querySelector(".uai-c-v1712-viewport");
    const rect = viewport?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    app.renderer.resize(Math.round(rect.width), Math.round(rect.height));
  }

  function fitModel() {
    if (!model || !stageHost) return;
    const rect = stageHost.querySelector(".uai-c-v1712-viewport")?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    const position = modelSpec?.position || {};
    const heightRatio = Math.max(.55, Math.min(1.08, Number(position.height) || .94));
    const baseHeight = model.__uaiBaseHeight || model.height || 1;
    model.scale.set((rect.height * heightRatio) / Math.max(1, baseHeight));
    model.anchor?.set?.(.5, 1);
    model.x = rect.width * Math.max(.35, Math.min(.86, Number(position.x) || .58));
    model.y = rect.height * Math.max(.78, Math.min(1.08, Number(position.y) || 1.02));
  }

  function destroyModel() {
    loadToken += 1;
    stopMouthAnimation();
    if (model) {
      try { app?.stage?.removeChild?.(model); } catch {}
      try { model.destroy?.({ children: true }); } catch { try { model.destroy?.(); } catch {} }
    }
    model = null;
    modelSpec = null;
    if (app) {
      try { app.ticker?.stop?.(); } catch {}
      try { app.destroy?.(false, { children: true, texture: false, baseTexture: false }); } catch { try { app.destroy?.(); } catch {} }
    }
    app = null;
  }

  function destroyStage() {
    destroyModel();
    resizeObserver?.disconnect?.();
    resizeObserver = null;
    voiceObserver?.disconnect?.();
    voiceObserver = null;
    generationObserver?.disconnect?.();
    generationObserver = null;
    observedInput = null;
    stageHost?.remove();
    stageHost = null;
    canvas = null;
  }

  async function loadCharacter(force = false) {
    const host = root();
    if (!openState || !host) return false;
    ensureStageHost();
    const token = ++loadToken;
    setStatus("loading");
    const fallback = stageHost?.querySelector("[data-v1712-fallback]");
    if (fallback) fallback.hidden = true;
    try {
      const character = activeCharacter();
      if (force) configPromise = null;
      const configured = await resolveSpec(character);
      const selected = await selectAvailableSpec(configured);
      if (token !== loadToken || !openState) return false;
      if (!selected) {
        fallbackAvatar("没有找到可用的 Live2D 模型");
        return false;
      }
      await ensureRuntime();
      if (token !== loadToken || !openState) return false;
      destroyModel();
      loadToken = token;
      const PIXI = window.PIXI;
      if (!PIXI?.Application || !PIXI?.live2d?.Live2DModel) throw new Error("Live2D runtime unavailable");
      app = new PIXI.Application({ view: canvas, transparent: true, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2), backgroundAlpha: 0 });
      const loaded = await PIXI.live2d.Live2DModel.from(selected.model, { autoInteract: false, autoUpdate: true, idleMotionGroup: String(selected.idleMotionGroup || "Idle") });
      if (token !== loadToken || !openState) { try { loaded.destroy?.({ children: true }); } catch {}; return false; }
      model = loaded;
      modelSpec = selected;
      model.__uaiBaseHeight = model.height || 1;
      model.interactive = false;
      app.stage.addChild(model);
      resizeRenderer();
      fitModel();
      const credit = stageHost?.querySelector("[data-v1712-credit]");
      if (credit && selected.sample?.name) {
        credit.hidden = false;
        credit.textContent = `${selected.sample.name} · ${selected.sample.owner || "Live2D Inc."}`;
        credit.title = String(selected.sample.notice || "");
      }
      setStatus("ready");
      syncVoiceState();
      return true;
    } catch (error) {
      if (token !== loadToken || !openState) return false;
      console.warn("[Unlimited AI] V17.12 character stage degraded to avatar", error);
      destroyModel();
      fallbackAvatar(error?.message || "Live2D 加载失败");
      return false;
    }
  }

  function focusPointer(event) {
    if (!model || !stageHost) return;
    try { model.focus(event.clientX, event.clientY); } catch {}
  }

  function tapModel(event) {
    if (!model) return;
    try { model.tap(event.clientX, event.clientY); } catch {}
    const groups = Array.isArray(modelSpec?.tapMotionGroups) ? modelSpec.tapMotionGroups : ["TapBody"];
    for (const group of groups) {
      try { if (model.motion(group)) break; } catch {}
    }
  }

  function parameterIds() {
    try { return Array.from(model?.internalModel?.coreModel?.getModel?.()?.parameters?.ids || []).map(String); }
    catch { return []; }
  }

  function setMouthOpen(value) {
    if (!model) return false;
    const core = model.internalModel?.coreModel;
    if (typeof core?.setParameterValueById !== "function") return false;
    const ids = parameterIds();
    const mouthIds = ["ParamMouthOpenY", "ParamA", "PARAM_MOUTH_OPEN_Y"].filter((id) => !ids.length || ids.includes(id));
    mouthValue = Math.max(0, Math.min(1, Number(value) || 0));
    for (const id of mouthIds.length ? mouthIds : ["ParamMouthOpenY"]) {
      try { core.setParameterValueById(id, mouthValue, 1); } catch {}
    }
    return true;
  }

  function stopMouthAnimation() {
    if (mouthTimer) clearInterval(mouthTimer);
    mouthTimer = 0;
    setMouthOpen(0);
  }

  function startMouthAnimation() {
    if (!model || mouthTimer || document.hidden) return;
    mouthTimer = setInterval(() => {
      if (!openState || !model || document.hidden) return stopMouthAnimation();
      const wave = .2 + Math.random() * .7;
      setMouthOpen(wave);
    }, 90);
  }

  function syncVoiceState() {
    const voiceState = root()?.dataset.v1711VoiceState || "";
    if (voiceState === "speaking") startMouthAnimation(); else stopMouthAnimation();
  }

  function bindVoiceObserver() {
    const host = root();
    if (!host) return;
    voiceObserver?.disconnect?.();
    voiceObserver = new MutationObserver(syncVoiceState);
    voiceObserver.observe(host, { attributes: true, attributeFilter: ["data-v1711-voice-state"] });
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
    const expressions = modelSpec?.expressions?.[key] || ({ happy: ["happy", "smile", "joy"], shy: ["shy", "blush"], sad: ["sad"], angry: ["angry"], caring: ["gentle", "smile"], thinking: ["thinking", "serious"] })[key] || [];
    for (const name of Array.isArray(expressions) ? expressions : [expressions]) {
      try { if (await model.expression(name)) return true; } catch {}
    }
    const motions = modelSpec?.motions?.[key] || [];
    for (const group of Array.isArray(motions) ? motions : [motions]) {
      try { if (await model.motion(group)) return true; } catch {}
    }
    return false;
  }

  function lastAssistantText() {
    const rows = root()?.querySelectorAll("#uaiCompanionMessages .uai-c-message-row.assistant") || [];
    const row = rows.length ? rows[rows.length - 1] : null;
    return String(row?.querySelector(".uai-c-bubble")?.textContent || "").trim();
  }

  function onGenerationChange() {
    const disabled = Boolean(observedInput?.disabled);
    if (!disabled) {
      const text = lastAssistantText();
      if (text) setEmotion(classifyEmotion(text));
    }
  }

  function bindGenerationObserver() {
    const input = root()?.querySelector("#uaiCompanionInput");
    if (!input || input === observedInput) return;
    generationObserver?.disconnect?.();
    observedInput = input;
    generationObserver = new MutationObserver(onGenerationChange);
    generationObserver.observe(input, { attributes: true, attributeFilter: ["disabled"] });
  }

  async function open() {
    if (!root()) return false;
    openState = true;
    ensureLauncher();
    ensureStageHost();
    await loadCharacter();
    return true;
  }

  function close() {
    openState = false;
    destroyStage();
    ensureLauncher();
  }

  function setModelForCharacter(characterId, url, options = {}) {
    const id = String(characterId || activeCharacter().id || "").trim();
    const modelUrl = String(url || "").trim();
    if (!id || !modelUrl) return false;
    const map = assignments();
    map[id] = { ...options, model: modelUrl };
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(map));
    if (openState) loadCharacter(true);
    return true;
  }

  function clearModelForCharacter(characterId) {
    const id = String(characterId || activeCharacter().id || "").trim();
    const map = assignments();
    if (!id || !Object.prototype.hasOwnProperty.call(map, id)) return false;
    delete map[id];
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(map));
    if (openState) loadCharacter(true);
    return true;
  }

  function refresh() {
    if (!root()) {
      openState = false;
      destroyStage();
      return;
    }
    ensureLauncher();
    if (openState) loadCharacter(true);
  }

  window.addEventListener("uai:companion-core-entered", refresh);
  window.addEventListener("uai:companion-functions-ready", refresh);
  window.addEventListener("uai:mode-refresh", refresh);
  window.addEventListener("storage", (event) => { if ([ACTIVE_KEY, ASSIGNMENTS_KEY, "uai_companion_characters_v1"].includes(event.key)) refresh(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopMouthAnimation();
      try { app?.ticker?.stop?.(); } catch {}
    } else if (openState) {
      try { app?.ticker?.start?.(); } catch {}
      syncVoiceState();
    }
  });
  window.addEventListener("pagehide", () => { openState = false; destroyStage(); }, { passive: true });

  document.documentElement.dataset.companionStageV1712Revision = REVISION;
  window.UnlimitedCompanionStageV1712 = {
    revision: REVISION,
    open,
    close,
    refresh,
    setEmotion,
    setMouthOpen,
    setModelForCharacter,
    clearModelForCharacter,
    getModel: () => model,
    getStatus: () => ({ open: openState, state: status, model: modelSpec?.model || "" })
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
})();
