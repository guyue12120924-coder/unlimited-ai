// public/app.js
(() => {
  const historyWrap = document.getElementById("history");
  const chatEl = document.getElementById("chat");
  const inputEl = document.getElementById("msg");
  const composerEl = document.getElementById("composer");
  const spacerEl = document.getElementById("bottom-spacer");

  const modelSel = document.getElementById("modelSel");
  const personaToggle = document.getElementById("personaToggle");
  const settingsBtn = document.getElementById("settingsBtn");
  const sendBtn = document.getElementById("sendBtn");
  const stopBtn = document.getElementById("stopBtn");          // 新增：停止按钮

  const settingsMask = document.getElementById("settingsMask");
  const customPromptEl = document.getElementById("customPrompt");
  const savePromptBtn = document.getElementById("savePrompt");
  const clearPromptBtn = document.getElementById("clearPrompt");
  const closeSettingsBtn = document.getElementById("closeSettings");
  const historyKeepEl = document.getElementById("historyKeep");
  const clearHistoryBtn = document.getElementById("clearHistory");
  const promptKeepEl = document.getElementById("promptKeep");

  const donateBtn = document.getElementById("donateBtn");
  const donateMask = document.getElementById("donateMask");
  const donateClose = document.getElementById("donateClose");

  // 会话管理相关元素
  const sessionBtn = document.getElementById("sessionBtn");
  const sessionPanel = document.getElementById("sessionPanel");
  const sessionOverlay = document.getElementById("sessionOverlay");
  const closeSessionPanel = document.getElementById("closeSessionPanel");
  const sessionListEl = document.getElementById("sessionList");
  const newSessionBtn = document.getElementById("newSessionBtn");

  // 新增：上传背景相关元素
  const uploadBgBtn = document.getElementById("uploadBgBtn");
  const bgImageFile = document.getElementById("bgImageFile");
  const clearBgBtn = document.getElementById("clearBgBtn");   // 清除背景按钮

  const MODELS = (window.APP_MODELS || [
    { id: "deepseek-ai/deepseek-v4-pro", label: "deepseek-v4-pro" },
    { id: "z-ai/glm-5.1", label: "glm-5.1" },
    { id: "openai/gpt-oss-120b", label: "gpt-oss-120b" },
  ]);

  // 当前活跃会话的ID和消息数组
  let currentSessionId = null;
  let sessions = [];           // 存储所有会话 { id, name, messages, createdAt }
  let session = [];            // 当前会话的消息数组（指向 sessions 中对应会话的 messages）

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalInEstimate = 0;
  let totalOutEstimate = 0;

  // 用于停止生成
  let currentAbortController = null;

  // ====== 本地存储 Key ======
  const LS_MODEL = "cfw_model";
  const LS_USE_BUILTIN = "cfw_use_builtin";
  const LS_HISTORY_ENABLED = "cfw_history_enabled";
  const LS_CHAT_SESSION = "cfw_chat_session_v1";      // 旧单会话存储（兼容）
  const LS_PROMPT_ENABLED = "cfw_prompt_enabled";
  const LS_CUSTOM_PROMPT = "cfw_custom_prompt_v1";
  const LS_SESSIONS = "cfw_sessions_v2";              // 新增：多会话存储

  const LS_THEME = "cfw_theme";
  const LS_BG_TYPE = "cfw_bg_type";
  const LS_CUSTOM_COLOR = "cfw_custom_color";
  const LS_UPLOADED_BG = "cfw_uploaded_bg";           // 存储用户上传的背景图片 base64

  let useBuiltin = (localStorage.getItem(LS_USE_BUILTIN) ?? "1") === "1";
  personaToggle.textContent = useBuiltin ? "😈" : "😇";

  let historyEnabled = (localStorage.getItem(LS_HISTORY_ENABLED) ?? "0") === "1";
  let promptEnabled  = (localStorage.getItem(LS_PROMPT_ENABLED) ?? "1") === "1";
  historyKeepEl.checked = historyEnabled;
  promptKeepEl.checked = promptEnabled;

  // ========== 多会话管理函数 ==========
  function saveSessionsToStorage() {
    try {
      localStorage.setItem(LS_SESSIONS, JSON.stringify(sessions));
    } catch(e) {}
  }

  function loadSessionsFromStorage() {
    const raw = localStorage.getItem(LS_SESSIONS);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          sessions = parsed;
          // 确保每个会话都有必要的字段
          sessions.forEach(s => {
            if (!s.messages) s.messages = [];
            if (!s.createdAt) s.createdAt = Date.now();
            if (!s.name) s.name = `会话 ${new Date(s.createdAt).toLocaleString()}`;
          });
          return;
        }
      } catch(e) {}
    }
    // 如果不存在多会话数据，尝试迁移旧的单会话
    const oldSessionRaw = localStorage.getItem(LS_CHAT_SESSION);
    if (oldSessionRaw) {
      try {
        const oldMessages = JSON.parse(oldSessionRaw);
        if (Array.isArray(oldMessages)) {
          const defaultId = Date.now().toString();
          sessions = [{
            id: defaultId,
            name: "默认会话",
            messages: oldMessages,
            createdAt: Date.now()
          }];
          saveSessionsToStorage();
          // 清空旧存储以避免重复迁移
          localStorage.removeItem(LS_CHAT_SESSION);
        }
      } catch(e) {}
    }
    if (!sessions.length) {
      // 创建一个默认会话
      const defaultId = Date.now().toString();
      sessions = [{
        id: defaultId,
        name: "新会话",
        messages: [],
        createdAt: Date.now()
      }];
      saveSessionsToStorage();
    }
  }

  function renderSessionList() {
    if (!sessionListEl) return;
    sessionListEl.innerHTML = "";
    sessions.forEach(s => {
      const div = document.createElement("div");
      div.className = "session-item" + (currentSessionId === s.id ? " active" : "");
      div.innerHTML = `
        <span class="session-title" data-id="${s.id}">${escapeHtml(s.name)}</span>
        <div class="session-actions">
          <button class="rename-session" data-id="${s.id}" title="重命名">✏️</button>
          <button class="delete-session" data-id="${s.id}" title="删除">🗑️</button>
        </div>
      `;
      // 点击标题切换会话
      div.querySelector(".session-title").addEventListener("click", (e) => {
        e.stopPropagation();
        switchToSession(s.id);
        closeSessionPanelFunc();
      });
      div.querySelector(".rename-session").addEventListener("click", (e) => {
        e.stopPropagation();
        const newName = prompt("输入新名称:", s.name);
        if (newName && newName.trim()) {
          s.name = newName.trim();
          saveSessionsToStorage();
          renderSessionList();
        }
      });
      div.querySelector(".delete-session").addEventListener("click", (e) => {
        e.stopPropagation();
        if (sessions.length === 1) {
          alert("至少保留一个会话");
          return;
        }
        if (confirm(`确定删除会话“${s.name}”吗？`)) {
          const index = sessions.findIndex(ss => ss.id === s.id);
          if (index !== -1) sessions.splice(index, 1);
          saveSessionsToStorage();
          if (currentSessionId === s.id) {
            // 切换到第一个会话
            switchToSession(sessions[0].id);
          } else {
            renderSessionList();
          }
        }
      });
      sessionListEl.appendChild(div);
    });
  }

  function switchToSession(sessionId) {
    const target = sessions.find(s => s.id === sessionId);
    if (!target) return;
    currentSessionId = sessionId;
    session = target.messages;   // 让全局 session 指向当前会话消息数组
    // 重置统计（可选，可以根据需求保留累计统计）
    totalPromptTokens = 0;
    totalCompletionTokens = 0;
    totalInEstimate = 0;
    totalOutEstimate = 0;
    // 重新渲染 UI
    clearUIRows();
    for (const msg of session) {
      const role = msg.role === "user" ? "user" : "assistant";
      const r = makeRow(role);
      r.bubble.textContent = msg.content;
      r.stats.textContent = "";  // 历史消息不显示统计
    }
    scrollToBottom();
    renderSessionList();
    // 如果启用了历史记忆，保存当前会话数据（已自动指向 session）
    if (historyEnabled) persistSessionIfEnabled();
  }

  function createNewSession() {
    const newId = Date.now().toString();
    const newSession = {
      id: newId,
      name: `会话 ${new Date().toLocaleString()}`,
      messages: [],
      createdAt: Date.now()
    };
    sessions.push(newSession);
    saveSessionsToStorage();
    switchToSession(newId);
    closeSessionPanelFunc();
  }

  // 兼容原有 persistSessionIfEnabled：保存当前会话到 localStorage
  function persistSessionIfEnabled() {
    if (!historyEnabled) return;
    // 更新 sessions 中的当前会话消息
    const cur = sessions.find(s => s.id === currentSessionId);
    if (cur) {
      cur.messages = session;
      saveSessionsToStorage();
    }
  }

  function restoreSessionIfEnabled() {
    // 迁移或加载多会话数据
    loadSessionsFromStorage();
    // 确定当前会话
    if (sessions.length === 0) {
      createNewSession();
    } else {
      // 默认选择第一个会话，或从 localStorage 记住上次会话
      const lastSessionId = localStorage.getItem("cfw_last_session_id");
      let target = sessions.find(s => s.id === lastSessionId);
      if (!target) target = sessions[0];
      switchToSession(target.id);
    }
  }

  // 辅助函数：转义 HTML
  function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }

  // 侧边栏开关函数
  function openSessionPanel() {
    if (sessionPanel && sessionOverlay) {
      sessionPanel.classList.add("open");
      sessionOverlay.style.display = "block";
      renderSessionList();
    }
  }
  function closeSessionPanelFunc() {
    if (sessionPanel && sessionOverlay) {
      sessionPanel.classList.remove("open");
      sessionOverlay.style.display = "none";
    }
  }

  // ========== 原有函数（estimateTokens, updateSpacer, isNearBottom, scrollToBottom, makeRow, clearUIRows 等保持不变）==========
  function estimateTokens(text){
    if (!text) return 0;
    let cjk = 0, ascii = 0;
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (ch === " " || ch === "\n" || ch === "\t" || ch === "\r") continue;
      const isCJK =
        (code >= 0x4E00 && code <= 0x9FFF) ||
        (code >= 0x3400 && code <= 0x4DBF) ||
        (code >= 0x3040 && code <= 0x30FF) ||
        (code >= 0xAC00 && code <= 0xD7AF) ||
        (code >= 0xFF00 && code <= 0xFFEF);
      if (isCJK) cjk++; else ascii++;
    }
    return cjk + Math.ceil(ascii / 4);
  }

  function updateSpacer(){
    if (!composerEl || !spacerEl) return;
    const rect = composerEl.getBoundingClientRect();
    const rootStyle = getComputedStyle(document.documentElement);
    const gap = parseFloat(rootStyle.getPropertyValue("--composer-gap")) || 18;
    const extra = parseFloat(rootStyle.getPropertyValue("--spacer-extra")) || 28;
    const h = Math.ceil(rect.height + gap + extra);
    spacerEl.style.height = h + "px";
    historyWrap.style.scrollPaddingBottom = h + "px";
  }

  function isNearBottom(){
    const threshold = 120;
    return (historyWrap.scrollHeight - historyWrap.scrollTop - historyWrap.clientHeight) < threshold;
  }
  function scrollToBottom(){
    historyWrap.scrollTo({ top: historyWrap.scrollHeight, behavior: "auto" });
  }

  function makeRow(role){
    const row = document.createElement("div");
    row.className = "row " + (role === "user" ? "user" : "ai");

    const avatar = document.createElement("div");
    avatar.className = "avatar " + (role === "user" ? "human" : "bot");
    avatar.textContent = (role === "user" ? "👤" : "🤖");  // 改用 emoji 头像

    const content = document.createElement("div");
    content.className = "content";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = (role === "user" ? "User" : "Bot");

    const bubble = document.createElement("div");
    bubble.className = "bubble " + (role === "user" ? "user" : "ai");

    const stats = document.createElement("div");
    stats.className = "stats";

    content.appendChild(meta);
    content.appendChild(bubble);
    content.appendChild(stats);

    if (role === "user") {
      row.appendChild(content);
      row.appendChild(avatar);
    } else {
      row.appendChild(avatar);
      row.appendChild(content);
    }

    chatEl.insertBefore(row, spacerEl);
    if (isNearBottom()) scrollToBottom();

    return { bubble, stats };
  }

  function clearUIRows(){
    const nodes = Array.from(chatEl.children);
    for (const n of nodes) {
      if (n === spacerEl) continue;
      chatEl.removeChild(n);
    }
  }

  function initModels(){
    modelSel.innerHTML = "";
    for (const m of MODELS) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.label;
      modelSel.appendChild(opt);
    }
    const saved = localStorage.getItem(LS_MODEL);
    modelSel.value = saved || MODELS[0].id;
    modelSel.addEventListener("change", () => {
      localStorage.setItem(LS_MODEL, modelSel.value);
    });
  }

  // ========== 主题与背景初始化（增强：二次元、上传图片、清除背景） ==========
  function initThemeAndBg() {
    const themeToggle = document.getElementById("themeToggle");
    const bgOptions = document.querySelectorAll(".bg-option");
    const customColorPicker = document.getElementById("customColorPicker");
    if (!themeToggle) return;
    
    // 背景预设映射（包括二次元）
    const bgMap = {
      gradient: "var(--bg-gradient)",
      light: "url('https://www.transparenttextures.com/patterns/cubes.png'), linear-gradient(135deg, #f9f9f9, #e0e0e0)",
      ocean: "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600') center/cover",
      forest: "url('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600') center/cover",
      anime: "url('https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600') center/cover"  // 默认二次元图片（可替换）
    };
    
    function applyBackground(type, colorValue = null, uploadedBgData = null) {
      // 清除之前的自定义背景类
      document.body.classList.remove("custom-bg", "anime-bg");
      if (type === "custom" && colorValue) {
        document.body.style.setProperty("--user-bg", colorValue);
        document.body.classList.add("custom-bg");
        localStorage.setItem(LS_BG_TYPE, "custom");
        localStorage.setItem(LS_CUSTOM_COLOR, colorValue);
        localStorage.removeItem(LS_UPLOADED_BG);
        if (customColorPicker) customColorPicker.value = colorValue;
      } 
      else if (type === "uploaded" && uploadedBgData) {
        document.body.style.setProperty("--user-bg", `url(${uploadedBgData}) center/cover fixed`);
        document.body.classList.add("custom-bg");
        localStorage.setItem(LS_BG_TYPE, "uploaded");
        localStorage.setItem(LS_UPLOADED_BG, uploadedBgData);
        localStorage.removeItem(LS_CUSTOM_COLOR);
      }
      else if (type === "anime" && bgMap.anime) {
        document.body.style.setProperty("--user-bg", bgMap.anime);
        document.body.classList.add("custom-bg", "anime-bg");
        localStorage.setItem(LS_BG_TYPE, "anime");
        localStorage.removeItem(LS_CUSTOM_COLOR);
        localStorage.removeItem(LS_UPLOADED_BG);
      }
      else if (bgMap[type]) {
        document.body.style.setProperty("--user-bg", bgMap[type]);
        document.body.classList.add("custom-bg");
        localStorage.setItem(LS_BG_TYPE, type);
        localStorage.removeItem(LS_CUSTOM_COLOR);
        localStorage.removeItem(LS_UPLOADED_BG);
      } 
      else {
        document.body.classList.remove("custom-bg");
        document.body.style.removeProperty("--user-bg");
        localStorage.removeItem(LS_BG_TYPE);
        localStorage.removeItem(LS_CUSTOM_COLOR);
        localStorage.removeItem(LS_UPLOADED_BG);
      }
      // 更新按钮激活状态
      bgOptions.forEach(btn => {
        const btnType = btn.dataset.bg;
        if (btnType === type) btn.classList.add("active");
        else btn.classList.remove("active");
      });
    }
    
    // 恢复保存的背景
    const savedTheme = localStorage.getItem(LS_THEME);
    if (savedTheme === "light") {
      document.body.classList.add("light-theme");
      themeToggle.innerHTML = "☀️ 白天模式";
    } else {
      document.body.classList.remove("light-theme");
      themeToggle.innerHTML = "🌙 黑夜模式";
    }
    
    const savedBgType = localStorage.getItem(LS_BG_TYPE);
    const savedCustomColor = localStorage.getItem(LS_CUSTOM_COLOR);
    const savedUploadedBg = localStorage.getItem(LS_UPLOADED_BG);
    if (savedBgType === "custom" && savedCustomColor) {
      applyBackground("custom", savedCustomColor);
    } else if (savedBgType === "uploaded" && savedUploadedBg) {
      applyBackground("uploaded", null, savedUploadedBg);
    } else if (savedBgType === "anime") {
      applyBackground("anime");
    } else if (savedBgType && bgMap[savedBgType]) {
      applyBackground(savedBgType);
    } else {
      applyBackground(null);
    }
    
    // 主题切换
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        const isLight = document.body.classList.toggle("light-theme");
        localStorage.setItem(LS_THEME, isLight ? "light" : "dark");
        themeToggle.innerHTML = isLight ? "☀️ 白天模式" : "🌙 黑夜模式";
      });
    }
    
    // 背景预设按钮事件
    bgOptions.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const bgType = btn.dataset.bg;
        if (bgType === "custom") {
          if (customColorPicker) customColorPicker.click();
        } else if (bgType === "anime") {
          applyBackground("anime");
        } else {
          applyBackground(bgType);
        }
      });
    });
    
    // 自定义颜色选择器
    if (customColorPicker) {
      customColorPicker.addEventListener("input", (e) => {
        applyBackground("custom", e.target.value);
      });
    }
    
    // 上传背景图片功能
    if (uploadBgBtn && bgImageFile) {
      uploadBgBtn.addEventListener("click", () => {
        bgImageFile.click();
      });
      bgImageFile.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = function(ev) {
            const base64 = ev.target.result;
            // 检查大小：localStorage 限制约5MB，base64 会更大，建议限制图片原始大小不超过1MB
            if (base64.length > 4 * 1024 * 1024) {
              alert("图片过大，请选择小于 4MB 的图片 (base64 编码后大小)");
              return;
            }
            applyBackground("uploaded", null, base64);
          };
          reader.readAsDataURL(file);
        } else {
          alert("请选择图片文件");
        }
        bgImageFile.value = ""; // 清空，允许重复上传同一文件
      });
    }

    // ========== 新增：清除背景按钮 ==========
    if (clearBgBtn) {
      clearBgBtn.addEventListener("click", () => {
        // 清除所有背景相关的 localStorage
        localStorage.removeItem(LS_BG_TYPE);
        localStorage.removeItem(LS_CUSTOM_COLOR);
        localStorage.removeItem(LS_UPLOADED_BG);
        // 移除背景相关的类
        document.body.classList.remove("custom-bg", "anime-bg");
        document.body.style.removeProperty("--user-bg");
        // 自动点击“动态渐变”按钮恢复到默认渐变背景（如果存在）
        const gradientBtn = document.querySelector('.bg-option[data-bg="gradient"]');
        if (gradientBtn) {
          gradientBtn.click();
        } else {
          // 保底：直接调用 applyBackground(null)
          applyBackground(null);
        }
      });
    }
  }

  // 人物扮演
  personaToggle.addEventListener("click", () => {
    useBuiltin = !useBuiltin;
    personaToggle.textContent = useBuiltin ? "😈" : "😇";
    localStorage.setItem(LS_USE_BUILTIN, useBuiltin ? "1" : "0");
  });

  // Settings 事件（略，保持不变）
  settingsBtn.addEventListener("click", () => {
    settingsMask.style.display = "flex";
    historyKeepEl.checked = historyEnabled;
    promptKeepEl.checked = promptEnabled;
    customPromptEl.value = (localStorage.getItem(LS_CUSTOM_PROMPT) || "");
  });
  closeSettingsBtn.addEventListener("click", () => {
    settingsMask.style.display = "none";
  });
  settingsMask.addEventListener("click", (e) => {
    if (e.target === settingsMask) settingsMask.style.display = "none";
  });

  historyKeepEl.addEventListener("change", () => {
    historyEnabled = !!historyKeepEl.checked;
    localStorage.setItem(LS_HISTORY_ENABLED, historyEnabled ? "1" : "0");
    if (historyEnabled) persistSessionIfEnabled();
  });
  clearHistoryBtn.addEventListener("click", () => {
    const ok = confirm("确定清除本地历史？\n只会删除对话记录，不会影响网页自定义人物模板。");
    if (!ok) return;
    // 清空当前会话消息
    if (currentSessionId) {
      const cur = sessions.find(s => s.id === currentSessionId);
      if (cur) {
        cur.messages = [];
        session = cur.messages;
        saveSessionsToStorage();
        clearUIRows();
        updateSpacer();
        scrollToBottom();
        renderSessionList();
      }
    }
  });

  promptKeepEl.addEventListener("change", () => {
    promptEnabled = !!promptKeepEl.checked;
    localStorage.setItem(LS_PROMPT_ENABLED, promptEnabled ? "1" : "0");
    if (!promptEnabled) localStorage.removeItem(LS_CUSTOM_PROMPT);
  });
  savePromptBtn.addEventListener("click", () => {
    const val = customPromptEl.value || "";
    if (promptEnabled) localStorage.setItem(LS_CUSTOM_PROMPT, val);
    else localStorage.removeItem(LS_CUSTOM_PROMPT);
    settingsMask.style.display = "none";
  });
  clearPromptBtn.addEventListener("click", () => {
    const ok = confirm("确定清除网页自定义人物模板？\n只会删除自定义模板，不会影响本地历史。");
    if (!ok) return;
    localStorage.removeItem(LS_CUSTOM_PROMPT);
    customPromptEl.value = "";
  });

  // donate
  function openDonate(){ donateMask.style.display = "flex"; }
  function closeDonate(){ donateMask.style.display = "none"; }
  donateBtn.addEventListener("click", openDonate);
  donateClose.addEventListener("click", closeDonate);
  donateMask.addEventListener("click", (e) => { if (e.target === donateMask) closeDonate(); });

  // composer
  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = inputEl.scrollHeight + "px";
    const stick = isNearBottom();
    updateSpacer();
    if (stick) scrollToBottom();
  });

  function setupResizeObserver(){
    if (!composerEl || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const stick = isNearBottom();
      updateSpacer();
      if (stick) scrollToBottom();
    });
    ro.observe(composerEl);
  }
  function setupViewportListener(){
    if (!window.visualViewport) return;
    window.visualViewport.addEventListener("resize", () => {
      const stick = isNearBottom();
      updateSpacer();
      if (stick) scrollToBottom();
    });
  }
  window.addEventListener("resize", () => {
    const stick = isNearBottom();
    updateSpacer();
    if (stick) scrollToBottom();
  });

  // ========== 修改后的 send 函数（支持停止生成）==========
  async function send(){
    updateSpacer();
    const text = inputEl.value.trim();
    if (!text) return;

    // 如果有正在进行的请求，先停止（安全起见）
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }

    const userRow = makeRow("user");
    userRow.bubble.textContent = text;

    const inEst = estimateTokens(text);
    totalInEstimate += inEst;
    userRow.stats.textContent = `Input(估算): ≈${inEst} | Total In(估算): ≈${totalInEstimate}`;

    session.push({ role: "user", content: text });
    persistSessionIfEnabled();

    inputEl.value = "";
    inputEl.style.height = "auto";
    updateSpacer();
    scrollToBottom();

    const aiRow = makeRow("assistant");
    let outStartMs = 0;
    let outEndMs = 0;
    let full = "";
    let exactUsage = null;
    let isAborted = false;

    let customPrompt = "";
    if (!useBuiltin && promptEnabled) {
      customPrompt = localStorage.getItem(LS_CUSTOM_PROMPT) || "";
    }

    // 创建 AbortController
    currentAbortController = new AbortController();
    if (stopBtn) stopBtn.style.display = "inline-flex";

    // 可选：显示加载动画（在气泡内添加三点指示器）
    const loadingIndicator = document.createElement("div");
    loadingIndicator.className = "typing-indicator";
    loadingIndicator.innerHTML = "<span></span><span></span><span></span>";
    aiRow.bubble.appendChild(loadingIndicator);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelSel.value,
          use_builtin_persona: useBuiltin,
          custom_system_prompt: customPrompt,
          messages: session
        }),
        signal: currentAbortController.signal
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        aiRow.bubble.textContent = `Request failed (${res.status}):\n${t}`;
        aiRow.stats.textContent = "";
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      // 移除加载指示器
      if (loadingIndicator.parentNode) loadingIndicator.remove();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.replace("data: ", "").trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.usage) exactUsage = parsed.usage;
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              if (!outStartMs) outStartMs = performance.now();
              full += delta;
              aiRow.bubble.textContent = full;
              if (isNearBottom()) scrollToBottom();
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err.name === "AbortError") {
        isAborted = true;
        if (loadingIndicator.parentNode) loadingIndicator.remove();
        aiRow.bubble.textContent = full + "\n\n[已停止生成]";
      } else {
        if (loadingIndicator.parentNode) loadingIndicator.remove();
        aiRow.bubble.textContent = `Error: ${err.message}`;
      }
    } finally {
      if (loadingIndicator.parentNode) loadingIndicator.remove();
      currentAbortController = null;
      if (stopBtn) stopBtn.style.display = "none";
    }

    outEndMs = performance.now();
    if (!isAborted && full) {
      session.push({ role: "assistant", content: full });
      persistSessionIfEnabled();
    } else if (isAborted && full) {
      // 如果停止了但有部分内容，仍然保存
      session.push({ role: "assistant", content: full });
      persistSessionIfEnabled();
    }

    const seconds = Math.max(0.001, (outEndMs - (outStartMs || outEndMs)) / 1000);

    if (exactUsage && typeof exactUsage.completion_tokens === "number") {
      const p = exactUsage.prompt_tokens || 0;
      const c = exactUsage.completion_tokens || 0;
      const t = exactUsage.total_tokens || (p + c);
      totalPromptTokens += p;
      totalCompletionTokens += c;
      const tps = c / seconds;
      aiRow.stats.textContent = `Prompt: ${p} | Completion: ${c} | Total: ${t} | Speed: ${tps.toFixed(2)} tok/s | CumPrompt: ${totalPromptTokens} | CumCompletion: ${totalCompletionTokens}`;
    } else {
      const outEst = estimateTokens(full);
      totalOutEstimate += outEst;
      const tps = outEst / seconds;
      aiRow.stats.textContent = `Output(估算): ≈${outEst} | Total Out(估算): ≈${totalOutEstimate} | Speed(估算): ${tps.toFixed(2)} tok/s | (usage未返回)`;
    }

    updateSpacer();
    scrollToBottom();
  }

  // 停止按钮事件
  if (stopBtn) {
    stopBtn.addEventListener("click", () => {
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
      }
    });
  }

  sendBtn.addEventListener("click", send);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  // 会话面板按钮事件
  if (sessionBtn) sessionBtn.addEventListener("click", openSessionPanel);
  if (closeSessionPanel) closeSessionPanel.addEventListener("click", closeSessionPanelFunc);
  if (sessionOverlay) sessionOverlay.addEventListener("click", closeSessionPanelFunc);
  if (newSessionBtn) newSessionBtn.addEventListener("click", createNewSession);

  function init(){
    initModels();
    setupResizeObserver();
    setupViewportListener();
    updateSpacer();
    restoreSessionIfEnabled();   // 加载多会话
    scrollToBottom();
    initThemeAndBg();
  }

  init();
})();
