import { QueryKey } from "@tanstack/react-query"
import { reactQueryMMKV } from "@/utils/react-query/react-query-persister"
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
  reactQueryClient.getQueryCache().clear()
  reactQueryClient.clear()
  reactQueryClient.removeQueries()
  reactQueryMMKV.clearAll()
}
