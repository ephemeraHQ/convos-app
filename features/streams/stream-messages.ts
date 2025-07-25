import { processReactionConversationMessages } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-reactions.query"
import { setConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import {
  isGroupUpdatedMessage,
  isReactionMessage,
} from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { addConversationMessage } from "@/features/conversation/conversation-chat/conversation-messages-simple.query"
import {
  getConversationQueryData,
  invalidateConversationQuery,
} from "@/features/conversation/queries/conversation.query"
import { isConversationGroup } from "@/features/conversation/utils/is-conversation-group"
import { invalidateDisappearingMessageSettings } from "@/features/disappearing-messages/disappearing-message-settings.query"
import { IGroup } from "@/features/groups/group.types"
import {
  addGroupMemberToGroupQueryData,
  removeGroupMemberToGroupQuery,
  updateGroupQueryData,
} from "@/features/groups/queries/group.query"
import { streamAllMessages } from "@/features/xmtp/xmtp-messages/xmtp-messages-stream"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { StreamError } from "@/utils/error"
import {
  IConversationMessage,
  IConversationMessageGroupUpdated,
  IGroupUpdatedMetadataEntryFieldName,
} from "../conversation/conversation-chat/conversation-message/conversation-message.types"
import { convertXmtpMessageToConvosMessage } from "../conversation/conversation-chat/conversation-message/utils/convert-xmtp-message-to-convos-message"

export async function startMessageStreaming(args: { clientInboxId: IXmtpInboxId }) {
  const { clientInboxId } = args

  try {
    await streamAllMessages({
      inboxId: clientInboxId,
      onNewMessage: (message) =>
        handleNewMessage({ clientInboxId, message: convertXmtpMessageToConvosMessage(message) }),
    })
  } catch (error) {
    throw new StreamError({
      error,
      additionalMessage: `Failed to stream messages for ${clientInboxId}`,
    })
  }
}

async function handleNewMessage(args: {
  clientInboxId: IXmtpInboxId
  message: IConversationMessage
}) {
  const { clientInboxId, message } = args

  // Process reaction messages
  if (isReactionMessage(message)) {
    processReactionConversationMessages({ clientInboxId, reactionMessages: [message] })
    return
  }

  setConversationMessageQueryData({
    clientInboxId,
    xmtpMessageId: message.xmtpId,
    xmtpConversationId: message.xmtpConversationId,
    message,
  })

  // Handle group update messages
  if (isGroupUpdatedMessage(message)) {
    try {
      handleNewConversationUpdatedMessage({
        clientInboxId,
        message,
      })
    } catch (error) {
      captureError(
        new StreamError({ error, additionalMessage: "Error handling new group updated message" }),
      )
    }
  }

  // Add the message in conversation messages list
  try {
    // XMTP sometimes send group updates that are emtpy
    if (isGroupUpdatedMessage(message) && isEmptyGroupUpdatedMessage(message)) {
      return
    }

    addConversationMessage({
      clientInboxId,
      xmtpConversationId: message.xmtpConversationId,
      messageIds: [message.xmtpId],
      caller: "handleNewMessage",
    })
  } catch (error) {
    captureError(new StreamError({ error, additionalMessage: "Error handling new message" }))
  }
}

function isEmptyGroupUpdatedMessage(message: IConversationMessageGroupUpdated) {
  return (
    message.content.membersAdded.length === 0 &&
    message.content.membersRemoved.length === 0 &&
    message.content.metadataFieldsChanged.length === 0
  )
}

// XMTP doesn't have typing yet
const METADATA_FIELD_NAME_MAP_TO_GROUP_PROPERTY_NAME: Record<
  IGroupUpdatedMetadataEntryFieldName,
  keyof IGroup | null
> = {
  group_name: "name",
  group_image_url_square: "imageUrl",
  description: "description",
  message_disappear_from_ns: "messageDisappearFromNs",
  message_disappear_in_ns: null, // For now there is no group property for this in XMTP
} as const

function handleNewConversationUpdatedMessage(args: {
  clientInboxId: IXmtpInboxId
  message: IConversationMessageGroupUpdated
}) {
  const { clientInboxId, message } = args

  const conversation = getConversationQueryData({
    clientInboxId,
    xmtpConversationId: message.xmtpConversationId,
  })

  // If no changes, just invalidate the group query data
  if (isEmptyGroupUpdatedMessage(message)) {
    invalidateConversationQuery({
      clientInboxId,
      xmtpConversationId: message.xmtpConversationId,
    }).catch(captureError)
    return
  }

  // Add/Remove group members
  if (conversation && isConversationGroup(conversation)) {
    for (const member of message.content.membersAdded) {
      addGroupMemberToGroupQueryData({
        clientInboxId,
        xmtpConversationId: message.xmtpConversationId,
        member: {
          inboxId: member.inboxId,
          consentState: "unknown",
          permission: "member",
        },
      }).catch(captureError)
    }

    // Remove members
    for (const member of message.content.membersRemoved) {
      removeGroupMemberToGroupQuery({
        clientInboxId,
        xmtpConversationId: message.xmtpConversationId,
        memberInboxId: member.inboxId,
      }).catch(captureError)

      // If the removed member is the current user
      if (member.inboxId === clientInboxId) {
        // To make sure we refetch the right conversation state
        invalidateConversationQuery({
          clientInboxId,
          xmtpConversationId: message.xmtpConversationId,
        }).catch(captureError)
      }
    }
  }

  // Process metadata changes (e.g., group name, image, description, disappearing messages)
  if (message.content.metadataFieldsChanged.length > 0) {
    const disappearingMessageFields = message.content.metadataFieldsChanged.filter(
      (field) => field.fieldName === "message_disappear_in_ns",
    )

    if (disappearingMessageFields.length > 0) {
      invalidateDisappearingMessageSettings({
        clientInboxId,
        xmtpConversationId: message.xmtpConversationId,
        caller: "handleNewGroupUpdatedMessage",
      }).catch(captureError)
    }

    // Group metadata changes
    if (conversation && isConversationGroup(conversation)) {
      const groupUpdateFields = message.content.metadataFieldsChanged.filter(
        (field) => field.fieldName !== "message_disappear_in_ns",
      )

      const groupUpdates: Partial<IGroup> = {}

      groupUpdateFields.forEach((field) => {
        // Check if field is supported in our mapping
        const groupPropertyName = METADATA_FIELD_NAME_MAP_TO_GROUP_PROPERTY_NAME[field.fieldName]

        if (groupPropertyName === undefined) {
          captureError(
            new StreamError({
              error: new Error(`Unsupported metadata field name: ${field.fieldName}`),
            }),
          )
          return
        }

        if (groupPropertyName === null) {
          // Not handling for now
          return
        }

        // Update group data with the new field value
        // @ts-ignore
        groupUpdates[groupPropertyName] = field.newValue
      })

      if (Object.keys(groupUpdates).length > 0) {
        updateGroupQueryData({
          clientInboxId,
          xmtpConversationId: message.xmtpConversationId,
          updates: groupUpdates,
        })
      }
    }
  }
}
