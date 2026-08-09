// src/continuity-review.js
// Generates reviewable chapter summaries, character-state updates, and plot-thread updates.

import { DEFAULT_MODEL_ID, getModelCandidates } from "./models.js";

const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

const SYSTEM_PROMPT = `
你是长篇小说的连续性编辑。根据当前章节、已知人物状态、已有连续性线索和本章正文，生成严格基于事实的连续性更新。

返回三类结果：
1. chapterSummary：当前章节已经发生的事实性摘要。突出关键行动、关系变化、重要信息和章节结尾状态；不评价、不预测、不续写。
2. characterStates：只更新本章确实出现且状态发生了后续价值变化的人物。状态可包含位置、身体状况、情绪、当前目标、掌握的重要信息、关系立场等。没有变化不要输出。
3. threadUpdates：维护需要后续记住的“未解决伏笔或持续事件”。已有线索如果被明确解决，返回同一个 id 且 status="resolved"；已有线索只是发生实质变化，返回同一个 id 且 status="open"；没有变化的已有线索不要重复返回。新出现且确实需要后续处理的事项 id 留空。

threadUpdates.type 只允许：foreshadow、event、object、relationship。
threadUpdates.status 只允许：open、resolved。
不要把普通背景描写、一次性动作、已经结束且无后续影响的事件当成线索。

只依据提供材料，不推测，不新增剧情。仅返回 JSON，不要 Markdown，不要解释。
格式：
{"chapterSummary":"...","characterStates":[{"name":"人物名","state":"..."}],"threadUpdates":[{"id":"已有ID或空字符串","type":"foreshadow","title":"简短标题","detail":"需要后续保持一致的事实","status":"open"}]}

chapterSummary 控制在 600 中文字以内；characterStates 最多 8 个，每个 state 控制在 220 中文字以内；threadUpdates 最多 12 个，每项 detail 控制在 220 中文字以内。
`.trim();

function clean(value, limit) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > limit ? text.slice(0, limit) : text;
}

function normalizedThreadType(value) {
  const type = clean(value, 40).toLowerCase();
  return ["foreshadow", "event", "object", "relationship"].includes(type) ? type : "event";
}

function normalizedThreadStatus(value) {
  return clean(value, 30).toLowerCase() === "resolved" ? "resolved" : "open";
}

function parseJson(raw) {
  const source = String(raw || "").trim();
  const candidates = [source];
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(source.slice(start, end + 1));

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
          : [],
        threadUpdates: Array.isArray(parsed?.threadUpdates)
          ? parsed.threadUpdates
              .map((item) => ({
                id: clean(item?.id, 120),
                type: normalizedThreadType(item?.type),
                title: clean(item?.title, 120),
                detail: clean(item?.detail, 700),
                status: normalizedThreadStatus(item?.status)
              }))
              .filter((item) => item.title && item.detail)
              .slice(0, 12)
          : []
      };
    } catch {}
  }
  return { chapterSummary: "", characterStates: [], threadUpdates: [] };
}

function buildRequest(modelConfig, payload) {
  const chapter = payload?.chapter && typeof payload.chapter === "object" ? payload.chapter : {};
  const characters = Array.isArray(payload?.characters) ? payload.characters.slice(0, 30) : [];
  const existingThreads = Array.isArray(payload?.existingThreads) ? payload.existingThreads.slice(0, 30) : [];

  return {
    model: modelConfig.id,
    stream: false,
    temperature: 0.1,
    top_p: 0.9,
    max_tokens: 3200,
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
            role: clean(typeof item === "object" ? item?.role || item?.identity : "", 300),
            currentState: clean(typeof item === "object" ? item?.currentState || item?.state : "", 700)
          })).filter((item) => item.name),
          existingThreads: existingThreads.map((item) => ({
            id: clean(item?.id, 120),
            type: normalizedThreadType(item?.type),
            title: clean(item?.title, 120),
            detail: clean(item?.detail, 700),
            status: normalizedThreadStatus(item?.status)
          })).filter((item) => item.id && item.title && item.detail),
          chapterText: clean(payload?.recentText || payload?.chapterText, 30000)
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
  if (!clean(payload?.recentText || payload?.chapterText, 30000)) {
    return { status: 400, body: { error: "No story text" } };
  }

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
