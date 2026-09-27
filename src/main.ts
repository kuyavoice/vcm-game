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
import { CharaSelectScene } from './scenes/CharaSelectScene';
import { ShopScene } from './scenes/ShopScene';
import { CodexScene } from './scenes/CodexScene';
import { GalleryScene } from './scenes/GalleryScene';
import { OptionScene } from './scenes/OptionScene';
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
    scene: [BootScene, TitleScene, CharaSelectScene, ShopScene, CodexScene, GalleryScene, StageSelectScene, GameScene, LevelUpScene, ChestScene, PauseScene, ResultScene, OptionScene],
  });
  AudioBus.init(game);
  (window as unknown as { __game: Phaser.Game }).__game = game; // デバッグ用
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
