// Prompt control UI for novel and companion modes.
(() => {
  const VERSION = "2026-08-13-prompt-control-2";
  const K = {
    novelText: "cfw_custom_prompt_v1",
    novelEnabled: "cfw_prompt_enabled",
    novelBuiltin: "cfw_use_builtin",
    profile: "uai_companion_profile_v1",
    characters: "uai_companion_characters_v1",
    active: "uai_companion_active_character_v1"
  };
  let queued = false;

  function parse(value, fallback) { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } }
  function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function currentProfile() { const v = parse(localStorage.getItem(K.profile), null); return v && typeof v === "object" ? v : null; }
  function defaultText(mode) { return String(window.APP_DEFAULT_PROMPTS?.[mode] || "默认提示词加载中，请刷新后再试。"); }

  function read(mode) {
    if (mode === "novel") {
      const text = localStorage.getItem(K.novelText) || "";
      const enabled = (localStorage.getItem(K.novelEnabled) || "0") === "1" && (localStorage.getItem(K.novelBuiltin) || "1") === "0" && Boolean(text.trim());
      return { text, enabled };
    }
    const p = currentProfile();
    const text = typeof p?.promptInjection === "string" ? p.promptInjection : "";
    return { text, enabled: Boolean(p?.promptInjectionEnabled && text.trim()) };
  }

  function write(mode, enabled, text) {
    const clean = String(text || "").slice(0, 12000);
    const active = Boolean(enabled && clean.trim());
    if (mode === "novel") {
      localStorage.setItem(K.novelText, clean);
      localStorage.setItem(K.novelEnabled, active ? "1" : "0");
      localStorage.setItem(K.novelBuiltin, active ? "0" : "1");
      return true;
    }
    const p = currentProfile();
    if (!p) return false;
    const next = { ...p, promptInjection: clean, promptInjectionEnabled: active };
    localStorage.setItem(K.profile, JSON.stringify(next));
    const id = localStorage.getItem(K.active) || "";
    const list = parse(localStorage.getItem(K.characters), []);
    if (id && Array.isArray(list)) {
      const i = list.findIndex((item) => item?.id === id);
      if (i >= 0) {
        list[i] = { ...list[i], profile: next, updatedAt: Date.now() };
        localStorage.setItem(K.characters, JSON.stringify(list));
      }
    }
    window.UnlimitedCompanionMulti?.persist?.();
    return true;
  }

  function close() { document.getElementById("uaiPromptControlMask")?.remove(); }

  function render(mask, mode) {
    const isCompanion = mode === "companion";
    const saved = read(mode);
    mask.querySelectorAll("[data-pc-tab]").forEach((b) => b.classList.toggle("active", b.dataset.pcTab === mode));
    const host = mask.querySelector("#uaiPromptControlBody");
    if (!host) return;
    host.innerHTML = `
      <div class="uai-prompt-info"><strong>${isCompanion ? "AI 陪伴" : "AI 写作"}</strong><span>不开启自定义时使用默认提示词；开启并填写后，默认提示词不再作为 system prompt 发送。</span></div>
      <section class="uai-prompt-section"><div class="uai-prompt-section-head"><div><b>默认提示词</b><span>src/default-prompts.js</span></div></div><textarea class="uai-prompt-default" readonly>${esc(defaultText(mode))}</textarea></section>
      <section class="uai-prompt-section injection"><div class="uai-prompt-section-head"><div><b>自定义 System Prompt</b><span>开启后由它替代默认提示词</span></div><label class="uai-prompt-switch"><input id="uaiPcEnabled" type="checkbox"${saved.enabled ? " checked" : ""}><span>启用</span></label></div><textarea id="uaiPcText" maxlength="12000" placeholder="${isCompanion ? "写完整的人设、称呼、语气和行为规则。" : "写完整的小说创作规则、文风、视角和输出要求。"}">${esc(saved.text)}</textarea><p>项目资料或长期记忆仍可作为普通参考上下文发送，但不会占用 system prompt 位置。</p></section>
      <div class="uai-prompt-actions"><button class="secondary danger" id="uaiPcClear" type="button">清空</button><button class="primary" id="uaiPcSave" type="button">保存并生效</button></div>`;
    host.querySelector("#uaiPcClear")?.addEventListener("click", () => { if (confirm("清空自定义提示词并恢复默认？")) { write(mode, false, ""); render(mask, mode); } });
    host.querySelector("#uaiPcSave")?.addEventListener("click", () => {
      const enabled = Boolean(host.querySelector("#uaiPcEnabled")?.checked);
      const text = host.querySelector("#uaiPcText")?.value || "";
      if (enabled && !text.trim()) return alert("请先填写提示词，或者取消启用。");
      if (!write(mode, enabled, text)) return alert("请先创建 AI 陪伴角色。");
      const b = host.querySelector("#uaiPcSave"); if (b) b.textContent = enabled ? "已启用 ✓" : "已恢复默认 ✓";
    });
  }

  function open(mode = document.body.dataset.uaiMode === "companion" ? "companion" : "novel") {
    close();
    const mask = document.createElement("div");
    mask.id = "uaiPromptControlMask";
    mask.className = "uai-prompt-mask";
    mask.innerHTML = `<section class="uai-prompt-modal" role="dialog" aria-modal="true"><header><div><span>PROMPT CENTER</span><h2>提示词中心</h2><p>默认提示词和自定义提示词都在这里管理。</p></div><button type="button" data-pc-close>×</button></header><nav class="uai-prompt-tabs"><button type="button" data-pc-tab="novel">✍ AI 写作</button><button type="button" data-pc-tab="companion">♡ AI 陪伴</button></nav><div id="uaiPromptControlBody" class="uai-prompt-panel"></div></section>`;
    document.body.appendChild(mask);
    mask.addEventListener("click", (e) => { if (e.target === mask) close(); });
    mask.querySelector("[data-pc-close]")?.addEventListener("click", close);
    mask.querySelectorAll("[data-pc-tab]").forEach((b) => b.addEventListener("click", () => render(mask, b.dataset.pcTab)));
    render(mask, mode === "companion" ? "companion" : "novel");
  }

  function enhance() {
    queued = false;
    const persona = document.getElementById("personaToggle"); if (persona) persona.hidden = true;
    const old = document.getElementById("customPrompt")?.closest?.(".settings-section"); if (old) old.hidden = true;
    const top = document.querySelector("#app .topbar-actions");
    if (top && !document.getElementById("uaiNovelPromptControl")) {
      const b = document.createElement("button"); b.id = "uaiNovelPromptControl"; b.className = "iconbtn"; b.type = "button"; b.title = "写作提示词"; b.textContent = "词"; b.addEventListener("click", () => open("novel"));
      const settings = top.querySelector("#settingsBtn"); settings ? top.insertBefore(b, settings) : top.appendChild(b);
    }
    const side = document.querySelector("#uaiCompanionRoot .uai-c-side-actions");
    if (side && !document.getElementById("uaiCompanionPromptControl")) {
      const b = document.createElement("button"); b.id = "uaiCompanionPromptControl"; b.className = "uai-c-sidebar-action"; b.type = "button"; b.innerHTML = "<span>提示词</span><b>System</b>"; b.addEventListener("click", () => open("companion"));
      const settings = side.querySelector("#uaiCompanionSettingsBtn"); settings ? side.insertBefore(b, settings) : side.appendChild(b);
    }
  }
  function schedule() { if (queued) return; queued = true; requestAnimationFrame(enhance); }
  function init() { document.documentElement.dataset.promptControlRevision = VERSION; new MutationObserver(schedule).observe(document.body, { subtree:true, childList:true, attributes:true, attributeFilter:["data-uai-mode","hidden","class"] }); schedule(); }

  window.UnlimitedPromptControl = { revision: VERSION, open, read, write };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true }); else init();
})();
