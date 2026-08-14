// Companion V11.3-V11.5 — relationship story, role themes, and immersive focus mode.
(() => {
  const REVISION = "2026-08-14-v11.5-stage3-1";
  const THEME_KEY = "uai_companion_theme_map_v1";
  const IMMERSIVE_KEY = "uai_companion_immersive_v1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  const MOMENTS_KEY = "uai_companion_moments_v1";
  let scheduled = false;

  const THEMES = {
    lavender: { label: "薰衣草", icon: "✦", a: "#8b5cf6", b: "#ec4899", soft: "#f1ebff", glow: "rgba(139,92,246,.12)" },
    sakura: { label: "樱花", icon: "♡", a: "#ec6f9f", b: "#b56ee8", soft: "#fff0f6", glow: "rgba(236,111,159,.12)" },
    ocean: { label: "海盐", icon: "◌", a: "#5b7cfa", b: "#5dc8d7", soft: "#eef4ff", glow: "rgba(91,124,250,.12)" },
    mint: { label: "薄荷", icon: "◇", a: "#45a58a", b: "#6f8fe8", soft: "#edf9f5", glow: "rgba(69,165,138,.12)" },
    dusk: { label: "暮色", icon: "☾", a: "#6f63d9", b: "#c15f91", soft: "#f0edff", glow: "rgba(111,99,217,.12)" }
  };

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }
  function state() { return window.UnlimitedCompanion?.getState?.() || {}; }
  function activeId() { return localStorage.getItem(ACTIVE_KEY) || "legacy"; }
  function themeMap() {
    const value = safeParse(localStorage.getItem(THEME_KEY), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function currentThemeKey() {
    const key = themeMap()[activeId()] || "lavender";
    return THEMES[key] ? key : "lavender";
  }
  function saveTheme(key) {
    if (!THEMES[key]) return;
    const map = themeMap();
    map[activeId()] = key;
    localStorage.setItem(THEME_KEY, JSON.stringify(map));
  }
  function moments() {
    const map = safeParse(localStorage.getItem(MOMENTS_KEY), {});
    const list = map && typeof map === "object" ? map[activeId()] : [];
    return Array.isArray(list) ? list : [];
  }
  function profile() { return state().profile || {}; }
  function relationLabel(value) {
    return ({ girlfriend: "女朋友", boyfriend: "男朋友", friend: "好朋友", confidant: "知心伙伴", custom: "陪伴伙伴" })[value] || "陪伴伙伴";
  }
  function avatarSymbol(value) {
    if (value?.relationship === "boyfriend") return "💙";
    if (value?.relationship === "friend") return "🌙";
    if (value?.relationship === "confidant") return "✨";
    return "💗";
  }
  function fillAvatar(host, value) {
    if (!host) return;
    const src = String(value?.avatarData || "");
    host.innerHTML = "";
    if (src) {
      const image = document.createElement("img");
      image.src = src;
      image.alt = `${value?.name || "AI 伙伴"}头像`;
      host.appendChild(image);
    } else {
      const span = document.createElement("span");
      span.textContent = avatarSymbol(value);
      host.appendChild(span);
    }
  }
  function stats() {
    const current = state();
    const sessions = Array.isArray(current.sessions) ? current.sessions : [];
    const messages = sessions.reduce((sum, session) => sum + (Array.isArray(session?.messages) ? session.messages.length : 0), 0);
    const memories = Array.isArray(current.memories) ? current.memories.length : 0;
    const createdAt = Number(current.profile?.createdAt || 0) || Date.now();
    const days = Math.max(1, Math.floor((Date.now() - createdAt) / 86400000) + 1);
    return { sessions: sessions.length, messages, memories, moments: moments().length, days };
  }
  function relationshipStage(value) {
    if (value.days >= 7 && value.messages >= 180 && value.sessions >= 8) return { label: "很有默契", progress: 92, note: "你们已经形成稳定而持续的互动。" };
    if (value.days >= 3 && value.messages >= 70 && value.sessions >= 4) return { label: "渐渐亲近", progress: 68, note: "熟悉的话题和共同记忆正在慢慢变多。" };
    if (value.messages >= 20 || value.sessions >= 2) return { label: "越来越熟", progress: 43, note: "这已经不只是第一次聊天了。" };
    return { label: "刚刚认识", progress: 18, note: "从今天开始，这里会一点点留下你们的故事。" };
  }
  function monthLabel(value) {
    const date = new Date(Number(value) || value || Date.now());
    if (Number.isNaN(date.getTime())) return "最近";
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
  }
  function dateLabel(value) {
    const date = new Date(Number(value) || value || Date.now());
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
  }

  function applyTheme(root) {
    if (!root) return;
    const key = currentThemeKey();
    const theme = THEMES[key];
    root.dataset.v11Theme = key;
    root.style.setProperty("--v11-a", theme.a);
    root.style.setProperty("--v11-b", theme.b);
    root.style.setProperty("--v11-soft", theme.soft);
    root.style.setProperty("--v11-glow", theme.glow);
    document.documentElement.dataset.companionTheme = key;
    document.querySelectorAll("[data-v11-theme-choice]").forEach((button) => {
      button.classList.toggle("active", button.dataset.v11ThemeChoice === key);
    });
  }

  function themeButtons() {
    return Object.entries(THEMES).map(([key, item]) => `
      <button type="button" class="uai-c-v11-theme-choice" data-v11-theme-choice="${key}" style="--theme-a:${item.a};--theme-b:${item.b}">
        <i>${item.icon}</i><span>${item.label}</span>
      </button>`).join("");
  }
  function bindThemePicker(host, root) {
    if (!host || host.dataset.v11ThemeBound === "1") return;
    host.dataset.v11ThemeBound = "1";
    host.addEventListener("click", (event) => {
      const button = event.target.closest("[data-v11-theme-choice]");
      if (!button) return;
      saveTheme(button.dataset.v11ThemeChoice);
      applyTheme(root);
    });
  }

  function ensureDrawerTheme(root) {
    const drawer = root.querySelector(".uai-c-v11-drawer");
    if (!drawer) return;
    let picker = drawer.querySelector(".uai-c-v11-drawer-theme");
    if (!picker) {
      picker = document.createElement("section");
      picker.className = "uai-c-v11-drawer-section uai-c-v11-drawer-theme";
      picker.innerHTML = `<span class="uai-c-v11-drawer-label">陪伴主题</span><div class="uai-c-v11-theme-grid">${themeButtons()}</div>`;
      const foot = drawer.querySelector(".uai-c-v11-drawer-foot");
      drawer.insertBefore(picker, foot || null);
    }
    bindThemePicker(picker, root);
  }

  function ensureSettingsTheme(root) {
    const modal = document.querySelector("#uaiCompanionModalMask:not([hidden]) .uai-c-v10-settings");
    const body = modal?.querySelector(".uai-c-modal-body");
    if (!body) return;
    let card = body.querySelector(":scope > .uai-c-v11-theme-card");
    if (!card) {
      card = document.createElement("section");
      card.className = "uai-c-v11-theme-card";
      card.innerHTML = `<div><strong>聊天主题</strong><span>只改变当前角色的界面颜色，不影响角色设定。</span></div><div class="uai-c-v11-theme-grid">${themeButtons()}</div>`;
      const firstField = body.querySelector(".uai-c-field");
      if (firstField) firstField.insertAdjacentElement("beforebegin", card);
      else body.prepend(card);
    }
    bindThemePicker(card, root);
  }

  function setImmersive(root, enabled) {
    if (!root) return;
    root.classList.toggle("uai-c-v11-immersive", enabled);
    localStorage.setItem(IMMERSIVE_KEY, enabled ? "1" : "0");
    const button = root.querySelector("#uaiV11ImmersiveToggle");
    if (button) {
      button.classList.toggle("active", enabled);
      button.querySelector("span").textContent = enabled ? "退出沉浸" : "沉浸";
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
    }
  }
  function ensureImmersiveToggle(root) {
    const actions = root.querySelector(".uai-c-v11-header-actions");
    if (!actions || actions.querySelector("#uaiV11ImmersiveToggle")) return;
    const button = document.createElement("button");
    button.id = "uaiV11ImmersiveToggle";
    button.type = "button";
    button.className = "uai-c-v11-immersive-toggle";
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `<i>◫</i><span>沉浸</span>`;
    button.addEventListener("click", () => setImmersive(root, !root.classList.contains("uai-c-v11-immersive")));
    actions.prepend(button);
    setImmersive(root, localStorage.getItem(IMMERSIVE_KEY) === "1");
  }

  function decorateRelationship() {
    const modal = document.querySelector("#uaiCompanionV5Mask .uai-c-v5-modal.profile");
    if (!modal) return;
    modal.classList.add("uai-c-v11-relationship-page");
    const value = stats();
    const stage = relationshipStage(value);
    const currentProfile = profile();
    const heroEyebrow = modal.querySelector(".uai-c-v5-hero-copy>span");
    const heroDesc = modal.querySelector(".uai-c-v5-hero-copy>p");
    if (heroEyebrow) heroEyebrow.textContent = "OUR STORY";
    if (heroDesc) heroDesc.textContent = `${relationLabel(currentProfile.relationship)} · ${stage.label} · 第 ${value.days} 天`;

    let overview = modal.querySelector(".uai-c-v11-rel-overview");
    if (!overview) {
      overview = document.createElement("section");
      overview.className = "uai-c-v11-rel-overview";
      overview.innerHTML = `
        <div class="uai-c-v11-rel-day"><span>我们认识的</span><strong></strong><small>每一次聊天都会留在这条时间线上。</small></div>
        <div class="uai-c-v11-rel-progress"><div><span>关系状态</span><strong></strong></div><div class="uai-c-v11-rel-track"><i></i></div><p></p></div>`;
      modal.querySelector(".uai-c-v5-profile-stats")?.insertAdjacentElement("afterend", overview);
    }
    overview.querySelector(".uai-c-v11-rel-day strong").textContent = `第 ${value.days} 天`;
    overview.querySelector(".uai-c-v11-rel-progress strong").textContent = stage.label;
    overview.querySelector(".uai-c-v11-rel-progress p").textContent = stage.note;
    overview.querySelector(".uai-c-v11-rel-track i").style.width = `${stage.progress}%`;

    const headings = modal.querySelectorAll(".uai-c-v5-section-title");
    headings.forEach((heading) => {
      const small = heading.querySelector("span");
      const title = heading.querySelector("h4");
      if (title?.textContent?.includes("关系时间线")) {
        if (small) small.textContent = "TOGETHER";
        title.textContent = "我们的时间线";
      } else if (title?.textContent?.includes("重要时刻")) {
        if (small) small.textContent = "MEMORIES";
        title.textContent = "我们的回忆";
      }
    });
  }

  function decorateMoments() {
    const modal = document.querySelector("#uaiCompanionV4Mask .uai-c-v4-modal:has(.uai-c-v4-moment-list)");
    if (!modal) return;
    modal.classList.add("uai-c-v11-moments-page");
    const list = modal.querySelector(".uai-c-v4-moment-list");
    const items = moments().sort((a, b) => Number(b.savedAt || b.createdAt || 0) - Number(a.savedAt || a.createdAt || 0));
    const map = new Map(items.map((item) => [String(item.id), item]));
    const currentProfile = profile();

    let hero = modal.querySelector(":scope > .uai-c-v11-moments-hero");
    if (!hero) {
      hero = document.createElement("section");
      hero.className = "uai-c-v11-moments-hero";
      hero.innerHTML = `<div class="uai-c-v11-moments-avatar"></div><div><span>OUR MOMENTS</span><h4></h4><p></p></div><b></b>`;
      modal.querySelector(":scope > header")?.insertAdjacentElement("afterend", hero);
    }
    fillAvatar(hero.querySelector(".uai-c-v11-moments-avatar"), currentProfile);
    hero.querySelector("h4").textContent = `你和${currentProfile.name || "TA"}的回忆`;
    hero.querySelector("p").textContent = items.length ? "被珍藏的片段会按时间慢慢组成属于你们的回忆册。" : "还没有被珍藏的片段，从一次值得记住的聊天开始吧。";
    hero.querySelector("b").textContent = `${items.length} 个`;

    if (list && list.dataset.v11Grouped !== "1") {
      list.dataset.v11Grouped = "1";
      let lastMonth = "";
      [...list.querySelectorAll(".uai-c-v4-moment")].forEach((card) => {
        const item = map.get(String(card.dataset.momentId || ""));
        if (!item) return;
        const month = monthLabel(item.savedAt || item.createdAt);
        if (month !== lastMonth) {
          const heading = document.createElement("div");
          heading.className = "uai-c-v11-moment-month";
          heading.textContent = month;
          card.insertAdjacentElement("beforebegin", heading);
          lastMonth = month;
        }
        const role = card.querySelector(":scope > span");
        if (role && item.role !== "user") role.textContent = currentProfile.name || "TA";
        if (!card.querySelector(":scope > time")) {
          const time = document.createElement("time");
          time.textContent = dateLabel(item.savedAt || item.createdAt);
          card.insertBefore(time, card.querySelector("p"));
        }
      });
    }
  }

  function decorateMonthlyReview() {
    const modal = document.querySelector("#uaiV8ReviewMask .uai-c-v8-review-modal");
    if (!modal) return;
    modal.classList.add("uai-c-v11-monthly-review");
    const currentProfile = profile();
    const value = stats();
    let banner = modal.querySelector(":scope > .uai-c-v11-review-banner");
    if (!banner) {
      banner = document.createElement("section");
      banner.className = "uai-c-v11-review-banner";
      banner.innerHTML = `<div class="uai-c-v11-review-avatar"></div><div><span>THIS MONTH</span><strong></strong><p></p></div>`;
      modal.querySelector(":scope > header")?.insertAdjacentElement("afterend", banner);
    }
    fillAvatar(banner.querySelector(".uai-c-v11-review-avatar"), currentProfile);
    banner.querySelector("strong").textContent = `这个月，${currentProfile.name || "TA"}一直在这里`;
    banner.querySelector("p").textContent = value.messages
      ? `到现在一共留下了 ${value.messages} 条聊天消息和 ${value.moments} 个重要时刻。`
      : "这个月的故事还没有真正开始。";
    const topicTitle = modal.querySelector(".uai-c-v8-review-topics>span");
    if (topicTitle) topicTitle.textContent = "这个月聊过";
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root || root.hidden) return;
    root.dataset.v11Stage3 = REVISION;
    applyTheme(root);
    ensureDrawerTheme(root);
    ensureSettingsTheme(root);
    ensureImmersiveToggle(root);
    decorateRelationship();
    decorateMoments();
    decorateMonthlyReview();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionV11Stage3Revision = REVISION;
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const root = document.getElementById("uaiCompanionRoot");
      if (root?.classList.contains("uai-c-v11-immersive")) setImmersive(root, false);
    }, true);
    window.addEventListener("storage", schedule);
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode"]
    });
    window.UnlimitedCompanionV11Stage3 = { revision: REVISION, refresh: schedule, applyTheme: schedule };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();