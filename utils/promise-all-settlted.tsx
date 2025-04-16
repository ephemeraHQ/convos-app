// Custom implementation of Promise.allSettled to avoid compatibility issues
export async function customPromiseAllSettled<T>(promises: Promise<T>[]) {
  return Promise.all(
    promises.map(async (promise) => {
      try {
        const value = await promise
        return { status: "fulfilled" as const, value }
      } catch (reason) {
        return { status: "rejected" as const, reason }
      }
    }),
  )
}
