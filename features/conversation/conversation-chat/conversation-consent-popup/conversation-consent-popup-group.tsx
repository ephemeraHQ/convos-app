import { translate } from "@i18n"
import React, { useCallback } from "react"
import { showActionSheet } from "@/components/action-sheet"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ensureConsentForInboxIdQueryData } from "@/features/consent/consent-for-inbox-id.query"
import { useAllowGroupMutation } from "@/features/consent/use-allow-group.mutation"
import {
  ConsentPopupButtonsContainer,
  ConversationConsentPopupButton,
  ConversationConsentPopupContainer,
  ConversationConsentPopupHelperText,
} from "@/features/conversation/conversation-chat/conversation-consent-popup/conversation-consent-popup.design-system"
import { useDeleteConversationsMutation } from "@/features/conversation/conversation-requests-list/delete-conversations.mutation"
import { ensureGroupQueryData } from "@/features/groups/queries/group.query"
import { ensurePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { useRouter } from "@/navigation/use-navigation"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { shortDisplayName } from "@/utils/str"
import { useCurrentXmtpConversationIdSafe } from "../conversation.store-context"

export function ConversationConsentPopupGroup() {
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()
  const currentSender = useSafeCurrentSender()
  const router = useRouter()

  const { mutateAsync: allowGroupAsync } = useAllowGroupMutation({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
  })

  const { mutateAsync: deleteConversationsAsync } = useDeleteConversationsMutation()

  const handleDeleteGroup = useCallback(async () => {
    try {
      const group = await ensureGroupQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
        caller: "ConversationConsentPopupGroup",
      })

      if (!group) {
        throw new Error("Group not found while deleting group in ConversationConsentPopupGroup")
      }

      const hasAllowedConsentForAddedBy = await ensureConsentForInboxIdQueryData({
        clientInboxId: currentSender.inboxId,
        inboxIdToCheck: group.addedByInboxId,
        caller: "ConversationConsentPopupGroup",
      })

      let options = [translate("Delete"), translate("Cancel")]
      let destructiveButtonIndex: number | number[] = 0
      let cancelButtonIndex = 1

      if (hasAllowedConsentForAddedBy === "allowed") {
        const { displayName: addedByDisplayName } = await ensurePreferredDisplayInfo({
          inboxId: group.addedByInboxId,
          caller: "ConversationConsentPopupGroup",
        })
        options = [
          translate("Delete"),
          `Delete and Block ${shortDisplayName(addedByDisplayName)} (invited you)`,
          translate("Cancel"),
        ]
        destructiveButtonIndex = [0, 1]
        cancelButtonIndex = 2
      }

      showActionSheet({
        options: {
          options,
          cancelButtonIndex,
          destructiveButtonIndex,
          title: `If you delete this conversation, you won't be able to see any messages from them anymore.`,
        },
        callback: async (selectedIndex?: number) => {
          if (selectedIndex === 0) {
            await deleteConversationsAsync({
              conversationIds: [xmtpConversationId],
              alsoDenyInviterConsent: false,
            })
            router.goBack()
          } else if (selectedIndex === 1 && hasAllowedConsentForAddedBy === "allowed") {
            await deleteConversationsAsync({
              conversationIds: [xmtpConversationId],
              alsoDenyInviterConsent: true,
            })
            router.goBack()
          }
        },
      })
    } catch (error) {
      captureErrorWithToast(
        new GenericError({ error, additionalMessage: `Failed to delete group` }),
        {
          message: "Failed to delete group",
        },
      )
    }
  }, [deleteConversationsAsync, currentSender.inboxId, xmtpConversationId, router])

  const onAccept = useCallback(async () => {
    try {
      await allowGroupAsync({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
        includeAddedBy: false,
        includeCreator: false,
      })
    } catch (error) {
      captureErrorWithToast(
        new GenericError({ error, additionalMessage: `Failed to allow group` }),
        {
          message: "Failed to allow group",
        },
      )
    }
  }, [allowGroupAsync, currentSender.inboxId, xmtpConversationId])

  return (
    <ConversationConsentPopupContainer>
      <ConsentPopupButtonsContainer>
        <ConversationConsentPopupButton
          variant="fill"
          text={translate("Join the conversation")}
          onPress={onAccept}
        />
        <ConversationConsentPopupButton
          variant="text"
          action="danger"
          text={translate("Delete")}
          onPress={handleDeleteGroup}
        />
        <ConversationConsentPopupHelperText>
          {translate("No one is notified if you delete it")}
        </ConversationConsentPopupHelperText>
      </ConsentPopupButtonsContainer>
    </ConversationConsentPopupContainer>
  )
}
