/** 伤害统计（§3.11：按英雄聚合，自动 W/K 格式化） */
export interface DamageRow { id: string; name: string; val: number; pct: number; }

export class DamageService {
  private totals: Record<string, number> = {};
  private names: Record<string, string> = {};

  register(id: string, name: string): void {
    this.names[id] = name;
    if (this.totals[id] === undefined) this.totals[id] = 0;
  }
  add(id: string, v: number): void {
    this.totals[id] = (this.totals[id] || 0) + v;
  }
  rows(): DamageRow[] {
    const all = Object.keys(this.names).map(id => ({ id, name: this.names[id], val: this.totals[id] || 0 }));
    const sum = all.reduce((s, r) => s + r.val, 0) || 1;
    all.sort((a, b) => b.val - a.val);
    return all.map(r => ({ ...r, pct: r.val / sum }));
  }
  reset(): void {
    this.totals = {};
    for (const id of Object.keys(this.names)) this.totals[id] = 0;
  }
}

/** 1.14W / 1.29K 格式化 */
export function fmtWk(n: number): string {
  n = Math.round(n);
  if (n >= 10000) return trimZ(n / 10000) + 'W';
  if (n >= 1000) return trimZ(n / 1000) + 'K';
  return String(n);
}
function trimZ(v: number): string {
  const s = v.toFixed(2);
  return s.replace(/\.?0+$/, '');
}
