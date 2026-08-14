// public/boot-diagnostics.js
// Startup guard + dual-mode bootstrap.
(() => {
  const REVISION = "2026-08-14-v12.9-live2d-1";
  // Diagnostics compatibility markers: 2026-08-14-v12.4-dual-mode-1 / 2026-08-14-v12.3-dual-mode-1 / 2026-08-14-v12.2-dual-mode-1 / 2026-08-14-v12.1-dual-mode-1 / 2026-08-14-v12.0-dual-mode-1 / 2026-08-14-v11.6-dual-mode-1
  const errors = [];

  document.documentElement.dataset.frontendRevision = REVISION;
  document.documentElement.classList.add("uai-mode-gate-pending");
  window.__UNLIMITED_BOOT__ = { revision: REVISION, startedAt: Date.now(), errors };

  const gateStyle = document.createElement("style");
  gateStyle.id = "uaiModeGateCriticalCss";
  gateStyle.textContent = `
    html.uai-mode-gate-pending #app { visibility: hidden !important; pointer-events: none !important; }
    html.uai-mode-gate-pending body { background: #080817 !important; }
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
    script.async = false;
    script.src = src;
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
    ensureStyle(`/companion-support.css?v=${REVISION}`, "uaiCompanionSupportCss");
    ensureStyle(`/companion-v10.css?v=${REVISION}`, "uaiCompanionV10Css");
    ensureStyle(`/companion-v10-vibrant.css?v=${REVISION}`, "uaiCompanionV10VibrantCss");
    ensureStyle(`/companion-v10-stage2.css?v=${REVISION}`, "uaiCompanionV10Stage2Css");
    ensureStyle(`/companion-v10-stage3.css?v=${REVISION}`, "uaiCompanionV10Stage3Css");
    ensureStyle(`/companion-v10-stage4.css?v=${REVISION}`, "uaiCompanionV10Stage4Css");
    ensureStyle(`/companion-v10-stage5.css?v=${REVISION}`, "uaiCompanionV10Stage5Css");
    ensureStyle(`/companion-v10-stage6.css?v=${REVISION}`, "uaiCompanionV10Stage6Css");
    ensureStyle(`/companion-v11.css?v=${REVISION}`, "uaiCompanionV11Css");
    ensureStyle(`/companion-v11-stage1.css?v=${REVISION}`, "uaiCompanionV11Stage1Css");
    ensureStyle(`/companion-v11-stage2.css?v=${REVISION}`, "uaiCompanionV11Stage2Css");
    ensureStyle(`/companion-v11-stage3.css?v=${REVISION}`, "uaiCompanionV11Stage3Css");
    ensureStyle(`/companion-v11-stage4.css?v=${REVISION}`, "uaiCompanionV11Stage4Css");
    ensureStyle(`/companion-v12-galaxy.css?v=${REVISION}`, "uaiCompanionV12GalaxyCss");
    ensureStyle(`/companion-v12-stage2.css?v=${REVISION}`, "uaiCompanionV12Stage2Css");
    ensureStyle(`/companion-v12-final.css?v=${REVISION}`, "uaiCompanionV12FinalCss");
    ensureStyle(`/companion-v12-polish.css?v=${REVISION}`, "uaiCompanionV12PolishCss");
    ensureStyle(`/companion-v12-phase1.css?v=${REVISION}`, "uaiCompanionV12Phase1Css");
    ensureStyle(`/companion-live2d.css?v=${REVISION}`, "uaiCompanionLive2dCss");

    ensureScript(`/companion-characters-core.js?v=${REVISION}`, "uaiCompanionCharactersCoreScript");
    ensureScript(`/companion-character-editor.js?v=${REVISION}`, "uaiCompanionCharacterEditorScript");
    ensureScript(`/companion-memory.js?v=${REVISION}`, "uaiCompanionMemoryScript");
    ensureScript(`/companion-records.js?v=${REVISION}`, "uaiCompanionRecordsScript");
    ensureScript(`/companion-settings.js?v=${REVISION}`, "uaiCompanionSettingsScript");
    ensureScript(`/companion-runtime.js?v=${REVISION}`, "uaiCompanionRuntimeScript");
    ensureScript(`/companion-extras.js?v=${REVISION}`, "uaiCompanionExtrasScript");
    ensureScript(`/companion-v10-shell.js?v=${REVISION}`, "uaiCompanionV10ShellScript");
    ensureScript(`/companion-v10-stage2.js?v=${REVISION}`, "uaiCompanionV10Stage2Script");
    ensureScript(`/companion-v10-stage4.js?v=${REVISION}`, "uaiCompanionV10Stage4Script");
    ensureScript(`/companion-v10-stage5.js?v=${REVISION}`, "uaiCompanionV10Stage5Script");
    ensureScript(`/companion-v11.js?v=${REVISION}`, "uaiCompanionV11Script");
    ensureScript(`/companion-v11-stage1.js?v=${REVISION}`, "uaiCompanionV11Stage1Script");
    ensureScript(`/companion-v11-stage2.js?v=${REVISION}`, "uaiCompanionV11Stage2Script");
    ensureScript(`/companion-v11-stage3.js?v=${REVISION}`, "uaiCompanionV11Stage3Script");
    ensureScript(`/companion-v11-stage4.js?v=${REVISION}`, "uaiCompanionV11Stage4Script");
    ensureScript(`/companion-v12-galaxy.js?v=${REVISION}`, "uaiCompanionV12GalaxyScript");
    ensureScript(`/companion-v12-stage2.js?v=${REVISION}`, "uaiCompanionV12Stage2Script");
    ensureScript(`/companion-v12-final.js?v=${REVISION}`, "uaiCompanionV12FinalScript");
    ensureScript(`/companion-v12-polish.js?v=${REVISION}`, "uaiCompanionV12PolishScript");
    ensureScript(`/companion-v12-phase1.js?v=${REVISION}`, "uaiCompanionV12Phase1Script");
    ensureScript(`/companion-live2d.js?v=${REVISION}`, "uaiCompanionLive2dScript");

    if (document.getElementById("uaiModeRouterScript")) return;
    const script = document.createElement("script");
    script.id = "uaiModeRouterScript";
    script.src = `/mode-router.js?v=${REVISION}`;
    script.async = false;
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
      window.__UNLIMITED_BOOT__.companionSettingsReady = Boolean(window.UnlimitedCompanionSettings);
      window.__UNLIMITED_BOOT__.companionExtrasReady = Boolean(window.UnlimitedCompanionExtras);
      window.__UNLIMITED_BOOT__.companionV10ShellReady = Boolean(window.UnlimitedCompanionV10Shell);
      window.__UNLIMITED_BOOT__.companionV10Stage2Ready = Boolean(window.UnlimitedCompanionV10Stage2);
      window.__UNLIMITED_BOOT__.companionV10Stage4Ready = Boolean(window.UnlimitedCompanionV10Stage4);
      window.__UNLIMITED_BOOT__.companionV10Stage5Ready = Boolean(window.UnlimitedCompanionV10Stage5);
      window.__UNLIMITED_BOOT__.companionV11Ready = Boolean(window.UnlimitedCompanionV11);
      window.__UNLIMITED_BOOT__.companionV11Stage1Ready = Boolean(window.UnlimitedCompanionV11Stage1);
      window.__UNLIMITED_BOOT__.companionV11Stage2Ready = Boolean(window.UnlimitedCompanionV11Stage2);
      window.__UNLIMITED_BOOT__.companionV11Stage3Ready = Boolean(window.UnlimitedCompanionV11Stage3);
      window.__UNLIMITED_BOOT__.companionV11Stage4Ready = Boolean(window.UnlimitedCompanionV11Stage4);
      window.__UNLIMITED_BOOT__.companionV12GalaxyReady = Boolean(window.UnlimitedCompanionV12Galaxy);
      window.__UNLIMITED_BOOT__.companionV12Stage2Ready = Boolean(window.UnlimitedCompanionV121);
      window.__UNLIMITED_BOOT__.companionV12FinalReady = Boolean(window.UnlimitedCompanionV122);
      window.__UNLIMITED_BOOT__.companionV12PolishReady = Boolean(window.UnlimitedCompanionV123);
      window.__UNLIMITED_BOOT__.companionV12Phase1Ready = Boolean(window.UnlimitedCompanionV124Phase1);
      window.__UNLIMITED_BOOT__.companionLive2dReady = Boolean(window.UnlimitedCompanionLive2D);
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