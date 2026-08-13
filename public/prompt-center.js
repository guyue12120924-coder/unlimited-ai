// public/prompt-center.js
// One visible place to manage prompts for both product modes.
// Default prompts stay active; browser custom instructions are additive.
(() => {
  const REVISION = "2026-08-13-v6.1-prompt-center-1";
  const NOVEL = {
    textKey: "cfw_custom_prompt_v1",
    enabledKey: "cfw_prompt_enabled",
    builtinKey: "cfw_use_builtin"
  };
  const COMPANION = {
    profileKey: "uai_companion_profile_v1",
    charactersKey: "uai_companion_characters_v1",
    activeKey: "uai_companion_active_character_v1"
  };
  let scheduled = false;

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function defaultPrompt(mode) {
    const value = window.APP_DEFAULT_PROMPTS?.[mode];
    return typeof value === "string" && value.trim()
      ? value.trim()
      : "默认提示词正在从 Worker 配置加载。若这里暂时为空，刷新页面后再打开即可。";
  }

  function getNovelSetting() {
    return {
      enabled: (localStorage.getItem(NOVEL.enabledKey) ?? "0") === "1" && (localStorage.getItem(NOVEL.builtinKey) ?? "1") === "0",
      text: localStorage.getItem(NOVEL.textKey) || ""
    };
  }
  function saveNovelSetting(enabled, text) {
    localStorage.setItem(NOVEL.textKey, String(text || "").slice(0, 12000));
    localStorage.setItem(NOVEL.enabledKey, enabled ? "1" : "0");
    // The legacy client only sends its custom field while this flag is 0.
    // The Worker now keeps the built-in prompt anyway, so this no longer means
    // “replace default”; it only activates the additive custom field.
    localStorage.setItem(NOVEL.builtinKey, enabled ? "0" : "1");
  }

  function getCompanionProfile() {
    const profile = safeParse(localStorage.getItem(COMPANION.profileKey), null);
    return profile && typeof profile === "object" && !Array.isArray(profile) ? profile : null;
  }
  function getCompanionSetting() {
    const profile = getCompanionProfile();
    return {
      enabled: Boolean(profile?.promptInjectionEnabled),
      text: typeof profile?.promptInjection === "string" ? profile.promptInjection : ""
    };
  }
  function saveCompanionSetting(enabled, text) {
    const profile = getCompanionProfile();
    if (!profile) return false;
    const nextProfile = {
      ...profile,
      promptInjectionEnabled: Boolean(enabled),
      promptInjection: String(text || "").slice(0, 12000)
    };
    localStorage.setItem(COMPANION.profileKey, JSON.stringify(nextProfile));

    const activeId = localStorage.getItem(COMPANION.activeKey) || "";
    const characters = safeParse(localStorage.getItem(COMPANION.charactersKey), []);
    if (activeId && Array.isArray(characters)) {
      const index = characters.findIndex((item) => item?.id === activeId);
      if (index >= 0) {
        characters[index] = { ...characters[index], profile: nextProfile, updatedAt: Date.now() };
        localStorage.setItem(COMPANION.charactersKey, JSON.stringify(characters));
      }
    }
    window.UnlimitedCompanionMulti?.persist?.();
    return true;
  }

  function getSetting(mode) {
    return mode === "companion" ? getCompanionSetting() : getNovelSetting();
  }
  function saveSetting(mode, enabled, text) {
    return mode === "companion"
      ? saveCompanionSetting(enabled, text)
      : (saveNovelSetting(enabled, text), true);
  }

  function closeModal() {
    document.getElementById("uaiPromptCenterMask")?.remove();
  }

  function renderPanel(mask, mode) {
    const isCompanion = mode === "companion";
    const saved = getSetting(mode);
    const prompt = defaultPrompt(mode);
    mask.querySelectorAll("[data-prompt-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.promptTab === mode);
    });
    const panel = mask.querySelector("#uaiPromptCenterPanel");
    if (!panel) return;
    panel.innerHTML = `
      <div class="uai-prompt-info">
        <strong>${isCompanion ? "AI 女友 / 陪伴提示词" : "AI 小说写作提示词"}</strong>
        <span>默认提示词始终生效；你填写的内容只会追加，不会覆盖默认提示词。</span>
      </div>
      <section class="uai-prompt-section">
        <div class="uai-prompt-section-head">
          <div><b>默认提示词</b><span>代码位置：src/default-prompts.js</span></div>
          <button type="button" id="uaiPromptCopyDefault">复制</button>
        </div>
        <textarea class="uai-prompt-default" readonly>${escapeHtml(prompt)}</textarea>
      </section>
      <section class="uai-prompt-section injection">
        <div class="uai-prompt-section-head">
          <div><b>自定义注入提示词</b><span>保存在当前浏览器，最多 12000 字符</span></div>
          <label class="uai-prompt-switch"><input type="checkbox" id="uaiPromptEnabled"${saved.enabled ? " checked" : ""} /><span>启用</span></label>
        </div>
        <textarea id="uaiPromptCustom" maxlength="12000" placeholder="${isCompanion ? "例如：说话更俏皮一点；不要总反问；称呼我为哥哥；回复控制在三句话左右。" : "例如：第三人称限知；文风克制；减少比喻；对白自然；每次续写约 1500 字。"}">${escapeHtml(saved.text)}</textarea>
        <p>默认 Prompt、角色/小说上下文仍由系统自动加入。这里只写你希望额外强调的规则即可。</p>
      </section>
      <div class="uai-prompt-actions">
        <button type="button" class="secondary danger" id="uaiPromptClear">清空注入</button>
        <button type="button" class="primary" id="uaiPromptSave">保存并生效</button>
      </div>`;

    panel.querySelector("#uaiPromptCopyDefault")?.addEventListener("click", () => {
      navigator.clipboard?.writeText(prompt).catch(() => {});
    });
    panel.querySelector("#uaiPromptClear")?.addEventListener("click", () => {
      if (!confirm("清空当前模式的自定义注入提示词？默认提示词不会受影响。")) return;
      saveSetting(mode, false, "");
      renderPanel(mask, mode);
    });
    panel.querySelector("#uaiPromptSave")?.addEventListener("click", () => {
      const enabled = Boolean(panel.querySelector("#uaiPromptEnabled")?.checked);
      const text = panel.querySelector("#uaiPromptCustom")?.value || "";
      if (!saveSetting(mode, enabled, text)) {
        alert("请先创建一个 AI 陪伴角色，再保存陪伴提示词。");
        return;
      }
      const button = panel.querySelector("#uaiPromptSave");
      if (button) button.textContent = "已保存 ✓";
      window.setTimeout(() => { if (button?.isConnected) button.textContent = "保存并生效"; }, 1000);
    });
  }

  function open(mode = document.body.dataset.uaiMode === "companion" ? "companion" : "novel") {
    closeModal();
    const mask = document.createElement("div");
    mask.id = "uaiPromptCenterMask";
    mask.className = "uai-prompt-mask";
    mask.innerHTML = `
      <section class="uai-prompt-modal" role="dialog" aria-modal="true" aria-label="提示词中心">
        <header>
          <div><span>PROMPT CENTER</span><h2>提示词中心</h2><p>以后默认提示词只需要看一个文件；临时规则直接在网页里改。</p></div>
          <button type="button" data-prompt-close aria-label="关闭">×</button>
        </header>
        <nav class="uai-prompt-tabs">
          <button type="button" data-prompt-tab="novel">✍ AI 写作</button>
          <button type="button" data-prompt-tab="companion">♡ AI 陪伴</button>
        </nav>
        <div id="uaiPromptCenterPanel" class="uai-prompt-panel"></div>
      </section>`;
    document.body.appendChild(mask);
    mask.addEventListener("click", (event) => { if (event.target === mask) closeModal(); });
    mask.querySelector("[data-prompt-close]")?.addEventListener("click", closeModal);
    mask.querySelectorAll("[data-prompt-tab]").forEach((button) => {
      button.addEventListener("click", () => renderPanel(mask, button.dataset.promptTab || "novel"));
    });
    renderPanel(mask, mode === "companion" ? "companion" : "novel");
  }

  function hideLegacyNovelControls() {
    const persona = document.getElementById("personaToggle");
    if (persona) persona.hidden = true;
    const customPrompt = document.getElementById("customPrompt");
    const legacySection = customPrompt?.closest?.(".settings-section");
    if (legacySection) legacySection.hidden = true;
  }

  function ensureNovelEntry() {
    const actions = document.querySelector("#app .topbar-actions");
    if (!actions || actions.querySelector("#uaiNovelPromptCenterBtn")) return;
    const button = document.createElement("button");
    button.id = "uaiNovelPromptCenterBtn";
    button.type = "button";
    button.className = "iconbtn uai-prompt-novel-entry";
    button.title = "AI 写作提示词";
    button.setAttribute("aria-label", "打开 AI 写作提示词");
    button.textContent = "词";
    button.addEventListener("click", () => open("novel"));
    const settings = actions.querySelector("#settingsBtn");
    if (settings) actions.insertBefore(button, settings);
    else actions.appendChild(button);
  }

  function ensureCompanionEntry() {
    const actions = document.querySelector("#uaiCompanionRoot .uai-c-side-actions");
    if (!actions || actions.querySelector("#uaiCompanionPromptCenterBtn")) return;
    const button = document.createElement("button");
    button.id = "uaiCompanionPromptCenterBtn";
    button.type = "button";
    button.className = "uai-c-sidebar-action uai-prompt-companion-entry";
    button.innerHTML = "<span>提示词</span><b>编辑</b>";
    button.addEventListener("click", () => open("companion"));
    const settings = actions.querySelector("#uaiCompanionSettingsBtn");
    if (settings) actions.insertBefore(button, settings);
    else actions.appendChild(button);
  }

  function enhance() {
    scheduled = false;
    hideLegacyNovelControls();
    ensureNovelEntry();
    ensureCompanionEntry();
  }
  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }
  function init() {
    document.documentElement.dataset.promptCenterRevision = REVISION;
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.getElementById("uaiPromptCenterMask")) closeModal();
    });
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-uai-mode", "hidden", "class"] });
    scheduleEnhance();
  }

  window.UnlimitedPromptCenter = { revision: REVISION, open, close: closeModal, getSetting, saveSetting, refresh: scheduleEnhance };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
