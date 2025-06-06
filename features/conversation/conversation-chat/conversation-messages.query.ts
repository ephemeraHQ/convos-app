import {
  InfiniteData,
  InfiniteQueryObserver,
  infiniteQueryOptions,
  Optional,
  useInfiniteQuery,
} from "@tanstack/react-query"
import { isReactionMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { ensureDisappearingMessageSettings } from "@/features/disappearing-messages/disappearing-message-settings.query"
import { syncOneXmtpConversation } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-sync"
import { getXmtpConversationMessages } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { IXmtpConversationId, IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { convertNanosecondsToMilliseconds } from "@/utils/date"
import { queryLogger } from "@/utils/logger/logger"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { DEFAULT_GC_TIME_MS } from "@/utils/react-query/react-query.constants"
import { refetchQueryIfNotAlreadyFetching } from "@/utils/react-query/react-query.helpers"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { maybeUpdateConversationQueryLastMessage } from "../queries/conversation.query"
import { processReactionConversationMessages } from "./conversation-message/conversation-message-reactions.query"
import {
  ensureConversationMessageQueryData,
  getConversationMessageQueryData,
  setConversationMessageQueryData,
} from "./conversation-message/conversation-message.query"
import {
  IConversationMessage,
  IConversationMessageReaction,
} from "./conversation-message/conversation-message.types"
import { convertXmtpMessageToConvosMessage } from "./conversation-message/utils/convert-xmtp-message-to-convos-message"

// Default page size for infinite queries
export const DEFAULT_PAGE_SIZE = 20

// New types for the message IDs list approach
type IMessageIdsPage = {
  messageIds: IXmtpMessageId[]
  nextCursorNs: number | null
  prevCursorNs: number | null
}

export type IConversationMessagesInfiniteQueryData = InfiniteData<IMessageIdsPage>

type IArgs = {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
  limit?: number
}

type IArgsWithCaller = IArgs & {
  caller: string
}

type IInfiniteMessagesPageParam = {
  cursorNs?: number
  direction: "next" | "prev"
  // "next" = load OLDER messages (going back in time)
  // "prev" = load NEWER messages (going forward in time)
}

/**
 * Query function for infinite messages - returns only message IDs and cursor info
 */
const conversationMessagesInfiniteQueryFn = async (
  args: IArgs & { pageParam: IInfiniteMessagesPageParam },
) => {
  const timestampBeforeXmtpFetchMs = Date.now()

  const { clientInboxId, xmtpConversationId, pageParam, limit: argLimit } = args

  const { cursorNs, direction } = pageParam || {
    cursorNs: undefined,
    direction: "next",
  }

  const resolvedLimit = argLimit || DEFAULT_PAGE_SIZE

  if (!clientInboxId) {
    throw new Error("clientInboxId is required")
  }

  if (!xmtpConversationId) {
    throw new Error("xmtpConversationId is required")
  }

  await syncOneXmtpConversation({
    clientInboxId,
    xmtpConversationId,
    caller: "conversationMessagesInfiniteQueryFn",
  })

  const disappearingMessagesSettings = await ensureDisappearingMessageSettings({
    clientInboxId,
    xmtpConversationId: xmtpConversationId,
    caller: "conversationMessagesInfiniteQueryFn",
  })

  const priotorizeServerResponse =
    disappearingMessagesSettings?.retentionDurationInNs &&
    disappearingMessagesSettings?.retentionDurationInNs > 0 &&
    // Priotorize server response if the retention duration is less than the default GC time.
    // Messages will get deleted from the cache after the default GC time anyway
    convertNanosecondsToMilliseconds(disappearingMessagesSettings?.retentionDurationInNs) <=
      DEFAULT_GC_TIME_MS

  const xmtpMessages = await getXmtpConversationMessages({
    clientInboxId,
    xmtpConversationId,
    limit: resolvedLimit,
    ...(direction === "next" && cursorNs ? { beforeNs: cursorNs } : {}),
    ...(direction === "prev" && cursorNs ? { afterNs: cursorNs } : {}),
    direction,
  })

  const convosMessagesFromServer = xmtpMessages.map(convertXmtpMessageToConvosMessage)
  let combinedMessagesForPage: IConversationMessage[] = [...convosMessagesFromServer]

  // Only if we're fetching the first page
  if (direction === "next" && !cursorNs) {
    const currentInfiniteData = getConversationMessagesInfiniteQueryData({
      clientInboxId,
      xmtpConversationId,
    })

    if (currentInfiniteData && currentInfiniteData.pages.length > 0) {
      const cachedFirstPageMessageIds = currentInfiniteData.pages[0].messageIds
      const serverMessageIdsSet = new Set(convosMessagesFromServer.map((m) => m.xmtpId))
      const messagesToConsider: IConversationMessage[] = []

      /*
       * RACE CONDITION HANDLING FOR MESSAGE SYNCHRONIZATION
       *
       * This logic handles complex race conditions that occur when messages arrive from multiple sources:
       * 1. Push notifications (when app is backgrounded)
       * 2. Real-time streams (when app is active)
       * 3. Server fetches (periodic syncing)
       *
       * THE PROBLEM:
       * Messages can appear and disappear from the UI due to timing issues between these sources.
       *
       * EXAMPLE SCENARIO:
       * 1. User receives notification while app is backgrounded
       * 2. Notification handler adds message to cache via addMessagesToConversationMessagesInfiniteQueryData
       * 3. User opens app, triggering a refetch that takes 5+ minutes due to slow network
       * 4. Server response doesn't include the recent message (sync delay)
       * 5. Our cache merge logic removes the "newer" cached message, thinking server is authoritative
       * 6. User sees message disappear from UI
       * 7. Later, when server catches up, message reappears
       *
       * THE SOLUTION:
       * We use different strategies based on whether disappearing messages are enabled:
       *
       * - prioritizeServerResponse = true (disappearing messages enabled):
       *   Server is more authoritative for message retention, but we protect recent messages
       *   from being removed by using dynamic grace periods and age checks.
       *
       * - prioritizeServerResponse = false (normal conversations):
       *   We trust our cache more and merge all cached messages with server response.
       */

      if (priotorizeServerResponse) {
        const cachedMessagePromises = cachedFirstPageMessageIds
          .filter((id) => !serverMessageIdsSet.has(id))
          .map(async (cachedMsgId) => {
            const cachedMsgData = await ensureConversationMessageQueryData({
              clientInboxId,
              xmtpMessageId: cachedMsgId,
              xmtpConversationId,
              caller: "conversationMessagesInfiniteQueryFn",
            })
            return { id: cachedMsgId, data: cachedMsgData }
          })

        const cachedMessageResults = await Promise.all(cachedMessagePromises)

        for (const { id: cachedMsgId, data: cachedMsgData } of cachedMessageResults) {
          if (cachedMsgData) {
            // Dynamic grace period that accounts for slow fetches
            // If fetch took 5 minutes, we extend grace period accordingly
            const fetchDurationMs = Date.now() - timestampBeforeXmtpFetchMs
            const DYNAMIC_GRACE_PERIOD = Math.max(5000, fetchDurationMs + 5000)

            // Don't prioritize server response for very recent messages (< 10 seconds old)
            // These are likely from notifications/streams and server might not have them yet
            // We use 10 seconds to balance protection vs respecting short disappearing message settings
            if (cachedMsgData.sentMs < timestampBeforeXmtpFetchMs - 10000) {
              // Only prioritize server response for messages older than 10 seconds
              continue
            } else if (cachedMsgData.sentMs >= timestampBeforeXmtpFetchMs - DYNAMIC_GRACE_PERIOD) {
              messagesToConsider.push(cachedMsgData)
            } else if (cachedMsgData.sentMs < timestampBeforeXmtpFetchMs) {
              queryLogger.debug(
                `Removing cached message ${cachedMsgId} because it's older than fetch start and it's not in server response and we priotorize server response`,
              )
            }
          }
        }
      } else {
        // Consider all cached messages from the first page that are not already in the server response.
        const cachedMessagePromises = cachedFirstPageMessageIds
          .filter((id) => !serverMessageIdsSet.has(id))
          .map(async (cachedMsgId) => {
            const cachedMsgData = await ensureConversationMessageQueryData({
              clientInboxId,
              xmtpMessageId: cachedMsgId,
              xmtpConversationId,
              caller: "conversationMessagesInfiniteQueryFn",
            })
            return cachedMsgData
          })

        const cachedMessageResults = await Promise.all(cachedMessagePromises)
        messagesToConsider.push(...cachedMessageResults.filter(Boolean))
      }

      // Make sure unique and sorted messages
      if (messagesToConsider.length > 0) {
        const allMessagesForMerge = [...convosMessagesFromServer, ...messagesToConsider]

        const uniqueMessagesMap = new Map<IXmtpMessageId, IConversationMessage>()
        for (const msg of allMessagesForMerge) {
          if (!uniqueMessagesMap.has(msg.xmtpId)) {
            uniqueMessagesMap.set(msg.xmtpId, msg)
          }
        }
        const effectiveLimit = Math.min(
          resolvedLimit + messagesToConsider.length,
          resolvedLimit * 2, // Don't exceed 2x the original limit
        )
        combinedMessagesForPage = Array.from(uniqueMessagesMap.values())
          .slice(0, effectiveLimit)
          .sort((a, b) => b.sentMs - a.sentMs)
      }
    }
  }

  const regularMessages: IConversationMessage[] = []
  const reactionMessages: IConversationMessageReaction[] = []

  for (const message of combinedMessagesForPage) {
    if (isReactionMessage(message)) {
      reactionMessages.push(message)
    } else {
      regularMessages.push(message)
    }
  }

  for (const message of regularMessages) {
    setConversationMessageQueryData({
      clientInboxId,
      xmtpMessageId: message.xmtpId,
      xmtpConversationId,
      message,
    })
  }

  if (reactionMessages.length > 0) {
    processReactionConversationMessages({
      clientInboxId,
      reactionMessages,
    })
  }

  let finalNextCursorNs: number | null = null
  let finalPrevCursorNs: number | null = null

  if (convosMessagesFromServer.length > 0) {
    if (direction === "next") {
      // Only set cursor if we have a full page of REGULAR messages (excluding reactions)
      if (regularMessages.length >= resolvedLimit) {
        finalNextCursorNs =
          combinedMessagesForPage[combinedMessagesForPage.length - 1].sentNs - 1000
      } else {
        finalNextCursorNs = null
      }
    } else if (direction === "prev") {
      // Cursor is based on the newest item in the *returned* `combinedMessagesForPage`.
      // This assumes `combinedMessagesForPage` are sorted newest first if `direction` was "prev".
      if (combinedMessagesForPage.length > 0) {
        finalPrevCursorNs = combinedMessagesForPage[0].sentNs + 1000
      }
    }
  }

  const result = {
    messageIds: regularMessages.map((message) => message.xmtpId),
    nextCursorNs: finalNextCursorNs,
    prevCursorNs: finalPrevCursorNs,
  }

  return result
}

export function getConversationMessagesInfiniteQueryOptions(
  args: Optional<IArgsWithCaller, "caller">,
) {
  const { clientInboxId, xmtpConversationId, limit, caller } = args

  return infiniteQueryOptions({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: getReactQueryKey({
      baseStr: "conversation-messages-infinite",
      clientInboxId,
      xmtpConversationId,
    }),
    meta: {
      caller,
    },
    queryFn: ({ pageParam }) => {
      return conversationMessagesInfiniteQueryFn({
        clientInboxId,
        xmtpConversationId,
        limit,
        pageParam: pageParam,
      })
    },
    initialPageParam: {
      direction: "next",
    } as IInfiniteMessagesPageParam,
    getPreviousPageParam: (firstPage, allPages) => {
      if (!firstPage.prevCursorNs) {
        return undefined
      }
      return { cursorNs: firstPage.prevCursorNs, direction: "prev" } as IInfiniteMessagesPageParam
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.nextCursorNs) {
        return undefined
      }
      return { cursorNs: lastPage.nextCursorNs, direction: "next" } as IInfiniteMessagesPageParam
    },
    enabled: Boolean(clientInboxId) && Boolean(xmtpConversationId),
  })
}

export function useConversationMessagesInfiniteQueryAllMessageIds(args: IArgsWithCaller) {
  return useInfiniteQuery({
    ...getConversationMessagesInfiniteQueryOptions(args),
    select: (data) => {
      return data.pages.flatMap((page) => page.messageIds)
    },
  })
}

/**
 * Add a message to the infinite query cache, maintaining chronological order in the first page.
 * This will update all pages that match the query key.
 */
export const addMessagesToConversationMessagesInfiniteQueryData = (args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
  messageIds: IXmtpMessageId[]
}) => {
  const { clientInboxId, xmtpConversationId, messageIds: newMessageIds } = args

  // Putting this here because it's centralized and we don't have to call this function every time
  // we call "addMessagesToConversationMessagesInfiniteQueryData"
  maybeUpdateConversationQueryLastMessage({
    clientInboxId,
    xmtpConversationId,
    messageIds: newMessageIds,
  }).catch(captureError)

  const currentData = getConversationMessagesInfiniteQueryData({
    clientInboxId,
    xmtpConversationId,
  })

  const originalPagesArray = currentData?.pages || []
  const originalFirstPageObject = originalPagesArray[0] // This might be undefined

  // Start with a copy of the original first page's message IDs, or an empty array.
  // This `workingListOfFirstPageMessageIds` will be mutated during the loop.
  let workingListOfFirstPageMessageIds: IXmtpMessageId[] = originalFirstPageObject
    ? [...originalFirstPageObject.messageIds]
    : []

  for (const newMessageId of newMessageIds) {
    // Check if the message already existed in ANY of the original pages
    const existsInOriginalCache = originalPagesArray.some((page) =>
      page.messageIds.includes(newMessageId),
    )

    if (existsInOriginalCache) {
      queryLogger.debug(
        `Message ${newMessageId} already exists in original cache for conversation ${xmtpConversationId}, skipping.`,
      )
      continue
    }

    // Check if the message was already added in a *previous iteration of this current batch*
    // This handles duplicate IDs within the `newMessageIds` array itself.
    // We only check against `workingListOfFirstPageMessageIds` IF `originalFirstPageObject` didn't already contain it.
    // (The `existsInOriginalCache` check above is more comprehensive for initial state)
    if (
      !originalFirstPageObject?.messageIds.includes(newMessageId) &&
      workingListOfFirstPageMessageIds.includes(newMessageId)
    ) {
      queryLogger.debug(
        `Message ${newMessageId} was already added in this current batch for conversation ${xmtpConversationId}, skipping duplicate within batch.`,
      )
      continue
    }

    const newMessageData = getConversationMessageQueryData({
      clientInboxId,
      xmtpMessageId: newMessageId,
      xmtpConversationId,
    })

    let inserted = false
    if (newMessageData) {
      for (let i = 0; i < workingListOfFirstPageMessageIds.length; i++) {
        const existingMessageIdInWorkingList = workingListOfFirstPageMessageIds[i]
        const existingMessageData = getConversationMessageQueryData({
          clientInboxId,
          xmtpMessageId: existingMessageIdInWorkingList,
          xmtpConversationId,
        })

        if (!existingMessageData) {
          queryLogger.warn(
            `Could not find data for existing message ${existingMessageIdInWorkingList} in conversation ${xmtpConversationId} cache during ordered insertion. Skipping comparison.`,
          )
          continue
        }

        if (newMessageData.sentMs >= existingMessageData.sentMs) {
          workingListOfFirstPageMessageIds.splice(i, 0, newMessageId)
          inserted = true
          break
        }
      }
      if (!inserted) {
        workingListOfFirstPageMessageIds.push(newMessageId)
      }
    } else {
      queryLogger.warn(
        `Could not find data for new message ${newMessageId} in conversation ${xmtpConversationId} cache. Adding to beginning of list as fallback.`,
      )
      workingListOfFirstPageMessageIds.unshift(newMessageId)
    }
    queryLogger.debug(
      `Processed message ${newMessageId} for batch update in conversation ${xmtpConversationId}.`,
    )
  }

  // Create the new first page object immutably
  const newFirstPage: IMessageIdsPage = {
    messageIds: workingListOfFirstPageMessageIds, // The fully updated list of IDs
    nextCursorNs: originalFirstPageObject?.nextCursorNs || null,
    prevCursorNs: originalFirstPageObject?.prevCursorNs || null,
  }

  // Construct the final array of pages
  const finalPagesArray: IMessageIdsPage[] =
    originalPagesArray.length > 0
      ? [newFirstPage, ...originalPagesArray.slice(1)] // Replace the old first page, keep the rest
      : [newFirstPage] // If there were no original pages, this is the only page

  setConversationMessagesInfiniteQueryData({
    clientInboxId,
    xmtpConversationId,
    data: {
      pages: finalPagesArray,
      // Using the pageParams logic from your working single-message version
      pageParams: currentData?.pageParams || [null],
    },
  })
}

export function setConversationMessagesInfiniteQueryData(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
  data: IConversationMessagesInfiniteQueryData
}) {
  const { clientInboxId, xmtpConversationId, data } = args
  const queryKey = getConversationMessagesInfiniteQueryOptions({
    clientInboxId,
    xmtpConversationId,
  }).queryKey
  return reactQueryClient.setQueryData(queryKey, data)
}

/**
 * Remove a message from the infinite query cache
 * This will update all pages that match the query key
 */
export const removeMessageFromConversationMessagesInfiniteQueryData = (args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
  messageId: IXmtpMessageId
}) => {
  const { clientInboxId, xmtpConversationId, messageId } = args
  const queryKey = getConversationMessagesInfiniteQueryOptions({
    clientInboxId,
    xmtpConversationId,
  }).queryKey

  // Get the current data from the cache
  const currentData = reactQueryClient.getQueryData<{
    pages: IMessageIdsPage[]
    pageParams: unknown[]
  }>(queryKey)

  if (!currentData || !currentData.pages.length) {
    return
  }

  // Create updated pages by removing the message from each page
  const updatedPages = currentData.pages.map((page) => {
    return {
      ...page,
      messageIds: page.messageIds.filter((id) => id !== messageId),
    }
  })

  // Set the updated data back to the cache
  reactQueryClient.setQueryData(queryKey, {
    ...currentData,
    pages: updatedPages,
  })

  // Also remove the message from its individual query cache
  reactQueryClient.removeQueries({
    queryKey: getReactQueryKey({
      baseStr: "conversation-message",
      clientInboxId,
      xmtpMessageId: messageId,
    }),
  })

  // And remove its reactions
  reactQueryClient.removeQueries({
    queryKey: getReactQueryKey({
      baseStr: "message-reactions",
      clientInboxId,
      xmtpMessageId: messageId,
    }),
  })
}

export function invalidateConversationMessagesInfiniteMessagesQuery(args: IArgs) {
  const queryKey = getConversationMessagesInfiniteQueryOptions(args).queryKey
  return reactQueryClient.invalidateQueries({ queryKey })
}

export function refetchConversationMessagesInfiniteQuery(args: IArgsWithCaller) {
  return refetchQueryIfNotAlreadyFetching({
    queryKey: getConversationMessagesInfiniteQueryOptions(args).queryKey,
  })
}

export function getConversationMessagesInfiniteQueryData(args: IArgs) {
  const queryKey = getConversationMessagesInfiniteQueryOptions(args).queryKey
  return reactQueryClient.getQueryData(queryKey)
}

export function getAllConversationMessageInInfiniteQueryData(args: IArgs) {
  const queryKey = getConversationMessagesInfiniteQueryOptions(args).queryKey
  return reactQueryClient.getQueryData(queryKey)?.pages.flatMap((page) => page.messageIds)
}

export function prefetchConversationMessagesInfiniteQuery(args: IArgsWithCaller) {
  return reactQueryClient.prefetchInfiniteQuery(getConversationMessagesInfiniteQueryOptions(args))
}

export function ensureConversationMessagesInfiniteQueryData(args: IArgsWithCaller) {
  return reactQueryClient.ensureInfiniteQueryData(getConversationMessagesInfiniteQueryOptions(args))
}

export function refetchInfiniteConversationMessages(args: IArgsWithCaller) {
  return reactQueryClient.refetchQueries({
    queryKey: getConversationMessagesInfiniteQueryOptions(args).queryKey,
  })
}

// Define the type for the observers we'll store in the cache
type ConversationMessagesInfiniteQueryObserver = ReturnType<
  typeof createConversationMessagesInfiniteQueryObserver
>

// Cache to avoid creating multiple observers for the same query
const observersCache = new Map<string, ConversationMessagesInfiniteQueryObserver>()

// Helper function to create an observer with consistent typing
function createConversationMessagesInfiniteQueryObserver(args: IArgs) {
  const queryOptions = getConversationMessagesInfiniteQueryOptions(args)
  return new InfiniteQueryObserver(reactQueryClient, queryOptions)
}

export function getConversationMessagesInfiniteQueryObserver(args: IArgs) {
  // Create a cache key from the query key components
  const cacheKey = `${args.clientInboxId}:${args.xmtpConversationId}`

  // Return existing observer if we have one
  if (observersCache.has(cacheKey)) {
    return observersCache.get(cacheKey)!
  }

  // Create and cache new observer
  const observer = createConversationMessagesInfiniteQueryObserver(args)

  observersCache.set(cacheKey, observer)
  return observer
}

export async function fetchConversationMessagesInfiniteQuery(args: IArgsWithCaller) {
  return reactQueryClient.fetchInfiniteQuery(getConversationMessagesInfiniteQueryOptions(args))
}
