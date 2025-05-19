import {
  InfiniteData,
  InfiniteQueryObserver,
  infiniteQueryOptions,
  Optional,
  useInfiniteQuery,
} from "@tanstack/react-query"
import { isReactionMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { isTmpConversation } from "@/features/conversation/utils/tmp-conversation"
import { syncOneXmtpConversation } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-sync"
import { getXmtpConversationMessages } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { IXmtpConversationId, IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { queryLogger } from "@/utils/logger/logger"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { ensureConversationQueryData } from "../queries/conversation.query"
import { processReactionConversationMessages } from "./conversation-message/conversation-message-reactions.query"
import {
  getConversationMessageQueryData,
  setConversationMessageQueryData,
} from "./conversation-message/conversation-message.query"
import {
  IConversationMessage,
  IConversationMessageReaction,
} from "./conversation-message/conversation-message.types"
import { convertXmtpMessageToConvosMessage } from "./conversation-message/utils/convert-xmtp-message-to-convos-message"

// Default page size for infinite queries
export const DEFAULT_PAGE_SIZE = 10

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
  const { clientInboxId, xmtpConversationId, pageParam, limit } = args
  const { cursorNs, direction } = pageParam || {
    // For some reason I've been seeing some "Cannot read property 'cursorNs' of undefined"
    cursorNs: undefined,
    direction: "next",
  }

  if (!clientInboxId) {
    throw new Error("clientInboxId is required")
  }

  if (!xmtpConversationId) {
    throw new Error("xmtpConversationId is required")
  }

  const conversation = await ensureConversationQueryData({
    clientInboxId,
    xmtpConversationId,
    caller: "conversationMessagesInfiniteQueryFn",
  })

  if (!conversation) {
    throw new Error("Conversation not found")
  }

  await syncOneXmtpConversation({
    clientInboxId,
    conversationId: conversation.xmtpId,
    caller: "conversationMessagesInfiniteQueryFn",
  })

  const xmtpMessages = await getXmtpConversationMessages({
    clientInboxId,
    conversationId: conversation.xmtpId,
    limit: limit || DEFAULT_PAGE_SIZE,
    ...(direction === "next" && cursorNs ? { beforeNs: cursorNs } : {}),
    ...(direction === "prev" && cursorNs ? { afterNs: cursorNs } : {}),
    direction,
  })

  const convosMessages = xmtpMessages.map(convertXmtpMessageToConvosMessage)

  // Separate messages and reactions
  const regularMessages: IConversationMessage[] = []
  const reactionMessages: IConversationMessageReaction[] = []

  for (const message of convosMessages) {
    if (isReactionMessage(message)) {
      reactionMessages.push(message)
    } else {
      regularMessages.push(message)
    }
  }

  // Store regular messages in their individual query caches
  for (const message of regularMessages) {
    setConversationMessageQueryData({
      clientInboxId,
      xmtpMessageId: message.xmtpId,
      xmtpConversationId,
      message,
    })
  }

  // Process reactions in batch for better performance
  if (reactionMessages.length > 0) {
    processReactionConversationMessages({
      clientInboxId,
      reactionMessages,
    })
  }

  // Get message IDs (only from regular messages, not reactions)
  const messageIds = regularMessages.map((message) => message.xmtpId)

  let nextCursorNs: number | null = null
  let prevCursorNs: number | null = null

  if (convosMessages.length > 0) {
    // For "next" direction (older messages), we want to use the oldest message in the batch
    if (direction === "next" && convosMessages.length > 0) {
      // Use the oldest message's timestamp as cursor for next batch of older messages
      nextCursorNs =
        convosMessages[convosMessages.length - 1].sentNs -
        // Otherwise XMTP was returning the same message for both prev and next
        1000
    }

    // For "prev" direction (newer messages), we want to use the newest message in the batch
    if (direction === "prev" && convosMessages.length > 0) {
      // Use the newest message's timestamp as cursor for next batch of newer messages
      prevCursorNs =
        convosMessages[0].sentNs +
        // Otherwise XMTP was returning the same message for both prev and next
        1000
    }
  }

  return {
    messageIds,
    nextCursorNs,
    prevCursorNs,
  }
}

export function getConversationMessagesInfiniteQueryOptions(
  args: Optional<IArgsWithCaller, "caller">,
) {
  const { clientInboxId, xmtpConversationId, caller, limit } = args

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
    enabled:
      Boolean(clientInboxId) &&
      Boolean(xmtpConversationId) &&
      !isTmpConversation(xmtpConversationId),
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
  const { clientInboxId, xmtpConversationId } = args
  const queryKey = getConversationMessagesInfiniteQueryOptions({
    clientInboxId,
    xmtpConversationId,
  }).queryKey
  return reactQueryClient.invalidateQueries({ queryKey })
}

export function refetchConversationMessagesInfiniteQuery(args: IArgsWithCaller) {
  const { clientInboxId, xmtpConversationId, caller } = args
  return reactQueryClient.refetchQueries(
    getConversationMessagesInfiniteQueryOptions({
      clientInboxId,
      xmtpConversationId,
      caller,
    }),
  )
}

export function getConversationMessagesInfiniteQueryData(args: IArgs) {
  const { clientInboxId, xmtpConversationId } = args
  const queryKey = getConversationMessagesInfiniteQueryOptions({
    clientInboxId,
    xmtpConversationId,
  }).queryKey
  return reactQueryClient.getQueryData(queryKey)
}

export function getAllConversationMessageInInfiniteQueryData(args: IArgs) {
  const { clientInboxId, xmtpConversationId } = args
  const queryKey = getConversationMessagesInfiniteQueryOptions({
    clientInboxId,
    xmtpConversationId,
  }).queryKey
  return reactQueryClient.getQueryData(queryKey)?.pages.flatMap((page) => page.messageIds)
}

// export function replaceMessageInConversationMessagesInfiniteQueryData(args: {
//   tmpXmtpMessageId: IXmtpMessageId
//   xmtpConversationId: IXmtpConversationId
//   clientInboxId: IXmtpInboxId
//   realMessage: IConversationMessage
// }) {
//   const { tmpXmtpMessageId, xmtpConversationId, clientInboxId, realMessage } = args

//   const data = getConversationMessagesInfiniteQueryData({
//     clientInboxId,
//     xmtpConversationId,
//   })

//   if (!data || !data.pages.length) {
//     captureError(
//       new ReactQueryError({
//         error: "No data found in replaceMessageInConversationMessagesInfiniteQueryData",
//       }),
//     )
//     return
//   }

//   // Replace the message in the individual message query cache
//   replaceMessageQueryData({
//     clientInboxId,
//     tmpXmtpMessageId,
//     realMessage,
//   })

//   // Process through each page to find and replace the message ID
//   const updatedPages = data.pages.map((page) => {
//     // Check if the page contains the temporary message ID
//     const messageIndex = page.messageIds.indexOf(tmpXmtpMessageId)

//     if (messageIndex === -1) {
//       return page
//     }

//     // Create new array of message IDs with the temporary ID replaced by the real one
//     const newMessageIds = [...page.messageIds]
//     newMessageIds[messageIndex] = realMessage.xmtpId

//     queryLogger.debug(
//       `Replacing tmp message ID (${tmpXmtpMessageId}) with real message ID (${realMessage.xmtpId}) at index ${messageIndex}`,
//     )

//     return {
//       ...page,
//       messageIds: newMessageIds,
//     }
//   })

//   // Set the updated data back to the cache
//   return reactQueryClient.setQueryData(
//     getConversationMessagesInfiniteQueryOptions({ clientInboxId, xmtpConversationId }).queryKey,
//     {
//       ...data,
//       pages: updatedPages,
//     },
//   )
// }

export function prefetchConversationMessagesInfiniteQuery(args: IArgsWithCaller) {
  return reactQueryClient.prefetchInfiniteQuery(getConversationMessagesInfiniteQueryOptions(args))
}

// export function updateMessageInConversationMessagesInfiniteQueryData(args: {
//   xmtpConversationId: IXmtpConversationId
//   clientInboxId: IXmtpInboxId
//   xmtpMessageIdToUpdate: IXmtpMessageId
//   messageUpdate: Partial<IConversationMessage>
// }) {
//   const { clientInboxId, xmtpMessageIdToUpdate, messageUpdate } = args

//   // Update the message in its individual query cache
//   updateMessageQueryData({
//     clientInboxId,
//     xmtpMessageId: xmtpMessageIdToUpdate,
//     messageUpdate,
//   })

//   // No need to update the message list since it only contains IDs
//   return true
// }

// const optimisticMessageToRealMap = new Map<IXmtpMessageId, IXmtpMessageId>()

// function setOptimisticMessageToRealMap(args: {
//   optimisticMessageId: IXmtpMessageId
//   realMessageId: IXmtpMessageId
// }) {
//   const { optimisticMessageId, realMessageId } = args
//   optimisticMessageToRealMap.set(optimisticMessageId, realMessageId)
// }

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
