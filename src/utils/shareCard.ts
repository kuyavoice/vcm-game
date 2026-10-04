// リザルトの共有画像（1080×1920）をオフスクリーンで描いて、共有シート／ダウンロードに渡す（v2 §10.5）

import type { RunResult } from '../scenes/ResultScene';
import { CHARACTERS } from '../data/characters';
import { stageById } from '../data/stages';
import { endlessTitle, endlessLoop } from '../data/endless';
import { rushTitle, fmtTime } from '../data/rush';

export const SHARE_URL = 'https://kuyavoice.github.io/vcm-game/';
export const SHARE_TAG = '#DSTAGESURVIVORS';
const GAME_TITLE = 'D-STAGE SURVIVORS';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

/** 1080×1920 の共有画像を生成 */
export async function renderShareCard(r: RunResult): Promise<Blob | null> {
  const W = 1080;
  const H = 1920;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  if (!g) return null;
  const chara = CHARACTERS[r.characterId];
  const stage = stageById(r.stageId ?? 1);
  const accent = hex(chara?.color ?? 0x87ceeb);
  const endless = !!stage.endless;
  const rush = !!stage.rush;
  const rushTime = rush && r.rush && r.rush.loopTimes.length > 0 ? r.rush.loopTimes[0] : null;
  const win = r.cleared || endless || rushTime !== null;

  // 背景：ステージの基調色＋夜空
  const base = stage.id === 3 ? '#2a3140' : stage.id === 2 ? '#141a33' : '#0b1026';
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#060913');
  grad.addColorStop(0.5, base);
  grad.addColorStop(1, '#060913');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // 星
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`;
    const sz = rnd() < 0.15 ? 3 : 2;
    g.fillRect(rnd() * W, rnd() * H, sz, sz);
  }
  // 斜め帯
  g.fillStyle = 'rgba(135,206,235,0.06)';
  g.beginPath(); g.moveTo(W * 0.55, 0); g.lineTo(W, 0); g.lineTo(W, H * 0.6); g.lineTo(W * 0.3, H); g.lineTo(0, H); g.closePath(); g.fill();

  // 立ち絵：クリア時は勝利立ち絵（下端をなめらかに消す）→ 無ければ通常の立ち絵 → ドット立ち絵
  // クリア＝勝利立ち絵／それ以外＝ゲームオーバーの立ち絵（無ければ通常の立ち絵）
  const victory = await loadImage(win ? `assets/images/victory/${r.characterId}_victory.webp` : `assets/images/gameover/${r.characterId}_gameover.webp`);
  let standing: CanvasImageSource & { width: number; height: number } | null = null;
  if (victory) {
    const vc = document.createElement('canvas');
    vc.width = victory.width;
    vc.height = victory.height;
    const vg = vc.getContext('2d');
    if (vg) {
      vg.drawImage(victory, 0, 0);
      vg.globalCompositeOperation = 'destination-in';
      const fade = vg.createLinearGradient(0, vc.height * 0.82, 0, vc.height);
      fade.addColorStop(0, 'rgba(0,0,0,1)');
      fade.addColorStop(1, 'rgba(0,0,0,0)');
      vg.fillStyle = fade;
      vg.fillRect(0, 0, vc.width, vc.height);
      // 左右の端もぼかす（リザルト画面と同じ）
      const side = vg.createLinearGradient(0, 0, vc.width, 0);
      side.addColorStop(0, 'rgba(0,0,0,0)');
      side.addColorStop(0.1, 'rgba(0,0,0,1)');
      side.addColorStop(0.84, 'rgba(0,0,0,1)');
      side.addColorStop(1, 'rgba(0,0,0,0)');
      vg.fillStyle = side;
      vg.fillRect(0, 0, vc.width, vc.height);
      standing = vc;
    } else standing = victory;
  }
  standing ??= (await loadImage(chara?.standing ?? '')) ?? (await loadImage(`assets/images/portrait/${r.characterId}_portrait.png`));
  if (standing) {
    const targetH = H * 0.62;
    const sc = targetH / standing.height;
    const w = standing.width * sc;
    g.save();
    g.globalAlpha = 0.95;
    g.imageSmoothingEnabled = standing.height > 400;
    g.drawImage(standing, W * 0.30 - w / 2, H * 0.22, w, targetH);
    g.restore();
  }

  const en = (size: number, weight = 700) => `${weight} ${size}px "Oswald","Segoe UI",sans-serif`;
  const jp = (size: number, weight = 700) => `${weight} ${size}px "Noto Sans JP","Hiragino Sans",sans-serif`;
  g.textBaseline = 'top';

  // タイトル（結果）
  g.textAlign = 'center';
  g.shadowColor = '#060913'; g.shadowBlur = 24;
  g.fillStyle = rush ? (rushTime !== null ? '#FF8C42' : '#FF4D6D') : endless ? '#FFD700' : r.cleared ? '#87CEEB' : '#FF4D6D';
  g.font = en(120);
  g.fillText(rush ? 'BOSS RUSH' : endless ? 'ENDLESS' : r.cleared ? 'SIGNAL CLEAR' : 'SIGNAL LOST', W / 2, 120);
  g.fillStyle = endless || rushTime !== null ? '#FFD700' : '#FFFFFF';
  g.font = jp(endless || rushTime !== null ? 52 : 44);
  g.fillText(rush ? (rushTime !== null ? `称号　「${rushTitle(rushTime)}」` : '声が、途切れた……') : endless ? `称号　「${endlessTitle(r.timeSec).name}」` : r.cleared ? '声は、届いた。' : '声が、途切れた……', W / 2, 262);
  g.shadowBlur = 0;

  // スタッツパネル
  const px = W * 0.56;
  const py = H * 0.34;
  const pw = W * 0.40;
  const hasScore = r.score !== undefined;
  const pitch = hasScore ? 72 : 80;
  const ph = 28 + (hasScore ? 8 : 7) * pitch;
  g.fillStyle = 'rgba(11,16,38,0.88)';
  g.fillRect(px, py, pw, ph);
  g.strokeStyle = accent; g.lineWidth = 3;
  g.strokeRect(px, py, pw, ph);
  const mm = Math.floor(r.timeSec / 60).toString().padStart(2, '0');
  const ss = Math.floor(r.timeSec % 60).toString().padStart(2, '0');
  const rows: [string, string, boolean][] = rush ? [
    ['TIME', rushTime !== null ? fmtTime(rushTime) : '—', false],
    ['LOOPS', `${r.rush?.loopTimes.length ?? 0}周クリア`, true],
    ['BOSSES', `${r.rush?.bossesDefeated ?? 0}`, false],
    ['CHARACTER', chara?.name ?? r.characterId, true],
    ['DEFEATED', `${r.kills}`, false],
    ['YELL', `★ ${r.yell}`, false],
    ['SPEED', `×${r.speed ?? 1}`, false],
  ] : endless ? [
    ['TIME', `${mm}:${ss}`, false],
    ['LOOP', `${endlessLoop(r.timeSec)}周目`, true],
    ['SCORE', (r.score ?? 0).toLocaleString(), false],
    ['CHARACTER', chara?.name ?? r.characterId, true],
    ['DEFEATED', `${r.kills}`, false],
    ['LEVEL', `${r.level}`, false],
    ['YELL', `★ ${r.yell}`, false],
    ['SPEED', `×${r.speed ?? 1}`, false],
  ] : [
    ...(hasScore ? [['SCORE', (r.score ?? 0).toLocaleString(), false] as [string, string, boolean]] : []),
    ['CHARACTER', chara?.name ?? r.characterId, true],
    ['STAGE', stage.scoreMode ? stage.nameEn : `${stage.nameEn}  ${stage.name}`, true],
    ['TIME', `${mm}:${ss}`, false],
    ['DEFEATED', `${r.kills}`, false],
    ['LEVEL', `${r.level}`, false],
    ['YELL', `★ ${r.yell}`, false],
    ['SPEED', `×${r.speed ?? 1}`, false],
  ];
  g.textAlign = 'left';
  rows.forEach(([k, v, isJp], i) => {
    const y = py + 20 + i * pitch;
    g.fillStyle = '#8A94B8'; g.font = en(22);
    g.fillText(k, px + 24, y);
    const main = (endless || rush) && k === 'TIME';
    g.fillStyle = main ? '#FFD700' : '#FFFFFF'; g.font = isJp ? jp(32) : en(main ? 46 : 40);
    g.fillText(v, px + 24, y + (main ? 22 : 26));
  });

  // ビルド：初期武器・共鳴アーツ（左の列）と、サポート（右の列）。進化・合体は強調。立ち絵と重なっても読めるように下地を敷く
  type Row = { name: string; tag: string; color: number; gold: boolean };
  const artRows: Row[] = [];
  if (r.main) artRows.push({ name: r.main.name, tag: `Lv${r.main.level}`, color: r.main.color, gold: false });
  for (const a of r.arts ?? []) artRows.push({ name: a.name, tag: a.fusion ? 'FUSION' : a.evolved ? 'EVO' : `Lv${a.level}`, color: a.color, gold: a.fusion || a.evolved });
  const supRows: Row[] = (r.passives ?? []).map((p) => ({ name: p.name, tag: `Lv${p.level}`, color: p.color, gold: false }));
  if (artRows.length + supRows.length > 0) {
    const bx = 40;
    const bw = W - 80;
    const by = py + ph + 24;
    const rowH = 46;
    const lines = Math.max(artRows.length, supRows.length, 1);
    g.fillStyle = 'rgba(11,16,38,0.86)';
    g.fillRect(bx, by, bw, 62 + lines * rowH + 12);
    g.strokeStyle = accent; g.lineWidth = 3;
    g.strokeRect(bx, by, bw, 62 + lines * rowH + 12);
    const col = (x: number, head: string, list: Row[]) => {
      g.textAlign = 'left';
      g.fillStyle = '#87CEEB'; g.font = en(26);
      g.fillText(head, x, by + 16);
      list.forEach((it, i) => {
        const y = by + 60 + i * rowH;
        g.fillStyle = hex(it.color);
        g.fillRect(x, y + 5, 9, 30);
        g.fillStyle = it.gold ? '#FFD700' : '#FFFFFF';
        g.font = jp(27);
        g.textAlign = 'left';
        g.fillText(it.name, x + 20, y);
        g.fillStyle = it.gold ? '#FFD700' : '#8A94B8';
        g.font = en(24);
        g.textAlign = 'right';
        g.fillText(it.tag, x + bw / 2 - 44, y + 3);
      });
    };
    col(bx + 24, 'ARTS', artRows);
    col(bx + bw / 2 + 12, 'SUPPORT', supRows);
  }

  // フッター：タイトル・日付・URL
  g.textAlign = 'center';
  g.fillStyle = '#87CEEB'; g.font = en(56);
  g.fillText(GAME_TITLE, W / 2, H - 230);
  g.fillStyle = '#8A94B8'; g.font = jp(28, 400);
  const d = new Date();
  g.fillText(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}　${SHARE_URL}`, W / 2, H - 150);
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.font = jp(22, 400);
  g.fillText('VOICE CONNECT MEMORIAL  FAN GAME', W / 2, H - 100);

  return new Promise((resolve) => cv.toBlob((b) => resolve(b), 'image/png'));
}

/** 共有シート（Web Share API）→ 使えなければダウンロード */
export async function shareOrDownload(blob: Blob, filename: string, text: string): Promise<'shared' | 'downloaded' | 'failed'> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], text });
      return 'shared';
    }
  } catch {
    /* キャンセル等 → ダウンロードにフォールバック */
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

/** Xポスト用の文面 */
export function buildPostText(r: RunResult, opts: { best?: boolean } = {}): string {
  const chara = CHARACTERS[r.characterId];
  const stage = stageById(r.stageId ?? 1);
  const mm = Math.floor(r.timeSec / 60);
  const ss = Math.floor(r.timeSec % 60).toString().padStart(2, '0');
  const fusions = (r.arts ?? []).filter((a) => a.fusion).length;
  const lines = [
    `${GAME_TITLE}｜${chara?.name ?? ''}で ${stage.nameEn}「${stage.name}」`,
    stage.rush ? (r.rush && r.rush.loopTimes.length > 0 ? `1周 ${fmtTime(r.rush.loopTimes[0])}（${r.rush.loopTimes.length}周クリア）—— 称号「${rushTitle(r.rush.loopTimes[0])}」` : 'ボスに届かなかった……') : stage.endless ? `称号「${endlessTitle(r.timeSec).name}」—— ${endlessLoop(r.timeSec)}周目` : r.cleared ? 'SIGNAL CLEAR —— 声は、届いた。' : 'SIGNAL LOST —— 声が、途切れた……',
    `生存 ${mm}:${ss}／撃破 ${r.kills}／Lv${r.level}${fusions ? `／合体技 ${fusions}` : ''}${r.score !== undefined && !stage.endless ? `／スコア ${r.score.toLocaleString()}` : ''}${opts.best ? '　★NEW BEST' : ''}`,
    SHARE_URL,
    SHARE_TAG,
  ];
  return lines.join('\n');
}

export function openXPost(text: string): void {
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
