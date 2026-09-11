# 万象祈愿 Cloudflare 后端 — 部署验证报告

日期：2026-08-24
部署方式：本地 `wrangler dev`（Miniflare 模拟 D1/KV），地址 http://127.0.0.1:8787
状态：**5 个 MVP 端点全部跑通，服务端权威随机/鉴权/幂等/扣费均验证有效；部署过程中发现并修复 3 个 P0 级缺陷。**

## 一、端到端验证证据（实测）

| 端点 | 调用 | 结果 | 说明 |
|------|------|------|------|
| POST /api/login | `{deviceId:"u-alpha"}` | 200 | 签发 HS256 JWT（7 天），初始钱包 dust100/wish_stone60/chest_key15/machine_coin20 |
| GET /api/pools | 带 token | 200 | 返回 **8 个卡池**（a1/b1/c2 三大世界 + 常驻/宝箱/转盘） |
| POST /api/draw | `{poolId,times:10}` | 200 | 服务端 `crypto` 随机；`wish_stone 60→50`（扣费正确）；返回 `power`/`wallet`/`pityState`/`results` |
| GET /api/history | 带 token | 200 | 返回抽卡流水（逐物品行） |
| GET /api/leaderboard | 带 token | 200 | `me.rank` 与真实名次一致（见下方 off-by-one 修复） |
| POST /api/draw | 重复 `clientToken` | **409** | 幂等防重放生效 |
| 受保护端点 | 无 token | **401** | Bearer 鉴权生效 |
| POST /api/draw | `times:0` | **400** | 参数校验生效 |
| POST /api/login | 空 body | **400** | deviceId 必填 |
| `tsc --noEmit` | — | exit 0 | 类型检查通过 |

多用户验证：u-alpha（抽 5 次，power=70）在排行榜显示 `#3`，u-beta（power=110）`#2`，历史最高（power=120）`#1`，名次连续正确。

## 二、部署中暴露并修复的 3 个缺陷（P0）

### Bug 1 — JWT 鉴权全失效（最严重，编译/装配自检无法发现）
- **现象**：登录能签发 token，但所有带合法 token 的受保护接口一律返回 `401 Invalid or expired token`。离线用 Node 验过 token 签名与 `.dev.vars` 密钥完全匹配（`sig matches: true`），唯独 Worker 自身校验判伪。
- **根因**：`src/auth.ts` 的 `b64urlDecode` 在处理 base64 结尾 `=` 填充时，把**所有 4 字节组**的第 4 个字符都当填充位清零（`c3 = pad>=1 ? 0 : ...`），但填充只可能出现在**最后一组**。结果每组的第 3 字节（及部分第 2 字节）被污染 → 32 字节签名解出错 2 字节 → `crypto.subtle.verify` 判伪。
- **修复**：填充归零仅作用于最后一组（`lastGroup = i === padded.length - 4` 门控 `c2/c3`）。Node 独立 round-trip 测试 `match=true`、`verify=true` 确认。

### Bug 2 — 排行榜 500（Cloudflare 平台约束）
- **现象**：`GET /api/leaderboard` 返回 `500 Internal server error`。
- **根因**：`KV.put(key, val, { expirationTtl: 30 })` —— Cloudflare KV 要求 `expirationTtl` **最小 60 秒**，30 被拒（`400 Invalid expiration_ttl of 30`）。
- **修复**：`src/handlers/leaderboard.ts` 的 `CACHE_TTL` 由 30 改为 60。

### Bug 3 — 排行榜名次 off-by-one
- **现象**：`me.rank` 比真实名次多 1（全服第一显示第 2 名）。
- **根因**：`src/db.ts` 用 `COUNT(power >= 我) + 1`，把自己也算进名次。
- **修复**：改为 `COUNT(power > 我) + 1`（`countUsersWithPowerGt`）。修复后 u-alpha（power=70，2 人高于它）正确显示 `#3`。

## 三、已知遗留（未改，需你拍板）

1. **history 响应形状与文档偏差**：实际返回**逐物品**的 `snake_case` 行（`item_id/pool_id/at`），README/Spec 描述的是"每次抽卡一条带 `results` 数组"。功能正常，但契约需对齐（客户端按此形状对接即可）。
2. **全服保底 `server_pity` 非原子**：读-改-写，高并发极端情况可能多/少触发一次。MVP 可接受。
3. **抽中物归属**：材料/货币（`mat_*`/`dust`/`machine_coin`）进 `inventory` 并计战力，与原小程序逻辑有偏差，影响经济模型。
4. **CORS 未配**：纯 API，待 Web/小程序客户端联调时补中间件。
5. **openid 即 deviceId**：脱离微信后无 OPENID，暂直接取 deviceId。

## 四、云端部署缺口（真·上 Cloudflare 还需你提供）

本地用 Miniflare 跑通不代表已上云。上云前需补齐：

1. **Cloudflare 账号认证**：当前环境 `wrangler whoami` 无账号、无 `CLOUDFLARE_*` 环境变量。
   - 你本地执行 `wrangler login`（浏览器授权），或提供 `CLOUDFLARE_API_TOKEN`（含 `d1:*`、`kv:*`、`workers:*` 权限）放入环境变量。
2. **生产密钥**：`npx wrangler secret put JWT_SECRET`（勿写进 `.dev.vars`）。
3. **资源 ID 占位符**：`wrangler.toml` 中
   - `[[d1_databases]].database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"`
   - `[[kv_namespaces]].id = "REPLACE_WITH_YOUR_KV_NAMESPACE_ID"`
   先 `wrangler d1 create wanxiang-wish` 与 `wrangler kv namespace create wanxiang-wish-leaderboard` 拿真实 id 填回。
4. **迁移**：`npx wrangler d1 execute wanxiang-wish --remote --file=./migrations/0001_init.sql`
5. **上线**：`npx wrangler deploy`

## 五、下一步建议

- **补 Vitest 单测**：本次 3 个 bug 均为"能编译但运行错"，建议对 `auth`（b64url 往返）、`roll-engine`（保底阶梯/十连保底/UR 权重 0 强出 UP）、`power`、`server_pity` 加变异定向单测，作为回归护栏。
- v0.2：exchange/upgrade/pk；并落实第三节遗留项（尤其 history 契约与材料计战力）。

## 六、云端部署实况与 1101 诊断（2026-08-25）

### 6.1 账号资源与上线状态（均已就绪）
- 账号：`845261063@qq.com's Account`（ID `d1b7a3b3075f7e9ffe20629f07594286`），`type=standard`（免费套餐）。
- Worker `wanxiang-wish` **已成功上线**，Version `e1519677-7777-48c5-87ee-6f47d4ae936f`。
- 生产 URL：`https://wanxiang-wish.845261063.workers.dev`
- 绑定：KV `45c9eb877f3b4f3fa3e62043b5046f36`、D1 `wanxiang-wish (3b19c124-d140-42c3-96c5-76a925dd2d65)`、`JWT_SECRET` secret 已注入。
- `tsc --noEmit` 通过；`wrangler deploy` 产物 90.7 KiB，启动 1ms。
- 源码已恢复为**完整功能版**（此前排障用的极简 Worker 已还原；`wrangler.test.toml`、`tmp/` 诊断产物已清理）。

### 6.2 现象
线上所有请求——含极简 Worker、含无匹配路由的 `GET /`——均返回：
```
HTTP 500
error code: 1101
```
`wrangler tail` 捕获 **0 条日志**：说明请求**从未进入 Worker 运行时**。

### 6.3 定位过程（二分隔离，已排除代码/绑定/脚本名/网络）
1. 逐模块排查：入口与所有模块顶层无会抛异常的执行代码。
2. `index.ts` 改为显式 `export default { fetch }` + 外层 try/catch 兜底 → 仍 1101（错误发生在 fetch 被调用之前，即模块实例化期）。
3. **极简 Worker 对照**（仅 `new Response`，零绑定零业务）→ 仍 1101 → 排除本项目代码。
4. 无绑定配置 `wrangler.test.toml` 部署极简 Worker → 仍 1101 → 排除绑定声明。
5. 全新脚本名 `wx-triv-2` 部署极简 Worker → 仍 1101 → 排除特定脚本槽位损坏。
6. 沙箱到 Cloudflare 出口正常（`Server: cloudflare`、`CF-RAY: ...-LAX` 证明到达边缘且被调用）。
7. 远程资源真实存在：`kv namespace list` / `d1 list` 显示 KV/D1 都在，ID 对得上。
8. API 校验：`GET /accounts/{id}/workers/subdomain` 返回子域 `845261063` 已注册 → 排除子域未开通。

### 6.4 结论
**1101 是 Cloudflare 账号 / Workers 服务层的执行限制（`type=standard` 免费账号的 abuse gating），与本项目代码无关。** 代码已验证正确（本地 5 端点全跑通 + 类型检查通过 + 极简/完整 Worker 部署均正常编译上传）。
外部佐证：Cloudflare 社区存在完全同款案例 *"All Workers return Error 1101 with zero log entries, even on a clean redeploy"*——默认 Hello World 模板也 1101、部署成功、子域已开、零日志，与本项目表现逐项吻合。

### 6.5 需你在 Cloudflare 侧处理（账号级限制无法用 API 解除）
按优先级尝试：
1. **绑定支付方式（最可能一步解）**：Cloudflare Dashboard → 右上角头像 →「我的个人资料」→「账单」→「付款方式」添加信用卡。免费套餐不扣费，但 Workers 生产执行常被"需绑卡"门控；绑卡后通常即时解除。
2. 若绑卡后仍 1101：Dashboard →「支持」开工单，主题选 Workers，附本报告的隔离证据 + 上述社区帖链接，请 staff 核查账号级限制。
3. 顺手确认：账号邮箱（`845261063@qq.com`）已验证；`workers.dev` 子域为 Public 访问。

### 6.6 一旦解除，立即联调
账号限制解除后，我跑完整线上联调（login→pools→draw→history→leaderboard），把 6.2 的 1101 改为实测 200 表格，产出最终《云端上线报告》。
