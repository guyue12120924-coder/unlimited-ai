// src/prompts.js
// Compatibility helper. The active system prompt is defined in src/worker.js.

const PROMPT_PROFILES = {
  "creative-primary": "",
  "creative-secondary": "",
  "creative-open": ""
};

export function getBuiltinPrompt(profile = "creative-primary") {
  return PROMPT_PROFILES[profile] ?? "";
}
