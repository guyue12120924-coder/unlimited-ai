// public/novel-workspace-v153.js
// V16.6: reply-level writing actions driven by the shared chat/mode event hub.
(() => {
  const REVISION = "2026-08-21-v16.6-reply-actions-events";
  if (window.UnlimitedNovelWorkspaceV153) return;

  let enhanceTimer = 0;

  const ACTIONS = [
    ["continue", "续写", "把这一段作为直接前文继续写"],
    ["rewrite", "重写", "保留剧情事实，重新组织这一段"],
    ["expand", "扩写", "不改结果，增加细节与场景表现"],
    ["polish", "润色", "不改剧情，只优化语言与节奏"],
    ["reference", "参考", "只把这一段作为后续创作参考"]
  ];

  function isNovelMode() {
    return document.body.dataset.uaiMode === "novel";
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function replyText(row) {
    return cleanText(row?.querySelector(".bubble.ai")?.textContent || "");
  }

  function locator(text) {
    const value = cleanText(text);
    if (value.length <= 260) return value;
    return `${value.slice(0, 170)}……${value.slice(-70)}`;
  }

  function quoteLocator(text) {
    const value = locator(text).replace(/[「」]/g, "");
    return `「${value}」`;
  }

  function promptFor(action, text) {
    const anchor = quoteLocator(text);
    if (action === "continue") {
      return `请把对话中这条 AI 回复视为当前章节的直接前文继续写下去。定位片段：${anchor}\n\n保持当前叙事视角、人物状态、场景位置和语言风格，不重复已经写过的内容，不突然跳时间，不解释创作过程。让人物行动和当前冲突自然向前推进，直接输出可以接在这段后面的小说正文。`;
    }
    if (action === "rewrite") {
      return `请重写对话中的这条 AI 回复。定位片段：${anchor}\n\n保留已经发生的剧情事实、人物关系、关键信息和事件结果，但重新组织句子、节奏、动作、心理与对白。不要只是同义词替换，也不要继续后面的剧情。直接输出完整的重写版本，不解释修改过程。`;
    }
    if (action === "expand") {
      return `请扩写对话中的这条 AI 回复。定位片段：${anchor}\n\n不要改变原有事件结果、人物立场和核心台词意图。在原内容基础上增加约 50%–100% 的有效细节，重点补足场景感、动作反应、人物情绪、对白节奏和必要的过渡，但不要新增会改变后续剧情方向的重大设定。直接输出扩写后的完整正文。`;
    }
    if (action === "polish") {
      return `请润色对话中的这条 AI 回复。定位片段：${anchor}\n\n不改变剧情事实、人物性格、叙事视角、事件顺序和原本的信息量，尽量保持接近原长度。减少重复、套话、解释性句子和生硬转折，让语言更自然、有画面感，段落节奏更像正式小说。直接输出润色后的正文。`;
    }
    if (action === "reference") {
      return `请把对话中的这条 AI 回复只作为后续创作参考，不要自动加入正文，也不要原句照抄。参考片段：${anchor}\n\n后续处理时可以参考其中有效的氛围、人物状态、场景信息和表达方向，但以我接下来的要求为准。\n\n我的要求：`;
    }
    return "";
  }

  function setComposer(text) {
    const input = document.getElementById("msg");
    if (!input) return false;
    const next = String(text || "");
    if (input.value !== next) {
      input.value = next;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    try { input.focus({ preventScroll: false }); } catch { input.focus(); }
    try { input.setSelectionRange(input.value.length, input.value.length); } catch {}
    document.getElementById("composer")?.classList.add("novel-v153-prepared");
    window.clearTimeout(setComposer.timer);
    setComposer.timer = window.setTimeout(() => {
      document.getElementById("composer")?.classList.remove("novel-v153-prepared");
    }, 900);
    return true;
  }

  function notify(action) {
    const labels = {
      continue: "续写",
      rewrite: "重写",
      expand: "扩写",
      polish: "润色",
      reference: "参考"
    };
    window.UnlimitedV2Phase2?.notify?.(`已生成“${labels[action] || "处理"}”指令，可修改后再发送。`, "success");
  }

  function markPrepared(button) {
    if (!button) return;
    const bar = button.closest(".novel-v153-reply-actions");
    bar?.querySelectorAll("button.prepared").forEach((node) => {
      node.classList.remove("prepared");
      if (node.dataset.label) node.textContent = node.dataset.label;
    });
    if (!button.dataset.label) button.dataset.label = button.textContent || "";
    button.classList.add("prepared");
    button.textContent = "已填入";
    window.clearTimeout(button.v153Timer);
    button.v153Timer = window.setTimeout(() => {
      if (!document.contains(button)) return;
      button.classList.remove("prepared");
      button.textContent = button.dataset.label || "处理";
    }, 1050);
  }

  function handleAction(button, row) {
    const action = button?.dataset.v153ReplyAction;
    const text = replyText(row);
    if (!action || !text || text.startsWith("错误:")) return;
    const prompt = promptFor(action, text);
    if (!prompt || !setComposer(prompt)) return;
    markPrepared(button);
    notify(action);
  }

  function createActions(row) {
    if (!row?.classList?.contains("ai")) return;
    if (row.querySelector(".typing-indicator")) return;
    const bubble = row.querySelector(".bubble.ai");
    const tools = row.querySelector(".message-tools");
    const text = replyText(row);
    if (!bubble || !tools || !text || text.startsWith("错误:")) return;

    let bar = tools.querySelector(".novel-v153-reply-actions");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "novel-v153-reply-actions";
      bar.setAttribute("aria-label", "处理这条 AI 回复");
      const label = document.createElement("span");
      label.className = "novel-v153-reply-actions-label";
      label.textContent = "处理这段";
      bar.appendChild(label);

      ACTIONS.forEach(([action, title, help]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.v153ReplyAction = action;
        button.dataset.label = title;
        button.textContent = title;
        button.title = help;
        button.setAttribute("aria-label", `${title}这条 AI 回复`);
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          handleAction(button, row);
        });
        bar.appendChild(button);
      });
      tools.appendChild(bar);
    }

    row.dataset.v153ReplyReady = "1";
  }

  function enhanceReplies() {
    enhanceTimer = 0;
    if (!isNovelMode()) return;
    document.querySelectorAll("#chat .row.ai").forEach(createActions);
    document.documentElement.dataset.novelReplyActionsRevision = REVISION;
  }

  function scheduleEnhance(delay = 35) {
    if (window.UnlimitedV3?.schedule && delay <= 35) {
      window.UnlimitedV3.schedule("v166-reply-actions", enhanceReplies);
      return;
    }
    if (enhanceTimer) window.clearTimeout(enhanceTimer);
    enhanceTimer = window.setTimeout(enhanceReplies, delay);
  }

  function install() {
    const chat = document.getElementById("chat");
    if (!chat) {
      window.setTimeout(install, 80);
      return;
    }

    window.addEventListener("uai:chat-refresh", () => scheduleEnhance(0));
    window.addEventListener("uai:mode-refresh", () => scheduleEnhance(0));
    window.addEventListener("uai:workspace-refresh", () => scheduleEnhance(0));
    scheduleEnhance(0);
  }

  window.UnlimitedNovelWorkspaceV153 = {
    revision: REVISION,
    refresh: () => scheduleEnhance(0),
    promptFor
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
