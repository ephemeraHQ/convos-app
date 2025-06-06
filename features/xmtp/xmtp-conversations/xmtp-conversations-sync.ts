import { syncAllConversations, syncConversation } from "@xmtp/react-native-sdk"
import { create, windowScheduler } from "@yornaath/batshit"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { getUniqueItemsByKey } from "@/utils/array"
import { XMTPError } from "@/utils/error"
import { createPromiseCache } from "@/utils/promise-cache"
import { getXmtpClientByInboxId } from "../xmtp-client/xmtp-client"

const DEBOUNCE_MS = 100
const SYNC_ALL_THRESHOLD = 5

// Store for batcher instances, one per clientInboxId
const conversationSyncBatchersByInboxId = new Map<
  IXmtpInboxId,
  ReturnType<typeof createConversationSyncBatcher>
>()

// Create caches for different types of operations
const syncOneConversationCache = createPromiseCache<void>({
  maxSize: 50,
  ttlMs: 0, // Because if we call it, it means we want to sync it now, so we don't want to cache it
})

const syncAllConversationsCache = createPromiseCache<void>({
  maxSize: 50,
  ttlMs: 0, // Because if we call it, it means we want to sync it now, so we don't want to cache it
})

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
                // Otherwise it will sync all conversations, including those that are not allowed
                // and if a spammer decides to create 100000 groups with us, then all of those will get synced every time
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
  xmtpConversationId: IXmtpConversationId
  caller: string
}) {
  const { clientInboxId, xmtpConversationId, caller } = args
  const key = `${clientInboxId}-${xmtpConversationId}`

  return syncOneConversationCache.getOrCreate({
    key,
    fn: async () => {
      const batcher = getConversationSyncBatcher(clientInboxId)
      return batcher.fetch({ conversationId: xmtpConversationId, caller })
    },
  })
}

export async function syncAllXmtpConversations(args: {
  clientInboxId: IXmtpInboxId
  caller: string
}) {
  const { clientInboxId, caller } = args

  return syncAllConversationsCache.getOrCreate({
    key: clientInboxId,
    fn: async () => {
      const client = await getXmtpClientByInboxId({
        inboxId: clientInboxId,
      })
      await wrapXmtpCallWithDuration(`syncAllConversations (${caller})`, () =>
        syncAllConversations(
          client.installationId,
          // NEVER add more than allowed here, it's useless and dangerous
          // Otherwise it will sync all conversations, including those that are not allowed
          // and if a spammer decides to create 100000 groups with us, then all of those will get synced every time
          ["allowed"],
        ),
      )
    },
  })
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
