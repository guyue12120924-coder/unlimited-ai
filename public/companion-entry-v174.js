// public/companion-entry-v174.js
// V17.4: verified core entry, single-owner enhancements, and message-shell recovery.
(() => {
  const REVISION = "2026-08-22-v17.4-companion-verified-commit";
  const CORE_TIMEOUT_MS = 8000;
  const ENTRY_TIMEOUT_MS = 2400;
  const LOADER_URL = "/companion-assets-loader-v174.js?v=20260822-v17.4-companion-verified-commit";
  if (window.UnlimitedCompanionEntryV174) return;

  const ENHANCEMENT_STYLE_IDS = [
    "uaiCompanionCharactersCss", "uaiCompanionMemoryCss", "uaiCompanionRecordsCss", "uaiCompanionSupportCss",
    "uaiCompanionV10Css", "uaiCompanionV10VibrantCss", "uaiCompanionV10Stage2Css", "uaiCompanionV10Stage3Css",
    "uaiCompanionV10Stage4Css", "uaiCompanionV10Stage5Css", "uaiCompanionV10Stage6Css",
    "uaiCompanionV11Css", "uaiCompanionV11Stage1Css", "uaiCompanionV11Stage2Css", "uaiCompanionV11Stage3Css", "uaiCompanionV11Stage4Css",
    "uaiCompanionV12GalaxyCss", "uaiCompanionV12Stage2Css", "uaiCompanionV12FinalCss", "uaiCompanionV12PolishCss",
    "uaiCompanionV124Phase1Css", "uaiCompanionV12Phase2BackgroundCss", "uaiCompanionV12Phase3CharacterCss",
    "uaiCompanionV12Phase4ThemesCss", "uaiCompanionV12Phase5SceneStateCss",
    "uaiCompanionLive2dCss", "uaiCompanionLive2dInteractionCss", "uaiCompanionLive2dVoiceCss",
    "uaiCompanionLive2dNeuralVoiceCss", "uaiCompanionVoiceInputCss", "uaiCompanionCallModeCss",
    "uaiCompanionLive2dModelPoolCss", "uaiCompanionLive2DPolishCss", "uaiCompanionLive2dEmotionEngineCss",
    "uaiCompanionV123UxHardeningCss"
  ];

  let entryPromise = null;
  let loaderPromise = null;
  let warmPromise = null;
  let warmTimer = 0;
  let lastError = null;

  function suppressEnhancementStyles() {
    for (const id of ENHANCEMENT_STYLE_IDS) {
      const link = document.getElementById(id);
      if (link?.tagName === "LINK") {
        link.media = "not all";
        link.dataset.uaiDeferredActivation = "true";
      }
    }
    document.documentElement.dataset.companionEnhancementStyles = "deferred";
  }

  function ui() {
    const lobby = document.getElementById("uaiModeRoot");
    const card = lobby?.querySelector("#uaiEnterCompanion") || null;
    const novel = lobby?.querySelector("#uaiEnterNovel") || null;
    const enter = card?.querySelector(".uai-mode-enter") || null;
    let status = card?.querySelector(".uai-companion-entry-status") || null;
    if (card && enter && !status) {
      status = document.createElement("span");
      status.className = "uai-companion-entry-status";
      status.setAttribute("aria-live", "polite");
      status.hidden = true;
      enter.insertAdjacentElement("afterend", status);
    }
    return { lobby, card, novel, enter, status };
  }

  function textNode(enter) {
    if (!enter) return null;
    let node = [...enter.childNodes].find((item) => item.nodeType === 3 && item.textContent.trim());
    if (!node) {
      node = document.createTextNode("");
      enter.insertBefore(node, enter.firstChild || null);
    }
    return node;
  }

  function setCardState(state = "", message = "", label = "去见她") {
    const { lobby, card, novel, enter, status } = ui();
    if (!card) return;
    if (state) card.dataset.uaiCompanionEntryState = state;
    else delete card.dataset.uaiCompanionEntryState;
    card.classList.toggle("is-loading", state === "loading");
    if (state === "loading") {
      card.disabled = true;
      card.setAttribute("aria-busy", "true");
      if (novel && !lobby?.classList.contains("is-transitioning")) novel.disabled = false;
    } else {
      card.removeAttribute("aria-busy");
      if (document.body.dataset.uaiMode === "lobby" && !lobby?.classList.contains("is-transitioning")) card.disabled = false;
    }
    if (status) {
      status.textContent = message;
      status.hidden = !message;
    }
    const node = textNode(enter);
    if (node) node.data = `${label} `;
  }

  function timed(promise, ms, code, message) {
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = window.setTimeout(() => {
        if (done) return;
        done = true;
        const error = new Error(message);
        error.code = code;
        reject(error);
      }, ms);
      Promise.resolve(promise).then((value) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve(value);
      }, (error) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        reject(error);
      });
    });
  }

  function ensureCoreStyle() {
    return new Promise((resolve, reject) => {
      let link = document.getElementById("uaiCompanionCss");
      if (link && (link.tagName !== "LINK" || link.dataset.uaiDeferredPlaceholder === "true")) {
        link.remove();
        link = null;
      }
      if (link?.sheet) return resolve(link);
      if (!link) {
        link = document.createElement("link");
        link.id = "uaiCompanionCss";
        link.rel = "stylesheet";
        link.href = `/companion-mode.css?v=${encodeURIComponent(REVISION)}`;
        document.head.appendChild(link);
      }
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        link.removeEventListener("load", onLoad);
        link.removeEventListener("error", onError);
        error ? reject(error) : resolve(link);
      };
      const onLoad = () => finish();
      const onError = () => finish(new Error("Failed to load companion-mode.css"));
      const timer = window.setTimeout(() => finish(new Error("Timed out loading companion-mode.css")), CORE_TIMEOUT_MS);
      link.addEventListener("load", onLoad, { once: true });
      link.addEventListener("error", onError, { once: true });
      if (link.sheet) finish();
    });
  }

  function ensureCoreScript(force = false) {
    if (!force && window.UnlimitedCompanion?.mount) return Promise.resolve(window.UnlimitedCompanion);
    return new Promise((resolve, reject) => {
      let script = document.getElementById("uaiCompanionScript");
      if (force && script) {
        script.remove();
        script = null;
      }
      if (script?.dataset.uaiLoaded === "false") {
        script.remove();
        script = null;
      }
      if (!script) {
        script = document.createElement("script");
        script.id = "uaiCompanionScript";
        script.async = false;
        script.src = `/companion-mode.js?v=${encodeURIComponent(REVISION)}`;
        document.body.appendChild(script);
      }
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        script.removeEventListener("load", onLoad);
        script.removeEventListener("error", onError);
        if (error) return reject(error);
        if (!window.UnlimitedCompanion?.mount) return reject(new Error("companion-mode.js loaded without mount()"));
        script.dataset.uaiLoaded = "true";
        resolve(window.UnlimitedCompanion);
      };
      const onLoad = () => requestAnimationFrame(() => finish());
      const onError = () => finish(new Error("Failed to load companion-mode.js"));
      const timer = window.setTimeout(() => finish(new Error("Timed out loading companion-mode.js")), CORE_TIMEOUT_MS);
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      if (window.UnlimitedCompanion?.mount) finish();
    });
  }

  function warmCore() {
    suppressEnhancementStyles();
    if (warmPromise) return warmPromise;
    warmPromise = Promise.all([ensureCoreStyle(), ensureCoreScript()])
      .then(() => true)
      .finally(() => { warmPromise = null; });
    return warmPromise;
  }

  function visibleCore() {
    const root = document.getElementById("uaiCompanionRoot");
    return Boolean(
      document.body.dataset.uaiMode === "companion" && root && !root.hidden && root.isConnected &&
      root.querySelector(".uai-c-shell") && root.querySelector(".uai-c-main") &&
      root.querySelector("#uaiCompanionMessages") && root.querySelector("#uaiCompanionInput")
    );
  }

  function clearTransition() {
    const lobby = document.getElementById("uaiModeRoot");
    if (!lobby) return;
    lobby.classList.remove("is-transitioning", "is-returning");
    delete lobby.dataset.transition;
    delete lobby.dataset.v149TransitionPhase;
    lobby.querySelector("#uaiModeTransition")?.setAttribute("aria-hidden", "true");
  }

  function directMount() {
    suppressEnhancementStyles();
    clearTransition();
    document.documentElement.classList.remove("uai-mode-gate-pending");
    document.body.dataset.uaiMode = "companion";
    const lobby = document.getElementById("uaiModeRoot");
    if (lobby) lobby.hidden = true;
    window.UnlimitedCompanion.mount({ onExit: () => window.UnlimitedModeRouter?.showLobby?.() });
    if (!visibleCore()) throw new Error("Companion core mount did not create a complete shell");
    return true;
  }

  async function hardReloadCore() {
    suppressEnhancementStyles();
    try { window.UnlimitedCompanion?.unmount?.(); } catch {}
    document.getElementById("uaiCompanionRoot")?.remove();
    document.getElementById("uaiCompanionScript")?.remove();
    try { delete window.UnlimitedCompanion; } catch { window.UnlimitedCompanion = undefined; }
    await ensureCoreScript(true);
    return directMount();
  }

  async function enterCore() {
    const router = window.UnlimitedModeRouter;
    if (!router?.enterCompanion) return directMount();
    try {
      await timed(router.enterCompanion(), ENTRY_TIMEOUT_MS, "COMPANION_ROUTER_TIMEOUT", "Companion router entry timed out");
    } catch (error) {
      console.warn("[Unlimited AI] companion router handoff failed; mounting verified core directly", error);
      return directMount();
    }
    if (!visibleCore()) return directMount();
    return true;
  }

  function expectedMessages() {
    const state = window.UnlimitedCompanion?.getState?.() || {};
    const sessions = Array.isArray(state.sessions) ? state.sessions : [];
    const active = sessions.find((item) => item?.id === state.currentSessionId) || sessions[0] || null;
    return Array.isArray(active?.messages) ? active.messages.length : 0;
  }

  async function stabilizeCore() {
    let root = document.getElementById("uaiCompanionRoot");
    let container = root?.querySelector("#uaiCompanionMessages");
    if (!root || !container || !root.querySelector("#uaiCompanionInput") || !root.querySelector(".uai-c-main")) {
      await hardReloadCore();
      root = document.getElementById("uaiCompanionRoot");
      container = root?.querySelector("#uaiCompanionMessages");
    } else {
      try { window.UnlimitedCompanion?.mount?.({ onExit: () => window.UnlimitedModeRouter?.showLobby?.() }); } catch {}
    }

    if (!root || !container) throw new Error("Companion core could not restore its message shell");
    const expected = expectedMessages();
    let rendered = container.querySelectorAll(".uai-c-message-row").length;
    if (expected > 0 && rendered < expected) {
      window.UnlimitedCompanion?.mount?.({ onExit: () => window.UnlimitedModeRouter?.showLobby?.() });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      container = document.querySelector("#uaiCompanionRoot #uaiCompanionMessages");
      rendered = container?.querySelectorAll(".uai-c-message-row").length || 0;
    }
    if (expected > 0 && rendered === 0) throw new Error("Companion messages exist in storage but did not render");
    return true;
  }

  function ensureLoader() {
    if (window.UnlimitedCompanionAssetsV174?.load) return Promise.resolve(window.UnlimitedCompanionAssetsV174);
    if (loaderPromise) return loaderPromise;
    loaderPromise = new Promise((resolve, reject) => {
      let script = document.getElementById("uaiCompanionAssetsLoaderV174Script");
      if (!script) {
        script = document.createElement("script");
        script.id = "uaiCompanionAssetsLoaderV174Script";
        script.async = false;
        script.src = LOADER_URL;
        document.body.appendChild(script);
      }
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        script.removeEventListener("load", onLoad);
        script.removeEventListener("error", onError);
        if (error) reject(error);
        else if (!window.UnlimitedCompanionAssetsV174?.load) reject(new Error("V17.4 enhancement loader did not initialize"));
        else resolve(window.UnlimitedCompanionAssetsV174);
      };
      const onLoad = () => finish();
      const onError = () => finish(new Error("Failed to load V17.4 enhancement loader"));
      const timer = window.setTimeout(() => finish(new Error("V17.4 enhancement loader timed out")), 12000);
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      if (window.UnlimitedCompanionAssetsV174?.load) finish();
    }).finally(() => { loaderPromise = null; });
    return loaderPromise;
  }

  async function startEnhancements() {
    document.documentElement.dataset.companionEnhancements = "loading";
    try {
      const loader = await ensureLoader();
      await loader.load();
      await stabilizeCore();
      loader.refresh?.();
      document.documentElement.dataset.companionEnhancements = "ready";
    } catch (error) {
      console.warn("[Unlimited AI] companion enhancements degraded; preserving core chat", error);
      suppressEnhancementStyles();
      window.UnlimitedCompanionAssetsV174?.suppressStyles?.();
      document.documentElement.dataset.companionEnhancements = "degraded";
      try { await stabilizeCore(); } catch (repairError) {
        console.error("[Unlimited AI] companion core recovery failed", repairError);
      }
      if (window.__UNLIMITED_BOOT__) window.__UNLIMITED_BOOT__.companionEnhancementsError = error?.message || String(error);
    }
  }

  async function prepareAndEnter() {
    if (entryPromise) return entryPromise;
    entryPromise = (async () => {
      lastError = null;
      setCardState("loading", "正在验证基础陪伴空间…", "正在连接她…");
      try {
        await warmCore();
        if (document.body.dataset.uaiMode !== "lobby") return false;
        await enterCore();
        await stabilizeCore();
        if (!visibleCore()) throw new Error("Companion core is not visibly ready");
        setCardState("", "", "去见她");
        document.documentElement.dataset.companionEntryRevision = REVISION;
        window.dispatchEvent(new CustomEvent("uai:companion-core-entered", { detail: { revision: REVISION } }));
        window.setTimeout(startEnhancements, 180);
        return true;
      } catch (error) {
        lastError = error;
        console.error("[Unlimited AI] V17.4 companion entry failed", error);
        try { window.UnlimitedModeRouter?.showLobby?.(); } catch {}
        window.setTimeout(() => setCardState("error", "基础聊天没有正确打开，点击重试", "重试进入"), 0);
        return false;
      } finally {
        entryPromise = null;
      }
    })();
    return entryPromise;
  }

  function intercept(event) {
    const button = event.target?.closest?.("#uaiEnterCompanion");
    if (!button || document.body.dataset.uaiMode !== "lobby") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    prepareAndEnter();
  }

  function warmOnPointer(event) {
    const button = event.target?.closest?.("#uaiEnterCompanion");
    if (!button || document.body.dataset.uaiMode !== "lobby" || event.pointerType === "touch") return;
    if (warmTimer) window.clearTimeout(warmTimer);
    warmTimer = window.setTimeout(() => {
      warmTimer = 0;
      warmCore().catch(() => {});
    }, 120);
  }

  document.addEventListener("click", intercept, true);
  document.addEventListener("pointerover", warmOnPointer, { passive: true });
  document.addEventListener("focusin", (event) => {
    if (event.target?.closest?.("#uaiEnterCompanion") && document.body.dataset.uaiMode === "lobby") warmCore().catch(() => {});
  });

  window.UnlimitedCompanionEntryV174 = {
    revision: REVISION,
    enter: prepareAndEnter,
    warm: warmCore,
    repair: stabilizeCore,
    startEnhancements,
    suppressEnhancementStyles,
    get loading() { return Boolean(entryPromise); },
    get lastError() { return lastError; }
  };
})();