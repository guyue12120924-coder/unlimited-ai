// public/workspace-ui-v17.js
// V17.0: consolidated novel workspace UI (legacy V15.0 + V15.1 behavior).
(() => {
  const REVISION = "2026-08-21-v17.0-workspace-ui";
  const LS_STUDIO = "cfw_studio_workspace_v1";
  if (window.UnlimitedWorkspaceUIV17) return;

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

  function activeTab() {
    return document.querySelector(".studio-tabs [data-studio-tab].active")?.dataset.studioTab || "draft";
  }

  function isNovelMode() {
    return document.body?.dataset?.uaiMode === "novel";
  }

  function countChars(value) {
    return String(value || "").replace(/\s/g, "").length;
  }

  function filled(value) {
    return Boolean(String(value || "").trim());
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setText(node, value) {
    if (!node) return;
    const next = String(value ?? "");
    if (node.textContent !== next) node.textContent = next;
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
    return true;
  }

  function switchTab(tab) {
    const button = document.querySelector(`.studio-tabs [data-studio-tab="${tab}"]`);
    if (!button) return false;
    button.click();
    return true;
  }

  function ensureChapterCreation() {
    const add = document.getElementById("addChapter");
    if (!add) return false;
    const row = document.getElementById("chapterCreateRow");
    if (row?.hidden !== false) add.click();
    window.setTimeout(() => {
      const input = document.getElementById("chapterNameInput");
      if (!input) return;
      try { input.focus({ preventScroll: false }); } catch { input.focus(); }
    }, 30);
    return true;
  }

  function activateFirstChapter(after) {
    const item = document.querySelector("#studioChapterList .chapter-item[data-chapter-id]");
    if (!item) return false;
    const target = item.querySelector(".studio-item-main") || item;
    target.click();
    window.setTimeout(() => {
      switchTab("draft");
      after?.(activeData());
    }, 40);
    return true;
  }

  function promptFor(kind, data = activeData()) {
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

  function storyDeskPrompt(action) {
    const { project, chapter } = activeData();
    const projectName = project?.name || "当前作品";
    const chapterName = chapter?.name || "当前章节";
    const prompts = {
      "outline-ai": `请结合《${projectName}》当前已有的人物、设定和章节内容，帮我梳理整部小说的大纲。重点输出：核心矛盾、主线推进、关键转折、人物成长和结局方向。结构要简洁，可直接用于修改“故事梗概”和“总体大纲”，不要写成正文。`,
      "chapter-plan": `请结合《${projectName}》现有大纲、人物和设定，为“${chapterName}”设计一个可执行的章节计划。只需要本章目标、冲突、关键场景、人物变化和结尾钩子，避免空泛建议。`,
      "character-check": `请检查《${projectName}》当前人物设定是否足够支撑剧情。重点找出：人物目标不清、性格与行为矛盾、人物之间缺少冲突、说话方式过于相似等问题，并给出简洁修改建议。不要重写整部故事。`,
      "character-new": `请根据《${projectName}》当前大纲和已有角色，设计一个真正有剧情作用的新人物。给出姓名建议、角色定位、性格、核心目标、与现有人物的关系、说话特点，以及他/她为什么必须出现在故事里。`,
      "world-ai": `请结合《${projectName}》当前大纲、人物和已有设定，整理真正需要长期保持一致的世界设定。只保留世界背景、硬性规则、关键地点、重要组织和关键物品，避免百科式堆砌。`,
      "world-check": `请检查《${projectName}》当前世界设定、大纲、人物资料和已有章节之间是否存在矛盾或规则冲突。优先指出会导致后续剧情前后不一致的问题，并给出最小修改方案。`
    };
    return prompts[action] || "";
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
        <div class="novel-v15-context-copy"><span id="novelV15ProjectName">当前作品</span><strong id="novelV15ChapterName">尚未选择章节</strong></div>
      </div>
      <div class="novel-v15-context-progress" aria-label="章节写作进度"><span><i id="novelV15ProgressFill"></i></span><b id="novelV15WordProgress">0 / 3000 字</b></div>
      <div class="novel-v15-context-actions"><button type="button" data-novel-v15-action="draft">正文</button><button type="button" data-novel-v15-action="outline">大纲</button></div>`;
    const search = document.getElementById("conversationSearchBar");
    if (search?.parentElement === pane) search.insertAdjacentElement("afterend", bar);
    else pane.prepend(bar);
    return bar;
  }

  function updateComposerCount(textarea = document.getElementById("msg")) {
    const count = document.getElementById("novelV15ComposerCount");
    if (!count || !textarea) return;
    const length = String(textarea.value || "").length;
    count.hidden = length === 0;
    setText(count, length);
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
          <button type="button" data-novel-v15-prompt="continue">继续正文</button><button type="button" data-novel-v15-prompt="advance">推进剧情</button><button type="button" data-novel-v15-prompt="dialogue">写一段对话</button><button type="button" data-novel-v15-prompt="plan">规划本章</button>
        </div>
        <div class="novel-v15-context-note"><span aria-hidden="true">✦</span><p id="novelV15ContextNote">AI 会自动结合当前作品资料与章节上下文。</p><b id="novelV15ComposerCount" hidden>0</b></div>`;
      composer.prepend(assist);
    }
    if (textarea.dataset.novelV17Bound !== "1") {
      textarea.dataset.novelV17Bound = "1";
      textarea.addEventListener("focus", () => composer.classList.add("novel-v15-focused"));
      textarea.addEventListener("blur", () => composer.classList.remove("novel-v15-focused"));
      textarea.addEventListener("input", () => updateComposerCount(textarea));
    }
    updateComposerCount(textarea);
    return assist;
  }

  function ensureEmptyActions() {
    const empty = document.getElementById("emptyState");
    if (!empty) return null;
    let actions = empty.querySelector(".novel-v15-empty-actions");
    if (actions) return actions;
    actions = document.createElement("div");
    actions.className = "novel-v15-empty-actions";
    actions.innerHTML = `<button type="button" class="primary" data-novel-v15-empty="continue"><span>继续当前章节</span><b>→</b></button><button type="button" data-novel-v15-empty="plan">先规划这一章</button><button type="button" data-novel-v15-empty="characters">完善人物</button>`;
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
      setText(text, data.chapters.length ? "左侧已有章节。选择其中一章后，AI 会自动关联当前作品、人物和设定。" : "不用先把所有设定填完。创建一个章节，从第一幕开始写，之后再逐步补充人物和世界观。");
      setText(primary, data.chapters.length ? "选择章节" : "创建第一章");
      return;
    }
    const words = countChars(data.chapter.manuscript);
    setText(kicker, "CURRENT CHAPTER");
    setText(title, words ? `继续写「${data.chapter.name || "当前章节"}」` : `开始写「${data.chapter.name || "当前章节"}」`);
    setText(text, words ? `本章已经写了 ${words.toLocaleString()} 字。可以直接继续正文，也可以先让 AI 帮你推进剧情或整理本章结构。` : "这一章还没有正文。你可以先写第一段，也可以让 AI 根据现有设定给出一个简洁的起笔方案。");
    setText(primary, words ? "继续当前章节" : "开始这一章");
  }

  function updateContext(data) {
    const bar = ensureContextBar();
    ensureComposerAssist();
    if (!bar) return;
    const words = countChars(data.chapter?.manuscript);
    const target = Math.max(100, Number(data.chapter?.targetWords) || 3000);
    const percent = data.chapter ? clamp(words / target * 100, 0, 100) : 0;
    setText(document.getElementById("novelV15ProjectName"), data.project?.name || "当前作品");
    setText(document.getElementById("novelV15ChapterName"), data.chapter?.name || "尚未选择章节");
    const fill = document.getElementById("novelV15ProgressFill");
    if (fill) fill.style.width = `${percent.toFixed(1)}%`;
    setText(document.getElementById("novelV15WordProgress"), data.chapter ? `${words.toLocaleString()} / ${target.toLocaleString()} 字` : `${data.chapters.length} 个章节`);
    setText(document.getElementById("novelV15ContextNote"), data.chapter ? "AI 会自动参考作品设定、人物资料和当前章节正文末尾。" : "选择章节后，AI 会自动关联该章节与作品资料。");
    bar.classList.toggle("has-chapter", Boolean(data.chapter));
  }

  function guideModel(tab, data) {
    const chapterName = data.chapter?.name || "当前章节";
    const manuscriptChars = countChars(data.chapter?.manuscript);
    const target = Math.max(100, Number(data.chapter?.targetWords) || 3000);
    if (tab === "draft") return {
      step: "01 · WRITE",
      title: data.chapter ? `正文 · ${chapterName}` : "正文 · 先选一个章节",
      desc: data.chapter ? "把这里当成最终成稿区。直接写正文，或让 AI 在当前章节上下文里继续推进。" : "先从左侧选择章节。选中后，正文、字数目标和 AI 上下文会自动跟随。",
      metric: data.chapter ? `${manuscriptChars.toLocaleString()} / ${target.toLocaleString()} 字` : `${data.chapters.length} 个章节`,
      tone: manuscriptChars ? "good" : "neutral",
      actions: data.chapter ? [["continue", "AI 续写", "primary"], ["advance", "推进剧情", ""], ["outline", "看本章计划", ""]] : [["choose", data.chapters.length ? "选择章节" : "创建第一章", "primary"], ["outline", "先做大纲", ""]]
    };
    if (tab === "outline") {
      const ready = [data.project?.description, data.project?.synopsis, data.project?.outline].filter(filled).length;
      return { step: "02 · PLAN", title: "大纲 · 决定故事往哪里走", desc: "先保证“故事梗概”和“总体大纲”能说明主线，再补当前章节目标。不要为了完整而填满所有框。", metric: `核心资料 ${ready}/3`, tone: ready >= 2 ? "good" : "neutral", actions: [["outline-ai", "AI 梳理总纲", "primary"], ["chapter-plan", "设计本章", ""], ["draft", "回到正文", ""]] };
    }
    if (tab === "characters") {
      const characters = Array.isArray(data.project?.characters) ? data.project.characters : [];
      const useful = characters.filter((item) => filled(item?.personality) || filled(item?.goal) || filled(item?.voice) || filled(item?.note)).length;
      return { step: "03 · CAST", title: "人物 · 让每个人做事都有理由", desc: "优先填写性格、目标和说话方式。相关人物会自动作为隐藏上下文提供给 AI。", metric: `${characters.length} 人物 · ${useful} 已补充`, tone: characters.length && useful ? "good" : "neutral", actions: [["character-check", "AI 检查人物", "primary"], ["character-new", "设计新人物", ""], ["draft", "回到正文", ""]] };
    }
    const worldReady = ["worldOverview", "worldRules", "locations", "factions", "importantItems"].filter((key) => filled(data.project?.[key])).length;
    return { step: "04 · WORLD", title: "设定 · 只保存不能被写错的规则", desc: "世界背景和硬性规则最重要；地点、组织、物品在真正进入剧情以后再补。", metric: `关键设定 ${worldReady}/5`, tone: worldReady >= 2 ? "good" : "neutral", actions: [["world-ai", "AI 整理设定", "primary"], ["world-check", "检查矛盾", ""], ["draft", "回到正文", ""]] };
  }

  function ensureGuide() {
    const body = document.getElementById("studioPanelBody");
    if (!body) return null;
    let guide = document.getElementById("novelV151PanelGuide");
    if (guide?.parentElement === body) return guide;
    guide?.remove();
    guide = document.createElement("section");
    guide.id = "novelV151PanelGuide";
    guide.className = "novel-v151-guide";
    guide.innerHTML = `<div class="novel-v151-guide-copy"><span id="novelV151Step">STORY DESK</span><strong id="novelV151Title">创作台</strong><p id="novelV151Desc"></p></div><div class="novel-v151-guide-side"><span id="novelV151Metric" class="novel-v151-metric"></span><div id="novelV151Actions" class="novel-v151-actions"></div></div>`;
    body.prepend(guide);
    return guide;
  }

  function renderGuide(data) {
    const guide = ensureGuide();
    if (!guide) return;
    const tab = activeTab();
    if (!["draft", "outline", "characters", "world"].includes(tab)) {
      guide.hidden = true;
      return;
    }
    guide.hidden = false;
    guide.dataset.tab = tab;
    const model = guideModel(tab, data);
    setText(document.getElementById("novelV151Step"), model.step);
    setText(document.getElementById("novelV151Title"), model.title);
    setText(document.getElementById("novelV151Desc"), model.desc);
    const metric = document.getElementById("novelV151Metric");
    setText(metric, model.metric);
    if (metric) metric.dataset.tone = model.tone;
    const actions = document.getElementById("novelV151Actions");
    const signature = JSON.stringify(model.actions);
    if (actions && actions.dataset.signature !== signature) {
      actions.dataset.signature = signature;
      actions.innerHTML = model.actions.map(([action, label, kind]) => `<button type="button" data-v151-action="${action}" class="${kind || ""}">${label}</button>`).join("");
    }
  }

  function decorateFields() {
    const body = document.getElementById("studioPanelBody");
    if (!body) return;
    const tab = activeTab();
    body.querySelectorAll("textarea, input[type='text'], input:not([type])").forEach((field) => {
      if (field.closest("#novelV151PanelGuide")) return;
      const label = field.closest("label");
      label?.classList.toggle("novel-v151-filled", filled(field.value));
    });
    if (tab === "outline") {
      ["description", "synopsis", "outline"].forEach((key, index) => {
        const label = body.querySelector(`[data-project-field="${key}"]`)?.closest("label");
        if (label) label.dataset.v151Priority = index === 0 ? "support" : "core";
      });
      body.querySelector(".chapter-editor")?.setAttribute("data-v151-priority", "chapter");
    }
    if (tab === "characters") {
      setText(body.querySelector(".character-grid .studio-empty-state p"), "添加人物后，相关人物会在创作时自动作为隐藏上下文提供给 AI。");
      body.querySelectorAll(".character-card").forEach((card) => {
        let badge = card.querySelector(".novel-v151-character-badge");
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "novel-v151-character-badge";
          badge.setAttribute("aria-hidden", "true");
          card.appendChild(badge);
        }
        const fields = [...card.querySelectorAll("[data-character-profile-field]")];
        if (fields.length) {
          const ready = fields.filter((field) => filled(field.value)).length;
          setText(badge, `资料 ${ready}/${fields.length}`);
          badge.dataset.tone = ready >= Math.ceil(fields.length / 2) ? "good" : "neutral";
        } else {
          const note = card.querySelector("[data-character-note]")?.value || "";
          setText(badge, filled(note) ? "已补充" : "待完善");
          badge.dataset.tone = filled(note) ? "good" : "neutral";
        }
      });
    }
  }

  function chooseChapter() {
    if (activateFirstChapter()) return;
    ensureChapterCreation();
  }

  function storyDeskAction(action) {
    if (!action) return;
    if (["draft", "outline", "characters", "world"].includes(action)) return void switchTab(action);
    if (action === "choose") return void chooseChapter();
    if (action === "continue" || action === "advance") return void setComposer(promptFor(action));
    const prompt = storyDeskPrompt(action);
    if (prompt) setComposer(prompt);
  }

  function handleClick(event) {
    const topAction = event.target?.closest?.("[data-novel-v15-action]")?.dataset.novelV15Action;
    if (topAction) return void switchTab(topAction);
    const quickPrompt = event.target?.closest?.("[data-novel-v15-prompt]")?.dataset.novelV15Prompt;
    if (quickPrompt) {
      const data = activeData();
      if (!data.chapter) {
        if (quickPrompt === "plan") return void switchTab("outline");
        if (data.chapters.length) return void activateFirstChapter((next) => setComposer(promptFor(quickPrompt, next)));
        return void ensureChapterCreation();
      }
      return void setComposer(promptFor(quickPrompt, data));
    }
    const emptyAction = event.target?.closest?.("[data-novel-v15-empty]")?.dataset.novelV15Empty;
    if (emptyAction) {
      const data = activeData();
      if (emptyAction === "characters") return void switchTab("characters");
      if (emptyAction === "plan") return void (data.chapter ? setComposer(promptFor("plan", data)) : switchTab("outline"));
      if (!data.chapter) return void (data.chapters.length ? activateFirstChapter() : ensureChapterCreation());
      return void setComposer(promptFor("continue", data));
    }
    const deskAction = event.target?.closest?.("[data-v151-action]")?.dataset.v151Action;
    if (deskAction) storyDeskAction(deskAction);
  }

  function refresh() {
    refreshTimer = 0;
    if (!isNovelMode() || !document.getElementById("creativeWorkspace")) return;
    const data = activeData();
    ensureContextBar();
    ensureComposerAssist();
    ensureEmptyActions();
    updateEmptyState(data);
    updateContext(data);
    if (document.getElementById("studioPanelBody")) {
      renderGuide(data);
      decorateFields();
    }
    updateComposerCount();
    document.documentElement.dataset.novelWorkspaceRevision = REVISION;
    document.documentElement.dataset.novelStoryDeskRevision = REVISION;
  }

  function scheduleRefresh(delay = 20) {
    if (window.UnlimitedV3?.schedule && delay <= 20) {
      window.UnlimitedV3.schedule("v17-workspace-ui", refresh);
      return;
    }
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refresh, delay);
  }

  function install() {
    document.addEventListener("click", handleClick);
    window.addEventListener("storage", (event) => { if (event.key === LS_STUDIO) scheduleRefresh(10); });
    window.addEventListener("uai:workspace-refresh", () => scheduleRefresh(0));
    window.addEventListener("uai:mode-refresh", () => scheduleRefresh(0));
    scheduleRefresh(0);
  }

  const api = {
    revision: REVISION,
    refresh,
    fillPrompt: (kind) => setComposer(promptFor(kind)),
    action: storyDeskAction,
    promptFor,
    storyDeskPrompt
  };
  window.UnlimitedWorkspaceUIV17 = api;
  window.UnlimitedNovelWorkspaceV15 = { revision: REVISION, refresh, fill: api.fillPrompt };
  window.UnlimitedNovelWorkspaceV151 = { revision: REVISION, refresh, action: storyDeskAction };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
