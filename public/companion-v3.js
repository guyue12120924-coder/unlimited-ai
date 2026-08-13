// public/companion-v3.js
// Multi-character compatibility layer for Companion mode.
// It keeps the proven single-character client intact by swapping isolated
// character snapshots into the existing active storage slots.
(() => {
  const REVISION = "2026-08-13-v4.2-companion-multichar-1";
  const KEYS = {
    characters: "uai_companion_characters_v1",
    activeCharacter: "uai_companion_active_character_v1",
    profile: "uai_companion_profile_v1",
    sessions: "uai_companion_sessions_v1",
    memories: "uai_companion_memories_v1",
    settings: "uai_companion_settings_v1"
  };
  const MAX_CHARACTERS = 6;
  const PERSONALITIES = ["温柔", "可爱", "傲娇", "成熟", "活泼", "安静", "毒舌", "黏人", "理性", "幽默"];
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
    try {
      const parsed = JSON.parse(value);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readJson(key, fallback) {
    return safeParse(localStorage.getItem(key), fallback);
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function makeId(prefix) {
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${token}`;
  }

  function cleanText(value, max = 180) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  }

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

  function saveCharacters(characters) {
    writeJson(KEYS.characters, characters.slice(0, MAX_CHARACTERS));
  }

  function getActiveId() {
    return localStorage.getItem(KEYS.activeCharacter) || "";
  }

  function setActiveId(id) {
    localStorage.setItem(KEYS.activeCharacter, id);
  }

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
    syncTimer = setTimeout(persistActiveCharacter, 700);
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
        window.UnlimitedCompanionPolish?.refresh?.();
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

  function relationLabel(value) {
    return RELATIONS.find(([key]) => key === value)?.[1] || "✨ 陪伴伙伴";
  }

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

  function ensureCharacterBar(root) {
    const card = root.querySelector("#uaiCompanionProfileCard");
    if (!card || !readJson(KEYS.profile, null)) return;
    let bar = root.querySelector("#uaiCompanionCharacterBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "uaiCompanionCharacterBar";
      bar.className = "uai-c-v3-character-bar";
      card.insertAdjacentElement("afterend", bar);
    }
    const characters = ensureRepository();
    const active = characters.find((item) => item.id === getActiveId()) || characters[0];
    if (!active) return;
    bar.innerHTML = `<button type="button" id="uaiCompanionSwitchCharacter"><span>角色</span><strong>${escapeHtml(active.profile?.name || "未命名")}</strong><b>${characters.length}/${MAX_CHARACTERS} ▾</b></button>`;
    bar.querySelector("#uaiCompanionSwitchCharacter")?.addEventListener("click", showCharacterManager);
  }

  function closeModal() {
    document.getElementById("uaiCompanionV3Mask")?.remove();
  }

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
        <footer><span>最多 ${MAX_CHARACTERS} 个角色</span><button type="button" id="uaiCompanionAddCharacter"${characters.length >= MAX_CHARACTERS ? " disabled" : ""}>＋ 新建伙伴</button></footer>
      </section>`, (mask) => {
        mask.querySelectorAll("[data-switch-character]").forEach((button) => {
          button.addEventListener("click", () => switchCharacter(button.closest("[data-character-id]")?.dataset.characterId));
        });
        mask.querySelectorAll("[data-delete-character]").forEach((button) => {
          button.addEventListener("click", () => deleteCharacter(button.closest("[data-character-id]")?.dataset.characterId));
        });
        mask.querySelector("#uaiCompanionAddCharacter")?.addEventListener("click", showCreateCharacter);
      });
  }

  function personalityMarkup(selected = []) {
    const set = new Set(selected);
    return PERSONALITIES.map((item) => `<button type="button" data-v3-personality="${escapeHtml(item)}" class="${set.has(item) ? "selected" : ""}">${escapeHtml(item)}</button>`).join("");
  }

  function relationOptions(selected = "girlfriend") {
    return RELATIONS.map(([key, label]) => `<option value="${key}"${key === selected ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
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

  function createInitialSession(profile, history = []) {
    const now = Date.now();
    return {
      id: makeId("companion-session"),
      title: "新的聊天",
      createdAt: now,
      updatedAt: now,
      v3GreetingEnhanced: true,
      messages: [{ role: "assistant", content: timeGreeting(profile, history), createdAt: now }]
    };
  }

  function showCreateCharacter() {
    openModal(`
      <section class="uai-c-v3-modal compact" role="dialog" aria-modal="true" aria-label="新建 AI 伙伴">
        <header><div><span>NEW COMPANION</span><h3>创建新的 AI 伙伴</h3><p>角色之间的聊天和记忆完全分开。</p></div><button type="button" data-v3-close>×</button></header>
        <div class="uai-c-v3-form">
          <label>名字<input id="uaiV3CharacterName" value="小晴" maxlength="40" /></label>
          <label>关系<select id="uaiV3CharacterRelation">${relationOptions("friend")}</select></label>
          <div><span>性格</span><div class="uai-c-v3-personalities">${personalityMarkup(["温柔", "活泼", "幽默"])}</div></div>
          <label>补充设定<textarea id="uaiV3CharacterDesc" maxlength="900" placeholder="例如：说话直接一点，喜欢开玩笑，但认真讨论问题时很靠谱。"></textarea></label>
        </div>
        <footer><button type="button" class="secondary" id="uaiV3BackCharacters">返回</button><button type="button" id="uaiV3CreateCharacter">创建并切换</button></footer>
      </section>`, (mask) => {
        mask.querySelectorAll("[data-v3-personality]").forEach((button) => button.addEventListener("click", () => button.classList.toggle("selected")));
        mask.querySelector("#uaiV3BackCharacters")?.addEventListener("click", showCharacterManager);
        mask.querySelector("#uaiV3CreateCharacter")?.addEventListener("click", () => {
          persistActiveCharacter();
          const characters = getCharacters();
          if (characters.length >= MAX_CHARACTERS) return;
          const name = cleanText(mask.querySelector("#uaiV3CharacterName")?.value, 40) || "新伙伴";
          const relationship = mask.querySelector("#uaiV3CharacterRelation")?.value || "friend";
          const personality = Array.from(mask.querySelectorAll("[data-v3-personality].selected")).map((item) => item.dataset.v3Personality).filter(Boolean).slice(0, 8);
          const profile = {
            name,
            relationship,
            personality: personality.length ? personality : ["温柔", "自然", "幽默"],
            speakingStyle: ["像即时聊天而不是客服", "默认简短自然", "不要每句话都反问", "自然使用已经知道的共同信息"],
            customDescription: cleanText(mask.querySelector("#uaiV3CharacterDesc")?.value, 900),
            userNickname: "",
            avatarData: "",
            createdAt: Date.now()
          };
          const character = {
            id: makeId("companion-character"),
            profile,
            sessions: [createInitialSession(profile)],
            memories: [],
            settings: readJson(KEYS.settings, {}),
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          characters.push(character);
          saveCharacters(characters);
          closeModal();
          loadCharacterIntoSlots(character, true);
        });
      });
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
    return { state, sessions, session };
  }

  function saveSessionsAndRefresh(sessions) {
    writeJson(KEYS.sessions, sessions);
    persistActiveCharacter();
    window.UnlimitedCompanion?.unmount?.();
    window.setTimeout(() => {
      window.UnlimitedCompanion?.mount?.();
      window.UnlimitedCompanionPolish?.refresh?.();
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
      const actionsHost = row.querySelector(".uai-c-v2-message-actions") || bubble.parentElement;
      if (!actionsHost) return;
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
      if (group.childElementCount) actionsHost.appendChild(group);
    });
  }

  function upsertMemory(text, kind = "fact") {
    const clean = cleanText(text, 180);
    if (!clean) return false;
    let memories = readJson(KEYS.memories, []);
    if (!Array.isArray(memories)) memories = [];

    if (kind === "nickname") memories = memories.filter((item) => !String(item?.text || "").startsWith("用户希望被称为"));
    if (kind === "birthday") memories = memories.filter((item) => !String(item?.text || "").startsWith("用户的生日是"));
    if (kind === "like") {
      const object = clean.replace(/^用户喜欢/, "");
      memories = memories.filter((item) => String(item?.text || "") !== `用户不喜欢${object}`);
    }
    if (kind === "dislike") {
      const object = clean.replace(/^用户不喜欢/, "");
      memories = memories.filter((item) => String(item?.text || "") !== `用户喜欢${object}`);
    }

    if (memories.some((item) => String(item?.text || "").trim().toLowerCase() === clean.toLowerCase())) return false;
    memories.push({ id: makeId("memory"), text: clean, source: "auto-v3", kind, createdAt: Date.now() });
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
    ensureCharacterBar(root);
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
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-uai-mode", "hidden", "class"] });
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
