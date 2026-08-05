// Local-first creative workspace. This file never changes API payloads or prompts.
(() => {
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LS_SESSIONS = "cfw_sessions_v2";
  const LS_READER_SELECTIONS = "cfw_reader_selections_v1";
  const LS_READER_TITLES = "cfw_reader_titles_v1";
  const LS_READER_ORDER = "cfw_reader_order_v1";
  const LS_MESSAGE_CATEGORIES = "cfw_message_categories_v1";

  const DEFAULT_PROJECT = {
    id: "project-default",
    name: "我的小说",
    description: "",
    color: "moss",
    sessionIds: [],
    chapters: [],
    synopsis: "",
    outline: "",
    characters: [],
    world: "",
    notes: "",
    timeline: "",
    foreshadow: "",
    scenes: [],
    snapshots: [],
    dailyGoal: 2000,
    createdAt: Date.now()
  };

  const state = loadState();
  let activeTab = "draft";
  let sessionSearch = "";
  let commandQuery = "";
  let commandIndex = 0;
  let promptHistoryIndex = -1;
  let promptDraftBeforeHistory = "";
  let navigatingPromptHistory = false;
  let observedSessionId = null;
  let readerEnhanceQueued = false;
  let focusTimerId = null;
  let focusRemaining = 25 * 60;
  let focusRunning = false;
  let focusPreviousPanels = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadState() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS_STUDIO) || "null"); } catch {}
    const next = saved && typeof saved === "object" ? saved : {};
    next.projects = Array.isArray(next.projects) && next.projects.length
      ? next.projects
      : [clone(DEFAULT_PROJECT)];
    next.projects = next.projects.map(project => {
      const normalized = { ...clone(DEFAULT_PROJECT), ...project };
      normalized.scenes = Array.isArray(normalized.scenes) ? normalized.scenes : [];
      normalized.snapshots = Array.isArray(normalized.snapshots) ? normalized.snapshots : [];
      return normalized;
    });
    next.activeProjectId = next.projects.some(project => project.id === next.activeProjectId)
      ? next.activeProjectId
      : next.projects[0].id;
    next.activeChapterId = next.activeChapterId || null;
    next.favorites = Array.isArray(next.favorites) ? next.favorites : [];
    next.recentSessions = Array.isArray(next.recentSessions) ? next.recentSessions : [];
    next.drafts = next.drafts && typeof next.drafts === "object" ? next.drafts : {};
    next.promptHistory = next.promptHistory && typeof next.promptHistory === "object" ? next.promptHistory : {};
    next.scrollPositions = next.scrollPositions && typeof next.scrollPositions === "object" ? next.scrollPositions : {};
    next.settings = {
      motion: "full",
      clickFx: true,
      spotlight: true,
      backgroundDim: 48,
      focusMinutes: 25,
      ...next.settings
    };
    return next;
  }

  function saveState() {
    try { localStorage.setItem(LS_STUDIO, JSON.stringify(state)); } catch {}
  }

  function getSessions() {
    try {
      const sessions = JSON.parse(localStorage.getItem(LS_SESSIONS) || "[]");
      return Array.isArray(sessions) ? sessions : [];
    } catch {
      return [];
    }
  }

  function getCurrentSessionId() {
    return document.querySelector("#sessionList .session-item.active .session-title")?.dataset.id
      || getSessions()[0]?.id
      || null;
  }

  function getCurrentSession() {
    const id = getCurrentSessionId();
    return getSessions().find(session => session.id === id) || null;
  }

  function getActiveProject() {
    return state.projects.find(project => project.id === state.activeProjectId) || state.projects[0];
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[char]));
  }

  function ensureSessionAssignments() {
    const sessions = getSessions();
    const known = new Set(state.projects.flatMap(project => project.sessionIds));
    const active = getActiveProject();
    sessions.forEach(session => {
      if (!known.has(session.id)) active.sessionIds.push(session.id);
    });
    state.projects.forEach(project => {
      project.sessionIds = project.sessionIds.filter(id => sessions.some(session => session.id === id));
    });
    saveState();
  }

  function createWorkspace() {
    const app = document.getElementById("app");
    const history = document.getElementById("history");
    const composer = document.querySelector(".input-floating");
    if (!app || !history || !composer || document.getElementById("creativeWorkspace")) return;

    const workspace = document.createElement("div");
    workspace.id = "creativeWorkspace";
    workspace.innerHTML = `
      <aside id="studioLibrary" aria-label="作品与章节">
        <div class="studio-panel-head">
          <div><span class="studio-kicker">LIBRARY</span><strong>创作书架</strong></div>
          <button class="studio-icon-btn" id="collapseLibrary" type="button" title="收起书架">‹</button>
        </div>
        <div class="project-switcher">
          <select id="projectSelect" aria-label="选择小说项目"></select>
          <button class="studio-icon-btn" id="renameProject" type="button" title="重命名当前项目">改</button>
          <button class="studio-icon-btn" id="addProject" type="button" title="新建小说项目">+</button>
        </div>
        <div class="inline-create" id="projectCreateRow" hidden>
          <input id="projectNameInput" maxlength="40" placeholder="小说名称" />
          <button type="button" id="confirmProject">创建</button>
        </div>
        <label class="studio-search"><span>搜索</span><input id="sessionSearch" placeholder="会话或章节" /></label>
        <section class="library-section">
          <div class="library-title"><span>会话</span><button id="studioNewSession" type="button">新建</button></div>
          <div id="studioSessionList" class="studio-list"></div>
        </section>
        <section class="library-section chapter-section">
          <div class="library-title"><span>章节</span><button id="addChapter" type="button">添加</button></div>
          <div class="inline-create" id="chapterCreateRow" hidden>
            <input id="chapterNameInput" maxlength="60" placeholder="章节名称" />
            <button type="button" id="confirmChapter">保存</button>
          </div>
          <div id="studioChapterList" class="studio-list"></div>
        </section>
        <div class="library-footer">
          <button id="backupWorkspace" type="button">导出备份</button>
          <button id="restoreWorkspace" type="button">导入</button>
          <input id="restoreWorkspaceFile" type="file" accept="application/json" hidden />
        </div>
      </aside>
      <section id="conversationPane" aria-label="AI 对话"></section>
      <aside id="studioPanel" aria-label="创作工作台">
        <div class="studio-panel-head">
          <div><span class="studio-kicker">STORY DESK</span><strong id="studioProjectTitle">创作台</strong></div>
          <button class="studio-icon-btn" id="collapseStudio" type="button" title="收起创作台">›</button>
        </div>
        <div class="studio-tabs" role="tablist">
          <button data-studio-tab="draft" class="active" type="button">正文</button>
          <button data-studio-tab="outline" type="button">大纲</button>
          <button data-studio-tab="characters" type="button">人物</button>
          <button data-studio-tab="world" type="button">设定</button>
          <button data-studio-tab="scenes" type="button">场景</button>
          <button data-studio-tab="notes" type="button">便签</button>
          <button data-studio-tab="stats" type="button">统计</button>
        </div>
        <div id="studioPanelBody"></div>
      </aside>`;

    app.insertBefore(workspace, history);
    const conversation = workspace.querySelector("#conversationPane");
    conversation.append(history, composer);
    conversation.insertAdjacentHTML("afterbegin", `<div id="conversationSearchBar" hidden><input id="conversationSearchInput" placeholder="搜索当前对话" /><span id="conversationSearchCount">0</span><button id="closeConversationSearch" type="button" aria-label="关闭搜索">×</button></div>`);
    addTopbarTools();
    addGlobalLayers();
    addReaderTools();
  }

  function addTopbarTools() {
    const controls = document.querySelector(".topbar-actions") || document.querySelector(".topbar-inner");
    if (!controls || document.getElementById("commandBtn")) return;
    const fragment = document.createDocumentFragment();
    const libraryButton = document.createElement("button");
    libraryButton.id = "libraryToggleBtn";
    libraryButton.className = "studio-top-btn";
    libraryButton.type = "button";
    libraryButton.textContent = "书架";
    const studioButton = document.createElement("button");
    studioButton.id = "studioToggleBtn";
    studioButton.className = "studio-top-btn";
    studioButton.type = "button";
    studioButton.textContent = "创作台";
    const commandButton = document.createElement("button");
    commandButton.id = "commandBtn";
    commandButton.className = "studio-top-btn command-button";
    commandButton.type = "button";
    commandButton.setAttribute("aria-label", "打开命令面板");
    commandButton.title = "命令面板 (Ctrl+K)";
    commandButton.innerHTML = `<span>命令</span><kbd>Ctrl K</kbd>`;
    fragment.append(libraryButton, studioButton, commandButton);
    controls.prepend(fragment);
  }

  function addGlobalLayers() {
    document.body.insertAdjacentHTML("beforeend", `
      <div id="pointerGlow" aria-hidden="true"></div>
      <div id="studioToast" role="status" aria-live="polite"></div>
      <div id="focusDock" hidden aria-live="polite">
        <div><span>FOCUS SESSION</span><strong id="focusClock">25:00</strong></div>
        <button id="focusPause" type="button">暂停</button>
        <button id="focusReset" type="button">重置</button>
        <button id="focusExit" type="button">退出专注</button>
      </div>
      <div id="commandMask" class="studio-modal-mask" hidden>
        <div id="commandPalette" role="dialog" aria-modal="true" aria-label="命令面板">
          <div class="command-input-row"><span>⌕</span><input id="commandInput" placeholder="搜索命令、作品或会话" autocomplete="off" /></div>
          <div id="commandResults"></div>
          <div class="command-footer"><span>↑↓ 选择</span><span>Enter 执行</span><span>Esc 关闭</span></div>
        </div>
      </div>`);
  }

  function addReaderTools() {
    const toolbar = document.querySelector(".reader-toolbar");
    const shell = document.querySelector(".reader-shell");
    if (!toolbar || !shell || document.getElementById("readerTheme")) return;
    const tools = document.createElement("div");
    tools.className = "reader-studio-tools";
    tools.innerHTML = `<select id="readerTheme" aria-label="阅读主题"><option value="paper">纸张</option><option value="night">夜间</option><option value="eye">护眼</option></select><button class="reader-tool" id="readerExportTxt" type="button">TXT</button><button class="reader-tool" id="readerExportMd" type="button">MD</button><button class="reader-tool" id="readerPrint" type="button">打印</button>`;
    toolbar.insertBefore(tools, document.getElementById("readerCopy"));
    shell.insertAdjacentHTML("afterbegin", `<div id="readerProgress"><i></i></div>`);
  }

  function formatFocusTime(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  }

  function renderFocusDock() {
    const dock = document.getElementById("focusDock");
    if (!dock) return;
    dock.hidden = !document.body.classList.contains("focus-mode");
    document.getElementById("focusClock").textContent = formatFocusTime(focusRemaining);
    document.getElementById("focusPause").textContent = focusRunning ? "暂停" : "继续";
  }

  function stopFocusTimer() {
    if (focusTimerId) clearInterval(focusTimerId);
    focusTimerId = null;
  }

  function runFocusTimer() {
    stopFocusTimer();
    focusRunning = true;
    focusTimerId = setInterval(() => {
      focusRemaining = Math.max(0, focusRemaining - 1);
      renderFocusDock();
      if (focusRemaining === 0) {
        stopFocusTimer();
        focusRunning = false;
        renderFocusDock();
        toast("本次专注写作已完成");
      }
    }, 1000);
    renderFocusDock();
  }

  function startFocusMode() {
    if (!document.body.classList.contains("focus-mode")) {
      focusPreviousPanels = {
        library: document.body.classList.contains("library-collapsed"),
        studio: document.body.classList.contains("studio-collapsed")
      };
    }
    document.body.classList.add("focus-mode", "library-collapsed", "studio-collapsed");
    focusRemaining = Math.max(1, Number(state.settings.focusMinutes) || 25) * 60;
    runFocusTimer();
    document.getElementById("msg")?.focus();
  }

  function exitFocusMode() {
    stopFocusTimer();
    focusRunning = false;
    document.body.classList.remove("focus-mode");
    if (focusPreviousPanels) {
      document.body.classList.toggle("library-collapsed", focusPreviousPanels.library);
      document.body.classList.toggle("studio-collapsed", focusPreviousPanels.studio);
    }
    focusPreviousPanels = null;
    renderFocusDock();
  }

  function toggleFocusTimer() {
    if (focusRunning) {
      stopFocusTimer();
      focusRunning = false;
      renderFocusDock();
    } else if (focusRemaining > 0) {
      runFocusTimer();
    }
  }

  function resetFocusTimer() {
    focusRemaining = Math.max(1, Number(state.settings.focusMinutes) || 25) * 60;
    runFocusTimer();
  }

  function createProjectSnapshot() {
    const project = getActiveProject();
    const payload = clone(project);
    delete payload.snapshots;
    project.snapshots.unshift({
      id: makeId("snapshot"),
      createdAt: Date.now(),
      label: new Date().toLocaleString(),
      payload
    });
    project.snapshots = project.snapshots.slice(0, 10);
    saveState();
    renderStudioPanel();
    toast("作品快照已保存");
  }

  function restoreProjectSnapshot(snapshotId) {
    const project = getActiveProject();
    const snapshot = project.snapshots.find(item => item.id === snapshotId);
    if (!snapshot || !confirm(`恢复 ${snapshot.label} 的作品快照？当前作品资料会被覆盖。`)) return;
    const fields = ["description", "synopsis", "outline", "characters", "world", "notes", "timeline", "foreshadow", "scenes", "chapters", "dailyGoal"];
    fields.forEach(field => { project[field] = clone(snapshot.payload[field] ?? DEFAULT_PROJECT[field]); });
    state.activeChapterId = project.chapters.some(chapter => chapter.id === state.activeChapterId) ? state.activeChapterId : null;
    saveState();
    renderAll();
    toast("作品快照已恢复");
  }

  function deleteProjectSnapshot(snapshotId) {
    const project = getActiveProject();
    project.snapshots = project.snapshots.filter(item => item.id !== snapshotId);
    saveState();
    renderStudioPanel();
  }

  function renderAll() {
    ensureSessionAssignments();
    renderProjects();
    renderSessions();
    renderChapters();
    renderStudioPanel();
    applySettings();
  }

  function renderProjects() {
    const select = document.getElementById("projectSelect");
    if (!select) return;
    select.innerHTML = state.projects.map(project =>
      `<option value="${escapeHtml(project.id)}"${project.id === state.activeProjectId ? " selected" : ""}>${escapeHtml(project.name)}</option>`
    ).join("");
    document.getElementById("studioProjectTitle").textContent = getActiveProject().name;
  }

  function renderSessions() {
    const list = document.getElementById("studioSessionList");
    if (!list) return;
    const sessions = getSessions();
    const project = getActiveProject();
    const currentId = getCurrentSessionId();
    const query = sessionSearch.trim().toLowerCase();
    const visible = sessions.filter(session => project.sessionIds.includes(session.id))
      .filter(session => !query || String(session.name).toLowerCase().includes(query))
      .sort((left, right) => Number(state.favorites.includes(right.id)) - Number(state.favorites.includes(left.id)));
    list.innerHTML = visible.length ? visible.map(session => {
      const favorite = state.favorites.includes(session.id);
      const count = (session.messages || []).filter(message => message.role === "assistant").length;
      return `<div class="studio-list-item${session.id === currentId ? " active" : ""}" data-session-id="${escapeHtml(session.id)}">
        <button class="studio-item-main" type="button"><span>${escapeHtml(session.name)}</span><small>${count} 段 AI 内容</small></button>
        <button class="favorite-session${favorite ? " active" : ""}" type="button" title="收藏">${favorite ? "★" : "☆"}</button>
      </div>`;
    }).join("") : `<div class="studio-list-empty">没有匹配的会话</div>`;
  }

  function renderChapters() {
    const list = document.getElementById("studioChapterList");
    if (!list) return;
    const project = getActiveProject();
    const query = sessionSearch.trim().toLowerCase();
    const chapters = project.chapters.filter(chapter => !query || chapter.name.toLowerCase().includes(query));
    list.innerHTML = chapters.length ? chapters.map((chapter, index) => `
      <div class="studio-list-item chapter-item${chapter.id === state.activeChapterId ? " active" : ""}" data-chapter-id="${escapeHtml(chapter.id)}" draggable="true">
        <button class="chapter-drag" type="button" title="拖动排序">⋮⋮</button>
        <button class="studio-item-main" type="button"><span>${escapeHtml(chapter.name)}</span><small>第 ${index + 1} 章 · ${chapter.done ? "已完成" : "创作中"}</small></button>
        <button class="chapter-status${chapter.done ? " done" : ""}" type="button" title="切换完成状态">✓</button>
      </div>`).join("") : `<div class="studio-list-empty">还没有章节</div>`;
  }

  function renderStudioPanel() {
    const body = document.getElementById("studioPanelBody");
    if (!body) return;
    const project = getActiveProject();
    const session = getCurrentSession();
    document.querySelectorAll("[data-studio-tab]").forEach(button => {
      button.classList.toggle("active", button.dataset.studioTab === activeTab);
    });

    if (activeTab === "draft") {
      const assistantMessages = (session?.messages || []).filter(message => message.role === "assistant");
      body.innerHTML = `<div class="studio-pane">
        <div class="pane-hero"><span>MANUSCRIPT</span><h3>${escapeHtml(session?.name || "当前会话")}</h3><p>${assistantMessages.length} 个可整理片段</p></div>
        <div class="studio-action-grid">
          <button id="openReaderFromStudio" type="button"${assistantMessages.length ? "" : " disabled"}>进入阅读模式</button>
          <button id="copySessionText" type="button"${assistantMessages.length ? "" : " disabled"}>复制全部正文</button>
          <button id="exportSessionTxt" type="button"${assistantMessages.length ? "" : " disabled"}>导出 TXT</button>
          <button id="exportSessionMd" type="button"${assistantMessages.length ? "" : " disabled"}>导出 Markdown</button>
        </div>
        <div class="draft-fragment-list">${assistantMessages.length ? assistantMessages.map((message, index) => `
          <button class="draft-fragment" type="button" data-fragment-index="${index}"><span>片段 ${String(index + 1).padStart(2, "0")}</span><p>${escapeHtml(message.content.slice(0, 90))}</p></button>`).join("") : `<div class="studio-empty-state"><strong>正文会出现在这里</strong><p>AI 生成内容后，可以整理、阅读和导出。</p></div>`}</div>
      </div>`;
    } else if (activeTab === "outline") {
      body.innerHTML = `<div class="studio-pane editor-pane">
        <label><span>作品简介</span><textarea data-project-field="description" placeholder="记录作品定位、类型与一句话介绍">${escapeHtml(project.description)}</textarea></label>
        <label><span>故事梗概</span><textarea data-project-field="synopsis" placeholder="记录故事核心冲突、主角目标与结局方向">${escapeHtml(project.synopsis)}</textarea></label>
        <label><span>章节大纲</span><textarea class="large" data-project-field="outline" placeholder="按卷、章或场景整理故事结构">${escapeHtml(project.outline)}</textarea></label>
        <div class="autosave-note">内容仅保存在当前浏览器，不会发送给 AI。</div>
      </div>`;
    } else if (activeTab === "characters") {
      body.innerHTML = `<div class="studio-pane">
        <form id="characterForm" class="character-form"><input id="characterName" maxlength="30" placeholder="人物姓名" required /><input id="characterRole" maxlength="40" placeholder="身份或阵营" /><button type="submit">添加人物</button></form>
        <div class="character-grid">${project.characters.length ? project.characters.map(character => `<article class="character-card" data-character-id="${escapeHtml(character.id)}"><div class="character-monogram">${escapeHtml(character.name.slice(0, 1))}</div><div><strong>${escapeHtml(character.name)}</strong><span>${escapeHtml(character.role || "未设置身份")}</span></div><button class="remove-character" type="button" title="删除人物">×</button><textarea data-character-note="${escapeHtml(character.id)}" placeholder="性格、目标、关系、外貌与备注">${escapeHtml(character.note || "")}</textarea></article>`).join("") : `<div class="studio-empty-state"><strong>建立人物档案</strong><p>人物卡不会自动加入 AI 上下文。</p></div>`}</div>
      </div>`;
    } else if (activeTab === "world") {
      body.innerHTML = `<div class="studio-pane editor-pane">
        <label><span>世界观与规则</span><textarea class="large" data-project-field="world" placeholder="地点、组织、力量体系、历史和专有名词">${escapeHtml(project.world)}</textarea></label>
        <label><span>故事时间线</span><textarea data-project-field="timeline" placeholder="记录事件顺序、日期与人物年龄">${escapeHtml(project.timeline)}</textarea></label>
        <label><span>伏笔追踪</span><textarea data-project-field="foreshadow" placeholder="记录埋设位置、回收章节和状态">${escapeHtml(project.foreshadow)}</textarea></label>
      </div>`;
    } else if (activeTab === "scenes") {
      const statusLabel = { todo: "待写", writing: "进行中", done: "已完成" };
      const chapterOptions = project.chapters.map(chapter => `<option value="${escapeHtml(chapter.id)}">${escapeHtml(chapter.name)}</option>`).join("");
      body.innerHTML = `<div class="studio-pane scene-pane">
        <div id="sceneForm" class="scene-form">
          <input id="sceneTitle" maxlength="60" placeholder="场景标题" required />
          <select id="sceneChapter" aria-label="关联章节"><option value="">未关联章节</option>${chapterOptions}</select>
          <textarea id="sceneSummary" maxlength="500" placeholder="冲突、转折、出场人物或场景目标"></textarea>
          <button id="addSceneCard" type="button">添加场景</button>
        </div>
        <div class="scene-list">${project.scenes.length ? project.scenes.map((scene, index) => {
          const chapter = project.chapters.find(item => item.id === scene.chapterId);
          return `<article class="scene-card" data-scene-id="${escapeHtml(scene.id)}" draggable="true">
            <button class="scene-drag" type="button" title="拖动排序">⋮⋮</button>
            <div class="scene-card-copy"><input data-scene-field="title" value="${escapeHtml(scene.title)}" aria-label="场景标题" /><span>${String(index + 1).padStart(2, "0")} · ${escapeHtml(chapter?.name || "未关联章节")}</span></div>
            <button class="scene-status status-${escapeHtml(scene.status)}" type="button">${statusLabel[scene.status] || statusLabel.todo}</button>
            <button class="remove-scene" type="button" title="删除场景">×</button>
            <textarea data-scene-field="summary" placeholder="记录这个场景要发生什么">${escapeHtml(scene.summary || "")}</textarea>
          </article>`;
        }).join("") : `<div class="studio-empty-state"><strong>搭建场景节奏</strong><p>把情节拆成可以排序和推进的小场景。</p></div>`}</div>
      </div>`;
    } else if (activeTab === "notes") {
      body.innerHTML = `<div class="studio-pane editor-pane"><label><span>灵感便签</span><textarea class="note-paper" data-project-field="notes" placeholder="台词、场景、冲突、意象或临时想法">${escapeHtml(project.notes)}</textarea></label><div class="autosave-note">自动保存 · 支持在命令面板中快速打开</div></div>`;
    } else {
      const messages = session?.messages || [];
      const assistant = messages.filter(message => message.role === "assistant");
      const words = assistant.reduce((sum, message) => sum + message.content.replace(/\s/g, "").length, 0);
      const chapterDone = project.chapters.filter(chapter => chapter.done).length;
      const progress = Math.min(100, Math.round(words / Math.max(1, project.dailyGoal) * 100));
      let storageBytes = 0;
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        storageBytes += (key.length + (localStorage.getItem(key) || "").length) * 2;
      }
      body.innerHTML = `<div class="studio-pane stats-pane">
        <div class="stat-grid"><div><strong>${words.toLocaleString()}</strong><span>正文字数</span></div><div><strong>${assistant.length}</strong><span>AI 片段</span></div><div><strong>${project.chapters.length}</strong><span>章节</span></div><div><strong>${chapterDone}</strong><span>已完成</span></div></div>
        <label class="goal-control"><span>本次写作目标</span><input type="number" min="100" step="100" value="${Number(project.dailyGoal) || 2000}" id="dailyGoalInput" /></label>
        <div class="goal-progress"><i style="width:${progress}%"></i></div><p class="goal-caption">已完成 ${progress}%</p>
        <div class="focus-settings"><div><strong>专注写作</strong><span>隐藏两侧面板并启动计时</span></div><label><select id="focusMinutesSetting" aria-label="专注时长"><option value="15"${state.settings.focusMinutes === 15 ? " selected" : ""}>15 分钟</option><option value="25"${state.settings.focusMinutes === 25 ? " selected" : ""}>25 分钟</option><option value="45"${state.settings.focusMinutes === 45 ? " selected" : ""}>45 分钟</option><option value="60"${state.settings.focusMinutes === 60 ? " selected" : ""}>60 分钟</option></select><button id="startFocusMode" type="button">开始</button></label></div>
        <div class="snapshot-panel"><div class="snapshot-head"><div><strong>作品快照</strong><span>只保存大纲、人物、设定、章节和场景</span></div><button id="createSnapshot" type="button">保存快照</button></div><div class="snapshot-list">${project.snapshots.length ? project.snapshots.slice(0, 5).map(snapshot => `<div data-snapshot-id="${escapeHtml(snapshot.id)}"><span>${escapeHtml(snapshot.label)}</span><button class="restore-snapshot" type="button">恢复</button><button class="delete-snapshot" type="button" title="删除快照">×</button></div>`).join("") : `<p>还没有作品快照</p>`}</div></div>
        <div class="storage-note">本地数据约 ${(storageBytes / 1024).toFixed(1)} KB</div>
        <div class="motion-settings"><strong>界面动效</strong><div class="segmented"><button data-motion="off" type="button">关闭</button><button data-motion="reduced" type="button">精简</button><button data-motion="full" type="button">完整</button></div><label><input id="clickFxSetting" type="checkbox"${state.settings.clickFx ? " checked" : ""} /> 点击涟漪</label><label><input id="spotlightSetting" type="checkbox"${state.settings.spotlight ? " checked" : ""} /> 鼠标环境光</label><label class="dim-control"><span>背景遮罩</span><input id="backgroundDimSetting" type="range" min="20" max="80" value="${state.settings.backgroundDim}" /></label></div>
      </div>`;
      body.querySelectorAll("[data-motion]").forEach(button => button.classList.toggle("active", button.dataset.motion === state.settings.motion));
    }
    bindRenderedPanelControls(body);
  }

  function bindRenderedPanelControls(body) {
    body.querySelector("#addSceneCard")?.addEventListener("click", () => {
      const title = document.getElementById("sceneTitle").value.trim();
      if (!title) { document.getElementById("sceneTitle").focus(); return; }
      getActiveProject().scenes.push({ id: makeId("scene"), title, chapterId: document.getElementById("sceneChapter").value, summary: document.getElementById("sceneSummary").value.trim(), status: "todo", createdAt: Date.now() });
      saveState();
      renderStudioPanel();
      toast("场景卡已添加");
    });
    body.querySelectorAll("[data-scene-field]").forEach(input => input.addEventListener("input", () => {
      const scene = getActiveProject().scenes.find(item => item.id === input.closest("[data-scene-id]")?.dataset.sceneId);
      if (scene) scene[input.dataset.sceneField] = input.value;
      saveState();
    }));
    body.querySelectorAll(".scene-status").forEach(button => button.addEventListener("click", () => {
      const scene = getActiveProject().scenes.find(item => item.id === button.closest("[data-scene-id]")?.dataset.sceneId);
      if (!scene) return;
      const statuses = ["todo", "writing", "done"];
      scene.status = statuses[(statuses.indexOf(scene.status) + 1) % statuses.length];
      saveState();
      renderStudioPanel();
    }));
    body.querySelectorAll(".remove-scene").forEach(button => button.addEventListener("click", () => {
      const sceneId = button.closest("[data-scene-id]")?.dataset.sceneId;
      getActiveProject().scenes = getActiveProject().scenes.filter(item => item.id !== sceneId);
      saveState();
      renderStudioPanel();
    }));
    body.querySelectorAll("[data-scene-id]").forEach(card => {
      card.addEventListener("dragstart", event => event.dataTransfer.setData("text/scene-id", card.dataset.sceneId));
      card.addEventListener("dragover", event => event.preventDefault());
      card.addEventListener("drop", event => {
        event.preventDefault();
        const sourceId = event.dataTransfer.getData("text/scene-id");
        if (!sourceId || sourceId === card.dataset.sceneId) return;
        const scenes = getActiveProject().scenes;
        const from = scenes.findIndex(item => item.id === sourceId);
        const to = scenes.findIndex(item => item.id === card.dataset.sceneId);
        if (from < 0 || to < 0) return;
        scenes.splice(to, 0, scenes.splice(from, 1)[0]);
        saveState();
        renderStudioPanel();
      });
    });
    body.querySelector("#focusMinutesSetting")?.addEventListener("change", event => {
      state.settings.focusMinutes = Number(event.target.value) || 25;
      saveState();
    });
    body.querySelector("#startFocusMode")?.addEventListener("click", startFocusMode);
    body.querySelector("#createSnapshot")?.addEventListener("click", createProjectSnapshot);
    body.querySelectorAll(".restore-snapshot").forEach(button => button.addEventListener("click", () => restoreProjectSnapshot(button.closest("[data-snapshot-id]")?.dataset.snapshotId)));
    body.querySelectorAll(".delete-snapshot").forEach(button => button.addEventListener("click", () => deleteProjectSnapshot(button.closest("[data-snapshot-id]")?.dataset.snapshotId)));
  }

  function switchSession(id) {
    const target = document.querySelector(`#sessionList .session-title[data-id="${CSS.escape(id)}"]`);
    if (target) target.click();
    state.recentSessions = [id, ...state.recentSessions.filter(item => item !== id)].slice(0, 10);
    saveState();
    setTimeout(() => {
      renderAll();
      restoreSessionWorkspace(id);
    }, 40);
  }

  function restoreSessionWorkspace(id = getCurrentSessionId()) {
    const input = document.getElementById("msg");
    const history = document.getElementById("history");
    if (input && !input.value) input.value = state.drafts[id] || "";
    if (history && Number.isFinite(state.scrollPositions[id])) history.scrollTop = state.scrollPositions[id];
  }

  function rememberPrompt(text) {
    const clean = text.trim();
    const id = getCurrentSessionId();
    if (!clean || !id) return;
    const items = Array.isArray(state.promptHistory[id]) ? state.promptHistory[id] : [];
    state.promptHistory[id] = [clean, ...items.filter(item => item !== clean)].slice(0, 30);
    state.drafts[id] = "";
    saveState();
  }

  function addProject(name) {
    const cleanName = name.trim();
    if (!cleanName) return;
    const project = { ...clone(DEFAULT_PROJECT), id: makeId("project"), name: cleanName, createdAt: Date.now() };
    state.projects.push(project);
    state.activeProjectId = project.id;
    state.activeChapterId = null;
    saveState();
    renderAll();
    toast("小说项目已创建");
  }

  function addChapter(name) {
    const cleanName = name.trim();
    if (!cleanName) return;
    const chapter = { id: makeId("chapter"), name: cleanName, done: false, createdAt: Date.now() };
    getActiveProject().chapters.push(chapter);
    state.activeChapterId = chapter.id;
    saveState();
    renderAll();
    toast("章节已添加");
  }

  function sessionText(markdown = false) {
    const session = getCurrentSession();
    const pieces = (session?.messages || []).filter(message => message.role === "assistant").map((message, index) => {
      const heading = `片段 ${String(index + 1).padStart(2, "0")}`;
      return markdown ? `## ${heading}\n\n${message.content}` : `${heading}\n\n${message.content}`;
    });
    return pieces.join("\n\n---\n\n");
  }

  function readLocalObject(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
  }

  function readerStorageKey() {
    return getCurrentSessionId() || "default";
  }

  function enhanceReaderContent() {
    if (readerEnhanceQueued) return;
    readerEnhanceQueued = true;
    requestAnimationFrame(() => {
      readerEnhanceQueued = false;
      const labels = Array.from(document.querySelectorAll("#readerSegments .reader-segment-item"));
      const chapters = Array.from(document.querySelectorAll("#readerContent .reader-chapter"));
      if (!labels.length) return;
      const key = readerStorageKey();
      const titles = readLocalObject(LS_READER_TITLES);
      const orders = readLocalObject(LS_READER_ORDER);
      const storedTitles = titles[key] || {};
      const selectedPositions = [];

      labels.forEach((label, position) => {
        if (label.dataset.readerPosition === undefined) label.dataset.readerPosition = String(position);
        const originalPosition = Number(label.dataset.readerPosition);
        label.draggable = true;
        if (label.querySelector("input[type=checkbox]")?.checked) selectedPositions.push(originalPosition);
        if (!label.querySelector(".reader-title-input")) {
          const input = document.createElement("input");
          input.className = "reader-title-input";
          input.value = storedTitles[originalPosition] || `片段 ${String(originalPosition + 1).padStart(2, "0")}`;
          input.placeholder = "章节标题";
          input.addEventListener("click", event => event.preventDefault());
          input.addEventListener("input", event => {
            const allTitles = readLocalObject(LS_READER_TITLES);
            allTitles[key] = allTitles[key] || {};
            allTitles[key][originalPosition] = event.target.value;
            localStorage.setItem(LS_READER_TITLES, JSON.stringify(allTitles));
            applyReaderTitles();
          });
          label.querySelector(".reader-segment-copy")?.appendChild(input);
        }
      });

      chapters.forEach((chapter, index) => {
        if (chapter.dataset.readerPosition === undefined) chapter.dataset.readerPosition = String(selectedPositions[index]);
      });

      const order = Array.isArray(orders[key]) ? orders[key] : labels.map((_, index) => index);
      const normalizedOrder = [...order.filter(position => position < labels.length), ...labels.map((_, index) => index).filter(index => !order.includes(index))];
      const segmentRoot = document.getElementById("readerSegments");
      const contentRoot = document.getElementById("readerContent");
      const currentLabelOrder = labels.map(item => Number(item.dataset.readerPosition));
      const targetChapterOrder = normalizedOrder.filter(position => selectedPositions.includes(position));
      const currentChapterOrder = chapters.map(item => Number(item.dataset.readerPosition));
      if (currentLabelOrder.join(",") !== normalizedOrder.join(",")) {
        normalizedOrder.forEach(position => {
          const label = labels.find(item => Number(item.dataset.readerPosition) === position);
          if (label) segmentRoot.appendChild(label);
        });
      }
      if (currentChapterOrder.join(",") !== targetChapterOrder.join(",")) {
        targetChapterOrder.forEach(position => {
          const chapter = chapters.find(item => Number(item.dataset.readerPosition) === position);
          if (chapter) contentRoot.appendChild(chapter);
        });
      }
      applyReaderTitles();
      updateReaderProgress();
    });
  }

  function applyReaderTitles() {
    const titles = readLocalObject(LS_READER_TITLES)[readerStorageKey()] || {};
    document.querySelectorAll("#readerContent .reader-chapter").forEach(chapter => {
      const position = Number(chapter.dataset.readerPosition);
      const label = chapter.querySelector(".reader-chapter-label");
      const nextTitle = titles[position] || `片段 ${String(position + 1).padStart(2, "0")}`;
      if (label && label.textContent !== nextTitle) label.textContent = nextTitle;
    });
  }

  function updateReaderProgress() {
    const wrap = document.getElementById("readerPageWrap");
    const bar = document.querySelector("#readerProgress i");
    if (!wrap || !bar) return;
    const distance = Math.max(1, wrap.scrollHeight - wrap.clientHeight);
    bar.style.width = `${Math.min(100, Math.round(wrap.scrollTop / distance * 100))}%`;
  }

  function readerDocumentText(markdown = false) {
    return Array.from(document.querySelectorAll("#readerContent .reader-chapter")).map(chapter => {
      const title = chapter.querySelector(".reader-chapter-label")?.textContent || "章节";
      const text = chapter.querySelector(".reader-chapter-text")?.textContent || "";
      return markdown ? `## ${title}\n\n${text}` : `${title}\n\n${text}`;
    }).join("\n\n---\n\n");
  }

  function decorateMessages() {
    const categories = readLocalObject(LS_MESSAGE_CATEGORIES);
    const key = readerStorageKey();
    const sessionCategories = categories[key] || {};
    document.querySelectorAll("#chat .row.ai").forEach((row, assistantIndex) => {
      if (row.dataset.studioDecorated === "1") return;
      row.dataset.studioDecorated = "1";
      row.dataset.assistantIndex = String(assistantIndex);
      const tools = row.querySelector(".message-tools");
      if (!tools) return;
      const copy = document.createElement("button");
      copy.className = "studio-message-tool copy-message";
      copy.type = "button";
      copy.textContent = "复制";
      const collapse = document.createElement("button");
      collapse.className = "studio-message-tool collapse-message";
      collapse.type = "button";
      collapse.textContent = "折叠";
      const category = document.createElement("select");
      category.className = "message-category";
      category.setAttribute("aria-label", "内容分类");
      category.innerHTML = `<option value="">未分类</option><option value="正文">正文</option><option value="灵感">灵感</option><option value="设定">设定</option><option value="废稿">废稿</option>`;
      category.value = sessionCategories[assistantIndex] || "";
      tools.append(copy, collapse, category);
    });
  }

  function downloadText(filename, content, type = "text/plain;charset=utf-8") {
    const blob = new Blob(["\uFEFF", content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportBackup() {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions: getSessions(),
      readerSelections: JSON.parse(localStorage.getItem(LS_READER_SELECTIONS) || "{}"),
      readerTitles: readLocalObject(LS_READER_TITLES),
      readerOrder: readLocalObject(LS_READER_ORDER),
      messageCategories: readLocalObject(LS_MESSAGE_CATEGORIES),
      studio: state
    };
    downloadText(`unlimited-ai-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), "application/json;charset=utf-8");
    toast("备份已导出");
  }

  async function restoreBackup(file) {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (!backup || !Array.isArray(backup.sessions) || !backup.studio) throw new Error("invalid");
      if (!confirm(`将导入 ${backup.sessions.length} 个会话。继续吗？`)) return;
      localStorage.setItem(LS_SESSIONS, JSON.stringify(backup.sessions));
      localStorage.setItem(LS_READER_SELECTIONS, JSON.stringify(backup.readerSelections || {}));
      localStorage.setItem(LS_READER_TITLES, JSON.stringify(backup.readerTitles || {}));
      localStorage.setItem(LS_READER_ORDER, JSON.stringify(backup.readerOrder || {}));
      localStorage.setItem(LS_MESSAGE_CATEGORIES, JSON.stringify(backup.messageCategories || {}));
      localStorage.setItem(LS_STUDIO, JSON.stringify(backup.studio));
      location.reload();
    } catch {
      toast("备份文件无法识别", "error");
    }
  }

  function openCommandPalette() {
    const mask = document.getElementById("commandMask");
    mask.hidden = false;
    commandQuery = "";
    commandIndex = 0;
    const input = document.getElementById("commandInput");
    input.value = "";
    renderCommands();
    requestAnimationFrame(() => input.focus());
  }

  function closeCommandPalette() {
    document.getElementById("commandMask").hidden = true;
  }

  function getCommands() {
    const readerButton = document.getElementById("readerBtn");
    const commands = [
      { id: "focus", label: "聚焦消息输入框", group: "导航", run: () => document.getElementById("msg").focus() },
      { id: "search-chat", label: "搜索当前对话", group: "导航", run: openConversationSearch },
      { id: "reader", label: "打开小说阅读模式", group: "创作", disabled: readerButton.disabled, run: () => readerButton.click() },
      { id: "new-session", label: "新建会话", group: "会话", run: () => document.getElementById("newSessionBtn").click() },
      { id: "settings", label: "打开设置", group: "设置", run: () => document.getElementById("settingsBtn").click() },
      { id: "theme", label: "切换明暗主题", group: "设置", run: () => document.getElementById("themeToggle").click() },
      { id: "library", label: "显示或隐藏创作书架", group: "界面", run: toggleLibrary },
      { id: "studio", label: "显示或隐藏创作台", group: "界面", run: toggleStudio },
      { id: "focus-mode", label: "开始专注写作", group: "创作", run: startFocusMode },
      { id: "outline", label: "打开故事大纲", group: "创作", run: () => setStudioTab("outline") },
      { id: "characters", label: "打开人物卡", group: "创作", run: () => setStudioTab("characters") },
      { id: "scenes", label: "打开场景卡片", group: "创作", run: () => setStudioTab("scenes") },
      { id: "notes", label: "打开灵感便签", group: "创作", run: () => setStudioTab("notes") },
      { id: "snapshot", label: "保存当前作品快照", group: "数据", run: createProjectSnapshot },
      { id: "backup", label: "导出本地完整备份", group: "数据", run: exportBackup },
      { id: "delete-project", label: "删除当前小说项目", group: "数据", disabled: state.projects.length <= 1, run: deleteActiveProject }
    ];
    getSessions().forEach(session => commands.push({ id: `session-${session.id}`, label: `打开会话：${session.name}`, group: "会话", run: () => switchSession(session.id) }));
    state.projects.forEach(project => commands.push({ id: `project-${project.id}`, label: `打开作品：${project.name}`, group: "作品", run: () => { state.activeProjectId = project.id; saveState(); renderAll(); } }));
    return commands;
  }

  function renderCommands() {
    const results = document.getElementById("commandResults");
    const query = commandQuery.trim().toLowerCase();
    const commands = getCommands().filter(command => !query || command.label.toLowerCase().includes(query)).slice(0, 12);
    commandIndex = 0;
    results.innerHTML = commands.length ? commands.map((command, index) => `<button type="button" data-command-id="${escapeHtml(command.id)}" class="${index === 0 ? "selected" : ""}"${command.disabled ? " disabled" : ""}><span>${escapeHtml(command.label)}</span><small>${escapeHtml(command.group)}</small></button>`).join("") : `<div class="command-empty">没有匹配的命令</div>`;
  }

  function runCommand(id) {
    const command = getCommands().find(item => item.id === id);
    if (!command || command.disabled) return;
    closeCommandPalette();
    command.run();
  }

  function setStudioTab(tab) {
    activeTab = tab;
    document.body.classList.remove("studio-collapsed");
    renderStudioPanel();
  }

  function deleteActiveProject() {
    if (state.projects.length <= 1) return;
    const project = getActiveProject();
    if (!confirm(`删除作品“${project.name}”？会话将移入其他作品，不会被删除。`)) return;
    const fallback = state.projects.find(item => item.id !== project.id);
    fallback.sessionIds = Array.from(new Set([...fallback.sessionIds, ...project.sessionIds]));
    state.projects = state.projects.filter(item => item.id !== project.id);
    state.activeProjectId = fallback.id;
    state.activeChapterId = null;
    saveState();
    renderAll();
    toast("作品已删除，会话已保留");
  }

  function toggleLibrary() {
    const opening = document.body.classList.contains("library-collapsed");
    document.body.classList.toggle("library-collapsed");
    if (opening && innerWidth <= 980) document.body.classList.add("studio-collapsed");
  }

  function toggleStudio() {
    const opening = document.body.classList.contains("studio-collapsed");
    document.body.classList.toggle("studio-collapsed");
    if (opening && innerWidth <= 980) document.body.classList.add("library-collapsed");
  }

  function openConversationSearch() {
    const bar = document.getElementById("conversationSearchBar");
    bar.hidden = false;
    requestAnimationFrame(() => document.getElementById("conversationSearchInput").focus());
  }

  function closeConversationSearch() {
    document.getElementById("conversationSearchBar").hidden = true;
    document.getElementById("conversationSearchInput").value = "";
    document.querySelectorAll("#chat .row.search-match").forEach(row => row.classList.remove("search-match"));
    document.getElementById("conversationSearchCount").textContent = "0";
  }

  function searchConversation(query) {
    const clean = query.trim().toLowerCase();
    const rows = Array.from(document.querySelectorAll("#chat .row"));
    const matches = rows.filter(row => clean && row.textContent.toLowerCase().includes(clean));
    rows.forEach(row => row.classList.toggle("search-match", matches.includes(row)));
    document.getElementById("conversationSearchCount").textContent = String(matches.length);
    matches[0]?.scrollIntoView({ block: "center", behavior: state.settings.motion === "off" ? "auto" : "smooth" });
  }

  function applySettings() {
    document.documentElement.dataset.motion = state.settings.motion;
    document.body.classList.toggle("click-fx-enabled", state.settings.clickFx);
    document.body.classList.toggle("spotlight-enabled", state.settings.spotlight);
    document.documentElement.style.setProperty("--studio-dim", `${state.settings.backgroundDim / 100}`);
  }

  function toast(message, type = "success") {
    const element = document.getElementById("studioToast");
    if (!element) return;
    element.textContent = message;
    element.dataset.type = type;
    element.classList.add("visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove("visible"), 1800);
  }

  function createClickEffect(event) {
    if (!state.settings.clickFx || state.settings.motion === "off" || event.button !== 0) return;
    const target = event.target.closest("button, .studio-list-item, .reader-segment-item");
    if (!target) return;
    const ripple = document.createElement("span");
    ripple.className = "studio-click-ripple";
    ripple.style.left = `${event.clientX}px`;
    ripple.style.top = `${event.clientY}px`;
    document.body.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  }

  function bindEvents() {
    const messageInput = document.getElementById("msg");
    const historyScroller = document.getElementById("history");
    messageInput.addEventListener("input", () => {
      const id = getCurrentSessionId();
      if (!id) return;
      if (!navigatingPromptHistory) {
        state.drafts[id] = messageInput.value;
        promptHistoryIndex = -1;
      }
      saveState();
    });
    messageInput.addEventListener("keydown", event => {
      const id = getCurrentSessionId();
      const items = Array.isArray(state.promptHistory[id]) ? state.promptHistory[id] : [];
      if (event.key === "Enter" && !event.shiftKey) {
        rememberPrompt(messageInput.value);
      } else if ((event.key === "ArrowUp" || event.key === "ArrowDown") && items.length && (!messageInput.value || promptHistoryIndex >= 0)) {
        event.preventDefault();
        if (promptHistoryIndex < 0) promptDraftBeforeHistory = messageInput.value;
        const nextHistoryIndex = event.key === "ArrowUp"
          ? Math.min(items.length - 1, promptHistoryIndex + 1)
          : Math.max(-1, promptHistoryIndex - 1);
        messageInput.value = nextHistoryIndex >= 0 ? items[nextHistoryIndex] : promptDraftBeforeHistory;
        navigatingPromptHistory = true;
        messageInput.dispatchEvent(new Event("input", { bubbles: true }));
        navigatingPromptHistory = false;
        promptHistoryIndex = nextHistoryIndex;
      }
    }, true);
    historyScroller.addEventListener("scroll", () => {
      const id = getCurrentSessionId();
      if (!id) return;
      state.scrollPositions[id] = historyScroller.scrollTop;
      clearTimeout(historyScroller.studioSaveTimer);
      historyScroller.studioSaveTimer = setTimeout(saveState, 120);
    }, { passive: true });
    document.getElementById("projectSelect").addEventListener("change", event => {
      state.activeProjectId = event.target.value;
      state.activeChapterId = null;
      saveState();
      renderAll();
    });
    document.getElementById("addProject").addEventListener("click", () => {
      const row = document.getElementById("projectCreateRow");
      row.hidden = !row.hidden;
      if (!row.hidden) document.getElementById("projectNameInput").focus();
    });
    document.getElementById("renameProject").addEventListener("click", () => {
      const project = getActiveProject();
      const nextName = prompt("输入新的作品名称", project.name);
      if (!nextName?.trim()) return;
      project.name = nextName.trim();
      saveState();
      renderAll();
      toast("作品已重命名");
    });
    document.getElementById("confirmProject").addEventListener("click", () => {
      addProject(document.getElementById("projectNameInput").value);
      document.getElementById("projectNameInput").value = "";
      document.getElementById("projectCreateRow").hidden = true;
    });
    document.getElementById("addChapter").addEventListener("click", () => {
      const row = document.getElementById("chapterCreateRow");
      row.hidden = !row.hidden;
      if (!row.hidden) document.getElementById("chapterNameInput").focus();
    });
    document.getElementById("confirmChapter").addEventListener("click", () => {
      addChapter(document.getElementById("chapterNameInput").value);
      document.getElementById("chapterNameInput").value = "";
      document.getElementById("chapterCreateRow").hidden = true;
    });
    document.getElementById("sessionSearch").addEventListener("input", event => {
      sessionSearch = event.target.value;
      renderSessions();
      renderChapters();
    });
    document.getElementById("studioNewSession").addEventListener("click", () => document.getElementById("newSessionBtn").click());
    document.getElementById("backupWorkspace").addEventListener("click", exportBackup);
    document.getElementById("restoreWorkspace").addEventListener("click", () => document.getElementById("restoreWorkspaceFile").click());
    document.getElementById("restoreWorkspaceFile").addEventListener("change", event => restoreBackup(event.target.files[0]));
    document.getElementById("readerTheme").addEventListener("change", event => {
      document.body.dataset.readerTheme = event.target.value;
    });
    document.getElementById("readerExportTxt").addEventListener("click", () => downloadText(`${getCurrentSession()?.name || "novel"}.txt`, readerDocumentText(false)));
    document.getElementById("readerExportMd").addEventListener("click", () => downloadText(`${getCurrentSession()?.name || "novel"}.md`, readerDocumentText(true), "text/markdown;charset=utf-8"));
    document.getElementById("readerPrint").addEventListener("click", () => window.print());
    document.getElementById("readerPageWrap").addEventListener("scroll", updateReaderProgress, { passive: true });
    document.getElementById("collapseLibrary").addEventListener("click", toggleLibrary);
    document.getElementById("collapseStudio").addEventListener("click", toggleStudio);
    document.getElementById("libraryToggleBtn").addEventListener("click", toggleLibrary);
    document.getElementById("studioToggleBtn").addEventListener("click", toggleStudio);
    document.getElementById("commandBtn").addEventListener("click", openCommandPalette);
    document.getElementById("focusPause").addEventListener("click", toggleFocusTimer);
    document.getElementById("focusReset").addEventListener("click", resetFocusTimer);
    document.getElementById("focusExit").addEventListener("click", exitFocusMode);
    document.getElementById("conversationSearchInput").addEventListener("input", event => searchConversation(event.target.value));
    document.getElementById("closeConversationSearch").addEventListener("click", closeConversationSearch);

    document.getElementById("studioLibrary").addEventListener("click", event => {
      const sessionItem = event.target.closest("[data-session-id]");
      if (sessionItem) {
        const id = sessionItem.dataset.sessionId;
        if (event.target.closest(".favorite-session")) {
          state.favorites = state.favorites.includes(id) ? state.favorites.filter(item => item !== id) : [...state.favorites, id];
          saveState();
          renderSessions();
        } else {
          switchSession(id);
        }
      }
      const chapterItem = event.target.closest("[data-chapter-id]");
      if (chapterItem) {
        const chapter = getActiveProject().chapters.find(item => item.id === chapterItem.dataset.chapterId);
        if (!chapter) return;
        if (event.target.closest(".chapter-status")) chapter.done = !chapter.done;
        state.activeChapterId = chapter.id;
        saveState();
        renderChapters();
        if (activeTab === "stats") renderStudioPanel();
      }
    });

    document.getElementById("studioLibrary").addEventListener("dragstart", event => {
      const item = event.target.closest("[data-chapter-id]");
      if (item) event.dataTransfer.setData("text/chapter-id", item.dataset.chapterId);
    });
    document.getElementById("studioLibrary").addEventListener("dragover", event => {
      if (event.target.closest("[data-chapter-id]")) event.preventDefault();
    });
    document.getElementById("studioLibrary").addEventListener("drop", event => {
      const target = event.target.closest("[data-chapter-id]");
      const sourceId = event.dataTransfer.getData("text/chapter-id");
      if (!target || !sourceId || sourceId === target.dataset.chapterId) return;
      const chapters = getActiveProject().chapters;
      const from = chapters.findIndex(item => item.id === sourceId);
      const to = chapters.findIndex(item => item.id === target.dataset.chapterId);
      chapters.splice(to, 0, chapters.splice(from, 1)[0]);
      saveState();
      renderChapters();
    });

    document.getElementById("readerSegments").addEventListener("dragstart", event => {
      const item = event.target.closest("[data-reader-position]");
      if (item) event.dataTransfer.setData("text/reader-position", item.dataset.readerPosition);
    });
    document.getElementById("readerSegments").addEventListener("dragover", event => {
      if (event.target.closest("[data-reader-position]")) event.preventDefault();
    });
    document.getElementById("readerSegments").addEventListener("drop", event => {
      const target = event.target.closest("[data-reader-position]");
      const source = Number(event.dataTransfer.getData("text/reader-position"));
      if (!target || !Number.isInteger(source)) return;
      const destination = Number(target.dataset.readerPosition);
      const key = readerStorageKey();
      const allOrders = readLocalObject(LS_READER_ORDER);
      const current = Array.from(document.querySelectorAll("#readerSegments [data-reader-position]")).map(item => Number(item.dataset.readerPosition));
      const from = current.indexOf(source);
      const to = current.indexOf(destination);
      current.splice(to, 0, current.splice(from, 1)[0]);
      allOrders[key] = current;
      localStorage.setItem(LS_READER_ORDER, JSON.stringify(allOrders));
      enhanceReaderContent();
      toast("阅读顺序已更新");
    });

    document.querySelector(".studio-tabs").addEventListener("click", event => {
      const button = event.target.closest("[data-studio-tab]");
      if (button) setStudioTab(button.dataset.studioTab);
    });
    document.getElementById("studioPanelBody").addEventListener("input", event => {
      const project = getActiveProject();
      const field = event.target.dataset.projectField;
      if (field) project[field] = event.target.value;
      if (event.target.matches("[data-character-note]")) {
        const character = project.characters.find(item => item.id === event.target.dataset.characterNote);
        if (character) character.note = event.target.value;
      }
      if (event.target.id === "dailyGoalInput") project.dailyGoal = Math.max(100, Number(event.target.value) || 2000);
      if (event.target.id === "backgroundDimSetting") state.settings.backgroundDim = Number(event.target.value);
      saveState();
      applySettings();
    });
    document.getElementById("studioPanelBody").addEventListener("change", event => {
      if (event.target.id === "clickFxSetting") state.settings.clickFx = event.target.checked;
      if (event.target.id === "spotlightSetting") state.settings.spotlight = event.target.checked;
      saveState();
      applySettings();
    });
    document.getElementById("studioPanelBody").addEventListener("submit", event => {
      if (event.target.id === "characterForm") {
        event.preventDefault();
        const name = document.getElementById("characterName").value.trim();
        const role = document.getElementById("characterRole").value.trim();
        if (!name) return;
        getActiveProject().characters.push({ id: makeId("character"), name, role, note: "" });
        saveState();
        renderStudioPanel();
        toast("人物卡已添加");
      }
    });
    document.getElementById("studioPanelBody").addEventListener("click", async event => {
      const motion = event.target.closest("[data-motion]");
      if (motion) {
        state.settings.motion = motion.dataset.motion;
        saveState();
        applySettings();
        renderStudioPanel();
        return;
      }
      const removeCharacter = event.target.closest(".remove-character");
      if (removeCharacter) {
        const card = removeCharacter.closest("[data-character-id]");
        getActiveProject().characters = getActiveProject().characters.filter(item => item.id !== card.dataset.characterId);
        saveState();
        renderStudioPanel();
      } else if (event.target.closest("#openReaderFromStudio")) {
        document.getElementById("readerBtn").click();
      } else if (event.target.closest("#copySessionText")) {
        try { await navigator.clipboard.writeText(sessionText(false)); toast("正文已复制"); } catch { toast("复制失败", "error"); }
      } else if (event.target.closest("#exportSessionTxt")) {
        downloadText(`${getCurrentSession()?.name || "novel"}.txt`, sessionText(false));
      } else if (event.target.closest("#exportSessionMd")) {
        downloadText(`${getCurrentSession()?.name || "novel"}.md`, sessionText(true), "text/markdown;charset=utf-8");
      }
    });

    document.getElementById("chat").addEventListener("click", async event => {
      const row = event.target.closest(".row.ai");
      if (!row) return;
      if (event.target.closest(".copy-message")) {
        try { await navigator.clipboard.writeText(row.querySelector(".bubble")?.textContent || ""); toast("消息已复制"); } catch { toast("复制失败", "error"); }
      } else if (event.target.closest(".collapse-message")) {
        row.classList.toggle("message-collapsed");
        event.target.textContent = row.classList.contains("message-collapsed") ? "展开" : "折叠";
      }
    });
    document.getElementById("chat").addEventListener("change", event => {
      if (!event.target.matches(".message-category")) return;
      const row = event.target.closest(".row.ai");
      const categories = readLocalObject(LS_MESSAGE_CATEGORIES);
      const key = readerStorageKey();
      categories[key] = categories[key] || {};
      categories[key][row.dataset.assistantIndex] = event.target.value;
      localStorage.setItem(LS_MESSAGE_CATEGORIES, JSON.stringify(categories));
      toast(event.target.value ? `已标记为${event.target.value}` : "已清除分类");
    });

    document.getElementById("commandMask").addEventListener("click", event => { if (event.target.id === "commandMask") closeCommandPalette(); });
    document.getElementById("commandInput").addEventListener("input", event => { commandQuery = event.target.value; renderCommands(); });
    document.getElementById("commandInput").addEventListener("keydown", event => {
      const buttons = Array.from(document.querySelectorAll("#commandResults [data-command-id]:not(:disabled)"));
      if (!buttons.length) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        commandIndex = (commandIndex + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons.forEach((button, index) => button.classList.toggle("selected", index === commandIndex));
        buttons[commandIndex].scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter") {
        event.preventDefault();
        runCommand(buttons[commandIndex]?.dataset.commandId || buttons[0].dataset.commandId);
      }
    });
    document.getElementById("commandResults").addEventListener("click", event => {
      const button = event.target.closest("[data-command-id]");
      if (button) runCommand(button.dataset.commandId);
    });

    document.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openCommandPalette(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") { event.preventDefault(); openConversationSearch(); return; }
      if (event.key === "Escape" && !document.getElementById("commandMask").hidden) { closeCommandPalette(); return; }
      if (event.key === "Escape" && document.body.classList.contains("focus-mode")) { exitFocusMode(); return; }
      if (event.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) { event.preventDefault(); openCommandPalette(); }
      if (event.key === "?" && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")) { setStudioTab("stats"); document.body.classList.remove("studio-collapsed"); }
    });
    document.addEventListener("pointerdown", createClickEffect);
    document.addEventListener("pointermove", event => {
      document.documentElement.style.setProperty("--pointer-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--pointer-y", `${event.clientY}px`);
      const x = (event.clientX / innerWidth - 0.5) * 8;
      const y = (event.clientY / innerHeight - 0.5) * 8;
      document.documentElement.style.setProperty("--parallax-x", `${x}px`);
      document.documentElement.style.setProperty("--parallax-y", `${y}px`);
    }, { passive: true });

    const sessionObserver = new MutationObserver(() => {
      clearTimeout(sessionObserver.timer);
      sessionObserver.timer = setTimeout(() => {
        ensureSessionAssignments();
        const nextSessionId = getCurrentSessionId();
        if (nextSessionId && nextSessionId !== observedSessionId) {
          observedSessionId = nextSessionId;
          restoreSessionWorkspace(nextSessionId);
        }
        renderSessions();
        if (activeTab === "draft" || activeTab === "stats") renderStudioPanel();
      }, 60);
    });
    sessionObserver.observe(document.getElementById("sessionList"), { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

    const readerObserver = new MutationObserver(enhanceReaderContent);
    readerObserver.observe(document.getElementById("readerSegments"), { childList: true, subtree: true });
    readerObserver.observe(document.getElementById("readerContent"), { childList: true, subtree: true });
    const chatObserver = new MutationObserver(() => requestAnimationFrame(decorateMessages));
    chatObserver.observe(document.getElementById("chat"), { childList: true, subtree: true });
  }

  function initStudio() {
    createWorkspace();
    if (innerWidth <= 980) document.body.classList.add("library-collapsed", "studio-collapsed");
    ensureSessionAssignments();
    renderAll();
    bindEvents();
    decorateMessages();
    observedSessionId = getCurrentSessionId();
    restoreSessionWorkspace(observedSessionId);
    document.body.classList.add("studio-ready");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initStudio, { once: true });
  else initStudio();
})();
