import { ConsentState, syncAllConversations, syncConversation } from "@xmtp/react-native-sdk"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { XMTPError } from "@/utils/error"
import { getXmtpClientByInboxId } from "../xmtp-client/xmtp-client"

// Cache to prevent multiple sync operations for the same conversation
const syncConversationPromisesCache = new Map<
  `${IXmtpInboxId}-${IXmtpConversationId}`,
  Promise<void>
>()

// Cache to prevent multiple sync operations for the same inbox
const syncAllConversationsPromisesCache = new Map<IXmtpInboxId, Promise<void>>()

// Track the last successful sync time for each inbox
const lastSyncAllTimestamps = new Map<IXmtpInboxId, number>()

export async function syncOneXmtpConversation(args: {
  clientInboxId: IXmtpInboxId
  conversationId: IXmtpConversationId
  caller: string
}) {
  const { clientInboxId, conversationId, caller } = args

  // Create a composite key for the cache
  const cacheKey = `${clientInboxId}-${conversationId}` as const

  // Check if there's already a sync in progress for this conversation
  const existingSyncPromise = syncConversationPromisesCache.get(cacheKey)
  if (existingSyncPromise) {
    return existingSyncPromise
  }

  // Create and cache the new sync promise
  const syncPromise = (async () => {
    try {
      const client = await getXmtpClientByInboxId({
        inboxId: clientInboxId,
      })

      await wrapXmtpCallWithDuration(`syncConversation ${conversationId} (${caller})`, () =>
        syncConversation(client.installationId, conversationId),
      )
    } catch (error) {
      throw new XMTPError({
        error,
        additionalMessage: `Error syncing conversation ${conversationId}`,
      })
    } finally {
      // Always clean up the cache entry when done
      syncConversationPromisesCache.delete(cacheKey)
    }
  })()

  // Store the promise in cache
  syncConversationPromisesCache.set(cacheKey, syncPromise)

  return syncPromise
}

export async function syncAllXmtpConversations(args: {
  clientInboxId: IXmtpInboxId
  consentStates?: ConsentState[]
  caller: string
}) {
  const { clientInboxId, consentStates = ["allowed", "unknown", "denied"], caller } = args

  // Check if there's already a sync in progress for this inbox
  const existingSyncPromise = syncAllConversationsPromisesCache.get(clientInboxId)
  if (existingSyncPromise) {
    return existingSyncPromise
  }

  // Create and cache the new sync promise
  const syncPromise = (async () => {
    try {
      const client = await getXmtpClientByInboxId({
        inboxId: clientInboxId,
      })

      await wrapXmtpCallWithDuration(`syncAllConversations (${caller})`, () =>
        syncAllConversations(client.installationId, consentStates),
      )

      // Update the last successful sync timestamp
      lastSyncAllTimestamps.set(clientInboxId, Date.now())
    } catch (error) {
      throw new XMTPError({
        error,
        additionalMessage: `Failed to sync all conversations for inbox: ${clientInboxId}`,
      })
    } finally {
      // Always clean up the cache entry when done
      syncAllConversationsPromisesCache.delete(clientInboxId)
    }
  })()

  // Store the promise in cache
  syncAllConversationsPromisesCache.set(clientInboxId, syncPromise)

  return syncPromise
}
