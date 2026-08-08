import {
  DEFAULT_MODEL,
  MODELS,
  PROMPT_1,
  PROMPT_2,
  PROMPT_3
} from "./config.js";

const GLM_51_MODEL = "z-ai/glm-5.1";
const GLM_52_MODEL = "z-ai/glm-5.2";
const DEEPSEEK_V4_MODEL = "deepseek-ai/deepseek-v4-pro";

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

  return `window.APP_MODELS = ${JSON.stringify(models, null, 2)};
window.APP_DEFAULT_MODEL = ${JSON.stringify(DEFAULT_MODEL)};
`;
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

  if (!env.NVIDIA_API_KEY) {
    return resp(
      "Missing NVIDIA_API_KEY (please set it with wrangler secret).",
      "text/plain; charset=utf-8",
      500
    );
  }

  const requestBody = {
    model,
    stream: true,
    messages: upstreamMessages
  };

  if (model === DEEPSEEK_V4_MODEL) {
    requestBody.temperature = 1;
    requestBody.top_p = 0.95;
    requestBody.max_tokens = 16384;
    requestBody.chat_template_kwargs = { thinking: false };
  } else if (model === GLM_52_MODEL) {
    requestBody.temperature = 1;
    requestBody.top_p = 1;
    requestBody.max_tokens = 16384;
    requestBody.seed = 42;
  }

  const upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!upstream.ok) {
    const errorText = await upstream.text().catch(() => "");
    return resp(
      `NVIDIA API error ${upstream.status}: ${errorText}`,
      "text/plain; charset=utf-8",
      upstream.status
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    }
  });
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
