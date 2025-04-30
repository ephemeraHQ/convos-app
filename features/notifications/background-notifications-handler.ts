import { useQuery } from "@tanstack/react-query"
import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import * as TaskManager from "expo-task-manager"
import { useEffect } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import {
  messageContentIsMultiRemoteAttachment,
  messageContentIsRemoteAttachment,
} from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { convertXmtpMessageToConvosMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/convert-xmtp-message-to-convos-message"
import { getMessageContentStringValue } from "@/features/conversation/conversation-list/hooks/use-message-content-string-value"
import { IConversationTopic } from "@/features/conversation/conversation.types"
import { getNotificationsPermissionsQueryConfig } from "@/features/notifications/notifications-permissions.query"
import { INotificationMessageDataConverted } from "@/features/notifications/notifications.types"
import { fetchProfile } from "@/features/profiles/profiles.api"
import {
  getXmtpConversation,
  getXmtpConversationIdFromXmtpTopic,
} from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { decryptXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { isSupportedXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages-supported"
import { usePrevious } from "@/hooks/use-previous-value"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { tryCatch } from "@/utils/try-catch"

const BACKGROUND_NOTIFICATION_TASK = "com.convos.background-notification"
// const PROCESSED_NOTIFICATIONS_KEY = "processed_notification_ids"
// const NOTIFICATION_ID_TTL = 1000 * 60 * 5 // 5 minutes in milliseconds
export const RECEIVED_NOTIFICATIONS_COUNT_KEY = "received_notifications_count"
export const DISPLAYED_NOTIFICATIONS_COUNT_KEY = "displayed_notifications_count"
const processedMessageIds = new Set<string>()

/**
 * Extracts the essential notification data (contentTopic and encryptedMessage)
 * from different notification formats.
 *
 * Handles the following notification formats:
 * 1. Standard Expo format with data.body.contentTopic
 * 2. XMTP format with UIApplicationLaunchOptionsRemoteNotificationKey
 * 3. XMTP format with topic/encryptedMessage at root level
 */
function extractNotificationData(
  data: any,
): { conversationTopic: IConversationTopic; encryptedMessage: string } | null {
  // Handle standard Expo format
  if (data?.body?.contentTopic && data?.body?.encryptedMessage) {
    notificationsLogger.debug("Detected standard Expo notification format")
    return {
      conversationTopic: data.body.contentTopic as IConversationTopic,
      encryptedMessage: data.body.encryptedMessage,
    }
  }

  // Handle XMTP format with UIApplicationLaunchOptionsRemoteNotificationKey
  if (
    data?.UIApplicationLaunchOptionsRemoteNotificationKey?.body?.contentTopic &&
    data?.UIApplicationLaunchOptionsRemoteNotificationKey?.body?.encryptedMessage
  ) {
    notificationsLogger.debug("Detected XMTP notification format with nested body")
    return {
      conversationTopic: data.UIApplicationLaunchOptionsRemoteNotificationKey.body
        .contentTopic as IConversationTopic,
      encryptedMessage: data.UIApplicationLaunchOptionsRemoteNotificationKey.body.encryptedMessage,
    }
  }

  // Handle possible format with direct UIApplicationLaunchOptionsRemoteNotificationKey properties
  if (
    data?.UIApplicationLaunchOptionsRemoteNotificationKey?.topic &&
    data?.UIApplicationLaunchOptionsRemoteNotificationKey?.encryptedMessage
  ) {
    notificationsLogger.debug("Detected XMTP notification format with direct properties")
    return {
      conversationTopic: data.UIApplicationLaunchOptionsRemoteNotificationKey
        .topic as IConversationTopic,
      encryptedMessage: data.UIApplicationLaunchOptionsRemoteNotificationKey.encryptedMessage,
    }
  }

  notificationsLogger.debug("No supported notification format detected")
  return null
}

// function incrementReceivedNotificationsCount(): void {
//   try {
//     const currentCount = storage.getNumber(RECEIVED_NOTIFICATIONS_COUNT_KEY) || 0
//     storage.set(RECEIVED_NOTIFICATIONS_COUNT_KEY, currentCount + 1)
//   } catch (error) {
//     notificationsLogger.error("Error incrementing received notifications count", error)
//   }
// }

// function incrementDisplayedNotificationsCount(): void {
//   try {
//     const currentCount = storage.getNumber(DISPLAYED_NOTIFICATIONS_COUNT_KEY) || 0
//     storage.set(DISPLAYED_NOTIFICATIONS_COUNT_KEY, currentCount + 1)
//   } catch (error) {
//     notificationsLogger.error("Error incrementing displayed notifications count", error)
//   }
// }

/**
 * Register a task to handle background notifications
 * This is what allows us to process notifications even when the app is closed
 */
async function registerBackgroundNotificationTask() {
  try {
    if (!Device.isDevice) {
      notificationsLogger.debug(
        "Skipping background notification task registration on simulator/emulator",
      )
      return
    }

    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK)) {
      notificationsLogger.debug("Background notification task already registered")
      return
    }

    notificationsLogger.debug("Registering background notification task...")
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK)
    notificationsLogger.debug("Background notification task registered successfully")
  } catch (error) {
    throw new NotificationError({
      error,
      additionalMessage: "Failed to register background notification task",
    })
  }
}

export async function unregisterBackgroundNotificationTask() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK)) {
      return TaskManager.unregisterTaskAsync(BACKGROUND_NOTIFICATION_TASK)
    }
  } catch (error) {
    captureError(
      new NotificationError({
        error,
        additionalMessage: "Failed to unregister background notification task",
      }),
    )
  }
}

export function useRegisterBackgroundNotificationTask() {
  const authStatus = useAuthenticationStore((state) => state.status)
  const { data: hasNotificationPermission } = useQuery({
    ...getNotificationsPermissionsQueryConfig(),
    select: (data) => data.status === "granted",
  })
  const previousNotificationPermission = usePrevious(hasNotificationPermission)

  useEffect(() => {
    // Only register if signed in and has notification permission
    if (authStatus === "signedIn" && hasNotificationPermission) {
      registerBackgroundNotificationTask().catch(captureError)
    }
  }, [authStatus, hasNotificationPermission])

  useEffect(() => {
    // Unregister if notification permission removed
    if (previousNotificationPermission && !hasNotificationPermission) {
      unregisterBackgroundNotificationTask()?.catch(captureError)
    }
  }, [hasNotificationPermission, previousNotificationPermission])
}

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  let notificationId: string | null = null

  try {
    if (error) {
      throw new NotificationError({
        error,
      })
    }

    if (!data) {
      throw new NotificationError({
        error: "No data received in background notification task",
      })
    }

    notificationsLogger.debug("Received background notification data", {
      data,
    })

    // Extract data from notification regardless of format
    const notificationData = extractNotificationData(data)

    // Skip if not in expected format
    if (!notificationData) {
      notificationsLogger.debug("Ignoring notification - not in expected format")
      return
    }

    const { conversationTopic, encryptedMessage } = notificationData

    notificationId = encryptedMessage

    // Increment received notifications counter
    // incrementReceivedNotificationsCount()

    const xmtpConversationId = getXmtpConversationIdFromXmtpTopic(conversationTopic)

    const clientInboxId = getSafeCurrentSender().inboxId

    notificationsLogger.debug("Fetching conversation and decrypting message...")
    const [conversation, xmtpDecryptedMessage] = await Promise.all([
      getXmtpConversation({
        clientInboxId,
        conversationId: xmtpConversationId,
      }),
      // ensureConversationQueryData({
      //   clientInboxId,
      //   xmtpConversationId,
      //   caller: "notifications-foreground-handler",
      // }),
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
      notificationsLogger.debug(
        `Skipping notification because message is not supported`,
        xmtpDecryptedMessage,
      )
      return
    }

    const convoMessage = convertXmtpMessageToConvosMessage(xmtpDecryptedMessage)

    notificationsLogger.debug("Fetching message content and sender info...")
    const [
      { data: messageContentString, error: messageContentError },
      { data: profile, error: profileError },
    ] = await Promise.all([
      // ensureMessageContentStringValue(convoMessage),
      tryCatch(
        Promise.resolve(
          getMessageContentStringValue({
            messageContent: convoMessage.content,
          }),
        ),
      ),
      tryCatch(
        fetchProfile({
          xmtpId: convoMessage.senderInboxId,
        }),
      ),
      // ensurePreferredDisplayInfo({
      //   inboxId: convoMessage.senderInboxId,
      // }),
    ])

    if (messageContentError) {
      captureError(
        new NotificationError({
          error: messageContentError,
          additionalMessage: "Error fetching message content",
        }),
      )
    }

    if (profileError) {
      captureError(
        new NotificationError({
          error: profileError,
          additionalMessage: "Error fetching profile",
        }),
      )
    }

    const senderDisplayName = profile?.name || "New message"

    notificationsLogger.debug("Message content:", messageContentString)
    notificationsLogger.debug("Sender display name:", senderDisplayName)

    // setConversationMessageQueryData({
    //   clientInboxId,
    //   xmtpMessageId: xmtpDecryptedMessage.id,
    //   message: convoMessage,
    // })

    // addMessageToConversationMessagesInfiniteQueryData({
    //   clientInboxId,
    //   xmtpConversationId,
    //   messageId: xmtpDecryptedMessage.id,
    // })

    // if (useAppStateStore.getState().currentState === "active") {
    //   notificationsLogger.debug("Skipping showing notification because app is active")
    //   return
    // }

    if (processedMessageIds.has(notificationId)) {
      notificationsLogger.debug("Skipping already processed message", { encryptedMessage })
      return
    }

    processedMessageIds.add(notificationId)

    notificationsLogger.debug("Displaying local notification...")
    await Notifications.scheduleNotificationAsync({
      content: {
        title: senderDisplayName,
        body: messageContentString,
        data: {
          message: convoMessage,
          isProcessedByConvo: true,
        } satisfies INotificationMessageDataConverted,
        ...(messageContentIsRemoteAttachment(convoMessage.content)
          ? {
              attachments: [
                {
                  identifier: convoMessage.content.url,
                  type: "image",
                  url: convoMessage.content.url,
                },
              ],
            }
          : messageContentIsMultiRemoteAttachment(convoMessage.content)
            ? {
                attachments: convoMessage.content.attachments.map((attachment) => ({
                  identifier: attachment.url,
                  type: "image",
                  url: attachment.url,
                })),
              }
            : {}),
      },
      trigger: null,
    })

    notificationsLogger.debug("Local notification displayed")

    // If we reached here, the notification was displayed successfully
    // If we reached here, the notification was displayed successfully
    // incrementDisplayedNotificationsCount()
  } catch (error) {
    captureError(
      new NotificationError({
        error,
        additionalMessage: "Error in background notification task",
        extra: {
          backgroundNotificationData: JSON.stringify(data || {}),
        },
      }),
    )
  }
})
