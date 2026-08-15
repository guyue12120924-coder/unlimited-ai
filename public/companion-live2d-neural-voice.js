// Companion V12.15 — Cloudflare neural TTS with true audio-driven Live2D lip sync.
(() => {
  const REVISION = "2026-08-15-v12.15-neural-voice-1";
  const KEY = "uai_companion_neural_voice_v1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  const DEFAULTS = {
    enabled: false,
    provider: "auto",
    playbackRate: 1,
    dialogueOnly: true,
    fallbackSystem: true
  };
  const PROVIDERS = new Set(["auto", "neural", "system"]);

  let boundRoot = null;
  let observer = null;
  let scheduled = false;
  let lastGenerating = false;
  let lastAssistantText = "";
  let activeAudio = null;
  let activeCleanup = null;
  let abortController = null;
  let playToken = 0;
  let lastText = "";
  let lastBlobs = [];
  let neuralStatus = "unknown";
  let neuralStatusText = "正在检查 Cloudflare 神经语音…";
  let migrated = false;

  function liveRoot() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const root = document.getElementById("uaiCompanionRoot");
    return root && !root.hidden && root.isConnected ? root : null;
  }

  function activeCharacterId() {
    return window.UnlimitedCompanionMulti?.activeCharacterId || localStorage.getItem(ACTIVE_KEY) || "legacy";
  }

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function readMap() {
    const value = safeParse(localStorage.getItem(KEY), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function hasOwnSettings() {
    return Boolean(readMap()[activeCharacterId()]);
  }

  function getSettings() {
    const value = readMap()[activeCharacterId()];
    return { ...DEFAULTS, ...(value && typeof value === "object" ? value : {}) };
  }

  function saveSettings(patch = {}) {
    const map = readMap();
    const id = activeCharacterId();
    const previous = getSettings();
    const provider = PROVIDERS.has(String(patch.provider ?? previous.provider)) ? String(patch.provider ?? previous.provider) : "auto";
    map[id] = {
      ...previous,
      ...patch,
      enabled: Boolean(patch.enabled ?? previous.enabled),
      provider,
      playbackRate: Math.max(.82, Math.min(1.18, Number(patch.playbackRate ?? previous.playbackRate) || 1)),
      dialogueOnly: Boolean(patch.dialogueOnly ?? previous.dialogueOnly),
      fallbackSystem: Boolean(patch.fallbackSystem ?? previous.fallbackSystem)
    };
    localStorage.setItem(KEY, JSON.stringify(map));
    refreshUi();
    return map[id];
  }

  function baseVoice() {
    return window.UnlimitedCompanionVoice || null;
  }

  function migrateAndDisableBaseAuto() {
    const base = baseVoice();
    if (!base) return false;
    const old = base.getSettings?.() || {};
    if (!migrated && !hasOwnSettings() && old.enabled) {
      const map = readMap();
      map[activeCharacterId()] = {
        ...DEFAULTS,
        enabled: true,
        dialogueOnly: old.dialogueOnly !== false
      };
      localStorage.setItem(KEY, JSON.stringify(map));
      migrated = true;
    }
    if (old.enabled) base.setSettings?.({ enabled: false });
    return true;
  }

  function extractSpeechText(text, settings = getSettings()) {
    const base = baseVoice();
    if (base?.extractSpeechText) {
      return base.extractSpeechText(text, {
        ...base.getSettings?.(),
        dialogueOnly: settings.dialogueOnly
      });
    }
    return String(text || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/（[^）]{0,220}）/g, " ")
      .replace(/\([^)]{0,220}\)/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1800);
  }

  function chunkText(text, max = 230) {
    const source = String(text || "").trim();
    if (!source) return [];
    const parts = source.match(/[^。！？!?；;\n]+[。！？!?；;\n]?/g) || [source];
    const chunks = [];
    let current = "";
    for (const part of parts) {
      const candidate = `${current}${part}`.trim();
      if (current && candidate.length > max) {
        chunks.push(current.trim());
        current = part.trim();
      } else current = candidate;
      while (current.length > max * 1.6) {
        chunks.push(current.slice(0, max));
        current = current.slice(max);
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.filter(Boolean).slice(0, 8);
  }

  async function checkNeuralStatus() {
    try {
      const response = await fetch(`/api/companion/tts/status?ts=${Date.now()}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      neuralStatus = response.ok && data.available ? "ready" : "unavailable";
      neuralStatusText = neuralStatus === "ready"
        ? "Cloudflare 神经语音已就绪 · 真实音频嘴型"
        : "神经语音暂不可用，将自动使用系统语音";
    } catch {
      neuralStatus = "unavailable";
      neuralStatusText = "神经语音连接失败，将自动使用系统语音";
    }
    refreshUi();
    return neuralStatus === "ready";
  }

  async function fetchNeuralChunk(text, signal) {
    const response = await fetch("/api/companion/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang: "zh" }),
      signal,
      cache: "no-store"
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || `Neural TTS HTTP ${response.status}`);
    }
    const type = response.headers.get("content-type") || "";
    if (!type.includes("audio/")) throw new Error("Neural TTS did not return audio");
    return response.blob();
  }

  function stopAudioOnly() {
    if (activeAudio) {
      try { activeAudio.pause(); } catch {}
      activeAudio.src = "";
    }
    activeCleanup?.();
    activeCleanup = null;
    activeAudio = null;
  }

  function setState(state = "") {
    const root = liveRoot();
    if (!root) return;
    if (state) root.dataset.v15NeuralVoiceState = state;
    else delete root.dataset.v15NeuralVoiceState;
    refreshUi();
  }

  function stop(options = {}) {
    playToken += 1;
    abortController?.abort?.();
    abortController = null;
    stopAudioOnly();
    try { baseVoice()?.stop?.({ silent: true }); } catch {}
    try { window.UnlimitedCompanionLive2DInteraction?.endVoice?.(); } catch {}
    setState("");
    if (!options.keepLast) {
      // Keep the generated blobs for replay; only current playback is stopped.
    }
  }

  function waitForAudio(audio, token) {
    return new Promise((resolve, reject) => {
      const finish = () => {
        audio.removeEventListener("ended", onEnd);
        audio.removeEventListener("error", onError);
        resolve();
      };
      const onEnd = () => finish();
      const onError = () => reject(new Error("Audio playback failed"));
      audio.addEventListener("ended", onEnd, { once: true });
      audio.addEventListener("error", onError, { once: true });
      if (token !== playToken) resolve();
    });
  }

  async function playBlobs(blobs, settings, options = {}) {
    if (!Array.isArray(blobs) || !blobs.length) return false;
    const token = ++playToken;
    setState(options.preview ? "preview" : "speaking");
    for (const blob of blobs) {
      if (token !== playToken) return false;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      activeAudio = audio;
      audio.preload = "auto";
      audio.playbackRate = settings.playbackRate;
      if ("preservesPitch" in audio) audio.preservesPitch = true;
      activeCleanup = baseVoice()?.attachAudio?.(audio, {
        label: options.preview ? "正在试听神经语音…" : "正在说给你听…"
      }) || null;
      try {
        await audio.play();
        await waitForAudio(audio, token);
      } finally {
        activeCleanup?.();
        activeCleanup = null;
        if (activeAudio === audio) activeAudio = null;
        URL.revokeObjectURL(url);
      }
    }
    if (token === playToken) setState("");
    return true;
  }

  async function speakSystem(text, options = {}) {
    const base = baseVoice();
    if (!base?.speak) return false;
    setState(options.preview ? "preview" : "speaking");
    const result = await base.speak(text, {
      force: true,
      preview: Boolean(options.preview),
      settings: {
        ...base.getSettings?.(),
        enabled: true,
        dialogueOnly: getSettings().dialogueOnly
      }
    });
    window.setTimeout(() => setState(""), 900);
    return result;
  }

  async function speak(text, options = {}) {
    const settings = { ...getSettings(), ...(options.settings || {}) };
    if (!settings.enabled && !options.force) return false;
    const cleaned = extractSpeechText(text, settings);
    if (!cleaned) return false;
    lastText = cleaned;
    const provider = options.provider || settings.provider;

    stop({ keepLast: true });
    if (provider === "system") return speakSystem(cleaned, options);

    const chunks = chunkText(cleaned);
    if (!chunks.length) return false;
    abortController = new AbortController();
    setState("loading");
    try {
      if (neuralStatus === "unknown") await checkNeuralStatus();
      if (neuralStatus !== "ready") throw new Error("Neural TTS unavailable");
      const blobs = await Promise.all(chunks.map((chunk) => fetchNeuralChunk(chunk, abortController.signal)));
      abortController = null;
      lastBlobs = blobs;
      await playBlobs(blobs, settings, options);
      return true;
    } catch (error) {
      abortController = null;
      if (error?.name === "AbortError") return false;
      neuralStatus = "unavailable";
      neuralStatusText = "神经语音本次失败，已切换系统语音";
      refreshUi();
      if ((provider === "auto" || settings.fallbackSystem) && baseVoice()?.supported?.()) {
        return speakSystem(cleaned, options);
      }
      setState("error");
      window.setTimeout(() => setState(""), 2200);
      return false;
    }
  }

  async function replay() {
    const settings = getSettings();
    if (lastBlobs.length && settings.provider !== "system") {
      stop({ keepLast: true });
      return playBlobs(lastBlobs, settings, { replay: true });
    }
    if (lastText) return speakSystem(lastText, { force: true });
    return false;
  }

  function lastAssistantBubble(root) {
    const rows = root?.querySelectorAll?.("#uaiCompanionMessages .uai-c-message-row.assistant");
    const row = rows?.length ? rows[rows.length - 1] : null;
    return String(row?.querySelector?.(".uai-c-bubble")?.textContent || "").trim();
  }

  function ensureHeaderControls(root) {
    const header = root.querySelector(".uai-c-header");
    if (!header) return;
    let actions = header.querySelector(".uai-c-v11-header-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "uai-c-v11-header-actions";
      header.appendChild(actions);
    }
    let dock = actions.querySelector("#uaiCompanionV15VoiceDock");
    if (!dock) {
      dock = document.createElement("div");
      dock.id = "uaiCompanionV15VoiceDock";
      dock.className = "uai-c-v15-voice-dock";
      dock.innerHTML = `
        <button id="uaiCompanionNeuralVoiceToggle" type="button"><i>🔇</i><span>语音</span></button>
        <button id="uaiCompanionVoiceReplay" type="button" title="重播上一条语音" aria-label="重播上一条语音">↻</button>
        <button id="uaiCompanionVoiceStop" type="button" title="停止播放" aria-label="停止播放">■</button>`;
      dock.querySelector("#uaiCompanionNeuralVoiceToggle")?.addEventListener("click", () => {
        const next = !getSettings().enabled;
        saveSettings({ enabled: next });
        if (!next) stop({ keepLast: true });
        else speak("听见啦。以后我的回复，我会亲口说给你听。", { force: true, preview: true });
      });
      dock.querySelector("#uaiCompanionVoiceReplay")?.addEventListener("click", replay);
      dock.querySelector("#uaiCompanionVoiceStop")?.addEventListener("click", () => stop({ keepLast: true }));
      actions.prepend(dock);
    }
  }

  function ensureSettingsPanel(root) {
    const mask = root.querySelector("#uaiCompanionModalMask");
    if (!mask || mask.hidden) return;
    const modal = mask.querySelector(".uai-c-modal");
    const reply = modal?.querySelector("#uaiCompanionReplyLength");
    if (!modal || !reply) return;
    let panel = modal.querySelector("#uaiCompanionV15VoicePanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "uaiCompanionV15VoicePanel";
      panel.className = "uai-c-v15-voice-panel";
      panel.innerHTML = `
        <div class="uai-c-v15-voice-head">
          <div><strong>角色语音 · Neural</strong><span>Cloudflare 神经 TTS 优先，失败自动回退系统语音</span></div>
          <label><input id="uaiV15VoiceEnabled" type="checkbox"><span></span></label>
        </div>
        <div class="uai-c-v15-engine-row">
          <label>语音引擎
            <select id="uaiV15VoiceProvider">
              <option value="auto">自动 · 神经语音优先</option>
              <option value="neural">Cloudflare 神经语音</option>
              <option value="system">浏览器系统语音</option>
            </select>
          </label>
          <label>语速 <b id="uaiV15VoiceRateLabel">1.00×</b><input id="uaiV15VoiceRate" type="range" min="0.82" max="1.18" step="0.02"></label>
        </div>
        <div class="uai-c-v15-checks">
          <label><input id="uaiV15DialogueOnly" type="checkbox">只朗读角色说出口的台词</label>
          <label><input id="uaiV15Fallback" type="checkbox">神经语音失败时自动回退系统语音</label>
        </div>
        <div class="uai-c-v15-voice-actions">
          <button id="uaiV15VoicePreview" type="button">试听神经语音</button>
          <button id="uaiV15VoiceReplayPanel" type="button">重播上一条</button>
          <small data-v15-status></small>
        </div>`;
      const oldPanel = modal.querySelector("#uaiCompanionVoicePanel");
      (oldPanel || reply.closest(".uai-c-field"))?.insertAdjacentElement("afterend", panel);
      panel.querySelector("#uaiV15VoiceEnabled")?.addEventListener("change", (event) => {
        saveSettings({ enabled: Boolean(event.target.checked) });
        if (!event.target.checked) stop({ keepLast: true });
      });
      panel.querySelector("#uaiV15VoiceProvider")?.addEventListener("change", (event) => saveSettings({ provider: event.target.value }));
      panel.querySelector("#uaiV15VoiceRate")?.addEventListener("input", (event) => saveSettings({ playbackRate: Number(event.target.value) }));
      panel.querySelector("#uaiV15DialogueOnly")?.addEventListener("change", (event) => saveSettings({ dialogueOnly: Boolean(event.target.checked) }));
      panel.querySelector("#uaiV15Fallback")?.addEventListener("change", (event) => saveSettings({ fallbackSystem: Boolean(event.target.checked) }));
      panel.querySelector("#uaiV15VoicePreview")?.addEventListener("click", () => speak("晚上好呀。今天终于又见到你了，要不要陪我多待一会儿？", { force: true, preview: true, provider: "neural" }));
      panel.querySelector("#uaiV15VoiceReplayPanel")?.addEventListener("click", replay);
    }
  }

  function refreshUi() {
    const root = liveRoot();
    if (!root) return;
    root.classList.add("uai-c-v15-neural-voice-ready");
    ensureHeaderControls(root);
    ensureSettingsPanel(root);
    const settings = getSettings();
    const state = root.dataset.v15NeuralVoiceState || "";
    const toggle = root.querySelector("#uaiCompanionNeuralVoiceToggle");
    const replayButton = root.querySelector("#uaiCompanionVoiceReplay");
    const stopButton = root.querySelector("#uaiCompanionVoiceStop");
    if (toggle) {
      toggle.classList.toggle("active", settings.enabled);
      toggle.classList.toggle("speaking", state === "speaking" || state === "preview");
      toggle.classList.toggle("loading", state === "loading");
      toggle.innerHTML = `<i>${settings.enabled ? "🔊" : "🔇"}</i><span>${state === "loading" ? "生成语音" : state === "speaking" ? "说话中" : "语音"}</span>`;
    }
    if (replayButton) replayButton.disabled = !lastText;
    if (stopButton) stopButton.hidden = !["loading", "speaking", "preview"].includes(state);

    const panel = root.querySelector("#uaiCompanionV15VoicePanel");
    if (panel) {
      const enabled = panel.querySelector("#uaiV15VoiceEnabled");
      const provider = panel.querySelector("#uaiV15VoiceProvider");
      const rate = panel.querySelector("#uaiV15VoiceRate");
      const rateLabel = panel.querySelector("#uaiV15VoiceRateLabel");
      const dialogueOnly = panel.querySelector("#uaiV15DialogueOnly");
      const fallback = panel.querySelector("#uaiV15Fallback");
      const replayPanel = panel.querySelector("#uaiV15VoiceReplayPanel");
      const status = panel.querySelector("[data-v15-status]");
      if (enabled) enabled.checked = settings.enabled;
      if (provider) provider.value = settings.provider;
      if (rate) rate.value = String(settings.playbackRate);
      if (rateLabel) rateLabel.textContent = `${settings.playbackRate.toFixed(2)}×`;
      if (dialogueOnly) dialogueOnly.checked = settings.dialogueOnly;
      if (fallback) fallback.checked = settings.fallbackSystem;
      if (replayPanel) replayPanel.disabled = !lastText;
      if (status) {
        status.textContent = neuralStatusText;
        status.dataset.state = neuralStatus;
      }
    }
  }

  function sync() {
    scheduled = false;
    const root = liveRoot();
    if (!root) return;
    bind(root);
    migrateAndDisableBaseAuto();
    refreshUi();

    const generating = Boolean(root.querySelector("#uaiCompanionComposerWrap.generating"));
    const assistantText = lastAssistantBubble(root);
    if (generating && !lastGenerating) stop({ keepLast: true });
    if (!generating && lastGenerating && assistantText && assistantText !== lastAssistantText && getSettings().enabled) {
      window.setTimeout(() => {
        const activeRoot = liveRoot();
        if (activeRoot && !activeRoot.querySelector("#uaiCompanionComposerWrap.generating")) speak(assistantText);
      }, 180);
    }
    lastGenerating = generating;
    if (!generating && assistantText) lastAssistantText = assistantText;
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
    lastGenerating = Boolean(root.querySelector("#uaiCompanionComposerWrap.generating"));
    lastAssistantText = lastAssistantBubble(root);
    observer = new MutationObserver(schedule);
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "hidden"]
    });
  }

  function init() {
    document.documentElement.dataset.companionNeuralVoiceRevision = REVISION;
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode", "class"]
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop({ keepLast: true });
      else schedule();
    });
    window.addEventListener("pagehide", () => stop({ keepLast: true }), { passive: true });
    window.UnlimitedCompanionNeuralVoice = {
      revision: REVISION,
      getSettings,
      setSettings: saveSettings,
      checkStatus: checkNeuralStatus,
      extractSpeechText,
      speak,
      stop,
      replay,
      refresh: schedule
    };
    const waitForBase = () => {
      if (migrateAndDisableBaseAuto()) {
        checkNeuralStatus();
        schedule();
      } else window.setTimeout(waitForBase, 80);
    };
    waitForBase();
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
