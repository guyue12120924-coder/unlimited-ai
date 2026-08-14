// Companion V11.0 — immersive chat shell + on-demand companion space drawer.
(() => {
  const REVISION = "2026-08-14-v11.0-shell-1";
  const MOMENTS_KEY = "uai_companion_moments_v1";
  const ACTIVE_CHARACTER_KEY = "uai_companion_active_character_v1";
  let scheduled = false;

  function state() {
    return window.UnlimitedCompanion?.getState?.() || {};
  }

  function relationLabel(value) {
    return ({
      girlfriend: "女朋友",
      boyfriend: "男朋友",
      friend: "好朋友",
      confidant: "知心伙伴",
      custom: "陪伴伙伴"
    })[value] || "陪伴伙伴";
  }

  function avatarSymbol(profile) {
    if (profile?.relationship === "boyfriend") return "💙";
    if (profile?.relationship === "friend") return "🌙";
    return "💗";
  }

  function daysKnown(profile) {
    const createdAt = Number(profile?.createdAt || 0);
    if (!createdAt) return 1;
    return Math.max(1, Math.floor((Date.now() - createdAt) / 86400000) + 1);
  }

  function messageCount(sessions) {
    return sessions.reduce((sum, session) => sum + (Array.isArray(session?.messages) ? session.messages.length : 0), 0);
  }

  function momentCount() {
    try {
      const map = JSON.parse(localStorage.getItem(MOMENTS_KEY) || "{}");
      const id = localStorage.getItem(ACTIVE_CHARACTER_KEY) || "legacy";
      return Array.isArray(map?.[id]) ? map[id].length : 0;
    } catch {
      return 0;
    }
  }

  function stageFor(profile, sessions) {
    const stats = { days: daysKnown(profile), sessions: sessions.length, messages: messageCount(sessions) };
    if (stats.days >= 7 && stats.messages >= 180 && stats.sessions >= 8) {
      return { label: "很有默契", progress: 92, note: "已经形成比较稳定的长期互动。" };
    }
    if (stats.days >= 3 && stats.messages >= 70 && stats.sessions >= 4) {
      return { label: "渐渐亲近", progress: 68, note: "共同话题和聊天记忆正在积累。" };
    }
    if (stats.messages >= 20 || stats.sessions >= 2) {
      return { label: "越来越熟", progress: 42, note: "你们已经不只是第一次聊天了。" };
    }
    return { label: "刚刚认识", progress: 18, note: "多聊几次，这里会慢慢留下更多记录。" };
  }

  function summaryText(profile) {
    const text = String(profile?.customDescription || "").replace(/\s+/g, " ").trim();
    if (text) return text.slice(0, 86) + (text.length > 86 ? "…" : "");
    return "你的专属 AI 陪伴角色。";
  }

  function setAvatar(host, profile) {
    if (!host) return;
    host.innerHTML = "";
    if (profile?.avatarData) {
      const image = document.createElement("img");
      image.src = profile.avatarData;
      image.alt = `${profile?.name || "AI 伙伴"}头像`;
      host.appendChild(image);
      return;
    }
    const symbol = document.createElement("span");
    symbol.textContent = avatarSymbol(profile);
    host.appendChild(symbol);
  }

  function closeDrawer(root) {
    root?.classList.remove("uai-c-v11-drawer-open");
    root?.querySelector(".uai-c-v11-drawer")?.setAttribute("aria-hidden", "true");
  }

  function openDrawer(root) {
    if (!root) return;
    refreshDrawer(root);
    root.classList.add("uai-c-v11-drawer-open");
    const drawer = root.querySelector(".uai-c-v11-drawer");
    drawer?.setAttribute("aria-hidden", "false");
    window.setTimeout(() => drawer?.querySelector(".uai-c-v11-drawer-close")?.focus(), 30);
  }

  function runDrawerAction(root, action) {
    closeDrawer(root);
    if (action === "role") return window.UnlimitedCompanionCharacterControls?.openEditor?.();
    if (action === "memory") return root.querySelector("#uaiCompanionMemoryBtn")?.click();
    if (action === "moments") return window.UnlimitedCompanionMemorySearch?.showMoments?.();
    if (action === "relationship") return window.UnlimitedCompanionProfileRestore?.showCharacterProfile?.();
    if (action === "review") return window.UnlimitedCompanionExtras?.showMonthlyReview?.();
    if (action === "settings") return root.querySelector("#uaiCompanionSettingsBtn")?.click();
  }

  function ensureHeaderTrigger(root) {
    const header = root.querySelector(".uai-c-header");
    if (!header || header.querySelector("#uaiV11CompanionSpace")) return;

    const actions = document.createElement("div");
    actions.className = "uai-c-v11-header-actions";
    const button = document.createElement("button");
    button.id = "uaiV11CompanionSpace";
    button.type = "button";
    button.className = "uai-c-v11-space-trigger";
    button.setAttribute("aria-label", "打开陪伴空间");
    button.innerHTML = `<i>♡</i><span>陪伴空间</span>`;
    button.addEventListener("click", () => openDrawer(root));
    actions.appendChild(button);
    header.appendChild(actions);
  }

  function ensureDrawer(root) {
    if (root.querySelector(".uai-c-v11-drawer")) return;

    const overlay = document.createElement("div");
    overlay.className = "uai-c-v11-drawer-overlay";
    overlay.addEventListener("click", () => closeDrawer(root));

    const drawer = document.createElement("aside");
    drawer.className = "uai-c-v11-drawer";
    drawer.setAttribute("aria-label", "陪伴空间");
    drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML = `
      <div class="uai-c-v11-drawer-top">
        <span class="uai-c-v11-drawer-kicker">COMPANION SPACE</span>
        <button type="button" class="uai-c-v11-drawer-close" aria-label="关闭陪伴空间">×</button>
      </div>
      <section class="uai-c-v11-drawer-hero">
        <div class="uai-c-v11-drawer-avatar"></div>
        <div class="uai-c-v11-drawer-name">AI 伙伴</div>
        <div class="uai-c-v11-drawer-relation">陪伴伙伴 · 在线</div>
        <div class="uai-c-v11-drawer-summary"></div>
      </section>
      <div class="uai-c-v11-drawer-stats">
        <div><strong data-v11-days>1</strong><span>认识天数</span></div>
        <div><strong data-v11-messages>0</strong><span>聊天消息</span></div>
        <div><strong data-v11-memories>0</strong><span>长期记忆</span></div>
      </div>
      <section class="uai-c-v11-relationship-card">
        <div class="uai-c-v11-relationship-head"><span>关系状态</span><strong data-v11-stage>刚刚认识</strong></div>
        <div class="uai-c-v11-progress"><i></i></div>
        <p data-v11-stage-note></p>
      </section>
      <section class="uai-c-v11-drawer-section">
        <span class="uai-c-v11-drawer-label">角色与记忆</span>
        <button type="button" class="uai-c-v11-drawer-action" data-v11-action="role"><i>♡</i><b>角色档案</b><span>›</span></button>
        <button type="button" class="uai-c-v11-drawer-action" data-v11-action="memory"><i>✦</i><b>长期记忆</b><span>›</span></button>
        <button type="button" class="uai-c-v11-drawer-action" data-v11-action="moments"><i>☆</i><b>重要时刻</b><span>›</span></button>
      </section>
      <section class="uai-c-v11-drawer-section">
        <span class="uai-c-v11-drawer-label">关系与回顾</span>
        <button type="button" class="uai-c-v11-drawer-action" data-v11-action="relationship"><i>♡</i><b>关系记录</b><span>›</span></button>
        <button type="button" class="uai-c-v11-drawer-action" data-v11-action="review"><i>◌</i><b>本月回顾</b><span>›</span></button>
        <button type="button" class="uai-c-v11-drawer-action" data-v11-action="settings"><i>⚙</i><b>聊天设置</b><span>›</span></button>
      </section>
      <div class="uai-c-v11-drawer-foot"><span data-v11-moments>0</span> 个重要时刻 · 数据仅保存在当前浏览器</div>`;

    drawer.querySelector(".uai-c-v11-drawer-close")?.addEventListener("click", () => closeDrawer(root));
    drawer.addEventListener("click", (event) => {
      const button = event.target.closest("[data-v11-action]");
      if (!button) return;
      runDrawerAction(root, button.dataset.v11Action);
    });

    root.append(overlay, drawer);
  }

  function refreshDrawer(root) {
    const drawer = root.querySelector(".uai-c-v11-drawer");
    if (!drawer) return;
    const current = state();
    const profile = current.profile || {};
    const sessions = Array.isArray(current.sessions) ? current.sessions : [];
    const memories = Array.isArray(current.memories) ? current.memories : [];
    const stage = stageFor(profile, sessions);

    setAvatar(drawer.querySelector(".uai-c-v11-drawer-avatar"), profile);
    const name = drawer.querySelector(".uai-c-v11-drawer-name");
    const relation = drawer.querySelector(".uai-c-v11-drawer-relation");
    const summary = drawer.querySelector(".uai-c-v11-drawer-summary");
    if (name) name.textContent = profile.name || "AI 伙伴";
    if (relation) relation.textContent = `${relationLabel(profile.relationship)} · 在线`;
    if (summary) summary.textContent = summaryText(profile);

    const days = drawer.querySelector("[data-v11-days]");
    const messages = drawer.querySelector("[data-v11-messages]");
    const memoryCount = drawer.querySelector("[data-v11-memories]");
    const moments = drawer.querySelector("[data-v11-moments]");
    const stageLabel = drawer.querySelector("[data-v11-stage]");
    const stageNote = drawer.querySelector("[data-v11-stage-note]");
    const progress = drawer.querySelector(".uai-c-v11-progress i");
    if (days) days.textContent = String(daysKnown(profile));
    if (messages) messages.textContent = String(messageCount(sessions));
    if (memoryCount) memoryCount.textContent = String(memories.length);
    if (moments) moments.textContent = String(momentCount());
    if (stageLabel) stageLabel.textContent = stage.label;
    if (stageNote) stageNote.textContent = stage.note;
    if (progress) progress.style.width = `${stage.progress}%`;
  }

  function decorateMessageFlow(root) {
    const rows = [...root.querySelectorAll("#uaiCompanionMessages .uai-c-message-row")];
    rows.forEach((row, index) => {
      const previous = rows[index - 1];
      const continuation = row.classList.contains("assistant") && previous?.classList.contains("assistant");
      row.classList.toggle("uai-c-v11-continuation", Boolean(continuation));
    });
  }

  function bindHeaderIdentity(root) {
    const avatar = root.querySelector("#uaiCompanionHeaderAvatar");
    if (avatar && avatar.dataset.v11DrawerBound !== "1") {
      avatar.dataset.v11DrawerBound = "1";
      avatar.style.cursor = "pointer";
      avatar.title = "打开陪伴空间";
      avatar.addEventListener("click", () => openDrawer(root));
    }
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root || root.hidden) return;
    root.dataset.v11Shell = REVISION;
    ensureHeaderTrigger(root);
    ensureDrawer(root);
    refreshDrawer(root);
    decorateMessageFlow(root);
    bindHeaderIdentity(root);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionV11Revision = REVISION;
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const root = document.getElementById("uaiCompanionRoot");
      if (root?.classList.contains("uai-c-v11-drawer-open")) closeDrawer(root);
    }, true);
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode"]
    });
    window.addEventListener("resize", schedule, { passive: true });
    window.UnlimitedCompanionV11 = { revision: REVISION, refresh: schedule, openDrawer: () => openDrawer(document.getElementById("uaiCompanionRoot")) };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
