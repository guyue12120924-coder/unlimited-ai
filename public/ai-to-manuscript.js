// public/ai-to-manuscript.js
// One clear action from an AI reply to the formal manuscript.
(() => {
  const LS_STUDIO = "cfw_studio_workspace_v1";
  let observer = null;
  let enhanceTimer = null;
  let selectionAction = null;
  let selectionBubble = null;
  let selectionText = "";

  function readWorkspace() {
    try {
      const value = JSON.parse(localStorage.getItem(LS_STUDIO) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function activeData() {
    const state = readWorkspace();
    const projects = Array.isArray(state.projects) ? state.projects : [];
    const project = projects.find((item) => item.id === state.activeProjectId) || projects[0] || null;
    const chapters = Array.isArray(project?.chapters) ? project.chapters : [];
    const chapter = chapters.find((item) => item.id === state.activeChapterId) || null;
    return { state, project, chapters, chapter };
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function selectionInside(bubble) {
    const selection = window.getSelection?.();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    const common = range.commonAncestorContainer?.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer?.parentElement;
    if (!common || !bubble.contains(common)) return null;

    const text = String(selection.toString() || "").trim();
    if (!text) return null;

    let rect = range.getBoundingClientRect();
    if (!rect?.width && !rect?.height) {
      const rects = range.getClientRects();
      rect = rects.length ? rects[rects.length - 1] : null;
    }
    if (!rect) return null;
    return { text, rect };
  }

  function clickDraftTab() {
    const tab = document.querySelector('.studio-tabs [data-studio-tab="draft"]');
    if (tab && !tab.classList.contains("active")) tab.click();
  }

  function openChapter(chapterId) {
    const item = chapterId
      ? document.querySelector(`#studioChapterList [data-chapter-id="${CSS.escape(chapterId)}"]`)
      : null;
    const button = item?.querySelector(".studio-item-main") || item;
    if (button) button.click();
  }

  function createFirstChapter() {
    const add = document.getElementById("addChapter");
    const input = document.getElementById("chapterNameInput");
    const confirm = document.getElementById("confirmChapter");
    if (!add || !input || !confirm) return false;
    const row = document.getElementById("chapterCreateRow");
    if (row?.hidden) add.click();
    input.value = "第一章";
    confirm.click();
    return true;
  }

  async function ensureEditor() {
    const { chapters, chapter } = activeData();
    if (!chapter) {
      if (chapters.length) openChapter(chapters[0].id);
      else if (!createFirstChapter()) return null;
    }

    clickDraftTab();
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const editor = document.getElementById("simpleManuscriptEditor");
      if (editor) return editor;
      await wait(50);
      clickDraftTab();
    }
    return null;
  }

  function flashEditor(editor) {
    editor.classList.remove("user-flow-manuscript-updated");
    void editor.offsetWidth;
    editor.classList.add("user-flow-manuscript-updated");
    setTimeout(() => editor.classList.remove("user-flow-manuscript-updated"), 900);
  }

  function appendToEditor(editor, text) {
    const incoming = String(text || "").trim();
    if (!editor || !incoming) return false;
    const existing = String(editor.value || "").replace(/\s+$/, "");
    editor.value = existing ? `${existing}\n\n${incoming}` : incoming;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    editor.selectionStart = editor.selectionEnd = editor.value.length;
    flashEditor(editor);
    return true;
  }

  async function appendTextToManuscript(text) {
    const editor = await ensureEditor();
    if (!editor) return false;
    return appendToEditor(editor, text);
  }

  function markFullReplyState(button, bubble) {
    const { chapter } = activeData();
    const fullText = String(bubble.textContent || "").trim();
    const alreadyInChapter = Boolean(chapter?.id && fullText && String(chapter.manuscript || "").includes(fullText));

    if (button.dataset.addedChapterId && button.dataset.addedChapterId !== (chapter?.id || "")) {
      delete button.dataset.addedChapterId;
      button.disabled = false;
      button.classList.remove("added");
      button.textContent = "加入正文";
      button.title = "把整条回复加入当前章节";
    }

    if (alreadyInChapter) {
      button.dataset.addedChapterId = chapter.id;
      button.disabled = true;
      button.classList.add("added");
      button.textContent = "已加入正文";
      button.title = "这条回复已经加入当前章节";
    }
  }

  async function addReply(button, bubble) {
    if (button.disabled) return;
    const fullText = String(bubble.textContent || "").trim();
    if (!fullText || fullText.startsWith("错误:")) return;

    button.disabled = true;
    button.textContent = "正在加入…";
    const saved = await appendTextToManuscript(fullText);
    if (!saved) {
      button.textContent = "加入失败";
      setTimeout(() => {
        button.disabled = false;
        button.textContent = "加入正文";
      }, 1200);
      return;
    }

    const { chapter } = activeData();
    if (chapter?.id) button.dataset.addedChapterId = chapter.id;
    button.classList.add("added");
    button.textContent = "已加入正文";
    button.title = "这条回复已经加入当前章节";
  }

  function hideSelectionAction() {
    if (!selectionAction) return;
    selectionAction.hidden = true;
    selectionAction.disabled = false;
    selectionAction.textContent = "加入正文";
    selectionBubble = null;
    selectionText = "";
  }

  function positionSelectionAction(rect) {
    if (!selectionAction || !rect) return;
    selectionAction.hidden = false;
    selectionAction.style.left = "0px";
    selectionAction.style.top = "0px";

    const buttonRect = selectionAction.getBoundingClientRect();
    const margin = 8;
    let left = rect.left + rect.width / 2 - buttonRect.width / 2;
    let top = rect.top - buttonRect.height - margin;

    if (top < margin) top = rect.bottom + margin;
    left = Math.max(margin, Math.min(left, window.innerWidth - buttonRect.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - buttonRect.height - margin));

    selectionAction.style.left = `${Math.round(left)}px`;
    selectionAction.style.top = `${Math.round(top)}px`;
  }

  function showSelectionAction(bubble) {
    const selected = selectionInside(bubble);
    if (!selected) {
      hideSelectionAction();
      return;
    }
    selectionBubble = bubble;
    selectionText = selected.text;
    selectionAction.title = `把选中的 ${selectionText.length} 个字符加入当前章节`;
    positionSelectionAction(selected.rect);
  }

  function ensureSelectionAction() {
    if (selectionAction) return selectionAction;
    selectionAction = document.createElement("button");
    selectionAction.id = "userFlowSelectionAction";
    selectionAction.type = "button";
    selectionAction.hidden = true;
    selectionAction.textContent = "加入正文";
    selectionAction.setAttribute("aria-label", "把选中的文字加入正文");
    selectionAction.addEventListener("pointerdown", (event) => event.preventDefault());
    selectionAction.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const text = selectionText;
      if (!text || !selectionBubble || selectionAction.disabled) return;

      selectionAction.disabled = true;
      selectionAction.textContent = "正在加入…";
      const saved = await appendTextToManuscript(text);
      if (!saved) {
        selectionAction.textContent = "加入失败";
        setTimeout(hideSelectionAction, 1000);
        return;
      }

      window.getSelection?.()?.removeAllRanges?.();
      selectionAction.textContent = "已加入";
      setTimeout(hideSelectionAction, 550);
    });
    document.body.appendChild(selectionAction);
    return selectionAction;
  }

  function enhanceRow(row) {
    if (!row?.classList?.contains("ai")) return;
    const bubble = row.querySelector(".bubble.ai");
    const tools = row.querySelector(".message-tools");
    if (!bubble || !tools || bubble.querySelector(".typing-indicator")) return;
    const text = String(bubble.textContent || "").trim();
    if (!text || text.startsWith("错误:")) return;

    tools.querySelectorAll(".reader-toggle").forEach((button) => button.remove());
    const existing = tools.querySelector(".user-flow-add-manuscript");
    if (existing) {
      markFullReplyState(existing, bubble);
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "user-flow-add-manuscript";
    button.textContent = "加入正文";
    button.title = "把整条回复加入当前章节";

    bubble.addEventListener("mouseup", () => {
      requestAnimationFrame(() => showSelectionAction(bubble));
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideSelectionAction();
      addReply(button, bubble);
    });
    tools.appendChild(button);
    markFullReplyState(button, bubble);
  }

  function enhanceReplies() {
    updateHelpText();
    document.querySelectorAll("#chat .row.ai").forEach(enhanceRow);
    if (selectionBubble && !document.contains(selectionBubble)) hideSelectionAction();
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(enhanceReplies, 30);
  }

  function updateHelpText() {
    if (window.UnlimitedNovelWorkspaceV15 || document.documentElement.dataset.novelWorkspaceRevision) return;
    const empty = document.querySelector("#emptyState p");
    const text = "告诉 AI 你想写什么。整段内容可直接点“加入正文”；只想保留其中一部分时，选中文字，旁边会直接出现“加入正文”。";
    if (empty && empty.textContent !== text) empty.textContent = text;
  }

  function bindSelectionDismiss() {
    document.addEventListener("pointerdown", (event) => {
      if (!selectionAction || selectionAction.hidden) return;
      if (selectionAction.contains(event.target)) return;
      if (event.target.closest?.(".bubble.ai")) return;
      hideSelectionAction();
    }, true);
    window.addEventListener("scroll", hideSelectionAction, true);
    window.addEventListener("resize", hideSelectionAction);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideSelectionAction();
    });
  }

  function init() {
    ensureSelectionAction();
    bindSelectionDismiss();
    updateHelpText();
    enhanceReplies();
    const chat = document.getElementById("chat");
    if (chat) {
      observer = new MutationObserver(scheduleEnhance);
      observer.observe(chat, { childList: true, subtree: true, characterData: true });
    }
    document.getElementById("sessionList")?.addEventListener("click", () => setTimeout(enhanceReplies, 80));
    document.getElementById("studioLibrary")?.addEventListener("click", () => setTimeout(enhanceReplies, 80));
  }

  window.UnlimitedAiToManuscript = { enhance: enhanceReplies };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
