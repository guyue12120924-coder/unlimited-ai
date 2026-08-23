# Unlimited AI — 小说创作 + AI 陪伴

Unlimited AI 是一个部署在 Cloudflare Workers 上的本地优先 AI 工作台。首页进入模式大厅后，可选择 **AI 小说创作** 或 **AI 陪伴**。两个模式共用 Worker 与模型基础设施，但 Prompt、上下文、会话和长期记忆相互隔离。

当前版本：

- 陪伴前端：**V17.21 Voice Experience Polish**
- 启动与诊断：**V17.22 Final Cleanup & Diagnostics**
- 小说工作区：**V17.23D Novel Final UX**

> 陪伴架构继续遵守“稳定核心 + 独立安全增强层”。旧 V10/V11/V12 结构主题和旧 runtime/Live2D/通话实现仅保留作历史参考，不属于正式启动链。
>
> 小说 V17.23 简化计划 A/B/C/D 已全部完成。长期原则仍是：**正文优先、低学习成本、默认明亮、低频功能收起，并且所有新增样式与交互必须限定在 novel mode，不能影响 AI 陪伴。**

---

## 1. 两种模式

### AI 小说创作

主要能力：

- 作品与章节管理
- 大纲、正文、人物、世界观、场景和资料
- AI 续写、润色、改写与剧情检查
- Story Memory
- 连续性检查
- 阅读模式
- 本地备份与恢复
- 多会话管理、重命名、收藏和明确删除
- 左右侧栏收起与恢复
- 浅暖色纸张式写作视觉，并保留深色模式
- 当前作品 / 当前章节顶部状态
- `+` AI 写作快捷菜单
- 首次进入小说模式的新手入口

V17.23 各阶段：

- **V17.23A**：浅暖色视觉体系、正文优先、页面减法
- **V17.23B**：会话重命名 / 删除、站内确认
- **V17.23C**：作品 / 章节 / 创作资料导航、侧栏恢复、收藏旁删除
- **V17.23D**：顶部栏收口、输入区快捷动作、新手入口与最终 UX 收口

小说模式继续使用原有 `cfw_*`、Story Memory 和连续性数据结构。新增层使用 `body[data-uai-mode="novel"]` 限定视觉和交互，不修改陪伴页面的 Live2D、语音、通话、场景或 `uai_companion_*` 数据。

### AI 陪伴

当前正式能力包括：

- 多角色创建、编辑、切换和删除
- 每个角色独立保存聊天、记忆、关系、模型与声音配置
- 多会话聊天与 SSE 流式回复
- 生成中停止与危险操作保护
- 当前角色聊天全文搜索与定位
- 长期记忆整理、去重、置顶、归档与恢复
- 关系记录、时间线、重要时刻和月度回顾
- 消息复制、珍藏、长回复折叠和快捷续聊 / 改写
- 回复长度：简短 / 自然 / 详细
- 全角色 JSON 备份、合并 / 覆盖导入和一次回滚
- 麦克风 STT 语音输入
- Grok / Melo / 系统语音 TTS
- V17.21 情绪语音：Eve 默认、声音人格、A/B 试听、短句预取、情绪语速与停顿
- 普通朗读与通话共享同一角色声音档案
- Live2D 背景角色、表情、动作、视线跟随和精确嘴型
- 动态场景与情绪氛围联动
- 完整语音通话：VAD、录音、Whisper STT、自动续听、字幕、统一 TTS

---

## 2. 当前陪伴启动链

正式入口采用经过故障恢复验证的 **V17.5 core-only entry**：先保证基础聊天可用，再加载独立增强层。

```text
boot-diagnostics.js
  -> mode-router.js
  -> companion-entry-v175.js
  -> companion-mode.css + companion-mode.js
```

进入基础聊天后，再挂载安全增强：

```text
V17.6  companion-core-polish-v176.css
V17.7  companion-function-pack-v177.js
V17.8  companion-controls-v178.js
V17.9  companion-runtime-safe-v179.js
V17.10 companion-experience-v1710.js
V17.21 companion-voice-suite-v1711.js
V17.14 companion-scene-v1714.js
V17.21 companion-character-stage-v1712.js
V17.21 companion-call-suite-v1713.js
V17.15 companion-atmosphere-v1715.js
V17.16 companion-audio-gesture-v1716.js
V17.19 companion-luminous-shell-v1719.css
```

旧 V10/V11/V12 结构主题不得重新加入正式启动链。

---

## 3. 小说 V17.23 正式模块

### V17.23A — 视觉与主题

```text
public/novel-simplify-v1723.css
public/novel-simplify-v1723.js
```

负责：

- 第一次进入小说模式默认浅暖色写作主题
- 深色主题切换与 `cfw_novel_theme_v1723` 保存
- 隐藏旧动漫背景、模糊背景和粒子干扰
- 降低大块状态卡和说明卡存在感
- 强调正文和 AI 输入区

### V17.23B — 会话管理

```text
public/novel-sessions-v1723b.css
public/novel-sessions-v1723b.js
```

负责：

- 会话列表浅色化
- 完整“重命名 / 删除”按钮
- 站内重命名弹窗
- 站内删除确认
- 删除最后一个会话时先创建新的空会话

会话核心仍由 `public/app.js` 管理，V17.23B 不复制第二套会话状态。

### V17.23C — 导航

```text
public/novel-navigation-v1723c.css
public/novel-navigation-v1723c.js
```

负责：

- 左右侧栏收起后的恢复入口
- 左侧整理为：当前作品 → 章节 → AI 对话 → 搜索 / 低频工具
- 强化添加章节入口
- 会话收藏按钮旁增加删除入口
- 右侧统一为“创作资料”
- 主标签收敛为：正文 / 大纲 / 人物 / 世界观
- 场景、便签、统计、Story Memory、连续性检查进入“更多工具”

### V17.23D — 最终 UX 收口

```text
public/novel-final-v1723d.css
public/novel-final-v1723d.js
```

V17.23D 由稳定的 `novel-simplify-v1723.js` 作为独立增强层加载，仍不改写 `app.js`、`studio.js` 或陪伴生产链。

已完成：

- 顶部栏显示当前作品和当前章节
- 顶部保留会话、作品 / 章节状态、模型、设置等高频信息
- 阅读、人物 Prompt、命令面板、GitHub、打赏进入“更多”菜单
- AI 输入区默认隐藏低价值 footer，只保留输入、发送 / 停止和 `+` 快捷入口
- `+` 菜单提供：继续正文、推进剧情、写对话、规划本章、润色、检查剧情
- 快捷动作只向当前输入框填入写作要求，仍复用原发送链路
- 第一次进入提供：创建新作品、继续最近作品、创建第一章 / 新章节
- 顶部和输入区对窄屏做自动收缩
- 所有 V17.23D CSS 都使用 `body[data-uai-mode="novel"]` 限定
- JS 不访问 `uai_companion_*`、`#uaiCompanionRoot` 或陪伴全局状态

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

陪伴请求不会注入小说模式的 `creative_context`、`memory_context` 或 `continuity_context`。

陪伴模式继续使用独立的 `uai_companion_*` localStorage 命名空间，例如：

```text
uai_companion_profile_v1
uai_companion_sessions_v1
uai_companion_memories_v1
uai_companion_settings_v1
```

小说新增状态仍使用 `cfw_*`，包括：

```text
cfw_novel_theme_v1723
cfw_novel_onboarding_v1723d
cfw_studio_workspace_v1
```

---

## 5. 关键陪伴模块

### 基础聊天

- `public/companion-mode.js`
- `public/companion-mode.css`
- `public/companion-entry-v175.js`

### 多角色、记忆与关系

- `public/companion-characters-core.js`
- `public/companion-character-editor.js`
- `public/companion-memory.js`
- `public/companion-records.js`
- `public/companion-extras.js`
- `public/companion-function-pack-v177.js`
- `public/companion-controls-v178.js`

### 安全运行时

- `public/companion-runtime-safe-v179.js`

旧 `companion-runtime.js` 不属于正式运行时，因为它曾通过重写 `window.fetch` 修改请求链。

### 语音与通话

- `public/companion-experience-v1710.js`
- `public/companion-voice-suite-v1711.js`
- `public/companion-voice-suite-v1711.css`
- `public/companion-voice-polish-v1721.css`
- `public/companion-call-suite-v1713.js`
- `public/companion-call-suite-v1713.css`
- `public/companion-audio-gesture-v1716.js`
- `src/stt.js`
- `src/tts.js`

当前默认声音档案：

```text
engine: grok
voice: eve
persona: sweet
rate: 0.95x
```

### Live2D / 场景

- `public/companion-character-stage-v1712.js`
- `public/companion-character-stage-v1712.css`
- `public/companion-scene-v1714.js`
- `public/companion-scene-v1714.css`
- `public/companion-atmosphere-v1715.js`
- `public/companion-atmosphere-v1715.css`
- `public/companion-luminous-shell-v1719.css`

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

AI 网关入口为 `src/worker-voice.js`，受保护 POST 路由执行 same-site、Content-Type 和速率限制检查。

---

## 7. 诊断与部署

浏览器端：

```js
window.__UNLIMITED_BOOT__
```

服务端：

```text
GET /api/diagnostics
```

静态部署状态：

```text
/public/deploy-status.json
```

当前小说部署标记应为：

```text
2026-08-23-v17.23d-novel-final-ux
```

部署后若要确认是不是最新版本，优先检查：

1. `/deploy-status.json`
2. `/api/diagnostics`
3. 页面 `<meta name="unlimited-novel-revision">`
4. 浏览器控制台 `window.__UNLIMITED_BOOT__`

如果浏览器仍显示旧界面，先确认 Cloudflare 已部署当前 `main`，再强制刷新绕过旧静态资源缓存。

---

## 8. Legacy 规则

以下类别仍保留用于历史参考 / 回滚，但禁止重新加入正式启动链：

- `companion-v10*`
- `companion-v11*`
- `companion-v12*`
- 旧 `companion-runtime.js`
- 旧 `companion-call-mode.js`
- 旧 `companion-voice-input.js`
- 旧 `companion-live2d*.js/css` 组合式增强
- `companion-entry-v172/v173/v174.js`
- 旧 `companion-assets-loader*.js`

详细清单见 `docs/COMPANION_LEGACY.md`。

---

## 9. 测试

`.github/workflows/js-syntax-check.yml` 会执行浏览器端 / Worker JavaScript 语法检查，并运行 companion 稳定性合同与小说 V17.23 隔离测试。

小说 V17.23 回归重点：

- A/B/C/D 不得操作 `#uaiCompanionRoot`、`uai_companion_*` 或陪伴运行时
- 桌面端左右栏收起后必须有可见恢复入口
- 左侧 AI 对话列表必须保留收藏并提供相邻删除入口
- 会话重命名 / 删除继续复用原 `app.js` 核心
- D 的顶部低频入口必须进入“更多”菜单
- D 的 `+` 菜单必须保留六个写作快捷动作
- D 的快捷动作只填充 `#msg`，不创建第二套发送逻辑
- 新手入口只读写小说 `cfw_*` 状态
- 深浅主题与窄屏样式仍必须限定在 novel mode

---

## 10. 小说模式 V17.23 修改路线

### 总目标

```text
打开小说模式
  -> 选择 / 创建作品
  -> 选择 / 创建章节
  -> 写正文
  -> 需要时再调用 AI 和创作资料
```

必须长期遵守：

- 小说视觉优先使用 `body[data-uai-mode="novel"]` 限定。
- 不修改 `public/companion-*`、`src/companion.js`、Live2D、陪伴语音、陪伴通话和陪伴场景。
- 不把小说 `cfw_*` 数据迁移到陪伴 `uai_companion_*` 命名空间。
- 优先新增独立、可回滚的小说增强层，不轻易重写稳定的聊天 / 存储核心。

### V17.23A — 浅色视觉体系 + 页面减法 ✅ 已完成

- 默认浅暖色写作主题
- 深色主题保留
- 背景噪音降低
- 正文和 AI 输入成为视觉中心

### V17.23B — 会话管理 + 明确删除 ✅ 已完成

- 完整重命名 / 删除
- 站内确认
- 最后一个会话可正常删除并自动补空白会话

### V17.23C — 作品 / 章节 / 创作资料导航 ✅ 已完成

- 侧栏恢复入口
- 收藏旁删除
- 左侧作品 / 章节 / AI 对话层级
- 右侧正文 / 大纲 / 人物 / 世界观 + 更多工具

### V17.23D — 输入区、顶部栏和最终 UX 收口 ✅ 已完成

- 顶部当前作品 / 章节状态
- 低频功能进入“更多”
- 输入区 `+` 快捷菜单
- 六个 AI 写作快捷动作
- 第一次进入的新手入口
- 窄屏与长名称收缩处理
- novel mode 隔离回归约束

### 下一次继续修改时

V17.23 已完成。下一轮默认进入 **V17.24 用户体验回归 / Bugfix 阶段**：

1. 优先根据真实页面截图修视觉问题，不再继续增加主界面功能。
2. 优先检查菜单遮挡、长文本、窄屏、滚动、输入焦点和侧栏恢复。
3. 若用户反馈 A/B/C/D 某项交互有问题，直接修对应独立层。
4. 不重构陪伴生产链，不重新启用旧 V10/V11/V12。
5. 功能稳定后再考虑新的小说能力，而不是继续堆按钮。
