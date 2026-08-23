// V17.23A novel-only simplification controller.
(() => {
  const REVISION = "2026-08-23-v17.23a-novel-simplification";
  const STORAGE_KEY = "cfw_novel_theme_v1723";
  if (window.UnlimitedNovelSimplifyV1723?.revision === REVISION) return;

  function isNovelMode() {
    return document.body?.dataset?.uaiMode === "novel";
  }

  function readTheme() {
    const saved = String(localStorage.getItem(STORAGE_KEY) || "").toLowerCase();
    return saved === "dark" ? "dark" : "light";
  }

  function syncThemeButton(theme) {
    const button = document.getElementById("themeToggle");
    if (!button) return;
    if (isNovelMode()) {
      button.textContent = theme === "light" ? "切换深色主题" : "切换浅色主题";
      button.title = theme === "light" ? "小说工作区当前使用浅色写作主题" : "小说工作区当前使用深色主题";
      button.dataset.novelV1723ThemeControl = "true";
      return;
    }
    delete button.dataset.novelV1723ThemeControl;
    button.removeAttribute("title");
    button.textContent = document.body.classList.contains("light-theme") ? "切换深色主题" : "切换浅色主题";
  }

  function applyTheme() {
    if (!document.body) return false;
    if (!isNovelMode()) {
      delete document.body.dataset.novelV1723Theme;
      document.body.classList.remove("novel-v1723-simplified");
      syncThemeButton("");
      return false;
    }
    const theme = readTheme();
    document.body.dataset.novelV1723Theme = theme;
    document.body.classList.add("novel-v1723-simplified");
    document.documentElement.dataset.novelV1723Revision = REVISION;
    syncThemeButton(theme);
    return true;
  }

  function toggleTheme() {
    const next = readTheme() === "light" ? "dark" : "light";
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    document.body.dataset.novelV1723Theme = next;
    syncThemeButton(next);
    window.dispatchEvent(new CustomEvent("uai:novel-theme-changed", {
      detail: { theme: next, revision: REVISION }
    }));
    return next;
  }

  function onThemeToggleCapture(event) {
    if (!isNovelMode()) return;
    const button = event.target?.closest?.("#themeToggle");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleTheme();
  }

  document.addEventListener("click", onThemeToggleCapture, true);
  window.addEventListener("uai:mode-refresh", applyTheme);
  window.addEventListener("uai:workspace-refresh", applyTheme);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) applyTheme();
  });

  window.UnlimitedNovelSimplifyV1723 = {
    revision: REVISION,
    refresh: applyTheme,
    getTheme: readTheme,
    setTheme(theme) {
      const next = String(theme || "").toLowerCase() === "dark" ? "dark" : "light";
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      if (isNovelMode()) {
        document.body.dataset.novelV1723Theme = next;
        syncThemeButton(next);
      }
      return next;
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyTheme, { once: true });
  else applyTheme();
})();

// V17.23D is kept as an independent, rollback-friendly novel enhancement layer.
// Load it from the already stable V17.23A entry so the companion production chain
// and the older app/studio cores remain untouched.
(() => {
  const STYLE_ID = "novelV1723DStyle";
  const SCRIPT_ID = "novelV1723DScript";
  const VERSION = "20260823-v17.23d-novel-final-ux";

  function loadFinalLayer() {
    if (!document.getElementById(STYLE_ID)) {
      const link = document.createElement("link");
      link.id = STYLE_ID;
      link.rel = "stylesheet";
      link.href = `/novel-final-v1723d.css?v=${VERSION}`;
      document.head.appendChild(link);
    }
    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = `/novel-final-v1723d.js?v=${VERSION}`;
      script.defer = true;
      document.head.appendChild(script);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadFinalLayer, { once: true });
  else loadFinalLayer();
})();
