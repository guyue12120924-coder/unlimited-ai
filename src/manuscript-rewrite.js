import { DEFAULT_MODEL_ID, getModelCandidates } from "./models.js";

const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MAX_SELECTION_CHARS = 12000;
const MAX_CONTEXT_CHARS = 18000;

const MODE_INSTRUCTIONS = {
  polish: "润色文字。保持原意、剧情事实、人物行动和叙事视角不变，改善措辞、句式、节奏和自然度。不要无故扩写剧情。",
  expand: "扩写选中文字。在不改变既有剧情事实的前提下，补充必要的动作、感官、心理或环境细节，使场景更完整；不要引入未经上下文支持的新设定。",
  shorten: "精简选中文字。删除重复、空泛和拖沓表达，保留关键剧情、人物情绪、动作与必要信息，使节奏更紧凑。",
  dialogue: "增强人物对话。保持剧情事实不变，使台词更符合人物身份、关系与当前情绪，并用必要的动作和反应支撑对话；避免所有人物说话方式雷同。",
  description: "增强场景与动作描写。保持剧情推进不变，优先补充有叙事作用的感官、空间、动作和细节，不堆砌形容词。",
  rhythm: "调整叙事节奏。保持事件顺序和事实不变，优化长短句、段落停顿、动作与信息释放，使阅读节奏更自然。",
  custom: "按照用户给出的自定义要求修改选中文字，同时保持未被要求改变的剧情事实、人物设定与叙事连续性。"
};

function text(value, limit) {
  const source = String(value ?? "").trim();
  if (!source) return "";
  return source.length > limit ? `${source.slice(0, limit)}\n[内容已截断]` : source;
}

function cleanModelText(value) {
  let output = String(value ?? "").trim();
  if (!output) return "";
  output = output.replace(/^```(?:text|markdown|md)?\s*/i, "").replace(/\s*```$/, "").trim();
  output = output.replace(/^改写(?:结果|后)?[：:]\s*/i, "").trim();
  return output;
}

function buildSystemPrompt(mode, customInstruction) {
  const instruction = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.polish;
  const custom = mode === "custom" ? text(customInstruction, 1200) : "";
  return [
    "你是小说正文编辑器中的局部改写助手。",
    instruction,
    custom ? `用户的具体要求：${custom}` : "",
    "严格规则：",
    "1. 只输出可直接替换原文的修改后文本，不要解释、点评、标题、前后缀或 Markdown 代码块。",
    "2. 不修改上下文中已经确定的人名、关系、时间、地点、视角和事件事实，除非用户明确要求。",
    "3. 不续写选区之后尚未发生的剧情；只处理选中的文本范围。",
    "4. 保持原文语言。原文是中文时使用自然中文小说文风。",
    "5. 不机械复述上下文。上下文只用于保持连续性。"
  ].filter(Boolean).join("\n");
}

function buildUserPrompt(payload) {
  const selected = text(payload?.selected_text, MAX_SELECTION_CHARS);
  const before = text(payload?.before_text, 3500);
  const after = text(payload?.after_text, 2500);
  const context = payload?.context && typeof payload.context === "object" ? payload.context : {};
  const project = context.project && typeof context.project === "object" ? context.project : {};
  const chapter = context.chapter && typeof context.chapter === "object" ? context.chapter : {};

  const reference = [
    project.name ? `作品：${text(project.name, 120)}` : "",
    project.synopsis ? `作品简介：${text(project.synopsis, 1800)}` : "",
    project.world ? `世界观：${text(project.world, 1800)}` : "",
    project.timeline ? `时间线：${text(project.timeline, 1200)}` : "",
    project.foreshadow ? `相关伏笔：${text(project.foreshadow, 1200)}` : "",
    chapter.title || chapter.name ? `当前章节：${text(chapter.title || chapter.name, 160)}` : "",
    chapter.summary ? `本章摘要：${text(chapter.summary, 1600)}` : "",
    chapter.notes ? `本章备忘：${text(chapter.notes, 1200)}` : ""
  ].filter(Boolean).join("\n");

  return text([
    reference ? `【创作资料】\n${reference}` : "",
    before ? `【选区前文】\n${before}` : "",
    `【需要修改的原文】\n${selected}`,
    after ? `【选区后文】\n${after}` : ""
  ].filter(Boolean).join("\n\n"), MAX_CONTEXT_CHARS + MAX_SELECTION_CHARS);
}

function modelRequest(modelConfig, messages) {
  const base = modelConfig.request || {};
  return {
    model: modelConfig.id,
    messages,
    stream: false,
    temperature: typeof base.temperature === "number" ? Math.min(base.temperature, 0.8) : 0.7,
    top_p: typeof base.top_p === "number" ? base.top_p : 0.95,
    max_tokens: 4096,
    ...(base.chat_template_kwargs ? { chat_template_kwargs: base.chat_template_kwargs } : {})
  };
}

async function requestCandidate(env, modelConfig, messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("rewrite-timeout"), Math.max(8000, Number(modelConfig.requestTimeoutMs) || 30000));
  try {
    return await fetch(NVIDIA_CHAT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(modelRequest(modelConfig, messages)),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function rewriteManuscriptSelection(payload, env) {
  if (!env.NVIDIA_API_KEY) {
    return { status: 503, body: { error: "Missing NVIDIA_API_KEY" } };
  }

  const selected = text(payload?.selected_text, MAX_SELECTION_CHARS);
  if (!selected) return { status: 400, body: { error: "请选择需要修改的正文" } };
  if (String(payload?.selected_text || "").length > MAX_SELECTION_CHARS) {
    return { status: 400, body: { error: `单次选区请控制在 ${MAX_SELECTION_CHARS} 字符以内` } };
  }

  const mode = MODE_INSTRUCTIONS[payload?.mode] ? payload.mode : "polish";
  const requestedModel = typeof payload?.model === "string" ? payload.model : DEFAULT_MODEL_ID;
  const messages = [
    { role: "system", content: buildSystemPrompt(mode, payload?.custom_instruction) },
    { role: "user", content: buildUserPrompt(payload) }
  ];

  const candidates = getModelCandidates(requestedModel);
  let lastError = "AI 改写失败";

  for (const modelConfig of candidates) {
    try {
      const response = await requestCandidate(env, modelConfig, messages);
      if (!response.ok) {
        lastError = `模型 ${modelConfig.label || modelConfig.id} 返回 HTTP ${response.status}`;
        if (response.status === 429 || response.status >= 500 || response.status === 404 || response.status === 400) continue;
        return { status: response.status, body: { error: lastError } };
      }

      const data = await response.json();
      const content = cleanModelText(data?.choices?.[0]?.message?.content);
      if (!content) {
        lastError = `模型 ${modelConfig.label || modelConfig.id} 未返回可用文本`;
        continue;
      }

      return {
        status: 200,
        body: {
          text: content,
          model: modelConfig.id,
          requested_model: requestedModel,
          mode
        }
      };
    } catch (error) {
      lastError = error?.message || String(error);
    }
  }

  return { status: 502, body: { error: lastError } };
}
