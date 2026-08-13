(() => {
  const MODEL_LABELS = new Map((window.APP_MODELS || []).map(model => [model.id, model.label]));

  try {
    const allowed = new Set((window.APP_MODELS || []).map((model) => model.id));
    const saved = localStorage.getItem("cfw_model");
    if (!saved || !allowed.has(saved)) {
      const fallback = window.APP_DEFAULT_MODEL || window.APP_MODELS?.[0]?.id;
      if (fallback) localStorage.setItem("cfw_model", fallback);
    }
  } catch {
    // Storage migration is best-effort only.
  }

  const originalFetch = window.fetch.bind(window);

  function labelFor(modelId) {
    return MODEL_LABELS.get(modelId) || modelId || "未知模型";
  }

  function findLatestAiStats() {
    const stats = document.querySelectorAll(".row.ai .stats");
    return stats.length ? stats[stats.length - 1] : null;
  }

  function applyRouteStatus(detail) {
    const stats = findLatestAiStats();
    if (!stats || !detail) return;

    const requested = detail.requested;
    const used = detail.used;
    const fallback = detail.fallback || "";
    if (!requested && !used) return;

    const requestedLabel = labelFor(requested || used);
    const usedLabel = labelFor(used || requested);
    const switched = requested && used && requested !== used;

    stats.dataset.modelRoute = switched
      ? `选择：${requestedLabel} → 实际：${usedLabel}`
      : `实际模型：${usedLabel}`;

    stats.classList.toggle("model-fallback", Boolean(switched));
    if (fallback) stats.title = `自动切换原因：${fallback}`;
    else stats.removeAttribute("title");
  }

  window.addEventListener("unlimited-ai:model-route", (event) => {
    applyRouteStatus(event.detail);
  });

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    try {
      const target = args[0];
      const url = typeof target === "string" ? target : target?.url || "";
      if (url.includes("/api/chat")) {
        const requested = response.headers.get("X-Requested-Model");
        const used = response.headers.get("X-Model-Used");
        const fallback = response.headers.get("X-Model-Fallback");

        window.dispatchEvent(new CustomEvent("unlimited-ai:model-route", {
          detail: { requested, used, fallback }
        }));
      }
    } catch {
      // Model-route display is diagnostic only; never interfere with chat requests.
    }

    return response;
  };

  const style = document.createElement("style");
  style.textContent = `
    .row.ai .stats[data-model-route]::before {
      content: attr(data-model-route) " · ";
      font-weight: 600;
    }
    .row.ai .stats.model-fallback::before {
      text-decoration: underline dotted;
      text-underline-offset: 3px;
    }
  `;
  document.head.appendChild(style);
})();

// Companion role-profile editor: age, personality, background and speaking style share one box.
(() => {
  const REV = "2026-08-13-role-profile-1";
  const MAX = 900;
  const MARK = "完整角色资料";
  const K = {
    chars: "uai_companion_characters_v1",
    active: "uai_companion_active_character_v1",
    profile: "uai_companion_profile_v1"
  };
  let queued = false;

  const parse = (v, f) => { try { return JSON.parse(v) ?? f; } catch { return f; } };
  const read = (k, f) => parse(localStorage.getItem(k), f);
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const clean = (v) => String(v || "").replace(/\r\n?/g, "\n").trim().slice(0, MAX);
  const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const chars = () => {
    const v = read(K.chars, []);
    return Array.isArray(v) ? v.filter((x) => x?.id && x?.profile) : [];
  };
  const activeId = () => localStorage.getItem(K.active) || "";
  const template = () => [
    "年龄：", "身份/职业：", "外貌：", "性格：", "成长经历/背景：",
    "兴趣与习惯：", "说话方式：", "和我的关系：", "其他长期设定："
  ].join("\n");
  const relations = (selected) => [
    ["girlfriend", "💗 女朋友"], ["boyfriend", "💙 男朋友"],
    ["friend", "🌙 好朋友"], ["confidant", "✨ 知心伙伴"],
    ["custom", "🪄 自定义关系"]
  ].map(([v, t]) => `<option value="${v}"${v === selected ? " selected" : ""}>${t}</option>`).join("");

  function hideChips(scope, selector, attr) {
    const first = scope?.querySelector(selector);
    if (!first) return;
    const field = first.closest(".uai-c-field") || first.closest(".uai-c-v3-personalities")?.parentElement;
    const host = first.closest(".uai-c-chip-grid") || first.closest(".uai-c-v3-personalities");
    if (!field || !host) return;
    host.innerHTML = "";
    const marker = document.createElement("button");
    marker.type = "button";
    marker.hidden = true;
    marker.className = "selected";
    marker.setAttribute(attr, MARK);
    host.appendChild(marker);
    field.style.display = "none";
  }

  function decorateBase() {
    const scope = document.querySelector("#uaiCompanionModalMask:not([hidden])");
    const box = scope?.querySelector("#uaiOnboardDesc, #uaiCharacterDesc");
    if (!box || box.dataset.roleProfileReady) return;
    box.dataset.roleProfileReady = "1";
    box.maxLength = MAX;
    box.classList.add("uai-role-profile-box");
    box.placeholder = template();
    const field = box.closest(".uai-c-field");
    const label = field?.querySelector("label");
    if (label) label.textContent = box.id === "uaiOnboardDesc" ? "完整角色设定（可选）" : "完整角苲设定";
    field?.insertAdjacentHTML("beforeend", '<small class="uai-role-profile-note">年龄、性格、外貌、身份、经历、习惯和说话方式都写在这一个框里。</small>');
    hideChips(scope, "[data-personality]", "data-personality");
    if (box.id === "uaiOnboardDesc") {
      const intro = scope.querySelector(".uai-c-onboard-top p");
      if (intro) intro.textContent = "名字、关系和一段完整角色设定就够了，不需要填写很多小项。";
    }
  }

  function decorateCreate() {
    const scope = document.getElementById("uaiCompanionV3Mask");
    const box = scope?.querySelector("#uaiV3CharacterDesc");
    if (!box || box.dataset.roleProfileReady) return;
    box.dataset.roleProfileReady = "1";
    box.maxLength = MAX;
    box.classList.add("uai-role-profile-box");
    box.placeholder = template();
    const label = box.closest("label");
    if (label?.firstChild) label.firstChild.textContent = "完整角苲设定";
    label?.insertAdjacentHTML("beforeend", '<small class="uai-role-profile-note">年龄、性格、外貌、身份、经历和说话方式都可以直接整段填写。</small>');
    hideChips(scope, "[data-v3-personality]", "data-v3-personality");
  }

  function normalizeActive() {
    const p = read(K.profile, null);
    if (!p) return;
    write(K.profile, {
      ...p,
      personality: [MARK],
      speakingStyle: [MARK],
      customDescription: clean(p.customDescription)
    });
    window.UnlimitedCompanionMulti?.persist?.();
  }

  const closeEditor = () => document.getElementById("uaiRoleProfileMask")?.remove();

  function refreshActive() {
    window.UnlimitedCompanion?.unmount?.();
    setTimeout(() => {
      window.UnlimitedCompanion?.mount?.();
      window.UnlimitedCompanionPolish?.refresh?.();
      window.UnlimitedCompanionMulti?.refresh?.();
    }, 20);
  }

  function editRole(id) {
    if (document.querySelector("#uaiCompanionInput:disabled")) return alert("AI 正在回复，请等回复结束后再编辑角色。");
    window.UnlimitedCompanionMulti?.persist?.();
    const role = chars().find((x) => x.id === id);
    if (!role) return;
    document.getElementById("uaiCompanionV3Mask")?.remove();
    closeEditor();

    const mask = document.createElement("div");
    mask.id = "uaiRoleProfileMask";
    mask.className = "uai-c-v3-mask";
    mask.innerHTML = `<section class="uai-c-v3-modal compact" role="dialog" aria-modal="true">
      <header><div><span>CHARACTER PROFILE</span><h3>编辑「${esc(role.profile?.name || "未命名")}」</h3><p>每个角苲的资料独立保存。</p></div><button type="button" data-role-close>×</button></header>
      <div class="uai-c-v3-form">
        <label>名字<input id="uaiRoleName" maxlength="40" value="${esc(role.profile?.name || "")}" /></label>
        <label>关系<select id="uaiRoleRelation">${relations(role.profile?.relationship || "girlfriend")}</select></label>
        <label>完整角苲设定<textarea id="uaiRoleProfile" class="uai-role-profile-box" maxlength="${MAX}" placeholder="${esc(template())}">${esc(role.profile?.customDescription || "")}</textarea><small class="uai-role-profile-note">年龄、性格、外貌、身份、经历、习惯和说话方式等全部放这里。</small></label>
      </div>
      <footer><button type="button" class="secondary" data-role-close>取消</button><button type="button" id="uaiRoleSave">保存</button></footer>
    </section>`;
    document.body.appendChild(mask);
    mask.addEventListener("click", (e) => {
      if (e.target === mask || e.target.closest("[data-role-close]")) closeEditor();
    });
    mask.querySelector("#uaiRoleSave")?.addEventListener("click", () => {
      const all = chars();
      const i = all.findIndex((x) => x.id === id);
      if (i < 0) return;
      const item = all[i];
      item.profile = {
        ...item.profile,
        name: String(mask.querySelector("#uaiRoleName")?.value || item.profile?.name || "新伙伴").trim().slice(0, 40) || "新伙伴",
        relationship: mask.querySelector("#uaiRoleRelation")?.value || item.profile?.relationship || "girlfriend",
        personality: [MARK],
        speakingStyle: [MARK],
        customDescription: clean(mask.querySelector("#uaiRoleProfile")?.value)
      };
      item.updatedAt = Date.now();
      all[i] = item;
      write(K.chars, all);
      if (id === activeId()) {
        write(K.profile, item.profile);
        closeEditor();
        refreshActive();
      } else {
        closeEditor();
        window.UnlimitedCompanionMulti?.showCharacterManager?.();
      }
    });
  }

  function decorateManager() {
    const scope = document.getElementById("uaiCompanionV3Mask");
    if (!scope || scope.querySelector("#uaiV3CharacterDesc")) return;
    scope.querySelectorAll(".uai-c-v3-character-card[data-character-id]").forEach((card) => {
      const actions = card.querySelector(".uai-c-v3-character-actions");
      if (!actions || actions.querySelector("[data-role-edit]")) return;
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.roleEdit = "1";
      b.textContent = "编辑";
      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        editRole(card.dataset.characterId);
      });
      const del = actions.querySelector("[data-delete-character]");
      del ? actions.insertBefore(b, del) : actions.appendChild(b);
    });
  }

  function ensureStyle() {
    if (document.getElementById("uaiRoleProfileStyle")) return;
    const s = document.createElement("style");
    s.id = "uaiRoleProfileStyle";
    s.textContent = ".uai-role-profile-box{min-height:220px!important;resize:vertical!important;line-height:1.7!important}.uai-role-profile-note{display:block;margin-top:7px;opacity:.58;font-size:11px;line-height:1.6}@media(max-width:640px){.uai-role-profile-box{min-height:180px!important}}";
    document.head.appendChild(s);
  }

  function enhance() {
    queued = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    ensureStyle();
    decorateBase();
    decorateCreate();
    decorateManager();
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(enhance);
  }

  function init() {
    document.documentElement.dataset.roleProfileRevision = REV;
    document.addEventListener("click", (e) => {
      const id = e.target?.closest?.("button")?.id;
      if (["uaiOnboardCreate", "uaiCharacterSave", "uaiV3CreateCharacter"].includes(id)) setTimeout(normalizeActive, 60);
    }, true);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeEditor(); });
    const o = new MutationObserver(schedule);
    o.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "class", "data-uai-mode"] });
    schedule();
  }

  window.UnlimitedRoleProfile = { revision: REV, editRole, refresh: schedule };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
