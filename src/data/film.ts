// 撮影モード（FILM。2026-10-25 ユーザー承認）：URL に `?film` を付けたときだけ入れる、自由な構成のサンドボックス。
// キャラ・背景・アーツ（Lv・進化・合体）・サポートを自由に決め、敵は自分で出す。記録・実績・エールは一切保存しない（GameScene は debugUsed 扱い）。
// 構成は sessionStorage に残す（タブを閉じるまで。セーブには書かない）。
import type { EnemyId } from './enemies';

export interface FilmArt {
  id: string;
  /** 1〜8 */
  level: number;
  /** Lv8 かつ進化先があるときだけ */
  evolved: boolean;
}

export interface FilmConfig {
  characterId: string;
  stageId: number;
  /** 初期武器の Lv（1〜8） */
  mainLevel: number;
  arts: FilmArt[];
  /** 合体アーツ（素材なしで直接持つ） */
  fusions: string[];
  supports: { id: string; level: number }[];
  /** 通常の湧きを止める（敵は操作パネルから出す） */
  noSpawn: boolean;
  invincible: boolean;
  /** 必殺ゲージ満タンで始める */
  fullGauge: boolean;
  /** レベルアップの選択画面を出さない */
  noLevelUp: boolean;
  /** HUD を消して始める */
  hudOff: boolean;
  /** 敵が死なない（HP が 1 で止まる。2026-10-25 追加） */
  enemyImmortal: boolean;
  /** 自キャラの攻撃を止める（アーツが発動しない。必殺は押せば出る） */
  noAttack: boolean;
}

/** 背景に選べるステージ（STAGE 1〜3・悪夢・闘技場） */
export const FILM_STAGE_IDS: { id: number; label: string }[] = [
  { id: 1, label: 'STAGE 1' },
  { id: 2, label: 'STAGE 2' },
  { id: 3, label: 'STAGE 3' },
  { id: 98, label: 'EX 悪夢' },
  { id: 95, label: '闘技場' },
];

/** 操作パネルから出せる雑魚（1回に出す数つき） */
export const FILM_MINIONS: { id: EnemyId; name: string; n: number }[] = [
  { id: 'grunt', name: '雑音級', n: 10 },
  { id: 'hunter', name: '狩人級', n: 6 },
  { id: 'knight', name: '騎士級', n: 3 },
  { id: 'bishop', name: '司祭級', n: 2 },
  { id: 'cavalry', name: '騎兵', n: 4 },
];

/** 操作パネルから出せるボス */
export const FILM_BOSSES: { id: EnemyId; name: string }[] = [
  { id: 'king', name: '王級' },
  { id: 'rook', name: '城兵級' },
  { id: 'queen', name: '女王級' },
  { id: 'blackknight', name: '黒騎士' },
  { id: 'redknight', name: '悪夢の黒騎士' },
];

/** ゲーム速度（スローを含む。通常の ×1〜×3 に 0.25・0.5 を足したもの） */
export const FILM_SPEEDS: readonly number[] = [0.25, 0.5, 1, 1.5, 2, 3];
/** カメラのズーム（寄りだけ。引くと背景の端が見えるため） */
export const FILM_ZOOMS: readonly number[] = [1, 1.25, 1.5, 2];

const KEY = 'dstage-film';

export function defaultFilmConfig(): FilmConfig {
  return {
    characterId: 'kuya', stageId: 1, mainLevel: 1, arts: [], fusions: [], supports: [],
    noSpawn: true, invincible: true, fullGauge: true, noLevelUp: true, hudOff: false, enemyImmortal: false, noAttack: false,
  };
}

export function loadFilmConfig(): FilmConfig {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return defaultFilmConfig();
    const p = JSON.parse(raw) as Partial<FilmConfig>;
    return { ...defaultFilmConfig(), ...p, arts: [...(p.arts ?? [])], fusions: [...(p.fusions ?? [])], supports: [...(p.supports ?? [])] };
  } catch {
    return defaultFilmConfig();
  }
}

export function saveFilmConfig(cfg: FilmConfig): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {
    /* 保存できない環境では無視 */
  }
}
