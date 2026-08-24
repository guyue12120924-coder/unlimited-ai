# Unlimited AI — 小说创作 + AI 陪伴

Unlimited AI 是一个部署在 Cloudflare Workers 上的本地优先 AI 工作台。首页进入模式大厅后，可选择 **AI 小说创作** 或 **AI 陪伴**。两个模式共用 Worker 与模型基础设施，但 Prompt、上下文、会话和长期记忆保持隔离。

当前版本：

- 陪伴前端：**V17.21 Voice Experience Polish**
- 启动与诊断：**V17.22 Final Cleanup & Diagnostics**
- 小说工作区：**V17.25 Writing Workspace Redesign**

> 小说模式的长期原则：**正文是主角，功能不删除，低频功能收起，AI 是写作助手而不是页面主体。**
>
> 所有小说增强继续限定在 `body[data-uai-mode="novel"]`，不得影响 AI 陪伴、Live2D、语音、通话或 `uai_companion_*` 数据。

---

## 1. 两种模式

### AI 小说创作

保留的主要能力：

- 作品与章节管理
- 当前章节正文直接编辑与自动保存
- AI 续写、润色、改写、对话与剧情检查
- AI 回复整段 / 选中文字加入正文
- 大纲、人物、人物关系、世界观、时间线、伏笔、场景、便签、统计
- Story Memory 与连续性检查
- 阅读当前会话 / 阅读整部作品
- 全文检索
- 项目导出、完整备份与导入
- 多会话管理、重命名、收藏和删除
- 浅色 / 深色写作主题
- 左侧栏收起与恢复
- `+` AI 写作快捷动作

### AI 陪伴

当前正式能力继续包括：

- 多角色创建、编辑、切换和删除
- 每个角色独立聊天、记忆、关系、模型与声音配置
- SSE 流式回复与停止生成
- 长期记忆、关系记录、时间线、重要时刻和回顾
- STT 语音输入与 TTS 朗读
- Live2D 背景角色、表情、动作与嘴型
- 动态场景与情绪氛围
- 语音通话

陪伴正式启动链和旧版本隔离规则保持不变。

---

## 2. V17.25 小说工作区

V17.25 不删除旧功能，而是重新定义页面主次关系。

### 页面结构

```text
┌──────────────────────────────────────────────────────────┐
│ Unlimited AI      模型        创作资料   设置   更多      │
├────────────┬─────────────────────────────────────────────┤
│ 作品与章节 │  我的小说 › 第一章           正文 | AI助手  │
│            │                                             │
│ 当前作品   │              第一章                         │
│ 章节       │                                             │
│            │        当前章节真实正文编辑器               │
│ AI 对话    │        chapter.manuscript                   │
│            │                                             │
├────────────┴─────────────────────────────────────────────┤
│  +   让 AI 续写、润色或帮你构思……                 发送  │
└──────────────────────────────────────────────────────────┘
```

### 2.1 正文成为中央主界面

V17.25 使用现有真实数据字段：

```text
cfw_studio_workspace_v1
  -> project.chapters[]
  -> chapter.manuscript
```

中央正文编辑器继续使用 `#simpleManuscriptEditor`，因此原有“加入正文”、AI 上下文和章节正文数据链继续兼容。

用户直接编辑正文时，V17.25 通过隐藏的 `data-chapter-field="manuscript"` 代理复用 `studio.js` 原保存逻辑，不建立第二份正文状态。

### 2.2 AI 变成辅助视图

中央顶部提供：

```text
正文 | AI 助手
```

默认进入“正文”。

- 点击 AI 对话会切到“AI 助手”。
- 发送 AI 请求时切到“AI 助手”。
- AI 回复仍保留复制、折叠、分类、加入正文等能力。
- 点击“加入正文”后同步当前章节正文，并返回“正文”。
- 底部 AI 输入框始终可用。
- 原 `+` 快捷菜单继续保留，但快捷动作不再永久占一排空间。

### 2.3 创作资料改成右侧抽屉

大纲、人物、世界观不再永久占据第三列。

顶部 **创作资料** 按钮打开右侧抽屉：

- 大纲
- 人物
- 世界观
- 更多工具中的场景、便签、统计、Story Memory、连续性检查

关闭后中央正文立即恢复完整空间。

桌面端打开资料抽屉时左侧作品 / 章节仍可保留；窄屏下左侧与右侧抽屉互斥，避免遮挡。

### 2.4 左侧导航

左侧继续保留完整功能，但主次调整为：

```text
当前作品
  ↓
章节
  ↓
AI 对话
  ↓
作品工具
```

“作品工具”中继续保留：

- 全文检索
- 阅读作品
- 导出作品
- 导出备份
- 导入备份

这些功能只是被收纳，没有删除。

### 2.5 顶部栏

V17.25 将小说顶部收成真正的一行：

- 品牌 / 会话入口
- 模型
- 创作资料
- 设置
- 更多
- 切换模式

旧的“大块当前写作状态”不再占顶部空间，当前作品与章节通过中央面包屑展示。

---

## 3. 小说增强层历史

### V17.23A — 主题与页面减法

- 默认浅暖色写作主题
- 深色主题保留
- 降低背景噪音
- 小说模式视觉隔离

### V17.23B — 会话管理

- 重命名 / 删除
- 站内确认
- 最后一个会话删除保护

### V17.23C — 导航

- 作品 / 章节 / AI 对话层级
- 侧栏恢复
- 收藏旁删除
- 右侧创作资料与更多工具

### V17.23D — 顶部与 AI 输入

- 顶部更多菜单
- `+` 写作快捷菜单
- 六个 AI 写作快捷动作
- 首次进入引导

### V17.24A — Interface Simplification

- 中间区域加宽
- 左右栏降低视觉权重
- 低频作品功能收进“作品工具”

### V17.24B — Visual Unification

- 浅色 / 深色统一
- 按钮、输入、卡片、边框和弹层统一

### V17.24C — Regression Polish

- 浮动菜单互斥
- 长名称提示
- 窄屏与短视口修整
- 输入区和侧栏恢复回归

### V17.25 — Writing Workspace Redesign

```text
public/novel-writing-v1725.css
public/novel-writing-v1725.js
```

负责：

- 正文中心化
- 正文 / AI 助手双视图
- 创作资料抽屉
- 一行顶部栏
- 复用 `chapter.manuscript`
- 保留全部原功能

V17.25 在现有 V17.23 / V17.24 层之后加载，作为最终布局覆盖层，便于单独回滚。

---

## 4. Prompt 与数据隔离

小说内置系统提示词：

```text
src/worker.js -> NOVEL_SYSTEM_PROMPT
```

陪伴应用层角色卡：

```text
src/companion.js -> COMPANION_ROLE_CARD
```

小说状态继续使用 `cfw_*`，例如：

```text
cfw_novel_theme_v1723
cfw_novel_onboarding_v1723d
cfw_studio_workspace_v1
cfw_sessions_v2
```

陪伴继续使用独立的 `uai_companion_*` 命名空间。

禁止把小说数据迁入陪伴命名空间，也禁止小说 UI 层访问 `#uaiCompanionRoot`。

---

## 5. 陪伴稳定边界

当前陪伴正式入口采用稳定核心 + 安全增强层。

旧以下结构不得重新加入正式启动链：

- `companion-v10*`
- `companion-v11*`
- `companion-v12*`
- 旧 `companion-runtime.js`
- 旧 `companion-call-mode.js`
- 旧 `companion-voice-input.js`
- 旧组合式 Live2D runtime
- `companion-entry-v172/v173/v174.js`

详细历史见 `docs/COMPANION_LEGACY.md`。

---

## 6. API

主要路由：

```text
POST /api/chat
POST /api/memory/extract
POST /api/continuity/review
POST /api/companion/stt
POST /api/companion/tts
GET  /api/companion/stt/status
GET  /api/companion/tts/status
GET  /api/diagnostics
```

---

## 7. 诊断与部署

静态部署状态：

```text
/deploy-status.json
```

当前小说部署标记：

```text
2026-08-24-v17.25-writing-workspace-redesign
```

当前状态：

```text
v17.25-writing-workspace-redesign-current
```

部署后优先检查：

1. `/deploy-status.json`
2. `/api/diagnostics`
3. 进入小说模式后页面 `unlimited-novel-revision`
4. 浏览器控制台 `window.__UNLIMITED_BOOT__`

如果仍然看到旧三栏界面，先确认 Cloudflare 已部署最新 `main`，再强制刷新静态资源缓存。

---

## 8. 测试

`.github/workflows/js-syntax-check.yml` 会执行浏览器端 / Worker JavaScript 语法检查，并运行小说与陪伴合同测试。

V17.25 专用测试：

```text
tests/novel-writing-v1725.test.mjs
```

重点保证：

- 中央正文继续使用 `chapter.manuscript`
- AI “加入正文”链路保留
- 正文 / AI 助手视图存在
- 创作资料抽屉存在
- 全文检索、阅读、导出、备份、导入仍存在
- V17.25 不访问陪伴运行时或陪伴数据

旧 V17.23 / V17.24 测试继续作为历史回归合同运行，但不再要求旧阶段是“当前最新版”。

---

## 9. 后续修改原则

V17.25 之后不要继续堆新的 UI 层，优先根据真实部署截图直接修问题。

优先级：

1. 正文编辑是否舒服、是否真正占据视觉中心。
2. 顶部是否保持一行且不拥挤。
3. 左侧章节是否容易选择。
4. AI 助手与正文切换是否自然。
5. 创作资料抽屉是否遮挡或难关闭。
6. 手机 / 窄屏是否可用。
7. 所有旧功能是否仍能找到并正常工作。

除非出现底层 bug，否则不要重写 `app.js`、`studio.js`、存储核心或陪伴生产链；优先修 V17.25 独立层。
