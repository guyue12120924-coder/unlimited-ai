// V17.24A novel-only interface simplification.
(() => {
  const REVISION = "2026-08-23-v17.24a-interface-simplification";
  if (window.UnlimitedNovelUIV1724A?.revision === REVISION) return;

  let observer = null;
  let queued = false;

  function isNovelMode() {
    return document.body?.dataset?.uaiMode === "novel";
  }

  function setLabel(node, next) {
    if (!node) return;
    if (!node.dataset.novelV1724aOriginalText) {
      node.dataset.novelV1724aOriginalText = node.textContent || "";
    }
    node.textContent = next;
  }

  function restoreLabels() {
    document.querySelectorAll("[data-novel-v1724a-original-text]").forEach(node => {
      node.textContent = node.dataset.novelV1724aOriginalText || node.textContent;
      delete node.dataset.novelV1724aOriginalText;
    });
  }

  function syncSimpleLabels() {
    const sessionTitle = document.querySelector("#studioLibrary > .library-section:not(.chapter-section) .library-title > span");
    setLabel(sessionTitle, "AI 对话");

    const worldTab = document.querySelector('#studioPanel .studio-tabs [data-studio-tab="world"]');
    setLabel(worldTab, "世界观");
  }

  function closeLibraryTools() {
    const button = document.getElementById("novelV1724ALibraryToolsBtn");
    const panel = document.getElementById("novelV1724ALibraryToolsPanel");
    if (!button || !panel) return;
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  function ensureLibraryTools() {
    const library = document.getElementById("studioLibrary");
    const search = library?.querySelector(":scope > .studio-search");
    const footer = library?.querySelector(":scope > .library-footer");
    if (!library || (!search && !footer)) return;

    let wrap = document.getElementById("novelV1724ALibraryTools");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "novelV1724ALibraryTools";
      wrap.className = "novel-v1724a-library-tools";
      wrap.innerHTML = `
        <button id="novelV1724ALibraryToolsBtn" class="novel-v1724a-library-tools-toggle" type="button" aria-expanded="false" aria-controls="novelV1724ALibraryToolsPanel">
          <span>作品工具</span><span aria-hidden="true">⌃</span>
        </button>
        <div id="novelV1724ALibraryToolsPanel" class="novel-v1724a-library-tools-panel" hidden></div>`;
      library.appendChild(wrap);

      const button = wrap.querySelector("#novelV1724ALibraryToolsBtn");
      const panel = wrap.querySelector("#novelV1724ALibraryToolsPanel");
      button.addEventListener("click", event => {
        event.stopPropagation();
        panel.hidden = !panel.hidden;
        button.setAttribute("aria-expanded", panel.hidden ? "false" : "true");
      });
    }

    const panel = document.getElementById("novelV1724ALibraryToolsPanel");
    if (search && search.parentElement !== panel) panel.appendChild(search);
    if (footer && footer.parentElement !== panel) panel.appendChild(footer);
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
      closeLibraryTools();
      restoreLabels();
      document.body?.classList.remove("novel-v1724a-ready");
      return false;
    }

    ensureLibraryTools();
    syncSimpleLabels();
    syncRevision();
    document.body.classList.add("novel-v1724a-ready");
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

  document.addEventListener("click", event => {
    if (!event.target.closest("#novelV1724ALibraryTools")) closeLibraryTools();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeLibraryTools();
  });

  window.addEventListener("uai:mode-refresh", refresh);
  window.addEventListener("uai:workspace-refresh", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });

  window.UnlimitedNovelUIV1724A = {
    revision: REVISION,
    refresh,
    closeLibraryTools
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }
})();
