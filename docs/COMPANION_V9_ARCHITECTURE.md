# AI 陪伴 V9.5 当前架构

> 本文档描述 `main` 当前实际运行的陪伴模式结构。若旧 README 中仍出现 V2/V3/V4/V5/V6 历史文件说明，以本文档和 `public/boot-diagnostics.js` 为准。

## 1. 产品目标

V9.5 的原则是：主聊天页只保留高频操作，角色、设置、记忆、关系记录分别进入明确模块；不再通过不断叠加 V2/V3/V4/V5/V6 脚本和大段覆盖 CSS 来维持界面。

桌面端主路径：

1. 进入模式大厅。
2. 选择 AI 陪伴。
3. 左侧角色卡负责当前角色入口；`+` 新增角色，菜单进入角色管理/编辑。
4. 左侧保留新聊天、聊天搜索、会话列表、长期记忆、设置、返回模式大厅。
5. 中间仅保留聊天内容和输入区；桌面端不重复显示顶部头像栏。
6. 低频的关系时间线、重要时刻、本月回顾放在“关系记录”中。

## 2. 当前运行时模块

### 启动和模式路由

- `public/boot-diagnostics.js`
  - 当前前端资源版本：`2026-08-14-v9.5-dual-mode-1`
  - 负责加载当前陪伴模块和 CSS。
  - 不再加载已退役的 V3/V4/V5 脚本、旧角色 UI 大模块或旧 V8 覆盖样式。
- `public/mode-router.js`
  - 小说 / 陪伴模式大厅和切换。

### 基础聊天核心

- `public/companion-mode.js`
  - 基础 DOM 壳。
  - 当前角色兼容槽位。
  - 会话列表、消息渲染、输入、SSE 流式回复、停止生成。
  - 基础长期记忆和设置弹窗数据源。
  - 这是聊天发送链路核心，不应再承担新的角色管理 UI 补丁。

### 多角色

- `public/companion-characters-core.js`
  - 多角色持久化。
  - 当前角色快照保存 / 目标角色装载。
  - 角色间聊天、记忆、设置隔离。
- `public/companion-character-editor.js`
  - 只负责新增角色、编辑角色、首次创建角色。
  - 完整角色设定使用单个大文本框，最多 5000 字。
  - 不负责侧栏、设置、长回复、角色 toolbar 等其他职责。

### 设置

- `public/companion-settings.js`
  - 回复长度三档：约 500 / 1000 / 5000 字。
  - 整理设置弹窗。
  - 将备份、导入和危险操作收进“数据与备份”低频区域。
- `public/companion-runtime.js`
  - 根据设置向陪伴请求附加回复长度目标。
  - 生成期间禁止切换角色/危险操作。
  - 全部角色备份和孤儿辅助数据清理。

### 记忆与关系记录

- `public/companion-memory.js`
  - 当前角色聊天搜索。
  - 重要时刻管理。
  - 长期记忆整理、去重、归档和恢复。
- `public/companion-records.js`
  - 关系记录、时间线、纪念册。
  - 经过校验的备份导入和回滚。
- `public/companion-extras.js`
  - 消息复制 / 珍藏。
  - 长回复展开/收起。
  - 回到底部。
  - 关系记录里的本月回顾和可读 Markdown 导出。

### V9 页面收口

- `public/companion-v9-shell.js`
  - 当前角色卡上的新增/编辑/管理入口。
  - 左侧可见的聊天搜索入口。
  - 角色管理弹窗的 V9 结构整理。
  - 记忆弹窗的高频/低频入口整理。
  - 消息操作去重。
- `public/companion-v9.css`
  - 当前主聊天页的最终视觉层。
  - 桌面主栏宽度、1120px 对话内容宽度、16.5px AI 正文字号、输入区、角色管理、移动端响应式。
- `public/companion-support.css`
  - 只保留当前仍需要的辅助组件样式：角色大文本框、回复长度卡片、数据折叠区、消息操作、长回复、回到底部、Toast、本月回顾。

## 3. 当前 CSS 分工

仍加载的陪伴 CSS：

- `companion-mode.css`：基础结构和基础组件。
- `companion-characters.css`：角色管理/编辑弹窗基础组件。
- `companion-memory.css`：搜索、重要时刻和记忆整理组件。
- `companion-records.css`：关系记录和恢复组件。
- `companion-support.css`：当前辅助组件。
- `companion-v9.css`：主页面最终视觉和响应式收口。

旧的 `companion-profile-editor.css` 已删除，不应恢复。

## 4. 已退役文件

以下文件已不属于当前运行时，测试会防止其中一部分被重新引入：

- `public/companion-v2.js`
- `public/companion-v2.css`
- `public/companion-v3.js`
- `public/companion-v3.css`
- `public/companion-v3-guard.js`
- `public/companion-v4.js`
- `public/companion-v4.css`
- `public/companion-v5.js`
- `public/companion-v5.css`
- `public/companion-v5-guard.js`
- `public/companion-v6.js`
- `public/companion-v6.css`
- `public/companion-v8-secondary.js`
- `public/companion-create-controls.js`
- `public/companion-reply-length.js`
- `public/companion-profile-editor.js`
- `public/companion-profile-editor.css`
- `public/companion-characters-ui.js`

不要再以“恢复旧 Vx 文件 + 再覆盖”的方式添加新功能。

## 5. 陪伴 Prompt 边界

陪伴模式应用层最高优先级角色卡位于：

- `src/companion.js -> COMPANION_ROLE_CARD`

实际 Worker 消息顺序是：

1. `system`：`COMPANION_ROLE_CARD`，陪伴模式唯一的应用层 system 消息。
2. `user`：当前角色、关系、长期记忆、最近话题、时间、回复长度等动态参考资料。
3. 后续用户/助手聊天历史。

因此页面角色设定和长期记忆不会与 `COMPANION_ROLE_CARD` 处于同一 system 层级。

小说模式提示词继续由 `src/worker.js` 的小说链路维护，V9 陪伴前端重构不修改小说系统提示词。

## 6. 本地数据隔离

陪伴模式使用 `uai_companion_*` 命名空间；小说模式数据不进入陪伴请求。

核心兼容槽位：

- `uai_companion_profile_v1`
- `uai_companion_sessions_v1`
- `uai_companion_memories_v1`
- `uai_companion_settings_v1`

多角色：

- `uai_companion_characters_v1`
- `uai_companion_active_character_v1`

辅助数据：

- `uai_companion_moments_v1`
- `uai_companion_memory_archive_v1`
- `uai_companion_import_rollback_v1`

## 7. 当前回归测试

`.github/workflows/js-syntax-check.yml` 当前会检查：

- 浏览器脚本语法。
- Worker 模块语法。
- 小说 Story Context 质量契约。
- 小说用户主流程契约。
- 陪伴 / 小说模式隔离。
- 陪伴角色编辑器。
- 关系记录与备份恢复。
- 陪伴运行时兼容性。
- V9 UX / 模块结构。

V9.5 最后一次删除旧 V8 样式后的完整 CI 已通过。

## 8. 后续新增功能规则

新增功能时优先遵守：

- 高频入口留在主聊天页，低频入口进入角色管理、记忆、设置或关系记录。
- 一个模块只负责一类职责，不再创建“全能补丁脚本”。
- 不新增重复头像、重复按钮、重复设置入口。
- 角色数据必须按角色隔离。
- 生成过程中不得切换角色或做会导致异步串写的危险操作。
- 新功能必须补充对应回归测试。
- 不修改陪伴角色卡和小说系统提示词，除非任务明确要求修改 Prompt。
