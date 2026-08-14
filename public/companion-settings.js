// Companion V9 settings UI: reply length presets, backups and low-frequency data actions.
(() => {
  const REVISION = "2026-08-14-v9.4-settings-scene-backup-1";
  // Compatibility marker for existing contracts: v9.3-settings
  const KEYS = { rollback: "uai_companion_import_rollback_v1" };
  const LENGTH_PRESETS = [
    ["short", "约 500 字", "短一些"],
    ["balanced", "约 1000 字", "默认"],
    ["detailed", "约 5000 字", "长回复"]
  ];
  let scheduled = false;

  function ensureSceneBackupBridge() {
    if (document.getElementById("uaiCompanionSceneBackupScript")) return;
    const script = document.createElement("script");
    script.id = "uaiCompanionSceneBackupScript";
    script.src = `/companion-scene-backup.js?v=${encodeURIComponent(REVISION)}`;
    script.async = false;
    document.body.appendChild(script);
  }

  function openBackupImport() {
    if (window.UnlimitedCompanionSceneBackup?.chooseBackupFile) {
      window.UnlimitedCompanionSceneBackup.chooseBackupFile();
      return;
    }
    window.UnlimitedCompanionProfileRestore?.chooseBackupFile?.();
  }

  function restoreBackupRollback() {
    if (window.UnlimitedCompanionSceneBackup?.restoreRollback) {
      window.UnlimitedCompanionSceneBackup.restoreRollback();
      return;
    }
    window.UnlimitedCompanionProfileRestore?.restoreRollback?.();
  }

  function ensureLengthPills(modal) {
    const select = modal.querySelector("#uaiCompanionReplyLength");
    if (!select || select.dataset.v9Ready === "1") return;
    select.dataset.v9Ready = "1";
    select.classList.add("uai-c-v8-native-hidden");
    const pills = document.createElement("div");
    pills.className = "uai-c-v8-length-pills";
    const refresh = () => pills.querySelectorAll("button").forEach((button) => button.classList.toggle("selected", button.dataset.value === select.value));
    LENGTH_PRESETS.forEach(([value, label, hint]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.value = value;
      button.innerHTML = `<strong>${label}</strong><span>${hint}</span>`;
      button.addEventListener("click", () => {
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        refresh();
      });
      pills.appendChild(button);
    });
    select.insertAdjacentElement("afterend", pills);
    refresh();
  }

  function ensureDataPanel(modal) {
    if (modal.querySelector("#uaiV9DataPanel")) return;
    const clear = modal.querySelector("#uaiCompanionClearCurrent");
    const reset = modal.querySelector("#uaiCompanionReset");
    const oldExport = modal.querySelector("#uaiCompanionExport");
    const oldActions = oldExport?.closest(".uai-c-modal-actions") || clear?.closest(".uai-c-modal-actions");
    if (!oldActions) return;

    const details = document.createElement("details");
    details.id = "uaiV9DataPanel";
    details.className = "uai-c-v8-data-panel";
    details.innerHTML = `<summary><span>数据与备份</span><b>›</b></summary>`;
    const body = document.createElement("div");
    body.className = "uai-c-v8-data-body";

    const backup = document.createElement("div");
    backup.className = "uai-c-v8-data-row";
    const exportAll = document.createElement("button");
    exportAll.type = "button";
    exportAll.textContent = "导出全部角色";
    exportAll.addEventListener("click", () => window.UnlimitedCompanionRuntime?.exportAllCharacters?.());
    const importAll = document.createElement("button");
    importAll.type = "button";
    importAll.textContent = "导入备份";
    importAll.addEventListener("click", openBackupImport);
    backup.append(exportAll, importAll);

    if (localStorage.getItem(KEYS.rollback)) {
      const rollback = document.createElement("button");
      rollback.type = "button";
      rollback.textContent = "撤销上次导入";
      rollback.addEventListener("click", restoreBackupRollback);
      backup.appendChild(rollback);
    }
    body.appendChild(backup);

    if (clear || reset) {
      const dangerTitle = document.createElement("p");
      dangerTitle.className = "uai-c-v8-danger-title";
      dangerTitle.textContent = "危险操作";
      body.appendChild(dangerTitle);
      const danger = document.createElement("div");
      danger.className = "uai-c-v8-danger-row";
      if (clear) danger.appendChild(clear);
      if (reset) {
        reset.textContent = "重置全部陪伴数据";
        danger.appendChild(reset);
      }
      body.appendChild(danger);
    }

    details.appendChild(body);
    oldExport?.remove();
    oldActions.replaceWith(details);
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const mask = document.getElementById("uaiCompanionModalMask");
    if (!mask || mask.hidden) return;
    const modal = mask.querySelector(".uai-c-modal");
    const model = modal?.querySelector("#uaiCompanionModel");
    const reply = modal?.querySelector("#uaiCompanionReplyLength");
    if (!modal || !model || !reply) return;

    modal.classList.add("uai-c-v9-settings");
    const title = modal.querySelector(".uai-c-modal-head h3");
    const desc = modal.querySelector(".uai-c-modal-head p");
    if (title) title.textContent = "设置";
    if (desc) desc.textContent = "模型、回复长度和长期记忆。备份与危险操作放在下方。";
    const modelLabel = modal.querySelector('label[for="uaiCompanionModel"]');
    const lengthLabel = modal.querySelector('label[for="uaiCompanionReplyLength"]');
    if (modelLabel) modelLabel.textContent = "模型";
    if (lengthLabel) lengthLabel.textContent = "回复长度";
    modal.querySelector(".uai-c-stat-grid")?.classList.add("uai-c-v8-hidden");
    ensureLengthPills(modal);
    ensureDataPanel(modal);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.companionSettingsRevision = REVISION;
    ensureSceneBackupBridge();
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "data-uai-mode"]
    });
    schedule();
  }

  window.UnlimitedCompanionSettings = { revision: REVISION, refresh: schedule };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
