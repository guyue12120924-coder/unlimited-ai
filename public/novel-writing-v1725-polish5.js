// V17.25 polish 5: compact chapter / AI conversation navigator.
(() => {
  const REVISION = "2026-08-24-v17.25-writing-workspace-polish5";
  if (window.UnlimitedNovelWritingV1725Polish5?.revision === REVISION) return;

  function isNovelMode() {
    return document.body?.dataset?.uaiMode === "novel";
  }

  function markSections() {
    const chapterSection = document.getElementById("studioChapterList")?.closest(".library-section");
    const sessionSection = document.getElementById("studioSessionList")?.closest(".library-section");
    if (chapterSection) chapterSection.classList.add("novel-v1725-chapter-section");
    if (sessionSection) sessionSection.classList.add("novel-v1725-session-section");
    return { chapterSection, sessionSection };
  }

  function setLibraryView(next, { focus = false } = {}) {
    if (!isNovelMode()) return;
    const view = next === "sessions" ? "sessions" : "chapters";
    document.body.dataset.novelLibraryView = view;
    document.querySelectorAll("[data-v1725-library-view]").forEach(button => {
      const active = button.dataset.v1725LibraryView === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    const section = view === "sessions"
      ? document.querySelector("#studioLibrary > .novel-v1725-session-section")
      : document.querySelector("#studioLibrary > .chapter-section");
    document.querySelector("#studioLibrary > .novel-v1725-session-section")?.setAttribute("aria-hidden", view === "sessions" ? "false" : "true");
    document.querySelector("#studioLibrary > .chapter-section")?.setAttribute("aria-hidden", view === "chapters" ? "false" : "true");
    if (focus) requestAnimationFrame(() => section?.querySelector(".studio-list-item, button")?.focus({ preventScroll: true }));
  }

  function ensureLibrarySwitch() {
    const library = document.getElementById("studioLibrary");
    const projectSwitcher = library?.querySelector(".project-switcher");
    if (!library || !projectSwitcher) return false;
    markSections();

    let nav = document.getElementById("novelV1725LibrarySwitch");
    if (!nav) {
      nav = document.createElement("div");
      nav.id = "novelV1725LibrarySwitch";
      nav.className = "novel-v1725-library-switch";
      nav.setAttribute("role", "tablist");
      nav.setAttribute("aria-label", "写作导航");
      nav.innerHTML = `
        <button type="button" role="tab" data-v1725-library-view="chapters">章节</button>
        <button type="button" role="tab" data-v1725-library-view="sessions">AI 对话</button>`;
      projectSwitcher.insertAdjacentElement("afterend", nav);
    }

    nav.querySelectorAll("[data-v1725-library-view]").forEach(button => {
      if (button.dataset.v1725Bound === "1") return;
      button.dataset.v1725Bound = "1";
      button.addEventListener("click", () => setLibraryView(button.dataset.v1725LibraryView));
    });

    if (!document.body.dataset.novelLibraryView) {
      setLibraryView(document.body.classList.contains("novel-v1725-ai-view") ? "sessions" : "chapters");
    } else {
      setLibraryView(document.body.dataset.novelLibraryView);
    }
    return true;
  }

  function syncWithCenterView() {
    if (!isNovelMode()) return;
    setLibraryView(document.body.classList.contains("novel-v1725-ai-view") ? "sessions" : "chapters");
  }

  function refresh() {
    if (!isNovelMode()) return false;
    ensureLibrarySwitch();
    return true;
  }

  document.addEventListener("click", event => {
    if (!isNovelMode()) return;

    const manual = event.target?.closest?.("[data-v1725-library-view]");
    if (manual) return;

    if (event.target?.closest?.('[data-v1725-view="manuscript"], #studioChapterList [data-chapter-id]')) {
      requestAnimationFrame(() => setLibraryView("chapters"));
      return;
    }

    if (event.target?.closest?.('[data-v1725-view="ai"], #studioSessionList [data-session-id], #studioNewSession, #sendBtn')) {
      requestAnimationFrame(() => setLibraryView("sessions"));
      return;
    }
  }, true);

  document.addEventListener("keydown", event => {
    if (!isNovelMode()) return;
    if (event.target?.id === "msg" && event.key === "Enter" && !event.shiftKey) {
      setLibraryView("sessions");
    }
  }, true);

  document.addEventListener("change", event => {
    if (!isNovelMode()) return;
    if (event.target?.id === "projectSelect") requestAnimationFrame(() => setLibraryView("chapters"));
  });

  const observer = new MutationObserver(() => {
    if (!isNovelMode()) return;
    if (!document.getElementById("novelV1725LibrarySwitch") || !document.querySelector("#studioLibrary > .novel-v1725-session-section")) {
      requestAnimationFrame(refresh);
    }
  });

  function startObserver() {
    const library = document.getElementById("studioLibrary");
    if (library) observer.observe(library, { childList: true, subtree: true });
  }

  window.addEventListener("uai:mode-refresh", () => {
    if (!isNovelMode()) return;
    requestAnimationFrame(() => {
      refresh();
      syncWithCenterView();
      startObserver();
    });
  });
  window.addEventListener("uai:workspace-refresh", () => {
    if (isNovelMode()) requestAnimationFrame(refresh);
  });

  window.UnlimitedNovelWritingV1725Polish5 = {
    revision: REVISION,
    refresh,
    setLibraryView
  };

  const start = () => {
    if (!isNovelMode()) return;
    refresh();
    syncWithCenterView();
    startObserver();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
