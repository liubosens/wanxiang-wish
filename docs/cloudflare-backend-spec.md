# Spec - 万象祈愿 后端（Cloudflare Workers）v0.1

> 生成日期：2026-08-24
> 基于：现有 `cloudfunctions/` 抽卡逻辑（draw / getPool / login / history / leaderboard）
> 状态：已确认（Phase 0 范围已锁定）
> 路线：脱离微信小程序，改用 Cloudflare Workers + D1 + KV 免费栈

---

## 1. 产品定义

- 一句话描述：跨 IP 抽卡收集游戏的服务端权威后端，提供登录、抽卡（含保底）、抽卡历史、排行榜四类核心能力。
- 目标用户：万象祈愿的玩家（原微信小程序用户 + 未来 Web/跨平台客户端）。
- 核心问题：把抽卡概率、保底计数、战力计算放到服务端，客户端不可信，杜绝改包刷货。

## 2. MVP 范围（锁定）

| 优先级 | 功能 | 验收摘要 |
|--------|------|----------|
| P0 | 登录/注册 | 设备 ID 或昵称换 JWT，无微信依赖 |
| P0 | 抽卡 + 保底 | 服务端权威随机，保底/UP/十连保底齐全 |
| P0 | 卡池查询 | 列表 + 详情，返回池子配置 |
| P0 | 抽卡历史 | 按用户倒序分页 |
| P0 | 排行榜 | 我的排名 + 前 50 名快照 |

## 3. 明确不做（Out-of-Scope）

| 不做 | 原因 | 何时考虑 |
|------|------|----------|
| exchange / upgrade / pk | MVP 先跑通抽卡闭环 | v0.2 |
| R2 角色图托管与 CDN | MVP 纯后端，资源后续接 | 客户端联调时 |
| Web / 小程序客户端 | 本期只交付 API | 下一期 |
| OAuth 第三方登录 | 设备 ID 足够起步 | 用户增长后 |

## 4. 技术架构（锁定）

| 层 | 技术 | 版本/说明 |
|----|------|-----------|
| 运行 | Cloudflare Workers | wrangler 最新 |
| 路由 | Hono | 轻量，适配 Workers |
| 语言 | TypeScript | strict |
| 数据库 | Cloudflare D1 (SQLite) | 关系数据 + 排行 |
| 缓存 | Cloudflare KV | 排行榜 top50 缓存 |
| 认证 | JWT HS256 (Web Crypto) | 密钥走 `JWT_SECRET` 环境变量 |
| 随机 | `crypto.getRandomValues` | 禁用 `Math.random` |

## 5. API 端点清单（开发唯一依据）

| Method | Path | 功能 | 认证 | 请求体 | 响应 |
|--------|------|------|------|--------|------|
| POST | /api/login | 登录/注册 | 否 | `{deviceId, nickname?}` | `{token, user}` |
| GET | /api/pools | 卡池列表 | 是 | - | `{pools:[{poolId,name,sceneType,cost}]}` |
| GET | /api/pools/:poolId | 卡池详情 | 是 | - | 完整池子配置 JSON |
| POST | /api/draw | 抽卡 | 是 | `{poolId, times(1-10), clientToken?}` | `{results, pityState, wallet, power, serverPityTriggered}` |
| GET | /api/history | 抽卡历史 | 是 | `?limit=` | `{rows}` |
| GET | /api/leaderboard | 排行榜 | 是 | - | `{me:{rank,power}, rows:[{rank,id,name,power,isMe}]}` |

## 6. 数据库表清单（D1 / SQLite）

```sql
users(openid TEXT PK, nick_name TEXT, wallet TEXT, inventory TEXT, codex TEXT, pity TEXT, power INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER);
server_pity(pool_id TEXT PK, count INTEGER DEFAULT 0);
draw_tokens(token TEXT PK, openid TEXT, at INTEGER);
history(id INTEGER PRIMARY KEY AUTOINCREMENT, openid TEXT, pool_id TEXT, pool_name TEXT, item_id TEXT, name TEXT, rarity TEXT, at INTEGER);
```

- `wallet/inventory/codex/pity` 存 JSON 文本（沿用原结构）。
- 卡池配置不放 DB，移植自 `cloudfunctions/draw/pools/*.json`，随代码发布。

## 7. 认证方案

- `POST /api/login`：以 `deviceId` 定位/创建用户，签发 HS256 JWT（payload `{sub: openid, exp}`）。
- 受保护端点校验 `Authorization: Bearer <jwt>`，失败返 401。
- 密钥来自 `env.JWT_SECRET`，本地用 `.dev.vars`。

## 8. 服务端权威随机（强制）

- 移植 `roll-engine.js` 时，将 `createRng` 的 `Math.random()` 改为 `crypto.getRandomValues` 派生的 `[0,1)` 随机源。
- `server_pity`（全服累积保底）、`users.pity`（个人保底）均在服务端读写，客户端只传 `poolId/times/clientToken`。

## 9. 验收标准（EARS）

| 编号 | 功能 | 标准 |
|------|------|------|
| AC-01 | 登录 | When 收到合法 deviceId，系统必须创建/返回用户并签发 JWT |
| AC-02 | 抽卡 | While 已认证用户发起合法抽卡，系统必须用服务端随机计算结果并写库 |
| AC-03 | 抽卡 | If 货币不足，系统必须返回失败且不扣减、不写历史 |
| AC-04 | 重复防重放 | If 同一 clientToken 重复提交，系统必须拒绝第二次 |
| AC-05 | 排行榜 | When 请求排行榜，系统必须返回我的排名（≥我战力人数+1）与前 50 名 |
| AC-06 | 安全 | If 请求缺/错 JWT，系统必须返回 401 |

## 10. 目录结构约定（单文件 ≤300 行，分层）

```
cloudflare/
  wrangler.toml
  package.json
  tsconfig.json
  .dev.vars.example
  migrations/0001_init.sql
  src/
    index.ts            // 入口：Hono 装配路由 + 中间件
    auth.ts             // JWT 签发/校验 (Web Crypto)
    db.ts               // D1 初始化 + 迁移
    roll-engine.ts      // 移植自 cloudfunctions/draw/roll-engine.js (crypto 随机)
    power.ts            // 移植自 cloudfunctions/draw/power.js
    pools.ts            // 读取 pools/*.json
    pools/*.json        // 移植自 cloudfunctions/draw/pools/
    middleware/auth.ts  // Bearer 校验
    handlers/login.ts
    handlers/getPool.ts
    handlers/draw.ts
    handlers/history.ts
    handlers/leaderboard.ts
```

## 11. 移植源（不得偏离逻辑）

- `cloudfunctions/draw/roll-engine.js` → `src/roll-engine.ts`
- `cloudfunctions/draw/power.js` → `src/power.ts`
- `cloudfunctions/draw/pools/*.json` → `src/pools/*.json`
- `cloudfunctions/login|getPool|history|leaderboard/index.js` → 对应 `src/handlers/*.ts`
- 数据模型（users/server_pity/draw_tokens/history 字段）与原文一致。

## 12. 端到端验证

```bash
cd cloudflare
npm install
npx wrangler d1 execute wanxiang-wish --local --file=./migrations/0001_init.sql
npx wrangler dev
# 登录
curl -X POST localhost:8787/api/login -H 'Content-Type: application/json' -d '{"deviceId":"dev-001","nickname":"测试"}'
# 用返回的 token 抽卡
curl -X POST localhost:8787/api/draw -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' -d '{"poolId":"a1_genshin_v1","times":10}'
```
