// public/boot-diagnostics.js
// Startup guard + dual-mode bootstrap.
(() => {
  const REVISION = "2026-08-17-v14.5-entry-performance";
  const MODE_ROUTER_REVISION = "2026-08-17-v13.4-mode-router-lazy-companion";
  const errors = [];

  document.documentElement.dataset.frontendRevision = REVISION;
  document.documentElement.classList.add("uai-mode-gate-pending");
  window.__UNLIMITED_BOOT__ = {
    revision: REVISION,
    modeRouterRevision: MODE_ROUTER_REVISION,
    startedAt: Date.now(),
    errors,
    companionAssetsDeferred: true,
    companionAssetsReady: false
  };

  const gateStyle = document.createElement("style");
  gateStyle.id = "uaiModeGateCriticalCss";
  gateStyle.textContent = "html.uai-mode-gate-pending #app{visibility:hidden!important;pointer-events:none!important}html.uai-mode-gate-pending body{background:#080817!important}";
  document.head.appendChild(gateStyle);

  function ensureStyle(href, id) {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    link.addEventListener("error", () => errors.push(`资源加载失败：${href}`), { once: true });
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
    const routerStyles = [
      ["/mode-router.css", "uaiModeRouterCss"],
      ["/mode-router-stage3.css", "uaiModeRouterStage3Css"],
      ["/mode-router-luxury.css", "uaiModeRouterLuxuryCss"],
      ["/mode-router-luxury-stage2.css", "uaiModeRouterLuxuryStage2Css"],
      ["/mode-router-luxury-stage3.css", "uaiModeRouterLuxuryStage3Css"],
      ["/mode-router-luxury-stage4.css", "uaiModeRouterLuxuryStage4Css"],
      ["/mode-router-luxury-stage5.css", "uaiModeRouterLuxuryStage5Css"]
    ];

    const routerScripts = [
      ["/mode-router-luxury.js", "uaiModeRouterLuxuryScript"],
      ["/mode-router-luxury-stage2.js", "uaiModeRouterLuxuryStage2Script"],
      ["/mode-router-luxury-stage3.js", "uaiModeRouterLuxuryStage3Script"],
      ["/mode-router-luxury-stage4.js", "uaiModeRouterLuxuryStage4Script"],
      ["/mode-router-luxury-stage5.js", "uaiModeRouterLuxuryStage5Script"]
    ];

    routerStyles.forEach(([href, id]) => ensureStyle(`${href}?v=${encodeURIComponent(REVISION)}`, id));
    routerScripts.forEach(([src, id]) => ensureScript(`${src}?v=${encodeURIComponent(REVISION)}`, id));

    if (document.getElementById("uaiModeRouterScript")) return;
    const script = document.createElement("script");
    script.id = "uaiModeRouterScript";
    script.src = `/mode-router.js?v=${encodeURIComponent(REVISION)}`;
    script.async = false;
    script.addEventListener("error", () => {
      document.documentElement.classList.remove("uai-mode-gate-pending");
      document.body.dataset.uaiMode = "novel";
      showFailure("模式选择模块加载失败，已回退到原小说工作台。刷新页面后可重试。");
    }, { once: true });
    document.body.appendChild(script);
  }

  function companionSnapshot() {
    return {
      companionAssetsDeferred: !window.UnlimitedCompanionAssets?.ready,
      companionAssetsReady: Boolean(window.UnlimitedCompanionAssets?.ready),
      companionAssetsLoading: Boolean(window.UnlimitedCompanionAssets?.loading),
      companionModeReady: Boolean(window.UnlimitedCompanion?.mount),
      companionMultiReady: Boolean(window.UnlimitedCompanionMulti),
      companionRuntimeReady: Boolean(window.UnlimitedCompanionRuntime),
      companionMemorySearchReady: Boolean(window.UnlimitedCompanionMemorySearch),
      companionProfileRestoreReady: Boolean(window.UnlimitedCompanionProfileRestore),
      companionCharacterControlsReady: Boolean(window.UnlimitedCompanionCharacterControls),
      companionSettingsReady: Boolean(window.UnlimitedCompanionSettings),
      companionExtrasReady: Boolean(window.UnlimitedCompanionExtras),
      companionV10ShellReady: Boolean(window.UnlimitedCompanionV10Shell),
      companionV10Stage2Ready: Boolean(window.UnlimitedCompanionV10Stage2),
      companionV10Stage4Ready: Boolean(window.UnlimitedCompanionV10Stage4),
      companionV10Stage5Ready: Boolean(window.UnlimitedCompanionV10Stage5),
      companionV11Ready: Boolean(window.UnlimitedCompanionV11),
      companionV11Stage1Ready: Boolean(window.UnlimitedCompanionV11Stage1),
      companionV11Stage2Ready: Boolean(window.UnlimitedCompanionV11Stage2),
      companionV11Stage3Ready: Boolean(window.UnlimitedCompanionV11Stage3),
      companionV11Stage4Ready: Boolean(window.UnlimitedCompanionV11Stage4),
      companionV12GalaxyReady: Boolean(window.UnlimitedCompanionV12Galaxy),
      companionV12Stage2Ready: Boolean(window.UnlimitedCompanionV121),
      companionV12FinalReady: Boolean(window.UnlimitedCompanionV122),
      companionV12PolishReady: Boolean(window.UnlimitedCompanionV123),
      companionV12Phase1Ready: Boolean(window.UnlimitedCompanionV124Phase1),
      companionLive2dReady: Boolean(window.UnlimitedCompanionLive2D),
      companionVoiceReady: Boolean(window.UnlimitedCompanionVoice),
      companionNeuralVoiceReady: Boolean(window.UnlimitedCompanionNeuralVoice),
      companionVoiceInputReady: Boolean(window.UnlimitedCompanionVoiceInput),
      companionCallModeReady: Boolean(window.UnlimitedCompanionCallMode),
      companionLive2dModelPoolReady: Boolean(window.UnlimitedCompanionLive2DModelPool),
      companionLive2dPolishReady: Boolean(window.UnlimitedCompanionLive2DPolish),
      companionLive2dEmotionReady: Boolean(window.UnlimitedCompanionLive2DEmotionEngine),
      companionV123UxHardeningReady: Boolean(window.UnlimitedCompanionV123UXHardening)
    };
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
    const routerRevision = window.UnlimitedModeRouter?.revision || "";

    if (routerRevision && routerRevision !== MODE_ROUTER_REVISION) {
      errors.push(`模式路由版本不一致：期望 ${MODE_ROUTER_REVISION}，实际 ${routerRevision}`);
    }

    Object.assign(window.__UNLIMITED_BOOT__, companionSnapshot(), {
      modeRouterReady: Boolean(window.UnlimitedModeRouter),
      modeRouterRevision: routerRevision,
      modeRouterStage3Ready: Boolean(document.getElementById("uaiModeRouterStage3Css")),
      modeRouterLuxuryReady: Boolean(window.UnlimitedModeLuxury),
      modeRouterLuxuryStage2Ready: Boolean(window.UnlimitedModeLuxuryStage2),
      modeRouterLuxuryStage3Ready: Boolean(window.UnlimitedModeLuxuryStage3),
      modeRouterLuxuryStage4Ready: Boolean(window.UnlimitedModeLuxuryStage4),
      modeRouterLuxuryStage5Ready: Boolean(window.UnlimitedModeLuxuryStage5)
    });

    if (!missing.length && !errors.length) {
      window.__UNLIMITED_BOOT__.ready = true;
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