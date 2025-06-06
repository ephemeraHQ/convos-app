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
  getDebugInformation,
  getNetworkDebugInformation,
  prepareMessage,
  publishPreparedMessages,
} from "@xmtp/react-native-sdk"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { getXmtpClientByInboxId } from "../xmtp-client/xmtp-client"

export const CONVERSATION_TOPIC_PREFIX = "/xmtp/mls/1/g-"

export async function getXmtpConversation(args: {
  clientInboxId: IXmtpInboxId
  conversationId: IXmtpConversationId
}) {
  const { clientInboxId, conversationId } = args

  try {
    const conversation = await wrapXmtpCallWithDuration(
      `findConversation-${conversationId}`,
      async () => {
        const client = await getXmtpClientByInboxId({
          inboxId: clientInboxId,
        })
        return client.conversations.findConversation(conversationId)
      },
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

    await wrapXmtpCallWithDuration("publishPreparedMessages", () =>
      publishPreparedMessages(client.installationId, conversationId),
    )
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
  return conversation.version === ConversationVersion.DM
}

export const getXmtpConversationIdFromXmtpTopic = (xmtpTopic: IXmtpConversationTopic) => {
  return xmtpTopic
    .replace(CONVERSATION_TOPIC_PREFIX, "")
    .replace("/proto", "") as IXmtpConversationId
}

// "/xmtp/mls/1/g-<conversationId>/proto"
export function getXmtpConversationTopicFromXmtpId(xmtpConversationId: IXmtpConversationId) {
  return `${CONVERSATION_TOPIC_PREFIX}${xmtpConversationId}/proto` as IXmtpConversationTopic
}

export async function getXmtpDebugInformationConversation(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}) {
  const { clientInboxId, xmtpConversationId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    const conversationDebugInformation = await getDebugInformation(
      client.installationId,
      xmtpConversationId,
    )

    return conversationDebugInformation
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to get conversation debug information for inbox ${clientInboxId}`,
    })
  }
}

export async function getXmtpDebugInformationNetwork(args: { clientInboxId: IXmtpInboxId }) {
  const { clientInboxId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    const networkDebugInformation = await getNetworkDebugInformation(client.installationId)

    return networkDebugInformation
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to get network debug information for inbox ${clientInboxId}`,
    })
  }
}
