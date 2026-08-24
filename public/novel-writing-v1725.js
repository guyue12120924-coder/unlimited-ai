// V17.25 Writing Workspace Redesign
// The manuscript is the center of the novel experience; AI chat and creative materials remain available.
(() => {
  const REVISION = "2026-08-24-v17.25-writing-workspace-redesign";
  const LS_STUDIO = "cfw_studio_workspace_v1";
  if (window.UnlimitedNovelWritingV1725?.revision === REVISION) return;

  let observer = null;
  let queued = false;
  let currentChapterId = "";
  let view = "manuscript";
  let statusTimer = 0;

  function isNovelMode() {
    return document.body?.dataset?.uaiMode === "novel";
  }

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
    const project = projects.find(item => item.id === state.activeProjectId) || projects[0] || null;
    const chapters = Array.isArray(project?.chapters) ? project.chapters : [];
    const chapter = chapters.find(item => item.id === state.activeChapterId) || null;
    return { state, project, chapters, chapter };
  }

  function countText(value) {
    return String(value || "").replace(/\s/g, "").length;
  }

  function setStatus(text = "已保存") {
    const node = document.getElementById("novelV1725SaveStatus");
    if (!node) return;
    node.textContent = text;
    clearTimeout(statusTimer);
    if (text === "已保存") {
      statusTimer = setTimeout(() => {
        if (document.contains(node)) node.textContent = "自动保存";
      }, 900);
    }
  }

  function ensureManuscriptProxy() {
    const panel = document.getElementById("studioPanelBody");
    if (!panel) return null;
    let proxy = panel.querySelector("#novelV1725ManuscriptProxy");
    if (!proxy) {
      proxy = document.createElement("textarea");
      proxy.id = "novelV1725ManuscriptProxy";
      proxy.className = "novel-v1725-manuscript-proxy";
      proxy.hidden = true;
      proxy.dataset.chapterField = "manuscript";
      proxy.setAttribute("aria-hidden", "true");
      panel.appendChild(proxy);
    }
    return proxy;
  }

  function saveManuscript(value) {
    const proxy = ensureManuscriptProxy();
    if (!proxy) return false;
    proxy.value = String(value || "");
    proxy.dispatchEvent(new Event("input", { bubbles: true }));
    setStatus("已保存");
    syncCount();
    return true;
  }

  function syncCount() {
    const editor = document.getElementById("simpleManuscriptEditor");
    const count = document.getElementById("novelV1725WordCount");
    const { chapter } = activeData();
    if (!editor || !count) return;
    const words = countText(editor.value);
    const target = Math.max(100, Number(chapter?.targetWords) || 3000);
    count.textContent = `${words.toLocaleString()} / ${target.toLocaleString()} 字`;
  }

  function ensureCenterWorkspace() {
    const pane = document.getElementById("conversationPane");
    const history = document.getElementById("history");
    if (!pane || !history) return false;

    if (!document.getElementById("novelV1725CenterBar")) {
      const bar = document.createElement("div");
      bar.id = "novelV1725CenterBar";
      bar.className = "novel-v1725-center-bar";
      bar.innerHTML = `
        <div class="novel-v1725-breadcrumb">
          <span id="novelV1725ProjectLabel">我的小说</span><i>›</i><strong id="novelV1725ChapterLabel">未选择章节</strong>
        </div>
        <div class="novel-v1725-view-switch" role="tablist" aria-label="写作视图">
          <button type="button" data-v1725-view="manuscript" class="active" role="tab" aria-selected="true">正文</button>
          <button type="button" data-v1725-view="ai" role="tab" aria-selected="false">AI 助手</button>
        </div>`;
      pane.insertBefore(bar, history);
    }

    if (!document.getElementById("novelV1725ManuscriptView")) {
      const section = document.createElement("section");
      section.id = "novelV1725ManuscriptView";
      section.className = "novel-v1725-manuscript-view";
      section.innerHTML = `
        <div class="novel-v1725-paper-wrap">
          <header class="novel-v1725-paper-head">
            <div>
              <span>当前章节</span>
              <h1 id="novelV1725ChapterTitle">未选择章节</h1>
            </div>
            <span id="novelV1725WordCount">0 / 3,000 字</span>
          </header>
          <textarea id="simpleManuscriptEditor" class="novel-v1725-editor" data-v1725-editor="true" placeholder="直接在这里写正文……" spellcheck="false"></textarea>
          <div id="novelV1725Empty" class="novel-v1725-empty" hidden>
            <strong>先选择一个章节</strong>
            <p>从左侧选择章节，或者新建第一章，然后直接开始写。</p>
            <button id="novelV1725CreateChapter" type="button">新建章节</button>
          </div>
          <footer class="novel-v1725-paper-foot">
            <span id="novelV1725SaveStatus">自动保存</span>
            <span>AI 生成的内容可用“加入正文”直接插入当前章节</span>
          </footer>
        </div>`;
      pane.insertBefore(section, history);

      const editor = section.querySelector("#simpleManuscriptEditor");
      editor.addEventListener("input", () => saveManuscript(editor.value));
      section.querySelector("#novelV1725CreateChapter")?.addEventListener("click", () => {
        ensureLibraryOpen();
        document.getElementById("addChapter")?.click();
        setTimeout(() => document.getElementById("chapterNameInput")?.focus(), 0);
      });
    }

    return true;
  }

  function syncManuscript(force = false) {
    const editor = document.getElementById("simpleManuscriptEditor");
    const empty = document.getElementById("novelV1725Empty");
    const title = document.getElementById("novelV1725ChapterTitle");
    const projectLabel = document.getElementById("novelV1725ProjectLabel");
    const chapterLabel = document.getElementById("novelV1725ChapterLabel");
    const { project, chapter } = activeData();
    if (!editor || !empty) return;

    if (projectLabel) {
      projectLabel.textContent = project?.name?.trim() || "我的小说";
      projectLabel.title = projectLabel.textContent;
    }
    if (chapterLabel) {
      chapterLabel.textContent = chapter?.name?.trim() || "未选择章节";
      chapterLabel.title = chapterLabel.textContent;
    }
    if (title) {
      title.textContent = chapter?.name?.trim() || "未选择章节";
      title.title = title.textContent;
    }

    if (!chapter) {
      currentChapterId = "";
      editor.value = "";
      editor.disabled = true;
      editor.hidden = true;
      empty.hidden = false;
      syncCount();
      return;
    }

    editor.disabled = false;
    editor.hidden = false;
    empty.hidden = true;
    const next = typeof chapter.manuscript === "string" ? chapter.manuscript : "";
    if (force || currentChapterId !== chapter.id || document.activeElement !== editor) {
      if (editor.value !== next) editor.value = next;
    }
    currentChapterId = chapter.id;
    const proxy = ensureManuscriptProxy();
    if (proxy && proxy.value !== editor.value) proxy.value = editor.value;
    syncCount();
  }

  function setView(next, { focus = false } = {}) {
    view = next === "ai" ? "ai" : "manuscript";
    document.body?.classList.toggle("novel-v1725-ai-view", view === "ai");
    document.body?.classList.toggle("novel-v1725-manuscript-view", view === "manuscript");
    document.querySelectorAll("[data-v1725-view]").forEach(button => {
      const active = button.dataset.v1725View === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    if (view === "manuscript") syncManuscript(true);
    if (focus) {
      requestAnimationFrame(() => {
        const target = view === "manuscript" ? document.getElementById("simpleManuscriptEditor") : document.getElementById("msg");
        if (target && !target.disabled) target.focus({ preventScroll: true });
      });
    }
  }

  function ensureLibraryOpen() {
    if (!document.body.classList.contains("library-collapsed")) return;
    if (!window.UnlimitedNovelNavigationV1723C?.openLibrary?.()) {
      document.getElementById("libraryToggleBtn")?.click();
    }
  }

  function ensureMaterialsButton() {
    const actions = document.querySelector("#topbar .topbar-actions");
    if (!actions || document.getElementById("novelV1725MaterialsBtn")) return;
    const button = document.createElement("button");
    button.id = "novelV1725MaterialsBtn";
    button.className = "novel-v1725-materials-btn";
    button.type = "button";
    button.textContent = "创作资料";
    button.setAttribute("aria-expanded", "false");
    button.title = "打开大纲、人物和世界观";
    const settings = document.getElementById("settingsBtn");
    if (settings) actions.insertBefore(button, settings);
    else actions.appendChild(button);
    button.addEventListener("click", () => toggleMaterials());
  }

  function syncMaterialsButton() {
    const button = document.getElementById("novelV1725MaterialsBtn");
    if (!button) return;
    const open = !document.body.classList.contains("studio-collapsed");
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.classList.toggle("active", open);
  }

  function closeMaterials() {
    document.body.classList.add("studio-collapsed");
    syncMaterialsButton();
  }

  function openMaterials(tab = "") {
    const current = document.querySelector("#studioPanel .studio-tabs [data-studio-tab].active")?.dataset.studioTab;
    const targetTab = tab || (current && current !== "draft" ? current : "outline");
    const button = document.querySelector(`#studioPanel .studio-tabs [data-studio-tab="${CSS.escape(targetTab)}"]`);
    if (button && !button.classList.contains("active")) button.click();
    document.body.classList.remove("studio-collapsed");
    document.body.classList.add("library-collapsed");
    syncMaterialsButton();
  }

  function toggleMaterials() {
    if (document.body.classList.contains("studio-collapsed")) openMaterials();
    else closeMaterials();
  }

  function ensureDrawerScrim() {
    if (document.getElementById("novelV1725DrawerScrim")) return;
    const scrim = document.createElement("button");
    scrim.id = "novelV1725DrawerScrim";
    scrim.className = "novel-v1725-drawer-scrim";
    scrim.type = "button";
    scrim.setAttribute("aria-label", "关闭创作资料");
    scrim.addEventListener("click", closeMaterials);
    document.body.appendChild(scrim);
  }

  function normalizeDrawer() {
    const collapse = document.getElementById("collapseStudio");
    if (collapse) {
      collapse.textContent = "×";
      collapse.title = "关闭创作资料";
      collapse.setAttribute("aria-label", "关闭创作资料");
    }
    document.querySelectorAll('#studioPanel .studio-tabs [data-studio-tab="draft"]').forEach(button => {
      button.hidden = true;
    });
  }

  function closeLegacyDraftIfOpened() {
    const active = document.querySelector('#studioPanel .studio-tabs [data-studio-tab="draft"].active');
    if (!active) return;
    const outline = document.querySelector('#studioPanel .studio-tabs [data-studio-tab="outline"]');
    if (outline) outline.click();
    closeMaterials();
  }

  function syncTopbar() {
    const status = document.getElementById("novelV1723CurrentWork");
    if (status) status.setAttribute("aria-hidden", "true");
    const model = document.querySelector("#topbar .model-pill");
    if (model) model.title = "选择 AI 模型";
  }

  function syncRevision() {
    document.documentElement.dataset.novelV1725Revision = REVISION;
    const meta = document.querySelector('meta[name="unlimited-novel-revision"]');
    if (meta) meta.content = REVISION;
  }

  function patch() {
    queued = false;
    if (!isNovelMode()) {
      document.body?.classList.remove("novel-v1725-ready", "novel-v1725-ai-view", "novel-v1725-manuscript-view");
      return false;
    }
    if (!ensureCenterWorkspace()) return false;
    ensureMaterialsButton();
    ensureDrawerScrim();
    normalizeDrawer();
    syncTopbar();
    syncRevision();
    ensureManuscriptProxy();
    syncManuscript();
    syncMaterialsButton();
    document.body.classList.add("novel-v1725-ready");
    if (!document.body.classList.contains("novel-v1725-ai-view") && !document.body.classList.contains("novel-v1725-manuscript-view")) {
      setView("manuscript");
    }
    return true;
  }

  function schedulePatch() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(patch);
  }

  function bindObserver() {
    if (observer) observer.disconnect();
    const workspace = document.getElementById("creativeWorkspace");
    if (!workspace) return;
    observer = new MutationObserver(schedulePatch);
    observer.observe(workspace, { childList: true, subtree: true });
  }

  function refresh() {
    if (!isNovelMode()) return patch();
    patch();
    bindObserver();
    return true;
  }

  document.addEventListener("click", event => {
    if (!isNovelMode()) return;
    const viewButton = event.target.closest("[data-v1725-view]");
    if (viewButton) {
      setView(viewButton.dataset.v1725View, { focus: false });
      return;
    }

    const chapterItem = event.target.closest("#studioChapterList [data-chapter-id]");
    if (chapterItem && !event.target.closest(".chapter-status, .chapter-drag")) {
      requestAnimationFrame(() => {
        closeMaterials();
        setView("manuscript");
        syncManuscript(true);
      });
      return;
    }

    const sessionItem = event.target.closest("#studioSessionList [data-session-id]");
    if (sessionItem && !event.target.closest(".favorite-session, .novel-v1723-session-delete")) {
      requestAnimationFrame(() => setView("ai"));
      return;
    }

    if (event.target.closest("#sendBtn")) {
      setView("ai");
      return;
    }

    if (event.target.closest(".user-flow-add-manuscript, #userFlowSelectionAction")) {
      setTimeout(() => {
        syncManuscript(true);
        setView("manuscript");
      }, 420);
      return;
    }

    if (event.target.closest(".open-clip-source")) {
      setTimeout(() => {
        closeMaterials();
        setView("ai");
      }, 120);
      return;
    }

    if (event.target.closest('#studioPanel .studio-tabs [data-studio-tab="draft"]')) {
      requestAnimationFrame(closeLegacyDraftIfOpened);
    }
  }, true);

  document.addEventListener("keydown", event => {
    if (!isNovelMode()) return;
    if (event.target?.id === "msg" && event.key === "Enter" && !event.shiftKey) setView("ai");
    if (event.key === "Escape" && !document.body.classList.contains("studio-collapsed")) closeMaterials();
  }, true);

  document.addEventListener("change", event => {
    if (!isNovelMode()) return;
    if (event.target?.id === "projectSelect") {
      requestAnimationFrame(() => {
        currentChapterId = "";
        closeMaterials();
        setView("manuscript");
        syncManuscript(true);
      });
    }
  });

  window.addEventListener("uai:mode-refresh", () => {
    if (isNovelMode()) {
      document.body.classList.add("studio-collapsed");
      refresh();
      setView("manuscript");
    }
  });
  window.addEventListener("uai:workspace-refresh", refresh);
  window.addEventListener("resize", schedulePatch);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

  window.UnlimitedNovelWritingV1725 = {
    revision: REVISION,
    refresh,
    setView,
    openMaterials,
    closeMaterials
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (isNovelMode()) document.body.classList.add("studio-collapsed");
      refresh();
    }, { once: true });
  } else {
    if (isNovelMode()) document.body.classList.add("studio-collapsed");
    refresh();
  }
})();