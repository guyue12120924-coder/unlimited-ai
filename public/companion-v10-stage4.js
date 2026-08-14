// Companion V10.7 — character editor presentation + new-chat welcome experience.
// UI-only shell: keeps profile/session storage and chat behavior unchanged.
(() => {
  const REVISION = "2026-08-14-v10.7-stage4-1";
  let scheduled = false;

  const RELATION_LABELS = {
    girlfriend: "女朋友",
    boyfriend: "男朋友",
    friend: "好朋友",
    confidant: "知心伙伴",
    custom: "陪伴伙伴"
  };

  function state() {
    return window.UnlimitedCompanion?.getState?.() || {};
  }

  function relationLabel(value) {
    return RELATION_LABELS[value] || "陪伴伙伴";
  }

  function avatarSymbol(profile) {
    if (profile?.relationship === "boyfriend") return "💙";
    if (profile?.relationship === "friend") return "🌙";
    if (profile?.relationship === "confidant") return "✨";
    return "💗";
  }

  function fillAvatar(node, profile) {
    if (!node) return;
    if (profile?.avatarData) {
      const wanted = String(profile.avatarData);
      const image = node.querySelector("img");
      if (image?.src === wanted) return;
      node.innerHTML = "";
      const img = document.createElement("img");
      img.src = wanted;
      img.alt = `${profile?.name || "AI 伙伴"}头像`;
      node.appendChild(img);
      return;
    }
    const symbol = avatarSymbol(profile);
    if (node.textContent !== symbol || node.querySelector("img")) node.textContent = symbol;
  }

  function decorateWelcome(root) {
    const starters = root.querySelector(".uai-c-v10-starters");
    if (!starters) {
      root.classList.remove("uai-c-v10-welcome-mode");
      return;
    }

    root.classList.add("uai-c-v10-welcome-mode");
    const profile = state().profile || {};
    let hero = starters.querySelector(":scope > .uai-c-v10-welcome-hero");
    if (!hero) {
      hero = document.createElement("div");
      hero.className = "uai-c-v10-welcome-hero";
      hero.innerHTML = `
        <div class="uai-c-v10-welcome-avatar" aria-hidden="true"></div>
        <div class="uai-c-v10-welcome-copy">
          <span class="uai-c-v10-welcome-kicker">NEW CONVERSATION</span>
          <h2></h2>
          <p></p>
        </div>`;
      starters.insertBefore(hero, starters.firstChild);
    }

    fillAvatar(hero.querySelector(".uai-c-v10-welcome-avatar"), profile);
    const title = hero.querySelector("h2");
    const desc = hero.querySelector("p");
    if (title) title.textContent = `和${profile.name || "TA"}聊点什么吧`;
    if (desc) desc.textContent = `${relationLabel(profile.relationship)}已经在这里。可以直接说点什么，或者从下面挑一个话题开始。`;

    const label = starters.querySelector(":scope > span");
    if (label) label.textContent = "试试这些话题";

    // Hide only the generic first assistant greeting while the richer welcome card is present.
    const firstAssistant = root.querySelector("#uaiCompanionMessages .uai-c-message-row.assistant");
    if (firstAssistant) firstAssistant.classList.add("uai-c-v10-welcome-greeting");
  }

  function selectedRelation(editor) {
    const select = editor.querySelector("#uaiV9RoleRelation, #uaiV9NewRoleRelation");
    return select?.value || state().profile?.relationship || "girlfriend";
  }

  function currentName(editor) {
    const input = editor.querySelector("#uaiV9RoleName, #uaiV9NewRoleName");
    return (input?.value || state().profile?.name || "新伙伴").trim() || "新伙伴";
  }

  function updateEditorPreview(editor) {
    const preview = editor.querySelector(".uai-c-v10-role-preview");
    if (!preview) return;
    const profile = {
      ...(state().profile || {}),
      name: currentName(editor),
      relationship: selectedRelation(editor)
    };
    const avatar = preview.querySelector(".uai-c-v10-role-preview-avatar");
    if (!avatar?.dataset.localPreview) fillAvatar(avatar, profile);
    const name = preview.querySelector(".uai-c-v10-role-preview-name");
    const relation = preview.querySelector(".uai-c-v10-role-preview-relation");
    if (name) name.textContent = profile.name;
    if (relation) relation.textContent = relationLabel(profile.relationship);
  }

  function bindEditorPreview(editor) {
    if (editor.dataset.v10PreviewBound === "1") return;
    editor.dataset.v10PreviewBound = "1";

    editor.addEventListener("input", (event) => {
      if (event.target.matches("#uaiV9RoleName, #uaiV9NewRoleName")) updateEditorPreview(editor);
    });
    editor.addEventListener("change", (event) => {
      if (event.target.matches("#uaiV9RoleRelation, #uaiV9NewRoleRelation")) {
        updateEditorPreview(editor);
        return;
      }
      if (!event.target.matches("#uaiV9RoleAvatar, #uaiV9NewRoleAvatar")) return;
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") return;
        const avatar = editor.querySelector(".uai-c-v10-role-preview-avatar");
        if (!avatar) return;
        avatar.dataset.localPreview = "1";
        avatar.innerHTML = `<img src="${reader.result}" alt="头像预览">`;
      };
      reader.readAsDataURL(file);
    });
  }

  function decorateRoleEditor() {
    const editor = document.querySelector("#uaiV9RoleEditorMask .uai-c-v9-role-editor");
    if (!editor) return;
    editor.classList.add("uai-c-v10-role-editor-polished");

    const headerTitle = editor.querySelector("header h3");
    const headerDesc = editor.querySelector("header p");
    const isCreate = Boolean(editor.querySelector("#uaiV9CreateRole"));
    if (headerTitle) headerTitle.textContent = isCreate ? "创建新角色" : "角色设定";
    if (headerDesc) headerDesc.textContent = isCreate
      ? "先定义最重要的身份与关系，完整人物设定可以一次性写在下面。"
      : "这里的设定会直接用于这个角色之后的对话。";

    const form = editor.querySelector(":scope > .uai-c-v3-form");
    let layout = editor.querySelector(":scope > .uai-c-v10-role-editor-layout");
    if (!layout && form) {
      layout = document.createElement("div");
      layout.className = "uai-c-v10-role-editor-layout";
      const preview = document.createElement("aside");
      preview.className = "uai-c-v10-role-preview";
      preview.innerHTML = `
        <span class="uai-c-v10-role-preview-label">角色预览</span>
        <div class="uai-c-v10-role-preview-avatar"></div>
        <strong class="uai-c-v10-role-preview-name"></strong>
        <span class="uai-c-v10-role-preview-relation"></span>
        <div class="uai-c-v10-role-preview-divider"></div>
        <p>角色设定越清晰，聊天中的语气、习惯和身份表现就越稳定。</p>
        <div class="uai-c-v10-role-preview-tags"><span>身份</span><span>性格</span><span>语气</span></div>`;
      form.insertAdjacentElement("beforebegin", layout);
      layout.append(preview, form);
    }

    const background = editor.querySelector(".uai-c-v9-background");
    if (background) {
      background.dataset.v10Field = "profile";
      const small = background.querySelector("small");
      if (small) small.textContent = "支持整段粘贴人物卡。身份、外貌、性格、经历、关系细节和说话方式都可以写在这里。";
    }
    const nameInput = editor.querySelector("#uaiV9RoleName, #uaiV9NewRoleName");
    nameInput?.closest("label")?.setAttribute("data-v10-field", "name");
    const relation = editor.querySelector("#uaiV9RoleRelation, #uaiV9NewRoleRelation");
    relation?.closest("label")?.setAttribute("data-v10-field", "relation");
    const avatarInput = editor.querySelector("#uaiV9RoleAvatar, #uaiV9NewRoleAvatar");
    avatarInput?.closest("label")?.setAttribute("data-v10-field", "avatar");

    bindEditorPreview(editor);
    updateEditorPreview(editor);
  }

  function decorateRoleManager() {
    const modal = document.querySelector("#uaiCompanionV3Mask .uai-c-v10-role-manager");
    if (!modal) return;
    modal.classList.add("uai-c-v10-role-manager-polished");
    const cards = modal.querySelectorAll(".uai-c-v3-character-card");
    cards.forEach((card, index) => {
      card.style.setProperty("--v10-role-index", String(index));
    });
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (root && !root.hidden) decorateWelcome(root);
    decorateRoleEditor();
    decorateRoleManager();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  new MutationObserver(schedule).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["hidden", "data-uai-mode"]
  });
  document.addEventListener("input", schedule, true);
  document.addEventListener("change", schedule, true);
  window.UnlimitedCompanionV10Stage4 = { revision: REVISION, refresh: schedule };
  schedule();
})();