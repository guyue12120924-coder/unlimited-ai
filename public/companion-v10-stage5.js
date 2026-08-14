// Companion V10.8 — final UI-only sidecar enrichment and modal polish hooks.
(() => {
  const REVISION = "2026-08-14-v10.8-stage5-1";
  let scheduled = false;

  function state() {
    return window.UnlimitedCompanion?.getState?.() || {};
  }

  function relationshipStats() {
    const current = state();
    const profile = current.profile || {};
    const sessions = Array.isArray(current.sessions) ? current.sessions : [];
    const messages = sessions.reduce((sum, session) => sum + (Array.isArray(session?.messages) ? session.messages.length : 0), 0);
    const createdAt = Number(profile.createdAt || 0);
    const days = createdAt ? Math.max(1, Math.floor((Date.now() - createdAt) / 86400000) + 1) : 1;
    return { sessions: sessions.length, messages, days };
  }

  function stageFor(stats) {
    if (stats.days >= 7 && stats.messages >= 180 && stats.sessions >= 8) {
      return { label: "很有默契", progress: 92, note: "已经形成比较稳定的长期互动。" };
    }
    if (stats.days >= 3 && stats.messages >= 70 && stats.sessions >= 4) {
      return { label: "渐渐亲近", progress: 68, note: "共同话题和聊天记忆正在积累。" };
    }
    if (stats.messages >= 20 || stats.sessions >= 2) {
      return { label: "越来越熟", progress: 42, note: "你们已经不只是第一次聊天了。" };
    }
    return { label: "刚刚认识", progress: 18, note: "多聊几次，这里会慢慢留下更多记录。" };
  }

  function makeAction(icon, label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.stage5Action = action;
    const badge = document.createElement("span");
    badge.textContent = icon;
    const text = document.createElement("b");
    text.textContent = label;
    const arrow = document.createElement("i");
    arrow.textContent = "›";
    button.append(badge, text, arrow);
    return button;
  }

  function ensureProgress(sidecar) {
    let card = sidecar.querySelector(".uai-c-v10-sidecar-progress");
    if (!card) {
      card = document.createElement("div");
      card.className = "uai-c-v10-sidecar-progress";
      card.innerHTML = `
        <div class="uai-c-v10-sidecar-progress-head"><span>关系状态</span><strong></strong></div>
        <div class="uai-c-v10-sidecar-progress-track"><i></i></div>
        <p></p>`;
      const stats = sidecar.querySelector(".uai-c-v10-sidecar-stats");
      stats?.insertAdjacentElement("afterend", card);
    }

    const stage = stageFor(relationshipStats());
    const label = card.querySelector("strong");
    const fill = card.querySelector(".uai-c-v10-sidecar-progress-track i");
    const note = card.querySelector("p");
    if (label) label.textContent = stage.label;
    if (fill) fill.style.width = `${stage.progress}%`;
    if (note) note.textContent = stage.note;
  }

  function ensureRelationshipTools(root, sidecar) {
    let section = sidecar.querySelector(".uai-c-v10-sidecar-relationship");
    if (!section) {
      section = document.createElement("div");
      section.className = "uai-c-v10-sidecar-section uai-c-v10-sidecar-relationship";
      const label = document.createElement("span");
      label.className = "uai-c-v10-sidecar-label";
      label.textContent = "关系与回顾";
      section.appendChild(label);
      section.appendChild(makeAction("♡", "关系记录", "relationship"));
      section.appendChild(makeAction("◌", "本月回顾", "review"));
      const note = sidecar.querySelector(".uai-c-v10-sidecar-note");
      if (note) note.insertAdjacentElement("beforebegin", section);
      else sidecar.querySelector(".uai-c-v10-sidecar-inner")?.appendChild(section);

      section.addEventListener("click", (event) => {
        const button = event.target.closest("[data-stage5-action]");
        if (!button) return;
        if (button.dataset.stage5Action === "relationship") {
          window.UnlimitedCompanionProfileRestore?.showCharacterProfile?.();
        }
        if (button.dataset.stage5Action === "review") {
          window.UnlimitedCompanionExtras?.showMonthlyReview?.();
        }
      });
    }

    const note = sidecar.querySelector(".uai-c-v10-sidecar-note");
    if (note && note.dataset.stage5Copy !== "1") {
      note.dataset.stage5Copy = "1";
      note.textContent = "角色资料、聊天和长期记忆都只保存在当前浏览器。";
    }

    const memoryButton = sidecar.querySelector('[data-sidecar-action="memory"]');
    if (memoryButton) memoryButton.title = "查看和整理当前角色的长期记忆";
    const settingsButton = sidecar.querySelector('[data-sidecar-action="settings"]');
    if (settingsButton) settingsButton.title = "调整模型、回复长度和数据设置";
    const roleButton = sidecar.querySelector('[data-sidecar-action="role"]');
    if (roleButton) roleButton.title = "修改当前角色的名字、关系和完整设定";
  }

  function tagOpenSurfaces() {
    const settings = document.querySelector("#uaiCompanionModalMask .uai-c-v10-settings");
    if (settings) settings.dataset.v10Stage5 = "settings";

    const memory = document.querySelector("#uaiCompanionV4Mask .uai-c-v4-modal");
    if (memory) memory.dataset.v10Stage5 = "memory";

    const relationship = document.querySelector("#uaiCompanionV5Mask .uai-c-v5-modal.profile");
    if (relationship) relationship.dataset.v10Stage5 = "relationship";

    const review = document.querySelector("#uaiV8ReviewMask .uai-c-v8-review-modal");
    if (review) review.dataset.v10Stage5 = "review";
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root || root.hidden) return;

    const sidecar = root.querySelector(".uai-c-v10-sidecar");
    if (sidecar) {
      ensureProgress(sidecar);
      ensureRelationshipTools(root, sidecar);
    }
    tagOpenSurfaces();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionV10Stage5Revision = REVISION;
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode"]
    });
    window.addEventListener("resize", schedule, { passive: true });
    window.UnlimitedCompanionV10Stage5 = { revision: REVISION, refresh: schedule };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
