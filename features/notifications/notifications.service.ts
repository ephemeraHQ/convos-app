import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { config } from "@/config"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import {
  messageContentIsMultiRemoteAttachment,
  messageContentIsRemoteAttachment,
} from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { convertXmtpMessageToConvosMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/convert-xmtp-message-to-convos-message"
import { ensureConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { ensureCurrentUserQueryData } from "@/features/current-user/current-user.query"
import { updateDevice } from "@/features/devices/devices.api"
import { ensureUserDeviceQueryData } from "@/features/devices/user-device.query"
import { ensureNotificationsPermissions } from "@/features/notifications/notifications-permissions.query"
import { registerNotificationInstallation } from "@/features/notifications/notifications.api"
import { INotificationMessageDataConverted } from "@/features/notifications/notifications.types"
import { ensurePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { getXmtpConversationIdFromXmtpTopic } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { ensureXmtpInstallationQueryData } from "@/features/xmtp/xmtp-installations/xmtp-installation.query"
import { decryptXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { IXmtpConversationTopic, IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { getCurrentRoute } from "@/navigation/navigation.utils"
import { convertMillisecondsToNanoseconds } from "@/utils/date"
import { NotificationError, UserCancelledError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { ensureMessageContentStringValue } from "../conversation/conversation-list/hooks/use-message-content-string-value"

// Full flow
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
    const installationId = await ensureXmtpInstallationQueryData({
      inboxId: currentSender.inboxId,
    })
    // Re-fetch the device token here, as it might have been updated or the previous call might be outside this scope's assurance
    // Alternatively, we could pass it down, but fetching again is simple.
    const freshDeviceToken = await getDevicePushNotificationsToken()

    await registerNotificationInstallation({
      installationId,
      deliveryMechanism: {
        deliveryMechanismType: {
          case: "apnsDeviceToken",
          value: freshDeviceToken,
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

    if (!(await userHasGrantedNotificationsPermissions())) {
      throw new Error("Notifications permissions not granted")
    }

    const data = await Notifications.getExpoPushTokenAsync({
      projectId: config.expo.projectId,
    })

    return data.data as string
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

    // Check if permissions are granted
    const hasPermissions = await userHasGrantedNotificationsPermissions()

    if (!hasPermissions) {
      throw new Error("Notifications permissions not granted")
    }

    const data = await Notifications.getDevicePushTokenAsync()

    // data.data is string for native platforms per DevicePushToken type
    // https://docs.expo.dev/versions/latest/sdk/notifications/#devicepushtoken
    token = data.data as string
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
      allowCriticalAlerts: true,
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

export async function maybeDisplayLocalNewMessageNotification(args: {
  encryptedMessage: string
  topic: IXmtpConversationTopic
}) {
  const TIMEOUT_MS = 45000 // 45 seconds

  const displayFallbackNotification = async () => {
    notificationsLogger.debug("Displaying fallback notification due to timeout...")
    const now = Date.now()
    await displayLocalNotification({
      content: {
        title: "New Message",
        body: "You received a new message",
        data: {
          message: {
            type: "text",
            status: "sent",
            senderInboxId: "fallback" as IXmtpInboxId,
            sentNs: convertMillisecondsToNanoseconds(now),
            sentMs: now,
            xmtpId: "fallback" as IXmtpMessageId,
            xmtpTopic: args.topic,
            xmtpConversationId: getXmtpConversationIdFromXmtpTopic(args.topic),
            content: {
              text: "New message",
            },
          },
          isProcessedByConvo: true,
        } satisfies INotificationMessageDataConverted,
      },
      trigger: null,
    })
    notificationsLogger.debug("Fallback notification displayed")
  }

  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Notification processing timed out after 30 seconds"))
      }, TIMEOUT_MS)
    })

    const processNotificationPromise = (async () => {
      const { encryptedMessage, topic } = args
      notificationsLogger.debug("Processing notification with topic:", topic)
      const xmtpConversationId = getXmtpConversationIdFromXmtpTopic(topic)
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

      // Check if the user is already in this conversation
      const currentRoute = getCurrentRoute()
      if (
        currentRoute?.name === "Conversation" &&
        currentRoute.params.xmtpConversationId === xmtpConversationId
      ) {
        notificationsLogger.debug(
          "User is already in this conversation, don't display local notification",
        )
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

    await Promise.race([processNotificationPromise, timeoutPromise])
  } catch (error) {
    // If it was a timeout or any other error, show the fallback notification
    await displayFallbackNotification()

    throw new NotificationError({
      error,
      additionalMessage: "Failed to display fallback notification",
    })
  }
}
