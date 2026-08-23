// V17.14 isolated companion scene layer. Restores atmosphere without reviving V12 structural layouts.
(() => {
  const REVISION = "2026-08-23-v17.14-safe-scene-restore";
  if (window.UnlimitedCompanionSceneV1714) return;

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

  let activeMain = null;
  let pointerBoundMain = null;

  function root() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const host = document.getElementById("uaiCompanionRoot");
    return host && !host.hidden && host.isConnected ? host : null;
  }

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function activeCharacterId() {
    return window.UnlimitedCompanionMulti?.activeCharacterId || localStorage.getItem(ACTIVE_KEY) || "legacy";
  }

  function readMap() {
    const value = safeParse(localStorage.getItem(STORAGE_KEY), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function hashSeed(text) {
    let value = 2166136261;
    for (const ch of String(text || "legacy")) {
      value ^= ch.charCodeAt(0);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function normalizeAssignment(value, characterId) {
    const fallbackIndex = hashSeed(characterId) % THEMES.length;
    const theme = THEMES.includes(value?.theme) ? value.theme : THEMES[fallbackIndex];
    return {
      theme,
      seed: Number(value?.seed) || hashSeed(`${characterId}:${theme}`),
      mode: value?.mode || "automatic",
      assignedAt: Number(value?.assignedAt) || Date.now()
    };
  }

  function getAssignment(characterId = activeCharacterId()) {
    const map = readMap();
    const normalized = normalizeAssignment(map[characterId], characterId);
    if (!map[characterId] || map[characterId].theme !== normalized.theme) {
      map[characterId] = normalized;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    }
    return normalized;
  }

  function saveAssignment(theme, mode = "manual") {
    if (!THEMES.includes(theme)) return null;
    const id = activeCharacterId();
    const map = readMap();
    const previous = normalizeAssignment(map[id], id);
    const next = {
      ...previous,
      theme,
      seed: previous.theme === theme ? previous.seed : hashSeed(`${id}:${theme}:${Date.now()}`),
      mode,
      assignedAt: Date.now()
    };
    map[id] = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    apply(next);
    return next;
  }

  function rng(seed) {
    let state = Number(seed) >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function ensureLayer(host) {
    const main = host?.querySelector(".uai-c-main");
    if (!main) return null;
    activeMain = main;
    let layer = main.querySelector(":scope > .uai-c-v1714-scene");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "uai-c-v1714-scene";
      layer.setAttribute("aria-hidden", "true");
      layer.innerHTML = `
        <div class="uai-c-v1714-base"></div>
        <div class="uai-c-v1714-wash"></div>
        <div class="uai-c-v1714-band"></div>
        <div class="uai-c-v1714-accent"></div>
        <div class="uai-c-v1714-particles"></div>
        <div class="uai-c-v1714-vignette"></div>`;
      main.prepend(layer);
    }
    bindParallax(main);
    return layer;
  }

  function bindParallax(main) {
    if (!main || pointerBoundMain === main) return;
    pointerBoundMain = main;
    main.addEventListener("pointermove", (event) => {
      const rect = main.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = ((event.clientX - rect.left) / rect.width - .5) * 12;
      const y = ((event.clientY - rect.top) / rect.height - .5) * 9;
      main.style.setProperty("--v1714-scene-x", `${x.toFixed(2)}px`);
      main.style.setProperty("--v1714-scene-y", `${y.toFixed(2)}px`);
    }, { passive: true });
    main.addEventListener("pointerleave", () => {
      main.style.setProperty("--v1714-scene-x", "0px");
      main.style.setProperty("--v1714-scene-y", "0px");
    }, { passive: true });
  }

  function buildParticles(layer, assignment) {
    const host = layer?.querySelector(".uai-c-v1714-particles");
    if (!host) return;
    const random = rng(assignment.seed);
    const theme = assignment.theme;
    const counts = { galaxy: 38, sakura: 30, moonlight: 34, neon: 28 };
    const count = counts[theme] || 32;
    host.replaceChildren();
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement("i");
      particle.style.setProperty("--x", `${(2 + random() * 96).toFixed(2)}%`);
      particle.style.setProperty("--y", `${(-8 + random() * 108).toFixed(2)}%`);
      particle.style.setProperty("--delay", `${(-random() * 12).toFixed(2)}s`);
      particle.style.setProperty("--duration", `${(7 + random() * 9).toFixed(2)}s`);
      particle.style.setProperty("--drift", `${(-48 + random() * 96).toFixed(1)}px`);
      particle.style.setProperty("--size", `${(2 + random() * 7).toFixed(1)}px`);
      particle.dataset.kind = theme;
      if (theme === "galaxy") particle.textContent = index % 7 === 0 ? "✦" : index % 5 === 0 ? "♡" : "";
      if (theme === "sakura") particle.textContent = "✿";
      host.appendChild(particle);
    }
  }

  function ensureButton(host) {
    const header = host?.querySelector(".uai-c-header");
    if (!header) return null;
    let button = header.querySelector("#uaiCompanionSceneButtonV1714");
    if (!button) {
      button = document.createElement("button");
      button.id = "uaiCompanionSceneButtonV1714";
      button.className = "uai-c-v1714-scene-button";
      button.type = "button";
      button.title = "切换陪伴场景";
      button.addEventListener("click", cycle);
      header.appendChild(button);
    }
    return button;
  }

  function apply(assignment = getAssignment()) {
    const host = root();
    if (!host) return false;
    const scene = ensureLayer(host);
    if (!scene) return false;
    const value = normalizeAssignment(assignment, activeCharacterId());
    host.dataset.v1714SceneTheme = value.theme;
    host.dataset.v1714SceneRevision = REVISION;
    document.documentElement.dataset.companionSceneV1714 = value.theme;
    buildParticles(scene, value);
    const button = ensureButton(host);
    if (button) button.innerHTML = `<span>${ICONS[value.theme]}</span><b>场景</b><small>${LABELS[value.theme]}</small>`;
    host.dispatchEvent(new CustomEvent("uai:companion-scene-changed", {
      bubbles: false,
      detail: { theme: value.theme, label: LABELS[value.theme], revision: REVISION }
    }));
    return true;
  }

  function cycle() {
    const current = getAssignment();
    const index = THEMES.indexOf(current.theme);
    return saveAssignment(THEMES[(index + 1) % THEMES.length], "manual");
  }

  function setTheme(theme) {
    return saveAssignment(String(theme || ""), "manual");
  }

  function refresh() {
    const host = root();
    if (!host) return false;
    ensureButton(host);
    return apply(getAssignment());
  }

  window.addEventListener("uai:companion-core-entered", refresh);
  window.addEventListener("uai:companion-functions-ready", refresh);
  window.addEventListener("uai:mode-refresh", refresh);
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === ACTIVE_KEY) refresh();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });

  document.documentElement.dataset.companionSceneV1714Revision = REVISION;
  window.UnlimitedCompanionSceneV1714 = {
    revision: REVISION,
    themes: THEMES.map((id) => ({ id, label: LABELS[id] })),
    getAssignment,
    setTheme,
    cycle,
    refresh,
    get currentTheme() { return root()?.dataset.v1714SceneTheme || getAssignment().theme; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
})();