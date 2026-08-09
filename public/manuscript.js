// public/manuscript.js
// Independent chapter manuscript editor and AI-to-manuscript bridge.
(() => {
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LS_SESSIONS = "cfw_sessions_v2";
  const SAVE_DELAY = 320;
  const CONTEXT_TAIL_CHARS = 6500;

  let saveTimer = null;
  let pendingSave = null;
  let panelObserver = null;
  let chatObserver = null;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readWorkspace() {
    const value = readJson(LS_STUDIO, {});
    return value && typeof value === "object" ? value : {};
  }

  function readSessions() {
    const value = readJson(LS_SESSIONS, []);
    return Array.isArray(value) ? value : [];
  }

  function activeProject(state = readWorkspace()) {
    const projects = Array.isArray(state.projects) ? state.projects : [];
    return projects.find((project) => project.id === state.activeProjectId) || projects[0] || null;
  }

  function activeChapter(state = readWorkspace(), project = activeProject(state)) {
    if (!project || !Array.isArray(project.chapters)) return null;
    return project.chapters.find((chapter) => chapter.id === state.activeChapterId) || null;
  }

  function chapterByIds(state, projectId, chapterId) {
    const project = (state.projects || []).find((item) => item.id === projectId);
    const chapter = project?.chapters?.find((item) => item.id === chapterId);
    return { project, chapter };
  }

  function countWords(text) {
    return String(text || "").replace(/\s/g, "").length;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[char]));
  }

  function currentSessionId() {
    return document.querySelector("#sessionList .session-item.active .session-title")?.dataset.id
      || document.querySelector("#studioSessionList [data-session-id].active")?.dataset.sessionId
      || readSessions()[0]?.id
      || null;
  }

  function currentSession() {
    const id = currentSessionId();
    return readSessions().find((session) => session.id === id) || null;
  }

  function notify(message, type = "info") {
    let node = document.getElementById("manuscriptToast");
    if (!node) {
      node = document.createElement("div");
      node.id = "manuscriptToast";
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.dataset.type = type;
    node.classList.add("show");
    clearTimeout(node.hideTimer);
    node.hideTimer = setTimeout(() => node.classList.remove("show"), 1800);
  }

  function normalizeChapterFields(chapter) {
    if (!chapter || typeof chapter !== "object") return;
    if (typeof chapter.manuscript !== "string") chapter.manuscript = "";
    if (!Array.isArray(chapter.manuscriptSources)) chapter.manuscriptSources = [];
    if (!Number.isFinite(Number(chapter.manuscriptUpdatedAt))) chapter.manuscriptUpdatedAt = 0;
  }

  function writeWorkspace(state) {
    try {
      localStorage.setItem(LS_STUDIO, JSON.stringify(state));
      return true;
    } catch {
      notify("正文保存失败：浏览器本地存储空间可能不足", "error");
      return false;
    }
  }

  function saveManuscript(projectId, chapterId, text, sourceIds = null) {
    const state = readWorkspace();
    const { chapter } = chapterByIds(state, projectId, chapterId);
    if (!chapter) return false;
    normalizeChapterFields(chapter);
    chapter.manuscript = String(text || "");
    if (Array.isArray(sourceIds)) chapter.manuscriptSources = [...new Set(sourceIds.filter(Boolean))];
    chapter.manuscriptUpdatedAt = Date.now();
    const saved = writeWorkspace(state);
    if (saved) {
      window.dispatchEvent(new CustomEvent("unlimited-ai:manuscript-updated", {
        detail: { projectId, chapterId, words: countWords(chapter.manuscript) }
      }));
    }
    return saved;
  }

  function queueSave(projectId, chapterId, text) {
    pendingSave = { projectId, chapterId, text };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, SAVE_DELAY);
    setSaveStatus("正在保存…");
  }

  function flushSave() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!pendingSave) return;
    const next = pendingSave;
    pendingSave = null;
    if (saveManuscript(next.projectId, next.chapterId, next.text)) {
      setSaveStatus("已自动保存");
    }
  }

  function setSaveStatus(text) {
    const node = document.getElementById("manuscriptSaveStatus");
    if (node) node.textContent = text;
  }

  function updateMetrics(text) {
    const state = readWorkspace();
    const chapter = activeChapter(state);
    const words = countWords(text);
    const target = Math.max(1, Number(chapter?.targetWords) || 3000);
    const percent = Math.min(100, Math.round(words / target * 100));
    const count = document.getElementById("manuscriptWordCount");
    const progress = document.getElementById("manuscriptProgressBar");
    const percentNode = document.getElementById("manuscriptProgressText");
    if (count) count.textContent = `${words.toLocaleString()} / ${target.toLocaleString()} 字`;
    if (progress) progress.style.width = `${percent}%`;
    if (percentNode) percentNode.textContent = `${percent}%`;
  }

  function sourceKey(sessionId, message, assistantIndex) {
    return message?.id || `legacy-${sessionId || "session"}-assistant-${assistantIndex}`;
  }

  function resolveAssistantMessage(assistantIndex) {
    const session = currentSession();
    if (!session) return null;
    const assistantMessages = (session.messages || []).filter((message) => message?.role === "assistant");
    const message = assistantMessages[Number(assistantIndex)];
    if (!message) return null;
    return { session, message, sourceId: sourceKey(session.id, message, assistantIndex) };
  }

  function appendToActiveChapter(text, sourceId = "") {
    const state = readWorkspace();
    const project = activeProject(state);
    const chapter = activeChapter(state, project);
    if (!project || !chapter) {
      notify("请先从左侧选择一个章节，再加入正文", "error");
      return false;
    }
    normalizeChapterFields(chapter);
    if (sourceId && chapter.manuscriptSources.includes(sourceId)) {
      notify("这条 AI 回复已经加入当前章节");
      return false;
    }

    const clean = String(text || "").trim();
    if (!clean) return false;
    chapter.manuscript = chapter.manuscript.trim()
      ? `${chapter.manuscript.replace(/\s+$/, "")}\n\n${clean}`
      : clean;
    if (sourceId) chapter.manuscriptSources.push(sourceId);
    chapter.manuscriptSources = [...new Set(chapter.manuscriptSources)];
    chapter.manuscriptUpdatedAt = Date.now();

    if (!writeWorkspace(state)) return false;
    syncVisibleEditor(project.id, chapter.id, chapter.manuscript);
    refreshMessageButtons();
    window.dispatchEvent(new CustomEvent("unlimited-ai:manuscript-updated", {
      detail: { projectId: project.id, chapterId: chapter.id, words: countWords(chapter.manuscript) }
    }));
    notify(`已加入《${chapter.name || "当前章节"}》正文`);
    return true;
  }

  function syncVisibleEditor(projectId, chapterId, text) {
    const editor = document.getElementById("chapterManuscriptEditor");
    if (!editor) return;
    if (editor.dataset.projectId !== projectId || editor.dataset.chapterId !== chapterId) return;
    editor.value = text;
    updateMetrics(text);
    setSaveStatus("已保存");
  }

  function legacyClipTexts(project, chapter) {
    const sessions = readSessions();
    const sessionMap = new Map(sessions.map((session) => [session.id, session]));
    const clips = Array.isArray(project.manuscriptClips)
      ? project.manuscriptClips.filter((clip) => clip?.chapterId === chapter.id)
      : [];

    return clips.map((clip) => {
      const session = sessionMap.get(clip.sessionId);
      const message = clip.messageId
        ? session?.messages?.find((item) => item?.id === clip.messageId)
        : session?.messages?.[clip.messageIndex];
      if (!message || message.role !== "assistant" || !String(message.content || "").trim()) return null;
      return {
        text: String(message.content).trim(),
        sourceId: message.id || clip.messageId || `legacy-${clip.sessionId}-${clip.messageIndex}`
      };
    }).filter(Boolean);
  }

  function importLegacyClips() {
    const state = readWorkspace();
    const project = activeProject(state);
    const chapter = activeChapter(state, project);
    if (!project || !chapter) return;
    normalizeChapterFields(chapter);
    const items = legacyClipTexts(project, chapter).filter((item) => !chapter.manuscriptSources.includes(item.sourceId));
    if (!items.length) {
      notify("当前章节没有可导入的新收录片段");
      return;
    }
    const addition = items.map((item) => item.text).join("\n\n");
    chapter.manuscript = chapter.manuscript.trim()
      ? `${chapter.manuscript.replace(/\s+$/, "")}\n\n${addition}`
      : addition;
    chapter.manuscriptSources.push(...items.map((item) => item.sourceId));
    chapter.manuscriptSources = [...new Set(chapter.manuscriptSources)];
    chapter.manuscriptUpdatedAt = Date.now();
    if (!writeWorkspace(state)) return;
    syncVisibleEditor(project.id, chapter.id, chapter.manuscript);
    refreshMessageButtons();
    notify(`已导入 ${items.length} 个收录片段`);
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

  function safeFilename(value) {
    return String(value || "chapter").replace(/[\\/:*?"<>|]/g, "_");
  }

  function editorHtml(project, chapter) {
    if (!chapter) {
      return `
        <section id="manuscriptWorkspace" class="manuscript-workspace manuscript-empty">
          <div class="manuscript-empty-copy">
            <span>CHAPTER MANUSCRIPT</span>
            <strong>先选择一个章节</strong>
            <p>在左侧章节列表选择章节后，这里会变成真正的章节正文编辑器。</p>
          </div>
        </section>`;
    }

    normalizeChapterFields(chapter);
    const words = countWords(chapter.manuscript);
    const target = Math.max(1, Number(chapter.targetWords) || 3000);
    const percent = Math.min(100, Math.round(words / target * 100));
    const legacyCount = legacyClipTexts(project, chapter).filter((item) => !chapter.manuscriptSources.includes(item.sourceId)).length;

    return `
      <section id="manuscriptWorkspace" class="manuscript-workspace">
        <header class="manuscript-head">
          <div>
            <span>CHAPTER MANUSCRIPT</span>
            <h4>${escapeHtml(chapter.name || "未命名章节")}</h4>
          </div>
          <div class="manuscript-metrics">
            <strong id="manuscriptWordCount">${words.toLocaleString()} / ${target.toLocaleString()} 字</strong>
            <span id="manuscriptProgressText">${percent}%</span>
          </div>
        </header>
        <div class="manuscript-progress"><i id="manuscriptProgressBar" style="width:${percent}%"></i></div>
        <textarea id="chapterManuscriptEditor" data-project-id="${escapeHtml(project.id)}" data-chapter-id="${escapeHtml(chapter.id)}" placeholder="在这里直接写正文，或把 AI 回复一键加入本章。">${escapeHtml(chapter.manuscript)}</textarea>
        <footer class="manuscript-footer">
          <span id="manuscriptSaveStatus">已自动保存</span>
          <div>
            <button id="importLegacyClips" type="button"${legacyCount ? "" : " disabled"}>导入已收录片段${legacyCount ? ` (${legacyCount})` : ""}</button>
            <button id="copyChapterManuscript" type="button"${chapter.manuscript.trim() ? "" : " disabled"}>复制正文</button>
            <button id="exportChapterManuscript" type="button"${chapter.manuscript.trim() ? "" : " disabled"}>导出 TXT</button>
          </div>
        </footer>
      </section>`;
  }

  function enhanceDraftPanel() {
    const body = document.getElementById("studioPanelBody");
    if (!body || document.getElementById("manuscriptWorkspace")) return;
    const fragmentList = body.querySelector(".draft-fragment-list");
    if (!fragmentList) return;

    const state = readWorkspace();
    const project = activeProject(state);
    const chapter = activeChapter(state, project);
    if (!project) return;

    const host = fragmentList.closest(".studio-pane") || body;
    const actionGrid = host.querySelector(".studio-action-grid");
    if (actionGrid) actionGrid.insertAdjacentHTML("beforebegin", editorHtml(project, chapter));
    else host.insertAdjacentHTML("afterbegin", editorHtml(project, chapter));
  }

  function decorateAiRows() {
    document.querySelectorAll("#chat .row.ai").forEach((row, fallbackIndex) => {
      const tools = row.querySelector(".message-tools");
      if (!tools) return;
      let button = tools.querySelector(".add-to-manuscript");
      if (!button) {
        button = document.createElement("button");
        button.className = "studio-message-tool add-to-manuscript";
        button.type = "button";
        button.textContent = "加入正文";
        tools.appendChild(button);
      }
      if (!row.dataset.assistantIndex) row.dataset.assistantIndex = String(fallbackIndex);
    });
    refreshMessageButtons();
  }

  function refreshMessageButtons() {
    const state = readWorkspace();
    const chapter = activeChapter(state);
    if (chapter) normalizeChapterFields(chapter);
    const session = currentSession();
    const assistants = (session?.messages || []).filter((message) => message?.role === "assistant");

    document.querySelectorAll("#chat .row.ai").forEach((row, index) => {
      const button = row.querySelector(".add-to-manuscript");
      if (!button) return;
      const assistantIndex = Number(row.dataset.assistantIndex ?? index);
      const message = assistants[assistantIndex];
      const id = message ? sourceKey(session?.id, message, assistantIndex) : "";
      const alreadyAdded = Boolean(chapter && id && chapter.manuscriptSources.includes(id));
      button.textContent = alreadyAdded ? "已入正文" : "加入正文";
      button.classList.toggle("is-added", alreadyAdded);
      button.disabled = alreadyAdded;
      button.title = chapter ? `加入《${chapter.name || "当前章节"}》` : "请先选择章节";
    });
  }

  function handleChatClick(event) {
    const button = event.target.closest(".add-to-manuscript");
    if (!button) return;
    const row = button.closest(".row.ai");
    const assistantIndex = Number(row?.dataset.assistantIndex || 0);
    const resolved = resolveAssistantMessage(assistantIndex);
    const text = resolved?.message?.content || row?.querySelector(".bubble")?.textContent || "";
    appendToActiveChapter(text, resolved?.sourceId || "");
  }

  function bindEditorEvents() {
    document.addEventListener("input", (event) => {
      const editor = event.target.closest("#chapterManuscriptEditor");
      if (!editor) return;
      updateMetrics(editor.value);
      queueSave(editor.dataset.projectId, editor.dataset.chapterId, editor.value);
    });

    document.addEventListener("click", async (event) => {
      if (event.target.closest("#importLegacyClips")) {
        importLegacyClips();
        return;
      }
      if (event.target.closest("#copyChapterManuscript")) {
        const editor = document.getElementById("chapterManuscriptEditor");
        if (!editor) return;
        try {
          await navigator.clipboard.writeText(editor.value);
          notify("章节正文已复制");
        } catch {
          notify("复制失败", "error");
        }
        return;
      }
      if (event.target.closest("#exportChapterManuscript")) {
        const state = readWorkspace();
        const chapter = activeChapter(state);
        if (!chapter || !chapter.manuscript?.trim()) return;
        downloadText(`${safeFilename(chapter.name)}.txt`, chapter.manuscript);
        notify("章节正文已导出");
      }
    });
  }

  function installStorageMergeGuard() {
    const previousSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function manuscriptAwareSetItem(key, value) {
      if (this !== localStorage || key !== LS_STUDIO || typeof value !== "string") {
        return previousSetItem.call(this, key, value);
      }

      try {
        const incoming = JSON.parse(value);
        const current = readJson(LS_STUDIO, null);
        const currentProjects = Array.isArray(current?.projects) ? current.projects : [];
        const currentMap = new Map();
        currentProjects.forEach((project) => {
          (project.chapters || []).forEach((chapter) => {
            currentMap.set(`${project.id}::${chapter.id}`, chapter);
          });
        });

        (incoming?.projects || []).forEach((project) => {
          (project.chapters || []).forEach((chapter) => {
            const currentChapter = currentMap.get(`${project.id}::${chapter.id}`);
            if (!currentChapter) return;
            const currentUpdated = Number(currentChapter.manuscriptUpdatedAt) || 0;
            const incomingUpdated = Number(chapter.manuscriptUpdatedAt) || 0;
            if (currentUpdated > incomingUpdated) {
              chapter.manuscript = typeof currentChapter.manuscript === "string" ? currentChapter.manuscript : "";
              chapter.manuscriptSources = Array.isArray(currentChapter.manuscriptSources) ? currentChapter.manuscriptSources : [];
              chapter.manuscriptUpdatedAt = currentUpdated;
            }
          });
        });
        return previousSetItem.call(this, key, JSON.stringify(incoming));
      } catch {
        return previousSetItem.call(this, key, value);
      }
    };
  }

  function installContextBridge() {
    const previousFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (!url.includes("/api/chat") || typeof init?.body !== "string") {
        return previousFetch(input, init);
      }

      try {
        const payload = JSON.parse(init.body);
        if (payload.creative_context?.chapter) {
          const state = readWorkspace();
          const chapter = activeChapter(state);
          const manuscript = String(chapter?.manuscript || "").trim();
          if (manuscript) {
            payload.creative_context.chapter.manuscriptExcerpt = manuscript.slice(-CONTEXT_TAIL_CHARS);
          }
        }
        return previousFetch(input, { ...init, body: JSON.stringify(payload) });
      } catch {
        return previousFetch(input, init);
      }
    };
  }

  function scheduleEnhance() {
    requestAnimationFrame(() => {
      enhanceDraftPanel();
      decorateAiRows();
    });
  }

  installStorageMergeGuard();
  installContextBridge();

  function init() {
    bindEditorEvents();

    const body = document.getElementById("studioPanelBody");
    if (body) {
      panelObserver = new MutationObserver(scheduleEnhance);
      panelObserver.observe(body, { childList: true, subtree: true });
    }

    const chat = document.getElementById("chat");
    if (chat) {
      chat.addEventListener("click", handleChatClick);
      chatObserver = new MutationObserver(() => requestAnimationFrame(decorateAiRows));
      chatObserver.observe(chat, { childList: true, subtree: true });
    }

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-chapter-id]")) {
        setTimeout(() => {
          scheduleEnhance();
          refreshMessageButtons();
        }, 80);
      }
    });

    window.addEventListener("unlimited-ai:manuscript-updated", refreshMessageButtons);
    window.addEventListener("beforeunload", flushSave);
    scheduleEnhance();
  }

  window.UnlimitedManuscript = {
    readWorkspace,
    activeProject,
    activeChapter,
    countWords,
    flushSave,
    appendToActiveChapter
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
