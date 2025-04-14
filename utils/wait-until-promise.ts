/**
 * Repeatedly calls a function until it returns true, then resolves the promise.
 * Checks every 100ms by default.
 * Times out after 10 seconds by default.
 */
export function waitUntilPromise<T>(args: {
  checkFn: () => T | Promise<T>
  intervalMs?: number
  timeoutMs?: number
  errorMessage?: string
}): Promise<T> {
  const {
    checkFn,
    intervalMs = 100,
    timeoutMs = 10000,
    errorMessage = "Promise timed out, please try again",
  } = args

  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    let timeoutId: NodeJS.Timeout | undefined

    const check = () => {
      const result = checkFn()
      if (result) {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        resolve(result)
      } else {
        if (timeoutMs && Date.now() - startTime > timeoutMs) {
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
          reject(new Error(errorMessage))
        } else {
          timeoutId = setTimeout(check, intervalMs)
        }
      }
    }

    check()
  })
}
