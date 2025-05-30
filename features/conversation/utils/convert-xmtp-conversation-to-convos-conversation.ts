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
  IXmtpDecodedMessage,
  IXmtpInboxId,
} from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { entify } from "@/utils/entify"
import { GenericError } from "@/utils/error"
import { logger } from "@/utils/logger/logger"
import { measureTimeAsync } from "@/utils/perf/perf-timer"

export async function convertXmtpConversationToConvosConversation(
  xmtpConversation: IXmtpConversationWithCodecs,
): Promise<IConversation> {
  // Group conversation
  if (isXmtpConversationGroup(xmtpConversation)) {
    const [members, creatorInboxId, consentState, conversationXmtpLastMessage, isActive] =
      await Promise.all([
        xmtpConversation.members(),
        xmtpConversation.creatorInboxId() as unknown as IXmtpInboxId,
        xmtpConversation.consentState(),
        xmtpConversation.lastMessage,
        xmtpConversation.isActive(),
      ])

    // TMP until we have lastMessage function available from the SDK
    const lastMessage = conversationXmtpLastMessage
      ? convertXmtpMessageToConvosMessage(conversationXmtpLastMessage as IXmtpDecodedMessage)
      : await getXmtpLastMessageFromMessages({
          clientInboxId: xmtpConversation.client.inboxId as unknown as IXmtpInboxId,
          xmtpConversationId: xmtpConversation.id,
        })

    const addedByInboxId = xmtpConversation.addedByInboxId as unknown as IXmtpInboxId

    return {
      type: "group",
      lastMessage,
      creatorInboxId,
      addedByInboxId,
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
      createdAt: xmtpConversation.createdAt,
      isActive: isActive,
    } satisfies IGroup
  }

  // DM conversations
  const [peerInboxId, consentState, conversationXmtpLastMessage] = await Promise.all([
    xmtpConversation.peerInboxId() as unknown as IXmtpInboxId,
    xmtpConversation.consentState(),
    xmtpConversation.lastMessage,
  ])

  // TMP until we have lastMessage function available from the SDK
  const lastMessage = conversationXmtpLastMessage
    ? convertXmtpMessageToConvosMessage(conversationXmtpLastMessage as IXmtpDecodedMessage)
    : await getXmtpLastMessageFromMessages({
        clientInboxId: xmtpConversation.client.inboxId as unknown as IXmtpInboxId,
        xmtpConversationId: xmtpConversation.id,
      })

  return {
    type: "dm",
    peerInboxId,
    lastMessage,
    xmtpId: xmtpConversation.id,
    createdAt: xmtpConversation.createdAt,
    xmtpTopic: xmtpConversation.topic,
    consentState: convertConsentStateToXmtpConsentState(consentState),
    isActive: true,
  } satisfies IDm
}

async function getXmtpLastMessageFromMessages(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}) {
  const { clientInboxId, xmtpConversationId } = args

  try {
    const { result, durationMs } = await measureTimeAsync(async () => {
      const xmtpMessages = await getXmtpConversationMessages({
        clientInboxId,
        xmtpConversationId,
        limit: 1,
      })

      const lastMessage = xmtpMessages[0]

      return lastMessage ? convertXmtpMessageToConvosMessage(lastMessage) : undefined

      /**
       * Doing this like this creates some kind of weird infinite loop when the function "convertXmtpConversationToConvosConversation" is getting called from "createConversationAndSendFirstMessage"
       */
      // const conversationMessagesData = await ensureConversationMessagesInfiniteQueryData({
      //   clientInboxId,
      //   xmtpConversationId,
      //   caller: `get-xmtp-last-message-from-messages`,
      // })

      // const firstMessageId = conversationMessagesData.pages[0].messageIds[0]

      // if (!firstMessageId) {
      //   logger.debug(
      //     `No last message found for conversation ${xmtpConversationId}, returning undefined`,
      //   )
      //   return undefined
      // }

      // const fullMessage = await ensureConversationMessageQueryData({
      //   clientInboxId,
      //   xmtpMessageId: firstMessageId,
      //   xmtpConversationId,
      //   caller: `get-xmtp-last-message-from-messages`,
      // })

      // if (!fullMessage) {
      //   logger.debug(
      //     `No last message found for conversation ${xmtpConversationId}, returning undefined`,
      //   )
      //   return undefined
      // }

      // return fullMessage
    })

    logger.debug(
      `Fetched last message fallback for conversation ${xmtpConversationId} in ${durationMs}ms`,
    )

    return result
  } catch (error) {
    captureError(
      new GenericError({
        error,
        additionalMessage: `Error fetching last message fallback for conversation ${xmtpConversationId}`,
      }),
    )
    return undefined
  }
}
