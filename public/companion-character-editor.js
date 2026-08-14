// Companion V9 character editor: create/edit roles and handle first-run creation only.
(() => {
  const REVISION = "2026-08-14-v9.3-character-editor-1";
  const MAX_CHARACTERS = 6;
  const PROFILE_LIMIT = 5000;
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
    const list = read(KEYS.characters, []);
    return Array.isArray(list) ? list.filter((item) => item?.id && item?.profile).slice(0, MAX_CHARACTERS) : [];
  }
  function saveCharacters(list) { write(KEYS.characters, list.slice(0, MAX_CHARACTERS)); }
  function getActiveId() { return localStorage.getItem(KEYS.activeCharacter) || ""; }
  function relationOptions(selected = "girlfriend") {
    return RELATIONS.map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${esc(label)}</option>`).join("");
  }
  function profileText(profile = {}) {
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
      messages: [{ role: "assistant", content: `我是${profile?.name || "你的 AI 伙伴"}。我们从这里开始吧。`, createdAt: now }]
    };
  }
  function isGenerating() { return Boolean(document.querySelector("#uaiCompanionInput:disabled")); }
  function guardGenerating() {
    if (!isGenerating()) return false;
    alert("当前回复还在生成。请先点击“停止”，再修改或新增角色。");
    return true;
  }

  function closeModal() { document.getElementById("uaiV9RoleEditorMask")?.remove(); }
  function openModal(html, bind) {
    closeModal();
    const mask = document.createElement("div");
    mask.id = "uaiV9RoleEditorMask";
    mask.className = "uai-c-v3-mask uai-c-v9-role-editor-mask";
    mask.innerHTML = html;
    document.body.appendChild(mask);
    mask.addEventListener("click", (event) => { if (event.target === mask) closeModal(); });
    mask.querySelectorAll("[data-v9-close]").forEach((button) => button.addEventListener("click", closeModal));
    bind?.(mask);
  }

  function remount() {
    window.UnlimitedCompanion?.unmount?.();
    window.setTimeout(() => {
      window.UnlimitedCompanion?.mount?.();
      window.UnlimitedCompanionMulti?.refresh?.();
      window.UnlimitedCompanionExtras?.refresh?.();
      window.UnlimitedCompanionV9Shell?.refresh?.();
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
    saveCharacters(list);
    if (!id || id === getActiveId()) write(KEYS.profile, profile);
    closeModal();
    if (!id || id === getActiveId()) remount();
    else window.UnlimitedCompanionMulti?.showCharacterManager?.();
  }

  function bindAvatar(mask, selector, initial, setter) {
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
    if (guardGenerating()) return;
    window.UnlimitedCompanionMulti?.persist?.();
    const target = findRole(id);
    if (!target?.profile) return;
    const profile = target.profile;
    let avatar = profile.avatarData || "";
    openModal(`
      <section class="uai-c-v3-modal compact uai-c-v9-role-editor" role="dialog" aria-modal="true" aria-label="编辑角色">
        <header><div><span>CHARACTER</span><h3>编辑角色</h3><p>名字和关系单独填写，其余资料直接整段粘贴到一个框里。</p></div><button type="button" data-v9-close>×</button></header>
        <div class="uai-c-v3-form">
          <label>名字<input id="uaiV9RoleName" value="${esc(profile.name || "")}" maxlength="40" /></label>
          <label>关系<select id="uaiV9RoleRelation">${relationOptions(profile.relationship || "girlfriend")}</select></label>
          <label class="uai-c-v9-background">完整角色设定<textarea id="uaiV9RoleBackground" maxlength="${PROFILE_LIMIT}" placeholder="年龄：\n身份：\n外貌：\n性格：\n背景经历：\n与用户的关系细节：\n说话方式：\n其他设定：">${esc(profileText(profile))}</textarea><small>可直接粘贴完整人物卡，最多 ${PROFILE_LIMIT} 字。</small></label>
          <label>头像（可选）<input id="uaiV9RoleAvatar" type="file" accept="image/png,image/jpeg,image/webp" /><small>头像只保存在当前浏览器，建议小于 700 KB。</small></label>
        </div>
        <footer><button type="button" class="secondary" data-v9-close>取消</button><button type="button" id="uaiV9SaveRole">保存角色</button></footer>
      </section>`, (mask) => {
        bindAvatar(mask, "#uaiV9RoleAvatar", avatar, (value) => { avatar = value; });
        mask.querySelector("#uaiV9SaveRole")?.addEventListener("click", () => {
          const next = normalizeProfile(profile, {
            name: mask.querySelector("#uaiV9RoleName")?.value,
            relationship: mask.querySelector("#uaiV9RoleRelation")?.value,
            background: mask.querySelector("#uaiV9RoleBackground")?.value,
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
    closeModal();
    document.getElementById("uaiCompanionV3Mask")?.remove();
    remount();
  }

  function openCreate() {
    if (guardGenerating()) return;
    window.UnlimitedCompanionMulti?.persist?.();
    const list = getCharacters();
    if (list.length >= MAX_CHARACTERS) {
      alert(`最多只能创建 ${MAX_CHARACTERS} 个角色。`);
      return;
    }
    let avatar = "";
    openModal(`
      <section class="uai-c-v3-modal compact uai-c-v9-role-editor" role="dialog" aria-modal="true" aria-label="新增角色">
        <header><div><span>NEW CHARACTER</span><h3>新增角色</h3><p>创建后自动切换；聊天、记忆和设置与其他角色互相独立。</p></div><button type="button" data-v9-close>×</button></header>
        <div class="uai-c-v3-form">
          <label>名字<input id="uaiV9NewRoleName" value="新伙伴" maxlength="40" /></label>
          <label>关系<select id="uaiV9NewRoleRelation">${relationOptions("girlfriend")}</select></label>
          <label class="uai-c-v9-background">完整角色设定<textarea id="uaiV9NewRoleBackground" maxlength="${PROFILE_LIMIT}" placeholder="年龄：\n身份：\n外貌：\n性格：\n背景经历：\n与用户的关系细节：\n说话方式：\n其他设定："></textarea><small>可直接粘贴完整人物卡，最多 ${PROFILE_LIMIT} 字。</small></label>
          <label>头像（可选）<input id="uaiV9NewRoleAvatar" type="file" accept="image/png,image/jpeg,image/webp" /></label>
        </div>
        <footer><button type="button" class="secondary" data-v9-close>取消</button><button type="button" id="uaiV9CreateRole">创建并切换</button></footer>
      </section>`, (mask) => {
        bindAvatar(mask, "#uaiV9NewRoleAvatar", avatar, (value) => { avatar = value; });
        mask.querySelector("#uaiV9CreateRole")?.addEventListener("click", () => {
          const now = Date.now();
          const profile = normalizeProfile({}, {
            name: mask.querySelector("#uaiV9NewRoleName")?.value,
            relationship: mask.querySelector("#uaiV9NewRoleRelation")?.value,
            background: mask.querySelector("#uaiV9NewRoleBackground")?.value,
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
          activateNewRole(item, [...getCharacters(), item]);
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

  function capture(event) {
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

  function init() {
    document.documentElement.dataset.companionCharacterControlsRevision = REVISION;
    window.addEventListener("click", capture, true);
    window.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); }, true);
  }

  window.UnlimitedCompanionCharacterControls = {
    revision: REVISION,
    refresh: () => {},
    openCreate,
    openEditor,
    openManager
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
