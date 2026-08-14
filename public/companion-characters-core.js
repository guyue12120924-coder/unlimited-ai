// public/companion-v3.js
// Multi-character core: isolated role snapshots, switching, message retry and memory extraction.
(() => {
  const REVISION = "2026-08-14-v8.1-multichar-core-1";
  const KEYS = {
    characters: "uai_companion_characters_v1",
    activeCharacter: "uai_companion_active_character_v1",
    profile: "uai_companion_profile_v1",
    sessions: "uai_companion_sessions_v1",
    memories: "uai_companion_memories_v1",
    settings: "uai_companion_settings_v1"
  };
  const MAX_CHARACTERS = 6;
  const RELATIONS = [
    ["girlfriend", "💗 女朋友"],
    ["boyfriend", "💙 男朋友"],
    ["friend", "🌙 好朋友"],
    ["confidant", "✨ 知心伙伴"],
    ["custom", "🪄 自定义关系"]
  ];

  let syncTimer = null;
  let scheduled = false;
  let switching = false;
  let lastExtractSignature = "";
  let lastExtractAt = 0;

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function readJson(key, fallback) { return safeParse(localStorage.getItem(key), fallback); }
  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function makeId(prefix) {
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${token}`;
  }
  function cleanText(value, max = 180) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getCharacters() {
    const raw = readJson(KEYS.characters, []);
    if (!Array.isArray(raw)) return [];
    return raw.filter((item) => item && typeof item.id === "string" && item.profile && typeof item.profile === "object");
  }

  function saveCharacters(characters) { writeJson(KEYS.characters, characters.slice(0, MAX_CHARACTERS)); }
  function getActiveId() { return localStorage.getItem(KEYS.activeCharacter) || ""; }
  function setActiveId(id) { localStorage.setItem(KEYS.activeCharacter, id); }

  function slotSnapshot(id = getActiveId()) {
    const profile = readJson(KEYS.profile, null);
    if (!profile || typeof profile !== "object") return null;
    return {
      id: id || makeId("companion-character"),
      profile,
      sessions: Array.isArray(readJson(KEYS.sessions, [])) ? readJson(KEYS.sessions, []) : [],
      memories: Array.isArray(readJson(KEYS.memories, [])) ? readJson(KEYS.memories, []) : [],
      settings: readJson(KEYS.settings, {}) || {},
      updatedAt: Date.now()
    };
  }

  function ensureRepository() {
    let characters = getCharacters();
    let activeId = getActiveId();
    const slot = slotSnapshot(activeId);

    if (!characters.length && slot) {
      if (!activeId) activeId = slot.id;
      slot.id = activeId;
      characters = [slot];
      saveCharacters(characters);
      setActiveId(activeId);
      return characters;
    }

    if (characters.length && !characters.some((item) => item.id === activeId)) {
      activeId = characters[0].id;
      setActiveId(activeId);
      loadCharacterIntoSlots(characters[0], false);
    }
    return characters;
  }

  function persistActiveCharacter() {
    if (switching) return;
    const profile = readJson(KEYS.profile, null);
    if (!profile || typeof profile !== "object") return;

    let characters = getCharacters();
    let activeId = getActiveId();
    if (!activeId) {
      activeId = makeId("companion-character");
      setActiveId(activeId);
    }

    const snapshot = slotSnapshot(activeId);
    if (!snapshot) return;
    const index = characters.findIndex((item) => item.id === activeId);
    if (index >= 0) {
      snapshot.createdAt = characters[index].createdAt || Number(snapshot.profile?.createdAt) || Date.now();
      characters[index] = { ...characters[index], ...snapshot };
    } else if (characters.length < MAX_CHARACTERS) {
      snapshot.createdAt = Number(snapshot.profile?.createdAt) || Date.now();
      characters.push(snapshot);
    }
    saveCharacters(characters);
  }

  function schedulePersist() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(persistActiveCharacter, 500);
  }

  function loadCharacterIntoSlots(character, remount = true) {
    if (!character) return;
    switching = true;
    try {
      writeJson(KEYS.profile, character.profile || {});
      writeJson(KEYS.sessions, Array.isArray(character.sessions) ? character.sessions : []);
      writeJson(KEYS.memories, Array.isArray(character.memories) ? character.memories : []);
      writeJson(KEYS.settings, character.settings || {});
      setActiveId(character.id);
    } finally {
      switching = false;
    }

    if (remount && window.UnlimitedCompanion?.mount) {
      window.UnlimitedCompanion.unmount?.();
      window.setTimeout(() => {
        window.UnlimitedCompanion.mount();
        window.UnlimitedCompanionV8Secondary?.refresh?.();
        scheduleEnhance();
      }, 20);
    }
  }

  function switchCharacter(id) {
    if (!id || id === getActiveId()) return;
    persistActiveCharacter();
    const character = getCharacters().find((item) => item.id === id);
    if (!character) return;
    closeModal();
    loadCharacterIntoSlots(character, true);
  }

  function relationLabel(value) { return RELATIONS.find(([key]) => key === value)?.[1] || "✨ 陪伴伙伴"; }

  function avatarMarkup(profile) {
    if (profile?.avatarData) {
      return `<span class="uai-c-v3-avatar"><img src="${escapeHtml(profile.avatarData)}" alt="${escapeHtml(profile.name || "角色")}头像" /></span>`;
    }
    const icon = profile?.relationship === "boyfriend" ? "💙" : profile?.relationship === "friend" ? "🌙" : "💗";
    return `<span class="uai-c-v3-avatar">${icon}</span>`;
  }

  function characterStats(character) {
    const sessions = Array.isArray(character?.sessions) ? character.sessions : [];
    const messages = sessions.reduce((sum, session) => sum + (Array.isArray(session?.messages) ? session.messages.length : 0), 0);
    return { sessions: sessions.length, messages, memories: Array.isArray(character?.memories) ? character.memories.length : 0 };
  }

  function closeModal() { document.getElementById("uaiCompanionV3Mask")?.remove(); }

  function openModal(html, bind) {
    closeModal();
    const mask = document.createElement("div");
    mask.id = "uaiCompanionV3Mask";
    mask.className = "uai-c-v3-mask";
    mask.innerHTML = html;
    document.body.appendChild(mask);
    mask.addEventListener("click", (event) => { if (event.target === mask) closeModal(); });
    mask.querySelector("[data-v3-close]")?.addEventListener("click", closeModal);
    bind?.(mask);
  }

  function showCharacterManager() {
    persistActiveCharacter();
    const characters = getCharacters();
    const activeId = getActiveId();
    openModal(`
      <section class="uai-c-v3-modal" role="dialog" aria-modal="true" aria-label="AI 伙伴">
        <header><div><span>COMPANIONS</span><h3>我的 AI 伙伴</h3><p>每个角色拥有独立聊天、长期记忆和模型设置。</p></div><button type="button" data-v3-close>×</button></header>
        <div class="uai-c-v3-character-list">
          ${characters.map((character) => {
            const stats = characterStats(character);
            const active = character.id === activeId;
            return `<article class="uai-c-v3-character-card${active ? " active" : ""}" data-character-id="${escapeHtml(character.id)}">
              ${avatarMarkup(character.profile)}
              <div><strong>${escapeHtml(character.profile?.name || "未命名")}</strong><span>${escapeHtml(relationLabel(character.profile?.relationship))}</span><small>${stats.sessions} 个会话 · ${stats.memories} 条记忆</small></div>
              <div class="uai-c-v3-character-actions">${active ? `<em>当前</em>` : `<button type="button" data-switch-character>切换</button>`}<button type="button" data-delete-character${characters.length <= 1 ? " disabled" : ""}>删除</button></div>
            </article>`;
          }).join("")}
        </div>
        <footer><span>最多 ${MAX_CHARACTERS} 个角色</span><button type="button" id="uaiCompanionAddCharacter"${characters.length >= MAX_CHARACTERS ? " disabled" : ""}>＋ 新增角色</button></footer>
      </section>`, (mask) => {
        mask.querySelectorAll("[data-switch-character]").forEach((button) => {
          button.addEventListener("click", () => switchCharacter(button.closest("[data-character-id]")?.dataset.characterId));
        });
        mask.querySelectorAll("[data-delete-character]").forEach((button) => {
          button.addEventListener("click", () => deleteCharacter(button.closest("[data-character-id]")?.dataset.characterId));
        });
      });
    window.UnlimitedCompanionV8Secondary?.refresh?.();
  }

  function deleteCharacter(id) {
    let characters = getCharacters();
    if (characters.length <= 1) return;
    const target = characters.find((item) => item.id === id);
    if (!target) return;
    if (!confirm(`删除 AI 伙伴「${target.profile?.name || "未命名"}」？这个角色的聊天和长期记忆都会一起删除。`)) return;
    const wasActive = id === getActiveId();
    characters = characters.filter((item) => item.id !== id);
    saveCharacters(characters);
    if (wasActive) loadCharacterIntoSlots(characters[0], true);
    else showCharacterManager();
  }

  function getCurrentSessionState() {
    const state = window.UnlimitedCompanion?.getState?.();
    const sessions = Array.isArray(state?.sessions) ? state.sessions : [];
    const session = sessions.find((item) => item.id === state?.currentSessionId) || sessions[0] || null;
    return { sessions, session };
  }

  function saveSessionsAndRefresh(sessions) {
    writeJson(KEYS.sessions, sessions);
    persistActiveCharacter();
    window.UnlimitedCompanion?.unmount?.();
    window.setTimeout(() => {
      window.UnlimitedCompanion?.mount?.();
      window.UnlimitedCompanionV8Secondary?.refresh?.();
      scheduleEnhance();
    }, 20);
  }

  function editAndResend(messageIndex) {
    const { sessions, session } = getCurrentSessionState();
    if (!session || !Array.isArray(session.messages)) return;
    const message = session.messages[messageIndex];
    if (message?.role !== "user") return;
    const edited = window.prompt("编辑这条消息并重新发送：", message.content || "");
    if (!edited?.trim()) return;
    const target = sessions.find((item) => item.id === session.id);
    if (!target) return;
    target.messages = target.messages.slice(0, messageIndex);
    target.updatedAt = Date.now();
    target.title = target.messages.some((item) => item.role === "user") ? target.title : "新的聊天";
    saveSessionsAndRefresh(sessions);
    window.setTimeout(() => {
      const root = document.getElementById("uaiCompanionRoot");
      const input = root?.querySelector("#uaiCompanionInput");
      if (!input) return;
      input.value = edited.trim();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      root.querySelector("#uaiCompanionSend")?.click();
    }, 80);
  }

  function regenerateAssistant(messageIndex) {
    const { sessions, session } = getCurrentSessionState();
    if (!session || !Array.isArray(session.messages)) return;
    if (messageIndex !== session.messages.length - 1 || session.messages[messageIndex]?.role !== "assistant") return;
    let userIndex = messageIndex - 1;
    while (userIndex >= 0 && session.messages[userIndex]?.role !== "user") userIndex -= 1;
    if (userIndex < 0) return;
    const text = session.messages[userIndex].content || "";
    const target = sessions.find((item) => item.id === session.id);
    if (!target) return;
    target.messages = target.messages.slice(0, userIndex);
    target.updatedAt = Date.now();
    saveSessionsAndRefresh(sessions);
    window.setTimeout(() => {
      const root = document.getElementById("uaiCompanionRoot");
      const input = root?.querySelector("#uaiCompanionInput");
      if (!input) return;
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      root.querySelector("#uaiCompanionSend")?.click();
    }, 80);
  }

  function ensureV3MessageActions(root) {
    const { session } = getCurrentSessionState();
    if (!session || !Array.isArray(session.messages)) return;
    const rows = Array.from(root.querySelectorAll("#uaiCompanionMessages .uai-c-message-row"));
    rows.forEach((row, index) => {
      if (row.querySelector(".uai-c-v3-actions")) return;
      const bubble = row.querySelector(".uai-c-bubble");
      if (!bubble || bubble.querySelector(".uai-c-typing")) return;
      const message = session.messages[index];
      if (!message) return;
      const group = document.createElement("span");
      group.className = "uai-c-v3-actions";
      if (message.role === "user") {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.textContent = "编辑重发";
        edit.addEventListener("click", () => editAndResend(index));
        group.appendChild(edit);
      }
      if (message.role === "assistant" && index === session.messages.length - 1) {
        const regenerate = document.createElement("button");
        regenerate.type = "button";
        regenerate.textContent = "重新生成";
        regenerate.addEventListener("click", () => regenerateAssistant(index));
        group.appendChild(regenerate);
      }
      if (group.childElementCount) bubble.parentElement?.appendChild(group);
    });
  }

  function upsertMemory(text, kind = "fact") {
    const normalized = cleanText(text, 180);
    if (!normalized) return false;
    let memories = readJson(KEYS.memories, []);
    if (!Array.isArray(memories)) memories = [];

    if (kind === "nickname") memories = memories.filter((item) => !String(item?.text || "").startsWith("用户希望被称为"));
    if (kind === "birthday") memories = memories.filter((item) => !String(item?.text || "").startsWith("用户的生日是"));
    if (kind === "like") {
      const object = normalized.replace(/^用户喜欢/, "");
      memories = memories.filter((item) => String(item?.text || "") !== `用户不喜欢${object}`);
    }
    if (kind === "dislike") {
      const object = normalized.replace(/^用户不喜欢/, "");
      memories = memories.filter((item) => String(item?.text || "") !== `用户喜欢${object}`);
    }

    if (memories.some((item) => String(item?.text || "").trim().toLowerCase() === normalized.toLowerCase())) return false;
    memories.push({ id: makeId("memory"), text: normalized, source: "auto-v8", kind, createdAt: Date.now() });
    writeJson(KEYS.memories, memories.slice(-100));
    schedulePersist();
    return true;
  }

  function extractStructuredMemories(text) {
    const source = cleanText(text, 500);
    if (!source) return;
    const signature = source.toLowerCase();
    if (signature === lastExtractSignature && Date.now() - lastExtractAt < 1200) return;
    lastExtractSignature = signature;
    lastExtractAt = Date.now();

    const rules = [
      { re: /(?:以后|之后)(?:就)?叫我\s*([^，。！？!?,\n]{1,20})/, kind: "nickname", build: (m) => `用户希望被称为${m[1].trim()}` },
      { re: /(?:你可以|你就)叫我\s*([^，。！？!?,\n]{1,20})/, kind: "nickname", build: (m) => `用户希望被称为${m[1].trim()}` },
      { re: /我的生日(?:是|在)\s*([^。！？!?\n]{1,30})/, kind: "birthday", build: (m) => `用户的生日是${m[1].trim()}` },
      { re: /我最近(?:正在|在)\s*([^。！？!?\n]{2,70})/, kind: "current", build: (m) => `用户最近正在${m[1].trim()}` },
      { re: /我打算\s*([^。！？!?\n]{2,70})/, kind: "plan", build: (m) => `用户打算${m[1].trim()}` },
      { re: /我(?:更|最)?喜欢\s*([^。！？!?\n]{1,50})/, kind: "like", build: (m) => `用户喜欢${m[1].trim()}` },
      { re: /我(?:真的)?不喜欢\s*([^。！？!?\n]{1,50})/, kind: "dislike", build: (m) => `用户不喜欢${m[1].trim()}` },
      { re: /我(?:不能吃|不吃)\s*([^。！？!?\n]{1,50})/, kind: "constraint", build: (m) => `用户不吃${m[1].trim()}` },
      { re: /我对\s*([^。！？!?\n]{1,40})\s*过敏/, kind: "constraint", build: (m) => `用户对${m[1].trim()}过敏` },
      { re: /(?:请|帮我)?记住[：,:，]?\s*([^。！？!?\n]{2,100})/, kind: "explicit", build: (m) => `用户希望记住：${m[1].trim()}` }
    ];

    let added = 0;
    for (const rule of rules) {
      const match = source.match(rule.re);
      if (match && upsertMemory(rule.build(match), rule.kind)) added += 1;
      if (added >= 3) break;
    }
  }

  function interceptOutgoing(event) {
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root) return;
    if (event.type === "click" && event.target?.closest?.("#uaiCompanionSend")) {
      extractStructuredMemories(root.querySelector("#uaiCompanionInput")?.value || "");
    }
    if (event.type === "keydown" && event.key === "Enter" && !event.shiftKey && event.target?.id === "uaiCompanionInput") {
      extractStructuredMemories(event.target.value || "");
    }
  }

  function timeGreeting(profile, history = []) {
    const hour = new Date().getHours();
    const prefix = hour < 6 ? "这么晚还没睡呀。" : hour < 11 ? "早呀～" : hour < 14 ? "中午好呀。" : hour < 18 ? "下午好呀。" : hour < 23 ? "晚上好呀。" : "这么晚才来呀～";
    const latest = [...history]
      .filter((session) => session?.title && session.title !== "新的聊天")
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
    if (latest?.title) return `${prefix}上次我们聊到「${cleanText(latest.title, 24)}」，我还记得。今天慢慢聊就好。`;
    return `${prefix}我是${profile?.name || "你的 AI 伙伴"}。不用想好聊什么，想到哪儿说到哪儿就行。`;
  }

  function enhanceNewChatGreeting() {
    const state = window.UnlimitedCompanion?.getState?.();
    const sessions = Array.isArray(state?.sessions) ? state.sessions : [];
    const current = sessions.find((item) => item.id === state?.currentSessionId);
    if (!current || current.v3GreetingEnhanced || !Array.isArray(current.messages) || current.messages.length !== 1) return;
    if (Date.now() - Number(current.createdAt || 0) > 4000) return;
    const history = sessions.filter((item) => item.id !== current.id);
    current.messages[0].content = timeGreeting(state.profile, history);
    current.v3GreetingEnhanced = true;
    writeJson(KEYS.sessions, sessions);
    persistActiveCharacter();
    const bubble = document.querySelector("#uaiCompanionMessages .uai-c-message-row.assistant .uai-c-bubble");
    if (bubble) bubble.textContent = current.messages[0].content;
  }

  function onGlobalClick(event) {
    if (document.body.dataset.uaiMode !== "companion") return;
    if (event.target?.closest?.("#uaiCompanionNewChat")) window.setTimeout(enhanceNewChatGreeting, 40);
  }

  function enhance() {
    scheduled = false;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root || document.body.dataset.uaiMode !== "companion") return;
    ensureRepository();
    ensureV3MessageActions(root);
    schedulePersist();
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionMultiRevision = REVISION;
    ensureRepository();
    document.addEventListener("click", interceptOutgoing, true);
    document.addEventListener("keydown", interceptOutgoing, true);
    document.addEventListener("click", onGlobalClick, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.getElementById("uaiCompanionV3Mask")) closeModal();
    });
    new MutationObserver(scheduleEnhance).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-uai-mode"]
    });
    scheduleEnhance();
  }

  window.UnlimitedCompanionMulti = {
    revision: REVISION,
    refresh: scheduleEnhance,
    persist: persistActiveCharacter,
    getCharacters,
    get activeCharacterId() { return getActiveId(); },
    switchCharacter,
    showCharacterManager
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
