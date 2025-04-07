import { queryOptions, useQuery } from "@tanstack/react-query"
import {
  IConversationMessage,
  IConversationMessageReactionContent,
} from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { isReactionMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { ReactQueryError } from "@/utils/error"
import { queryLogger } from "@/utils/logger/logger"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"

type IArgs = {
  clientInboxId: IXmtpInboxId
  xmtpMessageId: IXmtpMessageId | undefined
}

// Reaction structure for a single message
export type IMessageReactions = {
  bySender: Record<IXmtpInboxId, IConversationMessageReactionContent[]>
  byReactionContent: Record<string, IXmtpInboxId[]>
}

export function getMessageReactionsQueryOptions(args: IArgs) {
  const { clientInboxId, xmtpMessageId } = args
  return queryOptions({
    queryKey: getReactQueryKey({
      baseStr: "message-reactions",
      clientInboxId,
      xmtpMessageId,
    }),
    queryFn: () => {
      // Return empty reactions structure by default
      return {
        bySender: {},
        byReactionContent: {},
      } as IMessageReactions
    },
    enabled: !!xmtpMessageId && !!clientInboxId,
  })
}

export function useMessageReactions(args: IArgs) {
  return useQuery(getMessageReactionsQueryOptions(args))
}

export function setMessageReactionsQueryData(args: IArgs, reactions: IMessageReactions) {
  return reactQueryClient.setQueryData(getMessageReactionsQueryOptions(args).queryKey, reactions)
}

export function getMessageReactionsQueryData(args: IArgs): IMessageReactions | undefined {
  return reactQueryClient.getQueryData(getMessageReactionsQueryOptions(args).queryKey)
}

/**
 * Process one or multiple reaction messages
 * Updates the reactions for the referenced messages in the cache
 */
export function processReactionMessages(args: {
  clientInboxId: IXmtpInboxId
  reactionMessages: IConversationMessage | IConversationMessage[]
}) {
  const { clientInboxId, reactionMessages } = args

  // Handle both single message and array of messages
  const messages = Array.isArray(reactionMessages) ? reactionMessages : [reactionMessages]

  // Group reactions by reference message ID for efficiency
  const reactionsByReferenceId = new Map<IXmtpMessageId, IConversationMessage[]>()

  // Filter and group valid reaction messages
  for (const message of messages) {
    if (!isReactionMessage(message) || !message.content.reference) {
      continue
    }

    const referenceId = message.content.reference
    if (!reactionsByReferenceId.has(referenceId)) {
      reactionsByReferenceId.set(referenceId, [])
    }

    reactionsByReferenceId.get(referenceId)?.push(message)
  }

  // Process each group of reactions
  reactionsByReferenceId.forEach((messagesToProcess, referenceId) => {
    // Get current reactions for this message
    const currentReactions = getMessageReactionsQueryData({
      clientInboxId,
      xmtpMessageId: referenceId,
    }) || {
      bySender: {},
      byReactionContent: {},
    }

    // Clone the reactions to modify
    const updatedReactions = {
      bySender: { ...currentReactions.bySender },
      byReactionContent: { ...currentReactions.byReactionContent },
    }

    // Process each reaction message
    for (const reactionMessage of messagesToProcess) {
      if (!isReactionMessage(reactionMessage)) {
        continue
      }

      const reactionContent = reactionMessage.content
      const senderAddress = reactionMessage.senderInboxId

      if (reactionContent.action === "added") {
        // Check if this sender already has this reaction
        const hasExistingReaction = updatedReactions.bySender[senderAddress]?.some(
          (reaction) => reaction.content === reactionContent.content,
        )

        if (!hasExistingReaction) {
          // Add to bySender
          updatedReactions.bySender[senderAddress] = [
            ...(updatedReactions.bySender[senderAddress] || []),
            reactionContent,
          ]

          // Add to byReactionContent
          updatedReactions.byReactionContent[reactionContent.content] = [
            ...(updatedReactions.byReactionContent[reactionContent.content] || []),
            senderAddress,
          ]
        }
      } else if (reactionContent.action === "removed") {
        // Remove from byReactionContent
        updatedReactions.byReactionContent[reactionContent.content] = (
          updatedReactions.byReactionContent[reactionContent.content] || []
        ).filter((id) => id !== senderAddress)

        // Remove from bySender
        updatedReactions.bySender[senderAddress] = (
          updatedReactions.bySender[senderAddress] || []
        ).filter((reaction) => reaction.content !== reactionContent.content)
      }
    }

    // Update the reactions in the cache
    setMessageReactionsQueryData({ clientInboxId, xmtpMessageId: referenceId }, updatedReactions)

    // Log only if we processed a single message (to avoid excessive logging)
    if (messages.length === 1) {
      const message = messages[0]
      if (isReactionMessage(message)) {
        queryLogger.debug(
          `Updated reactions for message ${referenceId}: ${message.content.action} ${message.content.content} from ${message.senderInboxId}`,
        )
      }
    } else {
      queryLogger.debug(
        `Updated reactions for message ${referenceId} (batch processed ${messagesToProcess.length} reactions)`,
      )
    }
  })
}
