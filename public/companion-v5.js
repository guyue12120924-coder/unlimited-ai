// public/companion-v5.js
// Tool-only relationship record and validated backup restore module.
(() => {
  const REVISION = "2026-08-14-v8.1-profile-restore-core-1";
  const KEYS = {
    characters: "uai_companion_characters_v1",
    activeCharacter: "uai_companion_active_character_v1",
    profile: "uai_companion_profile_v1",
    sessions: "uai_companion_sessions_v1",
    memories: "uai_companion_memories_v1",
    settings: "uai_companion_settings_v1",
    moments: "uai_companion_moments_v1",
    archive: "uai_companion_memory_archive_v1",
    rollback: "uai_companion_import_rollback_v1"
  };
  const MAX_CHARACTERS = 6;
  const MAX_SESSIONS = 240;
  const MAX_MESSAGES_PER_SESSION = 700;
  const MAX_MEMORIES = 100;
  const PROFILE_LIMIT = 5000;

  function safeParse(value, fallback) { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } }
  function readJson(key, fallback) { return safeParse(localStorage.getItem(key), fallback); }
  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function clean(value, max = 240) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function makeId(prefix) {
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${token}`;
  }

  function activeCharacterId() { return localStorage.getItem(KEYS.activeCharacter) || ""; }
  function getCharacters() { const list = readJson(KEYS.characters, []); return Array.isArray(list) ? list : []; }
  function getActiveCharacter() {
    const characters = getCharacters();
    return characters.find((item) => item?.id === activeCharacterId()) || characters[0] || null;
  }
  function momentsMap() { const map = readJson(KEYS.moments, {}); return map && typeof map === "object" && !Array.isArray(map) ? map : {}; }
  function archiveMap() { const map = readJson(KEYS.archive, {}); return map && typeof map === "object" && !Array.isArray(map) ? map : {}; }
  function getMoments(id = activeCharacterId()) { const list = momentsMap()[id]; return Array.isArray(list) ? list : []; }
  function isGenerating() { return Boolean(document.querySelector("#uaiCompanionInput:disabled")); }
  function relationLabel(value) { return ({ girlfriend: "女朋友", boyfriend: "男朋友", friend: "好朋友", confidant: "知心伙伴", custom: "自定义关系" })[value] || "陪伴伙伴"; }

  function formatDate(value) {
    const date = new Date(Number(value) || value || Date.now());
    if (Number.isNaN(date.getTime())) return "未知日期";
    return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  }

  function formatMonth(value) {
    const date = new Date(Number(value) || value || Date.now());
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
  }

  function characterStats(character) {
    const sessions = Array.isArray(character?.sessions) ? character.sessions : [];
    const messageCount = sessions.reduce((sum, session) => sum + (Array.isArray(session?.messages) ? session.messages.length : 0), 0);
    const memories = Array.isArray(character?.memories) ? character.memories.length : 0;
    const moments = getMoments(character?.id).length;
    const createdAt = Number(character?.createdAt || character?.profile?.createdAt) || Date.now();
    const daysKnown = Math.max(1, Math.floor((Date.now() - createdAt) / 86400000) + 1);
    return { sessions: sessions.length, messages: messageCount, memories, moments, daysKnown, createdAt };
  }

  function relationshipStage(stats) {
    if (stats.daysKnown >= 7 && stats.messages >= 180 && stats.sessions >= 8) return { key: "in-sync", label: "很有默契" };
    if (stats.daysKnown >= 3 && stats.messages >= 70 && stats.sessions >= 4) return { key: "close", label: "渐渐亲近" };
    if (stats.messages >= 20 || stats.sessions >= 2) return { key: "familiar", label: "越来越熟" };
    return { key: "new", label: "刚刚认识" };
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

  function showToast(message) {
    const root = document.getElementById("uaiCompanionRoot");
    if (!root) return;
    let toast = root.querySelector("#uaiCompanionV5Toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "uaiCompanionV5Toast";
      toast.className = "uai-c-v5-toast";
      root.appendChild(toast);
    }
    toast.textContent = String(message || "");
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 1700);
  }

  function buildTimeline(character) {
    const stats = characterStats(character);
    const sessions = [...(Array.isArray(character?.sessions) ? character.sessions : [])].sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    const moments = [...getMoments(character?.id)].sort((a, b) => Number(a.savedAt || a.createdAt || 0) - Number(b.savedAt || b.createdAt || 0));
    const events = [{ type: "start", at: stats.createdAt, title: "第一次认识", text: `从这里开始，你和${character?.profile?.name || "这个伙伴"}有了第一段记录。` }];
    const secondSession = sessions[1];
    if (secondSession) events.push({ type: "familiar", at: secondSession.createdAt || secondSession.updatedAt, title: "开始熟悉", text: "你们有了不止一次的聊天。" });
    const fourthSession = sessions[3];
    if (fourthSession && stats.messages >= 70) events.push({ type: "close", at: fourthSession.createdAt || fourthSession.updatedAt, title: "渐渐亲近", text: "共同话题和聊天记忆开始明显积累。" });
    const eighthSession = sessions[7];
    if (eighthSession && stats.messages >= 180 && stats.daysKnown >= 7) events.push({ type: "sync", at: eighthSession.createdAt || eighthSession.updatedAt, title: "很有默契", text: "关系进入更稳定的长期互动阶段。" });
    moments.slice(-12).forEach((moment) => events.push({ type: "moment", at: moment.savedAt || moment.createdAt, title: moment.note ? clean(moment.note, 42) : "收藏了一个重要时刻", text: clean(moment.text, 110) }));
    return events.sort((a, b) => Number(b.at || 0) - Number(a.at || 0)).slice(0, 30);
  }

  function groupMomentsByMonth(characterId) {
    const groups = new Map();
    const moments = [...getMoments(characterId)].sort((a, b) => Number(b.savedAt || b.createdAt || 0) - Number(a.savedAt || a.createdAt || 0));
    moments.forEach((moment) => {
      const key = formatMonth(moment.savedAt || moment.createdAt);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(moment);
    });
    return groups;
  }

  function showCharacterProfile() {
    window.UnlimitedCompanionMulti?.persist?.();
    const character = getActiveCharacter();
    if (!character) return;
    const stats = characterStats(character);
    const stage = relationshipStage(stats);
    const timeline = buildTimeline(character);
    const groups = groupMomentsByMonth(character.id);
    const profile = character.profile || {};
    const profileTags = (Array.isArray(profile.personality) ? profile.personality : []).filter((item) => item && item !== "以完整角色设定为准").slice(0, 8);

    openModal(`
      <section class="uai-c-v5-modal profile" role="dialog" aria-modal="true" aria-label="关系记录">
        <header class="uai-c-v5-profile-hero">
          <div class="uai-c-v5-hero-avatar">${profile.avatarData ? `<img src="${escapeHtml(profile.avatarData)}" alt="头像" />` : `<span>${profile.relationship === "boyfriend" ? "💙" : profile.relationship === "friend" ? "🌙" : "💗"}</span>`}</div>
          <div class="uai-c-v5-hero-copy"><span>RELATIONSHIP</span><h3>${escapeHtml(profile.name || "未命名")}</h3><p>${escapeHtml(relationLabel(profile.relationship))} · ${escapeHtml(stage.label)} · 认识 ${stats.daysKnown} 天</p>${profileTags.length ? `<div class="uai-c-v5-tags">${profileTags.map((item) => `<b>${escapeHtml(item)}</b>`).join("")}</div>` : ""}</div>
          <button type="button" data-v5-close>×</button>
        </header>
        <div class="uai-c-v5-profile-stats"><div><strong>${stats.sessions}</strong><span>会话</span></div><div><strong>${stats.messages}</strong><span>消息</span></div><div><strong>${stats.memories}</strong><span>记忆</span></div><div><strong>${stats.moments}</strong><span>重要时刻</span></div></div>
        <div class="uai-c-v5-profile-grid">
          <section><div class="uai-c-v5-section-title"><div><span>RELATIONSHIP</span><h4>关系时间线</h4></div></div><div class="uai-c-v5-timeline">${timeline.map((event) => `<article class="${escapeHtml(event.type)}"><i></i><div><time>${escapeHtml(formatDate(event.at))}</time><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.text)}</p></div></article>`).join("")}</div></section>
          <section><div class="uai-c-v5-section-title"><div><span>ALBUM</span><h4>重要时刻</h4></div><button type="button" id="uaiV5OpenMoments">管理</button></div><div class="uai-c-v5-album">${groups.size ? Array.from(groups.entries()).map(([month, items]) => `<div class="uai-c-v5-album-group"><h5>${escapeHtml(month)}</h5>${items.slice(0, 6).map((item) => `<article><span>${item.role === "user" ? "你" : escapeHtml(profile.name || "AI")}</span><p>${escapeHtml(clean(item.text, 160))}</p>${item.note ? `<small>${escapeHtml(item.note)}</small>` : ""}</article>`).join("")}</div>`).join("") : `<div class="uai-c-v5-empty">还没有珍藏的重要时刻。</div>`}</div></section>
        </div>
      </section>`, (mask) => {
        mask.querySelector("#uaiV5OpenMoments")?.addEventListener("click", () => {
          closeModal();
          window.UnlimitedCompanionMemorySearch?.showMoments?.();
        });
      });
  }

  function sanitizeMessage(raw) {
    if (!raw || !["user", "assistant"].includes(raw.role)) return null;
    const content = clean(raw.content, 12000);
    if (!content) return null;
    return { role: raw.role, content, createdAt: Number(raw.createdAt) || Date.now() };
  }

  function sanitizeSession(raw, index) {
    if (!raw || typeof raw !== "object") return null;
    const messages = (Array.isArray(raw.messages) ? raw.messages : []).slice(0, MAX_MESSAGES_PER_SESSION).map(sanitizeMessage).filter(Boolean);
    if (!messages.length) return null;
    const createdAt = Number(raw.createdAt) || Date.now();
    return {
      id: clean(raw.id, 100) || makeId(`import-session-${index}`),
      title: clean(raw.title, 80) || "导入的聊天",
      createdAt,
      updatedAt: Number(raw.updatedAt) || createdAt,
      ...(raw.v3GreetingEnhanced ? { v3GreetingEnhanced: true } : {}),
      messages
    };
  }

  function sanitizeMemory(raw, index) {
    const text = typeof raw === "string" ? clean(raw, 180) : clean(raw?.text, 180);
    if (!text) return null;
    return {
      id: clean(raw?.id, 110) || makeId(`import-memory-${index}`),
      text,
      source: clean(raw?.source, 40) || "imported",
      kind: clean(raw?.kind, 30) || "fact",
      createdAt: Number(raw?.createdAt) || Date.now(),
      ...(Number(raw?.updatedAt) ? { updatedAt: Number(raw.updatedAt) } : {})
    };
  }

  function sanitizeProfile(raw) {
    if (!raw || typeof raw !== "object") return null;
    const name = clean(raw.name, 40);
    if (!name) return null;
    return {
      name,
      relationship: clean(raw.relationship, 30) || "friend",
      personality: (Array.isArray(raw.personality) ? raw.personality : []).map((item) => clean(item, 30)).filter(Boolean).slice(0, 10),
      speakingStyle: (Array.isArray(raw.speakingStyle) ? raw.speakingStyle : []).map((item) => clean(item, 70)).filter(Boolean).slice(0, 10),
      customDescription: clean(raw.customDescription || raw.description, PROFILE_LIMIT),
      userNickname: clean(raw.userNickname, 40),
      avatarData: typeof raw.avatarData === "string" && raw.avatarData.startsWith("data:image/") && raw.avatarData.length <= 1800000 ? raw.avatarData : "",
      createdAt: Number(raw.createdAt) || Date.now()
    };
  }

  function sanitizeCharacter(raw, index) {
    if (!raw || typeof raw !== "object") return null;
    const profile = sanitizeProfile(raw.profile);
    if (!profile) return null;
    const sessions = (Array.isArray(raw.sessions) ? raw.sessions : []).slice(0, MAX_SESSIONS).map((item, i) => sanitizeSession(item, i)).filter(Boolean);
    const memories = (Array.isArray(raw.memories) ? raw.memories : []).slice(0, MAX_MEMORIES).map((item, i) => sanitizeMemory(item, i)).filter(Boolean);
    const id = clean(raw.id, 110) || makeId(`import-character-${index}`);
    return {
      id,
      profile,
      sessions: sessions.length ? sessions : [{ id: makeId("companion-session"), title: "新的聊天", createdAt: Date.now(), updatedAt: Date.now(), messages: [{ role: "assistant", content: `我是${profile.name}。导入已经完成，我们可以继续聊。`, createdAt: Date.now() }] }],
      memories,
      settings: raw.settings && typeof raw.settings === "object" && !Array.isArray(raw.settings) ? raw.settings : {},
      createdAt: Number(raw.createdAt || profile.createdAt) || Date.now(),
      updatedAt: Number(raw.updatedAt) || Date.now()
    };
  }

  function sanitizeRoleMap(raw, validIds, type) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const result = {};
    for (const id of validIds) {
      const list = Array.isArray(raw[id]) ? raw[id] : [];
      result[id] = list.slice(0, type === "moments" ? 120 : 150).map((item, index) => {
        if (!item || typeof item !== "object") return null;
        if (type === "moments") {
          const text = clean(item.text, 500);
          if (!text) return null;
          return {
            id: clean(item.id, 110) || makeId(`import-moment-${index}`),
            sessionId: clean(item.sessionId, 110),
            messageIndex: Math.max(0, Number(item.messageIndex) || 0),
            role: item.role === "user" ? "user" : "assistant",
            text,
            note: clean(item.note, 120),
            createdAt: Number(item.createdAt) || Date.now(),
            savedAt: Number(item.savedAt) || Date.now()
          };
        }
        const memory = sanitizeMemory(item, index);
        return memory ? { ...memory, archivedAt: Number(item.archivedAt) || Date.now() } : null;
      }).filter(Boolean);
    }
    return result;
  }

  function validateBackup(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("备份文件不是有效对象");
    if (raw.format !== "unlimited-ai-companion-multichar-backup") throw new Error("不是 Unlimited AI 多角色陪伴备份");
    if (![1, 2].includes(Number(raw.version))) throw new Error("备份版本不受支持");
    if (!Array.isArray(raw.characters) || !raw.characters.length) throw new Error("备份中没有角色数据");

    const characters = raw.characters.slice(0, MAX_CHARACTERS).map(sanitizeCharacter).filter(Boolean);
    if (!characters.length) throw new Error("没有可恢复的有效角色");
    const seen = new Set();
    characters.forEach((character) => {
      if (seen.has(character.id)) character.id = makeId("import-character");
      seen.add(character.id);
    });
    const validIds = characters.map((item) => item.id);
    const moments = sanitizeRoleMap(raw.importantMomentsByCharacter, validIds, "moments");
    const archive = sanitizeRoleMap(raw.memoryArchiveByCharacter, validIds, "archive");
    const activeId = validIds.includes(raw.activeCharacterId) ? raw.activeCharacterId : validIds[0];
    return { characters, moments, archive, activeCharacterId: activeId, version: Number(raw.version) };
  }

  function currentBackupSnapshot() {
    window.UnlimitedCompanionMulti?.persist?.();
    return {
      savedAt: Date.now(),
      characters: getCharacters(),
      activeCharacterId: activeCharacterId(),
      moments: momentsMap(),
      archive: archiveMap()
    };
  }

  function saveRollback() { writeJson(KEYS.rollback, currentBackupSnapshot()); }

  function loadCharacterSlots(character) {
    if (!character) return;
    writeJson(KEYS.profile, character.profile || {});
    writeJson(KEYS.sessions, Array.isArray(character.sessions) ? character.sessions : []);
    writeJson(KEYS.memories, Array.isArray(character.memories) ? character.memories : []);
    writeJson(KEYS.settings, character.settings || {});
    localStorage.setItem(KEYS.activeCharacter, character.id);
  }

  function applyImportedBackup(validated, mode) {
    if (isGenerating()) throw new Error("当前回复还在生成，请先停止生成再恢复备份");
    saveRollback();

    if (mode === "replace") {
      writeJson(KEYS.characters, validated.characters);
      writeJson(KEYS.moments, validated.moments);
      writeJson(KEYS.archive, validated.archive);
      const active = validated.characters.find((item) => item.id === validated.activeCharacterId) || validated.characters[0];
      loadCharacterSlots(active);
      return { imported: validated.characters.length, active };
    }

    const existing = getCharacters();
    const existingNames = new Set(existing.map((item) => clean(item?.profile?.name, 40).toLowerCase()));
    const room = Math.max(0, MAX_CHARACTERS - existing.length);
    const additions = [];
    const sourceByNewId = new Map();

    for (const source of validated.characters) {
      if (additions.length >= room) break;
      const copy = JSON.parse(JSON.stringify(source));
      const sourceId = source.id;
      if (existing.some((item) => item.id === copy.id) || additions.some((item) => item.id === copy.id)) copy.id = makeId("import-character");
      if (existingNames.has(clean(copy.profile?.name, 40).toLowerCase())) copy.profile.name = `${copy.profile.name}（导入）`.slice(0, 40);
      existingNames.add(clean(copy.profile?.name, 40).toLowerCase());
      additions.push(copy);
      sourceByNewId.set(copy.id, sourceId);
    }

    if (!additions.length) throw new Error(`当前已经有 ${existing.length} 个角色，没有可导入空间`);
    writeJson(KEYS.characters, [...existing, ...additions].slice(0, MAX_CHARACTERS));
    const currentMoments = momentsMap();
    const currentArchive = archiveMap();
    additions.forEach((character) => {
      const sourceId = sourceByNewId.get(character.id);
      currentMoments[character.id] = sourceId && Array.isArray(validated.moments[sourceId]) ? validated.moments[sourceId] : [];
      currentArchive[character.id] = sourceId && Array.isArray(validated.archive[sourceId]) ? validated.archive[sourceId] : [];
    });
    writeJson(KEYS.moments, currentMoments);
    writeJson(KEYS.archive, currentArchive);
    return { imported: additions.length, active: getActiveCharacter() };
  }

  function restoreRollback() {
    const rollback = readJson(KEYS.rollback, null);
    if (!rollback?.characters?.length) return showToast("没有可回滚的导入记录");
    if (!confirm("恢复到最近一次导入前的陪伴数据？当前导入后的变化会被覆盖。")) return;
    writeJson(KEYS.characters, rollback.characters);
    writeJson(KEYS.moments, rollback.moments || {});
    writeJson(KEYS.archive, rollback.archive || {});
    const active = rollback.characters.find((item) => item.id === rollback.activeCharacterId) || rollback.characters[0];
    loadCharacterSlots(active);
    localStorage.removeItem(KEYS.rollback);
    location.reload();
  }

  function readBackupFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("没有选择文件"));
      if (file.size > 25 * 1024 * 1024) return reject(new Error("备份文件过大（上限 25MB）"));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("读取文件失败"));
      reader.onload = () => {
        try { resolve(validateBackup(JSON.parse(String(reader.result || "")))); }
        catch (error) { reject(error); }
      };
      reader.readAsText(file, "utf-8");
    });
  }

  function showImportPreview(validated) {
    const totals = validated.characters.reduce((acc, character) => {
      const stats = characterStats(character);
      acc.sessions += stats.sessions;
      acc.messages += stats.messages;
      acc.memories += stats.memories;
      return acc;
    }, { sessions: 0, messages: 0, memories: 0 });

    openModal(`
      <section class="uai-c-v5-modal compact" role="dialog" aria-modal="true" aria-label="恢复备份">
        <header><div><span>RESTORE PREVIEW</span><h3>备份校验通过</h3><p>选择合并导入或覆盖恢复。覆盖前会自动保留一次本地回滚快照。</p></div><button type="button" data-v5-close>×</button></header>
        <div class="uai-c-v5-import-summary"><div><strong>${validated.characters.length}</strong><span>角色</span></div><div><strong>${totals.sessions}</strong><span>会话</span></div><div><strong>${totals.messages}</strong><span>消息</span></div><div><strong>${totals.memories}</strong><span>记忆</span></div></div>
        <div class="uai-c-v5-import-list">${validated.characters.map((character) => `<article><strong>${escapeHtml(character.profile?.name || "未命名")}</strong><span>${escapeHtml(relationLabel(character.profile?.relationship))}</span><small>${character.sessions.length} 会话 · ${character.memories.length} 记忆</small></article>`).join("")}</div>
        <div class="uai-c-v5-import-warning"><strong>覆盖恢复</strong><span>会替换当前所有 AI 伙伴；合并导入只把新角色加入现有角色列表，最多保留 ${MAX_CHARACTERS} 个。</span></div>
        <footer><button type="button" class="secondary" id="uaiV5MergeImport">合并导入</button><button type="button" id="uaiV5ReplaceImport">覆盖恢复</button></footer>
      </section>`, (mask) => {
        mask.querySelector("#uaiV5MergeImport")?.addEventListener("click", () => {
          try {
            const result = applyImportedBackup(validated, "merge");
            alert(`已合并导入 ${result.imported} 个角色。页面将刷新以载入数据。`);
            location.reload();
          } catch (error) { alert(error.message || String(error)); }
        });
        mask.querySelector("#uaiV5ReplaceImport")?.addEventListener("click", () => {
          if (!confirm("确认覆盖当前所有陪伴角色、聊天和记忆？导入前数据会保留为一次本地回滚快照。")) return;
          try {
            const result = applyImportedBackup(validated, "replace");
            alert(`已恢复 ${result.imported} 个角色。页面将刷新以载入数据。`);
            location.reload();
          } catch (error) { alert(error.message || String(error)); }
        });
      });
  }

  function chooseBackupFile() {
    if (isGenerating()) return alert("当前回复还在生成。请先停止生成，再导入备份。");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      try { showImportPreview(await readBackupFile(input.files?.[0])); }
      catch (error) { alert(`无法导入：${error.message || error}`); }
    }, { once: true });
    input.click();
  }

  function init() {
    document.documentElement.dataset.companionProfileRestoreRevision = REVISION;
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.getElementById("uaiCompanionV5Mask")) closeModal();
    });
  }

  window.UnlimitedCompanionProfileRestore = {
    revision: REVISION,
    refresh: () => {},
    showCharacterProfile,
    chooseBackupFile,
    validateBackup,
    restoreRollback,
    relationshipStage,
    buildTimeline
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
