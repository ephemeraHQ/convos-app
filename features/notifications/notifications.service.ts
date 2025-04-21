import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { config } from "@/config"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { setConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import {
  messageContentIsMultiRemoteAttachment,
  messageContentIsRemoteAttachment,
} from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { convertXmtpMessageToConvosMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/convert-xmtp-message-to-convos-message"
import { addMessageToConversationMessagesInfiniteQueryData } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { ensureConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { ensureCurrentUserQueryData } from "@/features/current-user/current-user.query"
import { updateDevice } from "@/features/devices/devices.api"
import { ensureUserDeviceQueryData } from "@/features/devices/user-device.query"
import { ensureNotificationsPermissions } from "@/features/notifications/notifications-permissions.query"
import { registerNotificationInstallation } from "@/features/notifications/notifications.api"
import { INotificationMessageDataConverted } from "@/features/notifications/notifications.types"
import { ensurePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { getXmtpConversationIdFromXmtpTopic } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { decryptXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { IXmtpConversationId, IXmtpConversationTopic } from "@/features/xmtp/xmtp.types"
import { useAppStateStore } from "@/stores/use-app-state-store"
import { NotificationError, UserCancelledError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { ensureMessageContentStringValue } from "../conversation/conversation-list/hooks/use-message-content-string-value"

export async function registerPushNotifications() {
  try {
    const result = await requestNotificationsPermissions()

    if (!result.granted) {
      throw new UserCancelledError({ error: "Notifications permissions not granted" })
    }

    const currentUser = await ensureCurrentUserQueryData({ caller: "registerPushNotifications" })

    if (!currentUser) {
      throw new NotificationError({
        error: "No current user found to register push notifications",
      })
    }

    const currentDevice = await ensureUserDeviceQueryData({
      userId: currentUser.id,
    })

    if (!currentDevice) {
      throw new NotificationError({
        error: "No current device found to register push notifications",
      })
    }

    const [deviceToken, expoToken] = await Promise.all([
      getDevicePushNotificationsToken(),
      getExpoPushNotificationsToken(),
    ])

    await updateDevice({
      userId: currentUser.id,
      deviceId: currentDevice.id,
      updates: {
        expoToken,
        pushToken: deviceToken,
      },
    })

    const currentSender = getSafeCurrentSender()
    const client = await getXmtpClientByInboxId({
      inboxId: currentSender.inboxId,
    })

    await registerNotificationInstallation({
      installationId: client.installationId,
      deliveryMechanism: {
        deliveryMechanismType: {
          case: "apnsDeviceToken",
          value: deviceToken,
        },
      },
    })
  } catch (error) {
    // Catch any error from the steps above and wrap it
    throw new NotificationError({
      error,
      additionalMessage: "Failed to register push notifications",
    })
  }
}

export async function getExpoPushNotificationsToken() {
  try {
    if (!Device.isDevice) {
      throw new Error("Must use physical device for push notifications")
    }

    const data = await Notifications.getExpoPushTokenAsync({
      projectId: config.expo.projectId,
    })

    const expoToken = data.data as string

    if (__DEV__) {
      notificationsLogger.debug("Expo token:", expoToken)
    }

    return expoToken
  } catch (error) {
    throw new NotificationError({
      error,
      additionalMessage: "Failed to get Expo push token",
    })
  }
}

export async function getDevicePushNotificationsToken() {
  try {
    if (!Device.isDevice) {
      throw new Error("Must use physical")
    }

    let token

    const data = await Notifications.getDevicePushTokenAsync()

    // data.data is string for native platforms per DevicePushToken type
    // https://docs.expo.dev/versions/latest/sdk/notifications/#devicepushtoken
    token = data.data as string

    if (__DEV__) {
      notificationsLogger.debug("Device token:", token)
    }

    return token
  } catch (error) {
    throw new NotificationError({
      error,
      additionalMessage: "Error getting device push token",
    })
  }
}

export async function requestNotificationsPermissions(): Promise<{ granted: boolean }> {
  const hasGranted = await userHasGrantedNotificationsPermissions()

  // Permissions already granted
  if (hasGranted) {
    return { granted: true }
  }

  if (Platform.OS === "android") {
    // Android doesn't require explicit permission for notifications
    // Notification channels are set up in configureForegroundNotificationBehavior
    return { granted: true }
  }

  const result = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  })

  return { granted: result.status === Notifications.PermissionStatus.GRANTED }
}

export async function userHasGrantedNotificationsPermissions() {
  const permission = await ensureNotificationsPermissions()
  return permission.status === "granted"
}

export async function canAskForNotificationsPermissions() {
  const permission = await ensureNotificationsPermissions()
  return permission.canAskAgain
}

export function displayLocalNotification(args: Notifications.NotificationRequestInput) {
  return Notifications.scheduleNotificationAsync(args)
}

const TIMEOUT_MS = 45000 // 45 seconds
const TIMEOUT_SECONDS = TIMEOUT_MS / 1000

export async function maybeDisplayLocalNewMessageNotification(args: {
  encryptedMessage: string
  conversationTopic: IXmtpConversationTopic
}) {
  try {
    let timeoutId: NodeJS.Timeout | undefined

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Notification processing timed out after ${TIMEOUT_SECONDS} seconds`))
      }, TIMEOUT_MS)
    })

    const processNotificationPromise = (async () => {
      const { encryptedMessage, conversationTopic } = args

      notificationsLogger.debug("Processing notification with topic:", conversationTopic)
      const xmtpConversationId = getXmtpConversationIdFromXmtpTopic(conversationTopic)
      notificationsLogger.debug("Extracted conversation ID:", xmtpConversationId)

      const clientInboxId = getSafeCurrentSender().inboxId

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
      notificationsLogger.debug("Decrypted message:", xmtpDecryptedMessage)

      if (!conversation) {
        throw new NotificationError({
          error: `Conversation (${xmtpConversationId}) not found`,
        })
      }

      const convoMessage = convertXmtpMessageToConvosMessage(xmtpDecryptedMessage)

      notificationsLogger.debug("Fetching message content and sender info...")
      const [messageContentString, { displayName: senderDisplayName }] = await Promise.all([
        ensureMessageContentStringValue(convoMessage),
        ensurePreferredDisplayInfo({
          inboxId: convoMessage.senderInboxId,
        }),
      ])
      notificationsLogger.debug("Message content:", messageContentString)
      notificationsLogger.debug("Sender display name:", senderDisplayName)

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

      if (useAppStateStore.getState().currentState === "active") {
        notificationsLogger.debug("Skipping showing notification because app is active")
        return
      }

      notificationsLogger.debug("Displaying local notification...")
      await displayLocalNotification({
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
    })()

    try {
      await Promise.race([processNotificationPromise, timeoutPromise])
    } finally {
      // Clear the timeout to prevent memory leaks
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  } catch (error) {
    throw new NotificationError({
      error,
      additionalMessage: "Failed to display local notification",
    })
  }
}

export async function clearNotificationsForConversation(args: {
  xmtpConversationId: IXmtpConversationId
}) {
  try {
    notificationsLogger.debug("Clearing notifications for conversation:", args.xmtpConversationId)

    // Get all current notifications
    const presentedNotifications = await Notifications.getPresentedNotificationsAsync()

    if (presentedNotifications.length === 0) {
      notificationsLogger.debug("No notifications to clear")
      return
    }

    // Find notifications related to this conversation
    const notificationsToRemove = presentedNotifications.filter((notification) => {
      // Check if notification has data and message
      const data = notification.request.content.data as
        | INotificationMessageDataConverted
        | undefined

      if (!data || !data.message) {
        return false
      }

      // Check if the message's conversation ID matches
      return data.message.xmtpConversationId === args.xmtpConversationId
    })

    if (notificationsToRemove.length === 0) {
      notificationsLogger.debug(
        `No notifications to clear found for conversation ${args.xmtpConversationId}`,
      )
      return
    }

    notificationsLogger.debug(
      `Found ${notificationsToRemove.length} notifications to clear for conversation ${args.xmtpConversationId}`,
    )

    // Dismiss each notification
    await Promise.all(
      notificationsToRemove.map((notification) =>
        Notifications.dismissNotificationAsync(notification.request.identifier),
      ),
    )

    notificationsLogger.debug(
      `Successfully cleared ${notificationsToRemove.length} notifications for conversation ${args.xmtpConversationId}`,
    )
  } catch (error) {
    throw new NotificationError({
      error,
      additionalMessage: `Failed to clear notifications for conversation ${args.xmtpConversationId}`,
    })
  }
}
