// カラーバリエーション（v2 §10.5 エールの使い道）。ドットの色をコードでパレット置換（HSV シフト）する。
// 現代編の姿を連想させる配色（雪人の黒×白ファーなど）は避ける。名前は仮。

export interface ColorVariantDef {
  id: string;
  name: string;
  /** 色相のシフト（0〜1、+0.5 で補色） */
  hue: number;
  /** 彩度の倍率 */
  sat: number;
  /** 明度の倍率 */
  val: number;
  cost: number;
}

export const COLOR_VARIANTS: Record<string, ColorVariantDef[]> = {
  kuya: [
    { id: 'silver', name: '星霜', hue: 0, sat: 0.35, val: 1.1, cost: 150 },
    { id: 'dusk', name: '黄昏', hue: 0.55, sat: 1.0, val: 1.0, cost: 150 },
  ],
  mizuho: [
    { id: 'leaf', name: '若葉', hue: -0.2, sat: 0.95, val: 1.05, cost: 150 },
    { id: 'coral', name: '珊瑚', hue: 0.5, sat: 0.9, val: 1.05, cost: 150 },
  ],
  yukihito: [
    { id: 'indigo', name: '群青', hue: 0.6, sat: 1.4, val: 0.95, cost: 150 },
    { id: 'ash', name: '灰燼', hue: 0, sat: 0.5, val: 0.85, cost: 150 },
  ],
  ritsuka: [
    { id: 'azure', name: '蒼炎', hue: 0.5, sat: 1.0, val: 1.0, cost: 150 },
    { id: 'pale', name: '白夜', hue: 0, sat: 0.4, val: 1.15, cost: 150 },
  ],
};

/** バリエーション適用後のスプライトキー */
export const variantKey = (charaId: string, variantId: string) => `chara_${charaId}_${variantId}`;
