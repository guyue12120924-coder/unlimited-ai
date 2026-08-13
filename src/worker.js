import {
  MODELS,
  DEFAULT_MODEL_ID,
  getModelCandidates
} from "./models.js";
import { getBuiltinPrompt } from "./prompts.js";
import { DEFAULT_NOVEL_PROMPT, DEFAULT_COMPANION_PROMPT } from "./default-prompts.js";
import { buildCreativeContextMessage } from "./context.js";
import { extractStoryMemories } from "./memory-extractor.js";
import { reviewContinuity } from "./continuity-review.js";
import { buildCompanionSystemPrompt } from "./companion.js";

const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const APP_REVISION = "2026-08-13-v6.1-prompt-center-1";
const MODEL_RUNTIME_INJECTION = `
运行约束（由 Worker 注入）：
- 用户使用中文时默认使用自然、流畅的中文回复；用户明确指定其他语言时服从用户要求。
- 小说创作、续写、润色、改写任务直接输出可使用的正文，不解释“我将如何写”，除非用户明确要求分析。
- 不输出内部思维链、推理草稿、reasoning trace、<think> 标签或隐藏分析过程，只返回最终可用内容。
- 系统提供的当前正文、当前章节计划、人物状态、人物关系、世界规则、上一章摘要、未解决伏笔与连续性信息属于事实约束。
- 当不同背景信息出现冲突时，优先采用更近期、更具体、更接近当前章节的信息，不要用旧设定覆盖当前事实。
- 除非用户明确要求修改设定，不擅自改变已经确定的人名、身份、关系、伤势、位置、时间、知识状态、重要物品和世界规则。
- 长篇续写保持视角、时态、人物口吻、叙事节奏与前文事实一致，避免重复前文、机械总结和无依据新增设定。
- 用户要求大纲、分析、检查或建议时，再按对应任务输出结构化结果；不要把小说正文任务写成教程或说明。
`.trim();

function resp(body, contentType = "text/plain; charset=utf-8", status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType,
      ...extraHeaders
    }
  });
}

function jsonResp(value, status = 200) {
  return resp(JSON.stringify(value, null, 2), "application/json; charset=utf-8", status, {
    "Cache-Control": "no-store"
  });
}

function clientConfigJs() {
  const models = MODELS.map((model) => ({
    id: model.id,
    label: model.label
  }));
  const prompts = {
    novel: DEFAULT_NOVEL_PROMPT,
    companion: DEFAULT_COMPANION_PROMPT
  };

  return `window.APP_MODELS = ${JSON.stringify(models, null, 2)};\nwindow.APP_DEFAULT_MODEL = ${JSON.stringify(DEFAULT_MODEL_ID)};\nwindow.APP_DEFAULT_PROMPTS = ${JSON.stringify(prompts)};\nwindow.APP_REVISION = ${JSON.stringify(APP_REVISION)};\n`;
}

function getPromptInjection(payload) {
  const direct = typeof payload?.prompt_injection === "string"
    ? payload.prompt_injection
    : typeof payload?.custom_system_prompt === "string"
      ? payload.custom_system_prompt
      : "";
  if (direct.trim()) return direct.trim().slice(0, 12000);

  const companionProfilePrompt = payload?.mode === "companion"
    && payload?.character?.promptInjectionEnabled
    && typeof payload?.character?.promptInjection === "string"
      ? payload.character.promptInjection
      : "";
  return companionProfilePrompt.trim().slice(0, 12000);
}

function formatPromptInjection(payload) {
  const injection = getPromptInjection(payload);
  return injection ? `【用户自定义注入提示词】\n${injection}` : "";
}

function buildMessages(payload, modelConfig) {
  const mode = payload?.mode === "companion" ? "companion" : "novel";
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const upstreamMessages = [];
  const promptInjection = formatPromptInjection(payload);
  let systemPrompt = "";

  if (mode === "companion") {
    // Important isolation boundary: companion requests never receive story
    // context, story memory, continuity context, or the novel persona prompt.
    systemPrompt = [
      DEFAULT_COMPANION_PROMPT,
      buildCompanionSystemPrompt(payload),
      promptInjection
    ].filter(Boolean).join("\n\n");
  } else {
    // Novel mode always keeps the built-in default prompt. The browser custom
    // prompt is now an additive injection instead of replacing the default.
    const personaPrompt = getBuiltinPrompt(modelConfig.promptProfile);
    const creativeContext = buildCreativeContextMessage(
      payload?.creative_context,
      payload?.memory_context,
      payload?.continuity_context
    );
    systemPrompt = [
      personaPrompt,
      MODEL_RUNTIME_INJECTION,
      promptInjection,
      creativeContext
    ].filter(Boolean).join("\n\n");
  }

  if (systemPrompt) {
    upstreamMessages.push({
      role: "system",
      content: systemPrompt
    });
  }

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    if (msg.role !== "user" && msg.role !== "assistant") continue;

    const content = typeof msg.content === "string" ? msg.content : "";
    if (!content.trim()) continue;

    upstreamMessages.push({
      role: msg.role,
      content
    });
  }

  return upstreamMessages;
}

function buildRequestBody(modelConfig, messages) {
  return {
    model: modelConfig.id,
    messages,
    stream: true,
    ...(modelConfig.request || {})
  };
}

function shouldFallback(status) {
  return status === 400
    || status === 404
    || status === 408
    || status === 409
    || status === 410
    || status === 429
    || status >= 500;
}

async function requestModel(payload, env, modelConfig) {
  const controller = new AbortController();
  const timeoutMs = Math.max(5000, Number(modelConfig.requestTimeoutMs) || 30000);
  const timer = setTimeout(() => controller.abort("model-timeout"), timeoutMs);

  try {
    const messages = buildMessages(payload, modelConfig);
    const response = await fetch(NVIDIA_CHAT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
      },
      body: JSON.stringify(buildRequestBody(modelConfig, messages)),
      signal: controller.signal
    });
    return { response, error: null };
  } catch (error) {
    return { response: null, error };
  } finally {
    clearTimeout(timer);
  }
}

async function streamNvidia(payload, env, requestedModelId) {
  if (!env.NVIDIA_API_KEY) {
    return resp(
      "Missing NVIDIA_API_KEY. Add the NVIDIA API key in Cloudflare Worker Variables and Secrets.",
      "text/plain; charset=utf-8",
      503
    );
  }

  const candidates = getModelCandidates(requestedModelId);
  const normalizedRequestedId = candidates[0]?.id || DEFAULT_MODEL_ID;
  let fallbackReason = "";
  let lastError = "No model candidate was available.";
  let lastStatus = 502;

  for (let index = 0; index < candidates.length; index += 1) {
    const modelConfig = candidates[index];
    const { response: upstream, error } = await requestModel(payload, env, modelConfig);

    if (error) {
      lastStatus = 504;
      lastError = `${modelConfig.id} request timed out or failed: ${error?.message || "network error"}`;
      if (!fallbackReason) fallbackReason = `request failure on ${modelConfig.id}`;
      continue;
    }

    if (!upstream.ok) {
      const errorText = (await upstream.text().catch(() => "")).slice(0, 2000);
      lastStatus = upstream.status;
      lastError = `NVIDIA API error ${upstream.status} for ${modelConfig.id}: ${errorText}`;

      if (index < candidates.length - 1 && shouldFallback(upstream.status)) {
        if (!fallbackReason) fallbackReason = `HTTP ${upstream.status} on ${modelConfig.id}`;
        continue;
      }

      return resp(lastError, "text/plain; charset=utf-8", upstream.status);
    }

    const switched = modelConfig.id !== normalizedRequestedId;
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Requested-Model": normalizedRequestedId,
        "X-Model-Used": modelConfig.id,
        "X-Model-Provider": modelConfig.provider || "NVIDIA Free Endpoint",
        ...(switched && fallbackReason ? { "X-Model-Fallback": fallbackReason } : {})
      }
    });
  }

  return resp(lastError, "text/plain; charset=utf-8", lastStatus);
}

async function handleMemoryExtract(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResp({ error: "Bad JSON" }, 400);
  }
  const result = await extractStoryMemories(payload, env);
  return jsonResp(result.body, result.status);
}

async function handleContinuityReview(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResp({ error: "Bad JSON" }, 400);
  }
  const result = await reviewContinuity(payload, env);
  return jsonResp(result.body, result.status);
}

async function handleChat(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return resp("Bad JSON", "text/plain; charset=utf-8", 400);
  }

  const requestedModelId = typeof payload?.model === "string" ? payload.model : DEFAULT_MODEL_ID;
  return streamNvidia(payload, env, requestedModelId);
}

function shouldNoStoreAsset(url, response) {
  if (url.pathname === "/") return true;
  if (/\.(?:html?|js|css|json)$/i.test(url.pathname)) return true;
  const contentType = response.headers.get("content-type") || "";
  return /text\/html|javascript|text\/css|application\/json/i.test(contentType);
}

async function serveAsset(request, env) {
  const response = await env.ASSETS.fetch(request);
  if (!response || !shouldNoStoreAsset(new URL(request.url), response)) return response;

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set("X-Unlimited-Frontend", APP_REVISION);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function inspectAsset(request, env, pathname, markers = []) {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return {
      path: pathname,
      available: false,
      status: null,
      markers: Object.fromEntries(markers.map((marker) => [marker, false]))
    };
  }

  const assetUrl = new URL(pathname, request.url);
  assetUrl.searchParams.set("__diag", APP_REVISION);
  const assetRequest = new Request(assetUrl.toString(), {
    method: "GET",
    headers: {
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    }
  });

  try {
    const response = await env.ASSETS.fetch(assetRequest);
    const body = await response.text();
    return {
      path: pathname,
      available: response.ok,
      status: response.status,
      bytes: body.length,
      contentType: response.headers.get("content-type") || "",
      etag: response.headers.get("etag") || "",
      cacheControl: response.headers.get("cache-control") || "",
      markers: Object.fromEntries(markers.map((marker) => [marker, body.includes(marker)]))
    };
  } catch (error) {
    return {
      path: pathname,
      available: false,
      status: null,
      error: error?.message || String(error),
      markers: Object.fromEntries(markers.map((marker) => [marker, false]))
    };
  }
}

async function handleDiagnostics(request, env) {
  const assets = await Promise.all([
    inspectAsset(request, env, "/index.html", ["/boot-diagnostics.js"]),
    inspectAsset(request, env, "/boot-diagnostics.js", ["loadModeRouter", "prompt-center.js"]),
    inspectAsset(request, env, "/prompt-center.js", ["UnlimitedPromptCenter", "自定义注入提示词"]),
    inspectAsset(request, env, "/mode-router.js", ["UnlimitedModeRouter", "uaiEnterNovel", "uaiEnterCompanion"]),
    inspectAsset(request, env, "/mode-router.css", ["uai-mode-lobby", "data-uai-mode"]),
    inspectAsset(request, env, "/companion-mode.js", ["UnlimitedCompanion", "uai_companion_sessions_v1", "mode: \"companion\""]),
    inspectAsset(request, env, "/companion-mode.css", ["uaiCompanionRoot", "uai-c-shell"]),
    inspectAsset(request, env, "/context-bridge.js", ["contextInspectorBtn", "creative_context"]),
    inspectAsset(request, env, "/continuity-bridge.js", ["continuityBtn", "continuity_context"]),
    inspectAsset(request, env, "/memory-bridge.js", ["storyMemoryBtn", "memory_context"])
  ]);

  const frontendCurrent = assets.every((asset) => {
    if (!asset.available) return false;
    const markerValues = Object.values(asset.markers || {});
    return markerValues.length === 0 || markerValues.every(Boolean);
  });

  return jsonResp({
    workerRevision: APP_REVISION,
    assetBindingPresent: Boolean(env.ASSETS && typeof env.ASSETS.fetch === "function"),
    frontendCurrent,
    modes: ["novel", "companion"],
    promptCenter: true,
    conclusion: frontendCurrent
      ? "Dual-mode frontend and prompt center are current."
      : "Worker is current but one or more dual-mode/static assets are older or incomplete.",
    assets
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/config.js") {
      return resp(clientConfigJs(), "text/javascript; charset=utf-8", 200, {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Unlimited-Frontend": APP_REVISION
      });
    }

    if (request.method === "GET" && url.pathname === "/api/diagnostics") {
      return handleDiagnostics(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      return handleChat(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/memory/extract") {
      return handleMemoryExtract(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/continuity/review") {
      return handleContinuityReview(request, env);
    }

    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return serveAsset(request, env);
    }

    return resp(
      "Static assets binding 'ASSETS' is missing. Please configure [assets] in wrangler.toml.",
      "text/plain; charset=utf-8",
      500
    );
  }
};
