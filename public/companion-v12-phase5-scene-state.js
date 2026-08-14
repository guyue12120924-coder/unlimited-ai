// Companion V12.8 phase 5 — per-character scene assignment, persistence and settings controls.
(() => {
  const REVISION = "2026-08-14-v12.8-phase5-audit-2";
  const STORAGE_KEY = "uai_companion_scene_assignments_v1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  const THEMES = ["galaxy", "sakura", "moonlight", "neon"];
  const LABELS = {
    galaxy: "星河梦境",
    sakura: "樱花夜色",
    moonlight: "月光房间",
    neon: "霓虹幻想"
  };
  const ICONS = { galaxy: "✦", sakura: "🌸", moonlight: "☾", neon: "◇" };
  const WELCOME_COPY = {
    galaxy: ["今晚的星光很慢，适合把心事说给我听。", "星河还亮着，我们可以再多待一会儿。", "把今天没说完的话，留在这片星光里吧。"],
    sakura: ["夜樱刚好落下来一点，慢慢聊吧。", "今晚的风很轻，樱花也在听。", "这里没有催促，只有一点花影和你。"],
    moonlight: ["月光落进来了，今晚适合安静地说说话。", "房间很安静，你想从哪里开始都可以。", "月色还没睡，我也没有。"],
    neon: ["霓虹还亮着，今晚想聊点不一样的吗？", "城市的光很远，这里只剩下我们的频道。", "信号已接通，想说什么都可以。"]
  };

  let scheduled = false;
  let lastAppliedSignature = "";
  let retryTimer = 0;

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function readMap() {
    const value = safeParse(localStorage.getItem(STORAGE_KEY), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function writeMap(map) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }

  function activeCharacterId() {
    return window.UnlimitedCompanionMulti?.activeCharacterId || localStorage.getItem(ACTIVE_KEY) || "";
  }

  function companionIsVisible() {
    if (document.body.dataset.uaiMode !== "companion") return false;
    const root = document.getElementById("uaiCompanionRoot");
    return Boolean(root && !root.hidden && root.isConnected);
  }

  function pruneUnknownAssignments() {
    const characters = window.UnlimitedCompanionMulti?.getCharacters?.();
    if (!Array.isArray(characters) || !characters.length) return;
    const validIds = new Set(characters.map((item) => item?.id).filter(Boolean));
    const map = readMap();
    let changed = false;
    for (const id of Object.keys(map)) {
      if (validIds.has(id)) continue;
      delete map[id];
      changed = true;
    }
    if (changed) writeMap(map);
  }

  function randomSeed() {
    try {
      const buffer = new Uint32Array(1);
      globalThis.crypto?.getRandomValues?.(buffer);
      if (buffer[0]) return buffer[0];
    } catch {}
    return Math.floor(Math.random() * 0xffffffff) >>> 0;
  }

  function makeRng(seed) {
    let state = Number(seed) >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeVariant(seed) {
    const rng = makeRng(seed);
    return {
      density: Number((0.82 + rng() * 0.42).toFixed(2)),
      bandOffset: Math.round(-30 + rng() * 60),
      particleStyle: Math.floor(rng() * 3),
      welcomeIndex: Math.floor(rng() * 3),
      decorationIndex: Math.floor(rng() * 3),
      washX: Math.round(-18 + rng() * 36),
      washY: Math.round(-12 + rng() * 24)
    };
  }

  function chooseInitialTheme(map) {
    const used = new Set(Object.values(map).map((item) => item?.theme).filter((theme) => THEMES.includes(theme)));
    const unused = THEMES.filter((theme) => !used.has(theme));
    const pool = unused.length ? unused : THEMES;
    return pool[Math.floor(Math.random() * pool.length)] || "galaxy";
  }

  function createAssignment(theme, mode = "initial") {
    const seed = randomSeed();
    return {
      theme: THEMES.includes(theme) ? theme : "galaxy",
      seed,
      variant: makeVariant(seed),
      mode,
      assignedAt: Date.now()
    };
  }

  function ensureAssignment(characterId = activeCharacterId()) {
    if (!characterId) return null;
    const map = readMap();
    let assignment = map[characterId];
    if (!assignment || !THEMES.includes(assignment.theme)) {
      assignment = createAssignment(chooseInitialTheme(map), "initial");
      map[characterId] = assignment;
      writeMap(map);
    } else if (!assignment.variant || typeof assignment.variant !== "object") {
      const seed = Number(assignment.seed) || randomSeed();
      assignment = { ...assignment, seed, variant: makeVariant(seed) };
      map[characterId] = assignment;
      writeMap(map);
    }
    return assignment;
  }

  function saveAssignment(characterId, assignment) {
    if (!characterId || !assignment) return;
    const map = readMap();
    map[characterId] = assignment;
    writeMap(map);
  }

  function randomDifferentTheme(current) {
    const pool = THEMES.filter((theme) => theme !== current);
    return pool[Math.floor(Math.random() * pool.length)] || "galaxy";
  }

  function deterministicParticleColor(theme, rng) {
    const palettes = {
      galaxy: ["#ff8fd3", "#d9a8ff", "#aab6ff", "#ffffff"],
      sakura: ["#ffb5cf", "#ff8fbd", "#ffd7e6", "#dba8ff"],
      moonlight: ["#eaf4ff", "#c9dcff", "#9eb9ff", "#b8a9ff"],
      neon: ["#ff45b1", "#9c5cff", "#3bdcff", "#ff79d1"]
    };
    const list = palettes[theme] || palettes.galaxy;
    return list[Math.floor(rng() * list.length)];
  }

  function rebuildParticles(root, assignment) {
    const host = root?.querySelector(".uai-c-v127-theme-particles");
    if (!host) return;
    const theme = assignment.theme;
    const variant = assignment.variant || makeVariant(assignment.seed);
    const rng = makeRng((Number(assignment.seed) || 1) ^ 0x9e3779b9);
    const base = { galaxy: 28, sakura: 34, moonlight: 42, neon: 32 }[theme] || 30;
    const count = Math.max(18, Math.round(base * Number(variant.density || 1)));
    const galaxySymbols = ["♥", "✦", "♡", "✧", "•", "✦"];

    host.innerHTML = "";
    for (let index = 0; index < count; index += 1) {
      const item = document.createElement("i");
      item.className = `uai-c-v127-particle uai-c-v128-shape-${(index + Number(variant.particleStyle || 0)) % 3}`;
      item.style.left = `${(2 + rng() * 96).toFixed(2)}%`;
      item.style.top = `${(-6 + rng() * 106).toFixed(2)}%`;
      item.style.setProperty("--particle-color", deterministicParticleColor(theme, rng));
      item.style.setProperty("--delay", `${(-rng() * 11).toFixed(2)}s`);
      item.style.setProperty("--dx", `${(-46 + rng() * 92).toFixed(1)}px`);

      if (theme === "sakura") {
        item.style.setProperty("--particle-size", `${(7 + rng() * 9).toFixed(1)}px`);
        item.style.setProperty("--duration", `${(8.5 + rng() * 6.5).toFixed(2)}s`);
      } else if (theme === "moonlight") {
        item.style.setProperty("--particle-size", `${(1.8 + rng() * 3.8).toFixed(1)}px`);
        item.style.setProperty("--duration", `${(6.8 + rng() * 6.4).toFixed(2)}s`);
      } else if (theme === "neon") {
        item.style.setProperty("--particle-size", `${(3 + rng() * 6).toFixed(1)}px`);
        item.style.setProperty("--duration", `${(4.8 + rng() * 5.7).toFixed(2)}s`);
        item.style.color = item.style.getPropertyValue("--particle-color");
      } else {
        item.style.setProperty("--particle-size", `${(8 + rng() * 8).toFixed(1)}px`);
        item.style.setProperty("--duration", `${(5.6 + rng() * 5.6).toFixed(2)}s`);
        item.textContent = galaxySymbols[(index + Number(variant.particleStyle || 0)) % galaxySymbols.length];
      }
      host.appendChild(item);
    }
  }

  function decorateWelcome(root, assignment) {
    const copy = root?.querySelector(".uai-c-v122-scene-copy");
    const meta = copy?.querySelector(".uai-c-v122-meta");
    if (!copy || !meta) return;
    const theme = assignment.theme;
    const variant = assignment.variant || {};

    let decor = meta.querySelector(".uai-c-v128-scene-decor");
    if (!decor) {
      decor = document.createElement("span");
      decor.className = "uai-c-v128-scene-decor";
      meta.appendChild(decor);
    }
    const decorSuffix = ["微光", "夜色", "此刻"][Number(variant.decorationIndex || 0) % 3];
    decor.textContent = `${ICONS[theme]} ${LABELS[theme]} · ${decorSuffix}`;

    let note = copy.querySelector(".uai-c-v128-scene-note");
    if (!note) {
      note = document.createElement("div");
      note.className = "uai-c-v128-scene-note";
      const prompts = copy.querySelector(".uai-c-v122-prompts");
      if (prompts) prompts.insertAdjacentElement("beforebegin", note);
      else copy.appendChild(note);
    }
    const list = WELCOME_COPY[theme] || WELCOME_COPY.galaxy;
    note.textContent = list[Number(variant.welcomeIndex || 0) % list.length];
  }

  function applyVariation(root, assignment) {
    if (!root || !assignment) return false;
    const layer = root.querySelector(".uai-c-v127-theme-layer");
    if (!layer) return false;
    const variant = assignment.variant || makeVariant(assignment.seed);
    root.dataset.v128ParticleStyle = String(Number(variant.particleStyle || 0));
    root.style.setProperty("--v128-band-offset", `${Number(variant.bandOffset || 0)}px`);
    root.style.setProperty("--v128-wash-x", `${Number(variant.washX || 0)}px`);
    root.style.setProperty("--v128-wash-y", `${Number(variant.washY || 0)}px`);
    rebuildParticles(root, assignment);
    decorateWelcome(root, assignment);
    return true;
  }

  function scheduleRetry(characterId, delay = 120) {
    clearTimeout(retryTimer);
    retryTimer = 0;
    if (!companionIsVisible()) return;
    retryTimer = window.setTimeout(() => {
      retryTimer = 0;
      if (companionIsVisible()) applyAssignment(characterId, true);
    }, delay);
  }

  function applyAssignment(characterId = activeCharacterId(), force = false) {
    if (!characterId || !companionIsVisible()) {
      clearTimeout(retryTimer);
      retryTimer = 0;
      return;
    }
    const assignment = ensureAssignment(characterId);
    const root = document.getElementById("uaiCompanionRoot");
    const themes = window.UnlimitedCompanionV127Themes;
    if (!assignment || !root || root.hidden || !themes?.setTheme) {
      scheduleRetry(characterId, 120);
      return;
    }

    clearTimeout(retryTimer);
    retryTimer = 0;
    const signature = `${characterId}:${assignment.theme}:${assignment.seed}`;
    const sceneExists = Boolean(root.querySelector(".uai-c-v127-theme-layer"));
    if (!force && signature === lastAppliedSignature && sceneExists && root.dataset.v128CharacterScene === characterId) {
      decorateWelcome(root, assignment);
      return;
    }

    themes.setTheme(assignment.theme, { silent: true });
    root.dataset.v128CharacterScene = characterId;
    root.dataset.v128SceneMode = assignment.mode || "initial";
    requestAnimationFrame(() => {
      if (!companionIsVisible()) return;
      if (!applyVariation(root, assignment)) {
        scheduleRetry(characterId, 80);
        return;
      }
      lastAppliedSignature = signature;
      refreshSettingsControls();
    });
  }

  function setThemeForActive(theme, mode = "manual") {
    const characterId = activeCharacterId();
    if (!characterId || !THEMES.includes(theme)) return null;
    const current = ensureAssignment(characterId);
    const assignment = current?.theme === theme
      ? { ...current, mode, assignedAt: Date.now() }
      : createAssignment(theme, mode);
    saveAssignment(characterId, assignment);
    lastAppliedSignature = "";
    applyAssignment(characterId, true);
    return assignment;
  }

  function shuffleActiveTheme() {
    const characterId = activeCharacterId();
    if (!characterId) return null;
    const current = ensureAssignment(characterId);
    return setThemeForActive(randomDifferentTheme(current?.theme), "shuffled");
  }

  function refreshSettingsControls() {
    const modal = document.querySelector("#uaiCompanionModalMask:not([hidden]) .uai-c-modal");
    const panel = modal?.querySelector("#uaiV128SceneSettings");
    if (!panel) return;
    const assignment = ensureAssignment();
    if (!assignment) return;
    panel.querySelectorAll("[data-v128-theme]").forEach((button) => {
      button.classList.toggle("selected", button.dataset.v128Theme === assignment.theme);
    });
    const current = panel.querySelector("[data-v128-current]");
    if (current) current.textContent = `${ICONS[assignment.theme]} ${LABELS[assignment.theme]}`;
    const hint = panel.querySelector("[data-v128-hint]");
    if (hint) hint.textContent = assignment.mode === "manual" ? "已手动固定到当前角色" : "已保存到当前角色，重新进入不会变化";
  }

  function ensureSceneSettings(modal) {
    if (!modal || modal.querySelector("#uaiV128SceneSettings")) return;
    if (!modal.querySelector("#uaiCompanionModel") || !modal.querySelector("#uaiCompanionReplyLength")) return;
    const assignment = ensureAssignment();
    if (!assignment) return;

    const panel = document.createElement("section");
    panel.id = "uaiV128SceneSettings";
    panel.className = "uai-c-v128-scene-settings";
    panel.innerHTML = `
      <div class="uai-c-v128-scene-head">
        <div><strong>聊天场景</strong><span data-v128-hint>已保存到当前角色，重新进入不会变化</span></div>
        <b data-v128-current></b>
      </div>
      <div class="uai-c-v128-scene-actions">
        <button type="button" class="uai-c-v128-shuffle">↻ 换一个场景</button>
      </div>
      <div class="uai-c-v128-theme-grid">
        ${THEMES.map((theme) => `<button type="button" data-v128-theme="${theme}"><i>${ICONS[theme]}</i><strong>${LABELS[theme]}</strong><span>${theme === "galaxy" ? "星光 / 爱心" : theme === "sakura" ? "夜樱 / 花瓣" : theme === "moonlight" ? "月色 / 尘埃" : "霓虹 / 光粒"}</span></button>`).join("")}
      </div>`;

    const memoryField = modal.querySelector("#uaiCompanionMemoryEnabled")?.closest(".uai-c-field");
    const dataPanel = modal.querySelector("#uaiV9DataPanel");
    if (memoryField) memoryField.insertAdjacentElement("afterend", panel);
    else if (dataPanel) dataPanel.insertAdjacentElement("beforebegin", panel);
    else modal.querySelector(".uai-c-modal-body")?.appendChild(panel);

    panel.querySelector(".uai-c-v128-shuffle")?.addEventListener("click", () => {
      shuffleActiveTheme();
      refreshSettingsControls();
    });
    panel.querySelectorAll("[data-v128-theme]").forEach((button) => {
      button.addEventListener("click", () => {
        setThemeForActive(button.dataset.v128Theme, "manual");
        refreshSettingsControls();
      });
    });
    refreshSettingsControls();
  }

  function enhance() {
    scheduled = false;
    if (!companionIsVisible()) {
      clearTimeout(retryTimer);
      retryTimer = 0;
      return;
    }
    const root = document.getElementById("uaiCompanionRoot");
    const characterId = activeCharacterId();
    if (!characterId) {
      scheduleRetry("", 80);
      return;
    }
    pruneUnknownAssignments();
    root.dataset.v128Phase5 = REVISION;
    applyAssignment(characterId);
    const modal = root.querySelector("#uaiCompanionModalMask:not([hidden]) .uai-c-modal");
    if (modal) ensureSceneSettings(modal);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionV128Phase5Revision = REVISION;
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode", "class"]
    });
    window.addEventListener("storage", (event) => {
      if (event.key === ACTIVE_KEY || event.key === STORAGE_KEY) {
        lastAppliedSignature = "";
        schedule();
      }
    });
    window.UnlimitedCompanionV128Scenes = {
      revision: REVISION,
      storageKey: STORAGE_KEY,
      themes: THEMES.map((id) => ({ id, label: LABELS[id] })),
      get activeCharacterId() { return activeCharacterId(); },
      getAssignment(characterId = activeCharacterId()) { return ensureAssignment(characterId); },
      setTheme: (theme) => setThemeForActive(theme, "manual"),
      shuffle: shuffleActiveTheme,
      refresh: schedule
    };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();