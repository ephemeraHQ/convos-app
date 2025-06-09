import { UseQueryOptions } from "@tanstack/react-query"
import { TimeUtils } from "@/utils/time.utils"

export const DEFAULT_GC_TIME_MS = TimeUtils.days(2).toMilliseconds()

export const DEFAULT_STALE_TIME_MS = TimeUtils.hours(12).toMilliseconds()

export const reactQueryLongCacheQueryOptions: Partial<UseQueryOptions<any>> = {
  staleTime: TimeUtils.days(30).toMilliseconds(),
  gcTime: TimeUtils.days(30).toMilliseconds(),
}

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
