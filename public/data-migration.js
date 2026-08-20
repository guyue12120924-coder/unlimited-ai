// public/data-migration.js
// Backward-compatible data normalization for persistent message IDs, manuscript links,
// structured character profiles, structured world-building fields, and storage errors.
(() => {
  const LS_SESSIONS = "cfw_sessions_v2";
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const originalSetItem = Storage.prototype.setItem;
  let lastStorageErrorAt = 0;

  const CHARACTER_FIELDS = [
    ["personality", "性格"],
    ["appearance", "外貌"],
    ["goal", "核心目标"],
    ["voice", "说话特点"],
    ["secret", "人物秘密"],
    ["currentState", "当前状态"],
    ["notes", "备注"]
  ];

  const WORLD_FIELDS = [
    ["worldOverview", "世界观概述"],
    ["worldRules", "世界规则"],
    ["locations", "地点"],
    ["factions", "势力 / 组织"],
    ["importantItems", "重要物品"]
  ];

  function reportStorageError(error, key) {
    const detail = {
      key: String(key || ""),
      name: error?.name || "StorageError",
      message: error?.message || String(error || "Local storage write failed"),
      at: Date.now()
    };
    window.__UNLIMITED_STORAGE_ERROR__ = detail;
    if (detail.at - lastStorageErrorAt < 800) return;
    lastStorageErrorAt = detail.at;
    try { window.dispatchEvent(new CustomEvent("uai:storage-error", { detail })); } catch {}
  }

  function writeOriginal(storage, key, value) {
    try {
      return originalSetItem.call(storage, key, value);
    } catch (error) {
      if (storage === localStorage) reportStorageError(error, key);
      throw error;
    }
  }

  function hashText(value) {
    const source = String(value ?? "");
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function stableMessageId(sessionId, message, index, occurrence = 0) {
    const role = message?.role === "assistant" ? "a" : "u";
    const fingerprint = hashText(`${message?.content || ""}|${occurrence}`);
    return `msg-${String(sessionId || "session")}-${role}-${index}-${fingerprint}`;
  }

  function labelPattern(fields) {
    const labels = fields.map(([, label]) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`【(${labels.join("|")})】`, "g");
  }

  function parseLabeledText(value, fields, fallbackKey) {
    const source = String(value || "").trim();
    const result = Object.fromEntries(fields.map(([key]) => [key, ""]));
    if (!source) return { values: result, structured: false };

    const matches = [...source.matchAll(labelPattern(fields))];
    if (!matches.length) {
      if (fallbackKey && Object.hasOwn(result, fallbackKey)) result[fallbackKey] = source;
      return { values: result, structured: false };
    }

    matches.forEach((match, index) => {
      const key = fields.find(([, label]) => label === match[1])?.[0];
      if (!key) return;
      const start = match.index + match[0].length;
      const end = matches[index + 1]?.index ?? source.length;
      result[key] = source.slice(start, end).trim();
    });
    return { values: result, structured: true };
  }

  function normalizeCharacter(character) {
    if (!character || typeof character !== "object") return false;
    let changed = false;
    const parsed = parseLabeledText(character.note, CHARACTER_FIELDS, "notes");

    CHARACTER_FIELDS.forEach(([key]) => {
      if (typeof character[key] !== "string") {
        character[key] = "";
        changed = true;
      }

      if (parsed.structured) {
        if (character[key] !== parsed.values[key]) {
          character[key] = parsed.values[key];
          changed = true;
        }
      } else if (!character[key] && parsed.values[key]) {
        character[key] = parsed.values[key];
        changed = true;
      }
    });

    return changed;
  }

  function normalizeWorld(project) {
    if (!project || typeof project !== "object") return false;
    let changed = false;
    const parsed = parseLabeledText(project.world, WORLD_FIELDS, "worldOverview");

    WORLD_FIELDS.forEach(([key]) => {
      if (typeof project[key] !== "string") {
        project[key] = "";
        changed = true;
      }

      if (parsed.structured) {
        if (project[key] !== parsed.values[key]) {
          project[key] = parsed.values[key];
          changed = true;
        }
      } else if (!project[key] && parsed.values[key]) {
        project[key] = parsed.values[key];
        changed = true;
      }
    });

    return changed;
  }

  function normalizeSessions(value) {
    const sessions = Array.isArray(value) ? value : [];
    let changed = false;

    sessions.forEach((session) => {
      if (!session || typeof session !== "object") return;
      if (!Array.isArray(session.messages)) {
        session.messages = [];
        changed = true;
      }

      const occurrences = new Map();
      session.messages.forEach((message, index) => {
        if (!message || typeof message !== "object") return;
        const key = `${message.role || "unknown"}|${message.content || ""}`;
        const occurrence = occurrences.get(key) || 0;
        occurrences.set(key, occurrence + 1);

        if (!message.id || typeof message.id !== "string") {
          message.id = stableMessageId(session.id, message, index, occurrence);
          changed = true;
        }
      });
    });

    return { value: sessions, changed };
  }

  function normalizeWorkspace(value, sessions) {
    const workspace = value && typeof value === "object" ? value : {};
    const sessionMap = new Map((sessions || []).map((session) => [session.id, session]));
    let changed = false;

    if (!Array.isArray(workspace.projects)) workspace.projects = [];

    workspace.projects.forEach((project) => {
      if (!project || typeof project !== "object") return;

      if (!Array.isArray(project.characters)) {
        project.characters = [];
        changed = true;
      }
      project.characters.forEach((character) => {
        if (normalizeCharacter(character)) changed = true;
      });

      if (normalizeWorld(project)) changed = true;

      if (!Array.isArray(project.manuscriptClips)) {
        project.manuscriptClips = [];
        changed = true;
      }

      project.manuscriptClips.forEach((clip) => {
        if (!clip || typeof clip !== "object") return;
        const session = sessionMap.get(clip.sessionId);
        if (!session || !Array.isArray(session.messages)) return;

        if (clip.messageId) {
          const nextIndex = session.messages.findIndex((message) => message?.id === clip.messageId);
          if (nextIndex >= 0 && clip.messageIndex !== nextIndex) {
            clip.messageIndex = nextIndex;
            changed = true;
          }
          return;
        }

        if (Number.isInteger(clip.messageIndex)) {
          const message = session.messages[clip.messageIndex];
          if (message?.id) {
            clip.messageId = message.id;
            changed = true;
          }
        }
      });
    });

    return { value: workspace, changed };
  }

  function parseJson(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function normalizedSessionsFromStorage() {
    const parsed = parseJson(localStorage.getItem(LS_SESSIONS) || "[]", []);
    return normalizeSessions(parsed).value;
  }

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    if (this !== localStorage || typeof value !== "string") {
      return writeOriginal(this, key, value);
    }

    if (key === LS_SESSIONS) {
      const parsed = parseJson(value, null);
      if (Array.isArray(parsed)) {
        const normalized = normalizeSessions(parsed).value;
        return writeOriginal(this, key, JSON.stringify(normalized));
      }
    }

    if (key === LS_STUDIO) {
      const parsed = parseJson(value, null);
      if (parsed && typeof parsed === "object") {
        const sessions = normalizedSessionsFromStorage();
        const normalized = normalizeWorkspace(parsed, sessions).value;
        return writeOriginal(this, key, JSON.stringify(normalized));
      }
    }

    return writeOriginal(this, key, value);
  };

  function migrateExistingData() {
    const sessionsRaw = localStorage.getItem(LS_SESSIONS);
    let sessions = [];

    if (sessionsRaw) {
      const parsed = parseJson(sessionsRaw, []);
      const result = normalizeSessions(parsed);
      sessions = result.value;
      if (result.changed) writeOriginal(localStorage, LS_SESSIONS, JSON.stringify(sessions));
    }

    const studioRaw = localStorage.getItem(LS_STUDIO);
    if (studioRaw) {
      const parsed = parseJson(studioRaw, {});
      const result = normalizeWorkspace(parsed, sessions);
      if (result.changed) writeOriginal(localStorage, LS_STUDIO, JSON.stringify(result.value));
    }
  }

  window.UnlimitedData = {
    normalizeSessions,
    normalizeWorkspace,
    stableMessageId,
    get lastStorageError() { return window.__UNLIMITED_STORAGE_ERROR__ || null; }
  };

  migrateExistingData();
})();