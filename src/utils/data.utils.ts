export class BidirectionalMap<TKey, TValue> implements Map<TKey, TValue> {
  private forwardMap = new Map<TKey, TValue>();
  private reverseMap = new Map<TValue, TKey>();

  public constructor(initialPairs?: Iterable<[TKey, TValue]>) {
    if (initialPairs === undefined) {
      return;
    }
    for (const [key, value] of initialPairs) {
      this.set(key, value);
    }
  }

  public get size(): number {
    return this.forwardMap.size;
  }

  public set(key: TKey, value: TValue): this {
    this.forwardMap.set(key, value);
    this.reverseMap.set(value, key);
    return this;
  }

  public has(key: TKey): boolean {
    return this.forwardMap.has(key);
  }

  public hasValue(value: TValue): boolean {
    return this.reverseMap.has(value);
  }

  public get(key: TKey): TValue | undefined {
    return this.forwardMap.get(key);
  }

  public getKey(value: TValue): TKey | undefined {
    return this.reverseMap.get(value);
  }

  public delete(key: TKey): boolean {
    return this.deleteByKey(key);
  }

  public deleteByKey(key: TKey): boolean {
    const value = this.forwardMap.get(key);
    if (value == undefined) {
      return false;
    }
    this.forwardMap.delete(key);
    this.reverseMap.delete(value);
    return true;
  }

  public deleteByValue(value: TValue): boolean {
    const key = this.reverseMap.get(value);
    if (key == undefined) {
      return false;
    }
    this.reverseMap.delete(value);
    this.forwardMap.delete(key);
    return true;
  }

  public clear(): void {
    this.forwardMap.clear();
    this.reverseMap.clear();
  }

  public keys() {
    return this.forwardMap.keys();
  }

  public values() {
    return this.reverseMap.keys();
  }

  public entries() {
    return this.forwardMap.entries();
  }

  public forEach(
    callbackfn: (value: TValue, key: TKey, map: Map<TKey, TValue>) => void,
    thisArg?: any,
  ): void {
    this.forwardMap.forEach(callbackfn, thisArg);
  }

  public [Symbol.iterator]() {
    return this.entries();
  }

  public get [Symbol.toStringTag](): string {
    return this.constructor.name;
  }
}
