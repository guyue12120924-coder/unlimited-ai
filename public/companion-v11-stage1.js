// Companion V11.1 — role presence, richer new-conversation landing, and character gallery.
(() => {
  const REVISION = "2026-08-14-v11.1-stage1-1";
  const CHARACTER_KEY = "uai_companion_characters_v1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  let scheduled = false;

  const RELATION_LABELS = {
    girlfriend: "女朋友",
    boyfriend: "男朋友",
    friend: "好朋友",
    confidant: "知心伙伴",
    custom: "陪伴伙伴"
  };

  function state() {
    return window.UnlimitedCompanion?.getState?.() || {};
  }

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function characters() {
    const list = safeParse(localStorage.getItem(CHARACTER_KEY), []);
    return Array.isArray(list) ? list : [];
  }

  function relationLabel(value) {
    return RELATION_LABELS[value] || "陪伴伙伴";
  }

  function avatarSymbol(profile) {
    if (profile?.relationship === "boyfriend") return "💙";
    if (profile?.relationship === "friend") return "🌙";
    if (profile?.relationship === "confidant") return "✨";
    return "💗";
  }

  function fillAvatar(host, profile) {
    if (!host) return;
    const src = String(profile?.avatarData || "");
    if (src) {
      const current = host.querySelector("img");
      if (current?.getAttribute("src") === src) return;
      host.innerHTML = "";
      const image = document.createElement("img");
      image.src = src;
      image.alt = `${profile?.name || "AI 伙伴"}头像`;
      host.appendChild(image);
      return;
    }
    const symbol = avatarSymbol(profile);
    if (host.textContent !== symbol || host.querySelector("img")) host.textContent = symbol;
  }

  function timeGreeting(name) {
    const hour = new Date().getHours();
    if (hour < 6) return `这么晚还没睡？${name}还在这里。`;
    if (hour < 11) return `早上好，${name}已经在等你了。`;
    if (hour < 14) return `中午好，来和${name}说几句话吧。`;
    if (hour < 18) return `下午好，${name}在这里陪你。`;
    if (hour < 23) return `晚上好，今天也和${name}聊聊吧。`;
    return `夜深了，${name}还在这里。`;
  }

  function profileSummary(profile) {
    const text = String(profile?.customDescription || "").replace(/\s+/g, " ").trim();
    if (!text) return "从一句简单的话开始，让这段陪伴慢慢变得熟悉。";
    const sentence = text.split(/[。！？!?]/).find(Boolean) || text;
    return sentence.slice(0, 92) + (sentence.length > 92 ? "…" : "");
  }

  function ensureWelcome(root) {
    const starters = root.querySelector(".uai-c-v10-starters");
    if (!starters) {
      root.classList.remove("uai-c-v11-welcome-mode");
      root.querySelector(".uai-c-v11-welcome-scene")?.remove();
      return;
    }

    root.classList.add("uai-c-v11-welcome-mode");
    const current = state();
    const profile = current.profile || {};
    const name = profile.name || "AI 伙伴";

    let scene = starters.querySelector(":scope > .uai-c-v11-welcome-scene");
    if (!scene) {
      scene = document.createElement("section");
      scene.className = "uai-c-v11-welcome-scene";
      scene.innerHTML = `
        <div class="uai-c-v11-welcome-orbit" aria-hidden="true"></div>
        <div class="uai-c-v11-welcome-avatar"></div>
        <div class="uai-c-v11-welcome-presence"><i></i><span>在线</span></div>
        <span class="uai-c-v11-welcome-kicker">NEW CONVERSATION</span>
        <h2 class="uai-c-v11-welcome-name"></h2>
        <p class="uai-c-v11-welcome-greeting"></p>
        <div class="uai-c-v11-welcome-relation"></div>
        <p class="uai-c-v11-welcome-summary"></p>`;
      starters.insertBefore(scene, starters.firstChild);
    }

    fillAvatar(scene.querySelector(".uai-c-v11-welcome-avatar"), profile);
    const title = scene.querySelector(".uai-c-v11-welcome-name");
    const greeting = scene.querySelector(".uai-c-v11-welcome-greeting");
    const relation = scene.querySelector(".uai-c-v11-welcome-relation");
    const summary = scene.querySelector(".uai-c-v11-welcome-summary");
    if (title) title.textContent = name;
    if (greeting) greeting.textContent = timeGreeting(name);
    if (relation) relation.textContent = relationLabel(profile.relationship);
    if (summary) summary.textContent = profileSummary(profile);

    starters.querySelector(":scope > .uai-c-v10-welcome-hero")?.setAttribute("hidden", "");
    const starterLabel = starters.querySelector(":scope > span");
    if (starterLabel) starterLabel.textContent = "想从哪句话开始？";
  }

  function cardSummary(character) {
    const text = String(character?.profile?.customDescription || "").replace(/\s+/g, " ").trim();
    if (!text) return "还没有补充完整角色设定。";
    const sentence = text.split(/[。！？!?]/).find(Boolean) || text;
    return sentence.slice(0, 66) + (sentence.length > 66 ? "…" : "");
  }

  function decorateCharacterManager() {
    const modal = document.querySelector("#uaiCompanionV3Mask .uai-c-v10-role-manager");
    if (!modal) return;
    modal.classList.add("uai-c-v11-role-gallery");

    const title = modal.querySelector("header h3");
    const desc = modal.querySelector("header p");
    if (title) title.textContent = "我的伙伴";
    if (desc) desc.textContent = "选择想见的人。每个角色的聊天、记忆和设置彼此独立。";

    const list = characters();
    const activeId = localStorage.getItem(ACTIVE_KEY) || "";
    modal.querySelectorAll(".uai-c-v3-character-card[data-character-id]").forEach((card, index) => {
      const id = card.dataset.characterId || "";
      const character = list.find((item) => item?.id === id) || null;
      const profile = character?.profile || {};
      card.style.setProperty("--v11-card-index", String(index));
      card.dataset.v11Relation = profile.relationship || "custom";
      card.classList.toggle("uai-c-v11-current-role", id === activeId || card.classList.contains("active"));

      let badge = card.querySelector(":scope > .uai-c-v11-role-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "uai-c-v11-role-badge";
        card.prepend(badge);
      }
      badge.textContent = id === activeId || card.classList.contains("active") ? "正在陪伴" : relationLabel(profile.relationship);

      let summary = card.querySelector(":scope > .uai-c-v11-role-summary");
      if (!summary) {
        summary = document.createElement("p");
        summary.className = "uai-c-v11-role-summary";
        const actions = card.querySelector(":scope > .uai-c-v3-character-actions");
        card.insertBefore(summary, actions || null);
      }
      summary.textContent = cardSummary(character);

      const info = card.querySelector(":scope > div:not(.uai-c-v3-character-actions)");
      const relation = info?.querySelector("span");
      if (relation && profile.relationship) relation.textContent = relationLabel(profile.relationship);
    });

    const add = modal.querySelector("#uaiCompanionAddCharacter");
    if (add) add.textContent = "＋ 创建新伙伴";
  }

  function decorateProfilePresence(root) {
    const card = root.querySelector("#uaiCompanionProfileCard .uai-c-profile-card");
    if (!card) return;
    card.classList.add("uai-c-v11-profile-presence");
    let dot = card.querySelector(":scope > .uai-c-v11-profile-online");
    if (!dot) {
      dot = document.createElement("span");
      dot.className = "uai-c-v11-profile-online";
      dot.setAttribute("aria-label", "在线");
      card.appendChild(dot);
    }
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (root && !root.hidden) {
      ensureWelcome(root);
      decorateProfilePresence(root);
    }
    decorateCharacterManager();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionV11Stage1Revision = REVISION;
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode"]
    });
    window.UnlimitedCompanionV11Stage1 = { revision: REVISION, refresh: schedule };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();