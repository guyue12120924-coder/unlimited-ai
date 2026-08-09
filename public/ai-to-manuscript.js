// public/ai-to-manuscript.js
// One clear action from an AI reply to the formal manuscript.
(() => {
  const LS_STUDIO = "cfw_studio_workspace_v1";
  let observer = null;
  let enhanceTimer = null;

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

  function selectedTextInside(bubble) {
    const selection = window.getSelection?.();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return "";
    const range = selection.getRangeAt(0);
    const common = range.commonAncestorContainer?.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer?.parentElement;
    if (!common || !bubble.contains(common)) return "";
    return String(selection.toString() || "").trim();
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
    let { chapters, chapter } = activeData();
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

  function appendToEditor(editor, text) {
    const incoming = String(text || "").trim();
    if (!editor || !incoming) return false;
    const existing = String(editor.value || "").replace(/\s+$/, "");
    editor.value = existing ? `${existing}\n\n${incoming}` : incoming;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    editor.selectionStart = editor.selectionEnd = editor.value.length;
    try { editor.focus({ preventScroll: true }); } catch { editor.focus(); }
    editor.scrollTop = editor.scrollHeight;
    return true;
  }

  async function addReply(button, bubble) {
    if (button.disabled) return;
    const chosen = selectedTextInside(bubble);
    const text = chosen || String(bubble.textContent || "").trim();
    if (!text || text.startsWith("错误:")) return;

    button.disabled = true;
    button.textContent = "正在加入…";
    const editor = await ensureEditor();
    if (!editor || !appendToEditor(editor, text)) {
      button.textContent = "加入失败";
      setTimeout(() => {
        button.disabled = false;
        button.textContent = "加入正文";
      }, 1200);
      return;
    }

    window.getSelection?.()?.removeAllRanges?.();
    button.classList.add("added");
    button.textContent = chosen ? "选中内容已加入" : "已加入正文";
    setTimeout(() => {
      if (!document.contains(button)) return;
      button.disabled = false;
      button.classList.remove("added");
      button.textContent = "继续加入";
    }, 1400);
  }

  function enhanceRow(row) {
    if (!row?.classList?.contains("ai")) return;
    const bubble = row.querySelector(".bubble.ai");
    const tools = row.querySelector(".message-tools");
    if (!bubble || !tools || bubble.querySelector(".typing-indicator")) return;
    const text = String(bubble.textContent || "").trim();
    if (!text || text.startsWith("错误:")) return;

    tools.querySelectorAll(".reader-toggle").forEach((button) => button.remove());
    if (tools.querySelector(".user-flow-add-manuscript")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "user-flow-add-manuscript";
    button.textContent = "加入正文";
    button.title = "直接加入当前章节；先选中部分文字可只加入选中内容";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      addReply(button, bubble);
    });
    tools.appendChild(button);
  }

  function enhanceReplies() {
    document.querySelectorAll("#chat .row.ai").forEach(enhanceRow);
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(enhanceReplies, 30);
  }

  function updateHelpText() {
    const empty = document.querySelector("#emptyState p");
    const text = "告诉 AI 你想写什么。生成后点“加入正文”即可直接放进当前章节；选中一部分文字后再点，只会加入选中的内容。";
    if (empty && empty.textContent !== text) empty.textContent = text;
  }

  function init() {
    updateHelpText();
    enhanceReplies();
    const chat = document.getElementById("chat");
    if (chat) {
      observer = new MutationObserver(scheduleEnhance);
      observer.observe(chat, { childList: true, subtree: true, characterData: true });
    }
    document.getElementById("sessionList")?.addEventListener("click", () => setTimeout(enhanceReplies, 80));
  }

  window.UnlimitedAiToManuscript = { enhance: enhanceReplies };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
