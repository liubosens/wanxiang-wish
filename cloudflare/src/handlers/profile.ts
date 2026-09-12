import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { getUser, saveUser, findOtherUserByNickname } from '../db';

const LEADERBOARD_CACHE_KEY = 'leaderboard:top50';
const NICK_MAX = 12;
const AVATAR_MAX = 8;

// 预设头像与前端保持一致；只接受白名单，避免任意字符串注入到排行榜渲染。
export const ALLOWED_AVATARS = [
  '😀', '😎', '🤡', '👑', '🐉', '🦊', '🐼', '🚀',
  '⚔️', '🔥', '🌟', '🎲', '🍀', '🐟', '🎯', '🦄',
];

// 去掉控制字符、压缩连续空白并裁掉首尾空白。
function sanitizeNickname(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// POST /api/profile - 修改昵称 / 头像（服务端持久化，排行榜立即生效）。
export async function profileHandler(c: Context<AppEnv>) {
  const openid = c.get('openid');
  const body = await c.req
    .json<{ nickname?: unknown; avatar?: unknown }>()
    .catch(() => null);
  if (!body) return c.json({ message: '请求体格式不正确' }, 400);

  const user = await getUser(c.env.DB, openid);
  if (!user) return c.json({ message: 'User not initialized' }, 401);

  let changed = false;

  if (body.nickname !== undefined) {
    if (typeof body.nickname !== 'string') return c.json({ message: '昵称格式不正确' }, 400);
    const name = sanitizeNickname(body.nickname);
    if (name.length === 0) return c.json({ message: '昵称不能为空' }, 400);
    if ([...name].length > NICK_MAX) return c.json({ message: `昵称最多 ${NICK_MAX} 个字` }, 400);
    if (name !== user.nick_name) {
      const taken = await findOtherUserByNickname(c.env.DB, name, openid);
      if (taken) return c.json({ message: '该昵称已被占用，换一个吧' }, 409);
      user.nick_name = name;
      changed = true;
    }
  }

  if (body.avatar !== undefined) {
    if (typeof body.avatar !== 'string') return c.json({ message: '头像格式不正确' }, 400);
    const av = body.avatar.trim();
    if (av.length > AVATAR_MAX) return c.json({ message: '头像过长' }, 400);
    if (!ALLOWED_AVATARS.includes(av)) return c.json({ message: '请从预设头像中选择' }, 400);
    if (av !== user.avatar) {
      user.avatar = av;
      changed = true;
    }
  }

  if (!changed) return c.json({ user });

  user.updated_at = Date.now();
  await saveUser(c.env.DB, user);
  // 排行榜快照含昵称/头像，改动后立即失效，避免 TTL 内仍看到旧值。
  await c.env.KV.delete(LEADERBOARD_CACHE_KEY).catch(() => {});
  return c.json({ user });
}
