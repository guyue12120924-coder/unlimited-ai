// public/boot-diagnostics.js
// Startup guard + dual-mode bootstrap.
(() => {
  const REVISION = "2026-08-15-v12.21-live2d-model-pool-1";
  // Compatibility markers: v12.20 emotion / v12.19 diagnostics / v12.18 lip sync / v12.17 call mode.
  const errors = [];

  document.documentElement.dataset.frontendRevision = REVISION;
  document.documentElement.classList.add("uai-mode-gate-pending");
  window.__UNLIMITED_BOOT__ = { revision: REVISION, startedAt: Date.now(), errors };

  const gateStyle = document.createElement("style");
  gateStyle.id = "uaiModeGateCriticalCss";
  gateStyle.textContent = `html.uai-mode-gate-pending #app{visibility:hidden!important;pointer-events:none!important}html.uai-mode-gate-pending body{background:#080817!important}`;
  document.head.appendChild(gateStyle);

  function ensureStyle(href, id) {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet"; link.href = href;
    document.head.appendChild(link);
  }

  function ensureScript(src, id) {
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id; script.async = false; script.src = src;
    script.addEventListener("error", () => errors.push(`资源加载失败：${src}`), { once: true });
    document.body.appendChild(script);
  }

  function describeError(event) {
    if (event?.reason) return event.reason?.stack || event.reason?.message || String(event.reason);
    const message = event?.error?.stack || event?.error?.message || event?.message || "Unknown frontend error";
    const location = event?.filename ? `\n位置：${event.filename}${event.lineno ? `:${event.lineno}` : ""}${event.colno ? `:${event.colno}` : ""}` : "";
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
    for (const [href, id] of [
      ["/mode-router.css","uaiModeRouterCss"],["/companion-mode.css","uaiCompanionCss"],["/companion-characters.css","uaiCompanionCharactersCss"],
      ["/companion-memory.css","uaiCompanionMemoryCss"],["/companion-records.css","uaiCompanionRecordsCss"],["/companion-support.css","uaiCompanionSupportCss"],
      ["/companion-v10.css","uaiCompanionV10Css"],["/companion-v10-vibrant.css","uaiCompanionV10VibrantCss"],["/companion-v10-stage2.css","uaiCompanionV10Stage2Css"],
      ["/companion-v10-stage3.css","uaiCompanionV10Stage3Css"],["/companion-v10-stage4.css","uaiCompanionV10Stage4Css"],["/companion-v10-stage5.css","uaiCompanionV10Stage5Css"],
      ["/companion-v10-stage6.css","uaiCompanionV10Stage6Css"],["/companion-v11.css","uaiCompanionV11Css"],["/companion-v11-stage1.css","uaiCompanionV11Stage1Css"],
      ["/companion-v11-stage2.css","uaiCompanionV11Stage2Css"],["/companion-v11-stage3.css","uaiCompanionV11Stage3Css"],["/companion-v11-stage4.css","uaiCompanionV11Stage4Css"],
      ["/companion-v12-galaxy.css","uaiCompanionV12GalaxyCss"],["/companion-v12-stage2.css","uaiCompanionV12Stage2Css"],["/companion-v12-final.css","uaiCompanionV12FinalCss"],
      ["/companion-v12-polish.css","uaiCompanionV12PolishCss"],["/companion-v12-phase1.css","uaiCompanionV12Phase1Css"],["/companion-live2d.css","uaiCompanionLive2dCss"],
      ["/companion-live2d-voice.css","uaiCompanionLive2dVoiceCss"],["/companion-live2d-neural-voice.css","uaiCompanionLive2dNeuralVoiceCss"],
      ["/companion-voice-input.css","uaiCompanionVoiceInputCss"],["/companion-call-mode.css","uaiCompanionCallModeCss"],
      ["/companion-live2d-model-pool.css","uaiCompanionLive2dModelPoolCss"],["/companion-live2d-polish.css","uaiCompanionLive2dPolishCss"],
      ["/companion-live2d-emotion-engine.css","uaiCompanionLive2dEmotionEngineCss"]
    ]) ensureStyle(`${href}?v=${REVISION}`, id);

    for (const [src, id] of [
      ["/companion-characters-core.js","uaiCompanionCharactersCoreScript"],["/companion-character-editor.js","uaiCompanionCharacterEditorScript"],
      ["/companion-memory.js","uaiCompanionMemoryScript"],["/companion-records.js","uaiCompanionRecordsScript"],["/companion-settings.js","uaiCompanionSettingsScript"],
      ["/companion-runtime.js","uaiCompanionRuntimeScript"],["/companion-extras.js","uaiCompanionExtrasScript"],["/companion-v10-shell.js","uaiCompanionV10ShellScript"],
      ["/companion-v10-stage2.js","uaiCompanionV10Stage2Script"],["/companion-v10-stage4.js","uaiCompanionV10Stage4Script"],["/companion-v10-stage5.js","uaiCompanionV10Stage5Script"],
      ["/companion-v11.js","uaiCompanionV11Script"],["/companion-v11-stage1.js","uaiCompanionV11Stage1Script"],["/companion-v11-stage2.js","uaiCompanionV11Stage2Script"],
      ["/companion-v11-stage3.js","uaiCompanionV11Stage3Script"],["/companion-v11-stage4.js","uaiCompanionV11Stage4Script"],["/companion-v12-galaxy.js","uaiCompanionV12GalaxyScript"],
      ["/companion-v12-stage2.js","uaiCompanionV12Stage2Script"],["/companion-v12-final.js","uaiCompanionV12FinalScript"],["/companion-v12-polish.js","uaiCompanionV12PolishScript"],
      ["/companion-v12-phase1.js","uaiCompanionV12Phase1Script"],["/companion-live2d.js","uaiCompanionLive2dScript"],["/companion-live2d-voice.js","uaiCompanionLive2dVoiceScript"],
      ["/companion-live2d-neural-voice.js","uaiCompanionLive2dNeuralVoiceScript"],["/companion-voice-input.js","uaiCompanionVoiceInputScript"],
      ["/companion-call-mode.js","uaiCompanionCallModeScript"],["/companion-live2d-model-pool.js","uaiCompanionLive2dModelPoolScript"],
      ["/companion-live2d-polish.js","uaiCompanionLive2dPolishScript"],["/companion-live2d-emotion-engine.js","uaiCompanionLive2dEmotionEngineScript"]
    ]) ensureScript(`${src}?v=${REVISION}`, id);

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
    const expected = [["uaiModeRoot","模式选择大厅"],["creativeWorkspace","创作工作区"],["contextInspectorBtn","上下文"],["continuityBtn","连续性"],["storyMemoryBtn","记忆"]];
    const missing = expected.filter(([id]) => !document.getElementById(id));
    if (!missing.length && !errors.length) {
      Object.assign(window.__UNLIMITED_BOOT__, {
        ready: true,
        modeRouterReady: Boolean(window.UnlimitedModeRouter), companionMultiReady: Boolean(window.UnlimitedCompanionMulti),
        companionRuntimeReady: Boolean(window.UnlimitedCompanionRuntime), companionMemorySearchReady: Boolean(window.UnlimitedCompanionMemorySearch),
        companionProfileRestoreReady: Boolean(window.UnlimitedCompanionProfileRestore), companionCharacterControlsReady: Boolean(window.UnlimitedCompanionCharacterControls),
        companionSettingsReady: Boolean(window.UnlimitedCompanionSettings), companionExtrasReady: Boolean(window.UnlimitedCompanionExtras),
        companionV10ShellReady: Boolean(window.UnlimitedCompanionV10Shell), companionV10Stage2Ready: Boolean(window.UnlimitedCompanionV10Stage2),
        companionV10Stage4Ready: Boolean(window.UnlimitedCompanionV10Stage4), companionV10Stage5Ready: Boolean(window.UnlimitedCompanionV10Stage5),
        companionV11Ready: Boolean(window.UnlimitedCompanionV11), companionV11Stage1Ready: Boolean(window.UnlimitedCompanionV11Stage1),
        companionV11Stage2Ready: Boolean(window.UnlimitedCompanionV11Stage2), companionV11Stage3Ready: Boolean(window.UnlimitedCompanionV11Stage3),
        companionV11Stage4Ready: Boolean(window.UnlimitedCompanionV11Stage4), companionV12GalaxyReady: Boolean(window.UnlimitedCompanionV12Galaxy),
        companionV12Stage2Ready: Boolean(window.UnlimitedCompanionV121), companionV12FinalReady: Boolean(window.UnlimitedCompanionV122),
        companionV12PolishReady: Boolean(window.UnlimitedCompanionV123), companionV12Phase1Ready: Boolean(window.UnlimitedCompanionV124Phase1),
        companionLive2dReady: Boolean(window.UnlimitedCompanionLive2D), companionVoiceReady: Boolean(window.UnlimitedCompanionVoice),
        companionNeuralVoiceReady: Boolean(window.UnlimitedCompanionNeuralVoice), companionVoiceInputReady: Boolean(window.UnlimitedCompanionVoiceInput),
        companionCallModeReady: Boolean(window.UnlimitedCompanionCallMode), companionLive2dModelPoolReady: Boolean(window.UnlimitedCompanionLive2DModelPool),
        companionLive2dPolishReady: Boolean(window.UnlimitedCompanionLive2DPolish), companionLive2dEmotionReady: Boolean(window.UnlimitedCompanionLive2DEmotionEngine)
      });
      return;
    }
    const parts = [];
    if (missing.length) parts.push(`缺少：${missing.map(([,label]) => label).join("、")}`);
    if (errors.length) parts.push(`捕获到的错误：\n${errors.slice(0,8).join("\n\n")}`);
    showFailure(parts.join("\n"));
  }

  loadModeRouter();
  const schedule = () => window.setTimeout(verifyBoot, 4000);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule, { once: true });
  else schedule();
})();
