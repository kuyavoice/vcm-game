import { RANK_MODE_IDS, rankValue, rankOfScore, rankOfEndless, rankOfRush } from '../data/ranks';
import { CONFIG } from '../data/config';
import type { StatsData } from './stats';

export interface BestRecord {
  kills: number;
  timeSec: number;
  level: number;
  yell: number;
  cleared: boolean;
}

export interface SaveData {
  /** 旧形式（Stage 1 の記録として移行） */
  best: BestRecord | null;
  /** ステージ別ベスト（キー = ステージID） */
  bests: Record<string, BestRecord>;
  /** クリア済みステージID */
  cleared: number[];
  settings: { bgm: number; se: number; voice: number; speed: number; character: string; /** ダメージの数字を出す */ damageNumbers: boolean; /** 必殺ボタンの位置（既定は右下） */ specialSide: 'right' | 'left'; /** 戦闘中の曲：normal＝今までどおり／custom＝場面ごとに割り当てた曲 */ bgmMode: 'normal' | 'custom'; /** 場面 → 曲ID（music.ts）。utils/bgmCustom.ts */ bgmCustom: Record<string, string>; /** 敵に当たったときの光り方：strong＝白く光る（既定）／soft＝淡く／off＝光らない */ hitFlash: 'strong' | 'soft' | 'off'; /** 画面全体の光（必殺・撃破など）：on／soft／off */ screenFlash: 'on' | 'soft' | 'off'; /** 必殺のカットイン：first＝1プレイで最初の1回だけ（既定）／always＝毎回／sometimes＝時々（ボイスの必殺と同じ間隔） */ cutIn: 'first' | 'always' | 'sometimes'; /** 表示言語（最低限。utils/lang.ts） */ lang: 'ja' | 'en'; /** 絆MAXのオーラ・残像（data/bond.ts） */ bondFx: 'on' | 'off'; /** 敵の縁取り：auto＝暗いステージだけ（既定）／on＝全ステージ／off＝無し（2026-10-18） */ enemyOutline: 'auto' | 'on' | 'off' };
  totalYell: number;
  /** 解放済みキャラID（空夜は常に使える） */
  unlockedCharacters: string[];
  /** 永続強化のLv（キー = shop.ts の id） */
  permanent: Record<string, number>;
  /** 図鑑：発見したアーツID（進化は `id:evo`） */
  codex: string[];
  /** レベルアップ時の便利アイテムの所持数（エールで購入） */
  consumables: { reroll: number; skip: number; ban: number };
  /** 所有カラー（キャラID → バリエーションID[]）と選択中（キャラID → バリエーションID。未設定＝標準） */
  colors: Record<string, string[]>;
  colorSelected: Record<string, string>;
  /** スコアアタックの端末内ランキング */
  scoreRanking: { score: number; kills: number; timeSec: number; character: string; date: string; cleared: boolean }[];
  /** エンドレスの端末内の記録（生存時間の長い順） */
  endlessRanking: { timeSec: number; score: number; kills: number; level: number; character: string; date: string }[];
  /** ボスラッシュの記録（1周のクリア時間の短い順）。loops＝クリアした周の数 */
  rushRanking: { timeSec: number; loops: number; character: string; arts: string[]; supports?: string[]; date: string }[];
  /** ボスラッシュの最高周回数（ランキングは1周目タイム順で10件に切るので、周回の記録は別に1件持つ。2026-10-18） */
  rushMaxLoops: { loops: number; timeSec: number; character: string; date: string } | null;
  /** モード別の最高ランク（stageId → 数。data/ranks.ts の rankValue。2026-10-19） */
  ranks: Record<string, number>;
  /** ボスラッシュで前回選んだアーツとサポート */
  lastRushArts: string[];
  lastRushSupports: string[];
  /** 隠しキャラの出現状態（キャラID → pending＝出現演出がまだ／shown＝演出済みで NEW の印だけ）。一度選ぶと消える */
  secretNew: Record<string, 'pending' | 'shown'>;
  /** ギャラリーで解放した絵のID */
  gallery: string[];
  /** ミュージックで解放した曲のID */
  music: string[];
  /** 図鑑：遭遇した敵のID。null は、まだ一度も作っていない（これまでの記録から作る。utils/bestiary.ts） */
  bestiary: string[] | null;
  /** 初回プレイの案内を見た（STAGE 1 を一度でも始めたら true） */
  tutorialDone: boolean;
  /** 初回起動の「光の点滅について」を閉じた */
  flashNoticeShown: boolean;
  /** 解除した実績のID（data/achievements.ts） */
  achievements: string[];
  /** 絆：キャラIDごとに贈ったエールの累計（data/bond.ts）。2026-10-12 */
  bond: Record<string, number>;
  /** 絆MAXのオーラの色（キャラID → AURA_COLORS の id。未設定＝キャラ色） */
  bondAura: Record<string, string>;
  /** プレイの集計（utils/stats.ts）。null は、まだ一度も作っていない（ランキングから起こす） */
  stats: StatsData | null;
}

const DEFAULT: SaveData = {
  best: null,
  bests: {},
  cleared: [],
  settings: { bgm: 0.7, se: 0.8, voice: 1, speed: 1, character: 'kuya', damageNumbers: true, specialSide: 'right', bgmMode: 'normal', bgmCustom: {}, hitFlash: 'strong', screenFlash: 'on', cutIn: 'first', lang: 'ja', bondFx: 'on', enemyOutline: 'auto' },
  totalYell: 0,
  unlockedCharacters: [],
  permanent: {},
  codex: [],
  consumables: { reroll: 0, skip: 0, ban: 0 },
  colors: {},
  colorSelected: {},
  scoreRanking: [],
  endlessRanking: [],
  rushRanking: [],
  rushMaxLoops: null,
  ranks: {},
  lastRushArts: [],
  lastRushSupports: [],
  secretNew: {},
  gallery: [],
  music: [],
  bestiary: null,
  tutorialDone: false,
  flashNoticeShown: false,
  achievements: [],
  bond: {},
  bondAura: {},
  stats: null,
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const data: SaveData = {
      ...structuredClone(DEFAULT),
      ...parsed,
      settings: { ...DEFAULT.settings, ...(parsed.settings ?? {}), bgmCustom: { ...(parsed.settings?.bgmCustom ?? {}) } },
      bests: { ...(parsed.bests ?? {}) },
      cleared: [...(parsed.cleared ?? [])],
      unlockedCharacters: [...(parsed.unlockedCharacters ?? [])],
      permanent: { ...(parsed.permanent ?? {}) },
      codex: [...(parsed.codex ?? [])],
      consumables: { ...DEFAULT.consumables, ...(parsed.consumables ?? {}) },
      colors: { ...(parsed.colors ?? {}) },
      colorSelected: { ...(parsed.colorSelected ?? {}) },
      scoreRanking: [...(parsed.scoreRanking ?? [])],
      endlessRanking: [...(parsed.endlessRanking ?? [])],
      rushRanking: [...(parsed.rushRanking ?? [])],
      rushMaxLoops: parsed.rushMaxLoops ? { ...parsed.rushMaxLoops } : null,
      ranks: { ...(parsed.ranks ?? {}) },
      lastRushArts: [...(parsed.lastRushArts ?? [])],
      lastRushSupports: [...(parsed.lastRushSupports ?? [])],
      secretNew: { ...(parsed.secretNew ?? {}) },
      gallery: [...(parsed.gallery ?? [])],
      music: [...(parsed.music ?? [])],
      bestiary: parsed.bestiary ? [...parsed.bestiary] : null,
      achievements: [...(parsed.achievements ?? [])],
      bond: { ...(parsed.bond ?? {}) },
      bondAura: { ...(parsed.bondAura ?? {}) },
      stats: parsed.stats ? { total: { ...parsed.stats.total }, chars: Object.fromEntries(Object.entries(parsed.stats.chars ?? {}).map(([k, v]) => [k, { ...v }])) } : null,
    };
    // ランクの回収（2026-10-19）：ランキングが残っているモード（スコア・エンドレス・ボスラッシュ）はそこから最高ランクを起こす。通常・悪夢はクリアタイムを保存していないので次のクリアから
    if (!parsed.ranks) {
      const put = (id: number, v: number) => { if (v > (data.ranks[String(id)] ?? 0)) data.ranks[String(id)] = v; };
      for (const e of data.scoreRanking) put(RANK_MODE_IDS.score, rankValue(rankOfScore(e.score)));
      for (const e of data.endlessRanking) put(RANK_MODE_IDS.endless, rankValue(rankOfEndless(e.timeSec)));
      for (const e of data.rushRanking) put(RANK_MODE_IDS.rush, rankValue(rankOfRush(e.timeSec)));
    }
    // 最高周回数の回収：以前のデータは、ランキングに残っている中で一番周回の多いプレイを起こす（2026-10-18）
    if (!data.rushMaxLoops && data.rushRanking.length > 0) {
      const top = data.rushRanking.reduce((a, b) => (b.loops > a.loops ? b : a));
      data.rushMaxLoops = { loops: top.loops, timeSec: top.timeSec, character: top.character, date: top.date };
    }
    // 旧形式の移行：best → bests[1]
    if (data.best && !data.bests['1']) {
      data.bests['1'] = data.best;
      if (data.best.cleared && !data.cleared.includes(1)) data.cleared.push(1);
    }
    return data;
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
  } catch {
    /* プライベートモード等では保存しない */
  }
}

/** 図鑑に登録（重複なし）。返り値: 新規なら true */
export function recordCodex(id: string): boolean {
  const sv = loadSave();
  if (sv.codex.includes(id)) return false;
  sv.codex.push(id);
  writeSave(sv);
  return true;
}

export function isStageUnlocked(data: SaveData, unlockAfter?: number): boolean {
  return unlockAfter === undefined || data.cleared.includes(unlockAfter);
}
