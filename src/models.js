// src/models.js
// Single source of truth for models exposed by the Worker and the web UI.

export const MODELS = [
  {
    id: "deepseek-ai/deepseek-v4-pro",
    label: "deepseek-v4-pro",
    promptProfile: "creative-primary",
    provider: "NVIDIA Free Endpoint",
    requestTimeoutMs: 30000,
    request: {
      temperature: 1,
      top_p: 0.95,
      max_tokens: 16384,
      reasoning_effort: "none"
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

export const DEFAULT_MODEL_ID = "deepseek-ai/deepseek-v4-pro";

export const MODEL_FALLBACK_ORDER = [
  "deepseek-ai/deepseek-v4-pro",
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
