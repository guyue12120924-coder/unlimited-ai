// src/prompts.js
// Prompt profiles are task-oriented and intentionally separate from model IDs.

import {
  PROMPT_1,
  PROMPT_2,
  PROMPT_3
} from "./config.js";

const PROMPT_PROFILES = {
  "creative-primary": PROMPT_1,
  "creative-secondary": PROMPT_2,
  "creative-open": PROMPT_3
};

export function getBuiltinPrompt(profile = "creative-primary") {
  return PROMPT_PROFILES[profile] || PROMPT_PROFILES["creative-primary"];
}
