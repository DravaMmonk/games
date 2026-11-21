## 7. 作者工具与验证

按用户给定的目标工作。用户委托设计时，结合当前游戏、课程资料和实际试玩作出设计选择。当前事实以组装后的内容为准。

### 7.0 按影响范围验证

| 改动 | 验证 |
|---|---|
| 手册或工作约定 | 核对差异、引用和命令 |
| 文案或课程数据 | 变更集校验及受影响目标的内容检查 |
| UI 或交互 | lint、对应构建、桌面和手机实际流程 |
| 公共协议、注册表、依赖、持久化或求值 | 相关契约、受影响消费者和内容检查，必要时扩大到完整套件 |

从 `site/` 运行 `npm test`、`npm run lint:kit`、`npm run words -- --check` 或 `npm run check -- <游戏>`。独立包用 `npm run check -- --package <包>`。行为迁移见 [基线说明](../kit/engine/baseline.md)。内容检查和教学评审各自验证其范围。测试新增行为时优先使用现有入口与小型夹具。

### 7.1 读写当前内容

从 `site/` 运行：

```sh
npm run --silent inspect -- qed
npm run --silent inspect -- qed chapter=@qed/circuits
npm run --silent inspect -- qed level=1-4
npm run --silent inspect -- --package qed
npm run op -- list
npm run op -- --package qed --file changeset.json --dry-run
```

Studio、CLI 和 [MCP](../../.mcp.json) 共用作者工具。MCP `inspect` 读取组装后的目录、章或完整关卡，`packages` 读取当前包清单、声明和依赖，`vocabulary` 读取目标的能力、schema 和操作参数，`tools/list` 列出当前工具。使用 `modify` 预览、校验和应用变更集。CLI 的 `--dry-run` 只预览，`--json` 输出结构化结果。

变更集格式为 `{ "why": "修改理由", "ops": [{ "op": "操作名", "...": "参数" }] }`。关卡、任务和其他对象的身份保持稳定。游戏只写本层编排及允许的覆盖，包只写自己的声明及覆盖。提交前校验依赖与读取版本，验证通过后一并写入内容与变更日志。Studio 支持预览、试玩、撤销和查看来源。内容副本可用 `GAMES_ROOT` 选择。操作集之外的批量迁移可用 `op -- <目标> adopt --why "…"` 收录变更，并按目标检查。

### 7.2 可选的新课程流水线

`npm run pipeline -- <游戏> brief <步骤>` 读取当前步骤、输入和所用命令。步骤和闸门定义在 [steps.js](../kit/pipeline/steps.js)，蓝图结构和诊断定义在 [blueprint.js](../kit/pipeline/blueprint.js)。流水线读取当前游戏，按阶段生成或评审课程数据。成熟游戏的日常迭代直接经作者工具操作。

机制需求由工程师在所属包实现。涉及共享协议或平台流程时进入内核。自动闸门报告技术问题，评审应结合实际关卡和试玩判断。
