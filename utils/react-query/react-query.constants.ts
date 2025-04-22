import { UseQueryOptions } from "@tanstack/react-query"
import { TimeUtils } from "@/utils/time.utils"

export const DEFAULT_GC_TIME = TimeUtils.minutes(5).toMilliseconds()

export const DEFAULT_STALE_TIME = TimeUtils.minutes(1).toMilliseconds()

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
