export function withTimeout<T>(args: {
  promise: Promise<T>
  timeoutMs: number
  errorMessage?: string
}) {
  const { promise: originalPromise, timeoutMs, errorMessage = "Operation timed out" } = args
  let timeoutId: NodeJS.Timeout | null = null
  let rejectPromise: (reason?: any) => void // To hold the reject function of the outer promise
  let isSettled = false // Prevent multiple settlements

  const wrappedPromise = new Promise<T>((resolve, reject) => {
    rejectPromise = reject // Store reject for the cancel function

    timeoutId = setTimeout(() => {
      if (isSettled) return
      isSettled = true
      reject(new Error(errorMessage))
    }, timeoutMs)

    originalPromise
      .then((result) => {
        if (isSettled) return
        isSettled = true
        if (timeoutId) clearTimeout(timeoutId)
        resolve(result)
      })
      .catch((error) => {
        if (isSettled) return
        isSettled = true
        if (timeoutId) clearTimeout(timeoutId)
        reject(error) // Reject with the original promise's error
      })
  })

  const cancel = (cancelReason: Error) => {
    if (isSettled) return // Already settled (resolved, rejected, timed out, or cancelled)
    isSettled = true
    if (timeoutId) clearTimeout(timeoutId)
    rejectPromise(cancelReason) // Reject the promise externally
  }

  return { promise: wrappedPromise, cancel }
}
