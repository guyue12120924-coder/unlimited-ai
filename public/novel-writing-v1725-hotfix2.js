// V17.25 hotfix 3: one materials entry + manuscript autosize + screenshot-driven polish.
(() => {
  const REVISION = "2026-08-24-v17.25-writing-workspace-polish3";
  if (window.UnlimitedNovelWritingV1725Hotfix2?.revision === REVISION) return;

  let resizeObserver = null;
  let observedEditor = null;

  function isNovelMode() {
    return document.body?.dataset?.uaiMode === "novel";
  }

  function materialsButton() {
    return document.getElementById("studioToggleBtn");
  }

  function syncButton() {
    const target = materialsButton();
    if (!target) return;
    target.textContent = "创作资料";
    target.title = "打开或关闭大纲、人物和世界观";
    target.setAttribute("aria-expanded", document.body.classList.contains("studio-collapsed") ? "false" : "true");
    document.getElementById("novelV1725MaterialsBtn")?.setAttribute("aria-hidden", "true");
  }

  function ensureUsefulTab() {
    const active = document.querySelector('#studioPanel .studio-tabs [data-studio-tab].active')?.dataset.studioTab;
    if (active && active !== "draft") return;
    document.querySelector('#studioPanel .studio-tabs [data-studio-tab="outline"]')?.click();
  }

  function openMaterials() {
    ensureUsefulTab();
    document.body.classList.remove("studio-collapsed");
    if (window.innerWidth <= 980) document.body.classList.add("library-collapsed");
    syncButton();
  }

  function closeMaterials() {
    document.body.classList.add("studio-collapsed");
    syncButton();
  }

  function toggleMaterials() {
    if (document.body.classList.contains("studio-collapsed")) openMaterials();
    else closeMaterials();
  }

  function fitEditor() {
    if (!isNovelMode()) return;
    const editor = document.getElementById("simpleManuscriptEditor");
    if (!editor || editor.hidden || editor.disabled) return;
    editor.style.height = "auto";
    const floor = window.innerHeight <= 650 ? 340 : (window.innerWidth <= 760 ? 480 : 560);
    editor.style.height = `${Math.max(floor, editor.scrollHeight + 2)}px`;
    editor.style.overflowY = "hidden";
  }

  function watchEditor() {
    const editor = document.getElementById("simpleManuscriptEditor");
    if (!editor || observedEditor === editor) return;
    resizeObserver?.disconnect();
    observedEditor = editor;
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(() => requestAnimationFrame(fitEditor));
      resizeObserver.observe(editor);
    }
    requestAnimationFrame(fitEditor);
  }

  function normalizeComposer() {
    const input = document.getElementById("msg");
    if (input && input.placeholder !== "让 AI 续写、润色或帮你构思……") {
      input.placeholder = "让 AI 续写、润色或帮你构思……";
    }
  }

  function sync() {
    if (!isNovelMode()) return;
    syncButton();
    normalizeComposer();
    watchEditor();
    requestAnimationFrame(fitEditor);
  }

  document.addEventListener("click", (event) => {
    if (!isNovelMode()) return;

    const materials = event.target?.closest?.("#studioToggleBtn");
    if (materials) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleMaterials();
      return;
    }

    if (event.target?.closest?.("#studioChapterList [data-chapter-id]")) {
      setTimeout(fitEditor, 90);
      return;
    }

    if (event.target?.closest?.(".user-flow-add-manuscript, #userFlowSelectionAction")) {
      setTimeout(fitEditor, 520);
      return;
    }

    if (event.target?.closest?.('[data-v1725-view="manuscript"]')) {
      setTimeout(fitEditor, 40);
    }
  }, true);

  document.addEventListener("input", (event) => {
    if (!isNovelMode()) return;
    if (event.target?.id === "simpleManuscriptEditor") requestAnimationFrame(fitEditor);
  }, true);

  document.addEventListener("change", (event) => {
    if (!isNovelMode()) return;
    if (event.target?.id === "projectSelect") setTimeout(fitEditor, 90);
  });

  window.addEventListener("uai:mode-refresh", () => {
    if (isNovelMode()) requestAnimationFrame(sync);
  });
  window.addEventListener("uai:workspace-refresh", () => {
    if (isNovelMode()) setTimeout(sync, 20);
  });
  window.addEventListener("resize", () => {
    if (isNovelMode()) requestAnimationFrame(() => {
      syncButton();
      fitEditor();
    });
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && isNovelMode()) sync();
  });

  window.UnlimitedNovelWritingV1725Hotfix2 = {
    revision: REVISION,
    openMaterials,
    closeMaterials,
    fitEditor,
    sync
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sync, { once: true });
  } else {
    sync();
  }
})();
