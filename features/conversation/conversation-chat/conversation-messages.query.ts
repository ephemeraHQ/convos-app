import {
  InfiniteData,
  infiniteQueryOptions,
  Optional,
  useInfiniteQuery,
} from "@tanstack/react-query"
import { isReactionMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { ensureConversationSyncAllQuery } from "@/features/conversation/queries/conversation-sync-all.query"
import { isTmpConversation } from "@/features/conversation/utils/tmp-conversation"
import { syncOneXmtpConversation } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-sync"
import { getXmtpConversationMessages } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { IXmtpConversationId, IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { queryLogger } from "@/utils/logger/logger"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { ensureConversationQueryData } from "../queries/conversation.query"
import { processReactionConversationMessages } from "./conversation-message/conversation-message-reactions.query"
import { setConversationMessageQueryData } from "./conversation-message/conversation-message.query"
import { IConversationMessage } from "./conversation-message/conversation-message.types"
import { convertXmtpMessageToConvosMessage } from "./conversation-message/utils/convert-xmtp-message-to-convos-message"

// Default page size for infinite queries
const DEFAULT_PAGE_SIZE = 20

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
  const { clientInboxId, xmtpConversationId, pageParam } = args
  const { cursorNs, direction } = pageParam

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

  // Let's make sure we have this query done otherwise it doesn't make sense to do "syncOneXmtpConversation"
  await ensureConversationSyncAllQuery({
    clientInboxId,
  })

  await syncOneXmtpConversation({
    clientInboxId,
    conversationId: conversation.xmtpId,
  })

  const xmtpMessages = await getXmtpConversationMessages({
    clientInboxId,
    conversationId: conversation.xmtpId,
    limit: DEFAULT_PAGE_SIZE,
    ...(direction === "next" && cursorNs ? { beforeNs: cursorNs } : {}),
    ...(direction === "prev" && cursorNs ? { afterNs: cursorNs } : {}),
    direction,
  })

  const convosMessages = xmtpMessages.map(convertXmtpMessageToConvosMessage)

  // Separate messages and reactions
  const regularMessages: IConversationMessage[] = []
  const reactionMessages: IConversationMessage[] = []

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
      message,
    })
  }

  // Process reactions in batch for better performance
  if (reactionMessages.length > 0) {
    processReactionConversationMessages({ clientInboxId, reactionMessages })
  }

  // Get message IDs (only from regular messages, not reactions)
  const messageIds = regularMessages.map((message) => message.xmtpId)

  // CURSOR MANAGEMENT LOGIC
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
  const { clientInboxId, xmtpConversationId, caller } = args

  return infiniteQueryOptions({
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
        pageParam: pageParam as IInfiniteMessagesPageParam,
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
    enabled: Boolean(xmtpConversationId) && !isTmpConversation(xmtpConversationId),
    // Not sure we need this anymore
    // select: (data) => {
    //   const seenMessageIds = new Set<IXmtpMessageId>()

    //   const deduplicatedPages = data.pages.map((page, pageIndex) => {
    //     const uniqueMessageIds = page.messageIds.filter((id) => {
    //       if (seenMessageIds.has(id)) {
    //         return false
    //       }
    //       seenMessageIds.add(id)
    //       return true
    //     })

    //     return {
    //       ...page,
    //       messageIds: uniqueMessageIds,
    //     }
    //   })

    //   return {
    //     pages: deduplicatedPages,
    //     pageParams: data.pageParams,
    //   }
    // },
  })
}

export const useConversationMessagesInfiniteQuery = (args: IArgsWithCaller) => {
  return useInfiniteQuery(getConversationMessagesInfiniteQueryOptions(args))
}

export function useConversationMessagesInfiniteQueryAllMessageIds(args: IArgsWithCaller) {
  return useInfiniteQuery({
    ...getConversationMessagesInfiniteQueryOptions(args),
    select: (data) => {
      const baseQuery = getConversationMessagesInfiniteQueryOptions(args)
      const baseData = baseQuery.select?.(data) ?? data
      return baseData.pages.flatMap((page) => page.messageIds)
    },
  })
}

/**
 * Add a message to the infinite query cache
 * This will update all pages that match the query key
 */
export const addMessageToConversationMessagesInfiniteQueryData = (args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
  message: IConversationMessage
}) => {
  const { clientInboxId, xmtpConversationId, message } = args

  // Get or initialize pages array
  const currentData = getConversationMessagesInfiniteQueryData({
    clientInboxId,
    xmtpConversationId,
  })

  const pages = currentData?.pages || []
  const firstPage = pages[0] || {
    messageIds: [],
    nextCursorNs: null,
    prevCursorNs: null,
  }

  // Check if the message already exists in any page
  const messageAlreadyExists = pages.some((page) => page.messageIds.includes(message.xmtpId))

  if (messageAlreadyExists) {
    queryLogger.debug(
      `Message ${message.xmtpId} already exists in conversation ${xmtpConversationId} cache, skipping add`,
    )
    return
  }

  // Add the message ID to the first page
  const updatedFirstPage = {
    ...firstPage,
    messageIds: [message.xmtpId, ...firstPage.messageIds],
  }

  const updatedPages = pages.length ? [updatedFirstPage, ...pages.slice(1)] : [updatedFirstPage]

  queryLogger.debug(
    `Message ${message.xmtpId} added to conversation messages ${xmtpConversationId} infinite query cache`,
  )

  // Set the updated data back to the cache
  setConversationMessagesInfiniteQueryData({
    clientInboxId,
    xmtpConversationId,
    data: {
      pages: updatedPages,
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

/**
 * Invalidate the infinite query cache to force a refetch
 */
export function invalidateConversationMessagesInfiniteMessagesQuery(args: IArgs) {
  const { clientInboxId, xmtpConversationId } = args
  const queryKey = getConversationMessagesInfiniteQueryOptions({
    clientInboxId,
    xmtpConversationId,
  }).queryKey
  return reactQueryClient.invalidateQueries({ queryKey })
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
