# 游戏项目手册

在 `site/` 运行 `npm run --silent inspect -- <游戏>`，或调用 MCP `inspect`，读取当前课程。查包的类型、依赖、能力、字段和公开入口时，以 `package.json`、`capabilities/`、`kinds/`、MCP `packages` 和 `vocabulary` 为准。运行行为读源码、契约测试和实际试玩。

本手册记录共用架构和跨游戏约定。只有层职责、公开协议、持久化格式或共用平台设计发生变化时，才更新受影响的章节。每个包使用现有声明和源码注释表达接口。关卡、玩法内容、文案、包清单和依赖图均从当前数据读取。

- [1. 设计取向](design-principles.md)
- [2. 课程结构](curriculum.md)
- [3. 基本元素](engine-elements.md)
- [4. 任务设计](writing-levels.md)
- [5. 规则与自动检查](rules-and-checks.md)
- [6. 共用架构](engine.md)
- [7. 作者工具与验证](author-workflow.md)
- [8. 教学评审](faq.md)

原逐游戏设计、方案、评审和路线图可从 Git 历史查阅，例如 `git show 6473eaad:games/qed/design/curriculum.md`。
