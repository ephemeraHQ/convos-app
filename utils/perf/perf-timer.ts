/**
 * Simple utilities for measuring performance metrics in the app
 */

const timers = new Map<string, number>()

/**
 * Start timing an operation
 */
export function startTimer(name: string): string {
  const id = `${name}_${Date.now()}`
  timers.set(id, performance.now())
  return id
}

/**
 * Stop timing an operation and return the duration in milliseconds
 */
export function stopTimer(id: string): number {
  const startTime = timers.get(id)
  if (startTime === undefined) {
    return 0
  }

  const duration = performance.now() - startTime
  timers.delete(id)
  return Math.round(duration)
}

/**
 * Measures the execution time of a function
 */
export function measureTime<T>(fn: () => T): { result: T; durationMs: number } {
  const start = performance.now()
  const result = fn()
  const durationMs = Math.round(performance.now() - start)

  return { result, durationMs }
}

/**
 * Measures the execution time of an async function
 */
export async function measureTimeAsync<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now()
  const result = await fn()
  const durationMs = Math.round(performance.now() - start)

  return { result, durationMs }
}
