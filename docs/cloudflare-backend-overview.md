# 万象祈愿 Cloudflare 后端 - 交付概览

> 日期：2026-08-24 | 路线：脱离微信小程序，Cloudflare Workers + D1 + KV + TypeScript(Hono)
> 范围：MVP 核心 5 端点（登录/抽卡/保底/历史/排行榜），纯后端 API

## 交付物（目录 `cloudflare/`）

| 文件 | 作用 |
|------|------|
| wrangler.toml | 部署配置，已绑定 D1(库名 wanxiang-wish) + KV(排行榜缓存) |
| package.json / tsconfig.json | 依赖与 TS strict 配置 |
| .dev.vars.example | 本地密钥模板（填 JWT_SECRET） |
| migrations/0001_init.sql | 四张表：users / server_pity / draw_tokens / history |
| src/index.ts | 入口，仅装配路由与中间件 |
| src/auth.ts | JWT HS256（Web Crypto，无 Node crypto 依赖） |
| src/db.ts | D1 仓储层，SQL 只在此处 |
| src/roll-engine.ts | 抽卡/保底/权重引擎，已换 crypto 随机源 |
| src/power.ts | 战力/升星/碎片公式 |
| src/pools.ts + src/pools/*.json | 8 个卡池配置，原样移植 |
| src/middleware/auth.ts | Bearer 校验，缺/错/过期 401 |
| src/handlers/{login,getPool,draw,history,leaderboard}.ts | 各端点 |
| src/services/draw.ts | 抽卡事务编排（服务端权威） |
| README.md | 本地运行与部署步骤 |

## 端点

| Method | Path | 认证 | 说明 |
|--------|------|------|------|
| POST | /api/login | 否 | deviceId 换 JWT（7d） |
| GET | /api/pools | 是 | 卡池列表 |
| GET | /api/pools/:poolId | 是 | 卡池详情 |
| POST | /api/draw | 是 | 抽卡，服务端权威随机 + 保底 |
| GET | /api/history | 是 | 抽卡历史分页 |
| GET | /api/leaderboard | 是 | 我的排名 + 前 50 |

## 本地运行

```bash
cd cloudflare
npm install
cp .dev.vars.example .dev.vars        # 填写 JWT_SECRET（openssl rand -hex 32）
npx wrangler d1 create wanxiang-wish   # 把 database_id 填进 wrangler.toml
npx wrangler d1 execute wanxiang-wish --local --file=./migrations/0001_init.sql
npx wrangler kv namespace create wanxiang-wish-leaderboard  # 把 id 填进 wrangler.toml
npx wrangler dev                       # http://localhost:8787
```

验证：
```bash
TOKEN=$(curl -s -X POST localhost:8787/api/login -H 'Content-Type: application/json' \
  -d '{"deviceId":"dev-001","nickname":"测试"}' | python -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
curl -s -X POST localhost:8787/api/draw -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"poolId":"a1_genshin_v1","times":10}'
```

## 待用户确认项（v0.2 处理）

1. **排行榜排名 off-by-one**：`db.ts:198` 改为 `COUNT(power > ?)+1`，第一名为第 1 名。
2. **抽中物归属**：原逻辑材料/货币进 wallet、重复转 fragments；本版进 inventory 并计战力，需对齐经济模型。
3. **server_pity 原子化**：读改写改事务/原子自增，消除并发边界。
4. **openid 规范化**：deviceId 是否哈希后存储。
5. **CORS**：客户端联调时按前端域名补中间件。

## 质量门禁

- emoji 扫描：clean（src 无 emoji）
- 编译/装配：tsc + dry-run 均 EXIT=0
- 代码组织：分层 routes→handlers→services→db，单文件 ≤300 行
- 验收（AC-01~06）：登录/抽卡/货币不足/防重放/排行榜/401 已实现
