# 《万象祈愿》初版设计

> 完整长文设计见 IMA 笔记 `7488926184924295`。本文为仓库内初版摘要，与代码对齐。

## 1. 产品

| 项 | 决策 |
|---|---|
| 名称 | 万象祈愿 |
| 形态 | 微信小程序 |
| 定位 | 概率博物馆 / 演示向 |
| 货币 | MVP 纯模拟币（签到与任务发放） |
| 原则 | 共享 Wallet / Inventory / Pity / History；场景独立配置与上架 |

## 2. 架构

```text
Shared Core          Scene Packs (独立)
─────────────        ─────────────────
Account              A1/A3 标准卡池
Wallet               B1 分级宝箱
Inventory            C2 转盘
PityHub              （后续 A2/B2/C1…）
History
PoolConfig
```

随机 **只在服务端（或本地 Mock 引擎）发生一次**，前端只做演出。

## 3. 经济（MVP）

| 货币 | 用途 |
|---|---|
| 星尘币 `dust` | 通用软货币 / 重复转化 |
| 祈愿石 `wish_stone` | 卡池单抽 |
| 箱钥 `chest_key` | 开箱 |
| 机台币 `machine_coin` | 转盘 |

新人礼包 + 每日补给写入本地存档（云开发后同步 `users`）。

## 4. 保底模型

统一键：`pity:{openid}:{poolId}:{counter}`

- Soft pity：自 `softPityStart` 起每抽抬高目标稀有权重
- Hard pity：第 `hardPity` 抽必出
- 池间默认不继承

## 5. 信息架构

- Tab：概率馆 / 背包 / 记录 / 我的
- 场景页：公示入口 + 保底条 + 舞台 + 单抽/多抽
- 结果弹层：物品、新图鉴、再来一次

## 6. 后续波次（非本仓库 MVP）

见 IMA 全文 V1 / V1.5 / V2：UP 池、盲盒、扭蛋、刮刮乐、定轨、Bingo、对比台等。
