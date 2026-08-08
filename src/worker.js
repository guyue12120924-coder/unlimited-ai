import {
  DEFAULT_MODEL,
  MODELS,
  PROMPT_1,
  PROMPT_2,
  PROMPT_3
} from "./config.js";

const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions";
const GLM_CHAT_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

const GLM_51_MODEL = "z-ai/glm-5.1";
const GLM_52_MODEL = "z-ai/glm-5.2";
const DEEPSEEK_V4_PRO_MODEL = "deepseek-ai/deepseek-v4-pro";
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

function buildMessages(payload, model) {
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
      content: builtinPromptForModel(model)
    });
  } else if (customSystemPrompt) {
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

function providerHeaders(requestedModel, usedModel, provider) {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Requested-Model": requestedModel,
    "X-Model-Used": usedModel,
    "X-Model-Provider": provider
  };
}

async function streamUpstream({ url, apiKey, body, requestedModel, usedModel, provider }) {
  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "text/event-stream"
    },
    body: JSON.stringify(body)
  });

  if (!upstream.ok) {
    const errorText = await upstream.text().catch(() => "");
    return resp(
      `${provider} API error ${upstream.status}: ${errorText}`,
      "text/plain; charset=utf-8",
      upstream.status
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: providerHeaders(requestedModel, usedModel, provider)
  });
}

async function handleDeepSeek(payload, env) {
  if (!env.DEEPSEEK_API_KEY) {
    return resp(
      "Missing DEEPSEEK_API_KEY. Add a DeepSeek API key in Cloudflare Worker Variables and Secrets.",
      "text/plain; charset=utf-8",
      503
    );
  }

  const messages = buildMessages(payload, DEEPSEEK_V4_PRO_MODEL);

  return streamUpstream({
    url: DEEPSEEK_CHAT_URL,
    apiKey: env.DEEPSEEK_API_KEY,
    requestedModel: DEEPSEEK_V4_PRO_MODEL,
    usedModel: DEEPSEEK_V4_PRO_MODEL,
    provider: "DeepSeek",
    body: {
      model: "deepseek-v4-pro",
      messages,
      stream: true,
      temperature: 1,
      top_p: 0.95,
      max_tokens: 16384,
      thinking: { type: "disabled" }
    }
  });
}

async function handleGlm(payload, env) {
  if (!env.GLM_API_KEY) {
    return resp(
      "Missing GLM_API_KEY. Add a Zhipu/BigModel API key in Cloudflare Worker Variables and Secrets.",
      "text/plain; charset=utf-8",
      503
    );
  }

  const messages = buildMessages(payload, GLM_52_MODEL);

  return streamUpstream({
    url: GLM_CHAT_URL,
    apiKey: env.GLM_API_KEY,
    requestedModel: GLM_52_MODEL,
    usedModel: GLM_52_MODEL,
    provider: "Zhipu",
    body: {
      model: "glm-5.2",
      messages,
      stream: true,
      temperature: 1,
      top_p: 0.95,
      max_tokens: 16384,
      thinking: { type: "enabled" },
      reasoning_effort: "high"
    }
  });
}

async function handleGptOss(payload, env) {
  if (!env.NVIDIA_API_KEY) {
    return resp(
      "Missing NVIDIA_API_KEY. Add the NVIDIA API key in Cloudflare Worker Variables and Secrets.",
      "text/plain; charset=utf-8",
      503
    );
  }

  const messages = buildMessages(payload, GPT_OSS_MODEL);

  return streamUpstream({
    url: NVIDIA_CHAT_URL,
    apiKey: env.NVIDIA_API_KEY,
    requestedModel: GPT_OSS_MODEL,
    usedModel: GPT_OSS_MODEL,
    provider: "NVIDIA",
    body: {
      model: GPT_OSS_MODEL,
      messages,
      stream: true
    }
  });
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

  if (model === DEEPSEEK_V4_PRO_MODEL) {
    return handleDeepSeek(payload, env);
  }

  if (model === GLM_52_MODEL) {
    return handleGlm(payload, env);
  }

  if (model === GPT_OSS_MODEL) {
    return handleGptOss(payload, env);
  }

  return resp(`Unsupported model: ${model}`, "text/plain; charset=utf-8", 400);
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
