// Companion V10 interaction shell: calm role menu, readable conversation surface, and compact low-frequency tools.
(() => {
  const REVISION = "2026-08-14-v10.1-shell-2";
  const PROFILE_LIMIT = 5000;
  let scheduled = false;

  const RELATIONSHIP_LABELS = {
    girlfriend: "女朋友",
    boyfriend: "男朋友",
    friend: "好朋友",
    confidant: "知心伙伴",
    custom: "陪伴伙伴"
  };

  function state() {
    return window.UnlimitedCompanion?.getState?.() || {};
  }

  function activeProfile() {
    return state().profile || null;
  }

  function activeSession() {
    const current = state();
    return (current.sessions || []).find((item) => item?.id === current.currentSessionId) || null;
  }

  function roleApi() {
    return window.UnlimitedCompanionCharacterControls || null;
  }

  function relationshipLabel(profile) {
    return RELATIONSHIP_LABELS[profile?.relationship] || "陪伴伙伴";
  }

  function stop(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function avatarSymbol(profile) {
    if (profile?.relationship === "boyfriend") return "💙";
    if (profile?.relationship === "friend") return "🌙";
    return "💗";
  }

  function makeAvatar(profile, className) {
    const avatar = document.createElement("span");
    avatar.className = className;
    if (profile?.avatarData) {
      const image = document.createElement("img");
      image.src = profile.avatarData;
      image.alt = `${profile?.name || "AI 伙伴"}头像`;
      avatar.appendChild(image);
    } else {
      avatar.textContent = avatarSymbol(profile);
    }
    return avatar;
  }

  function closeRoleMenu(root) {
    root?.querySelector(".uai-c-v10-role-menu")?.setAttribute("hidden", "");
    root?.querySelector(".uai-c-v10-role-more")?.setAttribute("aria-expanded", "false");
  }

  function decorateProfileCard(root) {
    const card = root.querySelector("#uaiCompanionProfileCard .uai-c-profile-card");
    const profile = activeProfile();
    if (!card || !profile) return;

    card.title = "点击查看和切换角色";
    if (card.dataset.v10RoleHub !== "1") {
      card.dataset.v10RoleHub = "1";
      card.setAttribute("role", "button");
      card.tabIndex = 0;
      card.addEventListener("click", (event) => {
        if (event.target.closest(".uai-c-v10-role-actions")) return;
        closeRoleMenu(root);
        roleApi()?.openManager?.();
      });
      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        roleApi()?.openManager?.();
      });
    }

    card.querySelector(".uai-c-v9-profile-actions")?.remove();

    let actions = card.querySelector(".uai-c-v10-role-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "uai-c-v10-role-actions";
      actions.innerHTML = `
        <button type="button" class="uai-c-v10-role-more" aria-label="角色菜单" aria-expanded="false">•••</button>
        <div class="uai-c-v10-role-menu" hidden>
          <button type="button" data-v10-role-action="edit">编辑角色</button>
          <button type="button" data-v10-role-action="switch">切换角色</button>
          <button type="button" data-v10-role-action="create">新增角色</button>
          <button type="button" data-v10-role-action="manage">角色管理</button>
        </div>`;
      card.appendChild(actions);

      const toggle = actions.querySelector(".uai-c-v10-role-more");
      const menu = actions.querySelector(".uai-c-v10-role-menu");
      toggle?.addEventListener("click", (event) => {
        stop(event);
        const opening = menu?.hasAttribute("hidden");
        if (opening) menu?.removeAttribute("hidden");
        else menu?.setAttribute("hidden", "");
        toggle.setAttribute("aria-expanded", opening ? "true" : "false");
      });

      actions.querySelectorAll("[data-v10-role-action]").forEach((button) => {
        button.addEventListener("click", (event) => {
          stop(event);
          closeRoleMenu(root);
          const action = button.dataset.v10RoleAction;
          if (action === "edit") roleApi()?.openEditor?.();
          else if (action === "create") roleApi()?.openCreate?.();
          else roleApi()?.openManager?.();
        });
      });
    }
  }

  function ensureChatSearch(root) {
    const newChat = root.querySelector("#uaiCompanionNewChat");
    if (!newChat || root.querySelector("#uaiV10ChatSearch")) return;
    root.querySelector("#uaiV9ChatSearch")?.remove();
    const button = document.createElement("button");
    button.id = "uaiV10ChatSearch";
    button.type = "button";
    button.className = "uai-c-v10-search";
    button.innerHTML = `<span>⌕</span><strong>搜索聊天</strong><kbd>Ctrl K</kbd>`;
    button.addEventListener("click", () => window.UnlimitedCompanionMemorySearch?.showSearch?.());
    newChat.insertAdjacentElement("afterend", button);
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

  function decorateHeader(root) {
    const profile = activeProfile();
    if (!profile) return;
    const name = root.querySelector("#uaiCompanionHeaderName");
    const status = root.querySelector("#uaiCompanionHeaderStatus");
    if (name) name.textContent = profile.name || "AI 伙伴";
    if (status) status.textContent = `${relationshipLabel(profile)} · 在线`;
    root.querySelector("#uaiCompanionHeaderAvatar")?.setAttribute("hidden", "");
  }

  function decorateMessages(root) {
    const profile = activeProfile();
    const name = profile?.name || "AI 伙伴";
    root.querySelectorAll(".uai-c-message-row.assistant").forEach((row) => {
      const body = row.firstElementChild;
      if (!body) return;
      body.querySelector(":scope > .uai-c-v9-message-author")?.remove();
      if (body.querySelector(":scope > .uai-c-v10-author")) return;
      const author = document.createElement("div");
      author.className = "uai-c-v10-author";
      author.appendChild(makeAvatar(profile, "uai-c-v10-message-avatar"));
      const copy = document.createElement("span");
      copy.className = "uai-c-v10-author-copy";
      const strong = document.createElement("strong");
      strong.textContent = name;
      copy.appendChild(strong);
      author.appendChild(copy);
      body.insertBefore(author, body.firstChild);
    });
  }

  function normalizeActionLabel(button) {
    const label = button?.textContent?.trim() || "";
    if (label === "编辑重发") {
      button.textContent = "编辑";
      return "编辑";
    }
    return label;
  }

  function dedupeToolbar(toolbar) {
    const seen = new Set();
    [...toolbar.querySelectorAll("button")].forEach((button) => {
      const label = normalizeActionLabel(button);
      if (!label || label === "记住" || seen.has(label)) {
        button.remove();
        return;
      }
      seen.add(label);
    });
  }

  function consolidateMessageActions(root) {
    root.querySelectorAll("#uaiCompanionMessages .uai-c-message-row").forEach((row) => {
      const body = row.firstElementChild;
      const bubble = row.querySelector(".uai-c-bubble");
      if (!body || !bubble || bubble.querySelector(".uai-c-typing")) return;

      let toolbar = body.querySelector(":scope > .uai-c-v10-message-toolbar");
      if (!toolbar) {
        toolbar = document.createElement("span");
        toolbar.className = "uai-c-v10-message-toolbar";
        body.appendChild(toolbar);
      }

      const sources = [
        ...body.querySelectorAll(":scope > .uai-c-v3-actions, :scope > .uai-c-v8-message-actions, :scope > .uai-c-v9-message-toolbar")
      ].filter((source) => source !== toolbar);

      sources.forEach((source) => {
        source.querySelectorAll("button").forEach((button) => {
          const label = normalizeActionLabel(button);
          if (label === "记住") {
            button.remove();
            return;
          }
          toolbar.appendChild(button);
        });
        // Keep the real legacy source node as an empty hidden anchor. The
        // multi-character core checks for .uai-c-v3-actions before creating
        // retry buttons. Removing a real source causes create -> move -> remove
        // -> create observer loops; keeping it prevents duplicates.
        source.hidden = true;
        source.dataset.v10Consumed = "1";
      });

      dedupeToolbar(toolbar);
      const order = ["编辑", "复制", "重新生成", "珍藏"];
      [...toolbar.querySelectorAll(":scope > button")]
        .sort((a, b) => {
          const ai = order.indexOf(a.textContent?.trim());
          const bi = order.indexOf(b.textContent?.trim());
          return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
        })
        .forEach((button) => toolbar.appendChild(button));

      if (!toolbar.querySelector(":scope > button")) toolbar.classList.add("empty");
      else toolbar.classList.remove("empty");
    });
  }

  function ensureConversationStarters(root) {
    const messages = root.querySelector("#uaiCompanionMessages");
    if (!messages) return;
    messages.querySelector(".uai-c-v10-starters")?.remove();
    const session = activeSession();
    if (!session || !Array.isArray(session.messages) || session.messages.length !== 1 || session.messages[0]?.role === "user") return;

    const profile = activeProfile();
    const starters = document.createElement("div");
    starters.className = "uai-c-v10-starters";
    starters.innerHTML = `
      <span>想从哪里开始？</span>
      <div>
        <button type="button">今天过得怎么样</button>
        <button type="button">有点想你</button>
        <button type="button">陪我聊会儿</button>
      </div>`;
    starters.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const input = root.querySelector("#uaiCompanionInput");
        if (!input) return;
        input.value = button.textContent || "";
        input.placeholder = `和${profile?.name || "TA"}说点什么……`;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      });
    });
    messages.appendChild(starters);
  }

  function improveComposer(root) {
    const profile = activeProfile();
    const input = root.querySelector("#uaiCompanionInput");
    const send = root.querySelector("#uaiCompanionSend");
    const stopButton = root.querySelector("#uaiCompanionStop");
    if (input) {
      input.rows = 2;
      input.placeholder = `和${profile?.name || "AI 伙伴"}说点什么……`;
    }
    if (send) {
      send.textContent = "↑";
      send.title = "发送";
      send.setAttribute("aria-label", "发送消息");
    }
    if (stopButton) {
      stopButton.textContent = "■";
      stopButton.title = "停止生成";
      stopButton.setAttribute("aria-label", "停止生成");
    }
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
    if (intro) intro.textContent = "名字、关系、完整角色设定。填完就可以直接开始聊天。";
    if (desc) {
      desc.maxLength = PROFILE_LIMIT;
      desc.rows = 10;
      desc.placeholder = "年龄：\n身份：\n外貌：\n性格：\n背景经历：\n与用户的关系细节：\n说话方式：\n其他设定：";
    }
    if (create) create.textContent = "开始聊天";
  }

  function cleanCharacterManager() {
    const mask = document.getElementById("uaiCompanionV3Mask");
    const modal = mask?.querySelector(".uai-c-v3-modal:not(.compact)");
    if (!modal) return;
    modal.classList.remove("uai-c-v9-role-manager");
    modal.classList.add("uai-c-v10-role-manager");
    const title = modal.querySelector("header h3");
    const desc = modal.querySelector("header p");
    const add = modal.querySelector("#uaiCompanionAddCharacter");
    if (title) title.textContent = "我的角色";
    if (desc) desc.textContent = "角色之间的设定、聊天、长期记忆和模型设置互相独立。";
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
    let details = modal.querySelector("#uaiV10MemoryAdvanced");
    if (!details) {
      details = document.createElement("details");
      details.id = "uaiV10MemoryAdvanced";
      details.className = "uai-c-v8-data-panel uai-c-v10-memory-advanced";
      details.innerHTML = `<summary><span>高级整理</span><b>›</b></summary><div class="uai-c-v8-data-body"><div class="uai-c-v8-data-row"><button type="button" id="uaiV10MemoryOrganizer">整理、归档与去重</button></div></div>`;
      actions.insertAdjacentElement("beforebegin", details);
      details.querySelector("#uaiV10MemoryOrganizer")?.addEventListener("click", () => {
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
    modal.classList.remove("uai-c-v9-settings");
    modal.classList.add("uai-c-v10-settings");
    const title = modal.querySelector(".uai-c-modal-head h3");
    const desc = modal.querySelector(".uai-c-modal-head p");
    if (title) title.textContent = "设置";
    if (desc) desc.textContent = "模型、回复长度和长期记忆。备份与危险操作收在下方。";
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
    root.dataset.v10Shell = REVISION;
    decorateProfileCard(root);
    ensureChatSearch(root);
    cleanSidebar(root);
    decorateSessions(root);
    decorateHeader(root);
    decorateMessages(root);
    consolidateMessageActions(root);
    ensureConversationStarters(root);
    improveComposer(root);
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
    document.documentElement.dataset.companionV10ShellRevision = REVISION;
    document.addEventListener("click", (event) => {
      const root = document.getElementById("uaiCompanionRoot");
      if (!root || event.target.closest(".uai-c-v10-role-actions")) return;
      closeRoleMenu(root);
    });
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-uai-mode", "hidden"]
    });
    window.addEventListener("resize", schedule, { passive: true });
    schedule();
  }

  window.UnlimitedCompanionV10Shell = { revision: REVISION, refresh: schedule };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();