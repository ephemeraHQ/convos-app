import { translate } from "@i18n"
import React, { useCallback } from "react"
import { showActionSheet } from "@/components/action-sheet"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useAllowDmMutation } from "@/features/consent/use-allow-dm.mutation"
import { useDeleteConversationsMutation } from "@/features/conversation/conversation-requests-list/delete-conversations.mutation"
import { useDmQuery } from "@/features/dm/dm.query"
import { useRouter } from "@/navigation/use-navigation"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { useCurrentXmtpConversationIdSafe } from "../conversation.store-context"
import {
  ConsentPopupButtonsContainer,
  ConversationConsentPopupButton,
  ConversationConsentPopupContainer,
  ConversationConsentPopupHelperText,
} from "./conversation-consent-popup.design-system"

export function ConversationConsentPopupDm() {
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()
  const currentSenderInboxId = useSafeCurrentSender().inboxId

  const { data: dm } = useDmQuery({
    clientInboxId: currentSenderInboxId,
    xmtpConversationId,
    caller: "ConversationConsentPopupDm",
  })

  const navigation = useRouter()

  const { mutateAsync: deleteConversationsAsync } = useDeleteConversationsMutation()
  const { mutateAsync: allowDmConsentAsync } = useAllowDmMutation()

  const handleDelete = useCallback(async () => {
    if (!dm) {
      throw new Error("Dm not found")
    }

    showActionSheet({
      options: {
        options: [translate("Delete"), translate("Cancel")],
        cancelButtonIndex: 1,
        destructiveButtonIndex: 0,
        title: `If you delete this conversation, you won't be able to see any messages from them anymore.`,
      },
      callback: async (selectedIndex?: number) => {
        if (selectedIndex === 0) {
          try {
            await deleteConversationsAsync({
              conversationIds: [xmtpConversationId],
              alsoDenyInviterConsent: true, // If we delete here it's almost certain we also don't want to see any messages from them anymore
            })
            navigation.pop()
          } catch (error) {
            captureErrorWithToast(
              new GenericError({ error, additionalMessage: "Error consenting" }),
              {
                message: "Error deleting conversation",
              },
            )
          }
        }
      },
    })
  }, [navigation, deleteConversationsAsync, dm, xmtpConversationId])

  const handleAccept = useCallback(async () => {
    try {
      if (!dm) {
        throw new Error("DM not found")
      }

      await allowDmConsentAsync({
        xmtpConversationId,
      })
    } catch (error) {
      captureErrorWithToast(new GenericError({ error, additionalMessage: "Error consenting" }), {
        message: "Error joining conversation",
      })
    }
  }, [allowDmConsentAsync, dm, xmtpConversationId])

  return (
    <ConversationConsentPopupContainer>
      <ConsentPopupButtonsContainer>
        <ConversationConsentPopupButton
          variant="fill"
          text={translate("Join the conversation")}
          onPress={handleAccept}
        />
        <ConversationConsentPopupButton
          variant="text"
          action="danger"
          text={translate("Delete")}
          onPress={handleDelete}
        />
        <ConversationConsentPopupHelperText>
          {translate("They won't be notified if you delete it")}
        </ConversationConsentPopupHelperText>
      </ConsentPopupButtonsContainer>
    </ConversationConsentPopupContainer>
  )
}
