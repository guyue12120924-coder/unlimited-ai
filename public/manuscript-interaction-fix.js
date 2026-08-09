// public/manuscript-interaction-fix.js
// Defensive interaction layer for the chapter manuscript editor.
(() => {
  const MAX_SELECTION = 12000;
  let observer = null;

  function toast(message, type = "info") {
    let node = document.getElementById("manuscriptToast");
    if (!node) {
      node = document.createElement("div");
      node.id = "manuscriptToast";
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.dataset.type = type;
    node.classList.add("show");
    clearTimeout(node.hideTimer);
    node.hideTimer = setTimeout(() => node.classList.remove("show"), 1900);
  }

  function editor() {
    return document.getElementById("chapterManuscriptEditor");
  }

  function selectionLength() {
    const node = editor();
    if (!node) return 0;
    return Math.max(0, Number(node.selectionEnd || 0) - Number(node.selectionStart || 0));
  }

  function makeEditorInteractive() {
    const node = editor();
    if (!node) return;
    node.disabled = false;
    node.readOnly = false;
    node.tabIndex = 0;
    node.removeAttribute("aria-disabled");
    node.setAttribute("autocomplete", "off");
    node.setAttribute("spellcheck", "false");
    node.dataset.interactionReady = "1";
  }

  function makeControlsActionable() {
    document.querySelectorAll("#manuscriptAiToolbar [data-manuscript-ai-mode]").forEach((button) => {
      if (button.disabled) button.disabled = false;
      button.setAttribute("aria-disabled", "false");
    });

    ["importLegacyClips", "copyChapterManuscript", "exportChapterManuscript"].forEach((id) => {
      const button = document.getElementById(id);
      if (!button) return;
      if (button.disabled) button.disabled = false;
      button.setAttribute("aria-disabled", "false");
    });
  }

  function refresh() {
    makeEditorInteractive();
    makeControlsActionable();
  }

  function rescueEditorPointer(event) {
    const node = editor();
    const panel = document.getElementById("studioPanel");
    if (!node || !panel) return;

    // Never steal focus from actual modal/dialog layers.
    if (!event.target.closest("#studioPanel")) return;

    const rect = node.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) return;

    if (event.target !== node) {
      event.preventDefault();
      event.stopImmediatePropagation();
      node.focus({ preventScroll: true });
      const end = node.value.length;
      node.setSelectionRange(end, end);
      return;
    }

    requestAnimationFrame(() => {
      if (document.activeElement !== node) node.focus({ preventScroll: true });
    });
  }

  function explainInactiveControl(event) {
    const aiButton = event.target.closest("[data-manuscript-ai-mode]");
    if (aiButton) {
      const node = editor();
      if (!node) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toast("请先选择一个章节", "error");
        return;
      }
      const length = selectionLength();
      if (!length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        node.focus({ preventScroll: true });
        toast("先在正文中拖动选中一段文字，再选择 AI 修改方式");
        return;
      }
      if (length > MAX_SELECTION) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toast(`选区过长，请控制在 ${MAX_SELECTION.toLocaleString()} 字符以内`, "error");
        return;
      }
    }

    const copy = event.target.closest("#copyChapterManuscript");
    const exportButton = event.target.closest("#exportChapterManuscript");
    if ((copy || exportButton) && !String(editor()?.value || "").trim()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      editor()?.focus({ preventScroll: true });
      toast("当前章节正文还是空的，先输入或加入一段正文");
    }
  }

  function init() {
    if (!document.getElementById("manuscriptInteractionReady")) {
      const marker = document.createElement("span");
      marker.id = "manuscriptInteractionReady";
      marker.hidden = true;
      document.body.appendChild(marker);
    }

    refresh();

    const panel = document.getElementById("studioPanelBody");
    if (panel) {
      observer = new MutationObserver(() => requestAnimationFrame(refresh));
      observer.observe(panel, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["disabled", "readonly"]
      });
    }

    document.addEventListener("pointerdown", rescueEditorPointer, true);
    document.addEventListener("click", explainInactiveControl, true);
    document.addEventListener("selectionchange", () => requestAnimationFrame(makeControlsActionable));
    document.addEventListener("focusin", (event) => {
      if (event.target?.id === "chapterManuscriptEditor") makeEditorInteractive();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();