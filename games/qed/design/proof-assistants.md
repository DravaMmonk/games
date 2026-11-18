## 5. 和 Isabelle / Lean 的对照

| 机制 | Isabelle | Lean | 这里 |
|---|---|---|---|
| 可信的核 | `thm` 是抽象类型（LCF） | 核检查证明项的类型 | 第 2 章 |
| 元逻辑 | Pure：⋀、⟹、`?P` | 依赖类型论本身 | 第 2、5、6 章 |
| 逆用规则 | `rule`、`erule`、`frule`、高阶合一 | `apply`、元变量 `?m` | 第 7 章 |
| 策略 | 结果序列、`THEN`、`back` | tactic monad、`<;>`、`first` | 第 8 章 |
| 经典推理 | HOL 本来是经典的 | `Classical.em` 是公理 | 第 9 章 |
| 化简 | `simp`（条件、合同、有序重写） | `simp`、`rfl`（定义相等） | 第 10 章 |
| 归纳类型 | `datatype`、`fun`、`termination` | `inductive`、递推子、`decreasing_by` | 第 12 章：规则板声明类型，定义板定义函数（每个构造子一行、递归变小） |
| 相等 | 原始常量、`subst` | `Eq` 归纳类型、`▸`、`Eq.rec` | 第 6 章的相等规则 |
| 自动化 | `auto`、`blast`、`sledgehammer` + `metis` | `aesop`、`decide`（反射）、`omega` | 第 8、11 章 |
| 反例 | `nitpick`、`quickcheck` | `#eval`、`plausible` | 第 5 章 |

### 5.1 每个元件的真实依托

**规矩：** 目标是让玩家理解证明器为什么可信、怎么运转，所以玩家造出、用到的每个元件都要有真实依托：它的行为等于 Isabelle 或 Lean 里某个具体的东西（方法、策略、规则、核的检查），或者教科书里的标准算法，并且写明是哪个。两个系统做法不同的地方做成分岔，点明各自怎么做。为了教学故意做得和真实系统不一样的（**例外**），要有理由，并且在关卡文案里告诉玩家真实系统怎么做。不发明两边都不是的第三种语义。

**证明板的基础元件只有三类：** 证明核自带的（套用、假设框、任取框、选定一例：→ 和 ∀ 就是核里的函数类型）；玩家声明出来的（并且、或者、⊥、存在、相等、自然数的引入规则和消去规则，各在用到之前的规则板上造出）；公理（反证法）。其余都是证出来的封装件或搭出来的机器。关卡文案按自己的教学思路讲动机，不在前期提 Lean、Isabelle、HOL；对照写在百科和本节。

状态：✓ 有依托；≈ 有依托，做了简化，理由写在表里；✗ 和真实系统不符，待改。

| 元件 | 依托 | 状态 |
|---|---|---|
| 套用、假设框 | 核自带：Lean 的函数应用和 `fun`；Pure 的 ⟹ | ✓ |
| 拼接、拆解、补充、分类讨论、爆炸 | 引入规则是玩家的声明（Lean 的构造子）；消去规则由引入规则生成（Lean 内核从构造子生成递推子：`And.rec`、`Or.rec`、`False.rec`；Isabelle 的 `conjE`、`disjE`、`FalseE`） | ✓ 第 3 章直接生成、通关时点明为什么能生成，第 12 章玩家亲手搭出生成器 |
| 消去规则生成器 | Lean 内核的 `mk_rec_infos`：每个构造子一个 minor premise，构造子的类型把结论换成 motive | ≈ 第 3 章可选专题造出、第 6 章可选专题升级（保留⋀），只做非递归、不带索引的声明；归纳假设和索引是可选关的工作单 |
| 任取框、选定一例 | 核自带：Lean 的 `fun`、应用（依赖函数类型）；HOL 的 `allI`、`spec`；对句子量化（第 6 章专题 X8、X9）是 Lean 的 `∀ (R : Prop)`、HOL 的 `∀R::bool`，对性质量化（X10–X12 的相等、第 12 章的归纳法）是 `∀ (P : α → Prop)`、`∀P::'a ⇒ bool`，同一个 ∀ | ✓ |
| 概括、实例框 | 玩家声明「存在」，消去规则由引入规则生成：Lean 的 `Exists.intro`、`Exists.elim` | ✓ 第 6 章规则板 |
| 等量代换、自反律 | 由玩家声明相等生成：Lean 的 `Eq.refl`、`Eq.rec`（`▸`）；HOL `refl`、`subst` | ✓ 第 6 章规则板 |
| 数学归纳法（证明板） | 由声明自然数生成：Lean 的 `Nat.rec`；HOL `nat.induct` | ✓ 第 12 章规则板 |
| 反证法 | 两边都是核外的公理：HOL 的 `True_or_False`（`ccontr` 由它推出），Lean 的 `Classical.choice`（`Classical.em`、`byContradiction` 由它推出） | ✓ 第 9 章说明它是公理：证明核证不出，也没有声明给得出 |
| 合一的六条规则、合一器 | Martelli–Montanari 的合一算法（教科书算法） | ≈ 真实系统的合一是一体实现，拆成六步是为了能亲手搭 |
| 模式合一 | Miller 的高阶模式合一（Isabelle 和 Lean 都用） | ✓ |
| 逆用规则（接一串规则） | Isabelle `rule r1 r2`：依次试，带回溯；Lean `apply` | ✓ |
| 由假设得证 | Isabelle `assumption`；Lean `assumption` | ✓ |
| 规则作用于假设 | Isabelle `erule`：对上的那条已知会被删掉 | ✗ 现在保留那条已知 |
| 前向推理 | Isabelle `frule`（保留原已知）；Lean `have h' := f h` | ✓ |
| 依次尝试、重复框、逐个目标、目标后移 | Isabelle `APPEND`／`ORELSE`、`REPEAT_DETERM`、`ALLGOALS`、`defer`；Lean `first`、`repeat`、`all_goals`、`swap` | ✓ 重复框只跟第一种结果，等于 `REPEAT_DETERM`，不是 `REPEAT` |
| 回溯搜索 | Isabelle `DEPTH_FIRST`／`DEPTH_SOLVE` | ≈「走回原地不走」是为了让小例子停得下来；真实的 `blast` 另有防循环的办法 |
| 分解目标、分解假设、自建 auto | Isabelle 经典推理器的引入、消去规则集；只用这些规则的搜索就是 `iprover`（直觉主义的证明搜索） | ✗ 名字叫 auto，可真实的 `auto`、`blast`、`fast` 是经典的，证得出排中律；第 9 章「auto 证不出」只对直觉主义搜索成立 |
| auto 加一步反证法（第 9 章） | Isabelle 经典推理器用 swap 规则把否定的目标放进已知 | ≈ 关后要说明真实系统怎样避开「一直换下去」 |
| 改写 | Isabelle `subst`：只换一处（`subst (2)` 选第几处） | ≈ 遍历次序写成「从外往里、从左往右」；Lean 的 `rw` 会换掉所有相同的出现，要在关后点明 |
| 化简 | Isabelle `simp only`、Lean `simp only`：改到改不动 | ≈ 真实的 simp 由里往外改，规则次序不由用户排；「会绕圈的化简」已经说明有序重写 |
| 「先后」（第 10 章，规则排列次序改变结果） | 无：真实 simp 的结果不取决于用户列出规则的次序 | ✗ 这一课是这里发明的语义 |
| 已知里的等式 | Isabelle `subst h`、`simp add: h`；Lean `rw [h]` | ✓ |
| Skolem 化、析出子句、完整子句化 | Metis 和 sledgehammer 的子句化；∀ 底下的 Skolem 函数要选择公理 | ✓ |
| 一轮归结、饱和器 | 归结和饱和（教科书算法；真实证明器用 given-clause 循环） | ≈ 一圈全试是为了能看清每一步 |
| 外部证明器 | sledgehammer 调用的外部证明器（E、Vampire）不受信任；Isabelle 的 oracle 机制 | ≈ 它的错（一次消掉几对）是为了「证明器错了」那一关故意做的 |
| 重放、证明重建器 | `metis` 在核里重新证一遍外部证明器找到的证明 | ✓ |
| 相等、反射 | Lean 的项、`Eq.rec`、`rfl`、`decide` | ✓ |
| 写脚本板 | Isar；Lean 策略块里的 `have`、`show` | ✓ |
| 真值表、真值电路、造世界 | 语义一侧（模型），不是证明器的部件；对应 `nitpick`、`quickcheck`、`decide` | ✓ |

---

