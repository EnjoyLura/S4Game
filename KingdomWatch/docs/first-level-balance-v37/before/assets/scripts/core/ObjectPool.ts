/** 通用对象池（§12.4：弹道/怪物/飘字强制走池） */
export class Pool<T> {
  private items: T[] = [];
  constructor(private factory: () => T, private reset?: (item: T) => void) {}

  get(): T {
    return this.items.pop() ?? this.factory();
  }
  put(item: T): void {
    if (this.reset) this.reset(item);
    this.items.push(item);
  }
}
