// Companion V12.22 — curated per-character Live2D model pool + migration.
(() => {
  if (window.UnlimitedCompanionLive2DModelPool) return;

  const REVISION = "2026-08-15-v12.22-curated-live2d-pool-1";
  const POOL_URL = "/live2d/model-pool.json";
  const HARU_URL = "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@b1de66b0b1f1cb881d95fb6158622aeb6a2827bd/Samples/Resources/Haru/Haru.model3.json";
  const KEYS = {
    characters: "uai_companion_characters_v1",
    active: "uai_companion_active_character_v1",
    assignments: "uai_companion_live2d_assignments_v1"
  };

  let poolPromise = null;
  let pool = [];
  let scheduled = false;
  let syncing = false;
  let lastUiSignature = "";

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function readAssignments() {
    const value = safeParse(localStorage.getItem(KEYS.assignments), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function characters() {
    const apiList = window.UnlimitedCompanionMulti?.getCharacters?.();
    if (Array.isArray(apiList) && apiList.length) return apiList;
    const stored = safeParse(localStorage.getItem(KEYS.characters), []);
    return Array.isArray(stored) ? stored.filter((item) => item?.id && item?.profile) : [];
  }

  function activeCharacterId() {
    return window.UnlimitedCompanionMulti?.activeCharacterId || localStorage.getItem(KEYS.active) || characters()[0]?.id || "";
  }

  function activeCharacter() {
    const id = activeCharacterId();
    return characters().find((item) => String(item?.id) === String(id)) || null;
  }

  async function loadPool() {
    if (poolPromise) return poolPromise;
    poolPromise = fetch(`${POOL_URL}?v=${encodeURIComponent(REVISION)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`model pool ${response.status}`);
        const json = await response.json();
        const models = Array.isArray(json?.models) ? json.models : [];
        pool = models.filter((item) => item?.id && item?.model).map((item) => ({
          ...item,
          id: String(item.id),
          label: String(item.label || item.id),
          catalogNo: Number(item.catalogNo) || 0,
          autoEligible: item.autoEligible !== false,
          position: item.position && typeof item.position === "object" ? item.position : {},
          tapMotionGroups: Array.isArray(item.tapMotionGroups) ? item.tapMotionGroups : ["TapBody"]
        }));
        return pool;
      })
      .catch((error) => {
        console.warn("[Unlimited AI] Live2D model pool unavailable:", error);
        pool = [];
        return pool;
      });
    return poolPromise;
  }

  function byId(id) {
    return pool.find((item) => item.id === String(id || "")) || null;
  }

  function automaticPool() {
    const eligible = pool.filter((item) => item.autoEligible !== false);
    return eligible.length ? eligible : pool;
  }

  function hash(value) {
    let result = 2166136261;
    for (const char of String(value || "")) {
      result ^= char.codePointAt(0);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  function specFromModel(model, marker = {}) {
    return {
      ...marker,
      model: model.model,
      idleMotionGroup: model.idleMotionGroup || "Idle",
      tapMotionGroups: model.tapMotionGroups || ["TapBody"],
      position: { ...(model.position || {}) },
      sample: model.sample ? { ...model.sample } : null
    };
  }

  function poolIdFromAssignment(value) {
    return String(value?.autoPoolId || value?.poolManualId || "");
  }

  function chooseLeastUsed(character, counts) {
    const candidatesPool = automaticPool();
    if (!candidatesPool.length) return null;
    const minimum = Math.min(...candidatesPool.map((item) => counts[item.id] || 0));
    const candidates = candidatesPool.filter((item) => (counts[item.id] || 0) === minimum);
    return candidates[hash(character?.id || character?.profile?.name) % candidates.length] || candidates[0] || candidatesPool[0];
  }

  function assignmentMatchesModel(assignment, model, marker) {
    return assignment?.model === model?.model
      && String(assignment?.[marker] || "") === model?.id
      && Number(assignment?.position?.x) === Number(model?.position?.x)
      && Number(assignment?.position?.y) === Number(model?.position?.y)
      && Number(assignment?.position?.height) === Number(model?.position?.height);
  }

  function migrateRetiredAssignments(assignments) {
    const shizuku = byId("shizuku");
    let changed = false;
    for (const [id, assignment] of Object.entries(assignments)) {
      if (!assignment || typeof assignment !== "object") continue;
      const wasHaru = assignment.poolManualId === "haru"
        || assignment.autoPoolId === "haru"
        || assignment.model === HARU_URL;
      if (!wasHaru) continue;

      // Explicit Haru choices become the requested replacement: Shizuku.
      if (assignment.poolManualId === "haru" && shizuku) {
        assignments[id] = specFromModel(shizuku, {
          poolManualId: "shizuku",
          poolManualRevision: REVISION,
          migratedFrom: "haru"
        });
      } else {
        // Old automatic Haru slots return to automatic allocation. This avoids
        // silently assigning a special-terms character to an arbitrary role.
        delete assignments[id];
      }
      changed = true;
    }
    return changed;
  }

  async function syncAssignments() {
    if (syncing) return false;
    syncing = true;
    try {
      await loadPool();
      if (!pool.length) return false;
      const list = characters();
      if (!list.length) return false;
      const currentIds = new Set(list.map((item) => String(item.id)));
      const assignments = readAssignments();
      const before = JSON.stringify(assignments);
      migrateRetiredAssignments(assignments);
      const counts = Object.fromEntries(pool.map((item) => [item.id, 0]));

      // Existing valid pool assignments are counted first. Custom URLs remain manual.
      for (const character of list) {
        const assigned = assignments[character.id];
        const poolId = poolIdFromAssignment(assigned);
        if (poolId && byId(poolId)) counts[poolId] += 1;
      }

      // 李萌 keeps Mao by default; the other automatic roles use the least-used
      // normal-license pool so up to six roles can stay visually distinct.
      const mao = byId("mao") || automaticPool()[0] || pool[0];
      for (const character of list) {
        const id = String(character.id);
        const name = String(character?.profile?.name || "").trim();
        const existing = assignments[id];
        const existingPoolId = poolIdFromAssignment(existing);
        const alreadyCounted = Boolean(existingPoolId && byId(existingPoolId));
        const isManual = Boolean(existing && !existing.autoPoolId);
        if (isManual) continue;

        let selected = existing?.autoPoolId ? byId(existing.autoPoolId) : null;
        if (selected && selected.autoEligible === false) selected = null;
        if (name === "李萌") selected = mao;
        if (!selected) selected = chooseLeastUsed(character, counts);
        if (!selected) continue;
        if (!alreadyCounted) counts[selected.id] = (counts[selected.id] || 0) + 1;

        if (!assignmentMatchesModel(existing, selected, "autoPoolId")) {
          assignments[id] = specFromModel(selected, { autoPoolId: selected.id, autoPoolRevision: REVISION });
        }
      }

      // Remove only stale auto-generated entries for roles that were deleted.
      for (const [id, assignment] of Object.entries(assignments)) {
        if (!currentIds.has(id) && assignment?.autoPoolId) delete assignments[id];
      }

      const after = JSON.stringify(assignments);
      if (after !== before) {
        localStorage.setItem(KEYS.assignments, after);
        window.UnlimitedCompanionLive2D?.refresh?.();
        window.UnlimitedCompanionLive2DEmotionEngine?.refresh?.();
      }
      return after !== before;
    } finally {
      syncing = false;
    }
  }

  async function setManualModel(characterId, modelId) {
    await loadPool();
    const model = byId(modelId);
    const id = String(characterId || activeCharacterId()).trim();
    if (!id || !model) return false;
    const assignments = readAssignments();
    assignments[id] = specFromModel(model, { poolManualId: model.id, poolManualRevision: REVISION });
    localStorage.setItem(KEYS.assignments, JSON.stringify(assignments));
    window.UnlimitedCompanionLive2D?.refresh?.();
    window.UnlimitedCompanionLive2DEmotionEngine?.refresh?.();
    schedule();
    return true;
  }

  async function setAuto(characterId) {
    await loadPool();
    const id = String(characterId || activeCharacterId()).trim();
    if (!id) return false;
    const assignments = readAssignments();
    delete assignments[id];
    localStorage.setItem(KEYS.assignments, JSON.stringify(assignments));
    await syncAssignments();
    window.UnlimitedCompanionLive2D?.refresh?.();
    window.UnlimitedCompanionLive2DEmotionEngine?.refresh?.();
    schedule();
    return true;
  }

  function currentAssignment() {
    const character = activeCharacter();
    if (!character) return null;
    const assignment = readAssignments()[character.id] || null;
    const modelId = poolIdFromAssignment(assignment);
    return { character, assignment, model: byId(modelId), automatic: Boolean(assignment?.autoPoolId) };
  }

  function optionLabel(item) {
    const number = item.catalogNo ? `${item.catalogNo}. ` : "";
    const restriction = item.autoEligible === false ? " · 特殊条款" : "";
    return `${number}${item.label}${restriction}`;
  }

  function ensureUi() {
    const root = document.getElementById("uaiCompanionRoot");
    if (!root || root.hidden || document.body.dataset.uaiMode !== "companion") return;
    const host = root.querySelector("#uaiCompanionV17CallPanel");
    if (!host || !pool.length) return;
    let panel = host.querySelector("#uaiCompanionV21ModelPoolPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "uaiCompanionV21ModelPoolPanel";
      panel.className = "uai-c-v21-model-pool";
      panel.innerHTML = `
        <div class="uai-c-v21-head"><div><strong>角色外观模型</strong><span>当前精选 8 个 Live2D；自动模式优先让不同角色不撞脸</span></div><em>V12.22</em></div>
        <div class="uai-c-v21-row"><select data-v21-model aria-label="角色 Live2D 模型"><option value="auto">自动分配</option>${pool.map((item) => `<option value="${item.id}">${optionLabel(item)}</option>`).join("")}</select><button type="button" data-v21-reassign>重新分配</button></div>
        <div class="uai-c-v21-status" data-v21-status></div>
        <small>Shizuku / Tsumiki 带特殊角色条款，因此保留为手动选择；其他模型参与自动分配。</small>`;
      const modelBlock = host.querySelector(".uai-c-v17-model");
      if (modelBlock) modelBlock.insertAdjacentElement("beforebegin", panel); else host.appendChild(panel);
      panel.querySelector("[data-v21-model]")?.addEventListener("change", async (event) => {
        const value = String(event.target.value || "auto");
        if (value === "auto") await setAuto(); else await setManualModel(activeCharacterId(), value);
      });
      panel.querySelector("[data-v21-reassign]")?.addEventListener("click", () => setAuto());
    }
    renderUi(panel);
  }

  function renderUi(panel) {
    const current = currentAssignment();
    if (!panel || !current) return;
    const modelId = current.model?.id || "";
    const signature = `${current.character.id}|${modelId}|${current.automatic}|${current.assignment?.model || ""}`;
    if (signature === lastUiSignature && panel.dataset.ready === "1") return;
    lastUiSignature = signature;
    panel.dataset.ready = "1";
    const select = panel.querySelector("[data-v21-model]");
    if (select) select.value = current.automatic ? "auto" : (current.assignment?.poolManualId || "auto");
    const status = panel.querySelector("[data-v21-status]");
    const label = current.model?.label || current.assignment?.sample?.name || "自定义模型";
    const catalog = current.model?.catalogNo ? ` · #${current.model.catalogNo}` : "";
    if (status) status.textContent = `当前：${label}${catalog}${current.automatic ? " · 自动分配" : " · 手动选择"}`;
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(async () => {
      scheduled = false;
      await syncAssignments();
      ensureUi();
    });
  }

  async function init() {
    document.documentElement.dataset.companionLive2dModelPoolRevision = REVISION;
    await loadPool();
    await syncAssignments();
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "class", "data-uai-mode", "data-v129-live2d-character"]
    });
    window.addEventListener("storage", (event) => {
      if ([KEYS.characters, KEYS.active, KEYS.assignments].includes(event.key)) schedule();
    });
    window.UnlimitedCompanionLive2DModelPool = {
      revision: REVISION,
      getModels: () => pool.map((item) => ({ ...item, position: { ...item.position }, sample: item.sample ? { ...item.sample } : null })),
      getCurrent: currentAssignment,
      sync: syncAssignments,
      setAuto,
      setModel: setManualModel,
      refresh: schedule
    };
    ensureUi();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
