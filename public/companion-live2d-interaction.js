// Companion V12.12 — Live2D behavior bridge: reply state, emotion reactions and tap feedback.
(() => {
  const REVISION = "2026-08-15-v12.12-live2d-interaction-1";
  const EMOTIONS = ["normal", "happy", "shy", "sad", "angry", "caring", "thinking"];

  let boundRoot = null;
  let observer = null;
  let scheduled = false;
  let lastGenerating = false;
  let lastAssistantText = "";
  let mouthTimer = null;
  let emotionResetTimer = null;
  let lastTapAt = 0;

  function liveRoot() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const root = document.getElementById("uaiCompanionRoot");
    return root && !root.hidden && root.isConnected ? root : null;
  }

  function api() {
    return window.UnlimitedCompanionLive2D || null;
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
      caring: ["抱抱", "抱一下", "陪你", "心疼", "别怕", "没事的", "早点休息", "好好休息", "晚安", "照顾好", "想你", "喜欢你", "爱你", "在这里陪", "不用一个人"],
      shy: ["害羞", "脸红", "不好意思", "羞", "别这样", "讨厌啦", "亲一下", "亲亲", "被你发现", "才没有", "哼哼"],
      happy: ["哈哈", "嘿嘿", "嘻嘻", "开心", "高兴", "太好了", "好耶", "真棒", "可爱", "笑死", "满足", "幸运", "当然可以", "好呀"],
      sad: ["难过", "伤心", "委屈", "想哭", "哭了", "失落", "孤单", "孤独", "对不起", "抱歉", "心里不好受", "可惜"],
      angry: ["生气", "气死", "愤怒", "讨厌", "混蛋", "不许", "过分", "可恶", "烦死", "哼！", "绝对不行"],
      thinking: ["让我想", "我想想", "想一想", "也许", "可能", "或许", "我觉得", "换个角度", "如果是我", "让我看看"]
    };

    const scores = Object.fromEntries(Object.keys(groups).map((key) => [key, 0]));
    for (const [emotion, words] of Object.entries(groups)) {
      for (const word of words) if (value.includes(word)) scores[emotion] += word.length >= 4 ? 2 : 1;
    }

    // Affection takes priority when a reply mixes warmth with playful wording.
    if (/[❤♥💕💗💖💞]/u.test(value)) scores.caring += 2;
    if (/[😊☺😄🥰]/u.test(value)) scores.happy += 2;
    if (/[😳🙈]/u.test(value)) scores.shy += 2;
    if (/[😢😭]/u.test(value)) scores.sad += 2;
    if (/[😠😡]/u.test(value)) scores.angry += 2;

    let best = "normal";
    let bestScore = 0;
    for (const [emotion, score] of Object.entries(scores)) {
      if (score > bestScore) {
        best = emotion;
        bestScore = score;
      }
    }
    return best;
  }

  function setVisualEmotion(root, emotion) {
    const next = EMOTIONS.includes(emotion) ? emotion : "normal";
    root.dataset.v129Live2dEmotion = next;
    root.classList.toggle("uai-c-live2d-thinking", next === "thinking");
    return next;
  }

  function setPresence(root, text, state = "") {
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
    badge.dataset.state = state;
    badge.classList.toggle("show", Boolean(text));
  }

  function stopMouth() {
    if (mouthTimer) window.clearInterval(mouthTimer);
    mouthTimer = null;
    try { api()?.setMouthOpen?.(0); } catch {}
  }

  function startSpeaking(root) {
    root.classList.add("uai-c-live2d-speaking");
    setVisualEmotion(root, "thinking");
    setPresence(root, "正在回应你…", "speaking");
    try { api()?.setEmotion?.("thinking"); } catch {}
    stopMouth();
    let phase = 0;
    mouthTimer = window.setInterval(() => {
      phase += 1;
      const amount = .14 + Math.abs(Math.sin(phase * .92)) * .58;
      try { api()?.setMouthOpen?.(amount); } catch {}
    }, 135);
  }

  function stopSpeaking(root) {
    root.classList.remove("uai-c-live2d-speaking", "uai-c-live2d-thinking");
    stopMouth();
    setPresence(root, "", "");
  }

  function burst(root, emotion = "happy", point = null) {
    const main = root.querySelector(".uai-c-main");
    if (!main) return;
    const rect = main.getBoundingClientRect();
    const x = point ? point.x - rect.left : rect.width * .80;
    const y = point ? point.y - rect.top : rect.height * .42;
    const host = document.createElement("div");
    host.className = `uai-c-live2d-burst ${emotion}`;
    host.style.left = `${Math.max(24, Math.min(rect.width - 24, x))}px`;
    host.style.top = `${Math.max(24, Math.min(rect.height - 24, y))}px`;
    const symbols = emotion === "caring" || emotion === "shy"
      ? ["♥", "♡", "✦", "♥", "✧", "♡"]
      : emotion === "sad"
        ? ["✦", "·", "✧", "·", "✦", "·"]
        : ["✦", "✧", "♥", "✦", "·", "✧"];
    host.innerHTML = symbols.map((symbol, index) => {
      const angle = (Math.PI * 2 * index / symbols.length) - Math.PI / 2;
      const distance = 42 + (index % 3) * 13;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      return `<i style="--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px;--delay:${(index * .035).toFixed(3)}s">${symbol}</i>`;
    }).join("");
    main.appendChild(host);
    window.setTimeout(() => host.remove(), 1150);
  }

  async function reactToText(root, text) {
    const emotion = setVisualEmotion(root, classifyEmotion(text));
    clearTimeout(emotionResetTimer);
    try { await api()?.setEmotion?.(emotion); } catch {}

    // Mao exposes a rich TapBody group; custom models may ignore this and use their own emotion mapping.
    try {
      const index = Math.floor(Math.random() * 6);
      await api()?.playMotion?.("TapBody", index);
    } catch {}

    if (["happy", "shy", "caring"].includes(emotion)) burst(root, emotion);
    setPresence(root, ({
      happy: "心情变好了 ✦",
      shy: "有一点害羞 ♥",
      caring: "在认真陪着你 ♥",
      sad: "情绪低落了一点",
      angry: "有点生气了",
      thinking: "还在想着你的话…",
      normal: ""
    })[emotion] || "", emotion);

    emotionResetTimer = window.setTimeout(() => {
      const activeRoot = liveRoot();
      if (!activeRoot || activeRoot.querySelector("#uaiCompanionComposerWrap.generating")) return;
      setVisualEmotion(activeRoot, "normal");
      setPresence(activeRoot, "", "");
      try { api()?.setEmotion?.("normal"); } catch {}
    }, emotion === "normal" ? 1200 : 5200);
  }

  function sync() {
    scheduled = false;
    const root = liveRoot();
    if (!root) {
      stopMouth();
      return;
    }
    bind(root);

    const generating = Boolean(root.querySelector("#uaiCompanionComposerWrap.generating"));
    const assistantText = lastAssistantBubble(root);

    if (generating && !lastGenerating) startSpeaking(root);
    if (!generating && lastGenerating) {
      stopSpeaking(root);
      if (assistantText && assistantText !== lastAssistantText) reactToText(root, assistantText);
    }

    // Streaming text may appear before the request finishes. Switch the badge from thinking to speaking.
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

    burst(root, "caring", { x: event.clientX, y: event.clientY });
    setVisualEmotion(root, "happy");
    setPresence(root, "被你碰到了 ♥", "tap");
    try { api()?.playMotion?.("TapBody", Math.floor(Math.random() * 6)); } catch {}
    window.setTimeout(() => {
      const activeRoot = liveRoot();
      if (!activeRoot || activeRoot.querySelector("#uaiCompanionComposerWrap.generating")) return;
      setPresence(activeRoot, "", "");
      setVisualEmotion(activeRoot, "normal");
    }, 2200);
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
    root.querySelector(".uai-c-main")?.addEventListener("pointerup", (event) => handleTap(root, event), { passive: true });
  }

  function init() {
    document.documentElement.dataset.companionLive2dInteractionRevision = REVISION;
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode", "class"]
    });
    window.UnlimitedCompanionLive2DInteraction = {
      revision: REVISION,
      refresh: schedule,
      classifyEmotion,
      reactToText: (text) => {
        const root = liveRoot();
        if (root) return reactToText(root, text);
        return false;
      }
    };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
