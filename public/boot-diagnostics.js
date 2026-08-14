// public/boot-diagnostics.js
// Startup guard + dual-mode bootstrap. The existing novel workspace still boots
// normally behind the mode lobby so old data and feature adapters remain intact.
(() => {
  const REVISION = "2026-08-14-v9.2-dual-mode-1";
  const errors = [];

  document.documentElement.dataset.frontendRevision = REVISION;
  document.documentElement.classList.add("uai-mode-gate-pending");
  window.__UNLIMITED_BOOT__ = { revision: REVISION, startedAt: Date.now(), errors };

  const gateStyle = document.createElement("style");
  gateStyle.id = "uaiModeGateCriticalCss";
  gateStyle.textContent = `
    html.uai-mode-gate-pending #app { visibility: hidden !important; pointer-events: none !important; }
    html.uai-mode-gate-pending body { background: #0d0f14 !important; }
  `;
  document.head.appendChild(gateStyle);

  function ensureStyle(href, id) {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function ensureScript(src, id) {
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.addEventListener("error", () => errors.push(`资源加载失败：${src}`), { once: true });
    document.body.appendChild(script);
  }

  function describeError(event) {
    if (event?.reason) return event.reason?.stack || event.reason?.message || String(event.reason);
    const message = event?.error?.stack || event?.error?.message || event?.message || "Unknown frontend error";
    const location = event?.filename
      ? `\n位置：${event.filename}${event.lineno ? `:${event.lineno}` : ""}${event.colno ? `:${event.colno}` : ""}`
      : "";
    return `${message}${location}`;
  }

  window.addEventListener("error", (event) => errors.push(describeError(event)), true);
  window.addEventListener("unhandledrejection", (event) => errors.push(describeError(event)));

  function showFailure(message) {
    if (document.getElementById("frontendBootFailure")) return;
    const panel = document.createElement("div");
    panel.id = "frontendBootFailure";
    panel.setAttribute("role", "alert");
    panel.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:99999;max-width:620px;padding:12px 14px;border:1px solid rgba(239,140,130,.55);border-radius:10px;background:rgba(30,16,16,.96);color:#ffe8e5;box-shadow:0 18px 50px rgba(0,0,0,.45);font:12px/1.55 system-ui,sans-serif;white-space:pre-wrap;word-break:break-all";
    panel.textContent = `前端初始化失败（${REVISION}）\n${message}`;
    document.body.appendChild(panel);
  }

  function loadModeRouter() {
    ensureStyle(`/mode-router.css?v=${REVISION}`, "uaiModeRouterCss");
    ensureStyle(`/companion-mode.css?v=${REVISION}`, "uaiCompanionCss");
    ensureStyle(`/companion-characters.css?v=${REVISION}`, "uaiCompanionCharactersCss");
    ensureStyle(`/companion-memory.css?v=${REVISION}`, "uaiCompanionMemoryCss");
    ensureStyle(`/companion-records.css?v=${REVISION}`, "uaiCompanionRecordsCss");
    ensureStyle(`/companion-profile-editor.css?v=${REVISION}`, "uaiCompanionProfileEditorCss");
    ensureStyle(`/companion-v9.css?v=${REVISION}`, "uaiCompanionV9Css");

    ensureScript(`/companion-characters-core.js?v=${REVISION}`, "uaiCompanionCharactersCoreScript");
    ensureScript(`/companion-memory.js?v=${REVISION}`, "uaiCompanionMemoryScript");
    ensureScript(`/companion-records.js?v=${REVISION}`, "uaiCompanionRecordsScript");
    ensureScript(`/companion-characters-ui.js?v=${REVISION}`, "uaiCompanionCharactersUiScript");
    ensureScript(`/companion-runtime.js?v=${REVISION}`, "uaiCompanionRuntimeScript");
    ensureScript(`/companion-extras.js?v=${REVISION}`, "uaiCompanionExtrasScript");
    ensureScript(`/companion-v9-shell.js?v=${REVISION}`, "uaiCompanionV9ShellScript");

    if (document.getElementById("uaiModeRouterScript")) return;
    const script = document.createElement("script");
    script.id = "uaiModeRouterScript";
    script.src = `/mode-router.js?v=${REVISION}`;
    script.async = true;
    script.addEventListener("error", () => {
      document.documentElement.classList.remove("uai-mode-gate-pending");
      document.body.dataset.uaiMode = "novel";
      showFailure("模式选择模块加载失败，已回退到原小说工作台。刷新页面后可重试。");
    }, { once: true });
    document.body.appendChild(script);
  }

  function verifyBoot() {
    const expected = [
      ["uaiModeRoot", "模式选择大厅"],
      ["creativeWorkspace", "创作工作区"],
      ["contextInspectorBtn", "上下文"],
      ["continuityBtn", "连续性"],
      ["storyMemoryBtn", "记忆"]
    ];
    const missing = expected.filter(([id]) => !document.getElementById(id));
    if (!missing.length && !errors.length) {
      window.__UNLIMITED_BOOT__.ready = true;
      window.__UNLIMITED_BOOT__.modeRouterReady = Boolean(window.UnlimitedModeRouter);
      window.__UNLIMITED_BOOT__.companionMultiReady = Boolean(window.UnlimitedCompanionMulti);
      window.__UNLIMITED_BOOT__.companionRuntimeReady = Boolean(window.UnlimitedCompanionRuntime);
      window.__UNLIMITED_BOOT__.companionMemorySearchReady = Boolean(window.UnlimitedCompanionMemorySearch);
      window.__UNLIMITED_BOOT__.companionProfileRestoreReady = Boolean(window.UnlimitedCompanionProfileRestore);
      window.__UNLIMITED_BOOT__.companionCharacterControlsReady = Boolean(window.UnlimitedCompanionCharacterControls);
      window.__UNLIMITED_BOOT__.companionExtrasReady = Boolean(window.UnlimitedCompanionExtras);
      window.__UNLIMITED_BOOT__.companionV9ShellReady = Boolean(window.UnlimitedCompanionV9Shell);
      return;
    }
    const parts = [];
    if (missing.length) parts.push(`缺少：${missing.map(([, label]) => label).join("、")}`);
    if (errors.length) parts.push(`捕获到的错误：\n${errors.slice(0, 8).join("\n\n")}`);
    showFailure(parts.join("\n"));
  }

  loadModeRouter();
  const schedule = () => window.setTimeout(verifyBoot, 4000);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule, { once: true });
  else schedule();
})();