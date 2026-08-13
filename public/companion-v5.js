// public/companion-v5.js
// Companion V5: relationship profile, timeline, memory album, backup restore and templates.
(() => {
  const REVISION = "2026-08-13-v5.0-companion-relationship-1";
  const KEYS = {
    characters: "uai_companion_characters_v1",
    activeCharacter: "uai_companion_active_character_v1",
    profile: "uai_companion_profile_v1",
    sessions: "uai_companion_sessions_v1",
    memories: "uai_companion_memories_v1",
    settings: "uai_companion_settings_v1",
    moments: "uai_companion_moments_v1",
    archive: "uai_companion_memory_archive_v1"
  };
  const MAX_CHARACTERS = 6;
  const TEMPLATES = [
    { id: "gentle", icon: "🌷", name: "温柔陪伴", relation: "girlfriend", personality: ["温柔", "细腻", "成熟"], desc: "语气柔和但不过度黏人，会认真听你说日常，也能在你需要时给出靠谱建议。" },
    { id: "cheeky", icon: "🍓", name: "傲娇甜系", relation: "girlfriend", personality: ["傲娇", "可爱", "幽默"], desc: "会轻轻吐槽和开玩笑，熟悉后更活泼，但重要事情上会认真回应。" },
    { id: "calm", icon: "🌙", name: "安静知己", relation: "confidant", personality: ["安静", "理性", "温柔"], desc: "不抢话、不频繁追问，更擅长稳定地接住情绪和复杂话题。" },
    { id: "bright", icon: "☀️", name: "元气伙伴", relation: "friend", personality: ["活泼", "幽默", "可爱"], desc: "聊天节奏轻快，适合分享琐事、脑洞和日常吐槽，不会把普通聊天变成说教。" }
  ];
  let scheduled = false;

  function safeParse(value, fallback) { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } }
  function readJson(key, fallback) { return safeParse(localStorage.getItem(key), fallback); }
  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function clean(value, max = 220) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function makeId(prefix) {
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${token}`;
  }
  function activeId() { return localStorage.getItem(KEYS.activeCharacter) || "legacy"; }
  function getState() { return window.UnlimitedCompanion?.getState?.() || null; }
  function getCharacters() {
    const list = readJson(KEYS.characters, []);
    return Array.isArray(list) ? list.filter((item) => item?.id && item?.profile) : [];
  }
  function activeCharacter() {
    const id = activeId();
    return getCharacters().find((item) => item.id === id) || null;
  }
  function momentsFor(id = activeId()) {
    const map = readJson(KEYS.moments, {});
    return Array.isArray(map?.[id]) ? map[id] : [];
  }
  function archivesFor(id = activeId()) {
    const map = readJson(KEYS.archive, {});
    return Array.isArray(map?.[id]) ? map[id] : [];
  }
  function formatDate(ts, long = false) {
    const date = new Date(Number(ts) || Date.now());
    return long
      ? date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
      : `${date.getMonth() + 1}/${date.getDate()}`;
  }
  function relationLabel(value) {
    return ({ girlfriend: "女朋友", boyfriend: "男朋友", friend: "好朋友", confidant: "知心伙伴", custom: "陪伴伙伴" })[value] || "陪伴伙伴";
  }
  function avatar(profile, cls = "") {
    if (profile?.avatarData) return `<div class="uai-c-v5-avatar ${cls}"><img src="${escapeHtml(profile.avatarData)}" alt="${escapeHtml(profile.name || "角色")}头像"></div>`;
    const icon = profile?.relationship === "boyfriend" ? "💙" : profile?.relationship === "friend" ? "🌙" : profile?.relationship === "confidant" ? "✨" : "💗";
    return `<div class="uai-c-v5-avatar ${cls}">${icon}</div>`;
  }
  function stats(character = activeCharacter()) {
    const sessions = Array.isArray(character?.sessions) ? character.sessions : [];
    const messages = sessions.reduce((sum, s) => sum + (Array.isArray(s?.messages) ? s.messages.length : 0), 0);
    const createdAt = Number(character?.createdAt || character?.profile?.createdAt) || Date.now();
    return {
      sessions: sessions.length,
      messages,
      memories: Array.isArray(character?.memories) ? character.memories.length : 0,
      moments: momentsFor(character?.id).length,
      days: Math.max(1, Math.floor((Date.now() - createdAt) / 86400000) + 1)
    };
  }

  function closeModal() { document.getElementById("uaiCompanionV5Mask")?.remove(); }
  function openModal(html, bind) {
    closeModal();
    const mask = document.createElement("div");
    mask.id = "uaiCompanionV5Mask";
    mask.className = "uai-c-v5-mask";
    mask.innerHTML = html;
    document.body.appendChild(mask);
    mask.addEventListener("click", (event) => { if (event.target === mask) closeModal(); });
    mask.querySelector("[data-v5-close]")?.addEventListener("click", closeModal);
    bind?.(mask);
  }

  function buildTimeline(character) {
    if (!character) return [];
    const entries = [];
    const createdAt = Number(character.createdAt || character.profile?.createdAt) || Date.now();
    entries.push({ at: createdAt, icon: "✨", title: "第一次认识", text: `从这一天开始认识 ${character.profile?.name || "这个伙伴"}。`, type: "start" });
    const sessions = Array.isArray(character.sessions) ? character.sessions : [];
    sessions.forEach((session) => {
      const messages = Array.isArray(session?.messages) ? session.messages : [];
      const firstUser = messages.find((m) => m?.role === "user" && clean(m?.content, 120));
      if (!firstUser) return;
      entries.push({
        at: Number(firstUser.createdAt || session.createdAt || session.updatedAt) || Date.now(),
        icon: "💬",
        title: session.title && session.title !== "新的聊天" ? session.title : "一次聊天",
        text: clean(firstUser.content, 90),
        type: "chat"
      });
    });
    momentsFor(character.id).forEach((moment) => entries.push({
      at: Number(moment.createdAt || moment.savedAt) || Date.now(),
      icon: "💖",
      title: moment.note ? clean(moment.note, 42) : "重要时刻",
      text: clean(moment.text || moment.content, 100),
      type: "moment"
    }));
    return entries.sort((a, b) => b.at - a.at).slice(0, 80);
  }

  function showProfile() {
    window.UnlimitedCompanionMulti?.persist?.();
    const character = activeCharacter();
    if (!character) return;
    const s = stats(character);
    const timeline = buildTimeline(character);
    openModal(`
      <section class="uai-c-v5-modal profile" role="dialog" aria-modal="true" aria-label="关系主页">
        <button class="uai-c-v5-x" type="button" data-v5-close>×</button>
        <div class="uai-c-v5-hero">
          ${avatar(character.profile, "large")}
          <div class="uai-c-v5-hero-copy"><span>RELATIONSHIP PROFILE</span><h2>${escapeHtml(character.profile?.name || "AI 伙伴")}</h2><p>${escapeHtml(relationLabel(character.profile?.relationship))} · 已认识 ${s.days} 天</p></div>
        </div>
        <div class="uai-c-v5-stat-grid">
          <div><strong>${s.sessions}</strong><span>聊天</span></div><div><strong>${s.messages}</strong><span>消息</span></div><div><strong>${s.memories}</strong><span>记忆</span></div><div><strong>${s.moments}</strong><span>珍藏</span></div>
        </div>
        <div class="uai-c-v5-profile-grid">
          <section><span>性格</span><div class="uai-c-v5-tags">${(character.profile?.personality || []).map((p) => `<b>${escapeHtml(p)}</b>`).join("") || "<em>还没有性格标签</em>"}</div></section>
          <section><span>角色设定</span><p>${escapeHtml(character.profile?.customDescription || "这个角色还没有补充设定，可以在角色设置里继续完善。")}</p></section>
        </div>
        <div class="uai-c-v5-section-head"><div><span>TIMELINE</span><h3>关系时间线</h3></div><button type="button" data-open-album>打开纪念册</button></div>
        <div class="uai-c-v5-timeline">${timeline.length ? timeline.slice(0, 18).map((item) => `<article class="${item.type}"><i>${item.icon}</i><div><time>${formatDate(item.at, true)}</time><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></div></article>`).join("") : `<div class="uai-c-v5-empty">再聊一会儿，这里会慢慢长出你们的时间线。</div>`}</div>
      </section>`, (mask) => mask.querySelector("[data-open-album]")?.addEventListener("click", showAlbum));
  }

  function showAlbum() {
    const character = activeCharacter();
    if (!character) return;
    const moments = [...momentsFor(character.id)].sort((a, b) => Number(b.createdAt || b.savedAt || 0) - Number(a.createdAt || a.savedAt || 0));
    openModal(`
      <section class="uai-c-v5-modal album" role="dialog" aria-modal="true" aria-label="重要时刻纪念册">
        <header><div><span>MEMORY ALBUM</span><h2>${escapeHtml(character.profile?.name || "伙伴")} · 重要时刻</h2><p>这里收纳你主动珍藏的聊天片段，不会因为整理长期记忆而消失。</p></div><button type="button" data-v5-close>×</button></header>
        <div class="uai-c-v5-album-grid">${moments.length ? moments.map((m, index) => `<article><div class="uai-c-v5-album-no">${String(index + 1).padStart(2, "0")}</div><time>${formatDate(m.createdAt || m.savedAt, true)}</time><blockquote>${escapeHtml(clean(m.text || m.content, 420))}</blockquote>${m.note ? `<p>${escapeHtml(clean(m.note, 140))}</p>` : ""}</article>`).join("") : `<div class="uai-c-v5-empty wide">还没有重要时刻。聊天时点消息旁边的“珍藏”，这里就会慢慢变成你们的纪念册。</div>`}</div>
      </section>`);
  }

  function showTemplates() {
    const characters = getCharacters();
    openModal(`
      <section class="uai-c-v5-modal templates" role="dialog" aria-modal="true" aria-label="角色模板库">
        <header><div><span>CHARACTER TEMPLATES</span><h2>角色模板库</h2><p>模板只是起点，创建后仍可以改名字、关系、性格和描述。</p></div><button type="button" data-v5-close>×</button></header>
        <div class="uai-c-v5-template-grid">${TEMPLATES.map((t) => `<article data-template="${t.id}"><i>${t.icon}</i><strong>${t.name}</strong><span>${relationLabel(t.relation)}</span><div>${t.personality.map((p) => `<b>${p}</b>`).join("")}</div><p>${t.desc}</p><button type="button" ${characters.length >= MAX_CHARACTERS ? "disabled" : ""}>用这个模板创建</button></article>`).join("")}</div>
      </section>`, (mask) => {
        mask.querySelectorAll("[data-template] button").forEach((button) => button.addEventListener("click", () => createFromTemplate(button.closest("[data-template]")?.dataset.template)));
      });
  }

  function createFromTemplate(templateId) {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    window.UnlimitedCompanionMulti?.persist?.();
    const characters = getCharacters();
    if (characters.length >= MAX_CHARACTERS) return alert(`最多只能创建 ${MAX_CHARACTERS} 个 AI 伙伴。`);
    const name = clean(prompt("给这个伙伴取个名字：", template.name === "温柔陪伴" ? "小栀" : template.name === "傲娇甜系" ? "小桃" : template.name === "安静知己" ? "知夏" : "小晴"), 40);
    if (!name) return;
    const now = Date.now();
    const profile = {
      name,
      relationship: template.relation,
      personality: [...template.personality],
      speakingStyle: ["像即时聊天而不是客服", "默认简短自然", "不要每句话都反问", "自然延续共同话题"],
      customDescription: template.desc,
      userNickname: "",
      avatarData: "",
      createdAt: now
    };
    const greeting = { role: "assistant", content: `嗨，我是${name}。不用准备什么开场，想到什么就和我说什么吧。`, createdAt: now };
    const character = {
      id: makeId("companion-character"), profile,
      sessions: [{ id: makeId("companion-session"), title: "新的聊天", createdAt: now, updatedAt: now, messages: [greeting] }],
      memories: [], settings: readJson(KEYS.settings, {}), createdAt: now, updatedAt: now
    };
    characters.push(character);
    writeJson(KEYS.characters, characters);
    closeModal();
    window.UnlimitedCompanionMulti?.switchCharacter?.(character.id);
  }

  function validateCharacter(raw) {
    if (!raw || typeof raw !== "object" || !raw.id || !raw.profile || typeof raw.profile !== "object") return null;
    const profile = raw.profile;
    const safeProfile = {
      name: clean(profile.name, 40) || "恢复的伙伴",
      relationship: clean(profile.relationship, 30) || "friend",
      personality: Array.isArray(profile.personality) ? profile.personality.map((v) => clean(v, 40)).filter(Boolean).slice(0, 10) : ["温柔"],
      speakingStyle: Array.isArray(profile.speakingStyle) ? profile.speakingStyle.map((v) => clean(v, 70)).filter(Boolean).slice(0, 8) : [],
      customDescription: clean(profile.customDescription || profile.description, 900),
      userNickname: clean(profile.userNickname, 40),
      avatarData: typeof profile.avatarData === "string" && profile.avatarData.startsWith("data:image/") && profile.avatarData.length < 2500000 ? profile.avatarData : "",
      createdAt: Number(profile.createdAt) || Date.now()
    };
    const sessions = Array.isArray(raw.sessions) ? raw.sessions.slice(-300).map((session) => ({
      id: clean(session?.id, 100) || makeId("companion-session"),
      title: clean(session?.title, 80) || "恢复的聊天",
      createdAt: Number(session?.createdAt) || Date.now(), updatedAt: Number(session?.updatedAt) || Date.now(),
      messages: Array.isArray(session?.messages) ? session.messages.slice(-500).map((m) => ({ role: m?.role === "assistant" ? "assistant" : "user", content: clean(m?.content, 12000), createdAt: Number(m?.createdAt) || Date.now() })).filter((m) => m.content) : []
    })) : [];
    const memories = Array.isArray(raw.memories) ? raw.memories.slice(-100).map((m) => ({ ...m, id: clean(m?.id, 100) || makeId("memory"), text: clean(m?.text, 180) })).filter((m) => m.text) : [];
    return { id: clean(raw.id, 120) || makeId("companion-character"), profile: safeProfile, sessions, memories, settings: raw.settings && typeof raw.settings === "object" ? raw.settings : {}, createdAt: Number(raw.createdAt) || safeProfile.createdAt, updatedAt: Date.now() };
  }

  async function importBackup(file) {
    if (!file) return;
    if (document.querySelector("#uaiCompanionInput:disabled")) return alert("当前回复还在生成，请先停止生成再恢复备份。");
    let payload;
    try { payload = JSON.parse(await file.text()); } catch { return alert("这个文件不是有效的 JSON 备份。" ); }
    if (payload?.format !== "unlimited-ai-companion-multichar-backup" || !Array.isArray(payload.characters)) return alert("这不是 Unlimited AI 的多角色陪伴备份。" );
    const restored = payload.characters.map(validateCharacter).filter(Boolean).slice(0, MAX_CHARACTERS);
    if (!restored.length) return alert("备份中没有可恢复的角色数据。" );
    const totalMessages = restored.reduce((sum, c) => sum + c.sessions.reduce((s, session) => s + session.messages.length, 0), 0);
    if (!confirm(`将恢复 ${restored.length} 个 AI 伙伴、约 ${totalMessages} 条消息。\n\n这会替换当前全部陪伴角色数据；小说数据不会受到影响。继续吗？`)) return;
    writeJson(KEYS.characters, restored);
    const ids = new Set(restored.map((c) => c.id));
    const preferred = ids.has(payload.activeCharacterId) ? payload.activeCharacterId : restored[0].id;
    localStorage.setItem(KEYS.activeCharacter, preferred);
    const moments = payload.importantMomentsByCharacter && typeof payload.importantMomentsByCharacter === "object" ? payload.importantMomentsByCharacter : {};
    const archive = payload.memoryArchiveByCharacter && typeof payload.memoryArchiveByCharacter === "object" ? payload.memoryArchiveByCharacter : {};
    const safeMoments = {}; const safeArchive = {};
    for (const id of ids) {
      if (Array.isArray(moments[id])) safeMoments[id] = moments[id].slice(-120);
      if (Array.isArray(archive[id])) safeArchive[id] = archive[id].slice(-150);
    }
    writeJson(KEYS.moments, safeMoments); writeJson(KEYS.archive, safeArchive);
    const active = restored.find((c) => c.id === preferred) || restored[0];
    writeJson(KEYS.profile, active.profile); writeJson(KEYS.sessions, active.sessions); writeJson(KEYS.memories, active.memories); writeJson(KEYS.settings, active.settings || {});
    alert("陪伴备份已经恢复完成。页面会刷新以重新加载角色数据。" );
    location.reload();
  }

  function showRestore() {
    openModal(`
      <section class="uai-c-v5-modal restore" role="dialog" aria-modal="true" aria-label="恢复陪伴备份">
        <header><div><span>RESTORE</span><h2>恢复全部陪伴数据</h2><p>支持 V3/V4 导出的多角色 JSON。恢复前会先校验，不会触碰小说数据。</p></div><button type="button" data-v5-close>×</button></header>
        <label class="uai-c-v5-drop"><input id="uaiV5RestoreFile" type="file" accept="application/json,.json"><i>↥</i><strong>选择 JSON 备份文件</strong><span>将替换当前陪伴角色、聊天、记忆、重要时刻和归档数据</span></label>
        <div class="uai-c-v5-warning"><strong>建议先导出当前全部角色</strong><p>恢复是覆盖操作。你可以先到“角色管理 → 导出全部角色”保存当前版本。</p></div>
      </section>`, (mask) => mask.querySelector("#uaiV5RestoreFile")?.addEventListener("change", (event) => importBackup(event.target.files?.[0])));
  }

  function ensureDashboard(root) {
    const profileCard = root.querySelector("#uaiCompanionProfileCard");
    if (!profileCard || root.querySelector("#uaiCompanionV5Dashboard")) return;
    const character = activeCharacter();
    if (!character) return;
    const s = stats(character);
    const panel = document.createElement("section");
    panel.id = "uaiCompanionV5Dashboard";
    panel.className = "uai-c-v5-dashboard";
    panel.innerHTML = `<div class="uai-c-v5-dashboard-title"><span>RELATIONSHIP</span><strong>和 ${escapeHtml(character.profile?.name || "伙伴")} 的故事</strong><small>${s.days} 天 · ${s.moments} 个重要时刻</small></div><div class="uai-c-v5-dashboard-actions"><button type="button" data-v5-profile>关系主页</button><button type="button" data-v5-album>纪念册</button><button type="button" data-v5-templates>模板库</button><button type="button" data-v5-restore>恢复</button></div>`;
    profileCard.insertAdjacentElement("afterend", panel);
    panel.querySelector("[data-v5-profile]")?.addEventListener("click", showProfile);
    panel.querySelector("[data-v5-album]")?.addEventListener("click", showAlbum);
    panel.querySelector("[data-v5-templates]")?.addEventListener("click", showTemplates);
    panel.querySelector("[data-v5-restore]")?.addEventListener("click", showRestore);
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root) return;
    ensureDashboard(root);
  }
  function schedule() { if (scheduled) return; scheduled = true; requestAnimationFrame(enhance); }
  function init() {
    document.documentElement.dataset.companionRelationshipRevision = REVISION;
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-uai-mode", "hidden", "class"] });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && document.getElementById("uaiCompanionV5Mask")) closeModal(); });
    schedule();
  }
  window.UnlimitedCompanionRelationship = { revision: REVISION, showProfile, showAlbum, showTemplates, showRestore, buildTimeline, importBackup };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();