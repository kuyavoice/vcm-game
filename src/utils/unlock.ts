import { CHARACTERS, CHARACTER_ORDER, DEFAULT_CHARACTER } from '../data/characters';
import { loadSave, writeSave, type SaveData } from './storage';

/**
 * キャラの解放まわりをまとめたもの。
 * 隠しキャラ（CharacterDef.secret）は、解放するまでどの画面にも出さない。
 */

/** URLに `?debug` が付いている（確認用） */
const DEBUG = typeof location !== 'undefined' && /debug/.test(location.search);
/** URLに `?judge` が付いている（審査モード。2026-10-05）：全ステージ・隠しキャラ以外の全キャラを解放済みとして遊べる。デバッグの表示は出ない。記録・エール・実績は保存しない */
const JUDGE = typeof location !== 'undefined' && /[?&]judge(?:[&=]|$)/.test(location.search);
export const isJudge = () => JUDGE;
/** 仮の解放（?debug か ?judge） */
export const isTrialUnlock = () => DEBUG || JUDGE;

/** セーブの上で本当に解放しているか（`?debug` の仮の解放は含まない） */
export function isCharacterOwned(id: string, save: SaveData): boolean {
  const def = CHARACTERS[id];
  if (!def) return false;
  if (def.secret) return save.unlockedCharacters.includes(id);
  return def.unlockYell === 0 || save.unlockedCharacters.includes(id);
}

/**
 * 選べるキャラか。`?debug` のときは、隠しキャラ以外を解放済みとして扱う（セーブは書き換えない）。
 * 仮の解放で選んだキャラのプレイは、記録・エールを保存しない（GameScene 側）。
 */
export function isCharacterUnlocked(id: string, save: SaveData): boolean {
  const def = CHARACTERS[id];
  if (!def) return false;
  if ((DEBUG || JUDGE) && !def.secret) return true;
  return isCharacterOwned(id, save);
}

/** 画面に出してよいキャラ（表示順）。隠しキャラは解放後だけ */
export function visibleCharacters(save: SaveData): string[] {
  return CHARACTER_ORDER.filter((id) => !CHARACTERS[id].secret || isCharacterUnlocked(id, save));
}

/** いま選択中として扱うキャラ。保存値が未解放・不明なら既定のキャラ */
export function resolveCharacter(save: SaveData): string {
  const id = save.settings.character;
  return CHARACTERS[id] && isCharacterUnlocked(id, save) ? id : DEFAULT_CHARACTER;
}

/** 出現演出をまだ見せていない隠しキャラか */
export function isSecretPending(id: string, save: SaveData): boolean {
  return save.secretNew[id] === 'pending';
}

/** NEW の印を付けるか（一度選ぶまで） */
export function hasNewBadge(id: string, save: SaveData): boolean {
  return id in save.secretNew;
}

/** 隠しキャラを解放する（すでに解放済みなら何もしない）。返り値: 新しく解放したら true */
export function unlockSecret(id: string): boolean {
  const sv = loadSave();
  if (sv.unlockedCharacters.includes(id)) return false;
  sv.unlockedCharacters.push(id);
  sv.secretNew[id] = 'pending';
  writeSave(sv);
  return true;
}

/** 出現演出を見せ終えた */
export function markSecretShown(id: string): void {
  const sv = loadSave();
  if (sv.secretNew[id] !== 'pending') return;
  sv.secretNew[id] = 'shown';
  writeSave(sv);
}

/** 一度選んだので NEW の印を外す */
export function clearNewBadge(id: string): void {
  const sv = loadSave();
  if (!(id in sv.secretNew)) return;
  delete sv.secretNew[id];
  writeSave(sv);
}
