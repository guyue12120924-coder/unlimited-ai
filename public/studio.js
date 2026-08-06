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
    relations: [],
    world: "",
    notes: "",
    timeline: "",
    foreshadow: "",
    scenes: [],
    manuscriptClips: [],
    snapshots: [],
    activity: {},
    dailyGoal: 2000,
    createdAt: Date.now()
  };

  const state = loadState();
  let activeTab = "draft";
  const STUDIO_GROUPS = {
    writing: { label: "写作", icon: "✦", tabs: [["draft", "正文"]] },
    structure: { label: "结构", icon: "◇", tabs: [["outline", "大纲与章节"], ["scenes", "场景"]] },
    reference: { label: "资料", icon: "▦", tabs: [["characters", "人物"], ["world", "设定"], ["notes", "便签"]] },
    progress: { label: "进度", icon: "◷", tabs: [["stats", "统计与设置"]] }
  };
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
  let workspaceSearchQuery = "";
  let pendingSnapshotId = null;
  let projectReaderMode = false;
  let projectReaderSaveTimer = null;

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
      normalized.manuscriptClips = Array.isArray(normalized.manuscriptClips) ? normalized.manuscriptClips : [];
      normalized.snapshots = Array.isArray(normalized.snapshots) ? normalized.snapshots : [];
      normalized.relations = Array.isArray(normalized.relations) ? normalized.relations : [];
      normalized.activity = normalized.activity && typeof normalized.activity === "object" ? normalized.activity : {};
      normalized.chapters = Array.isArray(normalized.chapters) ? normalized.chapters.map(chapter => ({ summary: "", notes: "", targetWords: 3000, sessionId: "", ...chapter })) : [];
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
    next.projectReaderPositions = next.projectReaderPositions && typeof next.projectReaderPositions === "object" ? next.projectReaderPositions : {};
    next.settings = {
      motion: "full",
      clickFx: true,
      spotlight: true,
      backgroundDim: 48,
      focusMinutes: 25,
      accent: "moss",
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

  function localDateKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function recordWritingActivity(characters = 0) {
    const project = getActiveProject();
    const key = localDateKey();
    const current = project.activity[key] || { characters: 0, actions: 0 };
    current.characters += Math.max(0, Number(characters) || 0);
    current.actions += 1;
    project.activity[key] = current;
  }

  function activitySummary(project) {
    const today = new Date();
    const days = [];
    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
      const key = localDateKey(date);
      days.push({ key, label: `${date.getMonth() + 1}/${date.getDate()}`, ...(project.activity[key] || { characters: 0, actions: 0 }) });
    }
    let streak = 0;
    for (let offset = 0; offset < 365; offset += 1) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
      const entry = project.activity[localDateKey(date)];
      if (!entry?.actions) break;
      streak += 1;
    }
    return { days, streak, totalCharacters: Object.values(project.activity).reduce((sum, entry) => sum + (Number(entry.characters) || 0), 0) };
  }

  function resolveManuscriptClip(clip, sessions = getSessions()) {
    const session = sessions.find(item => item.id === clip.sessionId);
    const message = session?.messages?.[clip.messageIndex];
    if (!session || message?.role !== "assistant" || typeof message.content !== "string" || !message.content.trim()) return null;
    return { ...clip, session, message };
  }

  function getChapterClips(project, chapterId) {
    const sessions = getSessions();
    return project.manuscriptClips
      .filter(clip => clip.chapterId === chapterId)
      .map(clip => resolveManuscriptClip(clip, sessions))
      .filter(Boolean);
  }

  function projectManuscriptSummary(project = getActiveProject()) {
    const chapters = project.chapters.map(chapter => {
      const clips = getChapterClips(project, chapter.id);
      const characters = clips.reduce((sum, clip) => sum + clip.message.content.replace(/\s/g, "").length, 0);
      return { chapter, clips, characters };
    });
    return {
      chapters,
      readyChapters: chapters.filter(item => item.clips.length),
      clips: chapters.reduce((sum, item) => sum + item.clips.length, 0),
      characters: chapters.reduce((sum, item) => sum + item.characters, 0)
    };
  }

  function collectManuscriptClip(sessionId, messageIndex, chapterId) {
    const project = getActiveProject();
    if (!chapterId || !resolveManuscriptClip({ sessionId, messageIndex })) return;
    const existing = project.manuscriptClips.find(clip => clip.sessionId === sessionId && clip.messageIndex === messageIndex);
    if (existing) existing.chapterId = chapterId;
    else project.manuscriptClips.push({ id: makeId("clip"), chapterId, sessionId, messageIndex, createdAt: Date.now() });
    saveState();
    renderProjects();
    renderStudioPanel();
    toast(existing ? "片段已移动到新章节" : "片段已收录到章节");
  }

  function removeManuscriptClip(clipId) {
    const project = getActiveProject();
    project.manuscriptClips = project.manuscriptClips.filter(clip => clip.id !== clipId);
    saveState();
    renderProjects();
    renderStudioPanel();
    toast("已解除收录，原对话保留");
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
          <button id="workspaceSearch" type="button">全文检索</button>
          <button id="readProject" type="button">阅读作品</button>
          <button id="exportProject" type="button">导出作品</button>
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
        <div class="studio-tabs" role="tablist" aria-label="创作工作区">
          <button data-studio-group="writing" class="active" type="button" role="tab" aria-selected="true"><span>✦</span>写作</button>
          <button data-studio-group="structure" type="button" role="tab" aria-selected="false"><span>◇</span>结构</button>
          <button data-studio-group="reference" type="button" role="tab" aria-selected="false"><span>▦</span>资料</button>
          <button data-studio-group="progress" type="button" role="tab" aria-selected="false"><span>◷</span>进度</button>
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
      <div id="workspaceSearchMask" class="studio-modal-mask" hidden>
        <div id="workspaceSearchDialog" role="dialog" aria-modal="true" aria-label="全文检索">
          <div class="workspace-search-head"><div><span>GLOBAL SEARCH</span><strong>全文检索</strong></div><button id="closeWorkspaceSearch" type="button" aria-label="关闭全文检索">×</button></div>
          <div class="workspace-search-input"><span>⌕</span><input id="workspaceSearchInput" placeholder="搜索作品、对话、章节、人物、场景与设定" autocomplete="off" /></div>
          <div id="workspaceSearchResults"></div>
        </div>
      </div>
      <div id="snapshotPreviewMask" class="studio-modal-mask" hidden>
        <div id="snapshotPreviewDialog" role="dialog" aria-modal="true" aria-label="快照预览">
          <div class="snapshot-preview-head"><div><span>SNAPSHOT</span><strong id="snapshotPreviewTitle">恢复作品快照</strong></div><button id="closeSnapshotPreview" type="button" aria-label="关闭快照预览">×</button></div>
          <div id="snapshotPreviewBody"></div>
          <div class="snapshot-preview-actions"><button id="cancelSnapshotRestore" type="button">取消</button><button id="confirmSnapshotRestore" type="button">确认恢复</button></div>
        </div>
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
    re…16932 tokens truncated…entListener("click", () => {
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
    document.getElementById("workspaceSearch").addEventListener("click", openWorkspaceSearch);
    document.getElementById("readProject").addEventListener("click", () => openProjectReader());
    document.getElementById("exportProject").addEventListener("click", exportActiveProject);
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
    document.getElementById("readerBtn").addEventListener("click", resetReaderPresentation, true);
    document.getElementById("readerClose").addEventListener("click", resetReaderPresentation);
    document.getElementById("readerCopy").addEventListener("click", async event => {
      if (!projectReaderMode) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      try { await navigator.clipboard.writeText(readerDocumentText(false)); toast("整部作品已复制"); } catch { toast("复制失败", "error"); }
    }, true);
    ["readerSelectAll", "readerClear"].forEach(id => document.getElementById(id).addEventListener("click", event => {
      if (!projectReaderMode) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true));
    document.getElementById("readerSegments").addEventListener("click", event => {
      const button = event.target.closest("[data-reader-chapter]");
      if (projectReaderMode && button) jumpProjectReaderChapter(button.dataset.readerChapter);
    });
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
        const statusButton = event.target.closest(".chapter-status");
        if (statusButton) chapter.done = !chapter.done;
        state.activeChapterId = chapter.id;
        saveState();
        renderChapters();
        if (statusButton) {
          if (activeTab === "stats" || activeTab === "outline") renderStudioPanel();
        } else {
          setStudioTab("outline");
        }
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
      const button = event.target.closest("[data-studio-group]");
      if (button) setStudioTab(STUDIO_GROUPS[button.dataset.studioGroup].tabs[0][0]);
    });
    document.getElementById("studioPanelBody").addEventListener("click", event => {
      const button = event.target.closest("[data-studio-subtab]");
      if (button) setStudioTab(button.dataset.studioSubtab);
    });
    document.getElementById("studioPanelBody").addEventListener("input", event => {
      const project = getActiveProject();
      const field = event.target.dataset.projectField;
      if (field) {
        recordWritingActivity(Math.max(0, event.target.value.length - String(project[field] || "").length));
        project[field] = event.target.value;
      }
      const chapterField = event.target.dataset.chapterField;
      if (chapterField) {
        const chapter = project.chapters.find(item => item.id === state.activeChapterId);
        if (chapter) {
          if (chapterField === "targetWords") chapter.targetWords = Math.max(100, Number(event.target.value) || 3000);
          else {
            recordWritingActivity(Math.max(0, event.target.value.length - String(chapter[chapterField] || "").length));
            chapter[chapterField] = event.target.value;
          }
        }
      }
      if (event.target.matches("[data-character-note]")) {
        const character = project.characters.find(item => item.id === event.target.dataset.characterNote);
        if (character) {
          recordWritingActivity(Math.max(0, event.target.value.length - String(character.note || "").length));
          character.note = event.target.value;
        }
      }
      if (event.target.id === "dailyGoalInput") project.dailyGoal = Math.max(100, Number(event.target.value) || 2000);
      if (event.target.id === "backgroundDimSetting") state.settings.backgroundDim = Number(event.target.value);
      saveState();
      applySettings();
    });
    document.getElementById("studioPanelBody").addEventListener("change", event => {
      if (event.target.id === "clickFxSetting") state.settings.clickFx = event.target.checked;
      if (event.target.id === "spotlightSetting") state.settings.spotlight = event.target.checked;
      if (event.target.matches('select[data-chapter-field="sessionId"]')) {
        const chapter = getActiveProject().chapters.find(item => item.id === state.activeChapterId);
        if (chapter) chapter.sessionId = event.target.value;
      }
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
      if (event.target.closest("#openReaderFromStudio")) {
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
    document.getElementById("workspaceSearchMask").addEventListener("click", event => { if (event.target.id === "workspaceSearchMask") closeWorkspaceSearch(); });
    document.getElementById("closeWorkspaceSearch").addEventListener("click", closeWorkspaceSearch);
    document.getElementById("workspaceSearchInput").addEventListener("input", event => {
      workspaceSearchQuery = event.target.value;
      renderWorkspaceSearch();
    });
    document.getElementById("workspaceSearchResults").addEventListener("click", event => {
      const button = event.target.closest("[data-search-result]");
      if (!button) return;
      openWorkspaceSearchResult(document.getElementById("workspaceSearchResults").searchResults?.[Number(button.dataset.searchResult)]);
    });
    document.getElementById("snapshotPreviewMask").addEventListener("click", event => { if (event.target.id === "snapshotPreviewMask") closeSnapshotPreview(); });
    document.getElementById("closeSnapshotPreview").addEventListener("click", closeSnapshotPreview);
    document.getElementById("cancelSnapshotRestore").addEventListener("click", closeSnapshotPreview);
    document.getElementById("confirmSnapshotRestore").addEventListener("click", () => {
      const snapshotId = pendingSnapshotId;
      closeSnapshotPreview();
      if (snapshotId) restoreProjectSnapshot(snapshotId);
    });
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
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "f") { event.preventDefault(); openWorkspaceSearch(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") { event.preventDefault(); openConversationSearch(); return; }
      if (event.key === "Escape" && projectReaderMode) { resetReaderPresentation(); return; }
      if (event.key === "Escape" && !document.getElementById("commandMask").hidden) { closeCommandPalette(); return; }
      if (event.key === "Escape" && !document.getElementById("workspaceSearchMask").hidden) { closeWorkspaceSearch(); return; }
      if (event.key === "Escape" && !document.getElementById("snapshotPreviewMask").hidden) { closeSnapshotPreview(); return; }
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

