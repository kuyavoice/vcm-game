/**
 * いま押されているキー（KeyboardEvent.code）。ウィンドウで直接数える。
 * シーンのキー入力は、シーンが止まっている間（レベルアップ・宝箱の画面）の押下を拾えない。
 * その間に押したキーは、画面を閉じたあとも「押されていない」ままになり、
 * OSのキーリピートが始まるまで（約0.5秒）動けなかった。ここで数えておけば、閉じた瞬間から動ける。
 */
const held = new Set<string>();

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (ev) => { held.add(ev.code); });
  window.addEventListener('keyup', (ev) => { held.delete(ev.code); });
  // フォーカスを失うと keyup が届かないので、全部離したことにする
  window.addEventListener('blur', () => held.clear());
  document.addEventListener('visibilitychange', () => { if (document.hidden) held.clear(); });
}

export const isHeld = (...codes: string[]) => codes.some((c) => held.has(c));
