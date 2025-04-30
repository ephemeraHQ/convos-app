import { useMemo } from "react"
import { isCurrentSender, useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useConversationMessageReactionsQuery } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-reactions.query"
import { usePreferredDisplayInfoBatch } from "@/features/preferred-display-info/use-preferred-display-info-batch"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { ObjectTyped } from "@/utils/object-typed"
import { RolledUpReactions, SortedReaction } from "./conversation-message-reactions.types"

export function useConversationMessageReactionsRolledUp(args: { xmtpMessageId: IXmtpMessageId }) {
  const { xmtpMessageId } = args

  const currentSender = useSafeCurrentSender()

  const { data: reactions } = useConversationMessageReactionsQuery({
    clientInboxId: currentSender.inboxId,
    xmtpMessageId,
  })

  const inboxIds = ObjectTyped.keys(reactions?.bySender ?? {})

  const preferredDisplayData = usePreferredDisplayInfoBatch({
    xmtpInboxIds: inboxIds,
    caller: "useConversationMessageReactionsRolledUp",
  })

  return useMemo((): RolledUpReactions => {
    const detailed: SortedReaction[] = []
    let totalCount = 0
    let userReacted = false

    // Flatten reactions and track sender addresses
    const flatReactions = ObjectTyped.entries(reactions?.bySender ?? {}).flatMap(
      ([senderInboxId, senderReactions]) =>
        senderReactions.map((reaction) => ({ senderInboxId, ...reaction })),
    )
    totalCount = flatReactions.length

    // Track reaction counts for preview
    const previewCounts = new Map<string, number>()

    flatReactions.forEach((reaction) => {
      const isOwnReaction = isCurrentSender({
        inboxId: reaction.senderInboxId,
      })

      if (isOwnReaction) {
        userReacted = true
      }

      // Count reactions for the preview
      previewCounts.set(reaction.content, (previewCounts.get(reaction.content) || 0) + 1)

      const profile = preferredDisplayData?.[inboxIds.indexOf(reaction.senderInboxId)]

      detailed.push({
        content: reaction.content,
        isOwnReaction,
        reactor: {
          address: reaction.senderInboxId,
          username: profile?.displayName,
          avatar: profile?.avatarUrl,
        },
      })
    })

    // Sort detailed array to place all OWN reactions at the beginning
    detailed.sort((a, b) => Number(b.isOwnReaction) - Number(a.isOwnReaction))

    // Convert previewCounts map to array with content and count
    const preview = Array.from(previewCounts, ([content, count]) => ({
      content,
      count,
    }))

    return {
      messageId: xmtpMessageId,
      totalCount,
      userReacted,
      preview,
      detailed,
    }
  }, [reactions?.bySender, preferredDisplayData, xmtpMessageId, inboxIds])
}
