import {
  InfiniteData,
  infiniteQueryOptions,
  Optional,
  useInfiniteQuery,
} from "@tanstack/react-query"
import { useMemo } from "react"
import { isReactionMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { ensureConversationSyncAllQuery } from "@/features/conversation/queries/conversation-sync-all.query"
import { isTempConversation } from "@/features/conversation/utils/is-temp-conversation"
import { syncOneXmtpConversation } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-sync"
import { getXmtpConversationMessages } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { IXmtpConversationId, IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { ObjectTyped } from "@/utils/object-typed"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { updateObjectAndMethods } from "@/utils/update-object-and-methods"
import { ensureConversationQueryData } from "../queries/conversation.query"
import {
  IConversationMessage,
  IConversationMessageReactionContent,
} from "./conversation-message/conversation-message.types"
import { convertXmtpMessageToConvosMessage } from "./conversation-message/utils/convert-xmtp-message-to-convos-message"

// Default page size for infinite queries
const DEFAULT_PAGE_SIZE = 20

export type IMessageAccumulator = {
  ids: IXmtpMessageId[]
  byId: Record<IXmtpMessageId, IConversationMessage>
  reactions: Record<
    IXmtpMessageId,
    {
      bySender: Record<IXmtpInboxId, IConversationMessageReactionContent[]>
      byReactionContent: Record<string, IXmtpInboxId[]>
    }
  >
}

type IConversationMessagesInfiniteQueryDataPage = Awaited<
  ReturnType<typeof conversationMessagesInfiniteQueryFn>
>

export type IConversationMessagesInfiniteQueryData =
  InfiniteData<IConversationMessagesInfiniteQueryDataPage>

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
 * Process messages and return an accumulator of messages and reactions
 */
function processMessages(args: {
  newMessages: IConversationMessage[]
  existingData?: IMessageAccumulator
  prependNewMessages?: boolean
}): IMessageAccumulator {
  const { newMessages, existingData, prependNewMessages = false } = args

  const result: IMessageAccumulator = existingData
    ? { ...existingData }
    : {
        ids: [],
        byId: {},
        reactions: {},
      }

  for (const message of newMessages) {
    if (!isReactionMessage(message)) {
      // After isReactionMessage check, we know this is a regular message
      const regularMessage = message
      const messageId = regularMessage.xmtpId

      if (result.byId[messageId]) {
        result.byId[messageId] = regularMessage
        continue
      }

      if (prependNewMessages) {
        result.byId = { [messageId]: regularMessage, ...result.byId }
        result.ids = [messageId, ...result.ids]
      } else {
        result.byId[messageId] = regularMessage
        result.ids.push(messageId)
      }
    }
  }

  const reactionsMessages = newMessages.filter(isReactionMessage)
  const processedReactions = new Set<string>()

  for (const reactionMessage of reactionsMessages) {
    const reactionContent = reactionMessage.content
    const referenceMessageId = reactionContent?.reference
    const senderAddress = reactionMessage.senderInboxId

    if (!reactionContent || !referenceMessageId) {
      continue
    }

    const reactionKey = `${reactionContent.content}-${referenceMessageId}`

    if (processedReactions.has(reactionKey)) {
      continue
    }

    processedReactions.add(reactionKey)

    if (!result.reactions[referenceMessageId]) {
      result.reactions[referenceMessageId] = {
        bySender: {},
        byReactionContent: {},
      }
    }

    const messageReactions = result.reactions[referenceMessageId]

    if (reactionContent.action === "added") {
      const hasExistingReaction = messageReactions.bySender[senderAddress]?.some(
        (reaction: IConversationMessageReactionContent) =>
          reaction.content === reactionContent.content,
      )

      if (!hasExistingReaction) {
        messageReactions.byReactionContent[reactionContent.content] = [
          ...(messageReactions.byReactionContent[reactionContent.content] || []),
          senderAddress,
        ]
        messageReactions.bySender[senderAddress] = [
          ...(messageReactions.bySender[senderAddress] || []),
          reactionContent,
        ]
      }
    } else if (reactionContent.action === "removed") {
      messageReactions.byReactionContent[reactionContent.content] = (
        messageReactions.byReactionContent[reactionContent.content] || []
      ).filter((id) => id !== senderAddress)
      messageReactions.bySender[senderAddress] = (
        messageReactions.bySender[senderAddress] || []
      ).filter(
        (reaction: IConversationMessageReactionContent) =>
          reaction.content !== reactionContent.content,
      )
    }
  }

  return result
}

/**
 * Query function for infinite messages - supports both pagination and live updates
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
  const processedMessages = processMessages({ newMessages: convosMessages })

  // CURSOR MANAGEMENT LOGIC:
  // With our inverted direction mapping:
  // - For "next" direction (older), oldest messages are first in the array (index 0)
  // - For "prev" direction (newer), newest messages are last in the array
  let nextCursorNs: number | null = null
  let prevCursorNs: number | null = null

  if (convosMessages.length > 0) {
    // For "next" direction (older messages), we want to use the oldest message in the batch
    if (direction === "next" && convosMessages.length > 0) {
      // Use the oldest message's timestamp as cursor for next batch of older messages
      nextCursorNs = convosMessages[convosMessages.length - 1].sentNs || null
    }

    // For "prev" direction (newer messages), we want to use the newest message in the batch
    if (direction === "prev" && convosMessages.length > 0) {
      // Use the newest message's timestamp as cursor for next batch of newer messages
      prevCursorNs = convosMessages[0].sentNs || null
    }
  }

  return {
    messages: processedMessages,
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
      persist: false,
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
    getPreviousPageParam: (firstPage) => {
      if (!firstPage.prevCursorNs) return null
      return { cursorNs: firstPage.prevCursorNs, direction: "prev" } as IInfiniteMessagesPageParam
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.nextCursorNs) return null
      return { cursorNs: lastPage.nextCursorNs, direction: "next" } as IInfiniteMessagesPageParam
    },
    enabled: Boolean(xmtpConversationId) && !isTempConversation(xmtpConversationId),
  })
}

export const useConversationMessagesInfiniteQuery = (args: IArgsWithCaller) => {
  return useInfiniteQuery(getConversationMessagesInfiniteQueryOptions(args))
}

export function useMergedConversationMessagesInfiniteQuery(args: IArgsWithCaller) {
  const query = useConversationMessagesInfiniteQuery(args)

  const messages = useMemo(() => mergeInfiniteQueryPages(query.data), [query.data])

  return {
    ...query,
    data: messages,
  }
}

/**
 * Helper function to merge multiple pages of messages from infinite query results
 * Uses the existing processMessages function to handle normalization
 */
export function mergeInfiniteQueryPages(data?: {
  pages: IConversationMessagesInfiniteQueryDataPage[]
  pageParams: unknown[]
}): IMessageAccumulator {
  if (!data?.pages?.length) {
    return {
      ids: [],
      byId: {},
      reactions: {},
    }
  }

  // Extract all messages from all pages
  const allMessages: IConversationMessage[] = []

  // Create a combined reactions object to preserve reaction data across pages
  let combinedReactions: IMessageAccumulator["reactions"] = {}

  // Go through each page and collect all messages and reactions
  data.pages.forEach((page) => {
    // Get message IDs from this page
    const messageIds = page.messages.ids

    // Get the actual message objects
    const messages = messageIds.map((id) => page.messages.byId[id])

    // Add to our collection
    allMessages.push(...messages)

    // Merge reactions from this page
    combinedReactions = mergeReactions({
      existingReactions: combinedReactions,
      newReactions: page.messages.reactions,
    })
  })

  // Process the combined messages
  const processedData = processMessages({ newMessages: allMessages })

  // Merge the processed reactions with the combined reactions from all pages
  return {
    ...processedData,
    reactions: mergeReactions({
      existingReactions: combinedReactions,
      newReactions: processedData.reactions,
    }),
  }
}

// Helper function to merge reaction objects
function mergeReactions(args: {
  existingReactions: IMessageAccumulator["reactions"]
  newReactions: IMessageAccumulator["reactions"]
}): IMessageAccumulator["reactions"] {
  const { existingReactions, newReactions } = args

  const result = { ...existingReactions }

  // Iterate through all message IDs in the new reactions
  ObjectTyped.keys(newReactions).forEach((messageId) => {
    if (!result[messageId]) {
      // If this message ID doesn't exist in the result yet, add it directly
      result[messageId] = { ...newReactions[messageId] }
      return
    }

    // Message exists in both - need to merge the reaction data
    const existing = result[messageId]
    const incoming = newReactions[messageId]

    // Merge bySender data
    ObjectTyped.keys(incoming.bySender).forEach((senderId) => {
      existing.bySender[senderId] = [
        ...(existing.bySender[senderId] || []),
        ...incoming.bySender[senderId],
      ]
        // Remove duplicates
        .filter(
          (reaction, index, self) =>
            index === self.findIndex((r) => r.content === reaction.content),
        )
    })

    // Merge byReactionContent data
    ObjectTyped.keys(incoming.byReactionContent).forEach((content) => {
      existing.byReactionContent[content] = [
        ...(existing.byReactionContent[content] || []),
        ...incoming.byReactionContent[content],
      ]
        // Remove duplicates
        .filter((id, index, self) => self.indexOf(id) === index)
    })
  })

  return result
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
  const queryKey = getConversationMessagesInfiniteQueryOptions({
    clientInboxId,
    xmtpConversationId,
  }).queryKey

  // Get the current data from the cache
  const currentData = reactQueryClient.getQueryData<{
    pages: IConversationMessagesInfiniteQueryDataPage[]
    pageParams: unknown[]
  }>(queryKey)

  if (!currentData || !currentData.pages.length) {
    return
  }

  // Update the first page with the new message (newest data is in first page)
  const updatedPages = [...currentData.pages]
  const firstPage = { ...updatedPages[0] }

  // Process the new message and add it to the first page
  firstPage.messages = processMessages({
    newMessages: [message],
    existingData: firstPage.messages,
    prependNewMessages: true,
  })

  // Update the first page in the array
  updatedPages[0] = firstPage

  // Set the updated data back to the cache
  reactQueryClient.setQueryData(queryKey, {
    ...currentData,
    pages: updatedPages,
  })
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
    pages: IConversationMessagesInfiniteQueryDataPage[]
    pageParams: unknown[]
  }>(queryKey)

  if (!currentData || !currentData.pages.length) {
    return
  }

  // Create updated pages by removing the message from each page
  const updatedPages = currentData.pages.map((page) => {
    // Check if the message exists in this page
    if (!page.messages.byId[messageId]) {
      return page
    }

    // Create a copy of the messages object
    const updatedMessages = { ...page.messages }

    // Remove the message ID from the ids array
    updatedMessages.ids = updatedMessages.ids.filter((id) => id !== messageId)

    // Remove the message from byId
    const updatedById = { ...updatedMessages.byId }
    delete updatedById[messageId]
    updatedMessages.byId = updatedById

    // Remove any reactions for this message
    const updatedReactions = { ...updatedMessages.reactions }
    delete updatedReactions[messageId]
    updatedMessages.reactions = updatedReactions

    // Return the updated page
    return {
      ...page,
      messages: updatedMessages,
    }
  })

  // Set the updated data back to the cache
  reactQueryClient.setQueryData(queryKey, {
    ...currentData,
    pages: updatedPages,
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
  return mergeInfiniteQueryPages(reactQueryClient.getQueryData(queryKey))
}

export function replaceMessageInConversationMessagesInfiniteQueryData(args: {
  tmpXmtpMessageId: IXmtpMessageId
  xmtpConversationId: IXmtpConversationId
  clientInboxId: IXmtpInboxId
  realMessage: IConversationMessage
}) {
  const { tmpXmtpMessageId, xmtpConversationId, clientInboxId, realMessage } = args

  const data = getConversationMessagesInfiniteQueryData({
    clientInboxId,
    xmtpConversationId,
  })

  if (!data || !data.pages.length) {
    return
  }

  // Process through each page to find and replace the message
  const updatedPages = data.pages.map((page) => {
    // Skip pages that don't contain the temporary message
    if (!page.messages.byId[tmpXmtpMessageId]) {
      return page
    }

    // Clone the message data
    const existingMessageData = { ...page.messages }

    // Find the index of the temporary message
    const tempOptimisticMessageIndex = existingMessageData.ids.indexOf(tmpXmtpMessageId)

    if (tempOptimisticMessageIndex === -1) {
      return page
    }

    // Create new ids array with the real message id replacing the temp id
    const newIds = [...existingMessageData.ids]
    newIds[tempOptimisticMessageIndex] = realMessage.xmtpId

    // Create new byId object with the real message and without the temp message
    const newById = { ...existingMessageData.byId }
    newById[realMessage.xmtpId] = updateObjectAndMethods(realMessage, {
      xmtpId: realMessage.xmtpId,
    })
    // Remove the temporary message entry
    delete newById[tmpXmtpMessageId]

    // Return updated page
    return {
      ...page,
      messages: {
        ...existingMessageData,
        ids: newIds,
        byId: newById,
      },
    }
  })

  // Set the updated data back to the cache
  return reactQueryClient.setQueryData(
    getConversationMessagesInfiniteQueryOptions({ clientInboxId, xmtpConversationId }).queryKey,
    {
      ...data,
      pages: updatedPages,
    },
  )
}

export function prefetchConversationMessagesInfiniteQuery(args: IArgsWithCaller) {
  return reactQueryClient.prefetchInfiniteQuery(getConversationMessagesInfiniteQueryOptions(args))
}
