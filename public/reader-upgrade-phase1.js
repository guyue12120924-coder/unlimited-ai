(() => {
  "use strict";

  const STORAGE = {
    theme: "cfw_reader_theme_v2",
    lineHeight: "cfw_reader_line_height_v2",
    width: "cfw_reader_width_v2",
    progress: "cfw_reader_progress_v2",
  };

  const mask = document.getElementById("readerMask");
  const pageWrap = document.getElementById("readerPageWrap");
  const content = document.getElementById("readerContent");
  const toolbar = mask?.querySelector(".reader-toolbar");
  const closeBtn = document.getElementById("readerClose");

  if (!mask || !pageWrap || !content || !toolbar || !closeBtn) return;

  let activeFingerprint = "";
  let restorePending = false;
  let saveTimer = null;
  let currentChapter = -1;

  function readJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "");
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function hashText(text) {
    let hash = 2166136261;
    const source = String(text || "");
    for (let i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function fingerprint() {
    const plain = content.textContent?.replace(/\s+/g, " ").trim() || "";
    if (!plain) return "";
    return `${plain.length}-${hashText(plain)}`;
  }

  function getProgressMap() {
    const value = readJSON(STORAGE.progress, {});
    return value && typeof value === "object" ? value : {};
  }

  function chapterElements() {
    return Array.from(content.querySelectorAll(".reader-chapter"));
  }

  function chapterTitle(chapter, index) {
    const text = chapter.querySelector(".reader-chapter-text")?.textContent || "";
    const firstLine = text.split(/\r?\n/).map(line => line.trim()).find(Boolean) || "";
    const looksLikeHeading = /^(第[零〇一二三四五六七八九十百千万两\d]+[章节回卷部篇]|(?:chapter|part|volume)\s*[\divxlcdm]+)/i.test(firstLine);
    if (looksLikeHeading && firstLine.length <= 42) return firstLine;
    return `片段 ${String(index + 1).padStart(2, "0")}`;
  }

  function createSelect(label, id, options) {
    const wrap = document.createElement("label");
    wrap.className = "reader-pref-control";
    wrap.htmlFor = id;
    const span = document.createElement("span");
    span.textContent = label;
    const select = document.createElement("select");
    select.id = id;
    options.forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.appendChild(option);
    });
    wrap.append(span, select);
    return { wrap, select };
  }

  const themeControl = createSelect("主题", "readerThemeSelect", [
    ["paper", "米白"],
    ["eye", "护眼"],
    ["light", "纯白"],
    ["dark", "夜间"],
  ]);
  const lineControl = createSelect("行距", "readerLineHeightSelect", [
    ["1.7", "紧凑"],
    ["1.9", "舒适"],
    ["2.15", "宽松"],
  ]);
  const widthControl = createSelect("版心", "readerWidthSelect", [
    ["narrow", "窄"],
    ["normal", "标准"],
    ["wide", "宽"],
  ]);

  const nav = document.createElement("div");
  nav.className = "reader-chapter-nav";
  nav.innerHTML = `
    <button type="button" id="readerPrevChapter" title="上一段（Alt + ↑）">↑</button>
    <select id="readerChapterSelect" aria-label="跳转阅读片段"></select>
    <button type="button" id="readerNextChapter" title="下一段（Alt + ↓）">↓</button>
  `;

  const progress = document.createElement("div");
  progress.className = "reader-progress-chip";
  progress.id = "readerProgressChip";
  progress.textContent = "0%";

  const prefs = document.createElement("div");
  prefs.className = "reader-upgrade-controls";
  prefs.append(themeControl.wrap, lineControl.wrap, widthControl.wrap, nav, progress);
  toolbar.insertBefore(prefs, closeBtn);

  const chapterSelect = nav.querySelector("#readerChapterSelect");
  const prevChapter = nav.querySelector("#readerPrevChapter");
  const nextChapter = nav.querySelector("#readerNextChapter");

  function applyPreferences() {
    const theme = localStorage.getItem(STORAGE.theme) || "paper";
    const lineHeight = localStorage.getItem(STORAGE.lineHeight) || "1.9";
    const width = localStorage.getItem(STORAGE.width) || "normal";

    themeControl.select.value = theme;
    lineControl.select.value = lineHeight;
    widthControl.select.value = width;

    mask.dataset.readerTheme = theme;
    mask.dataset.readerWidth = width;
    mask.style.setProperty("--reader-line-height", lineHeight);
  }

  themeControl.select.addEventListener("change", () => {
    localStorage.setItem(STORAGE.theme, themeControl.select.value);
    applyPreferences();
  });
  lineControl.select.addEventListener("change", () => {
    localStorage.setItem(STORAGE.lineHeight, lineControl.select.value);
    applyPreferences();
  });
  widthControl.select.addEventListener("change", () => {
    localStorage.setItem(STORAGE.width, widthControl.select.value);
    applyPreferences();
  });

  function rebuildChapterSelect() {
    const chapters = chapterElements();
    const previousValue = Number(chapterSelect.value || 0);
    chapterSelect.innerHTML = "";
    chapters.forEach((chapter, index) => {
      chapter.dataset.readerChapterIndex = String(index);
      chapter.id = `reader-chapter-${index + 1}`;
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = chapterTitle(chapter, index);
      chapterSelect.appendChild(option);
    });
    if (chapters.length) chapterSelect.value = String(Math.min(previousValue, chapters.length - 1));
    nav.classList.toggle("is-empty", chapters.length === 0);
  }

  function scrollToChapter(index, behavior = "smooth") {
    const chapters = chapterElements();
    if (!chapters.length) return;
    const targetIndex = Math.max(0, Math.min(chapters.length - 1, Number(index) || 0));
    const target = chapters[targetIndex];
    pageWrap.scrollTo({ top: Math.max(0, target.offsetTop - 24), behavior });
    currentChapter = targetIndex;
    chapterSelect.value = String(targetIndex);
  }

  chapterSelect.addEventListener("change", () => scrollToChapter(Number(chapterSelect.value)));
  prevChapter.addEventListener("click", () => scrollToChapter(Math.max(0, currentChapter - 1)));
  nextChapter.addEventListener("click", () => scrollToChapter(Math.min(chapterElements().length - 1, currentChapter + 1)));

  function updateScrollState() {
    const maxScroll = Math.max(0, pageWrap.scrollHeight - pageWrap.clientHeight);
    const ratio = maxScroll > 0 ? Math.min(1, Math.max(0, pageWrap.scrollTop / maxScroll)) : 0;
    progress.textContent = `${Math.round(ratio * 100)}%`;
    progress.style.setProperty("--reader-progress", `${ratio * 100}%`);

    const chapters = chapterElements();
    if (chapters.length) {
      const threshold = pageWrap.scrollTop + Math.min(pageWrap.clientHeight * 0.28, 180);
      let found = 0;
      for (let i = 0; i < chapters.length; i += 1) {
        if (chapters[i].offsetTop <= threshold) found = i;
        else break;
      }
      currentChapter = found;
      chapterSelect.value = String(found);
    }

    if (!activeFingerprint) activeFingerprint = fingerprint();
    if (!activeFingerprint) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const map = getProgressMap();
      map[activeFingerprint] = {
        top: pageWrap.scrollTop,
        ratio,
        chapter: currentChapter,
        updatedAt: Date.now(),
      };
      const entries = Object.entries(map)
        .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))
        .slice(0, 60);
      writeJSON(STORAGE.progress, Object.fromEntries(entries));
    }, 180);
  }

  function restoreProgress() {
    activeFingerprint = fingerprint();
    if (!activeFingerprint) {
      pageWrap.scrollTop = 0;
      updateScrollState();
      return;
    }
    const saved = getProgressMap()[activeFingerprint];
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const maxScroll = Math.max(0, pageWrap.scrollHeight - pageWrap.clientHeight);
        const savedTop = Number(saved?.top);
        const savedRatio = Number(saved?.ratio);
        let target = 0;
        if (Number.isFinite(savedTop)) target = savedTop;
        else if (Number.isFinite(savedRatio)) target = savedRatio * maxScroll;
        pageWrap.scrollTop = Math.max(0, Math.min(maxScroll, target));
        updateScrollState();
      });
    });
  }

  function onReaderOpened() {
    applyPreferences();
    rebuildChapterSelect();
    restorePending = true;
    restoreProgress();
    restorePending = false;
  }

  pageWrap.addEventListener("scroll", updateScrollState, { passive: true });
  window.addEventListener("beforeunload", updateScrollState);
  closeBtn.addEventListener("click", updateScrollState, true);

  const contentObserver = new MutationObserver(() => {
    rebuildChapterSelect();
    if (mask.classList.contains("open") && !restorePending) {
      const nextFingerprint = fingerprint();
      if (nextFingerprint && nextFingerprint !== activeFingerprint) restoreProgress();
      else updateScrollState();
    }
  });
  contentObserver.observe(content, { childList: true, subtree: true, characterData: true });

  const maskObserver = new MutationObserver(() => {
    if (mask.classList.contains("open")) onReaderOpened();
    else updateScrollState();
  });
  maskObserver.observe(mask, { attributes: true, attributeFilter: ["class"] });

  document.addEventListener("keydown", event => {
    if (!mask.classList.contains("open")) return;
    const tag = event.target?.tagName?.toLowerCase();
    if (tag === "select" || tag === "input" || tag === "textarea") return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeBtn.click();
      return;
    }
    if (event.altKey && event.key === "ArrowUp") {
      event.preventDefault();
      scrollToChapter(Math.max(0, currentChapter - 1));
      return;
    }
    if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault();
      scrollToChapter(Math.min(chapterElements().length - 1, currentChapter + 1));
    }
  });

  applyPreferences();
  rebuildChapterSelect();
  updateScrollState();
})();
