import { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { memo, useEffect } from "react"
import { GlobalMediaViewerPortal } from "@/components/global-media-viewer/global-media-viewer"
import { IsReadyWrapper } from "@/components/is-ready-wrapper"
import { Screen } from "@/components/screen/screen"
import { Center } from "@/design-system/Center"
import { EmptyState } from "@/design-system/empty-state"
import { Loader } from "@/design-system/loader"
import { AnimatedVStack, VStack } from "@/design-system/VStack"
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
import { isConversationAllowed } from "@/features/conversation/utils/is-conversation-allowed"
import { clearNotificationsForConversation } from "@/features/notifications/notifications-clear"
import { usePrevious } from "@/hooks/use-previous-value"
import { NavigationParamList } from "@/navigation/navigation.types"
import { $globalStyles } from "@/theme/styles"
import { useAppTheme } from "@/theme/use-app-theme"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
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
  useConversationScreenHeader()
  useClearNotificationsForConversationOnMount()

  const { theme } = useAppTheme()

  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()
  const isCreatingNewConversation = useConversationStoreContext(
    (state) => state.isCreatingNewConversation,
  )
  const previousIsCreatingNewConversation = usePrevious(isCreatingNewConversation)

  const {
    data: conversation,
    isLoading: isLoadingConversation,
    error: conversationError,
  } = useConversationQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId: xmtpConversationId,
    caller: "Conversation screen",
  })

  if (isLoadingConversation) {
    return (
      <Center style={$globalStyles.flex1}>
        <Loader />
      </Center>
    )
  }

  if ((!conversation && !isCreatingNewConversation) || conversationError) {
    captureError(
      new GenericError({
        error:
          conversationError ||
          new Error(`Conversation not found for ${xmtpConversationId} in conversation screen`),
        additionalMessage: `Conversation not found for ${xmtpConversationId} in conversation screen`,
      }),
    )
    return (
      <Center safeAreaInsets={["bottom"]} style={{ ...$globalStyles.flex1 }}>
        <EmptyState
          title="Conversation not found"
          description="If you think this is an error, please contact us."
        />
      </Center>
    )
  }

  return (
    <>
      <VStack style={$globalStyles.flex1}>
        {isCreatingNewConversation && (
          <AnimatedVStack exiting={theme.animation.reanimatedFadeOutSpring}>
            <ConversationCreateSearchInput />
          </AnimatedVStack>
        )}
        <VStack style={$globalStyles.flex1}>
          {isCreatingNewConversation && <ConversationCreateListResults />}
          {conversation ? (
            <AnimatedVStack
              style={$globalStyles.flex1}
              {...(previousIsCreatingNewConversation && {
                entering: theme.animation.reanimatedFadeInSpring,
              })}
            >
              <ConversationMessages />
            </AnimatedVStack>
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

function useClearNotificationsForConversationOnMount() {
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  useEffect(() => {
    if (xmtpConversationId) {
      clearNotificationsForConversation({
        xmtpConversationId,
      }).catch(captureError)
    }
  }, [xmtpConversationId])
}
