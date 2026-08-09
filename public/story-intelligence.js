// public/story-intelligence.js
// Automatic story-state maintenance without adding another visible workspace panel.
(() => {
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LS_CONTINUITY = "cfw_continuity_v1";
  const LS_INTELLIGENCE = "cfw_story_intelligence_v1";
  const ANALYSIS_TEXT_LIMIT = 30000;
  const running = new Set();

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function readWorkspace() {
    const value = readJson(LS_STUDIO, {});
    return value && typeof value === "object" ? value : {};
  }

  function readContinuityStore() {
    const raw = readJson(LS_CONTINUITY, null);
    if (!raw || typeof raw !== "object") return { version: 1, projects: {} };
    raw.version = 1;
    raw.projects = raw.projects && typeof raw.projects === "object" ? raw.projects : {};
    return raw;
  }

  function ensureContinuityProject(store, projectId) {
    const project = store.projects[projectId] && typeof store.projects[projectId] === "object"
      ? store.projects[projectId]
      : {};
    project.chapters = project.chapters && typeof project.chapters === "object" ? project.chapters : {};
    project.characters = project.characters && typeof project.characters === "object" ? project.characters : {};
    project.threads = project.threads && typeof project.threads === "object" ? project.threads : {};
    store.projects[projectId] = project;
    return project;
  }

  function activeData() {
    const state = readWorkspace();
    const projects = Array.isArray(state.projects) ? state.projects : [];
    const project = projects.find((item) => item.id === state.activeProjectId) || projects[0] || null;
    const chapter = project?.chapters?.find((item) => item.id === state.activeChapterId) || null;
    return { state, project, chapter };
  }

  function findData(projectId, chapterId) {
    const state = readWorkspace();
    const projects = Array.isArray(state.projects) ? state.projects : [];
    const project = projects.find((item) => item.id === projectId) || null;
    const chapter = project?.chapters?.find((item) => item.id === chapterId) || null;
    return { state, project, chapter };
  }

  function fingerprint(value) {
    const source = typeof value === "string" ? value : JSON.stringify(value || {});
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function trimmedStoryText(value) {
    const source = String(value || "").trim();
    if (source.length <= ANALYSIS_TEXT_LIMIT) return source;
    const head = Math.floor(ANALYSIS_TEXT_LIMIT * 0.68);
    const tail = ANALYSIS_TEXT_LIMIT - head;
    return `${source.slice(0, head)}\n\n[中间正文过长，连续性分析已省略部分内容]\n\n${source.slice(-tail)}`;
  }

  function openThreads(projectId) {
    const store = readContinuityStore();
    const project = ensureContinuityProject(store, projectId);
    return Object.values(project.threads)
      .filter((item) => item?.status === "open" && item?.title && item?.detail)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 30)
      .map((item) => ({
        id: item.id,
        type: item.type || "event",
        title: item.title,
        detail: item.detail,
        status: "open"
      }));
  }

  function intelligenceMeta() {
    const value = readJson(LS_INTELLIGENCE, {});
    return value && typeof value === "object" ? value : {};
  }

  function analysisHash(project, chapter) {
    const continuity = readContinuityStore();
    const projectState = ensureContinuityProject(continuity, project.id);
    const characters = (project.characters || []).map((character) => ({
      name: character?.name || "",
      currentState: projectState.characters?.[character?.name]?.state || character?.currentState || ""
    }));
    return fingerprint({
      manuscript: chapter.manuscript || "",
      summary: chapter.summary || "",
      notes: chapter.notes || "",
      characters,
      threads: openThreads(project.id)
    });
  }

  function markAnalyzed(projectId, chapterId, hash, model = "") {
    const meta = intelligenceMeta();
    meta[projectId] = meta[projectId] && typeof meta[projectId] === "object" ? meta[projectId] : {};
    meta[projectId][chapterId] = {
      hash,
      model,
      analyzedAt: Date.now()
    };
    writeJson(LS_INTELLIGENCE, meta);
  }

  function wasAnalyzed(projectId, chapterId, hash) {
    return intelligenceMeta()?.[projectId]?.[chapterId]?.hash === hash;
  }

  function makeThreadId() {
    return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function applyReview(projectId, chapterId, result) {
    const store = readContinuityStore();
    const project = ensureContinuityProject(store, projectId);
    const now = Date.now();

    const chapterSummary = String(result?.chapterSummary || "").trim();
    if (chapterSummary) {
      project.chapters[chapterId] = {
        ...(project.chapters[chapterId] || {}),
        summary: chapterSummary,
        updatedAt: now,
        source: "chapter-complete"
      };
    }

    (Array.isArray(result?.characterStates) ? result.characterStates : []).forEach((item) => {
      const name = String(item?.name || "").trim();
      const state = String(item?.state || "").trim();
      if (!name || !state) return;
      project.characters[name] = {
        name,
        state,
        updatedAt: now,
        source: "chapter-complete"
      };
    });

    (Array.isArray(result?.threadUpdates) ? result.threadUpdates : []).forEach((item) => {
      const requestedId = String(item?.id || "").trim();
      const existing = requestedId ? project.threads[requestedId] : null;
      const id = existing ? requestedId : makeThreadId();
      const title = String(item?.title || "").trim();
      const detail = String(item?.detail || "").trim();
      if (!title || !detail) return;
      const status = item?.status === "resolved" ? "resolved" : "open";
      project.threads[id] = {
        ...(existing || {}),
        id,
        type: ["foreshadow", "event", "object", "relationship"].includes(item?.type) ? item.type : "event",
        title,
        detail,
        status,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        ...(status === "resolved" ? { resolvedAt: now, resolvedChapterId: chapterId } : {})
      };
    });

    const resolved = Object.values(project.threads)
      .filter((item) => item?.status === "resolved")
      .sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0));
    resolved.slice(30).forEach((item) => delete project.threads[item.id]);

    writeJson(LS_CONTINUITY, store);
    syncVisibleCharacterStates();
  }

  function charactersForReview(project) {
    const store = readContinuityStore();
    const continuity = ensureContinuityProject(store, project.id);
    return (Array.isArray(project.characters) ? project.characters : []).map((character) => {
      const name = String(character?.name || "").trim();
      return {
        ...character,
        currentState: continuity.characters?.[name]?.state || character?.currentState || ""
      };
    });
  }

  async function analyzeCompletedChapter(projectId, chapterId, force = false) {
    const key = `${projectId}:${chapterId}`;
    if (running.has(key)) return null;

    const { project, chapter } = findData(projectId, chapterId);
    if (!project || !chapter || !chapter.done) return null;
    const manuscript = trimmedStoryText(chapter.manuscript);
    if (!manuscript) return null;

    const hash = analysisHash(project, chapter);
    if (!force && wasAnalyzed(projectId, chapterId, hash)) return null;

    running.add(key);
    try {
      const response = await fetch("/api/continuity/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: document.getElementById("modelSel")?.value || window.APP_DEFAULT_MODEL,
          source: "chapter-complete",
          chapter: {
            id: chapter.id,
            name: chapter.name,
            title: chapter.title || chapter.name,
            summary: chapter.summary || "",
            notes: chapter.notes || ""
          },
          characters: charactersForReview(project),
          existingThreads: openThreads(project.id),
          recentText: manuscript
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      applyReview(projectId, chapterId, result);
      markAnalyzed(projectId, chapterId, hash, result.model || "");
      return result;
    } catch (error) {
      console.warn("[Story Intelligence] chapter analysis failed", error);
      return null;
    } finally {
      running.delete(key);
    }
  }

  function scheduleCompletedChapterAnalysis(projectId, chapterId) {
    setTimeout(() => {
      const { chapter } = findData(projectId, chapterId);
      if (chapter?.done) analyzeCompletedChapter(projectId, chapterId);
    }, 180);
  }

  function syncVisibleCharacterStates() {
    const { project } = activeData();
    if (!project) return;
    const store = readContinuityStore();
    const continuity = ensureContinuityProject(store, project.id);

    document.querySelectorAll(".character-card[data-character-id]").forEach((card) => {
      const character = project.characters?.find((item) => item.id === card.dataset.characterId);
      const name = String(character?.name || "").trim();
      const reviewed = continuity.characters?.[name]?.state || "";
      const field = card.querySelector('[data-character-profile-field="currentState"]');
      if (!field || !reviewed || document.activeElement === field || field.value === reviewed) return;
      field.value = reviewed;
    });
  }

  function saveManualCurrentState(field) {
    const card = field.closest(".character-card[data-character-id]");
    const { project } = activeData();
    const character = project?.characters?.find((item) => item.id === card?.dataset.characterId);
    const name = String(character?.name || "").trim();
    if (!project || !name) return;

    const store = readContinuityStore();
    const continuity = ensureContinuityProject(store, project.id);
    const state = String(field.value || "").trim();
    if (state) {
      continuity.characters[name] = {
        name,
        state,
        updatedAt: Date.now(),
        source: "manual"
      };
    } else {
      delete continuity.characters[name];
    }
    writeJson(LS_CONTINUITY, store);
  }

  function initInteractionHooks() {
    document.addEventListener("input", (event) => {
      if (event.target?.matches?.('[data-character-profile-field="currentState"]')) {
        saveManualCurrentState(event.target);
      }
    }, true);

    document.addEventListener("click", (event) => {
      const completion = event.target.closest?.("#workflowCompleteChapter, .chapter-status, .chapter-editor-status");
      if (!completion) return;
      const { state, project, chapter } = activeData();
      if (!project) return;
      const chapterId = completion.closest?.("[data-chapter-id]")?.dataset.chapterId || chapter?.id || state.activeChapterId;
      if (chapterId) scheduleCompletedChapterAnalysis(project.id, chapterId);
    }, true);

    const body = document.getElementById("studioPanelBody");
    if (body) {
      const observer = new MutationObserver(() => requestAnimationFrame(syncVisibleCharacterStates));
      observer.observe(body, { childList: true, subtree: true });
    }
    document.querySelector(".studio-tabs")?.addEventListener("click", () => setTimeout(syncVisibleCharacterStates, 30));
    document.getElementById("studioLibrary")?.addEventListener("click", () => setTimeout(syncVisibleCharacterStates, 80));
    syncVisibleCharacterStates();
  }

  // This wrapper is intentionally installed before continuity-bridge.js. The later
  // continuity wrapper adds chapter/person state first; this inner wrapper then adds
  // unresolved plot threads without replacing the existing payload.
  const previousFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (!url.includes("/api/chat") || typeof init?.body !== "string") return previousFetch(input, init);

    try {
      const payload = JSON.parse(init.body);
      const { project } = activeData();
      const threads = project ? openThreads(project.id) : [];
      if (threads.length) {
        payload.continuity_context = payload.continuity_context && typeof payload.continuity_context === "object"
          ? payload.continuity_context
          : {};
        payload.continuity_context.openThreads = threads;
      }
      return previousFetch(input, { ...init, body: JSON.stringify(payload) });
    } catch {
      return previousFetch(input, init);
    }
  };

  window.UnlimitedStoryIntelligence = {
    analyzeCompletedChapter,
    analyzeCurrentCompletedChapter: (force = true) => {
      const { project, chapter } = activeData();
      return project && chapter ? analyzeCompletedChapter(project.id, chapter.id, force) : Promise.resolve(null);
    },
    openThreads,
    readContinuityStore
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initInteractionHooks, { once: true });
  } else {
    initInteractionHooks();
  }
})();
