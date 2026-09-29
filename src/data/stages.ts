import type { EnemyId } from './enemies';
import type { WaveBand } from './waves';
import { NIGHTMARE_STAGE } from './nightmare';
import { ENDLESS_STAGE } from './endless';

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
  /** 10:00 のボス（独自の時間帯を持たないステージ。未指定なら時間帯のボス） */
  bossId?: EnemyId;
  /** 敵に淡い縁取り（背景が暗いステージの見やすさ対策） */
  enemyOutline?: boolean;
  /** 降雪などの天候演出 */
  weather?: 'snow';
  /** 独自の時間帯（既定は WAVES） */
  waves?: WaveBand[];
  /** 時間経過で上昇する倍率（1分ごとの加算率） */
  /** speedMax：速さの倍率の上限（ステージの速さに掛ける分。未指定なら上限なし） */
  ramp?: { hpPerMin: number; spawnPerMin: number; speedPerMin: number; speedMax?: number };
  /** スコアアタック */
  scoreMode?: boolean;
  /** エンドレス：時間切れもクリアも無い。時間帯とボスの出し方は data/endless.ts */
  endless?: boolean;
  /** 敵の攻撃力の倍率（接触・弾・ボスの攻撃すべて。既定1） */
  enemyDamageMul?: number;
  /** 永続強化（ショップの PERMANENT）を無効にする */
  noPermanent?: boolean;
  /** このボスを倒すとクリア（それまでのボスを倒しても続く）。未指定なら、最初に倒したボスでクリア */
  finalBoss?: EnemyId;
}

export const STAGES: StageDef[] = [
  {
    id: 1, name: '宵の口', nameEn: 'STAGE 1',
    desc: '影はまだ、まばら。声を取り戻す練習にはちょうどいい。',
    enemyHpMul: 1, enemySpeedMul: 1, spawnMul: 1, bossHpMul: 1, xpMul: 1,
    extraWeights: {},
    tint: 0xffffff, color: 0x87ceeb, bgm: 'bgm_stage',
    bossId: 'rook',
  },
  {
    id: 2, name: '真夜中', nameEn: 'STAGE 2',
    desc: '群れは厚く、足も速い。騎士級が早くから混ざる。',
    enemyHpMul: 1.6, enemySpeedMul: 1.1, spawnMul: 1.3, bossHpMul: 3, xpMul: 1.15,
    extraWeights: { knight: 0.08 },
    tint: 0xffffff, color: 0x9d4dff, bgm: 'bgm_stage2',
    unlockAfter: 1, enemyOutline: true, bossId: 'queen',
  },
  {
    id: 3, name: '夜明け前', nameEn: 'STAGE 3',
    desc: '声の嵐。司祭級の弾幕と、硬い騎士の壁。王級は桁違いに頑丈。',
    enemyHpMul: 2.5, enemySpeedMul: 1.2, spawnMul: 1.6, bossHpMul: 3.3, xpMul: 1.3, // v2: 6→4.2（70%）→ テストプレイで 3.3（55%）に
    extraWeights: { knight: 0.14, bishop: 0.1 },
    tint: 0xffffff, color: 0xff4d6d, bgm: 'bgm_stage3',
    unlockAfter: 2, bossId: 'blackknight', weather: 'snow',
  },
];

export function stageById(id: number): StageDef {
  if (id === 99) return SCORE_STAGE_REF.value;
  if (id === NIGHTMARE_STAGE.id) return NIGHTMARE_STAGE;
  if (id === ENDLESS_STAGE.id) return ENDLESS_STAGE;
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

/** 循環importを避けるため score.ts 側から登録する */
export const SCORE_STAGE_REF: { value: StageDef } = { value: STAGES[0] };
