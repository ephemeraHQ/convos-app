import * as Notifications from "expo-notifications"
import { IConversationMessage } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { IConversationTopic } from "@/features/conversation/conversation.types"

type INotificationWithData<T> = Omit<Notifications.Notification, "request"> & {
  request: Omit<Notifications.NotificationRequest, "content"> & {
    content: Notifications.NotificationContent & {
      data: T
    }
  }
}

export type INotificationPermissionStatus = "granted" | "denied" | "notDetermined" | "canAskAgain"

export type INotificationPermissions = {
  status: INotificationPermissionStatus
  canAskAgain: boolean
}

// Type for Expo push notifications containing new messages
export type IExpoNewMessageNotification = INotificationWithData<{
  contentTopic: IConversationTopic
  messageType: "v3-conversation"
  encryptedMessage: string
  timestamp: number
}>

export type INotificationFromTray = INotificationWithData<{
  contentTopic: IConversationTopic
  messageType: string
  encryptedMessage: string
  timestamp: number
}>

// Type for notifications that have been processed by the Convo app
export type INotificationMessageConverted = INotificationWithData<INotificationMessageConvertedData>

export type INotificationMessageConvertedData = {
  isProcessedByConvo: boolean
  message: IConversationMessage
}
