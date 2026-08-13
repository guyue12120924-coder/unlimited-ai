// public/companion-v6.js
// Companion V6: quick role switching, relationship milestones, monthly review and readable export.
(() => {
  const REVISION = "2026-08-13-v6.0-companion-review-export-1";
  const KEYS = {
    characters: "uai_companion_characters_v1",
    activeCharacter: "uai_companion_active_character_v1",
    moments: "uai_companion_moments_v1"
  };
  let scheduled = false;

  function safeParse(value, fallback) { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } }
  function readJson(key, fallback) { return safeParse(localStorage.getItem(key), fallback); }
  function clean(value, max = 240) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function activeId() { return localStorage.getItem(KEYS.activeCharacter) || ""; }
  function characters() {
    const value = readJson(KEYS.characters, []);
    return Array.isArray(value) ? value.filter((item) => item?.id && item?.profile) : [];
  }
  function activeCharacter() {
    const id = activeId();
    const list = characters();
    return list.find((item) => item.id === id) || list[0] || null;
  }
  function momentsFor(id) {
    const map = readJson(KEYS.moments, {});
    return Array.isArray(map?.[id]) ? map[id] : [];
  }
  function relationLabel(value) {
    return ({ girlfriend: "女朋友", boyfriend: "男朋友", friend: "好朋友", confidant: "知心伙伴", custom: "陪伴伙伴" })[value] || "陪伴伙伴";
  }
  function avatar(profile) {
    if (profile?.avatarData) return `<img src="${escapeHtml(profile.avatarData)}" alt="${escapeHtml(profile.name || "角色")}头像">`;
    return `<span>${profile?.relationship === "boyfriend" ? "💙" : profile?.relationship === "friend" ? "🌙" : profile?.relationship === "confidant" ? "✨" : "💗"}</span>`;
  }
  function formatDate(ts) {
    const date = new Date(Number(ts) || Date.now());
    return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  }
  function stats(character) {
    const sessions = Array.isArray(character?.sessions) ? character.sessions : [];
    const messages = sessions.reduce((sum, session) => sum + (Array.isArray(session?.messages) ? session.messages.length : 0), 0);
    const createdAt = Number(character?.createdAt || character?.profile?.createdAt) || Date.now();
    return {
      sessions: sessions.length,
      messages,
      memories: Array.isArray(character?.memories) ? character.memories.length : 0,
      moments: momentsFor(character?.id).length,
      days: Math.max(1, Math.floor((Date.now() - createdAt) / 86400000) + 1),
      createdAt
    };
  }
  function currentMonthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }
  function monthlyReview(character) {
    const start = currentMonthStart();
    const sessions = (Array.isArray(character?.sessions) ? character.sessions : []).filter((session) => Number(session?.updatedAt || session?.createdAt || 0) >= start);
    const allMessages = sessions.flatMap((session) => Array.isArray(session?.messages) ? session.messages : []);
    const userMessages = allMessages.filter((m) => m?.role === "user");
    const assistantMessages = allMessages.filter((m) => m?.role === "assistant");
    const moments = momentsFor(character?.id).filter((m) => Number(m?.savedAt || m?.createdAt || 0) >= start);
    const topics = sessions
      .filter((session) => session?.title && session.title !== "新的聊天")
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
      .slice(0, 5)
      .map((session) => clean(session.title, 48));
    const userChars = userMessages.reduce((sum, m) => sum + String(m?.content || "").length, 0);
    return { sessions: sessions.length, messages: allMessages.length, userMessages: userMessages.length, assistantMessages: assistantMessages.length, moments: moments.length, topics, userChars };
  }
  function reachedMilestones(character) {
    const s = stats(character);
    const milestones = [
      { key: "day7", met: s.days >= 7, icon: "🌱", label: "认识一周", note: "已经有一周的共同聊天记录了。" },
      { key: "msg100", met: s.messages >= 100, icon: "💬", label: "100 条消息", note: "你们已经留下了至少 100 条对话。" },
      { key: "day30", met: s.days >= 30, icon: "🌙", label: "认识一个月", note: "这段关系已经延续超过一个月。" },
      { key: "msg500", met: s.messages >= 500, icon: "✨", label: "500 条消息", note: "聊天已经形成比较稳定的长期记录。" },
      { key: "day100", met: s.days >= 100, icon: "💗", label: "认识 100 天", note: "这是一个很适合回看纪念册的节点。" },
      { key: "msg1000", met: s.messages >= 1000, icon: "📖", label: "1000 条消息", note: "共同聊天已经积累到四位数。" },
      { key: "day365", met: s.days >= 365, icon: "🎂", label: "认识一年", note: "已经走过完整一年。" }
    ];
    return milestones.filter((item) => item.met);
  }

  function closeModal() { document.getElementById("uaiCompanionV6Mask")?.remove(); }
  function openModal(html, bind) {
    closeModal();
    const mask = document.createElement("div");
    mask.id = "uaiCompanionV6Mask";
    mask.className = "uai-c-v6-mask";
    mask.innerHTML = html;
    document.body.appendChild(mask);
    mask.addEventListener("click", (event) => { if (event.target === mask) closeModal(); });
    mask.querySelector("[data-v6-close]")?.addEventListener("click", closeModal);
    bind?.(mask);
  }

  function showMonthlyReview() {
    window.UnlimitedCompanionMulti?.persist?.();
    const character = activeCharacter();
    if (!character) return;
    const review = monthlyReview(character);
    const milestoneList = reachedMilestones(character);
    const now = new Date();
    const monthName = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`;
    openModal(`
      <section class="uai-c-v6-modal review" role="dialog" aria-modal="true" aria-label="月度回顾">
        <header><div><span>MONTHLY REVIEW</span><h2>${escapeHtml(character.profile?.name || "伙伴")} · ${monthName}</h2><p>只根据当前浏览器里的真实聊天记录统计，不会凭空补写没有发生过的事情。</p></div><button type="button" data-v6-close>×</button></header>
        <div class="uai-c-v6-review-grid">
          <div><strong>${review.sessions}</strong><span>本月会话</span></div><div><strong>${review.messages}</strong><span>本月消息</span></div><div><strong>${review.userMessages}</strong><span>你发出的消息</span></div><div><strong>${review.moments}</strong><span>本月珍藏</span></div>
        </div>
        <div class="uai-c-v6-review-body">
          <section><span>RECENT TOPICS</span><h3>最近聊过</h3>${review.topics.length ? `<div class="uai-c-v6-topic-list">${review.topics.map((topic) => `<b>${escapeHtml(topic)}</b>`).join("")}</div>` : `<p class="uai-c-v6-muted">这个月还没有形成明确的会话标题。</p>`}</section>
          <section><span>MILESTONES</span><h3>已经达成的里程碑</h3>${milestoneList.length ? `<div class="uai-c-v6-milestones">${milestoneList.slice(-5).reverse().map((item) => `<article><i>${item.icon}</i><div><strong>${item.label}</strong><p>${item.note}</p></div></article>`).join("")}</div>` : `<p class="uai-c-v6-muted">继续自然聊天，里程碑会慢慢出现。</p>`}</section>
        </div>
        <footer><span>你本月大约输入了 ${review.userChars.toLocaleString("zh-CN")} 个字符</span><button type="button" id="uaiV6ExportReadable">导出可读记录</button></footer>
      </section>`, (mask) => mask.querySelector("#uaiV6ExportReadable")?.addEventListener("click", exportReadable));
  }

  function markdownEscape(text) { return String(text || "").replace(/\r/g, "").trim(); }
  function buildReadableMarkdown(character) {
    const s = stats(character);
    const sessions = [...(Array.isArray(character?.sessions) ? character.sessions : [])].sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    const moments = [...momentsFor(character.id)].sort((a, b) => Number(a.savedAt || a.createdAt || 0) - Number(b.savedAt || b.createdAt || 0));
    const lines = [
      `# ${character.profile?.name || "AI 伙伴"} · 陪伴记录`,
      "",
      `- 关系：${relationLabel(character.profile?.relationship)}`,
      `- 认识时间：${formatDate(s.createdAt)}`,
      `- 已认识：${s.days} 天`,
      `- 会话数：${s.sessions}`,
      `- 消息数：${s.messages}`,
      `- 长期记忆：${s.memories} 条`,
      `- 重要时刻：${s.moments} 条`,
      "",
      "## 角色设定",
      "",
      `性格：${(character.profile?.personality || []).join("、") || "未设置"}`,
      "",
      character.profile?.customDescription ? markdownEscape(character.profile.customDescription) : "未填写补充设定。",
      "",
      "## 重要时刻纪念册",
      ""
    ];
    if (!moments.length) lines.push("暂无珍藏的重要时刻。", "");
    else moments.forEach((moment) => {
      lines.push(`### ${formatDate(moment.savedAt || moment.createdAt)}${moment.note ? ` · ${markdownEscape(moment.note)}` : ""}`, "", `> ${markdownEscape(moment.text || moment.content).replace(/\n/g, "\n> ")}`, "");
    });
    lines.push("## 完整聊天记录", "");
    sessions.forEach((session, index) => {
      lines.push(`### ${index + 1}. ${markdownEscape(session.title || "新的聊天")}`, "", `日期：${formatDate(session.createdAt || session.updatedAt)}`, "");
      (Array.isArray(session.messages) ? session.messages : []).forEach((message) => {
        const speaker = message?.role === "assistant" ? (character.profile?.name || "AI") : "我";
        lines.push(`**${speaker}**`, "", markdownEscape(message?.content), "");
      });
    });
    return lines.join("\n");
  }
  function exportReadable() {
    window.UnlimitedCompanionMulti?.persist?.();
    const character = activeCharacter();
    if (!character) return;
    const markdown = buildReadableMarkdown(character);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `unlimited-ai-${clean(character.profile?.name, 30) || "companion"}-记录-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function ensureQuickSwitch(root) {
    const profileCard = root.querySelector("#uaiCompanionProfileCard");
    if (!profileCard) return;
    let rail = root.querySelector("#uaiCompanionV6QuickSwitch");
    const list = characters();
    if (list.length < 2) { rail?.remove(); return; }
    if (!rail) {
      rail = document.createElement("div");
      rail.id = "uaiCompanionV6QuickSwitch";
      rail.className = "uai-c-v6-quick-switch";
      profileCard.insertAdjacentElement("afterend", rail);
    }
    const signature = `${activeId()}|${list.map((c) => `${c.id}:${c.profile?.name}:${Boolean(c.profile?.avatarData)}`).join("|")}`;
    if (rail.dataset.signature === signature) return;
    rail.dataset.signature = signature;
    rail.innerHTML = `<div><span>快速切换</span><small>${list.length} 个伙伴</small></div><div class="uai-c-v6-quick-avatars">${list.map((character) => `<button type="button" data-v6-character="${escapeHtml(character.id)}" class="${character.id === activeId() ? "active" : ""}" title="切换到 ${escapeHtml(character.profile?.name || "未命名")}"><i>${avatar(character.profile)}</i><b>${escapeHtml(clean(character.profile?.name, 6) || "伙伴")}</b></button>`).join("")}</div>`;
    rail.querySelectorAll("[data-v6-character]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.v6Character === activeId()) return;
      if (document.querySelector("#uaiCompanionInput:disabled")) return alert("当前回复还在生成，请先点击“停止”再切换角色。");
      window.UnlimitedCompanionMulti?.switchCharacter?.(button.dataset.v6Character);
    }));
  }

  function ensureReviewCard(root) {
    const profileCard = root.querySelector("#uaiCompanionProfileCard");
    if (!profileCard || root.querySelector("#uaiCompanionV6ReviewCard")) return;
    const character = activeCharacter();
    if (!character) return;
    const review = monthlyReview(character);
    const milestones = reachedMilestones(character);
    const latest = milestones.at(-1);
    const card = document.createElement("section");
    card.id = "uaiCompanionV6ReviewCard";
    card.className = "uai-c-v6-review-card";
    card.innerHTML = `<button type="button" id="uaiV6OpenReview"><span>${latest ? `${latest.icon} ${escapeHtml(latest.label)}` : "MONTHLY REVIEW"}</span><strong>${review.messages ? `这个月已经聊了 ${review.messages} 条消息` : "看看这个月的关系记录"}</strong><small>${review.moments ? `珍藏了 ${review.moments} 个重要时刻` : "月度回顾 · 里程碑 · 可读导出"} ›</small></button>`;
    const anchor = root.querySelector("#uaiCompanionV5Profile")?.closest(".uai-c-v5-character-bar") || profileCard;
    anchor.insertAdjacentElement("afterend", card);
    card.querySelector("#uaiV6OpenReview")?.addEventListener("click", showMonthlyReview);
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root) return;
    ensureQuickSwitch(root);
    ensureReviewCard(root);
  }
  function schedule() { if (scheduled) return; scheduled = true; requestAnimationFrame(enhance); }
  function init() {
    document.documentElement.dataset.companionReviewExportRevision = REVISION;
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-uai-mode", "hidden", "class"] });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && document.getElementById("uaiCompanionV6Mask")) closeModal(); });
    schedule();
  }

  window.UnlimitedCompanionReviewExport = { revision: REVISION, monthlyReview, reachedMilestones, showMonthlyReview, buildReadableMarkdown, exportReadable };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();