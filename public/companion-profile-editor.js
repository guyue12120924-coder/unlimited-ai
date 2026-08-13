// public/companion-profile-editor.js
(() => {
  const REVISION = "2026-08-13-v7.0-profile-editor-1";
  const MAX_CHARACTERS = 6;
  const PROFILE_LIMIT = 900;
  const PROFILE_MARKER = ["以完整角色设定为准"];
  const KEYS = {
    characters: "uai_companion_characters_v1",
    activeCharacter: "uai_companion_active_character_v1",
    profile: "uai_companion_profile_v1",
    sessions: "uai_companion_sessions_v1",
    memories: "uai_companion_memories_v1",
    settings: "uai_companion_settings_v1"
  };
  const RELATIONS = [
    ["girlfriend", "💗 女朋友"],
    ["boyfriend", "💙 男朋友"],
    ["friend", "🌙 好朋友"],
    ["confidant", "✨ 知心伙伴"],
    ["custom", "🪄 自定义关系"]
  ];
  let queued = false;

  function parse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }
  function read(key, fallback) { return parse(localStorage.getItem(key), fallback); }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function makeId(prefix) {
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${token}`;
  }
  function clean(value, max = PROFILE_LIMIT) {
    return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, max);
  }
  function esc(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function characters() {
    const list = read(KEYS.characters, []);
    return Array.isArray(list) ? list.filter((item) => item?.id && item?.profile) : [];
  }
  function activeId() { return localStorage.getItem(KEYS.activeCharacter) || ""; }
  function relationOptions(selected = "girlfriend") {
    return RELATIONS.map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${esc(label)}</option>`).join("");
  }
  function oldProfileText(profile = {}) {
    if (profile.customDescription?.trim()) return profile.customDescription.trim();
    const lines = [];
    const p = Array.isArray(profile.personality) ? profile.personality.filter((x) => x && x !== PROFILE_MARKER[0]) : [];
    const s = Array.isArray(profile.speakingStyle) ? profile.speakingStyle.filter((x) => x && x !== PROFILE_MARKER[0]) : [];
    if (p.length) lines.push(`性格：${p.join("、")}`);
    if (s.length) lines.push(`说话方式：${s.join("；")}`);
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
      id: makeId("companion-session"), title: "新的聊天", createdAt: now, updatedAt: now,
      v3GreetingEnhanced: true,
      messages: [{ role: "assistant", content: `我是${profile?.name || "你的 AI 伙伴"}。我们从这里开始吧。`, createdAt: now }]
    };
  }
  function closeModal() { document.getElementById("uaiCompanionProfileEditorMask")?.remove(); }
  function openModal(html, bind) {
    closeModal();
    const mask = document.createElement("div");
    mask.id = "uaiCompanionProfileEditorMask";
    mask.className = "uai-c-v3-mask uai-c-v7-mask";
    mask.innerHTML = html;
    document.body.appendChild(mask);
    mask.addEventListener("click", (event) => { if (event.target === mask) closeModal(); });
    bind?.(mask);
  }
  function remount() {
    window.UnlimitedCompanion?.unmount?.();
    window.setTimeout(() => {
      window.UnlimitedCompanion?.mount?.();
      window.UnlimitedCompanionPolish?.refresh?.();
      window.UnlimitedCompanionMulti?.refresh?.();
      schedule();
    }, 30);
  }
  function findTarget(id) {
    if (!id || id === activeId()) {
      const profile = read(KEYS.profile, null);
      if (profile) return { id: activeId(), profile };
    }
    const item = characters().find((entry) => entry.id === id);
    return item ? { id: item.id, profile: item.profile } : null;
  }
  function saveProfile(id, profile) {
    const list = characters();
    const index = list.findIndex((item) => item.id === id);
    if (index >= 0) {
      list[index] = { ...list[index], profile, updatedAt: Date.now() };
      write(KEYS.characters, list.slice(0, MAX_CHARACTERS));
    }
    if (!id || id === activeId()) {
      write(KEYS.profile, profile);
      window.UnlimitedCompanionMulti?.persist?.();
      remount();
    } else {
      window.UnlimitedCompanionMulti?.showCharacterManager?.();
      schedule();
    }
  }
  function avatarBinding(mask, inputId, initial, setter) {
    let current = initial || "";
    setter(current);
    mask.querySelector(inputId)?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 700000) { window.alert("头像太大了，请选择 700 KB 以下的图片。"); event.target.value = ""; return; }
      const reader = new FileReader();
      reader.onload = () => { if (typeof reader.result === "string") { current = reader.result; setter(current); } };
      reader.readAsDataURL(file);
    });
  }
  function openEditor(id = activeId()) {
    window.UnlimitedCompanionMulti?.persist?.();
    const target = findTarget(id);
    if (!target?.profile) return;
    const profile = target.profile;
    let avatar = profile.avatarData || "";
    openModal(`
      <section class="uai-c-v3-modal compact uai-c-v7-editor" role="dialog" aria-modal="true" aria-label="角色设置">
        <header><div><span>CHARACTER PROFILE</span><h3>角色设置</h3><p>年龄、身份、性格、外貌、经历、说话习惯等都写在同一个框里。</p></div><button type="button" data-v7-close>×</button></header>
        <div class="uai-c-v3-form">
          <label>名字<input id="uaiV7Name" value="${esc(profile.name || "")}" maxlength="40" /></label>
          <label>关系<select id="uaiV7Relation">${relationOptions(profile.relationship || "girlfriend")}</select></label>
          <label class="uai-c-v7-background">完整角色设定<textarea id="uaiV7Background" maxlength="${PROFILE_LIMIT}" placeholder="年龄：\n身份：\n外貌：\n性格：\n背景经历：\n与用户的关系细节：\n说话方式：\n其他设定：">${esc(oldProfileText(profile))}</textarea><small>这里只有角色资料；全局规则不会被这个页面修改。最多 ${PROFILE_LIMIT} 字。</small></label>
          <label>头像（可选）<input id="uaiV7Avatar" type="file" accept="image/png,image/jpeg,image/webp" /><small>头像仅保存在当前浏览器，建议小于 700 KB。</small></label>
        </div>
        <footer><button type="button" class="secondary" data-v7-close>取消</button><button type="button" id="uaiV7Save">保存角色</button></footer>
      </section>`, (mask) => {
        mask.querySelectorAll("[data-v7-close]").forEach((button) => button.addEventListener("click", closeModal));
        avatarBinding(mask, "#uaiV7Avatar", avatar, (value) => { avatar = value; });
        mask.querySelector("#uaiV7Save")?.addEventListener("click", () => {
          const next = normalizeProfile(profile, {
            name: mask.querySelector("#uaiV7Name")?.value,
            relationship: mask.querySelector("#uaiV7Relation")?.value,
            background: mask.querySelector("#uaiV7Background")?.value,
            avatarData: avatar
          });
          closeModal();
          saveProfile(target.id, next);
        });
      });
  }
  function activate(item, list) {
    write(KEYS.characters, list.slice(0, MAX_CHARACTERS));
    localStorage.setItem(KEYS.activeCharacter, item.id);
    write(KEYS.profile, item.profile);
    write(KEYS.sessions, item.sessions);
    write(KEYS.memories, item.memories);
    write(KEYS.settings, item.settings);
    closeModal();
    document.getElementById("uaiCompanionV3Mask")?.remove();
    remount();
  }
  function openCreate() {
    window.UnlimitedCompanionMulti?.persist?.();
    if (characters().length >= MAX_CHARACTERS) { window.alert(`最多只能创建 ${MAX_CHARACTERS} 个角色。`); return; }
    let avatar = "";
    openModal(`
      <section class="uai-c-v3-modal compact uai-c-v7-editor" role="dialog" aria-modal="true" aria-label="新建角色">
        <header><div><span>NEW COMPANION</span><h3>创建新的 AI 伙伴</h3><p>名字和关系单独填写，其余内容全部放进一个大框。</p></div><button type="button" data-v7-close>×</button></header>
        <div class="uai-c-v3-form">
          <label>名字<input id="uaiV7NewName" value="新伙伴" maxlength="40" /></label>
          <label>关系<select id="uaiV7NewRelation">${relationOptions("girlfriend")}</select></label>
          <label class="uai-c-v7-background">完整角色设定<textarea id="uaiV7NewBackground" maxlength="${PROFILE_LIMIT}" placeholder="可以直接整段复制粘贴：\n年龄：\n身份：\n外貌：\n性格：\n背景经历：\n与用户的关系细节：\n说话方式：\n其他设定："></textarea><small>这里只有当前角色的资料，最多 ${PROFILE_LIMIT} 字。</small></label>
          <label>头像（可选）<input id="uaiV7NewAvatar" type="file" accept="image/png,image/jpeg,image/webp" /></label>
        </div>
        <footer><button type="button" class="secondary" data-v7-close>取消</button><button type="button" id="uaiV7Create">创建并切换</button></footer>
      </section>`, (mask) => {
        mask.querySelectorAll("[data-v7-close]").forEach((button) => button.addEventListener("click", closeModal));
        avatarBinding(mask, "#uaiV7NewAvatar", avatar, (value) => { avatar = value; });
        mask.querySelector("#uaiV7Create")?.addEventListener("click", () => {
          const now = Date.now();
          const profile = normalizeProfile({}, {
            name: mask.querySelector("#uaiV7NewName")?.value,
            relationship: mask.querySelector("#uaiV7NewRelation")?.value,
            background: mask.querySelector("#uaiV7NewBackground")?.value,
            avatarData: avatar
          });
          profile.createdAt = now;
          const item = { id: makeId("companion-character"), profile, sessions: [initialSession(profile)], memories: [], settings: read(KEYS.settings, {}) || {}, createdAt: now, updatedAt: now };
          const list = characters();
          list.push(item);
          activate(item, list);
        });
      });
  }
  function transformOnboarding() {
    const mask = document.getElementById("uaiCompanionModalMask");
    const textarea = mask?.querySelector("#uaiOnboardDesc");
    if (!textarea || textarea.dataset.v7Ready === "1") return;
    textarea.dataset.v7Ready = "1";
    textarea.maxLength = PROFILE_LIMIT;
    textarea.rows = 10;
    textarea.placeholder = "年龄：\n身份：\n外貌：\n性格：\n背景经历：\n与用户的关系细节：\n说话方式：\n其他设定：";
    const field = textarea.closest(".uai-c-field");
    const label = field?.querySelector("label");
    if (label) label.textContent = "完整角色设定";
    const note = document.createElement("small");
    note.className = "uai-c-v7-note";
    note.textContent = `年龄、性格等全部写这里即可，最多 ${PROFILE_LIMIT} 字。`;
    field?.appendChild(note);
    mask.querySelector(".uai-c-chip-grid")?.closest(".uai-c-field")?.remove();
    const intro = mask.querySelector(".uai-c-onboard-top p");
    if (intro) intro.textContent = "名字、关系，再加一个完整角色设定框就可以开始。";
  }
  function createFirst() {
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
    const id = activeId() || makeId("companion-character");
    const session = initialSession(profile);
    const item = { id, profile, sessions: [session], memories: [], settings: read(KEYS.settings, {}) || {}, createdAt: now, updatedAt: now };
    write(KEYS.profile, profile);
    write(KEYS.sessions, [session]);
    write(KEYS.memories, []);
    localStorage.setItem(KEYS.activeCharacter, id);
    const list = characters().filter((entry) => entry.id !== id);
    list.unshift(item);
    write(KEYS.characters, list.slice(0, MAX_CHARACTERS));
    mask.hidden = true;
    mask.innerHTML = "";
    remount();
  }
  function enhanceManager() {
    const manager = document.getElementById("uaiCompanionV3Mask");
    if (!manager) return;
    manager.querySelectorAll(".uai-c-v3-character-card[data-character-id]").forEach((card) => {
      const actions = card.querySelector(".uai-c-v3-character-actions");
      if (!actions || actions.querySelector("[data-v7-edit-character]")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.v7EditCharacter = "1";
      button.textContent = "编辑";
      const del = actions.querySelector("[data-delete-character]");
      if (del) actions.insertBefore(button, del); else actions.appendChild(button);
    });
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; transformOnboarding(); enhanceManager(); });
  }
  function capture(event) {
    if (event.target?.closest?.("#uaiCompanionCharacterBtn, #uaiCompanionEditProfileInline")) {
      event.preventDefault(); event.stopImmediatePropagation(); openEditor(activeId()); return;
    }
    if (event.target?.closest?.("#uaiCompanionAddCharacter")) {
      event.preventDefault(); event.stopImmediatePropagation(); openCreate(); return;
    }
    const edit = event.target?.closest?.("[data-v7-edit-character]");
    if (edit) {
      event.preventDefault(); event.stopImmediatePropagation();
      const id = edit.closest("[data-character-id]")?.dataset.characterId;
      if (id) openEditor(id);
      return;
    }
    if (event.target?.closest?.("#uaiOnboardCreate")) {
      event.preventDefault(); event.stopImmediatePropagation(); createFirst();
    }
  }
  function init() {
    document.documentElement.dataset.companionProfileEditorRevision = REVISION;
    document.addEventListener("click", capture, true);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });
    new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true });
    schedule();
  }
  window.UnlimitedCompanionProfileEditor = { revision: REVISION, openEditor, openCreate, refresh: schedule };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
