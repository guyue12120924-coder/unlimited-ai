// Companion V8 primary navigation, role editing, settings and long-reply UX.
(() => {
  const REVISION = "2026-08-14-v8.2-primary-ux-1";
  const MAX_CHARACTERS = 6;
  const PROFILE_LIMIT = 5000;
  const PROFILE_MARKER = ["以完整角色设定为准"];
  const KEYS = {
    characters: "uai_companion_characters_v1",
    activeCharacter: "uai_companion_active_character_v1",
    profile: "uai_companion_profile_v1",
    sessions: "uai_companion_sessions_v1",
    memories: "uai_companion_memories_v1",
    settings: "uai_companion_settings_v1",
    rollback: "uai_companion_import_rollback_v1"
  };
  const RELATIONS = [
    ["girlfriend", "💗 女朋友"],
    ["boyfriend", "💙 男朋友"],
    ["friend", "🌙 好朋友"],
    ["confidant", "✨ 知心伙伴"],
    ["custom", "🪄 自定义关系"]
  ];
  const LONG_REPLY_THRESHOLD = 1800;
  const LENGTH_PRESETS = [
    ["short", "约 500 字", "短一些"],
    ["balanced", "约 1000 字", "默认"],
    ["detailed", "约 5000 字", "长回复"]
  ];
  const LEGACY_SHELL_CONTROLS = [
    "#uaiCompanionCharacterBtn",
    "#uaiCompanionHeaderMemory",
    "#uaiCompanionHeaderSettings",
    "#uaiCompanionEditProfileInline",
    "#uaiCompanionCreateCharacterBtn"
  ];
  let scheduled = false;

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }
  function read(key, fallback) { return safeParse(localStorage.getItem(key), fallback); }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function clean(value, max = PROFILE_LIMIT) { return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, max); }
  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function makeId(prefix) {
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${token}`;
  }
  function getCharacters() {
    const value = read(KEYS.characters, []);
    return Array.isArray(value) ? value.filter((item) => item?.id && item?.profile) : [];
  }
  function saveCharacters(list) { write(KEYS.characters, list.slice(0, MAX_CHARACTERS)); }
  function getActiveId() { return localStorage.getItem(KEYS.activeCharacter) || ""; }
  function relationOptions(selected = "girlfriend") {
    return RELATIONS.map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${esc(label)}</option>`).join("");
  }
  function legacyProfileText(profile = {}) {
    if (profile.customDescription?.trim()) return profile.customDescription.trim();
    const lines = [];
    const personalities = Array.isArray(profile.personality) ? profile.personality.filter((item) => item && item !== PROFILE_MARKER[0]) : [];
    const speaking = Array.isArray(profile.speakingStyle) ? profile.speakingStyle.filter((item) => item && item !== PROFILE_MARKER[0]) : [];
    if (personalities.length) lines.push(`性格：${personalities.join("、")}`);
    if (speaking.length) lines.push(`说话方式：${speaking.join("；")}`);
    if (profile.userNickname) lines.push(`对用户的称呼：${profile.userNickname}`);
    return lines.join("\n");
  }
  function normalizeProfile(profile, values) {
    return {
      ...profile,
      name: clean(values.name, 40) || profile?.name || "新伙伴",
      relationship: values.relationship || profile?.relationship || "girlfriend",
      personality: PROFILE_MARKER,
      speakingStyle: PROFILE_MARKER,
      customDescription: clean(values.background, PROFILE_LIMIT),
      userNickname: "",
      avatarData: values.avatarData ?? profile?.avatarData ?? "",
      createdAt: Number(profile?.createdAt) || Date.now()
    };
  }
  function initialSession(profile) {
    const now = Date.now();
    return {
      id: makeId("companion-session"),
      title: "新的聊天",
      createdAt: now,
      updatedAt: now,
      v3GreetingEnhanced: true,
      messages: [{ role: "assistant", content: `我是${profile?.name || "你的 AI 伙伴"}。我们从这里开始吧。`, createdAt: now }]
    };
  }

  function closeRoleModal() { document.getElementById("uaiV8RoleEditorMask")?.remove(); }
  function openRoleModal(html, bind) {
    closeRoleModal();
    const mask = document.createElement("div");
    mask.id = "uaiV8RoleEditorMask";
    mask.className = "uai-c-v3-mask uai-c-v8-mask";
    mask.innerHTML = html;
    document.body.appendChild(mask);
    mask.addEventListener("click", (event) => { if (event.target === mask) closeRoleModal(); });
    mask.querySelectorAll("[data-v8-close]").forEach((button) => button.addEventListener("click", closeRoleModal));
    bind?.(mask);
  }
  function remount() {
    window.UnlimitedCompanion?.unmount?.();
    window.setTimeout(() => {
      window.UnlimitedCompanion?.mount?.();
      window.UnlimitedCompanionMulti?.refresh?.();
      window.UnlimitedCompanionV8Secondary?.refresh?.();
      schedule();
    }, 30);
  }
  function findRole(id = getActiveId()) {
    if (!id || id === getActiveId()) {
      const profile = read(KEYS.profile, null);
      if (profile) return { id: getActiveId(), profile };
    }
    const item = getCharacters().find((entry) => entry.id === id);
    return item ? { id: item.id, profile: item.profile } : null;
  }
  function saveRole(id, profile) {
    const list = getCharacters();
    const index = list.findIndex((item) => item.id === id);
    if (index >= 0) list[index] = { ...list[index], profile, updatedAt: Date.now() };
    else if (id && list.length < MAX_CHARACTERS) list.push({ id, profile, sessions: [], memories: [], settings: read(KEYS.settings, {}), createdAt: profile.createdAt, updatedAt: Date.now() });
    saveCharacters(list);

    if (!id || id === getActiveId()) {
      write(KEYS.profile, profile);
      closeRoleModal();
      remount();
    } else {
      closeRoleModal();
      window.UnlimitedCompanionMulti?.showCharacterManager?.();
    }
  }
  function avatarBinding(mask, selector, initial, setter) {
    let current = initial || "";
    setter(current);
    mask.querySelector(selector)?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 700000) {
        alert("头像太大了，请选择 700 KB 以下的图片。");
        event.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          current = reader.result;
          setter(current);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function openEditor(id = getActiveId()) {
    window.UnlimitedCompanionMulti?.persist?.();
    const target = findRole(id);
    if (!target?.profile) return;
    const profile = target.profile;
    let avatar = profile.avatarData || "";
    openRoleModal(`
      <section class="uai-c-v3-modal compact uai-c-v8-role-editor" role="dialog" aria-modal="true" aria-label="编辑角色">
        <header><div><span>CHARACTER</span><h3>编辑角色</h3><p>名字和关系单独填写，其余角色资料直接整段粘贴到一个框里。</p></div><button type="button" data-v8-close>×</button></header>
        <div class="uai-c-v3-form">
          <label>名字<input id="uaiV8Name" value="${esc(profile.name || "")}" maxlength="40" /></label>
          <label>关系<select id="uaiV8Relation">${relationOptions(profile.relationship || "girlfriend")}</select></label>
          <label class="uai-c-v8-background">完整角色设定<textarea id="uaiV8Background" maxlength="${PROFILE_LIMIT}" placeholder="年龄：\n身份：\n外貌：\n性格：\n背景经历：\n与用户的关系细节：\n说话方式：\n其他设定：">${esc(legacyProfileText(profile))}</textarea><small>可直接粘贴完整人物卡，最多 ${PROFILE_LIMIT} 字。</small></label>
          <label>头像（可选）<input id="uaiV8Avatar" type="file" accept="image/png,image/jpeg,image/webp" /><small>头像保存在当前浏览器，建议小于 700 KB。</small></label>
        </div>
        <footer><button type="button" class="secondary" data-v8-close>取消</button><button type="button" id="uaiV8SaveRole">保存角色</button></footer>
      </section>`, (mask) => {
        avatarBinding(mask, "#uaiV8Avatar", avatar, (value) => { avatar = value; });
        mask.querySelector("#uaiV8SaveRole")?.addEventListener("click", () => {
          const next = normalizeProfile(profile, {
            name: mask.querySelector("#uaiV8Name")?.value,
            relationship: mask.querySelector("#uaiV8Relation")?.value,
            background: mask.querySelector("#uaiV8Background")?.value,
            avatarData: avatar
          });
          saveRole(target.id, next);
        });
      });
  }

  function activateNewRole(item, list) {
    saveCharacters(list);
    localStorage.setItem(KEYS.activeCharacter, item.id);
    write(KEYS.profile, item.profile);
    write(KEYS.sessions, item.sessions);
    write(KEYS.memories, item.memories);
    write(KEYS.settings, item.settings);
    closeRoleModal();
    document.getElementById("uaiCompanionV3Mask")?.remove();
    remount();
  }

  function openCreate() {
    window.UnlimitedCompanionMulti?.persist?.();
    const list = getCharacters();
    if (list.length >= MAX_CHARACTERS) {
      alert(`最多只能创建 ${MAX_CHARACTERS} 个角色。`);
      return;
    }
    let avatar = "";
    openRoleModal(`
      <section class="uai-c-v3-modal compact uai-c-v8-role-editor" role="dialog" aria-modal="true" aria-label="新增角色">
        <header><div><span>NEW CHARACTER</span><h3>新增角色</h3><p>创建后会自动切换到新角色，聊天、记忆和设置与其他角色完全分开。</p></div><button type="button" data-v8-close>×</button></header>
        <div class="uai-c-v3-form">
          <label>名字<input id="uaiV8NewName" value="新伙伴" maxlength="40" /></label>
          <label>关系<select id="uaiV8NewRelation">${relationOptions("girlfriend")}</select></label>
          <label class="uai-c-v8-background">完整角色设定<textarea id="uaiV8NewBackground" maxlength="${PROFILE_LIMIT}" placeholder="可以直接整段复制粘贴：\n年龄：\n身份：\n外貌：\n性格：\n背景经历：\n与用户的关系细节：\n说话方式：\n其他设定："></textarea><small>可直接粘贴完整人物卡，最多 ${PROFILE_LIMIT} 字。</small></label>
          <label>头像（可选）<input id="uaiV8NewAvatar" type="file" accept="image/png,image/jpeg,image/webp" /></label>
        </div>
        <footer><button type="button" class="secondary" data-v8-close>取消</button><button type="button" id="uaiV8CreateRole">创建并切换</button></footer>
      </section>`, (mask) => {
        avatarBinding(mask, "#uaiV8NewAvatar", avatar, (value) => { avatar = value; });
        mask.querySelector("#uaiV8CreateRole")?.addEventListener("click", () => {
          const now = Date.now();
          const profile = normalizeProfile({}, {
            name: mask.querySelector("#uaiV8NewName")?.value,
            relationship: mask.querySelector("#uaiV8NewRelation")?.value,
            background: mask.querySelector("#uaiV8NewBackground")?.value,
            avatarData: avatar
          });
          profile.createdAt = now;
          const item = {
            id: makeId("companion-character"),
            profile,
            sessions: [initialSession(profile)],
            memories: [],
            settings: read(KEYS.settings, {}) || {},
            createdAt: now,
            updatedAt: now
          };
          const next = getCharacters();
          next.push(item);
          activateNewRole(item, next);
        });
      });
  }

  function createFirstFromOnboarding() {
    const mask = document.getElementById("uaiCompanionModalMask");
    if (!mask) return;
    const now = Date.now();
    const profile = normalizeProfile({}, {
      name: mask.querySelector("#uaiOnboardName")?.value || "小雨",
      relationship: mask.querySelector("#uaiOnboardRelationship")?.value || "girlfriend",
      background: mask.querySelector("#uaiOnboardDesc")?.value || "",
      avatarData: ""
    });
    profile.createdAt = now;
    const id = getActiveId() || makeId("companion-character");
    const session = initialSession(profile);
    const item = { id, profile, sessions: [session], memories: [], settings: read(KEYS.settings, {}) || {}, createdAt: now, updatedAt: now };
    write(KEYS.profile, profile);
    write(KEYS.sessions, [session]);
    write(KEYS.memories, []);
    localStorage.setItem(KEYS.activeCharacter, id);
    const list = getCharacters().filter((entry) => entry.id !== id);
    list.unshift(item);
    saveCharacters(list);
    mask.hidden = true;
    mask.innerHTML = "";
    remount();
  }

  function openManager() { window.UnlimitedCompanionMulti?.showCharacterManager?.(); }
  function openRelationshipRecord() {
    document.getElementById("uaiCompanionV3Mask")?.remove();
    window.UnlimitedCompanionProfileRestore?.showCharacterProfile?.();
  }

  function ensureRoleToolbar(root) {
    const profileCard = root.querySelector("#uaiCompanionProfileCard");
    if (!profileCard) return;
    const profile = window.UnlimitedCompanion?.getState?.()?.profile;
    if (!profile) return;
    let toolbar = root.querySelector("#uaiCompanionRoleToolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = "uaiCompanionRoleToolbar";
      toolbar.className = "uai-c-role-toolbar";
      profileCard.insertAdjacentElement("afterend", toolbar);
    }
    const characters = getCharacters();
    const activeId = getActiveId();
    const active = characters.find((item) => item.id === activeId) || characters[0];
    const signature = `${active?.id || ""}|${active?.profile?.name || profile.name || ""}|${characters.length}`;
    if (toolbar.dataset.signature === signature) return;
    toolbar.dataset.signature = signature;
    toolbar.innerHTML = `
      <button type="button" class="uai-c-role-main" id="uaiCompanionRoleSwitch" title="切换角色"><span>切换角色</span><b>${characters.length || 1}/6</b></button>
      <button type="button" class="uai-c-role-sub" id="uaiCompanionRoleEdit" title="编辑当前角色">编辑</button>
      <button type="button" class="uai-c-role-add" id="uaiCompanionRoleAdd" title="新增角色">＋ 新增</button>`;
    toolbar.querySelector("#uaiCompanionRoleSwitch")?.addEventListener("click", openManager);
    toolbar.querySelector("#uaiCompanionRoleEdit")?.addEventListener("click", () => openEditor(getActiveId()));
    toolbar.querySelector("#uaiCompanionRoleAdd")?.addEventListener("click", openCreate);
  }

  function removeLegacyShellControls(root) {
    LEGACY_SHELL_CONTROLS.forEach((selector) => root.querySelector(selector)?.remove());
  }

  function simplifySidebar(root) {
    removeLegacyShellControls(root);
    const sideLabel = root.querySelector(".uai-c-sidebar > .uai-c-side-label");
    if (sideLabel) sideLabel.textContent = "聊天记录";
    const memory = root.querySelector("#uaiCompanionMemoryBtn span");
    if (memory) memory.textContent = "长期记忆";
    const settings = root.querySelector("#uaiCompanionSettingsBtn span");
    if (settings) settings.textContent = "设置";
    const exit = root.querySelector("#uaiCompanionExitBtn span");
    if (exit) exit.textContent = "返回模式大厅";
  }

  function simplifyCharacterManager() {
    const manager = document.getElementById("uaiCompanionV3Mask");
    if (!manager) return;
    const modal = manager.querySelector(".uai-c-v3-modal:not(.compact)");
    if (!modal) return;
    const title = modal.querySelector("header h3");
    const desc = modal.querySelector("header p");
    const footer = modal.querySelector(":scope > footer");
    const add = modal.querySelector("#uaiCompanionAddCharacter");
    if (title) title.textContent = "我的角色";
    if (desc) desc.textContent = "每个角色拥有独立的设定、聊天、长期记忆和模型设置。";
    if (add) add.textContent = "＋ 新增角色";
    if (footer && !footer.querySelector("#uaiV8RelationshipRecord") && window.UnlimitedCompanionProfileRestore?.showCharacterProfile) {
      const relationship = document.createElement("button");
      relationship.type = "button";
      relationship.id = "uaiV8RelationshipRecord";
      relationship.className = "secondary";
      relationship.textContent = "关系记录";
      relationship.addEventListener("click", openRelationshipRecord);
      footer.insertBefore(relationship, add || null);
    }
  }

  function simplifyHeader(root) {
    const input = root.querySelector("#uaiCompanionInput");
    const profile = window.UnlimitedCompanion?.getState?.()?.profile;
    if (input && profile?.name) input.placeholder = `和${profile.name}说点什么……`;
    const hint = root.querySelector(".uai-c-composer-hint");
    if (hint) hint.textContent = "Enter 发送 · Shift + Enter 换行";
  }

  function ensureLengthPills(modal) {
    const select = modal.querySelector("#uaiCompanionReplyLength");
    if (!select || select.dataset.v8Ready === "1") return;
    select.dataset.v8Ready = "1";
    select.classList.add("uai-c-v8-native-hidden");
    const pills = document.createElement("div");
    pills.className = "uai-c-v8-length-pills";
    const refresh = () => pills.querySelectorAll("button").forEach((button) => button.classList.toggle("selected", button.dataset.value === select.value));
    LENGTH_PRESETS.forEach(([value, label, hint]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.value = value;
      button.innerHTML = `<strong>${label}</strong><span>${hint}</span>`;
      button.addEventListener("click", () => {
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        refresh();
      });
      pills.appendChild(button);
    });
    select.insertAdjacentElement("afterend", pills);
    refresh();
  }

  function ensureDataPanel(modal) {
    if (modal.querySelector("#uaiV8DataPanel")) return;
    const clear = modal.querySelector("#uaiCompanionClearCurrent");
    const reset = modal.querySelector("#uaiCompanionReset");
    const oldExport = modal.querySelector("#uaiCompanionExport");
    const oldActions = oldExport?.closest(".uai-c-modal-actions") || clear?.closest(".uai-c-modal-actions");
    if (!oldActions) return;
    const details = document.createElement("details");
    details.id = "uaiV8DataPanel";
    details.className = "uai-c-v8-data-panel";
    details.innerHTML = `<summary><span>数据与备份</span><b>›</b></summary>`;
    const body = document.createElement("div");
    body.className = "uai-c-v8-data-body";
    const backup = document.createElement("div");
    backup.className = "uai-c-v8-data-row";
    const exportAll = document.createElement("button");
    exportAll.type = "button";
    exportAll.textContent = "导出全部角色";
    exportAll.addEventListener("click", () => window.UnlimitedCompanionGuard?.exportAllCharacters?.());
    const importAll = document.createElement("button");
    importAll.type = "button";
    importAll.textContent = "导入备份";
    importAll.addEventListener("click", () => window.UnlimitedCompanionProfileRestore?.chooseBackupFile?.());
    backup.append(exportAll, importAll);
    if (localStorage.getItem(KEYS.rollback)) {
      const rollback = document.createElement("button");
      rollback.type = "button";
      rollback.textContent = "撤销上次导入";
      rollback.addEventListener("click", () => window.UnlimitedCompanionProfileRestore?.restoreRollback?.());
      backup.appendChild(rollback);
    }
    body.appendChild(backup);
    if (clear || reset) {
      const dangerTitle = document.createElement("p");
      dangerTitle.className = "uai-c-v8-danger-title";
      dangerTitle.textContent = "危险操作";
      body.appendChild(dangerTitle);
      const danger = document.createElement("div");
      danger.className = "uai-c-v8-danger-row";
      if (clear) danger.appendChild(clear);
      if (reset) {
        reset.textContent = "重置全部陪伴数据";
        danger.appendChild(reset);
      }
      body.appendChild(danger);
    }
    details.appendChild(body);
    oldExport?.remove();
    oldActions.replaceWith(details);
  }

  function simplifySettingsModal() {
    const mask = document.getElementById("uaiCompanionModalMask");
    if (!mask || mask.hidden) return;
    const modal = mask.querySelector(".uai-c-modal");
    const model = modal?.querySelector("#uaiCompanionModel");
    const reply = modal?.querySelector("#uaiCompanionReplyLength");
    if (!modal || !model || !reply) return;
    const title = modal.querySelector(".uai-c-modal-head h3");
    const desc = modal.querySelector(".uai-c-modal-head p");
    if (title) title.textContent = "设置";
    if (desc) desc.textContent = "模型、回复长度和长期记忆。低频数据操作已经收进下方。";
    const stats = modal.querySelector(".uai-c-stat-grid");
    if (stats) stats.classList.add("uai-c-v8-hidden");
    ensureLengthPills(modal);
    ensureDataPanel(modal);
  }

  function enhanceOnboarding() {
    const mask = document.getElementById("uaiCompanionModalMask");
    const textarea = mask?.querySelector("#uaiOnboardDesc");
    if (!textarea) return;
    textarea.maxLength = PROFILE_LIMIT;
    textarea.rows = 10;
    textarea.placeholder = "年龄：\n身份：\n外貌：\n性格：\n背景经历：\n与用户的关系细节：\n说话方式：\n其他设定：";
    const field = textarea.closest(".uai-c-field");
    const label = field?.querySelector("label");
    if (label) label.textContent = "完整角色设定";
    if (field && !field.querySelector(".uai-c-v8-note")) {
      const note = document.createElement("small");
      note.className = "uai-c-v8-note";
      note.textContent = `年龄、身份、性格、经历和说话方式等都写在这里，最多 ${PROFILE_LIMIT} 字。`;
      field.appendChild(note);
    }
    mask.querySelector(".uai-c-chip-grid")?.closest(".uai-c-field")?.remove();
    const intro = mask.querySelector(".uai-c-onboard-top p");
    if (intro) intro.textContent = "填写名字、关系和完整角色设定，就可以直接开始聊天。";
  }

  function enhanceLongReplies(root) {
    root.querySelectorAll("#uaiCompanionMessages .uai-c-message-row.assistant").forEach((row) => {
      const bubble = row.querySelector(".uai-c-bubble");
      if (!bubble || bubble.querySelector(".uai-c-typing")) return;
      const text = bubble.textContent || "";
      if (text.length <= LONG_REPLY_THRESHOLD) {
        row.classList.remove("uai-c-long-reply", "expanded");
        row.querySelector(".uai-c-long-toggle")?.remove();
        return;
      }
      row.classList.add("uai-c-long-reply");
      if (row.querySelector(".uai-c-long-toggle")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "uai-c-long-toggle";
      button.textContent = "展开全文";
      button.addEventListener("click", () => {
        const expanded = row.classList.toggle("expanded");
        button.textContent = expanded ? "收起" : "展开全文";
      });
      bubble.insertAdjacentElement("afterend", button);
    });
  }

  function interceptRoleActions(event) {
    if (document.body.dataset.uaiMode !== "companion") return;
    if (event.target?.closest?.("#uaiCompanionAddCharacter")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openCreate();
      return;
    }
    if (event.target?.closest?.("#uaiOnboardCreate")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      createFirstFromOnboarding();
    }
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root) return;
    simplifySidebar(root);
    ensureRoleToolbar(root);
    simplifyHeader(root);
    simplifyCharacterManager();
    simplifySettingsModal();
    enhanceOnboarding();
    enhanceLongReplies(root);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionCharacterControlsRevision = REVISION;
    window.addEventListener("click", interceptRoleActions, true);
    window.addEventListener("keydown", (event) => { if (event.key === "Escape") closeRoleModal(); }, true);
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-uai-mode", "hidden"]
    });
    schedule();
  }

  window.UnlimitedCompanionCharacterControls = {
    revision: REVISION,
    refresh: schedule,
    openCreate,
    openEditor,
    openManager
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
