import { conversationMessages, processMessage } from "@xmtp/react-native-sdk"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import {
  isXmtpGroupUpdatedContentType,
  isXmtpMultiRemoteAttachmentContentType,
  isXmtpReactionContentType,
  isXmtpRemoteAttachmentContentType,
  isXmtpReplyContentType,
  isXmtpStaticAttachmentContentType,
  isXmtpTextContentType,
} from "@/features/xmtp/xmtp-codecs/xmtp-codecs"
import { isSupportedXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages-supported"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import {
  IXmtpConversationId,
  IXmtpDecodedGroupUpdatedMessage,
  IXmtpDecodedMessage,
  IXmtpDecodedMultiRemoteAttachmentMessage,
  IXmtpDecodedReactionMessage,
  IXmtpDecodedRemoteAttachmentMessage,
  IXmtpDecodedReplyMessage,
  IXmtpDecodedStaticAttachmentMessage,
  IXmtpDecodedTextMessage,
  IXmtpInboxId,
  IXmtpMessageId,
} from "../xmtp.types"

// Caches for active promises
const activeGetMessagesPromises = new Map<string, Promise<IXmtpDecodedMessage[]>>()
const activeGetMessagePromises = new Map<string, Promise<IXmtpDecodedMessage | null>>()
const activeDecryptPromises = new Map<string, Promise<IXmtpDecodedMessage>>()

export async function getXmtpConversationMessages(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
  limit: number
  afterNs?: number
  beforeNs?: number
  direction?: "next" | "prev"
}) {
  const { clientInboxId, xmtpConversationId, limit, afterNs, beforeNs, direction = "next" } = args
  const promiseKey = `${clientInboxId}-${xmtpConversationId}-${limit}-${afterNs ?? "null"}-${beforeNs ?? "null"}-${direction}`
  const existingPromise = activeGetMessagesPromises.get(promiseKey)
  if (existingPromise) {
    return existingPromise
  }

  const promise = (async () => {
    try {
      const client = await getXmtpClientByInboxId({
        inboxId: clientInboxId,
      })

      const messages = await wrapXmtpCallWithDuration("conversationMessages", () =>
        conversationMessages(
          client.installationId,
          xmtpConversationId,
          limit,
          beforeNs,
          afterNs,
          direction === "next" ? "DESCENDING" : "ASCENDING",
        ),
      )

      return messages.filter(isSupportedXmtpMessage)
    } catch (error) {
      throw new XMTPError({
        error,
        additionalMessage: `Error fetching messages for xmtpConversationId ${xmtpConversationId}`,
      })
    } finally {
      activeGetMessagesPromises.delete(promiseKey)
    }
  })()

  activeGetMessagesPromises.set(promiseKey, promise)
  return promise
}

export async function getXmtpConversationMessage(args: {
  messageId: IXmtpMessageId
  clientInboxId: IXmtpInboxId
}) {
  const { messageId, clientInboxId } = args
  const promiseKey = `${clientInboxId}-${messageId}`
  const existingPromise = activeGetMessagePromises.get(promiseKey)
  if (existingPromise) {
    return existingPromise
  }

  const promise = (async () => {
    try {
      const client = await getXmtpClientByInboxId({
        inboxId: clientInboxId,
      })

      const message =
        (await wrapXmtpCallWithDuration("findMessage", () =>
          client.conversations.findMessage(messageId),
        )) ?? null

      return message
    } catch (error) {
      throw new XMTPError({
        error,
        additionalMessage: `Error finding message ${messageId}`,
      })
    } finally {
      activeGetMessagePromises.delete(promiseKey)
    }
  })()

  activeGetMessagePromises.set(promiseKey, promise)
  return promise
}

export async function decryptXmtpMessage(args: {
  encryptedMessage: string
  xmtpConversationId: IXmtpConversationId
  clientInboxId: IXmtpInboxId
}) {
  const { encryptedMessage, xmtpConversationId, clientInboxId } = args
  // Using a portion of the encrypted message for the key to avoid overly long keys
  // and potential performance issues with map lookups if messages are very large.
  // Hashing would be more robust but adds complexity; a substring is a simpler approach.
  const messageSnippet = encryptedMessage.substring(0, Math.min(encryptedMessage.length, 50))
  const promiseKey = `${clientInboxId}-${xmtpConversationId}-${messageSnippet}`
  const existingPromise = activeDecryptPromises.get(promiseKey)

  if (existingPromise) {
    return existingPromise
  }

  const promise = (async () => {
    try {
      const client = await getXmtpClientByInboxId({
        inboxId: clientInboxId,
      })

      const message = await wrapXmtpCallWithDuration("processMessage", () =>
        processMessage(client.installationId, xmtpConversationId, encryptedMessage),
      )

      return message
    } catch (error) {
      throw new XMTPError({
        error,
        additionalMessage: `Error decrypting message for conversation ${xmtpConversationId}`,
      })
    } finally {
      activeDecryptPromises.delete(promiseKey)
    }
  })()

  activeDecryptPromises.set(promiseKey, promise)
  return promise
}

export function getXmtpMessageIsTextMessage(
  message: IXmtpDecodedMessage,
): message is IXmtpDecodedTextMessage {
  return isXmtpTextContentType(message.contentTypeId)
}

export function getXmtpMessageIsReactionMessage(
  message: IXmtpDecodedMessage,
): message is IXmtpDecodedReactionMessage {
  return isXmtpReactionContentType(message.contentTypeId)
}

export function getXmtpMessageIsReplyMessage(
  message: IXmtpDecodedMessage,
): message is IXmtpDecodedReplyMessage {
  return isXmtpReplyContentType(message.contentTypeId)
}

export function getXmtpMessageIsGroupUpdatedMessage(
  message: IXmtpDecodedMessage,
): message is IXmtpDecodedGroupUpdatedMessage {
  return isXmtpGroupUpdatedContentType(message.contentTypeId)
}

export function getXmtpMessageIsMultiRemoteAttachmentMessage(
  message: IXmtpDecodedMessage,
): message is IXmtpDecodedMultiRemoteAttachmentMessage {
  return isXmtpMultiRemoteAttachmentContentType(message.contentTypeId)
}

export function getXmtpMessageIsStaticAttachmentMessage(
  message: IXmtpDecodedMessage,
): message is IXmtpDecodedStaticAttachmentMessage {
  return isXmtpStaticAttachmentContentType(message.contentTypeId)
}

export function getXmtpMessageIsRemoteAttachmentMessage(
  message: IXmtpDecodedMessage,
): message is IXmtpDecodedRemoteAttachmentMessage {
  return isXmtpRemoteAttachmentContentType(message.contentTypeId)
}
