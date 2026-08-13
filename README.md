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

新增独立陪伴工作区：

- 第一次进入时创建 AI 伙伴或使用默认“小雨”
- 关系、性格、用户称呼和自定义角色描述
- 可选本地头像
- 独立多会话聊天
- SSE 流式回复与停止生成
- 独立模型和默认回复长度
- 用户可控长期记忆
- 高置信度本地记忆提取
- 记忆查看、增加、修改、删除和清空
- 认识天数、会话数和累计消息等关系状态
- 陪伴数据导出、当前聊天清空和整体重置
- 移动端侧栏与输入布局

陪伴模式只使用以下 localStorage namespace：

- `uai_companion_profile_v1`
- `uai_companion_sessions_v1`
- `uai_companion_memories_v1`
- `uai_companion_settings_v1`

它不会读取或写入小说模式的会话、人物、Story Memory 或连续性数据。

## 当前结构

### 双模式入口与陪伴前端

- `public/boot-diagnostics.js`：启动保护、双模式资源加载和前端自检
- `public/mode-router.js`：每次打开时显示模式大厅，并在小说 / 陪伴之间切换
- `public/mode-router.css`：模式大厅视觉样式
- `public/companion-mode.js`：陪伴角色、会话、流式聊天、长期记忆和本地数据管理
- `public/companion-mode.css`：陪伴桌面端与移动端布局

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
- `src/companion.js`：陪伴模式专用角色、关系与长期记忆 Prompt；不导入小说上下文模块
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

Worker 会通过 `/config.js` 自动把可用模型同步给网页。小说模式和陪伴模式可以分别保存自己的模型选择。

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

陪伴模式拥有单独的长期记忆列表。第一版会对“我叫……”“我喜欢……”“我不喜欢……”“我的生日是……”等高置信度信息进行本地提取，同时允许用户手动增加、编辑和删除。

用户可以关闭长期记忆；关闭后既不会继续自动提取，也不会把已有陪伴记忆发送给模型，但本地记忆不会被自动删除。

## 数据兼容与隐私

- 小说会话、作品、人物、章节、Story Memory 和连续性仍保存在当前浏览器
- 陪伴角色、聊天、长期记忆与设置同样保存在当前浏览器
- 两种模式使用不同 storage namespace
- 角色头像仅保存于本地浏览器
- 小说模式保留原有备份 / 恢复能力
- 陪伴模式可以单独导出 JSON 备份

## 验证

`.github/workflows/js-syntax-check.yml` 会在 PR 中检查：

1. 所有浏览器 JavaScript 语法
2. 所有 Worker 模块语法
3. Story Context 质量契约
4. 原小说产品流契约
5. 新增陪伴模式隔离契约

`tests/companion-mode.test.mjs` 会确认陪伴模式不引用小说存储 namespace，并确认 Worker 使用独立 Companion Prompt。

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
