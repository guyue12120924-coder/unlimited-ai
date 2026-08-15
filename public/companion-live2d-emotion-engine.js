// Companion V12.20 — adaptive Live2D capability scanner and emotion mapping.
(() => {
  if (window.UnlimitedCompanionLive2DEmotionEngine) return;

  const REVISION = "2026-08-15-v12.20-live2d-emotion-engine-1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  const MAP_KEY = "uai_companion_live2d_emotion_map_v1";
  const EMOTIONS = ["normal", "happy", "shy", "caring", "sad", "angry", "thinking"];
  const LABELS = {
    normal: "自然",
    happy: "开心",
    shy: "害羞",
    caring: "关心",
    sad: "难过",
    angry: "生气",
    thinking: "思考"
  };
  const EXPRESSION_HINTS = {
    normal: ["default", "normal", "neutral", "idle", "base"],
    happy: ["happy", "smile", "joy", "laugh", "cheer", "grin"],
    shy: ["shy", "blush", "embarrass", "bashful", "fluster"],
    caring: ["love", "gentle", "soft", "warm", "care", "heart", "smile"],
    sad: ["sad", "sorrow", "cry", "down", "depress", "tear"],
    angry: ["angry", "mad", "rage", "frown", "upset", "annoy"],
    thinking: ["think", "serious", "ponder", "doubt", "question", "focus"]
  };
  const MOTION_HINTS = {
    normal: ["idle", "normal", "default"],
    happy: ["happy", "joy", "laugh", "cheer", "tapbody", "touch"],
    shy: ["shy", "blush", "embarrass", "tapbody", "touch"],
    caring: ["love", "gentle", "heart", "care", "tapbody", "touch"],
    sad: ["sad", "cry", "down", "tapbody"],
    angry: ["angry", "mad", "rage", "tapbody"],
    thinking: ["think", "ponder", "idle", "tapbody"]
  };
  const FALLBACK_EXPRESSION_SLOT = {
    normal: 0,
    happy: 1,
    shy: 2,
    caring: 3,
    sad: 4,
    angry: 5,
    thinking: 6
  };
  const FALLBACK_MOTION_SLOT = {
    happy: 0,
    shy: 1,
    caring: 2,
    sad: 3,
    angry: 4,
    thinking: 5
  };

  let patchedApi = null;
  let originalSetEmotion = null;
  let scheduled = false;
  let observer = null;
  let lastSignature = "";

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function liveRoot() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const root = document.getElementById("uaiCompanionRoot");
    return root && !root.hidden && root.isConnected ? root : null;
  }

  function activeCharacterId() {
    return window.UnlimitedCompanionMulti?.activeCharacterId || localStorage.getItem(ACTIVE_KEY) || "legacy";
  }

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim();
  }

  function expressionsFromModel(model) {
    const settings = model?.internalModel?.settings;
    const raw = settings?.expressions;
    if (Array.isArray(raw)) {
      return raw.map((item, index) => ({
        name: String(item?.Name || item?.name || `expression_${index}`),
        file: String(item?.File || item?.file || ""),
        index
      }));
    }
    if (raw && typeof raw === "object") {
      return Object.entries(raw).map(([name, item], index) => ({
        name: String(name),
        file: String(item?.File || item?.file || item || ""),
        index
      }));
    }
    return [];
  }

  function motionsFromModel(model) {
    const definitions = model?.internalModel?.motionManager?.definitions || model?.internalModel?.settings?.motions || {};
    if (!definitions || typeof definitions !== "object") return [];
    return Object.entries(definitions).map(([group, entries]) => ({
      group: String(group),
      count: Array.isArray(entries) ? entries.length : 0,
      files: Array.isArray(entries) ? entries.map((item) => String(item?.File || item?.file || "")).filter(Boolean) : []
    }));
  }

  function lipSyncIds(model) {
    const apiIds = window.UnlimitedCompanionLive2D?.getLipSyncStatus?.()?.ids;
    if (Array.isArray(apiIds) && apiIds.length) return [...new Set(apiIds.map(String))];
    const ids = [];
    try { ids.push(...(model?.internalModel?.motionManager?.lipSyncIds || [])); } catch {}
    try { ids.push(...(model?.internalModel?.settings?.getLipSyncParameters?.() || [])); } catch {}
    return [...new Set(ids.map(String).filter(Boolean))];
  }

  function capabilities() {
    const api = window.UnlimitedCompanionLive2D;
    const model = api?.getModel?.() || null;
    const status = api?.getStatus?.() || {};
    const expressions = expressionsFromModel(model);
    const motions = motionsFromModel(model);
    const lips = lipSyncIds(model);
    const modelUrl = String(status.modelUrl || "");
    const signature = [
      activeCharacterId(),
      modelUrl,
      expressions.map((item) => `${item.name}:${item.file}`).join("|"),
      motions.map((item) => `${item.group}:${item.count}`).join("|"),
      lips.join("|")
    ].join("::");
    return {
      ready: Boolean(model && status.state === "ready"),
      state: String(status.state || "idle"),
      modelUrl,
      expressions,
      motions,
      lipSyncIds: lips,
      signature
    };
  }

  function scoreCandidate(text, hints) {
    const value = normalize(text);
    if (!value) return 0;
    let score = 0;
    for (const hint of hints) {
      if (value === hint) score += 12;
      else if (value.startsWith(hint)) score += 7;
      else if (value.includes(hint)) score += 4;
    }
    return score;
  }

  function bestExpression(emotion, list, used) {
    const hints = EXPRESSION_HINTS[emotion] || [];
    let best = null;
    let bestScore = 0;
    for (const item of list) {
      const score = scoreCandidate(`${item.name} ${item.file}`, hints);
      if (score > bestScore && !used.has(item.name)) {
        best = item;
        bestScore = score;
      }
    }
    if (best) return { item: best, semantic: true };
    if (!list.length) return { item: null, semantic: false };
    const slot = FALLBACK_EXPRESSION_SLOT[emotion] ?? 0;
    const preferred = list[Math.min(slot, list.length - 1)];
    if (preferred && !used.has(preferred.name)) return { item: preferred, semantic: false };
    const unused = list.find((item) => !used.has(item.name));
    return { item: unused || preferred || list[0], semantic: false };
  }

  function bestMotion(emotion, list) {
    const hints = MOTION_HINTS[emotion] || [];
    let best = null;
    let bestScore = 0;
    for (const item of list) {
      const score = scoreCandidate(`${item.group} ${item.files.join(" ")}`, hints);
      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    }
    if (!best) {
      if (emotion === "normal") best = list.find((item) => /idle/i.test(item.group)) || list[0] || null;
      else best = list.find((item) => /tapbody|touch|tap/i.test(item.group)) || list.find((item) => !/idle/i.test(item.group)) || list[0] || null;
    }
    if (!best) return null;
    const requested = emotion === "normal" ? 0 : (FALLBACK_MOTION_SLOT[emotion] ?? 0);
    const index = best.count > 0 ? requested % best.count : undefined;
    return { group: best.group, index, semantic: bestScore > 0 };
  }

  function buildAutoMapping(info = capabilities()) {
    const usedExpressions = new Set();
    const emotions = {};
    for (const emotion of EMOTIONS) {
      const expressionChoice = bestExpression(emotion, info.expressions, usedExpressions);
      if (expressionChoice.item) usedExpressions.add(expressionChoice.item.name);
      const motionChoice = bestMotion(emotion, info.motions);
      emotions[emotion] = {
        expression: expressionChoice.item?.name || "",
        expressionFile: expressionChoice.item?.file || "",
        motionGroup: motionChoice?.group || "",
        motionIndex: Number.isInteger(motionChoice?.index) ? motionChoice.index : null,
        semanticExpression: Boolean(expressionChoice.semantic),
        semanticMotion: Boolean(motionChoice?.semantic)
      };
    }
    return {
      version: 1,
      characterId: activeCharacterId(),
      modelUrl: info.modelUrl,
      signature: info.signature,
      generatedAt: Date.now(),
      source: "auto",
      lipSyncIds: info.lipSyncIds,
      emotions
    };
  }

  function readMapStore() {
    const value = safeParse(localStorage.getItem(MAP_KEY), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function writeMapping(mapping) {
    const store = readMapStore();
    store[activeCharacterId()] = mapping;
    localStorage.setItem(MAP_KEY, JSON.stringify(store));
    return mapping;
  }

  function getMapping(options = {}) {
    const info = capabilities();
    const stored = readMapStore()[activeCharacterId()];
    const stale = !stored || stored.signature !== info.signature || stored.modelUrl !== info.modelUrl;
    if (options.rebuild || stale) return writeMapping(buildAutoMapping(info));
    return stored;
  }

  function setMapping(mapping) {
    if (!mapping || typeof mapping !== "object") return false;
    const info = capabilities();
    const next = {
      ...buildAutoMapping(info),
      ...mapping,
      version: 1,
      characterId: activeCharacterId(),
      modelUrl: info.modelUrl,
      signature: info.signature,
      generatedAt: Date.now(),
      source: "custom",
      emotions: { ...buildAutoMapping(info).emotions, ...(mapping.emotions || {}) }
    };
    writeMapping(next);
    schedule();
    return true;
  }

  async function applyMappedEmotion(emotion = "normal", options = {}) {
    const key = EMOTIONS.includes(String(emotion)) ? String(emotion) : "normal";
    const api = window.UnlimitedCompanionLive2D;
    if (!api?.getModel?.()) return false;
    const mapping = getMapping();
    const rule = mapping?.emotions?.[key];
    if (!rule) return false;

    let changed = false;
    if (rule.expression && typeof api.setExpression === "function") {
      try { changed = Boolean(await api.setExpression(rule.expression)) || changed; } catch {}
    }
    if (rule.motionGroup && typeof api.playMotion === "function") {
      try {
        const index = Number.isInteger(rule.motionIndex) ? rule.motionIndex : undefined;
        changed = Boolean(await api.playMotion(rule.motionGroup, index)) || changed;
      } catch {}
    }
    const root = liveRoot();
    if (root) {
      root.dataset.v120EmotionMapped = key;
      root.dataset.v120EmotionExpression = String(rule.expression || "");
      root.dataset.v120EmotionMotion = String(rule.motionGroup || "");
    }
    if (!changed && options.fallback !== false && originalSetEmotion) {
      try { changed = Boolean(await originalSetEmotion(key)) || changed; } catch {}
    }
    return changed;
  }

  function patchEmotionApi() {
    const api = window.UnlimitedCompanionLive2D;
    if (!api?.setEmotion) return false;
    if (patchedApi === api && api.__v120EmotionPatched) return true;
    patchedApi = api;
    originalSetEmotion = api.setEmotion.bind(api);
    api.setEmotion = (emotion) => applyMappedEmotion(emotion, { fallback: true });
    api.__v120EmotionPatched = true;
    return true;
  }

  function exportMapping() {
    return JSON.stringify(getMapping(), null, 2);
  }

  async function copyMapping() {
    const text = exportMapping();
    try {
      await navigator.clipboard?.writeText?.(text);
      return true;
    } catch {
      return false;
    }
  }

  function mappingSummary(mapping = getMapping()) {
    return EMOTIONS.map((emotion) => {
      const rule = mapping?.emotions?.[emotion] || {};
      const expression = rule.expression || "—";
      const motion = rule.motionGroup ? `${rule.motionGroup}${Number.isInteger(rule.motionIndex) ? `#${rule.motionIndex}` : ""}` : "—";
      return `${LABELS[emotion]}：${expression} / ${motion}`;
    }).join("\n");
  }

  function ensureUi(root) {
    const host = root.querySelector("#uaiCompanionV19PolishPanel") || root.querySelector("#uaiCompanionV17CallPanel");
    if (!host) return;
    let panel = host.querySelector("#uaiCompanionV20EmotionPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "uaiCompanionV20EmotionPanel";
      panel.className = "uai-c-v20-emotion-panel";
      panel.innerHTML = `
        <div class="uai-c-v20-head"><div><strong>模型情绪自动映射</strong><span>自动扫描当前模型表情/动作；换模型后自动重建</span></div><em>V12.20</em></div>
        <div class="uai-c-v20-preview">${EMOTIONS.map((emotion) => `<button type="button" data-v20-emotion="${emotion}">${LABELS[emotion]}</button>`).join("")}</div>
        <pre data-v20-map-summary></pre>
        <div class="uai-c-v20-actions"><button type="button" data-v20-rebuild>重新扫描并生成</button><button type="button" data-v20-copy>复制映射配置</button><small data-v20-status></small></div>`;
      host.appendChild(panel);
      panel.querySelectorAll("[data-v20-emotion]").forEach((button) => {
        button.addEventListener("click", async () => {
          const emotion = String(button.dataset.v20Emotion || "normal");
          const status = panel.querySelector("[data-v20-status]");
          if (status) status.textContent = `正在预览：${LABELS[emotion]}`;
          await applyMappedEmotion(emotion, { fallback: true });
          if (status) status.textContent = `${LABELS[emotion]} 已应用到当前模型`;
        });
      });
      panel.querySelector("[data-v20-rebuild]")?.addEventListener("click", () => {
        getMapping({ rebuild: true });
        renderUi(panel, true);
      });
      panel.querySelector("[data-v20-copy]")?.addEventListener("click", async () => {
        const status = panel.querySelector("[data-v20-status]");
        const copied = await copyMapping();
        if (status) status.textContent = copied ? "映射配置已复制" : "浏览器未允许复制；配置仍已自动保存";
      });
    }
    renderUi(panel);
  }

  function renderUi(panel, force = false) {
    if (!panel) return;
    const info = capabilities();
    const mapping = getMapping({ rebuild: force });
    const summary = panel.querySelector("[data-v20-map-summary]");
    const text = mappingSummary(mapping);
    if (summary && summary.textContent !== text) summary.textContent = text;
    const status = panel.querySelector("[data-v20-status]");
    if (status && !status.textContent) {
      status.textContent = info.ready
        ? `已扫描：${info.expressions.length} 个表情 · ${info.motions.length} 个动作组 · 嘴型 ${info.lipSyncIds.join(", ") || "未识别"}`
        : `模型状态：${info.state}`;
    }
  }

  function sync() {
    scheduled = false;
    const root = liveRoot();
    if (!root) return;
    patchEmotionApi();
    const info = capabilities();
    if (info.ready && info.signature && info.signature !== lastSignature) {
      lastSignature = info.signature;
      getMapping({ rebuild: true });
      root.dataset.v120EmotionEngine = "ready";
      root.dataset.v120EmotionSignature = info.signature.slice(0, 160);
    }
    ensureUi(root);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  function init() {
    document.documentElement.dataset.companionLive2dEmotionRevision = REVISION;
    observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "class", "data-uai-mode", "data-v129-live2d-status", "data-v129-live2d-character"]
    });
    window.addEventListener("storage", (event) => {
      if ([ACTIVE_KEY, MAP_KEY, "uai_companion_live2d_assignments_v1"].includes(event.key)) schedule();
    });
    window.UnlimitedCompanionLive2DEmotionEngine = {
      revision: REVISION,
      emotions: [...EMOTIONS],
      labels: { ...LABELS },
      getCapabilities: capabilities,
      getMapping,
      rebuild: () => getMapping({ rebuild: true }),
      setMapping,
      applyEmotion: applyMappedEmotion,
      previewEmotion: applyMappedEmotion,
      exportMapping,
      copyMapping,
      refresh: schedule
    };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
