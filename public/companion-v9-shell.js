// Companion V9 interaction shell: removes duplicate chrome and turns the profile card into the role hub.
(() => {
  const REVISION = "2026-08-14-v9.0-shell-1";
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

  function simplifyMobileHeader(root) {
    const title = root.querySelector("#uaiCompanionHeaderName");
    const status = root.querySelector("#uaiCompanionHeaderStatus");
    const profile = activeProfile();
    if (title && profile?.name) title.textContent = profile.name;
    if (status) status.textContent = "AI 陪伴";
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
    simplifyMobileHeader(root);
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
