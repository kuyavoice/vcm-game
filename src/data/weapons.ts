// 武器（初期武器『宵星』＋共鳴アーツ13種）の定義。挙動は systems/arts.ts、ここは数値とテキストのみ。
// ゲーム内テキストは技の説明と軽い雰囲気づけに留める（本編の出来事には触れない）。

/** 全武器共通のパラメータ。各アーツは必要な項目だけ使う（意味は各アーツのコメント参照） */
export interface ArtStats {
  damage: number;
  intervalSec: number;
  /** 弾数・枚数・対象数 */
  count: number;
  /** 範囲・射程・半径（px） */
  area: number;
  /** 弾速・回転速度 */
  speed: number;
  /** 持続時間（秒） */
  duration: number;
  /** 貫通数（Infinity で無限） */
  pierce: number;
  /** ノックバック量 */
  knockback: number;
  /** 鈍化倍率（0.5 = 半分の速さ）。1 で鈍化なし */
  slow: number;
  /** 進化済み */
  evolved: boolean;
  /** 武器固有の追加値 */
  extra: Record<string, number>;
}

export type WeaponTag = 'melee' | 'projectile' | 'zone' | 'orbit' | 'support';

export interface WeaponLevelDef {
  desc: string;
  apply: (s: ArtStats) => void;
}

export interface EvolutionDef {
  /** 進化後の名前 */
  name: string;
  /** 必要なパッシブ（所持していればLvは問わない） */
  passiveId: string;
  desc: string;
  apply: (s: ArtStats) => void;
}

export interface WeaponDef {
  id: string;
  name: string;
  /** 使い手 */
  owner: string;
  desc: string;
  color: number;
  /** main = 初期武器（枠を使わない）／art = 共鳴アーツ（4枠） */
  kind: 'main' | 'art';
  /** 種別タグ：melee（近接）／projectile（投射）／zone（設置）／orbit（常駐）／support（補助） */
  tags: WeaponTag[];
  /** 合体アーツ（レベルアップの抽選・『物語の具現化』の対象外。宝箱の合体でのみ入手） */
  fusion?: boolean;
  maxLevel: number;
  base: ArtStats;
  /** Lv2以降の強化（index 0 = Lv1→2） */
  levels: WeaponLevelDef[];
  evolution?: EvolutionDef;
}

function stats(p: Partial<ArtStats>): ArtStats {
  return {
    damage: 10, intervalSec: 1, count: 1, area: 100, speed: 400, duration: 1,
    pierce: 0, knockback: 0, slow: 1, evolved: false, extra: {},
    ...p,
  };
}

const dmg = (pct: number): WeaponLevelDef => ({ desc: `ダメージ +${pct}%`, apply: (s) => { s.damage *= 1 + pct / 100; } });
const faster = (pct: number): WeaponLevelDef => ({ desc: `発動間隔 −${pct}%`, apply: (s) => { s.intervalSec *= 1 - pct / 100; } });
const more = (n: number, what: string): WeaponLevelDef => ({ desc: `${what} +${n}`, apply: (s) => { s.count += n; } });
const wider = (pct: number, what = '範囲'): WeaponLevelDef => ({ desc: `${what} +${pct}%`, apply: (s) => { s.area *= 1 + pct / 100; } });
const longer = (pct: number): WeaponLevelDef => ({ desc: `持続時間 +${pct}%`, apply: (s) => { s.duration *= 1 + pct / 100; } });

// ───────────────────────── 初期武器 ─────────────────────────

/** 『宵星』：area=斬撃範囲, speed=弾速, count=連射数, extra: shotDamage / slashArcDeg / shotRange */
export const YOISEI: WeaponDef = {
  id: 'yoisei', name: '宵星', owner: '宵月 空夜', kind: 'main', tags: ['melee', 'projectile'],
  desc: '片手剣とハンドガンを距離で自動切替。近くは斬り、遠くは撃つ。',
  color: 0x87ceeb, maxLevel: 8,
  base: stats({ damage: 12, intervalSec: 0.7, count: 1, area: 90, speed: 720, extra: { shotDamage: 8, slashArcDeg: 120, shotRange: 400 } }),
  levels: [
    { desc: 'ダメージ +25%', apply: (s) => { s.damage *= 1.25; s.extra.shotDamage *= 1.25; } },
    { desc: '射撃が2連射になる', apply: (s) => { s.count = 2; } },
    { desc: '斬撃の範囲 +30%', apply: (s) => { s.area *= 1.3; } },
    { desc: '攻撃間隔 −15%', apply: (s) => { s.intervalSec *= 0.85; } },
    { desc: 'ダメージ +25%', apply: (s) => { s.damage *= 1.25; s.extra.shotDamage *= 1.25; } },
    { desc: '斬撃の角度が広がる（120°→160°）', apply: (s) => { s.extra.slashArcDeg = 160; } },
    { desc: '『蒼天の連撃』：斬撃のあと至近三連射', apply: (s) => { s.evolved = true; s.count = 3; s.damage *= 1.2; } },
  ],
};

/** 『怜水閃』（瑞穂）：最寄りの敵へ細く長い水圧の突き。全貫通。count=連射数 */
export const REISUISEN: WeaponDef = {
  id: 'reisuisen', name: '怜水閃', owner: '月怜 瑞穂', kind: 'main', tags: ['projectile'],
  desc: '最寄りの敵へ水圧の突きを放つ。細く長い直線で、すべてを貫く。',
  color: 0x87cefa, maxLevel: 8,
  base: stats({ damage: 14, intervalSec: 0.9, count: 1, area: 450, speed: 1500, pierce: Infinity }),
  levels: [
    dmg(25), faster(12), { desc: '2連射になる', apply: (s) => { s.count = 2; } }, wider(20, '射程'),
    dmg(25), faster(12),
    { desc: '『怜水閃・五月雨』：細い貫通突きを5連射', apply: (s) => { s.evolved = true; s.count = 5; s.damage *= 0.85; } },
  ],
};

/** 大剣（雪人）：最後に移動した方向へ180°・半径110pxの薙ぎ払い。強ノックバック */
export const GREATSWORD: WeaponDef = {
  id: 'greatsword', name: '大剣', owner: '狐森 雪人', kind: 'main', tags: ['melee'],
  desc: '進む方向へ大剣を薙ぎ払う。半円の範囲を強く弾き飛ばす。',
  color: 0xe8f4ff, maxLevel: 8,
  base: stats({ damage: 30, intervalSec: 1.3, area: 110, knockback: 320, extra: { arcDeg: 180, waveDamage: 25, waveRange: 400 } }),
  levels: [
    dmg(25), wider(15), faster(10), dmg(25), wider(15), faster(10),
    { desc: '『アクセル・レイド』：薙ぎ払いの後、前方へ衝撃波が走る', apply: (s) => { s.evolved = true; s.damage *= 1.15; } },
  ],
};

/** 『焔の猟犬』（律花）：炎の玉が敵を追い、当たると小爆発。count=猟犬の数, extra.blastRadius/blastDamage */
export const FLAMEHOUND: WeaponDef = {
  id: 'flamehound', name: '焔の猟犬', owner: '寿 律花', kind: 'main', tags: ['projectile'],
  desc: '炎の玉が敵を追いかけ、当たると小さく爆ぜる。',
  color: 0xff4500, maxLevel: 8,
  base: stats({ damage: 10, intervalSec: 1.2, count: 2, speed: 380, duration: 3, extra: { blastRadius: 40, blastDamage: 6, maxHounds: 12 } }),
  levels: [
    more(1, '猟犬の数'), dmg(25), { desc: '爆発の範囲 +30%', apply: (s) => { s.extra.blastRadius *= 1.3; } },
    faster(10), more(1, '猟犬の数'), dmg(25),
    { desc: '『焔の大狩猟』：猟犬6匹が群れで駆け回り、敵を倒すたび新しい猟犬が生まれる（最大12）', apply: (s) => { s.evolved = true; s.count = 6; s.duration = 6; s.speed *= 1.15; } },
  ],
};

// ───────────────────────── 共鳴アーツ ─────────────────────────

/** 『紅蓮の矢』：前方へ遠くまで飛ぶ貫通する火矢。count=本数, area=射程, pierce=貫通 */
const GUREN: WeaponDef = {
  id: 'guren', name: '紅蓮の矢', owner: '寿 律花', kind: 'art', tags: ['projectile'],
  desc: '向いている方向へ、貫通する火矢を放つ。',
  color: 0xff4500, maxLevel: 8,
  base: stats({ damage: 14, intervalSec: 1.1, count: 1, area: 900, speed: 900, pierce: 2 }),
  levels: [more(1, '矢の本数'), dmg(30), { desc: '貫通 +2', apply: (s) => { s.pierce += 2; } }, faster(15), more(1, '矢の本数'), dmg(30), { desc: '貫通 +2・矢の本数 +1', apply: (s) => { s.pierce += 2; s.count += 1; } }],
  evolution: {
    name: '煉獄の七杭', passiveId: 'jewel',
    desc: '七本の杭が扇状に放たれ、すべてを貫く。',
    apply: (s) => { s.evolved = true; s.count = 7; s.pierce = Infinity; s.damage *= 1.5; },
  },
};

/** 『星屑の裁定』：敵を追尾する星弾。count=弾数 */
const HOSHIKUZU: WeaponDef = {
  id: 'hoshikuzu', name: '星屑の裁定', owner: '黒崎 詩音', kind: 'art', tags: ['projectile'],
  desc: '敵を追尾する星の弾を放つ。',
  color: 0xc0c0ff, maxLevel: 8,
  base: stats({ damage: 10, intervalSec: 1.3, count: 2, area: 700, speed: 520, pierce: 0 }),
  levels: [more(1, '弾数'), dmg(25), faster(15), more(1, '弾数'), dmg(25), { desc: '貫通 +1', apply: (s) => { s.pierce += 1; } }, more(2, '弾数')],
  evolution: {
    name: '満天の裁定', passiveId: 'mana',
    desc: '星の矢が、画面のすべての敵を同時に狙う。',
    apply: (s) => { s.evolved = true; s.damage *= 1.2; },
  },
};

/** 『乱れ雪月花』：画面内のランダムな敵の位置に斬撃が閃く。count=対象数, area=各斬撃の半径 */
const SETSUGEKKA: WeaponDef = {
  id: 'setsugekka', name: '乱れ雪月花', owner: '狐森 雪人', kind: 'art', tags: ['melee'],
  desc: '画面のあちこちで斬撃が閃き、敵を切り伏せる。',
  color: 0xe8f4ff, maxLevel: 8,
  base: stats({ damage: 18, intervalSec: 1.6, count: 2, area: 70 }),
  levels: [more(1, '斬撃数'), dmg(25), wider(25), more(1, '斬撃数'), faster(15), dmg(25), more(2, '斬撃数')],
  evolution: {
    name: '雪月風花', passiveId: 'gonosen',
    desc: '斬撃の数が増え、被弾した瞬間にも周囲へ斬撃が閃く。',
    apply: (s) => { s.evolved = true; s.count += 3; s.damage *= 1.3; s.extra.counterRadius = 150; },
  },
};

/** 『リフレッシュの弾丸』：画面端で跳ね返り続ける貫通弾。当たった敵を鈍化。duration=寿命, slow=鈍化 */
const REFRESH: WeaponDef = {
  id: 'refresh', name: 'リフレッシュの弾丸', owner: '振須 響', kind: 'art', tags: ['projectile'],
  desc: '画面の端で跳ね返り続ける弾。当たった敵の動きを鈍らせる。',
  color: 0x7fffd4, maxLevel: 8,
  base: stats({ damage: 9, intervalSec: 2.2, count: 1, speed: 420, duration: 4, pierce: Infinity, slow: 0.6 }),
  levels: [dmg(25), longer(30), more(1, '弾数'), { desc: '鈍化が強くなる', apply: (s) => { s.slow = 0.45; } }, dmg(25), longer(30), more(1, '弾数')],
  evolution: {
    name: 'フリスクNEO', passiveId: 'scout',
    desc: '大きく速い弾が長く跳ね回り、触れた敵を強く鈍らせる。',
    apply: (s) => { s.evolved = true; s.damage *= 1.6; s.duration *= 1.5; s.speed *= 1.25; s.slow = 0.35; },
  },
};

/** 『強制・修羅場進行』：足元付近に鉄柵。area=半径, duration=持続, damage=毎秒ダメージ, slow=鈍化 */
const SHURABA: WeaponDef = {
  id: 'shuraba', name: '強制・修羅場進行', owner: '弼辺 徹', kind: 'art', tags: ['zone'],
  desc: '足元付近に鉄柵を組み上げる。中の敵は足止めされ、じわじわ削られる。',
  color: 0x4169e1, maxLevel: 8,
  base: stats({ damage: 8, intervalSec: 3, count: 1, area: 110, duration: 3.5, slow: 0.35 }),
  levels: [wider(20), dmg(30), longer(30), more(1, '柵の数'), dmg(30), wider(20), { desc: '柵の数 +1・持続 +30%', apply: (s) => { s.count += 1; s.duration *= 1.3; } }],
  evolution: {
    name: '完徹・修羅場進行', passiveId: 'patisserie',
    desc: '鉄柵が倍に増えて、ほとんど消えなくなる。中の敵はさらに鈍る。',
    apply: (s) => { s.evolved = true; s.count *= 2; s.duration *= 3; s.slow = 0.25; },
  },
};

/**
 * 『アクアシールド』：一定時間ダメージを防ぐ水の盾。duration=持続, extra.heal=進化時の回復。
 * extra.maxUptime = 実効発動間隔に対する持続の上限比率（パッシブ・必殺で間隔を縮めても常時無敵にならないようにする）
 */
const AQUA: WeaponDef = {
  id: 'aqua', name: 'アクアシールド', owner: '月怜 瑞穂', kind: 'art', tags: ['support'],
  desc: '水の盾をまとい、しばらくのあいだダメージを防ぐ。',
  color: 0x87cefa, maxLevel: 8,
  base: stats({ damage: 0, intervalSec: 9, duration: 2.5, area: 60, extra: { heal: 0, maxUptime: 0.6 } }),
  levels: [longer(25), faster(12), longer(25), faster(12), longer(25), faster(12), { desc: '持続 +40%', apply: (s) => { s.duration *= 1.4; } }],
  evolution: {
    name: 'アクア・メディック', passiveId: 'tuning',
    desc: '盾をまとう間、傷をゆっくりと癒す。',
    apply: (s) => { s.evolved = true; s.duration *= 1.3; s.extra.heal = 6; },
  },
};

/** 『狐火の御札』：周囲を回り続ける御札。count=枚数, area=軌道半径, speed=回転速度(rad/s), damage=接触ダメージ */
const OFUDA: WeaponDef = {
  id: 'ofuda', name: '狐火の御札', owner: '呱々崎 璦萌', kind: 'art', tags: ['orbit'],
  desc: '狐火を宿した御札が、自分の周囲を回り続ける。',
  color: 0xffa040, maxLevel: 8,
  base: stats({ damage: 8, intervalSec: 0.45, count: 2, area: 90, speed: 2.4, extra: { size: 1 } }),
  levels: [
    { desc: '御札 +1・少し大きく', apply: (s) => { s.count += 1; s.extra.size += 0.15; } },
    dmg(30),
    { desc: '回転が速く・軌道が広く', apply: (s) => { s.speed *= 1.2; s.area *= 1.15; } },
    { desc: '御札 +1・少し大きく', apply: (s) => { s.count += 1; s.extra.size += 0.15; } },
    dmg(30),
    { desc: '御札 +1・回転が速く', apply: (s) => { s.count += 1; s.speed *= 1.2; } },
    { desc: '御札 +1・大きく（計6枚）', apply: (s) => { s.count += 1; s.extra.size += 0.3; s.area *= 1.15; } },
  ],
  evolution: {
    name: '九尾の狐火', passiveId: 'finder',
    desc: '御札が九つの狐火になって回り、触れた敵を炎上させる。',
    apply: (s) => { s.evolved = true; s.count = 9; s.damage *= 1.2; s.extra.size = 1.4; s.extra.burnDps = 8; s.extra.burnSec = 3; },
  },
};

/** 『岩牙』：移動方向へ短い直線状に地面が隆起。area=長さ, extra.width=幅, knockback=強い */
const GANGA: WeaponDef = {
  id: 'ganga', name: '岩牙', owner: '護乃 豪', kind: 'art', tags: ['melee'],
  desc: '進む先の地面が牙のように隆起し、敵を弾き飛ばす。',
  color: 0x8b4513, maxLevel: 8,
  base: stats({ damage: 30, intervalSec: 2.4, count: 1, area: 220, knockback: 420, extra: { width: 70 } }),
  levels: [dmg(30), wider(25, '長さ'), faster(15), { desc: '幅 +40%', apply: (s) => { s.extra.width *= 1.4; } }, dmg(30), wider(25, '長さ'), faster(15)],
  evolution: {
    name: '獅咬豪烈破', passiveId: 'makanai',
    desc: '三段の地割れが続けざまに走り、行く手をなぎ払う。',
    apply: (s) => { s.evolved = true; s.count = 3; s.damage *= 1.4; s.area *= 1.3; s.extra.width *= 1.3; },
  },
};

/** 『円』：一定間隔で周囲360°を一閃。area=半径 */
const EN: WeaponDef = {
  id: 'en', name: '円', owner: '嘉地 杏子', kind: 'art', tags: ['melee'],
  desc: '一定の呼吸で、自分の周囲を円に一閃する。',
  color: 0xdc143c, maxLevel: 8,
  base: stats({ damage: 16, intervalSec: 1.8, area: 120, knockback: 120 }),
  levels: [wider(20), dmg(30), faster(12), wider(20), dmg(30), faster(12), wider(25)],
  evolution: {
    name: '円と波紋', passiveId: 'poem',
    desc: '一閃のあと、斬撃の輪が波紋のように外へ広がる。',
    apply: (s) => { s.evolved = true; s.damage *= 1.3; s.extra.ripple = 1.9; },
  },
};

/** 『重圧の檻』：最も密集した地点に重力場。area=半径, duration=持続, damage=毎秒, count=同時数 */
const CAGE: WeaponDef = {
  id: 'cage', name: '重圧の檻', owner: '若宮 征士郎', kind: 'art', tags: ['zone'],
  desc: '敵が最も集まった場所に重力の檻を落とす。中の敵は動けない。',
  color: 0x191970, maxLevel: 8,
  base: stats({ damage: 10, intervalSec: 4, count: 1, area: 130, duration: 2.5 }),
  levels: [wider(20), dmg(30), longer(30), faster(15), dmg(30), wider(20), longer(30)],
  evolution: {
    name: '十重の檻', passiveId: 'gear',
    desc: '重力場が多重に展開し、逃げ場を奪う。',
    apply: (s) => { s.evolved = true; s.count = 3; s.damage *= 1.3; },
  },
};

/** 『物理演算バグ』：最寄りの敵を蹴り飛ばし、ぶつかった敵に連鎖ダメージ。count=蹴る数, speed=飛ぶ速さ */
const BUG: WeaponDef = {
  id: 'bug', name: '物理演算バグ', owner: '晴山 樹', kind: 'art', tags: ['melee'],
  desc: '最寄りの敵を蹴り飛ばす。飛んだ敵がぶつかった相手にもダメージ。',
  color: 0x00ced1, maxLevel: 8,
  base: stats({ damage: 20, intervalSec: 1.5, count: 1, speed: 900, duration: 0.5 }),
  levels: [dmg(30), faster(15), { desc: '飛距離 +30%', apply: (s) => { s.duration *= 1.3; } }, dmg(30), more(1, '蹴る数'), faster(15), dmg(30)],
  evolution: {
    name: 'BVキック', passiveId: 'route',
    desc: 'まとめて蹴り飛ばす。飛んだ敵はさらに遠くまで転がる。',
    apply: (s) => { s.evolved = true; s.count += 2; s.damage *= 1.5; s.duration *= 1.4; },
  },
};

/** 『天宮流・舞闘術』：投げた傘が弧を描いて戻る。往復で2回当たる。area=飛距離, count=本数 */
const BUTOU: WeaponDef = {
  id: 'butou', name: '天宮流・舞闘術', owner: '天宮 澪', kind: 'art', tags: ['projectile'],
  desc: '投げた傘が弧を描いて戻ってくる。行きと帰りで二度当たる。',
  color: 0x2f4f4f, maxLevel: 8,
  base: stats({ damage: 15, intervalSec: 1.6, count: 1, area: 320, speed: 560, pierce: Infinity }),
  levels: [dmg(25), wider(20, '飛距離'), more(1, '傘の数'), faster(15), dmg(25), wider(20, '飛距離'), more(1, '傘の数')],
  evolution: {
    name: '天宮流・花傘乱舞', passiveId: 'encore',
    desc: '傘が三本に増え、周囲を舞ってから戻ってくる。',
    apply: (s) => { s.evolved = true; s.count = 3; s.damage *= 1.25; s.extra.orbitSec = 1.2; },
  },
};

/** 『物語の具現化』：発動ごとに他の共鳴アーツ1種をランダムで再現 */
const MONOGATARI: WeaponDef = {
  id: 'monogatari', name: '物語の具現化', owner: '片桐 玄人', kind: 'art', tags: ['support'],
  desc: '発動のたび、仲間のアーツのどれかをページから呼び出す。',
  color: 0x008080, maxLevel: 8,
  base: stats({ damage: 1, intervalSec: 2.4 }),
  levels: [faster(10), { desc: '再現の威力 +20%', apply: (s) => { s.damage *= 1.2; } }, faster(10), { desc: '再現の威力 +20%', apply: (s) => { s.damage *= 1.2; } }, faster(10), { desc: '再現の威力 +20%', apply: (s) => { s.damage *= 1.2; } }, { desc: '2種を同時に再現', apply: (s) => { s.count = 2; } }],
};

/** 『換装・散弾』（響）：移動方向の前後へ扇状（30°）に各 count 発。area=射程 */
const SANDAN: WeaponDef = {
  id: 'sandan', name: '換装・散弾', owner: '振須 響', kind: 'art', tags: ['projectile'],
  desc: '前と後ろへ同時に散弾を撃つ。近い敵を弾き飛ばす。',
  color: 0x7fffd4, maxLevel: 8,
  base: stats({ damage: 7, intervalSec: 1.0, count: 5, area: 220, speed: 820, knockback: 140, extra: { arcDeg: 30 } }),
  levels: [more(1, '散弾の数'), dmg(25), wider(15, '射程'), faster(12), more(1, '散弾の数'), dmg(25), { desc: '射程 +15%・散弾の数 +1', apply: (s) => { s.area *= 1.15; s.count += 1; } }],
};

/** 『宵星（援護射撃）』（空夜）：画面内で最もHPの高い敵へハンドガン count 連射。空夜操作時は出ない。extra.targets=同時に狙う数 */
const ENGO: WeaponDef = {
  id: 'engo', name: '宵星（援護射撃）', owner: '宵月 空夜', kind: 'art', tags: ['projectile'],
  desc: '画面内でいちばん手強い敵へ、ハンドガンの連射を送る。',
  color: 0x87ceeb, maxLevel: 8,
  base: stats({ damage: 10, intervalSec: 1.5, count: 3, area: 800, speed: 950, extra: { targets: 1 } }),
  levels: [dmg(25), faster(10), more(1, '連射数'), dmg(25), faster(10), more(1, '連射数'), dmg(25)],
  evolution: {
    name: '蒼天の号令', passiveId: 'script',
    desc: 'HPの高い敵3体を同時に狙い、まとめて連射する。',
    apply: (s) => { s.evolved = true; s.extra.targets = 3; s.damage *= 1.2; },
  },
};

// ───────────────────────── 合体アーツ（v2 §5.5） ─────────────────────────

// 数値は「素材2つ（Lv8）の合計を少し上回る」水準（2026-09-27 引き上げ）。合体して弱くならないこと。

/** 『トライスター』（空夜のみ）：白銀の斬撃（extra.slashes か所）＋追尾する星弾。一定間隔で三角形の光が走り内側に大ダメージ */
const TRISTAR: WeaponDef = {
  id: 'tristar', name: 'トライスター', owner: '狐森 雪人・黒崎 詩音', kind: 'art', tags: ['melee', 'projectile'], fusion: true,
  desc: '白銀の斬撃と星の弾。ときおり三つを結ぶ光が走り、内側の敵を裁く。',
  color: 0xffd700, maxLevel: 1,
  base: stats({ damage: 45, intervalSec: 1.6, count: 6, area: 80, speed: 560, extra: { slashes: 4, triangleEvery: 3, triangleDamage: 200 } }),
  levels: [],
};

/**
 * 『夢見る猫箱』：1回分のダメージを防ぐ盾（割れて3秒で再生）＋前方180°へ大きな貫通炎矢5本。
 * 素材の『アクアシールド』が進化済み（アクア・メディック）なら癒しを引き継ぐ：盾が攻撃を防いだ瞬間に extra.medicHeal 回復
 */
const NEKOBAKO: WeaponDef = {
  id: 'nekobako', name: '夢見る猫箱', owner: '寿 律花・月怜 瑞穂', kind: 'art', tags: ['projectile', 'support'], fusion: true,
  desc: '一撃を防ぐ水の盾をまとい、前方へ大きな炎の矢を放つ。',
  color: 0xff69b4, maxLevel: 1,
  base: stats({ damage: 45, intervalSec: 1.2, count: 5, area: 900, speed: 820, pierce: Infinity, extra: { shieldRegenSec: 3, medicHeal: 15 } }),
  levels: [],
};

/** 『星墜の檻（メテオ・ケージ）』：前方の扇（extra.arcDeg・半径 area）に星が降り注ぎ、着弾範囲にダメージ＋縫い止め。解けたあとも extra.slowSec 秒は鈍化（slow） */
const METEOCAGE: WeaponDef = {
  id: 'meteocage', name: '星墜の檻', owner: '黒崎 詩音・若宮 征士郎', kind: 'art', tags: ['projectile', 'zone'], fusion: true,
  desc: '前方の空から星が降り、着弾した場所の敵を縫い止める。',
  color: 0x9d4dff, maxLevel: 1,
  base: stats({ damage: 35, intervalSec: 2.2, count: 10, area: 320, duration: 1.0, slow: 0.5, extra: { blastRadius: 80, arcDeg: 210, slowSec: 3 } }),
  levels: [],
};

/** 『本陣の咆哮』：2秒ごとに周囲へ逆茂木（一辺 fenceRadius×2 の四角。足止め＋継続ダメージ）＋岩の衝撃波（半径 area の大円・強ノックバック） */
const HONJIN: WeaponDef = {
  id: 'honjin', name: '本陣の咆哮', owner: '護乃 豪・弼辺 徹', kind: 'art', tags: ['melee', 'zone'], fusion: true,
  desc: '足元に逆茂木が立ち、岩の衝撃波が周囲をなぎ払う。',
  color: 0x8b4513, maxLevel: 1,
  base: stats({ damage: 60, intervalSec: 2.0, area: 330, duration: 2.0, knockback: 420, slow: 0.2, extra: { fenceRadius: 210, fenceDps: 30 } }),
  levels: [],
};

/** 『跳弾バグ（リコシェ・グリッチ）』：蹴り飛ばした敵が画面端で最大5回跳ね返り、ぶつかった敵にダメージ。発動ごとに響の跳ね返る弾も1発撃ち、飛んでいる敵に当たると加速 */
const RICOCHET: WeaponDef = {
  id: 'ricochet', name: '跳弾バグ', owner: '振須 響・晴山 樹', kind: 'art', tags: ['melee'], fusion: true,
  desc: '蹴り飛ばした敵が画面の端で跳ね回り、ぶつかった敵を巻き込む。',
  color: 0x00ced1, maxLevel: 1,
  base: stats({ damage: 50, intervalSec: 1.6, count: 3, speed: 900, duration: 6, slow: 0.45, extra: { bounces: 5, shotDamage: 14, shotSpeed: 420, shotLife: 6 } }),
  levels: [],
};

export const WEAPONS: Record<string, WeaponDef> = {
  yoisei: YOISEI,
  reisuisen: REISUISEN,
  greatsword: GREATSWORD,
  flamehound: FLAMEHOUND,
  guren: GUREN,
  hoshikuzu: HOSHIKUZU,
  setsugekka: SETSUGEKKA,
  refresh: REFRESH,
  shuraba: SHURABA,
  aqua: AQUA,
  ofuda: OFUDA,
  ganga: GANGA,
  en: EN,
  cage: CAGE,
  bug: BUG,
  butou: BUTOU,
  monogatari: MONOGATARI,
  sandan: SANDAN,
  engo: ENGO,
  tristar: TRISTAR,
  nekobako: NEKOBAKO,
  meteocage: METEOCAGE,
  honjin: HONJIN,
  ricochet: RICOCHET,
};

/** レベルアップで選べる共鳴アーツ（合体アーツは除く） */
export const ART_IDS = Object.values(WEAPONS).filter((w) => w.kind === 'art' && !w.fusion).map((w) => w.id);

/** Lv と進化状態から ArtStats を計算する */
export function computeStats(def: WeaponDef, level: number, evolved: boolean): ArtStats {
  const s: ArtStats = { ...def.base, extra: { ...def.base.extra } };
  for (let i = 0; i < Math.min(level - 1, def.levels.length); i++) def.levels[i].apply(s);
  if (evolved && def.evolution) def.evolution.apply(s);
  return s;
}
