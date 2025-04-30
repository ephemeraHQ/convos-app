import { IGroupMember } from "@/features/groups/group.types"
import {
  getGroupMemberIsAdmin,
  getGroupMemberIsSuperAdmin,
} from "@/features/groups/utils/group-admin.utils"

export function sortGroupMembers(members: IGroupMember[]) {
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

    return priorityB - priorityA
  })
}
