import { lang } from '../utils/lang';

/**
 * 技・進化・サポートの説明文の英訳（2026-10-17 ユーザー決定「英語範囲は説明文だけ」）。
 * 元データ（weapons.ts／passives.ts）は日本語のまま。表示するときに `td(ja)` で引く。無い文はそのまま日本語で出す。
 * 文は「。」で区切って1文ずつ引くので、合成した文（合体の『盾が攻撃を防ぐたび…』など）も訳せる。
 */
const DESC_EN: Record<string, string> = {
  // ── 初期武器
  '片手剣とハンドガンを距離で自動切替。近くは斬り、遠くは撃つ。': 'Switches between a sword and a handgun by range: slashes up close, shoots from afar.',
  '最寄りの敵へ水圧の突きを放つ。細く長い直線で、すべてを貫く。': 'A water-pressure thrust at the nearest enemy. A thin, long line that pierces everything.',
  '進む方向へ大剣を薙ぎ払い、すぐに返し斬りを重ねる。半円の範囲を強く弾き飛ばす。': 'Sweeps a greatsword in the direction you move, then follows with a return slash. Knocks back everything in a half circle.',
  '炎の玉が敵を追いかけ、当たると小さく爆ぜて燃え上がらせる。': 'Fireballs chase enemies, burst on hit and set them ablaze.',
  '敵を追尾する星の光の矢を放つ。': 'Fires homing arrows of starlight.',
  // ── 共鳴アーツ
  '向いている方向へ、貫通する火矢を放つ。': 'Fires piercing fire arrows in the direction you face.',
  '敵を追尾する星の弾を放つ。': 'Fires homing star bullets.',
  '画面のあちこちで斬撃が閃き、敵を切り伏せる。': 'Slashes flash all over the screen, cutting enemies down.',
  '画面の端で跳ね返り続ける弾。当たった敵の動きを鈍らせる。': 'A bullet that keeps bouncing off the screen edges. Slows enemies it hits.',
  '足元付近に鉄柵を組み上げる。中の敵は足止めされ、じわじわ削られる。': 'Builds iron fences near you. Enemies inside are held and slowly worn down.',
  '水の盾をまとい、しばらくのあいだダメージを防ぐ。': 'Wraps you in a water shield that blocks damage for a while.',
  '狐火を宿した御札が、自分の周囲を回り続ける。': 'Talismans holding foxfire keep circling around you.',
  '進む先の地面が牙のように隆起し、敵を弾き飛ばす。': 'The ground ahead erupts like fangs, knocking enemies away.',
  '一定の呼吸で、自分の周囲を円に一閃する。': 'With steady breathing, a single slash sweeps a full circle around you.',
  '敵が最も集まった場所に重力の檻を落とす。中の敵は動けない。': 'Drops a gravity cage where enemies gather most. Enemies inside cannot move.',
  '最寄りの敵を蹴り飛ばす。飛んだ敵がぶつかった相手にもダメージ。': 'Kicks the nearest enemy away. Anything it crashes into takes damage too.',
  '投げた傘が弧を描いて戻ってくる。行きと帰りで二度当たる。': 'A thrown umbrella arcs out and returns, hitting twice on the way.',
  '発動のたび、仲間のアーツのどれかをページから呼び出す。': 'Each activation calls one of your friends\' Arts from the pages.',
  '前と後ろへ同時に散弾を撃つ。近い敵を弾き飛ばす。': 'Fires shotgun bursts forward and backward at once. Knocks nearby enemies back.',
  '画面内でいちばん手強い敵へ、ハンドガンの連射を送る。': 'Sends a handgun volley at the toughest enemy on screen.',
  '影がそばに現れ、近くの敵を次々と斬り抜けて消える。斬撃は周りの敵も巻き込む。': 'A shadow appears beside you, cuts through nearby enemies one after another and vanishes. Each slash also hits enemies around the target.',
  '進む方向の前方を、連射で左右に薙ぎ払う。': 'Sweeps the area ahead with rapid fire from side to side.',
  '中華鍋を振り、激辛チャーハンを一直線に放つ。通り道のスパイスの帯の中では、敵はあらゆる攻撃に弱くなる。': 'Swings a wok and launches ultra-spicy fried rice in a straight line. Inside the spice trail it leaves, enemies take more damage from everything.',
  // ── 合体
  '白銀の斬撃と星の弾。ときおり三つを結ぶ光が走り、内側の敵を裁く。': 'Silver slashes and star bullets. Now and then a light links the three points and judges every enemy inside.',
  '3人の力が、白銀の余韻となって響き渡る。': 'The power of three rings out as a silver echo.',
  '3人の光がひとつに束ねられ、画面の端まで貫く。': 'Three lights bound into one, piercing to the edge of the screen.',
  '一撃を防ぐ水の盾をまとい、前方へ大きな炎の矢を放つ。': 'A water shield that blocks one hit, plus great fire arrows fired ahead.',
  '前方の空から星が降り、着弾した場所の敵を縫い止める。': 'Stars fall from the sky ahead and pin down enemies where they land.',
  '足元に逆茂木が立ち、岩の衝撃波が周囲をなぎ払って、敵の足を止める。': 'Spiked barricades rise at your feet while a rock shockwave sweeps the area and stops enemies in their tracks.',
  '蹴り飛ばした敵が画面の端で跳ね回り、ぶつかった敵を巻き込む。': 'Kicked enemies ricochet off the screen edges, taking everything they hit with them.',
  '盾が攻撃を防ぐたび、傷を癒す。': 'Each time the shield blocks an attack, it heals you.',
  // ── 進化
  '七本の杭が扇状に放たれ、すべてを貫く。': 'Seven stakes fan out and pierce everything.',
  '星の矢が、画面のすべての敵を同時に狙う。': 'Star arrows target every enemy on screen at once.',
  '斬撃の数が増え、被弾した瞬間にも周囲へ斬撃が閃く。': 'More slashes, and the moment you are hit, slashes flash around you.',
  '大きく速い弾が長く跳ね回り、触れた敵を強く鈍らせる。': 'A bigger, faster bullet bounces longer and slows enemies hard.',
  '鉄柵が倍に増えて、ほとんど消えなくなる。中の敵はさらに鈍る。': 'Twice the fences, and they almost never fade. Enemies inside slow down even more.',
  '盾をまとう間、傷をゆっくりと癒す。': 'While the shield is up, your wounds slowly heal.',
  '御札が九つの狐火になって回り、触れた敵を炎上させる。': 'The talismans become nine foxfires that set enemies ablaze on touch.',
  '三段の地割れが続けざまに走り、行く手をなぎ払う。': 'Three fissures run one after another, clearing the way ahead.',
  '一閃のあと、斬撃の輪が波紋のように外へ広がる。': 'After the slash, a ring of blades spreads outward like a ripple.',
  '重力場が多重に展開し、逃げ場を奪う。': 'Multiple gravity fields deploy, leaving nowhere to run.',
  'まとめて蹴り飛ばす。飛んだ敵はさらに遠くまで転がる。': 'Kicks several enemies at once. They fly even farther.',
  '傘が三本に増え、周囲を舞ってから戻ってくる。': 'Three umbrellas that dance around you before returning.',
  '散弾が敵を貫き、後ろの散弾も敵のいる方を向く。': 'Pellets pierce enemies, and the rear burst now aims at enemies behind you.',
  'HPの高い敵3体を同時に狙い、まとめて連射する。': 'Targets the three highest-HP enemies at once and fires at all of them.',
  '影が二つに増え、それぞれが敵を斬り抜ける。斬られた敵は、しばらくこちらを見失う。': 'Two shadows, each cutting through enemies. Enemies they cut lose sight of you for a while.',
  '掃射が前方いっぱいに広がり、弾がすべてを貫く。': 'The sweep widens to cover the whole front, and every bullet pierces.',
  '三方向へチャーハンを放ち、スパイスの帯も3本に。帯の中で倒した敵が、まれにミニチャーハンを落とす。': 'Launches fried rice in three directions, leaving three spice trails. Enemies defeated inside a trail sometimes drop a mini fried rice.',
  // ── 段階（レベルアップの行）
  '射撃が2連射になる': 'Shots become a 2-round burst',
  '斬撃の範囲 +30%': 'Slash area +30%',
  '斬撃の角度が広がる（120°→160°）': 'Wider slash arc (120° → 160°)',
  '『蒼天の連撃』：斬撃のあと至近三連射': '"Azure Chain": a point-blank 3-round burst after each slash',
  '2連射になる': 'Becomes a 2-round burst',
  '『怜水閃・五月雨』：細い貫通突きを5連射': '"Reisuisen: Samidare": five thin piercing thrusts in a row',
  '『氷狼牙』：2連撃の後、前方へ氷の衝撃波が走り、雑魚を凍らせる': '"Ice Wolf Fang": after the two slashes, an ice shockwave runs ahead and freezes small enemies',
  '猟犬の数 +1': 'Hounds +1',
  '爆発の範囲 +30%': 'Blast area +30%',
  '『焔の大狩猟』：猟犬6匹が群れで駆け回り、敵を倒すたび新しい猟犬が生まれる（最大12）。炎上も強まる': '"Great Flame Hunt": six hounds roam as a pack and every kill spawns a new one (max 12). Burning is stronger too',
  '矢の本数 +1': 'Arrows +1',
  '『満天の裁定』：星の矢が、画面のすべての敵を同時に狙う': '"Judgment of the Full Sky": star arrows target every enemy on screen at once',
  '貫通 +2': 'Pierce +2',
  '貫通 +2・矢の本数 +1': 'Pierce +2, arrows +1',
  '弾数 +1': 'Bullets +1',
  '貫通 +1': 'Pierce +1',
  '弾数 +2': 'Bullets +2',
  '斬撃数 +1': 'Slashes +1',
  '斬撃数 +2': 'Slashes +2',
  '鈍化が強くなる': 'Stronger slow',
  '柵の数 +1': 'Fences +1',
  '柵の数 +1・持続 +30%': 'Fences +1, duration +30%',
  '盾が消えるとき、周囲の敵にダメージ': 'Damages nearby enemies when the shield fades',
  '重い攻撃を2回まで耐える': 'Withstands heavy attacks twice',
  '御札 +1・少し大きく': 'Talismans +1, slightly bigger',
  '回転が速く・軌道が広く': 'Faster spin, wider orbit',
  '御札 +1・回転が速く': 'Talismans +1, faster spin',
  '御札 +1・大きく（計6枚）': 'Talismans +1, bigger (6 in total)',
  '長さ +25%': 'Length +25%',
  '幅 +40%': 'Width +40%',
  '飛距離 +30%': 'Distance +30%',
  '蹴る数 +1': 'Kicks +1',
  '飛距離 +20%': 'Distance +20%',
  '傘の数 +1': 'Umbrellas +1',
  '再現の威力 +20%': 'Mimic power +20%',
  '2種を同時に再現': 'Mimics two Arts at once',
  '散弾の数 +1': 'Pellets +1',
  '射程 +15%・散弾の数 +1': 'Range +15%, pellets +1',
  '連射数 +1': 'Shots +1',
  '連射数 +1・ダメージ +25%': 'Shots +1, damage +25%',
  '斬り抜ける数 +1': 'Targets +1',
  '斬り抜ける数 +1・発動間隔 −12%': 'Targets +1, interval −12%',
  '弾数 +4': 'Bullets +4',
  '掃射時間 +20%・弾数 +4': 'Sweep time +20%, bullets +4',
  '帯の中の敵が受けるダメージ +5%（30%）': 'Enemies in the trail take +5% damage (30%)',
  '帯の中の敵へ、包丁が飛ぶ': 'Kitchen knives fly at enemies in the trail',
  '受けるダメージ +5%（35%）・幅 +40%': 'Damage taken +5% (35%), width +40%',
  '帯の持続 +30%': 'Trail duration +30%',
  '帯の中の敵が受けるダメージ +5%（40%）': 'Enemies in the trail take +5% damage (40%)',
  '長さ +25%・帯の持続 +30%': 'Length +25%, trail duration +30%',
  // ── サポート
  'HPが少しずつ自然回復する（Lvごとに +0.5/秒）': 'Slowly regenerates HP (+0.5/sec per level)',
  '最大HP +20（Lvごと）': 'Max HP +20 (per level)',
  '攻撃力 +10%（Lvごと）': 'Attack +10% (per level)',
  '攻撃間隔 −6%（Lvごと）': 'Attack interval −6% (per level)',
  '移動速度 +8%（Lvごと）': 'Move speed +8% (per level)',
  '受けるダメージ −8%（Lvごと）': 'Damage taken −8% (per level)',
  '全アーツの効果範囲 +10%（Lvごと）': 'Area of all Arts +10% (per level)',
  'レアアイテム・宝箱の出現率 +20%、声の欠片の経験値 +5%（Lvごと）': 'Rare items and chests +20%, shard XP +5% (per level)',
  '声の欠片・アイテムの回収範囲 +25%、拾うエール +10%（Lvごと）': 'Pickup range +25%, yells picked up +10% (per level)',
  '投射物（矢・弾・傘など）の数 +1（Lvごと）': 'Projectiles (arrows, bullets, umbrellas…) +1 (per level)',
  '効果時間 +10%、設置・常駐・補助アーツの威力 +10%（Lvごと）': 'Duration +10%, zone/orbit/support Arts +10% power (per level)',
  '被弾すると周囲の敵に反撃する（ダメージ 20×Lv、1秒に1回）': 'Counterattacks nearby enemies when hit (20 × level damage, once per second)',
  '必殺ゲージの上昇速度 +15%（Lvごと）': 'Special gauge fills +15% faster (per level)',
};

/** 「ダメージ +25%」「発動間隔 −12%」「範囲 +20%」など、数値だけ違う定型の行 */
const TERMS: [RegExp, string][] = [
  [/^ダメージ \+(\d+)%$/, 'Damage +$1%'],
  [/^発動間隔 −(\d+)%$/, 'Interval −$1%'],
  [/^攻撃間隔 −(\d+)%$/, 'Attack interval −$1%'],
  [/^範囲 \+(\d+)%$/, 'Area +$1%'],
  [/^射程 \+(\d+)%$/, 'Range +$1%'],
  [/^持続時間 \+(\d+)%$/, 'Duration +$1%'],
  [/^持続 \+(\d+)%$/, 'Duration +$1%'],
];

function one(ja: string): string {
  const hit = DESC_EN[ja];
  if (hit) return hit;
  for (const [re, en] of TERMS) if (re.test(ja)) return ja.replace(re, en);
  // 「A・B」の組み合わせは部品ごとに
  if (ja.includes('・')) {
    const parts = ja.split('・').map((p) => one(p));
    if (parts.every((p, i) => p !== ja.split('・')[i])) return parts.join(', ');
  }
  return ja;
}

/** 説明文を表示言語に合わせる。英語で訳が無い文は日本語のまま */
export function td(ja: string | undefined): string {
  if (!ja) return '';
  if (lang() !== 'en') return ja;
  if (DESC_EN[ja]) return DESC_EN[ja];
  // 文ごとに引く（合成された説明文のため）
  const sentences = ja.split('。').filter((s) => s.length > 0);
  if (sentences.length > 1) {
    const out = sentences.map((s) => one(`${s}。`)).map((s) => (s.endsWith('。') ? s : s));
    return out.map((s) => (s.endsWith('。') ? s : s)).join(' ').replace(/。/g, '.');
  }
  return one(ja);
}
