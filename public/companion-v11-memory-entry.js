// Companion V11.2.1 — make memory management visible from the simple memory editor.
(() => {
  const REVISION = "2026-08-14-v11.2.1-memory-entry-1";
  let scheduled = false;

  function ensureStyle() {
    if (document.getElementById("uaiCompanionV11MemoryEntryStyle")) return;
    const style = document.createElement("style");
    style.id = "uaiCompanionV11MemoryEntryStyle";
    style.textContent = `
      #uaiCompanionModalMask .uai-c-v11-memory-entry{
        display:flex;align-items:center;justify-content:space-between;gap:16px;
        margin:0 0 14px;padding:13px 14px;
        border:1px solid rgba(111,85,197,.10);border-radius:14px;
        background:linear-gradient(135deg,rgba(139,92,246,.07),rgba(236,72,153,.04),rgba(255,255,255,.88));
      }
      #uaiCompanionModalMask .uai-c-v11-memory-entry-copy{min-width:0}
      #uaiCompanionModalMask .uai-c-v11-memory-entry-copy strong{
        display:block;color:#4b4059;font-size:11px;font-weight:760;
      }
      #uaiCompanionModalMask .uai-c-v11-memory-entry-copy span{
        display:block;margin-top:3px;color:#9a90a5;font-size:9.5px;line-height:1.5;
      }
      #uaiCompanionModalMask .uai-c-v11-memory-manage-visible{
        flex:0 0 auto;min-height:38px;padding:0 13px;
        border:1px solid rgba(124,58,237,.18);border-radius:11px;
        background:linear-gradient(135deg,#8b5cf6,#7c3aed 68%,#c14fc2 140%);
        box-shadow:0 8px 20px rgba(124,58,237,.16);
        color:#fff;font-size:10px;font-weight:730;cursor:pointer;
      }
      #uaiCompanionModalMask .uai-c-v11-memory-manage-visible:hover{
        transform:translateY(-1px);box-shadow:0 10px 24px rgba(124,58,237,.21);
      }
      #uaiCompanionModalMask .uai-c-memory-add{
        gap:10px!important;align-items:center!important;
      }
      #uaiCompanionModalMask .uai-c-memory-add input{
        min-height:44px!important;padding:0 13px!important;
        border:1px solid rgba(111,85,197,.13)!important;border-radius:12px!important;
        background:#fbfaff!important;color:#403749!important;
        box-shadow:inset 0 1px 2px rgba(68,49,107,.025)!important;
      }
      #uaiCompanionModalMask .uai-c-memory-add input::placeholder{color:#aaa0b2!important}
      #uaiCompanionModalMask .uai-c-memory-add input:focus{
        outline:none!important;border-color:rgba(124,58,237,.30)!important;
        box-shadow:0 0 0 3px rgba(139,92,246,.075)!important;
      }
      #uaiCompanionModalMask .uai-c-v10-memory-advanced summary span{font-size:10px!important}
      @media (max-width:640px){
        #uaiCompanionModalMask .uai-c-v11-memory-entry{align-items:flex-start;flex-direction:column}
        #uaiCompanionModalMask .uai-c-v11-memory-manage-visible{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  function openOrganizer(mask) {
    const api = window.UnlimitedCompanionMemorySearch;
    if (api?.showMemoryOrganizer) {
      mask.hidden = true;
      mask.innerHTML = "";
      api.showMemoryOrganizer();
      return;
    }
    const details = mask.querySelector("#uaiV10MemoryAdvanced");
    if (details) {
      details.open = true;
      details.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function decorateSimpleMemoryModal() {
    const mask = document.getElementById("uaiCompanionModalMask");
    if (!mask || mask.hidden || !mask.querySelector("#uaiMemoryList")) return;
    const modal = mask.querySelector(".uai-c-modal");
    const body = modal?.querySelector(".uai-c-modal-body");
    if (!modal || !body) return;

    modal.classList.add("uai-c-v11-simple-memory");

    let entry = body.querySelector(":scope > .uai-c-v11-memory-entry");
    if (!entry) {
      entry = document.createElement("div");
      entry.className = "uai-c-v11-memory-entry";
      entry.innerHTML = `
        <div class="uai-c-v11-memory-entry-copy">
          <strong>需要整理已有记忆？</strong>
          <span>进入管理模式后可以查看记忆册、置顶、归档、恢复和去重。</span>
        </div>
        <button type="button" class="uai-c-v11-memory-manage-visible">管理记忆</button>`;
      body.insertBefore(entry, body.firstChild);
      entry.querySelector(".uai-c-v11-memory-manage-visible")?.addEventListener("click", () => openOrganizer(mask));
    }

    const advanced = modal.querySelector("#uaiV10MemoryAdvanced summary span");
    if (advanced) advanced.textContent = "更多操作";
  }

  function enhance() {
    scheduled = false;
    ensureStyle();
    if (document.body.dataset.uaiMode !== "companion") return;
    decorateSimpleMemoryModal();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    ensureStyle();
    document.documentElement.dataset.companionV11MemoryEntryRevision = REVISION;
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode"]
    });
    window.UnlimitedCompanionV11MemoryEntry = { revision: REVISION, refresh: schedule };
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();