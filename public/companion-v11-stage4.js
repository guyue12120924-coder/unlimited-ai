// Companion V11.6 — final UI hardening, explicit theme backgrounds, and dialog reliability fixes.
(() => {
  const REVISION = "2026-08-14-v11.6-stage4-1";
  const THEME_KEY = "uai_companion_theme_map_v1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  const IMMERSIVE_KEY = "uai_companion_immersive_v1";
  let scheduled = false;

  const THEMES = {
    lavender: { label:"薰衣草", icon:"✦", a:"#8b5cf6", b:"#ec4899", main:"#faf7ff", main2:"#f7f8ff", side:"#fbf8ff", head:"#fefcff", composer:"#fbf9ff", drawer:"#fbf8ff", glow1:"rgba(139,92,246,.16)", glow2:"rgba(236,72,153,.10)" },
    sakura:   { label:"樱花", icon:"♡", a:"#e8669a", b:"#b76fe8", main:"#fff7fb", main2:"#fbf7ff", side:"#fff8fc", head:"#fffafd", composer:"#fff9fc", drawer:"#fff8fc", glow1:"rgba(232,102,154,.17)", glow2:"rgba(183,111,232,.10)" },
    ocean:    { label:"海盐", icon:"◌", a:"#5b7cfa", b:"#52bfd2", main:"#f5f8ff", main2:"#f4fbff", side:"#f7f9ff", head:"#fbfdff", composer:"#f8fbff", drawer:"#f5f9ff", glow1:"rgba(91,124,250,.16)", glow2:"rgba(82,191,210,.11)" },
    mint:     { label:"薄荷", icon:"◇", a:"#42a287", b:"#6e8ce4", main:"#f4fbf8", main2:"#f6f9ff", side:"#f6fbf9", head:"#fbfefd", composer:"#f7fcfa", drawer:"#f5fbf9", glow1:"rgba(66,162,135,.16)", glow2:"rgba(110,140,228,.10)" },
    dusk:     { label:"暮色", icon:"☾", a:"#6d62d8", b:"#bd5e91", main:"#f7f6ff", main2:"#fbf5fa", side:"#f8f6fc", head:"#fcfaff", composer:"#faf8fc", drawer:"#f8f6fc", glow1:"rgba(109,98,216,.17)", glow2:"rgba(189,94,145,.11)" }
  };

  function safeParse(value, fallback) { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } }
  function state() { return window.UnlimitedCompanion?.getState?.() || {}; }
  function activeId() { return localStorage.getItem(ACTIVE_KEY) || "legacy"; }
  function currentThemeKey() {
    const map = safeParse(localStorage.getItem(THEME_KEY), {});
    const key = map && typeof map === "object" ? map[activeId()] : "lavender";
    return THEMES[key] ? key : "lavender";
  }
  function saveTheme(key) {
    if (!THEMES[key]) return;
    const map = safeParse(localStorage.getItem(THEME_KEY), {});
    const next = map && typeof map === "object" && !Array.isArray(map) ? map : {};
    next[activeId()] = key;
    localStorage.setItem(THEME_KEY, JSON.stringify(next));
  }

  function applyTheme() {
    const root = document.getElementById("uaiCompanionRoot");
    if (!root) return;
    const key = currentThemeKey();
    const theme = THEMES[key];
    const values = {
      "--v11-a": theme.a,
      "--v11-b": theme.b,
      "--v116-a": theme.a,
      "--v116-b": theme.b,
      "--v116-main": theme.main,
      "--v116-main2": theme.main2,
      "--v116-side": theme.side,
      "--v116-head": theme.head,
      "--v116-composer": theme.composer,
      "--v116-drawer": theme.drawer,
      "--v116-glow1": theme.glow1,
      "--v116-glow2": theme.glow2
    };
    Object.entries(values).forEach(([name, value]) => {
      root.style.setProperty(name, value);
      document.documentElement.style.setProperty(name, value);
    });
    root.dataset.v11Theme = key;
    document.documentElement.dataset.companionTheme = key;
    document.querySelectorAll("[data-v11-theme-choice]").forEach((button) => button.classList.toggle("active", button.dataset.v11ThemeChoice === key));
  }

  function themeButtons() {
    return Object.entries(THEMES).map(([key, item]) => `<button type="button" class="uai-c-v11-theme-choice" data-v11-theme-choice="${key}" style="--theme-a:${item.a};--theme-b:${item.b}"><i>${item.icon}</i><span>${item.label}</span></button>`).join("");
  }

  function ensureThemePickers() {
    const root = document.getElementById("uaiCompanionRoot");
    if (!root) return;
    const drawer = root.querySelector(".uai-c-v11-drawer");
    if (drawer && !drawer.querySelector(".uai-c-v11-drawer-theme")) {
      const picker = document.createElement("section");
      picker.className = "uai-c-v11-drawer-section uai-c-v11-drawer-theme";
      picker.innerHTML = `<span class="uai-c-v11-drawer-label">陪伴主题</span><div class="uai-c-v11-theme-grid">${themeButtons()}</div>`;
      drawer.querySelector(".uai-c-v11-drawer-foot")?.insertAdjacentElement("beforebegin", picker) || drawer.appendChild(picker);
    }
    const settingsBody = document.querySelector("#uaiCompanionModalMask:not([hidden]) .uai-c-v10-settings .uai-c-modal-body");
    if (settingsBody && !settingsBody.querySelector(":scope > .uai-c-v11-theme-card")) {
      const card = document.createElement("section");
      card.className = "uai-c-v11-theme-card";
      card.innerHTML = `<div><strong>聊天主题</strong><span>当前角色单独保存；背景、气泡、按钮和光晕会一起变化。</span></div><div class="uai-c-v11-theme-grid">${themeButtons()}</div>`;
      settingsBody.prepend(card);
    }
  }

  function companionStats() {
    const current = state();
    const sessions = Array.isArray(current.sessions) ? current.sessions : [];
    const messages = sessions.reduce((sum, session) => sum + (Array.isArray(session?.messages) ? session.messages.length : 0), 0);
    const createdAt = Number(current.profile?.createdAt || 0) || Date.now();
    const days = Math.max(1, Math.floor((Date.now() - createdAt) / 86400000) + 1);
    return { sessions: sessions.length, messages, days };
  }
  function relationshipStage(value) {
    if (value.days >= 7 && value.messages >= 180 && value.sessions >= 8) return { label:"很有默契", progress:92, note:"你们已经形成稳定而持续的互动。" };
    if (value.days >= 3 && value.messages >= 70 && value.sessions >= 4) return { label:"渐渐亲近", progress:68, note:"熟悉的话题和共同记忆正在慢慢变多。" };
    if (value.messages >= 20 || value.sessions >= 2) return { label:"越来越熟", progress:43, note:"这已经不只是第一次聊天了。" };
    return { label:"刚刚认识", progress:18, note:"从今天开始，这里会一点点留下你们的故事。" };
  }
  function relationLabel(value) {
    return ({ girlfriend:"女朋友", boyfriend:"男朋友", friend:"好朋友", confidant:"知心伙伴", custom:"自定义关系" })[value] || "陪伴伙伴";
  }

  function fixRelationshipPage() {
    const modal = document.querySelector("#uaiCompanionV5Mask .uai-c-v5-modal.profile");
    if (!modal) return;
    modal.classList.add("uai-c-v11-relationship-page", "uai-c-v116-relationship-fixed");
    const hero = modal.querySelector(".uai-c-v5-profile-hero");
    if (hero) {
      let actions = hero.querySelector(":scope > .uai-c-v116-rel-actions");
      if (!actions) {
        actions = document.createElement("div");
        actions.className = "uai-c-v116-rel-actions";
        [...hero.children].filter((node) => node.tagName === "BUTTON").forEach((button) => actions.appendChild(button));
        hero.appendChild(actions);
      }
    }

    const value = companionStats();
    const stage = relationshipStage(value);
    const profile = state().profile || {};
    const eyebrow = modal.querySelector(".uai-c-v5-hero-copy>span");
    const desc = modal.querySelector(".uai-c-v5-hero-copy>p");
    if (eyebrow) eyebrow.textContent = "OUR STORY";
    if (desc) desc.textContent = `${relationLabel(profile.relationship)} · ${stage.label} · 第 ${value.days} 天`;

    let overview = modal.querySelector(".uai-c-v11-rel-overview");
    if (!overview) {
      overview = document.createElement("section");
      overview.className = "uai-c-v11-rel-overview";
      overview.innerHTML = `<div class="uai-c-v11-rel-day"><span>我们认识的</span><strong>第 ${value.days} 天</strong><small>每一次聊天都会留在这条时间线上。</small></div><div class="uai-c-v11-rel-progress"><div><span>关系状态</span><strong>${stage.label}</strong></div><div class="uai-c-v11-rel-track"><i style="width:${stage.progress}%"></i></div><p>${stage.note}</p></div>`;
      modal.querySelector(".uai-c-v5-profile-stats")?.insertAdjacentElement("afterend", overview);
    } else {
      const day = overview.querySelector(".uai-c-v11-rel-day strong");
      const label = overview.querySelector(".uai-c-v11-rel-progress strong");
      const note = overview.querySelector(".uai-c-v11-rel-progress p");
      const bar = overview.querySelector(".uai-c-v11-rel-track i");
      if (day) day.textContent = `第 ${value.days} 天`;
      if (label) label.textContent = stage.label;
      if (note) note.textContent = stage.note;
      if (bar) bar.style.width = `${stage.progress}%`;
    }

    modal.querySelectorAll(".uai-c-v5-section-title").forEach((heading) => {
      const title = heading.querySelector("h4");
      const small = heading.querySelector("span");
      if (title?.textContent?.includes("关系时间线") || title?.textContent?.includes("我们的时间线")) {
        title.textContent = "我们的时间线";
        if (small) small.textContent = "TOGETHER";
      } else if (title?.textContent?.includes("重要时刻") || title?.textContent?.includes("我们的回忆")) {
        title.textContent = "我们的回忆";
        if (small) small.textContent = "MEMORIES";
      }
    });
  }

  function fixSecondaryPages() {
    const moments = document.querySelector("#uaiCompanionV4Mask .uai-c-v4-modal:has(.uai-c-v4-moment-list)");
    if (moments) moments.classList.add("uai-c-v11-moments-page", "uai-c-v116-dialog-fixed");
    const memory = document.querySelector("#uaiCompanionV4Mask .uai-c-v4-modal:has(.uai-c-v4-memory-list)");
    if (memory) memory.classList.add("uai-c-v116-dialog-fixed");
    const review = document.querySelector("#uaiV8ReviewMask .uai-c-v8-review-modal");
    if (review) review.classList.add("uai-c-v11-monthly-review", "uai-c-v116-dialog-fixed");
    document.querySelectorAll("#uaiV9RoleEditorMask .uai-c-v9-role-editor, #uaiCompanionV3Mask .uai-c-v3-modal").forEach((dialog) => dialog.classList.add("uai-c-v116-dialog-fixed"));
  }

  function setImmersive(root, enabled) {
    root?.classList.toggle("uai-c-v11-immersive", enabled);
    localStorage.setItem(IMMERSIVE_KEY, enabled ? "1" : "0");
    const button = root?.querySelector("#uaiV11ImmersiveToggle");
    if (button) {
      button.classList.toggle("active", enabled);
      const label = button.querySelector("span");
      if (label) label.textContent = enabled ? "退出沉浸" : "沉浸";
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
    }
  }
  function ensureImmersive(root) {
    const actions = root?.querySelector(".uai-c-v11-header-actions");
    if (!actions) return;
    let button = actions.querySelector("#uaiV11ImmersiveToggle");
    if (!button) {
      button = document.createElement("button");
      button.id = "uaiV11ImmersiveToggle";
      button.type = "button";
      button.className = "uai-c-v11-immersive-toggle";
      button.innerHTML = `<i>◫</i><span>沉浸</span>`;
      button.addEventListener("click", () => setImmersive(root, !root.classList.contains("uai-c-v11-immersive")));
      actions.prepend(button);
    }
    setImmersive(root, localStorage.getItem(IMMERSIVE_KEY) === "1");
  }

  function finalAccessibilityPass() {
    document.querySelectorAll("#uaiCompanionRoot button, #uaiCompanionV4Mask button, #uaiCompanionV5Mask button, #uaiV8ReviewMask button, #uaiV9RoleEditorMask button, #uaiCompanionV3Mask button").forEach((button) => {
      if (!button.hasAttribute("type")) button.type = "button";
    });
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root || root.hidden) return;
    root.dataset.v11Stage4 = REVISION;
    applyTheme();
    ensureThemePickers();
    ensureImmersive(root);
    fixRelationshipPage();
    fixSecondaryPages();
    finalAccessibilityPass();
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionV11Stage4Revision = REVISION;
    document.addEventListener("click", (event) => {
      const theme = event.target.closest("[data-v11-theme-choice]");
      if (theme) {
        saveTheme(theme.dataset.v11ThemeChoice);
        requestAnimationFrame(() => { applyTheme(); schedule(); });
      }
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const root = document.getElementById("uaiCompanionRoot");
      if (root?.classList.contains("uai-c-v11-immersive")) setImmersive(root, false);
    }, true);
    window.addEventListener("storage", schedule);
    window.addEventListener("resize", schedule, { passive:true });
    new MutationObserver(schedule).observe(document.body, { subtree:true, childList:true, attributes:true, attributeFilter:["hidden", "data-uai-mode"] });
    window.UnlimitedCompanionV11Stage4 = { revision:REVISION, refresh:schedule, applyTheme };
    schedule();
    setTimeout(schedule, 250);
    setTimeout(schedule, 900);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else init();
})();