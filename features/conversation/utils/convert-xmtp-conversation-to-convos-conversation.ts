import { convertConsentStateToXmtpConsentState } from "@/features/consent/consent.utils"
import { convertXmtpMessageToConvosMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/convert-xmtp-message-to-convos-message"
import { IConversation } from "@/features/conversation/conversation.types"
import { IDm } from "@/features/dm/dm.types"
import { IGroup } from "@/features/groups/group.types"
import { convertXmtpGroupMemberToConvosMember } from "@/features/groups/utils/convert-xmtp-group-member-to-convos-member"
import { isXmtpConversationGroup } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { getXmtpConversationMessages } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import {
  IXmtpConversationId,
  IXmtpConversationWithCodecs,
  IXmtpInboxId,
} from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { entify } from "@/utils/entify"
import { GenericError } from "@/utils/error"
import { logger } from "@/utils/logger/logger"

export async function convertXmtpConversationToConvosConversation(
  xmtpConversation: IXmtpConversationWithCodecs,
): Promise<IConversation> {
  // Group conversation
  if (isXmtpConversationGroup(xmtpConversation)) {
    const [members, creatorInboxId, consentState, lastMessage] = await Promise.all([
      xmtpConversation.members(),
      xmtpConversation.creatorInboxId() as unknown as IXmtpInboxId,
      xmtpConversation.consentState(),
      // TMP until we have lastMessage function available from the SDK
      xmtpConversation.lastMessage ??
        getXmtpLastMessageFromMessages({
          clientInboxId: xmtpConversation.client.inboxId as unknown as IXmtpInboxId,
          xmtpConversationId: xmtpConversation.id,
        }),
    ])

    const addedByInboxId = xmtpConversation.addedByInboxId as unknown as IXmtpInboxId

    return {
      type: "group",
      xmtpId: xmtpConversation.id,
      xmtpTopic: xmtpConversation.topic,
      consentState: convertConsentStateToXmtpConsentState(consentState),
      name: xmtpConversation.groupName,
      description: xmtpConversation.groupDescription,
      imageUrl: xmtpConversation.groupImageUrl,
      members: entify(
        members.map(convertXmtpGroupMemberToConvosMember),
        (member) => member.inboxId,
      ),
      creatorInboxId: creatorInboxId,
      addedByInboxId,
      createdAt: xmtpConversation.createdAt,
      lastMessage: lastMessage ? convertXmtpMessageToConvosMessage(lastMessage) : undefined,
    } satisfies IGroup
  }

  // DM conversations
  const [peerInboxId, consentState, lastMessage] = await Promise.all([
    xmtpConversation.peerInboxId() as unknown as IXmtpInboxId,
    xmtpConversation.consentState(),
    // TMP until we have lastMessage function available from the SDK
    xmtpConversation.lastMessage ??
      getXmtpLastMessageFromMessages({
        clientInboxId: xmtpConversation.client.inboxId as unknown as IXmtpInboxId,
        xmtpConversationId: xmtpConversation.id,
      }),
  ])

  return {
    type: "dm",
    peerInboxId,
    xmtpId: xmtpConversation.id,
    createdAt: xmtpConversation.createdAt,
    xmtpTopic: xmtpConversation.topic,
    consentState: convertConsentStateToXmtpConsentState(consentState),
    lastMessage: lastMessage ? convertXmtpMessageToConvosMessage(lastMessage) : undefined,
  } satisfies IDm
}

function getXmtpLastMessageFromMessages(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}) {
  const { clientInboxId, xmtpConversationId } = args

  logger.debug(
    `Fetching conversation messages to get last message until we have lastMessage from the SDK...`,
  )

  return getXmtpConversationMessages({
    clientInboxId,
    xmtpConversationId,
    limit: 1,
  }).then((xmtpMessages) => {
    const xmtpMessage = xmtpMessages[0]
    if (!xmtpMessage) {
      captureError(
        new GenericError({
          error: "No last message found for conversation",
        }),
      )
      return undefined
    }
    return xmtpMessage
  })
}
