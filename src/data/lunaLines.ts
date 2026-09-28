// 宝箱の開封画面で、ルナ（チビ）が言う台詞（追補パッチ⑨）。
//
// 台詞を足す・直すときの決まりごと（厳守）：
// - 一人称は「妾」のみ。語尾は「〜じゃ」「〜のう」、笑いは「かかか！」。尊大だが根は慈愛。
// - 瑞穂の呼び方は「瑞穂」または「主」。
// - 「共犯者」は使わない。
// - ルナが力を「授ける」「与える」言い回しはしない（宝箱は美麗のもの。ルナは見守って褒めるだけ）。
// - 瑞穂以外のキャラ専用の台詞は作らない。隠しキャラを操作している時も、共通の台詞だけ。
// - 『月の加護』、ペインシェア、ルナの正体、予言、別れに触れない。

/** 開封結果のグループ。優先順は 合体 → 進化 → 通常（Lvアップ） */
export type LunaGroup = 'normal' | 'evolve' | 'fusion';

/** 全キャラ共通 */
export const LUNA_LINES: Record<LunaGroup, string[]> = {
  normal: [
    'ふむ。',
    'よいぞよいぞ。',
    'ふむ、悪くない。この調子じゃ。',
    '焦るでないぞ。夜はまだ長いのじゃ。',
    '怯むな。お主の声は、まだ途切れておらぬ。',
    'ほれ、磨けば光るというものじゃ。',
    'かかか！ なかなかやるではないか。',
    '妾が見ておる。存分に暴れるがよい。',
    'ふむ……良い顔になってきたのう。',
  ],
  evolve: [
    'ほう……強くなったのう。',
    'ここまで磨き上げたか。見事じゃ。',
    'かかか！ 見違えたわ。',
    'その技、もはや一人前じゃのう。',
  ],
  fusion: [
    'むっ……凄まじい力を感じるのう。',
    '二つの声が重なりおった。これは見ものじゃ。',
    '絆が形になったか。……よいものじゃのう。',
    'かかか！ 妾でも少々驚いたぞ。',
  ],
};

/** 瑞穂を操作している時だけ混ざる */
export const LUNA_LINES_MIZUHO: Record<LunaGroup, string[]> = {
  normal: [
    'かかか！ さすがは妾の主じゃ。',
    'その顔じゃ、瑞穂。胸を張れ。',
    '瑞穂よ、無理はするでないぞ。……いや、今は存分にやれ。',
    'まったく、世話の焼ける主じゃ。……よくやったのう。',
  ],
  evolve: [
    'ほう、瑞穂よ。随分と強くなったのう。',
    'かかか！ 妾の主は、まだまだ伸びるのう。',
  ],
  fusion: [
    '瑞穂よ、良き仲間の声じゃな。大事にせい。',
  ],
};

/** 瑞穂の操作中に、瑞穂専用の台詞を選ぶ確率 */
export const LUNA_MIZUHO_CHANCE = 0.5;

/** 直前に出した台詞（同じ台詞を続けて出さない） */
let last = '';

/** グループの中からランダムに1つ。直前と同じ台詞は出さない */
export function pickLunaLine(group: LunaGroup, characterId: string): string {
  const useMizuho = characterId === 'mizuho' && Math.random() < LUNA_MIZUHO_CHANCE;
  let pool = (useMizuho ? LUNA_LINES_MIZUHO[group] : LUNA_LINES[group]).filter((l) => l !== last);
  // 瑞穂専用が1つしか無く、それが直前の台詞だったときは、共通から選ぶ
  if (pool.length === 0) pool = LUNA_LINES[group].filter((l) => l !== last);
  const line = pool[Math.floor(Math.random() * pool.length)] ?? LUNA_LINES[group][0];
  last = line;
  return line;
}
