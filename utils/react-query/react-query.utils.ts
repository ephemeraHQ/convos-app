import { queryLogger } from "@/utils/logger/logger"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { reactQueryPersistingStorage } from "../storage/storages"

// Helper to have a consistent way to format query keys
export function getReactQueryKey(args: {
  baseStr: string
  [key: string]: string | undefined
}): string[] {
  const { baseStr, ...rest } = args
  return [baseStr, ...Object.entries(rest).map(([key, value]) => `${key}: ${value}`)]
}

export function clearReacyQueryQueriesAndCache() {
  queryLogger.debug("Clearing react query queries and cache...")
  reactQueryClient.getQueryCache().clear()
  reactQueryClient.clear()
  reactQueryClient.removeQueries()
  reactQueryPersistingStorage.clearAll()
  queryLogger.debug("Cleared react query queries and cache")
}
