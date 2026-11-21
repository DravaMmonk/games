# 内容与文档

按用户给定的目标和当前实现工作。关卡内容通过 MCP `inspect` 或在 `site/` 运行 `npm run --silent inspect -- <游戏>` 读取。包的职责、依赖和接口通过 `package.json`、能力与对象声明、公开入口和测试核对。

文档维护集中在 [项目手册](games/design/README.md)。只有底层架构、共用协议或平台约定变化时才更新相应章节。逐包、逐游戏和逐关的说明由实际数据、公开接口与源码注释提供。

## UI 工作

设计、修改或审查界面时，使用仓库内的 [Impeccable skill](.agents/skills/impeccable/SKILL.md)。先阅读 [共用界面约定](games/design/engine-ui.md) 并查看目标游戏或工作区的当前实现。课程、关卡和玩法交互同时遵循 [游戏设计 skill](.agents/skills/turing-complete-games/SKILL.md)。

复用 [共用主题变量](games/kit/tokens.css)，在受影响的桌面和手机流程中验证实际交互，并检查中英文文案的布局。

Impeccable 的 Codex 版本来自 [pbakaus/impeccable 4.10.0](https://github.com/pbakaus/impeccable/releases/tag/skill-v4.10.0)，固定在上游提交 `b49177d32788f2dc585c42831d845dacf1ebed2c`。
