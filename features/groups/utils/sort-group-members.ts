import { IGroupMember } from "@/features/groups/group.types"
import {
  getGroupMemberIsAdmin,
  getGroupMemberIsSuperAdmin,
} from "@/features/groups/utils/group-admin.utils"
import { getPreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"

// Type that includes optional profile information
export type IGroupMemberWithProfile = IGroupMember & {
  profile?: {
    name?: string
    avatar?: string
  } | null
}

export function sortGroupMembers(members: IGroupMember[] | IGroupMemberWithProfile[]) {
  // First sort by admin status
  const sortedByAdmin = [...members].sort((a, b) => {
    // Create priority based on admin status
    const getPriority = (member: IGroupMember): number => {
      if (getGroupMemberIsSuperAdmin({ member })) return 2
      if (getGroupMemberIsAdmin({ member })) return 1
      return 0
    }

    const priorityA = getPriority(a)
    const priorityB = getPriority(b)

    // Sort by priority (higher first)
    return priorityB - priorityA
  })

  // Check if we have profile information in the members
  const hasProfiles = sortedByAdmin.some(m => 'profile' in m && m.profile)

  if (hasProfiles) {
    // If members have profiles, use those directly
    return enhanceSortWithProfiles(sortedByAdmin as IGroupMemberWithProfile[])
  } else {
    // Otherwise, get profile info and then sort
    const withProfiles = getProfilesAndEnhanceSort(sortedByAdmin)
    return withProfiles
  }
}

// Sort with profile information that's already included in the members
function enhanceSortWithProfiles(members: IGroupMemberWithProfile[]) {
  return members.sort((a, b) => {
    // First preserve admin sort order
    if (a.permission === "super_admin" && b.permission !== "super_admin") return -1
    if (a.permission !== "super_admin" && b.permission === "super_admin") return 1
    if (a.permission === "admin" && b.permission !== "admin") return -1
    if (a.permission !== "admin" && b.permission === "admin") return 1
    
    // Then check for names
    const hasNameA = !!(a.profile?.name && !a.profile.name.startsWith("0x"))
    const hasNameB = !!(b.profile?.name && !b.profile.name.startsWith("0x"))
    
    if (hasNameA && !hasNameB) return -1
    if (!hasNameA && hasNameB) return 1
    
    // If both have names, sort alphabetically
    if (hasNameA && hasNameB) {
      return a.profile!.name!.localeCompare(b.profile!.name!)
    }
    
    // Otherwise keep original order
    return 0
  })
}

// Get profile information and then enhance the sort
function getProfilesAndEnhanceSort(members: IGroupMember[]) {
  // Pre-compute all display info
  const memberDisplayInfo = new Map<string, { displayName?: string }>()
  
  for (const member of members) {
    memberDisplayInfo.set(
      member.inboxId, 
      getPreferredDisplayInfo({ inboxId: member.inboxId })
    )
  }
  
  return members.sort((a, b) => {
    // First preserve admin sort order
    if (a.permission === "super_admin" && b.permission !== "super_admin") return -1
    if (a.permission !== "super_admin" && b.permission === "super_admin") return 1
    if (a.permission === "admin" && b.permission !== "admin") return -1
    if (a.permission !== "admin" && b.permission === "admin") return 1
    
    // Then check for display names
    const displayInfoA = memberDisplayInfo.get(a.inboxId)
    const displayInfoB = memberDisplayInfo.get(b.inboxId)
    
    const hasNameA = !!(displayInfoA?.displayName && 
                     displayInfoA.displayName !== a.inboxId && 
                     !displayInfoA.displayName.startsWith("0x"))
    const hasNameB = !!(displayInfoB?.displayName && 
                     displayInfoB.displayName !== b.inboxId && 
                     !displayInfoB.displayName.startsWith("0x"))
    
    if (hasNameA && !hasNameB) return -1
    if (!hasNameA && hasNameB) return 1
    
    // If both have display names, sort alphabetically
    if (hasNameA && hasNameB) {
      return displayInfoA!.displayName!.localeCompare(displayInfoB!.displayName!)
    }
    
    // Otherwise sort by inboxId for consistency
    return a.inboxId.localeCompare(b.inboxId)
  })
}
