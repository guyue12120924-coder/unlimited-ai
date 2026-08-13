# Unlimited AI 双模式架构

## 产品入口

每次打开应用都先显示模式大厅，用户在以下两种模式中选择：

- **AI 小说创作**：继续使用原有小说工作台、人物、大纲、设定、正文、Story Memory 与 Continuity。
- **AI 陪伴**：使用独立角色、聊天会话、长期记忆、关系状态与设置。

模式大厅只负责路由，不迁移或重写已有小说数据。

## 数据隔离

小说模式继续使用原有 `cfw_*`、story memory 等存储键。

陪伴模式只使用以下 namespace：

- `uai_companion_profile_v1`
- `uai_companion_sessions_v1`
- `uai_companion_memories_v1`
- `uai_companion_settings_v1`

陪伴请求不会携带 `creative_context`、`memory_context` 或 `continuity_context`。

## API 路由

仍然使用 `POST /api/chat`，通过 `mode` 区分：

- 缺省或 `novel`：保持原有小说路径。
- `companion`：只注入 Companion Character、Companion Memory、Relationship Context 和本地时间。

这样旧前端不传 `mode` 时仍然按照小说模式工作，降低回归风险。

## Companion MVP

第一版包含：

- 角色创建与快速开始
- 关系与性格标签
- 自定义角色描述和用户称呼
- 可选本地头像
- 独立聊天会话
- SSE 流式回复与停止生成
- 独立模型选择和回复长度
- 高置信度本地记忆提取
- 记忆查看、增加、修改、删除和清空
- 会话与角色数据导出
- 当前聊天清空与陪伴模式重置
- 移动端侧栏和输入布局

## 验证

CI 会继续运行既有小说产品测试，并额外运行 `tests/companion-mode.test.mjs`，检查：

1. 模式大厅与两个入口存在。
2. 陪伴 localStorage namespace 与小说 namespace 分离。
3. 陪伴请求明确携带 `mode: "companion"`。
4. Companion Prompt 模块不导入 Story Context、Story Memory 或 Continuity。
5. Worker 按模式选择系统 Prompt。
6. 角色、记忆和关系信息能进入 Companion Prompt。
