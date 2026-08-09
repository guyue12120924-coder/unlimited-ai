// public/v2-product.js
// Unified product experience for V2.1-V2.5: shell, manuscript, AI collaboration,
// character cards, and outline workflow. Keeps the established storage model intact.
(() => {
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LS_EDITOR_VIEW = "cfw_editor_view_v1";
  const expandedCharacters = new Set();
  let panelObserver = null;
  let chatObserver = null;
  let refreshTimer = null;
  let resultTimer = null;
  let pendingEdit = null;

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

  function workspace() {
    const value = readJson(LS_STUDIO, {});
    return value && typeof value === "object" ? value : {};
  }

  function activeData() {
    const state = workspace();
    const projects = Array.isArray(state.projects) ? state.projects : [];
    const project = projects.find((item) => item.id === state.activeProjectId) || projects[0] || null;
    const chapters = Array.isArray(project?.chapters) ? project.chapters : [];
    const chapter = chapters.find((item) => item.id === state.activeChapterId) || null;
    return { state, projects, project, chapters, chapter };
  }

  function activeTab() {
    return document.querySelector(".studio-tabs [data-studio-tab].active")?.dataset.studioTab || "draft";
  }

  function countWords(text) {
    return String(text || "").replace(/\s/g, "").length;
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
    if (!input) return false;
    input.value = String(text || "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    try { input.focus({ preventScroll: false }); } catch { input.focus(); }
    input.setSelectionRange(input.value.length, input.value.length);
    return true;
  }

  function saveChapterField(field, value) {
    const body = document.getElementById("studioPanelBody");
    if (!body) return false;
    const control = document.createElement("input");
    control.hidden = true;
    control.dataset.chapterField = field;
    control.value = String(value ?? "");
    body.appendChild(control);
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.remove();
    return true;
  }

  function showSaveState(text, state = "saved", resetMs = 0) {
    const node = document.getElementById("simpleManuscriptStatus");
    if (!node) return;
    setText(node, text);
    node.dataset.saveState = state;
    clearTimeout(node.v2ProductResetTimer);
    if (resetMs) {
      node.v2ProductResetTimer = setTimeout(() => {
        if (!document.contains(node)) return;
        setText(node, "已保存");
        node.dataset.saveState = "saved";
      }, resetMs);
    }
  }

  // V2.1 - Main shell and information hierarchy.
  function enhanceShell() {
    document.body.classList.add("v2-product-ready");
    setText(document.querySelector(".brand-copy span"), "AI 小说创作");

    const library = document.getElementById("studioLibrary");
    if (library) {
      setText(library.querySelector(".studio-panel-head strong"), "作品");
      setText(library.querySelector(".studio-kicker"), "WRITING");

      const chapterSection = library.querySelector(".chapter-section");
      const sessionSection = Array.from(library.querySelectorAll(".library-section")).find((section) => !section.classList.contains("chapter-section"));
      if (chapterSection && sessionSection && chapterSection.nextElementSibling !== sessionSection) {
        sessionSection.before(chapterSection);
      }

      const chapterTitle = chapterSection?.querySelector(".library-title span");
      const chapterAdd = chapterSection?.querySelector(".library-title button");
      setText(chapterTitle, "章节");
      setText(chapterAdd, "新建");

      const sessionTitle = sessionSection?.querySelector(".library-title span");
      const sessionAdd = sessionSection?.querySelector(".library-title button");
      setText(sessionTitle, "AI 对话");
      setText(sessionAdd, "新对话");
    }

    const studioHead = document.querySelector("#studioPanel .studio-panel-head");
    if (studioHead) {
      setText(studioHead.querySelector(".studio-kicker"), "STORY");
    }

    enhanceChapterList();
    enhanceConversationRows();
  }

  function enhanceChapterList() {
    const { chapters } = activeData();
    const byId = new Map(chapters.map((chapter) => [chapter.id, chapter]));
    document.querySelectorAll("#studioChapterList .chapter-item[data-chapter-id]").forEach((item) => {
      const chapter = byId.get(item.dataset.chapterId);
      if (!chapter) return;
      item.classList.toggle("v2-chapter-done", Boolean(chapter.done));
      const small = item.querySelector(".studio-item-main small");
      const words = countWords(chapter.manuscript);
      setText(small, `${words.toLocaleString()} 字 · ${chapter.done ? "已完成" : "写作中"}`);
      const main = item.querySelector(".studio-item-main");
      if (main) main.title = `${chapter.name || "未命名章节"} · ${words.toLocaleString()} 字`;
    });
  }

  function enhanceConversationRows() {
    document.querySelectorAll("#chat .row.ai").forEach((row) => {
      row.classList.add("v2-ai-suggestion");
      const meta = row.querySelector(".meta");
      if (meta && /assistant|ai|助手/i.test(meta.textContent || "")) setText(meta, "AI 建议");
    });
    document.querySelectorAll("#chat .row.user").forEach((row) => row.classList.add("v2-user-request"));
  }

  // V2.2 - Manuscript editing quality and focus mode.
  function editorViewKey() {
    const { project, chapter } = activeData();
    return project?.id && chapter?.id ? `${project.id}:${chapter.id}` : "";
  }

  function readEditorView() {
    const value = readJson(LS_EDITOR_VIEW, {});
    return value && typeof value === "object" ? value : {};
  }

  function saveEditorView(editor) {
    const key = editorViewKey();
    if (!key || !editor) return;
    const all = readEditorView();
    all[key] = {
      scrollTop: Math.max(0, Number(editor.scrollTop) || 0),
      cursor: Math.max(0, Number(editor.selectionStart) || 0)
    };
    writeJson(LS_EDITOR_VIEW, all);
  }

  function restoreEditorView(editor) {
    if (!editor || editor.dataset.v2ViewRestored === "1") return;
    editor.dataset.v2ViewRestored = "1";
    const key = editorViewKey();
    const saved = key ? readEditorView()[key] : null;
    if (!saved) return;
    requestAnimationFrame(() => {
      if (!document.contains(editor)) return;
      editor.scrollTop = Math.max(0, Number(saved.scrollTop) || 0);
      const cursor = Math.min(editor.value.length, Math.max(0, Number(saved.cursor) || 0));
      try { editor.setSelectionRange(cursor, cursor); } catch {}
    });
  }

  function beginChapterRename(title) {
    const { chapter } = activeData();
    if (!chapter || !title || title.querySelector("input")) return;
    const oldName = String(chapter.name || "未命名章节");
    const input = document.createElement("input");
    input.className = "v2-chapter-title-input";
    input.maxLength = 60;
    input.value = oldName;
    title.replaceChildren(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = (commit = true) => {
      if (finished) return;
      finished = true;
      const next = String(input.value || "").trim() || oldName;
      if (commit && next !== oldName) saveChapterField("name", next);
      title.textContent = commit ? next : oldName;
      title.dataset.v2RenameReady = "1";
      title.title = "点击修改章节名";
      const activeLabel = document.querySelector(`#studioChapterList .chapter-item.active .studio-item-main span`);
      if (activeLabel && commit) activeLabel.textContent = next;
    };

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      } else if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    });
    input.addEventListener("blur", () => finish(true), { once: true });
  }

  function continuationPrompt() {
    return "请紧接当前章节已经写好的正文继续写下去。保持当前叙事视角、语言风格、人物状态、场景位置和剧情连续，不重复已有内容，不解释创作过程，直接输出可接在正文后面的小说正文。";
  }

  function toggleFocusMode() {
    const next = !document.body.classList.contains("v2-writing-focus");
    document.body.classList.toggle("v2-writing-focus", next);
    const button = document.getElementById("v2FocusWriting");
    if (button) button.textContent = next ? "退出专注" : "专注";
    if (!next) scheduleRefresh(40);
  }

  function enhanceManuscript() {
    if (activeTab() !== "draft") return;
    const pane = document.getElementById("simpleManuscriptPane");
    const editor = document.getElementById("simpleManuscriptEditor");
    if (!pane || !editor) return;

    restoreEditorView(editor);

    const title = pane.querySelector(".simple-manuscript-head h3");
    if (title && title.dataset.v2RenameReady !== "1") {
      title.dataset.v2RenameReady = "1";
      title.title = "点击修改章节名";
      title.tabIndex = 0;
      title.addEventListener("click", () => beginChapterRename(title));
      title.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          beginChapterRename(title);
        }
      });
    }

    const head = pane.querySelector(".simple-manuscript-head");
    if (head && !head.querySelector("#v2ManuscriptTools")) {
      const count = head.querySelector("#simpleManuscriptCount");
      const tools = document.createElement("div");
      tools.id = "v2ManuscriptTools";
      tools.className = "v2-manuscript-tools";
      const continueButton = document.createElement("button");
      continueButton.id = "v2ContinueWriting";
      continueButton.type = "button";
      continueButton.textContent = "AI 续写";
      continueButton.addEventListener("click", () => fillComposer(continuationPrompt()));
      const focusButton = document.createElement("button");
      focusButton.id = "v2FocusWriting";
      focusButton.type = "button";
      focusButton.textContent = document.body.classList.contains("v2-writing-focus") ? "退出专注" : "专注";
      focusButton.addEventListener("click", toggleFocusMode);
      if (count) tools.appendChild(count);
      tools.append(continueButton, focusButton);
      head.appendChild(tools);
    }

    if (editor.dataset.v2ProductBound !== "1") {
      editor.dataset.v2ProductBound = "1";
      let viewTimer = null;
      const rememberView = () => {
        clearTimeout(viewTimer);
        viewTimer = setTimeout(() => saveEditorView(editor), 120);
      };
      editor.addEventListener("scroll", rememberView, { passive: true });
      editor.addEventListener("keyup", () => {
        rememberView();
        syncManuscriptSelection(editor);
      });
      editor.addEventListener("mouseup", () => syncManuscriptSelection(editor));
      editor.addEventListener("select", () => syncManuscriptSelection(editor));
      editor.addEventListener("blur", rememberView);
      editor.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
          event.preventDefault();
          editor.dispatchEvent(new Event("input", { bubbles: true }));
          showSaveState("已保存", "saved", 900);
        }
      });
    }

    ensureManuscriptAiBar(editor);
  }

  // V2.3 - Lightweight AI collaboration from the manuscript itself.
  function selectedManuscript(editor) {
    if (!editor) return null;
    const start = Number(editor.selectionStart);
    const end = Number(editor.selectionEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    const text = editor.value.slice(start, end).trim();
    if (!text) return null;
    return { start, end, text };
  }

  function ensureManuscriptAiBar(editor) {
    const pane = editor.closest("#simpleManuscriptPane");
    if (!pane) return;
    let bar = pane.querySelector("#v2ManuscriptAiBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "v2ManuscriptAiBar";
      bar.className = "v2-manuscript-ai-bar";
      bar.hidden = true;
      bar.innerHTML = `<span id="v2SelectionCount">已选文字</span><div><button type="button" data-v2-edit="polish">润色</button><button type="button" data-v2-edit="rewrite">改写</button><button type="button" data-v2-edit="expand">扩写</button></div>`;
      editor.after(bar);
      bar.querySelectorAll("[data-v2-edit]").forEach((button) => {
        button.addEventListener("click", () => startManuscriptEdit(button.dataset.v2Edit, editor));
      });
    }
  }

  function syncManuscriptSelection(editor) {
    const bar = document.getElementById("v2ManuscriptAiBar");
    if (!bar || !editor) return;
    const selected = selectedManuscript(editor);
    bar.hidden = !selected;
    if (selected) setText(bar.querySelector("#v2SelectionCount"), `已选 ${countWords(selected.text).toLocaleString()} 字`);
  }

  function editInstruction(action, text) {
    const instructions = {
      polish: "请润色下面这段小说正文。保留原有剧情事实、人物行为和含义，改善语言质感、节奏、画面感和对白自然度。不要新增剧情，只输出润色后的正文，不要解释。",
      rewrite: "请改写下面这段小说正文。保留核心剧情事实和人物状态，但让表达更自然、更有画面感，避免生硬和重复。只输出改写后的正文，不要解释。",
      expand: "请扩写下面这段小说正文。在不改变已有剧情事实和人物设定的前提下，补充必要的动作、环境、心理或对话细节，让场景更完整。不要推进到新的剧情节点，只输出扩写后的正文，不要解释。"
    };
    return `${instructions[action] || instructions.polish}\n\n【原文】\n${text}`;
  }

  function startManuscriptEdit(action, editor) {
    const selected = selectedManuscript(editor);
    const { project, chapter } = activeData();
    if (!selected || !project || !chapter) return;
    pendingEdit = {
      projectId: project.id,
      chapterId: chapter.id,
      start: selected.start,
      end: selected.end,
      source: selected.text,
      action,
      baselineAiCount: document.querySelectorAll("#chat .row.ai").length,
      attached: false
    };
    fillComposer(editInstruction(action, selected.text));
    const bar = document.getElementById("v2ManuscriptAiBar");
    if (bar) bar.hidden = true;
  }

  function nearestOccurrence(text, source, expected) {
    if (!source) return -1;
    let best = -1;
    let bestDistance = Infinity;
    let from = 0;
    while (from <= text.length) {
      const index = text.indexOf(source, from);
      if (index < 0) break;
      const distance = Math.abs(index - expected);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
      from = index + Math.max(1, source.length);
    }
    return best;
  }

  function applyAiEdit(mode, responseText, buttonRow) {
    if (!pendingEdit) return;
    const { project, chapter } = activeData();
    const editor = document.getElementById("simpleManuscriptEditor");
    if (!project || !chapter || !editor || project.id !== pendingEdit.projectId || chapter.id !== pendingEdit.chapterId) {
      if (buttonRow) setText(buttonRow.querySelector(".v2-edit-result-note"), "请先回到原章节再应用");
      return;
    }

    const current = editor.value;
    let start = pendingEdit.start;
    let end = pendingEdit.end;
    if (current.slice(start, end).trim() !== pendingEdit.source) {
      const found = nearestOccurrence(current, pendingEdit.source, start);
      if (found < 0) {
        if (buttonRow) setText(buttonRow.querySelector(".v2-edit-result-note"), "原文已变化，无法自动定位");
        return;
      }
      start = found;
      end = found + pendingEdit.source.length;
    }

    const clean = String(responseText || "").trim();
    if (!clean) return;
    if (mode === "replace") {
      editor.setRangeText(clean, start, end, "end");
    } else {
      const insertion = `\n\n${clean}`;
      editor.setRangeText(insertion, end, end, "end");
    }
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    editor.scrollTop = Math.max(0, editor.scrollHeight - editor.clientHeight);
    showSaveState("已保存", "saved", 900);

    buttonRow?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    if (buttonRow) setText(buttonRow.querySelector(".v2-edit-result-note"), mode === "replace" ? "已替换原文" : "已插入原文后");
    pendingEdit = null;
  }

  function attachPendingEditResult() {
    if (!pendingEdit || pendingEdit.attached) return;
    const rows = Array.from(document.querySelectorAll("#chat .row.ai"));
    if (rows.length <= pendingEdit.baselineAiCount) return;
    const row = rows[rows.length - 1];
    const bubble = row?.querySelector(".bubble.ai");
    const tools = row?.querySelector(".message-tools");
    const text = String(bubble?.textContent || "").trim();
    if (!row || !bubble || !tools || !text || bubble.querySelector(".typing-indicator")) return;

    pendingEdit.attached = true;
    row.classList.add("v2-edit-result");
    if (tools.querySelector(".v2-edit-result-actions")) return;
    const actions = document.createElement("div");
    actions.className = "v2-edit-result-actions";
    actions.innerHTML = `<span class="v2-edit-result-note">应用到刚才选中的正文</span><button type="button" data-v2-apply="replace">替换原文</button><button type="button" data-v2-apply="insert">插入原文后</button>`;
    actions.querySelector('[data-v2-apply="replace"]').addEventListener("click", () => applyAiEdit("replace", text, actions));
    actions.querySelector('[data-v2-apply="insert"]').addEventListener("click", () => applyAiEdit("insert", text, actions));
    tools.appendChild(actions);
  }

  function schedulePendingResult() {
    clearTimeout(resultTimer);
    resultTimer = setTimeout(attachPendingEditResult, 650);
  }

  // V2.4 - Compact, readable character cards.
  function characterField(card, key) {
    return String(card.querySelector(`[data-character-profile-field="${key}"]`)?.value || "").trim();
  }

  function enhanceCharacters() {
    if (activeTab() !== "characters") return;
    const body = document.getElementById("studioPanelBody");
    if (!body) return;

    const form = body.querySelector("#characterForm");
    if (form) {
      const name = form.querySelector("#characterName");
      const role = form.querySelector("#characterRole");
      if (name) name.placeholder = "人物姓名";
      if (role) role.placeholder = "身份（可选）";
      setText(form.querySelector("#addCharacter"), "+ 添加人物");
    }

    body.querySelectorAll(".character-card[data-character-id]").forEach((card) => {
      const profile = card.querySelector(".simple-character-profile");
      if (!profile) return;
      const id = card.dataset.characterId;
      const personality = characterField(card, "personality");
      const goal = characterField(card, "goal");
      const state = characterField(card, "currentState");
      const hasDetails = [personality, goal, state, characterField(card, "appearance"), characterField(card, "voice"), characterField(card, "secret"), characterField(card, "notes")].some(Boolean);

      card.classList.add("v2-character-card");
      if (!hasDetails || expandedCharacters.has(id)) card.classList.add("v2-character-expanded");
      else card.classList.remove("v2-character-expanded");

      const identity = card.children[1];
      if (identity && !identity.querySelector(".v2-character-summary")) {
        const summary = document.createElement("div");
        summary.className = "v2-character-summary";
        identity.appendChild(summary);
      }
      const summary = identity?.querySelector(".v2-character-summary");
      if (summary) {
        const parts = [personality, goal, state].filter(Boolean).map((value) => value.replace(/\s+/g, " ").slice(0, 22));
        setText(summary, parts.length ? parts.join(" · ") : "补充性格和目标后，AI 会更稳定地把握这个人物");
      }

      let toggle = identity?.querySelector(".v2-character-toggle");
      if (identity && !toggle) {
        toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "v2-character-toggle";
        identity.appendChild(toggle);
        toggle.addEventListener("click", (event) => {
          event.stopPropagation();
          const open = !card.classList.contains("v2-character-expanded");
          card.classList.toggle("v2-character-expanded", open);
          if (open) expandedCharacters.add(id);
          else expandedCharacters.delete(id);
          setText(toggle, open ? "收起资料" : "展开资料");
        });
      }
      setText(toggle, card.classList.contains("v2-character-expanded") ? "收起资料" : "展开资料");

      const labels = {
        personality: "性格",
        appearance: "外貌",
        goal: "核心目标",
        voice: "说话特点",
        secret: "秘密",
        currentState: "当前状态",
        notes: "备注"
      };
      Object.entries(labels).forEach(([key, label]) => {
        setText(profile.querySelector(`[data-character-profile-field="${key}"]`)?.closest("label")?.querySelector("span"), label);
      });
    });

    const relation = body.querySelector(".relation-section");
    if (relation && relation.dataset.v2Compact !== "1") {
      relation.dataset.v2Compact = "1";
      const heading = relation.querySelector(".relation-heading");
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "v2-relation-toggle";
      toggle.textContent = "管理关系";
      toggle.addEventListener("click", () => {
        const open = relation.classList.toggle("v2-relations-open");
        setText(toggle, open ? "收起关系" : "管理关系");
      });
      heading?.appendChild(toggle);
    }
  }

  // V2.5 - Story-first outline hierarchy.
  function enhanceOutline() {
    if (activeTab() !== "outline") return;
    const body = document.getElementById("studioPanelBody");
    if (!body || body.dataset.v2OutlineReady === "1") return;
    body.dataset.v2OutlineReady = "1";

    const editorPane = body.querySelector(".editor-pane");
    const chapterEditor = body.querySelector(".chapter-editor");
    const description = body.querySelector('[data-project-field="description"]');
    const synopsis = body.querySelector('[data-project-field="synopsis"]');
    const outline = body.querySelector('[data-project-field="outline"]');

    const storyTitle = body.querySelector('.simple-section-title[data-section="story"]');
    if (storyTitle) {
      setText(storyTitle.querySelector("strong"), "整部故事");
      setText(storyTitle.querySelector("span"), "先写核心走向，细节可以边写边补");
      if (!storyTitle.querySelector("#v2OutlineAssist")) {
        const button = document.createElement("button");
        button.id = "v2OutlineAssist";
        button.type = "button";
        button.textContent = "让 AI 帮我构思";
        button.addEventListener("click", () => fillComposer("请结合当前已有的人物和设定，帮我梳理这部小说的核心故事走向。给出主角目标、主要冲突、关键转折和结局方向，结构清楚但不要写得过细，方便我继续修改。"));
        storyTitle.appendChild(button);
      }
    }

    const relabel = (field, label, placeholder) => {
      const labelNode = field?.closest("label");
      setText(labelNode?.querySelector("span"), label);
      if (field && placeholder) field.placeholder = placeholder;
    };
    relabel(description, "一句话故事", "这本书最核心讲什么？用一两句话写清楚即可");
    relabel(synopsis, "整体故事走向", "主角想要什么、会遇到什么阻力、故事大致如何发展");
    relabel(outline, "章节规划（可选）", "需要时再按章节记录关键事件，不必一开始就写得很细");

    if (chapterEditor) {
      chapterEditor.classList.add("v2-outline-chapter");
      setText(chapterEditor.querySelector(".chapter-editor-head span"), "CURRENT CHAPTER");
      const notes = chapterEditor.querySelector('[data-chapter-field="notes"]');
      relabel(notes, "这一章准备写什么？", "写清本章要发生的关键事件、转折或人物变化，几句话就够了");
      const target = chapterEditor.querySelector('[data-chapter-field="targetWords"]');
      relabel(target, "目标字数", "");

      const sessionSelect = chapterEditor.querySelector('[data-chapter-field="sessionId"]');
      sessionSelect?.closest("label")?.classList.add("v2-outline-hidden-meta");
      chapterEditor.querySelector(".chapter-manuscript")?.classList.add("v2-outline-legacy-clips");

      const summary = chapterEditor.querySelector('[data-chapter-field="summary"]');
      const summaryLabel = summary?.closest("label");
      if (summaryLabel && !chapterEditor.querySelector(".v2-outline-summary")) {
        const details = document.createElement("details");
        details.className = "v2-outline-summary";
        details.innerHTML = `<summary>章节摘要 <small>完成本章后会自动整理</small></summary>`;
        summaryLabel.before(details);
        details.appendChild(summaryLabel);
        setText(summaryLabel.querySelector("span"), "章节摘要");
        summary.placeholder = "系统会在完成章节后自动整理，也可以手动补充";
      }
    }

    if (editorPane && !editorPane.querySelector(".v2-outline-flow-note")) {
      const note = document.createElement("div");
      note.className = "v2-outline-flow-note";
      note.textContent = "推荐顺序：先写这一章要发生什么，再补整体故事走向。所有内容都会自动提供给 AI，不需要重复复制。";
      editorPane.prepend(note);
    }
  }

  function refresh() {
    enhanceShell();
    enhanceManuscript();
    enhanceCharacters();
    enhanceOutline();
  }

  function init() {
    refresh();

    const body = document.getElementById("studioPanelBody");
    if (body) {
      panelObserver = new MutationObserver(() => scheduleRefresh(20));
      panelObserver.observe(body, { childList: true, subtree: true });
    }

    const library = document.getElementById("studioLibrary");
    library?.addEventListener("click", () => scheduleRefresh(70));
    document.querySelector(".studio-tabs")?.addEventListener("click", () => scheduleRefresh(30));

    const chat = document.getElementById("chat");
    if (chat) {
      chatObserver = new MutationObserver(() => {
        enhanceConversationRows();
        schedulePendingResult();
      });
      chatObserver.observe(chat, { childList: true, subtree: true, characterData: true });
    }

    window.addEventListener("beforeunload", () => saveEditorView(document.getElementById("simpleManuscriptEditor")));
  }

  window.UnlimitedV2Product = {
    refresh: scheduleRefresh,
    focus: toggleFocusMode
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
