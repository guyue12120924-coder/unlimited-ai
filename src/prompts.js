// src/prompts.js
// Task-oriented built-in prompts. Model IDs never appear here.
// Main novel default text is centralized in default-prompts.js.

import { DEFAULT_NOVEL_PROMPT } from "./default-prompts.js";

const CREATIVE_PRIMARY = DEFAULT_NOVEL_PROMPT;

const CREATIVE_SECONDARY = `
${DEFAULT_NOVEL_PROMPT}

补充倾向：优先高效完成场景执行、续写、改写和润色。保持叙事连贯、语言具体，不解释写作过程。
`.trim();

const CREATIVE_OPEN = `
${DEFAULT_NOVEL_PROMPT}

补充倾向：兼顾小说正文、头脑风暴、修改和故事分析。正文任务直接给成品，规划和分析任务再使用结构化表达。
`.trim();

const PROMPT_PROFILES = {
  "creative-primary": CREATIVE_PRIMARY,
  "creative-secondary": CREATIVE_SECONDARY,
  "creative-open": CREATIVE_OPEN
};

export function getBuiltinPrompt(profile = "creative-primary") {
  return PROMPT_PROFILES[profile] || PROMPT_PROFILES["creative-primary"];
}
