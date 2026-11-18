### 6.2 对象类型、标签与新建对象

**对象类型的结构是数据。** 包在 `kinds/<名>.json` 声明 `folder`、JSON `schema`、`references`、`relations`、`declares`、`overrides`、`text` 和 `studio`。对象类型全名是 `<包>/<名>`，实例使用声明目录。结构参与普通的覆盖、引用、文案、来源与兼容性流程；含义由 `kind` 协议挂载。有些类型只用于组织资料，可以只有数据。

内核自带关卡、任务、标签、关系、词条、百科分组、文案、对象类型、章和游戏配置。包可给关卡、任务扩展字段，声明 `{ extends: "level" | "task", fields }`；任务可用 `play` 限定分支，或用 `schema` 判别树。共用字段展开到各分支，字段须遵守原有必填和防重定义规则。

**命名形状。** 包在 `shapes/<名>.json` 放一份 schema，完整名字是 `<包>/<名>`。其他 schema 用 `{ "type": "shape", "name": "<包>/<名>" }` 引用，可在引用处指定 `optional` 等字段编辑信息。跨包引用须声明直接依赖。组装时展开命名形状，遇到未声明的名字或循环引用就报错。词汇表列出原始声明和参考名字，Studio 读取展开后的字段。公开面记录展开后的形状和对象类型，用它们计算结构兼容性。

**每种玩法只有一份任务 schema。** 实现玩法的包用一份带 `play` 的任务字段声明定义它。判别树可用 `{ "type": "by", "field": "<判别字段>", "casesFrom": "<能力种类>" }` 从登记表取分支。内容包在登记能力时给出自己拥有的形状全名 `shape`，并在自己的 `shapes/` 声明该分支的字段。任务声明可用 `caseGroups` 指定按能力所属包组织诊断的能力种类。组装时，分支的必填字段和共用字段沿用相同的规则。

**`about` 给内容开发者阅读。** Studio 提示、能力浏览器和 MCP `vocabulary` 使用它。只留字段名无法表达的信息，例如效果、缺省行为、单位和字段之间的关系。删掉重复字段名的说明。可校验的约束写成 schema 规则，例如字符串的 `pattern`。保留的 `about` 同时提供非空的 `zh` 和 `en` 文本。

所有类型用 `declares: "package" | "game"` 声明归属，`overrides` 按覆盖层列出允许字段。包也可声明游戏层类型。包层引用包层，游戏层可引用包层与自己的对象；检查与 Studio 工作区共同读取这一份权限。字段合并统一按第 6.1 节的 `set`、`list`、`edges` 执行。

**标签是带成员类型的无序集合。** 每个对象类型都能打标签。标签成员可含对象或同类型的 `#标签`，支持嵌套与成环检查；身份是「成员类型 + 全名」。它用于分组浏览、批量引用和被代码按名字读取的标记。托盘、百科分组和章分别保存自己的属性与有序列表。Studio 分组内成员按先修顺序、再按名字排列。

代码读者登记标签全名与成员类型。内核登记 `kernel/studio-left`，成员类型为 `kind`，`kernel` 是保留命名空间。各包在 `overrides/kernel/tags/kind/studio-left.json` 贡献默认资源类型。默认顺序为内核类型在前，其余按全名；集合为空时列出有对象的全部类型。个人选择保存在浏览器。游戏通过 `overrides/kernel/tags/level/{optional,skippable}.json` 和 `overrides/circuit/tags/circuit/part/primitives.json` 用 `{ "values": { "add": […] } }` 贡献成员。Studio 编排的关卡标记写回这些标签。标签文案用 `@tag.<名>.title`、`@tag.<名>.desc`。

**新对象复制已有对象或从 schema 起步。** 来源可为本包或直接依赖，复制后分配新 id 与独立文案键。空白关卡、任务的最小玩法内容由包的核心提供。精选起点用普通标签组织。对象类型定义通过 `kind.put/set/remove` 编辑，实例通过 `object.put/set/remove` 编辑；变更类型时同时迁移受影响对象。

新包用 `npm run new -- package <新包> --kind <play|ext|course|lib> --from <已有包>`，也可用 `--empty` 创建空包。终端可交互选择种类。工具 `create_package` 的 `id`、`kind`、`from` 或 `empty` 做同样的事（Studio 构建工作区的包列表用它：复制沿用原包的种类，空包先选种类）。新游戏用 `npm run new-game -- <新游戏> --from <已有游戏>`，或工具 `create_game` 的 `id`、`from`、`title`；复制选包与开局设置，从空章开始编排。需要持续共用的内容由库包提供。

