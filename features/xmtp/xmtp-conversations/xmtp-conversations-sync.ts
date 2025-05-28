import { ConsentState, syncAllConversations, syncConversation } from "@xmtp/react-native-sdk"
import { create, windowScheduler } from "@yornaath/batshit"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { getUniqueItemsByKey } from "@/utils/array"
import { XMTPError } from "@/utils/error"
import { getXmtpClientByInboxId } from "../xmtp-client/xmtp-client"

const DEBOUNCE_MS = 100
const SYNC_ALL_THRESHOLD = 5

// Cache to prevent multiple syncAll operations for the same inbox
const syncAllConversationsPromisesCache = new Map<IXmtpInboxId, Promise<void>>()
// Cache to deduplicate identical, concurrent calls to syncOneXmtpConversation
const activeSyncOnePromises = new Map<`${IXmtpInboxId}-${IXmtpConversationId}`, Promise<void>>()

// Store for batcher instances, one per clientInboxId
const conversationSyncBatchersByInboxId = new Map<
  IXmtpInboxId,
  ReturnType<typeof createConversationSyncBatcher>
>()

function createConversationSyncBatcher(clientInboxId: IXmtpInboxId) {
  return create({
    name: `conversation-syncer-${clientInboxId}`,
    fetcher: async (
      itemsToSync: Array<{ conversationId: IXmtpConversationId; caller: string }>,
    ) => {
      if (itemsToSync.length === 0) {
        return Promise.resolve()
      }

      const client = await getXmtpClientByInboxId({ inboxId: clientInboxId })
      const uniqueConversationsWithCallers = getUniqueItemsByKey(itemsToSync, "conversationId")

      try {
        if (uniqueConversationsWithCallers.length >= SYNC_ALL_THRESHOLD) {
          const callers = itemsToSync.map((item) => item.caller).join(", ") || "unknown"
          await wrapXmtpCallWithDuration(
            `syncAllConversations (${callers}) for ${uniqueConversationsWithCallers.length} convos via batch`,
            () =>
              syncAllConversations(
                client.installationId,
                // NEVER add more than allowed here, it's useless and dangerous
                ["allowed"],
              ),
          )
        } else {
          // Perform individual syncs
          await Promise.all(
            uniqueConversationsWithCallers.map(({ conversationId, caller }) =>
              wrapXmtpCallWithDuration(
                `syncConversation ${conversationId} (${caller}) (via batch)`,
                () => syncConversation(client.installationId, conversationId),
              ),
            ),
          )
        }
      } catch (error) {
        throw new XMTPError({
          error,
          additionalMessage: `Failed to sync conversations batch for inbox ${clientInboxId}`,
        })
      }
    },
    scheduler: windowScheduler(DEBOUNCE_MS),
    resolver: () => {}, // No need resolver because we're not returning anything
  })
}

function getConversationSyncBatcher(clientInboxId: IXmtpInboxId) {
  let batcher = conversationSyncBatchersByInboxId.get(clientInboxId)
  if (!batcher) {
    batcher = createConversationSyncBatcher(clientInboxId)
    conversationSyncBatchersByInboxId.set(clientInboxId, batcher)
  }
  return batcher
}

export async function syncOneXmtpConversation(args: {
  clientInboxId: IXmtpInboxId
  conversationId: IXmtpConversationId
  caller: string
}) {
  const { clientInboxId, conversationId, caller } = args
  const promiseKey = `${clientInboxId}-${conversationId}` as const
  const existingActivePromise = activeSyncOnePromises.get(promiseKey)
  if (existingActivePromise) {
    return existingActivePromise
  }

  const batcher = getConversationSyncBatcher(clientInboxId)
  const promise = batcher.fetch({ conversationId, caller })
  activeSyncOnePromises.set(promiseKey, promise)

  return promise.finally(() => {
    activeSyncOnePromises.delete(promiseKey)
  })
}

export async function syncAllXmtpConversations(args: {
  clientInboxId: IXmtpInboxId
  caller: string
}) {
  const { clientInboxId, caller } = args

  const existingSyncPromise = syncAllConversationsPromisesCache.get(clientInboxId)
  if (existingSyncPromise) {
    return existingSyncPromise
  }

  const syncPromise = (async () => {
    try {
      const client = await getXmtpClientByInboxId({
        inboxId: clientInboxId,
      })
      await wrapXmtpCallWithDuration(`syncAllConversations (${caller})`, () =>
        syncAllConversations(
          client.installationId,
          // NEVER add more than allowed here, it's useless and dangerous
          ["allowed"],
        ),
      )
    } catch (error) {
      throw new XMTPError({
        error,
        additionalMessage: `Failed to sync all conversations for inbox: ${clientInboxId}`,
      })
    } finally {
      syncAllConversationsPromisesCache.delete(clientInboxId)
    }
  })()

  syncAllConversationsPromisesCache.set(clientInboxId, syncPromise)
  return syncPromise
}

export async function syncNewXmtpConversations(args: {
  clientInboxId: IXmtpInboxId
  caller: string
}) {
  const { clientInboxId, caller } = args

  try {
    const client = await getXmtpClientByInboxId({ inboxId: clientInboxId })

    await wrapXmtpCallWithDuration(`client.conversations.sync (${caller})`, () =>
      client.conversations.sync(),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to sync new conversations for inbox: ${clientInboxId}`,
    })
  }
}
