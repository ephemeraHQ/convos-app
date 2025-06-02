import { HStack } from "@design-system/HStack"
import { VStack } from "@design-system/VStack"
import React, { memo, useCallback, useMemo, useState } from "react"
import { ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ConversationComposerReplyPreview } from "@/features/conversation/conversation-chat/conversation-composer/conversation-composer-reply-preview"
import {
  useCreateConversationAndSend,
  useSendToExistingConversation,
} from "@/features/conversation/conversation-chat/conversation-composer/hooks/use-conversation-composer-send"
import {
  useConversationStore,
  useConversationStoreContext,
} from "@/features/conversation/conversation-chat/conversation.store-context"
import { useAppTheme } from "@/theme/use-app-theme"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { ConversationComposerAddAttachmentButton } from "./conversation-composer-add-attachment-button"
import { ConversationComposerAttachmentPreview } from "./conversation-composer-attachment-preview"
import { ConversationComposerSendButton } from "./conversation-composer-send-button"
import { ConversationComposerTextInput } from "./conversation-composer-text-input"

export const ConversationComposer = memo(function ConversationComposer() {
  const styles = useStyles()
  const conversationStore = useConversationStore()
  const sendToExistingConversation = useSendToExistingConversation()
  const createConversationAndSend = useCreateConversationAndSend()
  const [isCreatingNewConversationLocal, setIsCreatingNewConversationLocal] = useState(false)
  const isCreatingNewConversation = useConversationStoreContext(
    (state) => state.isCreatingNewConversation,
  )

  const handleSend = useCallback(async () => {
    const { xmtpConversationId } = conversationStore.getState()
    try {
      if (xmtpConversationId) {
        await sendToExistingConversation()
      } else {
        setIsCreatingNewConversationLocal(true)
        await createConversationAndSend()
      }
    } catch (error) {
      captureErrorWithToast(
        new GenericError({ error, additionalMessage: "Failed to send message" }),
        {
          message: "Failed to send message",
        },
      )
    } finally {
      setIsCreatingNewConversationLocal(false)
    }
  }, [
    sendToExistingConversation,
    createConversationAndSend,
    conversationStore,
    setIsCreatingNewConversationLocal,
  ])

  return (
    <VStack style={styles.container}>
      <ConversationComposerReplyPreview />
      <VStack style={styles.innerContainer}>
        <HStack style={styles.composerRow}>
          <ConversationComposerAddAttachmentButton />
          <VStack style={styles.inputContainer}>
            <ConversationComposerAttachmentPreview />
            <HStack style={styles.inputRow}>
              <ConversationComposerTextInput onSubmitEditing={handleSend} />
              <ConversationComposerSendButton
                // For now only show loading if we are creating a new conversation because it's not optimistic yet
                isLoading={isCreatingNewConversationLocal && isCreatingNewConversation}
                onPress={handleSend}
              />
            </HStack>
          </VStack>
        </HStack>
      </VStack>
    </VStack>
  )
})

function useStyles() {
  const { theme } = useAppTheme()
  const insets = useSafeAreaInsets()

  return useMemo(() => {
    return {
      container: {
        paddingBottom: insets.bottom,
        justifyContent: "flex-end",
        overflow: "hidden",
        backgroundColor: theme.colors.background.surfaceless,
      } satisfies ViewStyle,
      innerContainer: {
        margin: 6, // 6 in the Figma
      } satisfies ViewStyle,
      composerRow: {
        alignItems: "flex-end",
      } satisfies ViewStyle,
      inputContainer: {
        flex: 1,
        margin: theme.spacing.xxxs - theme.borderWidth.sm, // -theme.borderWidth.sm because of the borderWidth is count in react-native and we want exact pixels
        borderWidth: theme.borderWidth.sm,
        borderColor: theme.colors.border.subtle,
        borderRadius: theme.borderRadius.md - 3, // 6/2 is the margin between the send button and the composer border
        overflow: "hidden",
        justifyContent: "flex-end",
      } satisfies ViewStyle,
      inputRow: {
        alignItems: "center",
      } satisfies ViewStyle,
    }
  }, [insets.bottom, theme])
}
