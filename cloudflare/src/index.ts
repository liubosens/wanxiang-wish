import { Hono } from 'hono';
import type { AppEnv } from './types';
import { corsMiddleware } from './middleware/cors';
import { authMiddleware } from './middleware/auth';
import { loginHandler } from './handlers/login';
import { meHandler } from './handlers/me';
import { listPoolsHandler, getPoolHandler } from './handlers/getPool';
import { drawHandler } from './handlers/draw';
import { historyHandler } from './handlers/history';
import { leaderboardHandler } from './handlers/leaderboard';
import { exchangeHandler } from './handlers/exchange';
import { upgradeHandler } from './handlers/upgrade';
import { pkHandler } from './handlers/pk';
import { profileHandler } from './handlers/profile';
import { dailyHandler } from './handlers/daily';
import { accountHandler } from './handlers/account';
import { bondsHandler } from './handlers/bonds';
import { listQuestsHandler, claimQuestHandler } from './handlers/quests';
import { getTowerHandler, challengeTowerHandler, sweepTowerHandler } from './handlers/tower';
import { listEventsHandler } from './handlers/events';

// 万象祈愿 服务端权威后端入口。
// 抽卡概率 / 保底 / 战力全部在服务端计算，客户端不可信。
const app = new Hono<AppEnv>();

// 跨域（H5 / Capacitor WebView 与服务端不同源）；OPTIONS 预检在此直接收掉。
app.use('*', corsMiddleware);

// 登录/注册（无微信依赖）：以 deviceId 定位或创建用户并签发 HS256 JWT。
app.post('/api/login', loginHandler);

// 以下端点受保护：Bearer JWT 校验通过后才执行。
app.get('/api/me', authMiddleware, meHandler);
app.get('/api/pools', authMiddleware, listPoolsHandler);
app.get('/api/pools/:poolId', authMiddleware, getPoolHandler);
app.post('/api/draw', authMiddleware, drawHandler);
app.get('/api/history', authMiddleware, historyHandler);
app.get('/api/leaderboard', authMiddleware, leaderboardHandler);
app.post('/api/exchange', authMiddleware, exchangeHandler);
app.post('/api/upgrade', authMiddleware, upgradeHandler);
app.post('/api/pk', authMiddleware, pkHandler);
app.get('/api/bonds', authMiddleware, bondsHandler);
app.get('/api/quests', authMiddleware, listQuestsHandler);
app.post('/api/quests/claim', authMiddleware, claimQuestHandler);
app.get('/api/tower', authMiddleware, getTowerHandler);
app.post('/api/tower/challenge', authMiddleware, challengeTowerHandler);
app.post('/api/tower/sweep', authMiddleware, sweepTowerHandler);
app.get('/api/events', authMiddleware, listEventsHandler);

// 账号系统：改昵称/头像、每日签到、注销。
app.post('/api/profile', authMiddleware, profileHandler);
app.post('/api/daily', authMiddleware, dailyHandler);
app.delete('/api/account', authMiddleware, accountHandler);

// 兜底：未捕获异常统一序列化为 JSON 500，避免泄露堆栈。
app.onError((err, c) => {
  console.error('unhandled error', err);
  return c.json({ message: 'Internal server error' }, 500);
});

export default app;
