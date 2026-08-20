// public/chat-transport-v16.js
// V16 stability layer: normalize novel SSE chunks, enforce mode-request isolation,
// and prevent session mutations while the legacy novel sender is active.
(() => {
  const REVISION = "2026-08-20-v16.0-chat-transport";
  if (window.UnlimitedChatTransportV16) return;

  const nativeFetch = window.fetch.bind(window);
  const encoder = new TextEncoder();

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

  function isolatePayload(payload) {
    if (!payload || payload.mode !== "companion") return payload;
    // Novel-only context must never leave the browser on companion requests.
    delete payload.creative_context;
    delete payload.memory_context;
    delete payload.continuity_context;
    return payload;
  }

  function lineCanFlush(line) {
    const clean = String(line || "").trim();
    if (!clean) return true;
    if (!clean.startsWith("data:")) return true;
    const data = clean.slice(5).trim();
    if (!data || data === "[DONE]") return true;
    try {
      JSON.parse(data);
      return true;
    } catch {
      return false;
    }
  }

  function lineBufferedBody(body, signal = null) {
    if (!body || typeof ReadableStream === "undefined") return body;
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let closed = false;

    return new ReadableStream({
      async pull(controller) {
        if (closed) return;
        try {
          while (true) {
            const newline = buffer.indexOf("\n");
            if (newline >= 0) {
              const line = buffer.slice(0, newline + 1);
              buffer = buffer.slice(newline + 1);
              controller.enqueue(encoder.encode(line));
              return;
            }

            const { done, value } = await reader.read();
            if (done) {
              buffer += decoder.decode();
              if (buffer) {
                controller.enqueue(encoder.encode(buffer));
                buffer = "";
                return;
              }
              closed = true;
              controller.close();
              return;
            }
            buffer += decoder.decode(value, { stream: true });
          }
        } catch (error) {
          // A user-triggered AbortController abort should behave like a clean end of the
          // novel stream. The legacy sender will then persist the text already received
          // instead of treating the partial answer as an unsaved exception.
          if (signal?.aborted) {
            try {
              buffer += decoder.decode();
              if (buffer && lineCanFlush(buffer)) {
                controller.enqueue(encoder.encode(buffer.endsWith("\n") ? buffer : `${buffer}\n`));
              }
            } catch {}
            buffer = "";
            closed = true;
            controller.close();
            return;
          }
          closed = true;
          controller.error(error);
        }
      },
      cancel(reason) {
        closed = true;
        return reader.cancel(reason).catch(() => {});
      }
    });
  }

  function wrapNovelSse(response, payload, signal) {
    if (!response?.body || payload?.mode === "companion") return response;
    const type = response.headers.get("content-type") || "";
    if (!/text\/event-stream/i.test(type)) return response;
    return new Response(lineBufferedBody(response.body, signal), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }

  window.fetch = async function unlimitedStableFetch(input, init = {}) {
    if (!chatRequest(input, init)) return nativeFetch(input, init);

    const payload = parsePayload(init?.body);
    const isolated = isolatePayload(payload);
    const nextInit = isolated
      ? { ...init, body: JSON.stringify(isolated) }
      : init;
    const response = await nativeFetch(input, nextInit);
    return wrapNovelSse(response, isolated, nextInit?.signal || null);
  };
  window.fetch.__uaiV16Transport = REVISION;

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

  document.documentElement.dataset.chatTransportRevision = REVISION;
  window.UnlimitedChatTransportV16 = {
    revision: REVISION,
    get generating() { return generationActive(); },
    isolatePayload,
    lineBufferedBody
  };
})();