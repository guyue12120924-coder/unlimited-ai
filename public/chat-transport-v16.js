// public/chat-transport-v16.js
// V16.4 stability layer: one chat request entry for mode isolation, context enrichment
// and generation lifecycle guards. SSE parsing is owned by the novel/companion clients.
(() => {
  const REVISION = "2026-08-21-v16.4-chat-transport";
  const REGISTRY_REVISION = "2026-08-21-v16.4-chat-registry";
  if (window.UnlimitedChatTransportV16) return;

  const nativeFetch = window.fetch.bind(window);
  const novelEnrichers = new Map();

  function chatRequest(input, init = {}) {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = String(init?.method || (typeof input !== "string" ? input?.method : "") || "GET").toUpperCase();
    return method === "POST" && /\/api\/chat(?:\?|$)/.test(url);
  }

  function parsePayload(body) {
    if (typeof body !== "string") return null;
    try {
      const payload = JSON.parse(body);
      return payload && typeof payload === "object" ? payload : null;
    } catch {
      return null;
    }
  }

  function normalizePayloadMode(payload) {
    if (!payload || typeof payload !== "object") return payload;
    if (payload.mode !== "companion") payload.mode = "novel";
    return payload;
  }

  function registerNovelEnricher(name, enricher) {
    const key = String(name || "").trim();
    if (!key) throw new TypeError("Novel enricher name is required");
    if (typeof enricher !== "function") throw new TypeError(`Novel enricher '${key}' must be a function`);
    novelEnrichers.set(key, enricher);
    return () => novelEnrichers.delete(key);
  }

  function unregisterNovelEnricher(name) {
    return novelEnrichers.delete(String(name || "").trim());
  }

  function recordEnricherError(name, error) {
    const list = Array.isArray(window.__UNLIMITED_CHAT_ENRICHER_ERRORS__)
      ? window.__UNLIMITED_CHAT_ENRICHER_ERRORS__
      : [];
    list.push({
      name,
      message: error?.message || String(error),
      at: Date.now(),
      revision: REGISTRY_REVISION
    });
    if (list.length > 20) list.splice(0, list.length - 20);
    window.__UNLIMITED_CHAT_ENRICHER_ERRORS__ = list;
  }

  async function applyNovelEnrichers(payload) {
    if (!payload || payload.mode !== "novel" || novelEnrichers.size === 0) return payload;
    for (const [name, enricher] of novelEnrichers) {
      try {
        const patch = await enricher(payload);
        if (patch && typeof patch === "object" && !Array.isArray(patch)) {
          Object.assign(payload, patch);
        }
      } catch (error) {
        recordEnricherError(name, error);
      }
    }
    return payload;
  }

  function isolatePayload(payload) {
    if (!payload || payload.mode !== "companion") return payload;
    delete payload.creative_context;
    delete payload.memory_context;
    delete payload.continuity_context;
    return payload;
  }

  async function unlimitedStableFetch(input, init = {}) {
    if (!chatRequest(input, init)) return nativeFetch(input, init);

    let payload = normalizePayloadMode(parsePayload(init?.body));
    payload = await applyNovelEnrichers(payload);
    const isolated = isolatePayload(payload);
    const nextInit = isolated
      ? { ...init, body: JSON.stringify(isolated) }
      : init;
    return nativeFetch(input, nextInit);
  }

  window.fetch = unlimitedStableFetch;
  window.fetch.__uaiV16Transport = REVISION;
  window.fetch.__uaiV16Registry = REGISTRY_REVISION;

  function generationActive() {
    if (document.body?.dataset.uaiMode && document.body.dataset.uaiMode !== "novel") return false;
    const stop = document.getElementById("stopBtn");
    if (!stop) return false;
    return getComputedStyle(stop).display !== "none";
  }

  function notify(message) {
    if (window.UnlimitedV2Phase2?.notify) {
      window.UnlimitedV2Phase2.notify(message, "warning");
      return;
    }
    let status = document.getElementById("uaiV16TransportStatus");
    if (!status) {
      status = document.createElement("div");
      status.id = "uaiV16TransportStatus";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.style.cssText = "position:fixed;left:50%;bottom:92px;z-index:99999;transform:translateX(-50%);padding:8px 12px;border:1px solid rgba(255,255,255,.1);border-radius:999px;background:rgba(18,20,18,.94);color:#e8ebe5;font:12px/1.4 system-ui,sans-serif;box-shadow:0 10px 28px rgba(0,0,0,.22);pointer-events:none";
      document.body.appendChild(status);
    }
    status.textContent = message;
    window.clearTimeout(Number(status.dataset.timer) || 0);
    const timer = window.setTimeout(() => status.remove(), 1800);
    status.dataset.timer = String(timer);
  }

  function storageFailureMessage(detail = {}) {
    const key = String(detail.key || "");
    const scope = key.startsWith("uai_companion_") ? "陪伴数据" : "小说与工作台数据";
    return `${scope}保存失败：浏览器本地存储空间可能已满。请先导出备份并清理旧数据。`;
  }

  function isUnsafeSessionAction(target) {
    return Boolean(target?.closest?.([
      "#sessionList .session-title",
      "#sessionList .delete-session",
      "#newSessionBtn",
      "#studioSessionList",
      "#studioNewSession",
      "#commandResults",
      "#workspaceSearchResults",
      ".open-clip-source",
      "#clearHistory"
    ].join(",")));
  }

  function blockSessionMutation(event) {
    if (!generationActive() || !isUnsafeSessionAction(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    notify("AI 正在生成。请先停止或等待完成，再切换或修改会话。");
  }

  function blockRepeatSend(event) {
    if (!generationActive()) return;
    const send = event.target?.closest?.("#sendBtn");
    if (!send) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    notify("当前回复仍在生成，可先点击“停止”。");
  }

  function noteUserStop(event) {
    if (!generationActive() || !event.target?.closest?.("#stopBtn")) return;
    window.setTimeout(() => notify("已停止生成，当前已经收到的内容会保留在本次会话中。"), 0);
  }

  function blockRepeatEnter(event) {
    if (!generationActive() || event.key !== "Enter" || event.shiftKey) return;
    if (event.target?.id !== "msg") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    notify("当前回复仍在生成，可先点击“停止”。");
  }

  document.addEventListener("click", blockSessionMutation, true);
  document.addEventListener("click", blockRepeatSend, true);
  document.addEventListener("click", noteUserStop, true);
  document.addEventListener("keydown", blockRepeatEnter, true);
  window.addEventListener("uai:storage-error", (event) => notify(storageFailureMessage(event?.detail)));
  if (window.__UNLIMITED_STORAGE_ERROR__) {
    window.setTimeout(() => notify(storageFailureMessage(window.__UNLIMITED_STORAGE_ERROR__)), 0);
  }

  document.documentElement.dataset.chatTransportRevision = REVISION;
  document.documentElement.dataset.chatRegistryRevision = REGISTRY_REVISION;
  window.UnlimitedChatTransportV16 = {
    revision: REVISION,
    registryRevision: REGISTRY_REVISION,
    fetch: unlimitedStableFetch,
    get generating() { return generationActive(); },
    get enrichers() { return [...novelEnrichers.keys()]; },
    registerNovelEnricher,
    unregisterNovelEnricher,
    applyNovelEnrichers,
    isolatePayload
  };
})();
