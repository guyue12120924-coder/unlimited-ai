// public/ai-collaboration-v17.js
// V17.0: consolidated chapter/session + AI reply collaboration (legacy V15.2 + V15.3 behavior).
(() => {
  const REVISION = "2026-08-21-v17.0-ai-collaboration";
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LS_SESSIONS = "cfw_sessions_v2";
  if (window.UnlimitedAICollaborationV17) return;

  let refreshTimer = 0;
  let enhanceTimer = 0;
  const ACTIONS = [
    ["continue", "续写", "把这一段作为直接前文继续写"],
    ["rewrite", "重写", "保留剧情事实，重新组织这一段"],
    ["expand", "扩写", "不改结果，增加细节与场景表现"],
    ["polish", "润色", "不改剧情，只优化语言与节奏"],
    ["reference", "参考", "只把这一段作为后续创作参考"]
  ];

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
    return document.body?.dataset?.uaiMode === "novel";
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

  function setComposer(text) {
    const input = document.getElementById("msg");
    if (!input) return false;
    const next = String(text || "");
    if (input.value !== next) {
      input.value = next;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    try { input.focus({ preventScroll: false }); } catch { input.focus(); }
    try { input.setSelectionRange(input.value.length, input.value.length); } catch {}
    const composer = document.getElementById("composer");
    composer?.classList.add("novel-v153-prepared");
    window.clearTimeout(setComposer.timer);
    setComposer.timer = window.setTimeout(() => composer?.classList.remove("novel-v153-prepared"), 900);
    return true;
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
      (item.querySelector(".studio-item-main") || item).click();
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
    if (panel?.parentElement === library) {
      if (panel.nextElementSibling !== chapterSection) chapterSection.before(panel);
      return panel;
    }
    panel?.remove();
    panel = document.createElement("section");
    panel.id = "novelV152WritingNow";
    panel.className = "novel-v152-writing-now";
    panel.innerHTML = `
      <div class="novel-v152-writing-copy"><span>CURRENT WRITING</span><strong id="novelV152Chapter">当前章节</strong><p id="novelV152Session">当前 AI 对话</p></div>
      <div class="novel-v152-writing-state"><span id="novelV152LinkState" data-tone="neutral">未关联</span><div id="novelV152WritingActions"></div></div>`;
    chapterSection.before(panel);
    return panel;
  }

  function writingActions(data, sessionId) {
    if (!data.chapter) return [["choose", data.chapters.length ? "选择章节" : "创建第一章", "primary"]];
    if (!sessionId) return [["draft", "打开正文", "primary"]];
    if (!data.chapter.sessionId) return [["bind", "关联当前对话", "primary"], ["draft", "正文", ""]];
    if (data.chapter.sessionId === sessionId) return [["draft", "打开正文", "primary"]];
    return [["switch-linked", "切到关联对话", "primary"], ["rebind", "改为当前对话", ""]];
  }

  function renderWritingNow(data = activeData()) {
    const panel = ensureWritingNow();
    if (!panel) return;
    const sessionId = currentSessionId();
    const currentName = sessionId ? sessionName(sessionId) : "暂无对话";
    const linkedName = data.chapter?.sessionId ? sessionName(data.chapter.sessionId) : "";
    setText(document.getElementById("novelV152Chapter"), data.chapter?.name || "尚未选择章节");
    setText(document.getElementById("novelV152Session"), !data.chapter ? `当前对话：${currentName}` : data.chapter.sessionId ? `本章对话：${linkedName}` : `当前对话：${currentName}`);
    const state = document.getElementById("novelV152LinkState");
    let stateText = "先选章节";
    let tone = "neutral";
    if (data.chapter) {
      if (!data.chapter.sessionId) stateText = "尚未关联";
      else if (data.chapter.sessionId === sessionId) { stateText = "已关联当前对话"; tone = "good"; }
      else { stateText = "当前对话不同"; tone = "warn"; }
    }
    setText(state, stateText);
    if (state) state.dataset.tone = tone;
    const actions = document.getElementById("novelV152WritingActions");
    const model = writingActions(data, sessionId);
    const signature = JSON.stringify(model);
    if (actions && actions.dataset.signature !== signature) {
      actions.dataset.signature = signature;
      actions.innerHTML = model.map(([action, label, kind]) => `<button type="button" data-v152-writing-action="${action}" class="${kind || ""}">${label}</button>`).join("");
    }
  }

  function decorateChapterList(data = activeData()) {
    const byId = new Map(data.chapters.map((chapter) => [chapter.id, chapter]));
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

  function decorateSessionList(data = activeData()) {
    document.querySelectorAll("#studioSessionList [data-session-id]").forEach((item) => {
      let badge = item.querySelector(".novel-v152-session-badge");
      const linked = Boolean(data.chapter?.sessionId && item.dataset.sessionId === data.chapter.sessionId);
      if (!linked) return void badge?.remove();
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

  function decorateAiReplies(data = activeData()) {
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
      const targetChapter = added ? data.chapters.find((chapter) => chapter.id === addedChapterId) || data.chapter : null;
      setText(flow.querySelector(".novel-v152-result-destination"), added ? `已进入 · ${targetChapter?.name || "当前章节"}` : `将加入 · ${destination.name}`);
      flow.classList.toggle("added", added);
      const open = flow.querySelector(".novel-v152-open-manuscript");
      if (open) { open.hidden = !added; open.dataset.chapterId = addedChapterId; }
      add.title = added ? `这条回复已经加入${targetChapter?.name ? `“${targetChapter.name}”` : "正文"}` : `把整条回复加入${destination.name === "将创建第一章" ? "新章节" : `“${destination.name}”`}`;
    });
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function replyText(row) {
    return cleanText(row?.querySelector(".bubble.ai")?.textContent || "");
  }

  function locator(text) {
    const value = cleanText(text);
    return value.length <= 260 ? value : `${value.slice(0, 170)}……${value.slice(-70)}`;
  }

  function replyPromptFor(action, text) {
    const anchor = `「${locator(text).replace(/[「」]/g, "")}」`;
    if (action === "continue") return `请把对话中这条 AI 回复视为当前章节的直接前文继续写下去。定位片段：${anchor}\n\n保持当前叙事视角、人物状态、场景位置和语言风格，不重复已经写过的内容，不突然跳时间，不解释创作过程。让人物行动和当前冲突自然向前推进，直接输出可以接在这段后面的小说正文。`;
    if (action === "rewrite") return `请重写对话中的这条 AI 回复。定位片段：${anchor}\n\n保留已经发生的剧情事实、人物关系、关键信息和事件结果，但重新组织句子、节奏、动作、心理与对白。不要只是同义词替换，也不要继续后面的剧情。直接输出完整的重写版本，不解释修改过程。`;
    if (action === "expand") return `请扩写对话中的这条 AI 回复。定位片段：${anchor}\n\n不要改变原有事件结果、人物立场和核心台词意图。在原内容基础上增加约 50%–100% 的有效细节，重点补足场景感、动作反应、人物情绪、对白节奏和必要的过渡，但不要新增会改变后续剧情方向的重大设定。直接输出扩写后的完整正文。`;
    if (action === "polish") return `请润色对话中的这条 AI 回复。定位片段：${anchor}\n\n不改变剧情事实、人物性格、叙事视角、事件顺序和原本的信息量，尽量保持接近原长度。减少重复、套话、解释性句子和生硬转折，让语言更自然、有画面感，段落节奏更像正式小说。直接输出润色后的正文。`;
    if (action === "reference") return `请把对话中的这条 AI 回复只作为后续创作参考，不要自动加入正文，也不要原句照抄。参考片段：${anchor}\n\n后续处理时可以参考其中有效的氛围、人物状态、场景信息和表达方向，但以我接下来的要求为准。\n\n我的要求：`;
    return "";
  }

  function notify(action) {
    const labels = { continue: "续写", rewrite: "重写", expand: "扩写", polish: "润色", reference: "参考" };
    window.UnlimitedV2Phase2?.notify?.(`已生成“${labels[action] || "处理"}”指令，可修改后再发送。`, "success");
  }

  function markPrepared(button) {
    const bar = button?.closest(".novel-v153-reply-actions");
    bar?.querySelectorAll("button.prepared").forEach((node) => {
      node.classList.remove("prepared");
      if (node.dataset.label) node.textContent = node.dataset.label;
    });
    if (!button) return;
    if (!button.dataset.label) button.dataset.label = button.textContent || "";
    button.classList.add("prepared");
    button.textContent = "已填入";
    window.clearTimeout(button.v153Timer);
    button.v153Timer = window.setTimeout(() => {
      if (!document.contains(button)) return;
      button.classList.remove("prepared");
      button.textContent = button.dataset.label || "处理";
    }, 1050);
  }

  function handleReplyAction(button, row) {
    const action = button?.dataset.v153ReplyAction;
    const text = replyText(row);
    if (!action || !text || text.startsWith("错误:")) return;
    const prompt = replyPromptFor(action, text);
    if (!prompt || !setComposer(prompt)) return;
    markPrepared(button);
    notify(action);
  }

  function createReplyActions(row) {
    if (!row?.classList?.contains("ai") || row.querySelector(".typing-indicator")) return;
    const tools = row.querySelector(".message-tools");
    const text = replyText(row);
    if (!tools || !text || text.startsWith("错误:")) return;
    let bar = tools.querySelector(".novel-v153-reply-actions");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "novel-v153-reply-actions";
      bar.setAttribute("aria-label", "处理这条 AI 回复");
      const label = document.createElement("span");
      label.className = "novel-v153-reply-actions-label";
      label.textContent = "处理这段";
      bar.appendChild(label);
      ACTIONS.forEach(([action, title, help]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.v153ReplyAction = action;
        button.dataset.label = title;
        button.textContent = title;
        button.title = help;
        button.setAttribute("aria-label", `${title}这条 AI 回复`);
        bar.appendChild(button);
      });
      tools.appendChild(bar);
    }
    row.dataset.v153ReplyReady = "1";
  }

  function enhanceReplies() {
    enhanceTimer = 0;
    if (!isNovelMode()) return;
    document.querySelectorAll("#chat .row.ai").forEach(createReplyActions);
    document.documentElement.dataset.novelReplyActionsRevision = REVISION;
  }

  function maybeAutoBindAfterAdd(button, attempts = 0) {
    if (!button || attempts > 24) return;
    if (!button.classList.contains("added") || !button.dataset.addedChapterId) {
      window.setTimeout(() => maybeAutoBindAfterAdd(button, attempts + 1), 70);
      return;
    }
    const data = activeData();
    const sessionId = currentSessionId();
    if (data.chapter?.id === button.dataset.addedChapterId && !data.chapter.sessionId && sessionId) bindActiveChapterToSession(sessionId);
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
      const item = Array.from(document.querySelectorAll("#studioChapterList [data-chapter-id]")).find((node) => node.dataset.chapterId === chapterId);
      item?.querySelector(".studio-item-main")?.click();
      window.setTimeout(focusManuscript, 55);
      return;
    }
    const replyAction = event.target?.closest?.("[data-v153-reply-action]");
    if (replyAction) {
      event.preventDefault();
      event.stopPropagation();
      handleReplyAction(replyAction, replyAction.closest("#chat .row.ai"));
      return;
    }
    const add = event.target?.closest?.(".user-flow-add-manuscript");
    if (add && !add.classList.contains("added")) window.setTimeout(() => maybeAutoBindAfterAdd(add), 30);
  }

  function refresh() {
    refreshTimer = 0;
    if (!isNovelMode()) return;
    const data = activeData();
    ensureWritingNow();
    renderWritingNow(data);
    decorateChapterList(data);
    decorateSessionList(data);
    decorateAiReplies(data);
    enhanceReplies();
    document.documentElement.dataset.novelManuscriptFlowRevision = REVISION;
    document.documentElement.dataset.novelAICollaborationRevision = REVISION;
  }

  function scheduleRefresh(delay = 25) {
    if (window.UnlimitedV3?.schedule && delay <= 25) {
      window.UnlimitedV3.schedule("v17-ai-collaboration", refresh);
      return;
    }
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refresh, delay);
  }

  function scheduleEnhance(delay = 25) {
    if (window.UnlimitedV3?.schedule && delay <= 25) {
      window.UnlimitedV3.schedule("v17-reply-actions", enhanceReplies);
      return;
    }
    if (enhanceTimer) window.clearTimeout(enhanceTimer);
    enhanceTimer = window.setTimeout(enhanceReplies, delay);
  }

  function install() {
    document.addEventListener("click", handleClick);
    window.addEventListener("storage", (event) => { if (event.key === LS_STUDIO || event.key === LS_SESSIONS) scheduleRefresh(10); });
    window.addEventListener("uai:workspace-refresh", () => scheduleRefresh(0));
    window.addEventListener("uai:chat-refresh", () => scheduleRefresh(0));
    window.addEventListener("uai:mode-refresh", () => scheduleRefresh(0));
    scheduleRefresh(0);
  }

  const api = {
    revision: REVISION,
    refresh,
    bindCurrentConversation: () => bindActiveChapterToSession(currentSessionId()),
    openManuscript: focusManuscript,
    replyPromptFor,
    enhanceReplies: () => scheduleEnhance(0)
  };
  window.UnlimitedAICollaborationV17 = api;
  window.UnlimitedNovelWorkspaceV152 = { revision: REVISION, refresh, bindCurrentConversation: api.bindCurrentConversation, openManuscript: focusManuscript };
  window.UnlimitedNovelWorkspaceV153 = { revision: REVISION, refresh: api.enhanceReplies, promptFor: replyPromptFor };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
