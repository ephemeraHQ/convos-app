import { NativeStackScreenProps } from "@react-navigation/native-stack"
import { useQuery } from "@tanstack/react-query"
import React, { memo, useEffect } from "react"
import { GlobalMediaViewerPortal } from "@/components/global-media-viewer/global-media-viewer"
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
import { getConversationQueryOptions } from "@/features/conversation/queries/conversation.query"
import { isConversationAllowed } from "@/features/conversation/utils/is-conversation-allowed"
import { clearNotificationsForConversation } from "@/features/notifications/notifications-clear"
import { NavigationParamList } from "@/navigation/navigation.types"
import { $globalStyles } from "@/theme/styles"
import { captureError } from "@/utils/capture-error"
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

  const { data: conversation, isLoading: isLoadingConversation } = useQuery({
    ...getConversationQueryOptions({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId: xmtpConversationId,
      caller: "Conversation screen",
    }),
  })

  useConversationScreenHeader()

  useEffect(() => {
    if (xmtpConversationId) {
      clearNotificationsForConversation({ xmtpConversationId }).catch(captureError)
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
          {(isCreatingNewConversation || (conversation && isConversationAllowed(conversation))) && (
            <ConversationComposer />
          )}
          <ConversationKeyboardFiller />
        </VStack>
      </VStack>
      <IsReadyWrapper delay={1000}>
        <ConversationMessageContextMenu />
        <MessageReactionsDrawer />
      </IsReadyWrapper>
    </>
  )
})
