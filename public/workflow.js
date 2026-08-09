// public/workflow.js
// Simple end-to-end novel workflow: formal manuscript export, automatic backups,
// chapter completion, optional AI chapter summaries, and book-level statistics.
(() => {
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const LS_BACKUPS = "cfw_auto_backups_v1";
  const LS_WORKFLOW_META = "cfw_workflow_meta_v1";
  const BACKUP_LIMIT = 10;
  const BACKUP_INTERVAL_MS = 5 * 60 * 1000;
  const SUMMARY_MAX_CHARS = 24000;
  let refreshTimer = null;
  let observer = null;

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

  function readWorkspace() {
    const value = readJson(LS_STUDIO, {});
    return value && typeof value === "object" ? value : {};
  }

  function activeData() {
    const state = readWorkspace();
    const projects = Array.isArray(state.projects) ? state.projects : [];
    const project = projects.find((item) => item.id === state.activeProjectId) || projects[0] || null;
    const chapter = project?.chapters?.find((item) => item.id === state.activeChapterId) || null;
    return { state, project, chapter };
  }

  function countWords(text) {
    return String(text || "").replace(/\s/g, "").length;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function safeFilename(value) {
    return String(value || "novel").replace(/[\\/:*?"<>|]/g, "_").trim() || "novel";
  }

  function downloadText(filename, content, type = "text/plain;charset=utf-8") {
    const blob = new Blob(["\uFEFF", content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function formalChapters(project) {
    return (Array.isArray(project?.chapters) ? project.chapters : [])
      .map((chapter, index) => ({
        chapter,
        index,
        manuscript: String(chapter?.manuscript || "").trim()
      }))
      .filter((item) => item.manuscript);
  }

  function bookStats(project, chapter) {
    const chapters = Array.isArray(project?.chapters) ? project.chapters : [];
    const totalWords = chapters.reduce((sum, item) => sum + countWords(item?.manuscript), 0);
    const currentWords = countWords(chapter?.manuscript);
    const completed = chapters.filter((item) => item?.done).length;
    const targetWords = chapters.reduce((sum, item) => sum + Math.max(0, Number(item?.targetWords) || 0), 0);
    const progress = targetWords ? Math.min(100, Math.round(totalWords / targetWords * 100)) : 0;
    return { totalWords, currentWords, completed, total: chapters.length, targetWords, progress };
  }

  function bookText(project, markdown = false) {
    const chapters = formalChapters(project);
    if (!chapters.length) return "";
    const title = String(project?.name || "未命名小说").trim() || "未命名小说";
    const pieces = chapters.map(({ chapter, index, manuscript }) => {
      const chapterName = String(chapter?.name || `第 ${index + 1} 章`).trim();
      return markdown ? `## ${chapterName}\n\n${manuscript}` : `${chapterName}\n\n${manuscript}`;
    });
    return markdown ? `# ${title}\n\n${pieces.join("\n\n---\n\n")}` : `${title}\n\n${pieces.join("\n\n====================\n\n")}`;
  }

  function fingerprint(value) {
    const source = typeof value === "string" ? value : JSON.stringify(value || {});
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function readBackups() {
    const value = readJson(LS_BACKUPS, []);
    return Array.isArray(value) ? value : [];
  }

  function createBackup(reason = "自动备份", force = false) {
    const studio = readWorkspace();
    if (!Array.isArray(studio.projects) || !studio.projects.length) return false;
    const backups = readBackups();
    const hash = fingerprint(studio);
    if (!force && backups[0]?.fingerprint === hash) return false;

    const { project } = activeData();
    const snapshot = {
      id: `backup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      reason,
      projectName: project?.name || "未命名小说",
      totalWords: project ? bookStats(project, null).totalWords : 0,
      fingerprint: hash,
      studio
    };
    backups.unshift(snapshot);
    backups.splice(BACKUP_LIMIT);
    const saved = writeJson(LS_BACKUPS, backups);
    if (saved) scheduleRefresh();
    return saved;
  }

  function formatTime(timestamp) {
    try {
      return new Date(timestamp).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    } catch {
      return "未知时间";
    }
  }

  function workflowMeta() {
    const value = readJson(LS_WORKFLOW_META, {});
    return value && typeof value === "object" ? value : {};
  }

  function setChapterMeta(projectId, chapterId, patch) {
    const meta = workflowMeta();
    meta[projectId] = meta[projectId] && typeof meta[projectId] === "object" ? meta[projectId] : {};
    const current = meta[projectId][chapterId] && typeof meta[projectId][chapterId] === "object"
      ? meta[projectId][chapterId]
      : {};
    meta[projectId][chapterId] = { ...current, ...patch };
    writeJson(LS_WORKFLOW_META, meta);
  }

  function clearChapterMeta(projectId, chapterId) {
    const meta = workflowMeta();
    if (!meta[projectId]?.[chapterId]) return;
    delete meta[projectId][chapterId];
    if (!Object.keys(meta[projectId]).length) delete meta[projectId];
    writeJson(LS_WORKFLOW_META, meta);
  }

  function saveChapterFieldThroughStudio(field, value) {
    const body = document.getElementById("studioPanelBody");
    if (!body) return false;
    const control = document.createElement("textarea");
    control.hidden = true;
    control.dataset.chapterField = field;
    control.value = value;
    body.appendChild(control);
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.remove();
    return true;
  }

  function syncCurrentManuscript() {
    const editor = document.getElementById("simpleManuscriptEditor");
    if (!editor) return;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function toggleChapterComplete() {
    syncCurrentManuscript();
    const { project, chapter } = activeData();
    if (!project || !chapter) return;
    const words = countWords(chapter.manuscript);
    if (!chapter.done && !words) {
      alert("当前章节还没有正文，先写入正文后再标记完成。");
      return;
    }

    const item = document.querySelector(`#studioChapterList [data-chapter-id="${CSS.escape(chapter.id)}"]`);
    const statusButton = item?.querySelector(".chapter-status");
    if (!statusButton) {
      alert("没有找到章节状态按钮，请刷新页面后重试。");
      return;
    }

    const wasDone = Boolean(chapter.done);
    statusButton.click();
    if (wasDone) {
      clearChapterMeta(project.id, chapter.id);
    } else {
      setChapterMeta(project.id, chapter.id, {
        completedAt: Date.now(),
        finalWordCount: words
      });
      createBackup("完成章节", true);
    }
    setTimeout(scheduleRefresh, 40);
  }

  async function readSseText(response) {
    const reader = response.body?.getReader();
    if (!reader) return "";
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) full += delta;
        } catch {}
      }
    }

    if (buffer.startsWith("data: ")) {
      try {
        const parsed = JSON.parse(buffer.slice(6).trim());
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) full += delta;
      } catch {}
    }
    return full.trim();
  }

  async function generateChapterSummary(button) {
    syncCurrentManuscript();
    const { chapter } = activeData();
    if (!chapter) return;
    const manuscript = String(chapter.manuscript || "").trim();
    if (!manuscript) {
      alert("当前章节还没有正文，无法生成摘要。");
      return;
    }
    if (chapter.summary && !confirm("当前章节已经有摘要。要用 AI 重新生成并替换吗？")) return;

    const model = document.getElementById("modelSel")?.value;
    if (!model) {
      alert("没有检测到可用模型。");
      return;
    }

    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = "正在生成摘要…";

    try {
      const source = manuscript.length > SUMMARY_MAX_CHARS
        ? `${manuscript.slice(0, Math.floor(SUMMARY_MAX_CHARS * 0.7))}\n\n[中间正文过长，已省略]\n\n${manuscript.slice(-Math.floor(SUMMARY_MAX_CHARS * 0.3))}`
        : manuscript;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          use_builtin_persona: false,
          custom_system_prompt: "你是小说编辑。请准确总结章节已经发生的剧情事实，突出人物行动、关系变化、关键信息、伏笔推进和章节结尾状态。不要评价，不要续写，不要添加原文没有的事实。只输出一段可直接作为下一章上下文使用的中文章节摘要，控制在180到350字。",
          messages: [{ role: "user", content: `章节名：${chapter.name || "未命名章节"}\n\n正文：\n${source}` }]
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const summary = await readSseText(response);
      if (!summary) throw new Error("模型没有返回摘要");
      if (!saveChapterFieldThroughStudio("summary", summary)) throw new Error("摘要保存失败");
      createBackup("生成章节摘要", true);
      button.textContent = "摘要已保存";
      setTimeout(scheduleRefresh, 60);
    } catch (error) {
      alert(`生成摘要失败：${error.message}`);
      button.textContent = previousText;
    } finally {
      button.disabled = false;
      if (button.textContent === "正在生成摘要…") button.textContent = previousText;
    }
  }

  function restoreBackup(id) {
    const backups = readBackups();
    const target = backups.find((item) => item.id === id);
    if (!target?.studio) return;
    if (!confirm(`恢复到 ${formatTime(target.createdAt)} 的备份？当前内容会先自动保存一个“恢复前”备份。`)) return;
    createBackup("恢复前", true);
    if (!writeJson(LS_STUDIO, target.studio)) {
      alert("恢复失败：浏览器本地存储空间不足。");
      return;
    }
    location.reload();
  }

  function deleteBackup(id) {
    const backups = readBackups().filter((item) => item.id !== id);
    writeJson(LS_BACKUPS, backups);
    scheduleRefresh();
  }

  function renderBackupList() {
    const root = document.getElementById("workflowBackupList");
    if (!root) return;
    const backups = readBackups();
    root.innerHTML = backups.length ? backups.map((item) => `
      <div class="workflow-backup-item" data-backup-id="${escapeHtml(item.id)}">
        <div>
          <strong>${escapeHtml(formatTime(item.createdAt))}</strong>
          <span>${escapeHtml(item.reason || "自动备份")} · ${(Number(item.totalWords) || 0).toLocaleString()} 字</span>
        </div>
        <button class="workflow-restore-backup" type="button">恢复</button>
        <button class="workflow-delete-backup" type="button" title="删除备份">×</button>
      </div>`).join("") : `<p class="workflow-backup-empty">还没有备份。写作过程中会每 5 分钟自动保存一次变化。</p>`;
  }

  function renderWorkflow() {
    const pane = document.getElementById("simpleManuscriptPane");
    if (!pane || document.getElementById("workflowPanel")) return;
    const { project, chapter } = activeData();
    if (!project || !chapter) return;
    const stats = bookStats(project, chapter);
    const hasBook = formalChapters(project).length > 0;

    const section = document.createElement("section");
    section.id = "workflowPanel";
    section.className = "workflow-panel";
    section.innerHTML = `
      <div class="workflow-stats" aria-label="作品统计">
        <div><strong id="workflowTotalWords">${stats.totalWords.toLocaleString()}</strong><span>整本字数</span></div>
        <div><strong id="workflowCurrentWords">${stats.currentWords.toLocaleString()}</strong><span>当前章</span></div>
        <div><strong id="workflowCompleted">${stats.completed} / ${stats.total}</strong><span>完成章节</span></div>
        <div><strong id="workflowTarget">${stats.targetWords.toLocaleString()}</strong><span>目标字数</span></div>
      </div>
      <div class="workflow-progress"><i id="workflowProgressBar" style="width:${stats.progress}%"></i><span id="workflowProgressText">整书进度 ${stats.progress}%</span></div>
      <div class="workflow-actions">
        <button id="workflowCompleteChapter" class="primary" type="button">${chapter.done ? "取消完成" : "完成本章"}</button>
        <button id="workflowGenerateSummary" type="button"${stats.currentWords ? "" : " disabled"}>${chapter.summary ? "重新生成摘要" : "AI 生成章节摘要"}</button>
        <button id="workflowExportTxt" type="button"${hasBook ? "" : " disabled"}>整本 TXT</button>
        <button id="workflowExportMd" type="button"${hasBook ? "" : " disabled"}>整本 Markdown</button>
      </div>
      <details class="workflow-backups">
        <summary><span>自动备份与恢复</span><small>保留最近 ${BACKUP_LIMIT} 个版本</small></summary>
        <div class="workflow-backup-head"><span>每 5 分钟检测一次，有变化才保存</span><button id="workflowBackupNow" type="button">立即备份</button></div>
        <div id="workflowBackupList"></div>
      </details>`;
    pane.appendChild(section);
    renderBackupList();
  }

  function refreshWorkflow() {
    const panel = document.getElementById("workflowPanel");
    const { project, chapter } = activeData();
    if (!project || !chapter) {
      panel?.remove();
      return;
    }
    if (!panel) {
      renderWorkflow();
      return;
    }

    const stats = bookStats(project, chapter);
    const hasBook = formalChapters(project).length > 0;
    const setText = (id, value) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    };
    setText("workflowTotalWords", stats.totalWords.toLocaleString());
    setText("workflowCurrentWords", stats.currentWords.toLocaleString());
    setText("workflowCompleted", `${stats.completed} / ${stats.total}`);
    setText("workflowTarget", stats.targetWords.toLocaleString());
    setText("workflowProgressText", `整书进度 ${stats.progress}%`);
    const bar = document.getElementById("workflowProgressBar");
    if (bar) bar.style.width = `${stats.progress}%`;

    const complete = document.getElementById("workflowCompleteChapter");
    if (complete) complete.textContent = chapter.done ? "取消完成" : "完成本章";
    const summary = document.getElementById("workflowGenerateSummary");
    if (summary && summary.textContent !== "正在生成摘要…" && summary.textContent !== "摘要已保存") {
      summary.textContent = chapter.summary ? "重新生成摘要" : "AI 生成章节摘要";
      summary.disabled = !stats.currentWords;
    }
    const txt = document.getElementById("workflowExportTxt");
    const md = document.getElementById("workflowExportMd");
    if (txt) txt.disabled = !hasBook;
    if (md) md.disabled = !hasBook;
    renderBackupList();
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      renderWorkflow();
      refreshWorkflow();
    }, 40);
  }

  function bindEvents() {
    document.addEventListener("input", (event) => {
      if (event.target?.id === "simpleManuscriptEditor") scheduleRefresh();
    });

    document.addEventListener("click", (event) => {
      const complete = event.target.closest("#workflowCompleteChapter");
      if (complete) {
        toggleChapterComplete();
        return;
      }

      const summary = event.target.closest("#workflowGenerateSummary");
      if (summary) {
        generateChapterSummary(summary);
        return;
      }

      if (event.target.closest("#workflowExportTxt")) {
        const { project } = activeData();
        const content = bookText(project, false);
        if (content) downloadText(`${safeFilename(project.name)}.txt`, content);
        return;
      }

      if (event.target.closest("#workflowExportMd")) {
        const { project } = activeData();
        const content = bookText(project, true);
        if (content) downloadText(`${safeFilename(project.name)}.md`, content, "text/markdown;charset=utf-8");
        return;
      }

      if (event.target.closest("#workflowBackupNow")) {
        const saved = createBackup("手动备份", true);
        if (!saved) alert("备份失败：浏览器本地存储空间不足。");
        return;
      }

      const restore = event.target.closest(".workflow-restore-backup");
      if (restore) {
        restoreBackup(restore.closest("[data-backup-id]")?.dataset.backupId);
        return;
      }

      const remove = event.target.closest(".workflow-delete-backup");
      if (remove) deleteBackup(remove.closest("[data-backup-id]")?.dataset.backupId);
    });
  }

  function startAutomaticBackups() {
    setInterval(() => createBackup("自动备份"), BACKUP_INTERVAL_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") createBackup("自动备份");
    });
    window.addEventListener("beforeunload", () => createBackup("自动备份"));
  }

  function init() {
    bindEvents();
    startAutomaticBackups();
    const body = document.getElementById("studioPanelBody");
    if (body) {
      observer = new MutationObserver(scheduleRefresh);
      observer.observe(body, { childList: true, subtree: true });
    }
    document.getElementById("studioLibrary")?.addEventListener("click", () => setTimeout(scheduleRefresh, 70));
    document.querySelector(".studio-tabs")?.addEventListener("click", () => setTimeout(scheduleRefresh, 20));
    setTimeout(() => createBackup("自动备份"), 1200);
    scheduleRefresh();
  }

  window.UnlimitedWorkflow = {
    createBackup,
    bookText,
    bookStats,
    refresh: scheduleRefresh
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
