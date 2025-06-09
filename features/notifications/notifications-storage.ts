import { MessageDeliveryStatus } from "@xmtp/react-native-sdk"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import {
  ensureConversationMessageQueryData,
  setConversationMessageQueryData,
} from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { convertXmtpMessageToConvosMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/convert-xmtp-message-to-convos-message"
import { addConversationMessage } from "@/features/conversation/conversation-chat/conversation-messages-simple.query"
import {
  isSupportedXmtpContentType,
  isXmtpMessage,
  isXmtpTextContentType,
} from "@/features/xmtp/xmtp-codecs/xmtp-codecs"
import { getXmtpConversationTopicFromXmtpId } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { IXmtpConversationId, IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { measureTimeAsync } from "@/utils/perf/perf-timer"
import { customPromiseAllSettled } from "@/utils/promise-all-settled"
import { notificationExtensionSharedDataStorage } from "@/utils/storage/storages"

// Update the type to match what we're now storing from Swift
type INotificationMessage = {
  id: IXmtpMessageId
  content: any // Assume any for now since XMTP ios SDK maybe doesn't have content the same way the RN SDK does
  contentType: string
  sentAtNs: number
  senderInboxId: IXmtpInboxId
}

// IF YOU CHANGE THIS KEY, YOU MUST CHANGE THE KEY IN THE IOS NOTIFICATION EXTENSION TOO
const notificationMessageStoragePrefixKey = "conversation_messages"
const notificationMessageStorage = {
  getValue: (conversationId: IXmtpConversationId) => {
    const key = `${notificationMessageStoragePrefixKey}_${conversationId}`

    const serializedMessages = notificationExtensionSharedDataStorage.getString(key)

    if (!serializedMessages) {
      return null
    }

    try {
      return JSON.parse(serializedMessages) as INotificationMessage[]
    } catch (error) {
      throw new NotificationError({
        error,
        additionalMessage: `Failed to parse notification stored messages for conversationId ${conversationId}`,
      })
    }
  },
  setValue: (conversationId: IXmtpConversationId, value: INotificationMessage[]) => {
    return notificationExtensionSharedDataStorage.set(
      `${notificationMessageStoragePrefixKey}_${conversationId}`,
      JSON.stringify(value),
    )
  },
  deleteValue: (conversationId: IXmtpConversationId) => {
    return notificationExtensionSharedDataStorage.delete(
      `${notificationMessageStoragePrefixKey}_${conversationId}`,
    )
  },
}

export async function addConversationNotificationMessageFromStorageInOurCache(args: {
  conversationId: IXmtpConversationId
}) {
  try {
    const { conversationId } = args

    const currentSender = getSafeCurrentSender()

    const messages = notificationMessageStorage.getValue(conversationId)

    if (!messages) {
      return
    }

    notificationsLogger.debug(
      `Found ${messages.length} messages in storage for conversationId ${conversationId}`,
    )

    // Delete the messages from storage so we don't add them again
    notificationMessageStorage.deleteValue(conversationId)

    const recognizedMessages: IXmtpMessageId[] = []
    const unknownMessages: INotificationMessage[] = []

    // Separate recognized vs unknown messages
    for (const message of messages) {
      // TMP fix because ios NSE put text message content directly in content
      if (isXmtpTextContentType(message.contentType) && !message.content.text) {
        message.content = {
          text: message.content,
        }
      }

      if (
        !isSupportedXmtpContentType(message.contentType) ||
        !isXmtpMessage({
          contentTypeId: message.contentType,
          nativeContent: message.content,
        })
      ) {
        unknownMessages.push(message)
        captureError(
          new NotificationError({
            error: new Error(
              `Unknown xmtp message from storage JSON string: ${JSON.stringify(message)}`,
            ),
          }),
        )
        continue
      }

      // Store the quick message in cache immediately
      setConversationMessageQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpMessageId: message.id,
        xmtpConversationId: conversationId,
        message: convertXmtpMessageToConvosMessage({
          id: message.id,
          nativeContent: message.content,
          contentTypeId: message.contentType,
          senderInboxId: message.senderInboxId,
          sentNs: message.sentAtNs,
          topic: getXmtpConversationTopicFromXmtpId(conversationId),
          deliveryStatus: MessageDeliveryStatus.PUBLISHED,
          fallback: "",
          content: () => message.content,
          childMessages: [],
        }),
      })
      recognizedMessages.push(message.id)
    }

    // Add recognized messages to infinite query immediately for fast display
    if (recognizedMessages.length > 0) {
      for (const messageId of recognizedMessages) {
        addConversationMessage({
          clientInboxId: currentSender.inboxId,
          xmtpConversationId: conversationId,
          messageId,
          caller: "addConversationNotificationMessageFromStorageInOurCache",
        })
      }

      notificationsLogger.debug(
        `Immediately added ${recognizedMessages.length} recognized messages to cache`,
      )
    }

    // Handle unknown messages by fetching full data
    if (unknownMessages.length > 0) {
      notificationsLogger.debug(
        `Fetching full data for ${unknownMessages.length} unknown message types`,
      )

      const { result: results, durationMs: ensureMessagesDurationMs } = await measureTimeAsync(
        async () =>
          customPromiseAllSettled(
            unknownMessages.map(async (message) =>
              ensureConversationMessageQueryData({
                clientInboxId: currentSender.inboxId,
                xmtpConversationId: conversationId,
                xmtpMessageId: message.id,
                caller: "addConversationNotificationMessageFromStorageInOurCache-unknown",
              }),
            ),
          ),
      )

      notificationsLogger.debug(
        `Ensuring ${unknownMessages.length} unknown messages took ${ensureMessagesDurationMs}ms`,
      )

      // Capture errors
      results.forEach((result) => {
        if (result.status === "rejected") {
          captureError(
            new NotificationError({
              error: result.reason,
              additionalMessage: `Failed to add unknown message ${result.reason} to conversation cache data`,
            }),
          )
        }
      })

      // Add unknown messages to cache after fetching
      for (const message of unknownMessages) {
        addConversationMessage({
          clientInboxId: currentSender.inboxId,
          xmtpConversationId: conversationId,
          messageId: message.id,
          caller: "addConversationNotificationMessageFromStorageInOurCache-unknown",
        })
      }
    }
  } catch (error) {
    captureError(
      new NotificationError({
        error,
        additionalMessage:
          "Failed to add conversation notification message from storage in our cache",
      }),
    )
  }
}

// IF YOU CHANGE THIS KEY, YOU MUST CHANGE THE KEY IN THE IOS NOTIFICATION EXTENSION TOO
const notificationProfileDisplayNameStoragePrefixKey = "display_name"
const notificationProfileDisplayNameStorage = {
  getValue: (inboxId: string) => {
    const displayName = notificationExtensionSharedDataStorage.getString(
      `${notificationProfileDisplayNameStoragePrefixKey}_${inboxId}`,
    )
    return displayName || null
  },
  setValue: (inboxId: string, value: string) => {
    // Check if value is already the same to avoid unnecessary writes
    const currentValue = notificationProfileDisplayNameStorage.getValue(inboxId)
    if (currentValue === value) {
      return
    }

    notificationsLogger.debug(
      `Saving profile display name for notification extension for inboxId: ${inboxId} with value: ${value}`,
    )
    return notificationExtensionSharedDataStorage.set(
      `${notificationProfileDisplayNameStoragePrefixKey}_${inboxId}`,
      value,
    )
  },
  deleteValue: (inboxId: string) => {
    return notificationExtensionSharedDataStorage.delete(
      `${notificationProfileDisplayNameStoragePrefixKey}_${inboxId}`,
    )
  },
}

export function saveProfileDisplayNameForNotificationExtension(args: {
  inboxId: string
  displayName: string
}) {
  const { inboxId, displayName } = args

  notificationProfileDisplayNameStorage.setValue(inboxId, displayName)
}
