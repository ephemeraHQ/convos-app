// import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
// import { MutationOptions } from "@tanstack/react-query"
// import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
// import { removeConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
// import {
//   addConversationToAllowedConsentConversationsQuery,
//   removeConversationFromAllowedConsentConversationsQuery,
// } from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
// import {
//   removeConversationQueryData,
//   setConversationQueryData,
// } from "@/features/conversation/queries/conversation.query"
// import { convertXmtpConversationToConvosConversation } from "@/features/conversation/utils/convert-xmtp-conversation-to-convos-conversation"
// import { defaultConversationDisappearingMessageSettings } from "@/features/disappearing-messages/disappearing-messages.constants"
// import { IGroup, IGroupMember } from "@/features/groups/group.types"
// import { setGroupQueryData } from "@/features/groups/queries/group.query"
// import { createXmtpDm } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-dm"
// import {
//   addXmtpGroupMembers,
//   createXmtpGroupOptimistically,
// } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-group"
// import { syncOneXmtpConversation } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-sync"
// import { captureError, captureErrorWithToast } from "@/utils/capture-error"
// import { ReactQueryError } from "@/utils/error"
// import { reactQueryClient } from "@/utils/react-query/react-query.client"
// import {
//   handleOptimisticMessagesSent,
//   ISendMessageOptimisticallyParams,
//   sendMessageOptimistically,
// } from "../../hooks/use-send-message.mutation"

// export type ICreateConversationAndSendFirstMessageParams = {
//   inboxIds: IXmtpInboxId[]
//   contents: ISendMessageOptimisticallyParams["contents"]
// }

// export type ICreateConversationAndSendFirstMessageReturnType = Awaited<
//   ReturnType<typeof createConversationAndSendFirstMessage>
// >

// export async function createConversationAndSendFirstMessage(
//   args: ICreateConversationAndSendFirstMessageParams,
// ) {
//   const { inboxIds, contents } = args

//   if (!inboxIds.length) {
//     throw new Error("No inboxIds provided")
//   }

//   if (!contents.length) {
//     throw new Error(`No content provided`)
//   }

//   const currentSender = getSafeCurrentSender()

//   // Create conversation
//   const conversation =
//     inboxIds.length > 1
//       ? await convertXmtpConversationToConvosConversation(
//           await createXmtpGroupOptimistically({
//             clientInboxId: currentSender.inboxId,
//             ...(defaultConversationDisappearingMessageSettings.retentionDurationInNs > 0 && {
//               disappearingMessageSettings: defaultConversationDisappearingMessageSettings,
//             }),
//           }),
//         )
//       : await convertXmtpConversationToConvosConversation(
//           await createXmtpDm({
//             senderClientInboxId: currentSender.inboxId,
//             peerInboxId: inboxIds[0],
//             ...(defaultConversationDisappearingMessageSettings.retentionDurationInNs > 0 && {
//               disappearingMessageSettings: defaultConversationDisappearingMessageSettings,
//             }),
//           }),
//         )

//   // Send message
//   try {
//     const sentMessages = await sendMessageOptimistically({
//       xmtpConversationId: conversation.xmtpId,
//       contents,
//     })

//     return {
//       conversation,
//       sentMessages,
//       errorSendingMessage: undefined,
//       inboxIdsToAdd: inboxIds.length > 1 ? inboxIds : undefined,
//     }
//   } catch (error) {
//     captureError(
//       new ReactQueryError({
//         error,
//         additionalMessage: `Error sending message optimistically`,
//       }),
//     )

//     // We still want to return the conversation so that the UI can still be updated
//     return {
//       conversation,
//       sentMessages: undefined,
//       errorSendingMessage: error,
//       // Just used for groups
//       inboxIdsToAdd: inboxIds.length > 1 ? inboxIds : undefined,
//     }
//   }
// }

// type ICreateConversationAndSendFirstMessageMutationOptions = MutationOptions<
//   ICreateConversationAndSendFirstMessageReturnType,
//   unknown,
//   ICreateConversationAndSendFirstMessageParams
// >

// export const getCreateConversationAndSendFirstMessageMutationOptions =
//   (): ICreateConversationAndSendFirstMessageMutationOptions => {
//     return {
//       mutationFn: createConversationAndSendFirstMessage,
//       onSuccess: (result, variables, context) => {
//         console.log("success")

//         const currentSender = getSafeCurrentSender()
//         const isDm = !result.inboxIdsToAdd || result.inboxIdsToAdd.length === 1

//         if (isDm) {
//           // Handle the optimistic messages
//           if (result.sentMessages) {
//             handleOptimisticMessagesSent({
//               optimisticMessages: result.sentMessages,
//               xmtpConversationId: result.conversation.xmtpId,
//             }).catch(captureError)
//           }

//           // Handle the new conversation
//           setConversationQueryData({
//             clientInboxId: currentSender.inboxId,
//             xmtpConversationId: result.conversation.xmtpId,
//             conversation: result.conversation,
//           })
//           addConversationToAllowedConsentConversationsQuery({
//             clientInboxId: currentSender.inboxId,
//             conversationId: result.conversation.xmtpId,
//           })
//           return
//         }

//         // Handle groups created optimistically
//         const group = result.conversation as IGroup

//         console.log("[createConversationAndSendFirstMessage] Setting group query data", {
//           clientInboxId: currentSender.inboxId,
//           xmtpConversationId: result.conversation.xmtpId,
//           group,
//         })

//         setGroupQueryData({
//           clientInboxId: currentSender.inboxId,
//           xmtpConversationId: result.conversation.xmtpId,
//           group: {
//             ...group,
//             type: "group",
//             addedByInboxId: currentSender.inboxId,
//             creatorInboxId: currentSender.inboxId,
//             // Add the members optimistically
//             members: {
//               ids: [currentSender.inboxId, ...result.inboxIdsToAdd!],
//               byId: [currentSender.inboxId, ...result.inboxIdsToAdd!].reduce(
//                 (acc, inboxId) => {
//                   acc[inboxId] = {
//                     inboxId,
//                     permission: inboxId === currentSender.inboxId ? "admin" : "member",
//                     consentState: "allowed",
//                   }
//                   return acc
//                 },
//                 {} as Record<string, IGroupMember>,
//               ),
//             },
//           },
//         })

//         console.log(
//           "[createConversationAndSendFirstMessage] Adding conversation to allowed consent",
//           {
//             clientInboxId: currentSender.inboxId,
//             conversationId: result.conversation.xmtpId,
//           },
//         )

//         // Add the conversation to the allowed consent conversations
//         addConversationToAllowedConsentConversationsQuery({
//           clientInboxId: currentSender.inboxId,
//           conversationId: result.conversation.xmtpId,
//         })

//         console.log(
//           "[createConversationAndSendFirstMessage] Starting group sync and member addition",
//         )

//         // Sync the group to make it available on the network
//         syncOneXmtpConversation({
//           clientInboxId: currentSender.inboxId,
//           xmtpConversationId: result.conversation.xmtpId,
//           caller: "createConversationAndSendFirstMessage-onSuccess",
//         })
//           .then(async () => {
//             console.log(
//               "[createConversationAndSendFirstMessage] Group sync complete, adding members",
//               {
//                 inboxIds: result.inboxIdsToAdd,
//               },
//             )

//             // First add the group members
//             await addXmtpGroupMembers({
//               clientInboxId: currentSender.inboxId,
//               groupId: result.conversation.xmtpId,
//               inboxIds: result.inboxIdsToAdd!,
//             })

//             console.log(
//               "[createConversationAndSendFirstMessage] Members added, handling optimistic messages",
//               {
//                 hasMessages: !!result.sentMessages,
//               },
//             )

//             // Then handle the optimistic messages because we want the group update for added members to be before the messages
//             if (result.sentMessages) {
//               await handleOptimisticMessagesSent({
//                 optimisticMessages: result.sentMessages,
//                 xmtpConversationId: result.conversation.xmtpId,
//               })
//             }
//           })
//           .catch((error) => {
//             console.log(
//               "[createConversationAndSendFirstMessage] Error during sync/member addition",
//               {
//                 error,
//               },
//             )

//             // If sync or addMembers fails, we need to clean up
//             captureErrorWithToast(
//               new ReactQueryError({
//                 error,
//                 additionalMessage: "Failed to sync group or add members",
//               }),
//               {
//                 message: "Failed to create group. Please try again.",
//               },
//             )

//             console.log("[createConversationAndSendFirstMessage] Starting cleanup after error")

//             // Remove the conversation from query data
//             removeConversationFromAllowedConsentConversationsQuery({
//               clientInboxId: currentSender.inboxId,
//               conversationId: result.conversation.xmtpId,
//             })

//             // Remove the conversation query data
//             removeConversationQueryData({
//               clientInboxId: currentSender.inboxId,
//               xmtpConversationId: result.conversation.xmtpId,
//             })

//             // Remove any messages that were sent
//             if (result.sentMessages) {
//               for (const message of result.sentMessages) {
//                 removeConversationMessageQueryData({
//                   clientInboxId: currentSender.inboxId,
//                   xmtpConversationId: result.conversation.xmtpId,
//                   xmtpMessageId: message.xmtpId,
//                 })
//               }
//             }

//             throw error
//           })
//       },
//     }
//   }

// export const createConversationAndSendFirstMessageMutation = (args: {
//   variables: ICreateConversationAndSendFirstMessageParams
// }) => {
//   const { variables } = args
//   return reactQueryClient
//     .getMutationCache()
//     .build(reactQueryClient, getCreateConversationAndSendFirstMessageMutationOptions())
//     .execute(variables)
// }
