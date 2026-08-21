// public/companion-entry-v172.js
// V17.2: the companion core is the entry boundary; optional enhancements load afterwards.
(() => {
  const REVISION = "2026-08-21-v17.2-companion-direct-core-entry";
  const CORE_TIMEOUT_MS = 8000;
  const ENTRY_TIMEOUT_MS = 2200;
  const ENHANCEMENT_LOADER_URL = "/companion-assets-loader.js?v=20260821-v17.2-companion-direct-core-entry";
  if (window.UnlimitedCompanionEntryV172) return;

  let entryPromise = null;
  let warmPromise = null;
  let enhancementPromise = null;
  let warmTimer = 0;
  let lastError = null;

  function ui() {
    const root = document.getElementById("uaiModeRoot");
    const card = root?.querySelector("#uaiEnterCompanion") || null;
    const novel = root?.querySelector("#uaiEnterNovel") || null;
    const enter = card?.querySelector(".uai-mode-enter") || null;
    let status = card?.querySelector(".uai-companion-entry-status") || null;
    if (card && enter && !status) {
      status = document.createElement("span");
      status.className = "uai-companion-entry-status";
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
      status.hidden = true;
      enter.insertAdjacentElement("afterend", status);
    }
    return { root, card, novel, enter, status };
  }

  function labelNode(enter) {
    if (!enter) return null;
    let node = [...enter.childNodes].find((item) => item.nodeType === 3 && item.textContent.trim());
    if (!node) {
      node = document.createTextNode("");
      enter.insertBefore(node, enter.querySelector("b"));
    }
    return node;
  }

  function originalLabel(card, enter) {
    if (!card) return "去见她";
    if (!card.dataset.uaiOriginalEnterLabel && enter) {
      card.dataset.uaiOriginalEnterLabel = labelNode(enter)?.textContent.trim() || "去见她";
    }
    return card.dataset.uaiOriginalEnterLabel || "去见她";
  }

  function setLabel(card, enter, text) {
    if (!enter) return;
    originalLabel(card, enter);
    const node = labelNode(enter);
    if (node) node.data = `${text} `;
  }

  function setState(state, message, label) {
    const { root, card, novel, enter, status } = ui();
    if (!card) return;
    originalLabel(card, enter);
    if (state) card.dataset.uaiCompanionEntryState = state;
    else delete card.dataset.uaiCompanionEntryState;
    card.classList.toggle("is-loading", state === "loading");
    if (state === "loading") {
      card.disabled = true;
      card.setAttribute("aria-busy", "true");
      if (novel && !root?.classList.contains("is-transitioning")) novel.disabled = false;
    } else {
      card.removeAttribute("aria-busy");
      if (document.body.dataset.uaiMode === "lobby" && !root?.classList.contains("is-transitioning")) card.disabled = false;
    }
    if (status) {
      status.textContent = message || "";
      status.hidden = !message;
    }
    setLabel(card, enter, label || originalLabel(card, enter));
  }

  function withTimeout(promise, ms, code, message) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        const error = new Error(message);
        error.code = code;
        reject(error);
      }, ms);
      Promise.resolve(promise).then((value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      }, (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(error);
      });
    });
  }

  function ensureCoreStyle() {
    return new Promise((resolve, reject) => {
      let link = document.getElementById("uaiCompanionCss");
      if (link && (link.dataset.uaiDeferredPlaceholder === "true" || link.tagName !== "LINK")) {
        link.remove();
        link = null;
      }
      if (link?.sheet) {
        resolve(link);
        return;
      }
      if (!link) {
        link = document.createElement("link");
        link.id = "uaiCompanionCss";
        link.rel = "stylesheet";
        link.href = `/companion-mode.css?v=${encodeURIComponent(REVISION)}`;
        link.dataset.uaiCompanionCore = "true";
        document.head.appendChild(link);
      }
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        link.removeEventListener("load", onLoad);
        link.removeEventListener("error", onError);
        if (error) reject(error);
        else resolve(link);
      };
      const onLoad = () => finish();
      const onError = () => finish(new Error("Failed to load companion-mode.css"));
      link.addEventListener("load", onLoad, { once: true });
      link.addEventListener("error", onError, { once: true });
      const timer = window.setTimeout(() => finish(new Error("Timed out loading companion-mode.css")), CORE_TIMEOUT_MS);
      if (link.sheet) finish();
    });
  }

  function ensureCoreScript() {
    if (window.UnlimitedCompanion?.mount) return Promise.resolve(window.UnlimitedCompanion);
    return new Promise((resolve, reject) => {
      let script = document.getElementById("uaiCompanionScript");
      if (script?.dataset.uaiLoaded === "false") {
        script.remove();
        script = null;
      }
      if (!script) {
        script = document.createElement("script");
        script.id = "uaiCompanionScript";
        script.async = false;
        script.src = `/companion-mode.js?v=${encodeURIComponent(REVISION)}`;
        script.dataset.uaiCompanionCore = "true";
        document.body.appendChild(script);
      }
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        script.removeEventListener("load", onLoad);
        script.removeEventListener("error", onError);
        if (error) {
          script.dataset.uaiLoaded = "false";
          reject(error);
          return;
        }
        if (!window.UnlimitedCompanion?.mount) {
          reject(new Error("companion-mode.js loaded without mount()"));
          return;
        }
        script.dataset.uaiLoaded = "true";
        resolve(window.UnlimitedCompanion);
      };
      const onLoad = () => requestAnimationFrame(() => finish());
      const onError = () => finish(new Error("Failed to load companion-mode.js"));
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      const timer = window.setTimeout(() => finish(new Error("Timed out loading companion-mode.js")), CORE_TIMEOUT_MS);
      if (window.UnlimitedCompanion?.mount) finish();
    });
  }

  function warmCore() {
    if (window.UnlimitedCompanion?.mount && document.getElementById("uaiCompanionCss")?.sheet) {
      return Promise.resolve(true);
    }
    if (warmPromise) return warmPromise;
    warmPromise = Promise.all([ensureCoreStyle(), ensureCoreScript()])
      .then(() => true)
      .finally(() => { warmPromise = null; });
    return warmPromise;
  }

  function companionVisible() {
    const companionRoot = document.getElementById("uaiCompanionRoot");
    return Boolean(
      document.body.dataset.uaiMode === "companion" &&
      companionRoot &&
      !companionRoot.hidden
    );
  }

  function clearTransitionOverlay() {
    const root = document.getElementById("uaiModeRoot");
    if (!root) return;
    root.classList.remove("is-transitioning", "is-returning");
    delete root.dataset.transition;
    delete root.dataset.v149TransitionPhase;
    root.querySelector("#uaiModeTransition")?.setAttribute("aria-hidden", "true");
    root.querySelectorAll(".uai-mode-card").forEach((card) => {
      card.disabled = false;
      card.removeAttribute("aria-busy");
      card.classList.remove("is-loading");
    });
  }

  function forceCoreEntry() {
    if (!window.UnlimitedCompanion?.mount) throw new Error("Companion core is unavailable for direct entry");
    clearTransitionOverlay();
    document.documentElement.classList.remove("uai-mode-gate-pending");
    document.body.dataset.uaiMode = "companion";
    const root = document.getElementById("uaiModeRoot");
    if (root) root.hidden = true;
    window.UnlimitedCompanion.mount({
      onExit: () => window.UnlimitedModeRouter?.showLobby?.()
    });
    if (!document.getElementById("uaiCompanionRoot")) {
      throw new Error("Companion core mount did not create its root");
    }
    document.documentElement.dataset.companionEntryFallback = REVISION;
    return true;
  }

  async function enterCore() {
    const router = window.UnlimitedModeRouter;
    if (!router?.enterCompanion) return forceCoreEntry();

    try {
      await withTimeout(
        router.enterCompanion(),
        ENTRY_TIMEOUT_MS,
        "COMPANION_ROUTER_TIMEOUT",
        "Companion router entry timed out"
      );
    } catch (error) {
      console.warn("[Unlimited AI] router companion handoff failed; using direct core entry", error);
      return forceCoreEntry();
    }

    if (!companionVisible()) {
      console.warn("[Unlimited AI] router returned without a visible companion root; using direct core entry");
      return forceCoreEntry();
    }
    return true;
  }

  function ensureEnhancementLoader() {
    if (window.UnlimitedCompanionAssets?.load) return Promise.resolve(window.UnlimitedCompanionAssets);
    if (enhancementPromise) return enhancementPromise;
    enhancementPromise = new Promise((resolve, reject) => {
      let script = document.getElementById("uaiCompanionAssetsLoaderScript");
      if (script?.dataset.uaiLoaded === "false") {
        script.remove();
        script = null;
      }
      if (!script) {
        script = document.createElement("script");
        script.id = "uaiCompanionAssetsLoaderScript";
        script.async = false;
        script.src = ENHANCEMENT_LOADER_URL;
        script.dataset.uaiCompanionEnhancements = "true";
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
        else if (!window.UnlimitedCompanionAssets?.load) reject(new Error("Companion enhancement loader did not initialize"));
        else resolve(window.UnlimitedCompanionAssets);
      };
      const onLoad = () => finish();
      const onError = () => finish(new Error("Failed to load companion enhancement loader"));
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      const timer = window.setTimeout(() => finish(new Error("Companion enhancement loader timed out")), 12000);
      if (window.UnlimitedCompanionAssets?.load) finish();
    }).finally(() => { enhancementPromise = null; });
    return enhancementPromise;
  }

  function startEnhancements() {
    document.documentElement.dataset.companionEnhancements = "loading";
    ensureEnhancementLoader()
      .then((loader) => loader.load())
      .then(() => {
        document.documentElement.dataset.companionEnhancements = "ready";
      })
      .catch((error) => {
        console.warn("[Unlimited AI] optional companion enhancements failed; core chat remains available", error);
        document.documentElement.dataset.companionEnhancements = "degraded";
        window.__UNLIMITED_BOOT__ && (window.__UNLIMITED_BOOT__.companionEnhancementsError = error?.message || String(error));
      });
  }

  async function prepareAndEnter() {
    if (entryPromise) return entryPromise;
    entryPromise = (async () => {
      lastError = null;
      setState("loading", "正在打开基础陪伴空间…", "正在连接她…");
      try {
        await warmCore();
        if (document.body.dataset.uaiMode !== "lobby") return false;
        setState("loading", "陪伴核心已就绪，正在打开聊天…", "马上见到她…");
        await enterCore();
        if (!companionVisible()) throw new Error("Companion entry completed without a visible core UI");
        setState("", "", "去见她");
        window.dispatchEvent(new CustomEvent("uai:companion-core-entered", { detail: { revision: REVISION } }));
        window.setTimeout(startEnhancements, 0);
        return true;
      } catch (error) {
        lastError = error;
        console.error("[Unlimited AI] companion core entry failed", error);
        try { window.UnlimitedModeRouter?.showLobby?.(); } catch {}
        window.setTimeout(() => {
          setState("error", "基础陪伴页面没有打开，点击这张卡片重试", "重试进入");
        }, 0);
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

  function scheduleWarm(event) {
    const button = event.target?.closest?.("#uaiEnterCompanion");
    if (!button || document.body.dataset.uaiMode !== "lobby" || event.pointerType === "touch") return;
    if (event.relatedTarget && button.contains(event.relatedTarget)) return;
    if (warmTimer) window.clearTimeout(warmTimer);
    warmTimer = window.setTimeout(() => {
      warmTimer = 0;
      warmCore().catch(() => {});
    }, 120);
  }

  function cancelWarm(event) {
    const button = event.target?.closest?.("#uaiEnterCompanion");
    if (!button || !warmTimer) return;
    if (event.relatedTarget && button.contains(event.relatedTarget)) return;
    window.clearTimeout(warmTimer);
    warmTimer = 0;
  }

  function focusWarm(event) {
    if (!event.target?.closest?.("#uaiEnterCompanion") || document.body.dataset.uaiMode !== "lobby") return;
    warmCore().catch(() => {});
  }

  document.addEventListener("click", intercept, true);
  document.addEventListener("pointerover", scheduleWarm, { passive: true });
  document.addEventListener("pointerout", cancelWarm, { passive: true });
  document.addEventListener("focusin", focusWarm);

  window.UnlimitedCompanionEntryV172 = {
    revision: REVISION,
    enter: prepareAndEnter,
    warm: warmCore,
    startEnhancements,
    forceCoreEntry,
    get loading() { return Boolean(entryPromise); },
    get lastError() { return lastError; }
  };
})();