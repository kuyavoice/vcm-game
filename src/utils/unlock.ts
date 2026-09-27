import { CHARACTERS, CHARACTER_ORDER, DEFAULT_CHARACTER } from '../data/characters';
import { loadSave, writeSave, type SaveData } from './storage';

/**
 * キャラの解放まわりをまとめたもの。
 * 隠しキャラ（CharacterDef.secret）は、解放するまでどの画面にも出さない。
 */

/** 確認用：URLに `?secret=shion` でそのセッションだけ使える（保存しない）。`?secret=shion-new` は出現演出の確認用 */
function previewParam(): string {
  if (typeof location === 'undefined') return '';
  return new URLSearchParams(location.search).get('secret') ?? '';
}

export function isSecretPreview(id: string): boolean {
  const p = previewParam();
  return p === id || p === `${id}-new`;
}

export function isCharacterUnlocked(id: string, save: SaveData): boolean {
  const def = CHARACTERS[id];
  if (!def) return false;
  if (def.secret) return save.unlockedCharacters.includes(id) || isSecretPreview(id);
  return def.unlockYell === 0 || save.unlockedCharacters.includes(id);
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
  return save.secretNew[id] === 'pending' || previewParam() === `${id}-new`;
}

/** NEW の印を付けるか（一度選ぶまで） */
export function hasNewBadge(id: string, save: SaveData): boolean {
  return id in save.secretNew || previewParam() === `${id}-new`;
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
