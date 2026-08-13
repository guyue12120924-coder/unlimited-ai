# Unlimited AI — 小说创作 + AI 陪伴

一个部署在 Cloudflare Workers 上的本地优先 AI 工作台。打开网页后先进入模式大厅，可选择 **AI 小说创作** 或 **AI 陪伴**。两个模式共用模型与 Worker 基础设施，但 Prompt、上下文、会话和长期记忆彼此隔离。

## 两种模式

### AI 小说创作

保留原有长篇创作工作台：

- 作品与章节
- 人物与世界观
- 大纲与正文
- AI 续写、润色和改写
- Story Memory
- 连续性检查
- 阅读模式
- 本地备份与恢复

旧浏览器中的小说数据不需要迁移，原有 `cfw_*` 和 Story Memory 等存储键继续使用。

### AI 陪伴

独立陪伴工作区当前支持：

- 第一次进入时创建 AI 伙伴或使用默认“小雨”
- 最多 6 个 AI 伙伴
- 每个伙伴独立保存角色资料、聊天、长期记忆和模型设置
- 角色创建、切换和删除
- 关系、性格、用户称呼和自定义角色描述
- 可选本地头像
- 独立多会话聊天
- SSE 流式回复与停止生成
- 用户消息“编辑重发”和最后一条 AI 回复“重新生成”
- 时间感和最近话题驱动的新聊天开场
- 当前角色聊天全文搜索与消息定位，支持 `Ctrl/Cmd + K`
- 任意消息可加入当前角色的“重要时刻”
- 用户可控长期记忆
- 本地结构化记忆提取：称呼、生日、最近活动、计划、偏好、饮食限制、过敏和明确“记住”请求
- 记忆整理：类型识别、置顶、精确去重、过期候选、归档和恢复
- 近况与计划不会被静默删除，超过时间阈值后只进入“待整理”候选
- Worker 在长期记忆上限前优先选择置顶记忆、称呼、生日、约束和其他稳定事实
- 认识天数、会话数、累计消息和关系阶段
- 多角色页总览伙伴数、会话数、消息数和记忆数
- 单角色数据导出与全部角色备份
- 全部角色备份包含 V4 重要时刻和归档记忆
- 当前聊天清空和整体重置
- 移动端侧栏与输入布局

陪伴模式只使用 `uai_companion_*` localStorage namespace。核心兼容槽位包括：

- `uai_companion_profile_v1`
- `uai_companion_sessions_v1`
- `uai_companion_memories_v1`
- `uai_companion_settings_v1`

多角色层新增：

- `uai_companion_characters_v1`
- `uai_companion_active_character_v1`

V4 辅助数据：

- `uai_companion_moments_v1`：按角色保存重要时刻
- `uai_companion_memory_archive_v1`：按角色保存可恢复的归档记忆

当前角色的数据会装载到原有兼容槽位，成熟的单角色聊天客户端继续只读取这些活动槽位；切换角色时，V3 层先完整保存当前角色，再装载目标角色，因此不同角色不会共享聊天或记忆。V4 的重要时刻和归档记忆则直接按角色 ID 分桶保存。

它不会读取或写入小说模式的会话、人物、Story Memory 或连续性数据。

## 当前结构

### 双模式入口与陪伴前端

- `public/boot-diagnostics.js`：启动保护、双模式资源加载和前端自检
- `public/mode-router.js`：每次打开时显示模式大厅，并在小说 / 陪伴之间切换
- `public/mode-router.css`：模式大厅视觉样式
- `public/companion-mode.js`：稳定的陪伴角色、会话、流式聊天、长期记忆和本地数据管理核心
- `public/companion-mode.css`：陪伴桌面端与移动端基础布局
- `public/companion-v2.js` / `.css`：关系阶段、快捷话题、回访提示、消息复制/记住和长聊天导航
- `public/companion-v3.js` / `.css`：多角色快照、角色切换、新角色创建、动态开场、编辑重发、重新生成和增强记忆提取
- `public/companion-v3-guard.js`：生成期间的角色切换保护、全部角色备份、多角色重置一致性和 V4 孤儿数据清理
- `public/companion-v4.js` / `.css`：当前角色聊天搜索、重要时刻、长期记忆整理、上下文继续提示和多角色总览增强

### 小说创作前端

- `public/app.js`：聊天、多会话、阅读模式与基础前端逻辑
- `public/studio.js`：作品、章节、人物、场景、资料、统计、备份等本地创作工作区
- `public/data-migration.js`：为旧会话补充永久 message ID，并兼容旧正文片段引用
- `public/context-bridge.js`：把本地创作资料自动注入 `/api/chat`，并提供“上下文”检查器
- `public/continuity-bridge.js`：管理已确认的章节摘要和人物当前状态，并自动注入聊天
- `public/memory-bridge.js`：本地 Story Memory 库、相关性检索和自动注入
- `public/memory-suggest.js`：AI 提取长期记忆候选，并由用户勾选后保存

### Worker

- `src/models.js`：唯一模型注册表、默认模型、请求参数与自动 fallback 顺序
- `src/prompts.js`：小说创作内置 Prompt
- `src/context.js`：小说作品、章节、人物、长期记忆与连续性上下文整理
- `src/memory-extractor.js`：小说 Story Memory 候选提取
- `src/continuity-review.js`：小说章节摘要和人物状态分析
- `src/companion.js`：陪伴模式专用角色、关系与长期记忆 Prompt；不导入小说上下文模块，并对长期记忆做稳定性/置顶优先排序
- `src/worker.js`：Cloudflare Worker、模式路由、模型 fallback、SSE 流式转发和辅助分析接口

## `/api/chat` 模式路由

仍然使用同一个 `POST /api/chat`，通过 `mode` 区分产品路径。

小说模式：

```json
{
  "mode": "novel",
  "creative_context": {},
  "memory_context": {},
  "continuity_context": {},
  "messages": []
}
```

为了兼容旧前端，缺省 `mode` 仍然按照小说模式处理。

陪伴模式：

```json
{
  "mode": "companion",
  "character": {},
  "companion_memory": [],
  "relationship_context": {},
  "companion_preferences": {},
  "messages": []
}
```

陪伴路径不会注入 `creative_context`、小说 `memory_context` 或 `continuity_context`。

## 模型配置

只在 `src/models.js` 中维护模型。每个模型可配置：

- `id`
- `label`
- `promptProfile`
- `provider`
- `requestTimeoutMs`
- `request` 请求参数

Worker 会通过 `/config.js` 自动把可用模型同步给网页。小说模式和陪伴模式可以分别保存自己的模型选择；多角色模式下每个角色也会保存自己的陪伴设置快照。

## 小说创作上下文

小说模式会根据当前作品和章节整理：

- 作品简介与总纲
- 当前章节与上一章摘要
- 相关人物及人物关系
- 世界观与时间线
- 伏笔与创作备注
- 已确认 Story Memory
- 连续性层中的章节摘要和人物当前状态

服务端再次做长度限制并优先保留当前章节、人物、长期记忆与连续性信息。

## 陪伴长期记忆

陪伴模式拥有独立长期记忆列表，并按角色隔离。基础层会对姓名、偏好、生日等高置信度信息做本地提取；V3 继续扩展称呼、最近活动、计划、饮食限制、过敏和显式记忆请求，并对称呼/生日以及相反偏好做简单替换与冲突处理。

V4 不自动删除用户记忆。称呼、生日、过敏/饮食约束、显式记忆和长期偏好属于更稳定的信息；“最近正在……”和“打算……”属于临时信息，达到阈值后会标为待整理。用户可以置顶重要记忆、精确去重、将临时记忆移入归档，之后也可以恢复。

Worker 对收到的活动记忆重新排序，在 24 条 Prompt 上限前优先保留置顶记忆和稳定事实。归档内容不在活动记忆槽中，因此不会继续注入模型。

用户仍可以手动增加、编辑、删除和“记住”某条聊天。关闭长期记忆后不会继续自动提取，也不会把已有长期记忆发送给模型，但本地记忆不会被自动删除。

## 搜索与重要时刻

V4 搜索只遍历当前角色已经加载的会话，可以从结果跳回对应会话和消息，并用短暂高亮帮助定位。`Ctrl/Cmd + K` 可直接打开搜索。

“重要时刻”按角色 ID 独立保存。任意用户或 AI 消息都可以珍藏，并可附加一条本地备注；之后可以从重要时刻列表回到原消息。删除角色后，对应的重要时刻和归档记忆会被守卫层清理。

## 数据兼容与隐私

- 小说会话、作品、人物、章节、Story Memory 和连续性仍保存在当前浏览器
- 陪伴角色、聊天、长期记忆与设置同样保存在当前浏览器
- 旧版单角色陪伴数据会自动成为第一个角色，不需要手工迁移
- 两种模式使用不同 storage namespace
- 不同 AI 伙伴之间的聊天、长期记忆、重要时刻和记忆归档彼此隔离
- 角色头像仅保存于本地浏览器
- 小说模式保留原有备份 / 恢复能力
- 陪伴模式支持当前角色 JSON 导出，以及包含所有角色、重要时刻和记忆归档的完整 JSON 备份

## 验证

`.github/workflows/js-syntax-check.yml` 会在 PR 中检查：

1. 所有浏览器 JavaScript 语法
2. 所有 Worker 模块语法
3. Story Context 质量契约
4. 原小说产品流契约
5. 陪伴模式 V1/V2/V3/V4 隔离与功能契约

`tests/companion-mode.test.mjs` 会确认陪伴模式不引用小说存储 namespace，确认多角色层和 V4 只使用独立 `uai_companion_*` 数据，并验证 Worker 的 Companion Prompt 与长期记忆优先级。

## Deploy (Cloudflare Workers)

1. 安装并登录 Wrangler

```bash
npm i -g wrangler
wrangler login
```

2. 设置 NVIDIA API Key

```bash
wrangler secret put NVIDIA_API_KEY
```

3. 部署

```bash
wrangler deploy
```

部署后可访问 `/api/diagnostics` 检查 Worker 与双模式静态资源是否是同一版本。