/**
 *
 * NOT USED ANYMORE since we put the message from the iOS NSE in the local storage
 * and we read them from there. Keep this file just in case we need it back soon.
 *
 */

// import * as Notifications from "expo-notifications"
// import { setConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
// import { convertXmtpMessageToConvosMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/convert-xmtp-message-to-convos-message"
// import { addMessagesToConversationMessagesInfiniteQueryData } from "@/features/conversation/conversation-chat/conversation-messages.query"
// import {
//   isConvosModifiedNotification,
//   isNotificationExpoNewMessageNotification,
// } from "@/features/notifications/notifications-assertions"
// import { getXmtpConversationIdFromXmtpTopic } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
// import { decryptXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages"
// import { isSupportedXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages-supported"
// import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
// import { groupBy } from "@/utils/array"
// import { captureError } from "@/utils/capture-error"
// import { NotificationError } from "@/utils/error"
// import { notificationsLogger } from "@/utils/logger/logger"
// import { ObjectTyped } from "@/utils/object-typed"
// import { customPromiseAllSettled } from "@/utils/promise-all-settled"

// export async function addNotificationsToConversationCacheData(args: {
//   conversationId: IXmtpConversationId
//   clientInboxId: IXmtpInboxId
//   notifications: Notifications.Notification[]
// }) {
//   const { clientInboxId, conversationId, notifications } = args

//   try {
//     notificationsLogger.debug(
//       `Adding ${notifications.length} notifications to conversation cache data for conversation ${conversationId}`,
//     )

//     const filteredNotifications = notifications.filter((notification) => {
//       try {
//         // Handle Convos modified notifications
//         if (isConvosModifiedNotification(notification)) {
//           return notification.request.content.data.message.xmtpConversationId === conversationId
//         }

//         // Handle Expo new message notifications
//         if (isNotificationExpoNewMessageNotification(notification)) {
//           const notificationConversationId = getXmtpConversationIdFromXmtpTopic(
//             notification.request.content.data.contentTopic,
//           )
//           return notificationConversationId === conversationId
//         }

//         // Log unhandled notification type
//         captureError(
//           new NotificationError({
//             error: new Error("Unknown notification type"),
//             additionalMessage: `Unable to identify notification type: ${JSON.stringify(
//               notification,
//             )}`,
//           }),
//         )

//         return false
//       } catch (error) {
//         // Capture any errors during notification filtering
//         captureError(
//           new NotificationError({
//             error,
//             additionalMessage: "Error filtering notification",
//           }),
//         )
//         return false
//       }
//     })

//     const sortedNotifications = filteredNotifications
//       .sort((a, b) => b.request.content.data.timestamp - a.request.content.data.timestamp)
//       .slice(0, 15) // Too many can cause problem on the bridge

//     const decryptedMessagesResults = await customPromiseAllSettled(
//       sortedNotifications.map(async (notification) => {
//         try {
//           const conversationTopic = isNotificationExpoNewMessageNotification(notification)
//             ? notification.request.content.data.contentTopic
//             : isConvosModifiedNotification(notification)
//               ? notification.request.content.data.message.xmtpTopic
//               : null

//           if (!conversationTopic) {
//             throw new Error(
//               `Unable to get conversation topic from notification: ${JSON.stringify(notification)}`,
//             )
//           }

//           const xmtpConversationId = getXmtpConversationIdFromXmtpTopic(conversationTopic)

//           const xmtpDecryptedMessage = await decryptXmtpMessage({
//             encryptedMessage: notification.request.content.data.encryptedMessage,
//             xmtpConversationId,
//             clientInboxId,
//           })

//           if (!isSupportedXmtpMessage(xmtpDecryptedMessage)) {
//             return null
//           }
//           return xmtpDecryptedMessage
//         } catch (error) {
//           captureError(
//             new NotificationError({
//               error,
//               additionalMessage: `Failed to decrypt message from presented notification`,
//             }),
//           )
//           return null
//         }
//       }),
//     )

//     const convosMessages = decryptedMessagesResults
//       .map((result) => (result.status === "fulfilled" ? result.value : null))
//       .filter(Boolean)
//       .map(convertXmtpMessageToConvosMessage)

//     for (const convosMessage of convosMessages) {
//       setConversationMessageQueryData({
//         clientInboxId,
//         xmtpMessageId: convosMessage.xmtpId,
//         xmtpConversationId: convosMessage.xmtpConversationId,
//         message: convosMessage,
//       })
//     }

//     const messagesGroupedByConversationId = groupBy(
//       convosMessages,
//       (message) => message.xmtpConversationId,
//     )

//     for (const [xmtpConversationId, messages] of ObjectTyped.entries(
//       messagesGroupedByConversationId,
//     )) {
//       addMessagesToConversationMessagesInfiniteQueryData({
//         clientInboxId,
//         xmtpConversationId,
//         messageIds: messages.map((message) => message.xmtpId),
//       })
//     }
//   } catch (error) {
//     captureError(
//       new NotificationError({
//         error,
//         additionalMessage: "Error adding notifications to cache",
//       }),
//     )
//   }
// }
