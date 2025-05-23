import { Mutation, MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
import { AxiosError } from "axios"
import { captureError } from "@/utils/capture-error"
import { ReactQueryError } from "@/utils/error"
import { queryLogger } from "@/utils/logger/logger"
import { DEFAULT_GC_TIME, DEFAULT_STALE_TIME } from "./react-query.constants"

const queryStartTimes = new Map<string, number>()

export const reactQueryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (data, variables, context, mutation) => {
      queryLogger.debug(`Mutation success`, {
        ...(mutation.options.meta?.caller ? { caller: mutation.options.meta.caller } : {}),
        mutationKey: mutation.options.mutationKey,
        data,
        variables,
      })
    },
    onError: (
      error: Error,
      variables: unknown,
      context: unknown,
      mutation: Mutation<unknown, unknown, unknown, unknown>,
    ) => {
      const extra: Record<string, string | number> = {
        mutationKey: mutation.options.mutationKey
          ? JSON.stringify(mutation.options.mutationKey)
          : "",
        ...(error instanceof AxiosError && {
          apiErrorStatus: error.response?.status,
          apiErrorStatusText: error.response?.statusText,
          apiErrorData: JSON.stringify(error.response?.data),
          apiErrorParams: JSON.stringify(error.config?.params),
        }),
      }

      if (mutation.meta?.caller) {
        extra.caller = mutation.meta.caller as string
      }

      if (variables) {
        extra.variables = JSON.stringify(variables)
      }

      // Wrap the error in ReactQueryError
      const wrappedError = new ReactQueryError({
        error,
        additionalMessage: `Mutation failed`,
        extra,
      })

      captureError(wrappedError)
    },
  }),
  queryCache: new QueryCache({
    // Used to track which queries execute the queryFn which means will do a network request.
    // Carefull, this is also triggered when the query gets its data from the persister.
    onSuccess: (_, query) => {
      const startTime = queryStartTimes.get(query.queryHash)
      let durationMessage = ""
      if (startTime) {
        const duration = Date.now() - startTime
        durationMessage = ` in ${duration}ms`
        queryStartTimes.delete(query.queryHash)
      }
      queryLogger.debug(
        `Success fetching query: ${JSON.stringify(query.queryKey)}${
          query.meta?.caller ? ` (caller: ${query.meta.caller})` : ""
        }${durationMessage}`,
      )
    },
    onError: (error: Error, query) => {
      const startTime = queryStartTimes.get(query.queryHash)
      let durationMs: number | undefined
      if (startTime) {
        durationMs = Date.now() - startTime
        queryStartTimes.delete(query.queryHash)
      }

      const extra: Record<string, string | number> = {
        queryKey: JSON.stringify(query.queryKey),
        ...(error instanceof AxiosError && {
          apiErrorStatus: error.response?.status,
          apiErrorStatusText: error.response?.statusText,
          apiErrorData: JSON.stringify(error.response?.data),
          apiErrorParams: JSON.stringify(error.config?.params),
        }),
      }

      if (query.meta?.caller) {
        extra.caller = query.meta.caller as string
      }

      if (durationMs !== undefined) {
        extra.durationMs = durationMs
      }

      // Wrap the error in ReactQueryError
      const wrappedError = new ReactQueryError({
        error,
        extra,
      })

      captureError(wrappedError)
    },
  }),

  defaultOptions: {
    queries: {
      gcTime: DEFAULT_GC_TIME,
      staleTime: DEFAULT_STALE_TIME,

      // Retry max 3 times
      retry: (failureCount) => {
        if (failureCount >= 3) {
          return false
        }
        return true
      },
      // Exponential backoff with a max delay of 30 seconds:
      // 1st retry: 2s delay
      // 2nd retry: 4s delay
      // 3rd retry: 8s delay
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // For now let's control our retries
      retryOnMount: false,

      // Prevent infinite refetch loops by manually controlling when queries should refetch when components mount
      refetchOnMount: false,

      // Disable automatic refetching on window focus since we want to control this per-query based on data staleness needs
      refetchOnWindowFocus: false,

      // For now we don't handle disconnect/reconnect ourselves so we let react-query handle it
      refetchOnReconnect: true,

      // Put this to "false" if we see sloweness with react-query but otherwise
      structuralSharing: true,
    },
  },
})

reactQueryClient.getQueryCache().subscribe((event) => {
  // We are interested in 'updated' events that were triggered by a 'fetch' action.
  // This indicates that the query has started its fetching process.
  if (event.type === "updated" && event.action?.type === "fetch") {
    queryStartTimes.set(event.query.queryHash, Date.now())
    queryLogger.debug(
      `Start fetching query: ${JSON.stringify(event.query.queryKey)}${
        event.query.meta?.caller ? ` (caller: ${event.query.meta.caller})` : ""
      }...`,
    )
  }
})
