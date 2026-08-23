# Unlimited AI — 小说创作 + AI 陪伴

Unlimited AI 是一个部署在 Cloudflare Workers 上的本地优先 AI 工作台。首页先进入模式大厅，可选择 **AI 小说创作** 或 **AI 陪伴**。两个模式共用 Worker 和模型基础设施，但 Prompt、上下文、会话和长期记忆相互隔离。

当前版本：

- 陪伴前端：**V17.21 Voice Experience Polish**
- 启动与诊断：**V17.22 Final Cleanup & Diagnostics**
- 小说工作区：**V17.23C Novel Navigation**

> 当前陪伴架构以“稳定核心 + 独立安全增强层”为原则。旧 V10/V11/V12 结构主题和旧 runtime/Live2D/通话实现仅保留作历史参考，不属于正式启动链。详见 `docs/COMPANION_LEGACY.md`。
>
> 小说模式正在执行 V17.23 简化计划。原则是：**正文优先、低学习成本、默认明亮、低频功能收起，并且所有新样式/交互必须限定在 novel mode，不能影响 AI 陪伴。** 详细进度见本文末尾“小说模式 V17.23 修改路线”。

---

## 1. 两种模式

### AI 小说创作

主要能力包括：

- 作品与章节管理
- 人物、世界观、场景和资料
- 大纲与正文
- AI 续写、润色、改写
- Story Memory
- 连续性检查
- 阅读模式
- 本地备份与恢复
- V17.23A 浅暖色、纸张式写作视觉
- V17.23B 明确的会话重命名/删除与站内确认
- V17.23C 左右侧栏恢复入口、收藏旁删除、作品/章节/创作资料导航收敛

小说模式继续使用原有 `cfw_*`、Story Memory 和连续性数据结构。V17.23 的新增层使用 `body[data-uai-mode="novel"]` 进行模式隔离，不修改陪伴页面的 Live2D、语音、通话、场景或数据。

### AI 陪伴

当前正式能力包括：

- 多角色创建、编辑、切换和删除
- 每个角色独立保存聊天、记忆、关系、模型与声音配置
- 多会话聊天与 SSE 流式回复
- 生成中停止与危险操作保护
- 当前角色聊天全文搜索与定位
- 长期记忆整理、去重、置顶、归档与恢复
- 关系记录、时间线、重要时刻和月度回顾
- 消息复制、珍藏、长回复折叠和快捷续聊/改写
- 回复长度：简短 / 自然 / 详细
- 全角色 JSON 备份、合并/覆盖导入和一次回滚
- 麦克风 STT 语音输入
- Grok/Melo/系统语音 TTS
- V17.21 情绪语音：Eve 默认、声音人格、A/B 试听、短句预取、情绪语速与停顿
- 普通朗读与通话共享同一角色声音档案
- Live2D 背景角色、表情、动作、视线跟随和精确嘴型
- 四套动态场景：星河梦境、樱花夜色、月光房间、霓虹幻想
- 场景与情绪氛围联动
- 完整语音通话：VAD、录音、Whisper STT、自动续听、字幕、统一 TTS

---

## 2. 当前陪伴启动链

正式入口仍采用经过故障恢复验证的 **V17.5 core-only entry**：先保证基础聊天可用，再加载独立增强层。

核心链：

```text
boot-diagnostics.js
  -> mode-router.js
  -> companion-entry-v175.js
  -> companion-mode.css + companion-mode.js
```

进入基础聊天后，页面按顺序挂载安全增强：

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

其中 V17.6-V17.10 不修改基础聊天主网格；Live2D 和场景也作为独立背景层，不再创建旧版 V12 的第二套主布局。

---

## 3. 关键模块

### 小说 V17.23 简化层

当前正式加载：

```text
V17.23A public/novel-simplify-v1723.css
V17.23A public/novel-simplify-v1723.js
V17.23B public/novel-sessions-v1723b.css
V17.23B public/novel-sessions-v1723b.js
V17.23C public/novel-navigation-v1723c.css
V17.23C public/novel-navigation-v1723c.js
```

V17.23A 负责小说模式默认浅暖色写作主题、降低背景/卡片噪音、突出正文与 AI 输入。V17.23B 在不替换原 `app.js` 会话核心的前提下增强会话列表、重命名和删除交互。V17.23C 修复桌面端左右侧栏收起后无入口恢复的问题，把删除操作放到左侧 AI 对话列表的收藏按钮旁，并把左侧导航整理为作品/章节/AI 对话、右侧整理为创作资料 + 更多工具。

### 基础聊天

- `public/companion-mode.js`
- `public/companion-mode.css`
- `public/companion-entry-v175.js`

负责基础 DOM、会话、消息、输入、SSE、停止生成、基础设置与兼容存储槽位。

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

负责生成期危险操作保护、状态提示和角色数据整理。旧 `companion-runtime.js` 不属于正式运行时，因为它曾通过重写 `window.fetch` 修改请求链。

### 语音输入与体验

- `public/companion-experience-v1710.js`

负责麦克风录音、`/api/companion/stt`、消息快捷操作与本地浏览器朗读辅助。

### V17.21 情绪语音

- `public/companion-voice-suite-v1711.js`
- `public/companion-voice-suite-v1711.css`
- `public/companion-voice-polish-v1721.css`
- `src/tts.js`

当前默认：

```text
engine: grok
voice: eve
persona: sweet
rate: 0.95x
```

语音会先清理动作描写，再按短句生成情绪计划；长回复只保持小窗口预取，避免一次并发大量 TTS 请求。普通朗读和通话共用同一角色声音档案。

### Live2D

- `public/companion-character-stage-v1712.js`
- `public/companion-character-stage-v1712.css`
- `public/live2d/characters.json`
- `public/live2d/model-pool.json`

Live2D 直接融合在聊天背景中。普通 refresh 不重建 WebGL renderer；只有真实角色/模型变化才替换模型。V17.21 情绪语音存在时，由统一语音引擎拥有嘴型控制权。

### 场景与氛围

- `public/companion-scene-v1714.js`
- `public/companion-scene-v1714.css`
- `public/companion-atmosphere-v1715.js`
- `public/companion-atmosphere-v1715.css`
- `public/companion-luminous-shell-v1719.css`

场景与聊天主结构解耦。背景、Live2D、聊天内容按固定层级叠放，避免旧 V12 结构样式再次改变消息区布局。

### 通话

- `public/companion-call-suite-v1713.js`
- `public/companion-call-suite-v1713.css`
- `public/companion-audio-gesture-v1716.js`
- `src/stt.js`
- `src/tts.js`

通话使用 WebAudio/MediaRecorder + Whisper STT，并直接复用 V17.21 统一声音引擎。

---

## 4. Prompt 与数据隔离

小说内置系统提示词位于：

```text
src/worker.js -> NOVEL_SYSTEM_PROMPT
```

陪伴应用层角色卡位于：

```text
src/companion.js -> COMPANION_ROLE_CARD
```

陪伴请求不会注入小说模式的 `creative_context`、`memory_context` 或 `continuity_context`。

陪伴模式使用独立 `uai_companion_*` localStorage 命名空间。核心兼容槽位：

```text
uai_companion_profile_v1
uai_companion_sessions_v1
uai_companion_memories_v1
uai_companion_settings_v1
```

角色、关系、语音和场景均有独立角色级数据。

---

## 5. API

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

AI 网关入口为 `src/worker-voice.js`，对受保护 POST 路由执行 same-site、Content-Type 和速率限制检查。

---

## 6. 诊断

V17.22 将诊断与实际陪伴架构重新对齐。

浏览器端：

```js
window.__UNLIMITED_BOOT__
```

会动态报告 core、功能包、声音、场景、Live2D、通话和旧结构主题是否被错误加载。

服务端：

```text
GET /api/diagnostics
```

会检查当前正式 `index.html`、V17.21 声音、Live2D、场景、通话和 V17.19 亮色外壳的部署标记。

静态部署状态：

```text
/public/deploy-status.json
```

---

## 7. Legacy 规则

以下类别仍保留在仓库中用于历史参考/回滚，但**禁止重新加入正式启动链**：

- `companion-v10*`
- `companion-v11*`
- `companion-v12*`
- 旧 `companion-runtime.js`
- 旧 `companion-call-mode.js`
- 旧 `companion-voice-input.js`
- 旧 `companion-live2d*.js/css` 组合式增强
- `companion-entry-v172/v173/v174.js`
- 旧 `companion-assets-loader*.js`

详细清单与替代模块见 `docs/COMPANION_LEGACY.md`。

---

## 8. 测试

`.github/workflows/js-syntax-check.yml` 会对浏览器端 JS 和 Worker JS 执行语法检查，并运行 companion 稳定性/合同测试以及小说 V17.23 隔离测试。

测试重点包括：

- 基础聊天入口不会再被增强资源阻塞
- 旧 V10/V11/V12 不回到正式启动链
- V17.21 声音默认 Eve 且通话共用声音档案
- Live2D renderer 可复用且嘴型所有权唯一
- 场景 CSS 不修改核心聊天网格
- 安全 runtime 不重写 `window.fetch`
- V17.23 小说视觉/会话/导航增强不得操作 `#uaiCompanionRoot` 或陪伴数据
- 桌面端左右栏收起后必须存在可见恢复入口
- 左侧 AI 对话列表必须保留收藏并提供相邻删除入口

---

## 9. 部署

项目使用 Cloudflare Workers/Assets。部署后若需要确认是否为最新版本，优先检查：

1. `/deploy-status.json`
2. `/api/diagnostics`
3. 页面控制台中的 `window.__UNLIMITED_BOOT__`

如果浏览器仍显示旧界面，先确认 Cloudflare 已部署当前 `main`，然后执行强制刷新以绕过旧静态资源缓存。

---

## 10. 小说模式 V17.23 修改路线

这一节是后续继续修改小说模式时的**工作清单和边界说明**。下次继续修改前先读取这里，避免重复设计或误动 AI 陪伴。

### 总目标

把小说模式从“功能很多但第一次打开不知道怎么用”改成：

```text
打开小说模式
  -> 选择/创建作品
  -> 选择/创建章节
  -> 写正文
  -> 需要时再调用 AI 和创作资料
```

必须长期遵守的边界：

- 小说视觉规则优先使用 `body[data-uai-mode="novel"]` 限定。
- 不修改 `public/companion-*`、`src/companion.js`、Live2D、陪伴语音、陪伴通话和陪伴场景。
- 不把小说的 `cfw_*` 数据迁移进陪伴的 `uai_companion_*` 命名空间。
- 优先新增独立、可回滚的小说增强层，不轻易重写已经稳定的聊天/存储核心。

### V17.23A — 浅色视觉体系 + 页面减法 ✅ 已完成

已完成内容：

- 小说模式第一次进入默认使用浅暖色写作主题。
- 深色主题仍可在设置中切换，并保存到 `cfw_novel_theme_v1723`。
- 离开小说模式时移除小说专属主题状态，避免影响 AI 陪伴。
- 浅色模式隐藏旧动漫背景、模糊背景和粒子层。
- 左/中/右工作区改成浅色纸张式层级，提高长时间写作可读性。
- 降低重复的大块指导卡、状态卡和上下文说明的视觉存在感。
- 正文编辑器和 AI 输入成为视觉中心。

当前文件：

```text
public/novel-simplify-v1723.css
public/novel-simplify-v1723.js
```

### V17.23B — 会话管理 + 明确删除 ✅ 已完成

已完成内容：

- 会话面板由深黑抽屉改成与小说浅色主题一致的侧栏。
- 每个会话显示名称、消息数量和创建日期/当前状态。
- 原来的“重 / 删”改成完整的“重命名 / 删除”按钮。
- 重命名改成站内输入弹窗，不再直接出现浏览器 `prompt()`。
- 删除改成站内确认弹窗，明确说明删除范围和不可撤销。
- 删除最后一个会话时先自动创建一个新空白会话，再调用原核心删除旧会话；用户不会再看到“至少保留一个会话”。
- 会话核心仍由 `public/app.js` 管理，V17.23B 只增强外层交互，不复制第二套会话状态。

当前文件：

```text
public/novel-sessions-v1723b.css
public/novel-sessions-v1723b.js
```

### V17.23C — 作品 / 章节 / 创作资料导航 ✅ 已完成

已完成内容：

- 修复桌面端 `studio.css` 在宽屏隐藏 `libraryToggleBtn / studioToggleBtn`，导致左右侧栏收起后无法重新打开的问题。
- 左右侧栏收起时，页面左右边缘会出现清楚的“作品与章节 / 创作资料”恢复按钮；顶部恢复按钮也只在对应侧栏收起时显示。
- 左侧结构重新排序为：当前作品 → 章节 → AI 对话 → 搜索/低频工具。
- “添加章节”入口强化为明显的 `+` 操作。
- AI 对话列表每个会话保留 `☆/★` 收藏按钮，并在其旁直接增加“删除”按钮。
- 收藏旁删除继续复用 V17.23B 的站内删除确认与原 `app.js` 会话核心，不创建第二套删除状态。
- 右侧工作台统一命名为“创作资料”，主标签收敛为“正文 / 大纲 / 人物 / 世界观”。
- 场景、便签、统计、Story Memory、连续性检查收进“更多工具”，降低主界面复杂度。
- 所有新增视觉与交互继续限定在小说模式，不修改 AI 陪伴文件。

当前文件：

```text
public/novel-navigation-v1723c.css
public/novel-navigation-v1723c.js
```

### V17.23D — 输入区、顶部栏和最终 UX 收口 ⏳ 下一阶段

最后阶段计划：

- 顶部栏只保留会话、当前作品/章节、模型和设置等高频入口。
- 阅读、GitHub、打赏、人物 Prompt 模式等低频功能进入“更多”菜单。
- AI 输入框默认只显示输入区和发送按钮。
- “继续正文 / 推进剧情 / 写对话 / 规划本章 / 润色 / 检查剧情”等动作收进 `+` 快捷菜单。
- 第一次进入小说模式时提供更简单的新手入口：创建作品、继续最近作品、创建第一章。
- 最终检查浅色/深色、长文本、窄屏和滚动行为。
- 完成后再做一次小说专属回归检查，确保没有改变 AI 陪伴生产链。

### 下一次继续修改时

如果 V17.23A/B/C 没有明显回归，默认从 **V17.23D** 开始。若用户反馈 A/B/C 有视觉或交互问题，先修对应问题，再进入 D。
