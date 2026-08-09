// public/manuscript-ai.js
// AI-assisted selection editing for the independent chapter manuscript editor.
(() => {
  const LS_STUDIO = "cfw_studio_workspace_v1";
  const MAX_SELECTION = 12000;
  const MODES = {
    polish: { label: "润色", hint: "改善措辞、句式与自然度，不改变剧情事实" },
    expand: { label: "扩写", hint: "补充必要动作、感官、心理或环境细节" },
    shorten: { label: "精简", hint: "去掉重复和拖沓表达，保留关键信息" },
    dialogue: { label: "对话增强", hint: "让人物台词更符合身份、关系与情绪" },
    description: { label: "描写增强", hint: "增强有叙事作用的动作、场景与感官细节" },
    rhythm: { label: "调整节奏", hint: "优化句段停顿、动作与信息释放" },
    custom: { label: "自定义", hint: "按照你的具体要求修改选区" }
  };

  let selection = null;
  let review = null;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function workspaceContext() {
    const state = readJson(LS_STUDIO, {});
    const projects = Array.isArray(state.projects) ? state.projects : [];
    const project = projects.find((item) => item.id === state.activeProjectId) || projects[0] || null;
    const chapter = project?.chapters?.find((item) => item.id === state.activeChapterId) || null;
    if (!project || !chapter) return null;
    return {
      project: {
        name: project.name || "",
        synopsis: project.synopsis || "",
        world: project.world || "",
        timeline: project.timeline || "",
        foreshadow: project.foreshadow || ""
      },
      chapter: {
        id: chapter.id || "",
        title: chapter.name || chapter.title || "",
        summary: chapter.summary || "",
        notes: chapter.notes || ""
      }
    };
  }

  function selectedModel() {
    return document.getElementById("modelSel")?.value
      || localStorage.getItem("cfw_model")
      || window.APP_DEFAULT_MODEL
      || window.APP_MODELS?.[0]?.id
      || "";
  }

  function currentEditor() {
    return document.getElementById("chapterManuscriptEditor");
  }

  function captureSelection() {
    const editor = currentEditor();
    if (!editor) {
      selection = null;
      updateToolbar();
      return null;
    }
    const start = Number(editor.selectionStart) || 0;
    const end = Number(editor.selectionEnd) || 0;
    if (end <= start) {
      selection = null;
      updateToolbar();
      return null;
    }
    const original = editor.value.slice(start, end);
    selection = {
      projectId: editor.dataset.projectId || "",
      chapterId: editor.dataset.chapterId || "",
      start,
      end,
      original,
      fullText: editor.value,
      before: editor.value.slice(Math.max(0, start - 3500), start),
      after: editor.value.slice(end, Math.min(editor.value.length, end + 2500))
    };
    updateToolbar();
    return selection;
  }

  function updateToolbar() {
    const toolbar = document.getElementById("manuscriptAiToolbar");
    if (!toolbar) return;
    const count = selection?.original?.length || 0;
    const status = toolbar.querySelector("[data-ai-selection-count]");
    if (status) status.textContent = count ? `已选 ${count.toLocaleString()} 字符` : "先在正文中选中文字";
    toolbar.querySelectorAll("[data-manuscript-ai-mode]").forEach((button) => {
      button.disabled = !count || count > MAX_SELECTION;
    });
    toolbar.classList.toggle("has-selection", Boolean(count));
    toolbar.classList.toggle("selection-too-long", count > MAX_SELECTION);
    if (count > MAX_SELECTION && status) status.textContent = `选区过长：${count.toLocaleString()} / ${MAX_SELECTION.toLocaleString()} 字符`;
  }

  function toolbarHtml() {
    return `
      <section id="manuscriptAiToolbar" class="manuscript-ai-toolbar">
        <div class="manuscript-ai-toolbar-head">
          <div><span>AI EDIT</span><strong>局部改写</strong></div>
          <small data-ai-selection-count>先在正文中选中文字</small>
        </div>
        <div class="manuscript-ai-actions">
          ${Object.entries(MODES).map(([key, item]) => `<button type="button" data-manuscript-ai-mode="${key}" title="${item.hint}" disabled>${item.label}</button>`).join("")}
        </div>
      </section>`;
  }

  function enhanceEditor() {
    const editor = currentEditor();
    if (!editor || document.getElementById("manuscriptAiToolbar")) return;
    editor.insertAdjacentHTML("afterend", toolbarHtml());
    selection = null;
    updateToolbar();
  }

  function createReviewModal() {
    if (document.getElementById("manuscriptAiReviewMask")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <div id="manuscriptAiReviewMask" class="manuscript-ai-review-mask" hidden>
        <section class="manuscript-ai-review" role="dialog" aria-modal="true" aria-labelledby="manuscriptAiReviewTitle">
          <header>
            <div><span>AI REVISION</span><strong id="manuscriptAiReviewTitle">局部改写对比</strong><small id="manuscriptAiReviewMeta"></small></div>
            <button type="button" id="manuscriptAiClose" aria-label="关闭">×</button>
          </header>
          <div id="manuscriptAiLoading" class="manuscript-ai-loading" hidden><i></i><span>AI 正在改写选中的正文…</span></div>
          <div id="manuscriptAiError" class="manuscript-ai-error" hidden></div>
          <div id="manuscriptAiCompare" class="manuscript-ai-compare">
            <article><div><strong>原文</strong><span id="manuscriptAiOriginalCount"></span></div><pre id="manuscriptAiOriginal"></pre></article>
            <article><div><strong>修改版</strong><span id="manuscriptAiResultCount"></span></div><pre id="manuscriptAiResult"></pre></article>
          </div>
          <footer>
            <div class="manuscript-ai-version-nav">
              <button id="manuscriptAiPrev" type="button" title="上一版本">‹</button>
              <span id="manuscriptAiVersion">版本 0 / 0</span>
              <button id="manuscriptAiNext" type="button" title="下一版本">›</button>
            </div>
            <div class="manuscript-ai-review-actions">
              <button id="manuscriptAiRegenerate" type="button">重新生成</button>
              <button id="manuscriptAiCancel" type="button">放弃</button>
              <button id="manuscriptAiApply" class="primary" type="button">应用到正文</button>
            </div>
          </footer>
        </section>
      </div>`);
  }

  function openModal() {
    createReviewModal();
    document.getElementById("manuscriptAiReviewMask").hidden = false;
  }

  function closeModal() {
    const mask = document.getElementById("manuscriptAiReviewMask");
    if (mask) mask.hidden = true;
    review = null;
  }

  function setLoading(value) {
    const loading = document.getElementById("manuscriptAiLoading");
    const compare = document.getElementById("manuscriptAiCompare");
    const regenerate = document.getElementById("manuscriptAiRegenerate");
    const apply = document.getElementById("manuscriptAiApply");
    if (loading) loading.hidden = !value;
    if (compare) compare.classList.toggle("is-loading", value);
    if (regenerate) regenerate.disabled = value;
    if (apply) apply.disabled = value || !review?.versions?.length;
  }

  function showError(message = "") {
    const node = document.getElementById("manuscriptAiError");
    if (!node) return;
    node.hidden = !message;
    node.textContent = message;
  }

  function renderReview() {
    if (!review) return;
    const version = review.versions[review.versionIndex] || "";
    const mode = MODES[review.mode] || MODES.polish;
    document.getElementById("manuscriptAiReviewTitle").textContent = `${mode.label} · 对比`;
    document.getElementById("manuscriptAiReviewMeta").textContent = review.usedModel ? `实际模型：${review.usedModel}` : mode.hint;
    document.getElementById("manuscriptAiOriginal").textContent = review.selection.original;
    document.getElementById("manuscriptAiResult").textContent = version;
    document.getElementById("manuscriptAiOriginalCount").textContent = `${review.selection.original.length.toLocaleString()} 字符`;
    document.getElementById("manuscriptAiResultCount").textContent = version ? `${version.length.toLocaleString()} 字符` : "";
    document.getElementById("manuscriptAiVersion").textContent = `版本 ${review.versions.length ? review.versionIndex + 1 : 0} / ${review.versions.length}`;
    document.getElementById("manuscriptAiPrev").disabled = review.versionIndex <= 0;
    document.getElementById("manuscriptAiNext").disabled = review.versionIndex >= review.versions.length - 1;
    document.getElementById("manuscriptAiApply").disabled = !version;
  }

  async function requestRewrite() {
    if (!review) return;
    setLoading(true);
    showError("");
    try {
      const response = await fetch("/api/manuscript/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel(),
          mode: review.mode,
          custom_instruction: review.customInstruction || "",
          selected_text: review.selection.original,
          before_text: review.selection.before,
          after_text: review.selection.after,
          context: workspaceContext()
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.text) throw new Error(data.error || `AI 改写失败（HTTP ${response.status}）`);
      if (!review.versions.includes(data.text)) review.versions.push(data.text);
      review.versionIndex = review.versions.indexOf(data.text);
      review.usedModel = data.model || "";
      renderReview();
    } catch (error) {
      showError(error?.message || String(error));
    } finally {
      setLoading(false);
    }
  }

  async function startRewrite(mode) {
    const nextSelection = captureSelection();
    if (!nextSelection?.original) return;
    if (nextSelection.original.length > MAX_SELECTION) return;

    let customInstruction = "";
    if (mode === "custom") {
      customInstruction = window.prompt("请输入希望 AI 如何修改这段正文：", "")?.trim() || "";
      if (!customInstruction) return;
    }

    review = {
      mode,
      customInstruction,
      selection: { ...nextSelection },
      versions: [],
      versionIndex: 0,
      usedModel: ""
    };
    openModal();
    renderReview();
    await requestRewrite();
  }

  function applyCurrentVersion() {
    if (!review?.versions?.length) return;
    const replacement = review.versions[review.versionIndex];
    const editor = currentEditor();
    const saved = review.selection;
    if (!editor || editor.dataset.projectId !== saved.projectId || editor.dataset.chapterId !== saved.chapterId) {
      showError("当前章节已经切换。为避免覆盖错误章节，本次修改不能应用。请重新选择正文。 ");
      return;
    }

    const currentSlice = editor.value.slice(saved.start, saved.end);
    if (editor.value !== saved.fullText || currentSlice !== saved.original) {
      showError("正文在 AI 改写期间发生了变化。为避免覆盖新内容，请关闭窗口后重新选择需要修改的文字。 ");
      return;
    }

    const next = editor.value.slice(0, saved.start) + replacement + editor.value.slice(saved.end);
    editor.value = next;
    const nextEnd = saved.start + replacement.length;
    editor.setSelectionRange(saved.start, nextEnd);
    editor.focus();
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    closeModal();
    selection = {
      projectId: editor.dataset.projectId || "",
      chapterId: editor.dataset.chapterId || "",
      start: saved.start,
      end: nextEnd,
      original: replacement,
      fullText: next,
      before: next.slice(Math.max(0, saved.start - 3500), saved.start),
      after: next.slice(nextEnd, Math.min(next.length, nextEnd + 2500))
    };
    updateToolbar();
  }

  function bindEvents() {
    document.addEventListener("mouseup", (event) => {
      if (event.target.closest("#chapterManuscriptEditor")) setTimeout(captureSelection, 0);
    });
    document.addEventListener("keyup", (event) => {
      if (event.target.closest("#chapterManuscriptEditor")) captureSelection();
    });
    document.addEventListener("select", (event) => {
      if (event.target.closest("#chapterManuscriptEditor")) captureSelection();
    });

    document.addEventListener("click", (event) => {
      const modeButton = event.target.closest("[data-manuscript-ai-mode]");
      if (modeButton) {
        startRewrite(modeButton.dataset.manuscriptAiMode);
        return;
      }
      if (event.target.closest("#manuscriptAiClose") || event.target.closest("#manuscriptAiCancel")) {
        closeModal();
        return;
      }
      if (event.target.id === "manuscriptAiReviewMask") {
        closeModal();
        return;
      }
      if (event.target.closest("#manuscriptAiRegenerate")) {
        requestRewrite();
        return;
      }
      if (event.target.closest("#manuscriptAiApply")) {
        applyCurrentVersion();
        return;
      }
      if (event.target.closest("#manuscriptAiPrev") && review?.versionIndex > 0) {
        review.versionIndex -= 1;
        renderReview();
        return;
      }
      if (event.target.closest("#manuscriptAiNext") && review?.versionIndex < review.versions.length - 1) {
        review.versionIndex += 1;
        renderReview();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !document.getElementById("manuscriptAiReviewMask")?.hidden) closeModal();
    });
  }

  function init() {
    createReviewModal();
    bindEvents();
    const body = document.getElementById("studioPanelBody");
    if (body) {
      new MutationObserver(() => requestAnimationFrame(enhanceEditor)).observe(body, { childList: true, subtree: true });
    }
    enhanceEditor();
    window.UnlimitedManuscriptAI = { captureSelection, startRewrite };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
