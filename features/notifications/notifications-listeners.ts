import * as Notifications from "expo-notifications"
import { useCallback, useEffect, useRef } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import {
  isConvosModifiedNotification,
  isNotificationExpoNewMessageNotification,
} from "@/features/notifications/notifications-assertions"
import { getXmtpConversationIdFromXmtpTopic } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { navigateFromHome } from "@/navigation/navigation.utils"
import { useAppStore } from "@/stores/app-store"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { waitUntilPromise } from "@/utils/wait-until-promise"
import { getConversationQueryData, ensureConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"

export function useNotificationListeners() {
  const foregroundNotificationListener = useRef<Notifications.Subscription>()
  const notificationTapListener = useRef<Notifications.Subscription>()
  // const systemDropListener = useRef<Notifications.Subscription>()

  const handleNotificationTap = useCallback(
    async (response: Notifications.NotificationResponse) => {
      try {
        const tappedNotification = response.notification

        // Sometimes we tap on a notification while the app is killed and this is triggered
        // before we finished hydrating auth so we push to a screen that isn't in the navigator yet
        await waitUntilPromise({
          checkFn: () => {
            return useAuthenticationStore.getState().status === "signedIn"
          },
        })

        // Because we had sometimes where we added a message to the cache but then it was overwritten
        // by the query client so we need to wait until the query client is hydrated
        await waitUntilPromise({
          checkFn: () => {
            return useAppStore.getState().reactQueryIsHydrated
          },
        })

        if (isConvosModifiedNotification(tappedNotification)) {
          notificationsLogger.debug(
            `Convos modified notification tapped: ${JSON.stringify(tappedNotification)}`,
          )
          
          // Check if conversation exists before navigating
          const xmtpConversationId = tappedNotification.request.content.data.message.xmtpConversationId
          const currentSender = getSafeCurrentSender()
          
          try {
            // Prepare the conversation before navigating
            const conversationExists = await ensureConversationExistsWithRetry({
              clientInboxId: currentSender.inboxId,
              xmtpConversationId,
            })
            
            if (!conversationExists) {
              notificationsLogger.debug(
                `Conversation not found after retries, navigating to Chats instead`
              )
              return navigateFromHome("Chats")
            }
            
            // If we got here, the conversation exists, so navigate to it
            return navigateFromHome("Conversation", {
              xmtpConversationId,
            })
          } catch (error) {
            notificationsLogger.debug(`Error ensuring conversation existence, navigating to Chats`)
            captureError(
              new NotificationError({
                error,
                additionalMessage: `Error ensuring conversation exists`,
              })
            )
            // Add a small delay before navigating to make transitions smooth
            await new Promise(resolve => setTimeout(resolve, 300))
            return navigateFromHome("Chats")
          }
        }

        if (isNotificationExpoNewMessageNotification(tappedNotification)) {
          notificationsLogger.debug(
            `Expo notification tapped: ${JSON.stringify(tappedNotification)}`,
          )

          // Get all presented notifications
          // const presentedNotifications = await Notifications.getPresentedNotificationsAsync()
          // const clientInboxId = getSafeCurrentSender().inboxId

          // notificationsLogger.debug(
          //   `Found ${presentedNotifications.length} notifications present in tray to analyze`,
          //   JSON.stringify(presentedNotifications),
          // )

          // const tappedNotificationConversationId = getXmtpConversationIdFromXmtpTopic(
          //   tappedNotification.request.content.data.contentTopic,
          // )

          // Take all the notifications present in tray and add their message in the cache
          // This is temporary until we have our ios NSE that will handle this
          // Don't await, we want to do this in the background
          // Finally not sure because it might clog the bridge
          // And also the UX isn't nice because we're seeing messages appear not all at once
          // Promise.all(
          //   presentedNotifications
          //     .filter((notification) => {
          //       // Just the one related to the same conversation as the tapped notification
          //       if (isNotificationExpoNewMessageNotification(notification)) {
          //         return (
          //           tappedNotificationConversationId ===
          //           getXmtpConversationIdFromXmtpTopic(
          //             notification.request.content.data.contentTopic,
          //           )
          //         )
          //       }

          //       return false
          //     })
          //     .sort((a, b) => b.request.content.data.timestamp - a.request.content.data.timestamp)
          //     .slice(0, 5) // Too many can cause problem on the bridge
          //     .map(async (notification) => {
          //       try {
          //         const conversationTopic = notification.request.content.data.contentTopic
          //         const xmtpConversationId = getXmtpConversationIdFromXmtpTopic(conversationTopic)
          //         await getDecryptedMessageAndAddToCache({
          //           encryptedMessage: notification.request.content.data.encryptedMessage,
          //           xmtpConversationId,
          //           clientInboxId,
          //         })
          //       } catch (error) {
          //         // Capture errors for individual messages but don't block the process
          //         captureError(
          //           new NotificationError({
          //             error,
          //             additionalMessage: `Failed to decrypt/cache message from presented notification: ${notification.request.identifier}`,
          //           }),
          //         )
          //       }
          //     }),
          // ).catch(captureError)

          const tappedConversationTopic = tappedNotification.request.content.data.contentTopic
          const tappedXmtpConversationId =
            getXmtpConversationIdFromXmtpTopic(tappedConversationTopic)
            
          // Check if conversation exists before navigating
          const currentSender = getSafeCurrentSender()
          
          try {
            // Prepare the conversation before navigating
            const conversationExists = await ensureConversationExistsWithRetry({
              clientInboxId: currentSender.inboxId,
              xmtpConversationId: tappedXmtpConversationId,
            })
            
            if (!conversationExists) {
              notificationsLogger.debug(
                `Conversation not found after retries, navigating to Chats instead`
              )
              return navigateFromHome("Chats")
            }
            
            // If we got here, the conversation exists, so navigate to it
            return navigateFromHome("Conversation", {
              xmtpConversationId: tappedXmtpConversationId,
            })
          } catch (error) {
            notificationsLogger.debug(`Error ensuring conversation existence, navigating to Chats`)
            captureError(
              new NotificationError({
                error,
                additionalMessage: `Error ensuring conversation exists`,
              })
            )
            // Add a small delay before navigating to make transitions smooth
            await new Promise(resolve => setTimeout(resolve, 300))
            return navigateFromHome("Chats")
          }
        }

        throw new Error(`Unknown notification type: ${JSON.stringify(tappedNotification)}`)
      } catch (error) {
        captureError(
          new NotificationError({
            error,
            additionalMessage: "Error handling notification tap",
          }),
        )
        // If any error occurs during notification handling, navigate to Chats
        navigateFromHome("Chats")
      }
    },
    [],
  )

  // Check if app was launched by tapping a notification while killed

  useEffect(() => {
    // Check if app was launched by tapping a notification while killed
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationTap(response).catch(captureError)
      }
    })

    // Listen for notifications while app is in foreground
    foregroundNotificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        // notificationsLogger.debug(`Handling foreground notification:`, notification)
      },
    )

    // Listen for notification taps while app is running
    notificationTapListener.current =
      Notifications.addNotificationResponseReceivedListener(handleNotificationTap)

    // // Listen for when system drops notifications
    // Causing an error on iOS
    // systemDropListener.current = Notifications.addNotificationsDroppedListener(() => {
    //   notificationsLogger.debug(
    //     "[useNotificationListenersWhileRunning] System dropped notifications due to limits",
    //   )
    //   onSystemDroppedNotifications?.()
    // })

    // Cleanup subscriptions on unmount
    return () => {
      if (foregroundNotificationListener.current) {
        Notifications.removeNotificationSubscription(foregroundNotificationListener.current)
      }

      if (notificationTapListener.current) {
        Notifications.removeNotificationSubscription(notificationTapListener.current)
      }

      // if (systemDropListener.current) {
      //   Notifications.removeNotificationSubscription(systemDropListener.current)
      // }
    }
  }, [handleNotificationTap])
}

/**
 * Helper function to check if a conversation exists
 * Uses ensureConversationQueryData which will try to fetch conversation data if it doesn't exist in cache
 */
async function doesConversationExist(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}) {
  try {
    // First check if it's in the cache
    const cachedConversation = getConversationQueryData(args)
    if (cachedConversation) {
      return true
    }
    
    // If not in cache, try to fetch it
    const conversation = await ensureConversationQueryData({
      ...args,
      caller: 'notificationConversationCheck',
    })
    
    // If conversation was fetched successfully, it exists
    return !!conversation
  } catch (error) {
    // If there was an error fetching the conversation, it either doesn't exist
    // or there was a network issue - in either case, safer to return false
    notificationsLogger.debug(`Error checking conversation existence: ${error}`)
    return false
  }
}

/**
 * Ensures a conversation exists with retry mechanism
 * Will retry multiple times with increasing delays before giving up
 */
async function ensureConversationExistsWithRetry(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}): Promise<boolean> {
  const maxRetries = 3
  const initialDelayMs = 500
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Try to fetch the conversation
    const exists = await doesConversationExist(args)
    
    if (exists) {
      // If found on this attempt, return success
      if (attempt > 0) {
        notificationsLogger.debug(`Conversation found on retry attempt ${attempt + 1}`)
      }
      return true
    }
    
    // If this is the last attempt, don't wait
    if (attempt === maxRetries - 1) {
      break
    }
    
    // Wait with exponential backoff before retrying
    const delayMs = initialDelayMs * Math.pow(2, attempt)
    notificationsLogger.debug(`Conversation not found on attempt ${attempt + 1}, retrying in ${delayMs}ms`)
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }
  
  notificationsLogger.debug(`Conversation not found after ${maxRetries} attempts`)
  return false
}

// async function getDecryptedMessageAndAddToCache(args: {
//   encryptedMessage: string
//   xmtpConversationId: IXmtpConversationId
//   clientInboxId: IXmtpInboxId
// }) {
//   const { encryptedMessage, xmtpConversationId, clientInboxId } = args

//   const xmtpDecryptedMessage = await decryptXmtpMessage({
//     encryptedMessage,
//     xmtpConversationId,
//     clientInboxId,
//   })

//   if (!isSupportedXmtpMessage(xmtpDecryptedMessage)) {
//     return
//   }

//   const convoMessage = convertXmtpMessageToConvosMessage(xmtpDecryptedMessage)

//   setConversationMessageQueryData({
//     clientInboxId: args.clientInboxId,
//     xmtpMessageId: convoMessage.xmtpId,
//     xmtpConversationId,
//     message: convoMessage,
//   })
//   addMessageToConversationMessagesInfiniteQueryData({
//     clientInboxId: getSafeCurrentSender().inboxId,
//     xmtpConversationId,
//     messageId: convoMessage.xmtpId,
//   })

//   return convoMessage
// }
