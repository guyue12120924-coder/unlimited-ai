// V17.14 companion call audio recovery. Keeps explicit-call auto-send isolated from normal chat.
(() => {
  const REVISION = "2026-08-23-v17.14-call-audio-recovery";
  if (window.UnlimitedCompanionCallV1713?.revision === REVISION) return;

  const KEY = "uai_companion_call_mode_v1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  const DEFAULTS = {
    autoSend: true,
    autoListen: true,
    speaker: true,
    engine: "auto",
    voiceId: "ara",
    playbackRate: .98,
    captions: true
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
  const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA";

  let callActive = false;
  let callStartedAt = 0;
  let callTimer = 0;
  let overlay = null;
  let generationObserver = null;
  let observedInput = null;
  let previousGenerating = false;

  let stream = null;
  let recorder = null;
  let chunks = [];
  let vadContext = null;
  let analyser = null;
  let vadFrame = 0;
  let recordDeadline = 0;
  let recordStartedAt = 0;
  let lastSoundAt = 0;
  let heardSpeech = false;
  let transcribeController = null;

  let playbackContext = null;
  let playbackSource = null;
  let fallbackAudio = null;
  let fallbackUrl = "";
  let audioUnlocked = false;
  let unlockPromise = null;
  let ttsController = null;
  let speechToken = 0;
  let mouthTimer = 0;
  let lastSpokenText = "";
  let lastPlaybackError = "";

  let muted = false;
  let lastAssistantText = "";
  let stageWasOpen = false;
  let previousAutoVoiceSetting = null;

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

  function activeProfile() {
    return window.UnlimitedCompanion?.getState?.()?.profile || {};
  }

  function readMap() {
    const value = safeParse(localStorage.getItem(KEY), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function defaultVoice() {
    const relationship = String(activeProfile()?.relationship || "");
    if (relationship === "boyfriend") return "rex";
    if (relationship === "friend" || relationship === "confidant") return "sal";
    return "ara";
  }

  function getSettings() {
    const stored = readMap()[activeCharacterId()];
    const value = { ...DEFAULTS, voiceId: defaultVoice(), ...(stored && typeof stored === "object" ? stored : {}) };
    value.autoSend = value.autoSend !== false;
    value.autoListen = value.autoListen !== false;
    value.speaker = value.speaker !== false;
    value.captions = value.captions !== false;
    value.engine = ENGINES.has(String(value.engine || value.voiceEngine)) ? String(value.engine || value.voiceEngine) : "auto";
    value.voiceId = VOICES.has(String(value.voiceId)) ? String(value.voiceId) : defaultVoice();
    value.playbackRate = Math.max(.84, Math.min(1.16, Number(value.playbackRate) || .98));
    return value;
  }

  function setSettings(patch = {}) {
    const map = readMap();
    const previous = getSettings();
    const next = { ...previous, ...patch };
    next.autoSend = Boolean(next.autoSend);
    next.autoListen = Boolean(next.autoListen);
    next.speaker = Boolean(next.speaker);
    next.captions = Boolean(next.captions);
    next.engine = ENGINES.has(String(next.engine)) ? String(next.engine) : "auto";
    next.voiceId = VOICES.has(String(next.voiceId)) ? String(next.voiceId) : defaultVoice();
    next.playbackRate = Math.max(.84, Math.min(1.16, Number(next.playbackRate) || .98));
    map[activeCharacterId()] = next;
    localStorage.setItem(KEY, JSON.stringify(map));
    refreshOverlay();
    return next;
  }

  function micSupported() {
    return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
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

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function ensureLauncher() {
    const host = root();
    const header = host?.querySelector(".uai-c-header");
    if (!header) return null;
    let button = header.querySelector("#uaiCompanionCallButtonV1713");
    if (!button) {
      button = document.createElement("button");
      button.id = "uaiCompanionCallButtonV1713";
      button.className = "uai-c-v1713-call-launch";
      button.type = "button";
      button.innerHTML = `<span>☎</span><b>通话</b>`;
      button.addEventListener("pointerdown", unlockPlayback, { passive: true });
      button.addEventListener("click", () => callActive ? endCall() : startCall());
      header.appendChild(button);
    }
    button.classList.toggle("active", callActive);
    return button;
  }

  function ensureFallbackAudio() {
    if (fallbackAudio) return fallbackAudio;
    const audio = document.createElement("audio");
    audio.id = "uaiCompanionCallAudioV1714";
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

  function unlockPlayback() {
    const context = ensurePlaybackContext();
    try { context?.resume?.(); } catch {}
    const audio = ensureFallbackAudio();
    if (audioUnlocked) return Promise.resolve(true);
    if (unlockPromise) return unlockPromise;
    const previousVolume = audio.volume;
    audio.volume = .01;
    audio.src = SILENT_WAV;
    try {
      const result = audio.play();
      unlockPromise = Promise.resolve(result).then(() => {
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

  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function updateTimer() {
    const node = overlay?.querySelector("[data-v1713-time]");
    if (node && callActive) node.textContent = formatDuration(Date.now() - callStartedAt);
  }

  function setCallState(state, text) {
    if (!overlay) return;
    overlay.dataset.state = state || "idle";
    const label = overlay.querySelector("[data-v1713-status]");
    if (label) label.textContent = text || "";
  }

  function setCaption(role, text) {
    if (!overlay || !getSettings().captions) return;
    const node = overlay.querySelector(`[data-v1713-caption="${role}"]`);
    if (!node) return;
    const value = String(text || "").trim();
    node.textContent = value || (role === "user" ? "你说的话会显示在这里" : "她的回复会显示在这里");
    node.parentElement?.classList.toggle("has-text", Boolean(value));
  }

  function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    const host = root();
    if (!host) return null;
    const profile = activeProfile();
    const settings = getSettings();
    overlay = document.createElement("section");
    overlay.id = "uaiCompanionCallV1713";
    overlay.className = "uai-c-v1713-call";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", `与${profile.name || "AI 伙伴"}通话`);
    overlay.innerHTML = `
      <div class="uai-c-v1713-call-bg"></div>
      <header><div><small>LIVE CALL</small><strong>${escapeHtml(profile.name || "AI 伙伴")}</strong><span><i></i><b data-v1713-status>正在连接…</b></span></div><div><time data-v1713-time>00:00</time><button type="button" data-v1713-settings title="通话设置">⚙</button></div></header>
      <main><div class="uai-c-v1713-stage-space" aria-hidden="true"></div><div class="uai-c-v1713-captions"><article><small>你</small><p data-v1713-caption="user">你说的话会显示在这里</p></article><article><small>${escapeHtml(profile.name || "她")}</small><p data-v1713-caption="assistant">她的回复会显示在这里</p></article></div></main>
      <div class="uai-c-v1713-settings" data-v1713-panel hidden>
        <label><span>语音引擎</span><select data-v1713-engine><option value="auto">自动</option><option value="grok">Grok TTS</option><option value="melo">MeloTTS</option><option value="system">浏览器系统语音</option></select></label>
        <label><span>角色声音</span><select data-v1713-voice>${Object.entries(VOICE_LABELS).map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select></label>
        <label><span>语速</span><input data-v1713-rate type="range" min="0.84" max="1.16" step="0.02" value="${settings.playbackRate}"></label>
        <label class="check"><input data-v1713-auto-send type="checkbox" ${settings.autoSend ? "checked" : ""}>识别后自动发送</label>
        <label class="check"><input data-v1713-auto-listen type="checkbox" ${settings.autoListen ? "checked" : ""}>回复结束后自动继续聆听</label>
        <label class="check"><input data-v1713-captions-toggle type="checkbox" ${settings.captions ? "checked" : ""}>显示通话字幕</label>
      </div>
      <footer><button type="button" class="secondary" data-v1713-mute><span>🎙</span><small>麦克风</small></button><button type="button" class="listen" data-v1713-listen><span>●</span><small>开始说话</small></button><button type="button" class="secondary" data-v1713-speaker><span>🔊</span><small>扬声器</small></button><button type="button" class="hangup" data-v1713-end><span>☎</span><small>挂断</small></button></footer>`;
    host.appendChild(overlay);

    overlay.querySelector("[data-v1713-end]")?.addEventListener("click", endCall);
    overlay.querySelector("[data-v1713-listen]")?.addEventListener("pointerdown", unlockPlayback, { passive: true });
    overlay.querySelector("[data-v1713-listen]")?.addEventListener("click", () => recorder ? finishRecording(false) : startListening(false));
    overlay.querySelector("[data-v1713-mute]")?.addEventListener("click", () => {
      muted = !muted;
      if (muted && recorder) finishRecording(true);
      refreshOverlay();
    });
    overlay.querySelector("[data-v1713-speaker]")?.addEventListener("pointerdown", unlockPlayback, { passive: true });
    overlay.querySelector("[data-v1713-speaker]")?.addEventListener("click", async () => {
      const next = !getSettings().speaker;
      setSettings({ speaker: next });
      if (!next) return stopSpeech();
      await unlockPlayback();
      if (callActive && lastSpokenText && lastPlaybackError) respondWithVoice(lastSpokenText, { retry: true });
    });
    overlay.querySelector("[data-v1713-settings]")?.addEventListener("click", () => {
      const panel = overlay?.querySelector("[data-v1713-panel]");
      if (panel) panel.hidden = !panel.hidden;
    });
    const engine = overlay.querySelector("[data-v1713-engine]");
    const voice = overlay.querySelector("[data-v1713-voice]");
    if (engine) engine.value = settings.engine;
    if (voice) voice.value = settings.voiceId;
    engine?.addEventListener("change", (event) => setSettings({ engine: event.target.value }));
    voice?.addEventListener("change", (event) => setSettings({ voiceId: event.target.value }));
    overlay.querySelector("[data-v1713-rate]")?.addEventListener("input", (event) => setSettings({ playbackRate: Number(event.target.value) }));
    overlay.querySelector("[data-v1713-auto-send]")?.addEventListener("change", (event) => setSettings({ autoSend: event.target.checked }));
    overlay.querySelector("[data-v1713-auto-listen]")?.addEventListener("change", (event) => setSettings({ autoListen: event.target.checked }));
    overlay.querySelector("[data-v1713-captions-toggle]")?.addEventListener("change", (event) => setSettings({ captions: event.target.checked }));
    refreshOverlay();
    return overlay;
  }

  function refreshOverlay() {
    ensureLauncher();
    if (!overlay) return;
    const settings = getSettings();
    const mute = overlay.querySelector("[data-v1713-mute]");
    const speaker = overlay.querySelector("[data-v1713-speaker]");
    const listen = overlay.querySelector("[data-v1713-listen]");
    if (mute) {
      mute.classList.toggle("off", muted);
      mute.querySelector("span").textContent = muted ? "🔇" : "🎙";
      mute.querySelector("small").textContent = muted ? "已静音" : "麦克风";
    }
    if (speaker) {
      speaker.classList.toggle("off", !settings.speaker);
      speaker.querySelector("span").textContent = settings.speaker ? "🔊" : "🔈";
      speaker.querySelector("small").textContent = settings.speaker ? "扬声器" : "已关闭";
    }
    if (listen) {
      listen.classList.toggle("recording", Boolean(recorder));
      listen.querySelector("small").textContent = recorder ? "正在聆听" : "开始说话";
    }
    overlay.classList.toggle("captions-off", !settings.captions);
  }

  function chooseMimeType() {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || "";
  }

  function stopTracks() {
    try { stream?.getTracks?.().forEach((track) => track.stop()); } catch {}
    stream = null;
  }

  function stopVad() {
    if (vadFrame) cancelAnimationFrame(vadFrame);
    vadFrame = 0;
    if (recordDeadline) clearTimeout(recordDeadline);
    recordDeadline = 0;
    try { vadContext?.close?.(); } catch {}
    vadContext = null;
    analyser = null;
  }

  function monitorVoice() {
    if (!recorder || recorder.state === "inactive" || !analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const value of data) {
      const normalized = (value - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / data.length);
    const now = Date.now();
    if (rms > .034) {
      heardSpeech = true;
      lastSoundAt = now;
      setCallState("listening", "正在听你说话…");
    }
    const elapsed = now - recordStartedAt;
    if (heardSpeech && now - lastSoundAt > 950 && elapsed > 900) return finishRecording(false);
    if (!heardSpeech && elapsed > 8000) return finishRecording(false);
    if (elapsed > 15000) return finishRecording(false);
    vadFrame = requestAnimationFrame(monitorVoice);
  }

  async function startListening(auto = false) {
    if (!callActive || muted || recorder || transcribeController || isGenerating()) return false;
    if (!micSupported()) {
      setCallState("error", "当前浏览器无法使用麦克风");
      return false;
    }
    stopSpeech();
    try {
      setCallState("connecting", auto ? "准备继续聆听…" : "正在打开麦克风…");
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (!callActive || muted) { stopTracks(); return false; }
      chunks = [];
      const mimeType = chooseMimeType();
      const current = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder = current;
      current.addEventListener("dataavailable", (event) => { if (event.data?.size) chunks.push(event.data); });
      current.addEventListener("stop", () => onRecordingStopped(current), { once: true });
      current.addEventListener("error", () => onRecordingError(current), { once: true });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        vadContext = new AudioCtx();
        const source = vadContext.createMediaStreamSource(stream);
        analyser = vadContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = .25;
        source.connect(analyser);
      }
      recordStartedAt = Date.now();
      lastSoundAt = recordStartedAt;
      heardSpeech = false;
      current.start(200);
      recordDeadline = setTimeout(() => {
        if (recorder === current && current.state !== "inactive") finishRecording(false);
      }, 16000);
      setCallState("listening", "正在听你说话…");
      refreshOverlay();
      if (analyser) vadFrame = requestAnimationFrame(monitorVoice);
      return true;
    } catch (error) {
      stopVad();
      stopTracks();
      recorder = null;
      const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
      setCallState("error", denied ? "麦克风权限被拒绝" : "无法打开麦克风");
      refreshOverlay();
      return false;
    }
  }

  function finishRecording(discard = false) {
    if (!recorder || recorder.state === "inactive") return false;
    recorder.__uaiDiscard = Boolean(discard);
    try { recorder.stop(); return true; } catch { return false; }
  }

  function onRecordingError(current) {
    if (recorder !== current) return;
    stopVad();
    stopTracks();
    chunks = [];
    recorder = null;
    setCallState("error", "录音失败，请再试一次");
    refreshOverlay();
  }

  function onRecordingStopped(current) {
    if (recorder !== current) return;
    stopVad();
    stopTracks();
    const discard = Boolean(current.__uaiDiscard);
    const blob = new Blob(chunks, { type: current.mimeType || chunks[0]?.type || "audio/webm" });
    chunks = [];
    recorder = null;
    refreshOverlay();
    if (discard || !callActive) return;
    transcribe(blob);
  }

  async function transcribe(blob) {
    if (!blob || blob.size < 300) {
      setCallState("idle", "没有听到有效语音，点麦克风再试一次");
      return;
    }
    transcribeController?.abort?.();
    const controller = new AbortController();
    transcribeController = controller;
    setCallState("transcribing", "正在识别你说的话…");
    try {
      const response = await fetch("/api/companion/stt", {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
        signal: controller.signal,
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `STT HTTP ${response.status}`);
      if (controller !== transcribeController || !callActive) return;
      const text = String(data?.text || "").trim();
      if (!text) throw new Error("没有识别到文字");
      transcribeController = null;
      setCaption("user", text);
      if (getSettings().autoSend) sendTranscript(text);
      else {
        fillComposer(text);
        setCallState("ready", "已识别，确认后可发送");
      }
    } catch (error) {
      if (controller === transcribeController) transcribeController = null;
      if (error?.name === "AbortError") return;
      setCallState("error", error?.message || "语音识别失败");
    }
  }

  function composer() {
    return root()?.querySelector("#uaiCompanionInput") || null;
  }

  function fillComposer(text) {
    const input = composer();
    if (!input) return false;
    input.value = String(text || "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  function sendTranscript(text) {
    if (!callActive || isGenerating()) return false;
    const host = root();
    const input = composer();
    const send = host?.querySelector("#uaiCompanionSend, .uai-c-send");
    if (!input || !send || send.disabled) return false;
    fillComposer(text);
    setCallState("sending", "听清了，正在发送…");
    send.click();
    return true;
  }

  function isGenerating() {
    return Boolean(composer()?.disabled);
  }

  function lastAssistantBubble() {
    const rows = root()?.querySelectorAll("#uaiCompanionMessages .uai-c-message-row.assistant") || [];
    const row = rows.length ? rows[rows.length - 1] : null;
    return String(row?.querySelector(".uai-c-bubble")?.textContent || "").trim();
  }

  function bindGenerationObserver() {
    const input = composer();
    if (!input || input === observedInput) return;
    generationObserver?.disconnect?.();
    observedInput = input;
    previousGenerating = Boolean(input.disabled);
    generationObserver = new MutationObserver(onGenerationStateChange);
    generationObserver.observe(input, { attributes: true, attributeFilter: ["disabled"] });
  }

  function onGenerationStateChange() {
    if (!callActive) return;
    const generating = isGenerating();
    if (generating && !previousGenerating) setCallState("thinking", "她正在想怎么回答你…");
    if (!generating && previousGenerating) {
      const text = lastAssistantBubble();
      if (text && text !== lastAssistantText) {
        lastAssistantText = text;
        setCaption("assistant", text);
        respondWithVoice(text);
      } else scheduleAutoListen(480);
    }
    previousGenerating = generating;
  }

  function cleanSpeechText(text) {
    return String(text || "").replace(/```[\s\S]*?```/g, " ").replace(/（[^）]{0,260}）/g, " ").replace(/\([^)]{0,260}\)/g, " ").replace(/[*_#>`~]/g, " ").replace(/\s+/g, " ").trim().slice(0, 1800);
  }

  function chunksForSpeech(text, max = 620) {
    const parts = String(text || "").match(/[^。！？!?；;\n]+[。！？!?；;\n]?/g) || [];
    const result = [];
    let current = "";
    for (const part of parts) {
      const candidate = `${current}${part}`.trim();
      if (current && candidate.length > max) { result.push(current); current = part.trim(); }
      else current = candidate;
    }
    if (current) result.push(current);
    return result.slice(0, 4);
  }

  function startMouth() {
    if (mouthTimer) return;
    const api = window.UnlimitedCompanionStageV1712;
    if (!api?.setMouthOpen) return;
    mouthTimer = setInterval(() => api.setMouthOpen(.18 + Math.random() * .72), 88);
  }

  function stopMouth() {
    if (mouthTimer) clearInterval(mouthTimer);
    mouthTimer = 0;
    try { window.UnlimitedCompanionStageV1712?.setMouthOpen?.(0); } catch {}
  }

  function stopPlaybackOnly() {
    if (playbackSource) {
      try { playbackSource.stop(); } catch {}
      try { playbackSource.disconnect(); } catch {}
    }
    playbackSource = null;
    if (fallbackAudio) {
      try { fallbackAudio.pause(); } catch {}
      try { fallbackAudio.removeAttribute("src"); fallbackAudio.load(); } catch {}
    }
    if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
    fallbackUrl = "";
  }

  function stopSpeech() {
    speechToken += 1;
    ttsController?.abort?.();
    ttsController = null;
    stopPlaybackOnly();
    stopMouth();
    try { window.speechSynthesis?.cancel?.(); } catch {}
  }

  function systemSpeak(text, settings) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return resolve(false);
      const token = ++speechToken;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = settings.playbackRate;
      const voices = window.speechSynthesis.getVoices?.() || [];
      const zh = voices.find((voice) => /^zh(?:-|_)/i.test(voice.lang || ""));
      if (zh) utterance.voice = zh;
      utterance.onstart = startMouth;
      utterance.onend = () => { stopMouth(); resolve(token === speechToken); };
      utterance.onerror = () => { stopMouth(); resolve(false); };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  async function fetchTts(text, settings, signal) {
    const response = await fetch("/api/companion/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang: "zh", engine: settings.engine === "system" ? "auto" : settings.engine, voice_id: settings.voiceId }),
      signal,
      cache: "no-store"
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || `TTS HTTP ${response.status}`);
    }
    if (!String(response.headers.get("content-type") || "").includes("audio/")) throw new Error("TTS did not return audio");
    return response.blob();
  }

  async function playBlobWithWebAudio(blob, settings, token) {
    const context = ensurePlaybackContext();
    if (!context) throw new Error("WebAudio unavailable");
    await context.resume();
    if (context.state !== "running") throw new Error("AudioContext is not running");
    const buffer = await blob.arrayBuffer();
    if (token !== speechToken) return false;
    const decoded = await context.decodeAudioData(buffer.slice(0));
    if (token !== speechToken) return false;
    return new Promise((resolve, reject) => {
      const source = context.createBufferSource();
      playbackSource = source;
      source.buffer = decoded;
      source.playbackRate.value = settings.playbackRate;
      source.connect(context.destination);
      source.onended = () => {
        if (playbackSource === source) playbackSource = null;
        try { source.disconnect(); } catch {}
        stopMouth();
        resolve(token === speechToken);
      };
      try {
        startMouth();
        source.start(0);
      } catch (error) {
        stopMouth();
        if (playbackSource === source) playbackSource = null;
        reject(error);
      }
    });
  }

  async function playBlobWithAudio(blob, settings, token) {
    if (token !== speechToken) return false;
    const audio = ensureFallbackAudio();
    const url = URL.createObjectURL(blob);
    if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
    fallbackUrl = url;
    audio.src = url;
    audio.playbackRate = settings.playbackRate;
    audio.volume = 1;
    try {
      await audio.play();
      audioUnlocked = true;
      startMouth();
      await new Promise((resolve, reject) => {
        const cleanup = () => {
          audio.removeEventListener("ended", onEnd);
          audio.removeEventListener("error", onError);
        };
        const onEnd = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error("Audio playback failed")); };
        audio.addEventListener("ended", onEnd, { once: true });
        audio.addEventListener("error", onError, { once: true });
      });
      return token === speechToken;
    } finally {
      stopMouth();
      if (fallbackUrl === url) fallbackUrl = "";
      URL.revokeObjectURL(url);
    }
  }

  async function playBlob(blob, settings, token) {
    try {
      return await playBlobWithWebAudio(blob, settings, token);
    } catch (webAudioError) {
      try {
        return await playBlobWithAudio(blob, settings, token);
      } catch (audioError) {
        lastPlaybackError = audioError?.message || webAudioError?.message || "声音播放失败";
        const blocked = audioError?.name === "NotAllowedError" || /play|gesture|allowed/i.test(lastPlaybackError);
        throw new Error(blocked ? "浏览器拦截了声音，请点一下扬声器后重试" : `声音播放失败：${lastPlaybackError}`);
      }
    }
  }

  async function respondWithVoice(text, options = {}) {
    if (!callActive) return false;
    const settings = getSettings();
    const cleaned = cleanSpeechText(text);
    lastSpokenText = cleaned;
    if (!settings.speaker || !cleaned) {
      setCallState("ready", "她回复你了");
      scheduleAutoListen(420);
      return false;
    }
    stopSpeech();
    lastPlaybackError = "";
    setCallState("speaking", options.retry ? "正在重新播放…" : "她正在对你说话…");
    if (settings.engine === "system") {
      const ok = await systemSpeak(cleaned, settings);
      if (!ok && callActive) setCallState("error", "系统语音播放失败，请切换到自动语音");
      if (callActive) scheduleAutoListen(380);
      return ok;
    }
    const token = ++speechToken;
    const controller = new AbortController();
    ttsController = controller;
    try {
      for (const part of chunksForSpeech(cleaned)) {
        const blob = await fetchTts(part, settings, controller.signal);
        if (controller !== ttsController || token !== speechToken || !callActive) return false;
        await playBlob(blob, settings, token);
      }
      if (controller === ttsController) ttsController = null;
      if (callActive) setCallState("ready", "她说完了");
    } catch (error) {
      if (controller === ttsController) ttsController = null;
      if (error?.name === "AbortError") return false;
      lastPlaybackError = error?.message || "语音播放失败";
      if (!callActive) return false;
      const fallbackOk = await systemSpeak(cleaned, settings);
      if (!fallbackOk) {
        setCallState("error", lastPlaybackError);
        showToast(lastPlaybackError);
        return false;
      }
    }
    if (callActive) scheduleAutoListen(420);
    return true;
  }

  function scheduleAutoListen(delay = 500) {
    if (!callActive || muted || !getSettings().autoListen) {
      setCallState("ready", "点麦克风继续说话");
      return;
    }
    setCallState("ready", "准备继续听你说话…");
    setTimeout(() => {
      if (callActive && !muted && !isGenerating() && !recorder && !transcribeController && !ttsController && !playbackSource) startListening(true);
    }, delay);
  }

  function disableGeneralAutoVoice() {
    const api = window.UnlimitedCompanionVoiceV1711;
    if (!api?.getSettings || !api?.setSettings) return;
    previousAutoVoiceSetting = api.getSettings();
    if (previousAutoVoiceSetting.enabled) api.setSettings({ enabled: false });
    api.stop?.({ keepLast: true });
  }

  function restoreGeneralAutoVoice() {
    const api = window.UnlimitedCompanionVoiceV1711;
    if (previousAutoVoiceSetting && api?.setSettings) api.setSettings(previousAutoVoiceSetting);
    previousAutoVoiceSetting = null;
  }

  async function startCall() {
    if (callActive) return true;
    if (!root()) return false;
    if (!micSupported()) {
      showToast("当前浏览器不支持麦克风通话");
      return false;
    }

    // Must run before the first await while the click still owns user activation.
    unlockPlayback();

    callActive = true;
    callStartedAt = Date.now();
    lastAssistantText = lastAssistantBubble();
    lastPlaybackError = "";
    muted = false;
    const host = root();
    host.dataset.v1713Call = "active";
    ensureOverlay();
    bindGenerationObserver();
    disableGeneralAutoVoice();
    stageWasOpen = Boolean(window.UnlimitedCompanionStageV1712?.getStatus?.().open);
    try { window.UnlimitedCompanionStageV1712?.open?.(); } catch {}
    clearInterval(callTimer);
    callTimer = setInterval(updateTimer, 500);
    updateTimer();
    refreshOverlay();
    setCallState("connecting", "正在打开麦克风…");
    await startListening(true);
    return true;
  }

  function endCall() {
    if (!callActive && !overlay) return true;
    callActive = false;
    clearInterval(callTimer);
    callTimer = 0;
    if (recorder) finishRecording(true);
    transcribeController?.abort?.();
    transcribeController = null;
    stopVad();
    stopTracks();
    stopSpeech();
    generationObserver?.disconnect?.();
    generationObserver = null;
    observedInput = null;
    restoreGeneralAutoVoice();
    if (!stageWasOpen) {
      try { window.UnlimitedCompanionStageV1712?.close?.(); } catch {}
    }
    stageWasOpen = false;
    root()?.removeAttribute("data-v1713-call");
    overlay?.remove();
    overlay = null;
    try { playbackContext?.close?.(); } catch {}
    playbackContext = null;
    audioUnlocked = false;
    if (fallbackAudio) {
      fallbackAudio.remove();
      fallbackAudio = null;
    }
    ensureLauncher();
    return true;
  }

  function refresh() {
    if (!root()) {
      if (callActive || overlay) endCall();
      return;
    }
    ensureLauncher();
    if (callActive) {
      ensureOverlay();
      bindGenerationObserver();
    }
  }

  window.addEventListener("uai:companion-core-entered", refresh);
  window.addEventListener("uai:companion-functions-ready", refresh);
  window.addEventListener("uai:mode-refresh", refresh);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && callActive) endCall();
  });
  window.addEventListener("pagehide", endCall, { passive: true });

  document.documentElement.dataset.companionCallV1713Revision = REVISION;
  window.UnlimitedCompanionCallV1713 = {
    revision: REVISION,
    start: startCall,
    end: endCall,
    refresh,
    unlockAudio: unlockPlayback,
    getSettings,
    setSettings,
    retryVoice: () => callActive && lastSpokenText ? respondWithVoice(lastSpokenText, { retry: true }) : false,
    get active() { return callActive; },
    get state() { return overlay?.dataset.state || "idle"; },
    get audioUnlocked() { return audioUnlocked || playbackContext?.state === "running"; },
    get lastPlaybackError() { return lastPlaybackError; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
})();