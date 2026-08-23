// V17.11 safe neural voice + relationship review. No Live2D dependency and no body-wide observers.
(() => {
  const REVISION = "2026-08-23-v17.11-safe-neural-voice";
  if (window.UnlimitedCompanionVoiceV1711) return;

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

  let activeAudio = null;
  let activeUrl = "";
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
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function extractSpeechText(text, settings = getSettings()) {
    let source = String(text || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[*_#>`~]/g, " ");
    if (settings.dialogueOnly) {
      source = source
        .replace(/（[^）]{0,260}）/g, " ")
        .replace(/\([^)]{0,260}\)/g, " ");
    }
    return source.replace(/\s+/g, " ").trim().slice(0, 1800);
  }

  function chunkText(text, max = 420) {
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
    const type = response.headers.get("content-type") || "";
    if (!type.includes("audio/")) throw new Error("TTS did not return audio");
    return response.blob();
  }

  function stopAudio() {
    if (activeAudio) {
      try { activeAudio.pause(); } catch {}
      try { activeAudio.removeAttribute("src"); activeAudio.load(); } catch {}
    }
    activeAudio = null;
    if (activeUrl) URL.revokeObjectURL(activeUrl);
    activeUrl = "";
  }

  function stop(options = {}) {
    playToken += 1;
    abortController?.abort?.();
    abortController = null;
    stopAudio();
    try { window.speechSynthesis?.cancel?.(); } catch {}
    const host = root();
    if (host) delete host.dataset.v1711VoiceState;
    if (!options.keepLast) {
      lastText = "";
      lastBlobs = [];
    }
    refreshUi();
  }

  function systemSpeak(text, settings) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
    const token = ++playToken;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = settings.playbackRate;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const zh = voices.find((voice) => /^zh(?:-|_)/i.test(voice.lang || ""));
    if (zh) utterance.voice = zh;
    const host = root();
    if (host) host.dataset.v1711VoiceState = "speaking";
    utterance.onend = utterance.onerror = () => {
      if (token !== playToken) return;
      const live = root();
      if (live) delete live.dataset.v1711VoiceState;
      refreshUi();
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    refreshUi();
    return true;
  }

  async function playBlobs(blobs, settings) {
    if (!blobs.length) return false;
    const token = ++playToken;
    const host = root();
    if (host) host.dataset.v1711VoiceState = "speaking";
    refreshUi();
    for (const blob of blobs) {
      if (token !== playToken) return false;
      const url = URL.createObjectURL(blob);
      activeUrl = url;
      const audio = new Audio(url);
      activeAudio = audio;
      audio.playbackRate = settings.playbackRate;
      try {
        await audio.play();
        await new Promise((resolve, reject) => {
          audio.addEventListener("ended", resolve, { once: true });
          audio.addEventListener("error", () => reject(new Error("Audio playback failed")), { once: true });
        });
      } finally {
        if (activeAudio === audio) activeAudio = null;
        if (activeUrl === url) activeUrl = "";
        URL.revokeObjectURL(url);
      }
    }
    if (token === playToken) {
      const live = root();
      if (live) delete live.dataset.v1711VoiceState;
      refreshUi();
    }
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
    const provider = options.provider || settings.provider;
    if (provider === "system") return systemSpeak(cleaned, settings);

    const host = root();
    if (host) host.dataset.v1711VoiceState = "loading";
    refreshUi();
    const controller = new AbortController();
    abortController = controller;
    try {
      const available = await checkStatus();
      if (!available) throw new Error("Neural TTS unavailable");
      const blobs = await Promise.all(chunkText(cleaned).map((chunk) => fetchChunk(chunk, controller.signal)));
      if (controller !== abortController) return false;
      abortController = null;
      lastBlobs = blobs;
      neuralStatus = "ready";
      neuralStatusText = "Cloudflare 神经语音已验证";
      return await playBlobs(blobs, settings);
    } catch (error) {
      if (controller === abortController) abortController = null;
      if (error?.name === "AbortError") return false;
      neuralStatus = "unavailable";
      neuralStatusText = "本次神经语音失败，已准备回退系统语音";
      if (provider === "auto" || settings.fallbackSystem) return systemSpeak(cleaned, settings);
      const live = root();
      if (live) delete live.dataset.v1711VoiceState;
      refreshUi();
      showToast("神经语音暂时不可用");
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
    const messages = sessions.flatMap((session) => Array.isArray(session.messages) ? session.messages : []);
    const start = new Date();
    start.setDate(1); start.setHours(0, 0, 0, 0);
    const recentSessions = sessions.filter((session) => Number(session.updatedAt || session.createdAt || 0) >= start.getTime());
    const recentMessages = recentSessions.flatMap((session) => Array.isArray(session.messages) ? session.messages : []);
    const map = safeParse(localStorage.getItem(MOMENTS_KEY), {});
    const moments = Array.isArray(map?.[activeCharacterId()]) ? map[activeCharacterId()] : [];
    const recentMoments = moments.filter((item) => Number(item.savedAt || item.createdAt || 0) >= start.getTime());
    return {
      totalSessions: sessions.length,
      totalMessages: messages.length,
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
    const settings = getSettings();
    const mask = document.createElement("div");
    mask.id = "uaiCompanionV1711Mask";
    mask.className = "uai-c-v1711-mask";
    mask.innerHTML = `
      <section class="uai-c-v1711-modal" role="dialog" aria-modal="true" aria-label="声音设置">
        <header><div><span>VOICE</span><h3>角色声音</h3><p>神经语音优先，失败时可自动回退浏览器系统语音。</p></div><button type="button" data-v1711-close>×</button></header>
        <div class="uai-c-v1711-field switch"><div><strong>自动朗读新回复</strong><small>默认关闭；打开后只在一条回复生成完成时触发。</small></div><label><input type="checkbox" data-v1711-enabled ${settings.enabled ? "checked" : ""}><i></i></label></div>
        <div class="uai-c-v1711-grid">
          <label><span>语音引擎</span><select data-v1711-provider><option value="auto">自动 · 神经优先</option><option value="neural">Cloudflare 神经语音</option><option value="system">浏览器系统语音</option></select></label>
          <label><span>语速 <b data-v1711-rate-label>${settings.playbackRate.toFixed(2)}×</b></span><input data-v1711-rate type="range" min="0.82" max="1.18" step="0.02" value="${settings.playbackRate}"></label>
        </div>
        <div class="uai-c-v1711-checks"><label><input type="checkbox" data-v1711-dialogue ${settings.dialogueOnly ? "checked" : ""}>过滤括号动作与格式符号</label><label><input type="checkbox" data-v1711-fallback ${settings.fallbackSystem ? "checked" : ""}>神经语音失败时回退系统语音</label></div>
        <div class="uai-c-v1711-status" data-v1711-status data-state="${neuralStatus}">${neuralStatusText}</div>
        <footer><button type="button" data-v1711-check>检查语音</button><button type="button" data-v1711-preview>试听</button><button type="button" data-v1711-replay>重播上一条</button><button type="button" class="primary" data-v1711-close>完成</button></footer>
      </section>`;
    document.body.appendChild(mask);
    mask.addEventListener("click", (event) => { if (event.target === mask) closeModal(); });
    mask.querySelectorAll("[data-v1711-close]").forEach((button) => button.addEventListener("click", closeModal));
    const provider = mask.querySelector("[data-v1711-provider]");
    if (provider) provider.value = settings.provider;
    mask.querySelector("[data-v1711-enabled]")?.addEventListener("change", (event) => setSettings({ enabled: event.target.checked }));
    provider?.addEventListener("change", (event) => setSettings({ provider: event.target.value }));
    mask.querySelector("[data-v1711-rate]")?.addEventListener("input", (event) => {
      const value = Number(event.target.value);
      setSettings({ playbackRate: value });
      const label = mask.querySelector("[data-v1711-rate-label]");
      if (label) label.textContent = `${value.toFixed(2)}×`;
    });
    mask.querySelector("[data-v1711-dialogue]")?.addEventListener("change", (event) => setSettings({ dialogueOnly: event.target.checked }));
    mask.querySelector("[data-v1711-fallback]")?.addEventListener("change", (event) => setSettings({ fallbackSystem: event.target.checked }));
    mask.querySelector("[data-v1711-check]")?.addEventListener("click", () => checkStatus(true));
    mask.querySelector("[data-v1711-preview]")?.addEventListener("click", () => speak("晚上好呀。今天也想多陪你一会儿。", { force: true }));
    mask.querySelector("[data-v1711-replay]")?.addEventListener("click", replay);
  }

  function openReview() {
    closeModal();
    const stats = relationStats();
    const profile = window.UnlimitedCompanion?.getState?.()?.profile || {};
    const now = new Date();
    const mask = document.createElement("div");
    mask.id = "uaiCompanionV1711Mask";
    mask.className = "uai-c-v1711-mask";
    const topics = stats.topics.length ? stats.topics.map((topic) => `<b>${escapeHtml(topic)}</b>`).join("") : `<small>这个月还没有形成明确的话题。</small>`;
    mask.innerHTML = `
      <section class="uai-c-v1711-modal review" role="dialog" aria-modal="true" aria-label="本月关系回顾">
        <header><div><span>MONTHLY REVIEW</span><h3>${escapeHtml(profile.name || "伙伴")} · ${now.getMonth() + 1} 月</h3><p>只统计当前浏览器中真实存在的陪伴记录。</p></div><button type="button" data-v1711-close>×</button></header>
        <div class="uai-c-v1711-stats"><div><strong>${stats.monthSessions}</strong><span>本月会话</span></div><div><strong>${stats.monthMessages}</strong><span>本月消息</span></div><div><strong>${stats.monthUserMessages}</strong><span>你发出的</span></div><div><strong>${stats.monthMoments}</strong><span>重要时刻</span></div></div>
        <section class="uai-c-v1711-topics"><span>最近聊过</span><div>${topics}</div></section>
        <footer><small>累计 ${stats.totalSessions} 个会话 · ${stats.totalMessages} 条消息</small><button type="button" class="primary" data-v1711-close>收好这份回顾</button></footer>
      </section>`;
    document.body.appendChild(mask);
    mask.addEventListener("click", (event) => { if (event.target === mask) closeModal(); });
    mask.querySelectorAll("[data-v1711-close]").forEach((button) => button.addEventListener("click", closeModal));
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function ensureDock() {
    const host = root();
    const header = host?.querySelector(".uai-c-header");
    if (!header) return;
    let dock = header.querySelector("#uaiCompanionVoiceDockV1711");
    if (!dock) {
      dock = document.createElement("div");
      dock.id = "uaiCompanionVoiceDockV1711";
      dock.className = "uai-c-v1711-dock";
      dock.innerHTML = `<button type="button" data-v1711-voice>🔊 <span>声音</span></button><button type="button" data-v1711-review>♡ <span>本月回顾</span></button><button type="button" data-v1711-stop title="停止朗读">■</button>`;
      dock.querySelector("[data-v1711-voice]")?.addEventListener("click", openVoicePanel);
      dock.querySelector("[data-v1711-review]")?.addEventListener("click", openReview);
      dock.querySelector("[data-v1711-stop]")?.addEventListener("click", () => stop({ keepLast: true }));
      header.appendChild(dock);
    }
  }

  function ensureNeuralActions() {
    const rows = root()?.querySelectorAll("#uaiCompanionMessages .uai-c-message-row.assistant") || [];
    rows.forEach((row) => {
      const actions = row.querySelector(".uai-c-v1710-actions");
      const bubble = row.querySelector(".uai-c-bubble");
      if (!actions || !bubble || actions.querySelector("[data-v1711-neural]")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.v1711Neural = "1";
      button.textContent = "神经朗读";
      button.addEventListener("click", () => speak(bubble.textContent || "", { force: true }));
      actions.appendChild(button);
    });
  }

  function refreshUi() {
    const host = root();
    if (!host) return;
    ensureDock();
    ensureNeuralActions();
    const state = host.dataset.v1711VoiceState || "";
    const dock = host.querySelector("#uaiCompanionVoiceDockV1711");
    const voice = dock?.querySelector("[data-v1711-voice]");
    const stopButton = dock?.querySelector("[data-v1711-stop]");
    if (voice) {
      voice.classList.toggle("active", getSettings().enabled);
      voice.classList.toggle("loading", state === "loading");
      voice.classList.toggle("speaking", state === "speaking");
      voice.querySelector("span").textContent = state === "loading" ? "生成语音" : state === "speaking" ? "说话中" : "声音";
    }
    if (stopButton) stopButton.hidden = !state;
    const modalStatus = document.querySelector("#uaiCompanionV1711Mask [data-v1711-status]");
    if (modalStatus) {
      modalStatus.textContent = neuralStatusText;
      modalStatus.dataset.state = neuralStatus;
    }
  }

  function refresh() {
    if (!root()) {
      inputObserver?.disconnect?.();
      inputObserver = null;
      observedInput = null;
      stop({ keepLast: true });
      return;
    }
    bindInputObserver();
    refreshUi();
  }

  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });
  window.addEventListener("uai:companion-core-entered", refresh);
  window.addEventListener("uai:companion-functions-ready", refresh);
  window.addEventListener("uai:mode-refresh", refresh);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop({ keepLast: true }); else refresh(); });
  window.addEventListener("pagehide", () => stop({ keepLast: true }), { passive: true });

  document.documentElement.dataset.companionVoiceV1711Revision = REVISION;
  window.UnlimitedCompanionVoiceV1711 = {
    revision: REVISION,
    getSettings,
    setSettings,
    checkStatus,
    speak,
    stop,
    replay,
    refresh,
    openSettings: openVoicePanel,
    openReview
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
})();
