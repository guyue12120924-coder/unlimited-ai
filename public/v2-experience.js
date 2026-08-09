// public/v2-experience.js
// V2 user-first experience: ready-to-write first run, light prompt shortcuts,
// contextual guidance, and quiet save/backup feedback.
(() => {
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LS_BACKUPS = "cfw_auto_backups_v1";
  const LS_FIRST_RUN = "cfw_v2_first_run_prepared";
  const PROMPTS = [
    {
      label: "帮我构思开头",
      text: "请根据当前小说已有的大纲、人物和设定，为当前章节写一个有吸引力的开头。直接给出可放进正文的内容，不要解释创作过程。"
    },
    {
      label: "按大纲写本章",
      text: "请结合当前章节目标、总体大纲、人物和世界设定，写当前章节接下来最合适的一段正文。保持人物行为和已有剧情一致，直接输出正文。"
    },
    {
      label: "续写正文",
      text: "请紧接当前章节已经写好的正文继续写下去。保持叙事视角、语气、人物状态和场景连续，不要重复已有内容，直接输出正文。"
    },
    {
      label: "润色这一段",
      text: "请润色下面这段小说文字。保留原意和剧情事实，改善语言、节奏、画面感和对白自然度，不要擅自增加新剧情：\n\n"
    },
    {
      label: "检查人物一致性",
      text: "请检查当前章节正文中的人物表现是否与人物卡中的性格、目标、关系和当前状态一致。只指出真正影响人物一致性的地方，并给出简短修改建议。"
    }
  ];

  let panelObserver = null;
  let saveTimer = null;
  let backupTimer = null;
  let lastBackupId = "";
  let prepareAttempts = 0;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readWorkspace() {
    const value = readJson(LS_STUDIO, {});
    return value && typeof value === "object" ? value : {};
  }

  function activeData() {
    const state = readWorkspace();
    const projects = Array.isArray(state.projects) ? state.projects : [];
    const project = projects.find((item) => item.id === state.activeProjectId) || projects[0] || null;
    const chapters = Array.isArray(project?.chapters) ? project.chapters : [];
    const chapter = chapters.find((item) => item.id === state.activeChapterId) || null;
    return { state, project, chapters, chapter };
  }

  function blank(value) {
    return !String(value || "").trim();
  }

  function isPristineProject(project) {
    if (!project || project.id !== "project-default") return false;
    const textFields = [
      project.description,
      project.synopsis,
      project.outline,
      project.world,
      project.worldOverview,
      project.worldRules,
      project.locations,
      project.factions,
      project.importantItems,
      project.notes,
      project.timeline,
      project.foreshadow
    ];
    return (project.name === "我的小说" || blank(project.name))
      && (!Array.isArray(project.chapters) || project.chapters.length === 0)
      && (!Array.isArray(project.characters) || project.characters.length === 0)
      && (!Array.isArray(project.relations) || project.relations.length === 0)
      && textFields.every(blank);
  }

  function createFirstChapter() {
    const add = document.getElementById("addChapter");
    const input = document.getElementById("chapterNameInput");
    const confirm = document.getElementById("confirmChapter");
    if (!add || !input || !confirm) return false;

    const row = document.getElementById("chapterCreateRow");
    if (row?.hidden) add.click();
    input.value = "第一章";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    confirm.click();
    return true;
  }

  function openDraftQuietly() {
    setTimeout(() => {
      const draft = document.querySelector('.studio-tabs [data-studio-tab="draft"]');
      if (draft && !draft.classList.contains("active")) draft.click();
    }, 80);
  }

  function prepareFirstRun() {
    if (localStorage.getItem(LS_FIRST_RUN) === "1") return;
    const { project } = activeData();
    const ready = document.getElementById("creativeWorkspace") && document.getElementById("addChapter");

    if (!ready || !project) {
      prepareAttempts += 1;
      if (prepareAttempts < 50) setTimeout(prepareFirstRun, 100);
      return;
    }

    // Existing work is never rewritten. Automatic preparation is only for the
    // untouched default project created by the app.
    if (isPristineProject(project)) {
      createFirstChapter();
      openDraftQuietly();
    }
    localStorage.setItem(LS_FIRST_RUN, "1");
  }

  function fillComposer(text) {
    const input = document.getElementById("msg");
    if (!input) return;
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    try { input.focus({ preventScroll: false }); } catch { input.focus(); }
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function ensurePromptShortcuts() {
    const empty = document.getElementById("emptyState");
    if (!empty || empty.querySelector("#v2PromptShortcuts")) return;

    const wrap = document.createElement("div");
    wrap.id = "v2PromptShortcuts";
    wrap.className = "v2-prompt-shortcuts";
    wrap.setAttribute("aria-label", "快捷创作");

    PROMPTS.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "v2-prompt-chip";
      button.textContent = item.label;
      button.addEventListener("click", () => fillComposer(item.text));
      wrap.appendChild(button);
    });
    empty.appendChild(wrap);
  }

  function activeTab() {
    return document.querySelector(".studio-tabs [data-studio-tab].active")?.dataset.studioTab || "";
  }

  function projectHasWorld(project) {
    return [
      project?.world,
      project?.worldOverview,
      project?.worldRules,
      project?.locations,
      project?.factions,
      project?.importantItems,
      project?.timeline,
      project?.foreshadow,
      project?.notes
    ].some((value) => !blank(value));
  }

  function hintForCurrentPanel() {
    const { project, chapter } = activeData();
    if (!project) return "";

    switch (activeTab()) {
      case "outline": {
        const hasOutline = [project.description, project.synopsis, project.outline, chapter?.notes, chapter?.summary]
          .some((value) => !blank(value));
        return hasOutline
          ? "这些内容会在需要时自动提供给 AI，不需要每次复制到聊天框。"
          : "大纲不是开始写作的前置条件。可以先直接写；有剧情规划时再补充，AI 会自动参考。";
      }
      case "characters":
        return Array.isArray(project.characters) && project.characters.length
          ? "人物卡会自动参与后续创作。优先填写性格、核心目标和当前状态就够了。"
          : "先添加主要人物即可。名字、身份和性格写清楚后，AI 就会自动参考，不需要把人物资料重复发给它。";
      case "world":
        return projectHasWorld(project)
          ? "设定会自动进入相关创作上下文。只写真正需要长期保持一致的规则即可。"
          : "设定不是必填项。需要固定世界规则、地点或重要物品时再写，保持简洁反而更好。";
      default:
        return "";
    }
  }

  function syncPanelHint() {
    const body = document.getElementById("studioPanelBody");
    if (!body) return;
    const text = hintForCurrentPanel();
    let hint = body.querySelector("#v2PanelHint");

    if (!text) {
      hint?.remove();
      return;
    }

    if (!hint) {
      hint = document.createElement("div");
      hint.id = "v2PanelHint";
      hint.className = "v2-panel-hint";
      body.prepend(hint);
    }
    if (hint.textContent !== text) hint.textContent = text;
  }

  function statusNode() {
    return document.getElementById("simpleManuscriptStatus");
  }

  function setSaveStatus(text, state = "saved") {
    const node = statusNode();
    if (!node) return;
    if (node.textContent !== text) node.textContent = text;
    node.dataset.saveState = state;
  }

  function confirmSaved(editor, attempt = 0) {
    const { chapter } = activeData();
    const stored = String(chapter?.manuscript || "");
    if (stored === String(editor?.value || "")) {
      setSaveStatus("已保存", "saved");
      return;
    }
    if (attempt >= 4) {
      setSaveStatus("自动保存中…", "saving");
      return;
    }
    saveTimer = setTimeout(() => confirmSaved(editor, attempt + 1), 120);
  }

  function onManuscriptInput(editor) {
    clearTimeout(saveTimer);
    setSaveStatus("保存中…", "saving");
    saveTimer = setTimeout(() => confirmSaved(editor), 180);
  }

  function currentBackupId() {
    const backups = readJson(LS_BACKUPS, []);
    return Array.isArray(backups) ? String(backups[0]?.id || "") : "";
  }

  function monitorBackups() {
    const current = currentBackupId();
    if (!current || current === lastBackupId) return;
    lastBackupId = current;

    const node = statusNode();
    if (!node || node.dataset.saveState === "saving") return;
    setSaveStatus("已安全备份", "backup");
    clearTimeout(backupTimer);
    backupTimer = setTimeout(() => setSaveStatus("已保存", "saved"), 1500);
  }

  function syncSaveStatus() {
    const node = statusNode();
    if (node && (!node.dataset.saveState || node.textContent === "自动保存")) {
      setSaveStatus("已保存", "saved");
    }
  }

  function refreshExperience() {
    ensurePromptShortcuts();
    syncPanelHint();
    syncSaveStatus();
  }

  function bindEvents() {
    document.addEventListener("input", (event) => {
      if (event.target?.id === "simpleManuscriptEditor") onManuscriptInput(event.target);
    }, true);

    document.querySelector(".studio-tabs")?.addEventListener("click", () => setTimeout(refreshExperience, 30));
    document.getElementById("studioLibrary")?.addEventListener("click", () => setTimeout(refreshExperience, 70));
  }

  function init() {
    bindEvents();
    ensurePromptShortcuts();
    prepareFirstRun();

    const body = document.getElementById("studioPanelBody");
    if (body) {
      panelObserver = new MutationObserver(() => setTimeout(refreshExperience, 0));
      panelObserver.observe(body, { childList: true, subtree: false });
    }

    lastBackupId = currentBackupId();
    setInterval(monitorBackups, 1400);
    setTimeout(refreshExperience, 80);
  }

  window.UnlimitedV2Experience = {
    refresh: refreshExperience,
    prepareFirstRun
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
