import { UseQueryOptions } from "@tanstack/react-query"

export const DEFAULT_GC_TIME = 1000 * 60 * 60 * 24 * 7 // 7 days

export const DEFAULT_STALE_TIME = 1000 * 60 * 60 * 24 // 24h

export const reactQueryCacheOnlyQueryOptions: Partial<UseQueryOptions<any>> = {
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  staleTime: Infinity,
}

export const reactQueryFreshDataQueryOptions = {
  refetchOnMount: "always",
  refetchOnWindowFocus: "always",
} as const
