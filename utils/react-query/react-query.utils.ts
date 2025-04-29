import { QueryKey } from "@tanstack/react-query"
import { queryLogger } from "@/utils/logger/logger"
import { reactQueryPersitingStorage } from "@/utils/react-query/react-query-persister"
import { reactQueryClient } from "@/utils/react-query/react-query.client"

// Helper to have a consistent way to format query keys
export function getReactQueryKey(args: {
  baseStr: string
  [key: string]: string | undefined
}): QueryKey {
  const { baseStr, ...rest } = args
  return [baseStr, ...Object.entries(rest).map(([key, value]) => `${key}: ${value}`)]
}

export function clearReacyQueryQueriesAndCache() {
  queryLogger.debug("Clearing react query queries and cache...")
  reactQueryClient.getQueryCache().clear()
  reactQueryClient.clear()
  reactQueryClient.removeQueries()
  reactQueryPersitingStorage.clearAll()
  queryLogger.debug("Cleared react query queries and cache")
}
