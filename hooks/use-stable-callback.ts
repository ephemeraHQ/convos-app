import { useCallback } from "react"
import { useLatestRef } from "./use-latest-ref"

type AnyFunction = (...args: any[]) => any

/**
 * Creates a stable callback that always uses the latest values of its dependencies
 * without needing to add them to the dependency array of useCallback.
 *
 * @param callback The callback function to stabilize
 * @param latestValues An object containing the latest values to be used in the callback
 * @param dependencies Array of actual dependencies for useCallback (typically empty or minimal)
 * @returns A stable callback function that always uses latest values
 *
 * @example
 * // Original pattern with changing dependencies causing rerenders:
 * const handleClick = useCallback(() => {
 *   doSomething(value)
 * }, [value]) // Changes when value changes
 *
 * // With useStableCallback - callback doesn't change when value changes:
 * const handleClick = useStableCallback(
 *   ({ value }) => {
 *     doSomething(value)
 *   },
 *   { value },
 *   [] // Empty dependencies means the callback never changes
 * )
 *
 * // Passing external arguments:
 * const handleChange = useStableCallback(
 *   ({ currentValue }, newValue: string) => {
 *     console.log(`Value changed from ${currentValue} to ${newValue}`)
 *   },
 *   { currentValue },
 *   []
 * )
 */
export function useStableCallback<T extends object, F extends AnyFunction>(
  callback: (latestValues: T, ...args: Parameters<F>) => ReturnType<F>,
  latestValues: T,
  dependencies: any[] = [],
) {
  const valuesRef = useLatestRef(latestValues)

  return useCallback(
    (...args: Parameters<F>) => {
      return callback(valuesRef.current, ...args)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...dependencies],
  )
}
