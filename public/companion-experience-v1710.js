// V17.10 safe companion experience: relationship presence, quick reply tools, local TTS and optional voice input.
(() => {
  const REVISION = "2026-08-22-v17.10-safe-experience-restore";
  if (window.UnlimitedCompanionExperienceV1710) return;

  const MAX_RECORD_MS = 30000;
  let messageObserver = null;
  let observedMessages = null;
  let enhanceFrame = 0;
  let recorder = null;
  let mediaStream = null;
  let recordChunks = [];
  let recordTimer = 0;
  let transcribeController = null;
  let micState = "idle";
  let speechToken = 0;
  let activeSpeechButton = null;

  function root() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const host = document.getElementById("uaiCompanionRoot");
    return host && !host.hidden ? host : null;
  }

  function state() {
    return window.UnlimitedCompanion?.getState?.() || null;
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
    showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function relationshipStats() {
    const current = state();
    const profile = current?.profile || {};
    const sessions = Array.isArray(current?.sessions) ? current.sessions : [];
    const messages = sessions.reduce((sum, session) => sum + (Array.isArray(session?.messages) ? session.messages.length : 0), 0);
    const memories = Array.isArray(current?.memories) ? current.memories.length : 0;
    const createdAt = Number(profile.createdAt) || Date.now();
    const daysKnown = Math.max(1, Math.floor((Date.now() - createdAt) / 86400000) + 1);
    return { daysKnown, messages, sessions: sessions.length, memories };
  }

  function relationshipStage(stats) {
    try {
      const stage = window.UnlimitedCompanionProfileRestore?.relationshipStage?.(stats);
      if (stage?.label) return stage;
    } catch {}
    if (stats.daysKnown >= 7 && stats.messages >= 180 && stats.sessions >= 8) return { key: "in-sync", label: "很有默契" };
    if (stats.daysKnown >= 3 && stats.messages >= 70 && stats.sessions >= 4) return { key: "close", label: "渐渐亲近" };
    if (stats.messages >= 20 || stats.sessions >= 2) return { key: "familiar", label: "越来越熟" };
    return { key: "new", label: "刚刚认识" };
  }

  function daypart() {
    const hour = new Date().getHours();
    if (hour < 6) return { key: "late", label: "深夜 · 还陪着你" };
    if (hour < 11) return { key: "morning", label: "早上 · 在线" };
    if (hour < 18) return { key: "day", label: "白天 · 在线" };
    if (hour < 23) return { key: "evening", label: "晚上 · 在线" };
    return { key: "late", label: "夜深了 · 还在" };
  }

  function ensureRelationshipCard() {
    const host = root();
    const profileCard = host?.querySelector("#uaiCompanionProfileCard");
    if (!host || !profileCard || !state()?.profile) return;
    let card = host.querySelector("#uaiCompanionRelationshipV1710");
    if (!card) {
      card = document.createElement("button");
      card.type = "button";
      card.id = "uaiCompanionRelationshipV1710";
      card.className = "uai-c-v1710-relationship";
      card.addEventListener("click", () => {
        if (window.UnlimitedCompanionProfileRestore?.showCharacterProfile) {
          window.UnlimitedCompanionProfileRestore.showCharacterProfile();
        } else showToast("关系记录仍在加载，稍后再试");
      });
      profileCard.insertAdjacentElement("afterend", card);
    }
    const stats = relationshipStats();
    const stage = relationshipStage(stats);
    card.dataset.stage = stage.key || "new";
    card.innerHTML = `
      <span class="uai-c-v1710-heart" aria-hidden="true">♡</span>
      <span class="uai-c-v1710-relation-copy"><strong>${stage.label}</strong><small>认识 ${stats.daysKnown} 天 · ${stats.messages} 条消息</small></span>
      <span class="uai-c-v1710-memory">${stats.memories} 记忆</span>`;
  }

  function ensurePresence() {
    const host = root();
    const title = host?.querySelector(".uai-c-title");
    if (!host || !title) return;
    let presence = title.querySelector("#uaiCompanionPresenceV1710");
    if (!presence) {
      presence = document.createElement("small");
      presence.id = "uaiCompanionPresenceV1710";
      presence.className = "uai-c-v1710-presence";
      title.appendChild(presence);
    }
    const part = daypart();
    host.dataset.v1710Daypart = part.key;
    presence.textContent = part.label;
  }

  function composerInput() {
    return root()?.querySelector("#uaiCompanionInput") || null;
  }

  function fillComposer(text) {
    const input = composerInput();
    if (!input) return;
    if (input.disabled) {
      showToast("当前回复还在生成，请先停止再使用快捷操作");
      return;
    }
    input.value = String(text || "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    try { input.setSelectionRange(input.value.length, input.value.length); } catch {}
    showToast("已放入输入框，可修改后发送");
  }

  function referencePrompt(kind, text) {
    const excerpt = String(text || "").replace(/\s+/g, " ").trim().slice(0, 180);
    const anchor = excerpt ? `\n\n我指的是你刚才这段：\n“${excerpt}${String(text || "").length > 180 ? "…" : ""}”` : "";
    if (kind === "continue") return `继续刚才这个话题，自然接着说下去。保持当前角色口吻和情绪，不要重复已经说过的内容。${anchor}`;
    if (kind === "rephrase") return `把你刚才这段换一种更自然、更贴近当前角色说话方式的表达。意思保持一致，不要继续新的剧情。${anchor}`;
    if (kind === "shorter") return `把你刚才这段说得更简短一点，保留最重要的信息和情绪，不要显得像总结报告。${anchor}`;
    return `把你刚才这段适当展开，多一点细节、情绪和互动感，但不要重复灌水，也不要改变已经发生的事实。${anchor}`;
  }

  function speechSupported() {
    return Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
  }

  function cleanSpeechText(text) {
    return String(text || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/（[^）]{0,260}）/g, " ")
      .replace(/\([^)]{0,260}\)/g, " ")
      .replace(/[*_#>`~]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2200);
  }

  function stopSpeech() {
    speechToken += 1;
    try { window.speechSynthesis?.cancel?.(); } catch {}
    if (activeSpeechButton) {
      activeSpeechButton.classList.remove("is-speaking");
      activeSpeechButton.textContent = "朗读";
    }
    activeSpeechButton = null;
  }

  function speak(text, button) {
    if (!speechSupported()) return showToast("当前浏览器不支持本地语音朗读");
    if (button?.classList.contains("is-speaking")) {
      stopSpeech();
      return;
    }
    stopSpeech();
    const speechText = cleanSpeechText(text);
    if (!speechText) return showToast("这条消息没有可朗读的文字");
    const token = ++speechToken;
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = "zh-CN";
    utterance.rate = 1;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const chineseVoice = voices.find((voice) => /^zh(?:-|_)/i.test(voice.lang || ""));
    if (chineseVoice) utterance.voice = chineseVoice;
    utterance.onstart = () => {
      if (token !== speechToken) return;
      activeSpeechButton = button || null;
      button?.classList.add("is-speaking");
      if (button) button.textContent = "停止";
    };
    const finish = () => {
      if (token !== speechToken) return;
      if (button) {
        button.classList.remove("is-speaking");
        button.textContent = "朗读";
      }
      if (activeSpeechButton === button) activeSpeechButton = null;
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    try { window.speechSynthesis.speak(utterance); }
    catch { finish(); showToast("朗读启动失败"); }
  }

  function ensureMessageActions() {
    const host = root();
    const rows = host?.querySelectorAll("#uaiCompanionMessages .uai-c-message-row.assistant") || [];
    rows.forEach((row) => {
      const bubble = row.querySelector(".uai-c-bubble");
      if (!bubble || bubble.querySelector(".uai-c-typing") || row.querySelector(":scope .uai-c-v1710-actions")) return;
      const text = bubble.textContent?.trim() || "";
      if (!text) return;
      const actions = document.createElement("div");
      actions.className = "uai-c-v1710-actions";
      const specs = [
        ["continue", "继续聊"],
        ["rephrase", "换个说法"],
        ["shorter", "简短"],
        ["detail", "详细"]
      ];
      specs.forEach(([kind, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => fillComposer(referencePrompt(kind, text)));
        actions.appendChild(button);
      });
      if (speechSupported()) {
        const voice = document.createElement("button");
        voice.type = "button";
        voice.className = "uai-c-v1710-speak";
        voice.textContent = "朗读";
        voice.addEventListener("click", () => speak(text, voice));
        actions.appendChild(voice);
      }
      const existingActions = row.querySelector(".uai-c-v8-message-actions");
      const target = existingActions?.parentElement || bubble.parentElement;
      target?.appendChild(actions);
    });
  }

  function scheduleEnhance() {
    if (enhanceFrame) return;
    enhanceFrame = requestAnimationFrame(() => {
      enhanceFrame = 0;
      ensureMessageActions();
      ensureRelationshipCard();
      ensurePresence();
      ensureMicUi();
    });
  }

  function bindMessageObserver() {
    const container = root()?.querySelector("#uaiCompanionMessages");
    if (!container || container === observedMessages) return;
    messageObserver?.disconnect?.();
    observedMessages = container;
    messageObserver = new MutationObserver(scheduleEnhance);
    messageObserver.observe(container, { childList: true });
  }

  function micSupported() {
    return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  }

  function chooseMimeType() {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || "";
  }

  function stopTracks() {
    try { mediaStream?.getTracks?.().forEach((track) => track.stop()); } catch {}
    mediaStream = null;
  }

  function setMicState(next, message = "") {
    micState = next;
    const host = root();
    const button = host?.querySelector("#uaiCompanionMicV1710");
    const note = host?.querySelector("#uaiCompanionMicNoteV1710");
    if (button) {
      button.classList.toggle("is-recording", next === "recording");
      button.classList.toggle("is-loading", next === "requesting" || next === "transcribing");
      button.disabled = next === "requesting" || next === "transcribing" || Boolean(composerInput()?.disabled);
      button.textContent = next === "recording" ? "■" : next === "transcribing" ? "…" : "🎙";
      button.title = next === "recording" ? "结束录音并识别" : "语音输入";
    }
    if (note) {
      const fallback = next === "requesting" ? "正在请求麦克风权限…" : next === "recording" ? "正在听你说话，再点一次结束" : next === "transcribing" ? "正在识别语音…" : "";
      note.textContent = message || fallback;
      note.hidden = !note.textContent;
    }
  }

  function appendTranscript(text) {
    const input = composerInput();
    const value = String(text || "").trim();
    if (!input || !value) return;
    const before = String(input.value || "").trim();
    input.value = before ? `${before}${/[。！？!?，,；;：:]$/.test(before) ? " " : "，"}${value}` : value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }

  async function transcribe(blob) {
    if (!blob || blob.size < 300) {
      setMicState("idle", "没有听到有效语音，请再试一次");
      window.setTimeout(() => setMicState("idle"), 1800);
      return;
    }
    transcribeController?.abort?.();
    const controller = new AbortController();
    transcribeController = controller;
    setMicState("transcribing");
    try {
      const response = await fetch("/api/companion/stt", {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
        signal: controller.signal,
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      if (controller !== transcribeController) return;
      const text = String(payload?.text || "").trim();
      if (!text) throw new Error("没有识别到文字");
      appendTranscript(text);
      setMicState("idle", "语音已转成文字，可修改后发送");
      window.setTimeout(() => setMicState("idle"), 2000);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setMicState("idle", error?.message || "语音识别失败，请再试一次");
      window.setTimeout(() => setMicState("idle"), 2400);
    } finally {
      if (controller === transcribeController) transcribeController = null;
    }
  }

  function finishRecording(discard = false) {
    if (!recorder || recorder.state === "inactive") return;
    recorder.__uaiDiscard = Boolean(discard);
    try { recorder.stop(); } catch {}
  }

  async function toggleRecording() {
    if (!micSupported() || composerInput()?.disabled) return;
    if (micState === "recording") {
      finishRecording(false);
      return;
    }
    if (micState !== "idle") return;
    stopSpeech();
    setMicState("requesting");
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      recordChunks = [];
      const mimeType = chooseMimeType();
      recorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);
      const current = recorder;
      current.addEventListener("dataavailable", (event) => { if (event.data?.size) recordChunks.push(event.data); });
      current.addEventListener("stop", () => {
        clearTimeout(recordTimer);
        stopTracks();
        const discard = Boolean(current.__uaiDiscard);
        const blob = new Blob(recordChunks, { type: current.mimeType || recordChunks[0]?.type || "audio/webm" });
        recordChunks = [];
        if (recorder === current) recorder = null;
        if (discard) setMicState("idle");
        else transcribe(blob);
      }, { once: true });
      current.addEventListener("error", () => {
        clearTimeout(recordTimer);
        stopTracks();
        recordChunks = [];
        if (recorder === current) recorder = null;
        setMicState("idle", "录音失败，请检查麦克风权限");
      }, { once: true });
      current.start(250);
      setMicState("recording");
      recordTimer = window.setTimeout(() => finishRecording(false), MAX_RECORD_MS);
    } catch (error) {
      stopTracks();
      recorder = null;
      const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
      setMicState("idle", denied ? "麦克风权限被拒绝，请在浏览器中允许麦克风" : "无法打开麦克风");
      window.setTimeout(() => setMicState("idle"), 2600);
    }
  }

  function ensureMicUi() {
    if (!micSupported()) return;
    const host = root();
    const composer = host?.querySelector(".uai-c-composer");
    const send = composer?.querySelector("#uaiCompanionSend");
    if (!composer || !send) return;
    let button = composer.querySelector("#uaiCompanionMicV1710");
    if (!button) {
      button = document.createElement("button");
      button.id = "uaiCompanionMicV1710";
      button.className = "uai-c-v1710-mic";
      button.type = "button";
      button.setAttribute("aria-label", "语音输入");
      button.title = "语音输入";
      button.textContent = "🎙";
      button.addEventListener("click", toggleRecording);
      send.before(button);
    }
    let note = host.querySelector("#uaiCompanionMicNoteV1710");
    if (!note) {
      note = document.createElement("div");
      note.id = "uaiCompanionMicNoteV1710";
      note.className = "uai-c-v1710-mic-note";
      note.hidden = true;
      host.querySelector("#uaiCompanionComposerWrap")?.appendChild(note);
    }
    setMicState(micState);
  }

  function stopVoiceFeatures() {
    stopSpeech();
    transcribeController?.abort?.();
    transcribeController = null;
    clearTimeout(recordTimer);
    recordTimer = 0;
    if (recorder && recorder.state !== "inactive") finishRecording(true);
    else {
      stopTracks();
      recorder = null;
      recordChunks = [];
      micState = "idle";
    }
  }

  function refresh() {
    if (document.body.dataset.uaiMode !== "companion") {
      messageObserver?.disconnect?.();
      messageObserver = null;
      observedMessages = null;
      stopVoiceFeatures();
      return;
    }
    bindMessageObserver();
    scheduleEnhance();
  }

  window.addEventListener("uai:companion-core-entered", refresh);
  window.addEventListener("uai:companion-functions-ready", refresh);
  window.addEventListener("uai:mode-refresh", refresh);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && micState === "recording") finishRecording(true);
  });
  window.addEventListener("pagehide", stopVoiceFeatures, { passive: true });

  document.documentElement.dataset.companionExperienceRevision = REVISION;
  window.UnlimitedCompanionExperienceV1710 = {
    revision: REVISION,
    refresh,
    stopSpeech,
    toggleRecording,
    relationshipStats,
    relationshipStage,
    get micState() { return micState; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
})();
