# Unlimited AI — 小说创作工作台

一个部署在 Cloudflare Workers 上的本地优先 AI 小说创作工作台。前端负责会话、作品、章节、人物、世界观、阅读、长期记忆与连续性资料管理；Worker 负责模型配置、Prompt、上下文组装、AI 辅助提取和 NVIDIA API 调用。

## 当前结构

- `src/models.js`：唯一模型注册表、默认模型、请求参数与自动 fallback 顺序
- `src/prompts.js`：与模型 ID 解耦的内置创作 Prompt
- `src/context.js`：把作品、章节、人物、长期记忆与连续性状态整理成 AI 创作上下文
- `src/memory-extractor.js`：从最近剧情中提取待确认的长期 Story Memory 候选
- `src/continuity-review.js`：生成待确认的章节摘要和人物当前状态
- `src/worker.js`：Cloudflare Worker、模型路由、自动 fallback、SSE 流式转发和辅助分析接口
- `public/app.js`：聊天、多会话、阅读模式与基础前端逻辑
- `public/studio.js`：作品、章节、人物、场景、资料、统计、备份等本地创作工作区
- `public/data-migration.js`：为旧会话补充永久 message ID，并兼容旧正文片段引用
- `public/context-bridge.js`：把本地创作资料自动注入 `/api/chat`，并提供“上下文”检查器
- `public/continuity-bridge.js`：管理已确认的章节摘要和人物当前状态，并自动注入聊天
- `public/memory-bridge.js`：本地 Story Memory 库、相关性检索和自动注入
- `public/memory-suggest.js`：AI 提取长期记忆候选，并由用户勾选后保存

## 模型配置

只在 `src/models.js` 中维护模型。

每个模型可配置：

- `id`
- `label`
- `promptProfile`
- `provider`
- `requestTimeoutMs`
- `request` 请求参数

Worker 会通过 `/config.js` 自动把可用模型同步给网页，不需要在前端重复维护模型列表。

## Prompt

内置 Prompt 位于 `src/prompts.js`，按任务型 profile 管理，而不是按具体模型名称绑定。

- 😈：使用 Worker 内置创作 Prompt
- 😇：使用网页设置中的自定义 system prompt

## 创作上下文

网页右上角的“上下文”按钮用于查看和控制基础创作资料。默认会根据当前作品和章节自动整理：

- 作品简介与总纲
- 当前章节与上一章摘要
- 与当前请求相关的人物
- 人物关系
- 世界观
- 时间线
- 伏笔
- 创作备注

服务端会再次做长度限制，并优先保留当前章节、人物、长期记忆与连续性信息，避免上下文无限膨胀。

## Story Memory

网页右上角“记忆”用于保存跨章节仍值得保留的重要事实。记忆按作品隔离，支持：

- 事件、人物变化、关系变化、伏笔、秘密、物品、地点、规则、冲突等类型
- 1–5 级重要度
- 相关人物、标签和章节绑定
- 有效 / 已解决状态
- 搜索、编辑、删除和恢复

发送聊天请求时，网页会根据当前章节和本轮内容，对记忆做简单相关性评分，只注入最相关的若干条，而不是把整个记忆库全部发送。

“AI 提取候选”会把当前可见对话和章节资料交给 Worker，返回最多 8 条值得长期保存的候选。候选不会自动写入，只有用户勾选并确认后才保存。

## 连续性层

网页右上角“连续性”维护两类高频状态：

1. 当前章节的 AI 维护摘要
2. 人物当前状态

“AI 分析当前剧情”会根据当前章节、人物资料和最近对话生成建议。建议同样需要用户勾选确认后才保存。

已确认的章节摘要优先于旧摘要进入 AI 上下文；已确认的人物状态会与人物卡合并，用于后续续写。连续性数据独立保存，不直接覆盖原始人物卡和大纲，因此可以随时清除或重新生成。

## 数据兼容

`public/data-migration.js` 会在应用启动前执行：

- 为旧会话中没有 ID 的消息生成稳定的永久 `messageId`
- 为旧 `manuscriptClips` 补充 `messageId`
- 暂时保留 `messageIndex` 以兼容现有阅读/正文逻辑

因此旧浏览器数据不需要手动重建。

## 模型自动切换

当选中的 NVIDIA 模型出现可重试错误、限流、不可用或请求超时时，Worker 会按 `MODEL_FALLBACK_ORDER` 尝试其他可用模型。网页会在回复状态栏显示“选择模型 → 实际模型”，并在自动切换时保留原因提示。

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

## 数据说明

- 会话、作品、人物、章节、Story Memory 和连续性数据目前都保存在当前浏览器本地
- 工作台支持作品备份与恢复；Story Memory / 连续性数据目前是独立本地存储层
- 下一阶段计划重点是独立章节正文编辑、AI 回复版本管理，以及把长篇正文和大量历史数据逐步迁移到 IndexedDB
