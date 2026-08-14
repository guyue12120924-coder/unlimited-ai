// Companion V11.2 — structured role editor + memory book presentation.
(() => {
  const REVISION = "2026-08-14-v11.2-stage2-1";
  let scheduled = false;

  function state() {
    return window.UnlimitedCompanion?.getState?.() || {};
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
    if (document.body.dataset.uaiMode !== "companion") return;
    decorateRoleEditor();
    decorateRoleGallery();
    decorateMemoryBook();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
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