import {
  PROMPT_1,
  PROMPT_2,
  PROMPT_3
} from "./config.js";

const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

const NEMOTRON_MODEL = "nvidia/nemotron-3-super-120b-a12b";
const LLAMA_MODEL = "meta/llama-3.3-70b-instruct";
const GPT_OSS_MODEL = "openai/gpt-oss-120b";
const DEFAULT_MODEL = NEMOTRON_MODEL;

const FREE_MODELS = [
  { id: NEMOTRON_MODEL, label: "nemotron-3-super-120b", persona: 1 },
  { id: LLAMA_MODEL, label: "llama-3.3-70b", persona: 2 },
  { id: GPT_OSS_MODEL, label: "gpt-oss-120b", persona: 3 }
];

function resp(body, contentType = "text/plain; charset=utf-8", status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType,
      ...extraHeaders
    }
  });
}

function isAllowedModel(modelId) {
  return FREE_MODELS.some((m) => m.id === modelId);
}

function builtinPromptForModel(modelId) {
  const meta = FREE_MODELS.find((m) => m.id === modelId);
  const persona = meta?.persona ?? 1;

  if (persona === 3) return PROMPT_3;
  if (persona === 2) return PROMPT_2;
  return PROMPT_1;
}

function clientConfigJs() {
  const models = FREE_MODELS.map((m) => ({
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

function buildRequestBody(model, messages) {
  const body = {
    model,
    messages,
    stream: true
  };

  if (model === NEMOTRON_MODEL) {
    body.temperature = 1;
    body.top_p = 0.95;
    body.max_tokens = 16384;
    body.chat_template_kwargs = { enable_thinking: true };
    body.reasoning_budget = 16384;
  } else if (model === LLAMA_MODEL) {
    body.temperature = 0.2;
    body.top_p = 0.7;
    body.max_tokens = 4096;
  } else if (model === GPT_OSS_MODEL) {
    body.max_tokens = 8192;
  }

  return body;
}

async function streamNvidia(payload, env, model) {
  if (!env.NVIDIA_API_KEY) {
    return resp(
      "Missing NVIDIA_API_KEY. Add the NVIDIA API key in Cloudflare Worker Variables and Secrets.",
      "text/plain; charset=utf-8",
      503
    );
  }

  const messages = buildMessages(payload, model);
  const upstream = await fetch(NVIDIA_CHAT_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
      "Accept": "text/event-stream"
    },
    body: JSON.stringify(buildRequestBody(model, messages))
  });

  if (!upstream.ok) {
    const errorText = await upstream.text().catch(() => "");
    return resp(
      `NVIDIA API error ${upstream.status} for ${model}: ${errorText}`,
      "text/plain; charset=utf-8",
      upstream.status
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Requested-Model": model,
      "X-Model-Used": model,
      "X-Model-Provider": "NVIDIA Free Endpoint"
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
  return streamNvidia(payload, env, model);
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
