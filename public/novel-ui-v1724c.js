// V17.24C novel-only final regression polish.
// Third of three UI passes: coordinate existing menus, long labels and narrow-screen flow.
(() => {
  const REVISION = "2026-08-23-v17.24c-final-regression-polish";
  if (window.UnlimitedNovelUIV1724C?.revision === REVISION) return;

  const FLOATING = [
    { button: "novelV1723TopMore", menu: "novelV1723TopMoreMenu" },
    { button: "novelV1723QuickBtn", menu: "novelV1723QuickMenu" },
    { button: "novelV1723MoreTools", menu: "novelV1723MoreToolsMenu" },
    { button: "novelV1724ALibraryToolsBtn", menu: "novelV1724ALibraryToolsPanel" }
  ];

  let observer = null;
  let queued = false;

  function isNovelMode() {
    return document.body?.dataset?.uaiMode === "novel";
  }

  function closeFloating(exceptButtonId = "") {
    FLOATING.forEach(({ button, menu }) => {
      if (button === exceptButtonId) return;
      const trigger = document.getElementById(button);
      const panel = document.getElementById(menu);
      if (panel) panel.hidden = true;
      trigger?.setAttribute("aria-expanded", "false");
    });
  }

  function expandedTrigger() {
    for (const { button } of FLOATING) {
      const trigger = document.getElementById(button);
      if (trigger?.getAttribute("aria-expanded") === "true") return trigger;
    }
    return null;
  }

  function titleFromText(node) {
    if (!node) return;
    const text = String(node.textContent || "").trim();
    if (text) node.title = text;
    else node.removeAttribute("title");
  }

  function syncLongLabelTitles() {
    titleFromText(document.getElementById("novelV1723ProjectName"));
    titleFromText(document.getElementById("novelV1723ChapterName"));
    titleFromText(document.getElementById("studioProjectTitle"));

    const projectSelect = document.getElementById("projectSelect");
    if (projectSelect) {
      const selected = projectSelect.options?.[projectSelect.selectedIndex];
      const text = String(selected?.textContent || "").trim();
      if (text) projectSelect.title = text;
      else projectSelect.removeAttribute("title");
    }

    document.querySelectorAll("#studioLibrary .studio-item-main span").forEach(titleFromText);
  }

  function syncRevision() {
    if (!isNovelMode()) return;
    document.documentElement.dataset.novelV1724Revision = REVISION;
    const meta = document.querySelector('meta[name="unlimited-novel-revision"]');
    if (meta) meta.content = REVISION;
  }

  function patch() {
    queued = false;
    if (!isNovelMode()) {
      closeFloating();
      document.body?.classList.remove("novel-v1724c-ready");
      return false;
    }
    syncLongLabelTitles();
    syncRevision();
    document.body.classList.add("novel-v1724c-ready");
    return true;
  }

  function schedulePatch() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(patch);
  }

  function bindObserver() {
    if (observer) observer.disconnect();
    const workspace = document.getElementById("creativeWorkspace");
    if (!workspace) return;
    observer = new MutationObserver(schedulePatch);
    observer.observe(workspace, { childList: true, subtree: true });
  }

  function refresh() {
    patch();
    if (isNovelMode()) bindObserver();
    return isNovelMode();
  }

  // Existing V17.23/V17.24A controls keep their own click handlers.
  // This capture handler only closes competing menus before the requested one toggles.
  document.addEventListener("click", event => {
    if (!isNovelMode()) return;
    const opener = event.target?.closest?.(
      "#novelV1723TopMore, #novelV1723QuickBtn, #novelV1723MoreTools, #novelV1724ALibraryToolsBtn"
    );
    if (opener?.id) closeFloating(opener.id);

    // On overlay-style narrow layouts, selecting actual writing content should
    // immediately return the user to the center writing area.
    if (window.innerWidth <= 980) {
      const contentTarget = event.target?.closest?.(
        "#studioChapterList .studio-item-main, #studioSessionList .studio-item-main"
      );
      if (contentTarget) {
        requestAnimationFrame(() => {
          if (!document.body.classList.contains("library-collapsed")) {
            document.getElementById("collapseLibrary")?.click();
          }
          document.getElementById("msg")?.focus({ preventScroll: true });
        });
      }
    }
  }, true);

  document.addEventListener("keydown", event => {
    if (!isNovelMode() || event.key !== "Escape") return;
    const trigger = expandedTrigger();
    if (!trigger) return;
    closeFloating();
    trigger.focus({ preventScroll: true });
  });

  document.addEventListener("change", event => {
    if (!isNovelMode()) return;
    if (event.target?.id === "projectSelect") schedulePatch();
  });

  window.addEventListener("uai:mode-refresh", refresh);
  window.addEventListener("uai:workspace-refresh", refresh);
  window.addEventListener("resize", () => {
    closeFloating();
    schedulePatch();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });

  window.UnlimitedNovelUIV1724C = {
    revision: REVISION,
    refresh,
    closeFloating
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }
})();
