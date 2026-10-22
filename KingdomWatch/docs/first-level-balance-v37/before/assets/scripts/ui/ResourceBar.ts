/** The five lobby pages share one wallet, including placement, counters and acquisition buttons. */
import { Node } from 'cc';
import { loadSave } from '../core/SaveData';
import { N, setText, WY } from './UIKit';
import { COMIC, comicArt, comicButton, comicMark, comicSurface } from './ComicUI';
import { fmt, mainLabel, MAIN_RESOURCE_H, MAIN_W, mainResourceTop } from './PageKit';

export type ResourceCurrency = 'gold' | 'diamond';

export class ResourceBar {
  readonly node: Node;
  private readonly counters = new Map<ResourceCurrency, Node>();

  constructor(parent: Node, onAdd: (currency: ResourceCurrency) => void) {
    this.node = N('resourceWallet', parent);
    const y = WY(mainResourceTop(), MAIN_RESOURCE_H);
    const counterW = 218, gap = 12;
    (['gold', 'diamond'] as const).forEach((currency, i) => {
      // Keep the shared wallet against the content's right edge, clear of the shop sign.
      const x = MAIN_W / 2 - counterW / 2 - (1 - i) * (counterW + gap);
      const row = comicSurface(this.node, x, y, counterW, MAIN_RESOURCE_H,
        'dark', { name: 'resource:' + currency, radius: 12 });
      comicArt(row, -81, 0, 44, 44, currency === 'gold' ? 'comic_coin_v1' : 'comic_diamond_v1');
      const counter = mainLabel(row, -9, 0, '', { size: 27, color: currency === 'gold' ? COMIC.cream : '#DCF4FF',
        font: 'number', bold: true, align: 'left', w: 84, h: 40 });
      counter.name = 'resourceAmount';
      this.counters.set(currency, counter);

      const add = comicButton(row, 82, 0, 40, 40, '', () => onAdd(currency),
        { name: 'resourceAdd:' + currency, tone: 'green', quiet: true });
      comicMark(add.getChildByName('buttonFace')!, 0, 0, 'plus', 24);
    });
    this.refresh();
  }

  refresh(): void {
    const save = loadSave();
    setText(this.counters.get('gold')!, fmt(Math.floor(save.gold)));
    setText(this.counters.get('diamond')!, fmt(save.diamonds));
  }
}
