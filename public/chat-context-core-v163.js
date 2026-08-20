// public/chat-context-core-v163.js
// V16.3 context core: migrate the three legacy novel fetch wrappers onto the
// Chat Transport registry, then restore window.fetch to one stable network entry.
(() => {
  const REVISION = "2026-08-20-v16.3-chat-context-core";
  if (window.UnlimitedChatContextV163) return;

  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LS_PREFS = "cfw_context_prefs_v1";
  const DEFAULT_PREFS = {
    enabled: true,
    project: true,
    chapter: true,
    characters: true,
    world: true,
    continuity: true
  };

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readPrefs() {
    return { ...DEFAULT_PREFS, ...(readJson(LS_PREFS, {}) || {}) };
  }

  function currentSessionId() {
    return document.querySelector("#sessionList .session-item.active .session-title")?.dataset.id
      || document.querySelector("#studioSessionList [data-session-id].active")?.dataset.sessionId
      || null;
  }

  function activeProject(state) {
    const projects = Array.isArray(state?.projects) ? state.projects : [];
    return projects.find((project) => project.id === state?.activeProjectId) || projects[0] || null;
  }

  function activeChapter(state, project, sessionId) {
    if (!project || !Array.isArray(project.chapters)) return null;
    return project.chapters.find((chapter) => chapter.id === state?.activeChapterId)
      || project.chapters.find((chapter) => chapter.sessionId && chapter.sessionId === sessionId)
      || null;
  }

  function previousChapterSummary(project, chapter) {
    if (!project || !chapter || !Array.isArray(project.chapters)) return "";
    const index = project.chapters.findIndex((item) => item.id === chapter.id);
    if (index <= 0) return "";
    return project.chapters[index - 1]?.summary || "";
  }

  function characterName(character) {
    if (typeof character === "string") return character.trim();
    return String(character?.name || character?.title || "").trim();
  }

  function latestUserText(payload) {
    const messages = Array.isArray(payload?.messages) ? payload.messages : [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role === "user" && typeof message.content === "string") return message.content;
    }
    return "";
  }

  function selectCharacters(project, chapter, userText) {
    const characters = Array.isArray(project?.characters) ? project.characters : [];
    if (!characters.length) return [];
    if (characters.length <= 6) return characters;

    const chapterText = [
      chapter?.title,
      chapter?.name,
      chapter?.summary,
      chapter?.notes,
      userText
    ].filter(Boolean).join("\n");

    const matched = characters.filter((character) => {
      const name = characterName(character);
      return name && chapterText.includes(name);
    });
    return matched.length ? matched.slice(0, 8) : characters.slice(0, 4);
  }

  function compactProject(project, prefs) {
    const value = {};
    if (prefs.project) {
      value.name = project.name || "";
      value.description = project.description || "";
      value.synopsis = project.synopsis || "";
      value.outline = project.outline || "";
    }
    if (prefs.world) value.world = project.world || "";
    if (prefs.continuity) {
      value.notes = project.notes || "";
      value.timeline = project.timeline || "";
      value.foreshadow = project.foreshadow || "";
      value.relations = Array.isArray(project.relations) ? project.relations : [];
    }
    return value;
  }

  function compactChapter(chapter) {
    if (!chapter) return null;
    return {
      id: chapter.id || "",
      title: chapter.title || chapter.name || "",
      summary: chapter.summary || "",
      notes: chapter.notes || "",
      targetWords: chapter.targetWords || 0
    };
  }

  function buildCreativeContext(payload = {}) {
    const prefs = readPrefs();
    if (!prefs.enabled) return null;

    const state = readJson(LS_STUDIO, null);
    const project = activeProject(state);
    if (!state || !project) return null;

    const sessionId = currentSessionId();
    const chapter = activeChapter(state, project, sessionId);
    const context = {
      version: 1,
      project: compactProject(project, prefs)
    };

    if (prefs.chapter && chapter) {
      context.chapter = compactChapter(chapter);
      context.previousChapterSummary = previousChapterSummary(project, chapter);
    }
    if (prefs.characters) {
      context.characters = selectCharacters(project, chapter, latestUserText(payload));
    }
    return context;
  }

  function creativeEnricher(payload) {
    const context = buildCreativeContext(payload);
    return { creative_context: context || undefined };
  }

  function memoryEnricher(payload) {
    const memories = window.UnlimitedMemory?.selectRelevantMemories?.(payload) || [];
    return {
      memory_context: memories.length
        ? { version: 1, items: memories }
        : undefined
    };
  }

  function continuityEnricher() {
    const continuity = window.UnlimitedContinuity?.currentPayload?.() || null;
    return { continuity_context: continuity || undefined };
  }

  function install() {
    const transport = window.UnlimitedChatTransportV16;
    if (!transport?.registerNovelEnricher || typeof transport.fetch !== "function") {
      window.__UNLIMITED_CHAT_CONTEXT_ERROR__ = {
        revision: REVISION,
        message: "V16 Chat Transport registry is unavailable"
      };
      return false;
    }

    transport.registerNovelEnricher("creative-context", creativeEnricher);
    transport.registerNovelEnricher("story-memory", memoryEnricher);
    transport.registerNovelEnricher("continuity", continuityEnricher);

    // context-bridge.js, continuity-bridge.js and memory-bridge.js were originally
    // written as nested window.fetch wrappers. They have already initialized their UI
    // and public data APIs by this point. Restore the single transport entry now so
    // those legacy wrappers are no longer on the runtime network path.
    window.fetch = transport.fetch;
    window.fetch.__uaiV16Transport = transport.revision;
    window.fetch.__uaiV16Registry = transport.registryRevision;
    window.fetch.__uaiV16ContextCore = REVISION;

    document.documentElement.dataset.chatContextRevision = REVISION;
    return true;
  }

  const installed = install();
  window.UnlimitedChatContextV163 = {
    revision: REVISION,
    installed,
    buildCreativeContext,
    creativeEnricher,
    memoryEnricher,
    continuityEnricher,
    get enrichers() { return window.UnlimitedChatTransportV16?.enrichers || []; }
  };
})();