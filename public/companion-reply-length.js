(() => {
  const REVISION = "2026-08-13-v7.2-reply-length-1";
  const PRESETS = {
    short: { chars: 500, label: "约 500 字" },
    balanced: { chars: 1000, label: "约 1000 字 · 默认" },
    detailed: { chars: 5000, label: "约 5000 字" }
  };
  let scheduled = false;
  const nativeFetch = window.fetch.bind(window);

  function refreshUi() {
    scheduled = false;
    const select = document.getElementById("uaiCompanionReplyLength");
    if (!select) return;
    Object.entries(PRESETS).forEach(([value, preset]) => {
      const option = select.querySelector(`option[value="${value}"]`);
      if (option) option.textContent = preset.label;
    });
    const field = select.closest(".uai-c-field");
    if (field && !field.querySelector(".uai-c-reply-length-note")) {
      const note = document.createElement("small");
      note.className = "uai-c-reply-length-note";
      note.textContent = "实际回复会根据对话自然上下浮动，避免为了凑字数重复内容。";
      field.appendChild(note);
    }
  }

  function scheduleUi() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refreshUi);
  }

  function patchBody(body) {
    if (typeof body !== "string") return body;
    let payload;
    try { payload = JSON.parse(body); } catch { return body; }
    if (payload?.mode !== "companion") return body;

    const selected = String(payload?.companion_preferences?.replyLength || "balanced");
    const preset = PRESETS[selected] || PRESETS.balanced;
    payload.companion_preferences = { ...(payload.companion_preferences || {}), replyLength: "detailed" };

    const messages = Array.isArray(payload.messages) ? payload.messages.map((item) => ({ ...item })) : [];
    const hint = `【回复长度】本轮以约 ${preset.chars} 个中文字符为目标，可自然上下浮动约 20%。保持内容完整、自然、有互动感，不要重复或灌水。`;
    let attached = false;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "user" && typeof messages[i]?.content === "string") {
        messages[i].content = `${messages[i].content}\n\n${hint}`;
        attached = true;
        break;
      }
    }
    if (!attached) messages.push({ role: "user", content: hint });
    payload.messages = messages;
    return JSON.stringify(payload);
  }

  window.fetch = function (input, init = {}) {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = String(init?.method || (typeof input !== "string" ? input?.method : "") || "GET").toUpperCase();
    if (method !== "POST" || !/\/api\/chat(?:\?|$)/.test(url)) return nativeFetch(input, init);
    return nativeFetch(input, { ...init, body: patchBody(init.body) });
  };

  function init() {
    document.documentElement.dataset.companionReplyLengthRevision = REVISION;
    new MutationObserver(scheduleUi).observe(document.body, { subtree: true, childList: true });
    scheduleUi();
  }

  window.UnlimitedCompanionReplyLength = { revision: REVISION, presets: PRESETS, refresh: scheduleUi };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();