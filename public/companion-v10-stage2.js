// Companion V10.5 — interaction hotfix + desktop sidecar.
// Keeps existing chat/data logic untouched and only improves the UI shell.
(() => {
  const REVISION = "2026-08-14-v10.5-stage2-1";
  let scheduled = false;

  function state() {
    return window.UnlimitedCompanion?.getState?.() || {};
  }

  function relationLabel(value) {
    return ({
      girlfriend: "女朋友",
      boyfriend: "男朋友",
      friend: "好朋友",
      confidant: "知心伙伴",
      custom: "陪伴伙伴"
    })[value] || "陪伴伙伴";
  }

  function avatarSymbol(profile) {
    if (profile?.relationship === "boyfriend") return "💙";
    if (profile?.relationship === "friend") return "🌙";
    return "💗";
  }

  function avatarHtml(profile) {
    if (profile?.avatarData) {
      return `<img src="${profile.avatarData}" alt="${profile?.name || "AI 伙伴"}头像">`;
    }
    return `<span>${avatarSymbol(profile)}</span>`;
  }

  function acquaintanceDays(profile) {
    const createdAt = Number(profile?.createdAt || 0);
    if (!createdAt) return 1;
    return Math.max(1, Math.floor((Date.now() - createdAt) / 86400000) + 1);
  }

  function applyStarterChoice(button) {
    const root = document.getElementById("uaiCompanionRoot");
    const input = root?.querySelector("#uaiCompanionInput");
    if (!root || !input || !button) return;
    const text = (button.textContent || "").trim();
    if (!text) return;
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus({ preventScroll: true });
    button.classList.add("uai-c-v10-starter-picked");
    window.setTimeout(() => button.classList.remove("uai-c-v10-starter-picked"), 180);
  }

  // The V10 shell re-renders the starter strip frequently. Using pointerdown in
  // capture phase makes the action reliable even if the button node is replaced
  // before the subsequent click event is dispatched.
  document.addEventListener("pointerdown", (event) => {
    const button = event.target.closest?.("#uaiCompanionRoot .uai-c-v10-starters button");
    if (!button) return;
    applyStarterChoice(button);
  }, true);

  // Keyboard accessibility still uses click/Enter/Space.
  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("#uaiCompanionRoot .uai-c-v10-starters button");
    if (!button) return;
    applyStarterChoice(button);
  }, true);

  function ensureSidecar() {
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    const shell = root?.querySelector(".uai-c-shell");
    if (!root || !shell || root.hidden) return;

    let sidecar = shell.querySelector(":scope > .uai-c-v10-sidecar");
    if (!sidecar) {
      sidecar = document.createElement("aside");
      sidecar.className = "uai-c-v10-sidecar";
      sidecar.setAttribute("aria-label", "角色状态");
      sidecar.innerHTML = `
        <div class="uai-c-v10-sidecar-inner">
          <div class="uai-c-v10-sidecar-hero">
            <div class="uai-c-v10-sidecar-avatar"></div>
            <div class="uai-c-v10-sidecar-name"></div>
            <div class="uai-c-v10-sidecar-relation"></div>
          </div>
          <div class="uai-c-v10-sidecar-stats">
            <div><strong data-sidecar-days>1</strong><span>认识天数</span></div>
            <div><strong data-sidecar-sessions>0</strong><span>聊天</span></div>
            <div><strong data-sidecar-memories>0</strong><span>记忆</span></div>
          </div>
          <div class="uai-c-v10-sidecar-section">
            <span class="uai-c-v10-sidecar-label">陪伴空间</span>
            <button type="button" data-sidecar-action="role"><span>♡</span><b>角色设定</b><i>›</i></button>
            <button type="button" data-sidecar-action="memory"><span>✦</span><b>长期记忆</b><i>›</i></button>
            <button type="button" data-sidecar-action="settings"><span>⚙</span><b>聊天设置</b><i>›</i></button>
          </div>
          <div class="uai-c-v10-sidecar-note">这里展示的是当前角色已有的信息，不新增聊天逻辑。</div>
        </div>`;
      shell.appendChild(sidecar);

      sidecar.addEventListener("click", (event) => {
        const button = event.target.closest("[data-sidecar-action]");
        if (!button) return;
        const action = button.dataset.sidecarAction;
        if (action === "role") window.UnlimitedCompanionCharacterControls?.openEditor?.();
        if (action === "memory") root.querySelector("#uaiCompanionMemoryBtn")?.click();
        if (action === "settings") root.querySelector("#uaiCompanionSettingsBtn")?.click();
      });
    }

    const current = state();
    const profile = current.profile || {};
    const sessions = Array.isArray(current.sessions) ? current.sessions : [];
    const memories = Array.isArray(current.memories) ? current.memories : [];
    const avatar = sidecar.querySelector(".uai-c-v10-sidecar-avatar");
    const name = sidecar.querySelector(".uai-c-v10-sidecar-name");
    const relation = sidecar.querySelector(".uai-c-v10-sidecar-relation");
    if (avatar) {
      const next = avatarHtml(profile);
      if (avatar.innerHTML !== next) avatar.innerHTML = next;
    }
    if (name && name.textContent !== (profile.name || "AI 伙伴")) name.textContent = profile.name || "AI 伙伴";
    const relationText = `${relationLabel(profile.relationship)} · 在线`;
    if (relation && relation.textContent !== relationText) relation.textContent = relationText;
    const days = sidecar.querySelector("[data-sidecar-days]");
    const sessionCount = sidecar.querySelector("[data-sidecar-sessions]");
    const memoryCount = sidecar.querySelector("[data-sidecar-memories]");
    if (days) days.textContent = String(acquaintanceDays(profile));
    if (sessionCount) sessionCount.textContent = String(sessions.length);
    if (memoryCount) memoryCount.textContent = String(memories.length);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureSidecar();
    });
  }

  new MutationObserver(schedule).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-uai-mode", "hidden"]
  });
  window.addEventListener("resize", schedule, { passive: true });
  window.UnlimitedCompanionV10Stage2 = { revision: REVISION, refresh: schedule };
  schedule();
})();