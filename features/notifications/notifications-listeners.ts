import * as Notifications from "expo-notifications"
import { useCallback, useEffect, useRef } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { setConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { convertXmtpMessageToConvosMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/convert-xmtp-message-to-convos-message"
import { addMessagesToConversationMessagesInfiniteQueryData } from "@/features/conversation/conversation-chat/conversation-messages.query"
import {
  isConvosModifiedNotification,
  isNotificationExpoNewMessageNotification,
} from "@/features/notifications/notifications-assertions"
import { useNotificationsStore } from "@/features/notifications/notifications.store"
import { getXmtpConversationIdFromXmtpTopic } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { decryptXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { isSupportedXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages-supported"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { navigate } from "@/navigation/navigation.utils"
import { useAppStore } from "@/stores/app-store"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { measureTimeAsync } from "@/utils/perf/perf-timer"
import { waitUntilPromise } from "@/utils/wait-until-promise"

export function useNotificationListeners() {
  const foregroundNotificationListener = useRef<Notifications.Subscription>()
  const notificationTapListener = useRef<Notifications.Subscription>()
  // const systemDropListener = useRef<Notifications.Subscription>()

  const handleNotificationTap = useCallback(
    async (response: Notifications.NotificationResponse) => {
      try {
        const tappedNotification = response.notification

        useNotificationsStore
          .getState()
          .actions.setLastTappedNotificationId(tappedNotification.request.identifier)

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
          return navigate("Conversation", {
            xmtpConversationId: tappedNotification.request.content.data.message.xmtpConversationId,
          })
        }

        if (isNotificationExpoNewMessageNotification(tappedNotification)) {
          notificationsLogger.debug(
            `Expo notification tapped: ${JSON.stringify(tappedNotification)}`,
          )

          const tappedConversationTopic = tappedNotification.request.content.data.contentTopic
          const tappedXmtpConversationId =
            getXmtpConversationIdFromXmtpTopic(tappedConversationTopic)

          addPresentedNotificationsToCache({
            tappedNotificationConversationId: tappedXmtpConversationId,
            clientInboxId: getSafeCurrentSender().inboxId,
          }).catch(captureError)

          return navigate("Conversation", {
            xmtpConversationId: tappedXmtpConversationId,
          })
        }

        throw new Error(`Unknown notification type: ${JSON.stringify(tappedNotification)}`)
      } catch (error) {
        captureError(
          new NotificationError({
            error,
            additionalMessage: "Error handling notification tap",
          }),
        )
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

    foregroundNotificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        // Doing nothing here because we already handle in notifications-init.ts
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

async function addPresentedNotificationsToCache(args: {
  tappedNotificationConversationId: IXmtpConversationId
  clientInboxId: IXmtpInboxId
}) {
  const { tappedNotificationConversationId, clientInboxId } = args

  const { result: presentedNotifications, durationMs } = await measureTimeAsync(() =>
    Notifications.getPresentedNotificationsAsync(),
  )
  notificationsLogger.debug(
    `Found ${presentedNotifications.length} notifications present in tray to decrypt and put in cache in ${durationMs}ms`,
  )

  try {
    const filteredNotifications = presentedNotifications
      .filter((notification) => {
        if (isNotificationExpoNewMessageNotification(notification)) {
          return (
            tappedNotificationConversationId ===
            getXmtpConversationIdFromXmtpTopic(notification.request.content.data.contentTopic)
          )
        }
        return false
      })
      .sort((a, b) => b.request.content.data.timestamp - a.request.content.data.timestamp)
      .slice(0, 15) // Too many can cause problem on the bridge

    const decryptedMessagesResults = await Promise.allSettled(
      filteredNotifications.map(async (notification) => {
        try {
          const conversationTopic = notification.request.content.data.contentTopic
          const xmtpConversationId = getXmtpConversationIdFromXmtpTopic(conversationTopic)

          const xmtpDecryptedMessage = await decryptXmtpMessage({
            encryptedMessage: notification.request.content.data.encryptedMessage,
            xmtpConversationId,
            clientInboxId,
          })

          if (!isSupportedXmtpMessage(xmtpDecryptedMessage)) {
            return null
          }
          return xmtpDecryptedMessage
        } catch (error) {
          captureError(
            new NotificationError({
              error,
              additionalMessage: `Failed to decrypt message from presented notification: ${notification.request.identifier}`,
            }),
          )
          return null
        }
      }),
    )

    const successfullyDecryptedMessages = decryptedMessagesResults
      .map((result) => (result.status === "fulfilled" ? result.value : null))
      .filter(Boolean)

    for (const decryptedMessage of successfullyDecryptedMessages) {
      const convosMessage = convertXmtpMessageToConvosMessage(decryptedMessage)

      setConversationMessageQueryData({
        clientInboxId,
        xmtpMessageId: convosMessage.xmtpId,
        xmtpConversationId: convosMessage.xmtpConversationId,
        message: convosMessage,
      })
    }

    addMessagesToConversationMessagesInfiniteQueryData({
      clientInboxId,
      xmtpConversationId: tappedNotificationConversationId,
      messageIds: successfullyDecryptedMessages.map((message) => message.id),
    })
  } catch (error) {
    captureError(
      new NotificationError({
        error,
        additionalMessage: "Error adding notifications to cache",
      }),
    )
  }
}
