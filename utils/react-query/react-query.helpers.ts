import {
  QueryKey,
  QueryObserver,
  QueryObserverResult,
  QueryOptions,
  UseQueryOptions,
} from "@tanstack/react-query"
import { ReactQueryError } from "@/utils/error"
import { queryLogger } from "@/utils/logger/logger"
import { reactQueryClient } from "./react-query.client"

/**
 * Collection of helper functions with clear, explicit names
 * that wrap React Query's operations with more predictable behavior
 */

/**
 * Always forces a network request regardless of cache state
 */
export async function forceNetworkFetchQuery<T>(args: QueryOptions<T>): Promise<T> {
  const { queryKey } = args

  if (!queryKey) {
    throw new Error("queryKey is required")
  }

  return reactQueryClient.fetchQuery({
    ...args,
    queryKey,
    staleTime: 0, // Consider everything stale
  })
}

/**
 * Only fetches if data is stale (respects staleTime in options)
 * Returns cached data if fresh
 */
export async function fetchOnlyIfStaleQuery<T>(args: QueryOptions<T>): Promise<T> {
  const { queryKey } = args

  if (!queryKey) {
    throw new Error("queryKey is required")
  }

  return reactQueryClient.fetchQuery({
    ...args,
    queryKey,
  }) // fetchQuery respects staleTime
}

/**
 * Only fetches if data doesn't exist in cache
 * Never fetches if data exists (even if stale)
 */
export async function fetchOnlyIfMissingQuery<T>(args: QueryOptions<T>): Promise<T> {
  const { queryKey } = args

  if (!queryKey) {
    throw new Error("queryKey is required")
  }

  // Set revalidateIfStale: false to match current behavior
  return reactQueryClient.ensureQueryData({
    ...args,
    queryKey,
    revalidateIfStale: false,
  })
}

/**
 * If fetching is already in progress, wait for that result
 * Otherwise fetch only if stale
 */
export async function fetchWithoutDuplicatesQuery<T>(args: QueryOptions<T>): Promise<T> {
  const { queryKey } = args

  if (!queryKey) {
    throw new Error("queryKey is required")
  }

  const queryState = reactQueryClient.getQueryState(queryKey)

  // If already fetching, don't start another fetch
  if (queryState?.fetchStatus === "fetching") {
    return Promise.resolve(queryState.data as T)
  }

  // Otherwise fetch if stale
  return reactQueryClient.fetchQuery({
    ...args,
    queryKey,
  })
}

/**
 * Prefetches a query if it's enabled
 */
export function prefetchReactQueryBetter<T>(args: UseQueryOptions<T>) {
  if (!args.enabled) {
    queryLogger.debug(`Skipping prefetch for ${args.queryKey} because it's disabled`)
    return
  }
  return reactQueryClient.prefetchQuery(args)
}

/**
 * Refetches a query if it's enabled
 */
export function refetchReactQueryBetter<T>(args: UseQueryOptions<T>) {
  if (!args.enabled) {
    queryLogger.debug(`Skipping refetch for ${args.queryKey} because it's disabled`)
    return Promise.resolve()
  }
  return reactQueryClient.refetchQueries(args)
}

export function ensureQueryDataBetter<T>(args: UseQueryOptions<T>) {
  if (!args.enabled) {
    queryLogger.debug(`Skipping ensureQueryData for ${args.queryKey} because it's disabled`)
    throw new ReactQueryError({
      error: new Error(`Can't call ensureQueryData because query ${args.queryKey} is disabled`),
    })
  }
  return reactQueryClient.ensureQueryData(args)
}

export function refetchQueryIfNotAlreadyFetching<T>(args: UseQueryOptions<T>) {
  const queryState = reactQueryClient.getQueryState(args.queryKey)
  if (queryState?.fetchStatus === "fetching") {
    return Promise.resolve()
  }
  return reactQueryClient.refetchQueries(args)
}

export async function fetchOrRefetchQuery<T>(args: UseQueryOptions<T>) {
  const data = reactQueryClient.getQueryData(args.queryKey)
  if (data) {
    await reactQueryClient.fetchQuery(args)
  }
  await reactQueryClient.refetchQueries(args)
}

/**
 * Creates a query observer that tracks previous data and provides it in the callback
 * This is useful for detecting changes between query updates
 */

export type IQueryObserverWithPreviousDataResult<TData, TError> = QueryObserverResult<
  TData,
  TError
> & { previousData: TData | undefined }

export function createQueryObserverWithPreviousData<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(args: {
  queryOptions: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>
  observerCallbackFn: (result: IQueryObserverWithPreviousDataResult<TData, TError>) => void
}) {
  const { queryOptions, observerCallbackFn } = args

  let previousData: TData | undefined

  const observer = new QueryObserver<TQueryFnData, TError, TData, TQueryFnData, TQueryKey>(
    reactQueryClient,
    queryOptions,
  )

  const initialResult = observer.getCurrentResult()

  // If there's fresh data in the cache on mount (e.g., from persistence),
  // trigger the callback immediately.
  if (initialResult.data !== undefined && !initialResult.isStale) {
    const enhancedResult = {
      ...initialResult,
      previousData: undefined, // No previous data on the very first trigger
    }
    observerCallbackFn(enhancedResult)
    previousData = initialResult.data // Set initial previousData
  }

  // Create a wrapper for the subscription callback that includes previous data
  const unsubscribe = observer.subscribe((result) => {
    // Avoid calling the callback again if the data is the same as the initial trigger
    // This prevents double-firing when the subscription starts *after* the initial check
    if (result.data !== undefined && result.data === previousData && !result.isStale) {
      return
    }

    const enhancedResult = {
      ...result,
      previousData,
    }

    observerCallbackFn(enhancedResult)

    // Only update previous data if we have new data
    if (result.data !== undefined) {
      previousData = result.data
    }
  })

  // Return the observer and a function to unsubscribe
  return {
    observer,
    unsubscribe: () => {
      unsubscribe()
      observer.destroy()
    },
    getCurrentData: () => observer.getCurrentResult().data,
    getPreviousData: () => previousData,
  }
}
