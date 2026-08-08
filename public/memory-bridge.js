// public/memory-bridge.js
// Local-first Story Memory: structured long-term facts, retrieval, and prompt injection.
(() => {
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LS_MEMORY = "cfw_story_memory_v1";
  const LS_PREFS = "cfw_story_memory_prefs_v1";
  const MEMORY_TYPES = ["事件", "人物变化", "关系变化", "伏笔", "秘密", "物品", "地点", "规则", "冲突", "已揭晓", "未揭晓"];
  const DEFAULT_PREFS = { enabled: true, maxItems: 12, includeResolved: false };
  let editingId = null;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function readPrefs() {
    return { ...DEFAULT_PREFS, ...(readJson(LS_PREFS, {}) || {}) };
  }

  function savePrefs(prefs) {
    writeJson(LS_PREFS, { ...DEFAULT_PREFS, ...prefs });
  }

  function readStore() {
    const raw = readJson(LS_MEMORY, null);
    if (!raw || typeof raw !== "object") return { version: 1, projects: {} };
    raw.version = 1;
    raw.projects = raw.projects && typeof raw.projects === "object" ? raw.projects : {};
    return raw;
  }

  function saveStore(store) {
    writeJson(LS_MEMORY, store);
    syncButton();
  }

  function studioState() {
    return readJson(LS_STUDIO, null);
  }

  function activeProject(state = studioState()) {
    const projects = Array.isArray(state?.projects) ? state.projects : [];
    return projects.find((project) => project.id === state.activeProjectId) || projects[0] || null;
  }

  function activeChapter(state, project) {
    if (!project || !Array.isArray(project.chapters)) return null;
    return project.chapters.find((chapter) => chapter.id === state?.activeChapterId) || null;
  }

  function projectMemories(projectId) {
    if (!projectId) return [];
    const store = readStore();
    const memories = store.projects[projectId];
    return Array.isArray(memories) ? memories : [];
  }

  function setProjectMemories(projectId, memories) {
    if (!projectId) return;
    const store = readStore();
    store.projects[projectId] = memories;
    saveStore(store);
  }

  function makeId() {
    return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeList(value) {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value || "").split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
  }

  function normalizeMemory(memory = {}) {
    return {
      id: memory.id || makeId(),
      type: MEMORY_TYPES.includes(memory.type) ? memory.type : "事件",
      content: String(memory.content || "").trim(),
      chapterId: String(memory.chapterId || ""),
      characters: normalizeList(memory.characters),
      tags: normalizeList(memory.tags),
      importance: Math.max(1, Math.min(5, Number(memory.importance) || 3)),
      status: memory.status === "resolved" ? "resolved" : "active",
      source: memory.source === "ai" ? "ai" : "manual",
      createdAt: Number(memory.createdAt) || Date.now(),
      updatedAt: Date.now()
    };
  }

  function tokenize(value) {
    const source = String(value || "").toLowerCase();
    const latin = source.match(/[a-z0-9_]{2,}/g) || [];
    const cjk = source.match(/[\u3400-\u9fff]{2,8}/g) || [];
    return Array.from(new Set([...latin, ...cjk])).slice(0, 80);
  }

  function latestUserText(payload) {
    const messages = Array.isArray(payload?.messages) ? payload.messages : [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role === "user" && typeof message.content === "string") return message.content;
    }
    return "";
  }

  function memoryScore(memory, queryTokens, chapterId) {
    let score = (Number(memory.importance) || 3) * 10;
    if (chapterId && memory.chapterId === chapterId) score += 30;
    if (memory.status === "resolved") score -= 18;

    const searchable = [memory.content, ...(memory.tags || []), ...(memory.characters || []), memory.type].join(" ").toLowerCase();
    queryTokens.forEach((token) => {
      if (searchable.includes(token)) score += 12;
    });

    const ageDays = Math.max(0, (Date.now() - (Number(memory.updatedAt) || Number(memory.createdAt) || 0)) / 86400000);
    score += Math.max(0, 6 - Math.floor(ageDays / 30));
    return score;
  }

  function selectRelevantMemories(payload = {}) {
    const prefs = readPrefs();
    if (!prefs.enabled) return [];

    const state = studioState();
    const project = activeProject(state);
    if (!project) return [];
    const chapter = activeChapter(state, project);
    const query = [latestUserText(payload), chapter?.title, chapter?.name, chapter?.summary, chapter?.notes].filter(Boolean).join("\n");
    const tokens = tokenize(query);
    const maxItems = Math.max(1, Math.min(20, Number(prefs.maxItems) || 12));

    return projectMemories(project.id)
      .filter((memory) => memory?.content && (prefs.includeResolved || memory.status !== "resolved"))
      .map((memory) => ({ memory, score: memoryScore(memory, tokens, chapter?.id || "") }))
      .sort((a, b) => b.score - a.score || (b.memory.updatedAt || 0) - (a.memory.updatedAt || 0))
      .slice(0, maxItems)
      .map(({ memory }) => ({
        id: memory.id,
        type: memory.type,
        content: memory.content,
        chapterId: memory.chapterId || "",
        characters: memory.characters || [],
        tags: memory.tags || [],
        importance: memory.importance || 3,
        status: memory.status || "active"
      }));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[char]));
  }

  function chapterOptions(project, selectedId = "") {
    const chapters = Array.isArray(project?.chapters) ? project.chapters : [];
    return [`<option value="">未绑定章节</option>`, ...chapters.map((chapter, index) => {
      const id = chapter.id || "";
      const title = chapter.title || chapter.name || `第 ${index + 1} 章`;
      return `<option value="${escapeHtml(id)}" ${id === selectedId ? "selected" : ""}>${escapeHtml(title)}</option>`;
    })].join("");
  }

  function renderMemoryList() {
    const list = document.getElementById("storyMemoryList");
    if (!list) return;
    const state = studioState();
    const project = activeProject(state);
    if (!project) {
      list.innerHTML = `<div class="memory-empty">请先创建小说项目。</div>`;
      return;
    }

    const search = String(document.getElementById("storyMemorySearch")?.value || "").trim().toLowerCase();
    const type = document.getElementById("storyMemoryTypeFilter")?.value || "";
    const memories = projectMemories(project.id)
      .filter((memory) => !type || memory.type === type)
      .filter((memory) => !search || [memory.content, memory.type, ...(memory.tags || []), ...(memory.characters || [])].join(" ").toLowerCase().includes(search))
      .sort((a, b) => (b.importance || 0) - (a.importance || 0) || (b.updatedAt || 0) - (a.updatedAt || 0));

    if (!memories.length) {
      list.innerHTML = `<div class="memory-empty">当前作品还没有符合条件的故事记忆。</div>`;
      return;
    }

    list.innerHTML = memories.map((memory) => {
      const chapter = (project.chapters || []).find((item) => item.id === memory.chapterId);
      const chips = [...(memory.characters || []).map((item) => `人物:${item}`), ...(memory.tags || [])].slice(0, 8);
      return `<article class="memory-card ${memory.status === "resolved" ? "resolved" : ""}" data-memory-id="${escapeHtml(memory.id)}">
        <div class="memory-card-head"><div><span>${escapeHtml(memory.type)}</span><b>重要度 ${memory.importance || 3}</b>${chapter ? `<em>${escapeHtml(chapter.title || chapter.name || "章节")}</em>` : ""}</div><small>${memory.status === "resolved" ? "已解决" : "有效"}</small></div>
        <p>${escapeHtml(memory.content)}</p>
        ${chips.length ? `<div class="memory-chips">${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}</div>` : ""}
        <div class="memory-actions"><button data-memory-action="edit" type="button">编辑</button><button data-memory-action="toggle" type="button">${memory.status === "resolved" ? "恢复" : "标为已解决"}</button><button data-memory-action="delete" type="button">删除</button></div>
      </article>`;
    }).join("");
  }

  function resetForm() {
    editingId = null;
    const state = studioState();
    const project = activeProject(state);
    const chapter = activeChapter(state, project);
    document.getElementById("storyMemoryFormTitle").textContent = "新增记忆";
    document.getElementById("storyMemoryContent").value = "";
    document.getElementById("storyMemoryType").value = "事件";
    document.getElementById("storyMemoryImportance").value = "3";
    document.getElementById("storyMemoryStatus").value = "active";
    document.getElementById("storyMemoryCharacters").value = "";
    document.getElementById("storyMemoryTags").value = "";
    document.getElementById("storyMemoryChapter").innerHTML = chapterOptions(project, chapter?.id || "");
    document.getElementById("storyMemoryCancelEdit").hidden = true;
  }

  function editMemory(memoryId) {
    const state = studioState();
    const project = activeProject(state);
    if (!project) return;
    const memory = projectMemories(project.id).find((item) => item.id === memoryId);
    if (!memory) return;
    editingId = memory.id;
    document.getElementById("storyMemoryFormTitle").textContent = "编辑记忆";
    document.getElementById("storyMemoryContent").value = memory.content || "";
    document.getElementById("storyMemoryType").value = memory.type || "事件";
    document.getElementById("storyMemoryImportance").value = String(memory.importance || 3);
    document.getElementById("storyMemoryStatus").value = memory.status || "active";
    document.getElementById("storyMemoryCharacters").value = (memory.characters || []).join("，");
    document.getElementById("storyMemoryTags").value = (memory.tags || []).join("，");
    document.getElementById("storyMemoryChapter").innerHTML = chapterOptions(project, memory.chapterId || "");
    document.getElementById("storyMemoryCancelEdit").hidden = false;
    document.getElementById("storyMemoryContent").focus();
  }

  function saveFormMemory() {
    const state = studioState();
    const project = activeProject(state);
    if (!project) return;
    const content = document.getElementById("storyMemoryContent").value.trim();
    if (!content) return;

    const memories = projectMemories(project.id);
    const previous = editingId ? memories.find((item) => item.id === editingId) : null;
    const next = normalizeMemory({
      ...(previous || {}),
      id: previous?.id || makeId(),
      type: document.getElementById("storyMemoryType").value,
      content,
      importance: document.getElementById("storyMemoryImportance").value,
      status: document.getElementById("storyMemoryStatus").value,
      chapterId: document.getElementById("storyMemoryChapter").value,
      characters: document.getElementById("storyMemoryCharacters").value,
      tags: document.getElementById("storyMemoryTags").value,
      source: previous?.source || "manual",
      createdAt: previous?.createdAt || Date.now()
    });

    if (previous) memories[memories.findIndex((item) => item.id === previous.id)] = next;
    else memories.push(next);
    setProjectMemories(project.id, memories);
    resetForm();
    renderMemoryList();
  }

  function deleteMemory(memoryId) {
    const project = activeProject();
    if (!project) return;
    setProjectMemories(project.id, projectMemories(project.id).filter((item) => item.id !== memoryId));
    if (editingId === memoryId) resetForm();
    renderMemoryList();
  }

  function toggleMemory(memoryId) {
    const project = activeProject();
    if (!project) return;
    const memories = projectMemories(project.id);
    const memory = memories.find((item) => item.id === memoryId);
    if (!memory) return;
    memory.status = memory.status === "resolved" ? "active" : "resolved";
    memory.updatedAt = Date.now();
    setProjectMemories(project.id, memories);
    renderMemoryList();
  }

  function syncButton() {
    const button = document.getElementById("storyMemoryBtn");
    if (!button) return;
    const project = activeProject();
    const activeCount = project ? projectMemories(project.id).filter((memory) => memory.status !== "resolved").length : 0;
    button.querySelector("b").textContent = String(activeCount);
  }

  function renderPrefs() {
    const prefs = readPrefs();
    const enabled = document.getElementById("storyMemoryEnabled");
    const maxItems = document.getElementById("storyMemoryMaxItems");
    const includeResolved = document.getElementById("storyMemoryIncludeResolved");
    if (enabled) enabled.checked = prefs.enabled;
    if (maxItems) maxItems.value = String(prefs.maxItems);
    if (includeResolved) includeResolved.checked = prefs.includeResolved;
  }

  function openMemory() {
    resetForm();
    renderPrefs();
    renderMemoryList();
    document.getElementById("storyMemoryMask").hidden = false;
  }

  function closeMemory() {
    const mask = document.getElementById("storyMemoryMask");
    if (mask) mask.hidden = true;
  }

  function createUi() {
    if (document.getElementById("storyMemoryBtn")) return;
    const controls = document.querySelector(".topbar-actions");
    if (!controls) return;

    const button = document.createElement("button");
    button.id = "storyMemoryBtn";
    button.className = "studio-top-btn memory-top-btn";
    button.type = "button";
    button.innerHTML = `<span>记忆</span><b>0</b>`;
    const contextButton = document.getElementById("contextInspectorBtn");
    if (contextButton?.nextSibling) controls.insertBefore(button, contextButton.nextSibling);
    else controls.prepend(button);

    document.body.insertAdjacentHTML("beforeend", `
      <div id="storyMemoryMask" class="memory-mask" hidden>
        <section class="memory-dialog" role="dialog" aria-modal="true" aria-labelledby="storyMemoryTitle">
          <header><div><span>STORY MEMORY</span><strong id="storyMemoryTitle">长期故事记忆</strong></div><button id="storyMemoryClose" type="button" aria-label="关闭">×</button></header>
          <div class="memory-layout">
            <aside class="memory-editor">
              <h3 id="storyMemoryFormTitle">新增记忆</h3>
              <label>内容<textarea id="storyMemoryContent" rows="6" placeholder="记录后续章节仍需记住的事实、变化、伏笔或规则"></textarea></label>
              <div class="memory-form-grid">
                <label>类型<select id="storyMemoryType">${MEMORY_TYPES.map((type) => `<option>${type}</option>`).join("")}</select></label>
                <label>重要度<select id="storyMemoryImportance"><option value="1">1</option><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5</option></select></label>
                <label>状态<select id="storyMemoryStatus"><option value="active">有效</option><option value="resolved">已解决</option></select></label>
                <label>章节<select id="storyMemoryChapter"></select></label>
              </div>
              <label>相关人物<input id="storyMemoryCharacters" placeholder="林雨桐，顾辰" /></label>
              <label>标签<input id="storyMemoryTags" placeholder="地下室，符号，身份" /></label>
              <div class="memory-form-actions"><button id="storyMemoryCancelEdit" type="button" hidden>取消编辑</button><button id="storyMemorySave" type="button">保存记忆</button></div>
              <div class="memory-prefs">
                <strong>AI 注入设置</strong>
                <label><span>启用长期记忆</span><input id="storyMemoryEnabled" type="checkbox" checked></label>
                <label><span>每次最多加载</span><select id="storyMemoryMaxItems"><option>6</option><option>8</option><option selected>12</option><option>16</option><option>20</option></select></label>
                <label><span>包含已解决记忆</span><input id="storyMemoryIncludeResolved" type="checkbox"></label>
              </div>
            </aside>
            <main class="memory-library">
              <div class="memory-filters"><input id="storyMemorySearch" placeholder="搜索记忆、人物或标签" /><select id="storyMemoryTypeFilter"><option value="">全部类型</option>${MEMORY_TYPES.map((type) => `<option>${type}</option>`).join("")}</select></div>
              <div id="storyMemoryList"></div>
            </main>
          </div>
        </section>
      </div>`);

    button.addEventListener("click", openMemory);
    document.getElementById("storyMemoryClose").addEventListener("click", closeMemory);
    document.getElementById("storyMemoryMask").addEventListener("click", (event) => { if (event.target.id === "storyMemoryMask") closeMemory(); });
    document.getElementById("storyMemorySave").addEventListener("click", saveFormMemory);
    document.getElementById("storyMemoryCancelEdit").addEventListener("click", resetForm);
    document.getElementById("storyMemorySearch").addEventListener("input", renderMemoryList);
    document.getElementById("storyMemoryTypeFilter").addEventListener("change", renderMemoryList);
    document.getElementById("storyMemoryList").addEventListener("click", (event) => {
      const card = event.target.closest("[data-memory-id]");
      const action = event.target.closest("[data-memory-action]")?.dataset.memoryAction;
      if (!card || !action) return;
      if (action === "edit") editMemory(card.dataset.memoryId);
      if (action === "toggle") toggleMemory(card.dataset.memoryId);
      if (action === "delete" && confirm("删除这条故事记忆？")) deleteMemory(card.dataset.memoryId);
    });

    ["storyMemoryEnabled", "storyMemoryMaxItems", "storyMemoryIncludeResolved"].forEach((id) => {
      document.getElementById(id).addEventListener("change", () => {
        savePrefs({
          enabled: document.getElementById("storyMemoryEnabled").checked,
          maxItems: Number(document.getElementById("storyMemoryMaxItems").value) || 12,
          includeResolved: document.getElementById("storyMemoryIncludeResolved").checked
        });
      });
    });

    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMemory(); });
    document.addEventListener("change", (event) => { if (event.target?.id === "projectSelect") syncButton(); }, true);
    document.getElementById("studioLibrary")?.addEventListener("click", () => setTimeout(syncButton, 0));
    syncButton();
  }

  function addStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .memory-top-btn{gap:7px}.memory-top-btn b{min-width:18px;height:18px;padding:0 5px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;background:var(--accent);color:var(--accent-ink);font-size:10px}.memory-mask{position:fixed;inset:0;z-index:145;background:rgba(4,5,4,.68);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:18px}.memory-mask[hidden]{display:none}.memory-dialog{width:min(1100px,100%);max-height:92vh;overflow:hidden;border:1px solid var(--border-strong);border-radius:16px;background:var(--surface-solid);box-shadow:var(--shadow);color:var(--text)}.memory-dialog>header{display:flex;align-items:center;justify-content:space-between;padding:17px 20px;border-bottom:1px solid var(--border)}.memory-dialog>header div{display:flex;flex-direction:column;gap:3px}.memory-dialog>header span{font-size:10px;color:var(--accent);letter-spacing:.14em}.memory-dialog>header strong{font-size:18px}.memory-dialog>header button{width:34px;height:34px;border:1px solid var(--border);border-radius:9px;background:var(--surface-soft);color:var(--text);cursor:pointer;font-size:20px}.memory-layout{display:grid;grid-template-columns:minmax(300px,380px) 1fr;min-height:620px;max-height:calc(92vh - 70px)}.memory-editor{padding:18px;border-right:1px solid var(--border);overflow:auto}.memory-editor h3{margin:0 0 13px;font-size:15px}.memory-editor label{display:flex;flex-direction:column;gap:6px;margin:10px 0;color:var(--text-soft);font-size:11px}.memory-editor input,.memory-editor textarea,.memory-editor select,.memory-filters input,.memory-filters select{width:100%;border:1px solid var(--border);border-radius:9px;background:var(--surface-soft);color:var(--text);padding:9px 10px;outline:0}.memory-editor textarea{resize:vertical;line-height:1.6}.memory-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 9px}.memory-form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.memory-form-actions button,.memory-actions button{border:1px solid var(--border);border-radius:8px;background:var(--surface-soft);color:var(--text-soft);padding:7px 10px;cursor:pointer}.memory-form-actions #storyMemorySave{background:var(--accent);color:var(--accent-ink);border-color:transparent}.memory-prefs{margin-top:20px;padding-top:15px;border-top:1px solid var(--border)}.memory-prefs>strong{font-size:12px}.memory-prefs label{flex-direction:row;align-items:center;justify-content:space-between}.memory-prefs select{width:88px}.memory-library{min-width:0;padding:18px;overflow:auto}.memory-filters{display:grid;grid-template-columns:1fr 150px;gap:9px;position:sticky;top:0;z-index:2;padding-bottom:12px;background:var(--surface-solid)}.memory-card{padding:14px;margin-bottom:10px;border:1px solid var(--border);border-radius:12px;background:var(--surface-soft)}.memory-card.resolved{opacity:.58}.memory-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.memory-card-head>div{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.memory-card-head span{color:var(--accent);font-size:11px;font-weight:700}.memory-card-head b,.memory-card-head em,.memory-card-head small{font-size:10px;color:var(--muted);font-style:normal;font-weight:500}.memory-card p{margin:10px 0;color:var(--text);font-size:13px;line-height:1.65;white-space:pre-wrap}.memory-chips{display:flex;gap:5px;flex-wrap:wrap}.memory-chips span{padding:3px 6px;border-radius:6px;background:rgba(255,255,255,.05);color:var(--muted);font-size:10px}.memory-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:10px}.memory-actions button{padding:4px 7px;font-size:10px}.memory-empty{padding:56px 20px;text-align:center;color:var(--muted);font-size:12px}@media(max-width:820px){.memory-mask{padding:8px}.memory-layout{grid-template-columns:1fr;overflow:auto;display:block}.memory-dialog{overflow:auto}.memory-editor{border-right:0;border-bottom:1px solid var(--border)}.memory-library{overflow:visible}.memory-form-grid,.memory-filters{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  const previousFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (!url.includes("/api/chat") || typeof init?.body !== "string") return previousFetch(input, init);

    try {
      const payload = JSON.parse(init.body);
      const memories = selectRelevantMemories(payload);
      if (memories.length) payload.memory_context = { version: 1, items: memories };
      else delete payload.memory_context;
      return previousFetch(input, { ...init, body: JSON.stringify(payload) });
    } catch {
      return previousFetch(input, init);
    }
  };

  window.UnlimitedMemory = {
    readStore,
    projectMemories,
    setProjectMemories,
    normalizeMemory,
    selectRelevantMemories,
    open: openMemory
  };

  function init() {
    addStyles();
    createUi();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
