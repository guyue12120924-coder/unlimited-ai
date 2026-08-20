import {
  MODELS,
  DEFAULT_MODEL_ID,
  getModelCandidates
} from "./models.js";
import { buildCreativeContextMessage } from "./context.js";
import { extractStoryMemories } from "./memory-extractor.js";
import { reviewContinuity } from "./continuity-review.js";
import {
  getCompanionRoleCard,
  buildCompanionRuntimeContext
} from "./companion.js";

// Compatibility marker: buildCompanionSystemPrompt(payload) remains available in companion.js for preview/testing only.
const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const APP_REVISION = "2026-08-20-v16.0-worker-stability";
const MAX_CHAT_BODY_BYTES = 768 * 1024;
const MAX_AUX_BODY_BYTES = 384 * 1024;
const MAX_MODEL_ATTEMPTS = 3;
const STREAM_IDLE_TIMEOUT_MS = 45000;
const RATE_WINDOW_MS = 60000;
const RATE_BUCKETS = new Map();

// ============================================================
// 小说模式默认 System Prompt
// 以后如果要直接从代码里修改小说默认提示词，就改这里。
// ============================================================
const NOVEL_SYSTEM_PROMPT = `
你是 Unlimited AI 的长篇小说创作助手。

你的任务是根据用户要求直接完成小说创作、续写、改写、润色、设定整理和故事分析，同时尽量保持人物、关系、时间线、世界规则、章节目标和前文事实的一致性。

小说正文任务中：
- 直接输出可使用的正文，不先解释写作计划。
- 优先使用具体动作、环境细节、感官描写和符合人物身份的对白。
- 保持人物姓名、身份、关系、位置、伤势、知识状态和既有经历一致。
- 保持世界观、时间线、已揭示信息和未解决伏笔一致。
- 用户没有明确要求改变设定时，不擅自推翻已有事实。
- 避免重复句式、机械总结和无意义的空泛描写。
- 信息略有缺失时，在不破坏已有设定的前提下作合理补全，不要频繁打断用户追问。

当用户要求大纲、分析、检查或建议时，再使用清晰的结构化输出。
`.trim();

const MODEL_RUNTIME_INJECTION = `
运行约束：
- 用户使用中文时默认使用自然、流畅的中文回复；用户明确指定其他语言时服从用户要求。
- 小说创作、续写、润色、改写任务直接输出可使用的正文，不解释“我将如何写”，除非用户明确要求分析。
- 系统提供的当前正文、当前章节计划、人物状态、人物关系、世界规则、上一章摘要、未解决伏笔与连续性信息属于事实约束。
- 当不同背景信息出现冲突时，优先采用更近期、更具体、更接近当前章节的信息，不要用旧设定覆盖当前事实。
- 除非用户明确要求修改设定，不擅自改变已经确定的人名、身份、关系、伤势、位置、时间、知识状态、重要物品和世界规则。
- 长篇续写保持视角、时态、人物口吻、叙事节奏与前文事实一致，避免重复前文、机械总结和无依据新增设定。
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

function jsonResp(value, status = 200, extraHeaders = {}) {
  return resp(JSON.stringify(value, null, 2), "application/json; charset=utf-8", status, {
    "Cache-Control": "no-store",
    ...extraHeaders
  });
}

function clientConfigJs() {
  const models = MODELS.map((model) => ({
    id: model.id,
    label: model.label
  }));

  return `window.APP_MODELS = ${JSON.stringify(models, null, 2)};\nwindow.APP_DEFAULT_MODEL = ${JSON.stringify(DEFAULT_MODEL_ID)};\nwindow.APP_REVISION = ${JSON.stringify(APP_REVISION)};\n`;
}

function sameSiteRequest(request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return false;
  const site = String(request.headers.get("sec-fetch-site") || "").toLowerCase();
  return site !== "cross-site";
}

function requestClientKey(request) {
  return request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

function consumeRateLimit(request, route, limit) {
  const now = Date.now();
  const key = `${route}:${requestClientKey(request)}`;
  const current = RATE_BUCKETS.get(key);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    RATE_BUCKETS.set(key, { startedAt: now, count: 1 });
  } else {
    current.count += 1;
    if (current.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - current.startedAt)) / 1000));
      return { allowed: false, retryAfter };
    }
  }

  if (RATE_BUCKETS.size > 1000) {
    for (const [bucketKey, value] of RATE_BUCKETS) {
      if (now - value.startedAt > RATE_WINDOW_MS * 2) RATE_BUCKETS.delete(bucketKey);
    }
  }
  return { allowed: true, retryAfter: 0 };
}

function rateLimitResponse(retryAfter) {
  return jsonResp({
    error: "Too many requests. Please wait a moment and try again.",
    code: "RATE_LIMITED"
  }, 429, {
    "Retry-After": String(retryAfter),
    "X-RateLimit-Scope": "worker-isolate"
  });
}

async function readJsonLimited(request, maxBytes) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) return { error: "Request body is too large", status: 413, payload: null };

  let text;
  try { text = await request.text(); }
  catch { return { error: "Unable to read request body", status: 400, payload: null }; }

  const size = new TextEncoder().encode(text).byteLength;
  if (size > maxBytes) return { error: "Request body is too large", status: 413, payload: null };
  try {
    return { error: "", status: 200, payload: JSON.parse(text) };
  } catch {
    return { error: "Bad JSON", status: 400, payload: null };
  }
}

function conversationLimits(mode) {
  return mode === "companion"
    ? { maxMessages: 28, maxChars: 42000 }
    : { maxMessages: 36, maxChars: 64000 };
}

function trimConversationMessages(messages, mode) {
  const { maxMessages, maxChars } = conversationLimits(mode);
  const normalized = (Array.isArray(messages) ? messages : [])
    .filter((msg) => msg && (msg.role === "user" || msg.role === "assistant") && typeof msg.content === "string" && msg.content.trim())
    .map((msg) => ({ role: msg.role, content: msg.content }));

  const kept = [];
  let chars = 0;
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const message = normalized[index];
    const cost = message.content.length;
    if (kept.length >= maxMessages) break;
    if (kept.length >= 6 && chars + cost > maxChars) break;
    kept.push(message);
    chars += cost;
  }
  return kept.reverse();
}

function buildMessages(payload) {
  const mode = payload?.mode === "companion" ? "companion" : "novel";
  const messages = trimConversationMessages(payload?.messages, mode);
  const upstreamMessages = [];

  if (mode === "companion") {
    const roleCard = getCompanionRoleCard();
    const runtimeContext = buildCompanionRuntimeContext(payload);

    if (roleCard) upstreamMessages.push({ role: "system", content: roleCard });
    if (runtimeContext) upstreamMessages.push({ role: "user", content: runtimeContext });
  } else {
    const useBuiltinPersona = payload?.use_builtin_persona !== false;
    const customSystemPrompt = typeof payload?.custom_system_prompt === "string" ? payload.custom_system_prompt.trim() : "";
    const personaPrompt = useBuiltinPersona ? NOVEL_SYSTEM_PROMPT : (customSystemPrompt || NOVEL_SYSTEM_PROMPT);
    const creativeContext = buildCreativeContextMessage(
      payload?.creative_context,
      payload?.memory_context,
      payload?.continuity_context
    );

    const systemPrompt = [personaPrompt, MODEL_RUNTIME_INJECTION, creativeContext].filter(Boolean).join("\n\n");
    if (systemPrompt) upstreamMessages.push({ role: "system", content: systemPrompt });
  }

  upstreamMessages.push(...messages);
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
  return status === 404 || status === 408 || status === 409 || status === 410 || status >= 500;
}

async function requestModel(payload, env, modelConfig) {
  const controller = new AbortController();
  const timeoutMs = Math.max(5000, Number(modelConfig.requestTimeoutMs) || 30000);
  const timer = setTimeout(() => controller.abort("model-header-timeout"), timeoutMs);

  try {
    const messages = buildMessages(payload);
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
    return { response, error: null, controller };
  } catch (error) {
    return { response: null, error, controller };
  } finally {
    clearTimeout(timer);
  }
}

function streamWithIdleTimeout(body, controller, timeoutMs = STREAM_IDLE_TIMEOUT_MS) {
  if (!body) return null;
  const reader = body.getReader();
  let timer = 0;
  let finished = false;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = 0;
  };
  const arm = () => {
    clearTimer();
    timer = setTimeout(() => controller.abort("model-stream-idle-timeout"), timeoutMs);
  };

  return new ReadableStream({
    async pull(output) {
      if (finished) return;
      arm();
      try {
        const { done, value } = await reader.read();
        if (done) {
          finished = true;
          clearTimer();
          output.close();
          return;
        }
        arm();
        output.enqueue(value);
      } catch (error) {
        finished = true;
        clearTimer();
        output.error(error);
      }
    },
    cancel(reason) {
      finished = true;
      clearTimer();
      controller.abort(reason || "client-cancelled");
      return reader.cancel(reason).catch(() => {});
    }
  });
}

async function streamNvidia(payload, env, requestedModelId) {
  if (!env.NVIDIA_API_KEY) {
    return resp(
      "Missing NVIDIA_API_KEY. Add the NVIDIA API key in Cloudflare Worker Variables and Secrets.",
      "text/plain; charset=utf-8",
      503
    );
  }

  const candidates = getModelCandidates(requestedModelId).slice(0, MAX_MODEL_ATTEMPTS);
  const normalizedRequestedId = candidates[0]?.id || DEFAULT_MODEL_ID;
  let fallbackReason = "";
  let lastError = "No model candidate was available.";
  let lastStatus = 502;

  for (let index = 0; index < candidates.length; index += 1) {
    const modelConfig = candidates[index];
    const { response: upstream, error, controller } = await requestModel(payload, env, modelConfig);

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

      return resp(lastError, "text/plain; charset=utf-8", upstream.status, {
        ...(upstream.status === 429 ? { "Retry-After": upstream.headers.get("retry-after") || "30" } : {})
      });
    }

    const guardedBody = streamWithIdleTimeout(upstream.body, controller);
    if (!guardedBody) return resp("Model returned an empty stream", "text/plain; charset=utf-8", 502);
    const switched = modelConfig.id !== normalizedRequestedId;
    return new Response(guardedBody, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Requested-Model": normalizedRequestedId,
        "X-Model-Used": modelConfig.id,
        "X-Model-Provider": modelConfig.provider || "NVIDIA Free Endpoint",
        "X-Model-Attempts-Max": String(MAX_MODEL_ATTEMPTS),
        ...(switched && fallbackReason ? { "X-Model-Fallback": fallbackReason } : {})
      }
    });
  }

  return resp(lastError, "text/plain; charset=utf-8", lastStatus);
}

async function handleMemoryExtract(request, env) {
  const parsed = await readJsonLimited(request, MAX_AUX_BODY_BYTES);
  if (parsed.error) return jsonResp({ error: parsed.error }, parsed.status);
  const result = await extractStoryMemories(parsed.payload, env);
  return jsonResp(result.body, result.status);
}

async function handleContinuityReview(request, env) {
  const parsed = await readJsonLimited(request, MAX_AUX_BODY_BYTES);
  if (parsed.error) return jsonResp({ error: parsed.error }, parsed.status);
  const result = await reviewContinuity(parsed.payload, env);
  return jsonResp(result.body, result.status);
}

async function handleChat(request, env) {
  const parsed = await readJsonLimited(request, MAX_CHAT_BODY_BYTES);
  if (parsed.error) return resp(parsed.error, "text/plain; charset=utf-8", parsed.status);
  const payload = parsed.payload;
  const requestedModelId = typeof payload?.model === "string" ? payload.model : DEFAULT_MODEL_ID;
  return streamNvidia(payload, env, requestedModelId);
}

function staticCachePolicy(url, response) {
  const pathname = url.pathname;
  const contentType = response.headers.get("content-type") || "";
  if (pathname === "/" || /\.html?$/i.test(pathname) || /text\/html/i.test(contentType)) {
    return "no-store, no-cache, must-revalidate, max-age=0";
  }
  if (/\.json$/i.test(pathname) || /application\/json/i.test(contentType)) {
    return "no-store, no-cache, must-revalidate, max-age=0";
  }
  if (/\.(?:js|css)$/i.test(pathname) || /javascript|text\/css/i.test(contentType)) {
    return url.searchParams.has("v")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=300, must-revalidate";
  }
  return "";
}

async function serveAsset(request, env) {
  const response = await env.ASSETS.fetch(request);
  if (!response) return response;
  const url = new URL(request.url);
  const policy = staticCachePolicy(url, response);
  if (!policy) return response;

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", policy);
  headers.set("X-Unlimited-Frontend", APP_REVISION);
  if (policy.startsWith("no-store")) {
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
  } else {
    headers.delete("Pragma");
    headers.delete("Expires");
  }

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
    headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }
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
    inspectAsset(request, env, "/index.html", ["2026-08-20-v16.0-stability", "/chat-transport-v16.js?v=20260820-v16.0"]),
    inspectAsset(request, env, "/chat-transport-v16.js", ["2026-08-20-v16.0-chat-transport", "lineBufferedBody", "isolatePayload"]),
    inspectAsset(request, env, "/novel-workspace-v154.js", ["2026-08-18-v15.4-novel-final", "ambienceEligible", "novelV154Ready"]),
    inspectAsset(request, env, "/boot-diagnostics.js", ["2026-08-17-v14.7-entry-zero-companion", "uaiDeferredPlaceholder", "companion-lazy-bridge.js"]),
    inspectAsset(request, env, "/companion-lazy-bridge.js", ["2026-08-17-v14.7-companion-lazy-bridge", "uai:companion-assets-progress", "warm: ensureLoader"]),
    inspectAsset(request, env, "/companion-assets-loader.js", ["2026-08-17-v14.7-companion-lazy-progress", "TOTAL_ASSETS", "uaiDeferredPlaceholder"]),
    inspectAsset(request, env, "/mode-router.js", ["2026-08-17-v13.4-mode-router-performance", "effectFrameDelay", "prefersReducedMotion"]),
    inspectAsset(request, env, "/mode-router-luxury-stage5.js", ["2026-08-17-v14.4-micro-polish", "UnlimitedModeLuxuryStage5", "uai-companion-typing"]),
    inspectAsset(request, env, "/companion-mode.js", ["UnlimitedCompanion", "uai_companion_sessions_v1", "mode: \"companion\""]),
    inspectAsset(request, env, "/companion-runtime.js", ["v9.6-runtime", "chars: 5000", "patchCompanionBody"]),
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
    stability: {
      maxModelAttempts: MAX_MODEL_ATTEMPTS,
      streamIdleTimeoutMs: STREAM_IDLE_TIMEOUT_MS,
      maxChatBodyBytes: MAX_CHAT_BODY_BYTES,
      chatRateWindowMs: RATE_WINDOW_MS,
      conversationWindowing: true,
      versionedJsCssImmutableCache: true
    },
    companionLoading: "deferred until the companion card is selected; loader script may prewarm on clear hover/focus intent",
    companionInitialStyle: "deferred via a non-rendering boot placeholder until companion assets are requested",
    lobbyRendering: "adaptive starfield cadence with strict reduced-motion shutdown",
    promptLocation: {
      novel: "src/worker.js -> NOVEL_SYSTEM_PROMPT",
      companion: "src/companion.js -> COMPANION_ROLE_CARD"
    },
    conclusion: frontendCurrent
      ? "V16 stability assets are current; chat transport isolation, bounded fallback and stream guards are present."
      : "This Worker deployment is missing one or more V16 stability assets. Redeploy the current main branch.",
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

    if (request.method === "GET" && url.pathname === "/api/diagnostics") return handleDiagnostics(request, env);

    if (request.method === "POST" && ["/api/chat", "/api/memory/extract", "/api/continuity/review"].includes(url.pathname)) {
      if (!sameSiteRequest(request)) return jsonResp({ error: "Cross-site API request blocked", code: "CROSS_SITE_BLOCKED" }, 403);
      const route = url.pathname === "/api/chat" ? "chat" : "analysis";
      const limit = route === "chat" ? 24 : 12;
      const rate = consumeRateLimit(request, route, limit);
      if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    }

    if (request.method === "POST" && url.pathname === "/api/chat") return handleChat(request, env);
    if (request.method === "POST" && url.pathname === "/api/memory/extract") return handleMemoryExtract(request, env);
    if (request.method === "POST" && url.pathname === "/api/continuity/review") return handleContinuityReview(request, env);

    if (env.ASSETS && typeof env.ASSETS.fetch === "function") return serveAsset(request, env);

    return resp(
      "Static assets binding 'ASSETS' is missing. Please configure [assets] in wrangler.toml.",
      "text/plain; charset=utf-8",
      500
    );
  }
};