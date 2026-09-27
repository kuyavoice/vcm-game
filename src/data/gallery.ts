// イラストギャラリー（オマケ要素）。まずはキャラ別キービジュアルだけ。
// 画像は「置けば使われる」方式：public/assets/images/gallery/ に下のファイル名で置くと一覧に出る（無ければ出ない）。
// 隠しキャラの絵は、そのキャラを解放するまで枠ごと出さない（存在をほのめかさない）。

import { CHARACTERS } from './characters';

export interface GalleryDef {
  id: string;
  /** 一覧・閲覧画面に出す名前（本編の出来事に触れない。キャラ名や情景だけ） */
  title: string;
  sub: string;
  /** 差し色 */
  color: number;
  /** 置くファイル（先頭から順に探す。webp 推奨、png でも可） */
  files: string[];
  /** 解放に必要なエール */
  price: number;
  /** このキャラを解放するまで、枠ごと出さない */
  secretOf?: string;
}

export const GALLERY_DIR = 'assets/images/gallery/';

const kv = (characterId: string, price: number, secret = false): GalleryDef => ({
  id: `kv_${characterId}`,
  title: CHARACTERS[characterId].name,
  sub: 'KEY VISUAL',
  color: CHARACTERS[characterId].color,
  files: [`${GALLERY_DIR}kv_${characterId}.webp`, `${GALLERY_DIR}kv_${characterId}.png`],
  price,
  secretOf: secret ? characterId : undefined,
});

export const GALLERY: GalleryDef[] = [
  kv('kuya', 300),
  kv('mizuho', 300),
  kv('yukihito', 300),
  kv('ritsuka', 300),
  kv('shion', 300, true),
];

/** 画像の存在確認・読み込みに使うキー（ファイル候補ごと） */
export const galleryKey = (id: string, fileIndex: number) => `gal_${id}_${fileIndex}`;
