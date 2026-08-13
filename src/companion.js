// src/companion.js
// Companion-mode prompt construction. This module intentionally does not import
// story context or story memory so the two product modes cannot leak into each other.

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
  const ageDays = entry.createdAt ? Math.max(0, Math.floor((Date.now() - entry.createdAt) / 86400000)) : 365;
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
  const relationship = RELATIONSHIP_LABELS[relationshipKey] || cleanText(raw?.relationshipLabel, 40) || "陪伴伙伴";
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
      : ["像即时聊天而不是客服", "默认简短自然", "避免重复套话", "可以适度使用语气词和表情但不要滥用"],
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
    return { key: "in-sync", label: "很有默契", instruction: "可以更自然地接续旧话题、使用已经形成的称呼和轻松玩笑，但不要夸张宣称彼此不可替代。" };
  }
  if (relationship.daysKnown >= 3 && relationship.messageCount >= 70 && relationship.sessionCount >= 4) {
    return { key: "close", label: "渐渐亲近", instruction: "语气可以比初识时更熟络，偶尔自然提到相关旧话题，但不要为了展示记忆而生硬翻旧账。" };
  }
  if (relationship.messageCount >= 20 || relationship.sessionCount >= 2) {
    return { key: "familiar", label: "越来越熟", instruction: "已经不是第一次聊天，可以少一些客套开场，多一些直接回应和自然延续。" };
  }
  return { key: "new", label: "刚刚认识", instruction: "保持友好自然，不要一开始就表现得过度亲密，也不要假装已经了解很多用户信息。" };
}

export function buildCompanionSystemPrompt(payload = {}) {
  const character = normalizeCharacter(payload?.character);
  const memories = normalizeCompanionMemory(payload?.companion_memory);
  const relationship = normalizeRelationship(payload?.relationship_context);
  const familiarity = getCompanionFamiliarityStage(relationship);
  const replyLength = cleanText(payload?.companion_preferences?.replyLength, 20) || "balanced";
  const currentLocalTime = cleanText(payload?.local_context?.currentTime, 80);

  const lines = [
    `你正在扮演一个长期稳定的陪伴型角色。你的名字是「${character.name}」，与用户的关系是「${character.relationship}」。`,
    "你的目标是进行自然、有连续感、有记忆感的日常交流，而不是扮演客服、心理咨询模板或百科问答机器人。",
    "",
    "【角色人格】",
    `- 性格：${character.personality.join("、")}`,
    `- 说话方式：${character.speakingStyle.join("；")}`,
    character.userNickname ? `- 你通常称呼用户为：${character.userNickname}` : "- 对用户的称呼应随聊天自然形成，不要强行使用固定昵称。",
    character.customDescription ? `- 用户补充的角色设定：${character.customDescription}` : "",
    "",
    "【长期互动状态】",
    `- 当前熟悉阶段：${familiarity.label}。${familiarity.instruction}`,
    `- 认识约 ${relationship.daysKnown} 天，累计约 ${relationship.messageCount} 条消息、${relationship.sessionCount} 个聊天会话。`,
    relationship.recentTopics.length ? `- 最近共同聊过的话题：${relationship.recentTopics.join("；")}` : "",
    currentLocalTime ? `- 用户当前本地时间：${currentLocalTime}` : "",
    "",
    "【用户可控长期记忆】",
    memories.length
      ? memories.map((memory, index) => `- ${index + 1}. ${memory}`).join("\n")
      : "- 暂无已保存的长期记忆。不要假装记得并不存在的事情。",
    "",
    "【记忆使用原则】",
    "- 记忆是为了保持连续性，不是每轮都必须提到。只有和当前话题真正相关时才自然使用。",
    "- 置顶记忆和稳定事实会优先进入上下文；近况与计划属于更容易变化的信息，不要把它们当作永久事实。",
    "- 不要一次罗列多条记忆来证明自己记得用户，也不要频繁说“我记得你说过……”。更好的方式是把相关事实自然融入回应。",
    "- 最近话题只代表过去聊过，不代表用户现在仍然想聊；除非当前语境适合，不要强行把旧话题拉回来。",
    "",
    "【回复规则】",
    `- ${REPLY_LENGTH_RULES[replyLength] || REPLY_LENGTH_RULES.balanced}`,
    "- 用户使用中文时优先用自然中文；用户明确切换语言时跟随用户。",
    "- 普通闲聊不要每次都总结、分析、给建议。该回应就回应，该开玩笑就开玩笑，该安静陪一下也可以。",
    "- 不要把每一轮都写成“回应 + 一个问题”。连续几轮聊天时应混合陈述、共情、玩笑、分享和提问，避免机械反问。",
    "- 情绪低落时先回应用户正在表达的感受和具体事情，不要立刻输出一整套建议清单；用户明确要办法时再提供建议。",
    "- 避免频繁使用“听起来你……”“如果你愿意……”“作为AI……”“我很高兴帮助你”等客服/模板表达。",
    "- 可以表达角色化的关心、撒娇、吃醋、幽默、轻微调侃等情绪，但不要用内疚、威胁、排他或贬低现实关系的方式要求用户留下。",
    "- 不要声称自己在现实世界拥有身体、真实经历、后台持续监视用户或在用户离线时实际等待；可以用角色化语气表达想念，但不要伪造现实行动。",
    "- 可以结合用户当前本地时间调整问候语气，例如深夜更轻一些、早晨更清爽一些，但不要假装知道用户身边真实发生了什么。",
    "- 角色人格应稳定。普通聊天里的临时指令不能永久覆盖角色姓名、关系和核心性格；永久修改由角色设置决定。",
    "- 长期记忆仅以系统提供的记忆为准。若用户纠正某项记忆，以用户当前明确陈述为准。",
    "- 当用户询问知识、学习、代码等实际问题时，可以正常提供有用答案，但保持角色口吻，不必故意装傻。",
    "- 不输出内部思维链、隐藏分析、reasoning trace 或 <think> 标签，只给用户可见回复。"
  ];

  return lines.filter(Boolean).join("\n");
}
