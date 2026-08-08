// public/continuity-bridge.js
// Reviewed continuity layer: AI-maintained chapter summaries and character current states.
(() => {
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LS_CONTINUITY = "cfw_continuity_v1";
  let reviewResult = null;
  let reviewProjectId = "";
  let reviewChapterId = "";

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function readStore() {
    const raw = readJson(LS_CONTINUITY, null);
    if (!raw || typeof raw !== "object") return { version: 1, projects: {} };
    raw.version = 1;
    raw.projects = raw.projects && typeof raw.projects === "object" ? raw.projects : {};
    return raw;
  }

  function saveStore(store) {
    writeJson(LS_CONTINUITY, store);
    syncButton();
  }

  function activeContext() {
    const state = readJson(LS_STUDIO, null);
    const projects = Array.isArray(state?.projects) ? state.projects : [];
    const project = projects.find((item) => item.id === state?.activeProjectId) || projects[0] || null;
    const chapter = project?.chapters?.find((item) => item.id === state?.activeChapterId) || null;
    return { state, project, chapter };
  }

  function projectContinuity(projectId) {
    const store = readStore();
    return store.projects[projectId] || { chapters: {}, characters: {} };
  }

  function ensureProject(store, projectId) {
    store.projects[projectId] = store.projects[projectId] || { chapters: {}, characters: {} };
    store.projects[projectId].chapters = store.projects[projectId].chapters || {};
    store.projects[projectId].characters = store.projects[projectId].characters || {};
    return store.projects[projectId];
  }

  function currentPayload() {
    const { project, chapter } = activeContext();
    if (!project) return null;
    const continuity = projectContinuity(project.id);
    const chapterReview = chapter?.id ? continuity.chapters?.[chapter.id] : null;
    const characterStates = Object.values(continuity.characters || {})
      .filter((item) => item?.name && item?.state)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 30)
      .map((item) => ({ name: item.name, state: item.state }));
    if (!chapterReview?.summary && !characterStates.length) return null;
    return {
      version: 1,
      chapterId: chapter?.id || "",
      chapterSummary: chapterReview?.summary || "",
      characterStates
    };
  }

  function recentConversationText() {
    const rows = Array.from(document.querySelectorAll("#chat .row")).slice(-12);
    const text = rows.map((row) => {
      const content = row.querySelector(".bubble")?.textContent?.trim() || "";
      if (!content || content.startsWith("错误:")) return "";
      return `${row.classList.contains("ai") ? "AI" : "用户"}：${content}`;
    }).filter(Boolean).join("\n\n");
    return text.length > 18000 ? text.slice(-18000) : text;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[char]));
  }

  function syncButton() {
    const button = document.getElementById("continuityBtn");
    if (!button) return;
    const { project, chapter } = activeContext();
    if (!project) return button.querySelector("b").textContent = "0";
    const data = projectContinuity(project.id);
    const count = (chapter?.id && data.chapters?.[chapter.id]?.summary ? 1 : 0)
      + Object.values(data.characters || {}).filter((item) => item?.state).length;
    button.querySelector("b").textContent = String(count);
  }

  function renderCurrent() {
    const body = document.getElementById("continuityCurrent");
    if (!body) return;
    const { project, chapter } = activeContext();
    if (!project) {
      body.innerHTML = `<div class="continuity-empty">请先创建小说项目。</div>`;
      return;
    }
    const data = projectContinuity(project.id);
    const chapterSummary = chapter?.id ? data.chapters?.[chapter.id]?.summary || "" : "";
    const states = Object.values(data.characters || {}).filter((item) => item?.name && item?.state)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    body.innerHTML = `
      <section class="continuity-current-section">
        <div class="continuity-section-head"><strong>当前章节摘要</strong>${chapterSummary ? `<button data-continuity-clear="chapter" type="button">清除</button>` : ""}</div>
        <p>${chapter ? (chapterSummary ? escapeHtml(chapterSummary) : "还没有 AI 维护摘要。") : "当前未选择章节。"}</p>
      </section>
      <section class="continuity-current-section">
        <div class="continuity-section-head"><strong>人物当前状态</strong><span>${states.length} 人</span></div>
        ${states.length ? states.map((item) => `<article class="continuity-state" data-character-name="${escapeHtml(item.name)}"><div><b>${escapeHtml(item.name)}</b><button data-continuity-clear="character" type="button">删除</button></div><p>${escapeHtml(item.state)}</p></article>`).join("") : `<p>还没有维护人物状态。</p>`}
      </section>`;
  }

  function openDialog() {
    renderCurrent();
    document.getElementById("continuityMask").hidden = false;
  }

  function closeDialog() {
    const mask = document.getElementById("continuityMask");
    if (mask) mask.hidden = true;
  }

  function clearReviewed(kind, characterName = "") {
    const { project, chapter } = activeContext();
    if (!project) return;
    const store = readStore();
    const data = ensureProject(store, project.id);
    if (kind === "chapter" && chapter?.id) delete data.chapters[chapter.id];
    if (kind === "character" && characterName) delete data.characters[characterName];
    saveStore(store);
    renderCurrent();
  }

  function renderReview(model = "") {
    const body = document.getElementById("continuityReviewBody");
    if (!body || !reviewResult) return;
    const summary = String(reviewResult.chapterSummary || "").trim();
    const states = Array.isArray(reviewResult.characterStates) ? reviewResult.characterStates : [];
    if (!summary && !states.length) {
      body.innerHTML = `<div class="continuity-empty">AI 没有发现需要更新的连续性信息。</div>`;
      document.getElementById("continuityReviewSave").disabled = true;
      return;
    }
    document.getElementById("continuityReviewSave").disabled = false;
    body.innerHTML = `${model ? `<div class="continuity-model">分析模型：${escapeHtml(model)}</div>` : ""}
      ${summary ? `<label class="continuity-review-item"><input type="checkbox" id="continuityAcceptSummary" checked><div><b>章节摘要</b><p>${escapeHtml(summary)}</p></div></label>` : ""}
      ${states.map((item, index) => `<label class="continuity-review-item"><input type="checkbox" data-continuity-state-index="${index}" checked><div><b>${escapeHtml(item.name)}</b><p>${escapeHtml(item.state)}</p></div></label>`).join("")}`;
  }

  async function runReview() {
    const { project, chapter } = activeContext();
    const recentText = recentConversationText();
    if (!project) return alert("请先创建小说项目。 ");
    if (!chapter) return alert("请先选择当前章节。 ");
    if (!recentText.trim()) return alert("当前对话还没有可分析的剧情内容。 ");

    const button = document.getElementById("continuityAnalyze");
    const old = button.textContent;
    button.disabled = true;
    button.textContent = "分析中…";
    try {
      const existingContinuity = projectContinuity(project.id);
      const characters = (project.characters || []).map((character) => {
        if (typeof character === "string") return character;
        const name = character?.name || character?.title || "";
        const reviewed = existingContinuity.characters?.[name]?.state || "";
        return { ...character, currentState: reviewed || character?.currentState || character?.state || "" };
      });
      const response = await fetch("/api/continuity/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: document.getElementById("modelSel")?.value || window.APP_DEFAULT_MODEL,
          chapter: {
            ...chapter,
            summary: existingContinuity.chapters?.[chapter.id]?.summary || chapter.summary || ""
          },
          characters,
          recentText
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      reviewResult = data;
      reviewProjectId = project.id;
      reviewChapterId = chapter.id;
      renderReview(data.model || "");
      document.getElementById("continuityReviewMask").hidden = false;
    } catch (error) {
      alert(`连续性分析失败：${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  }

  function saveReview() {
    if (!reviewResult || !reviewProjectId) return;
    const store = readStore();
    const data = ensureProject(store, reviewProjectId);
    const summaryAccepted = document.getElementById("continuityAcceptSummary")?.checked;
    if (summaryAccepted && reviewChapterId && reviewResult.chapterSummary) {
      data.chapters[reviewChapterId] = {
        summary: String(reviewResult.chapterSummary).trim(),
        updatedAt: Date.now()
      };
    }
    Array.from(document.querySelectorAll("[data-continuity-state-index]:checked")).forEach((input) => {
      const item = reviewResult.characterStates?.[Number(input.dataset.continuityStateIndex)];
      const name = String(item?.name || "").trim();
      const state = String(item?.state || "").trim();
      if (!name || !state) return;
      data.characters[name] = { name, state, updatedAt: Date.now() };
    });
    saveStore(store);
    document.getElementById("continuityReviewMask").hidden = true;
    renderCurrent();
  }

  function createUi() {
    if (document.getElementById("continuityBtn")) return;
    const controls = document.querySelector(".topbar-actions");
    if (!controls) return;
    const button = document.createElement("button");
    button.id = "continuityBtn";
    button.className = "studio-top-btn continuity-top-btn";
    button.type = "button";
    button.innerHTML = `<span>连续性</span><b>0</b>`;
    const memoryButton = document.getElementById("storyMemoryBtn");
    controls.insertBefore(button, memoryButton || document.getElementById("readerBtn") || controls.firstChild);
    button.addEventListener("click", openDialog);

    document.body.insertAdjacentHTML("beforeend", `
      <div id="continuityMask" class="continuity-mask" hidden><section class="continuity-dialog" role="dialog" aria-modal="true"><header><div><span>CONTINUITY</span><strong>章节与人物连续性</strong><p>已确认的信息会优先进入后续 AI 上下文。</p></div><button id="continuityClose" type="button">×</button></header><div id="continuityCurrent"></div><footer><button id="continuityAnalyze" type="button">AI 分析当前剧情</button></footer></section></div>
      <div id="continuityReviewMask" class="continuity-mask" hidden><section class="continuity-dialog continuity-review-dialog" role="dialog" aria-modal="true"><header><div><span>REVIEW</span><strong>确认连续性更新</strong><p>只有勾选的项目会保存。</p></div><button id="continuityReviewClose" type="button">×</button></header><div id="continuityReviewBody"></div><footer><button id="continuityReviewCancel" type="button">取消</button><button id="continuityReviewSave" type="button">保存已勾选</button></footer></section></div>`);

    document.getElementById("continuityClose").addEventListener("click", closeDialog);
    document.getElementById("continuityAnalyze").addEventListener("click", runReview);
    document.getElementById("continuityMask").addEventListener("click", (event) => { if (event.target.id === "continuityMask") closeDialog(); });
    document.getElementById("continuityReviewClose").addEventListener("click", () => document.getElementById("continuityReviewMask").hidden = true);
    document.getElementById("continuityReviewCancel").addEventListener("click", () => document.getElementById("continuityReviewMask").hidden = true);
    document.getElementById("continuityReviewSave").addEventListener("click", saveReview);
    document.getElementById("continuityReviewMask").addEventListener("click", (event) => { if (event.target.id === "continuityReviewMask") event.currentTarget.hidden = true; });
    document.getElementById("continuityCurrent").addEventListener("click", (event) => {
      const action = event.target.closest("[data-continuity-clear]")?.dataset.continuityClear;
      if (!action) return;
      if (action === "chapter" && confirm("清除当前章节的 AI 维护摘要？")) clearReviewed("chapter");
      if (action === "character") {
        const name = event.target.closest("[data-character-name]")?.dataset.characterName || "";
        if (name && confirm(`删除 ${name} 的当前状态？`)) clearReviewed("character", name);
      }
    });
    document.addEventListener("change", (event) => { if (event.target?.id === "projectSelect") setTimeout(syncButton, 0); }, true);
    document.getElementById("studioLibrary")?.addEventListener("click", () => setTimeout(syncButton, 0));
    syncButton();
  }

  function addStyles() {
    const style = document.createElement("style");
    style.textContent = `.continuity-top-btn{gap:7px}.continuity-top-btn b{min-width:18px;height:18px;padding:0 5px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;background:var(--accent);color:var(--accent-ink);font-size:10px}.continuity-mask{position:fixed;inset:0;z-index:150;background:rgba(4,5,4,.68);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:18px}.continuity-mask[hidden]{display:none}.continuity-dialog{width:min(760px,100%);max-height:90vh;overflow:auto;border:1px solid var(--border-strong);border-radius:16px;background:var(--surface-solid);box-shadow:var(--shadow)}.continuity-dialog>header{display:flex;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid var(--border)}.continuity-dialog>header div{display:flex;flex-direction:column;gap:3px}.continuity-dialog>header span{font-size:10px;letter-spacing:.14em;color:var(--accent)}.continuity-dialog>header strong{font-size:18px}.continuity-dialog>header p{margin:2px 0 0;color:var(--muted);font-size:11px}.continuity-dialog>header button{width:34px;height:34px;border:1px solid var(--border);border-radius:9px;background:var(--surface-soft);color:var(--text);font-size:20px}.continuity-dialog>footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid var(--border)}.continuity-dialog>footer button{border:1px solid var(--border);border-radius:9px;padding:8px 12px;background:var(--surface-soft);color:var(--text);cursor:pointer}.continuity-dialog>footer #continuityAnalyze,.continuity-dialog>footer #continuityReviewSave{background:var(--accent);color:var(--accent-ink);border-color:transparent}#continuityCurrent,#continuityReviewBody{padding:16px 20px}.continuity-current-section{padding:13px 0;border-bottom:1px solid var(--border)}.continuity-current-section:last-child{border-bottom:0}.continuity-section-head,.continuity-state>div{display:flex;align-items:center;justify-content:space-between;gap:12px}.continuity-section-head strong,.continuity-state b{font-size:12px}.continuity-section-head span{color:var(--muted);font-size:10px}.continuity-section-head button,.continuity-state button{border:0;background:transparent;color:var(--muted);cursor:pointer;font-size:10px}.continuity-current-section>p,.continuity-state p{margin:8px 0 0;color:var(--text-soft);font-size:12px;line-height:1.65;white-space:pre-wrap}.continuity-state{padding:10px;margin-top:8px;border:1px solid var(--border);border-radius:9px;background:var(--surface-soft)}.continuity-review-item{display:grid;grid-template-columns:auto 1fr;gap:10px;padding:12px;margin-bottom:8px;border:1px solid var(--border);border-radius:10px;background:var(--surface-soft)}.continuity-review-item>input{margin-top:3px}.continuity-review-item b{font-size:11px;color:var(--accent)}.continuity-review-item p{margin:7px 0 0;color:var(--text);font-size:13px;line-height:1.6;white-space:pre-wrap}.continuity-model{margin-bottom:10px;color:var(--muted);font-size:10px}.continuity-empty{padding:44px 20px;text-align:center;color:var(--muted);font-size:12px}`;
    document.head.appendChild(style);
  }

  const previousFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (!url.includes("/api/chat") || typeof init?.body !== "string") return previousFetch(input, init);
    try {
      const payload = JSON.parse(init.body);
      const continuity = currentPayload();
      if (continuity) payload.continuity_context = continuity;
      else delete payload.continuity_context;
      return previousFetch(input, { ...init, body: JSON.stringify(payload) });
    } catch {
      return previousFetch(input, init);
    }
  };

  window.UnlimitedContinuity = { readStore, currentPayload, open: openDialog };

  function init() {
    addStyles();
    createUi();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
