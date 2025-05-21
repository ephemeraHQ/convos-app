import { queryLogger } from "@/utils/logger/logger"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { reactQueryPersistingStorage } from "../storage/storages"

export function getReactQueryKey<ArgType extends { baseStr: string; [key: string]: unknown }>(
  args: ArgType &
    // We don't want people to pass in a "caller" key.
    ("caller" extends keyof ArgType ? never : {}),
): string[] {
  const { baseStr, ...rest } = args as { baseStr: string; [key: string]: unknown }

  // Make sure caller isn't in the rest of the keys.
  const filteredEntries = Object.entries(rest).filter(([key]) => key !== "caller")

  return [baseStr, ...filteredEntries.map(([key, value]) => `${key}: ${String(value)}`)]
}

export function clearReacyQueryQueriesAndCache() {
  queryLogger.debug("Clearing react query queries and cache...")
  reactQueryClient.getQueryCache().clear()
  reactQueryClient.clear()
  reactQueryClient.removeQueries()
  reactQueryPersistingStorage.clearAll()
  queryLogger.debug("Cleared react query queries and cache")
}
