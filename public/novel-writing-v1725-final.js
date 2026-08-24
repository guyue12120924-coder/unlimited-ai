// V17.25 final writing interaction consolidation.
(() => {
  const REVISION = "2026-08-24-v17.25-final-writing-ui";
  if (window.UnlimitedNovelWritingV1725Final?.revision === REVISION) return;

  let observer = null;
  let queued = false;

  function isNovelMode() {
    return document.body?.dataset?.uaiMode === "novel";
  }

  function ensureSessionInMore() {
    const menu = document.getElementById("novelV1723TopMoreMenu");
    if (!menu || menu.querySelector('[data-v1725-final-target="sessionBtn"]')) return;
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.dataset.v1725FinalTarget = "sessionBtn";
    button.innerHTML = `<span>会话管理</span><small>管理、重命名或删除 AI 对话</small>`;
    const first = menu.querySelector("button");
    if (first) menu.insertBefore(button, first);
    else menu.appendChild(button);
  }

  function normalizeTopbar() {
    const materials = document.getElementById("studioToggleBtn");
    if (materials) {
      materials.textContent = "创作资料";
      materials.title = "打开或关闭大纲、人物和世界观";
      materials.setAttribute("aria-expanded", document.body.classList.contains("studio-collapsed") ? "false" : "true");
    }
    const settings = document.getElementById("settingsBtn");
    if (settings) settings.title = "设置";
    const more = document.getElementById("novelV1723TopMore");
    if (more) more.title = "更多功能";
    const model = document.querySelector("#topbar .model-pill");
    if (model) model.title = "选择 AI 模型";
    ensureSessionInMore();
  }

  function syncLibraryForCenter() {
    if (!isNovelMode()) return;
    const target = document.body.classList.contains("novel-v1725-ai-view") ? "sessions" : "chapters";
    window.UnlimitedNovelWritingV1725Polish5?.setLibraryView?.(target);
  }

  function syncMaterials() {
    const materials = document.getElementById("studioToggleBtn");
    if (materials) materials.setAttribute("aria-expanded", document.body.classList.contains("studio-collapsed") ? "false" : "true");
    if (document.body.classList.contains("studio-collapsed")) return;
    const active = document.querySelector('#studioPanel .studio-tabs [data-studio-tab].active')?.dataset.studioTab;
    if (!active || active === "draft") {
      document.querySelector('#studioPanel .studio-tabs [data-studio-tab="outline"]')?.click();
    }
  }

  function focusExplicitView(view) {
    if (window.innerWidth <= 980) return;
    requestAnimationFrame(() => {
      const target = view === "ai" ? document.getElementById("msg") : document.getElementById("simpleManuscriptEditor");
      if (target && !target.disabled && !target.hidden) {
        try { target.focus({ preventScroll: true }); } catch { target.focus(); }
      }
    });
  }

  function fitEditor() {
    window.UnlimitedNovelWritingV1725Hotfix2?.fitEditor?.();
  }

  function syncRevision() {
    document.documentElement.dataset.novelV1725FinalRevision = REVISION;
    const meta = document.querySelector('meta[name="unlimited-novel-revision"]');
    if (meta) meta.content = REVISION;
  }

  function patch() {
    queued = false;
    if (!isNovelMode()) {
      document.documentElement.removeAttribute("data-novel-v1725-final-revision");
      return false;
    }
    normalizeTopbar();
    window.UnlimitedNovelWritingV1725Polish5?.refresh?.();
    syncMaterials();
    syncRevision();
    fitEditor();
    document.body.classList.add("novel-v1725-final-ready");
    return true;
  }

  function schedulePatch() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(patch);
  }

  function bindObserver() {
    observer?.disconnect();
    const root = document.getElementById("app");
    if (!root) return;
    observer = new MutationObserver(schedulePatch);
    observer.observe(root, { childList: true, subtree: true });
  }

  document.addEventListener("click", event => {
    if (!isNovelMode()) return;

    const finalTarget = event.target?.closest?.("[data-v1725-final-target]")?.dataset.v1725FinalTarget;
    if (finalTarget) {
      event.preventDefault();
      document.getElementById("novelV1723TopMoreMenu")?.setAttribute("hidden", "");
      document.getElementById("novelV1723TopMore")?.setAttribute("aria-expanded", "false");
      document.getElementById(finalTarget)?.click();
      return;
    }

    const viewButton = event.target?.closest?.("[data-v1725-view]");
    if (viewButton) {
      const view = viewButton.dataset.v1725View === "ai" ? "ai" : "manuscript";
      requestAnimationFrame(() => {
        syncLibraryForCenter();
        focusExplicitView(view);
        fitEditor();
      });
      return;
    }

    if (event.target?.closest?.("#studioToggleBtn, #collapseStudio")) {
      setTimeout(() => {
        syncMaterials();
        fitEditor();
      }, 220);
      return;
    }

    if (event.target?.closest?.("#studioChapterList [data-chapter-id]")) {
      setTimeout(() => {
        syncLibraryForCenter();
        fitEditor();
      }, 80);
      return;
    }

    if (event.target?.closest?.("#studioSessionList [data-session-id], #studioNewSession, #sendBtn")) {
      requestAnimationFrame(syncLibraryForCenter);
    }
  }, true);

  document.addEventListener("keydown", event => {
    if (!isNovelMode()) return;
    if (event.key === "Escape" && !document.body.classList.contains("studio-collapsed")) {
      document.getElementById("collapseStudio")?.click();
    }
  }, true);

  document.addEventListener("change", event => {
    if (!isNovelMode()) return;
    if (event.target?.id === "projectSelect") {
      requestAnimationFrame(() => {
        window.UnlimitedNovelWritingV1725Polish5?.setLibraryView?.("chapters");
        fitEditor();
      });
    }
  });

  window.addEventListener("uai:mode-refresh", () => {
    if (!isNovelMode()) return;
    requestAnimationFrame(() => {
      patch();
      syncLibraryForCenter();
      bindObserver();
    });
  });
  window.addEventListener("uai:workspace-refresh", schedulePatch);
  window.addEventListener("resize", () => {
    if (!isNovelMode()) return;
    schedulePatch();
    setTimeout(fitEditor, 80);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && isNovelMode()) schedulePatch();
  });

  window.UnlimitedNovelWritingV1725Final = {
    revision: REVISION,
    refresh: patch,
    syncLibraryForCenter
  };

  const start = () => {
    if (!isNovelMode()) return;
    patch();
    syncLibraryForCenter();
    bindObserver();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
