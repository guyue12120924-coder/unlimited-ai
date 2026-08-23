// V17.23B novel-only session management polish.
(() => {
  const REVISION = "2026-08-23-v17.23b-novel-session-management";
  const LS_SESSIONS = "cfw_sessions_v2";
  if (window.UnlimitedNovelSessionsV1723B?.revision === REVISION) return;

  let bypassCoreAction = false;
  let observer = null;
  let dialogState = null;

  function isNovelMode() {
    return document.body?.dataset?.uaiMode === "novel";
  }

  function readSessions() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LS_SESSIONS) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function formatDate(value) {
    const time = Number(value);
    if (!Number.isFinite(time) || time <= 0) return "本地会话";
    try {
      return new Date(time).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
    } catch {
      return "本地会话";
    }
  }

  function sessionMeta(id, active) {
    const item = readSessions().find((entry) => String(entry?.id) === String(id));
    const count = Array.isArray(item?.messages) ? item.messages.length : 0;
    if (active) return `当前会话 · ${count} 条消息`;
    return `${count} 条消息 · ${formatDate(item?.createdAt)}`;
  }

  function decorateSessionList() {
    if (!isNovelMode()) return;
    const list = document.getElementById("sessionList");
    if (!list) return;

    list.querySelectorAll(".session-item").forEach((item) => {
      const title = item.querySelector(":scope > .session-title, :scope > .novel-v1723-session-copy > .session-title");
      if (!title) return;
      const id = title.dataset.id || "";
      let copy = item.querySelector(":scope > .novel-v1723-session-copy");
      if (!copy) {
        copy = document.createElement("div");
        copy.className = "novel-v1723-session-copy";
        title.before(copy);
        copy.appendChild(title);
        const meta = document.createElement("span");
        meta.className = "novel-v1723-session-meta";
        copy.appendChild(meta);
      }
      const meta = copy.querySelector(".novel-v1723-session-meta");
      if (meta) meta.textContent = sessionMeta(id, item.classList.contains("active"));

      const rename = item.querySelector(".rename-session");
      const remove = item.querySelector(".delete-session");
      if (rename) {
        rename.textContent = "重命名";
        rename.title = "重命名这个会话";
      }
      if (remove) {
        remove.textContent = "删除";
        remove.title = "删除这个会话";
      }
      item.dataset.novelV1723Session = "true";
    });
  }

  function ensureDialog() {
    let mask = document.getElementById("novelV1723SessionDialog");
    if (mask) return mask;

    mask = document.createElement("div");
    mask.id = "novelV1723SessionDialog";
    mask.className = "novel-v1723-session-dialog";
    mask.setAttribute("role", "dialog");
    mask.setAttribute("aria-modal", "true");
    mask.hidden = true;
    mask.innerHTML = `
      <section class="novel-v1723-session-dialog-card" aria-labelledby="novelV1723SessionDialogTitle">
        <div class="novel-v1723-session-dialog-icon" aria-hidden="true">✦</div>
        <h3 id="novelV1723SessionDialogTitle">会话操作</h3>
        <p id="novelV1723SessionDialogText"></p>
        <input id="novelV1723SessionDialogInput" type="text" maxlength="80" autocomplete="off" />
        <div class="novel-v1723-session-dialog-actions">
          <button type="button" data-v1723-session-cancel>取消</button>
          <button type="button" class="primary" data-v1723-session-confirm>确定</button>
        </div>
      </section>`;
    document.body.appendChild(mask);

    mask.addEventListener("click", (event) => {
      if (event.target === mask || event.target.closest("[data-v1723-session-cancel]")) closeDialog();
      if (event.target.closest("[data-v1723-session-confirm]")) confirmDialog();
    });
    mask.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDialog();
      if (event.key === "Enter" && dialogState?.type === "rename") confirmDialog();
    });
    return mask;
  }

  function openDialog(type, button) {
    if (!button || !isNovelMode()) return;
    const mask = ensureDialog();
    const item = button.closest(".session-item");
    const title = item?.querySelector(".session-title");
    const name = String(title?.textContent || "当前会话").trim();
    const id = button.dataset.id || title?.dataset.id || "";
    dialogState = { type, id, name, button };

    const heading = mask.querySelector("#novelV1723SessionDialogTitle");
    const text = mask.querySelector("#novelV1723SessionDialogText");
    const input = mask.querySelector("#novelV1723SessionDialogInput");
    const confirm = mask.querySelector("[data-v1723-session-confirm]");

    if (type === "rename") {
      heading.textContent = "重命名会话";
      text.textContent = "给这个对话一个更容易识别的名字。";
      input.hidden = false;
      input.value = name;
      confirm.textContent = "保存名称";
      confirm.classList.remove("danger");
    } else {
      heading.textContent = "删除这个对话？";
      text.textContent = `“${name}”中的聊天记录将从当前浏览器移除。此操作无法撤销。`;
      input.hidden = true;
      input.value = "";
      confirm.textContent = "删除对话";
      confirm.classList.add("danger");
    }

    mask.hidden = false;
    document.body.classList.add("novel-v1723-dialog-open");
    requestAnimationFrame(() => mask.classList.add("open"));
    if (type === "rename") requestAnimationFrame(() => { input.focus(); input.select(); });
    else requestAnimationFrame(() => confirm.focus());
  }

  function closeDialog() {
    const mask = document.getElementById("novelV1723SessionDialog");
    if (!mask) return;
    mask.classList.remove("open");
    document.body.classList.remove("novel-v1723-dialog-open");
    window.setTimeout(() => { if (!mask.classList.contains("open")) mask.hidden = true; }, 130);
    dialogState = null;
  }

  function invokeCoreButton(button, shimName, shimValue) {
    if (!button?.isConnected) return false;
    const original = window[shimName];
    bypassCoreAction = true;
    try {
      window[shimName] = () => shimValue;
      button.click();
      return true;
    } finally {
      window[shimName] = original;
      bypassCoreAction = false;
    }
  }

  function findCoreButton(kind, id) {
    const selector = kind === "rename" ? ".rename-session" : ".delete-session";
    return document.querySelector(`#sessionList ${selector}[data-id="${CSS.escape(String(id))}"]`);
  }

  function deleteWithCore(state) {
    const itemCount = document.querySelectorAll("#sessionList .session-item").length;
    const finish = () => {
      const button = findCoreButton("delete", state.id);
      if (button) invokeCoreButton(button, "confirm", true);
      decorateSessionList();
    };

    if (itemCount > 1) {
      finish();
      return;
    }

    // The old core requires at least one session. Create the replacement first,
    // then let the proven core delete the original session normally.
    document.getElementById("newSessionBtn")?.click();
    window.setTimeout(() => {
      finish();
      const panel = document.getElementById("sessionPanel");
      if (panel && !panel.classList.contains("open")) document.getElementById("sessionBtn")?.click();
    }, 30);
  }

  function confirmDialog() {
    const state = dialogState;
    if (!state) return;
    const mask = ensureDialog();
    if (state.type === "rename") {
      const value = String(mask.querySelector("#novelV1723SessionDialogInput")?.value || "").trim();
      if (!value) return;
      const button = findCoreButton("rename", state.id) || state.button;
      invokeCoreButton(button, "prompt", value);
      closeDialog();
      window.setTimeout(decorateSessionList, 0);
      return;
    }
    closeDialog();
    deleteWithCore(state);
  }

  function captureSessionActions(event) {
    if (bypassCoreAction || !isNovelMode()) return;
    const rename = event.target?.closest?.("#sessionList .rename-session");
    const remove = event.target?.closest?.("#sessionList .delete-session");
    const button = rename || remove;
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openDialog(rename ? "rename" : "delete", button);
  }

  function bindObserver() {
    const list = document.getElementById("sessionList");
    if (!list) return;
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => decorateSessionList());
    observer.observe(list, { childList: true, subtree: true });
    decorateSessionList();
  }

  function refresh() {
    if (!isNovelMode()) {
      closeDialog();
      return false;
    }
    bindObserver();
    decorateSessionList();
    return true;
  }

  document.addEventListener("click", captureSessionActions, true);
  window.addEventListener("uai:mode-refresh", refresh);
  window.addEventListener("uai:workspace-refresh", refresh);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

  window.UnlimitedNovelSessionsV1723B = {
    revision: REVISION,
    refresh,
    decorate: decorateSessionList
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
})();
