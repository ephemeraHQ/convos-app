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
import { IConvosProfile } from "@/features/profiles/profiles.types"

export const MemberListItem = memo(function MemberListItem(props: { 
  memberInboxId: IXmtpInboxId,
  cachedProfile?: IConvosProfile
}) {
  const { memberInboxId, cachedProfile } = props

  const { xmtpConversationId } = useRouteParams<"GroupDetails">()

  // Always call the hook
  const preferredDisplayInfo = usePreferredDisplayInfo({
    inboxId: memberInboxId,
    caller: "MemberListItem",
    // Only fetch if we don't have a cached profile
    enabled: !cachedProfile
  })

  // Use either cached profile data or fetched data
  const displayName = cachedProfile?.name || preferredDisplayInfo.displayName
  const avatarUrl = cachedProfile?.avatar || preferredDisplayInfo.avatarUrl

  const handlePress = useCallback(() => {
    openGroupMemberDetailsBottomSheet(memberInboxId)
  }, [memberInboxId])

  const { groupMember } = useGroupMember({
    memberInboxId,
    xmtpConversationId,
  })

  // Create a simpler subtitle with just admin status and consent state
  const subtitle = useMemo(() => {
    if (!groupMember) {
      return undefined
    }

    let role = ""
    
    if (getGroupMemberIsSuperAdmin({ member: groupMember })) {
      role = "Super Admin"
    } else if (getGroupMemberIsAdmin({ member: groupMember })) {
      role = "Admin"
    }
    
    // Show consent state in debug mode
    const consentState = `(${groupMember.consentState})`
    
    if (role) {
      return `${role} ${consentState}`
    }
    
    return consentState
  }, [groupMember])

  return (
    <Pressable onPress={handlePress}>
      <GroupDetailsListItem
        avatarSource={avatarUrl}
        avatarName={displayName}
        title={displayName}
        subtitle={subtitle}
      />
    </Pressable>
  )
})
