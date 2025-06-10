import { queryOptions, useQuery } from "@tanstack/react-query"
import { isReactionMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { ensureDisappearingMessageSettings } from "@/features/disappearing-messages/disappearing-message-settings.query"
import { syncOneXmtpConversation } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-sync"
import { getXmtpConversationMessagesWithReactions } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import {
  IXmtpConversationId,
  IXmtpDecodedMessage,
  IXmtpInboxId,
  IXmtpMessageId,
} from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { convertNanosecondsToMilliseconds } from "@/utils/date"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { DEFAULT_GC_TIME_MS } from "@/utils/react-query/react-query.constants"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { maybeUpdateConversationQueryLastMessage } from "../queries/conversation.query"
import { processReactionConversationMessages } from "./conversation-message/conversation-message-reactions.query"
import {
  ensureConversationMessageQueryData,
  getConversationMessageQueryData,
  setConversationMessageQueryData,
} from "./conversation-message/conversation-message.query"
import { IConversationMessageReaction } from "./conversation-message/conversation-message.types"
import { convertXmtpMessageToConvosMessage } from "./conversation-message/utils/convert-xmtp-message-to-convos-message"

// Constants
export const DEFAULT_PAGE_SIZE = 20
export const MAX_CACHED_MESSAGES = 200

// Types
type IArgs = {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}

type IArgsWithCaller = IArgs & {
  caller: string
}

type IConversationMessagesData = {
  messageIds: IXmtpMessageId[]
  oldestMessageNs: number | null
  hasMoreOlder: boolean
}

// Query Options - This is the key function you wanted!
export function getConversationMessagesQueryOptions(args: IArgsWithCaller) {
  const { clientInboxId, xmtpConversationId, caller } = args

  return queryOptions({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: getReactQueryKey({
      baseStr: "conversation-messages",
      clientInboxId,
      xmtpConversationId,
    }),
    queryFn: () => fetchInitialMessages(args),
    staleTime: Infinity, // Never auto-refetch
    meta: {
      caller,
    },
  })
}

// Hook using the queryOptions
export function useConversationMessagesQuery(args: IArgsWithCaller) {
  return useQuery(getConversationMessagesQueryOptions(args))
}

// Initial fetch function
async function fetchInitialMessages(args: IArgsWithCaller): Promise<IConversationMessagesData> {
  const { clientInboxId, xmtpConversationId } = args

  // Sync conversation first
  await syncOneXmtpConversation({
    clientInboxId,
    xmtpConversationId,
    caller: "fetchInitialMessages",
  })

  // Fetch initial messages
  const xmtpMessages = await getXmtpConversationMessagesWithReactions({
    clientInboxId,
    xmtpConversationId,
    limit: DEFAULT_PAGE_SIZE,
    direction: "next",
  })

  // Convert and extract reactions
  const messages = xmtpMessages.map(convertXmtpMessageToConvosMessage)
  const reactions = extractReactionsFromMessages({ xmtpMessages })

  // Process reactions
  if (reactions.length > 0) {
    processReactionConversationMessages({
      clientInboxId,
      reactionMessages: reactions,
    })
  }

  // Cache individual messages
  for (const message of messages) {
    setConversationMessageQueryData({
      clientInboxId,
      xmtpMessageId: message.xmtpId,
      xmtpConversationId,
      message,
    })
  }

  const sortedMessages = messages.sort((a, b) => b.sentMs - a.sentMs)

  return {
    messageIds: sortedMessages.map((message) => message.xmtpId),
    oldestMessageNs: sortedMessages[sortedMessages.length - 1]?.sentNs || null,
    hasMoreOlder: xmtpMessages.length === DEFAULT_PAGE_SIZE,
  }
}

// Utility functions using the queryOptions pattern
export function getConversationMessagesData(args: IArgs): IConversationMessagesData | undefined {
  const queryKey = getConversationMessagesQueryOptions({
    ...args,
    caller: "getConversationMessagesData",
  }).queryKey
  return reactQueryClient.getQueryData(queryKey)
}

export function setConversationMessagesData(args: IArgs, data: IConversationMessagesData) {
  const queryKey = getConversationMessagesQueryOptions({
    ...args,
    caller: "setConversationMessagesData",
  }).queryKey
  return reactQueryClient.setQueryData(queryKey, data)
}

export function updateConversationMessagesData(
  args: IArgs,
  updater: (current: IConversationMessagesData | undefined) => IConversationMessagesData,
) {
  const queryKey = getConversationMessagesQueryOptions({
    ...args,
    caller: "updateConversationMessagesData",
  }).queryKey
  reactQueryClient.setQueryData(queryKey, updater)
}

// Simple deduplication and sorting utility for message IDs
function mergeAndDeduplicateMessageIds(args: {
  existingMessageIds: IXmtpMessageId[]
  newMessageIds: IXmtpMessageId[]
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}): IXmtpMessageId[] {
  const { existingMessageIds, newMessageIds, clientInboxId, xmtpConversationId } = args

  // Get all unique message IDs
  const allMessageIds = new Set([...existingMessageIds, ...newMessageIds])

  // Convert to array with message data for sorting
  const messagesWithData: Array<{ id: IXmtpMessageId; sentMs: number }> = []

  for (const messageId of allMessageIds) {
    const messageData = getConversationMessageQueryData({
      clientInboxId,
      xmtpMessageId: messageId,
      xmtpConversationId,
    })

    if (messageData) {
      messagesWithData.push({ id: messageId, sentMs: messageData.sentMs })
    }
  }

  // Sort by timestamp (newest first) and limit
  return messagesWithData
    .sort((a, b) => b.sentMs - a.sentMs)
    .slice(0, MAX_CACHED_MESSAGES)
    .map((item) => item.id)
}

// Check for reaction updates on existing messages
export async function checkForReactionUpdates(args: IArgsWithCaller) {
  const currentData = getConversationMessagesData(args)
  if (!currentData?.messageIds.length) return

  // Get a reasonable range of recent messages to check for reaction updates
  // We'll check the most recent 50 messages or all if less than 50
  const messagesToCheck = currentData.messageIds.slice(
    0,
    Math.min(50, currentData.messageIds.length),
  )

  // Get the oldest and newest timestamps from messages we want to check
  const oldestMessageToCheck = await ensureConversationMessageQueryData({
    clientInboxId: args.clientInboxId,
    xmtpMessageId: messagesToCheck[messagesToCheck.length - 1],
    xmtpConversationId: args.xmtpConversationId,
    caller: "checkForReactionUpdates",
  })

  const newestMessageToCheck = await ensureConversationMessageQueryData({
    clientInboxId: args.clientInboxId,
    xmtpMessageId: messagesToCheck[0],
    xmtpConversationId: args.xmtpConversationId,
    caller: "checkForReactionUpdates",
  })

  if (!oldestMessageToCheck || !newestMessageToCheck) return

  // Fetch messages in this range to get updated reactions
  const xmtpMessages = await getXmtpConversationMessagesWithReactions({
    clientInboxId: args.clientInboxId,
    xmtpConversationId: args.xmtpConversationId,
    limit: 50, // Match the number of messages we're checking
    afterNs: oldestMessageToCheck.sentNs - 1000, // Slightly before oldest
    beforeNs: newestMessageToCheck.sentNs + 1000, // Slightly after newest
    direction: "next",
  })

  // Extract and process all reactions from the fetched messages
  const reactions = extractReactionsFromMessages({ xmtpMessages })

  if (reactions.length > 0) {
    processReactionConversationMessages({
      clientInboxId: args.clientInboxId,
      reactionMessages: reactions,
    })
  }

  // Update individual message cache with any new reaction data
  const fetchedMessages = xmtpMessages.map(convertXmtpMessageToConvosMessage)
  for (const message of fetchedMessages) {
    // Only update if we already have this message cached
    if (messagesToCheck.includes(message.xmtpId)) {
      const existingMessage = getConversationMessageQueryData({
        clientInboxId: args.clientInboxId,
        xmtpMessageId: message.xmtpId,
        xmtpConversationId: args.xmtpConversationId,
      })

      if (existingMessage) {
        // Merge with existing message data (server reactions take precedence)
        setConversationMessageQueryData({
          clientInboxId: args.clientInboxId,
          xmtpMessageId: message.xmtpId,
          xmtpConversationId: args.xmtpConversationId,
          message: { ...existingMessage, ...message },
        })
      }
    }
  }
}

// Check for new messages (called by streams, pull-to-refresh, etc.)
export async function checkForNewMessages(args: IArgsWithCaller) {
  const timestampBeforeXmtpFetchMs = Date.now()

  const currentData = getConversationMessagesData(args)
  // Get the newest message data to find its sentNs
  let newestMessageNs: number | undefined
  if (currentData?.messageIds[0]) {
    const newestMessage = await ensureConversationMessageQueryData({
      clientInboxId: args.clientInboxId,
      xmtpMessageId: currentData.messageIds[0],
      xmtpConversationId: args.xmtpConversationId,
      caller: "checkForNewMessages",
    })
    newestMessageNs = newestMessage?.sentNs
  }

  // Get disappearing messages settings
  const disappearingMessagesSettings = await ensureDisappearingMessageSettings({
    clientInboxId: args.clientInboxId,
    xmtpConversationId: args.xmtpConversationId,
    caller: "checkForNewMessages",
  })

  const prioritizeServerResponse = Boolean(
    disappearingMessagesSettings?.retentionDurationInNs &&
      disappearingMessagesSettings?.retentionDurationInNs > 0 &&
      convertNanosecondsToMilliseconds(disappearingMessagesSettings?.retentionDurationInNs) <=
        DEFAULT_GC_TIME_MS,
  )

  // Fetch new messages
  const xmtpMessages = await getXmtpConversationMessagesWithReactions({
    clientInboxId: args.clientInboxId,
    xmtpConversationId: args.xmtpConversationId,
    limit: DEFAULT_PAGE_SIZE,
    ...(newestMessageNs ? { afterNs: newestMessageNs } : {}),
    direction: "next",
  })

  if (xmtpMessages.length === 0) return

  // Convert and extract reactions
  const newMessages = xmtpMessages.map(convertXmtpMessageToConvosMessage)
  const reactions = extractReactionsFromMessages({ xmtpMessages })

  // Cache individual messages (with server data taking precedence)
  for (const message of newMessages) {
    const existingMessage = getConversationMessageQueryData({
      clientInboxId: args.clientInboxId,
      xmtpMessageId: message.xmtpId,
      xmtpConversationId: args.xmtpConversationId,
    })

    if (existingMessage) {
      // Handle disappearing messages logic
      if (prioritizeServerResponse) {
        const fetchDurationMs = Date.now() - timestampBeforeXmtpFetchMs
        const DYNAMIC_GRACE_PERIOD = Math.max(5000, fetchDurationMs + 5000)

        // Keep recent cached messages, update older ones with server data
        if (existingMessage.sentMs >= timestampBeforeXmtpFetchMs - DYNAMIC_GRACE_PERIOD) {
          // Keep cached version for very recent messages
          continue
        }
      }

      // Update with server data (server takes precedence)
      setConversationMessageQueryData({
        clientInboxId: args.clientInboxId,
        xmtpMessageId: message.xmtpId,
        xmtpConversationId: args.xmtpConversationId,
        message: { ...existingMessage, ...message },
      })
    } else {
      // New message, just cache it
      setConversationMessageQueryData({
        clientInboxId: args.clientInboxId,
        xmtpMessageId: message.xmtpId,
        xmtpConversationId: args.xmtpConversationId,
        message,
      })
    }
  }

  // Update cache with merged message IDs
  updateConversationMessagesData(args, (current) => {
    const existingMessageIds = current?.messageIds || []
    const newMessageIds = newMessages.map((m) => m.xmtpId)
    const mergedMessageIds = mergeAndDeduplicateMessageIds({
      existingMessageIds,
      newMessageIds,
      clientInboxId: args.clientInboxId,
      xmtpConversationId: args.xmtpConversationId,
    })

    return {
      messageIds: mergedMessageIds,
      oldestMessageNs: current?.oldestMessageNs || null,
      hasMoreOlder: Boolean(current?.hasMoreOlder ?? true),
    }
  })

  // Process reactions
  if (reactions.length > 0) {
    processReactionConversationMessages({
      clientInboxId: args.clientInboxId,
      reactionMessages: reactions,
    })
  }

  // Update conversation last message
  maybeUpdateConversationQueryLastMessage({
    clientInboxId: args.clientInboxId,
    xmtpConversationId: args.xmtpConversationId,
    messageIds: newMessages.map((m) => m.xmtpId),
  }).catch(captureError)
}

// Combined function: Check for new messages AND reaction updates
export async function checkForNewMessagesAndReactions(args: IArgsWithCaller) {
  // Run both checks in parallel since they operate on different data ranges
  await Promise.all([checkForNewMessages(args), checkForReactionUpdates(args)])
}

// Load older messages (called on scroll)
export async function loadOlderMessages(args: IArgsWithCaller) {
  const currentData = getConversationMessagesData(args)
  if (!currentData?.hasMoreOlder) return

  const oldestMessageNs = currentData.oldestMessageNs

  const xmtpMessages = await getXmtpConversationMessagesWithReactions({
    clientInboxId: args.clientInboxId,
    xmtpConversationId: args.xmtpConversationId,
    limit: DEFAULT_PAGE_SIZE,
    ...(oldestMessageNs ? { beforeNs: oldestMessageNs } : {}),
    direction: "next",
  })

  const olderMessages = xmtpMessages.map(convertXmtpMessageToConvosMessage)
  const reactions = extractReactionsFromMessages({ xmtpMessages })

  // Cache individual messages
  for (const message of olderMessages) {
    setConversationMessageQueryData({
      clientInboxId: args.clientInboxId,
      xmtpMessageId: message.xmtpId,
      xmtpConversationId: args.xmtpConversationId,
      message,
    })
  }

  // Append older messages
  updateConversationMessagesData(args, (current) => {
    const existingMessageIds = current?.messageIds || []
    const olderMessageIds = olderMessages.map((m) => m.xmtpId)
    const allMessageIds = [...existingMessageIds, ...olderMessageIds]

    // Deduplicate and sort
    const mergedMessageIds = mergeAndDeduplicateMessageIds({
      existingMessageIds: allMessageIds,
      newMessageIds: [],
      clientInboxId: args.clientInboxId,
      xmtpConversationId: args.xmtpConversationId,
    })

    return {
      messageIds: mergedMessageIds,
      oldestMessageNs:
        olderMessages[olderMessages.length - 1]?.sentNs || current?.oldestMessageNs || null,
      hasMoreOlder: xmtpMessages.length === DEFAULT_PAGE_SIZE,
    }
  })

  // Process reactions
  if (reactions.length > 0) {
    processReactionConversationMessages({
      clientInboxId: args.clientInboxId,
      reactionMessages: reactions,
    })
  }
}

export function addConversationMessage(args: IArgsWithCaller & { messageIds: IXmtpMessageId[] }) {
  const { messageIds, clientInboxId, xmtpConversationId } = args

  updateConversationMessagesData(args, (current) => {
    const existingMessageIds = current?.messageIds || []
    const mergedMessageIds = mergeAndDeduplicateMessageIds({
      existingMessageIds,
      newMessageIds: messageIds,
      clientInboxId,
      xmtpConversationId,
    })

    return {
      messageIds: mergedMessageIds,
      oldestMessageNs: current?.oldestMessageNs || null,
      hasMoreOlder: Boolean(current?.hasMoreOlder ?? true),
    }
  })

  maybeUpdateConversationQueryLastMessage({
    clientInboxId,
    xmtpConversationId,
    messageIds,
  }).catch(captureError)
}

// Utility to extract reactions from XMTP messages
function extractReactionsFromMessages(args: {
  xmtpMessages: IXmtpDecodedMessage[]
}): IConversationMessageReaction[] {
  const { xmtpMessages } = args
  const reactions: IConversationMessageReaction[] = []

  for (const xmtpMessage of xmtpMessages) {
    // Type assertion since the XMTP SDK returns childMessages but our types don't include it yet
    const messageWithChildren = xmtpMessage
    if (messageWithChildren.childMessages && Array.isArray(messageWithChildren.childMessages)) {
      const childMessages = messageWithChildren.childMessages as IXmtpDecodedMessage[]
      for (const childMessage of childMessages) {
        const convosReaction = convertXmtpMessageToConvosMessage(childMessage)
        if (isReactionMessage(convosReaction)) {
          reactions.push(convosReaction)
        }
      }
    }
  }

  return reactions
}

// Invalidate the query
export function invalidateConversationMessagesQuery(args: IArgs) {
  const queryKey = getConversationMessagesQueryOptions({
    ...args,
    caller: "invalidateConversationMessages",
  }).queryKey
  return reactQueryClient.invalidateQueries({ queryKey })
}

// Prefetch the query
export function prefetchConversationMessages(args: IArgsWithCaller) {
  return reactQueryClient.prefetchQuery(getConversationMessagesQueryOptions(args))
}

// Ensure query data
export function ensureConversationMessages(args: IArgsWithCaller) {
  return reactQueryClient.ensureQueryData(getConversationMessagesQueryOptions(args))
}

export function getAllConversationMessageIds(args: IArgs) {
  const queryKey = getConversationMessagesQueryOptions({
    ...args,
    caller: "getAllConversationMessageIds",
  }).queryKey
  return reactQueryClient.getQueryData(queryKey)?.messageIds
}
