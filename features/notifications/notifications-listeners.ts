import * as Notifications from "expo-notifications"
import { useEffect, useRef } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ensureConversationQueryData } from "@/features/conversation/queries/conversation.query"
import {
  isConvosModifiedNotification,
  isNotificationExpoNewMessageNotification,
} from "@/features/notifications/notifications-assertions"
import {
  addNotificationsToConversationCacheData,
  getNotificationsForConversation,
} from "@/features/notifications/notifications.service"
import { useNotificationsStore } from "@/features/notifications/notifications.store"
import { getXmtpConversationIdFromXmtpTopic } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { navigate } from "@/navigation/navigation.utils"
import { useAppStore } from "@/stores/app.store"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { measureTimeAsync } from "@/utils/perf/perf-timer"
import { waitUntilPromise } from "@/utils/wait-until-promise"

export function useNotificationListeners() {
  const foregroundNotificationListenerRef = useRef<Notifications.Subscription>()
  const notificationTapListenerRef = useRef<Notifications.Subscription>()
  // const systemDropListener = useRef<Notifications.Subscription>()

  // Check if app was launched by tapping a notification while killed

  useEffect(() => {
    // Check if app was launched by tapping a notification while killed
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const lastHandledNotificationId = useNotificationsStore.getState().lastHandledNotificationId
        if (lastHandledNotificationId !== response.notification.request.identifier) {
          notificationsLogger.debug(`Handling last notification:`, response)
          handleNotification(response).catch(captureError)
        }
      }
    })

    foregroundNotificationListenerRef.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        // Doing nothing here because we already handle in notifications-init.ts
        // notificationsLogger.debug(`Handling foreground notification:`, notification)
      },
    )

    // Listen for notification taps while app is running
    notificationTapListenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        notificationsLogger.debug(`Handling notification tap...`)
        handleNotification(response).catch(captureError)
      },
    )

    // // Listen for when system drops notifications
    // Causing an error on iOS
    // systemDropListener.current = Notifications.addNotificationsDroppedListener(() => {
    //   notificationsLogger.debug(
    //     "[useNotificationListenersWhileRunning] System dropped notifications due to limits",
    //   )
    //   onSystemDroppedNotifications?.()
    // })

    // Cleanup subscriptions on unmount
    return () => {
      if (foregroundNotificationListenerRef.current) {
        Notifications.removeNotificationSubscription(foregroundNotificationListenerRef.current)
      }

      if (notificationTapListenerRef.current) {
        Notifications.removeNotificationSubscription(notificationTapListenerRef.current)
      }

      // if (systemDropListener.current) {
      //   Notifications.removeNotificationSubscription(systemDropListener.current)
      // }
    }
  }, [])
}

async function handleNotification(response: Notifications.NotificationResponse) {
  try {
    const tappedNotification = response.notification

    useNotificationsStore
      .getState()
      .actions.setLastHandledNotificationId(tappedNotification.request.identifier)

    // Sometimes we tap on a notification while the app is killed and this is triggered
    // before we finished hydrating auth so we push to a screen that isn't in the navigator yet
    await waitUntilPromise({
      checkFn: () => {
        return useAuthenticationStore.getState().status === "signedIn"
      },
    })

    // Because we had sometimes where we added a message to the cache but then it was overwritten
    // by the query client so we need to wait until the query client is hydrated
    await waitUntilPromise({
      checkFn: () => {
        return useAppStore.getState().reactQueryIsHydrated
      },
    })

    if (isConvosModifiedNotification(tappedNotification)) {
      notificationsLogger.debug(`Handling Convos modified notification...`)
      return navigate("Conversation", {
        xmtpConversationId: tappedNotification.request.content.data.message.xmtpConversationId,
      })
    }

    if (isNotificationExpoNewMessageNotification(tappedNotification)) {
      notificationsLogger.debug(`Handling Expo new message notification...`)

      const tappedConversationTopic = tappedNotification.request.content.data.contentTopic
      const tappedXmtpConversationId = getXmtpConversationIdFromXmtpTopic(tappedConversationTopic)

      // Also get all notifications in the tray to decrypt so that when you arrive in the conversation you see messages instantly
      const { result: presentedNotifications, durationMs } = await measureTimeAsync(() =>
        Notifications.getPresentedNotificationsAsync(),
      )

      notificationsLogger.debug(
        `Found ${presentedNotifications.length} notifications present in tray in ${durationMs}ms`,
      )

      const notifications = getNotificationsForConversation({
        conversationId: tappedXmtpConversationId,
        notifications: presentedNotifications,
      })

      // Waiting for this might delay the navigation to the conversation.
      // But it's still better UX and anyway soon we will have notification messages in the local storage
      // so it will be instant.
      await addNotificationsToConversationCacheData({
        notifications: [
          // Otherwise it's not found in the tray because we tapped on it!
          tappedNotification,
          ...notifications,
        ],
        clientInboxId: getSafeCurrentSender().inboxId,
      })

      // To make sure we don't navigate to a conversation that doesn't exist.
      // Happens because our notifications unsubscribing logic is not perfect.
      await ensureConversationQueryData({
        clientInboxId: getSafeCurrentSender().inboxId,
        xmtpConversationId: tappedXmtpConversationId,
        caller: "useNotificationListeners",
      })

      return navigate("Conversation", {
        xmtpConversationId: tappedXmtpConversationId,
      })
    }

    throw new Error(`Unknown notification type: ${JSON.stringify(tappedNotification)}`)
  } catch (error) {
    captureError(
      new NotificationError({
        error,
        additionalMessage: "Error handling notification tap",
      }),
    )
  }
}
