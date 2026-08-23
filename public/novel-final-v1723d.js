// V17.23D novel-only final UX consolidation.
(() => {
  const REVISION = "2026-08-23-v17.23d-novel-final-ux";
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LS_ONBOARDED = "cfw_novel_onboarding_v1723d";
  if (window.UnlimitedNovelFinalV1723D?.revision === REVISION) return;

  let observer = null;
  let refreshQueued = false;

  const QUICK_ACTIONS = {
    continue: "请根据当前章节已有内容继续正文，保持人物性格、叙事视角、文风和时间线一致，直接续写可进入正文的内容。",
    advance: "请推进当前剧情，让事件出现明确进展或新的矛盾，同时保持前文因果关系自然，不要突然跳场景。",
    dialogue: "请为当前场景写一段自然、有角色差异的对话。让对话推动人物关系或剧情，并减少空泛解释。",
    chapter: "请规划本章：给出本章目标、主要冲突、关键转折、结尾钩子，并控制为可直接执行的简洁结构。",
    polish: "请润色下面的文字：保留原意和人物口吻，改善节奏、用词、动作与环境描写，不要擅自增加关键设定。",
    continuity: "请检查当前章节的剧情连续性：重点核对人物动机、时间线、地点、物品状态、伏笔和前后因果，并指出需要修正的地方。"
  };

  function isNovelMode() {
    return document.body?.dataset?.uaiMode === "novel";
  }

  function loadStudioState() {
    try {
      const value = JSON.parse(localStorage.getItem(LS_STUDIO) || "null");
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  }

  function activeWork() {
    const state = loadStudioState();
    const projects = Array.isArray(state?.projects) ? state.projects : [];
    const project = projects.find(item => item.id === state?.activeProjectId) || projects[0] || null;
    const chapters = Array.isArray(project?.chapters) ? project.chapters : [];
    const chapter = chapters.find(item => item.id === state?.activeChapterId) || null;
    return { project, chapter, hasChapter: chapters.length > 0 };
  }

  function ensureCurrentWork() {
    const shell = document.querySelector("#topbar .topbar-shell");
    if (!shell || document.getElementById("novelV1723CurrentWork")) return;
    const status = document.createElement("div");
    status.id = "novelV1723CurrentWork";
    status.className = "novel-v1723d-current-work";
    status.setAttribute("aria-live", "polite");
    status.innerHTML = `<span>当前写作</span><strong id="novelV1723ProjectName">未选择作品</strong><i>·</i><b id="novelV1723ChapterName">未选择章节</b>`;
    const model = shell.querySelector(".model-pill");
    if (model) model.before(status);
    else shell.appendChild(status);
  }

  function updateCurrentWork() {
    ensureCurrentWork();
    const { project, chapter } = activeWork();
    const projectNode = document.getElementById("novelV1723ProjectName");
    const chapterNode = document.getElementById("novelV1723ChapterName");
    if (projectNode) projectNode.textContent = project?.name?.trim() || "未选择作品";
    if (chapterNode) chapterNode.textContent = chapter?.name?.trim() || "未选择章节";
  }

  function closeTopMore() {
    const button = document.getElementById("novelV1723TopMore");
    const menu = document.getElementById("novelV1723TopMoreMenu");
    if (!button || !menu) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  function activateTopMoreTarget(target) {
    closeTopMore();
    if (target === "githubBtn") {
      const link = document.getElementById("githubBtn");
      if (link?.href) window.open(link.href, "_blank", "noopener,noreferrer");
      return;
    }
    document.getElementById(target)?.click();
  }

  function ensureTopMore() {
    const actions = document.querySelector("#topbar .topbar-actions");
    if (!actions || document.getElementById("novelV1723TopMore")) return;

    const wrap = document.createElement("div");
    wrap.className = "novel-v1723d-top-more-wrap";
    wrap.innerHTML = `
      <button id="novelV1723TopMore" class="novel-v1723d-top-more" type="button" aria-expanded="false" aria-haspopup="menu">更多</button>
      <div id="novelV1723TopMoreMenu" class="novel-v1723d-top-more-menu" role="menu" hidden>
        <button type="button" role="menuitem" data-v1723d-top-target="readerBtn"><span>阅读模式</span><small>整理 AI 回复并阅读</small></button>
        <button type="button" role="menuitem" data-v1723d-top-target="personaToggle"><span>人物 Prompt 模式</span><small>切换内置 / 自定义人物提示</small></button>
        <button type="button" role="menuitem" data-v1723d-top-target="commandBtn"><span>命令面板</span><small>快速搜索工具与作品</small></button>
        <span class="novel-v1723d-menu-divider"></span>
        <button type="button" role="menuitem" data-v1723d-top-target="githubBtn"><span>GitHub</span><small>打开项目仓库</small></button>
        <button type="button" role="menuitem" data-v1723d-top-target="donateBtn"><span>支持项目</span><small>打赏与支持</small></button>
      </div>`;
    actions.appendChild(wrap);

    const button = wrap.querySelector("#novelV1723TopMore");
    const menu = wrap.querySelector("#novelV1723TopMoreMenu");
    button.addEventListener("click", event => {
      event.stopPropagation();
      menu.hidden = !menu.hidden;
      button.setAttribute("aria-expanded", menu.hidden ? "false" : "true");
    });
    menu.addEventListener("click", event => {
      const target = event.target.closest("[data-v1723d-top-target]")?.dataset.v1723dTopTarget;
      if (target) activateTopMoreTarget(target);
    });
  }

  function closeQuickMenu() {
    const button = document.getElementById("novelV1723QuickBtn");
    const menu = document.getElementById("novelV1723QuickMenu");
    if (!button || !menu) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  function setComposerPrompt(action) {
    const textarea = document.getElementById("msg");
    const prompt = QUICK_ACTIONS[action];
    if (!textarea || !prompt) return;
    const current = textarea.value.trim();
    if (action === "polish" && current) textarea.value = `${prompt}\n\n${current}`;
    else if (current) textarea.value = `${current}\n\n写作要求：${prompt}`;
    else textarea.value = prompt;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
    const end = textarea.value.length;
    try { textarea.setSelectionRange(end, end); } catch {}
    closeQuickMenu();
  }

  function ensureQuickActions() {
    const main = document.querySelector("#composer .composer-main");
    const textarea = document.getElementById("msg");
    if (!main || !textarea || document.getElementById("novelV1723QuickBtn")) return;

    const wrap = document.createElement("div");
    wrap.className = "novel-v1723d-quick-wrap";
    wrap.innerHTML = `
      <button id="novelV1723QuickBtn" class="novel-v1723d-quick-btn" type="button" aria-expanded="false" aria-haspopup="menu" title="AI 写作快捷动作">+</button>
      <div id="novelV1723QuickMenu" class="novel-v1723d-quick-menu" role="menu" hidden>
        <div class="novel-v1723d-quick-title"><strong>AI 写作快捷动作</strong><span>选择后会填入输入框，可继续修改</span></div>
        <button type="button" role="menuitem" data-v1723d-quick="continue"><b>继续正文</b><span>沿着当前内容自然续写</span></button>
        <button type="button" role="menuitem" data-v1723d-quick="advance"><b>推进剧情</b><span>制造进展、矛盾或转折</span></button>
        <button type="button" role="menuitem" data-v1723d-quick="dialogue"><b>写对话</b><span>生成更自然的角色交流</span></button>
        <button type="button" role="menuitem" data-v1723d-quick="chapter"><b>规划本章</b><span>目标、冲突、转折与结尾</span></button>
        <button type="button" role="menuitem" data-v1723d-quick="polish"><b>润色</b><span>保留原意改善文字表达</span></button>
        <button type="button" role="menuitem" data-v1723d-quick="continuity"><b>检查剧情</b><span>核对时间线、人物与伏笔</span></button>
      </div>`;
    main.insertBefore(wrap, textarea);

    const button = wrap.querySelector("#novelV1723QuickBtn");
    const menu = wrap.querySelector("#novelV1723QuickMenu");
    button.addEventListener("click", event => {
      event.stopPropagation();
      menu.hidden = !menu.hidden;
      button.setAttribute("aria-expanded", menu.hidden ? "false" : "true");
    });
    menu.addEventListener("click", event => {
      const action = event.target.closest("[data-v1723d-quick]")?.dataset.v1723dQuick;
      if (action) setComposerPrompt(action);
    });
  }

  function markOnboarded() {
    try { localStorage.setItem(LS_ONBOARDED, REVISION); } catch {}
  }

  function dismissOnboarding() {
    markOnboarded();
    document.getElementById("novelV1723Onboarding")?.remove();
  }

  function ensureLibraryOpen() {
    if (!document.body.classList.contains("library-collapsed")) return;
    if (!window.UnlimitedNovelNavigationV1723C?.openLibrary?.()) {
      document.getElementById("libraryToggleBtn")?.click();
    }
  }

  function runOnboardingAction(action) {
    dismissOnboarding();
    if (action === "project") {
      ensureLibraryOpen();
      document.getElementById("addProject")?.click();
      setTimeout(() => document.getElementById("projectNameInput")?.focus(), 0);
      return;
    }
    if (action === "chapter") {
      ensureLibraryOpen();
      document.getElementById("addChapter")?.click();
      setTimeout(() => document.getElementById("chapterNameInput")?.focus(), 0);
      return;
    }
    document.getElementById("msg")?.focus();
  }

  function ensureOnboarding() {
    if (!isNovelMode() || document.getElementById("novelV1723Onboarding")) return;
    try { if (localStorage.getItem(LS_ONBOARDED)) return; } catch {}
    if (!document.getElementById("creativeWorkspace")) return;

    const { project, hasChapter } = activeWork();
    const root = document.createElement("div");
    root.id = "novelV1723Onboarding";
    root.className = "novel-v1723d-onboarding";
    root.innerHTML = `
      <section role="dialog" aria-modal="true" aria-labelledby="novelV1723WelcomeTitle">
        <button class="novel-v1723d-onboarding-close" type="button" aria-label="关闭新手引导">×</button>
        <div class="novel-v1723d-onboarding-kicker">开始写作</div>
        <h2 id="novelV1723WelcomeTitle">从作品和章节开始，不需要先配置一堆功能</h2>
        <p>你只需要选好作品与章节，然后直接写正文。AI、人物、世界观和检查工具都可以在需要时再打开。</p>
        <div class="novel-v1723d-onboarding-actions">
          <button type="button" data-v1723d-onboard="project"><b>创建新作品</b><span>从一个新的小说项目开始</span></button>
          <button type="button" data-v1723d-onboard="continue" class="primary"><b>${project ? "继续最近作品" : "直接开始写"}</b><span>${project ? `继续《${String(project.name || "我的小说").replace(/[<>]/g, "")}》` : "先在 AI 输入区记录你的想法"}</span></button>
          <button type="button" data-v1723d-onboard="chapter"><b>${hasChapter ? "创建新章节" : "创建第一章"}</b><span>建立章节后再开始正文</span></button>
        </div>
        <small>之后仍可从左侧“作品与章节”和右侧“创作资料”管理全部内容。</small>
      </section>`;
    document.body.appendChild(root);
    root.querySelector(".novel-v1723d-onboarding-close")?.addEventListener("click", dismissOnboarding);
    root.addEventListener("click", event => {
      if (event.target === root) dismissOnboarding();
      const action = event.target.closest("[data-v1723d-onboard]")?.dataset.v1723dOnboard;
      if (action) runOnboardingAction(action);
    });
  }

  function patch() {
    refreshQueued = false;
    if (!isNovelMode()) {
      document.body?.classList.remove("novel-v1723d-ready");
      closeTopMore();
      closeQuickMenu();
      return false;
    }
    ensureCurrentWork();
    updateCurrentWork();
    ensureTopMore();
    ensureQuickActions();
    ensureOnboarding();
    document.body.classList.add("novel-v1723d-ready");
    return true;
  }

  function schedulePatch() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(patch);
  }

  function bindObserver() {
    if (observer) observer.disconnect();
    const app = document.getElementById("app");
    if (!app) return;
    observer = new MutationObserver(schedulePatch);
    observer.observe(app, { childList: true, subtree: true });
  }

  function refresh() {
    patch();
    if (isNovelMode()) bindObserver();
    return isNovelMode();
  }

  document.addEventListener("click", event => {
    if (!event.target.closest(".novel-v1723d-top-more-wrap")) closeTopMore();
    if (!event.target.closest(".novel-v1723d-quick-wrap")) closeQuickMenu();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeTopMore();
      closeQuickMenu();
      if (document.getElementById("novelV1723Onboarding")) dismissOnboarding();
    }
  });
  document.addEventListener("change", event => {
    if (event.target?.id === "projectSelect") setTimeout(updateCurrentWork, 0);
  });
  document.addEventListener("click", event => {
    if (event.target.closest("#studioChapterList, #addChapter, #confirmChapter, #projectSelect, #addProject, #confirmProject")) {
      setTimeout(updateCurrentWork, 0);
    }
  });
  window.addEventListener("storage", event => {
    if (event.key === LS_STUDIO) schedulePatch();
  });
  window.addEventListener("uai:mode-refresh", refresh);
  window.addEventListener("uai:workspace-refresh", schedulePatch);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

  window.UnlimitedNovelFinalV1723D = {
    revision: REVISION,
    refresh,
    quickAction: setComposerPrompt,
    showOnboarding: () => {
      try { localStorage.removeItem(LS_ONBOARDED); } catch {}
      ensureOnboarding();
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
})();
