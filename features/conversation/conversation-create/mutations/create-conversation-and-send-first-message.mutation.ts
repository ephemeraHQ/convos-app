import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { MutationOptions, useMutation } from "@tanstack/react-query"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { addConversationToAllowedConsentConversationsQuery } from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
import { setConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { convertXmtpConversationToConvosConversation } from "@/features/conversation/utils/convert-xmtp-conversation-to-convos-conversation"
import { defaultConversationDisappearingMessageSettings } from "@/features/disappearing-messages/disappearing-messages.constants"
import { createXmtpDm } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-dm"
import { createXmtpGroup } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-group"
import { captureError } from "@/utils/capture-error"
import { ReactQueryError } from "@/utils/error"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import {
  handleCreatedOptimisticMessageIdsForConversation,
  ISendMessageOptimisticallyParams,
  sendMessageOptimistically,
} from "../../hooks/use-send-message.mutation"

export type ICreateConversationAndSendFirstMessageParams = {
  inboxIds: IXmtpInboxId[]
  contents: ISendMessageOptimisticallyParams["contents"]
}

export type ICreateConversationAndSendFirstMessageReturnType = Awaited<
  ReturnType<typeof createConversationAndSendFirstMessage>
>

export async function createConversationAndSendFirstMessage(
  args: ICreateConversationAndSendFirstMessageParams,
) {
  const { inboxIds, contents } = args

  if (!inboxIds.length) {
    throw new Error("No inboxIds provided")
  }

  if (!contents.length) {
    throw new Error(`No content provided`)
  }

  const currentSender = getSafeCurrentSender()

  // Create conversation
  const conversation =
    inboxIds.length > 1
      ? await convertXmtpConversationToConvosConversation(
          await createXmtpGroup({
            clientInboxId: currentSender.inboxId,
            inboxIds,
            ...(defaultConversationDisappearingMessageSettings.retentionDurationInNs > 0 && {
              disappearingMessageSettings: defaultConversationDisappearingMessageSettings,
            }),
          }),
        )
      : await convertXmtpConversationToConvosConversation(
          await createXmtpDm({
            senderClientInboxId: currentSender.inboxId,
            peerInboxId: inboxIds[0],
            ...(defaultConversationDisappearingMessageSettings.retentionDurationInNs > 0 && {
              disappearingMessageSettings: defaultConversationDisappearingMessageSettings,
            }),
          }),
        )

  // Send message
  try {
    const createdOptimisticMessageIds = await sendMessageOptimistically({
      xmtpConversationId: conversation.xmtpId,
      contents,
    })

    return {
      conversation,
      createdOptimisticMessageIds,
      errorSendingMessage: undefined,
    }
  } catch (error) {
    captureError(
      new ReactQueryError({
        error,
        additionalMessage: `Error sending message optimistically`,
      }),
    )

    // We still want to return the conversation so that the UI can still be updated
    return {
      conversation,
      createdOptimisticMessageIds: undefined,
      errorSendingMessage: error,
    }
  }
}

type ICreateConversationAndSendFirstMessageMutationOptions = MutationOptions<
  ICreateConversationAndSendFirstMessageReturnType,
  unknown,
  ICreateConversationAndSendFirstMessageParams
>

export const getCreateConversationAndSendFirstMessageMutationOptions =
  (): ICreateConversationAndSendFirstMessageMutationOptions => {
    return {
      mutationFn: createConversationAndSendFirstMessage,
      onSuccess: (result, variables, context) => {
        const currentSender = getSafeCurrentSender()

        // Handle the optimistic messages
        if (result.createdOptimisticMessageIds) {
          handleCreatedOptimisticMessageIdsForConversation({
            optimisticMessageIds: result.createdOptimisticMessageIds,
            xmtpConversationId: result.conversation.xmtpId,
          }).catch(captureError)
        }

        // Handle the new conversation
        setConversationQueryData({
          clientInboxId: currentSender.inboxId,
          xmtpConversationId: result.conversation.xmtpId,
          conversation: result.conversation,
        })
        addConversationToAllowedConsentConversationsQuery({
          clientInboxId: currentSender.inboxId,
          conversationId: result.conversation.xmtpId,
        })
      },
    }
  }

export const createConversationAndSendFirstMessageMutation = (args: {
  variables: ICreateConversationAndSendFirstMessageParams
}) => {
  const { variables } = args
  return reactQueryClient
    .getMutationCache()
    .build(reactQueryClient, getCreateConversationAndSendFirstMessageMutationOptions())
    .execute(variables)
}

export function useCreateConversationAndSendFirstMessageMutation() {
  return useMutation(getCreateConversationAndSendFirstMessageMutationOptions())
}
