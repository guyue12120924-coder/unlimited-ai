// Companion V12.7/12.22 phase 4 — lightweight scene themes + Live2D voice/model loaders.
// Compatibility marker: v12.21-phase4-model-pool
(() => {
  const REVISION = "2026-08-15-v12.22-phase4-curated-pool-1";
  const THEMES = ["galaxy", "sakura", "moonlight", "neon"];
  const LABELS = {
    galaxy: "星河梦境",
    sakura: "樱花夜色",
    moonlight: "月光房间",
    neon: "霓虹幻想"
  };
  let currentTheme = "galaxy";
  let scheduled = false;
  let particleHost = null;

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
    script.async = false;
    document.body.appendChild(script);
  }

  function loadPhase5SceneState() {
    ensureStyle(`/companion-v12-phase5-scene-state.css?v=${encodeURIComponent(REVISION)}`, "uaiCompanionV12Phase5SceneStateCss");
    ensureScript(`/companion-v12-phase5-scene-state.js?v=${encodeURIComponent(REVISION)}`, "uaiCompanionV12Phase5SceneStateScript");
    ensureStyle(`/companion-live2d-interaction.css?v=${encodeURIComponent(REVISION)}`, "uaiCompanionLive2dInteractionCss");
    ensureScript(`/companion-live2d-interaction.js?v=${encodeURIComponent(REVISION)}`, "uaiCompanionLive2dInteractionScript");
    ensureStyle(`/companion-live2d-voice.css?v=${encodeURIComponent(REVISION)}`, "uaiCompanionLive2dVoiceCss");
    ensureScript(`/companion-live2d-voice.js?v=${encodeURIComponent(REVISION)}`, "uaiCompanionLive2dVoiceScript");
    ensureStyle(`/companion-live2d-neural-voice.css?v=${encodeURIComponent(REVISION)}`, "uaiCompanionLive2dNeuralVoiceCss");
    ensureScript(`/companion-live2d-neural-voice.js?v=${encodeURIComponent(REVISION)}`, "uaiCompanionLive2dNeuralVoiceScript");
    ensureStyle(`/companion-voice-input.css?v=${encodeURIComponent(REVISION)}`, "uaiCompanionVoiceInputCss");
    ensureScript(`/companion-voice-input.js?v=${encodeURIComponent(REVISION)}`, "uaiCompanionVoiceInputScript");
    ensureStyle(`/companion-call-mode.css?v=${encodeURIComponent(REVISION)}`, "uaiCompanionCallModeCss");
    ensureScript(`/companion-call-mode.js?v=${encodeURIComponent(REVISION)}`, "uaiCompanionCallModeScript");
    // V12.22: curated role -> Live2D model assignments and manual selector.
    ensureStyle(`/companion-live2d-model-pool.css?v=${encodeURIComponent(REVISION)}`, "uaiCompanionLive2dModelPoolCss");
    ensureScript(`/companion-live2d-model-pool.js?v=${encodeURIComponent(REVISION)}`, "uaiCompanionLive2dModelPoolScript");
    // V12.19: model diagnostics, per-role lip-sync tuning and one-tap barge-in.
    ensureStyle(`/companion-live2d-polish.css?v=${encodeURIComponent(REVISION)}`, "uaiCompanionLive2dPolishCss");
    ensureScript(`/companion-live2d-polish.js?v=${encodeURIComponent(REVISION)}`, "uaiCompanionLive2dPolishScript");
    // V12.20: scan model capabilities and map AI emotions to the model's own expressions/motions.
    ensureStyle(`/companion-live2d-emotion-engine.css?v=${encodeURIComponent(REVISION)}`, "uaiCompanionLive2dEmotionEngineCss");
    ensureScript(`/companion-live2d-emotion-engine.js?v=${encodeURIComponent(REVISION)}`, "uaiCompanionLive2dEmotionEngineScript");
  }

  function getRoot() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const root = document.getElementById("uaiCompanionRoot");
    return root && !root.hidden ? root : null;
  }

  function ensureLayer(root) {
    const main = root?.querySelector(".uai-c-main");
    if (!main) return null;
    let layer = main.querySelector(":scope > .uai-c-v127-theme-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "uai-c-v127-theme-layer";
      layer.setAttribute("aria-hidden", "true");
      layer.innerHTML = `
        <div class="uai-c-v127-theme-wash"></div>
        <div class="uai-c-v127-theme-band"></div>
        <div class="uai-c-v127-theme-accent"></div>
        <div class="uai-c-v127-theme-particles"></div>`;
      main.prepend(layer);
    }
    particleHost = layer.querySelector(".uai-c-v127-theme-particles");
    return layer;
  }

  function particleCount(theme) {
    if (theme === "sakura") return 34;
    if (theme === "moonlight") return 42;
    if (theme === "neon") return 32;
    return 28;
  }

  function randomColor(theme) {
    const palettes = {
      galaxy: ["#ff8fd3", "#d9a8ff", "#aab6ff", "#ffffff"],
      sakura: ["#ffb5cf", "#ff8fbd", "#ffd7e6", "#dba8ff"],
      moonlight: ["#eaf4ff", "#c9dcff", "#9eb9ff", "#b8a9ff"],
      neon: ["#ff45b1", "#9c5cff", "#3bdcff", "#ff79d1"]
    };
    const list = palettes[theme] || palettes.galaxy;
    return list[Math.floor(Math.random() * list.length)];
  }

  function symbolFor(theme, index) {
    if (theme !== "galaxy") return "";
    const symbols = ["♥", "✦", "♡", "✧", "♥", "•"];
    return symbols[index % symbols.length];
  }

  function buildParticles(theme) {
    if (!particleHost) return;
    particleHost.innerHTML = "";
    const count = particleCount(theme);
    for (let index = 0; index < count; index += 1) {
      const item = document.createElement("i");
      item.className = "uai-c-v127-particle";
      item.style.left = `${2 + Math.random() * 96}%`;
      item.style.top = `${-6 + Math.random() * 106}%`;
      item.style.setProperty("--particle-color", randomColor(theme));
      item.style.setProperty("--delay", `${(-Math.random() * 11).toFixed(2)}s`);
      item.style.setProperty("--dx", `${(-46 + Math.random() * 92).toFixed(1)}px`);

      if (theme === "sakura") {
        item.style.setProperty("--particle-size", `${7 + Math.random() * 9}px`);
        item.style.setProperty("--duration", `${8.5 + Math.random() * 6.5}s`);
      } else if (theme === "moonlight") {
        item.style.setProperty("--particle-size", `${1.8 + Math.random() * 3.8}px`);
        item.style.setProperty("--duration", `${6.8 + Math.random() * 6.4}s`);
      } else if (theme === "neon") {
        item.style.setProperty("--particle-size", `${3 + Math.random() * 6}px`);
        item.style.setProperty("--duration", `${4.8 + Math.random() * 5.7}s`);
        item.style.color = item.style.getPropertyValue("--particle-color");
      } else {
        item.style.setProperty("--particle-size", `${8 + Math.random() * 8}px`);
        item.style.setProperty("--duration", `${5.6 + Math.random() * 5.6}s`);
        item.textContent = symbolFor(theme, index);
      }
      particleHost.appendChild(item);
    }
  }

  function applyTheme(theme, options = {}) {
    const next = THEMES.includes(theme) ? theme : "galaxy";
    const root = getRoot();
    currentTheme = next;
    if (!root) return next;
    ensureLayer(root);
    root.dataset.v127Theme = next;
    root.dataset.v127ThemeLabel = LABELS[next];
    document.documentElement.dataset.companionSceneTheme = next;
    buildParticles(next);
    if (!options.silent) {
      root.dispatchEvent(new CustomEvent("uai:companion-scene-theme", {
        bubbles: false,
        detail: { theme: next, label: LABELS[next] }
      }));
    }
    return next;
  }

  function cycleTheme() {
    const index = THEMES.indexOf(currentTheme);
    return applyTheme(THEMES[(index + 1) % THEMES.length]);
  }

  function enhance() {
    scheduled = false;
    const root = getRoot();
    if (!root) return;
    root.dataset.v127Phase4 = REVISION;
    ensureLayer(root);
    if (!root.dataset.v127Theme) applyTheme(currentTheme, { silent: true });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionV127Phase4Revision = REVISION;
    window.UnlimitedCompanionV127Themes = {
      revision: REVISION,
      themes: THEMES.map((id) => ({ id, label: LABELS[id] })),
      get currentTheme() { return currentTheme; },
      setTheme: applyTheme,
      cycleTheme,
      refresh: schedule
    };
    loadPhase5SceneState();
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode", "class"]
    });
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
