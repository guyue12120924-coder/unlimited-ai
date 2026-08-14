// Companion V12.4/12.7 — composer polish + animated backdrop + living character + scene themes.
(() => {
  const REVISION = "2026-08-14-v12.7-scene-themes-1";
  let boundInput = null;
  let scheduled = false;

  function ensureStyle(href, id) {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function ensureScript(src, id) {
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = false;
    document.body.appendChild(script);
  }

  function loadPhaseEnhancements() {
    // Phase 2: visible multi-layer galaxy motion.
    ensureStyle(`/companion-v12-phase2-background.css?v=${encodeURIComponent(REVISION)}`, "uaiCompanionV12Phase2BackgroundCss");
    ensureScript(`/companion-v12-phase2-background.js?v=${encodeURIComponent(REVISION)}`, "uaiCompanionV12Phase2BackgroundScript");
    // Phase 3: living central character.
    ensureStyle(`/companion-v12-phase3-character.css?v=${encodeURIComponent(REVISION)}`, "uaiCompanionV12Phase3CharacterCss");
    ensureScript(`/companion-v12-phase3-character.js?v=${encodeURIComponent(REVISION)}`, "uaiCompanionV12Phase3CharacterScript");
    // Phase 4: four lightweight anime scene themes. Persistence/random selection belongs to phase 5.
    ensureStyle(`/companion-v12-phase4-themes.css?v=${encodeURIComponent(REVISION)}`, "uaiCompanionV12Phase4ThemesCss");
    ensureScript(`/companion-v12-phase4-themes.js?v=${encodeURIComponent(REVISION)}`, "uaiCompanionV12Phase4ThemesScript");
  }

  function installGuaranteedMotionCss() {
    if (document.getElementById("uaiCompanionV125GuaranteedMotionCss")) return;
    const style = document.createElement("style");
    style.id = "uaiCompanionV125GuaranteedMotionCss";
    style.textContent = `
      #uaiCompanionRoot .uai-c-main{
        position:relative!important;
        isolation:isolate!important;
        overflow:hidden!important;
      }

      #uaiCompanionRoot .uai-c-v125-live-bg{
        position:absolute!important;
        inset:0!important;
        z-index:1!important;
        overflow:hidden!important;
        pointer-events:none!important;
        opacity:1!important;
      }

      #uaiCompanionRoot .uai-c-header{position:relative!important;z-index:10!important}
      #uaiCompanionRoot .uai-c-v122-scene{position:relative!important;z-index:5!important;background:
        radial-gradient(circle at 22% 51%,rgba(255,100,205,.10),transparent 28%),
        radial-gradient(circle at 52% 38%,rgba(183,105,255,.12),transparent 31%),
        linear-gradient(180deg,rgba(35,20,88,.23),rgba(20,13,65,.07))!important}
      #uaiCompanionRoot .uai-c-messages{position:relative!important;z-index:5!important;background:linear-gradient(180deg,rgba(12,8,45,.02),rgba(7,7,27,.08))!important}
      #uaiCompanionRoot .uai-c-composer-wrap{position:relative!important;z-index:12!important}

      #uaiCompanionRoot .uai-c-v125-live-nebula{
        position:absolute;inset:-24%;z-index:1;opacity:.95;mix-blend-mode:screen;
        background:
          radial-gradient(ellipse at 18% 22%,rgba(185,76,255,.40),transparent 29%),
          radial-gradient(ellipse at 78% 31%,rgba(83,117,255,.34),transparent 31%),
          radial-gradient(ellipse at 48% 82%,rgba(255,73,190,.27),transparent 31%),
          radial-gradient(ellipse at 58% 52%,rgba(132,86,255,.18),transparent 38%);
        filter:blur(18px) saturate(1.18);
        will-change:transform,filter;
        animation:uaiV125NebulaTravel 15s ease-in-out infinite alternate!important;
      }
      @keyframes uaiV125NebulaTravel{
        0%{transform:translate3d(-5%,-3%,0) scale(1.00) rotate(-1deg);filter:blur(18px) saturate(1.12)}
        45%{transform:translate3d(4%,3%,0) scale(1.08) rotate(1deg);filter:blur(21px) saturate(1.30)}
        100%{transform:translate3d(8%,-1%,0) scale(1.04) rotate(2deg);filter:blur(17px) saturate(1.20)}
      }

      #uaiCompanionRoot .uai-c-v125-live-stars{
        position:absolute;inset:-18%;z-index:3;opacity:.92;mix-blend-mode:screen;
        background-image:
          radial-gradient(circle,rgba(255,255,255,.92) 0 1px,transparent 1.7px),
          radial-gradient(circle,rgba(255,119,211,.82) 0 1.1px,transparent 1.9px),
          radial-gradient(circle,rgba(132,153,255,.86) 0 1px,transparent 1.8px),
          radial-gradient(circle,rgba(221,191,255,.65) 0 .8px,transparent 1.5px);
        background-size:73px 73px,127px 127px,181px 181px,239px 239px;
        background-position:0 0,31px 49px,92px 17px,11px 128px;
        filter:drop-shadow(0 0 4px rgba(191,145,255,.30));
        will-change:transform,background-position;
        animation:uaiV125StarDrift 12s linear infinite!important;
      }
      @keyframes uaiV125StarDrift{
        0%{transform:translate3d(-18px,-8px,0);background-position:0 0,31px 49px,92px 17px,11px 128px}
        100%{transform:translate3d(42px,24px,0);background-position:330px 190px,-248px 205px,286px -164px,-190px 312px}
      }

      #uaiCompanionRoot .uai-c-v125-live-band{
        position:absolute;left:-28%;top:34%;width:158%;height:178px;z-index:2;border-radius:50%;
        transform:rotate(-13deg);transform-origin:center;opacity:.86;mix-blend-mode:screen;
        background:linear-gradient(90deg,transparent 4%,rgba(112,119,255,.05) 15%,rgba(157,100,255,.18) 30%,rgba(255,111,207,.36) 49%,rgba(121,143,255,.20) 68%,rgba(145,93,255,.06) 84%,transparent 96%);
        box-shadow:0 0 28px rgba(194,112,255,.15),0 0 80px rgba(106,118,255,.10);
        filter:blur(1.4px);
        will-change:transform,opacity;
        animation:uaiV125BandTravel 10s ease-in-out infinite alternate!important;
      }
      #uaiCompanionRoot .uai-c-v125-live-band::after{
        content:"";position:absolute;left:3%;right:3%;top:50%;height:2px;border-radius:999px;
        background:linear-gradient(90deg,transparent,rgba(255,223,250,.08),rgba(255,168,225,.58),rgba(205,194,255,.28),transparent);
        box-shadow:0 0 13px rgba(255,141,218,.25)
      }
      @keyframes uaiV125BandTravel{
        0%{transform:translate3d(-7%,-12px,0) rotate(-15deg) scaleX(.96);opacity:.58}
        50%{opacity:.96}
        100%{transform:translate3d(8%,18px,0) rotate(-10deg) scaleX(1.05);opacity:.73}
      }

      #uaiCompanionRoot .uai-c-v125-live-glints{position:absolute;inset:0;z-index:4;pointer-events:none}
      #uaiCompanionRoot .uai-c-v125-live-glints i{
        position:absolute;width:18px;height:18px;opacity:.12;filter:drop-shadow(0 0 8px rgba(235,202,255,.85));
        animation:uaiV125Glint 3.8s ease-in-out infinite!important;
      }
      #uaiCompanionRoot .uai-c-v125-live-glints i::before,
      #uaiCompanionRoot .uai-c-v125-live-glints i::after{
        content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:99px;
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.96),transparent)
      }
      #uaiCompanionRoot .uai-c-v125-live-glints i::before{width:100%;height:1px}
      #uaiCompanionRoot .uai-c-v125-live-glints i::after{width:1px;height:100%;background:linear-gradient(180deg,transparent,rgba(255,255,255,.96),transparent)}
      #uaiCompanionRoot .uai-c-v125-live-glints i:nth-child(1){left:10%;top:18%;animation-delay:-.8s}
      #uaiCompanionRoot .uai-c-v125-live-glints i:nth-child(2){left:34%;top:64%;width:13px;height:13px;animation-delay:-2.2s}
      #uaiCompanionRoot .uai-c-v125-live-glints i:nth-child(3){left:69%;top:25%;width:21px;height:21px;animation-delay:-1.4s}
      #uaiCompanionRoot .uai-c-v125-live-glints i:nth-child(4){left:84%;top:71%;width:15px;height:15px;animation-delay:-3.0s}
      #uaiCompanionRoot .uai-c-v125-live-glints i:nth-child(5){left:56%;top:84%;width:11px;height:11px;animation-delay:-.2s}
      @keyframes uaiV125Glint{
        0%,100%{opacity:.08;transform:scale(.45) rotate(0deg)}
        45%{opacity:.30}
        55%{opacity:1;transform:scale(1.25) rotate(10deg)}
        70%{opacity:.18;transform:scale(.72) rotate(18deg)}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureGuaranteedBackdrop(root) {
    const main = root?.querySelector(".uai-c-main");
    if (!main) return;
    let backdrop = main.querySelector(":scope > .uai-c-v125-live-bg");
    if (backdrop) return;
    backdrop = document.createElement("div");
    backdrop.className = "uai-c-v125-live-bg";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.innerHTML = `
      <div class="uai-c-v125-live-nebula"></div>
      <div class="uai-c-v125-live-band"></div>
      <div class="uai-c-v125-live-stars"></div>
      <div class="uai-c-v125-live-glints"><i></i><i></i><i></i><i></i><i></i></div>
    `;
    main.prepend(backdrop);
  }

  function sync(root) {
    const input = root?.querySelector("#uaiCompanionInput");
    const composer = root?.querySelector(".uai-c-composer");
    if (!input || !composer) return;
    composer.classList.toggle("uai-c-v124-has-value", Boolean(String(input.value || "").trim()));
    composer.classList.toggle("uai-c-v124-focused", document.activeElement === input);
  }

  function bind(root) {
    const input = root?.querySelector("#uaiCompanionInput");
    if (!input) return;
    if (boundInput === input) {
      sync(root);
      return;
    }
    boundInput = input;
    const update = () => sync(root);
    input.addEventListener("input", update, { passive: true });
    input.addEventListener("focus", update, { passive: true });
    input.addEventListener("blur", update, { passive: true });
    input.addEventListener("change", update, { passive: true });
    sync(root);
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root || root.hidden) return;
    root.dataset.v124Phase1 = REVISION;
    root.dataset.v125LiveBackdrop = "active";
    ensureGuaranteedBackdrop(root);
    bind(root);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionV124Phase1Revision = REVISION;
    installGuaranteedMotionCss();
    loadPhaseEnhancements();
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode", "class"]
    });
    window.UnlimitedCompanionV124Phase1 = { revision: REVISION, refresh: schedule };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
