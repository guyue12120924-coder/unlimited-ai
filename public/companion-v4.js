// public/companion-v4.js
// Memory organization, chat search and important-moment layer for Companion mode.
(() => {
  const REVISION = "2026-08-13-v4.3-companion-memory-search-1";
  const KEYS = {
    activeCharacter: "uai_companion_active_character_v1",
    sessions: "uai_companion_sessions_v1",
    memories: "uai_companion_memories_v1",
    moments: "uai_companion_moments_v1",
    archive: "uai_companion_memory_archive_v1"
  };
  let scheduled = false;
  let highlightRequest = null;

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }
  function readJson(key, fallback) { return safeParse(localStorage.getItem(key), fallback); }
  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function activeCharacterId() { return localStorage.getItem(KEYS.activeCharacter) || "legacy"; }
  function clean(value, max = 180) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function makeId(prefix) {
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${token}`;
  }
  function state() { return window.UnlimitedCompanion?.getState?.() || null; }
  function currentSession() {
    const s = state();
    const sessions = Array.isArray(s?.sessions) ? s.sessions : [];
    return sessions.find((item) => item.id === s?.currentSessionId) || sessions[0] || null;
  }
  function showToast(message) {
    const root = document.getElementById("uaiCompanionRoot");
    if (!root) return;
    let toast = root.querySelector("#uaiCompanionV4Toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "uaiCompanionV4Toast";
      toast.className = "uai-c-v4-toast";
      root.appendChild(toast);
    }
    toast.textContent = String(message || "");
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 1600);
  }

  function getMomentsMap() {
    const value = readJson(KEYS.moments, {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function getMoments() {
    const map = getMomentsMap();
    const list = map[activeCharacterId()];
    return Array.isArray(list) ? list : [];
  }
  function saveMoments(list) {
    const map = getMomentsMap();
    map[activeCharacterId()] = Array.isArray(list) ? list.slice(-120) : [];
    writeJson(KEYS.moments, map);
  }
  function getArchiveMap() {
    const value = readJson(KEYS.archive, {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function getArchive() {
    const map = getArchiveMap();
    const list = map[activeCharacterId()];
    return Array.isArray(list) ? list : [];
  }
  function saveArchive(list) {
    const map = getArchiveMap();
    map[activeCharacterId()] = Array.isArray(list) ? list.slice(-150) : [];
    writeJson(KEYS.archive, map);
  }

  function inferMemoryKind(item) {
    if (item?.kind) return item.kind;
    const text = clean(item?.text, 200);
    if (/^用户希望被称为/.test(text)) return "nickname";
    if (/^用户的生日是/.test(text)) return "birthday";
    if (/^用户喜欢/.test(text)) return "like";
    if (/^用户不喜欢/.test(text)) return "dislike";
    if (/过敏|不吃/.test(text)) return "constraint";
    if (/^用户最近正在/.test(text)) return "current";
    if (/^用户打算/.test(text)) return "plan";
    if (/^用户希望记住/.test(text)) return "explicit";
    return "fact";
  }
  function kindLabel(kind) {
    return ({ nickname: "称呼", birthday: "生日", like: "喜好", dislike: "偏好", constraint: "约束", current: "近况", plan: "计划", explicit: "明确记忆", fact: "事实" })[kind] || "事实";
  }
  function memoryAgeDays(item) {
    const at = Number(item?.updatedAt || item?.createdAt || 0);
    return at ? Math.max(0, Math.floor((Date.now() - at) / 86400000)) : 0;
  }
  function isTemporaryMemory(item) {
    const kind = inferMemoryKind(item);
    return kind === "current" || kind === "plan";
  }
  function isStaleMemory(item) {
    if (String(item?.source || "").startsWith("pinned-v4")) return false;
    const kind = inferMemoryKind(item);
    const age = memoryAgeDays(item);
    if (kind === "current") return age >= 21;
    if (kind === "plan") return age >= 45;
    return false;
  }
  function normalizedMemoryKey(text) {
    return clean(text, 220).toLowerCase().replace(/[\s，。！？、,.!?;；:："“”'‘’（）()\-_]/g, "");
  }
  function dedupeMemories() {
    let memories = readJson(KEYS.memories, []);
    if (!Array.isArray(memories)) memories = [];
    const seen = new Map();
    const kept = [];
    let removed = 0;
    for (const item of memories) {
      const key = normalizedMemoryKey(item?.text);
      if (!key) continue;
      const previous = seen.get(key);
      if (!previous) {
        seen.set(key, item);
        kept.push(item);
        continue;
      }
      const previousPinned = String(previous?.source || "").startsWith("pinned-v4");
      const currentPinned = String(item?.source || "").startsWith("pinned-v4");
      const replace = currentPinned && !previousPinned;
      if (replace) {
        const index = kept.indexOf(previous);
        if (index >= 0) kept[index] = item;
        seen.set(key, item);
      }
      removed += 1;
    }
    if (removed) {
      writeJson(KEYS.memories, kept.slice(-100));
      window.UnlimitedCompanionMulti?.persist?.();
      window.UnlimitedCompanionPolish?.refresh?.();
    }
    return removed;
  }
  function pinMemory(id) {
    let memories = readJson(KEYS.memories, []);
    if (!Array.isArray(memories)) return;
    const index = memories.findIndex((item) => item?.id === id);
    if (index < 0) return;
    const item = { ...memories[index] };
    const pinned = String(item.source || "").startsWith("pinned-v4");
    item.source = pinned ? "manual" : "pinned-v4";
    item.updatedAt = Date.now();
    memories.splice(index, 1);
    if (pinned) memories.push(item);
    else memories.unshift(item);
    writeJson(KEYS.memories, memories.slice(0, 100));
    window.UnlimitedCompanionMulti?.persist?.();
    showMemoryOrganizer();
  }
  function archiveMemory(id) {
    let memories = readJson(KEYS.memories, []);
    if (!Array.isArray(memories)) return;
    const item = memories.find((entry) => entry?.id === id);
    if (!item) return;
    memories = memories.filter((entry) => entry?.id !== id);
    const archive = getArchive().filter((entry) => entry?.id !== id);
    archive.unshift({ ...item, archivedAt: Date.now() });
    writeJson(KEYS.memories, memories);
    saveArchive(archive);
    window.UnlimitedCompanionMulti?.persist?.();
    showMemoryOrganizer();
  }
  function restoreMemory(id) {
    const archive = getArchive();
    const item = archive.find((entry) => entry?.id === id);
    if (!item) return;
    const nextArchive = archive.filter((entry) => entry?.id !== id);
    let memories = readJson(KEYS.memories, []);
    if (!Array.isArray(memories)) memories = [];
    const restored = { ...item, updatedAt: Date.now() };
    delete restored.archivedAt;
    memories.push(restored);
    writeJson(KEYS.memories, memories.slice(-100));
    saveArchive(nextArchive);
    window.UnlimitedCompanionMulti?.persist?.();
    showMemoryOrganizer();
  }
  function archiveAllStale() {
    const memories = readJson(KEYS.memories, []);
    if (!Array.isArray(memories)) return;
    const stale = memories.filter(isStaleMemory);
    if (!stale.length) return showToast("没有需要整理的过期候选");
    if (!confirm(`将 ${stale.length} 条过期候选移到归档？之后可以恢复。`)) return;
    const staleIds = new Set(stale.map((item) => item.id));
    const archive = [...stale.map((item) => ({ ...item, archivedAt: Date.now() })), ...getArchive().filter((item) => !staleIds.has(item.id))];
    writeJson(KEYS.memories, memories.filter((item) => !staleIds.has(item.id)));
    saveArchive(archive);
    window.UnlimitedCompanionMulti?.persist?.();
    showMemoryOrganizer();
  }

  function closeModal() { document.getElementById("uaiCompanionV4Mask")?.remove(); }
  function openModal(html, bind) {
    closeModal();
    const mask = document.createElement("div");
    mask.id = "uaiCompanionV4Mask";
    mask.className = "uai-c-v4-mask";
    mask.innerHTML = html;
    document.body.appendChild(mask);
    mask.addEventListener("click", (event) => { if (event.target === mask) closeModal(); });
    mask.querySelector("[data-v4-close]")?.addEventListener("click", closeModal);
    bind?.(mask);
  }

  function showMemoryOrganizer() {
    const memories = Array.isArray(readJson(KEYS.memories, [])) ? readJson(KEYS.memories, []) : [];
    const archive = getArchive();
    const stale = memories.filter(isStaleMemory);
    const pinned = memories.filter((item) => String(item?.source || "").startsWith("pinned-v4"));
    openModal(`
      <section class="uai-c-v4-modal wide" role="dialog" aria-modal="true" aria-label="记忆整理">
        <header><div><span>MEMORY CENTER</span><h3>长期记忆整理</h3><p>重要事实优先保留；近况和计划过期后只进入候选，不会自动删除。</p></div><button type="button" data-v4-close>×</button></header>
        <div class="uai-c-v4-stats"><div><strong>${memories.length}</strong><span>活动记忆</span></div><div><strong>${pinned.length}</strong><span>已置顶</span></div><div><strong>${stale.length}</strong><span>待整理</span></div><div><strong>${archive.length}</strong><span>已归档</span></div></div>
        <div class="uai-c-v4-toolbar"><button type="button" id="uaiV4Dedupe">智能去重</button><button type="button" id="uaiV4ArchiveStale">归档过期候选</button></div>
        <div class="uai-c-v4-tabs"><button class="active" type="button" data-memory-tab="active">活动记忆</button><button type="button" data-memory-tab="archive">归档</button></div>
        <div class="uai-c-v4-memory-list" data-memory-panel="active">
          ${memories.length ? memories.map((item) => {
            const kind = inferMemoryKind(item);
            const pinnedFlag = String(item?.source || "").startsWith("pinned-v4");
            const staleFlag = isStaleMemory(item);
            return `<article class="uai-c-v4-memory${staleFlag ? " stale" : ""}" data-memory-id="${escapeHtml(item.id)}"><div><span class="kind">${escapeHtml(kindLabel(kind))}</span>${pinnedFlag ? `<span class="pin">置顶</span>` : ""}${staleFlag ? `<span class="stale-tag">待整理</span>` : ""}</div><p>${escapeHtml(item.text)}</p><small>${memoryAgeDays(item)} 天前记录</small><footer><button type="button" data-pin-memory>${pinnedFlag ? "取消置顶" : "置顶"}</button><button type="button" data-archive-memory>归档</button></footer></article>`;
          }).join("") : `<div class="uai-c-v4-empty">当前还没有长期记忆。</div>`}
        </div>
        <div class="uai-c-v4-memory-list" data-memory-panel="archive" hidden>
          ${archive.length ? archive.map((item) => `<article class="uai-c-v4-memory archived" data-archive-id="${escapeHtml(item.id)}"><div><span class="kind">${escapeHtml(kindLabel(inferMemoryKind(item)))}</span></div><p>${escapeHtml(item.text)}</p><footer><button type="button" data-restore-memory>恢复</button></footer></article>`).join("") : `<div class="uai-c-v4-empty">还没有归档记忆。</div>`}
        </div>
      </section>`, (mask) => {
        mask.querySelector("#uaiV4Dedupe")?.addEventListener("click", () => {
          const removed = dedupeMemories();
          showToast(removed ? `已合并 ${removed} 条重复记忆` : "没有发现重复记忆");
          showMemoryOrganizer();
        });
        mask.querySelector("#uaiV4ArchiveStale")?.addEventListener("click", archiveAllStale);
        mask.querySelectorAll("[data-memory-tab]").forEach((button) => button.addEventListener("click", () => {
          mask.querySelectorAll("[data-memory-tab]").forEach((item) => item.classList.toggle("active", item === button));
          mask.querySelectorAll("[data-memory-panel]").forEach((panel) => { panel.hidden = panel.dataset.memoryPanel !== button.dataset.memoryTab; });
        }));
        mask.querySelectorAll("[data-pin-memory]").forEach((button) => button.addEventListener("click", () => pinMemory(button.closest("[data-memory-id]")?.dataset.memoryId)));
        mask.querySelectorAll("[data-archive-memory]").forEach((button) => button.addEventListener("click", () => archiveMemory(button.closest("[data-memory-id]")?.dataset.memoryId)));
        mask.querySelectorAll("[data-restore-memory]").forEach((button) => button.addEventListener("click", () => restoreMemory(button.closest("[data-archive-id]")?.dataset.archiveId)));
      });
  }

  function searchSessions(query) {
    const q = clean(query, 80).toLowerCase();
    if (!q) return [];
    const sessions = Array.isArray(state()?.sessions) ? state().sessions : [];
    const results = [];
    for (const session of sessions) {
      const messages = Array.isArray(session?.messages) ? session.messages : [];
      messages.forEach((message, index) => {
        const text = clean(message?.content, 800);
        const pos = text.toLowerCase().indexOf(q);
        if (pos < 0) return;
        const start = Math.max(0, pos - 28);
        const snippet = text.slice(start, Math.min(text.length, pos + q.length + 52));
        results.push({ sessionId: session.id, sessionTitle: session.title || "新的聊天", messageIndex: index, role: message.role, text, snippet, createdAt: message.createdAt || session.updatedAt });
      });
    }
    return results.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)).slice(0, 80);
  }
  function jumpToSearchResult(result) {
    closeModal();
    const root = document.getElementById("uaiCompanionRoot");
    const sessionButton = Array.from(root?.querySelectorAll(".uai-c-session") || []).find((button) => button.dataset.sessionId === result.sessionId);
    if (!sessionButton) return showToast("暂时无法定位这段会话");
    highlightRequest = result;
    sessionButton.click();
    window.setTimeout(applyHighlight, 120);
  }
  function applyHighlight() {
    if (!highlightRequest) return;
    const root = document.getElementById("uaiCompanionRoot");
    const rows = Array.from(root?.querySelectorAll("#uaiCompanionMessages .uai-c-message-row") || []);
    const row = rows[highlightRequest.messageIndex];
    const bubble = row?.querySelector(".uai-c-bubble");
    if (!bubble) return;
    row.classList.add("uai-c-v4-highlight");
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    window.setTimeout(() => row.classList.remove("uai-c-v4-highlight"), 2600);
    highlightRequest = null;
  }
  function showSearch() {
    openModal(`
      <section class="uai-c-v4-modal wide" role="dialog" aria-modal="true" aria-label="搜索聊天">
        <header><div><span>SEARCH</span><h3>搜索当前角色聊天</h3><p>只搜索当前 AI 伙伴的会话，不会跨角色混合结果。</p></div><button type="button" data-v4-close>×</button></header>
        <div class="uai-c-v4-searchbox"><input id="uaiV4SearchInput" placeholder="搜索关键词，例如：论文、生日、旅行……" autocomplete="off" /></div>
        <div class="uai-c-v4-search-results" id="uaiV4SearchResults"><div class="uai-c-v4-empty">输入关键词后开始搜索。</div></div>
      </section>`, (mask) => {
        const input = mask.querySelector("#uaiV4SearchInput");
        const resultsHost = mask.querySelector("#uaiV4SearchResults");
        const render = () => {
          const results = searchSessions(input?.value || "");
          resultsHost.innerHTML = results.length ? results.map((item, index) => `<button type="button" class="uai-c-v4-search-result" data-result-index="${index}"><span>${escapeHtml(item.sessionTitle)}</span><p>${escapeHtml(item.snippet)}</p><small>${item.role === "user" ? "你" : "AI"} · ${new Date(Number(item.createdAt) || Date.now()).toLocaleString("zh-CN", { hour12: false })}</small></button>`).join("") : `<div class="uai-c-v4-empty">没有找到匹配内容。</div>`;
          resultsHost.querySelectorAll("[data-result-index]").forEach((button) => button.addEventListener("click", () => jumpToSearchResult(results[Number(button.dataset.resultIndex)])));
        };
        input?.addEventListener("input", render);
        window.setTimeout(() => input?.focus(), 30);
      });
  }

  function addMoment(message, session, messageIndex) {
    if (!message || !session) return;
    const list = getMoments();
    const text = clean(message.content, 500);
    if (list.some((item) => item.sessionId === session.id && item.messageIndex === messageIndex && clean(item.text, 500) === text)) return showToast("这条已经收藏过了");
    const note = window.prompt("给这个重要时刻加一句备注（可留空）：", "") ?? null;
    if (note === null) return;
    list.push({ id: makeId("moment"), sessionId: session.id, messageIndex, role: message.role, text, note: clean(note, 120), createdAt: message.createdAt || Date.now(), savedAt: Date.now() });
    saveMoments(list);
    showToast("已加入重要时刻");
  }
  function removeMoment(id) {
    saveMoments(getMoments().filter((item) => item.id !== id));
    showMoments();
  }
  function showMoments() {
    const moments = [...getMoments()].sort((a, b) => Number(b.savedAt || b.createdAt || 0) - Number(a.savedAt || a.createdAt || 0));
    openModal(`
      <section class="uai-c-v4-modal wide" role="dialog" aria-modal="true" aria-label="重要时刻">
        <header><div><span>MOMENTS</span><h3>重要时刻</h3><p>把值得回看的聊天单独珍藏，按当前角色隔离保存。</p></div><button type="button" data-v4-close>×</button></header>
        <div class="uai-c-v4-moment-list">${moments.length ? moments.map((item) => `<article class="uai-c-v4-moment" data-moment-id="${escapeHtml(item.id)}"><span>${item.role === "user" ? "你" : "AI"}</span><p>${escapeHtml(item.text)}</p>${item.note ? `<small>备注：${escapeHtml(item.note)}</small>` : ""}<footer><button type="button" data-jump-moment>回到原消息</button><button type="button" data-remove-moment>移除</button></footer></article>`).join("") : `<div class="uai-c-v4-empty">还没有重要时刻。可以在任意聊天消息下点“珍藏”。</div>`}</div>
      </section>`, (mask) => {
        mask.querySelectorAll("[data-jump-moment]").forEach((button) => button.addEventListener("click", () => {
          const item = moments.find((moment) => moment.id === button.closest("[data-moment-id]")?.dataset.momentId);
          if (item) jumpToSearchResult(item);
        }));
        mask.querySelectorAll("[data-remove-moment]").forEach((button) => button.addEventListener("click", () => removeMoment(button.closest("[data-moment-id]")?.dataset.momentId)));
      });
  }

  function ensureMessageMomentActions(root) {
    const session = currentSession();
    if (!session || !Array.isArray(session.messages)) return;
    const rows = Array.from(root.querySelectorAll("#uaiCompanionMessages .uai-c-message-row"));
    rows.forEach((row, index) => {
      if (row.querySelector("[data-v4-moment]")) return;
      const message = session.messages[index];
      const host = row.querySelector(".uai-c-v2-message-actions") || row.querySelector(".uai-c-bubble")?.parentElement;
      if (!message || !host || row.querySelector(".uai-c-typing")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.v4Moment = "1";
      button.textContent = "珍藏";
      button.addEventListener("click", () => addMoment(message, session, index));
      host.appendChild(button);
    });
  }

  function recentContext() {
    const s = state();
    const sessions = Array.isArray(s?.sessions) ? s.sessions : [];
    const currentId = s?.currentSessionId;
    const latest = [...sessions].filter((item) => item.id !== currentId && item.title && item.title !== "新的聊天").sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
    const memories = Array.isArray(s?.memories) ? s.memories : [];
    const plan = [...memories].reverse().find((item) => ["plan", "current"].includes(inferMemoryKind(item)) && !isStaleMemory(item));
    return { latest, plan };
  }
  function ensureContextStrip(root) {
    const wrap = root.querySelector("#uaiCompanionComposerWrap");
    if (!wrap || !state()?.profile) return;
    let strip = wrap.querySelector("#uaiCompanionV4Context");
    if (!strip) {
      strip = document.createElement("div");
      strip.id = "uaiCompanionV4Context";
      strip.className = "uai-c-v4-context";
      const quickBar = wrap.querySelector("#uaiCompanionQuickBar");
      if (quickBar) quickBar.insertAdjacentElement("afterend", strip);
      else wrap.prepend(strip);
    }
    const { latest, plan } = recentContext();
    const hour = new Date().getHours();
    const daypart = hour < 6 ? "深夜" : hour < 11 ? "早上" : hour < 14 ? "中午" : hour < 18 ? "下午" : "晚上";
    const bits = [];
    if (latest?.title) bits.push(`上次聊到「${clean(latest.title, 18)}」`);
    if (plan?.text) bits.push(clean(plan.text.replace(/^用户/, "你"), 26));
    if (!bits.length) {
      strip.hidden = true;
      return;
    }
    strip.hidden = false;
    strip.innerHTML = `<span>${daypart} · ${bits.map(escapeHtml).join(" · ")}</span><button type="button">继续聊</button>`;
    strip.querySelector("button")?.addEventListener("click", () => {
      const input = root.querySelector("#uaiCompanionInput");
      if (!input) return;
      input.value = latest?.title ? `我们继续聊上次的「${clean(latest.title, 24)}」吧。` : "我们聊聊我最近说过的计划吧。";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    });
  }

  function ensureHeaderTools(root) {
    const actions = root.querySelector(".uai-c-header-actions");
    if (!actions) return;
    const tools = [
      ["uaiCompanionV4Search", "⌕", "搜索聊天", showSearch],
      ["uaiCompanionV4Moments", "✦", "重要时刻", showMoments],
      ["uaiCompanionV4Memory", "◈", "记忆整理", showMemoryOrganizer]
    ];
    tools.forEach(([id, label, title, handler]) => {
      if (actions.querySelector(`#${id}`)) return;
      const button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.className = "uai-c-icon-btn uai-c-v4-tool";
      button.textContent = label;
      button.title = title;
      button.setAttribute("aria-label", title);
      button.addEventListener("click", handler);
      actions.prepend(button);
    });
  }

  function enhanceCharacterManager() {
    const modal = document.querySelector("#uaiCompanionV3Mask .uai-c-v3-modal");
    if (!modal || modal.querySelector("#uaiCompanionV4RosterSummary")) return;
    const characters = window.UnlimitedCompanionMulti?.getCharacters?.() || [];
    if (!characters.length) return;
    const totals = characters.reduce((acc, character) => {
      const sessions = Array.isArray(character?.sessions) ? character.sessions : [];
      acc.sessions += sessions.length;
      acc.messages += sessions.reduce((sum, session) => sum + (Array.isArray(session?.messages) ? session.messages.length : 0), 0);
      acc.memories += Array.isArray(character?.memories) ? character.memories.length : 0;
      return acc;
    }, { sessions: 0, messages: 0, memories: 0 });
    const summary = document.createElement("div");
    summary.id = "uaiCompanionV4RosterSummary";
    summary.className = "uai-c-v4-roster-summary";
    summary.innerHTML = `<div><strong>${characters.length}</strong><span>伙伴</span></div><div><strong>${totals.sessions}</strong><span>会话</span></div><div><strong>${totals.messages}</strong><span>消息</span></div><div><strong>${totals.memories}</strong><span>记忆</span></div>`;
    modal.querySelector("header")?.insertAdjacentElement("afterend", summary);
  }

  function enhance() {
    scheduled = false;
    if (document.body.dataset.uaiMode !== "companion") return;
    const root = document.getElementById("uaiCompanionRoot");
    if (!root) return;
    ensureHeaderTools(root);
    ensureMessageMomentActions(root);
    ensureContextStrip(root);
    applyHighlight();
    enhanceCharacterManager();
  }
  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }
  function init() {
    document.documentElement.dataset.companionMemorySearchRevision = REVISION;
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.getElementById("uaiCompanionV4Mask")) closeModal();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && document.body.dataset.uaiMode === "companion") {
        event.preventDefault();
        showSearch();
      }
    });
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-uai-mode", "hidden", "class"] });
    scheduleEnhance();
  }
  window.UnlimitedCompanionMemorySearch = {
    revision: REVISION,
    refresh: scheduleEnhance,
    showSearch,
    showMoments,
    showMemoryOrganizer,
    searchSessions,
    dedupeMemories
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
