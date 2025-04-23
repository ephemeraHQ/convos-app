export function withTimeout<T>(args: {
  promise: Promise<T>
  timeoutMs: number
  errorMessage?: string
}): Promise<T> {
  const { promise, timeoutMs, errorMessage = "Operation timed out" } = args

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(errorMessage))
    }, timeoutMs)

    promise
      .then((result) => {
        clearTimeout(timeoutId)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}
