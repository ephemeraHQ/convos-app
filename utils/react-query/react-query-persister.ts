import {
  PersistedClient as ReactQueryPersistedClient,
  Persister as ReactQueryPersister,
} from "@tanstack/react-query-persist-client"
import { captureError } from "@/utils/capture-error"
import { ReactQueryPersistError } from "@/utils/error"
import { persistLogger } from "@/utils/logger/logger"
import { startTimer, stopTimer } from "@/utils/perf/perf-timer"
import { createStorage, IStorage } from "@/utils/storage/storage"

const REACT_QUERY_PERSISTER_STORAGE_ID = "convos-react-query-persister"
export const reactQueryPersitingStorage = createStorage(REACT_QUERY_PERSISTER_STORAGE_ID)
export const reactQueryPersister = createReactQueryPersister(reactQueryPersitingStorage)
const REACT_QUERY_PERSITER_STORAGE_CLIENT_KEY = "react-query-client"

function createReactQueryPersister(storage: IStorage): ReactQueryPersister {
  return {
    persistClient: async (client: ReactQueryPersistedClient) => {
      try {
        // Create a deep clone of the client to avoid modifying the original
        const clientToStore = JSON.parse(JSON.stringify(client)) as ReactQueryPersistedClient

        // Process each query before persistence
        // clientToStore.clientState.queries = clientToStore.clientState.queries.map((query) => {
        //   // If query has a transformer function in meta, apply it to transform the data
        //   if (typeof query.meta?.persist === "function") {
        //     // Create a copy to avoid modifying the original
        //     const transformedQuery = { ...query }
        //     transformedQuery.state = {
        //       ...transformedQuery.state,
        //       data: query.meta.persist(query),
        //     }
        //     return transformedQuery
        //   }
        //   return query
        // })

        const clientString = JSON.stringify(clientToStore)

        storage.set(REACT_QUERY_PERSITER_STORAGE_CLIENT_KEY, clientString)

        // Debug persisted queries after successful persistence
        if (__DEV__) {
          // Uncomment to debug persisted queries
          // debugPersistedQueries()
        }
      } catch (error) {
        captureError(
          new ReactQueryPersistError({
            error,
            additionalMessage: "Failed to persist React Query client",
            extra: {
              queries: client.clientState.queries.map((q) => q.queryKey.toString()).join(", "),
            },
          }),
        )
      }
    },
    // Automatically called on app load with "PersistQueryClientProvider"
    restoreClient: async () => {
      try {
        const timerId = startTimer("restoreClient")

        const clientString = storage.getString(REACT_QUERY_PERSITER_STORAGE_CLIENT_KEY)

        if (!clientString) {
          return
        }

        const client = JSON.parse(clientString) as ReactQueryPersistedClient

        persistLogger.debug("React Query client restored", {
          lastHydrationTime: stopTimer(timerId),
          lastHydrationSize: clientString.length,
          lastHydrationQueryCount: client.clientState.queries.length,
        })

        return client
      } catch (error) {
        captureError(
          new ReactQueryPersistError({
            error,
            additionalMessage: "Failed to restore React Query client",
          }),
        )
      }
    },
    // Automatically called when cache needs to be cleared (max GC, error persistence, etc)
    removeClient: async () => {
      try {
        storage.delete(REACT_QUERY_PERSITER_STORAGE_CLIENT_KEY)
      } catch (error) {
        captureError(
          new ReactQueryPersistError({
            error,
            additionalMessage: "Failed to remove React Query client",
          }),
        )
      }
    },
  }
}

/**
 * Utility function to help debug React Query issues in development
 * This can be called from anywhere to check the current state of the persisted queries
 */
function debugPersistedQueries() {
  if (__DEV__) {
    try {
      const clientString = reactQueryPersitingStorage.getString(
        REACT_QUERY_PERSITER_STORAGE_CLIENT_KEY,
      )

      if (!clientString) {
        persistLogger.debug("No persisted React Query client found")
        return
      }

      const client = JSON.parse(clientString) as ReactQueryPersistedClient

      const pendingQueries = client.clientState.queries.filter(
        (query) => query.state.status === "pending",
      )

      const fetchingQueries = client.clientState.queries.filter(
        (query) => query.state.fetchStatus === "fetching",
      )

      const pausedQueries = client.clientState.queries.filter(
        (query) => query.state.fetchStatus === "paused",
      )

      persistLogger.debug("Persisted React Query client summary:", {
        totalQueries: client.clientState.queries.length,
        pendingQueries: pendingQueries.length,
        fetchingQueries: fetchingQueries.length,
        pausedQueries: pausedQueries.length,
        queryKeys: client.clientState.queries.map((q) => q.queryKey),
      })

      // Log any potentially problematic queries
      if (pendingQueries.length > 0 || fetchingQueries.length > 0) {
        persistLogger.warn("Found potentially problematic persisted queries:", {
          pendingQueryKeys: pendingQueries.map((q) => q.queryKey),
          fetchingQueryKeys: fetchingQueries.map((q) => q.queryKey),
        })
      }
    } catch (error) {
      captureError(
        new ReactQueryPersistError({
          error,
          additionalMessage: "Error debugging persisted React Query client",
        }),
      )
    }
  }
}
