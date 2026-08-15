// Companion V12.17 — hands-free voice call, per-character voice profile and Live2D model controls.
(() => {
  if (window.UnlimitedCompanionCallMode) return;

  const REVISION = "2026-08-15-v12.17-call-mode-3";
  const KEY = "uai_companion_call_mode_v1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  const MODEL_KEY = "uai_companion_live2d_assignments_v1";
  const DEFAULTS = {
    autoSend: true,
    autoListen: true,
    voiceEnabled: true,
    dialogueOnly: true,
    voiceEngine: "auto",
    voiceId: "ara",
    playbackRate: 0.98,
    modelX: 0.80,
    modelY: 1.06,
    modelHeight: 0.98
  };
  const ENGINES = new Set(["auto", "grok", "melo", "system"]);
  const VOICES = new Set(["ara", "eve", "sal", "rex", "leo"]);
  const VOICE_LABELS = {
    ara: "Ara · 温柔暖声",
    eve: "Eve · 明亮活泼",
    sal: "Sal · 自然平衡",
    rex: "Rex · 沉稳自信",
    leo: "Leo · 成熟低沉"
  };

  let boundRoot = null;
  let observer = null;
  let scheduled = false;
  let callActive = false;
  let callStartedAt = 0;
  let callTimer = null;
  let resumeTimer = null;
  let lastMicState = "idle";
  let lastGenerating = false;
  let lastVoiceState = "";
  let sawGeneration = false;
  let originalFetch = null;
  let lastTtsEngine = "";
  let lastTtsVoice = "";

  function liveRoot() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const root = document.getElementById("uaiCompanionRoot");
    return root && !root.hidden && root.isConnected ? root : null;
  }

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function activeCharacterId() {
    return window.UnlimitedCompanionMulti?.activeCharacterId || localStorage.getItem(ACTIVE_KEY) || "legacy";
  }

  function activeCharacter() {
    const id = activeCharacterId();
    const list = window.UnlimitedCompanionMulti?.getCharacters?.() || [];
    const found = list.find((item) => String(item?.id) === String(id));
    if (found) return found;
    return { id, name: "她", relationship: "girlfriend" };
  }

  function defaultVoiceForCharacter() {
    const relationship = activeCharacter()?.relationship;
    if (relationship === "boyfriend") return "rex";
    if (relationship === "friend" || relationship === "confidant") return "sal";
    return "ara";
  }

  function readMap() {
    const value = safeParse(localStorage.getItem(KEY), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function getSettings() {
    const value = readMap()[activeCharacterId()];
    const merged = { ...DEFAULTS, voiceId: defaultVoiceForCharacter(), ...(value && typeof value === "object" ? value : {}) };
    if (!ENGINES.has(merged.voiceEngine)) merged.voiceEngine = "auto";
    if (!VOICES.has(merged.voiceId)) merged.voiceId = defaultVoiceForCharacter();
    merged.voiceEnabled = merged.voiceEnabled !== false;
    merged.dialogueOnly = merged.dialogueOnly !== false;
    merged.autoSend = merged.autoSend !== false;
    merged.autoListen = merged.autoListen !== false;
    merged.playbackRate = Math.max(.84, Math.min(1.16, Number(merged.playbackRate) || .98));
    merged.modelX = Math.max(.48, Math.min(.96, Number(merged.modelX) || .80));
    merged.modelY = Math.max(.72, Math.min(1.08, Number(merged.modelY) || 1.06));
    merged.modelHeight = Math.max(.46, Math.min(1.08, Number(merged.modelHeight) || .98));
    return merged;
  }

  function saveSettings(patch = {}) {
    const map = readMap();
    const id = activeCharacterId();
    const next = { ...getSettings(), ...patch };
    next.voiceEngine = ENGINES.has(String(next.voiceEngine)) ? String(next.voiceEngine) : "auto";
    next.voiceId = VOICES.has(String(next.voiceId)) ? String(next.voiceId) : defaultVoiceForCharacter();
    next.playbackRate = Math.max(.84, Math.min(1.16, Number(next.playbackRate) || .98));
    next.autoSend = Boolean(next.autoSend);
    next.autoListen = Boolean(next.autoListen);
    next.voiceEnabled = Boolean(next.voiceEnabled);
    next.dialogueOnly = Boolean(next.dialogueOnly);
    next.modelX = Math.max(.48, Math.min(.96, Number(next.modelX) || .80));
    next.modelY = Math.max(.72, Math.min(1.08, Number(next.modelY) || 1.06));
    next.modelHeight = Math.max(.46, Math.min(1.08, Number(next.modelHeight) || .98));
    map[id] = next;
    localStorage.setItem(KEY, JSON.stringify(map));
    syncVoiceProfile();
    refreshUi();
    return next;
  }

  function syncVoiceProfile() {
    const voice = window.UnlimitedCompanionNeuralVoice;
    if (!voice?.setSettings || !voice?.getSettings) return false;
    const settings = getSettings();
    const current = voice.getSettings() || {};
    const target = {
      enabled: settings.voiceEnabled,
      provider: settings.voiceEngine === "system" ? "system" : "auto",
      playbackRate: settings.playbackRate,
      dialogueOnly: settings.dialogueOnly
    };
    const same = Boolean(current.enabled) === Boolean(target.enabled)
      && String(current.provider || "auto") === target.provider
      && Math.abs((Number(current.playbackRate) || 1) - target.playbackRate) < .005
      && Boolean(current.dialogueOnly) === Boolean(target.dialogueOnly);
    if (!same) voice.setSettings(target);
    return true;
  }

  function installTtsFetchBridge() {
    if (window.__UAI_COMPANION_TTS_FETCH_BRIDGE__) return;
    originalFetch = window.fetch.bind(window);
    window.fetch = async function uaiCompanionFetch(input, init = {}) {
      let isTts = false;
      let requestInit = init;
      let selectedVoice = "";
      try {
        const rawUrl = typeof input === "string" ? input : input?.url;
        const url = new URL(rawUrl, location.href);
        const method = String(init?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();
        isTts = url.origin === location.origin && url.pathname === "/api/companion/tts" && method === "POST";
        if (isTts && typeof init.body === "string") {
          const body = JSON.parse(init.body);
          const settings = getSettings();
          body.engine = settings.voiceEngine === "system" ? "auto" : settings.voiceEngine;
          body.voice_id = settings.voiceId;
          selectedVoice = settings.voiceId;
          requestInit = { ...init, body: JSON.stringify(body) };
        }
      } catch {
        // Parsing/enrichment is optional; the original request is still sent exactly once.
        isTts = false;
        requestInit = init;
      }

      const response = await originalFetch(input, requestInit);
      if (isTts) {
        lastTtsEngine = response.headers.get("x-tts-engine") || "";
        lastTtsVoice = response.headers.get("x-tts-voice") || selectedVoice;
        window.dispatchEvent(new CustomEvent("uai:companion-tts-engine", {
          detail: { engine: lastTtsEngine, voice: lastTtsVoice, ok: response.ok }
        }));
        refreshUi();
      }
      return response;
    };
    window.__UAI_COMPANION_TTS_FETCH_BRIDGE__ = true;
  }

  function currentModelAssignment() {
    const map = safeParse(localStorage.getItem(MODEL_KEY), {});
    const value = map && typeof map === "object" ? map[activeCharacterId()] : null;
    return value && typeof value === "object" ? value : null;
  }

  function lastAssistantBubble(root = liveRoot()) {
    const rows = root?.querySelectorAll?.("#uaiCompanionMessages .uai-c-message-row.assistant");
    const row = rows?.length ? rows[rows.length - 1] : null;
    return String(row?.querySelector?.(".uai-c-bubble")?.textContent || "").trim();
  }

  function setStatus(text, state = "") {
    const root = liveRoot();
    const bar = root?.querySelector("#uaiCompanionCallBar");
    const label = bar?.querySelector("[data-call-status]");
    if (label && label.textContent !== text) label.textContent = text;
    if (bar && bar.dataset.state !== state) bar.dataset.state = state;
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function updateCallTimer() {
    const node = liveRoot()?.querySelector("#uaiCompanionCallBar [data-call-time]");
    if (node && callActive) node.textContent = formatDuration(Date.now() - callStartedAt);
  }

  function clearResumeTimer() {
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = null;
  }

  function startListeningSoon(delay = 650) {
    clearResumeTimer();
    if (!callActive || !getSettings().autoListen) return;
    resumeTimer = setTimeout(() => {
      resumeTimer = null;
      const root = liveRoot();
      if (!root || !callActive) return;
      const generating = Boolean(root.querySelector("#uaiCompanionComposerWrap.generating"));
      const voiceState = root.dataset.v15NeuralVoiceState || "";
      const micState = window.UnlimitedCompanionVoiceInput?.state || root.dataset.v16VoiceInputState || "idle";
      const input = root.querySelector("#uaiCompanionInput");
      if (generating || voiceState || ["requesting", "recording", "transcribing"].includes(micState)) return;
      if (!getSettings().autoSend && String(input?.value || "").trim()) return;
      setStatus("正在听你说话…", "listening");
      window.UnlimitedCompanionVoiceInput?.start?.();
    }, delay);
  }

  function sendRecognizedText() {
    const root = liveRoot();
    if (!root || !callActive || !getSettings().autoSend) return false;
    const input = root.querySelector("#uaiCompanionInput");
    const send = root.querySelector(".uai-c-send");
    if (!String(input?.value || "").trim() || !send || send.disabled) return false;
    setStatus("听清了，正在发送…", "sending");
    sawGeneration = false;
    send.click();
    return true;
  }

  function startCall() {
    const inputApi = window.UnlimitedCompanionVoiceInput;
    if (!inputApi?.supported?.()) {
      setStatus("当前浏览器无法使用麦克风", "error");
      return false;
    }
    callActive = true;
    callStartedAt = Date.now();
    sawGeneration = false;
    saveSettings({ voiceEnabled: true });
    const root = liveRoot();
    if (root) {
      root.dataset.v17CallMode = "active";
      ensureUi(root);
    }
    clearInterval(callTimer);
    callTimer = setInterval(updateCallTimer, 500);
    updateCallTimer();
    refreshUi();
    setStatus("正在打开麦克风…", "connecting");
    inputApi.start?.();
    return true;
  }

  function endCall() {
    callActive = false;
    sawGeneration = false;
    clearResumeTimer();
    clearInterval(callTimer);
    callTimer = null;
    try { window.UnlimitedCompanionVoiceInput?.cancel?.(); } catch {}
    try { window.UnlimitedCompanionNeuralVoice?.stop?.({ keepLast: true }); } catch {}
    const root = liveRoot();
    if (root) delete root.dataset.v17CallMode;
    refreshUi();
    return true;
  }

  function toggleCall() {
    return callActive ? endCall() : startCall();
  }

  function applyModelFromPanel(panel) {
    const api = window.UnlimitedCompanionLive2D;
    const url = String(panel?.querySelector("#uaiV17ModelUrl")?.value || "").trim();
    if (!api?.setModelForCharacter || !url) return false;
    const settings = saveSettings({
      modelX: Number(panel.querySelector("#uaiV17ModelX")?.value),
      modelY: Number(panel.querySelector("#uaiV17ModelY")?.value),
      modelHeight: Number(panel.querySelector("#uaiV17ModelHeight")?.value)
    });
    api.setModelForCharacter(activeCharacterId(), url, {
      idleMotionGroup: "Idle",
      tapMotionGroups: ["TapBody", "tap_body", "TouchBody"],
      position: { x: settings.modelX, y: settings.modelY, height: settings.modelHeight }
    });
    const status = panel.querySelector("[data-model-status]");
    if (status) status.textContent = "已应用，正在加载模型…";
    setTimeout(() => {
      const info = api.getStatus?.() || {};
      if (status) status.textContent = info.ready ? "Live2D 模型已加载" : (info.message || "正在尝试加载模型");
    }, 1800);
    return true;
  }

  function restoreModel(panel) {
    window.UnlimitedCompanionLive2D?.clearModelForCharacter?.(activeCharacterId());
    const input = panel?.querySelector("#uaiV17ModelUrl");
    if (input) input.value = "";
    const status = panel?.querySelector("[data-model-status]");
    if (status) status.textContent = "已恢复角色默认模型；正式模型不存在时使用官方 Mao 测试模型。";
  }

  function ensureHeaderButton(root) {
    const header = root.querySelector(".uai-c-header");
    let actions = header?.querySelector(".uai-c-v11-header-actions");
    if (!header) return;
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "uai-c-v11-header-actions";
      header.appendChild(actions);
    }
    let button = actions.querySelector("#uaiCompanionCallToggle");
    if (!button) {
      button = document.createElement("button");
      button.id = "uaiCompanionCallToggle";
      button.className = "uai-c-v17-call-toggle";
      button.type = "button";
      button.addEventListener("click", toggleCall);
      actions.prepend(button);
    }
    button.classList.toggle("active", callActive);
    const desired = callActive ? `<span>☎</span><b>通话中</b>` : `<span>☎</span><b>通话</b>`;
    if (button.innerHTML !== desired) button.innerHTML = desired;
  }

  function ensureCallBar(root) {
    const main = root.querySelector(".uai-c-main");
    if (!main) return;
    let bar = main.querySelector("#uaiCompanionCallBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "uaiCompanionCallBar";
      bar.className = "uai-c-v17-call-bar";
      bar.innerHTML = `
        <div class="uai-c-v17-call-pulse"><i></i><i></i><i></i></div>
        <div class="uai-c-v17-call-copy"><strong data-call-name></strong><span data-call-status>准备通话</span></div>
        <time data-call-time>00:00</time>
        <button type="button" data-call-listen title="继续听我说">🎙</button>
        <button type="button" data-call-end>挂断</button>`;
      bar.querySelector("[data-call-end]")?.addEventListener("click", endCall);
      bar.querySelector("[data-call-listen]")?.addEventListener("click", () => window.UnlimitedCompanionVoiceInput?.start?.());
      main.appendChild(bar);
    }
    const name = bar.querySelector("[data-call-name]");
    const copy = `正在和 ${activeCharacter()?.name || "她"} 通话`;
    if (name && name.textContent !== copy) name.textContent = copy;
    bar.hidden = !callActive;
  }

  function ensureSettingsPanel(root) {
    const mask = root.querySelector("#uaiCompanionModalMask");
    if (!mask || mask.hidden) return;
    const modal = mask.querySelector(".uai-c-modal");
    const reply = modal?.querySelector("#uaiCompanionReplyLength");
    if (!modal || !reply) return;
    let panel = modal.querySelector("#uaiCompanionV17CallPanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "uaiCompanionV17CallPanel";
      panel.className = "uai-c-v17-panel";
      panel.innerHTML = `
        <div class="uai-c-v17-panel-head"><div><strong>语音通话与角色声线</strong><span>Hands-free 通话；声线和模型按当前角色独立保存</span></div></div>
        <div class="uai-c-v17-checks"><label><input id="uaiV17VoiceEnabled" type="checkbox">自动朗读角色回复</label><label><input id="uaiV17DialogueOnly" type="checkbox">只朗读角色真正说出口的台词</label></div>
        <div class="uai-c-v17-grid">
          <label>语音引擎<select id="uaiV17Engine"><option value="auto">自动 · Grok → Melo</option><option value="grok">Grok 多声线</option><option value="melo">MeloTTS</option><option value="system">浏览器系统语音</option></select></label>
          <label>角色声线<select id="uaiV17Voice">${Object.entries(VOICE_LABELS).map(([id,label]) => `<option value="${id}">${label}</option>`).join("")}</select></label>
          <label class="range">语速 <b id="uaiV17RateLabel">0.98×</b><input id="uaiV17Rate" type="range" min="0.84" max="1.16" step="0.02"></label>
        </div>
        <div class="uai-c-v17-checks"><label><input id="uaiV17AutoSend" type="checkbox">语音识别后自动发送</label><label><input id="uaiV17AutoListen" type="checkbox">对方说完后自动继续听我说</label></div>
        <div class="uai-c-v17-actions"><button id="uaiV17Preview" type="button">试听当前声线</button><small data-voice-status>Grok 支持独立 voice；不可用时自动降级到 MeloTTS / 系统语音。</small></div>
        <div class="uai-c-v17-model">
          <div><strong>正式 Live2D 模型</strong><span>填写可访问的 .model3.json 地址；留空继续使用当前默认/官方测试模型</span></div>
          <input id="uaiV17ModelUrl" type="url" placeholder="https://.../character.model3.json 或 /live2d/...model3.json">
          <div class="uai-c-v17-model-sliders">
            <label>左右 <input id="uaiV17ModelX" type="range" min="0.48" max="0.96" step="0.01"></label>
            <label>上下 <input id="uaiV17ModelY" type="range" min="0.72" max="1.08" step="0.01"></label>
            <label>大小 <input id="uaiV17ModelHeight" type="range" min="0.46" max="1.08" step="0.01"></label>
          </div>
          <div class="uai-c-v17-actions"><button id="uaiV17ApplyModel" type="button">应用模型</button><button id="uaiV17RestoreModel" type="button">恢复默认</button><small data-model-status></small></div>
        </div>`;
      const anchor = modal.querySelector("#uaiCompanionV15VoicePanel") || reply.closest(".uai-c-field");
      anchor?.insertAdjacentElement("afterend", panel);
      panel.querySelector("#uaiV17VoiceEnabled")?.addEventListener("change", (event) => saveSettings({ voiceEnabled: event.target.checked }));
      panel.querySelector("#uaiV17DialogueOnly")?.addEventListener("change", (event) => saveSettings({ dialogueOnly: event.target.checked }));
      panel.querySelector("#uaiV17Engine")?.addEventListener("change", (event) => saveSettings({ voiceEngine: event.target.value }));
      panel.querySelector("#uaiV17Voice")?.addEventListener("change", (event) => saveSettings({ voiceId: event.target.value }));
      panel.querySelector("#uaiV17Rate")?.addEventListener("input", (event) => saveSettings({ playbackRate: Number(event.target.value) }));
      panel.querySelector("#uaiV17AutoSend")?.addEventListener("change", (event) => saveSettings({ autoSend: event.target.checked }));
      panel.querySelector("#uaiV17AutoListen")?.addEventListener("change", (event) => saveSettings({ autoListen: event.target.checked }));
      panel.querySelector("#uaiV17Preview")?.addEventListener("click", () => {
        saveSettings({ voiceEnabled: true });
        window.UnlimitedCompanionNeuralVoice?.speak?.("晚上好呀，我在这里。以后就用这个声音陪你聊天，好不好？", { force: true, preview: true });
      });
      panel.querySelector("#uaiV17ApplyModel")?.addEventListener("click", () => applyModelFromPanel(panel));
      panel.querySelector("#uaiV17RestoreModel")?.addEventListener("click", () => restoreModel(panel));
    }
    fillSettingsPanel(panel);
  }

  function fillSettingsPanel(panel) {
    if (!panel) return;
    const settings = getSettings();
    const assignment = currentModelAssignment();
    const setValue = (selector, value) => {
      const node = panel.querySelector(selector);
      if (node && String(node.value) !== String(value)) node.value = String(value);
    };
    setValue("#uaiV17Engine", settings.voiceEngine);
    setValue("#uaiV17Voice", settings.voiceId);
    setValue("#uaiV17Rate", settings.playbackRate);
    const rateLabel = panel.querySelector("#uaiV17RateLabel");
    if (rateLabel) rateLabel.textContent = `${settings.playbackRate.toFixed(2)}×`;
    const voiceEnabled = panel.querySelector("#uaiV17VoiceEnabled");
    const dialogueOnly = panel.querySelector("#uaiV17DialogueOnly");
    const autoSend = panel.querySelector("#uaiV17AutoSend");
    const autoListen = panel.querySelector("#uaiV17AutoListen");
    if (voiceEnabled) voiceEnabled.checked = settings.voiceEnabled;
    if (dialogueOnly) dialogueOnly.checked = settings.dialogueOnly;
    if (autoSend) autoSend.checked = settings.autoSend;
    if (autoListen) autoListen.checked = settings.autoListen;
    setValue("#uaiV17ModelUrl", assignment?.model || "");
    setValue("#uaiV17ModelX", assignment?.position?.x ?? settings.modelX);
    setValue("#uaiV17ModelY", assignment?.position?.y ?? settings.modelY);
    setValue("#uaiV17ModelHeight", assignment?.position?.height ?? settings.modelHeight);
    const voiceStatus = panel.querySelector("[data-voice-status]");
    if (voiceStatus) {
      const engineLabel = lastTtsEngine ? (lastTtsEngine === "grok" ? `Grok · ${VOICE_LABELS[lastTtsVoice] || lastTtsVoice}` : "MeloTTS") : "尚未实际生成语音";
      voiceStatus.textContent = `当前输出：${engineLabel}。Grok 不可用时会自动降级。`;
    }
  }

  function ensureUi(root) {
    ensureHeaderButton(root);
    ensureCallBar(root);
    ensureSettingsPanel(root);
    root.classList.add("uai-c-v17-call-ready");
  }

  function refreshUi() {
    const root = liveRoot();
    if (root) ensureUi(root);
  }

  function sync() {
    scheduled = false;
    const root = liveRoot();
    if (!root) return;
    bind(root);
    ensureUi(root);
    syncVoiceProfile();

    const micState = window.UnlimitedCompanionVoiceInput?.state || root.dataset.v16VoiceInputState || "idle";
    const generating = Boolean(root.querySelector("#uaiCompanionComposerWrap.generating"));
    const voiceState = root.dataset.v15NeuralVoiceState || "";

    // When playback really starts, refresh the Live2D expression/motion from the spoken reply.
    if (["speaking", "preview"].includes(voiceState) && !["speaking", "preview"].includes(lastVoiceState) && voiceState !== "preview") {
      const text = lastAssistantBubble(root);
      if (text) window.UnlimitedCompanionLive2DInteraction?.reactToText?.(text);
    }

    if (callActive) {
      if (generating) {
        sawGeneration = true;
        setStatus(`${activeCharacter()?.name || "她"} 正在想…`, "thinking");
      } else if (voiceState === "loading") {
        setStatus("正在准备她的声音…", "loading");
      } else if (["speaking", "preview"].includes(voiceState)) {
        setStatus(`${activeCharacter()?.name || "她"} 正在和你说话…`, "speaking");
      } else if (micState === "requesting") {
        setStatus("正在打开麦克风…", "connecting");
      } else if (micState === "recording") {
        setStatus("正在听你说话…", "listening");
      } else if (micState === "transcribing") {
        setStatus("正在听懂你刚才说的话…", "transcribing");
      } else if (micState === "done" && lastMicState !== "done") {
        if (!sendRecognizedText()) setStatus("已经转成文字，确认后发送", "ready");
      }

      if (lastGenerating && !generating && sawGeneration) startListeningSoon(1350);
      if (["speaking", "preview", "loading"].includes(lastVoiceState) && !voiceState && !generating) startListeningSoon(700);
    }

    lastMicState = micState;
    lastGenerating = generating;
    lastVoiceState = voiceState;
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  function bind(root) {
    if (boundRoot === root) return;
    observer?.disconnect?.();
    boundRoot = root;
    lastMicState = window.UnlimitedCompanionVoiceInput?.state || root.dataset.v16VoiceInputState || "idle";
    lastGenerating = Boolean(root.querySelector("#uaiCompanionComposerWrap.generating"));
    lastVoiceState = root.dataset.v15NeuralVoiceState || "";
    observer = new MutationObserver(schedule);
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "data-v15-neural-voice-state", "data-v16-voice-input-state"]
    });
  }

  function init() {
    installTtsFetchBridge();
    document.documentElement.dataset.companionCallModeRevision = REVISION;
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode", "class"]
    });
    window.addEventListener("storage", (event) => {
      if ([ACTIVE_KEY, KEY, MODEL_KEY].includes(event.key)) schedule();
    });
    window.addEventListener("uai:companion-tts-engine", schedule);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && callActive) endCall();
      else schedule();
    });
    window.addEventListener("pagehide", endCall, { passive: true });
    window.UnlimitedCompanionCallMode = {
      revision: REVISION,
      start: startCall,
      end: endCall,
      toggle: toggleCall,
      get active() { return callActive; },
      getSettings,
      setSettings: saveSettings,
      applyVoiceProfile: syncVoiceProfile,
      refresh: schedule
    };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();