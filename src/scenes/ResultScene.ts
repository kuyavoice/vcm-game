import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { STAGES, stageById } from '../data/stages';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { makeButton } from '../ui/Button';
import { loadSave, writeSave } from '../utils/storage';
import { AudioBus } from '../utils/audio';
import { renderShareCard, shareOrDownload, buildPostText, openXPost } from '../utils/shareCard';
import { SCORE } from '../data/score';
import { OPTIONAL_IMAGES, hasOptionalImage } from '../utils/optionalAssets';
import { unlockSecret } from '../utils/unlock';
import { NIGHTMARE_STAGE, NIGHTMARE_AVAILABLE } from '../data/nightmare';
import { GALLERY, galleryKey } from '../data/gallery';

export interface RunResult {
  characterId: string;
  cleared: boolean;
  kills: number;
  timeSec: number;
  level: number;
  yell: number;
  /** プレイ時のゲーム速度（表示のみ。記録はゲーム内時間基準なので倍率に依存しない） */
  speed: number;
  stageId: number;
  /** スコアアタック */
  score?: number;
  timeUp?: boolean;
  /** 所持していたアーツ（リザルト・共有画像・ポスト用） */
  arts?: { name: string; level: number; color: number; evolved: boolean; fusion: boolean }[];
  /** 初期武器 */
  main?: { name: string; level: number; color: number };
  /** 所持していたサポート */
  passives?: { name: string; level: number; color: number }[];
  /** デバッグ操作を使ったプレイ（記録・エールを保存しない） */
  debug?: boolean;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  /** リザルト専用の立ち絵のテクスチャキー（クリア＝勝利立ち絵／それ以外＝ゲームオーバーの立ち絵。無ければ空） */
  private victoryKey = '';

  /** 悪夢をクリアしたときに大きく見せる絵（無ければ空） */
  private congratsKey = '';

  init(r: RunResult): void {
    const ck = galleryKey('sp_congratulation');
    this.congratsKey = r.cleared && r.stageId === NIGHTMARE_STAGE.id && hasOptionalImage(ck) ? ck : '';
    const key = r.cleared ? `victory_${r.characterId}` : `gameover_${r.characterId}`;
    this.victoryKey = hasOptionalImage(key) ? key : '';
  }

  preload(): void {
    if (this.congratsKey && !this.textures.exists(this.congratsKey)) this.load.image(this.congratsKey, OPTIONAL_IMAGES[this.congratsKey]);
    if (this.victoryKey && !this.textures.exists(this.victoryKey)) this.load.image(this.victoryKey, OPTIONAL_IMAGES[this.victoryKey]);
  }

  /** 下端と左右の端をなめらかに消した版のテクスチャを作る（勝利立ち絵は膝上で切れていて、絵が左右の端まで描かれているため） */
  private fadedTexture(key: string): string {
    const fk = `${key}_fade`;
    if (this.textures.exists(fk)) return fk;
    const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const ct = this.textures.createCanvas(fk, src.width, src.height);
    if (!ct) return key;
    const c = ct.getContext();
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = 'destination-in';
    const grad = c.createLinearGradient(0, src.height * 0.82, 0, src.height);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, src.width, src.height);
    // 左右：スマホだとパネルの横で絵が直線に切れて見えるので、端をぼかす
    const side = c.createLinearGradient(0, 0, src.width, 0);
    side.addColorStop(0, 'rgba(0,0,0,0)');
    side.addColorStop(0.1, 'rgba(0,0,0,1)');
    side.addColorStop(0.84, 'rgba(0,0,0,1)');
    side.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = side;
    c.fillRect(0, 0, src.width, src.height);
    ct.refresh();
    return fk;
  }

  create(r: RunResult): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    cam.fadeIn(300, 6, 9, 19);
    // クリア時は操作キャラ別の曲、それ以外はゲームオーバーの曲（未配置なら result → title）
    if (r.cleared) AudioBus.playBgm(`bgm_clear_${r.characterId}`, 'bgm_result', 'bgm_title');
    else AudioBus.playBgm('bgm_gameover', 'bgm_result', 'bgm_title');

    const stage = stageById(r.stageId ?? 1);
    const key = String(stage.id);

    // ステージ別ベスト・クリア記録・エール累計
    const save = loadSave();
    const score = (x: { kills: number; timeSec: number }) => x.timeSec * 10 + x.kills;
    const prev = save.bests[key];
    const isBest = !r.debug && (!prev || score(r) > score(prev));
    if (isBest) save.bests[key] = { kills: r.kills, timeSec: r.timeSec, level: r.level, yell: r.yell, cleared: r.cleared || !!prev?.cleared };
    else if (!r.debug && r.cleared && prev && !prev.cleared) save.bests[key] = { ...prev, cleared: true };
    // スコアアタックのランキング（端末内ベスト10）
    let rank = 0;
    if (stage.scoreMode && r.score !== undefined && !r.debug) {
      const entry = { score: r.score, kills: r.kills, timeSec: r.timeSec, character: r.characterId, date: new Date().toISOString().slice(0, 10), cleared: r.cleared };
      save.scoreRanking.push(entry);
      save.scoreRanking.sort((a, b) => b.score - a.score);
      save.scoreRanking = save.scoreRanking.slice(0, SCORE.rankingSize);
      rank = save.scoreRanking.indexOf(entry) + 1;
    }
    let unlocked: string | null = null;
    if (!r.debug && r.cleared && !save.cleared.includes(stage.id)) {
      save.cleared.push(stage.id);
      const next = STAGES.find((s) => s.unlockAfter === stage.id);
      if (next) unlocked = `${next.nameEn} 「${next.name}」 解放！`;
      else if (NIGHTMARE_AVAILABLE && NIGHTMARE_STAGE.unlockAfter === stage.id) unlocked = `${NIGHTMARE_STAGE.nameEn} 「${NIGHTMARE_STAGE.name}」 解放！`;
    }
    // EXステージ「悪夢」のクリア報酬：特別なイラスト（ギャラリーに加わる）
    if (!r.debug && r.cleared && stage.id === NIGHTMARE_STAGE.id) {
      const rewards = GALLERY.filter((g) => g.rewardOf === 'nightmare' && !save.gallery.includes(g.id));
      if (rewards.length > 0) {
        for (const g of rewards) save.gallery.push(g.id);
        unlocked = '特別なイラストが解放されました';
      }
    }
    if (!r.debug) {
      save.totalYell += r.yell;
      writeSave(save);
      // 隠しキャラ：スコアアタックで強化版の黒騎士を倒すと解放。ここでは何も表示しない（出現はキャラ選択画面で）
      if (stage.scoreMode && r.cleared) unlockSecret('shion');
    }

    this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0);

    // 立ち絵（あれば）
    const chara = CHARACTERS[r.characterId];
    // クリア時は勝利立ち絵、ゲームオーバー・時間切れはゲームオーバーの立ち絵（どちらも、無ければ通常の立ち絵）
    const useVictory = !!this.victoryKey && this.textures.exists(this.victoryKey);
    const stKey = useVictory ? this.fadedTexture(this.victoryKey) : `standing_${r.characterId}`;
    if (this.textures.exists(stKey)) {
      // ボタン帯（H*0.78〜）の上に足元が来るように収める
      const img = this.add.image(W * 0.30, H * 0.75, stKey).setOrigin(0.5, 1);
      const scale = (H * 0.56) / img.height;
      img.setScale(scale).setAlpha(0.95);
    }

    // 見出し（「死」を使わない）
    const title = r.cleared ? 'SIGNAL CLEAR' : r.timeUp ? 'TIME UP' : 'SIGNAL LOST';
    const sub = r.cleared ? '声は、届いた。' : r.timeUp ? '長い夜が、明けた。' : '声が、途切れた……';
    this.add.text(W / 2, H * 0.10, title, {
      fontFamily: FONT_EN, fontSize: '76px', color: r.cleared ? COLOR_HEX.accent : COLOR_HEX.danger, fontStyle: '700', letterSpacing: 4,
      stroke: '#060913', strokeThickness: 8,
    }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.10 + 62, sub, {
      fontFamily: FONT_JP, fontSize: '26px', color: COLOR_HEX.white, stroke: '#060913', strokeThickness: 6,
    }).setOrigin(0.5);
    if (r.debug) {
      this.add.text(W / 2, H * 0.10 + 104, 'DEBUG：このプレイの記録・エールは保存されません', {
        fontFamily: FONT_JP, fontSize: '20px', color: '#00FF88', stroke: '#060913', strokeThickness: 6,
      }).setOrigin(0.5);
    }
    if (unlocked) {
      const t = this.add.text(W / 2, H * 0.10 + 104, unlocked, {
        fontFamily: FONT_JP, fontSize: '22px', color: COLOR_HEX.gold, fontStyle: '700', stroke: '#060913', strokeThickness: 6,
      }).setOrigin(0.5);
      this.tweens.add({ targets: t, scaleX: 1.06, scaleY: 1.06, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    // スタッツ（右寄せのパネル）
    const px = W * 0.58;
    const py = H * 0.27;
    // 下にビルドの一覧を置くので、行の間隔を詰める（スコアアタックは1行多い）
    const rowCount = r.score !== undefined ? 8 : 7;
    const pitch = rowCount >= 8 ? 48 : 52;
    const panelH = 20 + rowCount * pitch;
    const panel = this.add.rectangle(px, py, W * 0.40, panelH, 0x0b1026, 0.88).setOrigin(0, 0).setStrokeStyle(2, 0x87ceeb, 0.6);
    const mm = Math.floor(r.timeSec / 60).toString().padStart(2, '0');
    const ss = Math.floor(r.timeSec % 60).toString().padStart(2, '0');
    const rows: [string, string][] = [
      ...(r.score !== undefined ? [['SCORE', `${r.score.toLocaleString()}${rank ? `  #${rank}` : ''}`] as [string, string]] : []),
      ['STAGE', stage.scoreMode ? stage.nameEn : `${stage.nameEn}  ${stage.name}`],
      ['CHARACTER', chara?.name ?? r.characterId],
      ['TIME', `${mm}:${ss}`],
      ['DEFEATED', `${r.kills}`],
      ['LEVEL', `${r.level}`],
      ['YELL', `★ ${r.yell}`],
      ['SPEED', `×${r.speed ?? 1}`],
    ];
    rows.forEach(([k, v], i) => {
      const y = py + 14 + i * pitch;
      this.add.text(px + 18, y, k, { fontFamily: FONT_EN, fontSize: '16px', color: COLOR_HEX.dim, fontStyle: '700' });
      const jp = k === 'CHARACTER' || k === 'STAGE';
      this.add.text(px + 18, y + 17, v, { fontFamily: jp ? FONT_JP : FONT_EN, fontSize: jp ? '22px' : '26px', color: COLOR_HEX.white, fontStyle: '700' });
    });

    // ビルド：初期武器・共鳴アーツ（左の列）と、サポート（右の列）
    const artRows: { name: string; tag: string; color: number; gold: boolean }[] = [];
    if (r.main) artRows.push({ name: r.main.name, tag: `Lv${r.main.level}`, color: r.main.color, gold: false });
    for (const a of r.arts ?? []) artRows.push({ name: a.name, tag: a.fusion ? 'FUSION' : a.evolved ? 'EVO' : `Lv${a.level}`, color: a.color, gold: a.fusion || a.evolved });
    const supRows = (r.passives ?? []).map((p) => ({ name: p.name, tag: `Lv${p.level}`, color: p.color, gold: false }));
    if (artRows.length + supRows.length > 0) {
      const bw = Math.min(680, W - 40);
      const bx = (W - bw) / 2;
      const by0 = py + panelH + 12;
      const lines = Math.max(artRows.length, supRows.length, 1);
      const rowH = 24;
      this.add.rectangle(bx, by0, bw, 38 + lines * rowH + 10, 0x0b1026, 0.9).setOrigin(0).setStrokeStyle(2, 0x87ceeb, 0.6);
      const col = (x: number, head: string, list: typeof artRows) => {
        this.add.text(x, by0 + 8, head, { fontFamily: FONT_EN, fontSize: '16px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 2 });
        list.forEach((it, i) => {
          const y = by0 + 36 + i * rowH;
          this.add.rectangle(x, y + 3, 5, 17, it.color, 1).setOrigin(0);
          this.add.text(x + 12, y, it.name, { fontFamily: FONT_JP, fontSize: '17px', color: it.gold ? COLOR_HEX.gold : COLOR_HEX.white, fontStyle: '700' });
          this.add.text(x + bw / 2 - 28, y + 1, it.tag, { fontFamily: FONT_EN, fontSize: '15px', color: it.gold ? COLOR_HEX.gold : COLOR_HEX.dim, fontStyle: '700' }).setOrigin(1, 0);
        });
      };
      col(bx + 14, 'ARTS', artRows);
      col(bx + bw / 2 + 8, 'SUPPORT', supRows);
    }
    if (isBest) {
      this.add.text(panel.x + panel.width - 14, py - 14, 'NEW BEST', {
        fontFamily: FONT_EN, fontSize: '20px', color: '#060913', backgroundColor: '#FFD700', fontStyle: '700', padding: { x: 8, y: 2 },
      }).setOrigin(1, 1).setAngle(-4);
    }

    // 共有：画像を保存（Web Share → ダウンロード）／Xにポスト
    let busy = false;
    const note = this.add.text(W / 2, H * 0.80 + 62, '', { fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim }).setOrigin(0.5);
    makeButton(this, W / 2 - 150, H * 0.80, '画像を保存', async () => {
      if (busy) return;
      busy = true;
      note.setText('生成中…');
      const blob = await renderShareCard(r);
      if (!blob) { note.setText('生成に失敗しました'); busy = false; return; }
      const res = await shareOrDownload(blob, `dstage_${stage.id}_${r.cleared ? 'clear' : 'lost'}.png`, buildPostText(r));
      note.setText(res === 'shared' ? '共有しました' : res === 'downloaded' ? '画像を保存しました' : '保存できませんでした');
      busy = false;
    }, { width: 280, height: 60, fontSize: 22 });
    makeButton(this, W / 2 + 150, H * 0.80, 'Xにポスト', () => openXPost(buildPostText(r)), { width: 280, height: 60, fontSize: 22 });

    makeButton(this, W / 2, H * 0.80 + 130, 'RETRY', () => {
      this.scene.start('Game', { characterId: r.characterId, stageId: stage.id });
    }, { primary: true });
    makeButton(this, W / 2, H * 0.80 + 222, 'STAGE SELECT', () => this.scene.start('StageSelect'));

    // 悪夢をクリアしたとき：結果の前に、祝いの絵を大きく見せる（タップで閉じる）
    if (this.congratsKey && this.textures.exists(this.congratsKey)) {
      this.textures.get(this.congratsKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const shade = this.add.rectangle(0, 0, W, H, 0x020308, 0.94).setOrigin(0).setDepth(100).setInteractive();
      const img = this.add.image(W / 2, H * 0.44, this.congratsKey).setDepth(101);
      const fit = Math.min((W - 24) / img.width, (H * 0.6) / img.height);
      img.setScale(fit * 0.9).setAlpha(0);
      const frame = this.add.rectangle(W / 2, H * 0.44, img.width * fit + 8, img.height * fit + 8).setStrokeStyle(3, 0xffd700, 0.9).setDepth(101).setAlpha(0);
      const head = this.add.text(W / 2, H * 0.44 - (img.height * fit) / 2 - 56, 'EX STAGE CLEAR', {
        fontFamily: FONT_EN, fontSize: '44px', color: COLOR_HEX.gold, fontStyle: '700', letterSpacing: 5, stroke: '#060913', strokeThickness: 6,
      }).setOrigin(0.5).setDepth(101).setAlpha(0);
      const hint = this.add.text(W / 2, H * 0.44 + (img.height * fit) / 2 + 60, 'TAP TO CONTINUE', {
        fontFamily: FONT_EN, fontSize: '24px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 4,
      }).setOrigin(0.5).setDepth(101).setAlpha(0);
      this.tweens.add({ targets: img, alpha: 1, scale: fit, duration: 500, ease: 'Cubic.out' });
      this.tweens.add({ targets: [frame, head], alpha: 1, duration: 500, delay: 200 });
      this.tweens.add({ targets: hint, alpha: 1, duration: 300, delay: 900 });
      let ready = false;
      this.time.delayedCall(900, () => { ready = true; });
      shade.on('pointerup', () => {
        if (!ready) return;
        ready = false;
        this.tweens.add({ targets: [shade, img, frame, head, hint], alpha: 0, duration: 260, onComplete: () => { for (const o of [shade, img, frame, head, hint]) o.destroy(); } });
      });
    }
  }
}
