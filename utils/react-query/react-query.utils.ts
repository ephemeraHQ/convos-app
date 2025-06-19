import { QueryKey } from "@tanstack/react-query"
import { queryLogger } from "@/utils/logger/logger"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { reactQueryPersistingStorage } from "../storage/storages"

// Doing this because we onced added caller to the query key and we should never do that.
type DisallowedKey = "caller"

export function getReactQueryKey<T extends Record<string, string | undefined>>(
  args: { baseStr: string } & { [K in Exclude<keyof T, DisallowedKey>]?: string },
): QueryKey {
  const { baseStr, ...rest } = args
  const filteredEntries = Object.entries(rest).filter(([key]) => key !== "caller")
  return [baseStr, ...filteredEntries.map(([key, value]) => `${key}: ${value}`)]
}

export function clearReacyQueryQueriesAndCache() {
  const { measureTime } = require("@/utils/perf/perf-timer")

  queryLogger.debug("Clearing all caches...")
  const { durationMs: clearAllMs } = measureTime(() => {
    reactQueryClient.clear()
  })
  queryLogger.debug(`All caches cleared in ${clearAllMs}ms`)

  queryLogger.debug("Clearing persisted storage...")
  const { durationMs: clearStorageMs } = measureTime(() => {
    reactQueryPersistingStorage.clearAll()
  })
  queryLogger.debug(`Persisted storage cleared in ${clearStorageMs}ms`)

  const totalMs = clearAllMs + clearStorageMs
  queryLogger.debug(`Total cache clearing completed in ${totalMs}ms`)
}
