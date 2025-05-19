import { queryLogger } from "@/utils/logger/logger"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { reactQueryPersistingStorage } from "../storage/storages"

// Doing this because we onced added caller to the query key and we should never do that.
type DisallowedKey = "caller"

export function getReactQueryKey<T extends Record<string, string | undefined>>(
  args: { baseStr: string } & { [K in Exclude<keyof T, DisallowedKey>]?: string },
): string[] {
  const { baseStr, ...rest } = args
  const filteredEntries = Object.entries(rest).filter(([key]) => key !== "caller")
  return [baseStr, ...filteredEntries.map(([key, value]) => `${key}: ${value}`)]
}

export function clearReacyQueryQueriesAndCache() {
  queryLogger.debug("Clearing react query queries and cache...")
  reactQueryClient.getQueryCache().clear()
  reactQueryClient.clear()
  reactQueryClient.removeQueries()
  reactQueryPersistingStorage.clearAll()
  queryLogger.debug("Cleared react query queries and cache")
}
