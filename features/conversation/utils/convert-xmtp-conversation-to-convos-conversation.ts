import { convertConsentStateToXmtpConsentState } from "@/features/consent/consent.utils"
import { convertXmtpMessageToConvosMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/convert-xmtp-message-to-convos-message"
import { IConversation } from "@/features/conversation/conversation.types"
import { IDm } from "@/features/dm/dm.types"
import { IGroup } from "@/features/groups/group.types"
import { convertXmtpGroupMemberToConvosMember } from "@/features/groups/utils/convert-xmtp-group-member-to-convos-member"
import { getXmtpConsentStateForConversation } from "@/features/xmtp/xmtp-consent/xmtp-consent"
import {
  getXmtpCreatorInboxId,
  isXmtpConversationGroup,
} from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { getXmtpDmPeerInboxId } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-dm"
import {
  getIsXmtpGroupActive,
  getXmtpGroupMembers,
} from "@/features/xmtp/xmtp-conversations/xmtp-conversations-group"
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
  const conversationClientInboxId = xmtpConversation.client.inboxId as unknown as IXmtpInboxId

  // Group conversation
  if (isXmtpConversationGroup(xmtpConversation)) {
    const [lastMessage, members, creatorInboxId, consentState, isActive] = await Promise.all([
      getLastMessageForConversation({
        xmtpConversation,
        clientInboxId: conversationClientInboxId,
      }),
      // For now don't fetch members if the conversation is not allowed. It's too heavy for nothing
      xmtpConversation.state === "allowed"
        ? getXmtpGroupMembers({
            clientInboxId: conversationClientInboxId,
            xmtpConversationId: xmtpConversation.id,
          })
        : Promise.resolve(undefined),
      // For now don't fetch creator if the conversation is not allowed. It's too heavy for nothing
      xmtpConversation.state === "allowed"
        ? getXmtpCreatorInboxId({
            clientInboxId: conversationClientInboxId,
            xmtpConversationId: xmtpConversation.id,
          })
        : Promise.resolve(undefined),
      xmtpConversation.state ??
        getXmtpConsentStateForConversation({
          clientInboxId: conversationClientInboxId,
          xmtpConversationId: xmtpConversation.id,
        }),
      xmtpConversation.isGroupActive ??
        getIsXmtpGroupActive({
          clientInboxId: conversationClientInboxId,
          xmtpConversationId: xmtpConversation.id,
        }),
    ])

    const conversationConsentState = convertConsentStateToXmtpConsentState(consentState)
    const addedByInboxId = xmtpConversation.addedByInboxId as unknown as IXmtpInboxId

    return {
      type: "group",
      lastMessage,
      creatorInboxId,
      addedByInboxId,
      xmtpId: xmtpConversation.id,
      xmtpTopic: xmtpConversation.topic,
      consentState: conversationConsentState,
      name: xmtpConversation.groupName,
      description: xmtpConversation.groupDescription,
      imageUrl: xmtpConversation.groupImageUrl,
      members: members
        ? entify(members.map(convertXmtpGroupMemberToConvosMember), (member) => member.inboxId)
        : undefined,
      createdAt: xmtpConversation.createdAt,
      isActive: isActive,
    } satisfies IGroup
  }

  // DM conversations
  const [lastMessage, peerInboxId, consentState] = await Promise.all([
    getLastMessageForConversation({
      xmtpConversation,
      clientInboxId: conversationClientInboxId,
    }),
    getXmtpDmPeerInboxId({
      clientInboxId: conversationClientInboxId,
      xmtpConversationId: xmtpConversation.id,
    }),
    xmtpConversation.state ??
      getXmtpConsentStateForConversation({
        clientInboxId: conversationClientInboxId,
        xmtpConversationId: xmtpConversation.id,
      }),
  ])

  const conversationConsentState = convertConsentStateToXmtpConsentState(consentState)

  return {
    type: "dm",
    peerInboxId,
    lastMessage,
    xmtpId: xmtpConversation.id,
    createdAt: xmtpConversation.createdAt,
    xmtpTopic: xmtpConversation.topic,
    consentState: conversationConsentState,
    isActive: true,
  } satisfies IDm
}

async function getLastMessageForConversation(args: {
  xmtpConversation: IXmtpConversationWithCodecs
  clientInboxId: IXmtpInboxId
}) {
  const { xmtpConversation, clientInboxId } = args

  const conversationXmtpLastMessage = xmtpConversation.lastMessage

  if (conversationXmtpLastMessage) {
    return convertXmtpMessageToConvosMessage(conversationXmtpLastMessage as IXmtpDecodedMessage)
  }

  // Only fetch fallback if the conversation is allowed
  if (xmtpConversation.state === "allowed") {
    return getXmtpLastMessageFromMessages({
      clientInboxId,
      xmtpConversationId: xmtpConversation.id,
    })
  }

  return undefined
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
