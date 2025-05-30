import * as Notifications from "expo-notifications"
import { useEffect, useRef } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import {
  isConvosModifiedNotification,
  isNotificationExpoNewMessageNotification,
} from "@/features/notifications/notifications-assertions"
import { addConversationNotificationMessageFromStorageInOurCache } from "@/features/notifications/notifications-storage"
import { useNotificationsStore } from "@/features/notifications/notifications.store"
import { getXmtpConversationIdFromXmtpTopic } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { navigate } from "@/navigation/navigation.utils"
import { useAppStore } from "@/stores/app.store"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { waitUntilPromise } from "@/utils/wait-until-promise"
import { getNotificationId } from "./notification.model"

export function useNotificationListeners() {
  const foregroundNotificationListenerRef = useRef<Notifications.Subscription>()
  const notificationTapListenerRef = useRef<Notifications.Subscription>()
  // const systemDropListener = useRef<Notifications.Subscription>()

  useEffect(() => {
    // Check if app was launched by tapping a notification while killed
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const lastHandledNotificationId = useNotificationsStore.getState().lastHandledNotificationId
        if (lastHandledNotificationId !== getNotificationId(response.notification)) {
          notificationsLogger.debug(
            `Handling last notification ${getNotificationId(response.notification)}`,
          )
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
        notificationsLogger.debug(
          `Handling tap notification ${getNotificationId(response.notification)}`,
        )
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
      .actions.setLastHandledNotificationId(getNotificationId(tappedNotification))

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
      notificationsLogger.debug(
        `Handling Expo new message notification ${getNotificationId(tappedNotification)}`,
      )

      const tappedConversationTopic = tappedNotification.request.content.data.contentTopic
      const tappedXmtpConversationId = getXmtpConversationIdFromXmtpTopic(tappedConversationTopic)

      await addConversationNotificationMessageFromStorageInOurCache({
        conversationId: tappedXmtpConversationId,
      }).catch(captureError)

      // To make sure we don't navigate to a conversation that doesn't exist.
      // Happens because our notifications unsubscribing logic is not perfect.
      // await ensureConversationQueryData({
      //   clientInboxId: getSafeCurrentSender().inboxId,
      //   xmtpConversationId: tappedXmtpConversationId,
      //   caller: "useNotificationListeners",
      // })

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
