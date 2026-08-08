import {
  DEFAULT_MODEL,
  MODELS,
  PROMPT_1,
  PROMPT_2,
  PROMPT_3
} from "./config.js";

const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const GLM_51_MODEL = "z-ai/glm-5.1";
const GLM_52_MODEL = "z-ai/glm-5.2";
const DEEPSEEK_V4_PRO_MODEL = "deepseek-ai/deepseek-v4-pro";
const DEEPSEEK_V4_FLASH_MODEL = "deepseek-ai/deepseek-v4-flash";
const GPT_OSS_MODEL = "openai/gpt-oss-120b";

function resp(body, contentType = "text/plain; charset=utf-8", status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType,
      ...extraHeaders
    }
  });
}

function clientModels() {
  return MODELS.map((model) => {
    if (model.id !== GLM_51_MODEL) return model;
    return {
      ...model,
      id: GLM_52_MODEL,
      label: "glm-5.2"
    };
  });
}

function isAllowedModel(modelId) {
  return clientModels().some((m) => m.id === modelId);
}

function builtinPromptForModel(modelId) {
  const lookupId = modelId === GLM_52_MODEL ? GLM_51_MODEL : modelId;
  const meta = MODELS.find((m) => m.id === lookupId);
  const persona = meta?.persona ?? 1;

  if (persona === 3) return PROMPT_3;
  if (persona === 2) return PROMPT_2;
  return PROMPT_1;
}

function clientConfigJs() {
  const models = clientModels().map((m) => ({
    id: m.id,
    label: m.label
  }));

  return `window.APP_MODELS = ${JSON.stringify(models, null, 2)};\nwindow.APP_DEFAULT_MODEL = ${JSON.stringify(DEFAULT_MODEL)};\n`;
}

function buildMessages(payload, model, includeBuiltinPersona = true) {
  const useBuiltinPersona = payload?.use_builtin_persona !== false;
  const customSystemPrompt =
    typeof payload?.custom_system_prompt === "string"
      ? payload.custom_system_prompt.trim()
      : "";

  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const upstreamMessages = [];

  if (useBuiltinPersona && includeBuiltinPersona) {
    upstreamMessages.push({
      role: "system",
      content: builtinPromptForModel(model)
    });
  } else if (!useBuiltinPersona && customSystemPrompt) {
    upstreamMessages.push({
      role: "system",
      content: customSystemPrompt
    });
  }

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    if (msg.role !== "user" && msg.role !== "assistant") continue;

    upstreamMessages.push({
      role: msg.role,
      content: typeof msg.content === "string" ? msg.content : ""
    });
  }

  return upstreamMessages;
}

function buildRequestBody(model, messages, stream) {
  const body = {
    model,
    messages,
    stream
  };

  if (model === DEEPSEEK_V4_PRO_MODEL) {
    body.temperature = 1;
    body.top_p = 0.95;
    body.max_tokens = 16384;
    body.chat_template_kwargs = { thinking: false };
  } else if (model === DEEPSEEK_V4_FLASH_MODEL) {
    body.temperature = 1;
    body.top_p = 0.95;
    body.max_tokens = 8192;
    body.chat_template_kwargs = {
      thinking: true,
      reasoning_effort: "high"
    };
  } else if (model === GLM_52_MODEL) {
    body.temperature = 1;
    body.top_p = 1;
    body.max_tokens = 4096;
    body.seed = 42;
  }

  return body;
}

async function fetchJsonWithTimeout(env, model, messages, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(NVIDIA_CHAT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(buildRequestBody(model, messages, false)),
      signal: controller.signal
    });

    const text = await upstream.text().catch(() => "");
    return {
      ok: upstream.ok,
      status: upstream.status,
      text
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      return {
        ok: false,
        status: 504,
        text: `NVIDIA model ${model} timed out after ${Math.round(timeoutMs / 1000)}s`
      };
    }

    return {
      ok: false,
      status: 502,
      text: error?.message || "NVIDIA request failed"
    };
  } finally {
    clearTimeout(timer);
  }
}

function jsonResultToSse(result, usedModel, requestedModel, fallbackReason = "") {
  let parsed;
  try {
    parsed = JSON.parse(result.text || "{}");
  } catch {
    return resp(
      `NVIDIA returned invalid JSON for ${usedModel}: ${result.text}`,
      "text/plain; charset=utf-8",
      502
    );
  }

  const content = parsed?.choices?.[0]?.message?.content ?? "";
  const usage = parsed?.usage ?? null;
  const chunk = {
    choices: [{ delta: { content } }]
  };
  if (usage) chunk.usage = usage;

  const sse = `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`;
  const headers = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Requested-Model": requestedModel,
    "X-Model-Used": usedModel
  };

  if (usedModel !== requestedModel) {
    headers["X-Model-Fallback"] = fallbackReason || "upstream model unavailable";
  }

  return resp(sse, "text/event-stream; charset=utf-8", 200, headers);
}

async function streamGptOss(env, messages, requestedModel = GPT_OSS_MODEL, fallbackReason = "") {
  const upstream = await fetch(NVIDIA_CHAT_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildRequestBody(GPT_OSS_MODEL, messages, true))
  });

  if (!upstream.ok) {
    const errorText = await upstream.text().catch(() => "");
    return resp(
      `NVIDIA API error ${upstream.status}: ${errorText}`,
      "text/plain; charset=utf-8",
      upstream.status
    );
  }

  const headers = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Requested-Model": requestedModel,
    "X-Model-Used": GPT_OSS_MODEL
  };

  if (requestedModel !== GPT_OSS_MODEL) {
    headers["X-Model-Fallback"] = fallbackReason || "upstream model unavailable";
  }

  return new Response(upstream.body, {
    status: 200,
    headers
  });
}

async function handleDeepSeek(payload, env) {
  const requestedModel = DEEPSEEK_V4_PRO_MODEL;

  // First try the exact NVIDIA example shape and keep the existing built-in persona.
  let messages = buildMessages(payload, requestedModel, true);
  let result = await fetchJsonWithTimeout(env, requestedModel, messages, 45000);
  if (result.ok) return jsonResultToSse(result, requestedModel, requestedModel);

  // Some newer NVIDIA endpoints reject or stall on large system prompts. Retry the
  // same model in compatibility mode before changing model identity.
  messages = buildMessages(payload, requestedModel, false);
  const compatResult = await fetchJsonWithTimeout(env, requestedModel, messages, 45000);
  if (compatResult.ok) {
    return jsonResultToSse(
      compatResult,
      requestedModel,
      requestedModel,
      `compatibility retry after HTTP ${result.status}`
    );
  }

  // If V4 Pro itself is unavailable for this NVIDIA account, stay in the same
  // DeepSeek V4 family and fall back to the currently available V4 Flash endpoint.
  const flashResult = await fetchJsonWithTimeout(env, DEEPSEEK_V4_FLASH_MODEL, messages, 45000);
  if (flashResult.ok) {
    return jsonResultToSse(
      flashResult,
      DEEPSEEK_V4_FLASH_MODEL,
      requestedModel,
      `V4 Pro unavailable (${compatResult.status}); used V4 Flash`
    );
  }

  // Last-resort service continuity: keep the site usable even if NVIDIA blocks
  // both DeepSeek endpoints for the current account. The response headers expose
  // that a fallback occurred instead of silently pretending it was DeepSeek.
  return streamGptOss(
    env,
    messages,
    requestedModel,
    `DeepSeek V4 Pro ${compatResult.status}; V4 Flash ${flashResult.status}`
  );
}

async function handleGlm(payload, env) {
  const requestedModel = GLM_52_MODEL;

  // GLM-5.2 has recently shown long queue times on NVIDIA's free endpoint.
  // Use a smaller output budget and non-streaming request so the Worker can
  // enforce a real timeout instead of leaving the browser spinning forever.
  let messages = buildMessages(payload, requestedModel, true);
  let result = await fetchJsonWithTimeout(env, requestedModel, messages, 60000);
  if (result.ok) return jsonResultToSse(result, requestedModel, requestedModel);

  // Retry without the large built-in system prompt. This preserves the real GLM
  // model and fixes compatibility failures caused by stricter endpoint templates.
  messages = buildMessages(payload, requestedModel, false);
  const compatResult = await fetchJsonWithTimeout(env, requestedModel, messages, 60000);
  if (compatResult.ok) {
    return jsonResultToSse(
      compatResult,
      requestedModel,
      requestedModel,
      `compatibility retry after HTTP ${result.status}`
    );
  }

  // Do not leave the UI hanging indefinitely when NVIDIA's GLM endpoint is
  // degraded or unavailable for this account. Fall back to the already-working
  // GPT-OSS endpoint and disclose it in response headers.
  return streamGptOss(
    env,
    messages,
    requestedModel,
    `GLM-5.2 unavailable (${compatResult.status})`
  );
}

async function handleChat(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return resp("Bad JSON", "text/plain; charset=utf-8", 400);
  }

  const requestedModel = payload?.model;
  const model = isAllowedModel(requestedModel) ? requestedModel : DEFAULT_MODEL;

  if (!env.NVIDIA_API_KEY) {
    return resp(
      "Missing NVIDIA_API_KEY (please set it with wrangler secret).",
      "text/plain; charset=utf-8",
      500
    );
  }

  if (model === DEEPSEEK_V4_PRO_MODEL) {
    return handleDeepSeek(payload, env);
  }

  if (model === GLM_52_MODEL) {
    return handleGlm(payload, env);
  }

  const messages = buildMessages(payload, model, true);
  return streamGptOss(env, messages, model);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/config.js") {
      return resp(clientConfigJs(), "text/javascript; charset=utf-8");
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      return handleChat(request, env);
    }

    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }

    return resp(
      "Static assets binding 'ASSETS' is missing. Please configure [assets] in wrangler.toml.",
      "text/plain; charset=utf-8",
      500
    );
  }
};
