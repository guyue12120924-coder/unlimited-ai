// public/mode-router.js
(() => {
  const REVISION = "2026-08-17-v13.1-mode-router-stage2";
  let root = null;
  let currentMode = "lobby";
  let companionReadyPromise = null;

  const effects = {
    canvas: null,
    ctx: null,
    stars: [],
    meteors: [],
    raf: 0,
    running: false,
    lastTime: 0,
    nextMeteorAt: 0,
    width: 0,
    height: 0,
    dpr: 1,
    quoteTimer: 0,
    quoteIndex: 0,
    messageIndex: 0,
    resizeHandler: null,
    pointerHandler: null,
    pointerLeaveHandler: null,
    visibilityHandler: null
  };

  const novelQuotes = [
    "“月光越过屋檐，像一封迟到了很多年的信。”",
    "“城门在黎明前开启，而她是唯一没有回头的人。”",
    "“世界安静下来时，他终于听见了命运翻页的声音。”",
    "“风从旧地图上吹过，把未完成的故事带向远方。”"
  ];

  const companionMessages = [
    "今天也回来啦？我还记得你昨天说的那件事。",
    "你看起来有点累。今晚想先聊聊天，还是安静待一会儿？",
    "我把你喜欢的事情记下来了，下次可别说我忘记了。",
    "欢迎回来。刚刚看到星星的时候，我突然想到你了。"
  ];

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
          <canvas class="uai-star-canvas" id="uaiModeStars"></canvas>
          <span class="uai-ambient-orb orb-a"></span>
          <span class="uai-ambient-orb orb-b"></span>
          <span class="uai-ambient-orb orb-c"></span>
          <span class="uai-ambient-nebula nebula-a"></span>
          <span class="uai-ambient-nebula nebula-b"></span>
          <span class="uai-ambient-band"></span>
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
              <span class="uai-card-streak streak-one" aria-hidden="true"></span>
              <span class="uai-card-streak streak-two" aria-hidden="true"></span>

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
                  <p id="uaiNovelQuote">${novelQuotes[0]}</p>
                  <span class="uai-preview-line line-3"></span>
                </div>
                <span class="uai-writing-caret"></span>
              </div>

              <div class="uai-mode-tags" aria-label="小说模式功能">
                <span>人物</span><span>大纲</span><span>世界观</span><span>长篇记忆</span>
              </div>

              <span class="uai-mode-enter">进入创作世界 <b>→</b></span>
            </button>

            <button class="uai-mode-card companion" id="uaiEnterCompanion" type="button" aria-describedby="uaiCompanionDesc">
              <span class="uai-card-glow" aria-hidden="true"></span>
              <span class="uai-card-noise" aria-hidden="true"></span>
              <span class="uai-card-streak streak-one" aria-hidden="true"></span>
              <span class="uai-card-streak streak-two" aria-hidden="true"></span>

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
                  <span class="uai-avatar-hair"></span>
                  <span class="uai-avatar-face">✦</span>
                  <span class="uai-avatar-spark spark-a">✦</span>
                  <span class="uai-avatar-spark spark-b">·</span>
                </div>
                <div class="uai-chat-preview">
                  <span class="uai-chat-name">她 · 刚刚</span>
                  <p id="uaiCompanionMessage">${companionMessages[0]}</p>
                  <span class="uai-chat-status"><i></i> 在线</span>
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
    setupCardInteractions();
    setupAmbientEffects();
    return root;
  }

  function setupCardInteractions() {
    const grid = root?.querySelector("#uaiModeGrid");
    const cards = [...(root?.querySelectorAll(".uai-mode-card") || [])];
    if (!grid || !cards.length) return;

    cards.forEach((card) => {
      const kind = card.classList.contains("novel") ? "novel" : "companion";

      card.addEventListener("pointerenter", () => {
        grid.dataset.active = kind;
      });

      card.addEventListener("pointermove", (event) => {
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
        const y = (event.clientY - rect.top) / Math.max(rect.height, 1);
        const ry = (x - 0.5) * 3.2;
        const rx = (0.5 - y) * 2.6;
        card.style.setProperty("--uai-card-rx", `${rx.toFixed(2)}deg`);
        card.style.setProperty("--uai-card-ry", `${ry.toFixed(2)}deg`);
        card.style.setProperty("--uai-spot-x", `${(x * 100).toFixed(1)}%`);
        card.style.setProperty("--uai-spot-y", `${(y * 100).toFixed(1)}%`);
      });

      card.addEventListener("pointerleave", () => {
        delete grid.dataset.active;
        card.style.setProperty("--uai-card-rx", "0deg");
        card.style.setProperty("--uai-card-ry", "0deg");
        card.style.setProperty("--uai-spot-x", "50%");
        card.style.setProperty("--uai-spot-y", "50%");
      });

      card.addEventListener("focus", () => {
        grid.dataset.active = kind;
      });

      card.addEventListener("blur", () => {
        delete grid.dataset.active;
      });
    });
  }

  function setupAmbientEffects() {
    if (!root || effects.canvas) return;

    effects.canvas = root.querySelector("#uaiModeStars");
    effects.ctx = effects.canvas?.getContext?.("2d", { alpha: true }) || null;
    if (!effects.canvas || !effects.ctx) return;

    effects.resizeHandler = resizeCanvas;
    effects.pointerHandler = (event) => {
      if (!root || currentMode !== "lobby") return;
      const x = Math.max(-1, Math.min(1, (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2));
      const y = Math.max(-1, Math.min(1, (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2));
      root.style.setProperty("--uai-mx", x.toFixed(3));
      root.style.setProperty("--uai-my", y.toFixed(3));
    };
    effects.pointerLeaveHandler = () => {
      root?.style.setProperty("--uai-mx", "0");
      root?.style.setProperty("--uai-my", "0");
    };
    effects.visibilityHandler = () => {
      if (document.hidden) stopEffects();
      else if (currentMode === "lobby" && !root?.hidden) startEffects();
    };

    window.addEventListener("resize", effects.resizeHandler, { passive: true });
    window.addEventListener("pointermove", effects.pointerHandler, { passive: true });
    document.documentElement.addEventListener("mouseleave", effects.pointerLeaveHandler, { passive: true });
    document.addEventListener("visibilitychange", effects.visibilityHandler);

    resizeCanvas();
  }

  function resizeCanvas() {
    if (!effects.canvas || !effects.ctx) return;
    const rect = effects.canvas.getBoundingClientRect();
    effects.width = Math.max(1, Math.round(rect.width || window.innerWidth));
    effects.height = Math.max(1, Math.round(rect.height || window.innerHeight));
    effects.dpr = Math.min(window.devicePixelRatio || 1, 2);

    effects.canvas.width = Math.round(effects.width * effects.dpr);
    effects.canvas.height = Math.round(effects.height * effects.dpr);
    effects.ctx.setTransform(effects.dpr, 0, 0, effects.dpr, 0, 0);

    const count = Math.max(70, Math.min(155, Math.round((effects.width * effects.height) / 10500)));
    effects.stars = Array.from({ length: count }, () => createStar(true));
  }

  function createStar(randomY = false) {
    const depth = 0.45 + Math.random() * 0.8;
    return {
      x: Math.random() * effects.width,
      y: randomY ? Math.random() * effects.height : -8,
      r: (0.45 + Math.random() * 1.25) * depth,
      alpha: 0.24 + Math.random() * 0.66,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.0007 + Math.random() * 0.0016,
      drift: 0.004 + Math.random() * 0.016,
      depth,
      cross: Math.random() > 0.93
    };
  }

  function spawnMeteor(now) {
    const fromRight = Math.random() > 0.45;
    const x = fromRight ? effects.width * (0.48 + Math.random() * 0.48) : effects.width * (0.18 + Math.random() * 0.55);
    const y = effects.height * (0.02 + Math.random() * 0.30);
    const speed = 0.34 + Math.random() * 0.18;
    effects.meteors.push({
      x,
      y,
      vx: -speed,
      vy: speed * (0.46 + Math.random() * 0.18),
      age: 0,
      life: 820 + Math.random() * 420,
      length: 82 + Math.random() * 68
    });
    effects.nextMeteorAt = now + 4500 + Math.random() * 6500;
  }

  function drawStar(ctx, star, now, dt) {
    star.y += star.drift * dt * star.depth;
    star.x -= star.drift * dt * 0.13;
    if (star.y > effects.height + 6 || star.x < -6) Object.assign(star, createStar(false), { x: Math.random() * effects.width });

    const pulse = Math.sin(now * star.twinkleSpeed + star.twinkle) * 0.28;
    const alpha = Math.max(0.08, Math.min(1, star.alpha + pulse));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();

    if (star.cross && alpha > 0.55) {
      const size = 5 + star.r * 3;
      const gradientH = ctx.createLinearGradient(star.x - size, star.y, star.x + size, star.y);
      gradientH.addColorStop(0, "rgba(255,255,255,0)");
      gradientH.addColorStop(0.5, "rgba(255,255,255,.72)");
      gradientH.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = gradientH;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(star.x - size, star.y);
      ctx.lineTo(star.x + size, star.y);
      ctx.stroke();

      const gradientV = ctx.createLinearGradient(star.x, star.y - size, star.x, star.y + size);
      gradientV.addColorStop(0, "rgba(255,255,255,0)");
      gradientV.addColorStop(0.5, "rgba(255,255,255,.55)");
      gradientV.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = gradientV;
      ctx.beginPath();
      ctx.moveTo(star.x, star.y - size);
      ctx.lineTo(star.x, star.y + size);
      ctx.stroke();
    }
  }

  function drawMeteor(ctx, meteor, dt) {
    meteor.age += dt;
    meteor.x += meteor.vx * dt;
    meteor.y += meteor.vy * dt;
    const lifeRatio = meteor.age / meteor.life;
    const opacity = Math.sin(Math.min(1, lifeRatio) * Math.PI) * 0.88;
    const length = meteor.length;
    const mag = Math.hypot(meteor.vx, meteor.vy) || 1;
    const ux = meteor.vx / mag;
    const uy = meteor.vy / mag;
    const tailX = meteor.x - ux * length;
    const tailY = meteor.y - uy * length;
    const gradient = ctx.createLinearGradient(tailX, tailY, meteor.x, meteor.y);
    gradient.addColorStop(0, "rgba(132,112,255,0)");
    gradient.addColorStop(0.52, `rgba(167,155,255,${opacity * 0.22})`);
    gradient.addColorStop(1, `rgba(255,255,255,${opacity})`);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(meteor.x, meteor.y);
    ctx.stroke();
  }

  function renderEffects(now) {
    if (!effects.running || !effects.ctx) return;
    const ctx = effects.ctx;
    const dt = Math.min(40, Math.max(0, now - (effects.lastTime || now)));
    effects.lastTime = now;
    ctx.clearRect(0, 0, effects.width, effects.height);

    effects.stars.forEach((star) => drawStar(ctx, star, now, dt));

    if (!effects.nextMeteorAt) effects.nextMeteorAt = now + 2600 + Math.random() * 3400;
    if (now >= effects.nextMeteorAt && effects.meteors.length < 2) spawnMeteor(now);

    effects.meteors.forEach((meteor) => drawMeteor(ctx, meteor, dt));
    effects.meteors = effects.meteors.filter((meteor) => meteor.age < meteor.life);

    ctx.globalAlpha = 1;
    effects.raf = requestAnimationFrame(renderEffects);
  }

  function startPreviewRotation() {
    if (effects.quoteTimer) return;
    effects.quoteTimer = window.setInterval(() => {
      if (currentMode !== "lobby" || root?.hidden) return;
      effects.quoteIndex = (effects.quoteIndex + 1) % novelQuotes.length;
      effects.messageIndex = (effects.messageIndex + 1) % companionMessages.length;
      swapPreviewText(root?.querySelector("#uaiNovelQuote"), novelQuotes[effects.quoteIndex]);
      swapPreviewText(root?.querySelector("#uaiCompanionMessage"), companionMessages[effects.messageIndex]);
    }, 5200);
  }

  function swapPreviewText(element, nextText) {
    if (!element) return;
    element.classList.add("is-swapping");
    window.setTimeout(() => {
      element.textContent = nextText;
      element.classList.remove("is-swapping");
      element.classList.add("is-arriving");
      window.setTimeout(() => element.classList.remove("is-arriving"), 420);
    }, 180);
  }

  function startEffects() {
    if (!effects.ctx || effects.running || document.hidden) return;
    effects.running = true;
    effects.lastTime = performance.now();
    effects.raf = requestAnimationFrame(renderEffects);
    startPreviewRotation();
  }

  function stopEffects() {
    effects.running = false;
    effects.lastTime = 0;
    if (effects.raf) cancelAnimationFrame(effects.raf);
    effects.raf = 0;
    if (effects.quoteTimer) clearInterval(effects.quoteTimer);
    effects.quoteTimer = 0;
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
    resizeCanvas();
    startEffects();
  }

  function enterNovel() {
    stopEffects();
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
      button.classList.add("is-loading");
    }

    try {
      await ensureScript(`/companion-mode.js?v=${encodeURIComponent(REVISION)}`, "uaiCompanionScript");
      if (!window.UnlimitedCompanion?.mount) throw new Error("Companion module did not initialize");
      stopEffects();
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
        button.classList.remove("is-loading");
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