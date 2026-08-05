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

  // 字体缩放按钮
  const fontDecrease = document.getElementById("fontDecrease");
  const fontIncrease = document.getElementById("fontIncrease");

  // 阅读模式相关元素
  const emptyState = document.getElementById("emptyState");
  const readerBtn = document.getElementById("readerBtn");
  const readerCount = document.getElementById("readerCount");
  const readerMask = document.getElementById("readerMask");
  const readerClose = document.getElementById("readerClose");
  const readerSummary = document.getElementById("readerSummary");
  const readerSidebar = document.getElementById("readerSidebar");
  const readerSegments = document.getElementById("readerSegments");
  const readerContent = document.getElementById("readerContent");
  const readerEmpty = document.getElementById("readerEmpty");
  const readerSelectAll = document.getElementById("readerSelectAll");
  const readerClear = document.getElementById("readerClear");
  const readerCopy = document.getElementById("readerCopy");
  const readerFontDecrease = document.getElementById("readerFontDecrease");
  const readerFontIncrease = document.getElementById("readerFontIncrease");
  const readerSegmentsToggle = document.getElementById("readerSegmentsToggle");

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
  const LS_READER_SELECTIONS = "cfw_reader_selections_v1";
  const LS_READER_FONT_SIZE = "cfw_reader_font_size";

  let readerSelections = {};
  try {
    readerSelections = JSON.parse(localStorage.getItem(LS_READER_SELECTIONS) || "{}") || {};
  } catch {
    readerSelections = {};
  }

  let useBuiltin = (localStorage.getItem(LS_USE_BUILTIN) ?? "1") === "1";
  personaToggle.textContent = useBuiltin ? "😈" : "😇";

  let historyEnabled = (localStorage.getItem(LS_HISTORY_ENABLED) ?? "0") === "1";
  let promptEnabled  = (localStorage.getItem(LS_PROMPT_ENABLED) ?? "1") === "1";
  historyKeepEl.checked = historyEnabled;
  promptKeepEl.checked = promptEnabled;

  // ========== 美少女壁纸轮播 ==========
  // 🔽 在这里放置你的美少女图片（可替换为本地路径或在线URL）
  const GIRL_WALLPAPERS = [
    "/1.webp",
    "/2.jpg",
    "/3.jpg",
    "/4.jpg",
    "/5.webp",
    "/6.jpg",
  ];
  let bgIndex = 0;
  let bgInterval = null;

let preloadIndex = 0;      // 这两行变量建议放在文件顶部（靠近其他 let 变量）
let isPreloading = false;

function rotateBackground() {
  if (isPreloading) return;  // 正在预加载时，不重复触发

  const nextIndex = (bgIndex + 1) % GIRL_WALLPAPERS.length;
  const nextUrl = GIRL_WALLPAPERS[nextIndex];

  isPreloading = true;

  const img = new Image();
  img.onload = function() {
    // 更新模糊层
    const blurDiv = document.getElementById("blur-bg");
    if (blurDiv) {
      blurDiv.style.backgroundImage = `url(${nextUrl})`;
      blurDiv.style.backgroundSize = "cover";
      blurDiv.style.backgroundPosition = "center";
    }
    // 更新清晰层
    const clearDiv = document.getElementById("clear-img");
    if (clearDiv) {
      clearDiv.style.backgroundImage = `url(${nextUrl})`;
      clearDiv.style.backgroundSize = "contain";
      clearDiv.style.backgroundPosition = "center";
    }
    document.body.style.backgroundImage = "none";
    bgIndex = nextIndex;
    isPreloading = false;
  };
  img.onerror = function() {
    isPreloading = false;   // 加载失败也要释放锁
  };
  img.src = nextUrl;
}

  // ========== 动态粒子效果 ==========
  let particleCanvas, ctx, particles = [], particleAnimationId;
  function initParticleBackground() {
    particleCanvas = document.createElement('canvas');
    particleCanvas.id = "particle-canvas";
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
        this.color = `hsla(${Math.random() * 60 + 280}, 70%, 65%, ${Math.random() * 0.5 + 0.2})`;
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
      const count = Math.min(90, Math.floor(window.innerWidth / 18));
      for (let i = 0; i < count; i++) particles.push(new Particle());
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

  // ========== 主题切换（只保留黑夜/白天） ==========
  function initTheme() {
    const themeToggle = document.getElementById("themeToggle");
    const savedTheme = localStorage.getItem(LS_THEME);
    if (savedTheme === "light") {
      document.body.classList.add("light-theme");
      themeToggle.textContent = "切换深色主题";
    } else {
      document.body.classList.remove("light-theme");
      themeToggle.textContent = "切换浅色主题";
    }
    themeToggle.addEventListener("click", () => {
      const isLight = document.body.classList.toggle("light-theme");
      localStorage.setItem(LS_THEME, isLight ? "light" : "dark");
      themeToggle.textContent = isLight ? "切换深色主题" : "切换浅色主题";
    });
  }

  // ========== 字体缩放 ==========
  function initFontScale() {
    let currentFontSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chat-font-size')) || 15;
    const updateFont = (delta) => {
      let newSize = currentFontSize + delta;
      if (newSize < 12) newSize = 12;
      if (newSize > 20) newSize = 20;
      if (newSize !== currentFontSize) {
        currentFontSize = newSize;
        document.documentElement.style.setProperty('--chat-font-size', currentFontSize + 'px');
        localStorage.setItem("cfw_font_size", currentFontSize);
      }
    };
    if (fontDecrease) fontDecrease.addEventListener("click", () => updateFont(-1));
    if (fontIncrease) fontIncrease.addEventListener("click", () => updateFont(1));
    const savedFont = localStorage.getItem("cfw_font_size");
    if (savedFont) {
      currentFontSize = parseFloat(savedFont);
      document.documentElement.style.setProperty('--chat-font-size', currentFontSize + 'px');
    }
  }

  // ========== 小说阅读模式（仅使用当前浏览器中的会话内容） ==========
  function getAssistantSegments() {
    return session
      .map((message, index) => ({ message, index }))
      .filter(({ message }) => message?.role === "assistant" && typeof message.content === "string" && message.content.trim());
  }

  function getReaderSelection() {
    const available = getAssistantSegments().map(({ index }) => index);
    const saved = readerSelections[currentSessionId];
    if (!Array.isArray(saved)) return new Set(available);
    return new Set(saved.filter(index => available.includes(index)));
  }

  function saveReaderSelection(selection) {
    if (!currentSessionId) return;
    readerSelections[currentSessionId] = Array.from(selection).sort((a, b) => a - b);
    try { localStorage.setItem(LS_READER_SELECTIONS, JSON.stringify(readerSelections)); } catch {}
  }

  function removeReaderSelectionForSession(sessionId) {
    if (!sessionId || !Object.prototype.hasOwnProperty.call(readerSelections, sessionId)) return;
    delete readerSelections[sessionId];
    try { localStorage.setItem(LS_READER_SELECTIONS, JSON.stringify(readerSelections)); } catch {}
  }

  function updateReaderCount() {
    const count = getReaderSelection().size;
    readerCount.textContent = String(count);
    readerBtn.disabled = getAssistantSegments().length === 0;
  }

  function syncReaderToggleButtons() {
    const selection = getReaderSelection();
    chatEl.querySelectorAll(".reader-toggle[data-message-index]").forEach(button => {
      const index = Number(button.dataset.messageIndex);
      const selected = selection.has(index);
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.textContent = selected ? "已加入阅读" : "加入阅读";
    });
  }

  function setReaderSegmentSelected(messageIndex, selected) {
    const selection = getReaderSelection();
    if (selected) selection.add(messageIndex);
    else selection.delete(messageIndex);
    saveReaderSelection(selection);
    syncReaderToggleButtons();
    updateReaderCount();
  }

  function attachReaderControl(rowParts, messageIndex) {
    if (!rowParts?.tools || !Number.isInteger(messageIndex)) return;
    const existing = rowParts.tools.querySelector(".reader-toggle");
    if (existing) existing.remove();
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reader-toggle";
    button.dataset.messageIndex = String(messageIndex);
    button.addEventListener("click", () => {
      const selected = !getReaderSelection().has(messageIndex);
      setReaderSegmentSelected(messageIndex, selected);
    });
    rowParts.tools.appendChild(button);
    syncReaderToggleButtons();
  }

  function renderReader() {
    const segments = getAssistantSegments();
    const selection = getReaderSelection();
    const selectedSegments = segments.filter(({ index }) => selection.has(index));

    readerSegments.innerHTML = "";
    readerContent.innerHTML = "";

    segments.forEach(({ message, index }, position) => {
      const label = document.createElement("label");
      label.className = "reader-segment-item" + (selection.has(index) ? " selected" : "");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selection.has(index);
      checkbox.addEventListener("change", () => {
        setReaderSegmentSelected(index, checkbox.checked);
        renderReader();
      });

      const copy = document.createElement("span");
      copy.className = "reader-segment-copy";
      const title = document.createElement("strong");
      title.textContent = `片段 ${String(position + 1).padStart(2, "0")}`;
      const preview = document.createElement("span");
      preview.textContent = message.content.replace(/\s+/g, " ").trim().slice(0, 140);
      copy.appendChild(title);
      copy.appendChild(preview);
      label.appendChild(checkbox);
      label.appendChild(copy);
      readerSegments.appendChild(label);
    });

    selectedSegments.forEach(({ message }, position) => {
      const chapter = document.createElement("section");
      chapter.className = "reader-chapter";
      const chapterLabel = document.createElement("div");
      chapterLabel.className = "reader-chapter-label";
      chapterLabel.textContent = `片段 ${String(position + 1).padStart(2, "0")}`;
      const text = document.createElement("p");
      text.className = "reader-chapter-text";
      text.textContent = message.content;
      chapter.appendChild(chapterLabel);
      chapter.appendChild(text);
      readerContent.appendChild(chapter);
    });

    const charCount = selectedSegments.reduce((sum, item) => sum + item.message.content.length, 0);
    readerSummary.textContent = `${selectedSegments.length} 个片段 · ${charCount.toLocaleString()} 字`;
    readerEmpty.classList.toggle("visible", selectedSegments.length === 0);
    readerContent.hidden = selectedSegments.length === 0;
    readerCopy.disabled = selectedSegments.length === 0;
    syncReaderToggleButtons();
    updateReaderCount();
  }

  function openReader() {
    renderReader();
    readerMask.classList.add("open");
    document.body.classList.add("reader-open");
    readerSidebar.classList.remove("open");
  }

  function closeReader() {
    readerMask.classList.remove("open");
    document.body.classList.remove("reader-open");
    readerSidebar.classList.remove("open");
  }

  function setAllReaderSegments(selected) {
    const selection = selected
      ? new Set(getAssistantSegments().map(({ index }) => index))
      : new Set();
    saveReaderSelection(selection);
    renderReader();
  }

  function initReaderMode() {
    let readerFontSize = Number(localStorage.getItem(LS_READER_FONT_SIZE)) || 19;
    const applyReaderFontSize = () => {
      readerFontSize = Math.max(15, Math.min(28, readerFontSize));
      document.documentElement.style.setProperty("--reader-font-size", `${readerFontSize}px`);
      localStorage.setItem(LS_READER_FONT_SIZE, String(readerFontSize));
    };
    applyReaderFontSize();

    readerBtn.addEventListener("click", openReader);
    readerClose.addEventListener("click", closeReader);
    readerSelectAll.addEventListener("click", () => setAllReaderSegments(true));
    readerClear.addEventListener("click", () => setAllReaderSegments(false));
    readerSegmentsToggle.addEventListener("click", () => readerSidebar.classList.toggle("open"));
    readerFontDecrease.addEventListener("click", () => { readerFontSize -= 1; applyReaderFontSize(); });
    readerFontIncrease.addEventListener("click", () => { readerFontSize += 1; applyReaderFontSize(); });
    readerCopy.addEventListener("click", async () => {
      const selection = getReaderSelection();
      const text = getAssistantSegments()
        .filter(({ index }) => selection.has(index))
        .map(({ message }) => message.content)
        .join("\n\n");
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        readerCopy.textContent = "已复制";
        setTimeout(() => { readerCopy.textContent = "复制全文"; }, 1400);
      } catch {
        readerCopy.textContent = "复制失败";
        setTimeout(() => { readerCopy.textContent = "复制全文"; }, 1400);
      }
    });
    updateReaderCount();
  }

  // ========== 多会话管理函数（保持不变） ==========
  function saveSessionsToStorage() {
    try { localStorage.setItem(LS_SESSIONS, JSON.stringify(sessions)); } catch(e) {}
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
    // 迁移旧数据略...
    if (!sessions.length) {
      sessions = [{ id: Date.now().toString(), name: "新会话", messages: [], createdAt: Date.now() }];
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
          <button class="rename-session" data-id="${s.id}" title="重命名" aria-label="重命名会话">重</button>
          <button class="delete-session" data-id="${s.id}" title="删除" aria-label="删除会话">删</button>
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
        if (sessions.length === 1) { alert("至少保留一个会话"); return; }
        if (confirm(`确定删除会话“${s.name}”吗？`)) {
          const idx = sessions.findIndex(ss => ss.id === s.id);
          if (idx !== -1) {
            sessions.splice(idx, 1);
            removeReaderSelectionForSession(s.id);
          }
          saveSessionsToStorage();
          if (currentSessionId === s.id) switchToSession(sessions[0].id);
          else renderSessionList();
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
    totalPromptTokens = totalCompletionTokens = totalInEstimate = totalOutEstimate = 0;
    clearUIRows();
    session.forEach((msg, index) => {
      const role = msg.role === "user" ? "user" : "assistant";
      const r = makeRow(role, role === "assistant" ? index : null);
      r.bubble.textContent = msg.content;
      r.stats.textContent = "";
    });
    updateEmptyState();
    updateReaderCount();
    scrollToBottom();
    renderSessionList();
    if (historyEnabled) persistSessionIfEnabled();
  }
  function createNewSession() {
    const newId = Date.now().toString();
    sessions.push({ id: newId, name: `会话 ${new Date().toLocaleString()}`, messages: [], createdAt: Date.now() });
    saveSessionsToStorage();
    switchToSession(newId);
    closeSessionPanelFunc();
  }
  function persistSessionIfEnabled() {
    if (!historyEnabled) return;
    const cur = sessions.find(s => s.id === currentSessionId);
    if (cur) { cur.messages = session; saveSessionsToStorage(); }
  }
  function restoreSessionIfEnabled() {
    loadSessionsFromStorage();
    if (sessions.length === 0) createNewSession();
    else switchToSession(sessions[0].id);
  }
  function escapeHtml(str) { return str.replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m])); }
  function openSessionPanel() { sessionPanel.classList.add("open"); sessionOverlay.style.display = "block"; renderSessionList(); }
  function closeSessionPanelFunc() { sessionPanel.classList.remove("open"); sessionOverlay.style.display = "none"; }

  // ========== 辅助函数 ==========
  function estimateTokens(text) {
    if (!text) return 0;
    let cjk = 0, ascii = 0;
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (ch === " " || ch === "\n") continue;
      const isCJK = (code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3400 && code <= 0x4DBF);
      if (isCJK) cjk++; else ascii++;
    }
    return cjk + Math.ceil(ascii / 4);
  }
  function updateSpacer() {
    if (!composerEl || !spacerEl) return;
    const rect = composerEl.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--composer-gap")) || 18;
    const extra = 28;
    spacerEl.style.height = Math.ceil(rect.height + gap + extra) + "px";
    historyWrap.style.scrollPaddingBottom = spacerEl.style.height;
  }
  function isNearBottom() {
    return (historyWrap.scrollHeight - historyWrap.scrollTop - historyWrap.clientHeight) < 120;
  }
  function scrollToBottom() {
    historyWrap.scrollTo({ top: historyWrap.scrollHeight, behavior: "auto" });
  }
  function updateEmptyState() {
    if (!emptyState) return;
    emptyState.classList.toggle("hidden", chatEl.querySelector(".row") !== null);
  }
  function makeRow(role, messageIndex = null) {
    const row = document.createElement("div");
    row.className = "row " + (role === "user" ? "user" : "ai");
    const avatar = document.createElement("div");
    avatar.className = "avatar " + (role === "user" ? "human" : "bot");
    avatar.textContent = role === "user" ? "你" : "AI";
    const content = document.createElement("div");
    content.className = "content";
    const metaLine = document.createElement("div");
    metaLine.className = "meta-line";
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = role === "user" ? "你" : "AI";
    const tools = document.createElement("div");
    tools.className = "message-tools";
    const bubble = document.createElement("div");
    bubble.className = "bubble " + (role === "user" ? "user" : "ai");
    const stats = document.createElement("div");
    stats.className = "stats";
    metaLine.appendChild(meta);
    if (role !== "user") metaLine.appendChild(tools);
    content.appendChild(metaLine);
    content.appendChild(bubble);
    content.appendChild(stats);
    if (role === "user") { row.appendChild(content); row.appendChild(avatar); }
    else { row.appendChild(avatar); row.appendChild(content); }
    chatEl.insertBefore(row, spacerEl);
    updateEmptyState();
    const rowParts = { row, bubble, stats, tools };
    if (role !== "user" && Number.isInteger(messageIndex)) attachReaderControl(rowParts, messageIndex);
    if (isNearBottom()) scrollToBottom();
    return rowParts;
  }
  function clearUIRows() {
    const nodes = Array.from(chatEl.children);
    for (const n of nodes) if (n !== spacerEl && n !== emptyState) chatEl.removeChild(n);
    updateEmptyState();
  }
  function initModels() {
    modelSel.innerHTML = "";
    for (const m of MODELS) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.label;
      modelSel.appendChild(opt);
    }
    const saved = localStorage.getItem(LS_MODEL);
    if (saved) modelSel.value = saved;
    modelSel.addEventListener("change", () => localStorage.setItem(LS_MODEL, modelSel.value));
  }

  // ========== 发送消息（支持停止生成） ==========
  async function send() {
    updateSpacer();
    const text = inputEl.value.trim();
    if (!text) return;
    if (currentAbortController) currentAbortController.abort();

    const userRow = makeRow("user");
    userRow.bubble.textContent = text;
    const inEst = estimateTokens(text);
    totalInEstimate += inEst;
    userRow.stats.textContent = `Input(估算): ≈${inEst} | Total In: ≈${totalInEstimate}`;
    session.push({ role: "user", content: text });
    persistSessionIfEnabled();
    inputEl.value = "";
    inputEl.style.height = "auto";
    updateSpacer();
    scrollToBottom();

    const aiRow = makeRow("assistant");
    let full = "";
    let exactUsage = null;
    let isAborted = false;
    let customPrompt = "";
    if (!useBuiltin && promptEnabled) customPrompt = localStorage.getItem(LS_CUSTOM_PROMPT) || "";

    currentAbortController = new AbortController();
    stopBtn.style.display = "inline-flex";

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      loadingIndicator.remove();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.usage) exactUsage = parsed.usage;
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              full += delta;
              aiRow.bubble.textContent = full;
              if (isNearBottom()) scrollToBottom();
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err.name === "AbortError") { isAborted = true; aiRow.bubble.textContent = full + "\n\n[已停止]"; }
      else { aiRow.bubble.textContent = `错误: ${err.message}`; }
      if (loadingIndicator.parentNode) loadingIndicator.remove();
    } finally {
      if (loadingIndicator.parentNode) loadingIndicator.remove();
      currentAbortController = null;
      stopBtn.style.display = "none";
    }
    if (full && !isAborted) {
      session.push({ role: "assistant", content: full });
      const messageIndex = session.length - 1;
      const savedSelection = readerSelections[currentSessionId];
      if (Array.isArray(savedSelection) && savedSelection.length > 0) {
        const selection = new Set(savedSelection);
        selection.add(messageIndex);
        saveReaderSelection(selection);
      }
      attachReaderControl(aiRow, messageIndex);
      updateReaderCount();
      persistSessionIfEnabled();
    }
    if (exactUsage) {
      totalPromptTokens += exactUsage.prompt_tokens || 0;
      totalCompletionTokens += exactUsage.completion_tokens || 0;
      aiRow.stats.textContent = `Prompt:${exactUsage.prompt_tokens||0} Comp:${exactUsage.completion_tokens||0} | CumPrompt:${totalPromptTokens} CumComp:${totalCompletionTokens}`;
    } else {
      const outEst = estimateTokens(full);
      totalOutEstimate += outEst;
      aiRow.stats.textContent = `Output估算:≈${outEst} | Total Out:≈${totalOutEstimate}`;
    }
    updateSpacer();
    scrollToBottom();
  }

  // 停止按钮
  stopBtn.addEventListener("click", () => { if (currentAbortController) currentAbortController.abort(); });
  sendBtn.addEventListener("click", send);
  inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });

  // 事件绑定
  personaToggle.addEventListener("click", () => {
    useBuiltin = !useBuiltin;
    personaToggle.textContent = useBuiltin ? "😈" : "😇";
    localStorage.setItem(LS_USE_BUILTIN, useBuiltin ? "1" : "0");
  });
  settingsBtn.addEventListener("click", () => {
    settingsMask.style.display = "flex";
    historyKeepEl.checked = historyEnabled;
    promptKeepEl.checked = promptEnabled;
    customPromptEl.value = localStorage.getItem(LS_CUSTOM_PROMPT) || "";
  });
  closeSettingsBtn.addEventListener("click", () => settingsMask.style.display = "none");
  settingsMask.addEventListener("click", (e) => { if (e.target === settingsMask) settingsMask.style.display = "none"; });
  historyKeepEl.addEventListener("change", () => {
    historyEnabled = historyKeepEl.checked;
    localStorage.setItem(LS_HISTORY_ENABLED, historyEnabled ? "1" : "0");
    if (historyEnabled) persistSessionIfEnabled();
  });
  clearHistoryBtn.addEventListener("click", () => {
    if (confirm("清除当前会话历史？")) {
      const cur = sessions.find(s => s.id === currentSessionId);
      if (cur) {
        cur.messages = [];
        session = cur.messages;
        removeReaderSelectionForSession(currentSessionId);
        saveSessionsToStorage();
        clearUIRows();
        updateReaderCount();
        updateSpacer();
        scrollToBottom();
        renderSessionList();
      }
    }
  });
  promptKeepEl.addEventListener("change", () => {
    promptEnabled = promptKeepEl.checked;
    localStorage.setItem(LS_PROMPT_ENABLED, promptEnabled ? "1" : "0");
    if (!promptEnabled) localStorage.removeItem(LS_CUSTOM_PROMPT);
  });
  savePromptBtn.addEventListener("click", () => {
    if (promptEnabled) localStorage.setItem(LS_CUSTOM_PROMPT, customPromptEl.value);
    settingsMask.style.display = "none";
  });
  clearPromptBtn.addEventListener("click", () => {
    if (confirm("清除自定义模板？")) { localStorage.removeItem(LS_CUSTOM_PROMPT); customPromptEl.value = ""; }
  });
  donateBtn.addEventListener("click", () => donateMask.style.display = "flex");
  donateClose.addEventListener("click", () => donateMask.style.display = "none");
  donateMask.addEventListener("click", (e) => { if (e.target === donateMask) donateMask.style.display = "none"; });

  // 会话面板
  sessionBtn.addEventListener("click", openSessionPanel);
  closeSessionPanel.addEventListener("click", closeSessionPanelFunc);
  sessionOverlay.addEventListener("click", closeSessionPanelFunc);
  newSessionBtn.addEventListener("click", createNewSession);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (readerMask.classList.contains("open")) closeReader();
    else if (settingsMask.style.display === "flex") settingsMask.style.display = "none";
    else if (donateMask.style.display === "flex") donateMask.style.display = "none";
    else closeSessionPanelFunc();
  });

  // 输入框自适应
  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = inputEl.scrollHeight + "px";
    const stick = isNearBottom();
    updateSpacer();
    if (stick) scrollToBottom();
  });
  function setupResizeObserver() {
    if (!composerEl || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { const stick = isNearBottom(); updateSpacer(); if (stick) scrollToBottom(); });
    ro.observe(composerEl);
  }
  window.addEventListener("resize", () => { const stick = isNearBottom(); updateSpacer(); if (stick) scrollToBottom(); });

  // 初始化
  function init() {
    initModels();
    setupResizeObserver();
    updateSpacer();
    restoreSessionIfEnabled();
    scrollToBottom();
    initTheme();
    initFontScale();
    initReaderMode();
    rotateBackground();
    bgInterval = setInterval(rotateBackground, 30000);
    initParticleBackground();
  }
  init();
})();
