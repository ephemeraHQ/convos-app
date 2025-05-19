import { focusManager as reactQueryFocusManager } from "@tanstack/react-query"
import { useEffect } from "react"
import { AppStateStatus } from "react-native"
import { getAllSenders, getCurrentSender } from "@/features/authentication/multi-inbox.store"
import {
  getAllowedConsentConversationsQueryData,
  invalidateAllowedConsentConversationsQuery,
} from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
import { invalidateUnknownConsentConversationsQuery } from "@/features/conversation/conversation-requests-list/conversations-unknown-consent.query"
import { invalidateConversationQuery } from "@/features/conversation/queries/conversation.query"
import { fetchOrRefetchNotificationsPermissions } from "@/features/notifications/notifications-permissions.query"
import { registerPushNotifications } from "@/features/notifications/notifications-register"
import { startStreaming, stopStreaming } from "@/features/streams/streams"
import { useAppStateStore } from "@/stores/app-state-store/app-state.store"
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

let unsubscribedFromAppStateStore: (() => void) | undefined

export function startListeningToAppStateStore() {
  if (unsubscribedFromAppStateStore) {
    unsubscribedFromAppStateStore()
  }

  unsubscribedFromAppStateStore = useAppStateStore.subscribe(
    (state) => state.currentState,
    (currentState, previousState) => {
      logger.debug(`App state changed from '${previousState}' to '${currentState}'`)

      const isOpenFromClosed =
        currentState === "active" && (!previousState || previousState === "active")
      const isOpenFromBackground = currentState === "active" && previousState === "background"
      const isGoingToBackground = currentState === "background" && previousState === "inactive"

      const senders = getAllSenders()
      const currentSender = getCurrentSender()

      if (isOpenFromClosed || isOpenFromBackground) {
        // Tell react query we're now on "window focused" state
        reactQueryFocusManager.setFocused(true)

        // Start streaming
        startStreaming(senders.map((sender) => sender.inboxId)).catch(captureError)

        // Refresh notifications permissions in case they disabled them in their settings or something
        fetchOrRefetchNotificationsPermissions().catch(captureError)

        // Register push notifications to make sure it's always up-to-date
        registerPushNotifications().catch(captureError)

        if (currentSender) {
          // Invalidate known consent conversations to make sure we refetch them with the lastMessage property
          invalidateAllowedConsentConversationsQuery({
            clientInboxId: currentSender.inboxId,
          }).catch(captureError)

          // Invalidate unknown consent conversations to make sure we're not missing any unknown chat requests
          invalidateUnknownConsentConversationsQuery({
            inboxId: currentSender.inboxId,
          }).catch(captureError)

          // Invalidate all current sender's allowed consent conversations to make sure they're up-to-date
          // info like group names, etc...
          getAllowedConsentConversationsQueryData({
            clientInboxId: currentSender.inboxId,
          })?.map((conversationId) =>
            invalidateConversationQuery({
              clientInboxId: currentSender.inboxId,
              xmtpConversationId: conversationId,
            }).catch(captureError),
          )
        }
      }

      if (isGoingToBackground) {
        stopStreaming(senders.map((sender) => sender.inboxId)).catch(captureError)

        // Try this logic later
        // useXmtpActivityStore.getState().actions.cancelAllActiveOperations(
        //   new ExternalCancellationError({
        //     error: new Error("App state changed to inactive or background"),
        //   }),
        // )
      }
    },
    {
      fireImmediately: true,
    },
  )
}

export function subscribeToAppStateStore(args: {
  callback: (currentState: AppStateStatus, previousState: AppStateStatus | null) => void
}) {
  const { callback } = args
  return useAppStateStore.subscribe((state) => state.currentState, callback)
}
