import { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { memo, useEffect } from "react"
import { IsReadyWrapper } from "@/components/is-ready-wrapper"
import { Screen } from "@/components/screen/screen"
import { ActivityIndicator } from "@/design-system/activity-indicator"
import { Center } from "@/design-system/Center"
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
import { useConversationQuery } from "@/features/conversation/queries/conversation.query"
import { clearNotificationsForConversation } from "@/features/notifications/notifications.service"
import { NavigationParamList } from "@/navigation/navigation.types"
import { $globalStyles } from "@/theme/styles"
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
    </Screen>
  )
})

const Content = memo(function Content() {
  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()
  const isCreatingNewConversation = useConversationStoreContext(
    (state) => state.isCreatingNewConversation,
  )

  const { data: conversation, isLoading: isLoadingConversation } = useConversationQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId: xmtpConversationId,
    caller: "Conversation screen",
  })

  useConversationScreenHeader()

  useEffect(() => {
    if (xmtpConversationId) {
      clearNotificationsForConversation({ xmtpConversationId })
    }
  }, [xmtpConversationId])

  if (isLoadingConversation) {
    return (
      <Center style={$globalStyles.flex1}>
        <ActivityIndicator />
      </Center>
    )
  }

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
