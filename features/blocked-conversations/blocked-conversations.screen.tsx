import { translate } from "@i18n/index"
import React, { memo } from "react"
import { Screen } from "@/components/screen/screen"
import { EmptyState } from "@/design-system/empty-state"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useBlockedConversationsForCurrentAccount } from "@/features/blocked-conversations/use-blocked-conversations-for-current-account"
import { ConversationList } from "@/features/conversation/conversation-list/conversation-list.component"
import { ConversationRequestsListItemDm } from "@/features/conversation/conversation-requests-list/conversation-requests-list-item-dm"
import { ConversationRequestsListItemGroup } from "@/features/conversation/conversation-requests-list/conversation-requests-list-item-group"
import { useConversationQuery } from "@/features/conversation/queries/conversation.query"
import { isConversationGroup } from "@/features/conversation/utils/is-conversation-group"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { useHeader } from "@/navigation/use-header"
import { useRouter } from "@/navigation/use-navigation"
import { $globalStyles } from "@/theme/styles"

export function BlockedConversationsScreen() {
  const { data: blockedConversationsIds = [] } = useBlockedConversationsForCurrentAccount()

  const router = useRouter()

  useHeader({
    safeAreaEdges: ["top"],
    onBack: () => router.goBack(),
    titleTx: "removed_chats.removed_chats",
  })

  return (
    <Screen contentContainerStyle={$globalStyles.flex1}>
      {blockedConversationsIds.length > 0 ? (
        <ConversationList
          conversationsIds={blockedConversationsIds}
          renderConversation={({ item }) => {
            return <ConversationRequestsListItem xmtpConversationId={item} />
          }}
        />
      ) : (
        <EmptyState
          title={translate("removed_chats.eyes")}
          description={translate("removed_chats.no_removed_chats")}
        />
      )}
    </Screen>
  )
}

const ConversationRequestsListItem = memo(function ConversationRequestsListItem(props: {
  xmtpConversationId: IXmtpConversationId
}) {
  const { xmtpConversationId } = props

  const currentSender = useSafeCurrentSender()

  const { data: conversation } = useConversationQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "ConversationRequestsListItem",
  })

  if (!conversation) {
    return null
  }

  if (isConversationGroup(conversation)) {
    return <ConversationRequestsListItemGroup xmtpConversationId={conversation.xmtpId} />
  }

  return <ConversationRequestsListItemDm xmtpConversationId={conversation.xmtpId} />
})
