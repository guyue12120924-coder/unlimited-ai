import {
  MODELS,
  DEFAULT_MODEL_ID,
  getModelCandidates
} from "./models.js";
import { getBuiltinPrompt } from "./prompts.js";
import { buildCreativeContextMessage } from "./context.js";

const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

function resp(body, contentType = "text/plain; charset=utf-8", status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType,
      ...extraHeaders
    }
  });
}

function clientConfigJs() {
  const models = MODELS.map((model) => ({
    id: model.id,
    label: model.label
  }));

  return `window.APP_MODELS = ${JSON.stringify(models, null, 2)};\nwindow.APP_DEFAULT_MODEL = ${JSON.stringify(DEFAULT_MODEL_ID)};\n`;
}

function buildMessages(payload, modelConfig) {
  const useBuiltinPersona = payload?.use_builtin_persona !== false;
  const customSystemPrompt =
    typeof payload?.custom_system_prompt === "string"
      ? payload.custom_system_prompt.trim()
      : "";

  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const upstreamMessages = [];

  if (useBuiltinPersona) {
    upstreamMessages.push({
      role: "system",
      content: getBuiltinPrompt(modelConfig.promptProfile)
    });
  } else if (customSystemPrompt) {
    upstreamMessages.push({
      role: "system",
      content: customSystemPrompt
    });
  }

  const creativeContext = buildCreativeContextMessage(payload?.creative_context, payload?.memory_context);
  if (creativeContext) {
    upstreamMessages.push({
      role: "system",
      content: creativeContext
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
