import * as Notifications from "expo-notifications"
import { useEffect, useRef } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { isConvosModifiedNotification } from "@/features/notifications/notification-assertions"
import { navigate } from "@/navigation/navigation.utils"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { waitUntilPromise } from "@/utils/wait-until-promise"

export function useNotificationListeners() {
  const foregroundNotificationListener = useRef<Notifications.Subscription>()
  const notificationTapListener = useRef<Notifications.Subscription>()
  // const systemDropListener = useRef<Notifications.Subscription>()

  useEffect(() => {
    // Listen for notifications while app is in foreground
    foregroundNotificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        // notificationsLogger.debug(`Handling foreground notification:`, notification)
      },
    )

    // Listen for notification taps while app is running
    notificationTapListener.current = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        try {
          notificationsLogger.debug(`Notification tapped: ${JSON.stringify(response)}`)

          // Sometimes we tap on a notification while the app is killed and this is triggered
          // before we finished hydrating auth so we push to a screen that isn't in the navigator yet
          await waitUntilPromise({
            checkFn: () => {
              return useAuthenticationStore.getState().status === "signedIn"
            },
          })

          if (isConvosModifiedNotification(response.notification)) {
            return navigate("Conversation", {
              xmtpConversationId:
                response.notification.request.content.data.message.xmtpConversationId,
            })
          }

          throw new Error(`Unknown notification type: ${JSON.stringify(response.notification)}`)
        } catch (error) {
          captureError(
            new NotificationError({
              error,
              additionalMessage: "Error handling notification tap",
            }),
          )
        }
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
      if (foregroundNotificationListener.current) {
        Notifications.removeNotificationSubscription(foregroundNotificationListener.current)
      }

      if (notificationTapListener.current) {
        Notifications.removeNotificationSubscription(notificationTapListener.current)
      }

      // if (systemDropListener.current) {
      //   Notifications.removeNotificationSubscription(systemDropListener.current)
      // }
    }
  }, [])
}
