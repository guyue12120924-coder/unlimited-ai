// public/novel-workspace-v151.js
// V15.1: unified guidance and task hierarchy for Draft / Outline / Characters / World.
(() => {
  const REVISION = "2026-08-17-v15.1-story-desk";
  const LS_STUDIO = "cfw_studio_workspace_v1";
  if (window.UnlimitedNovelWorkspaceV151) return;

  let panelObserver = null;
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
    return document.body.dataset.uaiMode === "novel";
  }

  function countChars(value) {
    return String(value || "").replace(/\s/g, "").length;
  }

  function filled(value) {
    return Boolean(String(value || "").trim());
  }

  function setText(node, value) {
    if (!node) return;
    const next = String(value ?? "");
    if (node.textContent !== next) node.textContent = next;
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

  function switchTab(tab) {
    const button = document.querySelector(`.studio-tabs [data-studio-tab="${tab}"]`);
    button?.click();
  }

  function guideModel(tab, data) {
    const projectName = data.project?.name || "当前作品";
    const chapterName = data.chapter?.name || "当前章节";
    const manuscriptChars = countChars(data.chapter?.manuscript);
    const target = Math.max(100, Number(data.chapter?.targetWords) || 3000);

    if (tab === "draft") {
      return {
        step: "01 · WRITE",
        title: data.chapter ? `正文 · ${chapterName}` : "正文 · 先选一个章节",
        desc: data.chapter
          ? "把这里当成最终成稿区。直接写正文，或让 AI 在当前章节上下文里继续推进。"
          : "先从左侧选择章节。选中后，正文、字数目标和 AI 上下文会自动跟随。",
        metric: data.chapter ? `${manuscriptChars.toLocaleString()} / ${target.toLocaleString()} 字` : `${data.chapters.length} 个章节`,
        tone: manuscriptChars ? "good" : "neutral",
        actions: data.chapter
          ? [["continue", "AI 续写", "primary"], ["advance", "推进剧情", ""], ["outline", "看本章计划", ""]]
          : [["choose", data.chapters.length ? "选择章节" : "创建第一章", "primary"], ["outline", "先做大纲", ""]]
      };
    }

    if (tab === "outline") {
      const coreFields = [data.project?.description, data.project?.synopsis, data.project?.outline];
      const ready = coreFields.filter(filled).length;
      return {
        step: "02 · PLAN",
        title: "大纲 · 决定故事往哪里走",
        desc: "先保证“故事梗概”和“总体大纲”能说明主线，再补当前章节目标。不要为了完整而填满所有框。",
        metric: `核心资料 ${ready}/3`,
        tone: ready >= 2 ? "good" : "neutral",
        actions: [["outline-ai", "AI 梳理总纲", "primary"], ["chapter-plan", "设计本章", ""], ["draft", "回到正文", ""]]
      };
    }

    if (tab === "characters") {
      const characters = Array.isArray(data.project?.characters) ? data.project.characters : [];
      const useful = characters.filter((item) => filled(item?.personality) || filled(item?.goal) || filled(item?.voice) || filled(item?.note)).length;
      return {
        step: "03 · CAST",
        title: "人物 · 让每个人做事都有理由",
        desc: "优先填写性格、目标和说话方式。相关人物会自动作为隐藏上下文提供给 AI。",
        metric: `${characters.length} 人物 · ${useful} 已补充`,
        tone: characters.length && useful ? "good" : "neutral",
        actions: [["character-check", "AI 检查人物", "primary"], ["character-new", "设计新人物", ""], ["draft", "回到正文", ""]]
      };
    }

    const worldKeys = ["worldOverview", "worldRules", "locations", "factions", "importantItems"];
    const worldReady = worldKeys.filter((key) => filled(data.project?.[key])).length;
    return {
      step: "04 · WORLD",
      title: "设定 · 只保存不能被写错的规则",
      desc: "世界背景和硬性规则最重要；地点、组织、物品在真正进入剧情以后再补。",
      metric: `关键设定 ${worldReady}/5`,
      tone: worldReady >= 2 ? "good" : "neutral",
      actions: [["world-ai", "AI 整理设定", "primary"], ["world-check", "检查矛盾", ""], ["draft", "回到正文", ""]]
    };
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
    guide.innerHTML = `
      <div class="novel-v151-guide-copy">
        <span id="novelV151Step">STORY DESK</span>
        <strong id="novelV151Title">创作台</strong>
        <p id="novelV151Desc"></p>
      </div>
      <div class="novel-v151-guide-side">
        <span id="novelV151Metric" class="novel-v151-metric"></span>
        <div id="novelV151Actions" class="novel-v151-actions"></div>
      </div>`;
    body.prepend(guide);
    return guide;
  }

  function renderGuide() {
    if (!isNovelMode()) return;
    const guide = ensureGuide();
    if (!guide) return;
    const tab = activeTab();
    if (!["draft", "outline", "characters", "world"].includes(tab)) {
      guide.hidden = true;
      return;
    }

    guide.hidden = false;
    guide.dataset.tab = tab;
    const model = guideModel(tab, activeData());
    setText(document.getElementById("novelV151Step"), model.step);
    setText(document.getElementById("novelV151Title"), model.title);
    setText(document.getElementById("novelV151Desc"), model.desc);
    const metric = document.getElementById("novelV151Metric");
    setText(metric, model.metric);
    if (metric) metric.dataset.tone = model.tone;

    const actions = document.getElementById("novelV151Actions");
    if (actions) {
      const signature = JSON.stringify(model.actions);
      if (actions.dataset.signature !== signature) {
        actions.dataset.signature = signature;
        actions.innerHTML = model.actions.map(([action, label, kind]) =>
          `<button type="button" data-v151-action="${action}" class="${kind || ""}">${label}</button>`
        ).join("");
      }
    }
  }

  function decorateFields() {
    const body = document.getElementById("studioPanelBody");
    if (!body || !isNovelMode()) return;
    const tab = activeTab();

    body.querySelectorAll("textarea, input[type='text'], input:not([type])").forEach((field) => {
      if (field.closest("#novelV151PanelGuide")) return;
      const label = field.closest("label");
      if (!label) return;
      label.classList.toggle("novel-v151-filled", filled(field.value));
    });

    if (tab === "outline") {
      ["description", "synopsis", "outline"].forEach((key, index) => {
        const field = body.querySelector(`[data-project-field="${key}"]`);
        const label = field?.closest("label");
        if (!label) return;
        label.dataset.v151Priority = index === 0 ? "support" : "core";
      });
      body.querySelector(".chapter-editor")?.setAttribute("data-v151-priority", "chapter");
    }

    if (tab === "characters") {
      const emptyText = body.querySelector(".character-grid .studio-empty-state p");
      setText(emptyText, "添加人物后，相关人物会在创作时自动作为隐藏上下文提供给 AI。");

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

  function promptFor(action) {
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

  function chooseChapter() {
    const item = document.querySelector("#studioChapterList .chapter-item[data-chapter-id]");
    if (item) {
      item.click();
      window.setTimeout(() => switchTab("draft"), 45);
      return;
    }
    const add = document.getElementById("addChapter");
    const row = document.getElementById("chapterCreateRow");
    if (row?.hidden !== false) add?.click();
    window.setTimeout(() => document.getElementById("chapterNameInput")?.focus(), 25);
  }

  function handleAction(action) {
    if (!action) return;
    if (["draft", "outline", "characters", "world"].includes(action)) {
      switchTab(action);
      return;
    }
    if (action === "choose") {
      chooseChapter();
      return;
    }
    if (action === "continue" || action === "advance") {
      if (window.UnlimitedNovelWorkspaceV15?.fill) {
        window.UnlimitedNovelWorkspaceV15.fill(action);
      }
      return;
    }
    const prompt = promptFor(action);
    if (prompt) setComposer(prompt);
  }

  function refresh() {
    refreshTimer = 0;
    if (!isNovelMode()) return;
    if (!document.getElementById("studioPanelBody")) return;
    renderGuide();
    decorateFields();
    document.documentElement.dataset.novelStoryDeskRevision = REVISION;
  }

  function scheduleRefresh(delay = 25) {
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refresh, delay);
  }

  function install() {
    const body = document.getElementById("studioPanelBody");
    if (!body) {
      window.setTimeout(install, 80);
      return;
    }

    document.addEventListener("click", (event) => {
      const action = event.target?.closest?.("[data-v151-action]")?.dataset.v151Action;
      if (action) handleAction(action);
      if (event.target?.closest?.(".studio-tabs [data-studio-tab]")) scheduleRefresh(35);
    });

    body.addEventListener("input", () => scheduleRefresh(90));
    window.addEventListener("storage", (event) => {
      if (event.key === LS_STUDIO) scheduleRefresh(20);
    });

    panelObserver = new MutationObserver(() => scheduleRefresh(35));
    panelObserver.observe(body, { childList: true, subtree: true });
    scheduleRefresh(0);
  }

  window.UnlimitedNovelWorkspaceV151 = {
    revision: REVISION,
    refresh,
    action: handleAction
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();