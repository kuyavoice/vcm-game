/** 空間ハッシュ。毎フレーム clear → insert して近傍検索に使う */
export interface HasXY { x: number; y: number }

export class SpatialHash<T extends HasXY> {
  private cells = new Map<number, T[]>();
  constructor(private cell: number) {}

  private key(cx: number, cy: number): number {
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  clear(): void {
    for (const arr of this.cells.values()) arr.length = 0;
  }

  insert(o: T): void {
    const cx = Math.floor(o.x / this.cell);
    const cy = Math.floor(o.y / this.cell);
    const k = this.key(cx, cy);
    let arr = this.cells.get(k);
    if (!arr) {
      arr = [];
      this.cells.set(k, arr);
    }
    arr.push(o);
  }

  /** 円に重なるセルの候補を out に追加（距離判定は呼び出し側） */
  query(x: number, y: number, r: number, out: T[]): T[] {
    const x0 = Math.floor((x - r) / this.cell);
    const x1 = Math.floor((x + r) / this.cell);
    const y0 = Math.floor((y - r) / this.cell);
    const y1 = Math.floor((y + r) / this.cell);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.cells.get(this.key(cx, cy));
        if (arr) for (let i = 0; i < arr.length; i++) out.push(arr[i]);
      }
    }
    return out;
  }

  /** 同じセル内の要素（敵同士の押し合い用） */
  sameCell(o: T): T[] | undefined {
    return this.cells.get(this.key(Math.floor(o.x / this.cell), Math.floor(o.y / this.cell)));
  }
}
