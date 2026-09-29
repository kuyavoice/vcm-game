import type Phaser from 'phaser';

/** 行の頭に置かない文字 */
const NO_HEAD = '、。，．・：；？！）」』】〕〉》…ー々ゃゅょっャュョッ';
/** 行の末に置かない文字 */
const NO_TAIL = '（「『【〔〈《';

/**
 * 日本語の折り返し（Text の wordWrap.callback に渡す）。
 * 1文字ずつ詰めて、幅を超えたら改行する。行の頭に句読点や閉じ括弧が来るときは、前の1文字ごと次の行へ送る。
 */
export function wrapJa(text: string, obj: Phaser.GameObjects.Text): string[] {
  const width = obj.style.wordWrapWidth ?? 0;
  if (!width) return text.split('\n');
  const ctx = obj.context;
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (line && ctx.measureText(line + ch).width > width) {
        let carry = '';
        if (NO_HEAD.includes(ch) && line.length > 1) {
          carry = line.slice(-1);
          line = line.slice(0, -1);
        }
        while (line.length > 1 && NO_TAIL.includes(line.slice(-1))) {
          carry = line.slice(-1) + carry;
          line = line.slice(0, -1);
        }
        out.push(line);
        line = carry;
      }
      line += ch;
    }
    out.push(line);
  }
  return out;
}
