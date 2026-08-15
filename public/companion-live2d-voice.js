// Companion V12.14 — zero-server voice replies for Live2D companion mode.
(() => {
  const REVISION = "2026-08-15-v12.14-live2d-voice-1";
  const KEY = "uai_companion_voice_v1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  const DEFAULTS = {
    enabled: false,
    voiceURI: "",
    rate: 0.96,
    pitch: 1.06,
    volume: 1,
    dialogueOnly: true
  };

  let voices = [];
  let boundRoot = null;
  let observer = null;
  let scheduled = false;
  let lastGenerating = false;
  let lastAssistantText = "";
  let speakToken = 0;
  let mouthTimer = null;
  let activeUtterance = null;
  let previewing = false;
  const audioBindings = new WeakMap();

  function supported() {
    return typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";
  }

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
    const parsed = safeParse(localStorage.getItem(KEY), {});
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  }

  function getSettings() {
    const map = readMap();
    const current = map[activeCharacterId()];
    return { ...DEFAULTS, ...(current && typeof current === "object" ? current : {}) };
  }

  function saveSettings(patch = {}) {
    const map = readMap();
    const id = activeCharacterId();
    const previous = getSettings();
    const next = {
      ...previous,
      ...patch,
      enabled: Boolean(patch.enabled ?? previous.enabled),
      voiceURI: String(patch.voiceURI ?? previous.voiceURI ?? ""),
      rate: Math.max(.72, Math.min(1.24, Number(patch.rate ?? previous.rate) || DEFAULTS.rate)),
      pitch: Math.max(.72, Math.min(1.28, Number(patch.pitch ?? previous.pitch) || DEFAULTS.pitch)),
      volume: Math.max(0, Math.min(1, Number(patch.volume ?? previous.volume) || DEFAULTS.volume)),
      dialogueOnly: Boolean(patch.dialogueOnly ?? previous.dialogueOnly)
    };
    map[id] = next;
    localStorage.setItem(KEY, JSON.stringify(map));
    refreshUi();
    return next;
  }

  function refreshVoices() {
    if (!supported()) return [];
    voices = window.speechSynthesis.getVoices?.() || [];
    refreshUi();
    return voices;
  }

  function voiceScore(voice) {
    const name = String(voice?.name || "").toLowerCase();
    const lang = String(voice?.lang || "").toLowerCase();
    let score = 0;
    if (lang.startsWith("zh-cn") || lang.startsWith("zh-hans")) score += 90;
    else if (lang.startsWith("zh")) score += 72;
    else if (lang.startsWith("ja")) score += 24;
    if (/xiaoxiao|xiaoyi|xiaohan|xiaomeng|xiaorui|tingting|huihui|yaoyao|female|woman|女声/.test(name)) score += 26;
    if (/natural|neural|online/.test(name)) score += 8;
    if (voice?.default) score += 4;
    return score;
  }

  function chooseVoice(settings = getSettings()) {
    if (!voices.length) refreshVoices();
    const exact = voices.find((voice) => voice.voiceURI === settings.voiceURI);
    if (exact) return exact;
    return [...voices].sort((a, b) => voiceScore(b) - voiceScore(a))[0] || null;
  }

  function stripMarkdown(text) {
    return String(text || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/[>*_~]+/g, " ");
  }

  function extractSpeechText(text, settings = getSettings()) {
    let value = stripMarkdown(text).replace(/\r/g, "").trim();
    if (!value || /这次没连上模型|发送失败/.test(value)) return "";

    if (settings.dialogueOnly) {
      const quoted = [];
      const quotePatterns = [/“([^”]{2,500})”/g, /「([^」]{2,500})」/g, /『([^』]{2,500})』/g];
      for (const pattern of quotePatterns) {
        for (const match of value.matchAll(pattern)) quoted.push(match[1].trim());
      }
      if (quoted.join("").length >= 4) value = quoted.join("。 ");
      else {
        value = value
          .replace(/（[^）]{0,220}）/g, " ")
          .replace(/\([^)]{0,220}\)/g, " ");
      }
    }

    return value
      .replace(/\s+/g, " ")
      .replace(/([。！？!?])\1+/g, "$1")
      .trim()
      .slice(0, 1800);
  }

  function chunkSpeech(text, max = 110) {
    const source = String(text || "").trim();
    if (!source) return [];
    const parts = source.match(/[^。！？!?；;，,\n]+[。！？!?；;，,\n]?/g) || [source];
    const chunks = [];
    let current = "";
    for (const part of parts) {
      const next = `${current}${part}`.trim();
      if (current && next.length > max) {
        chunks.push(current.trim());
        current = part.trim();
      } else current = next;
      while (current.length > max * 1.45) {
        chunks.push(current.slice(0, max));
        current = current.slice(max);
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.filter(Boolean);
  }

  function interactionApi() {
    return window.UnlimitedCompanionLive2DInteraction || null;
  }

  function stopMouthCadence() {
    if (mouthTimer) window.clearInterval(mouthTimer);
    mouthTimer = null;
    try { interactionApi()?.setVoiceLevel?.(0); } catch {}
  }

  function startMouthCadence() {
    stopMouthCadence();
    let phase = Math.random() * Math.PI;
    mouthTimer = window.setInterval(() => {
      phase += .82 + Math.random() * .22;
      const syllable = Math.abs(Math.sin(phase));
      const amount = .10 + syllable * (.48 + Math.random() * .20);
      try { interactionApi()?.setVoiceLevel?.(amount); } catch {}
    }, 92);
  }

  function setVoiceState(state) {
    const root = liveRoot();
    if (!root) return;
    if (state) root.dataset.v129VoiceState = state;
    else delete root.dataset.v129VoiceState;
    root.querySelector("#uaiCompanionVoiceToggle")?.classList.toggle("speaking", state === "speaking" || state === "preview");
  }

  function stop(options = {}) {
    speakToken += 1;
    activeUtterance = null;
    previewing = false;
    stopMouthCadence();
    try { window.speechSynthesis?.cancel?.(); } catch {}
    try { interactionApi()?.endVoice?.(); } catch {}
    setVoiceState("");
    if (!options.silent) refreshUi();
  }

  async function speak(text, options = {}) {
    if (!supported()) return false;
    const settings = { ...getSettings(), ...(options.settings || {}) };
    if (!settings.enabled && !options.force) return false;
    const cleaned = extractSpeechText(text, settings);
    if (!cleaned) return false;
    const chunks = chunkSpeech(cleaned);
    if (!chunks.length) return false;

    stop({ silent: true });
    const token = ++speakToken;
    previewing = Boolean(options.preview);
    setVoiceState(previewing ? "preview" : "speaking");
    try { interactionApi()?.beginVoice?.({ label: previewing ? "正在试听声音…" : "正在说给你听…" }); } catch {}
    startMouthCadence();

    const voice = chooseVoice(settings);
    let index = 0;
    const next = () => {
      if (token !== speakToken) return;
      if (index >= chunks.length) {
        stop({ silent: true });
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      activeUtterance = utterance;
      utterance.lang = voice?.lang || "zh-CN";
      if (voice) utterance.voice = voice;
      utterance.rate = settings.rate;
      utterance.pitch = settings.pitch;
      utterance.volume = settings.volume;
      utterance.onboundary = () => {
        const pulse = .30 + Math.random() * .50;
        try { interactionApi()?.setVoiceLevel?.(pulse); } catch {}
      };
      utterance.onend = () => {
        if (token !== speakToken) return;
        index += 1;
        window.setTimeout(next, 28);
      };
      utterance.onerror = (event) => {
        if (event?.error === "canceled" || event?.error === "interrupted") return;
        stop({ silent: true });
      };
      try { window.speechSynthesis.speak(utterance); }
      catch { stop({ silent: true }); }
    };
    next();
    return true;
  }

  function lastAssistantBubble(root) {
    const rows = root?.querySelectorAll?.("#uaiCompanionMessages .uai-c-message-row.assistant");
    const row = rows?.length ? rows[rows.length - 1] : null;
    return String(row?.querySelector?.(".uai-c-bubble")?.textContent || "").trim();
  }

  function ensureHeaderToggle(root) {
    const header = root.querySelector(".uai-c-header");
    if (!header) return;
    let actions = header.querySelector(".uai-c-v11-header-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "uai-c-v11-header-actions";
      header.appendChild(actions);
    }
    let button = actions.querySelector("#uaiCompanionVoiceToggle");
    if (!button) {
      button = document.createElement("button");
      button.id = "uaiCompanionVoiceToggle";
      button.type = "button";
      button.className = "uai-c-v14-voice-trigger";
      button.addEventListener("click", () => {
        if (!supported()) return;
        const nextEnabled = !getSettings().enabled;
        saveSettings({ enabled: nextEnabled });
        if (!nextEnabled) stop();
        else speak("听见啦。以后我的回复，会说给你听。", { force: true, preview: true });
      });
      actions.prepend(button);
    }
    const settings = getSettings();
    button.disabled = !supported();
    button.classList.toggle("active", settings.enabled && supported());
    button.innerHTML = `<i>${settings.enabled && supported() ? "🔊" : "🔇"}</i><span>语音</span>`;
    button.title = supported() ? (settings.enabled ? "关闭自动语音回复" : "开启自动语音回复") : "当前浏览器不支持语音合成";
  }

  function voiceOptionLabel(voice) {
    const lang = voice?.lang ? ` · ${voice.lang}` : "";
    return `${voice?.name || "系统语音"}${lang}`;
  }

  function populateVoiceSelect(select) {
    if (!select) return;
    const settings = getSettings();
    const current = settings.voiceURI;
    const sorted = [...voices].sort((a, b) => voiceScore(b) - voiceScore(a));
    select.innerHTML = `<option value="">自动选择中文音色</option>${sorted.map((voice) => `<option value="${String(voice.voiceURI).replaceAll("&", "&amp;").replaceAll('"', "&quot;")}">${voiceOptionLabel(voice)}</option>`).join("")}`;
    select.value = sorted.some((voice) => voice.voiceURI === current) ? current : "";
  }

  function ensureSettingsPanel(root) {
    const mask = root.querySelector("#uaiCompanionModalMask");
    if (!mask || mask.hidden) return;
    const modal = mask.querySelector(".uai-c-modal");
    const replySelect = modal?.querySelector("#uaiCompanionReplyLength");
    if (!modal || !replySelect) return;
    let panel = modal.querySelector("#uaiCompanionVoicePanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "uaiCompanionVoicePanel";
      panel.className = "uai-c-v14-voice-panel";
      panel.innerHTML = `
        <div class="uai-c-v14-voice-head">
          <div><strong>角色语音</strong><span>回复完成后自动朗读，并驱动 Live2D 嘴型</span></div>
          <label><input id="uaiCompanionVoiceEnabled" type="checkbox" /><span></span></label>
        </div>
        <div class="uai-c-v14-voice-grid">
          <label>系统音色<select id="uaiCompanionVoiceSelect"></select></label>
          <label>语速 <b id="uaiCompanionVoiceRateLabel"></b><input id="uaiCompanionVoiceRate" type="range" min="0.72" max="1.24" step="0.02" /></label>
        </div>
        <label class="uai-c-v14-dialogue-only"><input id="uaiCompanionVoiceDialogueOnly" type="checkbox" />优先只朗读角色说出口的台词，不朗读括号动作描写</label>
        <div class="uai-c-v14-voice-actions"><button id="uaiCompanionVoicePreview" type="button">试听</button><small></small></div>`;
      replySelect.closest(".uai-c-field")?.insertAdjacentElement("afterend", panel);

      panel.querySelector("#uaiCompanionVoiceEnabled")?.addEventListener("change", (event) => {
        saveSettings({ enabled: Boolean(event.target.checked) });
        if (!event.target.checked) stop();
      });
      panel.querySelector("#uaiCompanionVoiceSelect")?.addEventListener("change", (event) => saveSettings({ voiceURI: event.target.value }));
      panel.querySelector("#uaiCompanionVoiceRate")?.addEventListener("input", (event) => {
        saveSettings({ rate: Number(event.target.value) });
        refreshSettingsPanel(panel);
      });
      panel.querySelector("#uaiCompanionVoiceDialogueOnly")?.addEventListener("change", (event) => saveSettings({ dialogueOnly: Boolean(event.target.checked) }));
      panel.querySelector("#uaiCompanionVoicePreview")?.addEventListener("click", () => speak("晚上好呀。很高兴又见到你，要不要陪我聊一会儿？", { force: true, preview: true }));
    }
    refreshSettingsPanel(panel);
  }

  function refreshSettingsPanel(panel) {
    if (!panel) return;
    const settings = getSettings();
    const enabled = panel.querySelector("#uaiCompanionVoiceEnabled");
    const select = panel.querySelector("#uaiCompanionVoiceSelect");
    const rate = panel.querySelector("#uaiCompanionVoiceRate");
    const rateLabel = panel.querySelector("#uaiCompanionVoiceRateLabel");
    const dialogueOnly = panel.querySelector("#uaiCompanionVoiceDialogueOnly");
    const preview = panel.querySelector("#uaiCompanionVoicePreview");
    const note = panel.querySelector(".uai-c-v14-voice-actions small");
    if (enabled) enabled.checked = settings.enabled;
    if (rate) rate.value = String(settings.rate);
    if (rateLabel) rateLabel.textContent = `${settings.rate.toFixed(2)}×`;
    if (dialogueOnly) dialogueOnly.checked = settings.dialogueOnly;
    populateVoiceSelect(select);
    if (preview) preview.disabled = !supported();
    if (note) note.textContent = supported() ? "系统音色取决于你的浏览器和操作系统。" : "当前浏览器不支持 Web Speech 语音合成。";
    panel.classList.toggle("unsupported", !supported());
  }

  function refreshUi() {
    const root = liveRoot();
    if (!root) return;
    ensureHeaderToggle(root);
    ensureSettingsPanel(root);
  }

  function attachAudio(audio, options = {}) {
    if (!audio?.addEventListener) return () => {};
    if (audioBindings.has(audio)) return audioBindings.get(audio);
    let ctx = null;
    let analyser = null;
    let source = null;
    let raf = 0;
    let data = null;

    const stopAnalyse = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      try { interactionApi()?.setVoiceLevel?.(0); } catch {}
    };
    const analyse = () => {
      if (!analyser || !data || audio.paused || audio.ended) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const n = (data[i] - 128) / 128;
        sum += n * n;
      }
      const rms = Math.sqrt(sum / data.length);
      const level = Math.max(.04, Math.min(1, rms * 4.8));
      try { interactionApi()?.setVoiceLevel?.(level); } catch {}
      raf = requestAnimationFrame(analyse);
    };
    const onPlay = async () => {
      stop({ silent: true });
      interactionApi()?.beginVoice?.({ label: options.label || "正在和你说话…" });
      setVoiceState("speaking");
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          ctx ||= new AudioContext();
          if (ctx.state === "suspended") await ctx.resume();
          if (!source) {
            source = ctx.createMediaElementSource(audio);
            analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            data = new Uint8Array(analyser.fftSize);
            source.connect(analyser);
            analyser.connect(ctx.destination);
          }
          analyse();
        } else startMouthCadence();
      } catch {
        startMouthCadence();
      }
    };
    const onPause = () => {
      stopAnalyse();
      stopMouthCadence();
      if (!audio.ended) interactionApi()?.endVoice?.();
      setVoiceState("");
    };
    const onEnd = () => {
      stopAnalyse();
      stopMouthCadence();
      interactionApi()?.endVoice?.();
      setVoiceState("");
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnd);
    const cleanup = () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnd);
      stopAnalyse();
      try { source?.disconnect?.(); } catch {}
      try { analyser?.disconnect?.(); } catch {}
      try { ctx?.close?.(); } catch {}
      audioBindings.delete(audio);
    };
    audioBindings.set(audio, cleanup);
    return cleanup;
  }

  function sync() {
    scheduled = false;
    const root = liveRoot();
    if (!root) return;
    bind(root);
    refreshUi();
    const generating = Boolean(root.querySelector("#uaiCompanionComposerWrap.generating"));
    const assistantText = lastAssistantBubble(root);
    if (generating && !lastGenerating) stop({ silent: true });
    if (!generating && lastGenerating && assistantText && assistantText !== lastAssistantText && getSettings().enabled) {
      window.setTimeout(() => {
        if (!liveRoot()?.querySelector("#uaiCompanionComposerWrap.generating")) speak(assistantText);
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
    document.documentElement.dataset.companionLive2dVoiceRevision = REVISION;
    if (supported()) {
      refreshVoices();
      window.speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
    }
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode", "class"]
    });
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop({ silent: true }); else schedule(); });
    window.addEventListener("pagehide", () => stop({ silent: true }), { passive: true });
    window.UnlimitedCompanionVoice = {
      revision: REVISION,
      supported,
      getSettings,
      setSettings: saveSettings,
      getVoices: () => [...voices],
      refreshVoices,
      extractSpeechText,
      speak,
      stop,
      attachAudio,
      refresh: schedule
    };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
