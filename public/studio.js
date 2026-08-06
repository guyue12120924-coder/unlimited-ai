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
    if (!snapshot) return;
    const fields = ["description", "synopsis", "outline", "characters", "relations", "world", "notes", "timeline", "foreshadow", "scenes", "chapters", "manuscriptClips", "dailyGoal"];
    fields.forEach(field => { project[field] = clone(snapshot.payload[field] ?? DEFAULT_PROJECT[field]); });
    state.activeChapterId = project.chapters.some(chapter => chapter.id === state.activeChapterId) ? state.activeChapterId : null;
    saveState();
    renderAll();
    toast("作品快照已恢复");
  }

  function projectSnapshotSummary(project) {
    return {
      chapters: (project.chapters || []).length,
      characters: (project.characters || []).length,
      relations: (project.relations || []).length,
      scenes: (project.scenes || []).length,
      clips: (project.manuscriptClips || []).length,
      text: [project.description, project.synopsis, project.outline, project.world, project.notes, project.timeline, project.foreshadow].join("").replace(/\s/g, "").length
    };
  }

  function openSnapshotPreview(snapshotId) {
    const project = getActiveProject();
    const snapshot = project.snapshots.find(item => item.id === snapshotId);
    if (!snapshot) return;
    pendingSnapshotId = snapshotId;
    const current = projectSnapshotSummary(project);
    const saved = projectSnapshotSummary(snapshot.payload);
    const metrics = [
      ["资料字数", current.text, saved.text],
      ["章节", current.chapters, saved.chapters],
      ["人物", current.characters, saved.characters],
      ["关系", current.relations, saved.relations],
      ["场景", current.scenes, saved.scenes],
      ["成稿片段", current.clips, saved.clips]
    ];
    document.getElementById("snapshotPreviewTitle").textContent = snapshot.label;
    document.getElementById("snapshotPreviewBody").innerHTML = `<p>恢复后将用快照中的创作资料覆盖当前作品，对话记录不会改变。</p><div class="snapshot-compare"><div><span>项目</span><strong>当前</strong><strong>快照</strong></div>${metrics.map(([label, now, before]) => `<div class="${now === before ? "same" : "changed"}"><span>${label}</span><strong>${Number(now).toLocaleString()}</strong><strong>${Number(before).toLocaleString()}</strong></div>`).join("")}</div>`;
    document.getElementById("snapshotPreviewMask").hidden = false;
  }

  function closeSnapshotPreview() {
    pendingSnapshotId = null;
    document.getElementById("snapshotPreviewMask").hidden = true;
  }

  function collectWorkspaceSearchResults(query) {
    const clean = query.trim().toLowerCase();
    if (!clean) return [];
    const results = [];
    const push = (type, label, text, projectId, tab, sessionId = null) => {
      const haystack = `${label} ${text || ""}`.toLowerCase();
      if (!haystack.includes(clean)) return;
      const index = haystack.indexOf(clean);
      const source = String(text || label).replace(/\s+/g, " ").trim();
      const start = Math.max(0, Math.min(source.length, index) - 38);
      results.push({ type, label, excerpt: source.slice(start, start + 110), projectId, tab, sessionId });
    };
    const sessions = getSessions();
    state.projects.forEach(project => {
      push("作品", project.name, [project.description, project.synopsis, project.outline].join(" "), project.id, "outline");
      push("设定", `${project.name} · 世界观`, [project.world, project.timeline, project.foreshadow].join(" "), project.id, "world");
      push("便签", `${project.name} · 灵感便签`, project.notes, project.id, "notes");
      project.chapters.forEach(chapter => push("章节", chapter.name, chapter.name, project.id, "draft"));
      project.characters.forEach(character => push("人物", character.name, `${character.role || ""} ${character.note || ""}`, project.id, "characters"));
      project.relations.forEach(relation => {
        const from = project.characters.find(character => character.id === relation.fromId)?.name || "未知";
        const to = project.characters.find(character => character.id === relation.toId)?.name || "未知";
        push("关系", `${from} → ${to}`, `${relation.type || ""} ${relation.note || ""}`, project.id, "characters");
      });
      project.scenes.forEach(scene => push("场景", scene.title, scene.summary, project.id, "scenes"));
      sessions.filter(session => project.sessionIds.includes(session.id)).forEach(session => {
        const matched = (session.messages || []).filter(message => String(message.content || "").toLowerCase().includes(clean)).slice(0, 3);
        if (session.name.toLowerCase().includes(clean) && !matched.length) push("会话", session.name, session.name, project.id, "draft", session.id);
        matched.forEach(message => push(message.role === "assistant" ? "AI 内容" : "提问", session.name, message.content, project.id, "draft", session.id));
      });
    });
    return results.slice(0, 60);
  }

  function renderWorkspaceSearch() {
    const root = document.getElementById("workspaceSearchResults");
    const results = collectWorkspaceSearchResults(workspaceSearchQuery);
    if (!workspaceSearchQuery.trim()) {
      root.innerHTML = `<div class="workspace-search-empty"><strong>搜索整个创作工作区</strong><p>结果不会发送到网络。</p></div>`;
      return;
    }
    root.innerHTML = results.length ? results.map((result, index) => `<button type="button" data-search-result="${index}"><span>${escapeHtml(result.type)}</span><div><strong>${escapeHtml(result.label)}</strong><p>${escapeHtml(result.excerpt || "匹配标题")}</p></div></button>`).join("") : `<div class="workspace-search-empty"><strong>没有匹配内容</strong><p>试试作品名、人物、地点或正文片段。</p></div>`;
    root.searchResults = results;
  }

  function openWorkspaceSearch() {
    workspaceSearchQuery = "";
    const mask = document.getElementById("workspaceSearchMask");
    const input = document.getElementById("workspaceSearchInput");
    mask.hidden = false;
    input.value = "";
    renderWorkspaceSearch();
    requestAnimationFrame(() => input.focus());
  }

  function closeWorkspaceSearch() {
    document.getElementById("workspaceSearchMask").hidden = true;
  }

  function openWorkspaceSearchResult(result) {
    if (!result) return;
    closeWorkspaceSearch();
    state.activeProjectId = result.projectId;
    saveState();
    renderAll();
    document.body.classList.remove("studio-collapsed");
    if (result.tab) setStudioTab(result.tab);
    if (result.sessionId) switchSession(result.sessionId);
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
    const readProject = document.getElementById("readProject");
    if (readProject) readProject.disabled = projectManuscriptSummary().clips === 0;
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
      const assistantMessages = (session?.messages || []).map((message, messageIndex) => ({ message, messageIndex })).filter(item => item.message.role === "assistant");
      const manuscript = projectManuscriptSummary(project);
      body.innerHTML = `<div class="studio-pane">
        <div class="pane-hero"><span>MANUSCRIPT</span><h3>${escapeHtml(session?.name || "当前会话")}</h3><p>${assistantMessages.length} 个可整理片段 · ${manuscript.clips} 个已收录</p></div>
        <div class="studio-action-grid">
          <button id="openReaderFromStudio" type="button"${assistantMessages.length ? "" : " disabled"}>进入阅读模式</button>
          <button id="openProjectReaderFromStudio" type="button"${manuscript.clips ? "" : " disabled"}>阅读整部作品</button>
          <button id="copySessionText" type="button"${assistantMessages.length ? "" : " disabled"}>复制全部正文</button>
          <button id="exportSessionTxt" type="button"${assistantMessages.length ? "" : " disabled"}>导出 TXT</button>
          <button id="exportSessionMd" type="button"${assistantMessages.length ? "" : " disabled"}>导出 Markdown</button>
        </div>
        <div class="draft-fragment-list">${assistantMessages.length ? assistantMessages.map((item, index) => {
          const collected = project.manuscriptClips.find(clip => clip.sessionId === session?.id && clip.messageIndex === item.messageIndex);
          return `<article class="draft-fragment-card${collected ? " collected" : ""}" data-message-index="${item.messageIndex}">
            <button class="draft-fragment" type="button" data-fragment-index="${index}"><span>片段 ${String(index + 1).padStart(2, "0")}${collected ? " · 已收录" : ""}</span><p>${escapeHtml(item.message.content.slice(0, 90))}</p></button>
            <div class="fragment-collect-row"><select data-clip-chapter aria-label="收录章节"${project.chapters.length ? "" : " disabled"}><option value="">${project.chapters.length ? "选择章节" : "请先创建章节"}</option>${project.chapters.map(chapter => `<option value="${escapeHtml(chapter.id)}"${collected?.chapterId === chapter.id ? " selected" : ""}>${escapeHtml(chapter.name)}</option>`).join("")}</select><button class="collect-fragment" data-message-index="${item.messageIndex}" type="button"${project.chapters.length ? "" : " disabled"}>${collected ? "移动" : "收录"}</button></div>
          </article>`;
        }).join("") : `<div class="studio-empty-state"><strong>正文会出现在这里</strong><p>AI 生成内容后，可以整理、阅读和导出。</p></div>`}</div>
      </div>`;
    } else if (activeTab === "outline") {
      const activeChapter = project.chapters.find(chapter => chapter.id === state.activeChapterId);
      const assignedSessions = getSessions().filter(item => project.sessionIds.includes(item.id));
      const chapterClips = activeChapter ? getChapterClips(project, activeChapter.id) : [];
      body.innerHTML = `<div class="studio-pane editor-pane">
        ${activeChapter ? `<section class="chapter-editor">
          <div class="chapter-editor-head"><div><span>CHAPTER DETAIL</span><h3>${escapeHtml(activeChapter.name)}</h3></div><button class="chapter-editor-status${activeChapter.done ? " done" : ""}" type="button">${activeChapter.done ? "已完成" : "创作中"}</button></div>
          <label><span>本章摘要</span><textarea data-chapter-field="summary" placeholder="用几句话说明本章发生了什么">${escapeHtml(activeChapter.summary)}</textarea></label>
          <label><span>写作备忘</span><textarea data-chapter-field="notes" placeholder="记录情绪、视角、伏笔和下一步修改方向">${escapeHtml(activeChapter.notes)}</textarea></label>
          <div class="chapter-editor-meta"><label><span>目标字数</span><input data-chapter-field="targetWords" type="number" min="100" step="100" value="${Number(activeChapter.targetWords) || 3000}" /></label><label><span>关联会话</span><select data-chapter-field="sessionId"><option value="">暂不关联</option>${assignedSessions.map(item => `<option value="${escapeHtml(item.id)}"${activeChapter.sessionId === item.id ? " selected" : ""}>${escapeHtml(item.name || "未命名会话")}</option>`).join("")}</select></label></div>
          <section class="chapter-manuscript"><div class="chapter-manuscript-head"><div><strong>成稿片段</strong><span>${chapterClips.length} 个片段 · ${chapterClips.reduce((sum, clip) => sum + clip.message.content.replace(/\s/g, "").length, 0).toLocaleString()} 字</span></div><button class="read-chapter-manuscript" type="button"${chapterClips.length ? "" : " disabled"}>阅读本章</button></div><div class="chapter-clip-list">${chapterClips.length ? chapterClips.map((clip, index) => `<article data-clip-id="${escapeHtml(clip.id)}" draggable="true"><button class="clip-drag" type="button" title="拖动排序">⋮⋮</button><div><strong>片段 ${String(index + 1).padStart(2, "0")}</strong><span>${escapeHtml(clip.session.name || "未命名会话")}</span><p>${escapeHtml(clip.message.content.replace(/\s+/g, " ").slice(0, 100))}</p></div><button class="open-clip-source" type="button" title="打开原会话">↗</button><button class="remove-clip" type="button" title="解除收录">×</button></article>`).join("") : `<p class="chapter-clips-empty">在“正文”页把 AI 片段收录到本章。</p>`}</div></section>
        </section>` : `<div class="chapter-editor-empty"><strong>选择一个章节</strong><p>从左侧章节列表进入详情，继续整理摘要、目标和关联会话。</p></div>`}
        <label><span>作品简介</span><textarea data-project-field="description" placeholder="记录作品定位、类型与一句话介绍">${escapeHtml(project.description)}</textarea></label>
        <label><span>故事梗概</span><textarea data-project-field="synopsis" placeholder="记录故事核心冲突、主角目标与结局方向">${escapeHtml(project.synopsis)}</textarea></label>
        <label><span>章节大纲</span><textarea class="large" data-project-field="outline" placeholder="按卷、章或场景整理故事结构">${escapeHtml(project.outline)}</textarea></label>
        <div class="autosave-note">内容仅保存在当前浏览器，不会发送给 AI。</div>
      </div>`;
    } else if (activeTab === "characters") {
      const characterOptions = project.characters.map(character => `<option value="${escapeHtml(character.id)}">${escapeHtml(character.name)}</option>`).join("");
      body.innerHTML = `<div class="studio-pane">
        <div id="characterForm" class="character-form"><input id="characterName" maxlength="30" placeholder="人物姓名" /><input id="characterRole" maxlength="40" placeholder="身份或阵营" /><button id="addCharacter" type="button">添加人物</button></div>
        <div class="character-grid">${project.characters.length ? project.characters.map(character => `<article class="character-card" data-character-id="${escapeHtml(character.id)}"><div class="character-monogram">${escapeHtml(character.name.slice(0, 1))}</div><div><strong>${escapeHtml(character.name)}</strong><span>${escapeHtml(character.role || "未设置身份")}</span></div><button class="remove-character" type="button" title="删除人物">×</button><textarea data-character-note="${escapeHtml(character.id)}" placeholder="性格、目标、关系、外貌与备注">${escapeHtml(character.note || "")}</textarea></article>`).join("") : `<div class="studio-empty-state"><strong>建立人物档案</strong><p>人物卡不会自动加入 AI 上下文。</p></div>`}</div>
        <section class="relation-section"><div class="relation-heading"><div><span>RELATIONSHIPS</span><strong>人物关系</strong></div><small>${project.relations.length} 条关系</small></div>
          <div id="relationForm" class="relation-form">
            <select id="relationFrom" aria-label="关系起点"${project.characters.length < 2 ? " disabled" : ""}><option value="">选择人物</option>${characterOptions}</select>
            <span>→</span>
            <select id="relationTo" aria-label="关系终点"${project.characters.length < 2 ? " disabled" : ""}><option value="">选择人物</option>${characterOptions}</select>
            <input id="relationType" maxlength="30" placeholder="关系，如盟友、师徒"${project.characters.length < 2 ? " disabled" : ""} />
            <button id="addRelation" type="button"${project.characters.length < 2 ? " disabled" : ""}>添加关系</button>
          </div>
          <div class="relation-list">${project.relations.length ? project.relations.map(relation => {
            const from = project.characters.find(character => character.id === relation.fromId);
            const to = project.characters.find(character => character.id === relation.toId);
            return `<article data-relation-id="${escapeHtml(relation.id)}"><div class="relation-route"><span>${escapeHtml(from?.name || "未知")}</span><i>${escapeHtml(relation.type || "关联")}</i><span>${escapeHtml(to?.name || "未知")}</span></div><button class="remove-relation" type="button" title="删除关系">×</button><textarea data-relation-note placeholder="补充关系变化、矛盾或共同目标">${escapeHtml(relation.note || "")}</textarea></article>`;
          }).join("") : `<div class="relation-empty">至少添加两个人物后，可以建立人物关系。</div>`}</div>
        </section>
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
      const activity = activitySummary(project);
      const manuscript = projectManuscriptSummary(project);
      let storageBytes = 0;
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        storageBytes += (key.length + (localStorage.getItem(key) || "").length) * 2;
      }
      body.innerHTML = `<div class="studio-pane stats-pane">
        <div class="stat-grid"><div><strong>${words.toLocaleString()}</strong><span>当前会话正文</span></div><div><strong>${assistant.length}</strong><span>当前 AI 片段</span></div><div><strong>${project.chapters.length}</strong><span>章节</span></div><div><strong>${chapterDone}</strong><span>已完成</span></div><div><strong>${manuscript.clips}</strong><span>成稿片段</span></div><div><strong>${manuscript.characters.toLocaleString()}</strong><span>成稿字数</span></div><div><strong>${activity.streak}</strong><span>连续写作天数</span></div><div><strong>${activity.totalCharacters.toLocaleString()}</strong><span>本地新增字数</span></div></div>
        <section class="manuscript-check"><div class="manuscript-check-head"><div><strong>成稿检查</strong><span>${manuscript.readyChapters.length} / ${project.chapters.length} 章已有正文</span></div><button id="openProjectReaderFromStats" type="button"${manuscript.clips ? "" : " disabled"}>阅读作品</button></div><div class="manuscript-check-list">${manuscript.chapters.length ? manuscript.chapters.map(item => { const target = Math.max(100, Number(item.chapter.targetWords) || 3000); const percent = Math.min(100, Math.round(item.characters / target * 100)); const ready = [item.chapter.summary ? "摘要" : "缺摘要", item.chapter.sessionId ? "会话" : "缺会话", item.clips.length ? `${item.clips.length} 片段` : "缺正文"]; return `<button data-check-chapter="${escapeHtml(item.chapter.id)}" type="button"><div><strong>${escapeHtml(item.chapter.name)}</strong><span>${item.characters.toLocaleString()} / ${target.toLocaleString()} 字</span></div><i><b style="width:${percent}%"></b></i><small>${ready.join(" · ")}</small></button>`; }).join("") : `<p>创建章节后，这里会显示成稿准备情况。</p>`}</div></section>
        <section class="activity-panel"><div class="activity-head"><div><strong>写作热度</strong><span>最近 14 天</span></div><small>今天 ${activity.days.at(-1)?.characters || 0} 字</small></div><div class="activity-heatmap">${activity.days.map(day => { const level = day.characters >= 500 ? 4 : day.characters >= 200 ? 3 : day.characters >= 50 ? 2 : day.actions ? 1 : 0; return `<div data-level="${level}" title="${day.key} · ${day.characters} 字"><i></i><span>${escapeHtml(day.label)}</span></div>`; }).join("")}</div></section>
        <label class="goal-control"><span>本次写作目标</span><input type="number" min="100" step="100" value="${Number(project.dailyGoal) || 2000}" id="dailyGoalInput" /></label>
        <div class="goal-progress"><i style="width:${progress}%"></i></div><p class="goal-caption">已完成 ${progress}%</p>
        <div class="focus-settings"><div><strong>专注写作</strong><span>隐藏两侧面板并启动计时</span></div><label><select id="focusMinutesSetting" aria-label="专注时长"><option value="15"${state.settings.focusMinutes === 15 ? " selected" : ""}>15 分钟</option><option value="25"${state.settings.focusMinutes === 25 ? " selected" : ""}>25 分钟</option><option value="45"${state.settings.focusMinutes === 45 ? " selected" : ""}>45 分钟</option><option value="60"${state.settings.focusMinutes === 60 ? " selected" : ""}>60 分钟</option></select><button id="startFocusMode" type="button">开始</button></label></div>
        <div class="snapshot-panel"><div class="snapshot-head"><div><strong>作品快照</strong><span>保存大纲、人物、设定、章节、场景和成稿收录</span></div><button id="createSnapshot" type="button">保存快照</button></div><div class="snapshot-list">${project.snapshots.length ? project.snapshots.slice(0, 5).map(snapshot => `<div data-snapshot-id="${escapeHtml(snapshot.id)}"><span>${escapeHtml(snapshot.label)}</span><button class="restore-snapshot" type="button">恢复</button><button class="delete-snapshot" type="button" title="删除快照">×</button></div>`).join("") : `<p>还没有作品快照</p>`}</div></div>
        <div class="storage-note">本地数据约 ${(storageBytes / 1024).toFixed(1)} KB</div>
        <div class="accent-settings"><strong>界面强调色</strong><div class="accent-swatches"><button data-accent="moss" type="button"><i></i><span>苔绿</span></button><button data-accent="gold" type="button"><i></i><span>鎏金</span></button><button data-accent="rose" type="button"><i></i><span>烟粉</span></button></div></div>
        <div class="motion-settings"><strong>界面动效</strong><div class="segmented"><button data-motion="off" type="button">关闭</button><button data-motion="reduced" type="button">精简</button><button data-motion="full" type="button">完整</button></div><label><input id="clickFxSetting" type="checkbox"${state.settings.clickFx ? " checked" : ""} /> 点击涟漪</label><label><input id="spotlightSetting" type="checkbox"${state.settings.spotlight ? " checked" : ""} /> 鼠标环境光</label><label class="dim-control"><span>背景遮罩</span><input id="backgroundDimSetting" type="range" min="20" max="80" value="${state.settings.backgroundDim}" /></label></div>
      </div>`;
      body.querySelectorAll("[data-motion]").forEach(button => button.classList.toggle("active", button.dataset.motion === state.settings.motion));
      body.querySelectorAll("[data-accent]").forEach(button => button.classList.toggle("active", button.dataset.accent === state.settings.accent));
    }
    bindRenderedPanelControls(body);
  }

  function bindRenderedPanelControls(body) {
    body.querySelector("#openProjectReaderFromStudio")?.addEventListener("click", () => openProjectReader());
    body.querySelector("#openProjectReaderFromStats")?.addEventListener("click", () => openProjectReader());
    body.querySelectorAll(".collect-fragment").forEach(button => button.addEventListener("click", () => {
      const chapterId = button.closest(".draft-fragment-card")?.querySelector("[data-clip-chapter]")?.value;
      collectManuscriptClip(getCurrentSessionId(), Number(button.dataset.messageIndex), chapterId);
    }));
    body.querySelectorAll(".draft-fragment").forEach(button => button.addEventListener("click", () => {
      const rows = document.querySelectorAll("#chat .row.ai");
      const row = rows[Number(button.dataset.fragmentIndex)];
      row?.scrollIntoView({ block: "center", behavior: state.settings.motion === "off" ? "auto" : "smooth" });
    }));
    body.querySelector(".read-chapter-manuscript")?.addEventListener("click", () => openProjectReader(state.activeChapterId));
    body.querySelectorAll(".remove-clip").forEach(button => button.addEventListener("click", () => removeManuscriptClip(button.closest("[data-clip-id]")?.dataset.clipId)));
    body.querySelectorAll(".open-clip-source").forEach(button => button.addEventListener("click", () => {
      const clipId = button.closest("[data-clip-id]")?.dataset.clipId;
      const clip = getActiveProject().manuscriptClips.find(item => item.id === clipId);
      if (!clip) return;
      switchSession(clip.sessionId);
      setTimeout(() => {
        setStudioTab("draft");
        document.querySelector(`.draft-fragment-card[data-message-index="${clip.messageIndex}"]`)?.scrollIntoView({ block: "center", behavior: state.settings.motion === "off" ? "auto" : "smooth" });
      }, 100);
    }));
    body.querySelectorAll("[data-clip-id]").forEach(card => {
      card.addEventListener("dragstart", event => event.dataTransfer.setData("text/manuscript-clip", card.dataset.clipId));
      card.addEventListener("dragover", event => event.preventDefault());
      card.addEventListener("drop", event => {
        event.preventDefault();
        const sourceId = event.dataTransfer.getData("text/manuscript-clip");
        const targetId = card.dataset.clipId;
        if (!sourceId || sourceId === targetId) return;
        const clips = getActiveProject().manuscriptClips;
        const from = clips.findIndex(item => item.id === sourceId);
        const to = clips.findIndex(item => item.id === targetId);
        if (from < 0 || to < 0 || clips[from].chapterId !== clips[to].chapterId) return;
        clips.splice(to, 0, clips.splice(from, 1)[0]);
        saveState();
        renderStudioPanel();
      });
    });
    body.querySelectorAll("[data-check-chapter]").forEach(button => button.addEventListener("click", () => {
      state.activeChapterId = button.dataset.checkChapter;
      saveState();
      renderChapters();
      setStudioTab("outline");
    }));
    body.querySelector("#addCharacter")?.addEventListener("click", () => {
      const name = document.getElementById("characterName").value.trim();
      const role = document.getElementById("characterRole").value.trim();
      if (!name) { document.getElementById("characterName").focus(); return; }
      getActiveProject().characters.push({ id: makeId("character"), name, role, note: "" });
      saveState();
      renderStudioPanel();
      toast("人物卡已添加");
    });
    body.querySelector("#addRelation")?.addEventListener("click", () => {
      const fromId = document.getElementById("relationFrom").value;
      const toId = document.getElementById("relationTo").value;
      const type = document.getElementById("relationType").value.trim();
      if (!fromId || !toId || fromId === toId || !type) { toast("请选择两个不同人物并填写关系", "error"); return; }
      getActiveProject().relations.push({ id: makeId("relation"), fromId, toId, type, note: "", createdAt: Date.now() });
      saveState();
      renderStudioPanel();
      toast("人物关系已添加");
    });
    body.querySelectorAll("[data-relation-note]").forEach(input => input.addEventListener("input", () => {
      const relation = getActiveProject().relations.find(item => item.id === input.closest("[data-relation-id]")?.dataset.relationId);
      if (relation) {
        recordWritingActivity(Math.max(0, input.value.length - String(relation.note || "").length));
        relation.note = input.value;
      }
      saveState();
    }));
    body.querySelectorAll(".remove-relation").forEach(button => button.addEventListener("click", () => {
      const relationId = button.closest("[data-relation-id]")?.dataset.relationId;
      getActiveProject().relations = getActiveProject().relations.filter(item => item.id !== relationId);
      saveState();
      renderStudioPanel();
    }));
    body.querySelectorAll(".remove-character").forEach(button => button.addEventListener("click", () => {
      const characterId = button.closest("[data-character-id]")?.dataset.characterId;
      const project = getActiveProject();
      project.characters = project.characters.filter(item => item.id !== characterId);
      project.relations = project.relations.filter(item => item.fromId !== characterId && item.toId !== characterId);
      saveState();
      renderStudioPanel();
    }));
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
      if (scene) {
        recordWritingActivity(Math.max(0, input.value.length - String(scene[input.dataset.sceneField] || "").length));
        scene[input.dataset.sceneField] = input.value;
      }
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
    body.querySelectorAll(".restore-snapshot").forEach(button => button.addEventListener("click", () => openSnapshotPreview(button.closest("[data-snapshot-id]")?.dataset.snapshotId)));
    body.querySelectorAll(".delete-snapshot").forEach(button => button.addEventListener("click", () => deleteProjectSnapshot(button.closest("[data-snapshot-id]")?.dataset.snapshotId)));
    body.querySelector(".chapter-editor-status")?.addEventListener("click", () => {
      const chapter = getActiveProject().chapters.find(item => item.id === state.activeChapterId);
      if (!chapter) return;
      chapter.done = !chapter.done;
      saveState();
      renderChapters();
      renderStudioPanel();
    });
    body.querySelectorAll("[data-accent]").forEach(button => button.addEventListener("click", () => {
      state.settings.accent = button.dataset.accent;
      saveState();
      applySettings();
      renderStudioPanel();
    }));
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
    const chapter = { id: makeId("chapter"), name: cleanName, summary: "", notes: "", targetWords: 3000, sessionId: "", done: false, createdAt: Date.now() };
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
    if (projectReaderMode) return;
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
    if (projectReaderMode) {
      clearTimeout(projectReaderSaveTimer);
      projectReaderSaveTimer = setTimeout(() => {
        state.projectReaderPositions[getActiveProject().id] = wrap.scrollTop;
        saveState();
      }, 120);
    }
  }

  function readerDocumentText(markdown = false) {
    return Array.from(document.querySelectorAll("#readerContent .reader-chapter")).map(chapter => {
      const title = chapter.querySelector(".reader-chapter-label")?.textContent || "章节";
      const fragments = Array.from(chapter.querySelectorAll(".manuscript-fragment")).map(item => item.textContent || "");
      const text = fragments.length ? fragments.join("\n\n") : chapter.querySelector(".reader-chapter-text")?.textContent || "";
      return markdown ? `## ${title}\n\n${text}` : `${title}\n\n${text}`;
    }).join("\n\n---\n\n");
  }

  function resetReaderPresentation() {
    projectReaderMode = false;
    document.body.classList.remove("project-reader-open");
    document.getElementById("readerTitle").textContent = "小说阅读";
    document.querySelector(".reader-sidebar-head strong").textContent = "内容片段";
  }

  function jumpProjectReaderChapter(chapterId) {
    const wrap = document.getElementById("readerPageWrap");
    const target = document.querySelector(`[data-project-reader-chapter="${CSS.escape(chapterId)}"]`);
    if (!wrap || !target) return;
    wrap.scrollTo({ top: Math.max(0, target.offsetTop - 24), behavior: state.settings.motion === "off" ? "auto" : "smooth" });
    document.querySelectorAll("[data-reader-chapter]").forEach(button => button.classList.toggle("selected", button.dataset.readerChapter === chapterId));
    document.getElementById("readerSidebar").classList.remove("open");
  }

  function openProjectReader(chapterId = "") {
    const project = getActiveProject();
    const manuscript = projectManuscriptSummary(project);
    if (!manuscript.clips) { toast("请先把 AI 片段收录到章节", "error"); return; }
    projectReaderMode = true;
    document.body.classList.add("project-reader-open", "reader-open");
    document.getElementById("readerMask").classList.add("open");
    document.getElementById("readerSidebar").classList.remove("open");
    document.getElementById("readerTitle").textContent = project.name;
    document.getElementById("readerSummary").textContent = `${manuscript.readyChapters.length} 个章节 · ${manuscript.clips} 个片段 · ${manuscript.characters.toLocaleString()} 字`;
    document.querySelector(".reader-sidebar-head strong").textContent = "章节目录";
    document.getElementById("readerSegments").innerHTML = manuscript.readyChapters.map((item, index) => `<button class="reader-segment-item project-reader-nav" data-reader-chapter="${escapeHtml(item.chapter.id)}" type="button"><span class="reader-segment-copy"><strong>第 ${String(index + 1).padStart(2, "0")} 章</strong><span>${escapeHtml(item.chapter.name)} · ${item.characters.toLocaleString()} 字</span></span></button>`).join("");
    document.getElementById("readerContent").innerHTML = manuscript.readyChapters.map((item, index) => `<section class="reader-chapter" data-project-reader-chapter="${escapeHtml(item.chapter.id)}"><div class="reader-chapter-label">${escapeHtml(item.chapter.name)}</div><div class="reader-chapter-text">${item.clips.map((clip, clipIndex) => `<p class="manuscript-fragment" data-clip-number="${clipIndex + 1}">${escapeHtml(clip.message.content)}</p>`).join("")}</div></section>`).join("");
    document.getElementById("readerEmpty").classList.remove("visible");
    document.getElementById("readerContent").hidden = false;
    document.getElementById("readerCopy").disabled = false;
    requestAnimationFrame(() => {
      const wrap = document.getElementById("readerPageWrap");
      if (chapterId) jumpProjectReaderChapter(chapterId);
      else wrap.scrollTop = Math.min(Number(state.projectReaderPositions[project.id]) || 0, Math.max(0, wrap.scrollHeight - wrap.clientHeight));
      updateReaderProgress();
    });
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

  function projectMarkdown() {
    const project = getActiveProject();
    const sessions = getSessions().filter(session => project.sessionIds.includes(session.id));
    const lines = [`# ${project.name}`, "", project.description || "暂无作品简介", "", "## 故事梗概", "", project.synopsis || "暂无", "", "## 章节大纲", "", project.outline || "暂无"];
    lines.push("", "## 章节");
    if (!project.chapters.length) lines.push("", "暂无章节");
    project.chapters.forEach((chapter, index) => {
      const linked = sessions.find(session => session.id === chapter.sessionId);
      lines.push("", `### ${index + 1}. ${chapter.name}`, "", `- 状态：${chapter.done ? "已完成" : "创作中"}`, `- 目标字数：${Number(chapter.targetWords) || 3000}`, `- 关联会话：${linked?.name || "无"}`, "", "**本章摘要**", "", chapter.summary || "暂无", "", "**写作备忘**", "", chapter.notes || "暂无");
      const clips = getChapterClips(project, chapter.id);
      if (clips.length) {
        lines.push("", "**收录正文**");
        clips.forEach((clip, clipIndex) => lines.push("", `#### 正文片段 ${clipIndex + 1}`, "", clip.message.content));
      }
    });
    lines.push("", "## 人物");
    if (!project.characters.length) lines.push("", "暂无人物");
    project.characters.forEach(character => lines.push("", `### ${character.name}`, "", `- 身份：${character.role || "未设置"}`, "", character.note || "暂无备注"));
    if (project.relations.length) {
      lines.push("", "### 人物关系");
      project.relations.forEach(relation => {
        const from = project.characters.find(item => item.id === relation.fromId)?.name || "未知";
        const to = project.characters.find(item => item.id === relation.toId)?.name || "未知";
        lines.push("", `- ${from} → ${relation.type || "关联"} → ${to}${relation.note ? `：${relation.note}` : ""}`);
      });
    }
    lines.push("", "## 场景");
    if (!project.scenes.length) lines.push("", "暂无场景");
    project.scenes.forEach((scene, index) => {
      const chapter = project.chapters.find(item => item.id === scene.chapterId);
      lines.push("", `### ${index + 1}. ${scene.title}`, "", `- 状态：${({ todo: "待写", writing: "进行中", done: "已完成" })[scene.status] || "待写"}`, `- 所属章节：${chapter?.name || "未关联"}`, "", scene.summary || "暂无摘要");
    });
    [["世界观与规则", project.world], ["故事时间线", project.timeline], ["伏笔追踪", project.foreshadow], ["灵感便签", project.notes]].forEach(([title, content]) => lines.push("", `## ${title}`, "", content || "暂无"));
    lines.push("", "## 创作会话");
    if (!sessions.length) lines.push("", "暂无关联会话");
    sessions.forEach(session => {
      lines.push("", `### ${session.name || "未命名会话"}`);
      (session.messages || []).filter(message => message.role === "assistant").forEach((message, index) => lines.push("", `#### 片段 ${index + 1}`, "", message.content || ""));
    });
    return lines.join("\n");
  }

  function exportActiveProject() {
    const filename = `${getActiveProject().name || "novel"}`.replace(/[\\/:*?"<>|]/g, "_");
    downloadText(`${filename}.md`, projectMarkdown(), "text/markdown;charset=utf-8");
    toast("作品文档已导出");
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
      { id: "search-workspace", label: "全文检索创作工作区", group: "导航", run: openWorkspaceSearch },
      { id: "reader", label: "打开小说阅读模式", group: "创作", disabled: readerButton.disabled, run: () => readerButton.click() },
      { id: "project-reader", label: "阅读当前整部作品", group: "创作", disabled: projectManuscriptSummary().clips === 0, run: () => openProjectReader() },
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
      { id: "export-project", label: "导出当前作品 Markdown", group: "数据", run: exportActiveProject },
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
    document.documentElement.dataset.accent = state.settings.accent || "moss";
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
      const button = event.target.closest("[data-studio-tab]");
      if (button) setStudioTab(button.dataset.studioTab);
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
