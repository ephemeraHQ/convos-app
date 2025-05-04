import { QueryClientProvider } from "@tanstack/react-query"
import { PersistQueryClientProvider as ReactQueryPersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { memo, useEffect } from "react"
import { config } from "@/config"
import { useAppStore } from "@/stores/app-store"
import { persistLogger } from "@/utils/logger/logger"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { DEFAULT_GC_TIME } from "@/utils/react-query/react-query.constants"
import { reactQueryPersister } from "./react-query-persister"

export const ReactQueryProvider = memo(function ReactQueryProvider(props: {
  children: React.ReactNode
}) {
  const { children } = props

  if (!config.reactQueryPersistCacheIsEnabled) {
    return <NoPersistQueryClientProvider>{children}</NoPersistQueryClientProvider>
  }

  return <PersistQueryClientProvider>{children}</PersistQueryClientProvider>
})

function NoPersistQueryClientProvider(props: { children: React.ReactNode }) {
  const { children } = props

  useEffect(() => {
    useAppStore.getState().actions.setReactQueryIsHydrated(true)
  }, [])

  return <QueryClientProvider client={reactQueryClient}>{children}</QueryClientProvider>
}

function PersistQueryClientProvider(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <ReactQueryPersistQueryClientProvider
      client={reactQueryClient}
      persistOptions={{
        persister: reactQueryPersister,
        maxAge: DEFAULT_GC_TIME,
        buster: "v5", // Changing this will force a new cache
        dehydrateOptions: {
          // Determines which queries should be persisted to storage
          shouldDehydrateQuery(query) {
            if (!config.reactQueryPersistCacheIsEnabled) {
              persistLogger.debug("Not dehydrating query because persist cache is disabled")
              return false
            }

            const shouldHydrate =
              (query.meta?.persist === undefined ||
                (typeof query.meta.persist === "function"
                  ? query.meta.persist(query)
                  : query.meta.persist)) &&
              query.state.status !== "pending" &&
              query.state.fetchStatus !== "fetching"

            return shouldHydrate
          },
        },
      }}
      onSuccess={() => {
        persistLogger.debug("React Query client hydrated")
        useAppStore.getState().actions.setReactQueryIsHydrated(true)
      }}
    >
      {children}
    </ReactQueryPersistQueryClientProvider>
  )
}
