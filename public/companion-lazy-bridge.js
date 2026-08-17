// public/companion-lazy-bridge.js
(() => {
  const REVISION = "2026-08-17-v14.7-companion-lazy-bridge";
  if (window.UnlimitedCompanionLazyBridge) return;

  let loaderPromise = null;
  let entryPromise = null;
  let warmTimer = 0;

  function loaderReady() {
    return Boolean(window.UnlimitedCompanionAssets?.load);
  }

  function ensureLoader() {
    if (loaderReady()) return Promise.resolve(window.UnlimitedCompanionAssets);
    if (loaderPromise) return loaderPromise;

    loaderPromise = new Promise((resolve, reject) => {
      let script = document.getElementById("uaiCompanionAssetsLoaderScript");
      if (script?.dataset.uaiLoaded === "false") {
        script.remove();
        script = null;
      }

      const isNew = !script;
      if (!script) {
        script = document.createElement("script");
        script.id = "uaiCompanionAssetsLoaderScript";
        script.async = false;
        script.src = `/companion-assets-loader.js?v=${encodeURIComponent(REVISION)}`;
        script.dataset.uaiCompanionLazy = "true";
      }

      let settled = false;
      let timer = 0;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        if (timer) window.clearTimeout(timer);
        script.removeEventListener("load", onLoad);
        script.removeEventListener("error", onError);
        if (error) {
          script.dataset.uaiLoaded = "false";
          loaderPromise = null;
          reject(error);
          return;
        }
        if (!loaderReady()) {
          loaderPromise = null;
          reject(new Error("Companion asset loader did not initialize"));
          return;
        }
        script.dataset.uaiLoaded = "true";
        resolve(window.UnlimitedCompanionAssets);
      };
      const onLoad = () => requestAnimationFrame(() => finish());
      const onError = () => finish(new Error("Failed to load companion-assets-loader.js"));

      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      timer = window.setTimeout(() => finish(new Error("Companion asset loader timed out")), 15000);

      if (isNew) document.body.appendChild(script);
      if (loaderReady()) finish();
    });

    return loaderPromise;
  }

  function companionUi() {
    const root = document.getElementById("uaiModeRoot");
    const companion = root?.querySelector("#uaiEnterCompanion") || null;
    const enter = companion?.querySelector(".uai-mode-enter") || null;
    return { root, companion, enter };
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

  function restoreLoadingUi() {
    const { root, companion, enter } = companionUi();
    if (!root) return;
    root.querySelectorAll(".uai-mode-card").forEach((card) => { card.disabled = false; });
    if (companion) {
      companion.classList.remove("is-loading");
      companion.removeAttribute("aria-busy");
      delete companion.dataset.uaiCompanionLoading;
    }
    if (enter) {
      const node = labelNode(enter);
      if (node) node.data = `${companion?.dataset.uaiOriginalEnterLabel || "去见她"} `;
      enter.style.removeProperty("background");
    }
    root.style.removeProperty("--uai-companion-load-progress");
    delete root.dataset.companionAssetsLoading;
  }

  function setLoading(loading) {
    const { root, companion, enter } = companionUi();
    if (!root) return;
    root.querySelectorAll(".uai-mode-card").forEach((card) => { card.disabled = loading; });
    if (companion) {
      if (!companion.dataset.uaiOriginalEnterLabel && enter) {
        companion.dataset.uaiOriginalEnterLabel = labelNode(enter)?.textContent.trim() || "去见她";
      }
      companion.classList.toggle("is-loading", loading);
      if (loading) {
        companion.setAttribute("aria-busy", "true");
        companion.dataset.uaiCompanionLoading = "true";
      } else {
        companion.removeAttribute("aria-busy");
        delete companion.dataset.uaiCompanionLoading;
      }
    }
    root.dataset.companionAssetsLoading = loading ? "true" : "false";

    if (!loading) restoreLoadingUi();
    else if (enter) {
      const node = labelNode(enter);
      if (node) node.data = "正在准备陪伴世界… ";
    }
  }

  function updateProgress(event) {
    if (!entryPromise) return;
    const detail = event?.detail || {};
    const loaded = Number(detail.loaded) || 0;
    const total = Math.max(1, Number(detail.total) || 1);
    const percent = Math.max(0, Math.min(100, Number(detail.percent) || 0));
    const { root, enter } = companionUi();
    if (!root || !enter) return;
    const node = labelNode(enter);
    if (node) node.data = `正在唤醒陪伴世界 · ${loaded}/${total} `;
    root.style.setProperty("--uai-companion-load-progress", `${percent}%`);
    enter.style.background = `linear-gradient(90deg, rgba(255,96,188,.20) 0 ${percent}%, rgba(255,255,255,.04) ${percent}% 100%)`;
  }

  async function prepareAndEnter() {
    if (entryPromise) return entryPromise;

    entryPromise = (async () => {
      setLoading(true);
      try {
        const loader = await ensureLoader();
        await loader.load();
        if (document.body.dataset.uaiMode !== "lobby") return;
        setLoading(false);
        await window.UnlimitedModeRouter?.enterCompanion?.();
      } catch (error) {
        console.error("[Unlimited AI] deferred companion assets failed", error);
        setLoading(false);
        alert("AI 陪伴资源加载失败，请再试一次。小说模式不会受到影响。");
      } finally {
        entryPromise = null;
      }
    })();

    return entryPromise;
  }

  function intercept(event) {
    const button = event.target?.closest?.("#uaiEnterCompanion");
    if (!button || document.body.dataset.uaiMode !== "lobby") return;
    if (window.UnlimitedCompanionAssets?.ready) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    prepareAndEnter();
  }

  function scheduleWarm(event) {
    const button = event.target?.closest?.("#uaiEnterCompanion");
    if (!button || document.body.dataset.uaiMode !== "lobby") return;
    if (event.pointerType === "touch" || window.UnlimitedCompanionAssets?.ready || loaderReady()) return;
    if (event.relatedTarget && button.contains(event.relatedTarget)) return;
    if (warmTimer) window.clearTimeout(warmTimer);
    warmTimer = window.setTimeout(() => {
      warmTimer = 0;
      ensureLoader().catch(() => {});
    }, 160);
  }

  function cancelWarm(event) {
    const button = event.target?.closest?.("#uaiEnterCompanion");
    if (!button || !warmTimer) return;
    if (event.relatedTarget && button.contains(event.relatedTarget)) return;
    window.clearTimeout(warmTimer);
    warmTimer = 0;
  }

  function warmOnFocus(event) {
    if (!event.target?.closest?.("#uaiEnterCompanion") || document.body.dataset.uaiMode !== "lobby") return;
    ensureLoader().catch(() => {});
  }

  document.addEventListener("click", intercept, true);
  document.addEventListener("pointerover", scheduleWarm, { passive: true });
  document.addEventListener("pointerout", cancelWarm, { passive: true });
  document.addEventListener("focusin", warmOnFocus);
  window.addEventListener("uai:companion-assets-progress", updateProgress);

  window.UnlimitedCompanionLazyBridge = {
    revision: REVISION,
    prepare: async () => {
      const loader = await ensureLoader();
      return loader.load();
    },
    warm: ensureLoader,
    enter: prepareAndEnter,
    get loading() { return Boolean(entryPromise); }
  };
})();