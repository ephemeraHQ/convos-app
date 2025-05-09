import { IGroupMember } from "@/features/groups/group.types"
import {
  getGroupMemberIsAdmin,
  getGroupMemberIsSuperAdmin,
} from "@/features/groups/utils/group-admin.utils"
import { IConvosProfile } from "@/features/profiles/profiles.types"

/**
 * Sorts group members by priority first, then prioritizes members with display names,
 * and finally sorts alphabetically by display name if profiles are available
 */
export function sortGroupMembers(
  members: IGroupMember[],
  cachedProfiles?: Record<string, IConvosProfile | undefined>
) {
  return members.sort((a, b) => {
    const getMemberPriority = (member: IGroupMember): number => {
      if (getGroupMemberIsSuperAdmin({ member })) return 4
      if (getGroupMemberIsAdmin({ member })) return 3
      if (member.consentState === "allowed") return 2
      if (member.consentState === "denied") return 0
      return 1
    }

    const priorityA = getMemberPriority(a)
    const priorityB = getMemberPriority(b)

    // First sort by priority
    if (priorityB !== priorityA) {
      return priorityB - priorityA
    }
    
    // If we have cached profiles
    if (cachedProfiles) {
      const profileA = cachedProfiles[a.inboxId]
      const profileB = cachedProfiles[b.inboxId]
      
      // Prioritize members with display names over those without
      const hasNameA = !!profileA?.name
      const hasNameB = !!profileB?.name
      
      if (hasNameA && !hasNameB) {
        return -1 // A has name, B doesn't -> A comes first
      }
      
      if (!hasNameA && hasNameB) {
        return 1 // B has name, A doesn't -> B comes first
      }
      
      // If both have names, sort alphabetically
      if (profileA?.name && profileB?.name) {
        return profileA.name.localeCompare(profileB.name)
      }
    }
    
    // Default to keeping the current order if we can't sort by name
    return 0
  })
}
