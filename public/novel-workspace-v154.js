// public/novel-workspace-v154.js
// V15.4: lifecycle-aware novel ambience + final manuscript editing polish.
(() => {
  const REVISION = "2026-08-18-v15.4-novel-final";
  const LS_STUDIO = "cfw_studio_workspace_v1";
  if (window.UnlimitedNovelWorkspaceV154) return;

  const nativeRaf = window.requestAnimationFrame.bind(window);
  const nativeCancelRaf = window.cancelAnimationFrame.bind(window);
  const nativeSetInterval = window.setInterval.bind(window);
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;

  let particleCallback = null;
  let particleFrameId = 0;
  let particleScheduled = false;
  let lastParticlePaint = 0;
  let wallpaperCallback = null;
  let editorObserver = null;
  let modeObserver = null;
  let editorRefreshTimer = 0;
  let saveVerifyTimer = 0;
  let lastAmbienceEligible = false;

  function readState() {
    try {
      const value = JSON.parse(localStorage.getItem(LS_STUDIO) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function activeData() {
    const state = readState();
    const projects = Array.isArray(state.projects) ? state.projects : [];
    const project = projects.find((item) => item.id === state.activeProjectId) || projects[0] || null;
    const chapters = Array.isArray(project?.chapters) ? project.chapters : [];
    const chapter = chapters.find((item) => item.id === state.activeChapterId) || null;
    return { state, project, chapters, chapter };
  }

  function countChars(value) {
    return String(value || "").replace(/\s/g, "").length;
  }

  function isNovelMode() {
    return document.body?.dataset.uaiMode === "novel";
  }

  function ambienceEligible() {
    return Boolean(
      document.visibilityState === "visible" &&
      isNovelMode() &&
      !reduceMotion?.matches &&
      !document.body?.classList.contains("v2-writing-focus")
    );
  }

  function particleFrameDelay() {
    const cores = Number(navigator.hardwareConcurrency) || 4;
    const area = Math.max(1, window.innerWidth * window.innerHeight);
    if (cores <= 4 || area >= 3200000) return 33;
    if (cores <= 6 || area >= 2300000) return 24;
    return 16;
  }

  function cancelParticleFrame() {
    if (particleFrameId) nativeCancelRaf(particleFrameId);
    particleFrameId = 0;
    particleScheduled = false;
  }

  function scheduleParticle(callback = particleCallback) {
    if (typeof callback !== "function") return 0;
    particleCallback = callback;
    if (!ambienceEligible() || particleScheduled) return 0;

    particleScheduled = true;
    const tick = (time) => {
      particleFrameId = 0;
      if (!ambienceEligible()) {
        particleScheduled = false;
        return;
      }
      const delay = particleFrameDelay();
      if (lastParticlePaint && time - lastParticlePaint < delay - 1) {
        particleFrameId = nativeRaf(tick);
        return;
      }
      lastParticlePaint = time;
      particleScheduled = false;
      callback(time);
    };
    particleFrameId = nativeRaf(tick);
    return particleFrameId;
  }

  // Intercept only the legacy novel particle loop. Every other animation frame keeps
  // the browser's native behavior.
  window.requestAnimationFrame = function guardedAnimationFrame(callback) {
    if (typeof callback === "function" && callback.name === "animateParticles") {
      return scheduleParticle(callback);
    }
    return nativeRaf(callback);
  };

  window.cancelAnimationFrame = function guardedCancelAnimationFrame(id) {
    if (id && id === particleFrameId) {
      cancelParticleFrame();
      return;
    }
    nativeCancelRaf(id);
  };

  // Keep the old interval id compatible, but suppress wallpaper rotations while the
  // novel workspace is hidden, backgrounded, reduced-motion, or in focus writing.
  window.setInterval = function guardedSetInterval(callback, delay, ...args) {
    if (typeof callback === "function" && callback.name === "rotateBackground") {
      wallpaperCallback = callback;
      return nativeSetInterval(() => {
        if (ambienceEligible()) callback(...args);
      }, delay);
    }
    return nativeSetInterval(callback, delay, ...args);
  };

  function syncCanvasVisibility() {
    const canvas = document.getElementById("particle-canvas");
    if (!canvas) return;
    const show = ambienceEligible();
    canvas.hidden = !show;
    canvas.setAttribute("aria-hidden", "true");
  }

  function syncAmbience() {
    const eligible = ambienceEligible();
    if (!eligible) cancelParticleFrame();
    else if (particleCallback && !particleScheduled) scheduleParticle(particleCallback);

    // When returning to the novel after a long pause, advance the wallpaper once instead
    // of waiting for the next 30-second interval. Never do this on the initial boot.
    if (eligible && !lastAmbienceEligible && wallpaperCallback && document.documentElement.dataset.v154AmbienceSeen === "1") {
      try { wallpaperCallback(); } catch {}
    }
    if (eligible) document.documentElement.dataset.v154AmbienceSeen = "1";
    lastAmbienceEligible = eligible;
    syncCanvasVisibility();
    document.documentElement.dataset.novelAmbience = eligible ? "running" : "paused";
  }

  function setText(node, value) {
    if (!node) return;
    const next = String(value ?? "");
    if (node.textContent !== next) node.textContent = next;
  }

  function setComposer(text) {
    const input = document.getElementById("msg");
    if (!input) return false;
    const next = String(text || "");
    if (input.value !== next) {
      input.value = next;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    try { input.focus({ preventScroll: false }); } catch { input.focus(); }
    try { input.setSelectionRange(input.value.length, input.value.length); } catch {}
    return true;
  }

  function switchTab(tab) {
    document.querySelector(`.studio-tabs [data-studio-tab="${tab}"]`)?.click();
  }

  function manuscriptCheckPrompt() {
    const { project, chapter } = activeData();
    const projectName = project?.name || "当前作品";
    const chapterName = chapter?.name || "当前章节";
    return `请检查《${projectName}》的“${chapterName}”当前正文，重点检查：剧情推进是否停滞、人物行为是否符合已有设定、场景与上一段是否连续、对白是否同质化、信息是否重复、节奏是否拖沓，以及是否存在前后矛盾。先列出最值得修改的 3–5 个问题，再给出具体修改方向。不要直接重写整章。`;
  }

  function ensureEditorRail(editor) {
    const pane = editor?.closest("#simpleManuscriptPane");
    const head = pane?.querySelector(".simple-manuscript-head");
    if (!pane || !head) return null;

    let rail = pane.querySelector("#novelV154EditorRail");
    if (!rail) {
      rail = document.createElement("section");
      rail.id = "novelV154EditorRail";
      rail.className = "novel-v154-editor-rail";
      rail.innerHTML = `
        <div class="novel-v154-progress-block">
          <div><span>本章进度</span><strong id="novelV154ProgressText">0%</strong></div>
          <i class="novel-v154-progress-track"><b id="novelV154ProgressFill"></b></i>
        </div>
        <div class="novel-v154-editor-meta">
          <span id="novelV154SaveState" data-state="saved"><i></i>已保存</span>
          <span id="novelV154WordState">0 / 0 字</span>
          <button type="button" data-v154-action="plan">本章计划</button>
          <button type="button" data-v154-action="check">AI 检查本章</button>
        </div>`;
      head.after(rail);
    }
    return rail;
  }

  function verifySaved(editor, attempt = 0) {
    window.clearTimeout(saveVerifyTimer);
    saveVerifyTimer = window.setTimeout(() => {
      if (!document.contains(editor)) return;
      const { chapter } = activeData();
      const status = document.getElementById("novelV154SaveState");
      const matches = Boolean(chapter && String(chapter.manuscript || "") === String(editor.value || ""));
      if (matches) {
        if (status) status.dataset.state = "saved";
        setText(status, "已保存");
        // Restore the status dot after textContent replacement.
        if (status && !status.querySelector("i")) status.prepend(document.createElement("i"));
        return;
      }
      if (attempt < 2) {
        verifySaved(editor, attempt + 1);
        return;
      }
      if (status) status.dataset.state = "pending";
      setText(status, "等待保存");
      if (status && !status.querySelector("i")) status.prepend(document.createElement("i"));
    }, attempt ? 260 : 120);
  }

  function markSaving() {
    const status = document.getElementById("novelV154SaveState");
    if (!status) return;
    status.dataset.state = "saving";
    setText(status, "保存中…");
    if (!status.querySelector("i")) status.prepend(document.createElement("i"));
  }

  function updateEditorRail(editor) {
    const { chapter } = activeData();
    if (!chapter || !editor) return;
    const words = countChars(editor.value);
    const target = Math.max(100, Number(chapter.targetWords) || 3000);
    const percent = Math.max(0, Math.min(100, Math.round(words / target * 100)));
    setText(document.getElementById("novelV154ProgressText"), `${percent}%`);
    setText(document.getElementById("novelV154WordState"), `${words.toLocaleString()} / ${target.toLocaleString()} 字`);
    const fill = document.getElementById("novelV154ProgressFill");
    if (fill) fill.style.width = `${percent}%`;

    const hudChapter = document.getElementById("novelV154FocusChapter");
    const hudWords = document.getElementById("novelV154FocusWords");
    setText(hudChapter, chapter.name || "当前章节");
    setText(hudWords, `${words.toLocaleString()} 字`);
  }

  function ensureFocusHud() {
    let hud = document.getElementById("novelV154FocusHud");
    if (hud) return hud;
    hud = document.createElement("div");
    hud.id = "novelV154FocusHud";
    hud.className = "novel-v154-focus-hud";
    hud.innerHTML = `<span>专注写作</span><strong id="novelV154FocusChapter">当前章节</strong><small id="novelV154FocusWords">0 字</small><button type="button" data-v154-action="exit-focus">退出</button>`;
    document.body.appendChild(hud);
    return hud;
  }

  function syncFocusUi() {
    const focused = document.body.classList.contains("v2-writing-focus");
    const focusButton = document.getElementById("v2FocusWriting");
    if (focusButton) {
      setText(focusButton, focused ? "退出专注" : "专注写作");
      focusButton.setAttribute("aria-pressed", focused ? "true" : "false");
      focusButton.title = focused ? "退出专注写作" : "隐藏其他区域，只保留正文";
    }
    ensureFocusHud();
    syncAmbience();
  }

  function enhanceEditor() {
    if (!isNovelMode()) return;
    const editor = document.getElementById("simpleManuscriptEditor");
    if (!editor) return;
    const rail = ensureEditorRail(editor);
    if (!rail) return;

    const continueButton = document.getElementById("v2ContinueWriting");
    if (continueButton) {
      setText(continueButton, "AI 续写");
      continueButton.title = "根据当前正文和作品资料继续写";
    }

    if (editor.dataset.v154Bound !== "1") {
      editor.dataset.v154Bound = "1";
      editor.addEventListener("input", () => {
        markSaving();
        updateEditorRail(editor);
        verifySaved(editor);
      });
      editor.addEventListener("blur", () => verifySaved(editor));
    }

    updateEditorRail(editor);
    verifySaved(editor);
    syncFocusUi();
    document.documentElement.dataset.novelManuscriptRevision = REVISION;
  }

  function scheduleEditorEnhance(delay = 30) {
    if (editorRefreshTimer) window.clearTimeout(editorRefreshTimer);
    editorRefreshTimer = window.setTimeout(() => {
      editorRefreshTimer = 0;
      enhanceEditor();
    }, delay);
  }

  function handleClick(event) {
    const action = event.target?.closest?.("[data-v154-action]")?.dataset.v154Action;
    if (!action) return;
    if (action === "plan") {
      switchTab("outline");
      return;
    }
    if (action === "check") {
      setComposer(manuscriptCheckPrompt());
      window.UnlimitedV2Phase2?.notify?.("已生成本章检查指令，可修改后再发送。", "success");
      return;
    }
    if (action === "exit-focus") {
      const button = document.getElementById("v2FocusWriting");
      if (button) button.click();
      else document.body.classList.remove("v2-writing-focus");
      syncFocusUi();
    }
  }

  function installRuntimeObservers() {
    document.addEventListener("visibilitychange", syncAmbience);
    window.addEventListener("resize", syncAmbience, { passive: true });
    if (reduceMotion) {
      const listener = () => syncAmbience();
      if (typeof reduceMotion.addEventListener === "function") reduceMotion.addEventListener("change", listener);
      else if (typeof reduceMotion.addListener === "function") reduceMotion.addListener(listener);
    }

    modeObserver = new MutationObserver(() => {
      syncAmbience();
      syncFocusUi();
      scheduleEditorEnhance(10);
    });
    modeObserver.observe(document.body, { attributes: true, attributeFilter: ["data-uai-mode", "class"], childList: true });
  }

  function installEditorObservers() {
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.body.classList.contains("v2-writing-focus")) {
        const button = document.getElementById("v2FocusWriting");
        if (button) button.click();
        else document.body.classList.remove("v2-writing-focus");
        syncFocusUi();
      }
    });

    const panel = document.getElementById("studioPanelBody");
    if (panel) {
      editorObserver = new MutationObserver(() => scheduleEditorEnhance(35));
      editorObserver.observe(panel, { childList: true, subtree: true });
    }
    document.querySelector(".studio-tabs")?.addEventListener("click", () => scheduleEditorEnhance(50));
    document.getElementById("studioLibrary")?.addEventListener("click", () => scheduleEditorEnhance(80));
    scheduleEditorEnhance(0);
  }

  function install() {
    installRuntimeObservers();
    syncAmbience();
    // Run after the legacy product layers in the same parser turn have finished.
    window.setTimeout(installEditorObservers, 0);
    document.documentElement.dataset.novelWorkspaceFinalRevision = REVISION;
  }

  window.UnlimitedNovelWorkspaceV154 = {
    revision: REVISION,
    syncAmbience,
    refresh: () => scheduleEditorEnhance(0),
    get ambienceRunning() { return ambienceEligible(); }
  };

  install();
})();
