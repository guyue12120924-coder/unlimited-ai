// src/context.js
// Formats structured novel/project context into a compact system message.

const CREATIVE_CONTEXT_CHAR_BUDGET = 24000;

const LIMITS = {
  synopsis: 5000,
  outline: 7000,
  world: 7000,
  notes: 4000,
  timeline: 5000,
  foreshadow: 5000,
  relations: 4500,
  chapter: 5000,
  character: 2600,
  previousChapter: 3500
};

function text(value, limit = 4000) {
  if (value == null) return "";
  const raw = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const clean = raw.trim();
  if (!clean) return "";
  return clean.length > limit ? `${clean.slice(0, limit)}\n[内容已截断]` : clean;
}

function section(title, value, limit) {
  const body = text(value, limit);
  return body ? `## ${title}\n${body}` : "";
}

function characterText(character) {
  if (typeof character === "string") {
    const clean = text(character, LIMITS.character);
    return clean ? `### 人物\n${clean}` : "";
  }
  if (!character || typeof character !== "object") return "";

  const name = text(character.name || character.title || character.id || "人物", 120);
  const preferred = [
    ["身份", character.role || character.identity || character.job],
    ["性格", character.personality],
    ["外貌", character.appearance],
    ["目标", character.goal || character.goals],
    ["秘密", character.secret || character.secrets],
    ["当前状态", character.currentState || character.state],
    ["说话方式", character.voice || character.speech],
    ["补充", character.description || character.notes || character.bio]
  ];
  const lines = preferred
    .map(([label, value]) => [label, text(value, 900)])
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}：${value}`);

  if (!lines.length) {
    const fallback = { ...character };
    delete fallback.id;
    return `### ${name}\n${text(fallback, LIMITS.character)}`;
  }
  return `### ${name}\n${text(lines.join("\n"), LIMITS.character)}`;
}

function joinWithinBudget(header, sections) {
  let output = header.trim();
  for (const item of sections.filter(Boolean)) {
    const separator = "\n\n";
    const remaining = CREATIVE_CONTEXT_CHAR_BUDGET - output.length - separator.length;
    if (remaining <= 0) break;

    if (item.length <= remaining) {
      output += separator + item;
      continue;
    }

    if (remaining >= 500) {
      output += separator + item.slice(0, Math.max(0, remaining - 20)) + "\n[上下文预算已用尽]";
    }
    break;
  }
  return output;
}

export function buildCreativeContextMessage(context) {
  if (!context || typeof context !== "object") return "";

  const project = context.project && typeof context.project === "object" ? context.project : {};
  const chapter = context.chapter && typeof context.chapter === "object" ? context.chapter : {};
  const characters = Array.isArray(context.characters) ? context.characters.slice(0, 8) : [];

  const identity = section("作品", [
    project.name ? `名称：${text(project.name, 160)}` : "",
    project.description ? `定位：${text(project.description, 1200)}` : ""
  ].filter(Boolean).join("\n"), 1600);

  const currentChapter = section("当前章节", [
    chapter.title || chapter.name ? `标题：${text(chapter.title || chapter.name, 180)}` : "",
    chapter.summary ? `摘要：${text(chapter.summary, 2600)}` : "",
    chapter.notes ? `写作备注：${text(chapter.notes, 1800)}` : "",
    chapter.targetWords ? `目标字数：${chapter.targetWords}` : ""
  ].filter(Boolean).join("\n"), LIMITS.chapter);

  const characterSection = characters.length
    ? `## 相关人物\n${characters.map(characterText).filter(Boolean).join("\n\n")}`
    : "";

  const sections = [
    identity,
    currentChapter,
    section("上一章摘要", context.previousChapterSummary, LIMITS.previousChapter),
    characterSection,
    section("人物关系", project.relations, LIMITS.relations),
    section("世界观与规则", project.world, LIMITS.world),
    section("时间线", project.timeline, LIMITS.timeline),
    section("伏笔", project.foreshadow, LIMITS.foreshadow),
    section("作品简介", project.synopsis, LIMITS.synopsis),
    section("总纲", project.outline, LIMITS.outline),
    section("创作备注", project.notes, LIMITS.notes)
  ];

  const usefulSections = sections.filter(Boolean);
  if (!usefulSections.length) return "";

  const header = [
    "# 当前小说创作上下文",
    "以下资料用于保持人物、剧情与世界观连续性。除非用户明确要求修改既有设定，否则优先保持这些事实一致；不要在正文中机械复述这些资料。"
  ].join("\n\n");

  return joinWithinBudget(header, usefulSections);
}
