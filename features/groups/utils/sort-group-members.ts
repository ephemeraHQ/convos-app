import { IGroupMember } from "@/features/groups/group.types"
import {
  getGroupMemberIsAdmin,
  getGroupMemberIsSuperAdmin,
} from "@/features/groups/utils/group-admin.utils"

export function sortGroupMembers(members: IGroupMember[]) {
  return members.sort((a, b) => {
    // Sort super admins first
    if (getGroupMemberIsSuperAdmin({ member: a }) && !getGroupMemberIsSuperAdmin({ member: b })) {
      return -1
    }
    if (!getGroupMemberIsSuperAdmin({ member: a }) && getGroupMemberIsSuperAdmin({ member: b })) {
      return 1
    }

    // Then sort regular admins
    if (getGroupMemberIsAdmin({ member: a }) && !getGroupMemberIsAdmin({ member: b })) {
      return -1
    }
    if (!getGroupMemberIsAdmin({ member: a }) && getGroupMemberIsAdmin({ member: b })) {
      return 1
    }

    return 0
  })
}
