// public/novel-workspace-v15.js
// V15.0: clearer novel-writing context, next-step guidance and composer shortcuts.
(() => {
  const REVISION = "2026-08-17-v15.0-novel-workspace";
  const LS_STUDIO = "cfw_studio_workspace_v1";
  if (window.UnlimitedNovelWorkspaceV15) return;

  let observer = null;
  let refreshTimer = 0;

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
    const chapters = Array.isArray(project?.chapters) ? project.chapters : [];
    const chapter = chapters.find((item) => item.id === state.activeChapterId) || null;
    return { state, project, chapters, chapter };
  }

  function countChars(value) {
    return String(value || "").replace(/\s/g, "").length;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setText(node, value) {
    if (!node) return;
    const next = String(value ?? "");
    if (node.textContent !== next) node.textContent = next;
  }

  function isNovelMode() {
    return document.body.dataset.uaiMode === "novel";
  }

  function setComposer(text) {
    const input = document.getElementById("msg");
    if (!input) return;
    const next = String(text || "");
    if (input.value !== next) {
      input.value = next;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    try { input.focus({ preventScroll: false }); } catch { input.focus(); }
    try { input.setSelectionRange(input.value.length, input.value.length); } catch {}
  }

  function switchStudioTab(tab) {
    const button = document.querySelector(`.studio-tabs [data-studio-tab="${tab}"]`);
    if (!button) return false;
    button.click();
    return true;
  }

  function ensureChapterCreation() {
    const add = document.getElementById("addChapter");
    if (!add) return;
    const row = document.getElementById("chapterCreateRow");
    if (row?.hidden !== false) add.click();
    window.setTimeout(() => {
      const input = document.getElementById("chapterNameInput");
      if (!input) return;
      try { input.focus({ preventScroll: false }); } catch { input.focus(); }
    }, 30);
  }

  function activateFirstChapter(after) {
    const item = document.querySelector("#studioChapterList .chapter-item[data-chapter-id]");
    if (!item) return false;
    item.click();
    window.setTimeout(() => {
      switchStudioTab("draft");
      after?.(activeData());
    }, 40);
    return true;
  }

  function promptFor(kind, data) {
    const chapterName = data.chapter?.name || "当前章节";
    const base = `围绕《${data.project?.name || "当前作品"}》的${chapterName}`;
    switch (kind) {
      case "continue":
        return "请紧接当前章节已经写好的正文继续写下去。保持当前叙事视角、语言风格、人物状态、场景位置和剧情连续，不重复已有内容，不解释创作过程，直接输出可接在正文后面的小说正文。";
      case "advance":
        return `${base}继续推进剧情。不要突然跳时间或强行制造转折，优先推动当前冲突、人物行动和场景变化，让下一段自然产生新的进展。直接输出正文。`;
      case "dialogue":
        return `${base}写一段更自然、有角色差异的对话场景。对白要符合人物性格和关系，减少解释性台词，用动作、停顿和细节承接情绪。直接输出可使用的正文。`;
      case "plan":
        return `请根据当前作品设定和已有章节，为${chapterName}给出一个简洁可执行的写作计划：本章目标、核心冲突、关键场景、人物变化和结尾钩子。不要展开成长篇正文。`;
      default:
        return "";
    }
  }

  function ensureContextBar() {
    const pane = document.getElementById("conversationPane");
    if (!pane) return null;
    let bar = document.getElementById("novelV15ContextBar");
    if (bar) return bar;

    bar = document.createElement("section");
    bar.id = "novelV15ContextBar";
    bar.className = "novel-v15-context";
    bar.setAttribute("aria-label", "当前创作上下文");
    bar.innerHTML = `
      <div class="novel-v15-context-main">
        <span class="novel-v15-context-dot" aria-hidden="true"></span>
        <div class="novel-v15-context-copy">
          <span id="novelV15ProjectName">当前作品</span>
          <strong id="novelV15ChapterName">尚未选择章节</strong>
        </div>
      </div>
      <div class="novel-v15-context-progress" aria-label="章节写作进度">
        <span><i id="novelV15ProgressFill"></i></span>
        <b id="novelV15WordProgress">0 / 3000 字</b>
      </div>
      <div class="novel-v15-context-actions">
        <button type="button" data-novel-v15-action="draft">正文</button>
        <button type="button" data-novel-v15-action="outline">大纲</button>
      </div>`;

    const search = document.getElementById("conversationSearchBar");
    if (search?.parentElement === pane) search.insertAdjacentElement("afterend", bar);
    else pane.prepend(bar);
    return bar;
  }

  function ensureComposerAssist() {
    const composer = document.getElementById("composer");
    const textarea = document.getElementById("msg");
    if (!composer || !textarea) return null;

    let assist = document.getElementById("novelV15ComposerAssist");
    if (!assist) {
      assist = document.createElement("div");
      assist.id = "novelV15ComposerAssist";
      assist.className = "novel-v15-composer-assist";
      assist.innerHTML = `
        <div class="novel-v15-shortcuts" aria-label="快捷创作指令">
          <button type="button" data-novel-v15-prompt="continue">继续正文</button>
          <button type="button" data-novel-v15-prompt="advance">推进剧情</button>
          <button type="button" data-novel-v15-prompt="dialogue">写一段对话</button>
          <button type="button" data-novel-v15-prompt="plan">规划本章</button>
        </div>
        <div class="novel-v15-context-note">
          <span aria-hidden="true">✦</span>
          <p id="novelV15ContextNote">AI 会自动结合当前作品资料与章节上下文。</p>
          <b id="novelV15ComposerCount" hidden>0</b>
        </div>`;
      composer.prepend(assist);
    }

    if (textarea.dataset.novelV15Bound !== "1") {
      textarea.dataset.novelV15Bound = "1";
      textarea.addEventListener("focus", () => composer.classList.add("novel-v15-focused"));
      textarea.addEventListener("blur", () => composer.classList.remove("novel-v15-focused"));
      textarea.addEventListener("input", () => updateComposerCount(textarea));
      updateComposerCount(textarea);
    }

    return assist;
  }

  function updateComposerCount(textarea = document.getElementById("msg")) {
    const count = document.getElementById("novelV15ComposerCount");
    if (!count || !textarea) return;
    const length = String(textarea.value || "").length;
    count.hidden = length === 0;
    setText(count, length);
  }

  function ensureEmptyActions() {
    const empty = document.getElementById("emptyState");
    if (!empty) return null;
    let actions = empty.querySelector(".novel-v15-empty-actions");
    if (actions) return actions;

    actions = document.createElement("div");
    actions.className = "novel-v15-empty-actions";
    actions.innerHTML = `
      <button type="button" class="primary" data-novel-v15-empty="continue"><span>继续当前章节</span><b>→</b></button>
      <button type="button" data-novel-v15-empty="plan">先规划这一章</button>
      <button type="button" data-novel-v15-empty="characters">完善人物</button>`;
    empty.appendChild(actions);
    return actions;
  }

  function updateEmptyState(data) {
    const empty = document.getElementById("emptyState");
    if (!empty) return;
    const kicker = empty.querySelector(".empty-kicker");
    const title = empty.querySelector("h1");
    const text = empty.querySelector("p");
    const actions = ensureEmptyActions();
    const primary = actions?.querySelector('[data-novel-v15-empty="continue"] span');

    if (!data.chapter) {
      setText(kicker, "START YOUR STORY");
      setText(title, data.chapters.length ? "选择一个章节，继续写下去" : "先创建第一章");
      setText(text, data.chapters.length
        ? "左侧已有章节。选择其中一章后，AI 会自动关联当前作品、人物和设定。"
        : "不用先把所有设定填完。创建一个章节，从第一幕开始写，之后再逐步补充人物和世界观。");
      setText(primary, data.chapters.length ? "选择章节" : "创建第一章");
      return;
    }

    const words = countChars(data.chapter.manuscript);
    setText(kicker, "CURRENT CHAPTER");
    setText(title, words ? `继续写「${data.chapter.name || "当前章节"}」` : `开始写「${data.chapter.name || "当前章节"}」`);
    setText(text, words
      ? `本章已经写了 ${words.toLocaleString()} 字。可以直接继续正文，也可以先让 AI 帮你推进剧情或整理本章结构。`
      : "这一章还没有正文。你可以先写第一段，也可以让 AI 根据现有设定给出一个简洁的起笔方案。");
    setText(primary, words ? "继续当前章节" : "开始这一章");
  }

  function updateContext(data) {
    const bar = ensureContextBar();
    ensureComposerAssist();
    if (!bar) return;

    const words = countChars(data.chapter?.manuscript);
    const target = Math.max(100, Number(data.chapter?.targetWords) || 3000);
    const percent = data.chapter ? clamp((words / target) * 100, 0, 100) : 0;

    const project = document.getElementById("novelV15ProjectName");
    const chapter = document.getElementById("novelV15ChapterName");
    const fill = document.getElementById("novelV15ProgressFill");
    const progress = document.getElementById("novelV15WordProgress");
    const note = document.getElementById("novelV15ContextNote");

    setText(project, data.project?.name || "当前作品");
    setText(chapter, data.chapter?.name || "尚未选择章节");
    if (fill) fill.style.width = `${percent.toFixed(1)}%`;
    setText(progress, data.chapter
      ? `${words.toLocaleString()} / ${target.toLocaleString()} 字`
      : `${data.chapters.length} 个章节`);
    setText(note, data.chapter
      ? "AI 会自动参考作品设定、人物资料和当前章节正文末尾。"
      : "选择章节后，AI 会自动关联该章节与作品资料。");

    bar.classList.toggle("has-chapter", Boolean(data.chapter));
  }

  function refresh() {
    refreshTimer = 0;
    if (!isNovelMode()) return;
    if (!document.getElementById("creativeWorkspace")) return;

    const data = activeData();
    ensureContextBar();
    ensureComposerAssist();
    ensureEmptyActions();
    updateEmptyState(data);
    updateContext(data);
    updateComposerCount();
  }

  function scheduleRefresh(delay = 20) {
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refresh, delay);
  }

  function handleClick(event) {
    const action = event.target?.closest?.("[data-novel-v15-action]")?.dataset.novelV15Action;
    if (action) {
      switchStudioTab(action);
      return;
    }

    const prompt = event.target?.closest?.("[data-novel-v15-prompt]")?.dataset.novelV15Prompt;
    if (prompt) {
      const data = activeData();
      if (!data.chapter) {
        if (prompt === "plan") {
          switchStudioTab("outline");
        } else if (data.chapters.length) {
          activateFirstChapter((next) => setComposer(promptFor(prompt, next)));
        } else {
          ensureChapterCreation();
        }
        return;
      }
      setComposer(promptFor(prompt, data));
      return;
    }

    const emptyAction = event.target?.closest?.("[data-novel-v15-empty]")?.dataset.novelV15Empty;
    if (!emptyAction) return;
    const data = activeData();

    if (emptyAction === "characters") {
      switchStudioTab("characters");
      return;
    }

    if (emptyAction === "plan") {
      if (!data.chapter) {
        switchStudioTab("outline");
        return;
      }
      setComposer(promptFor("plan", data));
      return;
    }

    if (!data.chapter) {
      if (data.chapters.length) activateFirstChapter();
      else ensureChapterCreation();
      return;
    }

    setComposer(promptFor("continue", data));
  }

  function install() {
    document.documentElement.dataset.novelWorkspaceRevision = REVISION;
    document.addEventListener("click", handleClick);
    window.addEventListener("storage", (event) => {
      if (event.key === LS_STUDIO) scheduleRefresh(10);
    });

    observer = new MutationObserver(() => scheduleRefresh(25));
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-uai-mode", "class"]
    });

    scheduleRefresh(0);
  }

  window.UnlimitedNovelWorkspaceV15 = {
    revision: REVISION,
    refresh,
    fill: (kind) => setComposer(promptFor(kind, activeData()))
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();