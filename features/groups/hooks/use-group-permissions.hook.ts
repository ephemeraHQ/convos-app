import { IXmtpConversationId } from "@features/xmtp/xmtp.types"
import { useMemo } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useCurrentSenderGroupMember } from "@/features/groups/hooks/use-current-sender-group-member"
import { useGroupPermissionsQuery } from "@/features/groups/queries/group-permissions.query"
import { 
  getGroupMemberIsAdmin, 
  getGroupMemberIsSuperAdmin 
} from "@/features/groups/utils/group-admin.utils"
import { userCanDoGroupActions } from "@/features/groups/utils/user-can-do-group-actions"

export type GroupPermissionAction = 
  | "addMemberPolicy"
  | "removeMemberPolicy"
  | "addAdminPolicy"
  | "removeAdminPolicy" 
  | "updateGroupNamePolicy"
  | "updateGroupDescriptionPolicy"
  | "updateGroupImagePolicy"
  | "updateMessageDisappearingPolicy"

export function useGroupPermissions(args: { xmtpConversationId: IXmtpConversationId }) {
  const { xmtpConversationId } = args
  const currentSender = useSafeCurrentSender()
  
  // Get the current user's group member information
  const { currentSenderGroupMember } = useCurrentSenderGroupMember({
    xmtpConversationId,
  })
  
  // Get the group's permission policy
  const { data: permissionPolicy } = useGroupPermissionsQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "useGroupPermissions",
  })
  
  // Check if the current user is an admin or super admin
  const isSuperAdmin = useMemo(
    () => 
      !!currentSenderGroupMember && 
      getGroupMemberIsSuperAdmin({ member: currentSenderGroupMember }),
    [currentSenderGroupMember]
  )
  
  const isAdmin = useMemo(
    () => 
      !!currentSenderGroupMember && 
      getGroupMemberIsAdmin({ member: currentSenderGroupMember }),
    [currentSenderGroupMember]
  )
  
  // Create permission check functions for each action
  const canAddMembers = useMemo(
    () => userCanDoGroupActions(permissionPolicy, "addMemberPolicy", isSuperAdmin, isAdmin),
    [permissionPolicy, isSuperAdmin, isAdmin]
  )
  
  const canRemoveMembers = useMemo(
    () => userCanDoGroupActions(permissionPolicy, "removeMemberPolicy", isSuperAdmin, isAdmin),
    [permissionPolicy, isSuperAdmin, isAdmin]
  )
  
  const canAddAdmins = useMemo(
    () => userCanDoGroupActions(permissionPolicy, "addAdminPolicy", isSuperAdmin, isAdmin),
    [permissionPolicy, isSuperAdmin, isAdmin]
  )
  
  const canRemoveAdmins = useMemo(
    () => userCanDoGroupActions(permissionPolicy, "removeAdminPolicy", isSuperAdmin, isAdmin),
    [permissionPolicy, isSuperAdmin, isAdmin]
  )
  
  const canUpdateGroupName = useMemo(
    () => userCanDoGroupActions(permissionPolicy, "updateGroupNamePolicy", isSuperAdmin, isAdmin),
    [permissionPolicy, isSuperAdmin, isAdmin]
  )
  
  const canUpdateGroupDescription = useMemo(
    () => userCanDoGroupActions(permissionPolicy, "updateGroupDescriptionPolicy", isSuperAdmin, isAdmin),
    [permissionPolicy, isSuperAdmin, isAdmin]
  )
  
  const canUpdateGroupImage = useMemo(
    () => userCanDoGroupActions(permissionPolicy, "updateGroupImagePolicy", isSuperAdmin, isAdmin),
    [permissionPolicy, isSuperAdmin, isAdmin]
  )
  
  const canUpdateMessageDisappearing = useMemo(
    () => userCanDoGroupActions(permissionPolicy, "updateMessageDisappearingPolicy", isSuperAdmin, isAdmin),
    [permissionPolicy, isSuperAdmin, isAdmin]
  )

  // Function to check any permission dynamically
  const checkPermission = (action: GroupPermissionAction) => 
    userCanDoGroupActions(permissionPolicy, action, isSuperAdmin, isAdmin)
  
  return {
    // User roles
    isSuperAdmin,
    isAdmin,
    
    // Specific permissions
    canAddMembers,
    canRemoveMembers,
    canAddAdmins,
    canRemoveAdmins,
    canUpdateGroupName,
    canUpdateGroupDescription,
    canUpdateGroupImage,
    canUpdateMessageDisappearing,
    
    // Dynamic permission checker
    checkPermission,
    
    // Raw data
    permissionPolicy,
  }
} 