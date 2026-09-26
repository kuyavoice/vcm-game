// 合体システム（v2 §5.5）：レシピの2つが両方Lv8（進化前後どちらでも可）で宝箱を開けると合体。武器枠が1つ空く。
// 優先：①合体 → ②進化 → ③通常Lvアップ。合体が複数成立したら priority の小さい順。

export interface FusionDef {
  /** 合体アーツの武器ID（weapons.ts に kind:'art', fusion:true で定義） */
  id: string;
  a: string;
  b: string;
  /** このキャラ操作時のみ成立 */
  requiredChara?: string;
  priority: number;
  /** 図鑑用のヒント（半分だけ示す） */
  hint: string;
}

export const FUSIONS: FusionDef[] = [
  { id: 'tristar', a: 'setsugekka', b: 'hoshikuzu', requiredChara: 'kuya', priority: 1, hint: '白銀の斬撃と、誰かの星が共鳴する……空夜でのみ' },
  { id: 'nekobako', a: 'guren', b: 'aqua', priority: 2, hint: '燃える矢と、水の盾。相反するふたつが……' },
  { id: 'meteocage', a: 'hoshikuzu', b: 'cage', priority: 3, hint: '星の裁きと、重力の檻が……' },
  { id: 'honjin', a: 'ganga', b: 'shuraba', priority: 4, hint: '地割れと鉄柵。ふたりの守りが……' },
  { id: 'ricochet', a: 'refresh', b: 'bug', priority: 5, hint: '跳ね返る弾と、蹴り飛ばすバグが……' },
];

export function fusionFor(a: string, b: string): FusionDef | undefined {
  return FUSIONS.find((f) => (f.a === a && f.b === b) || (f.a === b && f.b === a));
}
