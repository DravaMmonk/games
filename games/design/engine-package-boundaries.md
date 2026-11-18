### 6.3 内核与包的边界

检查、基线和文字试玩只加载 `core/index.js`；游戏与 Studio 同时加载 `core/index.js`、`view/index.jsx`。两边各导出 `register(kernel)`，按直接依赖拓扑登记。包通过 `<包>` 导出核心，通过 `<包>/view` 导出界面；内核分别导出 `kernel`、`kernel/view`。

- 包只实现登记协议，通过内核公开 API 和直接 `uses` 的公开接口组合。
- `core/` 只引用本核心、内核无界面 API 和依赖的核心导出；`view/` 可引用本核心、内核界面 API 与依赖视图导出。作品格式由核心定义。
- import 边界按 AST 检查静态导入、re-export、动态导入和 require。核心禁用 JSX、CSS、界面库、Node I/O 及计算导入路径。
- 判定保持确定性，同一作品和输入得到同一结果，随机来自传入种子。
- 数据经操作集、MCP、Studio 修改；代码经提交和审查修改。
- 带代码的包提供 Node 核心契约、视图配对及跨包组装契约。参考解、naive 解和玩家作品使用同一份运行与判定报告。

**零内容验收。** `site/` 执行 `npm run test:zero`。首次需 `npx playwright install chromium`。脚本创建临时内容根，通过 `GAMES_ROOT` 运行全部内核测试文件和空工作区 `check`，无头 Chromium 打开空 Studio；随后仅安装文字玩法代码和测试现写的一关，检查包、打开无游戏的包工作区，再检查游戏并在桌面与手机尺寸作答通关。测试结束关闭服务器和浏览器、删除临时目录。真实内容由每个包和游戏的独立 `check` 验证。

### 6.3.1 包插件协议

`packages/<包>/core/index.js` 和 `view/index.jsx` 均导出 `register(kernel)`，按直接 `uses` 的拓扑顺序登记。检查、基线与 `play_task`（`game` 或 `package`、`level`、可选 `task`、`work`）只加载包的核心；游戏与 Studio 的 Vite 入口同时加载两份。公开导出使用 `kernel`（`kit/engine/index.js`）、`kernel/view`（`kit/app/view.jsx`），依赖包用 `<包>` 与 `<包>/view`，禁止深入依赖内部路径。

- 核心可调 `object(kind, fullName, value = {})`（登记代码持有的任意对象类型实例）、`play(name, { initial, read, write, normalize, run, judge })`、`kind(name, { type, read })`、`state(name, derive)`、`check(name, check)`、`agent(name, { observe, act })`、`tag(fullName, member)`。标签读者登记本包的 `<包>/<名>` 与单个成员类型；其它登记名字必须是本包的 `<包>/<名>`；每张协议表内重名报错。`kernel.meanings(type, value, context)` 调用该类型登记的含义；`judge` 返回 `{ pass, score? }`，`evaluatePlay(kernel, task, work, context)` 统一读取、规范化、运行、判定、保存。
- 视图可调 `play(name, { component, preview, modes? })`、`editor(name, { type, ...editor })`、`display(name, display)`。核心与视图的玩法名配对；孤立视图报错，游戏实际用到只有核心的玩法时报错。主区组件接收 `{ task, work, onChange, state, context, phone }`，内核负责保存、检验与通关。Studio 可直接读取 `kernel.tables.playView` 的预览、编辑模式，以及 `editor`、`display` 表。
- 新任务用 `play: "text/answer"` 选择玩法。`text` 是无元件依赖的最小插件：五关分别演示精确匹配、忽略大小写与空白、正则、带非负容差的数值、多个可接受答案。配置为 `answerRule`、`referenceAnswer`、`wrongAnswers`、可选 `choices`；检查参考答案通过且全部错误答案失败。正则每次创建，拒绝有状态的 `g`/`y` 标志。
- `kinds/<名>.json` 的对象声明是 `{ folder, schema, declares, overrides, references?, relations?, text?, studio? }`。`schema` 使用 `S` 的 JSON 结构；`references` 列出允许引用它的对象类型；`relations` 将关系名映射为 `{ from, to }` 对象类型；合并方式由字段类型决定；`text` 列出文案字段路径（列表元素用 `*`）；`studio` 是 `{ name, icon, group? }`。对象类型全名 `<包>/<名>`，实例全名 `<包>/<对象名>`。实例标签在 `tags/<对象类型全名>/<名>.json`，覆盖沿声明目录写入 `overrides/<命名空间>/`。
- 字段扩展用 `{ extends: 关卡、任务或已声明对象类型, fields: { 字段: schema } }`，不能重定义已有字段。内核类型与保留目录不能用包声明替换。`kind.put/set/remove` 编辑定义，`object.put/set/remove` 用 `{ kind, name, data? }` 编辑声明实例；代码目录不属于操作集。
- 代码读取的标签归读者所有。内核登记 `kernel/studio-left`，成员类型为 `kind`；`kernel` 是保留命名空间，不能用作包名。包用 `kernel.tag("包/名字", "成员类型")` 登记，登记表 `kernel.tables.tag` 使用相同的复合键。自己声明写 `tags/<成员类型>/<名>.json`，贡献给读者或依赖标签写 `overrides/<命名空间>/tags/<成员类型>/<名>.json`。所有对象类型的目标都必须由所属包声明或由代码登记；标签还须匹配成员类型。不存在的目标统一由存在性检查报告。标签文案键使用 `@tag.<名>.title`、`@tag.<名>.desc`，托盘继续使用 `@tray.`。新对象复制任意已有对象或从 schema 起步；精选起点可用普通标签。Studio 的左栏、标签选择与地址均保留成员类型。
- `plugin-boundaries.js` 用 AST 同时检查静态 import、re-export、动态 import 和 require，拒绝计算出的导入路径。核心只能引用公开无界面接口与本核心，禁止界面库、JSX、CSS、Node I/O；视图可读本核心。`npm run check` 加载代码前检查，`lint:kit` 使用同一规则覆盖包代码。核心判定应保持确定性，只使用传入种子，不访问时间、文件或网络。

库包提供可独立组合的代码内容、数据结构声明、算法和底层能力。通用数值与布尔运算由 `scalar` 通过 `kernel.operation(name, spec)` 登记，消费者按需写入 `uses` 并引用 `scalar/add` 等全名。基础值类型和可本地化的运算错误属于共享内核协议。接线玩法 `circuit` 持有板、端口和求值器，保留惰性分支 `circuit/if` 与寄存器读取 `circuit/held`。现成的四则接线元件由数据扩展 `arithmetic` 提供，同时引用两者。

对象类型的含义由 `kind` 登记提供。内核依 schema 读取、覆盖、展开引用和检查字段，调用含义对象完成派生。`circuit/part` 解释元件和 `replaces`，`progress/part` 解释阶段和发放，`circuit/tray` 解释托盘及菜单，`circuit/quote` 读取引语。它们的文件类型分别是 `circuit/part`、`circuit/tray`、`circuit/quote`。`relations` 声明给出自定义关系的端点类型。

- 内容生命周期包括 `vocabulary`、`names`、`identities`、`indexes`、`matches`、`assemble`、`source`、`override`、`validate` 和 `stamp`。派生字段由 `derived` 列明，`source` 给出派生注册表对应的源对象，写回时只序列化声明。`configuration` 为扩展字段声明所属配置文件。内核无需理解元件和发放字段。
- 课程含义通过 `dependencies`、`plan`、`supplies`、`readWorks`、`taskModule`、`runtimeIds` 和 `scope` 参与通用课程组装。`state` 返回包的派生状态，`check` 判定作品，`play` 负责作品读写、运行和盲玩。运行时通过包的作品读者与课程投影适配。内核进度只推进任务和关卡。
- 创作适配使用 `workspace`、`operations`、`selector`、`textTarget`、`sourceArguments`、`search`、`tools`、`dependencyGraph` 和 `renderWork`，共享操作集保持通用对象 CRUD。`part.*`、`parts.*`、`level.blueprint`、`level.adds` 和 `flow` 实现在包内。类型 schema 和文案定位由包提供。
- 外壳通过游戏的 `shell`、`settings`、`mapBadges`、`referenceName`、`describeObservation`、`composeModules` 接口挂载包行为，引用显示器由 `display` 登记元数据定义。元件册、工坊、元件奖励、连接标签设置和元件样式归包。`Workbench`、`Library`、运行控件、存档上下文和输入交互是共享布局部件。
- 浏览器重建声明与 schema 时保留包的代码登记身份，存在性检查与 Node 共用公开身份投影。
- 基线观察由含义对象的 `baselineCourse`、`baselineStructure`、`baselineRecords`、`baselineReports` 提供，继续比较完整作品、顺序、结果和轨迹。引擎工具保存通用快照与差异算法。

包的测试在 `packages/<包>/test/`。内核测试使用现写的小内容；需要组合包协议的测试显式安装机制夹具。包的示例数据由包自己的测试目录持有，经普通解析器安装到临时工作区。历史基线按 `engine/baseline.md` 比较完整作品、顺序、结果和轨迹，迁移验收只运行 `compare`。

