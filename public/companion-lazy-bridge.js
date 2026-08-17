// public/companion-lazy-bridge.js
(() => {
  const REVISION = "2026-08-17-v14.7-companion-lazy-bridge+v14.8-entry-ux";
  if (window.UnlimitedCompanionLazyBridge) return;

  let loaderPromise = null;
  let entryPromise = null;
  let warmTimer = 0;
  let lastError = null;

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
    const novel = root?.querySelector("#uaiEnterNovel") || null;
    const enter = companion?.querySelector(".uai-mode-enter") || null;
    let status = companion?.querySelector(".uai-companion-entry-status") || null;

    if (companion && enter && !status) {
      status = document.createElement("span");
      status.className = "uai-companion-entry-status";
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
      status.hidden = true;
      enter.insertAdjacentElement("afterend", status);
    }

    return { root, companion, novel, enter, status };
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

  function originalLabel(companion, enter) {
    if (!companion) return "去见她";
    if (!companion.dataset.uaiOriginalEnterLabel && enter) {
      companion.dataset.uaiOriginalEnterLabel = labelNode(enter)?.textContent.trim() || "去见她";
    }
    return companion.dataset.uaiOriginalEnterLabel || "去见她";
  }

  function setLabel(companion, enter, text) {
    if (!enter) return;
    originalLabel(companion, enter);
    const node = labelNode(enter);
    if (node) node.data = `${text} `;
  }

  function setStatus(companion, status, state, message = "") {
    if (!companion) return;
    if (state) companion.dataset.uaiCompanionEntryState = state;
    else delete companion.dataset.uaiCompanionEntryState;
    if (!status) return;
    status.textContent = message;
    status.hidden = !message;
  }

  function lobbyInteractive() {
    const root = document.getElementById("uaiModeRoot");
    return Boolean(
      document.body.dataset.uaiMode === "lobby" &&
      root &&
      !root.hidden &&
      !root.classList.contains("is-transitioning")
    );
  }

  function finishLoadingVisual({ clearStatus = true } = {}) {
    const { root, companion, enter, status } = companionUi();
    if (!root) return;

    if (companion) {
      companion.classList.remove("is-loading");
      companion.removeAttribute("aria-busy");
      delete companion.dataset.uaiCompanionLoading;
      if (!root.classList.contains("is-transitioning") && document.body.dataset.uaiMode === "lobby") {
        companion.disabled = false;
      }
    }

    if (enter) enter.style.removeProperty("background");
    root.style.removeProperty("--uai-companion-load-progress");
    delete root.dataset.companionAssetsLoading;

    if (clearStatus) {
      setStatus(companion, status, "", "");
      setLabel(companion, enter, originalLabel(companion, enter));
    }
  }

  function beginLoadingVisual() {
    const { root, companion, novel, enter, status } = companionUi();
    if (!root || !companion) return;

    lastError = null;
    originalLabel(companion, enter);
    root.querySelector("#uaiModeGrid")?.removeAttribute("data-active");

    // Only the companion entry is locked. The novel card stays available so a slow
    // companion bundle never traps the user in the lobby.
    companion.disabled = true;
    if (!root.classList.contains("is-transitioning") && novel) novel.disabled = false;

    companion.classList.add("is-loading");
    companion.setAttribute("aria-busy", "true");
    companion.dataset.uaiCompanionLoading = "true";
    root.dataset.companionAssetsLoading = "true";
    root.style.setProperty("--uai-companion-load-progress", "0%");
    setStatus(companion, status, "loading", "正在准备角色、记忆与语音组件；小说模式仍可直接进入");
    setLabel(companion, enter, "正在准备陪伴世界…");
  }

  function showFailure(error) {
    lastError = error;
    finishLoadingVisual({ clearStatus: false });
    const { companion, enter, status } = companionUi();
    if (!companion) return;

    const offline = navigator.onLine === false;
    setStatus(
      companion,
      status,
      "error",
      offline ? "网络连接已断开，恢复网络后点击这张卡片重试" : "加载没有完成，点击这张卡片即可重试"
    );
    setLabel(companion, enter, "重试进入");
  }

  function updateProgress(event) {
    if (!entryPromise) return;
    const detail = event?.detail || {};
    const loaded = Number(detail.loaded) || 0;
    const total = Math.max(1, Number(detail.total) || 1);
    const percent = Math.max(0, Math.min(100, Number(detail.percent) || 0));
    const { root, companion, enter, status } = companionUi();
    if (!root || !companion || !enter) return;

    setStatus(companion, status, "loading", "正在准备角色、记忆与语音组件；小说模式仍可直接进入");
    setLabel(companion, enter, `正在唤醒陪伴世界 · ${loaded}/${total}`);
    root.style.setProperty("--uai-companion-load-progress", `${percent}%`);
    enter.style.background = `linear-gradient(90deg, rgba(255,96,188,.20) 0 ${percent}%, rgba(255,255,255,.04) ${percent}% 100%)`;
  }

  async function prepareAndEnter() {
    if (entryPromise) return entryPromise;

    entryPromise = (async () => {
      beginLoadingVisual();
      try {
        const loader = await ensureLoader();
        await loader.load();

        // The user may choose Novel while the companion bundle is loading. In that case
        // keep the completed bundle warm for next time, but never pull them back to Companion.
        if (!lobbyInteractive()) {
          finishLoadingVisual();
          return;
        }

        finishLoadingVisual();
        await window.UnlimitedModeRouter?.enterCompanion?.();
      } catch (error) {
        console.error("[Unlimited AI] deferred companion assets failed", error);
        if (lobbyInteractive()) showFailure(error);
        else finishLoadingVisual();
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

  function handleOnline() {
    const { companion, enter, status } = companionUi();
    if (!companion || companion.dataset.uaiCompanionEntryState !== "error" || !lobbyInteractive()) return;
    setStatus(companion, status, "error", "网络已恢复，点击这张卡片重新进入陪伴世界");
    setLabel(companion, enter, "重试进入");
  }

  document.addEventListener("click", intercept, true);
  document.addEventListener("pointerover", scheduleWarm, { passive: true });
  document.addEventListener("pointerout", cancelWarm, { passive: true });
  document.addEventListener("focusin", warmOnFocus);
  window.addEventListener("online", handleOnline);
  window.addEventListener("uai:companion-assets-progress", updateProgress);

  window.UnlimitedCompanionLazyBridge = {
    revision: REVISION,
    prepare: async () => {
      const loader = await ensureLoader();
      return loader.load();
    },
    warm: ensureLoader,
    enter: prepareAndEnter,
    get loading() { return Boolean(entryPromise); },
    get lastError() { return lastError; }
  };
})();