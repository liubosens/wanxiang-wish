# 万象祈愿 后端（Cloudflare Workers）

跨 IP 抽卡收集游戏的服务端权威后端。技术栈：**Cloudflare Workers + D1 + KV + Hono + TypeScript**。

抽卡概率、保底计数、战力计算全部在服务端完成，客户端不可信，杜绝改包刷货。已脱离微信小程序依赖。

## 目录结构

```
cloudflare/
  wrangler.toml          # 绑定 D1 / KV，占位 database_id / kv id 需替换
  package.json
  tsconfig.json
  .dev.vars.example      # 本地环境变量样例（复制为 .dev.vars 填写 JWT_SECRET）
  migrations/0001_init.sql
  src/
    index.ts             # 入口：Hono 路由装配 + 中间件
    auth.ts              # JWT 签发/校验（Web Crypto HS256）
    db.ts                # D1 仓储层（所有 SQL 在此）
    roll-engine.ts       # 抽卡/保底/权重（移植，crypto.getRandomValues 随机）
    power.ts             # 战力/升星/碎片公式（移植）
    pools.ts             # 聚合 src/pools/*.json 为 Map
    pools/*.json         # 8 个卡池配置（原样移植）
    middleware/auth.ts   # Bearer JWT 校验
    handlers/            # 各端点的 HTTP 适配层
    services/draw.ts     # 抽卡事务编排（业务逻辑）
```

分层：`routes(index) -> handlers(HTTP 适配) -> services(业务编排) -> db/repositories(D1)`。单文件均 ≤300 行，入口零业务。

## API 端点

| Method | Path | 认证 | 说明 |
|--------|------|------|------|
| POST | /api/login | 否 | `{deviceId, nickname?}` -> `{token, user}` |
| GET | /api/pools | 是 | 卡池列表 `{pools:[...]}` |
| GET | /api/pools/:poolId | 是 | 卡池完整配置 JSON |
| POST | /api/draw | 是 | `{poolId, times(1-10), clientToken?}` -> `{results, pityState, wallet, power, serverPityTriggered}` |
| GET | /api/history | 是 | `?limit=` 抽卡历史（默认 50，上限 100）-> `{rows}` |
| GET | /api/leaderboard | 是 | `{me:{rank,power}, rows:[...]}` |

受保护端点必须带 `Authorization: Bearer <jwt>`，缺失/错误/过期返回 401。

## 本地运行

```bash
cd cloudflare

# 1. 安装依赖
npm install

# 2. 配置密钥（本地）
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars，把 JWT_SECRET 替换为足够长的随机串：
#   openssl rand -hex 32

# 3. 创建并初始化 D1（第一次）
npx wrangler d1 create wanxiang-wish
# 把输出的 database_id 填进 wrangler.toml 的 [[d1_databases]].database_id
npx wrangler d1 execute wanxiang-wish --local --file=./migrations/0001_init.sql

# 4. 创建 KV 命名空间（排行榜缓存，第一次）
npx wrangler kv namespace create wanxiang-wish-leaderboard
# 把输出的 id 填进 wrangler.toml 的 [[kv_namespaces]].id

# 5. 启动本地开发服务
npx wrangler dev
```

本地默认地址 `http://localhost:8787`。

### 云端部署

```bash
npx wrangler secret put JWT_SECRET      # 生产密钥，勿写进 .dev.vars
npx wrangler d1 execute wanxiang-wish --remote --file=./migrations/0001_init.sql
npx wrangler deploy
```

## 端到端验证

```bash
# 登录
curl -X POST localhost:8787/api/login \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"dev-001","nickname":"测试"}'

# 用返回的 token 抽卡
curl -X POST localhost:8787/api/draw \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"poolId":"a1_genshin_v1","times":10}'

# 卡池列表 / 详情
curl localhost:8787/api/pools -H 'Authorization: Bearer <token>'
curl localhost:8787/api/pools/a1_genshin_v1 -H 'Authorization: Bearer <token>'

# 历史 / 排行榜
curl localhost:8787/api/history -H 'Authorization: Bearer <token>'
curl localhost:8787/api/leaderboard -H 'Authorization: Bearer <token>'
```

## 关键设计点

- **服务端权威随机**：`roll-engine.ts` 的 `createRng()` 在无种子时使用 `crypto.getRandomValues` 派生 `[0,1)` 随机源，完全取代 `Math.random()`。保底（`users.pity`）与全服保底（`server_pity`）均服务端读写。
- **幂等防重放**：`POST /api/draw` 携带 `clientToken` 时，重复提交（已存在于 `draw_tokens`）返回 409。
- **货币不足保护**：扣费前校验余额，不足返回 400，不扣减、不写历史。
- **排行榜缓存**：全局 top50 写入 KV（TTL 60s，Cloudflare KV 要求 `expirationTtl` 最小 60）；个人排名每次实时计算。
- **统一响应**：成功按上表各自形状返回；错误返回 `{message}` 加对应 HTTP 状态码（400/401/404/409/500）。

## 待确认项（未自行脑补，需产品/架构确认）

1. **排行榜排名口径**：[已修复 2026-08-24] 原 `rank = count(power >= 我) + 1` 会把自己也算进名次（全服第一显示第 2 名）。已改为 `rank = count(power > 我) + 1`（`db.countUsersWithPowerGt`），现全服第一正确显示第 1 名。
2. **全服保底并发安全**：`server_pity` 目前为读-改-写，非原子事务。Workers 高并发下极端情况可能多/少触发一次。MVP 可接受；若需严格精确需引入 D1 事务或原子计数器。
3. **库存/战力是否收纳材料与货币**：当前所有抽中物（含 B1 宝箱材料 `mat_*`、C2 转盘货币 `dust`/`machine_coin` 等）均进入 `inventory` 并参与 `power` 计算（忠实于原数据模型：inventory/codex 即 JSON 文本）。若材料/货币不应计入战力，需在 v0.2（升级/兑换落地时）明确过滤规则。
4. **`draw` handler 无既有移植源**：Spec 未提供 `cloudfunctions/draw/index.js`，该端点逻辑依据 Spec 第 5/8/9 节与 `roll-engine`/`power`/`db` 自行合成，已覆盖 AC-02~AC-04。
5. **无 sceneType 字段的池子**：`a1_genshin_v1`、`b1_sangokushi_v1`、`c2_wangzhe_v1` 在原始 JSON 中未写 `sceneType`，由 `roll-engine` 默认稀有度分支处理（与原始逻辑一致）。
6. **openid 即 deviceId**：以 `deviceId` 直接作为用户主键 `openid`（脱离微信后无 OPENID）。若需规范化/哈希可后续调整。
7. **CORS**：本后端为纯 API，未配置跨域头。待 Web/小程序客户端联调时按前端域名补 `cors` 中间件。
