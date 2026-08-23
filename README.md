# Unlimited AI — 小说创作 + AI 陪伴

Unlimited AI 是一个部署在 Cloudflare Workers 上的本地优先 AI 工作台。首页先进入模式大厅，可选择 **AI 小说创作** 或 **AI 陪伴**。两个模式共用 Worker 和模型基础设施，但 Prompt、上下文、会话和长期记忆相互隔离。

当前版本：

- 陪伴前端：**V17.21 Voice Experience Polish**
- 启动与诊断：**V17.22 Final Cleanup & Diagnostics**
- 小说工作区：**V17.0 Workspace Consolidation**

> 当前陪伴架构以“稳定核心 + 独立安全增强层”为原则。旧 V10/V11/V12 结构主题和旧 runtime/Live2D/通话实现仅保留作历史参考，不属于正式启动链。详见 `docs/COMPANION_LEGACY.md`。

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

小说模式继续使用原有 `cfw_*`、Story Memory 和连续性数据结构。

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

陪伴应用层角色卡位于：

```text
src/companion.js
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

`.github/workflows/js-syntax-check.yml` 会对浏览器端 JS 和 Worker JS 执行语法检查，并运行 companion 稳定性/合同测试。

测试重点不是要求旧模块继续加载，而是保证：

- 基础聊天入口不会再被增强资源阻塞
- 旧 V10/V11/V12 不回到正式启动链
- V17.21 声音默认 Eve 且通话共用声音档案
- Live2D renderer 可复用且嘴型所有权唯一
- 场景 CSS 不修改核心聊天网格
- 安全 runtime 不重写 `window.fetch`

---

## 9. 部署

项目使用 Cloudflare Workers/Assets。部署后若需要确认是否为最新版本，优先检查：

1. `/deploy-status.json`
2. `/api/diagnostics`
3. 页面控制台中的 `window.__UNLIMITED_BOOT__`

如果浏览器仍显示旧界面，先确认 Cloudflare 已部署当前 `main`，然后执行强制刷新以绕过旧静态资源缓存。
