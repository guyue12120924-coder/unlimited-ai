// public/companion-entry-v175.js
// V17.5 emergency rollback: keep companion entry on the proven core only.
(() => {
  const REVISION = "2026-08-22-v17.5-companion-core-only-rollback";
  const CORE_TIMEOUT_MS = 8000;
  const ENTRY_TIMEOUT_MS = 2600;
  if (window.UnlimitedCompanionEntryV175) return;

  const ENHANCEMENT_IDS = [
    "uaiCompanionCharactersCss", "uaiCompanionMemoryCss", "uaiCompanionRecordsCss", "uaiCompanionSupportCss",
    "uaiCompanionV10Css", "uaiCompanionV10VibrantCss", "uaiCompanionV10Stage2Css", "uaiCompanionV10Stage3Css",
    "uaiCompanionV10Stage4Css", "uaiCompanionV10Stage5Css", "uaiCompanionV10Stage6Css",
    "uaiCompanionV11Css", "uaiCompanionV11Stage1Css", "uaiCompanionV11Stage2Css", "uaiCompanionV11Stage3Css",
    "uaiCompanionV11Stage4Css", "uaiCompanionV12GalaxyCss", "uaiCompanionV12Stage2Css", "uaiCompanionV12FinalCss",
    "uaiCompanionV12PolishCss", "uaiCompanionV124Phase1Css", "uaiCompanionV12Phase2BackgroundCss",
    "uaiCompanionV12Phase3CharacterCss", "uaiCompanionV12Phase4ThemesCss", "uaiCompanionV12Phase5SceneStateCss",
    "uaiCompanionLive2dCss", "uaiCompanionLive2dInteractionCss", "uaiCompanionLive2dVoiceCss",
    "uaiCompanionLive2dNeuralVoiceCss", "uaiCompanionVoiceInputCss", "uaiCompanionCallModeCss",
    "uaiCompanionLive2dModelPoolCss", "uaiCompanionLive2DPolishCss", "uaiCompanionLive2dEmotionEngineCss",
    "uaiCompanionV123UxHardeningCss", "uaiCompanionAssetsLoaderV174Script", "uaiCompanionV125GuaranteedMotionCss"
  ];

  let entryPromise = null;
  let warmPromise = null;
  let warmTimer = 0;
  let lastError = null;

  function removeEnhancementResidue() {
    for (const id of ENHANCEMENT_IDS) document.getElementById(id)?.remove();
    document.querySelectorAll("[data-uai-companion-enhancement='true']").forEach((node) => node.remove());
    const root = document.getElementById("uaiCompanionRoot");
    root?.querySelectorAll([
      ".uai-c-v12-sidepanel",
      ".uai-c-v122-scene",
      ".uai-c-v125-scene",
      ".uai-c-v127-theme-layer",
      ".uai-c-v125-live-bg",
      ".uai-c-v126-heart-field",
      ".uai-c-live2d-layer",
      ".uai-c-v21-model-pool"
    ].join(",")).forEach((node) => node.remove());
    delete document.documentElement.dataset.companionEnhancementCommit;
    document.documentElement.dataset.companionEnhancements = "disabled";
    document.documentElement.dataset.companionEnhancementStyles = "disabled";
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
      let timer = 0;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        if (timer) window.clearTimeout(timer);
        link.removeEventListener("load", onLoad);
        link.removeEventListener("error", onError);
        error ? reject(error) : resolve(link);
      };
      const onLoad = () => finish();
      const onError = () => finish(new Error("Failed to load companion-mode.css"));
      link.addEventListener("load", onLoad, { once: true });
      link.addEventListener("error", onError, { once: true });
      timer = window.setTimeout(() => finish(new Error("Timed out loading companion-mode.css")), CORE_TIMEOUT_MS);
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
      if (!script) {
        script = document.createElement("script");
        script.id = "uaiCompanionScript";
        script.async = false;
        script.src = `/companion-mode.js?v=${encodeURIComponent(REVISION)}`;
        document.body.appendChild(script);
      }
      let settled = false;
      let timer = 0;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        if (timer) window.clearTimeout(timer);
        script.removeEventListener("load", onLoad);
        script.removeEventListener("error", onError);
        if (error) return reject(error);
        if (!window.UnlimitedCompanion?.mount) return reject(new Error("companion-mode.js loaded without mount()"));
        resolve(window.UnlimitedCompanion);
      };
      const onLoad = () => requestAnimationFrame(() => finish());
      const onError = () => finish(new Error("Failed to load companion-mode.js"));
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      timer = window.setTimeout(() => finish(new Error("Timed out loading companion-mode.js")), CORE_TIMEOUT_MS);
      if (window.UnlimitedCompanion?.mount) finish();
    });
  }

  function warmCore() {
    removeEnhancementResidue();
    if (warmPromise) return warmPromise;
    warmPromise = Promise.all([ensureCoreStyle(), ensureCoreScript()])
      .then(() => true)
      .finally(() => { warmPromise = null; });
    return warmPromise;
  }

  function visibleCore() {
    const root = document.getElementById("uaiCompanionRoot");
    return Boolean(
      document.body.dataset.uaiMode === "companion" &&
      root && !root.hidden && root.isConnected &&
      root.querySelector(".uai-c-shell") &&
      root.querySelector(".uai-c-main") &&
      root.querySelector("#uaiCompanionMessages") &&
      root.querySelector("#uaiCompanionInput")
    );
  }

  function exitToLobby() {
    removeEnhancementResidue();
    window.UnlimitedModeRouter?.showLobby?.();
  }

  function directMount() {
    removeEnhancementResidue();
    document.documentElement.classList.remove("uai-mode-gate-pending");
    document.body.dataset.uaiMode = "companion";
    const lobby = document.getElementById("uaiModeRoot");
    if (lobby) {
      lobby.classList.remove("is-transitioning", "is-returning");
      delete lobby.dataset.transition;
      lobby.hidden = true;
    }
    window.UnlimitedCompanion.mount({ onExit: exitToLobby });
    if (!visibleCore()) throw new Error("Companion core mount did not create a complete shell");
    return true;
  }

  async function hardReloadCore() {
    removeEnhancementResidue();
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
      console.warn("[Unlimited AI] companion router handoff failed; using core-only direct mount", error);
      return directMount();
    }
    if (!visibleCore()) return directMount();
    return true;
  }

  async function stabilizeCore() {
    removeEnhancementResidue();
    if (document.body.dataset.uaiMode !== "companion") return false;
    let root = document.getElementById("uaiCompanionRoot");
    const complete = () => Boolean(
      root?.querySelector(".uai-c-shell") &&
      root.querySelector(".uai-c-main") &&
      root.querySelector("#uaiCompanionMessages") &&
      root.querySelector("#uaiCompanionInput")
    );
    if (!complete()) {
      await hardReloadCore();
      root = document.getElementById("uaiCompanionRoot");
    } else {
      window.UnlimitedCompanion?.mount?.({ onExit: exitToLobby });
    }
    if (!visibleCore()) throw new Error("Companion core shell is incomplete after recovery");
    return true;
  }

  async function prepareAndEnter() {
    if (entryPromise) return entryPromise;
    entryPromise = (async () => {
      lastError = null;
      setCardState("loading", "正在进入稳定陪伴模式…", "正在连接她…");
      try {
        await warmCore();
        if (document.body.dataset.uaiMode !== "lobby") return false;
        await enterCore();
        if (document.body.dataset.uaiMode !== "companion") return false;
        await stabilizeCore();
        if (!visibleCore()) throw new Error("Companion core is not visibly ready");
        removeEnhancementResidue();
        document.documentElement.dataset.companionEntryRevision = REVISION;
        document.documentElement.dataset.companionEnhancements = "disabled";
        setCardState("", "", "去见她");
        window.dispatchEvent(new CustomEvent("uai:companion-core-entered", { detail: { revision: REVISION, coreOnly: true } }));
        return true;
      } catch (error) {
        lastError = error;
        console.error("[Unlimited AI] V17.5 core-only companion entry failed", error);
        try { exitToLobby(); } catch {}
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
  window.addEventListener("uai:mode-refresh", () => {
    removeEnhancementResidue();
  });

  removeEnhancementResidue();
  window.UnlimitedCompanionEntryV175 = {
    revision: REVISION,
    coreOnly: true,
    enter: prepareAndEnter,
    warm: warmCore,
    repair: stabilizeCore,
    removeEnhancementResidue,
    get loading() { return Boolean(entryPromise); },
    get lastError() { return lastError; }
  };
})();