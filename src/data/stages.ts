import type { EnemyId } from './enemies';

// ステージ定義。前のステージをクリアすると次が解放される。数値は初期値。

export interface StageDef {
  id: number;
  name: string;
  nameEn: string;
  /** 選択画面の一言（雰囲気づけのみ） */
  desc: string;
  enemyHpMul: number;
  enemySpeedMul: number;
  /** 湧き数の倍率 */
  spawnMul: number;
  bossHpMul: number;
  xpMul: number;
  /** 2:00 以降の時間帯に足す出現比率（早い段階から強敵を混ぜる） */
  extraWeights: Partial<Record<EnemyId, number>>;
  /** 背景タイルのティント（0xffffff で無色） */
  tint: number;
  /** カードの差し色 */
  color: number;
  /** BGMキー（未配置なら bgm_stage にフォールバック） */
  bgm: string;
  /** 解放条件：このステージIDをクリア */
  unlockAfter?: number;
}

export const STAGES: StageDef[] = [
  {
    id: 1, name: '宵の口', nameEn: 'STAGE 1',
    desc: '影はまだ、まばら。声を取り戻す練習にはちょうどいい。',
    enemyHpMul: 1, enemySpeedMul: 1, spawnMul: 1, bossHpMul: 1, xpMul: 1,
    extraWeights: {},
    tint: 0xffffff, color: 0x87ceeb, bgm: 'bgm_stage',
  },
  {
    id: 2, name: '真夜中', nameEn: 'STAGE 2',
    desc: '群れは厚く、足も速い。騎士級が早くから混ざる。',
    enemyHpMul: 1.6, enemySpeedMul: 1.1, spawnMul: 1.3, bossHpMul: 3, xpMul: 1.15,
    extraWeights: { knight: 0.08 },
    tint: 0xbfb4e8, color: 0x9d4dff, bgm: 'bgm_stage2',
    unlockAfter: 1,
  },
  {
    id: 3, name: '夜明け前', nameEn: 'STAGE 3',
    desc: '声の嵐。司祭級の弾幕と、硬い騎士の壁。王級は桁違いに頑丈。',
    enemyHpMul: 2.5, enemySpeedMul: 1.2, spawnMul: 1.6, bossHpMul: 4.2, xpMul: 1.3, // v2: 6→4.2（70%）。まだ硬ければ 3.3（55%）
    extraWeights: { knight: 0.14, bishop: 0.1 },
    tint: 0xe8b4b8, color: 0xff4d6d, bgm: 'bgm_stage3',
    unlockAfter: 2,
  },
];

export function stageById(id: number): StageDef {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}
