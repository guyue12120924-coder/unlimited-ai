// public/manuscript-rewrite-client.js
// Adapts the manuscript rewrite UI to the existing streaming /api/chat endpoint.
(() => {
  function loadInteractionReliabilityLayer() {
    if (!document.getElementById("manuscriptInteractionStyles")) {
      const link = document.createElement("link");
      link.id = "manuscriptInteractionStyles";
      link.rel = "stylesheet";
      link.href = "/manuscript-interaction-fix.css?v=20260809-1";
      document.head.appendChild(link);
    }
    if (!document.getElementById("manuscriptInteractionScript")) {
      const script = document.createElement("script");
      script.id = "manuscriptInteractionScript";
      script.src = "/manuscript-interaction-fix.js?v=20260809-1";
      script.defer = true;
      document.body.appendChild(script);
    }
  }

  loadInteractionReliabilityLayer();

  const MODE_INSTRUCTIONS = {
    polish: "润色文字。保持原意、剧情事实、人物行动和叙事视角不变，改善措辞、句式、节奏和自然度。不要无故扩写剧情。",
    expand: "扩写选中文字。在不改变既有剧情事实的前提下，补充必要的动作、感官、心理或环境细节，使场景更完整；不要引入未经上下文支持的新设定。",
    shorten: "精简选中文字。删除重复、空泛和拖沓表达，保留关键剧情、人物情绪、动作与必要信息，使节奏更紧凑。",
    dialogue: "增强人物对话。保持剧情事实不变，使台词更符合人物身份、关系与当前情绪，并用必要的动作和反应支撑对话；避免所有人物说话方式雷同。",
    description: "增强场景与动作描写。保持剧情推进不变，优先补充有叙事作用的感官、空间、动作和细节，不堆砌形容词。",
    rhythm: "调整叙事节奏。保持事件顺序和事实不变，优化长短句、段落停顿、动作与信息释放，使阅读节奏更自然。",
    custom: "按照用户给出的自定义要求修改选中文字，同时保持未被要求改变的剧情事实、人物设定与叙事连续性。"
  };

  function trim(value, limit) {
    const source = String(value ?? "").trim();
    if (!source) return "";
    return source.length > limit ? `${source.slice(0, limit)}\n[内容已截断]` : source;
  }

  function systemPrompt(payload) {
    const mode = MODE_INSTRUCTIONS[payload?.mode] ? payload.mode : "polish";
    return [
      "你是小说正文编辑器中的局部改写助手。",
      MODE_INSTRUCTIONS[mode],
      mode === "custom" && payload?.custom_instruction ? `用户的具体要求：${trim(payload.custom_instruction, 1200)}` : "",
      "严格规则：",
      "1. 只输出可直接替换原文的修改后文本，不要解释、点评、标题、前后缀或 Markdown 代码块。",
      "2. 不修改上下文中已经确定的人名、关系、时间、地点、视角和事件事实，除非用户明确要求。",
      "3. 不续写选区之后尚未发生的剧情；只处理选中的文本范围。",
      "4. 保持原文语言。原文是中文时使用自然中文小说文风。",
      "5. 不机械复述上下文。上下文只用于保持连续性。"
    ].filter(Boolean).join("\n");
  }

  function userPrompt(payload) {
    const context = payload?.context || {};
    const project = context.project || {};
    const chapter = context.chapter || {};
    const reference = [
      project.name ? `作品：${trim(project.name, 120)}` : "",
      project.synopsis ? `作品简介：${trim(project.synopsis, 1800)}` : "",
      project.world ? `世界观：${trim(project.world, 1800)}` : "",
      project.timeline ? `时间线：${trim(project.timeline, 1200)}` : "",
      project.foreshadow ? `相关伏笔：${trim(project.foreshadow, 1200)}` : "",
      chapter.title ? `当前章节：${trim(chapter.title, 160)}` : "",
      chapter.summary ? `本章摘要：${trim(chapter.summary, 1600)}` : "",
      chapter.notes ? `本章备忘：${trim(chapter.notes, 1200)}` : ""
    ].filter(Boolean).join("\n");

    return [
      reference ? `【创作资料】\n${reference}` : "",
      payload.before_text ? `【选区前文】\n${trim(payload.before_text, 3500)}` : "",
      `【需要修改的原文】\n${trim(payload.selected_text, 12000)}`,
      payload.after_text ? `【选区后文】\n${trim(payload.after_text, 2500)}` : ""
    ].filter(Boolean).join("\n\n");
  }

  function cleanOutput(value) {
    return String(value || "")
      .trim()
      .replace(/^```(?:text|markdown|md)?\s*/i, "")
      .replace(/\s*```$/, "")
      .replace(/^改写(?:结果|后)?[：:]\s*/i, "")
      .trim();
  }

  async function readSseText(response) {
    if (!response.body) return "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = done ? "" : lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          const parsed = JSON.parse(raw);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) full += delta;
        } catch {}
      }
      if (done) break;
    }
    return cleanOutput(full);
  }

  const previousFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (!url.includes("/api/manuscript/rewrite")) return previousFetch(input, init);

    let payload;
    try {
      payload = JSON.parse(init?.body || "{}");
    } catch {
      return new Response(JSON.stringify({ error: "Bad JSON" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const selected = String(payload?.selected_text || "");
    if (!selected.trim()) {
      return new Response(JSON.stringify({ error: "请选择需要修改的正文" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (selected.length > 12000) {
      return new Response(JSON.stringify({ error: "单次选区请控制在 12000 字符以内" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    try {
      const response = await previousFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: payload.model || window.APP_DEFAULT_MODEL,
          use_builtin_persona: false,
          custom_system_prompt: systemPrompt(payload),
          messages: [{ role: "user", content: userPrompt(payload) }]
        })
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        return new Response(JSON.stringify({ error: detail || `AI 改写失败（HTTP ${response.status}）` }), {
          status: response.status,
          headers: { "Content-Type": "application/json" }
        });
      }

      const text = await readSseText(response);
      if (!text) {
        return new Response(JSON.stringify({ error: "模型没有返回可用的改写文本" }), {
          status: 502,
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({
        text,
        model: response.headers.get("X-Model-Used") || payload.model || "",
        requested_model: response.headers.get("X-Requested-Model") || payload.model || "",
        mode: payload.mode || "polish"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error?.message || String(error) }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }
  };
})();