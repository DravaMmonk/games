### 6.6 文字试玩与盲玩

包的 `agent` 提供观察和动作，作品检查与玩家界面共用核心判定。文字观察只含玩家可见信息。`play_task` 接受 `game` 或 `package`、`level`、可选 `task` 与 `work`；`run_tests` 通过包的运行入口检查作品。

完整盲玩会话暂时停用，代码在 `kit/engine/play/`；目前由契约测试覆盖观察和判定，流水线、`check` 和 MCP 使用现有作者工具。

