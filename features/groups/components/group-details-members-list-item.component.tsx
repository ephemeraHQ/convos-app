import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { memo, useCallback, useMemo } from "react"
import { Pressable } from "@/design-system/Pressable"
import { useGroupMember } from "@/features/groups/hooks/use-group-member"
import { GroupDetailsListItem } from "@/features/groups/ui/group-details.ui"
import {
  getGroupMemberIsAdmin,
  getGroupMemberIsSuperAdmin,
} from "@/features/groups/utils/group-admin.utils"
import { usePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { useRouteParams } from "@/navigation/use-navigation"
import { openGroupMemberDetailsBottomSheet } from "./group-member-details/group-member-details.service"

export const MemberListItem = memo(function MemberListItem(props: { memberInboxId: IXmtpInboxId }) {
  const { memberInboxId } = props

  const { xmtpConversationId } = useRouteParams<"GroupDetails">()

  const { displayName, avatarUrl } = usePreferredDisplayInfo({
    inboxId: memberInboxId,
  })

  const handlePress = useCallback(() => {
    openGroupMemberDetailsBottomSheet(memberInboxId)
  }, [memberInboxId])

  const { groupMember } = useGroupMember({
    memberInboxId,
    xmtpConversationId,
  })

  const subtitle = useMemo(() => {
    if (!groupMember) {
      return undefined
    }

    // Only show admin status, not consent state
    return getGroupMemberIsSuperAdmin({ member: groupMember })
      ? "Super Admin"
      : getGroupMemberIsAdmin({ member: groupMember })
        ? "Admin"
        : undefined
  }, [groupMember])

  return (
    <Pressable onPress={handlePress}>
      <GroupDetailsListItem
        avatar={avatarUrl}
        avatarName={displayName}
        title={displayName}
        subtitle={subtitle}
      />
    </Pressable>
  )
})
