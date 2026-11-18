### 6.8 元件、设置和阶段

`packages/circuit/kinds/` 声明元件、托盘和 `replaces`。`packages/progress/kinds/` 给元件加 `stages`、给托盘加 `workshop`，并给关卡和任务加发放字段。声明可以通过 `extends` 扩展本包或直接依赖包的对象字段。`state-graph` 给 `circuit/part` 扩展可选字段 `demoLevel`，选定元件箱演示所借用的关卡电路板。元件标签使用 `tags/circuit/part/`，覆盖保留 `overrides/<namespace>/parts/`、`trays/` 及相应标签路径。

Studio 由对象类型声明生成资源列表，并挂载已选各包的编辑器与扩展控件。

**元件是能力、参数和外观。** `packages/<包>/parts/<名>.json` 选择包登记的运算 `op`，不写 `compute`。端口、参数和值类型来自运算声明，元件只收窄范围、默认值、选项或固定状态，补上名字、图标、端口标签和视图；每个输出分别选运算时写 `op: { 输出: 运算名 }`。元件属于包，可以放在库包里共用，游戏不复制或覆盖它的行为。

```json
{
  "op": "image/gauss", "name": "@part.gauss.name",
  "settings": { "sigma": { "min": 0.5, "max": 2.5 }, "border": { "fixed": true } },
  "stages": [{ "id": "gauss-border", "settings": { "border": {} } }]
}
```

**设置写在元件里。** 对应运算参数的设置只写差异，`{}` 恢复运算参数的完整声明；不对应参数的设置（例如拼公式的 `tree`）须写全控件与值。没有设置对象、独立设置文件或 `setting.*` 操作。设置可有 `label`、`about`、`default`、`fixed`、`when`，选项可有说明；动态选项由包的能力声明提供。

**阶段是同一元件的线性升级。** 第一阶段就是元件自身，`stages` 只列后续阶段，每个 id 与元件共用包内命名空间。阶段相对前一阶段增量修改设置、说明和卡片；`remove` 去掉选项，`add` 加回运算声明的选项。开放阶段升级原卡，想要两种独立玩法则建两个元件。阶段 id 不可改；元件之间的升级用 `replaces` 关系。

**封装元件引用作品。** `inside` 保存 variant 及自带参考作品和接口，任务用 `publishes` 发布 `{ part, variant }`，显式 `awards` 决定通过后开放的阶段。玩家的通过作品按元件和 variant 保存，`holds().inside()` 按可用路径选择；没有玩家作品才用参考，玩法可明确选参考作品。定义、引理、门、机器等均走同一登记和课程模型，不另用 `revisions` 表。

**设置的控件只有八种**，由 `circuit` 提供（`packages/circuit/view/parts/SettingField.jsx`），桌面卡片上紧凑、手机单子里加大，同一份定义：

| `control` | 是什么 | 自己的字段 | 值 |
|---|---|---|---|
| `select` | 下拉框 | `options` | 选项的 `value`（ASCII 字） |
| `buttons` | 小按钮组 | `options`，`layout`：`row`（一行，会折行）、`column`、`grid`（两两一行）、`pad`（上下左右四向，选项是 `up`、`left`、`right`、`down`） | 同上 |
| `number` | 数字 | `min`、`max`、`step`、`integer`、`unit`、`stepper`（两边加 − / +） | 数 |
| `slider` | 拖拉条 | `min`、`max`（必填）、`step`、`unit`、`marks`（刻度） | 数 |
| `toggle` | 开关 | `on`、`off`（两端的字） | 真假 |
| `list` | 依次选几项 | `options`，或 `from` | 选了的选项，按选的先后 |
| `tree` | 拼一句 | `optional`（可以不填） | 一句话的文字：`logic` 的证明玩法通过 `CircuitScreen` 的 `settingControls` 提供词序条，按任务和当前测试决定可用拼块。编辑器由 `sentence/view` 提供 |
| `custom` | 自定义 | `widget`（包 `widget` 种类的一项）、`params`（合那一项的 schema） | 那一项说 |

卡片的数字输入和卷积核权重直接传递数字。桌面的方向键、配置的加减按钮与 Studio 数字字段使用同一套步进和边界规则。桌面手输与手机小键盘也共用分数和科学计数的解析。


**表达式只管交互和读数。** `rules` 在设置变化后按序写其它设置；`checks` 判断设置是否合法；视图的 `readout.expr`、`action.set`、`when` 也可用 `packages/circuit/core/parts/expr.js` 的 ASCII 设置表达式。它们不是元件的计算实现，元件直接调用选中的运算。检查核对设置名、参数、默认值、图标、控件和引用的能力。

**三面视图**（`views`）：`card` 是桌面画布上卡片的主体，`tile` 是手机格位上的简略视图（`value` 块画在元件名上面，其余的块画在下面），`detail` 是两边共用的详情（桌面卡片头上的 ⓘ、手机点开元件的单子，控件加大）。每一面是一列块，不写就用默认：卡片是全部设置加值，格位是值加一行设置摘要，详情是说明、全部设置和值。只剩一个可选值的设置不画（课程只放出了一个）。块（`show`）：

| 块 | 画什么 | 字段 |
|---|---|---|
| `value` | 输出上的值，包画（`defined.value(node, ctx, output, face)`：卡片上一个数、一张小图，详情里逐个输出细看） | `output`（几个输出时选一个） |
| `settings` | 设置的控件 | `keys`（只画这几个，默认全部） |
| `setting` | 一个设置：控件，或它此刻的值的字（`as: 'label'`） | `key`、`as` |
| `summary` | 一行设置摘要 | `text`：带 `{设置}` 的一句话；不写就是各设置的值的字，用「·」隔开 |
| `readout` | 由设置算出的一个读数 | `label`、`expr`（只读设置的表达式）、`unit`、`digits` |
| `action` | 一个按钮，按下把几个设置改成算出的值 | `label`、`set: { 设置: 表达式 }`、`when`（表达式：为假时按钮变灰） |
| `text` | 一段固定的字 | `text` |
| `desc` | 元件的说明 | |
| `ports` | 输入口和输出口，带名字 | |
| `widget` | 包的显示项 | `widget`、`params` |
| `row` | 几个块排成一行 | `blocks: [块…]` |

例：一张「邻域加权」卡片上画方向、三个权重和边界，下面一个读数「权重和」（`plus(plus($a, $b), $c)`）和一个按钮「使权重和为 1」（`set: { a: over($a, plus(plus($a, $b), $c)), … }`，`when: ne(plus(plus($a, $b), $c), 0)`）；格位上一行 `{axis} [{a}, {b}, {c}]`。


`packages/circuit/core/parts/define.js` 把组装后的元件定义编成运行元件；`packages/circuit/view/parts/` 共用控件和视图，包通过公开接口提供值显示或 widget。`partDefs.parts` 是内存投影，`parts.set`、`parts.unset` 的路径仍从 `parts.<元件>` 开始，写盘会落回单个元件文件。新增、删除用 `part.add`、`part.remove`；文案用带对象路径和语言的 `text.set`。

