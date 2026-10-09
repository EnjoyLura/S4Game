/** The five lobby pages share one wallet, including placement, counters and acquisition buttons. */
import { Node } from 'cc';
import { loadSave } from '../core/SaveData';
import { CA, gpanel, N, setText, WY } from './UIKit';
import { artSprite } from './Ux';
import { fmt, mainLabel, MAIN_RESOURCE_H, MAIN_W, mainResourceTop } from './PageKit';

export type ResourceCurrency = 'gold' | 'diamond';

export class ResourceBar {
  readonly node: Node;
  private readonly counters = new Map<ResourceCurrency, Node>();

  constructor(parent: Node, onAdd: (currency: ResourceCurrency) => void) {
    this.node = N('resourceWallet', parent);
    const y = WY(mainResourceTop(), MAIN_RESOURCE_H);
    (['gold', 'diamond'] as const).forEach((currency, i) => {
      // 左对齐（用户调整）：药丸贴内容左边（对齐标准头板 -MAIN_W/2），不再整组居中
      const row = gpanel(this.node, -MAIN_W / 2 + 127 + i * 266, y, 254, MAIN_RESOURCE_H,
        CA('#261A12', 0.84), undefined, 0, 16);
      row.name = 'resource:' + currency;
      artSprite(row, -96, 0, 50, 50, currency === 'gold' ? 'ui_icon_coin' : 'ui_icon_diamond', { sliced: false });   // 图标收进框内（旧 -106 超出药丸左缘 4px）
      const counter = mainLabel(row, -10, 0, '', { size: 28, color: currency === 'gold' ? '#FFF0CB' : '#DCF4FF',
        bold: true, align: 'left', w: 108, h: 40, outline: '#24150C', outlineW: 1.4 });
      counter.name = 'resourceAmount';
      this.counters.set(currency, counter);

      const add = N('resourceAdd:' + currency, row, 94, 0, 56, 56);
      gpanel(add, 0, -2, 44, 44, '#2D5C15', undefined, 0, 12);
      const face = gpanel(add, 0, 1, 44, 44, '#69C238', undefined, 0, 12);
      gpanel(face, 0, 15, 28, 3, '#A1E771', undefined, 0, 1.5);
      gpanel(face, 0, 0, 22, 6, '#F6FFE8', undefined, 0, 3);
      gpanel(face, 0, 0, 6, 22, '#F6FFE8', undefined, 0, 3);
      add.on(Node.EventType.TOUCH_START, () => add.setScale(0.94, 0.94, 1));
      add.on(Node.EventType.TOUCH_CANCEL, () => add.setScale(1, 1, 1));
      add.on(Node.EventType.TOUCH_END, (e: unknown) => {
        add.setScale(1, 1, 1);
        const ev = e as { propagationStopped?: boolean };
        if (ev) ev.propagationStopped = true;
        onAdd(currency);
      });
    });
    this.refresh();
  }

  refresh(): void {
    const save = loadSave();
    setText(this.counters.get('gold')!, fmt(Math.floor(save.gold)));
    setText(this.counters.get('diamond')!, fmt(save.diamonds));
  }
}
