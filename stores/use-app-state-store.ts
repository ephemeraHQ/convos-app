import { focusManager as reactQueryFocusManager } from "@tanstack/react-query"
import { useEffect } from "react"
import { AppState, AppStateStatus } from "react-native"
import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import { getAllSenders } from "@/features/authentication/multi-inbox.store"
import { fetchOrRefetchNotificationsPermissions } from "@/features/notifications/notifications-permissions.query"
import { startStreaming, stopStreaming } from "@/features/streams/streams"
import { useXmtpActivityStore } from "@/features/xmtp/xmtp-activity.store"
import { captureError } from "@/utils/capture-error"
import { ExternalCancellationError } from "@/utils/error"
import { logger } from "@/utils/logger/logger"

type State = {
  currentState: AppStateStatus
  previousState: AppStateStatus | null
}

type Actions = {
  handleAppStateChange: (nextAppState: AppStateStatus) => void
}

export const useAppStateStore = create<State & { actions: Actions }>()(
  subscribeWithSelector((set) => ({
    currentState: AppState.currentState,
    previousState: null,

    actions: {
      handleAppStateChange: (nextAppState) =>
        set((state) => {
          return {
            previousState: state.currentState,
            currentState: nextAppState,
          }
        }),
    },
  })),
)

type IAppStateHandlerSettings = {
  onChange?: (status: AppStateStatus) => void
  onForeground?: () => void
  onBackground?: () => void
  onInactive?: () => void
  deps?: React.DependencyList
}

export const useAppStateHandler = (settings?: IAppStateHandlerSettings) => {
  const { onChange, onForeground, onBackground, onInactive, deps = [] } = settings || {}

  useEffect(() => {
    return useAppStateStore.subscribe(
      (state) => ({ current: state.currentState, previous: state.previousState }),
      (next, prev) => {
        if (next.current === "active" && prev?.current !== "active") {
          onForeground?.()
        } else if (prev?.current === "active" && next.current === "background") {
          onBackground?.()
        } else if (prev?.current === "active" && next.current === "inactive") {
          onInactive?.()
        }

        onChange?.(next.current)
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, onForeground, onBackground, onInactive, ...deps])
}

export const waitUntilAppActive = async () => {
  // If app is active, return immediately
  if (useAppStateStore.getState().currentState === "active") {
    return
  }

  logger.debug(`Waiting until app is back into active state...`)

  return new Promise<void>((resolve) => {
    const unsubscribe = useAppStateStore.subscribe(
      (state) => state.currentState,
      (currentState) => {
        if (currentState === "active") {
          unsubscribe()
          resolve()
        }
      },
    )
  })
}

export function useStartListeningToAppState() {
  useEffect(() => {
    const unsubscribeFromAppState = AppState.addEventListener("change", (nextAppState) => {
      const isNowActive = nextAppState === "active"
      reactQueryFocusManager.setFocused(isNowActive)
      useAppStateStore.getState().actions.handleAppStateChange(nextAppState)
    })

    // Listen to the store state changes
    const unsubscribeFromStore = useAppStateStore.subscribe(
      (state) => state.currentState,
      (currentState, previousState) => {
        logger.debug(`App state changed from '${previousState}' to '${currentState}'`)

        const isNowActive = currentState === "active" && previousState && previousState !== "active"
        const isNowInactive =
          (currentState === "inactive" || currentState === "background") &&
          previousState &&
          previousState === "active"
        const isNowBackground = currentState === "background"

        if (isNowActive) {
          startStreaming(getAllSenders().map((sender) => sender.inboxId)).catch(captureError)
          fetchOrRefetchNotificationsPermissions().catch(captureError)
        }

        if (isNowInactive || isNowBackground) {
          stopStreaming(getAllSenders().map((sender) => sender.inboxId)).catch(captureError)
          useXmtpActivityStore.getState().actions.cancelAllActiveOperations(
            new ExternalCancellationError({
              error: new Error("App state changed to inactive or background"),
            }),
          )
        }
      },
    )

    return () => {
      unsubscribeFromAppState.remove()
      unsubscribeFromStore()
    }
  }, [])
}
