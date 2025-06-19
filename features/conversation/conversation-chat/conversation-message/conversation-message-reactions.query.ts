import { Query, queryOptions, useQuery } from "@tanstack/react-query"
import {
  IConversationMessage,
  IConversationMessageReaction,
  IConversationMessageReactionContent,
} from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { isReactionMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"

type IArgs = {
  clientInboxId: IXmtpInboxId
  xmtpMessageId: IXmtpMessageId | undefined
}

// Reaction structure for a single message
export type IConversationMessageReactions = {
  bySender: Record<IXmtpInboxId, IConversationMessageReactionContent[]>
  byReactionContent: Record<string, IXmtpInboxId[]>
}

export function getConversationMessageReactionsQueryOptions(args: IArgs) {
  const { clientInboxId, xmtpMessageId } = args
  return queryOptions({
    queryKey: getReactQueryKey({
      baseStr: "message-reactions",
      clientInboxId,
      xmtpMessageId,
    }),
    initialData: {
      bySender: {},
      byReactionContent: {},
    } as IConversationMessageReactions,
    queryFn: () => {
      // Will add once in XMTP we can fetch reactions for a single message
      return {
        bySender: {},
        byReactionContent: {},
      } as IConversationMessageReactions
    },
    meta: {
      persist: (query: Query<IConversationMessageReactions>) => {
        const data = query.state.data
        if (!data) {
          return false
        }
        return Object.values(data.bySender).some((arr) => arr.length > 0)
      },
    },
    // enabled: !!xmtpMessageId && !!clientInboxId,
    enabled: false, // For now we can't fetch reactions from XMTP
  })
}

export function useConversationMessageReactionsQuery(args: IArgs) {
  return useQuery(getConversationMessageReactionsQueryOptions(args))
}

export function setConversationMessageReactionsQueryData(
  args: IArgs,
  reactions: IConversationMessageReactions,
) {
  return reactQueryClient.setQueryData(
    getConversationMessageReactionsQueryOptions(args).queryKey,
    reactions,
  )
}

export function getConversationMessageReactionsQueryData(
  args: IArgs,
): IConversationMessageReactions | undefined {
  return reactQueryClient.getQueryData(getConversationMessageReactionsQueryOptions(args).queryKey)
}

/**
 * Process one or multiple reaction messages
 * Updates the reactions for the referenced messages in the cache
 */
export function processReactionConversationMessages(args: {
  clientInboxId: IXmtpInboxId
  reactionMessages: IConversationMessageReaction[]
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
    const currentReactions = getConversationMessageReactionsQueryData({
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

    // Sort messages chronologically to ensure correct add/remove sequence
    messagesToProcess.sort((a, b) => a.sentNs - b.sentNs)

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
    setConversationMessageReactionsQueryData(
      { clientInboxId, xmtpMessageId: referenceId },
      updatedReactions,
    )
  })
}

export function invalidateConversationMessageReactionsQuery(args: IArgs) {
  return reactQueryClient.invalidateQueries({
    queryKey: getConversationMessageReactionsQueryOptions(args).queryKey,
  })
}
