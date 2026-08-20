// public/context-bridge.js
// Local-first creative-context UI and builder. Network injection is owned by V16.3 Chat Context Core.
(() => {
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

  let lastSnapshot = null;

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

  function savePrefs(prefs) {
    try { localStorage.setItem(LS_PREFS, JSON.stringify(prefs)); } catch {}
  }

  function currentSessionId() {
    return document.querySelector("#sessionList .session-item.active .session-title")?.dataset.id
      || document.querySelector("#studioSessionList [data-session-id].active")?.dataset.sessionId
      || null;
  }

  function activeProject(state) {
    const projects = Array.isArray(state?.projects) ? state.projects : [];
    return projects.find(project => project.id === state.activeProjectId) || projects[0] || null;
  }

  function activeChapter(state, project, sessionId) {
    if (!project || !Array.isArray(project.chapters)) return null;
    return project.chapters.find(chapter => chapter.id === state.activeChapterId)
      || project.chapters.find(chapter => chapter.sessionId && chapter.sessionId === sessionId)
      || null;
  }

  function previousChapterSummary(project, chapter) {
    if (!project || !chapter || !Array.isArray(project.chapters)) return "";
    const index = project.chapters.findIndex(item => item.id === chapter.id);
    if (index <= 0) return "";
    return project.chapters[index - 1]?.summary || "";
  }

  function characterName(character) {
    if (typeof character === "string") return character.trim();
    return String(character?.name || character?.title || "").trim();
  }

  function selectCharacters(project, chapter, latestUserText) {
    const characters = Array.isArray(project?.characters) ? project.characters : [];
    if (!characters.length) return [];
    if (characters.length <= 6) return characters;

    const chapterText = [
      chapter?.title,
      chapter?.name,
      chapter?.summary,
      chapter?.notes,
      latestUserText
    ].filter(Boolean).join("\n");

    const matched = characters.filter(character => {
      const name = characterName(character);
      return name && chapterText.includes(name);
    });

    if (matched.length) return matched.slice(0, 8);
    return characters.slice(0, 4);
  }

  function latestUserText(payload) {
    const messages = Array.isArray(payload?.messages) ? payload.messages : [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === "user" && typeof messages[index].content === "string") {
        return messages[index].content;
      }
    }
    return "";
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

  function buildContext(payload = {}) {
    const prefs = readPrefs();
    if (!prefs.enabled) return null;

    const state = readJson(LS_STUDIO, null);
    const project = activeProject(state);
    if (!state || !project) return null;

    const sessionId = currentSessionId();
    const chapter = activeChapter(state, project, sessionId);
    const userText = latestUserText(payload);
    const context = {
      version: 1,
      project: compactProject(project, prefs)
    };

    if (prefs.chapter && chapter) {
      context.chapter = compactChapter(chapter);
      context.previousChapterSummary = previousChapterSummary(project, chapter);
    }

    if (prefs.characters) {
      context.characters = selectCharacters(project, chapter, userText);
    }

    return context;
  }

  function estimateTokens(value) {
    const source = typeof value === "string" ? value : JSON.stringify(value || {});
    let cjk = 0;
    let ascii = 0;
    for (const char of source) {
      const code = char.charCodeAt(0);
      if (/\s/.test(char)) continue;
      if ((code >= 0x3400 && code <= 0x9fff) || (code >= 0xf900 && code <= 0xfaff)) cjk += 1;
      else ascii += 1;
    }
    return cjk + Math.ceil(ascii / 4);
  }

  function snapshot(context) {
    if (!context) return { context: null, tokens: 0, items: [], characters: [] };
    const project = context.project || {};
    const items = [];
    if (project.synopsis) items.push("作品简介");
    if (project.outline) items.push("总纲");
    if (context.chapter) items.push(context.chapter.title ? `章节：${context.chapter.title}` : "当前章节");
    if (context.previousChapterSummary) items.push("上一章摘要");
    if (project.world) items.push("世界观");
    if (project.timeline) items.push("时间线");
    if (project.foreshadow) items.push("伏笔");
    if (project.notes) items.push("创作备注");
    if (Array.isArray(project.relations) && project.relations.length) items.push("人物关系");
    const characters = (context.characters || []).map(characterName).filter(Boolean);
    return { context, tokens: estimateTokens(context), items, characters };
  }

  function refreshSnapshot(payload = {}) {
    lastSnapshot = snapshot(buildContext(payload));
    updateButton();
    return lastSnapshot;
  }

  function updateButton() {
    const button = document.getElementById("contextInspectorBtn");
    if (!button) return;
    const prefs = readPrefs();
    const count = (lastSnapshot?.items?.length || 0) + (lastSnapshot?.characters?.length || 0);
    button.classList.toggle("context-off", !prefs.enabled);
    button.querySelector("b").textContent = prefs.enabled ? String(count) : "关";
    button.title = prefs.enabled
      ? `本次预计注入约 ${lastSnapshot?.tokens || 0} tokens`
      : "创作上下文已关闭";
  }

  function renderInspector() {
    const body = document.getElementById("contextInspectorBody");
    if (!body) return;
    const prefs = readPrefs();
    const snap = refreshSnapshot();
    const items = snap.items.length ? snap.items.map(item => `<li>${escapeHtml(item)}</li>`).join("") : "<li>暂无可注入的作品资料</li>";
    const names = snap.characters.length ? snap.characters.map(name => `<span>${escapeHtml(name)}</span>`).join("") : "<em>未匹配人物</em>";

    body.innerHTML = `
      <div class="context-master">
        <div><strong>自动注入创作资料</strong><p>发送消息时把当前作品资料作为隐藏上下文交给 AI。</p></div>
        <label><input type="checkbox" data-context-pref="enabled" ${prefs.enabled ? "checked" : ""}><span>${prefs.enabled ? "开启" : "关闭"}</span></label>
      </div>
      <div class="context-grid">
        ${prefRow("project", "作品简介与总纲", prefs.project)}
        ${prefRow("chapter", "当前章节与上一章", prefs.chapter)}
        ${prefRow("characters", "相关人物", prefs.characters)}
        ${prefRow("world", "世界观", prefs.world)}
        ${prefRow("continuity", "时间线、伏笔与备注", prefs.continuity)}
      </div>
      <div class="context-summary">
        <div><strong>预计上下文</strong><span>≈ ${snap.tokens.toLocaleString()} tokens</span></div>
        <ul>${items}</ul>
        <div class="context-characters"><strong>人物</strong><div>${names}</div></div>
      </div>`;

    body.querySelectorAll("[data-context-pref]").forEach(input => {
      input.addEventListener("change", () => {
        const next = readPrefs();
        next[input.dataset.contextPref] = input.checked;
        savePrefs(next);
        renderInspector();
      });
    });
  }

  function prefRow(key, label, checked) {
    return `<label class="context-pref"><span>${escapeHtml(label)}</span><input type="checkbox" data-context-pref="${key}" ${checked ? "checked" : ""}></label>`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[char]));
  }

  function closeInspector() {
    const mask = document.getElementById("contextInspectorMask");
    if (mask) mask.hidden = true;
  }

  function createInspector() {
    if (document.getElementById("contextInspectorBtn")) return;
    const controls = document.querySelector(".topbar-actions");
    if (!controls) return;

    const button = document.createElement("button");
    button.id = "contextInspectorBtn";
    button.className = "studio-top-btn context-inspector-btn";
    button.type = "button";
    button.innerHTML = `<span>上下文</span><b>0</b>`;
    const reader = document.getElementById("readerBtn");
    controls.insertBefore(button, reader || controls.firstChild);

    document.body.insertAdjacentHTML("beforeend", `
      <div id="contextInspectorMask" class="context-inspector-mask" hidden>
        <section class="context-inspector" role="dialog" aria-modal="true" aria-labelledby="contextInspectorTitle">
          <header><div><span>AI CONTEXT</span><strong id="contextInspectorTitle">本次创作上下文</strong></div><button id="contextInspectorClose" type="button" aria-label="关闭">×</button></header>
          <div id="contextInspectorBody"></div>
        </section>
      </div>`);

    button.addEventListener("click", () => {
      renderInspector();
      document.getElementById("contextInspectorMask").hidden = false;
    });
    document.getElementById("contextInspectorClose").addEventListener("click", closeInspector);
    document.getElementById("contextInspectorMask").addEventListener("click", event => {
      if (event.target.id === "contextInspectorMask") closeInspector();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeInspector();
    });

    refreshSnapshot();
  }

  function addStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .context-inspector-btn{gap:7px}.context-inspector-btn b{min-width:18px;height:18px;padding:0 5px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;background:var(--accent);color:var(--accent-ink);font-size:10px}.context-inspector-btn.context-off{opacity:.62}.context-inspector-mask{position:fixed;inset:0;z-index:140;background:rgba(4,5,4,.62);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:20px}.context-inspector-mask[hidden]{display:none}.context-inspector{width:min(620px,100%);max-height:min(760px,88vh);overflow:auto;border:1px solid var(--border-strong);border-radius:16px;background:var(--surface-solid);box-shadow:var(--shadow);color:var(--text)}.context-inspector>header{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid var(--border);background:var(--surface-solid)}.context-inspector>header div{display:flex;flex-direction:column;gap:3px}.context-inspector>header span{font-size:10px;color:var(--accent);letter-spacing:.14em}.context-inspector>header strong{font-size:18px}.context-inspector>header button{width:34px;height:34px;border:1px solid var(--border);border-radius:9px;background:var(--surface-soft);color:var(--text);cursor:pointer;font-size:20px}#contextInspectorBody{padding:18px 20px 22px}.context-master{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--surface-soft)}.context-master strong{font-size:14px}.context-master p{margin:4px 0 0;color:var(--muted);font-size:12px;line-height:1.55}.context-master label{display:flex;align-items:center;gap:7px;color:var(--text-soft);font-size:12px;white-space:nowrap}.context-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.context-pref{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;color:var(--text-soft);font-size:12px}.context-summary{margin-top:16px;padding-top:15px;border-top:1px solid var(--border)}.context-summary>div:first-child{display:flex;justify-content:space-between;gap:16px}.context-summary>div:first-child span{color:var(--accent);font-size:12px}.context-summary ul{margin:12px 0;padding-left:20px;color:var(--text-soft);font-size:12px;line-height:1.8}.context-characters{display:flex;gap:12px;align-items:flex-start}.context-characters>strong{font-size:12px}.context-characters>div{display:flex;flex-wrap:wrap;gap:6px}.context-characters span{padding:4px 7px;border-radius:7px;background:var(--surface-soft);color:var(--text-soft);font-size:11px}.context-characters em{color:var(--muted);font-size:11px;font-style:normal}@media(max-width:720px){.context-grid{grid-template-columns:1fr}.context-inspector-mask{padding:10px}.context-inspector{max-height:92vh}}
    `;
    document.head.appendChild(style);
  }

  window.UnlimitedContext = {
    buildContext,
    refreshSnapshot,
    readPrefs,
    open() {
      renderInspector();
      const mask = document.getElementById("contextInspectorMask");
      if (mask) mask.hidden = false;
    }
  };

  function init() {
    addStyles();
    createInspector();
    const observer = new MutationObserver(() => refreshSnapshot());
    const sessionList = document.getElementById("sessionList");
    if (sessionList) observer.observe(sessionList, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    window.addEventListener("storage", event => {
      if (event.key === LS_STUDIO || event.key === LS_PREFS) refreshSnapshot();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
