// public/v3-sidebar.js
// Stabilizes left navigation metadata and keeps it visually consistent without
// rewriting the underlying workspace/storage model.
(() => {
  if (window.__UNLIMITED_V3_SIDEBAR__) return;
  window.__UNLIMITED_V3_SIDEBAR__ = true;

  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LS_SESSIONS = "cfw_sessions_v2";
  const NativeMutationObserver = window.__UNLIMITED_NATIVE_MUTATION_OBSERVER__ || window.MutationObserver;
  let refreshFrame = 0;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function workspace() {
    const value = readJson(LS_STUDIO, {});
    return value && typeof value === "object" ? value : {};
  }

  function activeProject() {
    const state = workspace();
    const projects = Array.isArray(state.projects) ? state.projects : [];
    return projects.find((item) => item.id === state.activeProjectId) || projects[0] || null;
  }

  function sessionsById() {
    const sessions = readJson(LS_SESSIONS, []);
    return new Map((Array.isArray(sessions) ? sessions : []).map((session) => [session.id, session]));
  }

  function countCharacters(text) {
    return String(text || "").replace(/\s/g, "").length;
  }

  function setTextIfChanged(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function patchChapterList() {
    const project = activeProject();
    if (!project) return;
    const chapters = new Map((Array.isArray(project.chapters) ? project.chapters : []).map((chapter) => [chapter.id, chapter]));

    document.querySelectorAll("#studioChapterList .chapter-item[data-chapter-id]").forEach((item) => {
      const chapter = chapters.get(item.dataset.chapterId);
      if (!chapter) return;
      const words = countCharacters(chapter.manuscript);
      const done = Boolean(chapter.done);
      const main = item.querySelector(".studio-item-main");
      const title = main?.querySelector("span");
      const meta = main?.querySelector("small");
      const text = `${words.toLocaleString()} 字 · ${done ? "已完成" : "写作中"}`;

      setTextIfChanged(title, chapter.name || "未命名章节");
      setTextIfChanged(meta, text);
      item.classList.toggle("v2-chapter-done", done);
      item.dataset.chapterState = done ? "done" : "writing";
      item.dataset.v3Meta = text;
      if (main) main.title = `${chapter.name || "未命名章节"} · ${words.toLocaleString()} 字`;
    });
  }

  function patchSessionList() {
    const sessions = sessionsById();
    document.querySelectorAll("#studioSessionList .studio-list-item[data-session-id]").forEach((item) => {
      const session = sessions.get(item.dataset.sessionId);
      if (!session) return;
      const count = (Array.isArray(session.messages) ? session.messages : []).filter((message) => message?.role === "assistant").length;
      const main = item.querySelector(".studio-item-main");
      const title = main?.querySelector("span");
      const meta = main?.querySelector("small");
      setTextIfChanged(title, session.name || "未命名对话");
      setTextIfChanged(meta, `${count} 段 AI 内容`);
      item.dataset.v3SessionMeta = String(count);
    });
  }

  function patchSidebar() {
    refreshFrame = 0;
    patchChapterList();
    patchSessionList();
    document.getElementById("studioLibrary")?.classList.add("v3-sidebar-stable");
  }

  function schedulePatch() {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(patchSidebar);
  }

  function patchCurrentChapterFromEditor(editor) {
    const state = workspace();
    const project = activeProject();
    if (!project || !state.activeChapterId) return;
    const chapter = (project.chapters || []).find((item) => item.id === state.activeChapterId);
    const row = document.querySelector(`#studioChapterList .chapter-item[data-chapter-id="${CSS.escape(state.activeChapterId)}"]`);
    const meta = row?.querySelector(".studio-item-main small");
    if (!chapter || !meta) return;
    const words = countCharacters(editor.value);
    const text = `${words.toLocaleString()} 字 · ${chapter.done ? "已完成" : "写作中"}`;
    setTextIfChanged(meta, text);
    row.dataset.v3Meta = text;
  }

  function observeList(id) {
    const root = document.getElementById(id);
    if (!root) return;
    const observer = new NativeMutationObserver(() => {
      // Native observer runs in the same microtask checkpoint as the list rebuild,
      // so competing legacy metadata is normalized before the browser paints it.
      patchSidebar();
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  }

  function init() {
    observeList("studioChapterList");
    observeList("studioSessionList");

    document.addEventListener("input", (event) => {
      if (event.target?.id === "simpleManuscriptEditor") patchCurrentChapterFromEditor(event.target);
    });
    document.getElementById("studioLibrary")?.addEventListener("click", () => queueMicrotask(patchSidebar));
    document.querySelector(".studio-tabs")?.addEventListener("click", schedulePatch);
    window.addEventListener("pageshow", schedulePatch);

    patchSidebar();
  }

  window.UnlimitedV3Sidebar = {
    refresh: patchSidebar
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
