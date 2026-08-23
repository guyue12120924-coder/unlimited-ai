// V17.23C novel-only navigation rescue and hierarchy polish.
(() => {
  const REVISION = "2026-08-23-v17.23c-novel-navigation";
  if (window.UnlimitedNovelNavigationV1723C?.revision === REVISION) return;

  let observer = null;
  let refreshQueued = false;

  function isNovelMode() {
    return document.body?.dataset?.uaiMode === "novel";
  }

  function clickCore(id, fallbackClass) {
    const button = document.getElementById(id);
    if (button) {
      button.click();
      return true;
    }
    if (fallbackClass) document.body.classList.remove(fallbackClass);
    return false;
  }

  function ensureRestoreButtons() {
    if (!document.body) return;
    if (!document.getElementById("novelV1723OpenLibrary")) {
      const button = document.createElement("button");
      button.id = "novelV1723OpenLibrary";
      button.className = "novel-v1723-edge-restore left";
      button.type = "button";
      button.innerHTML = `<span aria-hidden="true">›</span><b>作品与章节</b>`;
      button.title = "重新打开作品与章节";
      button.addEventListener("click", () => clickCore("libraryToggleBtn", "library-collapsed"));
      document.body.appendChild(button);
    }
    if (!document.getElementById("novelV1723OpenStudio")) {
      const button = document.createElement("button");
      button.id = "novelV1723OpenStudio";
      button.className = "novel-v1723-edge-restore right";
      button.type = "button";
      button.innerHTML = `<b>创作资料</b><span aria-hidden="true">‹</span>`;
      button.title = "重新打开创作资料";
      button.addEventListener("click", () => clickCore("studioToggleBtn", "studio-collapsed"));
      document.body.appendChild(button);
    }
  }

  function decorateTopbarRestorers() {
    const library = document.getElementById("libraryToggleBtn");
    const studio = document.getElementById("studioToggleBtn");
    if (library) {
      if (library.textContent !== "作品与章节") library.textContent = "作品与章节";
      library.title = "显示或隐藏作品与章节";
    }
    if (studio) {
      if (studio.textContent !== "创作资料") studio.textContent = "创作资料";
      studio.title = "显示或隐藏创作资料";
    }
  }

  function ensureMoreTools() {
    const head = document.querySelector("#studioPanel > .studio-panel-head");
    if (!head) return;
    let actions = head.querySelector(".novel-v1723-studio-head-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "novel-v1723-studio-head-actions";
      const collapse = head.querySelector("#collapseStudio");
      if (collapse) collapse.before(actions);
      else head.appendChild(actions);
    }
    if (!actions.querySelector("#novelV1723MoreTools")) {
      const button = document.createElement("button");
      button.id = "novelV1723MoreTools";
      button.className = "novel-v1723-more-tools-btn";
      button.type = "button";
      button.textContent = "更多工具";
      button.setAttribute("aria-expanded", "false");
      actions.appendChild(button);

      const menu = document.createElement("div");
      menu.id = "novelV1723MoreToolsMenu";
      menu.className = "novel-v1723-more-tools-menu";
      menu.hidden = true;
      menu.innerHTML = `
        <button type="button" data-v1723-tool-tab="scenes">场景管理</button>
        <button type="button" data-v1723-tool-tab="notes">便签</button>
        <button type="button" data-v1723-tool-tab="stats">写作统计</button>
        <span class="novel-v1723-more-divider"></span>
        <button type="button" data-v1723-tool-id="storyMemoryBtn">Story Memory</button>
        <button type="button" data-v1723-tool-id="continuityBtn">连续性检查</button>`;
      actions.appendChild(menu);

      button.addEventListener("click", (event) => {
        event.stopPropagation();
        menu.hidden = !menu.hidden;
        button.setAttribute("aria-expanded", menu.hidden ? "false" : "true");
      });
      menu.addEventListener("click", (event) => {
        const tab = event.target.closest("[data-v1723-tool-tab]")?.dataset.v1723ToolTab;
        const id = event.target.closest("[data-v1723-tool-id]")?.dataset.v1723ToolId;
        if (tab) {
          const target = document.querySelector(`.studio-tabs [data-studio-tab="${CSS.escape(tab)}"]`);
          target?.click();
        } else if (id) {
          document.getElementById(id)?.click();
        }
        menu.hidden = true;
        button.setAttribute("aria-expanded", "false");
      });
      document.addEventListener("click", (event) => {
        if (!event.target.closest(".novel-v1723-studio-head-actions")) {
          menu.hidden = true;
          button.setAttribute("aria-expanded", "false");
        }
      });
    }
  }

  function normalizePrimaryTabs() {
    const labels = {
      draft: "正文",
      outline: "大纲",
      characters: "人物",
      world: "世界观"
    };
    document.querySelectorAll(".studio-tabs [data-studio-tab]").forEach((button) => {
      const tab = button.dataset.studioTab;
      if (labels[tab] && button.textContent !== labels[tab]) button.textContent = labels[tab];
    });
  }

  function decorateStudioSessions() {
    const list = document.getElementById("studioSessionList");
    if (!list) return;
    list.querySelectorAll(".studio-list-item[data-session-id]").forEach((item) => {
      if (item.querySelector(".novel-v1723-session-delete")) return;
      const favorite = item.querySelector(".favorite-session");
      if (!favorite) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "novel-v1723-session-delete";
      button.textContent = "删除";
      button.title = "删除这个会话";
      button.setAttribute("aria-label", "删除这个会话");
      favorite.insertAdjacentElement("afterend", button);
    });
  }

  function findCoreDeleteButton(sessionId) {
    return document.querySelector(`#sessionList .delete-session[data-id="${CSS.escape(String(sessionId))}"]`);
  }

  function requestDelete(sessionId) {
    let core = findCoreDeleteButton(sessionId);
    if (!core) {
      const sessionBtn = document.getElementById("sessionBtn");
      const close = document.getElementById("closeSessionPanel");
      sessionBtn?.click();
      core = findCoreDeleteButton(sessionId);
      close?.click();
    }
    if (core) {
      core.click();
      return true;
    }
    return false;
  }

  function captureDelete(event) {
    if (!isNovelMode()) return;
    const button = event.target?.closest?.("#studioSessionList .novel-v1723-session-delete");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const item = button.closest("[data-session-id]");
    if (item?.dataset.sessionId) requestDelete(item.dataset.sessionId);
  }

  function patch() {
    refreshQueued = false;
    if (!isNovelMode()) return false;
    ensureRestoreButtons();
    decorateTopbarRestorers();
    ensureMoreTools();
    normalizePrimaryTabs();
    decorateStudioSessions();
    // Headings are rendered by V17.23C CSS pseudo-content to avoid fighting the
    // older v3-sidebar MutationObserver over the same text nodes.
    document.body.classList.add("novel-v1723c-ready");
    return true;
  }

  function schedulePatch() {
    if (refreshQueued) return;
    refreshQueued = true;
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
    if (!isNovelMode()) {
      document.body?.classList.remove("novel-v1723c-ready");
      return false;
    }
    patch();
    bindObserver();
    return true;
  }

  document.addEventListener("click", captureDelete, true);
  window.addEventListener("uai:mode-refresh", refresh);
  window.addEventListener("uai:workspace-refresh", refresh);
  window.addEventListener("resize", schedulePatch);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

  window.UnlimitedNovelNavigationV1723C = {
    revision: REVISION,
    refresh,
    openLibrary: () => clickCore("libraryToggleBtn", "library-collapsed"),
    openStudio: () => clickCore("studioToggleBtn", "studio-collapsed"),
    deleteSession: requestDelete
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
})();
