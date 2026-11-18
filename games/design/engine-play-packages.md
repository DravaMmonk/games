### 6.5 包的分类与职责

| 种类 | 判断依据 | 包 |
|---|---|---|
| 功能包 `feature` | 提供可独立使用的功能及所需的交互和接口。 | `circuit`、`sentence`、`text`、`wiki` |
| 拓展包 `ext` | 依托一个或多个已有功能，为特定场景提供可复用的机制或内容。 | `image`、`logic`、`table`、`tick`、`progress`、`workshop` |
| 课程包 `course` | 组织专题的关卡、教学素材和课程专用实现。 | `qed`、`state-graph`、`vision-complete` |
| 库包 `lib` | 提供可复用的数据结构、算法和底层能力。 | `scalar`、`imglib`、`cvlib`、`mllib` |

`circuit` 提供通用接线、电路蓝图和元件编辑器。`sentence` 提供空位和拼块交互，语法、拼块与判定由使用包提供。`text` 提供文字作答与匹配规则。`wiki` 提供可独立组织与展示的百科。

`image` 把图像端口、探针、参数台和场景接入电路。`logic` 提供逻辑任务判定、证明板和证明机，使用 `sentence` 提供的公式拼搭交互。`table` 给电路接入表格信号、世界协议和场景绘制器。`tick` 提供逐拍运行、总线仲裁和寄存器。`progress` 管理电路元件的发放、解锁和阶段。`workshop` 管理个人电路元件的封装、存档与复用。

`vision-complete` 持有专用实验台、场景和显示，并声明自己的 power、box 对象类型。filter 场景、obscura/wave 模型及暗箱显示由 `image` 提供。`state-graph` 持有具体世界、机器人、手动玩法、课程判定和插画，任务使用 `state-graph/*`，示范面板用 `panel`。`qed` 持有 `qed/wordset`、词典投影和地图插画。

依赖只声明实际使用的提供者。功能包可以使用库包中的算法和底层能力，拓展包通过已有功能的公开接口或登记协议接入。包种类用于描述职责，任务使用的 `play` 字段仍指向具体玩法。
