# Unlimited AI — 小说创作 + AI 陪伴

一个部署在 Cloudflare Workers 上的本地优先 AI 工作台。打开网页后先进入模式大厅，可选择 **AI 小说创作** 或 **AI 陪伴**。两个模式共用 Worker 和模型基础设施，但 Prompt、上下文、会话和长期记忆彼此隔离。

当前陪伴前端版本：**V9.5**。

> 陪伴模式的详细模块边界与退役文件清单见：`docs/COMPANION_V9_ARCHITECTURE.md`。

---

## 1. 两种模式

### AI 小说创作

保留长篇创作工作台，主要包括：

- 作品与章节管理
- 人物、世界观、场景和资料
- 大纲与正文
- AI 续写、润色、改写
- Story Memory
- 连续性检查
- 阅读模式
- 本地备份与恢复

小说模式继续使用原有 `cfw_*`、Story Memory 和连续性数据结构，旧浏览器数据不需要因为陪伴模式升级而迁移。

### AI 陪伴

V9.5 当前支持：

- 第一次进入时创建 AI 伙伴或使用默认“小雨”
- 最多 6 个角色
- 每个角色独立保存资料、聊天、长期记忆和模型设置
- 角色新增、编辑、切换、删除
- 单个“完整角色设定”大文本框，可直接粘贴人物卡，最多 5000 字
- 独立多会话聊天
- SSE 流式回复与停止生成
- 用户消息编辑重发、最后一条 AI 回复重新生成
- 约 500 / 1000 / 5000 字三档回复长度
- 当前角色聊天全文搜索和消息定位
- 任意消息加入“重要时刻”
- 长期记忆手动管理、去重、置顶、归档、恢复
- 关系时间线、重要时刻纪念册、本月回顾
- 可读 Markdown 导出
- 全部角色 JSON 备份、导入校验、合并/覆盖恢复和一次回滚快照
- 生成期间禁止切换角色或执行可能导致异步串写的危险操作
- 桌面端和移动端响应式布局

V9.5 的 UI 原则是：**主聊天页只保留高频操作，低频功能进入角色管理、记忆、设置或关系记录。**

---

## 2. 陪伴模式当前结构

### 启动与模式路由

- `public/boot-diagnostics.js`：双模式启动、资源加载和前端自检
- `public/mode-router.js`：小说 / 陪伴模式大厅与切换
- `public/mode-router.css`：模式大厅样式

### 基础聊天核心

- `public/companion-mode.js`
  - 基础陪伴 DOM 壳
  - 当前角色兼容槽位
  - 会话列表与消息渲染
  - 输入、SSE 流式回复、停止生成
  - 基础长期记忆和设置数据源
- `public/companion-mode.css`：基础结构和通用组件

### 多角色与角色编辑

- `public/companion-characters-core.js`
  - 多角色持久化
  - 当前角色快照保存 / 目标角色装载
  - 角色聊天、记忆和设置隔离
- `public/companion-character-editor.js`
  - 只负责新增角色、编辑角色和首次创建角色
  - 完整角色设定统一使用单个大文本框
- `public/companion-characters.css`：角色管理/编辑弹窗基础样式

### 设置与运行时

- `public/companion-settings.js`
  - 回复长度三档
  - 设置弹窗整理
  - 数据与备份低频区域
- `public/companion-runtime.js`
  - 回复长度请求约束
  - 生成期间危险操作保护
  - 全部角色备份与辅助数据清理

### 搜索、记忆与关系记录

- `public/companion-memory.js`
  - 聊天搜索
  - 重要时刻管理
  - 长期记忆整理、去重、归档与恢复
- `public/companion-records.js`
  - 关系记录、时间线、纪念册
  - 备份导入校验和回滚
- `public/companion-extras.js`
  - 消息复制 / 珍藏
  - 长回复展开/收起
  - 回到底部
  - 本月回顾与可读 Markdown 导出
- `public/companion-memory.css`：搜索与记忆组件
- `public/companion-records.css`：关系记录与恢复组件

### V9 页面收口

- `public/companion-v9-shell.js`
  - 角色卡新增/编辑/管理入口
  - 左侧可见聊天搜索入口
  - 角色管理弹窗整理
  - 记忆弹窗高频/低频入口整理
  - 消息操作去重
- `public/companion-v9.css`
  - 当前主聊天页最终视觉层
  - 桌面端 1120px 对话内容宽度
  - AI 正文 16.5px
  - 输入区、角色管理和移动端响应式
- `public/companion-support.css`
  - 角色大文本框
  - 回复长度卡片
  - 数据折叠区
  - 消息操作
  - 长回复
  - 回到底部
  - Toast
  - 本月回顾

旧的 V2/V3/V4/V5/V6 companion 增量脚本、`companion-characters-ui.js` 和 `companion-profile-editor.css` 已退出当前运行时，不应恢复成“旧文件 + 新覆盖层”的开发方式。

---

## 3. 陪伴 Prompt 边界

陪伴模式应用层最高优先级角色卡位于：

```text
src/companion.js -> COMPANION_ROLE_CARD
```

实际陪伴请求的应用消息层级是：

1. `system`：`COMPANION_ROLE_CARD`
2. `user`：当前角色、关系、长期记忆、最近话题、时间、回复长度等动态参考资料
3. 用户/助手聊天历史

也就是说，页面里填写的角色设定和长期记忆不会与角色卡处在同一个 `system` 层级。

小说模式提示词继续由：

```text
src/worker.js -> NOVEL_SYSTEM_PROMPT
```

维护。陪伴 V9 前端重构不会修改小说系统提示词。

---

## 4. `/api/chat` 模式路由

仍然使用同一个：

```text
POST /api/chat
```

通过 `mode` 区分产品路径。

### 小说模式

```json
{
  "mode": "novel",
  "creative_context": {},
  "memory_context": {},
  "continuity_context": {},
  "messages": []
}
```

为了兼容旧前端，缺省 `mode` 仍按小说模式处理。

### 陪伴模式

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

陪伴路径不会注入小说的 `creative_context`、`memory_context` 或 `continuity_context`。

---

## 5. 陪伴数据隔离

陪伴模式使用独立 `uai_companion_*` localStorage 命名空间。

核心兼容槽位：

```text
uai_companion_profile_v1
uai_companion_sessions_v1
uai_companion_memories_v1
uai_companion_settings_v1
```

多角色：

```text
uai_companion_characters_v1
uai_companion_active_character_v1
```

辅助数据：

```text
uai_companion_moments_v1
uai_companion_memory_archive_v1
uai_companion_import_rollback_v1
```

当前角色会装载到兼容槽位中；切换角色前先保存当前角色快照，再装载目标角色，因此角色之间不共享聊天和长期记忆。

陪伴模式不会读取或写入小说会话、人物、Story Memory 或连续性数据。

---

## 6. 模型配置

模型注册统一位于：

```text
src/models.js
```

每个模型可维护：

- `id`
- `label`
- `promptProfile`
- `provider`
- `requestTimeoutMs`
- `request` 参数

Worker 会通过 `/config.js` 把可用模型同步到前端。小说模式和陪伴模式可以分别保存模型选择；多角色下每个角色也会保存自己的陪伴设置快照。

---

## 7. 小说上下文链路

小说模式会整理并注入：

- 作品简介与总纲
- 当前章节与上一章摘要
- 相关人物和人物关系
- 世界观与时间线
- 伏笔与创作备注
- 已确认 Story Memory
- 连续性层中的章节摘要和人物当前状态

主要模块：

- `src/context.js`
- `src/memory-extractor.js`
- `src/continuity-review.js`
- `public/context-bridge.js`
- `public/memory-bridge.js`
- `public/continuity-bridge.js`

---

## 8. 回归测试

GitHub Actions 工作流：

```text
.github/workflows/js-syntax-check.yml
```

当前检查包括：

- 浏览器脚本语法
- Worker 模块语法
- 小说 Story Context 质量契约
- 小说用户主流程契约
- 陪伴 / 小说模式隔离
- 陪伴角色编辑器
- 关系记录与备份恢复
- 陪伴运行时兼容性
- V9 UX / 模块结构

V9.5 在删除旧角色 UI 大模块和旧 V8 覆盖样式后，完整 CI 已通过。

---

## 9. Cloudflare Workers 部署

`wrangler.toml` 当前入口：

```toml
name = "unlimited-ai"
main = "src/worker.js"
compatibility_date = "2026-03-11"

[assets]
directory = "./public"
binding = "ASSETS"
run_worker_first = true
```

首次手动部署：

```bash
npm i -g wrangler
wrangler login
wrangler secret put NVIDIA_API_KEY
wrangler deploy
```

如果 Cloudflare 已连接 GitHub 自动部署，则向 `main` 推送提交会按 Cloudflare 侧配置触发构建。仓库本身的 GitHub Deployments API 不一定会显示 Cloudflare 的实际生产部署状态，因此 **GitHub CI 通过不等于已经确认生产环境上线**。

当前部署标记见：

```text
DEPLOY_REVISION.txt
```

---

## 10. 后续开发规则

继续开发陪伴模式时：

- 高频入口留在主聊天页；低频入口进入角色管理、记忆、设置或关系记录
- 一个模块只负责一类职责，避免再次出现“全能补丁脚本”
- 不增加重复头像、重复按钮和重复设置入口
- 角色数据必须按角色隔离
- 生成过程中不得切换角色或执行可能导致异步串写的操作
- 新功能同步补回归测试
- 不修改陪伴角色卡或小说系统提示词，除非任务明确要求修改 Prompt

更详细的 V9.5 陪伴架构说明：

```text
docs/COMPANION_V9_ARCHITECTURE.md
```
