/** Bundled game fonts: stable across devices, lazy-loaded once per role. */
import { Font, Label, resources } from 'cc';

export type FontRole = 'body' | 'title' | 'number' | 'combat' | 'comic';
const FILES: Record<FontRole, string> = {
  body: 'UIBody', title: 'UIHeading', number: 'UINumbers', combat: 'CombatDigits', comic: 'ComicLettering',
};
const loaded = new Map<FontRole, Font>();
const waiting = new Map<FontRole, Label[]>();
const requestedRole = new WeakMap<Label, FontRole>();

function install(label: Label, font: Font, role: FontRole): void {
  if (!label.isValid || requestedRole.get(label) !== role) return;
  label.font = font;
  label.useSystemFont = false;
  if (role !== 'body') label.isBold = false; // Weight is already baked into the glyphs.
}

export function applyFont(label: Label, role: FontRole): void {
  requestedRole.set(label, role);
  const font = loaded.get(role);
  if (font) { install(label, font, role); return; }
  label.useSystemFont = true;
  label.fontFamily = role === 'title' ? 'serif' : 'sans-serif';
  const queue = waiting.get(role);
  if (queue) { if (!queue.includes(label)) queue.push(label); return; }
  waiting.set(role, [label]);
  requestFont(role);
}

function requestFont(role: FontRole): void {
  resources.load('fonts/' + FILES[role], Font, (err, asset) => {
    const labels = waiting.get(role) || [];
    waiting.delete(role);
    if (err || !asset) return;
    loaded.set(role, asset);
    labels.forEach(l => install(l, asset, role));
  });
}

export function warmGameFonts(): void {
  (Object.keys(FILES) as FontRole[]).forEach(role => {
    if (loaded.has(role) || waiting.has(role)) return;
    waiting.set(role, []); requestFont(role);
  });
}

/** Preserve system emoji rendering; prose uses a readable Chinese body face. */
export function inferFont(text: string, size: number, bold: boolean): FontRole | null {
  if (/^[\s\p{Extended_Pictographic}\uFE0F\u200D]+$/u.test(text)) return null;
  if (bold && size >= 30 && /[\u3400-\u9FFF]/.test(text)) return 'title';
  if (/[0-9]/.test(text) && /^[\d\sA-Za-z.,:;%+\-/×÷±→←∞％−]+$/.test(text)) return 'number';
  return 'body';
}
