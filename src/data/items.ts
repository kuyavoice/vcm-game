// フィールドアイテム・ドロップ（仕様 §6.5）。数値は初期値。

export type PickupKind = 'xp' | 'yell' | 'magnet' | 'cake' | 'cross' | 'chest' | 'chahan';

export interface PickupDef {
  kind: PickupKind;
  name: string;
  texture: string;
  /** 取得時の短いメッセージ（雰囲気づけ。本編の出来事には触れない） */
  message?: string;
}

export const PICKUPS: Record<PickupKind, PickupDef> = {
  xp: { kind: 'xp', name: '声の欠片', texture: 'gem' },
  yell: { kind: 'yell', name: 'エール', texture: 'yell' },
  magnet: { kind: 'magnet', name: 'ギア一斉受信', texture: 'item_magnet', message: 'ギア一斉受信' },
  cake: { kind: 'cake', name: '月光のチーズケーキ', texture: 'item_cake', message: '月光のチーズケーキ  HP回復' },
  cross: { kind: 'cross', name: '久遠の十字架', texture: 'item_cross', message: '久遠の十字架 —— 静かな光が満ちる' },
  chest: { kind: 'chest', name: '美麗の宝石箱', texture: 'item_chest' },
  // 『運命のチャーハン』の帯の中で倒した敵が、まれに落とす（数が出るので、取得時の字幕は出さない）
  chahan: { kind: 'chahan', name: 'ミニチャーハン', texture: 'item_chahan' },
};

export const ITEMS = {
  /** 壊れたスピーカー */
  speaker: {
    /** 何秒ごとに1つ置くか */
    intervalSec: 28,
    /** ボスがいる間の間隔（以前は置かなかった。2026-10-01 ユーザー承認） */
    intervalSecBoss: 56,
    /** 同時に存在できる数 */
    maxAlive: 3,
    /** プレイヤーからの距離（画面内〜少し外） */
    minDist: 260,
    maxDist: 520,
    /** ドロップ比率（cross は幸運で倍率） */
    drops: { magnet: 30, cake: 35, yell: 30, cross: 5 } as Record<'magnet' | 'cake' | 'yell' | 'cross', number>,
    /** エール（多め）の個数 */
    yellCount: 6,
  },
  /** 回復は「heal か、最大HPの healRatio の大きいほう」（2026-10-01。最大HPが増えても追いつくように） */
  cake: { heal: 30, healRatio: 0.2 },
  chahan: { heal: 5 },
  cross: {
    /** 騎士級以上へのダメージ */
    damage: 300,
  },
  chest: {
    /** 騎士級以上を倒したときの出現率（幸運で倍率） */
    dropChance: 0.08,
    /** 強化できるものが無いときに、代わりにもらえるエール（20 → 5。長時間プレイで貯まりすぎるため） */
    yellFallback: 5,
  },
  /** ギア一斉受信のときの欠片の吸引速度倍率 */
  magnetSpeedMul: 2.5,
};
