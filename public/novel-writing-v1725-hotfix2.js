// V17.25 hotfix 2: reuse the stable studioToggleBtn as the single materials entry.
(() => {
  const REVISION = "2026-08-24-v17.25-materials-drawer-hotfix2";
  if (window.UnlimitedNovelWritingV1725Hotfix2?.revision === REVISION) return;

  function isNovelMode() {
    return document.body?.dataset?.uaiMode === "novel";
  }

  function button() {
    return document.getElementById("studioToggleBtn");
  }

  function syncButton() {
    const target = button();
    if (!target) return;
    target.textContent = "创作资料";
    target.title = "打开或关闭创作资料";
    target.setAttribute("aria-expanded", document.body.classList.contains("studio-collapsed") ? "false" : "true");
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

  document.addEventListener("click", (event) => {
    if (!isNovelMode()) return;
    const target = event.target?.closest?.("#studioToggleBtn");
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleMaterials();
  }, true);

  window.addEventListener("uai:mode-refresh", () => {
    if (isNovelMode()) requestAnimationFrame(syncButton);
  });
  window.addEventListener("uai:workspace-refresh", () => {
    if (isNovelMode()) requestAnimationFrame(syncButton);
  });
  window.addEventListener("resize", () => {
    if (isNovelMode()) syncButton();
  });

  window.UnlimitedNovelWritingV1725Hotfix2 = {
    revision: REVISION,
    openMaterials,
    closeMaterials,
    sync: syncButton
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncButton, { once: true });
  } else {
    syncButton();
  }
})();
