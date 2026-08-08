// src/memory-extractor.js
// Produces reviewable Story Memory suggestions. It never writes user data itself.

import { DEFAULT_MODEL_ID, getModelCandidates } from "./models.js";

const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const ALLOWED_TYPES = ["事件", "人物变化", "关系变化", "伏笔", "秘密", "物品", "地点", "规则", "冲突", "已揭晓", "未揭晓"];

const EXTRACTION_SYSTEM_PROMPT = `
你是长篇小说的连续性编辑。请从用户提供的最近剧情中提取“未来章节仍然值得记住”的长期故事记忆。

只提取真实出现在材料里的信息，不推测、不补写。忽略一次性动作、普通环境描写、无后续价值的琐碎细节。
优先提取：关键事件、人物状态变化、关系变化、未回收伏笔、秘密、关键物品、地点事实、世界规则、持续冲突、信息揭晓状态。

仅返回 JSON，不要 Markdown，不要解释。格式必须为：
{"items":[{"type":"事件","content":"...","characters":["..."],"tags":["..."],"importance":3}]}

type 只能是：事件、人物变化、关系变化、伏笔、秘密、物品、地点、规则、冲突、已揭晓、未揭晓。
importance 为 1-5，5 表示如果忘记会明显造成后续剧情矛盾。
每条 content 应独立、明确、简洁。最多 8 条；没有值得保存的内容时返回 {"items":[]}。
`.trim();

function cleanText(value, limit) {
  const source = String(value || "").trim();
  if (!source) return "";
  return source.length > limit ? source.slice(0, limit) : source;
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 8);
}

function normalizeItem(item) {
  if (!item || typeof item !== "object") return null;
  const content = cleanText(item.content, 1200);
  if (!content) return null;
  return {
    type: ALLOWED_TYPES.includes(item.type) ? item.type : "事件",
    content,
    characters: normalizeList(item.characters),
    tags: normalizeList(item.tags),
    importance: Math.max(1, Math.min(5, Number(item.importance) || 3))
  };
}

function parseJsonPayload(raw) {
  const text = String(raw || "").trim();
  if (!text) return { items: [] };

  const candidates = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const objectStart = text.indexOf("{");
  const objectEnd = text.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) candidates.push(text.slice(objectStart, objectEnd + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const items = Array.isArray(parsed?.items) ? parsed.items.map(normalizeItem).filter(Boolean).slice(0, 8) : [];
      return { items };
    } catch {}
  }

  return { items: [] };
}

function requestBody(modelConfig, payload) {
  const chapter = payload?.chapter && typeof payload.chapter === "object" ? payload.chapter : {};
  const characters = Array.isArray(payload?.characters) ? payload.characters.slice(0, 20) : [];
  const existing = Array.isArray(payload?.existing) ? payload.existing.slice(0, 30) : [];
  const recentText = cleanText(payload?.recentText, 18000);

  return {
    model: modelConfig.id,
    stream: false,
    temperature: 0.2,
    top_p: 0.9,
    max_tokens: 2600,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          chapter: {
            title: cleanText(chapter.title || chapter.name, 200),
            summary: cleanText(chapter.summary, 3000),
            notes: cleanText(chapter.notes, 2000)
          },
          knownCharacters: characters.map((item) => typeof item === "string" ? cleanText(item, 100) : cleanText(item?.name || item?.title, 100)).filter(Boolean),
          existingMemories: existing.map((item) => cleanText(item?.content || item, 600)).filter(Boolean),
          recentText
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
  const timer = setTimeout(() => controller.abort("memory-extraction-timeout"), timeoutMs);
  try {
    const response = await fetch(NVIDIA_CHAT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody(modelConfig, payload)),
      signal: controller.signal
    });
    return { response, error: null };
  } catch (error) {
    return { response: null, error };
  } finally {
    clearTimeout(timer);
  }
}

export async function extractStoryMemories(payload, env) {
  if (!env.NVIDIA_API_KEY) {
    return { status: 503, body: { error: "Missing NVIDIA_API_KEY" } };
  }

  const requestedModel = typeof payload?.model === "string" ? payload.model : DEFAULT_MODEL_ID;
  const candidates = getModelCandidates(requestedModel);
  let lastError = "Memory extraction failed.";
  let lastStatus = 502;

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
      lastError = cleanText(await response.text().catch(() => ""), 1200) || `HTTP ${response.status}`;
      if (index < candidates.length - 1 && shouldFallback(response.status)) continue;
      break;
    }

    const json = await response.json().catch(() => null);
    const rawContent = json?.choices?.[0]?.message?.content || "";
    const parsed = parseJsonPayload(rawContent);
    return {
      status: 200,
      body: {
        items: parsed.items,
        model: modelConfig.id
      }
    };
  }

  return { status: lastStatus, body: { error: lastError } };
}
