type IDeduplicationOptions = {
  maxSize?: number
  ttlMs?: number
}

type IDeduplicationEntry = {
  timestamp: number
}

/**
 * Manages deduplication of operations using a TTL-based cache with size limits.
 * Useful for preventing duplicate processing of events, messages, or API calls.
 */
export class DeduplicationManager {
  private processedIds = new Map<string, IDeduplicationEntry>()
  private maxSize: number
  private ttlMs: number

  constructor(options: IDeduplicationOptions = {}) {
    this.maxSize = options.maxSize ?? 100
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000 // 5 minutes default
  }

  /**
   * Removes expired entries and enforces size limits by removing oldest entries if needed.
   * Called automatically before any operation that modifies the cache.
   */
  private cleanup() {
    const now = Date.now()
    const expiredKeys: string[] = []

    // Remove expired entries
    for (const [key, entry] of this.processedIds.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        expiredKeys.push(key)
      }
    }

    expiredKeys.forEach((key) => this.processedIds.delete(key))

    // If still over max size, remove oldest entries
    if (this.processedIds.size > this.maxSize) {
      const sortedEntries = Array.from(this.processedIds.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp,
      )

      const entriesToRemove = sortedEntries.slice(0, this.processedIds.size - this.maxSize)
      entriesToRemove.forEach(([key]) => this.processedIds.delete(key))
    }
  }

  isDuplicate(id: string) {
    this.cleanup()
    return this.processedIds.has(id)
  }

  markAsProcessed(id: string) {
    this.cleanup()
    this.processedIds.set(id, { timestamp: Date.now() })
  }

  /**
   * Executes an async function only if the given ID hasn't been processed recently.
   * Returns null if the operation was skipped due to deduplication.
   */
  async executeOnce<T>(args: { id: string; fn: () => Promise<T> }): Promise<T | null> {
    const { id, fn } = args

    if (this.isDuplicate(id)) {
      return null
    }

    this.markAsProcessed(id)
    return fn()
  }

  /**
   * Synchronous version of executeOnce for non-async operations
   */
  executeOnceSync<T>(args: { id: string; fn: () => T }): T | null {
    const { id, fn } = args

    if (this.isDuplicate(id)) {
      return null
    }

    this.markAsProcessed(id)
    return fn()
  }
}

export function createDeduplicationManager(options?: IDeduplicationOptions) {
  return new DeduplicationManager(options)
}

// Singleton instance for simple global deduplication without managing state
const globalDeduplicationManager = new DeduplicationManager()

export async function executeOnceGlobally<T>(args: { id: string; fn: () => Promise<T> }) {
  return globalDeduplicationManager.executeOnce(args)
}

export function executeOnceSyncGlobally<T>(args: { id: string; fn: () => T }) {
  return globalDeduplicationManager.executeOnceSync(args)
}
