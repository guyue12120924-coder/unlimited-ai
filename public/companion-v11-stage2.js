// Companion V11.2 — structured role editor + memory book presentation.
(() => {
  const REVISION = "2026-08-14-v11.2-stage2-3";
  let scheduled = false;

  function state() {
    return window.UnlimitedCompanion?.getState?.() || {};
  }

  function ensureLayoutFix() {
    if (document.getElementById("uaiCompanionV11Stage2LayoutFix")) return;
    const style = document.createElement("style");
    style.id = "uaiCompanionV11Stage2LayoutFix";
    style.textContent = `
      /* V11.2.1 role-editor layout hotfix: keep preview and form in separate columns. */
      #uaiV9RoleEditorMask .uai-c-v11-role-editor{
        width:min(96vw,1080px)!important;
        max-width:1080px!important;
        max-height:min(91vh,900px)!important;
        display:flex!important;
        flex-direction:column!important;
        overflow:hidden!important;
      }
      #uaiV9RoleEditorMask .uai-c-v11-role-editor>header,
      #uaiV9RoleEditorMask .uai-c-v11-role-editor>footer{
        flex:0 0 auto!important;
      }
      #uaiV9RoleEditorMask .uai-c-v11-role-editor .uai-c-v10-role-editor-layout{
        flex:1 1 auto!important;
        min-height:0!important;
        width:100%!important;
        display:grid!important;
        grid-template-columns:minmax(240px,270px) minmax(0,1fr)!important;
        align-items:stretch!important;
        gap:20px!important;
        padding:18px 20px 20px!important;
        overflow:hidden!important;
        box-sizing:border-box!important;
      }
      #uaiV9RoleEditorMask .uai-c-v11-role-editor .uai-c-v10-role-preview{
        position:relative!important;
        top:auto!important;
        left:auto!important;
        right:auto!important;
        width:auto!important;
        min-width:0!important;
        max-width:none!important;
        height:100%!important;
        min-height:0!important;
        align-self:stretch!important;
        overflow:auto!important;
        box-sizing:border-box!important;
      }
      #uaiV9RoleEditorMask .uai-c-v11-role-editor .uai-c-v3-form{
        width:100%!important;
        min-width:0!important;
        max-width:none!important;
        height:100%!important;
        max-height:none!important;
        margin:0!important;
        padding:0 6px 14px 0!important;
        overflow-y:auto!important;
        overflow-x:hidden!important;
        box-sizing:border-box!important;
      }
      #uaiV9RoleEditorMask .uai-c-v11-role-editor .uai-c-v11-editor-nav,
      #uaiV9RoleEditorMask .uai-c-v11-role-editor .uai-c-v11-editor-section{
        width:100%!important;
        min-width:0!important;
        box-sizing:border-box!important;
      }
      #uaiV9RoleEditorMask .uai-c-v11-role-editor .uai-c-v11-editor-fields{
        min-width:0!important;
      }
      #uaiV9RoleEditorMask .uai-c-v11-role-editor .uai-c-v11-editor-section label,
      #uaiV9RoleEditorMask .uai-c-v11-role-editor .uai-c-v11-editor-section input,
      #uaiV9RoleEditorMask .uai-c-v11-role-editor .uai-c-v11-editor-section select,
      #uaiV9RoleEditorMask .uai-c-v11-role-editor .uai-c-v11-editor-section textarea{
        min-width:0!important;
        max-width:100%!important;
        box-sizing:border-box!important;
      }

      /* V11.2.2: the simple memory editor must expose management without hiding it in Advanced. */
      #uaiCompanionModalMask .uai-c-v11-memory-entry{
        display:flex!important;
        align-items:center!important;
        justify-content:space-between!important;
        gap:16px!important;
        margin:0 0 14px!important;
        padding:13px 14px!important;
        border:1px solid rgba(111,85,197,.10)!important;
        border-radius:14px!important;
        background:linear-gradient(135deg,rgba(139,92,246,.07),rgba(236,72,153,.04),rgba(255,255,255,.88))!important;
      }
      #uaiCompanionModalMask .uai-c-v11-memory-entry-copy{min-width:0!important}
      #uaiCompanionModalMask .uai-c-v11-memory-entry-copy strong{
        display:block!important;color:#4b4059!important;font-size:11px!important;font-weight:760!important;
      }
      #uaiCompanionModalMask .uai-c-v11-memory-entry-copy span{
        display:block!important;margin-top:3px!important;color:#9a90a5!important;font-size:9.5px!important;line-height:1.5!important;
      }
      #uaiCompanionModalMask .uai-c-v11-memory-manage-visible{
        flex:0 0 auto!important;min-height:38px!important;padding:0 13px!important;
        border:1px solid rgba(124,58,237,.18)!important;border-radius:11px!important;
        background:linear-gradient(135deg,#8b5cf6,#7c3aed 68%,#c14fc2 140%)!important;
        box-shadow:0 8px 20px rgba(124,58,237,.16)!important;
        color:#fff!important;font-size:10px!important;font-weight:730!important;cursor:pointer!important;
      }
      #uaiCompanionModalMask .uai-c-v11-memory-manage-visible:hover{
        transform:translateY(-1px)!important;box-shadow:0 10px 24px rgba(124,58,237,.21)!important;
      }
      #uaiCompanionModalMask .uai-c-memory-add{gap:10px!important;align-items:center!important}
      #uaiCompanionModalMask .uai-c-memory-add input{
        min-height:44px!important;padding:0 13px!important;
        border:1px solid rgba(111,85,197,.13)!important;border-radius:12px!important;
        background:#fbfaff!important;color:#403749!important;
        box-shadow:inset 0 1px 2px rgba(68,49,107,.025)!important;
      }
      #uaiCompanionModalMask .uai-c-memory-add input::placeholder{color:#aaa0b2!important}
      #uaiCompanionModalMask .uai-c-memory-add input:focus{
        outline:none!important;border-color:rgba(124,58,237,.30)!important;
        box-shadow:0 0 0 3px rgba(139,92,246,.075)!important;
      }

      @media (max-width:860px){
        #uaiV9RoleEditorMask{padding:12px!important}
        #uaiV9RoleEditorMask .uai-c-v11-role-editor{
          width:calc(100vw - 24px)!important;
          max-width:none!important;
          max-height:calc(100vh - 24px)!important;
          overflow:auto!important;
        }
        #uaiV9RoleEditorMask .uai-c-v11-role-editor .uai-c-v10-role-editor-layout{
          display:block!important;
          overflow:visible!important;
          padding:12px!important;
        }
        #uaiV9RoleEditorMask .uai-c-v11-role-editor .uai-c-v10-role-preview{
          position:relative!important;
          height:auto!important;
          min-height:0!important;
          margin-bottom:12px!important;
          overflow:visible!important;
        }
        #uaiV9RoleEditorMask .uai-c-v11-role-editor .uai-c-v3-form{
          height:auto!important;
          max-height:none!important;
          overflow:visible!important;
          padding:0 0 8px!important;
        }
      }
      @media (max-width:640px){
        #uaiCompanionModalMask .uai-c-v11-memory-entry{align-items:flex-start!important;flex-direction:column!important}
        #uaiCompanionModalMask .uai-c-v11-memory-manage-visible{width:100%!important}
      }
    `;
    document.head.appendChild(style);
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
    if (src) {
      const current = host.querySelector("img");
      if (current?.getAttribute("src") === src) return;
      host.innerHTML = "";
      const image = document.createElement("img");
      image.src = src;
      image.alt = `${profile?.name || "AI 伙伴"}头像`;
      host.appendChild(image);
      return;
    }
    const symbol = avatarSymbol(profile);
    if (host.textContent !== symbol || host.querySelector("img")) host.textContent = symbol;
  }

  function section(title, desc, key) {
    const node = document.createElement("section");
    node.className = "uai-c-v11-editor-section";
    node.dataset.v11EditorSection = key;
    node.innerHTML = `<header><span>${title}</span><p>${desc}</p></header><div class="uai-c-v11-editor-fields"></div>`;
    return node;
  }

  function decorateRoleEditor() {
    const editor = document.querySelector("#uaiV9RoleEditorMask .uai-c-v9-role-editor");
    if (!editor || editor.dataset.v11Structured === "1") return;
    const form = editor.querySelector(".uai-c-v3-form");
    if (!form) return;

    editor.dataset.v11Structured = "1";
    editor.classList.add("uai-c-v11-role-editor");

    const nameField = form.querySelector('#uaiV9RoleName, #uaiV9NewRoleName')?.closest("label");
    const relationField = form.querySelector('#uaiV9RoleRelation, #uaiV9NewRoleRelation')?.closest("label");
    const profileField = form.querySelector('.uai-c-v9-background');
    const avatarField = form.querySelector('#uaiV9RoleAvatar, #uaiV9NewRoleAvatar')?.closest("label");

    const nav = document.createElement("div");
    nav.className = "uai-c-v11-editor-nav";
    nav.innerHTML = `
      <button type="button" data-v11-jump="identity" class="active">基础信息</button>
      <button type="button" data-v11-jump="persona">人物设定</button>
      <button type="button" data-v11-jump="visual">视觉</button>`;

    const identity = section("基础信息", "先确定角色是谁，以及你们是什么关系。", "identity");
    const persona = section("人物设定", "身份、经历、性格、习惯与说话方式都集中写在这里。", "persona");
    const visual = section("视觉", "头像只影响界面展示，不改变角色设定内容。", "visual");

    if (nameField) identity.querySelector(".uai-c-v11-editor-fields").appendChild(nameField);
    if (relationField) identity.querySelector(".uai-c-v11-editor-fields").appendChild(relationField);
    if (profileField) persona.querySelector(".uai-c-v11-editor-fields").appendChild(profileField);
    if (avatarField) visual.querySelector(".uai-c-v11-editor-fields").appendChild(avatarField);

    form.append(nav, identity, persona, visual);

    nav.querySelectorAll("[data-v11-jump]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = form.querySelector(`[data-v11-editor-section="${button.dataset.v11Jump}"]`);
        target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        nav.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      });
    });

    const textarea = persona.querySelector("textarea");
    if (textarea) {
      const counter = document.createElement("div");
      counter.className = "uai-c-v11-profile-counter";
      const refresh = () => { counter.textContent = `${textarea.value.length} / ${textarea.maxLength || 5000}`; };
      textarea.insertAdjacentElement("afterend", counter);
      textarea.addEventListener("input", refresh);
      refresh();
    }

    const preview = editor.querySelector(".uai-c-v10-role-preview");
    if (preview && !preview.querySelector(".uai-c-v11-preview-note")) {
      const note = document.createElement("div");
      note.className = "uai-c-v11-preview-note";
      note.innerHTML = `<i>✦</i><span>保存后，这份人物设定会直接参与之后的聊天。</span>`;
      preview.appendChild(note);
    }
  }

  function decorateRoleGallery() {
    const modal = document.querySelector("#uaiCompanionV3Mask .uai-c-v11-role-gallery");
    if (!modal) return;
    const list = modal.querySelector(".uai-c-v3-character-list");
    if (!list || list.previousElementSibling?.classList?.contains("uai-c-v11-gallery-intro")) return;
    const count = list.querySelectorAll(".uai-c-v3-character-card").length;
    const intro = document.createElement("div");
    intro.className = "uai-c-v11-gallery-intro";
    intro.innerHTML = `<div><strong>选择想陪你聊天的角色</strong><span>每个角色的聊天、记忆和设置彼此独立。</span></div><b>${count} / 6</b>`;
    list.insertAdjacentElement("beforebegin", intro);
  }

  function decorateSimpleMemoryModal() {
    const mask = document.getElementById("uaiCompanionModalMask");
    if (!mask || mask.hidden || !mask.querySelector("#uaiMemoryList")) return;
    const modal = mask.querySelector(".uai-c-modal");
    const body = modal?.querySelector(".uai-c-modal-body");
    if (!modal || !body) return;

    let entry = body.querySelector(":scope > .uai-c-v11-memory-entry");
    if (!entry) {
      entry = document.createElement("div");
      entry.className = "uai-c-v11-memory-entry";
      entry.innerHTML = `
        <div class="uai-c-v11-memory-entry-copy">
          <strong>需要整理已有记忆？</strong>
          <span>进入管理模式后可以查看记忆册、置顶、归档、恢复和去重。</span>
        </div>
        <button type="button" class="uai-c-v11-memory-manage-visible">管理记忆</button>`;
      body.insertBefore(entry, body.firstChild);
      entry.querySelector(".uai-c-v11-memory-manage-visible")?.addEventListener("click", () => {
        const api = window.UnlimitedCompanionMemorySearch;
        if (api?.showMemoryOrganizer) {
          mask.hidden = true;
          mask.innerHTML = "";
          api.showMemoryOrganizer();
          return;
        }
        const details = modal.querySelector("#uaiV10MemoryAdvanced");
        if (details) {
          details.open = true;
          details.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    }

    const advancedLabel = modal.querySelector("#uaiV10MemoryAdvanced summary span");
    if (advancedLabel) advancedLabel.textContent = "更多操作";
  }

  function memoryKind(card) {
    const label = card.querySelector(".kind")?.textContent?.trim() || "事实";
    const map = {
      "称呼": "nickname",
      "生日": "birthday",
      "喜好": "like",
      "偏好": "dislike",
      "约束": "constraint",
      "近况": "current",
      "计划": "plan",
      "明确记忆": "explicit",
      "事实": "fact"
    };
    return map[label] || "fact";
  }

  function decorateMemoryBook() {
    const modal = document.querySelector("#uaiCompanionV4Mask .uai-c-v4-modal");
    if (!modal || !modal.querySelector(".uai-c-v4-stats") || !modal.querySelector(".uai-c-v4-memory-list")) return;
    modal.classList.add("uai-c-v11-memory-book");

    const current = state();
    const profile = current.profile || {};
    let hero = modal.querySelector(":scope > .uai-c-v11-memory-hero");
    if (!hero) {
      hero = document.createElement("section");
      hero.className = "uai-c-v11-memory-hero";
      hero.innerHTML = `
        <div class="uai-c-v11-memory-avatar"></div>
        <div class="uai-c-v11-memory-copy"><span>MEMORY BOOK</span><h4></h4><p>这些是真正保存在当前角色下的长期记忆，会在之后的聊天中帮助 TA 更了解你。</p></div>
        <button type="button" class="uai-c-v11-memory-manage-toggle">管理记忆</button>`;
      modal.querySelector(":scope > header")?.insertAdjacentElement("afterend", hero);
      hero.querySelector(".uai-c-v11-memory-manage-toggle")?.addEventListener("click", (event) => {
        const managing = modal.classList.toggle("uai-c-v11-memory-manage");
        event.currentTarget.textContent = managing ? "返回记忆册" : "管理记忆";
      });
    }

    fillAvatar(hero.querySelector(".uai-c-v11-memory-avatar"), profile);
    const title = hero.querySelector("h4");
    if (title) title.textContent = `${profile.name || "TA"}记得的你`;

    modal.querySelectorAll('.uai-c-v4-memory-list[data-memory-panel="active"] .uai-c-v4-memory').forEach((card) => {
      card.dataset.v11MemoryKind = memoryKind(card);
    });

    const headerTitle = modal.querySelector(":scope > header h3");
    const headerDesc = modal.querySelector(":scope > header p");
    if (headerTitle) headerTitle.textContent = "长期记忆";
    if (headerDesc) headerDesc.textContent = "先看 TA 记得了什么；需要整理时再进入管理模式。";
  }

  function enhance() {
    scheduled = false;
    ensureLayoutFix();
    if (document.body.dataset.uaiMode !== "companion") return;
    decorateRoleEditor();
    decorateRoleGallery();
    decorateSimpleMemoryModal();
    decorateMemoryBook();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    ensureLayoutFix();
    document.documentElement.dataset.companionV11Stage2Revision = REVISION;
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode"]
    });
    window.UnlimitedCompanionV11Stage2 = { revision: REVISION, refresh: schedule };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();