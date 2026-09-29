import type { EnemyId } from './enemies';

// 時間帯ごとの出現設定。from〜to（秒）。

export interface AmbushDef {
  type: EnemyId;
  count: number;
  everySec: number;
}

export interface WaveBand {
  label: string;
  from: number;
  to: number;
  /** 帯の開始〜終了で線形補間される毎秒の湧き数 */
  spawnPerSecStart: number;
  spawnPerSecEnd: number;
  /** 出現比率 */
  weights: Partial<Record<EnemyId, number>>;
  /** 敵HP倍率（時間経過で少しずつ硬く） */
  hpMul: number;
  /** 片側からの群れ奇襲（狩人級） */
  ambush?: AmbushDef;
  /** 満月イベント（M2で実装：出現×2・速度+20%・経験値×1.5） */
  fullMoon?: boolean;
  /** ボス出現（M2で実装） */
  boss?: EnemyId;
  /** ボスの数（既定1） */
  bossCount?: number;
  /** この帯のボスHP倍率（既定1） */
  bossHpMul?: number;
  /** ボスが最初から後半の行動（城兵級は激昂、女王級は開花後、黒騎士は形態変化後）で出る */
  bossEnraged?: boolean;
}

export const WAVES: WaveBand[] = [
  {
    label: '雑音級',
    from: 0, to: 120,
    spawnPerSecStart: 1.0, spawnPerSecEnd: 2.5,
    weights: { grunt: 1 },
    hpMul: 1,
  },
  {
    label: '雑音級＋狩人級',
    from: 120, to: 240,
    spawnPerSecStart: 2.5, spawnPerSecEnd: 3.5,
    weights: { grunt: 1, hunter: 0.35 },
    hpMul: 1.1,
    ambush: { type: 'hunter', count: 12, everySec: 25 },
  },
  {
    label: '＋騎士級',
    from: 240, to: 300,
    spawnPerSecStart: 3.5, spawnPerSecEnd: 4.0,
    weights: { grunt: 1, hunter: 0.4, knight: 0.08 },
    hpMul: 1.25,
    ambush: { type: 'hunter', count: 14, everySec: 30 },
  },
  {
    label: '満月',
    from: 300, to: 360,
    spawnPerSecStart: 4.0, spawnPerSecEnd: 4.5,
    weights: { grunt: 1, hunter: 0.4, knight: 0.1 },
    hpMul: 1.4,
    fullMoon: true,
  },
  {
    label: '＋司祭級',
    from: 360, to: 480,
    spawnPerSecStart: 4.5, spawnPerSecEnd: 5.5,
    weights: { grunt: 1, hunter: 0.4, knight: 0.12, bishop: 0.1 },
    hpMul: 1.6,
    ambush: { type: 'hunter', count: 16, everySec: 30 },
  },
  {
    label: '大群',
    from: 480, to: 600,
    spawnPerSecStart: 6.0, spawnPerSecEnd: 8.0,
    weights: { grunt: 1, hunter: 0.5, knight: 0.15, bishop: 0.12 },
    hpMul: 2.0,
    ambush: { type: 'hunter', count: 20, everySec: 25 },
  },
  {
    // ボスはステージごとに決まる（StageDef.bossId）。字幕と時間帯の名前には、そのボスの名前が出る
    label: 'ボス',
    from: 600, to: 9999,
    spawnPerSecStart: 1.5, spawnPerSecEnd: 1.5,
    weights: { grunt: 1, hunter: 0.3 },
    hpMul: 2.0,
    boss: 'rook',
  },
];

export function bandAt(t: number, list: WaveBand[] = WAVES): WaveBand {
  for (const b of list) if (t >= b.from && t < b.to) return b;
  return list[list.length - 1];
}
