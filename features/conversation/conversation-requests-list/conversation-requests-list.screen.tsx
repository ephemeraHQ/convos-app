import { memo, useCallback, useState } from "react"
import { Screen } from "@/components/screen/screen"
import { ConversationList } from "@/features/conversation/conversation-list/conversation-list.component"
import { ConversationRequestsToggle } from "@/features/conversation/conversation-requests-list/conversation-requests-list-toggle"
import { useConversationRequestsListScreenHeader } from "@/features/conversation/conversation-requests-list/conversation-requests-list.screen-header"
import { useBetterFocusEffect } from "@/hooks/use-better-focus-effect"
import { translate } from "@/i18n"
import { $globalStyles } from "@/theme/styles"
import { captureError } from "@/utils/capture-error"
import { useConversationRequestsListItem } from "./use-conversation-requests-list-items"

export type ITab = "you-might-know" | "hidden"

export const ConversationRequestsListScreen = memo(function () {
  const [selectedTab, setSelectedTab] = useState<ITab>("you-might-know")

  useConversationRequestsListScreenHeader({ selectedTab })

  const handleToggleSelect = useCallback((tab: ITab) => {
    setSelectedTab(tab)
  }, [])

  return (
    <Screen contentContainerStyle={$globalStyles.flex1}>
      <ConversationRequestsToggle
        options={[
          { label: translate("You might know"), value: "you-might-know" },
          { label: translate("Hidden"), value: "hidden" },
        ]}
        selectedTab={selectedTab}
        onSelect={handleToggleSelect}
      />

      <ConversationListWrapper selectedTab={selectedTab} />
    </Screen>
  )
})

const ConversationListWrapper = memo(function ConversationListWrapper({
  selectedTab,
}: {
  selectedTab: ITab
}) {
  const { likelyNotSpamConversationIds, likelySpamConversationIds, refetch } =
    useConversationRequestsListItem()

  useBetterFocusEffect(
    useCallback(() => {
      refetch().catch(captureError)
    }, [refetch]),
  )

  return (
    <ConversationList
      conversationsIds={
        selectedTab === "you-might-know" ? likelyNotSpamConversationIds : likelySpamConversationIds
      }
    />
  )
})
