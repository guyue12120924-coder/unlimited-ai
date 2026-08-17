// public/mode-router-luxury-stage4.js
(() => {
  const REVISION = "2026-08-17-v14.3-card-worlds";
  if (window.UnlimitedModeLuxuryStage4) return;

  function createNovelArt(card) {
    if (!card || card.querySelector(".uai-card-world-art.novel-world")) return;
    const art = document.createElement("span");
    art.className = "uai-card-world-art novel-world";
    art.setAttribute("aria-hidden", "true");
    art.innerHTML = `
      <span class="uai-novel-manuscript manuscript-a">CHAPTER · 07</span>
      <span class="uai-novel-manuscript manuscript-b">WORLD · MEMORY</span>
      <span class="uai-novel-manuscript manuscript-c">她推开那扇尘封多年的门……</span>
      <span class="uai-novel-glyph glyph-a">文</span>
      <span class="uai-novel-glyph glyph-b">章</span>
      <span class="uai-novel-quill">
        <i class="quill-core"></i>
        <i class="quill-stroke stroke-a"></i>
        <i class="quill-stroke stroke-b"></i>
      </span>
      <span class="uai-novel-page page-a"></span>
      <span class="uai-novel-page page-b"></span>
    `;
    card.appendChild(art);
  }

  function createCompanionArt(card) {
    if (!card || card.querySelector(".uai-card-world-art.companion-world")) return;
    const art = document.createElement("span");
    art.className = "uai-card-world-art companion-world";
    art.setAttribute("aria-hidden", "true");
    art.innerHTML = `
      <span class="uai-companion-silhouette">
        <i class="silhouette-hair"></i>
        <i class="silhouette-face"></i>
        <i class="silhouette-neck"></i>
        <i class="silhouette-body"></i>
        <i class="silhouette-highlight"></i>
      </span>
      <span class="uai-heartbeat-ring ring-a"></span>
      <span class="uai-heartbeat-ring ring-b"></span>
      <span class="uai-heartbeat-core">♡</span>
      <span class="uai-companion-bubble bubble-a">欢迎回来</span>
      <span class="uai-companion-bubble bubble-b">我记得</span>
      <span class="uai-companion-bubble bubble-c">晚安？</span>
      <span class="uai-companion-spark spark-a">✦</span>
      <span class="uai-companion-spark spark-b">·</span>
    `;
    card.appendChild(art);
  }

  function install(root) {
    if (!root || root.dataset.luxuryStage4Mounted === "1") return false;
    const novel = root.querySelector(".uai-mode-card.novel");
    const companion = root.querySelector(".uai-mode-card.companion");
    if (!novel || !companion) return false;

    root.dataset.luxuryStage4Mounted = "1";
    root.dataset.luxuryStage4Revision = REVISION;
    createNovelArt(novel);
    createCompanionArt(companion);
    return true;
  }

  function findAndInstall() {
    return install(document.getElementById("uaiModeRoot"));
  }

  function init() {
    if (findAndInstall()) return;
    const observer = new MutationObserver(() => {
      if (findAndInstall()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.UnlimitedModeLuxuryStage4 = {
    revision: REVISION,
    refresh: findAndInstall
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();