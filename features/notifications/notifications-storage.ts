import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ensureConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { addMessagesToConversationMessagesInfiniteQueryData } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { measureTimeAsync } from "@/utils/perf/perf-timer"
import { customPromiseAllSettled } from "@/utils/promise-all-settled"
import { notificationExtensionSharedDataStorage } from "@/utils/storage/storages"

// From NotificationService.swift we only pass the id for now
type INotificationMessage = {
  id: IXmtpMessageId
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
      notificationsLogger.debug(`No messages found in storage for conversation ${conversationId}`)
      return
    }

    // Delete the messages from storage so we don't add them again
    notificationMessageStorage.deleteValue(conversationId)

    notificationsLogger.debug(
      `Found ${messages.length} messages in storage for conversationId ${conversationId}`,
    )

    // Doing this so that when messages are added in the converastion they instantly show up and we're not waiting for them to load
    const { result: results, durationMs: ensureMessagesDurationMs } = await measureTimeAsync(
      async () =>
        customPromiseAllSettled(
          messages.map(async (message) =>
            ensureConversationMessageQueryData({
              clientInboxId: currentSender.inboxId,
              xmtpConversationId: conversationId,
              xmtpMessageId: message.id,
              caller: "addConversationNotificationMessageFromStorageInOurCache",
            }),
          ),
        ),
    )

    notificationsLogger.debug(
      `Ensuring ${messages.length} messages found in storage took ${ensureMessagesDurationMs}ms`,
    )

    // Capture errors
    results.forEach((result) => {
      if (result.status === "rejected") {
        captureError(
          new NotificationError({
            error: result.reason,
            additionalMessage: `Failed to add message ${result.reason} to conversation cache data`,
          }),
        )
      }
    })

    // Add to cache
    addMessagesToConversationMessagesInfiniteQueryData({
      clientInboxId: getSafeCurrentSender().inboxId,
      xmtpConversationId: conversationId,
      messageIds: messages.map((message) => message.id),
    })
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
