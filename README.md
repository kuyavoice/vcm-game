# D-STAGE SURVIVORS（仮題）

『ボイスコネクトメモリアル』ファンゲーム（IF・お祭り枠）。ヴァンパイアサバイバーズ系の生存アクション。
Vite + TypeScript + Phaser 3。縦画面 720×1280（EXPAND）。

## 開発

```bash
npm install
npm run dev      # http://localhost:5180（--host 付きなので同一Wi-Fiのスマホから LAN の IP で実機確認可）
npm run build    # 型チェック + dist/ へ静的ビルド（GitHub Pages / Vercel にそのまま置ける）
npm run preview  # ビルド結果の確認
npm run deploy   # build → dist/ を gh-pages ブランチへ force push → https://kuyavoice.github.io/vcm-game/
```

公開URL: **https://kuyavoice.github.io/vcm-game/**（GitHub Pages・gh-pages ブランチ配信。反映まで1〜2分）

## ディレクトリ

```
src/
  main.ts          Phaser起動（フォント読込・音声ファイルの存在確認を待ってから開始）
  scenes/          Boot / Title / Game / LevelUp / Pause / Result
  data/            config / characters / weapons / passives / enemies / waves / audio  ← 数値調整はここ
  systems/         Spawner（湧き）/ WeaponSystem（宵星）/ XpSystem（声の欠片）/ Upgrades（3択）/ SpatialHash
  entities/        Player / Enemy / Bullet / Gem
  ui/              Hud / Joystick / Button
  utils/           textures（仮テクスチャ生成）/ audio / storage / safeArea / fonts
public/assets/
  sprites/chara/   kuya.png（48×48×9コマ：待機2／歩き4／被弾1／居眠り2。横一列）
  images/standing/ kuya.webp（立ち絵：リザルト用）
  audio/           bgm/ se/ voice/（未配置なら無音。ファイル名は src/data/audio.ts 参照）
```

## 素材の差し替え

- **キャラドット**: `public/assets/sprites/chara/{id}.png`。コマサイズは `src/data/characters.ts` の `frameWidth/frameHeight` で指定（現状48）。
- **敵**: M1はコード生成（`src/utils/textures.ts`）。清書ドットが来たら Boot で読み込むよう差し替え。
- **音声**: `src/data/audio.ts` のパスに置くだけ。起動時に HEAD で存在確認し、あるものだけ読み込む。

## 実装済み（M1〜M2）

移動（フローティングスティック／WASD・矢印）・敵の湧き（waves.ts の時間帯）・『宵星』自動攻撃（Lv8で『蒼天の連撃』）・
共鳴アーツ13種（4枠）＋パッシブ9種（4枠）・進化（Lv8＋対応パッシブ→宝箱で進化）・声の欠片／エール・
壊れたスピーカー（ギア一斉受信／月光のチーズケーキ／久遠の十字架／エール）・美麗の宝石箱（ルナのマスコット）・
満月イベント（5:00–6:00）・王級ボス（10:00・撃破でクリア）・必殺『魂の共鳴』（右下ボタン／Space）・
HUD・情報統制システム・居眠り回復・自動ポーズ・誤タップ対策・リザルト・ベストスコア保存（localStorage）。

## M3 以降（未実装）

清書ドットへの差し替え・カットイン（使い手の顔）・キャラ選択画面（立ち絵）・2人目の操作キャラ・サウンド素材・未定の進化の組み合わせ。詳細は CLAUDE.md §13。

## 任意アセット（置けば使われる）

- `public/assets/images/luna_chibi.png` … 宝箱画面のルナ（チビ）。未配置なら枠だけ表示
- `public/assets/audio/**` … `src/data/audio.ts` のファイル名で配置
