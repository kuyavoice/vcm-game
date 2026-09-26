/**
 * 「置けば使われる」任意アセット（立ち絵・マスコット画像など）の存在確認。
 * 開発サーバは未配置パスに index.html を返すため、Content-Type で判定する。
 */
export const OPTIONAL_IMAGES: Record<string, string> = {
  luna_chibi: 'assets/images/luna_chibi.png',
  // キャラ選択画面のドット立ち絵（高さ約130px・整数倍で表示）
  portrait_kuya: 'assets/images/portrait/kuya_portrait.png',
  portrait_mizuho: 'assets/images/portrait/mizuho_portrait.png',
  portrait_yukihito: 'assets/images/portrait/yukihito_portrait.png',
  portrait_ritsuka: 'assets/images/portrait/ritsuka_portrait.png',
};

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
