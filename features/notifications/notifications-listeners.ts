import * as Notifications from "expo-notifications"
import { useCallback, useEffect, useRef } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import {
  isConvosModifiedNotification,
  isNotificationExpoNewMessageNotification,
} from "@/features/notifications/notifications-assertions"
import { useNotificationsStore } from "@/features/notifications/notifications.store"
import { getXmtpConversationIdFromXmtpTopic } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { navigate } from "@/navigation/navigation.utils"
import { useAppStore } from "@/stores/app-store"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { waitUntilPromise } from "@/utils/wait-until-promise"

export function useNotificationListeners() {
  const foregroundNotificationListener = useRef<Notifications.Subscription>()
  const notificationTapListener = useRef<Notifications.Subscription>()
  // const systemDropListener = useRef<Notifications.Subscription>()

  const handleNotificationTap = useCallback(
    async (response: Notifications.NotificationResponse) => {
      try {
        const tappedNotification = response.notification

        useNotificationsStore
          .getState()
          .actions.setLastTappedNotificationId(tappedNotification.request.identifier)

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
          notificationsLogger.debug(
            `Convos modified notification tapped: ${JSON.stringify(tappedNotification)}`,
          )
          return navigate("Conversation", {
            xmtpConversationId: tappedNotification.request.content.data.message.xmtpConversationId,
          })
        }

        if (isNotificationExpoNewMessageNotification(tappedNotification)) {
          notificationsLogger.debug(
            `Expo notification tapped: ${JSON.stringify(tappedNotification)}`,
          )

          // Get all presented notifications
          // const presentedNotifications = await Notifications.getPresentedNotificationsAsync()
          // const clientInboxId = getSafeCurrentSender().inboxId

          // notificationsLogger.debug(
          //   `Found ${presentedNotifications.length} notifications present in tray to analyze`,
          //   JSON.stringify(presentedNotifications),
          // )

          // const tappedNotificationConversationId = getXmtpConversationIdFromXmtpTopic(
          //   tappedNotification.request.content.data.contentTopic,
          // )

          // Take all the notifications present in tray and add their message in the cache
          // This is temporary until we have our ios NSE that will handle this
          // Don't await, we want to do this in the background
          // Finally not sure because it might clog the bridge
          // And also the UX isn't nice because we're seeing messages appear not all at once
          // Promise.all(
          //   presentedNotifications
          //     .filter((notification) => {
          //       // Just the one related to the same conversation as the tapped notification
          //       if (isNotificationExpoNewMessageNotification(notification)) {
          //         return (
          //           tappedNotificationConversationId ===
          //           getXmtpConversationIdFromXmtpTopic(
          //             notification.request.content.data.contentTopic,
          //           )
          //         )
          //       }

          //       return false
          //     })
          //     .sort((a, b) => b.request.content.data.timestamp - a.request.content.data.timestamp)
          //     .slice(0, 5) // Too many can cause problem on the bridge
          //     .map(async (notification) => {
          //       try {
          //         const conversationTopic = notification.request.content.data.contentTopic
          //         const xmtpConversationId = getXmtpConversationIdFromXmtpTopic(conversationTopic)
          //         await getDecryptedMessageAndAddToCache({
          //           encryptedMessage: notification.request.content.data.encryptedMessage,
          //           xmtpConversationId,
          //           clientInboxId,
          //         })
          //       } catch (error) {
          //         // Capture errors for individual messages but don't block the process
          //         captureError(
          //           new NotificationError({
          //             error,
          //             additionalMessage: `Failed to decrypt/cache message from presented notification: ${notification.request.identifier}`,
          //           }),
          //         )
          //       }
          //     }),
          // ).catch(captureError)

          const tappedConversationTopic = tappedNotification.request.content.data.contentTopic
          const tappedXmtpConversationId =
            getXmtpConversationIdFromXmtpTopic(tappedConversationTopic)
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
    },
    [],
  )

  // Check if app was launched by tapping a notification while killed

  useEffect(() => {
    // Check if app was launched by tapping a notification while killed
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationTap(response).catch(captureError)
      }
    })

    // Listen for notifications while app is in foreground
    foregroundNotificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        // notificationsLogger.debug(`Handling foreground notification:`, notification)
      },
    )

    // Listen for notification taps while app is running
    notificationTapListener.current =
      Notifications.addNotificationResponseReceivedListener(handleNotificationTap)

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
  }, [handleNotificationTap])
}

// async function getDecryptedMessageAndAddToCache(args: {
//   encryptedMessage: string
//   xmtpConversationId: IXmtpConversationId
//   clientInboxId: IXmtpInboxId
// }) {
//   const { encryptedMessage, xmtpConversationId, clientInboxId } = args

//   const xmtpDecryptedMessage = await decryptXmtpMessage({
//     encryptedMessage,
//     xmtpConversationId,
//     clientInboxId,
//   })

//   if (!isSupportedXmtpMessage(xmtpDecryptedMessage)) {
//     return
//   }

//   const convoMessage = convertXmtpMessageToConvosMessage(xmtpDecryptedMessage)

//   setConversationMessageQueryData({
//     clientInboxId: args.clientInboxId,
//     xmtpMessageId: convoMessage.xmtpId,
//     xmtpConversationId,
//     message: convoMessage,
//   })
//   addMessageToConversationMessagesInfiniteQueryData({
//     clientInboxId: getSafeCurrentSender().inboxId,
//     xmtpConversationId,
//     messageId: convoMessage.xmtpId,
//   })

//   return convoMessage
// }
