### 6.1 内容：对象、依赖和覆盖

**命名空间和全名。** 包的对象和代码登记项都用 `<包>/<名>`。游戏层对象用 `@<游戏>/<名>`，文案字段用 `@key.path`，标签引用用 `#<命名空间>/<名>`。在声明文件内引用本包对象可写短名，引用别包写全名。`-` 连接一个名字内的词，也用于生成任务 id 的数字后缀。`.` 表示对象内的文案键、字段路径或存档键。`_` 用于端口、线与蓝图变量。

每种对象和能力各有一张注册表，名字在同种里唯一。字段通过 schema 指定要查的种类，例如图片字段中的 `image/glyph`。字段接受几种能力时，同名报歧义。标签的成员种类写进路径；标签身份是「成员类型 + 全名」，不同成员类型可以同名。组装后用 `registries.tag[tagKey(member, fullName)]`（键为 `<成员类型>:<全名>`）读取；`content.tags`、`sources.tag` 同键，`overrideHistory` 的标签事件携带 `member`。引用仍写 `#<命名空间>/<名>`，在字段期望的成员类型里查找；不限成员类型时，同名多类型报歧义。元件和它的阶段也共用名字空间。

包在 `capabilities/<kind>.json` 定义一类能力。文件给出种类名、Studio 的双语名称和顺序，以及可选的实现要求和数据项。字段用 `{ "type": "ref", "kind": "image/scene" }` 声明引用。组装按这个种类补齐作者的短名、查公开身份，并把同一张登记表交给 Studio。需要从能力项选择结构时，`by.casesFrom` 读取各项的 `shape`，分支可用 `ref.values` 限定具体项。

正文引用写成 `<level-ref to="…"></level-ref>`。核心用 `kernel.reference(kind, { target, label })` 声明标记和目标对象类型，平台按已组装的名称校验目标。需要专门交互的包同时提供视图登记。内核通过同一接口安装 `level` 与 `wiki`，后者仍指向百科词条。


| 对象 | 包内文件 | 职责 |
|---|---|---|
| 关卡 `level` | `levels/<名>.json` | 关卡与有独立 id 的任务 |
| 元件 `circuit/part` | `parts/<名>.json` | 运算或封装作品、设置、阶段、外观 |
| 符号 `logic/symbol` | `symbols/<名>.json` | 填句子条的连接词，含 `mark`、`name`、`desc`、`icon` 和可选关卡 `at` |
| 词条 `entry` | `entries/<名>.json` | 百科正文、关联和开放位置 |
| 标签 `tag` | `tags/<对象类型>/<名>.json` | 同种对象的无序集合，可嵌套，不成环 |
| 关系 `relation` | `relations/<名>.json` | `requires`、`replaces` 的有向边 |
| 托盘 `circuit/tray` | `trays/<名>.json` | 元件 `values`、二级 `menus`、标题、说明；进度包扩展 `workshop` |
| 百科分组 `section` | `sections/<名>.json` | 标题、说明和词条或词条标签的 `values` |
| 对象类型 `kind` | `kinds/<名>.json` | schema、目录、引用方、关系、覆盖、文案与左栏声明；全名 `<包>/<名>` |
| 章 `chapter` | 游戏 `chapters/<名>.json` | `levels: list<level>`、`rows`、文案与显示配置 |
| 游戏配置 `game` | 游戏 `game.json` | 选包、`chapters: list<chapter>`、入口文案 |
| 包声明的对象 | `<声明目录>/<名>.json` | 自动参与引用、标签、关系、覆盖、来源、文案和操作集 |
| 包声明的内容类型 | 声明指定的目录 | 例如 `qed/wordset`，以及图像内容包各自的 power、box |

对象目录默认取类型短名，例如两套图像课程包各用自己的 `box/` 和 `power/`。声明可指定 `folder`，如 `circuit/part` 的 `parts/`。一个对象一个文件，文件名提供 id，文件不再重复存对象 id。任务、阶段、菜单等对象内部的身份仍写在内部。标签只提供集合和 Studio 的名字、说明，不承担托盘、百科分组或概念功能；同一个词条可进几个分组，未分组的归「其它」。组装后的 `glossary`、`partDefs` 和 `eras` 是运行与显示投影，不是可写文件。

**集合字段按 schema 工作。** `set<T>` 无序且不重复，`list<T>` 有序且不重复，`edges<T>` 是无环有向边。`T` 用成员 schema 表示，例如 `{ "type": "str", "reference": "circuit/part" }`。标签的 `values` 是 `set`，托盘的 `values` 和 `menus[].values`、百科分组的 `values`、章的 `levels` 与游戏配置的 `chapters`、`encyclopedia` 是 `list`。`menus` 是以 `id` 为身份的对象列表。托盘先按 `menus` 顺序显示菜单，再按 `values` 顺序显示直接成员，菜单内部各自保留 `values` 顺序，`workshop` 省略表示可进工坊。

关系文件写 `{ kind, edges: [{ from, to, required?, game? }] }`。`requires` 的 `edges` 是 `edges<level>`，`replaces` 是 `edges<circuit/part>`。先修关系的标签端点按集合边界连接。内核统一检查集合成员引用、重复、标签嵌套环和有向环。Studio 用 `orderedMembers(content, ids, kind)` 按先修和名字排列分组成员，标签名称按全名排列。

**包元数据和依赖。** `package.json` 声明种类 `kind`、`version`、`kernel` 范围和直接 `uses` 范围表。`"type": "module"` 声明包内的 JS 采用 ES 模块，新建和复制包时自动写入。种类为玩法 `play`、扩展 `ext`、课程 `course` 或基础实现库 `lib`。包 id 独立于种类，Studio 的包工作区、游戏选包、文案工作区和依赖列表按种类分组和筛选。包只可引用自身和直接依赖的对象，依赖不传递授权、不成环。游戏 `game.json` 的 `packages` 必须列全依赖闭包，至少一个包。加载按依赖拓扑排序，平局按包名，游戏最后；`packages` 的第一项是主包，选择顺序与拓扑加载顺序分别保存。

**包的显示名。** 每个 `package.json` 的 `title` 和 `desc` 都是文案键，例如 `@package.title` 和 `@package.desc`。检查要求包自己的 `i18n/zh.json` 与 `i18n/en.json` 都提供非空文案。标题用人能直接叫出的名字，简介用一句话说明包提供什么。新建空包写入双语起始文案，复制包沿用来源的文案，发布 manifest 保留这两个字段。新库包 id 用「缩写 + `lib`」，例如 `cvlib`、`imglib`、`mllib`。`scalar` 的操作全名参与 Q.E.D. 的存档戳，因此继续使用原 id。

**解析和公开面。** `engine/resolver.js` 的 `resolveLayers` 是读取游戏、包和依赖的唯一入口，产出拓扑排序的层；检查、操作集、Studio 服务端、构建、单关试玩、基线和 MCP 共用。内容根目录由解析器解释：默认当前工作区（从 `site/` 运行时取其父目录），可传 `root` 或用 `GAMES_ROOT` 覆盖。平台的安装位置不决定内容位置。游戏工作区只消费解析后的公开数据，依赖并发校验也重新解析层，不扫描包的内部文件。Vite 从已解析层取得代码入口。

**要先存在。** 目标由拥有命名空间的包声明，或由读者代码登记。解析器提供 manifest 公开身份，存在性检查统一消费（第 5 节）。

**覆盖。** 凡是改别人的对象，都写在覆盖者的 `overrides/<命名空间>/` 下，原声明不动。覆盖路径由 `engine/layers.js` 与操作集统一解释：关卡用 `levels/<名>.json`，元件用 `parts/<名>.json`，符号用 `symbols/<名>.json`，词条用 `entries/<名>.json`，标签用 `tags/<种类>/<名>.json`，关系、托盘、百科分组分别用 `relations/`、`trays/`、`sections/`，其它对象类型用自身目录；文案用 `i18n/<lang>.json`。

| 字段类型 | 覆盖补丁 |
|---|---|
| `set<T>`、`edges<T>` | `{ "add": […], "remove": […] }` |
| `list<T>` | 同上，并支持 `{ "insert": [{ "before": <成员>, "values": […] }] }` 或 `after` |
| 普通值 | 写集合数组表示整份替换，未写的字段保留 |
| 文案 | i18n 按键合并，后层覆盖前层 |

`engine/collections.js` 统一完成字段合并。嵌套对象列表用 `id` 定位成员，边用 `from`、`to`、可选的 `game` 定位，移除边时无需重复 `required`。独立包可向同一对象提交集合字段的增量补丁，纯集合贡献按加载顺序合并。整份替换或覆盖普通字段的独立覆盖要求明确依赖。成员来源存于 `sources[kind][name].collections[fieldPath][memberKey] = [layer, …]`。标签键用 `tagKey`，边键是 `[from,to,game或null]` 的 JSON，嵌套路径例如 `menus[qed/proof-and].values`。游戏配置的来源身份为 `sources.game["@<游戏>/config"]`，其中 `collections.chapters` 和 `collections.encyclopedia` 同样记录成员贡献。原始标签引用保留自身贡献来源，展开时可沿对应标签的同一份来源表查询成员。`overrideHistory` 保留覆盖前后值。

**每种对象类型显式声明层权限。** `declares` 是 `package` 或 `game`，`overrides` 按覆盖层列出字段路径。`*` 允许全部字段，`$text` 允许 schema 中的文案字段。未列出的层和字段不能覆盖。包声明示例为 `{ "declares": "package", "overrides": { "package": ["*"], "game": ["$text"] } }`。内核类型的定义在 `kind-policy.js`，包类型在 `kinds/`，`layerProblems` 按同样的两个属性报告 `rule: "layer"`。

| 内核类型 | 谁能声明 | 包层覆盖 | 游戏层覆盖 |
|---|---|---|---|
| level、task、tag、entry、section、kind | package | 全部字段 | 文案 |
| relation | package | 全部字段 | 文案，requires 另允许 edges |
| chapter、game | game | 无 | 全部字段 |
| i18n | 各自语言表 | 文案键 | 文案键 |

**检查命令**（`site/`）：`npm run check -- <游戏>` 查课程和选入的关；`npm run check -- --package <包>` 不生成课程，先查对象、引用、依赖和覆盖，再查元件的类型与设置，最后逐关检查参考解通过、naive 解失败。课程解锁、托盘引入来源、章和进度只在游戏上查。不写目标时查全部游戏，再查没有游戏玩的包；同名时用 `--game`、`--package` 区分。

包和游戏各有 `i18n/<lang>.json`、`changes.jsonl`。游戏另有 `game.json`、`chapters/`，可有作者侧 `blueprint.json`、`pipeline.json`。`resolver.js` 读盘，`content.js` 组装；页面加载构建出的 `content.json` 和语言文件，`publish:content` 检查后只发布内容。文件按职责放，开发按对象做：Studio 聚合对象的定义、文案、标签、关系和覆盖，不要求作者来回找文件。

### 6.1.1 版本、锁定、发布与解析器

**上线前保持 `0.0.0`。** 平台版本在 `kit/platform.json`，包版本在 `package.json`；依赖范围统一为 `^0.0.0`。工作区源目录代表当前实现。源目录与本地平台的哈希变化允许继续检查、组装与构建，锁定仍检查范围和依赖集合。兼容性预览给出 `proposed`，`next` 为 `null`。

**锁定按目标保存。** 每个包和游戏的 `lock.json` 记录依赖闭包与平台的确切版本、内容 SHA-256；包的锁定排除自身。目标锁定决定本次组装，包锁定用于本包独立检查。范围不符、缺少或多余条目、归档依赖哈希变化报告结构化 `dependency` 问题，导出和构建拒绝这些问题。升级依赖是显式操作，完成后运行目标检查。

```sh
# site/
npm run deps -- lock --package scalar
npm run deps -- lock --game qed
npm run deps -- upgrade --game qed [package]
```

**解析器是唯一加载入口。** `resolveLayers` 按范围、锁定和依赖拓扑选择层。工作区有源目录时读取源目录并现算 manifest；否则从本地发布库选择归档、校验归档哈希、解压，再经同一个层读取函数加载。归档层只读。检查、操作集、Studio、构建、单关试玩、基线和 MCP 使用同一入口。存在性检查读取 manifest 的对象、类型、标签与代码登记身份；待定编辑使用重算的公开面。

内容根只由解析器解释，默认当前工作区，从 `site/` 运行时取父目录；可传 `root` 或设置 `GAMES_ROOT`。发布库默认在内容根的 `releases/`，可用 `GAMES_RELEASES` 指定。`index.json` 索引包的版本、内容及归档哈希。`releases/` 排除在 Git 外。远程发布库和平台安装尚待实现。

**公开面包括数据与代码。** 包的对象、任务、阶段、文案键、类型声明、标签、关系、代码登记名字和两份导出接口均参与比较。平台公开面包括 `kernel`、`kernel/view`、登记协议、声明格式、内核对象 schema、文件布局和操作集。增加身份、可选字段或放宽选择计为增加；删除、收窄或使依赖方失效计为破坏。依赖方在上次归档与当前源目录上的检查输出变化计为行为变化。这是有限检查观察。平台目前只比较结构，行为探测待补。

**发布时自动算版本。** 默认 `publish` 拒绝执行。明确首发时运行 `npm run publish -- <包|kernel> --launch`，首次定为 `1.0.0`。此后破坏或行为变化升主版本，只增加升次版本，公开面和观察都不变升修订版本。包发布前在独立工作区检查本包并运行 `test/*.test.js` 契约，带代码的包须提供契约；工具报告受影响的传递依赖方。

归档是源目录加生成的 `manifest.json`，文件名 `<包>-<版本>.zip`。manifest 记录种类、版本、范围、公开面、文件哈希、代码与视图导出、兼容性和受影响的依赖方。`lock.json` 随包保存，作者日志归档并校验文件哈希，日志不参与内容身份。依赖目录、版本库、OS 元数据和临时锁排除。词汇表随平台版本发布。

Studio 从工具元数据读取范围、锁定、manifest 与兼容性。包记录含 `compatibility` 的 `type`、`changes`、`added`、`previous`、`next`、`proposed`、`affected`、`behaviorStatus`；预览只比较结构，行为状态为 `pending-publication`。

**游戏配置与首页。** 每款游戏的 `game.json` 保存入口元数据（`title`、`author`、`kicker`、`lede`、`topic`、`description`、`hero`、`art`、`icon`、`dev`、`hidden`）、组装配置（`kernel`、`packages`、`chapters`，以及百科包提供的可选分组顺序 `encyclopedia`）和单值选择（`words`、`power`、`box`）。首页构建按 `games/hub-order.json` 的游戏 id 顺序读取配置，按章计算关卡数，卡片显示 `title`、`topic`、`lede`、`author` 和 `art`。页面标题、搜索引擎描述和标签页图标分别取 `title`、`description` 和 `icon`。`dev` 给卡片加开发中标记，`hidden` 隐藏卡片，游戏仍会构建。入口文案用 `@game.*` 键，写在游戏的语言表里。

