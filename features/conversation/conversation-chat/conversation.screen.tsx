import { NativeStackScreenProps } from "@react-navigation/native-stack"
import { useQuery } from "@tanstack/react-query"
import React, { memo, useEffect, useRef } from "react"
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
import { ConversationMessages } from "./conversation-messages"
import {
  ConversationStoreProvider,
  useConversationStoreContext,
  useCurrentXmtpConversationIdSafe,
} from "./conversation.store-context"
import { captureError } from "@/utils/capture-error"
import { navigateFromHome } from "@/navigation/navigation.utils"
import { GenericError } from "@/utils/error"

// Delay in ms before redirecting on errors or missing conversation
const REDIRECT_DELAY_MS = 300

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
  
  // Timeout reference for loading states
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: conversation, isLoading: isLoadingConversation, error } = useQuery({
    ...getConversationQueryOptions({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId: xmtpConversationId,
      caller: "Conversation screen",
    }),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  })

  useConversationScreenHeader()

  // Redirect to Chats if conversation not found (unless creating a new conversation)
  useEffect(() => {
    if (error && !isCreatingNewConversation && xmtpConversationId) {
      captureError(
        new GenericError({
          error,
          additionalMessage: `Failed to load conversation, redirecting to Chats`,
        }),
      )
      
      // Add a small delay before navigating to make the transition smoother
      const redirectTimer = setTimeout(() => {
        navigateFromHome("Chats")
      }, REDIRECT_DELAY_MS)
      
      return () => clearTimeout(redirectTimer)
    }
  }, [error, isCreatingNewConversation, xmtpConversationId])

  // Set a timeout to prevent users from being stuck in loading state
  useEffect(() => {
    if (isLoadingConversation && !isCreatingNewConversation && xmtpConversationId) {
      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
      
      // Set a new timeout - if loading takes more than 5 seconds, redirect to Chats
      loadingTimeoutRef.current = setTimeout(() => {
        if (isLoadingConversation) {
          captureError(
            new GenericError({
              error: new Error("Conversation loading timeout"),
              additionalMessage: `Conversation loading timed out after 5 seconds, redirecting to Chats`,
            }),
          )
          // Add a small delay before navigating
          setTimeout(() => {
            navigateFromHome("Chats")
          }, REDIRECT_DELAY_MS)
        }
      }, 5000) // 5 second timeout
    }
    
    // Clean up timeout on unmount or when loading completes
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
    }
  }, [isLoadingConversation, isCreatingNewConversation, xmtpConversationId])

  // Handle missing conversation data
  useEffect(() => {
    if (!isCreatingNewConversation && !conversation && !isLoadingConversation && xmtpConversationId) {
      captureError(
        new GenericError({
          error: new Error("No conversation data after loading"),
          additionalMessage: `Conversation data not available, redirecting to Chats`,
        }),
      )
      const timer = setTimeout(() => navigateFromHome("Chats"), REDIRECT_DELAY_MS)
      return () => clearTimeout(timer)
    }
  }, [isCreatingNewConversation, conversation, isLoadingConversation, xmtpConversationId])

  useEffect(() => {
    if (xmtpConversationId) {
      clearNotificationsForConversation({ xmtpConversationId })
    }
  }, [xmtpConversationId])

  // Add timeout to the loading check
  if (isLoadingConversation) {
    return (
      <Center style={$globalStyles.flex1}>
        <ActivityIndicator />
      </Center>
    )
  }
  
  // Show loading indicator while we're about to redirect
  if (!isCreatingNewConversation && !conversation && xmtpConversationId) {
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
      <IsReadyWrapper delay={500}>
        <ConversationMessageContextMenu />
        <MessageReactionsDrawer />
      </IsReadyWrapper>
    </>
  )
})
