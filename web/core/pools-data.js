// 自动生成，请勿手改 —— 由 web/tools/build-pools.mjs 从
// miniprogram/configs/pools/*.json 生成。改卡池请改源 JSON 后重跑脚本。
export const POOLS = {
  "a1_genshin_v1": {
  "poolId": "a1_genshin_v1",
  "name": "原神·星轨祈愿",
  "presentation": "banner",
  "cost": { "itemId": "wish_stone", "amount": 1 },
  "multi": { "tenGuaranteeRarity": "SR" },
  "rarities": [
    { "id": "R", "weight": 940 },
    { "id": "SR", "weight": 51, "softPityStart": 74, "softPityStep": 60, "hardPity": 90 },
    { "id": "UR", "weight": 9, "softPityStart": 74, "softPityStep": 600, "hardPity": 90 }
  ],
  "up": {
    "enabled": true,
    "rarity": "UR",
    "loseStreakKey": "up_lose",
    "maxLoseThenGuaranteed": 1,
    "ssrUpRate": 0.5,
    "itemIds": ["genshin_raiden"]
  },
  "lootTables": {
    "R": [
      { "itemId": "genshin_ying", "name": "荧", "weight": 1 },
      { "itemId": "genshin_kong", "name": "空", "weight": 1 },
      { "itemId": "genshin_wendy", "name": "温迪", "weight": 1 },
      { "itemId": "genshin_xiao", "name": "魈", "weight": 1 },
      { "itemId": "genshin_mao", "name": "枫原万叶", "weight": 1 },
      { "itemId": "genshin_ti", "name": "提瓦特", "weight": 1 }
    ],
    "SR": [
      { "itemId": "genshin_hutao", "name": "胡桃", "weight": 1 },
      { "itemId": "genshin_ganyu", "name": "甘雨", "weight": 1 },
      { "itemId": "genshin_ayaka", "name": "神里绫华", "weight": 1 },
      { "itemId": "genshin_nahida", "name": "纳西妲", "weight": 1 }
    ],
    "UR": [
      { "itemId": "genshin_raiden", "name": "雷电将军", "weight": 50 },
      { "itemId": "genshin_zhongli", "name": "钟离", "weight": 50 }
    ]
  },
  "ratePublic": {
    "notes": [
      "五星(UR)基础概率约 0.9%，74 抽起软保底递增，90 抽硬保底。",
      "小保底 50% 出 UP，歪则大保底 100% 出 UP。"
    ]
  }
},
  "a1_standard_v1": {
  "poolId": "a1_standard_v1",
  "name": "星尘常驻祈愿",
  "sceneType": "A1",
  "presentation": "banner_card",
  "cost": { "itemId": "wish_stone", "amount": 1 },
  "multi": { "ten": true, "tenCost": 10, "tenGuaranteeRarity": "SR" },
  "rarities": [
    { "id": "SSR", "weight": 60, "softPityStart": 74, "softPityStep": 600, "hardPity": 90 },
    { "id": "SR", "weight": 510, "hardPity": 10 },
    { "id": "R", "weight": 9430 }
  ],
  "up": { "enabled": false },
  "lootTables": {
    "SSR": [
      { "itemId": "ssr_nova", "name": "新星祈使", "weight": 1 },
      { "itemId": "ssr_eclipse", "name": "蚀月旅人", "weight": 1 }
    ],
    "SR": [
      { "itemId": "sr_comet", "name": "彗星信使", "weight": 1 },
      { "itemId": "sr_aurora", "name": "极光侍从", "weight": 1 },
      { "itemId": "sr_meteor", "name": "流星剑士", "weight": 1 }
    ],
    "R": [
      { "itemId": "r_dustling", "name": "星尘精灵", "weight": 3 },
      { "itemId": "r_pebble", "name": "碎星石", "weight": 3 },
      { "itemId": "r_candle", "name": "微光烛", "weight": 2 }
    ]
  },
  "ratePublic": {
    "SSR": "0.6%",
    "SR": "5.1%",
    "R": "94.3%",
    "notes": [
      "SSR 软保底自第 74 抽起逐步提升，第 90 抽硬保底。",
      "SR 最多 10 抽必出。",
      "十连至少含 1 个 SR 或以上。"
    ]
  }
},
  "b1_copper_v1": {
  "poolId": "b1_copper_v1",
  "name": "铜宝箱",
  "sceneType": "B1",
  "presentation": "chest",
  "chestTier": "copper",
  "cost": { "itemId": "chest_key", "amount": 1 },
  "lootTables": {
    "copper": [
      { "itemId": "mat_wood", "name": "星木", "rarity": "R", "weight": 60 },
      { "itemId": "mat_iron", "name": "陨铁", "rarity": "R", "weight": 30 },
      { "itemId": "mat_shard_sr", "name": "SR 碎片", "rarity": "SR", "weight": 10 }
    ]
  },
  "ratePublic": {
    "notes": ["铜箱：常见材料为主，小概率 SR 碎片。"]
  }
},
  "b1_gold_v1": {
  "poolId": "b1_gold_v1",
  "name": "金宝箱",
  "sceneType": "B1",
  "presentation": "chest",
  "chestTier": "gold",
  "cost": { "itemId": "chest_key", "amount": 10 },
  "lootTables": {
    "gold": [
      { "itemId": "mat_shard_sr", "name": "SR 碎片×5", "rarity": "SR", "weight": 50 },
      { "itemId": "mat_shard_ssr", "name": "SSR 碎片×2", "rarity": "SSR", "weight": 35 },
      { "itemId": "ssr_nova", "name": "新星祈使（完整）", "rarity": "SSR", "weight": 15 }
    ]
  },
  "ratePublic": {
    "notes": ["金箱：高价值碎片，小概率完整 SSR。"]
  }
},
  "b1_sangokushi_v1": {
  "poolId": "b1_sangokushi_v1",
  "name": "三国杀·全服博弈",
  "presentation": "chest",
  "cost": { "itemId": "chest_key", "amount": 1 },
  "multi": { "tenGuaranteeRarity": "SR" },
  "rarities": [
    { "id": "R", "weight": 940 },
    { "id": "SR", "weight": 60, "softPityStart": 74, "softPityStep": 60, "hardPity": 90 },
    { "id": "UR", "weight": 0 }
  ],
  "serverPity": { "enabled": true, "threshold": 80, "rewardRarity": "UR" },
  "lootTables": {
    "R": [
      { "itemId": "sg_liubei", "name": "刘备", "weight": 1 },
      { "itemId": "sg_sunquan", "name": "孙权", "weight": 1 },
      { "itemId": "sg_simayi", "name": "司马懿", "weight": 1 },
      { "itemId": "sg_zhaoyun", "name": "赵云", "weight": 1 },
      { "itemId": "sg_zhangfei", "name": "张飞", "weight": 1 },
      { "itemId": "sg_huang", "name": "黄月英", "weight": 1 }
    ],
    "SR": [
      { "itemId": "sg_caocao", "name": "曹操", "weight": 1 },
      { "itemId": "sg_zhugeliang", "name": "诸葛亮", "weight": 1 },
      { "itemId": "sg_zhouyu", "name": "周瑜", "weight": 1 },
      { "itemId": "sg_guanyu", "name": "关羽", "weight": 1 }
    ],
    "UR": [
      { "itemId": "sg_lvbu", "name": "吕布", "weight": 50 },
      { "itemId": "sg_zuoci", "name": "左慈", "weight": 50 }
    ]
  },
  "ratePublic": {
    "notes": [
      "常规仅出 R/SR。",
      "UR 由全服累积保底触发：全服抽数达阈值后下一次必出 UR 并清零（实现中）。"
    ]
  }
},
  "b1_silver_v1": {
  "poolId": "b1_silver_v1",
  "name": "银宝箱",
  "sceneType": "B1",
  "presentation": "chest",
  "chestTier": "silver",
  "cost": { "itemId": "chest_key", "amount": 3 },
  "lootTables": {
    "silver": [
      { "itemId": "mat_iron", "name": "陨铁", "rarity": "R", "weight": 40 },
      { "itemId": "mat_shard_sr", "name": "SR 碎片", "rarity": "SR", "weight": 45 },
      { "itemId": "mat_shard_ssr", "name": "SSR 碎片", "rarity": "SSR", "weight": 15 }
    ]
  },
  "ratePublic": {
    "notes": ["银箱：提高 SR/SSR 碎片权重。"]
  }
},
  "c2_roulette_v1": {
  "poolId": "c2_roulette_v1",
  "name": "星轨转盘",
  "sceneType": "C2",
  "presentation": "roulette",
  "cost": { "itemId": "machine_coin", "amount": 1 },
  "sectors": [
    { "id": "s1", "itemId": "wish_stone", "name": "祈愿石×1", "rarity": "R", "weight": 30 },
    { "id": "s2", "itemId": "chest_key", "name": "箱钥×1", "rarity": "R", "weight": 25 },
    { "id": "s3", "itemId": "dust", "name": "星尘币×50", "rarity": "R", "weight": 20 },
    { "id": "s4", "itemId": "mat_shard_sr", "name": "SR 碎片", "rarity": "SR", "weight": 15 },
    { "id": "s5", "itemId": "machine_coin", "name": "机台币×2", "rarity": "R", "weight": 8 },
    { "id": "s6", "itemId": "ssr_eclipse", "name": "蚀月旅人", "rarity": "SSR", "weight": 2 }
  ],
  "ratePublic": {
    "notes": [
      "转盘按扇区权重抽取。",
      "SSR 扇区展示权重约 2%。"
    ]
  }
},
  "c2_wangzhe_v1": {
  "poolId": "c2_wangzhe_v1",
  "name": "王者·荣耀积攒",
  "presentation": "machine",
  "cost": { "itemId": "machine_coin", "amount": 1 },
  "pointsPerDraw": 1,
  "exchange": { "itemId": "wz_wuze", "name": "武则天", "cost": 30 },
  "rarities": [
    { "id": "R", "weight": 730 },
    { "id": "SR", "weight": 270 }
  ],
  "lootTables": {
    "R": [
      { "itemId": "wz_hanxin", "name": "韩信", "weight": 1 },
      { "itemId": "wz_luban", "name": "鲁班七号", "weight": 1 },
      { "itemId": "wz_yingzheng", "name": "嬴政", "weight": 1 },
      { "itemId": "wz_luona", "name": "露娜", "weight": 1 },
      { "itemId": "wz_houyi", "name": "后羿", "weight": 1 },
      { "itemId": "wz_daji", "name": "妲己", "weight": 1 }
    ],
    "SR": [
      { "itemId": "wz_libai", "name": "李白", "weight": 1 },
      { "itemId": "wz_diaochan", "name": "貂蝉", "weight": 1 },
      { "itemId": "wz_hualan", "name": "花木兰", "weight": 1 },
      { "itemId": "wz_gongsun", "name": "公孙离", "weight": 1 },
      { "itemId": "wz_dianwei", "name": "典韦", "weight": 1 }
    ]
  },
  "ratePublic": {
    "notes": [
      "常规仅出 R/SR。",
      "每抽积 1 荣耀积分，满 30 兑换指定 UR(武则天)（实现中）。"
    ]
  }
}
};

export default POOLS;
