import { focusManager as reactQueryFocusManager } from "@tanstack/react-query"
import { useEffect } from "react"
import { AppStateStatus } from "react-native"
import { getAllSenders } from "@/features/authentication/multi-inbox.store"
import { fetchOrRefetchNotificationsPermissions } from "@/features/notifications/notifications-permissions.query"
import { startStreaming, stopStreaming } from "@/features/streams/streams"
import { useAppStateStore } from "@/stores/app-state-store/use-app-state.store"
import { captureError } from "@/utils/capture-error"
import { logger } from "@/utils/logger/logger"

export function getCurrentAppState() {
  return useAppStateStore.getState().currentState
}

export function appCameBackFromBackground() {
  return (
    useAppStateStore.getState().currentState === "active" &&
    useAppStateStore.getState().previousState &&
    useAppStateStore.getState().previousState !== "active"
  )
}

export function appHasGoneToBackground() {
  return useAppStateStore.getState().currentState === "background"
}

export function appHasGoneToInactive() {
  return useAppStateStore.getState().currentState === "inactive"
}

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

let subscribedToAppStateStore = false

export function startListeningToAppStateStore() {
  if (subscribedToAppStateStore) {
    return
  }

  useAppStateStore.subscribe(
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
        reactQueryFocusManager.setFocused(isNowActive)
      }

      if (isNowActive) {
        startStreaming(getAllSenders().map((sender) => sender.inboxId)).catch(captureError)
        fetchOrRefetchNotificationsPermissions().catch(captureError)
      }

      if (isNowInactive || isNowBackground) {
        stopStreaming(getAllSenders().map((sender) => sender.inboxId)).catch(captureError)

        // Try this logic later
        // useXmtpActivityStore.getState().actions.cancelAllActiveOperations(
        //   new ExternalCancellationError({
        //     error: new Error("App state changed to inactive or background"),
        //   }),
        // )
      }
    },
  )

  subscribedToAppStateStore = true
}

export function subscribeToAppStateStore(args: {
  callback: (currentState: AppStateStatus, previousState: AppStateStatus | null) => void
}) {
  const { callback } = args
  return useAppStateStore.subscribe((state) => state.currentState, callback)
}
