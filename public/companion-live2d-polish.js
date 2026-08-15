// Companion V12.19 — Live2D diagnostics, lip-sync tuning and call barge-in polish.
(() => {
  if (window.UnlimitedCompanionLive2DPolish) return;

  const REVISION = "2026-08-15-v12.19-live2d-polish-1";
  const KEY = "uai_companion_live2d_polish_v1";
  const ACTIVE_KEY = "uai_companion_active_character_v1";
  const DEFAULTS = { mouthSensitivity: 1.15 };
  const VOICE_PRESETS = {
    ara: "温柔",
    eve: "活泼",
    sal: "自然",
    rex: "沉稳",
    leo: "成熟"
  };

  let observer = null;
  let scheduled = false;
  let patchedApi = null;
  let originalSetMouthOpen = null;
  let testRaf = 0;
  let testToken = 0;
  let lastDiagnosticSignature = "";

  function liveRoot() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const root = document.getElementById("uaiCompanionRoot");
    return root && !root.hidden && root.isConnected ? root : null;
  }

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function activeCharacterId() {
    return window.UnlimitedCompanionMulti?.activeCharacterId || localStorage.getItem(ACTIVE_KEY) || "legacy";
  }

  function readMap() {
    const value = safeParse(localStorage.getItem(KEY), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function getSettings() {
    const value = readMap()[activeCharacterId()];
    const merged = { ...DEFAULTS, ...(value && typeof value === "object" ? value : {}) };
    merged.mouthSensitivity = Math.max(.65, Math.min(1.8, Number(merged.mouthSensitivity) || DEFAULTS.mouthSensitivity));
    return merged;
  }

  function saveSettings(patch = {}) {
    const map = readMap();
    const id = activeCharacterId();
    const next = { ...getSettings(), ...patch };
    next.mouthSensitivity = Math.max(.65, Math.min(1.8, Number(next.mouthSensitivity) || DEFAULTS.mouthSensitivity));
    map[id] = next;
    localStorage.setItem(KEY, JSON.stringify(map));
    schedule();
    return next;
  }

  function patchLipSyncApi() {
    const api = window.UnlimitedCompanionLive2D;
    if (!api?.setMouthOpen) return false;
    if (patchedApi === api && api.__v19MouthPatched) return true;

    patchedApi = api;
    originalSetMouthOpen = api.setMouthOpen.bind(api);
    api.setMouthOpen = (value) => {
      const raw = Math.max(0, Math.min(1, Number(value) || 0));
      const sensitivity = getSettings().mouthSensitivity;
      const boosted = raw <= 0 ? 0 : Math.max(0, Math.min(1, Math.pow(raw, .90) * sensitivity));
      return originalSetMouthOpen(boosted);
    };
    api.__v19MouthPatched = true;
    return true;
  }

  function asStrings(value) {
    if (!value) return [];
    try { return Array.from(value).map((item) => String(item)).filter(Boolean); }
    catch { return []; }
  }

  function diagnostics() {
    const root = liveRoot();
    const api = window.UnlimitedCompanionLive2D;
    const status = api?.getStatus?.() || {};
    const model = api?.getModel?.() || null;
    const internal = model?.internalModel;
    const lips = [];
    lips.push(...asStrings(internal?.motionManager?.lipSyncIds));
    try { lips.push(...asStrings(internal?.settings?.getLipSyncParameters?.())); } catch {}
    const datasetLips = String(root?.dataset?.v129Live2dLipSync || "").split(",").map((v) => v.trim()).filter(Boolean);
    lips.push(...datasetLips);

    const motionGroups = Object.keys(internal?.motionManager?.definitions || internal?.settings?.motions || {});
    const expressions = internal?.settings?.expressions;
    const expressionNames = Array.isArray(expressions)
      ? expressions.map((item) => String(item?.Name || item?.name || "")).filter(Boolean)
      : Object.keys(expressions || {});
    const lipSyncIds = [...new Set(lips)];
    return {
      ready: Boolean(model && (status.state === "ready" || root?.classList.contains("uai-c-live2d-active"))),
      state: String(status.state || "idle"),
      modelUrl: String(status.modelUrl || ""),
      lipSyncIds,
      motionGroups,
      expressionNames,
      expressionCount: expressionNames.length,
      mouthSensitivity: getSettings().mouthSensitivity
    };
  }

  function diagnosticText(info = diagnostics()) {
    if (!info.ready) return `模型状态：${info.state || "未加载"}`;
    const lip = info.lipSyncIds.length ? info.lipSyncIds.join(", ") : "未识别";
    const motions = info.motionGroups.length ? info.motionGroups.join(", ") : "未识别";
    return `嘴型：${lip} · 动作组：${motions} · 表情：${info.expressionCount}`;
  }

  function stopMouthTest() {
    testToken += 1;
    if (testRaf) cancelAnimationFrame(testRaf);
    testRaf = 0;
    try { window.UnlimitedCompanionLive2D?.setMouthOpen?.(0); } catch {}
  }

  function testMouth() {
    const info = diagnostics();
    const panel = liveRoot()?.querySelector("#uaiCompanionV19PolishPanel");
    const note = panel?.querySelector("[data-v19-diagnostic]");
    if (!info.ready) {
      if (note) note.textContent = "当前 Live2D 模型还没有加载完成。";
      return false;
    }
    if (!info.lipSyncIds.length) {
      if (note) note.textContent = "没有识别到 LipSync 参数；正式模型需要在 model3.json 中声明 LipSync。";
      return false;
    }

    try { window.UnlimitedCompanionNeuralVoice?.stop?.({ keepLast: true }); } catch {}
    stopMouthTest();
    const token = ++testToken;
    const started = performance.now();
    const duration = 2200;
    const frame = (now) => {
      if (token !== testToken) return;
      const elapsed = now - started;
      if (elapsed >= duration) {
        testRaf = 0;
        try { window.UnlimitedCompanionLive2D?.setMouthOpen?.(0); } catch {}
        if (note) note.textContent = `张嘴测试完成 · ${diagnosticText(info)}`;
        return;
      }
      const gate = Math.sin(elapsed / 165) > -.25 ? 1 : .08;
      const amount = gate * (.12 + Math.abs(Math.sin(elapsed / 78)) * .80);
      try { window.UnlimitedCompanionLive2D?.setMouthOpen?.(amount); } catch {}
      testRaf = requestAnimationFrame(frame);
    };
    if (note) note.textContent = `正在测试嘴型 · ${info.lipSyncIds.join(", ")}`;
    testRaf = requestAnimationFrame(frame);
    return true;
  }

  function interruptAndListen() {
    const root = liveRoot();
    if (!root) return false;
    try { window.UnlimitedCompanionNeuralVoice?.stop?.({ keepLast: true }); } catch {}
    try { window.UnlimitedCompanionVoice?.stop?.({ silent: true }); } catch {}
    try { window.UnlimitedCompanionLive2DInteraction?.endVoice?.(); } catch {}
    const bar = root.querySelector("#uaiCompanionCallBar");
    const label = bar?.querySelector("[data-call-status]");
    if (bar) bar.dataset.state = "interrupting";
    if (label) label.textContent = "好，你说，我在听…";
    window.setTimeout(() => window.UnlimitedCompanionVoiceInput?.start?.(), 120);
    return true;
  }

  function bindBargeIn(root) {
    const button = root.querySelector("#uaiCompanionCallBar [data-call-listen]");
    if (!button || button.dataset.v19BargeIn === "1") return;
    button.dataset.v19BargeIn = "1";
    button.addEventListener("click", (event) => {
      const voiceState = root.dataset.v15NeuralVoiceState || "";
      if (!["loading", "speaking", "preview"].includes(voiceState)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      interruptAndListen();
    }, true);
  }

  function refreshCallBar(root) {
    const button = root.querySelector("#uaiCompanionCallBar [data-call-listen]");
    if (!button) return;
    const voiceState = root.dataset.v15NeuralVoiceState || "";
    const micState = window.UnlimitedCompanionVoiceInput?.state || root.dataset.v16VoiceInputState || "idle";
    const speaking = ["loading", "speaking", "preview"].includes(voiceState);
    const busyMic = ["requesting", "recording", "transcribing"].includes(micState);
    button.classList.toggle("uai-c-v19-interrupt-ready", speaking);
    button.disabled = !speaking && busyMic;
    if (speaking) {
      button.textContent = "✋";
      button.title = "打断她并开始说话";
    } else if (micState === "recording") {
      button.textContent = "●";
      button.title = "正在听你说话";
    } else if (micState === "transcribing") {
      button.textContent = "…";
      button.title = "正在识别";
    } else {
      button.textContent = "🎙";
      button.title = "继续听我说";
    }
  }

  function ensurePanel(root) {
    const parent = root.querySelector("#uaiCompanionV17CallPanel");
    if (!parent) return null;
    let panel = parent.querySelector("#uaiCompanionV19PolishPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "uaiCompanionV19PolishPanel";
      panel.className = "uai-c-v19-polish";
      panel.innerHTML = `
        <div class="uai-c-v19-title"><div><strong>Live2D 互动校准</strong><span>嘴型、模型诊断与快捷声线；设置按当前角色保存</span></div><em>V12.19</em></div>
        <div class="uai-c-v19-voice-presets">
          ${Object.entries(VOICE_PRESETS).map(([id, label]) => `<button type="button" data-v19-voice="${id}">${label}</button>`).join("")}
        </div>
        <label class="uai-c-v19-mouth">嘴型灵敏度 <b data-v19-mouth-label>1.15×</b><input type="range" data-v19-mouth min="0.65" max="1.80" step="0.05"></label>
        <div class="uai-c-v19-actions"><button type="button" data-v19-mouth-test>测试张嘴</button><button type="button" data-v19-diagnose>重新检测模型</button></div>
        <div class="uai-c-v19-diagnostic" data-v19-diagnostic>等待 Live2D 模型…</div>`;
      parent.appendChild(panel);
      panel.querySelector("[data-v19-mouth]")?.addEventListener("input", (event) => saveSettings({ mouthSensitivity: Number(event.target.value) }));
      panel.querySelector("[data-v19-mouth-test]")?.addEventListener("click", testMouth);
      panel.querySelector("[data-v19-diagnose]")?.addEventListener("click", () => renderDiagnostics(panel, true));
      panel.querySelectorAll("[data-v19-voice]").forEach((button) => {
        button.addEventListener("click", () => {
          const voiceId = String(button.dataset.v19Voice || "ara");
          window.UnlimitedCompanionCallMode?.setSettings?.({ voiceEngine: "auto", voiceId, voiceEnabled: true });
          window.UnlimitedCompanionNeuralVoice?.speak?.("你好呀，这个声音你喜欢吗？", { force: true, preview: true });
          schedule();
        });
      });
    }
    return panel;
  }

  function renderDiagnostics(panel, force = false) {
    if (!panel) return;
    const settings = getSettings();
    const slider = panel.querySelector("[data-v19-mouth]");
    const label = panel.querySelector("[data-v19-mouth-label]");
    if (slider && String(slider.value) !== String(settings.mouthSensitivity)) slider.value = String(settings.mouthSensitivity);
    if (label) label.textContent = `${settings.mouthSensitivity.toFixed(2)}×`;

    const info = diagnostics();
    const signature = `${info.state}|${info.modelUrl}|${info.lipSyncIds.join(",")}|${info.motionGroups.join(",")}|${info.expressionCount}`;
    if (!force && signature === lastDiagnosticSignature) return;
    lastDiagnosticSignature = signature;
    const node = panel.querySelector("[data-v19-diagnostic]");
    if (!node) return;
    node.classList.toggle("warn", info.ready && !info.lipSyncIds.length);
    node.classList.toggle("ok", info.ready && info.lipSyncIds.length > 0);
    if (!info.ready) {
      node.textContent = `模型状态：${info.state || "未加载"}`;
      return;
    }
    node.textContent = `${diagnosticText(info)}${info.modelUrl ? ` · ${info.modelUrl.split("/").pop()}` : ""}`;
  }

  function sync() {
    scheduled = false;
    patchLipSyncApi();
    const root = liveRoot();
    if (!root) return;
    root.dataset.v19Live2dPolish = REVISION;
    bindBargeIn(root);
    refreshCallBar(root);
    const panel = ensurePanel(root);
    renderDiagnostics(panel);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  function init() {
    document.documentElement.dataset.companionLive2dPolishRevision = REVISION;
    observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "class", "data-uai-mode", "data-v15-neural-voice-state", "data-v16-voice-input-state", "data-v129-live2d-lip-sync"]
    });
    window.addEventListener("storage", (event) => {
      if ([ACTIVE_KEY, KEY, "uai_companion_live2d_assignments_v1"].includes(event.key)) schedule();
    });
    window.addEventListener("pagehide", stopMouthTest, { passive: true });
    window.UnlimitedCompanionLive2DPolish = {
      revision: REVISION,
      getSettings,
      setSettings: saveSettings,
      diagnostics,
      testMouth,
      interruptAndListen,
      refresh: schedule
    };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
