// Companion scene backup bridge — preserves per-character V12.8 scenes across import/rollback.
(() => {
  const REVISION = "2026-08-14-v12.8-scene-backup-1";
  const KEYS = {
    characters: "uai_companion_characters_v1",
    activeCharacter: "uai_companion_active_character_v1",
    profile: "uai_companion_profile_v1",
    sessions: "uai_companion_sessions_v1",
    memories: "uai_companion_memories_v1",
    settings: "uai_companion_settings_v1",
    moments: "uai_companion_moments_v1",
    archive: "uai_companion_memory_archive_v1",
    scenes: "uai_companion_scene_assignments_v1",
    rollback: "uai_companion_import_rollback_v1"
  };
  const THEMES = new Set(["galaxy", "sakura", "moonlight", "neon"]);
  const MODES = new Set(["initial", "manual", "shuffled"]);
  const MAX_CHARACTERS = 6;
  const legacyRestore = window.UnlimitedCompanionProfileRestore?.restoreRollback?.bind(window.UnlimitedCompanionProfileRestore);

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function readJson(key, fallback) {
    return safeParse(localStorage.getItem(key), fallback);
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function clean(value, max = 80) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function makeId(prefix) {
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${token}`;
  }

  function clampNumber(value, min, max, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function sanitizeVariant(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    return {
      density: clampNumber(raw.density, 0.5, 1.6, 1),
      bandOffset: Math.round(clampNumber(raw.bandOffset, -100, 100, 0)),
      particleStyle: Math.round(clampNumber(raw.particleStyle, 0, 2, 0)),
      welcomeIndex: Math.round(clampNumber(raw.welcomeIndex, 0, 2, 0)),
      decorationIndex: Math.round(clampNumber(raw.decorationIndex, 0, 2, 0)),
      washX: Math.round(clampNumber(raw.washX, -100, 100, 0)),
      washY: Math.round(clampNumber(raw.washY, -100, 100, 0))
    };
  }

  function sanitizeAssignment(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || !THEMES.has(raw.theme)) return null;
    const seed = Number(raw.seed);
    const assignment = {
      theme: raw.theme,
      seed: Number.isFinite(seed) ? seed >>> 0 : (Date.now() >>> 0),
      mode: MODES.has(raw.mode) ? raw.mode : "initial",
      assignedAt: Number(raw.assignedAt) || Date.now()
    };
    const variant = sanitizeVariant(raw.variant);
    if (variant) assignment.variant = variant;
    return assignment;
  }

  function sanitizeSceneMap(raw, validIds) {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const result = {};
    validIds.forEach((id) => {
      const assignment = sanitizeAssignment(source[id]);
      if (assignment) result[id] = assignment;
    });
    return result;
  }

  function isGenerating() {
    return Boolean(document.querySelector("#uaiCompanionInput:disabled"));
  }

  function getCharacters() {
    const list = readJson(KEYS.characters, []);
    return Array.isArray(list) ? list : [];
  }

  function normalizeSettings(raw) {
    const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const replyLength = ["short", "balanced", "detailed"].includes(value.replyLength) ? value.replyLength : "balanced";
    return {
      model: clean(value.model, 180),
      replyLength,
      memoryEnabled: value.memoryEnabled !== false
    };
  }

  function loadCharacterSlots(character) {
    if (!character) return;
    writeJson(KEYS.profile, character.profile || {});
    writeJson(KEYS.sessions, Array.isArray(character.sessions) ? character.sessions : []);
    writeJson(KEYS.memories, Array.isArray(character.memories) ? character.memories : []);
    writeJson(KEYS.settings, normalizeSettings(character.settings));
    localStorage.setItem(KEYS.activeCharacter, character.id);
  }

  function snapshot() {
    window.UnlimitedCompanionMulti?.persist?.();
    return {
      savedAt: Date.now(),
      characters: getCharacters(),
      activeCharacterId: localStorage.getItem(KEYS.activeCharacter) || "",
      moments: readJson(KEYS.moments, {}),
      archive: readJson(KEYS.archive, {}),
      sceneAssignments: readJson(KEYS.scenes, {})
    };
  }

  function saveRollback() {
    writeJson(KEYS.rollback, snapshot());
  }

  function validateRawBackup(raw) {
    const core = window.UnlimitedCompanionProfileRestore;
    if (!core?.validateBackup) throw new Error("基础备份恢复模块尚未加载，请刷新页面后重试");
    const validated = core.validateBackup(raw);
    const validIds = validated.characters.map((item) => item.id);
    return {
      ...validated,
      scenes: sanitizeSceneMap(raw?.sceneAssignmentsByCharacter, validIds)
    };
  }

  function applyImportedBackup(validated, mode) {
    if (isGenerating()) throw new Error("当前回复还在生成，请先停止生成再恢复备份");
    saveRollback();

    if (mode === "replace") {
      writeJson(KEYS.characters, validated.characters);
      writeJson(KEYS.moments, validated.moments || {});
      writeJson(KEYS.archive, validated.archive || {});
      writeJson(KEYS.scenes, validated.scenes || {});
      const active = validated.characters.find((item) => item.id === validated.activeCharacterId) || validated.characters[0];
      loadCharacterSlots(active);
      return { imported: validated.characters.length, active };
    }

    const existing = getCharacters();
    const room = Math.max(0, MAX_CHARACTERS - existing.length);
    if (!room) throw new Error(`当前已经有 ${existing.length} 个角色，没有可导入空间`);

    const existingNames = new Set(existing.map((item) => clean(item?.profile?.name, 40).toLowerCase()));
    const additions = [];
    const sourceByNewId = new Map();

    for (const source of validated.characters) {
      if (additions.length >= room) break;
      const copy = JSON.parse(JSON.stringify(source));
      const sourceId = source.id;
      if (existing.some((item) => item.id === copy.id) || additions.some((item) => item.id === copy.id)) {
        copy.id = makeId("import-character");
      }
      const normalizedName = clean(copy.profile?.name, 40).toLowerCase();
      if (existingNames.has(normalizedName)) copy.profile.name = `${copy.profile.name}（导入）`.slice(0, 40);
      existingNames.add(clean(copy.profile?.name, 40).toLowerCase());
      additions.push(copy);
      sourceByNewId.set(copy.id, sourceId);
    }

    if (!additions.length) throw new Error("备份中没有可合并的角色");
    writeJson(KEYS.characters, [...existing, ...additions].slice(0, MAX_CHARACTERS));

    const moments = readJson(KEYS.moments, {});
    const archive = readJson(KEYS.archive, {});
    const scenes = readJson(KEYS.scenes, {});
    additions.forEach((character) => {
      const sourceId = sourceByNewId.get(character.id);
      moments[character.id] = sourceId && Array.isArray(validated.moments?.[sourceId]) ? validated.moments[sourceId] : [];
      archive[character.id] = sourceId && Array.isArray(validated.archive?.[sourceId]) ? validated.archive[sourceId] : [];
      if (sourceId && validated.scenes?.[sourceId]) scenes[character.id] = validated.scenes[sourceId];
    });
    writeJson(KEYS.moments, moments);
    writeJson(KEYS.archive, archive);
    writeJson(KEYS.scenes, scenes);
    return { imported: additions.length, active: existing.find((item) => item.id === localStorage.getItem(KEYS.activeCharacter)) || existing[0] || additions[0] };
  }

  function closePreview() {
    document.getElementById("uaiCompanionSceneBackupMask")?.remove();
  }

  function showPreview(validated) {
    closePreview();
    const mask = document.createElement("div");
    mask.id = "uaiCompanionSceneBackupMask";
    mask.className = "uai-c-v5-mask";
    const sceneCount = Object.keys(validated.scenes || {}).length;
    const sessionCount = validated.characters.reduce((sum, item) => sum + (Array.isArray(item.sessions) ? item.sessions.length : 0), 0);
    mask.innerHTML = `
      <section class="uai-c-v5-modal compact" role="dialog" aria-modal="true" aria-label="恢复备份">
        <header><div><span>RESTORE PREVIEW</span><h3>备份校验通过</h3><p>角色、聊天、记忆与角色场景会一起恢复。</p></div><button type="button" data-scene-backup-close>×</button></header>
        <div class="uai-c-v5-import-summary">
          <div><strong>${validated.characters.length}</strong><span>角色</span></div>
          <div><strong>${sessionCount}</strong><span>会话</span></div>
          <div><strong>${sceneCount}</strong><span>角色场景</span></div>
        </div>
        <div class="uai-c-v5-import-warning"><strong>覆盖恢复</strong><span>会替换当前所有陪伴角色及场景；合并导入只加入新角色，最多保留 ${MAX_CHARACTERS} 个。</span></div>
        <footer><button type="button" class="secondary" data-scene-backup-merge>合并导入</button><button type="button" data-scene-backup-replace>覆盖恢复</button></footer>
      </section>`;
    document.body.appendChild(mask);
    mask.addEventListener("click", (event) => { if (event.target === mask) closePreview(); });
    mask.querySelectorAll("[data-scene-backup-close]").forEach((button) => button.addEventListener("click", closePreview));
    mask.querySelector("[data-scene-backup-merge]")?.addEventListener("click", () => {
      try {
        const result = applyImportedBackup(validated, "merge");
        alert(`已合并导入 ${result.imported} 个角色，角色场景也已同步恢复。页面将刷新。`);
        location.reload();
      } catch (error) {
        alert(error?.message || String(error));
      }
    });
    mask.querySelector("[data-scene-backup-replace]")?.addEventListener("click", () => {
      if (!confirm("确认覆盖当前所有陪伴角色、聊天、记忆和角色场景？导入前数据会保留为一次本地回滚快照。")) return;
      try {
        const result = applyImportedBackup(validated, "replace");
        alert(`已恢复 ${result.imported} 个角色，角色场景也已同步恢复。页面将刷新。`);
        location.reload();
      } catch (error) {
        alert(error?.message || String(error));
      }
    });
  }

  function chooseBackupFile() {
    if (isGenerating()) return alert("当前回复还在生成。请先停止生成，再导入备份。");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 25 * 1024 * 1024) return alert("无法导入：备份文件过大（上限 25MB）");
      const reader = new FileReader();
      reader.onerror = () => alert("无法导入：读取文件失败");
      reader.onload = () => {
        try {
          const raw = JSON.parse(String(reader.result || ""));
          showPreview(validateRawBackup(raw));
        } catch (error) {
          alert(`无法导入：${error?.message || error}`);
        }
      };
      reader.readAsText(file, "utf-8");
    }, { once: true });
    input.click();
  }

  function restoreRollback() {
    const rollback = readJson(KEYS.rollback, null);
    if (!rollback?.characters?.length) return alert("没有可回滚的导入记录");
    if (!Object.prototype.hasOwnProperty.call(rollback, "sceneAssignments")) {
      if (legacyRestore) return legacyRestore();
      return alert("这个旧版回滚快照不包含场景信息，请使用原恢复模块处理。");
    }
    if (!confirm("恢复到最近一次导入前的陪伴数据？当前导入后的变化会被覆盖。")) return;
    writeJson(KEYS.characters, rollback.characters);
    writeJson(KEYS.moments, rollback.moments || {});
    writeJson(KEYS.archive, rollback.archive || {});
    writeJson(KEYS.scenes, rollback.sceneAssignments || {});
    const active = rollback.characters.find((item) => item.id === rollback.activeCharacterId) || rollback.characters[0];
    loadCharacterSlots(active);
    localStorage.removeItem(KEYS.rollback);
    location.reload();
  }

  function init() {
    document.documentElement.dataset.companionSceneBackupRevision = REVISION;
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePreview();
    });
  }

  window.UnlimitedCompanionSceneBackup = {
    revision: REVISION,
    chooseBackupFile,
    restoreRollback,
    validateRawBackup,
    sanitizeAssignment,
    applyImportedBackup
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
