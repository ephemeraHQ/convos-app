import { IGroupMember } from "@/features/groups/group.types"
import {
  getGroupMemberIsAdmin,
  getGroupMemberIsSuperAdmin,
} from "@/features/groups/utils/group-admin.utils"
import { getPreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"

export function sortGroupMembers(members: IGroupMember[]) {
  // Pre-compute all display info first to avoid recalculations during sort
  const memberDisplayInfo = new Map<string, { displayName?: string }>()
  
  for (const member of members) {
    memberDisplayInfo.set(
      member.inboxId, 
      getPreferredDisplayInfo({ inboxId: member.inboxId })
    )
  }
  
  return members.sort((a, b) => {
    const getMemberPriority = (member: IGroupMember): number => {
      const displayInfo = memberDisplayInfo.get(member.inboxId)
      const hasDisplayName = !!(displayInfo?.displayName && displayInfo.displayName !== member.inboxId && !displayInfo.displayName.startsWith("0x"))
      
      // Create a compound priority: admin status (high bits) + display name presence (low bit)
      if (getGroupMemberIsSuperAdmin({ member })) return hasDisplayName ? 7 : 6
      if (getGroupMemberIsAdmin({ member })) return hasDisplayName ? 5 : 4
      return hasDisplayName ? 3 : 0  // Regular members with display names are prioritized
    }

    const priorityA = getMemberPriority(a)
    const priorityB = getMemberPriority(b)

    // First sort by combined priority 
    if (priorityB !== priorityA) {
      return priorityB - priorityA
    }
    
    // Then sort alphabetically by display name
    const displayNameA = memberDisplayInfo.get(a.inboxId)?.displayName || a.inboxId
    const displayNameB = memberDisplayInfo.get(b.inboxId)?.displayName || b.inboxId
    
    return displayNameA.localeCompare(displayNameB)
  })
}
