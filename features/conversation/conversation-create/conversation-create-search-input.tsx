import React, { memo, useCallback, useEffect, useRef } from "react"
import { TextInput as RNTextInput } from "react-native"
import {
  useConversationStore,
  useConversationStoreContext,
} from "@/features/conversation/conversation-chat/conversation.store-context"
import { SearchUsersInput } from "@/features/search-users/search-users-input"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"

export const ConversationCreateSearchInput = memo(function ConversationCreateSearchInput() {
  const inputRef = useRef<RNTextInput | null>(null)

  const selectedSearchUserInboxIds = useConversationStoreContext(
    (state) => state.searchSelectedUserInboxIds,
  )
  const conversationStore = useConversationStore()

  const handleSearchTextChange = useCallback(
    (text: string) => {
      conversationStore.setState({ searchTextValue: text })
    },
    [conversationStore],
  )

  const handleSelectedInboxIdsChange = useCallback(
    (inboxIds: IXmtpInboxId[]) => {
      conversationStore.setState({ searchSelectedUserInboxIds: inboxIds })
    },
    [conversationStore],
  )

  //
  useEffect(() => {
    conversationStore.subscribe(
      (state) => state.searchTextValue,
      (searchTextValue) => {
        if (searchTextValue === "") {
          inputRef.current?.clear()
        }
      },
    )
  }, [conversationStore])

  return (
    <SearchUsersInput
      inputRef={inputRef}
      searchSelectedUserInboxIds={selectedSearchUserInboxIds}
      onSearchTextChange={handleSearchTextChange}
      onSelectedInboxIdsChange={handleSelectedInboxIdsChange}
    />
  )
})
