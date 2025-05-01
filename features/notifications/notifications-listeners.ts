import * as Notifications from "expo-notifications"
import { useCallback, useEffect, useRef } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { setConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { convertXmtpMessageToConvosMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/convert-xmtp-message-to-convos-message"
import { addMessageToConversationMessagesInfiniteQueryData } from "@/features/conversation/conversation-chat/conversation-messages.query"
import {
  isConvosModifiedNotification,
  isNotificationExpoNewMessageNotification,
} from "@/features/notifications/notification-assertions"
import { getXmtpConversationIdFromXmtpTopic } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { decryptXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { isSupportedXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages-supported"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { navigate } from "@/navigation/navigation.utils"
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

        if (isNotificationExpoNewMessageNotification(response.notification)) {
          // Add the message in our cache.
          // Only here because for convos modified notifications, we already add the message to the cache
          const conversationTopic = response.notification.request.content.data.contentTopic
          const xmtpConversationId = getXmtpConversationIdFromXmtpTopic(conversationTopic)
          getDecryptedMessageAndAddToCache({
            encryptedMessage: response.notification.request.content.data.encryptedMessage,
            xmtpConversationId,
            clientInboxId: getSafeCurrentSender().inboxId,
          }).catch(captureError)

          return navigate("Conversation", {
            xmtpConversationId,
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

async function getDecryptedMessageAndAddToCache(args: {
  encryptedMessage: string
  xmtpConversationId: IXmtpConversationId
  clientInboxId: IXmtpInboxId
}) {
  const { encryptedMessage, xmtpConversationId, clientInboxId } = args

  const xmtpDecryptedMessage = await decryptXmtpMessage({
    encryptedMessage,
    xmtpConversationId,
    clientInboxId,
  })

  if (!isSupportedXmtpMessage(xmtpDecryptedMessage)) {
    return
  }

  const convoMessage = convertXmtpMessageToConvosMessage(xmtpDecryptedMessage)

  setConversationMessageQueryData({
    clientInboxId: args.clientInboxId,
    xmtpMessageId: convoMessage.xmtpId,
    message: convoMessage,
  })
  addMessageToConversationMessagesInfiniteQueryData({
    clientInboxId: getSafeCurrentSender().inboxId,
    xmtpConversationId,
    messageId: convoMessage.xmtpId,
  })

  return convoMessage
}
