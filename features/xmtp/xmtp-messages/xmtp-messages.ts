import {
  conversationMessages,
  conversationMessagesWithReactions,
  processMessage,
} from "@xmtp/react-native-sdk"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { ISupportedXmtpCodecs } from "@/features/xmtp/xmtp-codecs/xmtp-codecs"
import { isSupportedXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages-supported"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import {
  IXmtpConversationId,
  IXmtpDecodedMessage,
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

      const messages = (await wrapXmtpCallWithDuration(
        `conversationMessages ${xmtpConversationId}`,
        () =>
          conversationMessages<ISupportedXmtpCodecs>(
            client.installationId,
            xmtpConversationId,
            limit,
            beforeNs,
            afterNs,
            direction === "next" ? "DESCENDING" : "ASCENDING",
          ),
      )) as unknown as IXmtpDecodedMessage[]

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

export async function getXmtpConversationMessagesWithReactions(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
  limit: number
  afterNs?: number
  beforeNs?: number
  direction?: "next" | "prev"
}) {
  const { clientInboxId, xmtpConversationId, limit, afterNs, beforeNs, direction = "next" } = args
  const promiseKey = `${clientInboxId}-${xmtpConversationId}-${limit}-${afterNs ?? "null"}-${beforeNs ?? "null"}-${direction}-reactions`
  const existingPromise = activeGetMessagesPromises.get(promiseKey)
  if (existingPromise) {
    return existingPromise
  }

  const promise = (async () => {
    try {
      const client = await getXmtpClientByInboxId({
        inboxId: clientInboxId,
      })

      const messages = (await wrapXmtpCallWithDuration(
        `conversationMessagesWithReactions ${xmtpConversationId}`,
        () =>
          conversationMessagesWithReactions<ISupportedXmtpCodecs>(
            client.installationId,
            xmtpConversationId,
            limit,
            beforeNs,
            afterNs,
            direction === "next" ? "DESCENDING" : "ASCENDING",
          ),
      )) as unknown as IXmtpDecodedMessage[]

      return messages.filter(isSupportedXmtpMessage)
    } catch (error) {
      throw new XMTPError({
        error,
        additionalMessage: `Error fetching messages with reactions for xmtpConversationId ${xmtpConversationId}`,
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

      return message as unknown as IXmtpDecodedMessage | null
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

      const message = (await wrapXmtpCallWithDuration("processMessage", () =>
        processMessage<ISupportedXmtpCodecs>(
          client.installationId,
          xmtpConversationId,
          encryptedMessage,
        ),
      )) as unknown as IXmtpDecodedMessage

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
