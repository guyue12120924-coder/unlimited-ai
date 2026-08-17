// public/mode-router.js
(() => {
  const REVISION = "2026-08-17-v13.0-mode-router-stage1";
  let root = null;
  let currentMode = "lobby";
  let companionReadyPromise = null;

  function ensureStyle(href, id) {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function ensureScript(src, id) {
    if (window.UnlimitedCompanion) return Promise.resolve();
    if (companionReadyPromise) return companionReadyPromise;
    companionReadyPromise = new Promise((resolve, reject) => {
      const existing = document.getElementById(id);
      if (existing) {
        if (window.UnlimitedCompanion) return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = true;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      document.body.appendChild(script);
    });
    return companionReadyPromise;
  }

  function createLobby() {
    if (root) return root;

    root = document.createElement("div");
    root.id = "uaiModeRoot";
    root.dataset.revision = REVISION;
    root.innerHTML = `
      <section class="uai-mode-lobby" aria-label="Unlimited AI 模式选择">
        <div class="uai-lobby-ambient" aria-hidden="true">
          <span class="uai-ambient-orb orb-a"></span>
          <span class="uai-ambient-orb orb-b"></span>
          <span class="uai-ambient-orb orb-c"></span>
          <span class="uai-ambient-grid"></span>
          <span class="uai-ambient-vignette"></span>
        </div>

        <div class="uai-mode-shell">
          <header class="uai-mode-brand">
            <div class="uai-brand-mark" aria-hidden="true">
              <span class="uai-brand-core"></span>
              <span class="uai-brand-ring ring-one"></span>
              <span class="uai-brand-ring ring-two"></span>
            </div>
            <span class="uai-mode-kicker">UNLIMITED AI · DUAL WORLD</span>
            <h1>今天，想进入哪个世界？</h1>
            <p>创造一个故事，或者遇见一个真正记得你的角色。</p>
          </header>

          <div class="uai-mode-grid" id="uaiModeGrid">
            <button class="uai-mode-card novel" id="uaiEnterNovel" type="button" aria-describedby="uaiNovelDesc">
              <span class="uai-card-glow" aria-hidden="true"></span>
              <span class="uai-card-noise" aria-hidden="true"></span>

              <div class="uai-card-topline">
                <span class="uai-mode-icon" aria-hidden="true">✦</span>
                <span class="uai-mode-index">01 / CREATE</span>
              </div>

              <div class="uai-card-copy">
                <span class="uai-card-eyebrow">STORY STUDIO</span>
                <h2>AI 小说创作</h2>
                <p id="uaiNovelDesc">从人物与世界观出发，把灵感写成长篇故事。大纲、正文、记忆与连续性都在同一个创作空间里。</p>
              </div>

              <div class="uai-mode-preview novel-preview" aria-hidden="true">
                <div class="uai-preview-toolbar">
                  <span></span><span></span><span></span>
                  <b>CHAPTER 07</b>
                </div>
                <div class="uai-preview-paper">
                  <span class="uai-preview-line line-1"></span>
                  <span class="uai-preview-line line-2"></span>
                  <p>“月光越过屋檐，像一封迟到了很多年的信。”</p>
                  <span class="uai-preview-line line-3"></span>
                </div>
              </div>

              <div class="uai-mode-tags" aria-label="小说模式功能">
                <span>人物</span><span>大纲</span><span>世界观</span><span>长篇记忆</span>
              </div>

              <span class="uai-mode-enter">进入创作世界 <b>→</b></span>
            </button>

            <button class="uai-mode-card companion" id="uaiEnterCompanion" type="button" aria-describedby="uaiCompanionDesc">
              <span class="uai-card-glow" aria-hidden="true"></span>
              <span class="uai-card-noise" aria-hidden="true"></span>

              <div class="uai-card-topline">
                <span class="uai-mode-icon" aria-hidden="true">♡</span>
                <span class="uai-mode-index">02 / MEET</span>
              </div>

              <div class="uai-card-copy">
                <span class="uai-card-eyebrow">AI COMPANION</span>
                <h2>AI 陪伴</h2>
                <p id="uaiCompanionDesc">创建你的专属角色，让聊天、记忆、关系与情绪慢慢积累。陪伴数据与小说数据彼此独立。</p>
              </div>

              <div class="uai-mode-preview companion-preview" aria-hidden="true">
                <div class="uai-companion-avatar">
                  <span class="uai-avatar-halo"></span>
                  <span class="uai-avatar-face">✦</span>
                </div>
                <div class="uai-chat-preview">
                  <span class="uai-chat-name">她 · 刚刚</span>
                  <p>今天也回来啦？我还记得你昨天说的那件事。</p>
                  <span class="uai-chat-status">● 在线</span>
                </div>
              </div>

              <div class="uai-mode-tags" aria-label="陪伴模式功能">
                <span>角色</span><span>聊天</span><span>长期记忆</span><span>关系</span>
              </div>

              <span class="uai-mode-enter">去见她 <b>→</b></span>
            </button>
          </div>

          <footer class="uai-mode-footer">
            <span class="uai-footer-dot" aria-hidden="true"></span>
            <p>两个世界分别保存，互不干扰。每次打开 Unlimited AI 都可以重新选择。</p>
          </footer>
        </div>
      </section>`;

    document.body.appendChild(root);
    root.querySelector("#uaiEnterNovel")?.addEventListener("click", enterNovel);
    root.querySelector("#uaiEnterCompanion")?.addEventListener("click", enterCompanion);
    return root;
  }

  function installNovelSwitch() {
    if (document.getElementById("uaiNovelModeSwitch")) return;
    const actions = document.querySelector("#topbar .topbar-actions");
    if (!actions) return;
    const button = document.createElement("button");
    button.id = "uaiNovelModeSwitch";
    button.type = "button";
    button.textContent = "切换模式";
    button.title = "返回 Unlimited AI 模式选择";
    button.addEventListener("click", showLobby);
    actions.prepend(button);
  }

  function setMode(mode) {
    currentMode = mode;
    document.body.dataset.uaiMode = mode;
    document.documentElement.classList.remove("uai-mode-gate-pending");
  }

  function showLobby() {
    window.UnlimitedCompanion?.unmount?.();
    setMode("lobby");
    const lobby = createLobby();
    lobby.hidden = false;
    installNovelSwitch();
  }

  function enterNovel() {
    window.UnlimitedCompanion?.unmount?.();
    setMode("novel");
    if (root) root.hidden = true;
    installNovelSwitch();
    document.querySelector("#msg")?.focus();
  }

  async function enterCompanion() {
    const button = root?.querySelector("#uaiEnterCompanion");
    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    }

    try {
      await ensureScript(`/companion-mode.js?v=${encodeURIComponent(REVISION)}`, "uaiCompanionScript");
      if (!window.UnlimitedCompanion?.mount) throw new Error("Companion module did not initialize");
      setMode("companion");
      if (root) root.hidden = true;
      window.UnlimitedCompanion.mount({ onExit: showLobby });
    } catch (error) {
      console.error("[Unlimited AI] companion mode failed to load", error);
      alert("AI 陪伴模式加载失败，请刷新页面后再试。小说模式不会受到影响。");
      showLobby();
    } finally {
      if (button) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
      }
    }
  }

  function init() {
    ensureStyle(`/mode-router.css?v=${encodeURIComponent(REVISION)}`, "uaiModeRouterCss");
    ensureStyle(`/companion-mode.css?v=${encodeURIComponent(REVISION)}`, "uaiCompanionCss");
    createLobby();
    showLobby();
    installNovelSwitch();
    window.setTimeout(installNovelSwitch, 900);
  }

  window.UnlimitedModeRouter = {
    revision: REVISION,
    showLobby,
    enterNovel,
    enterCompanion,
    get mode() { return currentMode; }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();