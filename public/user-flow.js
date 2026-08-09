// public/user-flow.js
// User-first flow: keep the visible path to write -> finish -> next chapter -> export.
(() => {
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LS_CONTINUITY = "cfw_continuity_v1";
  let observer = null;
  let refreshTimer = null;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function activeData() {
    const state = readJson(LS_STUDIO, {});
    const projects = Array.isArray(state?.projects) ? state.projects : [];
    const project = projects.find((item) => item.id === state?.activeProjectId) || projects[0] || null;
    const chapters = Array.isArray(project?.chapters) ? project.chapters : [];
    const chapter = chapters.find((item) => item.id === state?.activeChapterId) || null;
    return { state, project, chapters, chapter };
  }

  function setNodeText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function scheduleRefresh(delay = 30) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, delay);
  }

  function clickDraftTab() {
    const button = document.querySelector('.studio-tabs [data-studio-tab="draft"]');
    if (button && !button.classList.contains("active")) button.click();
  }

  function focusEditor() {
    setTimeout(() => {
      clickDraftTab();
      setTimeout(() => {
        const editor = document.getElementById("simpleManuscriptEditor");
        if (!editor) return;
        try { editor.focus({ preventScroll: false }); } catch { editor.focus(); }
      }, 70);
    }, 70);
  }

  function openChapter(chapterId) {
    if (!chapterId) return;
    const item = document.querySelector(`#studioChapterList [data-chapter-id="${CSS.escape(chapterId)}"]`);
    const button = item?.querySelector(".studio-item-main") || item;
    if (!button) return;
    button.click();
    focusEditor();
  }

  function defaultChapterName(position) {
    return `第 ${Math.max(1, Number(position) || 1)} 章`;
  }

  function createChapter(name) {
    const add = document.getElementById("addChapter");
    const input = document.getElementById("chapterNameInput");
    const confirm = document.getElementById("confirmChapter");
    if (!add || !input || !confirm) return false;

    const row = document.getElementById("chapterCreateRow");
    if (row?.hidden) add.click();
    input.value = name;
    confirm.click();
    focusEditor();
    return true;
  }

  function nextChapterAction() {
    const { chapters, chapter } = activeData();
    if (!chapter) return;
    const index = chapters.findIndex((item) => item.id === chapter.id);
    const next = index >= 0 ? chapters[index + 1] : null;
    if (next) {
      openChapter(next.id);
      return;
    }
    createChapter(defaultChapterName(chapters.length + 1));
  }

  function saveActiveChapterSummary(chapterId, value) {
    const { chapter } = activeData();
    if (!chapter || chapter.id !== chapterId || chapter.summary === value) return true;
    const body = document.getElementById("studioPanelBody");
    if (!body) return false;
    const control = document.createElement("textarea");
    control.hidden = true;
    control.dataset.chapterField = "summary";
    control.value = value;
    body.appendChild(control);
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.remove();
    return true;
  }

  function syncAutomaticSummary(projectId, chapterId, attempt = 0) {
    const continuity = readJson(LS_CONTINUITY, {});
    const summary = String(continuity?.projects?.[projectId]?.chapters?.[chapterId]?.summary || "").trim();
    if (summary) {
      saveActiveChapterSummary(chapterId, summary);
      scheduleRefresh(40);
      return;
    }
    if (attempt >= 60) return;
    setTimeout(() => syncAutomaticSummary(projectId, chapterId, attempt + 1), 500);
  }

  function renderEmptyAction() {
    const pane = document.querySelector("#simpleManuscriptPane.simple-manuscript-empty");
    if (!pane || pane.querySelector(".user-flow-empty-action")) return;
    const { chapters } = activeData();
    const button = document.createElement("button");
    button.className = "user-flow-empty-action";
    button.type = "button";
    button.textContent = chapters.length ? "打开第一章" : "新建第一章";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (chapters.length) openChapter(chapters[0].id);
      else createChapter("第一章");
    });
    pane.appendChild(button);
  }

  function ensureMoreOptions(panel, actions) {
    let details = panel.querySelector("#userFlowMore");
    if (!details) {
      details = document.createElement("details");
      details.id = "userFlowMore";
      details.className = "user-flow-more";
      details.innerHTML = `<summary>更多选项</summary><div class="user-flow-more-actions"></div>`;
      actions.after(details);
    }
    return details.querySelector(".user-flow-more-actions");
  }

  function simplifyWorkflow() {
    const panel = document.getElementById("workflowPanel");
    if (!panel) return;
    const actions = panel.querySelector(".workflow-actions");
    if (!actions) return;

    const { project, chapters, chapter } = activeData();
    if (!project || !chapter) return;

    const complete = panel.querySelector("#workflowCompleteChapter");
    const summary = panel.querySelector("#workflowGenerateSummary");
    const exportTxt = panel.querySelector("#workflowExportTxt");
    const exportMd = panel.querySelector("#workflowExportMd");
    const more = ensureMoreOptions(panel, actions);

    setNodeText(exportTxt, "导出整本");
    if (exportMd) {
      setNodeText(exportMd, "导出 Markdown");
      if (exportMd.parentElement !== more) more.appendChild(exportMd);
    }
    if (summary) {
      setNodeText(summary, "手动更新章节摘要");
      if (summary.parentElement !== more) more.appendChild(summary);
    }

    let next = panel.querySelector("#userFlowNextChapter");
    if (chapter.done) {
      const index = chapters.findIndex((item) => item.id === chapter.id);
      const hasNext = index >= 0 && Boolean(chapters[index + 1]);
      if (!next) {
        next = document.createElement("button");
        next.id = "userFlowNextChapter";
        next.className = "primary user-flow-next";
        next.type = "button";
        actions.prepend(next);
      }
      setNodeText(next, hasNext ? "进入下一章" : "新建下一章");
      if (complete) {
        setNodeText(complete, "重新编辑本章");
        if (complete.parentElement !== more) more.prepend(complete);
      }
    } else {
      next?.remove();
      if (complete) {
        setNodeText(complete, "完成本章");
        if (complete.parentElement !== actions) actions.prepend(complete);
      }
    }

    if (exportTxt && exportTxt.parentElement !== actions) actions.appendChild(exportTxt);

    let note = panel.querySelector("#userFlowAutoNote");
    if (!note) {
      note = document.createElement("p");
      note.id = "userFlowAutoNote";
      note.className = "user-flow-auto-note";
      actions.after(note);
    }
    setNodeText(
      note,
      chapter.done
        ? "本章已完成。章节摘要、人物状态和未解决伏笔会在后台自动整理。"
        : "写完后只需点击“完成本章”，摘要、人物状态和伏笔会自动整理，无需额外操作。"
    );

    const backupSummary = panel.querySelector(".workflow-backups > summary");
    if (backupSummary) {
      setNodeText(backupSummary.querySelector("span"), "备份与恢复");
      setNodeText(backupSummary.querySelector("small"), "自动");
    }

    const labels = [
      ["workflowTotalWords", "全书"],
      ["workflowCurrentWords", "本章"],
      ["workflowCompleted", "已完成"],
      ["workflowTarget", "目标"]
    ];
    labels.forEach(([id, label]) => {
      const value = panel.querySelector(`#${id}`);
      const caption = value?.parentElement?.querySelector("span");
      setNodeText(caption, label);
    });
  }

  function refresh() {
    renderEmptyAction();
    simplifyWorkflow();
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      if (event.target.closest("#userFlowNextChapter")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        nextChapterAction();
        return;
      }

      const complete = event.target.closest("#workflowCompleteChapter");
      if (complete) {
        const { project, chapter } = activeData();
        if (project && chapter && chapter.done) {
          setTimeout(() => syncAutomaticSummary(project.id, chapter.id), 450);
        }
      }
    }, true);
  }

  function init() {
    bindEvents();
    const body = document.getElementById("studioPanelBody");
    if (body) {
      observer = new MutationObserver(() => scheduleRefresh());
      observer.observe(body, { childList: true, subtree: true });
    }
    document.getElementById("studioLibrary")?.addEventListener("click", () => scheduleRefresh(90));
    document.querySelector(".studio-tabs")?.addEventListener("click", () => scheduleRefresh(40));
    refresh();
  }

  window.UnlimitedUserFlow = {
    nextChapter: nextChapterAction,
    refresh: scheduleRefresh
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
