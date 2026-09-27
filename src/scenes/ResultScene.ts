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
  /** 所持していたアーツ（共有画像・ポスト用） */
  arts?: { name: string; level: number; color: number; evolved: boolean; fusion: boolean }[];
  /** デバッグ操作を使ったプレイ（記録・エールを保存しない） */
  debug?: boolean;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  /** クリア時に使う勝利立ち絵のテクスチャキー（無ければ空） */
  private victoryKey = '';

  init(r: RunResult): void {
    const key = `victory_${r.characterId}`;
    this.victoryKey = r.cleared && hasOptionalImage(key) ? key : '';
  }

  preload(): void {
    if (this.victoryKey && !this.textures.exists(this.victoryKey)) this.load.image(this.victoryKey, OPTIONAL_IMAGES[this.victoryKey]);
  }

  /** 下端をなめらかに消した版のテクスチャを作る（勝利立ち絵は膝上で切れているため） */
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
    ct.refresh();
    return fk;
  }

  create(r: RunResult): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    cam.fadeIn(300, 6, 9, 19);
    // クリア時は操作キャラ別の曲（未配置なら result → title）
    if (r.cleared) AudioBus.playBgm(`bgm_clear_${r.characterId}`, 'bgm_result', 'bgm_title');
    else AudioBus.playBgm('bgm_result', 'bgm_title');

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
    }
    if (!r.debug) {
      save.totalYell += r.yell;
      writeSave(save);
    }

    this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0);

    // 立ち絵（あれば）
    const chara = CHARACTERS[r.characterId];
    // クリア時は勝利立ち絵（無ければ通常の立ち絵）。ゲームオーバー時は通常の立ち絵
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
    const panel = this.add.rectangle(px, py, W * 0.40, r.score !== undefined ? 510 : 450, 0x0b1026, 0.88).setOrigin(0, 0).setStrokeStyle(2, 0x87ceeb, 0.6);
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
      const y = py + 24 + i * 60;
      this.add.text(px + 18, y, k, { fontFamily: FONT_EN, fontSize: '18px', color: COLOR_HEX.dim, fontStyle: '700' });
      const jp = k === 'CHARACTER' || k === 'STAGE';
      this.add.text(px + 18, y + 20, v, { fontFamily: jp ? FONT_JP : FONT_EN, fontSize: jp ? '24px' : '30px', color: COLOR_HEX.white, fontStyle: '700' });
    });
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
  }
}
