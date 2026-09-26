import Phaser from 'phaser';
import type { CharacterDef } from '../data/characters';
import { COLOR_VARIANTS, variantKey, type ColorVariantDef } from '../data/colors';

/** キャラのアニメ（待機／歩き／被弾／居眠り）を、スプライトキーを指定して作る */
export function createCharAnims(scene: Phaser.Scene, def: CharacterDef, key = def.sprite.key): void {
  const f = def.sprite.frames;
  const mk = (name: string, frames: number[], frameRate: number, repeat = -1) => {
    const k = `${key}_${name}`;
    if (scene.anims.exists(k)) return;
    scene.anims.create({ key: k, frames: scene.anims.generateFrameNumbers(key, { frames }), frameRate, repeat });
  };
  mk('idle', f.idle, 2);
  mk('walk', f.walk, 8);
  mk('hit', f.hit, 1, 0);
  mk('sleep', f.sleep, 1.5);
}

function rgb2hsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

/**
 * ベースのスプライトシートから色替え版を作り、同じコマ割りのスプライトシート＋アニメとして登録する。
 * 既に作ってあればそのキーを返す。
 */
export function ensureColorVariant(scene: Phaser.Scene, def: CharacterDef, variantId: string): string {
  const v = (COLOR_VARIANTS[def.id] ?? []).find((c) => c.id === variantId);
  if (!v) return def.sprite.key;
  const key = variantKey(def.id, v.id);
  if (scene.textures.exists(key)) return key;
  const base = scene.textures.get(def.sprite.key);
  const src = base.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const cv = document.createElement('canvas');
  cv.width = src.width;
  cv.height = src.height;
  const g = cv.getContext('2d');
  if (!g) return def.sprite.key;
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, cv.width, cv.height);
  recolorPixels(img.data, v);
  g.putImageData(img, 0, 0);
  scene.textures.addSpriteSheet(key, cv as unknown as HTMLImageElement, { frameWidth: def.sprite.frameWidth, frameHeight: def.sprite.frameHeight });
  createCharAnims(scene, def, key);
  return key;
}

function recolorPixels(d: Uint8ClampedArray, v: ColorVariantDef): void {
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const [h, s, val] = rgb2hsv(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
    // 低彩度（黒・白・肌に近いグレー）はほぼそのまま。髪や服の色だけ動かす
    const weight = Math.min(1, s * 2.2);
    let h2 = (h + v.hue * weight + 1) % 1;
    const s2 = Math.min(1, s * (1 + (v.sat - 1) * weight));
    const val2 = Math.min(1, val * (1 + (v.val - 1) * weight));
    if (weight === 0) h2 = h;
    const [r, gg, b] = hsv2rgb(h2, s2, val2);
    d[i] = Math.round(r * 255);
    d[i + 1] = Math.round(gg * 255);
    d[i + 2] = Math.round(b * 255);
  }
}
