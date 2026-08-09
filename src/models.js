// src/models.js
// Single source of truth for models exposed by the Worker and the web UI.

export const MODELS = [
  {
    id: "qwen/qwen3.5-397b-a17b",
    label: "qwen3.5-397b-a17b",
    promptProfile: "creative-primary",
    provider: "NVIDIA Free Endpoint",
    requestTimeoutMs: 45000,
    request: {
      temperature: 0.7,
      top_p: 0.8,
      top_k: 20,
      presence_penalty: 0,
      repetition_penalty: 1,
      max_tokens: 16384,
      chat_template_kwargs: { enable_thinking: false }
    }
  },
  {
    id: "z-ai/glm-5.2",
    label: "glm-5.2",
    promptProfile: "creative-primary",
    provider: "NVIDIA Free Endpoint",
    requestTimeoutMs: 45000,
    request: {
      temperature: 1,
      top_p: 1,
      max_tokens: 16384,
      seed: 42
    }
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    label: "nemotron-3-ultra-550b",
    promptProfile: "creative-primary",
    provider: "NVIDIA Free Endpoint",
    requestTimeoutMs: 50000,
    request: {
      temperature: 1,
      top_p: 0.95,
      max_tokens: 16384,
      chat_template_kwargs: { enable_thinking: false }
    }
  },
  {
    id: "minimaxai/minimax-m3",
    label: "minimax-m3",
    promptProfile: "creative-primary",
    provider: "NVIDIA Free Endpoint",
    requestTimeoutMs: 40000,
    request: {
      temperature: 1,
      top_p: 0.95,
      max_tokens: 8192
    }
  },
  {
    id: "mistralai/mistral-medium-3.5-128b",
    label: "mistral-medium-3.5-128b",
    promptProfile: "creative-primary",
    provider: "NVIDIA Free Endpoint",
    requestTimeoutMs: 40000,
    request: {
      reasoning_effort: "none",
      temperature: 0.7,
      top_p: 1,
      max_tokens: 16384
    }
  },
  {
    id: "stepfun-ai/step-3.7-flash",
    label: "step-3.7-flash",
    promptProfile: "creative-secondary",
    provider: "NVIDIA Free Endpoint",
    requestTimeoutMs: 35000,
    request: {
      temperature: 1,
      top_p: 0.95,
      max_tokens: 16384,
      seed: 42
    }
  },
  {
    id: "google/gemma-4-31b-it",
    label: "gemma-4-31b-it",
    promptProfile: "creative-secondary",
    provider: "NVIDIA Free Endpoint",
    requestTimeoutMs: 35000,
    request: {
      temperature: 1,
      top_p: 0.95,
      top_k: 64,
      max_tokens: 16384,
      chat_template_kwargs: { enable_thinking: false }
    }
  },
  {
    id: "meta/llama-4-maverick-17b-128e-instruct",
    label: "llama-4-maverick",
    promptProfile: "creative-open",
    provider: "NVIDIA Free Endpoint",
    requestTimeoutMs: 35000,
    request: {
      temperature: 1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      max_tokens: 8192
    }
  },
  {
    id: "nvidia/nemotron-3-nano-30b-a3b",
    label: "nemotron-3-nano-30b",
    promptProfile: "creative-secondary",
    provider: "NVIDIA Free Endpoint",
    requestTimeoutMs: 22000,
    request: {
      temperature: 1,
      top_p: 1,
      max_tokens: 8192,
      reasoning_budget: 8192
    }
  },
  {
    id: "openai/gpt-oss-120b",
    label: "gpt-oss-120b",
    promptProfile: "creative-open",
    provider: "NVIDIA Free Endpoint",
    requestTimeoutMs: 26000,
    request: {
      max_tokens: 8192
    }
  }
];

export const DEFAULT_MODEL_ID = "qwen/qwen3.5-397b-a17b";

export const MODEL_FALLBACK_ORDER = [
  "qwen/qwen3.5-397b-a17b",
  "nvidia/nemotron-3-ultra-550b-a55b",
  "minimaxai/minimax-m3",
  "z-ai/glm-5.2",
  "mistralai/mistral-medium-3.5-128b",
  "stepfun-ai/step-3.7-flash",
  "google/gemma-4-31b-it",
  "meta/llama-4-maverick-17b-128e-instruct",
  "nvidia/nemotron-3-nano-30b-a3b",
  "openai/gpt-oss-120b"
];

export function getModelConfig(modelId) {
  return MODELS.find((model) => model.id === modelId) || null;
}

export function resolveModelConfig(modelId) {
  return getModelConfig(modelId) || getModelConfig(DEFAULT_MODEL_ID);
}

export function getModelCandidates(modelId) {
  const requested = resolveModelConfig(modelId);
  const ids = [requested.id, ...MODEL_FALLBACK_ORDER.filter((id) => id !== requested.id)];
  return ids.map(getModelConfig).filter(Boolean);
}
