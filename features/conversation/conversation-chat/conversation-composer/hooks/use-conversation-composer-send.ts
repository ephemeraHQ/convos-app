import { useCallback } from "react"
import { showSnackbar } from "@/components/snackbar/snackbar.service"
import { useConversationStore } from "@/features/conversation/conversation-chat/conversation.store-context"
import { createConversationAndSendFirstMessageMutation } from "@/features/conversation/conversation-create/mutations/create-conversation-and-send-first-message.mutation"
import {
  ISendMessageOptimisticallyParams,
  sendMessageMutation,
} from "@/features/conversation/hooks/use-send-message.mutation"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { waitUntilPromise } from "@/utils/wait-until-promise"
import {
  IComposerAttachment,
  IComposerAttachmentUploaded,
  useConversationComposerStore,
} from "../conversation-composer.store-context"

function isComposerAttachmentUploaded(
  attachment: IComposerAttachment,
): attachment is IComposerAttachmentUploaded {
  return attachment.status === "uploaded"
}

function waitForMediaUploads(composerAttachments: IComposerAttachment[]) {
  return waitUntilPromise({
    checkFn: () =>
      composerAttachments.every((attachment) => !attachment || attachment.status === "uploaded"),
    errorMessage: "Uploading media took too long, please try again",
  })
}

/**
 * Creates message content structure based on input values and attachments
 */
export function createMessageContents(args: {
  inputValue: string
  replyingToMessageId: IXmtpMessageId | null
  composerUploadedAttachments: IComposerAttachmentUploaded[]
}) {
  const { inputValue, replyingToMessageId, composerUploadedAttachments } = args

  // Create separate content arrays for normal messages and replies
  const messageContents: ISendMessageOptimisticallyParams["contents"] = replyingToMessageId
    ? [
        // Add text content as a reply if we have text
        ...(inputValue.length > 0
          ? [
              {
                reference: replyingToMessageId,
                content: { text: inputValue },
              },
            ]
          : []),

        // Add attachment content as replies
        ...(composerUploadedAttachments.length > 0
          ? composerUploadedAttachments.length === 1
            ? [
                {
                  reference: replyingToMessageId,
                  content: { ...composerUploadedAttachments[0] },
                },
              ]
            : [
                {
                  reference: replyingToMessageId,
                  content: { attachments: composerUploadedAttachments },
                },
              ]
          : []),
      ]
    : // Regular message structure - simpler case
      [
        // Text content if present
        ...(inputValue.length > 0 ? [{ text: inputValue }] : []),

        // Attachments if present
        ...(composerUploadedAttachments.length > 0
          ? composerUploadedAttachments.length === 1
            ? [{ ...composerUploadedAttachments[0] }]
            : [{ attachments: composerUploadedAttachments }]
          : []),
      ]

  return messageContents
}

/**
 * Hook for creating a new conversation and sending the first message
 */
export function useCreateConversationAndSend() {
  const composerStore = useConversationComposerStore()
  const conversationStore = useConversationStore()

  return useCallback(async () => {
    const { inputValue, replyingToMessageId, composerAttachments } = composerStore.getState()
    const { searchSelectedUserInboxIds } = conversationStore.getState()

    try {
      await waitForMediaUploads(composerAttachments)

      const composerUploadedAttachments = composerAttachments.filter(isComposerAttachmentUploaded)

      // Create message contents
      const messageContents = createMessageContents({
        inputValue,
        replyingToMessageId,
        composerUploadedAttachments,
      })

      // Reset composer state before sending to prevent duplicate sends
      composerStore.getState().reset()

      // Create conversation and send message
      const { conversation: createdConversation, errorSendingMessage } =
        await createConversationAndSendFirstMessageMutation({
          variables: {
            inboxIds: searchSelectedUserInboxIds,
            contents: messageContents,
          },
        })

      if (errorSendingMessage) {
        showSnackbar({
          message: "Created conversation but failed to send message",
          type: "error",
        })
      }

      // Update conversation state to reflect the new conversation
      conversationStore.setState({
        xmtpConversationId: createdConversation?.xmtpId,
        isCreatingNewConversation: false,
      })
    } catch (error) {
      // Reset conversation state to allow for retrying
      conversationStore.setState({
        xmtpConversationId: undefined,
        isCreatingNewConversation: true,
      })

      throw error
    }
  }, [composerStore, conversationStore])
}

/**
 * Hook for sending a message to an existing conversation
 */
export function useSendToExistingConversation() {
  const composerStore = useConversationComposerStore()
  const conversationStore = useConversationStore()

  return useCallback(async () => {
    const { inputValue, replyingToMessageId, composerAttachments } = composerStore.getState()
    const { xmtpConversationId } = conversationStore.getState()

    if (!xmtpConversationId) {
      throw new Error("Cannot send message: conversation ID is missing")
    }

    // Wait for media uploads to complete
    await waitForMediaUploads(composerAttachments)

    const composerUploadedAttachments = composerAttachments.filter(isComposerAttachmentUploaded)

    // Create message contents
    const messageContents = createMessageContents({
      inputValue,
      replyingToMessageId,
      composerUploadedAttachments,
    })

    // Reset composer state before sending to prevent duplicate sends
    composerStore.getState().reset()
    // Send the message
    await sendMessageMutation({
      contents: messageContents,
      xmtpConversationId,
    })
  }, [composerStore, conversationStore])
}
