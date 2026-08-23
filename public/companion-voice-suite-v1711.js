// V17.16 safe neural voice + relationship review with gesture-unlocked WebAudio playback.
(() => {
  const REVISION = "2026-08-23-v17.16-voice-audio-recovery";
  if (window.UnlimitedCompanionVoiceV1711?.revision === REVISION) return;

  const KEY = "uai_companion_neural_voice_v1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  const MOMENTS_KEY = "uai_companion_moments_v1";
  const DEFAULTS = {
    enabled: false,
    provider: "auto",
    playbackRate: 1,
    dialogueOnly: true,
    fallbackSystem: true
  };
  const PROVIDERS = new Set(["auto", "neural", "system"]);
  const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA";

  let playbackContext = null;
  let playbackSource = null;
  let fallbackAudio = null;
  let fallbackUrl = "";
  let audioUnlocked = false;
  let unlockPromise = null;
  let abortController = null;
  let playToken = 0;
  let lastText = "";
  let lastBlobs = [];
  let neuralStatus = "unknown";
  let neuralStatusText = "尚未检查神经语音";
  let lastStatusCheck = 0;
  let inputObserver = null;
  let observedInput = null;
  let wasGenerating = false;
  let lastAutoReadText = "";
  let lastPlaybackError = "";

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

  function getSettings() {
    const stored = settingsMap()[activeCharacterId()];
    const value = { ...DEFAULTS, ...(stored && typeof stored === "object" ? stored : {}) };
    value.provider = PROVIDERS.has(String(value.provider)) ? String(value.provider) : "auto";
    value.playbackRate = Math.max(.82, Math.min(1.18, Number(value.playbackRate) || 1));
    value.enabled = Boolean(value.enabled);
    value.dialogueOnly = value.dialogueOnly !== false;
    value.fallbackSystem = value.fallbackSystem !== false;
    return value;
  }

  function setSettings(patch = {}) {
    const map = settingsMap();
    const previous = getSettings();
    const provider = PROVIDERS.has(String(patch.provider ?? previous.provider)) ? String(patch.provider ?? previous.provider) : "auto";
    const next = {
      ...previous,
      ...patch,
      enabled: Boolean(patch.enabled ?? previous.enabled),
      provider,
      playbackRate: Math.max(.82, Math.min(1.18, Number(patch.playbackRate ?? previous.playbackRate) || 1)),
      dialogueOnly: Boolean(patch.dialogueOnly ?? previous.dialogueOnly),
      fallbackSystem: Boolean(patch.fallbackSystem ?? previous.fallbackSystem)
    };
    map[activeCharacterId()] = next;
    localStorage.setItem(KEY, JSON.stringify(map));
    if (!next.enabled) stop({ keepLast: true });
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
    audio.id = "uaiCompanionVoiceAudioV1716";
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

  function setVoiceState(state = "") {
    const host = root();
    if (!host) return;
    if (state) host.dataset.v1711VoiceState = state;
    else delete host.dataset.v1711VoiceState;
    host.dispatchEvent(new CustomEvent("uai:companion-voice-state", {
      bubbles: false,
      detail: { state, revision: REVISION }
    }));
    refreshUi();
  }

  function extractSpeechText(text, settings = getSettings()) {
    let source = String(text || "").replace(/```[\s\S]*?```/g, " ").replace(/[*_#>`~]/g, " ");
    if (settings.dialogueOnly) source = source.replace(/（[^）]{0,260}）/g, " ").replace(/\([^)]{0,260}\)/g, " ");
    return source.replace(/\s+/g, " ").trim().slice(0, 1800);
  }

  function chunkText(text, max = 520) {
    const parts = String(text || "").match(/[^。！？!?；;\n]+[。！？!?；;\n]?/g) || [];
    const chunks = [];
    let current = "";
    for (const part of parts) {
      const candidate = `${current}${part}`.trim();
      if (current && candidate.length > max) {
        chunks.push(current.trim());
        current = part.trim();
      } else current = candidate;
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.filter(Boolean).slice(0, 5);
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
      neuralStatusText = neuralStatus === "ready" ? "Cloudflare 神经语音可用" : "神经语音暂不可用，可回退系统语音";
    } catch {
      neuralStatus = "unavailable";
      neuralStatusText = "神经语音连接失败，可回退系统语音";
    }
    refreshUi();
    return neuralStatus === "ready";
  }

  async function fetchChunk(text, signal) {
    const response = await fetch("/api/companion/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang: "zh" }),
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

  function stop(options = {}) {
    playToken += 1;
    abortController?.abort?.();
    abortController = null;
    stopPlaybackOnly();
    try { window.speechSynthesis?.cancel?.(); } catch {}
    setVoiceState("");
    if (!options.keepLast) {
      lastText = "";
      lastBlobs = [];
    }
  }

  function closePlaybackResources() {
    stop({ keepLast: true });
    try { playbackContext?.close?.(); } catch {}
    playbackContext = null;
    audioUnlocked = false;
    fallbackAudio?.remove?.();
    fallbackAudio = null;
  }

  function systemSpeak(text, settings) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return Promise.resolve(false);
    return new Promise((resolve) => {
      const token = ++playToken;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = settings.playbackRate;
      const voices = window.speechSynthesis.getVoices?.() || [];
      const zh = voices.find((voice) => /^zh(?:-|_)/i.test(voice.lang || ""));
      if (zh) utterance.voice = zh;
      utterance.onstart = () => setVoiceState("speaking");
      utterance.onend = () => {
        if (token === playToken) setVoiceState("");
        resolve(token === playToken);
      };
      utterance.onerror = () => {
        if (token === playToken) setVoiceState("");
        resolve(false);
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  async function playBlobWebAudio(blob, settings, token) {
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
      source.playbackRate.value = settings.playbackRate;
      source.connect(context.destination);
      source.onended = () => {
        if (playbackSource === source) playbackSource = null;
        try { source.disconnect(); } catch {}
        resolve(token === playToken);
      };
      try { source.start(0); }
      catch (error) {
        if (playbackSource === source) playbackSource = null;
        reject(error);
      }
    });
  }

  async function playBlobAudio(blob, settings, token) {
    if (token !== playToken) return false;
    const audio = ensureFallbackAudio();
    const url = URL.createObjectURL(blob);
    if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
    fallbackUrl = url;
    audio.src = url;
    audio.volume = 1;
    audio.playbackRate = settings.playbackRate;
    try {
      await audio.play();
      audioUnlocked = true;
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
      return token === playToken;
    } finally {
      if (fallbackUrl === url) fallbackUrl = "";
      URL.revokeObjectURL(url);
    }
  }

  async function playBlobs(blobs, settings) {
    if (!Array.isArray(blobs) || !blobs.length) return false;
    const token = ++playToken;
    setVoiceState("speaking");
    for (const blob of blobs) {
      if (token !== playToken) return false;
      try {
        await playBlobWebAudio(blob, settings, token);
      } catch (webError) {
        try {
          await playBlobAudio(blob, settings, token);
        } catch (audioError) {
          lastPlaybackError = audioError?.message || webError?.message || "声音播放失败";
          throw new Error(/play|gesture|allowed/i.test(lastPlaybackError) ? "浏览器拦截了声音，请再次点击语音按钮" : lastPlaybackError);
        }
      }
    }
    if (token === playToken) setVoiceState("");
    return true;
  }

  async function speak(text, options = {}) {
    const settings = { ...getSettings(), ...(options.settings || {}) };
    if (!settings.enabled && !options.force) return false;
    const cleaned = extractSpeechText(text, settings);
    if (!cleaned) return false;
    stop({ keepLast: true });
    lastText = cleaned;
    lastBlobs = [];
    lastPlaybackError = "";
    const provider = options.provider || settings.provider;
    if (provider === "system") return systemSpeak(cleaned, settings);

    setVoiceState("loading");
    const controller = new AbortController();
    abortController = controller;
    try {
      const available = await checkStatus();
      if (!available) throw new Error("Neural TTS unavailable");
      const blobs = [];
      for (const chunk of chunkText(cleaned)) blobs.push(await fetchChunk(chunk, controller.signal));
      if (controller !== abortController) return false;
      abortController = null;
      lastBlobs = blobs;
      neuralStatus = "ready";
      neuralStatusText = "Cloudflare 神经语音已验证";
      return await playBlobs(blobs, settings);
    } catch (error) {
      if (controller === abortController) abortController = null;
      if (error?.name === "AbortError") return false;
      lastPlaybackError = error?.message || "神经语音播放失败";
      neuralStatus = "unavailable";
      neuralStatusText = /浏览器拦截/.test(lastPlaybackError) ? lastPlaybackError : "本次神经语音失败，已准备回退系统语音";
      if (provider === "auto" || settings.fallbackSystem) {
        const ok = await systemSpeak(cleaned, settings);
        if (ok) return true;
      }
      setVoiceState("");
      showToast(lastPlaybackError);
      return false;
    }
  }

  async function replay() {
    const settings = getSettings();
    if (lastBlobs.length && settings.provider !== "system") {
      stop({ keepLast: true });
      return playBlobs(lastBlobs, settings);
    }
    return lastText ? speak(lastText, { force: true }) : false;
  }

  function lastAssistantText() {
    const rows = root()?.querySelectorAll("#uaiCompanionMessages .uai-c-message-row.assistant") || [];
    const row = rows.length ? rows[rows.length - 1] : null;
    return String(row?.querySelector(".uai-c-bubble")?.textContent || "").trim();
  }

  function isGenerating() {
    return Boolean(root()?.querySelector("#uaiCompanionInput:disabled"));
  }

  function maybeAutoRead() {
    const generating = isGenerating();
    if (wasGenerating && !generating) {
      const text = lastAssistantText();
      if (text && text !== lastAutoReadText && getSettings().enabled) {
        lastAutoReadText = text;
        setTimeout(() => {
          if (root() && !isGenerating()) speak(text);
        }, 140);
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

  function relationStats() {
    const state = window.UnlimitedCompanion?.getState?.() || {};
    const sessions = Array.isArray(state.sessions) ? state.sessions : [];
    const allMessages = sessions.flatMap((session) => Array.isArray(session.messages) ? session.messages : []);
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const recentSessions = sessions.filter((session) => Number(session.updatedAt || session.createdAt || 0) >= start.getTime());
    const recentMessages = recentSessions.flatMap((session) => Array.isArray(session.messages) ? session.messages : []);
    const map = safeParse(localStorage.getItem(MOMENTS_KEY), {});
    const moments = Array.isArray(map?.[activeCharacterId()]) ? map[activeCharacterId()] : [];
    const recentMoments = moments.filter((item) => Number(item.savedAt || item.createdAt || 0) >= start.getTime());
    return {
      totalSessions: sessions.length,
      totalMessages: allMessages.length,
      monthSessions: recentSessions.length,
      monthMessages: recentMessages.length,
      monthUserMessages: recentMessages.filter((item) => item?.role === "user").length,
      monthMoments: recentMoments.length,
      topics: recentSessions.filter((session) => session?.title && session.title !== "新的聊天").sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).slice(0, 5).map((session) => String(session.title).slice(0, 34))
    };
  }

  function closeModal() {
    document.getElementById("uaiCompanionV1711Mask")?.remove();
  }

  function openVoicePanel() {
    closeModal();
    unlockAudio();
    const settings = getSettings();
    const mask = document.createElement("div");
    mask.id = "uaiCompanionV1711Mask";
    mask.className = "uai-c-v1711-mask";
    mask.innerHTML = `
      <section class="uai-c-v1711-modal" role="dialog" aria-modal="true" aria-label="声音设置">
        <header><div><span>VOICE</span><h3>角色声音</h3><p>神经语音优先，失败时自动回退浏览器系统语音。</p></div><button type="button" data-v1711-close>×</button></header>
        <div class="uai-c-v1711-field switch"><div><strong>自动朗读新回复</strong><small>打开后只在一条回复生成完成时触发。</small></div><label><input data-v1711-enabled type="checkbox" ${settings.enabled ? "checked" : ""}><i></i></label></div>
        <div class="uai-c-v1711-grid"><label>语音引擎<select data-v1711-provider><option value="auto">自动 · 神经优先</option><option value="neural">Cloudflare 神经语音</option><option value="system">浏览器系统语音</option></select></label><label>语速 <b data-v1711-rate-label>${settings.playbackRate.toFixed(2)}×</b><input data-v1711-rate type="range" min="0.82" max="1.18" step="0.02" value="${settings.playbackRate}"></label></div>
        <div class="uai-c-v1711-checks"><label><input data-v1711-dialogue type="checkbox" ${settings.dialogueOnly ? "checked" : ""}>只朗读角色说出口的台词</label><label><input data-v1711-fallback type="checkbox" ${settings.fallbackSystem ? "checked" : ""}>神经语音失败时自动回退系统语音</label></div>
        <div class="uai-c-v1711-status" data-v1711-status data-state="${neuralStatus}">${neuralStatusText}</div>
        <footer><small>播放通道：WebAudio + 持久 Audio fallback</small><button type="button" data-v1711-recheck>重新检测</button><button type="button" data-v1711-stop>停止</button><button type="button" class="primary" data-v1711-preview>试听</button></footer>
      </section>`;
    document.body.appendChild(mask);
    mask.addEventListener("click", (event) => { if (event.target === mask) closeModal(); });
    mask.querySelector("[data-v1711-close]")?.addEventListener("click", closeModal);
    mask.querySelector("[data-v1711-enabled]")?.addEventListener("change", async (event) => {
      if (event.target.checked) await unlockAudio();
      setSettings({ enabled: event.target.checked });
    });
    const provider = mask.querySelector("[data-v1711-provider]");
    if (provider) provider.value = settings.provider;
    provider?.addEventListener("change", (event) => setSettings({ provider: event.target.value }));
    mask.querySelector("[data-v1711-rate]")?.addEventListener("input", (event) => {
      const next = setSettings({ playbackRate: Number(event.target.value) });
      const label = mask.querySelector("[data-v1711-rate-label]");
      if (label) label.textContent = `${next.playbackRate.toFixed(2)}×`;
    });
    mask.querySelector("[data-v1711-dialogue]")?.addEventListener("change", (event) => setSettings({ dialogueOnly: event.target.checked }));
    mask.querySelector("[data-v1711-fallback]")?.addEventListener("change", (event) => setSettings({ fallbackSystem: event.target.checked }));
    mask.querySelector("[data-v1711-recheck]")?.addEventListener("click", () => checkStatus(true));
    mask.querySelector("[data-v1711-stop]")?.addEventListener("click", () => stop({ keepLast: true }));
    mask.querySelector("[data-v1711-preview]")?.addEventListener("pointerdown", unlockAudio, { passive: true });
    mask.querySelector("[data-v1711-preview]")?.addEventListener("click", () => speak("晚上好呀。今天终于又见到你了，要不要陪我多待一会儿？", { force: true }));
  }

  function openMonthlyReview() {
    closeModal();
    const stats = relationStats();
    const mask = document.createElement("div");
    mask.id = "uaiCompanionV1711Mask";
    mask.className = "uai-c-v1711-mask";
    const topics = stats.topics.length ? stats.topics.map((topic) => `<b>${escapeHtml(topic)}</b>`).join("") : "<small>这个月还没有形成明显的话题记录</small>";
    mask.innerHTML = `
      <section class="uai-c-v1711-modal" role="dialog" aria-modal="true" aria-label="本月关系回顾">
        <header><div><span>MONTHLY REVIEW</span><h3>本月回顾</h3><p>只根据当前浏览器里保存的陪伴会话与珍藏时刻整理。</p></div><button type="button" data-v1711-close>×</button></header>
        <div class="uai-c-v1711-stats"><div><strong>${stats.monthSessions}</strong><span>本月会话</span></div><div><strong>${stats.monthMessages}</strong><span>本月消息</span></div><div><strong>${stats.monthUserMessages}</strong><span>你说的话</span></div><div><strong>${stats.monthMoments}</strong><span>珍藏时刻</span></div></div>
        <div class="uai-c-v1711-topics"><span>最近聊过</span><div>${topics}</div></div>
        <footer><small>累计 ${stats.totalSessions} 个会话 · ${stats.totalMessages} 条消息</small><button class="primary" type="button" data-v1711-close2>知道了</button></footer>
      </section>`;
    document.body.appendChild(mask);
    mask.addEventListener("click", (event) => { if (event.target === mask) closeModal(); });
    mask.querySelector("[data-v1711-close]")?.addEventListener("click", closeModal);
    mask.querySelector("[data-v1711-close2]")?.addEventListener("click", closeModal);
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function ensureDock() {
    const host = root();
    const header = host?.querySelector(".uai-c-header");
    if (!header) return null;
    let dock = header.querySelector("#uaiCompanionVoiceDockV1711");
    if (!dock) {
      dock = document.createElement("div");
      dock.id = "uaiCompanionVoiceDockV1711";
      dock.className = "uai-c-v1711-dock";
      dock.innerHTML = `<button id="uaiCompanionVoiceToggleV1711" type="button"><i>🔇</i><span>语音</span></button><button id="uaiCompanionMonthlyReviewV1711" type="button"><i>♡</i><span>本月回顾</span></button><button id="uaiCompanionVoiceStopV1711" type="button" title="停止播放">■</button>`;
      header.appendChild(dock);
      const toggle = dock.querySelector("#uaiCompanionVoiceToggleV1711");
      toggle?.addEventListener("pointerdown", unlockAudio, { passive: true });
      toggle?.addEventListener("click", async () => {
        const next = !getSettings().enabled;
        if (next) await unlockAudio();
        setSettings({ enabled: next });
        if (next) {
          if (lastPlaybackError) lastPlaybackError = "";
          showToast("自动朗读已开启");
        }
      });
      toggle?.addEventListener("contextmenu", (event) => { event.preventDefault(); openVoicePanel(); });
      dock.querySelector("#uaiCompanionMonthlyReviewV1711")?.addEventListener("click", openMonthlyReview);
      dock.querySelector("#uaiCompanionVoiceStopV1711")?.addEventListener("click", () => stop({ keepLast: true }));
    }
    return dock;
  }

  function refreshUi() {
    const host = root();
    if (!host) return;
    const dock = ensureDock();
    if (!dock) return;
    const settings = getSettings();
    const state = host.dataset.v1711VoiceState || "";
    const toggle = dock.querySelector("#uaiCompanionVoiceToggleV1711");
    const stopButton = dock.querySelector("#uaiCompanionVoiceStopV1711");
    if (toggle) {
      toggle.classList.toggle("active", settings.enabled);
      toggle.classList.toggle("loading", state === "loading");
      toggle.classList.toggle("speaking", state === "speaking");
      const icon = toggle.querySelector("i");
      const label = toggle.querySelector("span");
      if (icon) icon.textContent = settings.enabled ? "🔊" : "🔇";
      if (label) label.textContent = state === "loading" ? "生成语音" : state === "speaking" ? "说话中" : "语音";
      toggle.title = lastPlaybackError || "左键开关自动朗读；右键打开声音设置";
    }
    if (stopButton) stopButton.hidden = !state;
    const modal = document.querySelector("#uaiCompanionV1711Mask .uai-c-v1711-modal");
    const status = modal?.querySelector("[data-v1711-status]");
    if (status) {
      status.textContent = neuralStatusText;
      status.dataset.state = neuralStatus;
    }
  }

  function refresh() {
    const host = root();
    if (!host) {
      inputObserver?.disconnect?.();
      inputObserver = null;
      observedInput = null;
      closeModal();
      closePlaybackResources();
      return;
    }
    ensureDock();
    bindInputObserver();
    refreshUi();
  }

  window.addEventListener("uai:companion-core-entered", refresh);
  window.addEventListener("uai:companion-functions-ready", refresh);
  window.addEventListener("uai:mode-refresh", refresh);
  window.addEventListener("storage", (event) => {
    if (event.key === KEY || event.key === ACTIVE_KEY) refresh();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop({ keepLast: true });
    else refresh();
  });
  window.addEventListener("pagehide", closePlaybackResources, { passive: true });

  document.documentElement.dataset.companionVoiceV1711Revision = REVISION;
  window.UnlimitedCompanionVoiceV1711 = {
    revision: REVISION,
    getSettings,
    setSettings,
    checkStatus,
    extractSpeechText,
    unlockAudio,
    speak,
    stop,
    replay,
    refresh,
    get audioUnlocked() { return audioUnlocked || playbackContext?.state === "running"; },
    get lastPlaybackError() { return lastPlaybackError; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
})();