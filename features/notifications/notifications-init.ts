import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { getCurrentSender } from "@/features/authentication/multi-inbox.store"
import { setConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import {
  messageContentIsMultiRemoteAttachment,
  messageContentIsRemoteAttachment,
} from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { convertXmtpMessageToConvosMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/convert-xmtp-message-to-convos-message"
import { addMessagesToConversationMessagesInfiniteQueryData } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { ensureMessageContentStringValue } from "@/features/conversation/conversation-list/hooks/use-message-content-string-value"
import { IConversationTopic } from "@/features/conversation/conversation.types"
import { ensureConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { isNotificationExpoNewMessageNotification } from "@/features/notifications/notifications-assertions"
import { INotificationMessageConvertedData } from "@/features/notifications/notifications.types"
import { ensurePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { getXmtpConversationIdFromXmtpTopic } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { decryptXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { isSupportedXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages-supported"
import { useAppStateStore } from "@/stores/app-state-store/app-state.store"
import { captureError } from "@/utils/capture-error"
import { createDeduplicationManager } from "@/utils/deduplication"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { getNotificationId } from "./notification.model"

export function configureForegroundNotificationBehavior() {
  Notifications.setNotificationHandler({
    handleNotification,
    handleError: (error, notificationId) => {
      captureError(
        new NotificationError({
          error,
          additionalMessage: `Failed to display notification ${notificationId}`,
        }),
      )
    },
  })

  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
      enableVibrate: true,
    }).catch(captureError)
  }
}

const notificationDeduplicationManager = createDeduplicationManager({
  maxSize: 10,
  ttlMs: 10 * 60 * 1000, // 10 minutes
})

async function handleNotification(notification: Notifications.Notification) {
  try {
    const notificationId = getNotificationId(notification)

    const result = await notificationDeduplicationManager.executeOnce({
      id: notificationId,
      fn: async () => {
        // If we processed and decrypted the notification we can now display it!
        if (notification.request.content.data?.isProcessedByConvo) {
          return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }
        }

        if (isNotificationExpoNewMessageNotification(notification)) {
          await handlingNonDecryptedExpoNewMessageNotification({
            notificationId: getNotificationId(notification),
            encryptedMessage: notification.request.content.data.encryptedMessage,
            conversationTopic: notification.request.content.data.contentTopic,
          })
          // Prevent the original non-decrypted notification from showing
          return {
            shouldShowAlert: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }
        }

        captureError(
          new NotificationError({
            error: `Unknown notification: ${JSON.stringify(notification)}`,
          }),
        )

        // Let's always show the notification anyway
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }
      },
    })

    // If this was a duplicate, don't show it
    if (result === null) {
      notificationsLogger.debug(`Skipping duplicate notification: ${notificationId}`)
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }
    }

    return result
  } catch (error) {
    captureError(
      new NotificationError({
        error,
        additionalMessage: `Error handling notification: ${JSON.stringify(notification)}`,
      }),
    )

    // Let's always show the notification anyway
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }
  }
}

const messageProcessingDeduplicationManager = createDeduplicationManager({
  maxSize: 10,
  ttlMs: 5 * 60 * 1000, // 5 minutes
})

async function handlingNonDecryptedExpoNewMessageNotification(args: {
  notificationId: string
  encryptedMessage: string
  conversationTopic: IConversationTopic
}) {
  const { notificationId, encryptedMessage, conversationTopic } = args

  notificationsLogger.debug(
    `Handling non-decrypted expo new message notification ${notificationId}`,
  )

  try {
    await messageProcessingDeduplicationManager.executeOnce({
      id: notificationId,
      fn: async () => {
        const processedNotificationId = `processed_${notificationId}_${Date.now()}`

        const xmtpConversationId = getXmtpConversationIdFromXmtpTopic(conversationTopic)

        const currentSender = getCurrentSender()

        if (!currentSender) {
          throw new NotificationError({
            error: "No current sender found in handlingNonDecryptedExpoNewMessageNotification",
          })
        }

        const clientInboxId = currentSender.inboxId

        const [conversation, xmtpDecryptedMessage] = await Promise.all([
          ensureConversationQueryData({
            clientInboxId,
            xmtpConversationId,
            caller: "notifications-foreground-handler",
          }),
          decryptXmtpMessage({
            encryptedMessage,
            xmtpConversationId,
            clientInboxId,
          }),
        ])

        if (!conversation) {
          throw new NotificationError({
            error: `Conversation (${xmtpConversationId}) not found in background notification task`,
          })
        }

        if (!isSupportedXmtpMessage(xmtpDecryptedMessage)) {
          return
        }

        const convoMessage = convertXmtpMessageToConvosMessage(xmtpDecryptedMessage)

        const [messageContent, senderInfo] = await Promise.all([
          ensureMessageContentStringValue(convoMessage),
          ensurePreferredDisplayInfo({
            inboxId: convoMessage.senderInboxId,
            caller: "handleValidNotification",
          }),
        ])

        // Add to local cache
        setConversationMessageQueryData({
          clientInboxId,
          xmtpMessageId: convoMessage.xmtpId,
          xmtpConversationId,
          message: convoMessage,
        })
        addMessagesToConversationMessagesInfiniteQueryData({
          clientInboxId,
          xmtpConversationId,
          messageIds: [convoMessage.xmtpId],
        })

        // Don't show notifications when app is in foreground
        const appState = useAppStateStore.getState().currentState
        if (appState === "active") {
          return
        }

        await Notifications.scheduleNotificationAsync({
          identifier: processedNotificationId,
          content: {
            title: senderInfo.displayName,
            body: messageContent,
            data: {
              message: convoMessage,
              isProcessedByConvo: true,
            } satisfies INotificationMessageConvertedData,
            // Add attachments if the message has them
            ...(Platform.OS === "ios" &&
              messageContentIsRemoteAttachment(convoMessage.content) && {
                attachments: [
                  {
                    identifier: convoMessage.content.url,
                    type: "image",
                    url: convoMessage.content.url,
                  },
                ],
              }),
            // Add attachments if the message has them
            ...(Platform.OS === "ios" &&
              messageContentIsMultiRemoteAttachment(convoMessage.content) && {
                attachments: convoMessage.content.attachments.map((attachment) => ({
                  identifier: attachment.url,
                  type: "image",
                  url: attachment.url,
                })),
              }),
          },
          trigger: null,
        })
      },
    })
  } catch (error) {
    throw error
  }
}
