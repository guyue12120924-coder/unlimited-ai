// public/simple-studio.js
// Minimal writing workspace for the four primary tabs.
(() => {
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const CONTEXT_TAIL_CHARS = 6500;
  const CHARACTER_FIELDS = [
    ["personality", "性格"],
    ["appearance", "外貌"],
    ["goal", "核心目标"],
    ["voice", "说话特点"],
    ["secret", "人物秘密"],
    ["status", "当前状态"],
    ["notes", "备注"]
  ];
  const WORLD_FIELDS = [
    ["overview", "世界观概述"],
    ["rules", "世界规则"],
    ["locations", "地点"],
    ["factions", "势力 / 组织"],
    ["items", "重要物品"]
  ];
  let observer = null;

  function readState() {
    try {
      const value = JSON.parse(localStorage.getItem(LS_STUDIO) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function activeData() {
    const state = readState();
    const projects = Array.isArray(state.projects) ? state.projects : [];
    const project = projects.find((item) => item.id === state.activeProjectId) || projects[0] || null;
    const chapter = project?.chapters?.find((item) => item.id === state.activeChapterId) || null;
    return { state, project, chapter };
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function countWords(text) {
    return String(text || "").replace(/\s/g, "").length;
  }

  function simplifyTabs() {
    document.querySelectorAll(".studio-tabs [data-studio-tab]").forEach((button) => {
      const keep = ["draft", "outline", "characters", "world"].includes(button.dataset.studioTab);
      button.hidden = !keep;
    });
  }

  function activeTab() {
    return document.querySelector(".studio-tabs [data-studio-tab].active")?.dataset.studioTab || "draft";
  }

  function stabilizeControl(control) {
    if (!control || control.dataset.simpleInteractionGuard === "1") return;
    control.dataset.simpleInteractionGuard = "1";
    const isField = control.matches("input, textarea, select");

    ["pointerdown", "mousedown", "mouseup", "click"].forEach((type) => {
      control.addEventListener(type, (event) => {
        event.stopPropagation();
        if (isField && (type === "mouseup" || type === "click")) {
          requestAnimationFrame(() => {
            if (!document.contains(control) || control.disabled) return;
            if (document.activeElement !== control) {
              try { control.focus({ preventScroll: true }); } catch { control.focus(); }
            }
          });
        }
      });
    });
  }

  function stabilizePanelControls() {
    const panel = document.getElementById("studioPanelBody");
    if (!panel) return;
    panel.querySelectorAll("input, textarea, select, button").forEach(stabilizeControl);
  }

  function parseLabeledText(value, fields) {
    const text = String(value || "").trim();
    const result = Object.fromEntries(fields.map(([key]) => [key, ""]));
    if (!text) return result;

    const labels = fields.map(([, label]) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const marker = new RegExp(`【(${labels.join("|")})】`, "g");
    const matches = [...text.matchAll(marker)];
    if (!matches.length) {
      result[fields.at(-1)[0]] = text;
      return result;
    }

    matches.forEach((match, index) => {
      const label = match[1];
      const key = fields.find(([, itemLabel]) => itemLabel === label)?.[0];
      if (!key) return;
      const start = match.index + match[0].length;
      const end = matches[index + 1]?.index ?? text.length;
      result[key] = text.slice(start, end).trim();
    });
    return result;
  }

  function serializeLabeledText(values, fields) {
    return fields
      .map(([key, label]) => {
        const value = String(values[key] || "").trim();
        return value ? `【${label}】\n${value}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
  }

  function renderSimpleDraft() {
    const body = document.getElementById("studioPanelBody");
    if (!body || activeTab() !== "draft") return;
    if (body.querySelector("#simpleManuscriptPane")) return;

    const { chapter } = activeData();
    if (!chapter) {
      body.innerHTML = `
        <div id="simpleManuscriptPane" class="studio-pane simple-manuscript-pane simple-manuscript-empty">
          <strong>先选择一个章节</strong>
          <p>从左侧章节列表选择章节，然后回到“正文”即可开始写作。</p>
        </div>`;
      return;
    }

    if (typeof chapter.manuscript !== "string") chapter.manuscript = "";
    const words = countWords(chapter.manuscript);
    const target = Math.max(100, Number(chapter.targetWords) || 3000);

    body.innerHTML = `
      <div id="simpleManuscriptPane" class="studio-pane simple-manuscript-pane">
        <div class="simple-manuscript-head">
          <div><span>正文</span><h3>${escapeHtml(chapter.name || "未命名章节")}</h3></div>
          <strong id="simpleManuscriptCount">${words.toLocaleString()} / ${target.toLocaleString()} 字</strong>
        </div>
        <textarea id="simpleManuscriptEditor" data-chapter-field="manuscript" placeholder="直接在这里写正文……" spellcheck="false">${escapeHtml(chapter.manuscript)}</textarea>
        <div class="simple-manuscript-footer">
          <span id="simpleManuscriptStatus">自动保存</span>
          <div><button id="simpleCopyManuscript" type="button">复制正文</button><button id="simpleExportManuscript" type="button">导出 TXT</button></div>
        </div>
      </div>`;
  }

  function enhanceOutline() {
    const body = document.getElementById("studioPanelBody");
    if (!body || activeTab() !== "outline" || body.dataset.simpleOutlineReady === "1") return;
    body.dataset.simpleOutlineReady = "1";

    const chapterEditor = body.querySelector(".chapter-editor");
    if (chapterEditor) {
      chapterEditor.classList.add("simple-section-card");
      chapterEditor.querySelector('[data-chapter-field="summary"]')?.closest("label")?.querySelector("span")?.replaceChildren("当前章节摘要");
      chapterEditor.querySelector('[data-chapter-field="notes"]')?.closest("label")?.querySelector("span")?.replaceChildren("本章写作目标与备注");
    }

    const description = body.querySelector('[data-project-field="description"]');
    const synopsis = body.querySelector('[data-project-field="synopsis"]');
    const outline = body.querySelector('[data-project-field="outline"]');
    description?.closest("label")?.querySelector("span")?.replaceChildren("作品简介");
    synopsis?.closest("label")?.querySelector("span")?.replaceChildren("故事梗概");
    outline?.closest("label")?.querySelector("span")?.replaceChildren("总体大纲");

    const firstProjectLabel = description?.closest("label");
    if (firstProjectLabel && !body.querySelector(".simple-section-title[data-section='story']")) {
      firstProjectLabel.insertAdjacentHTML("beforebegin", `<div class="simple-section-title" data-section="story"><strong>整部作品</strong><span>简介、核心冲突与整体结构</span></div>`);
    }

    body.querySelector(".autosave-note")?.replaceChildren("自动保存 · 这些资料会在需要时自动提供给 AI 作为创作上下文。");
  }

  function enhanceCharacters() {
    const body = document.getElementById("studioPanelBody");
    if (!body || activeTab() !== "characters") return;

    const emptyText = body.querySelector(".studio-empty-state p");
    if (emptyText) emptyText.textContent = "添加人物后，可以分别记录性格、目标、说话方式和当前状态。";

    body.querySelectorAll(".character-card").forEach((card) => {
      if (card.dataset.simpleProfileReady === "1") return;
      const source = card.querySelector("textarea[data-character-note]");
      if (!source) return;
      card.dataset.simpleProfileReady = "1";
      source.classList.add("simple-profile-source");
      source.hidden = true;

      const values = parseLabeledText(source.value, CHARACTER_FIELDS);
      const profile = document.createElement("div");
      profile.className = "simple-character-profile";
      profile.innerHTML = CHARACTER_FIELDS.map(([key, label]) => `
        <label class="${key === "notes" ? "wide" : ""}">
          <span>${escapeHtml(label)}</span>
          <textarea data-character-profile-field="${key}" rows="2" placeholder="填写${escapeHtml(label)}">${escapeHtml(values[key])}</textarea>
        </label>`).join("");
      source.before(profile);

      const saveProfile = () => {
        const next = {};
        profile.querySelectorAll("[data-character-profile-field]").forEach((field) => {
          next[field.dataset.characterProfileField] = field.value;
        });
        source.value = serializeLabeledText(next, CHARACTER_FIELDS);
        source.dispatchEvent(new Event("input", { bubbles: true }));
      };
      profile.addEventListener("input", saveProfile);
    });
  }

  function enhanceWorld() {
    const body = document.getElementById("studioPanelBody");
    if (!body || activeTab() !== "world") return;
    const source = body.querySelector('textarea[data-project-field="world"]');
    if (source && source.dataset.simpleWorldReady !== "1") {
      source.dataset.simpleWorldReady = "1";
      const sourceLabel = source.closest("label");
      const values = parseLabeledText(source.value, WORLD_FIELDS);
      const wrapper = document.createElement("section");
      wrapper.className = "simple-world-fields simple-section-card";
      wrapper.innerHTML = `
        <div class="simple-section-title"><strong>世界设定</strong><span>只填和故事真正有关的规则与信息</span></div>
        <div class="simple-world-grid">
          ${WORLD_FIELDS.map(([key, label]) => `
            <label class="${key === "overview" || key === "rules" ? "wide" : ""}">
              <span>${escapeHtml(label)}</span>
              <textarea data-world-field="${key}" rows="3" placeholder="填写${escapeHtml(label)}">${escapeHtml(values[key])}</textarea>
            </label>`).join("")}
        </div>`;
      sourceLabel?.before(wrapper);
      if (sourceLabel) sourceLabel.hidden = true;

      wrapper.addEventListener("input", () => {
        const next = {};
        wrapper.querySelectorAll("[data-world-field]").forEach((field) => {
          next[field.dataset.worldField] = field.value;
        });
        source.value = serializeLabeledText(next, WORLD_FIELDS);
        source.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

    body.querySelector('[data-project-field="timeline"]')?.closest("label")?.querySelector("span")?.replaceChildren("故事时间线");
    body.querySelector('[data-project-field="foreshadow"]')?.closest("label")?.querySelector("span")?.replaceChildren("伏笔与待回收信息");
    body.querySelector('[data-project-field="notes"]')?.closest("label")?.querySelector("span")?.replaceChildren("其他设定备注");
  }

  function syncCount(editor) {
    const { chapter } = activeData();
    const count = document.getElementById("simpleManuscriptCount");
    const status = document.getElementById("simpleManuscriptStatus");
    if (count) {
      const target = Math.max(100, Number(chapter?.targetWords) || 3000);
      count.textContent = `${countWords(editor.value).toLocaleString()} / ${target.toLocaleString()} 字`;
    }
    if (status) {
      status.textContent = "已保存";
      clearTimeout(status.resetTimer);
      status.resetTimer = setTimeout(() => { status.textContent = "自动保存"; }, 900);
    }
  }

  function downloadText(filename, content) {
    const blob = new Blob(["\uFEFF", content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = String(filename || "chapter").replace(/[\\/:*?"<>|]/g, "_") + ".txt";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bindEvents() {
    document.addEventListener("input", (event) => {
      if (event.target?.id !== "simpleManuscriptEditor") return;
      requestAnimationFrame(() => syncCount(event.target));
    });

    document.addEventListener("click", async (event) => {
      if (event.target.closest("#simpleCopyManuscript")) {
        const editor = document.getElementById("simpleManuscriptEditor");
        if (!editor?.value.trim()) return;
        try { await navigator.clipboard.writeText(editor.value); } catch {}
        return;
      }
      if (event.target.closest("#simpleExportManuscript")) {
        const editor = document.getElementById("simpleManuscriptEditor");
        const { chapter } = activeData();
        if (!editor?.value.trim() || !chapter) return;
        downloadText(chapter.name || "chapter", editor.value);
      }
    });
  }

  function installContextBridge() {
    const previousFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (!url.includes("/api/chat") || typeof init?.body !== "string") return previousFetch(input, init);
      try {
        const payload = JSON.parse(init.body);
        const { chapter } = activeData();
        const manuscript = String(chapter?.manuscript || "").trim();
        if (manuscript && payload.creative_context?.chapter) {
          payload.creative_context.chapter.manuscriptExcerpt = manuscript.slice(-CONTEXT_TAIL_CHARS);
        }
        return previousFetch(input, { ...init, body: JSON.stringify(payload) });
      } catch {
        return previousFetch(input, init);
      }
    };
  }

  function refresh() {
    simplifyTabs();
    renderSimpleDraft();
    enhanceOutline();
    enhanceCharacters();
    enhanceWorld();
    stabilizePanelControls();
  }

  function init() {
    simplifyTabs();
    bindEvents();
    installContextBridge();

    const body = document.getElementById("studioPanelBody");
    if (body) {
      observer = new MutationObserver(() => requestAnimationFrame(refresh));
      observer.observe(body, { childList: true, subtree: true });
    }

    document.querySelector(".studio-tabs")?.addEventListener("click", () => setTimeout(refresh, 0));
    document.getElementById("studioLibrary")?.addEventListener("click", () => setTimeout(refresh, 70));
    refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
