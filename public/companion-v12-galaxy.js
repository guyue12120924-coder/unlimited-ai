// Companion V12.0 — animated galaxy ambience + persistent desktop companion panel.
(() => {
  const REVISION = "2026-08-14-v12.0-galaxy-1";
  const ACTIVE_CHARACTER_KEY = "uai_companion_active_character_v1";
  const MOMENTS_KEY = "uai_companion_moments_v1";
  let scheduled = false;
  let canvas = null;
  let ctx = null;
  let frame = 0;
  let particles = [];
  let shootingStars = [];
  let lastSizeKey = "";
  let paletteKey = "";
  let palette = { a: [158, 96, 255], b: [255, 111, 201], c: [105, 139, 255] };
  const pointer = { x: 0.5, y: 0.45, tx: 0.5, ty: 0.45 };

  function state() {
    return window.UnlimitedCompanion?.getState?.() || {};
  }

  function activeCharacterId() {
    return localStorage.getItem(ACTIVE_CHARACTER_KEY) || "legacy";
  }

  function relationLabel(value) {
    return ({
      girlfriend: "女朋友",
      boyfriend: "男朋友",
      friend: "好朋友",
      confidant: "知心伙伴",
      custom: "陪伴伙伴"
    })[value] || "陪伴伙伴";
  }

  function avatarSymbol(profile) {
    if (profile?.relationship === "boyfriend") return "💙";
    if (profile?.relationship === "friend") return "🌙";
    if (profile?.relationship === "confidant") return "✨";
    return "💗";
  }

  function fillAvatar(host, profile) {
    if (!host) return;
    const src = String(profile?.avatarData || "");
    const current = host.querySelector("img");
    if (src && current?.getAttribute("src") === src) return;
    host.innerHTML = "";
    if (src) {
      const image = document.createElement("img");
      image.src = src;
      image.alt = `${profile?.name || "AI 伙伴"}头像`;
      host.appendChild(image);
    } else {
      const span = document.createElement("span");
      span.textContent = avatarSymbol(profile);
      host.appendChild(span);
    }
  }

  function getMomentCount() {
    try {
      const map = JSON.parse(localStorage.getItem(MOMENTS_KEY) || "{}");
      const list = map?.[activeCharacterId()];
      return Array.isArray(list) ? list.length : 0;
    } catch {
      return 0;
    }
  }

  function stats() {
    const current = state();
    const sessions = Array.isArray(current.sessions) ? current.sessions : [];
    const messages = sessions.reduce((sum, session) => sum + (Array.isArray(session?.messages) ? session.messages.length : 0), 0);
    const memories = Array.isArray(current.memories) ? current.memories.length : 0;
    const createdAt = Number(current.profile?.createdAt || 0) || Date.now();
    const days = Math.max(1, Math.floor((Date.now() - createdAt) / 86400000) + 1);
    return { sessions: sessions.length, messages, memories, days, moments: getMomentCount() };
  }

  function stageFor(value) {
    if (value.days >= 7 && value.messages >= 180 && value.sessions >= 8) return { label: "很有默契", progress: 92, level: 4 };
    if (value.days >= 3 && value.messages >= 70 && value.sessions >= 4) return { label: "渐渐亲近", progress: 68, level: 3 };
    if (value.messages >= 20 || value.sessions >= 2) return { label: "越来越熟", progress: 43, level: 2 };
    return { label: "刚刚认识", progress: 18, level: 1 };
  }

  function summaryText(profile) {
    const text = String(profile?.customDescription || "").replace(/\s+/g, " ").trim();
    if (!text) return "在星河里留下一点只属于你们的故事。";
    return text.length > 74 ? `${text.slice(0, 74)}…` : text;
  }

  function parseRgbColor(value, fallback) {
    const text = String(value || "").trim();
    const hex = text.match(/^#([0-9a-f]{6})$/i);
    if (hex) {
      return [
        parseInt(hex[1].slice(0, 2), 16),
        parseInt(hex[1].slice(2, 4), 16),
        parseInt(hex[1].slice(4, 6), 16)
      ];
    }
    const rgb = text.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    return fallback;
  }

  function refreshPalette(root) {
    const style = getComputedStyle(root);
    const key = `${style.getPropertyValue("--v11-a")}|${style.getPropertyValue("--v11-b")}|${root.dataset.v11Theme || ""}`;
    if (key === paletteKey) return;
    paletteKey = key;
    palette = {
      a: parseRgbColor(style.getPropertyValue("--v11-a"), [158, 96, 255]),
      b: parseRgbColor(style.getPropertyValue("--v11-b"), [255, 111, 201]),
      c: [102, 135, 255]
    };
  }

  function rgba(rgb, alpha) {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  }

  function ensureGalaxyLayer(root) {
    const main = root.querySelector(".uai-c-main");
    if (!main) return;

    let layer = main.querySelector(":scope > .uai-c-v12-galaxy-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "uai-c-v12-galaxy-layer";
      layer.setAttribute("aria-hidden", "true");
      layer.innerHTML = `
        <canvas class="uai-c-v12-particles"></canvas>
        <div class="uai-c-v12-nebula">
          <i class="orb orb-a"></i>
          <i class="orb orb-b"></i>
          <i class="orb orb-c"></i>
          <i class="ribbon ribbon-a"></i>
          <i class="ribbon ribbon-b"></i>
        </div>`;
      main.prepend(layer);
    }

    canvas = layer.querySelector("canvas");
    ctx = canvas?.getContext("2d", { alpha: true }) || null;
    resizeCanvas();
    if (!frame && ctx) frame = requestAnimationFrame(animate);
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const key = `${width}x${height}@${dpr}`;
    if (key === lastSizeKey) return;
    lastSizeKey = key;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const area = width * height;
    const count = Math.max(72, Math.min(150, Math.round(area / 12500)));
    particles = Array.from({ length: count }, (_, index) => makeParticle(width, height, index));
    shootingStars = [];
  }

  function makeParticle(width, height, index) {
    const big = index % 13 === 0;
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * (big ? 0.1 : 0.18),
      vy: (Math.random() - 0.5) * (big ? 0.08 : 0.15),
      r: big ? 1.7 + Math.random() * 1.7 : 0.45 + Math.random() * 1.25,
      alpha: big ? 0.7 + Math.random() * 0.3 : 0.28 + Math.random() * 0.62,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.006 + Math.random() * 0.018,
      tint: index % 5 === 0 ? "b" : index % 7 === 0 ? "c" : "a"
    };
  }

  function spawnShootingStar(width, height) {
    if (shootingStars.length >= 2 || Math.random() > 0.0023) return;
    shootingStars.push({
      x: width * (0.25 + Math.random() * 0.7),
      y: height * (0.02 + Math.random() * 0.38),
      vx: -5.2 - Math.random() * 3.8,
      vy: 2.1 + Math.random() * 1.9,
      life: 1,
      length: 72 + Math.random() * 120
    });
  }

  function animate() {
    frame = requestAnimationFrame(animate);
    if (!canvas || !ctx || document.hidden) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (!width || !height) return;
    if (`${Math.round(width)}x${Math.round(height)}` !== lastSizeKey.split("@")[0]) resizeCanvas();

    pointer.x += (pointer.tx - pointer.x) * 0.035;
    pointer.y += (pointer.ty - pointer.y) * 0.035;
    ctx.clearRect(0, 0, width, height);

    const ox = (pointer.x - 0.5) * 12;
    const oy = (pointer.y - 0.5) * 9;

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.twinkle += p.speed;
      if (p.x < -20) p.x = width + 20;
      if (p.x > width + 20) p.x = -20;
      if (p.y < -20) p.y = height + 20;
      if (p.y > height + 20) p.y = -20;
      const alpha = Math.max(0.08, p.alpha * (0.64 + Math.sin(p.twinkle) * 0.36));
      const color = palette[p.tint] || palette.a;
      const x = p.x + ox * (p.r / 3);
      const y = p.y + oy * (p.r / 3);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, p.r * 5.2);
      glow.addColorStop(0, rgba(color, alpha));
      glow.addColorStop(0.22, rgba(color, alpha * 0.82));
      glow.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, p.r * 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba([255, 255, 255], Math.min(0.95, alpha + 0.12));
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.55, p.r * 0.55), 0, Math.PI * 2);
      ctx.fill();
    }

    const nearby = particles.slice(0, Math.min(92, particles.length));
    for (let i = 0; i < nearby.length; i += 1) {
      for (let j = i + 1; j < nearby.length; j += 1) {
        const a = nearby[i];
        const b = nearby[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > 7600) continue;
        const alpha = (1 - dist2 / 7600) * 0.055;
        ctx.strokeStyle = rgba(i % 2 ? palette.a : palette.b, alpha);
        ctx.lineWidth = 0.65;
        ctx.beginPath();
        ctx.moveTo(a.x + ox * 0.18, a.y + oy * 0.18);
        ctx.lineTo(b.x + ox * 0.18, b.y + oy * 0.18);
        ctx.stroke();
      }
    }

    spawnShootingStar(width, height);
    shootingStars = shootingStars.filter((s) => {
      s.x += s.vx;
      s.y += s.vy;
      s.life -= 0.018;
      if (s.life <= 0) return false;
      const mag = Math.hypot(s.vx, s.vy) || 1;
      const tx = s.x - (s.vx / mag) * s.length;
      const ty = s.y - (s.vy / mag) * s.length;
      const grad = ctx.createLinearGradient(s.x, s.y, tx, ty);
      grad.addColorStop(0, rgba([255, 255, 255], Math.min(1, s.life)));
      grad.addColorStop(0.16, rgba(palette.b, s.life * 0.75));
      grad.addColorStop(1, rgba(palette.a, 0));
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      return true;
    });
  }

  function runAction(root, action) {
    if (action === "role") return window.UnlimitedCompanionCharacterControls?.openEditor?.();
    if (action === "memory") return root.querySelector("#uaiCompanionMemoryBtn")?.click();
    if (action === "moments") return window.UnlimitedCompanionMemorySearch?.showMoments?.();
    if (action === "relationship") return window.UnlimitedCompanionProfileRestore?.showCharacterProfile?.();
    if (action === "review") return window.UnlimitedCompanionExtras?.showMonthlyReview?.();
    if (action === "settings") return root.querySelector("#uaiCompanionSettingsBtn")?.click();
  }

  function ensureDesktopPanel(root) {
    const shell = root.querySelector(".uai-c-shell");
    if (!shell) return;
    let panel = shell.querySelector(":scope > .uai-c-v12-sidepanel");
    if (!panel) {
      panel = document.createElement("aside");
      panel.className = "uai-c-v12-sidepanel";
      panel.setAttribute("aria-label", "陪伴空间概览");
      panel.innerHTML = `
        <div class="uai-c-v12-side-title"><span>✦</span><strong>陪伴空间</strong></div>
        <section class="uai-c-v12-side-hero">
          <div class="uai-c-v12-side-avatar"><div></div></div>
          <strong class="uai-c-v12-side-name">AI 伙伴</strong>
          <span class="uai-c-v12-side-relation">陪伴伙伴 · 在线</span>
          <p class="uai-c-v12-side-summary"></p>
        </section>
        <section class="uai-c-v12-side-progress">
          <div><span>我们的关系正在升温中</span><strong data-v12-level>Lv.1</strong></div>
          <div class="uai-c-v12-side-track"><i></i></div>
          <small><span data-v12-progress-value>0</span> / 100</small>
        </section>
        <div class="uai-c-v12-side-stats">
          <div><strong data-v12-days>1</strong><span>认识天数</span></div>
          <div><strong data-v12-sessions>0</strong><span>会话次数</span></div>
          <div><strong data-v12-memories>0</strong><span>记忆片段</span></div>
        </div>
        <section class="uai-c-v12-side-actions">
          <span>管理与回顾</span>
          <button type="button" data-v12-action="role"><i>◇</i><b>角色设定</b><small>了解与调整角色</small><em>›</em></button>
          <button type="button" data-v12-action="memory"><i>✦</i><b>长期记忆</b><small>保存重要信息</small><em>›</em></button>
          <button type="button" data-v12-action="moments"><i>☆</i><b>重要时刻</b><small>回看珍藏片段</small><em>›</em></button>
          <button type="button" data-v12-action="relationship"><i>♡</i><b>关系记录</b><small>查看关系时间线</small><em>›</em></button>
        </section>`;
      panel.addEventListener("click", (event) => {
        const button = event.target.closest("[data-v12-action]");
        if (button) runAction(root, button.dataset.v12Action);
      });
      shell.appendChild(panel);
    }
    refreshDesktopPanel(panel);
  }

  function refreshDesktopPanel(panel) {
    const current = state();
    const profile = current.profile || {};
    const value = stats();
    const stage = stageFor(value);
    fillAvatar(panel.querySelector(".uai-c-v12-side-avatar>div"), profile);
    const name = panel.querySelector(".uai-c-v12-side-name");
    const relation = panel.querySelector(".uai-c-v12-side-relation");
    const summary = panel.querySelector(".uai-c-v12-side-summary");
    if (name) name.textContent = profile.name || "AI 伙伴";
    if (relation) relation.textContent = `${relationLabel(profile.relationship)} · ${stage.label}`;
    if (summary) summary.textContent = summaryText(profile);
    panel.querySelector("[data-v12-days]").textContent = String(value.days);
    panel.querySelector("[data-v12-sessions]").textContent = String(value.sessions);
    panel.querySelector("[data-v12-memories]").textContent = String(value.memories);
    panel.querySelector("[data-v12-level]").textContent = `Lv.${stage.level}`;
    panel.querySelector("[data-v12-progress-value]").textContent = String(stage.progress);
    panel.querySelector(".uai-c-v12-side-track i").style.width = `${stage.progress}%`;
  }

  function decorateHeader(root) {
    const header = root.querySelector(".uai-c-header");
    if (!header || header.querySelector(".uai-c-v12-brand-glow")) return;
    const glow = document.createElement("div");
    glow.className = "uai-c-v12-brand-glow";
    glow.setAttribute("aria-hidden", "true");
    header.prepend(glow);
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root || root.hidden) return;
    root.dataset.v12Galaxy = REVISION;
    refreshPalette(root);
    ensureGalaxyLayer(root);
    ensureDesktopPanel(root);
    decorateHeader(root);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionV12GalaxyRevision = REVISION;
    document.addEventListener("pointermove", (event) => {
      pointer.tx = event.clientX / Math.max(1, window.innerWidth);
      pointer.ty = event.clientY / Math.max(1, window.innerHeight);
      const root = document.getElementById("uaiCompanionRoot");
      if (root && !root.hidden) {
        root.style.setProperty("--v12-mx", `${(pointer.tx - 0.5) * 18}px`);
        root.style.setProperty("--v12-my", `${(pointer.ty - 0.5) * 12}px`);
      }
    }, { passive: true });
    window.addEventListener("resize", () => {
      lastSizeKey = "";
      resizeCanvas();
      schedule();
    }, { passive: true });
    window.addEventListener("storage", schedule);
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode", "data-v11-theme"]
    });
    window.UnlimitedCompanionV12Galaxy = { revision: REVISION, refresh: schedule };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
