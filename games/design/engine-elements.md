## 3. 基本元素和引擎里的对应

| 元素 | 含义 | 在引擎里 |
|---|---|---|
| 传感器 | 关卡给电路的一个有名字的值：一张测试图、机器人看到的一格、脚下格子的一条信息 | `packages/circuit/core/board/sensors.js` 的统一形状 `{ id, label, short?, type, family?, named? }` |
| 输入元件 | 电路板上固定的输入，按传感器的种类分（《状态之图》：视野、本格信息），不能放也不能删。元件一开始没有输出口；学习者点一个传感器（在元件上，或在输入窗口里），元件就多一个读它的输出口，再点一下就去掉 | `packages/table/core/model/parts.js` 的输入元件（读到的传感器存在 `params.picks`）；kit 的 `parts.outputs` 支持一个元件多个输出 |
| 原始元件 | 课程起点，内部不在本专题关心的范围 | 游戏贡献给 `circuit/primitives` 的 `circuit/part` 成员 |
| 中层元件 / 封装元件 | 学习者搭出、解锁后当一个元件用，打开能看里面 | `parts/<名>.json` 的 `inside` 存自带参考作品的版本，任务通过 `publishes` 声明它发布的元件版本（课程钩子 `needs` / `builds`）；`packages/circuit/core/boards.js` 的 `packed` 把通关时记下的电路当一个元件跑 |
| 规格 | 传感器、输出、测试、隐藏测试 | 各游戏的关卡数据（数据游戏：`levels/<id>.json`，字段由内核和包声明的 schema 校验） |
| 参考解 / naive 解 | 证明规格可解 / 证明直觉解法不够 | 数据游戏写成蓝图文本；`npm run check` 运行它们（包的 `check` 和运行时判定） |
| 反例 | 失败时具体的那组输入、期望、实际，以及第一处偏离 | 各游戏的失败面板（《状态之图》能定位到第一格算错） |
| 代价 | 元件数、求值步数、读取次数、表的大小 | `kit/engine/test-run.js` 的 `score` 钩子；《视觉完备》算计算量 |
| 世界 | 机体工作的地方：一张图、一张表、一排房子 | `packages/state-graph/core/model/worlds/`；《视觉完备》测试数据 |
| 词汇表 | 内容能引用的全部项：元件、世界、机体、玩法、引言图、诊断条件…… | 内核提供注册机制，各包在 `capabilities/<kind>.json` 定义种类并提供数据项或实现 |

---

