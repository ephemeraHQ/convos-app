import { useMemo } from "react"
import {
  isGroupUpdatedMessage,
  messageContentIsGroupUpdated,
  messageContentIsMultiRemoteAttachment,
  messageContentIsReaction,
  messageContentIsRemoteAttachment,
  messageContentIsReply,
  messageContentIsStaticAttachment,
  messageContentIsText,
} from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import {
  ensurePreferredDisplayInfo,
  usePreferredDisplayInfo,
} from "@/features/preferred-display-info/use-preferred-display-info"
import { usePreferredDisplayInfoBatch } from "@/features/preferred-display-info/use-preferred-display-info-batch"
import { Nullable } from "@/types/general"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import {
  IConversationMessage,
  IConversationMessageContent,
} from "../../conversation-chat/conversation-message/conversation-message.types"

export function getMessageContentStringValue(args: {
  messageContent: IConversationMessageContent
  addedMemberDisplayInfos?: { displayName?: string }[]
  removedMemberDisplayInfos?: { displayName?: string }[]
  initiatorDisplayInfo?: { displayName?: string } | null
}): string {
  const {
    messageContent,
    addedMemberDisplayInfos = [],
    removedMemberDisplayInfos = [],
    initiatorDisplayInfo,
  } = args

  // Process based on content type
  if (messageContentIsText(messageContent)) {
    return messageContent.text
  }

  if (
    messageContentIsRemoteAttachment(messageContent) ||
    messageContentIsStaticAttachment(messageContent)
  ) {
    return "sent an attachment"
  }

  if (messageContentIsReaction(messageContent)) {
    return `reacted with ${messageContent.content}`
  }

  if (messageContentIsGroupUpdated(messageContent)) {
    // Handle metadata changes
    if (messageContent.metadataFieldsChanged.length > 0) {
      const initiatorName = initiatorDisplayInfo?.displayName ?? "someone"

      if (messageContent.metadataFieldsChanged.length === 1) {
        const change = messageContent.metadataFieldsChanged[0]
        switch (change.fieldName) {
          case "group_name":
            return `${initiatorName} changed the group name to ${change.newValue}`
          case "description":
            return `${initiatorName} changed the group description to ${change.newValue}`
          case "group_image_url_square":
            return `${initiatorName} changed the group image`
          default:
            return `${initiatorName} updated the group`
        }
      }

      return messageContent.metadataFieldsChanged
        .map((field) => {
          if (field.fieldName === "group_name") {
            return `${initiatorName} changed the group name from "${field.oldValue}" to "${field.newValue}"`
          }
          return `${initiatorName} updated the group ${field.fieldName}`
        })
        .join(", ")
    }

    // Handle member changes
    if (messageContent.membersAdded.length > 0) {
      if (messageContent.membersAdded.length === 1 && addedMemberDisplayInfos.length > 0) {
        const memberName = addedMemberDisplayInfos[0]?.displayName ?? "someone"
        const initiatorName = initiatorDisplayInfo?.displayName ?? "someone"
        return `${initiatorName} added ${memberName}`
      }
      return `${initiatorDisplayInfo?.displayName ?? "someone"} added ${messageContent.membersAdded.length} member${messageContent.membersAdded.length === 1 ? "" : "s"}`
    }

    if (messageContent.membersRemoved.length > 0) {
      if (messageContent.membersRemoved.length === 1 && removedMemberDisplayInfos.length > 0) {
        const memberName = removedMemberDisplayInfos[0]?.displayName ?? "someone"
        const initiatorName = initiatorDisplayInfo?.displayName ?? "someone"
        return `${initiatorName} removed ${memberName}`
      }
      return `${initiatorDisplayInfo?.displayName ?? "someone"} removed ${messageContent.membersRemoved.length} member${messageContent.membersRemoved.length === 1 ? "" : "s"}`
    }

    return "group updated"
  }

  if (messageContentIsMultiRemoteAttachment(messageContent)) {
    return "sent multiple attachments"
  }

  if (messageContentIsReply(messageContent)) {
    return `replied: ${getMessageContentStringValue({
      messageContent: messageContent.content,
    })}`
  }

  captureError(
    new GenericError({
      error: new Error("Unhandled message content type in getMessageContentStringValue"),
    }),
  )
  const _exhaustiveCheck: never = messageContent
  return "unknown message type"
}

export async function ensureMessageContentStringValue(message: IConversationMessage) {
  const [addedMemberDisplayInfos, removedMemberDisplayInfos, initiatorDisplayInfo] =
    await Promise.all([
      isGroupUpdatedMessage(message)
        ? Promise.all(
            message.content.membersAdded.map((m) =>
              ensurePreferredDisplayInfo({
                inboxId: m.inboxId,
                caller: "ensureMessageContentStringValue",
              }),
            ),
          )
        : Promise.resolve([]),
      isGroupUpdatedMessage(message)
        ? Promise.all(
            message.content.membersRemoved.map((m) =>
              ensurePreferredDisplayInfo({
                inboxId: m.inboxId,
                caller: "ensureMessageContentStringValue",
              }),
            ),
          )
        : Promise.resolve([]),
      isGroupUpdatedMessage(message)
        ? ensurePreferredDisplayInfo({
            inboxId: message.senderInboxId,
            caller: "ensureMessageContentStringValue",
          })
        : Promise.resolve(null),
    ])

  return getMessageContentStringValue({
    messageContent: message.content,
    addedMemberDisplayInfos,
    removedMemberDisplayInfos,
    initiatorDisplayInfo,
  })
}

export function useMessageContentStringValue(message: Nullable<IConversationMessage>) {
  // Get member profiles for group updates - split into added and removed
  const { addedMemberInboxIds, removedMemberInboxIds } = useMemo(() => {
    if (!message || !isGroupUpdatedMessage(message)) {
      return { addedMemberInboxIds: [], removedMemberInboxIds: [] }
    }
    const content = message.content
    return {
      addedMemberInboxIds: content.membersAdded.map((m) => m.inboxId),
      removedMemberInboxIds: content.membersRemoved.map((m) => m.inboxId),
    }
  }, [message])

  const addedMemberDisplayInfos = usePreferredDisplayInfoBatch({
    xmtpInboxIds: addedMemberInboxIds,
    caller: "useMessageContentStringValue",
  })

  const removedMemberDisplayInfos = usePreferredDisplayInfoBatch({
    xmtpInboxIds: removedMemberInboxIds,
    caller: "useMessageContentStringValue",
  })

  const initiatorDisplayInfo = usePreferredDisplayInfo({
    inboxId: message?.senderInboxId,
    caller: "useMessageContentStringValue",
  })

  return useMemo(() => {
    if (!message) {
      return ""
    }

    try {
      return getMessageContentStringValue({
        messageContent: message.content,
        addedMemberDisplayInfos,
        removedMemberDisplayInfos,
        initiatorDisplayInfo,
      })
    } catch (error) {
      captureError(
        new GenericError({
          error,
          additionalMessage: "Error getting message content string value",
        }),
      )
      return ""
    }
  }, [message, addedMemberDisplayInfos, removedMemberDisplayInfos, initiatorDisplayInfo])
}
