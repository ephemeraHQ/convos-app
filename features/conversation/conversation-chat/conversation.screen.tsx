import { useIsFocused } from "@react-navigation/native"
import { NativeStackScreenProps } from "@react-navigation/native-stack"
import * as Notifications from "expo-notifications"
import React, { memo, useEffect } from "react"
import { GlobalMediaViewerPortal } from "@/components/global-media-viewer/global-media-viewer"
import { IsReadyWrapper } from "@/components/is-ready-wrapper"
import { Screen } from "@/components/screen/screen"
import { VStack } from "@/design-system/VStack"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ConversationComposer } from "@/features/conversation/conversation-chat/conversation-composer/conversation-composer"
import { ConversationComposerStoreProvider } from "@/features/conversation/conversation-chat/conversation-composer/conversation-composer.store-context"
import { ConversationKeyboardFiller } from "@/features/conversation/conversation-chat/conversation-keyboard-filler.component"
import { ConversationMessageContextMenu } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-context-menu/conversation-message-context-menu"
import { ConversationMessageContextMenuStoreProvider } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-context-menu/conversation-message-context-menu.store-context"
import { MessageReactionsDrawer } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-reactions/conversation-message-reaction-drawer/conversation-message-reaction-drawer"
import { useConversationScreenHeader } from "@/features/conversation/conversation-chat/conversation.screen-header"
import { ConversationCreateListResults } from "@/features/conversation/conversation-create/conversation-create-list-results"
import { ConversationCreateSearchInput } from "@/features/conversation/conversation-create/conversation-create-search-input"
import { INotificationMessageDataConverted } from "@/features/notifications/notifications.types"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { NavigationParamList } from "@/navigation/navigation.types"
import { $globalStyles } from "@/theme/styles"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { ConversationMessages } from "./conversation-messages"
import {
  ConversationStoreProvider,
  useConversationStoreContext,
  useCurrentXmtpConversationIdSafe,
} from "./conversation.store-context"

export const ConversationScreen = memo(function ConversationScreen(
  props: NativeStackScreenProps<NavigationParamList, "Conversation">,
) {
  const {
    xmtpConversationId,
    composerTextPrefill = "",
    searchSelectedUserInboxIds = [],
    isNew = false,
  } = props.route.params

  const isFocused = useIsFocused()

  console.log("isFocused:", isFocused)

  return (
    <Screen preset="fixed" contentContainerStyle={$globalStyles.flex1}>
      <ConversationStoreProvider
        xmtpConversationId={xmtpConversationId ?? null}
        isCreatingNewConversation={isNew}
        searchSelectedUserInboxIds={searchSelectedUserInboxIds}
      >
        <ConversationMessageContextMenuStoreProvider>
          <ConversationComposerStoreProvider inputValue={composerTextPrefill}>
            <Content />
          </ConversationComposerStoreProvider>
        </ConversationMessageContextMenuStoreProvider>
      </ConversationStoreProvider>
      <GlobalMediaViewerPortal />
    </Screen>
  )
})

const Content = memo(function Content() {
  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()
  const isCreatingNewConversation = useConversationStoreContext(
    (state) => state.isCreatingNewConversation,
  )

  // const { data: conversation, isLoading: isLoadingConversation } = useConversationQuery({
  //   clientInboxId: currentSender.inboxId,
  //   xmtpConversationId: xmtpConversationId,
  //   caller: "Conversation screen",
  // })

  useConversationScreenHeader()

  useEffect(() => {
    console.log("go")
    if (xmtpConversationId) {
      // clearNotificationsForConversation({ xmtpConversationId }).catch(captureError)
    }
  }, [xmtpConversationId])

  // if (isLoadingConversation) {
  //   return (
  //     <Center style={$globalStyles.flex1}>
  //       <ActivityIndicator />
  //     </Center>
  //   )
  // }

  return null

  return (
    <>
      <VStack style={$globalStyles.flex1}>
        {isCreatingNewConversation && <ConversationCreateSearchInput />}

        <VStack style={$globalStyles.flex1}>
          {isCreatingNewConversation && <ConversationCreateListResults />}
          {conversation ? (
            <VStack style={$globalStyles.flex1}>
              <ConversationMessages />
            </VStack>
          ) : (
            <VStack style={$globalStyles.flex1} />
          )}
          <ConversationComposer />
          <ConversationKeyboardFiller />
        </VStack>
      </VStack>
      <IsReadyWrapper delay={500}>
        <ConversationMessageContextMenu />
        <MessageReactionsDrawer />
      </IsReadyWrapper>
    </>
  )
})

export async function clearNotificationsForConversation(args: {
  xmtpConversationId: IXmtpConversationId
}) {
  try {
    notificationsLogger.debug("Clearing notifications for conversation:", args.xmtpConversationId)

    // Get all current notifications
    const presentedNotifications = await Notifications.getPresentedNotificationsAsync()

    console.log("presentedNotifications.length:", presentedNotifications.length)

    if (presentedNotifications.length === 0) {
      notificationsLogger.debug("No notifications to clear")
      return
    }

    return

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
