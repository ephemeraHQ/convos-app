import {
  IXmtpConversationId,
  IXmtpConversationSendPayload,
  IXmtpConversationTopic,
  IXmtpConversationWithCodecs,
  IXmtpDmWithCodecs,
  IXmtpGroupWithCodecs,
  IXmtpInboxId,
} from "@features/xmtp/xmtp.types"
import {
  ConversationVersion,
  findConversation,
  prepareMessage,
  publishPreparedMessages,
} from "@xmtp/react-native-sdk"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"

export async function getXmtpConversation(args: {
  clientInboxId: IXmtpInboxId
  conversationId: IXmtpConversationId
}) {
  const { clientInboxId, conversationId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    const conversation = await wrapXmtpCallWithDuration("findConversation", () =>
      findConversation(client, conversationId),
    )

    return conversation
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to get conversation: ${conversationId}`,
    })
  }
}

export async function sendXmtpConversationMessageOptimistic(args: {
  clientInboxId: IXmtpInboxId
  conversationId: IXmtpConversationId
  content: IXmtpConversationSendPayload
}) {
  const { content, clientInboxId, conversationId } = args

  const client = await getXmtpClientByInboxId({
    inboxId: clientInboxId,
  })

  try {
    return wrapXmtpCallWithDuration("prepareMessage", () =>
      prepareMessage(client.installationId, conversationId, content),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to prepare message for conversation: ${conversationId}`,
    })
  }
}

export async function publishXmtpConversationMessages(args: {
  clientInboxId: IXmtpInboxId
  conversationId: IXmtpConversationId
}) {
  const { clientInboxId, conversationId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    await publishPreparedMessages(client.installationId, conversationId)
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Error publishing messages for conversation ${conversationId}`,
    })
  }
}

export function isXmtpConversationGroup(
  conversation: IXmtpConversationWithCodecs,
): conversation is IXmtpGroupWithCodecs {
  return conversation.version === ConversationVersion.GROUP
}

export function isXmtpConversationDm(
  conversation: IXmtpConversationWithCodecs,
): conversation is IXmtpDmWithCodecs {
  return conversation.version === ConversationVersion.GROUP
}

export const getXmtpConversationIdFromXmtpTopic = (xmtpTopic: IXmtpConversationTopic) => {
  return xmtpTopic
    .replace(CONVERSATION_TOPIC_PREFIX, "")
    .replace("/proto", "") as IXmtpConversationId
}

export function getXmtpConversationTopicFromXmtpId(xmtpId: IXmtpConversationId) {
  return `${CONVERSATION_TOPIC_PREFIX}/${xmtpId}/proto` as IXmtpConversationTopic
}

export const CONVERSATION_TOPIC_PREFIX = "/xmtp/mls/1/g-"
