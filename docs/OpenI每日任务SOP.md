# OpenI 启智 · 每日任务 SOP

> 这份是给**子代理**看的作业指导书。服务器上还有一份同内容，追加在
> `skills/github-openi-manager/SKILL.md` 的末尾，子代理那轮读的是它。
> 主模型不亲自干这些活，只派子代理、收结论、记日记。

## 谁来做

主模型在 0 点的夜间轮次派一个子代理，过程不进主会话：

```bash
node /opt/life/scripts/spawn-task.mjs --timeout 900 \
  --task "做今天的 OpenI 每日任务，先读 skills/github-openi-manager/SKILL.md 的「每日任务 SOP」，按里面的顺序做，干完只回一段结论"
```

子代理自己读文档、自己取素材、自己决定发什么。干完只回一段结论。

## 素材从哪来（严格按优先级）

```bash
node /opt/life/scripts/openi-api.mjs materials       # 一眼看清三处各有什么
node /opt/life/scripts/openi-api.mjs material <fid>  # 取夸克某份文档的正文
```

1. **夸克工程文档** —— 主人每天上传的，最新、最贴身。用 `material <fid>` 取正文。
   实测 `search` 会返回服务端异常，`browse` 稳定；脚本用 browse 递归一层目录找文档。
2. **本地 `knowledge/projects/`** —— 邮件通道同步来的工程文档。
3. **自己的 GitHub `yht-cdd/bili-anthropos` 的 `docs/`** —— 12 份已公开的工程文档
   （`B站API完全手册.md`、`桥接与自主执行.md`、`部署文档.md` 等，都有实测数据）。

三处都没有就**跳过今天**，不要编内容。夸克偶尔抽风，脚本会自动降级，不用慌。

## 能做的 API 动作（每日上限写死在代码里）

| 动作 | 每日上限 | 命令 |
|---|---|---|
| 真实 commit | 3 | `openi-api.mjs commit <repo> --path 路径 --content-file 文件 --message 说明` |
| fork 公开项目 | 3 | `openi-api.mjs fork <owner/repo>` |
| 提 PR | 3 | `openi-api.mjs pr <repo> --title 标题 --head 分支 --body-file 文件` |
| 提 issue | 3 | `openi-api.mjs issue <repo> --title 标题 --body-file 文件` |
| 发表评论 | 2 | `openi-api.mjs comment <repo> --number N --body-file 文件` |

```bash
node /opt/life/scripts/openi-api.mjs status          # 今天还剩几次
node /opt/life/scripts/openi-api.mjs search 关键词   # 找可 fork / 可提 PR 的公开项目
```

对自己仓库（`hfdryb/openi-notes`）提 PR / issue / 评论最稳，规则允许，内容也真实。
**对官方或他人仓库提 PR 必须基于真实改进**（格式修复、文档纠错、实用脚本都行），
没有改进就不提 —— 别为了 1 分去骚扰别人。

## 合规红线（代码里也拦了一层）

- **空评论、评论后删除、重复创建项目 = 积分舞弊，倒扣全部积分**
- 每次操作必须有真实内容：实用脚本、有价值文档、格式修复、建设性建议
- 正文太短直接拒发（issue/PR ≥60 字、评论 ≥30 字、commit 内容 ≥40 字）
- 同一目标同一天不重复；内容没变化不做空 commit
- **积分没有查询接口，不许说「积分已到账」**。脚本说 ok 只表示「这次 API 调用成功」
- 网页才能做的（创建计算任务 +10、数据集、模型、镜像）这版不做，别假装做了

## 安全

- AK 由脚本从 `secrets/openi_token.txt` 读，**子代理不碰、也不许问在哪**
- 所有要发出去的内容统一过敏感闸：服务器规格 / 路径 / 凭据 / UID / 邮箱 /
  云厂商主机名，命中就整篇拒发
- 推的是**公开仓库**，主人自己的工程文档也可能含内部信息，宁可少发

## 为什么 API 任务没有定时器兜底

笔记同步（`openi-daily.mjs`）有 `anthropos-openi.timer` 每天 00:30 兜底，
因为那是确定性的：从日记里挑能公开的，推就完了。

API 任务**故意没有**。发什么内容需要判断，脚本无脑跑就是灌水，
而灌水会被判积分舞弊、倒扣全部积分。这部分只能交给子代理的脑子。
夜间那一轮没派成子代理，今天就少拿几分 —— 这比账号被罚强。
