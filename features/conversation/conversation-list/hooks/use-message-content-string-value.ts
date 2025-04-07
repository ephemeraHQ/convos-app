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
import { messageIsFromCurrentSenderInboxId } from "@/features/conversation/utils/message-is-from-current-user"
import {
  ensurePreferredDisplayInfo,
  usePreferredDisplayInfo,
} from "@/features/preferred-display-info/use-preferred-display-info"
import { usePreferredDisplayInfoBatch } from "@/features/preferred-display-info/use-preferred-display-info-batch"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import {
  IConversationMessage,
  IConversationMessageContent,
} from "../../conversation-chat/conversation-message/conversation-message.types"

export function getMessageContentUniqueStringValue(args: {
  messageContent: IConversationMessageContent
}): string {
  const { messageContent } = args

  if (messageContentIsText(messageContent)) {
    return messageContent.text
  }

  if (messageContentIsReaction(messageContent)) {
    return `${messageContent.action}-${messageContent.content}`
  }

  if (messageContentIsGroupUpdated(messageContent)) {
    // Join field names with commas to create a summary of what changed
    return `${messageContent.initiatedByInboxId}-${messageContent.metadataFieldsChanged
      .map((field) => `${field.fieldName}-${field.newValue}-${field.oldValue}`)
      .join(", ")}-${messageContent.membersAdded.length}-${messageContent.membersRemoved.length}`
  }

  if (messageContentIsRemoteAttachment(messageContent)) {
    return messageContent.url
  }

  if (messageContentIsStaticAttachment(messageContent)) {
    return messageContent.data.slice(0, 10)
  }

  if (messageContentIsMultiRemoteAttachment(messageContent)) {
    return messageContent.attachments.map((attachment) => attachment.url).join(", ")
  }

  if (messageContentIsReply(messageContent)) {
    return `${messageContent.reference}-${getMessageContentUniqueStringValue({
      messageContent: messageContent.content,
    })}`
  }

  const _exhaustiveCheck: never = messageContent
  return "Unknown message content type"
}

export function getMessageContentStringValue(args: {
  messageContent: IConversationMessageContent
  initiatorDisplayName: string
  addedMemberDisplayInfos?: Array<{ displayName?: string }>
  removedMemberDisplayInfos?: Array<{ displayName?: string }>
}): string {
  const {
    messageContent,
    initiatorDisplayName,
    addedMemberDisplayInfos = [],
    removedMemberDisplayInfos = [],
  } = args

  // Process based on content type
  if (messageContentIsText(messageContent)) {
    return messageContent.text
  }

  if (
    messageContentIsRemoteAttachment(messageContent) ||
    messageContentIsStaticAttachment(messageContent)
  ) {
    return `${initiatorDisplayName} sent an attachment`
  }

  if (messageContentIsReaction(messageContent)) {
    return initiatorDisplayName
      ? `${initiatorDisplayName} reacted with ${messageContent.content}`
      : `${messageContent.action} "${messageContent.content}"`
  }

  if (messageContentIsGroupUpdated(messageContent)) {
    // Handle metadata changes
    if (messageContent.metadataFieldsChanged.length > 0) {
      if (messageContent.metadataFieldsChanged.length === 1) {
        const change = messageContent.metadataFieldsChanged[0]
        switch (change.fieldName) {
          case "group_name":
          case "name":
            return `${initiatorDisplayName} changed group name to ${change.newValue}`
          case "description":
            return `${initiatorDisplayName} changed description to ${change.newValue}`
          case "group_image_url_square":
            return `${initiatorDisplayName} changed group image`
          default:
            return `${initiatorDisplayName} updated the group`
        }
      }

      // For multiple metadata changes or when no display name is available
      if (!initiatorDisplayName) {
        return messageContent.metadataFieldsChanged
          .map((field) => {
            if (field.fieldName === "name" || field.fieldName === "group_name") {
              return `Group name changed from "${field.oldValue}" to "${field.newValue}"`
            }
            return `${field.fieldName} updated`
          })
          .join(", ")
      }

      return `${initiatorDisplayName} updated the group`
    }

    // Handle member changes
    if (messageContent.membersAdded.length > 0) {
      if (
        messageContent.membersAdded.length === 1 &&
        initiatorDisplayName &&
        addedMemberDisplayInfos.length > 0
      ) {
        const memberName = addedMemberDisplayInfos[0]?.displayName ?? "someone"
        return `${initiatorDisplayName} added ${memberName}`
      }
      return initiatorDisplayName
        ? `${initiatorDisplayName} added ${messageContent.membersAdded.length} member${messageContent.membersAdded.length === 1 ? "" : "s"}`
        : `Added ${messageContent.membersAdded.length} member${messageContent.membersAdded.length === 1 ? "" : "s"}`
    }

    if (messageContent.membersRemoved.length > 0) {
      if (
        messageContent.membersRemoved.length === 1 &&
        initiatorDisplayName &&
        removedMemberDisplayInfos.length > 0
      ) {
        const memberName = removedMemberDisplayInfos[0]?.displayName ?? "someone"
        return `${initiatorDisplayName} removed ${memberName}`
      }
      return initiatorDisplayName
        ? `${initiatorDisplayName} removed ${messageContent.membersRemoved.length} member${messageContent.membersRemoved.length === 1 ? "" : "s"}`
        : `Removed ${messageContent.membersRemoved.length} member${messageContent.membersRemoved.length === 1 ? "" : "s"}`
    }

    return "Group updated"
  }

  if (messageContentIsMultiRemoteAttachment(messageContent)) {
    return `${initiatorDisplayName} sent an attachment`
  }

  if (messageContentIsReply(messageContent)) {
    return `${initiatorDisplayName} replied: ${getMessageContentStringValue({
      messageContent: messageContent.content,
      initiatorDisplayName,
    })}`
  }

  captureError(
    new GenericError({
      error: new Error("Unhandled message content type in getMessageContentStringValue"),
    }),
  )
  const _exhaustiveCheck: never = messageContent
  return "Unknown message type"
}

export async function ensureMessageContentStringValue(message: IConversationMessage) {
  const [
    { displayName: initiatorDisplayName = "Someone" },
    addedMemberDisplayInfos,
    removedMemberDisplayInfos,
  ] = await Promise.all([
    messageIsFromCurrentSenderInboxId({ message })
      ? { displayName: "You" }
      : ensurePreferredDisplayInfo({
          inboxId: message.senderInboxId,
        }),
    isGroupUpdatedMessage(message)
      ? Promise.all(
          message.content.membersAdded.map((m) =>
            ensurePreferredDisplayInfo({
              inboxId: m.inboxId,
            }),
          ),
        )
      : Promise.resolve([]),
    isGroupUpdatedMessage(message)
      ? Promise.all(
          message.content.membersRemoved.map((m) =>
            ensurePreferredDisplayInfo({
              inboxId: m.inboxId,
            }),
          ),
        )
      : Promise.resolve([]),
  ])

  return getMessageContentStringValue({
    messageContent: message.content,
    initiatorDisplayName,
    addedMemberDisplayInfos,
    removedMemberDisplayInfos,
  })
}

export function useMessageContentStringValue(message: IConversationMessage | undefined) {
  const initiatorInboxId =
    message?.senderInboxId ??
    (message && isGroupUpdatedMessage(message) ? message.content.initiatedByInboxId : undefined)

  const { displayName: initiatorDisplayName = "Someone" } = usePreferredDisplayInfo({
    inboxId: initiatorInboxId,
  })

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
  })

  const removedMemberDisplayInfos = usePreferredDisplayInfoBatch({
    xmtpInboxIds: removedMemberInboxIds,
  })

  return useMemo(() => {
    if (!message) {
      return ""
    }

    try {
      return getMessageContentStringValue({
        messageContent: message.content,
        initiatorDisplayName: messageIsFromCurrentSenderInboxId({ message })
          ? "You"
          : initiatorDisplayName,
        addedMemberDisplayInfos,
        removedMemberDisplayInfos,
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
  }, [message, initiatorDisplayName, addedMemberDisplayInfos, removedMemberDisplayInfos])
}
