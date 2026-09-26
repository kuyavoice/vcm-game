// カットイン用の顔画像。ポータルサイトの立ち絵（{id}_normal.webp）から顔部分を 256×256 に切り出したもの。
// 使い手の表示名（weapons.ts / passives.ts の owner）→ 画像ID。

export const PORTRAIT_DIR = 'assets/images/face/';

export const PORTRAITS: Record<string, string> = {
  '宵月 空夜': 'kuya',
  '寿 律花': 'ritsuka',
  '黒崎 詩音': 'shion',
  '狐森 雪人': 'yukihito',
  '振須 響': 'hibiki',
  '弼辺 徹': 'itaru',
  '月怜 瑞穂': 'mizuho',
  '呱々崎 璦萌': 'tamamo',
  '護乃 豪': 'gou',
  '嘉地 杏子': 'kyoko',
  '若宮 征士郎': 'seishirou',
  '晴山 樹': 'itsuki',
  '天宮 澪': 'rei',
  '片桐 玄人': 'kurodo',
  '月惺 あめ': 'ame',
  '鈴鳴 拳士郎': 'kenshirou',
  '蜂城 美麗': 'mirei',
  '月景 遼': 'ryo',
  '瀬田 奏真': 'soma',
  '一色 紗理': 'sari',
  '音染 悠理': 'yuri',
  '孤ヶ爪 ミヤコ': 'miyako',
};

export const portraitKey = (id: string) => `face_${id}`;
