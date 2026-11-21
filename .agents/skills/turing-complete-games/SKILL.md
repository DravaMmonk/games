---
name: turing-complete-games
description: Design, extend or review the learning games in the games repository (games/ and packages/, built on games/kit) — curricula, chapters, levels, parts, stages, and component-wiring interaction.
---

# 类图灵完备学习游戏

## 当前内容

- 按用户给定的目标工作。用户委托设计时，结合课程资料、已有知识和实际玩法作出选择。
- 先用 MCP `inspect` 或在 `site/` 运行 `npm run --silent inspect -- <游戏> [chapter=<章节全名> | level=<关卡全名或地图编号>]`。查包职责与字段时读包声明、公开入口和 MCP `vocabulary`。选写操作前读 `npm run op -- list`。
- 通过 Studio、CLI 或 MCP 变更集编辑内容。对照 [共用架构](../../../games/design/engine.md) 核对层职责与依赖。[作者流程](../../../games/design/author-workflow.md) 给出读写与验证入口。

## 课程与玩法

- 从玩家可实际解决的问题、已有知识和可观察结果引入能力。先让玩家看见中间状态、对照或失败，再独立应用。需要时拆任务，避免无关的操作负担。
- 元件、配置和阶段在用到时提供。可复用产出在后续实际问题中使用。按真实先修关系安排路线。
- 文案交代情境、条件和动作，通关说明原理与适用范围。中英文分别核对，共用文案用控件名指引操作。
- 用 [学习体验核对](references/learning-review.md) 辅助教学评审，按 [影响范围](../../../games/design/author-workflow.md#70-按影响范围验证) 验证。界面或交互变更需要桌面和手机实际流程。

稳定的共用架构约定集中在 [项目手册](../../../games/design/README.md)。包声明、实际内容和代码直接供作者工具读取。
