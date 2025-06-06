type IPromiseCacheOptions = {
  maxSize?: number
  ttlMs?: number
}

/**
 * Manages a cache of active promises to prevent duplicate function calls.
 * When the same key is requested multiple times, returns the same promise.
 * Automatically cleans up failed promises to allow retries.
 */
export class PromiseCache<T> {
  private cache = new Map<string, { promise: Promise<T>; timestamp: number }>()
  private maxSize: number
  private ttlMs: number

  constructor(options: IPromiseCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 100
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000 // 5 minutes default
  }

  /**
   * Removes expired entries and enforces size limits
   */
  private cleanup() {
    const now = Date.now()
    const expiredKeys: string[] = []

    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        expiredKeys.push(key)
      }
    }

    expiredKeys.forEach((key) => this.cache.delete(key))

    // If still over max size, remove oldest entries
    if (this.cache.size > this.maxSize) {
      const sortedEntries = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp,
      )

      const entriesToRemove = sortedEntries.slice(0, this.cache.size - this.maxSize)
      entriesToRemove.forEach(([key]) => this.cache.delete(key))
    }
  }

  /**
   * Gets or creates a promise for the given key.
   * If a promise already exists, returns it.
   * If the promise fails, automatically removes it from cache to allow retries.
   */
  async getOrCreate(args: { key: string; fn: () => Promise<T> }): Promise<T> {
    const { key, fn } = args

    this.cleanup()

    // Check if we already have an active promise
    const existing = this.cache.get(key)
    if (existing) {
      return existing.promise
    }

    // Create new promise
    const promise = fn()

    // Store in cache
    this.cache.set(key, {
      promise,
      timestamp: Date.now(),
    })

    try {
      const result = await promise
      // Keep successful promises in cache (they'll expire via TTL)
      return result
    } catch (error) {
      // Remove failed promises immediately to allow retries
      this.cache.delete(key)
      throw error
    }
  }

  /**
   * Manually remove a key from cache
   */
  delete(key: string) {
    this.cache.delete(key)
  }

  /**
   * Clear all cached promises
   */
  clear() {
    this.cache.clear()
  }

  /**
   * Get current cache size
   */
  size() {
    return this.cache.size
  }
}

/**
 * Creates a new promise cache instance
 */
export function createPromiseCache<T>(options?: IPromiseCacheOptions) {
  return new PromiseCache<T>(options)
}

/**
 * Higher-order function that wraps a function with promise caching
 */
export function withPromiseCache<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: IPromiseCacheOptions & {
    keyGenerator: (...args: TArgs) => string
  },
) {
  const cache = new PromiseCache<TReturn>(options)

  return async (...args: TArgs): Promise<TReturn> => {
    const key = options.keyGenerator(...args)
    return cache.getOrCreate({
      key,
      fn: () => fn(...args),
    })
  }
}
