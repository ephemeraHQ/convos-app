import { useQuery } from "@tanstack/react-query"
import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import * as TaskManager from "expo-task-manager"
import { useEffect } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { IConversationTopic } from "@/features/conversation/conversation.types"
import { getNotificationsPermissionsQueryConfig } from "@/features/notifications/notifications-permissions.query"
import { usePrevious } from "@/hooks/use-previous-value"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { storage } from "@/utils/storage/storage"
import { maybeDisplayLocalNewMessageNotification } from "./notifications.service"

const BACKGROUND_NOTIFICATION_TASK = "com.convos.background-notification"
const PROCESSED_NOTIFICATIONS_KEY = "processed_notification_ids"
const NOTIFICATION_ID_TTL = 1000 * 60 * 5 // 5 minutes in milliseconds
export const RECEIVED_NOTIFICATIONS_COUNT_KEY = "received_notifications_count"
export const DISPLAYED_NOTIFICATIONS_COUNT_KEY = "displayed_notifications_count"

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

async function hasProcessedMessage(encryptedMessage: string): Promise<boolean> {
  try {
    const processedMessagesJson = storage.getString(PROCESSED_NOTIFICATIONS_KEY)
    if (!processedMessagesJson) return false

    const processedMessages = JSON.parse(processedMessagesJson) as Array<{
      id: string
      timestamp: number
    }>

    return processedMessages.some((message) => message.id === encryptedMessage)
  } catch (error) {
    notificationsLogger.error("Error checking processed messages", error)
    return false
  }
}

async function markMessageAsProcessed(encryptedMessage: string): Promise<void> {
  try {
    const now = Date.now()
    const processedMessagesJson = storage.getString(PROCESSED_NOTIFICATIONS_KEY)
    let processedMessages = processedMessagesJson
      ? (JSON.parse(processedMessagesJson) as Array<{ id: string; timestamp: number }>)
      : []

    // Remove expired entries
    processedMessages = processedMessages.filter(
      (message) => now - message.timestamp < NOTIFICATION_ID_TTL,
    )

    // Add new message
    processedMessages.push({ id: encryptedMessage, timestamp: now })

    // Store updated list
    storage.set(PROCESSED_NOTIFICATIONS_KEY, JSON.stringify(processedMessages))
  } catch (error) {
    notificationsLogger.error("Error marking message as processed", error)
  }
}

function incrementReceivedNotificationsCount(): void {
  try {
    const currentCount = storage.getNumber(RECEIVED_NOTIFICATIONS_COUNT_KEY) || 0
    storage.set(RECEIVED_NOTIFICATIONS_COUNT_KEY, currentCount + 1)
  } catch (error) {
    notificationsLogger.error("Error incrementing received notifications count", error)
  }
}

function incrementDisplayedNotificationsCount(): void {
  try {
    const currentCount = storage.getNumber(DISPLAYED_NOTIFICATIONS_COUNT_KEY) || 0
    storage.set(DISPLAYED_NOTIFICATIONS_COUNT_KEY, currentCount + 1)
  } catch (error) {
    notificationsLogger.error("Error incrementing displayed notifications count", error)
  }
}

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

    // Increment received notifications counter
    incrementReceivedNotificationsCount()

    // Check if we've already processed this message
    if (await hasProcessedMessage(encryptedMessage)) {
      notificationsLogger.debug("Skipping already processed message", { encryptedMessage })
      return
    }

    // Mark message as processed as soon as possible
    await markMessageAsProcessed(encryptedMessage)

    try {
      await maybeDisplayLocalNewMessageNotification({
        encryptedMessage,
        conversationTopic,
      })

      // If we reached here, the notification was displayed successfully
      incrementDisplayedNotificationsCount()
    } catch (error) {
      notificationsLogger.error("Failed to display notification", error)
    }
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
