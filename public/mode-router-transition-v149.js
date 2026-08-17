// public/mode-router-transition-v149.js
// V14.9: three-phase world handoff choreography for the existing transition overlay.
(() => {
  const REVISION = "2026-08-17-v14.9-world-handoff";
  if (window.UnlimitedModeTransitionV149) return;

  const COPY = {
    novel: {
      phases: ["LOCK STORY", "LINK MEMORY", "OPEN STUDIO"],
      hints: ["正在锁定当前故事脉络", "记忆与连续性已连接", "创作空间正在展开"]
    },
    companion: {
      phases: ["LINK ROLE", "SYNC MEMORY", "OPEN HEART"],
      hints: ["正在连接角色与关系", "记忆与陪伴状态已同步", "她正在等你回来"]
    }
  };

  let root = null;
  let bodyObserver = null;
  let rootObserver = null;
  let activeKind = "";
  let transitionToken = 0;
  const timers = new Set();

  function prefersReducedMotion() {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }

  function clearTimers() {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
  }

  function later(callback, delay, token) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (token !== transitionToken) return;
      callback();
    }, delay);
    timers.add(timer);
  }

  function ensureDecor() {
    const content = root?.querySelector(".uai-transition-content");
    const symbol = content?.querySelector(".uai-transition-symbol");
    const hint = content?.querySelector("#uaiTransitionHint");
    if (!content || !symbol || !hint) return false;

    if (!content.querySelector(".uai-transition-orbits-v149")) {
      const orbits = document.createElement("span");
      orbits.className = "uai-transition-orbits-v149";
      orbits.setAttribute("aria-hidden", "true");
      orbits.innerHTML = "<i></i><i></i><i></i>";
      symbol.insertAdjacentElement("afterend", orbits);
    }

    if (!content.querySelector(".uai-transition-progress-v149")) {
      const progress = document.createElement("span");
      progress.className = "uai-transition-progress-v149";
      progress.setAttribute("aria-hidden", "true");
      progress.innerHTML = "<i></i>";
      hint.insertAdjacentElement("beforebegin", progress);
    }

    if (!content.querySelector(".uai-transition-phase-v149")) {
      const phase = document.createElement("span");
      phase.className = "uai-transition-phase-v149";
      phase.setAttribute("aria-hidden", "true");
      hint.insertAdjacentElement("beforebegin", phase);
    }

    return true;
  }

  function applyPhase(kind, index) {
    if (!root || !ensureDecor()) return;
    const copy = COPY[kind] || COPY.novel;
    const safeIndex = Math.max(0, Math.min(copy.phases.length - 1, index));
    const phase = root.querySelector(".uai-transition-phase-v149");
    const hint = root.querySelector("#uaiTransitionHint");

    root.dataset.v149TransitionPhase = String(safeIndex + 1);
    if (phase) phase.textContent = `${copy.phases[safeIndex]} · 0${safeIndex + 1}`;
    if (hint) hint.textContent = copy.hints[safeIndex];
  }

  function stopChoreography({ keepFinalCopy = false } = {}) {
    transitionToken += 1;
    clearTimers();
    activeKind = "";
    if (!root) return;
    delete root.dataset.v149TransitionPhase;
    if (!keepFinalCopy) {
      const phase = root.querySelector(".uai-transition-phase-v149");
      if (phase) phase.textContent = "";
    }
  }

  function startChoreography(kind) {
    if (!root || (kind !== "novel" && kind !== "companion")) return;
    if (activeKind === kind && root.dataset.v149TransitionPhase) return;

    transitionToken += 1;
    const token = transitionToken;
    clearTimers();
    activeKind = kind;
    applyPhase(kind, 0);

    if (prefersReducedMotion()) {
      applyPhase(kind, 2);
      return;
    }

    later(() => applyPhase(kind, 1), 165, token);
    later(() => applyPhase(kind, 2), 350, token);
  }

  function sync() {
    if (!root) return;
    ensureDecor();
    const transitioning = root.classList.contains("is-transitioning");
    const kind = root.dataset.transition || "";

    if (transitioning && (kind === "novel" || kind === "companion")) {
      startChoreography(kind);
      return;
    }

    if (activeKind || root.dataset.v149TransitionPhase) stopChoreography();
  }

  function install() {
    if (root?.isConnected) {
      sync();
      return true;
    }

    root = document.getElementById("uaiModeRoot");
    if (!root) return false;

    ensureDecor();
    rootObserver?.disconnect();
    rootObserver = new MutationObserver(sync);
    rootObserver.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-transition", "hidden"]
    });
    sync();

    document.documentElement.dataset.transitionPolishRevision = REVISION;
    return true;
  }

  if (!install()) {
    bodyObserver = new MutationObserver(() => {
      if (!install()) return;
      bodyObserver?.disconnect();
      bodyObserver = null;
    });
    bodyObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimers();
    else sync();
  });

  window.UnlimitedModeTransitionV149 = {
    revision: REVISION,
    refresh: sync,
    get phase() { return root?.dataset.v149TransitionPhase || ""; },
    get activeWorld() { return activeKind; }
  };
})();