// public/companion-lazy-bridge.js
(() => {
  const REVISION = "2026-08-17-v14.5-companion-lazy-bridge";
  if (window.UnlimitedCompanionLazyBridge) return;

  let loaderPromise = null;
  let entryPromise = null;

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

  function setLoading(loading) {
    const root = document.getElementById("uaiModeRoot");
    if (!root) return;
    const companion = root.querySelector("#uaiEnterCompanion");
    root.querySelectorAll(".uai-mode-card").forEach((card) => { card.disabled = loading; });
    if (companion) {
      companion.classList.toggle("is-loading", loading);
      if (loading) companion.setAttribute("aria-busy", "true");
      else companion.removeAttribute("aria-busy");
    }
    root.dataset.companionAssetsLoading = loading ? "true" : "false";
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

  document.addEventListener("click", intercept, true);

  window.UnlimitedCompanionLazyBridge = {
    revision: REVISION,
    prepare: async () => {
      const loader = await ensureLoader();
      return loader.load();
    },
    enter: prepareAndEnter,
    get loading() { return Boolean(entryPromise); }
  };
})();