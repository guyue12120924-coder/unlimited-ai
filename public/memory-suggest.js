// public/memory-suggest.js
// AI-assisted Story Memory suggestions. Suggestions are saved only after explicit user confirmation.
(() => {
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LS_SESSIONS = "cfw_sessions_v2";
  let suggestions = [];
  let sourceChapterId = "";
  let sourceProjectId = "";

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
  }

  function activeContext() {
    const state = readJson(LS_STUDIO, null);
    const projects = Array.isArray(state?.projects) ? state.projects : [];
    const project = projects.find((item) => item.id === state?.activeProjectId) || projects[0] || null;
    const chapter = project?.chapters?.find((item) => item.id === state?.activeChapterId) || null;
    return { state, project, chapter };
  }

  function currentSession() {
    const sessions = readJson(LS_SESSIONS, []);
    const currentId = document.querySelector("#sessionList .session-item.active .session-title")?.dataset.id
      || document.querySelector("#studioSessionList [data-session-id].active")?.dataset.sessionId;
    return sessions.find((item) => item.id === currentId) || sessions[0] || null;
  }

  function recentConversationText() {
    const session = currentSession();
    const messages = Array.isArray(session?.messages) ? session.messages.slice(-10) : [];
    const text = messages
      .filter((message) => typeof message?.content === "string" && message.content.trim())
      .map((message) => `${message.role === "assistant" ? "AI" : "用户"}：${message.content.trim()}`)
      .join("\n\n");
    return text.length > 18000 ? text.slice(-18000) : text;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[char]));
  }

  function closeSuggestions() {
    const mask = document.getElementById("memorySuggestMask");
    if (mask) mask.hidden = true;
  }

  function renderSuggestions(model = "") {
    const body = document.getElementById("memorySuggestBody");
    const confirm = document.getElementById("memorySuggestConfirm");
    if (!body || !confirm) return;
    if (!suggestions.length) {
      body.innerHTML = `<div class="memory-suggest-empty">AI 没有发现值得长期保存的新信息。</div>`;
      confirm.disabled = true;
      return;
    }
    confirm.disabled = false;
    body.innerHTML = `${model ? `<div class="memory-suggest-model">提取模型：${escapeHtml(model)}</div>` : ""}${suggestions.map((item, index) => `
      <label class="memory-suggest-item">
        <input type="checkbox" data-memory-suggest-index="${index}" checked>
        <div><div><b>${escapeHtml(item.type || "事件")}</b><span>重要度 ${item.importance || 3}</span></div><p>${escapeHtml(item.content || "")}</p>${(item.characters || []).length || (item.tags || []).length ? `<small>${[...(item.characters || []).map((x) => `人物:${x}`), ...(item.tags || [])].map(escapeHtml).join(" · ")}</small>` : ""}</div>
      </label>`).join("")}`;
  }

  async function extractSuggestions() {
    const button = document.getElementById("memorySuggestTrigger");
    const { project, chapter } = activeContext();
    const recentText = recentConversationText();
    if (!project) return alert("请先创建小说项目。 ");
    if (!recentText.trim()) return alert("当前会话还没有可提取的剧情内容。 ");

    button.disabled = true;
    const oldText = button.textContent;
    button.textContent = "提取中…";
    try {
      const existing = window.UnlimitedMemory?.projectMemories(project.id) || [];
      const response = await fetch("/api/memory/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: document.getElementById("modelSel")?.value || window.APP_DEFAULT_MODEL,
          chapter: chapter || {},
          characters: project.characters || [],
          existing: existing.slice(-30),
          recentText
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      suggestions = Array.isArray(data.items) ? data.items : [];
      sourceProjectId = project.id;
      sourceChapterId = chapter?.id || "";
      renderSuggestions(data.model || "");
      document.getElementById("memorySuggestMask").hidden = false;
    } catch (error) {
      alert(`记忆提取失败：${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = oldText;
    }
  }

  function saveSelectedSuggestions() {
    if (!sourceProjectId || !window.UnlimitedMemory) return closeSuggestions();
    const selected = Array.from(document.querySelectorAll("[data-memory-suggest-index]:checked"))
      .map((input) => suggestions[Number(input.dataset.memorySuggestIndex)])
      .filter(Boolean);
    const memories = window.UnlimitedMemory.projectMemories(sourceProjectId);
    const existingContent = new Set(memories.map((item) => String(item.content || "").trim()));
    let added = 0;
    selected.forEach((item) => {
      const content = String(item.content || "").trim();
      if (!content || existingContent.has(content)) return;
      memories.push(window.UnlimitedMemory.normalizeMemory({
        ...item,
        chapterId: sourceChapterId,
        source: "ai",
        status: "active"
      }));
      existingContent.add(content);
      added += 1;
    });
    window.UnlimitedMemory.setProjectMemories(sourceProjectId, memories);
    closeSuggestions();
    if (added) {
      window.UnlimitedMemory.open();
    } else {
      alert("没有新增记忆；所选内容可能已经存在。 ");
    }
  }

  function createUi() {
    if (!window.UnlimitedMemory || document.getElementById("memorySuggestTrigger")) return;
    const actions = document.querySelector(".memory-form-actions");
    if (!actions) return;
    const button = document.createElement("button");
    button.id = "memorySuggestTrigger";
    button.type = "button";
    button.textContent = "AI 提取候选";
    actions.insertBefore(button, actions.firstChild);
    button.addEventListener("click", extractSuggestions);

    document.body.insertAdjacentHTML("beforeend", `
      <div id="memorySuggestMask" class="memory-suggest-mask" hidden>
        <section class="memory-suggest-dialog" role="dialog" aria-modal="true" aria-labelledby="memorySuggestTitle">
          <header><div><span>MEMORY REVIEW</span><strong id="memorySuggestTitle">确认长期记忆</strong><p>AI 只提供候选；取消勾选不需要保存的细节。</p></div><button id="memorySuggestClose" type="button">×</button></header>
          <div id="memorySuggestBody"></div>
          <footer><button id="memorySuggestCancel" type="button">取消</button><button id="memorySuggestConfirm" type="button">保存已勾选</button></footer>
        </section>
      </div>`);
    document.getElementById("memorySuggestClose").addEventListener("click", closeSuggestions);
    document.getElementById("memorySuggestCancel").addEventListener("click", closeSuggestions);
    document.getElementById("memorySuggestConfirm").addEventListener("click", saveSelectedSuggestions);
    document.getElementById("memorySuggestMask").addEventListener("click", (event) => { if (event.target.id === "memorySuggestMask") closeSuggestions(); });
  }

  function addStyles() {
    const style = document.createElement("style");
    style.textContent = `.memory-suggest-mask{position:fixed;inset:0;z-index:155;background:rgba(4,5,4,.72);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:18px}.memory-suggest-mask[hidden]{display:none}.memory-suggest-dialog{width:min(760px,100%);max-height:88vh;display:flex;flex-direction:column;border:1px solid var(--border-strong);border-radius:16px;background:var(--surface-solid);box-shadow:var(--shadow)}.memory-suggest-dialog>header{display:flex;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid var(--border)}.memory-suggest-dialog>header div{display:flex;flex-direction:column;gap:3px}.memory-suggest-dialog>header span{font-size:10px;letter-spacing:.14em;color:var(--accent)}.memory-suggest-dialog>header strong{font-size:18px}.memory-suggest-dialog>header p{margin:2px 0 0;color:var(--muted);font-size:11px}.memory-suggest-dialog>header button{width:34px;height:34px;border:1px solid var(--border);border-radius:9px;background:var(--surface-soft);color:var(--text);font-size:20px}.memory-suggest-dialog>footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid var(--border)}.memory-suggest-dialog>footer button{border:1px solid var(--border);border-radius:9px;padding:8px 12px;background:var(--surface-soft);color:var(--text);cursor:pointer}.memory-suggest-dialog>footer #memorySuggestConfirm{background:var(--accent);color:var(--accent-ink);border-color:transparent}#memorySuggestBody{overflow:auto;padding:16px 20px}.memory-suggest-model{margin-bottom:10px;color:var(--muted);font-size:10px}.memory-suggest-item{display:grid;grid-template-columns:auto 1fr;gap:10px;padding:12px;margin-bottom:8px;border:1px solid var(--border);border-radius:10px;background:var(--surface-soft);cursor:pointer}.memory-suggest-item>input{margin-top:3px}.memory-suggest-item>div>div{display:flex;gap:8px;align-items:center}.memory-suggest-item b{color:var(--accent);font-size:11px}.memory-suggest-item span,.memory-suggest-item small{color:var(--muted);font-size:10px}.memory-suggest-item p{margin:7px 0;color:var(--text);font-size:13px;line-height:1.6}.memory-suggest-empty{padding:50px 20px;text-align:center;color:var(--muted);font-size:12px}#memorySuggestTrigger{margin-right:auto}`;
    document.head.appendChild(style);
  }

  function init() {
    addStyles();
    createUi();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
