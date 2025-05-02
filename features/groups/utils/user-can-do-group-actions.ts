import type { PermissionPolicySet } from "@xmtp/react-native-sdk/build/lib/types/PermissionPolicySet"

type MemberRole = "admin" | "superAdmin" | "member"

type GetMemberRoleParams = {
  isSuperAdmin: boolean
  isAdmin: boolean
}

export const getMemberRole = ({ isSuperAdmin, isAdmin }: GetMemberRoleParams): MemberRole => {
  if (isSuperAdmin) return "superAdmin"
  if (isAdmin) return "admin"
  return "member"
}

type UserCanDoGroupActionsParams = {
  groupPermissionPolicy: PermissionPolicySet | undefined
  action: keyof PermissionPolicySet
  isSuperAdmin: boolean
  isAdmin: boolean
}

export const userCanDoGroupActions = (args: UserCanDoGroupActionsParams) => {
  const { groupPermissionPolicy, action, isSuperAdmin, isAdmin } = args
  
  if (!groupPermissionPolicy) return false
  
  const memberRole = getMemberRole({ isSuperAdmin, isAdmin })
  const policy = groupPermissionPolicy[action]

  // Permission rules based on policy
  if (policy === "allow") return true
  if (policy === "deny") return false
  if (policy === "admin" && (memberRole === "admin" || memberRole === "superAdmin")) return true
  if (policy === "superAdmin" && memberRole === "superAdmin") return true
  
  return false
}
