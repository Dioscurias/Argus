export class TTLCache<T> {
  private value: T | undefined;
  private expiresAt = 0;
  constructor(private readonly ttlMs: number, private readonly clock = Date.now) {}
  get(): T | undefined { return this.clock() < this.expiresAt ? this.value : undefined; }
  set(value: T): void { this.value = value; this.expiresAt = this.clock() + this.ttlMs; }
  clear(): void { this.value = undefined; this.expiresAt = 0; }
}
