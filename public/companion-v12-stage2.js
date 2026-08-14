// Companion V12.1 — desktop hero composition + richer galaxy chrome.
(() => {
  const REVISION = "2026-08-14-v12.1-visual-1";
  let scheduled = false;
  let sparkleCanvas = null;
  let sparkleCtx = null;
  let sparkleFrame = 0;
  let sparks = [];
  let streaks = [];

  function state() { return window.UnlimitedCompanion?.getState?.() || {}; }
  function relationLabel(value) {
    return ({ girlfriend:"女朋友", boyfriend:"男朋友", friend:"好朋友", confidant:"知心伙伴", custom:"陪伴伙伴" })[value] || "陪伴伙伴";
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
    host.innerHTML = "";
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = `${profile?.name || "AI伙伴"}头像`;
      host.appendChild(img);
    } else {
      const span = document.createElement("span");
      span.textContent = avatarSymbol(profile);
      host.appendChild(span);
    }
  }
  function dayGreeting() {
    const hour = new Date().getHours();
    if (hour < 6) return "还没睡吗，我一直在这里。";
    if (hour < 11) return "早上好，今天也想听你说说话。";
    if (hour < 14) return "中午好，来陪我待一会儿吧。";
    if (hour < 18) return "下午好，我一直在这里。";
    if (hour < 23) return "晚上好，今天过得怎么样？";
    return "夜深了，我还在等你。";
  }
  function introText(profile) {
    const raw = String(profile?.customDescription || "").replace(/\s+/g, " ").trim();
    if (!raw) return "想和我分享什么吗？我很想听你说。";
    return raw.length > 54 ? `${raw.slice(0, 54)}…` : raw;
  }

  function runAction(root, action) {
    if (action === "space") return window.UnlimitedCompanionV11?.openDrawer?.();
    if (action === "relationship") return window.UnlimitedCompanionProfileRestore?.showCharacterProfile?.();
    if (action === "memory") return root.querySelector("#uaiCompanionMemoryBtn")?.click();
  }

  function ensureBrand(root) {
    const sidebar = root.querySelector(".uai-c-sidebar");
    if (!sidebar || sidebar.querySelector(".uai-c-v121-brand")) return;
    const brand = document.createElement("div");
    brand.className = "uai-c-v121-brand";
    brand.innerHTML = `<i>♥</i><strong>unlimited-ai-first</strong><button type="button" aria-label="收起侧栏">‹‹</button>`;
    sidebar.prepend(brand);
  }

  function ensureRailNav(root) {
    const sidebar = root.querySelector(".uai-c-sidebar");
    const profileCard = sidebar?.querySelector(".uai-c-profile-card");
    if (!sidebar || !profileCard || sidebar.querySelector(".uai-c-v121-rail-nav")) return;
    const nav = document.createElement("div");
    nav.className = "uai-c-v121-rail-nav";
    nav.innerHTML = `
      <button type="button" class="active" data-v121-nav="chat"><i>●</i><span>聊天</span></button>
      <button type="button" data-v121-nav="space"><i>♡</i><span>陪伴空间</span></button>
      <button type="button" data-v121-nav="relationship"><i>◷</i><span>关系记录</span></button>`;
    const newChat = sidebar.querySelector(".uai-c-new-chat");
    if (newChat) newChat.insertAdjacentElement("afterend", nav);
    else profileCard.insertAdjacentElement("afterend", nav);
    nav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-v121-nav]");
      if (!button) return;
      const action = button.dataset.v121Nav;
      if (action === "space") runAction(root, "space");
      else if (action === "relationship") runAction(root, "relationship");
    });
  }

  function ensureHero(root) {
    const messages = root.querySelector("#uaiCompanionMessages");
    if (!messages) return;
    let hero = messages.querySelector(":scope > .uai-c-v121-hero");
    if (!hero) {
      hero = document.createElement("section");
      hero.className = "uai-c-v121-hero";
      hero.innerHTML = `
        <div class="uai-c-v121-portrait-shell">
          <div class="uai-c-v121-orbit orbit-a"></div>
          <div class="uai-c-v121-orbit orbit-b"></div>
          <div class="uai-c-v121-orbit orbit-c"></div>
          <div class="uai-c-v121-portrait"></div>
          <i class="uai-c-v121-heart h1">♥</i><i class="uai-c-v121-heart h2">♥</i><i class="uai-c-v121-heart h3">♥</i>
        </div>
        <div class="uai-c-v121-hero-copy">
          <div class="uai-c-v121-hero-name"><strong></strong><i>♥</i></div>
          <h2></h2>
          <p></p>
          <div class="uai-c-v121-prompts">
            <button type="button" data-v121-prompt="今天过得怎么样"><i>☀</i><span>今天过得怎么样</span></button>
            <button type="button" data-v121-prompt="有点想你"><i>♥</i><span>有点想你</span></button>
            <button type="button" data-v121-prompt="陪我聊会儿"><i>●</i><span>陪我聊会儿</span></button>
          </div>
        </div>`;
      messages.prepend(hero);
      hero.addEventListener("click", (event) => {
        const button = event.target.closest("[data-v121-prompt]");
        if (!button) return;
        const input = root.querySelector("#uaiCompanionInput");
        if (!input) return;
        input.value = button.dataset.v121Prompt || "";
        input.dispatchEvent(new Event("input", { bubbles:true }));
        input.focus();
      });
    }
    const current = state();
    const profile = current.profile || {};
    fillAvatar(hero.querySelector(".uai-c-v121-portrait"), profile);
    hero.querySelector(".uai-c-v121-hero-name strong").textContent = profile.name || "AI 伙伴";
    hero.querySelector("h2").textContent = dayGreeting();
    hero.querySelector("p").textContent = introText(profile);
  }

  function ensureSparkleLayer(root) {
    const main = root.querySelector(".uai-c-main");
    if (!main) return;
    let layer = main.querySelector(":scope > .uai-c-v121-sparkle-layer");
    if (!layer) {
      layer = document.createElement("canvas");
      layer.className = "uai-c-v121-sparkle-layer";
      layer.setAttribute("aria-hidden", "true");
      main.prepend(layer);
    }
    sparkleCanvas = layer;
    sparkleCtx = layer.getContext("2d", { alpha:true });
    resizeSparkles();
    if (!sparkleFrame && sparkleCtx) sparkleFrame = requestAnimationFrame(animateSparkles);
  }

  function resizeSparkles() {
    if (!sparkleCanvas || !sparkleCtx) return;
    const rect = sparkleCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (sparkleCanvas.width === Math.round(w*dpr) && sparkleCanvas.height === Math.round(h*dpr)) return;
    sparkleCanvas.width = Math.round(w*dpr);
    sparkleCanvas.height = Math.round(h*dpr);
    sparkleCtx.setTransform(dpr,0,0,dpr,0,0);
    const count = Math.max(100, Math.min(210, Math.round((w*h)/7000)));
    sparks = Array.from({length:count}, (_,i) => ({
      x:Math.random()*w,y:Math.random()*h,r:i%17===0?1.8+Math.random()*2.1:.35+Math.random()*1.25,
      a:.18+Math.random()*.62,p:Math.random()*Math.PI*2,s:.008+Math.random()*.022,
      hue:i%5===0?318:(i%7===0?214:274)
    }));
    streaks = Array.from({length:5}, (_,i)=>({
      x:w*(.05+Math.random()*.8), y:h*(.05+Math.random()*.85), len:140+Math.random()*250,
      angle:-.45+Math.random()*.9, speed:.12+Math.random()*.2, phase:Math.random()*Math.PI*2, hue:i%2?310:258
    }));
  }

  function animateSparkles(t=0) {
    sparkleFrame = requestAnimationFrame(animateSparkles);
    if (!sparkleCanvas || !sparkleCtx || document.hidden) return;
    const rect = sparkleCanvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    if (!w || !h) return;
    sparkleCtx.clearRect(0,0,w,h);
    sparkleCtx.globalCompositeOperation = "lighter";
    for (const s of streaks) {
      s.phase += .003*s.speed;
      const ox = Math.sin(s.phase)*30;
      const oy = Math.cos(s.phase*.8)*18;
      const x1=s.x+ox, y1=s.y+oy;
      const x2=x1+Math.cos(s.angle)*s.len, y2=y1+Math.sin(s.angle)*s.len;
      const g=sparkleCtx.createLinearGradient(x1,y1,x2,y2);
      g.addColorStop(0,"rgba(255,255,255,0)");
      g.addColorStop(.35,`hsla(${s.hue},100%,80%,.08)`);
      g.addColorStop(.62,`hsla(${s.hue},100%,76%,.26)`);
      g.addColorStop(1,"rgba(255,255,255,0)");
      sparkleCtx.strokeStyle=g; sparkleCtx.lineWidth=1.2;
      sparkleCtx.beginPath(); sparkleCtx.moveTo(x1,y1); sparkleCtx.lineTo(x2,y2); sparkleCtx.stroke();
    }
    for (const s of sparks) {
      s.p += s.s;
      const a=s.a*(.62+.38*Math.sin(s.p));
      const glow=sparkleCtx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r*6);
      glow.addColorStop(0,`hsla(${s.hue},100%,88%,${Math.min(.9,a)})`);
      glow.addColorStop(.18,`hsla(${s.hue},100%,72%,${a*.7})`);
      glow.addColorStop(1,`hsla(${s.hue},100%,60%,0)`);
      sparkleCtx.fillStyle=glow; sparkleCtx.beginPath(); sparkleCtx.arc(s.x,s.y,s.r*6,0,Math.PI*2); sparkleCtx.fill();
      if (s.r>1.7) {
        sparkleCtx.strokeStyle=`rgba(255,255,255,${a*.8})`; sparkleCtx.lineWidth=.55;
        sparkleCtx.beginPath(); sparkleCtx.moveTo(s.x-s.r*5,s.y); sparkleCtx.lineTo(s.x+s.r*5,s.y); sparkleCtx.moveTo(s.x,s.y-s.r*5); sparkleCtx.lineTo(s.x,s.y+s.r*5); sparkleCtx.stroke();
      }
    }
    sparkleCtx.globalCompositeOperation = "source-over";
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root || root.hidden) return;
    root.dataset.v121Visual = REVISION;
    ensureBrand(root);
    ensureRailNav(root);
    ensureHero(root);
    ensureSparkleLayer(root);
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }
  function init() {
    document.documentElement.dataset.companionV121Revision = REVISION;
    window.addEventListener("resize", () => { resizeSparkles(); schedule(); }, { passive:true });
    new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["hidden","data-uai-mode","data-v11-theme"]});
    window.UnlimitedCompanionV121 = { revision:REVISION, refresh:schedule };
    schedule();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",init,{once:true}); else init();
})();
