import type { EnemyId } from './enemies';

// 図鑑の「キャラクター」「ネミノクス」の中身（追補パッチ⑩）。
// 紹介文は設定資料側で世界観の確認を済ませた文面。言い回しを変えるときは、パッチ⑩ §5 のルールを守ること：
// 本編の今後の展開・未公開の設定に触れない／「死」を連想させる言葉を使わない／CV・誕生日は載せない。

export interface CodexCharacter {
  /** キャラID（characters.ts と同じ） */
  id: string;
  name: string;
  reading: string;
  /** クラス */
  cls: string;
  text: string;
}

export interface CodexEnemy {
  /** 図鑑の上でのID（設定画のファイル名にも使う） */
  id: string;
  /** ゲーム内の敵ID。まだゲームに出ない敵は未指定（登録されない） */
  enemyId?: EnemyId;
  name: string;
  /** 読み（無ければ出さない） */
  reading?: string;
  rank: string;
  text: string;
  /** 設定画があるか（`assets/images/bestiary/{id}_art.webp`）。無い敵は、ゲーム内のドットを大きく出す */
  art?: boolean;
}

/** 隠しキャラは、解放するまで項目そのものを出さない（判定は CodexScene。characters.ts の secret を見る） */
export const CODEX_CHARACTERS: CodexCharacter[] = [
  {
    id: 'kuya', name: '宵月 空夜', reading: 'よいつき くうや', cls: 'サポーター（指揮官）',
    text: '仲間を導くトライスターの一人。戦うことよりも、仲間の力を引き出す指揮でこそ真価を発揮する。白いコートは、「指揮官は見られる存在だ」と仲間から贈られた覚悟の証。どんな夜でも前を向く、まっすぐな少年。……ただし、隙あらば眠い。',
  },
  {
    id: 'yukihito', name: '狐森 雪人', reading: 'こもり ゆきひと', cls: 'キャスト（アタッカー）',
    text: '空夜と肩を並べるトライスターの一人。冷静沈着な眼鏡の剣士で、身の丈ほどの大剣を軽々と振るう。敵の動きを見切る観察眼は学園でも随一。口数は少ないが、仲間を想う気持ちは誰よりも熱い。',
  },
  {
    id: 'mizuho', name: '月怜 瑞穂', reading: 'つきさと みずほ', cls: '前衛衛生兵',
    text: '最前線で仲間を癒やす衛生兵。水のアーツで傷を治し、レイピア『怜水閃』で道を切り開く。穏やかで礼儀正しいが、一度決めたことは曲げない芯の強さを持つ。傍らには、尊大で世話焼きな声霊・ルナ様がいる。',
  },
  {
    id: 'ritsuka', name: '寿 律花', reading: 'ことぶき りつか', cls: 'キャスト（アタッカー）',
    text: '炎のアーツを操る、ピンクのツインテールの少女。防御を捨てて火力に全振りした特注のステッキで、敵をまとめて焼き払う。明るく負けず嫌いで、仲間想い。センシティ部の初代部長でもある。',
  },
  {
    id: 'shion', name: '黒崎 詩音', reading: 'くろさき しおん', cls: 'ライター／ヒーラー',
    text: 'トライスターの一人で、学園随一の天才と呼ばれるライター。彼女の書く脚本は、仲間のアーツを大きく増幅させる。優しく仲間想いで、少しだけ悪戯好き。物語を書くことが、何よりも好き。',
  },
];

/** ネミノクスのタブの先頭に出す総説 */
export const BESTIARY_INTRO = {
  title: 'ネミノクス',
  text: '人の「声」に干渉する異形の存在。D-Stageと呼ばれる歪んだ空間に現れ、その姿と力によって階級に分けられている。',
};

export const CODEX_ENEMIES: CodexEnemy[] = [
  { id: 'grunt', enemyId: 'grunt', name: '雑音級', reading: 'グラント', rank: 'D〜C', art: true, text: '「インクの染み」のような姿をした、最も数の多いネミノクス。一体一体は弱いが、群れを成して押し寄せる。' },
  { id: 'hunter', enemyId: 'hunter', name: '狩人級', reading: 'ハンター', rank: 'C+', art: true, text: 'カマキリと忍者を思わせる、細身の狩人。素早く、物陰に潜んで奇襲を仕掛ける伏兵。' },
  // ゲーム内のIDは knight（騎士級）。図鑑と設定画のIDは kishi
  { id: 'kishi', enemyId: 'knight', name: '騎士級', reading: 'ナイト', rank: 'B', art: true, text: '黒曜石の鎧をまとった重装歩兵。前線を押し上げる動かぬ壁。上位の個体は、他のネミノクスを統率することもある。' },
  { id: 'bishop', enemyId: 'bishop', name: '司祭級', reading: 'ビショップ', rank: 'B+', art: true, text: 'ボロ布をまとった幽霊のような姿。フードの奥は空洞。離れた場所から術を放ち、周囲のネミノクスを支援する。' },
  { id: 'cavalry', enemyId: 'cavalry', name: '騎兵型', rank: '特殊個体', text: '騎士級の変異体。多脚の体で隊列を組み、一直線に戦場を駆け抜ける突撃特化の個体。' },
  // 城兵級・女王級は、行動とドット絵が届いてからゲームに出す（パッチ⑩ §4）。それまでは登録されない
  { id: 'rook', name: '城兵級', reading: 'ルーク', rank: 'A-', art: true, text: '「歩く要塞」。巨大な岩塊の体に城壁と砲台を背負い、ゆっくりと進軍する。その砲撃は、戦場ごと押し潰す。' },
  { id: 'queen', name: '女王級', reading: 'クイーン', rank: 'A+', art: true, text: '「歪んだ女神」。茨と虫の羽を持つ異形の母体。D-Stageを維持し、無数のネミノクスを産み落とし続ける。' },
  // ゲーム内のIDは blackknight。図鑑のIDは knight
  { id: 'knight', enemyId: 'blackknight', name: '黒騎士', rank: 'S（王級）', text: '漆黒のローブをまとい、多脚の騎兵を従える騎士。指揮官型の王級ネミノクス。重い剣閃と闇の弾で、戦場を支配する。' },
  { id: 'redknight', enemyId: 'redknight', name: '悪夢の黒騎士', rank: '―', text: '悪夢の中で、さらに力を増した黒騎士。深紅の闇をまとい、ただ一人の挑戦者を待ち受ける。' },
];

/** 設定画のテクスチャキー */
export const bestiaryKey = (id: string) => `best_${id}`;
export const bestiaryFile = (id: string) => `assets/images/bestiary/${id}_art.webp`;
