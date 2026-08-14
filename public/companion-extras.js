// Companion extras: message utilities, important moments, scroll helper and relationship review.
(() => {
  const REVISION = "2026-08-14-v9.1-extras-1";
  const KEYS = {
    activeCharacter: "uai_companion_active_character_v1",
    moments: "uai_companion_moments_v1"
  };
  let scheduled = false;

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }
  function readJson(key, fallback) { return safeParse(localStorage.getItem(key), fallback); }
  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function clean(value, max = 240) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function makeId(prefix) {
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${token}`;
  }
  function state() { return window.UnlimitedCompanion?.getState?.() || null; }
  function currentSession() {
    const s = state();
    const sessions = Array.isArray(s?.sessions) ? s.sessions : [];
    return sessions.find((item) => item?.id === s?.currentSessionId) || sessions[0] || null;
  }
  function activeCharacterId() { return localStorage.getItem(KEYS.activeCharacter) || "legacy"; }

  function showToast(message) {
    const root = document.getElementById("uaiCompanionRoot");
    if (!root) return;
    let toast = root.querySelector("#uaiV8Toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "uaiV8Toast";
      toast.className = "uai-c-v8-toast";
      root.appendChild(toast);
    }
    toast.textContent = String(message || "");
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 1500);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("已复制");
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      showToast("已复制");
    }
  }

  function momentsMap() {
    const value = readJson(KEYS.moments, {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function currentMoments() {
    const list = momentsMap()[activeCharacterId()];
    return Array.isArray(list) ? list : [];
  }
  function saveMoments(list) {
    const map = momentsMap();
    map[activeCharacterId()] = Array.isArray(list) ? list.slice(-120) : [];
    writeJson(KEYS.moments, map);
  }
  function addMoment(message, session, messageIndex) {
    if (!message || !session) return;
    const list = currentMoments();
    const text = clean(message.content, 500);
    if (!text) return;
    if (list.some((item) => item.sessionId === session.id && item.messageIndex === messageIndex && clean(item.text, 500) === text)) {
      showToast("这条已经珍藏过了");
      return;
    }
    const note = window.prompt("给这个重要时刻加一句备注（可留空）：", "");
    if (note === null) return;
    list.push({
      id: makeId("moment"),
      sessionId: session.id,
      messageIndex,
      role: message.role === "user" ? "user" : "assistant",
      text,
      note: clean(note, 120),
      createdAt: Number(message.createdAt) || Date.now(),
      savedAt: Date.now()
    });
    saveMoments(list);
    showToast("已加入重要时刻");
  }

  function ensureMessageActions(root) {
    const session = currentSession();
    const rows = Array.from(root.querySelectorAll("#uaiCompanionMessages .uai-c-message-row"));
    rows.forEach((row, index) => {
      const bubble = row.querySelector(".uai-c-bubble");
      if (!bubble || bubble.querySelector(".uai-c-typing") || row.querySelector(":scope .uai-c-v8-message-actions")) return;
      const text = bubble.textContent?.trim();
      if (!text) return;
      const actions = document.createElement("span");
      actions.className = "uai-c-v8-message-actions";

      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "复制";
      copy.addEventListener("click", () => copyText(text));
      actions.appendChild(copy);

      const message = session?.messages?.[index];
      if (message) {
        const moment = document.createElement("button");
        moment.type = "button";
        moment.textContent = "珍藏";
        moment.addEventListener("click", () => addMoment(message, session, index));
        actions.appendChild(moment);
      }

      const host = row.querySelector(".uai-c-v3-actions")?.parentElement || bubble.parentElement;
      host?.appendChild(actions);
    });
  }

  function ensureScrollBottom(root) {
    const container = root.querySelector("#uaiCompanionMessages");
    const main = root.querySelector(".uai-c-main");
    if (!container || !main) return;
    let button = main.querySelector("#uaiV8ScrollBottom");
    if (!button) {
      button = document.createElement("button");
      button.id = "uaiV8ScrollBottom";
      button.className = "uai-c-v8-scroll-bottom";
      button.type = "button";
      button.textContent = "↓ 回到底部";
      button.addEventListener("click", () => container.scrollTo({ top: container.scrollHeight, behavior: "smooth" }));
      main.appendChild(button);
      container.addEventListener("scroll", () => {
        const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
        button.classList.toggle("show", distance > 220);
      }, { passive: true });
    }
  }

  function monthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }
  function monthlyStats() {
    const s = state();
    const start = monthStart();
    const sessions = (Array.isArray(s?.sessions) ? s.sessions : []).filter((session) => Number(session?.updatedAt || session?.createdAt || 0) >= start);
    const messages = sessions.flatMap((session) => Array.isArray(session?.messages) ? session.messages : []);
    const topics = sessions
      .filter((session) => session?.title && session.title !== "新的聊天")
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
      .slice(0, 5)
      .map((session) => clean(session.title, 40));
    const moments = currentMoments().filter((item) => Number(item?.savedAt || item?.createdAt || 0) >= start);
    return {
      sessions: sessions.length,
      messages: messages.length,
      userMessages: messages.filter((message) => message?.role === "user").length,
      moments: moments.length,
      topics
    };
  }

  function readableMarkdown() {
    const s = state();
    const profile = s?.profile || {};
    const sessions = [...(Array.isArray(s?.sessions) ? s.sessions : [])].sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    const lines = [`# ${profile.name || "AI 伙伴"} · 陪伴记录`, "", `导出时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`, "", "## 聊天记录", ""];
    sessions.forEach((session, index) => {
      lines.push(`### ${index + 1}. ${session.title || "新的聊天"}`, "");
      (Array.isArray(session.messages) ? session.messages : []).forEach((message) => {
        lines.push(`**${message.role === "assistant" ? (profile.name || "AI") : "我"}**`, "", String(message.content || "").trim(), "");
      });
    });
    return lines.join("\n");
  }
  function exportReadable() {
    const blob = new Blob([readableMarkdown()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `unlimited-ai-companion-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function closeReview() { document.getElementById("uaiV8ReviewMask")?.remove(); }
  function showMonthlyReview() {
    closeReview();
    const s = state();
    if (!s?.profile) return;
    const stats = monthlyStats();
    const now = new Date();
    const mask = document.createElement("div");
    mask.id = "uaiV8ReviewMask";
    mask.className = "uai-c-v8-review-mask";
    mask.innerHTML = `
      <section class="uai-c-v8-review-modal" role="dialog" aria-modal="true" aria-label="本月回顾">
        <header><div><span>MONTHLY REVIEW</span><h3>${escapeHtml(s.profile.name || "伙伴")} · ${now.getFullYear()} 年 ${now.getMonth() + 1} 月</h3><p>只统计当前浏览器里真实存在的聊天记录。</p></div><button type="button" data-v8-review-close>×</button></header>
        <div class="uai-c-v8-review-stats"><div><strong>${stats.sessions}</strong><span>会话</span></div><div><strong>${stats.messages}</strong><span>消息</span></div><div><strong>${stats.userMessages}</strong><span>你发出的</span></div><div><strong>${stats.moments}</strong><span>重要时刻</span></div></div>
        <section class="uai-c-v8-review-topics"><span>最近聊过</span>${stats.topics.length ? `<div>${stats.topics.map((topic) => `<b>${escapeHtml(topic)}</b>`).join("")}</div>` : `<p>这个月还没有形成明确的聊天主题。</p>`}</section>
        <footer><button type="button" data-v8-export-readable>导出可读记录</button><button type="button" data-v8-review-close>关闭</button></footer>
      </section>`;
    document.body.appendChild(mask);
    mask.addEventListener("click", (event) => { if (event.target === mask) closeReview(); });
    mask.querySelectorAll("[data-v8-review-close]").forEach((button) => button.addEventListener("click", closeReview));
    mask.querySelector("[data-v8-export-readable]")?.addEventListener("click", exportReadable);
  }

  function enhanceRelationshipRecord() {
    const mask = document.getElementById("uaiCompanionV5Mask");
    const modal = mask?.querySelector(".uai-c-v5-modal.profile");
    if (!modal) return;
    const header = modal.querySelector("header");
    if (!header || header.querySelector("#uaiV8MonthlyReview")) return;
    const close = header.querySelector("[data-v5-close]");
    const button = document.createElement("button");
    button.type = "button";
    button.id = "uaiV8MonthlyReview";
    button.className = "uai-c-v8-inline-action";
    button.textContent = "本月回顾";
    button.addEventListener("click", () => {
      mask.remove();
      showMonthlyReview();
    });
    if (close) header.insertBefore(button, close);
    else header.appendChild(button);
  }

  function enhanceCharacterManager() {
    const manager = document.getElementById("uaiCompanionV3Mask");
    if (!manager) return;
    manager.querySelectorAll(".uai-c-v3-character-card[data-character-id]").forEach((card) => {
      const actions = card.querySelector(".uai-c-v3-character-actions");
      if (!actions || actions.querySelector("[data-v8-edit-character]")) return;
      const edit = document.createElement("button");
      edit.type = "button";
      edit.dataset.v8EditCharacter = "1";
      edit.textContent = "编辑";
      edit.addEventListener("click", () => {
        const id = card.dataset.characterId;
        if (id) window.UnlimitedCompanionCharacterControls?.openEditor?.(id);
      });
      const del = actions.querySelector("[data-delete-character]");
      if (del) actions.insertBefore(edit, del);
      else actions.appendChild(edit);
    });
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root) return;
    ensureMessageActions(root);
    ensureScrollBottom(root);
    enhanceRelationshipRecord();
    enhanceCharacterManager();
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }
  function init() {
    document.documentElement.dataset.companionExtrasRevision = REVISION;
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.getElementById("uaiV8ReviewMask")) closeReview();
    });
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode"]
    });
    schedule();
  }

  window.UnlimitedCompanionExtras = { revision: REVISION, refresh: schedule, showMonthlyReview, exportReadable };
  window.UnlimitedCompanionV8Secondary = window.UnlimitedCompanionExtras;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
