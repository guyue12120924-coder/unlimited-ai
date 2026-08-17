// public/novel-workspace-v152.js
// V15.2: make chapter/session relationships and AI -> manuscript destination obvious.
(() => {
  const REVISION = "2026-08-17-v15.2-manuscript-flow";
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LS_SESSIONS = "cfw_sessions_v2";
  if (window.UnlimitedNovelWorkspaceV152) return;

  let libraryObserver = null;
  let chatObserver = null;
  let modeObserver = null;
  let refreshTimer = 0;

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
    const project = projects.find((item) => item.id === state.activeProjectId) || projects[0] || null;
    const chapters = Array.isArray(project?.chapters) ? project.chapters : [];
    const chapter = chapters.find((item) => item.id === state.activeChapterId) || null;
    return { state, project, chapters, chapter };
  }

  function sessions() {
    const value = readJson(LS_SESSIONS, []);
    return Array.isArray(value) ? value : [];
  }

  function isNovelMode() {
    return document.body.dataset.uaiMode === "novel";
  }

  function currentSessionId() {
    return document.querySelector("#studioSessionList [data-session-id].active")?.dataset.sessionId
      || document.querySelector("#sessionList .session-item.active .session-title")?.dataset.id
      || sessions()[0]?.id
      || "";
  }

  function sessionById(id) {
    return sessions().find((item) => item.id === id) || null;
  }

  function sessionName(id) {
    return sessionById(id)?.name || "未命名对话";
  }

  function setText(node, value) {
    if (!node) return;
    const next = String(value ?? "");
    if (node.textContent !== next) node.textContent = next;
  }

  function countChars(value) {
    return String(value || "").replace(/\s/g, "").length;
  }

  function switchTab(tab) {
    document.querySelector(`.studio-tabs [data-studio-tab="${tab}"]`)?.click();
  }

  function focusManuscript() {
    switchTab("draft");
    window.setTimeout(() => {
      const editor = document.getElementById("simpleManuscriptEditor");
      if (!editor) return;
      try { editor.focus({ preventScroll: false }); } catch { editor.focus(); }
    }, 70);
  }

  function chooseFirstChapter() {
    const item = document.querySelector("#studioChapterList .chapter-item[data-chapter-id]");
    if (item) {
      item.querySelector(".studio-item-main")?.click();
      window.setTimeout(focusManuscript, 60);
      return true;
    }
    const add = document.getElementById("addChapter");
    const row = document.getElementById("chapterCreateRow");
    if (row?.hidden !== false) add?.click();
    window.setTimeout(() => document.getElementById("chapterNameInput")?.focus(), 30);
    return false;
  }

  function bindActiveChapterToSession(sessionId) {
    const { chapter } = activeData();
    const body = document.getElementById("studioPanelBody");
    if (!chapter || !body || !sessionId) return false;
    if (chapter.sessionId === sessionId) return true;

    // Reuse studio.js's existing change handler so its in-memory state and localStorage
    // remain the single source of truth. Do not write the workspace object directly here.
    const control = document.createElement("select");
    control.hidden = true;
    control.dataset.chapterField = "sessionId";
    const option = document.createElement("option");
    option.value = sessionId;
    option.textContent = sessionName(sessionId);
    control.appendChild(option);
    control.value = sessionId;
    body.appendChild(control);
    control.dispatchEvent(new Event("change", { bubbles: true }));
    control.remove();
    scheduleRefresh(60);
    return true;
  }

  function switchToSession(sessionId) {
    if (!sessionId) return false;
    const item = Array.from(document.querySelectorAll("#studioSessionList [data-session-id]"))
      .find((node) => node.dataset.sessionId === sessionId);
    const button = item?.querySelector(".studio-item-main") || item;
    if (!button) return false;
    button.click();
    scheduleRefresh(90);
    return true;
  }

  function ensureWritingNow() {
    const library = document.getElementById("studioLibrary");
    const chapterSection = library?.querySelector(".chapter-section");
    if (!library || !chapterSection) return null;

    let panel = document.getElementById("novelV152WritingNow");
    if (panel?.parentElement === library) return panel;
    panel?.remove();

    panel = document.createElement("section");
    panel.id = "novelV152WritingNow";
    panel.className = "novel-v152-writing-now";
    panel.innerHTML = `
      <div class="novel-v152-writing-copy">
        <span>CURRENT WRITING</span>
        <strong id="novelV152Chapter">当前章节</strong>
        <p id="novelV152Session">当前 AI 对话</p>
      </div>
      <div class="novel-v152-writing-state">
        <span id="novelV152LinkState" data-tone="neutral">未关联</span>
        <div id="novelV152WritingActions"></div>
      </div>`;
    chapterSection.before(panel);
    return panel;
  }

  function writingActions(data, sessionId) {
    if (!data.chapter) {
      return [["choose", data.chapters.length ? "选择章节" : "创建第一章", "primary"]];
    }
    if (!sessionId) {
      return [["draft", "打开正文", "primary"]];
    }
    if (!data.chapter.sessionId) {
      return [["bind", "关联当前对话", "primary"], ["draft", "正文", ""]];
    }
    if (data.chapter.sessionId === sessionId) {
      return [["draft", "打开正文", "primary"]];
    }
    return [["switch-linked", "切到关联对话", "primary"], ["rebind", "改为当前对话", ""]];
  }

  function renderWritingNow() {
    if (!isNovelMode()) return;
    const panel = ensureWritingNow();
    if (!panel) return;
    const data = activeData();
    const sessionId = currentSessionId();
    const currentName = sessionId ? sessionName(sessionId) : "暂无对话";
    const linkedName = data.chapter?.sessionId ? sessionName(data.chapter.sessionId) : "";

    setText(document.getElementById("novelV152Chapter"), data.chapter?.name || "尚未选择章节");
    const sessionText = !data.chapter
      ? `当前对话：${currentName}`
      : data.chapter.sessionId
        ? `本章对话：${linkedName}`
        : `当前对话：${currentName}`;
    setText(document.getElementById("novelV152Session"), sessionText);

    const state = document.getElementById("novelV152LinkState");
    let stateText = "先选章节";
    let tone = "neutral";
    if (data.chapter) {
      if (!data.chapter.sessionId) stateText = "尚未关联";
      else if (data.chapter.sessionId === sessionId) {
        stateText = "已关联当前对话";
        tone = "good";
      } else {
        stateText = "当前对话不同";
        tone = "warn";
      }
    }
    setText(state, stateText);
    if (state) state.dataset.tone = tone;

    const actions = document.getElementById("novelV152WritingActions");
    if (actions) {
      const model = writingActions(data, sessionId);
      const signature = JSON.stringify(model);
      if (actions.dataset.signature !== signature) {
        actions.dataset.signature = signature;
        actions.innerHTML = model.map(([action, label, kind]) =>
          `<button type="button" data-v152-writing-action="${action}" class="${kind || ""}">${label}</button>`
        ).join("");
      }
    }
  }

  function decorateChapterList() {
    const { chapters } = activeData();
    const byId = new Map(chapters.map((chapter) => [chapter.id, chapter]));
    const sessionId = currentSessionId();

    document.querySelectorAll("#studioChapterList .chapter-item[data-chapter-id]").forEach((item) => {
      const chapter = byId.get(item.dataset.chapterId);
      if (!chapter) return;
      const words = countChars(chapter.manuscript);
      const target = Math.max(100, Number(chapter.targetWords) || 3000);
      const percent = Math.max(0, Math.min(100, words / target * 100));
      let progress = item.querySelector(".novel-v152-chapter-progress");
      if (!progress) {
        progress = document.createElement("span");
        progress.className = "novel-v152-chapter-progress";
        progress.setAttribute("aria-hidden", "true");
        progress.innerHTML = "<i></i>";
        item.appendChild(progress);
      }
      const fill = progress.querySelector("i");
      if (fill) fill.style.width = `${percent.toFixed(1)}%`;
      item.dataset.v152Session = !chapter.sessionId ? "none" : chapter.sessionId === sessionId ? "current" : "other";
      item.title = `${chapter.name || "未命名章节"} · ${words.toLocaleString()} / ${target.toLocaleString()} 字${chapter.sessionId ? ` · 关联 ${sessionName(chapter.sessionId)}` : " · 未关联 AI 对话"}`;
    });
  }

  function decorateSessionList() {
    const { chapter } = activeData();
    document.querySelectorAll("#studioSessionList [data-session-id]").forEach((item) => {
      let badge = item.querySelector(".novel-v152-session-badge");
      const linked = Boolean(chapter?.sessionId && item.dataset.sessionId === chapter.sessionId);
      if (!linked) {
        badge?.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "novel-v152-session-badge";
        badge.textContent = "本章";
        badge.setAttribute("aria-label", "当前章节关联的 AI 对话");
        item.appendChild(badge);
      }
    });
  }

  function replyDestination(data) {
    if (data.chapter) return { id: data.chapter.id, name: data.chapter.name || "当前章节" };
    if (data.chapters.length) return { id: data.chapters[0].id, name: data.chapters[0].name || "第一章" };
    return { id: "", name: "将创建第一章" };
  }

  function decorateAiReplies() {
    const data = activeData();
    const destination = replyDestination(data);
    document.querySelectorAll("#chat .row.ai").forEach((row) => {
      const tools = row.querySelector(".message-tools");
      const add = tools?.querySelector(".user-flow-add-manuscript");
      if (!tools || !add) return;

      let flow = tools.querySelector(".novel-v152-result-flow");
      if (!flow) {
        flow = document.createElement("span");
        flow.className = "novel-v152-result-flow";
        flow.innerHTML = `<span class="novel-v152-result-destination"></span><button type="button" class="novel-v152-open-manuscript" hidden>查看正文</button>`;
        tools.appendChild(flow);
      }

      const addedChapterId = add.dataset.addedChapterId || "";
      const added = add.classList.contains("added") && Boolean(addedChapterId);
      const targetChapter = added
        ? data.chapters.find((chapter) => chapter.id === addedChapterId) || data.chapter
        : null;
      const label = added
        ? `已进入 · ${targetChapter?.name || "当前章节"}`
        : `将加入 · ${destination.name}`;
      setText(flow.querySelector(".novel-v152-result-destination"), label);
      flow.classList.toggle("added", added);
      const open = flow.querySelector(".novel-v152-open-manuscript");
      if (open) {
        open.hidden = !added;
        open.dataset.chapterId = addedChapterId;
      }
      add.title = added
        ? `这条回复已经加入${targetChapter?.name ? `“${targetChapter.name}”` : "正文"}`
        : `把整条回复加入${destination.name === "将创建第一章" ? "新章节" : `“${destination.name}”`}`;
    });
  }

  function maybeAutoBindAfterAdd(button, attempts = 0) {
    if (!button || attempts > 24) return;
    if (!button.classList.contains("added") || !button.dataset.addedChapterId) {
      window.setTimeout(() => maybeAutoBindAfterAdd(button, attempts + 1), 70);
      return;
    }
    const data = activeData();
    const sessionId = currentSessionId();
    if (data.chapter?.id === button.dataset.addedChapterId && !data.chapter.sessionId && sessionId) {
      bindActiveChapterToSession(sessionId);
    }
    scheduleRefresh(40);
  }

  function handleClick(event) {
    const writing = event.target?.closest?.("[data-v152-writing-action]")?.dataset.v152WritingAction;
    if (writing) {
      const data = activeData();
      const sessionId = currentSessionId();
      if (writing === "choose") chooseFirstChapter();
      else if (writing === "draft") focusManuscript();
      else if (writing === "bind" || writing === "rebind") bindActiveChapterToSession(sessionId);
      else if (writing === "switch-linked") switchToSession(data.chapter?.sessionId);
      return;
    }

    const open = event.target?.closest?.(".novel-v152-open-manuscript");
    if (open) {
      const chapterId = open.dataset.chapterId;
      const item = Array.from(document.querySelectorAll("#studioChapterList [data-chapter-id]"))
        .find((node) => node.dataset.chapterId === chapterId);
      item?.querySelector(".studio-item-main")?.click();
      window.setTimeout(focusManuscript, 55);
      return;
    }

    const add = event.target?.closest?.(".user-flow-add-manuscript");
    if (add && !add.classList.contains("added")) {
      window.setTimeout(() => maybeAutoBindAfterAdd(add), 30);
    }
  }

  function refresh() {
    refreshTimer = 0;
    if (!isNovelMode()) return;
    ensureWritingNow();
    renderWritingNow();
    decorateChapterList();
    decorateSessionList();
    decorateAiReplies();
    document.documentElement.dataset.novelManuscriptFlowRevision = REVISION;
  }

  function scheduleRefresh(delay = 30) {
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refresh, delay);
  }

  function install() {
    const library = document.getElementById("studioLibrary");
    const chat = document.getElementById("chat");
    if (!library || !chat) {
      window.setTimeout(install, 80);
      return;
    }

    document.addEventListener("click", handleClick);
    window.addEventListener("storage", (event) => {
      if (event.key === LS_STUDIO || event.key === LS_SESSIONS) scheduleRefresh(20);
    });

    libraryObserver = new MutationObserver(() => scheduleRefresh(45));
    libraryObserver.observe(library, { childList: true, subtree: true });

    chatObserver = new MutationObserver(() => scheduleRefresh(40));
    chatObserver.observe(chat, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-added-chapter-id"] });

    modeObserver = new MutationObserver(() => scheduleRefresh(10));
    modeObserver.observe(document.body, { attributes: true, attributeFilter: ["data-uai-mode"] });

    scheduleRefresh(0);
  }

  window.UnlimitedNovelWorkspaceV152 = {
    revision: REVISION,
    refresh,
    bindCurrentConversation: () => bindActiveChapterToSession(currentSessionId()),
    openManuscript: focusManuscript
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
