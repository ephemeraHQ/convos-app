import { IGroupMember } from "@/features/groups/group.types"
import {
  getGroupMemberIsAdmin,
  getGroupMemberIsSuperAdmin,
} from "@/features/groups/utils/group-admin.utils"

export type IGroupMemberWithProfile = IGroupMember & {
  profile: {
    name?: string
  }
}

export function sortGroupMembers(members: IGroupMemberWithProfile[]) {
  return [...members].sort((a, b) => {
    // First sort by admin status
    if (getGroupMemberIsSuperAdmin({ member: a }) && !getGroupMemberIsSuperAdmin({ member: b })) return -1
    if (!getGroupMemberIsSuperAdmin({ member: a }) && getGroupMemberIsSuperAdmin({ member: b })) return 1
    if (getGroupMemberIsAdmin({ member: a }) && !getGroupMemberIsAdmin({ member: b })) return -1
    if (!getGroupMemberIsAdmin({ member: a }) && getGroupMemberIsAdmin({ member: b })) return 1
    
    // Then check for names
    const hasNameA = !!(a.profile.name && !a.profile.name.startsWith("0x"))
    const hasNameB = !!(b.profile.name && !b.profile.name.startsWith("0x"))
    
    if (hasNameA && !hasNameB) return -1
    if (!hasNameA && hasNameB) return 1
    
    // If both have names, sort alphabetically
    if (hasNameA && hasNameB) {
      return a.profile.name!.localeCompare(b.profile.name!)
    }
    
    // Otherwise sort by inboxId for consistency
    return a.inboxId.localeCompare(b.inboxId)
  })
}
