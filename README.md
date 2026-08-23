# Unlimited AI — 小说创作 + AI 陪伴

Unlimited AI 是一个部署在 Cloudflare Workers 上的本地优先 AI 工作台。首页进入模式大厅后，可选择 **AI 小说创作** 或 **AI 陪伴**。两个模式共用 Worker 与模型基础设施，但 Prompt、上下文、会话和长期记忆相互隔离。

当前版本：

- 陪伴前端：**V17.21 Voice Experience Polish**
- 启动与诊断：**V17.22 Final Cleanup & Diagnostics**
- 小说工作区：**V17.24C Final Regression Polish**

> 陪伴架构继续遵守“稳定核心 + 独立安全增强层”。旧 V10/V11/V12 结构主题和旧 runtime/Live2D/通话实现仅保留作历史参考，不属于正式启动链。
>
> 小说 UI 优化已经完成 V17.23 A/B/C/D 与 V17.24 A/B/C。长期原则是：**正文优先、功能不删除、低学习成本、低频功能收起、所有小说增强限定在 novel mode，不影响 AI 陪伴。**

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
- 浅暖色写作主题和统一深色模式
- 当前作品 / 当前章节顶部状态
- `+` AI 写作快捷菜单
- 首次进入小说模式的新手入口
- 低频作品工具统一收纳但功能全部保留
- 长作品名、章节名、会话名截断并保留完整悬停提示
- 窄屏选择章节 / AI 对话后自动回到正文区域

V17.23 基础简化：

- **V17.23A**：浅暖色视觉体系、正文优先、页面减法
- **V17.23B**：会话重命名 / 删除、站内确认
- **V17.23C**：作品 / 章节 / 创作资料导航、侧栏恢复、收藏旁删除
- **V17.23D**：顶部栏收口、输入区快捷动作、新手入口

V17.24 三次 UI 优化：

- **V17.24A**：主界面减法、写作区加宽、作品工具收纳，不删除功能
- **V17.24B**：浅色 / 深色视觉统一，按钮、卡片、输入、边框和排版统一
- **V17.24C**：最终回归，菜单互斥、长名称、窄屏、短视口、弹窗和输入区细节修整

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

## 3. 小说正式模块

### V17.23A — 视觉与主题

```text
public/novel-simplify-v1723.css
public/novel-simplify-v1723.js
```

负责默认浅暖色主题、深色主题切换、旧背景降噪和小说增强层加载入口。

### V17.23B — 会话管理

```text
public/novel-sessions-v1723b.css
public/novel-sessions-v1723b.js
```

负责会话重命名 / 删除、站内确认与最后一个会话删除保护。会话核心仍由 `public/app.js` 管理。

### V17.23C — 导航

```text
public/novel-navigation-v1723c.css
public/novel-navigation-v1723c.js
```

负责左右侧栏恢复、作品 / 章节 / AI 对话层级、收藏旁删除、右侧“创作资料”与“更多工具”。

### V17.23D — 输入区与顶部栏

```text
public/novel-final-v1723d.css
public/novel-final-v1723d.js
```

负责当前作品 / 章节状态、顶部“更多”、AI 输入 `+` 快捷菜单和首次进入的新手入口。

### V17.24A — Interface Simplification

```text
public/novel-ui-v1724a.css
public/novel-ui-v1724a.js
```

负责：

- 中间写作区加宽
- 左右栏降低视觉权重
- 左侧主层级保持“作品 → 章节 → AI 对话”
- 全文检索、阅读、导出、备份、导入进入“作品工具”
- 原功能按钮与 ID 完整保留

### V17.24B — Visual Unification

```text
public/novel-ui-v1724b.css
```

纯视觉层，负责浅色 / 深色统一、按钮、边框、输入、卡片、气泡、弹层和滚动条视觉收口，不增加交互逻辑。

### V17.24C — Final Regression Polish

```text
public/novel-ui-v1724c.css
public/novel-ui-v1724c.js
```

负责：

- 顶部“更多”、右侧“更多工具”、左侧“作品工具”和输入 `+` 菜单同一时间只展开一个
- Esc 关闭当前浮层
- 长作品名 / 章节名 / AI 对话名增加完整 title 提示
- 980px 以下选择章节或 AI 对话后自动收起左侧覆盖层并返回正文
- 不主动聚焦输入框，避免手机软件键盘意外弹出
- 浮层限制在视口内，短高度屏幕保持菜单和新手引导可滚动
- 新手引导关闭按钮改为稳定绝对定位
- 最终检查输入区、右侧创作资料、滚动和侧栏恢复

V17.24C 不读写新的 localStorage，也不访问陪伴命名空间。

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

小说状态继续使用 `cfw_*`，包括：

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
2026-08-23-v17.24c-final-regression-polish
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

`.github/workflows/js-syntax-check.yml` 会执行浏览器端 / Worker JavaScript 语法检查，并运行 companion 稳定性合同与小说隔离 / UI 回归测试。

小说重点：

- V17.23 A/B/C/D 与 V17.24 A/B/C 不得操作 `#uaiCompanionRoot`、`uai_companion_*` 或陪伴运行时
- 桌面端左右栏收起后必须有可见恢复入口
- 左侧 AI 对话列表必须保留收藏与删除
- 会话重命名 / 删除继续复用原 `app.js` 核心
- 全文检索、阅读、导出、备份、导入等原功能不能被 V17.24 隐藏或删除
- `+` 快捷动作只填充 `#msg`，不创建第二套发送逻辑
- V17.24B 保持纯视觉层
- V17.24C 不新增持久化数据，不访问陪伴状态
- V17.24C 的浮层不能同时堆叠展开
- 窄屏选择内容后不得因为自动 focus 意外弹出软件键盘

对应合同：

```text
tests/novel-simplify-v1723.test.mjs
tests/novel-sessions-v1723b.test.mjs
tests/novel-navigation-v1723c.test.mjs
tests/novel-final-v1723d.test.mjs
tests/novel-ui-v1724a.test.mjs
tests/novel-ui-v1724b.test.mjs
tests/novel-ui-v1724c.test.mjs
```

---

## 10. 小说模式当前修改路线

### 总目标

```text
打开小说模式
  -> 选择 / 创建作品
  -> 选择 / 创建章节
  -> 写正文
  -> 需要时再调用 AI 和创作资料
```

长期遵守：

- 小说视觉与新增交互使用 `body[data-uai-mode="novel"]` 限定。
- 不修改 `public/companion-*`、`src/companion.js`、Live2D、陪伴语音、陪伴通话和陪伴场景。
- 不把小说 `cfw_*` 数据迁移到陪伴 `uai_companion_*` 命名空间。
- 优先新增独立、可回滚的小说增强层，不轻易重写稳定的聊天 / 存储核心。
- **简化功能的含义是降低主界面可见复杂度，不是删除能力。**

### V17.23A — 浅色视觉体系 + 页面减法 ✅
### V17.23B — 会话管理 + 明确删除 ✅
### V17.23C — 作品 / 章节 / 创作资料导航 ✅
### V17.23D — 输入区、顶部栏和新手入口 ✅
### V17.24A — 第一次：主界面简化、不删功能 ✅
### V17.24B — 第二次：视觉统一与细节美化 ✅
### V17.24C — 第三次：最终回归与体验收口 ✅

### 下一次继续修改时

V17.24 三次界面优化已经结束。后续默认只进入 **真实页面反馈 / Bugfix**，不要再主动堆主界面功能：

1. 优先根据实际页面截图修具体视觉问题。
2. 如果没有真实问题，不继续新增 UI 层。
3. 优先处理功能不可达、菜单遮挡、长文本、窄屏、滚动、输入和侧栏恢复等回归问题。
4. 保持已有功能，不通过“简化”删除用户原有能力。
5. 不重构陪伴生产链，不重新启用旧 V10/V11/V12。
