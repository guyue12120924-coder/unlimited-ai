// V17.21 emotional companion voice: low-latency lookahead, emotion continuity and A/B preview.
(() => {
  const REVISION = "2026-08-23-v17.21-voice-experience-polish";
  if (window.UnlimitedCompanionVoiceV1711?.revision === REVISION) return;

  const KEY = "uai_companion_neural_voice_v1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  const MOMENTS_KEY = "uai_companion_moments_v1";
  const CALL_KEY = "uai_companion_call_mode_v1";
  const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA";
  const PREVIEW_TEXT = "晚上好呀……你终于来了。今天过得怎么样？如果有点累，就先靠过来陪我待一会儿吧。";

  const VOICES = {
    eve: { label: "Eve", subtitle: "明亮 · 灵动 · 少女感" },
    ara: { label: "Ara", subtitle: "温柔 · 轻缓 · 治愈" },
    sal: { label: "Sal", subtitle: "自然 · 松弛 · 日常" },
    rex: { label: "Rex", subtitle: "沉稳 · 自信 · 低调" },
    leo: { label: "Leo", subtitle: "成熟 · 低沉 · 克制" }
  };

  const PERSONAS = {
    sweet: { icon: "💗", label: "甜美陪伴", subtitle: "轻盈、有亲近感", voiceId: "eve", rate: .95 },
    gentle: { icon: "🌸", label: "温柔治愈", subtitle: "更慢、更柔和", voiceId: "ara", rate: .92 },
    natural: { icon: "☕", label: "自然日常", subtitle: "像真实聊天", voiceId: "sal", rate: .97 },
    mature: { icon: "🌙", label: "成熟温柔", subtitle: "沉静、不做作", voiceId: "ara", rate: .89 },
    lively: { icon: "✨", label: "活泼元气", subtitle: "更明快、更有起伏", voiceId: "eve", rate: 1.01 },
    custom: { icon: "🎛", label: "自定义", subtitle: "使用下方手动参数", voiceId: "eve", rate: .95 }
  };

  const EMOTIONS = new Set(["neutral", "happy", "shy", "caring", "sad", "angry", "thinking"]);
  const EMOTION_PLAN = {
    neutral: { rate: 1, pause: 115, mouth: .72 },
    happy: { rate: 1.035, pause: 80, mouth: .84 },
    shy: { rate: .94, pause: 175, mouth: .58 },
    caring: { rate: .925, pause: 160, mouth: .62 },
    sad: { rate: .89, pause: 220, mouth: .50 },
    angry: { rate: 1.025, pause: 72, mouth: .80 },
    thinking: { rate: .91, pause: 205, mouth: .54 }
  };

  const DEFAULTS = {
    enabled: false,
    provider: "neural",
    engine: "grok",
    voiceId: "eve",
    persona: "sweet",
    playbackRate: .95,
    speechMode: "natural",
    emotionEnabled: true,
    fallbackSystem: true
  };

  const ENGINES = new Set(["auto", "grok", "melo", "system"]);
  const SPEECH_MODES = new Set(["dialogue", "natural", "full"]);

  let playbackContext = null;
  let playbackSource = null;
  let fallbackAudio = null;
  let fallbackUrl = "";
  let audioUnlocked = false;
  let unlockPromise = null;
  let abortController = null;
  let playToken = 0;
  let mouthTimer = 0;
  let lastText = "";
  let lastPlan = [];
  let lastPlaybackError = "";
  let neuralStatus = "unknown";
  let neuralStatusText = "尚未检查神经语音";
  let lastStatusCheck = 0;
  let inputObserver = null;
  let observedInput = null;
  let wasGenerating = false;
  let lastAutoReadText = "";
  let autoReadSuppressed = false;

  function root() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const host = document.getElementById("uaiCompanionRoot");
    return host && !host.hidden && host.isConnected ? host : null;
  }

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function activeCharacterId() {
    return window.UnlimitedCompanionMulti?.activeCharacterId || localStorage.getItem(ACTIVE_KEY) || "legacy";
  }

  function settingsMap() {
    const value = safeParse(localStorage.getItem(KEY), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function normalizeSettings(stored = {}) {
    const raw = stored && typeof stored === "object" ? stored : {};
    const legacyProfile = !Object.hasOwn(raw, "voiceId") && !Object.hasOwn(raw, "persona") && !Object.hasOwn(raw, "engine");
    const legacyProvider = String(raw.provider || "");
    let engine = String(raw.engine || "").toLowerCase();
    if (!ENGINES.has(engine)) engine = legacyProvider === "system" ? "system" : "grok";
    const voiceId = Object.hasOwn(VOICES, String(raw.voiceId || "")) ? String(raw.voiceId) : DEFAULTS.voiceId;
    const persona = Object.hasOwn(PERSONAS, String(raw.persona || "")) ? String(raw.persona) : (voiceId === "eve" ? "sweet" : "custom");
    const speechMode = SPEECH_MODES.has(String(raw.speechMode || "")) ? String(raw.speechMode) : DEFAULTS.speechMode;
    const playbackRate = legacyProfile
      ? DEFAULTS.playbackRate
      : Math.max(.82, Math.min(1.12, Number(raw.playbackRate) || (PERSONAS[persona]?.rate ?? DEFAULTS.playbackRate)));
    return {
      ...DEFAULTS,
      ...raw,
      enabled: Boolean(raw.enabled),
      provider: engine === "system" ? "system" : engine === "auto" ? "auto" : "neural",
      engine,
      voiceId,
      persona,
      playbackRate,
      speechMode,
      emotionEnabled: raw.emotionEnabled !== false,
      fallbackSystem: raw.fallbackSystem !== false,
      dialogueOnly: speechMode !== "full"
    };
  }

  function getSettings() { return normalizeSettings(settingsMap()[activeCharacterId()]); }

  function syncCallStorage(settings) {
    const map = safeParse(localStorage.getItem(CALL_KEY), {});
    const safeMap = map && typeof map === "object" && !Array.isArray(map) ? map : {};
    const id = activeCharacterId();
    safeMap[id] = {
      ...(safeMap[id] && typeof safeMap[id] === "object" ? safeMap[id] : {}),
      engine: settings.engine,
      voiceId: settings.voiceId,
      playbackRate: settings.playbackRate,
      persona: settings.persona,
      speechMode: settings.speechMode,
      emotionEnabled: settings.emotionEnabled
    };
    localStorage.setItem(CALL_KEY, JSON.stringify(safeMap));
  }

  function dispatchProfile(settings) {
    syncCallStorage(settings);
    window.dispatchEvent(new CustomEvent("uai:companion-voice-profile", {
      detail: { characterId: activeCharacterId(), settings: { ...settings }, revision: REVISION }
    }));
  }

  function setSettings(patch = {}) {
    const map = settingsMap();
    const previous = getSettings();
    let nextPatch = { ...patch };
    if (Object.hasOwn(patch, "persona") && Object.hasOwn(PERSONAS, String(patch.persona))) {
      const persona = PERSONAS[String(patch.persona)];
      nextPatch = { ...nextPatch, voiceId: persona.voiceId, playbackRate: persona.rate };
    }
    if ((Object.hasOwn(patch, "voiceId") || Object.hasOwn(patch, "playbackRate")) && !Object.hasOwn(patch, "persona")) nextPatch.persona = "custom";
    const next = normalizeSettings({ ...previous, ...nextPatch });
    map[activeCharacterId()] = next;
    localStorage.setItem(KEY, JSON.stringify(map));
    dispatchProfile(next);
    if (!next.enabled && !autoReadSuppressed) stop({ keepLast: true });
    refreshUi();
    return next;
  }

  function showToast(message) {
    const host = root();
    if (!host) return;
    let toast = host.querySelector("#uaiCompanionToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "uaiCompanionToast";
      toast.className = "uai-c-toast";
      host.appendChild(toast);
    }
    toast.textContent = String(message || "");
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function ensureFallbackAudio() {
    if (fallbackAudio) return fallbackAudio;
    const audio = document.createElement("audio");
    audio.id = "uaiCompanionVoiceAudioV1721";
    audio.preload = "auto";
    audio.playsInline = true;
    audio.setAttribute("playsinline", "");
    audio.setAttribute("webkit-playsinline", "");
    audio.style.display = "none";
    document.body.appendChild(audio);
    fallbackAudio = audio;
    return audio;
  }

  function ensurePlaybackContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!playbackContext || playbackContext.state === "closed") playbackContext = new AudioCtx();
    return playbackContext;
  }

  function unlockAudio() {
    const context = ensurePlaybackContext();
    try { context?.resume?.(); } catch {}
    const audio = ensureFallbackAudio();
    if (audioUnlocked) return Promise.resolve(true);
    if (unlockPromise) return unlockPromise;
    const previousVolume = audio.volume;
    audio.volume = .01;
    audio.src = SILENT_WAV;
    try {
      unlockPromise = Promise.resolve(audio.play()).then(() => {
        audio.pause();
        try { audio.currentTime = 0; } catch {}
        audio.removeAttribute("src");
        audio.load();
        audio.volume = previousVolume || 1;
        audioUnlocked = true;
        lastPlaybackError = "";
        return true;
      }).catch((error) => {
        audio.volume = previousVolume || 1;
        lastPlaybackError = error?.message || "audio unlock failed";
        return false;
      }).finally(() => { unlockPromise = null; });
      return unlockPromise;
    } catch (error) {
      audio.volume = previousVolume || 1;
      lastPlaybackError = error?.message || "audio unlock failed";
      return Promise.resolve(false);
    }
  }

  function setVoiceState(state = "", emotion = "neutral") {
    const host = root();
    if (!host) return;
    if (state) host.dataset.v1711VoiceState = state;
    else delete host.dataset.v1711VoiceState;
    if (emotion && EMOTIONS.has(emotion)) host.dataset.v1720VoiceEmotion = emotion;
    else delete host.dataset.v1720VoiceEmotion;
    host.dispatchEvent(new CustomEvent("uai:companion-voice-state", {
      bubbles: false,
      detail: { state, emotion, revision: REVISION }
    }));
    refreshUi();
  }

  function classifyEmotion(text) {
    const source = String(text || "");
    const tests = [
      ["shy", /害羞|脸红|羞|不好意思|嘿嘿|唔|笨蛋|才没有|别看|人家/],
      ["caring", /担心|别怕|没事|陪你|抱抱|辛苦|早点休息|照顾|难受|我在|乖/],
      ["sad", /难过|伤心|委屈|想哭|哭了|失落|孤单|寂寞|对不起|舍不得/],
      ["angry", /生气|讨厌|哼|不许|气死|可恶|坏蛋|别闹|烦死/],
      ["happy", /开心|高兴|喜欢|太好|哈哈|嘿嘿|耶|真棒|好呀|当然|终于/],
      ["thinking", /让我想想|想一想|也许|可能|等等|唔……|嗯……|我想|应该/]
    ];
    for (const [emotion, pattern] of tests) if (pattern.test(source)) return emotion;
    const inherited = String(root()?.dataset.v1715Emotion || "");
    return EMOTIONS.has(inherited) ? inherited : "neutral";
  }

  function stripMarkup(text) {
    return String(text || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[_#>`~]/g, " ")
      .replace(/\r/g, "");
  }

  function extractSpeechText(text, settings = getSettings()) {
    let source = stripMarkup(text);
    if (settings.speechMode === "dialogue") {
      source = source
        .replace(/\[[^\]]{1,180}\]/g, " ")
        .replace(/【[^】]{1,180}】/g, " ")
        .replace(/（[^）]{1,260}）/g, " ")
        .replace(/\([^)]{1,260}\)/g, " ")
        .replace(/\*[^*]{1,260}\*/g, " ");
    } else if (settings.speechMode === "natural") {
      source = source
        .replace(/\[[^\]]{1,160}\]/g, "。")
        .replace(/【[^】]{1,160}】/g, "。")
        .replace(/（[^）]{1,260}）/g, "，")
        .replace(/\([^)]{1,260}\)/g, "，")
        .replace(/\*[^*]{1,260}\*/g, "，");
    }
    return source
      .replace(/\*/g, " ")
      .replace(/\.{3,}/g, "……")
      .replace(/,{2,}/g, "，")
      .replace(/\s*\n+\s*/g, "。")
      .replace(/\s+/g, " ")
      .replace(/([，。！？；])\1+/g, "$1")
      .trim()
      .slice(0, 1800);
  }

  function splitSpeechSegments(text, settings = getSettings()) {
    const cleaned = extractSpeechText(text, settings);
    if (!cleaned) return [];
    const raw = cleaned.match(/[^。！？!?；;…]+(?:……|[。！？!?；;])?|……/g) || [cleaned];
    const combined = [];
    let current = "";
    for (const pieceRaw of raw) {
      const piece = String(pieceRaw || "").trim();
      if (!piece) continue;
      if (!current) current = piece;
      else if ((current + piece).length <= 68 && current.length < 24) current += piece;
      else { combined.push(current); current = piece; }
    }
    if (current) combined.push(current);
    const result = [];
    for (const segment of combined) {
      if (segment.length <= 138) result.push(segment);
      else for (let index = 0; index < segment.length; index += 126) result.push(segment.slice(index, index + 126));
    }
    return result.filter(Boolean).slice(0, 10);
  }

  function buildSpeechPlan(text, overrideSettings = {}) {
    const settings = normalizeSettings({ ...getSettings(), ...overrideSettings });
    const segments = splitSpeechSegments(text, settings);
    const globalEmotion = settings.emotionEnabled ? classifyEmotion(text) : "neutral";
    let previousEmotion = globalEmotion;
    return segments.map((segment) => {
      let emotion = settings.emotionEnabled ? classifyEmotion(segment) : "neutral";
      if (emotion === "neutral") emotion = previousEmotion !== "neutral" ? previousEmotion : globalEmotion;
      if (!EMOTIONS.has(emotion)) emotion = "neutral";
      if (emotion !== "neutral") previousEmotion = emotion;
      const emotionConfig = EMOTION_PLAN[emotion] || EMOTION_PLAN.neutral;
      const punctuationPause = /[！？!?]$/.test(segment) ? -25 : /……$/.test(segment) ? 110 : /[。；;]$/.test(segment) ? 45 : 0;
      return {
        text: segment,
        emotion,
        rate: Math.max(.78, Math.min(1.12, settings.playbackRate * emotionConfig.rate)),
        pause: Math.max(45, emotionConfig.pause + punctuationPause),
        mouth: emotionConfig.mouth
      };
    });
  }

  async function checkStatus(force = false) {
    if (!force && Date.now() - lastStatusCheck < 30000 && neuralStatus !== "unknown") return neuralStatus === "ready";
    lastStatusCheck = Date.now();
    neuralStatus = "checking";
    neuralStatusText = "正在检查 Cloudflare 神经语音…";
    refreshUi();
    try {
      const response = await fetch(`/api/companion/tts/status?ts=${Date.now()}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      neuralStatus = response.ok && data.available ? "ready" : "unavailable";
      neuralStatusText = neuralStatus === "ready" ? "Grok / Melo 神经语音可用" : "神经语音暂不可用，可回退系统语音";
    } catch {
      neuralStatus = "unavailable";
      neuralStatusText = "神经语音连接失败，可回退系统语音";
    }
    refreshUi();
    return neuralStatus === "ready";
  }

  async function fetchTtsSegment(segment, settings, signal) {
    const response = await fetch("/api/companion/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: segment.text, lang: "zh", engine: settings.engine === "system" ? "auto" : settings.engine, voice_id: settings.voiceId }),
      signal,
      cache: "no-store"
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || `TTS HTTP ${response.status}`);
    }
    if (!String(response.headers.get("content-type") || "").includes("audio/")) throw new Error("TTS did not return audio");
    return response.blob();
  }

  function stopMouth() {
    if (mouthTimer) clearInterval(mouthTimer);
    mouthTimer = 0;
    try { window.UnlimitedCompanionStageV1712?.setMouthOpen?.(0); } catch {}
  }

  function startMouth(segment) {
    stopMouth();
    const api = window.UnlimitedCompanionStageV1712;
    try { api?.setEmotion?.(segment.emotion); } catch {}
    if (!api?.setMouthOpen) return;
    const ceiling = Math.max(.42, Math.min(.92, Number(segment.mouth) || .7));
    mouthTimer = setInterval(() => { try { api.setMouthOpen(.12 + Math.random() * ceiling); } catch {} }, 82);
  }

  function stopPlaybackOnly() {
    if (playbackSource) { try { playbackSource.stop(); } catch {} try { playbackSource.disconnect(); } catch {} }
    playbackSource = null;
    if (fallbackAudio) { try { fallbackAudio.pause(); } catch {} try { fallbackAudio.removeAttribute("src"); fallbackAudio.load(); } catch {} }
    if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
    fallbackUrl = "";
    stopMouth();
  }

  function stop(options = {}) {
    playToken += 1;
    abortController?.abort?.();
    abortController = null;
    stopPlaybackOnly();
    try { window.speechSynthesis?.cancel?.(); } catch {}
    setVoiceState("");
    if (!options.keepLast) { lastText = ""; lastPlan = []; }
  }

  function closePlaybackResources() {
    stop({ keepLast: true });
    try { playbackContext?.close?.(); } catch {}
    playbackContext = null;
    audioUnlocked = false;
    fallbackAudio?.remove?.();
    fallbackAudio = null;
  }

  function delay(ms, token) { return new Promise((resolve) => setTimeout(() => resolve(token === playToken), Math.max(0, ms || 0))); }

  async function playBlobWebAudio(blob, segment, token) {
    const context = ensurePlaybackContext();
    if (!context) throw new Error("WebAudio unavailable");
    await context.resume();
    if (context.state !== "running") throw new Error("AudioContext is not running");
    const buffer = await blob.arrayBuffer();
    if (token !== playToken) return false;
    const decoded = await context.decodeAudioData(buffer.slice(0));
    if (token !== playToken) return false;
    return new Promise((resolve, reject) => {
      const source = context.createBufferSource();
      playbackSource = source;
      source.buffer = decoded;
      source.playbackRate.value = segment.rate;
      source.connect(context.destination);
      source.onended = () => { if (playbackSource === source) playbackSource = null; try { source.disconnect(); } catch {} stopMouth(); resolve(token === playToken); };
      try { startMouth(segment); source.start(0); }
      catch (error) { stopMouth(); if (playbackSource === source) playbackSource = null; reject(error); }
    });
  }

  async function playBlobAudio(blob, segment, token) {
    if (token !== playToken) return false;
    const audio = ensureFallbackAudio();
    const url = URL.createObjectURL(blob);
    if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
    fallbackUrl = url;
    audio.src = url;
    audio.volume = 1;
    audio.playbackRate = segment.rate;
    try {
      await audio.play();
      audioUnlocked = true;
      startMouth(segment);
      await new Promise((resolve, reject) => {
        const cleanup = () => { audio.removeEventListener("ended", onEnd); audio.removeEventListener("error", onError); };
        const onEnd = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error("Audio playback failed")); };
        audio.addEventListener("ended", onEnd, { once: true });
        audio.addEventListener("error", onError, { once: true });
      });
      return token === playToken;
    } finally {
      stopMouth();
      if (fallbackUrl === url) fallbackUrl = "";
      URL.revokeObjectURL(url);
    }
  }

  async function playBlob(blob, segment, token) {
    try { return await playBlobWebAudio(blob, segment, token); }
    catch (webError) {
      try { return await playBlobAudio(blob, segment, token); }
      catch (audioError) {
        lastPlaybackError = audioError?.message || webError?.message || "声音播放失败";
        throw new Error(/play|gesture|allowed/i.test(lastPlaybackError) ? "浏览器拦截了声音，请再次点击语音按钮" : lastPlaybackError);
      }
    }
  }

  async function systemSpeakPlan(plan, token) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
    window.speechSynthesis.cancel();
    for (const segment of plan) {
      if (token !== playToken) return false;
      setVoiceState("speaking", segment.emotion);
      const ok = await new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(segment.text);
        utterance.lang = "zh-CN";
        utterance.rate = segment.rate;
        const voices = window.speechSynthesis.getVoices?.() || [];
        const zh = voices.find((voice) => /^zh(?:-|_)/i.test(voice.lang || ""));
        if (zh) utterance.voice = zh;
        utterance.onstart = () => startMouth(segment);
        utterance.onend = () => { stopMouth(); resolve(true); };
        utterance.onerror = () => { stopMouth(); resolve(false); };
        window.speechSynthesis.speak(utterance);
      });
      if (!ok || token !== playToken) return false;
      await delay(segment.pause, token);
    }
    if (token === playToken) setVoiceState("");
    return token === playToken;
  }

  async function playNeuralPlan(plan, settings, token, controller) {
    const pending = new Map();
    const queue = (index) => {
      if (index < 0 || index >= plan.length || pending.has(index)) return;
      pending.set(index, fetchTtsSegment(plan[index], settings, controller.signal)
        .then((blob) => ({ blob }))
        .catch((error) => ({ error })));
    };
    queue(0);
    queue(1);
    const replayPlan = [];
    for (let index = 0; index < plan.length; index += 1) {
      if (token !== playToken || controller.signal.aborted) return false;
      queue(index);
      const loaded = await pending.get(index);
      pending.delete(index);
      if (loaded?.error) throw loaded.error;
      queue(index + 1);
      queue(index + 2);
      const segment = plan[index];
      replayPlan.push({ ...segment, blob: loaded.blob });
      setVoiceState("speaking", segment.emotion);
      await playBlob(loaded.blob, segment, token);
      if (token !== playToken) return false;
      await delay(segment.pause, token);
    }
    lastPlan = replayPlan;
    if (token === playToken) setVoiceState("");
    return token === playToken;
  }

  async function speak(text, options = {}) {
    const settings = normalizeSettings({ ...getSettings(), ...(options.settings || {}) });
    if (!settings.enabled && !options.force) return false;
    const plan = buildSpeechPlan(text, settings);
    if (!plan.length) return false;
    stop({ keepLast: true });
    const token = ++playToken;
    lastText = extractSpeechText(text, settings);
    lastPlan = [];
    lastPlaybackError = "";
    if (settings.engine === "system") return systemSpeakPlan(plan, token);
    setVoiceState("loading", plan[0]?.emotion || "neutral");
    const controller = new AbortController();
    abortController = controller;
    try {
      // No preflight status request here: the first TTS segment starts immediately.
      const ok = await playNeuralPlan(plan, settings, token, controller);
      if (controller === abortController) abortController = null;
      neuralStatus = "ready";
      lastStatusCheck = Date.now();
      neuralStatusText = `${VOICES[settings.voiceId]?.label || settings.voiceId} · 情绪语音已就绪`;
      refreshUi();
      return ok;
    } catch (error) {
      if (controller === abortController) abortController = null;
      if (error?.name === "AbortError" || token !== playToken) return false;
      lastPlaybackError = error?.message || "神经语音播放失败";
      neuralStatus = "unavailable";
      lastStatusCheck = Date.now();
      neuralStatusText = /浏览器拦截/.test(lastPlaybackError) ? lastPlaybackError : "本次神经语音失败，准备回退系统语音";
      if (settings.fallbackSystem) { const fallbackToken = ++playToken; return systemSpeakPlan(plan, fallbackToken); }
      setVoiceState("");
      showToast(lastPlaybackError);
      return false;
    }
  }

  async function previewVoice(settingsPatch, label = "试听") {
    await unlockAudio();
    showToast(`${label} · 只试听，不修改角色声音`);
    return speak(PREVIEW_TEXT, { force: true, settings: { enabled: true, ...settingsPatch } });
  }

  async function replay() {
    const settings = getSettings();
    if (lastPlan.length && lastPlan.every((item) => item.blob) && settings.engine !== "system") {
      stop({ keepLast: true });
      const token = ++playToken;
      for (const item of lastPlan) {
        if (token !== playToken) return false;
        setVoiceState("speaking", item.emotion);
        await playBlob(item.blob, item, token);
        await delay(item.pause, token);
      }
      if (token === playToken) setVoiceState("");
      return token === playToken;
    }
    return lastText ? speak(lastText, { force: true }) : false;
  }

  function lastAssistantText() {
    const rows = root()?.querySelectorAll("#uaiCompanionMessages .uai-c-message-row.assistant") || [];
    const row = rows.length ? rows[rows.length - 1] : null;
    return String(row?.querySelector(".uai-c-bubble")?.textContent || "").trim();
  }

  function isGenerating() { return Boolean(root()?.querySelector("#uaiCompanionInput:disabled")); }

  function maybeAutoRead() {
    const generating = isGenerating();
    if (wasGenerating && !generating && !autoReadSuppressed) {
      const text = lastAssistantText();
      if (text && text !== lastAutoReadText && getSettings().enabled) {
        lastAutoReadText = text;
        setTimeout(() => { if (root() && !isGenerating() && !autoReadSuppressed) speak(text); }, 100);
      }
    }
    if (generating && !wasGenerating) stop({ keepLast: true });
    wasGenerating = generating;
    refreshUi();
  }

  function bindInputObserver() {
    const input = root()?.querySelector("#uaiCompanionInput");
    if (!input || input === observedInput) return;
    inputObserver?.disconnect?.();
    observedInput = input;
    wasGenerating = Boolean(input.disabled);
    inputObserver = new MutationObserver(maybeAutoRead);
    inputObserver.observe(input, { attributes: true, attributeFilter: ["disabled"] });
  }

  function setAutoReadSuppressed(value) {
    autoReadSuppressed = Boolean(value);
    if (autoReadSuppressed) stop({ keepLast: true });
    refreshUi();
    return autoReadSuppressed;
  }

  function relationStats() {
    const state = window.UnlimitedCompanion?.getState?.() || {};
    const sessions = Array.isArray(state.sessions) ? state.sessions : [];
    const allMessages = sessions.flatMap((session) => Array.isArray(session.messages) ? session.messages : []);
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    const recentSessions = sessions.filter((session) => Number(session.updatedAt || session.createdAt || 0) >= start.getTime());
    const recentMessages = recentSessions.flatMap((session) => Array.isArray(session.messages) ? session.messages : []);
    const map = safeParse(localStorage.getItem(MOMENTS_KEY), {});
    const moments = Array.isArray(map?.[activeCharacterId()]) ? map[activeCharacterId()] : [];
    const recentMoments = moments.filter((item) => Number(item.savedAt || item.createdAt || 0) >= start.getTime());
    return { totalSessions: sessions.length, totalMessages: allMessages.length, monthSessions: recentSessions.length, monthMessages: recentMessages.length, monthUserMessages: recentMessages.filter((item) => item?.role === "user").length, monthMoments: recentMoments.length, topics: recentSessions.filter((session) => session?.title && session.title !== "新的聊天").sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).slice(0, 5).map((session) => String(session.title).slice(0, 34)) };
  }

  function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function closeModal() { document.getElementById("uaiCompanionV1711Mask")?.remove(); }

  function syncVoicePanel(mask) {
    if (!mask?.isConnected) return;
    const settings = getSettings();
    const voice = mask.querySelector("[data-v1720-voice]");
    const engine = mask.querySelector("[data-v1720-engine]");
    const speechMode = mask.querySelector("[data-v1720-speech-mode]");
    const rate = mask.querySelector("[data-v1711-rate]");
    const rateLabel = mask.querySelector("[data-v1711-rate-label]");
    if (voice) voice.value = settings.voiceId;
    if (engine) engine.value = settings.engine;
    if (speechMode) speechMode.value = settings.speechMode;
    if (rate) rate.value = String(settings.playbackRate);
    if (rateLabel) rateLabel.textContent = `${settings.playbackRate.toFixed(2)}×`;
    mask.querySelectorAll("[data-v1720-persona]").forEach((item) => item.classList.toggle("active", item.dataset.v1720Persona === settings.persona));
    const current = mask.querySelector("[data-v1721-current-voice]");
    if (current) current.textContent = `${VOICES[settings.voiceId]?.label || settings.voiceId} · ${PERSONAS[settings.persona]?.label || "自定义"} · ${settings.playbackRate.toFixed(2)}×`;
  }

  function openVoicePanel() {
    closeModal(); unlockAudio();
    const settings = getSettings();
    const mask = document.createElement("div");
    mask.id = "uaiCompanionV1711Mask";
    mask.className = "uai-c-v1711-mask";
    mask.innerHTML = `<section class="uai-c-v1711-modal uai-c-v1720-voice-modal" role="dialog" aria-modal="true" aria-label="声音设置">
      <header><div><span>EMOTIONAL VOICE</span><h3>角色声音</h3><p>自动朗读、手动朗读和通话共享同一份角色声音档案。</p></div><button type="button" data-v1711-close>×</button></header>
      <div class="uai-c-v1711-field switch"><div><strong>自动朗读新回复</strong><small>回复完成后按情绪分句朗读，不会整段机械念稿。</small></div><label><input data-v1711-enabled type="checkbox" ${settings.enabled ? "checked" : ""}><i></i></label></div>
      <div class="uai-c-v1720-personas">${Object.entries(PERSONAS).filter(([id]) => id !== "custom").map(([id, item]) => `<button type="button" data-v1720-persona="${id}" class="${settings.persona === id ? "active" : ""}"><i>${item.icon}</i><strong>${item.label}</strong><small>${item.subtitle}</small></button>`).join("")}</div>
      <div class="uai-c-v1711-grid uai-c-v1720-grid">
        <label>底层音色<select data-v1720-voice>${Object.entries(VOICES).map(([id, item]) => `<option value="${id}">${item.label} · ${item.subtitle}</option>`).join("")}</select></label>
        <label>语音引擎<select data-v1720-engine><option value="grok">Grok TTS · 推荐</option><option value="auto">自动选择</option><option value="melo">MeloTTS</option><option value="system">浏览器系统语音</option></select></label>
        <label>基础语速 <b data-v1711-rate-label>${settings.playbackRate.toFixed(2)}×</b><input data-v1711-rate type="range" min="0.82" max="1.12" step="0.01" value="${settings.playbackRate}"></label>
        <label>朗读方式<select data-v1720-speech-mode><option value="natural">自然陪伴 · 推荐</option><option value="dialogue">只读对白</option><option value="full">完整朗读</option></select></label>
      </div>
      <div class="uai-c-v1711-checks"><label><input data-v1720-emotion type="checkbox" ${settings.emotionEnabled ? "checked" : ""}>根据回复情绪自动调整节奏和停顿</label><label><input data-v1711-fallback type="checkbox" ${settings.fallbackSystem ? "checked" : ""}>神经语音失败时自动回退系统语音</label></div>
      <div class="uai-c-v1720-preview"><div><span>当前声音</span><strong data-v1721-current-voice>${VOICES[settings.voiceId]?.label || settings.voiceId} · ${PERSONAS[settings.persona]?.label || "自定义"} · ${settings.playbackRate.toFixed(2)}×</strong><small>每个 AI 角色单独保存，切换角色会一起切换声音。</small></div><button type="button" data-v1711-preview>▶ 试听当前声音</button></div>
      <div class="uai-c-v1721-compare"><div><span>A / B 快速试听</span><small>只试听，不会修改当前角色的声音设置。</small></div><button type="button" data-v1721-ab="eve"><b>A</b><strong>Eve</strong><small>甜美灵动 · 0.95×</small></button><button type="button" data-v1721-ab="ara"><b>B</b><strong>Ara</strong><small>温柔治愈 · 0.92×</small></button></div>
      <div class="uai-c-v1711-status" data-v1711-status data-state="${neuralStatus}">${neuralStatusText}</div>
      <footer><small>首句直出 · 两句预取 · 情绪连续 · Live2D 嘴型同步</small><button type="button" data-v1711-recheck>重新检测</button><button type="button" data-v1711-stop>停止</button><button type="button" class="primary" data-v1711-preview2>再试听一次</button></footer>
    </section>`;
    document.body.appendChild(mask);
    mask.addEventListener("click", (event) => { if (event.target === mask) closeModal(); });
    mask.querySelector("[data-v1711-close]")?.addEventListener("click", closeModal);
    mask.querySelector("[data-v1711-enabled]")?.addEventListener("change", async (event) => { if (event.target.checked) await unlockAudio(); setSettings({ enabled: event.target.checked }); });
    mask.querySelector("[data-v1720-voice]")?.addEventListener("change", (event) => { setSettings({ voiceId: event.target.value }); syncVoicePanel(mask); });
    mask.querySelector("[data-v1720-engine]")?.addEventListener("change", (event) => { setSettings({ engine: event.target.value }); syncVoicePanel(mask); });
    mask.querySelector("[data-v1720-speech-mode]")?.addEventListener("change", (event) => { setSettings({ speechMode: event.target.value }); syncVoicePanel(mask); });
    mask.querySelectorAll("[data-v1720-persona]").forEach((button) => button.addEventListener("click", () => { setSettings({ persona: button.dataset.v1720Persona }); syncVoicePanel(mask); }));
    mask.querySelector("[data-v1711-rate]")?.addEventListener("input", (event) => { setSettings({ playbackRate: Number(event.target.value) }); syncVoicePanel(mask); });
    mask.querySelector("[data-v1720-emotion]")?.addEventListener("change", (event) => setSettings({ emotionEnabled: event.target.checked }));
    mask.querySelector("[data-v1711-fallback]")?.addEventListener("change", (event) => setSettings({ fallbackSystem: event.target.checked }));
    mask.querySelector("[data-v1711-recheck]")?.addEventListener("click", () => checkStatus(true));
    mask.querySelector("[data-v1711-stop]")?.addEventListener("click", () => stop({ keepLast: true }));
    const previewCurrent = () => previewVoice(getSettings(), "当前声音");
    for (const selector of ["[data-v1711-preview]", "[data-v1711-preview2]"]) {
      mask.querySelector(selector)?.addEventListener("pointerdown", unlockAudio, { passive: true });
      mask.querySelector(selector)?.addEventListener("click", previewCurrent);
    }
    mask.querySelector("[data-v1721-ab=\"eve\"]")?.addEventListener("pointerdown", unlockAudio, { passive: true });
    mask.querySelector("[data-v1721-ab=\"ara\"]")?.addEventListener("pointerdown", unlockAudio, { passive: true });
    mask.querySelector("[data-v1721-ab=\"eve\"]")?.addEventListener("click", () => previewVoice({ engine: "grok", voiceId: "eve", playbackRate: .95, persona: "custom", speechMode: "natural", emotionEnabled: true }, "A · Eve"));
    mask.querySelector("[data-v1721-ab=\"ara\"]")?.addEventListener("click", () => previewVoice({ engine: "grok", voiceId: "ara", playbackRate: .92, persona: "custom", speechMode: "natural", emotionEnabled: true }, "B · Ara"));
    syncVoicePanel(mask);
  }

  function openMonthlyReview() {
    closeModal();
    const stats = relationStats();
    const mask = document.createElement("div"); mask.id = "uaiCompanionV1711Mask"; mask.className = "uai-c-v1711-mask";
    const topics = stats.topics.length ? stats.topics.map((topic) => `<b>${escapeHtml(topic)}</b>`).join("") : "<small>这个月还没有形成明显的话题记录</small>";
    mask.innerHTML = `<section class="uai-c-v1711-modal" role="dialog" aria-modal="true" aria-label="本月关系回顾"><header><div><span>MONTHLY REVIEW</span><h3>本月回顾</h3><p>只根据当前浏览器里保存的陪伴会话与珍藏时刻整理。</p></div><button type="button" data-v1711-close>×</button></header><div class="uai-c-v1711-stats"><div><strong>${stats.monthSessions}</strong><span>本月会话</span></div><div><strong>${stats.monthMessages}</strong><span>本月消息</span></div><div><strong>${stats.monthUserMessages}</strong><span>你说的话</span></div><div><strong>${stats.monthMoments}</strong><span>珍藏时刻</span></div></div><div class="uai-c-v1711-topics"><span>最近聊过</span><div>${topics}</div></div><footer><small>累计 ${stats.totalSessions} 个会话 · ${stats.totalMessages} 条消息</small><button class="primary" type="button" data-v1711-close2>知道了</button></footer></section>`;
    document.body.appendChild(mask);
    mask.addEventListener("click", (event) => { if (event.target === mask) closeModal(); });
    mask.querySelector("[data-v1711-close]")?.addEventListener("click", closeModal);
    mask.querySelector("[data-v1711-close2]")?.addEventListener("click", closeModal);
  }

  function ensureDock() {
    const host = root(); const header = host?.querySelector(".uai-c-header"); if (!header) return null;
    let dock = header.querySelector("#uaiCompanionVoiceDockV1711");
    if (!dock) {
      dock = document.createElement("div"); dock.id = "uaiCompanionVoiceDockV1711"; dock.className = "uai-c-v1711-dock";
      dock.innerHTML = `<button id="uaiCompanionVoiceToggleV1711" type="button"><i>🔇</i><span>语音</span></button><button id="uaiCompanionMonthlyReviewV1711" type="button"><i>♡</i><span>本月回顾</span></button><button id="uaiCompanionVoiceStopV1711" type="button" title="停止播放">■</button>`;
      header.appendChild(dock);
      const toggle = dock.querySelector("#uaiCompanionVoiceToggleV1711");
      toggle?.addEventListener("pointerdown", unlockAudio, { passive: true });
      toggle?.addEventListener("click", async () => { const next = !getSettings().enabled; if (next) await unlockAudio(); setSettings({ enabled: next }); if (next) { lastPlaybackError = ""; showToast(`自动朗读已开启 · ${PERSONAS[getSettings().persona]?.label || VOICES[getSettings().voiceId]?.label}`); } });
      toggle?.addEventListener("contextmenu", (event) => { event.preventDefault(); openVoicePanel(); });
      dock.querySelector("#uaiCompanionMonthlyReviewV1711")?.addEventListener("click", openMonthlyReview);
      dock.querySelector("#uaiCompanionVoiceStopV1711")?.addEventListener("click", () => stop({ keepLast: true }));
    }
    return dock;
  }

  function refreshUi() {
    const host = root(); if (!host) return;
    const dock = ensureDock(); if (!dock) return;
    const settings = getSettings(); const state = host.dataset.v1711VoiceState || "";
    const toggle = dock.querySelector("#uaiCompanionVoiceToggleV1711"); const stopButton = dock.querySelector("#uaiCompanionVoiceStopV1711");
    if (toggle) {
      toggle.classList.toggle("active", settings.enabled);
      toggle.classList.toggle("loading", state === "loading");
      toggle.classList.toggle("speaking", state === "speaking");
      const icon = toggle.querySelector("i"); const label = toggle.querySelector("span");
      if (icon) icon.textContent = settings.enabled ? "🔊" : "🔇";
      if (label) label.textContent = state === "loading" ? "生成语音" : state === "speaking" ? "说话中" : "语音";
      toggle.title = lastPlaybackError || `声音：${VOICES[settings.voiceId]?.label || settings.voiceId} · ${PERSONAS[settings.persona]?.label || "自定义"} · 右键打开设置`;
    }
    if (stopButton) stopButton.hidden = !state;
    const modal = document.querySelector("#uaiCompanionV1711Mask .uai-c-v1711-modal");
    const status = modal?.querySelector("[data-v1711-status]");
    if (status) { status.textContent = neuralStatusText; status.dataset.state = neuralStatus; }
  }

  function refresh() {
    const host = root();
    if (!host) { inputObserver?.disconnect?.(); inputObserver = null; observedInput = null; closeModal(); closePlaybackResources(); return; }
    const settings = getSettings(); dispatchProfile(settings); ensureDock(); bindInputObserver(); refreshUi();
  }

  window.addEventListener("uai:companion-core-entered", refresh);
  window.addEventListener("uai:companion-functions-ready", refresh);
  window.addEventListener("uai:mode-refresh", refresh);
  window.addEventListener("storage", (event) => { if (event.key === KEY || event.key === ACTIVE_KEY) refresh(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop({ keepLast: true }); else refresh(); });
  window.addEventListener("pagehide", closePlaybackResources, { passive: true });

  document.documentElement.dataset.companionVoiceV1711Revision = REVISION;
  window.UnlimitedCompanionVoiceV1711 = {
    revision: REVISION,
    voices: VOICES,
    personas: PERSONAS,
    getSettings,
    setSettings,
    checkStatus,
    extractSpeechText,
    splitSpeechSegments,
    buildSpeechPlan,
    classifyEmotion,
    unlockAudio,
    speak,
    previewVoice,
    stop,
    replay,
    refresh,
    setAutoReadSuppressed,
    get autoReadSuppressed() { return autoReadSuppressed; },
    get audioUnlocked() { return audioUnlocked || playbackContext?.state === "running"; },
    get lastPlaybackError() { return lastPlaybackError; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true }); else refresh();
})();