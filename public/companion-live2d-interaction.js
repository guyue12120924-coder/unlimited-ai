// Companion V12.13 — Live2D presence bridge: reply state, emotion, relationship, return greeting, idle life and voice hooks.
(() => {
  const REVISION = "2026-08-15-v12.13-live2d-presence-1";
  const EMOTIONS = ["normal", "happy", "shy", "sad", "angry", "caring", "thinking"];
  const PRESENCE_KEY = "uai_companion_live2d_presence_v1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";

  let boundRoot = null;
  let observer = null;
  let scheduled = false;
  let lastGenerating = false;
  let lastAssistantText = "";
  let mouthTimer = null;
  let emotionResetTimer = null;
  let idleTimer = null;
  let welcomeTimer = null;
  let lastTapAt = 0;
  let lastActivityAt = Date.now();
  let lastIdleAt = 0;
  let externalVoiceActive = false;

  function liveRoot() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const root = document.getElementById("uaiCompanionRoot");
    return root && !root.hidden && root.isConnected ? root : null;
  }

  function api() {
    return window.UnlimitedCompanionLive2D || null;
  }

  function state() {
    return window.UnlimitedCompanion?.getState?.() || {};
  }

  function activeCharacterId() {
    return window.UnlimitedCompanionMulti?.activeCharacterId || localStorage.getItem(ACTIVE_KEY) || "legacy";
  }

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function presenceMap() {
    const value = safeParse(localStorage.getItem(PRESENCE_KEY), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function writePresence(patch = {}) {
    const id = activeCharacterId();
    const map = presenceMap();
    map[id] = { ...(map[id] || {}), ...patch };
    localStorage.setItem(PRESENCE_KEY, JSON.stringify(map));
    return map[id];
  }

  function currentPresence() {
    return presenceMap()[activeCharacterId()] || {};
  }

  function relationshipStats() {
    const current = state();
    const sessions = Array.isArray(current.sessions) ? current.sessions : [];
    const messages = sessions.reduce((sum, session) => sum + (Array.isArray(session?.messages) ? session.messages.length : 0), 0);
    const createdAt = Number(current.profile?.createdAt || 0) || Date.now();
    const days = Math.max(1, Math.floor((Date.now() - createdAt) / 86400000) + 1);
    return { sessions: sessions.length, messages, days };
  }

  function relationshipStage() {
    const value = relationshipStats();
    if (value.days >= 7 && value.messages >= 180 && value.sessions >= 8) return { label: "很有默契", progress: 92, level: 4 };
    if (value.days >= 3 && value.messages >= 70 && value.sessions >= 4) return { label: "渐渐亲近", progress: 68, level: 3 };
    if (value.messages >= 20 || value.sessions >= 2) return { label: "越来越熟", progress: 43, level: 2 };
    return { label: "刚刚认识", progress: 18, level: 1 };
  }

  function latestChatAt() {
    const sessions = Array.isArray(state().sessions) ? state().sessions : [];
    let latest = 0;
    for (const session of sessions) {
      latest = Math.max(latest, Number(session?.updatedAt || 0));
      for (const message of Array.isArray(session?.messages) ? session.messages : []) {
        latest = Math.max(latest, Number(message?.createdAt || 0));
      }
    }
    return latest;
  }

  function lastAssistantBubble(root) {
    const rows = root?.querySelectorAll?.("#uaiCompanionMessages .uai-c-message-row.assistant");
    const row = rows?.length ? rows[rows.length - 1] : null;
    return String(row?.querySelector?.(".uai-c-bubble")?.textContent || "").trim();
  }

  function classifyEmotion(text) {
    const value = String(text || "").toLowerCase();
    if (!value) return "normal";

    const groups = {
      caring: ["抱抱", "抱一下", "抱住", "陪你", "心疼", "别怕", "没事的", "放心", "早点休息", "好好休息", "晚安", "照顾好", "想你", "喜欢你", "爱你", "在这里陪", "不用一个人", "我在呢", "靠过来"],
      shy: ["害羞", "脸红", "耳根红", "不好意思", "羞", "别这样", "讨厌啦", "亲一下", "亲亲", "被你发现", "才没有", "哼哼", "移开视线", "低下头"],
      happy: ["哈哈", "嘿嘿", "嘻嘻", "开心", "高兴", "太好了", "好耶", "真棒", "可爱", "笑死", "满足", "幸运", "当然可以", "好呀", "笑起来", "眼睛弯"],
      sad: ["难过", "伤心", "委屈", "想哭", "哭了", "失落", "孤单", "孤独", "对不起", "抱歉", "心里不好受", "可惜", "低落", "垂下眼"],
      angry: ["生气", "气死", "愤怒", "混蛋", "不许", "过分", "可恶", "烦死", "哼！", "绝对不行", "皱眉", "气鼓鼓"],
      thinking: ["让我想", "我想想", "想一想", "也许", "可能", "或许", "我觉得", "换个角度", "如果是我", "让我看看", "认真想", "思考"]
    };

    const scores = Object.fromEntries(Object.keys(groups).map((key) => [key, 0]));
    for (const [emotion, words] of Object.entries(groups)) {
      for (const word of words) if (value.includes(word)) scores[emotion] += word.length >= 4 ? 2 : 1;
    }

    if (/[❤♥💕💗💖💞💓]/u.test(value)) scores.caring += 2;
    if (/[😊☺😄😁🥰]/u.test(value)) scores.happy += 2;
    if (/[😳🙈]/u.test(value)) scores.shy += 2;
    if (/[😢😭🥺]/u.test(value)) scores.sad += 2;
    if (/[😠😡💢]/u.test(value)) scores.angry += 2;
    if (/（[^）]*(?:脸红|害羞|抱住|贴近|微笑|低头|皱眉)[^）]*）/.test(value)) {
      if (/脸红|害羞|低头/.test(value)) scores.shy += 2;
      if (/抱住|贴近/.test(value)) scores.caring += 2;
      if (/微笑/.test(value)) scores.happy += 1;
      if (/皱眉/.test(value)) scores.angry += 2;
    }

    let best = "normal";
    let bestScore = 0;
    for (const [emotion, score] of Object.entries(scores)) {
      if (score > bestScore) {
        best = emotion;
        bestScore = score;
      }
    }
    return bestScore >= 1 ? best : "normal";
  }

  function setVisualEmotion(root, emotion) {
    const next = EMOTIONS.includes(emotion) ? emotion : "normal";
    root.dataset.v129Live2dEmotion = next;
    root.classList.toggle("uai-c-live2d-thinking", next === "thinking");
    return next;
  }

  function syncRelationship(root) {
    const stage = relationshipStage();
    root.dataset.v129Live2dRelationLevel = String(stage.level);
    root.dataset.v129Live2dRelationLabel = stage.label;
    return stage;
  }

  function setPresence(root, text, presenceState = "") {
    let badge = root.querySelector(".uai-c-live2d-presence");
    const main = root.querySelector(".uai-c-main");
    if (!badge && main) {
      badge = document.createElement("div");
      badge.className = "uai-c-live2d-presence";
      badge.setAttribute("aria-hidden", "true");
      main.appendChild(badge);
    }
    if (!badge) return;
    badge.textContent = text || "";
    badge.dataset.state = presenceState;
    badge.classList.toggle("show", Boolean(text));
  }

  function stopMouth() {
    if (mouthTimer) window.clearInterval(mouthTimer);
    mouthTimer = null;
    try { api()?.setMouthOpen?.(0); } catch {}
  }

  function startAutoMouth() {
    stopMouth();
    let phase = 0;
    mouthTimer = window.setInterval(() => {
      phase += 1;
      const amount = .14 + Math.abs(Math.sin(phase * .92)) * .58;
      try { api()?.setMouthOpen?.(amount); } catch {}
    }, 135);
  }

  function startSpeaking(root) {
    if (externalVoiceActive) return;
    root.classList.add("uai-c-live2d-speaking");
    setVisualEmotion(root, "thinking");
    setPresence(root, "正在回应你…", "speaking");
    try { api()?.setEmotion?.("thinking"); } catch {}
    startAutoMouth();
  }

  function stopSpeaking(root) {
    if (!externalVoiceActive) root.classList.remove("uai-c-live2d-speaking", "uai-c-live2d-thinking");
    if (!externalVoiceActive) stopMouth();
    if (!externalVoiceActive) setPresence(root, "", "");
  }

  function burst(root, emotion = "happy", point = null) {
    const main = root.querySelector(".uai-c-main");
    if (!main) return;
    const rect = main.getBoundingClientRect();
    const x = point ? point.x - rect.left : rect.width * .80;
    const y = point ? point.y - rect.top : rect.height * .42;
    const stage = relationshipStage();
    const count = stage.level >= 4 ? 9 : stage.level >= 3 ? 8 : 6;
    const host = document.createElement("div");
    host.className = `uai-c-live2d-burst ${emotion}`;
    host.style.left = `${Math.max(24, Math.min(rect.width - 24, x))}px`;
    host.style.top = `${Math.max(24, Math.min(rect.height - 24, y))}px`;
    const palette = emotion === "caring" || emotion === "shy"
      ? ["♥", "♡", "✦", "♥", "✧", "♡", "♥", "✦", "♡"]
      : emotion === "sad"
        ? ["✦", "·", "✧", "·", "✦", "·", "✧", "·", "✦"]
        : ["✦", "✧", "♥", "✦", "·", "✧", "♥", "✦", "✧"];
    host.innerHTML = palette.slice(0, count).map((symbol, index) => {
      const angle = (Math.PI * 2 * index / count) - Math.PI / 2;
      const distance = 42 + (index % 3) * 13 + stage.level * 2;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      return `<i style="--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px;--delay:${(index * .032).toFixed(3)}s">${symbol}</i>`;
    }).join("");
    main.appendChild(host);
    window.setTimeout(() => host.remove(), 1200);
  }

  async function reactToText(root, text) {
    const emotion = setVisualEmotion(root, classifyEmotion(text));
    const relation = syncRelationship(root);
    clearTimeout(emotionResetTimer);
    try { await api()?.setEmotion?.(emotion); } catch {}

    try {
      const maxIndex = relation.level >= 3 ? 6 : 4;
      await api()?.playMotion?.("TapBody", Math.floor(Math.random() * maxIndex));
    } catch {}

    if (["happy", "shy", "caring"].includes(emotion)) burst(root, emotion);
    setPresence(root, ({
      happy: relation.level >= 3 ? "被你逗开心了 ✦" : "心情变好了 ✦",
      shy: relation.level >= 3 ? "又被你说得害羞了 ♥" : "有一点害羞 ♥",
      caring: relation.level >= 3 ? "想再靠近你一点 ♥" : "在认真陪着你 ♥",
      sad: "情绪低落了一点",
      angry: "有点生气了",
      thinking: "还在想着你的话…",
      normal: ""
    })[emotion] || "", emotion);

    const holdMs = emotion === "normal" ? 1200 : 4200 + relation.level * 450;
    emotionResetTimer = window.setTimeout(() => {
      const activeRoot = liveRoot();
      if (!activeRoot || activeRoot.querySelector("#uaiCompanionComposerWrap.generating") || externalVoiceActive) return;
      setVisualEmotion(activeRoot, "normal");
      setPresence(activeRoot, "", "");
      try { api()?.setEmotion?.("normal"); } catch {}
    }, holdMs);
  }

  function welcomeCopy(level, awayMs) {
    const hours = awayMs / 3600000;
    if (hours < 6) return "";
    if (level >= 4) return hours >= 24 ? "你终于回来啦，我一直记着你 ♥" : "你回来啦，我就知道你会来 ♥";
    if (level >= 3) return hours >= 24 ? "好久没见，我有点想你了 ♥" : "你回来啦，刚刚还想到你。";
    if (level >= 2) return hours >= 24 ? "又见到你啦，今天过得怎么样？" : "回来啦 ✦";
    return hours >= 24 ? "欢迎回来，要聊一会儿吗？" : "又见面啦 ✦";
  }

  function maybeWelcome(root) {
    clearTimeout(welcomeTimer);
    welcomeTimer = window.setTimeout(async () => {
      const activeRoot = liveRoot();
      if (!activeRoot || activeRoot !== root || activeRoot.querySelector("#uaiCompanionComposerWrap.generating")) return;
      const relation = syncRelationship(activeRoot);
      const latest = latestChatAt();
      if (!latest) return;
      const awayMs = Math.max(0, Date.now() - latest);
      const stored = currentPresence();
      if (Date.now() - Number(stored.lastWelcomeAt || 0) < 4 * 3600000) return;
      const copy = welcomeCopy(relation.level, awayMs);
      if (!copy) return;

      writePresence({ lastWelcomeAt: Date.now(), lastSeenChatAt: latest });
      const emotion = relation.level >= 3 ? "caring" : "happy";
      setVisualEmotion(activeRoot, emotion);
      setPresence(activeRoot, copy, "welcome");
      try { await api()?.setEmotion?.(emotion); } catch {}
      try { await api()?.playMotion?.("TapBody", relation.level >= 3 ? 2 : 0); } catch {}
      if (relation.level >= 2) burst(activeRoot, emotion);

      window.setTimeout(() => {
        const latestRoot = liveRoot();
        if (!latestRoot || latestRoot.querySelector("#uaiCompanionComposerWrap.generating") || externalVoiceActive) return;
        setPresence(latestRoot, "", "");
        setVisualEmotion(latestRoot, "normal");
      }, 5200 + relation.level * 450);
    }, 1350);
  }

  function noteActivity() {
    lastActivityAt = Date.now();
  }

  async function idleReaction(root) {
    if (!root.classList.contains("uai-c-live2d-active")) return;
    if (root.querySelector("#uaiCompanionComposerWrap.generating") || externalVoiceActive) return;
    if (Date.now() - lastActivityAt < 22000 || Date.now() - lastIdleAt < 26000) return;
    const badge = root.querySelector(".uai-c-live2d-presence.show");
    if (badge) return;

    const relation = syncRelationship(root);
    lastIdleAt = Date.now();
    root.classList.add("uai-c-live2d-idle-reaction");
    try {
      const idleIndex = Math.floor(Math.random() * (relation.level >= 3 ? 3 : 2));
      const played = await api()?.playMotion?.("Idle", idleIndex);
      if (!played && Math.random() < .45) await api()?.playMotion?.("TapBody", 0);
    } catch {}

    if (relation.level >= 3 && Math.random() < .35) {
      setPresence(root, relation.level >= 4 ? "偷偷看你一眼 ♥" : "在这里陪着你。", "idle");
      window.setTimeout(() => {
        const activeRoot = liveRoot();
        if (activeRoot && !activeRoot.querySelector("#uaiCompanionComposerWrap.generating")) setPresence(activeRoot, "", "");
      }, 2600);
    }
    window.setTimeout(() => liveRoot()?.classList.remove("uai-c-live2d-idle-reaction"), 1800);
  }

  function ensureIdleLoop() {
    if (idleTimer) return;
    idleTimer = window.setInterval(() => {
      const root = liveRoot();
      if (!root || document.hidden) return;
      if (Math.random() < .58) idleReaction(root);
    }, 11500);
  }

  function sync() {
    scheduled = false;
    const root = liveRoot();
    if (!root) {
      if (!externalVoiceActive) stopMouth();
      return;
    }
    bind(root);
    syncRelationship(root);

    const generating = Boolean(root.querySelector("#uaiCompanionComposerWrap.generating"));
    const assistantText = lastAssistantBubble(root);

    if (generating && !lastGenerating) startSpeaking(root);
    if (!generating && lastGenerating) {
      stopSpeaking(root);
      if (assistantText && assistantText !== lastAssistantText) reactToText(root, assistantText);
    }

    if (generating && assistantText && assistantText !== lastAssistantText) {
      root.dataset.v129Live2dReplyPhase = "streaming";
      setPresence(root, "正在和你说话…", "streaming");
    } else if (generating) {
      root.dataset.v129Live2dReplyPhase = "thinking";
    } else {
      delete root.dataset.v129Live2dReplyPhase;
    }

    lastGenerating = generating;
    if (!generating && assistantText) lastAssistantText = assistantText;
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  function handleTap(root, event) {
    const main = root.querySelector(".uai-c-main");
    if (!main || !root.classList.contains("uai-c-live2d-active")) return;
    if (event.target?.closest?.("button,input,textarea,select,a,.uai-c-message-row,.uai-c-composer,.uai-c-v122-scene-copy")) return;
    const rect = main.getBoundingClientRect();
    if (!rect.width || event.clientX < rect.left + rect.width * .62) return;
    const now = Date.now();
    if (now - lastTapAt < 650) return;
    lastTapAt = now;
    noteActivity();

    const relation = syncRelationship(root);
    const emotion = relation.level >= 3 ? "caring" : "happy";
    burst(root, emotion, { x: event.clientX, y: event.clientY });
    setVisualEmotion(root, emotion);
    setPresence(root, relation.level >= 4 ? "嗯？又来碰我啦 ♥" : relation.level >= 3 ? "被你碰到了…♥" : "被你碰到了 ♥", "tap");
    try { api()?.playMotion?.("TapBody", Math.floor(Math.random() * (relation.level >= 3 ? 6 : 4))); } catch {}
    window.setTimeout(() => {
      const activeRoot = liveRoot();
      if (!activeRoot || activeRoot.querySelector("#uaiCompanionComposerWrap.generating") || externalVoiceActive) return;
      setPresence(activeRoot, "", "");
      setVisualEmotion(activeRoot, "normal");
    }, 2200 + relation.level * 250);
  }

  function beginVoice(options = {}) {
    const root = liveRoot();
    if (!root) return false;
    externalVoiceActive = true;
    stopMouth();
    root.classList.add("uai-c-live2d-speaking", "uai-c-live2d-voice");
    setPresence(root, String(options.label || "正在和你说话…"), "voice");
    return true;
  }

  function setVoiceLevel(value) {
    if (!externalVoiceActive) return false;
    const amount = Math.max(0, Math.min(1, Number(value) || 0));
    try { return Boolean(api()?.setMouthOpen?.(amount)); } catch { return false; }
  }

  function endVoice(options = {}) {
    const root = liveRoot();
    externalVoiceActive = false;
    stopMouth();
    try { api()?.setMouthOpen?.(0); } catch {}
    if (root) {
      root.classList.remove("uai-c-live2d-speaking", "uai-c-live2d-voice");
      if (!options.keepPresence) setPresence(root, "", "");
    }
    return true;
  }

  function attachAudioElement(audio, options = {}) {
    if (!audio?.addEventListener) return () => {};
    const onPlay = () => beginVoice({ label: options.label || "正在和你说话…" });
    const onPause = () => { if (!audio.ended) endVoice(); };
    const onEnd = () => endVoice();
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnd);
      endVoice();
    };
  }

  function bind(root) {
    if (boundRoot === root) return;
    observer?.disconnect?.();
    boundRoot = root;
    lastGenerating = Boolean(root.querySelector("#uaiCompanionComposerWrap.generating"));
    lastAssistantText = lastAssistantBubble(root);
    lastActivityAt = Date.now();

    observer = new MutationObserver(schedule);
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "hidden"]
    });

    const main = root.querySelector(".uai-c-main");
    main?.addEventListener("pointerup", (event) => handleTap(root, event), { passive: true });
    root.addEventListener("pointermove", noteActivity, { passive: true });
    root.addEventListener("keydown", noteActivity, { passive: true });
    root.addEventListener("wheel", noteActivity, { passive: true });
    root.addEventListener("touchstart", noteActivity, { passive: true });

    syncRelationship(root);
    maybeWelcome(root);
    ensureIdleLoop();
  }

  function markSeen() {
    writePresence({ lastSeenAt: Date.now(), lastSeenChatAt: latestChatAt() });
  }

  function init() {
    document.documentElement.dataset.companionLive2dInteractionRevision = REVISION;
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode", "class"]
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) markSeen();
      else schedule();
    });
    window.addEventListener("pagehide", markSeen, { passive: true });

    window.UnlimitedCompanionLive2DInteraction = {
      revision: REVISION,
      refresh: schedule,
      classifyEmotion,
      relationshipStage,
      reactToText: (text) => {
        const root = liveRoot();
        if (root) return reactToText(root, text);
        return false;
      },
      beginVoice,
      setVoiceLevel,
      endVoice,
      attachAudioElement,
      markSeen
    };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
