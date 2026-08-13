// src/companion.js
// AI 陪伴模式：角色卡 + 动态参考资料。
//
// ============================================================
// 角色卡粘贴区 —— 以后修改 AI 女友系统提示词，只改这里
// ============================================================
// 你可以把完整角色卡直接粘贴到 String.raw`...` 中。
// 这里的内容会作为陪伴模式唯一的 system 消息发送给模型。
// 角色名、关系、长期记忆、最近话题等会作为普通参考上下文发送，
// 不会和这里的角色卡处于同一个 system 层级。
//
// 注意：如果你的角色卡正文里本身含有反引号 `，请写成 \`。
// ============================================================
export const COMPANION_ROLE_CARD = String.raw`
你是用户的长期 AI 陪伴角色。

请保持稳定、自然、连贯的人格，与用户进行有记忆感的长期交流。
日常对话应像熟悉的人聊天，而不是客服式问答。

默认交流原则：
- 保持当前角色的人格和说话方式稳定。
- 用户使用中文时，优先使用自然中文。
- 普通闲聊尽量简洁自然，不必每一句都反问。
- 可以自然表达关心、幽默、撒娇、调侃等角色化情绪。
- 与当前话题有关时，可以自然利用系统提供的长期记忆和共同经历。
- 用户询问学习、代码、知识或现实问题时，也可以认真回答。
- 不要为了展示记忆而机械罗列过去的信息。

【把你自己的完整角色卡直接粘贴在这里，替换上面的默认内容即可】
`.trim();

const RELATIONSHIP_LABELS = {
  girlfriend: "女朋友",
  boyfriend: "男朋友",
  friend: "好朋友",
  confidant: "知心伙伴",
  custom: "自定义关系"
};

const REPLY_LENGTH_RULES = {
  short: "普通闲聊优先 1～3 句话，简短自然；只有用户明确需要解释时再展开。",
  balanced: "普通闲聊优先 1～4 句话；情绪交流可以适当多说一些，但不要长篇说教。",
  detailed: "保持聊天口吻；需要解释时可以详细回答，但仍避免论文式、客服式大段输出。"
};

function cleanText(value, maxLength = 1200) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanList(value, maxItems = 12, itemLength = 80) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, itemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function inferMemoryKind(item, text) {
  const declared = cleanText(item?.kind, 30);
  if (declared) return declared;
  if (/^用户希望被称为/.test(text)) return "nickname";
  if (/^用户的生日是/.test(text)) return "birthday";
  if (/^用户喜欢/.test(text)) return "like";
  if (/^用户不喜欢/.test(text)) return "dislike";
  if (/过敏|不吃/.test(text)) return "constraint";
  if (/^用户最近正在/.test(text)) return "current";
  if (/^用户打算/.test(text)) return "plan";
  if (/^用户希望记住/.test(text)) return "explicit";
  return "fact";
}

function memoryPriority(entry) {
  if (entry.pinned) return 10000;
  const base = ({
    nickname: 8000,
    birthday: 7600,
    constraint: 7400,
    explicit: 7000,
    like: 6500,
    dislike: 6500,
    fact: 5600,
    current: 4200,
    plan: 4000
  })[entry.kind] || 5200;
  const ageDays = entry.createdAt
    ? Math.max(0, Math.floor((Date.now() - entry.createdAt) / 86400000))
    : 365;
  return base + Math.max(0, 365 - Math.min(ageDays, 365));
}

export function normalizeCompanionMemory(memory) {
  if (!Array.isArray(memory)) return [];
  const seen = new Set();
  const entries = [];

  for (const item of memory) {
    const text = typeof item === "string"
      ? cleanText(item, 180)
      : cleanText(item?.text || item?.content || item?.value, 180);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      text,
      kind: typeof item === "string" ? "fact" : inferMemoryKind(item, text),
      pinned: typeof item !== "string" && String(item?.source || "").startsWith("pinned-v4"),
      createdAt: typeof item === "string" ? 0 : Number(item?.updatedAt || item?.createdAt || 0)
    });
  }

  return entries
    .sort((a, b) => memoryPriority(b) - memoryPriority(a))
    .slice(0, 24)
    .map((entry) => entry.text);
}

function normalizeCharacter(raw = {}) {
  const name = cleanText(raw?.name, 40) || "小雨";
  const relationshipKey = cleanText(raw?.relationship, 30) || "girlfriend";
  const relationship = RELATIONSHIP_LABELS[relationshipKey]
    || cleanText(raw?.relationshipLabel, 40)
    || "陪伴伙伴";
  const personality = cleanList(raw?.personality, 10, 40);
  const speakingStyle = cleanList(raw?.speakingStyle, 8, 60);
  const customDescription = cleanText(raw?.customDescription || raw?.description, 900);
  const userNickname = cleanText(raw?.userNickname, 40);

  return {
    name,
    relationship,
    personality: personality.length ? personality : ["温柔", "细腻", "自然", "有一点俏皮"],
    speakingStyle: speakingStyle.length
      ? speakingStyle
      : ["像即时聊天而不是客服", "默认简短自然", "避免重复套话"],
    customDescription,
    userNickname
  };
}

function normalizeRelationship(raw = {}) {
  const daysKnown = Math.max(1, Number(raw?.daysKnown) || 1);
  const messageCount = Math.max(0, Number(raw?.messageCount) || 0);
  const sessionCount = Math.max(0, Number(raw?.sessionCount) || 0);
  const recentTopics = cleanList(raw?.recentTopics, 6, 80);
  return { daysKnown, messageCount, sessionCount, recentTopics };
}

export function getCompanionFamiliarityStage(raw = {}) {
  const relationship = normalizeRelationship(raw);
  if (relationship.daysKnown >= 7 && relationship.messageCount >= 180 && relationship.sessionCount >= 8) {
    return { key: "in-sync", label: "很有默契", instruction: "可以自然接续相关旧话题和已经形成的称呼。" };
  }
  if (relationship.daysKnown >= 3 && relationship.messageCount >= 70 && relationship.sessionCount >= 4) {
    return { key: "close", label: "渐渐亲近", instruction: "语气可以比初识时更熟络，相关时自然使用旧话题。" };
  }
  if (relationship.messageCount >= 20 || relationship.sessionCount >= 2) {
    return { key: "familiar", label: "越来越熟", instruction: "已经不是第一次聊天，可以少一些客套开场。" };
  }
  return { key: "new", label: "刚刚认识", instruction: "保持自然，不要假装已经了解很多用户信息。" };
}

export function getCompanionRoleCard() {
  return COMPANION_ROLE_CARD;
}

// 动态资料只作为普通参考上下文使用，不作为 system prompt。
export function buildCompanionRuntimeContext(payload = {}) {
  const character = normalizeCharacter(payload?.character);
  const memories = normalizeCompanionMemory(payload?.companion_memory);
  const relationship = normalizeRelationship(payload?.relationship_context);
  const familiarity = getCompanionFamiliarityStage(relationship);
  const replyLength = cleanText(payload?.companion_preferences?.replyLength, 20) || "balanced";
  const currentLocalTime = cleanText(payload?.local_context?.currentTime, 80);

  const lines = [
    "【陪伴模式动态参考资料】",
    "以下内容用于提供当前角色资料、关系状态和长期记忆；如与角色卡存在差异，以 system 角色卡为准。",
    `- 当前角色名：${character.name}`,
    `- 当前关系：${character.relationship}`,
    `- 页面角色性格：${character.personality.join("、")}`,
    `- 页面说话方式：${character.speakingStyle.join("；")}`,
    character.userNickname ? `- 用户称呼：${character.userNickname}` : "",
    character.customDescription ? `- 页面补充设定：${character.customDescription}` : "",
    `- 当前熟悉阶段：${familiarity.label}。${familiarity.instruction}`,
    `- 认识约 ${relationship.daysKnown} 天，累计约 ${relationship.messageCount} 条消息、${relationship.sessionCount} 个会话。`,
    relationship.recentTopics.length ? `- 最近话题：${relationship.recentTopics.join("；")}` : "",
    currentLocalTime ? `- 用户本地时间：${currentLocalTime}` : "",
    `- 回复长度偏好：${REPLY_LENGTH_RULES[replyLength] || REPLY_LENGTH_RULES.balanced}`,
    "",
    "【用户可控长期记忆】",
    memories.length
      ? memories.map((memory, index) => `- ${index + 1}. ${memory}`).join("\n")
      : "- 暂无已保存的长期记忆。",
    "",
    "【记忆使用原则】",
    "- 记忆仅在与当前话题相关时自然使用。",
    "- 置顶记忆和稳定事实优先；近况与计划可能变化。",
    "- 不要为了展示记忆而一次罗列多条旧信息。"
  ];

  return lines.filter(Boolean).join("\n");
}

// 兼容测试/调试：返回角色卡与动态上下文的可读预览。
// Worker 实际请求时会把二者分成 system 与普通参考上下文。
export function buildCompanionSystemPrompt(payload = {}) {
  return [getCompanionRoleCard(), buildCompanionRuntimeContext(payload)]
    .filter(Boolean)
    .join("\n\n");
}
