(() => {
  const REVISION = "2026-08-13-v8.0-secondary-1";
  let scheduled = false;

  function enhanceMemoryModal() {
    const mask = document.getElementById("uaiCompanionModalMask");
    if (!mask || mask.hidden || !mask.querySelector("#uaiMemoryList")) return;
    const actions = mask.querySelector("#uaiMemorySave")?.closest(".uai-c-modal-actions");
    if (!actions || actions.querySelector("#uaiV8AdvancedMemory")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.id = "uaiV8AdvancedMemory";
    button.className = "uai-c-text-btn";
    button.textContent = "高级整理";
    button.addEventListener("click", () => {
      mask.hidden = true;
      mask.innerHTML = "";
      window.UnlimitedCompanionMemorySearch?.showMemoryOrganizer?.();
    });
    actions.insertBefore(button, actions.firstChild);
    const title = mask.querySelector(".uai-c-modal-head h3");
    const desc = mask.querySelector(".uai-c-modal-head p");
    if (title) title.textContent = "长期记忆";
    if (desc) desc.textContent = "只保留真正希望角色长期记住的信息。";
  }

  function enhanceRelationshipRecord() {
    const mask = document.getElementById("uaiCompanionV5Mask");
    const modal = mask?.querySelector(".uai-c-v5-modal.wide");
    if (!modal) return;
    const title = modal.querySelector("header h3");
    const desc = modal.querySelector("header p");
    if (title) title.textContent = "关系记录";
    if (desc) desc.textContent = "时间线、重要时刻和阶段回顾都集中在这里。";
    const header = modal.querySelector("header");
    if (!header || header.querySelector("#uaiV8MonthlyReview")) return;
    const close = header.querySelector("[data-v5-close]");
    const button = document.createElement("button");
    button.type = "button";
    button.id = "uaiV8MonthlyReview";
    button.className = "uai-c-v8-inline-action";
    button.textContent = "本月回顾";
    button.addEventListener("click", () => {
      mask.remove();
      window.UnlimitedCompanionReviewExport?.showMonthlyReview?.();
    });
    if (close) header.insertBefore(button, close);
    else header.appendChild(button);
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    enhanceMemoryModal();
    enhanceRelationshipRecord();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionV8SecondaryRevision = REVISION;
    new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "class", "data-uai-mode"] });
    schedule();
  }

  window.UnlimitedCompanionV8Secondary = { revision: REVISION, refresh: schedule };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();