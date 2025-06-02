import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { memo, useCallback } from "react"
import { Chip, ChipAvatar, ChipText } from "@/design-system/chip"
import { usePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { useSearchUsersInputStore } from "@/features/search-users/search-users-input.store"

export const SearchUsersInputChip = memo(function SearchUsersInputChip(props: {
  inboxId: IXmtpInboxId
  onPress: (inboxId: IXmtpInboxId) => void
}) {
  const { inboxId, onPress } = props

  const { displayName, avatarUrl } = usePreferredDisplayInfo({
    inboxId,
    caller: "SearchUsersInputChip",
  })

  const selectedChipInboxId = useSearchUsersInputStore((state) => state.selectedChipInboxId)

  const handlePress = useCallback(() => {
    onPress(inboxId)
  }, [inboxId, onPress])

  return (
    <Chip isSelected={selectedChipInboxId === inboxId} onPress={handlePress} size="md">
      <ChipAvatar uri={avatarUrl} name={displayName} />
      <ChipText>{displayName}</ChipText>
    </Chip>
  )
})
