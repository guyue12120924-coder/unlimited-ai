// public/simple-studio.js
// Minimal chapter writing layer: one native textarea, auto-save through studio.js,
// and a small amount of context support. No modal editor or rewrite workflow.
(() => {
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const CONTEXT_TAIL_CHARS = 6500;
  let observer = null;

  function readState() {
    try {
      const value = JSON.parse(localStorage.getItem(LS_STUDIO) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function activeData() {
    const state = readState();
    const projects = Array.isArray(state.projects) ? state.projects : [];
    const project = projects.find((item) => item.id === state.activeProjectId) || projects[0] || null;
    const chapter = project?.chapters?.find((item) => item.id === state.activeChapterId) || null;
    return { state, project, chapter };
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function countWords(text) {
    return String(text || "").replace(/\s/g, "").length;
  }

  function simplifyTabs() {
    document.querySelectorAll(".studio-tabs [data-studio-tab]").forEach((button) => {
      const keep = ["draft", "outline", "characters", "world"].includes(button.dataset.studioTab);
      button.hidden = !keep;
    });
  }

  function keepEditorFocus(editor) {
    if (!editor || editor.dataset.focusGuard === "1") return;
    editor.dataset.focusGuard = "1";

    // The legacy workspace has several delegated mouse/click handlers. Keep events
    // originating from the manuscript textarea inside the textarea so releasing the
    // mouse button cannot hand focus back to another workspace control.
    ["pointerdown", "mousedown", "mouseup", "click"].forEach((type) => {
      editor.addEventListener(type, (event) => {
        event.stopPropagation();
        if (type === "mouseup" || type === "click") {
          requestAnimationFrame(() => {
            if (document.activeElement !== editor) editor.focus({ preventScroll: true });
          });
        }
      });
    });
  }

  function renderSimpleDraft() {
    const body = document.getElementById("studioPanelBody");
    const draftButton = document.querySelector('.studio-tabs [data-studio-tab="draft"]');
    if (!body || !draftButton?.classList.contains("active")) return;
    if (body.querySelector("#simpleManuscriptPane")) {
      keepEditorFocus(body.querySelector("#simpleManuscriptEditor"));
      return;
    }

    const { chapter } = activeData();
    if (!chapter) {
      body.innerHTML = `
        <div id="simpleManuscriptPane" class="studio-pane simple-manuscript-pane simple-manuscript-empty">
          <strong>先选择一个章节</strong>
          <p>从左侧章节列表选择章节，然后回到“正文”即可开始写作。</p>
        </div>`;
      return;
    }

    if (typeof chapter.manuscript !== "string") chapter.manuscript = "";
    const words = countWords(chapter.manuscript);
    const target = Math.max(100, Number(chapter.targetWords) || 3000);

    body.innerHTML = `
      <div id="simpleManuscriptPane" class="studio-pane simple-manuscript-pane">
        <div class="simple-manuscript-head">
          <div>
            <span>正文</span>
            <h3>${escapeHtml(chapter.name || "未命名章节")}</h3>
          </div>
          <strong id="simpleManuscriptCount">${words.toLocaleString()} / ${target.toLocaleString()} 字</strong>
        </div>
        <textarea
          id="simpleManuscriptEditor"
          data-chapter-field="manuscript"
          placeholder="直接在这里写正文……"
          spellcheck="false"
        >${escapeHtml(chapter.manuscript)}</textarea>
        <div class="simple-manuscript-footer">
          <span id="simpleManuscriptStatus">自动保存</span>
          <div>
            <button id="simpleCopyManuscript" type="button">复制正文</button>
            <button id="simpleExportManuscript" type="button">导出 TXT</button>
          </div>
        </div>
      </div>`;

    keepEditorFocus(body.querySelector("#simpleManuscriptEditor"));
  }

  function syncCount(editor) {
    const { chapter } = activeData();
    const count = document.getElementById("simpleManuscriptCount");
    const status = document.getElementById("simpleManuscriptStatus");
    if (count) {
      const target = Math.max(100, Number(chapter?.targetWords) || 3000);
      count.textContent = `${countWords(editor.value).toLocaleString()} / ${target.toLocaleString()} 字`;
    }
    if (status) {
      status.textContent = "已保存";
      clearTimeout(status.resetTimer);
      status.resetTimer = setTimeout(() => { status.textContent = "自动保存"; }, 900);
    }
  }

  function downloadText(filename, content) {
    const blob = new Blob(["\uFEFF", content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = String(filename || "chapter").replace(/[\\/:*?"<>|]/g, "_") + ".txt";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bindEvents() {
    document.addEventListener("input", (event) => {
      if (event.target?.id !== "simpleManuscriptEditor") return;
      // studio.js owns the actual save through data-chapter-field="manuscript".
      // We only update the lightweight visual status here.
      requestAnimationFrame(() => syncCount(event.target));
    });

    document.addEventListener("click", async (event) => {
      if (event.target.closest("#simpleCopyManuscript")) {
        const editor = document.getElementById("simpleManuscriptEditor");
        if (!editor?.value.trim()) return;
        try { await navigator.clipboard.writeText(editor.value); } catch {}
        return;
      }
      if (event.target.closest("#simpleExportManuscript")) {
        const editor = document.getElementById("simpleManuscriptEditor");
        const { chapter } = activeData();
        if (!editor?.value.trim() || !chapter) return;
        downloadText(chapter.name || "chapter", editor.value);
      }
    });
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
        const { chapter } = activeData();
        const manuscript = String(chapter?.manuscript || "").trim();
        if (manuscript && payload.creative_context?.chapter) {
          payload.creative_context.chapter.manuscriptExcerpt = manuscript.slice(-CONTEXT_TAIL_CHARS);
        }
        return previousFetch(input, { ...init, body: JSON.stringify(payload) });
      } catch {
        return previousFetch(input, init);
      }
    };
  }

  function refresh() {
    simplifyTabs();
    renderSimpleDraft();
  }

  function init() {
    simplifyTabs();
    bindEvents();
    installContextBridge();

    const body = document.getElementById("studioPanelBody");
    if (body) {
      observer = new MutationObserver(() => requestAnimationFrame(refresh));
      observer.observe(body, { childList: true, subtree: false });
    }

    document.querySelector(".studio-tabs")?.addEventListener("click", () => setTimeout(refresh, 0));
    document.getElementById("studioLibrary")?.addEventListener("click", () => setTimeout(refresh, 70));
    refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
