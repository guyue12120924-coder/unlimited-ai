// Companion V12.23 — final interaction hardening for the desktop companion shell.
(() => {
  if (window.UnlimitedCompanionV123UXHardening) return;

  const REVISION = "2026-08-15-v12.23-ux-hardening-1";
  const COLLAPSE_KEY = "uai_companion_sidebar_collapsed_v1";
  const IMMERSIVE_KEY = "uai_companion_immersive_v1";
  let scheduled = false;
  let observer = null;

  function liveRoot() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const root = document.getElementById("uaiCompanionRoot");
    return root && !root.hidden && root.isConnected ? root : null;
  }

  function boolValue(value) {
    return value === true || value === "1" || value === "true";
  }

  function setSidebarCollapsed(root, collapsed, options = {}) {
    if (!root) return false;
    const enabled = Boolean(collapsed);
    root.classList.toggle("uai-c-v123-sidebar-collapsed", enabled);
    if (!options.noStore) localStorage.setItem(COLLAPSE_KEY, enabled ? "1" : "0");
    const button = root.querySelector(".uai-c-v121-brand > button");
    if (button) {
      button.textContent = enabled ? "››" : "‹‹";
      button.title = enabled ? "展开侧栏" : "收起侧栏";
      button.setAttribute("aria-label", enabled ? "展开侧栏" : "收起侧栏");
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
    }
    return enabled;
  }

  function setImmersive(root, enabled, options = {}) {
    if (!root) return false;
    const next = Boolean(enabled);
    root.classList.add("uai-c-v123-layout-switching");
    root.classList.toggle("uai-c-v11-immersive", next);
    if (!options.noStore) localStorage.setItem(IMMERSIVE_KEY, next ? "1" : "0");
    const button = root.querySelector("#uaiV11ImmersiveToggle");
    if (button) {
      button.classList.toggle("active", next);
      button.setAttribute("aria-pressed", next ? "true" : "false");
      const label = button.querySelector("span");
      if (label) label.textContent = next ? "退出沉浸" : "沉浸";
    }
    document.documentElement.dataset.companionImmersive = next ? "1" : "0";
    // Two frames are enough for Grid/Live2D ResizeObserver to settle while all
    // old layout transitions are suppressed by the V12.23 CSS.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.classList.remove("uai-c-v123-layout-switching");
      window.UnlimitedCompanionLive2D?.refresh?.();
    }));
    return next;
  }

  function closeRoleMenu(root) {
    const menu = root?.querySelector(".uai-c-v10-role-menu:not([hidden])");
    if (!menu) return;
    menu.setAttribute("hidden", "");
    const more = menu.parentElement?.querySelector(".uai-c-v10-role-more");
    more?.setAttribute("aria-expanded", "false");
  }

  function syncRoleMenu(root) {
    root?.querySelectorAll(".uai-c-profile-card").forEach((card) => {
      const open = card.querySelector(".uai-c-v10-role-more")?.getAttribute("aria-expanded") === "true"
        && Boolean(card.querySelector(".uai-c-v10-role-menu:not([hidden])"));
      card.classList.toggle("uai-c-v123-role-menu-open", open);
    });
  }

  function modernSceneReady(root) {
    return Boolean(root?.querySelector(".uai-c-v125-scene, .uai-c-v127-theme-layer"));
  }

  function suppressLegacyRenderers(root) {
    const modern = modernSceneReady(root);
    root?.classList.toggle("uai-c-v123-modern-scene", modern);
    if (!modern) return;
    // These two are fallback/legacy ambience layers. Keeping their RAF/canvas
    // compositing visible underneath the newer theme scene caused occasional
    // full-screen flashes when immersive mode changed the grid dimensions.
    root.querySelectorAll(".uai-c-v121-sparkle-layer, .uai-c-v12-galaxy-layer").forEach((node) => {
      node.setAttribute("aria-hidden", "true");
      node.style.display = "none";
    });
  }

  function neuralVoiceApi() {
    return window.UnlimitedCompanionNeuralVoice || null;
  }

  async function toggleVoice(root) {
    const neural = neuralVoiceApi();
    if (neural?.getSettings && neural?.setSettings) {
      const next = !Boolean(neural.getSettings()?.enabled);
      neural.setSettings({ enabled: next });
      if (!next) neural.stop?.({ keepLast: true });
      else await neural.speak?.("语音已经打开啦。以后我的回复会说给你听。", { force: true, preview: true });
      schedule();
      return next;
    }

    const base = window.UnlimitedCompanionVoice;
    if (!base?.getSettings || !base?.setSettings) return false;
    const next = !Boolean(base.getSettings()?.enabled);
    base.setSettings({ enabled: next });
    if (!next) base.stop?.();
    else if (base.supported?.()) await base.speak?.("语音已经打开啦。", { force: true, preview: true });
    schedule();
    return next;
  }

  function syncVoiceControls(root) {
    const neural = neuralVoiceApi();
    const neuralToggle = root?.querySelector("#uaiCompanionNeuralVoiceToggle");
    if (neuralToggle && neural) {
      neuralToggle.disabled = false;
      neuralToggle.removeAttribute("aria-disabled");
      neuralToggle.style.pointerEvents = "auto";
      neuralToggle.title = neural.getSettings?.().enabled ? "关闭自动语音回复" : "开启自动语音回复";
    }

    // V12.14's browser-only button is obsolete once the neural layer is alive.
    const legacy = root?.querySelector("#uaiCompanionVoiceToggle");
    if (legacy && neural) {
      legacy.disabled = false;
      legacy.setAttribute("aria-hidden", "true");
      legacy.tabIndex = -1;
    }
  }

  function sync() {
    scheduled = false;
    const root = liveRoot();
    if (!root) return;
    root.classList.add("uai-c-v123-hardened");
    root.dataset.v123UxHardening = REVISION;
    setSidebarCollapsed(root, boolValue(localStorage.getItem(COLLAPSE_KEY)), { noStore: true });
    // Old V11 modules may re-apply the class from storage. Reconcile button copy
    // and the class in one place without writing storage on every mutation.
    setImmersive(root, boolValue(localStorage.getItem(IMMERSIVE_KEY)), { noStore: true });
    syncRoleMenu(root);
    suppressLegacyRenderers(root);
    syncVoiceControls(root);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  function onPointerDown(event) {
    const root = liveRoot();
    if (!root) return;
    const collapse = event.target.closest?.(".uai-c-v121-brand > button");
    if (collapse) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setSidebarCollapsed(root, !root.classList.contains("uai-c-v123-sidebar-collapsed"));
      return;
    }

    // Disabled legacy controls do not reliably emit click. Pointerdown capture
    // gives the final neural control a reliable activation path.
    const voice = event.target.closest?.("#uaiCompanionNeuralVoiceToggle");
    if (voice) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void toggleVoice(root);
    }
  }

  function onClick(event) {
    const root = liveRoot();
    if (!root) return;

    const immersive = event.target.closest?.("#uaiV11ImmersiveToggle");
    if (immersive) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setImmersive(root, !root.classList.contains("uai-c-v11-immersive"));
      return;
    }

    // Prevent the neural toggle's old click listener from firing after the
    // pointerdown hardening handler already toggled it once.
    if (event.target.closest?.("#uaiCompanionNeuralVoiceToggle")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (!event.target.closest?.(".uai-c-v10-role-actions")) closeRoleMenu(root);
    requestAnimationFrame(() => syncRoleMenu(root));
  }

  function init() {
    document.documentElement.dataset.companionV123UxHardeningRevision = REVISION;
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode", "aria-expanded"]
    });
    window.addEventListener("storage", (event) => {
      if ([COLLAPSE_KEY, IMMERSIVE_KEY].includes(event.key)) schedule();
    });
    window.addEventListener("resize", schedule, { passive: true });
    window.UnlimitedCompanionV123UXHardening = {
      revision: REVISION,
      refresh: schedule,
      setSidebarCollapsed: (value) => setSidebarCollapsed(liveRoot(), value),
      setImmersive: (value) => setImmersive(liveRoot(), value),
      toggleVoice: () => toggleVoice(liveRoot())
    };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
