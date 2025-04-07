import { IXmtpConversationId, IXmtpInboxId, IXmtpMessageId } from "@features/xmtp/xmtp.types"
import { MutationOptions, useMutation } from "@tanstack/react-query"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getMessageWithType } from "@/features/conversation/conversation-chat/conversation-message/utils/get-message-with-type"
import { addMessageToConversationMessagesInfiniteQueryData } from "@/features/conversation/conversation-chat/conversation-messages.query"
import {
  addConversationToAllowedConsentConversationsQuery,
  invalidateAllowedConsentConversationsQuery,
  removeConversationFromAllowedConsentConversationsQuery,
} from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
import { IConversation, IConversationTopic } from "@/features/conversation/conversation.types"
import { setConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { convertXmtpConversationToConvosConversation } from "@/features/conversation/utils/convert-xmtp-conversation-to-convos-conversation"
import { TEMP_CONVERSATION_PREFIX } from "@/features/conversation/utils/temp-conversation"
import { setDmQueryData } from "@/features/dm/dm.query"
import { IDm } from "@/features/dm/dm.types"
import { IGroup } from "@/features/groups/group.types"
import { getGroupNameForGroupMembers } from "@/features/groups/hooks/use-group-name"
import { setGroupQueryData } from "@/features/groups/queries/group.query"
import { createXmtpDm } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-dm"
import { createXmtpGroup } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-group"
import { captureError } from "@/utils/capture-error"
import { getTodayNs } from "@/utils/date"
import { entify } from "@/utils/entify"
import { getRandomId } from "@/utils/general"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { ISendMessageParams, sendMessage } from "../../hooks/use-send-message.mutation"

export type ICreateConversationAndSendFirstMessageParams = {
  inboxIds: IXmtpInboxId[]
  contents: ISendMessageParams["contents"]
  tmpXmtpConversationId: IXmtpConversationId
}

type ICreateConversationAndSendFirstMessageContext = {}

export type ICreateConversationAndSendFirstMessageReturnType = Awaited<
  ReturnType<typeof createConversationAndSendFirstMessage>
>

export async function createConversationAndSendFirstMessage(
  args: ICreateConversationAndSendFirstMessageParams,
) {
  const { inboxIds, contents } = args

  if (!inboxIds.length) {
    throw new Error("No inboxIds provided")
  }

  if (!contents.length) {
    throw new Error(`No content provided`)
  }

  const currentSender = getSafeCurrentSender()

  // Create conversation
  const conversation =
    inboxIds.length > 1
      ? await convertXmtpConversationToConvosConversation(
          await createXmtpGroup({
            clientInboxId: currentSender.inboxId,
            inboxIds,
          }),
        )
      : await convertXmtpConversationToConvosConversation(
          await createXmtpDm({
            senderClientInboxId: currentSender.inboxId,
            peerInboxId: inboxIds[0],
          }),
        )

  // Send message
  try {
    const result = await sendMessage({
      xmtpConversationId: conversation.xmtpId,
      contents,
    })

    return {
      conversation,
      sentMessages: result.sentMessages,
      sentXmtpMessageIds: result.sentXmtpMessageIds,
      errorSendingMessage: undefined,
    }
  } catch (error) {
    return {
      conversation,
      sentMessages: undefined,
      sentMessageIds: undefined,
      errorSendingMessage: error,
    }
  }
}

type ICreateConversationAndSendFirstMessageMutationOptions = MutationOptions<
  ICreateConversationAndSendFirstMessageReturnType,
  unknown,
  ICreateConversationAndSendFirstMessageParams,
  ICreateConversationAndSendFirstMessageContext
>

export const getCreateConversationAndSendFirstMessageMutationOptions =
  (): ICreateConversationAndSendFirstMessageMutationOptions => {
    return {
      mutationFn: createConversationAndSendFirstMessage,
      onMutate: ({ inboxIds, contents, tmpXmtpConversationId }) => {
        const currentSender = getSafeCurrentSender()

        const isGroup = inboxIds.length > 1
        const tmpXmtpConversationTopic =
          `${TEMP_CONVERSATION_PREFIX}${getRandomId()}` as IConversationTopic

        const newMemberJoinedOptimisticMessage = getMessageWithType({
          baseMessage: {
            xmtpTopic: tmpXmtpConversationTopic,
            xmtpConversationId: tmpXmtpConversationId,
            xmtpId: getRandomId() as IXmtpMessageId,
            senderInboxId: currentSender.inboxId,
            sentNs: getTodayNs(),
            status: "sending",
          },
          content: {
            initiatedByInboxId: currentSender.inboxId,
            membersAdded: inboxIds.map((inboxId) => ({
              inboxId,
            })),
            membersRemoved: [],
            metadataFieldsChanged: [],
          },
        })

        // Create optimistic messages for each content item
        const contentOptimisticMessages = contents.map((content) => {
          const tmpXmtpMessageId = getRandomId() as IXmtpMessageId

          return getMessageWithType({
            baseMessage: {
              xmtpTopic: tmpXmtpConversationTopic,
              xmtpConversationId: tmpXmtpConversationId,
              xmtpId: tmpXmtpMessageId,
              senderInboxId: currentSender.inboxId,
              sentNs: getTodayNs(),
              status: "sending",
            },
            content,
          })
        })

        // Create optimistic conversation
        let tempConversation: IConversation

        if (isGroup) {
          tempConversation = {
            type: "group",
            createdAt: new Date().getTime(),
            xmtpId: tmpXmtpConversationId,
            name: getGroupNameForGroupMembers({ memberInboxIds: inboxIds }),
            creatorInboxId: currentSender.inboxId,
            description: "",
            addedByInboxId: currentSender.inboxId,
            consentState: "allowed",
            members: entify(
              inboxIds.map((inboxId) => ({
                consentState: currentSender.inboxId === inboxId ? "allowed" : "unknown",
                permission: currentSender.inboxId === inboxId ? "super_admin" : "member",
                inboxId,
              })),
              (member) => member.inboxId,
            ),
            lastMessage: newMemberJoinedOptimisticMessage,
            xmtpTopic: tmpXmtpConversationTopic,
          } satisfies IGroup

          setGroupQueryData({
            clientInboxId: currentSender.inboxId,
            xmtpConversationId: tmpXmtpConversationId,
            group: tempConversation,
          })
        }
        // DM
        else {
          tempConversation = {
            type: "dm",
            createdAt: new Date().getTime(),
            xmtpId: tmpXmtpConversationId,
            peerInboxId: inboxIds[0],
            consentState: "allowed",
            lastMessage: newMemberJoinedOptimisticMessage,
            xmtpTopic: tmpXmtpConversationTopic,
          } satisfies IDm

          setDmQueryData({
            clientInboxId: currentSender.inboxId,
            xmtpConversationId: tmpXmtpConversationId,
            dm: tempConversation,
          })
        }

        // Add to your conversations main list
        addConversationToAllowedConsentConversationsQuery({
          clientInboxId: currentSender.inboxId,
          conversationId: tempConversation.xmtpId,
        })

        // First message should be the new member joined message
        addMessageToConversationMessagesInfiniteQueryData({
          clientInboxId: currentSender.inboxId,
          xmtpConversationId: tmpXmtpConversationId,
          message: newMemberJoinedOptimisticMessage,
        })

        // Then add all the other content optimistic messages to the conversation
        for (const message of contentOptimisticMessages) {
          addMessageToConversationMessagesInfiniteQueryData({
            clientInboxId: currentSender.inboxId,
            xmtpConversationId: tmpXmtpConversationId,
            message,
          })
        }

        return {
          tmpXmtpConversationId,
        }
      },
      onSuccess: (result, variables) => {
        const currentSender = getSafeCurrentSender()

        // The last message of the created conversation will have the new member joined message
        if (result.conversation?.lastMessage) {
          addMessageToConversationMessagesInfiniteQueryData({
            clientInboxId: currentSender.inboxId,
            xmtpConversationId: result.conversation.xmtpId,
            message: result.conversation.lastMessage,
          })
        }

        // Then all the other content messages
        if (result.sentXmtpMessageIds) {
          for (const message of result.sentMessages) {
            addMessageToConversationMessagesInfiniteQueryData({
              clientInboxId: currentSender.inboxId,
              xmtpConversationId: result.conversation.xmtpId,
              message,
            })
          }
        }

        // Set the created conversation in query data
        setConversationQueryData({
          clientInboxId: currentSender.inboxId,
          xmtpConversationId: result.conversation.xmtpId,
          conversation: result.conversation,
        })

        // Add the conversation in the allowed consent conversations query
        addConversationToAllowedConsentConversationsQuery({
          clientInboxId: currentSender.inboxId,
          conversationId: result.conversation.xmtpId,
        })

        // Remove the temp conversation from the allowed consent conversations query
        removeConversationFromAllowedConsentConversationsQuery({
          clientInboxId: currentSender.inboxId,
          conversationId: variables.tmpXmtpConversationId,
        })
      },
      onError: (error, variables, context) => {
        if (!context) {
          return
        }

        const currentSender = getSafeCurrentSender()

        invalidateAllowedConsentConversationsQuery({
          clientInboxId: currentSender.inboxId,
        }).catch(captureError)
      },
    }
  }

export const createConversationAndSendFirstMessageMutation = (args: {
  variables: ICreateConversationAndSendFirstMessageParams
}) => {
  const { variables } = args
  return reactQueryClient
    .getMutationCache()
    .build(reactQueryClient, getCreateConversationAndSendFirstMessageMutationOptions())
    .execute(variables)
}

export function useCreateConversationAndSendFirstMessageMutation() {
  return useMutation(getCreateConversationAndSendFirstMessageMutationOptions())
}
