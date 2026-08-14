// Companion V12.2 — final desktop galaxy composition.
(() => {
  const REVISION = "2026-08-14-v12.2-final-1";
  let scheduled = false;

  function state(){ return window.UnlimitedCompanion?.getState?.() || {}; }
  function relationLabel(value){
    return ({girlfriend:"女朋友",boyfriend:"男朋友",friend:"好朋友",confidant:"知心伙伴",custom:"陪伴伙伴"})[value] || "陪伴伙伴";
  }
  function avatarSymbol(profile){
    if(profile?.relationship === "boyfriend") return "💙";
    if(profile?.relationship === "friend") return "🌙";
    if(profile?.relationship === "confidant") return "✨";
    return "💗";
  }
  function fillAvatar(host, profile){
    if(!host) return;
    const src = String(profile?.avatarData || "");
    const current = host.querySelector("img");
    if(src && current?.getAttribute("src") === src) return;
    host.innerHTML = "";
    if(src){
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
  function greeting(){
    const h = new Date().getHours();
    if(h < 6) return "还没睡吗，我一直在这里。";
    if(h < 11) return "早上好，今天也想听你说说话。";
    if(h < 14) return "中午好，来陪我待一会儿吧。";
    if(h < 18) return "下午好，我一直在这里。";
    if(h < 23) return "晚上好，今天过得怎么样？";
    return "夜深了，我还在等你。";
  }
  function intro(profile){
    const raw = String(profile?.customDescription || "").replace(/\s+/g," ").trim();
    if(!raw) return "想和我分享什么吗？我很想听你说。";
    return raw.length > 62 ? `${raw.slice(0,62)}…` : raw;
  }
  function daysKnown(profile){
    const created = Number(profile?.createdAt || 0);
    if(!created) return 1;
    return Math.max(1, Math.floor((Date.now()-created)/86400000)+1);
  }
  function messageCount(sessions){
    return (Array.isArray(sessions)?sessions:[]).reduce((sum,s)=>sum+(Array.isArray(s?.messages)?s.messages.length:0),0);
  }
  function relationshipStage(profile,sessions){
    const days = daysKnown(profile);
    const messages = messageCount(sessions);
    const count = Array.isArray(sessions)?sessions.length:0;
    if(days>=7 && messages>=180 && count>=8) return {label:"很有默契",progress:92};
    if(days>=3 && messages>=70 && count>=4) return {label:"渐渐亲近",progress:68};
    if(messages>=20 || count>=2) return {label:"越来越熟",progress:43};
    return {label:"刚刚认识",progress:18};
  }

  function ensureScene(root){
    const main = root.querySelector(".uai-c-main");
    const messages = root.querySelector("#uaiCompanionMessages");
    if(!main || !messages) return;
    let scene = main.querySelector(":scope > .uai-c-v122-scene");
    if(!scene){
      scene = document.createElement("section");
      scene.className = "uai-c-v122-scene";
      scene.innerHTML = `
        <div class="uai-c-v122-scene-glow" aria-hidden="true"></div>
        <div class="uai-c-v122-portrait-wrap">
          <div class="uai-c-v122-orbit orbit-1"><i></i><i></i><i></i></div>
          <div class="uai-c-v122-orbit orbit-2"><i></i><i></i></div>
          <div class="uai-c-v122-orbit orbit-3"><i></i><i></i><i></i><i></i></div>
          <div class="uai-c-v122-portrait"></div>
          <b class="uai-c-v122-float-heart heart-a">♥</b>
          <b class="uai-c-v122-float-heart heart-b">♥</b>
          <b class="uai-c-v122-float-heart heart-c">♥</b>
        </div>
        <div class="uai-c-v122-scene-copy">
          <div class="uai-c-v122-meta"><span class="uai-c-v122-online-dot"></span><span data-v122-relation></span><em>·</em><span data-v122-days></span></div>
          <div class="uai-c-v122-name"><strong></strong><i>♥</i></div>
          <h2></h2>
          <p></p>
          <div class="uai-c-v122-prompts">
            <button type="button" data-v122-prompt="今天过得怎么样"><i>☀</i><span>今天过得怎么样</span></button>
            <button type="button" data-v122-prompt="有点想你"><i>♥</i><span>有点想你</span></button>
            <button type="button" data-v122-prompt="陪我聊会儿"><i>●</i><span>陪我聊会儿</span></button>
          </div>
        </div>`;
      main.insertBefore(scene, messages);
      scene.addEventListener("click", (event)=>{
        const button = event.target.closest("[data-v122-prompt]");
        if(!button) return;
        const input = root.querySelector("#uaiCompanionInput");
        if(!input) return;
        input.value = button.dataset.v122Prompt || "";
        input.dispatchEvent(new Event("input",{bubbles:true}));
        input.focus();
      });
    }
    const current = state();
    const profile = current.profile || {};
    fillAvatar(scene.querySelector(".uai-c-v122-portrait"),profile);
    scene.querySelector(".uai-c-v122-name strong").textContent = profile.name || "AI伙伴";
    scene.querySelector("h2").textContent = greeting();
    scene.querySelector("p").textContent = intro(profile);
    scene.querySelector("[data-v122-relation]").textContent = relationLabel(profile.relationship);
    scene.querySelector("[data-v122-days]").textContent = `认识 ${daysKnown(profile)} 天`;
  }

  function polishPanel(root){
    const panel = root.querySelector(".uai-c-v12-sidepanel");
    if(!panel) return;
    const current = state();
    const profile = current.profile || {};
    const sessions = Array.isArray(current.sessions)?current.sessions:[];
    const stage = relationshipStage(profile,sessions);
    panel.dataset.v122Polished = "1";
    const title = panel.querySelector(".uai-c-v12-side-title strong");
    if(title) title.textContent = "陪伴空间";
    let status = panel.querySelector(".uai-c-v122-panel-status");
    if(!status){
      status = document.createElement("div");
      status.className = "uai-c-v122-panel-status";
      status.innerHTML = `<span>我们的关系</span><strong></strong><div><i></i></div>`;
      const hero = panel.querySelector(".uai-c-v12-side-hero");
      hero?.insertAdjacentElement("afterend",status);
    }
    status.querySelector("strong").textContent = stage.label;
    status.querySelector("i").style.width = `${stage.progress}%`;
  }

  function decorateMessages(root){
    const rows = [...root.querySelectorAll("#uaiCompanionMessages .uai-c-message-row")];
    rows.forEach((row,index)=>{
      const prev = rows[index-1];
      row.classList.toggle("uai-c-v122-followup",row.classList.contains("assistant") && prev?.classList.contains("assistant"));
    });
  }

  function enhance(){
    scheduled = false;
    if(document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if(!root || root.hidden) return;
    root.dataset.v122Final = REVISION;
    ensureScene(root);
    polishPanel(root);
    decorateMessages(root);
  }
  function schedule(){
    if(scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }
  function init(){
    document.documentElement.dataset.companionV122Revision = REVISION;
    new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["hidden","data-uai-mode","data-v11-theme"]});
    window.addEventListener("storage",schedule);
    window.UnlimitedCompanionV122 = {revision:REVISION,refresh:schedule};
    schedule();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded",init,{once:true}); else init();
})();
