// Companion V9 interaction shell: removes duplicate chrome and turns the profile card into the role hub.
(() => {
  const REVISION = "2026-08-14-v9.0-shell-5";
  const PROFILE_LIMIT = 5000;
  let scheduled = false;

  function activeProfile() {
    return window.UnlimitedCompanion?.getState?.()?.profile || null;
  }

  function roleApi() {
    return window.UnlimitedCompanionCharacterControls || null;
  }

  function stop(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function decorateProfileCard(root) {
    root.querySelector("#uaiCompanionRoleToolbar")?.remove();
    const card = root.querySelector("#uaiCompanionProfileCard .uai-c-profile-card");
    const profile = activeProfile();
    if (!card || !profile) return;

    card.title = "点击切换角色";
    if (card.dataset.v9RoleHub !== "1") {
      card.dataset.v9RoleHub = "1";
      card.setAttribute("role", "button");
      card.tabIndex = 0;
      card.addEventListener("click", (event) => {
        if (event.target.closest(".uai-c-v9-profile-actions")) return;
        roleApi()?.openManager?.();
      });
      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        roleApi()?.openManager?.();
      });
    }

    let actions = card.querySelector(".uai-c-v9-profile-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "uai-c-v9-profile-actions";
      actions.innerHTML = `
        <button type="button" class="uai-c-v9-edit" title="编辑当前角色" aria-label="编辑当前角色">✎</button>
        <button type="button" class="uai-c-v9-add" title="新增角色" aria-label="新增角色">＋</button>`;
      card.appendChild(actions);
      actions.querySelector(".uai-c-v9-edit")?.addEventListener("click", (event) => {
        stop(event);
        roleApi()?.openEditor?.();
      });
      actions.querySelector(".uai-c-v9-add")?.addEventListener("click", (event) => {
        stop(event);
        roleApi()?.openCreate?.();
      });
    }
  }

  function cleanSidebar(root) {
    const label = root.querySelector(".uai-c-sidebar > .uai-c-side-label");
    if (label) label.textContent = "聊天记录";
    const memory = root.querySelector("#uaiCompanionMemoryBtn span");
    if (memory) memory.textContent = "长期记忆";
    const settings = root.querySelector("#uaiCompanionSettingsBtn span");
    if (settings) settings.textContent = "设置";
    const exit = root.querySelector("#uaiCompanionExitBtn span");
    if (exit) exit.textContent = "返回模式大厅";
  }

  function decorateSessions(root) {
    root.querySelectorAll(".uai-c-session").forEach((session) => {
      const title = session.querySelector(".uai-c-session-title");
      if (title?.textContent) session.title = title.textContent.trim();
    });
  }

  function decorateMessages(root) {
    const name = activeProfile()?.name || "AI 伙伴";
    root.querySelectorAll(".uai-c-message-row.assistant").forEach((row) => {
      const body = row.firstElementChild;
      if (!body || body.querySelector(":scope > .uai-c-v9-message-author")) return;
      const author = document.createElement("div");
      author.className = "uai-c-v9-message-author";
      author.textContent = name;
      body.insertBefore(author, body.firstChild);
    });
  }

  function consolidateMessageActions(root) {
    root.querySelectorAll("#uaiCompanionMessages .uai-c-message-row").forEach((row) => {
      const body = row.firstElementChild;
      const bubble = row.querySelector(".uai-c-bubble");
      if (!body || !bubble || bubble.querySelector(".uai-c-typing")) return;

      let toolbar = body.querySelector(":scope > .uai-c-v9-message-toolbar");
      if (!toolbar) {
        toolbar = document.createElement("span");
        toolbar.className = "uai-c-v8-message-actions uai-c-v9-message-toolbar";
        body.appendChild(toolbar);
      }

      const sources = [
        ...body.querySelectorAll(":scope > .uai-c-v3-actions, :scope > .uai-c-v8-message-actions:not(.uai-c-v9-message-toolbar)")
      ];
      sources.forEach((source) => {
        source.querySelectorAll("button").forEach((button) => {
          const label = button.textContent?.trim();
          if (label === "记住") {
            button.remove();
            return;
          }
          if (label === "编辑重发") button.textContent = "编辑";
          toolbar.appendChild(button);
        });
        source.style.display = "none";
      });

      const order = ["编辑", "复制", "重新生成", "珍藏"];
      [...toolbar.querySelectorAll("button")]
        .sort((a, b) => order.indexOf(a.textContent?.trim()) - order.indexOf(b.textContent?.trim()))
        .forEach((button) => toolbar.appendChild(button));

      if (!toolbar.querySelector("button")) toolbar.remove();
    });
  }

  function simplifyMobileHeader(root) {
    const title = root.querySelector("#uaiCompanionHeaderName");
    const status = root.querySelector("#uaiCompanionHeaderStatus");
    const profile = activeProfile();
    if (title && profile?.name) title.textContent = profile.name;
    if (status) status.textContent = "AI 陪伴";
  }

  function cleanOnboarding() {
    const mask = document.getElementById("uaiCompanionModalMask");
    if (!mask || mask.hidden) return;
    const onboarding = mask.querySelector(".uai-c-onboarding");
    if (!onboarding) return;

    onboarding.querySelector("#uaiOnboardQuick")?.remove();
    onboarding.querySelector(".uai-c-chip-grid")?.closest(".uai-c-field")?.remove();

    const title = onboarding.querySelector(".uai-c-onboard-top h2");
    const intro = onboarding.querySelector(".uai-c-onboard-top p");
    const desc = onboarding.querySelector("#uaiOnboardDesc");
    const create = onboarding.querySelector("#uaiOnboardCreate");
    if (title) title.textContent = "创建你的第一个角色";
    if (intro) intro.textContent = "填写名字、关系和完整角色设定，然后直接开始聊天。";
    if (desc) {
      desc.maxLength = PROFILE_LIMIT;
      desc.rows = 10;
    }
    if (create) create.textContent = "开始聊天";
  }

  function cleanCharacterManager() {
    const mask = document.getElementById("uaiCompanionV3Mask");
    const modal = mask?.querySelector(".uai-c-v3-modal:not(.compact)");
    if (!modal) return;
    modal.classList.add("uai-c-v9-role-manager");
    const title = modal.querySelector("header h3");
    const desc = modal.querySelector("header p");
    const add = modal.querySelector("#uaiCompanionAddCharacter");
    if (title) title.textContent = "我的角色";
    if (desc) desc.textContent = "点击角色切换；每个角色的聊天、记忆和设置互相独立。";
    if (add) add.textContent = "＋ 新增角色";
  }

  function cleanMemoryModal() {
    const mask = document.getElementById("uaiCompanionModalMask");
    if (!mask || mask.hidden || !mask.querySelector("#uaiMemoryList")) return;
    const modal = mask.querySelector(".uai-c-modal");
    if (!modal) return;

    const title = modal.querySelector(".uai-c-modal-head h3");
    const desc = modal.querySelector(".uai-c-modal-head p");
    if (title) title.textContent = "长期记忆";
    if (desc) desc.textContent = "只保留真正希望当前角色长期记住的信息。";

    modal.querySelectorAll("p").forEach((paragraph) => {
      if (paragraph.textContent?.includes("自动记忆当前为")) paragraph.remove();
    });

    const actions = modal.querySelector("#uaiMemorySave")?.closest(".uai-c-modal-actions");
    if (!actions) return;
    const oldAdvanced = actions.querySelector("#uaiV8AdvancedMemory");
    if (oldAdvanced) oldAdvanced.style.display = "none";

    let details = modal.querySelector("#uaiV9MemoryAdvanced");
    if (!details) {
      details = document.createElement("details");
      details.id = "uaiV9MemoryAdvanced";
      details.className = "uai-c-v8-data-panel uai-c-v9-memory-advanced";
      details.innerHTML = `<summary><span>高级整理</span><b>›</b></summary><div class="uai-c-v8-data-body uai-c-v9-memory-advanced-body"><div class="uai-c-v8-data-row"><button type="button" id="uaiV9MemoryOrganizer">整理、归档与去重</button></div></div>`;
      actions.insertAdjacentElement("beforebegin", details);
      details.querySelector("#uaiV9MemoryOrganizer")?.addEventListener("click", () => {
        mask.hidden = true;
        mask.innerHTML = "";
        window.UnlimitedCompanionMemorySearch?.showMemoryOrganizer?.();
      });
    }

    const clear = modal.querySelector("#uaiMemoryClear");
    const dataRow = details.querySelector(".uai-c-v8-data-row");
    if (clear && dataRow && clear.parentElement !== dataRow) {
      clear.textContent = "清空全部记忆";
      dataRow.appendChild(clear);
    }
  }

  function cleanSettingsModal() {
    const mask = document.getElementById("uaiCompanionModalMask");
    if (!mask || mask.hidden) return;
    const modal = mask.querySelector(".uai-c-modal");
    if (!modal?.querySelector("#uaiCompanionModel") || !modal.querySelector("#uaiCompanionReplyLength")) return;
    modal.classList.add("uai-c-v9-settings");
    const title = modal.querySelector(".uai-c-modal-head h3");
    const desc = modal.querySelector(".uai-c-modal-head p");
    if (title) title.textContent = "设置";
    if (desc) desc.textContent = "模型、回复长度和长期记忆。备份与危险操作放在下方。";
    const modelLabel = modal.querySelector('label[for="uaiCompanionModel"]');
    const lengthLabel = modal.querySelector('label[for="uaiCompanionReplyLength"]');
    if (modelLabel) modelLabel.textContent = "模型";
    if (lengthLabel) lengthLabel.textContent = "回复长度";
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root || root.hidden) return;
    root.dataset.v9Shell = REVISION;
    decorateProfileCard(root);
    cleanSidebar(root);
    decorateSessions(root);
    decorateMessages(root);
    consolidateMessageActions(root);
    simplifyMobileHeader(root);
    cleanOnboarding();
    cleanCharacterManager();
    cleanMemoryModal();
    cleanSettingsModal();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionV9ShellRevision = REVISION;
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-uai-mode", "hidden"]
    });
    window.addEventListener("resize", schedule, { passive: true });
    schedule();
  }

  window.UnlimitedCompanionV9Shell = { revision: REVISION, refresh: schedule };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
