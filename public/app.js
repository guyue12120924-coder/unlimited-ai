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
  const stopBtn = document.getElementById("stopBtn");

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

  const MODELS = (window.APP_MODELS || [
    { id: "deepseek-ai/deepseek-v4-pro", label: "deepseek-v4-pro" },
    { id: "z-ai/glm-5.1", label: "glm-5.1" },
    { id: "openai/gpt-oss-120b", label: "gpt-oss-120b" },
  ]);

  // 当前活跃会话的ID和消息数组
  let currentSessionId = null;
  let sessions = [];
  let session = [];

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalInEstimate = 0;
  let totalOutEstimate = 0;

  let currentAbortController = null;

  // ====== 本地存储 Key ======
  const LS_MODEL = "cfw_model";
  const LS_USE_BUILTIN = "cfw_use_builtin";
  const LS_HISTORY_ENABLED = "cfw_history_enabled";
  const LS_PROMPT_ENABLED = "cfw_prompt_enabled";
  const LS_CUSTOM_PROMPT = "cfw_custom_prompt_v1";
  const LS_SESSIONS = "cfw_sessions_v2";
  const LS_THEME = "cfw_theme";

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
          sessions.forEach(s => {
            if (!s.messages) s.messages = [];
            if (!s.createdAt) s.createdAt = Date.now();
            if (!s.name) s.name = `会话 ${new Date(s.createdAt).toLocaleString()}`;
          });
          return;
        }
      } catch(e) {}
    }
    // 如果没有会话，创建一个默认会话
    if (!sessions.length) {
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
    session = target.messages;
    totalPromptTokens = 0;
    totalCompletionTokens = 0;
    totalInEstimate = 0;
    totalOutEstimate = 0;
    clearUIRows();
    for (const msg of session) {
      const role = msg.role === "user" ? "user" : "assistant";
      const r = makeRow(role);
      r.bubble.textContent = msg.content;
      r.stats.textContent = "";
    }
    scrollToBottom();
    renderSessionList();
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

  function persistSessionIfEnabled() {
    if (!historyEnabled) return;
    const cur = sessions.find(s => s.id === currentSessionId);
    if (cur) {
      cur.messages = session;
      saveSessionsToStorage();
    }
  }

  function restoreSessionIfEnabled() {
    loadSessionsFromStorage();
    if (sessions.length === 0) {
      createNewSession();
    } else {
      const lastSessionId = localStorage.getItem("cfw_last_session_id");
      let target = sessions.find(s => s.id === lastSessionId);
      if (!target) target = sessions[0];
      switchToSession(target.id);
    }
  }

  function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }

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

  // ========== 原有辅助函数 ==========
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
    avatar.textContent = (role === "user" ? "👤" : "🤖");

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

  // ========== 美少女壁纸轮换 (高清图片池) ==========
  const GIRL_WALLPAPERS = [
    "https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=1600",
    "https://images.pexels.com/photos/3812380/pexels-photo-3812380.jpeg?auto=compress&cs=tinysrgb&w=1600",
    "https://images.pexels.com/photos/2269872/pexels-photo-2269872.jpeg?auto=compress&cs=tinysrgb&w=1600",
    "https://images.pexels.com/photos/2361597/pexels-photo-2361597.jpeg?auto=compress&cs=tinysrgb&w=1600",
    "https://images.pexels.com/photos/3246585/pexels-photo-3246585.jpeg?auto=compress&cs=tinysrgb&w=1600",
    "https://images.pexels.com/photos/4031623/pexels-photo-4031623.jpeg?auto=compress&cs=tinysrgb&w=1600"
  ];
  let bgIndex = 0;
  let bgInterval = null;

  function rotateBackground() {
    const nextUrl = GIRL_WALLPAPERS[bgIndex % GIRL_WALLPAPERS.length];
    document.body.style.backgroundImage = `url(${nextUrl})`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center center";
    document.body.style.backgroundAttachment = "fixed";
    bgIndex = (bgIndex + 1) % GIRL_WALLPAPERS.length;
  }

  // ========== 粒子效果（动态萤火粒子） ==========
  let particleCanvas, ctx, particles = [], particleAnimationId;
  function initParticleBackground() {
    particleCanvas = document.createElement('canvas');
    particleCanvas.id = "particle-canvas";
    particleCanvas.style.position = "fixed";
    particleCanvas.style.top = "0";
    particleCanvas.style.left = "0";
    particleCanvas.style.width = "100%";
    particleCanvas.style.height = "100%";
    particleCanvas.style.pointerEvents = "none";
    particleCanvas.style.zIndex = "1";
    document.body.appendChild(particleCanvas);
    ctx = particleCanvas.getContext("2d");
    
    function resizeCanvas() {
      particleCanvas.width = window.innerWidth;
      particleCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', () => {
      resizeCanvas();
      initParticles();
    });
    resizeCanvas();
    
    class Particle {
      constructor() {
        this.x = Math.random() * particleCanvas.width;
        this.y = Math.random() * particleCanvas.height;
        this.size = Math.random() * 3 + 1.2;
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.speedY = (Math.random() - 0.5) * 0.4 + 0.15;
        const hue = Math.random() * 60 + 280; // 紫红色系
        this.color = `hsla(${hue}, 70%, 65%, ${Math.random() * 0.5 + 0.2})`;
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0) this.x = particleCanvas.width;
        if (this.x > particleCanvas.width) this.x = 0;
        if (this.y < 0) this.y = particleCanvas.height;
        if (this.y > particleCanvas.height) this.y = 0;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#f0a3ff";
        ctx.fill();
      }
    }
    
    function initParticles() {
      particles = [];
      const particleCount = Math.min(90, Math.floor(window.innerWidth / 18));
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    }
    
    function animateParticles() {
      if (!ctx) return;
      ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
      ctx.shadowBlur = 6;
      for (let p of particles) {
        p.update();
        p.draw();
      }
      particleAnimationId = requestAnimationFrame(animateParticles);
    }
    
    initParticles();
    animateParticles();
  }

  // ========== 主题切换（白天/黑夜） ==========
  function initTheme() {
    const themeToggle = document.getElementById("themeToggle");
    if (!themeToggle) return;
    const savedTheme = localStorage.getItem(LS_THEME);
    if (savedTheme === "light") {
      document.body.classList.add("light-theme");
      themeToggle.innerHTML = "☀️ 白天模式";
    } else {
      document.body.classList.remove("light-theme");
      themeToggle.innerHTML = "🌙 黑夜模式";
    }
    themeToggle.addEventListener("click", () => {
      const isLight = document.body.classList.toggle("light-theme");
      localStorage.setItem(LS_THEME, isLight ? "light" : "dark");
      themeToggle.innerHTML = isLight ? "☀️ 白天模式" : "🌙 黑夜模式";
    });
  }

  // ========== 人物扮演 ==========
  personaToggle.addEventListener("click", () => {
    useBuiltin = !useBuiltin;
    personaToggle.textContent = useBuiltin ? "😈" : "😇";
    localStorage.setItem(LS_USE_BUILTIN, useBuiltin ? "1" : "0");
  });

  // ========== Settings 事件 ==========
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

  // composer 自适应
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

  // ========== 发送消息（支持停止生成） ==========
  async function send(){
    updateSpacer();
    const text = inputEl.value.trim();
    if (!text) return;

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

    currentAbortController = new AbortController();
    if (stopBtn) stopBtn.style.display = "inline-flex";

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

  if (sessionBtn) sessionBtn.addEventListener("click", openSessionPanel);
  if (closeSessionPanel) closeSessionPanel.addEventListener("click", closeSessionPanelFunc);
  if (sessionOverlay) sessionOverlay.addEventListener("click", closeSessionPanelFunc);
  if (newSessionBtn) newSessionBtn.addEventListener("click", createNewSession);

  function init(){
    initModels();
    setupResizeObserver();
    setupViewportListener();
    updateSpacer();
    restoreSessionIfEnabled();
    scrollToBottom();
    initTheme();
    // 启动美少女壁纸轮换（首次立即设置，然后每隔12秒切换）
    rotateBackground();
    bgInterval = setInterval(rotateBackground, 12000);
    // 启动粒子效果
    initParticleBackground();
  }

  init();
})();
