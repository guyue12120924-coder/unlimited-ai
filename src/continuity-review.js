// src/continuity-review.js
// Generates reviewable chapter summaries and character-state updates without writing user data.

import { DEFAULT_MODEL_ID, getModelCandidates } from "./models.js";

const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

const SYSTEM_PROMPT = `
你是长篇小说的连续性编辑。根据用户提供的当前章节资料和最近剧情，生成两类“建议更新”：
1. chapterSummary：当前章节到目前为止的事实性摘要，供后续章节保持连续性。只记录已经发生的关键剧情，不写评价，不预测未来。
2. characterStates：只为材料中确实出现、且状态发生了有后续价值变化的人物生成当前状态。状态应覆盖位置、身体/情绪、当前目标、已知或未知的重要信息等真正 relevant 的内容；没有变化就不要输出。

只依据材料，不推测，不新增剧情。仅返回 JSON，不要 Markdown，不要解释。
格式：
{"chapterSummary":"...","characterStates":[{"name":"人物名","state":"..."}]}

chapterSummary 控制在 600 中文字以内；characterStates 最多 8 个，每个 state 控制在 220 中文字以内。没有可更新人物时返回空数组。
`.trim();

function clean(value, limit) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > limit ? text.slice(0, limit) : text;
}

function parseJson(raw) {
  const text = String(raw || "").trim();
  const candidates = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return {
        chapterSummary: clean(parsed?.chapterSummary, 1800),
        characterStates: Array.isArray(parsed?.characterStates)
          ? parsed.characterStates
              .map((item) => ({ name: clean(item?.name, 100), state: clean(item?.state, 700) }))
              .filter((item) => item.name && item.state)
              .slice(0, 8)
          : []
      };
    } catch {}
  }
  return { chapterSummary: "", characterStates: [] };
}

function buildRequest(modelConfig, payload) {
  const chapter = payload?.chapter && typeof payload.chapter === "object" ? payload.chapter : {};
  const characters = Array.isArray(payload?.characters) ? payload.characters.slice(0, 30) : [];
  return {
    model: modelConfig.id,
    stream: false,
    temperature: 0.15,
    top_p: 0.9,
    max_tokens: 2400,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          chapter: {
            title: clean(chapter.title || chapter.name, 200),
            existingSummary: clean(chapter.summary, 2400),
            notes: clean(chapter.notes, 1800)
          },
          knownCharacters: characters.map((item) => ({
            name: clean(typeof item === "string" ? item : item?.name || item?.title, 100),
            currentState: clean(typeof item === "object" ? item?.currentState || item?.state : "", 700)
          })).filter((item) => item.name),
          recentText: clean(payload?.recentText, 18000)
        })
      }
    ]
  };
}

function shouldFallback(status) {
  return status === 400 || status === 404 || status === 408 || status === 409 || status === 429 || status >= 500;
}

async function callModel(modelConfig, payload, env) {
  const controller = new AbortController();
  const timeoutMs = Math.max(8000, Math.min(60000, Number(modelConfig.requestTimeoutMs) || 30000));
  const timer = setTimeout(() => controller.abort("continuity-review-timeout"), timeoutMs);
  try {
    const response = await fetch(NVIDIA_CHAT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildRequest(modelConfig, payload)),
      signal: controller.signal
    });
    return { response, error: null };
  } catch (error) {
    return { response: null, error };
  } finally {
    clearTimeout(timer);
  }
}

export async function reviewContinuity(payload, env) {
  if (!env.NVIDIA_API_KEY) return { status: 503, body: { error: "Missing NVIDIA_API_KEY" } };
  if (!clean(payload?.recentText, 18000)) return { status: 400, body: { error: "No recent story text" } };

  const requested = typeof payload?.model === "string" ? payload.model : DEFAULT_MODEL_ID;
  const candidates = getModelCandidates(requested);
  let lastStatus = 502;
  let lastError = "Continuity review failed.";

  for (let index = 0; index < candidates.length; index += 1) {
    const modelConfig = candidates[index];
    const { response, error } = await callModel(modelConfig, payload, env);
    if (error) {
      lastStatus = 504;
      lastError = error?.message || "Model request failed";
      continue;
    }
    if (!response.ok) {
      lastStatus = response.status;
      lastError = clean(await response.text().catch(() => ""), 1200) || `HTTP ${response.status}`;
      if (index < candidates.length - 1 && shouldFallback(response.status)) continue;
      break;
    }

    const json = await response.json().catch(() => null);
    const result = parseJson(json?.choices?.[0]?.message?.content || "");
    return { status: 200, body: { ...result, model: modelConfig.id } };
  }

  return { status: lastStatus, body: { error: lastError } };
}
