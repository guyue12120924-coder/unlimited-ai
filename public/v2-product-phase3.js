// public/v2-product-phase3.js
// V2.11-V2.15: long-form performance, complete data safety, unified empty states,
// final interaction polish hooks, and runtime product diagnostics.
(() => {
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LS_BACKUPS = "cfw_auto_backups_v1";
  const LS_EDITOR_VIEW = "cfw_editor_view_v1";
  const BACKUP_FORMAT = "unlimited-ai-backup";
  const BACKUP_VERSION = 1;
  const LONG_CHAT_ROWS = 80;
  const LONG_BOOK_CHARS = 120000;
  let refreshTimer = null;
  let panelObserver = null;
  let chatObserver = null;
  let idleHandle = null;

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

  function activeData() {
    const state = readJson(LS_STUDIO, {});
    const projects = Array.isArray(state?.projects) ? state.projects : [];
    const project = projects.find((item) => item.id === state.activeProjectId) || projects[0] || null;
    const chapters = Array.isArray(project?.chapters) ? project.chapters : [];
    const chapter = chapters.find((item) => item.id === state.activeChapterId) || null;
    return { state, projects, project, chapters, chapter };
  }

  function activeTab() {
    return document.querySelector(".studio-tabs [data-studio-tab].active")?.dataset.studioTab || "draft";
  }

  function blank(value) {
    return !String(value || "").trim();
  }

  function countWords(text) {
    return String(text || "").replace(/\s/g, "").length;
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function scheduleRefresh(delay = 40) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, delay);
  }

  function scheduleIdle(task) {
    if (idleHandle) {
      if ("cancelIdleCallback" in window) cancelIdleCallback(idleHandle);
      else clearTimeout(idleHandle);
    }
    if ("requestIdleCallback" in window) {
      idleHandle = requestIdleCallback(() => {
        idleHandle = null;
        task();
      }, { timeout: 1200 });
    } else {
      idleHandle = setTimeout(() => {
        idleHandle = null;
        task();
      }, 180);
    }
  }

  function fillComposer(text) {
    const input = document.getElementById("msg");
    if (!input) return;
    input.value = String(text || "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    try { input.focus({ preventScroll: false }); } catch { input.focus(); }
    input.setSelectionRange(input.value.length, input.value.length);
  }

  // V2.11 — Keep long works responsive without changing their data.
  function totalBookChars(project) {
    return (Array.isArray(project?.chapters) ? project.chapters : [])
      .reduce((sum, chapter) => sum + countWords(chapter?.manuscript), 0);
  }

  function syncPerformanceMode() {
    const { project } = activeData();
    const chatRows = document.querySelectorAll("#chat .row").length;
    const longWork = chatRows >= LONG_CHAT_ROWS || totalBookChars(project) >= LONG_BOOK_CHARS;
    document.body.classList.toggle("v211-long-workspace", longWork);
    document.body.dataset.v211ChatRows = String(chatRows);
  }

  function trimEditorViewCache() {
    const { projects } = activeData();
    const valid = new Set();
    projects.forEach((project) => {
      (Array.isArray(project?.chapters) ? project.chapters : []).forEach((chapter) => {
        if (project?.id && chapter?.id) valid.add(`${project.id}:${chapter.id}`);
      });
    });
    const views = readJson(LS_EDITOR_VIEW, {});
    if (!views || typeof views !== "object") return;
    let changed = false;
    Object.keys(views).forEach((key) => {
      if (!valid.has(key)) {
        delete views[key];
        changed = true;
      }
    });
    if (changed) writeJson(LS_EDITOR_VIEW, views);
  }

  function scheduleMaintenance() {
    scheduleIdle(() => {
      syncPerformanceMode();
      trimEditorViewCache();
    });
  }

  // V2.12 — Complete, user-readable data backup.
  function collectLocalData() {
    const data = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("cfw_")) continue;
      data[key] = localStorage.getItem(key);
    }
    return data;
  }

  function backupPayload() {
    const data = collectLocalData();
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      appRevision: document.querySelector('meta[name="unlimited-frontend-revision"]')?.content || "",
      data
    };
  }

  function safeFilename(value) {
    return String(value || "我的小说").replace(/[\\/:*?"<>|]/g, "_").trim() || "我的小说";
  }

  function downloadBlob(filename, content, type = "application/json;charset=utf-8") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function exportCompleteBackup(prefix = "") {
    const { project } = activeData();
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
    const name = safeFilename(project?.name || "我的小说");
    const filename = `${name}-${prefix ? `${prefix}-` : ""}完整备份-${stamp}.json`;
    downloadBlob(filename, JSON.stringify(backupPayload(), null, 2));
    window.UnlimitedV2Phase2?.notify?.("完整备份已下载。", "success");
  }

  function storageSizeText() {
    try {
      const bytes = new Blob(Object.values(collectLocalData())).size;
      if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    } catch {
      return "未知";
    }
  }

  function dataHealth() {
    const problems = [];
    const state = readJson(LS_STUDIO, null);
    if (!state || typeof state !== "object") {
      problems.push("作品数据无法读取");
      return { ok: false, problems };
    }
    const projects = Array.isArray(state.projects) ? state.projects : [];
    if (!projects.length) problems.push("没有可用作品");
    const projectIds = new Set();
    projects.forEach((project) => {
      if (!project?.id) problems.push("存在缺少编号的作品");
      else if (projectIds.has(project.id)) problems.push("存在重复的作品编号");
      else projectIds.add(project.id);

      const chapterIds = new Set();
      (Array.isArray(project?.chapters) ? project.chapters : []).forEach((chapter) => {
        if (!chapter?.id) problems.push(`${project?.name || "作品"}中存在缺少编号的章节`);
        else if (chapterIds.has(chapter.id)) problems.push(`${project?.name || "作品"}中存在重复章节编号`);
        else chapterIds.add(chapter.id);
        if (chapter?.manuscript != null && typeof chapter.manuscript !== "string") {
          problems.push(`${chapter?.name || "章节"}正文格式异常`);
        }
      });
    });
    if (state.activeProjectId && !projects.some((project) => project.id === state.activeProjectId)) {
      problems.push("当前作品指向已失效");
    }
    const activeProject = projects.find((project) => project.id === state.activeProjectId) || projects[0];
    if (state.activeChapterId && !activeProject?.chapters?.some((chapter) => chapter.id === state.activeChapterId)) {
      problems.push("当前章节指向已失效");
    }
    return { ok: problems.length === 0, problems };
  }

  function validateBackup(payload) {
    if (!payload || payload.format !== BACKUP_FORMAT || !payload.data || typeof payload.data !== "object") {
      return "这不是 Unlimited AI 的完整备份文件。";
    }
    if (!payload.data[LS_STUDIO]) return "备份文件中没有作品数据。";
    try {
      const studio = JSON.parse(payload.data[LS_STUDIO]);
      if (!studio || !Array.isArray(studio.projects) || !studio.projects.length) {
        return "备份中的作品数据不完整。";
      }
    } catch {
      return "备份中的作品数据已损坏。";
    }
    return "";
  }

  function restoreLocalData(data) {
    const before = collectLocalData();
    try {
      Object.keys(before).forEach((key) => localStorage.removeItem(key));
      Object.entries(data).forEach(([key, value]) => {
        if (!key.startsWith("cfw_") || typeof value !== "string") return;
        localStorage.setItem(key, value);
      });
      return true;
    } catch (error) {
      try {
        Object.keys(collectLocalData()).forEach((key) => localStorage.removeItem(key));
        Object.entries(before).forEach(([key, value]) => localStorage.setItem(key, value));
      } catch {}
      console.warn("[Data Safety] restore rolled back", error);
      return false;
    }
  }

  async function importCompleteBackup(file) {
    if (!file) return;
    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      window.UnlimitedV2Phase2?.notify?.("无法读取这个备份文件，请确认文件没有损坏。", "error");
      return;
    }
    const problem = validateBackup(payload);
    if (problem) {
      window.UnlimitedV2Phase2?.notify?.(problem, "error");
      return;
    }
    if (!confirm("恢复完整备份会替换当前作品、对话和创作资料。系统会先自动下载一份当前数据作为恢复前备份。是否继续？")) return;
    exportCompleteBackup("恢复前");
    if (!restoreLocalData(payload.data)) {
      window.UnlimitedV2Phase2?.notify?.("恢复没有完成，原来的数据已经自动保留。", "error");
      return;
    }
    location.reload();
  }

  function backupCount() {
    const backups = readJson(LS_BACKUPS, []);
    return Array.isArray(backups) ? backups.length : 0;
  }

  function ensureDataSafetySection() {
    const settings = document.getElementById("settings");
    if (!settings || document.getElementById("v212DataSection")) return;
    const section = document.createElement("div");
    section.id = "v212DataSection";
    section.className = "settings-section v212-data-section";
    section.innerHTML = `
      <div class="section-heading">
        <div>
          <h3>数据与备份</h3>
          <p>正文会自动保存。需要换设备或长期保存时，下载一份完整备份即可。</p>
        </div>
      </div>
      <div class="v212-data-status">
        <div><span>本地数据</span><strong id="v212StorageSize">—</strong></div>
        <div><span>历史版本</span><strong id="v212BackupCount">—</strong></div>
        <div><span>完整性</span><strong id="v212Health">检查中</strong></div>
      </div>
      <div class="v212-data-actions">
        <button id="v212ExportBackup" type="button">导出完整备份</button>
        <button id="v212ImportBackup" type="button">导入完整备份</button>
        <input id="v212ImportFile" type="file" accept=".json,application/json" hidden />
      </div>
      <p class="v212-data-help">完整备份包含作品、章节、人物、设定、AI 对话和连续性资料。恢复前会自动保存当前副本。</p>`;
    const modeSection = document.getElementById("userFlowModeSection");
    if (modeSection) modeSection.before(section);
    else settings.appendChild(section);

    section.querySelector("#v212ExportBackup")?.addEventListener("click", () => exportCompleteBackup());
    const fileInput = section.querySelector("#v212ImportFile");
    section.querySelector("#v212ImportBackup")?.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (file) importCompleteBackup(file);
      fileInput.value = "";
    });
    refreshDataSafetyStatus();
  }

  function refreshDataSafetyStatus() {
    const size = document.getElementById("v212StorageSize");
    const count = document.getElementById("v212BackupCount");
    const healthNode = document.getElementById("v212Health");
    if (size) setText(size, storageSizeText());
    if (count) setText(count, `${backupCount()} 个`);
    if (healthNode) {
      const health = dataHealth();
      setText(healthNode, health.ok ? "数据正常" : "需要检查");
      healthNode.classList.toggle("warning", !health.ok);
      healthNode.title = health.ok ? "作品数据结构正常" : health.problems.join("；");
    }
  }

  // V2.13 — One consistent empty-state language.
  function enhanceDraftEmptyState() {
    if (activeTab() !== "draft") return;
    const editor = document.getElementById("simpleManuscriptEditor");
    const pane = document.getElementById("simpleManuscriptPane");
    if (!editor || !pane || editor.value.trim() || document.getElementById("v213DraftEmpty")) return;
    const box = document.createElement("div");
    box.id = "v213DraftEmpty";
    box.className = "v213-empty-inline v213-draft-empty";
    box.innerHTML = `<div><strong>这一章还没有正文</strong><p>可以直接开始写，也可以先让 AI 给你一个开头。</p></div><div><button type="button" data-action="write">直接开始写</button><button type="button" class="primary" data-action="ai">帮我写开头</button></div>`;
    box.querySelector('[data-action="write"]')?.addEventListener("click", () => editor.focus());
    box.querySelector('[data-action="ai"]')?.addEventListener("click", () => {
      fillComposer("请根据当前章节计划、人物、大纲和设定，为这一章写一个自然、有吸引力的开头。直接输出可以放进正文的小说内容，不要解释创作过程。");
    });
    editor.before(box);
  }

  function enhanceCharacterEmptyState() {
    if (activeTab() !== "characters") return;
    const body = document.getElementById("studioPanelBody");
    const { project } = activeData();
    if (!body || (Array.isArray(project?.characters) && project.characters.length)) return;
    const empty = body.querySelector(".studio-empty-state");
    if (!empty) return;
    setText(empty.querySelector("strong"), "还没有人物");
    setText(empty.querySelector("p"), "先添加主要人物即可。名字、身份和性格写清楚后，AI 会自动参考。");
    if (!empty.querySelector(".v213-empty-action")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "v213-empty-action";
      button.textContent = "添加第一个人物";
      button.addEventListener("click", () => document.getElementById("characterName")?.focus());
      empty.appendChild(button);
    }
  }

  function enhanceOutlineEmptyState() {
    if (activeTab() !== "outline") return;
    const body = document.getElementById("studioPanelBody");
    const { project, chapter } = activeData();
    if (!body || !project) return;
    const hasStory = [project.description, project.synopsis, project.outline, chapter?.notes].some((value) => !blank(value));
    document.getElementById("v213OutlineEmpty")?.toggleAttribute("hidden", hasStory);
    if (hasStory || document.getElementById("v213OutlineEmpty")) return;
    const pane = body.querySelector(".editor-pane");
    const anchor = pane?.querySelector(".v2-outline-flow-note");
    const box = document.createElement("div");
    box.id = "v213OutlineEmpty";
    box.className = "v213-empty-inline";
    box.innerHTML = `<div><strong>还没有大纲</strong><p>可以直接写正文；如果已经有故事想法，让 AI 帮你整理成简单的大纲。</p></div><button type="button">让 AI 帮我构思</button>`;
    box.querySelector("button")?.addEventListener("click", () => document.getElementById("v2OutlineAssist")?.click());
    anchor?.after(box);
  }

  function enhanceWorldEmptyState() {
    if (activeTab() !== "world") return;
    const body = document.getElementById("studioPanelBody");
    const fields = Array.from(body?.querySelectorAll("[data-world-field]") || []);
    if (!body || !fields.length) return;
    const hasWorld = fields.some((field) => !blank(field.value));
    document.getElementById("v213WorldEmpty")?.toggleAttribute("hidden", hasWorld);
    if (hasWorld || document.getElementById("v213WorldEmpty")) return;
    const wrapper = body.querySelector(".v26-world-card") || body.querySelector(".simple-world-fields");
    const title = wrapper?.querySelector(".simple-section-title");
    const box = document.createElement("div");
    box.id = "v213WorldEmpty";
    box.className = "v213-empty-inline";
    box.innerHTML = `<div><strong>还没有设定</strong><p>设定不是必填。只有存在不能写错的世界规则时再补充即可。</p></div><button type="button">让 AI 帮我整理</button>`;
    box.querySelector("button")?.addEventListener("click", () => document.getElementById("v26WorldAssist")?.click());
    title?.after(box);
  }

  function syncDraftEmptyState() {
    const editor = document.getElementById("simpleManuscriptEditor");
    if (!editor) return;
    if (editor.value.trim()) document.getElementById("v213DraftEmpty")?.remove();
    else enhanceDraftEmptyState();
  }

  // V2.15 — Runtime diagnostics for the actual browser build.
  function runDiagnostics() {
    const checks = [];
    const check = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail });
    const health = dataHealth();
    check("工作区已加载", document.getElementById("creativeWorkspace"));
    check("四个创作标签存在", document.querySelectorAll('.studio-tabs [data-studio-tab]:not([hidden])').length === 4);
    check("AI 输入框可用", document.getElementById("msg") && document.getElementById("sendBtn"));
    check("章节工作流可用", document.getElementById("addChapter") && document.getElementById("studioChapterList"));
    check("完整备份入口存在", document.getElementById("v212ExportBackup") && document.getElementById("v212ImportBackup"));
    check("移动端导航已准备", document.getElementById("v210MobileNav"));
    check("作品数据完整", health.ok, health.problems.join("；"));
    const result = { passed: checks.every((item) => item.pass), checks, checkedAt: new Date().toISOString() };
    console.groupCollapsed(`[Unlimited AI] 产品自检：${result.passed ? "通过" : "需要检查"}`);
    checks.forEach((item) => console[item.pass ? "log" : "warn"](`${item.pass ? "✓" : "✗"} ${item.name}`, item.detail || ""));
    console.groupEnd();
    return result;
  }

  function refresh() {
    syncPerformanceMode();
    ensureDataSafetySection();
    refreshDataSafetyStatus();
    enhanceDraftEmptyState();
    enhanceCharacterEmptyState();
    enhanceOutlineEmptyState();
    enhanceWorldEmptyState();
    syncDraftEmptyState();
  }

  function init() {
    document.body.classList.add("v215-polished");
    ensureDataSafetySection();
    refresh();

    const body = document.getElementById("studioPanelBody");
    if (body) {
      panelObserver = new MutationObserver(() => scheduleRefresh(35));
      panelObserver.observe(body, { childList: true, subtree: false });
    }

    const chat = document.getElementById("chat");
    if (chat) {
      chatObserver = new MutationObserver(() => scheduleMaintenance());
      chatObserver.observe(chat, { childList: true, subtree: false });
    }

    document.addEventListener("input", (event) => {
      if (event.target?.id !== "simpleManuscriptEditor") return;
      if (event.target.value.trim()) document.getElementById("v213DraftEmpty")?.remove();
      else scheduleRefresh(30);
    }, true);
    document.querySelector(".studio-tabs")?.addEventListener("click", () => scheduleRefresh(50));
    document.getElementById("studioLibrary")?.addEventListener("click", () => scheduleRefresh(90));
    document.getElementById("settingsBtn")?.addEventListener("click", () => setTimeout(() => {
      ensureDataSafetySection();
      refreshDataSafetyStatus();
    }, 30));
    window.addEventListener("resize", scheduleMaintenance, { passive: true });

    scheduleMaintenance();
    setTimeout(runDiagnostics, 1400);
  }

  window.UnlimitedProductDiagnostics = {
    run: runDiagnostics,
    dataHealth,
    exportBackup: exportCompleteBackup
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();