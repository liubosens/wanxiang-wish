# 万象祈愿 · Wanxiang Wish

市面主流抽卡 / 开箱 / 概率玩法的集合馆小程序（MVP）。

统一账户与经济，场景彼此独立。默认定位：**概率博物馆 + 模拟币**。

## 文档

- [初版设计](./docs/DESIGN.md)
- [MVP 范围与验收](./docs/MVP.md)
- IMA 主设计稿 note_id：`7488926184924295`（标题：《万象祈愿》抽卡/概率场景集合 · 完整设计）

## MVP 场景

| ID | 场景 | 页面 |
|---|---|---|
| A1+A3 | 标准卡池 + soft/hard pity | `pages/scene-banner` |
| B1 | 分级宝箱（铜/银/金） | `pages/scene-chest` |
| C2 | 权重转盘 | `pages/scene-machine` |

共享：概率馆、背包图鉴、抽卡历史、概率公示、本地钱包。

## 技术栈

- 微信小程序原生
- 微信云开发（云函数 + 云数据库）；未开通时可走本地 Mock 掷骰

## 本地预览

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入本仓库根目录（或 `miniprogram` 目录，视 `project.config.json`）
3. 填写 `project.config.json` 中的 `appid`（可用测试号）
4. 未开通云开发时：`miniprogram/app.js` 中 `useCloud: false`，使用本地 Roll Engine
5. 开通云开发后：上传并部署 `cloudfunctions/*`，将 `useCloud` 设为 `true`

## 目录

```text
miniprogram/          # 小程序前端
cloudfunctions/       # draw / getPool / history / login
configs/pools/        # 卡池与机台配置（与云库同步的源文件）
docs/                 # 设计与 MVP 说明
shared/               # 前后端共用的掷骰核心（拷贝进云函数）
```

## License

MIT
