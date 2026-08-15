// Companion V12.16 — microphone input -> Cloudflare Whisper -> companion composer.
(() => {
  const REVISION = "2026-08-15-v12.16-voice-input-2";
  const MAX_RECORD_MS = 30000;
  let boundRoot = null;
  let observer = null;
  let recorder = null;
  let stream = null;
  let chunks = [];
  let stopTimer = null;
  let tickTimer = null;
  let resetTimer = null;
  let transcribeController = null;
  let startedAt = 0;
  let state = "idle";
  let lastError = "";
  let discardNextRecording = false;

  function liveRoot() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const root = document.getElementById("uaiCompanionRoot");
    return root && !root.hidden && root.isConnected ? root : null;
  }

  function supported() {
    return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  }

  function chooseMimeType() {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4"
    ];
    return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || "";
  }

  function clearRecordTimers() {
    if (stopTimer) clearTimeout(stopTimer);
    if (tickTimer) clearInterval(tickTimer);
    stopTimer = null;
    tickTimer = null;
  }

  function clearResetTimer() {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = null;
  }

  function stopTracks() {
    try { stream?.getTracks?.().forEach((track) => track.stop()); } catch {}
    stream = null;
  }

  function scheduleIdle(ms) {
    clearResetTimer();
    resetTimer = setTimeout(() => {
      resetTimer = null;
      if (["done", "error"].includes(state)) setState("idle");
    }, ms);
  }

  function setHtmlIfChanged(element, html) {
    if (element && element.innerHTML !== html) element.innerHTML = html;
  }

  function setTextIfChanged(element, text) {
    if (element && element.textContent !== text) element.textContent = text;
  }

  function setState(next, message = "") {
    if (["requesting", "recording", "transcribing"].includes(next)) clearResetTimer();
    state = next;
    lastError = next === "error" ? message : "";
    const root = liveRoot();
    if (!root) return;
    if (root.dataset.v16VoiceInputState !== next) root.dataset.v16VoiceInputState = next;
    const button = root.querySelector("#uaiCompanionMicButton");
    const note = root.querySelector("#uaiCompanionMicNote");
    if (button) {
      button.classList.toggle("recording", next === "recording");
      button.classList.toggle("loading", next === "requesting" || next === "transcribing");
      button.disabled = ["requesting", "transcribing"].includes(next) || !supported();
      button.setAttribute("aria-pressed", next === "recording" ? "true" : "false");
      const desiredHtml = next === "recording"
        ? `<span>■</span><b data-mic-time>00:00</b>`
        : next === "requesting"
          ? `<span>✦</span><b>准备中</b>`
          : next === "transcribing"
            ? `<span>✦</span><b>识别中</b>`
            : `<span>🎙</span><b>说话</b>`;
      setHtmlIfChanged(button, desiredHtml);
      const title = !supported()
        ? "当前浏览器不支持麦克风录音"
        : next === "recording"
          ? "停止录音并识别"
          : next === "requesting"
            ? "正在请求麦克风权限"
            : "按一下开始说话";
      if (button.title !== title) button.title = title;
    }
    if (note) {
      const text = message || (
        next === "requesting" ? "正在打开麦克风…"
          : next === "recording" ? "正在听你说话… 再点一次结束"
            : next === "transcribing" ? "正在把你的语音变成文字…"
              : ""
      );
      note.hidden = next === "idle";
      setTextIfChanged(note, text);
      if (note.dataset.state !== next) note.dataset.state = next;
    }
  }

  function updateTimer() {
    const root = liveRoot();
    const label = root?.querySelector("#uaiCompanionMicButton [data-mic-time]");
    if (!label || !startedAt) return;
    const elapsed = Math.max(0, Date.now() - startedAt);
    const seconds = Math.min(30, Math.floor(elapsed / 1000));
    setTextIfChanged(label, `00:${String(seconds).padStart(2, "0")}`);
  }

  function composerInput(root = liveRoot()) {
    return root?.querySelector("#uaiCompanionInput") || null;
  }

  function writeTranscript(text) {
    const input = composerInput();
    if (!input) return false;
    const value = String(text || "").trim();
    if (!value) return false;
    const before = String(input.value || "").trim();
    input.value = before ? `${before}${/[。！？!?，,；;：:]$/.test(before) ? " " : "，"}${value}` : value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    try { input.setSelectionRange(input.value.length, input.value.length); } catch {}
    return true;
  }

  async function transcribe(blob) {
    if (!blob || blob.size < 300) {
      setState("error", "没有听到有效语音，请再试一次。");
      scheduleIdle(1800);
      return;
    }
    transcribeController?.abort?.();
    transcribeController = new AbortController();
    const controller = transcribeController;
    setState("transcribing");
    try {
      const response = await fetch("/api/companion/stt", {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
        signal: controller.signal,
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `Speech recognition HTTP ${response.status}`);
      if (controller !== transcribeController) return;
      const text = String(data?.text || "").trim();
      if (!text) throw new Error("没有识别到文字");
      writeTranscript(text);
      setState("done", `已识别：${text.length > 42 ? `${text.slice(0, 42)}…` : text}`);
      scheduleIdle(2200);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setState("error", error?.message || "语音识别失败，请再试一次。");
      scheduleIdle(2600);
    } finally {
      if (controller === transcribeController) transcribeController = null;
    }
  }

  function finishRecording(options = {}) {
    if (!recorder || recorder.state === "inactive") return;
    discardNextRecording = Boolean(options.discard);
    try { recorder.stop(); } catch {}
  }

  async function startRecording() {
    if (!supported() || ["requesting", "transcribing"].includes(state)) return;
    if (state === "recording") {
      finishRecording();
      return;
    }

    clearResetTimer();
    transcribeController?.abort?.();
    transcribeController = null;
    discardNextRecording = false;
    // Avoid recording the companion's own TTS through the speakers.
    try { window.UnlimitedCompanionNeuralVoice?.stop?.({ keepLast: true }); } catch {}
    try { window.UnlimitedCompanionVoice?.stop?.({ silent: true }); } catch {}

    setState("requesting");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      if (state !== "requesting") {
        stopTracks();
        return;
      }
      chunks = [];
      const mimeType = chooseMimeType();
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) chunks.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        clearRecordTimers();
        stopTracks();
        const currentRecorder = recorder;
        const type = currentRecorder?.mimeType || chunks[0]?.type || "audio/webm";
        const blob = new Blob(chunks, { type });
        const shouldDiscard = discardNextRecording;
        discardNextRecording = false;
        recorder = null;
        chunks = [];
        startedAt = 0;
        if (shouldDiscard) {
          setState("idle");
          return;
        }
        transcribe(blob);
      }, { once: true });
      recorder.addEventListener("error", () => {
        clearRecordTimers();
        stopTracks();
        recorder = null;
        chunks = [];
        startedAt = 0;
        setState("error", "录音失败，请检查麦克风权限。");
        scheduleIdle(2400);
      }, { once: true });
      recorder.start(250);
      startedAt = Date.now();
      setState("recording");
      updateTimer();
      tickTimer = setInterval(updateTimer, 500);
      stopTimer = setTimeout(() => finishRecording(), MAX_RECORD_MS);
    } catch (error) {
      clearRecordTimers();
      stopTracks();
      recorder = null;
      startedAt = 0;
      const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
      setState("error", denied ? "麦克风权限被拒绝，请允许网页使用麦克风。" : "无法打开麦克风，请检查设备。");
      scheduleIdle(2800);
    }
  }

  function ensureUi(root) {
    const composer = root.querySelector(".uai-c-composer");
    const send = composer?.querySelector(".uai-c-send");
    if (!composer || !send) return;
    let button = composer.querySelector("#uaiCompanionMicButton");
    if (!button) {
      button = document.createElement("button");
      button.id = "uaiCompanionMicButton";
      button.className = "uai-c-v16-mic";
      button.type = "button";
      button.setAttribute("aria-label", "语音输入");
      button.addEventListener("click", startRecording);
      send.before(button);
    }
    let note = root.querySelector("#uaiCompanionMicNote");
    if (!note) {
      note = document.createElement("div");
      note.id = "uaiCompanionMicNote";
      note.className = "uai-c-v16-mic-note";
      note.hidden = true;
      root.querySelector("#uaiCompanionComposerWrap")?.appendChild(note);
    }
    setState(state, state === "error" ? lastError : "");
  }

  function sync() {
    const root = liveRoot();
    if (!root) return;
    if (boundRoot !== root) {
      observer?.disconnect?.();
      boundRoot = root;
      observer = new MutationObserver(() => ensureUi(root));
      observer.observe(root, { subtree: true, childList: true });
    }
    ensureUi(root);
  }

  function stopAll() {
    clearRecordTimers();
    clearResetTimer();
    transcribeController?.abort?.();
    transcribeController = null;
    if (recorder && recorder.state !== "inactive") finishRecording({ discard: true });
    else {
      stopTracks();
      recorder = null;
      chunks = [];
      startedAt = 0;
      state = "idle";
    }
  }

  function init() {
    document.documentElement.dataset.companionVoiceInputRevision = REVISION;
    new MutationObserver(sync).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode", "class"]
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state === "recording") finishRecording({ discard: true });
      else sync();
    });
    window.addEventListener("pagehide", stopAll, { passive: true });
    window.UnlimitedCompanionVoiceInput = {
      revision: REVISION,
      supported,
      start: startRecording,
      stop: finishRecording,
      cancel: () => finishRecording({ discard: true }),
      get state() { return state; },
      refresh: sync
    };
    sync();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();