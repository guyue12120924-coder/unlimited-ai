// public/mode-router.js
(() => {
  const REVISION = "2026-08-13-v4.0-mode-router-1";
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
        <div class="uai-mode-shell">
          <header class="uai-mode-brand">
            <span class="uai-mode-kicker">Unlimited AI · Dual Mode</span>
            <h1>今天想做些什么？</h1>
            <p>创作一个世界，或者和一个懂你的角色聊一会儿。</p>
          </header>

          <div class="uai-mode-grid">
            <button class="uai-mode-card novel" id="uaiEnterNovel" type="button">
              <span class="uai-mode-icon">✍️</span>
              <h2>AI 小说创作</h2>
              <p>保留现有长篇创作工作台。人物、世界观、大纲、正文、记忆与连续性检查都继续使用原来的数据。</p>
              <div class="uai-mode-tags"><span>人物</span><span>大纲</span><span>正文</span><span>长篇记忆</span></div>
              <span class="uai-mode-enter">进入创作工作台 <b>→</b></span>
            </button>

            <button class="uai-mode-card companion" id="uaiEnterCompanion" type="button">
              <span class="uai-mode-icon">💗</span>
              <h2>AI 陪伴</h2>
              <p>创建专属 AI 伙伴，进行自然聊天、长期记忆和稳定的人格互动。陪伴数据与小说数据完全隔离。</p>
              <div class="uai-mode-tags"><span>角色</span><span>聊天</span><span>长期记忆</span><span>关系</span></div>
              <span class="uai-mode-enter">开始聊天 <b>→</b></span>
            </button>
          </div>

          <p class="uai-mode-footnote">每次打开 Unlimited AI 都会先回到这里；两种模式的数据会分别保留。</p>
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
