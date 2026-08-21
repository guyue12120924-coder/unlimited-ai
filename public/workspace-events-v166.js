// public/workspace-events-v166.js
// V16.6: one event hub for high-frequency novel workspace DOM changes.
(() => {
  const REVISION = "2026-08-21-v16.6-workspace-events";
  if (window.UnlimitedWorkspaceEventsV166) return;

  const pendingReasons = new Map();
  const metrics = {
    workspaceEvents: 0,
    chatEvents: 0,
    modeEvents: 0,
    nativeObserverCallbacks: 0,
    startedAt: Date.now()
  };

  function schedule(key, task) {
    if (window.UnlimitedV3?.schedule) return window.UnlimitedV3.schedule(`v166:${key}`, task);
    requestAnimationFrame(task);
    return true;
  }

  function queue(name, reason = "unknown") {
    let reasons = pendingReasons.get(name);
    if (!reasons) {
      reasons = new Set();
      pendingReasons.set(name, reasons);
    }
    reasons.add(String(reason || "unknown"));

    schedule(name, () => {
      const current = pendingReasons.get(name);
      pendingReasons.delete(name);
      const detail = {
        revision: REVISION,
        reasons: [...(current || [])],
        mode: document.body?.dataset?.uaiMode || ""
      };
      if (name === "workspace") metrics.workspaceEvents += 1;
      else if (name === "chat") metrics.chatEvents += 1;
      else if (name === "mode") metrics.modeEvents += 1;
      window.dispatchEvent(new CustomEvent(`uai:${name}-refresh`, { detail }));
    });
  }

  function workspaceMutation(records) {
    metrics.nativeObserverCallbacks += 1;
    if (!records?.length) return;
    queue("workspace", "panel-dom");
  }

  function chatMutation(records) {
    metrics.nativeObserverCallbacks += 1;
    if (!records?.length) return;
    const reason = records.some((record) => record.type === "attributes") ? "chat-state" : "chat-dom";
    queue("chat", reason);
  }

  function modeMutation(records) {
    metrics.nativeObserverCallbacks += 1;
    if (!records?.some((record) => record.attributeName === "data-uai-mode")) return;
    queue("mode", "mode-attribute");
    queue("workspace", "mode-attribute");
  }

  function bindDomObservers() {
    const Observer = window.UnlimitedV3?.NativeMutationObserver || window.MutationObserver;
    if (typeof Observer !== "function") return;

    const panel = document.getElementById("studioPanelBody");
    if (panel) {
      const observer = new Observer(workspaceMutation);
      observer.observe(panel, { childList: true, subtree: true });
      window.UnlimitedWorkspaceEventsV166.panelObserver = observer;
    }

    const chat = document.getElementById("chat");
    if (chat) {
      const observer = new Observer(chatMutation);
      observer.observe(chat, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["class", "data-added-chapter-id"]
      });
      window.UnlimitedWorkspaceEventsV166.chatObserver = observer;
    }

    if (document.body) {
      const observer = new Observer(modeMutation);
      observer.observe(document.body, { attributes: true, attributeFilter: ["data-uai-mode"] });
      window.UnlimitedWorkspaceEventsV166.modeObserver = observer;
    }
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.(".studio-tabs, #studioLibrary, #studioPanel")) {
        queue("workspace", "workspace-click");
      }
    }, true);

    document.addEventListener("input", (event) => {
      if (event.target?.closest?.("#studioPanelBody") || event.target?.id === "simpleManuscriptEditor") {
        queue("workspace", "workspace-input");
      }
    }, true);

    document.addEventListener("change", (event) => {
      if (event.target?.closest?.("#studioPanelBody")) queue("workspace", "workspace-change");
    }, true);

    window.addEventListener("storage", (event) => {
      if (["cfw_studio_workspace_v1", "cfw_sessions_v2"].includes(event.key)) {
        queue("workspace", "storage");
      }
    });
  }

  function refresh(reason = "manual") {
    queue("workspace", reason);
  }

  window.UnlimitedWorkspaceEventsV166 = {
    revision: REVISION,
    metrics,
    refresh,
    queueWorkspace: (reason) => queue("workspace", reason),
    queueChat: (reason) => queue("chat", reason),
    panelObserver: null,
    chatObserver: null,
    modeObserver: null
  };

  document.documentElement.dataset.workspaceEventsRevision = REVISION;
  bindEvents();
  bindDomObservers();
  queue("workspace", "initial");
})();
