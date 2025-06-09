import { focusManager as reactQueryFocusManager } from "@tanstack/react-query"
import { useEffect } from "react"
import { AppState, AppStateStatus, NativeEventSubscription } from "react-native"
import { getAllSenders, getCurrentSender } from "@/features/authentication/multi-inbox.store"
import { invalidateAllowedConsentConversationsQuery } from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
import { invalidateUnknownConsentConversationsQuery } from "@/features/conversation/conversation-requests-list/conversations-unknown-consent.query"
import { fetchOrRefetchNotificationsPermissions } from "@/features/notifications/notifications-permissions.query"
import { registerPushNotifications } from "@/features/notifications/notifications-register"
import { startStreaming, stopStreaming } from "@/features/streams/streams"
import { dropXmtpClient, getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { useAppStateStore } from "@/stores/app-state-store/app-state.store"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { appStateLogger } from "@/utils/logger/logger"

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
    const unsubscribe = useAppStateStore.subscribe(
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

    return () => unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, onForeground, onBackground, onInactive, ...deps])
}

export const waitUntilAppActive = async () => {
  // If app is active, return immediately
  if (useAppStateStore.getState().currentState === "active") {
    return
  }

  appStateLogger.debug(`Waiting until app is back into active state...`)

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
let appStateListener: NativeEventSubscription | undefined
let memoryWarningListener: NativeEventSubscription | undefined

export function startListeningToAppStateStore() {
  if (unsubscribedFromAppStateStore) {
    unsubscribedFromAppStateStore()
  }

  if (appStateListener) {
    appStateListener.remove()
    appStateListener = undefined
  }

  if (memoryWarningListener) {
    memoryWarningListener.remove()
    memoryWarningListener = undefined
  }

  unsubscribedFromAppStateStore = useAppStateStore.subscribe(
    (state) => state.currentState,
    async (currentState) => {
      try {
        // Use the store's actual previousState because with "fireImmediately" it's the same as the current state!
        const storePreviousState = useAppStateStore.getState().previousState

        appStateLogger.debug(`App state changed from '${storePreviousState}' to '${currentState}'`)

        const isOpenFromClosed = currentState === "active" && storePreviousState === null
        const isOpenFromBackground =
          currentState === "active" && storePreviousState === "background"
        const isGoingToBackground =
          currentState === "background" && storePreviousState === "inactive"
        const isGoingToInactive = currentState === "inactive" && storePreviousState === "active"

        if (isOpenFromClosed) {
          appStateLogger.debug("App is open from closed")
        } else if (isOpenFromBackground) {
          appStateLogger.debug("App is open from background")
        } else if (isGoingToBackground) {
          appStateLogger.debug("App is going to background")
        } else if (isGoingToInactive) {
          appStateLogger.debug("App is going to inactive")
        } else {
          appStateLogger.warn("No state change detected this might be a bug")
        }

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

            // Invalidating each conversation metadata can be heavy if you have many conversations
            // so for now only do it if there are other installations
            // so that both of your devices conversations metadata are in sync
            // const allowedConsentConversations = await ensureAllowedConsentConversationsQueryData({
            //   clientInboxId: currentSender.inboxId,
            //   caller: "appStateStoreHandler",
            // })

            // if (allowedConsentConversations) {
            //   getXmtpClientOtherInstallations({
            //     clientInboxId: currentSender.inboxId,
            //   })
            //     .then((otherInstallations) => {
            //       if (otherInstallations.length > 0) {
            //         for (const conversationId of allowedConsentConversations) {
            //           invalidateConversationMetadataQuery({
            //             clientInboxId: currentSender.inboxId,
            //             xmtpConversationId: conversationId,
            //           }).catch(captureError)
            //         }
            //       }
            //     })
            //     .catch(captureError)
            // }
          }
        }

        if (isGoingToBackground) {
          // Stop XMTP streaming
          stopStreaming(senders.map((sender) => sender.inboxId)).catch(captureError)

          // Drop all XMTP clients
          for (const sender of senders) {
            dropXmtpClient({
              xmtpClient: await getXmtpClientByInboxId({ inboxId: sender.inboxId }),
              ethAddress: sender.ethereumAddress,
            }).catch(captureError)
          }

          // Try this logic later
          // useXmtpActivityStore.getState().actions.cancelAllActiveOperations(
          //   new ExternalCancellationError({
          //     error: new Error("App state changed to inactive or background"),
          //   }),
          // )
        }
      } catch (error) {
        captureError(
          new GenericError({
            error,
            additionalMessage: "Error in app state store handler",
          }),
        )
      }
    },
    {
      fireImmediately: true,
    },
  )

  memoryWarningListener = AppState.addEventListener("memoryWarning", () => {
    appStateLogger.warn("Memory warning received")
  })

  // Update the store when the app state changes
  appStateListener = AppState.addEventListener("change", (nextAppState) => {
    appStateLogger.debug(`App state changed to '${nextAppState}'`)
    useAppStateStore.getState().actions.handleAppStateChange(nextAppState)
  })
}
