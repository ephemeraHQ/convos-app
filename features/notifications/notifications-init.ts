import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { getCurrentSender } from "@/features/authentication/multi-inbox.store"
import { setConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import {
  messageContentIsMultiRemoteAttachment,
  messageContentIsRemoteAttachment,
} from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { convertXmtpMessageToConvosMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/convert-xmtp-message-to-convos-message"
import { addMessageToConversationMessagesInfiniteQueryData } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { ensureMessageContentStringValue } from "@/features/conversation/conversation-list/hooks/use-message-content-string-value"
import { IConversationTopic } from "@/features/conversation/conversation.types"
import { ensureConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { isNotificationExpoNewMessageNotification } from "@/features/notifications/notification-assertions"
import { INotificationMessageDataConverted } from "@/features/notifications/notifications.types"
import { ensurePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { getXmtpConversationIdFromXmtpTopic } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { decryptXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { isSupportedXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages-supported"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"

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

const processedNotificationIds = new Set<string>()

async function handleNotification(notification: Notifications.Notification) {
  try {
    const notificationId = notification.request.identifier

    // Check if we've already processed this specific notification
    if (processedNotificationIds.has(notificationId)) {
      notificationsLogger.debug(`Skipping already processed notification: ${notificationId}`)
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }
    }

    // Mark this notification as processed
    processedNotificationIds.add(notificationId)

    // Limit the size of the Set to prevent memory leaks
    if (processedNotificationIds.size > 10) {
      const iterator = processedNotificationIds.values()
      const valueToDelete = iterator.next().value
      if (valueToDelete) {
        processedNotificationIds.delete(valueToDelete)
      }
    }

    // If we processed the notification we can now display it!
    if (notification.request.content.data?.isProcessedByConvo) {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }
    }

    if (isNotificationExpoNewMessageNotification(notification)) {
      await maybeDisplayLocalNewMessageNotification({
        encryptedMessage: notification.request.content.data.idempotencyKey,
        conversationTopic: notification.request.content.data.contentTopic,
      })

      // Prevent the original notification from showing
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
  } catch (error) {
    captureError(
      new NotificationError({
        error,
      }),
    )
  }

  // Let's always show the notification anyway
  return {
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }
}

async function maybeDisplayLocalNewMessageNotification(args: {
  encryptedMessage: string
  conversationTopic: IConversationTopic
}) {
  const { encryptedMessage, conversationTopic } = args

  const xmtpConversationId = getXmtpConversationIdFromXmtpTopic(conversationTopic)

  const currentSender = getCurrentSender()

  if (!currentSender) {
    throw new NotificationError({
      error: "No current sender found in background notification task",
    })
  }

  const clientInboxId = currentSender.inboxId

  notificationsLogger.debug("Fetching conversation and decrypting message...")
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
  notificationsLogger.debug("Fetched conversation and decrypted message")

  if (!conversation) {
    throw new NotificationError({
      error: `Conversation (${xmtpConversationId}) not found in background notification task`,
    })
  }

  if (!isSupportedXmtpMessage(xmtpDecryptedMessage)) {
    notificationsLogger.debug(
      `Skipping notification because message is not supported`,
      xmtpDecryptedMessage,
    )
    return
  }

  const convoMessage = convertXmtpMessageToConvosMessage(xmtpDecryptedMessage)

  notificationsLogger.debug("Fetching message content and sender info...")
  const [messageContent, senderInfo] = await Promise.all([
    ensureMessageContentStringValue(convoMessage),
    ensurePreferredDisplayInfo({
      inboxId: convoMessage.senderInboxId,
    }),
  ])
  notificationsLogger.debug("Fetched message content and sender info")

  // Add to local cache
  setConversationMessageQueryData({
    clientInboxId,
    xmtpMessageId: xmtpDecryptedMessage.id,
    message: convoMessage,
  })
  addMessageToConversationMessagesInfiniteQueryData({
    clientInboxId,
    xmtpConversationId,
    messageId: xmtpDecryptedMessage.id,
  })

  await Notifications.scheduleNotificationAsync({
    content: {
      title: senderInfo.displayName,
      body: messageContent,
      data: {
        message: convoMessage,
        isProcessedByConvo: true,
      } satisfies INotificationMessageDataConverted,
      // Add attachments if the message has them
      ...(messageContentIsRemoteAttachment(convoMessage.content) && {
        attachments: [
          {
            identifier: convoMessage.content.url,
            type: "image",
            url: convoMessage.content.url,
          },
        ],
      }),
      // Add attachments if the message has them
      ...(messageContentIsMultiRemoteAttachment(convoMessage.content) && {
        attachments: convoMessage.content.attachments.map((attachment) => ({
          identifier: attachment.url,
          type: "image",
          url: attachment.url,
        })),
      }),
    },
    trigger: null,
  })
}
