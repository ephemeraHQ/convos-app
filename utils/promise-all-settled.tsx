import { ensureError } from "@/utils/error"

type IPromiseSettledResult<T> =
  | { status: "fulfilled"; value: T }
  | { status: "rejected"; reason: Error }

// Update the signature to accept an array of Promises resolving to potentially different types (unknown)
export async function customPromiseAllSettled<T extends ReadonlyArray<unknown>>(
  promises: T,
): Promise<{ -readonly [P in keyof T]: IPromiseSettledResult<Awaited<T[P]>> }> {
  return Promise.all(
    promises.map(async (promise) => {
      try {
        // Ensure we're awaiting a promise, even if a non-promise value was passed
        const value = await Promise.resolve(promise)
        return { status: "fulfilled" as const, value }
      } catch (reason) {
        return { status: "rejected" as const, reason: ensureError(reason) }
      }
    }),
    // Cast the result to the more specific mapped type
  ) as Promise<{ -readonly [P in keyof T]: IPromiseSettledResult<Awaited<T[P]>> }>
}
