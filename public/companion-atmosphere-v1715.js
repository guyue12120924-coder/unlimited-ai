// V17.15 adaptive atmosphere bridge: reply emotion + time-of-day -> scene and Live2D accents.
(() => {
  const REVISION = "2026-08-23-v17.15-adaptive-atmosphere";
  if (window.UnlimitedCompanionAtmosphereV1715) return;

  let generationObserver = null;
  let observedInput = null;
  let previousGenerating = false;
  let lastAssistantText = "";
  let clockTimer = 0;

  function root() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const host = document.getElementById("uaiCompanionRoot");
    return host && !host.hidden && host.isConnected ? host : null;
  }

  function composer() {
    return root()?.querySelector("#uaiCompanionInput") || null;
  }

  function lastReply() {
    const rows = root()?.querySelectorAll("#uaiCompanionMessages .uai-c-message-row.assistant") || [];
    const row = rows.length ? rows[rows.length - 1] : null;
    return String(row?.querySelector(".uai-c-bubble")?.textContent || "").trim();
  }

  function classifyEmotion(text) {
    const source = String(text || "");
    if (/难过|伤心|抱歉|心疼|哭|失落|委屈|遗憾/.test(source)) return "sad";
    if (/生气|讨厌|别闹|哼|气死|不高兴|恼/.test(source)) return "angry";
    if (/害羞|脸红|笨蛋|喜欢你|想你|抱抱|亲亲|心跳/.test(source)) return "shy";
    if (/哈哈|开心|太好了|好呀|当然|喜欢|真棒|可爱/.test(source)) return "happy";
    if (/想想|也许|可能|认真|考虑|让我想|我觉得/.test(source)) return "thinking";
    if (/晚安|放心|陪你|没关系|乖|别怕|在这里|照顾/.test(source)) return "caring";
    return "normal";
  }

  function currentPeriod() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 10) return "morning";
    if (hour >= 10 && hour < 17) return "day";
    if (hour >= 17 && hour < 21) return "evening";
    return "night";
  }

  function applyPeriod() {
    const host = root();
    if (!host) return;
    host.dataset.v1715Period = currentPeriod();
  }

  function applyEmotion(emotion, text = "") {
    const host = root();
    if (!host) return false;
    const key = ["normal", "happy", "shy", "caring", "sad", "angry", "thinking"].includes(emotion) ? emotion : "normal";
    host.dataset.v1715Emotion = key;
    host.dataset.v1715AtmosphereRevision = REVISION;
    try { window.UnlimitedCompanionStageV1712?.setEmotion?.(key); } catch {}
    host.dispatchEvent(new CustomEvent("uai:companion-atmosphere", {
      bubbles: false,
      detail: { emotion: key, period: host.dataset.v1715Period || currentPeriod(), text: String(text || "").slice(0, 180), revision: REVISION }
    }));
    return true;
  }

  function onGenerationChange() {
    const input = observedInput;
    if (!input) return;
    const generating = Boolean(input.disabled);
    const host = root();
    if (host) host.classList.toggle("uai-c-v1715-thinking", generating);
    if (!generating && previousGenerating) {
      const text = lastReply();
      if (text && text !== lastAssistantText) {
        lastAssistantText = text;
        applyEmotion(classifyEmotion(text), text);
      }
    }
    previousGenerating = generating;
  }

  function bindGenerationObserver() {
    const input = composer();
    if (!input || input === observedInput) return;
    generationObserver?.disconnect?.();
    observedInput = input;
    previousGenerating = Boolean(input.disabled);
    generationObserver = new MutationObserver(onGenerationChange);
    generationObserver.observe(input, { attributes: true, attributeFilter: ["disabled"] });
  }

  function scheduleClock() {
    clearInterval(clockTimer);
    clockTimer = 0;
    if (!root()) return;
    clockTimer = window.setInterval(() => {
      if (root()) applyPeriod();
      else { clearInterval(clockTimer); clockTimer = 0; }
    }, 300000);
  }

  function refresh() {
    const host = root();
    if (!host) {
      generationObserver?.disconnect?.();
      generationObserver = null;
      observedInput = null;
      clearInterval(clockTimer);
      clockTimer = 0;
      return;
    }
    applyPeriod();
    bindGenerationObserver();
    if (!clockTimer) scheduleClock();
    const text = lastReply();
    if (text) {
      lastAssistantText = text;
      applyEmotion(classifyEmotion(text), text);
    } else applyEmotion("normal");
  }

  window.addEventListener("uai:companion-core-entered", refresh);
  window.addEventListener("uai:companion-functions-ready", refresh);
  window.addEventListener("uai:mode-refresh", refresh);
  window.addEventListener("uai:companion-scene-changed", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  window.addEventListener("pagehide", () => {
    generationObserver?.disconnect?.();
    clearInterval(clockTimer);
  }, { passive: true });

  document.documentElement.dataset.companionAtmosphereV1715Revision = REVISION;
  window.UnlimitedCompanionAtmosphereV1715 = {
    revision: REVISION,
    refresh,
    classifyEmotion,
    setEmotion: (emotion) => applyEmotion(String(emotion || "normal")),
    get state() {
      const host = root();
      return { emotion: host?.dataset.v1715Emotion || "normal", period: host?.dataset.v1715Period || currentPeriod() };
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
})();