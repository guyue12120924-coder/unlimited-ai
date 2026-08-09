// public/boot-diagnostics.js
// Captures startup failures so the UI never silently falls back to the base chat shell.
(() => {
  const REVISION = "2026-08-09-v1.4-manuscript-interaction-2";
  const errors = [];

  document.documentElement.dataset.frontendRevision = REVISION;
  window.__UNLIMITED_BOOT__ = {
    revision: REVISION,
    startedAt: Date.now(),
    errors
  };

  function describeError(event) {
    if (event?.reason) {
      return event.reason?.stack || event.reason?.message || String(event.reason);
    }

    const message = event?.error?.stack || event?.error?.message || event?.message || "Unknown frontend error";
    const location = event?.filename
      ? `\n位置：${event.filename}${event.lineno ? `:${event.lineno}` : ""}${event.colno ? `:${event.colno}` : ""}`
      : "";
    return `${message}${location}`;
  }

  window.addEventListener("error", (event) => {
    errors.push(describeError(event));
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    errors.push(describeError(event));
  });

  function showFailure(message) {
    if (document.getElementById("frontendBootFailure")) return;
    const panel = document.createElement("div");
    panel.id = "frontendBootFailure";
    panel.setAttribute("role", "alert");
    panel.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "z-index:99999",
      "max-width:620px",
      "padding:12px 14px",
      "border:1px solid rgba(239,140,130,.55)",
      "border-radius:10px",
      "background:rgba(30,16,16,.96)",
      "color:#ffe8e5",
      "box-shadow:0 18px 50px rgba(0,0,0,.45)",
      "font:12px/1.55 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "white-space:pre-wrap",
      "word-break:break-all"
    ].join(";");
    panel.textContent = `前端初始化失败（${REVISION}）\n${message}`;
    document.body.appendChild(panel);
  }

  function manuscriptInteractionIssues() {
    const editor = document.getElementById("chapterManuscriptEditor");
    if (!editor) return [];
    const issues = [];
    if (editor.disabled) issues.push("正文编辑器处于 disabled 状态");
    if (editor.readOnly) issues.push("正文编辑器处于 readOnly 状态");
    if (editor.tabIndex < 0) issues.push("正文编辑器无法通过焦点导航进入");
    const style = getComputedStyle(editor);
    if (style.pointerEvents === "none") issues.push("正文编辑器 pointer-events=none");
    if (style.visibility === "hidden" || style.display === "none") issues.push("正文编辑器被 CSS 隐藏");
    return issues;
  }

  function verifyBoot() {
    const expected = [
      ["creativeWorkspace", "创作工作区"],
      ["manuscriptWorkspace", "章节正文"],
      ["manuscriptAiReviewMask", "正文 AI 编辑器"],
      ["manuscriptInteractionReady", "正文交互层"],
      ["contextInspectorBtn", "上下文"],
      ["continuityBtn", "连续性"],
      ["storyMemoryBtn", "记忆"]
    ];
    const missing = expected.filter(([id]) => !document.getElementById(id));
    const interactionIssues = manuscriptInteractionIssues();
    if (!missing.length && !errors.length && !interactionIssues.length) {
      window.__UNLIMITED_BOOT__.ready = true;
      return;
    }

    const parts = [];
    if (missing.length) parts.push(`缺少：${missing.map(([, label]) => label).join("、")}`);
    if (interactionIssues.length) parts.push(`正文交互异常：${interactionIssues.join("；")}`);
    if (!missing.length && !interactionIssues.length && errors.length) {
      parts.push("界面组件已挂载，但启动阶段检测到 JavaScript 错误。");
    }

    const details = errors.length
      ? `\n捕获到的错误：\n${errors.slice(0, 8).join("\n\n")}`
      : "";
    showFailure(`${parts.join("\n")}${details}`);
  }

  function scheduleVerification() {
    window.setTimeout(verifyBoot, 2800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleVerification, { once: true });
  } else {
    scheduleVerification();
  }
})();