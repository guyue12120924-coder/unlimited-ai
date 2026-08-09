// public/v2-product-phase2.js
// V2.6-V2.10: simpler world settings, chapter management, quiet automation,
// friendly errors, and a mobile-first navigation layer.
(() => {
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LS_CONTINUITY = "cfw_continuity_v1";
  const LS_INTELLIGENCE = "cfw_story_intelligence_v1";
  const LS_WORKFLOW_META = "cfw_workflow_meta_v1";
  const LS_EDITOR_VIEW = "cfw_editor_view_v1";
  const MOBILE_MAX = 720;
  let panelObserver = null;
  let chapterObserver = null;
  let refreshTimer = null;
  let automationTimer = null;
  let lastInfoTab = "outline";
  let lastNetworkNoticeAt = 0;

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

  function activeData() {
    const state = readJson(LS_STUDIO, {});
    const projects = Array.isArray(state?.projects) ? state.projects : [];
    const project = projects.find((item) => item.id === state.activeProjectId) || projects[0] || null;
    const chapters = Array.isArray(project?.chapters) ? project.chapters : [];
    const chapter = chapters.find((item) => item.id === state.activeChapterId) || null;
    return { state, projects, project, chapters, chapter };
  }

  function activeTab() {
    return document.querySelector(".studio-tabs [data-studio-tab].active")?.dataset.studioTab || "draft";
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function scheduleRefresh(delay = 30) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, delay);
  }

  function fillComposer(text) {
    const input = document.getElementById("msg");
    if (!input) return;
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    try { input.focus({ preventScroll: false }); } catch { input.focus(); }
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function isMobile() {
    return window.innerWidth <= MOBILE_MAX;
  }

  function enhanceWorld() {
    if (activeTab() !== "world") return;
    const body = document.getElementById("studioPanelBody");
    const wrapper = body?.querySelector(".simple-world-fields");
    if (!body || !wrapper || wrapper.dataset.v26Ready === "1") return;
    wrapper.dataset.v26Ready = "1";
    wrapper.classList.add("v26-world-card");

    const title = wrapper.querySelector(".simple-section-title");
    if (title) {
      setText(title.querySelector("strong"), "故事设定");
      setText(title.querySelector("span"), "只记录以后不能被 AI 写错的内容");
      if (!title.querySelector("#v26WorldAssist")) {
        const assist = document.createElement("button");
        assist.id = "v26WorldAssist";
        assist.type = "button";
        assist.textContent = "让 AI 帮我整理";
        assist.addEventListener("click", (event) => {
          event.stopPropagation();
          fillComposer("请结合当前小说已有的大纲、人物和设定，帮我整理真正需要长期保持一致的世界设定。只保留世界背景、硬性规则、关键地点、重要组织和关键物品，避免堆砌无关细节。用简洁清楚的中文列出，方便我确认后填写到设定页。");
        });
        title.appendChild(assist);
      }
    }

    const fields = Object.fromEntries(
      Array.from(wrapper.querySelectorAll("[data-world-field]")).map((field) => [field.dataset.worldField, field])
    );
    const relabel = (key, label, placeholder) => {
      const field = fields[key];
      if (!field) return;
      setText(field.closest("label")?.querySelector("span"), label);
      if (placeholder) field.placeholder = placeholder;
    };
    relabel("worldOverview", "世界背景", "故事发生在怎样的世界？写清时代、环境和最核心的背景即可");
    relabel("worldRules", "世界规则", "只写不能被违背的规则，例如能力限制、社会规则或关键常识");
    relabel("locations", "关键地点", "只记录会反复出现或影响剧情的重要地点");
    relabel("factions", "势力与组织", "记录真正参与主线的组织、阵营或势力");
    relabel("importantItems", "重要物品", "记录会影响剧情、需要前后保持一致的物品");

    const detailLabels = ["locations", "factions", "importantItems"]
      .map((key) => fields[key]?.closest("label"))
      .filter(Boolean);
    if (detailLabels.length && !wrapper.querySelector("#v26WorldDetails")) {
      const details = document.createElement("details");
      details.id = "v26WorldDetails";
      details.className = "v26-world-details";
      details.innerHTML = `<summary><span>地点、组织与重要物品</span><small>需要时再补</small></summary><div class="v26-world-detail-grid"></div>`;
      wrapper.appendChild(details);
      const grid = details.querySelector(".v26-world-detail-grid");
      detailLabels.forEach((label) => grid.appendChild(label));
    }

    const timeline = body.querySelector('[data-project-field="timeline"]')?.closest("label");
    const foreshadow = body.querySelector('[data-project-field="foreshadow"]')?.closest("label");
    const notes = body.querySelector('[data-project-field="notes"]')?.closest("label");
    if (timeline) {
      setText(timeline.querySelector("span"), "时间线");
      timeline.querySelector("textarea")?.setAttribute("placeholder", "只有事件顺序容易写错时再记录");
    }
    if (foreshadow) {
      setText(foreshadow.querySelector("span"), "手动备注的伏笔");
      foreshadow.querySelector("textarea")?.setAttribute("placeholder", "只记录你明确想手动提醒自己的伏笔；系统也会自动维护连续性");
    }
    if (notes) setText(notes.querySelector("span"), "其他备注");

    const secondary = [timeline, foreshadow, notes].filter(Boolean);
    if (secondary.length && !body.querySelector("#v26StoryDetails")) {
      const details = document.createElement("details");
      details.id = "v26StoryDetails";
      details.className = "v26-world-details v26-story-details";
      details.innerHTML = `<summary><span>更多设定资料</span><small>可选</small></summary><div class="v26-world-detail-grid"></div>`;
      wrapper.after(details);
      const grid = details.querySelector(".v26-world-detail-grid");
      secondary.forEach((label) => grid.appendChild(label));
    }
  }

  function chineseNumber(number) {
    const n = Math.max(1, Math.min(999, Number(number) || 1));
    const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
    if (n < 10) return digits[n];
    if (n < 20) return `十${n % 10 ? digits[n % 10] : ""}`;
    if (n < 100) return `${digits[Math.floor(n / 10)]}十${n % 10 ? digits[n % 10] : ""}`;
    const rest = n % 100;
    return `${digits[Math.floor(n / 100)]}百${rest ? (rest < 10 ? `零${digits[rest]}` : chineseNumber(rest)) : ""}`;
  }

  function closeChapterMenus(except = null) {
    document.querySelectorAll(".v27-chapter-menu.open").forEach((menu) => {
      if (menu !== except) menu.classList.remove("open");
    });
  }

  function createNextChapterFromLibrary() {
    if (window.UnlimitedUserFlow?.nextChapter) {
      const { chapter } = activeData();
      if (chapter) {
        window.UnlimitedUserFlow.nextChapter();
        return;
      }
    }
    const { chapters } = activeData();
    const add = document.getElementById("addChapter");
    const row = document.getElementById("chapterCreateRow");
    const input = document.getElementById("chapterNameInput");
    const confirm = document.getElementById("confirmChapter");
    if (!add || !input || !confirm) return;
    if (row?.hidden) add.click();
    input.value = `第${chineseNumber(chapters.length + 1)}章`;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    confirm.click();
    setTimeout(() => document.querySelector('.studio-tabs [data-studio-tab="draft"]')?.click(), 90);
  }

  function renameChapterFromMenu(item) {
    const main = item.querySelector(".studio-item-main");
    if (!main) return;
    main.click();
    setTimeout(() => {
      document.querySelector('.studio-tabs [data-studio-tab="draft"]')?.click();
      setTimeout(() => document.querySelector("#simpleManuscriptPane .simple-manuscript-head h3")?.click(), 90);
    }, 70);
  }

  function cleanupChapterMetadata(projectId, chapterId) {
    const workflow = readJson(LS_WORKFLOW_META, {});
    if (workflow?.[projectId]?.[chapterId]) {
      delete workflow[projectId][chapterId];
      if (!Object.keys(workflow[projectId]).length) delete workflow[projectId];
      writeJson(LS_WORKFLOW_META, workflow);
    }
    const continuity = readJson(LS_CONTINUITY, {});
    if (continuity?.projects?.[projectId]?.chapters?.[chapterId]) {
      delete continuity.projects[projectId].chapters[chapterId];
      writeJson(LS_CONTINUITY, continuity);
    }
    const intelligence = readJson(LS_INTELLIGENCE, {});
    if (intelligence?.[projectId]?.[chapterId]) {
      delete intelligence[projectId][chapterId];
      if (!Object.keys(intelligence[projectId]).length) delete intelligence[projectId];
      writeJson(LS_INTELLIGENCE, intelligence);
    }
    const views = readJson(LS_EDITOR_VIEW, {});
    delete views[`${projectId}:${chapterId}`];
    writeJson(LS_EDITOR_VIEW, views);
  }

  function deleteChapter(chapterId) {
    const { state, project, chapters } = activeData();
    if (!project || !chapterId) return;
    const index = chapters.findIndex((item) => item.id === chapterId);
    if (index < 0) return;
    window.UnlimitedWorkflow?.createBackup?.("删除章节前", true);
    project.chapters.splice(index, 1);
    if (Array.isArray(project.manuscriptClips)) project.manuscriptClips = project.manuscriptClips.filter((clip) => clip.chapterId !== chapterId);
    const fallback = project.chapters[index] || project.chapters[index - 1] || null;
    state.activeChapterId = fallback?.id || null;
    if (!writeJson(LS_STUDIO, state)) {
      showNotice("删除失败，当前内容没有被改动。", "error");
      return;
    }
    cleanupChapterMetadata(project.id, chapterId);
    showNotice("章节已删除，正在刷新作品。", "success");
    setTimeout(() => location.reload(), 280);
  }

  function enhanceChapterManager() {
    const section = document.querySelector("#studioLibrary .chapter-section");
    const list = document.getElementById("studioChapterList");
    if (!section || !list) return;
    if (!section.querySelector("#v27NextChapter")) {
      const next = document.createElement("button");
      next.id = "v27NextChapter";
      next.type = "button";
      next.className = "v27-next-chapter";
      next.textContent = "+ 新建下一章";
      next.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        createNextChapterFromLibrary();
      });
      list.after(next);
    }

    list.querySelectorAll(".chapter-item[data-chapter-id]").forEach((item) => {
      if (item.querySelector(".v27-chapter-more")) return;
      const more = document.createElement("button");
      more.type = "button";
      more.className = "v27-chapter-more";
      more.setAttribute("aria-label", "章节操作");
      more.title = "章节操作";
      more.textContent = "···";
      const menu = document.createElement("div");
      menu.className = "v27-chapter-menu";
      menu.innerHTML = `<button type="button" data-v27-action="rename">重命名</button><button type="button" data-v27-action="toggle">切换完成状态</button><button type="button" class="danger" data-v27-action="delete">删除章节</button>`;
      item.append(more, menu);
      more.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const open = !menu.classList.contains("open");
        closeChapterMenus(menu);
        menu.classList.toggle("open", open);
      });
      menu.addEventListener("click", (event) => {
        const button = event.target.closest("[data-v27-action]");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const action = button.dataset.v27Action;
        if (action === "rename") {
          closeChapterMenus();
          renameChapterFromMenu(item);
        } else if (action === "toggle") {
          closeChapterMenus();
          item.querySelector(".chapter-status")?.click();
        } else if (action === "delete") {
          if (button.dataset.confirmDelete !== "1") {
            button.dataset.confirmDelete = "1";
            button.textContent = "再次点击确认删除";
            clearTimeout(button.confirmTimer);
            button.confirmTimer = setTimeout(() => {
              if (!document.contains(button)) return;
              button.dataset.confirmDelete = "0";
              button.textContent = "删除章节";
            }, 4000);
            return;
          }
          deleteChapter(item.dataset.chapterId);
        }
      });
    });
  }

  function chapterIntelligenceReady(projectId, chapterId) {
    return Boolean(readJson(LS_INTELLIGENCE, {})?.[projectId]?.[chapterId]?.analyzedAt);
  }

  function enhanceAutomation() {
    const panel = document.getElementById("workflowPanel");
    const { project, chapter } = activeData();
    if (!panel || !project || !chapter) return;
    const note = panel.querySelector("#userFlowAutoNote");
    if (note) {
      if (!chapter.done) setText(note, "写完后点击“完成本章”即可，其余整理和保存会自动完成。");
      else if (chapterIntelligenceReady(project.id, chapter.id)) setText(note, "本章已整理，可以继续下一章。");
      else setText(note, "本章已完成，系统正在后台整理。你可以直接继续写下一章。");
    }
    const backups = panel.querySelector(".workflow-backups");
    const more = panel.querySelector("#userFlowMore");
    if (backups && more && backups.parentElement !== more) {
      const summary = backups.querySelector(":scope > summary");
      if (summary) {
        setText(summary.querySelector("span"), "版本恢复");
        setText(summary.querySelector("small"), "自动保存的历史版本");
      }
      more.appendChild(backups);
    }
    const summaryButton = panel.querySelector("#workflowGenerateSummary");
    if (summaryButton) summaryButton.classList.add("v28-manual-summary");
  }

  function ensureNoticeRoot() {
    let root = document.getElementById("v29NoticeRoot");
    if (root) return root;
    root = document.createElement("div");
    root.id = "v29NoticeRoot";
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-atomic", "true");
    document.body.appendChild(root);
    return root;
  }

  function friendlyMessage(message) {
    const raw = String(message || "").trim();
    if (!raw) return "操作没有完成，请稍后重试。";
    if (/本地存储空间不足|storage|quota/i.test(raw)) return "本地保存空间不足。建议先导出作品备份，再清理浏览器存储。";
    if (/没有检测到可用模型|没有可用模型/i.test(raw)) return "当前没有可用模型，请在顶部切换模型后重试。";
    if (/HTTP\s*\d+|Failed to fetch|NetworkError|网络/i.test(raw)) return "服务暂时没有响应，请检查网络后再试。";
    if (/模型没有返回摘要|没有返回摘要/i.test(raw)) return "这次没有生成出有效内容，稍后可以重新整理。";
    if (/生成摘要失败/i.test(raw)) return "章节整理没有完成，但正文已经保存。稍后可以再次尝试。";
    if (/摘要保存失败/i.test(raw)) return "章节信息暂时没有保存成功，请稍后重试。";
    if (/没有找到章节状态按钮/i.test(raw)) return "当前章节状态没有更新成功，请刷新页面后重试。";
    return raw.replace(/错误[:：]?\s*/g, "").replace(/失败[:：]?\s*/g, "未完成：");
  }

  function showNotice(message, type = "info") {
    const root = ensureNoticeRoot();
    const notice = document.createElement("div");
    notice.className = `v29-notice ${type}`;
    notice.innerHTML = `<span></span><button type="button" aria-label="关闭提示">×</button>`;
    setText(notice.querySelector("span"), friendlyMessage(message));
    notice.querySelector("button").addEventListener("click", () => notice.remove());
    root.appendChild(notice);
    requestAnimationFrame(() => notice.classList.add("show"));
    setTimeout(() => {
      notice.classList.remove("show");
      setTimeout(() => notice.remove(), 180);
    }, type === "error" ? 5200 : 3000);
  }

  function installFriendlyErrors() {
    if (window.__v29FriendlyErrorsInstalled) return;
    window.__v29FriendlyErrorsInstalled = true;
    window.alert = (message) => showNotice(message, /失败|错误|无法|不足|没有找到|HTTP/i.test(String(message || "")) ? "error" : "info");
    window.addEventListener("unhandledrejection", (event) => {
      const message = String(event.reason?.message || event.reason || "");
      if (!/Failed to fetch|NetworkError|network request/i.test(message)) return;
      const now = Date.now();
      if (now - lastNetworkNoticeAt < 5000) return;
      lastNetworkNoticeAt = now;
      showNotice("网络连接中断，这次操作可能没有完成。请检查网络后重试。", "error");
    });
  }

  function ensureMobileNav() {
    if (document.getElementById("v210MobileNav")) return;
    const nav = document.createElement("nav");
    nav.id = "v210MobileNav";
    nav.setAttribute("aria-label", "移动端创作导航");
    nav.innerHTML = `<button type="button" data-v210-view="chat">对话</button><button type="button" data-v210-view="draft">正文</button><button type="button" data-v210-view="info">资料</button><button type="button" data-v210-view="chapters">章节</button>`;
    nav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-v210-view]");
      if (button) setMobileView(button.dataset.v210View);
    });
    document.body.appendChild(nav);
  }

  function updateMobileNav(view) {
    document.querySelectorAll("#v210MobileNav [data-v210-view]").forEach((button) => button.classList.toggle("active", button.dataset.v210View === view));
  }

  function setMobileView(view) {
    if (!isMobile()) return;
    document.body.classList.remove("v210-view-chat", "v210-view-draft", "v210-view-info", "v210-view-chapters");
    document.body.classList.add(`v210-view-${view}`);
    if (view === "chat") {
      document.body.classList.add("library-collapsed", "studio-collapsed");
    } else if (view === "chapters") {
      document.body.classList.remove("library-collapsed");
      document.body.classList.add("studio-collapsed");
    } else {
      document.body.classList.add("library-collapsed");
      document.body.classList.remove("studio-collapsed");
      const tab = view === "draft" ? "draft" : lastInfoTab;
      document.querySelector(`.studio-tabs [data-studio-tab="${tab}"]`)?.click();
    }
    updateMobileNav(view);
  }

  function syncMobileState() {
    ensureMobileNav();
    if (!isMobile()) {
      document.body.classList.remove("v210-view-chat", "v210-view-draft", "v210-view-info", "v210-view-chapters");
      return;
    }
    const current = document.body.classList.contains("v210-view-draft") ? "draft"
      : document.body.classList.contains("v210-view-info") ? "info"
      : document.body.classList.contains("v210-view-chapters") ? "chapters"
      : "chat";
    if (!document.body.classList.contains(`v210-view-${current}`)) setMobileView("chat");
    else updateMobileNav(current);
  }

  function bindMobileBehavior() {
    document.querySelector(".studio-tabs")?.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-studio-tab]")?.dataset.studioTab;
      if (!tab) return;
      if (tab !== "draft") lastInfoTab = tab;
      if (!isMobile()) return;
      updateMobileNav(tab === "draft" ? "draft" : "info");
      document.body.classList.toggle("v210-view-draft", tab === "draft");
      document.body.classList.toggle("v210-view-info", tab !== "draft");
      document.body.classList.remove("v210-view-chat", "v210-view-chapters");
    });
    document.getElementById("studioLibrary")?.addEventListener("click", (event) => {
      if (!isMobile()) return;
      const item = event.target.closest(".chapter-item[data-chapter-id]");
      if (!item || event.target.closest(".chapter-status,.v27-chapter-more,.v27-chapter-menu")) return;
      setTimeout(() => setMobileView("draft"), 90);
    });
    window.addEventListener("resize", () => {
      clearTimeout(window.__v210ResizeTimer);
      window.__v210ResizeTimer = setTimeout(syncMobileState, 120);
    });
  }

  function refresh() {
    enhanceWorld();
    enhanceChapterManager();
    enhanceAutomation();
    syncMobileState();
  }

  function init() {
    installFriendlyErrors();
    ensureNoticeRoot();
    ensureMobileNav();
    bindMobileBehavior();
    const body = document.getElementById("studioPanelBody");
    if (body) {
      panelObserver = new MutationObserver(() => scheduleRefresh(25));
      panelObserver.observe(body, { childList: true, subtree: true });
    }
    const chapterList = document.getElementById("studioChapterList");
    if (chapterList) {
      chapterObserver = new MutationObserver(() => scheduleRefresh(35));
      chapterObserver.observe(chapterList, { childList: true });
    }
    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest(".v27-chapter-more,.v27-chapter-menu")) closeChapterMenus();
    }, true);
    document.querySelector(".studio-tabs")?.addEventListener("click", () => scheduleRefresh(40));
    document.getElementById("studioLibrary")?.addEventListener("click", () => scheduleRefresh(80));
    automationTimer = setInterval(enhanceAutomation, 1800);
    refresh();
  }

  window.UnlimitedV2Phase2 = { refresh: scheduleRefresh, mobileView: setMobileView, notify: showNotice };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
