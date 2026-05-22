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

  let currentSessionId = null;
  let sessions = [];
  let session = [];

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalInEstimate = 0;
  let totalOutEstimate = 0;

  let currentAbortController = null;

  const LS_MODEL = "cfw_model";
  const LS_USE_BUILTIN = "cfw_use_builtin";
  const LS_HISTORY_ENABLED = "cfw_history_enabled";
  const LS_CHAT_SESSION = "cfw_chat_session_v1";
  const LS_PROMPT_ENABLED = "cfw_prompt_enabled";
  const LS_CUSTOM_PROMPT = "cfw_custom_prompt_v1";
  const LS_SESSIONS = "cfw_sessions_v2";

  const LS_THEME = "cfw_theme";

  let useBuiltin =
    (localStorage.getItem(LS_USE_BUILTIN) ?? "1") === "1";

  personaToggle.textContent = useBuiltin ? "😈" : "😇";

  let historyEnabled =
    (localStorage.getItem(LS_HISTORY_ENABLED) ?? "0") === "1";

  let promptEnabled =
    (localStorage.getItem(LS_PROMPT_ENABLED) ?? "1") === "1";

  historyKeepEl.checked = historyEnabled;
  promptKeepEl.checked = promptEnabled;

  // =========================================
  // 多会话
  // =========================================

  function saveSessionsToStorage() {
    try {
      localStorage.setItem(
        LS_SESSIONS,
        JSON.stringify(sessions)
      );
    } catch (e) {}
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

            if (!s.createdAt)
              s.createdAt = Date.now();

            if (!s.name)
              s.name = "新会话";
          });

          return;
        }

      } catch (e) {}
    }

    const defaultId = Date.now().toString();

    sessions = [{
      id: defaultId,
      name: "新会话",
      messages: [],
      createdAt: Date.now()
    }];

    saveSessionsToStorage();
  }

  function switchToSession(sessionId) {

    const target = sessions.find(
      s => s.id === sessionId
    );

    if (!target) return;

    currentSessionId = sessionId;
    session = target.messages;

    clearUIRows();

    for (const msg of session) {

      const role =
        msg.role === "user"
          ? "user"
          : "assistant";

      const row = makeRow(role);

      row.bubble.textContent = msg.content;
    }

    scrollToBottom();

    localStorage.setItem(
      "cfw_last_session_id",
      sessionId
    );

    renderSessionList();
  }

  function createNewSession() {

    const id = Date.now().toString();

    const newSession = {
      id,
      name: `会话 ${sessions.length + 1}`,
      messages: [],
      createdAt: Date.now()
    };

    sessions.push(newSession);

    saveSessionsToStorage();

    switchToSession(id);

    closeSessionPanelFunc();
  }

  function persistSessionIfEnabled() {

    if (!historyEnabled) return;

    const cur = sessions.find(
      s => s.id === currentSessionId
    );

    if (cur) {

      cur.messages = session;

      saveSessionsToStorage();
    }
  }

  function restoreSessionIfEnabled() {

    loadSessionsFromStorage();

    const lastSessionId =
      localStorage.getItem(
        "cfw_last_session_id"
      );

    let target =
      sessions.find(
        s => s.id === lastSessionId
      );

    if (!target) target = sessions[0];

    switchToSession(target.id);
  }

  function renderSessionList() {

    if (!sessionListEl) return;

    sessionListEl.innerHTML = "";

    sessions.forEach(s => {

      const div = document.createElement("div");

      div.className =
        "session-item" +
        (currentSessionId === s.id
          ? " active"
          : "");

      div.innerHTML = `
        <span class="session-title">
          ${escapeHtml(s.name)}
        </span>
      `;

      div.addEventListener("click", () => {

        switchToSession(s.id);

        closeSessionPanelFunc();
      });

      sessionListEl.appendChild(div);
    });
  }

  function openSessionPanel() {

    sessionPanel.classList.add("open");

    sessionOverlay.style.display = "block";

    renderSessionList();
  }

  function closeSessionPanelFunc() {

    sessionPanel.classList.remove("open");

    sessionOverlay.style.display = "none";
  }

  // =========================================
  // 工具
  // =========================================

  function escapeHtml(str) {

    return str.replace(/[&<>]/g, m => {

      if (m === "&") return "&amp;";
      if (m === "<") return "&lt;";
      if (m === ">") return "&gt;";

      return m;
    });
  }

  function estimateTokens(text) {

    if (!text) return 0;

    return Math.ceil(text.length / 4);
  }

  function updateSpacer() {

    if (!composerEl || !spacerEl) return;

    const rect =
      composerEl.getBoundingClientRect();

    spacerEl.style.height =
      rect.height + 80 + "px";
  }

  function scrollToBottom() {

    historyWrap.scrollTo({
      top: historyWrap.scrollHeight,
      behavior: "smooth"
    });
  }

  function isNearBottom() {

    return (
      historyWrap.scrollHeight -
      historyWrap.scrollTop -
      historyWrap.clientHeight
    ) < 120;
  }

  // =========================================
  // UI Row
  // =========================================

  function makeRow(role) {

    const row = document.createElement("div");

    row.className =
      "row " +
      (role === "user" ? "user" : "ai");

    const avatar = document.createElement("div");

    avatar.className =
      "avatar " +
      (role === "user"
        ? "human"
        : "bot");

    avatar.textContent =
      role === "user" ? "U" : "AI";

    const content =
      document.createElement("div");

    content.className = "content";

    const meta =
      document.createElement("div");

    meta.className = "meta";

    meta.textContent =
      role === "user"
        ? "User"
        : "Virtual Girl";

    const bubble =
      document.createElement("div");

    bubble.className =
      "bubble " +
      (role === "user"
        ? "user"
        : "ai");

    const stats =
      document.createElement("div");

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

    return { bubble, stats };
  }

  function clearUIRows() {

    const nodes =
      Array.from(chatEl.children);

    for (const n of nodes) {

      if (n === spacerEl) continue;

      chatEl.removeChild(n);
    }
  }

  // =========================================
  // Model
  // =========================================

  function initModels() {

    modelSel.innerHTML = "";

    MODELS.forEach(m => {

      const opt =
        document.createElement("option");

      opt.value = m.id;

      opt.textContent = m.label;

      modelSel.appendChild(opt);
    });

    const saved =
      localStorage.getItem(LS_MODEL);

    modelSel.value =
      saved || MODELS[0].id;

    modelSel.addEventListener(
      "change",
      () => {

        localStorage.setItem(
          LS_MODEL,
          modelSel.value
        );
      }
    );
  }

  // =========================================
  // 二次元背景系统
  // =========================================

  function initThemeAndBg() {

    const themeToggle =
      document.getElementById(
        "themeToggle"
      );

    const animeBackgrounds = {

      morning:
        "url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1600')",

      sunset:
        "url('https://images.unsplash.com/photo-1493246507139-91e8fad9978e?q=80&w=1600')",

      night:
        "url('https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1600')"
    };

    function getAutoAnimeBg() {

      const hour = new Date().getHours();

      if (hour >= 6 && hour < 16)
        return animeBackgrounds.morning;

      if (hour >= 16 && hour < 20)
        return animeBackgrounds.sunset;

      return animeBackgrounds.night;
    }

    function applyAnimeBackground() {

      const bg = getAutoAnimeBg();

      document.body.style.backgroundImage = `
        linear-gradient(
          rgba(0,0,0,0.45),
          rgba(0,0,0,0.65)
        ),
        ${bg}
      `;

      document.body.style.backgroundSize =
        "cover";

      document.body.style.backgroundPosition =
        "center";

      document.body.style.backgroundAttachment =
        "fixed";
    }

    applyAnimeBackground();

    setInterval(
      applyAnimeBackground,
      600000
    );

    const savedTheme =
      localStorage.getItem(LS_THEME);

    if (savedTheme === "light") {

      document.body.classList.add(
        "light-theme"
      );

      themeToggle.innerHTML =
        "☀️ 白天模式";

    } else {

      document.body.classList.remove(
        "light-theme"
      );

      themeToggle.innerHTML =
        "🌙 黑夜模式";
    }

    themeToggle.addEventListener(
      "click",
      () => {

        const isLight =
          document.body.classList.toggle(
            "light-theme"
          );

        localStorage.setItem(
          LS_THEME,
          isLight ? "light" : "dark"
        );

        themeToggle.innerHTML =
          isLight
            ? "☀️ 白天模式"
            : "🌙 黑夜模式";
      }
    );

    // 鼠标视差

    document.addEventListener(
      "mousemove",
      e => {

        const x =
          (e.clientX / window.innerWidth - 0.5) * 10;

        const y =
          (e.clientY / window.innerHeight - 0.5) * 10;

        document.body.style.backgroundPosition =
          `${50 + x}% ${50 + y}%`;
      }
    );
  }

  // =========================================
  // 星空粒子
  // =========================================

  function initAnimeEffects() {

    const stars =
      document.createElement("div");

    stars.id = "anime-stars";

    document.body.appendChild(stars);

    for (let i = 0; i < 80; i++) {

      const s =
        document.createElement("span");

      s.className = "star";

      s.style.left =
        Math.random() * 100 + "%";

      s.style.top =
        Math.random() * 100 + "%";

      s.style.animationDelay =
        Math.random() * 5 + "s";

      s.style.animationDuration =
        2 + Math.random() * 3 + "s";

      stars.appendChild(s);
    }
  }

  // =========================================
  // Settings
  // =========================================

  settingsBtn.addEventListener(
    "click",
    () => {

      settingsMask.style.display =
        "flex";

      customPromptEl.value =
        localStorage.getItem(
          LS_CUSTOM_PROMPT
        ) || "";
    }
  );

  closeSettingsBtn.addEventListener(
    "click",
    () => {

      settingsMask.style.display =
        "none";
    }
  );

  // =========================================
  // Donate
  // =========================================

  donateBtn.addEventListener(
    "click",
    () => {

      donateMask.style.display =
        "flex";
    }
  );

  donateClose.addEventListener(
    "click",
    () => {

      donateMask.style.display =
        "none";
    }
  );

  // =========================================
  // 输入框
  // =========================================

  inputEl.addEventListener(
    "input",
    () => {

      inputEl.style.height = "auto";

      inputEl.style.height =
        inputEl.scrollHeight + "px";

      updateSpacer();
    }
  );

  // =========================================
  // 发送消息
  // =========================================

  async function send() {

    const text =
      inputEl.value.trim();

    if (!text) return;

    if (currentAbortController) {

      currentAbortController.abort();
    }

    const userRow = makeRow("user");

    userRow.bubble.textContent = text;

    session.push({
      role: "user",
      content: text
    });

    persistSessionIfEnabled();

    inputEl.value = "";

    inputEl.style.height = "auto";

    updateSpacer();

    scrollToBottom();

    const aiRow =
      makeRow("assistant");

    let full = "";

    currentAbortController =
      new AbortController();

    stopBtn.style.display =
      "inline-flex";

    let customPrompt = "";

    if (!useBuiltin && promptEnabled) {

      customPrompt =
        localStorage.getItem(
          LS_CUSTOM_PROMPT
        ) || "";
    }

    try {

      const res = await fetch(
        "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            model: modelSel.value,

            use_builtin_persona:
              useBuiltin,

            custom_system_prompt:
              customPrompt,

            messages: session
          }),

          signal:
            currentAbortController.signal
        }
      );

      const reader =
        res.body.getReader();

      const decoder =
        new TextDecoder();

      while (true) {

        const {
          done,
          value
        } = await reader.read();

        if (done) break;

        const chunk =
          decoder.decode(value);

        const lines =
          chunk.split("\n");

        for (const line of lines) {

          if (
            !line.startsWith(
              "data: "
            )
          ) continue;

          const jsonStr =
            line.replace(
              "data: ",
              ""
            );

          if (
            jsonStr === "[DONE]"
          ) continue;

          try {

            const parsed =
              JSON.parse(jsonStr);

            const delta =
              parsed.choices?.[0]
                ?.delta?.content;

            if (delta) {

              full += delta;

              aiRow.bubble.textContent =
                full;

              if (isNearBottom())
                scrollToBottom();
            }

          } catch {}
        }
      }

    } catch (err) {

      if (
        err.name ===
        "AbortError"
      ) {

        aiRow.bubble.textContent =
          full + "\n\n[已停止生成]";

      } else {

        aiRow.bubble.textContent =
          "Error: " + err.message;
      }

    } finally {

      currentAbortController = null;

      stopBtn.style.display =
        "none";
    }

    session.push({
      role: "assistant",
      content: full
    });

    persistSessionIfEnabled();

    updateSpacer();

    scrollToBottom();
  }

  // =========================================
  // Stop
  // =========================================

  stopBtn.addEventListener(
    "click",
    () => {

      if (
        currentAbortController
      ) {

        currentAbortController.abort();
      }
    }
  );

  // =========================================
  // Event
  // =========================================

  sendBtn.addEventListener(
    "click",
    send
  );

  inputEl.addEventListener(
    "keydown",
    e => {

      if (
        e.key === "Enter" &&
        !e.shiftKey
      ) {

        e.preventDefault();

        send();
      }
    }
  );

  if (sessionBtn)
    sessionBtn.addEventListener(
      "click",
      openSessionPanel
    );

  if (closeSessionPanel)
    closeSessionPanel.addEventListener(
      "click",
      closeSessionPanelFunc
    );

  if (sessionOverlay)
    sessionOverlay.addEventListener(
      "click",
      closeSessionPanelFunc
    );

  if (newSessionBtn)
    newSessionBtn.addEventListener(
      "click",
      createNewSession
    );

  // =========================================
  // Init
  // =========================================

  function init() {

    initModels();

    updateSpacer();

    restoreSessionIfEnabled();

    scrollToBottom();

    initThemeAndBg();

    initAnimeEffects();
  }

  init();

})();
