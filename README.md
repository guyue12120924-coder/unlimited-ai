# Unlimited AI — 小说创作工作台

一个部署在 Cloudflare Workers 上的本地优先 AI 小说创作工作台。前端负责会话、作品、章节、人物、世界观、阅读与创作资料管理；Worker 负责模型配置、Prompt、创作上下文组装和 NVIDIA API 流式调用。

## 当前结构

- `src/models.js`：唯一模型注册表、默认模型、请求参数与自动 fallback 顺序
- `src/prompts.js`：与模型 ID 解耦的内置创作 Prompt
- `src/context.js`：把作品、章节、人物、关系、世界观、时间线和伏笔整理成 AI 创作上下文
- `src/worker.js`：Cloudflare Worker、模型路由、自动 fallback、SSE 流式转发
- `public/app.js`：聊天、多会话、阅读模式与基础前端逻辑
- `public/studio.js`：作品、章节、人物、场景、资料、统计、备份等本地创作工作区
- `public/context-bridge.js`：把本地创作工作区资料自动注入 `/api/chat`，并提供“上下文”检查器

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

网页右上角的“上下文”按钮用于查看和控制自动注入内容。默认会根据当前作品和章节自动整理：

- 作品简介与总纲
- 当前章节与上一章摘要
- 与当前请求相关的人物
- 人物关系
- 世界观
- 时间线
- 伏笔
- 创作备注

服务端会再次做长度限制，并优先保留当前章节、人物和连续性信息，避免创作资料无限膨胀。

所有作品资料与会话仍以 localStorage 为主，仅保存在当前浏览器。

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

- 会话、作品、人物、章节、世界观等内容目前主要保存在浏览器 `localStorage`
- 工作台支持导出备份与恢复
- 后续计划将长篇正文与大量历史数据迁移到 IndexedDB，并继续增加长期 Story Memory、章节摘要、人物状态和一致性检查
