// public/companion-mode.js
(() => {
  const REVISION = "2026-08-13-v4.0-companion-1";
  const KEYS = {
    profile: "uai_companion_profile_v1",
    sessions: "uai_companion_sessions_v1",
    memories: "uai_companion_memories_v1",
    settings: "uai_companion_settings_v1"
  };

  const DEFAULT_PROFILE = {
    name: "小雨",
    relationship: "girlfriend",
    personality: ["温柔", "细腻", "有一点傲娇", "幽默"],
    speakingStyle: ["像即时聊天而不是客服", "默认简短自然", "偶尔使用语气词和表情", "会自然关心用户但不说教"],
    customDescription: "",
    userNickname: "",
    avatarData: "",
    createdAt: 0
  };

  const DEFAULT_SETTINGS = {
    model: "",
    replyLength: "balanced",
    memoryEnabled: true
  };

  const PERSONALITY_OPTIONS = ["温柔", "可爱", "傲娇", "成熟", "活泼", "安静", "毒舌", "黏人", "理性", "幽默"];
  const RELATIONSHIP_OPTIONS = [
    ["girlfriend", "💗 女朋友"],
    ["boyfriend", "💙 男朋友"],
    ["friend", "🌙 好朋友"],
    ["confidant", "✨ 知心伙伴"],
    ["custom", "🪄 自定义关系"]
  ];
  const RELATIONSHIP_LABELS = {
    girlfriend: "女朋友",
    boyfriend: "男朋友",
    friend: "好朋友",
    confidant: "知心伙伴",
    custom: "陪伴伙伴"
  };

  let root = null;
  let currentSessionId = null;
  let currentAbortController = null;
  let onExit = null;
  let toastTimer = null;

  function safeParse(value, fallback) {
    try {
      const parsed = JSON.parse(value);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function getProfile() {
    const value = safeParse(localStorage.getItem(KEYS.profile), null);
    return value && typeof value === "object" ? { ...DEFAULT_PROFILE, ...value } : null;
  }

  function saveProfile(profile) {
    const normalized = { ...DEFAULT_PROFILE, ...profile, createdAt: Number(profile?.createdAt) || Date.now() };
    localStorage.setItem(KEYS.profile, JSON.stringify(normalized));
    return normalized;
  }

  function getSettings() {
    const value = safeParse(localStorage.getItem(KEYS.settings), {});
    return { ...DEFAULT_SETTINGS, ...(value && typeof value === "object" ? value : {}) };
  }

  function saveSettings(settings) {
    const normalized = { ...DEFAULT_SETTINGS, ...settings };
    localStorage.setItem(KEYS.settings, JSON.stringify(normalized));
    return normalized;
  }

  function getSessions() {
    const value = safeParse(localStorage.getItem(KEYS.sessions), []);
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && typeof item === "object" && typeof item.id === "string");
  }

  function saveSessions(sessions) {
    try {
      localStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
    } catch (error) {
      showToast("本地存储空间不足，请导出数据后清理旧会话");
      throw error;
    }
  }

  function getMemories() {
    const value = safeParse(localStorage.getItem(KEYS.memories), []);
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => item && typeof item === "object" && typeof item.text === "string" && item.text.trim())
      .slice(-100);
  }

  function saveMemories(memories) {
    localStorage.setItem(KEYS.memories, JSON.stringify(memories.slice(-100)));
  }

  function makeId(prefix) {
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${id}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function relationshipLabel(profile) {
    return RELATIONSHIP_LABELS[profile?.relationship] || "陪伴伙伴";
  }

  function avatarHtml(profile, extraClass = "") {
    const safeName = escapeHtml(profile?.name || "小雨");
    if (profile?.avatarData) {
      return `<div class="uai-c-avatar ${extraClass}"><img src="${escapeHtml(profile.avatarData)}" alt="${safeName}头像" /></div>`;
    }
    const symbol = profile?.relationship === "boyfriend" ? "💙" : profile?.relationship === "friend" ? "🌙" : "💗";
    return `<div class="uai-c-avatar ${extraClass}" aria-label="${safeName}头像">${symbol}</div>`;
  }

  function formatClock(timestamp) {
    const date = new Date(Number(timestamp) || Date.now());
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function formatSessionTime(timestamp) {
    const date = new Date(Number(timestamp) || Date.now());
    const now = new Date();
    const diffDays = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000);
    if (diffDays === 0) return formatClock(timestamp);
    if (diffDays === 1) return "昨天";
    if (diffDays < 7) return `${diffDays} 天前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function sessionGroup(timestamp) {
    const date = new Date(Number(timestamp) || Date.now());
    const now = new Date();
    const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((startNow - startDate) / 86400000);
    if (diffDays <= 0) return "今天";
    if (diffDays === 1) return "昨天";
    if (diffDays <= 7) return "过去 7 天";
    return "更早";
  }

  function getModelOptions() {
    const fallback = [
      { id: "deepseek-ai/deepseek-v4-pro", label: "deepseek-v4-pro" },
      { id: "z-ai/glm-5.1", label: "glm-5.1" },
      { id: "openai/gpt-oss-120b", label: "gpt-oss-120b" }
    ];
    const list = Array.isArray(window.APP_MODELS) && window.APP_MODELS.length ? window.APP_MODELS : fallback;
    return list.filter((item) => item?.id).map((item) => ({ id: String(item.id), label: String(item.label || item.id) }));
  }

  function getSelectedModel() {
    const settings = getSettings();
    const models = getModelOptions();
    if (models.some((item) => item.id === settings.model)) return settings.model;
    if (window.APP_DEFAULT_MODEL && models.some((item) => item.id === window.APP_DEFAULT_MODEL)) return window.APP_DEFAULT_MODEL;
    return models[0]?.id || "";
  }

  function buildGreeting(profile) {
    const hour = new Date().getHours();
    if (hour < 6) return `这么晚还没睡呀？我在。想聊点什么？`;
    if (hour < 11) return `早呀～今天醒得还顺利吗？`;
    if (hour < 14) return `中午好呀。忙了一上午没有？`;
    if (hour < 18) return `下午好呀。今天过得怎么样？`;
    if (hour < 23) return `晚上好呀。今天忙完了吗？`;
    return `这么晚才来呀～今天是不是特别忙？`;
  }

  function createSession(profile) {
    const now = Date.now();
    return {
      id: makeId("companion-session"),
      title: "新的聊天",
      createdAt: now,
      updatedAt: now,
      messages: [{ role: "assistant", content: buildGreeting(profile), createdAt: now }]
    };
  }

  function ensureCurrentSession(createIfMissing = true) {
    const profile = getProfile();
    let sessions = getSessions();
    let session = sessions.find((item) => item.id === currentSessionId);
    if (!session && sessions.length) {
      sessions.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
      session = sessions[0];
      currentSessionId = session.id;
    }
    if (!session && createIfMissing && profile) {
      session = createSession(profile);
      sessions.unshift(session);
      currentSessionId = session.id;
      saveSessions(sessions);
    }
    return session || null;
  }

  function updateSession(updatedSession) {
    const sessions = getSessions();
    const index = sessions.findIndex((item) => item.id === updatedSession.id);
    if (index >= 0) sessions[index] = updatedSession;
    else sessions.unshift(updatedSession);
    sessions.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    saveSessions(sessions);
  }

  function getStats(profile = getProfile()) {
    const sessions = getSessions();
    const messageCount = sessions.reduce((sum, session) => sum + (Array.isArray(session.messages) ? session.messages.length : 0), 0);
    const createdAt = Number(profile?.createdAt) || Date.now();
    const daysKnown = Math.max(1, Math.floor((Date.now() - createdAt) / 86400000) + 1);
    return { daysKnown, messageCount, sessionCount: sessions.length };
  }

  function showToast(message) {
    if (!root) return;
    let toast = root.querySelector("#uaiCompanionToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "uaiCompanionToast";
      toast.className = "uai-c-toast";
      root.appendChild(toast);
    }
    toast.textContent = String(message || "");
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function addMemory(text, source = "manual") {
    const clean = String(text || "").replace(/\s+/g, " ").trim().slice(0, 180);
    if (!clean) return false;
    const memories = getMemories();
    const normalized = clean.toLowerCase();
    const existing = memories.find((item) => item.text.trim().toLowerCase() === normalized);
    if (existing) return false;
    memories.push({ id: makeId("memory"), text: clean, source, createdAt: Date.now() });
    saveMemories(memories);
    return true;
  }

  function extractHighConfidenceMemories(userText) {
    const settings = getSettings();
    if (!settings.memoryEnabled) return;
    const text = String(userText || "").trim();
    if (!text) return;

    const candidates = [];
    const rules = [
      { re: /(?:^|[，。！？\s])(?:我叫|我的名字是)\s*([^，。！？!?,\n]{1,20})/, build: (m) => `用户希望被称为${m[1].trim()}` },
      { re: /(?:^|[，。！？\s])我最喜欢\s*([^。！？!?\n]{1,40})/, build: (m) => `用户最喜欢${m[1].trim()}` },
      { re: /(?:^|[，。！？\s])我喜欢\s*([^。！？!?\n]{1,40})/, build: (m) => `用户喜欢${m[1].trim()}` },
      { re: /(?:^|[，。！？\s])我不喜欢\s*([^。！？!?\n]{1,40})/, build: (m) => `用户不喜欢${m[1].trim()}` },
      { re: /(?:^|[，。！？\s])我的生日(?:是|在)\s*([^。！？!?\n]{1,30})/, build: (m) => `用户的生日是${m[1].trim()}` },
      { re: /(?:^|[，。！？\s])我在\s*([^。！？!?\n]{2,40})(?:读书|上学|学习)/, build: (m) => `用户在${m[1].trim()}读书或学习` }
    ];

    for (const rule of rules) {
      const match = text.match(rule.re);
      if (match) candidates.push(rule.build(match));
    }

    candidates.slice(0, 3).forEach((candidate) => addMemory(candidate, "auto"));
  }

  function renderShell() {
    if (!root) return;
    root.innerHTML = `
      <div class="uai-c-sidebar-overlay" id="uaiCompanionSidebarOverlay"></div>
      <div class="uai-c-shell">
        <aside class="uai-c-sidebar" aria-label="陪伴会话">
          <div id="uaiCompanionProfileCard"></div>
          <button class="uai-c-new-chat" id="uaiCompanionNewChat" type="button">＋ 新的聊天</button>
          <div class="uai-c-side-label">Conversations</div>
          <div class="uai-c-session-list" id="uaiCompanionSessionList"></div>
          <div class="uai-c-side-actions">
            <button class="uai-c-sidebar-action" id="uaiCompanionMemoryBtn" type="button"><span>记忆</span><b id="uaiCompanionMemoryCount">0</b></button>
            <button class="uai-c-sidebar-action" id="uaiCompanionCharacterBtn" type="button"><span>角色</span><b>编辑</b></button>
            <button class="uai-c-sidebar-action" id="uaiCompanionSettingsBtn" type="button"><span>设置与数据</span><b>›</b></button>
            <button class="uai-c-sidebar-action" id="uaiCompanionExitBtn" type="button"><span>切换模式</span><b>↗</b></button>
          </div>
        </aside>

        <main class="uai-c-main">
          <header class="uai-c-header">
            <div class="uai-c-header-left">
              <button class="uai-c-icon-btn uai-c-mobile-menu" id="uaiCompanionMobileMenu" type="button" aria-label="打开会话列表">☰</button>
              <div id="uaiCompanionHeaderAvatar"></div>
              <div class="uai-c-title">
                <strong id="uaiCompanionHeaderName">AI 陪伴</strong>
                <span><i class="uai-c-online-dot"></i><span id="uaiCompanionHeaderStatus">陪你聊一会儿</span></span>
              </div>
            </div>
            <div class="uai-c-header-actions">
              <button class="uai-c-icon-btn uai-c-settings-shortcut" id="uaiCompanionHeaderMemory" type="button" title="长期记忆" aria-label="长期记忆">♡</button>
              <button class="uai-c-icon-btn" id="uaiCompanionHeaderSettings" type="button" title="设置" aria-label="设置">⚙</button>
            </div>
          </header>

          <section class="uai-c-messages" id="uaiCompanionMessages" aria-live="polite"></section>

          <div class="uai-c-composer-wrap" id="uaiCompanionComposerWrap">
            <div class="uai-c-composer">
              <textarea class="uai-c-input" id="uaiCompanionInput" rows="1" placeholder="说点什么……" aria-label="聊天消息"></textarea>
              <button class="uai-c-send" id="uaiCompanionSend" type="button">发送</button>
              <button class="uai-c-stop" id="uaiCompanionStop" type="button">停止</button>
            </div>
            <div class="uai-c-composer-hint">Enter 发送 · Shift + Enter 换行 · 陪伴数据仅保存在当前浏览器</div>
          </div>
        </main>
      </div>
      <div class="uai-c-modal-mask" id="uaiCompanionModalMask" hidden></div>
      <div class="uai-c-toast" id="uaiCompanionToast"></div>
    `;

    bindShellEvents();
  }

  function bindShellEvents() {
    const byId = (id) => root?.querySelector(`#${id}`);
    byId("uaiCompanionNewChat")?.addEventListener("click", newChat);
    byId("uaiCompanionMemoryBtn")?.addEventListener("click", showMemoryModal);
    byId("uaiCompanionHeaderMemory")?.addEventListener("click", showMemoryModal);
    byId("uaiCompanionCharacterBtn")?.addEventListener("click", showCharacterModal);
    byId("uaiCompanionSettingsBtn")?.addEventListener("click", showSettingsModal);
    byId("uaiCompanionHeaderSettings")?.addEventListener("click", showSettingsModal);
    byId("uaiCompanionExitBtn")?.addEventListener("click", () => onExit?.());
    byId("uaiCompanionMobileMenu")?.addEventListener("click", () => root.classList.add("sidebar-open"));
    byId("uaiCompanionSidebarOverlay")?.addEventListener("click", () => root.classList.remove("sidebar-open"));
    byId("uaiCompanionSend")?.addEventListener("click", sendMessage);
    byId("uaiCompanionStop")?.addEventListener("click", stopGeneration);

    const input = byId("uaiCompanionInput");
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
    input?.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    });
  }

  function renderProfileChrome() {
    if (!root) return;
    const profile = getProfile();
    const stats = getStats(profile);
    const card = root.querySelector("#uaiCompanionProfileCard");
    const avatarSlot = root.querySelector("#uaiCompanionHeaderAvatar");
    const name = root.querySelector("#uaiCompanionHeaderName");
    const status = root.querySelector("#uaiCompanionHeaderStatus");

    if (!profile) {
      if (card) card.innerHTML = `<div class="uai-c-profile-card"><div class="uai-c-avatar">♡</div><div class="uai-c-profile-copy"><strong>创建你的 AI 伙伴</strong><span>第一次见面</span></div></div>`;
      if (avatarSlot) avatarSlot.innerHTML = `<div class="uai-c-avatar">♡</div>`;
      if (name) name.textContent = "AI 陪伴";
      if (status) status.textContent = "创建角色后开始聊天";
      return;
    }

    if (card) {
      card.innerHTML = `
        <div class="uai-c-profile-card">
          ${avatarHtml(profile)}
          <div class="uai-c-profile-copy"><strong>${escapeHtml(profile.name)}</strong><span>${escapeHtml(relationshipLabel(profile))} · 认识 ${stats.daysKnown} 天</span></div>
          <button class="uai-c-icon-btn" id="uaiCompanionEditProfileInline" type="button" aria-label="编辑角色">⋯</button>
        </div>`;
      card.querySelector("#uaiCompanionEditProfileInline")?.addEventListener("click", showCharacterModal);
    }
    if (avatarSlot) avatarSlot.innerHTML = avatarHtml(profile);
    if (name) name.textContent = profile.name;
    if (status) status.textContent = `${relationshipLabel(profile)} · 已聊 ${stats.messageCount} 条`;
  }

  function renderSessions() {
    if (!root) return;
    const list = root.querySelector("#uaiCompanionSessionList");
    if (!list) return;
    const sessions = getSessions().sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    list.innerHTML = "";
    let lastGroup = "";

    sessions.forEach((session) => {
      const group = sessionGroup(session.updatedAt);
      if (group !== lastGroup) {
        const label = document.createElement("div");
        label.className = "uai-c-side-label";
        label.textContent = group;
        label.style.marginTop = lastGroup ? "9px" : "0";
        list.appendChild(label);
        lastGroup = group;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = `uai-c-session${session.id === currentSessionId ? " active" : ""}`;
      button.dataset.sessionId = session.id;
      button.innerHTML = `
        <span class="uai-c-session-copy"><span class="uai-c-session-title">${escapeHtml(session.title || "新的聊天")}</span><span class="uai-c-session-time">${escapeHtml(formatSessionTime(session.updatedAt))}</span></span>
        <span class="uai-c-session-delete" role="button" tabindex="0" aria-label="删除会话">×</span>`;
      button.addEventListener("click", (event) => {
        if (event.target.closest(".uai-c-session-delete")) return;
        currentSessionId = session.id;
        root.classList.remove("sidebar-open");
        renderSessions();
        renderMessages();
      });
      const deleteBtn = button.querySelector(".uai-c-session-delete");
      deleteBtn?.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteSession(session.id);
      });
      deleteBtn?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          deleteSession(session.id);
        }
      });
      list.appendChild(button);
    });

    const memoryCount = root.querySelector("#uaiCompanionMemoryCount");
    if (memoryCount) memoryCount.textContent = String(getMemories().length);
  }

  function renderMessages() {
    if (!root) return;
    const container = root.querySelector("#uaiCompanionMessages");
    if (!container) return;
    const profile = getProfile();
    const session = ensureCurrentSession(Boolean(profile));

    if (!profile) {
      container.innerHTML = `<div class="uai-c-welcome"><div class="uai-c-avatar">♡</div><h2>先创建你的 AI 伙伴</h2><p>只需要一个名字、关系和几个性格标签。之后的聊天、记忆与角色设置都会单独保存在陪伴模式里。</p></div>`;
      return;
    }

    if (!session || !Array.isArray(session.messages) || !session.messages.length) {
      container.innerHTML = `<div class="uai-c-welcome">${avatarHtml(profile)}<h2>${escapeHtml(profile.name)}</h2><p>从这里开始一段新的聊天。</p></div>`;
      return;
    }

    container.innerHTML = session.messages.map((message) => {
      const role = message.role === "user" ? "user" : "assistant";
      return `<div class="uai-c-message-row ${role}"><div><div class="uai-c-bubble">${escapeHtml(message.content)}</div><div class="uai-c-message-time">${escapeHtml(formatClock(message.createdAt))}</div></div></div>`;
    }).join("");
    requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
  }

  function renderAll() {
    renderProfileChrome();
    renderSessions();
    renderMessages();
  }

  function newChat() {
    const profile = getProfile();
    if (!profile) {
      showOnboarding();
      return;
    }
    stopGeneration();
    const sessions = getSessions();
    const session = createSession(profile);
    sessions.unshift(session);
    currentSessionId = session.id;
    saveSessions(sessions);
    renderAll();
    root.classList.remove("sidebar-open");
    root.querySelector("#uaiCompanionInput")?.focus();
  }

  function deleteSession(sessionId) {
    if (!confirm("删除这段聊天记录？此操作只影响陪伴模式。")) return;
    stopGeneration();
    let sessions = getSessions().filter((item) => item.id !== sessionId);
    if (currentSessionId === sessionId) currentSessionId = sessions[0]?.id || null;
    saveSessions(sessions);
    ensureCurrentSession(true);
    renderAll();
  }

  function setGenerating(active) {
    const wrap = root?.querySelector("#uaiCompanionComposerWrap");
    const input = root?.querySelector("#uaiCompanionInput");
    wrap?.classList.toggle("generating", active);
    if (input) input.disabled = active;
  }

  function appendStreamingRow() {
    const container = root?.querySelector("#uaiCompanionMessages");
    if (!container) return null;
    const row = document.createElement("div");
    row.className = "uai-c-message-row assistant";
    row.innerHTML = `<div><div class="uai-c-bubble"><span class="uai-c-typing"><span></span><span></span><span></span></span></div><div class="uai-c-message-time">正在输入…</div></div>`;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
    return {
      row,
      bubble: row.querySelector(".uai-c-bubble"),
      time: row.querySelector(".uai-c-message-time")
    };
  }

  function getRelationshipContext() {
    const profile = getProfile();
    const stats = getStats(profile);
    const recentTopics = getSessions()
      .filter((session) => session.title && session.title !== "新的聊天")
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
      .slice(0, 5)
      .map((session) => session.title);
    return { ...stats, recentTopics };
  }

  function buildRequestPayload(session) {
    const settings = getSettings();
    const profile = getProfile();
    return {
      mode: "companion",
      model: getSelectedModel(),
      character: profile,
      companion_memory: settings.memoryEnabled ? getMemories() : [],
      relationship_context: getRelationshipContext(),
      companion_preferences: {
        replyLength: settings.replyLength,
        memoryEnabled: settings.memoryEnabled
      },
      local_context: {
        currentTime: new Date().toLocaleString("zh-CN", { hour12: false })
      },
      messages: Array.isArray(session.messages) ? session.messages : []
    };
  }

  async function consumeSse(response, onDelta) {
    if (!response.body) throw new Error("模型没有返回可读取的响应流");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const processLine = (rawLine) => {
      const line = rawLine.replace(/\r$/, "");
      if (!line.startsWith("data:")) return;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) onDelta(delta);
      } catch {
        // Ignore incomplete/non-JSON event lines. The stream buffer handles chunk boundaries.
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        processLine(line);
        newlineIndex = buffer.indexOf("\n");
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) processLine(buffer);
  }

  async function sendMessage() {
    if (currentAbortController) return;
    const profile = getProfile();
    if (!profile) {
      showOnboarding();
      return;
    }
    const input = root?.querySelector("#uaiCompanionInput");
    const text = String(input?.value || "").trim();
    if (!text) return;

    let session = ensureCurrentSession(true);
    if (!session) return;
    const now = Date.now();
    const nextMessages = Array.isArray(session.messages) ? [...session.messages] : [];
    nextMessages.push({ role: "user", content: text, createdAt: now });
    const firstUserMessage = nextMessages.find((message) => message.role === "user");
    session = {
      ...session,
      title: session.title === "新的聊天" && firstUserMessage ? firstUserMessage.content.replace(/\s+/g, " ").slice(0, 22) : session.title,
      updatedAt: now,
      messages: nextMessages
    };
    updateSession(session);
    extractHighConfidenceMemories(text);

    if (input) {
      input.value = "";
      input.style.height = "auto";
    }
    renderSessions();
    renderMessages();
    renderProfileChrome();

    currentAbortController = new AbortController();
    setGenerating(true);
    const streamRow = appendStreamingRow();
    let full = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestPayload(session)),
        signal: currentAbortController.signal
      });
      if (!response.ok) {
        const message = (await response.text().catch(() => "")).slice(0, 500);
        throw new Error(message || `HTTP ${response.status}`);
      }

      await consumeSse(response, (delta) => {
        full += delta;
        if (streamRow?.bubble) streamRow.bubble.textContent = full;
        if (streamRow?.time) streamRow.time.textContent = "正在输入…";
        const container = root?.querySelector("#uaiCompanionMessages");
        if (container) container.scrollTop = container.scrollHeight;
      });

      if (full.trim()) {
        const latest = getSessions().find((item) => item.id === session.id) || session;
        latest.messages = [...(Array.isArray(latest.messages) ? latest.messages : []), { role: "assistant", content: full.trim(), createdAt: Date.now() }];
        latest.updatedAt = Date.now();
        updateSession(latest);
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        if (full.trim()) {
          const latest = getSessions().find((item) => item.id === session.id) || session;
          latest.messages = [...(Array.isArray(latest.messages) ? latest.messages : []), { role: "assistant", content: full.trim(), createdAt: Date.now() }];
          latest.updatedAt = Date.now();
          updateSession(latest);
        }
      } else {
        if (streamRow?.bubble) streamRow.bubble.textContent = "这次没连上模型，稍后再试一下。";
        if (streamRow?.time) streamRow.time.textContent = "发送失败";
        console.error("[Unlimited Companion] chat failed", error);
      }
    } finally {
      currentAbortController = null;
      setGenerating(false);
      renderAll();
      root?.querySelector("#uaiCompanionInput")?.focus();
    }
  }

  function stopGeneration() {
    if (currentAbortController) currentAbortController.abort();
  }

  function openModal(content, bind) {
    const mask = root?.querySelector("#uaiCompanionModalMask");
    if (!mask) return;
    mask.innerHTML = content;
    mask.hidden = false;
    const close = () => {
      mask.hidden = true;
      mask.innerHTML = "";
    };
    mask.addEventListener("click", (event) => {
      if (event.target === mask) close();
    }, { once: true });
    mask.querySelector("[data-close-modal]")?.addEventListener("click", close);
    bind?.({ mask, close });
  }

  function personalityChipHtml(selected = []) {
    const set = new Set(selected);
    return PERSONALITY_OPTIONS.map((item) => `<button class="uai-c-chip${set.has(item) ? " selected" : ""}" type="button" data-personality="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("");
  }

  function relationshipOptionsHtml(selected) {
    return RELATIONSHIP_OPTIONS.map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
  }

  function bindChipSelection(mask) {
    mask.querySelectorAll("[data-personality]").forEach((button) => {
      button.addEventListener("click", () => button.classList.toggle("selected"));
    });
  }

  function selectedPersonalities(mask) {
    return Array.from(mask.querySelectorAll("[data-personality].selected")).map((button) => button.dataset.personality).filter(Boolean).slice(0, 8);
  }

  function showOnboarding() {
    openModal(`
      <section class="uai-c-modal uai-c-onboarding" role="dialog" aria-modal="true" aria-label="创建 AI 伙伴">
        <div class="uai-c-onboard-top">
          <div class="uai-c-avatar">💗</div>
          <h2>创建你的第一个 AI 伙伴</h2>
          <p>不用填复杂表格。一个名字、一种关系、几个性格标签就可以开始，之后随时能修改。</p>
        </div>
        <div class="uai-c-modal-body">
          <div class="uai-c-field"><label for="uaiOnboardName">她 / 他的名字</label><input id="uaiOnboardName" value="小雨" maxlength="40" /></div>
          <div class="uai-c-field"><label for="uaiOnboardRelationship">你们是什么关系</label><select id="uaiOnboardRelationship">${relationshipOptionsHtml("girlfriend")}</select></div>
          <div class="uai-c-field"><label>性格</label><div class="uai-c-chip-grid">${personalityChipHtml(DEFAULT_PROFILE.personality)}</div><small>建议选 3～5 个，角色会更稳定。</small></div>
          <div class="uai-c-field"><label for="uaiOnboardDesc">补充描述（可选）</label><textarea id="uaiOnboardDesc" placeholder="例如：平时说话自然一点，有一点傲娇，但不要太夸张。"></textarea></div>
          <div class="uai-c-modal-actions">
            <button class="uai-c-text-btn" id="uaiOnboardQuick" type="button">使用默认小雨</button>
            <button class="uai-c-primary" id="uaiOnboardCreate" type="button">创建角色</button>
          </div>
        </div>
      </section>`, ({ mask, close }) => {
        bindChipSelection(mask);
        const finish = (profile) => {
          const saved = saveProfile(profile);
          const session = createSession(saved);
          currentSessionId = session.id;
          saveSessions([session]);
          close();
          renderAll();
          root?.querySelector("#uaiCompanionInput")?.focus();
        };
        mask.querySelector("#uaiOnboardQuick")?.addEventListener("click", () => finish({ ...DEFAULT_PROFILE, createdAt: Date.now() }));
        mask.querySelector("#uaiOnboardCreate")?.addEventListener("click", () => {
          const name = mask.querySelector("#uaiOnboardName")?.value.trim() || "小雨";
          const relationship = mask.querySelector("#uaiOnboardRelationship")?.value || "girlfriend";
          const personality = selectedPersonalities(mask);
          const customDescription = mask.querySelector("#uaiOnboardDesc")?.value.trim() || "";
          finish({ ...DEFAULT_PROFILE, name, relationship, personality: personality.length ? personality : DEFAULT_PROFILE.personality, customDescription, createdAt: Date.now() });
        });
      });
  }

  function showCharacterModal() {
    const profile = getProfile();
    if (!profile) return showOnboarding();
    openModal(`
      <section class="uai-c-modal" role="dialog" aria-modal="true" aria-label="角色设置">
        <div class="uai-c-modal-head"><div><h3>角色设置</h3><p>这些设定会在每次陪伴对话中保持稳定，不会影响小说人物。</p></div><button class="uai-c-icon-btn" data-close-modal type="button">×</button></div>
        <div class="uai-c-modal-body">
          <div class="uai-c-field"><label for="uaiCharacterName">名字</label><input id="uaiCharacterName" value="${escapeHtml(profile.name)}" maxlength="40" /></div>
          <div class="uai-c-field"><label for="uaiCharacterRelationship">关系</label><select id="uaiCharacterRelationship">${relationshipOptionsHtml(profile.relationship)}</select></div>
          <div class="uai-c-field"><label>性格</label><div class="uai-c-chip-grid">${personalityChipHtml(profile.personality)}</div></div>
          <div class="uai-c-field"><label for="uaiCharacterNickname">她 / 他怎么称呼你（可选）</label><input id="uaiCharacterNickname" value="${escapeHtml(profile.userNickname || "")}" maxlength="40" placeholder="例如：阿月" /></div>
          <div class="uai-c-field"><label for="uaiCharacterDesc">补充设定</label><textarea id="uaiCharacterDesc" maxlength="900">${escapeHtml(profile.customDescription || "")}</textarea></div>
          <div class="uai-c-field"><label for="uaiCharacterAvatar">头像（可选）</label><input id="uaiCharacterAvatar" type="file" accept="image/png,image/jpeg,image/webp" /><small>图片仅保存在当前浏览器。建议小于 700 KB，避免占满 localStorage。</small></div>
          <div class="uai-c-modal-actions"><button class="uai-c-primary" id="uaiCharacterSave" type="button">保存角色</button></div>
        </div>
      </section>`, ({ mask, close }) => {
        bindChipSelection(mask);
        let pendingAvatar = profile.avatarData || "";
        mask.querySelector("#uaiCharacterAvatar")?.addEventListener("change", (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (file.size > 700000) {
            showToast("头像太大了，请选择 700 KB 以下的图片");
            event.target.value = "";
            return;
          }
          const reader = new FileReader();
          reader.onload = () => { pendingAvatar = typeof reader.result === "string" ? reader.result : pendingAvatar; };
          reader.readAsDataURL(file);
        });
        mask.querySelector("#uaiCharacterSave")?.addEventListener("click", () => {
          const next = {
            ...profile,
            name: mask.querySelector("#uaiCharacterName")?.value.trim() || profile.name,
            relationship: mask.querySelector("#uaiCharacterRelationship")?.value || profile.relationship,
            personality: selectedPersonalities(mask),
            userNickname: mask.querySelector("#uaiCharacterNickname")?.value.trim() || "",
            customDescription: mask.querySelector("#uaiCharacterDesc")?.value.trim() || "",
            avatarData: pendingAvatar
          };
          if (!next.personality.length) next.personality = DEFAULT_PROFILE.personality;
          saveProfile(next);
          close();
          renderAll();
          showToast("角色设置已保存");
        });
      });
  }

  function showMemoryModal() {
    const settings = getSettings();
    const memories = getMemories();
    openModal(`
      <section class="uai-c-modal wide" role="dialog" aria-modal="true" aria-label="长期记忆">
        <div class="uai-c-modal-head"><div><h3>她记得关于你的事情</h3><p>这些记忆只属于陪伴模式。你可以随时增加、修改或删除，AI 不会读取小说记忆。</p></div><button class="uai-c-icon-btn" data-close-modal type="button">×</button></div>
        <div class="uai-c-modal-body">
          <div class="uai-c-memory-add"><input id="uaiMemoryNew" placeholder="例如：用户最近正在准备保研" /><button class="uai-c-primary" id="uaiMemoryAdd" type="button">添加记忆</button></div>
          <div class="uai-c-memory-list" id="uaiMemoryList">
            ${memories.length ? memories.map((item) => `<div class="uai-c-memory-item" data-memory-id="${escapeHtml(item.id)}"><textarea maxlength="180">${escapeHtml(item.text)}</textarea><button type="button" aria-label="删除记忆">×</button></div>`).join("") : `<div class="uai-c-empty-box">还没有长期记忆。聊天中出现“我喜欢…”“我叫…”等明确信息时，可以自动记录，也可以手动添加。</div>`}
          </div>
          <div class="uai-c-modal-actions">
            <button class="uai-c-text-btn danger" id="uaiMemoryClear" type="button">清空全部记忆</button>
            <button class="uai-c-primary" id="uaiMemorySave" type="button">保存修改</button>
          </div>
          <p style="margin:12px 0 0;color:rgba(255,255,255,.34);font-size:11px;line-height:1.6">自动记忆当前为：${settings.memoryEnabled ? "开启" : "关闭"}。可在“设置与数据”中切换。</p>
        </div>
      </section>`, ({ mask, close }) => {
        const collectRows = () => Array.from(mask.querySelectorAll("[data-memory-id]")).map((row) => ({
          id: row.dataset.memoryId,
          text: row.querySelector("textarea")?.value.trim() || "",
          source: getMemories().find((item) => item.id === row.dataset.memoryId)?.source || "manual",
          createdAt: getMemories().find((item) => item.id === row.dataset.memoryId)?.createdAt || Date.now()
        })).filter((item) => item.text);

        mask.querySelectorAll("[data-memory-id] button").forEach((button) => button.addEventListener("click", () => button.closest("[data-memory-id]")?.remove()));
        mask.querySelector("#uaiMemoryAdd")?.addEventListener("click", () => {
          const input = mask.querySelector("#uaiMemoryNew");
          const text = input?.value.trim();
          if (!text) return;
          const list = mask.querySelector("#uaiMemoryList");
          list?.querySelector(".uai-c-empty-box")?.remove();
          const item = document.createElement("div");
          item.className = "uai-c-memory-item";
          item.dataset.memoryId = makeId("memory");
          item.innerHTML = `<textarea maxlength="180">${escapeHtml(text)}</textarea><button type="button" aria-label="删除记忆">×</button>`;
          item.querySelector("button")?.addEventListener("click", () => item.remove());
          list?.appendChild(item);
          if (input) input.value = "";
        });
        mask.querySelector("#uaiMemoryClear")?.addEventListener("click", () => {
          if (!confirm("清空陪伴模式的全部长期记忆？聊天记录不会被删除。")) return;
          saveMemories([]);
          close();
          renderSessions();
          showToast("长期记忆已清空");
        });
        mask.querySelector("#uaiMemorySave")?.addEventListener("click", () => {
          saveMemories(collectRows());
          close();
          renderSessions();
          showToast("长期记忆已保存");
        });
      });
  }

  function exportCompanionData() {
    const payload = {
      format: "unlimited-ai-companion-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: getProfile(),
      settings: getSettings(),
      memories: getMemories(),
      sessions: getSessions()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `unlimited-ai-companion-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function showSettingsModal() {
    const profile = getProfile();
    const settings = getSettings();
    const stats = getStats(profile);
    const models = getModelOptions();
    const selectedModel = getSelectedModel();
    openModal(`
      <section class="uai-c-modal" role="dialog" aria-modal="true" aria-label="陪伴设置">
        <div class="uai-c-modal-head"><div><h3>设置与数据</h3><p>模型、回复长度、长期记忆和本地数据管理。</p></div><button class="uai-c-icon-btn" data-close-modal type="button">×</button></div>
        <div class="uai-c-modal-body">
          <div class="uai-c-stat-grid"><div class="uai-c-stat"><strong>${stats.daysKnown}</strong><span>认识天数</span></div><div class="uai-c-stat"><strong>${stats.sessionCount}</strong><span>聊天会话</span></div><div class="uai-c-stat"><strong>${stats.messageCount}</strong><span>累计消息</span></div></div>
          <div class="uai-c-field"><label for="uaiCompanionModel">陪伴模型</label><select id="uaiCompanionModel">${models.map((model) => `<option value="${escapeHtml(model.id)}"${model.id === selectedModel ? " selected" : ""}>${escapeHtml(model.label)}</option>`).join("")}</select><small>小说模式的模型选择不会被这里覆盖。</small></div>
          <div class="uai-c-field"><label for="uaiCompanionReplyLength">默认回复长度</label><select id="uaiCompanionReplyLength"><option value="short"${settings.replyLength === "short" ? " selected" : ""}>简短 · 更像即时聊天</option><option value="balanced"${settings.replyLength === "balanced" ? " selected" : ""}>自然 · 默认</option><option value="detailed"${settings.replyLength === "detailed" ? " selected" : ""}>详细 · 问问题时多说一些</option></select></div>
          <div class="uai-c-field"><label><input id="uaiCompanionMemoryEnabled" type="checkbox"${settings.memoryEnabled ? " checked" : ""} style="width:auto;margin-right:7px" />启用长期记忆</label><small>关闭后不会自动提取，也不会把已有长期记忆发送给模型；记忆本身不会被删除。</small></div>
          <div class="uai-c-modal-actions" style="justify-content:flex-start"><button class="uai-c-text-btn" id="uaiCompanionExport" type="button">导出陪伴数据</button><button class="uai-c-text-btn danger" id="uaiCompanionClearCurrent" type="button">清空当前聊天</button><button class="uai-c-text-btn danger" id="uaiCompanionReset" type="button">重置陪伴模式</button></div>
          <div class="uai-c-modal-actions"><button class="uai-c-primary" id="uaiCompanionSettingsSave" type="button">保存设置</button></div>
        </div>
      </section>`, ({ mask, close }) => {
        mask.querySelector("#uaiCompanionExport")?.addEventListener("click", exportCompanionData);
        mask.querySelector("#uaiCompanionClearCurrent")?.addEventListener("click", () => {
          if (!confirm("清空当前陪伴聊天？长期记忆不会删除。")) return;
          const session = ensureCurrentSession(false);
          if (!session || !profile) return;
          session.messages = [{ role: "assistant", content: buildGreeting(profile), createdAt: Date.now() }];
          session.title = "新的聊天";
          session.updatedAt = Date.now();
          updateSession(session);
          close();
          renderAll();
        });
        mask.querySelector("#uaiCompanionReset")?.addEventListener("click", () => {
          if (!confirm("重置整个陪伴模式？角色、聊天和长期记忆都会删除，但小说数据完全不受影响。")) return;
          stopGeneration();
          Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
          currentSessionId = null;
          close();
          renderAll();
          showOnboarding();
        });
        mask.querySelector("#uaiCompanionSettingsSave")?.addEventListener("click", () => {
          saveSettings({
            ...settings,
            model: mask.querySelector("#uaiCompanionModel")?.value || "",
            replyLength: mask.querySelector("#uaiCompanionReplyLength")?.value || "balanced",
            memoryEnabled: Boolean(mask.querySelector("#uaiCompanionMemoryEnabled")?.checked)
          });
          close();
          showToast("陪伴设置已保存");
        });
      });
  }

  function mount(options = {}) {
    onExit = typeof options.onExit === "function" ? options.onExit : onExit;
    if (!root) {
      root = document.createElement("div");
      root.id = "uaiCompanionRoot";
      root.dataset.revision = REVISION;
      document.body.appendChild(root);
      renderShell();
    }
    root.hidden = false;
    root.classList.remove("sidebar-open");
    ensureCurrentSession(Boolean(getProfile()));
    renderAll();
    if (!getProfile()) setTimeout(showOnboarding, 40);
    setTimeout(() => root?.querySelector("#uaiCompanionInput")?.focus(), 80);
  }

  function unmount() {
    stopGeneration();
    if (root) {
      root.hidden = true;
      root.classList.remove("sidebar-open");
      const modal = root.querySelector("#uaiCompanionModalMask");
      if (modal) {
        modal.hidden = true;
        modal.innerHTML = "";
      }
    }
  }

  window.UnlimitedCompanion = {
    revision: REVISION,
    mount,
    unmount,
    getState() {
      return {
        profile: getProfile(),
        settings: getSettings(),
        memories: getMemories(),
        sessions: getSessions(),
        currentSessionId
      };
    }
  };
})();
