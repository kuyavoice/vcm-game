import Phaser from 'phaser';
import { CONFIG } from './data/config';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { LevelUpScene } from './scenes/LevelUpScene';
import { PauseScene } from './scenes/PauseScene';
import { ResultScene } from './scenes/ResultScene';
import { ChestScene } from './scenes/ChestScene';
import { StageSelectScene } from './scenes/StageSelectScene';
import { RushSetupScene } from './scenes/RushSetupScene';
import { CharaSelectScene } from './scenes/CharaSelectScene';
import { ShopScene } from './scenes/ShopScene';
import { CodexScene } from './scenes/CodexScene';
import { GalleryScene } from './scenes/GalleryScene';
import { OptionScene } from './scenes/OptionScene';
import { MusicScene } from './scenes/MusicScene';
import { HowToScene } from './scenes/HowToScene';
import { CreditsScene } from './scenes/CreditsScene';
import { YellRoomScene } from './scenes/YellRoomScene';
import { LobbyScene } from './scenes/LobbyScene';
import { AudioBus } from './utils/audio';
import { probeOptionalImages } from './utils/optionalAssets';

function start(): void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    width: CONFIG.width,
    height: CONFIG.height,
    backgroundColor: '#060913',
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.EXPAND,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      activePointers: 3,
    },
    scene: [BootScene, TitleScene, CharaSelectScene, ShopScene, CodexScene, GalleryScene, StageSelectScene, RushSetupScene, GameScene, LevelUpScene, ChestScene, PauseScene, ResultScene, OptionScene, MusicScene, HowToScene, CreditsScene, YellRoomScene, LobbyScene],
  });
  AudioBus.init(game);
  (window as unknown as { __game: Phaser.Game }).__game = game; // デバッグ用

  // PC で文字や絵が潰れる対策（2026-10-17）：キャンバスが縮小表示されるとき（表示倍率 < 1。縦 1280 の論理解像度に対し PC の窓は低い）は、
  // ドット用の最近傍（pixelated）だと縮小で線が欠けるので、通常の滑らかな縮小にする。等倍・拡大（スマホ）のときは pixelated のまま
  const applyCanvasSmoothing = () => {
    const c = game.canvas;
    const ratio = c.clientWidth > 0 ? c.clientWidth / c.width : 1;
    c.style.imageRendering = ratio < 0.999 ? 'auto' : 'pixelated';
  };
  game.scale.on('resize', applyCanvasSmoothing);
  game.events.once('ready', applyCanvasSmoothing);
  window.addEventListener('resize', () => setTimeout(applyCanvasSmoothing, 50));
  setTimeout(applyCanvasSmoothing, 0);
}

// Webフォントの読み込みを待ってから開始（最大1.5秒）。音声ファイルの存在確認も同時に行う
const fontsReady = Promise.all([
  document.fonts.load('700 32px "Oswald"'),
  document.fonts.load('700 24px "Noto Sans JP"'),
  document.fonts.load('400 24px "Noto Sans JP"'),
]).catch(() => undefined);
const timeout = new Promise<void>((r) => setTimeout(r, 1500));
Promise.all([
  Promise.race([fontsReady, timeout]),
  AudioBus.probe(import.meta.env.BASE_URL),
  probeOptionalImages(import.meta.env.BASE_URL),
]).then(start);
