import type { RunResult } from '../scenes/ResultScene';
import type { SaveData } from '../utils/storage';
import { CONFIG } from './config';
import { CHARACTERS, CHARACTER_ORDER } from './characters';
import { WEAPONS } from './weapons';
import { PASSIVES } from './passives';
import { NIGHTMARE_STAGE } from './nightmare';
import { SCORE_STAGE } from './score';
import { ENDLESS_STAGE } from './endless';
import { RUSH_STAGE } from './rush';

/**
 * 実績（2026-10-05 ユーザー承認）。図鑑の「実績」タブに一覧、解除した瞬間はリザルトに出る。
 * - 判定はリザルトで（そのプレイの結果 r と、保存し終えたセーブ save）。図鑑を開いたときも、プレイに依らないものだけ見直す（r = null）。
 * - デバッグ・審査モードのプレイ（r.debug）では解除しない。
 * - 隠しキャラ・追補パッチ⑤ §1 の言葉には触れない（隠しキャラに関わる実績は作らない）。
 */
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  /** r は、そのプレイの結果（図鑑から見直すときは null） */
  check: (r: RunResult | null, save: SaveData) => boolean;
}

const cleared = (save: SaveData, stageId: number) => save.cleared.includes(stageId);

/** 図鑑に登録される共鳴アーツ・合体技・サポートの数（進化の `:evo` は数えない） */
export function codexTotal(): number {
  return Object.values(WEAPONS).filter((w) => w.kind === 'art').length + Object.keys(PASSIVES).length;
}
export function codexFound(save: SaveData): number {
  return save.codex.filter((id) => !id.includes(':')).length;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_art', name: '初めての共鳴', desc: '共鳴アーツを1つ借りる', check: (r) => !!r && (r.arts?.length ?? 0) >= 1 },
  { id: 'clear1', name: '宵の口を越えて', desc: 'STAGE 1 をクリア', check: (_r, s) => cleared(s, 1) },
  { id: 'clear2', name: '真夜中を越えて', desc: 'STAGE 2 をクリア', check: (_r, s) => cleared(s, 2) },
  { id: 'clear3', name: '夜明けを見た', desc: 'STAGE 3 をクリア', check: (_r, s) => cleared(s, 3) },
  { id: 'score_clear', name: '記録に挑む者', desc: 'スコアアタックをクリア', check: (_r, s) => cleared(s, SCORE_STAGE.id) },
  { id: 'nightmare', name: '悪夢を越えて', desc: 'EX STAGE「悪夢」をクリア', check: (_r, s) => cleared(s, NIGHTMARE_STAGE.id) },
  { id: 'evolve1', name: '進化の証', desc: '共鳴アーツを進化させる', check: (r) => !!r && (r.arts ?? []).some((a) => a.evolved) },
  { id: 'fusion1', name: '重なる声', desc: '合体技を手に入れる', check: (r) => !!r && (r.arts ?? []).some((a) => a.fusion) },
  { id: 'full_slots', name: '満員御礼', desc: `共鳴アーツの枠（${CONFIG.weaponSlots}つ）を全部埋める`, check: (r) => !!r && (r.arts?.length ?? 0) >= CONFIG.weaponSlots },
  { id: 'fullmoon1', name: '満月の夜を越えて', desc: '満月を生き延びる', check: (r) => !!r && (r.fullMoons ?? 0) >= 1 },
  { id: 'special5', name: '声を重ねて', desc: '1プレイで必殺を5回使う', check: (r) => !!r && (r.specials ?? 0) >= 5 },
  { id: 'chests5', name: '宝石箱の常連', desc: '1プレイで宝石箱を5回開ける', check: (r) => !!r && (r.chests ?? 0) >= 5 },
  { id: 'kills500', name: '五百の影', desc: '1プレイで500体を倒す', check: (r) => !!r && r.kills >= 500 },
  { id: 'kills1500', name: '千五百の影', desc: '1プレイで1500体を倒す', check: (r) => !!r && r.kills >= 1500 },
  { id: 'lv30', name: '成長期', desc: '1プレイで Lv30 に到達', check: (r) => !!r && r.level >= 30 && r.stageId !== RUSH_STAGE.id },
  { id: 'speed3_clear', name: '倍速の勇者', desc: 'ゲーム速度 ×3 でステージをクリア', check: (r) => !!r && r.cleared && (r.speed ?? 1) >= 3 && [1, 2, 3, NIGHTMARE_STAGE.id].includes(r.stageId) },
  { id: 'endless20', name: '長い夜', desc: 'エンドレスで20分を生き延びる', check: (r) => !!r && r.stageId === ENDLESS_STAGE.id && r.timeSec >= 1200 },
  { id: 'rush1', name: '連戦の果て', desc: 'ボスラッシュを1周クリア', check: (r) => !!r && r.stageId === RUSH_STAGE.id && (r.rush?.loopTimes.length ?? 0) >= 1 },
  { id: 'all_chars', name: '全員集合', desc: '仲間を全員解放する', check: (_r, s) => CHARACTER_ORDER.filter((id) => !CHARACTERS[id].secret).every((id) => CHARACTERS[id].unlockYell === 0 || s.unlockedCharacters.includes(id)) },
  { id: 'codex_half', name: '声の蒐集家', desc: '図鑑の共鳴アーツとサポートを半分登録', check: (_r, s) => codexFound(s) * 2 >= codexTotal() },
  { id: 'codex_full', name: '声の記録者', desc: '図鑑の共鳴アーツとサポートを全部登録', check: (_r, s) => codexFound(s) >= codexTotal() },
];

/**
 * 実績の見直し。新しく解除したものを返し、save.achievements に加える（呼ぶ側が writeSave する）。
 * r が null（図鑑など）のときは、プレイに依らない実績だけが対象になる（check が r を要求するものは false）
 */
export function unlockAchievements(r: RunResult | null, save: SaveData): AchievementDef[] {
  if (r?.debug) return [];
  const got: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (save.achievements.includes(a.id)) continue;
    if (!a.check(r, save)) continue;
    save.achievements.push(a.id);
    got.push(a);
  }
  return got;
}
