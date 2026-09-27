// イラストギャラリー（オマケ要素）。キャラ別キービジュアル（全23人）。
// 画像は「置けば使われる」方式：public/assets/images/gallery/ に kv_{id}.webp があれば一覧に出る（無ければ出ない）。
// 一覧用の小さい絵は gallery/thumb/ の同名ファイル（元PNGから一緒に作る。手順は CLAUDE.md）。
// 隠しキャラの絵は、そのキャラを解放するまで枠ごと出さない（存在をほのめかさない）。

export interface GalleryDef {
  id: string;
  /** 一覧・閲覧画面に出す名前（本編の出来事に触れない。キャラ名や情景だけ） */
  title: string;
  sub: string;
  /** 差し色 */
  color: number;
  /** 全画面表示用の絵 */
  file: string;
  /** 一覧用の小さい絵 */
  thumb: string;
  /** 解放に必要なエール */
  price: number;
  /** このキャラを解放するまで、枠ごと出さない */
  secretOf?: string;
  /** クリア報酬（エールでは買えない）。手に入れるまで枠ごと出さない */
  rewardOf?: 'nightmare';
  /** 横長の絵（一覧では横幅いっぱいの枠で見せる） */
  wide?: boolean;
}

export const GALLERY_DIR = 'assets/images/gallery/';
const KV_PRICE = 300;

/** 暗すぎる色は、暗い背景でも枠が見えるように明るくする */
function visible(color: number): number {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum >= 0.32) return color;
  const mix = (v: number) => Math.round(v + (255 - v) * 0.5);
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

const kv = (fileId: string, name: string, color: number, secretOf?: string): GalleryDef => ({
  id: `kv_${fileId}`,
  title: name,
  sub: 'KEY VISUAL',
  color: visible(color),
  file: `${GALLERY_DIR}kv_${fileId}.webp`,
  thumb: `${GALLERY_DIR}thumb/kv_${fileId}.webp`,
  price: KV_PRICE,
  secretOf,
});

/** EXステージ「悪夢」のクリア報酬。どちらも隠しキャラが描かれているので secretOf を付ける */
const special = (fileId: string, title: string, color: number): GalleryDef => ({
  id: `sp_${fileId}`,
  title,
  sub: 'SPECIAL',
  color,
  file: `${GALLERY_DIR}sp_${fileId}.webp`,
  thumb: `${GALLERY_DIR}thumb/sp_${fileId}.webp`,
  price: 0,
  secretOf: 'shion',
  rewardOf: 'nightmare',
  wide: true,
});

// 並びはポータルサイトのキャラ番号順。ファイル名は受け取ったときの綴りのまま（ituki／kenshiro／seishiro）
export const GALLERY: GalleryDef[] = [
  special('stainedglass', 'VERSE', 0xffd700),
  special('congratulation', 'CONGRATULATIONS!', 0xffd700),
  kv('kuya', '宵月 空夜', 0x00bfff),
  kv('yukihito', '狐森 雪人', 0xc0c0c0),
  kv('shion', '黒崎 詩音', 0xc0c0ff, 'shion'),
  kv('mizuho', '月怜 瑞穂', 0x87cefa),
  kv('ritsuka', '寿 律花', 0xff69b4),
  kv('ituki', '晴山 樹', 0xff8c00),
  kv('gou', '護乃 豪', 0x8b4513),
  kv('kyoko', '嘉地 杏子', 0xdc143c),
  kv('itaru', '弼辺 徹', 0x4169e1),
  kv('kenshiro', '鈴鳴 拳士郎', 0x228b22),
  kv('hibiki', '振須 響', 0x00ced1),
  kv('soma', '瀬田 奏真', 0x556b2f),
  kv('mirei', '蜂城 美麗', 0xffd700),
  kv('rei', '天宮 澪', 0x708090),
  kv('miyako', '孤ヶ爪 ミヤコ', 0xd2b48c),
  kv('kurodo', '片桐 玄人', 0x2f4f4f),
  kv('yuri', '音染 悠理', 0x8a2be2),
  kv('tamamo', '呱々崎 璦萌', 0xffb6c1),
  kv('ame', '月惺 あめ', 0xf0e68c),
  kv('seishiro', '若宮 征士郎', 0x1c1c1c),
  kv('sari', '一色 紗理', 0x191970),
  kv('ryo', '月景 遼', 0x008080),
  kv('kai', '久遠 戒', 0x4b0082),
];

/** 画像の存在確認・読み込みに使うキー */
export const galleryKey = (id: string) => `gal_${id}`;
export const galleryThumbKey = (id: string) => `galt_${id}`;
