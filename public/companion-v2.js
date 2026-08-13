// public/companion-v2.js
// Additive product polish for companion mode. Keeps the original companion client
// intact and only uses the uai_companion_* storage namespace.
(() => {
  const REVISION = "2026-08-13-v4.1-companion-polish-1";
  const META_KEY = "uai_companion_meta_v2";
  const MEMORY_KEY = "uai_companion_memories_v1";
  let scheduled = false;
  let lastMode = "";
  let returningContext = null;
  let dismissedReturnCard = false;

  function safeParse(value, fallback) {
    try {
      const parsed = JSON.parse(value);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function companionState() {
    return window.UnlimitedCompanion?.getState?.() || null;
  }

  function getMeta() {
    const value = safeParse(localStorage.getItem(META_KEY), {});
    return value && typeof value === "object" ? value : {};
  }

  function saveMeta(meta) {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch {}
  }

  function todayKey(timestamp = Date.now()) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function daysBetween(a, b) {
    if (!a || !b) return 0;
    const start = new Date(a);
    const end = new Date(b);
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.max(0, Math.floor((endDay - startDay) / 86400000));
  }

  function computeStats(state) {
    const sessions = Array.isArray(state?.sessions) ? state.sessions : [];
    const createdAt = Number(state?.profile?.createdAt) || Date.now();
    const messageCount = sessions.reduce((sum, session) => sum + (Array.isArray(session?.messages) ? session.messages.length : 0), 0);
    const daysKnown = Math.max(1, Math.floor((Date.now() - createdAt) / 86400000) + 1);
    return { daysKnown, messageCount, sessionCount: sessions.length };
  }

  function relationshipStage(stats) {
    if (stats.daysKnown >= 7 && stats.messageCount >= 180 && stats.sessionCount >= 8) {
      return { key: "in-sync", label: "很有默契", hint: "你们已经形成比较稳定的聊天节奏" };
    }
    if (stats.daysKnown >= 3 && stats.messageCount >= 70 && stats.sessionCount >= 4) {
      return { key: "close", label: "渐渐亲近", hint: "已经有不少共同话题和聊天记忆" };
    }
    if (stats.messageCount >= 20 || stats.sessionCount >= 2) {
      return { key: "familiar", label: "越来越熟", hint: "她开始更熟悉你的聊天习惯" };
    }
    return { key: "new", label: "刚刚认识", hint: "从自然聊天开始慢慢熟悉彼此" };
  }

  function currentSession(state) {
    const sessions = Array.isArray(state?.sessions) ? state.sessions : [];
    return sessions.find((item) => item?.id === state?.currentSessionId) || sessions[0] || null;
  }

  function latestMeaningfulSession(state) {
    return (Array.isArray(state?.sessions) ? state.sessions : [])
      .filter((item) => item?.title && item.title !== "新的聊天")
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] || null;
  }

  function shortText(value, max = 28) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function setInput(text, send = false) {
    const root = document.getElementById("uaiCompanionRoot");
    const input = root?.querySelector("#uaiCompanionInput");
    if (!input || input.disabled) return;
    input.value = String(text || "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    if (send) root.querySelector("#uaiCompanionSend")?.click();
  }

  function showMiniToast(message) {
    const root = document.getElementById("uaiCompanionRoot");
    if (!root) return;
    let toast = root.querySelector("#uaiCompanionV2Toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "uaiCompanionV2Toast";
      toast.className = "uai-c-v2-toast";
      root.appendChild(toast);
    }
    toast.textContent = String(message || "");
    toast.classList.add("show");
    clearTimeout(showMiniToast.timer);
    showMiniToast.timer = setTimeout(() => toast.classList.remove("show"), 1500);
  }

  function captureReturnContext() {
    const state = companionState();
    if (!state?.profile) return;
    const meta = getMeta();
    const lastSeenAt = Number(meta.lastSeenAt) || 0;
    const awayDays = daysBetween(lastSeenAt, Date.now());
    const latest = latestMeaningfulSession(state);
    returningContext = awayDays >= 1 ? {
      awayDays,
      topic: latest?.title || "",
      profileName: state.profile.name || "她"
    } : null;
    dismissedReturnCard = false;
    saveMeta({ ...meta, lastSeenAt: Date.now(), lastSeenDay: todayKey() });
  }

  function markSeen() {
    const meta = getMeta();
    if (Number(meta.lastSeenAt) && todayKey(meta.lastSeenAt) === todayKey()) return;
    saveMeta({ ...meta, lastSeenAt: Date.now(), lastSeenDay: todayKey() });
  }

  function ensureStageBadge(root, state) {
    const title = root.querySelector(".uai-c-title");
    if (!title || !state?.profile) return;
    const stage = relationshipStage(computeStats(state));
    let badge = title.querySelector(".uai-c-v2-stage");
    if (!badge) {
      badge = document.createElement("button");
      badge.type = "button";
      badge.className = "uai-c-v2-stage";
      title.appendChild(badge);
    }
    badge.dataset.stage = stage.key;
    badge.textContent = stage.label;
    badge.title = stage.hint;
    badge.onclick = () => showMiniToast(stage.hint);
  }

  function buildQuickPrompts(state) {
    const latest = latestMeaningfulSession(state);
    const memories = Array.isArray(state?.memories) ? state.memories : [];
    const prompts = [
      ["陪我聊会儿", "今天就想随便和你聊会儿。"],
      ["今天有点累", "今天有点累，陪我说说话吧。"],
      ["分享一件事", "我有件事想和你分享。"]
    ];
    if (latest?.title) prompts.push(["继续上次", `我们继续聊上次的「${shortText(latest.title, 20)}」吧。`]);
    else if (memories.length) prompts.push(["你还记得吗", "你最近还记得哪些关于我的事情？"]);
    return prompts.slice(0, 4);
  }

  function ensureQuickBar(root, state) {
    const wrap = root.querySelector("#uaiCompanionComposerWrap");
    if (!wrap || !state?.profile) return;
    let bar = wrap.querySelector("#uaiCompanionQuickBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "uaiCompanionQuickBar";
      bar.className = "uai-c-v2-quickbar";
      wrap.prepend(bar);
    }
    const prompts = buildQuickPrompts(state);
    const signature = JSON.stringify(prompts);
    if (bar.dataset.signature === signature) return;
    bar.dataset.signature = signature;
    bar.innerHTML = "";
    prompts.forEach(([label, text]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => setInput(text));
      bar.appendChild(button);
    });
  }

  function ensureReturnCard(root, state) {
    if (!returningContext || dismissedReturnCard || !state?.profile) return;
    const container = root.querySelector("#uaiCompanionMessages");
    if (!container || container.querySelector("#uaiCompanionReturnCard")) return;
    const card = document.createElement("div");
    card.id = "uaiCompanionReturnCard";
    card.className = "uai-c-v2-return-card";
    const dayText = returningContext.awayDays === 1 ? "隔了一天" : `隔了 ${returningContext.awayDays} 天`;
    const topic = returningContext.topic ? `上次聊到「${shortText(returningContext.topic, 24)}」` : "上次的聊天还在";
    card.innerHTML = `<div><strong>${dayText}，欢迎回来</strong><span>${topic}。不用重新介绍自己，想接着聊就继续。</span></div><div class="uai-c-v2-return-actions"><button type="button" data-return-continue>接着聊</button><button type="button" data-return-close>知道了</button></div>`;
    card.querySelector("[data-return-continue]")?.addEventListener("click", () => {
      dismissedReturnCard = true;
      card.remove();
      setInput(returningContext.topic ? `我们继续聊上次的「${shortText(returningContext.topic, 26)}」吧。` : "接着上次的话题聊吧。", false);
    });
    card.querySelector("[data-return-close]")?.addEventListener("click", () => {
      dismissedReturnCard = true;
      card.remove();
    });
    container.prepend(card);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showMiniToast("已复制");
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      showMiniToast("已复制");
    }
  }

  function pinMemory(text) {
    const raw = String(text || "").replace(/\s+/g, " ").trim();
    if (!raw) return;
    const suggested = `用户希望记住：${shortText(raw, 120)}`;
    const edited = window.prompt("把这条聊天记成什么？", suggested);
    if (!edited?.trim()) return;
    const memories = safeParse(localStorage.getItem(MEMORY_KEY), []);
    const list = Array.isArray(memories) ? memories : [];
    const clean = edited.replace(/\s+/g, " ").trim().slice(0, 180);
    if (list.some((item) => String(item?.text || "").trim().toLowerCase() === clean.toLowerCase())) {
      showMiniToast("这条已经记住了");
      return;
    }
    list.push({
      id: `memory-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
      text: clean,
      source: "pinned",
      createdAt: Date.now()
    });
    try {
      localStorage.setItem(MEMORY_KEY, JSON.stringify(list.slice(-100)));
      const counter = document.querySelector("#uaiCompanionMemoryCount");
      if (counter) counter.textContent = String(Math.min(100, list.length));
      showMiniToast("已经帮你记住了");
      scheduleEnhance();
    } catch {
      showMiniToast("本地存储空间不足");
    }
  }

  function ensureMessageActions(root) {
    const container = root.querySelector("#uaiCompanionMessages");
    if (!container) return;
    container.querySelectorAll(".uai-c-message-row").forEach((row) => {
      if (row.querySelector(".uai-c-v2-message-actions")) return;
      const bubble = row.querySelector(".uai-c-bubble");
      if (!bubble || bubble.querySelector(".uai-c-typing")) return;
      const text = bubble.textContent?.trim();
      if (!text) return;
      const actions = document.createElement("div");
      actions.className = "uai-c-v2-message-actions";
      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "复制";
      copy.addEventListener("click", () => copyText(text));
      actions.appendChild(copy);
      if (row.classList.contains("user")) {
        const remember = document.createElement("button");
        remember.type = "button";
        remember.textContent = "记住";
        remember.addEventListener("click", () => pinMemory(text));
        actions.appendChild(remember);
      }
      bubble.parentElement?.appendChild(actions);
    });
  }

  function ensureScrollButton(root) {
    const container = root.querySelector("#uaiCompanionMessages");
    const main = root.querySelector(".uai-c-main");
    if (!container || !main) return;
    let button = main.querySelector("#uaiCompanionScrollBottom");
    if (!button) {
      button = document.createElement("button");
      button.id = "uaiCompanionScrollBottom";
      button.className = "uai-c-v2-scroll-bottom";
      button.type = "button";
      button.textContent = "↓ 回到底部";
      button.addEventListener("click", () => container.scrollTo({ top: container.scrollHeight, behavior: "smooth" }));
      main.appendChild(button);
      container.addEventListener("scroll", () => {
        const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
        button.classList.toggle("show", distance > 180);
      }, { passive: true });
    }
  }

  function ensureMemoryTip(root, state) {
    const count = Array.isArray(state?.memories) ? state.memories.length : 0;
    const memoryButton = root.querySelector("#uaiCompanionMemoryBtn");
    if (!memoryButton) return;
    memoryButton.title = count
      ? `已有 ${count} 条长期记忆；你也可以在自己的消息下点“记住”`
      : "聊天中可以自动记录明确偏好，也可以在自己的消息下点“记住”";
  }

  function enhance() {
    scheduled = false;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root || document.body.dataset.uaiMode !== "companion") return;
    const state = companionState();
    if (!state) return;
    ensureStageBadge(root, state);
    ensureQuickBar(root, state);
    ensureReturnCard(root, state);
    ensureMessageActions(root);
    ensureScrollButton(root);
    ensureMemoryTip(root, state);
    markSeen();
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function onModeMaybeChanged() {
    const mode = document.body.dataset.uaiMode || "";
    if (mode === lastMode) return;
    lastMode = mode;
    if (mode === "companion") {
      window.setTimeout(() => {
        captureReturnContext();
        scheduleEnhance();
      }, 80);
    }
  }

  document.addEventListener("keydown", (event) => {
    if (document.body.dataset.uaiMode !== "companion" || event.key !== "Escape") return;
    const mask = document.querySelector("#uaiCompanionModalMask:not([hidden])");
    const close = mask?.querySelector("[data-close-modal]");
    if (close) {
      event.preventDefault();
      close.click();
      return;
    }
    if (document.getElementById("uaiCompanionRoot")?.classList.contains("sidebar-open")) {
      document.getElementById("uaiCompanionRoot")?.classList.remove("sidebar-open");
    }
  });

  const observer = new MutationObserver(() => {
    onModeMaybeChanged();
    scheduleEnhance();
  });

  function init() {
    document.documentElement.dataset.companionPolishRevision = REVISION;
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-uai-mode", "hidden", "class"] });
    onModeMaybeChanged();
    scheduleEnhance();
  }

  window.UnlimitedCompanionPolish = {
    revision: REVISION,
    relationshipStage,
    refresh: scheduleEnhance
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
