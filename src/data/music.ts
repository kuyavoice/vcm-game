// ミュージック（ゲーム内の曲を聴くモード）。エールで解放する。
// 曲名はユーザー指定（2026-09-27）。キャラ曲はキャラクターソングのアレンジ。
// 隠しキャラの曲は、そのキャラを解放するまで枠ごと出さない。

export interface MusicDef {
  id: string;
  /** 音声のキー（data/audio.ts） */
  key: string;
  title: string;
  sub: string;
  color: number;
  /** 解放に必要なエール（0 = 最初から聴ける） */
  price: number;
  /** このキャラを解放するまで、枠ごと出さない */
  secretOf?: string;
}

const PRICE = 200;
const ARRANGE = 'D-SURVIVORS Arrange';
const FANFARE = 'fanfare';

/** キャラクターソング1曲につき、道中のアレンジとクリア時のファンファーレの2つ */
function song(characterId: string, name: string, title: string, color: number, secret = false): MusicDef[] {
  const secretOf = secret ? characterId : undefined;
  return [
    { id: `chara_${characterId}`, key: `bgm_chara_${characterId}`, title, sub: `${name} ／ ${ARRANGE}`, color, price: PRICE, secretOf },
    { id: `clear_${characterId}`, key: `bgm_clear_${characterId}`, title, sub: `${name} ／ ${FANFARE}`, color, price: PRICE, secretOf },
  ];
}

export const MUSIC: MusicDef[] = [
  { id: 'title', key: 'bgm_title', title: 'D-STAGE SURVIVORS', sub: 'タイトル', color: 0x87ceeb, price: 0 },
  ...song('kuya', '宵月 空夜', 'Shattered Skies', 0x87ceeb),
  ...song('mizuho', '月怜 瑞穂', '怜水閃', 0x87cefa),
  ...song('yukihito', '狐森 雪人', '白銀の残響', 0xe8f4ff),
  ...song('ritsuka', '寿 律花', '声の魔女', 0xff4500),
  ...song('shion', '黒崎 詩音', 'Stardust Requiem', 0xc0c0ff, true),
  { id: 'fullmoon', key: 'bgm_fullmoon', title: '満ちる月 ― Rising of the Full Moon', sub: '満月', color: 0xfff6d5, price: PRICE },
  { id: 'boss_rook', key: 'bgm_boss_rook', title: '動く城塞', sub: '城兵級のテーマ', color: 0x40e0ff, price: PRICE },
  { id: 'boss_queen', key: 'bgm_boss_queen', title: '茨の女王', sub: '女王級のテーマ', color: 0xffc83d, price: PRICE },
  { id: 'boss_blackknight', key: 'bgm_boss_blackknight', title: '漆黒の闇', sub: '黒騎士のテーマ ／ 前編', color: 0x9d4dff, price: PRICE },
  { id: 'boss_blackknight2', key: 'bgm_boss_blackknight2', title: '沈黙の世界', sub: '黒騎士のテーマ ／ 後編', color: 0x9d4dff, price: PRICE },
  { id: 'boss_redknight', key: 'bgm_boss_redknight', title: '悪夢の黒騎士 ― Knight of the Black Snow', sub: '悪夢の黒騎士のテーマ', color: 0xff2244, price: PRICE },
  // 旧版のボス戦の曲（2026-10-01 ユーザー指定：「旧版ボス戦」と補足して残す）
  { id: 'boss', key: 'bgm_boss', title: '立ちふさがる強敵', sub: '旧版ボス戦', color: 0xff4d6d, price: PRICE },
  { id: 'gameover', key: 'bgm_gameover', title: 'おやすみなさい', sub: 'ゲームオーバー', color: 0x8fa3d9, price: PRICE },
];
