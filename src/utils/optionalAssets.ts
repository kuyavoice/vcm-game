/**
 * 「置けば使われる」任意アセット（立ち絵・マスコット画像など）の存在確認。
 * 開発サーバは未配置パスに index.html を返すため、Content-Type で判定する。
 */
import { GALLERY, galleryKey } from '../data/gallery';

export const OPTIONAL_IMAGES: Record<string, string> = {
  luna_chibi: 'assets/images/luna_chibi.png',
  // キャラ選択画面のドット立ち絵（高さ約130px・整数倍で表示）
  portrait_kuya: 'assets/images/portrait/kuya_portrait.png',
  portrait_mizuho: 'assets/images/portrait/mizuho_portrait.png',
  portrait_yukihito: 'assets/images/portrait/yukihito_portrait.png',
  portrait_ritsuka: 'assets/images/portrait/ritsuka_portrait.png',
  portrait_shion: 'assets/images/portrait/shion_portrait.png',
  // クリア時の勝利立ち絵（透過・1024×1536）。起動時には読まず、リザルトで必要な1枚だけ読む。無ければ通常の立ち絵
  victory_kuya: 'assets/images/victory/kuya_victory.webp',
  victory_mizuho: 'assets/images/victory/mizuho_victory.webp',
  victory_yukihito: 'assets/images/victory/yukihito_victory.webp',
  victory_ritsuka: 'assets/images/victory/ritsuka_victory.webp',
  victory_shion: 'assets/images/victory/shion_victory.webp',
};

// ギャラリーの絵（ファイル候補ごとに存在確認する。読み込みはギャラリー画面で、解放済みのものだけ）
for (const g of GALLERY) g.files.forEach((f, i) => { OPTIONAL_IMAGES[galleryKey(g.id, i)] = f; });

/** 起動時に読まず、使う場面で読む画像（キーの接頭辞） */
export const LAZY_IMAGE_PREFIXES = ['victory_', 'gal_'];
export const isLazyImage = (key: string) => LAZY_IMAGE_PREFIXES.some((p) => key.startsWith(p));

const available = new Set<string>();

export async function probeOptionalImages(baseUrl: string): Promise<void> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 2500);
  await Promise.all(
    Object.entries(OPTIONAL_IMAGES).map(async ([key, path]) => {
      try {
        const res = await fetch(baseUrl + path, { method: 'HEAD', signal: ctl.signal });
        const type = res.headers.get('content-type') ?? '';
        if (res.ok && type.startsWith('image/')) available.add(key);
      } catch {
        /* 未配置 */
      }
    }),
  );
  clearTimeout(timer);
}

export function hasOptionalImage(key: string): boolean {
  return available.has(key);
}
