// public/boot-diagnostics.js
// V17.22 startup guard + dual-mode diagnostics.
// Compatibility marker: 2026-08-17-v14.7-entry-zero-companion
// Compatibility marker: 2026-08-22-v17.5-companion-core-only-rollback
(() => {
  const BOOT_REVISION = "2026-08-23-v17.22-final-cleanup-diagnostics";
  const FRONTEND_REVISION = document.querySelector('meta[name="unlimited-frontend-revision"]')?.content
    || "2026-08-23-v17.21-voice-experience-polish";
  const MODE_ROUTER_REVISION = "2026-08-17-v13.4-mode-router-performance";
  const errors = [];

  document.documentElement.dataset.bootRevision = BOOT_REVISION;
  document.documentElement.dataset.frontendRevision = FRONTEND_REVISION;
  document.documentElement.classList.add("uai-mode-gate-pending");

  window.__UNLIMITED_BOOT__ = {
    revision: BOOT_REVISION,
    bootRevision: BOOT_REVISION,
    frontendRevision: FRONTEND_REVISION,
    modeRouterRevision: MODE_ROUTER_REVISION,
    startedAt: Date.now(),
    errors,
    ready: false
  };

  const gateStyle = document.createElement("style");
  gateStyle.id = "uaiModeGateCriticalCss";
  gateStyle.textContent = "html.uai-mode-gate-pending #app{visibility:hidden!important;pointer-events:none!important}html.uai-mode-gate-pending body{background:#080817!important}";
  document.head.appendChild(gateStyle);

  if (!document.getElementById("uaiCompanionCss")) {
    const placeholder = document.createElement("meta");
    placeholder.id = "uaiCompanionCss";
    placeholder.dataset.uaiDeferredPlaceholder = "true";
    placeholder.dataset.uaiAsset = "/companion-mode.css";
    document.head.appendChild(placeholder);
  }

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
    panel.textContent = `前端初始化失败（${BOOT_REVISION}）\n${message}`;
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
      ["/mode-router-luxury-stage5.js", "uaiModeRouterLuxuryStage5Script"],
      ["/companion-entry-v175.js", "uaiCompanionEntryV175Script"]
    ];

    routerStyles.forEach(([href, id]) => ensureStyle(`${href}?v=${encodeURIComponent(BOOT_REVISION)}`, id));
    routerScripts.forEach(([src, id]) => ensureScript(`${src}?v=${encodeURIComponent(BOOT_REVISION)}`, id));

    if (document.getElementById("uaiModeRouterScript")) return;
    const script = document.createElement("script");
    script.id = "uaiModeRouterScript";
    script.src = `/mode-router.js?v=${encodeURIComponent(BOOT_REVISION)}`;
    script.async = false;
    script.addEventListener("error", () => {
      document.documentElement.classList.remove("uai-mode-gate-pending");
      document.body.dataset.uaiMode = "novel";
      showFailure("模式选择模块加载失败，已回退到小说工作台。刷新页面后可重试。");
    }, { once: true });
    document.body.appendChild(script);
  }

  function companionSnapshot() {
    const active = document.body.dataset.uaiMode === "companion";
    const core = Boolean(window.UnlimitedCompanion?.mount);
    const functionPack = window.UnlimitedCompanionFunctionPackV177;
    const voice = window.UnlimitedCompanionVoiceV1711;
    const stage = window.UnlimitedCompanionStageV1712;
    const call = window.UnlimitedCompanionCallV1713;
    const scene = window.UnlimitedCompanionSceneV1714;
    const atmosphere = window.UnlimitedCompanionAtmosphereV1715;
    return {
      companionActive: active,
      companionEntryReady: Boolean(window.UnlimitedCompanionEntryV175),
      companionCoreReady: core,
      companionFunctionPackReady: document.documentElement.dataset.companionFunctionPack === "ready",
      companionFunctionPackRevision: functionPack?.revision || "",
      companionControlsReady: Boolean(window.UnlimitedCompanionControlsV178),
      companionRuntimeSafeReady: Boolean(window.UnlimitedCompanionRuntimeV179),
      companionExperienceReady: Boolean(window.UnlimitedCompanionExperienceV1710),
      companionVoiceReady: Boolean(voice?.speak && voice?.getSettings),
      companionVoiceRevision: voice?.revision || "",
      companionDefaultVoice: voice?.getSettings?.().voiceId || "",
      companionSceneReady: Boolean(scene?.setTheme && scene?.refresh),
      companionSceneRevision: scene?.revision || "",
      companionLive2dReady: Boolean(stage?.open && stage?.setMouthOpen),
      companionLive2dRevision: stage?.revision || "",
      companionCallReady: Boolean(call?.start && call?.end),
      companionCallRevision: call?.revision || "",
      companionAtmosphereReady: Boolean(atmosphere?.refresh),
      companionAtmosphereRevision: atmosphere?.revision || "",
      companionAudioGestureReady: Boolean(window.UnlimitedCompanionAudioGestureV1716),
      legacyCompanionStructuralThemesDisabled: !document.querySelector('script[src*="companion-v10"],script[src*="companion-v11"],script[src*="companion-v12"]'),
      legacyCompanionRuntimeDisabled: !document.querySelector('script[src*="/companion-runtime.js"]'),
      legacyCompanionCallDisabled: !document.querySelector('script[src*="/companion-call-mode.js"]'),
      legacyCompanionLive2dDisabled: !document.querySelector('script[src$="/companion-live2d.js"],script[src*="/companion-live2d.js?"]')
    };
  }

  function refreshSnapshot() {
    Object.assign(window.__UNLIMITED_BOOT__, companionSnapshot());
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

    refreshSnapshot();
    Object.assign(window.__UNLIMITED_BOOT__, {
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

  window.addEventListener("uai:companion-core-entered", refreshSnapshot);
  window.addEventListener("uai:companion-functions-ready", refreshSnapshot);
  window.addEventListener("uai:companion-voice-profile", refreshSnapshot);
  window.addEventListener("uai:companion-scene-changed", refreshSnapshot);
  window.addEventListener("uai:mode-refresh", refreshSnapshot);

  loadModeRouter();
  const schedule = () => window.setTimeout(verifyBoot, 4000);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule, { once: true });
  else schedule();
})();